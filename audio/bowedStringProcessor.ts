export const bowedStringProcessorSource = `
class BowedStringProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 20, maxValue: 5000 },
      { name: 'bowForce', defaultValue: 1, minValue: 0.1, maxValue: 5 },
      { name: 'bowVelocity', defaultValue: 0, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    this.size = 16384;
    this.neck = new Float32Array(this.size);
    this.bridge = new Float32Array(this.size);
    this.ptr = 0;
    this.filterState = 0;
    this.previousVelocity = 0;
  }

  read(buffer, delay) {
    const size = this.size;
    const index = Math.floor(delay);
    const fraction = delay - index;
    const newer = (this.ptr - index + size) % size;
    const older = (this.ptr - index - 1 + size) % size;
    return buffer[newer] * (1 - fraction) + buffer[older] * fraction;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const outputChannel = output && output[0];
    if (!outputChannel) {
      return true;
    }

    const pole = Math.min(0.95, Math.max(0, 0.75 - (0.2 * 22050) / sampleRate));
    const filterGain = (1 - pole) * 0.995;
    const beta = 0.127236;
    const size = this.size;

    for (let i = 0; i < outputChannel.length; i++) {
      const frequency = parameters.frequency.length > 1 ? parameters.frequency[i] : parameters.frequency[0];
      const bowForce = parameters.bowForce.length > 1 ? parameters.bowForce[i] : parameters.bowForce[0];
      const bowVelocity = parameters.bowVelocity.length > 1 ? parameters.bowVelocity[i] : parameters.bowVelocity[0];

      const freq = Math.min(5000, Math.max(20, frequency));
      const slope = Math.min(5, Math.max(0.1, bowForce));
      const velocity = Math.min(1, Math.max(0, bowVelocity));

      if (this.previousVelocity < 0.0005 && velocity >= 0.0005) {
        this.neck.fill(0);
        this.bridge.fill(0);
        this.filterState = 0;
      }
      this.previousVelocity = velocity;

      let period = sampleRate / freq - 1.5;
      if (period < 3) period = 3;
      if (period > size - 3) period = size - 3;

      const bridgeDelay = Math.max(1.05, period * beta);
      const neckDelay = Math.max(1.05, period - bridgeDelay);
      const bridgeIn = this.read(this.bridge, bridgeDelay);
      const filtered = filterGain * bridgeIn + pole * this.filterState;
      this.filterState = filtered;

      const bridgeReflection = -filtered;
      const nutReflection = -this.read(this.neck, neckDelay);
      const delta = velocity - (bridgeReflection + nutReflection);
      let reflection = Math.pow(Math.abs((delta + 0.001) * slope) + 0.75, -4);
      if (reflection < 0.01) reflection = 0.01;
      if (reflection > 0.98) reflection = 0.98;

      const injected = delta * reflection;
      this.neck[this.ptr] = bridgeReflection + injected;
      this.bridge[this.ptr] = nutReflection + injected;
      outputChannel[i] = bridgeIn;

      this.ptr += 1;
      if (this.ptr >= size) this.ptr = 0;
    }

    return true;
  }
}

registerProcessor('bowed-string-processor', BowedStringProcessor);
`;
