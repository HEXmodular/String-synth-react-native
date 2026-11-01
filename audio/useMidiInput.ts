import { requireOptionalNativeModule } from "expo-modules-core";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import type {
  MIDIAccess,
  MIDIInput,
  MIDIMessageEvent,
} from "react-native-midi-api";

type MidiNoteHandlers = {
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
  onControlChange?: (controller: number, value: number) => void;
};

type UseMidiInputOptions = MidiNoteHandlers & {
  enabled?: boolean;
};

type RequestMIDIAccess = (options?: {
  sysex?: boolean;
}) => Promise<MIDIAccess>;

function isNoteOn(status: number, velocity: number) {
  return (status & 0xf0) === 0x90 && velocity > 0;
}

function isNoteOff(status: number, velocity: number) {
  const command = status & 0xf0;
  return command === 0x80 || (command === 0x90 && velocity === 0);
}

function isControlChange(status: number) {
  return (status & 0xf0) === 0xb0;
}

function attachInput(
  input: MIDIInput,
  handlersRef: { current: MidiNoteHandlers },
  heldRef: { current: Set<number> },
) {
  input.onmidimessage = (event: MIDIMessageEvent) => {
    const data = event.data;
    if (!data || data.length < 2) {
      return;
    }

    const status = data[0] ?? 0;
    const data1 = data[1] ?? 0;
    const data2 = data[2] ?? 0;

    if (isControlChange(status)) {
      if (data1 > 127) {
        return;
      }
      handlersRef.current.onControlChange?.(data1, data2);
      return;
    }

    if (data1 > 127) {
      return;
    }

    if (isNoteOn(status, data2)) {
      heldRef.current.add(data1);
      handlersRef.current.onNoteOn(data1);
      return;
    }

    if (isNoteOff(status, data2)) {
      heldRef.current.delete(data1);
      handlersRef.current.onNoteOff(data1);
    }
  };
}

function detachInput(input: MIDIInput) {
  input.onmidimessage = null;
}

async function loadRequestMIDIAccess(): Promise<RequestMIDIAccess | null> {
  if (Platform.OS === "web") {
    const webMidi = (
      globalThis as typeof globalThis & {
        navigator?: {
          requestMIDIAccess?: RequestMIDIAccess;
        };
      }
    ).navigator?.requestMIDIAccess;
    if (typeof webMidi === "function") {
      return webMidi.bind(
        (globalThis as typeof globalThis & { navigator: Navigator }).navigator,
      );
    }
    return null;
  }

  // Static import of react-native-midi-api throws without a rebuilt native binary.
  if (!requireOptionalNativeModule("ReactNativeMidiApi")) {
    return null;
  }

  const { requestMIDIAccess } = await import("react-native-midi-api");
  return requestMIDIAccess;
}

/**
 * Listens to USB/Web MIDI inputs and forwards Note On/Off / CC to the synth.
 * On iOS/Android requires a native/dev-client rebuild that includes react-native-midi-api.
 */
export function useMidiInput({
  enabled = true,
  onNoteOn,
  onNoteOff,
  onControlChange,
}: UseMidiInputOptions) {
  const handlersRef = useRef({ onNoteOn, onNoteOff, onControlChange });
  handlersRef.current = { onNoteOn, onNoteOff, onControlChange };

  const heldRef = useRef(new Set<number>());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let access: MIDIAccess | null = null;
    const attached = new Map<string, MIDIInput>();

    const releaseHeld = () => {
      for (const midi of heldRef.current) {
        handlersRef.current.onNoteOff(midi);
      }
      heldRef.current.clear();
    };

    const syncInputs = (midiAccess: MIDIAccess) => {
      const nextIds = new Set<string>();
      for (const input of midiAccess.inputs.values()) {
        nextIds.add(input.id);
        if (attached.has(input.id)) {
          continue;
        }
        attachInput(input, handlersRef, heldRef);
        attached.set(input.id, input);
      }

      for (const [id, input] of attached) {
        if (nextIds.has(id)) {
          continue;
        }
        detachInput(input);
        attached.delete(id);
      }
    };

    void (async () => {
      try {
        const requestMIDIAccess = await loadRequestMIDIAccess();
        if (!requestMIDIAccess || cancelled) {
          if (__DEV__ && !requestMIDIAccess && Platform.OS !== "web") {
            console.warn(
              "[midi] Native module missing — rebuild the dev client to enable MIDI.",
            );
          }
          return;
        }

        const midiAccess = await requestMIDIAccess({ sysex: false });
        if (cancelled) {
          return;
        }

        access = midiAccess;
        syncInputs(midiAccess);
        midiAccess.onstatechange = () => {
          if (!access) {
            return;
          }
          syncInputs(access);
        };
      } catch (error) {
        if (__DEV__) {
          console.warn("[midi]", error);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (access) {
        access.onstatechange = null;
      }
      for (const input of attached.values()) {
        detachInput(input);
      }
      attached.clear();
      releaseHeld();
    };
  }, [enabled]);
}
