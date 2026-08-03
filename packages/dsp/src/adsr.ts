import type { AdsrParams } from "./types";

export type EnvStage = "idle" | "attack" | "decay" | "sustain" | "release";

/**
 * Smooth ADSR — no stage discontinuities, min times to avoid clicks.
 * Attack continues from current level (chord retriggers don't snap).
 */
export class Adsr {
  stage: EnvStage = "idle";
  value = 0;
  private params: AdsrParams;
  private sampleRate: number;
  private releaseStart = 0;
  /** Minimum segment length (seconds) — ~3ms at any SR */
  private readonly minTime = 0.003;

  constructor(sampleRate: number, params: AdsrParams) {
    this.sampleRate = sampleRate;
    this.params = { ...params };
  }

  setParams(p: AdsrParams): void {
    this.params = { ...p };
  }

  noteOn(): void {
    // Retrigger from current level — never hard-zero mid-note
    this.stage = "attack";
  }

  noteOff(): void {
    if (this.stage === "idle") return;
    this.releaseStart = Math.max(this.value, 1e-6);
    this.stage = "release";
  }

  /** Fast fade for voice-steal (still smooth) */
  steal(): void {
    if (this.stage === "idle") return;
    this.releaseStart = Math.max(this.value, 1e-6);
    // Force short release via param snapshot during steal process
    this.stage = "release";
    this.params = {
      ...this.params,
      release: Math.min(this.params.release, 0.012),
    };
  }

  process(): number {
    const p = this.params;
    const sr = this.sampleRate;
    const min = this.minTime;

    switch (this.stage) {
      case "idle":
        this.value = 0;
        break;

      case "attack": {
        const a = Math.max(p.attack, min);
        // Exponential-ish approach to 1 from current
        const coeff = 1 - Math.exp(-1 / (a * sr));
        this.value += (1 - this.value) * coeff;
        if (this.value >= 0.995) {
          this.value = 1;
          this.stage = "decay";
        }
        break;
      }

      case "decay": {
        const d = Math.max(p.decay, min);
        const target = Math.min(Math.max(p.sustain, 0), 1);
        const coeff = 1 - Math.exp(-1 / (d * sr));
        this.value += (target - this.value) * coeff;
        if (Math.abs(this.value - target) < 0.002) {
          this.value = target;
          this.stage = "sustain";
        }
        break;
      }

      case "sustain":
        this.value = Math.min(Math.max(p.sustain, 0), 1);
        break;

      case "release": {
        const r = Math.max(p.release, min);
        const coeff = 1 - Math.exp(-1 / (r * sr));
        this.value += (0 - this.value) * coeff;
        if (this.value <= 0.0005) {
          this.value = 0;
          this.stage = "idle";
        }
        break;
      }
    }
    return this.value;
  }

  get active(): boolean {
    return this.stage !== "idle";
  }
}
