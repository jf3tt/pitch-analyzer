import { useEffect, useRef, useCallback } from 'react';
import {
  frequencyToNote,
  centsToColor,
  midiToNoteName,
  VOCAL_RANGE,
} from '../utils/note-utils';

interface PitchPoint {
  frequency: number;
  midi: number; // fractional MIDI for smooth line
  cents: number;
  rms: number;
  timestamp: number;
}

interface Props {
  frequency: number;
  rms: number;
  /** Visible window width in seconds */
  windowSeconds?: number;
}

const GRID_COLOR = '#333';
const GRID_LABEL_COLOR = '#666';
const LINE_WIDTH = 2.5;
const POINT_RADIUS = 3;

/**
 * Canvas component with a horizontal pitch line.
 * X-axis = time (scrolls right), Y-axis = pitch (MIDI notes).
 */
export function PitchCanvas({ frequency, rms, windowSeconds = 8 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<PitchPoint[]>([]);
  const animFrameRef = useRef<number>(0);

  // Add a new point when frequency changes
  useEffect(() => {
    const now = performance.now();

    if (frequency > 0 && rms >= 0.01) {
      const noteInfo = frequencyToNote(frequency);
      if (noteInfo) {
        // Fractional MIDI for smooth line
        const exactMidi = 12 * Math.log2(frequency / 440) + 69;
        historyRef.current.push({
          frequency,
          midi: exactMidi,
          cents: noteInfo.cents,
          rms,
          timestamp: now,
        });
      }
    } else {
      // Silence — add a gap marker
      historyRef.current.push({
        frequency: -1,
        midi: -1,
        cents: 0,
        rms: 0,
        timestamp: now,
      });
    }

    // Prune old points (keep windowSeconds * 2 as buffer)
    const cutoff = now - windowSeconds * 2 * 1000;
    const firstValid = historyRef.current.findIndex(
      (p) => p.timestamp >= cutoff,
    );
    if (firstValid > 0) {
      historyRef.current = historyRef.current.slice(firstValid);
    }
  }, [frequency, rms, windowSeconds]);

  // Draw the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle DPR for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

    const now = performance.now();
    const windowMs = windowSeconds * 1000;

    const { minMidi, maxMidi } = VOCAL_RANGE;
    const midiRange = maxMidi - minMidi;

    // Margin for labels
    const leftMargin = 40;
    const rightMargin = 10;
    const topMargin = 10;
    const bottomMargin = 10;

    const plotW = W - leftMargin - rightMargin;
    const plotH = H - topMargin - bottomMargin;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // Coordinate conversion functions
    const timeToX = (t: number) => {
      const elapsed = now - t;
      return leftMargin + plotW * (1 - elapsed / windowMs);
    };

    const midiToY = (midi: number) => {
      const normalized = (midi - minMidi) / midiRange;
      return topMargin + plotH * (1 - normalized);
    };

    // Draw horizontal grid (notes)
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let midi = minMidi; midi <= maxMidi; midi++) {
      const y = midiToY(midi);
      const noteName = midiToNoteName(midi);
      const isC = midi % 12 === 0; // Highlight C notes
      const isNatural = [0, 2, 4, 5, 7, 9, 11].includes(midi % 12);

      if (isC) {
        // C notes — brighter line
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(W - rightMargin, y);
        ctx.stroke();

        ctx.fillStyle = '#999';
        ctx.fillText(noteName, leftMargin - 4, y);
      } else if (isNatural) {
        // Natural notes — thin line
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(W - rightMargin, y);
        ctx.stroke();

        ctx.fillStyle = GRID_LABEL_COLOR;
        ctx.fillText(noteName, leftMargin - 4, y);
      }
    }

    // Draw pitch line
    const history = historyRef.current;
    const visibleStart = now - windowMs;

    // Filter visible points
    const visible = history.filter((p) => p.timestamp >= visibleStart);

    if (visible.length < 2) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    // Draw line in segments (break on silence)
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    let segmentStarted = false;
    let prevPoint: PitchPoint | null = null;

    for (let i = 0; i < visible.length; i++) {
      const point = visible[i];

      if (point.frequency <= 0) {
        // Gap — end current segment
        if (segmentStarted) {
          ctx.stroke();
          segmentStarted = false;
        }
        prevPoint = null;
        continue;
      }

      const x = timeToX(point.timestamp);
      const y = midiToY(point.midi);

      if (!segmentStarted || !prevPoint) {
        // Start a new segment
        ctx.beginPath();
        ctx.moveTo(x, y);
        segmentStarted = true;
      } else {
        // Color based on pitch accuracy
        const color = centsToColor(point.cents);
        ctx.strokeStyle = color;
        ctx.lineTo(x, y);
      }

      prevPoint = point;
    }

    if (segmentStarted) {
      ctx.stroke();
    }

    // Draw current point (last active)
    const activePoints = visible.filter((p) => p.frequency > 0);
    const lastActive = activePoints.length > 0 ? activePoints[activePoints.length - 1] : undefined;
    if (lastActive && now - lastActive.timestamp < 200) {
      const x = timeToX(lastActive.timestamp);
      const y = midiToY(lastActive.midi);
      const color = centsToColor(lastActive.cents);

      ctx.beginPath();
      ctx.arc(x, y, POINT_RADIUS * 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Glow effect
      ctx.beginPath();
      ctx.arc(x, y, POINT_RADIUS * 4, 0, Math.PI * 2);
      ctx.fillStyle = color.replace(')', ', 0.2)').replace('rgb', 'rgba');
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [windowSeconds]);

  // Start animation loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="pitch-canvas"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
