/**
 * ExercisePlayer — main component for running a single exercise.
 *
 * Wires together: AudioEngine, useExerciseRunner, ExerciseCanvas,
 * PitchDisplay, and control buttons (start, stop, tone mute, back).
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Exercise } from '../data/exercises';
import { midiToNoteName } from '../utils/note-utils';
import { AudioEngine } from '../audio/audio-engine';
import type { PitchData } from '../audio/audio-engine';
import { useExerciseRunner } from '../hooks/useExerciseRunner';
import { ExerciseCanvas } from './ExerciseCanvas';
import { PitchDisplay } from './PitchDisplay';
import { ExerciseScore } from './ExerciseScore';

// Natural-note pitch classes (no sharps/flats) for the starting-note picker
const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];

interface Props {
  exercise: Exercise;
  /** Starting MIDI note chosen by the user */
  startMidi: number;
  onBack: () => void;
  onSelectExercise: (exerciseId: string) => void;
}

export function ExercisePlayer({
  exercise,
  startMidi,
  onBack,
  onSelectExercise,
}: Props) {
  const [pitchData, setPitchData] = useState<PitchData>({
    frequency: -1,
    rms: 0,
    timestamp: 0,
  });
  const [micError, setMicError] = useState<string | null>(null);
  const [micRunning, setMicRunning] = useState(false);
  const [localStartMidi, setLocalStartMidi] = useState(startMidi);

  // Sync local state when the prop changes (e.g. switching exercises via "Next")
  useEffect(() => {
    setLocalStartMidi(startMidi);
  }, [startMidi]);

  // Build the list of selectable starting notes for this exercise
  const startNoteOptions = useMemo(() => {
    const { minMidi, maxMidi } = exercise.startRange;
    const notes: number[] = [];
    for (let midi = minMidi; midi <= maxMidi; midi++) {
      if (NATURAL_PCS.includes(midi % 12)) {
        notes.push(midi);
      }
    }
    return notes;
  }, [exercise.startRange]);

  const engineRef = useRef<AudioEngine | null>(null);
  const runner = useExerciseRunner(exercise);

  // Feed pitch data to the exercise runner
  const handlePitch = useCallback(
    (data: PitchData) => {
      setPitchData(data);
      runner.feedPitch(data);
    },
    [runner],
  );

  // Start the microphone
  const startMic = useCallback(async () => {
    if (engineRef.current) return;
    try {
      setMicError(null);
      const engine = new AudioEngine();
      engineRef.current = engine;
      await engine.start(handlePitch);
      setMicRunning(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to access microphone';
      setMicError(msg);
    }
  }, [handlePitch]);

  // Stop the microphone
  const stopMic = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    setMicRunning(false);
    setPitchData({ frequency: -1, rms: 0, timestamp: 0 });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  // Start exercise: ensure mic is running, then begin
  const handleStart = useCallback(async () => {
    if (!micRunning) {
      await startMic();
    }
    runner.start(localStartMidi);
  }, [micRunning, startMic, runner, localStartMidi]);

  // Stop exercise
  const handleStop = useCallback(() => {
    runner.stop();
  }, [runner]);

  // Retry — restart same exercise with same start note
  const handleRetry = useCallback(() => {
    runner.start(localStartMidi);
  }, [runner, localStartMidi]);

  // Go to next exercise
  const handleNext = useCallback(
    (nextId: string) => {
      runner.stop();
      stopMic();
      onSelectExercise(nextId);
    },
    [runner, stopMic, onSelectExercise],
  );

  // Back to exercise list
  const handleBack = useCallback(() => {
    runner.stop();
    stopMic();
    onBack();
  }, [runner, stopMic, onBack]);

  // Show score screen when finished
  if (runner.state === 'finished' && runner.result) {
    return (
      <ExerciseScore
        exercise={exercise}
        result={runner.result}
        onRetry={handleRetry}
        onNext={handleNext}
        onBack={handleBack}
      />
    );
  }

  const isIdle = runner.state === 'idle';
  const isCountdown = runner.state === 'countdown';
  const isPlaying = runner.state === 'playing';

  return (
    <div className="exercise-player">
      {/* Header */}
      <div className="exercise-player-header">
        <button className="btn-back" onClick={handleBack}>
          &larr; Back
        </button>
        <div className="exercise-player-info">
          <h2>{exercise.name}</h2>
          <span className="exercise-player-key">
            {isIdle ? (
              <span className="start-note-picker">
                <label htmlFor="player-start-note">Start:</label>
                <select
                  id="player-start-note"
                  value={localStartMidi}
                  onChange={(e) => setLocalStartMidi(Number(e.target.value))}
                >
                  {startNoteOptions.map((midi) => (
                    <option key={midi} value={midi}>
                      {midiToNoteName(midi)}
                    </option>
                  ))}
                </select>
              </span>
            ) : (
              <>
                Starting: {midiToNoteName(localStartMidi)}
                {(isPlaying || isCountdown) && runner.totalRepetitions > 1 && (
                  <> &middot; Rep {runner.currentRepetition + 1} / {runner.totalRepetitions}</>
                )}
              </>
            )}
          </span>
        </div>
        <div className="exercise-player-controls">
          {isIdle && (
            <button className="btn-toggle" onClick={handleStart}>
              Start
            </button>
          )}
          {(isPlaying || isCountdown) && (
            <button className="btn-toggle active" onClick={handleStop}>
              Stop
            </button>
          )}
          <button
            className={`btn-tone ${runner.toneMuted ? 'muted' : ''}`}
            onClick={runner.toggleToneMute}
            title={runner.toneMuted ? 'Unmute reference tone' : 'Mute reference tone (ear training)'}
          >
            {runner.toneMuted ? 'Tone Off' : 'Tone On'}
          </button>
        </div>
      </div>

      {/* Error */}
      {micError && <div className="error-banner">{micError}</div>}

      {/* Instruction */}
      {isIdle && (
        <div className="exercise-instruction">
          <p>{exercise.instruction}</p>
        </div>
      )}

      {/* Countdown overlay */}
      {isCountdown && (
        <div className="countdown-overlay">
          <div className="countdown-number">{runner.countdown}</div>
        </div>
      )}

      {/* Main content */}
      <div className="exercise-player-body">
        <PitchDisplay frequency={pitchData.frequency} rms={pitchData.rms} />
        <div className="canvas-container">
          <ExerciseCanvas
            notes={runner.notes}
            currentNoteIndex={runner.currentNoteIndex}
            totalElapsed={runner.totalElapsed}
            totalDuration={runner.totalDuration}
            frequency={pitchData.frequency}
            rms={pitchData.rms}
            isPlaying={isPlaying}
          />
        </div>

        {/* Real-time accuracy bar */}
        {isPlaying && (
          <div className="exercise-accuracy-bar">
            <span className="accuracy-label">Note accuracy:</span>
            <div className="accuracy-track">
              <div
                className="accuracy-fill"
                style={{
                  width: `${Math.round(runner.currentNoteAccuracy * 100)}%`,
                  backgroundColor:
                    runner.currentNoteAccuracy >= 0.7
                      ? 'var(--green)'
                      : runner.currentNoteAccuracy >= 0.4
                        ? 'var(--yellow)'
                        : 'var(--red)',
                }}
              />
            </div>
            <span className="accuracy-value">
              {Math.round(runner.currentNoteAccuracy * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
