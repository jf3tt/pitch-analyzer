import { useState, useCallback, useRef } from 'react';
import { AudioEngine } from './audio/audio-engine';
import type { PitchData } from './audio/audio-engine';
import type { Exercise } from './data/exercises';
import { getExerciseById } from './data/exercises';
import { PitchDisplay } from './components/PitchDisplay';
import { PitchCanvas } from './components/PitchCanvas';
import { Controls } from './components/Controls';
import { ExerciseList } from './components/ExerciseList';
import { ExercisePlayer } from './components/ExercisePlayer';
import './App.css';

type AppMode = 'free' | 'exercises';
type ExerciseScreen = 'list' | 'player';

interface ExerciseSelection {
  exercise: Exercise;
  startMidi: number;
}

function App() {
  // --- Mode ---
  const [mode, setMode] = useState<AppMode>('free');

  // --- Exercise state ---
  const [exerciseScreen, setExerciseScreen] = useState<ExerciseScreen>('list');
  const [selection, setSelection] = useState<ExerciseSelection | null>(null);

  // --- Free Mode state ---
  const [isRunning, setIsRunning] = useState(false);
  const [pitchData, setPitchData] = useState<PitchData>({
    frequency: -1,
    rms: 0,
    timestamp: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<AudioEngine | null>(null);

  const handlePitchData = useCallback((data: PitchData) => {
    setPitchData(data);
  }, []);

  const handleToggle = useCallback(async () => {
    if (isRunning) {
      engineRef.current?.stop();
      engineRef.current = null;
      setIsRunning(false);
      setPitchData({ frequency: -1, rms: 0, timestamp: 0 });
    } else {
      try {
        setError(null);
        const engine = new AudioEngine();
        engineRef.current = engine;
        await engine.start(handlePitchData);
        setIsRunning(true);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to access microphone';
        setError(msg);
        console.error('Failed to start audio engine:', err);
      }
    }
  }, [isRunning, handlePitchData]);

  // --- Mode switching ---
  const switchToFree = useCallback(() => {
    // Stop free mode mic if running
    if (isRunning) {
      engineRef.current?.stop();
      engineRef.current = null;
      setIsRunning(false);
      setPitchData({ frequency: -1, rms: 0, timestamp: 0 });
    }
    setMode('free');
    setExerciseScreen('list');
    setSelection(null);
  }, [isRunning]);

  const switchToExercises = useCallback(() => {
    // Stop free mode mic if running
    if (isRunning) {
      engineRef.current?.stop();
      engineRef.current = null;
      setIsRunning(false);
      setPitchData({ frequency: -1, rms: 0, timestamp: 0 });
    }
    setMode('exercises');
    setExerciseScreen('list');
    setSelection(null);
  }, [isRunning]);

  // --- Exercise navigation ---
  const handleSelectExercise = useCallback(
    (exercise: Exercise, startMidi: number) => {
      setSelection({ exercise, startMidi });
      setExerciseScreen('player');
    },
    [],
  );

  const handleBackToList = useCallback(() => {
    setExerciseScreen('list');
    setSelection(null);
  }, []);

  const handleSelectExerciseById = useCallback(
    (exerciseId: string) => {
      const ex = getExerciseById(exerciseId);
      if (ex && selection) {
        // Keep the same start note, clamped to new exercise range
        const clamped = Math.max(
          ex.startRange.minMidi,
          Math.min(selection.startMidi, ex.startRange.maxMidi),
        );
        setSelection({ exercise: ex, startMidi: clamped });
        setExerciseScreen('player');
      }
    },
    [selection],
  );

  // --- Render ---
  return (
    <div className="app">
      <header className="app-header">
        <h1>Pitch Detector</h1>
        <div className="mode-switcher">
          <button
            className={`mode-btn ${mode === 'free' ? 'active' : ''}`}
            onClick={switchToFree}
          >
            Free Mode
          </button>
          <button
            className={`mode-btn ${mode === 'exercises' ? 'active' : ''}`}
            onClick={switchToExercises}
          >
            Exercises
          </button>
        </div>
        {mode === 'free' && (
          <Controls isRunning={isRunning} onToggle={handleToggle} />
        )}
      </header>

      {error && mode === 'free' && (
        <div className="error-banner">{error}</div>
      )}

      {/* Free Mode */}
      {mode === 'free' && (
        <main className="app-main">
          <PitchDisplay
            frequency={pitchData.frequency}
            rms={pitchData.rms}
          />
          <div className="canvas-container">
            <PitchCanvas
              frequency={pitchData.frequency}
              rms={pitchData.rms}
            />
          </div>
        </main>
      )}

      {/* Exercise Mode — List */}
      {mode === 'exercises' && exerciseScreen === 'list' && (
        <main className="app-main">
          <ExerciseList onSelect={handleSelectExercise} />
        </main>
      )}

      {/* Exercise Mode — Player */}
      {mode === 'exercises' &&
        exerciseScreen === 'player' &&
        selection && (
          <main className="app-main">
            <ExercisePlayer
              exercise={selection.exercise}
              startMidi={selection.startMidi}
              onBack={handleBackToList}
              onSelectExercise={handleSelectExerciseById}
            />
          </main>
        )}
    </div>
  );
}

export default App;
