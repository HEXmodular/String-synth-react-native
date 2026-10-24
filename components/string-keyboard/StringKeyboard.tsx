import FoldButton from "@/components/string-keyboard/FoldButton";
import HoldButton from "@/components/string-keyboard/HoldButton";
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
  Platform,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PointerEvent,
} from "react-native";

export type { KeyboardNote };

type StringKeyboardProps = {
  voices?: number;
  onNoteOn?: (note: KeyboardNote) => void;
  onNoteOff?: (note: KeyboardNote) => void;
  onExpandedChange?: (expanded: boolean) => void;
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
  onExpandedChange,
}: StringKeyboardProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [expanded, setExpanded] = useState(true);
  const [stage, setStage] = useState<StageSize>({ width: 0, height: 0 });
  const [rowOffset, setRowOffset] = useState(0);
  const [sounding, setSounding] = useState<number[]>([]);
  const [holdActive, setHoldActive] = useState(false);

  const pointersRef = useRef(new Map<number, PointerPoint>());
  const orderRef = useRef<number[]>([]);
  const soundingRef = useRef<number[]>([]);
  const latchedRef = useRef<number[]>([]);
  const pointerMidisRef = useRef<number[]>([]);
  const suppressLatchRef = useRef(new Set<number>());
  const holdActiveRef = useRef(false);
  const expandedRef = useRef(true);
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);
  const onExpandedChangeRef = useRef(onExpandedChange);
  const metricsRef = useRef<GridMetrics>({
    rowOffset: 0,
    columns: 0,
    cellSize: 0,
    gap: KEY_GAP,
    voices: 4,
  });

  onNoteOnRef.current = onNoteOn;
  onNoteOffRef.current = onNoteOff;
  onExpandedChangeRef.current = onExpandedChange;
  holdActiveRef.current = holdActive;
  expandedRef.current = expanded;

  useEffect(() => {
    onExpandedChangeRef.current?.(expanded);
  }, [expanded]);

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
    if (!expandedRef.current) {
      return;
    }

    const metrics = metricsRef.current;
    const pointerMidis: number[] = [];
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
      pointerMidis.push(midi);
    }

    const pointerSet = new Set(pointerMidis);
    const previousPointerSet = new Set(pointerMidisRef.current);

    for (const midi of pointerMidis) {
      if (!previousPointerSet.has(midi) && latchedRef.current.includes(midi)) {
        // Re-pressing a held note releases it instead of retriggering.
        suppressLatchRef.current.add(midi);
        latchedRef.current = latchedRef.current.filter((heldMidi) => heldMidi !== midi);
      }
    }

    const latched = latchedRef.current.filter((midi) => !pointerSet.has(midi));
    for (const midi of pointerMidisRef.current) {
      if (pointerSet.has(midi) || latched.includes(midi)) {
        continue;
      }
      if (suppressLatchRef.current.has(midi)) {
        suppressLatchRef.current.delete(midi);
        continue;
      }
      if (holdActiveRef.current) {
        latched.push(midi);
      }
    }
    latchedRef.current = latched;

    pointerMidisRef.current = pointerMidis;

    const held: number[] = [];
    const heldSeen = new Set<number>();
    for (const midi of latchedRef.current) {
      if (heldSeen.has(midi)) {
        continue;
      }
      heldSeen.add(midi);
      held.push(midi);
    }
    for (const midi of pointerMidis) {
      if (heldSeen.has(midi) || suppressLatchRef.current.has(midi)) {
        // Suppressed re-press: finger is down but the note stays silent.
        continue;
      }
      heldSeen.add(midi);
      held.push(midi);
    }

    const next = nextSoundingNotes(orderRef.current, held, metrics.voices);
    orderRef.current = next.order;
    const soundingSet = new Set(next.sounding);
    latchedRef.current = latchedRef.current.filter((midi) => soundingSet.has(midi));

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
      latchedRef.current = [];
      pointerMidisRef.current = [];
      suppressLatchRef.current.clear();
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

  const syncTouches = useCallback(
    (event: GestureResponderEvent) => {
      const pointers = pointersRef.current;
      const touches = event.nativeEvent.touches;
      pointers.clear();
      if (touches) {
        for (const touch of touches) {
          if (!Number.isFinite(touch.locationX) || !Number.isFinite(touch.locationY)) {
            continue;
          }
          const touchId = Number(touch.identifier);
          if (!Number.isFinite(touchId)) {
            continue;
          }
          pointers.set(touchId, { x: touch.locationX, y: touch.locationY });
        }
      }
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

  const toggleHold = useCallback(() => {
    setHoldActive((current) => {
      const next = !current;
      holdActiveRef.current = next;
      if (!next) {
        latchedRef.current = [];
        suppressLatchRef.current.clear();
      }
      syncFromPointers();
      return next;
    });
  }, [syncFromPointers]);

  const toggleExpanded = useCallback(() => {
    setExpanded((current) => {
      if (current) {
        // Keep sounding voices: latch everything currently playing, drop pointers.
        for (const midi of soundingRef.current) {
          if (!latchedRef.current.includes(midi)) {
            latchedRef.current.push(midi);
          }
        }
        pointersRef.current.clear();
        pointerMidisRef.current = [];
        suppressLatchRef.current.clear();
        expandedRef.current = false;
      } else {
        expandedRef.current = true;
      }
      return !current;
    });
  }, []);

  const canShiftUp = columns > 0 && visibleOffset < limits.max;
  const canShiftDown = columns > 0 && visibleOffset > limits.min;
  const soundingSet = new Set(sounding);
  const labelSize = Math.max(14, Math.round(cellSize * 0.32));
  const gridWidth = columns > 0 ? columns * cellSize + (columns - 1) * KEY_GAP : 0;
  const gridHeight =
    cellSize > 0 ? KEYBOARD_ROW_COUNT * cellSize + (KEYBOARD_ROW_COUNT - 1) * KEY_GAP : 0;
  const gridTouchProps =
    Platform.OS === "android"
      ? {
          onStartShouldSetResponder: () => true,
          onMoveShouldSetResponder: () => true,
          onResponderTerminationRequest: () => false,
          onResponderGrant: syncTouches,
          onResponderStart: syncTouches,
          onResponderMove: syncTouches,
          onResponderEnd: syncTouches,
          onResponderRelease: syncTouches,
          onResponderTerminate: syncTouches,
        }
      : {
          onPointerDown: handlePointerDown,
          onPointerMove: handlePointerMove,
          onPointerUp: releasePointer,
          onPointerCancel: releasePointer,
        };

  if (!expanded) {
    return (
      <View className="w-full px-2">
        <FoldButton expanded={false} onPress={toggleExpanded} />
      </View>
    );
  }

  return (
    <View className="w-full" style={{ height: Math.round(screenHeight * 0.8) }}>
      <View className="px-2 pb-2">
        <FoldButton expanded onPress={toggleExpanded} />
      </View>

      <View className="min-h-0 flex-1 flex-row">
        <View className="flex-1 items-center justify-center" onLayout={handleStageLayout}>
          {columns > 0 && cellSize > 0 ? (
            <View
              collapsable={false}
              accessibilityLabel="Keyboard"
              pointerEvents={Platform.OS === "android" ? "box-only" : undefined}
              className="touch-none"
              style={{ width: gridWidth, height: gridHeight }}
              {...gridTouchProps}
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
          <HoldButton active={holdActive} onPress={toggleHold} />
          <View className="h-2" />
          <ShiftButton
            label="На строку вниз"
            glyph="▼"
            disabled={!canShiftDown}
            onPress={() => setRowOffset((current) => current - 1)}
          />
        </View>
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
