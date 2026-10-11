/**
 * Filename parser and category mapper for SV 1845 Esslingen DJ Pult
 */

export const CATEGORY_DEFS = {
  // Main columns (7 tablet landscape columns)
  ass_angriff: { id: 'ass_angriff', label: 'Ass / Angriff', color: 'blue', type: 'column' },
  block: { id: 'block', label: 'Block', color: 'magenta', type: 'column' },
  gegner: { id: 'gegner', label: 'Gegner', color: 'red', type: 'column' },
  sonstiges_1: { id: 'sonstiges_1', label: 'Sonstiges', color: 'emerald', type: 'column' },
  sonstiges_2: { id: 'sonstiges_2', label: 'Sonstiges', color: 'emerald', type: 'column' },
  sonstiges_3: { id: 'sonstiges_3', label: 'Sonstiges', color: 'emerald', type: 'column' },
  spass_extras: { id: 'spass_extras', label: 'Spaß & Extras', color: 'purple', type: 'column' },

  // Unified Sonstiges category for drawer / general grouping
  sonstiges: { id: 'sonstiges', label: 'Sonstiges', color: 'emerald', type: 'general' },

  // Quick actions
  ace: { id: 'ace', label: 'Ass (Eigenes Team)', color: 'blue', type: 'quick' },
  timeout: { id: 'timeout', label: 'Timeout', color: 'amber', type: 'quick' },
  walkon: { id: 'walkon', label: 'Walk-On', color: 'blue', type: 'quick' },
  pause: { id: 'pause', label: 'Pausensongs', color: 'slate', type: 'quick' },
  sixseven: { id: 'sixseven', label: '6/7', color: 'orange', type: 'quick' }
};

const SUFFIX_RULES = [
  { regex: /_ACE$/i, category: 'ass_angriff', suffix: '_ACE' },
  { regex: /_(?:HIT|ANGRIFF|ASS)$/i, category: 'ass_angriff', suffix: '_HIT' },
  { regex: /_BLOCK$/i, category: 'block', suffix: '_BLOCK' },
  { regex: /_(?:OPP|GEGNER|OPPONENT)$/i, category: 'gegner', suffix: '_OPP' },
  { regex: /_(?:SONSTIGES\d*|MISC\d*)$/i, category: 'sonstiges', suffix: '_SONSTIGES' },
  { regex: /_(?:FUN|SPASS)$/i, category: 'spass_extras', suffix: '_FUN' },
  { regex: /_TIMEOUT$/i, category: 'timeout', suffix: '_TIMEOUT' },
  { regex: /_(?:WALKON|EINLAUF)$/i, category: 'walkon', suffix: '_WALKON' },
  { regex: /_PAUSE1$/i, category: 'pause', suffix: '_PAUSE1' },
  { regex: /_PAUSE2$/i, category: 'pause', suffix: '_PAUSE2' },
  { regex: /_PAUSE3$/i, category: 'pause', suffix: '_PAUSE3' },
  { regex: /_PAUSE4$/i, category: 'pause', suffix: '_PAUSE4' },
  { regex: /_(?:PAUSE|PAUSENSONG)$/i, category: 'pause', suffix: '_PAUSE' },
  { regex: /_(?:SIXSEVEN|67)$/i, category: 'sixseven', suffix: '_SIXSEVEN' }
];

export function stripExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot > 0) {
    return filename.substring(0, lastDot);
  }
  return filename;
}

export function detectCategory(filename) {
  const baseName = stripExtension(filename);
  for (const rule of SUFFIX_RULES) {
    if (rule.regex.test(baseName)) {
      return { category: rule.category, suffix: rule.suffix };
    }
  }
  return { category: 'sonstiges', suffix: '' };
}

export function cleanTrackTitle(filename) {
  let baseName = stripExtension(filename);
  for (const rule of SUFFIX_RULES) {
    if (rule.regex.test(baseName)) {
      baseName = baseName.replace(rule.regex, '');
      break;
    }
  }
  // Replace underscores and multiple spaces with a single space
  return baseName.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseTrackFromFilename(filename, fileBlob = null, mimeType = 'audio/mpeg') {
  const { category, suffix } = detectCategory(filename);
  const cleanTitle = cleanTrackTitle(filename);
  const id = `track_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id,
    name: filename,
    cleanTitle,
    category,
    suffix,
    playCount: 0,
    lastPlayed: 0,
    blob: fileBlob,
    type: (fileBlob && fileBlob.type) ? fileBlob.type : (mimeType || 'audio/mpeg')
  };
}

export function categorizeTracks(tracks) {
  const map = new Map();
  for (const key of Object.keys(CATEGORY_DEFS)) {
    map.set(key, []);
  }

  // Sort all tracks alphabetically
  const sortedTracks = [...tracks].sort((a, b) =>
    a.cleanTitle.localeCompare(b.cleanTitle, 'de', { sensitivity: 'base' })
  );

  // Round-robin distribution for all Sonstiges / suffix-less tracks across columns 1, 2, and 3
  const miscColumns = ['sonstiges_1', 'sonstiges_2', 'sonstiges_3'];
  let miscIndex = 0;

  for (const track of sortedTracks) {
    const isMisc =
      track.category === 'sonstiges' ||
      track.category === 'no_suffix' ||
      (!track.suffix && (!track.category || track.category.startsWith('sonstiges')));

    if (isMisc) {
      track.category = 'sonstiges';
      const targetCol = miscColumns[miscIndex % 3];
      miscIndex++;
      track.assignedCategory = targetCol;

      map.get('sonstiges').push(track);
      map.get(targetCol).push(track);
    } else {
      const target = map.has(track.category) ? track.category : 'sonstiges';
      if (target === 'sonstiges') {
        track.category = 'sonstiges';
        const targetCol = miscColumns[miscIndex % 3];
        miscIndex++;
        track.assignedCategory = targetCol;
        map.get('sonstiges').push(track);
        map.get(targetCol).push(track);
      } else {
        map.get(target).push(track);
        if (track.suffix === '_ACE' && map.has('ace')) {
          map.get('ace').push(track);
        }
      }
    }
  }

  // Ensure individual category arrays are sorted
  for (const [key, list] of map.entries()) {
    list.sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle, 'de', { sensitivity: 'base' }));
  }

  return map;
}
