/**
 * DX7 / OG-FM style algorithm diagrams — hard pixel boxes + 1px flow lines.
 * Ops labeled 1–4 (internal indices 0–3). Carriers feed the bottom OUT rail.
 */
import { useEffect, useRef, useState } from "react";
import { algorithmEdges, algorithmOuts } from "../../../../packages/dsp/src/types";

/** Grid units (each cell is SCALE px). Diagram is GW × GH cells. */
const GW = 7;
const GH = 6;
const SCALE = 5; // → 35×30 canvas (compact)

type Pt = { x: number; y: number };

/** Per-algo layout: op index → cell center (col, row) in grid space */
const LAYOUTS: Pt[][] = [
  // 0 serial
  [
    { x: 3, y: 0 },
    { x: 3, y: 1 },
    { x: 3, y: 2 },
    { x: 3, y: 3 },
  ],
  // 1
  [
    { x: 2, y: 0 },
    { x: 4, y: 0 },
    { x: 3, y: 2 },
    { x: 3, y: 3 },
  ],
  // 2
  [
    { x: 1, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 2 },
    { x: 3, y: 3 },
  ],
  // 3
  [
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 5, y: 1 },
    { x: 3, y: 3 },
  ],
  // 4 dual stacks
  [
    { x: 1, y: 0 },
    { x: 1, y: 2 },
    { x: 5, y: 0 },
    { x: 5, y: 2 },
  ],
  // 5 one→three
  [
    { x: 3, y: 0 },
    { x: 1, y: 2 },
    { x: 3, y: 2 },
    { x: 5, y: 2 },
  ],
  // 6
  [
    { x: 1, y: 0 },
    { x: 1, y: 2 },
    { x: 3, y: 2 },
    { x: 5, y: 2 },
  ],
  // 7 parallel
  [
    { x: 0, y: 1 },
    { x: 2, y: 1 },
    { x: 4, y: 1 },
    { x: 6, y: 1 },
  ],
];

function setPx(ctx: CanvasRenderingContext2D, x: number, y: number, c = "#fff") {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function hline(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
  const a = Math.min(x0, x1);
  const b = Math.max(x0, x1);
  for (let x = a; x <= b; x++) setPx(ctx, x, y);
}

function vline(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number) {
  const a = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  for (let y = a; y <= b; y++) setPx(ctx, x, y);
}

/** Orthogonal route from box-bottom to box-top (or mid for side joins) */
function wire(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  // from bottom of src to top of dst
  const midY = Math.round((ay + by) / 2);
  vline(ctx, ax, ay, midY);
  hline(ctx, ax, bx, midY);
  vline(ctx, bx, midY, by);
}

/** 3×5 pixel digits 1–4 */
const DIGITS: Record<string, number[][]> = {
  "1": [
    [0, 1, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [1, 1, 1],
  ],
  "2": [
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
  ],
  "3": [
    [1, 1, 1],
    [0, 0, 1],
    [0, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  "4": [
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [0, 0, 1],
  ],
};

function drawDigit(ctx: CanvasRenderingContext2D, cx: number, cy: number, d: string) {
  const g = DIGITS[d];
  if (!g) return;
  const ox = cx - 1;
  const oy = cy - 2;
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if (g[y]![x]) setPx(ctx, ox + x, oy + y);
    }
  }
}

function boxCenter(layout: Pt[], op: number): { px: number; py: number } {
  const p = layout[op]!;
  // cell center in pixels
  return {
    px: Math.round((p.x + 0.5) * SCALE),
    py: Math.round((p.y + 0.5) * SCALE),
  };
}

const BOX_W = 9;
const BOX_H = 9;

function drawBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  label: string,
  invert: boolean,
) {
  const x0 = cx - Math.floor(BOX_W / 2);
  const y0 = cy - Math.floor(BOX_H / 2);
  // fill
  ctx.fillStyle = invert ? "#fff" : "#000";
  ctx.fillRect(x0, y0, BOX_W, BOX_H);
  // 1px border
  for (let x = x0; x < x0 + BOX_W; x++) {
    setPx(ctx, x, y0);
    setPx(ctx, x, y0 + BOX_H - 1);
  }
  for (let y = y0; y < y0 + BOX_H; y++) {
    setPx(ctx, x0, y);
    setPx(ctx, x0 + BOX_W - 1, y);
  }
  // digit (invert color when box filled)
  if (invert) {
    // punch digit by black pixels
    const g = DIGITS[label];
    if (g) {
      const ox = cx - 1;
      const oy = cy - 2;
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 3; x++) {
          if (g[y]![x]) {
            ctx.fillStyle = "#000";
            ctx.fillRect(ox + x, oy + y, 1, 1);
          }
        }
      }
    }
  } else {
    drawDigit(ctx, cx, cy, label);
  }
}

function paintAlgo(ctx: CanvasRenderingContext2D, algo: number, selected: boolean) {
  const W = GW * SCALE;
  const H = GH * SCALE;
  ctx.canvas.width = W;
  ctx.canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = selected ? "#111" : "#000";
  ctx.fillRect(0, 0, W, H);

  // subtle border when selected
  if (selected) {
    for (let x = 0; x < W; x++) {
      setPx(ctx, x, 0, "#fff");
      setPx(ctx, x, H - 1, "#fff");
    }
    for (let y = 0; y < H; y++) {
      setPx(ctx, 0, y, "#fff");
      setPx(ctx, W - 1, y, "#fff");
    }
  }

  const layout = LAYOUTS[algo % 8]!;
  const edges = algorithmEdges(algo);
  const outs = new Set(algorithmOuts(algo));

  // OUT rail near bottom
  const outY = H - 4;
  hline(ctx, 4, W - 5, outY);
  // tiny OUT ticks
  setPx(ctx, 4, outY - 1);
  setPx(ctx, W - 5, outY - 1);

  // wires first (under boxes)
  for (const [src, dst] of edges) {
    const a = boxCenter(layout, src);
    const b = boxCenter(layout, dst);
    const ay = a.py + Math.floor(BOX_H / 2);
    const by = b.py - Math.floor(BOX_H / 2);
    wire(ctx, a.px, ay, b.px, by);
  }

  // carriers → out rail
  for (const o of outs) {
    const c = boxCenter(layout, o);
    const ay = c.py + Math.floor(BOX_H / 2);
    vline(ctx, c.px, ay, outY);
  }

  // operator boxes
  for (let i = 0; i < 4; i++) {
    const c = boxCenter(layout, i);
    drawBox(ctx, c.px, c.py, String(i + 1), outs.has(i));
  }
}

interface DiagramProps {
  algo: number;
  selected?: boolean;
  size?: number; // unused — fixed compact
}

export function AlgoDiagram({ algo, selected = false }: DiagramProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    paintAlgo(ctx, algo, selected);
  }, [algo, selected]);

  return (
    <canvas
      ref={ref}
      className="algo-diagram"
      width={GW * SCALE}
      height={GH * SCALE}
      aria-hidden
    />
  );
}

interface PickerProps {
  algorithm: number;
  onSelect: (algo: number) => void;
}

/**
 * Collapsed: one small box with the active diagram.
 * Tap → expands to pick 0–7; choosing one collapses again.
 */
export function AlgoPicker({ algorithm, onSelect }: PickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`algo-picker${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="algo-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        title={`Algorithm ${algorithm} — tap to change`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="algo-thumb-num">{algorithm}</span>
        <AlgoDiagram algo={algorithm} selected />
      </button>

      {open && (
        <div className="algo-menu" role="listbox" aria-label="Algorithms">
          {Array.from({ length: 8 }, (_, a) => {
            const sel = algorithm === a;
            return (
              <button
                key={a}
                type="button"
                role="option"
                aria-selected={sel}
                className={`algo-thumb${sel ? " is-active" : ""}`}
                title={`Algorithm ${a}`}
                onClick={() => {
                  onSelect(a);
                  setOpen(false);
                }}
              >
                <span className="algo-thumb-num">{a}</span>
                <AlgoDiagram algo={a} selected={sel} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
