import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CHORUS_NOISE_CUTOFF_MAX,
  CHORUS_NOISE_CUTOFF_MIN,
  CONTINUOUS_PARAMS,
  DEFAULT_PARAM_VALUES,
  HOLD_VOICES_MAX,
  HOLD_VOICES_MIN,
  KEYBOARD_ROWS_MAX,
  KEYBOARD_ROWS_MIN,
  clamp,
  continuousParamDef,
  type CcMappings,
  type ContinuousParamId,
  type SynthParamValues,
} from "@/synth/parameters";

const CC_MAPPINGS_KEY = "string-synth/cc-mappings";
const SAVED_PARAMS_KEY = "string-synth/saved-params";

const CONTINUOUS_IDS = new Set<string>(
  CONTINUOUS_PARAMS.map((param) => param.id),
);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseCcMappings(raw: string | null): CcMappings {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: CcMappings = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!CONTINUOUS_IDS.has(key) || !isFiniteNumber(value)) {
        continue;
      }
      const cc = Math.round(value);
      if (cc < 0 || cc > 127) {
        continue;
      }
      next[key as ContinuousParamId] = cc;
    }
    return next;
  } catch {
    return {};
  }
}

function readClamped(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!isFiniteNumber(value)) {
    return fallback;
  }
  return clamp(value, min, max);
}

function readContinuous(
  parsed: Partial<Record<keyof SynthParamValues, unknown>>,
  id: ContinuousParamId,
): number {
  const def = continuousParamDef(id);
  const fallback = DEFAULT_PARAM_VALUES[id];
  if (!def) {
    return fallback;
  }
  return readClamped(parsed[id], fallback, def.min, def.max);
}

function parseSavedParams(raw: string | null): SynthParamValues {
  if (!raw) {
    return { ...DEFAULT_PARAM_VALUES };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<
      Record<keyof SynthParamValues, unknown>
    >;
    return {
      speed: readContinuous(parsed, "speed"),
      pressure: readContinuous(parsed, "pressure"),
      vibrato: readContinuous(parsed, "vibrato"),
      vibratoRate: readContinuous(parsed, "vibratoRate"),
      attack: readContinuous(parsed, "attack"),
      decay: readContinuous(parsed, "decay"),
      sustain: readContinuous(parsed, "sustain"),
      release: readContinuous(parsed, "release"),
      chorus: readContinuous(parsed, "chorus"),
      chorusRate: readContinuous(parsed, "chorusRate"),
      chorusNoiseCutoff: readClamped(
        parsed.chorusNoiseCutoff,
        DEFAULT_PARAM_VALUES.chorusNoiseCutoff,
        CHORUS_NOISE_CUTOFF_MIN,
        CHORUS_NOISE_CUTOFF_MAX,
      ),
      chorusNoiseMod:
        typeof parsed.chorusNoiseMod === "boolean"
          ? parsed.chorusNoiseMod
          : DEFAULT_PARAM_VALUES.chorusNoiseMod,
      chorusDepth: readContinuous(parsed, "chorusDepth"),
      chorusDelay: readContinuous(parsed, "chorusDelay"),
      delayTime: readContinuous(parsed, "delayTime"),
      delayFeedback: readContinuous(parsed, "delayFeedback"),
      delayLevel: readContinuous(parsed, "delayLevel"),
      predelay: readContinuous(parsed, "predelay"),
      reverb: readContinuous(parsed, "reverb"),
      volume: readContinuous(parsed, "volume"),
      autoAttack:
        typeof parsed.autoAttack === "boolean"
          ? parsed.autoAttack
          : DEFAULT_PARAM_VALUES.autoAttack,
      keyboardRows: Math.round(
        readClamped(
          parsed.keyboardRows,
          DEFAULT_PARAM_VALUES.keyboardRows,
          KEYBOARD_ROWS_MIN,
          KEYBOARD_ROWS_MAX,
        ),
      ),
      holdVoices: Math.round(
        readClamped(
          parsed.holdVoices,
          DEFAULT_PARAM_VALUES.holdVoices,
          HOLD_VOICES_MIN,
          HOLD_VOICES_MAX,
        ),
      ),
    };
  } catch {
    return { ...DEFAULT_PARAM_VALUES };
  }
}

export async function loadCcMappings(): Promise<CcMappings> {
  return parseCcMappings(await AsyncStorage.getItem(CC_MAPPINGS_KEY));
}

export async function saveCcMappings(mappings: CcMappings): Promise<void> {
  await AsyncStorage.setItem(CC_MAPPINGS_KEY, JSON.stringify(mappings));
}

export async function loadSavedParams(): Promise<SynthParamValues> {
  return parseSavedParams(await AsyncStorage.getItem(SAVED_PARAMS_KEY));
}

export async function saveSavedParams(values: SynthParamValues): Promise<void> {
  await AsyncStorage.setItem(SAVED_PARAMS_KEY, JSON.stringify(values));
}
