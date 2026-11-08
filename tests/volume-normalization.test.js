import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MemoryStorageEngine,
  IndexedDBStorageEngine,
  setDefaultStorage,
  updateTrackGain
} from '../js/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('StorageEngine Track Gain Persistence', () => {
  it('MemoryStorageEngine.updateTrackGain updates normGain, customGain, and normVersion while preserving other fields', async () => {
    const engine = new MemoryStorageEngine();
    await engine.init();
    setDefaultStorage(engine);

    await engine.saveTracks([
      { id: 't1', name: 'Song1.mp3', playCount: 3, blob: new Uint8Array([1, 2]) }
    ]);

    await updateTrackGain('t1', { normGain: 1.45, normVersion: 2 });
    let tracks = await engine.getAllTracks();
    assert.equal(tracks[0].normGain, 1.45);
    assert.equal(tracks[0].normVersion, 2);
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

    await engine.updateTrackGain('t2', { normGain: 1.2, customGain: 1.5, normVersion: 2 });
    assert.equal(putRecord.normGain, 1.2);
    assert.equal(putRecord.customGain, 1.5);
    assert.equal(putRecord.normVersion, 2);
    assert.equal(putRecord.playCount, 5);
  });
});

describe('Audio Loudness Normalization, Equalizer & Node Cleanup', () => {
  it('computeNormalizationGain boosts quiet buffers, gently trims loud buffers, and ignores silence', async () => {
    const { computeNormalizationGain } = await import('../js/audio-engine.js');

    // Empty / null buffer returns 1.0
    assert.equal(computeNormalizationGain(null), 1.0);

    // Quiet signal (amplitude 0.04 -> RMS ~0.04, target ~0.25 -> gain > 1.8)
    const quietSamples = new Float32Array(4096).fill(0.04);
    const quietBuffer = {
      numberOfChannels: 1,
      length: quietSamples.length,
      getChannelData: () => quietSamples
    };
    const quietGain = computeNormalizationGain(quietBuffer);
    assert.ok(quietGain > 1.8 && quietGain <= 2.4, `Expected quietGain > 1.8, got ${quietGain}`);

    // Loud signal (amplitude 0.6 -> RMS 0.6, target ~0.25 -> gain ~0.72)
    const loudSamples = new Float32Array(4096).fill(0.6);
    const loudBuffer = {
      numberOfChannels: 1,
      length: loudSamples.length,
      getChannelData: () => loudSamples
    };
    const loudGain = computeNormalizationGain(loudBuffer);
    assert.ok(loudGain >= 0.7 && loudGain < 0.85, `Expected loudGain between 0.7 and 0.85, got ${loudGain}`);

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

  it('AudioEngine applies 5 Equalizer presets via 3-band BiquadFilterNodes and disconnects nodes on cleanup', async () => {
    const { AudioEngine, EQ_PRESETS } = await import('../js/audio-engine.js');
    assert.equal(Object.keys(EQ_PRESETS).length, 5, 'Must define exactly 5 EQ presets');
    const engine = new AudioEngine();

    const disconnectedNodes = [];
    const createdFilters = [];

    const prevAudioCtx = globalThis.AudioContext;
    globalThis.AudioContext = function () {
      this.currentTime = 0;
      this.state = 'running';
      this.destination = {};
      this.createGain = () => ({
        gain: { value: 1, setValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; } },
        connect() {},
        disconnect() { disconnectedNodes.push('gain'); }
      });
      this.createDynamicsCompressor = () => ({
        threshold: { setValueAtTime() {} },
        knee: { setValueAtTime() {} },
        ratio: { setValueAtTime() {} },
        attack: { setValueAtTime() {} },
        release: { setValueAtTime() {} },
        connect() {}
      });
      this.createBiquadFilter = () => {
        const f = {
          type: 'peaking',
          frequency: { setValueAtTime() {} },
          Q: { setValueAtTime() {} },
          gain: { value: 0, setValueAtTime(v) { this.value = v; } },
          connect() {}
        };
        createdFilters.push(f);
        return f;
      };
      this.createMediaElementSource = () => ({
        connect() {},
        disconnect() { disconnectedNodes.push('source'); }
      });
    };

    try {
      engine.initAudioContext();
      assert.equal(createdFilters.length, 3, 'Must create 3 BiquadFilterNodes (Low, Mid, High)');

      engine.setEqPreset('stadium');
      assert.equal(engine.getEqPreset(), 'stadium');
      assert.equal(engine.eqLow.gain.value, EQ_PRESETS.stadium.low);
      assert.equal(engine.eqMid.gain.value, EQ_PRESETS.stadium.mid);
      assert.equal(engine.eqHigh.gain.value, EQ_PRESETS.stadium.high);

      engine.setEqPreset('bass');
      assert.equal(engine.getEqPreset(), 'bass');
      assert.equal(engine.eqLow.gain.value, EQ_PRESETS.bass.low);

      // Verify _cleanupAudioChain disconnects source and trackGain to prevent memory/node leaks
      const mockSource = { disconnect() { disconnectedNodes.push('source'); } };
      const mockGain = { disconnect() { disconnectedNodes.push('gain'); } };
      let loadedCalled = false;
      const mockAudio = {
        pause() {},
        removeAttribute() {},
        load() { loadedCalled = true; }
      };
      engine._cleanupAudioChain({ audio: mockAudio, source: mockSource, trackGain: mockGain });
      assert.ok(disconnectedNodes.includes('source'), 'source.disconnect() must be called');
      assert.ok(disconnectedNodes.includes('gain'), 'trackGain.disconnect() must be called');
      assert.equal(loadedCalled, true, 'audio.load() must be called after removing src');
    } finally {
      globalThis.AudioContext = prevAudioCtx;
    }
  });
});

describe('Volume Normalization & Equalizer Markup and Styles', () => {
  it('index.html contains #btn-eq-menu, #eq-modal with 5 presets, #btn-auto-norm inside popup, and song volume slider in #scrubber-modal', () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    assert.match(html, /id="btn-eq-menu"/, 'Must contain #btn-eq-menu in header');
    assert.match(html, /id="eq-modal"/, 'Must contain #eq-modal popup');
    assert.match(html, /id="btn-auto-norm"/, 'Must contain #btn-auto-norm inside eq-modal');
    assert.match(html, /data-eq-preset="neutral"/, 'Must contain neutral preset');
    assert.match(html, /data-eq-preset="stadium"/, 'Must contain stadium preset');
    assert.match(html, /data-eq-preset="bass"/, 'Must contain bass preset');
    assert.match(html, /data-eq-preset="punch"/, 'Must contain punch preset');
    assert.match(html, /data-eq-preset="warm"/, 'Must contain warm preset');
    assert.match(html, /id="scrubber-gain-slider"/, 'Must contain #scrubber-gain-slider');
    assert.match(html, /id="scrubber-gain-value"/, 'Must contain #scrubber-gain-value');
    assert.match(html, /id="btn-reset-track-gain"/, 'Must contain #btn-reset-track-gain');
  });

  it('css/app.css styles .btn-eq-menu, .eq-preset-btn, .btn-auto-norm and .scrubber-gain-section', () => {
    const css = fs.readFileSync(path.join(rootDir, 'css/app.css'), 'utf8');

    assert.match(css, /\.btn-eq-menu/, 'CSS must style .btn-eq-menu');
    assert.match(css, /\.eq-preset-btn/, 'CSS must style .eq-preset-btn');
    assert.match(css, /\.btn-auto-norm/, 'CSS must style .btn-auto-norm');
    assert.match(css, /\.scrubber-gain-section/, 'CSS must style .scrubber-gain-section');
    assert.match(css, /\.btn-reset-track-gain/, 'CSS must style .btn-reset-track-gain');
  });
});

describe('Controller Auto-Normalize, Equalizer Popup & Per-Track Gain Integration', () => {
  it('applyAutoNormalize, toggleAutoNormalize, applyEqPreset, openEqModal/closeEqModal, and applyTrackCustomGain update AudioEngine, UI, and DB', async () => {
    const engine = new MemoryStorageEngine();
    await engine.init();
    setDefaultStorage(engine);

    const btnAutoNorm = {
      classes: new Set(['is-active']),
      attrs: { 'aria-pressed': 'true' },
      classList: {
        toggle(c, force) {
          if (force) btnAutoNorm.classes.add(c);
          else btnAutoNorm.classes.delete(c);
        },
        contains(c) {
          return btnAutoNorm.classes.has(c);
        }
      },
      setAttribute(k, v) {
        this.attrs[k] = v;
      }
    };
    const statusText = { textContent: 'EIN' };
    const btnEqMenu = {
      classes: new Set(),
      attrs: { 'aria-expanded': 'false' },
      classList: {
        toggle(c, force) {
          if (force) btnEqMenu.classes.add(c);
          else btnEqMenu.classes.delete(c);
        }
      },
      setAttribute(k, v) {
        this.attrs[k] = v;
      },
      focus() {}
    };
    const eqMenuLabel = { textContent: 'Sound / EQ' };
    const eqModal = { style: { display: 'none' }, setAttribute() {} };
    const gainSlider = { value: '100' };
    const gainValue = { textContent: '100%' };
    const modalEl = { style: { display: 'none' }, setAttribute() {} };
    const titleEl = { textContent: '' };

    const prevDoc = global.document;
    global.document = {
      getElementById(id) {
        if (id === 'btn-auto-norm') return btnAutoNorm;
        if (id === 'auto-norm-status-text') return statusText;
        if (id === 'btn-eq-menu') return btnEqMenu;
        if (id === 'eq-menu-label') return eqMenuLabel;
        if (id === 'eq-modal') return eqModal;
        if (id === 'scrubber-gain-slider') return gainSlider;
        if (id === 'scrubber-gain-value') return gainValue;
        if (id === 'scrubber-modal') return modalEl;
        if (id === 'scrubber-title') return titleEl;
        return null;
      },
      querySelectorAll: () => []
    };

    try {
      const app = await import(`../js/app.js?t=${Date.now()}`);

      // Toggle auto-normalize off
      app.toggleAutoNormalize();
      assert.equal(app.audioEngine.getAutoNormalize(), false);
      assert.equal(btnAutoNorm.classes.has('is-active'), false);
      assert.equal(btnAutoNorm.attrs['aria-pressed'], 'false');
      assert.equal(statusText.textContent, 'AUS');

      // Toggle auto-normalize back on
      app.toggleAutoNormalize();
      assert.equal(app.audioEngine.getAutoNormalize(), true);
      assert.equal(btnAutoNorm.classes.has('is-active'), true);
      assert.equal(btnAutoNorm.attrs['aria-pressed'], 'true');
      assert.equal(statusText.textContent, 'EIN');

      // EQ Preset change & modal open/close
      app.openEqModal();
      assert.equal(eqModal.style.display, 'flex');
      assert.equal(btnEqMenu.attrs['aria-expanded'], 'true');

      app.applyEqPreset('stadium');
      assert.equal(app.audioEngine.getEqPreset(), 'stadium');
      assert.equal(eqMenuLabel.textContent, 'EQ: Stadion / Halle');
      assert.equal(btnEqMenu.classes.has('is-active'), true);

      app.closeEqModal();
      assert.equal(eqModal.style.display, 'none');
      assert.equal(btnEqMenu.attrs['aria-expanded'], 'false');

      // Per-track customGain adjustment
      const track = { id: 't_custom', name: 'Song_Custom.mp3', cleanTitle: 'Song Custom', playCount: 1 };
      await engine.saveTracks([track]);
      app.audioEngine.currentTrack = track;

      await app.applyTrackCustomGain(140);
      assert.equal(track.customGain, 1.4);
      assert.equal(gainValue.textContent, '140%');
      assert.equal(String(gainSlider.value), '140');

      const stored = await engine.getAllTracks();
      assert.equal(stored[0].customGain, 1.4);

      // openScrubberModal initializes gain slider to current track's customGain
      gainSlider.value = '100';
      gainValue.textContent = '100%';
      app.openScrubberModal();
      assert.equal(String(gainSlider.value), '140');
      assert.equal(gainValue.textContent, '140%');
      app.closeScrubberModal();
    } finally {
      global.document = prevDoc;
    }
  });
});
