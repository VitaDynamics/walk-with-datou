/**
 * Landmark prop sprites — the authored community places (landmark plan §7).
 *
 * Same hand-drawn cutout language as props.ts: seeded Rng, ink outlines,
 * paper/sage/clay families, ONE accent per area used sparingly. The Trail
 * Repair Commons reads as a friendly volunteer repair stop: mismatched wood,
 * fabric patches, amber safety warmth. Stateful pieces ship both states
 * (tangled/repaired, closed/open) so the world can re-plate on change.
 */

import { Rng } from '../physics/mujoco/rng';
import { CLAY, INK, LAMP_WARM, ROBOT, SAGE, WATER } from './palette';
import { blob, wobblyLine } from './strokes';
import { createCanvas, ctx2d } from './textures';
import type { PropSprite } from './props';

function sprite(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = createCanvas(w, h);
  return { c, g: ctx2d(c) };
}

/** A small fabric patch — the Commons' patchwork signature. */
function patch(
  g: CanvasRenderingContext2D,
  rng: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
): void {
  g.save();
  g.translate(x, y);
  g.rotate((rng.next() * 2 - 1) * 0.12);
  g.fillStyle = fill;
  g.fillRect(-w / 2, -h / 2, w, h);
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.setLineDash([5, 4]); // hand stitches
  g.strokeRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
  g.setLineDash([]);
  g.restore();
}

/**
 * The pennant mast — the Commons' identity silhouette (8–9 m world height).
 * A leaning salvaged pole, one crossarm, a single cord swept to one side with
 * patchwork pennant rectangles (asymmetric on purpose), and a small safety
 * lamp at shoulder height. `lit` bakes the warm halo once the chime is
 * repaired — a state swap, never a real glow.
 */
export function drawPennantMast(seed: number, lit = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(320, 1024);
  const baseX = 96;
  // The pole — two salvaged lengths fished together at a joint.
  wobblyLine(g, rng, baseX, 1000, baseX + 14, 540, 16, CLAY.mid, 1.2, 6);
  wobblyLine(g, rng, baseX + 14, 548, baseX + 22, 80, 13, CLAY.deep, 1.2, 6);
  // The fishplate joint wrap.
  patch(g, rng, baseX + 13, 540, 34, 40, CLAY.light);
  // Crossarm near the top.
  wobblyLine(g, rng, baseX - 30, 120, baseX + 92, 102, 9, CLAY.mid, 1.5, 4);
  // One cord swept down-right — the asymmetric line the silhouette hangs on.
  g.strokeStyle = INK.soft;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(baseX + 90, 104);
  g.quadraticCurveTo(baseX + 168, 240, baseX + 196, 430);
  g.stroke();
  // Patchwork pennants along the cord (rectangles, calm — never flapping).
  const stops: Array<[number, number, string]> = [
    [baseX + 112, 148, CLAY.light],
    [baseX + 146, 218, SAGE.mid],
    [baseX + 168, 290, CLAY.blossom],
    [baseX + 184, 364, ROBOT.accent], // the one amber patch
    [baseX + 193, 425, CLAY.pale],
  ];
  for (const [px, py, fill] of stops) patch(g, rng, px, py, 30, 38, fill);
  // The safety lamp at shoulder height on the pole.
  if (lit) {
    const halo = g.createRadialGradient(baseX + 40, 668, 5, baseX + 40, 668, 80);
    halo.addColorStop(0, LAMP_WARM);
    halo.addColorStop(1, 'rgba(233, 196, 124, 0)');
    g.fillStyle = halo;
    g.fillRect(baseX - 40, 588, 160, 160);
  }
  wobblyLine(g, rng, baseX + 10, 660, baseX + 34, 656, 5, ROBOT.dark, 1, 3);
  g.beginPath();
  g.moveTo(baseX + 24, 648);
  g.lineTo(baseX + 56, 648);
  g.lineTo(baseX + 50, 678);
  g.lineTo(baseX + 30, 678);
  g.closePath();
  g.fillStyle = lit ? '#f2d9a0' : ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.lineJoin = 'round';
  g.stroke();
  // Guy rope to the ground (the working-structure read).
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(baseX + 18, 200);
  g.lineTo(baseX - 72, 992);
  g.stroke();
  blob(g, rng, baseX - 74, 996, 14, 7, { fill: CLAY.deep, outline: INK.line, lineWidth: 3 }, 7, 0.1);
  return { canvas: c, aspect: 320 / 1024 };
}

/**
 * The message chime stand (~1.7 m): a frame of two posts and a beam where the
 * trail crews hung a wind chime for passers-by. Tangled: cords knotted into a
 * bunch, one hanger empty, a slack line — quietly wrong. Repaired: pieces
 * hang level, the missing slot filled with a fresh twig clapper, the one
 * amber chime catching the light.
 */
export function drawChimeStand(seed: number, repaired: boolean): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(288, 384);
  // Two posts + beam.
  wobblyLine(g, rng, 56, 368, 58, 96, 12, CLAY.deep, 1.5, 5);
  wobblyLine(g, rng, 232, 368, 228, 96, 12, CLAY.mid, 1.5, 5);
  wobblyLine(g, rng, 36, 100, 252, 92, 9, CLAY.mid, 1.5, 5);
  // A small pinned tag on the left post (maintenance note).
  patch(g, rng, 56, 180, 26, 32, CLAY.pale);
  if (!repaired) {
    // Tangled: the cords pulled into one knotted bunch off-center; one hanger
    // hangs empty; a slack cord droops to the right post.
    g.strokeStyle = INK.soft;
    g.lineWidth = 2.5;
    for (const x of [108, 124, 140] as const) {
      g.beginPath();
      g.moveTo(x, 96);
      g.quadraticCurveTo(x + 10, 140, 128, 168);
      g.stroke();
    }
    // The knot.
    blob(g, rng, 128, 176, 16, 13, { fill: CLAY.light, outline: INK.line, lineWidth: 3.5 }, 8, 0.15);
    // Bunched chime pieces below the knot, touching (the dull clack).
    blob(g, rng, 116, 210, 9, 14, { fill: CLAY.mid, outline: INK.line, lineWidth: 3 }, 8, 0.1);
    blob(g, rng, 134, 214, 9, 14, { fill: CLAY.deep, outline: INK.line, lineWidth: 3 }, 8, 0.1);
    // The empty hanger — a short cord ending in a little open loop.
    g.beginPath();
    g.moveTo(182, 94);
    g.lineTo(182, 126);
    g.stroke();
    g.beginPath();
    g.arc(182, 133, 6, 0, Math.PI * 2);
    g.stroke();
    // The slack line drooping to the right post.
    g.beginPath();
    g.moveTo(196, 96);
    g.quadraticCurveTo(216, 150, 230, 140);
    g.stroke();
  } else {
    // Repaired: four pieces hanging level and apart, the new twig clapper in
    // the once-empty slot, one quiet amber note.
    g.strokeStyle = INK.soft;
    g.lineWidth = 2.5;
    const drops: Array<[number, number]> = [
      [104, 168],
      [136, 196],
      [168, 158],
      [200, 184],
    ];
    for (const [x, y] of drops) {
      g.beginPath();
      g.moveTo(x, 95);
      g.lineTo(x, y);
      g.stroke();
    }
    blob(g, rng, 104, 180, 9, 14, { fill: CLAY.mid, outline: INK.line, lineWidth: 3 }, 8, 0.1);
    blob(g, rng, 136, 208, 9, 14, { fill: CLAY.deep, outline: INK.line, lineWidth: 3 }, 8, 0.1);
    // The replaced piece — a fresh twig clapper, slightly lighter.
    blob(g, rng, 168, 170, 8, 13, { fill: CLAY.pale, outline: INK.line, lineWidth: 3 }, 8, 0.1);
    blob(g, rng, 200, 196, 10, 9, { fill: CLAY.blossom, outline: INK.soft, lineWidth: 2.5 }, 7, 0.12);
    g.fillStyle = ROBOT.accent;
    g.beginPath();
    g.arc(200, 196, 3.5, 0, Math.PI * 2);
    g.fill();
  }
  return { canvas: c, aspect: 288 / 384 };
}

/**
 * The workbench lean-to (~2.3 m): a slanted patch-fabric roof on two posts
 * over a simple work surface with a few resting tools — the heart's shelter
 * mass behind the bulletin board.
 */
export function drawLeanTo(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(512, 448);
  // Posts (tall pair at the back, short pair at the front).
  wobblyLine(g, rng, 96, 424, 92, 96, 13, CLAY.deep, 1.5, 5);
  wobblyLine(g, rng, 400, 424, 404, 110, 13, CLAY.mid, 1.5, 5);
  wobblyLine(g, rng, 152, 424, 150, 220, 11, CLAY.mid, 1.5, 4);
  wobblyLine(g, rng, 360, 424, 364, 226, 11, CLAY.deep, 1.5, 4);
  // The slanted roof — a fabric sheet with sewn-on patches.
  g.beginPath();
  g.moveTo(48, 110);
  g.lineTo(452, 124);
  g.lineTo(420, 196);
  g.lineTo(76, 178);
  g.closePath();
  g.fillStyle = CLAY.pale;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  patch(g, rng, 160, 150, 52, 40, SAGE.mid);
  patch(g, rng, 330, 160, 44, 36, CLAY.light);
  // Work surface.
  g.beginPath();
  g.moveTo(120, 282);
  g.lineTo(392, 288);
  g.lineTo(388, 312);
  g.lineTo(124, 306);
  g.closePath();
  g.fillStyle = CLAY.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  // Bench legs.
  wobblyLine(g, rng, 150, 420, 152, 308, 9, CLAY.deep, 1.5, 3);
  wobblyLine(g, rng, 356, 420, 358, 310, 9, CLAY.deep, 1.5, 3);
  // Resting tools: a mallet and a coiled cord on the surface.
  g.save();
  g.translate(210, 272);
  g.rotate(-0.3);
  g.fillStyle = CLAY.deep;
  g.fillRect(-6, -34, 12, 38);
  g.fillStyle = ROBOT.dark;
  g.fillRect(-20, -48, 40, 18);
  g.strokeStyle = INK.line;
  g.lineWidth = 3;
  g.strokeRect(-20, -48, 40, 18);
  g.restore();
  g.strokeStyle = INK.soft;
  g.lineWidth = 4;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(300, 276 - i * 2, 26 - i * 4, 9, 0, 0, Math.PI * 2);
    g.stroke();
  }
  return { canvas: c, aspect: 512 / 448 };
}

/** A dropped-fastener breadcrumb (ground cross plate, ~0.25 m): a couple of
 *  washers and a bolt where a volunteer's pocket leaked. */
export function drawFastener(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 128);
  const cx = 50 + rng.next() * 20;
  // Two washers.
  for (const [dx, dy, r] of [
    [-14, 8, 11],
    [16, 2, 9],
  ] as const) {
    g.strokeStyle = INK.line;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx + dx, 96 + dy, r, 0, Math.PI * 2);
    g.fillStyle = ROBOT.dark;
    g.fill();
    g.stroke();
    g.fillStyle = CLAY.pale;
    g.beginPath();
    g.arc(cx + dx, 96 + dy, r * 0.4, 0, Math.PI * 2);
    g.fill();
  }
  // A small bolt lying flat.
  g.save();
  g.translate(cx + 4, 78);
  g.rotate(0.9 + rng.next() * 0.4);
  g.fillStyle = ROBOT.dark;
  g.fillRect(-4, -16, 8, 28);
  g.strokeStyle = INK.line;
  g.lineWidth = 2.5;
  g.strokeRect(-4, -16, 8, 28);
  g.fillRect(-9, -22, 18, 8);
  g.strokeRect(-9, -22, 18, 8);
  g.restore();
  return { canvas: c, aspect: 1 };
}

/** A patched fence run (~1 m): the repaired stretch that says "someone
 *  maintains this trail" — second approach breadcrumb. */
export function drawPatchedFence(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(320, 192);
  for (const x of [44, 276]) {
    wobblyLine(g, rng, x, 180, x + 2, 36, 14, CLAY.mid, 1.5, 4);
  }
  for (const y of [70, 124]) {
    g.beginPath();
    g.moveTo(20, y + rng.next() * 6);
    g.lineTo(300, y - 4 + rng.next() * 6);
    g.lineWidth = 13;
    g.strokeStyle = CLAY.light;
    g.lineCap = 'round';
    g.stroke();
  }
  // The repair: one fresh pale board lashed over the old rail + a wrap.
  g.save();
  g.translate(170, 66);
  g.rotate(-0.06);
  g.fillStyle = CLAY.pale;
  g.fillRect(-58, -9, 116, 18);
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.strokeRect(-58, -9, 116, 18);
  g.restore();
  g.strokeStyle = INK.soft;
  g.lineWidth = 3;
  for (const lx of [122, 216] as const) {
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(lx - 6 + i * 5, 48);
      g.lineTo(lx + 2 + i * 5, 86);
      g.stroke();
    }
  }
  return { canvas: c, aspect: 320 / 192 };
}

/**
 * The blue ribbon clue (~0.35 m): a strip of water-blue cloth tied to a stick
 * — the garden's color arriving at the Commons, and the scraps that continue
 * along the lake path. Quiet; sways nowhere; just sits and is the wrong color
 * for this place in the right way.
 */
export function drawRibbonScrap(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 160);
  // The stick it's tied to.
  wobblyLine(g, rng, 64, 150, 66 + (rng.next() * 8 - 4), 58, 6, CLAY.deep, 1.2, 4);
  // The ribbon: a soft double-curve strip.
  g.fillStyle = WATER.mid;
  g.strokeStyle = INK.soft;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(66, 64);
  g.quadraticCurveTo(92, 70, 100, 92);
  g.quadraticCurveTo(86, 90, 78, 84);
  g.quadraticCurveTo(82, 102, 74, 116);
  g.quadraticCurveTo(64, 92, 62, 76);
  g.closePath();
  g.fill();
  g.stroke();
  // The knot.
  blob(g, rng, 66, 62, 7, 6, { fill: WATER.deep, outline: INK.soft, lineWidth: 2.5 }, 7, 0.15);
  return { canvas: c, aspect: 128 / 160 };
}

/**
 * The pinned pump-garden notice (~0.6 m plate placed at the bulletin board
 * after the chime is repaired): a water-stained sketch of the pump garden
 * with a blue ribbon tied to its lake-side corner — the clue that opens the
 * next information gap. Drawn as its own small plate so the board itself
 * stays a static batch.
 */
export function drawPumpNotice(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 192);
  g.save();
  g.translate(80, 96);
  g.rotate(0.05);
  // The sheet.
  g.fillStyle = '#fbf7ec';
  g.fillRect(-52, -68, 104, 132);
  g.strokeStyle = INK.soft;
  g.lineWidth = 3;
  g.strokeRect(-52, -68, 104, 132);
  // Water stain (the lake got to it).
  g.fillStyle = WATER.edge;
  g.globalAlpha = 0.5;
  blob(g, rng, -20, 36, 34, 22, { fill: WATER.edge }, 8, 0.2);
  g.globalAlpha = 1;
  // The sketch: a crooked pump wheel + two floating planters, child-simple.
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(0, -22, 22, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    const a = 0.4 + (i / 4) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * 6, -22 + Math.sin(a) * 6);
    g.lineTo(Math.cos(a) * 20, -22 + Math.sin(a) * 20);
    g.stroke();
  }
  g.strokeRect(-38, 14, 28, 12);
  g.strokeRect(8, 18, 28, 12);
  // Wavy water line under the planters.
  g.beginPath();
  g.moveTo(-44, 40);
  for (let x = -44; x <= 44; x += 11) g.quadraticCurveTo(x + 5, 36, x + 11, 40);
  g.stroke();
  // The pin.
  g.fillStyle = CLAY.blossom;
  g.beginPath();
  g.arc(0, -62, 5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.soft;
  g.lineWidth = 2;
  g.stroke();
  g.restore();
  // The blue ribbon on the lake-side (right) corner.
  g.fillStyle = WATER.mid;
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(126, 148);
  g.quadraticCurveTo(146, 158, 150, 180);
  g.quadraticCurveTo(134, 174, 126, 164);
  g.closePath();
  g.fill();
  g.stroke();
  return { canvas: c, aspect: 160 / 192 };
}

// --- B. The Reedwater Pump Garden (accent: water-blue + curving lines) -------

/**
 * The pump wheel + sails — the garden's identity silhouette (~3.6 m): a
 * crooked wheel on a timber frame with two water-blue cloth sails strung
 * above the reed line. `running` bakes a thin water curve from the spout —
 * the loop is alive again. No spin, no flutter: calm plates.
 */
export function drawPumpWheel(seed: number, running = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(384, 576);
  // Timber A-frame.
  wobblyLine(g, rng, 120, 552, 168, 220, 13, CLAY.deep, 1.4, 5);
  wobblyLine(g, rng, 230, 552, 178, 222, 13, CLAY.mid, 1.4, 5);
  wobblyLine(g, rng, 134, 470, 218, 472, 8, CLAY.mid, 1.4, 4);
  // The crooked wheel (slightly off-axis ellipse + spokes).
  g.save();
  g.translate(176, 200);
  g.rotate(running ? 0.18 : -0.08);
  g.strokeStyle = INK.line;
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(0, 0, 88, 80, 0.12, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * 84, Math.sin(a) * 76);
    g.stroke();
  }
  // Paddle cups on the rim.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    blob(g, rng, Math.cos(a) * 84, Math.sin(a) * 76, 13, 9, { fill: CLAY.light, outline: INK.line, lineWidth: 3 }, 7, 0.12);
  }
  g.restore();
  // Hub.
  blob(g, rng, 176, 200, 14, 14, { fill: ROBOT.dark, outline: INK.line, lineWidth: 4 }, 8, 0.06);
  // Sail line swept to the right, two blue cloth sails (rectangles, calm).
  g.strokeStyle = INK.soft;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(176, 96);
  g.quadraticCurveTo(280, 80, 352, 120);
  g.stroke();
  wobblyLine(g, rng, 176, 200, 176, 92, 7, CLAY.deep, 1.2, 4);
  for (const [px, py, w, h] of [
    [236, 116, 44, 56],
    [316, 130, 38, 48],
  ] as const) {
    g.save();
    g.translate(px, py);
    g.rotate(0.06);
    g.fillStyle = WATER.mid;
    g.fillRect(-w / 2, 0, w, h);
    g.strokeStyle = INK.soft;
    g.lineWidth = 3;
    g.strokeRect(-w / 2, 0, w, h);
    g.restore();
  }
  // Spout + (running) the thin water curve into a catch basin.
  g.beginPath();
  g.moveTo(96, 300);
  g.lineTo(150, 286);
  g.lineTo(150, 306);
  g.lineTo(100, 318);
  g.closePath();
  g.fillStyle = CLAY.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.stroke();
  if (running) {
    g.strokeStyle = WATER.deep;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(102, 312);
    g.quadraticCurveTo(86, 380, 92, 470);
    g.stroke();
    blob(g, rng, 92, 492, 30, 10, { fill: WATER.mid, outline: INK.soft, lineWidth: 3 }, 8, 0.15);
  }
  return { canvas: c, aspect: 384 / 576 };
}

/**
 * A water channel piece on low trestles (~0.9 m). Three readable states:
 * swung out of line and dry → reconnected (aligned) → carrying water (a blue
 * line down the trough). The player's two taps put the loop back together.
 */
export function drawChannel(seed: number, connected: boolean, wet: boolean): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(384, 224);
  // Trestle legs.
  wobblyLine(g, rng, 90, 210, 96, 130, 9, CLAY.deep, 1.4, 4);
  wobblyLine(g, rng, 290, 210, 284, 130, 9, CLAY.mid, 1.4, 4);
  // The trough — aligned when connected, swung when not.
  g.save();
  g.translate(192, 118);
  g.rotate(connected ? -0.02 : 0.22);
  g.beginPath();
  g.moveTo(-160, -16);
  g.lineTo(160, -10);
  g.lineTo(154, 18);
  g.lineTo(-154, 12);
  g.closePath();
  g.fillStyle = CLAY.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Inner trough line; water when wet.
  g.strokeStyle = wet ? WATER.deep : CLAY.mid;
  g.lineWidth = wet ? 8 : 4;
  g.beginPath();
  g.moveTo(-144, 0);
  g.quadraticCurveTo(0, wet ? 6 : 2, 144, 2);
  g.stroke();
  g.restore();
  if (!connected) {
    // The dropped end rests on a stone — quietly wrong.
    blob(g, rng, 320, 196, 22, 12, { fill: CLAY.pale, outline: INK.line, lineWidth: 3.5 }, 8, 0.12);
  }
  return { canvas: c, aspect: 384 / 224 };
}

/** A floating planter box among the reeds (~0.7 m): wilted grey paper plants,
 *  or lifted and in color once the water loop runs. */
export function drawFloatingPlanter(seed: number, lifted: boolean): PropSprite {
  void seed; // stateless plate — both states are fully authored
  const { c, g } = sprite(256, 224);
  // Water line it sits in.
  g.strokeStyle = WATER.mid;
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(28, 196);
  for (let x = 28; x <= 228; x += 25) g.quadraticCurveTo(x + 12, 190, x + 25, 196);
  g.stroke();
  // The box.
  g.beginPath();
  g.moveTo(60, 140);
  g.lineTo(196, 140);
  g.lineTo(188, 188);
  g.lineTo(68, 188);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  // Plants: wilted = drooping soft-ink strokes; lifted = upright + blossoms.
  g.lineWidth = 4;
  g.lineCap = 'round';
  if (!lifted) {
    g.strokeStyle = SAGE.mid;
    for (const [x, lean] of [
      [92, -30],
      [128, 26],
      [164, -24],
    ] as const) {
      g.beginPath();
      g.moveTo(x, 140);
      g.quadraticCurveTo(x + lean * 0.3, 108, x + lean, 122);
      g.stroke();
    }
  } else {
    g.strokeStyle = SAGE.deep;
    for (const [x, lean] of [
      [92, -8],
      [128, 4],
      [164, -5],
    ] as const) {
      g.beginPath();
      g.moveTo(x, 140);
      g.quadraticCurveTo(x + lean, 96, x + lean * 1.4, 72);
      g.stroke();
      g.fillStyle = CLAY.blossom;
      g.beginPath();
      g.arc(x + lean * 1.4, 68, 7, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK.soft;
      g.lineWidth = 2;
      g.stroke();
      g.strokeStyle = SAGE.deep;
      g.lineWidth = 4;
    }
  }
  return { canvas: c, aspect: 256 / 224 };
}

/** The garden's donation socket (~0.6 m): an empty planter frame waiting at
 *  the water's edge — `filled` shows the player's planter settled in. */
export function drawPlanterSocket(seed: number, filled: boolean): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(224, 192);
  // The frame: four corner posts + rails outlining an empty bed.
  for (const [x, y] of [
    [56, 160],
    [168, 160],
    [48, 178],
    [176, 178],
  ] as const) {
    wobblyLine(g, rng, x, y, x + 2, y - 38, 7, CLAY.deep, 1.3, 3);
  }
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.strokeRect(44, 130, 136, 44);
  if (!filled) {
    // Empty: a faint dashed waiting outline inside.
    g.strokeStyle = INK.soft;
    g.lineWidth = 2.5;
    g.setLineDash([6, 5]);
    g.strokeRect(58, 138, 108, 28);
    g.setLineDash([]);
  } else {
    // The player's planter sits inside, plants up.
    g.fillStyle = CLAY.light;
    g.fillRect(54, 134, 116, 36);
    g.strokeStyle = INK.line;
    g.lineWidth = 4;
    g.strokeRect(54, 134, 116, 36);
    g.strokeStyle = SAGE.deep;
    g.lineWidth = 3.5;
    g.lineCap = 'round';
    for (const x of [84, 112, 140] as const) {
      g.beginPath();
      g.moveTo(x, 134);
      g.quadraticCurveTo(x + 4, 104, x + 2, 88);
      g.stroke();
      g.fillStyle = CLAY.blossom;
      g.beginPath();
      g.arc(x + 2, 84, 5.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  return { canvas: c, aspect: 224 / 192 };
}

/** The blue-lidded planter tool chest (garden coffer). */
export function drawBlueCoffer(seed: number, open = false): PropSprite {
  void seed; // stateless plate
  const { c, g } = sprite(256, 224);
  const baseY = 196;
  // Body.
  g.beginPath();
  g.moveTo(50, 122);
  g.lineTo(56, baseY);
  g.lineTo(200, baseY);
  g.lineTo(206, 122);
  g.closePath();
  g.fillStyle = CLAY.pale;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Rope handle.
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(128, 168, 16, 0.2, Math.PI - 0.2);
  g.stroke();
  if (!open) {
    // Water-blue lid.
    g.beginPath();
    g.moveTo(46, 124);
    g.quadraticCurveTo(128, 76, 210, 124);
    g.lineTo(206, 134);
    g.quadraticCurveTo(128, 90, 50, 134);
    g.closePath();
    g.fillStyle = WATER.mid;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.stroke();
    // Two catches (the player releases them).
    for (const x of [86, 170] as const) {
      g.fillStyle = ROBOT.dark;
      g.fillRect(x - 5, 124, 10, 12);
      g.strokeStyle = INK.line;
      g.lineWidth = 2.5;
      g.strokeRect(x - 5, 124, 10, 12);
    }
  } else {
    // Open mouth + tipped blue lid + a rolled sketch.
    g.beginPath();
    g.ellipse(128, 120, 76, 17, 0, 0, Math.PI * 2);
    g.fillStyle = CLAY.deep;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4;
    g.stroke();
    g.beginPath();
    g.moveTo(56, 112);
    g.quadraticCurveTo(118, 46, 196, 62);
    g.quadraticCurveTo(152, 78, 94, 116);
    g.closePath();
    g.fillStyle = WATER.mid;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.stroke();
    g.save();
    g.translate(134, 106);
    g.rotate(-0.18);
    g.fillStyle = '#fbf7ec';
    g.fillRect(-20, -9, 40, 18);
    g.strokeStyle = INK.soft;
    g.lineWidth = 2.5;
    g.strokeRect(-20, -9, 40, 18);
    g.restore();
  }
  return { canvas: c, aspect: 256 / 224 };
}

/** A painted irrigation stake with a blue band (~0.5 m) — the garden's
 *  approach breadcrumb (the ribbon scraps "become hose and stakes"). */
export function drawBlueStake(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 160);
  wobblyLine(g, rng, 48, 150, 50 + (rng.next() * 6 - 3), 36, 9, CLAY.light, 1.3, 4);
  // The blue band near the top.
  g.fillStyle = WATER.mid;
  g.fillRect(38, 48, 22, 16);
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.strokeRect(38, 48, 22, 16);
  // A short length of hose coiled at the foot.
  g.strokeStyle = WATER.deep;
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(48, 146, 24, 8, 0, 0, Math.PI * 2);
  g.stroke();
  return { canvas: c, aspect: 96 / 160 };
}

/** The stamped relay tag (~0.35 m) that does not belong at the lake — the
 *  garden's clue toward the camp: pine needles + a charcoal triangle mark. */
export function drawRelayTag(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 128);
  // A few pine needles.
  g.strokeStyle = SAGE.shade;
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = -0.4 + rng.next() * 0.8;
    g.beginPath();
    g.moveTo(40 + i * 10, 112);
    g.lineTo(40 + i * 10 + Math.sin(a) * 26, 86 + Math.cos(a) * 6);
    g.stroke();
  }
  // The tag.
  g.save();
  g.translate(64, 70);
  g.rotate(0.12);
  g.fillStyle = CLAY.pale;
  g.fillRect(-26, -18, 52, 36);
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.strokeRect(-26, -18, 52, 36);
  // The stamped triangle (charcoal — the camp's mark).
  g.strokeStyle = ROBOT.dark;
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(0, -9);
  g.lineTo(11, 9);
  g.lineTo(-11, 9);
  g.closePath();
  g.stroke();
  g.restore();
  // Tie string.
  g.strokeStyle = INK.soft;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(40, 58);
  g.quadraticCurveTo(28, 48, 30, 36);
  g.stroke();
  return { canvas: c, aspect: 1 };
}

// --- C. The Old Pine Relay Camp (accent: charcoal + triangles) ---------------

/**
 * The relay mast (~7.5 m): a narrow charcoal lattice mast with three offset
 * triangular vanes breaking the tree line. `awake` bakes one soft amber
 * breath dot at the crown and a faint warm wash — the slow 4–6 s breathing is
 * parallax through the pines, never a blink.
 */
export function drawRelayMast(seed: number, awake = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 960);
  const cx = 128;
  // Lattice: two rails + cross ties.
  wobblyLine(g, rng, cx - 14, 936, cx - 8, 72, 8, ROBOT.dark, 1.1, 6);
  wobblyLine(g, rng, cx + 14, 936, cx + 8, 72, 8, ROBOT.darkShade, 1.1, 6);
  g.strokeStyle = ROBOT.dark;
  g.lineWidth = 4;
  for (let y = 880; y > 100; y -= 64) {
    g.beginPath();
    g.moveTo(cx - 13, y);
    g.lineTo(cx + 13, y - 30);
    g.stroke();
  }
  // Three offset triangular vanes (the silhouette signature).
  const vanes: Array<[number, number, number]> = [
    [cx + 34, 180, 0.15],
    [cx - 36, 300, -0.25],
    [cx + 30, 430, 0.45],
  ];
  for (const [vx, vy, rot] of vanes) {
    g.save();
    g.translate(vx, vy);
    g.rotate(rot);
    g.beginPath();
    g.moveTo(0, -26);
    g.lineTo(30, 16);
    g.lineTo(-30, 16);
    g.closePath();
    g.fillStyle = awake ? ROBOT.dark : ROBOT.darkShade;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4;
    g.lineJoin = 'round';
    g.stroke();
    g.restore();
    // Strut back to the mast.
    g.strokeStyle = ROBOT.dark;
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(vx, vy + 8);
    g.lineTo(cx, vy + 34);
    g.stroke();
  }
  // Crown: the breath lamp.
  if (awake) {
    const halo = g.createRadialGradient(cx, 60, 4, cx, 60, 64);
    halo.addColorStop(0, LAMP_WARM);
    halo.addColorStop(1, 'rgba(233, 196, 124, 0)');
    g.fillStyle = halo;
    g.fillRect(cx - 64, 0, 128, 128);
  }
  g.fillStyle = awake ? '#f2d9a0' : ROBOT.darkShade;
  g.beginPath();
  g.arc(cx, 60, 9, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.stroke();
  // Guy rope.
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(cx + 10, 150);
  g.lineTo(cx + 86, 930);
  g.stroke();
  return { canvas: c, aspect: 256 / 960 };
}

/** A signal vane on a tripod (~1.3 m) — one of the two the player turns.
 *  `pos` is its bearing (0–2): the triangle pointer rotates between plates. */
export function drawSignalVane(seed: number, pos: 0 | 1 | 2): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 288);
  // Tripod.
  wobblyLine(g, rng, 96, 130, 64, 272, 7, ROBOT.dark, 1.2, 4);
  wobblyLine(g, rng, 96, 130, 128, 272, 7, ROBOT.darkShade, 1.2, 4);
  wobblyLine(g, rng, 96, 134, 96, 262, 6, ROBOT.dark, 1.2, 4);
  // Bearing plate with three notch ticks.
  blob(g, rng, 96, 128, 26, 10, { fill: CLAY.light, outline: INK.line, lineWidth: 3.5 }, 8, 0.08);
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  for (const a of [-0.7, 0, 0.7] as const) {
    g.beginPath();
    g.moveTo(96 + Math.sin(a) * 20, 124 - Math.cos(a) * 6);
    g.lineTo(96 + Math.sin(a) * 28, 124 - Math.cos(a) * 10);
    g.stroke();
  }
  // The triangle pointer at the chosen bearing.
  const rot = (pos - 1) * 0.7;
  g.save();
  g.translate(96, 92);
  g.rotate(rot);
  g.beginPath();
  g.moveTo(0, -42);
  g.lineTo(24, 10);
  g.lineTo(-24, 10);
  g.closePath();
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.lineJoin = 'round';
  g.stroke();
  g.restore();
  return { canvas: c, aspect: 192 / 288 };
}

/** The camp's tool shelter (~2 m): a charcoal-roofed lean shelter with a
 *  triangle pediment mark — quiet, weathered, kept. */
export function drawToolShelter(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(448, 384);
  // Posts.
  wobblyLine(g, rng, 96, 364, 94, 150, 12, CLAY.deep, 1.4, 5);
  wobblyLine(g, rng, 352, 364, 356, 150, 12, CLAY.mid, 1.4, 5);
  // Charcoal roof slab.
  g.beginPath();
  g.moveTo(56, 156);
  g.lineTo(392, 156);
  g.lineTo(366, 96);
  g.lineTo(82, 96);
  g.closePath();
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // The pediment triangle mark.
  g.strokeStyle = CLAY.pale;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(224, 108);
  g.lineTo(238, 134);
  g.lineTo(210, 134);
  g.closePath();
  g.stroke();
  // A shelf of resting tools.
  g.beginPath();
  g.moveTo(120, 268);
  g.lineTo(330, 272);
  g.lineTo(328, 290);
  g.lineTo(122, 286);
  g.closePath();
  g.fillStyle = CLAY.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.stroke();
  for (const [x, h] of [
    [160, 44],
    [206, 36],
    [262, 50],
  ] as const) {
    wobblyLine(g, rng, x, 268, x + 3, 268 - h, 6, CLAY.deep, 1.2, 3);
  }
  return { canvas: c, aspect: 448 / 384 };
}

/** A wound cable spool (~1 m) resting by the camp. */
export function drawCableSpool(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(224, 224);
  // Two flanges + the wound middle.
  for (const x of [70, 154] as const) {
    g.beginPath();
    g.ellipse(x, 140, 22, 58, 0, 0, Math.PI * 2);
    g.fillStyle = CLAY.light;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4.5;
    g.stroke();
  }
  g.fillStyle = ROBOT.darkShade;
  g.fillRect(70, 96, 84, 88);
  g.strokeStyle = INK.line;
  g.lineWidth = 3;
  g.strokeRect(70, 96, 84, 88);
  // Cable wraps.
  g.strokeStyle = ROBOT.dark;
  g.lineWidth = 3.5;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(72, 104 + i * 16);
    g.lineTo(152, 108 + i * 16);
    g.stroke();
  }
  // A loose end trailing to the ground.
  g.beginPath();
  g.moveTo(152, 180);
  g.quadraticCurveTo(196, 196, 206, 212);
  g.stroke();
  blob(g, rng, 110, 206, 56, 9, { fill: CLAY.pale, outline: INK.soft, lineWidth: 2.5 }, 8, 0.12);
  return { canvas: c, aspect: 1 };
}

/** The relay field case (~0.55 m): a narrow manufactured metal case in the
 *  pine hollow — it only reads as out-of-place once you're close. */
export function drawFieldCase(seed: number, open = false): PropSprite {
  void seed; // stateless plate
  const { c, g } = sprite(256, 176);
  if (!open) {
    // Closed: a slim ribbed case with two latches and a stenciled triangle.
    g.beginPath();
    g.moveTo(40, 92);
    g.lineTo(216, 92);
    g.lineTo(212, 152);
    g.lineTo(44, 152);
    g.closePath();
    g.fillStyle = ROBOT.dark;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4.5;
    g.lineJoin = 'round';
    g.stroke();
    g.strokeStyle = ROBOT.darkShade;
    g.lineWidth = 3;
    for (const x of [80, 128, 176] as const) {
      g.beginPath();
      g.moveTo(x, 96);
      g.lineTo(x, 148);
      g.stroke();
    }
    for (const x of [104, 152] as const) {
      g.fillStyle = CLAY.pale;
      g.fillRect(x - 6, 88, 12, 10);
      g.strokeStyle = INK.line;
      g.lineWidth = 2.5;
      g.strokeRect(x - 6, 88, 12, 10);
    }
    g.strokeStyle = CLAY.pale;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(128, 112);
    g.lineTo(138, 130);
    g.lineTo(118, 130);
    g.closePath();
    g.stroke();
  } else {
    // Open: lid up, a soft warm interior, the fragment with the strange mark.
    g.beginPath();
    g.moveTo(44, 96);
    g.lineTo(212, 96);
    g.lineTo(208, 152);
    g.lineTo(48, 152);
    g.closePath();
    g.fillStyle = ROBOT.dark;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4.5;
    g.stroke();
    // Lid hinged up and back.
    g.beginPath();
    g.moveTo(52, 94);
    g.lineTo(96, 34);
    g.lineTo(224, 40);
    g.lineTo(204, 94);
    g.closePath();
    g.fillStyle = ROBOT.darkShade;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4;
    g.lineJoin = 'round';
    g.stroke();
    const halo = g.createRadialGradient(128, 96, 4, 128, 96, 54);
    halo.addColorStop(0, LAMP_WARM);
    halo.addColorStop(1, 'rgba(233, 196, 124, 0)');
    g.fillStyle = halo;
    g.fillRect(64, 56, 128, 72);
    // The fragment: a pale shard with an unfamiliar ring-and-notch mark.
    g.save();
    g.translate(128, 112);
    g.rotate(-0.1);
    g.fillStyle = CLAY.pale;
    g.fillRect(-24, -12, 48, 24);
    g.strokeStyle = INK.soft;
    g.lineWidth = 2.5;
    g.strokeRect(-24, -12, 48, 24);
    g.strokeStyle = ROBOT.dark;
    g.beginPath();
    g.arc(0, 0, 7, 0.6, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(5, -5);
    g.lineTo(10, -10);
    g.stroke();
    g.restore();
  }
  return { canvas: c, aspect: 256 / 176 };
}

/** A triangular waymark (~0.3 m) — charcoal triangles on pale chips winding
 *  the route into the camp (the approach breadcrumb). */
export function drawTriangleMark(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 96);
  // The chip it's painted on.
  blob(g, rng, 48, 66, 26, 14, { fill: CLAY.pale, outline: INK.soft, lineWidth: 2.5 }, 8, 0.14);
  g.strokeStyle = ROBOT.dark;
  g.lineWidth = 3.5;
  g.lineJoin = 'round';
  const rot = (rng.next() - 0.5) * 0.5;
  g.save();
  g.translate(48, 62);
  g.rotate(rot);
  g.beginPath();
  g.moveTo(0, -11);
  g.lineTo(10, 8);
  g.lineTo(-10, 8);
  g.closePath();
  g.stroke();
  g.restore();
  return { canvas: c, aspect: 1 };
}

// --- Area dressing (Phase 3) --------------------------------------------------
// Small supporting plates that spread each heart's character through its
// activity ring, so a landmark reads as a lived-in AREA rather than an
// isolated prop cluster. All low, quiet, one accent at most.

/** A stack of salvaged planks with a lashing strap (~0.6 m) — Commons. */
export function drawPlankStack(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(288, 160);
  const fills = [CLAY.light, CLAY.pale, CLAY.mid, CLAY.light];
  for (let i = 0; i < 4; i++) {
    const y = 128 - i * 22;
    const lean = (rng.next() - 0.5) * 8;
    g.save();
    g.translate(144 + lean, y);
    g.rotate((rng.next() - 0.5) * 0.05);
    g.fillStyle = fills[i];
    g.fillRect(-110 + i * 6, -10, 220 - i * 12, 20);
    g.strokeStyle = INK.line;
    g.lineWidth = 4;
    g.strokeRect(-110 + i * 6, -10, 220 - i * 12, 20);
    g.restore();
  }
  // The lashing strap over the pile.
  g.strokeStyle = INK.soft;
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(132, 42);
  g.quadraticCurveTo(144, 36, 158, 42);
  g.lineTo(150, 148);
  g.moveTo(138, 148);
  g.lineTo(132, 44);
  g.stroke();
  return { canvas: c, aspect: 288 / 160 };
}

/** A small supply crate with a stenciled mark (~0.55 m) — Commons / Camp. */
export function drawCrate(seed: number, mark: 'patch' | 'triangle' = 'patch'): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 176);
  g.save();
  g.translate(96, 110);
  g.rotate((rng.next() - 0.5) * 0.06);
  g.fillStyle = CLAY.light;
  g.fillRect(-62, -52, 124, 104);
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.strokeRect(-62, -52, 124, 104);
  // Slats.
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 3;
  for (const y of [-18, 16] as const) {
    g.beginPath();
    g.moveTo(-58, y);
    g.lineTo(58, y + 2);
    g.stroke();
  }
  if (mark === 'patch') {
    // A small sewn patch (the Commons' signature).
    g.fillStyle = SAGE.mid;
    g.fillRect(-18, -40, 36, 26);
    g.strokeStyle = INK.soft;
    g.lineWidth = 2.5;
    g.setLineDash([5, 4]);
    g.strokeRect(-15, -37, 30, 20);
    g.setLineDash([]);
  } else {
    // The camp's stenciled triangle.
    g.strokeStyle = ROBOT.dark;
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(0, -42);
    g.lineTo(13, -20);
    g.lineTo(-13, -20);
    g.closePath();
    g.stroke();
  }
  g.restore();
  return { canvas: c, aspect: 192 / 176 };
}

/** A coiled irrigation hose (~0.4 m) — Garden dressing. */
export function drawHoseCoil(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 128);
  g.strokeStyle = WATER.deep;
  g.lineWidth = 7;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(96, 92 - i * 7, 58 - i * 6, 20 - i * 3, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // The loose end heading off.
  g.beginPath();
  g.moveTo(150, 86);
  g.quadraticCurveTo(176 + rng.next() * 8, 92, 184, 110);
  g.stroke();
  // A pale wooden chock keeping it from rolling.
  blob(g, rng, 52, 108, 16, 8, { fill: CLAY.pale, outline: INK.line, lineWidth: 3 }, 7, 0.12);
  return { canvas: c, aspect: 192 / 128 };
}

/** A camp log seat (~0.5 m): a short log laid flat, sit-worn on top. */
export function drawLogSeat(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 128);
  // The log body.
  g.beginPath();
  g.moveTo(40, 64);
  g.lineTo(208, 60);
  g.quadraticCurveTo(230, 78, 208, 100);
  g.lineTo(40, 104);
  g.quadraticCurveTo(20, 82, 40, 64);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.lineJoin = 'round';
  g.stroke();
  // End grain.
  g.beginPath();
  g.ellipse(208, 80, 14, 21, 0, 0, Math.PI * 2);
  g.fillStyle = CLAY.pale;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.stroke();
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(208, 80, 7, 11, 0, 0, Math.PI * 2);
  g.stroke();
  // Sit-worn top: a paler band.
  g.save();
  g.globalAlpha = 0.55;
  blob(g, rng, 116, 66, 56, 8, { fill: CLAY.pale }, 8, 0.12);
  g.restore();
  // Bark ticks.
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) {
    const x = 56 + rng.next() * 120;
    g.beginPath();
    g.moveTo(x, 74 + rng.next() * 20);
    g.lineTo(x + 14, 76 + rng.next() * 20);
    g.stroke();
  }
  return { canvas: c, aspect: 2 };
}

/** A small donated windchime on a hook (~1.3 m) — appears at the Commons
 *  when the player donates a crafted chime (§9 intended first use). */
export function drawDonatedChime(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 320);
  // Hook post.
  wobblyLine(g, rng, 48, 304, 50, 80, 9, CLAY.deep, 1.4, 4);
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(50, 84);
  g.quadraticCurveTo(92, 64, 116, 88);
  g.stroke();
  // Strings + three hung pieces (slightly different from the trail chime —
  // it's the player's make).
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  for (const [x, y] of [
    [96, 150],
    [116, 172],
    [134, 142],
  ] as const) {
    g.beginPath();
    g.moveTo(x, 96);
    g.lineTo(x, y);
    g.stroke();
  }
  blob(g, rng, 96, 162, 8, 12, { fill: CLAY.blossom, outline: INK.line, lineWidth: 3 }, 8, 0.1);
  blob(g, rng, 116, 184, 8, 12, { fill: SAGE.mid, outline: INK.line, lineWidth: 3 }, 8, 0.1);
  blob(g, rng, 134, 154, 8, 12, { fill: CLAY.pale, outline: INK.line, lineWidth: 3 }, 8, 0.1);
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.arc(116, 184, 3, 0, Math.PI * 2);
  g.fill();
  return { canvas: c, aspect: 0.5 };
}

// --- The life layer (Phase 3+) ------------------------------------------------
// Special plants, quiet creatures, and one toy for Datou per area — the
// landmark's influence spreading into its surroundings. All static plates;
// presence comes from placement, never motion.

/** The Commons' trail-bloom (~0.5 m): cream petals around an amber heart —
 *  the volunteers' planting, growing only near the repair stop. */
export function drawTrailBloom(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 160);
  for (const [sx, h] of [
    [50, 64],
    [78, 52],
  ] as const) {
    wobblyLine(g, rng, sx, 148, sx + (rng.next() * 8 - 4), 148 - h, 3.5, SAGE.shade, 1, 4);
    const cx = sx + (rng.next() * 8 - 4);
    const cy = 148 - h - 6;
    g.fillStyle = CLAY.pale;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng.next() * 0.3;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 7, 4.5, a, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK.soft;
      g.lineWidth = 1.5;
      g.stroke();
    }
    g.fillStyle = ROBOT.accent;
    g.beginPath();
    g.arc(cx, cy, 4.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK.soft;
    g.lineWidth = 1.5;
    g.stroke();
  }
  return { canvas: c, aspect: 128 / 160 };
}

/** The garden's water iris (~0.65 m): one blue bloom over curving leaves —
 *  it only grows where the loop keeps the ground wet. */
export function drawWaterIris(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 192);
  // Curving leaves.
  g.strokeStyle = SAGE.deep;
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (const lean of [-26, -8, 14, 30] as const) {
    g.beginPath();
    g.moveTo(64, 180);
    g.quadraticCurveTo(64 + lean * 0.4, 120, 64 + lean, 78 + rng.next() * 18);
    g.stroke();
  }
  // The stem + bloom.
  wobblyLine(g, rng, 64, 180, 66, 58, 4, SAGE.shade, 1, 4);
  g.fillStyle = WATER.deep;
  for (const [dx, dy, rot] of [
    [-9, 2, -0.7],
    [9, 2, 0.7],
    [0, -8, 0],
  ] as const) {
    g.save();
    g.translate(66 + dx, 50 + dy);
    g.rotate(rot);
    g.beginPath();
    g.ellipse(0, 0, 6, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK.soft;
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }
  g.fillStyle = WATER.edge;
  g.beginPath();
  g.arc(66, 50, 3.5, 0, Math.PI * 2);
  g.fill();
  return { canvas: c, aspect: 128 / 192 };
}

/** The camp's ink-cap mushrooms (~0.4 m): charcoal caps on pale stems —
 *  the woods' answer to the relay's quiet character. */
export function drawInkcap(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 128);
  for (const [x, h, r] of [
    [44, 40, 17],
    [72, 54, 21],
    [96, 32, 13],
  ] as const) {
    const lean = (rng.next() - 0.5) * 8;
    // Stem.
    g.fillStyle = CLAY.pale;
    g.beginPath();
    g.moveTo(x - 4, 118);
    g.lineTo(x - 3 + lean, 118 - h);
    g.lineTo(x + 3 + lean, 118 - h);
    g.lineTo(x + 4, 118);
    g.closePath();
    g.fill();
    g.strokeStyle = INK.soft;
    g.lineWidth = 2;
    g.stroke();
    // Tall charcoal cap.
    g.fillStyle = ROBOT.dark;
    g.beginPath();
    g.ellipse(x + lean, 118 - h - 4, r, r * 1.15, 0, Math.PI, Math.PI * 2);
    g.closePath();
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 2.5;
    g.stroke();
    // Pale gill ticks at the rim.
    g.strokeStyle = CLAY.pale;
    g.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(x + lean + i * (r * 0.35), 118 - h - 3);
      g.lineTo(x + lean + i * (r * 0.4), 118 - h + 2);
      g.stroke();
    }
  }
  return { canvas: c, aspect: 1 };
}

/** A small perched bird (~0.4 m incl. its post) — the Commons' regular. */
export function drawPerchedBird(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 160);
  // Its fence-post perch.
  wobblyLine(g, rng, 64, 150, 65, 84, 9, CLAY.deep, 1.3, 4);
  // Body + head — sage with a clay breast.
  blob(g, rng, 64, 66, 19, 13, { fill: SAGE.mid, outline: INK.line, lineWidth: 3 }, 9, 0.08);
  blob(g, rng, 56, 60, 8, 7, { fill: CLAY.blossom }, 7, 0.1);
  g.fillStyle = SAGE.deep;
  g.beginPath();
  g.arc(78, 56, 8, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 2.5;
  g.stroke();
  // Beak, eye, tail.
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.moveTo(85, 55);
  g.lineTo(93, 57);
  g.lineTo(85, 59);
  g.closePath();
  g.fill();
  g.fillStyle = INK.line;
  g.beginPath();
  g.arc(80, 54, 1.6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(48, 64);
  g.lineTo(36, 56);
  g.stroke();
  return { canvas: c, aspect: 128 / 160 };
}

/** A dragonfly resting on a reed tip (~0.5 m) — the garden's visitor. */
export function drawDragonfly(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 176);
  // The reed it rests on.
  wobblyLine(g, rng, 56, 168, 62, 64, 3.5, SAGE.mid, 1, 4);
  // Body — a thin water-blue line with a small head.
  g.save();
  g.translate(64, 52);
  g.rotate(0.35);
  g.strokeStyle = WATER.deep;
  g.lineWidth = 3.5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(30, 0);
  g.stroke();
  g.fillStyle = WATER.deep;
  g.beginPath();
  g.arc(-2, 0, 4, 0, Math.PI * 2);
  g.fill();
  // Two wing pairs — pale, half-transparent ellipses.
  g.globalAlpha = 0.55;
  g.fillStyle = CLAY.pale;
  for (const [dx, rot] of [
    [6, -0.9],
    [6, 0.9],
    [13, -0.75],
    [13, 0.75],
  ] as const) {
    g.save();
    g.translate(dx, 0);
    g.rotate(rot);
    g.beginPath();
    g.ellipse(0, -10, 4.5, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
  g.restore();
  return { canvas: c, aspect: 128 / 176 };
}

/** A sitting squirrel (~0.45 m) — the camp's small tenant. */
export function drawSquirrel(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 144);
  // The big curled tail behind.
  g.strokeStyle = CLAY.mid;
  g.lineWidth = 13;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(44, 124);
  g.quadraticCurveTo(20, 96, 34, 64);
  g.quadraticCurveTo(42, 46, 56, 54);
  g.stroke();
  // Body sitting up.
  blob(g, rng, 70, 102, 19, 24, { fill: CLAY.light, outline: INK.line, lineWidth: 3 }, 9, 0.08);
  // Head + ear.
  blob(g, rng, 76, 68, 12, 11, { fill: CLAY.light, outline: INK.line, lineWidth: 3 }, 8, 0.08);
  g.fillStyle = CLAY.mid;
  g.beginPath();
  g.ellipse(70, 56, 4, 6, -0.2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.soft;
  g.lineWidth = 1.5;
  g.stroke();
  // Eye + nose + paws holding a pinecone.
  g.fillStyle = INK.line;
  g.beginPath();
  g.arc(80, 66, 1.8, 0, Math.PI * 2);
  g.fill();
  blob(g, rng, 84, 92, 7, 9, { fill: CLAY.deep, outline: INK.soft, lineWidth: 2 }, 7, 0.1);
  return { canvas: c, aspect: 128 / 144 };
}

/** Datou's toy at the Commons (~0.45 m): a patchwork ball the volunteers
 *  stitched from fence-cloth scraps — one amber patch, of course. */
export function drawPatchBall(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 128);
  blob(g, rng, 64, 84, 30, 28, { fill: CLAY.pale, outline: INK.line, lineWidth: 4 }, 10, 0.04);
  // Stitched seams.
  g.strokeStyle = INK.soft;
  g.lineWidth = 2;
  g.setLineDash([4, 3]);
  g.beginPath();
  g.moveTo(38, 70);
  g.quadraticCurveTo(64, 84, 90, 70);
  g.moveTo(40, 100);
  g.quadraticCurveTo(64, 86, 88, 100);
  g.stroke();
  g.setLineDash([]);
  // Two cloth patches — sage and the amber one.
  g.save();
  g.translate(52, 76);
  g.rotate(-0.3);
  g.fillStyle = SAGE.mid;
  g.fillRect(-8, -7, 16, 14);
  g.restore();
  g.save();
  g.translate(76, 92);
  g.rotate(0.25);
  g.fillStyle = ROBOT.accent;
  g.fillRect(-7, -6, 14, 12);
  g.restore();
  return { canvas: c, aspect: 1 };
}

/** Datou's toy at the garden (~0.45 m): a woven reed splash-ring resting at
 *  the water's edge. */
export function drawReedRing(seed: number): PropSprite {
  void seed; // fully authored plate
  const { c, g } = sprite(128, 112);
  // A small puddle gleam under it.
  g.fillStyle = WATER.edge;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.ellipse(64, 92, 38, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  // The woven ring, slightly tilted.
  g.save();
  g.translate(64, 72);
  g.rotate(-0.12);
  g.strokeStyle = SAGE.deep;
  g.lineWidth = 11;
  g.beginPath();
  g.ellipse(0, 0, 34, 17, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = SAGE.light;
  g.lineWidth = 2.5;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * 28, Math.sin(a) * 13);
    g.lineTo(Math.cos(a + 0.3) * 40, Math.sin(a + 0.3) * 20);
    g.stroke();
  }
  // One blue wrap (the garden's color).
  g.strokeStyle = WATER.mid;
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(0, 0, 34, 17, 0, -0.5, 0.4);
  g.stroke();
  g.restore();
  g.strokeStyle = INK.soft;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(64, 72, 36, 19, -0.12, 0, Math.PI * 2);
  g.stroke();
  return { canvas: c, aspect: 128 / 112 };
}

/** Datou's toy at the camp (~0.7 m): a salvaged signal bell on a stand —
 *  boop it and it answers. */
export function drawEchoBell(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 208);
  // Stand.
  wobblyLine(g, rng, 64, 196, 64, 60, 7, ROBOT.dark, 1.2, 4);
  blob(g, rng, 64, 196, 26, 8, { fill: ROBOT.darkShade, outline: INK.line, lineWidth: 3 }, 8, 0.08);
  // Curved hanger arm.
  g.strokeStyle = ROBOT.dark;
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(64, 62);
  g.quadraticCurveTo(92, 52, 98, 74);
  g.stroke();
  // The bell — pale metal with a charcoal triangle stamp.
  g.beginPath();
  g.moveTo(82, 78);
  g.quadraticCurveTo(98, 70, 114, 78);
  g.lineTo(110, 108);
  g.quadraticCurveTo(98, 116, 86, 108);
  g.closePath();
  g.fillStyle = CLAY.pale;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.lineJoin = 'round';
  g.stroke();
  g.strokeStyle = ROBOT.dark;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(98, 86);
  g.lineTo(104, 98);
  g.lineTo(92, 98);
  g.closePath();
  g.stroke();
  // Clapper cord, reachable at Datou height.
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(98, 112);
  g.lineTo(96, 138);
  g.stroke();
  blob(g, rng, 96, 144, 6, 6, { fill: CLAY.mid, outline: INK.line, lineWidth: 2.5 }, 7, 0.1);
  return { canvas: c, aspect: 128 / 208 };
}

// --- D. The Ruin Stones (accent: pale stone + the ring-and-notch mark) -------

/**
 * The marked standing stone (~1.9 m): the tallest ruin stone carries the
 * ring-and-notch mark the relay fragment wears. Faint and lichen-grown until
 * traced; chalk-bright after the player and Datou rub it through.
 */
export function drawMarkedStone(seed: number, traced: boolean): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 384);
  // The stone — a tall weathered slab.
  g.beginPath();
  g.moveTo(86, 368);
  g.quadraticCurveTo(70, 220, 96, 78);
  g.quadraticCurveTo(128, 52, 162, 84);
  g.quadraticCurveTo(186, 230, 172, 368);
  g.closePath();
  g.fillStyle = CLAY.pale;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Weather cracks + lichen.
  g.strokeStyle = CLAY.mid;
  g.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const x = 100 + rng.next() * 56;
    wobblyLine(g, rng, x, 120 + rng.next() * 60, x + 8, 240 + rng.next() * 80, 2, CLAY.mid, 1, 4);
  }
  blob(g, rng, 110, 150, 16, 11, { fill: SAGE.light }, 8, 0.2);
  blob(g, rng, 156, 300, 13, 9, { fill: SAGE.light }, 8, 0.2);
  // The ring-and-notch mark.
  g.strokeStyle = traced ? '#fbf7ec' : CLAY.mid;
  g.lineWidth = traced ? 6 : 3.5;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(128, 210, 26, 0.6, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(146, 192);
  g.lineTo(164, 174);
  g.stroke();
  if (traced) {
    // Chalk dust settled below the rubbing.
    g.globalAlpha = 0.4;
    blob(g, rng, 128, 250, 22, 6, { fill: '#fbf7ec' }, 8, 0.2);
    g.globalAlpha = 1;
  }
  return { canvas: c, aspect: 256 / 384 };
}

/** The fallen lintel (~0.7 m): a long capstone lying where it fell — the
 *  satchel coffer shelters beneath it. */
export function drawFallenLintel(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(384, 160);
  g.save();
  g.translate(192, 96);
  g.rotate(-0.06);
  g.beginPath();
  g.moveTo(-160, -26);
  g.lineTo(158, -34);
  g.lineTo(164, 22);
  g.lineTo(-154, 30);
  g.closePath();
  g.fillStyle = CLAY.pale;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Edge chips + a faint twin of the ring mark.
  g.strokeStyle = CLAY.mid;
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(-80, -2, 13, 0.6, Math.PI * 2);
  g.stroke();
  g.restore();
  blob(g, rng, 80, 134, 30, 9, { fill: SAGE.light }, 9, 0.18);
  return { canvas: c, aspect: 384 / 160 };
}

/** Moon-fern (~0.45 m): the pale fern that grows only among the old stones. */
export function drawMoonFern(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 144);
  g.strokeStyle = SAGE.light;
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (const lean of [-22, -6, 12, 26] as const) {
    const tip = 50 + rng.next() * 16;
    g.beginPath();
    g.moveTo(64, 134);
    g.quadraticCurveTo(64 + lean * 0.5, 100, 64 + lean, tip);
    g.stroke();
    // Paired pale leaflets up the frond.
    g.fillStyle = '#dde2cd';
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const x = 64 + lean * 0.5 * t + lean * t * t * 0.5;
      const y = 134 - (134 - tip) * t;
      g.beginPath();
      g.ellipse(x - 5, y, 5, 2.6, -0.5, 0, Math.PI * 2);
      g.ellipse(x + 5, y, 5, 2.6, 0.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  return { canvas: c, aspect: 128 / 144 };
}

/** A moth resting on a stone chip (~0.3 m) — the ruins' quiet tenant. */
export function drawMoth(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 96);
  blob(g, rng, 48, 74, 22, 9, { fill: CLAY.pale, outline: INK.soft, lineWidth: 2.5 }, 8, 0.12);
  // Wings — two soft cream triangles with one ink eye-dot each.
  g.save();
  g.translate(48, 58);
  for (const side of [-1, 1] as const) {
    g.beginPath();
    g.moveTo(0, 2);
    g.lineTo(side * 22, -10);
    g.lineTo(side * 14, 8);
    g.closePath();
    g.fillStyle = '#efe8d6';
    g.fill();
    g.strokeStyle = INK.soft;
    g.lineWidth = 2;
    g.lineJoin = 'round';
    g.stroke();
    g.fillStyle = INK.soft;
    g.beginPath();
    g.arc(side * 13, -2, 1.8, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = CLAY.mid;
  g.beginPath();
  g.ellipse(0, 1, 3, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  return { canvas: c, aspect: 1 };
}

/** Datou's toy at the ruins (~0.4 m): a smooth stone orb worn round by
 *  generations of park robots rolling it about. */
export function drawStoneOrb(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 96);
  blob(g, rng, 48, 60, 26, 24, { fill: CLAY.pale, outline: INK.line, lineWidth: 4 }, 11, 0.03);
  // Its own tiny ring-and-notch, worn shallow.
  g.strokeStyle = CLAY.mid;
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(48, 58, 11, 0.6, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(56, 50);
  g.lineTo(63, 43);
  g.stroke();
  return { canvas: c, aspect: 1 };
}

// --- E. The Watchers' Knoll (accent: sky-pale + wings) ------------------------

/** The watch post (~2.2 m): a leaning post with the watchers' bird board —
 *  silhouettes of the species seen from this rise. */
export function drawWatchPost(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 448);
  wobblyLine(g, rng, 128, 432, 138, 80, 13, CLAY.deep, 1.4, 5);
  // The board.
  g.save();
  g.translate(128, 150);
  g.rotate(-0.05);
  g.fillStyle = CLAY.pale;
  g.fillRect(-86, -54, 172, 108);
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.strokeRect(-86, -54, 172, 108);
  // Bird silhouettes (simple ink curves) + tally ticks.
  g.strokeStyle = INK.soft;
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (const [bx, by, w] of [
    [-46, -22, 16],
    [8, -30, 13],
    [44, -14, 18],
    [-12, 6, 14],
  ] as const) {
    g.beginPath();
    g.moveTo(bx - w, by);
    g.quadraticCurveTo(bx - w / 2, by - 9, bx, by);
    g.quadraticCurveTo(bx + w / 2, by - 9, bx + w, by);
    g.stroke();
  }
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(-60 + i * 10, 34);
    g.lineTo(-62 + i * 10, 44);
    g.stroke();
  }
  g.restore();
  return { canvas: c, aspect: 256 / 448 };
}

/**
 * The spotting tube (~1.4 m): a long paper-and-brass tube on crossed legs.
 * Drooped and skyless until steadied; aimed up and true after the beat.
 */
export function drawSpotterTube(seed: number, aligned: boolean): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 288);
  // Crossed legs.
  wobblyLine(g, rng, 96, 272, 138, 150, 8, CLAY.deep, 1.3, 4);
  wobblyLine(g, rng, 170, 272, 130, 150, 8, CLAY.mid, 1.3, 4);
  // The tube.
  g.save();
  g.translate(134, 142);
  g.rotate(aligned ? -0.55 : 0.18);
  g.fillStyle = CLAY.light;
  g.fillRect(-64, -11, 128, 22);
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.strokeRect(-64, -11, 128, 22);
  // Brass rings + eyepiece.
  g.fillStyle = ROBOT.accent;
  g.fillRect(34, -12, 9, 24);
  g.fillStyle = ROBOT.dark;
  g.fillRect(-70, -8, 8, 16);
  g.strokeStyle = INK.line;
  g.lineWidth = 2.5;
  g.strokeRect(34, -12, 9, 24);
  g.strokeRect(-70, -8, 8, 16);
  g.restore();
  return { canvas: c, aspect: 256 / 288 };
}

/** The wheeling birds (~2.6 m plate): three swifts over the knoll once the
 *  tube is steadied — the completion made visible, far above head height. */
export function drawWheelingBirds(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 256);
  g.strokeStyle = INK.soft;
  g.lineCap = 'round';
  for (const [bx, by, w, lw] of [
    [78, 70, 22, 3.5],
    [150, 44, 17, 3],
    [188, 104, 13, 2.5],
    [120, 130, 10, 2],
  ] as const) {
    g.lineWidth = lw;
    const dip = 8 + rng.next() * 4;
    g.beginPath();
    g.moveTo(bx - w, by);
    g.quadraticCurveTo(bx - w / 2, by - dip, bx, by);
    g.quadraticCurveTo(bx + w / 2, by - dip, bx + w, by);
    g.stroke();
  }
  return { canvas: c, aspect: 1 };
}

/** Wind-grass (~0.7 m): tall seed-head grass that silvers the knoll. */
export function drawWindGrass(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 192);
  for (let i = 0; i < 5; i++) {
    const x = 30 + i * 17 + rng.next() * 8;
    const lean = (rng.next() - 0.3) * 26;
    const tip = 56 + rng.next() * 20;
    g.strokeStyle = i % 2 ? SAGE.light : '#c9c8a6';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, 182);
    g.quadraticCurveTo(x + lean * 0.4, 120, x + lean, tip);
    g.stroke();
    // The seed head — a soft pale brush.
    g.fillStyle = '#e6e0c4';
    g.beginPath();
    g.ellipse(x + lean, tip - 8, 5, 14, lean * 0.012, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK.soft;
    g.lineWidth = 1.2;
    g.stroke();
  }
  return { canvas: c, aspect: 128 / 192 };
}

/** Datou's toy at the knoll (~0.5 m): a feather wand the watchers lashed to
 *  a springy stick — irresistible. */
export function drawFeatherWand(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 160);
  wobblyLine(g, rng, 40, 150, 58, 52, 5, CLAY.deep, 1.2, 4);
  // Cord + three feathers.
  g.strokeStyle = INK.soft;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(58, 52);
  g.quadraticCurveTo(64, 60, 62, 70);
  g.stroke();
  for (const [fx, fy, rot, fill] of [
    [60, 84, 0.3, CLAY.pale],
    [70, 78, 0.7, SAGE.light],
    [52, 92, -0.1, CLAY.blossom],
  ] as const) {
    g.save();
    g.translate(fx, fy);
    g.rotate(rot);
    blob(g, rng, 0, 0, 6, 16, { fill, outline: INK.soft, lineWidth: 2 }, 8, 0.1);
    g.strokeStyle = INK.soft;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, -14);
    g.lineTo(0, 14);
    g.stroke();
    g.restore();
  }
  return { canvas: c, aspect: 96 / 160 };
}

// --- F. The Meadow Orchard (accent: blossom + planted rows) -------------------

/**
 * An orchard sapling (~1.9 m): a young fruit tree on its stake. `leaning`
 * is the one that slipped its tie (the activity); `blossom` dresses the
 * whole row once it's re-staked.
 */
export function drawSapling(seed: number, leaning: boolean, blossom: boolean): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(224, 384);
  const lean = leaning ? 34 : 4;
  // Trunk.
  g.strokeStyle = CLAY.mid;
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(112, 368);
  g.quadraticCurveTo(112 + lean * 0.5, 280, 112 + lean, 190);
  g.stroke();
  // The stake + tie (slack if leaning).
  wobblyLine(g, rng, 86, 368, 84, 210, 7, CLAY.deep, 1.2, 4);
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.beginPath();
  if (leaning) {
    g.moveTo(84, 250);
    g.quadraticCurveTo(100, 270, 112 + lean * 0.8, 240);
  } else {
    g.moveTo(84, 240);
    g.lineTo(112 + lean, 232);
  }
  g.stroke();
  // Crown — two small sage blobs.
  blob(g, rng, 112 + lean, 150, 52, 40, { fill: SAGE.mid, outline: INK.line, lineWidth: 4 }, 10, 0.12);
  blob(g, rng, 96 + lean, 120, 34, 26, { fill: SAGE.light }, 9, 0.12);
  if (blossom) {
    g.fillStyle = CLAY.blossom;
    for (let i = 0; i < 7; i++) {
      const a = rng.next() * Math.PI * 2;
      const d = rng.next() * 44;
      g.beginPath();
      g.arc(108 + lean + Math.cos(a) * d, 140 + Math.sin(a) * d * 0.7, 4.5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK.soft;
      g.lineWidth = 1.2;
      g.stroke();
    }
  }
  return { canvas: c, aspect: 224 / 384 };
}

/** The orchard water barrel (~0.95 m) with its dipper. */
export function drawWaterBarrel(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 224);
  // Staved body.
  g.beginPath();
  g.moveTo(52, 92);
  g.quadraticCurveTo(46, 150, 56, 204);
  g.lineTo(136, 204);
  g.quadraticCurveTo(146, 150, 140, 92);
  g.closePath();
  g.fillStyle = CLAY.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.stroke();
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 3;
  for (const x of [78, 100, 120] as const) {
    g.beginPath();
    g.moveTo(x, 94);
    g.lineTo(x - 2, 202);
    g.stroke();
  }
  // Hoops.
  g.strokeStyle = ROBOT.dark;
  g.lineWidth = 4;
  for (const y of [110, 182] as const) {
    g.beginPath();
    g.moveTo(48, y);
    g.lineTo(144, y + 2);
    g.stroke();
  }
  // Water surface + the dipper hung on the rim.
  g.beginPath();
  g.ellipse(96, 92, 44, 11, 0, 0, Math.PI * 2);
  g.fillStyle = WATER.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.stroke();
  wobblyLine(g, rng, 140, 96, 156, 60, 4, CLAY.deep, 1, 3);
  blob(g, rng, 158, 56, 9, 7, { fill: CLAY.pale, outline: INK.line, lineWidth: 2.5 }, 7, 0.1);
  return { canvas: c, aspect: 192 / 224 };
}

/** A painted row marker (~0.5 m): a short stake with a blossom-pink top
 *  band and a row number scratch. */
export function drawRowMarker(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 160);
  wobblyLine(g, rng, 48, 150, 50, 44, 8, CLAY.light, 1.2, 4);
  g.fillStyle = CLAY.blossom;
  g.fillRect(40, 44, 18, 14);
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.strokeRect(40, 44, 18, 14);
  // Scratch tallies.
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    g.moveTo(43 + i * 5, 70);
    g.lineTo(42 + i * 5, 82);
  }
  g.stroke();
  return { canvas: c, aspect: 96 / 160 };
}

/** A clover patch (~0.35 m): the orchard's ground cover, sown for the bees. */
export function drawCloverPatch(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 96);
  for (let i = 0; i < 6; i++) {
    const x = 20 + rng.next() * 88;
    const y = 56 + rng.next() * 28;
    const r = 5 + rng.next() * 3;
    g.fillStyle = i % 2 ? SAGE.mid : SAGE.light;
    for (const a of [0, 2.1, 4.2] as const) {
      g.beginPath();
      g.arc(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.55, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  // One lucky blossom.
  g.fillStyle = CLAY.blossom;
  g.beginPath();
  g.arc(64 + (rng.next() * 30 - 15), 52, 4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.soft;
  g.lineWidth = 1.5;
  g.stroke();
  return { canvas: c, aspect: 128 / 96 };
}

/** Two butterflies over a grass stem (~0.5 m) — the orchard's pollinators. */
export function drawButterflies(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 160);
  wobblyLine(g, rng, 56, 150, 62, 84, 3, SAGE.mid, 1, 4);
  for (const [bx, by, sc, fill] of [
    [62, 64, 1, CLAY.blossom],
    [92, 92, 0.7, CLAY.pale],
  ] as const) {
    g.save();
    g.translate(bx, by);
    g.scale(sc, sc);
    for (const side of [-1, 1] as const) {
      g.beginPath();
      g.ellipse(side * 8, -3, 8, 11, side * 0.5, 0, Math.PI * 2);
      g.fillStyle = fill;
      g.fill();
      g.strokeStyle = INK.soft;
      g.lineWidth = 2;
      g.stroke();
    }
    g.fillStyle = INK.soft;
    g.beginPath();
    g.ellipse(0, 0, 2.2, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  return { canvas: c, aspect: 128 / 160 };
}

/** Datou's toy at the orchard (~0.35 m): a dried seed-pod rattle on a cord. */
export function drawSeedRattle(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 112);
  // The cord loop.
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.beginPath();
  g.ellipse(48, 38, 18, 12, 0.2, 0, Math.PI * 2);
  g.stroke();
  // Three pods.
  for (const [px, py, rot] of [
    [36, 68, -0.3],
    [52, 76, 0.1],
    [64, 64, 0.5],
  ] as const) {
    g.save();
    g.translate(px, py);
    g.rotate(rot);
    blob(g, rng, 0, 0, 9, 14, { fill: CLAY.light, outline: INK.line, lineWidth: 3 }, 8, 0.1);
    g.fillStyle = CLAY.deep;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(-2 + i * 3, -4 + i * 4, 1.5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  return { canvas: c, aspect: 96 / 112 };
}
