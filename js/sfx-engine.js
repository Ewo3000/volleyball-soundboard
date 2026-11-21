/**
 * SV 1845 Esslingen - Volleyball DJ Soundboard
 * Offline Web Audio One-Shot SFX Synthesizer (js/sfx-engine.js)
 * Plays crisp stadium effects on an independent overlay bus without stopping active music.
 */

export const SFX_DEFINITIONS = [
  { id: 'airhorn', name: 'Airhorn', icon: '📢', desc: 'Klassischer Stadion-Hornstoß', accent: 'red' },
  { id: 'monster_block', name: 'Block-Boom', icon: '💥', desc: 'Tiefer 808-Impact & Sub-Drop', accent: 'magenta' },
  { id: 'fanfare', name: 'Tröte / Fanfare', icon: '📯', desc: 'Trompeten-Dreiklang für Punkte', accent: 'amber' },
  { id: 'clap', name: 'Stadion-Clap', icon: '👏', desc: 'Rhythmischer 3er-Klatsch-Beat', accent: 'blue' },
  { id: 'drumroll', name: 'Tusch / Wirbel', icon: '🥁', desc: 'Kurzer Snare-Wirbel + Becken', accent: 'purple' },
  { id: 'charge', name: 'Power-Charge', icon: '⚡', desc: 'Stadionorgel „Da-da-da-DA!“', accent: 'emerald' }
];

const SFX_IDS = new Set(SFX_DEFINITIONS.map((d) => d.id));

function setParam(param, value, time) {
  if (!param) return;
  if (typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(value, time);
  } else {
    param.value = value;
  }
}

function expRamp(param, value, time) {
  if (!param) return;
  if (typeof param.exponentialRampToValueAtTime === 'function') {
    param.exponentialRampToValueAtTime(Math.max(0.0001, value), time);
  } else {
    param.value = value;
  }
}

function linRamp(param, value, time) {
  if (!param) return;
  if (typeof param.linearRampToValueAtTime === 'function') {
    param.linearRampToValueAtTime(value, time);
  } else {
    param.value = value;
  }
}

function createWhiteNoiseBuffer(audioCtx, durationSec) {
  if (typeof audioCtx.createBuffer !== 'function') return null;
  const sampleRate = audioCtx.sampleRate || 44100;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = audioCtx.createBuffer(1, length, sampleRate);
  const data = typeof buffer.getChannelData === 'function' ? buffer.getChannelData(0) : null;
  if (data) {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return buffer;
}

function scheduleOsc(audioCtx, dest, { type = 'sine', freqStart, freqEnd, startTime, duration, gainPeak = 0.5, detune = 0 }, cleanupSet) {
  if (typeof audioCtx.createOscillator !== 'function') return null;
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.type = type;
  setParam(osc.frequency, freqStart, startTime);
  if (typeof freqEnd === 'number' && freqEnd !== freqStart) {
    expRamp(osc.frequency, freqEnd, startTime + duration);
  }
  if (detune && osc.detune) {
    setParam(osc.detune, detune, startTime);
  }

  setParam(env.gain, 0.0001, startTime);
  expRamp(env.gain, Math.max(0.001, gainPeak), startTime + Math.min(0.02, duration * 0.2));
  expRamp(env.gain, 0.0001, startTime + duration);

  osc.connect(env);
  env.connect(dest);

  cleanupSet.add(osc);
  cleanupSet.add(env);

  osc.onended = () => {
    try { osc.disconnect(); } catch (_) {}
    try { env.disconnect(); } catch (_) {}
  };

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
  return osc;
}

function scheduleNoiseBurst(audioCtx, dest, { startTime, duration, gainPeak = 0.45, filterType = 'bandpass', filterFreq = 1400, filterQ = 1.2 }, cleanupSet) {
  if (typeof audioCtx.createBufferSource !== 'function') return null;
  const buffer = createWhiteNoiseBuffer(audioCtx, duration);
  if (!buffer) return null;

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;

  const env = audioCtx.createGain();
  setParam(env.gain, Math.max(0.001, gainPeak), startTime);
  expRamp(env.gain, 0.0001, startTime + duration);

  let tailNode = src;
  let filter = null;
  if (typeof audioCtx.createBiquadFilter === 'function') {
    filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    setParam(filter.frequency, filterFreq, startTime);
    setParam(filter.Q, filterQ, startTime);
    src.connect(filter);
    tailNode = filter;
    cleanupSet.add(filter);
  }

  tailNode.connect(env);
  env.connect(dest);
  cleanupSet.add(src);
  cleanupSet.add(env);

  src.onended = () => {
    try { src.disconnect(); } catch (_) {}
    try { filter?.disconnect(); } catch (_) {}
    try { env.disconnect(); } catch (_) {}
  };

  src.start(startTime);
  src.stop(startTime + duration + 0.01);
  return src;
}

/**
 * Synthesizes a one-shot stadium SFX directly onto destinationNode via a dedicated GainNode.
 * Cleans up all created nodes automatically after completion.
 * @param {AudioContext} audioCtx
 * @param {AudioNode} destinationNode
 * @param {string} sfxId
 * @param {number} [volume=0.9]
 * @returns {boolean}
 */
export function synthesizeOneShotSfx(audioCtx, destinationNode, sfxId, volume = 0.9) {
  if (!audioCtx || !destinationNode || typeof audioCtx.createGain !== 'function') {
    return false;
  }
  if (!SFX_IDS.has(sfxId)) {
    return false;
  }

  const now = audioCtx.currentTime || 0;
  const safeVol = Math.max(0.05, Math.min(1.5, Number.isFinite(volume) ? volume : 0.9));
  const sfxBus = audioCtx.createGain();
  setParam(sfxBus.gain, safeVol, now);
  sfxBus.connect(destinationNode);

  const createdNodes = new Set();
  let totalDuration = 0.8;

  switch (sfxId) {
    case 'airhorn': {
      // Classic dual-blast stadium horn (detuned sawtooth stack)
      const bursts = [
        { offset: 0, dur: 0.24 },
        { offset: 0.29, dur: 0.52 }
      ];
      for (const b of bursts) {
        const t = now + b.offset;
        scheduleOsc(audioCtx, sfxBus, { type: 'sawtooth', freqStart: 392, freqEnd: 386, startTime: t, duration: b.dur, gainPeak: 0.34, detune: -12 }, createdNodes);
        scheduleOsc(audioCtx, sfxBus, { type: 'sawtooth', freqStart: 494, freqEnd: 488, startTime: t, duration: b.dur, gainPeak: 0.30, detune: 12 }, createdNodes);
        scheduleOsc(audioCtx, sfxBus, { type: 'square', freqStart: 587.3, freqEnd: 582, startTime: t, duration: b.dur, gainPeak: 0.16 }, createdNodes);
      }
      totalDuration = 0.88;
      break;
    }

    case 'monster_block': {
      // Heavy 808 sub-drop + punchy transient noise impact
      scheduleOsc(audioCtx, sfxBus, { type: 'sine', freqStart: 155, freqEnd: 36, startTime: now, duration: 0.65, gainPeak: 0.85 }, createdNodes);
      scheduleOsc(audioCtx, sfxBus, { type: 'triangle', freqStart: 220, freqEnd: 48, startTime: now, duration: 0.32, gainPeak: 0.45 }, createdNodes);
      scheduleNoiseBurst(audioCtx, sfxBus, { startTime: now, duration: 0.18, gainPeak: 0.55, filterType: 'lowpass', filterFreq: 950, filterQ: 1.0 }, createdNodes);
      totalDuration = 0.72;
      break;
    }

    case 'fanfare': {
      // Crisp 4-note brass triad (C5 - E5 - G5 - C6)
      const notes = [
        { freq: 523.25, offset: 0.0, dur: 0.13 },
        { freq: 659.25, offset: 0.13, dur: 0.13 },
        { freq: 783.99, offset: 0.26, dur: 0.13 },
        { freq: 1046.5, offset: 0.40, dur: 0.45 }
      ];
      for (const n of notes) {
        const t = now + n.offset;
        scheduleOsc(audioCtx, sfxBus, { type: 'sawtooth', freqStart: n.freq, freqEnd: n.freq, startTime: t, duration: n.dur, gainPeak: 0.28, detune: -6 }, createdNodes);
        scheduleOsc(audioCtx, sfxBus, { type: 'triangle', freqStart: n.freq, freqEnd: n.freq, startTime: t, duration: n.dur, gainPeak: 0.28, detune: 6 }, createdNodes);
      }
      totalDuration = 0.92;
      break;
    }

    case 'clap': {
      // 3-hit crowd clap with layered filtered noise bursts
      const hits = [0.0, 0.20, 0.40];
      for (const offset of hits) {
        const t = now + offset;
        scheduleNoiseBurst(audioCtx, sfxBus, { startTime: t, duration: 0.14, gainPeak: 0.65, filterType: 'bandpass', filterFreq: 1650, filterQ: 1.4 }, createdNodes);
        scheduleOsc(audioCtx, sfxBus, { type: 'triangle', freqStart: 190, freqEnd: 95, startTime: t, duration: 0.09, gainPeak: 0.35 }, createdNodes);
      }
      totalDuration = 0.62;
      break;
    }

    case 'drumroll': {
      // Rapid snare hits leading into a bright crash burst
      const hits = [0, 0.08, 0.16, 0.24, 0.31, 0.37, 0.43, 0.48];
      for (const offset of hits) {
        scheduleNoiseBurst(audioCtx, sfxBus, { startTime: now + offset, duration: 0.065, gainPeak: 0.42, filterType: 'highpass', filterFreq: 1100, filterQ: 0.8 }, createdNodes);
      }
      // Final tusch cymbal + bass punch
      const endOffset = 0.54;
      scheduleNoiseBurst(audioCtx, sfxBus, { startTime: now + endOffset, duration: 0.65, gainPeak: 0.6, filterType: 'highpass', filterFreq: 2600, filterQ: 0.7 }, createdNodes);
      scheduleOsc(audioCtx, sfxBus, { type: 'sine', freqStart: 140, freqEnd: 52, startTime: now + endOffset, duration: 0.28, gainPeak: 0.65 }, createdNodes);
      totalDuration = 1.25;
      break;
    }

    case 'charge': {
      // Classic stadium organ "Da-da-da-da-da-DA!"
      const notes = [
        { freq: 392.0, offset: 0.0, dur: 0.12 },
        { freq: 523.25, offset: 0.13, dur: 0.12 },
        { freq: 659.25, offset: 0.26, dur: 0.12 },
        { freq: 783.99, offset: 0.39, dur: 0.18 },
        { freq: 659.25, offset: 0.59, dur: 0.11 },
        { freq: 783.99, offset: 0.72, dur: 0.42 }
      ];
      for (const n of notes) {
        const t = now + n.offset;
        scheduleOsc(audioCtx, sfxBus, { type: 'square', freqStart: n.freq, freqEnd: n.freq, startTime: t, duration: n.dur, gainPeak: 0.22 }, createdNodes);
        scheduleOsc(audioCtx, sfxBus, { type: 'triangle', freqStart: n.freq * 2, freqEnd: n.freq * 2, startTime: t, duration: n.dur, gainPeak: 0.14 }, createdNodes);
      }
      totalDuration = 1.2;
      break;
    }

    default:
      break;
  }

  // Fallback node cleanup in case individual onended callbacks aren't fired in minimal mocks
  const cleanupTimerMs = Math.ceil((totalDuration + 0.1) * 1000);
  const timer = setTimeout(() => {
    for (const node of createdNodes) {
      if (node && typeof node.disconnect === 'function') {
        try { node.disconnect(); } catch (_) {}
      }
    }
    if (typeof sfxBus.disconnect === 'function') {
      try { sfxBus.disconnect(); } catch (_) {}
    }
  }, cleanupTimerMs);
  if (typeof timer?.unref === 'function') {
    timer.unref();
  }

  return true;
}
