/** One-shot / looped sample playback with pitch */

export class SamplePlayer {
  private buffer: Float32Array | null = null;
  private bufferSr = 44100;
  private pos = 0;
  private rate = 1;
  private start = 0;
  private end = 0;
  private active = false;
  private oneshot = true;

  setBuffer(data: Float32Array | null, sampleRate: number): void {
    this.buffer = data;
    this.bufferSr = sampleRate;
  }

  trigger(
    sampleRate: number,
    pitchRatio: number,
    start01: number,
    length01: number,
    oneshot = true,
  ): void {
    if (!this.buffer || this.buffer.length < 2) {
      this.active = false;
      return;
    }
    const len = this.buffer.length;
    const win = Math.max(32, Math.floor(len * Math.min(Math.max(length01, 0.001), 1)));
    this.start = Math.floor(Math.min(Math.max(start01, 0), 1) * (len - 2));
    this.end = Math.min(len - 1, this.start + win);
    this.pos = this.start;
    this.rate = pitchRatio * (this.bufferSr / sampleRate);
    this.oneshot = oneshot;
    this.active = true;
  }

  reset(): void {
    this.active = false;
    this.pos = this.start;
  }

  process(): number {
    if (!this.active || !this.buffer) return 0;
    const buf = this.buffer;
    const i0 = Math.floor(this.pos);
    if (i0 >= this.end - 1) {
      if (this.oneshot) {
        this.active = false;
        return 0;
      }
      this.pos = this.start;
      return this.process();
    }
    const frac = this.pos - i0;
    const a = buf[i0]!;
    const b = buf[Math.min(i0 + 1, buf.length - 1)]!;
    const s = a + (b - a) * frac;
    this.pos += this.rate;
    return s;
  }
}
