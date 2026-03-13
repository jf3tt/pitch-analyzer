/**
 * ExerciseList — grid of exercise cards with difficulty filter
 * and starting note selector.
 */

import { useState, useMemo } from 'react';
import type { Difficulty, Exercise } from '../data/exercises';
import {
  EXERCISES,
  getDifficultyLabel,
  getDifficultyColor,
  getCategoryLabel,
  getExerciseDuration,
} from '../data/exercises';
import { midiToNoteName } from '../utils/note-utils';

interface Props {
  onSelect: (exercise: Exercise, startMidi: number) => void;
}

const DIFFICULTIES: (Difficulty | 'all')[] = [
  'all',
  'beginner',
  'intermediate',
  'advanced',
];

// Reasonable starting notes for the picker (C2 through C5)
const START_NOTES: number[] = [];
for (let midi = 36; midi <= 72; midi++) {
  // Only include natural notes (no sharps) for simplicity
  const pc = midi % 12;
  if ([0, 2, 4, 5, 7, 9, 11].includes(pc)) {
    START_NOTES.push(midi);
  }
}

export function ExerciseList({ onSelect }: Props) {
  const [filter, setFilter] = useState<Difficulty | 'all'>('all');
  const [startMidi, setStartMidi] = useState(60); // C4 default

  const filtered = useMemo(() => {
    if (filter === 'all') return EXERCISES;
    return EXERCISES.filter((e) => e.difficulty === filter);
  }, [filter]);

  return (
    <div className="exercise-list">
      {/* Filter bar */}
      <div className="exercise-list-filters">
        <div className="difficulty-tabs">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              className={`tab-btn ${filter === d ? 'active' : ''}`}
              onClick={() => setFilter(d)}
              style={
                filter === d && d !== 'all'
                  ? { borderColor: getDifficultyColor(d as Difficulty) }
                  : undefined
              }
            >
              {d === 'all' ? 'All' : getDifficultyLabel(d)}
            </button>
          ))}
        </div>

        <div className="start-note-picker">
          <label htmlFor="start-note">Starting Note:</label>
          <select
            id="start-note"
            value={startMidi}
            onChange={(e) => setStartMidi(Number(e.target.value))}
          >
            {START_NOTES.map((midi) => (
              <option key={midi} value={midi}>
                {midiToNoteName(midi)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Exercise cards */}
      <div className="exercise-grid">
        {filtered.map((exercise) => {
          // Clamp startMidi to exercise's valid range
          const clampedStart = Math.max(
            exercise.startRange.minMidi,
            Math.min(startMidi, exercise.startRange.maxMidi),
          );

          return (
            <button
              key={exercise.id}
              className="exercise-card"
              onClick={() => onSelect(exercise, clampedStart)}
            >
              <div className="exercise-card-header">
                <span
                  className="exercise-difficulty-badge"
                  style={{
                    backgroundColor:
                      getDifficultyColor(exercise.difficulty) + '22',
                    color: getDifficultyColor(exercise.difficulty),
                    borderColor:
                      getDifficultyColor(exercise.difficulty) + '44',
                  }}
                >
                  {getDifficultyLabel(exercise.difficulty)}
                </span>
                <span className="exercise-category">
                  {getCategoryLabel(exercise.category)}
                </span>
              </div>
              <h3 className="exercise-card-title">{exercise.name}</h3>
              <p className="exercise-card-desc">{exercise.description}</p>
              <div className="exercise-card-meta">
                <span>{getExerciseDuration(exercise).toFixed(0)}s</span>
                <span>&middot;</span>
                <span>{exercise.repetitions} reps</span>
                <span>&middot;</span>
                <span>
                  {midiToNoteName(clampedStart)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
