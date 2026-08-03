import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("submenu-open");
    return () => document.body.classList.remove("submenu-open");
  }, [open]);

  if (!open) return null;

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label="Help">
      <button type="button" className="submenu-scrim" aria-label="Close help" onClick={onClose} />
      <div className="help-modal submenu-panel">
        <header className="help-modal-head">
          <h2>KoolSynth Mini</h2>
          <button type="button" className="btn help-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="help-modal-body">
          <section>
            <h3>Operators</h3>
            <p>
              Four operators (OP1–4). Tap WV/SM/GR for source type, SI/TR/SW… for waveforms (with
              short lessons). Sample/grain open the bank: local cache first, device import ≤128KB
              after you allow access. Amp ADSR, filter + filter env, Out mix per op.
            </p>
          </section>
          <section>
            <h3>Algorithm</h3>
            <p>
              Pick a DX7-style diagram (0–7). Filled boxes are carriers (to OUT); hollow are modulators.
              Lines show flow. Tap an edge’s two-letter mod badge (FM, AM, RM, PD, AD) for a learning
              menu — what it does plus a short history — then amount with the knob.
            </p>
          </section>
          <section>
            <h3>Master FX</h3>
            <p>
              Three serial FX slots: reverb, delay, chorus, phaser, distortion (or none), then a
              compressor / soft limiter into the output.
            </p>
          </section>
          <section>
            <h3>Keyboard</h3>
            <p>
              Renoise map: Z-row lower, Q-row upper. ↑/↓ octave, ←/→ pitch bend. MIDI notes + wheel.
            </p>
          </section>
          <section>
            <h3>Knobs</h3>
            <p>Drag up / right to increase.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
