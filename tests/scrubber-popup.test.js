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
