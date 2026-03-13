/**
 * useExerciseRunner — core hook for running vocal exercises.
 *
 * Manages: exercise timing, note progression, pitch comparison,
 * per-note scoring, tone generator control, and overall results.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Exercise, ExerciseNote } from '../data/exercises';
import { generateAllRepetitions } from '../data/exercises';
import { ToneGenerator } from '../audio/tone-generator';
import type { PitchData } from '../audio/audio-engine';

// ============================================================
// Types
// ============================================================

export interface NoteScore {
  /** Target MIDI note */
  targetMidi: number;
  /** Syllable for this note */
  syllable: string;
  /** Duration of this note (seconds) */
  durationSec: number;
  /** Was this a listen-only phase? */
  isListen: boolean;
  /** Number of pitch samples collected */
  totalSamples: number;
  /** Number of samples within accuracy threshold */
  goodSamples: number;
  /** Accuracy ratio 0..1 */
  accuracy: number;
  /** Average cents deviation (absolute) */
  avgCentsDeviation: number;
}

export interface ExerciseResult {
  exerciseId: string;
  startMidi: number;
  /** Per-note scores (only singable notes, not listen phases) */
  noteScores: NoteScore[];
  /** Overall accuracy 0..1 */
  overallAccuracy: number;
  /** Overall score 0..100 */
  score: number;
  /** Whether the exercise was passed */
  passed: boolean;
}

export type RunnerState = 'idle' | 'countdown' | 'playing' | 'finished';

export interface ExerciseRunnerReturn {
  /** Current state of the exercise runner */
  state: RunnerState;
  /** Current exercise notes (all repetitions flattened) */
  notes: ExerciseNote[];
  /** Index of the current note being sung (or -1) */
  currentNoteIndex: number;
  /** Time elapsed within the current note (seconds) */
  noteElapsed: number;
  /** Total time elapsed in the exercise (seconds) */
  totalElapsed: number;
  /** Total duration of all repetitions (seconds) */
  totalDuration: number;
  /** Current repetition index (0-based) */
  currentRepetition: number;
  /** Total number of repetitions */
  totalRepetitions: number;
  /** Countdown value (3, 2, 1) or 0 */
  countdown: number;
  /** Real-time accuracy for the current note (0..1) */
  currentNoteAccuracy: number;
  /** Results after exercise is finished */
  result: ExerciseResult | null;
  /** Whether reference tone is muted */
  toneMuted: boolean;

  /** Start the exercise */
  start: (startMidi: number) => void;
  /** Stop / cancel the exercise */
  stop: () => void;
  /** Feed pitch data from audio engine */
  feedPitch: (data: PitchData) => void;
  /** Toggle reference tone mute */
  toggleToneMute: () => void;
}

// Constants
const COUNTDOWN_SECONDS = 3;
const GRACE_PERIOD_MS = 300; // ignore pitch during note transitions
const PITCH_SAMPLE_INTERVAL_MS = 50; // ~20 samples/sec

// ============================================================
// Hook
// ============================================================

export function useExerciseRunner(exercise: Exercise): ExerciseRunnerReturn {
  const [state, setState] = useState<RunnerState>('idle');
  const [notes, setNotes] = useState<ExerciseNote[]>([]);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [noteElapsed, setNoteElapsed] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [currentNoteAccuracy, setCurrentNoteAccuracy] = useState(0);
  const [result, setResult] = useState<ExerciseResult | null>(null);
  const [toneMuted, setToneMuted] = useState(false);

  // Refs for mutable state in animation loop
  const toneRef = useRef<ToneGenerator | null>(null);
  const startMidiRef = useRef(60);
  const stateRef = useRef<RunnerState>('idle');
  const notesRef = useRef<ExerciseNote[]>([]);
  const noteIndexRef = useRef(-1);
  const noteStartTimeRef = useRef(0);
  const exerciseStartTimeRef = useRef(0);
  const frameRef = useRef(0);
  const lastTransitionTimeRef = useRef(0);
  /** Number of notes per repetition — used to derive currentRepetition */
  const notesPerRepRef = useRef(0);
  const totalRepetitionsRef = useRef(0);

  // Per-note scoring accumulators
  const noteScoresRef = useRef<NoteScore[]>([]);
  const currentGoodRef = useRef(0);
  const currentTotalRef = useRef(0);
  const currentCentsAccumRef = useRef(0);
  const lastSampleTimeRef = useRef(0);

  // Total duration — computed from current notes (all repetitions)
  const totalDuration = notes.reduce((s, n) => s + n.durationSec, 0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(frameRef.current);
      toneRef.current?.dispose();
      toneRef.current = null;
    };
  }, []);

  // Start a note (play tone, reset accumulators)
  const startNote = useCallback(
    (index: number, noteList: ExerciseNote[]) => {
      const note = noteList[index];
      if (!note) return;

      noteIndexRef.current = index;
      noteStartTimeRef.current = performance.now();
      lastTransitionTimeRef.current = performance.now();
      setCurrentNoteIndex(index);
      setNoteElapsed(0);
      setCurrentNoteAccuracy(0);
      currentGoodRef.current = 0;
      currentTotalRef.current = 0;
      currentCentsAccumRef.current = 0;
      lastSampleTimeRef.current = 0;

      // Play reference tone for this note
      if (toneRef.current) {
        toneRef.current.playMidi(note.midi);
      }
    },
    [],
  );

  // Finalize scoring for the current note
  const finalizeCurrentNote = useCallback(() => {
    const idx = noteIndexRef.current;
    const noteList = notesRef.current;
    if (idx < 0 || idx >= noteList.length) return;

    const note = noteList[idx];
    const total = currentTotalRef.current;
    const good = currentGoodRef.current;
    const avgCents =
      total > 0 ? currentCentsAccumRef.current / total : 0;

    noteScoresRef.current.push({
      targetMidi: note.midi,
      syllable: note.syllable,
      durationSec: note.durationSec,
      isListen: note.isListen ?? false,
      totalSamples: total,
      goodSamples: good,
      accuracy: total > 0 ? good / total : 0,
      avgCentsDeviation: avgCents,
    });
  }, []);

  // Finish the exercise — compute results
  const finishExercise = useCallback(() => {
    stateRef.current = 'finished';
    setState('finished');
    toneRef.current?.stop();

    // Only score non-listen notes
    const singableScores = noteScoresRef.current.filter((s) => !s.isListen);

    const totalSamples = singableScores.reduce(
      (s, n) => s + n.totalSamples,
      0,
    );
    const totalGood = singableScores.reduce((s, n) => s + n.goodSamples, 0);
    const overallAccuracy = totalSamples > 0 ? totalGood / totalSamples : 0;

    const exerciseResult: ExerciseResult = {
      exerciseId: exercise.id,
      startMidi: startMidiRef.current,
      noteScores: singableScores,
      overallAccuracy,
      score: Math.round(overallAccuracy * 100),
      passed: overallAccuracy >= exercise.successCriteria.minAccuracyRatio,
    };

    setResult(exerciseResult);
  }, [exercise.id, exercise.successCriteria.minAccuracyRatio]);

  // Animation loop — advances notes based on elapsed time
  const tick = useCallback(() => {
    if (stateRef.current !== 'playing') return;

    const now = performance.now();
    const noteList = notesRef.current;
    const idx = noteIndexRef.current;

    if (idx < 0 || idx >= noteList.length) {
      finishExercise();
      return;
    }

    const note = noteList[idx];
    const elapsed = (now - noteStartTimeRef.current) / 1000;
    const totalEl = (now - exerciseStartTimeRef.current) / 1000;

    setNoteElapsed(elapsed);
    setTotalElapsed(totalEl);

    // Update current repetition based on note index
    if (notesPerRepRef.current > 0) {
      setCurrentRepetition(
        Math.floor(idx / notesPerRepRef.current),
      );
    }

    // Update real-time accuracy for current note
    const total = currentTotalRef.current;
    const good = currentGoodRef.current;
    setCurrentNoteAccuracy(total > 0 ? good / total : 0);

    // Check if current note duration is exceeded
    if (elapsed >= note.durationSec) {
      finalizeCurrentNote();

      const nextIdx = idx + 1;
      if (nextIdx >= noteList.length) {
        finishExercise();
        return;
      }

      startNote(nextIdx, noteList);
    }

    frameRef.current = requestAnimationFrame(tick);
  }, [finalizeCurrentNote, finishExercise, startNote]);

  // Start the exercise
  const start = useCallback(
    (startMidi: number) => {
      startMidiRef.current = startMidi;
      setResult(null);
      setCurrentRepetition(0);
      noteScoresRef.current = [];

      // Generate notes for ALL repetitions (ascending chromatically)
      const repetitions = generateAllRepetitions(exercise, startMidi);
      totalRepetitionsRef.current = repetitions.length;

      // Notes per single repetition (for tracking current rep)
      notesPerRepRef.current =
        repetitions.length > 0 ? repetitions[0].length : 0;

      // Flatten into one long sequence
      const allNotes: ExerciseNote[] = [];
      for (const rep of repetitions) {
        for (const note of rep) {
          allNotes.push(note);
        }
      }

      notesRef.current = allNotes;
      setNotes(allNotes);

      // Setup tone generator
      if (!toneRef.current) {
        toneRef.current = new ToneGenerator();
      }
      toneRef.current.muted = toneMuted;

      // Countdown
      stateRef.current = 'countdown';
      setState('countdown');
      setCountdown(COUNTDOWN_SECONDS);

      let count = COUNTDOWN_SECONDS;
      const countdownInterval = setInterval(() => {
        count--;
        setCountdown(count);

        if (count <= 0) {
          clearInterval(countdownInterval);

          // Start playing
          stateRef.current = 'playing';
          setState('playing');
          exerciseStartTimeRef.current = performance.now();

          startNote(0, allNotes);
          frameRef.current = requestAnimationFrame(tick);
        }
      }, 1000);
    },
    [exercise, toneMuted, startNote, tick],
  );

  // Stop the exercise
  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    stateRef.current = 'idle';
    setState('idle');
    setCurrentNoteIndex(-1);
    setNoteElapsed(0);
    setTotalElapsed(0);
    setCountdown(0);
    toneRef.current?.stop();
    noteScoresRef.current = [];
  }, []);

  // Feed pitch data — called every time audio engine produces a sample
  const feedPitch = useCallback(
    (data: PitchData) => {
      if (stateRef.current !== 'playing') return;

      const idx = noteIndexRef.current;
      const noteList = notesRef.current;
      if (idx < 0 || idx >= noteList.length) return;

      const note = noteList[idx];

      // Skip listen phases
      if (note.isListen) return;

      // Grace period after note transition
      const timeSinceTransition =
        performance.now() - lastTransitionTimeRef.current;
      if (timeSinceTransition < GRACE_PERIOD_MS) return;

      // Rate-limit sampling
      const now = performance.now();
      if (now - lastSampleTimeRef.current < PITCH_SAMPLE_INTERVAL_MS) return;
      lastSampleTimeRef.current = now;

      // Skip if silence
      if (data.frequency <= 0 || data.rms < 0.01) {
        currentTotalRef.current++;
        return;
      }

      // Calculate cents deviation from target
      const targetMidi = note.midi;
      const detectedMidi = 12 * Math.log2(data.frequency / 440) + 69;
      const centsOff = Math.abs((detectedMidi - targetMidi) * 100);

      currentTotalRef.current++;
      currentCentsAccumRef.current += centsOff;

      if (centsOff <= exercise.successCriteria.maxCentsDeviation) {
        currentGoodRef.current++;
      }
    },
    [exercise.successCriteria.maxCentsDeviation],
  );

  // Toggle tone mute
  const toggleToneMute = useCallback(() => {
    setToneMuted((prev) => {
      const next = !prev;
      if (toneRef.current) {
        toneRef.current.muted = next;
      }
      return next;
    });
  }, []);

  return {
    state,
    notes,
    currentNoteIndex,
    noteElapsed,
    totalElapsed,
    totalDuration,
    currentRepetition,
    totalRepetitions: totalRepetitionsRef.current,
    countdown,
    currentNoteAccuracy,
    result,
    toneMuted,
    start,
    stop,
    feedPitch,
    toggleToneMute,
  };
}
