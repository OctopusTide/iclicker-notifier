'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../extension/service-worker.js'), 'utf8');
const defaults = require('../extension/settings.js').defaults;
const clone = value => JSON.parse(JSON.stringify(value));
const contentSender = id => ({ id: 'unit-test', frameId: 0, tab: { id, url: 'https://student.iclicker.com/#/course/a', windowId: 1 }, url: 'https://student.iclicker.com/#/course/a' });
const popupSender = { id: 'unit-test', url: 'chrome-extension://unit-test/popup.html' };
const event = (eventKey = 'q1', scope = 'course:a', kind = 'question') => ({ type: 'EVENT', kind, scope, eventKey });

function harness(shared = {}) {
  const state = shared.state || {};
  const settings = shared.settings || { ...defaults };
  const calls = { desktop: [], audio: [], audioMessages: [], cleared: [], createDocument: [], tabsCreated: [], tabsUpdated: [] };
  const listeners = {};
  const hook = name => ({ addListener(fn) { listeners[name] = fn; } });
  const tabs = shared.tabs || [{ id: 1, url: 'https://student.iclicker.com/#/course/a', windowId: 1 }];
  const player = shared.player || { exists: false, playing: false, mode: null };
  const chrome = {
    runtime: {
      id: 'unit-test',
      getURL: value => `chrome-extension://unit-test/${value}`,
      getContexts: async () => player.exists ? [{}] : [],
      sendMessage: async message => {
        calls.audioMessages.push(message);
        if (message.type === 'PLAY') calls.audio.push(message);
        if (shared.onAudioMessage) {
          const response = await shared.onAudioMessage(message, player);
          if (response !== undefined) return response;
        }
        if (message.type === 'PLAY') {
          if (shared.audioError) return { ok: false, error: shared.audioError, errorCode: shared.audioErrorCode };
          player.playing = message.volume > 0;
          player.mode = player.playing ? message.mode : null;
        }
        if (message.type === 'STOP') { player.playing = false; player.mode = null; }
        return { ok: true, playing: player.playing, mode: player.mode };
      },
      onMessage: hook('message')
    },
    i18n: { getUILanguage: () => shared.browserLanguage || 'en-US' },
    storage: {
      local: { get: async () => ({ settings: clone(settings) }) },
      onChanged: hook('storage'),
      session: {
        get: async key => ({ [key]: state[key] ? clone(state[key]) : undefined }),
        set: async update => Object.assign(state, clone(update))
      }
    },
    offscreen: { createDocument: async params => {
      calls.createDocument.push(params);
      if (shared.beforeCreateDocument) await shared.beforeCreateDocument();
      player.exists = true;
    } },
    notifications: {
      getPermissionLevel: async () => shared.permission || 'granted',
      create: async (id, options) => {
        if (shared.desktopError) throw new Error(shared.desktopError);
        calls.desktop.push({ id, options }); return id;
      },
      clear: async id => { calls.cleared.push(id); return true; },
      onClicked: hook('clicked'), onClosed: hook('closed'), onButtonClicked: hook('buttonClicked')
    },
    tabs: {
      query: async () => tabs.filter(tab => tab.url.startsWith('https://student.iclicker.com/')),
      get: async id => { const tab = tabs.find(tab => tab.id === id); if (!tab) throw new Error('tab closed'); return tab; },
      create: async options => { calls.tabsCreated.push(options); return { id: 99 }; },
      update: async (id, options) => { calls.tabsUpdated.push({ id, options }); return tabs.find(tab => tab.id === id); },
      onRemoved: hook('removed'), onUpdated: hook('updated')
    },
    windows: { update: async () => undefined }
  };
  const context = vm.createContext({
    chrome, URL, Date, console: { error() {} },
    navigator: { language: shared.navigatorLanguage || 'en-US' }
  });
  context.importScripts = (...files) => {
    for (const file of files) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, '../extension', file), 'utf8'), context, { filename: file });
    }
  };
  if (shared.noChromeI18n) delete chrome.i18n;
  vm.runInContext(source, context, { filename: 'service-worker.js' });
  function send(message, sender = popupSender) {
    return new Promise((resolve, reject) => {
      const accepted = listeners.message(message, sender, resolve);
      if (!accepted) reject(new Error('no receiver'));
    });
  }
  async function setSettings(update) {
    const oldValue = clone(settings);
    Object.assign(settings, update);
    await listeners.storage({ settings: { oldValue, newValue: clone(settings) } }, 'local');
  }
  return { send, state, settings, calls, listeners, tabs, player, setSettings };
}

test('concurrent duplicate events across tabs deliver exactly once; distinct questions are not rate limited', async () => {
  const h = harness();
  const responses = await Promise.all([h.send(event(), contentSender(1)), h.send(event(), contentSender(2))]);
  assert.equal(responses.filter(result => result.skipped === 'duplicate').length, 1);
  assert.equal(h.calls.desktop.length, 1);
  assert.equal(h.calls.audio.length, 1);
  const next = await h.send(event('q2'), contentSender(1));
  assert.equal(next.ok, true);
  assert.equal(h.calls.desktop.length, 2);
  assert.equal(h.calls.createDocument.length, 1);
  assert.equal(h.calls.createDocument[0].reasons[0], 'AUDIO_PLAYBACK');
  assert.equal(h.calls.desktop[0].options.silent, true);
});

test('deduplication survives worker restarts, expires after ten seconds, and separates courses', async () => {
  const first = harness();
  await first.send(event(), contentSender(1));
  const restarted = harness({ state: first.state });
  assert.equal((await restarted.send(event(), contentSender(1))).skipped, 'duplicate');
  assert.equal((await restarted.send(event('q1', 'course:b'), contentSender(1))).ok, true);
  const state = restarted.state.iclickerRuntime;
  const key = JSON.stringify(['question', 'course:a', 'q1']);
  state.seen[key] = Date.now() - 10_001;
  assert.equal((await restarted.send(event(), contentSender(1))).ok, true);
  assert.equal(restarted.calls.desktop.length, 2);
});

test('toggles gate actual events independently while test previews honor channel and tone overrides', async () => {
  const h = harness();
  h.settings.classStarted = false;
  assert.equal((await h.send(event('class1', 'course:a', 'class'), contentSender(1))).skipped, 'disabled');
  h.settings.enabled = false;
  assert.equal((await h.send(event(), contentSender(1))).skipped, 'disabled');
  const preview = await h.send({ type: 'TEST_ALERT', settings: { desktop: false, sound: true, tone: 'bell', volume: 0.2 } });
  assert.equal(preview.ok, true);
  assert.equal(h.calls.desktop.length, 0);
  assert.equal(h.calls.audio[0].tone, 'bell');
  assert.equal(h.calls.audio[0].volume, 0.2);
  assert.equal((await h.send({ type: 'TEST_ALERT', settings: { desktop: false, sound: false } })).ok, false);
});

test('content messages require exact student origin and main frame; content cannot invoke privileged UI operations', async () => {
  const h = harness();
  const malicious = contentSender(1);
  malicious.tab.url = 'https://student.iclicker.com.evil.test/';
  assert.equal((await h.send(event(), malicious)).ok, false);
  const frame = { ...contentSender(1), frameId: 2 };
  assert.equal((await h.send(event(), frame)).ok, false);
  assert.equal((await h.send({ type: 'TEST_ALERT' }, contentSender(1))).ok, false);
  assert.equal(h.calls.audio.length, 0);
  assert.equal(h.calls.desktop.length, 0);
  await assert.rejects(h.send({ target: 'offscreen', type: 'PLAY' }), /no receiver/);
});

test('total delivery failure reports error, preserves retry, and a later success clears error', async () => {
  const shared = { audioError: 'audio unavailable', desktopError: 'notification unavailable' };
  const h = harness(shared);
  const failure = await h.send(event(), contentSender(1));
  assert.equal(failure.ok, false);
  assert.match(failure.error, /audio unavailable/);
  assert.match((await h.send({ type: 'GET_STATUS' })).lastError, /notification unavailable/);
  shared.audioError = null;
  shared.desktopError = null;
  assert.equal((await h.send(event(), contentSender(1))).ok, true);
  assert.equal((await h.send({ type: 'GET_STATUS' })).lastError, null);
  assert.equal(h.calls.desktop.length, 1);
});

test('partial channel success reports error and suppresses duplicate delivery', async () => {
  const h = harness({ permission: 'denied' });
  const response = await h.send(event(), contentSender(1));
  assert.equal(response.ok, false);
  assert.equal(response.channels.sound, true);
  assert.equal(response.channels.desktop, false);
  assert.equal((await h.send(event(), contentSender(1))).skipped, 'duplicate');
  assert.equal(h.calls.audio.length, 1);
});

test('status covers uninjected and discarded tabs and removes closed tabs', async () => {
  const h = harness({ tabs: [
    { id: 1, url: 'https://student.iclicker.com/', windowId: 1 },
    { id: 2, url: 'https://student.iclicker.com/', windowId: 1 },
    { id: 3, url: 'https://student.iclicker.com/', windowId: 1, discarded: true }
  ] });
  await h.send({ type: 'STATUS', state: 'class', label: '课程进行中' }, contentSender(1));
  let response = await h.send({ type: 'GET_STATUS' });
  assert.equal(response.tabs[0].label, '课程进行中');
  assert.equal(response.tabs[1].state, 'unknown');
  assert.equal(response.tabs[2].state, 'discarded');
  h.listeners.removed(1);
  h.tabs.splice(0, 1);
  response = await h.send({ type: 'GET_STATUS' });
  assert.equal(response.tabs.length, 2);
  assert.equal(h.state.iclickerRuntime.tabs[1], undefined);
});

test('notification click focuses its source, but opens student home if source navigated away', async () => {
  const h = harness();
  await h.send(event(), contentSender(1));
  h.listeners.clicked(h.calls.desktop[0].id);
  await h.send({ type: 'GET_STATUS' });
  assert.equal(h.calls.tabsUpdated[0].id, 1);
  assert.equal(h.calls.tabsCreated.length, 0);
  await h.send(event('q2'), contentSender(1));
  h.tabs[0].url = 'https://example.com/';
  h.listeners.clicked(h.calls.desktop[1].id);
  await h.send({ type: 'GET_STATUS' });
  assert.equal(h.calls.tabsCreated[0].url, 'https://student.iclicker.com/');
});

test('class, question, and test notifications and audio follow the chosen language', async () => {
  for (const language of ['en', 'zh-CN']) {
    const h = harness({ settings: { ...defaults, language }, browserLanguage: language === 'en' ? 'zh-CN' : 'en-US' });
    await h.send(event('class1', 'course:a', 'class'), contentSender(1));
    await h.send(event(), contentSender(1));
    await h.send({ type: 'TEST_ALERT' });
    const titles = h.calls.desktop.map(call => call.options.title);
    assert.deepEqual(titles, language === 'en' ? [
      'iClicker class has started', 'New iClicker question', 'iClicker test alert'
    ] : ['iClicker 开始上课了', 'iClicker 有新问题', 'iClicker 测试提醒']);
    assert.match(h.calls.desktop[1].options.message, language === 'en' ? /instructor/ : /老师/);
    assert.ok(h.calls.audio.every(call => call.language === language));
  }
});

test('auto follows browser locale without persisting a resolved locale or test overrides', async () => {
  const settings = { ...defaults };
  const first = harness({ settings, browserLanguage: 'zh-TW' });
  await first.send({ type: 'TEST_ALERT' });
  assert.equal(first.calls.desktop[0].options.title, 'iClicker 测试提醒');
  assert.equal(settings.language, 'auto');
  await first.send({ type: 'TEST_ALERT', settings: { language: 'en' } });
  assert.equal(first.calls.desktop[1].options.title, 'iClicker test alert');
  assert.equal(settings.language, 'auto');
  const restarted = harness({ settings, state: first.state, browserLanguage: 'fr-FR' });
  await restarted.send({ type: 'TEST_ALERT' });
  assert.equal(restarted.calls.desktop[0].options.title, 'iClicker test alert');
  const fallback = harness({ settings: { ...defaults }, noChromeI18n: true, navigatorLanguage: 'zh-CN' });
  await fallback.send({ type: 'TEST_ALERT' });
  assert.equal(fallback.calls.desktop[0].options.title, 'iClicker 测试提醒');
});

test('known channel errors can be translated again after changing the language', async () => {
  const h = harness({ permission: 'denied', audioError: '音频不可用', audioErrorCode: 'audio_blocked', settings: { ...defaults, language: 'en' } });
  const response = await h.send({ type: 'TEST_ALERT' });
  assert.match(response.error, /Desktop notification: Chrome has disabled/);
  assert.match(response.error, /Sound: Chrome has not allowed/);
  h.settings.language = 'zh-CN';
  const status = await h.send({ type: 'GET_STATUS' });
  assert.match(status.lastError, /桌面通知: Chrome 已禁用/);
  assert.match(status.lastError, /声音: Chrome 暂未允许/);
  assert.deepEqual(status.lastErrorDetails.map(detail => detail.code).sort(), ['audio_blocked', 'notification_permission']);
});

test('validation errors use saved language and preview-only language overrides', async () => {
  const h = harness({ settings: { ...defaults, language: 'zh-CN' }, browserLanguage: 'en-US' });
  const unknown = await h.send({ type: 'UNKNOWN' });
  assert.equal(unknown.error, '未知的扩展操作。');
  assert.equal(unknown.errorCode, 'unknown_action');
  const disabled = await h.send({ type: 'TEST_ALERT', settings: { desktop: false, sound: false, language: 'en' } });
  assert.match(disabled.error, /Enable desktop notifications or sound/);
  assert.equal(disabled.errorCode, 'no_channels');
});

test('unrecognized browser audio error codes retain their diagnostic message', async () => {
  const h = harness({ audioError: 'Audio device unavailable', audioErrorCode: 9 });
  const response = await h.send({ type: 'TEST_ALERT' });
  assert.match(response.error, /Audio device unavailable/);
  assert.doesNotMatch(response.error, /error\.9/);
});

test('short and long reminder modes reach the player and long notifications offer a localized stop button', async () => {
  for (const language of ['en', 'zh-CN']) {
    const h = harness({ settings: { ...defaults, language, reminderMode: 'long' } });
    await h.send(event(), contentSender(1));
    assert.equal(h.calls.audio[0].mode, 'long');
    assert.equal(h.calls.desktop[0].options.buttons[0].title, language === 'en' ? 'Stop sound' : '停止提醒');
    assert.equal((await h.send({ type: 'GET_STATUS' })).audio.mode, 'long');
    await h.send({ type: 'TEST_ALERT', settings: { reminderMode: 'short' } });
    assert.equal(h.calls.audio[1].mode, 'short');
    assert.equal(h.calls.desktop[1].options.buttons, undefined);
    assert.equal(h.settings.reminderMode, 'long');
    await h.send({ type: 'TEST_ALERT', settings: { volume: 0 } });
    assert.equal(h.calls.desktop[2].options.buttons, undefined);
  }
});

test('status and stop never create an offscreen document; playing state survives a worker restart', async () => {
  const first = harness({ settings: { ...defaults, reminderMode: 'long' } });
  assert.deepEqual(clone((await first.send({ type: 'GET_STATUS' })).audio), { playing: false, mode: null });
  assert.equal((await first.send({ type: 'STOP_ALERT' })).ok, true);
  assert.equal(first.calls.createDocument.length, 0);
  await first.send(event(), contentSender(1));
  const restarted = harness({ state: first.state, player: first.player, settings: first.settings });
  assert.deepEqual(clone((await restarted.send({ type: 'GET_STATUS' })).audio), { playing: true, mode: 'long' });
  assert.deepEqual(clone(await restarted.send({ type: 'STOP_ALERT' })), { ok: true, playing: false, mode: null });
  assert.equal((await restarted.send({ type: 'GET_STATUS' })).audio.playing, false);
  assert.equal(restarted.calls.createDocument.length, 0);
});

test('content pages and foreign extensions cannot stop playback', async () => {
  const h = harness({ settings: { ...defaults, reminderMode: 'long' } });
  await h.send(event(), contentSender(1));
  for (const sender of [contentSender(1), { id: 'foreign-extension', url: 'chrome-extension://unit-test/popup.html' }]) {
    const result = await h.send({ type: 'STOP_ALERT' }, sender);
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'extension_sender');
  }
  assert.equal(h.player.playing, true);
  assert.equal(h.calls.audioMessages.filter(message => message.type === 'STOP').length, 0);
});

test('the stop notification button stops audio without opening a tab; dismissal keeps the reminder sounding', async () => {
  const h = harness({ settings: { ...defaults, reminderMode: 'long' } });
  await h.send(event(), contentSender(1));
  const firstId = h.calls.desktop[0].id;
  h.listeners.closed(firstId);
  await h.send({ type: 'GET_STATUS' });
  assert.equal(h.player.playing, true);
  await h.send(event('q2'), contentSender(1));
  const secondId = h.calls.desktop[1].id;
  h.listeners.buttonClicked(secondId, 0);
  await h.send({ type: 'GET_STATUS' });
  assert.equal(h.player.playing, false);
  assert.ok(h.calls.cleared.includes(secondId));
  assert.equal(h.calls.tabsCreated.length + h.calls.tabsUpdated.length, 0);
  assert.equal(h.state.iclickerRuntime.notifications[secondId], undefined);
});

test('notification body clicks stop audio as well as focusing the source tab', async () => {
  const h = harness({ settings: { ...defaults, reminderMode: 'long' } });
  await h.send(event(), contentSender(1));
  h.listeners.clicked(h.calls.desktop[0].id);
  await h.send({ type: 'GET_STATUS' });
  assert.equal(h.player.playing, false);
  assert.equal(h.calls.tabsUpdated[0].id, 1);
});

test('disabling alerts, muting, setting zero volume, or switching reminder mode stops playback', async () => {
  for (const update of [{ enabled: false }, { sound: false }, { volume: 0 }, { reminderMode: 'short' }]) {
    const h = harness({ settings: { ...defaults, reminderMode: 'long' } });
    await h.send(event(), contentSender(1));
    await h.setSettings(update);
    assert.equal(h.player.playing, false, JSON.stringify(update));
  }
  const h = harness({ settings: { ...defaults, reminderMode: 'long' } });
  await h.send(event(), contentSender(1));
  await h.setSettings({ language: 'zh-CN', desktop: false });
  assert.equal(h.player.playing, true);
});

function deferred() {
  let resolve;
  const promise = new Promise(accept => { resolve = accept; });
  return { promise, resolve };
}

test('stop interrupts startup immediately and prevents an in-flight audio connection retry', async () => {
  const started = deferred();
  const release = deferred();
  const h = harness({ settings: { ...defaults, reminderMode: 'long', desktop: false },
    onAudioMessage: async message => {
      if (message.type !== 'PLAY') return;
      started.resolve();
      await release.promise;
      throw new Error('Receiving end does not exist');
    }
  });
  const pending = h.send(event(), contentSender(1));
  await started.promise;
  const stopped = await h.send({ type: 'STOP_ALERT' });
  assert.equal(stopped.ok, true);
  release.resolve();
  assert.equal((await pending).channels.sound, false);
  assert.equal(h.calls.audio.length, 1);
});

test('stop cancels queued events and playback awaiting offscreen creation without muting future alerts', async () => {
  const creating = deferred();
  const release = deferred();
  const h = harness({ settings: { ...defaults, reminderMode: 'long', desktop: false },
    beforeCreateDocument: async () => { creating.resolve(); await release.promise; }
  });
  const first = h.send(event(), contentSender(1));
  await creating.promise;
  const queued = h.send(event('q2'), contentSender(1));
  assert.equal((await h.send({ type: 'STOP_ALERT' })).ok, true);
  release.resolve();
  await Promise.all([first, queued]);
  assert.equal(h.calls.audio.length, 0);
  assert.equal((await h.send(event('q3'), contentSender(1))).channels.sound, true);
  assert.equal(h.calls.audio.length, 1);
});

test('a stopped sound-only event stays deduplicated when a delayed copy arrives from another tab', async () => {
  const creating = deferred();
  const release = deferred();
  const h = harness({ settings: { ...defaults, reminderMode: 'long', desktop: false },
    beforeCreateDocument: async () => { creating.resolve(); await release.promise; }
  });
  const pending = h.send(event(), contentSender(1));
  await creating.promise;
  await h.send({ type: 'STOP_ALERT' });
  release.resolve();
  assert.equal((await pending).channels.sound, false);
  const delayed = await h.send(event(), contentSender(2));
  assert.equal(delayed.skipped, 'duplicate');
  assert.equal(h.calls.audio.length, 0);
  const restarted = harness({ state: h.state, settings: h.settings, player: h.player });
  assert.equal((await restarted.send(event(), contentSender(2))).skipped, 'duplicate');
  assert.equal((await restarted.send(event('q2'), contentSender(2))).channels.sound, true);
});

test('an unanswered audio query does not report stopped unless the offscreen document has closed', async () => {
  let failure = null;
  const h = harness({ settings: { ...defaults, reminderMode: 'long' },
    onAudioMessage: async (message, player) => {
      if (message.type !== 'GET_AUDIO_STATUS' || !failure) return;
      if (failure === 'response') return { ok: false };
      if (failure === 'closed') player.exists = false;
      throw new Error('Message port closed');
    }
  });
  await h.send(event(), contentSender(1));
  assert.equal((await h.send({ type: 'GET_STATUS' })).audio.playing, true);
  for (failure of ['response', 'connection']) {
    const status = await h.send({ type: 'GET_STATUS' });
    assert.equal(status.ok, false);
    assert.equal(status.errorCode, 'audio_no_response');
    assert.equal(status.audio, undefined);
    assert.equal(h.player.playing, true);
  }
  failure = 'closed';
  assert.deepEqual(clone((await h.send({ type: 'GET_STATUS' })).audio), { playing: false, mode: null });
});
