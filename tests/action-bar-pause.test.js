import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('pause buttons are titled Pause 1 through Pause 4 and are laid out in 2×2 grid', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="btn-pause-1"[\s\S]*?Pause 1/);
  assert.match(html, /id="btn-pause-2"[\s\S]*?Pause 2/);
  assert.match(html, /id="btn-pause-3"[\s\S]*?Pause 3/);
  assert.match(html, /id="btn-pause-4"[\s\S]*?Pause 4/);

  const css = fs.readFileSync('css/app.css', 'utf8');
  // Pause slots rendered as 2×2 grid
  assert.match(css, /\.pause-slots-group[\s\S]*?display:\s*grid/);
  assert.match(css, /\.pause-slots-group[\s\S]*?grid-template-columns:\s*1fr 1fr/);
  // Pause slot button min-width (now smaller since grid handles layout)
  assert.match(css, /\.pause-slot-btn[\s\S]*?min-width:\s*clamp\(\s*[34][0-9]px/);
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


