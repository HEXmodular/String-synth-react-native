import HoldVoicesSettingRow from "@/components/settings/HoldVoicesSettingRow";
import KeyboardRowsSettingRow from "@/components/settings/KeyboardRowsSettingRow";
import MidiParametersSectionHeader from "@/components/settings/MidiParametersSectionHeader";
import ParameterLearnRow from "@/components/settings/ParameterLearnRow";
import ParametersSaveRow from "@/components/settings/ParametersSaveRow";
import {
  CONTINUOUS_PARAMS,
  HOLD_VOICES_MAX,
  HOLD_VOICES_MIN,
  KEYBOARD_ROWS_MAX,
  KEYBOARD_ROWS_MIN,
  clamp,
} from "@/synth/parameters";
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
    setParam,
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

  const handleKeyboardRowsChange = useCallback(
    (next: number) => {
      setParam(
        "keyboardRows",
        Math.round(clamp(next, KEYBOARD_ROWS_MIN, KEYBOARD_ROWS_MAX)),
      );
    },
    [setParam],
  );

  const handleHoldVoicesChange = useCallback(
    (next: number) => {
      setParam(
        "holdVoices",
        Math.round(clamp(next, HOLD_VOICES_MIN, HOLD_VOICES_MAX)),
      );
    },
    [setParam],
  );

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
        <KeyboardRowsSettingRow
          value={values.keyboardRows}
          min={KEYBOARD_ROWS_MIN}
          max={KEYBOARD_ROWS_MAX}
          onChange={handleKeyboardRowsChange}
        />
        <HoldVoicesSettingRow
          value={values.holdVoices}
          min={HOLD_VOICES_MIN}
          max={HOLD_VOICES_MAX}
          onChange={handleHoldVoicesChange}
        />
        <MidiParametersSectionHeader />
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
