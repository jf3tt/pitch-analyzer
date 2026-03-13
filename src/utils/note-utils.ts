/**
 * Utilities for converting frequency to note and cents deviation.
 *
 * Standard tuning: A4 = 440 Hz
 * Formula: noteNum = 12 * log2(freq / 440) + 69
 * Cents deviation = (noteNum - round(noteNum)) * 100
 */

const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

export interface NoteInfo {
  /** Note name (C, C#, D, ...) */
  name: NoteName;
  /** Octave (0-9) */
  octave: number;
  /** Full name (e.g. "A4") */
  fullName: string;
  /** MIDI note number (0-127) */
  midi: number;
  /** Deviation from exact note in cents (-50 .. +50) */
  cents: number;
  /** Original frequency in Hz */
  frequency: number;
}

/**
 * Converts frequency to note information.
 * @param frequency Frequency in Hz
 * @param a4 Reference frequency for A4 (default 440)
 * @returns NoteInfo or null if frequency is out of range
 */
export function frequencyToNote(frequency: number, a4 = 440): NoteInfo | null {
  if (frequency <= 0 || !isFinite(frequency)) return null;

  // MIDI note number (may be fractional)
  const noteNum = 12 * Math.log2(frequency / a4) + 69;

  // Round to nearest note
  const midi = Math.round(noteNum);
  if (midi < 0 || midi > 127) return null;

  // Cents deviation
  const cents = Math.round((noteNum - midi) * 100);

  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;

  return {
    name,
    octave,
    fullName: `${name}${octave}`,
    midi,
    cents,
    frequency,
  };
}

/**
 * Converts a MIDI note number to frequency.
 */
export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Returns the note name for a given MIDI number.
 */
export function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/**
 * Determines color based on pitch accuracy.
 * Green: +/-10 cents (good)
 * Yellow: +/-25 cents (fair)
 * Red: >25 cents (off)
 */
export function centsToColor(cents: number): string {
  const absCents = Math.abs(cents);
  if (absCents <= 10) return '#4ade80'; // green
  if (absCents <= 25) return '#facc15'; // yellow
  return '#f87171'; // red
}

/**
 * Note range for canvas display (vocal range).
 * C2 (65 Hz) - C6 (1047 Hz)
 */
export const VOCAL_RANGE = {
  minMidi: 36, // C2
  maxMidi: 84, // C6
  minFreq: midiToFrequency(36),
  maxFreq: midiToFrequency(84),
} as const;
