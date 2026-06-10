/**
 * Hand-drawn stroke helpers — the heart of the cutout art style.
 *
 * Everything user-visible is drawn with these: irregular blobs smoothed with
 * quadratic midpoints (never perfect circles), wobbly polylines, and paper
 * speckle. All randomness flows through a seeded Rng so a given prop variant
 * always draws the same — sprites are deterministic, like printed plates.
 */

import type { Rng } from '../physics/mujoco/rng';

export interface Pt {
  x: number;
  y: number;
}

/**
 * Points around an ellipse with per-point radial jitter — the raw shape of a
 * hand-cut blob. `squashTop`/`squashBottom` flatten the shape (e.g. canopies
 * sit flatter on the bottom).
 */
export function blobPoints(
  rng: Rng,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n = 10,
  irregularity = 0.14,
): Pt[] {
  const pts: Pt[] = [];
  const phase = rng.next() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const wobble = 1 + (rng.next() * 2 - 1) * irregularity;
    pts.push({ x: cx + Math.cos(a) * rx * wobble, y: cy + Math.sin(a) * ry * wobble });
  }
  return pts;
}

/** Trace a closed smooth path through `pts` (quadratic midpoint smoothing). */
export function traceBlob(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  const n = pts.length;
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  ctx.beginPath();
  const start = mid(pts[n - 1], pts[0]);
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const next = pts[(i + 1) % n];
    const m = mid(p, next);
    ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
  }
  ctx.closePath();
}

export interface BlobStyle {
  fill?: string | CanvasGradient;
  outline?: string;
  lineWidth?: number;
}

/** Fill (and optionally ink-outline) a smooth blob through `pts`. */
export function paintBlob(ctx: CanvasRenderingContext2D, pts: Pt[], style: BlobStyle): void {
  traceBlob(ctx, pts);
  if (style.fill) {
    ctx.fillStyle = style.fill;
    ctx.fill();
  }
  if (style.outline) {
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.lineWidth ?? 3;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/** Convenience: jittered blob in one call. */
export function blob(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  style: BlobStyle,
  n = 10,
  irregularity = 0.14,
): Pt[] {
  const pts = blobPoints(rng, cx, cy, rx, ry, n, irregularity);
  paintBlob(ctx, pts, style);
  return pts;
}

/**
 * A hand-wobbled stroke between two points: subdivided with perpendicular
 * jitter so no line in the world is ruler-straight.
 */
export function wobblyLine(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  color: string,
  jitter = 1.5,
  segments = 6,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const j = (rng.next() * 2 - 1) * jitter;
    ctx.lineTo(x0 + dx * t + nx * j, y0 + dy * t + ny * j);
  }
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Scatter tiny speckles (paper grain / soil dots) inside a rectangle. */
export function speckle(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  color: string,
  alpha = 0.08,
  maxR = 1.6,
): void {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha * (0.4 + rng.next() * 0.6);
    const r = 0.4 + rng.next() * maxR;
    ctx.beginPath();
    ctx.arc(x + rng.next() * w, y + rng.next() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Short curved grass-stroke (used for tufts and ground accents). */
export function grassStroke(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  x: number,
  baseY: number,
  height: number,
  lean: number,
  width: number,
  color: string,
): void {
  const tipX = x + lean + (rng.next() * 2 - 1) * 2;
  const tipY = baseY - height * (0.85 + rng.next() * 0.3);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * 0.3, baseY - height * 0.6, tipX, tipY);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}
