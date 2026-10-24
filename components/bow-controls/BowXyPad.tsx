import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useMemo, useRef, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const THUMB_SIZE = 28;

type AxisConfig = {
  value: number;
  min: number;
  max: number;
};

type BowXyPadProps = {
  /** Vertical axis (bottom → top). */
  y: AxisConfig;
  /** Horizontal axis (left → right). */
  x: AxisConfig;
  yLabel: string;
  xLabel: string;
  yIcon: keyof typeof MaterialIcons.glyphMap;
  xIcon: keyof typeof MaterialIcons.glyphMap;
  disabled?: boolean;
  onChange: (next: { x: number; y: number }) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function valueToRatio(value: number, min: number, max: number) {
  const span = max - min;
  if (!(span > 0)) {
    return 0;
  }
  return clamp((value - min) / span, 0, 1);
}

function ratioToValue(ratio: number, min: number, max: number) {
  return min + clamp(ratio, 0, 1) * (max - min);
}

export default function BowXyPad({
  y,
  x,
  yLabel,
  xLabel,
  yIcon,
  xIcon,
  disabled = false,
  onChange,
}: BowXyPadProps) {
  const sizeRef = useRef({ width: 0, height: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const disabledRef = useRef(disabled);
  const onChangeRef = useRef(onChange);
  const xRef = useRef(x);
  const yRef = useRef(y);

  disabledRef.current = disabled;
  onChangeRef.current = onChange;
  xRef.current = x;
  yRef.current = y;

  const applyPoint = useCallback((px: number, py: number) => {
    if (disabledRef.current) {
      return;
    }

    const { width, height } = sizeRef.current;
    if (!(width > 0) || !(height > 0)) {
      return;
    }

    const xAxis = xRef.current;
    const yAxis = yRef.current;
    if (xAxis.max <= xAxis.min || yAxis.max <= yAxis.min) {
      return;
    }

    const xRatio = clamp(px / width, 0, 1);
    const yRatio = 1 - clamp(py / height, 0, 1);

    onChangeRef.current({
      x: ratioToValue(xRatio, xAxis.min, xAxis.max),
      y: ratioToValue(yRatio, yAxis.min, yAxis.max),
    });
  }, []);

  const handlePadLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    const height = Math.floor(event.nativeEvent.layout.height);
    sizeRef.current = { width, height };
    setSize((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    );
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .maxPointers(1)
        .minDistance(0)
        .runOnJS(true)
        .onBegin((event) => {
          applyPoint(event.x, event.y);
        })
        .onUpdate((event) => {
          applyPoint(event.x, event.y);
        }),
    [applyPoint, disabled],
  );

  const xRatio = valueToRatio(x.value, x.min, x.max);
  const yRatio = valueToRatio(y.value, y.min, y.max);
  const thumbLeft = size.width * xRatio - THUMB_SIZE / 2;
  const thumbTop = size.height * (1 - yRatio) - THUMB_SIZE / 2;
  const accent = disabled ? "#f4f6fa55" : "#f4f6fa";

  return (
    <View
      className="min-h-0 flex-[2] items-center"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <GestureDetector gesture={pan}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={`${yLabel} and ${xLabel}`}
          accessibilityState={{ disabled }}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(((xRatio + yRatio) / 2) * 100),
            text: `${yLabel} ${Math.round(yRatio * 100)}%, ${xLabel} ${Math.round(xRatio * 100)}%`,
          }}
          collapsable={false}
          pointerEvents={disabled ? "none" : "auto"}
          className="min-h-0 w-full flex-1 touch-none overflow-hidden rounded-2xl border border-white/25 bg-white/10"
          onLayout={handlePadLayout}
        >
          <View
            pointerEvents="none"
            className="absolute rounded-full border-2 border-white bg-accent"
            style={{
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              left: thumbLeft,
              top: thumbTop,
            }}
          />
        </View>
      </GestureDetector>
      <View className="mt-2 flex-row items-center gap-3">
        <View className="items-center gap-1">
          <MaterialIcons name={xIcon} size={18} color={accent} />
          <Text
            className="text-center"
            style={{ fontSize: 11, fontWeight: "600", color: accent }}
          >
            {xLabel}
          </Text>
        </View>
        <View className="items-center gap-1">
          <MaterialIcons name={yIcon} size={18} color={accent} />
          <Text
            className="text-center"
            style={{ fontSize: 11, fontWeight: "600", color: accent }}
          >
            {yLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}
