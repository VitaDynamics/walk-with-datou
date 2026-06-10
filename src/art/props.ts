/**
 * Cutout prop sprites — every world object is a hand-drawn plate.
 *
 * Each function paints onto a transparent canvas and returns it; the world
 * layer (Diorama) billboards them on planes. All take a seed so each placed
 * instance can be a unique-but-deterministic variation.
 */

import { Rng } from '../physics/mujoco/rng';
import { CLAY, GROUND, INK, LAMP_WARM, ROBOT, SAGE } from './palette';
import { blob, grassStroke, paintBlob, blobPoints, speckle, wobblyLine } from './strokes';
import { createCanvas, ctx2d } from './textures';

export interface PropSprite {
  canvas: HTMLCanvasElement;
  /** Width / height — used to keep world planes in proportion. */
  aspect: number;
}

function sprite(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = createCanvas(w, h);
  return { c, g: ctx2d(c) };
}

const OUT = { outline: INK.line, lineWidth: 5 };

/** A round-canopy glade tree: clay trunk, two-three stacked sage blobs. */
export function drawTree(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(512, 640);

  // Trunk — tapered, hand-wobbled silhouette.
  const baseY = 612;
  const topY = 330;
  const cx = 256 + (rng.next() * 2 - 1) * 14;
  g.beginPath();
  g.moveTo(cx - 38, baseY);
  g.quadraticCurveTo(cx - 20 + (rng.next() * 8 - 4), (baseY + topY) / 2, cx - 16, topY);
  g.lineTo(cx + 16, topY);
  g.quadraticCurveTo(cx + 22 + (rng.next() * 8 - 4), (baseY + topY) / 2, cx + 40, baseY);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Bark detail strokes.
  for (let i = 0; i < 4; i++) {
    const x = cx - 14 + rng.next() * 28;
    wobblyLine(
      g,
      rng,
      x,
      baseY - 16,
      x + (rng.next() * 10 - 5),
      topY + 60 + rng.next() * 80,
      2.5,
      CLAY.deep,
      2,
      4,
    );
  }

  // Canopy — overlapping blobs, dark below, light above (baked shading).
  blob(g, rng, 256, 250, 195, 150, { fill: SAGE.deep, ...OUT }, 12, 0.1);
  blob(g, rng, 200, 200, 120, 95, { fill: SAGE.mid }, 10, 0.12);
  blob(g, rng, 320, 190, 105, 85, { fill: SAGE.mid }, 10, 0.12);
  blob(g, rng, 250, 150, 110, 80, { fill: SAGE.light }, 10, 0.12);
  // A few leaf ticks.
  g.strokeStyle = SAGE.shade;
  g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.next() * 150;
    const x = 256 + Math.cos(a) * d;
    const y = 230 + Math.sin(a) * d * 0.7;
    g.save();
    g.globalAlpha = 0.5;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 6, y - 8, x + 12, y - 10);
    g.stroke();
    g.restore();
  }
  return { canvas: c, aspect: 512 / 640 };
}

/** Low rounded bush, two sage blobs with sparse blossom dots. */
export function drawBush(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(384, 288);
  blob(g, rng, 192, 190, 165, 88, { fill: SAGE.deep, ...OUT }, 12, 0.1);
  blob(g, rng, 150, 150, 95, 62, { fill: SAGE.mid }, 10, 0.13);
  blob(g, rng, 250, 145, 80, 55, { fill: SAGE.light }, 10, 0.13);
  for (let i = 0; i < 5; i++) {
    const x = 90 + rng.next() * 200;
    const y = 120 + rng.next() * 90;
    g.fillStyle = CLAY.blossom;
    g.beginPath();
    g.arc(x, y, 6 + rng.next() * 3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK.soft;
    g.lineWidth = 2;
    g.stroke();
  }
  return { canvas: c, aspect: 384 / 288 };
}

/** A weighty boulder with a mossy cap. */
export function drawRock(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(320, 256);
  const pts = blobPoints(rng, 160, 165, 130, 80, 9, 0.12);
  paintBlob(g, pts, { fill: CLAY.pale, ...OUT });
  // Shade the underside.
  g.save();
  g.globalAlpha = 0.5;
  blob(g, rng, 160, 205, 110, 38, { fill: CLAY.light }, 8, 0.15);
  g.restore();
  // Moss cap.
  blob(g, rng, 140, 105, 70, 28, { fill: SAGE.light }, 8, 0.2);
  // Cracks.
  wobblyLine(g, rng, 120, 140, 165, 195, 2.5, INK.soft, 2.5, 4);
  wobblyLine(g, rng, 205, 125, 225, 175, 2, INK.soft, 2, 4);
  speckle(g, rng, 60, 110, 200, 110, 26, INK.grain, 0.18, 1.8);
  return { canvas: c, aspect: 320 / 256 };
}

/** Small grass tuft (scatter detail — drawn cheap, placed often). */
export function drawGrassTuft(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 160);
  const baseY = 148;
  const blades = 6 + Math.floor(rng.next() * 4);
  for (let i = 0; i < blades; i++) {
    const x = 38 + rng.next() * 84;
    const lean = (rng.next() * 2 - 1) * 26;
    const tone = [SAGE.mid, SAGE.deep, SAGE.light][Math.floor(rng.next() * 3)];
    grassStroke(g, rng, x, baseY, 60 + rng.next() * 55, lean, 4.5, tone);
  }
  return { canvas: c, aspect: 1 };
}

/** A single stem flower in the clay-blossom family. */
export function drawFlower(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 192);
  const baseY = 182;
  const headX = 64 + (rng.next() * 2 - 1) * 10;
  const headY = 58 + rng.next() * 14;
  g.beginPath();
  g.moveTo(64, baseY);
  g.quadraticCurveTo(64 + (rng.next() * 2 - 1) * 18, (baseY + headY) / 2, headX, headY + 16);
  g.strokeStyle = SAGE.shade;
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.stroke();
  // Petals: 5 blobs around a clay center.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rng.next() * 0.4;
    blob(g, rng, headX + Math.cos(a) * 17, headY + Math.sin(a) * 17, 14, 11, {
      fill: CLAY.blossom,
      outline: INK.soft,
      lineWidth: 2.5,
    });
  }
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.arc(headX, headY, 8, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.stroke();
  return { canvas: c, aspect: 128 / 192 };
}

/** A sawn stump — a place for small discoveries. */
export function drawStump(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 224);
  // Body.
  g.beginPath();
  g.moveTo(54, 96);
  g.lineTo(48, 178);
  g.quadraticCurveTo(128, 206, 208, 178);
  g.lineTo(202, 96);
  g.closePath();
  g.fillStyle = CLAY.mid;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  // Top face with rings.
  blob(g, rng, 128, 92, 78, 30, { fill: CLAY.pale, ...OUT }, 10, 0.06);
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 2.5;
  for (const r of [0.65, 0.4, 0.18]) {
    g.beginPath();
    g.ellipse(128 + rng.next() * 6 - 3, 92, 78 * r, 30 * r, 0, 0, Math.PI * 2);
    g.stroke();
  }
  wobblyLine(g, rng, 80, 120, 84, 172, 2.5, CLAY.deep, 2, 4);
  wobblyLine(g, rng, 168, 122, 172, 170, 2.5, CLAY.deep, 2, 4);
  return { canvas: c, aspect: 256 / 224 };
}

/**
 * A small warm floor lamp — the diorama's key-light motivation and the one
 * "technology" prop (robotics-lab warmth). Glow is a soft baked halo.
 */
export function drawLamp(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 512);
  // Baked halo (soft, subtle — not bloom).
  const halo = g.createRadialGradient(128, 120, 6, 128, 120, 105);
  halo.addColorStop(0, LAMP_WARM);
  halo.addColorStop(1, 'rgba(233, 196, 124, 0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, 256, 280);
  // Stem.
  wobblyLine(g, rng, 128, 488, 126, 150, 7, ROBOT.dark, 1.2, 5);
  // Base.
  blob(g, rng, 128, 488, 52, 14, { fill: ROBOT.dark, outline: INK.line, lineWidth: 4 }, 8, 0.05);
  // Shade (paper cone) + warm bulb.
  g.beginPath();
  g.moveTo(76, 132);
  g.lineTo(180, 132);
  g.lineTo(160, 78);
  g.quadraticCurveTo(128, 68, 96, 78);
  g.closePath();
  g.fillStyle = CLAY.pale;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4.5;
  g.lineJoin = 'round';
  g.stroke();
  g.fillStyle = '#f2d9a0';
  g.beginPath();
  g.ellipse(128, 140, 38, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.stroke();
  return { canvas: c, aspect: 0.5 };
}

/**
 * The resting pad — "your spot" in the glade (a soft sensor mat, drawn as a
 * flat ground decal, not a billboard).
 */
export function drawPad(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(320, 256);
  const pts = blobPoints(rng, 160, 128, 130, 92, 12, 0.05);
  paintBlob(g, pts, { fill: CLAY.pale, outline: INK.line, lineWidth: 5 });
  const inner = blobPoints(rng, 160, 128, 104, 70, 12, 0.05);
  g.save();
  g.setLineDash([10, 9]);
  paintBlob(g, inner, { outline: CLAY.deep, lineWidth: 3 });
  g.restore();
  blob(g, rng, 160, 128, 16, 11, { fill: CLAY.light, outline: CLAY.deep, lineWidth: 2.5 }, 8, 0.08);
  return { canvas: c, aspect: 320 / 256 };
}

/** Conifer for the woods — stacked sage triangles, hand-cut. */
export function drawPine(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(384, 640);
  // Trunk.
  wobblyLine(g, rng, 192, 612, 190, 420, 16, CLAY.deep, 2, 4);
  // Three foliage tiers, widest at the bottom.
  const tiers: Array<[number, number, number, string]> = [
    [470, 150, 95, SAGE.deep],
    [350, 125, 85, SAGE.mid],
    [235, 95, 80, SAGE.light],
  ];
  for (const [y, rx, ry, tone] of tiers) {
    const cx = 192 + (rng.next() * 2 - 1) * 8;
    g.beginPath();
    g.moveTo(cx - rx, y + ry * 0.4);
    g.quadraticCurveTo(cx - rx * 0.3, y - ry * 0.5, cx, y - ry);
    g.quadraticCurveTo(cx + rx * 0.3, y - ry * 0.5, cx + rx, y + ry * 0.4);
    g.quadraticCurveTo(cx, y + ry * 0.62, cx - rx, y + ry * 0.4);
    g.closePath();
    g.fillStyle = tone;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.stroke();
  }
  return { canvas: c, aspect: 384 / 640 };
}

/** Lakeside reed clump — tall blades with seed heads. */
export function drawReed(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 320);
  const baseY = 306;
  for (let i = 0; i < 5; i++) {
    const x = 56 + rng.next() * 80;
    const lean = (rng.next() * 2 - 1) * 30;
    const h = 190 + rng.next() * 90;
    grassStroke(g, rng, x, baseY, h, lean, 5, i % 2 ? SAGE.deep : SAGE.mid);
    if (rng.next() < 0.6) {
      // Cattail head near the tip.
      const tipX = x + lean * 0.9;
      const tipY = baseY - h * 0.92;
      g.fillStyle = CLAY.deep;
      g.beginPath();
      g.ellipse(tipX, tipY, 7, 20, lean * 0.004, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK.soft;
      g.lineWidth = 2.5;
      g.stroke();
    }
  }
  return { canvas: c, aspect: 192 / 320 };
}

/** Standalone woods mushroom (bigger cousin of the discovery icon). */
export function drawMushroom(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 160);
  const baseY = 148;
  g.fillStyle = CLAY.pale;
  g.beginPath();
  g.moveTo(64, baseY);
  g.lineTo(68, 88);
  g.lineTo(94, 88);
  g.lineTo(98, baseY);
  g.closePath();
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.stroke();
  blob(g, rng, 80, 76, 52, 30, { fill: CLAY.blossom, outline: INK.line, lineWidth: 4.5 }, 9, 0.08);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = CLAY.pale;
    g.beginPath();
    g.arc(48 + i * 22 + rng.next() * 8, 66 + rng.next() * 14, 5, 0, Math.PI * 2);
    g.fill();
  }
  return { canvas: c, aspect: 1 };
}

/** Trail bench — weathered clay planks, side-on. */
export function drawBench(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(384, 224);
  g.lineJoin = 'round';
  // Legs.
  for (const x of [70, 300]) {
    wobblyLine(g, rng, x, 210, x + 4, 120, 12, CLAY.deep, 1.5, 3);
  }
  // Seat planks.
  for (const [y, h] of [
    [118, 26],
    [88, 20],
  ] as const) {
    g.beginPath();
    g.moveTo(34, y);
    g.lineTo(350, y - 4);
    g.lineTo(350, y - 4 + h);
    g.lineTo(34, y + h);
    g.closePath();
    g.fillStyle = CLAY.light;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4.5;
    g.stroke();
  }
  // Grain ticks.
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const x = 70 + rng.next() * 240;
    g.beginPath();
    g.moveTo(x, 124);
    g.lineTo(x + 18, 123);
    g.stroke();
  }
  return { canvas: c, aspect: 384 / 224 };
}

/** Hand-painted signpost — a clay post with a sage arrow board. */
export function drawSignpost(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(224, 352);
  wobblyLine(g, rng, 112, 340, 110, 70, 13, CLAY.deep, 1.5, 4);
  // Arrow board.
  const dir = rng.next() < 0.5 ? 1 : -1;
  g.save();
  g.translate(112, 110);
  g.scale(dir, 1);
  g.beginPath();
  g.moveTo(-72, -26);
  g.lineTo(48, -26);
  g.lineTo(76, 0);
  g.lineTo(48, 26);
  g.lineTo(-72, 26);
  g.closePath();
  g.fillStyle = SAGE.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Carved text ticks.
  g.strokeStyle = INK.soft;
  g.lineWidth = 3.5;
  for (const [x, w] of [
    [-56, 36],
    [-10, 28],
  ] as const) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + w, 0);
    g.stroke();
  }
  g.restore();
  return { canvas: c, aspect: 224 / 352 };
}

// --- Pickable resources (gatherable to the backpack) -------------------------

/** A dry twig on the ground. */
export function drawTwig(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 96);
  const y = 64 + rng.next() * 10;
  wobblyLine(g, rng, 18, y + 14, 110, y - 10, 6, CLAY.deep, 2.5, 5);
  wobblyLine(g, rng, 62, y + 2, 92, y - 26, 4, CLAY.deep, 2, 3);
  return { canvas: c, aspect: 128 / 96 };
}

/** A smooth pebble. */
export function drawPebble(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 80);
  blob(g, rng, 48, 48, 30, 20, { fill: CLAY.pale, outline: INK.line, lineWidth: 3.5 }, 8, 0.1);
  g.save();
  g.globalAlpha = 0.5;
  blob(g, rng, 42, 42, 12, 7, { fill: '#ffffff' }, 7, 0.15);
  g.restore();
  return { canvas: c, aspect: 96 / 80 };
}

/** A low berry sprig. */
export function drawBerry(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 128);
  const baseY = 118;
  grassStroke(g, rng, 64, baseY, 64, -10, 4, SAGE.shade);
  grassStroke(g, rng, 68, baseY, 56, 16, 4, SAGE.shade);
  for (let i = 0; i < 4; i++) {
    const x = 44 + rng.next() * 44;
    const y = 48 + rng.next() * 28;
    g.fillStyle = CLAY.blossom;
    g.beginPath();
    g.arc(x, y, 8 + rng.next() * 3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK.soft;
    g.lineWidth = 2.5;
    g.stroke();
  }
  return { canvas: c, aspect: 1 };
}

/** A fallen pinecone. */
export function drawPinecone(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(96, 96);
  blob(g, rng, 48, 56, 22, 30, { fill: CLAY.mid, outline: INK.line, lineWidth: 3.5 }, 9, 0.1);
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 2.5;
  for (let row = 0; row < 3; row++) {
    const y = 40 + row * 14;
    g.beginPath();
    g.moveTo(32, y);
    g.quadraticCurveTo(48, y + 8, 64, y);
    g.stroke();
  }
  return { canvas: c, aspect: 1 };
}

// --- Crafted things ----------------------------------------------------------

/** The fetch stick — sturdier than a twig, clearly a toy. */
export function drawStick(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 96);
  wobblyLine(g, rng, 16, 62, 144, 40, 9, CLAY.deep, 2, 5);
  wobblyLine(g, rng, 100, 48, 128, 22, 6, CLAY.deep, 1.5, 3);
  // A wrap of cord at the grip.
  g.strokeStyle = CLAY.light;
  g.lineWidth = 4;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(34 + i * 7, 52);
    g.lineTo(36 + i * 7, 68);
    g.stroke();
  }
  return { canvas: c, aspect: 160 / 96 };
}

/** A little stacked-stone cairn — a keepsake marking a walk. */
export function drawCairn(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 192);
  const stones: Array<[number, number, number]> = [
    [96, 46, 30],
    [76, 30, 96],
    [54, 22, 140],
  ];
  let y = 168;
  for (const [rx, ry, _] of stones) {
    void _;
    y -= ry * 1.35;
    blob(g, rng, 80 + (rng.next() * 2 - 1) * 6, y + ry * 0.4, rx, ry, {
      fill: CLAY.pale,
      outline: INK.line,
      lineWidth: 4,
    });
  }
  return { canvas: c, aspect: 160 / 192 };
}

/** A flower garland plate (worn around Datou's neck). */
export function drawGarland(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 96);
  g.strokeStyle = SAGE.shade;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(16, 36);
  g.quadraticCurveTo(96, 84, 176, 36);
  g.stroke();
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    const x = 16 + t * 160;
    const y = 36 + Math.sin(t * Math.PI) * 42;
    blob(g, rng, x, y, 11, 9, { fill: CLAY.blossom, outline: INK.soft, lineWidth: 2.5 }, 7, 0.12);
    g.fillStyle = ROBOT.accent;
    g.beginPath();
    g.arc(x, y, 3.5, 0, Math.PI * 2);
    g.fill();
  }
  return { canvas: c, aspect: 2 };
}

// --- Discovery reveal icons -------------------------------------------------

export type DiscoveryArt = 'sprout' | 'shiny' | 'feather' | 'mushroom' | 'ladybug';

/** Tiny hand-drawn icon that appears in the world when a spot is discovered. */
export function drawDiscovery(kind: DiscoveryArt, seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 128);
  const baseY = 118;
  switch (kind) {
    case 'sprout': {
      g.strokeStyle = SAGE.shade;
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(64, baseY);
      g.quadraticCurveTo(62, 88, 64, 70);
      g.stroke();
      blob(g, rng, 46, 62, 18, 10, { fill: SAGE.light, outline: INK.soft, lineWidth: 2.5 }, 8, 0.1);
      blob(g, rng, 82, 58, 18, 10, { fill: SAGE.mid, outline: INK.soft, lineWidth: 2.5 }, 8, 0.1);
      break;
    }
    case 'shiny': {
      blob(g, rng, 64, 98, 30, 20, { fill: CLAY.light, outline: INK.line, lineWidth: 3.5 }, 8, 0.1);
      g.strokeStyle = ROBOT.accent;
      g.lineWidth = 3;
      g.lineCap = 'round';
      for (const [dx, dy] of [
        [-26, -34],
        [0, -42],
        [26, -34],
      ] as const) {
        g.beginPath();
        g.moveTo(64 + dx * 0.45, 86 + dy * 0.45);
        g.lineTo(64 + dx, 86 + dy);
        g.stroke();
      }
      break;
    }
    case 'feather': {
      g.save();
      g.translate(64, 64);
      g.rotate(-0.5);
      blob(g, rng, 0, 0, 14, 44, { fill: CLAY.pale, outline: INK.line, lineWidth: 3 }, 10, 0.08);
      wobblyLine(g, rng, 0, 44, 0, -40, 2, INK.soft, 1, 5);
      g.restore();
      break;
    }
    case 'mushroom': {
      g.fillStyle = CLAY.pale;
      g.beginPath();
      g.moveTo(52, baseY - 4);
      g.lineTo(54, 78);
      g.lineTo(74, 78);
      g.lineTo(76, baseY - 4);
      g.closePath();
      g.fill();
      g.strokeStyle = INK.line;
      g.lineWidth = 3;
      g.stroke();
      blob(
        g,
        rng,
        64,
        70,
        36,
        22,
        { fill: CLAY.blossom, outline: INK.line, lineWidth: 3.5 },
        9,
        0.08,
      );
      for (let i = 0; i < 3; i++) {
        g.fillStyle = CLAY.pale;
        g.beginPath();
        g.arc(44 + i * 20 + rng.next() * 6, 62 + rng.next() * 10, 4, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'ladybug': {
      blob(
        g,
        rng,
        64,
        92,
        24,
        17,
        { fill: CLAY.blossom, outline: INK.line, lineWidth: 3.5 },
        9,
        0.06,
      );
      g.strokeStyle = INK.line;
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(64, 76);
      g.lineTo(64, 108);
      g.stroke();
      g.fillStyle = INK.line;
      for (const [dx, dy] of [
        [-10, -4],
        [9, -6],
        [-7, 6],
        [11, 5],
      ] as const) {
        g.beginPath();
        g.arc(64 + dx, 92 + dy, 3, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.arc(64, 73, 7, 0, Math.PI * 2);
      g.fill();
      break;
    }
  }
  // Common: a tiny ground tick under each icon.
  g.strokeStyle = GROUND.edge;
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(46, baseY + 4);
  g.lineTo(82, baseY + 4);
  g.stroke();
  return { canvas: c, aspect: 1 };
}
