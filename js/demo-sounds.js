/**
 * SV 1845 Esslingen - Volleyball DJ Soundboard
 * Synthesized Demo Soundpack Generator (js/demo-sounds.js)
 * Generates minimal 8-bit mono PCM WAV buffers to provide instant out-of-the-box sounds.
 */

import { parseTrackFromFilename, stripExtension } from './file-loader.js';

export const DEMO_TRACK_DEFINITIONS = [
  // 1. Ass / Angriff (HIT)
  { filename: 'Super_Spike_HIT.wav', freq: 587.33, duration: 0.5 },
  { filename: 'Drop_That_Low_HIT.wav', freq: 293.66, duration: 0.6 },

  // 2. Block (BLOCK)
  { filename: 'Monster_Block_BLOCK.wav', freq: 440.00, duration: 0.5 },
  { filename: 'Axel_F_BLOCK.wav', freq: 523.25, duration: 0.6 },

  // 3. Gegner (GEGNER)
  { filename: 'Gegner_Pause_GEGNER.wav', freq: 349.23, duration: 0.7 },
  { filename: 'Durchatmen_GEGNER.wav', freq: 392.00, duration: 0.8 },

  // 4. Sonstiges 1 (SONSTIGES1)
  { filename: 'Perfekte_Welle_SONSTIGES1.wav', freq: 659.25, duration: 0.6 },

  // 5. Sonstiges 2 (SONSTIGES2)
  { filename: 'Samba_SONSTIGES2.wav', freq: 698.46, duration: 0.6 },

  // 6. Sonstiges 3 (SONSTIGES3)
  { filename: 'Seven_Nation_Army_SONSTIGES3.wav', freq: 493.88, duration: 0.7 },

  // 7. Spaß & Extras (FUN)
  { filename: 'Ned_schlecht_FUN.wav', freq: 880.00, duration: 0.5 },

  // Quick Actions:
  // Timeout (TIMEOUT)
  { filename: 'Auszeit_Alarm_TIMEOUT.wav', freq: 783.99, duration: 0.9 },

  // Walk-On (WALKON)
  { filename: 'Einlauf_Hymne_WALKON.wav', freq: 523.25, duration: 1.0 },

  // Pausensongs (PAUSE)
  { filename: 'Satzpause_Blue_PAUSE.wav', freq: 329.63, duration: 1.0 },
  { filename: 'Satzpause_Summer_PAUSE.wav', freq: 369.99, duration: 1.0 },

  // 6/7 Quick Action (SIXSEVEN)
  { filename: 'Seven_Hype_SIXSEVEN.wav', freq: 659.25, duration: 0.7 }
];

/**
 * Generates a minimal RIFF 8-bit mono PCM WAV Uint8Array buffer
 * @param {Object} options
 * @param {number} [options.frequency=440] Tone frequency in Hz
 * @param {number} [options.duration=0.5] Tone duration in seconds
 * @param {number} [options.sampleRate=8000] Audio sample rate in Hz
 * @returns {Uint8Array} Binary WAV buffer
 */
export function generateSineWavBuffer({ frequency = 440, duration = 0.5, sampleRate = 8000 } = {}) {
  const numSamples = Math.floor(sampleRate * Math.max(0.1, duration));
  const fileSize = 44 + numSamples;
  const buffer = new Uint8Array(fileSize);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // 'RIFF' chunk descriptor
  buffer.set([0x52, 0x49, 0x46, 0x46], 0);
  view.setUint32(4, fileSize - 8, true);
  // 'WAVE' format
  buffer.set([0x57, 0x41, 0x56, 0x45], 8);

  // 'fmt ' subchunk
  buffer.set([0x66, 0x6d, 0x74, 0x20], 12);
  view.setUint32(16, 16, true);          // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);           // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true);           // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true);  // SampleRate
  view.setUint32(28, sampleRate, true);  // ByteRate = SampleRate * NumChannels * BitsPerSample/8
  view.setUint16(32, 1, true);           // BlockAlign = NumChannels * BitsPerSample/8
  view.setUint16(34, 8, true);           // BitsPerSample (8-bit)

  // 'data' subchunk
  buffer.set([0x64, 0x61, 0x74, 0x61], 36);
  view.setUint32(40, numSamples, true);

  // Generate PCM 8-bit unsigned samples (0 to 255, 128 is center/silence)
  const fadeLength = Math.min(Math.floor(sampleRate * 0.05), Math.floor(numSamples / 4));
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let envelope = 1.0;
    if (i < fadeLength) {
      envelope = i / fadeLength;
    } else if (i > numSamples - fadeLength) {
      envelope = (numSamples - i) / fadeLength;
    }

    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope;
    // Map -1.0..+1.0 to 0..255 integer
    buffer[44 + i] = Math.max(0, Math.min(255, Math.floor(128 + 127 * sample)));
  }

  return buffer;
}

/**
 * Creates the complete default demo soundpack with synthesized WAV samples
 * @returns {Array<Object>} List of initialized Track objects
 */
export function createDemoSoundpack() {
  return DEMO_TRACK_DEFINITIONS.map((def) => {
    const wavBytes = generateSineWavBuffer({
      frequency: def.freq,
      duration: def.duration,
      sampleRate: 8000
    });

    const blob = (typeof Blob !== 'undefined')
      ? new Blob([wavBytes], { type: 'audio/wav' })
      : wavBytes;

    const track = parseTrackFromFilename(def.filename, blob, 'audio/wav');
    track.id = 'demo_' + stripExtension(def.filename);
    return track;
  });
}
