import { Text, View } from "react-native";

export default function MidiParametersSectionHeader() {
  return (
    <View className="pt-5 pb-2">
      <Text
        className="text-primary"
        style={{ fontSize: 13, fontWeight: "700", letterSpacing: 0.6 }}
      >
        MIDI Parameters
      </Text>
    </View>
  );
}
