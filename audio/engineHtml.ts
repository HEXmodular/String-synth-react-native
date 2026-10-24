import { bowedStringProcessorSource } from "@/audio/bowedStringProcessor";
import { fdnReverbProcessorSource } from "@/audio/fdnReverbProcessor";

/** FDN delay-line count: 4 or 8. */
const FDN_LINES = 8;

export function createEngineScript() {
  const processorSource = JSON.stringify(
    bowedStringProcessorSource + "\n" + fdnReverbProcessorSource,
  );
  const fdnLines = FDN_LINES === 4 ? 4 : 8;

  return `
(function () {
  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    window.resumeAudio = function () {};
    window.bowNote = function () {};
    window.noteOn = function () {};
    window.noteOff = function () {};
    window.setBowVelocity = function () {};
    window.setBowForce = function () {};
    window.setVibratoIntensity = function () {};
    window.setBowVelocityAttack = function () {};
    window.setBowVelocityRelease = function () {};
    window.setMasterVolume = function () {};
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

  var MAX_VOICES = 16;
  var FDN_LINES = ${fdnLines};
  var mixer = null;
  var master = null;
  var predelay = null;
  var reverbWet = null;
  var voices = [];
  var ready = false;
  var pending = [];
  var bowVelocity = 0.18;
  var bowForce = 1;
  var vibratoIntensity = 0;
  var velocityAttack = 0.08;
  var velocityRelease = 0.1;
  var masterVolume = 1;
  var predelayTime = 0.02;
  var reverbLevel = 0.28;

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
      voice.velocity.cancelScheduledValues(now);
      voice.vibrato.cancelScheduledValues(now);
      voice.force.setValueAtTime(bowForce, now);
      voice.velocity.setValueAtTime(bowVelocity, now);
      voice.vibrato.setValueAtTime(vibratoIntensity, now);
    }
  }

  function resume() {
    var pendingResume = audioCtx.resume();
    if (pendingResume && pendingResume.catch) {
      pendingResume.catch(function () {});
    }
  }

  function createVoice() {
    var stringNode = new AudioWorkletNode(audioCtx, "bowed-string-processor");
    var amp = audioCtx.createGain();
    var now = audioCtx.currentTime;
    amp.gain.setValueAtTime(0, now);
    var velocity = stringNode.parameters.get("bowVelocity");
    var vibrato = stringNode.parameters.get("vibratoDepth");
    velocity.setValueAtTime(0, now);
    vibrato.setValueAtTime(0, now);
    stringNode.connect(amp);
    amp.connect(mixer);
    return {
      frequency: stringNode.parameters.get("frequency"),
      force: stringNode.parameters.get("bowForce"),
      velocity: velocity,
      vibrato: vibrato,
      amp: amp,
      noteId: null,
      active: false,
      startedAt: 0,
    };
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
    voice.velocity.cancelScheduledValues(now);
    voice.amp.gain.cancelScheduledValues(now);
    voice.velocity.setValueAtTime(voice.velocity.value || 0, now);
    voice.velocity.linearRampToValueAtTime(0, now + releaseTime);

    var gainNow = voice.amp.gain.value;
    if (!(gainNow > 0.001)) {
      voice.amp.gain.setValueAtTime(0.001, now);
      return;
    }

    // Keep amp open slightly past bow stop so free string decay stays audible.
    var ampRelease = releaseTime + 0.12;
    voice.amp.gain.setValueAtTime(gainNow, now);
    voice.amp.gain.exponentialRampToValueAtTime(0.001, now + ampRelease);
  }

  function allocVoice() {
    for (var i = 0; i < voices.length; i++) {
      if (!voices[i].active) {
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
    voice.amp.gain.cancelScheduledValues(now);

    voice.frequency.setValueAtTime(freq, now);
    voice.force.setValueAtTime(bowForce, now);
    voice.vibrato.setValueAtTime(vibratoIntensity, now);
    voice.velocity.setValueAtTime(0, now);
    voice.velocity.linearRampToValueAtTime(bowVelocity, now + velocityAttack);
    voice.amp.gain.setValueAtTime(0, now);
    voice.amp.gain.linearRampToValueAtTime(0.22, now + 0.05);
  }

  window.resumeAudio = resume;

  window.setBowVelocity = function (value) {
    bowVelocity = clamp(finite(value, bowVelocity), 0, 1);
    applyBowToActive();
  };

  window.setBowForce = function (value) {
    bowForce = clamp(finite(value, bowForce), 0.1, 5);
    applyBowToActive();
  };

  window.setVibratoIntensity = function (value) {
    vibratoIntensity = clamp(finite(value, vibratoIntensity), 0, 1);
    applyBowToActive();
  };

  window.setBowVelocityAttack = function (value) {
    velocityAttack = clamp(finite(value, velocityAttack), 0.01, 1);
  };

  window.setBowVelocityRelease = function (value) {
    velocityRelease = clamp(finite(value, velocityRelease), 0.01, 1);
  };

  window.setMasterVolume = function (value) {
    masterVolume = clamp(finite(value, masterVolume), 0, 1);
    if (!master) {
      return;
    }
    master.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
  };

  window.setPredelay = function (value) {
    predelayTime = clamp(finite(value, predelayTime), 0, 0.2);
    if (!predelay) {
      return;
    }
    predelay.delayTime.setValueAtTime(predelayTime, audioCtx.currentTime);
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
      bodyFilter.type = "bandpass";
      bodyFilter.frequency.value = 1200;
      bodyFilter.Q.value = 1.0;

      master = audioCtx.createGain();
      master.gain.setValueAtTime(masterVolume, audioCtx.currentTime);

      predelay = audioCtx.createDelay(0.25);
      predelay.delayTime.setValueAtTime(predelayTime, audioCtx.currentTime);

      var fdn = new AudioWorkletNode(audioCtx, "fdn-reverb-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 1,
        channelCountMode: "explicit",
        processorOptions: { lines: FDN_LINES },
      });

      reverbWet = audioCtx.createGain();
      reverbWet.gain.setValueAtTime(reverbLevel, audioCtx.currentTime);

      mixer.connect(bodyFilter);
      // Dry path
      bodyFilter.connect(master);
      // Wet: single FDN → stereo out (no per-channel FDN)
      bodyFilter.connect(predelay);
      predelay.connect(fdn);
      fdn.connect(reverbWet);
      reverbWet.connect(master);
      master.connect(audioCtx.destination);

      ready = true;
      flushPending();
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
      window.setBowVelocityAttack = function () {};
      window.setBowVelocityRelease = function () {};
      window.setMasterVolume = function () {};
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
