import type { MasterParams, Patch } from "../../../../packages/dsp/src/types";
import { defaultPatch, mergeOsc } from "../../../../packages/dsp/src/types";
import type { WorkletInMessage } from "../../../../packages/worklet/src/processor";

export type EngineStatus = "idle" | "loading" | "ready" | "error";

export class EngineHost {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  status: EngineStatus = "idle";
  patch: Patch = defaultPatch();
  master: MasterParams = { gain: 0.75, softClip: true };
  error: string | null = null;
  /** Last pitch-bend target we sent (−1…1) */
  pitchBend = 0;

  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  async init(): Promise<void> {
    if (this.status === "ready" || this.status === "loading") return;
    this.status = "loading";
    this.error = null;
    this.emit();

    try {
      this.ctx = new AudioContext({ latencyHint: "interactive" });
      // Relative to page URL so GitHub Pages project sites work (/repo/)
      const processorUrl = new URL("processor.js", window.location.href).href;
      await this.ctx.audioWorklet.addModule(processorUrl);
      this.node = new AudioWorkletNode(this.ctx, "koolsynth-mini-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.node.connect(this.ctx.destination);

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          this.status = "ready";
          this.post({ type: "loadPatch", patch: this.patch });
          this.post({ type: "setMaster", master: this.master });
          this.post({ type: "setPitchBend", amount: this.pitchBend });
          resolve();
        }, 400);

        this.node!.port.onmessage = (ev) => {
          if (ev.data?.type === "ready") {
            clearTimeout(t);
            this.status = "ready";
            this.post({ type: "loadPatch", patch: this.patch });
            this.post({ type: "setMaster", master: this.master });
            this.post({ type: "setPitchBend", amount: this.pitchBend });
            this.emit();
            resolve();
          }
        };

        this.node!.onprocessorerror = () => {
          clearTimeout(t);
          reject(new Error("AudioWorklet processor error"));
        };
      });

      this.emit();
    } catch (e) {
      this.status = "error";
      this.error = e instanceof Error ? e.message : String(e);
      this.emit();
      throw e;
    }
  }

  async resume(): Promise<void> {
    if (!this.ctx) await this.init();
    if (this.ctx!.state === "suspended") await this.ctx!.resume();
  }

  private post(msg: WorkletInMessage): void {
    this.node?.port.postMessage(msg);
  }

  noteOn(note: number, velocity = 0.85): void {
    this.post({ type: "noteOn", note, velocity });
  }

  noteOff(note: number): void {
    this.post({ type: "noteOff", note });
  }

  allNotesOff(): void {
    this.post({ type: "allNotesOff" });
  }

  /** −1…+1; engine applies range × amount with legato smoothing */
  setPitchBend(amount: number): void {
    const a = Math.min(1, Math.max(-1, amount));
    this.pitchBend = a;
    this.post({ type: "setPitchBend", amount: a });
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
    };
    this.post({ type: "setPatch", patch: this.patch });
    this.emit();
  }

  setOsc(index: 0 | 1 | 2, partial: Partial<Patch["oscillators"][0]>): void {
    const next = [...this.patch.oscillators] as Patch["oscillators"];
    next[index] = mergeOsc(next[index], partial);
    this.setPatch({ oscillators: next });
  }

  setMaster(m: Partial<MasterParams>): void {
    this.master = { ...this.master, ...m };
    this.post({ type: "setMaster", master: this.master });
    this.emit();
  }
}

/** Singleton host for the app */
export const engineHost = new EngineHost();
