import ShiftButton from "@/components/string-keyboard/ShiftButton";
import {
  cellAtPoint,
  cellMidi,
  describeNote,
  KEY_GAP,
  midiOctave,
  KEYBOARD_ROW_COUNT,
  nextSoundingNotes,
  rowOffsetLimits,
  soundingChanges,
  type KeyboardNote,
} from "@/components/string-keyboard/notes";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type PointerEvent,
} from "react-native";

export type { KeyboardNote };

type StringKeyboardProps = {
  voices?: number;
  onNoteOn?: (note: KeyboardNote) => void;
  onNoteOff?: (note: KeyboardNote) => void;
};

type StageSize = {
  width: number;
  height: number;
};

type PointerPoint = {
  x: number;
  y: number;
};

type GridMetrics = {
  rowOffset: number;
  columns: number;
  cellSize: number;
  gap: number;
  voices: number;
};

const NATURAL_COLOR = "#e7edf7";
const ACCIDENTAL_COLOR = "#152038";
const NATURAL_PRESSED_COLOR = "#ea7a53";
const ACCIDENTAL_PRESSED_COLOR = "#8a4034";

export default function StringKeyboard({
  voices = 4,
  onNoteOn,
  onNoteOff,
}: StringKeyboardProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [stage, setStage] = useState<StageSize>({ width: 0, height: 0 });
  const [rowOffset, setRowOffset] = useState(0);
  const [sounding, setSounding] = useState<number[]>([]);

  const pointersRef = useRef(new Map<number, PointerPoint>());
  const orderRef = useRef<number[]>([]);
  const soundingRef = useRef<number[]>([]);
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);
  const metricsRef = useRef<GridMetrics>({
    rowOffset: 0,
    columns: 0,
    cellSize: 0,
    gap: KEY_GAP,
    voices: 4,
  });

  onNoteOnRef.current = onNoteOn;
  onNoteOffRef.current = onNoteOff;

  const safeVoices =
    Number.isFinite(voices) && voices >= 1 ? Math.floor(voices) : 4;
  const cellSize =
    stage.height > 0
      ? (stage.height - KEY_GAP * (KEYBOARD_ROW_COUNT - 1)) / KEYBOARD_ROW_COUNT
      : 0;
  const columns =
    cellSize > 0 ? Math.max(0, Math.floor((stage.width + KEY_GAP) / (cellSize + KEY_GAP))) : 0;
  const limits = rowOffsetLimits(Math.max(columns, 1));
  const visibleOffset = Math.min(limits.max, Math.max(limits.min, rowOffset));

  metricsRef.current = {
    rowOffset: visibleOffset,
    columns,
    cellSize,
    gap: KEY_GAP,
    voices: safeVoices,
  };

  const syncFromPointers = useCallback(() => {
    const metrics = metricsRef.current;
    const held: number[] = [];
    const seen = new Set<number>();

    for (const point of pointersRef.current.values()) {
      const cell = cellAtPoint(
        point.x,
        point.y,
        metrics.cellSize,
        metrics.gap,
        metrics.columns,
      );
      if (!cell) {
        continue;
      }

      const midi = cellMidi(metrics.rowOffset, cell.row, cell.column);
      if (seen.has(midi)) {
        continue;
      }

      seen.add(midi);
      held.push(midi);
    }

    const next = nextSoundingNotes(orderRef.current, held, metrics.voices);
    orderRef.current = next.order;
    const changes = soundingChanges(soundingRef.current, next.sounding);
    soundingRef.current = next.sounding;

    for (const midi of changes.released) {
      onNoteOffRef.current?.(describeNote(midi));
    }
    for (const midi of changes.pressed) {
      onNoteOnRef.current?.(describeNote(midi));
    }

    setSounding((current) => (sameNoteSet(current, next.sounding) ? current : next.sounding));
  }, []);

  useEffect(() => {
    if (rowOffset !== visibleOffset) {
      setRowOffset(visibleOffset);
    }
  }, [rowOffset, visibleOffset]);

  useEffect(() => {
    syncFromPointers();
  }, [syncFromPointers, visibleOffset, columns, cellSize, safeVoices]);

  useEffect(() => {
    const pointers = pointersRef.current;
    return () => {
      pointers.clear();
      for (const midi of soundingRef.current) {
        onNoteOffRef.current?.(describeNote(midi));
      }
      soundingRef.current = [];
      orderRef.current = [];
    };
  }, []);

  const trackPointer = useCallback(
    (event: PointerEvent) => {
      const { pointerId, offsetX, offsetY } = event.nativeEvent;
      pointersRef.current.set(pointerId, { x: offsetX, y: offsetY });
      syncFromPointers();
    },
    [syncFromPointers],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      const { pointerId, button, pointerType } = event.nativeEvent;
      if (pointerType === "mouse" && button !== 0) {
        return;
      }

      event.preventDefault();
      if (typeof event.currentTarget.setPointerCapture === "function") {
        try {
          event.currentTarget.setPointerCapture(pointerId);
        } catch {
          // The note still tracks while the pointer stays over the grid.
        }
      }
      trackPointer(event);
    },
    [trackPointer],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!pointersRef.current.has(event.nativeEvent.pointerId)) {
        return;
      }

      trackPointer(event);
    },
    [trackPointer],
  );

  const releasePointer = useCallback(
    (event: PointerEvent) => {
      pointersRef.current.delete(event.nativeEvent.pointerId);
      syncFromPointers();
    },
    [syncFromPointers],
  );

  const handleStageLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    const height = Math.floor(event.nativeEvent.layout.height);
    setStage((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  }, []);

  const canShiftUp = columns > 0 && visibleOffset < limits.max;
  const canShiftDown = columns > 0 && visibleOffset > limits.min;
  const soundingSet = new Set(sounding);
  const labelSize = Math.max(14, Math.round(cellSize * 0.32));
  const gridWidth = columns > 0 ? columns * cellSize + (columns - 1) * KEY_GAP : 0;
  const gridHeight =
    cellSize > 0 ? KEYBOARD_ROW_COUNT * cellSize + (KEYBOARD_ROW_COUNT - 1) * KEY_GAP : 0;

  return (
    <View
      className="w-full flex-row"
      style={{ height: Math.round(screenHeight * 0.8) }}
    >
      <View className="flex-1 items-center justify-center" onLayout={handleStageLayout}>
        {columns > 0 && cellSize > 0 ? (
          <View
            collapsable={false}
            accessibilityLabel="Клавиатура"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
            className="touch-none"
            style={{ width: gridWidth, height: gridHeight }}
          >
            {Array.from({ length: KEYBOARD_ROW_COUNT }, (_, row) => (
              <View
                key={row}
                pointerEvents="none"
                className="flex-row"
                style={{
                  marginBottom: row < KEYBOARD_ROW_COUNT - 1 ? KEY_GAP : 0,
                }}
              >
                {Array.from({ length: columns }, (_, column) => {
                  const note = describeNote(cellMidi(visibleOffset, row, column));
                  const pressed = soundingSet.has(note.midi);
                  const backgroundColor = pressed
                    ? note.natural
                      ? NATURAL_PRESSED_COLOR
                      : ACCIDENTAL_PRESSED_COLOR
                    : note.natural
                      ? NATURAL_COLOR
                      : ACCIDENTAL_COLOR;

                  return (
                    <View
                      key={column}
                      pointerEvents="none"
                      testID={`key-${row}-${column}`}
                      className="items-center justify-center"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        marginRight: column < columns - 1 ? KEY_GAP : 0,
                        backgroundColor,
                      }}
                    >
                      {note.natural ? (
                        <Text
                          pointerEvents="none"
                          style={{
                            fontSize: labelSize,
                            fontWeight: "600",
                            color: "#081126",
                          }}
                        >
                          {note.name}
                        </Text>
                      ) : null}
                      {note.name === "C" ? (
                        <Text
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            right: Math.max(4, cellSize * 0.08),
                            bottom: Math.max(2, cellSize * 0.05),
                            fontSize: Math.max(11, Math.round(labelSize * 0.42)),
                            fontWeight: "600",
                            color: "#081126",
                          }}
                        >
                          {midiOctave(note.midi)}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View className="ml-2 h-full w-16">
        <ShiftButton
          label="На строку вверх"
          glyph="▲"
          disabled={!canShiftUp}
          onPress={() => setRowOffset((current) => current + 1)}
        />
        <View className="h-2" />
        <ShiftButton
          label="На строку вниз"
          glyph="▼"
          disabled={!canShiftDown}
          onPress={() => setRowOffset((current) => current - 1)}
        />
      </View>
    </View>
  );
}

function sameNoteSet(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightNotes = new Set(right);
  return left.every((midi) => rightNotes.has(midi));
}
