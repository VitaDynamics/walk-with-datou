/**
 * Setpiece plates (E2) — the park's "great things": oversized, individually
 * authored cutouts that sit on ground aprons worldPaint already paints
 * (hollow oak, swing tree, willow bend, star circle, kite field, erratic).
 * Same pipeline + palette as props.ts; one draw fn per setpiece, plus the
 * tiny beat-bit sprites their staged events drift down (leaf/petal/mote)
 * and the jetty's ripple decal.
 */

import { Rng } from '../physics/mujoco/rng';
import { CLAY, GROUND, INK, SAGE, WATER } from './palette';
import { blob, speckle, wobblyLine } from './strokes';
import { createCanvas, ctx2d } from './textures';
import type { PropSprite } from './props';

function sprite(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = createCanvas(w, h);
  return { c, g: ctx2d(c) };
}

/** The Hollow Oak — a gnarled bole with a dark arch you can't quite see into. */
export function drawHollowOak(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(640, 760);
  const baseY = 732;
  // Wide gnarled trunk.
  g.beginPath();
  g.moveTo(200, baseY);
  g.quadraticCurveTo(186, 540, 236, 420);
  g.quadraticCurveTo(260, 350, 300, 330);
  g.lineTo(360, 330);
  g.quadraticCurveTo(412, 360, 424, 440);
  g.quadraticCurveTo(462, 560, 448, baseY);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 7;
  g.lineJoin = 'round';
  g.stroke();
  // Bark grain.
  for (let i = 0; i < 6; i++) {
    const x = 236 + rng.next() * 170;
    wobblyLine(g, rng, x, baseY - 24, x + (rng.next() * 16 - 8), 420 + rng.next() * 120, 3, CLAY.deep, 2, 6);
  }
  // The hollow: a dark arch at the base, ink-deep.
  g.beginPath();
  g.moveTo(268, baseY);
  g.quadraticCurveTo(266, 600, 322, 592);
  g.quadraticCurveTo(376, 600, 376, baseY);
  g.closePath();
  g.fillStyle = INK.line;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 6;
  g.stroke();
  // A sparse old crown — more sky than leaf.
  blob(g, rng, 320, 250, 250, 150, { fill: SAGE.deep, outline: INK.line, lineWidth: 6 }, 13, 0.14);
  blob(g, rng, 210, 220, 120, 86, { fill: SAGE.mid }, 10, 0.16);
  blob(g, rng, 430, 210, 120, 84, { fill: SAGE.mid }, 10, 0.16);
  blob(g, rng, 320, 156, 110, 70, { fill: SAGE.light }, 10, 0.14);
  speckle(g, rng, 120, 130, 400, 220, 26, INK.grain, 0.12, 1.8);
  return { canvas: c, aspect: 640 / 760 };
}

/** The Swing Tree — one strong sideways branch, a rope swing still hanging. */
export function drawSwingTree(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(560, 700);
  const baseY = 672;
  // Leaning trunk.
  g.beginPath();
  g.moveTo(150, baseY);
  g.quadraticCurveTo(160, 480, 220, 360);
  g.lineTo(266, 376);
  g.quadraticCurveTo(226, 500, 224, baseY);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.stroke();
  // The long branch the swing hangs from.
  wobblyLine(g, rng, 238, 372, 470, 320, 13, CLAY.mid, 1.5, 6);
  wobblyLine(g, rng, 238, 372, 470, 320, 3, INK.line, 1.5, 6);
  // Canopy over the trunk side.
  blob(g, rng, 240, 250, 190, 130, { fill: SAGE.deep, outline: INK.line, lineWidth: 6 }, 12, 0.13);
  blob(g, rng, 170, 210, 110, 80, { fill: SAGE.mid }, 10, 0.15);
  blob(g, rng, 320, 200, 110, 76, { fill: SAGE.light }, 10, 0.14);
  // The swing: two ropes, a worn plank seat.
  wobblyLine(g, rng, 396, 330, 392, 520, 3.5, CLAY.deep, 1.2, 6);
  wobblyLine(g, rng, 446, 322, 450, 516, 3.5, CLAY.deep, 1.2, 6);
  g.beginPath();
  g.moveTo(376, 518);
  g.lineTo(466, 514);
  g.lineTo(468, 534);
  g.lineTo(378, 538);
  g.closePath();
  g.fillStyle = CLAY.pale;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  return { canvas: c, aspect: 560 / 700 };
}

/** The Willow Bend — long green hair combing toward the water. */
export function drawWillow(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(620, 720);
  const baseY = 692;
  g.beginPath();
  g.moveTo(270, baseY);
  g.quadraticCurveTo(276, 520, 300, 400);
  g.lineTo(344, 400);
  g.quadraticCurveTo(360, 520, 352, baseY);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.stroke();
  // Crown mass.
  blob(g, rng, 310, 280, 250, 160, { fill: SAGE.mid, outline: INK.line, lineWidth: 6 }, 13, 0.12);
  blob(g, rng, 310, 210, 170, 100, { fill: SAGE.light }, 11, 0.13);
  // Hanging strands — the signature.
  for (let i = 0; i < 16; i++) {
    const x = 90 + (i / 15) * 440 + rng.next() * 16;
    const top = 300 + rng.next() * 60;
    const len = 200 + rng.next() * 180;
    wobblyLine(g, rng, x, top, x + (rng.next() * 24 - 12), top + len, 4, i % 3 === 0 ? SAGE.shade : SAGE.mid, 2, 7);
  }
  speckle(g, rng, 90, 200, 440, 200, 22, INK.grain, 0.1, 1.6);
  return { canvas: c, aspect: 620 / 720 };
}

/** The Erratic — a banded boulder a glacier forgot on the high meadow. */
export function drawErratic(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(520, 420);
  blob(g, rng, 260, 250, 220, 150, { fill: CLAY.pale, outline: INK.line, lineWidth: 7 }, 12, 0.1);
  // Strata bands — it isn't from around here.
  g.save();
  g.globalAlpha = 0.6;
  wobblyLine(g, rng, 70, 230, 452, 210, 7, CLAY.light, 2, 7);
  wobblyLine(g, rng, 86, 286, 440, 270, 6, GROUND.blotchB, 2, 7);
  g.restore();
  blob(g, rng, 200, 140, 80, 34, { fill: SAGE.light }, 8, 0.2); // moss saddle
  // Attendant stones.
  blob(g, rng, 80, 372, 30, 18, { fill: CLAY.pale, outline: INK.line, lineWidth: 4 }, 8, 0.12);
  blob(g, rng, 446, 380, 24, 14, { fill: CLAY.light, outline: INK.line, lineWidth: 3.5 }, 7, 0.12);
  speckle(g, rng, 100, 180, 320, 180, 26, INK.grain, 0.14, 1.8);
  return { canvas: c, aspect: 520 / 420 };
}

/** The Star Circle — nine patient stones laid in a ring (ground decal). */
export function drawStarCircle(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(560, 560);
  // Worn ground inside the ring.
  blob(g, rng, 280, 280, 210, 200, { fill: GROUND.blotchB }, 12, 0.08);
  // Little stars scratched into the worn ground — sky notes, not a sigil.
  g.save();
  g.globalAlpha = 0.45;
  g.strokeStyle = INK.soft;
  g.lineWidth = 3.5;
  for (let i = 0; i < 6; i++) {
    const sx = 200 + rng.next() * 160;
    const sy = 210 + rng.next() * 150;
    const r = 12 + rng.next() * 10;
    for (const a of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
      g.beginPath();
      g.moveTo(sx - Math.cos(a) * r, sy - Math.sin(a) * r);
      g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      g.stroke();
    }
  }
  g.restore();
  // Nine stones.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng.next() * 0.12;
    const r = 196 + rng.next() * 18;
    const x = 280 + Math.cos(a) * r;
    const y = 280 + Math.sin(a) * r * 0.92;
    blob(g, rng, x, y, 26 + rng.next() * 10, 20 + rng.next() * 8, { fill: CLAY.pale, outline: INK.line, lineWidth: 5 }, 8, 0.14);
  }
  speckle(g, rng, 120, 120, 320, 320, 30, INK.grain, 0.1, 1.8);
  return { canvas: c, aspect: 1 };
}

/** The Kite Tree — a kite has lived in the upper branches for years. */
export function drawKiteTree(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(560, 700);
  const baseY = 672;
  g.beginPath();
  g.moveTo(238, baseY);
  g.quadraticCurveTo(246, 500, 262, 380);
  g.lineTo(306, 380);
  g.quadraticCurveTo(316, 500, 314, baseY);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.stroke();
  blob(g, rng, 280, 270, 210, 140, { fill: SAGE.deep, outline: INK.line, lineWidth: 6 }, 12, 0.13);
  blob(g, rng, 200, 230, 110, 80, { fill: SAGE.mid }, 10, 0.15);
  blob(g, rng, 360, 220, 110, 78, { fill: SAGE.light }, 10, 0.14);
  // The kite: a warm clay diamond wedged in the crown, tail trailing.
  g.beginPath();
  g.moveTo(382, 150);
  g.lineTo(424, 196);
  g.lineTo(382, 252);
  g.lineTo(342, 196);
  g.closePath();
  g.fillStyle = CLAY.blossom;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  wobblyLine(g, rng, 382, 160, 382, 244, 2.5, INK.soft, 0.8, 3);
  wobblyLine(g, rng, 348, 196, 418, 196, 2.5, INK.soft, 0.8, 3);
  // Tail with little bows.
  wobblyLine(g, rng, 382, 252, 420, 360, 2.5, INK.soft, 3, 6);
  for (const [bx, by] of [[394, 286], [408, 322], [418, 352]] as const) {
    blob(g, rng, bx, by, 10, 6, { fill: CLAY.blossom, outline: INK.soft, lineWidth: 2.5 }, 7, 0.18);
  }
  return { canvas: c, aspect: 560 / 700 };
}

// --- Beat bits: the small plates a staged event drifts down -----------------

export type BeatArt = 'leaf' | 'petal' | 'mote' | 'ripple';

function drawLeafBit(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(64, 64);
  blob(g, rng, 32, 32, 20, 11, { fill: SAGE.mid, outline: INK.soft, lineWidth: 2.5 }, 8, 0.18);
  wobblyLine(g, rng, 16, 34, 48, 30, 1.5, SAGE.shade, 0.8, 3);
  return { canvas: c, aspect: 1 };
}

function drawPetalBit(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(64, 64);
  blob(g, rng, 32, 32, 15, 10, { fill: CLAY.blossom, outline: INK.soft, lineWidth: 2 }, 7, 0.2);
  return { canvas: c, aspect: 1 };
}

function drawMoteBit(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(64, 64);
  blob(g, rng, 32, 32, 9, 9, { fill: CLAY.pale, outline: INK.soft, lineWidth: 2 }, 7, 0.16);
  blob(g, rng, 32, 32, 4, 4, { fill: WATER.sand }, 6, 0.1);
  return { canvas: c, aspect: 1 };
}

/** An expanding ring for the jetty's water beat (decal). */
function drawRippleBit(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 256);
  g.save();
  g.globalAlpha = 0.7;
  for (const r of [70, 96]) {
    const pts = 26;
    g.strokeStyle = WATER.edge;
    g.lineWidth = r === 70 ? 7 : 4;
    g.beginPath();
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const rr = r + (rng.next() * 2 - 1) * 4;
      const x = 128 + Math.cos(a) * rr;
      const y = 128 + Math.sin(a) * rr;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
  return { canvas: c, aspect: 1 };
}

const BEAT_DRAW: Record<BeatArt, (seed: number) => PropSprite> = {
  leaf: drawLeafBit,
  petal: drawPetalBit,
  mote: drawMoteBit,
  ripple: drawRippleBit,
};

export function drawBeatBit(art: BeatArt, seed: number): PropSprite {
  return BEAT_DRAW[art](seed);
}

const SETPIECE_DRAW: Record<string, (seed: number) => PropSprite> = {
  'hollow-oak': drawHollowOak,
  'swing-tree': drawSwingTree,
  'willow-bend': drawWillow,
  erratic: drawErratic,
  'star-circle': drawStarCircle,
  'kite-tree': drawKiteTree,
};

/** Plate for a setpiece id (null for the anchored ones that reuse hero props). */
export function drawSetpiece(id: string, seed: number): PropSprite | null {
  return SETPIECE_DRAW[id]?.(seed) ?? null;
}
