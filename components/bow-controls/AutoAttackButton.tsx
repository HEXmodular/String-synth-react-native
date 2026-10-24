import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";

type AutoAttackButtonProps = {
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export default function AutoAttackButton({
  active,
  disabled = false,
  onPress,
}: AutoAttackButtonProps) {
  const accent = disabled ? "#f4f6fa55" : active ? "#081126" : "#f4f6fa";

  return (
    <View
      className="min-h-0 items-center"
      style={{ opacity: disabled ? 0.35 : 1, width: 56 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Automatic attack"
        accessibilityState={{ selected: active, disabled }}
        disabled={disabled}
        onPress={onPress}
        className={`min-h-0 w-full flex-1 items-center justify-center rounded-2xl border border-white/25 ${
          active ? "bg-accent" : "bg-white/10"
        }`}
        style={({ pressed }) => ({
          opacity: disabled ? 1 : pressed ? 0.7 : 1,
        })}
      >
        <View className="items-center gap-2">
          <MaterialIcons name="auto-mode" size={22} color={accent} />
          <Text
            className="text-center"
            style={{ fontSize: 11, fontWeight: "700", color: accent }}
          >
            Auto
          </Text>
        </View>
      </Pressable>
      {/* Spacer matching VerticalFader label block height */}
      <View className="mt-2 items-center gap-1 opacity-0" pointerEvents="none">
        <MaterialIcons name="auto-mode" size={18} color={accent} />
        <Text style={{ fontSize: 11, fontWeight: "600", color: accent }}>
          Auto
        </Text>
      </View>
    </View>
  );
}
