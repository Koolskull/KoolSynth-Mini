import { Adsr } from "./adsr";
import { Oscillator } from "./oscillator";
import { SvfFilter } from "./filter";
import { SamplePlayer } from "./sample-player";
import { GrainPlayer } from "./grain-player";
import type { LinkMode, OperatorParams, Patch } from "./types";
import { midiToHz } from "./types";

export type SampleBank = Map<string, { data: Float32Array; sampleRate: number }>;

function semiRatio(semi: number, cents: number): number {
  return 2 ** ((semi + cents / 100) / 12);
}

export class Voice {
  note = -1;
  velocity = 0;
  private age = 0;
  private sampleRate: number;
  private oscs: Oscillator[] = [];
  private samples: SamplePlayer[] = [];
  private grains: GrainPlayer[] = [];
  private ampEnvs: Adsr[] = [];
  private filterEnvs: Adsr[] = [];
  private filters: SvfFilter[] = [];
  private targetHz = 440;
  private currentHz = 440;
  private velSmoothed = 0;
  private bank: SampleBank;

  constructor(sampleRate: number, patch: Patch, bank: SampleBank) {
    this.sampleRate = sampleRate;
    this.bank = bank;
    for (let i = 0; i < 4; i++) {
      this.oscs.push(new Oscillator(sampleRate));
      this.samples.push(new SamplePlayer());
      this.grains.push(new GrainPlayer());
      this.ampEnvs.push(new Adsr(sampleRate, patch.operators[i]!.amp));
      this.filterEnvs.push(new Adsr(sampleRate, patch.operators[i]!.filterEnv));
      this.filters.push(new SvfFilter(sampleRate));
    }
  }

  get active(): boolean {
    return this.ampEnvs.some((e) => e.active);
  }

  get envLevel(): number {
    let m = 0;
    for (const e of this.ampEnvs) m = Math.max(m, e.value);
    return m;
  }

  get stealingScore(): number {
    return this.age + (1 - this.envLevel) * 2000;
  }

  noteOn(note: number, velocity: number, patch: Patch, soft = false): void {
    const wasIdle = !this.active;
    this.note = note;
    this.velocity = velocity;
    this.age = 0;
    this.targetHz = midiToHz(note);
    if (patch.glide <= 0) this.currentHz = this.targetHz;

    for (let i = 0; i < 4; i++) {
      const op = patch.operators[i]!;
      this.ampEnvs[i]!.setParams(op.amp);
      this.filterEnvs[i]!.setParams(op.filterEnv);

      const pr = op.ratio * semiRatio(op.semi, op.cents);

      if (op.source === "sample" || op.source === "grain") {
        const entry = op.sampleId ? this.bank.get(op.sampleId) : undefined;
        if (entry) {
          this.samples[i]!.setBuffer(entry.data, entry.sampleRate);
          this.grains[i]!.setBuffer(entry.data, entry.sampleRate);
        } else {
          this.samples[i]!.setBuffer(null, this.sampleRate);
          this.grains[i]!.setBuffer(null, this.sampleRate);
        }
      }

      if (op.source === "sample") {
        this.samples[i]!.trigger(
          this.sampleRate,
          pr,
          op.sampleStart,
          op.sampleLength,
          true,
        );
      } else if (op.source === "grain") {
        this.grains[i]!.trigger(
          this.sampleRate,
          pr,
          op.sampleStart,
          op.sampleLength,
          op.grainSize,
          op.grainDensity,
          op.grainSpeed,
          op.grainSpray,
        );
      }

      if (wasIdle && !soft) {
        this.oscs[i]!.reset(0);
        this.filters[i]!.reset();
      }
    }
    if (wasIdle && !soft) this.velSmoothed = 0;

    for (const e of this.ampEnvs) e.noteOn();
    for (const e of this.filterEnvs) e.noteOn();
  }

  noteOff(): void {
    for (const e of this.ampEnvs) e.noteOff();
    for (const e of this.filterEnvs) e.noteOff();
  }

  steal(): void {
    for (const e of this.ampEnvs) e.steal();
    for (const e of this.filterEnvs) e.steal();
  }

  forceOff(): void {
    for (const e of this.ampEnvs) e.noteOff();
    for (const e of this.filterEnvs) e.noteOff();
    this.note = -1;
  }

  /**
   * 4-op graph: process in order 0..3; accumulate mod feeds for FM/AM/RM/PD/ADD.
   */
  process(patch: Patch, bendRatio = 1): number {
    this.age++;
    if (!this.active) {
      this.note = -1;
      return 0;
    }

    if (patch.glide > 0) {
      const coeff = Math.exp(-1 / (patch.glide * this.sampleRate));
      this.currentHz = this.targetHz + (this.currentHz - this.targetHz) * coeff;
    } else {
      this.currentHz = this.targetHz;
    }

    {
      const vc = 1 - Math.exp(-1 / (0.005 * this.sampleRate));
      this.velSmoothed += (this.velocity - this.velSmoothed) * vc;
    }

    const baseHz = this.currentHz * bendRatio;
    const raw = [0, 0, 0, 0];
    const shaped = [0, 0, 0, 0];
    const amp = [0, 0, 0, 0];
    const fEnv = [0, 0, 0, 0];

    // Build incoming mod sums per dst by mode
    const fmIn = [0, 0, 0, 0];
    const amIn = [0, 0, 0, 0];
    const rmIn = [0, 0, 0, 0];
    const pdIn = [0, 0, 0, 0];
    const addIn = [0, 0, 0, 0];

    // Process operators in order; for FM serial, lower index should be modulator.
    // We first compute raw with current fmIn (from previous ops), then register links to later ops.
    for (let i = 0; i < 4; i++) {
      amp[i] = this.ampEnvs[i]!.process();
      fEnv[i] = this.filterEnvs[i]!.process();
      const op = patch.operators[i]!;

      if (!op.enabled) {
        raw[i] = 0;
        shaped[i] = 0;
        continue;
      }

      const freq =
        baseHz * op.ratio * semiRatio(op.semi, op.cents) + fmIn[i]! * baseHz;

      let s = 0;
      switch (op.source) {
        case "sample":
          s = this.samples[i]!.process();
          break;
        case "grain":
          s = this.grains[i]!.process();
          break;
        case "wave":
        default: {
          const pdAmt = Math.min(1, op.pd + pdIn[i]!);
          s = this.oscs[i]!.process(freq, op.waveform, op.pw, pdAmt, op.ratio);
          break;
        }
      }

      // AM / RM from modulators already processed
      if (amIn[i]! !== 0) s *= 1 + amIn[i]!;
      if (rmIn[i]! !== 0) s *= rmIn[i]!;
      s += addIn[i]!;

      raw[i] = s;

      let y = s * op.level * amp[i]!;
      const cut =
        op.filter.cutoff * 2 ** (op.filter.envAmount * (fEnv[i]! - 0.5) * 2);
      y = this.filters[i]!.process(y, op.filter, cut);
      shaped[i] = y;

      // Push links from this op to higher destinations
      for (const link of patch.links) {
        if (link.src !== i) continue;
        const dst = link.dst;
        if (dst < 0 || dst > 3 || dst === i) continue;
        const amt = link.amount;
        const modSig = raw[i]! * amp[i]! * (op.enabled ? 1 : 0);
        applyLink(link.mode, modSig, amt, dst, fmIn, amIn, rmIn, pdIn, addIn);
      }
    }

    // Mix to bus
    let bus = 0;
    for (let i = 0; i < 4; i++) {
      const op = patch.operators[i]!;
      if (!op.enabled) continue;
      bus += shaped[i]! * op.outLevel;
    }

    bus *= 0.45 * this.velSmoothed * patch.gain;
    return bus;
  }
}

function applyLink(
  mode: LinkMode,
  modSig: number,
  amount: number,
  dst: number,
  fmIn: number[],
  amIn: number[],
  rmIn: number[],
  pdIn: number[],
  addIn: number[],
): void {
  switch (mode) {
    case "fm":
      fmIn[dst]! += modSig * amount;
      break;
    case "am":
      amIn[dst]! += modSig * amount * 0.5;
      break;
    case "rm":
      // seed with 1 if first
      if (rmIn[dst] === 0) rmIn[dst] = 1;
      rmIn[dst]! *= modSig * amount + (1 - Math.min(amount, 1) * 0.5);
      break;
    case "pd":
      pdIn[dst]! += Math.abs(modSig) * amount * 0.5;
      break;
    case "add":
      addIn[dst]! += modSig * amount * 0.35;
      break;
  }
}
