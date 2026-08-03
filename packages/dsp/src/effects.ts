import type { CompressorParams, FxSlotParams } from "./types";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Small FDN reverb */
class ReverbFx {
  private delays: Float32Array[] = [];
  private idx: number[] = [];
  private lp: number[] = [];
  private sr = 48000;

  configure(sr: number, size: number): void {
    this.sr = sr;
    const base = [0.029, 0.037, 0.043, 0.053, 0.061, 0.071, 0.083, 0.097];
    const scale = 0.5 + size * 1.8;
    for (let i = 0; i < 8; i++) {
      const n = Math.max(4, Math.floor(base[i]! * scale * sr));
      if (!this.delays[i] || this.delays[i]!.length !== n) {
        this.delays[i] = new Float32Array(n);
        this.idx[i] = 0;
        this.lp[i] = 0;
      }
    }
  }

  process(x: number, feedback: number, damp: number): number {
    let acc = 0;
    const fb = clamp(feedback, 0, 0.95);
    const d = clamp(damp, 0, 0.95);
    for (let i = 0; i < 8; i++) {
      const buf = this.delays[i]!;
      const j = this.idx[i]!;
      const y = buf[j]!;
      this.lp[i] = y + (this.lp[i]! - y) * d;
      const inS = x + this.lp[i]! * fb;
      buf[j] = inS;
      this.idx[i] = (j + 1) % buf.length;
      acc += y;
    }
    return acc * 0.125;
  }
}

class DelayFx {
  private buf = new Float32Array(1);
  private i = 0;
  private sr = 48000;

  configure(sr: number, maxSec = 1.5): void {
    this.sr = sr;
    const n = Math.max(4, Math.floor(maxSec * sr));
    if (this.buf.length !== n) {
      this.buf = new Float32Array(n);
      this.i = 0;
    }
  }

  process(x: number, timeSec: number, feedback: number): number {
    const n = this.buf.length;
    const delay = Math.min(n - 1, Math.max(1, Math.floor(timeSec * this.sr)));
    const ri = (this.i - delay + n) % n;
    const y = this.buf[ri]!;
    this.buf[this.i] = x + y * clamp(feedback, 0, 0.95);
    this.i = (this.i + 1) % n;
    return y;
  }
}

class ChorusFx {
  private buf = new Float32Array(1);
  private i = 0;
  private phase = 0;
  private sr = 48000;

  configure(sr: number): void {
    this.sr = sr;
    const n = Math.floor(0.05 * sr);
    if (this.buf.length !== n) {
      this.buf = new Float32Array(Math.max(64, n));
      this.i = 0;
    }
  }

  process(x: number, rate: number, depth: number): number {
    const n = this.buf.length;
    this.buf[this.i] = x;
    this.phase += (0.1 + rate * 4) / this.sr;
    if (this.phase > 1) this.phase -= 1;
    const mod = (0.5 + 0.5 * Math.sin(this.phase * Math.PI * 2)) * depth * 0.02 * this.sr;
    const d = Math.min(n - 2, Math.max(1, mod));
    const ri = this.i - d;
    const i0 = Math.floor(ri);
    const frac = ri - i0;
    const a = this.buf[((i0 % n) + n) % n]!;
    const b = this.buf[(((i0 + 1) % n) + n) % n]!;
    this.i = (this.i + 1) % n;
    return a + (b - a) * frac;
  }
}

class PhaserFx {
  private ap = [0, 0, 0, 0, 0, 0];
  private phase = 0;
  private sr = 48000;

  configure(sr: number): void {
    this.sr = sr;
  }

  process(x: number, rate: number, feedback: number): number {
    this.phase += (0.05 + rate * 2) / this.sr;
    if (this.phase > 1) this.phase -= 1;
    const f = 0.1 + 0.8 * (0.5 + 0.5 * Math.sin(this.phase * Math.PI * 2));
    let y = x;
    const g = clamp(feedback, 0, 0.95);
    for (let i = 0; i < 6; i++) {
      const inS = y + this.ap[i]! * g * 0.15;
      const out = -inS + f * (inS - this.ap[i]!);
      this.ap[i] = inS + f * out;
      y = out;
    }
    return y;
  }
}

/** One FX slot processor */
export class FxSlot {
  private reverb = new ReverbFx();
  private delay = new DelayFx();
  private chorus = new ChorusFx();
  private phaser = new PhaserFx();
  private sr = 48000;

  configure(sr: number): void {
    this.sr = sr;
    this.reverb.configure(sr, 0.5);
    this.delay.configure(sr);
    this.chorus.configure(sr);
    this.phaser.configure(sr);
  }

  process(x: number, p: FxSlotParams): number {
    if (p.type === "none" || p.mix <= 0.0001) return x;
    let wet = 0;
    switch (p.type) {
      case "reverb":
        this.reverb.configure(this.sr, p.paramA);
        wet = this.reverb.process(x, 0.4 + p.paramB * 0.55, p.paramC);
        break;
      case "delay":
        wet = this.delay.process(x, 0.05 + p.paramA * 0.9, p.paramB);
        break;
      case "chorus":
        wet = this.chorus.process(x, p.paramA, p.paramB);
        break;
      case "phaser":
        wet = this.phaser.process(x, p.paramA, p.paramB);
        break;
      case "distortion": {
        const drive = 1 + p.paramA * 12;
        const shaped = Math.tanh(x * drive * (0.5 + p.paramB));
        wet = shaped - x * 0.3;
        break;
      }
      default:
        return x;
    }
    const m = clamp(p.mix, 0, 1);
    return x * (1 - m) + wet * m;
  }
}

/** Simple peak compressor / soft limiter */
export class Compressor {
  private env = 0;
  private sr = 48000;

  configure(sr: number): void {
    this.sr = sr;
  }

  process(x: number, p: CompressorParams): number {
    const abs = Math.abs(x);
    const atk = Math.exp(-1 / (Math.max(p.attack, 0.0005) * this.sr));
    const rel = Math.exp(-1 / (Math.max(p.release, 0.005) * this.sr));
    if (abs > this.env) this.env = atk * this.env + (1 - atk) * abs;
    else this.env = rel * this.env + (1 - rel) * abs;

    const thr = clamp(p.threshold, 0.05, 1);
    const ratio = Math.max(1, p.ratio);
    let g = 1;
    if (this.env > thr) {
      const over = this.env / thr;
      const compressed = Math.pow(over, 1 - 1 / ratio);
      g = compressed / over;
    }
    const makeup = 1 + clamp(p.makeup, 0, 1) * 2;
    let y = x * g * makeup;
    // brick-ish soft limit
    y = Math.tanh(y * 1.05);
    return y;
  }
}

export class FxChain {
  private slots = [new FxSlot(), new FxSlot(), new FxSlot()];
  private comp = new Compressor();

  configure(sr: number): void {
    for (const s of this.slots) s.configure(sr);
    this.comp.configure(sr);
  }

  process(
    x: number,
    fx: [FxSlotParams, FxSlotParams, FxSlotParams],
    comp: CompressorParams,
  ): number {
    let y = x;
    y = this.slots[0]!.process(y, fx[0]);
    y = this.slots[1]!.process(y, fx[1]);
    y = this.slots[2]!.process(y, fx[2]);
    y = this.comp.process(y, comp);
    return y;
  }
}
