import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useRef, useState } from "react";
import {
  Platform,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PointerEvent,
} from "react-native";

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
  const draggingRef = useRef(false);

  const clampValue = useCallback(
    (next: number) => Math.min(max, Math.max(min, next)),
    [max, min],
  );

  const valueFromY = useCallback(
    (y: number) => {
      const height = trackHeightRef.current;
      if (!(height > 0) || max <= min) {
        return clampValue(value);
      }

      const ratio = 1 - Math.min(1, Math.max(0, y / height));
      return clampValue(min + ratio * (max - min));
    },
    [clampValue, max, min, value],
  );

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.floor(event.nativeEvent.layout.height);
    trackHeightRef.current = height;
    setTrackHeight((current) => (current === height ? current : height));
  }, []);

  const applyY = useCallback(
    (y: number) => {
      if (disabled) {
        return;
      }
      onChange(valueFromY(y));
    },
    [disabled, onChange, valueFromY],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (disabled) {
        return;
      }

      const { button, pointerType, pointerId, offsetY } = event.nativeEvent;
      if (pointerType === "mouse" && button !== 0) {
        return;
      }

      event.preventDefault();
      draggingRef.current = true;
      if (typeof event.currentTarget.setPointerCapture === "function") {
        try {
          event.currentTarget.setPointerCapture(pointerId);
        } catch {
          // Still update while the pointer stays over the track.
        }
      }
      applyY(offsetY);
    },
    [applyY, disabled],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (disabled || !draggingRef.current) {
        return;
      }

      applyY(event.nativeEvent.offsetY);
    },
    [applyY, disabled],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const syncTouch = useCallback(
    (event: GestureResponderEvent) => {
      if (disabled) {
        return;
      }
      const touch = event.nativeEvent.touches?.[0] ?? event.nativeEvent;
      if (!Number.isFinite(touch.locationY)) {
        return;
      }
      applyY(touch.locationY);
    },
    [applyY, disabled],
  );

  const span = max - min;
  const fillRatio =
    span > 0 ? Math.min(1, Math.max(0, (clampValue(value) - min) / span)) : 0;
  const fillHeight = Math.round(trackHeight * fillRatio);
  const accent = disabled ? "#f4f6fa55" : "#f4f6fa";

  const trackTouchProps =
    disabled
      ? {}
      : Platform.OS === "android"
        ? {
            onStartShouldSetResponder: () => true,
            onMoveShouldSetResponder: () => true,
            onResponderTerminationRequest: () => false,
            onResponderGrant: syncTouch,
            onResponderMove: syncTouch,
            onResponderRelease: () => {
              draggingRef.current = false;
            },
            onResponderTerminate: () => {
              draggingRef.current = false;
            },
          }
        : {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerUp,
          };

  return (
    <View
      className="min-h-0 flex-1 items-center"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityValue={{
          min,
          max,
          now: clampValue(value),
        }}
        collapsable={false}
        pointerEvents={
          disabled ? "none" : Platform.OS === "android" ? "box-only" : "auto"
        }
        className="min-h-0 w-12 flex-1 touch-none overflow-hidden rounded-2xl border border-white/25 bg-white/10"
        onLayout={handleTrackLayout}
        {...trackTouchProps}
      >
        <View
          pointerEvents="none"
          className="absolute bottom-0 left-0 right-0 bg-accent"
          style={{ height: fillHeight }}
        />
      </View>
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
