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
