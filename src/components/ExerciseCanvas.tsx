/**
 * ExerciseCanvas — renders target notes as blocks and voice pitch line on top.
 *
 * Uses a scrolling viewport that follows the playhead, showing ~15 seconds
 * of context at a time. The canvas never exceeds its container width.
 *
 * Layout: horizontal timeline. Each target note is a colored rectangle.
 * The user's voice pitch is drawn as a continuous line.
 * A playhead cursor shows current position.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { ExerciseNote } from '../data/exercises';
import { midiToNoteName, centsToColor, frequencyToNote } from '../utils/note-utils';

interface PitchSample {
  midi: number; // fractional MIDI
  cents: number;
  time: number; // seconds from exercise start
}

interface Props {
  /** The note sequence (all repetitions flattened) */
  notes: ExerciseNote[];
  /** Index of the currently active note (-1 if not playing) */
  currentNoteIndex: number;
  /** Total elapsed time (seconds) */
  totalElapsed: number;
  /** Total duration (seconds) */
  totalDuration: number;
  /** Current detected frequency */
  frequency: number;
  /** Current RMS level */
  rms: number;
  /** Whether exercise is actively playing */
  isPlaying: boolean;
}

// Colors
const BG_COLOR = '#1a1a2e';
const NOTE_BLOCK_COLOR = 'rgba(108, 99, 255, 0.25)';
const NOTE_BLOCK_ACTIVE = 'rgba(108, 99, 255, 0.45)';
const NOTE_BLOCK_LISTEN = 'rgba(255, 255, 255, 0.1)';
const NOTE_BORDER_COLOR = 'rgba(108, 99, 255, 0.6)';
const GRID_COLOR = '#2a2a3e';
const LABEL_COLOR = '#666';
const PLAYHEAD_COLOR = '#6c63ff';
const SYLLABLE_COLOR = '#aaa';

const LINE_WIDTH = 2.5;

/** How many seconds of exercise are visible in the viewport */
const VIEWPORT_SECONDS = 15;
/** Where the playhead sits in the viewport (0 = left edge, 1 = right edge) */
const PLAYHEAD_POSITION = 0.3;

export function ExerciseCanvas({
  notes,
  currentNoteIndex,
  totalElapsed,
  totalDuration,
  frequency,
  rms,
  isPlaying,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pitchHistoryRef = useRef<PitchSample[]>([]);
  const frameRef = useRef(0);

  // Record pitch samples
  useEffect(() => {
    if (!isPlaying || frequency <= 0 || rms < 0.01) return;

    const noteInfo = frequencyToNote(frequency);
    if (!noteInfo) return;

    const exactMidi = 12 * Math.log2(frequency / 440) + 69;
    pitchHistoryRef.current.push({
      midi: exactMidi,
      cents: noteInfo.cents,
      time: totalElapsed,
    });
  }, [frequency, rms, totalElapsed, isPlaying]);

  // Clear history when notes change (new exercise)
  useEffect(() => {
    pitchHistoryRef.current = [];
  }, [notes]);

  // Compute MIDI range from notes (with padding)
  // Enforce a minimum span of 16 semitones so small exercises aren't over-zoomed
  const midiRange = useCallback(() => {
    if (notes.length === 0) return { min: 55, max: 72 };
    let min = Infinity;
    let max = -Infinity;
    for (const n of notes) {
      if (n.midi < min) min = n.midi;
      if (n.midi > max) max = n.midi;
    }
    // Add padding of 4 semitones each side
    min -= 4;
    max += 4;
    // Enforce minimum span of 16 semitones, centered on the notes
    const span = max - min;
    if (span < 16) {
      const center = (min + max) / 2;
      min = center - 8;
      max = center + 8;
    }
    return { min, max };
  }, [notes]);

  // Pre-compute cumulative start times for each note (avoids recalc every frame)
  const noteStartTimes = useCallback(() => {
    const starts: number[] = [];
    let t = 0;
    for (const note of notes) {
      starts.push(t);
      t += note.durationSec;
    }
    return starts;
  }, [notes]);

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

    // Margins
    const leftM = 45;
    const rightM = 15;
    const topM = 15;
    const bottomM = 30; // space for syllables

    const plotW = W - leftM - rightM;
    const plotH = H - topM - bottomM;

    // Clear
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    if (notes.length === 0 || totalDuration <= 0) {
      frameRef.current = requestAnimationFrame(draw);
      return;
    }

    const range = midiRange();
    const midiSpan = range.max - range.min;
    const starts = noteStartTimes();

    // ── Viewport calculation ──
    // Determine the visible time window.
    // When idle/not yet started, show the beginning.
    // When playing, the playhead is at PLAYHEAD_POSITION across the viewport.
    // Clamp so we don't scroll past the start or end.

    let viewStart: number;
    let viewEnd: number;

    if (!isPlaying && totalElapsed <= 0) {
      // Before exercise starts — show from 0
      viewStart = 0;
      viewEnd = VIEWPORT_SECONDS;
    } else {
      // Playhead at PLAYHEAD_POSITION fraction of viewport
      viewStart = totalElapsed - PLAYHEAD_POSITION * VIEWPORT_SECONDS;
      viewEnd = viewStart + VIEWPORT_SECONDS;

      // Clamp to [0, totalDuration]
      if (viewStart < 0) {
        viewStart = 0;
        viewEnd = VIEWPORT_SECONDS;
      }
      if (viewEnd > totalDuration + 2) {
        // allow a small overshoot so the last notes are visible
        viewEnd = totalDuration + 2;
        viewStart = viewEnd - VIEWPORT_SECONDS;
        if (viewStart < 0) viewStart = 0;
      }
    }

    const viewSpan = viewEnd - viewStart;

    // Convert helpers (viewport-relative)
    const timeToX = (t: number) => leftM + ((t - viewStart) / viewSpan) * plotW;
    const midiToY = (midi: number) => {
      const normalized = (midi - range.min) / midiSpan;
      return topM + plotH * (1 - normalized);
    };
    const clampY = (y: number) => Math.max(topM, Math.min(y, topM + plotH));

    // ── Horizontal grid lines (note labels) ──
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let midi = Math.ceil(range.min); midi <= Math.floor(range.max); midi++) {
      const y = midiToY(midi);
      const isC = midi % 12 === 0;
      const isNatural = [0, 2, 4, 5, 7, 9, 11].includes(midi % 12);

      if (isC || isNatural) {
        ctx.strokeStyle = isC ? '#444' : GRID_COLOR;
        ctx.lineWidth = isC ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(leftM, y);
        ctx.lineTo(W - rightM, y);
        ctx.stroke();

        ctx.fillStyle = isC ? '#999' : LABEL_COLOR;
        ctx.fillText(midiToNoteName(midi), leftM - 4, y);
      }
    }

    // ── Draw note blocks (only those overlapping the viewport) ──
    // Clip drawing to the plot area
    ctx.save();
    ctx.beginPath();
    ctx.rect(leftM, topM, plotW, plotH);
    ctx.clip();

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const noteStart = starts[i];
      const noteEnd = noteStart + note.durationSec;

      // Skip notes entirely outside the viewport
      if (noteEnd < viewStart || noteStart > viewEnd) continue;

      const x1 = timeToX(noteStart);
      const x2 = timeToX(noteEnd);
      const noteY = midiToY(note.midi);
      const blockH = Math.max((plotH / midiSpan) * 0.8, 6);

      const isActive = i === currentNoteIndex;
      const isPast = i < currentNoteIndex;
      const isListen = note.isListen;

      // Block fill
      if (isListen) {
        ctx.fillStyle = NOTE_BLOCK_LISTEN;
      } else if (isActive) {
        ctx.fillStyle = NOTE_BLOCK_ACTIVE;
      } else if (isPast) {
        ctx.fillStyle = 'rgba(108, 99, 255, 0.15)';
      } else {
        ctx.fillStyle = NOTE_BLOCK_COLOR;
      }

      ctx.fillRect(x1, noteY - blockH / 2, x2 - x1, blockH);

      // Block border
      ctx.strokeStyle = NOTE_BORDER_COLOR;
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(x1, noteY - blockH / 2, x2 - x1, blockH);

      // Note name inside block (only if wide enough)
      const blockW = x2 - x1;
      if (blockW > 20) {
        ctx.fillStyle = isActive ? '#fff' : '#aaa';
        ctx.font = isActive ? 'bold 11px monospace' : '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(midiToNoteName(note.midi), (x1 + x2) / 2, noteY);
      }

      // Vertical separator between notes
      if (i > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, topM);
        ctx.lineTo(x1, topM + plotH);
        ctx.stroke();
      }
    }

    ctx.restore(); // remove clip

    // ── Syllables below the plot area (not clipped) ──
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const noteStart = starts[i];
      const noteEnd = noteStart + note.durationSec;

      if (noteEnd < viewStart || noteStart > viewEnd) continue;

      const x1 = timeToX(noteStart);
      const x2 = timeToX(noteEnd);
      const blockW = x2 - x1;

      if (blockW > 14) {
        const isActive = i === currentNoteIndex;
        ctx.fillStyle = SYLLABLE_COLOR;
        ctx.font = isActive ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(note.syllable, (x1 + x2) / 2, H - bottomM + 5);
      }
    }

    // ── Pitch history line ──
    const history = pitchHistoryRef.current;
    if (history.length > 1) {
      // Clip to plot area
      ctx.save();
      ctx.beginPath();
      ctx.rect(leftM, topM, plotW, plotH);
      ctx.clip();

      ctx.lineWidth = LINE_WIDTH;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      let prevSample: PitchSample | null = null;

      for (let i = 0; i < history.length; i++) {
        const sample = history[i];

        // Skip samples outside viewport (with small margin for line continuity)
        if (sample.time < viewStart - 0.5 || sample.time > viewEnd + 0.5) {
          prevSample = null;
          continue;
        }

        const x = timeToX(sample.time);
        const y = clampY(midiToY(sample.midi));

        if (!prevSample || sample.time - prevSample.time > 0.2) {
          ctx.beginPath();
          ctx.moveTo(x, y);
        } else {
          const color = centsToColor(sample.cents);
          ctx.strokeStyle = color;
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
        }

        prevSample = sample;
      }

      ctx.restore(); // remove clip
    }

    // ── Playhead ──
    if (isPlaying && totalElapsed <= totalDuration) {
      const px = timeToX(totalElapsed);
      // Only draw if playhead is within the visible plot
      if (px >= leftM && px <= leftM + plotW) {
        ctx.strokeStyle = PLAYHEAD_COLOR;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px, topM);
        ctx.lineTo(px, H - bottomM);
        ctx.stroke();
        ctx.setLineDash([]);

        // Playhead triangle
        ctx.fillStyle = PLAYHEAD_COLOR;
        ctx.beginPath();
        ctx.moveTo(px - 5, topM);
        ctx.lineTo(px + 5, topM);
        ctx.lineTo(px, topM + 8);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ── Current pitch dot ──
    if (isPlaying && frequency > 0 && rms >= 0.01) {
      const noteInfo = frequencyToNote(frequency);
      if (noteInfo) {
        const exactMidi = 12 * Math.log2(frequency / 440) + 69;
        const px = timeToX(totalElapsed);
        const py = clampY(midiToY(exactMidi));

        if (px >= leftM && px <= leftM + plotW) {
          const color = centsToColor(noteInfo.cents);

          // Glow
          ctx.beginPath();
          ctx.arc(px, py, 8, 0, Math.PI * 2);
          ctx.fillStyle = color + '33';
          ctx.fill();

          // Dot
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
    }

    frameRef.current = requestAnimationFrame(draw);
  }, [notes, currentNoteIndex, totalElapsed, totalDuration, frequency, rms, midiRange, noteStartTimes, isPlaying]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="exercise-canvas"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
