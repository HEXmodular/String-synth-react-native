import { useCpuLoad } from "@/audio/AudioEngineProvider";
import { Text } from "react-native";

export default function CpuLoadIndicator() {
  const cpuLoad = useCpuLoad();
  const percent = Math.round(Math.max(0, cpuLoad) * 100);
  const color =
    percent >= 90 ? "#dc2626" : percent >= 70 ? "#ea7a53" : "#f4f6fa";

  return (
    <Text
      accessibilityLabel={`CPU load ${percent} percent`}
      className="font-sans-medium text-xs"
      style={{ color, opacity: 0.85 }}
    >
      CPU {percent}%
    </Text>
  );
}
