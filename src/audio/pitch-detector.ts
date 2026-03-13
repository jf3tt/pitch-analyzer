/**
 * YIN pitch detection algorithm.
 *
 * Based on: "YIN, a fundamental frequency estimator for speech and music"
 * by Alain de Cheveigné and Hideki Kawahara (2002).
 *
 * This algorithm works well for voice: ~1-2 cents accuracy,
 * noise-resistant, fast enough for real-time.
 */

/**
 * Detects the fundamental frequency (pitch) of an audio signal using YIN.
 *
 * @param buffer Float32Array with audio data (typically 2048 samples)
 * @param sampleRate Sample rate (typically 44100 or 48000)
 * @param threshold YIN threshold (0.1-0.2 recommended, lower = stricter)
 * @returns Frequency in Hz or -1 if no pitch detected
 */
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  threshold = 0.15,
): number {
  const halfLen = Math.floor(buffer.length / 2);

  // Step 1: Difference function
  // d(tau) = sum((x[j] - x[j + tau])^2, j=0..W-1)
  const diff = new Float32Array(halfLen);
  for (let tau = 0; tau < halfLen; tau++) {
    let sum = 0;
    for (let j = 0; j < halfLen; j++) {
      const delta = buffer[j] - buffer[j + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Step 2: Cumulative mean normalized difference function (CMNDF)
  // d'(tau) = d(tau) / ((1/tau) * sum(d(j), j=1..tau))
  // d'(0) = 1
  diff[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfLen; tau++) {
    runningSum += diff[tau];
    diff[tau] *= tau / runningSum;
  }

  // Step 3: Absolute threshold
  // Find first tau where CMNDF < threshold, then take the minimum in that valley
  let tauEstimate = -1;

  // Skip very small tau values (too-high frequencies)
  // Minimum tau corresponds to ~1500 Hz (extreme high voice)
  const minTau = Math.max(2, Math.floor(sampleRate / 1500));
  // Maximum tau corresponds to ~50 Hz (below bass range, not needed)
  const maxTau = Math.min(halfLen, Math.floor(sampleRate / 50));

  for (let tau = minTau; tau < maxTau; tau++) {
    if (diff[tau] < threshold) {
      // Found a point below threshold — find local minimum
      while (tau + 1 < maxTau && diff[tau + 1] < diff[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  // If no value below threshold found — take global minimum (less reliable)
  if (tauEstimate === -1) {
    let minVal = Infinity;
    for (let tau = minTau; tau < maxTau; tau++) {
      if (diff[tau] < minVal) {
        minVal = diff[tau];
        tauEstimate = tau;
      }
    }
    // If global minimum is too large — no pitch detected
    if (minVal > 0.5) return -1;
  }

  if (tauEstimate < 1) return -1;

  // Step 4: Parabolic interpolation for sub-sample accuracy
  const tauRefined = parabolicInterpolation(diff, tauEstimate);

  if (tauRefined <= 0) return -1;

  return sampleRate / tauRefined;
}

/**
 * Parabolic interpolation of a peak/valley.
 * Refines the position of a minimum between discrete points.
 */
function parabolicInterpolation(array: Float32Array, x: number): number {
  if (x < 1 || x >= array.length - 1) return x;

  const s0 = array[x - 1];
  const s1 = array[x];
  const s2 = array[x + 1];

  // Parabola vertex through 3 points
  const denominator = 2 * (2 * s1 - s2 - s0);
  if (Math.abs(denominator) < 1e-12) return x;

  return x + (s0 - s2) / denominator;
}

/**
 * Computes RMS (root mean square) of the signal.
 * Used for determining volume level / silence.
 */
export function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}
