import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable } from "react-native";

type SettingsGearButtonProps = {
  onPress: () => void;
};

export default function SettingsGearButton({ onPress }: SettingsGearButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      onPress={onPress}
      className="h-11 w-11 items-center justify-center"
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
      hitSlop={8}
    >
      <MaterialIcons name="settings" size={24} color="#f4f6fa" />
    </Pressable>
  );
}
