/**
 * Critter plates (E5) — the park's small animals, drawn in the same wobble-ink
 * cutout language. Every kind keeps ONE canvas size across its poses so a
 * critter can swap pose textures on a single plate without changing aspect.
 *
 * Palette only: sparrow and squirrel in CLAY, the cat a soft charcoal
 * (ROBOT.dark), ducks CLAY-pale with a deep-sage head, butterfly blossom-pink.
 */

import { Rng } from '../physics/mujoco/rng';
import { CLAY, INK, ROBOT, SAGE, WATER } from './palette';
import { blob, wobblyLine } from './strokes';
import { createCanvas, ctx2d } from './textures';
import type { PropSprite } from './props';

export type CritterKind = 'bird' | 'butterfly' | 'fin' | 'cat' | 'duck' | 'squirrel' | 'dog';
export type CritterPose = 'idle' | 'alt' | 'move';

function sprite(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = createCanvas(w, h);
  return { c, g: ctx2d(c) };
}

/** A sparrow — idle: perched · alt: wings up (flap frame) · move: glide. */
function drawBird(pose: CritterPose, seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 96);
  const baseY = 78;
  // Body.
  blob(g, rng, 46, baseY - 18, 20, 14, { fill: CLAY.mid, outline: INK.line, lineWidth: 3 }, 9, 0.1);
  blob(g, rng, 60, baseY - 30, 11, 9, { fill: CLAY.mid, outline: INK.line, lineWidth: 2.5 }, 8, 0.1);
  // Pale chest.
  blob(g, rng, 50, baseY - 14, 10, 7, { fill: CLAY.pale }, 7, 0.12);
  // Eye + beak.
  g.fillStyle = INK.line;
  g.beginPath();
  g.arc(63, baseY - 32, 1.8, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(70, baseY - 31);
  g.lineTo(78, baseY - 29);
  g.lineTo(70, baseY - 27);
  g.closePath();
  g.fillStyle = CLAY.deep;
  g.fill();
  // Tail.
  wobblyLine(g, rng, 28, baseY - 20, 16, baseY - 26, 4, CLAY.deep, 0.8, 2);
  if (pose === 'idle') {
    // Folded wing + legs.
    blob(g, rng, 44, baseY - 20, 12, 7, { fill: CLAY.deep }, 8, 0.12);
    for (const x of [42, 50]) wobblyLine(g, rng, x, baseY - 6, x + 1, baseY, 1.6, INK.line, 0.4, 2);
  } else if (pose === 'alt') {
    // Wings raised.
    blob(g, rng, 40, baseY - 38, 16, 8, { fill: CLAY.deep, outline: INK.soft, lineWidth: 2 }, 8, 0.16);
    blob(g, rng, 54, baseY - 40, 14, 7, { fill: CLAY.mid, outline: INK.soft, lineWidth: 2 }, 8, 0.16);
  } else {
    // Glide: wings out flat.
    blob(g, rng, 34, baseY - 26, 18, 6, { fill: CLAY.deep, outline: INK.soft, lineWidth: 2 }, 8, 0.14);
    blob(g, rng, 58, baseY - 26, 16, 5, { fill: CLAY.mid, outline: INK.soft, lineWidth: 2 }, 8, 0.14);
  }
  return { canvas: c, aspect: 1 };
}

/** A small blossom butterfly — idle/alt are the two wing frames. */
function drawButterfly(pose: CritterPose, seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(64, 64);
  const spread = pose === 'alt' ? 1 : 0.45; // folded ↔ open
  for (const s of [-1, 1] as const) {
    blob(g, rng, 32 + s * 11 * spread, 30, 11, 14, {
      fill: CLAY.blossom,
      outline: INK.soft,
      lineWidth: 2,
    }, 8, 0.14);
    blob(g, rng, 32 + s * 8 * spread, 42, 7, 8, { fill: CLAY.pale, outline: INK.soft, lineWidth: 1.8 }, 7, 0.14);
  }
  wobblyLine(g, rng, 32, 22, 32, 48, 2.5, INK.line, 0.4, 3);
  return { canvas: c, aspect: 1 };
}

/** A fish fin breaking the water (the lake's quiet hello). */
function drawFin(pose: CritterPose, seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 64);
  void pose;
  g.beginPath();
  g.moveTo(30, 48);
  g.quadraticCurveTo(44, 14, 58, 30);
  g.quadraticCurveTo(52, 38, 64, 48);
  g.closePath();
  g.fillStyle = WATER.mid;
  g.fill();
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.lineJoin = 'round';
  g.stroke();
  blob(g, rng, 47, 50, 26, 5, { fill: WATER.edge }, 8, 0.1);
  return { canvas: c, aspect: 96 / 64 };
}

/** The trail cat — a soft charcoal shorthair. idle: loaf · alt: sitting tall
 *  (Datou nearby) · move: mid-step. */
function drawCat(pose: CritterPose, seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 160);
  const baseY = 134;
  if (pose === 'idle') {
    // Loaf: a bread of cat.
    blob(g, rng, 80, baseY - 18, 38, 22, { fill: ROBOT.dark, outline: INK.line, lineWidth: 4 }, 10, 0.08);
    blob(g, rng, 110, baseY - 34, 17, 15, { fill: ROBOT.dark, outline: INK.line, lineWidth: 3.5 }, 9, 0.08);
  } else {
    // Sitting: tall front, haunches behind.
    blob(g, rng, 70, baseY - 22, 26, 24, { fill: ROBOT.dark, outline: INK.line, lineWidth: 4 }, 10, 0.08);
    blob(g, rng, 96, baseY - 38, 14, 22, { fill: ROBOT.dark, outline: INK.line, lineWidth: 3.5 }, 9, 0.08);
    blob(g, rng, 98, baseY - 62, 15, 13, { fill: ROBOT.dark, outline: INK.line, lineWidth: 3.5 }, 9, 0.08);
    if (pose === 'move') {
      // One paw lifted mid-step.
      wobblyLine(g, rng, 88, baseY - 8, 94, baseY - 16, 4, ROBOT.dark, 0.6, 2);
    }
  }
  const headX = pose === 'idle' ? 110 : 98;
  const headY = pose === 'idle' ? baseY - 34 : baseY - 62;
  // Ears.
  for (const s of [-1, 1] as const) {
    g.beginPath();
    g.moveTo(headX + s * 4, headY - 10);
    g.lineTo(headX + s * 12, headY - 20);
    g.lineTo(headX + s * 13, headY - 8);
    g.closePath();
    g.fillStyle = ROBOT.dark;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 3;
    g.stroke();
  }
  // Pale chest + closed eyes (it is ignoring you).
  blob(g, rng, headX - 2, headY + 10, 8, 6, { fill: ROBOT.shell }, 7, 0.12);
  g.strokeStyle = ROBOT.shell;
  g.lineWidth = 2;
  for (const s of [-1, 1] as const) {
    g.beginPath();
    g.moveTo(headX + s * 7 - 3, headY - 1);
    g.quadraticCurveTo(headX + s * 7, headY + 1, headX + s * 7 + 3, headY - 1);
    g.stroke();
  }
  // Tail curled round.
  wobblyLine(g, rng, 48, baseY - 12, 36, baseY - 30, 5, ROBOT.dark, 1.2, 4);
  return { canvas: c, aspect: 1 };
}

/** A lake duck — idle/alt are the paddle frames; pale body, deep-sage head. */
function drawDuck(pose: CritterPose, seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 128);
  const baseY = 96;
  const bob = pose === 'alt' ? 3 : 0;
  blob(g, rng, 60, baseY - 18 + bob, 30, 17, { fill: CLAY.pale, outline: INK.line, lineWidth: 3.5 }, 10, 0.08);
  // Wing fold.
  blob(g, rng, 56, baseY - 20 + bob, 16, 9, { fill: CLAY.light }, 8, 0.12);
  // Neck + sage head.
  blob(g, rng, 86, baseY - 38 + bob, 11, 11, { fill: SAGE.deep, outline: INK.line, lineWidth: 3 }, 8, 0.08);
  g.fillStyle = INK.line;
  g.beginPath();
  g.arc(89, baseY - 40 + bob, 1.6, 0, Math.PI * 2);
  g.fill();
  // Bill.
  g.beginPath();
  g.moveTo(95, baseY - 38 + bob);
  g.lineTo(106, baseY - 36 + bob);
  g.lineTo(95, baseY - 33 + bob);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.soft;
  g.lineWidth = 2;
  g.stroke();
  // Waterline.
  blob(g, rng, 62, baseY - 4, 34, 6, { fill: WATER.edge }, 9, 0.1);
  return { canvas: c, aspect: 1 };
}

/** The oak squirrel — idle: upright with the tail question-mark · move: dash. */
function drawSquirrel(pose: CritterPose, seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 96);
  const baseY = 80;
  if (pose === 'move') {
    // Stretched dash.
    blob(g, rng, 46, baseY - 12, 24, 9, { fill: CLAY.mid, outline: INK.line, lineWidth: 3 }, 9, 0.1);
    blob(g, rng, 66, baseY - 16, 9, 8, { fill: CLAY.mid, outline: INK.line, lineWidth: 2.5 }, 8, 0.1);
    wobblyLine(g, rng, 24, baseY - 14, 10, baseY - 22, 6, CLAY.deep, 1.2, 3);
  } else {
    // Upright, paws together, the big question-mark tail.
    blob(g, rng, 48, baseY - 16, 13, 17, { fill: CLAY.mid, outline: INK.line, lineWidth: 3 }, 9, 0.1);
    blob(g, rng, 48, baseY - 36, 10, 9, { fill: CLAY.mid, outline: INK.line, lineWidth: 2.5 }, 8, 0.1);
    blob(g, rng, 48, baseY - 12, 7, 8, { fill: CLAY.pale }, 7, 0.12);
    g.fillStyle = INK.line;
    g.beginPath();
    g.arc(52, baseY - 38, 1.5, 0, Math.PI * 2);
    g.fill();
    // Tail curling up behind.
    g.strokeStyle = CLAY.deep;
    g.lineCap = 'round';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(36, baseY - 8);
    g.quadraticCurveTo(20, baseY - 24, 28, baseY - 44);
    g.quadraticCurveTo(32, baseY - 54, 40, baseY - 52);
    g.stroke();
  }
  return { canvas: c, aspect: 1 };
}

/** The neighbor dog — a cream visitor. idle: standing · alt: play-bow ·
 *  move: trot frame. */
function drawDog(pose: CritterPose, seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 192);
  const baseY = 152;
  const bow = pose === 'alt';
  // Body (lowered front when bowing).
  blob(g, rng, 92, baseY - 36 + (bow ? 8 : 0), 38, 22, { fill: CLAY.light, outline: INK.line, lineWidth: 4 }, 10, 0.08);
  // Head.
  const hx = 128;
  const hy = bow ? baseY - 28 : baseY - 58;
  blob(g, rng, hx, hy, 17, 14, { fill: CLAY.light, outline: INK.line, lineWidth: 3.5 }, 9, 0.08);
  // The deep-clay ear patch.
  blob(g, rng, hx - 6, hy - 10, 9, 7, { fill: CLAY.deep, outline: INK.soft, lineWidth: 2.5 }, 8, 0.12);
  g.fillStyle = INK.line;
  g.beginPath();
  g.arc(hx + 6, hy - 2, 2, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(hx + 15, hy + 4, 2.6, 0, Math.PI * 2);
  g.fill();
  // Legs.
  const legY = baseY;
  if (bow) {
    wobblyLine(g, rng, 116, baseY - 16, 120, legY, 6, CLAY.light, 0.8, 2);
    wobblyLine(g, rng, 128, baseY - 16, 132, legY, 6, CLAY.light, 0.8, 2);
    wobblyLine(g, rng, 66, baseY - 22, 62, legY, 6, CLAY.light, 0.8, 2);
    wobblyLine(g, rng, 78, baseY - 22, 80, legY, 6, CLAY.light, 0.8, 2);
  } else {
    const step = pose === 'move' ? 6 : 0;
    wobblyLine(g, rng, 70 - step, baseY - 18, 66 - step, legY, 6, CLAY.light, 0.8, 2);
    wobblyLine(g, rng, 82, baseY - 18, 82, legY, 6, CLAY.light, 0.8, 2);
    wobblyLine(g, rng, 106, baseY - 18, 104 + step, legY, 6, CLAY.light, 0.8, 2);
    wobblyLine(g, rng, 118, baseY - 18, 120 + step, legY, 6, CLAY.light, 0.8, 2);
  }
  // Tail up and happy (extra-high when bowing).
  wobblyLine(g, rng, 56, baseY - 44, 42, baseY - (bow ? 70 : 60), 6, CLAY.light, 1.4, 3);
  for (const o of [3, 6]) {
    g.strokeStyle = INK.line;
    g.lineWidth = 3;
    void o;
  }
  return { canvas: c, aspect: 1 };
}

const DRAW: Record<CritterKind, (pose: CritterPose, seed: number) => PropSprite> = {
  bird: drawBird,
  butterfly: drawButterfly,
  fin: drawFin,
  cat: drawCat,
  duck: drawDuck,
  squirrel: drawSquirrel,
  dog: drawDog,
};

export function drawCritter(kind: CritterKind, pose: CritterPose, seed: number): PropSprite {
  return DRAW[kind](pose, seed);
}

/** A dropped acorn — the squirrel's rare gift (pack icon + ground plate). */
export function drawAcorn(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 96);
  blob(g, rng, 48, 56, 15, 17, { fill: CLAY.light, outline: INK.line, lineWidth: 3.5 }, 9, 0.08);
  blob(g, rng, 48, 40, 17, 9, { fill: CLAY.deep, outline: INK.line, lineWidth: 3 }, 9, 0.1);
  wobblyLine(g, rng, 48, 32, 50, 24, 3, CLAY.deep, 0.8, 2);
  return { canvas: c, aspect: 1 };
}
