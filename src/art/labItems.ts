/**
 * Field-lab item cutouts — BOBO's ten co-inventions, drawn as hand-cut plates
 * in the same paper-cutout language as the rest of the world (props.ts), NOT in
 * the flat catalogue-SVG style they were prototyped in. Every fill is a palette
 * token, every line is hand-wobbled, the one warm accent is the amber ear-light
 * family (ROBOT.accent) used sparingly — so a lab item sits in the park beside
 * the trees and the lantern without breaking the baseline's calm envelope.
 *
 * Each item draws in two reads: a calm RESTING plate, and a brief ACTIVE plate
 * the manipulation re-plates to (the spark catches, the dial wakes, the canopy
 * is up, the lantern breathes warm). The active read is a quiet warm shift, not
 * a glow or a bloom — it returns to rest a beat later.
 *
 * All randomness flows through the seeded Rng, so a placed instance always
 * redraws identically (deterministic plates, like the rest of the cutouts).
 */

import { Rng } from '../physics/mujoco/rng';
import { CLAY, INK, LAMP_WARM, ROBOT, SAGE } from './palette';
import { blob, wobblyLine } from './strokes';
import { createCanvas, ctx2d } from './textures';
import type { PropSprite } from './props';

function sprite(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = createCanvas(w, h);
  return { c, g: ctx2d(c) };
}

const OUT = { outline: INK.line, lineWidth: 5 };
const OUT_THIN = { outline: INK.line, lineWidth: 3.5 };

/** A soft baked halo (warm, subtle — never a real bloom), used by the lit reads. */
function halo(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const grad = g.createRadialGradient(cx, cy, 4, cx, cy, r);
  grad.addColorStop(0, LAMP_WARM);
  grad.addColorStop(1, 'rgba(233, 196, 124, 0)');
  g.fillStyle = grad;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/** Short hand-drawn ink rays around a point (the "idea catches" tick). */
function rays(g: CanvasRenderingContext2D, rng: Rng, cx: number, cy: number, r: number): void {
  g.strokeStyle = ROBOT.accent;
  g.lineWidth = 4;
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng.next() * 0.2;
    const r0 = r * (1.18 + rng.next() * 0.12);
    const r1 = r0 + 18 + rng.next() * 8;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.stroke();
  }
}

/* 01 ── Inspiration Bulb (灵感灯泡) ─────────────────────────────────────────── */
export function drawInspirationBulb(seed: number, lit = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 224);
  const cx = 80;
  const glassY = 96;
  if (lit) halo(g, cx, glassY, 96);
  // Wooden cap base on the ground.
  blob(g, rng, cx, 196, 26, 12, { fill: CLAY.light, ...OUT }, 8, 0.08);
  // Screw collar.
  g.fillStyle = CLAY.mid;
  g.beginPath();
  g.roundRect(cx - 18, 150, 36, 22, 4);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.stroke();
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(cx - 16, 156 + i * 6);
    g.lineTo(cx + 16, 156 + i * 6);
    g.stroke();
  }
  // Glass bulb.
  blob(g, rng, cx, glassY, 44, 50, { fill: lit ? '#f4dd9c' : CLAY.pale, ...OUT }, 11, 0.05);
  // Filament — a little wobble of inventor light.
  g.strokeStyle = lit ? ROBOT.accent : CLAY.deep;
  g.lineWidth = lit ? 4 : 3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 14, glassY + 14);
  g.quadraticCurveTo(cx - 6, glassY - 10, cx, glassY + 6);
  g.quadraticCurveTo(cx + 6, glassY + 20, cx + 14, glassY - 6);
  g.stroke();
  if (lit) rays(g, rng, cx, glassY, 44);
  return { canvas: c, aspect: 160 / 224 };
}

/* 02 ── Time-Machine Fragment (时光机残片) ──────────────────────────────────── */
export function drawTimeMachine(seed: number, lit = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(224, 200);
  // A half-overgrown panel, tilted, with a readout window.
  g.save();
  g.translate(112, 110);
  g.rotate(-0.06);
  g.beginPath();
  g.roundRect(-78, -64, 156, 128, 12);
  g.fillStyle = ROBOT.shell;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Dark readout window.
  g.beginPath();
  g.roundRect(-56, -40, 112, 44, 6);
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.stroke();
  // The "2049" readout — amber when the dial wakes, faint clay when dead.
  g.fillStyle = lit ? ROBOT.accent : CLAY.deep;
  g.globalAlpha = lit ? 1 : 0.5;
  g.font = '700 26px Nunito, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('2049', 0, -17);
  g.globalAlpha = 1;
  // The dial.
  blob(g, rng, -40, 40, 18, 18, { fill: ROBOT.shellShade, ...OUT_THIN }, 9, 0.06);
  g.strokeStyle = INK.line;
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-40, 40);
  const da = lit ? 1.9 : 0.6;
  g.lineTo(-40 + Math.cos(da) * 12, 40 + Math.sin(da) * 12);
  g.stroke();
  // A small clay knob.
  blob(g, rng, 36, 40, 12, 12, { fill: CLAY.mid, ...OUT_THIN }, 8, 0.08);
  g.restore();
  // Overgrowth — a sage frond reclaiming the corner.
  for (const [x, y, lean] of [
    [40, 168, -22],
    [186, 158, 24],
  ] as const) {
    g.strokeStyle = SAGE.deep;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, y + 18);
    g.quadraticCurveTo(x + lean * 0.4, y - 6, x + lean, y - 26);
    g.stroke();
    blob(g, rng, x + lean, y - 30, 12, 8, { fill: SAGE.light, outline: INK.soft, lineWidth: 2.5 }, 7, 0.16);
  }
  return { canvas: c, aspect: 224 / 200 };
}

/* 03 ── Rain Shelter (避雨棚) ──────────────────────────────────────────────── */
export function drawRainShelter(seed: number, up = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(224, 256);
  const cx = 112;
  // Pole.
  wobblyLine(g, rng, cx, 240, cx - 2, up ? 70 : 150, 7, CLAY.deep, 1.2, 5);
  // Foot.
  blob(g, rng, cx, 240, 22, 9, { fill: CLAY.mid, ...OUT_THIN }, 8, 0.08);
  if (up) {
    // Canopy popped — a sage leaf-umbrella with scalloped edge.
    g.beginPath();
    g.moveTo(cx - 86, 84);
    g.quadraticCurveTo(cx, 6, cx + 86, 84);
    g.quadraticCurveTo(cx + 64, 74, cx + 44, 82);
    g.quadraticCurveTo(cx + 22, 72, cx, 82);
    g.quadraticCurveTo(cx - 22, 72, cx - 44, 82);
    g.quadraticCurveTo(cx - 64, 74, cx - 86, 84);
    g.closePath();
    g.fillStyle = SAGE.mid;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.stroke();
    // Ribs.
    g.strokeStyle = SAGE.shade;
    g.lineWidth = 2.5;
    for (const dx of [-44, 0, 44]) {
      g.beginPath();
      g.moveTo(cx, 18);
      g.quadraticCurveTo(cx + dx * 0.6, 56, cx + dx, 80);
      g.stroke();
    }
    // The amber finial (the ear-light accent).
    g.fillStyle = ROBOT.accent;
    g.beginPath();
    g.arc(cx, 16, 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 2.5;
    g.stroke();
  } else {
    // Folded — a furled bundle at the top of the pole.
    g.save();
    g.translate(cx, 120);
    g.rotate(0.08);
    blob(g, rng, 0, 0, 13, 52, { fill: SAGE.deep, ...OUT_THIN }, 9, 0.06);
    g.restore();
    g.fillStyle = ROBOT.accent;
    g.beginPath();
    g.arc(cx, 70, 4.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 2.5;
    g.stroke();
  }
  return { canvas: c, aspect: 224 / 256 };
}

/* 04 ── Whisper Lantern (耳语灯) ──────────────────────────────────────────── */
export function drawWhisperLantern(seed: number, lit = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 240);
  const cx = 80;
  const globeY = 124;
  if (lit) halo(g, cx, globeY, 92);
  // Hanging hook + cap.
  wobblyLine(g, rng, cx, 18, cx, 44, 4, CLAY.deep, 1, 3);
  g.fillStyle = CLAY.mid;
  g.beginPath();
  g.roundRect(cx - 16, 40, 32, 12, 3);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.stroke();
  // Paper globe.
  blob(g, rng, cx, globeY, 42, 50, { fill: lit ? '#f6e3a8' : CLAY.pale, ...OUT }, 12, 0.05);
  // Ribs.
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 2;
  g.globalAlpha = 0.6;
  g.beginPath();
  g.moveTo(cx, globeY - 46);
  g.lineTo(cx, globeY + 46);
  g.moveTo(cx - 38, globeY);
  g.lineTo(cx + 38, globeY);
  g.stroke();
  g.globalAlpha = 1;
  // Base.
  g.fillStyle = CLAY.mid;
  g.beginPath();
  g.roundRect(cx - 16, globeY + 48, 32, 12, 3);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.stroke();
  // The breathing ember (amber, the ear-light channel) — present always, warm when lit.
  g.fillStyle = ROBOT.accent;
  g.globalAlpha = lit ? 1 : 0.5;
  g.beginPath();
  g.arc(cx, globeY, lit ? 11 : 7, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  return { canvas: c, aspect: 160 / 240 };
}

/* 05 ── Tool-Roll Workstation (专属工位) ──────────────────────────────────── */
export function drawToolRoll(seed: number, open = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 176);
  const baseY = 150;
  // Canvas roll body.
  g.beginPath();
  g.roundRect(40, baseY - 56, open ? 176 : 96, 56, 8);
  g.fillStyle = CLAY.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // A worn top fold.
  g.fillStyle = CLAY.mid;
  g.beginPath();
  g.moveTo(40, baseY - 56);
  g.lineTo(40 + (open ? 176 : 96), baseY - 56);
  g.lineTo(40 + (open ? 176 : 96) + 8, baseY - 50);
  g.lineTo(48, baseY - 50);
  g.closePath();
  g.fill();
  if (open) {
    // Instruments fanned out, ready.
    const tools: Array<[number, string]> = [
      [70, ROBOT.shell],
      [96, ROBOT.shell],
      [122, ROBOT.shell],
      [148, CLAY.pale],
    ];
    for (const [x, fill] of tools) {
      g.fillStyle = fill;
      g.beginPath();
      g.roundRect(x - 4, baseY - 48, 8, 38, 4);
      g.fill();
      g.strokeStyle = INK.line;
      g.lineWidth = 3;
      g.stroke();
    }
    // A round gauge tool.
    blob(g, rng, 186, baseY - 26, 12, 12, { fill: ROBOT.shell, ...OUT_THIN }, 9, 0.06);
    g.fillStyle = ROBOT.accent;
    g.beginPath();
    g.arc(186, baseY - 26, 3.5, 0, Math.PI * 2);
    g.fill();
  } else {
    // Tie-strap on the rolled bundle.
    g.strokeStyle = SAGE.shade;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(88, baseY - 58);
    g.lineTo(88, baseY + 2);
    g.stroke();
    g.fillStyle = ROBOT.accent;
    g.beginPath();
    g.arc(88, baseY - 28, 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 2.5;
    g.stroke();
  }
  return { canvas: c, aspect: 256 / 176 };
}

/* 06 ── Wobble Plaything (不倒摆件) ───────────────────────────────────────── */
export function drawWobbleToy(seed: number, tipped = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 192);
  const cx = tipped ? 92 : 80;
  const baseY = 176;
  g.save();
  if (tipped) {
    g.translate(80, baseY);
    g.rotate(0.22);
    g.translate(-80, -baseY);
  }
  // Weighted clay acorn body.
  g.beginPath();
  g.moveTo(cx - 34, baseY - 40);
  g.quadraticCurveTo(cx - 36, baseY, cx, baseY);
  g.quadraticCurveTo(cx + 36, baseY, cx + 34, baseY - 40);
  g.quadraticCurveTo(cx + 30, baseY - 78, cx, baseY - 78);
  g.quadraticCurveTo(cx - 30, baseY - 78, cx - 34, baseY - 40);
  g.closePath();
  g.fillStyle = CLAY.blossom;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // The cap.
  blob(g, rng, cx, baseY - 76, 34, 16, { fill: CLAY.deep, ...OUT }, 9, 0.08);
  // A little face.
  g.fillStyle = INK.line;
  g.beginPath();
  g.arc(cx - 11, baseY - 44, 3, 0, Math.PI * 2);
  g.arc(cx + 11, baseY - 44, 3, 0, Math.PI * 2);
  g.fill();
  // Amber nub on top.
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.arc(cx, baseY - 90, 4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 2.5;
  g.stroke();
  g.restore();
  return { canvas: c, aspect: 160 / 192 };
}

/* 07 ── Thought-Bolt Antenna (思维闪电) ───────────────────────────────────── */
export function drawThoughtAntenna(seed: number, crackle = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 256);
  const cx = 76;
  const baseY = 240;
  // Base.
  g.fillStyle = CLAY.mid;
  g.beginPath();
  g.roundRect(cx - 22, baseY - 22, 44, 22, 6);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  // Whisker antenna curving up.
  g.strokeStyle = ROBOT.dark;
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx, baseY - 22);
  g.quadraticCurveTo(cx - 20, baseY - 110, cx + 18, baseY - 168);
  g.stroke();
  // Tip knob.
  blob(g, rng, cx + 22, baseY - 176, 8, 8, { fill: ROBOT.shell, ...OUT_THIN }, 8, 0.08);
  if (crackle) {
    halo(g, cx + 22, baseY - 176, 56);
    // A hand-drawn ink bolt zigzagging off the tip.
    g.beginPath();
    g.moveTo(cx + 28, baseY - 182);
    g.lineTo(cx + 52, baseY - 200);
    g.lineTo(cx + 40, baseY - 198);
    g.lineTo(cx + 60, baseY - 214);
    g.lineTo(cx + 44, baseY - 210);
    g.lineTo(cx + 58, baseY - 226);
    g.closePath();
    g.fillStyle = ROBOT.accent;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 2.5;
    g.lineJoin = 'round';
    g.stroke();
  }
  return { canvas: c, aspect: 160 / 256 };
}

/* 08 ── Field-Note Specimen (考察标本) ────────────────────────────────────── */
export function drawFieldNote(seed: number, flipped = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(176, 208);
  const cx = 88;
  const cy = 104;
  // A little easel stand behind the card.
  wobblyLine(g, rng, cx - 30, 196, cx - 18, cy, 5, CLAY.deep, 1, 3);
  wobblyLine(g, rng, cx + 30, 196, cx + 18, cy, 5, CLAY.deep, 1, 3);
  // The pressed-specimen card.
  g.save();
  g.translate(cx, cy);
  g.rotate(-0.04);
  g.beginPath();
  g.roundRect(-52, -64, 104, 120, 6);
  g.fillStyle = '#f3e8cf';
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  if (!flipped) {
    // Front: a pressed leaf under glass.
    g.beginPath();
    g.roundRect(-40, -52, 80, 76, 4);
    g.fillStyle = ROBOT.shell;
    g.fill();
    g.strokeStyle = INK.soft;
    g.lineWidth = 3;
    g.stroke();
    blob(g, rng, 0, -14, 16, 30, { fill: SAGE.mid, outline: INK.soft, lineWidth: 2.5 }, 9, 0.1);
    wobblyLine(g, rng, 0, -42, 0, 14, 2, SAGE.shade, 1, 4);
    g.fillStyle = INK.soft;
    g.font = '700 16px Nunito, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('No.214', 0, 42);
  } else {
    // Back: his (slightly wrong) field note, ruled lines + a scribble.
    g.strokeStyle = INK.soft;
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(-40, -44 + i * 18);
      g.lineTo(40, -44 + i * 18);
      g.stroke();
    }
    g.strokeStyle = CLAY.deep;
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-34, -40);
    g.quadraticCurveTo(-10, -48, 20, -38);
    g.moveTo(-34, -22);
    g.quadraticCurveTo(0, -30, 30, -20);
    g.moveTo(-34, -4);
    g.quadraticCurveTo(-12, -12, 14, -2);
    g.stroke();
    // The amber field-stamp.
    g.fillStyle = ROBOT.accent;
    g.beginPath();
    g.arc(26, 40, 7, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 2.5;
    g.stroke();
  }
  g.restore();
  return { canvas: c, aspect: 176 / 208 };
}

/* 09 ── Babo Chime (Babo 铃) ──────────────────────────────────────────────── */
export function drawBaboBell(seed: number, ringing = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 256);
  // A small hook post.
  wobblyLine(g, rng, 58, 240, 58, 64, 9, CLAY.deep, 1.2, 5);
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 8;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(58, 66);
  g.quadraticCurveTo(104, 44, 132, 70);
  g.stroke();
  // Hanging string.
  wobblyLine(g, rng, 132, 70, 132, 100, 2, INK.soft, 0.8, 3);
  // The bell — amber body, clay rim (swung when ringing).
  g.save();
  g.translate(132, 100);
  g.rotate(ringing ? 0.2 : 0.02);
  g.beginPath();
  g.moveTo(-28, 60);
  g.quadraticCurveTo(-30, -2, 0, -2);
  g.quadraticCurveTo(30, -2, 28, 60);
  g.closePath();
  g.fillStyle = ROBOT.accent;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Rim band.
  g.beginPath();
  g.roundRect(-32, 56, 64, 12, 5);
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.stroke();
  // Clapper.
  g.fillStyle = INK.line;
  g.beginPath();
  g.arc(0, 70, 4, 0, Math.PI * 2);
  g.fill();
  g.restore();
  if (ringing) {
    // Two sage sound-waves (his "Babo~" shape), kept inside the plate.
    g.strokeStyle = SAGE.deep;
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (const r of [18, 28]) {
      g.beginPath();
      g.arc(160, 96, r, -0.7, 0.7);
      g.stroke();
    }
  }
  return { canvas: c, aspect: 192 / 256 };
}

/* 10 ── The Poof (抬腿放屁, max-bond easter egg) ───────────────────────────── */
export function drawPoofCard(seed: number, opened = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 200);
  const cx = 96;
  const cy = 100;
  // A sealed "MAX" card — kept charming and quiet, never 4399 noise.
  g.save();
  g.translate(cx, cy);
  g.rotate(-0.03);
  g.beginPath();
  g.roundRect(-62, -58, 124, 116, 8);
  g.fillStyle = '#f3e8cf';
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Envelope fold lines.
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(-62, -54);
  g.lineTo(0, -6);
  g.lineTo(62, -54);
  g.stroke();
  // The amber wax seal stamped "MAX".
  blob(g, rng, 0, 18, 18, 18, { fill: ROBOT.accent, ...OUT_THIN }, 9, 0.08);
  g.fillStyle = '#f3e8cf';
  g.font = '700 13px Nunito, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('MAX', 0, 19);
  g.restore();
  if (opened) {
    // One soft ink-poof puff, off to the side — a single Calvin-&-Hobbes beat.
    // A soft sage-mist tone for the puff (the prototype's --sage-mist).
    const mist = '#c4cbae';
    g.save();
    g.globalAlpha = 0.85;
    blob(g, rng, 156, 86, 16, 13, { fill: mist, outline: INK.soft, lineWidth: 2.5 }, 11, 0.22);
    blob(g, rng, 168, 70, 9, 8, { fill: mist, outline: INK.soft, lineWidth: 2 }, 9, 0.24);
    g.restore();
  }
  return { canvas: c, aspect: 192 / 200 };
}
