import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Fullscreen Startup Configuration', () => {
  it('manifest.webmanifest specifies display: fullscreen', () => {
    const manifestPath = path.join(rootDir, 'manifest.webmanifest');
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(content.display, 'fullscreen', 'display property must be fullscreen');
  });
});

describe('Header Now-Playing Markup and Styles', () => {
  it('index.html contains #header-now-playing inside #header-banner between brand and actions', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.match(html, /id="header-now-playing"/, 'Must contain #header-now-playing');
    assert.match(html, /class="now-playing-bars"/, 'Must contain .now-playing-bars');
    assert.match(html, /class="np-bar np-bar-1"/, 'Must contain np-bar-1');
    assert.match(html, /class="np-bar np-bar-4"/, 'Must contain np-bar-4');
    assert.match(html, /id="now-playing-title"/, 'Must contain #now-playing-title');
    assert.match(html, /style="display:\s*none;?"/, 'Must be initially hidden with display: none');

    const brandIndex = html.indexOf('class="brand-group"');
    const npIndex = html.indexOf('id="header-now-playing"');
    const actionsIndex = html.indexOf('class="banner-actions"');
    assert.ok(brandIndex < npIndex && npIndex < actionsIndex, '#header-now-playing must be between brand-group and banner-actions');
  });

  it('css/app.css defines equalizer animation and styling for header now-playing', () => {
    const cssPath = path.join(rootDir, 'css/app.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.header-now-playing/, 'CSS must define .header-now-playing');
    assert.match(css, /@keyframes np-equalizer-dance/, 'CSS must define @keyframes np-equalizer-dance');
    assert.match(css, /\.now-playing-bars/, 'CSS must style .now-playing-bars');
    assert.match(css, /\.np-bar/, 'CSS must style .np-bar');
    assert.match(css, /prefers-reduced-motion/, 'CSS must support prefers-reduced-motion for .np-bar');
  });
});

describe('Header Now-Playing JavaScript Lifecycle', () => {
  it('updateNowPlayingHeader displays active song title and shows element', async () => {
    // Setup minimal DOM mock
    const container = {
      style: { display: 'none' },
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };
    const titleEl = { textContent: '', title: '' };

    const originalDoc = global.document;
    try {
      global.document = {
        readyState: 'loading',
        addEventListener: () => {},
        getElementById(id) {
          if (id === 'header-now-playing') return container;
          if (id === 'now-playing-title') return titleEl;
          return null;
        },
        querySelectorAll: () => []
      };

      const app = await import(`../js/app.js?t=${Date.now()}`);

      // Call with track
      app.updateNowPlayingHeader({ name: '01_Seven_Nation_Army_ANGRIFF.mp3', cleanTitle: 'Seven Nation Army' });
      assert.equal(container.style.display, 'flex');
      assert.equal(container.classList.contains('is-active'), true);
      assert.equal(titleEl.textContent, 'Seven Nation Army');
      assert.equal(titleEl.title, 'Seven Nation Army');

      // Call with null / stop
      app.updateNowPlayingHeader(null);
      assert.equal(container.style.display, 'none');
      assert.equal(container.classList.contains('is-active'), false);
      assert.equal(titleEl.textContent, '');
      assert.equal(titleEl.title, '');
    } finally {
      global.document = originalDoc;
    }
  });

  it('updateNowPlayingHeader formats title using cleanTrackTitle when cleanTitle is missing', async () => {
    const container = {
      style: { display: 'none' },
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };
    const titleEl = { textContent: '', title: '' };

    const originalDoc = global.document;
    try {
      global.document = {
        readyState: 'loading',
        addEventListener: () => {},
        getElementById(id) {
          if (id === 'header-now-playing') return container;
          if (id === 'now-playing-title') return titleEl;
          return null;
        },
        querySelectorAll: () => []
      };

      const app = await import(`../js/app.js?t=${Date.now()}`);

      app.updateNowPlayingHeader({ name: 'Song_ACE.mp3' });
      assert.equal(container.style.display, 'flex');
      assert.equal(container.classList.contains('is-active'), true);
      assert.equal(titleEl.textContent, 'Song');
      assert.equal(titleEl.title, 'Song');
    } finally {
      global.document = originalDoc;
    }
  });

  it('updatePlayingUI updates the header now-playing banner', async () => {
    const container = {
      style: { display: 'none' },
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };
    const titleEl = { textContent: '', title: '' };

    const originalDoc = global.document;
    try {
      global.document = {
        readyState: 'loading',
        addEventListener: () => {},
        getElementById(id) {
          if (id === 'header-now-playing') return container;
          if (id === 'now-playing-title') return titleEl;
          return null;
        },
        querySelectorAll: () => []
      };

      const app = await import(`../js/app.js?t=${Date.now()}`);

      const testTrack = { id: 'test-123', name: '03_Hyped_HIT.mp3', cleanTitle: 'Hyped' };
      app.allTracks.length = 0;
      app.allTracks.push(testTrack);

      app.updatePlayingUI('test-123');
      assert.equal(container.style.display, 'flex');
      assert.equal(container.classList.contains('is-active'), true);
      assert.equal(titleEl.textContent, 'Hyped');
      assert.equal(titleEl.title, 'Hyped');

      app.updatePlayingUI(null);
      assert.equal(container.style.display, 'none');
      assert.equal(container.classList.contains('is-active'), false);
      assert.equal(titleEl.textContent, '');
      assert.equal(titleEl.title, '');
    } finally {
      global.document = originalDoc;
    }
  });

  it('audioEngine callbacks invoke updateNowPlayingHeader lifecycle correctly', async () => {
    const container = {
      style: { display: 'none' },
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };
    const titleEl = { textContent: '', title: '' };

    const originalDoc = global.document;
    const originalWin = global.window;
    try {
      global.window = {
        addEventListener() {}
      };
      global.document = {
        readyState: 'loading',
        addEventListener: () => {},
        getElementById(id) {
          if (id === 'header-now-playing') return container;
          if (id === 'now-playing-title') return titleEl;
          return null;
        },
        querySelectorAll: () => [],
        addEventListener: () => {}
      };

      const app = await import(`../js/app.js?t=${Date.now()}`);
      app.setupEventListeners();

      const testTrack = { id: 'track-cb', name: 'Callback_Test_ACE.mp3', cleanTitle: 'Callback Test' };

      // onTrackStart
      app.audioEngine.onTrackStart(testTrack);
      assert.equal(container.style.display, 'flex');
      assert.equal(titleEl.textContent, 'Callback Test');
      assert.equal(titleEl.title, 'Callback Test');

      // onTrackStop
      app.audioEngine.onTrackStop();
      assert.equal(container.style.display, 'none');
      assert.equal(titleEl.textContent, '');
      assert.equal(titleEl.title, '');

      // onTrackStart again
      app.audioEngine.onTrackStart(testTrack);
      assert.equal(container.style.display, 'flex');

      // onTrackEnd
      app.audioEngine.onTrackEnd();
      assert.equal(container.style.display, 'none');
      assert.equal(titleEl.textContent, '');
      assert.equal(titleEl.title, '');
    } finally {
      global.document = originalDoc;
      global.window = originalWin;
    }
  });
});

