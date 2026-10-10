import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTrackFromFilename,
  cleanTrackTitle,
  detectCategory,
  categorizeTracks,
  stripExtension,
  CATEGORY_DEFS
} from '../js/file-loader.js';

test('cleanTrackTitle strips extension, suffix, and replaces underscores', () => {
  assert.equal(cleanTrackTitle('Super_Spike_HIT.mp3'), 'Super Spike');
  assert.equal(cleanTrackTitle('Axel_F_BLOCK.wav'), 'Axel F');
  assert.equal(cleanTrackTitle('Seven_Nation_Army_SIXSEVEN.mp3'), 'Seven Nation Army');
  assert.equal(cleanTrackTitle('7_Nation_Army_67.m4a'), '7 Nation Army');
  assert.equal(cleanTrackTitle('Ned_schlecht_FUN.mp3'), 'Ned schlecht');
  assert.equal(cleanTrackTitle('Blue_PAUSE.ogg'), 'Blue');
  assert.equal(cleanTrackTitle('NormalSongWithoutSuffix.mp3'), 'NormalSongWithoutSuffix');
  assert.equal(cleanTrackTitle('Lower_case_hit.mp3'), 'Lower case');
  assert.equal(cleanTrackTitle('Multiple___Underscores___HIT.mp3'), 'Multiple Underscores');
  assert.equal(cleanTrackTitle('Song_with_trailing_spaces_WALKON.mp3'), 'Song with trailing spaces');
});

test('detectCategory maps all suffixes correctly', () => {
  assert.equal(detectCategory('Song_HIT.mp3').category, 'ass_angriff');
  assert.equal(detectCategory('Song_ANGRIFF.mp3').category, 'ass_angriff');
  assert.equal(detectCategory('Song_ASS.mp3').category, 'ass_angriff');
  assert.equal(detectCategory('Song_BLOCK.mp3').category, 'block');
  assert.equal(detectCategory('Song_GEGNER.mp3').category, 'gegner');
  assert.equal(detectCategory('Song_OPPONENT.mp3').category, 'gegner');
  assert.equal(detectCategory('Song_SONSTIGES1.mp3').category, 'sonstiges_1');
  assert.equal(detectCategory('Song_MISC1.mp3').category, 'sonstiges_1');
  assert.equal(detectCategory('Song_SONSTIGES2.mp3').category, 'sonstiges_2');
  assert.equal(detectCategory('Song_MISC2.mp3').category, 'sonstiges_2');
  assert.equal(detectCategory('Song_SONSTIGES3.mp3').category, 'sonstiges_3');
  assert.equal(detectCategory('Song_MISC3.mp3').category, 'sonstiges_3');
  assert.equal(detectCategory('Song_FUN.mp3').category, 'spass_extras');
  assert.equal(detectCategory('Song_SPASS.mp3').category, 'spass_extras');
  assert.equal(detectCategory('Song_TIMEOUT.mp3').category, 'timeout');
  assert.equal(detectCategory('Song_WALKON.mp3').category, 'walkon');
  assert.equal(detectCategory('Song_EINLAUF.mp3').category, 'walkon');
  assert.equal(detectCategory('Song_PAUSE.mp3').category, 'pause');
  assert.equal(detectCategory('Song_PAUSENSONG.mp3').category, 'pause');
  assert.equal(detectCategory('Song_SIXSEVEN.mp3').category, 'sixseven');
  assert.equal(detectCategory('Song_67.mp3').category, 'sixseven');
  // Case-insensitive test
  assert.equal(detectCategory('Song_hit.mp3').category, 'ass_angriff');
  assert.equal(detectCategory('Song_block.mp3').category, 'block');
  // Fallback
  assert.equal(detectCategory('Unknown_Tune.mp3').category, 'sonstiges_1');
  assert.equal(detectCategory('Unknown_Tune.mp3').suffix, '');
});

test('stripExtension correctly strips file extension', () => {
  assert.equal(stripExtension('Song.mp3'), 'Song');
  assert.equal(stripExtension('Song.with.multiple.dots.wav'), 'Song.with.multiple.dots');
  assert.equal(stripExtension('NoExtension'), 'NoExtension');
});

test('parseTrackFromFilename creates properly formatted Track object', () => {
  const dummyBlob = new Uint8Array([1, 2, 3]);
  const track = parseTrackFromFilename('Super_Spike_HIT.mp3', dummyBlob, 'audio/mp3');

  assert.ok(track.id.startsWith('track_'));
  assert.equal(track.name, 'Super_Spike_HIT.mp3');
  assert.equal(track.cleanTitle, 'Super Spike');
  assert.equal(track.category, 'ass_angriff');
  assert.equal(track.suffix, '_HIT');
  assert.equal(track.playCount, 0);
  assert.equal(track.lastPlayed, 0);
  assert.equal(track.blob, dummyBlob);
  assert.equal(track.type, 'audio/mp3');

  // Test defaults
  const defaultTrack = parseTrackFromFilename('Simple.mp3');
  assert.equal(defaultTrack.blob, null);
  assert.equal(defaultTrack.type, 'audio/mpeg');
  assert.equal(defaultTrack.category, 'sonstiges_1');
  assert.equal(defaultTrack.suffix, '');
});

test('categorizeTracks groups array of tracks into categories map and sorts them', () => {
  const tracks = [
    parseTrackFromFilename('Z_Spike_HIT.mp3'),
    parseTrackFromFilename('A_Spike_HIT.mp3'),
    parseTrackFromFilename('Axel_BLOCK.mp3'),
    parseTrackFromFilename('Stereo_GEGNER.mp3'),
    parseTrackFromFilename('Ärger_GEGNER.mp3'),
    parseTrackFromFilename('Unknown.mp3')
  ];
  const map = categorizeTracks(tracks);

  assert.ok(map instanceof Map);
  for (const catKey of Object.keys(CATEGORY_DEFS)) {
    assert.ok(map.has(catKey), `Map must contain category ${catKey}`);
  }

  const hitTracks = map.get('ass_angriff');
  assert.equal(hitTracks.length, 2);
  assert.equal(hitTracks[0].cleanTitle, 'A Spike');
  assert.equal(hitTracks[1].cleanTitle, 'Z Spike');

  const blockTracks = map.get('block');
  assert.equal(blockTracks.length, 1);
  assert.equal(blockTracks[0].cleanTitle, 'Axel');

  const gegnerTracks = map.get('gegner');
  assert.equal(gegnerTracks.length, 2);

  const fallbackTracks = map.get('sonstiges_1');
  assert.equal(fallbackTracks.length, 1);
  assert.equal(fallbackTracks[0].cleanTitle, 'Unknown');
});

test('CATEGORY_DEFS contains expected categories and quick actions', () => {
  assert.equal(CATEGORY_DEFS.ass_angriff.type, 'column');
  assert.equal(CATEGORY_DEFS.block.type, 'column');
  assert.equal(CATEGORY_DEFS.gegner.type, 'column');
  assert.equal(CATEGORY_DEFS.sonstiges_1.type, 'column');
  assert.equal(CATEGORY_DEFS.sonstiges_2.type, 'column');
  assert.equal(CATEGORY_DEFS.sonstiges_3.type, 'column');
  assert.equal(CATEGORY_DEFS.spass_extras.type, 'column');

  assert.equal(CATEGORY_DEFS.timeout.type, 'quick');
  assert.equal(CATEGORY_DEFS.walkon.type, 'quick');
  assert.equal(CATEGORY_DEFS.pause.type, 'quick');
  assert.equal(CATEGORY_DEFS.sixseven.type, 'quick');
});
