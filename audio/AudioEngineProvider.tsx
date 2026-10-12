import { createEngineHtml, createEngineScript } from "@/audio/engineHtml";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";

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
};

type AudioEngineValue = {
  resume: () => void;
  bowNote: (frequency: number, duration: number) => void;
  noteOn: (noteId: number, frequency: number) => void;
  noteOff: (noteId: number) => void;
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
  const webViewRef = useRef<WebView>(null);
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

  const handleLoadEnd = useCallback(() => {
    readyRef.current = true;
    flushNotes();
  }, [flushNotes]);

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
    () => ({ resume, bowNote, noteOn, noteOff }),
    [resume, bowNote, noteOn, noteOff],
  );

  return (
    <AudioEngineContext.Provider value={value}>
      <View className="flex-1">
        {Platform.OS === "web" ? null : (
          <View
            className="absolute h-px w-px overflow-hidden opacity-0"
            collapsable={false}
            pointerEvents="none"
          >
            <WebView
              ref={webViewRef}
              style={{ width: 1, height: 1 }}
              originWhitelist={["*"]}
              source={{ html: ENGINE_HTML }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              onLoadEnd={handleLoadEnd}
            />
          </View>
        )}
        {children}
      </View>
    </AudioEngineContext.Provider>
  );
}
