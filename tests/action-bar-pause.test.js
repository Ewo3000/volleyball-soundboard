import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('pause buttons are titled Pause 1 through Pause 4 and have doubled min-width', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="btn-pause-1"[\s\S]*?Pause 1/);
  assert.match(html, /id="btn-pause-2"[\s\S]*?Pause 2/);
  assert.match(html, /id="btn-pause-3"[\s\S]*?Pause 3/);
  assert.match(html, /id="btn-pause-4"[\s\S]*?Pause 4/);

  const css = fs.readFileSync('css/app.css', 'utf8');
  // Doubled from original 26px to at least 52px
  assert.match(css, /\.pause-slot-btn[\s\S]*?min-width:\s*clamp\(\s*5[2-6]px/);
});
