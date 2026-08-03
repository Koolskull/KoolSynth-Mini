interface Props {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label="Help">
      <div className="help-modal">
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
              Four operators (OP1–4). Each can be wave, one-shot sample, or granular.
              Load audio per-op when using sample/grain. Each has amp ADSR, filter + filter env, and Out mix.
            </p>
          </section>
          <section>
            <h3>Algorithm</h3>
            <p>
              Pick a DX7-style diagram (0–7). Filled boxes are carriers (to OUT); hollow are modulators.
              Lines show flow. Under the strip, each edge has mode (fm/am/rm/pd/add) and amount.
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
      <button type="button" className="help-backdrop" aria-label="Close help" onClick={onClose} />
    </div>
  );
}
