import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('startup splash markup exists in index.html with all branding elements', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="startup-splash"/);
  assert.match(html, /class="splash-badge"/);
  assert.match(html, /src="assets\/logo\.jpg"/);
  assert.match(html, /SV 1845 ESSLINGEN/);
  assert.match(html, /VOLLEYBALL DJ/);
  assert.match(html, /Ready for Matchday/);
  assert.match(html, /class="splash-soundwave"/);
  assert.match(html, /class="splash-skip-hint"/);
});

test('startup splash CSS styling and keyframes are defined', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /#startup-splash[\s\S]*?position:\s*fixed/);
  assert.match(css, /#startup-splash[\s\S]*?z-index:\s*10000/);
  assert.match(css, /\.splash-fade-out[\s\S]*?opacity:\s*0/);
  assert.match(css, /@keyframes splash-pop/);
  assert.match(css, /@keyframes splash-wave/);
  assert.match(css, /@keyframes sw-dance/);
});

test('startup splash defines prefers-reduced-motion: reduce accessibility overrides', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
  assert.match(css, /#startup-splash[\s\S]*?animation:\s*none\s*!important/);
  assert.match(css, /transition:\s*opacity\s*0\.1s\s*ease\s*!important/);
});

test('dismissStartupSplash cancels active timer and sets display = "none" after timeout', async () => {
  const { dismissStartupSplash, initStartupSplash } = await import('../js/app.js');
  assert.equal(typeof dismissStartupSplash, 'function');
  assert.equal(typeof initStartupSplash, 'function');

  const originalDoc = globalThis.document;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalSetTimeout = globalThis.setTimeout;

  let clearedTimerId = null;
  let scheduledDelay = null;
  let scheduledCallback = null;

  try {
    globalThis.clearTimeout = (id) => {
      clearedTimerId = id;
    };

    globalThis.setTimeout = (cb, ms) => {
      scheduledDelay = ms;
      scheduledCallback = cb;
      return 12345;
    };

    const splashEl = {
      classList: {
        classes: new Set(),
        add(...items) { items.forEach(c => this.classes.add(c)); },
        remove(...items) { items.forEach(c => this.classes.delete(c)); },
        contains(c) { return this.classes.has(c); }
      },
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      style: { display: '' },
      listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; }
    };

    globalThis.document = {
      getElementById(id) {
        if (id === 'startup-splash') return splashEl;
        return null;
      }
    };

    initStartupSplash();
    assert.equal(scheduledDelay, 1600, 'Scheduled auto-dismiss timer for 1600ms');

    dismissStartupSplash();
    assert.equal(clearedTimerId, 12345, 'clearTimeout called on active splashTimer');
    assert.ok(splashEl.classList.contains('splash-fade-out'));
    assert.ok(splashEl.classList.contains('dismissed'));
    assert.equal(splashEl.attributes['aria-hidden'], 'true');

    // Verify 350ms hide timeout was scheduled
    assert.equal(scheduledDelay, 350, 'Hide timer scheduled for 350ms');
    assert.equal(typeof scheduledCallback, 'function');

    // Trigger the callback
    scheduledCallback();
    assert.equal(splashEl.style.display, 'none', 'display set to none after timeout callback');
  } finally {
    globalThis.document = originalDoc;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test('keydown listener dismisses splash on Escape, Enter, or Space and removes listener', async () => {
  const { dismissStartupSplash, initStartupSplash } = await import('../js/app.js');

  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;

  try {
    const windowListeners = {};
    let removedEvent = null;
    let removedHandler = null;

    globalThis.window = {
      addEventListener(type, fn) {
        windowListeners[type] = fn;
      },
      removeEventListener(type, fn) {
        removedEvent = type;
        removedHandler = fn;
        if (windowListeners[type] === fn) {
          delete windowListeners[type];
        }
      }
    };

    const splashEl = {
      classList: {
        classes: new Set(),
        add(...items) { items.forEach(c => this.classes.add(c)); },
        remove(...items) { items.forEach(c => this.classes.delete(c)); },
        contains(c) { return this.classes.has(c); }
      },
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      style: { display: '' },
      listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; }
    };

    globalThis.document = {
      getElementById(id) {
        if (id === 'startup-splash') return splashEl;
        return null;
      }
    };

    initStartupSplash();
    assert.ok(typeof windowListeners['keydown'] === 'function', 'keydown listener registered on window');

    // Pressing an unrelated key (e.g. 'KeyA') does not dismiss splash
    windowListeners['keydown']({ key: 'a' });
    assert.equal(splashEl.classList.contains('dismissed'), false, 'Unrelated key does not dismiss splash');

    // Pressing Escape dismisses splash and unhooks listener
    const keyHandler = windowListeners['keydown'];
    keyHandler({ key: 'Escape' });

    assert.ok(splashEl.classList.contains('dismissed'), 'Splash marked dismissed on Escape');
    assert.ok(splashEl.classList.contains('splash-fade-out'), 'Fade-out class added on Escape');
    assert.equal(removedEvent, 'keydown', 'keydown unhooked');
    assert.equal(removedHandler, keyHandler, 'Matching handler unhooked');
  } finally {
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
  }
});

test('dismissStartupSplash cleans up keydown listener even when dismissed via click or timer', async () => {
  const { dismissStartupSplash, initStartupSplash } = await import('../js/app.js');

  const originalDoc = globalThis.document;
  const originalWin = globalThis.window;

  try {
    const windowListeners = {};
    let removedEvent = null;

    globalThis.window = {
      addEventListener(type, fn) {
        windowListeners[type] = fn;
      },
      removeEventListener(type, fn) {
        removedEvent = type;
        delete windowListeners[type];
      }
    };

    const splashEl = {
      classList: {
        classes: new Set(),
        add(...items) { items.forEach(c => this.classes.add(c)); },
        remove(...items) { items.forEach(c => this.classes.delete(c)); },
        contains(c) { return this.classes.has(c); }
      },
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      style: { display: '' },
      listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; }
    };

    globalThis.document = {
      getElementById(id) {
        if (id === 'startup-splash') return splashEl;
        return null;
      }
    };

    initStartupSplash();
    assert.ok(windowListeners['keydown'], 'keydown registered');

    dismissStartupSplash();
    assert.equal(removedEvent, 'keydown', 'keydown listener removed when dismissed directly');
    assert.equal(windowListeners['keydown'], undefined);
  } finally {
    globalThis.document = originalDoc;
    globalThis.window = originalWin;
  }
});
