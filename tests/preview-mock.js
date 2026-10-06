// Development preview only: never included in manifest or extension package.
'use strict';
const previewSettings = JSON.parse(localStorage.getItem('previewSettings') || '{}');
let previewAudio = JSON.parse(sessionStorage.getItem('previewAudio') || '{"playing":false,"mode":null}');
const savePreviewAudio = () => sessionStorage.setItem('previewAudio', JSON.stringify(previewAudio));
window.chrome = {
  i18n: { getUILanguage: () => navigator.language },
  storage: { local: {
    get: async () => ({ settings: previewSettings }),
    set: async value => {
      const previousMode = previewSettings.reminderMode || 'short';
      Object.assign(previewSettings, value.settings);
      localStorage.setItem('previewSettings', JSON.stringify(previewSettings));
      if (!previewSettings.sound || !previewSettings.enabled || previewSettings.volume === 0 || previousMode !== previewSettings.reminderMode) {
        previewAudio = { playing: false, mode: null };
        savePreviewAudio();
      }
    }
  } },
  runtime: { sendMessage: async message => {
    if (message.type === 'GET_STATUS') return { ok: true, tabs: [{tabId:1,state:'waiting',updatedAt:Date.now()}], audio: previewAudio };
    if (message.type === 'TEST_ALERT') {
      previewAudio = { playing: Boolean(message.settings?.sound && message.settings?.volume > 0 && message.settings?.reminderMode === 'long'), mode: null };
      if (previewAudio.playing) previewAudio.mode = 'long';
      savePreviewAudio();
      return { ok: true, channels: { desktop: Boolean(message.settings?.desktop), sound: Boolean(message.settings?.sound) } };
    }
    if (message.type === 'STOP_ALERT') {
      previewAudio = { playing: false, mode: null };
      savePreviewAudio();
      return { ok: true, ...previewAudio };
    }
    return { ok: true };
  } }
};
