/** FDN reverb worklet: one network, stereo out (no per-channel FDN copy). */
export const fdnReverbProcessorSource = `
class FdnReverbProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [];
  }

  constructor(options) {
    super();
    var opts = (options && options.processorOptions) || {};
    var requested = opts.lines === 4 ? 4 : 8;
    this.N = requested;

    // Mutually prime-ish lengths (ms); first 4 used when N === 4.
    var delaysMs = [29.7, 37.1, 41.1, 43.7, 47.3, 53.1, 59.3, 61.7];
    this.delays = new Array(this.N);
    this.writePtr = new Int32Array(this.N);
    this.delayLen = new Int32Array(this.N);
    this.lpState = new Float32Array(this.N);
    this.z = new Float32Array(this.N);
    this.damping = 0.35;
    this.decay = 0.84;

    for (var i = 0; i < this.N; i++) {
      var len = Math.max(2, Math.round((delaysMs[i] / 1000) * sampleRate));
      this.delayLen[i] = len;
      this.delays[i] = new Float32Array(len);
      this.writePtr[i] = 0;
    }

    // Orthogonal stereo mix rows so L/R stay decorrelated.
    this.outL = new Float32Array(this.N);
    this.outR = new Float32Array(this.N);
    if (this.N === 4) {
      this.outL.set([1, 1, 1, -1]);
      this.outR.set([1, -1, 1, 1]);
    } else {
      this.outL.set([1, 1, 1, 1, 1, -1, -1, 1]);
      this.outR.set([1, -1, 1, -1, 1, 1, -1, -1]);
    }
    var scale = 1 / Math.sqrt(this.N);
    for (var s = 0; s < this.N; s++) {
      this.outL[s] *= scale;
      this.outR[s] *= scale;
    }
  }

  process(inputs, outputs) {
    var input = inputs[0];
    var output = outputs[0];
    if (!output || !output[0]) {
      return true;
    }

    var outL = output[0];
    var outR = output[1] || output[0];
    var inL = input && input[0];
    var inR = input && input[1];
    var frames = outL.length;
    var N = this.N;
    var invN2 = 2 / N;
    var damping = this.damping;
    var oneMinusDamp = 1 - damping;
    var decay = this.decay;
    var z = this.z;

    for (var i = 0; i < frames; i++) {
      var dryL = inL ? inL[i] : 0;
      var dryR = inR ? inR[i] : dryL;
      var inputSample = 0.5 * (dryL + dryR);

      var sum = 0;
      for (var n = 0; n < N; n++) {
        // Oldest sample sits at the write pointer before overwrite.
        var delayed = this.delays[n][this.writePtr[n]];
        var filtered = oneMinusDamp * delayed + damping * this.lpState[n];
        this.lpState[n] = filtered;
        z[n] = filtered;
        sum += filtered;
      }

      // Householder feedback matrix (unitary when decay === 1).
      var left = 0;
      var right = 0;
      for (var m = 0; m < N; m++) {
        var feedback = decay * (z[m] - invN2 * sum);
        var write = this.writePtr[m];
        this.delays[m][write] = inputSample + feedback;
        write += 1;
        if (write >= this.delayLen[m]) write = 0;
        this.writePtr[m] = write;

        left += this.outL[m] * z[m];
        right += this.outR[m] * z[m];
      }

      outL[i] = left;
      outR[i] = right;
    }

    return true;
  }
}

registerProcessor('fdn-reverb-processor', FdnReverbProcessor);
`;
