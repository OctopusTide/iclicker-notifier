'use strict';

let audioContext;
let activePlayback;

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

function audioStatus() {
  return { ok: true, playing: Boolean(activePlayback), mode: activePlayback?.mode || null };
}

function disconnectNode(node) {
  node.oscillator.onended = null;
  try { node.oscillator.stop(); } catch (_) { /* Already ended or not started. */ }
  try { node.oscillator.disconnect(); } catch (_) { /* Already disconnected. */ }
  try { node.gain?.disconnect(); } catch (_) { /* Already disconnected. */ }
}

function stopPlayback() {
  const playback = activePlayback;
  activePlayback = undefined;
  if (!playback) return;
  playback.cancelStart();
  for (const node of playback.nodes) disconnectNode(node);
  playback.nodes.clear();
}

function scheduleTone(playback, gap = 0.015) {
  const start = audioContext.currentTime + gap;
  // Each sound is synthesized locally. No network fetches or audio tracking.
  for (const note of TONES[playback.tone] || TONES.chime) {
    const node = { oscillator: audioContext.createOscillator() };
    playback.nodes.add(node);
    node.gain = audioContext.createGain();
    const { oscillator, gain } = node;
    const when = start + note.start;
    const peak = Math.max(0.00001, playback.volume * 0.35 * (note.level || 1));
    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.frequency, when);
    gain.gain.setValueAtTime(0.00001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.00001, when + note.duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.onended = () => {
      oscillator.onended = null;
      oscillator.disconnect();
      gain.disconnect();
      playback.nodes.delete(node);
      if (activePlayback !== playback || playback.nodes.size !== 0) return;
      if (playback.mode === 'short') {
        activePlayback = undefined;
        return;
      }
      // The audio clock drives repetition; closing the popup does not stop it.
      try { scheduleTone(playback, 0.3); }
      catch (_) { if (activePlayback === playback) stopPlayback(); }
    };
    oscillator.start(when);
    oscillator.stop(when + note.duration + 0.02);
  }
}

async function playTone(tone, requestedVolume, language, mode) {
  stopPlayback();
  const numericVolume = Number(requestedVolume);
  const volume = Number.isFinite(numericVolume) ? Math.min(1, Math.max(0, numericVolume)) : 0.65;
  if (volume === 0) return audioStatus();
  let cancelStart;
  const cancelled = new Promise(resolve => { cancelStart = () => resolve(false); });
  const playback = { tone, volume, mode: mode === 'long' ? 'long' : 'short', nodes: new Set(), cancelStart };
  activePlayback = playback;
  try {
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContext();
    if (audioContext.state !== 'running') {
      let timer;
      try {
        await Promise.race([
          audioContext.resume(), cancelled,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(audioError('audio_timeout', language)), 4000);
          })
        ]);
      } finally { clearTimeout(timer); }
    }
    // STOP or a newer PLAY may arrive while Chrome is resuming its audio context.
    if (activePlayback !== playback) return audioStatus();
    if (audioContext.state !== 'running') throw audioError('audio_blocked', language);
    scheduleTone(playback);
    return audioStatus();
  } catch (error) {
    if (activePlayback !== playback) return audioStatus();
    stopPlayback();
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'offscreen' || !['PLAY', 'STOP', 'GET_AUDIO_STATUS'].includes(message.type)) return false;
  if (sender.id !== chrome.runtime.id || sender.url && !sender.url.startsWith(chrome.runtime.getURL(''))) {
    sendResponse({ ok: false, error: ICI18n.t(message.language, 'error.audio_sender'), errorCode: 'audio_sender' });
    return false;
  }
  if (message.type !== 'PLAY') {
    if (message.type === 'STOP') stopPlayback();
    sendResponse(audioStatus());
    return false;
  }
  // A long reminder acknowledges startup, so later STOP messages stay responsive.
  playTone(message.tone, message.volume, message.language, message.mode).then(sendResponse, error => sendResponse({
    ok: false, error: error.message || ICI18n.t(message.language, 'error.unknown'),
    ...(error.code ? { errorCode: error.code } : {})
  }));
  return true;
});
