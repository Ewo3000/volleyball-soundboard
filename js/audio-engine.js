/**
 * Web Audio Engine for SV 1845 Esslingen DJ Pult
 * Handles Bluetooth latency optimization, 50ms track change micro-fade,
 * and 300ms smooth exponential stop fade.
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

export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.currentSource = null;
    this.currentTrackGain = null;
    this.currentAudioElement = null;
    this.currentTrack = null;
    this.currentObjectUrl = null;
    this.volume = 1.0;

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
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
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

  async playTrack(track) {
    this.initAudioContext();

    // 1. If currently playing, perform 50ms fast micro-fadeout to prevent clicks
    if (this.currentAudioElement || this.currentSource) {
      this.stop(50);
    }

    this.currentTrack = track;

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

      const audio = new AudioConstructor(objectUrl);
      this.currentAudioElement = audio;

      if (this.audioCtx && this.masterGain) {
        const source = this.audioCtx.createMediaElementSource(audio);
        const trackGain = this.audioCtx.createGain();

        // 20ms micro fade-in
        const now = this.audioCtx.currentTime;
        trackGain.gain.setValueAtTime(0.001, now);
        trackGain.gain.exponentialRampToValueAtTime(1.0, now + 0.02);

        source.connect(trackGain);
        trackGain.connect(this.masterGain);

        this.currentSource = source;
        this.currentTrackGain = trackGain;
      } else {
        audio.volume = this.volume;
      }

      audio.onended = () => {
        if (this.currentObjectUrl) {
          if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(this.currentObjectUrl);
          }
          this.currentObjectUrl = null;
        }
        const finishedTrack = this.currentTrack;
        this.currentTrack = null;
        this.currentAudioElement = null;
        this.currentSource = null;
        this.currentTrackGain = null;
        if (this.onTrackEnd) this.onTrackEnd(finishedTrack);
      };

      await audio.play();

      if (this.onTrackStart) {
        this.onTrackStart(track);
      }
    } catch (err) {
      console.error('Failed to play track:', err);
      if (this.currentObjectUrl) {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(this.currentObjectUrl);
        }
        this.currentObjectUrl = null;
      }
      this.currentTrack = null;
      throw err;
    }
  }

  stop(fadeDurationMs = 300) {
    if (this.currentObjectUrl) {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(this.currentObjectUrl);
      }
      this.currentObjectUrl = null;
    }

    if (!this.currentAudioElement) {
      this.currentTrack = null;
      if (this.onTrackStop) this.onTrackStop();
      return;
    }

    const audio = this.currentAudioElement;
    audio.onended = null;
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
      }, fadeDurationMs);
    } else {
      if (typeof audio.pause === 'function') {
        audio.pause();
      }
      try {
        audio.currentTime = 0;
      } catch (_) {}
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
}
