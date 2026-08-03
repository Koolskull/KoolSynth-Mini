/** Shared synth parameter model — pure data, no audio APIs */

export type Waveform = "sine" | "triangle" | "saw" | "square" | "noise";

/** High-level routing / algorithm family */
export type SynthMode = "subtractive" | "fm" | "pd" | "additive";

export interface AdsrParams {
  attack: number; // seconds
  decay: number;
  sustain: number; // 0–1
  release: number;
}

export interface FilterParams {
  type: "lp" | "hp" | "bp";
  cutoff: number; // Hz
  resonance: number; // 0–1
  /** Envelope amount in octaves (±) */
  envAmount: number;
}

export interface OscParams {
  enabled: boolean;
  waveform: Waveform;
  /** Semitone offset from note (coarse) */
  semi: number;
  /** Cents detune */
  cents: number;
  /** Level 0–1 */
  level: number;
  /** Pulse width for square (0–1, 0.5 = 50%) */
  pw: number;
  /** FM ratio (operator frequency multiple); also used as PD formant scale */
  ratio: number;
  /** FM index / PD amount / additive partial tilt */
  mod: number;
  /** Per-operator amplitude ADSR */
  amp: AdsrParams;
  /** Per-operator filter envelope ADSR */
  filterEnv: AdsrParams;
  /** Per-operator filter */
  filter: FilterParams;
}

export interface Patch {
  mode: SynthMode;
  oscillators: [OscParams, OscParams, OscParams];
  /** Master voice gain 0–1 */
  gain: number;
  /** Polyphony voices */
  maxVoices: number;
  /** Glide time seconds (0 = off) */
  glide: number;
  /**
   * Pitch-bend range in semitones (half-steps).
   * Applied as ±range when bend amount is ±1. Default 2, max 24.
   */
  pitchBendRange: number;
  /**
   * Time in seconds for pitch-bend keys / wheel to glide to target.
   * Higher = slower, smoother.
   */
  pitchBendLegato: number;
}

export interface MasterParams {
  gain: number;
  softClip: boolean;
}

export function defaultAdsr(overrides: Partial<AdsrParams> = {}): AdsrParams {
  return {
    attack: 0.008,
    decay: 0.18,
    sustain: 0.72,
    release: 0.28,
    ...overrides,
  };
}

export function defaultFilter(overrides: Partial<FilterParams> = {}): FilterParams {
  return {
    type: "lp",
    cutoff: 2200,
    resonance: 0.2,
    envAmount: 1.2,
    ...overrides,
  };
}

export function defaultOsc(overrides: Partial<OscParams> = {}): OscParams {
  return mergeOsc(
    {
      enabled: true,
      waveform: "saw",
      semi: 0,
      cents: 0,
      level: 0.7,
      pw: 0.5,
      ratio: 1,
      mod: 0,
      amp: defaultAdsr(),
      filterEnv: defaultAdsr({
        attack: 0.01,
        decay: 0.22,
        sustain: 0.45,
        release: 0.3,
      }),
      filter: defaultFilter(),
    },
    overrides,
  );
}

export function defaultPatch(): Patch {
  return {
    mode: "subtractive",
    oscillators: [
      defaultOsc({ waveform: "saw", level: 0.65 }),
      defaultOsc({
        waveform: "square",
        level: 0.35,
        semi: 0,
        cents: 7,
        enabled: true,
      }),
      defaultOsc({ waveform: "sine", level: 0.2, semi: 12, enabled: false }),
    ],
    gain: 0.65,
    maxVoices: 12,
    glide: 0,
    pitchBendRange: 2,
    pitchBendLegato: 0.08,
  };
}

export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** Deep-merge one oscillator partial onto an existing OscParams */
export function mergeOsc(base: OscParams, partial: Partial<OscParams>): OscParams {
  return {
    ...base,
    ...partial,
    amp: partial.amp ? { ...base.amp, ...partial.amp } : base.amp,
    filterEnv: partial.filterEnv
      ? { ...base.filterEnv, ...partial.filterEnv }
      : base.filterEnv,
    filter: partial.filter ? { ...base.filter, ...partial.filter } : base.filter,
  };
}
