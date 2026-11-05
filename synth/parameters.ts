export const FORCE_MIN = 0;
export const FORCE_MAX = 1;
export const BREATH_MIN = 0.5;
export const BREATH_MAX = 1.5;
export const VIBRATO_RATE_MIN = 1;
export const VIBRATO_RATE_MAX = 10;
export const TIME_MIN = 0.01;
export const TIME_MAX = 1;
export const CHORUS_RATE_MIN = 0.1;
export const CHORUS_RATE_MAX = 5;
export const CHORUS_NOISE_CUTOFF_MIN = 10;
export const CHORUS_NOISE_CUTOFF_MAX = 200;
export const CHORUS_DELAY_MIN = 0.008;
export const CHORUS_DELAY_MAX = 0.03;
export const PREDELAY_MIN = 0;
export const PREDELAY_MAX = 0.2;
export const DELAY_TIME_MIN = 0.05;
export const DELAY_TIME_MAX = 1.5;
export const DELAY_FEEDBACK_MIN = 0;
export const DELAY_FEEDBACK_MAX = 0.95;
export const KEYBOARD_ROWS_MIN = 1;
export const KEYBOARD_ROWS_MAX = 8;
export const KEYBOARD_ROWS_DEFAULT = 4;
export const HOLD_VOICES_MIN = 1;
export const HOLD_VOICES_MAX = 16;
export const HOLD_VOICES_DEFAULT = 4;

export type ContinuousParamId =
  | "speed"
  | "pressure"
  | "vibrato"
  | "vibratoRate"
  | "attack"
  | "release"
  | "chorus"
  | "chorusRate"
  | "chorusDepth"
  | "chorusDelay"
  | "delayTime"
  | "delayFeedback"
  | "delayLevel"
  | "predelay"
  | "reverb"
  | "volume";

export type SynthParamValues = {
  speed: number;
  pressure: number;
  vibrato: number;
  vibratoRate: number;
  attack: number;
  release: number;
  chorus: number;
  chorusRate: number;
  chorusNoiseCutoff: number;
  chorusNoiseMod: boolean;
  chorusDepth: number;
  chorusDelay: number;
  delayTime: number;
  delayFeedback: number;
  delayLevel: number;
  predelay: number;
  reverb: number;
  volume: number;
  autoAttack: boolean;
  keyboardRows: number;
  holdVoices: number;
};

export type ContinuousParamDef = {
  id: ContinuousParamId;
  label: string;
  min: number;
  max: number;
};

export const CONTINUOUS_PARAMS: readonly ContinuousParamDef[] = [
  { id: "speed", label: "Breath", min: BREATH_MIN, max: BREATH_MAX },
  { id: "pressure", label: "Lips", min: FORCE_MIN, max: FORCE_MAX },
  { id: "vibrato", label: "Vibrato", min: 0, max: 1 },
  {
    id: "vibratoRate",
    label: "Vibrato Rate",
    min: VIBRATO_RATE_MIN,
    max: VIBRATO_RATE_MAX,
  },
  { id: "attack", label: "Attack", min: TIME_MIN, max: TIME_MAX },
  { id: "release", label: "Release", min: TIME_MIN, max: TIME_MAX },
  { id: "chorus", label: "Chorus", min: 0, max: 1 },
  {
    id: "chorusRate",
    label: "Chorus Rate",
    min: CHORUS_RATE_MIN,
    max: CHORUS_RATE_MAX,
  },
  { id: "chorusDepth", label: "Depth", min: 0, max: 1 },
  {
    id: "chorusDelay",
    label: "Ch Delay",
    min: CHORUS_DELAY_MIN,
    max: CHORUS_DELAY_MAX,
  },
  {
    id: "delayTime",
    label: "Time",
    min: DELAY_TIME_MIN,
    max: DELAY_TIME_MAX,
  },
  {
    id: "delayFeedback",
    label: "Feedback",
    min: DELAY_FEEDBACK_MIN,
    max: DELAY_FEEDBACK_MAX,
  },
  { id: "delayLevel", label: "Delay", min: 0, max: 1 },
  { id: "predelay", label: "Predelay", min: PREDELAY_MIN, max: PREDELAY_MAX },
  { id: "reverb", label: "Reverb", min: 0, max: 1 },
  { id: "volume", label: "Volume", min: 0, max: 1 },
] as const;

export const DEFAULT_PARAM_VALUES: SynthParamValues = {
  speed: 1,
  pressure: 0.5,
  vibrato: 0.01,
  vibratoRate: 1.03,
  attack: 0.08,
  release: 0.1,
  chorus: 0.7,
  chorusRate: 1.5,
  chorusNoiseCutoff: 17.2,
  chorusNoiseMod: true,
  chorusDepth: 0.117,
  chorusDelay: 0.028,
  delayTime: 0.35,
  delayFeedback: 0.35,
  delayLevel: 0,
  predelay: 0.167,
  reverb: 0.86,
  volume: 0.75,
  autoAttack: false,
  keyboardRows: KEYBOARD_ROWS_DEFAULT,
  holdVoices: HOLD_VOICES_DEFAULT,
};

export type CcMappings = Partial<Record<ContinuousParamId, number>>;

export function invertForce(value: number) {
  return FORCE_MIN + FORCE_MAX - value;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function mapCcToParam(ccValue: number, min: number, max: number) {
  const normalized = clamp(ccValue, 0, 127) / 127;
  return min + normalized * (max - min);
}

export function continuousParamDef(
  id: ContinuousParamId,
): ContinuousParamDef | undefined {
  return CONTINUOUS_PARAMS.find((param) => param.id === id);
}
