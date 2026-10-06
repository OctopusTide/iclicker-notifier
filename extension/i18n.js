(function (root) {
  'use strict';

  const messages = Object.freeze({
    en: Object.freeze({
      'alert.class.title': 'iClicker class has started',
      'alert.class.body': 'Your class has started. Click to return to iClicker.',
      'alert.question.title': 'New iClicker question',
      'alert.question.body': 'Your instructor has opened a question. Check your course page.',
      'alert.test.title': 'iClicker test alert',
      'alert.test.body': 'This is a test. Check that sound and desktop notifications match your settings.',
      'alert.stopSound': 'Stop sound',
      'channel.desktop': 'Desktop notification',
      'channel.sound': 'Sound',
      'error.unknown': 'An unknown error occurred.',
      'error.notification_permission': 'Chrome has disabled notifications for this extension. Allow notifications in Chrome and your system settings.',
      'error.audio_no_response': 'The sound player did not respond.',
      'error.audio_connection': 'Could not connect to the sound player.',
      'error.audio_timeout': 'Audio startup timed out. Test the alert again in the extension.',
      'error.audio_blocked': 'Chrome has not allowed audio playback yet. Click Test alert in the extension.',
      'error.audio_sender': 'The sound playback request has an invalid source.',
      'error.unsupported_event': 'This alert type is not supported.',
      'error.missing_event': 'The alert is missing a course or event identifier.',
      'error.content_sender': 'Messages are only accepted from the iClicker course page.',
      'error.extension_sender': 'Only this extension’s settings page can perform this action.',
      'error.no_channels': 'Enable desktop notifications or sound before testing an alert.',
      'error.unknown_action': 'Unknown extension action.'
    }),
    'zh-CN': Object.freeze({
      'alert.class.title': 'iClicker 开始上课了',
      'alert.class.body': '课程已开始，点击返回 iClicker。',
      'alert.question.title': 'iClicker 有新问题',
      'alert.question.body': '老师已开放作答，请查看课程页面。',
      'alert.test.title': 'iClicker 测试提醒',
      'alert.test.body': '这是测试通知。请确认声音和桌面通知符合你的设置。',
      'alert.stopSound': '停止提醒',
      'channel.desktop': '桌面通知',
      'channel.sound': '声音',
      'error.unknown': '发生未知错误。',
      'error.notification_permission': 'Chrome 已禁用此扩展的桌面通知，请在 Chrome 和系统设置中允许通知。',
      'error.audio_no_response': '声音播放页面没有响应。',
      'error.audio_connection': '无法连接声音播放页面。',
      'error.audio_timeout': '音频启动超时，请在扩展中重新测试提醒。',
      'error.audio_blocked': 'Chrome 暂未允许播放音频，请在扩展中点击测试提醒。',
      'error.audio_sender': '声音播放请求来源无效。',
      'error.unsupported_event': '不支持的提醒类型。',
      'error.missing_event': '提醒缺少课程或事件标识。',
      'error.content_sender': '只接受来自 iClicker 课程页面的消息。',
      'error.extension_sender': '此操作只允许扩展自己的设置页面调用。',
      'error.no_channels': '请先开启桌面通知或声音，再测试提醒。',
      'error.unknown_action': '未知的扩展操作。'
    })
  });

  function resolveLanguage(value, browserLanguage) {
    if (value === 'en' || value === 'zh-CN') return value;
    let locale = browserLanguage;
    if (!locale) {
      try { locale = root.chrome?.i18n?.getUILanguage(); } catch { /* Use navigator below. */ }
      locale ||= root.navigator?.language || 'en';
    }
    return /^zh(?:[-_]|$)/i.test(locale) ? 'zh-CN' : 'en';
  }

  function t(language, key, params = {}) {
    const template = messages[resolveLanguage(language)][key] || messages.en[key] || key;
    return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
  }

  root.ICI18n = Object.freeze({ resolveLanguage, t });
  if (typeof module !== 'undefined') module.exports = root.ICI18n;
})(globalThis);
