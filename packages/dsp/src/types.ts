/** Shared synth parameter model — pure data, no audio APIs */

export type Waveform = "sine" | "triangle" | "saw" | "square" | "noise";

/** Operator source engine */
export type OpSource = "wave" | "sample" | "grain";

/**
 * How a modulator feeds a carrier (between operators).
 * - fm: phase modulation (Genesis-style)
 * - am: amplitude modulation
 * - rm: ring modulation
 * - pd: phase distortion of carrier by modulator
 * - add: additive mix into carrier body (pre-out)
 */
export type LinkMode = "fm" | "am" | "rm" | "pd" | "add";

export type FxType = "none" | "reverb" | "delay" | "chorus" | "phaser" | "distortion";

export interface AdsrParams {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface FilterParams {
  type: "lp" | "hp" | "bp";
  cutoff: number;
  resonance: number;
  envAmount: number;
}

export interface OperatorParams {
  enabled: boolean;
  source: OpSource;
  waveform: Waveform;
  /** Shared sample bank key (empty = silence for sample/grain) */
  sampleId: string;
  /** One-shot / grain window start 0–1 */
  sampleStart: number;
  /** Window length 0–1 of buffer */
  sampleLength: number;
  /** Grain size 0–1 (fraction of window) */
  grainSize: number;
  /** Grains per second-ish density 0–1 */
  grainDensity: number;
  /** How fast the grain playhead travels through the sample (−2…2) */
  grainSpeed: number;
  /** Randomize grain start 0–1 */
  grainSpray: number;
  semi: number;
  cents: number;
  level: number;
  pw: number;
  /** Frequency ratio (FM multiple / harmonic) */
  ratio: number;
  /** Local PD amount when wave source */
  pd: number;
  amp: AdsrParams;
  filterEnv: AdsrParams;
  filter: FilterParams;
  /** Direct output mix 0–1 */
  outLevel: number;
}

/** One directed edge: src modulates / feeds dst */
export interface OpLink {
  src: number;
  dst: number;
  mode: LinkMode;
  /** Modulation / feed amount 0–4 */
  amount: number;
}

export interface FxSlotParams {
  type: FxType;
  /** Generic wet 0–1 */
  mix: number;
  /** Time / size / rate depending on type */
  paramA: number;
  /** Feedback / depth / drive */
  paramB: number;
  /** Tone / damping / stages-ish */
  paramC: number;
}

export interface CompressorParams {
  threshold: number; // 0–1 linear
  ratio: number; // 1–20
  attack: number; // sec
  release: number;
  makeup: number; // 0–1 gain
}

export interface Patch {
  /** 4 operators */
  operators: [OperatorParams, OperatorParams, OperatorParams, OperatorParams];
  /**
   * Genesis-style algorithm 0–7 — sets default link topology.
   * User amounts/modes on links still apply; missing edges stay 0.
   */
  algorithm: number;
  /** Active links (mod matrix edges) */
  links: OpLink[];
  gain: number;
  maxVoices: number;
  glide: number;
  pitchBendRange: number;
  pitchBendLegato: number;
  /** Exactly 3 effect slots before compressor */
  fx: [FxSlotParams, FxSlotParams, FxSlotParams];
  compressor: CompressorParams;
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

export function defaultFxSlot(overrides: Partial<FxSlotParams> = {}): FxSlotParams {
  return {
    type: "none",
    mix: 0.25,
    paramA: 0.35,
    paramB: 0.3,
    paramC: 0.4,
    ...overrides,
  };
}

export function defaultOperator(overrides: Partial<OperatorParams> = {}): OperatorParams {
  return mergeOperator(
    {
      enabled: true,
      source: "wave",
      waveform: "saw",
      sampleId: "",
      sampleStart: 0,
      sampleLength: 1,
      grainSize: 0.08,
      grainDensity: 0.4,
      grainSpeed: 0.25,
      grainSpray: 0.1,
      semi: 0,
      cents: 0,
      level: 0.7,
      pw: 0.5,
      ratio: 1,
      pd: 0,
      amp: defaultAdsr(),
      filterEnv: defaultAdsr({
        attack: 0.01,
        decay: 0.22,
        sustain: 0.45,
        release: 0.3,
      }),
      filter: defaultFilter(),
      outLevel: 0.7,
    },
    overrides,
  );
}

/** YM2612-ish 4-op algorithms → default edges (src → dst). outs implied by outLevel. */
export function algorithmEdges(algo: number): [number, number][] {
  const a = ((algo % 8) + 8) % 8;
  switch (a) {
    case 0:
      return [
        [0, 1],
        [1, 2],
        [2, 3],
      ]; // serial
    case 1:
      return [
        [0, 2],
        [1, 2],
        [2, 3],
      ];
    case 2:
      return [
        [0, 3],
        [1, 2],
        [2, 3],
      ];
    case 3:
      return [
        [0, 1],
        [1, 3],
        [2, 3],
      ];
    case 4:
      return [
        [0, 1],
        [2, 3],
      ]; // dual stack
    case 5:
      return [
        [0, 1],
        [0, 2],
        [0, 3],
      ]; // 1→all
    case 6:
      return [[0, 1]]; // 0→1, others free
    case 7:
    default:
      return []; // all parallel
  }
}

/** Default out carriers per algorithm (ops that typically hit the bus) */
export function algorithmOuts(algo: number): number[] {
  const a = ((algo % 8) + 8) % 8;
  switch (a) {
    case 0:
    case 1:
    case 2:
    case 3:
      return [3];
    case 4:
      return [1, 3];
    case 5:
      return [1, 2, 3];
    case 6:
      return [1, 2, 3];
    case 7:
    default:
      return [0, 1, 2, 3];
  }
}

export function linksForAlgorithm(algo: number, amount = 1.2): OpLink[] {
  return algorithmEdges(algo).map(([src, dst]) => ({
    src,
    dst,
    mode: "fm" as LinkMode,
    amount,
  }));
}

export function defaultPatch(): Patch {
  const algo = 0;
  const outs = new Set(algorithmOuts(algo));
  return {
    operators: [
      defaultOperator({
        waveform: "sine",
        level: 0.8,
        ratio: 2,
        outLevel: outs.has(0) ? 0.7 : 0,
      }),
      defaultOperator({
        waveform: "sine",
        level: 0.7,
        ratio: 1,
        cents: 3,
        outLevel: outs.has(1) ? 0.7 : 0,
      }),
      defaultOperator({
        waveform: "saw",
        level: 0.55,
        ratio: 1,
        outLevel: outs.has(2) ? 0.7 : 0,
      }),
      defaultOperator({
        waveform: "square",
        level: 0.65,
        ratio: 1,
        outLevel: outs.has(3) ? 0.85 : 0,
      }),
    ],
    algorithm: algo,
    links: linksForAlgorithm(algo),
    gain: 0.6,
    maxVoices: 10,
    glide: 0,
    pitchBendRange: 2,
    pitchBendLegato: 0.08,
    fx: [
      defaultFxSlot({ type: "none" }),
      defaultFxSlot({ type: "none" }),
      defaultFxSlot({ type: "none" }),
    ],
    compressor: {
      threshold: 0.7,
      ratio: 4,
      attack: 0.005,
      release: 0.12,
      makeup: 0.15,
    },
  };
}

export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

export function mergeOperator(
  base: OperatorParams,
  partial: Partial<OperatorParams>,
): OperatorParams {
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

/** @deprecated alias */
export const mergeOsc = mergeOperator;
export type OscParams = OperatorParams;
export type SynthMode = LinkMode;
