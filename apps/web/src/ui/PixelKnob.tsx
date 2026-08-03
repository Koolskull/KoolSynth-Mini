/*
 * PixelKnob — monochrome rotary (from K-OS-III KoolDraw).
 * 1px ring + arrow tab, value inside. Linear drag ↑/→ increases.
 */
import { useCallback, useEffect, useRef } from "react";

export interface PixelKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayValue?: string;
  onChange: (value: number) => void;
  title?: string;
  size?: number;
  disabled?: boolean;
  layout?: "vertical" | "horizontal";
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function quantize(v: number, step: number) {
  if (step <= 0) return v;
  return Math.round(v / step) * step;
}

function setPx(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function paintKnob(ctx: CanvasRenderingContext2D, cssSize: number, t: number) {
  const S = Math.max(28, Math.round(cssSize));
  ctx.canvas.width = S;
  ctx.canvas.height = S;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, S, S);

  const cx = (S - 1) / 2;
  const cy = (S - 1) / 2;
  const r = Math.floor(S * 0.4);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(d - r) < 0.55) {
        setPx(ctx, x, y, "#888888");
      }
    }
  }

  const startDeg = 135;
  const sweepDeg = 270;
  const degAt = (u: number) => startDeg + u * sweepDeg;
  for (const u of [0, 1]) {
    const a = (degAt(u) * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    setPx(ctx, cx + cos * (r - 2), cy + sin * (r - 2), "#555555");
    setPx(ctx, cx + cos * r, cy + sin * r, "#aaaaaa");
  }

  {
    const a = (degAt(t) * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const px = -sin;
    const py = cos;

    const tipX = cx + cos * (r + 3);
    const tipY = cy + sin * (r + 3);
    const baseX = cx + cos * (r - 1);
    const baseY = cy + sin * (r - 1);
    const w = 2.2;
    const w1x = baseX + px * w - cos * 0.5;
    const w1y = baseY + py * w - sin * 0.5;
    const w2x = baseX - px * w - cos * 0.5;
    const w2y = baseY - py * w - sin * 0.5;

    const minX = Math.floor(Math.min(tipX, w1x, w2x)) - 1;
    const maxX = Math.ceil(Math.max(tipX, w1x, w2x)) + 1;
    const minY = Math.floor(Math.min(tipY, w1y, w2y)) - 1;
    const maxY = Math.ceil(Math.max(tipY, w1y, w2y)) + 1;

    const edge = (ax: number, ay: number, bx: number, by: number, x: number, y: number) =>
      (x - ax) * (by - ay) - (y - ay) * (bx - ax);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const e0 = edge(tipX, tipY, w1x, w1y, x + 0.5, y + 0.5);
        const e1 = edge(w1x, w1y, w2x, w2y, x + 0.5, y + 0.5);
        const e2 = edge(w2x, w2y, tipX, tipY, x + 0.5, y + 0.5);
        if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) {
          if (x >= 0 && y >= 0 && x < S && y < S) setPx(ctx, x, y, "#ffffff");
        }
      }
    }

    const stemR0 = r * 0.45;
    const stemR1 = r - 2;
    const steps = Math.max(2, Math.round(stemR1 - stemR0));
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const rr = stemR0 + (stemR1 - stemR0) * u;
      setPx(ctx, cx + cos * rr, cy + sin * rr, "#ffffff");
    }
  }
}

export function PixelKnob({
  label,
  value,
  min,
  max,
  step = 1,
  displayValue,
  onChange,
  title,
  size = 44,
  disabled = false,
  layout = "vertical",
}: PixelKnobProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startVal: number } | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const span = Math.max(1e-9, max - min);
  const t = clamp((value - min) / span, 0, 1);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    paintKnob(ctx, size, t);
  }, [size, t]);

  const applyDelta = useCallback(
    (dx: number, dy: number, startVal: number) => {
      const pixelsForFull = 100;
      const delta = ((-dy + dx) / pixelsForFull) * span;
      let next = quantize(startVal + delta, step);
      next = clamp(next, min, max);
      if (step >= 1) next = Math.round(next);
      else next = Math.round(next / step) * step;
      // Avoid float noise
      const eps = step > 0 ? step * 0.25 : 1e-6;
      if (Math.abs(next - valueRef.current) >= eps) onChange(next);
    },
    [min, max, step, span, onChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startVal: valueRef.current,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    e.preventDefault();
    applyDelta(e.clientX - d.startX, e.clientY - d.startY, d.startVal);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const shown =
    displayValue ??
    (step >= 1 ? String(Math.round(value)) : value.toFixed(step < 0.01 ? 2 : 1));

  const digits = shown.length;
  const fontPx = digits >= 4 ? 7 : digits === 3 ? 8 : 9;

  const face = (
    <div
      className="pixel-knob-face"
      style={{ width: size, height: size }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
      <span className="pixel-knob-value" style={{ fontSize: fontPx }}>
        {shown}
      </span>
    </div>
  );

  return (
    <div
      className={`pixel-knob pixel-knob--${layout}${disabled ? " is-disabled" : ""}`}
      title={title ?? `${label}: drag ↑/→ to increase`}
      style={layout === "vertical" ? { width: size } : undefined}
    >
      {face}
      <span className="pixel-knob-label">{label}</span>
    </div>
  );
}

export default PixelKnob;
