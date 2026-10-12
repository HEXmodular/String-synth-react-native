import { useAudioEngine } from "@/audio/AudioEngineProvider";
import StringKeyboard from "@/components/string-keyboard/StringKeyboard";
import { View } from "react-native";

export default function Index() {
  const { noteOn, noteOff } = useAudioEngine();

  return (
    <View className="flex-1 justify-center bg-background">
      <StringKeyboard
        voices={4}
        onNoteOn={(note) => noteOn(note.midi, note.frequency)}
        onNoteOff={(note) => noteOff(note.midi)}
      />
    </View>
  );
}
