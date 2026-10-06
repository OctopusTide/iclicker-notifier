'use strict';

let audioContext;
let audioQueue = Promise.resolve();

const TONES = Object.freeze({
  chime: [
    { frequency: 659.25, start: 0, duration: 0.32, type: 'sine' },
    { frequency: 880, start: 0.24, duration: 0.48, type: 'sine' }
  ],
  bell: [
    { frequency: 1046.5, start: 0, duration: 0.85, type: 'sine', level: 0.7 },
    { frequency: 1568, start: 0, duration: 0.65, type: 'sine', level: 0.25 },
    { frequency: 2093, start: 0, duration: 0.4, type: 'sine', level: 0.12 }
  ],
  pulse: [
    { frequency: 740, start: 0, duration: 0.18, type: 'triangle' },
    { frequency: 740, start: 0.27, duration: 0.18, type: 'triangle' },
    { frequency: 988, start: 0.54, duration: 0.25, type: 'triangle' }
  ]
});

function audioError(code, language) {
  const error = new Error(ICI18n.t(language, `error.${code}`));
  error.code = code;
  return error;
}

async function playTone(tone, requestedVolume, language) {
  const numericVolume = Number(requestedVolume);
  const volume = Number.isFinite(numericVolume) ? Math.min(1, Math.max(0, numericVolume)) : 0.65;
  if (volume === 0) return;
  if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContext();
  if (audioContext.state !== 'running') {
    let timer;
    try {
      await Promise.race([
        audioContext.resume(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(audioError('audio_timeout', language)), 4000);
        })
      ]);
    } finally { clearTimeout(timer); }
  }
  if (audioContext.state !== 'running') throw audioError('audio_blocked', language);
  const notes = TONES[tone] || TONES.chime;
  const start = audioContext.currentTime + 0.015;
  // Each sound is synthesized locally. No network fetches or audio tracking.
  await Promise.all(notes.map(note => new Promise((resolve, reject) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const when = start + note.start;
    const peak = Math.max(0.00001, volume * 0.35 * (note.level || 1));
    try {
      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, when);
      gain.gain.setValueAtTime(0.00001, when);
      gain.gain.exponentialRampToValueAtTime(peak, when + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.00001, when + note.duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); resolve(); };
      oscillator.start(when);
      oscillator.stop(when + note.duration + 0.02);
    } catch (error) {
      oscillator.disconnect();
      gain.disconnect();
      reject(error);
    }
  })));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'offscreen' || message.type !== 'PLAY') return false;
  if (sender.id !== chrome.runtime.id || sender.url && !sender.url.startsWith(chrome.runtime.getURL(''))) {
    sendResponse({ ok: false, error: ICI18n.t(message.language, 'error.audio_sender'), errorCode: 'audio_sender' });
    return false;
  }
  // Queue consecutive events so two questions do not produce overlapping tones.
  const result = audioQueue.then(() => playTone(message.tone, message.volume, message.language));
  audioQueue = result.catch(() => undefined);
  result.then(() => sendResponse({ ok: true }), error => sendResponse({
    ok: false, error: error.message || ICI18n.t(message.language, 'error.unknown'),
    ...(error.code ? { errorCode: error.code } : {})
  }));
  return true;
});
