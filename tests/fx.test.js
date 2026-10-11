import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const HTML_PATH = 'index.html';
const CSS_PATH = 'css/app.css';

test('index.html contains #fx-overlay container with pointer-events: none', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.ok(html.includes('id="fx-overlay"'), 'index.html must contain #fx-overlay');
  assert.ok(html.includes('class="fx-overlay"'), 'index.html must contain .fx-overlay');
});

test('js/app.js exports triggerAceAnimation and triggerBlockAnimation functions', async () => {
  const { triggerAceAnimation, triggerBlockAnimation } = await import('../js/app.js');
  assert.equal(typeof triggerAceAnimation, 'function', 'triggerAceAnimation must be exported');
  assert.equal(typeof triggerBlockAnimation, 'function', 'triggerBlockAnimation must be exported');
});

test('triggerAceAnimation creates flame effect elements inside overlay', async () => {
  const { triggerAceAnimation } = await import('../js/app.js');
  const originalDoc = globalThis.document;

  let appendedChild = null;
  const mockOverlay = {
    appendChild: (el) => {
      appendedChild = el;
      return el;
    },
    querySelectorAll: () => []
  };

  globalThis.document = {
    getElementById: (id) => (id === 'fx-overlay' ? mockOverlay : null),
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        innerHTML: '',
        style: {},
        classList: {
          add: (...cls) => { el.className += ' ' + cls.join(' '); },
          remove: () => {}
        },
        remove: () => {},
        appendChild: () => {}
      };
      return el;
    }
  };

  try {
    const el = triggerAceAnimation();
    assert.ok(el, 'triggerAceAnimation should return created animation element');
    assert.ok(el.className.includes('fx-flame'), 'animation element must have fx-flame class');
    assert.ok(el.innerHTML.includes('ASS'), 'animation element must display ASS text');
  } finally {
    globalThis.document = originalDoc;
  }
});

test('triggerBlockAnimation creates shield effect elements inside overlay', async () => {
  const { triggerBlockAnimation } = await import('../js/app.js');
  const originalDoc = globalThis.document;

  let appendedChild = null;
  const mockOverlay = {
    appendChild: (el) => {
      appendedChild = el;
      return el;
    },
    querySelectorAll: () => []
  };

  globalThis.document = {
    getElementById: (id) => (id === 'fx-overlay' ? mockOverlay : null),
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        innerHTML: '',
        style: {},
        classList: {
          add: (...cls) => { el.className += ' ' + cls.join(' '); },
          remove: () => {}
        },
        remove: () => {},
        appendChild: () => {}
      };
      return el;
    }
  };


  try {
    const el = triggerBlockAnimation();
    assert.ok(el, 'triggerBlockAnimation should return created animation element');
    assert.ok(el.className.includes('fx-shield'), 'animation element must have fx-shield class');
    assert.ok(el.innerHTML.includes('BLOCK'), 'animation element must display BLOCK text');
  } finally {
    globalThis.document = originalDoc;
  }
});

test('css/app.css enlarges quick actions bar by 50% (height >= 88px, buttons >= 70px)', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  // Quick actions bar must be at least 88px - 160px min-height (50% increase from original 60-76px)
  assert.ok(
    css.includes('min-height: clamp(88px') ||
    css.includes('min-height: clamp(90px') ||
    css.includes('min-height: clamp(130px') ||
    css.includes('min-height: 90px') ||
    css.includes('min-height: 96px'),
    'quick actions bar min-height must be scaled up by ~50%'
  );

  // Quick action buttons must be at least 70px - 140px in height (50% increase from original 48-64px)
  assert.ok(
    css.includes('height: clamp(70px') ||
    css.includes('height: clamp(72px') ||
    css.includes('height: clamp(108px') ||
    css.includes('height: 72px'),
    'quick action buttons height must be scaled up by ~50%'
  );
});

test('css/app.css ensures text cannot protrude outside buttons', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  assert.ok(css.includes('.btn-main-text'), 'must style .btn-main-text');
  assert.ok(css.includes('.btn-subtext'), 'must style .btn-subtext');
  assert.ok(css.includes('text-overflow: ellipsis'), 'must prevent text protrusion with text-overflow: ellipsis');
  assert.ok(css.includes('overflow: hidden'), 'must prevent overflow with overflow: hidden');
});

test('css/app.css styles fullscreen fx overlay, flames and shield with pointer-events: none', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  assert.ok(css.includes('.fx-overlay'), 'must define .fx-overlay');
  assert.ok(css.includes('.fx-flame'), 'must define .fx-flame styles');
  assert.ok(css.includes('.fx-shield'), 'must define .fx-shield styles');
  assert.ok(css.includes('pointer-events: none'), 'overlay must have pointer-events: none');
  assert.ok(css.includes('@keyframes fx-flame') || css.includes('@keyframes flame-burst'), 'must define flame animation keyframes');
  assert.ok(css.includes('@keyframes fx-shield') || css.includes('@keyframes shield-impact'), 'must define shield animation keyframes');
});

test('triggerSixSevenAnimation injects 6/7 FX overlay and applies screen-shake class', async () => {
  const { triggerSixSevenAnimation } = await import('../js/app.js');
  assert.equal(typeof triggerSixSevenAnimation, 'function');

  const originalDoc = globalThis.document;
  try {
    const overlay = {
      innerHTML: '',
      appendChild(el) { this.children.push(el); },
      children: []
    };
    const appEl = {
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };

    globalThis.document = {
      getElementById(id) {
        if (id === 'fx-overlay') return overlay;
        if (id === 'app') return appEl;
        return null;
      },
      createElement(tag) {
        return {
          tagName: tag,
          className: '',
          innerHTML: '',
          classList: {
            add() {},
            remove() {}
          },
          remove() {}
        };
      }
    };

    const fx = triggerSixSevenAnimation();
    assert.ok(fx);
    assert.ok(fx.className.includes('fx-sixseven'));
    assert.ok(appEl.classList.contains('screen-shake'));
  } finally {
    globalThis.document = originalDoc;
  }
});

test('css/app.css styles screen-shake and 6/7 fullscreen hype FX', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  assert.ok(css.includes('.screen-shake'), 'must define .screen-shake');
  assert.ok(css.includes('@keyframes screen-shake'), 'must define screen-shake keyframes');
  assert.ok(css.includes('.fx-sixseven-container'), 'must define .fx-sixseven-container');
  assert.ok(css.includes('.fx-sixseven-burst'), 'must define .fx-sixseven-burst');
  assert.ok(css.includes('.fx-sixseven-number'), 'must define .fx-sixseven-number');
});

test('playSixSeven triggers 6/7 animation and screen shake', async () => {
  const { playSixSeven } = await import('../js/app.js');
  const originalDoc = globalThis.document;
  try {
    const overlay = {
      innerHTML: '',
      appendChild(el) { this.children.push(el); },
      children: []
    };
    const appEl = {
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };

    globalThis.document = {
      getElementById(id) {
        if (id === 'fx-overlay') return overlay;
        if (id === 'app') return appEl;
        return null;
      },
      createElement(tag) {
        return {
          tagName: tag,
          className: '',
          innerHTML: '',
          classList: {
            add() {},
            remove() {}
          },
          remove() {}
        };
      }
    };

    playSixSeven();
    assert.ok(appEl.classList.contains('screen-shake'), 'playSixSeven must trigger screen shake');
    assert.ok(overlay.children.length > 0, 'playSixSeven must inject fx container into overlay');
  } finally {
    globalThis.document = originalDoc;
  }
});


