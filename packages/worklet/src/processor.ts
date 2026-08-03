/**
 * KoolSynth Mini AudioWorkletProcessor → public/processor.js
 */
import { SynthEngine } from "../../dsp/src/engine";
import type { MasterParams, Patch } from "../../dsp/src/types";
import { defaultPatch } from "../../dsp/src/types";

export type WorkletInMessage =
  | { type: "noteOn"; note: number; velocity: number }
  | { type: "noteOff"; note: number }
  | { type: "allNotesOff" }
  | { type: "setPatch"; patch: Partial<Patch> }
  | { type: "setMaster"; master: Partial<MasterParams> }
  | { type: "loadPatch"; patch: Patch }
  /** Pitch bend amount −1…+1 (smoothed by patch.pitchBendLegato) */
  | { type: "setPitchBend"; amount: number }
  | { type: "requestState" };

export type WorkletOutMessage =
  | { type: "ready"; sampleRate: number }
  | { type: "state"; patch: Patch; master: MasterParams };

class KoolSynthProcessor extends AudioWorkletProcessor {
  private engine: SynthEngine;
  private scratchL: Float32Array | null = null;
  private scratchR: Float32Array | null = null;

  constructor() {
    super();
    this.engine = new SynthEngine(sampleRate, defaultPatch());
    this.port.onmessage = (ev: MessageEvent<WorkletInMessage>) => {
      this.handle(ev.data);
    };
    this.port.postMessage({ type: "ready", sampleRate } satisfies WorkletOutMessage);
  }

  private handle(msg: WorkletInMessage): void {
    switch (msg.type) {
      case "noteOn":
        this.engine.noteOn(msg.note, msg.velocity);
        break;
      case "noteOff":
        this.engine.noteOff(msg.note);
        break;
      case "allNotesOff":
        this.engine.allNotesOff();
        break;
      case "setPatch":
        this.engine.setPatch(msg.patch);
        break;
      case "loadPatch":
        this.engine.setPatch(msg.patch);
        break;
      case "setMaster":
        this.engine.setMaster(msg.master);
        break;
      case "setPitchBend":
        this.engine.setPitchBend(msg.amount);
        break;
      case "requestState":
        this.port.postMessage({
          type: "state",
          patch: this.engine.getPatch(),
          master: { gain: 0.85, softClip: true },
        } satisfies WorkletOutMessage);
        break;
    }
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _params: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const L = output[0];
    const R = output[1] ?? output[0];
    const n = L.length;

    if (!this.scratchL || this.scratchL.length !== n) {
      this.scratchL = new Float32Array(n);
      this.scratchR = new Float32Array(n);
    }

    this.engine.process(this.scratchL, this.scratchR!);
    L.set(this.scratchL);
    if (output[1]) R.set(this.scratchR!);

    return true;
  }
}

registerProcessor("koolsynth-mini-processor", KoolSynthProcessor);
