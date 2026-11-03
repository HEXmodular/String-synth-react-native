import { createEngineHtml, createEngineScript } from "@/audio/engineHtml";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from "react";
import { Platform, View } from "react-native";
import {
  WebView as NativeWebView,
  type WebViewMessageEvent,
  type WebViewProps,
} from "react-native-webview";

/** react-native-webview@14.0.1 defaults the class generic to `undefined`, collapsing props to `never`. */
type WebViewHandle = {
  injectJavaScript: (script: string) => void;
};

const WebView = NativeWebView as unknown as ComponentType<
  WebViewProps & { ref?: RefObject<WebViewHandle | null> }
>;

const ENGINE_HTML = createEngineHtml();

type BowNoteCall = {
  frequency: number;
  duration: number;
};

type EngineHost = Window & {
  resumeAudio?: () => void;
  bowNote?: (frequency: number, duration: number) => void;
  noteOn?: (noteId: number, frequency: number) => void;
  noteOff?: (noteId: number) => void;
  setBowVelocity?: (value: number) => void;
  setBowForce?: (value: number) => void;
  setVibratoIntensity?: (value: number) => void;
  setVibratoRate?: (value: number) => void;
  setBowVelocityAttack?: (value: number) => void;
  setBowVelocityRelease?: (value: number) => void;
  setMasterVolume?: (value: number) => void;
  setChorusLevel?: (value: number) => void;
  setChorusRate?: (value: number) => void;
  setChorusNoiseMod?: (enabled: number) => void;
  setChorusDepth?: (value: number) => void;
  setChorusDelay?: (value: number) => void;
  setDelayTime?: (value: number) => void;
  setDelayFeedback?: (value: number) => void;
  setDelayLevel?: (value: number) => void;
  setPredelay?: (value: number) => void;
  setReverbLevel?: (value: number) => void;
};

type AudioEngineValue = {
  resume: () => void;
  bowNote: (frequency: number, duration: number) => void;
  noteOn: (noteId: number, frequency: number) => void;
  noteOff: (noteId: number) => void;
  setBowVelocity: (value: number) => void;
  setBowForce: (value: number) => void;
  setVibratoIntensity: (value: number) => void;
  setVibratoRate: (value: number) => void;
  setBowVelocityAttack: (value: number) => void;
  setBowVelocityRelease: (value: number) => void;
  setMasterVolume: (value: number) => void;
  setChorusLevel: (value: number) => void;
  setChorusRate: (value: number) => void;
  setChorusNoiseMod: (enabled: boolean) => void;
  setChorusDepth: (value: number) => void;
  setChorusDelay: (value: number) => void;
  setDelayTime: (value: number) => void;
  setDelayFeedback: (value: number) => void;
  setDelayLevel: (value: number) => void;
  setPredelay: (value: number) => void;
  setReverbLevel: (value: number) => void;
};

const AudioEngineContext = createContext<AudioEngineValue | null>(null);

let webEngineInstalled = false;

function webEngine() {
  return window as EngineHost;
}

function ensureWebEngine() {
  if (webEngineInstalled || typeof document === "undefined") {
    return;
  }

  webEngineInstalled = true;
  const script = document.createElement("script");
  script.textContent = createEngineScript();
  document.head.appendChild(script);
}

function noteCall(frequency: number, duration: number): BowNoteCall {
  return {
    frequency: Number.isFinite(frequency) ? frequency : 293.66,
    duration: Number.isFinite(duration) ? duration : 1.5,
  };
}

function finiteNumber(value: number): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export function useAudioEngine() {
  const value = useContext(AudioEngineContext);
  if (!value) {
    throw new Error("useAudioEngine must be used within AudioEngineProvider");
  }

  return value;
}

type AudioEngineProviderProps = {
  children: ReactNode;
};

export default function AudioEngineProvider({
  children,
}: AudioEngineProviderProps) {
  const webViewRef = useRef<WebViewHandle>(null);
  const readyRef = useRef(false);
  const notesRef = useRef<BowNoteCall[]>([]);
  const heldRef = useRef(new Map<number, number>());

  const publishNote = useCallback((frequency: number, duration: number) => {
    if (Platform.OS === "web") {
      webEngine().bowNote?.(frequency, duration);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.bowNote(${frequency}, ${duration}); true;`,
    );
  }, []);

  const publishNoteOn = useCallback((noteId: number, frequency: number) => {
    if (Platform.OS === "web") {
      webEngine().noteOn?.(noteId, frequency);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.noteOn(${noteId}, ${frequency}); true;`,
    );
  }, []);

  const publishNoteOff = useCallback((noteId: number) => {
    if (Platform.OS === "web") {
      webEngine().noteOff?.(noteId);
      return;
    }

    webViewRef.current?.injectJavaScript(`window.noteOff(${noteId}); true;`);
  }, []);

  const publishBowVelocity = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setBowVelocity?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setBowVelocity(${value}); true;`,
    );
  }, []);

  const publishBowForce = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setBowForce?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(`window.setBowForce(${value}); true;`);
  }, []);

  const publishVibratoIntensity = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setVibratoIntensity?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setVibratoIntensity(${value}); true;`,
    );
  }, []);

  const publishVibratoRate = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setVibratoRate?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setVibratoRate(${value}); true;`,
    );
  }, []);

  const publishBowVelocityAttack = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setBowVelocityAttack?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setBowVelocityAttack(${value}); true;`,
    );
  }, []);

  const publishBowVelocityRelease = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setBowVelocityRelease?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setBowVelocityRelease(${value}); true;`,
    );
  }, []);

  const publishMasterVolume = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setMasterVolume?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setMasterVolume(${value}); true;`,
    );
  }, []);

  const publishChorusLevel = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setChorusLevel?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setChorusLevel(${value}); true;`,
    );
  }, []);

  const publishChorusRate = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setChorusRate?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setChorusRate(${value}); true;`,
    );
  }, []);

  const publishChorusNoiseMod = useCallback((enabled: boolean) => {
    const flag = enabled ? 1 : 0;
    if (Platform.OS === "web") {
      webEngine().setChorusNoiseMod?.(flag);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setChorusNoiseMod(${flag}); true;`,
    );
  }, []);

  const publishChorusDepth = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setChorusDepth?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setChorusDepth(${value}); true;`,
    );
  }, []);

  const publishChorusDelay = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setChorusDelay?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setChorusDelay(${value}); true;`,
    );
  }, []);

  const publishDelayTime = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setDelayTime?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setDelayTime(${value}); true;`,
    );
  }, []);

  const publishDelayFeedback = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setDelayFeedback?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setDelayFeedback(${value}); true;`,
    );
  }, []);

  const publishDelayLevel = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setDelayLevel?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setDelayLevel(${value}); true;`,
    );
  }, []);

  const publishPredelay = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setPredelay?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(`window.setPredelay(${value}); true;`);
  }, []);

  const publishReverbLevel = useCallback((value: number) => {
    if (Platform.OS === "web") {
      webEngine().setReverbLevel?.(value);
      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.setReverbLevel(${value}); true;`,
    );
  }, []);

  const resume = useCallback(() => {
    if (Platform.OS === "web") {
      webEngine().resumeAudio?.();
      return;
    }

    webViewRef.current?.injectJavaScript("window.resumeAudio(); true;");
  }, []);

  const bowNote = useCallback(
    (frequency: number, duration: number) => {
      const note = noteCall(frequency, duration);
      if (!readyRef.current) {
        notesRef.current.push(note);
        return;
      }

      publishNote(note.frequency, note.duration);
    },
    [publishNote],
  );

  const noteOn = useCallback(
    (noteId: number, frequency: number) => {
      const id = finiteNumber(noteId);
      const freq = finiteNumber(frequency);
      if (id == null || freq == null) {
        return;
      }

      const midi = Math.round(id);
      if (!readyRef.current) {
        heldRef.current.set(midi, freq);
        return;
      }

      publishNoteOn(midi, freq);
    },
    [publishNoteOn],
  );

  const noteOff = useCallback(
    (noteId: number) => {
      const id = finiteNumber(noteId);
      if (id == null) {
        return;
      }

      const midi = Math.round(id);
      if (!readyRef.current) {
        heldRef.current.delete(midi);
        return;
      }

      publishNoteOff(midi);
    },
    [publishNoteOff],
  );

  const setBowVelocity = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishBowVelocity(next);
    },
    [publishBowVelocity],
  );

  const setBowForce = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishBowForce(next);
    },
    [publishBowForce],
  );

  const setVibratoIntensity = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishVibratoIntensity(next);
    },
    [publishVibratoIntensity],
  );

  const setVibratoRate = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishVibratoRate(next);
    },
    [publishVibratoRate],
  );

  const setBowVelocityAttack = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishBowVelocityAttack(next);
    },
    [publishBowVelocityAttack],
  );

  const setBowVelocityRelease = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishBowVelocityRelease(next);
    },
    [publishBowVelocityRelease],
  );

  const setMasterVolume = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishMasterVolume(next);
    },
    [publishMasterVolume],
  );

  const setChorusLevel = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishChorusLevel(next);
    },
    [publishChorusLevel],
  );

  const setChorusRate = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishChorusRate(next);
    },
    [publishChorusRate],
  );

  const setChorusNoiseMod = useCallback(
    (enabled: boolean) => {
      publishChorusNoiseMod(Boolean(enabled));
    },
    [publishChorusNoiseMod],
  );

  const setChorusDepth = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishChorusDepth(next);
    },
    [publishChorusDepth],
  );

  const setChorusDelay = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishChorusDelay(next);
    },
    [publishChorusDelay],
  );

  const setDelayTime = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishDelayTime(next);
    },
    [publishDelayTime],
  );

  const setDelayFeedback = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishDelayFeedback(next);
    },
    [publishDelayFeedback],
  );

  const setDelayLevel = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishDelayLevel(next);
    },
    [publishDelayLevel],
  );

  const setPredelay = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishPredelay(next);
    },
    [publishPredelay],
  );

  const setReverbLevel = useCallback(
    (value: number) => {
      const next = finiteNumber(value);
      if (next == null) {
        return;
      }

      publishReverbLevel(next);
    },
    [publishReverbLevel],
  );

  const flushNotes = useCallback(() => {
    const notes = notesRef.current.splice(0);
    const held = Array.from(heldRef.current.entries());
    heldRef.current.clear();
    const note = notes[notes.length - 1];
    if (!note && held.length === 0) {
      resume();
      return;
    }

    if (note) {
      publishNote(note.frequency, note.duration);
    }
    for (const [noteId, frequency] of held) {
      publishNoteOn(noteId, frequency);
    }
  }, [publishNote, publishNoteOn, resume]);

  const markEngineReady = useCallback(() => {
    if (readyRef.current) {
      resume();
      return;
    }

    readyRef.current = true;
    flushNotes();
  }, [flushNotes, resume]);

  const handleLoadEnd = useCallback(() => {
    markEngineReady();
  }, [markEngineReady]);

  const handleEngineMessage = useCallback(
    (payload: string) => {
      try {
        const message = JSON.parse(payload) as {
          type?: string;
          message?: string;
        };
        if (message.type === "ready") {
          markEngineReady();
          return;
        }
        if (message.type === "error" && __DEV__) {
          console.warn("[audio-engine]", message.message ?? "init failed");
        }
      } catch {
        // Ignore non-JSON WebView messages.
      }
    },
    [markEngineReady],
  );

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    ensureWebEngine();
    readyRef.current = true;
    flushNotes();

    const unlock = () => {
      webEngine().resumeAudio?.();
    };
    window.addEventListener("pointerdown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
    };
  }, [flushNotes]);

  const value = useMemo(
    () => ({
      resume,
      bowNote,
      noteOn,
      noteOff,
      setBowVelocity,
      setBowForce,
      setVibratoIntensity,
      setVibratoRate,
      setBowVelocityAttack,
      setBowVelocityRelease,
      setMasterVolume,
      setChorusLevel,
      setChorusRate,
      setChorusNoiseMod,
      setChorusDepth,
      setChorusDelay,
      setDelayTime,
      setDelayFeedback,
      setDelayLevel,
      setPredelay,
      setReverbLevel,
    }),
    [
      resume,
      bowNote,
      noteOn,
      noteOff,
      setBowVelocity,
      setBowForce,
      setVibratoIntensity,
      setVibratoRate,
      setBowVelocityAttack,
      setBowVelocityRelease,
      setMasterVolume,
      setChorusLevel,
      setChorusRate,
      setChorusNoiseMod,
      setChorusDepth,
      setChorusDelay,
      setDelayTime,
      setDelayFeedback,
      setDelayLevel,
      setPredelay,
      setReverbLevel,
    ],
  );

  return (
    <AudioEngineContext.Provider value={value}>
      <View className="flex-1">
        {Platform.OS === "web" ? null : (
          <View
            className="absolute h-px w-px overflow-hidden opacity-0"
            collapsable={false}
            style={{ pointerEvents: "none" }}
          >
            <WebView
              ref={webViewRef}
              style={{ width: 1, height: 1 }}
              originWhitelist={["*"]}
              source={{ html: ENGINE_HTML, baseUrl: "https://localhost/" }}
              javaScriptEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              onLoadEnd={handleLoadEnd}
              onMessage={(event: WebViewMessageEvent) =>
                handleEngineMessage(event.nativeEvent.data)
              }
            />
          </View>
        )}
        {children}
      </View>
    </AudioEngineContext.Provider>
  );
}
