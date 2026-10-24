import { useAudioEngine } from "@/audio/AudioEngineProvider";
import BowXyPad from "@/components/bow-controls/BowXyPad";
import VerticalFader from "@/components/bow-controls/VerticalFader";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { View } from "react-native";

const DEFAULT_VELOCITY = 0.18;
const FORCE_MIN = 0.1;
const FORCE_MAX = 5;
const DEFAULT_FORCE = FORCE_MIN + FORCE_MAX - 1;
const DEFAULT_VIBRATO = 0;
const TIME_MIN = 0.01;
const TIME_MAX = 1;
const DEFAULT_ATTACK = 0.08;
const DEFAULT_RELEASE = 0.1;
const DEFAULT_MASTER_VOLUME = 1;

/** IOI (s) at/below this → shortest attack. */
const AUTO_ATTACK_FAST_IOI = 0.1;
/** IOI (s) at/above this → longest attack. */
const AUTO_ATTACK_SLOW_IOI = 0.9;
/** Ignore gaps longer than this (phrase pauses). */
const AUTO_ATTACK_MAX_IOI = 2;
const AUTO_ATTACK_WINDOW = 4;

function invertForce(value: number) {
  return FORCE_MIN + FORCE_MAX - value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
      setBowVelocity,
      setBowForce,
      setVibratoIntensity,
      setBowVelocityAttack,
      setBowVelocityRelease,
      setMasterVolume,
    } = useAudioEngine();
    const [velocity, setVelocity] = useState(DEFAULT_VELOCITY);
    const [force, setForce] = useState(DEFAULT_FORCE);
    const [vibrato, setVibrato] = useState(DEFAULT_VIBRATO);
    const [attack, setAttack] = useState(DEFAULT_ATTACK);
    const [release, setRelease] = useState(DEFAULT_RELEASE);
    const [masterVolume, setMasterVolumeState] = useState(DEFAULT_MASTER_VOLUME);
    const [autoAttack, setAutoAttack] = useState(false);

    const autoAttackRef = useRef(false);
    const lastPressAtRef = useRef<number | null>(null);
    const ioiWindowRef = useRef<number[]>([]);
    const setBowVelocityAttackRef = useRef(setBowVelocityAttack);

    autoAttackRef.current = autoAttack;
    setBowVelocityAttackRef.current = setBowVelocityAttack;

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
          setAttack(nextAttack);
          setBowVelocityAttackRef.current(nextAttack);
        },
      }),
      [],
    );

    const handleSpeedPressureChange = useCallback(
      ({ x, y }: { x: number; y: number }) => {
        setForce(x);
        setVelocity(y);
        setBowForce(invertForce(x));
        setBowVelocity(y);
      },
      [setBowForce, setBowVelocity],
    );

    const handleVibratoChange = useCallback(
      (value: number) => {
        setVibrato(value);
        setVibratoIntensity(value);
      },
      [setVibratoIntensity],
    );

    const handleAttackChange = useCallback(
      (value: number) => {
        setAttack(value);
        setBowVelocityAttack(value);
      },
      [setBowVelocityAttack],
    );

    const handleReleaseChange = useCallback(
      (value: number) => {
        setRelease(value);
        setBowVelocityRelease(value);
      },
      [setBowVelocityRelease],
    );

    const handleMasterVolumeChange = useCallback(
      (value: number) => {
        setMasterVolumeState(value);
        setMasterVolume(value);
      },
      [setMasterVolume],
    );

    const handleAutoAttackToggle = useCallback(() => {
      setAutoAttack((current) => {
        const next = !current;
        if (!next) {
          lastPressAtRef.current = null;
          ioiWindowRef.current = [];
        }
        return next;
      });
    }, []);

    return (
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          justifyContent: "center",
          gap: 16,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <BowXyPad
          yLabel="Speed · Y"
          yIcon="speed"
          y={{ value: velocity, min: 0, max: 1 }}
          xLabel="Pressure · X"
          xIcon="compress"
          x={{ value: force, min: FORCE_MIN, max: FORCE_MAX }}
          disabled={disabled}
          onChange={handleSpeedPressureChange}
        />
        <VerticalFader
          label="Vibrato"
          icon="waves"
          value={vibrato}
          min={0}
          max={1}
          disabled={disabled}
          onChange={handleVibratoChange}
        />
        <VerticalFader
          label={autoAttack ? "Auto" : "Attack"}
          icon={autoAttack ? "auto-mode" : "trending-up"}
          value={attack}
          min={TIME_MIN}
          max={TIME_MAX}
          disabled={disabled || autoAttack}
          labelDisabled={disabled}
          labelSelected={autoAttack}
          onLabelPress={handleAutoAttackToggle}
          onChange={handleAttackChange}
        />
        <VerticalFader
          label="Release"
          icon="trending-down"
          value={release}
          min={TIME_MIN}
          max={TIME_MAX}
          disabled={disabled}
          onChange={handleReleaseChange}
        />
        <VerticalFader
          label="Volume"
          icon="volume-up"
          value={masterVolume}
          min={0}
          max={1}
          disabled={disabled}
          onChange={handleMasterVolumeChange}
        />
      </View>
    );
  },
);

export default BowControls;
