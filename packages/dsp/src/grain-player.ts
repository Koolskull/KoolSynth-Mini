/** Simple granular player: windowed grains that travel at variable speed */

export class GrainPlayer {
  private buffer: Float32Array | null = null;
  private bufferSr = 44100;
  private playhead = 0; // samples in buffer
  private grainPos = 0;
  private grainStart = 0;
  private grainLen = 256;
  private rate = 1;
  private speed = 0; // playhead travel per output sample
  private densityPhase = 0;
  private density = 20;
  private spray = 0;
  private winStart = 0;
  private winEnd = 0;
  private active = false;
  private env = 0;

  setBuffer(data: Float32Array | null, sampleRate: number): void {
    this.buffer = data;
    this.bufferSr = sampleRate;
  }

  trigger(
    sampleRate: number,
    pitchRatio: number,
    start01: number,
    length01: number,
    grainSize01: number,
    density01: number,
    travelSpeed: number,
    spray01: number,
  ): void {
    if (!this.buffer || this.buffer.length < 64) {
      this.active = false;
      return;
    }
    const len = this.buffer.length;
    const win = Math.max(64, Math.floor(len * Math.min(Math.max(length01, 0.01), 1)));
    this.winStart = Math.floor(Math.min(Math.max(start01, 0), 1) * Math.max(1, len - win));
    this.winEnd = Math.min(len, this.winStart + win);
    this.playhead = this.winStart;
    this.rate = pitchRatio * (this.bufferSr / sampleRate);
    // travel: −2…2 maps to fraction of window per second
    this.speed = (travelSpeed * win) / sampleRate;
    this.density = 4 + density01 * 60;
    this.spray = spray01;
    this.grainLen = Math.max(
      32,
      Math.floor((0.005 + grainSize01 * 0.12) * sampleRate),
    );
    this.spawnGrain();
    this.densityPhase = 0;
    this.active = true;
  }

  private spawnGrain(): void {
    if (!this.buffer) return;
    const span = Math.max(1, this.winEnd - this.winStart - this.grainLen);
    let s = this.playhead;
    if (this.spray > 0) {
      s += (Math.random() * 2 - 1) * this.spray * span;
    }
    this.grainStart = Math.max(this.winStart, Math.min(s, this.winEnd - 2));
    this.grainPos = 0;
  }

  reset(): void {
    this.active = false;
  }

  process(): number {
    if (!this.active || !this.buffer) return 0;
    const buf = this.buffer;

    // travel playhead
    this.playhead += this.speed;
    if (this.playhead >= this.winEnd) this.playhead = this.winStart;
    if (this.playhead < this.winStart) this.playhead = this.winEnd - 1;

    // grain spawn
    this.densityPhase += this.density / 48000; // approx; engine sampleRate used via grainLen
    // use fixed density increment relative to grainLen
    this.densityPhase += this.density / (this.grainLen * 8);
    if (this.densityPhase >= 1 || this.grainPos >= this.grainLen) {
      this.densityPhase = 0;
      this.spawnGrain();
    }

    const t = this.grainPos / this.grainLen;
    // Hann window
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
    const read = this.grainStart + this.grainPos * this.rate;
    const i0 = Math.floor(read);
    if (i0 < 0 || i0 >= buf.length - 1) {
      this.grainPos++;
      return 0;
    }
    const frac = read - i0;
    const s = buf[i0]! + (buf[i0 + 1]! - buf[i0]!) * frac;
    this.grainPos++;
    this.env = w;
    return s * w;
  }
}
