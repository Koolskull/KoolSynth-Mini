/**
 * Waveform picker — educational submenu (sine / tri / saw / square / noise).
 */
import { useEffect, useRef, useState } from "react";
import type { Waveform } from "../../../../packages/dsp/src/types";

export const WAVES: Waveform[] = ["sine", "triangle", "saw", "square", "noise"];

interface Info {
  id: Waveform;
  code: string;
  name: string;
  blurb: string;
  history: string;
}

export const WAVE_INFO: Record<Waveform, Info> = {
  sine: {
    id: "sine",
    code: "SI",
    name: "Sine",
    blurb:
      "A pure single partial — smooth and dark alone; the ideal FM carrier/modulator for clean sidebands.",
    history:
      "Fourier’s pure tone. Early electronic music and every digital oscillator still treat sine as ground zero.",
  },
  triangle: {
    id: "triangle",
    code: "TR",
    name: "Triangle",
    blurb:
      "Odd harmonics that fall off fast — softer than a square, great for flutes, leads, and gentle modulators.",
    history:
      "A modular classic: easy to generate from square integration, milder than saw/square for pads.",
  },
  saw: {
    id: "saw",
    code: "SW",
    name: "Sawtooth",
    blurb:
      "Bright ramp with all harmonics. The workhorse of subtractive synths — strings, basses, supersaws.",
    history:
      "The sound of analog polyphony: Minimoog basses to JP-8000 supersaws ride the sawtooth spectrum.",
  },
  square: {
    id: "square",
    code: "SQ",
    name: "Square",
    blurb:
      "Odd harmonics only — hollow, clarinet-like. Pulse width (PW) morphs it toward thinner reed tones.",
    history:
      "From chip music (2A03, SID) to 808 hats-as-noise cousins; PWM was a signature ’70s–’80s move.",
  },
  noise: {
    id: "noise",
    code: "NZ",
    name: "Noise",
    blurb:
      "Random spectrum every sample — air, hats, breath, chaos. Filter it hard for wind and percussion.",
    history:
      "Noise generators were built into drum machines and modulars for snares, wind, and explosions.",
  },
};

interface Props {
  value: Waveform;
  onChange: (v: Waveform) => void;
  opLabel?: string;
}

export function WaveformPicker({ value, onChange, opLabel }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const info = WAVE_INFO[value];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.body.classList.add("submenu-open");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("submenu-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`edu-picker${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="edu-trigger"
        aria-expanded={open}
        title={info.name}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="edu-code">{info.code}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="submenu-scrim"
            aria-label="Close waveform menu"
            onClick={() => setOpen(false)}
          />
          <div className="edu-menu submenu-panel" role="listbox" aria-label="Waveform">
            <header className="edu-menu-head">
              <span>Wave</span>
              {opLabel && <span className="edu-menu-meta">{opLabel}</span>}
            </header>
            <ul className="edu-menu-list">
              {WAVES.map((id) => {
                const m = WAVE_INFO[id];
                const sel = value === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={sel}
                      className={`edu-option${sel ? " is-active" : ""}`}
                      onClick={() => {
                        onChange(id);
                        setOpen(false);
                      }}
                    >
                      <span className="edu-option-code">{m.code}</span>
                      <span className="edu-option-body">
                        <span className="edu-option-name">{m.name}</span>
                        <span className="edu-option-blurb">{m.blurb}</span>
                        <span className="edu-option-hist">{m.history}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
