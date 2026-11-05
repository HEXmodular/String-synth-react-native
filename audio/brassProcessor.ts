/**
 * Trumpet waveguide: bore delay + nonlinear lip valve.
 * Parameter names stay compatible with the engine
 * (bowVelocity → breath, bowForce → lip tension).
 * attackTrigger: rising edge (0→1) starts a physical attack transient.
 *
 * Feedback keeps ~95% energy with phase invert so the bore can sustain
 * standing resonance; cubic lip nonlinearity + soft clip prevent runaway.
 */
export const brassProcessorSource = `
class BrassProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 20, maxValue: 5000 },
      { name: 'bowForce', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      // min 0 so attack/release can silence; sustained breath is 0.5–1.5
      { name: 'bowVelocity', defaultValue: 0, minValue: 0, maxValue: 1.5 },
      { name: 'vibratoDepth', defaultValue: 0.01, minValue: 0, maxValue: 1 },
      { name: 'vibratoRate', defaultValue: 1.03, minValue: 1, maxValue: 10 },
      { name: 'attackTrigger', defaultValue: 0, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    // Power of 2 for bitmask wrap; covers low notes at high sample rates.
    this.size = 16384;
    this.mask = this.size - 1;
    this.delayBuffer = new Float32Array(this.size);
    this.writeIndex = 0;
    // Bore LP (thermal / viscous losses).
    this.filterState = 0;
    this.previousBreath = 0;
    this.vibratoPhase = 0;
    this.twoPi = Math.PI * 2;
    this.invSampleRate = 1 / sampleRate;
    this.lastPeriod = 64;
    // Physical attack transient (~40 ms pressure overshoot + lip noise).
    this.attackPhase = 0;
    this.isAttacking = false;
    this.lastTriggerState = 0;
    this.attackDurationSamples = sampleRate * 0.04;
    this.cpuAccumMs = 0;
    this.cpuAccumFrames = 0;
    this.cpuBlocks = 0;
    this.now =
      typeof performance !== "undefined" && performance.now
        ? function () {
            return performance.now();
          }
        : function () {
            return Date.now();
          };
  }

  reportCpu(frames) {
    this.cpuAccumFrames += frames;
    this.cpuBlocks += 1;
    // ~120 ms at 128 frames / 48 kHz.
    if (this.cpuBlocks < 45) {
      return;
    }
    var budgetMs = (this.cpuAccumFrames / sampleRate) * 1000;
    var load = budgetMs > 0 ? this.cpuAccumMs / budgetMs : 0;
    this.port.postMessage({ type: "cpu", load: load });
    this.cpuAccumMs = 0;
    this.cpuAccumFrames = 0;
    this.cpuBlocks = 0;
  }

  clearBore(period) {
    const clearLen = Math.min(this.size, ((period | 0) + 8) | 0);
    const start = (this.writeIndex - clearLen + this.size) & this.mask;
    if (start + clearLen <= this.size) {
      this.delayBuffer.fill(0, start, start + clearLen);
    } else {
      const first = this.size - start;
      this.delayBuffer.fill(0, start, this.size);
      this.delayBuffer.fill(0, 0, clearLen - first);
    }
    this.filterState = 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channel = output && output[0];
    if (!channel) {
      return true;
    }

    const cpuStart = this.now();
    const freqParam = parameters.frequency;
    const forceParam = parameters.bowForce;
    const velParam = parameters.bowVelocity;
    const depthParam = parameters.vibratoDepth;
    const rateParam = parameters.vibratoRate;
    const triggerParam = parameters.attackTrigger;
    const freqARate = freqParam.length > 1;
    const forceARate = forceParam.length > 1;
    const velARate = velParam.length > 1;
    const depthARate = depthParam.length > 1;
    const rateARate = rateParam.length > 1;
    const triggerARate = triggerParam.length > 1;

    let frequency = freqParam[0];
    let bowForce = forceParam[0];
    let bowVelocity = velParam[0];
    let vibratoDepth = depthParam[0];
    let vibratoRate = rateParam[0];
    let attackTrigger = triggerParam[0];

    const size = this.size;
    const mask = this.mask;
    const invSampleRate = this.invSampleRate;
    const twoPi = this.twoPi;
    const attackDurationSamples = this.attackDurationSamples;
    const blockLen = channel.length;

    for (let i = 0; i < blockLen; i++) {
      if (freqARate) frequency = freqParam[i];
      if (forceARate) bowForce = forceParam[i];
      if (velARate) bowVelocity = velParam[i];
      if (depthARate) vibratoDepth = depthParam[i];
      if (rateARate) vibratoRate = rateParam[i];
      if (triggerARate) attackTrigger = triggerParam[i];

      let freq = frequency;
      if (freq < 20) freq = 20;
      else if (freq > 5000) freq = 5000;

      let lipTension = bowForce;
      if (lipTension < 0) lipTension = 0;
      else if (lipTension > 1) lipTension = 1;

      let breath = bowVelocity;
      if (breath < 0) breath = 0;
      else if (breath > 1.5) breath = 1.5;

      const depth = vibratoDepth < 0 ? 0 : vibratoDepth > 1 ? 1 : vibratoDepth;
      const rate = vibratoRate < 1 ? 1 : vibratoRate > 10 ? 10 : vibratoRate;

      // Rising edge of attackTrigger starts the transient.
      if (attackTrigger > 0.5 && this.lastTriggerState <= 0.5) {
        this.isAttacking = true;
        this.attackPhase = 0;
      }
      this.lastTriggerState = attackTrigger;

      let transientPressureMod = 0;
      let noiseMod = 0;
      if (this.isAttacking) {
        if (this.attackPhase < attackDurationSamples) {
          const progress = this.attackPhase / attackDurationSamples;
          transientPressureMod =
            Math.sin(progress * Math.PI) * Math.exp(-progress * 2) * 0.3;
          noiseMod = (Math.random() * 2 - 1) * (1 - progress) * 0.05;
          this.attackPhase++;
        } else {
          this.isAttacking = false;
        }
      }

      if (this.previousBreath < 0.0005 && breath >= 0.0005) {
        this.clearBore(this.lastPeriod);
      }
      this.previousBreath = breath;

      this.vibratoPhase += rate * twoPi * invSampleRate;
      if (this.vibratoPhase > twoPi) this.vibratoPhase -= twoPi;
      const totalPressure =
        breath + Math.sin(this.vibratoPhase) * depth * 0.4 + transientPressureMod;

      // Bore length in samples (period of the played pitch).
      let delaySamples = sampleRate / freq;
      if (delaySamples < 2) delaySamples = 2;
      else if (delaySamples > size - 3) delaySamples = size - 3;
      this.lastPeriod = delaySamples;

      // Reflected wave: phase invert + ~5% radiation / loss at the bell.
      let readIndex = this.writeIndex - delaySamples;
      if (readIndex < 0) readIndex += size;
      const indexInt = readIndex | 0;
      const indexFrac = readIndex - indexInt;
      const nextIndex = (indexInt + 1) & mask;
      const reflectedWave =
        -(
          this.delayBuffer[indexInt & mask] * (1 - indexFrac) +
          this.delayBuffer[nextIndex] * indexFrac
        ) * 0.95;

      // McIntyre–Schumacher–Woodhouse-style cubic lip valve.
      const deltaPressure = totalPressure - reflectedWave;
      let lipFunction = deltaPressure - deltaPressure * deltaPressure * deltaPressure * 0.3;
      lipFunction *= 0.4 + lipTension * 0.6;

      const breathingSignal = lipFunction + noiseMod;
      // Nearly lossless round-trip: jet + already-reflected bore wave.
      let inputToPipe = breathingSignal + reflectedWave;

      this.filterState = 0.8 * this.filterState + 0.2 * inputToPipe;
      if (this.filterState > 1.5) this.filterState = 1.5;
      else if (this.filterState < -1.5) this.filterState = -1.5;

      this.delayBuffer[this.writeIndex] = this.filterState;

      // Bell radiation (scaled for headroom).
      channel[i] = (breathingSignal - reflectedWave) * 0.25;

      this.writeIndex = (this.writeIndex + 1) & mask;
    }

    this.cpuAccumMs += this.now() - cpuStart;
    this.reportCpu(blockLen);
    return true;
  }
}

registerProcessor('brass-processor', BrassProcessor);
`;
