export const bowedStringProcessorSource = `
class BowedStringProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 20, maxValue: 5000 },
      { name: 'bowForce', defaultValue: 1, minValue: 0.1, maxValue: 5 },
      { name: 'bowVelocity', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'vibratoDepth', defaultValue: 0.01, minValue: 0, maxValue: 1 },
      { name: 'vibratoRate', defaultValue: 1.03, minValue: 1, maxValue: 10 },
    ];
  }

  constructor() {
    super();
    // Power of 2 for bitmask wrap; 8k covers 20 Hz even at 96 kHz.
    this.size = 8192;
    this.mask = this.size - 1;
    this.neck = new Float32Array(this.size);
    this.bridge = new Float32Array(this.size);
    this.ptr = 0;
    this.filterState = 0;
    this.previousVelocity = 0;
    this.vibratoPhase = 0;
    this.twoPi = Math.PI * 2;
    this.invSampleRate = 1 / sampleRate;
    this.pole = Math.min(0.95, Math.max(0, 0.75 - (0.2 * 22050) / sampleRate));
    this.filterGain = (1 - this.pole) * 0.995;
    this.beta = 0.127236;
    this.lastPeriod = 64;
  }

  read(buffer, delay) {
    const index = delay | 0;
    const fraction = delay - index;
    const newer = (this.ptr - index) & this.mask;
    const older = (this.ptr - index - 1) & this.mask;
    return buffer[newer] * (1 - fraction) + buffer[older] * fraction;
  }

  clearDelays(period) {
    const clearLen = Math.min(this.size, ((period | 0) + 8) | 0);
    const start = (this.ptr - clearLen + this.size) & this.mask;
    if (start + clearLen <= this.size) {
      this.neck.fill(0, start, start + clearLen);
      this.bridge.fill(0, start, start + clearLen);
    } else {
      const first = this.size - start;
      this.neck.fill(0, start, this.size);
      this.bridge.fill(0, start, this.size);
      this.neck.fill(0, 0, clearLen - first);
      this.bridge.fill(0, 0, clearLen - first);
    }
    this.filterState = 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const outputChannel = output && output[0];
    if (!outputChannel) {
      return true;
    }

    const freqParam = parameters.frequency;
    const forceParam = parameters.bowForce;
    const velParam = parameters.bowVelocity;
    const depthParam = parameters.vibratoDepth;
    const rateParam = parameters.vibratoRate;
    const freqARate = freqParam.length > 1;
    const forceARate = forceParam.length > 1;
    const velARate = velParam.length > 1;
    const depthARate = depthParam.length > 1;
    const rateARate = rateParam.length > 1;

    let frequency = freqParam[0];
    let bowForce = forceParam[0];
    let bowVelocity = velParam[0];
    let vibratoDepth = depthParam[0];
    let vibratoRate = rateParam[0];

    const pole = this.pole;
    const filterGain = this.filterGain;
    const beta = this.beta;
    const size = this.size;
    const mask = this.mask;
    const invSampleRate = this.invSampleRate;
    const twoPi = this.twoPi;
    const blockLen = outputChannel.length;

    // pitchScale changes slowly with frequency — refresh once per quantum from first value.
    let pitchScale = Math.min(1, Math.max(0.2, Math.sqrt(Math.max(frequency, 20) / 520)));

    for (let i = 0; i < blockLen; i++) {
      if (freqARate) frequency = freqParam[i];
      if (forceARate) bowForce = forceParam[i];
      if (velARate) bowVelocity = velParam[i];
      if (depthARate) vibratoDepth = depthParam[i];
      if (rateARate) vibratoRate = rateParam[i];

      const depth = vibratoDepth < 0 ? 0 : vibratoDepth > 1 ? 1 : vibratoDepth;
      const rate = vibratoRate < 1 ? 1 : vibratoRate > 10 ? 10 : vibratoRate;

      if (freqARate && (i & 15) === 0) {
        pitchScale = Math.min(1, Math.max(0.2, Math.sqrt(Math.max(frequency, 20) / 520)));
      }

      this.vibratoPhase += rate * twoPi * invSampleRate;
      if (this.vibratoPhase > twoPi) this.vibratoPhase -= twoPi;
      const vibrato = 1 + Math.sin(this.vibratoPhase) * depth * pitchScale * 0.03;

      let freq = frequency * vibrato;
      if (freq < 20) freq = 20;
      else if (freq > 5000) freq = 5000;

      let slope = bowForce;
      if (slope < 0.1) slope = 0.1;
      else if (slope > 5) slope = 5;

      let velocity = bowVelocity;
      if (velocity < 0) velocity = 0;
      else if (velocity > 1) velocity = 1;

      if (this.previousVelocity < 0.0005 && velocity >= 0.0005) {
        this.clearDelays(this.lastPeriod);
      }
      this.previousVelocity = velocity;

      let period = sampleRate / freq - 1.5;
      if (period < 3) period = 3;
      else if (period > size - 3) period = size - 3;
      this.lastPeriod = period;

      const bridgeDelay = period * beta < 1.05 ? 1.05 : period * beta;
      const neckDelay = period - bridgeDelay < 1.05 ? 1.05 : period - bridgeDelay;
      const bridgeIn = this.read(this.bridge, bridgeDelay);
      const filtered = filterGain * bridgeIn + pole * this.filterState;
      this.filterState = filtered;

      const bridgeReflection = -filtered;
      const nutReflection = -this.read(this.neck, neckDelay);
      const delta = velocity - (bridgeReflection + nutReflection);
      const x = Math.abs((delta + 0.001) * slope) + 0.75;
      const x2 = x * x;
      let reflection = 1 / (x2 * x2);
      if (reflection < 0.01) reflection = 0.01;
      else if (reflection > 0.98) reflection = 0.98;

      const injected = delta * reflection;
      this.neck[this.ptr] = bridgeReflection + injected;
      this.bridge[this.ptr] = nutReflection + injected;
      outputChannel[i] = bridgeIn;

      this.ptr = (this.ptr + 1) & mask;
    }

    return true;
  }
}

registerProcessor('bowed-string-processor', BowedStringProcessor);
`;
