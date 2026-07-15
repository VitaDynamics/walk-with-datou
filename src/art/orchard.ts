/**
 * Orchard plates (E4) — tended fruit trees, vegetable rows, and the small
 * fruit/veg bits used as falling plates, ground pickables and pack icons.
 * Same pipeline + palette as props.ts. Trees re-plate by season stage
 * (blossom → fruiting → bare); rows show their pulled-today state.
 */

import { Rng } from '../physics/mujoco/rng';
import { CLAY, GROUND, INK, SAGE } from './palette';
import { blob, speckle, wobblyLine } from './strokes';
import { createCanvas, ctx2d } from './textures';
import type { PropSprite } from './props';

export type FruitKind = 'apple' | 'pear' | 'plum';
export type VegKind = 'pumpkin' | 'turnip' | 'carrot';
export type TreeStage = 'blossom' | 'fruiting' | 'bare';

function sprite(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = createCanvas(w, h);
  return { c, g: ctx2d(c) };
}

const FRUIT_FILL: Record<FruitKind, string> = {
  apple: CLAY.blossom,
  pear: SAGE.light,
  plum: CLAY.deep,
};

/** A tended orchard tree — rounder and shorter than the wild ones. */
export function drawFruitTree(kind: FruitKind, stage: TreeStage, seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(420, 560);
  const baseY = 536;
  // Short tended trunk.
  g.beginPath();
  g.moveTo(186, baseY);
  g.quadraticCurveTo(192, 420, 198, 340);
  g.lineTo(226, 340);
  g.quadraticCurveTo(230, 420, 238, baseY);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Round tended crown.
  const dense = stage !== 'bare';
  blob(g, rng, 210, 230, 170, 130, {
    fill: dense ? SAGE.mid : SAGE.shade,
    outline: INK.line,
    lineWidth: 5.5,
  }, 12, 0.12);
  if (dense) {
    blob(g, rng, 150, 200, 90, 64, { fill: SAGE.light }, 10, 0.14);
    blob(g, rng, 280, 196, 86, 60, { fill: SAGE.deep }, 10, 0.14);
  }
  // Season dressing: blossom freckles or hanging fruit.
  if (stage === 'blossom') {
    for (let i = 0; i < 12; i++) {
      blob(g, rng, 90 + rng.next() * 240, 140 + rng.next() * 150, 9, 7, {
        fill: CLAY.blossom,
        outline: INK.soft,
        lineWidth: 2,
      }, 7, 0.2);
    }
  } else if (stage === 'fruiting') {
    for (let i = 0; i < 7; i++) {
      const x = 100 + rng.next() * 220;
      const y = 170 + rng.next() * 130;
      g.fillStyle = FRUIT_FILL[kind];
      g.beginPath();
      if (kind === 'pear') g.ellipse(x, y, 8, 11, 0, 0, Math.PI * 2);
      else g.arc(x, y, kind === 'plum' ? 7 : 9, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK.soft;
      g.lineWidth = 2.2;
      g.stroke();
    }
  }
  speckle(g, rng, 60, 120, 300, 180, 18, INK.grain, 0.1, 1.5);
  return { canvas: c, aspect: 420 / 560 };
}

/** A tilled vegetable row (ground decal) — humps of the crop along a strip. */
export function drawVegRow(kind: VegKind, pulled: number, seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(720, 220);
  // Soft till lines only — the painted world already owns the strip itself.
  g.save();
  g.globalAlpha = 0.4;
  for (let i = 0; i < 2; i++) {
    wobblyLine(g, rng, 80, 88 + i * 44, 640, 84 + i * 44, 4, GROUND.path, 1.5, 9);
  }
  g.restore();
  // Eight stations along the row; the first `pulled` are bare dimples.
  for (let i = 0; i < 8; i++) {
    const x = 90 + i * 78 + rng.next() * 10;
    const y = 96 + (i % 2) * 28 + rng.next() * 8;
    if (i < pulled) {
      blob(g, rng, x, y, 16, 9, { fill: GROUND.blotchB, outline: INK.soft, lineWidth: 2 }, 7, 0.14);
      continue;
    }
    if (kind === 'pumpkin') {
      blob(g, rng, x, y, 22, 16, { fill: CLAY.mid, outline: INK.line, lineWidth: 3.5 }, 9, 0.1);
      wobblyLine(g, rng, x - 8, y - 10, x + 8, y - 14, 2, SAGE.shade, 1, 3);
    } else if (kind === 'turnip') {
      blob(g, rng, x, y, 12, 9, { fill: CLAY.pale, outline: INK.line, lineWidth: 3 }, 8, 0.12);
      for (let l = 0; l < 3; l++)
        wobblyLine(g, rng, x - 4 + l * 4, y - 6, x - 6 + l * 6, y - 22 - rng.next() * 6, 2.5, SAGE.mid, 1, 3);
    } else {
      // Carrot: only the feathery tops show.
      for (let l = 0; l < 4; l++)
        wobblyLine(g, rng, x - 5 + l * 3.4, y, x - 9 + l * 6, y - 20 - rng.next() * 8, 2.5, SAGE.shade, 1.4, 3);
    }
  }
  speckle(g, rng, 60, 50, 600, 120, 24, INK.grain, 0.1, 1.5);
  return { canvas: c, aspect: 720 / 220 };
}

/** A single fruit / vegetable — falling plate, ground pickable, pack icon. */
export function drawFood(kind: FruitKind | VegKind, seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 96);
  switch (kind) {
    case 'apple':
      blob(g, rng, 48, 52, 22, 20, { fill: CLAY.blossom, outline: INK.line, lineWidth: 3.5 }, 9, 0.08);
      wobblyLine(g, rng, 48, 32, 50, 22, 2.5, CLAY.deep, 0.8, 2);
      break;
    case 'pear':
      blob(g, rng, 48, 58, 20, 16, { fill: SAGE.light, outline: INK.line, lineWidth: 3.5 }, 9, 0.08);
      blob(g, rng, 48, 40, 12, 12, { fill: SAGE.light, outline: INK.line, lineWidth: 3 }, 8, 0.08);
      wobblyLine(g, rng, 48, 28, 51, 19, 2.5, CLAY.deep, 0.8, 2);
      break;
    case 'plum':
      blob(g, rng, 48, 52, 18, 17, { fill: CLAY.deep, outline: INK.line, lineWidth: 3.5 }, 9, 0.08);
      wobblyLine(g, rng, 42, 42, 50, 36, 1.5, CLAY.pale, 0.6, 2);
      break;
    case 'pumpkin': {
      blob(g, rng, 48, 54, 26, 19, { fill: CLAY.mid, outline: INK.line, lineWidth: 3.5 }, 10, 0.06);
      for (const dx of [-10, 0, 10]) wobblyLine(g, rng, 48 + dx, 38, 48 + dx, 70, 2, CLAY.deep, 0.6, 3);
      wobblyLine(g, rng, 48, 34, 52, 26, 3, SAGE.shade, 0.8, 2);
      break;
    }
    case 'turnip':
      blob(g, rng, 48, 56, 17, 14, { fill: CLAY.pale, outline: INK.line, lineWidth: 3.5 }, 9, 0.1);
      for (let l = 0; l < 3; l++)
        wobblyLine(g, rng, 44 + l * 4, 44, 40 + l * 8, 24 + rng.next() * 6, 2.5, SAGE.mid, 1, 3);
      break;
    case 'carrot':
      g.beginPath();
      g.moveTo(38, 36);
      g.quadraticCurveTo(46, 38, 58, 42);
      g.quadraticCurveTo(54, 56, 44, 68);
      g.quadraticCurveTo(38, 52, 38, 36);
      g.closePath();
      g.fillStyle = CLAY.blossom;
      g.fill();
      g.strokeStyle = INK.line;
      g.lineWidth = 3.5;
      g.lineJoin = 'round';
      g.stroke();
      for (let l = 0; l < 3; l++)
        wobblyLine(g, rng, 40 + l * 5, 34, 34 + l * 9, 20 + rng.next() * 5, 2.5, SAGE.shade, 1, 3);
      break;
  }
  return { canvas: c, aspect: 1 };
}
