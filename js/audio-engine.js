/**
 * Web Audio Engine for SV 1845 Esslingen DJ Pult
 * Handles Bluetooth latency optimization, 50ms track change micro-fade,
 * 3000ms smooth exponential stop fade, transparent loudness normalization,
 * 5-preset 3-band Equalizer, and strict Web Audio node lifecycle cleanup.
 */

export function pickLeastPlayedRandomTrack(tracks) {
  if (!tracks || tracks.length === 0) return null;

  // Find lowest playCount (defensively treating undefined or non-number as 0)
  let minCount = Infinity;
  for (const t of tracks) {
    const count = typeof t?.playCount === 'number' ? t.playCount : 0;
    if (count < minCount) {
      minCount = count;
    }
  }

  // Candidates with lowest playCount
  const candidates = tracks.filter((t) => {
    const count = typeof t?.playCount === 'number' ? t.playCount : 0;
    return count === minCount;
  });

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

export const NORM_VERSION = 2;
export const TARGET_RMS = 0.25; // approx -12 dBFS (punchy stadium reference level)
export const MIN_NORM_GAIN = 0.72; // gentle attenuation on ultra-loud masters
export const MAX_NORM_GAIN = 2.4; // strong boost for quiet recordings
const SILENCE_RMS_THRESHOLD = 0.00316; // approx -50 dBFS

export const EQ_PRESETS = {
  neutral: {
    id: 'neutral',
    name: 'Neutral',
    icon: '🎚️',
    desc: 'Unveränderter Originalklang (0 dB)',
    low: 0,
    mid: 0,
    high: 0
  },
  stadium: {
    id: 'stadium',
    name: 'Stadion / Halle',
    icon: '🏟️',
    desc: 'Weniger Hallen-Dröhnen, satter Kick-Bass & klare Höhen',
    low: 3.5,
    mid: -2.0,
    high: 3.0
  },
  bass: {
    id: 'bass',
    name: 'Bass Boost',
    icon: '🔥',
    desc: 'Kräftiger Tiefbass-Schub für Warm-Up & Einlauf',
    low: 6.0,
    mid: 0.0,
    high: 2.0
  },
  punch: {
    id: 'punch',
    name: 'Punch & Klarheit',
    icon: '⚡',
    desc: 'Maximale Durchsetzungskraft für Jingles & Rock',
    low: 3.0,
    mid: 2.0,
    high: 4.0
  },
  warm: {
    id: 'warm',
    name: 'Warm / Lounge',
    icon: '🎙️',
    desc: 'Sanfte Höhen & warmer Klang für Satzpausen',
    low: 2.5,
    mid: 0.5,
    high: -2.5
  }
};

/**
 * Computes a normalization gain factor from an AudioBuffer based on active RMS and peak level.
 */
export function computeNormalizationGain(audioBuffer) {
  if (!audioBuffer || typeof audioBuffer.getChannelData !== 'function') {
    return 1.0;
  }

  const numChannels = audioBuffer.numberOfChannels || 1;
  const length = audioBuffer.length || 0;
  if (length === 0) return 1.0;

  const blockSize = 1024;
  let activeSumSquares = 0;
  let activeSampleCount = 0;
  let maxPeak = 0;

  for (let ch = 0; ch < numChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    if (!data || data.length === 0) continue;

    // Step through blocks (stride by 1 for short buffers, up to 4 for huge buffers to stay fast)
    const blockStride = data.length > 44100 * 30 ? 4 : 1;
    for (let i = 0; i < data.length; i += blockSize * blockStride) {
      const end = Math.min(i + blockSize, data.length);
      let blockSum = 0;
      for (let j = i; j < end; j++) {
        const s = data[j];
        const abs = s < 0 ? -s : s;
        if (abs > maxPeak) maxPeak = abs;
        blockSum += s * s;
      }
      const count = end - i;
      const blockRms = Math.sqrt(blockSum / count);
      if (blockRms >= SILENCE_RMS_THRESHOLD) {
        activeSumSquares += blockSum;
        activeSampleCount += count;
      }
    }
  }

  if (activeSampleCount === 0 || maxPeak === 0) {
    return 1.0;
  }

  const activeRms = Math.sqrt(activeSumSquares / activeSampleCount);
  if (activeRms <= 0) return 1.0;

  let rawGain = TARGET_RMS / activeRms;

  // Allow headroom with transparent brickwall limiter catching peaks up to 1.25x over 0.99
  if (rawGain > 1.0 && maxPeak > 0) {
    const maxSafeBoost = Math.max(1.0, (0.99 / maxPeak) * 1.25);
    rawGain = Math.min(rawGain, maxSafeBoost);
  }

  const clamped = Math.max(MIN_NORM_GAIN, Math.min(MAX_NORM_GAIN, rawGain));
  return Math.round(clamped * 1000) / 1000;
}

export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.compressor = null;
    this.eqLow = null;
    this.eqMid = null;
    this.eqHigh = null;
    this.eqPreset = 'neutral';
    this.currentSource = null;
    this.currentTrackGain = null;
    this.currentAudioElement = null;
    this.currentTrack = null;
    this.currentObjectUrl = null;
    this.volume = 1.0;
    this.autoNormalize = true;

    this.onTrackStart = null;
    this.onTrackStop = null;
    this.onTrackEnd = null;
  }

  initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass =
        (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ||
        (typeof AudioContext !== 'undefined' ? AudioContext : null);

      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
        const now = this.audioCtx.currentTime || 0;

        // Auto-recover AudioContext on state change (e.g. Bluetooth reconnect, route switch, screen lock/unlock)
        const handleStateRecovery = () => {
          if (this.audioCtx && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted')) {
            const res = typeof this.audioCtx.resume === 'function' ? this.audioCtx.resume() : null;
            if (res && typeof res.catch === 'function') res.catch(() => {});
          }
        };

        if (typeof this.audioCtx.addEventListener === 'function') {
          this.audioCtx.addEventListener('statechange', handleStateRecovery);
        } else if ('onstatechange' in this.audioCtx) {
          this.audioCtx.onstatechange = handleStateRecovery;
        }

        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, now);
        this.masterGain.connect(this.audioCtx.destination);

        // Transparent brickwall ceiling limiter (-2.0 dB threshold) to prevent clipping without dulling transients
        if (typeof this.audioCtx.createDynamicsCompressor === 'function') {
          this.compressor = this.audioCtx.createDynamicsCompressor();
          this.compressor.threshold?.setValueAtTime?.(-2.0, now);
          this.compressor.knee?.setValueAtTime?.(3.0, now);
          this.compressor.ratio?.setValueAtTime?.(12.0, now);
          this.compressor.attack?.setValueAtTime?.(0.015, now);
          this.compressor.release?.setValueAtTime?.(0.15, now);
          this.compressor.connect(this.masterGain);
        }

        // 3-Band Equalizer (Low-Shelf 80Hz, Peaking 1kHz, High-Shelf 4kHz)
        if (typeof this.audioCtx.createBiquadFilter === 'function') {
          this.eqLow = this.audioCtx.createBiquadFilter();
          this.eqLow.type = 'lowshelf';
          this.eqLow.frequency?.setValueAtTime?.(80, now);

          this.eqMid = this.audioCtx.createBiquadFilter();
          this.eqMid.type = 'peaking';
          this.eqMid.frequency?.setValueAtTime?.(1000, now);
          this.eqMid.Q?.setValueAtTime?.(0.9, now);

          this.eqHigh = this.audioCtx.createBiquadFilter();
          this.eqHigh.type = 'highshelf';
          this.eqHigh.frequency?.setValueAtTime?.(4000, now);

          this.eqLow.connect(this.eqMid);
          this.eqMid.connect(this.eqHigh);
          this.eqHigh.connect(this.compressor || this.masterGain);
          this._applyEqFilterGains();
        }
      }
    }

    if (this.audioCtx && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted')) {
      const res = typeof this.audioCtx.resume === 'function' ? this.audioCtx.resume() : null;
      if (res && typeof res.catch === 'function') {
        res.catch(() => {});
      }
    }
  }

  _applyEqFilterGains() {
    const preset = EQ_PRESETS[this.eqPreset] || EQ_PRESETS.neutral;
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime || 0;
    if (this.eqLow?.gain) {
      if (typeof this.eqLow.gain.setValueAtTime === 'function') {
        this.eqLow.gain.setValueAtTime(preset.low, now);
      } else {
        this.eqLow.gain.value = preset.low;
      }
    }
    if (this.eqMid?.gain) {
      if (typeof this.eqMid.gain.setValueAtTime === 'function') {
        this.eqMid.gain.setValueAtTime(preset.mid, now);
      } else {
        this.eqMid.gain.value = preset.mid;
      }
    }
    if (this.eqHigh?.gain) {
      if (typeof this.eqHigh.gain.setValueAtTime === 'function') {
        this.eqHigh.gain.setValueAtTime(preset.high, now);
      } else {
        this.eqHigh.gain.value = preset.high;
      }
    }
  }

  setEqPreset(presetId) {
    const validId = EQ_PRESETS[presetId] ? presetId : 'neutral';
    this.eqPreset = validId;
    this._applyEqFilterGains();
    return this.eqPreset;
  }

  getEqPreset() {
    return this.eqPreset;
  }

  setAutoNormalize(enabled) {
    this.autoNormalize = Boolean(enabled);
    this.updateCurrentTrackGain();
  }

  getAutoNormalize() {
    return this.autoNormalize;
  }

  getEffectiveTrackGain(track) {
    if (!track) return 1.0;
    const norm =
      this.autoNormalize && typeof track.normGain === 'number' && !isNaN(track.normGain)
        ? track.normGain
        : 1.0;
    const custom =
      typeof track.customGain === 'number' && !isNaN(track.customGain)
        ? track.customGain
        : 1.0;
    return Math.max(0.05, Math.min(4.0, norm * custom));
  }

  updateCurrentTrackGain() {
    if (!this.currentTrack) return;
    const targetGain = this.getEffectiveTrackGain(this.currentTrack);
    if (this.currentTrackGain && this.audioCtx) {
      const now = this.audioCtx.currentTime || 0;
      this.currentTrackGain.gain.setValueAtTime(targetGain, now);
    } else if (this.currentAudioElement) {
      this.currentAudioElement.volume = Math.max(0, Math.min(1, this.volume * targetGain));
    }
  }

  async analyzeTrackLoudness(track) {
    if (!track) return 1.0;
    if (
      typeof track.normGain === 'number' &&
      !isNaN(track.normGain) &&
      track.normVersion === NORM_VERSION
    ) {
      return track.normGain;
    }

    this.initAudioContext();
    if (!this.audioCtx || typeof this.audioCtx.decodeAudioData !== 'function') {
      return 1.0;
    }

    let arrayBuffer = null;
    if (typeof ArrayBuffer !== 'undefined' && track.blob instanceof ArrayBuffer) {
      arrayBuffer = track.blob.slice(0);
    } else if (typeof Uint8Array !== 'undefined' && track.blob instanceof Uint8Array) {
      arrayBuffer = track.blob.buffer.slice(
        track.blob.byteOffset,
        track.blob.byteOffset + track.blob.byteLength
      );
    } else if (track.blob && typeof track.blob.arrayBuffer === 'function') {
      arrayBuffer = await track.blob.arrayBuffer();
    }

    if (!arrayBuffer) return 1.0;

    try {
      const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      const normGain = computeNormalizationGain(audioBuffer);
      track.normGain = normGain;
      track.normVersion = NORM_VERSION;
      if (this.currentTrack && this.currentTrack.id === track.id) {
        this.updateCurrentTrackGain();
      }
      return normGain;
    } catch (_) {
      return 1.0;
    }
  }

  setMasterVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    } else if (this.currentAudioElement) {
      this.currentAudioElement.volume = this.volume;
    }
  }

  getMasterVolume() {
    return this.volume;
  }

  pickRandomTrack(tracks) {
    return pickLeastPlayedRandomTrack(tracks);
  }

  _cleanupAudioChain({ audio, source, trackGain, objectUrl } = {}) {
    if (source && typeof source.disconnect === 'function') {
      try {
        source.disconnect();
      } catch (_) {}
    }
    if (trackGain && typeof trackGain.disconnect === 'function') {
      try {
        trackGain.disconnect();
      } catch (_) {}
    }
    if (audio) {
      try {
        audio.onended = null;
        if (typeof audio.pause === 'function') {
          audio.pause();
        }
        if (typeof audio.removeAttribute === 'function') {
          audio.removeAttribute('src');
        }
        if (typeof audio.load === 'function') {
          audio.load();
        }
      } catch (_) {}
    }
    if (objectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (_) {}
    }
  }

  async playTrack(track) {
    this.initAudioContext();

    // 1. If currently playing, perform 50ms fast micro-fadeout to prevent clicks
    if (this.currentAudioElement || this.currentSource) {
      this.stop(50);
    }

    this.currentTrack = track;
    let audio = null;
    let source = null;
    let trackGain = null;

    try {
      let objectUrl;
      if (typeof Blob !== 'undefined' && track.blob instanceof Blob) {
        objectUrl = URL.createObjectURL(track.blob);
        this.currentObjectUrl = objectUrl;
      } else if (
        (typeof ArrayBuffer !== 'undefined' && track.blob instanceof ArrayBuffer) ||
        (typeof Uint8Array !== 'undefined' && track.blob instanceof Uint8Array)
      ) {
        const blob = new Blob([track.blob], { type: track.type || 'audio/mpeg' });
        objectUrl = URL.createObjectURL(blob);
        this.currentObjectUrl = objectUrl;
      } else if (track.url) {
        objectUrl = track.url;
      } else {
        throw new Error('Track has no playable audio blob or URL');
      }

      const AudioConstructor =
        (typeof window !== 'undefined' && window.Audio) ||
        (typeof Audio !== 'undefined' ? Audio : null);

      if (!AudioConstructor) {
        throw new Error('Audio element is not supported in this environment');
      }

      audio = new AudioConstructor(objectUrl);
      this.currentAudioElement = audio;

      const targetGain = this.getEffectiveTrackGain(track);

      if (this.audioCtx && this.masterGain) {
        source = this.audioCtx.createMediaElementSource(audio);
        trackGain = this.audioCtx.createGain();

        // 20ms micro fade-in to effective track gain
        const now = this.audioCtx.currentTime;
        trackGain.gain.setValueAtTime(0.001, now);
        trackGain.gain.exponentialRampToValueAtTime(targetGain, now + 0.02);

        source.connect(trackGain);
        const inputTarget = this.eqLow || this.compressor || this.masterGain;
        trackGain.connect(inputTarget);

        this.currentSource = source;
        this.currentTrackGain = trackGain;
      } else {
        audio.volume = Math.max(0, Math.min(1, this.volume * targetGain));
      }

      const boundObjectUrl = this.currentObjectUrl;
      audio.onended = () => {
        if (this.currentObjectUrl === boundObjectUrl) {
          this.currentObjectUrl = null;
        }
        const finishedTrack = this.currentTrack;
        if (this.currentAudioElement === audio) {
          this.currentTrack = null;
          this.currentAudioElement = null;
          this.currentSource = null;
          this.currentTrackGain = null;
        }
        this._cleanupAudioChain({
          audio,
          source,
          trackGain,
          objectUrl: boundObjectUrl
        });
        if (this.onTrackEnd) this.onTrackEnd(finishedTrack);
      };

      await audio.play();

      if (this.onTrackStart) {
        this.onTrackStart(track);
      }
    } catch (err) {
      console.error('Failed to play track:', err);
      const failedUrl = this.currentObjectUrl;
      this.currentObjectUrl = null;
      this._cleanupAudioChain({
        audio,
        source,
        trackGain,
        objectUrl: failedUrl
      });
      this.currentTrack = null;
      this.currentAudioElement = null;
      this.currentSource = null;
      this.currentTrackGain = null;
      throw err;
    }
  }

  stop(fadeDurationMs = 3000) {
    const objectUrlToRevoke = this.currentObjectUrl;
    this.currentObjectUrl = null;

    if (!this.currentAudioElement) {
      if (objectUrlToRevoke) {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(objectUrlToRevoke);
        }
      }
      this.currentTrack = null;
      if (this.onTrackStop) this.onTrackStop();
      return;
    }

    const audio = this.currentAudioElement;
    audio.onended = null;
    const source = this.currentSource;
    const trackGain = this.currentTrackGain;
    const audioCtx = this.audioCtx;

    if (trackGain && audioCtx && fadeDurationMs > 0) {
      const now = audioCtx.currentTime;
      const durationSec = fadeDurationMs / 1000;
      const currentGainVal =
        trackGain.gain && typeof trackGain.gain.value === 'number'
          ? Math.max(trackGain.gain.value, 0.001)
          : 1.0;
      trackGain.gain.setValueAtTime(currentGainVal, now);
      trackGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      setTimeout(() => {
        if (typeof audio.pause === 'function') {
          audio.pause();
        }
        try {
          audio.currentTime = 0;
        } catch (_) {}
        this._cleanupAudioChain({ audio, source, trackGain, objectUrl: objectUrlToRevoke });
      }, fadeDurationMs);
    } else {
      if (typeof audio.pause === 'function') {
        audio.pause();
      }
      try {
        audio.currentTime = 0;
      } catch (_) {}
      this._cleanupAudioChain({ audio, source, trackGain, objectUrl: objectUrlToRevoke });
    }

    this.currentTrack = null;
    this.currentAudioElement = null;
    this.currentSource = null;
    this.currentTrackGain = null;

    if (this.onTrackStop) {
      this.onTrackStop();
    }
  }

  getCurrentTrack() {
    return this.currentTrack;
  }

  getCurrentTime() {
    return this.currentAudioElement ? this.currentAudioElement.currentTime || 0 : 0;
  }

  getDuration() {
    return this.currentAudioElement && !isNaN(this.currentAudioElement.duration)
      ? this.currentAudioElement.duration
      : 0;
  }

  seek(seconds) {
    if (!this.currentAudioElement) return;
    const num = Number(seconds);
    if (isNaN(num)) return;
    const duration = this.getDuration();
    const target = duration > 0 ? Math.max(0, Math.min(num, duration)) : Math.max(0, num);
    try {
      this.currentAudioElement.currentTime = target;
    } catch (err) {
      console.warn('Seeking audio failed:', err);
    }
  }

  seekRelative(deltaSeconds) {
    this.seek(this.getCurrentTime() + deltaSeconds);
  }
}
