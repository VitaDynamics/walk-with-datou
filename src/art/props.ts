/**
 * Cutout prop sprites — every world object is a hand-drawn plate.
 *
 * Each function paints onto a transparent canvas and returns it; the world
 * layer (Diorama) billboards them on planes. All take a seed so each placed
 * instance can be a unique-but-deterministic variation.
 */

import { Rng } from '../physics/mujoco/rng';
import { CLAY, GROUND, INK, LAMP_WARM, ROBOT, SAGE, WATER } from './palette';
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

// --- Farm & building ----------------------------------------------------------

/** Tilled garden plot (flat ground decal with till rows). */
export function drawSoil(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 208);
  const pts = blobPoints(rng, 128, 104, 112, 84, 11, 0.06);
  paintBlob(g, pts, { fill: CLAY.deep, outline: INK.line, lineWidth: 5 });
  const inner = blobPoints(rng, 128, 104, 96, 70, 11, 0.06);
  paintBlob(g, inner, { fill: CLAY.mid });
  // Till rows.
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const y = 56 + i * 28;
    g.beginPath();
    g.moveTo(56 + rng.next() * 8, y);
    g.quadraticCurveTo(128, y + 6, 200 - rng.next() * 8, y);
    g.stroke();
  }
  speckle(g, rng, 50, 40, 156, 130, 40, INK.grain, 0.15, 1.6);
  return { canvas: c, aspect: 256 / 208 };
}

/** A crop at a growth stage: 0 sprout · 1 young · 2 growing · 3 mature. */
export function drawCrop(
  crop: 'berry' | 'flower' | 'mushroom',
  stage: number,
  seed: number,
): PropSprite {
  const rng = new Rng(seed + stage * 101);
  const { c, g } = sprite(160, 160);
  const baseY = 148;
  const s = Math.max(0, Math.min(3, stage));
  if (s === 0) {
    // Sprout — shared across crops.
    g.strokeStyle = SAGE.shade;
    g.lineWidth = 4.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(80, baseY);
    g.quadraticCurveTo(78, 120, 80, 104);
    g.stroke();
    blob(g, rng, 64, 98, 16, 9, { fill: SAGE.light, outline: INK.soft, lineWidth: 2.5 }, 8, 0.12);
    blob(g, rng, 96, 94, 16, 9, { fill: SAGE.mid, outline: INK.soft, lineWidth: 2.5 }, 8, 0.12);
    return { canvas: c, aspect: 1 };
  }
  const grown = s / 3;
  switch (crop) {
    case 'berry': {
      blob(g, rng, 80, baseY - 36 * grown - 18, 30 + 28 * grown, 22 + 20 * grown, {
        fill: SAGE.mid,
        outline: INK.line,
        lineWidth: 4,
      });
      const berries = s === 3 ? 7 : s === 2 ? 3 : 0;
      for (let i = 0; i < berries; i++) {
        g.fillStyle = CLAY.blossom;
        g.beginPath();
        g.arc(48 + rng.next() * 64, baseY - 30 - rng.next() * 40, 6.5, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = INK.soft;
        g.lineWidth = 2;
        g.stroke();
      }
      break;
    }
    case 'flower': {
      const stems = s;
      for (let i = 0; i < stems; i++) {
        const x = 50 + i * 30 + rng.next() * 8;
        grassStroke(g, rng, x, baseY, 50 + 26 * grown, (rng.next() * 2 - 1) * 14, 4, SAGE.shade);
        if (s >= 2) {
          blob(g, rng, x + 2, baseY - 56 - 22 * grown + rng.next() * 10, 13, 11, {
            fill: CLAY.blossom,
            outline: INK.soft,
            lineWidth: 2.5,
          });
          g.fillStyle = ROBOT.accent;
          g.beginPath();
          g.arc(x + 2, baseY - 56 - 22 * grown, 4.5, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    }
    case 'mushroom': {
      const caps = s;
      for (let i = 0; i < caps; i++) {
        const x = 48 + i * 32 + rng.next() * 8;
        const h = 26 + 22 * grown;
        g.fillStyle = CLAY.pale;
        g.fillRect(x - 7, baseY - h, 14, h);
        g.strokeStyle = INK.line;
        g.lineWidth = 3;
        g.strokeRect(x - 7, baseY - h, 14, h);
        blob(g, rng, x, baseY - h, 20 + 8 * grown, 13 + 5 * grown, {
          fill: CLAY.blossom,
          outline: INK.line,
          lineWidth: 3.5,
        });
      }
      break;
    }
  }
  return { canvas: c, aspect: 1 };
}

/** Fence segment — two posts, two rails, hand-hewn. */
export function drawFence(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(320, 192);
  for (const x of [44, 276]) {
    wobblyLine(g, rng, x, 180, x + 2, 36, 14, CLAY.mid, 1.5, 4);
    g.strokeStyle = INK.line;
  }
  for (const y of [70, 124]) {
    g.beginPath();
    g.moveTo(20, y + rng.next() * 6);
    g.lineTo(300, y - 4 + rng.next() * 6);
    g.lineWidth = 13;
    g.strokeStyle = CLAY.light;
    g.lineCap = 'round';
    g.stroke();
    g.lineWidth = 4;
    g.strokeStyle = INK.line;
    g.beginPath();
    g.moveTo(20, y - 7 + rng.next() * 4);
    g.lineTo(300, y - 11 + rng.next() * 4);
    g.stroke();
  }
  return { canvas: c, aspect: 320 / 192 };
}

/** Campfire — stone ring, crossed logs, a quiet hand-drawn flame + warm halo. */
export function drawCampfire(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 224);
  // Baked warm halo (soft, not bloom).
  const halo = g.createRadialGradient(128, 150, 8, 128, 150, 110);
  halo.addColorStop(0, LAMP_WARM);
  halo.addColorStop(1, 'rgba(233, 196, 124, 0)');
  g.fillStyle = halo;
  g.fillRect(0, 30, 256, 194);
  // Crossed logs.
  wobblyLine(g, rng, 70, 196, 186, 168, 13, CLAY.deep, 1.5, 4);
  wobblyLine(g, rng, 74, 168, 182, 198, 13, CLAY.mid, 1.5, 4);
  // Flame — layered teardrops, warm amber over clay.
  g.beginPath();
  g.moveTo(128, 84);
  g.quadraticCurveTo(160, 128, 148, 158);
  g.quadraticCurveTo(140, 172, 128, 174);
  g.quadraticCurveTo(116, 172, 108, 158);
  g.quadraticCurveTo(96, 128, 128, 84);
  g.closePath();
  g.fillStyle = ROBOT.accent;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.stroke();
  g.beginPath();
  g.moveTo(128, 116);
  g.quadraticCurveTo(142, 140, 134, 158);
  g.quadraticCurveTo(128, 166, 122, 158);
  g.quadraticCurveTo(114, 140, 128, 116);
  g.closePath();
  g.fillStyle = '#f2d9a0';
  g.fill();
  // Stone ring.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.05 + (i / 6) * 0.9);
    const x = 128 + Math.cos(a) * 78;
    const y = 196 + Math.sin(a) * -14;
    blob(g, rng, x, y, 15, 11, { fill: CLAY.pale, outline: INK.line, lineWidth: 3.5 }, 7, 0.1);
  }
  return { canvas: c, aspect: 256 / 224 };
}

/** Datou's shelter — a little gabled kennel in robot cream + charcoal. */
export function drawShelter(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(320, 288);
  // Body.
  roundedRectPath(g, 52, 124, 216, 140, 14);
  g.fillStyle = ROBOT.shell;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5.5;
  g.stroke();
  // Roof.
  g.beginPath();
  g.moveTo(34, 132);
  g.lineTo(160, 44);
  g.lineTo(286, 132);
  g.closePath();
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.lineJoin = 'round';
  g.stroke();
  // Doorway.
  g.beginPath();
  g.moveTo(120, 264);
  g.lineTo(120, 196);
  g.quadraticCurveTo(160, 156, 200, 196);
  g.lineTo(200, 264);
  g.closePath();
  g.fillStyle = ROBOT.visor;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  // Amber name dot over the door.
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.arc(160, 142, 9, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 3;
  g.stroke();
  void rng;
  return { canvas: c, aspect: 320 / 288 };
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

/** A tied bundle of twigs (building component). */
export function drawBundle(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(160, 112);
  for (let i = 0; i < 4; i++) {
    const y = 50 + i * 9 + rng.next() * 4;
    wobblyLine(g, rng, 20, y + 8, 140, y - 6, 6, i % 2 ? CLAY.deep : CLAY.mid, 1.5, 4);
  }
  // Cord wraps.
  g.strokeStyle = SAGE.shade;
  g.lineWidth = 5;
  for (const x of [52, 108]) {
    g.beginPath();
    g.moveTo(x - 4, 38);
    g.lineTo(x + 4, 92);
    g.stroke();
  }
  return { canvas: c, aspect: 160 / 112 };
}

/** A neat little pile of stones (building component). */
export function drawStonepile(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(144, 112);
  blob(g, rng, 50, 84, 26, 18, { fill: CLAY.pale, outline: INK.line, lineWidth: 3.5 }, 8, 0.1);
  blob(g, rng, 94, 86, 28, 17, { fill: CLAY.light, outline: INK.line, lineWidth: 3.5 }, 8, 0.1);
  blob(g, rng, 72, 56, 24, 16, { fill: CLAY.pale, outline: INK.line, lineWidth: 3.5 }, 8, 0.1);
  return { canvas: c, aspect: 144 / 112 };
}

/** Garden archway — two posts and a gentle arch, blossoms at the shoulders. */
export function drawArchway(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(320, 416);
  for (const x of [64, 256]) {
    wobblyLine(g, rng, x, 400, x, 130, 15, CLAY.mid, 1.5, 5);
  }
  // Arch.
  g.beginPath();
  g.moveTo(52, 142);
  g.quadraticCurveTo(160, 30, 268, 142);
  g.strokeStyle = CLAY.mid;
  g.lineWidth = 15;
  g.lineCap = 'round';
  g.stroke();
  g.beginPath();
  g.moveTo(52, 132);
  g.quadraticCurveTo(160, 22, 268, 132);
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.stroke();
  // Climbing blossoms.
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = 60 + t * 200 + rng.next() * 10;
    const y = 138 - Math.sin(t * Math.PI) * 100 + rng.next() * 10;
    blob(g, rng, x, y, 10, 8, { fill: CLAY.blossom, outline: INK.soft, lineWidth: 2.5 }, 7, 0.12);
    if (i % 2 === 0) {
      blob(
        g,
        rng,
        x + 10,
        y + 8,
        8,
        6,
        { fill: SAGE.light, outline: INK.soft, lineWidth: 2 },
        7,
        0.12,
      );
    }
  }
  return { canvas: c, aspect: 320 / 416 };
}

/** A stone birdbath — the meadow birds' favourite. */
export function drawBirdbath(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(224, 288);
  // Pedestal.
  g.beginPath();
  g.moveTo(96, 120);
  g.quadraticCurveTo(88, 200, 76, 252);
  g.lineTo(148, 252);
  g.quadraticCurveTo(136, 200, 128, 120);
  g.closePath();
  g.fillStyle = CLAY.pale;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Base.
  blob(g, rng, 112, 258, 52, 13, { fill: CLAY.light, outline: INK.line, lineWidth: 4 }, 8, 0.06);
  // Bowl with water.
  blob(g, rng, 112, 112, 84, 26, { fill: CLAY.pale, outline: INK.line, lineWidth: 5 }, 10, 0.04);
  g.beginPath();
  g.ellipse(112, 106, 62, 14, 0, 0, Math.PI * 2);
  g.fillStyle = WATER.mid;
  g.fill();
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  g.stroke();
  // A little bird.
  blob(g, rng, 150, 88, 14, 10, { fill: CLAY.blossom, outline: INK.line, lineWidth: 3 }, 8, 0.1);
  g.fillStyle = INK.line;
  g.beginPath();
  g.arc(160, 82, 2.5, 0, Math.PI * 2);
  g.fill();
  return { canvas: c, aspect: 224 / 288 };
}

/** A wind chime on a small hook post — twig, cones and a flower. */
export function drawWindchime(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(192, 320);
  // Post with hook.
  wobblyLine(g, rng, 60, 304, 60, 70, 11, CLAY.deep, 1.5, 5);
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(60, 72);
  g.quadraticCurveTo(110, 48, 140, 76);
  g.stroke();
  // Crossbar twig.
  wobblyLine(g, rng, 108, 92, 172, 88, 6, CLAY.mid, 1.5, 3);
  // Hanging strings + chimes.
  g.strokeStyle = INK.soft;
  g.lineWidth = 2.5;
  const drops: Array<[number, number]> = [
    [118, 150],
    [140, 176],
    [162, 142],
  ];
  for (const [x, y] of drops) {
    g.beginPath();
    g.moveTo(x, 90);
    g.lineTo(x, y);
    g.stroke();
  }
  blob(g, rng, 118, 160, 9, 13, { fill: CLAY.mid, outline: INK.line, lineWidth: 3 }, 8, 0.1);
  blob(g, rng, 140, 188, 9, 13, { fill: CLAY.deep, outline: INK.line, lineWidth: 3 }, 8, 0.1);
  blob(g, rng, 162, 152, 11, 9, { fill: CLAY.blossom, outline: INK.soft, lineWidth: 2.5 }, 7, 0.12);
  g.fillStyle = ROBOT.accent;
  g.beginPath();
  g.arc(162, 152, 3.5, 0, Math.PI * 2);
  g.fill();
  return { canvas: c, aspect: 192 / 320 };
}

// --- Zone setpieces -----------------------------------------------------------

/** Lakeside jetty — planks reaching into the water (flat decal). */
export function drawJetty(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(224, 448);
  for (let i = 0; i < 7; i++) {
    const y = 24 + i * 60;
    g.beginPath();
    g.moveTo(40 + rng.next() * 6, y);
    g.lineTo(184 - rng.next() * 6, y + 4);
    g.lineTo(182 - rng.next() * 6, y + 46);
    g.lineTo(42 + rng.next() * 6, y + 42);
    g.closePath();
    g.fillStyle = i % 2 ? CLAY.light : CLAY.mid;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4.5;
    g.lineJoin = 'round';
    g.stroke();
  }
  // Side rails.
  for (const x of [34, 190]) {
    wobblyLine(g, rng, x, 12, x, 436, 7, CLAY.deep, 1.5, 6);
  }
  return { canvas: c, aspect: 0.5 };
}

/** Picnic table for the trail rest stop. */
export function drawPicnicTable(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(384, 256);
  // Legs (A-frame).
  for (const [x0, x1] of [
    [96, 60],
    [288, 324],
  ] as const) {
    wobblyLine(g, rng, x0, 130, x1, 232, 12, CLAY.deep, 1.5, 3);
    wobblyLine(g, rng, x0, 130, x0 * 2 - x1, 232, 12, CLAY.deep, 1.5, 3);
  }
  // Bench planks.
  for (const x of [30, 270]) {
    g.fillStyle = CLAY.light;
    g.fillRect(x, 176, 84, 18);
    g.strokeStyle = INK.line;
    g.lineWidth = 4;
    g.strokeRect(x, 176, 84, 18);
  }
  // Table top.
  g.beginPath();
  g.moveTo(70, 110);
  g.lineTo(314, 106);
  g.lineTo(322, 142);
  g.lineTo(62, 146);
  g.closePath();
  g.fillStyle = CLAY.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.stroke();
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(80, 128);
  g.lineTo(308, 124);
  g.stroke();
  return { canvas: c, aspect: 384 / 256 };
}

/** Community bulletin board — small roofed notice board. */
export function drawBulletin(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(288, 352);
  // Posts.
  for (const x of [76, 212]) {
    wobblyLine(g, rng, x, 336, x, 120, 13, CLAY.deep, 1.5, 4);
  }
  // Board.
  roundedRectPath(g, 40, 96, 208, 150, 12);
  g.fillStyle = CLAY.pale;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5.5;
  g.stroke();
  // Little roof.
  g.beginPath();
  g.moveTo(24, 96);
  g.lineTo(144, 50);
  g.lineTo(264, 96);
  g.closePath();
  g.fillStyle = SAGE.deep;
  g.fill();
  g.lineJoin = 'round';
  g.stroke();
  // Pinned notes.
  for (const [x, y, w, h, lean] of [
    [66, 118, 56, 64, -0.06],
    [136, 124, 50, 52, 0.05],
    [196, 116, 40, 58, 0.1],
  ] as const) {
    g.save();
    g.translate(x + w / 2, y + h / 2);
    g.rotate(lean);
    g.fillStyle = '#fbf7ec';
    g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = INK.soft;
    g.lineWidth = 2.5;
    g.strokeRect(-w / 2, -h / 2, w, h);
    g.beginPath();
    for (let i = 0; i < 3; i++) {
      g.moveTo(-w / 2 + 8, -h / 2 + 14 + i * 13);
      g.lineTo(w / 2 - 8, -h / 2 + 14 + i * 13);
    }
    g.stroke();
    g.fillStyle = CLAY.blossom;
    g.beginPath();
    g.arc(0, -h / 2 + 5, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  return { canvas: c, aspect: 288 / 352 };
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

/** An old robot bolt — the salvaged-metal find coffers grant (landmark §9).
 *  Hex head + short threaded shank, robot-dark, a quiet manufactured note. */
export function drawBolt(seed: number): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(128, 128);
  g.save();
  g.translate(64, 64);
  g.rotate(-0.5 + rng.next() * 0.2);
  // Shank with three thread ticks.
  g.fillStyle = ROBOT.dark;
  g.fillRect(-7, -6, 14, 52);
  g.strokeStyle = INK.line;
  g.lineWidth = 3.5;
  g.strokeRect(-7, -6, 14, 52);
  g.strokeStyle = ROBOT.darkShade;
  g.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(-7, 8 + i * 12);
    g.lineTo(7, 12 + i * 12);
    g.stroke();
  }
  // Hex head.
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * 20;
    const y = -22 + Math.sin(a) * 20;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = ROBOT.dark;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 4;
  g.lineJoin = 'round';
  g.stroke();
  g.restore();
  return { canvas: c, aspect: 1 };
}

/**
 * The starter treasure coffer — a small hand-made chest near home that holds
 * the first blueprint hint + the stock to try it (the onboarding bridge to the
 * no-blueprint Workshop loop). Two calm states: closed, and opened (lid tipped
 * back, a soft warm hint of contents). Cream/clay body, ink outline, one amber
 * latch dot — the lamp/lantern accent language, no glow or sparkle.
 */
export function drawCoffer(seed: number, open = false): PropSprite {
  const rng = new Rng(seed);
  const { c, g } = sprite(256, 224);
  const baseY = 196;
  // Body — a rounded clay box on stubby feet.
  g.beginPath();
  g.moveTo(48, 120);
  g.lineTo(54, baseY);
  g.lineTo(202, baseY);
  g.lineTo(208, 120);
  g.closePath();
  g.fillStyle = CLAY.light;
  g.fill();
  g.strokeStyle = INK.line;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.stroke();
  // Iron band + grain.
  g.strokeStyle = CLAY.deep;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(60, 152);
  g.lineTo(196, 152);
  g.stroke();
  for (let i = 0; i < 3; i++) {
    wobblyLine(g, rng, 80 + i * 48, 124, 82 + i * 48, baseY - 6, 2, CLAY.mid, 1.5, 4);
  }
  // Feet.
  for (const x of [62, 194]) {
    g.fillStyle = CLAY.deep;
    g.fillRect(x - 8, baseY - 2, 16, 10);
  }
  if (!open) {
    // Closed domed lid.
    g.beginPath();
    g.moveTo(46, 122);
    g.quadraticCurveTo(128, 70, 210, 122);
    g.lineTo(206, 132);
    g.quadraticCurveTo(128, 86, 50, 132);
    g.closePath();
    g.fillStyle = CLAY.mid;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.stroke();
    // Amber latch.
    g.fillStyle = ROBOT.accent;
    g.beginPath();
    g.arc(128, 128, 8, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 3;
    g.stroke();
  } else {
    // Opened: lid tipped back, a soft warm interior + a tiny hint of contents.
    const halo = g.createRadialGradient(128, 118, 6, 128, 118, 70);
    halo.addColorStop(0, LAMP_WARM);
    halo.addColorStop(1, 'rgba(233, 196, 124, 0)');
    g.fillStyle = halo;
    g.fillRect(48, 70, 160, 80);
    // Open mouth (dark interior).
    g.beginPath();
    g.ellipse(128, 118, 78, 18, 0, 0, Math.PI * 2);
    g.fillStyle = CLAY.deep;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 4;
    g.stroke();
    // Tipped-back lid.
    g.beginPath();
    g.moveTo(54, 110);
    g.quadraticCurveTo(120, 44, 196, 64);
    g.quadraticCurveTo(150, 78, 92, 116);
    g.closePath();
    g.fillStyle = CLAY.mid;
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.stroke();
    // A little rolled "blueprint" sketch peeking out.
    g.save();
    g.translate(132, 104);
    g.rotate(-0.2);
    g.fillStyle = '#fbf7ec';
    g.fillRect(-22, -10, 44, 20);
    g.strokeStyle = INK.soft;
    g.lineWidth = 2.5;
    g.strokeRect(-22, -10, 44, 20);
    g.beginPath();
    g.moveTo(-14, -2);
    g.lineTo(14, -2);
    g.moveTo(-14, 4);
    g.lineTo(8, 4);
    g.stroke();
    g.restore();
  }
  return { canvas: c, aspect: 256 / 224 };
}
