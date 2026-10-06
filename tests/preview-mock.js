// Development preview only: never included in manifest or extension package.
'use strict';
const previewSettings = JSON.parse(localStorage.getItem('previewSettings') || '{}');
window.chrome = {
  i18n: { getUILanguage: () => navigator.language },
  storage: { local: {
    get: async () => ({ settings: previewSettings }),
    set: async value => { Object.assign(previewSettings, value.settings); localStorage.setItem('previewSettings', JSON.stringify(previewSettings)); }
  } },
  runtime: { sendMessage: async message => {
    if (message.type === 'GET_STATUS') return { ok: true, tabs: [{tabId:1,state:'waiting',updatedAt:Date.now()}] };
    if (message.type === 'TEST_ALERT') return { ok: false, error: ICI18n.resolveLanguage(message.settings?.language) === 'zh-CN'
      ? '这是界面预览。请在已安装的插件中测试声音和通知。'
      : 'This is a UI preview. Test sound and notifications in the installed extension.' };
    return { ok: true };
  } }
};
