/**
 * Modulation-type picker — same focus treatment as algo submenu.
 * Shows 2-letter code, short how-it-works blurb, and a historical note.
 */
import { useEffect, useRef, useState } from "react";
import type { LinkMode } from "../../../../packages/dsp/src/types";

export const LINK_MODES: LinkMode[] = ["fm", "am", "rm", "pd", "add"];

export interface LinkModeInfo {
  id: LinkMode;
  /** Two-letter badge */
  code: string;
  name: string;
  /** What it does in this synth */
  blurb: string;
  /** Short history / lore */
  history: string;
}

export const LINK_MODE_INFO: Record<LinkMode, LinkModeInfo> = {
  fm: {
    id: "fm",
    code: "FM",
    name: "Phase / FM",
    blurb:
      "The modulator nudges the carrier’s phase (DX-style). Strong amounts bloom into metallic sidebands and evolving timbres.",
    history:
      "Chowning’s FM work (1960s–70s) and the Yamaha DX7 (1983) made phase-mod FM the defining digital sound of the ’80s.",
  },
  am: {
    id: "am",
    code: "AM",
    name: "Amplitude",
    blurb:
      "The modulator scales the carrier’s loudness. Gentle = tremolo; deeper = richer sidebands without hard FM clang.",
    history:
      "Amplitude modulation is older than synths — AM radio — and was a staple of modular voltage control from the 1960s on.",
  },
  rm: {
    id: "rm",
    code: "RM",
    name: "Ring mod",
    blurb:
      "Multiplies the two signals. You hear sum and difference tones — often hollow, bell-like, or robotic.",
    history:
      "Named for the diode “ring” circuit. Ring mod powered sci-fi voices, Stockhausen, and classic modular patches.",
  },
  pd: {
    id: "pd",
    code: "PD",
    name: "Phase dist.",
    blurb:
      "Warps how the carrier’s wave is read, brightening and formant-shaping without classic FM ratios.",
    history:
      "Casio’s CZ series (mid-1980s) popularized phase distortion as a cheaper, punchy cousin of FM.",
  },
  add: {
    id: "add",
    code: "AD",
    name: "Additive",
    blurb:
      "Mixes the modulator into the carrier’s path as raw audio — stacking partials / body before the dest filter.",
    history:
      "Additive thinking goes back to Helmholtz: complex tones as summed simple waves — the idea behind organs and spectral synths.",
  },
};

interface Props {
  value: LinkMode;
  onChange: (mode: LinkMode) => void;
  /** Optional label for a11y e.g. "1→2" */
  edgeLabel?: string;
}

export function LinkModePicker({ value, onChange, edgeLabel }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const info = LINK_MODE_INFO[value];

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
    <div className={`mod-picker${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="mod-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        title={edgeLabel ? `${edgeLabel}: ${info.name}` : info.name}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mod-code">{info.code}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="submenu-scrim"
            aria-label="Close modulation menu"
            onClick={() => setOpen(false)}
          />
          <div
            className="mod-menu submenu-panel"
            role="listbox"
            aria-label={edgeLabel ? `Modulation ${edgeLabel}` : "Modulation type"}
          >
            <header className="mod-menu-head">
              <span>Mod type</span>
              {edgeLabel && <span className="mod-menu-edge">{edgeLabel}</span>}
            </header>
            <ul className="mod-menu-list">
              {LINK_MODES.map((id) => {
                const m = LINK_MODE_INFO[id];
                const sel = value === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={sel}
                      className={`mod-option${sel ? " is-active" : ""}`}
                      onClick={() => {
                        onChange(id);
                        setOpen(false);
                      }}
                    >
                      <span className="mod-option-code">{m.code}</span>
                      <span className="mod-option-body">
                        <span className="mod-option-name">{m.name}</span>
                        <span className="mod-option-blurb">{m.blurb}</span>
                        <span className="mod-option-hist">{m.history}</span>
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
