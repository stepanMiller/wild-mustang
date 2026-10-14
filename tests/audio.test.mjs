import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_ASSETS, createAdventureAudio } from '../src/audio.js';

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function harness({ fetchOverride, sampleLength = 200000, mediaRejects = false, decodeRejects = false, mediaPending } = {}) {
  const sources = [], requests = [], contexts = [], media = [];
  class Param {
    value = 1;
    cancelScheduledValues() {}
    setValueAtTime(value) { this.value = value; }
    linearRampToValueAtTime(value) { this.value = value; }
  }
  class Node {
    gain = new Param(); playbackRate = new Param(); frequency = new Param();
    connect() {} disconnect() {}
  }
  class Context {
    state = 'suspended'; currentTime = 1; destination = {}; sampleRate = 48000;
    constructor() { contexts.push(this); }
    createGain() { return new Node(); }
    createMediaElementSource() { return new Node(); }
    createOscillator() { return this.createBufferSource(); }
    createBufferSource() {
      const source = Object.assign(new Node(), {
        started: false, stopped: false,
        start() { this.started = true; },
        stop() { this.stopped = true; },
        end() { this.onended?.(); }
      });
      sources.push(source); return source;
    }
    decodeAudioData(bytes, success, failure) {
      if (decodeRejects) {
        const error = new Error('unsupported codec');
        queueMicrotask(() => failure(error));
        return Promise.reject(error);
      }
      const buffer = { length: sampleLength, numberOfChannels: 1, duration: sampleLength / 48000 };
      queueMicrotask(() => success(buffer));
      return Promise.resolve(buffer);
    }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
  }
  const createMedia = () => {
    const element = {
      paused: true, calls: 0,
      addEventListener() {}, removeAttribute() {}, load() {},
      play() {
        this.calls++;
        if (mediaRejects) return Promise.reject(new Error('blocked by autoplay'));
        if (mediaPending && this.calls === 1) return mediaPending.promise;
        this.paused = false; return Promise.resolve();
      },
      pause() { this.paused = true; }
    };
    media.push(element); return element;
  };
  const fetchAudio = async path => {
    requests.push(path);
    if (fetchOverride) return fetchOverride(path);
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(12) };
  };
  const audio = createAdventureAudio({ baseURL: '/wild-mustang/', AudioContextClass: Context, createMedia, fetchAudio });
  return { audio, sources, requests, contexts, media };
}

test('one context unlocks local streams in the same call and resumes after pause', async () => {
  const h = harness();
  const first = h.audio.unlock();
  assert.equal(h.contexts.length, 1);
  assert.equal(h.media.length, 5);
  assert.ok(h.media.every(media => media.calls === 1), 'warm-up happens before awaiting a promise');
  assert.equal(await first, true);
  await settle();
  assert.equal(h.audio.status().streams.wind.playing, true);
  assert.equal(h.audio.status().streams.creek.playing, false);
  h.audio.setEnvironment({ chapter: 2, creek: 1, movement: .5 });
  await settle();
  assert.equal(h.audio.status().streams.forest.playing, true);
  assert.equal(h.audio.status().streams.creek.playing, true);
  h.audio.pause();
  assert.ok(h.media.every(media => media.paused));
  assert.equal(h.audio.status().context, 'suspended');
  assert.equal(await h.audio.resume(), true);
  await settle();
  assert.equal(h.contexts.length, 1);
  assert.equal(h.audio.status().streams.forest.playing, true);
  assert.ok(h.requests.every(path => path.startsWith('/wild-mustang/assets/audio/')));
});

test('a replaced loading cue cannot start late; current cue ducks background until it ends', async () => {
  const slow = deferred();
  const h = harness({ fetchOverride: path => path.includes('tutorial-move')
    ? slow.promise : { ok: true, arrayBuffer: async () => new ArrayBuffer(12) } });
  await h.audio.unlock(); await settle();
  const old = h.audio.playCue('tutorial-move');
  await settle();
  const current = h.audio.playCue('storm-tracks');
  assert.equal(await current, true);
  slow.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(12) });
  assert.equal(await old, false);
  assert.equal(h.audio.status().cue, 'storm-tracks');
  assert.equal(h.audio.status().cueStarts, 1);
  assert.equal(h.audio.status().musicDucked, true);
  h.sources.at(-1).end();
  assert.equal(h.audio.status().cue, null);
  assert.equal(h.audio.status().musicDucked, false);
});

test('pause and voice mute invalidate pending narration rather than replaying it on resume', async () => {
  const slow = deferred();
  const h = harness({ fetchOverride: path => path.includes('tutorial-move')
    ? slow.promise : { ok: true, arrayBuffer: async () => new ArrayBuffer(12) } });
  await h.audio.unlock();
  const old = h.audio.playCue('tutorial-move');
  await settle();
  h.audio.pause();
  await h.audio.resume();
  slow.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(12) });
  assert.equal(await old, false);
  assert.equal(h.audio.status().cueStarts, 0);
  assert.equal(await h.audio.playCue('storm-tracks'), true);
  const active = h.sources.at(-1);
  h.audio.setSettings({ voice: false });
  assert.equal(active.stopped, true);
  assert.equal(h.audio.status().cue, null);
  assert.equal(await h.audio.playCue('storm-ford'), false);
  h.audio.setSettings({ voice: true });
  assert.equal(await h.audio.playCue('storm-ford'), true);
});

test('narration keeps at most three buffers and reuses recently decoded cues', async () => {
  const h = harness();
  await h.audio.unlock(); await settle();
  for (const id of ['storm-tracks', 'storm-ford', 'storm-apples', 'storm-foal']) {
    assert.equal(await h.audio.playCue(id), true);
  }
  assert.equal(h.audio.status().voiceCacheEntries, 3);
  assert.equal(h.audio.status().voiceCacheBytes, 2400000);
  assert.ok(h.audio.status().voiceCacheBytes <= 3 * 1024 * 1024);
  const calls = h.requests.length, count = h.audio.status().decodeCount;
  assert.equal(await h.audio.playCue('storm-ford'), true);
  assert.equal(h.requests.length, calls);
  assert.equal(h.audio.status().decodeCount, count);
  assert.equal(await h.audio.playCue('storm-tracks'), true);
  assert.equal(h.requests.length, calls + 1, 'the oldest of four cues is loaded again');
});

test('changing ground selects different hoof clips and mute stops further effects', async () => {
  const h = harness();
  await h.audio.unlock(); await settle();
  for (const [surface, asset] of [
    ['ground', 'horse-surface-ground'], ['grass', 'horse-surface-grass'],
    ['sand', 'horse-surface-muffled'], ['hard', 'horse-surface-hall']
  ]) {
    assert.equal(await h.audio.playStep(surface, 9), true);
    assert.equal(h.audio.status().lastEffect, asset);
  }
  h.audio.setSettings({ sfx: 0, music: 0 });
  await settle();
  assert.equal(await h.audio.playStep('ground'), false);
  assert.ok(Object.values(h.audio.status().streams).every(stream => !stream.playing));
  h.audio.setSettings({ sfx: .75, music: .55 });
  await settle();
  assert.equal(h.audio.status().streams.wind.playing, true);
});

test('missing/invalid clips and blocked streaming never throw or block gameplay', async () => {
  const h = harness({ mediaRejects: true, fetchOverride: async () => { throw new Error('offline'); } });
  assert.equal(await h.audio.unlock(), true);
  await settle();
  assert.equal(await h.audio.playCue('storm-tracks'), false);
  assert.equal(await h.audio.playStep('hard'), false);
  assert.equal(await h.audio.playCue('nonexistent'), false);
  assert.equal(h.audio.status().cueStarts, 0);
  assert.ok(h.audio.status().unavailable.includes('storm-tracks'));
  h.audio.pause();
  assert.equal(await h.audio.resume(), true);
  h.audio.dispose();
  assert.equal(h.audio.status().context, 'closed');
  assert.equal(await h.audio.unlock(), false);
});

test('autoplay rejection is retried only after a fresh user gesture', async () => {
  const h = harness({ mediaRejects: true });
  await h.audio.unlock(); await settle();
  const calls = h.media.reduce((sum, item) => sum + item.calls, 0);
  for (let i = 0; i < 12; i++) {
    h.audio.setEnvironment({ creek: .5, movement: i / 12 });
    await settle();
  }
  assert.equal(h.media.reduce((sum, item) => sum + item.calls, 0), calls);
  await h.audio.resume(); await settle();
  assert.equal(h.media.reduce((sum, item) => sum + item.calls, 0), calls + 5);
});

test('missing footfall is not fetched on every step and retries after explicit resume', async () => {
  const h = harness({ fetchOverride: async () => { throw new Error('offline'); } });
  await h.audio.unlock(); await settle();
  const calls = h.requests.filter(path => path.includes('horse-surface-ground')).length;
  for (let i = 0; i < 5; i++) assert.equal(await h.audio.playStep('ground'), false);
  assert.equal(h.requests.filter(path => path.includes('horse-surface-ground')).length, calls);
  h.audio.pause(); await h.audio.resume(); await settle();
  assert.equal(h.requests.filter(path => path.includes('horse-surface-ground')).length, calls + 1);
});

test('expected play cancellation during quick pause/resume does not disable a stream', async () => {
  const pending = deferred();
  const h = harness({ mediaPending: pending });
  await h.audio.unlock();
  h.audio.pause(); await h.audio.resume();
  const cancellation = new Error('play interrupted by pause'); cancellation.name = 'AbortError';
  pending.reject(cancellation);
  await settle();
  h.audio.setEnvironment({ movement: .1 });
  await settle();
  assert.equal(h.audio.status().streams.wind.playing, true);
  assert.equal(h.audio.status().streams.music.playing, true);
  assert.equal(h.audio.status().unavailable.includes('wind'), false);
});

test('unsupported audio data is recoverable in both Promise and callback decoder APIs', async () => {
  const h = harness({ decodeRejects: true });
  assert.equal(await h.audio.unlock(), true);
  assert.equal(await h.audio.playCue('storm-tracks'), false);
  assert.equal(await h.audio.playStep('ground'), false);
  assert.equal(h.audio.status().decodeCount, 0);
  assert.equal(h.audio.status().cueStarts, 0);
  assert.ok(h.audio.status().unavailable.includes('storm-tracks'));
  assert.ok(h.audio.status().unavailable.includes('horse-surface-ground'));
});

test('reset cancels both pending hoof events and an active cue', async () => {
  const slow = deferred();
  const h = harness({ fetchOverride: path => path.includes('horse-surface-ground')
    ? slow.promise : { ok: true, arrayBuffer: async () => new ArrayBuffer(12) } });
  await h.audio.unlock();
  assert.equal(await h.audio.playCue('storm-tracks'), true);
  const hoof = h.audio.playStep('ground');
  h.audio.reset();
  slow.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(12) });
  assert.equal(await hoof, false);
  assert.equal(h.audio.status().effectStarts, 0);
  assert.equal(h.audio.status().cue, null);
  assert.equal(h.audio.status().pendingCue, null);
});

test('no audio device and an absent AudioContext leave every operation safe', async () => {
  const audio = createAdventureAudio({ AudioContextClass: null });
  assert.equal(await audio.unlock(), false);
  assert.equal(await audio.playCue('storm-tracks'), false);
  assert.equal(await audio.playStep(), false);
  audio.pause(); audio.reset(); audio.setSettings({ voice: false }); audio.dispose();
  assert.equal(audio.status().ready, false);
  assert.equal(Object.keys(AUDIO_ASSETS.voice).length, 23);
});

test('original UI chimes share the effect mute and cancel scheduled notes on pause', async () => {
  const h = harness();
  assert.equal(h.audio.playChime('quest'), false);
  await h.audio.unlock();
  assert.equal(h.audio.playChime('quest'), true);
  const notes = h.sources.slice(-3);
  assert.deepEqual(notes.map(note => note.frequency.value), [523, 659, 784]);
  assert.equal(h.audio.status().lastEffect, 'chime-quest');
  h.audio.pause();
  assert.ok(notes.every(note => note.stopped));
  assert.equal(h.audio.status().activeEffects, 0);
  await h.audio.resume();
  h.audio.setSettings({ sfx: 0 });
  assert.equal(h.audio.playChime('trust'), false);
});

test('licensed horse call plays through the bounded effects cache and obeys mute', async () => {
  const h = harness({ sampleLength: 48000 });
  await h.audio.unlock(); await settle();
  assert.equal(AUDIO_ASSETS.effects['horse-call'], 'assets/audio/sfx/horse-call.wav');
  const before = h.audio.status().effectStarts;
  assert.equal(await h.audio.playEffect('horse-call'), true);
  assert.equal(h.audio.status().lastEffect, 'horse-call');
  assert.equal(h.audio.status().effectStarts, before + 1);
  assert.ok(h.audio.status().effectCacheBytes <= 1024 * 1024);
  assert.ok(h.audio.status().effectCacheEntries <= 7);
  assert.ok(h.requests.includes('/wild-mustang/assets/audio/sfx/horse-call.wav'));
  h.audio.setSettings({ sfx: 0 });
  assert.equal(await h.audio.playEffect('horse-call'), false);
});
