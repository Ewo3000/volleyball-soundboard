import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryStorageEngine,
  IndexedDBStorageEngine,
  setDefaultStorage,
  updateTrackGain
} from '../js/db.js';

describe('StorageEngine Track Gain Persistence', () => {
  it('MemoryStorageEngine.updateTrackGain updates normGain and customGain while preserving other fields', async () => {
    const engine = new MemoryStorageEngine();
    await engine.init();
    setDefaultStorage(engine);

    await engine.saveTracks([
      { id: 't1', name: 'Song1.mp3', playCount: 3, blob: new Uint8Array([1, 2]) }
    ]);

    await updateTrackGain('t1', { normGain: 1.45 });
    let tracks = await engine.getAllTracks();
    assert.equal(tracks[0].normGain, 1.45);
    assert.equal(tracks[0].playCount, 3);

    await updateTrackGain('t1', { customGain: 0.8 });
    tracks = await engine.getAllTracks();
    assert.equal(tracks[0].normGain, 1.45);
    assert.equal(tracks[0].customGain, 0.8);
    assert.equal(tracks[0].playCount, 3);
  });

  it('IndexedDBStorageEngine.updateTrackGain updates track in store and awaits tx.oncomplete', async () => {
    const stored = { id: 't2', name: 'Song2.mp3', playCount: 5 };
    let putRecord = null;

    const engine = new IndexedDBStorageEngine();
    engine.db = {
      transaction() {
        const tx = {
          oncomplete: null,
          onerror: null,
          objectStore() {
            return {
              get() {
                const req = { result: { ...stored }, onsuccess: null, onerror: null };
                setTimeout(() => {
                  if (req.onsuccess) req.onsuccess();
                }, 0);
                return req;
              },
              put(rec) {
                putRecord = rec;
                setTimeout(() => {
                  if (tx.oncomplete) tx.oncomplete();
                }, 0);
              }
            };
          }
        };
        return tx;
      }
    };

    await engine.updateTrackGain('t2', { normGain: 1.2, customGain: 1.5 });
    assert.equal(putRecord.normGain, 1.2);
    assert.equal(putRecord.customGain, 1.5);
    assert.equal(putRecord.playCount, 5);
  });
});

describe('Audio Loudness Normalization & Compressor Routing', () => {
  it('computeNormalizationGain boosts quiet buffers, attenuates loud buffers, and ignores silence', async () => {
    const { computeNormalizationGain } = await import('../js/audio-engine.js');

    // Empty / null buffer returns 1.0
    assert.equal(computeNormalizationGain(null), 1.0);

    // Quiet signal (amplitude 0.04 -> RMS ~0.04, target ~0.1585 -> gain > 1.5)
    const quietSamples = new Float32Array(4096).fill(0.04);
    const quietBuffer = {
      numberOfChannels: 1,
      length: quietSamples.length,
      getChannelData: () => quietSamples
    };
    const quietGain = computeNormalizationGain(quietBuffer);
    assert.ok(quietGain > 1.5 && quietGain <= 2.5, `Expected quietGain > 1.5, got ${quietGain}`);

    // Loud signal (amplitude 0.6 -> RMS 0.6, target ~0.1585 -> gain < 0.5)
    const loudSamples = new Float32Array(4096).fill(0.6);
    const loudBuffer = {
      numberOfChannels: 1,
      length: loudSamples.length,
      getChannelData: () => loudSamples
    };
    const loudGain = computeNormalizationGain(loudBuffer);
    assert.ok(loudGain >= 0.35 && loudGain < 0.5, `Expected loudGain < 0.5, got ${loudGain}`);

    // Silent signal returns 1.0
    const silentSamples = new Float32Array(4096).fill(0);
    const silentBuffer = {
      numberOfChannels: 1,
      length: silentSamples.length,
      getChannelData: () => silentSamples
    };
    assert.equal(computeNormalizationGain(silentBuffer), 1.0);
  });

  it('AudioEngine applies normGain, customGain, autoNormalize toggle, and DynamicsCompressorNode', async () => {
    const { AudioEngine } = await import('../js/audio-engine.js');
    const engine = new AudioEngine();

    assert.equal(engine.getAutoNormalize(), true);

    const track = { id: 't_norm', name: 'Test.mp3', normGain: 1.5, customGain: 0.8 };
    // 1.5 * 0.8 = 1.2
    assert.ok(Math.abs(engine.getEffectiveTrackGain(track) - 1.2) < 0.001);

    // When autoNormalize is disabled, only customGain is used
    engine.setAutoNormalize(false);
    assert.equal(engine.getAutoNormalize(), false);
    assert.ok(Math.abs(engine.getEffectiveTrackGain(track) - 0.8) < 0.001);

    engine.setAutoNormalize(true);

    // Verify compressor node creation and live gain update
    let lastGainTarget = 1.0;
    engine.audioCtx = {
      currentTime: 0,
      state: 'running',
      destination: {},
      createGain() {
        return {
          gain: {
            value: 1,
            setValueAtTime(v) { this.value = v; lastGainTarget = v; },
            exponentialRampToValueAtTime(v) { this.value = v; lastGainTarget = v; }
          },
          connect() {}
        };
      },
      createDynamicsCompressor() {
        return {
          threshold: { setValueAtTime() {} },
          knee: { setValueAtTime() {} },
          ratio: { setValueAtTime() {} },
          attack: { setValueAtTime() {} },
          release: { setValueAtTime() {} },
          connect() {}
        };
      },
      decodeAudioData: async () => ({
        numberOfChannels: 1,
        length: 2048,
        getChannelData: () => new Float32Array(2048).fill(0.05)
      })
    };

    engine.currentTrack = track;
    engine.currentTrackGain = engine.audioCtx.createGain();
    engine.updateCurrentTrackGain();
    assert.ok(Math.abs(lastGainTarget - 1.2) < 0.001);

    // analyzeTrackLoudness decodes and sets track.normGain
    const rawTrack = { id: 't_raw', name: 'Raw.mp3', blob: new Uint8Array([1, 2, 3, 4]) };
    const computed = await engine.analyzeTrackLoudness(rawTrack);
    assert.ok(typeof computed === 'number' && computed > 1.0);
    assert.equal(rawTrack.normGain, computed);
  });
});
