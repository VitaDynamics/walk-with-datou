/**
 * Datou's body plates — a segmented hand-drawn robot quadruped.
 *
 * Like a paper puppet: body, head (with visor), four legs, antenna-tail are
 * separate sprites the rig animates (leg swing, head tilt, tail wag). Emotion
 * lives in the EYES — a swappable texture on the visor — plus posture, per the
 * baseline ("eye shape, posture, rhythm — no big cartoon faces").
 */

import { Rng } from '../physics/mujoco/rng';
import { INK, ROBOT } from './palette';
import { blob, blobPoints, paintBlob } from './strokes';
import { createCanvas, ctx2d } from './textures';

import type { PropSprite } from './props';

function sprite(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = createCanvas(w, h);
  return { c, g: ctx2d(c) };
}

function roundedRectPath(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Torso — rounded charcoal shell with a cream side panel and seam lines. */
export function drawBody(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(360, 220);
  // Shell.
  const pts = blobPoints(rng, 180, 110, 150, 78, 12, 0.035);
  paintBlob(g, pts, { fill: ROBOT.dark, outline: INK.line, lineWidth: 6 });
  // Cream side panel (slightly inset).
  const panel = blobPoints(rng, 180, 122, 112, 52, 12, 0.04);
  paintBlob(g, panel, { fill: ROBOT.shell, outline: INK.soft, lineWidth: 3.5 });
  // Panel seam + two fastener dots — quiet product detailing.
  g.strokeStyle = ROBOT.shellShade;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(120, 100);
  g.quadraticCurveTo(180, 88, 240, 100);
  g.stroke();
  g.fillStyle = ROBOT.shellShade;
  for (const x of [104, 256]) {
    g.beginPath();
    g.arc(x, 122, 5, 0, Math.PI * 2);
    g.fill();
  }
  // One small warm accent: a tiny status dot near the shoulder.
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.arc(282, 86, 7, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 2.5;
  g.stroke();
  return { canvas: c, aspect: 360 / 220 };
}

/** Head — rounded shell, cream faceplate, dark visor band, two ear nubs. */
export function drawHead(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 232);
  // Ear nubs behind the shell.
  for (const [x, lean] of [
    [78, -0.18],
    [178, 0.18],
  ] as const) {
    g.save();
    g.translate(x, 64);
    g.rotate(lean);
    roundedRectPath(g, -16, -34, 32, 44, 14);
    g.fillStyle = ROBOT.dark;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.stroke();
    g.restore();
  }
  // Shell.
  const pts = blobPoints(rng, 128, 130, 100, 88, 12, 0.03);
  paintBlob(g, pts, { fill: ROBOT.dark, outline: INK.line, lineWidth: 6 });
  // Cream faceplate.
  const face = blobPoints(rng, 128, 138, 80, 68, 12, 0.03);
  paintBlob(g, face, { fill: ROBOT.shell, outline: INK.soft, lineWidth: 3.5 });
  // Visor band — where the eyes plane sits.
  roundedRectPath(g, 56, 104, 144, 60, 28);
  g.fillStyle = ROBOT.visor;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.stroke();
  // Small chin marker.
  g.fillStyle = ROBOT.shellShade;
  g.beginPath();
  g.arc(128, 188, 6, 0, Math.PI * 2);
  g.fill();
  return { canvas: c, aspect: 256 / 232 };
}

export type EyeState = 'neutral' | 'happy' | 'curious' | 'sleepy' | 'blink';

/** Eye plate variants drawn for the visor (warm-white glow tone on dark). */
export function drawEyes(state: EyeState): PropSprite {
  const { c, g } = sprite(192, 80);
  const eyeY = 40;
  const lx = 58;
  const rx = 134;
  g.strokeStyle = '#f4efdf';
  g.fillStyle = '#f4efdf';
  g.lineCap = 'round';
  switch (state) {
    case 'neutral':
      for (const x of [lx, rx]) {
        g.beginPath();
        g.ellipse(x, eyeY, 13, 16, 0, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'happy':
      g.lineWidth = 9;
      for (const x of [lx, rx]) {
        g.beginPath();
        g.arc(x, eyeY + 6, 16, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
      }
      break;
    case 'curious':
      // One eye wider — a head-tilt look.
      g.beginPath();
      g.ellipse(lx, eyeY, 12, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(rx, eyeY - 2, 16, 19, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ROBOT.visor;
      g.beginPath();
      g.arc(rx + 5, eyeY - 8, 5, 0, Math.PI * 2);
      g.fill();
      break;
    case 'sleepy':
      g.lineWidth = 8;
      for (const x of [lx, rx]) {
        g.beginPath();
        g.moveTo(x - 14, eyeY + 2);
        g.quadraticCurveTo(x, eyeY + 10, x + 14, eyeY + 2);
        g.stroke();
      }
      break;
    case 'blink':
      g.lineWidth = 7;
      for (const x of [lx, rx]) {
        g.beginPath();
        g.moveTo(x - 13, eyeY);
        g.lineTo(x + 13, eyeY);
        g.stroke();
      }
      break;
  }
  return { canvas: c, aspect: 192 / 80 };
}

/** One leg — rounded limb, joint hint, dark foot pad. Pivot = top center. */
export function drawLeg(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 192);
  void rng.next();
  // Upper limb.
  roundedRectPath(g, 28, 8, 40, 100, 20);
  g.fillStyle = ROBOT.shell;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  // Joint dot.
  g.fillStyle = ROBOT.shellShade;
  g.beginPath();
  g.arc(48, 96, 7, 0, Math.PI * 2);
  g.fill();
  // Lower limb + foot.
  roundedRectPath(g, 32, 96, 32, 70, 14);
  g.fillStyle = ROBOT.shell;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  roundedRectPath(g, 24, 152, 48, 28, 12);
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  return { canvas: c, aspect: 0.5 };
}

/** Antenna tail — slim stalk with a small accent tip. Pivot = bottom center. */
export function drawTail(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 160);
  g.strokeStyle = ROBOT.dark;
  g.lineWidth = 8;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(48, 150);
  g.quadraticCurveTo(40 + rng.next() * 8, 90, 56, 36);
  g.stroke();
  blob(g, rng, 58, 28, 13, 13, { fill: ROBOT.accent, outline: INK.line, lineWidth: 4 }, 8, 0.05);
  return { canvas: c, aspect: 96 / 160 };
}
