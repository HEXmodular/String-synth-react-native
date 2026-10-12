import { Pressable, Text } from "react-native";

type ShiftButtonProps = {
  label: string;
  glyph: string;
  disabled: boolean;
  onPress: () => void;
};

export default function ShiftButton({
  label,
  glyph,
  disabled,
  onPress,
}: ShiftButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="flex-1 items-center justify-center border border-white/25 bg-white/10"
      style={({ pressed }) => ({
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 28, color: "#f4f6fa" }}>{glyph}</Text>
    </Pressable>
  );
}
