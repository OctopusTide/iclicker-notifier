"use strict";

(() => {
  const UI_COPY = {
    en: {
      title: "iClicker Alerts", tagline: "Classroom alerts", languageAuto: "Auto",
      enabled: "Enable alerts", monitorStatus: "Monitor status", when: "When to alert",
      classStarted: "Class starts", questionOpened: "New question", how: "How to alert",
      desktop: "Desktop notification", sound: "Sound", tone: "Tone", volume: "Volume",
      reminderMode: "Reminder", shortReminder: "Short", longReminder: "Long",
      reminderHint: "Short rings once. Long repeats until stopped.",
      stop: "Stop sound", preparingSound: "Starting sound…", ringing: "Sound is playing",
      audioUnknown: "Sound status unavailable",
      ringingLong: "Long reminder is ringing", stopping: "Stopping…", stopped: "Sound stopped",
      stopSendError: "Could not stop the sound.", stopError: "Could not stop: {error}. Please retry.",
      chime: "Soft chime", bell: "Clear bell", pulse: "Short pulse",
      audioHint: "Uses your current audio output.", test: "Test alert", open: "Open iClicker ↗",
      footer: "Keep your course tab open and computer awake.",
      loadingTitle: "Connecting…", loadingDetail: "Keep your course page open.",
      pausedTitle: "Alerts paused", pausedDetail: "Use the top-right switch to resume.",
      monitoringOne: "Monitoring 1 course tab", monitoringMany: "Monitoring {count} course tabs",
      connectedTitle: "Connected · open a course", staleTitle: "Waiting for an update",
      staleDetail: "Open your course tab to check that it is still connected.",
      discardedTitle: "Course tabs are asleep", disconnectedTitle: "Page not connected",
      waitingTitle: "Waiting for iClicker", waitingDetail: "Sign in and open your course. Refresh an existing tab if needed.",
      unavailableTitle: "Status unavailable", unavailableDetail: "Reopen this panel or reload the extension.",
      stateWaiting: "Ready for class or the next question.", stateLogin: "Sign in to iClicker to connect.",
      stateHistory: "Open your course or live class to receive alerts.",
      stateQuestion: "A question is open for responses.",
      stateClass: "Class has started. Join to receive question alerts.",
      stateLocked: "Content is locked. Watching for class updates.",
      stateCourses: "Open the course you want to monitor.",
      stateDiscarded: "Open your course tab to wake it up.",
      stateUnknown: "Open and refresh your course page.",
      lastAlert: "Last alert{time}: {alert}", alertClass: "Class started", alertQuestion: "New question",
      alertTest: "Test alert", alertUnknown: "Alert sent",
      saving: "Saving…", saved: "Settings saved", testing: "Sending test…",
      testNeedsChannel: "Turn on desktop notifications or sound to test.",
      testSent: "Test sent. No sound? Check your audio output and volume.",
      testLongSent: "Long reminder started. Click Stop sound to finish.",
      unknownError: "Unknown error", saveError: "Could not save: {error}. Change a setting to retry.",
      statusReadError: "Could not read the monitor status.", lastError: "Last alert issue: {error}",
      testSendError: "Could not send the test alert.", testError: "Test failed: {error}",
      openPageError: "Could not open iClicker.", openError: "Could not open: {error}",
      loadError: "Could not load settings: {error}. Reopen this panel."
    },
    "zh-CN": {
      title: "iClicker 提醒", tagline: "不错过上课与新题", languageAuto: "自动",
      enabled: "启用提醒", monitorStatus: "监测状态", when: "提醒时机",
      classStarted: "课程开始", questionOpened: "出现新题", how: "提醒方式",
      desktop: "桌面通知", sound: "声音提醒", tone: "提示音", volume: "音量",
      reminderMode: "提醒长度", shortReminder: "短提醒", longReminder: "长提醒",
      reminderHint: "短提醒响一次；长提醒持续响，直到手动停止。",
      stop: "停止提醒", preparingSound: "正在启动声音…", ringing: "正在播放提醒",
      audioUnknown: "声音状态暂时未知",
      ringingLong: "长提醒正在响铃", stopping: "正在停止…", stopped: "提醒声音已停止",
      stopSendError: "无法停止声音。", stopError: "停止失败：{error}。请重试。",
      chime: "轻柔和弦", bell: "清脆铃声", pulse: "短促提示",
      audioHint: "使用电脑当前的音频输出设备。", test: "测试提醒", open: "打开 iClicker ↗",
      footer: "保持课程页打开，电脑保持唤醒。",
      loadingTitle: "正在连接…", loadingDetail: "请保持课程页面打开。",
      pausedTitle: "提醒已暂停", pausedDetail: "打开右上角开关，即可恢复提醒。",
      monitoringOne: "正在监测 1 个课程页面", monitoringMany: "正在监测 {count} 个课程页面",
      connectedTitle: "页面已连接 · 请进入课程", staleTitle: "等待页面更新",
      staleDetail: "打开课程标签页，确认页面仍正常连接。",
      discardedTitle: "课程标签页已休眠", disconnectedTitle: "页面尚未连接",
      waitingTitle: "等待 iClicker 页面", waitingDetail: "登录后进入对应课程；已有页面可刷新一次。",
      unavailableTitle: "暂时无法读取状态", unavailableDetail: "请重新打开面板，或重新加载扩展程序。",
      stateWaiting: "已就绪，等待开课或新题。", stateLogin: "请先登录 iClicker。",
      stateHistory: "请回到课程或课堂页面以接收提醒。", stateQuestion: "检测到可回答的新题。",
      stateClass: "课程已开始，加入课堂以接收新题提醒。", stateLocked: "内容已锁定，继续等待课堂更新。",
      stateCourses: "请打开要监测的课程页面。", stateDiscarded: "打开课程标签页以唤醒。",
      stateUnknown: "请打开并刷新课程页面。",
      lastAlert: "最近提醒{time}：{alert}", alertClass: "课程开始", alertQuestion: "出现新题",
      alertTest: "测试提醒", alertUnknown: "已发出提醒",
      saving: "正在保存…", saved: "设置已保存", testing: "正在测试…",
      testNeedsChannel: "请先打开桌面通知或声音提醒。", testSent: "测试已发送。没有声音时，请检查音量与输出设备。",
      testLongSent: "长提醒已开始，点击“停止提醒”即可结束。",
      unknownError: "未知错误", saveError: "设置未能保存：{error}。请重新调整设置以重试。",
      statusReadError: "无法读取监测状态。", lastError: "上次提醒错误：{error}",
      testSendError: "测试提醒未能发送。", testError: "测试失败：{error}",
      openPageError: "无法打开 iClicker。", openError: "打开失败：{error}",
      loadError: "无法读取设置：{error}。请重新打开面板。"
    }
  };
  const $ = id => document.getElementById(id);
  const fields = {
    enabled: $("enabled"), classStarted: $("class-started"), questionOpened: $("question-opened"),
    desktop: $("desktop"), sound: $("sound"), reminderMode: $("reminder-mode"),
    tone: $("tone"), volume: $("volume"), language: $("language")
  };
  let currentSettings;
  let saveQueue = Promise.resolve();
  let editVersion = 0;
  let statusResponse;
  let refreshingStatus = false;
  let statusUnavailable = false;
  let audioStatus = { playing: false, mode: null };
  let audioActionVersion = 0;
  let testPending = false;
  let testSoundPending = false;
  let stopPending = false;
  let stopRetry = false;
  let feedback = null;
  const errors = { action: null, status: null };

  function language() {
    return ICI18n.resolveLanguage(currentSettings?.language || "auto");
  }

  function translate(key, params = {}) {
    const template = UI_COPY[language()][key] || UI_COPY.en[key] || key;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
  }

  function renderMessage(message) {
    return message && typeof message === "object" ? translate(message.key, message.params) : message || "";
  }

  function renderErrors() {
    const text = [...new Set(Object.values(errors).map(renderMessage).filter(Boolean))].join("\n");
    $("error").textContent = text;
    $("error").hidden = !text;
  }

  function showError(message = null, source = "action") {
    errors[source] = message;
    renderErrors();
  }

  function setFeedback(key = null, params = {}) {
    feedback = key ? { key, params } : null;
    $("feedback").textContent = renderMessage(feedback);
  }

  function describeError(error) {
    return error && error.message ? error.message : String(error || translate("unknownError"));
  }

  function renderLastError() {
    if (!statusResponse || statusUnavailable) return;
    const details = statusResponse.lastErrorDetails;
    let error;
    if (Array.isArray(details) && details.length) {
      error = details.map(detail => {
        const key = detail.code ? `error.${detail.code}` : "";
        const translated = key ? ICI18n.t(language(), key) : "";
        const message = translated && translated !== key ? translated : detail.message || translate("unknownError");
        return ["desktop", "sound"].includes(detail.channel)
          ? `${ICI18n.t(language(), `channel.${detail.channel}`)}: ${message}` : message;
      }).join("\n");
    } else {
      error = typeof statusResponse.lastError === "string" ? statusResponse.lastError
        : statusResponse.lastError?.message || statusResponse.lastError?.error;
    }
    showError(error ? { key: "lastError", params: { error } } : null, "status");
  }

  function applyLanguage() {
    document.documentElement.lang = language();
    document.title = translate("title");
    for (const element of document.querySelectorAll("[data-i18n]")) {
      element.textContent = translate(element.dataset.i18n);
    }
    for (const element of document.querySelectorAll("[data-i18n-aria]")) {
      element.setAttribute("aria-label", translate(element.dataset.i18nAria));
    }
    for (const element of document.querySelectorAll("[data-i18n-title]")) {
      element.title = translate(element.dataset.i18nTitle);
    }
    $("feedback").textContent = renderMessage(feedback);
    renderLastError();
    renderErrors();
    renderStatus();
    renderAudioStatus();
  }

  function renderAudioStatus() {
    const unknown = stopRetry || (statusUnavailable && currentSettings?.sound);
    $("active-alert").hidden = !(audioStatus.playing || testSoundPending || stopPending || unknown);
    $("audio-state").textContent = translate(stopPending ? "stopping" : testSoundPending ? "preparingSound"
      : unknown ? "audioUnknown" : audioStatus.mode === "long" ? "ringingLong" : "ringing");
    $("stop-alert").disabled = stopPending;
    $("stop-alert").textContent = translate(stopPending ? "stopping" : "stop");
    $("test-alert").disabled = !currentSettings || testPending || stopPending;
  }

  function syncAudioControls() {
    const soundOn = fields.sound.checked;
    fields.tone.disabled = !soundOn;
    fields.volume.disabled = !soundOn;
    fields.reminderMode.disabled = !soundOn;
    $("sound-options").classList.toggle("muted", !soundOn);
    $("volume-label").textContent = `${fields.volume.value}%`;
    fields.volume.setAttribute("aria-valuetext", `${fields.volume.value}%`);
  }

  function populate(settings) {
    for (const key of ["enabled", "classStarted", "questionOpened", "desktop", "sound"]) {
      fields[key].checked = settings[key];
    }
    fields.tone.value = settings.tone;
    fields.reminderMode.value = settings.reminderMode;
    fields.volume.value = String(Math.round(settings.volume * 100));
    fields.language.value = settings.language;
    syncAudioControls();
  }

  function readSettings() {
    return ICSettings.normalize({
      ...currentSettings,
      enabled: fields.enabled.checked, classStarted: fields.classStarted.checked,
      questionOpened: fields.questionOpened.checked, desktop: fields.desktop.checked,
      sound: fields.sound.checked, volume: Number(fields.volume.value) / 100,
      tone: fields.tone.value, reminderMode: fields.reminderMode.value, language: fields.language.value
    });
  }

  function saveSettings() {
    currentSettings = readSettings();
    const snapshot = { ...currentSettings };
    const version = ++editVersion;
    syncAudioControls();
    applyLanguage();
    showError();
    setFeedback("saving");
    // Keep write order intact when the user changes several controls quickly.
    saveQueue = saveQueue.catch(() => {}).then(() => chrome.storage.local.set({ settings: snapshot }));
    saveQueue.then(() => {
      if (version === editVersion) setFeedback("saved");
    }).catch(error => {
      if (version === editVersion) {
        setFeedback();
        showError({ key: "saveError", params: { error: describeError(error) } });
      }
    });
  }

  function formatTime(raw) {
    const time = new Date(raw);
    if (!Number.isFinite(time.getTime())) return "";
    return time.toLocaleTimeString(language() === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  function stateDescription(state) {
    const key = {
      waiting: "stateWaiting", login: "stateLogin", history: "stateHistory", question: "stateQuestion",
      class: "stateClass", locked: "stateLocked", courses: "stateCourses", discarded: "stateDiscarded"
    }[state] || "stateUnknown";
    return translate(key);
  }

  function renderStatus() {
    const dot = $("status-dot");
    dot.className = "status-dot";
    const tabs = Array.isArray(statusResponse?.tabs) ? statusResponse.tabs : [];
    let title = translate("loadingTitle");
    let detail = translate("loadingDetail");
    if (statusUnavailable) {
      dot.classList.add("warning");
      title = translate("unavailableTitle");
      detail = translate("unavailableDetail");
    } else if (currentSettings && !currentSettings.enabled) {
      title = translate("pausedTitle");
      detail = translate("pausedDetail");
    } else if (tabs.length) {
      const connected = tabs.filter(tab => !["unknown", "discarded"].includes(tab.state) && Number(tab.updatedAt) > 0);
      const recent = connected.filter(tab => Date.now() - Number(tab.updatedAt) <= 90_000);
      const monitoring = recent.filter(tab => !["login", "history", "courses"].includes(tab.state));
      const candidates = monitoring.length ? monitoring : recent.length ? recent : connected.length ? connected : tabs;
      const tab = [...candidates].sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))[0];
      if (monitoring.length) {
        dot.classList.add("active");
        title = translate(monitoring.length === 1 ? "monitoringOne" : "monitoringMany", { count: monitoring.length });
        detail = stateDescription(tab.state);
      } else {
        dot.classList.add("warning");
        if (recent.length) {
          title = translate("connectedTitle");
          detail = stateDescription(tab.state);
        } else if (connected.length) {
          title = translate("staleTitle");
          detail = translate("staleDetail");
        } else {
          title = translate(tabs.every(item => item.state === "discarded") ? "discardedTitle" : "disconnectedTitle");
          detail = stateDescription(tab.state);
        }
      }
    } else if (statusResponse) {
      dot.classList.add("warning");
      title = translate("waitingTitle");
      detail = translate("waitingDetail");
    }
    $("status-title").textContent = title;
    $("status-detail").textContent = detail;
    const last = statusResponse?.lastAlert;
    const lastTime = last && formatTime(last.at || last.timestamp || last.time || last.createdAt);
    const kindKey = { class: "alertClass", question: "alertQuestion", test: "alertTest" }[last?.kind] || "alertUnknown";
    $("last-alert").hidden = !last;
    $("last-alert").textContent = last ? translate("lastAlert", { time: lastTime ? ` ${lastTime}` : "", alert: translate(kindKey) }) : "";
  }

  async function refreshStatus() {
    if (refreshingStatus) return;
    refreshingStatus = true;
    const audioVersion = audioActionVersion;
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
      if (!response?.ok) throw new Error(response?.error || translate("statusReadError"));
      statusResponse = response;
      // A status response sent before Stop must not make stopped audio look active again.
      if (audioVersion === audioActionVersion && !stopPending) {
        audioStatus = response.audio || { playing: false, mode: null };
        stopRetry = false;
      }
      statusUnavailable = false;
      renderStatus();
      renderLastError();
      renderAudioStatus();
    } catch (error) {
      statusUnavailable = true;
      renderStatus();
      renderAudioStatus();
      showError(describeError(error), "status");
    } finally {
      refreshingStatus = false;
    }
  }

  $("settings-form").addEventListener("submit", event => event.preventDefault());
  for (const field of Object.values(fields)) field.addEventListener("change", saveSettings);
  fields.volume.addEventListener("input", syncAudioControls);

  $("test-alert").addEventListener("click", async () => {
    const version = ++audioActionVersion;
    const settings = readSettings();
    testPending = true;
    testSoundPending = settings.sound && settings.volume > 0;
    renderAudioStatus();
    showError();
    setFeedback("testing");
    try {
      if (!settings.desktop && !settings.sound) {
        setFeedback("testNeedsChannel");
        return;
      }
      const response = await chrome.runtime.sendMessage({ type: "TEST_ALERT", settings });
      if (version !== audioActionVersion) return;
      if (!response?.ok) throw new Error(response?.error || translate("testSendError"));
      setFeedback(settings.reminderMode === "long" && settings.sound && settings.volume > 0 ? "testLongSent" : "testSent");
    } catch (error) {
      if (version === audioActionVersion) {
        setFeedback();
        showError({ key: "testError", params: { error: describeError(error) } });
      }
    } finally {
      testPending = false;
      if (version === audioActionVersion) testSoundPending = false;
      await refreshStatus();
      renderAudioStatus();
    }
  });

  $("stop-alert").addEventListener("click", async () => {
    ++audioActionVersion;
    stopPending = true;
    testSoundPending = false;
    renderAudioStatus();
    showError();
    setFeedback("stopping");
    try {
      const response = await chrome.runtime.sendMessage({ type: "STOP_ALERT" });
      if (!response?.ok) throw new Error(response?.error || translate("stopSendError"));
      audioStatus = { playing: false, mode: null };
      stopRetry = false;
      setFeedback("stopped");
    } catch (error) {
      stopRetry = true;
      setFeedback();
      showError({ key: "stopError", params: { error: describeError(error) } });
    } finally {
      stopPending = false;
      renderAudioStatus();
      await refreshStatus();
    }
  });

  $("open-iclicker").addEventListener("click", async () => {
    showError();
    try {
      const response = await chrome.runtime.sendMessage({ type: "OPEN_ICLICKER" });
      if (response && response.ok === false) throw new Error(response.error || translate("openPageError"));
    } catch (error) {
      showError({ key: "openError", params: { error: describeError(error) } });
    }
  });

  async function initialize() {
    applyLanguage();
    try {
      const stored = await chrome.storage.local.get("settings");
      currentSettings = ICSettings.normalize(stored.settings);
      populate(currentSettings);
      applyLanguage();
      $("controls").disabled = false;
      fields.enabled.disabled = false;
      fields.language.disabled = false;
      $("test-alert").disabled = false;
      syncAudioControls();
    } catch (error) {
      showError({ key: "loadError", params: { error: describeError(error) } });
    }
    await refreshStatus();
  }

  void initialize();
  const statusInterval = setInterval(() => {
    if (!document.hidden) void refreshStatus();
  }, 1000);
  addEventListener("pagehide", () => clearInterval(statusInterval), { once: true });
})();
