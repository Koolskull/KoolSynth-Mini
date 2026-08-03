import type { FilterParams } from "./types";

/** One-pole-ish state-variable filter (Chamberlin) — cheap stereo mono path */
export class SvfFilter {
  private lp = 0;
  private bp = 0;
  private sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  reset(): void {
    this.lp = 0;
    this.bp = 0;
  }

  process(input: number, params: FilterParams, cutoffHz: number): number {
    const f = Math.min(Math.max(cutoffHz, 20), this.sampleRate * 0.45);
    const fNorm = 2 * Math.sin(Math.PI * Math.min(f / this.sampleRate, 0.49));
    const q = 1 - Math.min(Math.max(params.resonance, 0), 0.95);
    const hp = input - this.lp - q * this.bp;
    this.bp += fNorm * hp;
    this.lp += fNorm * this.bp;

    switch (params.type) {
      case "hp":
        return hp;
      case "bp":
        return this.bp;
      case "lp":
      default:
        return this.lp;
    }
  }
}
