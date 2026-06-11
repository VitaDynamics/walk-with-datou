/**
 * The walker's cutout plates — Mei & An from "Main Character Concepts", drawn
 * in the project's hand-drawn ink language (a canvas port of the design tool's
 * parametric figure). Three plates feed the billboarded HumanRig:
 *
 *   head  — skin · per-character hair & face · headgear        (bottom-anchored)
 *   torso — outfit top · over-torso bottom · arms · extras     (bottom-anchored)
 *   leg   — one leg with sock + shoe, drawn twice by the rig    (top-anchored)
 *
 * Head and torso come in two VIEWS: 'front' (facing the camera) and 'side'
 * (a true profile facing +x; the rig mirrors it for leftward walking). Plates
 * of both views share the same figure-frame vertical spans, so one
 * plateLayout() serves both. All art is deterministic per seed, keyed to
 * character + outfit + age. Geometry is derived per call from AGE_M so kid /
 * teen / adult read as the same cast — head stays big, limbs stretch.
 */

import { INK, WALKER as W } from './palette';
import { dot, limb, wEllipse, wShape, type Pen, type Pt } from './wobbleInk';
import { createCanvas, ctx2d } from './textures';
import {
  AGE_M,
  CAST,
  DIRECTIONS,
  type AgeId,
  type CharId,
  type DirId,
  type Fit,
} from './walkerData';
import type { PropSprite } from './props';

/** Which way the plate faces — 'side' is a profile drawn facing +x. */
export type ViewId = 'front' | 'side';

/** A torso plate plus the leash-hand anchor as a 0..1 fraction of the plate. */
export interface TorsoSprite extends PropSprite {
  /** Leash-hand position within the plate: u = x fraction, v = y fraction (top→bottom). */
  hand: { u: number; v: number };
}

// ---- the pen: matches the design's smoothed-line defaults (low wobble) ----
const PEN: Pen = { ink: INK.line, sw: 2.3, amp: 0.35 };

const ARM_OUT = 6;

/** Resolved figure geometry for one age, in the shared ~210-wide frame. */
interface Geo {
  cx: number;
  ground: number;
  hipY: number;
  torsoTop: number;
  hcy: number;
  m: (typeof AGE_M)[AgeId];
}

const CX = 110;
const GROUND = 292;

function makeGeo(age: AgeId): Geo {
  const m = AGE_M[age];
  const hipY = GROUND - m.legL;
  const torsoTop = hipY - m.torsoH;
  // The head floats neckL above the collar so the drawn neck actually shows.
  const hcy = torsoTop - m.hry - m.neckL;
  return { cx: CX, ground: GROUND, hipY, torsoTop, hcy, m };
}

function sprite(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = createCanvas(w, h);
  return { c, g: ctx2d(c) };
}

/** Small ellipse-as-points helper for stroking pom/button outlines. */
function ellipseTip(cx: number, cy: number, r: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

// =====================================================================
//  HEAD PLATE  — skin, hair (per character), face (personality), hat
// =====================================================================

function meiHairBehind(g: CanvasRenderingContext2D, geo: Geo, hair: string, seed: number): void {
  const { cx, hcy, m } = geo;
  const bunR = m.hrx * 0.34;
  wEllipse(g, PEN, cx - m.hrx * 0.94, hcy - m.hry * 0.7, bunR, bunR, { fill: hair, seed, n: 12 });
  wEllipse(g, PEN, cx + m.hrx * 0.94, hcy - m.hry * 0.7, bunR, bunR, { fill: hair, seed: seed + 1, n: 12 });
  bow(g, cx + m.hrx * 0.94, hcy - m.hry * 0.7 + bunR * 0.75, 1, seed + 4);
}

function bow(g: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number): void {
  wShape(g, PEN, [[x - 7 * s, y - 4 * s], [x - 1.5 * s, y], [x - 7 * s, y + 4 * s]], {
    closed: true, step: 6, amp: 0.4, sw: 1.8, fill: W.butter, seed,
  });
  wShape(g, PEN, [[x + 7 * s, y - 4 * s], [x + 1.5 * s, y], [x + 7 * s, y + 4 * s]], {
    closed: true, step: 6, amp: 0.4, sw: 1.8, fill: W.butter, seed: seed + 1,
  });
  dot(g, x, y, 2 * s, W.peachD);
}

function strand(g: CanvasRenderingContext2D, x: number, topY: number, len: number, s: number, hair: string, seed: number): void {
  wShape(g, PEN, [
    [x, topY], [x + s * 4.5, topY + len * 0.35], [x + s * 3, topY + len * 0.85],
    [x - s * 1, topY + len], [x - s * 4, topY + len * 0.45],
  ], { closed: true, step: 7, fill: hair, seed });
}

/** Mei front hair — soft swooped bangs + face-framing strands. */
function meiHairFront(g: CanvasRenderingContext2D, geo: Geo, hair: string, seed: number): void {
  const { cx, hcy, m } = geo;
  const by = hcy - m.hry * 0.3;
  const pts: Pt[] = [
    [cx - m.hrx * 0.99, hcy + m.hry * 0.08], [cx - m.hrx * 0.92, hcy - m.hry * 0.52],
    [cx - m.hrx * 0.45, hcy - m.hry * 1.0], [cx, hcy - m.hry * 1.08],
    [cx + m.hrx * 0.45, hcy - m.hry * 1.0], [cx + m.hrx * 0.92, hcy - m.hry * 0.52],
    [cx + m.hrx * 0.99, hcy + m.hry * 0.08], [cx + m.hrx * 0.66, by + 7],
    [cx + m.hrx * 0.22, by - 3], [cx - m.hrx * 0.28, by + 6], [cx - m.hrx * 0.72, by + 2],
  ];
  wShape(g, PEN, pts, { closed: true, step: 9, fill: hair, seed });
  strand(g, cx - m.hrx * 0.97, hcy - m.hry * 0.05, m.hry * 1.0, -1, hair, seed + 11);
  strand(g, cx + m.hrx * 0.97, hcy - m.hry * 0.05, m.hry * 1.0, 1, hair, seed + 12);
}

/** An front hair — styled fringe, soft pointed pieces sweeping right + a tuft. */
function anHairFront(g: CanvasRenderingContext2D, geo: Geo, hair: string, seed: number): void {
  const { cx, hcy, m } = geo;
  const by = hcy - m.hry * 0.18;
  const pts: Pt[] = [
    [cx - m.hrx * 1.0, hcy + m.hry * 0.12], [cx - m.hrx * 0.92, hcy - m.hry * 0.55],
    [cx - m.hrx * 0.42, hcy - m.hry * 1.02], [cx + m.hrx * 0.05, hcy - m.hry * 1.1],
    [cx + m.hrx * 0.5, hcy - m.hry * 0.98], [cx + m.hrx * 0.94, hcy - m.hry * 0.5],
    [cx + m.hrx * 1.0, hcy + m.hry * 0.12], [cx + m.hrx * 0.74, by + 5],
    [cx + m.hrx * 0.52, by - 6], [cx + m.hrx * 0.28, by + 6], [cx + m.hrx * 0.02, by - 6],
    [cx - m.hrx * 0.26, by + 6], [cx - m.hrx * 0.5, by - 5], [cx - m.hrx * 0.7, by + 4],
  ];
  wShape(g, PEN, pts, { closed: true, step: 8, fill: hair, seed });
  const tx = cx + m.hrx * 0.12;
  const ty = hcy - m.hry * 1.1;
  wShape(g, PEN, [[tx - 4, ty + 4], [tx - 1, ty - 8], [tx + 5, ty + 1]], {
    closed: true, step: 6, amp: 0.5, sw: 2, fill: hair, seed: seed + 9,
  });
}

function lashes(g: CanvasRenderingContext2D, ex: number, ey: number, s: number, seed: number): void {
  wShape(g, PEN, [[ex + s * 2.6, ey - 2.6], [ex + s * 5.2, ey - 4.2]], { sw: 1.3, amp: 0.2, seed });
  wShape(g, PEN, [[ex + s * 3.4, ey - 0.6], [ex + s * 6.2, ey - 1.4]], { sw: 1.3, amp: 0.2, seed: seed + 1 });
}

/** Front face — Mei: big sparkly lashed eyes + smile. An: relaxed eyes, brows, smirk. */
function faceFront(g: CanvasRenderingContext2D, geo: Geo, isMei: boolean, seed: number): void {
  const { cx, hcy, m } = geo;
  const ey = hcy + m.hry * 0.08;
  const ex = m.hrx * 0.4;
  const my = hcy + m.hry * 0.46;
  if (isMei) {
    dot(g, cx - ex, ey, 3.5, INK.line);
    dot(g, cx + ex, ey, 3.5, INK.line);
    dot(g, cx - ex - 1.2, ey - 1.3, 1.2, W.white);
    dot(g, cx + ex - 1.2, ey - 1.3, 1.2, W.white);
    dot(g, cx - ex + 1.1, ey + 1.4, 0.6, W.white);
    dot(g, cx + ex + 1.1, ey + 1.4, 0.6, W.white);
    lashes(g, cx - ex, ey, -1, seed + 8);
    lashes(g, cx + ex, ey, 1, seed + 9);
    wShape(g, PEN, [[cx - ex - 4, ey - 8], [cx - ex, ey - 9.8], [cx - ex + 4, ey - 8]], { sw: 1.2, amp: 0.3, seed });
    wShape(g, PEN, [[cx + ex - 4, ey - 8], [cx + ex, ey - 9.8], [cx + ex + 4, ey - 8]], { sw: 1.2, amp: 0.3, seed: seed + 1 });
    wShape(g, PEN, [[cx - 4.5, my], [cx, my + 5.5], [cx + 4.5, my]], {
      closed: true, step: 5, sw: 1.6, amp: 0.3, fill: '#b0604a', seed: seed + 2,
    });
  } else {
    wShape(g, PEN, [[cx - ex - 4, ey - 1], [cx - ex, ey + 2.6], [cx - ex + 4, ey - 1]], { sw: 2.1, amp: 0.25, seed });
    wShape(g, PEN, [[cx + ex - 4, ey - 1], [cx + ex, ey + 2.6], [cx + ex + 4, ey - 1]], { sw: 2.1, amp: 0.25, seed: seed + 1 });
    wShape(g, PEN, [[cx - ex - 4.5, ey - 7.5], [cx - ex + 3, ey - 8.6]], { sw: 1.3, amp: 0.25, seed: seed + 4 });
    wShape(g, PEN, [[cx + ex - 3, ey - 8.6], [cx + ex + 4.5, ey - 7.5]], { sw: 1.3, amp: 0.25, seed: seed + 5 });
    wShape(g, PEN, [[cx - 3.5, my + 0.5], [cx + 1, my + 2.6], [cx + 4.5, my]], { sw: 1.9, amp: 0.25, seed: seed + 2 });
  }
  dot(g, cx - m.hrx * 0.6, hcy + m.hry * 0.34, m.hrx * 0.13, W.blush, isMei ? 0.5 : 0.38);
  dot(g, cx + m.hrx * 0.6, hcy + m.hry * 0.34, m.hrx * 0.13, W.blush, isMei ? 0.5 : 0.38);
}

/** Mei profile — the far bun shows at the back of the head, bow underneath. */
function meiBunSide(g: CanvasRenderingContext2D, geo: Geo, hair: string, seed: number): void {
  const { cx, hcy, m } = geo;
  const bunR = m.hrx * 0.36;
  const bx = cx - m.hrx * 1.0;
  const by = hcy - m.hry * 0.55;
  wEllipse(g, PEN, bx, by, bunR, bunR, { fill: hair, seed, n: 12 });
  bow(g, bx, by + bunR * 0.8, 1, seed + 4);
}

/** Mei profile hair — swoop from forehead over the crown, tucked at the nape. */
function meiHairSide(g: CanvasRenderingContext2D, geo: Geo, hair: string, seed: number): void {
  const { cx, hcy, m } = geo;
  const pts: Pt[] = [
    [cx + m.hrx * 0.95, hcy - m.hry * 0.42],
    [cx + m.hrx * 0.55, hcy - m.hry * 0.97],
    [cx - m.hrx * 0.05, hcy - m.hry * 1.08],
    [cx - m.hrx * 0.68, hcy - m.hry * 0.88],
    [cx - m.hrx * 1.06, hcy - m.hry * 0.3],
    [cx - m.hrx * 1.0, hcy + m.hry * 0.48],
    [cx - m.hrx * 0.6, hcy + m.hry * 0.52],
    [cx - m.hrx * 0.48, hcy - m.hry * 0.1],
    [cx - m.hrx * 0.05, hcy - m.hry * 0.3],
    [cx + m.hrx * 0.42, hcy - m.hry * 0.18],
  ];
  wShape(g, PEN, pts, { closed: true, step: 9, fill: hair, seed });
}

/** An profile hair — fringe sweeping forward over the brow, short at the nape. */
function anHairSide(g: CanvasRenderingContext2D, geo: Geo, hair: string, seed: number): void {
  const { cx, hcy, m } = geo;
  const pts: Pt[] = [
    [cx + m.hrx * 1.0, hcy - m.hry * 0.24],
    [cx + m.hrx * 0.7, hcy - m.hry * 0.85],
    [cx + m.hrx * 0.1, hcy - m.hry * 1.1],
    [cx - m.hrx * 0.6, hcy - m.hry * 0.92],
    [cx - m.hrx * 1.04, hcy - m.hry * 0.28],
    [cx - m.hrx * 0.96, hcy + m.hry * 0.38],
    [cx - m.hrx * 0.55, hcy + m.hry * 0.2],
    [cx - m.hrx * 0.3, hcy - m.hry * 0.28],
    [cx + m.hrx * 0.05, hcy - m.hry * 0.45],
    [cx + m.hrx * 0.32, hcy - m.hry * 0.18],
    [cx + m.hrx * 0.62, hcy - m.hry * 0.5],
  ];
  wShape(g, PEN, pts, { closed: true, step: 8, fill: hair, seed });
  const tx = cx + m.hrx * 0.05;
  const ty = hcy - m.hry * 1.1;
  wShape(g, PEN, [[tx - 4, ty + 4], [tx - 1, ty - 8], [tx + 5, ty + 1]], {
    closed: true, step: 6, amp: 0.5, sw: 2, fill: hair, seed: seed + 9,
  });
}

/** Profile face — one eye, soft nose bump on the leading edge, single blush. */
function faceSide(g: CanvasRenderingContext2D, geo: Geo, isMei: boolean, skin: string, seed: number): void {
  const { cx, hcy, m } = geo;
  const ey = hcy + m.hry * 0.08;
  const ex = cx + m.hrx * 0.52;
  const my = hcy + m.hry * 0.48;
  const nx = cx + m.hrx * 1.0;
  const ny = hcy + m.hry * 0.18;
  wShape(g, PEN, [[nx - 2, ny - 4], [nx + 3.4, ny - 0.5], [nx - 1.5, ny + 3]], {
    closed: true, step: 4, amp: 0.3, sw: 1.8, fill: skin, seed: seed + 6,
  });
  if (isMei) {
    dot(g, ex, ey, 3.5, INK.line);
    dot(g, ex - 1.2, ey - 1.3, 1.2, W.white);
    dot(g, ex + 1.1, ey + 1.4, 0.6, W.white);
    lashes(g, ex, ey, 1, seed + 8);
    wShape(g, PEN, [[ex - 4, ey - 8], [ex, ey - 9.8], [ex + 4, ey - 8]], { sw: 1.2, amp: 0.3, seed });
    wShape(g, PEN, [[cx + m.hrx * 0.55, my], [cx + m.hrx * 0.72, my + 3.2], [cx + m.hrx * 0.88, my + 0.8]], {
      sw: 1.6, amp: 0.3, seed: seed + 2,
    });
  } else {
    wShape(g, PEN, [[ex - 4, ey - 1], [ex, ey + 2.6], [ex + 4, ey - 1]], { sw: 2.1, amp: 0.25, seed });
    wShape(g, PEN, [[ex - 4.5, ey - 7.5], [ex + 3, ey - 8.6]], { sw: 1.3, amp: 0.25, seed: seed + 4 });
    wShape(g, PEN, [[cx + m.hrx * 0.58, my + 1.5], [cx + m.hrx * 0.84, my + 0.2]], { sw: 1.9, amp: 0.25, seed: seed + 2 });
  }
  dot(g, cx + m.hrx * 0.3, hcy + m.hry * 0.34, m.hrx * 0.13, W.blush, isMei ? 0.5 : 0.38);
}

function pawPatch(g: CanvasRenderingContext2D, x: number, y: number, s = 1): void {
  g.fillStyle = W.cream;
  for (const [dx, dy, r] of [[0, 1.5, 2.6], [-2.6, -1.6, 1.2], [0, -2.4, 1.2], [2.6, -1.6, 1.2]] as const) {
    g.beginPath();
    g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    g.fill();
  }
}

/** Headgear — bucket / straw hat, nightcap, sleep mask. `side` = profile view. */
function headgear(g: CanvasRenderingContext2D, geo: Geo, fit: Fit, seed: number, side = false): void {
  const { cx, hcy, m } = geo;
  const ec = fit.extraColors ?? {};
  if (fit.extras.includes('bucketHat')) {
    const col = ec.hat ?? W.sage;
    const by = hcy - m.hry * 0.48;
    wShape(g, PEN, [
      [cx - m.hrx * 0.78, by - 8], [cx - m.hrx * 0.5, hcy - m.hry * 1.18],
      [cx + m.hrx * 0.5, hcy - m.hry * 1.18], [cx + m.hrx * 0.78, by - 8],
      [cx + m.hrx * 1.16, by + 2], [cx + m.hrx * 1.05, by + 8],
      [cx - m.hrx * 1.05, by + 8], [cx - m.hrx * 1.16, by + 2],
    ], { closed: true, step: 8, fill: col, seed });
    pawPatch(g, cx + (side ? m.hrx * 0.3 : 0), hcy - m.hry * 0.85);
  }
  if (fit.extras.includes('strawHat')) {
    const band = ec.band ?? W.peachD;
    const by = hcy - m.hry * 0.62;
    wEllipse(g, PEN, cx, by, m.hrx * 1.5, m.hrx * 0.4, { fill: W.straw, seed: seed + 1, n: 16 });
    wShape(g, PEN, [
      [cx - m.hrx * 0.72, by - 2], [cx - m.hrx * 0.55, hcy - m.hry * 1.26],
      [cx, hcy - m.hry * 1.38], [cx + m.hrx * 0.55, hcy - m.hry * 1.26], [cx + m.hrx * 0.72, by - 2],
    ], { closed: true, step: 8, fill: W.straw, seed: seed + 2 });
    wShape(g, PEN, [[cx - m.hrx * 0.68, by - 5], [cx + m.hrx * 0.68, by - 5]], { sw: 4, amp: 0.5, stroke: band, seed: seed + 3 });
  }
  if (fit.extras.includes('nightcap')) {
    const col = ec.hat ?? W.butter;
    // In profile the floppy tip trails behind the head (−x), not to camera-right.
    const d = side ? -1 : 1;
    const tipX = cx + d * m.hrx * 1.25;
    const tipY = hcy - m.hry * 0.4;
    wShape(g, PEN, [
      [cx - d * m.hrx * 0.85, hcy - m.hry * 0.5], [cx - d * m.hrx * 0.4, hcy - m.hry * 1.2],
      [cx + d * m.hrx * 0.45, hcy - m.hry * 1.1], [tipX, tipY], [cx + d * m.hrx * 0.85, hcy - m.hry * 0.42],
    ], { closed: true, step: 8, fill: col, seed: seed + 4 });
    dot(g, tipX + 2 * d, tipY + 1, 3.6, W.peach);
    wShape(g, PEN, ellipseTip(tipX + 2 * d, tipY + 1, 3.6), { closed: true, step: 6, sw: 1.6, stroke: INK.line, seed: seed + 5 });
  }
  if (fit.extras.includes('sleepMask')) {
    const col = ec.mask ?? W.peach;
    if (side) {
      const mx = cx + m.hrx * 0.45;
      const my = hcy - m.hry * 0.72;
      wShape(g, PEN, [[mx - 6, my + 5], [cx - m.hrx * 0.95, my + 9]], { sw: 2.2, amp: 0.5, stroke: INK.line, seed: seed + 6 });
      wShape(g, PEN, [[mx - 10, my - 5], [mx + 10, my - 5], [mx + 12, my + 4], [mx - 12, my + 4]], {
        closed: true, step: 6, fill: col, seed: seed + 5,
      });
      wShape(g, PEN, [[mx - 5, my], [mx - 1, my + 1.5], [mx + 3, my]], { sw: 1.4, amp: 0.3, seed: seed + 7 });
    } else {
      const mx = cx - m.hrx * 0.42;
      const my = hcy - m.hry * 0.72;
      g.save();
      g.translate(mx, my);
      g.rotate((-14 * Math.PI) / 180);
      g.translate(-mx, -my);
      wShape(g, PEN, [[mx - 8, my + 6], [cx + m.hrx * 0.9, my + 2]], { sw: 2.2, amp: 0.5, stroke: INK.line, seed: seed + 6 });
      wShape(g, PEN, [[mx - 10, my - 5], [mx + 10, my - 5], [mx + 12, my + 4], [mx - 12, my + 4]], {
        closed: true, step: 6, fill: col, seed: seed + 5,
      });
      wShape(g, PEN, [[mx - 5, my], [mx - 1, my + 1.5], [mx + 3, my]], { sw: 1.4, amp: 0.3, seed: seed + 7 });
      g.restore();
    }
  }
}

/**
 * Head plate — pivot = bottom center, sitting in the sweater collar. Rendered
 * with a short neck running to the very bottom so it reads as one connected
 * figure when stacked under the torso plate.
 */
export function drawWalkerHead(char: CharId, dir: DirId, age: AgeId, view: ViewId = 'front'): PropSprite {
  const ch = CAST[char];
  const fit = DIRECTIONS[dir].fits[char];
  const geo = makeGeo(age);
  const { cx, hcy, torsoTop, m } = geo;
  const isMei = char === 'mei';
  const side = view === 'side';
  const seed = 4 + char.charCodeAt(0) + dir.charCodeAt(1) + age.charCodeAt(0) + (side ? 17 : 0);

  const top = hcy - m.hry * 1.5;
  const neckBot = torsoTop + 8;
  const pad = 6;
  const figH = neckBot - top + pad * 2;
  const figW = m.hrx * 3.3;
  const scale = 220 / figW;
  const cw = Math.round(figW * scale);
  const chh = Math.round(figH * scale);
  const { c, g } = sprite(cw, chh);
  g.save();
  g.scale(scale, scale);
  g.translate(-(cx - figW / 2), -(top - pad));

  const nW = m.hrx * 0.34;
  const nCx = side ? cx - m.hrx * 0.06 : cx;
  wShape(g, PEN, [
    [nCx - nW, hcy + m.hry * 0.7], [nCx + nW, hcy + m.hry * 0.7],
    [nCx + nW, neckBot], [nCx - nW, neckBot],
  ], { closed: true, step: 8, fill: ch.skin, seed: seed + 30 });

  if (side) {
    if (isMei) meiBunSide(g, geo, ch.hair, seed + 70);
    wEllipse(g, PEN, cx, hcy, m.hrx * 1.04, m.hry, { fill: ch.skin, seed, n: 16 });
    if (isMei) meiHairSide(g, geo, ch.hair, seed + 7);
    else anHairSide(g, geo, ch.hair, seed + 7);
    faceSide(g, geo, isMei, ch.skin, seed + 20);
  } else {
    if (isMei) meiHairBehind(g, geo, ch.hair, seed + 70);
    wEllipse(g, PEN, cx, hcy, m.hrx, m.hry, { fill: ch.skin, seed, n: 16 });
    if (isMei) meiHairFront(g, geo, ch.hair, seed + 7);
    else anHairFront(g, geo, ch.hair, seed + 7);
    faceFront(g, geo, isMei, seed + 20);
  }
  headgear(g, geo, fit, seed + 9, side);
  g.restore();

  return { canvas: c, aspect: cw / chh };
}

// =====================================================================
//  TORSO PLATE  — outfit top, over-torso bottom, two arms, extras
// =====================================================================

function torsoBasePts(geo: Geo, hemY: number, topW: number, botW: number, isMei: boolean): Pt[] {
  const { cx, torsoTop: t } = geo;
  const tw = topW;
  const bw = botW;
  const midY = (t + 10 + hemY - 5) / 2;
  const inset = isMei ? 2.5 : 0.8;
  const midW = (tw / 2 + bw / 2) / 2 - inset;
  return [
    [cx - tw / 2 + 4, t], [cx, t - 2], [cx + tw / 2 - 4, t],
    [cx + tw / 2, t + 10], [cx + midW, midY], [cx + bw / 2, hemY - 5], [cx + bw / 2 - 3, hemY],
    [cx - bw / 2 + 3, hemY], [cx - bw / 2, hemY - 5], [cx - midW, midY], [cx - tw / 2, t + 10],
  ];
}

function hemFor(geo: Geo, top: Fit['top']): number {
  if (top.type === 'dress') return geo.hipY + 16;
  if (top.type === 'raincoat') return geo.hipY + 14;
  return geo.hipY + 4;
}

function torsoWidths(geo: Geo, top: Fit['top']): { topW: number; botW: number } {
  const { m } = geo;
  if (top.type === 'dress') return { topW: m.shW * 0.96, botW: m.hipW * 1.5 };
  if (top.type === 'raincoat') return { topW: m.shW * 1.02, botW: m.hipW * 1.4 };
  return { topW: m.shW, botW: m.hipW * 1.08 };
}

/** Clip subsequent drawing to the wobbled garment outline (same seed = same wobble). */
function clipToShape(g: CanvasRenderingContext2D, pts: Pt[], seed: number): void {
  wShape(g, PEN, pts, { closed: true, step: 12, stroke: 'none', seed });
  g.clip();
}

function drawTorsoTop(g: CanvasRenderingContext2D, geo: Geo, fit: Fit, isMei: boolean, seed: number): void {
  const { cx, torsoTop: t } = geo;
  const top = fit.top;
  const hem = hemFor(geo, top);
  const { topW, botW } = torsoWidths(geo, top);
  const pts = torsoBasePts(geo, hem, topW, botW, isMei);
  wShape(g, PEN, pts, { closed: true, step: 12, fill: top.color, seed });

  if (top.stripes) {
    g.save();
    clipToShape(g, pts, seed);
    for (let y = t + 6; y < hem; y += 9) {
      wShape(g, PEN, [[cx - 70, y], [cx + 70, y + 1]], { amp: 1, step: 14, sw: 3.5, stroke: top.stripes, seed: seed + y });
    }
    g.restore();
  }
  if (top.type === 'tee') {
    wShape(g, PEN, [[cx - 7, t + 2], [cx, t + 6.5], [cx + 7, t + 2]], { sw: PEN.sw * 0.8, amp: 0.5, seed: seed + 2 });
  } else if (top.type === 'pjTop') {
    wShape(g, PEN, [[cx - 8, t + 1], [cx, t + 9]], { sw: PEN.sw * 0.7, amp: 0.5, seed: seed + 2 });
    wShape(g, PEN, [[cx + 8, t + 1], [cx, t + 9]], { sw: PEN.sw * 0.7, amp: 0.5, seed: seed + 3 });
    for (const f of [0.28, 0.5, 0.72]) {
      const cy = t + (hem - t) * f;
      dot(g, cx, cy, 2.2, W.cream);
      wShape(g, PEN, ellipseTip(cx, cy, 2.2), { closed: true, step: 6, sw: 1.4, stroke: INK.line, seed: seed + 40 });
    }
  } else if (top.type === 'raincoat') {
    wShape(g, PEN, [[cx, t + 8], [cx, hem - 4]], { sw: PEN.sw * 0.7, amp: 0.8, seed: seed + 2 });
    for (let i = 0; i < 2; i++) {
      const f = [0.3, 0.55][i];
      wShape(g, PEN, [
        [cx - 7, t + (hem - t) * f - 2], [cx - 1, t + (hem - t) * f - 2],
        [cx - 1, t + (hem - t) * f + 2], [cx - 7, t + (hem - t) * f + 2],
      ], { closed: true, sw: 1.6, amp: 0.4, step: 5, fill: W.cream, seed: seed + 6 + i });
    }
    wShape(g, PEN, [[cx + botW / 2 - 16, hem - 16], [cx + botW / 2 - 6, hem - 15]], { sw: PEN.sw * 0.8, amp: 0.5, seed: seed + 9 });
  } else if (top.type === 'dress' && !top.stripes) {
    wShape(g, PEN, [[cx - botW / 2 + 6, hem - 5], [cx + botW / 2 - 6, hem - 5]], { sw: 1.4, amp: 0.8, seed: seed + 4 });
  }
}

function bottomFB(g: CanvasRenderingContext2D, geo: Geo, fit: Fit, seed: number): void {
  const b = fit.bottom;
  if (!b || b.type === 'none' || b.type === 'pants' || b.type === 'pjPants') return;
  const { cx, torsoTop: t, hipY, m } = geo;
  const col = b.color ?? W.sage;
  const bw = m.shW * 0.24;
  const blockTop = hipY - m.torsoH * 0.24;
  const strap = (sx: number): void => {
    wShape(g, PEN, [[cx + sx * (m.shW / 2 - 7), t + 5], [cx + sx * bw, blockTop - 14]], { sw: 7, amp: 0.6, stroke: INK.line, seed: seed + sx * 3 + 10 });
    wShape(g, PEN, [[cx + sx * (m.shW / 2 - 7), t + 5], [cx + sx * bw, blockTop - 14]], { sw: 4.5, amp: 0.6, stroke: col, seed: seed + sx * 3 + 10 });
  };
  if (b.type === 'shorts' || b.type === 'overallShorts') {
    const isOverall = b.type === 'overallShorts';
    const w = m.hipW / 2 + 3;
    if (isOverall) {
      strap(-1);
      strap(1);
    }
    wShape(g, PEN, [
      [cx - w, blockTop], [cx + w, blockTop], [cx + w + 2, hipY + 13],
      [cx + 4, hipY + 13], [cx, hipY + 6], [cx - 4, hipY + 13], [cx - w - 2, hipY + 13],
    ], { closed: true, step: 9, fill: col, seed });
    if (isOverall) {
      wShape(g, PEN, [[cx - bw, blockTop - 16], [cx + bw, blockTop - 16], [cx + bw + 1, blockTop + 2], [cx - bw - 1, blockTop + 2]], {
        closed: true, step: 8, fill: col, seed: seed + 5,
      });
      dot(g, cx - bw + 3, blockTop - 11, 2, W.butter);
      dot(g, cx + bw - 3, blockTop - 11, 2, W.butter);
    }
  } else if (b.type === 'overalls') {
    strap(-1);
    strap(1);
    wShape(g, PEN, [[cx - m.hipW / 2 - 2, blockTop], [cx + m.hipW / 2 + 2, blockTop], [cx + m.hipW / 2 + 3, hipY + 8], [cx - m.hipW / 2 - 3, hipY + 8]], {
      closed: true, step: 9, fill: col, seed,
    });
    wShape(g, PEN, [[cx - bw, blockTop - 16], [cx + bw, blockTop - 16], [cx + bw + 1, blockTop + 2], [cx - bw - 1, blockTop + 2]], {
      closed: true, step: 8, fill: col, seed: seed + 5,
    });
    dot(g, cx - bw + 3, blockTop - 11, 2, W.butter);
    dot(g, cx + bw - 3, blockTop - 11, 2, W.butter);
  } else if (b.type === 'pinafore') {
    const waist = t + m.torsoH * 0.42;
    const hem = hipY + 14;
    wShape(g, PEN, [[cx - (m.shW / 2 - 7), t + 5], [cx - bw, waist - 6]], { sw: 7, amp: 0.6, stroke: INK.line, seed: seed + 7 });
    wShape(g, PEN, [[cx - (m.shW / 2 - 7), t + 5], [cx - bw, waist - 6]], { sw: 4.5, amp: 0.6, stroke: col, seed: seed + 7 });
    wShape(g, PEN, [[cx + (m.shW / 2 - 7), t + 5], [cx + bw, waist - 6]], { sw: 7, amp: 0.6, stroke: INK.line, seed: seed + 13 });
    wShape(g, PEN, [[cx + (m.shW / 2 - 7), t + 5], [cx + bw, waist - 6]], { sw: 4.5, amp: 0.6, stroke: col, seed: seed + 13 });
    wShape(g, PEN, [
      [cx - m.shW * 0.3, waist], [cx + m.shW * 0.3, waist], [cx + m.hipW * 0.78 + 6, hem - 4],
      [cx + m.hipW * 0.7, hem], [cx, hem + 2], [cx - m.hipW * 0.7, hem], [cx - m.hipW * 0.78 - 6, hem - 4],
    ], { closed: true, step: 10, fill: col, seed });
    wShape(g, PEN, [[cx - bw, waist - 16], [cx + bw, waist - 16], [cx + bw + 1, waist + 2], [cx - bw - 1, waist + 2]], {
      closed: true, step: 8, fill: col, seed: seed + 5,
    });
  }
}

/** Both arms (front view). Long sleeves take the top colour; short = skin. */
function arms(g: CanvasRenderingContext2D, geo: Geo, fit: Fit, skin: string, seed: number): void {
  const { cx, torsoTop, m } = geo;
  const long = fit.top.sleeves === 'long';
  const armColor = long ? fit.top.color : skin;
  const shY = torsoTop + 9;
  const shX = m.shW / 2 - 2;
  for (const s of [-1, 1]) {
    const pts: Pt[] = [
      [cx + s * shX, shY],
      [cx + s * (shX + ARM_OUT * 0.75), shY + m.armL * 0.55],
      [cx + s * (shX + ARM_OUT * 0.55), shY + m.armL],
    ];
    limb(g, PEN, pts, m.limbW, armColor, seed + (s + 1) * 11);
    wEllipse(g, PEN, pts[2][0], pts[2][1] + 2, m.limbW * 0.62 + 1, m.limbW * 0.62 + 1, { fill: skin, seed: seed + 40 + s, n: 10 });
    if (!long) {
      wEllipse(g, PEN, pts[0][0], shY + 4, m.limbW * 0.95, m.limbW * 1.2, { fill: fit.top.color, seed: seed + 50 + s, n: 10 });
    }
  }
}

function boneClasp(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.fillStyle = W.cream;
  for (const [dx, dy] of [[-3.4, -1.2], [-3.4, 1.2], [3.4, -1.2], [3.4, 1.2]] as const) {
    g.beginPath();
    g.arc(x + dx, y + dy, 1.7, 0, Math.PI * 2);
    g.fill();
  }
  g.fillRect(x - 3.4, y - 1.6, 6.8, 3.2);
}

function cape(g: CanvasRenderingContext2D, geo: Geo, color: string, seed: number): void {
  const { cx, torsoTop: t, m } = geo;
  const hem = t + m.torsoH * 0.74;
  const w = m.shW * 0.8;
  wShape(g, PEN, [
    [cx - w * 0.45, t + 1], [cx, t - 1], [cx + w * 0.45, t + 1],
    [cx + w * 0.8, t + 14], [cx + w, hem - 3],
    [cx + w * 0.55, hem + 3], [cx, hem - 2], [cx - w * 0.55, hem + 3],
    [cx - w, hem - 3], [cx - w * 0.8, t + 14],
  ], { closed: true, step: 10, fill: color, seed });
  dot(g, cx, t + 5, 3, W.cream);
  wShape(g, PEN, ellipseTip(cx, t + 5, 3), { closed: true, step: 6, sw: 1.6, stroke: INK.line, seed: seed + 1 });
}

function extraOverTorso(g: CanvasRenderingContext2D, geo: Geo, fit: Fit, seed: number): void {
  const { cx, torsoTop: t, hipY, m } = geo;
  const ec = fit.extraColors ?? {};
  if (fit.extras.includes('satchel')) {
    const col = ec.satchel ?? W.sageD;
    wShape(g, PEN, [[cx - (m.shW / 2 - 6), t + 4], [cx + (m.hipW / 2 + 2), hipY - 10]], { sw: 4, amp: 0.6, stroke: col, seed });
    wShape(g, PEN, [
      [cx + (m.hipW / 2 - 8), hipY - 12], [cx + (m.hipW / 2 + 14), hipY - 12],
      [cx + (m.hipW / 2 + 15), hipY + 6], [cx + (m.hipW / 2 - 9), hipY + 6],
    ], { closed: true, step: 7, fill: col, seed: seed + 1 });
    wShape(g, PEN, [[cx + (m.hipW / 2 - 9), hipY - 4], [cx + (m.hipW / 2 + 14), hipY - 4]], { sw: 1.6, amp: 0.5, seed: seed + 2 });
    boneClasp(g, cx + m.hipW / 2 + 3, hipY + 1);
  }
  if (fit.extras.includes('neckerchief')) {
    const col = ec.scarf ?? W.peach;
    wShape(g, PEN, [[cx - 13, t + 4], [cx + 13, t + 4], [cx, t + 20]], { closed: true, sw: 2, step: 6, fill: col, seed: seed + 5 });
    dot(g, cx, t + 6, 2.4, col);
    wShape(g, PEN, ellipseTip(cx, t + 6, 2.4), { closed: true, step: 6, sw: 1.4, stroke: INK.line, seed: seed + 14 });
  }
}

function hoodBehind(g: CanvasRenderingContext2D, geo: Geo, fit: Fit, seed: number): void {
  if (!fit.extras.includes('hood')) return;
  wEllipse(g, PEN, geo.cx, geo.torsoTop + 2, geo.m.shW * 0.42, 11, { fill: fit.top.color, seed: seed + 80, n: 12 });
}

// ----- profile (side-view) torso pieces — body has depth, one arm shows -----

/** Garment widths seen from the side: the body's depth, not its breadth. */
function sideWidths(geo: Geo, top: Fit['top']): { topW: number; botW: number } {
  const { topW, botW } = torsoWidths(geo, top);
  return { topW: topW * 0.68, botW: botW * 0.84 };
}

function drawTorsoTopSide(g: CanvasRenderingContext2D, geo: Geo, fit: Fit, isMei: boolean, seed: number): void {
  const { cx, torsoTop: t } = geo;
  const top = fit.top;
  const hem = hemFor(geo, top);
  const { topW, botW } = sideWidths(geo, top);
  const pts = torsoBasePts(geo, hem, topW, botW, isMei);
  wShape(g, PEN, pts, { closed: true, step: 12, fill: top.color, seed });

  if (top.stripes) {
    g.save();
    clipToShape(g, pts, seed);
    for (let y = t + 6; y < hem; y += 9) {
      wShape(g, PEN, [[cx - 70, y], [cx + 70, y + 1]], { amp: 1, step: 14, sw: 3.5, stroke: top.stripes, seed: seed + y });
    }
    g.restore();
  }
  // The garment's leading edge, interpolated shoulder→hem.
  const frontX = (y: number): number =>
    cx + topW / 2 + ((botW - topW) / 2) * ((y - t) / (hem - t));
  if (top.type === 'pjTop') {
    for (const f of [0.28, 0.5, 0.72]) {
      const cy = t + (hem - t) * f;
      const bx = frontX(cy) - 5;
      dot(g, bx, cy, 2.2, W.cream);
      wShape(g, PEN, ellipseTip(bx, cy, 2.2), { closed: true, step: 6, sw: 1.4, stroke: INK.line, seed: seed + 40 });
    }
  } else if (top.type === 'raincoat') {
    wShape(g, PEN, [[frontX(t + 8) - 3, t + 8], [frontX(hem - 4) - 4, hem - 4]], { sw: PEN.sw * 0.7, amp: 0.8, seed: seed + 2 });
    wShape(g, PEN, [[cx - botW / 2 + 5, hem - 16], [cx - botW / 2 + 14, hem - 15]], { sw: PEN.sw * 0.8, amp: 0.5, seed: seed + 9 });
  } else if (top.type === 'dress' && !top.stripes) {
    wShape(g, PEN, [[cx - botW / 2 + 5, hem - 5], [cx + botW / 2 - 5, hem - 5]], { sw: 1.4, amp: 0.8, seed: seed + 4 });
  }
}

/** Side bottoms — block reads as depth; one strap arcs over the shoulder. */
function bottomFBSide(g: CanvasRenderingContext2D, geo: Geo, fit: Fit, seed: number): void {
  const b = fit.bottom;
  if (!b || b.type === 'none' || b.type === 'pants' || b.type === 'pjPants') return;
  const { cx, torsoTop: t, hipY, m } = geo;
  const col = b.color ?? W.sage;
  const bw = m.shW * 0.22;
  const blockTop = hipY - m.torsoH * 0.24;
  const strapSide = (bibX: number, bibY: number): void => {
    const pts: Pt[] = [[bibX, bibY], [cx + 2, t + 3], [cx - m.shW * 0.24, bibY + 6]];
    wShape(g, PEN, pts, { sw: 7, amp: 0.6, stroke: INK.line, seed: seed + 10 });
    wShape(g, PEN, pts, { sw: 4.5, amp: 0.6, stroke: col, seed: seed + 10 });
  };
  const bib = (bibTop: number): void => {
    wShape(g, PEN, [[cx - bw, bibTop], [cx + bw, bibTop], [cx + bw + 1, bibTop + 18], [cx - bw - 1, bibTop + 18]], {
      closed: true, step: 8, fill: col, seed: seed + 5,
    });
    dot(g, cx + bw - 3, bibTop + 5, 2, W.butter);
  };
  if (b.type === 'shorts' || b.type === 'overallShorts' || b.type === 'overalls') {
    const isOverall = b.type !== 'shorts';
    const w = (m.hipW / 2 + 3) * 0.85;
    const bot = b.type === 'overalls' ? hipY + 8 : hipY + 13;
    if (isOverall) strapSide(cx + bw * 0.6, blockTop - 14);
    wShape(g, PEN, [
      [cx - w, blockTop], [cx + w, blockTop], [cx + w + 2, bot], [cx - w - 2, bot],
    ], { closed: true, step: 9, fill: col, seed });
    if (isOverall) bib(blockTop - 16);
  } else if (b.type === 'pinafore') {
    const waist = t + m.torsoH * 0.42;
    const hem = hipY + 14;
    strapSide(cx + bw * 0.6, waist - 14);
    wShape(g, PEN, [
      [cx - m.shW * 0.24, waist], [cx + m.shW * 0.24, waist],
      [cx + m.hipW * 0.62, hem - 2], [cx, hem + 2], [cx - m.hipW * 0.62, hem - 2],
    ], { closed: true, step: 10, fill: col, seed });
    bib(waist - 16);
  }
}

/** The single visible arm in profile — returns the hand point for the leash. */
function armSide(g: CanvasRenderingContext2D, geo: Geo, fit: Fit, skin: string, seed: number): Pt {
  const { cx, torsoTop, m } = geo;
  const long = fit.top.sleeves === 'long';
  const armColor = long ? fit.top.color : skin;
  const shY = torsoTop + 9;
  const pts: Pt[] = [
    [cx + 1, shY],
    [cx + 5.5, shY + m.armL * 0.55],
    [cx + 4, shY + m.armL],
  ];
  limb(g, PEN, pts, m.limbW, armColor, seed + 11);
  wEllipse(g, PEN, pts[2][0], pts[2][1] + 2, m.limbW * 0.62 + 1, m.limbW * 0.62 + 1, { fill: skin, seed: seed + 40, n: 10 });
  if (!long) {
    wEllipse(g, PEN, pts[0][0], shY + 4, m.limbW * 0.95, m.limbW * 1.2, { fill: fit.top.color, seed: seed + 50, n: 10 });
  }
  return [pts[2][0], pts[2][1] + 2];
}

/** Cape in profile — trails behind the walker with a wavy hem. */
function capeSide(g: CanvasRenderingContext2D, geo: Geo, color: string, seed: number): void {
  const { cx, torsoTop: t, m } = geo;
  const hem = t + m.torsoH * 0.78;
  const back = m.shW * 1.05;
  wShape(g, PEN, [
    [cx + m.shW * 0.18, t + 1], [cx - m.shW * 0.1, t - 2],
    [cx - back * 0.55, t + 12], [cx - back, hem - 6],
    [cx - back * 0.7, hem + 2], [cx - back * 0.35, hem - 4], [cx - m.shW * 0.05, hem - 1],
  ], { closed: true, step: 10, fill: color, seed });
  dot(g, cx + m.shW * 0.14, t + 5, 3, W.cream);
  wShape(g, PEN, ellipseTip(cx + m.shW * 0.14, t + 5, 3), { closed: true, step: 6, sw: 1.6, stroke: INK.line, seed: seed + 1 });
}

function extrasSide(g: CanvasRenderingContext2D, geo: Geo, fit: Fit, seed: number): void {
  const { cx, torsoTop: t, hipY, m } = geo;
  const ec = fit.extraColors ?? {};
  if (fit.extras.includes('satchel')) {
    const col = ec.satchel ?? W.sageD;
    const bagX = cx - m.hipW * 0.34;
    wShape(g, PEN, [[cx + m.shW * 0.2, t + 4], [bagX + 4, hipY - 11]], { sw: 4, amp: 0.6, stroke: col, seed });
    wShape(g, PEN, [
      [bagX - 11, hipY - 12], [bagX + 11, hipY - 12],
      [bagX + 12, hipY + 6], [bagX - 12, hipY + 6],
    ], { closed: true, step: 7, fill: col, seed: seed + 1 });
    wShape(g, PEN, [[bagX - 12, hipY - 4], [bagX + 11, hipY - 4]], { sw: 1.6, amp: 0.5, seed: seed + 2 });
    boneClasp(g, bagX, hipY + 1);
  }
  if (fit.extras.includes('neckerchief')) {
    const col = ec.scarf ?? W.peach;
    wShape(g, PEN, [[cx - 6, t + 4], [cx + 14, t + 4], [cx + 5, t + 19]], { closed: true, sw: 2, step: 6, fill: col, seed: seed + 5 });
    dot(g, cx + 11, t + 6, 2.4, col);
    wShape(g, PEN, ellipseTip(cx + 11, t + 6, 2.4), { closed: true, step: 6, sw: 1.4, stroke: INK.line, seed: seed + 14 });
  }
}

function hoodBehindSide(g: CanvasRenderingContext2D, geo: Geo, fit: Fit, seed: number): void {
  if (!fit.extras.includes('hood')) return;
  wEllipse(g, PEN, geo.cx - geo.m.shW * 0.26, geo.torsoTop + 2, geo.m.shW * 0.32, 11, { fill: fit.top.color, seed: seed + 80, n: 12 });
}

/**
 * Torso plate — pivot = bottom center. Canvas spans figure y∈[torsoTop − margin
 * .. a little below the hem], wide enough for outstretched arms + satchel.
 */
export function drawWalkerTorso(char: CharId, dir: DirId, age: AgeId, view: ViewId = 'front'): TorsoSprite {
  const ch = CAST[char];
  const fit = DIRECTIONS[dir].fits[char];
  const geo = makeGeo(age);
  const { cx, torsoTop, hipY, m } = geo;
  const isMei = char === 'mei';
  const side = view === 'side';
  const seed = 3 + char.charCodeAt(0) * 2 + dir.charCodeAt(0) + age.charCodeAt(1) + (side ? 23 : 0);
  const top = torsoTop - 14;
  const bottom = hipY + 22;
  const figH = bottom - top;
  const figW = m.shW + ARM_OUT * 2 + 80;
  const scale = 256 / figW;
  const cw = 256;
  const chh = Math.round(figH * scale);
  const { c, g } = sprite(cw, chh);
  g.save();
  g.scale(scale, scale);
  g.translate(-(cx - figW / 2), -top);

  let handFx: number;
  let handFy: number;
  if (side) {
    if (fit.extras.includes('cape')) capeSide(g, geo, fit.extraColors?.cape ?? W.peach, seed + 6);
    hoodBehindSide(g, geo, fit, seed + 2);
    drawTorsoTopSide(g, geo, fit, isMei, seed + 3);
    bottomFBSide(g, geo, fit, seed + 4);
    const hand = armSide(g, geo, fit, ch.skin, seed + 5);
    extrasSide(g, geo, fit, seed + 7);
    handFx = hand[0];
    handFy = hand[1];
  } else {
    hoodBehind(g, geo, fit, seed + 2);
    drawTorsoTop(g, geo, fit, isMei, seed + 3);
    bottomFB(g, geo, fit, seed + 4);
    arms(g, geo, fit, ch.skin, seed + 5);
    if (fit.extras.includes('cape')) cape(g, geo, fit.extraColors?.cape ?? W.peach, seed + 6);
    extraOverTorso(g, geo, fit, seed + 7);
    handFx = cx + (m.shW / 2 - 2 + ARM_OUT * 0.55);
    handFy = torsoTop + 9 + m.armL;
  }
  g.restore();

  const handU = (handFx - (cx - figW / 2)) / figW;
  const handV = (handFy - top) / figH;
  return { canvas: c, aspect: cw / chh, hand: { u: handU, v: handV } };
}

// =====================================================================
//  LEG PLATE  — one leg with sock + shoe (rig draws it twice, mirrored)
// =====================================================================

function shoeF(g: CanvasRenderingContext2D, x: number, ground: number, color: string, boot: boolean, seed: number): void {
  if (boot) {
    wShape(g, PEN, [
      [x - 7, ground - 24], [x + 7, ground - 24], [x + 8, ground - 8],
      [x + 10, ground - 3], [x - 10, ground - 3], [x - 8, ground - 8],
    ], { closed: true, step: 8, fill: color, seed });
  } else {
    wEllipse(g, PEN, x, ground - 6.5, 10, 6.5, { fill: color, seed });
  }
}

/**
 * Leg plate — pivot = top center (hip). One leg drawn into a tall canvas; the
 * rig instantiates it twice and offsets/mirrors for the two-beat walk.
 */
export function drawWalkerLeg(char: CharId, dir: DirId, age: AgeId): PropSprite {
  const fit = DIRECTIONS[dir].fits[char];
  const ch = CAST[char];
  const geo = makeGeo(age);
  const { cx, ground, hipY, m } = geo;
  const b = fit.bottom;
  const pantsLike = b.type === 'pants' || b.type === 'pjPants' || b.type === 'overalls';
  const legColor = pantsLike ? (b.color ?? ch.skin) : ch.skin;
  const sock = !!fit.socks;
  const sockColor = fit.socks ?? legColor;
  const boot = fit.shoes.boot;
  const shoeColor = fit.shoes.color;
  const seed = 1 + char.charCodeAt(0) + dir.charCodeAt(0) + age.charCodeAt(0);

  const lx = cx;
  const top: Pt = [lx, hipY - 8];
  const footY = boot ? ground - 20 : ground - 9;
  const knee: Pt = [lx + 1, hipY + (footY - hipY) * 0.55];
  const bot: Pt = [lx + 2, footY];

  const figTop = hipY - 12;
  const figBot = ground + 4;
  const figH = figBot - figTop;
  const figW = 40;
  const scale = 90 / figW;
  const cw = 90;
  const chh = Math.round(figH * scale);
  const { c, g } = sprite(cw, chh);
  g.save();
  g.scale(scale, scale);
  g.translate(-(lx - figW / 2), -figTop);

  const segs = sock
    ? [
        { pts: [top, knee] as Pt[], color: legColor, w: m.legW },
        { pts: [knee, bot] as Pt[], color: sockColor, w: m.legW },
      ]
    : undefined;
  limb(g, PEN, [top, knee, bot], m.legW, legColor, seed, segs);
  shoeF(g, lx + 2.5, ground, shoeColor, boot, seed + 31);
  g.restore();

  return { canvas: c, aspect: cw / chh };
}

/**
 * Per-age plate placement, in metres, derived from the SAME figure frame the
 * plates are drawn in — so head / torso / leg planes line up into one figure
 * and kid / teen / adult share proportions (head stays big, limbs stretch).
 *
 * One figure-unit → U metres, fixed so the adult leg matches the rig's original
 * 0.78 m hip height. Everything else (torso, head, anchors) follows from the
 * frame, so changing AGE_M is enough to retune a whole age.
 */
const U = 0.78 / AGE_M.adult.legL;

export interface PlateLayout {
  /** Leg plate height (m) — pivot at top (hip). */
  legH: number;
  /** Hip height above the ground (m) — leg pivot + torso bottom reference. */
  hipY: number;
  /** Torso plate height (m) — pivot at bottom. */
  torsoH: number;
  /** Torso plate bottom-anchor height (m). */
  torsoBottomY: number;
  /** Head plate height (m) — pivot at bottom (in the collar). */
  headH: number;
  /** Head plate pivot height (m). */
  headY: number;
}

export function plateLayout(age: AgeId): PlateLayout {
  const geo = makeGeo(age);
  const { m, ground, hipY: figHip, torsoTop: figTorsoTop, hcy } = geo;

  // Leg plate spans figTop..figBot (matches drawWalkerLeg).
  const legFigTop = figHip - 12;
  const legFigBot = ground + 4;
  const legH = (legFigBot - legFigTop) * U;
  const hipY = m.legL * U;

  // Torso plate spans (torsoTop-14)..(hipY+22) (matches drawWalkerTorso).
  const torsoFigTop = figTorsoTop - 14;
  const torsoFigBot = figHip + 22;
  const torsoH = (torsoFigBot - torsoFigTop) * U;
  // The figure's ground (292) maps to y=0; a figure y maps to metres via
  // (ground - y) * U. Torso plate is bottom-anchored at its figure bottom edge.
  const torsoBottom = (ground - torsoFigBot) * U;

  // Head plate spans (hcy-hry*1.5 - pad)..(torsoTop+8) (matches drawWalkerHead).
  const headFigTop = hcy - m.hry * 1.5 - 6;
  const headFigBot = figTorsoTop + 8;
  const headH = (headFigBot - headFigTop) * U;
  const headY = (ground - headFigBot) * U;

  return {
    legH,
    hipY,
    torsoH,
    torsoBottomY: torsoBottom,
    headH,
    headY,
  };
}
