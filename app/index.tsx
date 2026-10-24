import { useAudioEngine } from "@/audio/AudioEngineProvider";
import BowControls, {
  type BowControlsHandle,
} from "@/components/bow-controls/BowControls";
import StringKeyboard from "@/components/string-keyboard/StringKeyboard";
import { useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";

export default function Index() {
  const { resume, noteOn, noteOff } = useAudioEngine();
  const [keyboardExpanded, setKeyboardExpanded] = useState(true);
  const bowControlsRef = useRef<BowControlsHandle>(null);

  return (
    <View className="flex-1 bg-background">
      <StringKeyboard
        voices={4}
        expanded={keyboardExpanded}
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
      <View style={{ flex: 1, minHeight: 0 }}>
        {keyboardExpanded ? (
          <Pressable
            accessibilityLabel="Dismiss Keyboard"
            accessibilityRole="button"
            onPress={() => setKeyboardExpanded(false)}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          />
        ) : null}
        <View
          style={{
            flex: 1,
            minHeight: 0,
            pointerEvents: keyboardExpanded ? "none" : "auto",
          }}
        >
          <BowControls ref={bowControlsRef} disabled={keyboardExpanded} />
        </View>
      </View>
    </View>
  );
}
