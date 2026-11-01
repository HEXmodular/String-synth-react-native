import ParameterLearnRow from "@/components/settings/ParameterLearnRow";
import ParametersSaveRow from "@/components/settings/ParametersSaveRow";
import { CONTINUOUS_PARAMS } from "@/synth/parameters";
import { useSynthSettings } from "@/synth/SynthSettingsProvider";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    values,
    ccMappings,
    learningParamId,
    startLearn,
    cancelLearn,
    saveCurrentAsDefaults,
  } = useSynthSettings();
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    return () => {
      cancelLearn();
    };
  }, [cancelLearn]);

  const handleSave = useCallback(async () => {
    await saveCurrentAsDefaults();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }, [saveCurrentAsDefaults]);

  return (
    <View
      className="flex-1 bg-background"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={24} color="#f4f6fa" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      >
        <ParametersSaveRow
          onSave={() => void handleSave()}
          savedFlash={savedFlash}
        />
        {CONTINUOUS_PARAMS.map((param) => {
          const label =
            param.id === "chorusRate" && values.chorusNoiseMod
              ? "Noise"
              : param.label;
          return (
            <ParameterLearnRow
              key={param.id}
              label={label}
              paramId={param.id}
              mappedCc={ccMappings[param.id]}
              learning={learningParamId === param.id}
              onLearn={startLearn}
              onCancelLearn={cancelLearn}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
