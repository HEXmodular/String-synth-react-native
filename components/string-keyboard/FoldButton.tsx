import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";

type FoldButtonProps = {
  expanded: boolean;
  onPress: () => void;
};

export default function FoldButton({ expanded, onPress }: FoldButtonProps) {
  const label = expanded ? "Collapse Keyboard" : "Expand Keyboard";
  const chevron = expanded ? "expand-more" : "expand-less";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      onPress={onPress}
      className="h-11 w-full flex-row items-center justify-center"
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View className="flex-row items-center gap-2">
        <MaterialIcons name="piano" size={20} color="#f4f6fa" />
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#f4f6fa" }}>
          Keyboard
        </Text>
        <MaterialIcons name={chevron} size={22} color="#f4f6fa" />
      </View>
    </Pressable>
  );
}
