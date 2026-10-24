import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

type VerticalFaderProps = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  /** When set, the label row becomes a toggle; independent of track `disabled`. */
  onLabelPress?: () => void;
  labelDisabled?: boolean;
  labelSelected?: boolean;
  onChange: (value: number) => void;
};

export default function VerticalFader({
  label,
  icon,
  value,
  min,
  max,
  disabled = false,
  onLabelPress,
  labelDisabled = false,
  labelSelected = false,
  onChange,
}: VerticalFaderProps) {
  const trackHeightRef = useRef(0);
  const [, setTrackHeight] = useState(0);
  const disabledRef = useRef(disabled);
  const onChangeRef = useRef(onChange);
  const minRef = useRef(min);
  const maxRef = useRef(max);

  disabledRef.current = disabled;
  onChangeRef.current = onChange;
  minRef.current = min;
  maxRef.current = max;

  const applyY = useCallback((y: number) => {
    if (disabledRef.current) {
      return;
    }

    const height = trackHeightRef.current;
    const currentMin = minRef.current;
    const currentMax = maxRef.current;
    if (!(height > 0) || currentMax <= currentMin) {
      return;
    }

    const ratio = 1 - Math.min(1, Math.max(0, y / height));
    const next = currentMin + ratio * (currentMax - currentMin);
    onChangeRef.current(
      Math.min(currentMax, Math.max(currentMin, next)),
    );
  }, []);

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.floor(event.nativeEvent.layout.height);
    trackHeightRef.current = height;
    setTrackHeight((current) => (current === height ? current : height));
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .maxPointers(1)
        .minDistance(0)
        .runOnJS(true)
        .onBegin((event) => {
          applyY(event.y);
        })
        .onUpdate((event) => {
          applyY(event.y);
        }),
    [applyY, disabled],
  );

  const span = max - min;
  const clamped = Math.min(max, Math.max(min, value));
  const fillRatio =
    span > 0 ? Math.min(1, Math.max(0, (clamped - min) / span)) : 0;
  const fadeContainer = onLabelPress ? labelDisabled : disabled;
  const fadeTrackOnly = Boolean(onLabelPress) && disabled && !labelDisabled;
  const accent = disabled ? "#f4f6fa55" : "#f4f6fa";
  const labelAccent = labelSelected ? "#081126" : "#f4f6fa";

  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        alignItems: "center",
        opacity: fadeContainer ? 0.35 : 1,
      }}
    >
      {/* Size box outside GestureDetector — RNGH host often drops flex on Android */}
      <View
        style={{ flex: 1, minHeight: 0, width: 80 }}
        onLayout={handleTrackLayout}
      >
        <GestureDetector gesture={pan}>
          <View
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            accessibilityValue={{
              min,
              max,
              now: clamped,
            }}
            collapsable={false}
            pointerEvents={disabled ? "none" : "auto"}
            style={{
              flex: 1,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: "#3a2830",
              opacity: fadeTrackOnly ? 0.35 : 1,
            }}
          >
            <View style={{ flex: 1 - fillRatio }} />
            <View
              pointerEvents="none"
              style={{
                flex: fillRatio,
                backgroundColor: "#ea7a53",
              }}
            />
          </View>
        </GestureDetector>
      </View>
      {onLabelPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: labelSelected, disabled: labelDisabled }}
          disabled={labelDisabled}
          onPress={onLabelPress}
          style={({ pressed }) => ({
            marginTop: 8,
            width: 80,
            alignItems: "center",
            borderRadius: 12,
            paddingHorizontal: 4,
            paddingVertical: 6,
            backgroundColor: labelSelected
              ? pressed && !labelDisabled
                ? "#d46d4a"
                : "#ea7a53"
              : pressed && !labelDisabled
                ? "#4a3840"
                : "#3a2830",
          })}
        >
          <MaterialIcons name={icon} size={18} color={labelAccent} />
          <Text
            style={{
              marginTop: 4,
              fontSize: 11,
              fontWeight: "700",
              color: labelAccent,
              textAlign: "center",
            }}
          >
            {label}
          </Text>
        </Pressable>
      ) : (
        <View style={{ marginTop: 8, alignItems: "center" }}>
          <MaterialIcons name={icon} size={18} color={accent} />
          <Text
            style={{
              marginTop: 4,
              fontSize: 11,
              fontWeight: "600",
              color: accent,
              textAlign: "center",
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </View>
  );
}
