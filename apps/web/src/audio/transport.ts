/**
 * Performance transport: octave shift for PC keys + on-screen keyboard.
 * Pitch-bend amount is sent to the engine; range/legato live on the patch.
 */

type Listener = () => void;

/** Z-row C MIDI when octaveOffset === 0 */
export const BASE_NOTE = 48; // C3

const OCTAVE_MIN = -3;
const OCTAVE_MAX = 4;

class Transport {
  /** Octave offset from base (0 → C3 on Z) */
  octaveOffset = 0;
  /** Held bend buttons: −1 left, +1 right */
  private bendLeft = false;
  private bendRight = false;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  get baseNote(): number {
    return BASE_NOTE + this.octaveOffset * 12;
  }

  /** Display label e.g. "C3" for Z-row root */
  get octaveLabel(): string {
    const note = this.baseNote;
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const name = names[note % 12]!;
    const oct = Math.floor(note / 12) - 1;
    return `${name}${oct}`;
  }

  shiftOctave(delta: number): void {
    const next = Math.min(OCTAVE_MAX, Math.max(OCTAVE_MIN, this.octaveOffset + delta));
    if (next === this.octaveOffset) return;
    this.octaveOffset = next;
    this.emit();
  }

  setBendLeft(down: boolean): void {
    if (this.bendLeft === down) return;
    this.bendLeft = down;
    this.emit();
  }

  setBendRight(down: boolean): void {
    if (this.bendRight === down) return;
    this.bendRight = down;
    this.emit();
  }

  /** Combined target −1…+1 from arrow keys (both = 0) */
  get bendTarget(): number {
    if (this.bendLeft && this.bendRight) return 0;
    if (this.bendLeft) return -1;
    if (this.bendRight) return 1;
    return 0;
  }

  releaseBends(): void {
    if (!this.bendLeft && !this.bendRight) return;
    this.bendLeft = false;
    this.bendRight = false;
    this.emit();
  }
}

export const transport = new Transport();
