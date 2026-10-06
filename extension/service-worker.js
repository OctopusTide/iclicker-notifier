'use strict';

importScripts('settings.js', 'i18n.js');

const STUDENT_ORIGIN = 'https://student.iclicker.com';
const OFFSCREEN_PATH = 'offscreen.html';
const STATE_KEY = 'iclickerRuntime';
const DEDUP_MS = 10_000;
let queue = Promise.resolve();
let creatingOffscreen = null;
let notificationSequence = 0;
let soundGeneration = 0;

// Serialize session mutations as well as delivery: two open course tabs must not
// race past deduplication, including after a service-worker restart.
function serialized(task) {
  const result = queue.then(task);
  queue = result.catch(() => undefined);
  return result;
}

function isStudentUrl(value) {
  try { return new URL(value).origin === STUDENT_ORIGIN; }
  catch { return false; }
}

function isContentSender(sender) {
  return sender.id === chrome.runtime.id && Number.isInteger(sender.tab?.id) &&
    sender.frameId === 0 && isStudentUrl(sender.tab.url) && isStudentUrl(sender.url);
}

function isExtensionSender(sender) {
  try {
    const url = new URL(sender.url);
    return sender.id === chrome.runtime.id && url.protocol === 'chrome-extension:' &&
      url.hostname === chrome.runtime.id;
  } catch { return false; }
}

function cleanString(value, maxLength) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength) : '';
}

function localizedError(code, language) {
  const error = new Error(ICI18n.t(language, `error.${code}`));
  error.code = code;
  error.language = language;
  return error;
}

function errorText(error, language = 'auto') {
  if (error?.code && ICI18n.t(language, `error.${error.code}`) !== `error.${error.code}`) {
    return ICI18n.t(language, `error.${error.code}`);
  }
  return cleanString(error?.message || (error == null ? '' : String(error)), 500) || ICI18n.t(language, 'error.unknown');
}

function formatErrors(details, language) {
  const separator = ICI18n.resolveLanguage(language) === 'zh-CN' ? '；' : '; ';
  return details.map(detail => {
    const message = errorText({ code: detail.code, message: detail.message }, language);
    return detail.channel ? `${ICI18n.t(language, `channel.${detail.channel}`)}: ${message}` : message;
  }).join(separator);
}

async function readState() {
  const stored = (await chrome.storage.session.get(STATE_KEY))[STATE_KEY];
  return {
    tabs: stored?.tabs || {},
    seen: stored?.seen || {},
    notifications: stored?.notifications || {},
    lastAlert: stored?.lastAlert || null,
    lastError: stored?.lastError || null,
    lastErrorDetails: stored?.lastErrorDetails || null
  };
}

async function writeState(state) {
  await chrome.storage.session.set({ [STATE_KEY]: state });
}

async function recordError(error) {
  let language = error?.language;
  if (!language) {
    try { language = (await settingsFor()).language; } catch { language = 'auto'; }
  }
  const message = errorText(error, language);
  try {
    const state = await readState();
    state.lastError = message;
    state.lastErrorDetails = [{ channel: null, code: error?.code || null, message }];
    await writeState(state);
  } catch (storageError) {
    console.error('Could not save the alert error:', storageError);
  }
  console.error('iClicker Notifier:', message);
  return { ok: false, error: message, ...(error?.code ? { errorCode: error.code } : {}) };
}

async function settingsFor(override) {
  const { settings } = await chrome.storage.local.get('settings');
  const current = ICSettings.normalize(settings);
  return ICSettings.normalize(override && typeof override === 'object' ? { ...current, ...override } : current);
}

async function ensureOffscreen() {
  if (creatingOffscreen) return creatingOffscreen;
  creatingOffscreen = (async () => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
    });
    if (!contexts.length) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play a local notification sound when an iClicker class or question starts.'
      });
    }
  })();
  try { await creatingOffscreen; }
  finally { creatingOffscreen = null; }
}

async function audioContexts() {
  return chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
  });
}

async function audioStatus() {
  const idle = { playing: false, mode: null };
  if (!(await audioContexts()).length) return idle;
  try {
    const response = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'GET_AUDIO_STATUS' });
    if (!response?.ok || typeof response.playing !== 'boolean') throw localizedError('audio_no_response');
    if (!response.playing) return idle;
    return { playing: true, mode: response.mode === 'long' ? 'long' : 'short' };
  } catch {
    // Chrome can close a silent offscreen document between these two calls.
    if (!(await audioContexts()).length) return idle;
    // An unanswered query does not prove playback stopped. Preserve the popup's
    // previous state and stop control by reporting an unavailable status.
    throw localizedError('audio_no_response');
  }
}

async function stopSound() {
  // Invalidate requests already waiting for delivery before the first await.
  // STOP runs outside the session queue so audio startup cannot delay it.
  soundGeneration += 1;
  if (!(await audioContexts()).length) return { ok: true, playing: false, mode: null };
  try {
    const response = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP' });
    if (!response?.ok) throw localizedError('audio_no_response');
  } catch (error) {
    if (!(await audioContexts()).length) return { ok: true, playing: false, mode: null };
    throw error;
  }
  return { ok: true, playing: false, mode: null };
}

async function playSound(settings, generation) {
  // AUDIO_PLAYBACK documents expire after silence. A single retry handles a
  // document closing between getContexts() and sendMessage().
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (generation !== soundGeneration) return false;
    await ensureOffscreen();
    if (generation !== soundGeneration) return false;
    let response;
    try {
      response = await chrome.runtime.sendMessage({
        target: 'offscreen', type: 'PLAY', tone: settings.tone, volume: settings.volume, mode: settings.reminderMode,
        language: ICI18n.resolveLanguage(settings.language)
      });
    } catch (error) {
      if (generation !== soundGeneration) return false;
      if (attempt === 0 && /receiving end|connection|port closed/i.test(errorText(error))) continue;
      throw error;
    }
    if (generation !== soundGeneration) return false;
    if (!response?.ok) {
      if (response?.errorCode && ICI18n.t(settings.language, `error.${response.errorCode}`) !== `error.${response.errorCode}`) {
        throw localizedError(response.errorCode, settings.language);
      }
      if (response?.error) throw new Error(response.error);
      throw localizedError('audio_no_response', settings.language);
    }
    return generation === soundGeneration && !response.cancelled;
  }
  throw localizedError('audio_connection', settings.language);
}

async function sendAlert(kind, tabId, settings, state, generation) {
  const language = ICI18n.resolveLanguage(settings.language);
  const title = ICI18n.t(language, `alert.${kind}.title`);
  const message = ICI18n.t(language, `alert.${kind}.body`);
  const channels = { desktop: false, sound: false };
  const errors = [];
  const operations = [];
  if (settings.desktop) {
    operations.push((async () => {
      try {
        if (await chrome.notifications.getPermissionLevel() !== 'granted') {
          throw localizedError('notification_permission', language);
        }
        const id = `iclicker:${Date.now()}:${notificationSequence++}`;
        await chrome.notifications.create(id, {
          type: 'basic', iconUrl: 'icons/icon128.png', title, message,
          priority: 1, silent: true,
          ...(settings.reminderMode === 'long' && settings.sound && settings.volume > 0 ? {
            buttons: [{ title: ICI18n.t(language, 'alert.stopSound') }]
          } : {})
        });
        state.notifications[id] = { tabId, at: Date.now() };
        channels.desktop = true;
      } catch (error) { errors.push({ channel: 'desktop', code: error?.code || null, message: errorText(error, language) }); }
    })());
  }
  if (settings.sound) {
    operations.push((async () => {
      try { channels.sound = await playSound(settings, generation); }
      catch (error) { errors.push({ channel: 'sound', code: error?.code || null, message: errorText(error, language) }); }
    })());
  }
  await Promise.all(operations);
  if (channels.desktop || channels.sound) {
    state.lastAlert = { kind, title, at: Date.now(), tabId, channels };
  }
  state.lastError = errors.length ? formatErrors(errors, language) : null;
  state.lastErrorDetails = errors.length ? errors : null;
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  state.notifications = Object.fromEntries(Object.entries(state.notifications)
    .filter(([, record]) => record.at >= cutoff).sort((a, b) => b[1].at - a[1].at).slice(0, 100));
  return { ok: errors.length === 0, channels, ...(errors.length ? { error: state.lastError } : {}) };
}

async function receiveEvent(message, sender, generation) {
  if (message.kind !== 'class' && message.kind !== 'question') throw localizedError('unsupported_event');
  const eventKey = cleanString(message.eventKey, 512);
  const scope = cleanString(message.scope, 256);
  if (!eventKey || !scope) throw localizedError('missing_event');
  const settings = await settingsFor();
  if (!settings.enabled || (message.kind === 'class' ? !settings.classStarted : !settings.questionOpened)) {
    return { ok: true, skipped: 'disabled' };
  }
  if (!settings.desktop && !settings.sound) return { ok: true, skipped: 'no_channels' };
  const state = await readState();
  const now = Date.now();
  state.seen = Object.fromEntries(Object.entries(state.seen).filter(([, at]) => now - at < DEDUP_MS));
  const key = JSON.stringify([message.kind, scope, eventKey]);
  if (Object.hasOwn(state.seen, key)) return { ok: true, skipped: 'duplicate' };
  state.seen[key] = now;
  // Claim the event before delivering any channel so a worker restart does not
  // replay a sound already heard. A real delivery failure releases this claim;
  // an explicit stop keeps it so a delayed duplicate cannot restart the sound.
  await writeState(state);
  const result = await sendAlert(message.kind, sender.tab.id, settings, state, generation);
  if (!result.channels.desktop && !result.channels.sound && generation === soundGeneration) delete state.seen[key];
  await writeState(state);
  return result;
}

async function receiveStatus(message, sender) {
  const state = await readState();
  state.tabs[sender.tab.id] = {
    tabId: sender.tab.id,
    state: cleanString(message.state, 60) || 'unknown',
    label: cleanString(message.label, 160) || '等待页面状态',
    updatedAt: Date.now()
  };
  await writeState(state);
  return { ok: true };
}

async function getStatus() {
  const [state, tabs, settings, audio] = await Promise.all([
    readState(), chrome.tabs.query({ url: `${STUDENT_ORIGIN}/*` }), settingsFor(), audioStatus()
  ]);
  return {
    ok: true,
    audio,
    tabs: tabs.map(tab => tab.discarded ? {
      tabId: tab.id, state: 'discarded', label: '标签页已休眠，请打开课程页面', updatedAt: 0
    } : state.tabs[tab.id] || {
      tabId: tab.id, state: 'unknown', label: '尚未连接，请刷新课程页面', updatedAt: 0
    }),
    lastAlert: state.lastAlert,
    lastError: state.lastErrorDetails?.length ? formatErrors(state.lastErrorDetails, settings.language) : state.lastError,
    lastErrorDetails: state.lastErrorDetails
  };
}

async function openIclicker(tabId) {
  if (Number.isInteger(tabId)) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (isStudentUrl(tab.url)) {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
        return { ok: true, tabId: tab.id };
      }
    } catch { /* The source tab may have been closed. Open the student app below. */ }
  }
  const tab = await chrome.tabs.create({ url: `${STUDENT_ORIGIN}/` });
  return { ok: true, tabId: tab.id };
}

async function handleMessage(message, sender, generation) {
  if (message.type === 'STATUS' || message.type === 'EVENT') {
    if (!isContentSender(sender)) throw localizedError('content_sender');
    return message.type === 'STATUS' ? receiveStatus(message, sender) : receiveEvent(message, sender, generation);
  }
  if (!isExtensionSender(sender)) throw localizedError('extension_sender');
  if (message.type === 'GET_STATUS') return getStatus();
  if (message.type === 'OPEN_ICLICKER') {
    const existing = await chrome.tabs.query({ url: `${STUDENT_ORIGIN}/*` });
    return openIclicker(Number.isInteger(message.tabId) ? message.tabId : existing[0]?.id);
  }
  if (message.type === 'TEST_ALERT') {
    const settings = await settingsFor(message.settings);
    if (!settings.desktop && !settings.sound) throw localizedError('no_channels', settings.language);
    const state = await readState();
    const result = await sendAlert('test', null, settings, state, generation);
    await writeState(state);
    return result;
  }
  throw localizedError('unknown_action');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Do not respond to offscreen messages: its own listener owns that response.
  if (!message || message.target === 'offscreen') return false;
  if (message.type === 'STOP_ALERT' && isExtensionSender(sender)) {
    stopSound().then(sendResponse, error => {
      serialized(() => recordError(error)).then(sendResponse);
    });
    return true;
  }
  const generation = soundGeneration;
  serialized(async () => {
    try { return await handleMessage(message, sender, generation); }
    catch (error) { return recordError(error); }
  }).then(sendResponse, error => sendResponse({ ok: false, error: errorText(error) }));
  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.settings) return;
  const before = ICSettings.normalize(changes.settings.oldValue);
  const after = ICSettings.normalize(changes.settings.newValue);
  if (!after.enabled || !after.sound || after.volume === 0 || before.reminderMode !== after.reminderMode) {
    return stopSound().catch(error => serialized(() => recordError(error)));
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  serialized(async () => {
    const state = await readState();
    delete state.tabs[tabId];
    await writeState(state);
  }).catch(console.error);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url || isStudentUrl(changeInfo.url)) return;
  serialized(async () => {
    const state = await readState();
    delete state.tabs[tabId];
    await writeState(state);
  }).catch(console.error);
});

chrome.notifications.onClicked.addListener(id => {
  if (!id.startsWith('iclicker:')) return;
  const stopping = stopSound().catch(error => ({ error }));
  serialized(async () => {
    try {
      const stopped = await stopping;
      if (stopped.error) throw stopped.error;
      const state = await readState();
      await openIclicker(state.notifications[id]?.tabId);
      await chrome.notifications.clear(id);
      delete state.notifications[id];
      await writeState(state);
    } catch (error) { await recordError(error); }
  }).catch(console.error);
});

chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
  if (!id.startsWith('iclicker:') || buttonIndex !== 0) return;
  const stopping = stopSound().catch(error => ({ error }));
  serialized(async () => {
    try {
      const stopped = await stopping;
      if (stopped.error) throw stopped.error;
      await chrome.notifications.clear(id);
      const state = await readState();
      delete state.notifications[id];
      await writeState(state);
    } catch (error) { await recordError(error); }
  }).catch(console.error);
});

chrome.notifications.onClosed.addListener(id => {
  if (!id.startsWith('iclicker:')) return;
  serialized(async () => {
    const state = await readState();
    delete state.notifications[id];
    await writeState(state);
  }).catch(console.error);
});
