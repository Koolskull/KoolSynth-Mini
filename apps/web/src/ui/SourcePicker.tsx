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
    name: "Sample",
    blurb:
      "Plays a short audio file once per note (with start/length). Great for hits, vowels, and concrete textures under the same op envelopes.",
    history:
      "Coil and Psychic TV pushed experimental sampling in underground circles before it was cool — outskirts of normalcy, boundary-pushing tape and studio collage. Fairlights and the Beatles era had commercial sampling too, but that industrial/occult fringe kept treating samples as ritual material long before banks and one-shots were everyday production furniture.",
  },
  grain: {
    id: "grain",
    code: "GR",
    name: "Granular",
    blurb:
      "Splices the file into tiny windows that travel at a set speed — freeze, smear, or scan through a sound while notes still pitch it. More playful and odd than plain time-stretch: grains can scatter, reverse direction of travel, and recombine into textures stretch alone won’t invent.",
    history:
      "Goldie is a legendary DnB OG who helped pioneer a break-mangling stretch sound that felt rare then — often with studio “guitar” gear like the Eventide H3000 — even though related tools existed earlier on samplers. True granular lineage runs Gabor → Xenakis → computer music; experimental grains push further into scatter and smear than classic timestretch.",
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
