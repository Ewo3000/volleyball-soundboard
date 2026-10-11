import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { createDemoSoundpack, generateSineWavBuffer } from '../js/demo-sounds.js';
import { categorizeTracks, CATEGORY_DEFS } from '../js/file-loader.js';
import { MemoryStorageEngine } from '../js/db.js';
import { pickLeastPlayedRandomTrack } from '../js/audio-engine.js';

test('createDemoSoundpack produces valid tracks with WAV binary data', () => {
  const tracks = createDemoSoundpack();

  assert.equal(Array.isArray(tracks), true, 'must return an array of tracks');
  assert.equal(tracks.length, 18, 'must return exactly 18 demo tracks');

  for (const track of tracks) {
    assert.ok(track.id && typeof track.id === 'string', 'track must have an id');
    assert.ok(track.id.startsWith('demo_'), 'track id should start with demo_');
    assert.ok(track.name && track.name.endsWith('.wav'), 'track name must end with .wav');
    assert.ok(track.cleanTitle && track.cleanTitle.length > 0, 'track must have cleanTitle');
    assert.ok(CATEGORY_DEFS[track.category], `category ${track.category} must be in CATEGORY_DEFS`);
    assert.ok(typeof track.suffix === 'string', 'track must have suffix string');
    assert.equal(track.playCount, 0, 'initial playCount must be 0');
    assert.equal(track.lastPlayed, 0, 'initial lastPlayed must be 0');
    assert.equal(track.type, 'audio/wav', 'track type must be audio/wav');
    assert.ok(track.blob, 'track must contain binary audio blob');
  }
});

test('generateSineWavBuffer produces valid RIFF WAV header and data', () => {
  const wavBytes = generateSineWavBuffer({ frequency: 440, duration: 0.2, sampleRate: 8000 });
  assert.ok(wavBytes instanceof Uint8Array, 'must return Uint8Array');

  // Verify RIFF header
  const riff = String.fromCharCode(...wavBytes.slice(0, 4));
  const wave = String.fromCharCode(...wavBytes.slice(8, 12));
  const fmt = String.fromCharCode(...wavBytes.slice(12, 16));
  const data = String.fromCharCode(...wavBytes.slice(36, 40));

  assert.equal(riff, 'RIFF');
  assert.equal(wave, 'WAVE');
  assert.equal(fmt, 'fmt ');
  assert.equal(data, 'data');

  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  assert.equal(sampleRate, 8000);
  assert.equal(bitsPerSample, 8);
});

test('all 7 soundboard columns have tracks from demo soundpack', () => {
  const tracks = createDemoSoundpack();
  const categorized = categorizeTracks(tracks);

  const columnCategories = Object.keys(CATEGORY_DEFS).filter(
    (key) => CATEGORY_DEFS[key].type === 'column'
  );

  assert.equal(columnCategories.length, 7, 'must define 7 column categories');
  assert.deepEqual(columnCategories, [
    'ass_angriff',
    'block',
    'gegner',
    'sonstiges_1',
    'sonstiges_2',
    'sonstiges_3',
    'spass_extras'
  ]);

  for (const catId of columnCategories) {
    const list = categorized.get(catId);
    assert.ok(list && list.length > 0, `Column "${catId}" (${CATEGORY_DEFS[catId].label}) must have at least 1 track`);
  }
});

test('all quick actions have tracks from demo soundpack', () => {
  const tracks = createDemoSoundpack();
  const categorized = categorizeTracks(tracks);

  const quickCategories = Object.keys(CATEGORY_DEFS).filter(
    (key) => CATEGORY_DEFS[key].type === 'quick'
  );

  assert.equal(quickCategories.length, 5, 'must define 5 quick action categories');
  assert.deepEqual(quickCategories, ['ace', 'timeout', 'walkon', 'pause', 'sixseven']);

  for (const catId of quickCategories) {
    const list = categorized.get(catId);
    assert.ok(list && list.length > 0, `Quick action "${catId}" must have at least 1 track`);
  }

  // Specifically check Pausensongs: should have at least 4 tracks for the 4 pause slots
  const pauseTracks = categorized.get('pause');
  assert.ok(pauseTracks.length >= 4, 'Pausensongs should contain at least 4 tracks for pause slots');
});

test('pickLeastPlayedRandomTrack works across demo soundpack categories', () => {
  const tracks = createDemoSoundpack();
  const categorized = categorizeTracks(tracks);

  const assTracks = categorized.get('ass_angriff');
  assert.ok(assTracks.length >= 2, 'ass_angriff should have at least 2 demo tracks');

  // Initial pick when all playCounts are 0
  const picked1 = pickLeastPlayedRandomTrack(assTracks);
  assert.ok(picked1, 'should pick a track');
  assert.equal(assTracks.some((t) => t.id === picked1.id), true);

  // Mark picked1 as played
  picked1.playCount = 1;

  // Next pick must pick the unplayed one
  const picked2 = pickLeastPlayedRandomTrack(assTracks);
  assert.ok(picked2, 'should pick unplayed track');
  assert.notEqual(picked2.id, picked1.id, 'must prioritize unplayed track');
  assert.equal(picked2.playCount, 0);
});

test('storing and retrieving demo tracks from MemoryStorageEngine', async () => {
  const engine = new MemoryStorageEngine();
  await engine.init();

  const demoTracks = createDemoSoundpack();
  await engine.saveTracks(demoTracks);

  const storedTracks = await engine.getAllTracks();
  assert.equal(storedTracks.length, 18, 'storage engine must store all 18 demo tracks');

  // Verify deduplication on re-saving demo soundpack
  await engine.saveTracks(createDemoSoundpack());
  const dedupedTracks = await engine.getAllTracks();
  assert.equal(dedupedTracks.length, 18, 're-saving demo soundpack must update existing tracks without accumulating duplicates');

  // Verify track play count update
  const sampleTrack = storedTracks[0];
  await engine.updateTrackPlayCount(sampleTrack.id, 4);

  const updatedTracks = await engine.getAllTracks();
  const updatedSample = updatedTracks.find((t) => t.id === sampleTrack.id);
  assert.equal(updatedSample.playCount, 4);
  assert.ok(updatedSample.lastPlayed > 0);

  // Verify reset all play counts
  await engine.resetAllPlayCounts();
  const resetTracks = await engine.getAllTracks();
  for (const t of resetTracks) {
    assert.equal(t.playCount, 0, 'all playCounts must be reset to 0');
  }
});

test('index.html contains #btn-load-demo within #header-banner', () => {
  const html = fs.readFileSync('index.html', 'utf8');

  assert.ok(html.includes('id="btn-load-demo"'), 'index.html must contain #btn-load-demo button');
  assert.ok(html.includes('class="btn-load-demo"'), 'button must have .btn-load-demo class');

  // Verify it is placed inside header-banner
  const bannerIndex = html.indexOf('id="header-banner"');
  const bannerEndIndex = html.indexOf('</div>\n\n      <!-- Compact Top Controls Bar -->');
  const btnIndex = html.indexOf('id="btn-load-demo"');

  assert.ok(bannerIndex !== -1 && btnIndex !== -1);
  assert.ok(btnIndex > bannerIndex && (bannerEndIndex === -1 || btnIndex < bannerEndIndex),
    '#btn-load-demo must be positioned within #header-banner'
  );
});

test('loadDemoSoundpack in js/app.js persists to storage and updates UI state', async () => {
  const { loadDemoSoundpack, allTracks, COLUMN_IDS } = await import('../js/app.js');

  assert.equal(typeof loadDemoSoundpack, 'function', 'loadDemoSoundpack should be exported');

  // Setup DOM mock to verify loadDemoSoundpack updates UI elements
  const originalDoc = globalThis.document;
  const originalWindow = globalThis.window;

  const mockElements = new Map();
  const getOrCreateMockEl = (id) => {
    if (!mockElements.has(id)) {
      mockElements.set(id, {
        id,
        innerHTML: '',
        textContent: '',
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        setAttribute: () => {},
        removeAttribute: () => {},
        querySelector: () => ({ textContent: '0' })
      });
    }
    return mockElements.get(id);
  };

  // Populate column elements
  for (const col of COLUMN_IDS) {
    getOrCreateMockEl(`col-tracks-${col}`);
  }
  // Pause slots
  for (let i = 1; i <= 4; i++) {
    getOrCreateMockEl(`btn-pause-${i}`);
  }
  getOrCreateMockEl('track-count-status');
  getOrCreateMockEl('drawer-content');

  globalThis.document = {
    getElementById: (id) => getOrCreateMockEl(id),
    querySelector: (sel) => ({
      querySelector: () => ({ textContent: '0' }),
      classList: { add: () => {}, remove: () => {} }
    }),
    querySelectorAll: () => []
  };
  globalThis.window = {
    addEventListener: () => {}
  };

  try {
    const loaded = await loadDemoSoundpack();
    assert.equal(loaded.length, 18, 'loadDemoSoundpack should return 18 tracks');
    assert.equal(mockElements.get('track-count-status').textContent, '18 Songs geladen');
  } finally {
    globalThis.document = originalDoc;
    globalThis.window = originalWindow;
  }
});

test('mobile view elements and responsive switching are defined', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('css/app.css', 'utf8');

  // Verify mobile elements in HTML
  assert.ok(html.includes('id="mobile-view"'), 'index.html must have #mobile-view');
  assert.ok(html.includes('id="all-songs-drawer"'), 'index.html must have #all-songs-drawer');
  assert.ok(html.includes('id="btn-open-drawer"'), 'index.html must have #btn-open-drawer');
  assert.ok(html.includes('id="btn-close-drawer"'), 'index.html must have #btn-close-drawer');

  // Verify responsive media queries in CSS
  assert.ok(
    css.includes('@media (max-width: 768px)') || css.includes('(orientation: portrait)'),
    'css must have mobile responsive query'
  );
  assert.ok(css.includes('#columns-grid') && css.includes('display: none'), 'mobile CSS should hide grid on small screens');
  assert.ok(css.includes('#mobile-view') && css.includes('display: flex'), 'mobile CSS should display mobile-view on small screens');
});

test('GitHub Pages readiness: index.html has relative asset paths and no hardcoded absolute URLs', () => {
  const html = fs.readFileSync('index.html', 'utf8');

  // Regex to check src and href attributes
  const srcMatches = [...html.matchAll(/\ssrc="([^"]+)"/g)].map((m) => m[1]);
  const hrefMatches = [...html.matchAll(/\shref="([^"]+)"/g)].map((m) => m[1]);

  for (const src of srcMatches) {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      continue;
    }
    assert.ok(!src.startsWith('/'), `Asset src "${src}" must not start with an absolute slash for GitHub Pages compatibility`);
  }

  for (const href of hrefMatches) {
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('data:')) {
      continue;
    }
    assert.ok(!href.startsWith('/'), `Asset href "${href}" must not start with an absolute slash for GitHub Pages compatibility`);
  }

  // Specifically verify critical assets are relative
  assert.ok(html.includes('href="manifest.webmanifest"') || html.includes('href="./manifest.webmanifest"'));
  assert.ok(html.includes('href="css/app.css"') || html.includes('href="./css/app.css"'));
  assert.ok(html.includes('src="js/app.js"') || html.includes('src="./js/app.js"'));
  assert.ok(html.includes('src="assets/logo.jpg"') || html.includes('src="./assets/logo.jpg"'));
});

test('GitHub Pages readiness: manifest.webmanifest has relative URLs and icons', () => {
  const manifestRaw = fs.readFileSync('manifest.webmanifest', 'utf8');
  const manifest = JSON.parse(manifestRaw);

  assert.ok(manifest.start_url, 'manifest must have start_url');
  assert.ok(!manifest.start_url.startsWith('/') || manifest.start_url.startsWith('./'),
    `start_url "${manifest.start_url}" must be relative, not root-relative "/"`
  );

  if (manifest.scope) {
    assert.ok(!manifest.scope.startsWith('/') || manifest.scope.startsWith('./'),
      `scope "${manifest.scope}" must be relative`
    );
  }

  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest must have icons');
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'), `icon src "${icon.src}" must not start with an absolute slash`);
    assert.ok(fs.existsSync(icon.src), `icon file ${icon.src} must exist on disk`);
  }
});

test('GitHub Pages readiness: sw.js caches relative paths and all assets exist on disk', () => {
  const swCode = fs.readFileSync('sw.js', 'utf8');

  // Extract APP_SHELL_ASSETS
  const match = swCode.match(/const APP_SHELL_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, 'sw.js must define APP_SHELL_ASSETS array');

  const assetList = match[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter((s) => s.length > 0);

  assert.ok(assetList.length >= 10, 'sw.js must cache at least 10 core shell assets');

  for (const asset of assetList) {
    if (asset === './') continue;
    assert.ok(!asset.startsWith('/'), `Asset "${asset}" in sw.js must not start with an absolute slash`);
    assert.ok(fs.existsSync(asset), `Asset "${asset}" listed in sw.js must exist on disk`);
  }
});
