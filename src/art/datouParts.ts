/**
 * Datou's body plates — the official Vbot character (the VITA sticker sheet)
 * rendered in the diorama's cutout style: chibi proportions with an oversized
 * round dome head (大头!), a big soft charcoal face plate carrying large
 * expressive eyes, a compact rounded shell body, chubby two-segment legs and
 * ball feet. Same skeleton as the real robot (thigh + calf Z-fold, head on a
 * short neck, no tail) so the rig's joints still match the MJCF, but the
 * silhouette is the cute mascot, not the engineering sample.
 *
 * Palette stays the baseline ROBOT tokens — cream shell, warm charcoal face,
 * one amber accent (flank logo + antenna tip). Ink outlines, wobbly blobs,
 * flat fills throughout.
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

/**
 * Torso — the chibi Vbot shell: a compact (≈2:1) chubby rounded body, cream
 * like the stickers, with a darker belly tray, hip modules at both ends,
 * a soft panel seam, and the amber logo dot. Facing right.
 */
export function drawTorso(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(440, 220);
  // Hip modules peeking from behind the shell at both ends (dark, like the
  // real hip actuators at x ±0.18).
  for (const x of [87, 353]) {
    roundedRectPath(g, x - 32, 120, 64, 68, 26);
    g.fillStyle = ROBOT.dark;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.stroke();
  }
  // Shell — short, plump rounded body.
  const pts = blobPoints(rng, 220, 102, 188, 76, 14, 0.02);
  paintBlob(g, pts, { fill: ROBOT.shell, outline: INK.line, lineWidth: 6 });
  // Soft crown highlight along the back.
  g.save();
  g.globalAlpha = 0.35;
  blob(g, rng, 200, 52, 110, 18, { fill: '#ffffff' }, 10, 0.1);
  g.restore();
  // Charcoal belly tray (the sensor/battery underside of the real base).
  g.save();
  g.beginPath();
  g.rect(48, 126, 344, 64);
  g.clip();
  const belly = blobPoints(rng, 220, 122, 176, 56, 14, 0.03);
  paintBlob(g, belly, { fill: ROBOT.dark });
  g.restore();
  g.strokeStyle = ROBOT.darkShade;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(58, 130);
  g.quadraticCurveTo(220, 148, 382, 130);
  g.stroke();
  // One quiet panel seam on the shell top.
  g.strokeStyle = ROBOT.shellShade;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(150, 50);
  g.quadraticCurveTo(157, 86, 150, 122);
  g.stroke();
  // Quiet vent ticks near the rear.
  g.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const x = 104 + i * 13;
    g.beginPath();
    g.moveTo(x, 74);
    g.lineTo(x - 4, 96);
    g.stroke();
  }
  // The amber logo dot + small wordmark tick (Vbot plate on the flank).
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.arc(294, 90, 10, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 2.5;
  g.stroke();
  g.strokeStyle = ROBOT.shellShade;
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(314, 90);
  g.lineTo(346, 90);
  g.stroke();
  return { canvas: c, aspect: 440 / 220 };
}

/**
 * Head — the oversized Vbot dome, pivot at BOTTOM CENTER (the head_pitch
 * joint). A short dark neck stem, then a big near-round cream dome with a
 * large soft charcoal face plate wrapping the front (eyes plate mounts there)
 * and a little antenna with an amber tip on top.
 */
export function drawHead(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(260, 260);
  // Neck stem (head_yaw column) — mostly tucked under the dome.
  roundedRectPath(g, 114, 192, 32, 60, 12);
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  // Antenna stem first so the dome outline covers its base.
  roundedRectPath(g, 125, 16, 10, 28, 5);
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.stroke();
  // Dome — big, nearly round, barely wobbled so it stays plump and clean.
  const pts = blobPoints(rng, 130, 126, 102, 96, 14, 0.018);
  paintBlob(g, pts, { fill: ROBOT.shell, outline: INK.line, lineWidth: 6 });
  // Crown highlight.
  g.save();
  g.globalAlpha = 0.4;
  blob(g, rng, 108, 62, 58, 18, { fill: '#ffffff' }, 10, 0.12);
  g.restore();
  // Amber antenna tip — the one warm accent up top.
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.arc(130, 14, 8, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3;
  g.stroke();
  // Charcoal face plate — a big soft squircle hugging the front (right) of
  // the dome; the eyes plate sits centered on it.
  roundedRectPath(g, 88, 50, 140, 138, 58);
  g.fillStyle = ROBOT.visor;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  // Face-plate sheen.
  g.save();
  g.globalAlpha = 0.08;
  roundedRectPath(g, 102, 62, 72, 22, 11);
  g.fillStyle = ROBOT.shell;
  g.fill();
  g.restore();
  // Side sensor dot (rear of head).
  g.fillStyle = ROBOT.shellShade;
  g.beginPath();
  g.arc(46, 128, 7, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = ROBOT.darkShade;
  g.lineWidth = 2.5;
  g.stroke();
  return { canvas: c, aspect: 260 / 260 };
}

export type EyeState = 'neutral' | 'happy' | 'curious' | 'sleepy' | 'blink';

/**
 * Eye plate variants for the face plate (warm-white on near-black) — the
 * sticker-sheet eye language: big rounded shapes, thick happy arcs, all the
 * feeling carried by shape alone.
 */
export function drawEyes(state: EyeState): PropSprite {
  const { c, g } = sprite(200, 100);
  const eyeY = 50;
  const lx = 62;
  const rx = 138;
  g.strokeStyle = '#f4efdf';
  g.fillStyle = '#f4efdf';
  g.lineCap = 'round';
  switch (state) {
    case 'neutral':
      // Big soft capsules — calm and present.
      for (const x of [lx, rx]) {
        g.beginPath();
        g.ellipse(x, eyeY, 15, 21, 0, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'happy':
      // Thick upturned arcs, the sticker smile-eyes.
      g.lineWidth = 12;
      for (const x of [lx, rx]) {
        g.beginPath();
        g.arc(x, eyeY + 7, 19, Math.PI * 1.12, Math.PI * 1.88);
        g.stroke();
      }
      break;
    case 'curious':
      // Wide round eyes, the front one a touch bigger — a head-tilt read.
      g.beginPath();
      g.ellipse(lx, eyeY - 1, 15, 19, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(rx, eyeY - 4, 18, 23, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case 'sleepy':
      // Heavy drooping lids.
      g.lineWidth = 10;
      for (const x of [lx, rx]) {
        g.beginPath();
        g.moveTo(x - 16, eyeY);
        g.quadraticCurveTo(x, eyeY + 12, x + 16, eyeY);
        g.stroke();
      }
      break;
    case 'blink':
      // A gentle contented bow, not a flat shutter line.
      g.lineWidth = 8;
      for (const x of [lx, rx]) {
        g.beginPath();
        g.moveTo(x - 15, eyeY + 3);
        g.quadraticCurveTo(x, eyeY - 4, x + 15, eyeY + 3);
        g.stroke();
      }
      break;
  }
  return { canvas: c, aspect: 200 / 100 };
}

/** Thigh — chubby cream upper segment (sticker-plump). Pivot = top center. */
export function drawThigh(seed: number): PropSprite {
  const rng = new Rng(seed);
  void rng.next();
  const { c, g } = sprite(104, 176);
  // Hip joint cap behind.
  g.fillStyle = ROBOT.dark;
  g.beginPath();
  g.arc(52, 26, 24, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  // Thigh body — plump, rounding gently toward the knee.
  g.beginPath();
  g.moveTo(24, 22);
  g.quadraticCurveTo(16, 92, 36, 154);
  g.lineTo(68, 154);
  g.quadraticCurveTo(88, 92, 80, 22);
  g.closePath();
  g.fillStyle = ROBOT.shell;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Seam.
  g.strokeStyle = ROBOT.shellShade;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(36, 60);
  g.lineTo(68, 60);
  g.stroke();
  return { canvas: c, aspect: 104 / 176 };
}

/** Calf — charcoal lower segment with the ball foot. Pivot = top center. */
export function drawCalf(seed: number): PropSprite {
  const rng = new Rng(seed);
  void rng.next();
  const { c, g } = sprite(96, 192);
  // Knee joint cap.
  g.fillStyle = ROBOT.shell;
  g.beginPath();
  g.arc(48, 22, 17, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  // Calf — slim, slightly curved like the real part.
  g.beginPath();
  g.moveTo(36, 18);
  g.quadraticCurveTo(28, 90, 40, 152);
  g.lineTo(58, 152);
  g.quadraticCurveTo(60, 90, 60, 18);
  g.closePath();
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.lineJoin = 'round';
  g.stroke();
  // Big round ball foot — the sticker bounce.
  g.fillStyle = ROBOT.darkShade;
  g.beginPath();
  g.arc(48, 164, 19, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  g.save();
  g.globalAlpha = 0.35;
  g.fillStyle = ROBOT.shell;
  g.beginPath();
  g.arc(42, 157, 5.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
  return { canvas: c, aspect: 0.5 };
}
