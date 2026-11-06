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
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        backgroundColor: active
          ? pressed
            ? "#d46d4a"
            : "#ea7a53"
          : pressed
            ? "#9eb0d0"
            : "#b4c6e3",
      })}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: "#081126",
        }}
      >
        H
      </Text>
    </Pressable>
  );
}
