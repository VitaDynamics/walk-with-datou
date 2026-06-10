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
  // Shell — charcoal-dominant (a robot, not an animal hide).
  const pts = blobPoints(rng, 180, 110, 150, 78, 12, 0.035);
  paintBlob(g, pts, { fill: ROBOT.dark, outline: INK.line, lineWidth: 6 });
  // Soft top highlight so the shell reads rounded.
  g.save();
  g.globalAlpha = 0.18;
  blob(g, rng, 168, 72, 100, 26, { fill: ROBOT.shell }, 10, 0.1);
  g.restore();
  // Small cream access panel low on the flank — quiet product detailing.
  roundedRectPath(g, 128, 116, 104, 50, 18);
  g.fillStyle = ROBOT.shell;
  g.fill();
  g.strokeStyle = ROBOT.darkShade;
  g.lineWidth = 3;
  g.stroke();
  // Panel seam + fastener dots.
  g.strokeStyle = ROBOT.shellShade;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(140, 141);
  g.lineTo(220, 141);
  g.stroke();
  g.fillStyle = ROBOT.shellShade;
  for (const x of [144, 216]) {
    g.beginPath();
    g.arc(x, 128, 4, 0, Math.PI * 2);
    g.fill();
  }
  // Shoulder seam line.
  g.strokeStyle = ROBOT.darkShade;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(252, 70);
  g.quadraticCurveTo(262, 110, 252, 150);
  g.stroke();
  // One small warm accent: a tiny status dot near the shoulder.
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.arc(276, 92, 7, 0, Math.PI * 2);
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
  // Antenna ears — slim, slightly leaned (sensors, not animal ears).
  for (const [x, lean] of [
    [86, -0.22],
    [170, 0.22],
  ] as const) {
    g.save();
    g.translate(x, 62);
    g.rotate(lean);
    roundedRectPath(g, -9, -30, 18, 40, 9);
    g.fillStyle = ROBOT.dark;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4.5;
    g.stroke();
    g.fillStyle = ROBOT.shellShade;
    g.beginPath();
    g.arc(0, -22, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // Shell — charcoal, rounded.
  const pts = blobPoints(rng, 128, 130, 100, 88, 12, 0.03);
  paintBlob(g, pts, { fill: ROBOT.dark, outline: INK.line, lineWidth: 6 });
  // Soft crown highlight.
  g.save();
  g.globalAlpha = 0.16;
  blob(g, rng, 122, 78, 64, 22, { fill: ROBOT.shell }, 10, 0.1);
  g.restore();
  // Visor — a generous near-black screen across the face (eyes live here).
  roundedRectPath(g, 46, 94, 164, 78, 34);
  g.fillStyle = ROBOT.visor;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  // Faint screen sheen.
  g.save();
  g.globalAlpha = 0.1;
  roundedRectPath(g, 58, 102, 84, 22, 11);
  g.fillStyle = ROBOT.shell;
  g.fill();
  g.restore();
  // Small cream chin plate.
  roundedRectPath(g, 108, 184, 40, 14, 7);
  g.fillStyle = ROBOT.shell;
  g.fill();
  g.strokeStyle = ROBOT.darkShade;
  g.lineWidth = 2.5;
  g.stroke();
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
  // Upper limb — charcoal like the shell, slimmer than before.
  roundedRectPath(g, 32, 8, 32, 96, 16);
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  // Cream knee-joint cap.
  g.fillStyle = ROBOT.shell;
  g.beginPath();
  g.arc(48, 98, 9, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = ROBOT.darkShade;
  g.lineWidth = 2.5;
  g.stroke();
  // Lower limb, slightly narrower + dark foot pad.
  roundedRectPath(g, 36, 102, 24, 62, 11);
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  roundedRectPath(g, 28, 152, 40, 26, 12);
  g.fillStyle = ROBOT.darkShade;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
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
