import { useEffect, useRef, useState } from 'react';
import type { NoteInfo } from '../utils/note-utils';
import { frequencyToNote, centsToColor } from '../utils/note-utils';

interface Props {
  frequency: number;
  rms: number;
}

/**
 * Displays the currently detected note, octave, and cents deviation.
 * Large indicator in the center of the screen.
 */
export function PitchDisplay({ frequency, rms }: Props) {
  const [note, setNote] = useState<NoteInfo | null>(null);
  const [smoothCents, setSmoothCents] = useState(0);
  const prevCentsRef = useRef(0);

  useEffect(() => {
    if (frequency <= 0 || rms < 0.01) {
      setNote(null);
      return;
    }

    const info = frequencyToNote(frequency);
    if (!info) {
      setNote(null);
      return;
    }

    setNote(info);

    // Smooth cents for stable display
    const alpha = 0.3; // smoothing factor
    const smoothed = prevCentsRef.current * (1 - alpha) + info.cents * alpha;
    prevCentsRef.current = smoothed;
    setSmoothCents(Math.round(smoothed));
  }, [frequency, rms]);

  const color = note ? centsToColor(note.cents) : '#666';
  const centsSign = smoothCents > 0 ? '+' : '';

  // Deviation bar indicator: 0 at center, -50 at left, +50 at right
  const indicatorPosition = note ? 50 + (smoothCents / 50) * 50 : 50;

  return (
    <div className="pitch-display">
      <div className="pitch-note" style={{ color }}>
        {note ? note.name : '—'}
      </div>
      <div className="pitch-octave">
        {note ? note.octave : ''}
      </div>
      <div className="pitch-cents" style={{ color }}>
        {note ? `${centsSign}${smoothCents} cents` : 'Sing something...'}
      </div>
      <div className="pitch-freq">
        {note ? `${frequency.toFixed(1)} Hz` : ''}
      </div>

      {/* Cents deviation bar */}
      <div className="cents-bar">
        <div className="cents-bar-track">
          <div className="cents-bar-center" />
          <div
            className="cents-bar-indicator"
            style={{
              left: `${indicatorPosition}%`,
              backgroundColor: color,
            }}
          />
        </div>
        <div className="cents-bar-labels">
          <span>-50</span>
          <span>0</span>
          <span>+50</span>
        </div>
      </div>
    </div>
  );
}
