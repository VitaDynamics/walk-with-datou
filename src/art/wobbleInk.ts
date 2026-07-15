/**
 * Wobbly-ink drawing helpers — a canvas port of the design tool's `wobble.jsx`
 * (from "Main Character Concepts"). Hand-drawn paths are jittered with a seeded
 * RNG and smoothed through Catmull-Rom, so every outline reads as ink laid down
 * by hand rather than a perfect vector. Shared by the walker character plates.
 *
 * Coordinates are in the design's own ~210×218 figure space; the caller scales
 * the finished canvas to its plate. All randomness is deterministic per seed.
 */

import { Rng } from '../physics/mujoco/rng';

export type Pt = [number, number];

/** A simple seeded generator matching the design's `makeRng` flavour. */
function makeRng(seed: number): () => number {
  const rng = new Rng(Math.floor(seed) % 233280);
  return () => rng.next();
}

/** Resample a polyline so segments are ~`step` apart (denser = more wobble). */
function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(d / step));
    for (let j = 1; j <= n; j++) out.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
  }
  return out;
}

/** Nudge interior points by ±amp; endpoints stay put on open paths. */
function jitter(pts: Pt[], seed: number, amp: number, closed: boolean): Pt[] {
  const r = makeRng(seed);
  return pts.map((p, i) => {
    if (!closed && (i === 0 || i === pts.length - 1)) return p;
    return [p[0] + (r() - 0.5) * 2 * amp, p[1] + (r() - 0.5) * 2 * amp] as Pt;
  });
}

/** Trace a Catmull-Rom spline through `pts` onto the context (no stroke/fill). */
function traceCatmull(ctx: CanvasRenderingContext2D, pts: Pt[], closed: boolean): void {
  const n = pts.length;
  const get = (i: number): Pt =>
    closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  ctx.beginPath();
  ctx.moveTo(get(0)[0], get(0)[1]);
  if (n < 3) {
    for (let i = 1; i < n; i++) ctx.lineTo(get(i)[0], get(i)[1]);
    if (closed) ctx.closePath();
    return;
  }
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}

export interface WStyle {
  seed?: number;
  amp?: number;
  step?: number;
  closed?: boolean;
  fill?: string;
  stroke?: string;
  /** Stroke width. Omit to use the sketch default. */
  sw?: number;
}

/** The current "pen": ink colour, default stroke width, jitter amplitude. */
export interface Pen {
  ink: string;
  sw: number;
  amp: number;
}

/** A wobbled path: optional fill, then an ink outline (unless `stroke:'none'`). */
export function wShape(ctx: CanvasRenderingContext2D, pen: Pen, pts: Pt[], style: WStyle = {}): void {
  const { seed = 1, amp = pen.amp, step = 12, closed = false, fill, stroke, sw } = style;
  let P = resample(closed ? [...pts, pts[0]] : pts, step);
  if (closed) P = P.slice(0, -1);
  P = jitter(P, seed, amp, closed);
  traceCatmull(ctx, P, closed);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  const strokeColor = stroke === undefined ? pen.ink : stroke;
  if (strokeColor !== 'none') {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = sw === undefined ? pen.sw : sw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/** Points around an ellipse — for wobbled circles (heads, buns, hands). */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

/** A wobbled ellipse (head, bun, hand, blush). */
export function wEllipse(
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  style: WStyle & { n?: number } = {},
): void {
  const { n = 16, ...rest } = style;
  wShape(ctx, pen, ellipsePts(cx, cy, rx, ry, n), { step: 9, ...rest, closed: true });
}

/** A crisp filled dot (eyes, buttons, highlights) — no wobble needed at scale. */
export function dot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  opacity = 1,
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A two- or three-segment limb: a fat ink underlay along the whole path, then
 * coloured stroke(s) on top (so sock/sleeve colours can change mid-limb).
 * `segs` share endpoints for continuity; omit for a single-colour limb.
 */
export function limb(
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  pts: Pt[],
  w: number,
  color: string,
  seed: number,
  segs?: { pts: Pt[]; color: string; w: number }[],
): void {
  const all = segs ?? [{ pts, color, w }];
  const fullPts = segs
    ? segs.reduce<Pt[]>((acc, s, i) => acc.concat(i === 0 ? s.pts : s.pts.slice(1)), [])
    : pts;
  const maxW = Math.max(...all.map((s) => s.w));
  // Ink underlay (slightly lower wobble, like the design's Limb).
  let P = resample(fullPts, 10);
  P = jitter(P, seed, pen.amp * 0.7, false);
  traceCatmull(ctx, P, false);
  ctx.strokeStyle = pen.ink;
  ctx.lineWidth = maxW + pen.sw * 1.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  // Coloured segments on top.
  all.forEach((s, i) => {
    let SP = resample(s.pts, 10);
    SP = jitter(SP, seed + i * 7, pen.amp * 0.7, false);
    traceCatmull(ctx, SP, false);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.w;
    ctx.stroke();
  });
}
