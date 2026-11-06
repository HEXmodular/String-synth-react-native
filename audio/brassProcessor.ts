/**
 * Trumpet waveguide: bore delay + nonlinear lip valve.
 *
 * Attack, decay, sustain, and release shape breath only. Loudness follows
 * that pressure through the bore; envGain is just the note gate.
 * Attack: breath 0 → peak. Decay: peak → sustain × peak. Sustain holds that
 * breath while the note is down. Release: breath falls to 0.
 */
export const brassProcessorSource = `
class BrassProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 20, maxValue: 5000, automationRate: 'a-rate' },
      { name: 'lipTension', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'breath', defaultValue: 0, minValue: 0, maxValue: 1.5, automationRate: 'a-rate' },
      { name: 'vibratoDepth', defaultValue: 0.01, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'vibratoRate', defaultValue: 1.03, minValue: 1, maxValue: 10, automationRate: 'a-rate' },
      { name: 'attackTrigger', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'attackTime', defaultValue: 0.08, minValue: 0.01, maxValue: 1, automationRate: 'k-rate' },
      { name: 'decayTime', defaultValue: 0.15, minValue: 0.01, maxValue: 1, automationRate: 'k-rate' },
      { name: 'sustainLevel', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'releaseTrigger', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'releaseTime', defaultValue: 0.1, minValue: 0.01, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.size = 16384;
    this.mask = this.size - 1;
    this.delayBuffer = new Float32Array(this.size);
    this.writeIndex = 0;
    this.filterState = 0;
    this.toneState = 0;
    this.previousBreath = 0;
    this.vibratoPhase = 0;
    this.twoPi = Math.PI * 2;
    this.invSampleRate = 1 / sampleRate;
    this.lastPeriod = 64;
    this.attackPhase = 0;
    this.isAttacking = false;
    this.pressureDurationSamples = sampleRate * 0.04;
    this.breathFloor = 0.5;
    this.isBreathAttacking = false;
    this.breathAttackPhase = 0;
    this.breathAttackDurationSamples = sampleRate * 0.08;
    this.breathAttackTarget = 1;
    this.prevAttackTrigger = 0;
    this.isBreathReleasing = false;
    this.breathReleasePhase = 0;
    this.breathReleaseDurationSamples = sampleRate * 0.1;
    this.breathReleaseStart = 0;
    this.prevReleaseTrigger = 0;
    this.releaseGain = 0;
    this.isBreathDecaying = false;
    this.isBreathHolding = false;
    this.breathDecayPhase = 0;
    this.breathDecayStart = 0;
    this.breathDecayDurationSamples = sampleRate * 0.15;
    this.decayTimeSeconds = 0.15;
    this.sustainLevel = 1;
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

    var self = this;
    this.port.onmessage = function (event) {
      var data = event && event.data;
      if (!data) {
        return;
      }
      if (data.type === "attack") {
        var attackSecs = Number(data.attackTime);
        if (!(attackSecs >= 0.01)) attackSecs = 0.08;
        if (attackSecs > 1) attackSecs = 1;
        var target = Number(data.breathTarget);
        if (!(target >= 0)) target = self.breathFloor;
        if (target > 1.5) target = 1.5;
        if (target < self.breathFloor) target = self.breathFloor;
        var decaySecs = Number(data.decayTime);
        if (!(decaySecs >= 0.01)) decaySecs = 0.15;
        if (decaySecs > 1) decaySecs = 1;
        var sustain = Number(data.sustain);
        if (!(sustain >= 0)) sustain = 1;
        if (sustain > 1) sustain = 1;
        self.decayTimeSeconds = decaySecs;
        self.sustainLevel = sustain;
        self.startBreathAttack(attackSecs, target);
        return;
      }
      if (data.type === "release") {
        var releaseSecs = Number(data.releaseTime);
        if (!(releaseSecs >= 0.01)) releaseSecs = 0.1;
        if (releaseSecs > 1) releaseSecs = 1;
        var fromHint = Number(data.breathStart);
        self.startBreathRelease(releaseSecs, fromHint);
      }
    };
  }

  startBreathAttack(secs, target) {
    this.isBreathReleasing = false;
    this.isBreathDecaying = false;
    this.isBreathHolding = false;
    this.releaseGain = 1;
    this.isBreathAttacking = true;
    this.breathAttackPhase = 0;
    this.breathAttackDurationSamples = Math.max(1, secs * sampleRate);
    this.breathAttackTarget = target;
    this.isAttacking = true;
    this.attackPhase = 0;
    this.prevAttackTrigger = 0;
  }

  beginBreathDecay(fromBreath) {
    this.isBreathHolding = false;
    this.isBreathDecaying = true;
    this.breathDecayPhase = 0;
    var from = fromBreath;
    if (!(from >= 0)) from = 0;
    if (from > 1.5) from = 1.5;
    this.breathDecayStart = from;
    var secs = this.decayTimeSeconds;
    if (!(secs >= 0.01)) secs = 0.15;
    if (secs > 1) secs = 1;
    this.breathDecayDurationSamples = Math.max(1, secs * sampleRate);
  }

  sustainBreath(peak) {
    var level = this.sustainLevel;
    if (!(level >= 0)) level = 1;
    else if (level > 1) level = 1;
    var top = peak;
    if (!(top >= 0)) top = 0;
    else if (top > 1.5) top = 1.5;
    return top * level;
  }

  startBreathRelease(secs, fromHint) {
    this.isBreathAttacking = false;
    this.isBreathDecaying = false;
    this.isBreathHolding = false;
    this.isAttacking = false;
    var from = this.previousBreath;
    if (!(from >= 0)) from = fromHint > 0 ? fromHint : 0;
    if (from < 0) from = 0;
    if (from > 1.5) from = 1.5;
    this.isBreathReleasing = true;
    this.breathReleasePhase = 0;
    this.breathReleaseDurationSamples = Math.max(1, secs * sampleRate);
    this.breathReleaseStart = from;
    this.releaseGain = 1;
    this.prevReleaseTrigger = 0;
  }

  reportCpu(frames) {
    this.cpuAccumFrames += frames;
    this.cpuBlocks += 1;
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
    this.toneState = 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channel = output && output[0];
    if (!channel) {
      return true;
    }

    const cpuStart = this.now();
    const freqParam = parameters.frequency;
    const lipParam = parameters.lipTension;
    const breathParamIn = parameters.breath;
    const depthParam = parameters.vibratoDepth;
    const rateParam = parameters.vibratoRate;
    const attackTrig = parameters.attackTrigger[0];
    const releaseTrig = parameters.releaseTrigger[0];
    let attackTimeVal = parameters.attackTime[0];
    if (!(attackTimeVal >= 0.01)) attackTimeVal = 0.08;
    else if (attackTimeVal > 1) attackTimeVal = 1;
    let releaseTimeVal = parameters.releaseTime[0];
    if (!(releaseTimeVal >= 0.01)) releaseTimeVal = 0.1;
    else if (releaseTimeVal > 1) releaseTimeVal = 1;
    let decayTimeVal = parameters.decayTime[0];
    if (!(decayTimeVal >= 0.01)) decayTimeVal = 0.15;
    else if (decayTimeVal > 1) decayTimeVal = 1;
    this.decayTimeSeconds = decayTimeVal;
    let sustainVal = parameters.sustainLevel[0];
    if (!(sustainVal >= 0)) sustainVal = 1;
    else if (sustainVal > 1) sustainVal = 1;
    this.sustainLevel = sustainVal;

    const freqARate = freqParam.length > 1;
    const lipARate = lipParam.length > 1;
    const breathARate = breathParamIn.length > 1;
    const depthARate = depthParam.length > 1;
    const rateARate = rateParam.length > 1;

    let frequency = freqParam[0];
    let lipTensionIn = lipParam[0];
    let breathIn = breathParamIn[0];
    let vibratoDepth = depthParam[0];
    let vibratoRate = rateParam[0];

    if (
      attackTrig >= 0.5 &&
      this.prevAttackTrigger < 0.5 &&
      !this.isBreathAttacking &&
      !this.isBreathReleasing
    ) {
      let edgeTarget = breathIn;
      if (edgeTarget < this.breathFloor) edgeTarget = this.breathFloor;
      if (edgeTarget > 1.5) edgeTarget = 1.5;
      this.startBreathAttack(attackTimeVal, edgeTarget);
    }
    this.prevAttackTrigger = attackTrig;

    if (
      releaseTrig >= 0.5 &&
      this.prevReleaseTrigger < 0.5 &&
      !this.isBreathReleasing
    ) {
      var releaseFrom = this.previousBreath;
      if (breathIn > releaseFrom) releaseFrom = breathIn;
      this.startBreathRelease(releaseTimeVal, releaseFrom);
    }
    this.prevReleaseTrigger = releaseTrig;

    const size = this.size;
    const mask = this.mask;
    const invSampleRate = this.invSampleRate;
    const twoPi = this.twoPi;
    const pressureDurationSamples = this.pressureDurationSamples;
    const breathFloor = this.breathFloor;
    const breathSpan = 1.5 - breathFloor;
    const blockLen = channel.length;

    for (let i = 0; i < blockLen; i++) {
      if (freqARate) frequency = freqParam[i];
      if (lipARate) lipTensionIn = lipParam[i];
      if (breathARate) breathIn = breathParamIn[i];
      if (depthARate) vibratoDepth = depthParam[i];
      if (rateARate) vibratoRate = rateParam[i];

      let freq = frequency;
      if (freq < 20) freq = 20;
      else if (freq > 5000) freq = 5000;

      let lipTension = lipTensionIn;
      if (lipTension < 0) lipTension = 0;
      else if (lipTension > 1) lipTension = 1;

      let breathParam = breathIn;
      if (breathParam < 0) breathParam = 0;
      else if (breathParam > 1.5) breathParam = 1.5;

      const depth = vibratoDepth < 0 ? 0 : vibratoDepth > 1 ? 1 : vibratoDepth;
      const rate = vibratoRate < 1 ? 1 : vibratoRate > 10 ? 10 : vibratoRate;

      let transientPressureMod = 0;
      let noiseMod = 0;
      if (this.isAttacking) {
        if (this.attackPhase < pressureDurationSamples) {
          const progress = this.attackPhase / pressureDurationSamples;
          transientPressureMod =
            Math.sin(progress * Math.PI) * Math.exp(-progress * 2) * 0.3;
          noiseMod = (Math.random() * 2 - 1) * (1 - progress) * 0.05;
          this.attackPhase++;
        } else {
          this.isAttacking = false;
        }
      }

      let breath;
      let envGain = this.releaseGain;
      if (this.isBreathReleasing) {
        const dur = this.breathReleaseDurationSamples;
        const amount = this.breathReleasePhase / dur;
        breath = this.breathReleaseStart * (1 - amount);
        if (breath < 0) breath = 0;
        envGain = 1;
        this.releaseGain = 1;
        this.breathReleasePhase++;
        if (this.breathReleasePhase >= dur) {
          this.isBreathReleasing = false;
          breath = 0;
          envGain = 0;
          this.releaseGain = 0;
        }
      } else if (this.isBreathAttacking) {
        const dur = this.breathAttackDurationSamples;
        const amount = this.breathAttackPhase / dur;
        breath = this.breathAttackTarget * amount;
        if (breath < 0) breath = 0;
        envGain = 1;
        this.releaseGain = 1;
        this.breathAttackPhase++;
        if (this.breathAttackPhase >= dur) {
          this.isBreathAttacking = false;
          breath = this.breathAttackTarget;
          this.beginBreathDecay(breath);
        }
      } else if (this.isBreathDecaying) {
        const dur = this.breathDecayDurationSamples;
        const amount = this.breathDecayPhase / dur;
        const held = this.sustainBreath(breathParam);
        breath = this.breathDecayStart + (held - this.breathDecayStart) * amount;
        if (breath < 0) breath = 0;
        else if (breath > 1.5) breath = 1.5;
        envGain = 1;
        this.releaseGain = 1;
        this.breathDecayPhase++;
        if (this.breathDecayPhase >= dur) {
          this.isBreathDecaying = false;
          this.isBreathHolding = true;
          breath = held;
        }
      } else if (this.isBreathHolding) {
        breath = this.sustainBreath(breathParam);
        envGain = 1;
        this.releaseGain = 1;
      } else {
        breath = breathParam;
        // Gate is armed only by attack (releaseGain=1). After release ends
        // it stays 0 even if breath AudioParam briefly lags behind.
        if (!(breath > 0.0005)) {
          this.releaseGain = 0;
        }
        envGain = this.releaseGain;
        if (!(envGain > 0)) breath = 0;
      }

      if (this.previousBreath < 0.0005 && breath >= 0.0005) {
        this.clearBore(this.lastPeriod);
      }
      this.previousBreath = breath;

      this.vibratoPhase += rate * twoPi * invSampleRate;
      if (this.vibratoPhase > twoPi) this.vibratoPhase -= twoPi;

      const totalPressure =
        breath + Math.sin(this.vibratoPhase) * depth * 0.4 + transientPressureMod;

      let delaySamples = sampleRate / freq;
      if (delaySamples < 2) delaySamples = 2;
      else if (delaySamples > size - 3) delaySamples = size - 3;
      this.lastPeriod = delaySamples;

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

      const deltaPressure = totalPressure - reflectedWave;
      const cubic = 0.08 + breath * 0.32;
      let lipFunction =
        deltaPressure - deltaPressure * deltaPressure * deltaPressure * cubic;
      lipFunction *= 0.4 + lipTension * 0.6;

      const breathingSignal = lipFunction + noiseMod;
      let inputToPipe = breathingSignal + reflectedWave;

      this.filterState = 0.8 * this.filterState + 0.2 * inputToPipe;
      const clip = 1.2 + breath * 1.2;
      if (this.filterState > clip) this.filterState = clip;
      else if (this.filterState < -clip) this.filterState = -clip;

      this.delayBuffer[this.writeIndex] = this.filterState;

      let rawOut = (breathingSignal - reflectedWave) * 0.25;
      let breathNorm = (breath - breathFloor) / breathSpan;
      if (breathNorm < 0) breathNorm = 0;
      else if (breathNorm > 1) breathNorm = 1;
      this.toneState = 0.9 * this.toneState + 0.1 * rawOut;
      const mixed = this.toneState + breathNorm * (rawOut - this.toneState);
      const breathLevel = 0.2 + 0.8 * (breath / 1.5);
      channel[i] = mixed * breathLevel * envGain;

      this.writeIndex = (this.writeIndex + 1) & mask;
    }

    this.cpuAccumMs += this.now() - cpuStart;
    this.reportCpu(blockLen);
    return true;
  }
}

registerProcessor('brass-processor', BrassProcessor);
`;
