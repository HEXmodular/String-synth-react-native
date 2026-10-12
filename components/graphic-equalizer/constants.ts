const EQ_BANDS = [
  ["31", 31],
  ["62", 62],
  ["125", 125],
  ["250", 250],
  ["500", 500],
  ["1k", 1000],
  ["2k", 2000],
  ["4k", 4000],
  ["8k", 8000],
  ["16k", 16000],
] as const;

export const EQ_BAND_HZ = EQ_BANDS.map(([, hz]) => hz);
export const EQ_MIN_DB = -36;
export const EQ_MAX_DB = 36;
