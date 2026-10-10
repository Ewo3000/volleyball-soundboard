/**
 * Filename parser and category mapper for SV 1845 Esslingen DJ Pult
 */

export const CATEGORY_DEFS = {
  // Main columns
  ass_angriff: { id: 'ass_angriff', label: 'Ass / Angriff', color: 'blue', type: 'column' },
  block: { id: 'block', label: 'Block', color: 'magenta', type: 'column' },
  gegner: { id: 'gegner', label: 'Gegner', color: 'red', type: 'column' },
  sonstiges_1: { id: 'sonstiges_1', label: 'Sonstiges 1', color: 'emerald', type: 'column' },
  sonstiges_2: { id: 'sonstiges_2', label: 'Sonstiges 2', color: 'emerald', type: 'column' },
  sonstiges_3: { id: 'sonstiges_3', label: 'Sonstiges 3', color: 'emerald', type: 'column' },
  spass_extras: { id: 'spass_extras', label: 'Spaß & Extras', color: 'purple', type: 'column' },

  // Quick actions
  timeout: { id: 'timeout', label: 'Timeout', color: 'amber', type: 'quick' },
  walkon: { id: 'walkon', label: 'Walk-On', color: 'blue', type: 'quick' },
  pause: { id: 'pause', label: 'Pausensongs', color: 'slate', type: 'quick' },
  sixseven: { id: 'sixseven', label: '6/7', color: 'orange', type: 'quick' }
};

const SUFFIX_RULES = [
  { regex: /_(?:HIT|ANGRIFF|ASS)$/i, category: 'ass_angriff', suffix: '_HIT' },
  { regex: /_BLOCK$/i, category: 'block', suffix: '_BLOCK' },
  { regex: /_(?:GEGNER|OPPONENT)$/i, category: 'gegner', suffix: '_GEGNER' },
  { regex: /_(?:SONSTIGES1|MISC1)$/i, category: 'sonstiges_1', suffix: '_SONSTIGES1' },
  { regex: /_(?:SONSTIGES2|MISC2)$/i, category: 'sonstiges_2', suffix: '_SONSTIGES2' },
  { regex: /_(?:SONSTIGES3|MISC3)$/i, category: 'sonstiges_3', suffix: '_SONSTIGES3' },
  { regex: /_(?:FUN|SPASS)$/i, category: 'spass_extras', suffix: '_FUN' },
  { regex: /_TIMEOUT$/i, category: 'timeout', suffix: '_TIMEOUT' },
  { regex: /_(?:WALKON|EINLAUF)$/i, category: 'walkon', suffix: '_WALKON' },
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
  return { category: 'sonstiges_1', suffix: '' };
}

export function cleanTrackTitle(filename) {
  let baseName = stripExtension(filename);
  for (const rule of SUFFIX_RULES) {
    baseName = baseName.replace(rule.regex, '');
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

  for (const track of tracks) {
    const list = map.get(track.category) || map.get('sonstiges_1');
    list.push(track);
  }

  // Sort tracks alphabetically inside each category
  for (const [key, list] of map.entries()) {
    list.sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle, 'de', { sensitivity: 'base' }));
  }

  return map;
}
