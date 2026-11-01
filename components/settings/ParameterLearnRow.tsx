import type { ContinuousParamId } from "@/synth/parameters";
import { Pressable, Text, View } from "react-native";

type ParameterLearnRowProps = {
  label: string;
  paramId: ContinuousParamId;
  mappedCc: number | undefined;
  learning: boolean;
  onLearn: (paramId: ContinuousParamId) => void;
  onCancelLearn: () => void;
};

export default function ParameterLearnRow({
  label,
  paramId,
  mappedCc,
  learning,
  onLearn,
  onCancelLearn,
}: ParameterLearnRowProps) {
  const ccLabel =
    mappedCc == null ? "—" : `CC ${String(mappedCc).padStart(2, "0")}`;

  return (
    <View className="flex-row items-center gap-3 border-b border-border/20 py-3">
      <Text
        className="flex-1 text-primary"
        style={{ fontSize: 16, fontWeight: "600" }}
        numberOfLines={1}
      >
        {label}
      </Text>

      <Text
        className="text-primary/70"
        style={{ fontSize: 14, fontWeight: "500", minWidth: 56 }}
      >
        {learning ? "..." : ccLabel}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          learning ? `Cancel learning ${label}` : `Learn MIDI CC for ${label}`
        }
        onPress={() => (learning ? onCancelLearn() : onLearn(paramId))}
        className="rounded-md px-3 py-1.5"
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          backgroundColor: learning ? "#ea7a53" : "rgba(234, 122, 83, 0.25)",
        })}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: learning ? "#081126" : "#ea7a53",
          }}
        >
          {learning ? "WAIT" : "LEARN"}
        </Text>
      </Pressable>
    </View>
  );
}
