/**
 * SV 1845 Esslingen - Volleyball DJ Soundboard
 * Main Application Controller (js/app.js)
 */

import {
  initDB,
  saveTracks,
  getAllTracks,
  updateTrackPlayCount,
  resetAllPlayCounts,
  clearAllTracks,
  saveSetting,
  getSetting
} from './db.js';

import {
  CATEGORY_DEFS,
  parseTrackFromFilename,
  cleanTrackTitle,
  detectCategory,
  categorizeTracks,
  stripExtension
} from './file-loader.js';

import {
  AudioEngine,
  pickLeastPlayedRandomTrack
} from './audio-engine.js';

import { WakeLockManager } from './wake-lock.js';
import { createDemoSoundpack } from './demo-sounds.js';

// Application State
export const audioEngine = new AudioEngine();
export const wakeLock = new WakeLockManager();

export let allTracks = [];
export let categorized = new Map();
export let currentZoom = 100;
export let isHeaderCollapsed = false;
export let currentSearchQuery = '';
export let activeTriggerBtn = null;

export const COLUMN_IDS = [
  'ass_angriff',
  'block',
  'gegner',
  'sonstiges_1',
  'sonstiges_2',
  'sonstiges_3',
  'spass_extras'
];

/**
 * HTML Escape Helper
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Creates HTML for an individual song button
 */
export function createTrackButtonHtml(track) {
  const isPlaying = audioEngine.getCurrentTrack()?.id === track.id;
  const hasPlayed = typeof track.playCount === 'number' && track.playCount > 0;
  const playingClass = isPlaying ? ' is-playing playing' : '';
  const playedClass = hasPlayed ? ' has-played' : '';
  const playingAttr = isPlaying ? ' data-playing="true"' : '';
  const count = typeof track.playCount === 'number' ? track.playCount : 0;

  return `<button type="button" class="song-btn track-btn${playingClass}${playedClass}" data-track-id="${escapeHtml(track.id)}" data-category="${escapeHtml(track.category)}"${playingAttr} title="${escapeHtml(track.cleanTitle)}">
    <span class="song-title track-title">${escapeHtml(track.cleanTitle)}</span>
    <span class="play-badge" data-count="${count}">${count}</span>
  </button>`;
}

/**
 * Renders all 7 soundboard columns
 */
export function renderColumns() {
  if (typeof document === 'undefined') return;
  for (const catId of COLUMN_IDS) {
    const colElement = document.getElementById(`col-tracks-${catId}`);
    const tracksForCat = categorized.get(catId) || [];

    // Update column count badge in header
    const colSection = document.querySelector(`.soundboard-column[data-category="${catId}"]`);
    if (colSection) {
      const badge = colSection.querySelector('.col-count');
      if (badge) {
        badge.textContent = tracksForCat.length;
      }
    }

    if (colElement) {
      if (tracksForCat.length === 0) {
        colElement.innerHTML = '<div class="column-empty">Keine Songs</div>';
      } else {
        colElement.innerHTML = tracksForCat.map((t) => createTrackButtonHtml(t)).join('');
      }
    }
  }
}

/**
 * Renders the modal drawer for mobile view and full search
 */
export function renderDrawer() {
  if (typeof document === 'undefined') return;
  const drawerContent = document.getElementById('drawer-content');
  if (!drawerContent) return;

  const categoriesToRender = [
    'ass_angriff',
    'block',
    'gegner',
    'sonstiges',
    'spass_extras',
    'timeout',
    'walkon',
    'pause',
    'sixseven'
  ];

  let html = '';
  for (const catId of categoriesToRender) {
    const tracksForCat = categorized.get(catId) || [];
    const def = CATEGORY_DEFS[catId] || { label: catId };

    html += `
      <div class="drawer-category-group" data-category="${escapeHtml(catId)}">
        <div class="drawer-category-header">
          <span>${escapeHtml(def.label)}</span>
          <span class="col-count">${tracksForCat.length}</span>
        </div>
        <div class="drawer-tracks-list">
          ${tracksForCat.length === 0
            ? '<div class="column-empty">Keine Songs</div>'
            : tracksForCat.map((t) => createTrackButtonHtml(t)).join('')
          }
        </div>
      </div>
    `;
  }

  drawerContent.innerHTML = html;
}

/**
 * Updates status badge and pause slot button labels
 */
export function updatePauseSlotsUI() {
  if (typeof document === 'undefined') return;
  const pauseTracks = allTracks.filter(
    (t) => t.category === 'pause' || /_PAUSE\d*$/i.test(t.suffix || '') || /_(?:PAUSE\d*|PAUSENSONG)$/i.test(stripExtension(t.name))
  );

  for (let slot = 1; slot <= 4; slot++) {
    const btn = document.getElementById(`btn-pause-${slot}`);
    if (!btn) continue;
    let track = pauseTracks.find((t) => (t.suffix || '').toUpperCase() === `_PAUSE${slot}`);
    if (!track) {
      track = pauseTracks[slot - 1];
    }
    if (track) {
      btn.title = `Pausensong ${slot}: ${track.cleanTitle}`;
      btn.setAttribute('data-track-id', track.id);
      btn.classList.toggle('has-played', track.playCount > 0);
    } else {
      btn.title = `Pausensong ${slot} (nicht geladen)`;
      btn.removeAttribute('data-track-id');
      btn.classList.remove('has-played');
    }
  }
}

/**
 * Updates status badge in header banner
 */
export function updateStatusBadge() {
  if (typeof document === 'undefined') return;
  const trackCountStatus = document.getElementById('track-count-status');
  if (trackCountStatus) {
    if (allTracks.length === 0) {
      trackCountStatus.textContent = 'Keine Songs geladen';
    } else if (allTracks.length === 1) {
      trackCountStatus.textContent = '1 Song geladen';
    } else {
      trackCountStatus.textContent = `${allTracks.length} Songs geladen`;
    }
  }
}

/**
 * Re-renders the entire UI
 */
export function renderAll() {
  categorized = categorizeTracks(allTracks);
  renderColumns();
  renderDrawer();
  updatePauseSlotsUI();
  updateStatusBadge();

  if (currentSearchQuery) {
    filterTracks(currentSearchQuery);
  }
}

/**
 * Updates DOM playing indicators
 */
export function updatePlayingUI(trackId) {
  if (typeof document === 'undefined') return;
  const allSongButtons = document.querySelectorAll('.song-btn, .track-btn');
  allSongButtons.forEach((btn) => {
    if (trackId && btn.getAttribute('data-track-id') === trackId) {
      btn.classList.add('is-playing', 'playing');
      btn.setAttribute('data-playing', 'true');
    } else {
      btn.classList.remove('is-playing', 'playing');
      btn.removeAttribute('data-playing');
    }
  });

  for (let slot = 1; slot <= 4; slot++) {
    const pauseBtn = document.getElementById(`btn-pause-${slot}`);
    if (pauseBtn) {
      if (trackId && pauseBtn.getAttribute('data-track-id') === trackId) {
        pauseBtn.classList.add('is-playing', 'playing');
      } else {
        pauseBtn.classList.remove('is-playing', 'playing');
      }
    }
  }
}

/**
 * Sets the active trigger button and marks it as playing/pulsing
 */
export function setActiveTriggerButton(btn) {
  if (activeTriggerBtn && activeTriggerBtn !== btn) {
    clearActiveTriggerButton();
  }
  if (typeof btn === 'string' && typeof document !== 'undefined') {
    btn = document.getElementById(btn) || document.querySelector(btn);
  }
  activeTriggerBtn = btn || null;
  if (activeTriggerBtn) {
    if (activeTriggerBtn.classList?.add) {
      activeTriggerBtn.classList.add('is-playing', 'playing');
    }
    if (activeTriggerBtn.setAttribute) {
      activeTriggerBtn.setAttribute('data-playing', 'true');
    }
  }
}

/**
 * Clears the active trigger button and removes playing/pulsing state
 */
export function clearActiveTriggerButton() {
  if (activeTriggerBtn) {
    if (activeTriggerBtn.classList?.remove) {
      activeTriggerBtn.classList.remove('is-playing', 'playing');
    }
    if (activeTriggerBtn.removeAttribute) {
      activeTriggerBtn.removeAttribute('data-playing');
    }
    activeTriggerBtn = null;
  }
  if (typeof document !== 'undefined') {
    const activeBtns = document.querySelectorAll?.(
      '.quick-btn.is-playing, .mobile-quick-btn.is-playing, .pause-slot-btn.is-playing, [data-playing="true"]'
    );
    activeBtns?.forEach?.((el) => {
      el.classList?.remove?.('is-playing', 'playing');
      el.removeAttribute?.('data-playing');
    });
  }
}

/**
 * Updates play count badges in DOM
 */
export function updateTrackDOMPlayCount(trackId, count) {
  if (typeof document === 'undefined') return;
  const matchingButtons = document.querySelectorAll(`[data-track-id="${trackId}"]`);
  matchingButtons.forEach((btn) => {
    btn.classList.add('has-played');
    const badge = btn.querySelector('.play-badge, .play-count');
    if (badge) {
      badge.textContent = count;
      badge.setAttribute('data-count', count);
    }
  });
}

/**
 * Plays a track and records playCount
 */
export async function handlePlayTrack(track) {
  if (!track) return;
  try {
    if (!wakeLock.isActive()) {
      wakeLock.requestLock().catch((err) => console.warn('Wake lock error:', err));
    }

    const isPauseTrack =
      track.category === 'pause' ||
      /_PAUSE\d*$/i.test(track.suffix || '') ||
      /_(?:PAUSE\d*|PAUSENSONG)$/i.test(stripExtension(track.name || ''));
    if (isPauseTrack) {
      showPauseOverlay(track);
    } else {
      hidePauseOverlay();
    }

    await audioEngine.playTrack(track);

    track.playCount = (typeof track.playCount === 'number' ? track.playCount : 0) + 1;
    track.lastPlayed = Date.now();
    await updateTrackPlayCount(track.id, track.playCount);

    updateTrackDOMPlayCount(track.id, track.playCount);
  } catch (err) {
    hidePauseOverlay();
    clearActiveTriggerButton();
    console.error('Error playing track:', err);
  }
}

/**
 * Live search filter
 */
export function filterTracks(query) {
  currentSearchQuery = (query || '').trim().toLowerCase();
  const searchResultsBadge = document.getElementById('search-results-badge');
  const allSongButtons = document.querySelectorAll('.song-btn, .track-btn');
  const btnSearchClear = document.getElementById('btn-search-clear');
  const btnDrawerSearchClear = document.getElementById('btn-drawer-search-clear');

  if (btnSearchClear) {
    btnSearchClear.style.display = currentSearchQuery ? 'flex' : 'none';
  }
  if (btnDrawerSearchClear) {
    btnDrawerSearchClear.style.display = currentSearchQuery ? 'flex' : 'none';
  }

  if (!currentSearchQuery) {
    allSongButtons.forEach((btn) => {
      btn.classList.remove('search-dimmed', 'dimmed', 'search-highlighted', 'highlighted', 'search-hidden');
    });
    if (searchResultsBadge) {
      searchResultsBadge.textContent = '0 Treffer';
    }
    return;
  }

  const matchedTrackIds = new Set();
  allSongButtons.forEach((btn) => {
    const trackId = btn.getAttribute('data-track-id');
    const track = allTracks.find((t) => t.id === trackId);
    const titleText = (btn.querySelector('.song-title, .track-title')?.textContent || '').toLowerCase();
    const trackName = (track?.name || '').toLowerCase();

    if (titleText.includes(currentSearchQuery) || trackName.includes(currentSearchQuery)) {
      btn.classList.remove('search-dimmed', 'dimmed', 'search-hidden');
      btn.classList.add('search-highlighted', 'highlighted');
      if (trackId) {
        matchedTrackIds.add(trackId);
      }
    } else {
      btn.classList.remove('search-highlighted', 'highlighted');
      btn.classList.add('search-dimmed', 'dimmed', 'search-hidden');
    }
  });

  if (searchResultsBadge) {
    searchResultsBadge.textContent = `${matchedTrackIds.size} Treffer`;
  }
}

/**
 * Zoom level adjustment (70% - 120%)
 */
export function applyZoom(val) {
  currentZoom = Math.min(120, Math.max(70, Math.round(val)));
  const zoomDisplay = document.getElementById('zoom-display');
  const columnsGrid = document.getElementById('columns-grid');

  if (zoomDisplay) {
    zoomDisplay.textContent = `${currentZoom}%`;
  }
  if (columnsGrid) {
    columnsGrid.style.transform = `scale(${currentZoom / 100})`;
    columnsGrid.style.transformOrigin = 'top center';
  }
  saveSetting('zoom', currentZoom).catch((err) => console.warn('Save zoom error:', err));
}

/**
 * Master Volume adjustment (0 - 100)
 */
export function applyVolume(val) {
  const vol = Math.min(100, Math.max(0, Number(val)));
  const volumeSlider = document.getElementById('volume-slider');
  const volumeDisplay = document.getElementById('volume-display');

  if (volumeSlider) {
    volumeSlider.value = vol;
  }
  if (volumeDisplay) {
    volumeDisplay.textContent = `${vol}%`;
  }
  audioEngine.setMasterVolume(vol / 100);
  saveSetting('volume', vol).catch((err) => console.warn('Save volume error:', err));
}

/**
 * Header Collapse toggle
 */
export function setHeaderCollapsed(collapsed) {
  isHeaderCollapsed = !!collapsed;
  const headerBanner = document.getElementById('header-banner');
  const mainHeader = document.getElementById('main-header');
  const btnToggleHeader = document.getElementById('btn-toggle-header');

  if (headerBanner) {
    headerBanner.classList.toggle('collapsed', isHeaderCollapsed);
  }
  if (mainHeader) {
    mainHeader.classList.toggle('collapsed', isHeaderCollapsed);
  }
  if (btnToggleHeader) {
    btnToggleHeader.textContent = isHeaderCollapsed ? 'Kopf ein' : 'Kopf aus';
  }
  saveSetting('headerCollapsed', isHeaderCollapsed).catch((err) => console.warn('Save headerCollapsed error:', err));
}

/**
 * Reset all play counts
 */
export async function handleResetCounts() {
  const confirmed = typeof confirm === 'function' ? confirm('Alle Song-Zähler auf 0 zurücksetzen?') : true;
  if (!confirmed) return;

  await resetAllPlayCounts();

  for (const t of allTracks) {
    t.playCount = 0;
  }

  document.querySelectorAll('.play-badge, .play-count').forEach((badge) => {
    badge.textContent = '0';
    badge.setAttribute('data-count', '0');
  });

  document.querySelectorAll('.song-btn, .track-btn').forEach((btn) => {
    btn.classList.remove('has-played');
  });

  for (let slot = 1; slot <= 4; slot++) {
    const pauseBtn = document.getElementById(`btn-pause-${slot}`);
    if (pauseBtn) pauseBtn.classList.remove('has-played');
  }
}

/**
 * Fullscreen toggle
 */
export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch (err) {
    console.warn('Fullscreen toggle failed:', err);
  }
}

/**
 * Quick action handlers
 */
export function playTimeout(triggerBtn) {
  const timeoutTracks = allTracks.filter(
    (t) => t.category === 'timeout' || t.suffix === '_TIMEOUT' || /_TIMEOUT$/i.test(stripExtension(t.name))
  );
  const track = pickLeastPlayedRandomTrack(timeoutTracks);
  if (track) {
    if (triggerBtn) {
      setActiveTriggerButton(triggerBtn);
    } else if (typeof document !== 'undefined') {
      const btn = document.getElementById('btn-timeout');
      if (btn) setActiveTriggerButton(btn);
    }
    handlePlayTrack(track);
  } else {
    clearActiveTriggerButton();
    console.warn('Keine Timeout-Tracks vorhanden');
  }
}

export function playWalkOn(triggerBtn) {
  const walkonTracks = allTracks.filter(
    (t) => t.category === 'walkon' || t.suffix === '_WALKON' || /_(?:WALKON|EINLAUF)$/i.test(stripExtension(t.name))
  );
  const track = pickLeastPlayedRandomTrack(walkonTracks);
  if (track) {
    if (triggerBtn) {
      setActiveTriggerButton(triggerBtn);
    } else if (typeof document !== 'undefined') {
      const btn = document.getElementById('btn-walkon');
      if (btn) setActiveTriggerButton(btn);
    }
    handlePlayTrack(track);
  } else {
    clearActiveTriggerButton();
    console.warn('Keine Walk-On Tracks vorhanden');
  }
}

export function playPauseSlot(slotIndex, triggerBtn) {
  const pauseTracks = allTracks.filter(
    (t) => t.category === 'pause' || /_PAUSE\d*$/i.test(t.suffix || '') || /_(?:PAUSE\d*|PAUSENSONG)$/i.test(stripExtension(t.name))
  );
  let track = pauseTracks.find((t) => (t.suffix || '').toUpperCase() === `_PAUSE${slotIndex}`);
  if (!track) {
    track = pauseTracks[slotIndex - 1];
  }
  if (track) {
    if (triggerBtn) {
      setActiveTriggerButton(triggerBtn);
    } else if (typeof document !== 'undefined') {
      const btn = document.getElementById(`btn-pause-${slotIndex}`);
      if (btn) setActiveTriggerButton(btn);
    }
    showPauseOverlay(track);
    handlePlayTrack(track);
  } else if (pauseTracks.length > 0) {
    const fallback = pickLeastPlayedRandomTrack(pauseTracks);
    if (fallback) {
      if (triggerBtn) {
        setActiveTriggerButton(triggerBtn);
      } else if (typeof document !== 'undefined') {
        const btn = document.getElementById(`btn-pause-${slotIndex}`);
        if (btn) setActiveTriggerButton(btn);
      }
      showPauseOverlay(fallback);
      handlePlayTrack(fallback);
    }
  } else {
    clearActiveTriggerButton();
    console.warn(`Kein Pausensong für Slot ${slotIndex} vorhanden`);
    if (typeof alert === 'function') {
      alert(`Kein Pausensong für Slot ${slotIndex} geladen. Bitte Song mit Suffix _PAUSE${slotIndex} hochladen oder 'Demo-Sounds laden' klicken.`);
    }
  }
}

/**
 * Shows animated hourglass pause overlay over the mediathek during pause tracks
 */
export function showPauseOverlay(track) {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('pause-overlay');
  if (!overlay) return;
  const trackNameEl = document.getElementById('pause-overlay-track-name');
  if (trackNameEl) {
    const title = track?.name || track?.title;
    trackNameEl.textContent = title ? cleanTrackTitle(title) : 'Pausensong läuft...';
  }
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('active');
}

/**
 * Hides animated hourglass pause overlay
 */
export function hidePauseOverlay() {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('pause-overlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

/**
 * Triggers fullscreen hype animation with screen shake on 6/7 action
 */
export function triggerSixSevenAnimation() {
  if (typeof document === 'undefined') return null;
  const overlay = document.getElementById('fx-overlay');
  const appContainer = document.getElementById('app') || document.body;

  if (appContainer?.classList) {
    appContainer.classList.add('screen-shake');
    setTimeout(() => {
      appContainer.classList.remove('screen-shake');
    }, 700);
  }

  // Haptic feedback if supported by browser/device
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
  } catch (_) {}

  if (!overlay) return null;

  overlay.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'fx-sixseven-container fx-sixseven';
  container.innerHTML = `
    <div class="fx-sixseven-burst"></div>
    <div class="fx-sixseven-ring"></div>
    <div class="fx-sixseven-ring-outer"></div>
    <div class="fx-sixseven-content">
      <div class="fx-sixseven-number">6 / 7</div>
      <div class="fx-sixseven-subtitle">HYPE!</div>
    </div>
  `;

  overlay.appendChild(container);

  setTimeout(() => {
    container?.classList?.add('fx-fade-out');
    setTimeout(() => {
      container?.remove?.();
    }, 400);
  }, 1400);

  return container;
}

export function playSixSeven(triggerBtn) {
  triggerSixSevenAnimation();
  const sixSevenTracks = allTracks.filter(
    (t) => t.category === 'sixseven' || t.suffix === '_SIXSEVEN' || /_(?:SIXSEVEN|67)$/i.test(stripExtension(t.name))
  );
  const track = pickLeastPlayedRandomTrack(sixSevenTracks);
  if (track) {
    if (triggerBtn) {
      setActiveTriggerButton(triggerBtn);
    } else if (typeof document !== 'undefined') {
      const btn = document.getElementById('btn-sixseven');
      if (btn) setActiveTriggerButton(btn);
    }
    handlePlayTrack(track);
  } else {
    clearActiveTriggerButton();
    console.warn('Keine 6/7 Tracks vorhanden');
  }
}

/**
 * Triggers fullscreen fiery flame animation on Ace action
 */
export function triggerAceAnimation() {
  if (typeof document === 'undefined') return null;
  const overlay = document.getElementById('fx-overlay');
  if (!overlay) return null;

  overlay.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'fx-flame-container fx-flame';
  container.innerHTML = `
    <div class="fx-flame-vignette"></div>
    <div class="fx-flame-pillar pillar-1"></div>
    <div class="fx-flame-pillar pillar-2"></div>
    <div class="fx-flame-pillar pillar-3"></div>
    <div class="fx-flame-pillar pillar-4"></div>
    <div class="fx-flame-ball">🔥</div>
    <div class="fx-flame-text">🔥 ASS! 🔥</div>
  `;

  overlay.appendChild(container);

  setTimeout(() => {
    container?.classList?.add('fx-fade-out');
    setTimeout(() => {
      container?.remove?.();
    }, 400);
  }, 1400);

  return container;
}

/**
 * Triggers fullscreen defense shield animation on Block action
 */
export function triggerBlockAnimation() {
  if (typeof document === 'undefined') return null;
  const overlay = document.getElementById('fx-overlay');
  if (!overlay) return null;

  overlay.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'fx-shield-container fx-shield';
  container.innerHTML = `
    <div class="fx-shield-barrier"></div>
    <div class="fx-shield-shockwave shockwave-1"></div>
    <div class="fx-shield-shockwave shockwave-2"></div>
    <div class="fx-shield-icon">🛡️</div>
    <div class="fx-shield-text">🛡️ BLOCK! 🛡️</div>
  `;

  overlay.appendChild(container);

  setTimeout(() => {
    container?.classList?.add('fx-fade-out');
    setTimeout(() => {
      container?.remove?.();
    }, 400);
  }, 1400);

  return container;
}


export function playAce(triggerBtn) {
  triggerAceAnimation();
  const aceTracks = allTracks.filter(
    (t) => t.suffix === '_ACE' || /_ACE$/i.test(stripExtension(t.name))
  );
  const track = pickLeastPlayedRandomTrack(aceTracks);
  if (track) {
    if (triggerBtn) {
      setActiveTriggerButton(triggerBtn);
    } else if (typeof document !== 'undefined') {
      const btn = document.getElementById('btn-ace');
      if (btn) setActiveTriggerButton(btn);
    }
    handlePlayTrack(track);
  } else {
    clearActiveTriggerButton();
    console.warn('Keine Ass-Tracks (_ACE) vorhanden');
  }
}

export function playBlock(triggerBtn) {
  triggerBlockAnimation();
  const blockTracks = allTracks.filter(
    (t) => t.category === 'block' || t.suffix === '_BLOCK' || /_BLOCK$/i.test(stripExtension(t.name))
  );
  const track = pickLeastPlayedRandomTrack(blockTracks);
  if (track) {
    if (triggerBtn) {
      setActiveTriggerButton(triggerBtn);
    } else if (typeof document !== 'undefined') {
      const btn = document.getElementById('btn-block');
      if (btn) setActiveTriggerButton(btn);
    }
    handlePlayTrack(track);
  } else {
    clearActiveTriggerButton();
    console.warn('Keine Block-Tracks (_BLOCK) vorhanden');
  }
}


export function playRandomOwn(triggerBtn) {
  const ownTracks = allTracks.filter((t) =>
    ['ass_angriff', 'sonstiges', 'sonstiges_1', 'sonstiges_2', 'sonstiges_3'].includes(t.category)
  );
  const track = pickLeastPlayedRandomTrack(ownTracks);
  if (track) {
    if (triggerBtn) {
      setActiveTriggerButton(triggerBtn);
    } else if (typeof document !== 'undefined') {
      const btn = document.getElementById('btn-random-own');
      if (btn) setActiveTriggerButton(btn);
    }
    handlePlayTrack(track);
  } else {
    clearActiveTriggerButton();
    console.warn('Keine Tracks für eigene Punkte vorhanden');
  }
}

export function playRandomOpponent(triggerBtn) {
  const opponentTracks = allTracks.filter((t) => t.category === 'gegner');
  const track = pickLeastPlayedRandomTrack(opponentTracks);
  if (track) {
    if (triggerBtn) {
      setActiveTriggerButton(triggerBtn);
    } else if (typeof document !== 'undefined') {
      const btn = document.getElementById('btn-random-opponent');
      if (btn) setActiveTriggerButton(btn);
    }
    handlePlayTrack(track);
  } else {
    clearActiveTriggerButton();
    console.warn('Keine Tracks für Gegnerpunkte vorhanden');
  }
}

export function stopAudio() {
  hidePauseOverlay();
  clearActiveTriggerButton();
  audioEngine.stop(2000);
}

export async function handleClearAll() {
  const confirmed = typeof confirm === 'function'
    ? confirm('Möchtest du wirklich alle Songs aus der Liste entfernen?')
    : true;
  if (!confirmed) return;

  await clearAllTracks();
  allTracks = [];
  renderAll();
}

export const APP_VERSION = '1.8.0';

export async function handleCheckUpdate() {
  const updateBtn = typeof document !== 'undefined' ? document.getElementById('btn-check-update') : null;
  if (updateBtn) {
    updateBtn.classList.add('checking');
    updateBtn.disabled = true;
  }

  try {
    let remoteVersion = null;

    // 1. Direct version.json check against server (bypasses any potential SW staleness)
    if (typeof fetch === 'function') {
      try {
        const response = await fetch(`./version.json?_t=${Date.now()}`, {
          cache: 'no-store'
        });
        if (response && response.ok) {
          const data = await response.json();
          if (data && data.version) {
            remoteVersion = data.version;
          }
        }
      } catch (e) {
        // Network error / offline
        console.warn('Could not fetch version.json:', e);
      }
    }

    // 2. Check Service Worker registration
    let swUpdateFound = false;
    let registration = null;

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          if (registration.waiting) {
            swUpdateFound = true;
          } else {
            await registration.update();
            if (registration.waiting || registration.installing) {
              swUpdateFound = true;
            }
          }
        }
      } catch (swErr) {
        console.warn('Service worker update check error:', swErr);
      }
    }

    const versionDiffers = Boolean(remoteVersion && remoteVersion !== APP_VERSION);
    const isUpdateAvailable = versionDiffers || swUpdateFound;

    if (isUpdateAvailable) {
      const newVerLabel = remoteVersion ? ` (Version ${remoteVersion})` : '';
      const doReload = typeof confirm === 'function'
        ? confirm(`Ein neues Update${newVerLabel} ist verfügbar!\n\nJetzt aktualisieren und neu laden?`)
        : true;

      if (doReload) {
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
          window.location.reload();
        } else if (typeof location !== 'undefined' && typeof location.reload === 'function') {
          location.reload();
        }
      }


      return { updateAvailable: true, version: remoteVersion || 'new' };
    } else {
      if (typeof alert === 'function') {
        alert(`Die App ist auf dem neuesten Stand (Version ${APP_VERSION}).`);
      }
      return { updateAvailable: false, version: APP_VERSION };
    }
  } catch (err) {
    console.error('Update check failed:', err);
    if (typeof alert === 'function') {
      alert('Fehler bei der Update-Prüfung: ' + (err.message || err));
    }
    return { updateAvailable: false, error: err };
  } finally {
    if (updateBtn) {
      updateBtn.classList.remove('checking');
      updateBtn.disabled = false;
    }
  }
}


/**
 * Processes list of selected or dropped files
 */
export async function processSelectedFiles(fileList) {
  if (!fileList || fileList.length === 0) return;
  const newTracks = [];
  const existingNames = new Set(allTracks.map((t) => (t.name || '').toLowerCase()));

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const isAudio =
      (file.type && file.type.startsWith('audio/')) ||
      /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(file.name);

    if (!isAudio) continue;

    const lowerName = file.name.toLowerCase();
    if (existingNames.has(lowerName)) {
      continue;
    }
    existingNames.add(lowerName);

    const track = parseTrackFromFilename(file.name, file, file.type);
    newTracks.push(track);
  }

  if (newTracks.length > 0) {
    await saveTracks(newTracks);
    allTracks = await getAllTracks();
    renderAll();
  }
}

/**
 * Loads synthesized demo soundpack into storage and refreshes UI
 */
export async function loadDemoSoundpack() {
  const demoTracks = createDemoSoundpack();
  const existingNames = new Set(allTracks.map((t) => (t.name || '').toLowerCase()));
  const tracksToAdd = demoTracks.filter((t) => !existingNames.has((t.name || '').toLowerCase()));
  if (tracksToAdd.length > 0) {
    await saveTracks(tracksToAdd);
    allTracks = await getAllTracks();
    renderAll();
  }
  return allTracks;
}

/**
 * Initializes DOM listeners and UI bindings
 */
export function setupEventListeners() {
  // AudioEngine lifecycle callbacks
  audioEngine.onTrackStart = (track) => {
    updatePlayingUI(track ? track.id : null);
    const isPause =
      track &&
      (track.category === 'pause' ||
        /_PAUSE[_\s-]?\d*$/i.test(track.suffix || '') ||
        /_(?:PAUSE[_\s-]?\d*|PAUSENSONG)$/i.test(stripExtension(track.name || '')));
    if (isPause) {
      showPauseOverlay(track);
    }
  };
  audioEngine.onTrackStop = () => {
    updatePlayingUI(null);
    hidePauseOverlay();
    clearActiveTriggerButton();
  };
  audioEngine.onTrackEnd = () => {
    updatePlayingUI(null);
    hidePauseOverlay();
    clearActiveTriggerButton();
  };

  // One-time user gesture listener to acquire wake lock on first interaction
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', () => {
      if (!wakeLock.isActive()) {
        wakeLock.requestLock().catch(() => {});
      }
    }, { once: true });
  }

  // Zoom controls
  const btnZoomIn = document.getElementById('zoom-in');
  if (btnZoomIn) btnZoomIn.addEventListener('click', () => applyZoom(currentZoom + 5));

  const btnZoomOut = document.getElementById('zoom-out');
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => applyZoom(currentZoom - 5));

  // Search inputs & clear buttons
  const searchInput = document.getElementById('search-input');
  const drawerSearchInput = document.getElementById('drawer-search-input');
  const btnSearchClear = document.getElementById('btn-search-clear');
  const btnDrawerSearchClear = document.getElementById('btn-drawer-search-clear');

  const onSearchInput = (val) => {
    if (searchInput && searchInput.value !== val) searchInput.value = val;
    if (drawerSearchInput && drawerSearchInput.value !== val) drawerSearchInput.value = val;
    filterTracks(val);
  };

  if (searchInput) {
    searchInput.addEventListener('input', (e) => onSearchInput(e.target.value));
  }

  if (drawerSearchInput) {
    drawerSearchInput.addEventListener('input', (e) => onSearchInput(e.target.value));
  }

  const clearSearch = () => {
    if (searchInput) searchInput.value = '';
    if (drawerSearchInput) drawerSearchInput.value = '';
    filterTracks('');
  };

  if (btnSearchClear) btnSearchClear.addEventListener('click', clearSearch);
  if (btnDrawerSearchClear) btnDrawerSearchClear.addEventListener('click', clearSearch);

  // Master Volume slider
  const volumeSlider = document.getElementById('volume-slider');
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => applyVolume(e.target.value));
  }

  // Header banner toggle button
  const btnToggleHeader = document.getElementById('btn-toggle-header');
  if (btnToggleHeader) {
    btnToggleHeader.addEventListener('click', () => setHeaderCollapsed(!isHeaderCollapsed));
  }

  // Reset play counts button
  const btnResetCounts = document.getElementById('btn-reset-counts');
  if (btnResetCounts) {
    btnResetCounts.addEventListener('click', handleResetCounts);
  }

  // Clear all tracks button
  const btnClearAll = document.getElementById('btn-clear-all');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', handleClearAll);
  }

  // Check update button
  const btnCheckUpdate = document.getElementById('btn-check-update');
  if (btnCheckUpdate) {
    btnCheckUpdate.addEventListener('click', handleCheckUpdate);
  }

  // Fullscreen button
  const btnFullscreen = document.getElementById('btn-fullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', toggleFullscreen);
  }

  // Folder loader button & input
  const btnLoadFolder = document.getElementById('btn-load-folder');
  const fileFolderInput = document.getElementById('file-folder-input');
  if (btnLoadFolder && fileFolderInput) {
    btnLoadFolder.addEventListener('click', () => fileFolderInput.click());
  }
  if (fileFolderInput) {
    fileFolderInput.addEventListener('change', async (e) => {
      await processSelectedFiles(e.target.files);
      fileFolderInput.value = '';
    });
  }

  // Demo soundpack loader button
  const btnLoadDemo = document.getElementById('btn-load-demo');
  if (btnLoadDemo) {
    btnLoadDemo.addEventListener('click', loadDemoSoundpack);
  }

  // Drag and drop overlay handlers on window
  const dropZone = document.getElementById('drop-zone');
  let dragCounter = 0;

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dropZone) dropZone.classList.add('active');
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dropZone) dropZone.classList.add('active');
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (dropZone) dropZone.classList.remove('active');
    }
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (dropZone) dropZone.classList.remove('active');
    if (e.dataTransfer && e.dataTransfer.files) {
      await processSelectedFiles(e.dataTransfer.files);
    }
  });

  // Track button click delegation on main soundboard
  const boardContainer = document.getElementById('board-container');
  if (boardContainer) {
    boardContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.song-btn, .track-btn');
      if (btn) {
        const trackId = btn.getAttribute('data-track-id');
        const track = allTracks.find((t) => t.id === trackId);
        if (track) {
          setActiveTriggerButton(btn);
          handlePlayTrack(track);
        }
      }
    });
  }

  // Track button click delegation on modal drawer
  const drawerContent = document.getElementById('drawer-content');
  if (drawerContent) {
    drawerContent.addEventListener('click', (e) => {
      const btn = e.target.closest('.song-btn, .track-btn');
      if (btn) {
        const trackId = btn.getAttribute('data-track-id');
        const track = allTracks.find((t) => t.id === trackId);
        if (track) {
          setActiveTriggerButton(btn);
          handlePlayTrack(track);
        }
      }
    });
  }

  // Desktop Footer Bar Quick Actions
  const btnTimeout = document.getElementById('btn-timeout');
  if (btnTimeout) btnTimeout.addEventListener('click', () => {
    setActiveTriggerButton(btnTimeout);
    playTimeout(btnTimeout);
  });

  const btnWalkon = document.getElementById('btn-walkon');
  if (btnWalkon) btnWalkon.addEventListener('click', () => {
    setActiveTriggerButton(btnWalkon);
    playWalkOn(btnWalkon);
  });

  for (let slot = 1; slot <= 4; slot++) {
    const slotBtn = document.getElementById(`btn-pause-${slot}`);
    if (slotBtn) {
      slotBtn.addEventListener('click', () => {
        setActiveTriggerButton(slotBtn);
        playPauseSlot(slot, slotBtn);
      });
    }
  }

  const btnSixseven = document.getElementById('btn-sixseven');
  if (btnSixseven) btnSixseven.addEventListener('click', () => {
    setActiveTriggerButton(btnSixseven);
    playSixSeven(btnSixseven);
  });

  const btnAce = document.getElementById('btn-ace');
  if (btnAce) btnAce.addEventListener('click', () => {
    setActiveTriggerButton(btnAce);
    playAce(btnAce);
  });

  const btnBlock = document.getElementById('btn-block');
  if (btnBlock) btnBlock.addEventListener('click', () => {
    setActiveTriggerButton(btnBlock);
    playBlock(btnBlock);
  });

  const btnRandomOwn = document.getElementById('btn-random-own');
  if (btnRandomOwn) btnRandomOwn.addEventListener('click', () => {
    setActiveTriggerButton(btnRandomOwn);
    playRandomOwn(btnRandomOwn);
  });

  const btnRandomOpponent = document.getElementById('btn-random-opponent');
  if (btnRandomOpponent) btnRandomOpponent.addEventListener('click', () => {
    setActiveTriggerButton(btnRandomOpponent);
    playRandomOpponent(btnRandomOpponent);
  });

  const btnStop = document.getElementById('btn-stop');
  if (btnStop) btnStop.addEventListener('click', stopAudio);

  // Mobile Pad Quick Actions
  const btnMobileTimeout = document.getElementById('btn-mobile-timeout');
  if (btnMobileTimeout) btnMobileTimeout.addEventListener('click', () => {
    setActiveTriggerButton(btnMobileTimeout);
    playTimeout(btnMobileTimeout);
  });

  const btnMobileWalkon = document.getElementById('btn-mobile-walkon');
  if (btnMobileWalkon) btnMobileWalkon.addEventListener('click', () => {
    setActiveTriggerButton(btnMobileWalkon);
    playWalkOn(btnMobileWalkon);
  });

  const btnMobilePause = document.getElementById('btn-mobile-pause');
  if (btnMobilePause) btnMobilePause.addEventListener('click', () => {
    setActiveTriggerButton(btnMobilePause);
    playPauseSlot(1, btnMobilePause);
  });

  const btnMobileSixseven = document.getElementById('btn-mobile-sixseven');
  if (btnMobileSixseven) btnMobileSixseven.addEventListener('click', () => {
    setActiveTriggerButton(btnMobileSixseven);
    playSixSeven(btnMobileSixseven);
  });

  const btnMobileAce = document.getElementById('btn-mobile-ace');
  if (btnMobileAce) btnMobileAce.addEventListener('click', () => {
    setActiveTriggerButton(btnMobileAce);
    playAce(btnMobileAce);
  });

  const btnMobileBlock = document.getElementById('btn-mobile-block');
  if (btnMobileBlock) btnMobileBlock.addEventListener('click', () => {
    setActiveTriggerButton(btnMobileBlock);
    playBlock(btnMobileBlock);
  });

  const btnMobileRandomOwn = document.getElementById('btn-mobile-random-own');
  if (btnMobileRandomOwn) btnMobileRandomOwn.addEventListener('click', () => {
    setActiveTriggerButton(btnMobileRandomOwn);
    playRandomOwn(btnMobileRandomOwn);
  });

  const btnMobileRandomOpponent = document.getElementById('btn-mobile-random-opponent');
  if (btnMobileRandomOpponent) btnMobileRandomOpponent.addEventListener('click', () => {
    setActiveTriggerButton(btnMobileRandomOpponent);
    playRandomOpponent(btnMobileRandomOpponent);
  });

  const btnMobileStop = document.getElementById('btn-mobile-stop');
  if (btnMobileStop) btnMobileStop.addEventListener('click', stopAudio);

  // Mobile Drawer Toggle
  const drawer = document.getElementById('all-songs-drawer');
  const btnOpenDrawer = document.getElementById('btn-open-drawer');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');

  if (btnOpenDrawer && drawer) {
    btnOpenDrawer.addEventListener('click', () => {
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
    });
  }

  if (btnCloseDrawer && drawer) {
    btnCloseDrawer.addEventListener('click', () => {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    });
  }
}

/**
 * Registers Service Worker for 100% Offline PWA capability
 */
export function registerServiceWorker() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const register = () => {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch((err) => {
        console.warn('ServiceWorker registration failed:', err);
      });
    };

    if (typeof document !== 'undefined' && document.readyState === 'complete') {
      register();
    } else if (typeof window !== 'undefined') {
      window.addEventListener('load', register);
    } else {
      register();
    }
  }
}

/**
 * Dismisses the startup matchday splash screen with a smooth fade-out.
 */
export function dismissStartupSplash() {
  if (typeof document === 'undefined') return;
  const splash = document.getElementById('startup-splash');
  if (!splash || splash.classList.contains('dismissed')) return;

  splash.classList.add('splash-fade-out', 'dismissed');
  splash.setAttribute('aria-hidden', 'true');

  setTimeout(() => {
    splash.style.display = 'none';
  }, 350);
}

/**
 * Initializes the startup splash animation with auto-dismiss and click-to-skip.
 */
export function initStartupSplash() {
  if (typeof document === 'undefined') return;
  const splash = document.getElementById('startup-splash');
  if (!splash) return;

  // Click or touch anywhere on splash screen skips animation immediately
  splash.addEventListener('click', () => dismissStartupSplash());
  splash.addEventListener('touchend', () => dismissStartupSplash(), { passive: true });

  // Auto-dismiss after 1600ms
  setTimeout(() => {
    dismissStartupSplash();
  }, 1600);
}

/**
 * Main Application Initialization
 */
export async function initApp() {
  initStartupSplash();
  try {
    await initDB();
    allTracks = await getAllTracks();

    // Register offline Service Worker
    registerServiceWorker();

    // Load saved settings
    const savedVolume = await getSetting('volume', 100);
    applyVolume(savedVolume);

    const savedZoom = await getSetting('zoom', 100);
    applyZoom(savedZoom);

    const savedHeaderCollapsed = await getSetting('headerCollapsed', false);
    setHeaderCollapsed(savedHeaderCollapsed);

    // Setup events and render initial state
    setupEventListeners();
    renderAll();
  } catch (err) {
    console.error('Failed to initialize DJ Soundboard app:', err);
  }
}

// Auto-run when DOM is ready in browser
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
