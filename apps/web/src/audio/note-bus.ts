/**
 * Shared held-note set so piano UI, PC keys, and MIDI stay in sync.
 */
type Listener = () => void;

class NoteBus {
  private held = new Set<number>();
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  isHeld(note: number): boolean {
    return this.held.has(note);
  }

  getHeld(): ReadonlySet<number> {
    return this.held;
  }

  press(note: number): boolean {
    if (this.held.has(note)) return false;
    this.held.add(note);
    this.emit();
    return true;
  }

  release(note: number): boolean {
    if (!this.held.has(note)) return false;
    this.held.delete(note);
    this.emit();
    return true;
  }

  clear(): void {
    if (this.held.size === 0) return;
    this.held.clear();
    this.emit();
  }

  snapshot(): number[] {
    return [...this.held];
  }
}

export const noteBus = new NoteBus();
