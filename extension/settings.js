(function (root) {
  'use strict';
  const defaults = Object.freeze({
    enabled: true, desktop: true, sound: true, volume: 0.65,
    tone: 'chime', reminderMode: 'short', classStarted: true, questionOpened: true, language: 'auto'
  });
  function normalize(value) {
    const input = value && typeof value === 'object' ? value : {};
    const output = { ...defaults };
    for (const key of ['enabled', 'desktop', 'sound', 'classStarted', 'questionOpened']) {
      if (typeof input[key] === 'boolean') output[key] = input[key];
    }
    if (typeof input.volume === 'number' && Number.isFinite(input.volume)) {
      output.volume = Math.min(1, Math.max(0, input.volume));
    }
    if (['chime', 'bell', 'pulse'].includes(input.tone)) output.tone = input.tone;
    if (['short', 'long'].includes(input.reminderMode)) output.reminderMode = input.reminderMode;
    if (['auto', 'en', 'zh-CN'].includes(input.language)) output.language = input.language;
    return output;
  }
  root.ICSettings = { defaults, normalize };
  if (typeof module !== 'undefined') module.exports = root.ICSettings;
})(globalThis);
