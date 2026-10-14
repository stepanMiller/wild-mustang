/** Local recorded audio. No remote service, runtime speech synthesis or timers. */
export const VOICE_CUES = Object.freeze([
  'tutorial-move', 'tutorial-look', 'tutorial-gallop', 'tutorial-jump', 'tutorial-alex',
  'storm-tracks', 'storm-ford', 'storm-apples', 'storm-foal', 'storm-hill', 'storm-lookout',
  'willow-tracks', 'willow-meadow', 'willow-ford', 'willow-crossing', 'willow-rest', 'willow-clue',
  'mountain-call', 'mountain-tracks', 'mountain-foal', 'mountain-crest', 'mountain-family', 'mountain-home'
]);

export const AUDIO_ASSETS = Object.freeze({
  voice: Object.freeze(Object.fromEntries(VOICE_CUES.map(id => [id, `assets/audio/voice/${id}.mp3`]))),
  effects: Object.freeze({
    'horse-surface-ground': 'assets/audio/sfx/horse-surface-ground.wav',
    'horse-surface-muffled': 'assets/audio/sfx/horse-surface-muffled.wav',
    'horse-surface-grass': 'assets/audio/sfx/horse-surface-grass.wav',
    'horse-surface-hall': 'assets/audio/sfx/horse-surface-hall.wav',
    'horse-call': 'assets/audio/sfx/horse-call.wav',
    'foliage': 'assets/audio/sfx/foliage.wav',
    'branch-creak': 'assets/audio/sfx/branch-creak.wav'
  }),
  streams: Object.freeze({
    wind: 'assets/audio/sfx/wind.mp3',
    forest: 'assets/audio/sfx/forest.mp3',
    bird: 'assets/audio/sfx/bird.mp3',
    creek: 'assets/audio/sfx/creek.mp3',
    music: 'assets/audio/sfx/music-option.mp3'
  })
});

const bounded = (value, fallback) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
const bufferBytes = buffer => buffer.length * buffer.numberOfChannels * 4;

/** Dependencies are injectable for deterministic race / unavailable-audio tests. */
export function createAdventureAudio({
  baseURL = './',
  settings = {},
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  createMedia = () => new globalThis.Audio(),
  fetchAudio = (url, options) => globalThis.fetch(url, options),
  voiceCacheBytes = 3 * 1024 * 1024,
  effectCacheBytes = 1024 * 1024
} = {}) {
  const levels = { music: .55, sfx: .75, voice: true, ...settings };
  const environment = { chapter: 1, creek: 0, movement: 0 };
  const voiceCache = new Map();
  const effectsCache = new Map();
  const effectRequests = new Map();
  const effectTickets = new Map();
  const streams = new Map();
  const activeEffects = new Set();
  const failures = new Set();
  let ctx = null, master = null, musicGain = null, ambienceGain = null, effectsGain = null, voiceGain = null;
  let ready = false, paused = true, disposed = false, epoch = 0, cueToken = 0;
  let voice = null, voiceId = null, voicePending = null, voiceQueue = Promise.resolve(), cueController = null;
  let cueStarts = 0, effectStarts = 0, streamStarts = 0, lastEffect = null;
  let decodeCount = 0, voiceBytes = 0, effectsBytes = 0;

  const url = path => `${baseURL.endsWith('/') ? baseURL : `${baseURL}/`}${path}`;
  const unavailable = id => { failures.add(id); return null; };
  const audible = () => ready && !paused && !disposed && ctx?.state === 'running';

  function fade(param, value, seconds = .18) {
    if (!param || !ctx) return;
    try {
      const time = ctx.currentTime;
      // Safari's cancelAndHoldAtTime is not available in every supported version.
      param.cancelScheduledValues(time);
      param.setValueAtTime(param.value, time);
      param.linearRampToValueAtTime(value, time + seconds);
    } catch { param.value = value; }
  }

  function mix() {
    const duck = voice ? .28 : 1;
    fade(musicGain?.gain, bounded(levels.music, .55) * .42 * duck, voice ? .08 : .35);
    fade(ambienceGain?.gain, bounded(levels.sfx, .75) * duck, voice ? .08 : .35);
    fade(effectsGain?.gain, bounded(levels.sfx, .75));
    fade(voiceGain?.gain, levels.voice === false ? 0 : .88);
  }

  function stopSource(source) {
    if (!source) return;
    source.onended = null;
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
    try { source.adventureGain?.disconnect(); } catch {}
  }

  function stopVoice() {
    stopSource(voice);
    voice = null;
    voiceId = null;
    mix();
  }

  function cancelCue() {
    ++cueToken;
    cueController?.abort();
    cueController = null;
    voicePending = null;
    stopVoice();
  }

  function streamLevel(id) {
    if (id === 'music') return bounded(levels.music, .55) > 0 ? 1 : 0;
    if (bounded(levels.sfx, .75) === 0) return 0;
    if (id === 'wind') return (environment.chapter === 2 ? .11 : .2) + environment.movement * .05;
    if (id === 'forest') return environment.chapter === 2 ? .22 : 0;
    if (id === 'bird') return environment.chapter === 2 ? .07 : .11;
    if (id === 'creek') return environment.creek * .32;
    return 0;
  }

  // All calls are caught, including autoplay rejection and play/pause races.
  // The muted warm-up is invoked synchronously from unlock's user gesture.
  function startStream(id, stream, warmup = false) {
    if (stream.pending || (!warmup && (stream.failed || paused || !streamLevel(id)))) return;
    if (warmup) stream.failed = false;
    stream.pending = true;
    const ticket = epoch;
    let result;
    try { result = stream.element.play(); }
    catch { stream.pending = false; stream.failed = true; unavailable(id); return; }
    Promise.resolve(result).then(() => {
      stream.pending = false;
      ++streamStarts;
      if (disposed || paused || ticket !== epoch || !streamLevel(id)) stream.element.pause();
    }).catch(error => {
      stream.pending = false;
      // pause/reset can reject an earlier pending play with AbortError. That
      // expected cancellation must not disable a newly resumed stream.
      if (disposed || paused || ticket !== epoch || error?.name === 'AbortError') return;
      stream.failed = true; unavailable(id);
    });
  }

  function updateStreams() {
    if (!ready) return;
    for (const [id, stream] of streams) {
      const value = streamLevel(id);
      fade(stream.gain.gain, value);
      if (paused || value === 0) stream.element.pause();
      else if (stream.element.paused) startStream(id, stream);
    }
  }

  function init() {
    if (disposed) return false;
    if (ready) return true;
    if (!AudioContextClass) return Boolean(unavailable('audio-context'));
    try {
      ctx = new AudioContextClass();
      master = ctx.createGain(); master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.connect(master);
      ambienceGain = ctx.createGain(); ambienceGain.connect(master);
      effectsGain = ctx.createGain(); effectsGain.connect(master);
      voiceGain = ctx.createGain(); voiceGain.connect(master);
      for (const [id, path] of Object.entries(AUDIO_ASSETS.streams)) {
        try {
          const element = createMedia();
          element.preload = 'none';
          element.loop = true;
          element.playsInline = true;
          element.src = url(path);
          element.addEventListener('error', () => {
            const stream = streams.get(id);
            if (stream) stream.failed = true;
            unavailable(id);
          });
          const source = ctx.createMediaElementSource(element);
          const gain = ctx.createGain(); gain.gain.value = 0;
          source.connect(gain);
          gain.connect(id === 'music' ? musicGain : ambienceGain);
          streams.set(id, { element, source, gain, pending: false, failed: false });
        } catch { unavailable(id); }
      }
      ready = true;
      mix();
      return true;
    } catch {
      unavailable('audio-context');
      if (ctx) { try { Promise.resolve(ctx.close()).catch(() => {}); } catch {} }
      ctx = null;
      return false;
    }
  }

  function decode(bytes) {
    return new Promise((resolve, reject) => {
      try {
        // Callbacks support old Safari; catch the optional returned Promise too.
        const result = ctx.decodeAudioData(bytes, resolve, reject);
        if (result?.then) result.then(resolve, reject);
      } catch (error) { reject(error); }
    });
  }

  async function fetchBytes(path, id, signal) {
    try {
      const response = await fetchAudio(url(path), { credentials: 'same-origin', ...(signal ? { signal } : {}) });
      if (!response.ok) return unavailable(id);
      return await response.arrayBuffer();
    } catch { return signal?.aborted ? null : unavailable(id); }
  }

  function cached(map, id) {
    const entry = map.get(id);
    if (!entry) return null;
    map.delete(id); map.set(id, entry);
    return entry.buffer;
  }

  function remember(map, id, buffer, limit, voiceBuffer = false) {
    const bytes = bufferBytes(buffer);
    // An unusually large clip can play but cannot evict every cached cue.
    if (bytes > limit) return;
    if (map.has(id)) map.delete(id);
    map.set(id, { buffer, bytes });
    let size = [...map.values()].reduce((sum, item) => sum + item.bytes, 0);
    const maxEntries = voiceBuffer ? 3 : Object.keys(AUDIO_ASSETS.effects).length;
    while (map.size > maxEntries || size > limit) {
      const oldest = map.keys().next().value;
      size -= map.get(oldest).bytes;
      map.delete(oldest);
    }
    if (voiceBuffer) voiceBytes = size; else effectsBytes = size;
  }

  async function loadEffect(id) {
    const hit = cached(effectsCache, id);
    if (hit) return hit;
    // A missing effect stays silent until the next explicit unlock gesture.
    // Movement must not retry a broken URL every footfall.
    if (failures.has(id)) return null;
    if (effectRequests.has(id)) return effectRequests.get(id);
    const request = (async () => {
      const bytes = await fetchBytes(AUDIO_ASSETS.effects[id], id);
      if (!bytes || disposed) return null;
      try {
        const buffer = await decode(bytes);
        ++decodeCount;
        if (!disposed) remember(effectsCache, id, buffer, effectCacheBytes);
        return buffer;
      } catch { return unavailable(id); }
    })();
    effectRequests.set(id, request);
    request.finally(() => effectRequests.delete(id)).catch(() => {});
    return request;
  }

  function unlock() {
    if (!init()) return Promise.resolve(false);
    paused = false;
    // Resume AND warm each element before an await loses the Safari gesture.
    let resumed;
    try { resumed = ctx.resume(); }
    catch { resumed = Promise.reject(new Error('resume')); }
    for (const [id, stream] of streams) startStream(id, stream, true);
    mix(); updateStreams();
    for (const id of Object.keys(AUDIO_ASSETS.effects)) {
      failures.delete(id);
      void loadEffect(id);
    }
    return Promise.resolve(resumed).then(() => {
      if (disposed || paused) return false;
      updateStreams();
      return ctx.state === 'running';
    }).catch(() => { unavailable('resume'); return false; });
  }

  function pause() {
    paused = true;
    ++epoch;
    cancelCue();
    for (const source of activeEffects) stopSource(source);
    activeEffects.clear();
    for (const stream of streams.values()) stream.element.pause();
    if (ctx) { try { Promise.resolve(ctx.suspend()).catch(() => {}); } catch {} }
  }

  function reset() {
    ++epoch;
    cancelCue();
    for (const source of activeEffects) stopSource(source);
    activeEffects.clear();
  }

  function playCue(id) {
    if (!AUDIO_ASSETS.voice[id] || levels.voice === false || !audible()) return Promise.resolve(false);
    cancelCue();
    const ticket = cueToken;
    voicePending = id;
    cueController = typeof AbortController === 'function' ? new AbortController() : null;
    const controller = cueController;
    const request = (async () => {
      if (ticket !== cueToken || !audible() || levels.voice === false) return false;
      let buffer = cached(voiceCache, id);
      if (!buffer) {
        // Fetch outside the decode queue: a stale slow request must never hold
        // up the new objective. Abort it and serialize only actual decoding.
        const bytes = await fetchBytes(AUDIO_ASSETS.voice[id], id, controller?.signal);
        if (!bytes || ticket !== cueToken || !audible() || levels.voice === false) return false;
        const decoding = voiceQueue.then(async () => {
          if (ticket !== cueToken || !audible() || levels.voice === false) return null;
          try { const result = await decode(bytes); ++decodeCount; return result; }
          catch { return unavailable(id); }
        });
        voiceQueue = decoding.catch(() => null);
        buffer = await decoding;
        if (!buffer) return false;
        if (ticket !== cueToken || !audible() || levels.voice === false) return false;
        remember(voiceCache, id, buffer, voiceCacheBytes, true);
      }
      if (ticket !== cueToken || !audible() || levels.voice === false) return false;
      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(voiceGain);
        source.onended = () => {
          if (voice !== source) return;
          source.disconnect();
          voice = null; voiceId = null;
          mix();
        };
        voice = source; voiceId = id; voicePending = null;
        mix(); source.start(); ++cueStarts;
        return true;
      } catch { stopVoice(); unavailable(id); return false; }
    })();
    return request.then(result => {
      if (ticket === cueToken && !result) voicePending = null;
      return result;
    }).catch(() => { if (ticket === cueToken) voicePending = null; unavailable(id); return false; });
  }

  async function playEffect(id, { gain = .6, rate = 1, channel = id } = {}) {
    if (!AUDIO_ASSETS.effects[id] || !audible() || bounded(levels.sfx, .75) === 0) return false;
    const ticket = epoch;
    const event = (effectTickets.get(channel) || 0) + 1;
    effectTickets.set(channel, event);
    const buffer = await loadEffect(id);
    if (!buffer || !audible() || ticket !== epoch || effectTickets.get(channel) !== event || bounded(levels.sfx, .75) === 0) return false;
    let source;
    try {
      while (activeEffects.size >= 8) {
        const oldest = activeEffects.values().next().value;
        stopSource(oldest); activeEffects.delete(oldest);
      }
      source = ctx.createBufferSource();
      const volume = ctx.createGain();
      source.adventureGain = volume;
      source.buffer = buffer;
      source.playbackRate.value = Math.max(.8, Math.min(1.2, rate));
      volume.gain.value = bounded(gain, .6);
      source.connect(volume); volume.connect(effectsGain);
      source.onended = () => { activeEffects.delete(source); source.disconnect(); volume.disconnect(); };
      activeEffects.add(source);
      source.start(); ++effectStarts; lastEffect = id;
      return true;
    } catch {
      if (source) { stopSource(source); activeEffects.delete(source); }
      return Boolean(unavailable(id));
    }
  }

  function playStep(surface = 'ground', speed = 3) {
    const id = surface === 'grass' ? 'horse-surface-grass'
      : surface === 'sand' ? 'horse-surface-muffled'
      : surface === 'hard' ? 'horse-surface-hall' : 'horse-surface-ground';
    return playEffect(id, { channel: 'step', gain: .28 + bounded(speed / 12, .25) * .25, rate: .94 + bounded(speed / 12, .25) * .14 });
  }

  // Original, quiet UI confirmation notes, never described as horse sounds.
  function playChime(name = 'pick') {
    if (!audible() || bounded(levels.sfx, .75) === 0) return false;
    const notes = name === 'quest' ? [523, 659, 784]
      : name === 'trust' ? [659, 784, 988] : [659, 988];
    try {
      notes.forEach((frequency, index) => {
        while (activeEffects.size >= 8) {
          const oldest = activeEffects.values().next().value;
          stopSource(oldest); activeEffects.delete(oldest);
        }
        const source = ctx.createOscillator(), volume = ctx.createGain();
        const time = ctx.currentTime + index * .085;
        source.type = 'sine'; source.frequency.value = frequency;
        source.adventureGain = volume;
        volume.gain.setValueAtTime(0, time);
        volume.gain.linearRampToValueAtTime(.055, time + .015);
        volume.gain.linearRampToValueAtTime(0, time + .22);
        source.connect(volume); volume.connect(effectsGain);
        source.onended = () => { activeEffects.delete(source); source.disconnect(); volume.disconnect(); };
        activeEffects.add(source);
        source.start(time); source.stop(time + .23); ++effectStarts;
      });
      lastEffect = `chime-${name}`;
      return true;
    } catch { return Boolean(unavailable('ui-chime')); }
  }

  function setSettings(next) {
    if (Number.isFinite(next.music)) levels.music = bounded(next.music, levels.music);
    if (Number.isFinite(next.sfx)) levels.sfx = bounded(next.sfx, levels.sfx);
    if (typeof next.voice === 'boolean') levels.voice = next.voice;
    if (levels.voice === false) cancelCue();
    mix(); updateStreams();
  }

  function setEnvironment(next) {
    if ([1, 2, 3].includes(next.chapter)) environment.chapter = next.chapter;
    if (Number.isFinite(next.creek)) environment.creek = bounded(next.creek, environment.creek);
    if (Number.isFinite(next.movement)) environment.movement = bounded(next.movement, environment.movement);
    updateStreams();
  }

  function dispose() {
    pause(); disposed = true;
    for (const stream of streams.values()) {
      stream.element.removeAttribute('src');
      try { stream.element.load(); stream.source.disconnect(); } catch {}
    }
    streams.clear(); voiceCache.clear(); effectsCache.clear();
    voiceBytes = 0; effectsBytes = 0;
    if (ctx) { try { Promise.resolve(ctx.close()).catch(() => {}); } catch {} }
  }

  function status() {
    return Object.freeze({
      ready, paused, context: ctx?.state || 'unavailable', sampleRate: ctx?.sampleRate || 0,
      cue: voiceId, pendingCue: voicePending,
      cueDuration: voice?.buffer?.duration || 0,
      cueStarts, effectStarts, streamStarts, decodeCount, lastEffect,
      voiceCacheEntries: voiceCache.size, voiceCacheBytes: voiceBytes,
      effectCacheEntries: effectsCache.size, effectCacheBytes: effectsBytes,
      activeEffects: activeEffects.size,
      musicDucked: Boolean(voice),
      settings: Object.freeze({ ...levels }),
      environment: Object.freeze({ ...environment }),
      streams: Object.freeze(Object.fromEntries([...streams].map(([id, stream]) => [id, Object.freeze({
        playing: !stream.element.paused, level: streamLevel(id),
        time: stream.element.currentTime || 0, readyState: stream.element.readyState || 0
      })]))),
      unavailable: Object.freeze([...failures])
    });
  }

  return Object.freeze({ get cue(){return voiceId;}, unlock, resume: unlock, pause, reset, playCue, playEffect, playStep, playChime, setSettings, setEnvironment, status, dispose });
}
