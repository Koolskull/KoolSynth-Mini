/**
 * Operator source type picker (wave / sample / grain) — educational submenu.
 */
import { useEffect, useRef, useState } from "react";
import type { OpSource } from "../../../../packages/dsp/src/types";

export const SOURCES: OpSource[] = ["wave", "sample", "grain"];

interface Info {
  id: OpSource;
  code: string;
  name: string;
  blurb: string;
  history: string;
}

export const SOURCE_INFO: Record<OpSource, Info> = {
  wave: {
    id: "wave",
    code: "WV",
    name: "Waveform",
    blurb:
      "Classic oscillator: sine, triangle, saw, square, or noise. Pitch follows note, ratio, and detune — the backbone of virtual-analog and FM operators.",
    history:
      "The free-running oscillator is the oldest synth voice. Moog, Buchla, and every digital VA still start here.",
  },
  sample: {
    id: "sample",
    code: "SM",
    name: "One-shot",
    blurb:
      "Plays a short audio file once per note (with start/length). Great for hits, vowels, and concrete textures under the same op envelopes.",
    history:
      "Sampler keyboards (Fairlight, Emulator, SP-1200) made one-shots the pulse of hip-hop and late-’80s production.",
  },
  grain: {
    id: "grain",
    code: "GR",
    name: "Granular",
    blurb:
      "Splices the file into tiny windows that travel at a set speed — freeze, smear, or scan through a sound while notes still pitch it.",
    history:
      "Granular ideas trace to Gabor and Xenakis; real-time grain engines arrived with computers and modern DAW plugins.",
  },
};

interface Props {
  value: OpSource;
  onChange: (v: OpSource) => void;
  opLabel?: string;
}

export function SourcePicker({ value, onChange, opLabel }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const info = SOURCE_INFO[value];

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
            aria-label="Close source menu"
            onClick={() => setOpen(false)}
          />
          <div className="edu-menu submenu-panel" role="listbox" aria-label="Operator source">
            <header className="edu-menu-head">
              <span>Source</span>
              {opLabel && <span className="edu-menu-meta">{opLabel}</span>}
            </header>
            <ul className="edu-menu-list">
              {SOURCES.map((id) => {
                const m = SOURCE_INFO[id];
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
