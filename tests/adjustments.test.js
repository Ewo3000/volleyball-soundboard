import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCategory,
  categorizeTracks,
  cleanTrackTitle,
  parseTrackFromFilename,
  CATEGORY_DEFS
} from '../js/file-loader.js';
import {
  audioEngine,
  allTracks,
  renderAll,
  filterTracks,
  processSelectedFiles,
  handleClearAll,
  playAce,
  stopAudio
} from '../js/app.js';
import { MemoryStorageEngine, setDefaultStorage } from '../js/db.js';

test('Suffix rules map correctly for newly specified requirements', () => {
  // 1. Gegner suffix = _OPP
  assert.equal(detectCategory('Fehler_OPP.mp3').category, 'gegner');
  assert.equal(detectCategory('Fehler_OPP.mp3').suffix, '_OPP');
  assert.equal(cleanTrackTitle('Fehler_OPP.mp3'), 'Fehler');

  // 2. Ass / Angriff suffixes = _HIT and _ACE
  assert.equal(detectCategory('Spike_HIT.mp3').category, 'ass_angriff');
  assert.equal(detectCategory('Spike_HIT.mp3').suffix, '_HIT');
  assert.equal(cleanTrackTitle('Spike_HIT.mp3'), 'Spike');

  assert.equal(detectCategory('Winner_ACE.mp3').category, 'ass_angriff');
  assert.equal(detectCategory('Winner_ACE.mp3').suffix, '_ACE');
  assert.equal(cleanTrackTitle('Winner_ACE.mp3'), 'Winner');

  // 3. Pausensongs suffixes = _PAUSE1..4
  for (let i = 1; i <= 4; i++) {
    const res = detectCategory(`Break_PAUSE${i}.wav`);
    assert.equal(res.category, 'pause');
    assert.equal(res.suffix, `_PAUSE${i}`);
    assert.equal(cleanTrackTitle(`Break_PAUSE${i}.wav`), 'Break');
  }

  // 4. Songs without suffix map to single category 'sonstiges'
  assert.equal(detectCategory('Freestyle_Song.mp3').category, 'sonstiges');
  assert.equal(detectCategory('Freestyle_Song.mp3').suffix, '');
  assert.equal(cleanTrackTitle('Freestyle_Song.mp3'), 'Freestyle Song');
});

test('categorizeTracks distributes suffix-less songs evenly across sonstiges 1, 2, 3', () => {
  const tracks = [
    parseTrackFromFilename('Song_A.mp3'),
    parseTrackFromFilename('Song_B.mp3'),
    parseTrackFromFilename('Song_C.mp3'),
    parseTrackFromFilename('Song_D.mp3'),
    parseTrackFromFilename('Song_E.mp3'),
    parseTrackFromFilename('Song_F.mp3')
  ];

  const map = categorizeTracks(tracks);

  assert.equal(map.get('sonstiges').length, 6, 'sonstiges should contain all 6 tracks');
  assert.equal(map.get('sonstiges_1').length, 2, 'sonstiges_1 should receive 2 tracks');
  assert.equal(map.get('sonstiges_2').length, 2, 'sonstiges_2 should receive 2 tracks');
  assert.equal(map.get('sonstiges_3').length, 2, 'sonstiges_3 should receive 2 tracks');
});

test('categorizeTracks maps _ACE tracks to both ass_angriff and ace quick action', () => {
  const tracks = [
    parseTrackFromFilename('Spike_HIT.mp3'),
    parseTrackFromFilename('Service_ACE.mp3')
  ];

  const map = categorizeTracks(tracks);

  assert.equal(map.get('ass_angriff').length, 2, 'ass_angriff contains both HIT and ACE');
  assert.equal(map.get('ace').length, 1, 'ace contains strictly ACE track');
  assert.equal(map.get('ace')[0].suffix, '_ACE');
});

test('processSelectedFiles prevents duplicate files from being imported repeatedly', async () => {
  const memoryDb = new MemoryStorageEngine();
  await memoryDb.init();
  setDefaultStorage(memoryDb);

  const file1 = { name: 'Track_One_HIT.mp3', type: 'audio/mpeg' };
  const file1Duplicate = { name: 'track_one_hit.mp3', type: 'audio/mpeg' }; // different casing
  const file2 = { name: 'Track_Two_BLOCK.mp3', type: 'audio/mpeg' };

  // First import with two different files
  await processSelectedFiles([file1, file2]);
  let stored = await memoryDb.getAllTracks();
  assert.equal(stored.length, 2, 'should import 2 distinct tracks');

  // Attempt to re-import existing file
  await processSelectedFiles([file1Duplicate]);
  stored = await memoryDb.getAllTracks();
  assert.equal(stored.length, 2, 're-import of duplicate file must be ignored');

  // Import batch containing duplicates within itself
  const file3 = { name: 'Track_Three_OPP.mp3', type: 'audio/mpeg' };
  const file3Dupe = { name: 'Track_Three_OPP.mp3', type: 'audio/mpeg' };
  await processSelectedFiles([file3, file3Dupe]);
  stored = await memoryDb.getAllTracks();
  assert.equal(stored.length, 3, 'in-batch duplicates must be deduplicated');
});

test('stopAudio fades out with 1.0 second (1000ms) duration', () => {
  let capturedFade = null;
  const originalStop = audioEngine.stop;
  audioEngine.stop = (duration) => {
    capturedFade = duration;
  };

  try {
    stopAudio();
    assert.equal(capturedFade, 1000, 'STOP fade-out duration must be exactly 1000ms (1 second)');
  } finally {
    audioEngine.stop = originalStop;
  }
});

test('filterTracks adds .search-hidden to non-matching songs and updates clear button visibility', () => {
  const originalDoc = globalThis.document;

  const mockClearBtn = { style: { display: 'none' } };
  const mockDrawerClearBtn = { style: { display: 'none' } };
  const mockBadge = { textContent: '' };

  const buttonClasses = new Map([
    ['btn1', new Set()],
    ['btn2', new Set()]
  ]);

  const mockButtons = [
    {
      getAttribute: (attr) => (attr === 'data-track-id' ? 'id_spike' : null),
      querySelector: () => ({ textContent: 'Monster Spike' }),
      classList: {
        add: (...cls) => cls.forEach((c) => buttonClasses.get('btn1').add(c)),
        remove: (...cls) => cls.forEach((c) => buttonClasses.get('btn1').delete(c))
      }
    },
    {
      getAttribute: (attr) => (attr === 'data-track-id' ? 'id_defense' : null),
      querySelector: () => ({ textContent: 'Great Defense' }),
      classList: {
        add: (...cls) => cls.forEach((c) => buttonClasses.get('btn2').add(c)),
        remove: (...cls) => cls.forEach((c) => buttonClasses.get('btn2').delete(c))
      }
    }
  ];

  globalThis.document = {
    getElementById: (id) => {
      if (id === 'btn-search-clear') return mockClearBtn;
      if (id === 'btn-drawer-search-clear') return mockDrawerClearBtn;
      if (id === 'search-results-badge') return mockBadge;
      return null;
    },
    querySelectorAll: (sel) => (sel === '.song-btn, .track-btn' ? mockButtons : [])
  };

  try {
    // 1. Search for 'Spike'
    filterTracks('Spike');
    assert.equal(mockClearBtn.style.display, 'flex', 'clear button must be visible when query is present');
    assert.equal(buttonClasses.get('btn1').has('search-highlighted'), true, 'matching song must be highlighted');
    assert.equal(buttonClasses.get('btn1').has('search-hidden'), false, 'matching song must NOT be hidden');
    assert.equal(buttonClasses.get('btn2').has('search-hidden'), true, 'non-matching song must have search-hidden');

    // 2. Clear query
    filterTracks('');
    assert.equal(mockClearBtn.style.display, 'none', 'clear button must be hidden when query is empty');
    assert.equal(buttonClasses.get('btn1').has('search-hidden'), false, 'hidden class must be removed when cleared');
    assert.equal(buttonClasses.get('btn2').has('search-hidden'), false, 'hidden class must be removed when cleared');
  } finally {
    globalThis.document = originalDoc;
  }
});
