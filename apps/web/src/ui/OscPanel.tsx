import type { OscParams, Waveform } from "../../../../packages/dsp/src/types";
import { engineHost } from "../audio/engine-host";
import { PixelKnob } from "./PixelKnob";

const WAVES: Waveform[] = ["sine", "triangle", "saw", "square", "noise"];
const KNOB = 52;

interface Props {
  index: 0 | 1 | 2;
  osc: OscParams;
  mode: string;
}

export function OscPanel({ index, osc, mode }: Props) {
  const set = (partial: Partial<OscParams>) => engineHost.setOsc(index, partial);

  const modLabel =
    mode === "fm" ? "FM" : mode === "pd" ? "PD" : mode === "additive" ? "Tilt" : "Mod";
  const ratioLabel = mode === "additive" ? "Harm" : "Ratio";

  return (
    <div className="osc-card">
      <header className="osc-head">
        <span className="osc-title">OP{index + 1}</span>
        <select
          className="osc-wave"
          value={osc.waveform}
          onChange={(e) => set({ waveform: e.target.value as Waveform })}
          title="Waveform"
        >
          {WAVES.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <label className="toggle osc-on">
          <input
            type="checkbox"
            checked={osc.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
          ON
        </label>
      </header>

      <div className="knob-row">
        <PixelKnob
          size={KNOB}
          label="Semi"
          value={osc.semi}
          min={-24}
          max={24}
          step={1}
          onChange={(v) => set({ semi: v })}
        />
        <PixelKnob
          size={KNOB}
          label="Cents"
          value={osc.cents}
          min={-50}
          max={50}
          step={1}
          onChange={(v) => set({ cents: v })}
        />
        <PixelKnob
          size={KNOB}
          label="Level"
          value={osc.level}
          min={0}
          max={1}
          step={0.01}
          displayValue={osc.level.toFixed(2)}
          onChange={(v) => set({ level: v })}
        />
        <PixelKnob
          size={KNOB}
          label={ratioLabel}
          value={osc.ratio}
          min={0.25}
          max={8}
          step={0.01}
          displayValue={osc.ratio.toFixed(2)}
          onChange={(v) => set({ ratio: v })}
        />
        <PixelKnob
          size={KNOB}
          label={modLabel}
          value={osc.mod}
          min={0}
          max={4}
          step={0.01}
          displayValue={osc.mod.toFixed(2)}
          onChange={(v) => set({ mod: v })}
        />
        {osc.waveform === "square" && (
          <PixelKnob
            size={KNOB}
            label="PW"
            value={osc.pw}
            min={0.05}
            max={0.95}
            step={0.01}
            displayValue={osc.pw.toFixed(2)}
            onChange={(v) => set({ pw: v })}
          />
        )}
      </div>

      <div className="osc-sub">
        <span className="osc-sub-label">Amp</span>
        <div className="knob-row">
          <PixelKnob
            size={KNOB}
            label="A"
            value={osc.amp.attack}
            min={0}
            max={2}
            step={0.01}
            displayValue={osc.amp.attack.toFixed(2)}
            onChange={(v) => set({ amp: { ...osc.amp, attack: v } })}
          />
          <PixelKnob
            size={KNOB}
            label="D"
            value={osc.amp.decay}
            min={0}
            max={2}
            step={0.01}
            displayValue={osc.amp.decay.toFixed(2)}
            onChange={(v) => set({ amp: { ...osc.amp, decay: v } })}
          />
          <PixelKnob
            size={KNOB}
            label="S"
            value={osc.amp.sustain}
            min={0}
            max={1}
            step={0.01}
            displayValue={osc.amp.sustain.toFixed(2)}
            onChange={(v) => set({ amp: { ...osc.amp, sustain: v } })}
          />
          <PixelKnob
            size={KNOB}
            label="R"
            value={osc.amp.release}
            min={0}
            max={3}
            step={0.01}
            displayValue={osc.amp.release.toFixed(2)}
            onChange={(v) => set({ amp: { ...osc.amp, release: v } })}
          />
        </div>
      </div>

      <div className="osc-sub">
        <span className="osc-sub-label">Filter</span>
        <div className="knob-row">
          <PixelKnob
            size={KNOB}
            label="Cut"
            value={osc.filter.cutoff}
            min={80}
            max={12000}
            step={1}
            displayValue={String(Math.round(osc.filter.cutoff))}
            onChange={(v) => set({ filter: { ...osc.filter, cutoff: v } })}
          />
          <PixelKnob
            size={KNOB}
            label="Res"
            value={osc.filter.resonance}
            min={0}
            max={0.95}
            step={0.01}
            displayValue={osc.filter.resonance.toFixed(2)}
            onChange={(v) => set({ filter: { ...osc.filter, resonance: v } })}
          />
          <PixelKnob
            size={KNOB}
            label="Amt"
            value={osc.filter.envAmount}
            min={-4}
            max={4}
            step={0.05}
            displayValue={osc.filter.envAmount.toFixed(1)}
            onChange={(v) => set({ filter: { ...osc.filter, envAmount: v } })}
          />
        </div>
      </div>

      <div className="osc-sub">
        <span className="osc-sub-label">F.Env</span>
        <div className="knob-row">
          <PixelKnob
            size={KNOB}
            label="A"
            value={osc.filterEnv.attack}
            min={0}
            max={2}
            step={0.01}
            displayValue={osc.filterEnv.attack.toFixed(2)}
            onChange={(v) => set({ filterEnv: { ...osc.filterEnv, attack: v } })}
          />
          <PixelKnob
            size={KNOB}
            label="D"
            value={osc.filterEnv.decay}
            min={0}
            max={2}
            step={0.01}
            displayValue={osc.filterEnv.decay.toFixed(2)}
            onChange={(v) => set({ filterEnv: { ...osc.filterEnv, decay: v } })}
          />
          <PixelKnob
            size={KNOB}
            label="S"
            value={osc.filterEnv.sustain}
            min={0}
            max={1}
            step={0.01}
            displayValue={osc.filterEnv.sustain.toFixed(2)}
            onChange={(v) => set({ filterEnv: { ...osc.filterEnv, sustain: v } })}
          />
          <PixelKnob
            size={KNOB}
            label="R"
            value={osc.filterEnv.release}
            min={0}
            max={3}
            step={0.01}
            displayValue={osc.filterEnv.release.toFixed(2)}
            onChange={(v) => set({ filterEnv: { ...osc.filterEnv, release: v } })}
          />
        </div>
      </div>
    </div>
  );
}
