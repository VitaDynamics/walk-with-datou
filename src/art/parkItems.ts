/**
 * Park keepsake cutouts — eight new interactive items, drawn as hand-cut plates
 * in the same paper-cutout language as props.ts / labItems.ts (NOT the authored
 * watercolor PNGs). Every fill is a palette token, every contour is hand-wobbled
 * ink, and the warm focal is ACCENT_WARM (#d6bfa7) — never ROBOT.accent
 * (#d9a441), which stays Datou's own signal color. The single exception is the
 * moonwater-lamp, a real light source that may carry a small warm candle-amber
 * cast confined to its water aperture (a believable lamp, never a bloom).
 *
 * Each item draws in two reads: a calm RESTING plate, and a brief ACTIVE plate
 * the interaction re-plates to (the cup steams, a drawer is open, the wells
 * brim, the lamp holds light, the wheel has turned, the tin is ajar). The active
 * read is a still, warm SHIFT — no glow, bloom, halo, rays, particles, sparkle,
 * or motion trails (DESIGN_BASELINE, binding). Steam/ripples are frozen
 * hand-drawn ink curves, not floating dots.
 *
 * All randomness flows through the seeded Rng so a placed instance always
 * redraws identically (deterministic plates, like the rest of the cutouts).
 */

import { Rng } from '../physics/mujoco/rng';
import { ACCENT_WARM, CLAY, INK, ROBOT, SAGE, WATER } from './palette';
import { blob, wobblyLine } from './strokes';
import { createCanvas, ctx2d } from './textures';
import type { PropSprite } from './props';

function sprite(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = createCanvas(w, h);
  return { c, g: ctx2d(c) };
}

const OUT = { outline: INK.line, lineWidth: 5 };
const OUT_THIN = { outline: INK.line, lineWidth: 3.5 };

/** A soft, baked contact shade on the ground (warm, low — never a real shadow). */
function contact(g: CanvasRenderingContext2D, rng: Rng, cx: number, cy: number, rx: number): void {
  blob(g, rng, cx, cy, rx, rx * 0.28, { fill: CLAY.light, outline: INK.soft, lineWidth: 2.5 }, 10, 0.1);
}

/* 01 ── steam-rest (Hearth/Tea) ────────────────────────────────────────────── */
// A low, wide ceramic cradle holding a small cup; warmed, one still steam curl.
export function drawSteamRest(seed: number, warm = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 176);
  const cx = 96;
  contact(g, rng, cx, 162, 56);
  // Three stubby feet.
  for (const x of [54, 96, 138]) {
    g.fillStyle = CLAY.deep;
    g.beginPath();
    g.roundRect(x - 9, 150, 18, 14, 4);
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 3.5;
    g.stroke();
  }
  // Cradle block body (wide, low).
  g.beginPath();
  g.moveTo(40, 150);
  g.quadraticCurveTo(34, 110, 48, 100);
  g.lineTo(144, 100);
  g.quadraticCurveTo(158, 110, 152, 150);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // U-shaped cup-slot (dark hollow) cut into the top.
  g.beginPath();
  g.moveTo(70, 100);
  g.quadraticCurveTo(96, 124, 122, 100);
  g.closePath();
  g.fillStyle = CLAY.deep;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.stroke();
  // Glaze groove ring.
  g.save();
  g.globalAlpha = 0.7;
  g.strokeStyle = CLAY.pale;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(46, 132);
  g.quadraticCurveTo(96, 140, 146, 132);
  g.stroke();
  g.restore();
  // Cup bowl nested in the slot.
  blob(g, rng, cx, 90, 30, 24, { fill: CLAY.pale, ...OUT }, 11, 0.05);
  // Flat cup rim line.
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(70, 74);
  g.quadraticCurveTo(96, 68, 122, 74);
  g.stroke();
  // Tea surface — cool (pale) or warm (deepened hot center).
  blob(g, rng, cx, 74, 22, 7, { fill: warm ? CLAY.mid : CLAY.light, outline: INK.soft, lineWidth: 2.5 }, 9, 0.1);
  if (warm) {
    g.save();
    g.globalAlpha = 0.35;
    blob(g, rng, cx, 74, 12, 4, { fill: CLAY.deep }, 8, 0.14);
    g.restore();
  }
  // Cup handle on the right.
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(124, 82);
  g.quadraticCurveTo(142, 86, 124, 98);
  g.stroke();
  // Soft shade pass on the cup's left flank.
  g.save();
  g.globalAlpha = 0.18;
  blob(g, rng, 84, 94, 11, 15, { fill: CLAY.deep }, 9, 0.12);
  g.restore();
  if (warm) {
    // ONE frozen hand-wobbled steam curl + a thinner trailing wisp (cool SAGE,
    // never amber, never a particle) — the only new element on the warm plate.
    g.save();
    g.strokeStyle = SAGE.deep;
    g.lineCap = 'round';
    g.lineWidth = 4;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(94, 68);
    g.quadraticCurveTo(108, 54, 92, 42);
    g.quadraticCurveTo(78, 30, 96, 16);
    g.stroke();
    g.lineWidth = 2.5;
    g.globalAlpha = 0.32;
    g.beginPath();
    g.moveTo(100, 62);
    g.quadraticCurveTo(112, 50, 102, 38);
    g.stroke();
    g.restore();
  }
  return { canvas: c, aspect: 192 / 176 };
}

/* 02 ── nose-puzzle-drawer (Datou Play) ────────────────────────────────────── */
// A wide low clay box with three rounded nose-tabs; active = one drawer slid out.
export function drawNosePuzzle(seed: number, open = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(224, 168);
  const baseY = 146;
  contact(g, rng, 112, 158, 84);
  // Carcass — a wide two-tone clay slab.
  g.beginPath();
  g.roundRect(28, baseY - 64, 168, 64, 10);
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Darker recessed front face (where the drawers live).
  g.beginPath();
  g.roundRect(36, baseY - 50, 152, 42, 6);
  g.fillStyle = CLAY.deep;
  g.fill();
  g.strokeStyle = INK.soft;
  g.lineWidth = 3;
  g.stroke();
  // A wood lid plate across the top.
  g.beginPath();
  g.roundRect(28, baseY - 70, 168, 12, 5);
  g.fillStyle = CLAY.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.stroke();
  // Three drawer fronts with big rounded nose-tabs. The middle slides out when open.
  const slots = [60, 112, 164];
  slots.forEach((x, i) => {
    const isOpen = open && i === 1;
    const dy = isOpen ? 18 : 0; // the open drawer juts forward (down on the plate)
    // Drawer face.
    g.beginPath();
    g.roundRect(x - 26, baseY - 46 + dy, 52, 34, 6);
    g.fillStyle = CLAY.pale;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 3.5;
    g.stroke();
    // Nose-tab (a soft thumb-pad jutting forward).
    blob(g, rng, x, baseY - 8 + dy, 15, 10, { fill: CLAY.mid, ...OUT_THIN }, 9, 0.12);
    if (isOpen) {
      // The exposed tray behind the slid drawer (a darker pocket).
      g.beginPath();
      g.roundRect(x - 22, baseY - 50, 44, 16, 4);
      g.fillStyle = INK.soft;
      g.fill();
      // One small ACCENT_WARM scent-cap dot in the open tray (the lone focal).
      g.fillStyle = ACCENT_WARM;
      g.beginPath();
      g.arc(x, baseY - 42, 4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK.line;
      g.lineWidth = 2;
      g.stroke();
    }
  });
  return { canvas: c, aspect: 224 / 168 };
}

/* 03 ── paw-rinse-step (Datou Care) ────────────────────────────────────────── */
// A wide, knee-low clay tray with a 2×2 grid of wells; active = still water sheen.
export function drawPawRinse(seed: number, state: 'dry' | 'filled' | 'clean' = 'dry'): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(224, 144);
  contact(g, rng, 112, 132, 92);
  // Low slab body, flush on the ground.
  g.beginPath();
  g.roundRect(26, 60, 172, 64, 12);
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Front lip-spout draining toward the viewer.
  g.beginPath();
  g.moveTo(96, 124);
  g.lineTo(112, 136);
  g.lineTo(128, 124);
  g.closePath();
  g.fillStyle = CLAY.deep;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3;
  g.stroke();
  // One brass drain stud (the lone warm focal, ACCENT_WARM — not amber).
  g.fillStyle = ACCENT_WARM;
  g.beginPath();
  g.arc(112, 122, 4.5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 2;
  g.stroke();
  // 2×2 grid of shallow round dishes.
  const wells: Array<[number, number]> = [
    [78, 82],
    [146, 82],
    [78, 106],
    [146, 106],
  ];
  for (const [x, y] of wells) {
    // Dish hollow.
    blob(g, rng, x, y, 24, 13, { fill: CLAY.deep, ...OUT_THIN }, 10, 0.08);
    if (state === 'filled' || state === 'clean') {
      // Still water sheen sitting in the well.
      blob(g, rng, x, y, 18, 9, { fill: WATER.mid, outline: INK.soft, lineWidth: 2 }, 9, 0.08);
      // A single frozen reflection arc (hand-drawn, still).
      g.save();
      g.globalAlpha = state === 'clean' ? 0.4 : 0.6;
      g.strokeStyle = WATER.edge;
      g.lineWidth = 2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - 9, y - 2);
      g.quadraticCurveTo(x, y - 6, x + 9, y - 2);
      g.stroke();
      g.restore();
    }
    if (state === 'clean') {
      // A faint settled clean ring inside the sheen.
      g.save();
      g.globalAlpha = 0.3;
      g.strokeStyle = WATER.deep;
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(x, y, 12, 6, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }
  return { canvas: c, aspect: 224 / 144 };
}

/* 04 ── moonwater-lamp (Night/Light) ───────────────────────────────────────── */
// A low wide glass water-bowl on a stubby clay tripod; lit = a small warm pool
// of light HELD IN THE WATER (the one allowed amber lamp aperture).
export function drawMoonwaterLamp(seed: number, lit = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(208, 168);
  const cx = 104;
  const waterY = 92;
  contact(g, rng, cx, 156, 78);
  // Three-toe clay foot.
  for (const [x, w] of [
    [74, 16],
    [104, 18],
    [136, 16],
  ] as const) {
    g.fillStyle = CLAY.mid;
    g.beginPath();
    g.roundRect(x - w / 2, 128, w, 18, 4);
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 3.5;
    g.stroke();
  }
  // The broad lens-shaped glass bowl.
  g.beginPath();
  g.moveTo(44, waterY);
  g.quadraticCurveTo(cx, 150, 164, waterY);
  g.quadraticCurveTo(cx, 116, 44, waterY);
  g.closePath();
  g.fillStyle = CLAY.pale;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Still water surface across the mouth.
  blob(g, rng, cx, waterY, 58, 11, { fill: lit ? WATER.edge : WATER.mid, outline: INK.soft, lineWidth: 2.5 }, 12, 0.05);
  if (lit) {
    // The named lamp exception: a small warm candle-amber pool, CONFINED to the
    // water aperture (a believable held light, never a bloom over the plate).
    g.save();
    const grad = g.createRadialGradient(cx, waterY, 3, cx, waterY, 40);
    grad.addColorStop(0, 'rgba(233, 196, 124, 0.8)');
    grad.addColorStop(1, 'rgba(233, 196, 124, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(cx, waterY, 40, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // A tiny held bead of light at the center (the moon on the water).
    g.fillStyle = ROBOT.accent;
    g.beginPath();
    g.arc(cx, waterY, 5, 0, Math.PI * 2);
    g.fill();
  }
  // Two frozen concentric ripple arcs in the water (still, hand-drawn — present
  // always; brighter when lit catches them).
  g.save();
  g.globalAlpha = lit ? 0.55 : 0.32;
  g.strokeStyle = lit ? WATER.deep : WATER.edge;
  g.lineWidth = 2;
  for (const r of [22, 36]) {
    g.beginPath();
    g.ellipse(cx, waterY + 1, r, r * 0.18, 0, Math.PI * 0.12, Math.PI * 0.88);
    g.stroke();
  }
  g.restore();
  return { canvas: c, aspect: 208 / 168 };
}

/* 05 ── bird-nesting-fiber-frame (Wildlife) ────────────────────────────────── */
// A low wide woven lattice on two splayed legs, a fuzzy tuft bulging through;
// "taken" = thinner tuft + one caught feather (ACCENT_WARM).
export function drawNestingFrame(seed: number, taken = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(208, 224);
  const frameY = 70;
  const fw = 150;
  const fh = 96;
  const left = (208 - fw) / 2;
  contact(g, rng, 104, 210, 74);
  // Two short splayed legs.
  wobblyLine(g, rng, 70, 206, 78, frameY + fh, 6, CLAY.deep, 1.2, 4);
  wobblyLine(g, rng, 138, 206, 130, frameY + fh, 6, CLAY.deep, 1.2, 4);
  // Frame border.
  g.beginPath();
  g.roundRect(left, frameY, fw, fh, 8);
  g.fillStyle = CLAY.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Inner mesh window (open grid).
  g.save();
  g.beginPath();
  g.rect(left + 12, frameY + 12, fw - 24, fh - 24);
  g.clip();
  g.strokeStyle = INK.soft;
  g.lineWidth = 1.5;
  g.globalAlpha = 0.6;
  for (let x = left + 12; x <= left + fw - 12; x += 14) {
    g.beginPath();
    g.moveTo(x, frameY + 12);
    g.lineTo(x, frameY + fh - 12);
    g.stroke();
  }
  for (let y = frameY + 12; y <= frameY + fh - 12; y += 14) {
    g.beginPath();
    g.moveTo(left + 12, y);
    g.lineTo(left + fw - 12, y);
    g.stroke();
  }
  g.restore();
  // The loose fiber tuft bulging through the grid (sage, soft). Fewer when taken.
  const tufts = taken ? 5 : 9;
  for (let i = 0; i < tufts; i++) {
    const a = (i / tufts) * Math.PI * 2 + rng.next();
    const rx = 30 + rng.next() * 14;
    const x = 104 + Math.cos(a) * rx * 0.7;
    const y = frameY + fh / 2 + Math.sin(a) * 18;
    blob(g, rng, x, y, 7 + rng.next() * 4, 4 + rng.next() * 2, { fill: SAGE.mid, outline: INK.soft, lineWidth: 1.5 }, 7, 0.2);
  }
  if (taken) {
    // One warm feather caught in the frame (the lone ACCENT_WARM focal).
    g.save();
    g.translate(150, frameY + fh - 18);
    g.rotate(0.5);
    g.fillStyle = ACCENT_WARM;
    g.beginPath();
    g.moveTo(0, -22);
    g.quadraticCurveTo(8, 0, 0, 22);
    g.quadraticCurveTo(-8, 0, 0, -22);
    g.closePath();
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 2;
    g.stroke();
    // Feather rachis.
    g.strokeStyle = INK.soft;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -20);
    g.lineTo(0, 20);
    g.stroke();
    g.restore();
  }
  return { canvas: c, aspect: 208 / 224 };
}

/* 06 ── weather-log-wheel (Weather) ───────────────────────────────────────── */
// A round paper disc on two easel legs with a fixed top pointer; "logged" = the
// face rotated one notch so today's sky glyph sits under the pointer + a tick.
const SKY_GLYPHS = 8;
export function drawWeatherWheel(seed: number, logged = false, notch = 0): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 232);
  const cx = 96;
  const cy = 100;
  const R = 72;
  contact(g, rng, cx, 218, 60);
  // Two slim splayed easel legs + a cross-tie.
  wobblyLine(g, rng, 64, 214, cx - 14, cy + 40, 5, CLAY.deep, 1, 4);
  wobblyLine(g, rng, 128, 214, cx + 14, cy + 40, 5, CLAY.deep, 1, 4);
  wobblyLine(g, rng, 74, 192, 118, 192, 4, CLAY.deep, 1, 3);
  // The round paper disc face.
  blob(g, rng, cx, cy, R, R, { fill: CLAY.pale, ...OUT }, 16, 0.02);
  // Rim ring.
  g.save();
  g.globalAlpha = 0.7;
  g.strokeStyle = CLAY.mid;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, R - 10, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  // Eight sky glyphs around the rim, the whole face rotated by `notch`.
  const base = logged ? (notch * Math.PI * 2) / SKY_GLYPHS : 0;
  for (let i = 0; i < SKY_GLYPHS; i++) {
    const a = base - Math.PI / 2 + (i / SKY_GLYPHS) * Math.PI * 2;
    const gx = cx + Math.cos(a) * (R - 26);
    const gy = cy + Math.sin(a) * (R - 26);
    // Each glyph: a simple sage sky mark (a cloud-ish blob + a tick).
    blob(g, rng, gx, gy, 9, 6, { fill: i % 2 ? SAGE.light : SAGE.mid, outline: INK.soft, lineWidth: 1.5 }, 8, 0.18);
    // Tick on the rim.
    g.strokeStyle = INK.soft;
    g.lineWidth = 1.5;
    const tx = cx + Math.cos(a) * (R - 8);
    const ty = cy + Math.sin(a) * (R - 8);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2));
    g.stroke();
  }
  // Center pivot.
  blob(g, rng, cx, cy, 9, 9, { fill: CLAY.mid, ...OUT_THIN }, 9, 0.06);
  // Fixed wedge-pointer poking DOWN from the top edge (does not rotate).
  g.beginPath();
  g.moveTo(cx - 12, cy - R + 2);
  g.lineTo(cx + 12, cy - R + 2);
  g.lineTo(cx, cy - R + 22);
  g.closePath();
  g.fillStyle = CLAY.deep;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.stroke();
  if (logged) {
    // One tiny ACCENT_WARM "today is logged" tick beside the pointer.
    g.fillStyle = ACCENT_WARM;
    g.beginPath();
    g.arc(cx + 20, cy - R + 14, 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 2;
    g.stroke();
  }
  return { canvas: c, aspect: 192 / 232 };
}

/* 07 ── spin-choice-wheel (Datou Play/Choice) ─────────────────────────────── */
// An upright spoked disc on a low two-foot stand with a fixed top pointer;
// "landed" = the face turned so one game-icon sits seated under the pointer.
const CHOICE_ICONS = 6;
export function drawSpinWheel(seed: number, landed = false, pick = 0): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 248);
  const cx = 96;
  const cy = 104;
  const R = 78;
  contact(g, rng, cx, 234, 56);
  // Low two-foot stand.
  wobblyLine(g, rng, 60, 230, cx - 10, cy + 40, 6, CLAY.deep, 1, 4);
  wobblyLine(g, rng, 132, 230, cx + 10, cy + 40, 6, CLAY.deep, 1, 4);
  blob(g, rng, cx, 232, 30, 9, { fill: CLAY.mid, ...OUT_THIN }, 9, 0.08);
  // The wheel face (sage), turned by `pick` when landed.
  blob(g, rng, cx, cy, R, R, { fill: SAGE.light, ...OUT }, 18, 0.02);
  const turn = landed ? (pick * Math.PI * 2) / CHOICE_ICONS : 0;
  // Spokes + six wedge icons.
  for (let i = 0; i < CHOICE_ICONS; i++) {
    const a = turn - Math.PI / 2 + (i / CHOICE_ICONS) * Math.PI * 2;
    // Spoke.
    g.strokeStyle = INK.soft;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
    g.stroke();
    // Icon blob mid-wedge.
    const ia = a + Math.PI / CHOICE_ICONS;
    const ix = cx + Math.cos(ia) * (R - 26);
    const iy = cy + Math.sin(ia) * (R - 26);
    blob(g, rng, ix, iy, 10, 10, { fill: i % 2 ? CLAY.pale : SAGE.mid, outline: INK.soft, lineWidth: 1.5 }, 9, 0.14);
  }
  // Hub cap (ACCENT_WARM).
  blob(g, rng, cx, cy, 10, 10, { fill: ACCENT_WARM, ...OUT_THIN }, 9, 0.06);
  // Fixed top pointer (ACCENT_WARM triangle).
  g.beginPath();
  g.moveTo(cx - 11, cy - R + 1);
  g.lineTo(cx + 11, cy - R + 1);
  g.lineTo(cx, cy - R + 20);
  g.closePath();
  g.fillStyle = ACCENT_WARM;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.stroke();
  if (landed) {
    // The seated icon under the pointer, drawn larger/crisper over a small flat
    // ACCENT_WARM backing tile (a still turned wheel — never spin-arcs).
    const sy = cy - R + 34;
    g.fillStyle = ACCENT_WARM;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.roundRect(cx - 16, sy - 16, 32, 32, 6);
    g.fill();
    g.globalAlpha = 1;
    blob(g, rng, cx, sy, 13, 13, { fill: SAGE.deep, ...OUT_THIN }, 10, 0.1);
  }
  return { canvas: c, aspect: 192 / 248 };
}

/* 08 ── shared-snack-tin (Kitchen/Shared Meals) ───────────────────────────── */
// A squat round drum with a two-piece domed lid and a nose-pad on the near rim;
// "open" = the near lid-half propped, two treats visible in the warm interior.
export function drawSnackTin(seed: number, open = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 168);
  const cx = 96;
  const bodyTop = 78;
  contact(g, rng, cx, 150, 70);
  // Low cylinder body.
  g.beginPath();
  g.moveTo(40, bodyTop);
  g.lineTo(40, 134);
  g.quadraticCurveTo(cx, 152, 152, 134);
  g.lineTo(152, bodyTop);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Body band line.
  g.save();
  g.globalAlpha = 0.6;
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(44, 110);
  g.quadraticCurveTo(cx, 124, 148, 110);
  g.stroke();
  g.restore();
  // The lid: an ellipse rim. Two halves; the near half props open when open.
  // Far (back) lid half — always seated.
  g.beginPath();
  g.ellipse(cx, bodyTop, 56, 18, 0, Math.PI, Math.PI * 2);
  g.fillStyle = CLAY.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.stroke();
  if (open) {
    // Open interior (warm pocket) behind the propped half.
    g.beginPath();
    g.ellipse(cx, bodyTop + 2, 52, 15, 0, 0, Math.PI);
    g.fillStyle = INK.soft;
    g.fill();
    // Two treats in the interior (ACCENT_WARM, the warm focal).
    for (const dx of [-18, 16]) {
      blob(g, rng, cx + dx, bodyTop + 6, 9, 7, { fill: ACCENT_WARM, ...OUT_THIN }, 8, 0.16);
    }
    // The near lid-half propped up at an angle.
    g.save();
    g.translate(cx, bodyTop + 4);
    g.rotate(-0.5);
    g.beginPath();
    g.ellipse(0, -8, 52, 15, 0, 0, Math.PI);
    g.fillStyle = CLAY.light;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4;
    g.stroke();
    g.restore();
  } else {
    // Near (front) lid half — seated, slightly domed.
    g.beginPath();
    g.ellipse(cx, bodyTop + 2, 56, 16, 0, 0, Math.PI);
    g.fillStyle = CLAY.pale;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4;
    g.stroke();
    // Center seam where the two halves meet.
    g.strokeStyle = INK.soft;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - 56, bodyTop);
    g.lineTo(cx + 56, bodyTop);
    g.stroke();
  }
  // The nose-push button-pad on the near rim (ACCENT_WARM, small).
  g.fillStyle = ACCENT_WARM;
  g.beginPath();
  g.arc(cx, bodyTop + 16, 6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 2.5;
  g.stroke();
  return { canvas: c, aspect: 192 / 168 };
}
