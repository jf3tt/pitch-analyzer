/**
 * ExerciseScore — results screen shown after completing an exercise.
 *
 * Shows: overall score, pass/fail, per-note accuracy breakdown,
 * retry button, next exercise button, and back to list.
 */

import type { Exercise } from '../data/exercises';
import type { ExerciseResult } from '../hooks/useExerciseRunner';
import { EXERCISE_ORDER, getExerciseById } from '../data/exercises';
import { midiToNoteName } from '../utils/note-utils';

interface Props {
  exercise: Exercise;
  result: ExerciseResult;
  onRetry: () => void;
  onNext: (exerciseId: string) => void;
  onBack: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--green)';
  if (score >= 50) return 'var(--yellow)';
  return 'var(--red)';
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 0.7) return 'var(--green)';
  if (accuracy >= 0.4) return 'var(--yellow)';
  return 'var(--red)';
}

export function ExerciseScore({
  exercise,
  result,
  onRetry,
  onNext,
  onBack,
}: Props) {
  // Find next exercise in order
  const currentIndex = EXERCISE_ORDER.indexOf(exercise.id);
  const nextId =
    currentIndex >= 0 && currentIndex < EXERCISE_ORDER.length - 1
      ? EXERCISE_ORDER[currentIndex + 1]
      : null;
  const nextExercise = nextId ? getExerciseById(nextId) : null;

  return (
    <div className="exercise-score">
      <div className="score-header">
        <h2>{exercise.name}</h2>
        <span className="score-start-note">
          Key: {midiToNoteName(result.startMidi)}
        </span>
      </div>

      {/* Big score circle */}
      <div className="score-circle-container">
        <div
          className="score-circle"
          style={{ borderColor: getScoreColor(result.score) }}
        >
          <span
            className="score-number"
            style={{ color: getScoreColor(result.score) }}
          >
            {result.score}
          </span>
          <span className="score-label">/ 100</span>
        </div>
        <div
          className={`score-verdict ${result.passed ? 'passed' : 'failed'}`}
        >
          {result.passed ? 'Passed!' : 'Try Again'}
        </div>
      </div>

      {/* Per-note breakdown */}
      <div className="score-breakdown">
        <h3>Note Breakdown</h3>
        <div className="score-notes">
          {result.noteScores.map((ns, i) => (
            <div key={i} className="score-note-row">
              <span className="score-note-name">
                {midiToNoteName(ns.targetMidi)}
              </span>
              <span className="score-note-syllable">{ns.syllable}</span>
              <div className="score-note-bar-track">
                <div
                  className="score-note-bar-fill"
                  style={{
                    width: `${Math.round(ns.accuracy * 100)}%`,
                    backgroundColor: getAccuracyColor(ns.accuracy),
                  }}
                />
              </div>
              <span
                className="score-note-pct"
                style={{ color: getAccuracyColor(ns.accuracy) }}
              >
                {Math.round(ns.accuracy * 100)}%
              </span>
              <span className="score-note-cents">
                {ns.avgCentsDeviation > 0
                  ? `${ns.avgCentsDeviation.toFixed(0)}c avg`
                  : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="score-actions">
        <button className="btn-back" onClick={onBack}>
          &larr; Exercise List
        </button>
        <button className="btn-toggle" onClick={onRetry}>
          Retry
        </button>
        {nextExercise && nextId && (
          <button
            className="btn-toggle"
            onClick={() => onNext(nextId)}
          >
            Next: {nextExercise.name} &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
