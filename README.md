# KoolSynth Mini

A compact web synthesizer built with **Bun**, **TypeScript**, and **React**.

**Design:** pure black & white, hard rectangular edges (no rounded corners), **Kongtext** pixel font. Simple UI, deep sound design. Responsive portrait + landscape; two-octave keyboard docked at the bottom.

- Two-octave+ keyboard + **Renoise tracker map** (Z-row lower / Q-row upper)
- **↑/↓** octave · **←/→** pitch bend (range + legato knobs)
- Per-operator amp ADSR + filter ADSR · **?** help panel
- **Web MIDI** listened by default (notes + pitch wheel)
- Three oscillator operators with **PixelKnob** rotaries (KoolDraw-style)
- Modes: **subtractive**, **FM**, **phase distortion (PD)**, **additive**
- Smooth poly ADSR (no hard snaps), poly headroom, soft voice-steal, DC block
- Amp ADSR, SVF filter, soft-clip master
- Real-time DSP in an **AudioWorklet** (pure TS engine, unit-tested)

UI typeface: **Kongtext** by codeman38 (zone38.net), under `public/fonts/`. Free to bundle with apps; not for resale as a font pack.

## Live

After push to `main`, GitHub Pages deploys from `public/` via Actions:

**https://koolskull.github.io/KoolSynth-Mini/**

## Quick start

```bash
bun install
bun run dev
```

Open **http://localhost:5173** → **Start** → play Z/Q rows or MIDI.

## Scripts

| Command | |
|---------|--|
| `bun run dev` | Build + watch + serve |
| `bun run build` | Production build → `public/` |
| `bun test` | DSP unit tests |
| `bun run typecheck` | `tsc --noEmit` |

## Layout

```
apps/web/           React UI + AudioContext host + Bun dev server
packages/dsp/       Pure real-time DSP (no Web Audio APIs)
packages/worklet/   AudioWorkletProcessor shell
scripts/build.ts    Production bundle
public/             Built assets (gitignored outputs)
```

```
UI (React) --postMessage--> AudioWorklet (SynthEngine)
                                 ├── voices[]
                                 │     └── 3 × Oscillator + ADSR + SVF
                                 └── master soft-clip
```

## Modes (v0)

| Mode | Behavior |
|------|----------|
| **subtractive** | Mix 3 oscs → filter |
| **fm** | Op2 → Op1 → Op0 carrier chain |
| **pd** | Per-osc phase distortion (CZ-ish) |
| **additive** | Oscs as harmonic partials with tilt |

## License

Private / yours — add a license when you ship.
