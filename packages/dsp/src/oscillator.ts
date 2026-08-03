import type { Waveform } from "./types";

/** Free-running phase oscillator with basic waveforms + PD / noise */
export class Oscillator {
  phase = 0;
  private sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  reset(phase = 0): void {
    this.phase = phase;
  }

  /**
   * Advance and return sample in [-1, 1].
   * @param freq Hz
   * @param waveform
   * @param pw pulse width 0–1
   * @param pdAmount phase-distortion amount 0–1 (warps phase before wave shape)
   * @param pdFormant formant / window shape for PD (uses ratio-ish value)
   */
  process(
    freq: number,
    waveform: Waveform,
    pw = 0.5,
    pdAmount = 0,
    pdFormant = 1,
  ): number {
    const inc = freq / this.sampleRate;
    let ph = this.phase;

    // Phase distortion: fold rising phase into a skewed window (Casio CZ-ish)
    let shaped = ph;
    if (pdAmount > 0.0001 && waveform !== "noise") {
      const d = Math.min(Math.max(pdAmount, 0), 1);
      const form = Math.max(pdFormant, 0.25);
      // piecewise linear PD: compress first portion, expand rest
      const split = 0.5 / form;
      if (ph < split) {
        shaped = (ph / split) * (0.5 * (1 - d) + 0.5 * d * form);
      } else {
        const t = (ph - split) / (1 - split);
        shaped = 0.5 * (1 - d) + 0.5 * d * form + t * (1 - 0.5 * (1 - d) - 0.5 * d * form);
      }
      shaped = shaped - Math.floor(shaped);
      // blend dry/wet phase
      shaped = ph * (1 - d) + shaped * d;
      shaped = shaped - Math.floor(shaped);
    }

    let s = 0;
    switch (waveform) {
      case "sine":
        s = Math.sin(2 * Math.PI * shaped);
        break;
      case "triangle":
        s = 1 - 4 * Math.abs(Math.round(shaped - 0.25) - (shaped - 0.25));
        break;
      case "saw":
        s = 2 * shaped - 1;
        break;
      case "square": {
        const width = Math.min(Math.max(pw, 0.02), 0.98);
        s = shaped < width ? 1 : -1;
        break;
      }
      case "noise":
        s = Math.random() * 2 - 1;
        break;
    }

    this.phase += inc;
    if (this.phase >= 1) this.phase -= Math.floor(this.phase);
    return s;
  }
}
