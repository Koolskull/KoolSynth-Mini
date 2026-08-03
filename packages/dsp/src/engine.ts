import type { MasterParams, OpLink, OperatorParams, Patch } from "./types";
import {
  algorithmOuts,
  defaultPatch,
  linksForAlgorithm,
  mergeOperator,
} from "./types";
import { Voice, type SampleBank } from "./voice";
import { FxChain } from "./effects";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export class SynthEngine {
  private sampleRate: number;
  private voices: Voice[] = [];
  private patch: Patch;
  private master: MasterParams = { gain: 0.75, softClip: true };
  private noteMap = new Map<number, number>();
  private dcX = 0;
  private dcY = 0;
  private polyGain = 1;
  private polyGainTarget = 1;
  private bendTarget = 0;
  private bendCurrent = 0;
  private bank: SampleBank = new Map();
  private fx = new FxChain();

  constructor(sampleRate: number, patch?: Patch) {
    this.sampleRate = sampleRate;
    this.patch = patch ?? defaultPatch();
    this.fx.configure(sampleRate);
    this.ensureVoices();
  }

  private ensureVoices(): void {
    const n = this.patch.maxVoices;
    while (this.voices.length < n) {
      this.voices.push(new Voice(this.sampleRate, this.patch, this.bank));
    }
    if (this.voices.length > n) this.voices.length = n;
  }

  loadSample(id: string, data: Float32Array, sampleRate: number): void {
    this.bank.set(id, { data, sampleRate });
  }

  clearSample(id: string): void {
    this.bank.delete(id);
  }

  setPatch(partial: Partial<Patch>): void {
    let operators = this.patch.operators;
    if (partial.operators) {
      operators = [
        mergeOperator(this.patch.operators[0], partial.operators[0] ?? {}),
        mergeOperator(this.patch.operators[1], partial.operators[1] ?? {}),
        mergeOperator(this.patch.operators[2], partial.operators[2] ?? {}),
        mergeOperator(this.patch.operators[3], partial.operators[3] ?? {}),
      ];
    }

    let links = partial.links ?? this.patch.links;
    let algorithm = this.patch.algorithm;
    if (partial.algorithm !== undefined && partial.algorithm !== this.patch.algorithm) {
      algorithm = clamp(Math.round(partial.algorithm), 0, 7);
      // rebuild links from algo, keep modes if same edge count otherwise default FM
      links = linksForAlgorithm(algorithm);
      // set default out levels from algo
      const outs = new Set(algorithmOuts(algorithm));
      operators = operators.map((op, i) =>
        mergeOperator(op, { outLevel: outs.has(i) ? Math.max(op.outLevel, 0.7) : 0 }),
      ) as Patch["operators"];
    }

    let fx = this.patch.fx;
    if (partial.fx) {
      fx = [
        { ...this.patch.fx[0], ...partial.fx[0] },
        { ...this.patch.fx[1], ...partial.fx[1] },
        { ...this.patch.fx[2], ...partial.fx[2] },
      ];
    }

    this.patch = {
      ...this.patch,
      ...partial,
      operators,
      links,
      algorithm: partial.algorithm !== undefined ? algorithm : this.patch.algorithm,
      fx,
      compressor: partial.compressor
        ? { ...this.patch.compressor, ...partial.compressor }
        : this.patch.compressor,
      pitchBendRange:
        partial.pitchBendRange !== undefined
          ? clamp(partial.pitchBendRange, 0, 24)
          : this.patch.pitchBendRange,
      pitchBendLegato:
        partial.pitchBendLegato !== undefined
          ? clamp(partial.pitchBendLegato, 0.001, 2)
          : this.patch.pitchBendLegato,
    };
    this.ensureVoices();
  }

  setLink(index: number, partial: Partial<OpLink>): void {
    const links = this.patch.links.map((l, i) =>
      i === index ? { ...l, ...partial } : l,
    );
    this.patch = { ...this.patch, links };
  }

  setOperator(index: 0 | 1 | 2 | 3, partial: Partial<OperatorParams>): void {
    const operators = [...this.patch.operators] as Patch["operators"];
    operators[index] = mergeOperator(operators[index], partial);
    this.patch = { ...this.patch, operators };
  }

  getPatch(): Patch {
    return this.patch;
  }

  setMaster(m: Partial<MasterParams>): void {
    this.master = { ...this.master, ...m };
  }

  setPitchBend(amount: number): void {
    this.bendTarget = clamp(amount, -1, 1);
  }

  getPitchBend(): number {
    return this.bendCurrent;
  }

  noteOn(note: number, velocity: number): void {
    const vel = Math.min(Math.max(velocity, 0), 1);
    const existing = this.noteMap.get(note);
    if (existing !== undefined) {
      this.voices[existing]!.noteOn(note, vel, this.patch, true);
      this.updatePolyTarget();
      return;
    }

    let idx = this.voices.findIndex((v) => !v.active);
    if (idx < 0) {
      let best = 0;
      let bestScore = -1;
      for (let i = 0; i < this.voices.length; i++) {
        const s = this.voices[i]!.stealingScore;
        if (s > bestScore) {
          bestScore = s;
          best = i;
        }
      }
      idx = best;
      this.voices[idx]!.steal();
      for (const [n, vi] of this.noteMap) {
        if (vi === idx) {
          this.noteMap.delete(n);
          break;
        }
      }
    }

    const soft = this.voices[idx]!.active;
    this.voices[idx]!.noteOn(note, vel, this.patch, soft);
    this.noteMap.set(note, idx);
    this.updatePolyTarget();
  }

  noteOff(note: number): void {
    const idx = this.noteMap.get(note);
    if (idx === undefined) return;
    this.voices[idx]!.noteOff();
    this.noteMap.delete(note);
    this.updatePolyTarget();
  }

  allNotesOff(): void {
    for (const v of this.voices) v.forceOff();
    this.noteMap.clear();
    this.updatePolyTarget();
  }

  private updatePolyTarget(): void {
    let n = 0;
    for (const v of this.voices) if (v.active) n++;
    this.polyGainTarget = n <= 1 ? 1 : 1 / Math.sqrt(n * 0.85);
  }

  process(outL: Float32Array, outR: Float32Array): void {
    const n = outL.length;
    const g = this.master.gain;
    const polySmooth = 1 - Math.exp(-1 / (0.008 * this.sampleRate));
    const legato = Math.max(this.patch.pitchBendLegato, 0.001);
    const bendSmooth = 1 - Math.exp(-1 / (legato * this.sampleRate));
    const range = clamp(this.patch.pitchBendRange, 0, 24);

    for (let i = 0; i < n; i++) {
      this.polyGain += (this.polyGainTarget - this.polyGain) * polySmooth;
      this.bendCurrent += (this.bendTarget - this.bendCurrent) * bendSmooth;
      const bendRatio = 2 ** ((this.bendCurrent * range) / 12);

      let s = 0;
      for (const v of this.voices) {
        if (v.active) s += v.process(this.patch, bendRatio);
      }
      s *= g * this.polyGain;

      // DC block
      const y = s - this.dcX + 0.995 * this.dcY;
      this.dcX = s;
      this.dcY = y;
      s = y;

      // 3 FX slots → compressor/limiter
      s = this.fx.process(s, this.patch.fx, this.patch.compressor);

      if (this.master.softClip) s = Math.tanh(s * 0.9);

      outL[i] = s;
      outR[i] = s;
    }
  }
}
