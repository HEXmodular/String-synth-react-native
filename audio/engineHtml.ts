import { bowedStringProcessorSource } from "@/audio/bowedStringProcessor";

export function createEngineScript() {
  const processorSource = JSON.stringify(bowedStringProcessorSource);

  return `
(function () {
  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    window.resumeAudio = function () {};
    window.bowNote = function () {};
    window.noteOn = function () {};
    window.noteOff = function () {};
    return;
  }

  var audioCtx;
  try {
    audioCtx = new AudioCtx({ latencyHint: "interactive" });
  } catch (error) {
    audioCtx = new AudioCtx();
  }

  var MAX_VOICES = 16;
  var mixer = null;
  var voices = [];
  var ready = false;
  var pending = [];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function finite(value, fallback) {
    var next = Number(value);
    return Number.isFinite(next) ? next : fallback;
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
    velocity.setValueAtTime(0, now);
    stringNode.connect(amp);
    amp.connect(mixer);
    return {
      frequency: stringNode.parameters.get("frequency"),
      force: stringNode.parameters.get("bowForce"),
      velocity: velocity,
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
    voice.velocity.cancelScheduledValues(now);
    voice.amp.gain.cancelScheduledValues(now);
    voice.velocity.setValueAtTime(voice.velocity.value || 0, now);
    voice.velocity.linearRampToValueAtTime(0, now + 0.1);

    var gainNow = voice.amp.gain.value;
    if (!(gainNow > 0.001)) {
      voice.amp.gain.setValueAtTime(0.001, now);
      return;
    }

    voice.amp.gain.setValueAtTime(gainNow, now);
    voice.amp.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
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
    voice.amp.gain.cancelScheduledValues(now);

    voice.frequency.setValueAtTime(freq, now);
    voice.force.setValueAtTime(1, now);
    voice.velocity.setValueAtTime(0, now);
    voice.velocity.linearRampToValueAtTime(0.18, now + 0.08);
    voice.amp.gain.setValueAtTime(0, now);
    voice.amp.gain.linearRampToValueAtTime(0.22, now + 0.05);
  }

  window.resumeAudio = resume;

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

      var master = audioCtx.createGain();
      master.gain.setValueAtTime(1, audioCtx.currentTime);
      mixer.connect(bodyFilter);
      bodyFilter.connect(master);
      master.connect(audioCtx.destination);

      ready = true;
      flushPending();
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
