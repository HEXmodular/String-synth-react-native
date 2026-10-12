export const KEYBOARD_ROW_COUNT = 4;

/** Semitones from a cell to the cell on its right. */
export const COLUMN_SEMITONES = 1;

/** Semitones from a cell to the cell directly above it. A perfect fourth. */
export const ROW_SEMITONES = 5;

export const KEY_GAP = 3;

/** Bottom-left cell at row offset 0. MIDI 48 is C3. */
export const HOME_MIDI = 48;

export const LOWEST_MIDI = 24;
export const HIGHEST_MIDI = 96;

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export type KeyboardNote = {
  midi: number;
  frequency: number;
  name: string;
  natural: boolean;
};

export function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function isNatural(midi: number): boolean {
  const pitch = pitchClass(midi);
  return (
    pitch === 0 ||
    pitch === 2 ||
    pitch === 4 ||
    pitch === 5 ||
    pitch === 7 ||
    pitch === 9 ||
    pitch === 11
  );
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Scientific octave: MIDI 60 is C4. */
export function midiOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/**
 * Visual row 0 is the top of the grid. Moving up one row raises the pitch by a fourth.
 */
export function cellMidi(
  rowOffset: number,
  visualRow: number,
  column: number,
): number {
  const musicalRow = rowOffset + (KEYBOARD_ROW_COUNT - 1 - visualRow);
  return HOME_MIDI + musicalRow * ROW_SEMITONES + column * COLUMN_SEMITONES;
}

export function describeNote(midi: number): KeyboardNote {
  const natural = isNatural(midi);
  return {
    midi,
    frequency: midiToFrequency(midi),
    name: natural ? NOTE_NAMES[pitchClass(midi)] : "",
    natural,
  };
}

export function rowOffsetLimits(columnCount: number): { min: number; max: number } {
  const columns = Math.max(1, columnCount);
  const min = Math.ceil((LOWEST_MIDI - HOME_MIDI) / ROW_SEMITONES);
  const max =
    Math.floor(
      (HIGHEST_MIDI - HOME_MIDI - (columns - 1) * COLUMN_SEMITONES) /
        ROW_SEMITONES,
    ) - (KEYBOARD_ROW_COUNT - 1);

  return { min, max: Math.max(min, max) };
}

export function cellAtPoint(
  x: number,
  y: number,
  cellSize: number,
  gap: number,
  columns: number,
): { row: number; column: number } | null {
  if (cellSize <= 0 || columns <= 0) {
    return null;
  }

  const column = indexAlong(x, cellSize, gap, columns);
  const row = indexAlong(y, cellSize, gap, KEYBOARD_ROW_COUNT);
  if (column == null || row == null) {
    return null;
  }

  return { row, column };
}

export function nextSoundingNotes(
  previousOrder: readonly number[],
  heldMidis: readonly number[],
  voices: number,
): { order: number[]; sounding: number[] } {
  const held = new Set(heldMidis);
  const order = previousOrder.filter((midi) => held.has(midi));
  for (const midi of heldMidis) {
    if (!order.includes(midi)) {
      order.push(midi);
    }
  }

  const limit = Math.max(1, Math.floor(voices));
  const sounding =
    order.length > limit ? order.slice(order.length - limit) : order.slice();
  return { order, sounding };
}

export function soundingChanges(
  previous: readonly number[],
  next: readonly number[],
): { released: number[]; pressed: number[] } {
  const nextSet = new Set(next);
  const previousSet = new Set(previous);
  return {
    released: previous.filter((midi) => !nextSet.has(midi)),
    pressed: next.filter((midi) => !previousSet.has(midi)),
  };
}

function indexAlong(
  position: number,
  cellSize: number,
  gap: number,
  count: number,
): number | null {
  if (position < 0 || count <= 0) {
    return null;
  }

  const stride = cellSize + gap;
  const total = count * cellSize + Math.max(0, count - 1) * gap;
  if (position >= total) {
    return null;
  }

  return Math.min(count - 1, Math.floor(position / stride));
}
