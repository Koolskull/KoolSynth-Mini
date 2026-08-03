/**
 * Web MIDI — enabled by default, listens to all inputs.
 */
import { engineHost } from "./engine-host";
import { noteBus } from "./note-bus";

export type MidiStatus = "unsupported" | "pending" | "ready" | "denied" | "error";

class MidiInput {
  status: MidiStatus = "pending";
  error: string | null = null;
  deviceNames: string[] = [];
  private access: MIDIAccess | null = null;
  private listeners = new Set<() => void>();
  private started = false;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** Call once on app mount — no user gesture required for MIDI permission in most browsers */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    if (typeof navigator === "undefined" || !navigator.requestMIDIAccess) {
      this.status = "unsupported";
      this.emit();
      return;
    }

    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.status = "ready";
      this.wireAll();
      this.access.onstatechange = () => {
        this.wireAll();
        this.emit();
      };
      this.emit();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.status = msg.toLowerCase().includes("denied") ? "denied" : "error";
      this.error = msg;
      this.emit();
    }
  }

  private wireAll(): void {
    if (!this.access) return;
    this.deviceNames = [];
    for (const input of this.access.inputs.values()) {
      this.deviceNames.push(input.name ?? input.id);
      input.onmidimessage = (ev) => this.onMessage(ev);
    }
  }

  private onMessage(ev: MIDIMessageEvent): void {
    const data = ev.data;
    if (!data || data.length < 2) return;
    const status = data[0]! & 0xf0;
    const note = data[1]!;
    const vel = data.length > 2 ? data[2]! : 0;

    // Note on
    if (status === 0x90 && vel > 0) {
      void engineHost.resume();
      const v = vel / 127;
      if (noteBus.press(note)) {
        engineHost.noteOn(note, v);
      } else {
        // re-strike
        engineHost.noteOn(note, v);
      }
      return;
    }

    // Note off (or note on vel 0)
    if (status === 0x80 || (status === 0x90 && vel === 0)) {
      if (noteBus.release(note)) {
        engineHost.noteOff(note);
      }
      return;
    }

    // Pitch bend wheel (14-bit, center 8192)
    if (status === 0xe0) {
      const lsb = note;
      const msb = vel;
      const value = (msb << 7) | lsb;
      const amount = (value - 8192) / 8192;
      void engineHost.resume();
      engineHost.setPitchBend(amount);
      return;
    }

    // CC 123 all notes off / CC 120
    if (status === 0xb0 && (note === 123 || note === 120)) {
      engineHost.allNotesOff();
      noteBus.clear();
    }
  }
}

export const midiInput = new MidiInput();
