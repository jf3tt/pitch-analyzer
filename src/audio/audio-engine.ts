/**
 * Audio Engine — manages microphone capture and audio processing.
 *
 * Two modes of operation:
 * 1. AudioWorklet (preferred) — low latency, separate thread
 * 2. ScriptProcessorNode (fallback) — if AudioWorklet is unavailable
 *
 * Both: collect buffer -> detectPitch -> callback.
 */

import { detectPitch, computeRMS } from './pitch-detector';

export interface PitchData {
  /** Frequency in Hz, or -1 if not detected */
  frequency: number;
  /** RMS signal level (0..1) */
  rms: number;
  /** Timestamp in ms */
  timestamp: number;
}

export type PitchCallback = (data: PitchData) => void;

const BUFFER_SIZE = 2048;
const RMS_SILENCE_THRESHOLD = 0.01;

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private analyserFallback: ScriptProcessorNode | null = null;
  private callback: PitchCallback | null = null;
  private _isRunning = false;

  get isRunning(): boolean {
    return this._isRunning;
  }

  get sampleRate(): number {
    return this.audioContext?.sampleRate ?? 44100;
  }

  /**
   * Starts microphone capture and pitch detection.
   */
  async start(callback: PitchCallback): Promise<void> {
    if (this._isRunning) return;

    this.callback = callback;

    // Request microphone access
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.audioContext = new AudioContext();
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

    // Try AudioWorklet, fall back to ScriptProcessor if unavailable
    try {
      await this.setupWorklet();
    } catch {
      console.warn('AudioWorklet not available, falling back to ScriptProcessor');
      this.setupScriptProcessor();
    }

    this._isRunning = true;
  }

  /**
   * Stops capture and cleans up resources.
   */
  stop(): void {
    this._isRunning = false;
    this.callback = null;

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.analyserFallback) {
      this.analyserFallback.disconnect();
      this.analyserFallback = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Sets up AudioWorklet for audio processing.
   */
  private async setupWorklet(): Promise<void> {
    if (!this.audioContext || !this.sourceNode) {
      throw new Error('AudioContext not initialized');
    }

    // Create worklet from blob URL (to avoid file path dependencies)
    const workletCode = `
      const BUFFER_SIZE = ${BUFFER_SIZE};
      class PitchProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.buffer = new Float32Array(BUFFER_SIZE);
          this.writeIndex = 0;
        }
        process(inputs) {
          const input = inputs[0];
          if (!input || input.length === 0) return true;
          const channelData = input[0];
          if (!channelData) return true;
          for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.writeIndex] = channelData[i];
            this.writeIndex++;
            if (this.writeIndex >= BUFFER_SIZE) {
              this.port.postMessage({ type: 'buffer', buffer: this.buffer.slice() });
              this.writeIndex = 0;
            }
          }
          return true;
        }
      }
      registerProcessor('pitch-processor', PitchProcessor);
    `;

    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    await this.audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      'pitch-processor',
    );

    this.workletNode.port.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'buffer') {
        this.processBuffer(new Float32Array(event.data.buffer));
      }
    };

    this.sourceNode.connect(this.workletNode);
    // Don't connect to destination — no need to play back the microphone
  }

  /**
   * Fallback: ScriptProcessorNode (deprecated but works everywhere).
   */
  private setupScriptProcessor(): void {
    if (!this.audioContext || !this.sourceNode) return;

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.analyserFallback = this.audioContext.createScriptProcessor(
      BUFFER_SIZE,
      1,
      1,
    );

    this.analyserFallback.onaudioprocess = (event: AudioProcessingEvent) => {
      const buffer = event.inputBuffer.getChannelData(0);
      this.processBuffer(buffer);
    };

    this.sourceNode.connect(this.analyserFallback);
    this.analyserFallback.connect(this.audioContext.destination);
  }

  /**
   * Processes a buffer: detects pitch and invokes the callback.
   */
  private processBuffer(buffer: Float32Array): void {
    if (!this.callback || !this._isRunning) return;

    const rms = computeRMS(buffer);

    // If too quiet, don't attempt pitch detection
    if (rms < RMS_SILENCE_THRESHOLD) {
      this.callback({
        frequency: -1,
        rms,
        timestamp: performance.now(),
      });
      return;
    }

    const frequency = detectPitch(buffer, this.sampleRate);

    this.callback({
      frequency,
      rms,
      timestamp: performance.now(),
    });
  }
}
