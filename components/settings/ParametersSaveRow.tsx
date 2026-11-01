import SettingsSaveButton from "@/components/settings/SettingsSaveButton";
import { Text, View } from "react-native";

type ParametersSaveRowProps = {
  onSave: () => void;
  savedFlash?: boolean;
};

export default function ParametersSaveRow({
  onSave,
  savedFlash = false,
}: ParametersSaveRowProps) {
  return (
    <View className="flex-row items-center gap-3 border-b border-border/20 py-3">
      <Text
        className="flex-1 text-primary"
        style={{ fontSize: 16, fontWeight: "600" }}
        numberOfLines={1}
      >
        Parameters
      </Text>
      <SettingsSaveButton onPress={onSave} savedFlash={savedFlash} />
    </View>
  );
}
