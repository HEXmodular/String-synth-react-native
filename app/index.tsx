import { useAudioEngine } from "@/audio/AudioEngineProvider";
import BowControls, {
  type BowControlsHandle,
} from "@/components/bow-controls/BowControls";
import StringKeyboard from "@/components/string-keyboard/StringKeyboard";
import { useRef, useState } from "react";
import { Platform, View } from "react-native";

export default function Index() {
  const { resume, noteOn, noteOff } = useAudioEngine();
  const [keyboardExpanded, setKeyboardExpanded] = useState(true);
  const bowControlsRef = useRef<BowControlsHandle>(null);

  return (
    <View className="flex-1 bg-background">
      <StringKeyboard
        voices={4}
        onExpandedChange={setKeyboardExpanded}
        onNoteOn={(note) => {
          if (Platform.OS !== "web") {
            resume();
          }
          bowControlsRef.current?.prepareNoteOn();
          noteOn(note.midi, note.frequency);
        }}
        onNoteOff={(note) => noteOff(note.midi)}
      />
      <View className="min-h-0 flex-1">
        <BowControls ref={bowControlsRef} disabled={keyboardExpanded} />
      </View>
    </View>
  );
}
