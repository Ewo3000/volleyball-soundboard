import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Android Fullscreen Manifest and Gesture Hook', () => {
  it('manifest.webmanifest contains display_override with fullscreen and standalone', () => {
    const manifestPath = path.join(rootDir, 'manifest.webmanifest');
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.deepEqual(content.display_override, ['fullscreen', 'standalone']);
  });

  it('requestAutoFullscreen is exported from js/app.js and requests fullscreen when not already fullscreen', async () => {
    const app = await import('../js/app.js');
    assert.equal(typeof app.requestAutoFullscreen, 'function', 'requestAutoFullscreen should be exported function');

    const originalDoc = globalThis.document;
    let fullscreenRequested = false;

    try {
      globalThis.document = {
        fullscreenElement: null,
        documentElement: {
          requestFullscreen: () => {
            fullscreenRequested = true;
            return Promise.resolve();
          }
        }
      };

      app.requestAutoFullscreen();
      assert.equal(fullscreenRequested, true, 'Should have called requestFullscreen');

      // When already in fullscreen, should not call again
      fullscreenRequested = false;
      globalThis.document.fullscreenElement = {};
      app.requestAutoFullscreen();
      assert.equal(fullscreenRequested, false, 'Should not request fullscreen if already active');

      // Handles rejection gracefully
      globalThis.document.fullscreenElement = null;
      globalThis.document.documentElement.requestFullscreen = () => Promise.reject(new Error('Denied'));
      assert.doesNotThrow(() => {
        app.requestAutoFullscreen();
      });

      // Webkit fallback when requestFullscreen is missing
      let webkitRequested = false;
      globalThis.document.fullscreenElement = null;
      globalThis.document.webkitFullscreenElement = null;
      globalThis.document.documentElement = {
        webkitRequestFullscreen: () => {
          webkitRequested = true;
          return Promise.resolve();
        }
      };
      app.requestAutoFullscreen();
      assert.equal(webkitRequested, true, 'Should have called webkitRequestFullscreen as fallback');

      // When webkitFullscreenElement is active, should not request again
      webkitRequested = false;
      globalThis.document.webkitFullscreenElement = {};
      app.requestAutoFullscreen();
      assert.equal(webkitRequested, false, 'Should not request fullscreen if webkitFullscreenElement is active');
    } finally {
      globalThis.document = originalDoc;
    }
  });

  it('dismissStartupSplash calls requestAutoFullscreen', async () => {
    const app = await import('../js/app.js');
    const originalDoc = globalThis.document;
    const originalWindow = globalThis.window;
    let fullscreenRequested = false;

    try {
      const splash = {
        classList: {
          classes: new Set(),
          add(...c) { c.forEach(x => this.classes.add(x)); },
          contains(c) { return this.classes.has(c); }
        },
        setAttribute() {},
        style: {}
      };

      globalThis.document = {
        fullscreenElement: null,
        documentElement: {
          requestFullscreen: () => {
            fullscreenRequested = true;
            return Promise.resolve();
          }
        },
        getElementById(id) {
          if (id === 'startup-splash') return splash;
          return null;
        }
      };

      app.dismissStartupSplash();
      assert.equal(fullscreenRequested, true, 'dismissStartupSplash should trigger requestAutoFullscreen');
    } finally {
      globalThis.document = originalDoc;
      globalThis.window = originalWindow;
    }
  });

  it('setupEventListeners attaches once: true pointerdown listener on #app that triggers requestAutoFullscreen', async () => {
    const app = await import('../js/app.js');
    const originalDoc = globalThis.document;
    const originalWindow = globalThis.window;
    let fullscreenRequested = false;
    let registeredEvent = null;
    let registeredOptions = null;
    let handler = null;

    try {
      const appEl = {
        addEventListener(event, fn, options) {
          registeredEvent = event;
          handler = fn;
          registeredOptions = options;
        }
      };

      globalThis.window = {
        addEventListener() {}
      };

      globalThis.document = {
        fullscreenElement: null,
        documentElement: {
          requestFullscreen: () => {
            fullscreenRequested = true;
            return Promise.resolve();
          }
        },
        getElementById(id) {
          if (id === 'app') return appEl;
          return null;
        },
        addEventListener() {}
      };

      app.setupEventListeners();

      assert.equal(registeredEvent, 'pointerdown');
      assert.deepEqual(registeredOptions, { once: true });
      assert.equal(typeof handler, 'function');

      handler();
      assert.equal(fullscreenRequested, true, 'Handler should call requestAutoFullscreen');
    } finally {
      globalThis.document = originalDoc;
      globalThis.window = originalWindow;
    }
  });
});

describe('AudioEngine Seeking Methods', () => {
  it('getCurrentTime, getDuration, seek, and seekRelative function properly', async () => {
    const { AudioEngine } = await import('../js/audio-engine.js');
    const engine = new AudioEngine();

    // With no active audio element
    assert.equal(engine.getCurrentTime(), 0);
    assert.equal(engine.getDuration(), 0);

    // Mock active audio element
    engine.currentAudioElement = {
      currentTime: 10,
      duration: 100,
      play: () => Promise.resolve(),
      pause: () => {}
    };

    assert.equal(engine.getCurrentTime(), 10);
    assert.equal(engine.getDuration(), 100);

    // Absolute seek
    engine.seek(45);
    assert.equal(engine.currentAudioElement.currentTime, 45);

    // Clamp to bounds
    engine.seek(-10);
    assert.equal(engine.currentAudioElement.currentTime, 0);

    engine.seek(150);
    assert.equal(engine.currentAudioElement.currentTime, 100);

    // Relative seek
    engine.currentAudioElement.currentTime = 50;
    engine.seekRelative(-5);
    assert.equal(engine.currentAudioElement.currentTime, 45);

    engine.seekRelative(10);
    assert.equal(engine.currentAudioElement.currentTime, 55);

    // Defensive validation tests
    engine.currentAudioElement.currentTime = 42;
    engine.seek('invalid');
    assert.equal(engine.currentAudioElement.currentTime, 42, 'Invalid string should not modify currentTime');

    engine.seek(NaN);
    assert.equal(engine.currentAudioElement.currentTime, 42, 'NaN should not modify currentTime');

    engine.seek(undefined);
    assert.equal(engine.currentAudioElement.currentTime, 42, 'undefined should not modify currentTime');

    engine.seek('70');
    assert.equal(engine.currentAudioElement.currentTime, 70, 'Numeric string should be parsed and applied');
  });
});

describe('Scrubber Modal Markup and Styling', () => {
  it('index.html contains #scrubber-modal with all required controls and attributes', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.match(html, /id="scrubber-modal"/, 'Must contain #scrubber-modal');
    assert.match(html, /id="scrubber-backdrop"/, 'Must contain #scrubber-backdrop');
    assert.match(html, /id="scrubber-title"/, 'Must contain #scrubber-title');
    assert.match(html, /id="btn-close-scrubber"/, 'Must contain #btn-close-scrubber');
    assert.match(html, /id="scrubber-time-current"/, 'Must contain #scrubber-time-current');
    assert.match(html, /id="scrubber-time-duration"/, 'Must contain #scrubber-time-duration');
    assert.match(html, /id="scrubber-slider"/, 'Must contain #scrubber-slider');
    assert.match(html, /id="btn-scrub-back"[^>]*aria-label="5 Sekunden zurückspulen"/, '#btn-scrub-back must have aria-label');
    assert.match(html, /id="btn-scrub-fwd"[^>]*aria-label="5 Sekunden vorspulen"/, '#btn-scrub-fwd must have aria-label');

    // Header now-playing should have button role and tabindex
    assert.match(html, /id="header-now-playing"[^>]*role="button"/, '#header-now-playing must have role="button"');
    assert.match(html, /id="header-now-playing"[^>]*tabindex="0"/, '#header-now-playing must have tabindex="0"');
  });

  it('css/app.css styles #scrubber-modal, .scrubber-card, and range slider', () => {
    const cssPath = path.join(rootDir, 'css/app.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.scrubber-modal/, 'CSS must define .scrubber-modal');
    assert.match(css, /\.scrubber-card/, 'CSS must define .scrubber-card');
    assert.match(css, /\.scrubber-slider/, 'CSS must define .scrubber-slider');
    assert.match(css, /\.btn-scrub-step/, 'CSS must define .btn-scrub-step');
    assert.match(css, /\.header-now-playing:focus-visible[\s\S]*?outline:\s*2px solid var\(--flame-red\)/, 'focus-visible must have flame-red outline');
    assert.match(css, /\.header-now-playing:focus-visible[\s\S]*?outline-offset:\s*2px/, 'focus-visible must have outline-offset');
    assert.match(css, /\.scrubber-slider[\s\S]*?padding:\s*8px 0/, '.scrubber-slider must have padding');
    assert.match(css, /\.scrubber-slider[\s\S]*?touch-action:\s*manipulation/, '.scrubber-slider must have touch-action: manipulation');
  });
});

describe('Scrubber Modal Controller Lifecycle', () => {
  it('formatTime formats seconds into M:SS correctly', async () => {
    const { formatTime } = await import('../js/app.js');
    assert.equal(formatTime(0), '0:00');
    assert.equal(formatTime(5), '0:05');
    assert.equal(formatTime(65), '1:05');
    assert.equal(formatTime(125.7), '2:05');
    assert.equal(formatTime(null), '0:00');
    assert.equal(formatTime(NaN), '0:00');
  });

  it('openScrubberModal and closeScrubberModal toggle modal state and sync timer', async () => {
    const modalEl = { style: { display: 'none' }, setAttribute: () => {} };
    const titleEl = { textContent: '' };
    const curTimeEl = { textContent: '' };
    const durTimeEl = { textContent: '' };
    const sliderEl = { value: 0 };
    const headerEl = { focusCalled: false, focus() { this.focusCalled = true; } };
    const closeBtnEl = { focusCalled: false, focus() { this.focusCalled = true; } };

    const originalDoc = globalThis.document;
    try {
      globalThis.document = {
        readyState: 'loading',
        addEventListener: () => {},
        getElementById(id) {
          if (id === 'scrubber-modal') return modalEl;
          if (id === 'scrubber-title') return titleEl;
          if (id === 'scrubber-time-current') return curTimeEl;
          if (id === 'scrubber-time-duration') return durTimeEl;
          if (id === 'scrubber-slider') return sliderEl;
          if (id === 'header-now-playing') return headerEl;
          if (id === 'btn-close-scrubber') return closeBtnEl;
          return null;
        },
        querySelectorAll: () => []
      };

      const app = await import(`../js/app.js?t=${Date.now()}`);
      app.openScrubberModal();
      assert.equal(modalEl.style.display, 'flex');
      assert.equal(closeBtnEl.focusCalled, true, 'Should focus close button on openScrubberModal');

      app.closeScrubberModal();
      assert.equal(modalEl.style.display, 'none');
      assert.equal(headerEl.focusCalled, true, 'Should return focus to header-now-playing on close');
    } finally {
      globalThis.document = originalDoc;
    }
  });

  it('setupEventListeners attaches scrubber modal events and auto-closes on track stop/end', async () => {
    const app = await import(`../js/app.js?t=${Date.now()}`);
    const originalDoc = globalThis.document;
    const originalWindow = globalThis.window;

    const listeners = {};
    const registerListener = (el, event, fn) => {
      if (!listeners[el]) listeners[el] = {};
      listeners[el][event] = fn;
    };

    const makeEl = (id) => ({
      id,
      addEventListener(event, fn) { registerListener(id, event, fn); },
      style: { display: 'none' },
      setAttribute() {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      value: '0',
      focusCalled: false,
      focus() { this.focusCalled = true; }
    });

    const elements = {
      'scrubber-modal': makeEl('scrubber-modal'),
      'scrubber-backdrop': makeEl('scrubber-backdrop'),
      'btn-close-scrubber': makeEl('btn-close-scrubber'),
      'header-now-playing': makeEl('header-now-playing'),
      'scrubber-slider': makeEl('scrubber-slider'),
      'btn-scrub-back': makeEl('btn-scrub-back'),
      'btn-scrub-fwd': makeEl('btn-scrub-fwd'),
      'scrubber-time-current': makeEl('scrubber-time-current'),
      'scrubber-time-duration': makeEl('scrubber-time-duration'),
      'scrubber-title': makeEl('scrubber-title')
    };

    try {
      globalThis.document = {
        readyState: 'loading',
        getElementById(id) {
          return elements[id] || null;
        },
        querySelectorAll: () => [],
        addEventListener(event, fn) { registerListener('document', event, fn); }
      };
      globalThis.window = {
        addEventListener(event, fn) { registerListener('window', event, fn); }
      };

      app.setupEventListeners();

      // Check header-now-playing click opens modal if track is active
      assert.equal(typeof listeners['header-now-playing']?.['click'], 'function');
      assert.equal(typeof listeners['header-now-playing']?.['keydown'], 'function');

      // Click when no track is active does not open
      app.audioEngine.currentTrack = null;
      listeners['header-now-playing']['click']();
      assert.equal(elements['scrubber-modal'].style.display, 'none');

      // Click when track is active opens modal
      app.audioEngine.currentTrack = { id: 't1', cleanTitle: 'Test Song' };
      listeners['header-now-playing']['click']();
      assert.equal(elements['scrubber-modal'].style.display, 'flex');

      // Keydown Space opens modal when track active
      elements['scrubber-modal'].style.display = 'none';
      let defaultPrevented = false;
      listeners['header-now-playing']['keydown']({ key: ' ', preventDefault() { defaultPrevented = true; } });
      assert.equal(elements['scrubber-modal'].style.display, 'flex');
      assert.equal(defaultPrevented, true);

      // Check close triggers
      assert.equal(typeof listeners['btn-close-scrubber']?.['click'], 'function');
      assert.equal(typeof listeners['scrubber-backdrop']?.['click'], 'function');
      assert.equal(typeof listeners['document']?.['keydown'], 'function');

      // Close button closes modal
      listeners['btn-close-scrubber']['click']();
      assert.equal(elements['scrubber-modal'].style.display, 'none');

      // Escape key closes modal
      elements['scrubber-modal'].style.display = 'flex';
      listeners['document']['keydown']({ key: 'Escape' });
      assert.equal(elements['scrubber-modal'].style.display, 'none');

      // Check slider and quick scrub buttons
      assert.equal(typeof listeners['scrubber-slider']?.['input'], 'function');
      assert.equal(typeof listeners['scrubber-slider']?.['change'], 'function');
      assert.equal(typeof listeners['btn-scrub-back']?.['click'], 'function');
      assert.equal(typeof listeners['btn-scrub-fwd']?.['click'], 'function');

      // Slider input updates preview
      app.audioEngine.currentAudioElement = { currentTime: 10, duration: 200 };
      listeners['scrubber-slider']['input']({ target: { value: '50' } });
      assert.equal(elements['scrubber-time-current'].textContent, '1:40'); // 50% of 200s = 100s -> 1:40

      // Slider change seeks and commits
      listeners['scrubber-slider']['change']({ target: { value: '75' } });
      assert.equal(app.audioEngine.getCurrentTime(), 150); // 75% of 200s = 150s

      // -5s and +5s step buttons
      listeners['btn-scrub-back']['click']();
      assert.equal(app.audioEngine.getCurrentTime(), 145);

      listeners['btn-scrub-fwd']['click']();
      assert.equal(app.audioEngine.getCurrentTime(), 150);

      // Verify isUserScrubbing resets on modal close and open
      listeners['scrubber-slider']['input']({ target: { value: '80' } });
      assert.equal(app.isUserScrubbing, true, 'isUserScrubbing should be true during drag');

      app.closeScrubberModal();
      assert.equal(app.isUserScrubbing, false, 'closeScrubberModal should reset isUserScrubbing to false');

      listeners['scrubber-slider']['input']({ target: { value: '85' } });
      assert.equal(app.isUserScrubbing, true, 'isUserScrubbing should be true during drag');

      app.openScrubberModal();
      assert.equal(app.isUserScrubbing, false, 'openScrubberModal should reset isUserScrubbing to false');

      // Simulate track stop auto-closing modal
      elements['scrubber-modal'].style.display = 'flex';
      app.audioEngine.onTrackStop();
      assert.equal(elements['scrubber-modal'].style.display, 'none');

      // Simulate track end auto-closing modal
      elements['scrubber-modal'].style.display = 'flex';
      app.audioEngine.onTrackEnd();
      assert.equal(elements['scrubber-modal'].style.display, 'none');
    } finally {
      globalThis.document = originalDoc;
      globalThis.window = originalWindow;
    }
  });
});



