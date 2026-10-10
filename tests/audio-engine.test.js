import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine, pickLeastPlayedRandomTrack } from '../js/audio-engine.js';

test('pickLeastPlayedRandomTrack prioritizes unplayed tracks (playCount == 0)', () => {
  const tracks = [
    { id: '1', cleanTitle: 'Song A', playCount: 2 },
    { id: '2', cleanTitle: 'Song B', playCount: 0 },
    { id: '3', cleanTitle: 'Song C', playCount: 1 }
  ];

  // When there are tracks with 0 play count, it should only pick among them
  for (let i = 0; i < 10; i++) {
    const picked = pickLeastPlayedRandomTrack(tracks);
    assert.equal(picked.id, '2');
  }
});

test('pickLeastPlayedRandomTrack picks least played when all played at least once', () => {
  const tracks = [
    { id: '1', cleanTitle: 'Song A', playCount: 3 },
    { id: '2', cleanTitle: 'Song B', playCount: 1 },
    { id: '3', cleanTitle: 'Song C', playCount: 1 }
  ];

  for (let i = 0; i < 10; i++) {
    const picked = pickLeastPlayedRandomTrack(tracks);
    assert.ok(picked.id === '2' || picked.id === '3');
  }
});

test('pickLeastPlayedRandomTrack returns null for empty list or falsy input', () => {
  assert.equal(pickLeastPlayedRandomTrack([]), null);
  assert.equal(pickLeastPlayedRandomTrack(null), null);
  assert.equal(pickLeastPlayedRandomTrack(undefined), null);
});

test('AudioEngine initializes with expected default state', () => {
  const engine = new AudioEngine();
  assert.equal(engine.getMasterVolume(), 1.0);
  assert.equal(engine.getCurrentTrack(), null);
  assert.equal(engine.audioCtx, null);
  assert.equal(engine.currentAudioElement, null);
});

test('AudioEngine.setMasterVolume clamps values between 0 and 1', () => {
  const engine = new AudioEngine();
  engine.setMasterVolume(0.5);
  assert.equal(engine.getMasterVolume(), 0.5);

  engine.setMasterVolume(-0.2);
  assert.equal(engine.getMasterVolume(), 0);

  engine.setMasterVolume(1.8);
  assert.equal(engine.getMasterVolume(), 1);
});

test('AudioEngine.pickRandomTrack delegates to pickLeastPlayedRandomTrack', () => {
  const engine = new AudioEngine();
  const tracks = [
    { id: '1', playCount: 5 },
    { id: '2', playCount: 0 }
  ];
  const picked = engine.pickRandomTrack(tracks);
  assert.equal(picked.id, '2');
  assert.equal(engine.pickRandomTrack([]), null);
});

test('AudioEngine.stop when not playing triggers onTrackStop and stays clean', () => {
  const engine = new AudioEngine();
  let stopCalled = false;
  engine.onTrackStop = () => {
    stopCalled = true;
  };

  engine.stop();
  assert.equal(stopCalled, true);
  assert.equal(engine.getCurrentTrack(), null);
});

test('AudioEngine plays track with Web Audio API mock and handles lifecycle', async () => {
  // Setup mocks in global scope
  const originalAudio = globalThis.Audio;
  const originalAudioContext = globalThis.AudioContext;
  const originalURL = globalThis.URL;

  const gainRamps = [];
  class MockGainNode {
    constructor() {
      this.gain = {
        value: 1.0,
        setValueAtTime: (v, t) => gainRamps.push({ action: 'setValueAtTime', v, t }),
        exponentialRampToValueAtTime: (v, t) => gainRamps.push({ action: 'exponentialRampToValueAtTime', v, t }),
        linearRampToValueAtTime: (v, t) => gainRamps.push({ action: 'linearRampToValueAtTime', v, t })
      };
    }
    connect() {}
  }

  class MockAudioContext {
    constructor() {
      this.currentTime = 0;
      this.state = 'suspended';
      this.destination = {};
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    createGain() {
      return new MockGainNode();
    }
    createMediaElementSource(audio) {
      return {
        connect: () => {}
      };
    }
  }

  class MockAudio {
    constructor(src) {
      this.src = src;
      this.volume = 1.0;
      this.currentTime = 0;
      this.paused = true;
      this.onended = null;
    }
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }

  globalThis.Audio = MockAudio;
  globalThis.AudioContext = MockAudioContext;
  if (!globalThis.URL) globalThis.URL = {};
  const origCreateObjectURL = globalThis.URL.createObjectURL;
  globalThis.URL.createObjectURL = (blob) => `blob:mock-url-${blob}`;

  try {
    const engine = new AudioEngine();
    let startedTrack = null;
    let stoppedTrack = false;
    let endedTrack = null;

    engine.onTrackStart = (t) => { startedTrack = t; };
    engine.onTrackStop = () => { stoppedTrack = true; };
    engine.onTrackEnd = (t) => { endedTrack = t; };

    const track1 = { id: 't1', cleanTitle: 'Track 1', url: 'https://example.com/t1.mp3' };
    await engine.playTrack(track1);

    assert.equal(engine.getCurrentTrack(), track1);
    assert.equal(startedTrack, track1);
    assert.equal(engine.currentAudioElement.paused, false);

    // Test micro-fade transition on playing next track
    const track2 = { id: 't2', cleanTitle: 'Track 2', url: 'https://example.com/t2.mp3' };
    await engine.playTrack(track2);
    assert.equal(engine.getCurrentTrack(), track2);
    assert.equal(startedTrack, track2);

    // Test volume update affects current audio element
    engine.setMasterVolume(0.7);
    assert.equal(engine.currentAudioElement.volume, 0.7);

    // Test stop
    engine.stop(0);
    assert.equal(engine.getCurrentTrack(), null);
    assert.equal(stoppedTrack, true);

    // Test end event
    const track3 = { id: 't3', cleanTitle: 'Track 3', url: 'https://example.com/t3.mp3' };
    await engine.playTrack(track3);
    const audioEl = engine.currentAudioElement;
    audioEl.onended();
    assert.equal(engine.getCurrentTrack(), null);
    assert.equal(endedTrack, track3);
  } finally {
    globalThis.Audio = originalAudio;
    globalThis.AudioContext = originalAudioContext;
    globalThis.URL.createObjectURL = origCreateObjectURL;
  }
});

test('AudioEngine playTrack handles Uint8Array/ArrayBuffer and errors on invalid track', async () => {
  const originalAudio = globalThis.Audio;
  const originalURL = globalThis.URL;

  class MockAudio {
    constructor(src) {
      this.src = src;
    }
    play() {
      return Promise.resolve();
    }
    pause() {}
  }

  globalThis.Audio = MockAudio;
  if (!globalThis.URL) globalThis.URL = {};
  const origCreateObjectURL = globalThis.URL.createObjectURL;
  globalThis.URL.createObjectURL = () => 'blob:mock-blob-url';

  try {
    const engine = new AudioEngine();

    // With Uint8Array
    const trackWithUint8 = {
      id: 't-u8',
      blob: new Uint8Array([1, 2, 3])
    };
    await engine.playTrack(trackWithUint8);
    assert.equal(engine.currentAudioElement.src, 'blob:mock-blob-url');

    // With ArrayBuffer
    const trackWithAB = {
      id: 't-ab',
      blob: new ArrayBuffer(8)
    };
    await engine.playTrack(trackWithAB);
    assert.equal(engine.currentAudioElement.src, 'blob:mock-blob-url');

    // Invalid track throws
    const origConsoleError = console.error;
    console.error = () => {};
    try {
      await assert.rejects(
        async () => {
          await engine.playTrack({ id: 'bad' });
        },
        /Track has no playable audio blob or URL/
      );
    } finally {
      console.error = origConsoleError;
    }
  } finally {
    globalThis.Audio = originalAudio;
    globalThis.URL.createObjectURL = origCreateObjectURL;
  }
});
