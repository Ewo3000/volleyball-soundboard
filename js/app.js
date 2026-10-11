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

// Application State
export const audioEngine = new AudioEngine();
export const wakeLock = new WakeLockManager();

export let allTracks = [];
export let categorized = new Map();
export let currentZoom = 100;
export let isHeaderCollapsed = false;
export let currentSearchQuery = '';

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
  const drawerContent = document.getElementById('drawer-content');
  if (!drawerContent) return;

  const categoriesToRender = [
    ...COLUMN_IDS,
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
  const pauseTracks = allTracks.filter(
    (t) => t.category === 'pause' || t.suffix === '_PAUSE' || /_(?:PAUSE|PAUSENSONG)$/i.test(stripExtension(t.name))
  );

  for (let slot = 1; slot <= 4; slot++) {
    const btn = document.getElementById(`btn-pause-${slot}`);
    if (!btn) continue;
    const track = pauseTracks[slot - 1];
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
 * Updates play count badges in DOM
 */
export function updateTrackDOMPlayCount(trackId, count) {
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
    wakeLock.requestLock().catch((err) => console.warn('Wake lock error:', err));
    await audioEngine.playTrack(track);

    track.playCount = (typeof track.playCount === 'number' ? track.playCount : 0) + 1;
    track.lastPlayed = Date.now();
    await updateTrackPlayCount(track.id, track.playCount);

    updateTrackDOMPlayCount(track.id, track.playCount);
  } catch (err) {
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

  if (!currentSearchQuery) {
    allSongButtons.forEach((btn) => {
      btn.classList.remove('search-dimmed', 'dimmed', 'search-highlighted', 'highlighted');
    });
    if (searchResultsBadge) {
      searchResultsBadge.textContent = '0 Treffer';
    }
    return;
  }

  let matchCount = 0;
  allSongButtons.forEach((btn) => {
    const trackId = btn.getAttribute('data-track-id');
    const track = allTracks.find((t) => t.id === trackId);
    const titleText = (btn.querySelector('.song-title, .track-title')?.textContent || '').toLowerCase();
    const trackName = (track?.name || '').toLowerCase();

    if (titleText.includes(currentSearchQuery) || trackName.includes(currentSearchQuery)) {
      btn.classList.remove('search-dimmed', 'dimmed');
      btn.classList.add('search-highlighted', 'highlighted');
      matchCount++;
    } else {
      btn.classList.remove('search-highlighted', 'highlighted');
      btn.classList.add('search-dimmed', 'dimmed');
    }
  });

  if (searchResultsBadge) {
    searchResultsBadge.textContent = `${matchCount} Treffer`;
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
export function playTimeout() {
  const timeoutTracks = allTracks.filter(
    (t) => t.category === 'timeout' || t.suffix === '_TIMEOUT' || /_TIMEOUT$/i.test(stripExtension(t.name))
  );
  const track = pickLeastPlayedRandomTrack(timeoutTracks);
  if (track) {
    handlePlayTrack(track);
  } else {
    console.warn('Keine Timeout-Tracks vorhanden');
  }
}

export function playWalkOn() {
  const walkonTracks = allTracks.filter(
    (t) => t.category === 'walkon' || t.suffix === '_WALKON' || /_(?:WALKON|EINLAUF)$/i.test(stripExtension(t.name))
  );
  const track = pickLeastPlayedRandomTrack(walkonTracks);
  if (track) {
    handlePlayTrack(track);
  } else {
    console.warn('Keine Walk-On Tracks vorhanden');
  }
}

export function playPauseSlot(slotIndex) {
  const pauseTracks = allTracks.filter(
    (t) => t.category === 'pause' || t.suffix === '_PAUSE' || /_(?:PAUSE|PAUSENSONG)$/i.test(stripExtension(t.name))
  );
  const track = pauseTracks[slotIndex - 1];
  if (track) {
    handlePlayTrack(track);
  } else if (pauseTracks.length > 0) {
    const fallback = pickLeastPlayedRandomTrack(pauseTracks);
    if (fallback) handlePlayTrack(fallback);
  } else {
    console.warn(`Kein Pausensong für Slot ${slotIndex} vorhanden`);
  }
}

export function playSixSeven() {
  const sixSevenTracks = allTracks.filter(
    (t) => t.category === 'sixseven' || t.suffix === '_SIXSEVEN' || /_(?:SIXSEVEN|67)$/i.test(stripExtension(t.name))
  );
  const track = pickLeastPlayedRandomTrack(sixSevenTracks);
  if (track) {
    handlePlayTrack(track);
  } else {
    console.warn('Keine 6/7 Tracks vorhanden');
  }
}

export function playRandomOwn() {
  const ownTracks = allTracks.filter((t) =>
    ['ass_angriff', 'sonstiges_1', 'sonstiges_2', 'sonstiges_3'].includes(t.category)
  );
  const track = pickLeastPlayedRandomTrack(ownTracks);
  if (track) {
    handlePlayTrack(track);
  } else {
    console.warn('Keine Tracks für eigene Punkte vorhanden');
  }
}

export function playRandomOpponent() {
  const opponentTracks = allTracks.filter((t) => t.category === 'gegner');
  const track = pickLeastPlayedRandomTrack(opponentTracks);
  if (track) {
    handlePlayTrack(track);
  } else {
    console.warn('Keine Tracks für Gegnerpunkte vorhanden');
  }
}

export function stopAudio() {
  audioEngine.stop(300);
}

/**
 * Processes list of selected or dropped files
 */
export async function processSelectedFiles(fileList) {
  if (!fileList || fileList.length === 0) return;
  const newTracks = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const isAudio =
      (file.type && file.type.startsWith('audio/')) ||
      /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(file.name);

    if (!isAudio) continue;

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
 * Initializes DOM listeners and UI bindings
 */
export function setupEventListeners() {
  // AudioEngine lifecycle callbacks
  audioEngine.onTrackStart = (track) => {
    updatePlayingUI(track ? track.id : null);
  };
  audioEngine.onTrackStop = () => {
    updatePlayingUI(null);
  };
  audioEngine.onTrackEnd = () => {
    updatePlayingUI(null);
  };

  // Zoom controls
  const btnZoomIn = document.getElementById('zoom-in');
  if (btnZoomIn) btnZoomIn.addEventListener('click', () => applyZoom(currentZoom + 5));

  const btnZoomOut = document.getElementById('zoom-out');
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => applyZoom(currentZoom - 5));

  // Search inputs
  const searchInput = document.getElementById('search-input');
  const drawerSearchInput = document.getElementById('drawer-search-input');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (drawerSearchInput) drawerSearchInput.value = val;
      filterTracks(val);
    });
  }

  if (drawerSearchInput) {
    drawerSearchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (searchInput) searchInput.value = val;
      filterTracks(val);
    });
  }

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
          handlePlayTrack(track);
        }
      }
    });
  }

  // Desktop Footer Bar Quick Actions
  const btnTimeout = document.getElementById('btn-timeout');
  if (btnTimeout) btnTimeout.addEventListener('click', playTimeout);

  const btnWalkon = document.getElementById('btn-walkon');
  if (btnWalkon) btnWalkon.addEventListener('click', playWalkOn);

  for (let slot = 1; slot <= 4; slot++) {
    const slotBtn = document.getElementById(`btn-pause-${slot}`);
    if (slotBtn) {
      slotBtn.addEventListener('click', () => playPauseSlot(slot));
    }
  }

  const btnSixseven = document.getElementById('btn-sixseven');
  if (btnSixseven) btnSixseven.addEventListener('click', playSixSeven);

  const btnRandomOwn = document.getElementById('btn-random-own');
  if (btnRandomOwn) btnRandomOwn.addEventListener('click', playRandomOwn);

  const btnRandomOpponent = document.getElementById('btn-random-opponent');
  if (btnRandomOpponent) btnRandomOpponent.addEventListener('click', playRandomOpponent);

  const btnStop = document.getElementById('btn-stop');
  if (btnStop) btnStop.addEventListener('click', stopAudio);

  // Mobile Pad Quick Actions
  const btnMobileTimeout = document.getElementById('btn-mobile-timeout');
  if (btnMobileTimeout) btnMobileTimeout.addEventListener('click', playTimeout);

  const btnMobileWalkon = document.getElementById('btn-mobile-walkon');
  if (btnMobileWalkon) btnMobileWalkon.addEventListener('click', playWalkOn);

  const btnMobilePause = document.getElementById('btn-mobile-pause');
  if (btnMobilePause) btnMobilePause.addEventListener('click', () => playPauseSlot(1));

  const btnMobileSixseven = document.getElementById('btn-mobile-sixseven');
  if (btnMobileSixseven) btnMobileSixseven.addEventListener('click', playSixSeven);

  const btnMobileRandomOwn = document.getElementById('btn-mobile-random-own');
  if (btnMobileRandomOwn) btnMobileRandomOwn.addEventListener('click', playRandomOwn);

  const btnMobileRandomOpponent = document.getElementById('btn-mobile-random-opponent');
  if (btnMobileRandomOpponent) btnMobileRandomOpponent.addEventListener('click', playRandomOpponent);

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
 * Main Application Initialization
 */
export async function initApp() {
  try {
    await initDB();
    allTracks = await getAllTracks();

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
