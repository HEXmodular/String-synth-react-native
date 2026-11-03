import { useAudioEngine } from "@/audio/AudioEngineProvider";
import { useMidiInput } from "@/audio/useMidiInput";
import {
  CHORUS_NOISE_CUTOFF_MAX,
  CHORUS_NOISE_CUTOFF_MIN,
  CHORUS_RATE_MAX,
  CHORUS_RATE_MIN,
  CONTINUOUS_PARAMS,
  DEFAULT_PARAM_VALUES,
  clamp,
  invertForce,
  mapCcToParam,
  type CcMappings,
  type ContinuousParamId,
  type SynthParamValues,
} from "@/synth/parameters";
import {
  loadCcMappings,
  loadSavedParams,
  saveCcMappings,
  saveSavedParams,
} from "@/synth/storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type MidiNoteHandlers = {
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
};

type SynthSettingsValue = {
  values: SynthParamValues;
  ccMappings: CcMappings;
  learningParamId: ContinuousParamId | null;
  setParam: <K extends keyof SynthParamValues>(
    key: K,
    value: SynthParamValues[K],
  ) => void;
  setSpeedPressure: (speed: number, pressure: number) => void;
  setChorusRateControl: (value: number) => void;
  toggleChorusNoiseMod: () => void;
  toggleAutoAttack: () => void;
  startLearn: (paramId: ContinuousParamId) => void;
  cancelLearn: () => void;
  registerMidiNoteHandlers: (handlers: MidiNoteHandlers) => () => void;
  saveCurrentAsDefaults: () => Promise<void>;
};

const SynthSettingsContext = createContext<SynthSettingsValue | null>(null);

export function useSynthSettings() {
  const value = useContext(SynthSettingsContext);
  if (!value) {
    throw new Error("useSynthSettings must be used within SynthSettingsProvider");
  }
  return value;
}

type SynthSettingsProviderProps = {
  children: ReactNode;
};

export default function SynthSettingsProvider({
  children,
}: SynthSettingsProviderProps) {
  const engine = useAudioEngine();
  const [values, setValues] = useState<SynthParamValues>(DEFAULT_PARAM_VALUES);
  const [ccMappings, setCcMappings] = useState<CcMappings>({});
  const [learningParamId, setLearningParamId] =
    useState<ContinuousParamId | null>(null);

  const valuesRef = useRef<SynthParamValues>(DEFAULT_PARAM_VALUES);
  const ccMappingsRef = useRef<CcMappings>({});
  const learningParamIdRef = useRef<ContinuousParamId | null>(null);
  const engineRef = useRef(engine);
  const noteHandlersRef = useRef<MidiNoteHandlers>({
    onNoteOn: () => {},
    onNoteOff: () => {},
  });

  valuesRef.current = values;
  ccMappingsRef.current = ccMappings;
  learningParamIdRef.current = learningParamId;
  engineRef.current = engine;

  const applyEngineFromValues = useCallback((next: SynthParamValues) => {
    const audio = engineRef.current;
    audio.setBowVelocity(next.speed);
    audio.setBowForce(invertForce(next.pressure));
    audio.setVibratoIntensity(next.vibrato);
    audio.setVibratoRate(next.vibratoRate);
    audio.setBowVelocityAttack(next.attack);
    audio.setBowVelocityRelease(next.release);
    audio.setChorusLevel(next.chorus);
    audio.setChorusNoiseMod(next.chorusNoiseMod);
    audio.setChorusRate(
      next.chorusNoiseMod ? next.chorusNoiseCutoff : next.chorusRate,
    );
    audio.setChorusDepth(next.chorusDepth);
    audio.setChorusDelay(next.chorusDelay);
    audio.setDelayTime(next.delayTime);
    audio.setDelayFeedback(next.delayFeedback);
    audio.setDelayLevel(next.delayLevel);
    audio.setPredelay(next.predelay);
    audio.setReverbLevel(next.reverb);
    audio.setMasterVolume(next.volume);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [savedParams, savedMappings] = await Promise.all([
        loadSavedParams(),
        loadCcMappings(),
      ]);
      if (cancelled) {
        return;
      }
      valuesRef.current = savedParams;
      setValues(savedParams);
      setCcMappings(savedMappings);
      applyEngineFromValues(savedParams);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyEngineFromValues]);

  const persistMappings = useCallback(async (next: CcMappings) => {
    setCcMappings(next);
    ccMappingsRef.current = next;
    await saveCcMappings(next);
  }, []);

  const persistUiSettings = useCallback(async () => {
    const saved = await loadSavedParams();
    await saveSavedParams({
      ...saved,
      keyboardRows: valuesRef.current.keyboardRows,
      holdVoices: valuesRef.current.holdVoices,
    });
  }, []);

  const setParam = useCallback(
    <K extends keyof SynthParamValues>(key: K, value: SynthParamValues[K]) => {
      setValues((current) => {
        const next = { ...current, [key]: value };
        valuesRef.current = next;

        const audio = engineRef.current;
        switch (key) {
          case "speed":
            audio.setBowVelocity(value as number);
            break;
          case "pressure":
            audio.setBowForce(invertForce(value as number));
            break;
          case "vibrato":
            audio.setVibratoIntensity(value as number);
            break;
          case "vibratoRate":
            audio.setVibratoRate(value as number);
            break;
          case "attack":
            audio.setBowVelocityAttack(value as number);
            break;
          case "release":
            audio.setBowVelocityRelease(value as number);
            break;
          case "chorus":
            audio.setChorusLevel(value as number);
            break;
          case "chorusRate":
            if (!next.chorusNoiseMod) {
              audio.setChorusRate(value as number);
            }
            break;
          case "chorusNoiseCutoff":
            if (next.chorusNoiseMod) {
              audio.setChorusRate(value as number);
            }
            break;
          case "chorusNoiseMod":
            audio.setChorusNoiseMod(value as boolean);
            audio.setChorusRate(
              value ? next.chorusNoiseCutoff : next.chorusRate,
            );
            break;
          case "chorusDepth":
            audio.setChorusDepth(value as number);
            break;
          case "chorusDelay":
            audio.setChorusDelay(value as number);
            break;
          case "delayTime":
            audio.setDelayTime(value as number);
            break;
          case "delayFeedback":
            audio.setDelayFeedback(value as number);
            break;
          case "delayLevel":
            audio.setDelayLevel(value as number);
            break;
          case "predelay":
            audio.setPredelay(value as number);
            break;
          case "reverb":
            audio.setReverbLevel(value as number);
            break;
          case "volume":
            audio.setMasterVolume(value as number);
            break;
          default:
            break;
        }

        return next;
      });

      if (key === "keyboardRows" || key === "holdVoices") {
        void persistUiSettings();
      }
    },
    [persistUiSettings],
  );

  const setSpeedPressure = useCallback((speed: number, pressure: number) => {
    setValues((current) => {
      const next = { ...current, speed, pressure };
      valuesRef.current = next;
      const audio = engineRef.current;
      audio.setBowVelocity(speed);
      audio.setBowForce(invertForce(pressure));
      return next;
    });
  }, []);

  const setChorusRateControl = useCallback((value: number) => {
    setValues((current) => {
      const next = current.chorusNoiseMod
        ? { ...current, chorusNoiseCutoff: value }
        : { ...current, chorusRate: value };
      valuesRef.current = next;
      engineRef.current.setChorusRate(value);
      return next;
    });
  }, []);

  const toggleChorusNoiseMod = useCallback(() => {
    setValues((current) => {
      const nextMod = !current.chorusNoiseMod;
      const next = { ...current, chorusNoiseMod: nextMod };
      valuesRef.current = next;
      engineRef.current.setChorusNoiseMod(nextMod);
      engineRef.current.setChorusRate(
        nextMod ? next.chorusNoiseCutoff : next.chorusRate,
      );
      return next;
    });
  }, []);

  const toggleAutoAttack = useCallback(() => {
    setValues((current) => {
      const next = { ...current, autoAttack: !current.autoAttack };
      valuesRef.current = next;
      return next;
    });
  }, []);

  const startLearn = useCallback((paramId: ContinuousParamId) => {
    setLearningParamId(paramId);
    learningParamIdRef.current = paramId;
  }, []);

  const cancelLearn = useCallback(() => {
    setLearningParamId(null);
    learningParamIdRef.current = null;
  }, []);

  const applyContinuousFromCc = useCallback(
    (paramId: ContinuousParamId, ccValue: number) => {
      const current = valuesRef.current;

      if (paramId === "chorusRate") {
        const min = current.chorusNoiseMod
          ? CHORUS_NOISE_CUTOFF_MIN
          : CHORUS_RATE_MIN;
        const max = current.chorusNoiseMod
          ? CHORUS_NOISE_CUTOFF_MAX
          : CHORUS_RATE_MAX;
        setChorusRateControl(mapCcToParam(ccValue, min, max));
        return;
      }

      const def = CONTINUOUS_PARAMS.find((param) => param.id === paramId);
      if (!def) {
        return;
      }

      const mapped = mapCcToParam(ccValue, def.min, def.max);
      switch (paramId) {
        case "speed":
          setParam("speed", mapped);
          break;
        case "pressure":
          setParam("pressure", mapped);
          break;
        case "vibrato":
          setParam("vibrato", mapped);
          break;
        case "vibratoRate":
          setParam("vibratoRate", mapped);
          break;
        case "attack":
          setParam("attack", mapped);
          break;
        case "release":
          setParam("release", mapped);
          break;
        case "chorus":
          setParam("chorus", mapped);
          break;
        case "chorusDepth":
          setParam("chorusDepth", mapped);
          break;
        case "chorusDelay":
          setParam("chorusDelay", mapped);
          break;
        case "delayTime":
          setParam("delayTime", mapped);
          break;
        case "delayFeedback":
          setParam("delayFeedback", mapped);
          break;
        case "delayLevel":
          setParam("delayLevel", mapped);
          break;
        case "predelay":
          setParam("predelay", mapped);
          break;
        case "reverb":
          setParam("reverb", mapped);
          break;
        case "volume":
          setParam("volume", mapped);
          break;
        default:
          break;
      }
    },
    [setChorusRateControl, setParam],
  );

  const handleControlChange = useCallback(
    (controller: number, value: number) => {
      const cc = Math.round(clamp(controller, 0, 127));
      const learning = learningParamIdRef.current;
      if (learning) {
        const next: CcMappings = { ...ccMappingsRef.current };
        for (const [paramId, mappedCc] of Object.entries(next)) {
          if (mappedCc === cc) {
            delete next[paramId as ContinuousParamId];
          }
        }
        next[learning] = cc;
        void persistMappings(next);
        setLearningParamId(null);
        learningParamIdRef.current = null;
        applyContinuousFromCc(learning, value);
        return;
      }

      for (const [paramId, mappedCc] of Object.entries(ccMappingsRef.current)) {
        if (mappedCc === cc) {
          applyContinuousFromCc(paramId as ContinuousParamId, value);
          return;
        }
      }
    },
    [applyContinuousFromCc, persistMappings],
  );

  const handleMidiNoteOn = useCallback((midi: number) => {
    noteHandlersRef.current.onNoteOn(midi);
  }, []);

  const handleMidiNoteOff = useCallback((midi: number) => {
    noteHandlersRef.current.onNoteOff(midi);
  }, []);

  useMidiInput({
    onNoteOn: handleMidiNoteOn,
    onNoteOff: handleMidiNoteOff,
    onControlChange: handleControlChange,
  });

  const registerMidiNoteHandlers = useCallback((handlers: MidiNoteHandlers) => {
    noteHandlersRef.current = handlers;
    return () => {
      noteHandlersRef.current = {
        onNoteOn: () => {},
        onNoteOff: () => {},
      };
    };
  }, []);

  const saveCurrentAsDefaults = useCallback(async () => {
    await saveSavedParams(valuesRef.current);
  }, []);

  const value = useMemo<SynthSettingsValue>(
    () => ({
      values,
      ccMappings,
      learningParamId,
      setParam,
      setSpeedPressure,
      setChorusRateControl,
      toggleChorusNoiseMod,
      toggleAutoAttack,
      startLearn,
      cancelLearn,
      registerMidiNoteHandlers,
      saveCurrentAsDefaults,
    }),
    [
      values,
      ccMappings,
      learningParamId,
      setParam,
      setSpeedPressure,
      setChorusRateControl,
      toggleChorusNoiseMod,
      toggleAutoAttack,
      startLearn,
      cancelLearn,
      registerMidiNoteHandlers,
      saveCurrentAsDefaults,
    ],
  );

  return (
    <SynthSettingsContext.Provider value={value}>
      {children}
    </SynthSettingsContext.Provider>
  );
}
