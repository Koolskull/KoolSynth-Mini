import { Adsr } from "./adsr";
import { Oscillator } from "./oscillator";
import { SvfFilter } from "./filter";
import type { Patch } from "./types";
import { midiToHz } from "./types";

export class Voice {
  note = -1;
  velocity = 0;
  private age = 0;
  private sampleRate: number;
  private oscs: [Oscillator, Oscillator, Oscillator];
  private ampEnvs: [Adsr, Adsr, Adsr];
  private filterEnvs: [Adsr, Adsr, Adsr];
  private filters: [SvfFilter, SvfFilter, SvfFilter];
  private targetHz = 440;
  private currentHz = 440;
  private velSmoothed = 0;

  constructor(sampleRate: number, patch: Patch) {
    this.sampleRate = sampleRate;
    this.oscs = [
      new Oscillator(sampleRate),
      new Oscillator(sampleRate),
      new Oscillator(sampleRate),
    ];
    this.ampEnvs = [
      new Adsr(sampleRate, patch.oscillators[0].amp),
      new Adsr(sampleRate, patch.oscillators[1].amp),
      new Adsr(sampleRate, patch.oscillators[2].amp),
    ];
    this.filterEnvs = [
      new Adsr(sampleRate, patch.oscillators[0].filterEnv),
      new Adsr(sampleRate, patch.oscillators[1].filterEnv),
      new Adsr(sampleRate, patch.oscillators[2].filterEnv),
    ];
    this.filters = [
      new SvfFilter(sampleRate),
      new SvfFilter(sampleRate),
      new SvfFilter(sampleRate),
    ];
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
    if (patch.glide <= 0) {
      this.currentHz = this.targetHz;
    }
    for (let i = 0; i < 3; i++) {
      const op = patch.oscillators[i]!;
      this.ampEnvs[i]!.setParams(op.amp);
      this.filterEnvs[i]!.setParams(op.filterEnv);
    }
    if (wasIdle && !soft) {
      for (const o of this.oscs) o.reset(0);
      for (const f of this.filters) f.reset();
      this.velSmoothed = 0;
    }
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
    const ops = patch.oscillators;

    // Advance all envelopes every sample (even disabled ops) for clean release
    const amp = [
      this.ampEnvs[0]!.process(),
      this.ampEnvs[1]!.process(),
      this.ampEnvs[2]!.process(),
    ];
    const fEnv = [
      this.filterEnvs[0]!.process(),
      this.filterEnvs[1]!.process(),
      this.filterEnvs[2]!.process(),
    ];

    const shaped = (i: number, raw: number): number => {
      const op = ops[i]!;
      if (!op.enabled) return 0;
      let s = raw * op.level * amp[i]!;
      const cut =
        op.filter.cutoff * 2 ** (op.filter.envAmount * (fEnv[i]! - 0.5) * 2);
      s = this.filters[i]!.process(s, op.filter, cut);
      return s;
    };

    let dry = 0;

    switch (patch.mode) {
      case "fm": {
        // Op2 → Op1 → Op0; each op filtered + amped
        const r2 = this.oscs[2].process(
          baseHz * ops[2].ratio * semiRatio(ops[2].semi, ops[2].cents),
          ops[2].waveform,
          ops[2].pw,
        );
        const m2 = shaped(2, r2);
        // Use pre-filter amp for mod depth so FM still bites
        const m2mod =
          (ops[2].enabled ? r2 * ops[2].level * amp[2]! : 0) * ops[2].mod * baseHz;
        const m1Freq =
          baseHz * ops[1].ratio * semiRatio(ops[1].semi, ops[1].cents) + m2mod;
        const r1 = this.oscs[1].process(m1Freq, ops[1].waveform, ops[1].pw);
        const m1 = shaped(1, r1);
        const m1mod =
          (ops[1].enabled ? r1 * ops[1].level * amp[1]! : 0) * ops[1].mod * baseHz;
        const cFreq =
          baseHz * ops[0].ratio * semiRatio(ops[0].semi, ops[0].cents) + m1mod;
        const r0 = this.oscs[0].process(cFreq, ops[0].waveform, ops[0].pw);
        dry = shaped(0, r0) + m1 * 0.12 + m2 * 0.08;
        break;
      }
      case "pd": {
        for (let i = 0; i < 3; i++) {
          const op = ops[i]!;
          if (!op.enabled) {
            continue;
          }
          const f = baseHz * op.ratio * semiRatio(op.semi, op.cents);
          const raw = this.oscs[i]!.process(f, op.waveform, op.pw, op.mod, op.ratio);
          dry += shaped(i, raw);
        }
        break;
      }
      case "additive": {
        for (let i = 0; i < 3; i++) {
          const op = ops[i]!;
          if (!op.enabled) continue;
          const harmonic = Math.max(1, Math.round(op.ratio));
          const tilt = 1 / (1 + op.mod * harmonic);
          const f = baseHz * harmonic * semiRatio(op.semi, op.cents);
          const raw =
            this.oscs[i]!.process(f, op.waveform === "noise" ? "sine" : op.waveform, op.pw) *
            tilt;
          dry += shaped(i, raw);
        }
        break;
      }
      case "subtractive":
      default: {
        for (let i = 0; i < 3; i++) {
          const op = ops[i]!;
          if (!op.enabled) continue;
          const f = baseHz * semiRatio(op.semi, op.cents);
          const raw = this.oscs[i]!.process(f, op.waveform, op.pw);
          dry += shaped(i, raw);
        }
        break;
      }
    }

    dry *= 0.55 * this.velSmoothed * patch.gain;
    return dry;
  }
}

function semiRatio(semi: number, cents: number): number {
  return 2 ** ((semi + cents / 100) / 12);
}
