/**
 * The human companion's plates — same hand-drawn cutout language as the
 * world: ink outlines, flat warm fills, no face acting (two quiet eye dots;
 * feeling stays with the robot). Sage sweater, clay trousers — the palette's
 * two families on the one human in the scene.
 */

import { Rng } from '../physics/mujoco/rng';
import { CLAY, INK, ROBOT, SAGE } from './palette';
import { blob, blobPoints, paintBlob } from './strokes';
import { createCanvas, ctx2d } from './textures';
import type { PropSprite } from './props';

function sprite(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = createCanvas(w, h);
  return { c, g: ctx2d(c) };
}

/** The walker's look — same gentle figure, hair tells them apart. */
export type AvatarStyle = 'boy' | 'girl';

/** Head — round, charcoal hair, calm profile-ish face. Pivot = bottom center. */
export function drawHumanHead(seed: number, style: AvatarStyle = 'boy'): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 208);
  // Girl: long hair behind everything — a soft curtain falling past the
  // shoulders, tucked into the collar (the plane bottom sits inside it).
  if (style === 'girl') {
    g.beginPath();
    g.moveTo(48, 196);
    g.quadraticCurveTo(26, 170, 28, 112);
    g.quadraticCurveTo(22, 28, 96, 22);
    g.quadraticCurveTo(170, 28, 164, 112);
    g.quadraticCurveTo(166, 170, 144, 196);
    g.quadraticCurveTo(120, 206, 96, 204);
    g.quadraticCurveTo(72, 206, 48, 196);
    g.closePath();
    g.fillStyle = ROBOT.dark;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.stroke();
  }
  // Neck — runs all the way to the plane bottom (the pivot sits inside the
  // sweater collar, so head and body always read as one connected figure).
  g.fillStyle = '#e8cdb2';
  g.fillRect(81, 158, 30, 50);
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(81, 158);
  g.lineTo(81, 208);
  g.moveTo(111, 158);
  g.lineTo(111, 208);
  g.stroke();
  // Face.
  const face = blobPoints(rng, 96, 100, 62, 68, 12, 0.03);
  paintBlob(g, face, { fill: '#edd3b8', outline: INK.line, lineWidth: 5 });
  // Hair — a soft charcoal cap with a swoop over the brow (the girl's fringe).
  g.beginPath();
  g.moveTo(34, 96);
  g.quadraticCurveTo(28, 28, 96, 24);
  g.quadraticCurveTo(166, 28, 160, 98);
  g.quadraticCurveTo(150, 64, 118, 58);
  g.quadraticCurveTo(70, 52, 52, 78);
  g.quadraticCurveTo(40, 88, 34, 96);
  g.closePath();
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Two quiet eye dots.
  g.fillStyle = INK.line;
  for (const x of [82, 122]) {
    g.beginPath();
    g.arc(x, 102, 4.5, 0, Math.PI * 2);
    g.fill();
  }
  // A small ear for the boy; the girl's hair covers hers.
  if (style === 'boy') {
    g.strokeStyle = INK.soft;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(40, 110, 9, -0.8, 0.9);
    g.stroke();
  }
  return { canvas: c, aspect: 192 / 208 };
}

/**
 * Torso — sage sweater with the leash arm reaching forward (right). The hand
 * is at a known anchor so the leash can attach. Pivot = bottom center.
 */
export function drawHumanTorso(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 256);
  // Body.
  g.beginPath();
  g.moveTo(86, 246);
  g.quadraticCurveTo(74, 130, 92, 64);
  g.quadraticCurveTo(128, 46, 164, 64);
  g.quadraticCurveTo(182, 130, 170, 246);
  g.closePath();
  g.fillStyle = SAGE.deep;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5.5;
  g.lineJoin = 'round';
  g.stroke();
  // Knit hem + collar ticks.
  g.strokeStyle = SAGE.shade;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(90, 224);
  g.quadraticCurveTo(128, 232, 166, 224);
  g.stroke();
  g.beginPath();
  g.moveTo(100, 70);
  g.quadraticCurveTo(128, 80, 156, 70);
  g.stroke();
  // Leash arm reaching forward-down, cream hand.
  g.beginPath();
  g.moveTo(160, 84);
  g.quadraticCurveTo(214, 110, 228, 158);
  g.lineTo(206, 172);
  g.quadraticCurveTo(188, 130, 148, 112);
  g.closePath();
  g.fillStyle = SAGE.deep;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  blob(g, rng, 222, 172, 15, 13, { fill: '#edd3b8', outline: INK.line, lineWidth: 4 }, 8, 0.08);
  // The far arm hangs, hinted behind the body.
  g.save();
  g.globalAlpha = 0.85;
  g.beginPath();
  g.moveTo(92, 86);
  g.quadraticCurveTo(66, 130, 72, 178);
  g.lineTo(90, 182);
  g.quadraticCurveTo(88, 136, 106, 100);
  g.closePath();
  g.fillStyle = SAGE.shade;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  g.restore();
  return { canvas: c, aspect: 1 };
}

/** One trouser leg with a shoe. Pivot = top center. */
export function drawHumanLeg(seed: number): PropSprite {
  const rng = new Rng(seed);
  void rng.next();
  const { c, g } = sprite(96, 224);
  g.beginPath();
  g.moveTo(30, 10);
  g.quadraticCurveTo(24, 100, 34, 178);
  g.lineTo(64, 178);
  g.quadraticCurveTo(72, 100, 66, 10);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Cuff.
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(36, 166);
  g.lineTo(62, 166);
  g.stroke();
  // Shoe.
  g.beginPath();
  g.moveTo(30, 178);
  g.lineTo(78, 178);
  g.quadraticCurveTo(84, 192, 74, 200);
  g.lineTo(32, 200);
  g.quadraticCurveTo(24, 190, 30, 178);
  g.closePath();
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  return { canvas: c, aspect: 96 / 224 };
}
