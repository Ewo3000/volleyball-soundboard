import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const HTML_PATH = 'index.html';

test('index.html exists and is non-empty', () => {
  assert.ok(fs.existsSync(HTML_PATH), 'index.html must exist');
  const content = fs.readFileSync(HTML_PATH, 'utf8');
  assert.ok(content.length > 500, 'index.html must contain substantial HTML');
});

test('index.html has title and links PWA resources and styles', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');
  assert.ok(content.includes('<title>SV 1845 Esslingen - Volleyball DJ</title>'), 'title must match');
  assert.ok(content.includes('href="manifest.webmanifest"'), 'manifest must be linked');
  assert.ok(content.includes('href="css/app.css"'), 'css/app.css must be linked');
  assert.ok(content.includes('assets/logo.jpg'), 'assets/logo.jpg must be referenced');
  assert.ok(content.includes('src="js/app.js"'), 'js/app.js module script must be linked');
  assert.ok(content.includes('type="module"'), 'script must have type="module"');
});

test('index.html contains Compact Top Bar with all required controls', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  // Zoom controls
  assert.ok(content.includes('id="zoom-out"'), 'must contain #zoom-out');
  assert.ok(content.includes('id="zoom-display"'), 'must contain #zoom-display');
  assert.ok(content.includes('id="zoom-in"'), 'must contain #zoom-in');

  // Live search
  assert.ok(content.includes('id="search-input"'), 'must contain #search-input');
  assert.ok(content.includes('id="search-results-badge"'), 'must contain #search-results-badge');

  // Master Volume
  assert.ok(content.includes('id="volume-slider"'), 'must contain #volume-slider');
  assert.ok(content.includes('id="volume-display"'), 'must contain #volume-display');

  // Control buttons
  assert.ok(content.includes('id="btn-reset-counts"'), 'must contain #btn-reset-counts');
  assert.ok(content.includes('id="btn-fullscreen"'), 'must contain #btn-fullscreen');
  assert.ok(content.includes('id="btn-toggle-header"'), 'must contain #btn-toggle-header');
});

test('index.html contains Collapsible Banner with folder loader and drop zone', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(content.includes('id="header-banner"'), 'must contain #header-banner');
  assert.ok(content.includes('id="btn-load-folder"'), 'must contain #btn-load-folder');
  assert.ok(content.includes('id="file-folder-input"'), 'must contain #file-folder-input');
  assert.ok(content.includes('webkitdirectory'), 'file input must support webkitdirectory');
  assert.ok(content.includes('id="track-count-status"'), 'must contain #track-count-status');
  assert.ok(content.includes('id="drop-zone"'), 'must contain #drop-zone');
  assert.ok(content.includes('SV 1845') && content.includes('VOLLEYBALL DJ'), 'banner title must be present');
});

test('index.html contains Main 7-Column Grid and category track containers', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(content.includes('id="board-container"'), 'must contain #board-container');
  assert.ok(content.includes('id="columns-grid"'), 'must contain #columns-grid');

  const requiredCategories = [
    'ass_angriff',
    'block',
    'gegner',
    'sonstiges_1',
    'sonstiges_2',
    'sonstiges_3',
    'spass_extras'
  ];

  for (const cat of requiredCategories) {
    assert.ok(content.includes(`id="col-tracks-${cat}"`), `must contain #col-tracks-${cat}`);
  }

  assert.ok(content.includes('class="col-count"'), 'must contain .col-count badges');
});

test('index.html contains Quick Action Footer Bar with 4 pause slots and action buttons', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(content.includes('id="quick-actions-bar"'), 'must contain #quick-actions-bar');
  assert.ok(content.includes('id="btn-timeout"'), 'must contain #btn-timeout');
  assert.ok(content.includes('id="btn-walkon"'), 'must contain #btn-walkon');
  assert.ok(content.includes('id="pause-slots-container"'), 'must contain #pause-slots-container');
  assert.ok(content.includes('id="btn-pause-1"'), 'must contain #btn-pause-1');
  assert.ok(content.includes('id="btn-pause-2"'), 'must contain #btn-pause-2');
  assert.ok(content.includes('id="btn-pause-3"'), 'must contain #btn-pause-3');
  assert.ok(content.includes('id="btn-pause-4"'), 'must contain #btn-pause-4');
  assert.ok(content.includes('id="btn-sixseven"'), 'must contain #btn-sixseven');
  assert.ok(content.includes('id="btn-random-own"'), 'must contain #btn-random-own');
  assert.ok(content.includes('id="btn-random-opponent"'), 'must contain #btn-random-opponent');
  assert.ok(content.includes('id="btn-stop"'), 'must contain #btn-stop');
});

test('index.html contains Mobile View and Song Drawer', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(content.includes('id="mobile-view"'), 'must contain #mobile-view');
  assert.ok(content.includes('id="btn-open-drawer"'), 'must contain #btn-open-drawer');

  // Drawer
  assert.ok(content.includes('id="all-songs-drawer"'), 'must contain #all-songs-drawer');
  assert.ok(content.includes('id="drawer-search-input"'), 'must contain #drawer-search-input');
  assert.ok(content.includes('id="btn-close-drawer"'), 'must contain #btn-close-drawer');
  assert.ok(content.includes('id="drawer-content"'), 'must contain #drawer-content');
});

test('js/app.js exports and functions behave correctly', async () => {
  const { escapeHtml, createTrackButtonHtml, COLUMN_IDS } = await import('../js/app.js');

  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(COLUMN_IDS.length, 7);
  assert.deepEqual(COLUMN_IDS, [
    'ass_angriff',
    'block',
    'gegner',
    'sonstiges_1',
    'sonstiges_2',
    'sonstiges_3',
    'spass_extras'
  ]);

  const testTrack = {
    id: 'track_123',
    cleanTitle: 'Ace Serve',
    category: 'ass_angriff',
    playCount: 2
  };

  const buttonHtml = createTrackButtonHtml(testTrack);
  assert.ok(buttonHtml.includes('data-track-id="track_123"'));
  assert.ok(buttonHtml.includes('Ace Serve'));
  assert.ok(buttonHtml.includes('has-played'));
  assert.ok(buttonHtml.includes('data-count="2"'));
});

test('filterTracks dedupes matched songs across grid and drawer', async () => {
  const { filterTracks } = await import('../js/app.js');

  const mockBadge = { textContent: '' };
  const mockBtn1 = {
    getAttribute: (name) => (name === 'data-track-id' ? 'track_abc' : null),
    querySelector: () => ({ textContent: 'Volleyball Anthem' }),
    classList: { add: () => {}, remove: () => {} }
  };
  const mockBtn2 = {
    getAttribute: (name) => (name === 'data-track-id' ? 'track_abc' : null),
    querySelector: () => ({ textContent: 'Volleyball Anthem' }),
    classList: { add: () => {}, remove: () => {} }
  };

  const originalDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => (id === 'search-results-badge' ? mockBadge : null),
    querySelectorAll: (selector) => (selector === '.song-btn, .track-btn' ? [mockBtn1, mockBtn2] : [])
  };

  try {
    filterTracks('Anthem');
    assert.equal(mockBadge.textContent, '1 Treffer', 'badge should count 1 unique track, not 2 buttons');
  } finally {
    globalThis.document = originalDoc;
  }
});

test('index.html contains clear-all and symbol-only check-update buttons', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(content.includes('id="btn-clear-all"'), 'must contain #btn-clear-all');
  assert.ok(content.includes('id="btn-check-update"'), 'must contain #btn-check-update');

  // Verify #btn-check-update contains ONLY the symbol 🔄 without textual label
  const btnUpdateMatch = content.match(/<button[^>]*id="btn-check-update"[^>]*>([\s\S]*?)<\/button>/i);
  assert.ok(btnUpdateMatch, 'btn-check-update button tag found');
  const innerText = btnUpdateMatch[1].trim();
  assert.equal(innerText, '🔄', 'update button must contain strictly the symbol 🔄 without text');
});

test('index.html contains search clear buttons in top bar and drawer', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(content.includes('id="btn-search-clear"'), 'must contain #btn-search-clear');
  assert.ok(content.includes('id="btn-drawer-search-clear"'), 'must contain #btn-drawer-search-clear');
});

test('index.html contains Ass (Eigenes Team) quick button in desktop and mobile', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(content.includes('id="btn-ace"'), 'must contain desktop #btn-ace');
  assert.ok(content.includes('id="btn-mobile-ace"'), 'must contain mobile #btn-mobile-ace');
  assert.ok(content.includes('Ass (Eigenes Team)'), 'must have label Ass (Eigenes Team)');
});

test('index.html columns for Sonstiges are all titled "Sonstiges"', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  // Verify that Sonstiges 1, 2, 3 sections have <h2 class="column-title">Sonstiges</h2>
  const col1Match = content.includes('data-category="sonstiges_1"');
  const col2Match = content.includes('data-category="sonstiges_2"');
  const col3Match = content.includes('data-category="sonstiges_3"');
  assert.ok(col1Match && col2Match && col3Match, 'all 3 sonstiges columns must exist');

  // Should NOT contain "Sonstiges 1", "Sonstiges 2" or "Sonstiges 3" as titles
  assert.ok(!content.includes('<h2 class="column-title">Sonstiges 1</h2>'), 'column-title must not be Sonstiges 1');
  assert.ok(!content.includes('<h2 class="column-title">Sonstiges 2</h2>'), 'column-title must not be Sonstiges 2');
  assert.ok(!content.includes('<h2 class="column-title">Sonstiges 3</h2>'), 'column-title must not be Sonstiges 3');
});

test('index.html contains Block (Eigenes Team) quick button in desktop and mobile', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(content.includes('id="btn-block"'), 'must contain desktop #btn-block');
  assert.ok(content.includes('id="btn-mobile-block"'), 'must contain mobile #btn-mobile-block');
  assert.ok(content.includes('Block'), 'must contain Block button');
});

test('index.html quick action buttons render subtext in parentheses with .btn-subtext', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  // Check presence of .btn-subtext class
  assert.ok(content.includes('class="btn-subtext"'), 'must use .btn-subtext for second line');
  assert.ok(content.includes('(Eigenes Team)'), 'must contain (Eigenes Team) subtext');
  assert.ok(content.includes('(Zufall)'), 'must contain (Zufall) subtext');
});


