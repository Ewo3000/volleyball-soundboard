import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const CSS_PATH = 'css/app.css';

test('css/app.css exists and is non-empty', () => {
  assert.ok(fs.existsSync(CSS_PATH), 'css/app.css must exist');
  const content = fs.readFileSync(CSS_PATH, 'utf8');
  assert.ok(content.length > 500, 'css/app.css should contain substantial styling');
});

test('css/app.css defines required brand and category colors', () => {
  const content = fs.readFileSync(CSS_PATH, 'utf8');
  const upper = content.toUpperCase();

  // Dark slate background
  assert.ok(upper.includes('#0B0F17'), 'must contain dark slate background #0B0F17');
  // SV 1845 Esslingen Club Blue
  assert.ok(upper.includes('#1B75BC'), 'must contain club blue #1B75BC');
  // Flame Red
  assert.ok(upper.includes('#E53935'), 'must contain flame red #E53935');
  // Emerald Green for Sonstiges 1, 2, 3
  assert.ok(upper.includes('#10B981') || upper.includes('#059669'), 'must contain emerald green #10B981 or #059669');
  // Purple for Spaß & Extras
  assert.ok(upper.includes('#8E24AA') || upper.includes('#9333EA'), 'must contain purple #8E24AA or #9333EA');
  // Amber for Timeout
  assert.ok(upper.includes('#F59E0B'), 'must contain amber #F59E0B for timeout');
  // Orange for 6/7
  assert.ok(upper.includes('#EA580C'), 'must contain orange #EA580C for 6/7');
  // Indigo for random points
  assert.ok(upper.includes('#4338CA') || upper.includes('#4F46E5'), 'must contain indigo #4338CA or #4F46E5');
  // Signal Red for Stop
  assert.ok(upper.includes('#DC2626'), 'must contain signal red #DC2626 for stop');
});

test('css/app.css defines responsive layouts and mobile query', () => {
  const content = fs.readFileSync(CSS_PATH, 'utf8');
  assert.ok(content.includes('@media (max-width: 768px)') || content.includes('@media(max-width:768px)') || content.includes('@media (max-width:768px)'), 'must include max-width: 768px media query');
  // 7 column grid in tablet landscape
  assert.ok(content.includes('grid-template-columns') || content.includes('columns'), 'must specify grid layout');
});

test('css/app.css defines touch ergonomics, active playing glow, and zoom container', () => {
  const content = fs.readFileSync(CSS_PATH, 'utf8');
  assert.ok(content.includes('touch-action: manipulation') || content.includes('touch-action:manipulation'), 'must specify touch-action: manipulation');
  assert.ok(content.includes('user-select: none') || content.includes('user-select:none'), 'must specify user-select: none');
  assert.ok(content.includes('@keyframes'), 'must define keyframes animation for playing pulse/glow');
  assert.ok(content.includes('transform-origin'), 'must configure zoom container transform-origin');
});
