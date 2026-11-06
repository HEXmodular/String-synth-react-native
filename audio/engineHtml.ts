import { brassProcessorSource } from "@/audio/brassProcessor";
import { fdnReverbProcessorSource } from "@/audio/fdnReverbProcessor";

/** FDN delay-line count: 4 or 8. */
const FDN_LINES = 8;

/** Changes when processor/engine source changes — remount WebView / reinject web script. */
export function getEngineBuildId() {
  // Hash the full injected script so engineHtml-only fixes invalidate the cache too.
  const source = createEngineScript();
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0;
  }
  return `brass-${hash}-${source.length}`;
}

export function createEngineScript() {
  const processorSource = JSON.stringify(
    brassProcessorSource + "\n" + fdnReverbProcessorSource,
  );
  const fdnLines = FDN_LINES;

  return `
(function () {
  if (window.__brassAudioCtx && window.__brassAudioCtx.close) {
    try {
      window.__brassAudioCtx.close();
    } catch (error) {}
    window.__brassAudioCtx = null;
  }

  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    window.resumeAudio = function () {};
    window.bowNote = function () {};
    window.noteOn = function () {};
    window.noteOff = function () {};
    window.setBowVelocity = function () {};
    window.setBowForce = function () {};
    window.setVibratoIntensity = function () {};
    window.setVibratoRate = function () {};
    window.setBowVelocityAttack = function () {};
    window.setBowVelocityDecay = function () {};
    window.setBowVelocitySustain = function () {};
    window.setBowVelocityRelease = function () {};
    window.setMasterVolume = function () {};
    window.getOutputLevel = function () {
      return 0;
    };
    window.getCpuLoad = function () {
      return 0;
    };
    window.setChorusLevel = function () {};
    window.setChorusRate = function () {};
    window.setChorusNoiseMod = function () {};
    window.setChorusDepth = function () {};
    window.setChorusDelay = function () {};
    window.setDelayTime = function () {};
    window.setDelayFeedback = function () {};
    window.setDelayLevel = function () {};
    window.setPredelay = function () {};
    window.setReverbLevel = function () {};
    return;
  }

  var audioCtx;
  try {
    audioCtx = new AudioCtx({ latencyHint: "interactive" });
  } catch (error) {
    audioCtx = new AudioCtx();
  }
  window.__brassAudioCtx = audioCtx;

  var MAX_VOICES = 16;
  var FDN_LINES = ${fdnLines};
  var CHORUS_DEPTH_MAX = 0.005;
  var PREDELAY_LFO_RATE = 0.75;
  var PREDELAY_LFO_AMP = 0.005;
  var mixer = null;
  var master = null;
  var outputAnalyser = null;
  var outputLevel = 0;
  var outputMeterBuffer = null;
  var outputMeterRaf = 0;
  var outputMeterLastPost = 0;
  var cpuLoad = 0;
  var fdnCpuLoad = 0;
  var cpuMeterLastPost = 0;
  var chorusDelayL = null;
  var chorusDelayR = null;
  var chorusLfo = null;
  var chorusLfoDepthL = null;
  var chorusLfoDepthR = null;
  var chorusSineGate = null;
  var chorusNoiseGate = null;
  var chorusNoiseFilter = null;
  var chorusWet = null;
  var delayBus = null;
  var feedbackDelay = null;
  var delayFeedbackGain = null;
  var delayWet = null;
  var predelay = null;
  var predelayLfo = null;
  var predelayLfoDepth = null;
  var reverbWet = null;
  var voices = [];
  var ready = false;
  var pending = [];
  var bowVelocity = 1;
  var bowForce = 0.5;
  var vibratoIntensity = 0.01;
  var vibratoRate = 1.03;
  var velocityAttack = 0.08;
  var velocityDecay = 0.15;
  var velocitySustain = 1;
  var velocityRelease = 0.1;
  var masterVolume = 0.75;
  var chorusLevel = 0.7;
  var chorusRate = 1.5;
  var chorusNoiseCutoff = 17.2;
  var chorusNoiseMod = true;
  var chorusDepth = 0.117;
  var chorusDelayTime = 0.028;
  var delayTime = 0.35;
  var delayFeedback = 0.35;
  var delayLevel = 0;
  var predelayTime = 0.167;
  var reverbLevel = 0.86;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function finite(value, fallback) {
    var next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  function applyBowToActive() {
    if (!ready) {
      return;
    }

    var now = audioCtx.currentTime;
    for (var i = 0; i < voices.length; i++) {
      var voice = voices[i];
      if (!voice.active) {
        continue;
      }
      voice.force.cancelScheduledValues(now);
      voice.vibrato.cancelScheduledValues(now);
      voice.vibratoRate.cancelScheduledValues(now);
      voice.force.setValueAtTime(bowForce, now);
      voice.vibrato.setValueAtTime(vibratoIntensity, now);
      voice.vibratoRate.setValueAtTime(vibratoRate, now);
      // Do not touch velocity during breath attack/release — worklet owns ramps.
      if (!(voice.attackUntil > now) && !(voice.releaseUntil > now)) {
        voice.velocity.cancelScheduledValues(now);
        voice.velocity.setValueAtTime(bowVelocity, now);
      }
    }
  }

  function resume() {
    var pendingResume = audioCtx.resume();
    if (pendingResume && pendingResume.catch) {
      pendingResume.catch(function () {});
    }
  }

  function createVoice() {
    var brassNode = new AudioWorkletNode(audioCtx, "brass-processor");
    var amp = audioCtx.createGain();
    var now = audioCtx.currentTime;
    amp.gain.setValueAtTime(0, now);
    var velocity = brassNode.parameters.get("breath");
    var vibrato = brassNode.parameters.get("vibratoDepth");
    var vibratoRateParam = brassNode.parameters.get("vibratoRate");
    var attackTrigger = brassNode.parameters.get("attackTrigger");
    var attackTimeParam = brassNode.parameters.get("attackTime");
    var decayTimeParam = brassNode.parameters.get("decayTime");
    var sustainLevelParam = brassNode.parameters.get("sustainLevel");
    var releaseTrigger = brassNode.parameters.get("releaseTrigger");
    var releaseTimeParam = brassNode.parameters.get("releaseTime");
    velocity.setValueAtTime(0, now);
    vibrato.setValueAtTime(0, now);
    vibratoRateParam.setValueAtTime(vibratoRate, now);
    attackTrigger.setValueAtTime(0, now);
    attackTimeParam.setValueAtTime(velocityAttack, now);
    decayTimeParam.setValueAtTime(velocityDecay, now);
    sustainLevelParam.setValueAtTime(velocitySustain, now);
    releaseTrigger.setValueAtTime(0, now);
    releaseTimeParam.setValueAtTime(velocityRelease, now);
    brassNode.connect(amp);
    amp.connect(mixer);
    var voice = {
      node: brassNode,
      frequency: brassNode.parameters.get("frequency"),
      force: brassNode.parameters.get("lipTension"),
      velocity: velocity,
      vibrato: vibrato,
      vibratoRate: vibratoRateParam,
      attackTrigger: attackTrigger,
      attackTime: attackTimeParam,
      decayTime: decayTimeParam,
      sustainLevel: sustainLevelParam,
      releaseTrigger: releaseTrigger,
      releaseTime: releaseTimeParam,
      amp: amp,
      noteId: null,
      active: false,
      startedAt: 0,
      attackUntil: 0,
      releaseUntil: 0,
      cpuLoad: 0,
    };
    brassNode.port.onmessage = function (event) {
      var data = event && event.data;
      if (!data || data.type !== "cpu") {
        return;
      }
      voice.cpuLoad = finite(data.load, 0);
      publishCpuLoad();
    };
    return voice;
  }

  function findActive(noteId) {
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].active && voices[i].noteId === noteId) {
        return voices[i];
      }
    }
    return null;
  }

  function releaseVoice(voice) {
    var now = audioCtx.currentTime;
    var releaseTime = Math.max(0.01, velocityRelease);
    var breathStart = bowVelocity < 0.5 ? 0.5 : bowVelocity;
    voice.attackUntil = 0;
    voice.releaseUntil = now + releaseTime;
    voice.velocity.cancelScheduledValues(now);
    voice.releaseTrigger.cancelScheduledValues(now);
    voice.releaseTime.cancelScheduledValues(now);
    voice.amp.gain.cancelScheduledValues(now);

    // Worklet ramps breath to 0. Amp stays open so Release is not a volume fade.
    voice.velocity.setValueAtTime(0, now + releaseTime + 0.01);
    voice.releaseTime.setValueAtTime(releaseTime, now);
    voice.releaseTrigger.setValueAtTime(0, now);
    voice.releaseTrigger.setValueAtTime(1, now + 0.02);
    voice.node.port.postMessage({
      type: "release",
      releaseTime: releaseTime,
      breathStart: breathStart,
    });

    voice.amp.gain.setValueAtTime(0.22, now);
    voice.amp.gain.setValueAtTime(0.22, now + releaseTime);
    voice.amp.gain.linearRampToValueAtTime(0.0001, now + releaseTime + 0.02);
  }

  function allocVoice() {
    var now = audioCtx.currentTime;
    for (var i = 0; i < voices.length; i++) {
      // Don't steal a voice still in its release tail.
      if (!voices[i].active && !(voices[i].releaseUntil > now)) {
        return voices[i];
      }
    }

    if (voices.length < MAX_VOICES) {
      var created = createVoice();
      voices.push(created);
      return created;
    }

    var oldest = voices[0];
    for (var j = 1; j < voices.length; j++) {
      if (voices[j].startedAt < oldest.startedAt) {
        oldest = voices[j];
      }
    }

    releaseVoice(oldest);
    oldest.active = false;
    oldest.noteId = null;
    return oldest;
  }

  function attackVoice(voice, noteId, frequency) {
    var now = audioCtx.currentTime;
    var freq = clamp(finite(frequency, 293.66), 20, 5000);
    voice.noteId = noteId;
    voice.active = true;
    voice.startedAt = now;

    voice.frequency.cancelScheduledValues(now);
    voice.force.cancelScheduledValues(now);
    voice.velocity.cancelScheduledValues(now);
    voice.vibrato.cancelScheduledValues(now);
    voice.vibratoRate.cancelScheduledValues(now);
    voice.attackTrigger.cancelScheduledValues(now);
    voice.attackTime.cancelScheduledValues(now);
    voice.decayTime.cancelScheduledValues(now);
    voice.sustainLevel.cancelScheduledValues(now);
    voice.releaseTrigger.cancelScheduledValues(now);
    voice.releaseTime.cancelScheduledValues(now);
    voice.amp.gain.cancelScheduledValues(now);

    voice.frequency.setValueAtTime(freq, now);
    voice.force.setValueAtTime(bowForce, now);
    voice.vibrato.setValueAtTime(vibratoIntensity, now);
    voice.vibratoRate.setValueAtTime(vibratoRate, now);
    var attackTime = Math.max(0.01, velocityAttack);
    var decayTime = Math.max(0.01, velocityDecay);
    var sustainLevel = clamp(velocitySustain, 0, 1);
    var breathTarget = bowVelocity < 0.5 ? 0.5 : bowVelocity;
    voice.releaseUntil = 0;
    voice.attackUntil = now + attackTime;
    // Breath AudioParam is the peak. The worklet ramps breath 0 → peak,
    // then toward sustain × peak, and down to 0 on release.
    voice.velocity.setValueAtTime(breathTarget, now);
    voice.attackTime.setValueAtTime(attackTime, now);
    voice.decayTime.setValueAtTime(decayTime, now);
    voice.sustainLevel.setValueAtTime(sustainLevel, now);
    // Rising edge backup (port message is authoritative for timing/target).
    voice.attackTrigger.setValueAtTime(0, now);
    voice.attackTrigger.setValueAtTime(1, now + 0.02);
    voice.node.port.postMessage({
      type: "attack",
      attackTime: attackTime,
      breathTarget: breathTarget,
      decayTime: decayTime,
      sustain: sustainLevel,
    });
    // Fixed voice gain. Attack shapes breath, not this amp.
    voice.amp.gain.setValueAtTime(0.22, now);
  }

  window.resumeAudio = resume;

  window.setBowVelocity = function (value) {
    bowVelocity = clamp(finite(value, bowVelocity), 0.5, 1.5);
    applyBowToActive();
  };

  window.setBowForce = function (value) {
    bowForce = clamp(finite(value, bowForce), 0, 1);
    applyBowToActive();
  };

  window.setVibratoIntensity = function (value) {
    vibratoIntensity = clamp(finite(value, vibratoIntensity), 0, 1);
    applyBowToActive();
  };

  window.setVibratoRate = function (value) {
    vibratoRate = clamp(finite(value, vibratoRate), 1, 10);
    applyBowToActive();
  };

  window.setBowVelocityAttack = function (value) {
    velocityAttack = clamp(finite(value, velocityAttack), 0.01, 1);
    if (!ready) {
      return;
    }
    var now = audioCtx.currentTime;
    for (var i = 0; i < voices.length; i++) {
      voices[i].attackTime.setValueAtTime(velocityAttack, now);
    }
  };

  window.setBowVelocityDecay = function (value) {
    velocityDecay = clamp(finite(value, velocityDecay), 0.01, 1);
    if (!ready) {
      return;
    }
    var now = audioCtx.currentTime;
    for (var i = 0; i < voices.length; i++) {
      voices[i].decayTime.setValueAtTime(velocityDecay, now);
    }
  };

  window.setBowVelocitySustain = function (value) {
    velocitySustain = clamp(finite(value, velocitySustain), 0, 1);
    if (!ready) {
      return;
    }
    var now = audioCtx.currentTime;
    for (var i = 0; i < voices.length; i++) {
      voices[i].sustainLevel.setValueAtTime(velocitySustain, now);
    }
  };

  window.setBowVelocityRelease = function (value) {
    velocityRelease = clamp(finite(value, velocityRelease), 0.01, 1);
    if (!ready) {
      return;
    }
    var now = audioCtx.currentTime;
    for (var i = 0; i < voices.length; i++) {
      voices[i].releaseTime.setValueAtTime(velocityRelease, now);
    }
  };

  window.setMasterVolume = function (value) {
    masterVolume = clamp(finite(value, masterVolume), 0, 1);
    if (!master) {
      return;
    }
    master.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
  };

  window.getOutputLevel = function () {
    return outputLevel;
  };

  window.getCpuLoad = function () {
    return cpuLoad;
  };

  function publishCpuLoad() {
    var total = fdnCpuLoad;
    for (var vi = 0; vi < voices.length; vi++) {
      total += voices[vi].cpuLoad || 0;
    }
    if (total < 0) {
      total = 0;
    }
    cpuLoad = total;
    window.__brassCpuLoad = total;
    if (!(window.ReactNativeWebView && window.ReactNativeWebView.postMessage)) {
      return;
    }
    var now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    if (now - cpuMeterLastPost < 100) {
      return;
    }
    cpuMeterLastPost = now;
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: "cpu", value: total }),
    );
  }

  function publishOutputLevel(level) {
    outputLevel = level;
    window.__brassOutputLevel = level;
    if (!(window.ReactNativeWebView && window.ReactNativeWebView.postMessage)) {
      return;
    }
    var now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    if (now - outputMeterLastPost < 33) {
      return;
    }
    outputMeterLastPost = now;
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: "level", value: level }),
    );
  }

  function tickOutputMeter() {
    outputMeterRaf = requestAnimationFrame(tickOutputMeter);
    if (!outputAnalyser || !outputMeterBuffer) {
      return;
    }

    outputAnalyser.getFloatTimeDomainData(outputMeterBuffer);
    var peak = 0;
    for (var i = 0; i < outputMeterBuffer.length; i++) {
      var sample = outputMeterBuffer[i];
      var abs = sample < 0 ? -sample : sample;
      if (abs > peak) {
        peak = abs;
      }
    }

    // Instant attack, smooth release for a readable VU-style needle.
    // Display gain compensates for the brass processor's ~0.25 output scale.
    var scaled = peak * 3;
    var next = scaled > outputLevel ? scaled : outputLevel * 0.86;
    if (next < 0.001) {
      next = 0;
    }
    publishOutputLevel(clamp(next, 0, 1));
  }

  function startOutputMeter() {
    if (outputMeterRaf) {
      return;
    }
    outputMeterRaf = requestAnimationFrame(tickOutputMeter);
  }

  window.setChorusLevel = function (value) {
    chorusLevel = clamp(finite(value, chorusLevel), 0, 1);
    if (!chorusWet) {
      return;
    }
    chorusWet.gain.setValueAtTime(chorusLevel, audioCtx.currentTime);
  };

  window.setChorusRate = function (value) {
    if (chorusNoiseMod) {
      chorusNoiseCutoff = clamp(finite(value, chorusNoiseCutoff), 10, 200);
      if (!chorusNoiseFilter) {
        return;
      }
      chorusNoiseFilter.frequency.setValueAtTime(
        chorusNoiseCutoff,
        audioCtx.currentTime,
      );
      return;
    }

    chorusRate = clamp(finite(value, chorusRate), 0.1, 5);
    if (!chorusLfo) {
      return;
    }
    chorusLfo.frequency.setValueAtTime(chorusRate, audioCtx.currentTime);
  };

  window.setChorusNoiseMod = function (value) {
    chorusNoiseMod = !!finite(value, chorusNoiseMod ? 1 : 0);
    if (!chorusSineGate || !chorusNoiseGate) {
      return;
    }
    var now = audioCtx.currentTime;
    chorusSineGate.gain.setValueAtTime(chorusNoiseMod ? 0 : 1, now);
    chorusNoiseGate.gain.setValueAtTime(chorusNoiseMod ? 1 : 0, now);
  };

  window.setChorusDepth = function (value) {
    chorusDepth = clamp(finite(value, chorusDepth), 0, 1);
    var depthSeconds = chorusDepth * CHORUS_DEPTH_MAX;
    if (!chorusLfoDepthL || !chorusLfoDepthR) {
      return;
    }
    var now = audioCtx.currentTime;
    chorusLfoDepthL.gain.setValueAtTime(depthSeconds, now);
    chorusLfoDepthR.gain.setValueAtTime(depthSeconds, now);
  };

  window.setChorusDelay = function (value) {
    chorusDelayTime = clamp(finite(value, chorusDelayTime), 0.008, 0.03);
    if (!chorusDelayL || !chorusDelayR) {
      return;
    }
    var now = audioCtx.currentTime;
    chorusDelayL.delayTime.setValueAtTime(chorusDelayTime, now);
    chorusDelayR.delayTime.setValueAtTime(chorusDelayTime, now);
  };

  window.setDelayTime = function (value) {
    delayTime = clamp(finite(value, delayTime), 0.05, 1.5);
    if (!feedbackDelay) {
      return;
    }
    feedbackDelay.delayTime.setValueAtTime(delayTime, audioCtx.currentTime);
  };

  window.setDelayFeedback = function (value) {
    delayFeedback = clamp(finite(value, delayFeedback), 0, 0.95);
    if (!delayFeedbackGain) {
      return;
    }
    delayFeedbackGain.gain.setValueAtTime(delayFeedback, audioCtx.currentTime);
  };

  window.setDelayLevel = function (value) {
    delayLevel = clamp(finite(value, delayLevel), 0, 1);
    if (!delayWet) {
      return;
    }
    delayWet.gain.setValueAtTime(delayLevel, audioCtx.currentTime);
  };

  window.setPredelay = function (value) {
    predelayTime = clamp(finite(value, predelayTime), 0, 0.2);
    if (!predelay) {
      return;
    }
    var now = audioCtx.currentTime;
    predelay.delayTime.setValueAtTime(predelayTime, now);
    if (predelayLfoDepth) {
      predelayLfoDepth.gain.setValueAtTime(predelayTime * PREDELAY_LFO_AMP, now);
    }
  };

  window.setReverbLevel = function (value) {
    reverbLevel = clamp(finite(value, reverbLevel), 0, 1);
    if (!reverbWet) {
      return;
    }
    reverbWet.gain.setValueAtTime(reverbLevel, audioCtx.currentTime);
  };

  window.noteOn = function (noteId, frequency) {
    resume();
    if (!ready) {
      pending.push({ type: "on", noteId: noteId, frequency: frequency });
      return;
    }

    var id = Math.round(finite(noteId, 0));
    var voice = findActive(id);
    if (!voice) {
      voice = allocVoice();
    }
    attackVoice(voice, id, frequency);
  };

  window.noteOff = function (noteId) {
    if (!ready) {
      pending.push({ type: "off", noteId: noteId });
      return;
    }

    var voice = findActive(Math.round(finite(noteId, 0)));
    if (!voice) {
      return;
    }

    releaseVoice(voice);
    voice.active = false;
    voice.noteId = null;
  };

  window.bowNote = function (frequency, duration) {
    var dur = finite(duration, 1.5);
    if (dur < 0.16) dur = 0.16;
    if (!ready) {
      pending.push({ type: "bow", frequency: frequency, duration: dur });
      return;
    }

    window.noteOn(-1, frequency);
    setTimeout(function () {
      window.noteOff(-1);
    }, dur * 1000);
  };

  function flushPending() {
    var commands = pending;
    pending = [];
    for (var i = 0; i < commands.length; i++) {
      var command = commands[i];
      if (command.type === "on") {
        window.noteOn(command.noteId, command.frequency);
      } else if (command.type === "off") {
        window.noteOff(command.noteId);
      } else {
        window.bowNote(command.frequency, command.duration);
      }
    }
  }

  function init() {
    if (!audioCtx.audioWorklet) {
      return Promise.reject(new Error("AudioWorklet is unavailable"));
    }

    var url = URL.createObjectURL(
      new Blob([${processorSource}], { type: "application/javascript" }),
    );

    return audioCtx.audioWorklet.addModule(url).then(function () {
      URL.revokeObjectURL(url);

      mixer = audioCtx.createGain();
      var bodyFilter = audioCtx.createBiquadFilter();
      bodyFilter.type = "lowpass";
      bodyFilter.frequency.value = 4500;
      bodyFilter.Q.value = 0.7;

      master = audioCtx.createGain();
      master.gain.setValueAtTime(masterVolume, audioCtx.currentTime);

      outputAnalyser = audioCtx.createAnalyser();
      outputAnalyser.fftSize = 256;
      outputAnalyser.smoothingTimeConstant = 0;
      outputMeterBuffer = new Float32Array(outputAnalyser.fftSize);

      // Stereo chorus: dual DelayNodes modulated by opposite-phase LFOs
      var chorusOut = audioCtx.createGain();
      var chorusDry = audioCtx.createGain();
      chorusDry.gain.setValueAtTime(1, audioCtx.currentTime);
      chorusWet = audioCtx.createGain();
      chorusWet.gain.setValueAtTime(chorusLevel, audioCtx.currentTime);

      chorusDelayL = audioCtx.createDelay(0.05);
      chorusDelayR = audioCtx.createDelay(0.05);
      chorusDelayL.delayTime.setValueAtTime(chorusDelayTime, audioCtx.currentTime);
      chorusDelayR.delayTime.setValueAtTime(chorusDelayTime, audioCtx.currentTime);

      var chorusMerger = audioCtx.createChannelMerger(2);
      chorusLfo = audioCtx.createOscillator();
      chorusLfo.type = "sine";
      chorusLfo.frequency.setValueAtTime(chorusRate, audioCtx.currentTime);

      var depthSeconds = chorusDepth * CHORUS_DEPTH_MAX;
      chorusLfoDepthL = audioCtx.createGain();
      chorusLfoDepthR = audioCtx.createGain();
      chorusLfoDepthL.gain.setValueAtTime(depthSeconds, audioCtx.currentTime);
      chorusLfoDepthR.gain.setValueAtTime(depthSeconds, audioCtx.currentTime);
      var chorusLfoInvert = audioCtx.createGain();
      chorusLfoInvert.gain.setValueAtTime(-1, audioCtx.currentTime);

      var chorusModBus = audioCtx.createGain();
      chorusSineGate = audioCtx.createGain();
      chorusNoiseGate = audioCtx.createGain();
      chorusSineGate.gain.setValueAtTime(chorusNoiseMod ? 0 : 1, audioCtx.currentTime);
      chorusNoiseGate.gain.setValueAtTime(chorusNoiseMod ? 1 : 0, audioCtx.currentTime);

      var noiseLength = Math.floor(audioCtx.sampleRate * 2);
      var noiseBuffer = audioCtx.createBuffer(1, noiseLength, audioCtx.sampleRate);
      var noiseData = noiseBuffer.getChannelData(0);
      for (var ni = 0; ni < noiseLength; ni++) {
        noiseData[ni] = Math.random() * 2 - 1;
      }
      var chorusNoise = audioCtx.createBufferSource();
      chorusNoise.buffer = noiseBuffer;
      chorusNoise.loop = true;

      chorusNoiseFilter = audioCtx.createBiquadFilter();
      chorusNoiseFilter.type = "lowpass";
      chorusNoiseFilter.frequency.setValueAtTime(
        chorusNoiseCutoff,
        audioCtx.currentTime,
      );
      chorusNoiseFilter.Q.setValueAtTime(0.707, audioCtx.currentTime);
      var chorusNoiseMakeup = audioCtx.createGain();
      chorusNoiseMakeup.gain.setValueAtTime(5, audioCtx.currentTime);

      chorusLfo.connect(chorusSineGate);
      chorusSineGate.connect(chorusModBus);
      chorusNoise.connect(chorusNoiseFilter);
      chorusNoiseFilter.connect(chorusNoiseMakeup);
      chorusNoiseMakeup.connect(chorusNoiseGate);
      chorusNoiseGate.connect(chorusModBus);
      chorusModBus.connect(chorusLfoDepthL);
      chorusLfoDepthL.connect(chorusDelayL.delayTime);
      chorusModBus.connect(chorusLfoInvert);
      chorusLfoInvert.connect(chorusLfoDepthR);
      chorusLfoDepthR.connect(chorusDelayR.delayTime);
      chorusLfo.start();
      chorusNoise.start();

      // Feedback delay insert (before reverb send)
      delayBus = audioCtx.createGain();
      feedbackDelay = audioCtx.createDelay(2);
      feedbackDelay.delayTime.setValueAtTime(delayTime, audioCtx.currentTime);
      delayFeedbackGain = audioCtx.createGain();
      delayFeedbackGain.gain.setValueAtTime(delayFeedback, audioCtx.currentTime);
      delayWet = audioCtx.createGain();
      delayWet.gain.setValueAtTime(delayLevel, audioCtx.currentTime);

      predelay = audioCtx.createDelay(0.25);
      predelay.delayTime.setValueAtTime(predelayTime, audioCtx.currentTime);

      predelayLfo = audioCtx.createOscillator();
      predelayLfo.type = "sine";
      predelayLfo.frequency.setValueAtTime(PREDELAY_LFO_RATE, audioCtx.currentTime);
      predelayLfoDepth = audioCtx.createGain();
      predelayLfoDepth.gain.setValueAtTime(
        predelayTime * PREDELAY_LFO_AMP,
        audioCtx.currentTime,
      );
      predelayLfo.connect(predelayLfoDepth);
      predelayLfoDepth.connect(predelay.delayTime);
      predelayLfo.start();

      var fdn = new AudioWorkletNode(audioCtx, "fdn-reverb-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 1,
        channelCountMode: "explicit",
        processorOptions: { lines: FDN_LINES },
      });
      fdn.port.onmessage = function (event) {
        var data = event && event.data;
        if (!data || data.type !== "cpu") {
          return;
        }
        fdnCpuLoad = finite(data.load, 0);
        publishCpuLoad();
      };

      reverbWet = audioCtx.createGain();
      reverbWet.gain.setValueAtTime(reverbLevel, audioCtx.currentTime);

      mixer.connect(bodyFilter);
      // Chorus insert → dry + stereo wet
      bodyFilter.connect(chorusDry);
      chorusDry.connect(chorusOut);
      bodyFilter.connect(chorusDelayL);
      bodyFilter.connect(chorusDelayR);
      chorusDelayL.connect(chorusMerger, 0, 0);
      chorusDelayR.connect(chorusMerger, 0, 1);
      chorusMerger.connect(chorusWet);
      chorusWet.connect(chorusOut);
      // Feedback delay: dry through + wet with feedback loop
      chorusOut.connect(delayBus);
      chorusOut.connect(feedbackDelay);
      feedbackDelay.connect(delayFeedbackGain);
      delayFeedbackGain.connect(feedbackDelay);
      feedbackDelay.connect(delayWet);
      delayWet.connect(delayBus);
      delayBus.connect(master);
      // Wet: delay bus → predelay → FDN → stereo out
      delayBus.connect(predelay);
      predelay.connect(fdn);
      fdn.connect(reverbWet);
      reverbWet.connect(master);
      master.connect(outputAnalyser);
      outputAnalyser.connect(audioCtx.destination);

      ready = true;
      flushPending();
      startOutputMeter();
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "ready" }));
      }
    }).catch(function (error) {
      URL.revokeObjectURL(url);
      throw error;
    });
  }

  init().catch(function (error) {
    if (!ready) {
      console.error(error);
      window.bowNote = function () {};
      window.noteOn = function () {};
      window.noteOff = function () {};
      window.setBowVelocity = function () {};
      window.setBowForce = function () {};
      window.setVibratoIntensity = function () {};
      window.setVibratoRate = function () {};
      window.setBowVelocityAttack = function () {};
      window.setBowVelocityDecay = function () {};
      window.setBowVelocitySustain = function () {};
      window.setBowVelocityRelease = function () {};
      window.setMasterVolume = function () {};
      window.getOutputLevel = function () {
        return 0;
      };
      window.getCpuLoad = function () {
        return 0;
      };
      window.setChorusLevel = function () {};
      window.setChorusRate = function () {};
      window.setChorusNoiseMod = function () {};
      window.setChorusDepth = function () {};
      window.setChorusDelay = function () {};
      window.setDelayTime = function () {};
      window.setDelayFeedback = function () {};
      window.setDelayLevel = function () {};
      window.setPredelay = function () {};
      window.setReverbLevel = function () {};
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: "error", message: String(error && error.message ? error.message : error) }),
        );
      }
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      resume();
    }
  });
})();
`;
}

export function createEngineHtml() {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <script>
      ${createEngineScript()}
    </script>
  </body>
</html>`;
}
