# KoolSynth Mini

A compact web synthesizer built with **Bun**, **TypeScript**, and **React**.

**Design:** pure black & white, hard rectangular edges, **Kongtext** pixel font.

- **4 operators** — each can be **wave**, **one-shot sample**, or **granular**
- **Genesis-style algorithms A0–A7** with per-link **fm / am / rm / pd / add** + amount
- Per-op amp ADSR, filter + filter ADSR, **Out** mix to the bus
- **Master FX ×3** (reverb · delay · chorus · phaser · distortion) → compressor / limiter
- Renoise keys · ↑/↓ octave · ←/→ pitch bend · MIDI · **?** help
- Real-time DSP in an **AudioWorklet**

UI typeface: **Kongtext** by codeman38 (zone38.net), under `public/fonts/`.

## Live

**https://koolskull.github.io/KoolSynth-Mini/**

(GitHub Pages serves the `docs/` folder on `main`.)

## Quick start

```bash
bun install
bun run dev
```

Open **http://localhost:5173** → **Start** → play.

After `bun run build`, copy `public/*` into `docs/` for Pages.

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
packages/dsp/       Operators, routing, sample/grain, FX, compressor
packages/worklet/   AudioWorkletProcessor shell
docs/               Built site for GitHub Pages
```

## License

Private / yours — add a license when you ship.
