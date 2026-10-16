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

test('dismissStartupSplash adds splash-fade-out and hides splash screen', async () => {
  const { dismissStartupSplash, initStartupSplash } = await import('../js/app.js');
  assert.equal(typeof dismissStartupSplash, 'function');
  assert.equal(typeof initStartupSplash, 'function');

  const originalDoc = globalThis.document;
  try {
    const splashEl = {
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
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
    assert.ok(splashEl.listeners['click'], 'Click listener registered on splash');
    assert.ok(splashEl.listeners['touchend'], 'Touchend listener registered on splash');

    dismissStartupSplash();
    assert.ok(splashEl.classList.contains('splash-fade-out'));
    assert.equal(splashEl.attributes['aria-hidden'], 'true');
  } finally {
    globalThis.document = originalDoc;
  }
});

