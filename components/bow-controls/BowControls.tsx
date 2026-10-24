import { useAudioEngine } from "@/audio/AudioEngineProvider";
import VerticalFader from "@/components/bow-controls/VerticalFader";
import { useCallback, useState } from "react";
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

function invertForce(value: number) {
  return FORCE_MIN + FORCE_MAX - value;
}

type BowControlsProps = {
  disabled?: boolean;
};

export default function BowControls({ disabled = false }: BowControlsProps) {
  const {
    setBowVelocity,
    setBowForce,
    setVibratoIntensity,
    setBowVelocityAttack,
    setBowVelocityRelease,
  } = useAudioEngine();
  const [velocity, setVelocity] = useState(DEFAULT_VELOCITY);
  const [force, setForce] = useState(DEFAULT_FORCE);
  const [vibrato, setVibrato] = useState(DEFAULT_VIBRATO);
  const [attack, setAttack] = useState(DEFAULT_ATTACK);
  const [release, setRelease] = useState(DEFAULT_RELEASE);

  const handleVelocityChange = useCallback(
    (value: number) => {
      setVelocity(value);
      setBowVelocity(value);
    },
    [setBowVelocity],
  );

  const handleForceChange = useCallback(
    (value: number) => {
      setForce(value);
      setBowForce(invertForce(value));
    },
    [setBowForce],
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

  return (
    <View className="h-full flex-row justify-center gap-4 px-3 py-2">
      <VerticalFader
        label="Speed"
        icon="speed"
        value={velocity}
        min={0}
        max={1}
        disabled={disabled}
        onChange={handleVelocityChange}
      />
      <VerticalFader
        label="Pressure"
        icon="compress"
        value={force}
        min={FORCE_MIN}
        max={FORCE_MAX}
        disabled={disabled}
        onChange={handleForceChange}
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
        label="Attack"
        icon="trending-up"
        value={attack}
        min={TIME_MIN}
        max={TIME_MAX}
        disabled={disabled}
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
    </View>
  );
}
