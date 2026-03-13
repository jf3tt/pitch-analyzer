/**
 * AudioWorklet processor for pitch detection.
 *
 * NOTE: This file exists as a reference implementation.
 * In practice, the worklet code is inlined in audio-engine.ts as a Blob URL,
 * because AudioWorklet.addModule() does not support module imports.
 */

// Types for AudioWorklet API (not included in standard lib.dom.d.ts)
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: typeof AudioWorkletProcessor,
): void;

const BUFFER_SIZE = 2048;

class PitchProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array;
  private writeIndex: number;

  constructor() {
    super();
    this.buffer = new Float32Array(BUFFER_SIZE);
    this.writeIndex = 0;
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData) return true;

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.writeIndex] = channelData[i];
      this.writeIndex++;

      if (this.writeIndex >= BUFFER_SIZE) {
        this.port.postMessage({
          type: 'buffer',
          buffer: this.buffer.slice(),
        });
        this.writeIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
