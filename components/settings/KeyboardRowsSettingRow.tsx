import { Pressable, Text, View } from "react-native";

type KeyboardRowsSettingRowProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

export default function KeyboardRowsSettingRow({
  value,
  min,
  max,
  onChange,
}: KeyboardRowsSettingRowProps) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <View className="flex-row items-center gap-3 border-b border-border/20 py-3">
      <Text
        className="flex-1 text-primary"
        style={{ fontSize: 16, fontWeight: "600" }}
        numberOfLines={1}
      >
        Keyboard Rows
      </Text>

      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease keyboard rows"
          disabled={!canDecrease}
          onPress={() => onChange(value - 1)}
          className="h-9 w-9 items-center justify-center rounded-md"
          style={({ pressed }) => ({
            opacity: !canDecrease ? 0.35 : pressed ? 0.7 : 1,
            backgroundColor: "rgba(234, 122, 83, 0.25)",
          })}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#ea7a53" }}>
            −
          </Text>
        </Pressable>

        <Text
          className="text-primary"
          style={{
            fontSize: 16,
            fontWeight: "700",
            minWidth: 28,
            textAlign: "center",
          }}
        >
          {value}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase keyboard rows"
          disabled={!canIncrease}
          onPress={() => onChange(value + 1)}
          className="h-9 w-9 items-center justify-center rounded-md"
          style={({ pressed }) => ({
            opacity: !canIncrease ? 0.35 : pressed ? 0.7 : 1,
            backgroundColor: "rgba(234, 122, 83, 0.25)",
          })}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#ea7a53" }}>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
