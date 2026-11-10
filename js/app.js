/**
 * SV 1845 Esslingen - Volleyball DJ Soundboard
 * Main Application Controller (js/app.js)
 */

import {
  initDB,
  saveTracks,
  getAllTracks,
  updateTrackPlayCount,
  updateTrackGain,
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
  pickLeastPlayedRandomTrack,
  EQ_PRESETS,
  NORM_VERSION
} from './audio-engine.js';

import { WakeLockManager } from './wake-lock.js';
import { createDemoSoundpack } from './demo-sounds.js';
import {
  initTheme,
  toggleTheme,
  setTheme,
  getCurrentTheme,
  THEMES
} from './theme.js';

export { initTheme, toggleTheme, setTheme, getCurrentTheme, THEMES };

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
 * Updates the header Now-Playing banner indicator
 * @param {Object|null} track
 */
export function updateNowPlayingHeader(track) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('header-now-playing');
  const titleEl = document.getElementById('now-playing-title');
  if (!container || !titleEl) return;

  if (track) {
    const title = track.cleanTitle || (typeof cleanTrackTitle === 'function' ? cleanTrackTitle(track.name || '') : track.name || '');
    titleEl.textContent = title;
    titleEl.title = title;
    container.style.display = 'flex';
    container.classList.add('is-active');
  } else {
    container.style.display = 'none';
    container.classList.remove('is-active');
    titleEl.textContent = '';
    titleEl.title = '';
  }
}

/**
 * Scrubber Modal Controller
 */
export let scrubberInterval = null;
export let isUserScrubbing = false;

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function openScrubberModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('scrubber-modal');
  if (!modal) return;

  isUserScrubbing = false;

  const track = audioEngine.currentTrack || (audioEngine.getCurrentTrack ? audioEngine.getCurrentTrack() : null);
  const titleEl = document.getElementById('scrubber-title');
  if (titleEl) {
    titleEl.textContent = track ? (track.cleanTitle || cleanTrackTitle(track.name || '')) : 'Kein Track läuft';
  }

  const gainPercent = track && typeof track.customGain === 'number' && !isNaN(track.customGain)
    ? Math.round(track.customGain * 100)
    : 100;
  const gainSlider = document.getElementById('scrubber-gain-slider');
  const gainValue = document.getElementById('scrubber-gain-value');
  if (gainSlider) gainSlider.value = String(gainPercent);
  if (gainValue) gainValue.textContent = `${gainPercent}%`;

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');

  const closeBtn = document.getElementById('btn-close-scrubber');
  if (closeBtn && typeof closeBtn.focus === 'function') {
    closeBtn.focus();
  }

  syncScrubberUI();
  if (scrubberInterval) clearInterval(scrubberInterval);
  scrubberInterval = setInterval(syncScrubberUI, 150);
}

export function closeScrubberModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('scrubber-modal');
  if (!modal) return;

  isUserScrubbing = false;

  const wasOpen = modal.style.display !== 'none';
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  if (scrubberInterval) {
    clearInterval(scrubberInterval);
    scrubberInterval = null;
  }
  if (wasOpen) {
    const headerBtn = document.getElementById('header-now-playing');
    if (headerBtn && typeof headerBtn.focus === 'function') {
      try {
        headerBtn.focus();
      } catch (_) {}
    }
  }
}

export function syncScrubberUI() {
  if (typeof document === 'undefined' || isUserScrubbing) return;
  const curTime = audioEngine.getCurrentTime();
  const dur = audioEngine.getDuration();

  const curEl = document.getElementById('scrubber-time-current');
  const durEl = document.getElementById('scrubber-time-duration');
  const slider = document.getElementById('scrubber-slider');

  if (curEl) curEl.textContent = formatTime(curTime);
  if (durEl) durEl.textContent = formatTime(dur);
  if (slider && dur > 0) {
    slider.value = ((curTime / dur) * 100).toFixed(1);
  } else if (slider) {
    slider.value = 0;
  }
}

/**
 * Updates DOM playing indicators
 */
export function updatePlayingUI(trackId) {
  if (typeof document === 'undefined') return;
  const track = typeof trackId === 'object' && trackId !== null
    ? trackId
    : (trackId
        ? ((typeof tracks !== 'undefined' && tracks.get ? tracks.get(trackId) : null) ||
           (allTracks && allTracks.find ? allTracks.find((t) => t.id === trackId) : null) ||
           (audioEngine.currentTrack?.id === trackId ? audioEngine.currentTrack : null))
        : null);
  updateNowPlayingHeader(track);

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

    if (
      typeof track.normGain !== 'number' ||
      isNaN(track.normGain) ||
      track.normVersion !== NORM_VERSION
    ) {
      audioEngine
        .analyzeTrackLoudness(track)
        .then((normGain) => {
          if (typeof normGain === 'number' && !isNaN(normGain)) {
            updateTrackGain(track.id, { normGain, normVersion: NORM_VERSION }).catch(() => {});
          }
        })
        .catch(() => {});
    }

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
  audioEngine.setMasterVolume(vol / 100);
  if (typeof document === 'undefined') return;
  const volumeSlider = document.getElementById('volume-slider');
  const volumeDisplay = document.getElementById('volume-display');

  if (volumeSlider) {
    volumeSlider.value = vol;
  }
  if (volumeDisplay) {
    volumeDisplay.textContent = `${vol}%`;
  }
  saveSetting('volume', vol).catch((err) => console.warn('Save volume error:', err));
}

/**
 * Automatic Loudness Normalization toggle
 */
export function applyAutoNormalize(enabled) {
  const isEnabled = Boolean(enabled);
  audioEngine.setAutoNormalize(isEnabled);
  if (typeof document !== 'undefined') {
    const btn = document.getElementById('btn-auto-norm');
    if (btn) {
      if (btn.classList?.toggle) {
        btn.classList.toggle('is-active', isEnabled);
      }
      if (btn.setAttribute) {
        btn.setAttribute('aria-pressed', String(isEnabled));
      }
    }
    const statusText = document.getElementById('auto-norm-status-text');
    if (statusText) {
      statusText.textContent = isEnabled ? 'EIN' : 'AUS';
    }
  }
  saveSetting('autoNormalize', isEnabled).catch((err) => console.warn('Save autoNormalize error:', err));
}

export function toggleAutoNormalize() {
  applyAutoNormalize(!audioEngine.getAutoNormalize());
}

/**
 * Equalizer Preset selection & Sound/EQ Popup Modal Controller
 */
export function applyEqPreset(presetId) {
  const activeId = audioEngine.setEqPreset(presetId);
  const presetObj = EQ_PRESETS[activeId] || EQ_PRESETS.neutral;

  if (typeof document !== 'undefined') {
    const menuBtn = document.getElementById('btn-eq-menu');
    const menuLabel = document.getElementById('eq-menu-label');
    if (menuLabel) {
      menuLabel.textContent = activeId === 'neutral' ? 'Sound / EQ' : `EQ: ${presetObj.name}`;
    }
    if (menuBtn && menuBtn.classList?.toggle) {
      menuBtn.classList.toggle('is-active', activeId !== 'neutral');
    }

    const presetBtns = document.querySelectorAll?.('.eq-preset-btn');
    presetBtns?.forEach?.((btn) => {
      const id = btn.getAttribute?.('data-eq-preset');
      const isSelected = id === activeId;
      btn.classList?.toggle?.('is-active', isSelected);
      btn.setAttribute?.('aria-checked', String(isSelected));
    });
  }

  saveSetting('eqPreset', activeId).catch((err) => console.warn('Save eqPreset error:', err));
  return activeId;
}

export function openEqModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('eq-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');

  const menuBtn = document.getElementById('btn-eq-menu');
  if (menuBtn && menuBtn.setAttribute) {
    menuBtn.setAttribute('aria-expanded', 'true');
  }

  const closeBtn = document.getElementById('btn-close-eq');
  if (closeBtn && typeof closeBtn.focus === 'function') {
    try {
      closeBtn.focus();
    } catch (_) {}
  }
}

export function closeEqModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('eq-modal');
  if (!modal) return;

  const wasOpen = modal.style.display !== 'none';
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');

  const menuBtn = document.getElementById('btn-eq-menu');
  if (menuBtn && menuBtn.setAttribute) {
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  if (wasOpen && menuBtn && typeof menuBtn.focus === 'function') {
    try {
      menuBtn.focus();
    } catch (_) {}
  }
}

/**
 * Per-Track Custom Volume adjustment (20% - 200%)
 */
export async function applyTrackCustomGain(percentVal) {
  const pct = Math.min(200, Math.max(20, Math.round(Number(percentVal) || 100)));
  const customGain = Math.round(pct) / 100;

  if (typeof document !== 'undefined') {
    const gainSlider = document.getElementById('scrubber-gain-slider');
    const gainValue = document.getElementById('scrubber-gain-value');
    if (gainSlider) gainSlider.value = String(pct);
    if (gainValue) gainValue.textContent = `${pct}%`;
  }

  const current = audioEngine.currentTrack || (audioEngine.getCurrentTrack ? audioEngine.getCurrentTrack() : null);
  if (current) {
    current.customGain = customGain;
    const match = allTracks.find((t) => t.id === current.id);
    if (match) match.customGain = customGain;
    audioEngine.updateCurrentTrackGain();
    await updateTrackGain(current.id, { customGain }).catch((err) =>
      console.warn('Failed to save track customGain:', err)
    );
  }
}

let isBackgroundNormalizing = false;

/**
 * Gently analyzes un-normalized tracks in the background one at a time when audio is idle
 */
export async function scheduleBackgroundNormalization() {
  if (isBackgroundNormalizing) return;
  isBackgroundNormalizing = true;
  try {
    for (const track of allTracks) {
      // Never decode full audio buffers on the main AudioContext while a song is actively playing
      if (audioEngine.getCurrentTrack()) {
        break;
      }
      if (
        typeof track.normGain !== 'number' ||
        isNaN(track.normGain) ||
        track.normVersion !== NORM_VERSION
      ) {
        const normGain = await audioEngine.analyzeTrackLoudness(track);
        if (typeof normGain === 'number' && !isNaN(normGain)) {
          await updateTrackGain(track.id, { normGain, normVersion: NORM_VERSION }).catch(() => {});
        }
        await new Promise((r) => setTimeout(r, 80));
      }
    }
  } catch (_) {
    // Ignore background analysis interruptions
  } finally {
    isBackgroundNormalizing = false;
  }
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
    <div class="fx-sixseven-rays"></div>
    <div class="fx-sixseven-ring"></div>
    <div class="fx-sixseven-ring-outer"></div>
    <div class="fx-sixseven-sparks" aria-hidden="true">
      <span class="fx-spark s1"></span>
      <span class="fx-spark s2"></span>
      <span class="fx-spark s3"></span>
      <span class="fx-spark s4"></span>
      <span class="fx-spark s5"></span>
      <span class="fx-spark s6"></span>
      <span class="fx-spark s7"></span>
      <span class="fx-spark s8"></span>
    </div>
    <div class="fx-sixseven-content">
      <div class="fx-sixseven-badge">⚡ MATCHDAY HYPE ⚡</div>
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
    <div class="fx-flame-shockwave"></div>
    <div class="fx-flame-pillar pillar-1"></div>
    <div class="fx-flame-pillar pillar-2"></div>
    <div class="fx-flame-pillar pillar-3"></div>
    <div class="fx-flame-pillar pillar-4"></div>
    <div class="fx-flame-embers" aria-hidden="true">
      <span class="fx-ember e1"></span>
      <span class="fx-ember e2"></span>
      <span class="fx-ember e3"></span>
      <span class="fx-ember e4"></span>
      <span class="fx-ember e5"></span>
      <span class="fx-ember e6"></span>
      <span class="fx-ember e7"></span>
      <span class="fx-ember e8"></span>
    </div>
    <div class="fx-flame-ball" aria-hidden="true">
      <svg class="fx-svg-icon fx-ace-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="aceFireGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FEF08A"/>
            <stop offset="45%" stop-color="#F97316"/>
            <stop offset="85%" stop-color="#DC2626"/>
            <stop offset="100%" stop-color="#7F1D1D" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="aceBallGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFBEB"/>
            <stop offset="50%" stop-color="#FDE047"/>
            <stop offset="100%" stop-color="#EA580C"/>
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#aceFireGrad)"/>
        <path d="M60 8C78 24 98 34 96 64C94 88 78 106 60 110C42 106 26 88 24 64C22 34 42 24 60 8Z" fill="#EF4444" fill-opacity="0.45"/>
        <circle cx="60" cy="64" r="34" fill="url(#aceBallGrad)" stroke="#FEF08A" stroke-width="3"/>
        <path d="M32 52C48 44 72 44 88 52M28 68C48 60 72 60 92 68M46 33C54 52 54 76 44 95M74 33C66 52 66 76 76 95" stroke="#9A3412" stroke-width="3" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="fx-flame-text">🔥 ASS! 🔥</div>
    <div class="fx-flame-subtext">SERVICE WINNER · SV 1845</div>
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
    <div class="fx-shield-hexgrid"></div>
    <div class="fx-shield-shockwave shockwave-1"></div>
    <div class="fx-shield-shockwave shockwave-2"></div>
    <div class="fx-shield-sparks" aria-hidden="true">
      <span class="fx-shield-spark sp1"></span>
      <span class="fx-shield-spark sp2"></span>
      <span class="fx-shield-spark sp3"></span>
      <span class="fx-shield-spark sp4"></span>
      <span class="fx-shield-spark sp5"></span>
      <span class="fx-shield-spark sp6"></span>
    </div>
    <div class="fx-shield-icon" aria-hidden="true">
      <svg class="fx-svg-icon fx-block-svg" viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F472B6"/>
            <stop offset="50%" stop-color="#DB2777"/>
            <stop offset="100%" stop-color="#6B21A8"/>
          </linearGradient>
          <linearGradient id="shieldRim" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#FDF2F8"/>
            <stop offset="100%" stop-color="#F472B6"/>
          </linearGradient>
        </defs>
        <path d="M60 8L106 26V62C106 92 85 113 60 122C35 113 14 92 14 62V26L60 8Z" fill="url(#shieldGrad)" stroke="url(#shieldRim)" stroke-width="4"/>
        <path d="M60 18L96 32V60C96 84 79 101 60 109C41 101 24 84 24 60V32L60 18Z" stroke="#FBCFE8" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="6 4"/>
        <path d="M60 18V109M24 60H96" stroke="#FCE7F3" stroke-opacity="0.4" stroke-width="2"/>
      </svg>
    </div>
    <div class="fx-shield-text">🛡️ BLOCK! 🛡️</div>
    <div class="fx-shield-subtext">MONSTER BLOCK · DEFENSE WALL</div>
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
  audioEngine.stop(3000);
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

export const APP_VERSION = '1.14.1';

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
        if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          } catch (_) {}
        }
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
 * Requests fullscreen mode on the document root if supported and not already in fullscreen
 */
export function requestAutoFullscreen() {
  if (typeof document === 'undefined') return;
  const doc = document;
  const isFullscreen = doc.fullscreenElement || doc.webkitFullscreenElement;
  if (!isFullscreen) {
    const req = doc.documentElement?.requestFullscreen || doc.documentElement?.webkitRequestFullscreen;
    if (req) {
      try {
        const res = req.call(doc.documentElement);
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (_) {}
    }
  }
}

/**
 * Initializes DOM listeners and UI bindings
 */
export function setupEventListeners() {
  // AudioEngine lifecycle callbacks
  audioEngine.onTrackStart = (track) => {
    updatePlayingUI(track ? track.id : null);
    updateNowPlayingHeader(track);
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
    updateNowPlayingHeader(null);
    hidePauseOverlay();
    clearActiveTriggerButton();
    closeScrubberModal();
  };
  audioEngine.onTrackEnd = () => {
    updatePlayingUI(null);
    updateNowPlayingHeader(null);
    hidePauseOverlay();
    clearActiveTriggerButton();
    closeScrubberModal();
  };

  // One-time user gesture listener to acquire wake lock and unlock AudioContext on first interaction
  if (typeof document !== 'undefined') {
    const unlockUserGesture = () => {
      audioEngine.initAudioContext();
      if (audioEngine.audioCtx && (audioEngine.audioCtx.state === 'suspended' || audioEngine.audioCtx.state === 'interrupted')) {
        const res = typeof audioEngine.audioCtx.resume === 'function' ? audioEngine.audioCtx.resume() : null;
        if (res && typeof res.catch === 'function') res.catch(() => {});
      }
      if (!wakeLock.isActive()) {
        wakeLock.requestLock().catch(() => {});
      }
    };

    if (typeof document.addEventListener === 'function') {
      document.addEventListener('pointerdown', unlockUserGesture, { once: true });
      document.addEventListener('touchstart', unlockUserGesture, { once: true });
    }

    const appEl = document.getElementById('app') || document.body;
    if (appEl && appEl.addEventListener) {
      appEl.addEventListener('pointerdown', () => {
        requestAutoFullscreen();
      }, { once: true });
    }

    // Auto-resume AudioContext on returning from background or screen lock
    if (typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && audioEngine.audioCtx) {
          if (audioEngine.audioCtx.state === 'suspended' || audioEngine.audioCtx.state === 'interrupted') {
            const res = typeof audioEngine.audioCtx.resume === 'function' ? audioEngine.audioCtx.resume() : null;
            if (res && typeof res.catch === 'function') res.catch(() => {});
          }
        }
      });
    }
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

  // Auto-Normalization toggle button & Sound/EQ Popup Menu
  const btnAutoNorm = document.getElementById('btn-auto-norm');
  if (btnAutoNorm && typeof btnAutoNorm.addEventListener === 'function') {
    btnAutoNorm.addEventListener('click', () => toggleAutoNormalize());
  }

  const btnEqMenu = document.getElementById('btn-eq-menu');
  if (btnEqMenu && typeof btnEqMenu.addEventListener === 'function') {
    btnEqMenu.addEventListener('click', () => openEqModal());
  }

  const btnCloseEq = document.getElementById('btn-close-eq');
  if (btnCloseEq && typeof btnCloseEq.addEventListener === 'function') {
    btnCloseEq.addEventListener('click', () => closeEqModal());
  }

  const eqBackdrop = document.getElementById('eq-backdrop');
  if (eqBackdrop && typeof eqBackdrop.addEventListener === 'function') {
    eqBackdrop.addEventListener('click', () => closeEqModal());
  }

  const eqPresetsGrid = document.getElementById('eq-presets-grid');
  if (eqPresetsGrid && typeof eqPresetsGrid.addEventListener === 'function') {
    eqPresetsGrid.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('.eq-preset-btn');
      if (btn) {
        const presetId = btn.getAttribute('data-eq-preset');
        if (presetId) {
          applyEqPreset(presetId);
        }
      }
    });
  }

  // Header banner toggle button
  const btnToggleHeader = document.getElementById('btn-toggle-header');
  if (btnToggleHeader) {
    btnToggleHeader.addEventListener('click', () => setHeaderCollapsed(!isHeaderCollapsed));
  }

  // Theme toggle button
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      toggleTheme();
    });
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

  // Fast Touch / Click helper for ultra-low latency triggering with ghost-click suppression
  const bindFastTrigger = (btn, action) => {
    if (!btn || typeof btn.addEventListener !== 'function') return;
    let lastTrigger = 0;
    const trigger = (e) => {
      const now = Date.now();
      if (now - lastTrigger < 300) {
        if (typeof e?.preventDefault === 'function') e.preventDefault();
        return;
      }
      lastTrigger = now;
      if (e?.type === 'pointerdown' && typeof e?.preventDefault === 'function') {
        e.preventDefault();
      }
      action(e);
    };
    btn.addEventListener('pointerdown', trigger);
    btn.addEventListener('click', trigger);
  };

  // Track button click delegation for scrollable song lists (board and drawer)
  // Uses native click without e.preventDefault() so touch scrolling/gestures are not blocked on mobile
  const setupSongListDelegation = (container) => {
    if (!container || typeof container.addEventListener !== 'function') return;
    container.addEventListener('click', (e) => {
      const btn = e?.target?.closest?.('.song-btn, .track-btn');
      if (!btn) return;
      const trackId = btn.getAttribute('data-track-id');
      const track = allTracks.find((t) => t.id === trackId);
      if (track) {
        setActiveTriggerButton(btn);
        handlePlayTrack(track);
      }
    });
  };

  // Track button trigger delegation on main soundboard (click only to preserve native touch scrolling)
  const boardContainer = document.getElementById('board-container');
  setupSongListDelegation(boardContainer);

  // Track button trigger delegation on modal drawer (click only to preserve native touch scrolling)
  const drawerContent = document.getElementById('drawer-content');
  setupSongListDelegation(drawerContent);

  // Desktop Footer Bar Quick Actions
  const btnTimeout = document.getElementById('btn-timeout');
  bindFastTrigger(btnTimeout, () => {
    setActiveTriggerButton(btnTimeout);
    playTimeout(btnTimeout);
  });

  const btnWalkon = document.getElementById('btn-walkon');
  bindFastTrigger(btnWalkon, () => {
    setActiveTriggerButton(btnWalkon);
    playWalkOn(btnWalkon);
  });

  for (let slot = 1; slot <= 4; slot++) {
    const slotBtn = document.getElementById(`btn-pause-${slot}`);
    bindFastTrigger(slotBtn, () => {
      setActiveTriggerButton(slotBtn);
      playPauseSlot(slot, slotBtn);
    });
  }

  const btnSixseven = document.getElementById('btn-sixseven');
  bindFastTrigger(btnSixseven, () => {
    setActiveTriggerButton(btnSixseven);
    playSixSeven(btnSixseven);
  });

  const btnAce = document.getElementById('btn-ace');
  bindFastTrigger(btnAce, () => {
    setActiveTriggerButton(btnAce);
    playAce(btnAce);
  });

  const btnBlock = document.getElementById('btn-block');
  bindFastTrigger(btnBlock, () => {
    setActiveTriggerButton(btnBlock);
    playBlock(btnBlock);
  });

  const btnRandomOwn = document.getElementById('btn-random-own');
  bindFastTrigger(btnRandomOwn, () => {
    setActiveTriggerButton(btnRandomOwn);
    playRandomOwn(btnRandomOwn);
  });

  const btnRandomOpponent = document.getElementById('btn-random-opponent');
  bindFastTrigger(btnRandomOpponent, () => {
    setActiveTriggerButton(btnRandomOpponent);
    playRandomOpponent(btnRandomOpponent);
  });

  const btnStop = document.getElementById('btn-stop');
  bindFastTrigger(btnStop, stopAudio);

  // Mobile Pad Quick Actions
  const btnMobileTimeout = document.getElementById('btn-mobile-timeout');
  bindFastTrigger(btnMobileTimeout, () => {
    setActiveTriggerButton(btnMobileTimeout);
    playTimeout(btnMobileTimeout);
  });

  const btnMobileWalkon = document.getElementById('btn-mobile-walkon');
  bindFastTrigger(btnMobileWalkon, () => {
    setActiveTriggerButton(btnMobileWalkon);
    playWalkOn(btnMobileWalkon);
  });

  const btnMobilePause = document.getElementById('btn-mobile-pause');
  bindFastTrigger(btnMobilePause, () => {
    setActiveTriggerButton(btnMobilePause);
    playPauseSlot(1, btnMobilePause);
  });

  const btnMobileSixseven = document.getElementById('btn-mobile-sixseven');
  bindFastTrigger(btnMobileSixseven, () => {
    setActiveTriggerButton(btnMobileSixseven);
    playSixSeven(btnMobileSixseven);
  });

  const btnMobileAce = document.getElementById('btn-mobile-ace');
  bindFastTrigger(btnMobileAce, () => {
    setActiveTriggerButton(btnMobileAce);
    playAce(btnMobileAce);
  });

  const btnMobileBlock = document.getElementById('btn-mobile-block');
  bindFastTrigger(btnMobileBlock, () => {
    setActiveTriggerButton(btnMobileBlock);
    playBlock(btnMobileBlock);
  });

  const btnMobileRandomOwn = document.getElementById('btn-mobile-random-own');
  bindFastTrigger(btnMobileRandomOwn, () => {
    setActiveTriggerButton(btnMobileRandomOwn);
    playRandomOwn(btnMobileRandomOwn);
  });

  const btnMobileRandomOpponent = document.getElementById('btn-mobile-random-opponent');
  bindFastTrigger(btnMobileRandomOpponent, () => {
    setActiveTriggerButton(btnMobileRandomOpponent);
    playRandomOpponent(btnMobileRandomOpponent);
  });

  const btnMobileStop = document.getElementById('btn-mobile-stop');
  bindFastTrigger(btnMobileStop, stopAudio);

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

  // Scrubber modal event listeners
  const headerNowPlaying = document.getElementById('header-now-playing');
  if (headerNowPlaying && typeof headerNowPlaying.addEventListener === 'function') {
    headerNowPlaying.addEventListener('click', () => {
      if (audioEngine.getCurrentTrack() || audioEngine.currentTrack) {
        openScrubberModal();
      }
    });
    headerNowPlaying.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && (audioEngine.getCurrentTrack() || audioEngine.currentTrack)) {
        e.preventDefault();
        openScrubberModal();
      }
    });
  }

  const btnCloseScrubber = document.getElementById('btn-close-scrubber');
  if (btnCloseScrubber && typeof btnCloseScrubber.addEventListener === 'function') {
    btnCloseScrubber.addEventListener('click', () => closeScrubberModal());
  }

  const scrubberBackdrop = document.getElementById('scrubber-backdrop');
  if (scrubberBackdrop && typeof scrubberBackdrop.addEventListener === 'function') {
    scrubberBackdrop.addEventListener('click', () => closeScrubberModal());
  }

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeScrubberModal();
        closeEqModal();
      }
    });
  }

  const scrubberSlider = document.getElementById('scrubber-slider');
  if (scrubberSlider && typeof scrubberSlider.addEventListener === 'function') {
    scrubberSlider.addEventListener('input', (e) => {
      isUserScrubbing = true;
      const dur = audioEngine.getDuration();
      const val = parseFloat(e.target.value) || 0;
      const curEl = document.getElementById('scrubber-time-current');
      if (curEl) {
        const previewSecs = dur > 0 ? (val / 100) * dur : 0;
        curEl.textContent = formatTime(previewSecs);
      }
    });

    scrubberSlider.addEventListener('change', (e) => {
      isUserScrubbing = false;
      const dur = audioEngine.getDuration();
      const val = parseFloat(e.target.value) || 0;
      const targetSeconds = (val / 100) * dur;
      audioEngine.seek(targetSeconds);
      syncScrubberUI();
    });
  }

  const btnScrubBack = document.getElementById('btn-scrub-back');
  if (btnScrubBack && typeof btnScrubBack.addEventListener === 'function') {
    btnScrubBack.addEventListener('click', () => {
      audioEngine.seekRelative(-5);
      syncScrubberUI();
    });
  }

  const btnScrubFwd = document.getElementById('btn-scrub-fwd');
  if (btnScrubFwd && typeof btnScrubFwd.addEventListener === 'function') {
    btnScrubFwd.addEventListener('click', () => {
      audioEngine.seekRelative(5);
      syncScrubberUI();
    });
  }

  const scrubberGainSlider = document.getElementById('scrubber-gain-slider');
  if (scrubberGainSlider && typeof scrubberGainSlider.addEventListener === 'function') {
    scrubberGainSlider.addEventListener('input', (e) => {
      applyTrackCustomGain(e.target.value);
    });
  }

  const btnResetTrackGain = document.getElementById('btn-reset-track-gain');
  if (btnResetTrackGain && typeof btnResetTrackGain.addEventListener === 'function') {
    btnResetTrackGain.addEventListener('click', () => {
      applyTrackCustomGain(100);
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

export let splashTimer = null;
export let handleKeySkip = null;

/**
 * Dismisses the startup matchday splash screen with a smooth fade-out.
 */
export function dismissStartupSplash() {
  if (splashTimer) {
    clearTimeout(splashTimer);
    splashTimer = null;
  }
  if (handleKeySkip) {
    if (typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('keydown', handleKeySkip);
    }
    handleKeySkip = null;
  }

  requestAutoFullscreen();

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
  if (splashTimer) {
    clearTimeout(splashTimer);
    splashTimer = null;
  }
  if (handleKeySkip) {
    if (typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('keydown', handleKeySkip);
    }
    handleKeySkip = null;
  }

  if (typeof document === 'undefined') return;
  const splash = document.getElementById('startup-splash');
  if (!splash) return;

  // Click or touch anywhere on splash screen skips animation immediately
  splash.addEventListener('click', () => dismissStartupSplash());
  splash.addEventListener('touchend', () => dismissStartupSplash(), { passive: true });

  // Keyboard accessibility (Escape, Enter, Space skips animation)
  handleKeySkip = (e) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      dismissStartupSplash();
      if (typeof window !== 'undefined' && window.removeEventListener && handleKeySkip) {
        window.removeEventListener('keydown', handleKeySkip);
        handleKeySkip = null;
      }
    }
  };
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', handleKeySkip);
  }

  // Auto-dismiss after 1600ms
  splashTimer = setTimeout(() => {
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

    const savedAutoNorm = await getSetting('autoNormalize', true);
    applyAutoNormalize(savedAutoNorm);

    const savedEqPreset = await getSetting('eqPreset', 'neutral');
    applyEqPreset(savedEqPreset);

    const savedZoom = await getSetting('zoom', 100);
    applyZoom(savedZoom);

    const savedHeaderCollapsed = await getSetting('headerCollapsed', false);
    setHeaderCollapsed(savedHeaderCollapsed);

    // Initialize Theme (classic by default or loaded from localStorage)
    initTheme();

    // Setup events and render initial state
    setupEventListeners();
    renderAll();
  } catch (err) {
    console.error('Failed to initialize DJ Soundboard app:', err);
  }
}

// Auto-run when DOM is ready in browser
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
