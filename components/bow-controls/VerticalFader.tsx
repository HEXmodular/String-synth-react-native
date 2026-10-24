import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useMemo, useRef, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

type VerticalFaderProps = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export default function VerticalFader({
  label,
  icon,
  value,
  min,
  max,
  disabled = false,
  onChange,
}: VerticalFaderProps) {
  const trackHeightRef = useRef(0);
  const [trackHeight, setTrackHeight] = useState(0);
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
  const fillHeight = Math.round(trackHeight * fillRatio);
  const accent = disabled ? "#f4f6fa55" : "#f4f6fa";

  return (
    <View
      className="min-h-0 flex-1 items-center"
      style={{ opacity: disabled ? 0.35 : 1 }}
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
          className="min-h-0 w-20 flex-1 touch-none overflow-hidden rounded-2xl border border-white/25 bg-white/10"
          onLayout={handleTrackLayout}
        >
          <View
            pointerEvents="none"
            className="absolute bottom-0 left-0 right-0 bg-accent"
            style={{ height: fillHeight }}
          />
        </View>
      </GestureDetector>
      <View className="mt-2 items-center gap-1">
        <MaterialIcons name={icon} size={18} color={accent} />
        <Text
          className="text-center"
          style={{ fontSize: 11, fontWeight: "600", color: accent }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
