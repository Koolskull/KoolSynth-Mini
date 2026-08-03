import type {
  LinkMode,
  OperatorParams,
  OpSource,
  Waveform,
} from "../../../../packages/dsp/src/types";
import { engineHost } from "../audio/engine-host";
import { PixelKnob } from "./PixelKnob";

const WAVES: Waveform[] = ["sine", "triangle", "saw", "square", "noise"];
const SOURCES: OpSource[] = ["wave", "sample", "grain"];
const KNOB = 48;

interface Props {
  index: 0 | 1 | 2 | 3;
  op: OperatorParams;
}

export function OpPanel({ index, op }: Props) {
  const set = (partial: Partial<OperatorParams>) => engineHost.setOperator(index, partial);

  const onSample = async (file: File | null) => {
    if (!file) return;
    const id = await engineHost.loadSampleFile(file, `op${index}_${file.name}`);
    set({ sampleId: id, source: op.source === "wave" ? "sample" : op.source });
  };

  return (
    <div className="osc-card">
      <header className="osc-head">
        <span className="osc-title">OP{index + 1}</span>
        <select
          className="osc-wave"
          value={op.source}
          onChange={(e) => set({ source: e.target.value as OpSource })}
          title="Source"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {op.source === "wave" ? (
          <select
            className="osc-wave"
            value={op.waveform}
            onChange={(e) => set({ waveform: e.target.value as Waveform })}
          >
            {WAVES.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        ) : (
          <label className="btn sample-btn">
            {op.sampleId ? engineHost.samples[op.sampleId] ?? "smp" : "load"}
            <input
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => void onSample(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
        <label className="toggle osc-on">
          <input
            type="checkbox"
            checked={op.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
          ON
        </label>
      </header>

      <div className="knob-row">
        <PixelKnob size={KNOB} label="Semi" value={op.semi} min={-24} max={24} step={1} onChange={(v) => set({ semi: v })} />
        <PixelKnob size={KNOB} label="Cents" value={op.cents} min={-50} max={50} step={1} onChange={(v) => set({ cents: v })} />
        <PixelKnob size={KNOB} label="Level" value={op.level} min={0} max={1} step={0.01} displayValue={op.level.toFixed(2)} onChange={(v) => set({ level: v })} />
        <PixelKnob size={KNOB} label="Ratio" value={op.ratio} min={0.25} max={8} step={0.01} displayValue={op.ratio.toFixed(2)} onChange={(v) => set({ ratio: v })} />
        <PixelKnob size={KNOB} label="Out" value={op.outLevel} min={0} max={1} step={0.01} displayValue={op.outLevel.toFixed(2)} onChange={(v) => set({ outLevel: v })} />
        {op.source === "wave" && (
          <PixelKnob size={KNOB} label="PD" value={op.pd} min={0} max={1} step={0.01} displayValue={op.pd.toFixed(2)} onChange={(v) => set({ pd: v })} />
        )}
        {op.source === "sample" && (
          <>
            <PixelKnob size={KNOB} label="Start" value={op.sampleStart} min={0} max={1} step={0.01} displayValue={op.sampleStart.toFixed(2)} onChange={(v) => set({ sampleStart: v })} />
            <PixelKnob size={KNOB} label="Len" value={op.sampleLength} min={0.01} max={1} step={0.01} displayValue={op.sampleLength.toFixed(2)} onChange={(v) => set({ sampleLength: v })} />
          </>
        )}
        {op.source === "grain" && (
          <>
            <PixelKnob size={KNOB} label="Start" value={op.sampleStart} min={0} max={1} step={0.01} displayValue={op.sampleStart.toFixed(2)} onChange={(v) => set({ sampleStart: v })} />
            <PixelKnob size={KNOB} label="Len" value={op.sampleLength} min={0.01} max={1} step={0.01} displayValue={op.sampleLength.toFixed(2)} onChange={(v) => set({ sampleLength: v })} />
            <PixelKnob size={KNOB} label="GSize" value={op.grainSize} min={0.01} max={1} step={0.01} displayValue={op.grainSize.toFixed(2)} onChange={(v) => set({ grainSize: v })} />
            <PixelKnob size={KNOB} label="Dens" value={op.grainDensity} min={0} max={1} step={0.01} displayValue={op.grainDensity.toFixed(2)} onChange={(v) => set({ grainDensity: v })} />
            <PixelKnob size={KNOB} label="Speed" value={op.grainSpeed} min={-2} max={2} step={0.01} displayValue={op.grainSpeed.toFixed(2)} onChange={(v) => set({ grainSpeed: v })} />
            <PixelKnob size={KNOB} label="Spray" value={op.grainSpray} min={0} max={1} step={0.01} displayValue={op.grainSpray.toFixed(2)} onChange={(v) => set({ grainSpray: v })} />
          </>
        )}
      </div>

      <div className="osc-sub">
        <span className="osc-sub-label">Amp</span>
        <div className="knob-row">
          <PixelKnob size={KNOB} label="A" value={op.amp.attack} min={0} max={2} step={0.01} displayValue={op.amp.attack.toFixed(2)} onChange={(v) => set({ amp: { ...op.amp, attack: v } })} />
          <PixelKnob size={KNOB} label="D" value={op.amp.decay} min={0} max={2} step={0.01} displayValue={op.amp.decay.toFixed(2)} onChange={(v) => set({ amp: { ...op.amp, decay: v } })} />
          <PixelKnob size={KNOB} label="S" value={op.amp.sustain} min={0} max={1} step={0.01} displayValue={op.amp.sustain.toFixed(2)} onChange={(v) => set({ amp: { ...op.amp, sustain: v } })} />
          <PixelKnob size={KNOB} label="R" value={op.amp.release} min={0} max={3} step={0.01} displayValue={op.amp.release.toFixed(2)} onChange={(v) => set({ amp: { ...op.amp, release: v } })} />
        </div>
      </div>

      <div className="osc-sub">
        <span className="osc-sub-label">Filter</span>
        <div className="knob-row">
          <PixelKnob size={KNOB} label="Cut" value={op.filter.cutoff} min={80} max={12000} step={1} displayValue={String(Math.round(op.filter.cutoff))} onChange={(v) => set({ filter: { ...op.filter, cutoff: v } })} />
          <PixelKnob size={KNOB} label="Res" value={op.filter.resonance} min={0} max={0.95} step={0.01} displayValue={op.filter.resonance.toFixed(2)} onChange={(v) => set({ filter: { ...op.filter, resonance: v } })} />
          <PixelKnob size={KNOB} label="Amt" value={op.filter.envAmount} min={-4} max={4} step={0.05} displayValue={op.filter.envAmount.toFixed(1)} onChange={(v) => set({ filter: { ...op.filter, envAmount: v } })} />
        </div>
      </div>

      <div className="osc-sub">
        <span className="osc-sub-label">F.Env</span>
        <div className="knob-row">
          <PixelKnob size={KNOB} label="A" value={op.filterEnv.attack} min={0} max={2} step={0.01} displayValue={op.filterEnv.attack.toFixed(2)} onChange={(v) => set({ filterEnv: { ...op.filterEnv, attack: v } })} />
          <PixelKnob size={KNOB} label="D" value={op.filterEnv.decay} min={0} max={2} step={0.01} displayValue={op.filterEnv.decay.toFixed(2)} onChange={(v) => set({ filterEnv: { ...op.filterEnv, decay: v } })} />
          <PixelKnob size={KNOB} label="S" value={op.filterEnv.sustain} min={0} max={1} step={0.01} displayValue={op.filterEnv.sustain.toFixed(2)} onChange={(v) => set({ filterEnv: { ...op.filterEnv, sustain: v } })} />
          <PixelKnob size={KNOB} label="R" value={op.filterEnv.release} min={0} max={3} step={0.01} displayValue={op.filterEnv.release.toFixed(2)} onChange={(v) => set({ filterEnv: { ...op.filterEnv, release: v } })} />
        </div>
      </div>
    </div>
  );
}

export const LINK_MODES: LinkMode[] = ["fm", "am", "rm", "pd", "add"];
