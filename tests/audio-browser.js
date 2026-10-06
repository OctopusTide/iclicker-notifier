'use strict';

let audioListener;
window.chrome = { runtime: {
  id: 'audio-fixture',
  getURL: path => `chrome-extension://audio-fixture/${path}`,
  onMessage: { addListener(listener) { audioListener = listener; } }
} };
const sendAudio = (type, extra = {}) => new Promise(resolve => {
  audioListener({ target: 'offscreen', type, ...extra }, {
    id: 'audio-fixture', url: 'chrome-extension://audio-fixture/service-worker.js'
  }, resolve);
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = document.getElementById('results');
let cancelled = false;
document.getElementById('stop').addEventListener('click', async () => {
  cancelled = true;
  await sendAudio('STOP');
  results.textContent += '\nStopped by user.';
});
document.getElementById('run').addEventListener('click', async () => {
  const button = document.getElementById('run');
  button.disabled = true;
  cancelled = false;
  results.textContent = '';
  const check = (condition, description) => {
    if (cancelled) throw new Error('Checks cancelled.');
    if (!condition) throw new Error(description);
    results.textContent += `PASS: ${description}\n`;
  };
  try {
    let response = await sendAudio('PLAY', { mode: 'short', tone: 'chime', volume: 0.1, language: 'en' });
    check(response.ok && response.playing && response.mode === 'short', 'Short sound starts.');
    await pause(1100);
    response = await sendAudio('GET_AUDIO_STATUS');
    check(response.ok && !response.playing, 'Short sound ends by itself.');
    response = await sendAudio('PLAY', { mode: 'long', tone: 'pulse', volume: 0.1, language: 'en' });
    check(response.ok && response.playing && response.mode === 'long', 'Long sound starts without blocking the response.');
    await pause(2400);
    response = await sendAudio('GET_AUDIO_STATUS');
    check(response.playing && response.mode === 'long', 'Long sound remains active across repeated tones.');
    response = await sendAudio('STOP');
    check(response.ok && !response.playing, 'Stop acknowledges immediately.');
    await pause(1200);
    response = await sendAudio('GET_AUDIO_STATUS');
    check(!response.playing && response.mode === null, 'Stopped sound does not restart.');
    results.textContent += '\n6 checks passed. Real extension messaging and desktop delivery need a loaded extension.';
  } catch (error) {
    results.textContent += `\nFAIL: ${error.message}`;
  } finally {
    await sendAudio('STOP');
    button.disabled = false;
  }
});
