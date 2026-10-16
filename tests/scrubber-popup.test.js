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
    assert.match(html, /id="btn-scrub-back"/, 'Must contain #btn-scrub-back');
    assert.match(html, /id="btn-scrub-fwd"/, 'Must contain #btn-scrub-fwd');

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
  });
});


