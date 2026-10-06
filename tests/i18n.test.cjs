'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { resolveLanguage, t } = require('../extension/i18n.js');
const { defaults, normalize } = require('../extension/settings.js');

test('locale resolution honors explicit language, recognizes Chinese variants, and defaults to English', () => {
  assert.equal(resolveLanguage('en', 'zh-TW'), 'en');
  assert.equal(resolveLanguage('zh-CN', 'en-US'), 'zh-CN');
  for (const locale of ['zh', 'zh-CN', 'zh-TW', 'zh_HK', 'ZH-hant']) {
    assert.equal(resolveLanguage('auto', locale), 'zh-CN');
  }
  for (const locale of ['en-US', 'fr-FR', 'ja', 'zhinvalid']) {
    assert.equal(resolveLanguage('auto', locale), 'en');
  }
});

test('legacy settings acquire auto language, while invalid languages do not persist', () => {
  assert.equal(defaults.language, 'auto');
  assert.equal(normalize({ sound: false }).language, 'auto');
  assert.equal(normalize({ language: 'fr' }).language, 'auto');
  for (const language of ['auto', 'en', 'zh-CN']) {
    assert.equal(normalize({ language }).language, language);
  }
});

test('translated alert text and known errors are available in both languages', () => {
  for (const kind of ['class', 'question', 'test']) {
    for (const part of ['title', 'body']) {
      const key = `alert.${kind}.${part}`;
      assert.notEqual(t('en', key), t('zh-CN', key));
      assert.notEqual(t('en', key), key);
    }
  }
  assert.match(t('en', 'error.audio_timeout'), /Audio startup timed out/);
  assert.match(t('zh-CN', 'error.audio_timeout'), /音频启动超时/);
  assert.equal(t('en', 'nonexistent'), 'nonexistent');
});

test('manifest locale catalogs resolve all placeholders and declare a valid fallback', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../extension/manifest.json'), 'utf8'));
  assert.equal(manifest.default_locale, 'en');
  assert.equal(manifest.version, '1.1.0');
  const placeholders = JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g);
  const keys = [...placeholders].map(match => match[1]);
  for (const locale of ['en', 'zh_CN']) {
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../extension/_locales', locale, 'messages.json'), 'utf8'));
    for (const key of keys) assert.ok(catalog[key]?.message);
    assert.ok(catalog.extensionDescription.message.length <= 132);
  }
});

function offscreenHarness() {
  let listener;
  class BlockedAudioContext {
    state = 'suspended';
    async resume() {}
  }
  const context = vm.createContext({
    chrome: { runtime: {
      id: 'unit-test', getURL: value => `chrome-extension://unit-test/${value}`,
      onMessage: { addListener(fn) { listener = fn; } }
    } },
    AudioContext: BlockedAudioContext,
    setTimeout, clearTimeout
  });
  for (const file of ['i18n.js', 'offscreen.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../extension', file), 'utf8'), context, { filename: file });
  }
  return (language, sender = { id: 'unit-test' }) => new Promise(resolve => {
    listener({ target: 'offscreen', type: 'PLAY', language, volume: 0.65 }, sender, resolve);
  });
}

test('offscreen audio errors carry translatable codes and honor message language', async () => {
  const send = offscreenHarness();
  const english = await send('en');
  const chinese = await send('zh-CN');
  assert.equal(english.errorCode, 'audio_blocked');
  assert.match(english.error, /Chrome has not allowed/);
  assert.equal(chinese.errorCode, 'audio_blocked');
  assert.match(chinese.error, /Chrome 暂未允许/);
  const invalid = await send('en', { id: 'foreign-extension' });
  assert.equal(invalid.errorCode, 'audio_sender');
  assert.match(invalid.error, /invalid source/);
});
