/**
 * Tone Generator — plays reference tones using OscillatorNode.
 *
 * Generates sine wave tones at specified frequencies so the user
 * can hear the target pitch before/while singing.
 */

import { midiToFrequency } from '../utils/note-utils';

export class ToneGenerator {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private _volume = 0.15; // default: quiet background tone
  private _muted = false;

  get volume(): number {
    return this._volume;
  }

  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.gainNode && !this._muted) {
      this.gainNode.gain.setTargetAtTime(
        this._volume,
        this.audioContext!.currentTime,
        0.02,
      );
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  set muted(m: boolean) {
    this._muted = m;
    if (this.gainNode) {
      this.gainNode.gain.setTargetAtTime(
        m ? 0 : this._volume,
        this.audioContext!.currentTime,
        0.02,
      );
    }
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  /**
   * Play a tone at the given MIDI note.
   * Smoothly transitions if already playing a different note.
   */
  playMidi(midi: number): void {
    const freq = midiToFrequency(midi);
    this.playFrequency(freq);
  }

  /**
   * Play a tone at the given frequency (Hz).
   */
  playFrequency(freq: number): void {
    const ctx = this.ensureContext();

    if (!this.oscillator) {
      // Create new oscillator + gain chain
      this.oscillator = ctx.createOscillator();
      this.oscillator.type = 'sine';
      this.oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

      this.gainNode = ctx.createGain();
      this.gainNode.gain.setValueAtTime(0, ctx.currentTime);
      // Fade in
      this.gainNode.gain.setTargetAtTime(
        this._muted ? 0 : this._volume,
        ctx.currentTime,
        0.05,
      );

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(ctx.destination);
      this.oscillator.start();
    } else {
      // Smoothly glide to new frequency
      this.oscillator.frequency.setTargetAtTime(freq, ctx.currentTime, 0.03);
    }
  }

  /**
   * Stop the current tone with a smooth fade-out.
   */
  stop(): void {
    if (!this.gainNode || !this.oscillator || !this.audioContext) return;

    const ctx = this.audioContext;
    const gain = this.gainNode;
    const osc = this.oscillator;

    // Fade out over 50ms
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);

    // Stop oscillator after fade-out
    setTimeout(() => {
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Already stopped
      }
    }, 100);

    this.oscillator = null;
    this.gainNode = null;
  }

  /**
   * Full cleanup — close audio context.
   */
  dispose(): void {
    this.stop();
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
  }
}
