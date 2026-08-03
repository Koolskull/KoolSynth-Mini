import { useEffect, useState } from "react";
import type { FxType, LinkMode } from "../../../../packages/dsp/src/types";
import { engineHost } from "../audio/engine-host";
import { midiInput } from "../audio/midi-input";
import { noteBus } from "../audio/note-bus";
import { transport } from "../audio/transport";
import { HelpModal } from "./HelpModal";
import { Keyboard } from "./Keyboard";
import { LINK_MODES, OpPanel } from "./OpPanel";
import { PixelKnob } from "./PixelKnob";

const FX_TYPES: FxType[] = ["none", "reverb", "delay", "chorus", "phaser", "distortion"];
const KNOB = 48;

export function App() {
  const [, tick] = useState(0);
  const [booting, setBooting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => engineHost.subscribe(() => tick((n) => n + 1)), []);
  useEffect(() => midiInput.subscribe(() => tick((n) => n + 1)), []);
  useEffect(() => transport.subscribe(() => tick((n) => n + 1)), []);
  useEffect(() => {
    void midiInput.start();
  }, []);
  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  const patch = engineHost.patch;
  const status = engineHost.status;

  const start = async () => {
    setBooting(true);
    try {
      await engineHost.resume();
      void midiInput.start();
    } finally {
      setBooting(false);
    }
  };

  const panic = () => {
    engineHost.allNotesOff();
    noteBus.clear();
  };

  const setLink = (i: number, mode?: LinkMode, amount?: number) => {
    const links = patch.links.map((l, idx) => {
      if (idx !== i) return l;
      return {
        ...l,
        ...(mode !== undefined ? { mode } : {}),
        ...(amount !== undefined ? { amount } : {}),
      };
    });
    engineHost.setPatch({ links });
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1>
            KoolSynth Mini
            <span className="cursor" aria-hidden />
          </h1>
        </div>
        <div className="header-actions">
          <span className={`status ${status === "ready" ? "ready" : status === "error" ? "error" : ""}`}>
            {status === "ready" ? "audio" : status === "error" ? "err" : status}
          </span>
          <span className={`status ${midiInput.status === "ready" ? "ready" : ""}`}>
            {midiInput.status === "ready" ? "midi" : "midi…"}
          </span>
          {status !== "ready" && (
            <button className="btn primary" onClick={() => void start()} disabled={booting}>
              {booting ? "…" : "Start"}
            </button>
          )}
          <button className="btn" type="button" onClick={panic}>
            Panic
          </button>
          <button className="btn btn-help" type="button" aria-label="Help" onClick={() => setHelpOpen(true)}>
            ?
          </button>
        </div>
      </header>

      <div className="main">
        <section className="panel">
          <h2>Algorithm · Links</h2>
          <div className="algo-row">
            {Array.from({ length: 8 }, (_, a) => (
              <button
                key={a}
                type="button"
                className={`mode-btn${patch.algorithm === a ? " active" : ""}`}
                onClick={() => engineHost.setPatch({ algorithm: a })}
              >
                A{a}
              </button>
            ))}
          </div>
          <div className="links-list">
            {patch.links.length === 0 && (
              <span className="osc-sub-label">parallel — no mod edges (A7)</span>
            )}
            {patch.links.map((link, i) => (
              <div className="link-row" key={`${link.src}-${link.dst}-${i}`}>
                <span className="link-label">
                  OP{link.src + 1}→OP{link.dst + 1}
                </span>
                <select
                  className="osc-wave"
                  value={link.mode}
                  onChange={(e) => setLink(i, e.target.value as LinkMode)}
                >
                  {LINK_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <PixelKnob
                  size={40}
                  label="Amt"
                  value={link.amount}
                  min={0}
                  max={4}
                  step={0.01}
                  displayValue={link.amount.toFixed(2)}
                  onChange={(v) => setLink(i, undefined, v)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Operators</h2>
          <div className="osc-grid osc-grid-4">
            <OpPanel index={0} op={patch.operators[0]} />
            <OpPanel index={1} op={patch.operators[1]} />
            <OpPanel index={2} op={patch.operators[2]} />
            <OpPanel index={3} op={patch.operators[3]} />
          </div>
        </section>

        <section className="panel">
          <h2>Master · FX ×3 · Comp</h2>
          <div className="fx-slots">
            {([0, 1, 2] as const).map((slot) => {
              const fx = patch.fx[slot];
              return (
                <div className="fx-card" key={slot}>
                  <header className="osc-head">
                    <span className="osc-title">FX{slot + 1}</span>
                    <select
                      className="osc-wave"
                      value={fx.type}
                      onChange={(e) => {
                        const next = [...patch.fx] as typeof patch.fx;
                        next[slot] = { ...fx, type: e.target.value as FxType };
                        engineHost.setPatch({ fx: next });
                      }}
                    >
                      {FX_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </header>
                  <div className="knob-row">
                    <PixelKnob
                      size={KNOB}
                      label="Mix"
                      value={fx.mix}
                      min={0}
                      max={1}
                      step={0.01}
                      displayValue={fx.mix.toFixed(2)}
                      onChange={(v) => {
                        const next = [...patch.fx] as typeof patch.fx;
                        next[slot] = { ...fx, mix: v };
                        engineHost.setPatch({ fx: next });
                      }}
                    />
                    <PixelKnob
                      size={KNOB}
                      label="A"
                      value={fx.paramA}
                      min={0}
                      max={1}
                      step={0.01}
                      displayValue={fx.paramA.toFixed(2)}
                      onChange={(v) => {
                        const next = [...patch.fx] as typeof patch.fx;
                        next[slot] = { ...fx, paramA: v };
                        engineHost.setPatch({ fx: next });
                      }}
                    />
                    <PixelKnob
                      size={KNOB}
                      label="B"
                      value={fx.paramB}
                      min={0}
                      max={1}
                      step={0.01}
                      displayValue={fx.paramB.toFixed(2)}
                      onChange={(v) => {
                        const next = [...patch.fx] as typeof patch.fx;
                        next[slot] = { ...fx, paramB: v };
                        engineHost.setPatch({ fx: next });
                      }}
                    />
                    <PixelKnob
                      size={KNOB}
                      label="C"
                      value={fx.paramC}
                      min={0}
                      max={1}
                      step={0.01}
                      displayValue={fx.paramC.toFixed(2)}
                      onChange={(v) => {
                        const next = [...patch.fx] as typeof patch.fx;
                        next[slot] = { ...fx, paramC: v };
                        engineHost.setPatch({ fx: next });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="knob-rack" style={{ marginTop: 10 }}>
            <PixelKnob
              size={KNOB}
              label="Master"
              value={engineHost.master.gain}
              min={0}
              max={1}
              step={0.01}
              displayValue={engineHost.master.gain.toFixed(2)}
              onChange={(v) => engineHost.setMaster({ gain: v })}
            />
            <PixelKnob
              size={KNOB}
              label="Thr"
              value={patch.compressor.threshold}
              min={0.05}
              max={1}
              step={0.01}
              displayValue={patch.compressor.threshold.toFixed(2)}
              onChange={(v) =>
                engineHost.setPatch({
                  compressor: { ...patch.compressor, threshold: v },
                })
              }
            />
            <PixelKnob
              size={KNOB}
              label="Ratio"
              value={patch.compressor.ratio}
              min={1}
              max={20}
              step={0.1}
              displayValue={patch.compressor.ratio.toFixed(1)}
              onChange={(v) =>
                engineHost.setPatch({
                  compressor: { ...patch.compressor, ratio: v },
                })
              }
            />
            <PixelKnob
              size={KNOB}
              label="Make"
              value={patch.compressor.makeup}
              min={0}
              max={1}
              step={0.01}
              displayValue={patch.compressor.makeup.toFixed(2)}
              onChange={(v) =>
                engineHost.setPatch({
                  compressor: { ...patch.compressor, makeup: v },
                })
              }
            />
            <PixelKnob
              size={KNOB}
              label="PB Rng"
              value={patch.pitchBendRange}
              min={0}
              max={24}
              step={1}
              displayValue={String(Math.round(patch.pitchBendRange))}
              onChange={(v) => engineHost.setPatch({ pitchBendRange: v })}
            />
            <PixelKnob
              size={KNOB}
              label="PB Leg"
              value={patch.pitchBendLegato}
              min={0.001}
              max={1}
              step={0.001}
              displayValue={
                patch.pitchBendLegato < 0.01
                  ? patch.pitchBendLegato.toFixed(3)
                  : patch.pitchBendLegato.toFixed(2)
              }
              onChange={(v) => engineHost.setPatch({ pitchBendLegato: v })}
            />
          </div>
        </section>
      </div>

      <footer className="keyboard-dock">
        <Keyboard />
      </footer>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
