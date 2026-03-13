/**
 * Vocal training exercises data and types.
 *
 * 15 exercises across 6 categories, 3 difficulty levels.
 * Based on standard vocal pedagogy (Bel Canto, Seth Riggs SLS)
 * and patterns from apps like Vanido, SingTrue, Vocalista.
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type ExerciseCategory =
  | 'single_note'
  | 'interval'
  | 'scale'
  | 'arpeggio'
  | 'syllable'
  | 'siren';

export interface ExerciseNote {
  /** Absolute MIDI note number */
  midi: number;
  /** Duration in seconds */
  durationSec: number;
  /** Syllable to sing */
  syllable: string;
  /** If true, this is a "listen" phase — app plays tone, user doesn't sing */
  isListen?: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  description: string;
  instruction: string;
  /** Semitone offsets from root for each note */
  pattern: {
    intervals: number[];
    durations: number[];
    syllables: string[];
    /** Which notes are "listen" phases (index-based) */
    listenIndices?: number[];
  };
  startRange: {
    minMidi: number;
    maxMidi: number;
    /** Semitones to move up between repetitions */
    stepSize: number;
  };
  successCriteria: {
    maxCentsDeviation: number;
    minSustainSec: number;
    minAccuracyRatio: number;
  };
  /** BPM for timed exercises, null = free tempo */
  bpm: number | null;
  /** Number of repetitions (ascending chromatically) */
  repetitions: number;
  /** For sirens: evaluate as continuous glide, not discrete notes */
  isSiren?: boolean;
}

// ============================================================
// Helper functions
// ============================================================

export function generateExerciseNotes(
  exercise: Exercise,
  startMidi: number,
): ExerciseNote[] {
  return exercise.pattern.intervals.map((interval, i) => ({
    midi: startMidi + interval,
    durationSec: exercise.pattern.durations[i],
    syllable: exercise.pattern.syllables[i],
    isListen: exercise.pattern.listenIndices?.includes(i) ?? false,
  }));
}

export function generateAllRepetitions(
  exercise: Exercise,
  startMidi?: number,
): ExerciseNote[][] {
  const sequences: ExerciseNote[][] = [];
  let current = startMidi ?? exercise.startRange.minMidi;

  for (let i = 0; i < exercise.repetitions; i++) {
    if (current > exercise.startRange.maxMidi) break;
    sequences.push(generateExerciseNotes(exercise, current));
    current += exercise.startRange.stepSize;
  }

  return sequences;
}

/** Total duration of one repetition in seconds */
export function getExerciseDuration(exercise: Exercise): number {
  return exercise.pattern.durations.reduce((sum, d) => sum + d, 0);
}

/** Get category display label */
export function getCategoryLabel(cat: ExerciseCategory): string {
  const labels: Record<ExerciseCategory, string> = {
    single_note: 'Single Note',
    interval: 'Intervals',
    scale: 'Scales',
    arpeggio: 'Arpeggios',
    syllable: 'Syllables',
    siren: 'Sirens',
  };
  return labels[cat];
}

/** Get difficulty display label */
export function getDifficultyLabel(diff: Difficulty): string {
  const labels: Record<Difficulty, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };
  return labels[diff];
}

/** Get difficulty color */
export function getDifficultyColor(diff: Difficulty): string {
  const colors: Record<Difficulty, string> = {
    beginner: '#4ade80',
    intermediate: '#facc15',
    advanced: '#f87171',
  };
  return colors[diff];
}

// ============================================================
// Exercise definitions
// ============================================================

export const EXERCISES: Exercise[] = [
  // --- BEGINNER ---
  {
    id: 'single_note_sustain',
    name: 'Single Note Sustain',
    category: 'single_note',
    difficulty: 'beginner',
    description: 'Match a reference pitch and hold it steady.',
    instruction:
      'A note will play. Sing "Ah" and match the pitch. Hold it steady for 3 seconds. Green = on pitch.',
    pattern: {
      intervals: [0],
      durations: [3.0],
      syllables: ['ah'],
    },
    startRange: { minMidi: 48, maxMidi: 72, stepSize: 2 },
    successCriteria: {
      maxCentsDeviation: 20,
      minSustainSec: 2.0,
      minAccuracyRatio: 0.6,
    },
    bpm: null,
    repetitions: 10,
  },
  {
    id: 'pitch_echo',
    name: 'Pitch Echo',
    category: 'single_note',
    difficulty: 'beginner',
    description: 'Listen to a tone, then reproduce it from memory.',
    instruction:
      'Listen to the reference tone (2 sec). When it stops, hum "Mm" to match the pitch from memory.',
    pattern: {
      intervals: [0, 0],
      durations: [2.0, 2.0],
      syllables: ['(listen)', 'mm'],
      listenIndices: [0],
    },
    startRange: { minMidi: 48, maxMidi: 72, stepSize: 3 },
    successCriteria: {
      maxCentsDeviation: 25,
      minSustainSec: 1.5,
      minAccuracyRatio: 0.5,
    },
    bpm: null,
    repetitions: 10,
  },
  {
    id: 'vowel_single_pitch_rotate',
    name: 'Vowel Rotation',
    category: 'syllable',
    difficulty: 'beginner',
    description:
      'Sing 5 vowels on one pitch without wavering. Changing mouth shape tends to pull pitch — keep it steady.',
    instruction:
      'On a single note, sing: Ah-Eh-Ee-Oh-Oo. Hold each for 1.5 sec. Keep the pitch perfectly steady as your mouth changes shape.',
    pattern: {
      intervals: [0, 0, 0, 0, 0],
      durations: [1.5, 1.5, 1.5, 1.5, 1.5],
      syllables: ['ah', 'eh', 'ee', 'oh', 'oo'],
    },
    startRange: { minMidi: 48, maxMidi: 72, stepSize: 2 },
    successCriteria: {
      maxCentsDeviation: 15,
      minSustainSec: 1.0,
      minAccuracyRatio: 0.7,
    },
    bpm: null,
    repetitions: 10,
  },
  {
    id: 'vowel_ma_me_mi_mo_mu',
    name: 'Ma-Me-Mi-Mo-Mu',
    category: 'syllable',
    difficulty: 'beginner',
    description:
      'Classic Italian vowel exercise on a 5-note major scale. Trains vowel placement and pitch accuracy simultaneously.',
    instruction:
      'Sing up: Ma(do)-Me(re)-Mi(mi)-Mo(fa)-Mu(sol), then descend: Mu-Mo-Mi-Me-Ma. Keep the "M" consistent, only the vowel changes.',
    pattern: {
      intervals: [0, 2, 4, 5, 7, 5, 4, 2, 0],
      durations: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5],
      syllables: ['ma', 'me', 'mi', 'mo', 'mu', 'mo', 'mi', 'me', 'ma'],
    },
    startRange: { minMidi: 48, maxMidi: 67, stepSize: 1 },
    successCriteria: {
      maxCentsDeviation: 20,
      minSustainSec: 0.5,
      minAccuracyRatio: 0.6,
    },
    bpm: 80,
    repetitions: 10,
  },
  {
    id: 'interval_major_2nd',
    name: 'Major 2nd Steps',
    category: 'interval',
    difficulty: 'beginner',
    description:
      'Sing two notes a whole step apart. Think "Do-Re". The most common melodic interval.',
    instruction:
      'Sing "Ma" on the root, step up a whole tone to "Me". Repeat. Clean transitions, no scooping.',
    pattern: {
      intervals: [0, 2, 0, 2],
      durations: [1.5, 1.5, 1.5, 1.5],
      syllables: ['ma', 'me', 'ma', 'me'],
    },
    startRange: { minMidi: 48, maxMidi: 67, stepSize: 1 },
    successCriteria: {
      maxCentsDeviation: 20,
      minSustainSec: 1.0,
      minAccuracyRatio: 0.6,
    },
    bpm: 60,
    repetitions: 10,
  },
  {
    id: 'scale_major_5note',
    name: 'Five-Note Scale',
    category: 'scale',
    difficulty: 'beginner',
    description:
      'First 5 notes of a major scale up and down. The most fundamental vocal warm-up.',
    instruction:
      'Sing up: Do-Re-Mi-Fa-Sol, then back down: Fa-Mi-Re-Do. Steady tempo, clear distinct notes.',
    pattern: {
      intervals: [0, 2, 4, 5, 7, 5, 4, 2, 0],
      durations: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5],
      syllables: ['do', 're', 'mi', 'fa', 'sol', 'fa', 'mi', 're', 'do'],
    },
    startRange: { minMidi: 48, maxMidi: 65, stepSize: 1 },
    successCriteria: {
      maxCentsDeviation: 20,
      minSustainSec: 0.5,
      minAccuracyRatio: 0.65,
    },
    bpm: 80,
    repetitions: 10,
  },

  // --- INTERMEDIATE ---
  {
    id: 'interval_perfect_5th',
    name: 'Perfect 5th Leap',
    category: 'interval',
    difficulty: 'intermediate',
    description:
      'Sing two notes a perfect 5th apart. Think "Twinkle Twinkle" or Star Wars.',
    instruction:
      'Sing "Do" on the root, leap up a 5th to "Sol", return to "Do". Land the upper note cleanly.',
    pattern: {
      intervals: [0, 7, 0],
      durations: [2.0, 2.0, 2.0],
      syllables: ['do', 'sol', 'do'],
    },
    startRange: { minMidi: 48, maxMidi: 65, stepSize: 1 },
    successCriteria: {
      maxCentsDeviation: 20,
      minSustainSec: 1.5,
      minAccuracyRatio: 0.6,
    },
    bpm: 50,
    repetitions: 10,
  },
  {
    id: 'scale_major_full',
    name: 'Full Major Scale',
    category: 'scale',
    difficulty: 'intermediate',
    description:
      'Complete major scale up and down through one octave.',
    instruction:
      'Sing up the full major scale on "La", then descend. Listen for half-steps between Mi-Fa and Ti-Do.',
    pattern: {
      intervals: [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0],
      durations: [
        0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 1.2, 0.8, 0.8, 0.8, 0.8, 0.8,
        0.8, 1.2,
      ],
      syllables: [
        'la', 'la', 'la', 'la', 'la', 'la', 'la', 'la', 'la', 'la', 'la',
        'la', 'la', 'la', 'la',
      ],
    },
    startRange: { minMidi: 48, maxMidi: 62, stepSize: 1 },
    successCriteria: {
      maxCentsDeviation: 20,
      minSustainSec: 0.4,
      minAccuracyRatio: 0.65,
    },
    bpm: 90,
    repetitions: 10,
  },
  {
    id: 'scale_minor_natural',
    name: 'Natural Minor Scale',
    category: 'scale',
    difficulty: 'intermediate',
    description:
      'Natural minor scale up and down. Trains the ear for minor tonality.',
    instruction:
      'Sing up the minor scale on "Moh", then descend. The lowered 3rd gives it the characteristic sad color.',
    pattern: {
      intervals: [0, 2, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 2, 0],
      durations: [
        0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 1.2, 0.8, 0.8, 0.8, 0.8, 0.8,
        0.8, 1.2,
      ],
      syllables: [
        'moh', 'moh', 'moh', 'moh', 'moh', 'moh', 'moh', 'moh', 'moh',
        'moh', 'moh', 'moh', 'moh', 'moh', 'moh',
      ],
    },
    startRange: { minMidi: 48, maxMidi: 62, stepSize: 1 },
    successCriteria: {
      maxCentsDeviation: 20,
      minSustainSec: 0.4,
      minAccuracyRatio: 0.6,
    },
    bpm: 84,
    repetitions: 10,
  },
  {
    id: 'arpeggio_major_triad',
    name: 'Major Triad Arpeggio',
    category: 'arpeggio',
    difficulty: 'intermediate',
    description:
      'Broken major chord: root-3rd-5th-octave and back. Standard choral warm-up.',
    instruction:
      'Sing Do-Mi-Sol-Do (up), then Do-Sol-Mi-Do (down) on "Ma". Land each note cleanly.',
    pattern: {
      intervals: [0, 4, 7, 12, 7, 4, 0],
      durations: [1.0, 1.0, 1.0, 1.5, 1.0, 1.0, 1.5],
      syllables: ['ma', 'ma', 'ma', 'ma', 'ma', 'ma', 'ma'],
    },
    startRange: { minMidi: 48, maxMidi: 62, stepSize: 1 },
    successCriteria: {
      maxCentsDeviation: 20,
      minSustainSec: 0.6,
      minAccuracyRatio: 0.6,
    },
    bpm: 72,
    repetitions: 10,
  },
  {
    id: 'siren_octave_slide',
    name: 'Octave Siren',
    category: 'siren',
    difficulty: 'intermediate',
    description:
      'Glide smoothly from a low note up one octave and back. Warms up the voice and trains smooth pitch control.',
    instruction:
      'On "Wee", slide smoothly from the low note up one octave and back down. No jumps — continuous glide like a siren.',
    pattern: {
      intervals: [0, 12, 0],
      durations: [0.5, 3.0, 3.0],
      syllables: ['wee', 'wee', 'wee'],
    },
    startRange: { minMidi: 48, maxMidi: 60, stepSize: 2 },
    successCriteria: {
      maxCentsDeviation: 50,
      minSustainSec: 0.0,
      minAccuracyRatio: 0.5,
    },
    bpm: null,
    repetitions: 10,
    isSiren: true,
  },

  // --- ADVANCED ---
  {
    id: 'interval_octave',
    name: 'Octave Jump',
    category: 'interval',
    difficulty: 'advanced',
    description:
      'Sing two notes an octave apart. Think "Somewhere Over the Rainbow". Trains register transitions.',
    instruction:
      'Sing the lower note on "Oh", leap up one octave on "Oh". Keep throat relaxed, land precisely.',
    pattern: {
      intervals: [0, 12, 12, 0],
      durations: [2.0, 2.0, 2.0, 2.0],
      syllables: ['oh', 'oh', 'oh', 'oh'],
    },
    startRange: { minMidi: 48, maxMidi: 60, stepSize: 1 },
    successCriteria: {
      maxCentsDeviation: 25,
      minSustainSec: 1.5,
      minAccuracyRatio: 0.5,
    },
    bpm: 45,
    repetitions: 10,
  },
  {
    id: 'arpeggio_extended',
    name: 'Extended Arpeggio',
    category: 'arpeggio',
    difficulty: 'advanced',
    description:
      'Bel Canto classic: 1-3-5-8-5-3-1 with alternating syllables. Trains smooth transitions across chord tones.',
    instruction:
      'Sing up the arpeggio on alternating "Mah"/"Meh" vowels, then back down. Keep tone even across registers.',
    pattern: {
      intervals: [0, 4, 7, 12, 7, 4, 0],
      durations: [0.8, 0.8, 0.8, 1.2, 0.8, 0.8, 1.2],
      syllables: ['mah', 'meh', 'mah', 'meh', 'mah', 'meh', 'mah'],
    },
    startRange: { minMidi: 48, maxMidi: 60, stepSize: 1 },
    successCriteria: {
      maxCentsDeviation: 15,
      minSustainSec: 0.4,
      minAccuracyRatio: 0.6,
    },
    bpm: 84,
    repetitions: 10,
  },
  {
    id: 'scale_chromatic',
    name: 'Chromatic Scale',
    category: 'scale',
    difficulty: 'advanced',
    description:
      'Every half-step through one octave up and down. The ultimate intonation test.',
    instruction:
      'Sing every half-step up on "Nee", then back down. Go slowly — each note is only one half-step apart.',
    pattern: {
      intervals: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 11, 10, 9, 8, 7, 6, 5, 4,
        3, 2, 1, 0,
      ],
      durations: [
        0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.9,
        0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.9,
      ],
      syllables: [
        'nee', 'nee', 'nee', 'nee', 'nee', 'nee', 'nee', 'nee', 'nee', 'nee',
        'nee', 'nee', 'nee', 'nee', 'nee', 'nee', 'nee', 'nee', 'nee', 'nee',
        'nee', 'nee', 'nee', 'nee', 'nee',
      ],
    },
    startRange: { minMidi: 48, maxMidi: 60, stepSize: 1 },
    successCriteria: {
      maxCentsDeviation: 15,
      minSustainSec: 0.3,
      minAccuracyRatio: 0.6,
    },
    bpm: 72,
    repetitions: 10,
  },
  {
    id: 'siren_full_range',
    name: 'Full Range Siren',
    category: 'siren',
    difficulty: 'advanced',
    description:
      'Glide through your entire vocal range on "ng". Warms up everything and smooths register transitions.',
    instruction:
      'Make an "ng" sound (like "sing"). Slide from your lowest note all the way up to your highest, then back down.',
    pattern: {
      intervals: [0, 24, 0],
      durations: [0.5, 4.0, 4.0],
      syllables: ['ng', 'ng', 'ng'],
    },
    startRange: { minMidi: 43, maxMidi: 55, stepSize: 0 },
    successCriteria: {
      maxCentsDeviation: 100,
      minSustainSec: 0.0,
      minAccuracyRatio: 0.3,
    },
    bpm: null,
    repetitions: 10,
    isSiren: true,
  },
];

/** Exercises ordered by recommended progression */
export const EXERCISE_ORDER: string[] = [
  'single_note_sustain',
  'pitch_echo',
  'vowel_single_pitch_rotate',
  'vowel_ma_me_mi_mo_mu',
  'interval_major_2nd',
  'scale_major_5note',
  'interval_perfect_5th',
  'scale_major_full',
  'scale_minor_natural',
  'arpeggio_major_triad',
  'siren_octave_slide',
  'interval_octave',
  'arpeggio_extended',
  'scale_chromatic',
  'siren_full_range',
];

/** Get exercise by ID */
export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

/** Get exercises filtered by difficulty */
export function getExercisesByDifficulty(diff: Difficulty): Exercise[] {
  return EXERCISES.filter((e) => e.difficulty === diff);
}
