import type {
  MasterParams,
  OperatorParams,
  Patch,
} from "../../../../packages/dsp/src/types";
import {
  algorithmOuts,
  defaultPatch,
  linksForAlgorithm,
  mergeOperator,
} from "../../../../packages/dsp/src/types";
import type { WorkletInMessage } from "../../../../packages/worklet/src/processor";

export type EngineStatus = "idle" | "loading" | "ready" | "error";

export class EngineHost {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  status: EngineStatus = "idle";
  patch: Patch = defaultPatch();
  master: MasterParams = { gain: 0.75, softClip: true };
  error: string | null = null;
  pitchBend = 0;
  samples: Record<string, string> = {};

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
          this.syncAll();
          resolve();
        }, 400);

        this.node!.port.onmessage = (ev) => {
          if (ev.data?.type === "ready") {
            clearTimeout(t);
            this.status = "ready";
            this.syncAll();
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

  private syncAll(): void {
    this.post({ type: "loadPatch", patch: this.patch });
    this.post({ type: "setMaster", master: this.master });
    this.post({ type: "setPitchBend", amount: this.pitchBend });
  }

  async resume(): Promise<void> {
    if (!this.ctx) await this.init();
    if (this.ctx!.state === "suspended") await this.ctx!.resume();
  }

  private post(msg: WorkletInMessage, transfer?: Transferable[]): void {
    this.node?.port.postMessage(msg, transfer ?? []);
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

  setPitchBend(amount: number): void {
    const a = Math.min(1, Math.max(-1, amount));
    this.pitchBend = a;
    this.post({ type: "setPitchBend", amount: a });
  }

  setPatch(partial: Partial<Patch>): void {
    if (partial.algorithm !== undefined && partial.algorithm !== this.patch.algorithm) {
      const algorithm = Math.max(0, Math.min(7, Math.round(partial.algorithm)));
      const links = linksForAlgorithm(algorithm);
      const outs = new Set(algorithmOuts(algorithm));
      const operators = this.patch.operators.map((op, i) =>
        mergeOperator(op, { outLevel: outs.has(i) ? Math.max(op.outLevel, 0.7) : 0 }),
      ) as Patch["operators"];
      this.patch = { ...this.patch, algorithm, links, operators };
      this.post({ type: "setPatch", patch: { algorithm, links, operators } });
      this.emit();
      return;
    }

    if (partial.operators) {
      const ops = [
        mergeOperator(this.patch.operators[0], partial.operators[0] ?? {}),
        mergeOperator(this.patch.operators[1], partial.operators[1] ?? {}),
        mergeOperator(this.patch.operators[2], partial.operators[2] ?? {}),
        mergeOperator(this.patch.operators[3], partial.operators[3] ?? {}),
      ] as Patch["operators"];
      this.patch = { ...this.patch, ...partial, operators: ops };
    } else if (partial.fx) {
      this.patch = {
        ...this.patch,
        ...partial,
        fx: [
          { ...this.patch.fx[0], ...partial.fx[0] },
          { ...this.patch.fx[1], ...partial.fx[1] },
          { ...this.patch.fx[2], ...partial.fx[2] },
        ],
      };
    } else if (partial.compressor) {
      this.patch = {
        ...this.patch,
        ...partial,
        compressor: { ...this.patch.compressor, ...partial.compressor },
      };
    } else {
      this.patch = { ...this.patch, ...partial };
    }

    this.post({ type: "setPatch", patch: this.patch });
    this.emit();
  }

  setOperator(index: 0 | 1 | 2 | 3, partial: Partial<OperatorParams>): void {
    const operators = [...this.patch.operators] as Patch["operators"];
    operators[index] = mergeOperator(operators[index], partial);
    this.patch = { ...this.patch, operators };
    this.post({ type: "setPatch", patch: { operators } });
    this.emit();
  }

  setMaster(m: Partial<MasterParams>): void {
    this.master = { ...this.master, ...m };
    this.post({ type: "setMaster", master: this.master });
    this.emit();
  }

  async loadSampleFile(file: File, id?: string): Promise<string> {
    await this.resume();
    const sid = id ?? `smp_${Date.now().toString(36)}`;
    const ab = await file.arrayBuffer();
    if (!this.ctx) throw new Error("no audio context");
    const audio = await this.ctx.decodeAudioData(ab.slice(0));
    const ch = audio.getChannelData(0);
    const copy = new Float32Array(ch.length);
    copy.set(ch);
    this.post(
      { type: "loadSample", id: sid, sampleRate: audio.sampleRate, channelData: copy },
      [copy.buffer],
    );
    this.samples[sid] = file.name;
    this.emit();
    return sid;
  }
}

export const engineHost = new EngineHost();
