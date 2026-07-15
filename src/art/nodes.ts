/**
 * Resource-node plates (BUILDING_SYSTEM §8.1) — extra-large hand-drawn sources
 * with visible harvest states (full → worked → spent/regrowing). Same cutout
 * pipeline + palette as props.ts. One parametric draw fn per node type, taking
 * the harvest state so the world can re-plate as charges deplete and regrow.
 */

import { Rng } from '../physics/mujoco/rng';
import { CLAY, INK, ROBOT, SAGE, WATER } from './palette';
import { blob, wobblyLine, speckle } from './strokes';
import { createCanvas, ctx2d } from './textures';
import type { PropSprite } from './props';
import type { HarvestState } from '../game/workshop/nodes';
import type { NodeType } from '../game/workshop/nodes';

function sprite(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = createCanvas(w, h);
  return { c, g: ctx2d(c) };
}

/** Canopy fullness by harvest state — spent trees lose their crown. */
function canopyAlpha(state: HarvestState): number {
  return state === 'full' ? 1 : state === 'worked' ? 0.7 : state === 'regrowing' ? 0.35 : 0.12;
}

/** A Great Tree — much bigger than a glade tree, with a worked stump state. */
function drawGreatTree(seed: number, state: HarvestState): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(640, 820);
  const baseY = 792;
  // Trunk — thick, tapered.
  g.beginPath();
  g.moveTo(284, baseY);
  g.quadraticCurveTo(296, 520, 300, 360);
  g.lineTo(352, 360);
  g.quadraticCurveTo(356, 520, 372, baseY);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.stroke();
  for (let i = 0; i < 5; i++) {
    const x = 300 + rng.next() * 56;
    wobblyLine(g, rng, x, baseY - 30, x + (rng.next() * 12 - 6), 380 + rng.next() * 120, 3, CLAY.deep, 2, 5);
  }
  // Canopy — big stacked sage masses, fading with harvest.
  const a = canopyAlpha(state);
  if (a > 0.15) {
    g.save();
    g.globalAlpha = a;
    blob(g, rng, 326, 280, 260, 200, { fill: SAGE.deep, outline: INK.line, lineWidth: 6 }, 14, 0.1);
    blob(g, rng, 240, 230, 160, 130, { fill: SAGE.mid }, 11, 0.12);
    blob(g, rng, 420, 220, 150, 120, { fill: SAGE.mid }, 11, 0.12);
    blob(g, rng, 320, 170, 150, 110, { fill: SAGE.light }, 11, 0.12);
    g.restore();
  } else {
    // Spent: a fresh sawn top + a tiny regrow sprout.
    blob(g, rng, 326, 356, 60, 22, { fill: CLAY.pale, outline: INK.line, lineWidth: 5 }, 10, 0.06);
    if (state === 'regrowing') {
      wobblyLine(g, rng, 326, 352, 322, 312, 4, SAGE.shade, 1.5, 4);
      blob(g, rng, 312, 308, 16, 9, { fill: SAGE.light, outline: INK.soft, lineWidth: 2.5 }, 8, 0.12);
      blob(g, rng, 340, 304, 16, 9, { fill: SAGE.mid, outline: INK.soft, lineWidth: 2.5 }, 8, 0.12);
    }
  }
  return { canvas: c, aspect: 640 / 820 };
}

/** An Old Boulder — a big worked rock; rubble appears as it's mined. */
function drawBoulder(seed: number, state: HarvestState): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(560, 440);
  const shrink = state === 'full' ? 1 : state === 'worked' ? 0.84 : 0.62;
  blob(g, rng, 280, 300, 230 * shrink, 150 * shrink, { fill: CLAY.pale, outline: INK.line, lineWidth: 6 }, 11, 0.12);
  g.save();
  g.globalAlpha = 0.5;
  blob(g, rng, 280, 360, 190 * shrink, 56, { fill: CLAY.light }, 9, 0.15);
  g.restore();
  blob(g, rng, 230, 220, 90, 40, { fill: SAGE.light }, 8, 0.2); // moss cap
  wobblyLine(g, rng, 200, 260, 300, 360, 3, INK.soft, 2.5, 5);
  wobblyLine(g, rng, 340, 240, 380, 340, 2.5, INK.soft, 2, 4);
  // Mined rubble at the base when worked/spent.
  if (state !== 'full') {
    for (let i = 0; i < (state === 'spent' ? 6 : 3); i++) {
      blob(g, rng, 150 + rng.next() * 260, 392 + rng.next() * 24, 18, 12, { fill: CLAY.pale, outline: INK.line, lineWidth: 3 }, 7, 0.1);
    }
  }
  speckle(g, rng, 120, 200, 320, 180, 30, INK.grain, 0.16, 1.8);
  return { canvas: c, aspect: 560 / 440 };
}

/** A clay seam in the lake bank — a low scooped earthen shelf. */
function drawClaySeam(seed: number, state: HarvestState): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(480, 320);
  blob(g, rng, 240, 220, 210, 96, { fill: CLAY.deep, outline: INK.line, lineWidth: 5 }, 11, 0.1);
  const scoops = state === 'full' ? 0 : state === 'worked' ? 2 : 4;
  for (let i = 0; i < scoops; i++) {
    blob(g, rng, 130 + i * 70, 200 + rng.next() * 20, 36, 22, { fill: CLAY.blossom, outline: INK.soft, lineWidth: 3 }, 8, 0.12);
  }
  blob(g, rng, 240, 282, 220, 30, { fill: WATER.edge }, 10, 0.06); // wet bank
  return { canvas: c, aspect: 480 / 320 };
}

/** A flint lode in a ruin outcrop — dark angular stone shards. */
function drawFlintLode(seed: number, state: HarvestState): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(480, 400);
  blob(g, rng, 240, 300, 200, 110, { fill: CLAY.light, outline: INK.line, lineWidth: 5 }, 10, 0.12);
  const shards = state === 'full' ? 6 : state === 'worked' ? 3 : 1;
  for (let i = 0; i < shards; i++) {
    const x = 150 + (i % 3) * 90 + rng.next() * 20;
    const y = 230 - Math.floor(i / 3) * 50 + rng.next() * 16;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 26, y - 40);
    g.lineTo(x + 44, y + 6);
    g.lineTo(x + 18, y + 22);
    g.closePath();
    g.fillStyle = ROBOT.visor;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 3.5;
    g.lineJoin = 'round';
    g.stroke();
  }
  return { canvas: c, aspect: 480 / 400 };
}

/** A bolt cache — an old machine site half-buried in the far corner. */
function drawBoltCache(seed: number, state: HarvestState): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(520, 420);
  // Buried machine body — a soft charcoal hull with cream panels.
  g.beginPath();
  g.moveTo(120, 340);
  g.quadraticCurveTo(110, 220, 220, 196);
  g.quadraticCurveTo(360, 176, 408, 260);
  g.quadraticCurveTo(430, 320, 400, 348);
  g.closePath();
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.stroke();
  // Panel + amber dormant light.
  blob(g, rng, 250, 250, 60, 36, { fill: ROBOT.shell, outline: INK.line, lineWidth: 4 }, 8, 0.06);
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.arc(330, 250, 9, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3;
  g.stroke();
  // Loose bolts scatter as it's worked.
  const bolts = state === 'full' ? 5 : state === 'worked' ? 2 : 0;
  for (let i = 0; i < bolts; i++) {
    blob(g, rng, 160 + rng.next() * 240, 360 + rng.next() * 22, 12, 9, { fill: ROBOT.darkShade, outline: INK.line, lineWidth: 3 }, 7, 0.1);
  }
  return { canvas: c, aspect: 520 / 420 };
}

/** A reed bed — a dense lake-rim stand; shears leave tidy stubble. */
function drawReedBed(seed: number, state: HarvestState): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(480, 420);
  const baseY = 380;
  // Wet bank the stand grows out of.
  blob(g, rng, 240, baseY, 200, 34, { fill: WATER.edge }, 11, 0.08);
  blob(g, rng, 240, baseY - 6, 170, 24, { fill: CLAY.deep, outline: INK.soft, lineWidth: 3 }, 10, 0.1);
  const stems = state === 'full' ? 14 : state === 'worked' ? 8 : state === 'regrowing' ? 4 : 2;
  for (let i = 0; i < stems; i++) {
    const x = 90 + rng.next() * 300;
    const h = 200 + rng.next() * 140;
    wobblyLine(g, rng, x, baseY - 8, x + (rng.next() * 18 - 9), baseY - h, 4, SAGE.shade, 1.5, 5);
    // Seed head.
    blob(g, rng, x + (rng.next() * 14 - 7), baseY - h - 8, 9, 22, { fill: CLAY.mid, outline: INK.soft, lineWidth: 2.5 }, 7, 0.12);
  }
  // Cut stubble appears where stems were sheared.
  const stubble = state === 'full' ? 0 : state === 'worked' ? 6 : 10;
  for (let i = 0; i < stubble; i++) {
    const x = 100 + rng.next() * 280;
    wobblyLine(g, rng, x, baseY - 6, x + (rng.next() * 6 - 3), baseY - 28 - rng.next() * 16, 3.5, SAGE.mid, 1, 3);
  }
  return { canvas: c, aspect: 480 / 420 };
}

/** A shell bank — a pale sand crescent; scooping uncovers, then empties it. */
function drawShellBank(seed: number, state: HarvestState): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(520, 300);
  blob(g, rng, 260, 210, 220, 70, { fill: WATER.sand, outline: INK.line, lineWidth: 5 }, 11, 0.1);
  blob(g, rng, 260, 252, 230, 26, { fill: WATER.edge }, 10, 0.06); // waterline
  const shells = state === 'full' ? 6 : state === 'worked' ? 3 : state === 'regrowing' ? 2 : 0;
  for (let i = 0; i < shells; i++) {
    const x = 120 + rng.next() * 280;
    const y = 168 + rng.next() * 50;
    blob(g, rng, x, y, 18, 13, { fill: WATER.edge, outline: INK.line, lineWidth: 3 }, 8, 0.1);
    wobblyLine(g, rng, x - 8, y - 6, x - 2, y + 8, 1.5, INK.soft, 0.6, 2);
    wobblyLine(g, rng, x + 2, y - 8, x + 5, y + 7, 1.5, INK.soft, 0.6, 2);
  }
  // Scoop hollows where the bank has been worked.
  const hollows = state === 'full' ? 0 : state === 'worked' ? 2 : 4;
  for (let i = 0; i < hollows; i++) {
    blob(g, rng, 140 + i * 80 + rng.next() * 24, 200 + rng.next() * 18, 30, 14, { fill: CLAY.pale, outline: INK.soft, lineWidth: 2.5 }, 8, 0.12);
  }
  speckle(g, rng, 80, 150, 360, 110, 26, INK.grain, 0.14, 1.6);
  return { canvas: c, aspect: 520 / 300 };
}

/** A driftwood drift — silvered logs the lake left behind; axed down to chips. */
function drawDriftwood(seed: number, state: HarvestState): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(560, 340);
  blob(g, rng, 280, 296, 230, 28, { fill: WATER.sand }, 10, 0.08); // strand
  const logs = state === 'full' ? 3 : state === 'worked' ? 2 : state === 'regrowing' ? 1 : 1;
  for (let i = 0; i < logs; i++) {
    const y = 250 - i * 44 + rng.next() * 8;
    const x0 = 110 + rng.next() * 40 + i * 18;
    const x1 = x0 + 280 - i * 40;
    // A weathered log: pale body, ink outline, end ring.
    g.beginPath();
    g.moveTo(x0, y - 18);
    g.quadraticCurveTo((x0 + x1) / 2, y - 30 + rng.next() * 8, x1, y - 14);
    g.lineTo(x1 + 6, y + 8);
    g.quadraticCurveTo((x0 + x1) / 2, y + 22, x0 - 4, y + 12);
    g.closePath();
    g.fillStyle = CLAY.pale;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.stroke();
    blob(g, rng, x1 + 2, y - 3, 13, 11, { fill: CLAY.light, outline: INK.line, lineWidth: 3.5 }, 8, 0.1);
    wobblyLine(g, rng, x0 + 30, y - 6, x1 - 40, y - 2, 2, CLAY.mid, 1.2, 5);
  }
  // Chips and split pieces accumulate as it's worked.
  const chips = state === 'full' ? 0 : state === 'worked' ? 4 : 7;
  for (let i = 0; i < chips; i++) {
    blob(g, rng, 130 + rng.next() * 300, 286 + rng.next() * 18, 14, 8, { fill: CLAY.pale, outline: INK.soft, lineWidth: 2.5 }, 7, 0.14);
  }
  return { canvas: c, aspect: 560 / 340 };
}

const DRAW: Record<NodeType, (seed: number, state: HarvestState) => PropSprite> = {
  'great-tree': drawGreatTree,
  'old-boulder': drawBoulder,
  'clay-seam': drawClaySeam,
  'flint-lode': drawFlintLode,
  'bolt-cache': drawBoltCache,
  'reed-bed': drawReedBed,
  'shell-bank': drawShellBank,
  driftwood: drawDriftwood,
};

export function drawNode(type: NodeType, state: HarvestState, seed: number): PropSprite {
  return DRAW[type](seed, state);
}
