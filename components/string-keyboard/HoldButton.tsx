import { Pressable, Text } from "react-native";

type HoldButtonProps = {
  active: boolean;
  onPress: () => void;
};

export default function HoldButton({ active, onPress }: HoldButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hold notes"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-1 items-center justify-center border border-white/25 ${
        active ? "bg-accent" : "bg-white/10"
      }`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: active ? "#081126" : "#f4f6fa",
        }}
      >
        H
      </Text>
    </Pressable>
  );
}
