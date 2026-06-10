/**
 * Datou's body plates — assembled like the real VITA quadruped
 * (sim_tools/.../robots/vita01evt): a long light-shell torso standing on four
 * TWO-segment legs (thigh + calf, Z-folded), with a sensor-head module on a
 * short neck at the TOP-FRONT of the body (the real robot's head_yaw /
 * head_pitch joints become the rig's emotion channel). Mostly cream/white like
 * the real machine, charcoal visor + calves, one amber logo accent. No tail —
 * the VITA has none; feeling lives in the head, eyes, and leg posture.
 *
 * Hand-drawn cutout style throughout: ink outlines, wobbly blobs, flat fills.
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
 * Torso — the VITA base_link silhouette: long (≈2.6:1) rounded shell, cream
 * like the real robot, with a darker belly tray, hip modules at both ends,
 * panel seams, and the amber logo dot. Facing right.
 */
export function drawTorso(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(480, 200);
  // Hip modules peeking from behind the shell at both ends (dark, like the
  // real hip actuators at x ±0.18).
  for (const x of [86, 394]) {
    roundedRectPath(g, x - 30, 96, 60, 64, 22);
    g.fillStyle = ROBOT.dark;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.stroke();
  }
  // Shell — long rounded body.
  const pts = blobPoints(rng, 240, 96, 210, 62, 14, 0.025);
  paintBlob(g, pts, { fill: ROBOT.shell, outline: INK.line, lineWidth: 6 });
  // Charcoal belly tray (the sensor/battery underside of the real base).
  g.save();
  g.beginPath();
  g.rect(60, 112, 360, 60);
  g.clip();
  const belly = blobPoints(rng, 240, 108, 196, 50, 14, 0.03);
  paintBlob(g, belly, { fill: ROBOT.dark });
  g.restore();
  g.strokeStyle = ROBOT.darkShade;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(70, 116);
  g.quadraticCurveTo(240, 132, 410, 116);
  g.stroke();
  // Panel seams on the shell top.
  g.strokeStyle = ROBOT.shellShade;
  g.lineWidth = 3;
  for (const x of [150, 330]) {
    g.beginPath();
    g.moveTo(x, 48);
    g.quadraticCurveTo(x + 6, 78, x, 108);
    g.stroke();
  }
  // Quiet vent ticks near the rear.
  g.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) {
    const x = 116 + i * 12;
    g.beginPath();
    g.moveTo(x, 66);
    g.lineTo(x - 4, 88);
    g.stroke();
  }
  // The amber logo dot + small wordmark tick (VITA plate on the flank).
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.arc(316, 84, 9, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 2.5;
  g.stroke();
  g.strokeStyle = ROBOT.shellShade;
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(334, 84);
  g.lineTo(366, 84);
  g.stroke();
  return { canvas: c, aspect: 480 / 200 };
}

/**
 * Head module on its neck — pivot is the BOTTOM CENTER (the head_pitch joint).
 * A short dark neck stem, then the cream sensor head with a charcoal visor on
 * the front face (eyes plate mounts there) and a small lidar bump on top.
 */
export function drawHead(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 240);
  // Neck stem (head_yaw column).
  roundedRectPath(g, 112, 168, 32, 64, 12);
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  // Head shell — rounded module, slightly longer than tall, nose to the right.
  const pts = blobPoints(rng, 128, 102, 96, 68, 12, 0.025);
  paintBlob(g, pts, { fill: ROBOT.shell, outline: INK.line, lineWidth: 6 });
  // Crown highlight.
  g.save();
  g.globalAlpha = 0.4;
  blob(g, rng, 116, 58, 60, 16, { fill: '#ffffff' }, 10, 0.12);
  g.restore();
  // Lidar bump on top.
  roundedRectPath(g, 96, 22, 48, 22, 10);
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.stroke();
  // Charcoal visor — front (right) face of the module; eyes plate sits here.
  roundedRectPath(g, 92, 70, 122, 70, 30);
  g.fillStyle = ROBOT.visor;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  // Visor sheen.
  g.save();
  g.globalAlpha = 0.1;
  roundedRectPath(g, 102, 78, 64, 16, 8);
  g.fillStyle = ROBOT.shell;
  g.fill();
  g.restore();
  // Side sensor dot (rear of head).
  g.fillStyle = ROBOT.shellShade;
  g.beginPath();
  g.arc(52, 104, 7, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = ROBOT.darkShade;
  g.lineWidth = 2.5;
  g.stroke();
  return { canvas: c, aspect: 256 / 240 };
}

export type EyeState = 'neutral' | 'happy' | 'curious' | 'sleepy' | 'blink';

/** Eye plate variants for the visor (warm-white on near-black). */
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
      // Both eyes rounder and a touch wider — alert, not googly.
      for (const x of [lx, rx]) {
        g.beginPath();
        g.ellipse(x, eyeY - 2, 15, 18, 0, 0, Math.PI * 2);
        g.fill();
      }
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

/** Thigh — cream upper segment (like the white FL_thigh). Pivot = top center. */
export function drawThigh(seed: number): PropSprite {
  const rng = new Rng(seed);
  void rng.next();
  const { c, g } = sprite(96, 176);
  // Hip joint cap behind.
  g.fillStyle = ROBOT.dark;
  g.beginPath();
  g.arc(48, 26, 22, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  // Thigh body, tapering toward the knee.
  g.beginPath();
  g.moveTo(26, 22);
  g.quadraticCurveTo(20, 90, 36, 152);
  g.lineTo(62, 152);
  g.quadraticCurveTo(76, 90, 70, 22);
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
  g.moveTo(36, 58);
  g.lineTo(60, 58);
  g.stroke();
  return { canvas: c, aspect: 96 / 176 };
}

/** Calf — charcoal lower segment with the ball foot. Pivot = top center. */
export function drawCalf(seed: number): PropSprite {
  const rng = new Rng(seed);
  void rng.next();
  const { c, g } = sprite(96, 192);
  // Knee joint cap.
  g.fillStyle = ROBOT.shell;
  g.beginPath();
  g.arc(48, 22, 16, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  // Calf — slim, slightly curved like the real part.
  g.beginPath();
  g.moveTo(36, 18);
  g.quadraticCurveTo(28, 90, 40, 156);
  g.lineTo(58, 156);
  g.quadraticCurveTo(60, 90, 60, 18);
  g.closePath();
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.lineJoin = 'round';
  g.stroke();
  // Ball foot (gray in the real model).
  g.fillStyle = ROBOT.darkShade;
  g.beginPath();
  g.arc(48, 166, 17, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  g.save();
  g.globalAlpha = 0.35;
  g.fillStyle = ROBOT.shell;
  g.beginPath();
  g.arc(43, 160, 5, 0, Math.PI * 2);
  g.fill();
  g.restore();
  return { canvas: c, aspect: 0.5 };
}
