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
            <h3>Audio</h3>
            <p>Press Start Audio (or play a key) to unlock sound. Panic silences all notes.</p>
          </section>
          <section>
            <h3>Keyboard (Renoise map)</h3>
            <p>
              Lower octave: Z S X D C V G B H N J M , . /
              <br />
              Upper octave: Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P
            </p>
          </section>
          <section>
            <h3>Arrows</h3>
            <p>
              ↑ / ↓ — change octave
              <br />
              ← / → — pitch bend (hold). Range &amp; glide: PB Rng / PB Leg knobs.
            </p>
          </section>
          <section>
            <h3>MIDI</h3>
            <p>All inputs listened by default. Pitch wheel uses the same bend range/legato.</p>
          </section>
          <section>
            <h3>Operators</h3>
            <p>
              Three ops with wave, level, ratio/mod, own amp ADSR, and own filter + filter ADSR.
              Modes: subtractive, FM, phase distortion (PD), additive.
            </p>
          </section>
          <section>
            <h3>Knobs</h3>
            <p>Drag up / right to increase, down / left to decrease.</p>
          </section>
        </div>
      </div>
      <button type="button" className="help-backdrop" aria-label="Close help" onClick={onClose} />
    </div>
  );
}
