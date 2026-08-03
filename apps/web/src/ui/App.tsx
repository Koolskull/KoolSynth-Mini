import { useEffect, useState } from "react";
import type { SynthMode } from "../../../../packages/dsp/src/types";
import { engineHost } from "../audio/engine-host";
import { midiInput } from "../audio/midi-input";
import { noteBus } from "../audio/note-bus";
import { transport } from "../audio/transport";
import { HelpModal } from "./HelpModal";
import { Keyboard } from "./Keyboard";
import { OscPanel } from "./OscPanel";
import { PixelKnob } from "./PixelKnob";

const MODES: SynthMode[] = ["subtractive", "fm", "pd", "additive"];

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
          <span
            className={`status ${status === "ready" ? "ready" : status === "error" ? "error" : ""}`}
          >
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
          <button
            className="btn btn-help"
            type="button"
            aria-label="Help"
            title="Help"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </button>
        </div>
      </header>

      <div className="main">
        <section className="panel">
          <h2>Mode</h2>
          <div className="mode-row">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                className={`mode-btn${patch.mode === m ? " active" : ""}`}
                onClick={() => engineHost.setPatch({ mode: m })}
              >
                {m}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Operators</h2>
          <div className="osc-grid">
            <OscPanel index={0} osc={patch.oscillators[0]} mode={patch.mode} />
            <OscPanel index={1} osc={patch.oscillators[1]} mode={patch.mode} />
            <OscPanel index={2} osc={patch.oscillators[2]} mode={patch.mode} />
          </div>
        </section>

        <section className="panel">
          <h2>Master</h2>
          <div className="knob-rack">
            <PixelKnob
              size={52}
              label="Master"
              value={engineHost.master.gain}
              min={0}
              max={1}
              step={0.01}
              displayValue={engineHost.master.gain.toFixed(2)}
              onChange={(v) => engineHost.setMaster({ gain: v })}
            />
            <PixelKnob
              size={52}
              label="PB Rng"
              value={patch.pitchBendRange}
              min={0}
              max={24}
              step={1}
              displayValue={String(Math.round(patch.pitchBendRange))}
              onChange={(v) => engineHost.setPatch({ pitchBendRange: v })}
            />
            <PixelKnob
              size={52}
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
