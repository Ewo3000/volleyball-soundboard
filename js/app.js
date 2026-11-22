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
  updateTrackMeta,
  deleteTrack,
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
  stripExtension,
  isSfxFolderPath
} from './file-loader.js';

import {
  AudioEngine,
  pickLeastPlayedRandomTrack,
  EQ_PRESETS,
  NORM_VERSION
} from './audio-engine.js';

import { WakeLockManager } from './wake-lock.js';
import { createDemoSoundpack } from './demo-sounds.js';
import { SFX_DEFINITIONS } from './sfx-engine.js';
import {
  initTheme,
  toggleTheme,
  setTheme,
  getCurrentTheme,
  THEMES,
  THEME_LABELS
} from './theme.js';

export {
  initTheme,
  toggleTheme,
  setTheme,
  getCurrentTheme,
  THEMES,
  THEME_LABELS,
  SFX_DEFINITIONS,
  isSfxFolderPath
};

// Application State
export const audioEngine = new AudioEngine();
export const wakeLock = new WakeLockManager();

export let allTracks = [];
export let categorized = new Map();
export let currentZoom = 100;
export let isHeaderCollapsed = false;
export let currentSearchQuery = '';
export let activeTriggerBtn = null;
export let isWarmupMode = false;
export let isStopFading = false;
export let pauseAutoFadeEnabled = true;
export let shortcutsEnabled = true;
export let isScoreboardVisible = false;
export let contextMenuTrackId = null;

export let scoreboardState = {
  home: 0,
  guest: 0
};
export let lastScoreEvent = null;
let scoreCorrectedFlashTimer = null;
let scoreBumpTimer = null;

export const TIMEOUT_DURATION_SEC = 30;
export const PAUSE_DURATION_SEC = 180;

export let timeoutRemainingSec = 0;
export let pauseRemainingSec = 0;

let stopFadeTimer = null;
let stopHardCutFlashTimer = null;
let timeoutTimerInterval = null;
let pauseTimerInterval = null;
let pauseTotalSec = PAUSE_DURATION_SEC;
let progressInterval = null;
let visualizerRafId = null;
let lastVisualizerDrawMs = 0;

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
  const count = typeof track.playCount === 'number' ? track.playCount : 0;
  const hasPlayed = count > 0;
  const isHighPlayed = count >= 2;
  const isPinned = Boolean(track.pinned);
  const playingClass = isPlaying ? ' is-playing playing' : '';
  const playedClass = hasPlayed ? ' has-played' : '';
  const highPlayedClass = isHighPlayed ? ' play-count-high' : '';
  const pinnedClass = isPinned ? ' is-pinned' : '';
  const playTier = isHighPlayed ? 'high' : hasPlayed ? 'mid' : 'fresh';
  const playingAttr = isPlaying ? ' data-playing="true"' : '';
  const pinStarHtml = isPinned ? '<span class="pin-star" aria-label="Favorit angepinnt">⭐</span>' : '';

  return `<button type="button" class="song-btn track-btn${playingClass}${playedClass}${highPlayedClass}${pinnedClass}" data-track-id="${escapeHtml(track.id)}" data-category="${escapeHtml(track.category)}" data-play-tier="${playTier}"${playingAttr} title="${escapeHtml(track.cleanTitle)}">
    ${pinStarHtml}<span class="song-title track-title">${escapeHtml(track.cleanTitle)}</span>
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

  // Update spanning Sonstiges group total count badge
  const sonstigesTotalBadge = document.getElementById('sonstiges-total-count');
  if (sonstigesTotalBadge) {
    const sonstigesTracks = categorized.get('sonstiges') || [];
    sonstigesTotalBadge.textContent = String(sonstigesTracks.length);
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
 * Renders imported custom One-Shot SFX tracks (_SFX or effekte/ subfolder) in #sfx-custom-pads-grid
 */
export function renderCustomSfxPads() {
  if (typeof document === 'undefined') return;
  const grid = document.getElementById('sfx-custom-pads-grid');
  if (!grid) return;

  const sfxTracks = categorized.get('sfx') || allTracks.filter((t) => t.category === 'sfx');
  if (sfxTracks.length === 0) {
    grid.innerHTML =
      '<div class="sfx-custom-empty">Keine eigenen Effekte geladen — lege MP3/WAV im Unterordner „effekte/“ ab oder nutze „Effekte laden“.</div>';
    return;
  }

  grid.innerHTML = sfxTracks
    .map(
      (track) => `<div class="sfx-custom-pad-wrap">
        <button type="button" class="sfx-pad-btn sfx-custom-pad-btn sfx-accent-amber" data-sfx-track-id="${escapeHtml(track.id)}" title="${escapeHtml(track.cleanTitle)}">
          <span class="sfx-pad-icon" aria-hidden="true">🔊</span>
          <span class="sfx-pad-name">${escapeHtml(track.cleanTitle)}</span>
          <span class="sfx-pad-desc">Eigener Effekt</span>
        </button>
        <button type="button" class="btn-delete-sfx" data-delete-sfx-id="${escapeHtml(track.id)}" aria-label="${escapeHtml(track.cleanTitle)} entfernen" title="Effekt entfernen">✕</button>
      </div>`
    )
    .join('');
}

/**
 * Re-renders the entire UI
 */
export function renderAll() {
  categorized = categorizeTracks(allTracks);
  renderColumns();
  renderDrawer();
  renderCustomSfxPads();
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
  const compactContainer = document.getElementById('compact-now-playing');
  const compactTitleEl = document.getElementById('compact-now-playing-title');
  const compactTimeEl = document.getElementById('compact-now-playing-time');

  const title = track
    ? (track.cleanTitle || (typeof cleanTrackTitle === 'function' ? cleanTrackTitle(track.name || '') : track.name || ''))
    : '';

  if (container && titleEl) {
    if (track) {
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

  if (compactContainer && compactTitleEl) {
    if (track) {
      compactTitleEl.textContent = title;
      compactContainer.title = `${title} – Klicken zum Spulen`;
      compactContainer.style.display = '';
      compactContainer.classList.add('is-active');
    } else {
      compactContainer.style.display = 'none';
      compactContainer.classList.remove('is-active');
      compactTitleEl.textContent = '';
      if (compactTimeEl) compactTimeEl.textContent = '0:00';
    }
  }
}

/**
 * Live Progress Bar & Lightweight Audio Visualizer Loops
 */
export function syncProgressUI() {
  if (typeof document === 'undefined') return;
  const cur = typeof audioEngine.getCurrentTime === 'function' ? audioEngine.getCurrentTime() : 0;
  const dur = typeof audioEngine.getDuration === 'function' ? audioEngine.getDuration() : 0;
  const ratio = dur > 0 ? Math.max(0, Math.min(1, cur / dur)) : 0;
  const scaleStr = ratio.toFixed(4);

  const headerNp = document.getElementById('header-now-playing');
  headerNp?.style?.setProperty?.('--play-progress-scale', scaleStr);

  const compactNp = document.getElementById('compact-now-playing');
  compactNp?.style?.setProperty?.('--play-progress-scale', scaleStr);

  const compactTimeEl = document.getElementById('compact-now-playing-time');
  if (compactTimeEl) {
    compactTimeEl.textContent = formatTime(cur);
  }

  const playingBtns = document.querySelectorAll?.('.track-btn.is-playing, .song-btn.is-playing');
  playingBtns?.forEach?.((btn) => {
    btn.style?.setProperty?.('--play-progress-scale', scaleStr);
  });
}

export function startProgressLoop() {
  stopProgressLoop();
  syncProgressUI();
  progressInterval = setInterval(syncProgressUI, 250);
  if (typeof progressInterval?.unref === 'function') {
    progressInterval.unref();
  }
}

export function stopProgressLoop() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  if (typeof document === 'undefined') return;
  const headerNp = document.getElementById('header-now-playing');
  headerNp?.style?.setProperty?.('--play-progress-scale', '0');

  const compactNp = document.getElementById('compact-now-playing');
  compactNp?.style?.setProperty?.('--play-progress-scale', '0');

  const compactTimeEl = document.getElementById('compact-now-playing-time');
  if (compactTimeEl) compactTimeEl.textContent = '0:00';

  const allBtns = document.querySelectorAll?.('.track-btn, .song-btn');
  allBtns?.forEach?.((btn) => {
    btn.style?.setProperty?.('--play-progress-scale', '0');
  });
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {
    return false;
  }
}

export function stopVisualizerLoop() {
  if (visualizerRafId && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(visualizerRafId);
  }
  visualizerRafId = null;

  if (typeof document === 'undefined') return;
  const npContainers = [
    document.getElementById('header-now-playing'),
    document.getElementById('compact-now-playing')
  ];
  for (const el of npContainers) {
    if (!el) continue;
    el.classList?.remove?.('is-live-visualizer');
    el.querySelectorAll?.('.np-bar')?.forEach?.((bar) => {
      if (bar.style) bar.style.transform = '';
    });
  }

  const vuFill = document.getElementById('master-vu-fill');
  if (vuFill) {
    if (vuFill.style) vuFill.style.transform = 'scaleX(0)';
    vuFill.classList?.remove?.('is-hot', 'is-clipping');
  }
}

export function startVisualizerLoop() {
  stopVisualizerLoop();
  if (
    typeof document === 'undefined' ||
    typeof requestAnimationFrame !== 'function' ||
    prefersReducedMotion() ||
    document.visibilityState === 'hidden'
  ) {
    return;
  }

  const step = (timestamp) => {
    const activeTrack = audioEngine.getCurrentTrack?.() || audioEngine.currentTrack;
    if (!activeTrack || document.visibilityState === 'hidden') {
      stopVisualizerLoop();
      return;
    }

    // Throttle DOM writes to ~20 FPS (50ms) to minimize battery & CPU usage on tablets
    if (timestamp - lastVisualizerDrawMs >= 50) {
      lastVisualizerDrawMs = timestamp;
      const levels = audioEngine.getAudioLevels?.();
      if (!levels) {
        stopVisualizerLoop();
        return;
      }

      const npContainers = [
        document.getElementById('header-now-playing'),
        document.getElementById('compact-now-playing')
      ];
      for (const el of npContainers) {
        if (!el) continue;
        el.classList?.add?.('is-live-visualizer');
        const bars = el.querySelectorAll?.('.np-bar');
        if (bars && bars.forEach) {
          bars.forEach((bar, idx) => {
            const level = levels.bars[idx % levels.bars.length] || 0;
            const scaleY = (0.15 + level * 0.85).toFixed(3);
            if (bar.style) bar.style.transform = `scaleY(${scaleY})`;
          });
        }
      }

      const vuFill = document.getElementById('master-vu-fill');
      if (vuFill) {
        const peak = Math.max(0, Math.min(1, levels.peak || 0));
        if (vuFill.style) vuFill.style.transform = `scaleX(${peak.toFixed(3)})`;
        vuFill.classList?.toggle?.('is-hot', peak > 0.72 && !levels.clipping);
        vuFill.classList?.toggle?.('is-clipping', Boolean(levels.clipping));
      }
    }

    visualizerRafId = requestAnimationFrame(step);
  };

  visualizerRafId = requestAnimationFrame(step);
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
  const isHigh = count >= 2;
  const tier = isHigh ? 'high' : count > 0 ? 'mid' : 'fresh';
  matchingButtons.forEach((btn) => {
    btn.classList?.toggle?.('has-played', count > 0);
    btn.classList?.toggle?.('play-count-high', isHigh);
    btn.setAttribute?.('data-play-tier', tier);
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
export async function handlePlayTrack(track, { skipAutoScore = false } = {}) {
  if (!track) return;
  if (!skipAutoScore) {
    const scoreSide = getScoreSideForTrack(track);
    if (scoreSide) {
      recordButtonScore(scoreSide);
    }
  }
  try {
    resetStopFadeState();

    if (!wakeLock.isActive()) {
      wakeLock.requestLock().catch((err) => console.warn('Wake lock error:', err));
    }

    const baseName = stripExtension(track.name || '');
    const isPauseTrack =
      track.category === 'pause' ||
      /_PAUSE\d*$/i.test(track.suffix || '') ||
      /_(?:PAUSE\d*|PAUSENSONG)$/i.test(baseName);
    const isTimeoutTrack =
      track.category === 'timeout' ||
      track.suffix === '_TIMEOUT' ||
      /_TIMEOUT$/i.test(baseName);

    if (!isTimeoutTrack) {
      stopTimeoutCountdown();
    }

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
  if (typeof document !== 'undefined') {
    const zoomDisplay = document.getElementById('zoom-display');
    const columnsGrid = document.getElementById('columns-grid');

    if (zoomDisplay) {
      zoomDisplay.textContent = `${currentZoom}%`;
    }
    if (columnsGrid) {
      columnsGrid.style.transform = `scale(${currentZoom / 100})`;
      columnsGrid.style.transformOrigin = 'top center';
    }
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
  if (typeof document !== 'undefined') {
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

  resetScoreboard();

  if (typeof document !== 'undefined') {
    document.querySelectorAll?.('.play-badge, .play-count')?.forEach?.((badge) => {
      badge.textContent = '0';
      badge.setAttribute('data-count', '0');
    });

    document.querySelectorAll?.('.song-btn, .track-btn')?.forEach?.((btn) => {
      btn.classList?.remove?.('has-played', 'play-count-high');
      btn.setAttribute?.('data-play-tier', 'fresh');
    });

    for (let slot = 1; slot <= 4; slot++) {
      const pauseBtn = document.getElementById(`btn-pause-${slot}`);
      if (pauseBtn) pauseBtn.classList?.remove?.('has-played');
    }

    closeSettingsModal();
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
 * Countdown Timers for Timeout (30s) & Set Break / Satzpause (3:00 min)
 */
export function renderTimeoutCountdownUI() {
  if (typeof document === 'undefined') return;
  const active = timeoutRemainingSec > 0;
  const isWarning = active && timeoutRemainingSec <= 10;
  const formatted = active ? formatTime(timeoutRemainingSec) : '';

  const pairs = [
    { btn: document.getElementById('btn-timeout'), badge: document.getElementById('timeout-countdown-desktop') },
    { btn: document.getElementById('btn-mobile-timeout'), badge: document.getElementById('timeout-countdown-mobile') }
  ];

  for (const { btn, badge } of pairs) {
    if (badge) {
      badge.textContent = formatted;
    }
    if (btn) {
      btn.classList?.toggle?.('has-active-timer', active);
      btn.classList?.toggle?.('timer-warning', isWarning);
    }
  }
}

export function stopTimeoutCountdown() {
  if (timeoutTimerInterval) {
    clearInterval(timeoutTimerInterval);
    timeoutTimerInterval = null;
  }
  timeoutRemainingSec = 0;
  renderTimeoutCountdownUI();
}

export function startTimeoutCountdown(seconds = TIMEOUT_DURATION_SEC) {
  if (timeoutTimerInterval) {
    clearInterval(timeoutTimerInterval);
    timeoutTimerInterval = null;
  }
  const dur = Math.max(1, Math.round(Number(seconds) || TIMEOUT_DURATION_SEC));
  timeoutRemainingSec = dur;
  renderTimeoutCountdownUI();

  timeoutTimerInterval = setInterval(() => {
    if (timeoutRemainingSec <= 1) {
      stopTimeoutCountdown();
      return;
    }
    timeoutRemainingSec -= 1;
    renderTimeoutCountdownUI();
  }, 1000);
  if (typeof timeoutTimerInterval?.unref === 'function') {
    timeoutTimerInterval.unref();
  }
}

export function renderPauseCountdownUI() {
  if (typeof document === 'undefined') return;
  const countdownEl = document.getElementById('pause-countdown');
  const fillEl = document.getElementById('pause-countdown-fill');
  const boxEl = document.getElementById('pause-timer-box');

  const isWarning = pauseRemainingSec > 0 && pauseRemainingSec <= 15;
  if (countdownEl) {
    countdownEl.textContent = formatTime(pauseRemainingSec);
    countdownEl.classList?.toggle?.('timer-warning', isWarning);
  }
  if (boxEl) {
    boxEl.classList?.toggle?.('timer-warning', isWarning);
  }
  if (fillEl && fillEl.style) {
    const ratio = pauseTotalSec > 0 ? Math.max(0, Math.min(1, pauseRemainingSec / pauseTotalSec)) : 0;
    fillEl.style.transform = `scaleX(${ratio.toFixed(4)})`;
  }
}

export function stopPauseCountdown() {
  if (pauseTimerInterval) {
    clearInterval(pauseTimerInterval);
    pauseTimerInterval = null;
  }
  pauseRemainingSec = 0;
  pauseTotalSec = PAUSE_DURATION_SEC;
  renderPauseCountdownUI();
}

export function startPauseCountdown(seconds = PAUSE_DURATION_SEC, forceReset = false) {
  if (pauseTimerInterval && !forceReset) {
    // Keep ongoing set-break clock when switching between Pause 1..4
    return;
  }
  if (pauseTimerInterval) {
    clearInterval(pauseTimerInterval);
    pauseTimerInterval = null;
  }
  const dur = Math.max(1, Math.round(Number(seconds) || PAUSE_DURATION_SEC));
  pauseRemainingSec = dur;
  pauseTotalSec = dur;
  renderPauseCountdownUI();

  pauseTimerInterval = setInterval(() => {
    if (pauseRemainingSec <= 1) {
      pauseRemainingSec = 0;
      renderPauseCountdownUI();
      clearInterval(pauseTimerInterval);
      pauseTimerInterval = null;
      return;
    }
    pauseRemainingSec -= 1;
    renderPauseCountdownUI();

    if (
      pauseAutoFadeEnabled &&
      pauseRemainingSec === 5 &&
      !isStopFading &&
      (audioEngine.getCurrentTrack?.() || audioEngine.currentAudioElement)
    ) {
      stopAudio();
    }
  }, 1000);
  if (typeof pauseTimerInterval?.unref === 'function') {
    pauseTimerInterval.unref();
  }
}

export function addPauseTime(deltaSec = 30) {
  const delta = Number(deltaSec) || 0;
  if (!pauseTimerInterval && pauseRemainingSec === 0) {
    startPauseCountdown(Math.max(1, PAUSE_DURATION_SEC + delta), true);
    return;
  }
  pauseRemainingSec = Math.max(1, pauseRemainingSec + delta);
  pauseTotalSec = Math.max(pauseTotalSec, pauseRemainingSec);
  renderPauseCountdownUI();
}

export function setPauseAutoFade(enabled) {
  pauseAutoFadeEnabled = Boolean(enabled);
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('btn-pause-autofade');
  if (btn) {
    btn.classList?.toggle?.('is-active', pauseAutoFadeEnabled);
    btn.setAttribute?.('aria-pressed', String(pauseAutoFadeEnabled));
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
    startTimeoutCountdown(TIMEOUT_DURATION_SEC);
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
  startPauseCountdown(PAUSE_DURATION_SEC, false);
}

/**
 * Hides animated hourglass pause overlay
 */
export function hidePauseOverlay() {
  stopPauseCountdown();
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
  recordButtonScore('home');
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
    handlePlayTrack(track, { skipAutoScore: true });
  } else {
    clearActiveTriggerButton();
    console.warn('Keine Ass-Tracks (_ACE) vorhanden');
  }
}

export function playBlock(triggerBtn) {
  recordButtonScore('home');
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
    handlePlayTrack(track, { skipAutoScore: true });
  } else {
    clearActiveTriggerButton();
    console.warn('Keine Block-Tracks (_BLOCK) vorhanden');
  }
}


export function playRandomOwn(triggerBtn) {
  recordButtonScore('home');
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
    handlePlayTrack(track, { skipAutoScore: true });
  } else {
    clearActiveTriggerButton();
    console.warn('Keine Tracks für eigene Punkte vorhanden');
  }
}

export function playRandomOpponent(triggerBtn) {
  recordButtonScore('guest');
  const opponentTracks = allTracks.filter((t) => t.category === 'gegner');
  const track = pickLeastPlayedRandomTrack(opponentTracks);
  if (track) {
    if (triggerBtn) {
      setActiveTriggerButton(triggerBtn);
    } else if (typeof document !== 'undefined') {
      const btn = document.getElementById('btn-random-opponent');
      if (btn) setActiveTriggerButton(btn);
    }
    handlePlayTrack(track, { skipAutoScore: true });
  } else {
    clearActiveTriggerButton();
    console.warn('Keine Tracks für Gegnerpunkte vorhanden');
  }
}

/**
 * Warm-Up / Auto-Play Mode (continuous playback of unplayed / least-played songs)
 */
const WARMUP_ELIGIBLE_CATEGORIES = new Set([
  'sonstiges',
  'sonstiges_1',
  'sonstiges_2',
  'sonstiges_3',
  'ass_angriff',
  'spass_extras'
]);

export function pickNextWarmupTrack(excludeTrack = null) {
  if (!allTracks || allTracks.length === 0) return null;
  let pool = allTracks.filter((t) => WARMUP_ELIGIBLE_CATEGORIES.has(t.category));
  if (pool.length === 0) {
    pool = allTracks;
  }
  if (excludeTrack && excludeTrack.id && pool.length > 1) {
    const filtered = pool.filter((t) => t.id !== excludeTrack.id);
    if (filtered.length > 0) pool = filtered;
  }
  return pickLeastPlayedRandomTrack(pool);
}

export function setWarmupMode(enabled) {
  isWarmupMode = Boolean(enabled);
  if (typeof document === 'undefined') return;
  const buttons = [
    document.getElementById('btn-warmup-toggle'),
    document.getElementById('btn-mobile-warmup')
  ];
  for (const btn of buttons) {
    if (!btn) continue;
    btn.classList?.toggle?.('is-active', isWarmupMode);
    btn.setAttribute?.('aria-pressed', String(isWarmupMode));
  }
}

export function toggleWarmupMode() {
  const nextState = !isWarmupMode;
  setWarmupMode(nextState);
  if (nextState && !(audioEngine.getCurrentTrack?.() || audioEngine.currentTrack)) {
    const nextTrack = pickNextWarmupTrack(null);
    if (nextTrack) {
      handlePlayTrack(nextTrack, { skipAutoScore: true });
    } else {
      setWarmupMode(false);
      console.warn('Warm-Up Auto-Play: Keine Songs geladen');
      if (typeof alert === 'function') {
        alert('Keine Songs geladen. Bitte zuerst Songs oder Demo-Sounds laden.');
      }
    }
  }
  return isWarmupMode;
}

/**
 * STOP & Hard-Cut Feedback Helpers (1x tap = 3s fade, 2nd tap while fading = 80ms Hard-Cut)
 */
function updateStopFadeUI(fading) {
  if (typeof document === 'undefined') return;
  const stopBtns = [
    document.getElementById('btn-stop'),
    document.getElementById('btn-mobile-stop')
  ];
  for (const btn of stopBtns) {
    if (!btn) continue;
    btn.classList?.toggle?.('is-fading-out', fading);
    const hint = btn.querySelector?.('.stop-fade-hint');
    if (hint) {
      hint.textContent = fading ? 'Fading… (2× = Cut)' : '';
    }
  }
}

export function resetStopFadeState() {
  if (stopFadeTimer) {
    clearTimeout(stopFadeTimer);
    stopFadeTimer = null;
  }
  isStopFading = false;
  updateStopFadeUI(false);
}

export function hardStopAudio() {
  revertRecentScoreOnStop(Date.now(), { isHardCut: true });
  resetStopFadeState();
  setWarmupMode(false);
  stopTimeoutCountdown();
  hidePauseOverlay();
  clearActiveTriggerButton();
  stopProgressLoop();
  stopVisualizerLoop();

  if (typeof audioEngine.hardStop === 'function') {
    audioEngine.hardStop(80);
  } else {
    audioEngine.stop(0);
  }

  if (typeof document !== 'undefined') {
    if (stopHardCutFlashTimer) clearTimeout(stopHardCutFlashTimer);
    const stopBtns = [
      document.getElementById('btn-stop'),
      document.getElementById('btn-mobile-stop')
    ];
    for (const btn of stopBtns) {
      btn?.classList?.add?.('is-hard-cut');
    }
    stopHardCutFlashTimer = setTimeout(() => {
      stopHardCutFlashTimer = null;
      for (const btn of stopBtns) {
        btn?.classList?.remove?.('is-hard-cut');
      }
    }, 260);
    if (typeof stopHardCutFlashTimer?.unref === 'function') {
      stopHardCutFlashTimer.unref();
    }
  }
}

export function stopAudio() {
  if (isStopFading || audioEngine.isFadingOut?.()) {
    hardStopAudio();
    return;
  }

  revertRecentScoreOnStop(Date.now(), { isHardCut: false });
  const wasPlaying = Boolean(audioEngine.getCurrentTrack?.() || audioEngine.currentAudioElement);

  setWarmupMode(false);
  stopTimeoutCountdown();
  hidePauseOverlay();
  clearActiveTriggerButton();
  stopProgressLoop();
  stopVisualizerLoop();
  audioEngine.stop(3000);

  if (wasPlaying) {
    isStopFading = true;
    updateStopFadeUI(true);
    if (stopFadeTimer) clearTimeout(stopFadeTimer);
    stopFadeTimer = setTimeout(() => {
      stopFadeTimer = null;
      isStopFading = false;
      updateStopFadeUI(false);
    }, 3000);
    if (typeof stopFadeTimer?.unref === 'function') {
      stopFadeTimer.unref();
    }
  }
}

/**
 * Native <dialog> Popup Controllers (One-Shot SFX & Settings)
 */
function openNativeDialog(dialogEl, triggerBtns = []) {
  if (!dialogEl) return;
  if (typeof dialogEl.showModal === 'function') {
    if (!dialogEl.open) {
      dialogEl.showModal();
    }
  } else {
    dialogEl.open = true;
    if (dialogEl.style) dialogEl.style.display = 'flex';
  }
  dialogEl.setAttribute?.('aria-hidden', 'false');
  for (const btn of triggerBtns) {
    btn?.setAttribute?.('aria-expanded', 'true');
  }
}

function closeNativeDialog(dialogEl, triggerBtns = []) {
  if (!dialogEl) return;
  if (typeof dialogEl.close === 'function') {
    if (dialogEl.open) {
      dialogEl.close();
    }
  } else {
    dialogEl.open = false;
    if (dialogEl.style) dialogEl.style.display = 'none';
  }
  for (const btn of triggerBtns) {
    btn?.setAttribute?.('aria-expanded', 'false');
  }
}

export function openSfxModal() {
  if (typeof document === 'undefined') return;
  const dialogEl = document.getElementById('sfx-modal');
  const triggers = [
    document.getElementById('btn-sfx-menu'),
    document.getElementById('btn-mobile-sfx')
  ];
  openNativeDialog(dialogEl, triggers);
}

export function closeSfxModal() {
  if (typeof document === 'undefined') return;
  const dialogEl = document.getElementById('sfx-modal');
  const triggers = [
    document.getElementById('btn-sfx-menu'),
    document.getElementById('btn-mobile-sfx')
  ];
  closeNativeDialog(dialogEl, triggers);
}

export function triggerOneShotSfx(sfxId, padBtn = null) {
  const triggered = typeof audioEngine.playOneShotSfx === 'function'
    ? audioEngine.playOneShotSfx(sfxId)
    : false;
  if (triggered && padBtn?.classList) {
    padBtn.classList.remove('is-firing');
    padBtn.classList.add('is-firing');
    const timer = setTimeout(() => {
      padBtn.classList?.remove?.('is-firing');
    }, 260);
    if (typeof timer?.unref === 'function') {
      timer.unref();
    }
  }
  return triggered;
}

export function applySfxVolume(percentVal) {
  const pct = Math.min(100, Math.max(20, Math.round(Number(percentVal) || 90)));
  if (typeof audioEngine.setSfxVolume === 'function') {
    audioEngine.setSfxVolume(pct / 100);
  }
  if (typeof document !== 'undefined') {
    const slider = document.getElementById('sfx-volume-slider');
    const valueEl = document.getElementById('sfx-volume-value');
    if (slider) slider.value = String(pct);
    if (valueEl) valueEl.textContent = `${pct}%`;
  }
  saveSetting('sfxVolume', pct).catch((err) => console.warn('Save sfxVolume error:', err));
  return pct;
}

export function openSettingsModal() {
  if (typeof document === 'undefined') return;
  const dialogEl = document.getElementById('settings-modal');
  const trigger = document.getElementById('btn-settings-menu');
  openNativeDialog(dialogEl, [trigger]);
}

export function closeSettingsModal() {
  if (typeof document === 'undefined') return;
  const dialogEl = document.getElementById('settings-modal');
  const trigger = document.getElementById('btn-settings-menu');
  closeNativeDialog(dialogEl, [trigger]);
}

/**
 * #1: Bluetooth Anti-Sleep Keep-Alive Toggle
 */
export function applyBluetoothKeepAlive(enabled) {
  const isEnabled = Boolean(enabled);
  audioEngine.setBluetoothKeepAlive?.(isEnabled);
  if (typeof document !== 'undefined') {
    const btn = document.getElementById('btn-bt-keepalive');
    const statusEl = document.getElementById('bt-keepalive-status');
    btn?.classList?.toggle?.('is-active', isEnabled);
    btn?.setAttribute?.('aria-pressed', String(isEnabled));
    if (statusEl) statusEl.textContent = isEnabled ? 'EIN' : 'AUS';
  }
  saveSetting('btKeepAlive', isEnabled).catch((err) => console.warn('Save btKeepAlive error:', err));
  return isEnabled;
}

export function toggleBluetoothKeepAlive() {
  return applyBluetoothKeepAlive(!audioEngine.getBluetoothKeepAlive?.());
}

/**
 * #4: Custom One-Shot SFX Triggers & Direct Import
 */
export function triggerCustomSfxTrack(trackId, padBtn = null) {
  const track = allTracks.find((t) => t.id === trackId);
  if (!track) return false;
  if (typeof audioEngine.playOneShotTrack === 'function') {
    audioEngine.playOneShotTrack(track);
  }
  if (padBtn?.classList) {
    padBtn.classList.remove('is-firing');
    padBtn.classList.add('is-firing');
    const timer = setTimeout(() => {
      padBtn.classList?.remove?.('is-firing');
    }, 260);
    if (typeof timer?.unref === 'function') timer.unref();
  }
  return true;
}

export async function processSelectedSfxFiles(fileList) {
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
    if (existingNames.has(lowerName)) continue;
    existingNames.add(lowerName);

    const track = parseTrackFromFilename(file.name, file, file.type, `effekte/${file.name}`);
    newTracks.push(track);
  }

  if (newTracks.length > 0) {
    await saveTracks(newTracks);
    allTracks = await getAllTracks();
    renderAll();
  }
}

export async function handleDeleteCustomSfx(trackId) {
  return deleteSingleTrack(trackId, { skipConfirm: true });
}

/**
 * #5: Song Context Menu (Long-Press / Right-Click)
 */
const CATEGORY_DEFAULT_SUFFIX = {
  ass_angriff: '_HIT',
  block: '_BLOCK',
  gegner: '_OPP',
  sonstiges: '',
  spass_extras: '_FUN',
  timeout: '_TIMEOUT',
  walkon: '_WALKON',
  pause: '_PAUSE',
  sixseven: '_SIXSEVEN',
  sfx: '_SFX'
};

function syncTrackContextModalUI(track) {
  if (typeof document === 'undefined' || !track) return;
  const titleEl = document.getElementById('track-context-title');
  if (titleEl) titleEl.textContent = track.cleanTitle || cleanTrackTitle(track.name || '');

  const metaEl = document.getElementById('track-context-meta');
  if (metaEl) {
    const catLabel = CATEGORY_DEFS[track.category]?.label || track.category;
    const count = typeof track.playCount === 'number' ? track.playCount : 0;
    metaEl.textContent = `${catLabel} · ${count}× gespielt`;
  }

  const pinBtn = document.getElementById('btn-context-pin');
  const pinLabel = document.getElementById('btn-context-pin-label');
  const isPinned = Boolean(track.pinned);
  pinBtn?.classList?.toggle?.('is-active', isPinned);
  pinBtn?.setAttribute?.('aria-pressed', String(isPinned));
  if (pinLabel) {
    pinLabel.textContent = isPinned ? '⭐ Angepinnt (Klick zum Loslösen)' : '⭐ Als Favorit oben anpinnen';
  }

  const gainPct =
    typeof track.customGain === 'number' && !isNaN(track.customGain)
      ? Math.round(track.customGain * 100)
      : 100;
  const gainSlider = document.getElementById('context-gain-slider');
  const gainValue = document.getElementById('context-gain-value');
  if (gainSlider) gainSlider.value = String(gainPct);
  if (gainValue) gainValue.textContent = `${gainPct}%`;

  const catBtns = document.querySelectorAll?.('.context-cat-btn[data-target-category]');
  catBtns?.forEach?.((btn) => {
    const targetCat = btn.getAttribute?.('data-target-category');
    btn.classList?.toggle?.('is-active', targetCat === track.category);
  });
}

export function openTrackContextModal(trackId) {
  const track = allTracks.find((t) => t.id === trackId);
  if (!track) return false;
  contextMenuTrackId = trackId;
  if (typeof document === 'undefined') return true;
  syncTrackContextModalUI(track);
  const dialogEl = document.getElementById('track-context-modal');
  openNativeDialog(dialogEl, []);
  return true;
}

export function closeTrackContextModal() {
  contextMenuTrackId = null;
  if (typeof document === 'undefined') return;
  const dialogEl = document.getElementById('track-context-modal');
  closeNativeDialog(dialogEl, []);
}

export async function toggleTrackPinned(trackId = contextMenuTrackId) {
  const track = allTracks.find((t) => t.id === trackId);
  if (!track) return false;
  track.pinned = !track.pinned;
  await updateTrackMeta(track.id, { pinned: track.pinned }).catch((err) =>
    console.warn('Failed to update track pinned state:', err)
  );
  renderAll();
  syncTrackContextModalUI(track);
  return track.pinned;
}

export async function changeTrackCategory(trackId = contextMenuTrackId, newCategory) {
  const track = allTracks.find((t) => t.id === trackId);
  if (!track || !Object.prototype.hasOwnProperty.call(CATEGORY_DEFAULT_SUFFIX, newCategory)) {
    return false;
  }
  const nextSuffix =
    newCategory === 'ass_angriff' && track.suffix === '_ACE'
      ? '_ACE'
      : CATEGORY_DEFAULT_SUFFIX[newCategory];
  track.category = newCategory;
  track.suffix = nextSuffix;
  track.assignedCategory = newCategory === 'sonstiges' ? null : newCategory;

  await updateTrackMeta(track.id, {
    category: track.category,
    suffix: track.suffix,
    assignedCategory: track.assignedCategory
  }).catch((err) => console.warn('Failed to update track category:', err));

  renderAll();
  syncTrackContextModalUI(track);
  return true;
}

export async function applyContextTrackGain(percentVal, trackId = contextMenuTrackId) {
  const pct = Math.min(200, Math.max(20, Math.round(Number(percentVal) || 100)));
  const customGain = Math.round(pct) / 100;

  if (typeof document !== 'undefined') {
    const slider = document.getElementById('context-gain-slider');
    const valEl = document.getElementById('context-gain-value');
    if (slider) slider.value = String(pct);
    if (valEl) valEl.textContent = `${pct}%`;
  }

  const track = allTracks.find((t) => t.id === trackId);
  if (track) {
    track.customGain = customGain;
    if (audioEngine.currentTrack?.id === track.id) {
      audioEngine.currentTrack.customGain = customGain;
      audioEngine.updateCurrentTrackGain();
    }
    await updateTrackGain(track.id, { customGain }).catch((err) =>
      console.warn('Failed to save context track customGain:', err)
    );
  }
  return customGain;
}

export async function deleteSingleTrack(trackId = contextMenuTrackId, { skipConfirm = false } = {}) {
  const idx = allTracks.findIndex((t) => t.id === trackId);
  if (idx === -1) return false;
  const track = allTracks[idx];

  if (!skipConfirm && typeof confirm === 'function') {
    const ok = confirm(`Song „${track.cleanTitle || track.name}“ wirklich aus dem Soundboard entfernen?`);
    if (!ok) return false;
  }

  if ((audioEngine.getCurrentTrack?.() || audioEngine.currentTrack)?.id === trackId) {
    audioEngine.stop(50);
  }
  audioEngine.clearSfxCache?.(trackId);
  await deleteTrack(trackId).catch((err) => console.warn('Failed to delete track:', err));

  const currentIdx = allTracks.findIndex((t) => t.id === trackId);
  if (currentIdx !== -1) {
    allTracks.splice(currentIdx, 1);
  }
  renderAll();
  if (contextMenuTrackId === trackId) {
    closeTrackContextModal();
  }
  return true;
}

/**
 * #6: Keyboard & NumPad Shortcuts + Media Session API
 */
export function applyShortcutsEnabled(enabled) {
  shortcutsEnabled = Boolean(enabled);
  if (typeof document !== 'undefined') {
    const btn = document.getElementById('btn-shortcuts-toggle');
    const statusEl = document.getElementById('shortcuts-toggle-status');
    btn?.classList?.toggle?.('is-active', shortcutsEnabled);
    btn?.setAttribute?.('aria-pressed', String(shortcutsEnabled));
    if (statusEl) statusEl.textContent = shortcutsEnabled ? 'EIN' : 'AUS';
  }
  saveSetting('shortcutsEnabled', shortcutsEnabled).catch((err) =>
    console.warn('Save shortcutsEnabled error:', err)
  );
  return shortcutsEnabled;
}

export function toggleShortcutsEnabled() {
  return applyShortcutsEnabled(!shortcutsEnabled);
}

export function updateMediaSession(track) {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
  try {
    if (track) {
      if (typeof MediaMetadata === 'function') {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.cleanTitle || track.name || 'Volleyball DJ',
          artist: 'SV 1845 Esslingen',
          album: CATEGORY_DEFS[track.category]?.label || 'Soundboard'
        });
      }
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.setActionHandler?.('pause', () => stopAudio());
      navigator.mediaSession.setActionHandler?.('stop', () => stopAudio());
    } else {
      navigator.mediaSession.playbackState = 'none';
    }
  } catch (_) {}
}

export function handleGlobalKeydown(e) {
  if (!shortcutsEnabled || !e) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (typeof document !== 'undefined') {
    const activeTag = document.activeElement?.tagName?.toUpperCase?.() || '';
    if (
      activeTag === 'INPUT' ||
      activeTag === 'TEXTAREA' ||
      activeTag === 'SELECT' ||
      document.activeElement?.isContentEditable
    ) {
      return;
    }

    const splash = document.getElementById('startup-splash');
    if (splash && !splash.classList?.contains?.('dismissed') && splash.style?.display !== 'none') {
      return;
    }

    const scrubberOpen = document.getElementById('scrubber-modal')?.style?.display === 'flex';
    const eqOpen = document.getElementById('eq-modal')?.style?.display === 'flex';
    if (scrubberOpen || eqOpen) {
      return;
    }

    const openDialog = document.querySelector?.('dialog[open]');
    const keyLower = (e.key || '').toLowerCase();
    if (openDialog) {
      if (openDialog.id === 'sfx-modal' && keyLower === 's') {
        e.preventDefault?.();
        closeSfxModal();
      }
      return;
    }
  }

  const key = (e.key || '').toLowerCase();
  switch (key) {
    case ' ':
      e.preventDefault?.();
      stopAudio();
      return true;
    case 'a':
      e.preventDefault?.();
      playAce();
      return true;
    case 'b':
      e.preventDefault?.();
      playBlock();
      return true;
    case 'e':
      e.preventDefault?.();
      playRandomOwn();
      return true;
    case 'g':
      e.preventDefault?.();
      playRandomOpponent();
      return true;
    case 't':
      e.preventDefault?.();
      playTimeout();
      return true;
    case 'w':
      e.preventDefault?.();
      playWalkOn();
      return true;
    case '6':
    case '7':
      e.preventDefault?.();
      playSixSeven();
      return true;
    case '1':
    case '2':
    case '3':
    case '4':
      e.preventDefault?.();
      playPauseSlot(Number(key));
      return true;
    case 's':
      e.preventDefault?.();
      openSfxModal();
      return true;
    case 'u':
      e.preventDefault?.();
      toggleWarmupMode();
      return true;
    case 'arrowup':
      e.preventDefault?.();
      applyVolume(Math.round(audioEngine.getMasterVolume() * 100) + 5);
      return true;
    case 'arrowdown':
      e.preventDefault?.();
      applyVolume(Math.round(audioEngine.getMasterVolume() * 100) - 5);
      return true;
    case '/': {
      e.preventDefault?.();
      const searchEl = typeof document !== 'undefined' ? document.getElementById('search-input') : null;
      searchEl?.focus?.();
      return true;
    }
    default:
      return false;
  }
}

/**
 * #7: JSON Settings & Track Metadata Backup (Export / Import)
 */
export function buildSettingsBackupPayload() {
  const tracksMeta = {};
  for (const t of allTracks) {
    if (!t?.name) continue;
    const key = t.name.toLowerCase();
    const meta = {};
    if (typeof t.customGain === 'number' && !isNaN(t.customGain)) meta.customGain = t.customGain;
    if (t.pinned) meta.pinned = true;
    if (t.category) meta.category = t.category;
    if (t.suffix) meta.suffix = t.suffix;
    if (t.cleanTitle) meta.cleanTitle = t.cleanTitle;
    tracksMeta[key] = meta;
  }

  return {
    app: 'sv1845-volleyball-dj',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      volume: Math.round(audioEngine.getMasterVolume() * 100),
      sfxVolume: Math.round((audioEngine.getSfxVolume?.() ?? 0.9) * 100),
      autoNormalize: audioEngine.getAutoNormalize(),
      eqPreset: audioEngine.getEqPreset(),
      zoom: currentZoom,
      headerCollapsed: isHeaderCollapsed,
      theme: getCurrentTheme(),
      btKeepAlive: Boolean(audioEngine.getBluetoothKeepAlive?.()),
      shortcutsEnabled,
      pauseAutoFade: pauseAutoFadeEnabled,
      scoreboardVisible: isScoreboardVisible
    },
    tracksMeta
  };
}

export function exportSettingsBackup() {
  const payload = buildSettingsBackupPayload();
  const jsonStr = JSON.stringify(payload, null, 2);

  if (
    typeof document !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `sv1845-soundboard-backup-${dateStr}.json`;
      document.body?.appendChild?.(a);
      a.click?.();
      a.remove?.();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.warn('Could not trigger backup download:', err);
    }
  }

  return jsonStr;
}

export async function importSettingsBackup(jsonInput) {
  let data = jsonInput;
  if (typeof jsonInput === 'string') {
    data = JSON.parse(jsonInput);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Ungültiges Backup-Format');
  }

  let appliedSettings = 0;
  const s = data.settings;
  if (s && typeof s === 'object') {
    if (typeof s.volume === 'number') { applyVolume(s.volume); appliedSettings++; }
    if (typeof s.sfxVolume === 'number') { applySfxVolume(s.sfxVolume); appliedSettings++; }
    if (typeof s.autoNormalize === 'boolean') { applyAutoNormalize(s.autoNormalize); appliedSettings++; }
    if (typeof s.eqPreset === 'string') { applyEqPreset(s.eqPreset); appliedSettings++; }
    if (typeof s.zoom === 'number') { applyZoom(s.zoom); appliedSettings++; }
    if (typeof s.headerCollapsed === 'boolean') { setHeaderCollapsed(s.headerCollapsed); appliedSettings++; }
    if (typeof s.theme === 'string') { setTheme(s.theme); appliedSettings++; }
    if (typeof s.btKeepAlive === 'boolean') { applyBluetoothKeepAlive(s.btKeepAlive); appliedSettings++; }
    if (typeof s.shortcutsEnabled === 'boolean') { applyShortcutsEnabled(s.shortcutsEnabled); appliedSettings++; }
    if (typeof s.pauseAutoFade === 'boolean') { setPauseAutoFade(s.pauseAutoFade); appliedSettings++; }
    if (typeof s.scoreboardVisible === 'boolean') { setScoreboardVisible(s.scoreboardVisible); appliedSettings++; }
  }

  let updatedTracks = 0;
  const metaMap = data.tracksMeta;
  if (metaMap && typeof metaMap === 'object') {
    for (const track of allTracks) {
      const entry = metaMap[(track.name || '').toLowerCase()];
      if (!entry || typeof entry !== 'object') continue;
      const updates = {};
      if (typeof entry.customGain === 'number' && !isNaN(entry.customGain)) {
        updates.customGain = entry.customGain;
        track.customGain = entry.customGain;
      }
      if (typeof entry.pinned === 'boolean') {
        updates.pinned = entry.pinned;
        track.pinned = entry.pinned;
      }
      if (typeof entry.category === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_DEFAULT_SUFFIX, entry.category)) {
        updates.category = entry.category;
        updates.suffix = typeof entry.suffix === 'string' ? entry.suffix : CATEGORY_DEFAULT_SUFFIX[entry.category];
        updates.assignedCategory = entry.category === 'sonstiges' ? null : entry.category;
        track.category = updates.category;
        track.suffix = updates.suffix;
        track.assignedCategory = updates.assignedCategory;
      }
      if (typeof entry.cleanTitle === 'string' && entry.cleanTitle.trim()) {
        updates.cleanTitle = entry.cleanTitle.trim();
        track.cleanTitle = updates.cleanTitle;
      }
      if (Object.keys(updates).length > 0) {
        await updateTrackMeta(track.id, updates).catch(() => {});
        updatedTracks++;
      }
    }
    if (updatedTracks > 0) {
      renderAll();
    }
  }

  return { appliedSettings, updatedTracks };
}

/**
 * #12: Optional Minimalist Header Scoreboard (auto-coupled to soundboard buttons + short mistap correction)
 */
export const SCORE_CORRECTION_WINDOW_MS = 5000;
export const SCORE_STOP_UNDO_WINDOW_MS = 2500;

const HOME_SCORE_CATEGORIES = new Set([
  'ass_angriff',
  'block',
  'sonstiges',
  'sonstiges_1',
  'sonstiges_2',
  'sonstiges_3'
]);

export function getScoreSideForTrack(track) {
  if (!track || !track.category) return null;
  if (HOME_SCORE_CATEGORIES.has(track.category)) return 'home';
  if (track.category === 'gegner') return 'guest';
  return null;
}

export function getScoreboardCrunchStatus(state = scoreboardState) {
  const home = Math.max(0, Number(state?.home) || 0);
  const guest = Math.max(0, Number(state?.guest) || 0);

  if (home < 24 && guest < 24) {
    return { isCrunch: false, label: '' };
  }
  if (home === guest) {
    return { isCrunch: true, label: 'DEUCE' };
  }
  return { isCrunch: true, label: 'SATZBALL' };
}

function flashScoreElement(id, className, timerRefGetter, timerRefSetter, durationMs) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (!el || !el.classList) return;
  el.classList.remove(className);
  el.classList.add(className);
  const prev = timerRefGetter();
  if (prev) clearTimeout(prev);
  const t = setTimeout(() => {
    timerRefSetter(null);
    el.classList?.remove?.(className);
  }, durationMs);
  if (typeof t?.unref === 'function') t.unref();
  timerRefSetter(t);
}

function flashScoreCorrected() {
  flashScoreElement(
    'header-scoreboard',
    'is-corrected',
    () => scoreCorrectedFlashTimer,
    (v) => { scoreCorrectedFlashTimer = v; },
    900
  );
}

function flashScoreValueBump(side) {
  const id = side === 'guest' ? 'score-guest-val' : 'score-home-val';
  flashScoreElement(
    id,
    'is-bumped',
    () => scoreBumpTimer,
    (v) => { scoreBumpTimer = v; },
    380
  );
}

export function renderScoreboardUI() {
  if (typeof document === 'undefined') return;
  const sbEl = document.getElementById('header-scoreboard');
  const toggleBtn = document.getElementById('btn-scoreboard-toggle');
  const statusEl = document.getElementById('scoreboard-toggle-status');

  if (sbEl && sbEl.style) {
    sbEl.style.display = isScoreboardVisible ? 'inline-flex' : 'none';
  }
  toggleBtn?.classList?.toggle?.('is-active', isScoreboardVisible);
  toggleBtn?.setAttribute?.('aria-pressed', String(isScoreboardVisible));
  if (statusEl) statusEl.textContent = isScoreboardVisible ? 'EIN' : 'AUS';

  const homeVal = document.getElementById('score-home-val');
  const guestVal = document.getElementById('score-guest-val');
  const boardContainer = document.getElementById('board-container');

  if (homeVal) homeVal.textContent = String(scoreboardState.home);
  if (guestVal) guestVal.textContent = String(scoreboardState.guest);

  const crunch = getScoreboardCrunchStatus(scoreboardState);
  sbEl?.classList?.toggle?.('is-crunch-time', crunch.isCrunch);
  boardContainer?.classList?.toggle?.('is-crunch-time', isScoreboardVisible && crunch.isCrunch);
}

function persistScoreboardState() {
  saveSetting('scoreboardState', { ...scoreboardState }).catch((err) =>
    console.warn('Save scoreboardState error:', err)
  );
}

export function setScoreboardVisible(visible) {
  isScoreboardVisible = Boolean(visible);
  renderScoreboardUI();
  saveSetting('scoreboardVisible', isScoreboardVisible).catch((err) =>
    console.warn('Save scoreboardVisible error:', err)
  );
  return isScoreboardVisible;
}

export function toggleScoreboardVisible() {
  return setScoreboardVisible(!isScoreboardVisible);
}

export function recordButtonScore(side, nowMs = Date.now()) {
  if (!isScoreboardVisible || isWarmupMode || (side !== 'home' && side !== 'guest')) {
    return { action: 'ignored', ...scoreboardState };
  }

  const ts = typeof nowMs === 'number' && !isNaN(nowMs) ? nowMs : Date.now();
  if (lastScoreEvent && ts - lastScoreEvent.timestamp <= SCORE_CORRECTION_WINDOW_MS) {
    if (lastScoreEvent.side !== side) {
      const prevSide = lastScoreEvent.side;
      scoreboardState[prevSide] = Math.max(0, (Number(scoreboardState[prevSide]) || 0) - 1);
      scoreboardState[side] = Math.max(0, (Number(scoreboardState[side]) || 0) + 1);
      lastScoreEvent = { side, timestamp: ts };
      renderScoreboardUI();
      flashScoreCorrected();
      flashScoreValueBump(side);
      persistScoreboardState();
      return { action: 'corrected', from: prevSide, to: side, ...scoreboardState };
    }
    return { action: 'deduped', side, ...scoreboardState };
  }

  scoreboardState[side] = Math.max(0, (Number(scoreboardState[side]) || 0) + 1);
  lastScoreEvent = { side, timestamp: ts };
  renderScoreboardUI();
  flashScoreValueBump(side);
  persistScoreboardState();
  return { action: 'scored', side, ...scoreboardState };
}

export function revertRecentScoreOnStop(nowMs = Date.now(), { isHardCut = false } = {}) {
  if (!isScoreboardVisible || !lastScoreEvent) {
    return false;
  }
  const ts = typeof nowMs === 'number' && !isNaN(nowMs) ? nowMs : Date.now();
  const windowMs = isHardCut ? SCORE_CORRECTION_WINDOW_MS : SCORE_STOP_UNDO_WINDOW_MS;
  if (ts - lastScoreEvent.timestamp > windowMs) {
    return false;
  }

  const side = lastScoreEvent.side;
  scoreboardState[side] = Math.max(0, (Number(scoreboardState[side]) || 0) - 1);
  lastScoreEvent = null;
  renderScoreboardUI();
  flashScoreCorrected();
  persistScoreboardState();
  return true;
}

export function resetScoreboard() {
  lastScoreEvent = null;
  if (scoreboardState.home === 0 && scoreboardState.guest === 0) {
    return { ...scoreboardState };
  }
  scoreboardState = { home: 0, guest: 0 };
  renderScoreboardUI();
  persistScoreboardState();
  return { ...scoreboardState };
}

export async function handleClearAll() {
  const confirmed = typeof confirm === 'function'
    ? confirm('Möchtest du wirklich alle Songs aus der Liste entfernen?')
    : true;
  if (!confirmed) return;

  await clearAllTracks();
  audioEngine.clearSfxCache?.();
  allTracks = [];
  renderAll();
  if (typeof document !== 'undefined') {
    closeSettingsModal();
  }
}

export const APP_VERSION = '1.16.1';

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

    const track = parseTrackFromFilename(file.name, file, file.type, file.webkitRelativePath || '');
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
    resetStopFadeState();
    updatePlayingUI(track ? track.id : null);
    updateNowPlayingHeader(track);
    updateMediaSession(track);
    startProgressLoop();
    startVisualizerLoop();
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
    stopProgressLoop();
    stopVisualizerLoop();
    updatePlayingUI(null);
    updateNowPlayingHeader(null);
    updateMediaSession(null);
    hidePauseOverlay();
    clearActiveTriggerButton();
    closeScrubberModal();
  };
  audioEngine.onTrackEnd = (finishedTrack) => {
    stopProgressLoop();
    stopVisualizerLoop();
    updatePlayingUI(null);
    updateNowPlayingHeader(null);
    updateMediaSession(null);
    hidePauseOverlay();
    clearActiveTriggerButton();
    closeScrubberModal();

    if (isWarmupMode) {
      const nextTrack = pickNextWarmupTrack(finishedTrack);
      if (nextTrack) {
        handlePlayTrack(nextTrack, { skipAutoScore: true });
      } else {
        setWarmupMode(false);
      }
    }
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

    // Auto-resume AudioContext on returning from background & pause visualizer when hidden
    if (typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          stopVisualizerLoop();
          return;
        }
        if (document.visibilityState === 'visible') {
          if (audioEngine.audioCtx && (audioEngine.audioCtx.state === 'suspended' || audioEngine.audioCtx.state === 'interrupted')) {
            const res = typeof audioEngine.audioCtx.resume === 'function' ? audioEngine.audioCtx.resume() : null;
            if (res && typeof res.catch === 'function') res.catch(() => {});
          }
          if (audioEngine.getCurrentTrack?.() || audioEngine.currentTrack) {
            startVisualizerLoop();
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
    let lastPointerDown = 0;
    let suppressClickUntil = 0;
    let lastClickOnly = 0;
    const trigger = (e) => {
      const now = Date.now();
      if (e?.type === 'pointerdown') {
        if (now - lastPointerDown < 70) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          return;
        }
        lastPointerDown = now;
        suppressClickUntil = now + 450;
        if (typeof e.preventDefault === 'function') e.preventDefault();
        action(e);
        return;
      }

      // Suppress synthetic click immediately following pointerdown
      if (now < suppressClickUntil) {
        if (typeof e?.preventDefault === 'function') e.preventDefault();
        return;
      }
      if (now - lastClickOnly < 80) {
        if (typeof e?.preventDefault === 'function') e.preventDefault();
        return;
      }
      lastClickOnly = now;
      action(e);
    };
    btn.addEventListener('pointerdown', trigger);
    btn.addEventListener('click', trigger);
  };

  // Track button click delegation for scrollable song lists (board and drawer)
  // Uses native click + passive touch long-press + contextmenu (never pointerdown, so native touch scrolling is preserved)
  const setupSongListDelegation = (container) => {
    if (!container || typeof container.addEventListener !== 'function') return;
    let longPressTimer = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let suppressNextClickUntil = 0;

    const cancelLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    container.addEventListener(
      'touchstart',
      (e) => {
        const btn = e?.target?.closest?.('.song-btn, .track-btn');
        if (!btn) return;
        const trackId = btn.getAttribute('data-track-id');
        if (!trackId) return;
        const touch = e.touches?.[0];
        touchStartX = touch?.clientX || 0;
        touchStartY = touch?.clientY || 0;
        cancelLongPress();
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          suppressNextClickUntil = Date.now() + 650;
          try {
            navigator?.vibrate?.(25);
          } catch (_) {}
          openTrackContextModal(trackId);
        }, 500);
        if (typeof longPressTimer?.unref === 'function') longPressTimer.unref();
      },
      { passive: true }
    );

    container.addEventListener(
      'touchmove',
      (e) => {
        if (!longPressTimer) return;
        const touch = e.touches?.[0];
        if (!touch) return;
        const dx = Math.abs((touch.clientX || 0) - touchStartX);
        const dy = Math.abs((touch.clientY || 0) - touchStartY);
        if (dx > 10 || dy > 10) {
          cancelLongPress();
        }
      },
      { passive: true }
    );

    container.addEventListener('touchend', cancelLongPress, { passive: true });
    container.addEventListener('touchcancel', cancelLongPress, { passive: true });

    container.addEventListener('contextmenu', (e) => {
      const btn = e?.target?.closest?.('.song-btn, .track-btn');
      if (!btn) return;
      e.preventDefault?.();
      cancelLongPress();
      const trackId = btn.getAttribute('data-track-id');
      if (trackId) {
        openTrackContextModal(trackId);
      }
    });

    container.addEventListener('click', (e) => {
      if (Date.now() < suppressNextClickUntil) {
        e.preventDefault?.();
        return;
      }
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

  // Scrubber modal event listeners (both expanded banner and collapsed header pill)
  const bindNowPlayingScrubberTrigger = (el) => {
    if (!el || typeof el.addEventListener !== 'function') return;
    el.addEventListener('click', () => {
      if (audioEngine.getCurrentTrack() || audioEngine.currentTrack) {
        openScrubberModal();
      }
    });
    el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && (audioEngine.getCurrentTrack() || audioEngine.currentTrack)) {
        e.preventDefault();
        openScrubberModal();
      }
    });
  };
  bindNowPlayingScrubberTrigger(document.getElementById('header-now-playing'));
  bindNowPlayingScrubberTrigger(document.getElementById('compact-now-playing'));

  // Warm-Up Auto-Play toggle (Desktop & Mobile)
  const btnWarmupToggle = document.getElementById('btn-warmup-toggle');
  if (btnWarmupToggle && typeof btnWarmupToggle.addEventListener === 'function') {
    btnWarmupToggle.addEventListener('click', () => toggleWarmupMode());
  }
  const btnMobileWarmup = document.getElementById('btn-mobile-warmup');
  if (btnMobileWarmup && typeof btnMobileWarmup.addEventListener === 'function') {
    btnMobileWarmup.addEventListener('click', () => toggleWarmupMode());
  }

  // Pause overlay countdown controls
  const btnPauseAdd30 = document.getElementById('btn-pause-add30');
  if (btnPauseAdd30 && typeof btnPauseAdd30.addEventListener === 'function') {
    btnPauseAdd30.addEventListener('click', () => addPauseTime(30));
  }
  const btnPauseReset = document.getElementById('btn-pause-reset');
  if (btnPauseReset && typeof btnPauseReset.addEventListener === 'function') {
    btnPauseReset.addEventListener('click', () => startPauseCountdown(PAUSE_DURATION_SEC, true));
  }
  const btnPauseAutofade = document.getElementById('btn-pause-autofade');
  if (btnPauseAutofade && typeof btnPauseAutofade.addEventListener === 'function') {
    btnPauseAutofade.addEventListener('click', () => setPauseAutoFade(!pauseAutoFadeEnabled));
  }

  // Native <dialog> light-dismiss fallback for browsers lacking closedBy (e.g. Safari)
  const setupDialogLightDismiss = (dialogEl) => {
    if (!dialogEl || typeof dialogEl.addEventListener !== 'function') return;
    if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) {
      return;
    }
    const isOutside = (e) => {
      if (typeof dialogEl.getBoundingClientRect !== 'function') return false;
      const r = dialogEl.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    dialogEl.addEventListener('pointerdown', (e) => {
      pressedOutside = isOutside(e);
    });
    dialogEl.addEventListener('pointerup', (e) => {
      if (pressedOutside && isOutside(e)) {
        dialogEl.close?.();
      }
      pressedOutside = false;
    });
  };

  // One-Shot SFX Popup (<dialog id="sfx-modal">)
  const btnSfxMenu = document.getElementById('btn-sfx-menu');
  if (btnSfxMenu && typeof btnSfxMenu.addEventListener === 'function') {
    btnSfxMenu.addEventListener('click', () => openSfxModal());
  }
  const btnMobileSfx = document.getElementById('btn-mobile-sfx');
  if (btnMobileSfx && typeof btnMobileSfx.addEventListener === 'function') {
    btnMobileSfx.addEventListener('click', () => openSfxModal());
  }
  const btnCloseSfx = document.getElementById('btn-close-sfx');
  if (btnCloseSfx && typeof btnCloseSfx.addEventListener === 'function') {
    btnCloseSfx.addEventListener('click', () => closeSfxModal());
  }
  const sfxModal = document.getElementById('sfx-modal');
  if (sfxModal && typeof sfxModal.addEventListener === 'function') {
    setupDialogLightDismiss(sfxModal);
    sfxModal.addEventListener('close', () => {
      sfxModal.returnValue = '';
      document.getElementById('btn-sfx-menu')?.setAttribute?.('aria-expanded', 'false');
      document.getElementById('btn-mobile-sfx')?.setAttribute?.('aria-expanded', 'false');
    });
  }
  const sfxPadsGrid = document.getElementById('sfx-pads-grid');
  if (sfxPadsGrid && typeof sfxPadsGrid.addEventListener === 'function') {
    let lastPadPointerDown = 0;
    const handlePadActivate = (e) => {
      const btn = e?.target?.closest?.('.sfx-pad-btn');
      if (!btn) return;
      const now = Date.now();
      if (e.type === 'pointerdown') {
        lastPadPointerDown = now;
        e.preventDefault?.();
        const sfxId = btn.getAttribute('data-sfx-id');
        if (sfxId) triggerOneShotSfx(sfxId, btn);
        return;
      }
      if (now - lastPadPointerDown < 450) return;
      const sfxId = btn.getAttribute('data-sfx-id');
      if (sfxId) triggerOneShotSfx(sfxId, btn);
    };
    sfxPadsGrid.addEventListener('pointerdown', handlePadActivate);
    sfxPadsGrid.addEventListener('click', handlePadActivate);
  }
  const sfxVolumeSlider = document.getElementById('sfx-volume-slider');
  if (sfxVolumeSlider && typeof sfxVolumeSlider.addEventListener === 'function') {
    sfxVolumeSlider.addEventListener('input', (e) => applySfxVolume(e.target.value));
  }

  // Custom SFX files import & pad activation (#4)
  const btnLoadSfxFiles = document.getElementById('btn-load-sfx-files');
  const fileSfxInput = document.getElementById('file-sfx-input');
  if (btnLoadSfxFiles && fileSfxInput && typeof btnLoadSfxFiles.addEventListener === 'function') {
    btnLoadSfxFiles.addEventListener('click', () => fileSfxInput.click());
  }
  if (fileSfxInput && typeof fileSfxInput.addEventListener === 'function') {
    fileSfxInput.addEventListener('change', async (e) => {
      await processSelectedSfxFiles(e.target.files);
      fileSfxInput.value = '';
    });
  }
  const sfxCustomGrid = document.getElementById('sfx-custom-pads-grid');
  if (sfxCustomGrid && typeof sfxCustomGrid.addEventListener === 'function') {
    let lastCustomPadDown = 0;
    const handleCustomSfxActivate = (e) => {
      const delBtn = e?.target?.closest?.('.btn-delete-sfx');
      if (delBtn) {
        if (e.type === 'click') {
          const delId = delBtn.getAttribute('data-delete-sfx-id');
          if (delId) handleDeleteCustomSfx(delId);
        }
        return;
      }
      const btn = e?.target?.closest?.('.sfx-custom-pad-btn');
      if (!btn) return;
      const now = Date.now();
      if (e.type === 'pointerdown') {
        lastCustomPadDown = now;
        e.preventDefault?.();
        const trackId = btn.getAttribute('data-sfx-track-id');
        if (trackId) triggerCustomSfxTrack(trackId, btn);
        return;
      }
      if (now - lastCustomPadDown < 450) return;
      const trackId = btn.getAttribute('data-sfx-track-id');
      if (trackId) triggerCustomSfxTrack(trackId, btn);
    };
    sfxCustomGrid.addEventListener('pointerdown', handleCustomSfxActivate);
    sfxCustomGrid.addEventListener('click', handleCustomSfxActivate);
  }

  // Settings & Maintenance Popup (<dialog id="settings-modal">)
  const btnSettingsMenu = document.getElementById('btn-settings-menu');
  if (btnSettingsMenu && typeof btnSettingsMenu.addEventListener === 'function') {
    btnSettingsMenu.addEventListener('click', () => openSettingsModal());
  }
  const btnCloseSettings = document.getElementById('btn-close-settings');
  if (btnCloseSettings && typeof btnCloseSettings.addEventListener === 'function') {
    btnCloseSettings.addEventListener('click', () => closeSettingsModal());
  }
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal && typeof settingsModal.addEventListener === 'function') {
    setupDialogLightDismiss(settingsModal);
    settingsModal.addEventListener('close', () => {
      settingsModal.returnValue = '';
      document.getElementById('btn-settings-menu')?.setAttribute?.('aria-expanded', 'false');
    });
    settingsModal.addEventListener('click', (e) => {
      const choiceBtn = e?.target?.closest?.('.theme-choice-btn[data-theme-choice]');
      if (choiceBtn) {
        const themeName = choiceBtn.getAttribute('data-theme-choice');
        if (themeName) setTheme(themeName);
      }
    });
  }

  // Settings toggles (#1 BT Keep-Alive, #12 Scoreboard, #6 Shortcuts) & Backup (#7)
  const btnBtKeepAlive = document.getElementById('btn-bt-keepalive');
  if (btnBtKeepAlive && typeof btnBtKeepAlive.addEventListener === 'function') {
    btnBtKeepAlive.addEventListener('click', () => toggleBluetoothKeepAlive());
  }
  const btnScoreboardToggle = document.getElementById('btn-scoreboard-toggle');
  if (btnScoreboardToggle && typeof btnScoreboardToggle.addEventListener === 'function') {
    btnScoreboardToggle.addEventListener('click', () => toggleScoreboardVisible());
  }
  const btnShortcutsToggle = document.getElementById('btn-shortcuts-toggle');
  if (btnShortcutsToggle && typeof btnShortcutsToggle.addEventListener === 'function') {
    btnShortcutsToggle.addEventListener('click', () => toggleShortcutsEnabled());
  }

  const btnExportSettings = document.getElementById('btn-export-settings');
  if (btnExportSettings && typeof btnExportSettings.addEventListener === 'function') {
    btnExportSettings.addEventListener('click', () => exportSettingsBackup());
  }
  const btnImportSettings = document.getElementById('btn-import-settings');
  const fileImportSettings = document.getElementById('file-import-settings');
  if (btnImportSettings && fileImportSettings && typeof btnImportSettings.addEventListener === 'function') {
    btnImportSettings.addEventListener('click', () => fileImportSettings.click());
  }
  if (fileImportSettings && typeof fileImportSettings.addEventListener === 'function') {
    fileImportSettings.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const res = await importSettingsBackup(text);
          if (typeof alert === 'function') {
            alert(`Backup geladen: ${res.appliedSettings} Einstellungen & ${res.updatedTracks} Song-Zuordnungen übernommen.`);
          }
        } catch (err) {
          if (typeof alert === 'function') {
            alert('Backup konnte nicht geladen werden: ' + (err.message || err));
          }
        }
        fileImportSettings.value = '';
      }
    });
  }

  // Scoreboard reset button inside Settings (#12)
  const btnScoreReset = document.getElementById('btn-score-reset');
  if (btnScoreReset && typeof btnScoreReset.addEventListener === 'function') {
    btnScoreReset.addEventListener('click', () => resetScoreboard());
  }

  // Song Context Menu (<dialog id="track-context-modal">, #5)
  const trackContextModal = document.getElementById('track-context-modal');
  if (trackContextModal && typeof trackContextModal.addEventListener === 'function') {
    setupDialogLightDismiss(trackContextModal);
    trackContextModal.addEventListener('close', () => {
      trackContextModal.returnValue = '';
      contextMenuTrackId = null;
    });
  }
  const btnCloseTrackContext = document.getElementById('btn-close-track-context');
  if (btnCloseTrackContext && typeof btnCloseTrackContext.addEventListener === 'function') {
    btnCloseTrackContext.addEventListener('click', () => closeTrackContextModal());
  }
  const btnContextPin = document.getElementById('btn-context-pin');
  if (btnContextPin && typeof btnContextPin.addEventListener === 'function') {
    btnContextPin.addEventListener('click', () => toggleTrackPinned());
  }
  const contextGainSlider = document.getElementById('context-gain-slider');
  if (contextGainSlider && typeof contextGainSlider.addEventListener === 'function') {
    contextGainSlider.addEventListener('input', (e) => applyContextTrackGain(e.target.value));
  }
  const btnContextGainReset = document.getElementById('btn-context-gain-reset');
  if (btnContextGainReset && typeof btnContextGainReset.addEventListener === 'function') {
    btnContextGainReset.addEventListener('click', () => applyContextTrackGain(100));
  }
  const contextCategoryGrid = document.getElementById('context-category-grid');
  if (contextCategoryGrid && typeof contextCategoryGrid.addEventListener === 'function') {
    contextCategoryGrid.addEventListener('click', (e) => {
      const catBtn = e?.target?.closest?.('.context-cat-btn[data-target-category]');
      if (catBtn) {
        const targetCat = catBtn.getAttribute('data-target-category');
        if (targetCat) changeTrackCategory(contextMenuTrackId, targetCat);
      }
    });
  }
  const btnContextDelete = document.getElementById('btn-context-delete');
  if (btnContextDelete && typeof btnContextDelete.addEventListener === 'function') {
    btnContextDelete.addEventListener('click', () => deleteSingleTrack());
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
        return;
      }
      handleGlobalKeydown(e);
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

    const savedSfxVolume = await getSetting('sfxVolume', 90);
    applySfxVolume(savedSfxVolume);

    const savedAutoNorm = await getSetting('autoNormalize', true);
    applyAutoNormalize(savedAutoNorm);

    const savedEqPreset = await getSetting('eqPreset', 'neutral');
    applyEqPreset(savedEqPreset);

    const savedZoom = await getSetting('zoom', 100);
    applyZoom(savedZoom);

    const savedHeaderCollapsed = await getSetting('headerCollapsed', false);
    setHeaderCollapsed(savedHeaderCollapsed);

    const savedBtKeepAlive = await getSetting('btKeepAlive', false);
    applyBluetoothKeepAlive(savedBtKeepAlive);

    const savedShortcuts = await getSetting('shortcutsEnabled', true);
    applyShortcutsEnabled(savedShortcuts);

    const savedScoreboardState = await getSetting('scoreboardState', null);
    if (savedScoreboardState && typeof savedScoreboardState === 'object') {
      scoreboardState = {
        home: Math.max(0, Number(savedScoreboardState.home) || 0),
        guest: Math.max(0, Number(savedScoreboardState.guest) || 0)
      };
    }
    const savedScoreboardVisible = await getSetting('scoreboardVisible', false);
    setScoreboardVisible(savedScoreboardVisible);

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
