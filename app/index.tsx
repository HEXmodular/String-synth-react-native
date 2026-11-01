import { useAudioEngine } from "@/audio/AudioEngineProvider";
import BowControls, {
  type BowControlsHandle,
} from "@/components/bow-controls/BowControls";
import SettingsGearButton from "@/components/settings/SettingsGearButton";
import StringKeyboard from "@/components/string-keyboard/StringKeyboard";
import { midiToFrequency } from "@/components/string-keyboard/notes";
import { useSynthSettings } from "@/synth/SynthSettingsProvider";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Index() {
  const router = useRouter();
  const { resume, noteOn, noteOff } = useAudioEngine();
  const { values, registerMidiNoteHandlers } = useSynthSettings();
  const [keyboardExpanded, setKeyboardExpanded] = useState(true);
  const [midiHeld, setMidiHeld] = useState<number[]>([]);
  const bowControlsRef = useRef<BowControlsHandle>(null);
  const insets = useSafeAreaInsets();

  const handleNoteOn = useCallback(
    (midi: number) => {
      if (Platform.OS !== "web") {
        resume();
      }
      bowControlsRef.current?.prepareNoteOn();
      noteOn(midi, midiToFrequency(midi));
    },
    [noteOn, resume],
  );

  const handleNoteOff = useCallback(
    (midi: number) => {
      noteOff(midi);
    },
    [noteOff],
  );

  const handleMidiNoteOn = useCallback(
    (midi: number) => {
      setMidiHeld((current) =>
        current.includes(midi) ? current : [...current, midi],
      );
      handleNoteOn(midi);
    },
    [handleNoteOn],
  );

  const handleMidiNoteOff = useCallback(
    (midi: number) => {
      setMidiHeld((current) => current.filter((held) => held !== midi));
      handleNoteOff(midi);
    },
    [handleNoteOff],
  );

  useEffect(() => {
    return registerMidiNoteHandlers({
      onNoteOn: handleMidiNoteOn,
      onNoteOff: handleMidiNoteOff,
    });
  }, [handleMidiNoteOff, handleMidiNoteOn, registerMidiNoteHandlers]);

  return (
    <View
      className="flex-1 bg-background"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: insets.top + 4,
          right: insets.right + 8,
          zIndex: 20,
        }}
      >
        <SettingsGearButton onPress={() => router.push("/settings")} />
      </View>

      <View style={keyboardExpanded ? { flex: 1, minHeight: 0 } : undefined}>
        <StringKeyboard
          voices={values.holdVoices}
          rowCount={values.keyboardRows}
          expanded={keyboardExpanded}
          onExpandedChange={setKeyboardExpanded}
          midiHeld={midiHeld}
          onNoteOn={(note) => handleNoteOn(note.midi)}
          onNoteOff={(note) => handleNoteOff(note.midi)}
        />
      </View>
      {!keyboardExpanded ? (
        <View style={{ flex: 1, minHeight: 0 }}>
          <BowControls ref={bowControlsRef} />
        </View>
      ) : null}
    </View>
  );
}
