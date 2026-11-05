/**
 * STK-style brass waveguide (Cook TBone / HosePlayer):
 * bore delay line + lip bi-quad resonator + breath pressure.
 *
 * AudioWorklet parameter names stay compatible with the existing engine
 * (bowVelocity → breath, bowForce → lip tension).
 */
export const brassProcessorSource = `
class BrassProcessor extends AudioWorkletProcessor {
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
    // Power of 2 for bitmask wrap; covers 20 Hz even at 96 kHz (2*SR/f + 3).
    this.size = 16384;
    this.mask = this.size - 1;
    this.bore = new Float32Array(this.size);
    this.ptr = 0;
    this.lastBore = 0;
    this.lipGain = 0.03;
    this.lipRadius = 0.997;
    this.lipB0 = 1;
    this.lipB1 = 0;
    this.lipB2 = 0;
    this.lipA1 = 0;
    this.lipA2 = 0;
    this.lipIn1 = 0;
    this.lipIn2 = 0;
    this.lipOut1 = 0;
    this.lipOut2 = 0;
    this.dcX1 = 0;
    this.dcY1 = 0;
    this.dcPole = 0.99;
    this.previousBreath = 0;
    this.vibratoPhase = 0;
    this.twoPi = Math.PI * 2;
    this.invSampleRate = 1 / sampleRate;
    this.lastPeriod = 64;
    this.lastLipFreq = -1;
  }

  setLipResonance(frequency) {
    const nyquist = sampleRate * 0.5;
    let freq = frequency;
    if (freq < 20) freq = 20;
    else if (freq > nyquist - 20) freq = nyquist - 20;
    if (Math.abs(freq - this.lastLipFreq) < 0.01) {
      return;
    }
    this.lastLipFreq = freq;
    const radius = this.lipRadius;
    this.lipA2 = radius * radius;
    this.lipA1 = -2 * radius * Math.cos(this.twoPi * freq * this.invSampleRate);
    this.lipB0 = 1;
    this.lipB1 = 0;
    this.lipB2 = 0;
  }

  read(delay) {
    const index = delay | 0;
    const fraction = delay - index;
    const newer = (this.ptr - index) & this.mask;
    const older = (this.ptr - index - 1) & this.mask;
    return this.bore[newer] * (1 - fraction) + this.bore[older] * fraction;
  }

  clearBore(period) {
    const clearLen = Math.min(this.size, ((period | 0) + 8) | 0);
    const start = (this.ptr - clearLen + this.size) & this.mask;
    if (start + clearLen <= this.size) {
      this.bore.fill(0, start, start + clearLen);
    } else {
      const first = this.size - start;
      this.bore.fill(0, start, this.size);
      this.bore.fill(0, 0, clearLen - first);
    }
    this.lastBore = 0;
    this.lipIn1 = 0;
    this.lipIn2 = 0;
    this.lipOut1 = 0;
    this.lipOut2 = 0;
    this.dcX1 = 0;
    this.dcY1 = 0;
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

    const size = this.size;
    const mask = this.mask;
    const invSampleRate = this.invSampleRate;
    const twoPi = this.twoPi;
    const lipGain = this.lipGain;
    const dcPole = this.dcPole;
    const blockLen = outputChannel.length;
    const forceSpan = 4.9;

    for (let i = 0; i < blockLen; i++) {
      if (freqARate) frequency = freqParam[i];
      if (forceARate) bowForce = forceParam[i];
      if (velARate) bowVelocity = velParam[i];
      if (depthARate) vibratoDepth = depthParam[i];
      if (rateARate) vibratoRate = rateParam[i];

      let freq = frequency;
      if (freq < 20) freq = 20;
      else if (freq > 5000) freq = 5000;

      let tension = bowForce;
      if (tension < 0.1) tension = 0.1;
      else if (tension > 5) tension = 5;

      let breath = bowVelocity;
      if (breath < 0) breath = 0;
      else if (breath > 1) breath = 1;

      const depth = vibratoDepth < 0 ? 0 : vibratoDepth > 1 ? 1 : vibratoDepth;
      const rate = vibratoRate < 1 ? 1 : vibratoRate > 10 ? 10 : vibratoRate;

      if (this.previousBreath < 0.0005 && breath >= 0.0005) {
        this.clearBore(this.lastPeriod);
      }
      this.previousBreath = breath;

      // STK: delay ≈ 2 periods (+ filter fudge) so lips can lock a harmonic.
      let period = sampleRate / freq * 2 + 3;
      if (period < 4) period = 4;
      else if (period > size - 3) period = size - 3;
      this.lastPeriod = period;

      // Lip tension CC mapping from STK Brass: lipFreq = note * 4^(2n-1).
      const tensionNorm = (tension - 0.1) / forceSpan;
      const lipFreq = freq * Math.pow(4, 2 * tensionNorm - 1);
      this.setLipResonance(lipFreq);

      this.vibratoPhase += rate * twoPi * invSampleRate;
      if (this.vibratoPhase > twoPi) this.vibratoPhase -= twoPi;
      // Breath-pressure vibrato (STK); depth 1 → gain ≈ 0.4.
      const breathPressure = breath + Math.sin(this.vibratoPhase) * depth * 0.4;

      const mouthPressure = 0.3 * breathPressure;
      const borePressure = 0.85 * this.lastBore;
      let delta = mouthPressure - borePressure;

      // Lip bi-quad: force → displacement.
      const lipIn = lipGain * delta;
      delta =
        this.lipB0 * lipIn +
        this.lipB1 * this.lipIn1 +
        this.lipB2 * this.lipIn2 -
        this.lipA1 * this.lipOut1 -
        this.lipA2 * this.lipOut2;
      this.lipIn2 = this.lipIn1;
      this.lipIn1 = lipIn;
      this.lipOut2 = this.lipOut1;
      this.lipOut1 = delta;

      // Position → area, saturated.
      delta = delta * delta;
      if (delta > 1) delta = 1;

      // Nonlinear scattering at the mouthpiece.
      let sample = delta * mouthPressure + (1 - delta) * borePressure;

      // DC blocker (PoleZero::setBlockZero).
      const dcY = sample - this.dcX1 + dcPole * this.dcY1;
      this.dcX1 = sample;
      this.dcY1 = dcY;
      sample = dcY;

      this.bore[this.ptr] = sample;
      this.lastBore = this.read(period);
      outputChannel[i] = this.lastBore;

      this.ptr = (this.ptr + 1) & mask;
    }

    return true;
  }
}

registerProcessor('brass-processor', BrassProcessor);
`;
