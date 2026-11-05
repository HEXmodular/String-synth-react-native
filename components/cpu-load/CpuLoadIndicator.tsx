import { useCpuLoad } from "@/audio/AudioEngineProvider";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";

export default function CpuLoadIndicator() {
  const cpuLoad = useCpuLoad();
  const percent = Math.round(Math.max(0, cpuLoad) * 100);
  const color =
    percent >= 90 ? "#dc2626" : percent >= 70 ? "#ea7a53" : "#f4f6fa";

  return (
    <View
      accessibilityLabel={`CPU load ${percent} percent`}
      className="flex-row items-center gap-1"
      style={{ opacity: 0.85 }}
    >
      <MaterialIcons name="memory" size={18} color={color} />
      <Text className="font-sans-medium text-xs" style={{ color }}>
        {percent}%
      </Text>
    </View>
  );
}
