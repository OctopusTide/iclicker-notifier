'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function audioHarness(options = {}) {
  let listener;
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const nodes = [];
  const resumes = [];
  const sender = { id: 'audio-test', url: 'chrome-extension://audio-test/service-worker.js' };
  const setTimer = (fn, delay) => {
    const id = ++nextTimer;
    timers.set(id, { at: now + Math.max(0, delay), fn });
    return id;
  };
  const clearTimer = id => timers.delete(id);
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const audioParam = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class FakeAudioContext {
    state = options.suspended ? 'suspended' : 'running';
    destination = {};
    get currentTime() { return now / 1000; }
    resume() { return new Promise(resolve => resumes.push(() => { this.state = 'running'; resolve(); })); }
    createOscillator() {
      if (options.failOscillatorAt === nodes.length + 1) throw new Error('Cannot create oscillator');
      let endTimer;
      const node = {
        frequency: audioParam(), disconnects: 0, started: false, ended: false,
        connect() {},
        disconnect() { this.disconnects++; },
        start(at) { this.started = true; this.startAt = at; },
        stop(at = now / 1000) {
          clearTimer(endTimer);
          this.stopAt = at;
          if (this.ended) return;
          endTimer = setTimer(() => { this.ended = true; this.onended?.(); }, (at * 1000) - now);
        }
      };
      nodes.push(node);
      return node;
    }
    createGain() { return { gain: audioParam(), connect() {}, disconnect() {} }; }
  }
  const context = vm.createContext({
    chrome: { runtime: {
      id: sender.id, getURL: value => `chrome-extension://${sender.id}/${value}`,
      onMessage: { addListener(fn) { listener = fn; } }
    } },
    AudioContext: FakeAudioContext,
    setTimeout: setTimer, clearTimeout: clearTimer
  });
  for (const file of ['i18n.js', 'offscreen.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../extension', file), 'utf8'), context, { filename: file });
  }
  const send = (type, extra = {}, source = sender) => new Promise(resolve => {
    listener({ target: 'offscreen', type, tone: 'chime', volume: 0.65, language: 'en', ...extra }, source,
      result => resolve(JSON.parse(JSON.stringify(result))));
  });
  const advance = async milliseconds => {
    const end = now + milliseconds;
    for (let count = 0; count < 10000; count++) {
      await flush();
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= end)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) { now = end; await flush(); return; }
      now = next[1].at;
      timers.delete(next[0]);
      next[1].fn();
    }
    throw new Error('Audio scheduled an unbounded timer loop');
  };
  return { send, advance, flush, nodes, resumes };
}

test('short reminder acknowledges startup, plays one tone, and becomes idle', async () => {
  const audio = audioHarness();
  assert.deepEqual(await audio.send('PLAY', { mode: 'short' }), { ok: true, playing: true, mode: 'short' });
  assert.equal(audio.nodes.length, 2);
  assert.ok(audio.nodes.every(node => node.started && !node.ended));
  await audio.advance(10000);
  assert.equal(audio.nodes.length, 2);
  assert.deepEqual(await audio.send('GET_AUDIO_STATUS'), { ok: true, playing: false, mode: null });
  assert.ok(audio.nodes.every(node => node.disconnects === 1));
});

test('long reminder keeps repeating until STOP, with no overlap or later restart', async () => {
  const audio = audioHarness();
  assert.equal((await audio.send('PLAY', { mode: 'long' })).mode, 'long');
  await audio.advance(5500);
  assert.ok(audio.nodes.length >= 10, 'the same reminder repeats without additional PLAY messages');
  assert.ok(audio.nodes.filter(node => !node.ended).length <= 2);
  assert.equal((await audio.send('GET_AUDIO_STATUS')).playing, true);
  const count = audio.nodes.length;
  assert.deepEqual(await audio.send('STOP'), { ok: true, playing: false, mode: null });
  assert.ok(audio.nodes.every(node => node.disconnects === 1));
  await audio.advance(60000);
  assert.equal(audio.nodes.length, count);
  assert.equal((await audio.send('GET_AUDIO_STATUS')).playing, false);
});

test('a new PLAY replaces a looping tone instead of queuing or overlapping it', async () => {
  const audio = audioHarness();
  await audio.send('PLAY', { mode: 'long' });
  const old = audio.nodes.slice();
  await audio.send('PLAY', { mode: 'short', tone: 'pulse' });
  assert.ok(old.every(node => node.disconnects === 1 && node.stopAt === 0));
  assert.equal(audio.nodes.filter(node => !node.disconnects).length, 3);
  await audio.advance(20000);
  assert.equal(audio.nodes.length, 5);
  assert.equal((await audio.send('GET_AUDIO_STATUS')).playing, false);
});

test('STOP cancels a pending audio resume promptly and its late completion cannot restart sound', async () => {
  const audio = audioHarness({ suspended: true });
  const pending = audio.send('PLAY', { mode: 'long' });
  await audio.flush();
  assert.equal((await audio.send('GET_AUDIO_STATUS')).playing, true);
  assert.equal((await audio.send('STOP')).playing, false);
  assert.deepEqual(await pending, { ok: true, playing: false, mode: null });
  audio.resumes[0]();
  await audio.advance(10000);
  assert.equal(audio.nodes.length, 0);
});

test('a superseded pending PLAY never schedules nodes after its resume completes', async () => {
  const audio = audioHarness({ suspended: true });
  const first = audio.send('PLAY', { mode: 'long', tone: 'chime' });
  const second = audio.send('PLAY', { mode: 'long', tone: 'pulse' });
  await audio.flush();
  await first;
  audio.resumes[0]();
  await audio.flush();
  assert.equal(audio.nodes.length, 0);
  audio.resumes[1]();
  assert.equal((await second).playing, true);
  assert.equal(audio.nodes.length, 3);
  await audio.send('STOP');
  await audio.advance(10000);
  assert.equal(audio.nodes.length, 3);
});

test('audio startup times out with a localized error and no lingering reminder', async () => {
  const audio = audioHarness({ suspended: true });
  const pending = audio.send('PLAY', { mode: 'long', language: 'zh-CN' });
  await audio.advance(4000);
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'audio_timeout');
  assert.match(result.error, /音频启动超时/);
  assert.equal((await audio.send('GET_AUDIO_STATUS')).playing, false);
  audio.resumes[0]();
  await audio.advance(10000);
  assert.equal(audio.nodes.length, 0);
});

test('zero volume stops an existing loop and an invalid mode falls back to a short reminder', async () => {
  const audio = audioHarness();
  await audio.send('PLAY', { mode: 'long' });
  assert.equal((await audio.send('PLAY', { mode: 'long', volume: 0 })).playing, false);
  await audio.advance(10000);
  assert.equal(audio.nodes.length, 2);
  assert.equal((await audio.send('PLAY', { mode: 'invalid' })).mode, 'short');
  await audio.advance(10000);
  assert.equal(audio.nodes.length, 4);
  assert.equal((await audio.send('GET_AUDIO_STATUS')).playing, false);
});

test('all audio commands reject untrusted senders without changing playback', async () => {
  const audio = audioHarness();
  await audio.send('PLAY', { mode: 'long' });
  for (const source of [{ id: 'other-extension' }, { id: 'audio-test', url: 'https://student.iclicker.com/' }]) {
    for (const type of ['PLAY', 'STOP', 'GET_AUDIO_STATUS']) {
      const result = await audio.send(type, {}, source);
      assert.equal(result.ok, false);
      assert.equal(result.errorCode, 'audio_sender');
    }
  }
  assert.equal((await audio.send('GET_AUDIO_STATUS')).playing, true);
  await audio.send('STOP');
});

test('a partially scheduled tone is cleaned up if audio node creation fails', async () => {
  const audio = audioHarness({ failOscillatorAt: 2 });
  const result = await audio.send('PLAY', { mode: 'long' });
  assert.equal(result.ok, false);
  assert.match(result.error, /Cannot create oscillator/);
  assert.equal((await audio.send('GET_AUDIO_STATUS')).playing, false);
  assert.equal(audio.nodes[0].disconnects, 1);
  await audio.advance(10000);
  assert.equal(audio.nodes.length, 1);
});
