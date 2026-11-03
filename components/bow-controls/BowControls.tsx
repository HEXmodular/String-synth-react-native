import { useSynthSettings } from "@/synth/SynthSettingsProvider";
import BowXyPad from "@/components/bow-controls/BowXyPad";
import VerticalFader from "@/components/bow-controls/VerticalFader";
import {
  CHORUS_DELAY_MAX,
  CHORUS_DELAY_MIN,
  CHORUS_NOISE_CUTOFF_MAX,
  CHORUS_NOISE_CUTOFF_MIN,
  CHORUS_RATE_MAX,
  CHORUS_RATE_MIN,
  DELAY_FEEDBACK_MAX,
  DELAY_FEEDBACK_MIN,
  DELAY_TIME_MAX,
  DELAY_TIME_MIN,
  FORCE_MAX,
  FORCE_MIN,
  PREDELAY_MAX,
  PREDELAY_MIN,
  TIME_MAX,
  TIME_MIN,
  VIBRATO_RATE_MAX,
  VIBRATO_RATE_MIN,
  clamp,
} from "@/synth/parameters";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import { View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

/** IOI (s) at/below this → shortest attack. */
const AUTO_ATTACK_FAST_IOI = 0.1;
/** IOI (s) at/above this → longest attack. */
const AUTO_ATTACK_SLOW_IOI = 0.9;
/** Ignore gaps longer than this (phrase pauses). */
const AUTO_ATTACK_MAX_IOI = 2;
const AUTO_ATTACK_WINDOW = 4;

function attackFromIoi(ioiSeconds: number) {
  const t =
    (ioiSeconds - AUTO_ATTACK_FAST_IOI) /
    (AUTO_ATTACK_SLOW_IOI - AUTO_ATTACK_FAST_IOI);
  return clamp(
    TIME_MIN + clamp(t, 0, 1) * (TIME_MAX - TIME_MIN),
    TIME_MIN,
    TIME_MAX,
  );
}

export type BowControlsHandle = {
  /** Call before noteOn when auto-attack is on; updates attack from press timing. */
  prepareNoteOn: () => void;
};

type BowControlsProps = {
  disabled?: boolean;
};

const BowControls = forwardRef<BowControlsHandle, BowControlsProps>(
  function BowControls({ disabled = false }, ref) {
    const {
      values,
      setParam,
      setSpeedPressure,
      setChorusRateControl,
      toggleChorusNoiseMod,
      toggleAutoAttack,
    } = useSynthSettings();

    const autoAttackRef = useRef(values.autoAttack);
    const lastPressAtRef = useRef<number | null>(null);
    const ioiWindowRef = useRef<number[]>([]);
    const setParamRef = useRef(setParam);

    autoAttackRef.current = values.autoAttack;
    setParamRef.current = setParam;

    useImperativeHandle(
      ref,
      () => ({
        prepareNoteOn: () => {
          if (!autoAttackRef.current) {
            return;
          }

          const now = Date.now();
          const previous = lastPressAtRef.current;
          lastPressAtRef.current = now;
          if (previous == null) {
            return;
          }

          const ioi = (now - previous) / 1000;
          if (!(ioi > 0) || ioi > AUTO_ATTACK_MAX_IOI) {
            return;
          }

          const window = ioiWindowRef.current;
          window.push(ioi);
          if (window.length > AUTO_ATTACK_WINDOW) {
            window.shift();
          }

          const avg =
            window.reduce((sum, value) => sum + value, 0) / window.length;
          const nextAttack = attackFromIoi(avg);
          setParamRef.current("attack", nextAttack);
        },
      }),
      [],
    );

    const handleSpeedPressureChange = useCallback(
      ({ x, y }: { x: number; y: number }) => {
        setSpeedPressure(y, x);
      },
      [setSpeedPressure],
    );

    const handleAutoAttackToggle = useCallback(() => {
      if (values.autoAttack) {
        lastPressAtRef.current = null;
        ioiWindowRef.current = [];
      }
      toggleAutoAttack();
    }, [toggleAutoAttack, values.autoAttack]);

    return (
      <View className="min-h-0 flex-1 flex-row gap-4 px-3 py-2">
        <BowXyPad
          yLabel="Speed · Y"
          yIcon="speed"
          y={{ value: values.speed, min: 0, max: 1 }}
          xLabel="Pressure · X"
          xIcon="compress"
          x={{ value: values.pressure, min: FORCE_MIN, max: FORCE_MAX }}
          disabled={disabled}
          onChange={handleSpeedPressureChange}
        />
        <ScrollView
          horizontal
          className="min-h-0 flex-1"
          contentContainerStyle={{
            gap: 16,
            height: "100%",
          }}
          showsHorizontalScrollIndicator={false}
        >
          <VerticalFader
            label="Vibrato"
            icon="waves"
            value={values.vibrato}
            min={0}
            max={1}
            disabled={disabled}
            onChange={(value) => setParam("vibrato", value)}
          />
          <VerticalFader
            label="Rate"
            icon="graphic-eq"
            value={values.vibratoRate}
            min={VIBRATO_RATE_MIN}
            max={VIBRATO_RATE_MAX}
            disabled={disabled}
            onChange={(value) => setParam("vibratoRate", value)}
          />
          <VerticalFader
            label={values.autoAttack ? "Auto" : "Attack"}
            icon={values.autoAttack ? "auto-mode" : "trending-up"}
            value={values.attack}
            min={TIME_MIN}
            max={TIME_MAX}
            disabled={disabled || values.autoAttack}
            labelDisabled={disabled}
            labelSelected={values.autoAttack}
            onLabelPress={handleAutoAttackToggle}
            onChange={(value) => setParam("attack", value)}
          />
          <VerticalFader
            label="Release"
            icon="trending-down"
            value={values.release}
            min={TIME_MIN}
            max={TIME_MAX}
            disabled={disabled}
            onChange={(value) => setParam("release", value)}
          />
          <VerticalFader
            label="Chorus"
            icon="library-music"
            value={values.chorus}
            min={0}
            max={1}
            disabled={disabled}
            onChange={(value) => setParam("chorus", value)}
          />
          <VerticalFader
            label={values.chorusNoiseMod ? "Noise" : "Rate"}
            icon={values.chorusNoiseMod ? "grain" : "sync"}
            value={
              values.chorusNoiseMod
                ? values.chorusNoiseCutoff
                : values.chorusRate
            }
            min={
              values.chorusNoiseMod
                ? CHORUS_NOISE_CUTOFF_MIN
                : CHORUS_RATE_MIN
            }
            max={
              values.chorusNoiseMod
                ? CHORUS_NOISE_CUTOFF_MAX
                : CHORUS_RATE_MAX
            }
            disabled={disabled}
            labelDisabled={disabled}
            labelSelected={values.chorusNoiseMod}
            onLabelPress={toggleChorusNoiseMod}
            onChange={setChorusRateControl}
          />
          <VerticalFader
            label="Depth"
            icon="swap-vert"
            value={values.chorusDepth}
            min={0}
            max={1}
            disabled={disabled}
            onChange={(value) => setParam("chorusDepth", value)}
          />
          <VerticalFader
            label="Ch Delay"
            icon="hourglass-empty"
            value={values.chorusDelay}
            min={CHORUS_DELAY_MIN}
            max={CHORUS_DELAY_MAX}
            disabled={disabled}
            onChange={(value) => setParam("chorusDelay", value)}
          />
          <VerticalFader
            label="Time"
            icon="schedule"
            value={values.delayTime}
            min={DELAY_TIME_MIN}
            max={DELAY_TIME_MAX}
            disabled={disabled}
            onChange={(value) => setParam("delayTime", value)}
          />
          <VerticalFader
            label="Feedback"
            icon="loop"
            value={values.delayFeedback}
            min={DELAY_FEEDBACK_MIN}
            max={DELAY_FEEDBACK_MAX}
            disabled={disabled}
            onChange={(value) => setParam("delayFeedback", value)}
          />
          <VerticalFader
            label="Delay"
            icon="hourglass-empty"
            value={values.delayLevel}
            min={0}
            max={1}
            disabled={disabled}
            onChange={(value) => setParam("delayLevel", value)}
          />
          <VerticalFader
            label="Predelay"
            icon="timer"
            value={values.predelay}
            min={PREDELAY_MIN}
            max={PREDELAY_MAX}
            disabled={disabled}
            onChange={(value) => setParam("predelay", value)}
          />
          <VerticalFader
            label="Reverb"
            icon="blur-on"
            value={values.reverb}
            min={0}
            max={1}
            disabled={disabled}
            onChange={(value) => setParam("reverb", value)}
          />
          <VerticalFader
            label="Volume"
            icon="volume-up"
            value={values.volume}
            min={0}
            max={1}
            disabled={disabled}
            onChange={(value) => setParam("volume", value)}
          />
        </ScrollView>
      </View>
    );
  },
);

export default BowControls;
