import type { MasterParams, Patch } from "./types";
import { defaultPatch, mergeOsc } from "./types";
import { Voice } from "./voice";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export class SynthEngine {
  private sampleRate: number;
  private voices: Voice[] = [];
  private patch: Patch;
  private master: MasterParams = { gain: 0.75, softClip: true };
  /** note → voice index for matching noteOff */
  private noteMap = new Map<number, number>();
  /** One-pole DC block */
  private dcX = 0;
  private dcY = 0;
  /** Smooth poly headroom */
  private polyGain = 1;
  private polyGainTarget = 1;

  /** Pitch bend target −1…+1 (from keys / MIDI wheel) */
  private bendTarget = 0;
  /** Smoothed bend amount (legato) */
  private bendCurrent = 0;

  constructor(sampleRate: number, patch?: Patch) {
    this.sampleRate = sampleRate;
    this.patch = patch ?? defaultPatch();
    this.ensureVoices();
  }

  private ensureVoices(): void {
    const n = this.patch.maxVoices;
    while (this.voices.length < n) {
      this.voices.push(new Voice(this.sampleRate, this.patch));
    }
    if (this.voices.length > n) {
      this.voices.length = n;
    }
  }

  setPatch(partial: Partial<Patch>): void {
    const oscs = partial.oscillators
      ? ([
          mergeOsc(this.patch.oscillators[0], partial.oscillators[0] ?? {}),
          mergeOsc(this.patch.oscillators[1], partial.oscillators[1] ?? {}),
          mergeOsc(this.patch.oscillators[2], partial.oscillators[2] ?? {}),
        ] as Patch["oscillators"])
      : this.patch.oscillators;

    this.patch = {
      ...this.patch,
      ...partial,
      oscillators: oscs,
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

  getPatch(): Patch {
    return this.patch;
  }

  setMaster(m: Partial<MasterParams>): void {
    this.master = { ...this.master, ...m };
  }

  /**
   * Set pitch-bend amount in −1…+1.
   * Actual detune = amount × pitchBendRange semitones, smoothed by pitchBendLegato.
   */
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
    const clip = this.master.softClip;
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

      const y = s - this.dcX + 0.995 * this.dcY;
      this.dcX = s;
      this.dcY = y;
      s = y;

      if (clip) {
        s = Math.tanh(s * 0.95);
      }
      outL[i] = s;
      outR[i] = s;
    }
  }
}
