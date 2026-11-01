import { Pressable, Text } from "react-native";

type SettingsSaveButtonProps = {
  onPress: () => void;
  savedFlash?: boolean;
};

export default function SettingsSaveButton({
  onPress,
  savedFlash = false,
}: SettingsSaveButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Save current parameter values as defaults"
      onPress={onPress}
      className="items-center justify-center rounded-md px-3 py-1.5"
      style={({ pressed }) => ({
        opacity: pressed ? 0.75 : 1,
        backgroundColor: savedFlash ? "#16a34a" : "#ea7a53",
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: "700", color: "#081126" }}>
        {savedFlash ? "SAVED" : "SAVE"}
      </Text>
    </Pressable>
  );
}
