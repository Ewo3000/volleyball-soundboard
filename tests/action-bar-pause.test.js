import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('pause buttons are titled with coffee emoji ☕ Pause 1 through ☕ Pause 4', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="btn-pause-1"[\s\S]*?☕ Pause 1/);
  assert.match(html, /id="btn-pause-2"[\s\S]*?☕ Pause 2/);
  assert.match(html, /id="btn-pause-3"[\s\S]*?☕ Pause 3/);
  assert.match(html, /id="btn-pause-4"[\s\S]*?☕ Pause 4/);
});

test('pause buttons are laid out in 2×2 grid with doubled min-width', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  // Pause slots rendered as 2×2 grid
  assert.match(css, /\.pause-slots-group[\s\S]*?display:\s*grid/);
  assert.match(css, /\.pause-slots-group[\s\S]*?grid-template-columns:\s*1fr 1fr/);
  // Pause slot button min-width doubled to at least 88px
  assert.match(css, /\.pause-slot-btn[\s\S]*?min-width:\s*clamp\(\s*88px/);
});

test('pause hourglass overlay exists in DOM and functions are exported in js/app.js', async () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="pause-overlay"/);
  assert.match(html, /class="pause-hourglass-icon"/);
  assert.match(html, /Satzpause/);

  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.pause-overlay/);
  assert.match(css, /hourglass/i);

  const { showPauseOverlay, hidePauseOverlay } = await import('../js/app.js');
  assert.equal(typeof showPauseOverlay, 'function');
  assert.equal(typeof hidePauseOverlay, 'function');
});

test('pause hourglass overlay has full container dimensions and high z-index', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.pause-overlay[\s\S]*?width:\s*100%/);
  assert.match(css, /\.pause-overlay[\s\S]*?height:\s*100%/);
  assert.match(css, /\.pause-overlay[\s\S]*?z-index:\s*450/);
});

test('showPauseOverlay activates overlay immediately even if requestAnimationFrame is present', async () => {
  const { showPauseOverlay } = await import('../js/app.js');
  const originalDocument = globalThis.document;
  const originalRAF = globalThis.requestAnimationFrame;

  try {
    let rafCalled = false;
    globalThis.requestAnimationFrame = (cb) => {
      rafCalled = true;
      // Intentionally do not invoke cb immediately to test synchronous activation
      return 1;
    };

    const overlay = {
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k]; }
    };

    globalThis.document = {
      getElementById(id) {
        if (id === 'pause-overlay') return overlay;
        return null;
      }
    };

    showPauseOverlay({ name: 'Test_PAUSE1.mp3' });
    assert.ok(overlay.classList.contains('active'), 'active class should be added immediately');
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalRAF;
  }
});

test('audioEngine.onTrackStart calls showPauseOverlay for pause tracks', async () => {
  const { setupEventListeners, audioEngine } = await import('../js/app.js');
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  try {
    const overlay = {
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k]; }
    };
    const trackNameEl = { textContent: '' };

    globalThis.window = {
      addEventListener() {}
    };

    globalThis.document = {
      getElementById(id) {
        if (id === 'pause-overlay') return overlay;
        if (id === 'pause-overlay-track-name') return trackNameEl;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener() {}
    };

    setupEventListeners();
    assert.equal(typeof audioEngine.onTrackStart, 'function');

    // Trigger onTrackStart with a pause track
    audioEngine.onTrackStart({ id: 'p1', name: 'Song_PAUSE1.mp3', category: 'pause' });
    assert.ok(overlay.classList.contains('active'), 'overlay should be active when pause track starts');

    // Trigger onTrackStart with a non-pause track
    overlay.classList.remove('active');
    audioEngine.onTrackStart({ id: 'a1', name: 'Ace_ACE.mp3', category: 'ass_angriff' });
    assert.ok(!overlay.classList.contains('active'), 'overlay should not be active for non-pause track');
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test('playPauseSlot alerts when no pause tracks are loaded', async () => {
  const { playPauseSlot, allTracks } = await import('../js/app.js');
  const originalDocument = globalThis.document;
  const originalAlert = globalThis.alert;

  try {
    // Clear allTracks temporarily
    const previousTracks = allTracks.splice(0, allTracks.length);

    let alertedMessage = null;
    globalThis.alert = (msg) => {
      alertedMessage = msg;
    };
    globalThis.document = {
      getElementById() { return null; }
    };

    playPauseSlot(1);
    assert.ok(alertedMessage && alertedMessage.includes('Kein Pausensong für Slot 1 geladen'));

    // Restore tracks
    allTracks.push(...previousTracks);
  } finally {
    globalThis.document = originalDocument;
    globalThis.alert = originalAlert;
  }
});

test('showPauseOverlay and hidePauseOverlay manipulate DOM elements correctly', async () => {
  const { showPauseOverlay, hidePauseOverlay } = await import('../js/app.js');
  
  const originalDocument = globalThis.document;
  try {
    const overlay = {
      style: { display: '' },
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k]; }
    };
    const trackNameEl = { textContent: '' };

    globalThis.document = {
      getElementById(id) {
        if (id === 'pause-overlay') return overlay;
        if (id === 'pause-overlay-track-name') return trackNameEl;
        return null;
      }
    };

    showPauseOverlay({ name: 'Track01_PAUSE1.mp3' });
    // Overlay uses CSS visibility now; aria-hidden is set to false
    assert.equal(overlay.getAttribute('aria-hidden'), 'false');
    assert.ok(trackNameEl.textContent.includes('Track01'));

    hidePauseOverlay();
    assert.equal(overlay.getAttribute('aria-hidden'), 'true');
    assert.ok(!overlay.classList.contains('active'));
  } finally {
    globalThis.document = originalDocument;
  }
});

test('css applies pulse-playing-glow to quick-btn and mobile-quick-btn when is-playing', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.quick-btn\.is-playing[\s\S]*?pulse-playing-glow/);
});

test('setActiveTriggerButton and clearActiveTriggerButton manage active trigger state', async () => {
  const { setActiveTriggerButton, clearActiveTriggerButton } = await import('../js/app.js');
  assert.equal(typeof setActiveTriggerButton, 'function');
  assert.equal(typeof clearActiveTriggerButton, 'function');

  const btn = {
    classList: {
      classes: new Set(),
      add(...cs) { cs.forEach((c) => this.classes.add(c)); },
      remove(...cs) { cs.forEach((c) => this.classes.delete(c)); },
      contains(c) { return this.classes.has(c); }
    },
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    removeAttribute(k) { delete this.attributes[k]; },
    getAttribute(k) { return this.attributes[k]; }
  };

  setActiveTriggerButton(btn);
  assert.ok(btn.classList.contains('is-playing'));
  assert.ok(btn.classList.contains('playing'));
  assert.equal(btn.getAttribute('data-playing'), 'true');

  clearActiveTriggerButton();
  assert.ok(!btn.classList.contains('is-playing'));
  assert.ok(!btn.classList.contains('playing'));
  assert.equal(btn.getAttribute('data-playing'), undefined);
});

test('css minimizes grid padding and enlarges action buttons by 50%', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /#columns-grid[\s\S]*?padding:[\s\S]*?[4-8]px/);
  // Action bar enlarged to clamp(130px...
  assert.match(css, /#quick-actions-bar[\s\S]*?min-height:\s*clamp\(\s*130px/);
  // Main quick buttons enlarged to clamp(108px...
  assert.match(css, /\.quick-btn[\s\S]*?height:\s*clamp\(\s*108px/);
  // Pause slot buttons are half height (2-row grid)
  assert.match(css, /\.pause-slot-btn[\s\S]*?height:\s*clamp\(\s*5[0-9]px/);
  // Stacked buttons (Timeout/Walk-On) are half height
  assert.match(css, /\.stacked-btn[\s\S]*?height:\s*clamp\(\s*5[0-9]px/);
  // STOP button full height
  assert.match(css, /\.btn-stop[\s\S]*?height:\s*clamp\(\s*108px/);
  // Mobile stop button accessible above pause overlay
  assert.match(css, /\.mobile-stop-btn[\s\S]*?z-index:\s*450/);
  // Stacked group lays out column direction
  assert.match(css, /\.stacked-group[\s\S]*?flex-direction:\s*column/);
  // Pause slots use 2x2 CSS grid
  assert.match(css, /\.pause-slots-group[\s\S]*?grid-template-columns:\s*1fr 1fr/);
});

test('css allows 3-line text wrapping for action buttons', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.quick-btn[\s\S]*?white-space:\s*normal/);
  assert.match(css, /\.btn-main-text[\s\S]*?white-space:\s*normal/);
});

test('timeout and walk-on buttons have doubled min-width in stacked column', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.stacked-btn[\s\S]*?min-width:\s*clamp\(\s*120px/);
});

test('action buttons have +50% width via flex: 2.25', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.quick-btn[\s\S]*?flex:\s*2\.25/);
  assert.match(css, /\.quick-btn[\s\S]*?min-width:\s*clamp\(\s*75px/);
});

test('action button typography is enlarged per specification', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.quick-btn[\s\S]*?font-size:\s*clamp\(\s*0\.80rem/);
  assert.match(css, /\.stacked-btn[\s\S]*?font-size:\s*clamp\(\s*0\.95rem/);
  assert.match(css, /\.pause-slot-btn[\s\S]*?font-size:\s*clamp\(\s*0\.95rem/);
  assert.match(css, /\.stacked-btn[\s\S]*?font-weight:\s*800/);
  assert.match(css, /\.pause-slot-btn[\s\S]*?font-weight:\s*800/);
});




