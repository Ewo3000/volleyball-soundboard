import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('v1.15.0 Feature 6: One-Shot SFX Engine & AudioEngine Overlay Bus', () => {
  it('SFX_DEFINITIONS exports 6 stadium sound effects and synthesizeOneShotSfx triggers cleanly', async () => {
    const { SFX_DEFINITIONS, synthesizeOneShotSfx } = await import('../js/sfx-engine.js');
    assert.equal(SFX_DEFINITIONS.length, 6, 'Must define 6 one-shot SFX presets');

    const oscStarted = [];
    const bufferStarted = [];
    const mockCtx = {
      currentTime: 0,
      sampleRate: 8000,
      createGain: () => ({
        gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {}
      }),
      createOscillator: () => ({
        type: 'sine',
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        detune: { setValueAtTime() {} },
        connect() {},
        disconnect() {},
        start(t) { oscStarted.push(t); },
        stop() {}
      }),
      createBuffer: (ch, len, sr) => ({
        getChannelData: () => new Float32Array(len)
      }),
      createBufferSource: () => ({
        buffer: null,
        connect() {},
        disconnect() {},
        start(t) { bufferStarted.push(t); },
        stop() {}
      }),
      createBiquadFilter: () => ({
        type: 'bandpass',
        frequency: { setValueAtTime() {} },
        Q: { setValueAtTime() {} },
        connect() {},
        disconnect() {}
      })
    };

    const dest = {};
    for (const def of SFX_DEFINITIONS) {
      assert.equal(synthesizeOneShotSfx(mockCtx, dest, def.id, 0.85), true, `${def.id} must synthesize`);
    }
    assert.ok(oscStarted.length > 0, 'Oscillators should be triggered');
    assert.ok(bufferStarted.length > 0, 'Noise buffer sources should be triggered');
    assert.equal(synthesizeOneShotSfx(mockCtx, dest, 'unknown_sfx', 0.85), false);
    assert.equal(synthesizeOneShotSfx(null, dest, 'airhorn', 0.85), false);
  });

  it('AudioEngine.playOneShotSfx plays overlay SFX without interrupting currentTrack', async () => {
    const { AudioEngine } = await import('../js/audio-engine.js');
    const engine = new AudioEngine();
    const activeTrack = { id: 'main_song', cleanTitle: 'Main Song' };
    engine.currentTrack = activeTrack;
    engine.audioCtx = {
      currentTime: 0,
      state: 'running',
      sampleRate: 8000,
      destination: {},
      resume: () => Promise.resolve(),
      createGain: () => ({
        gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {}
      }),
      createOscillator: () => ({
        type: 'sawtooth',
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        detune: { setValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() {},
        stop() {}
      })
    };
    engine.masterGain = engine.audioCtx.createGain();

    engine.setSfxVolume(0.75);
    assert.equal(engine.getSfxVolume(), 0.75);

    const played = engine.playOneShotSfx('airhorn');
    assert.equal(played, true);
    assert.equal(engine.getCurrentTrack(), activeTrack, 'Active music track must not be stopped by one-shot SFX');
  });
});

describe('v1.15.0 Feature 2: Double-Tap STOP = Hard-Cut (80ms)', () => {
  it('AudioEngine.hardStop interrupts active 3s fade-out immediately', async () => {
    const { AudioEngine } = await import('../js/audio-engine.js');
    const engine = new AudioEngine();

    let paused = false;
    let canceled = false;
    let rampTarget = null;
    engine.audioCtx = { currentTime: 1.0, state: 'running' };
    engine.currentAudioElement = {
      onended: () => {},
      pause() { paused = true; },
      removeAttribute() {},
      load() {},
      currentTime: 12
    };
    engine.currentSource = { disconnect() {} };
    engine.currentTrackGain = {
      gain: {
        value: 0.9,
        setValueAtTime() {},
        exponentialRampToValueAtTime(v) { rampTarget = v; },
        cancelScheduledValues() { canceled = true; }
      },
      disconnect() {}
    };
    engine.currentTrack = { id: 't_fade' };

    engine.stop(3000);
    assert.equal(engine.isFadingOut(), true, 'Must track active 3s fade chain');
    assert.equal(paused, false, 'Audio must still be fading before 3s timeout');

    const didHardCut = engine.hardStop(80);
    assert.equal(didHardCut, true);
    assert.equal(engine.isFadingOut(), false, 'Fade chain must be cleared after hardStop');
    assert.equal(canceled, true, 'Scheduled 3s fade values must be canceled');
    assert.equal(rampTarget, 0.0001);

    await new Promise((r) => setTimeout(r, 110));
    assert.equal(paused, true, 'Audio element must be paused after 80ms hard-cut');
  });

  it('stopAudio invokes 3000ms fade on 1st tap and hardStopAudio on 2nd tap while fading', async () => {
    const app = await import(`../js/app.js?t=${Date.now()}`);
    const origStop = app.audioEngine.stop;
    const origHardStop = app.audioEngine.hardStop;
    const origIsFading = app.audioEngine.isFadingOut;
    const origGetTrack = app.audioEngine.getCurrentTrack;

    let stopCalls = [];
    let hardStopCalls = [];

    app.audioEngine.getCurrentTrack = () => ({ id: 'active1', cleanTitle: 'Active' });
    app.audioEngine.isFadingOut = () => false;
    app.audioEngine.stop = (ms) => { stopCalls.push(ms); };
    app.audioEngine.hardStop = (ms) => { hardStopCalls.push(ms); return true; };

    try {
      app.resetStopFadeState();
      assert.equal(app.isStopFading, false);

      // First tap initiates 3000ms fade-out
      app.stopAudio();
      assert.deepEqual(stopCalls, [3000]);
      assert.equal(app.isStopFading, true);

      // Second tap while fading triggers 80ms hard-cut
      app.stopAudio();
      assert.deepEqual(hardStopCalls, [80]);
      assert.equal(app.isStopFading, false);
    } finally {
      app.resetStopFadeState();
      app.audioEngine.stop = origStop;
      app.audioEngine.hardStop = origHardStop;
      app.audioEngine.isFadingOut = origIsFading;
      app.audioEngine.getCurrentTrack = origGetTrack;
    }
  });
});

describe('v1.15.0 Feature 4: Timeout (30s) & Satzpause (3:00) Countdowns', () => {
  it('Timeout and Pause countdown helpers manage remaining seconds, +30s, reset, and auto-fade toggle', async () => {
    const app = await import(`../js/app.js?t=${Date.now()}`);

    const elements = new Map();
    const makeMockEl = (id) => ({
      id,
      textContent: '',
      style: {},
      attrs: {},
      classList: {
        classes: new Set(),
        add(...cs) { cs.forEach((c) => this.classes.add(c)); },
        remove(...cs) { cs.forEach((c) => this.classes.delete(c)); },
        toggle(c, force) {
          if (force) this.classes.add(c);
          else this.classes.delete(c);
        },
        contains(c) { return this.classes.has(c); }
      },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return this.attrs[k]; }
    });

    for (const id of [
      'btn-timeout',
      'btn-mobile-timeout',
      'timeout-countdown-desktop',
      'timeout-countdown-mobile',
      'pause-overlay',
      'pause-overlay-track-name',
      'pause-timer-box',
      'pause-countdown',
      'pause-countdown-fill',
      'btn-pause-autofade'
    ]) {
      elements.set(id, makeMockEl(id));
    }

    const prevDoc = global.document;
    global.document = {
      getElementById: (id) => elements.get(id) || null
    };

    try {
      // Timeout 30s
      app.startTimeoutCountdown(30);
      assert.equal(app.timeoutRemainingSec, 30);
      assert.equal(elements.get('timeout-countdown-desktop').textContent, '0:30');
      assert.equal(elements.get('btn-timeout').classList.contains('has-active-timer'), true);

      app.startTimeoutCountdown(8);
      assert.equal(elements.get('btn-timeout').classList.contains('timer-warning'), true);

      app.stopTimeoutCountdown();
      assert.equal(app.timeoutRemainingSec, 0);
      assert.equal(elements.get('btn-timeout').classList.contains('has-active-timer'), false);

      // Pause 3:00 (180s)
      app.showPauseOverlay({ name: 'Break_PAUSE1.mp3' });
      assert.equal(app.pauseRemainingSec, 180);
      assert.equal(elements.get('pause-countdown').textContent, '3:00');
      assert.equal(elements.get('pause-countdown-fill').style.transform, 'scaleX(1.0000)');

      app.addPauseTime(30);
      assert.equal(app.pauseRemainingSec, 210);
      assert.equal(elements.get('pause-countdown').textContent, '3:30');

      app.setPauseAutoFade(false);
      assert.equal(app.pauseAutoFadeEnabled, false);
      assert.equal(elements.get('btn-pause-autofade').getAttribute('aria-pressed'), 'false');

      app.setPauseAutoFade(true);
      assert.equal(app.pauseAutoFadeEnabled, true);

      app.hidePauseOverlay();
      assert.equal(app.pauseRemainingSec, 0);
    } finally {
      app.stopTimeoutCountdown();
      app.stopPauseCountdown();
      global.document = prevDoc;
    }
  });
});

describe('v1.15.0 Feature 5: Warm-Up Auto-Play Mode', () => {
  it('pickNextWarmupTrack prioritizes unplayed board songs and avoids repeating finished track', async () => {
    const app = await import(`../js/app.js?t=${Date.now()}`);
    const origTracks = app.allTracks.splice(0, app.allTracks.length);

    try {
      const t1 = { id: 'w1', cleanTitle: 'Song 1', category: 'sonstiges_1', playCount: 1 };
      const t2 = { id: 'w2', cleanTitle: 'Song 2', category: 'sonstiges_2', playCount: 0 };
      const tOpp = { id: 'opp', cleanTitle: 'Gegner Boo', category: 'gegner', playCount: 0 };
      app.allTracks.push(t1, t2, tOpp);

      const picked = app.pickNextWarmupTrack(t1);
      assert.equal(picked.id, 'w2', 'Should pick unplayed non-opponent song w2');

      t2.playCount = 1;
      const next = app.pickNextWarmupTrack(t2);
      assert.equal(next.id, 'w1', 'Should avoid repeating just-finished track w2');

      app.setWarmupMode(true);
      assert.equal(app.isWarmupMode, true);
      app.stopAudio();
      assert.equal(app.isWarmupMode, false, 'STOP must disable Warm-Up mode');
    } finally {
      app.setWarmupMode(false);
      app.allTracks.splice(0, app.allTracks.length, ...origTracks);
    }
  });
});

describe('v1.15.0 Visuals: Analyser VU Levels, Play-Count Freshness, Sonstiges Group, Dialogs & Light-Hall Theme', () => {
  it('AudioEngine.getAudioLevels returns 4 frequency bands + peak + clipping flag', async () => {
    const { AudioEngine } = await import('../js/audio-engine.js');
    const engine = new AudioEngine();
    assert.equal(engine.getAudioLevels(), null, 'Returns null when analyser is not initialized');

    engine.analyser = {
      frequencyBinCount: 32,
      getByteFrequencyData(arr) {
        arr.fill(128);
        arr[0] = 255; // high sub-bass & peak clipping
      }
    };
    engine._analyserData = new Uint8Array(32);

    const levels = engine.getAudioLevels();
    assert.ok(levels);
    assert.equal(levels.bars.length, 4);
    assert.ok(levels.bars[0] > 0.6);
    assert.equal(levels.peak, 1);
    assert.equal(levels.clipping, true);
  });

  it('createTrackButtonHtml marks playCount >= 2 with play-count-high and data-play-tier="high"', async () => {
    const { createTrackButtonHtml } = await import('../js/app.js');
    const freshHtml = createTrackButtonHtml({ id: 't0', cleanTitle: 'Fresh Song', category: 'sonstiges', playCount: 0 });
    const midHtml = createTrackButtonHtml({ id: 't1', cleanTitle: 'Played Once', category: 'sonstiges', playCount: 1 });
    const highHtml = createTrackButtonHtml({ id: 't2', cleanTitle: 'Overplayed', category: 'sonstiges', playCount: 2 });

    assert.ok(freshHtml.includes('data-play-tier="fresh"'));
    assert.ok(!freshHtml.includes('play-count-high'));
    assert.ok(midHtml.includes('data-play-tier="mid"'));
    assert.ok(!midHtml.includes('play-count-high'));
    assert.ok(highHtml.includes('play-count-high'));
    assert.ok(highHtml.includes('data-play-tier="high"'));
  });

  it('index.html & css/app.css include native <dialog> modals, spanning Sonstiges header, compact now-playing, VU meter & light-hall theme', () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css/app.css'), 'utf8');

    // Native <dialog> elements without redundant role="dialog" / aria-modal
    assert.match(html, /<dialog id="sfx-modal"[^>]*closedby="any"/);
    assert.match(html, /<dialog id="settings-modal"[^>]*closedby="any"/);
    assert.ok(!/<dialog[^>]*role="dialog"/.test(html), 'Native <dialog> must not set redundant role="dialog"');
    assert.ok(!/<dialog[^>]*aria-modal/.test(html), 'Native <dialog> must not set redundant aria-modal');

    // Header cleanup & new triggers
    assert.match(html, /id="compact-now-playing"/);
    assert.match(html, /id="master-vu-meter"/);
    assert.match(html, /id="btn-warmup-toggle"/);
    assert.match(html, /id="btn-sfx-menu"/);
    assert.match(html, /id="btn-settings-menu"/);

    // Spanning Sonstiges group header
    assert.match(html, /class="sonstiges-group"/);
    assert.match(html, /id="sonstiges-total-count"/);

    // Pause countdown & Timeout badge
    assert.match(html, /id="pause-countdown"/);
    assert.match(html, /id="timeout-countdown-desktop"/);

    // CSS rules
    assert.ok(css.includes('dialog.app-dialog[open]'), 'Must scope dialog display to [open]');
    assert.ok(css.includes('dialog.app-dialog:modal'), 'Must style dialog:modal overscroll-behavior');
    assert.ok(css.includes('dialog.app-dialog::backdrop'), 'Must style dialog::backdrop');
    assert.ok(css.includes('.sonstiges-group'), 'Must style .sonstiges-group');
    assert.ok(css.includes('--play-progress-scale'), 'Must define live progress scale variable');
    assert.ok(css.includes('.play-count-high'), 'Must style .play-count-high');
    assert.ok(css.includes('[data-theme="light-hall"]'), 'Must define [data-theme="light-hall"]');
    assert.ok(css.includes('@media (forced-colors: active)'), 'Must include Forced Colors Mode support');
  });
});
