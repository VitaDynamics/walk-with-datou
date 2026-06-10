/**
 * The 500×500 m world floor, painted as ONE hand-cut piece on paper.
 *
 * A 2048px canvas maps to ±WORLD_PAINT_HALF metres (~4 px/m): meadow base
 * with tone blotches, a darker woods stain, the lake (water + sand rim),
 * a warm trail patch, worn paths from home to every zone heart, and the
 * contact shadow of every scattered prop stamped straight into the paint
 * (zero extra draw calls). The outer edge is an irregular giant blob —
 * the whole world reads as a paper cutout.
 */

import { Rng } from '../physics/mujoco/rng';
import { GROUND, INK, SAGE, WATER } from './palette';
import { blob, blobPoints, traceBlob } from './strokes';
import { createCanvas, ctx2d } from './textures';
import { LAKE } from '../world/scatter';
import { DESTINATION_ZONES } from '../world/zones';

export const WORLD_PAINT_HALF = 260;

export interface ShadowStamp {
  x: number;
  z: number;
  /** Shadow radius in metres. */
  r: number;
}

export function paintWorld(
  seed: number,
  shadows: readonly ShadowStamp[],
  size = 2048,
): HTMLCanvasElement {
  const rng = new Rng(seed);
  const c = createCanvas(size, size);
  const g = ctx2d(c);
  const S = size / (WORLD_PAINT_HALF * 2); // px per metre
  const px = (x: number): number => (x + WORLD_PAINT_HALF) * S;
  const pz = (z: number): number => (z + WORLD_PAINT_HALF) * S;

  // Clip everything inside one giant irregular blob — the hand-cut edge.
  const edge = blobPoints(rng, size / 2, size / 2, size * 0.488, size * 0.482, 26, 0.025);
  g.save();
  traceBlob(g, edge);
  g.clip();

  // Meadow base.
  g.fillStyle = GROUND.base;
  g.fillRect(0, 0, size, size);

  // Large painterly tone blotches across the whole meadow.
  const tones = [GROUND.blotchA, GROUND.blotchB, GROUND.blotchC];
  for (let i = 0; i < 120; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const r = size * (0.02 + rng.next() * 0.05);
    g.save();
    g.globalAlpha = 0.2 + rng.next() * 0.25;
    blob(g, rng, x, y, r, r * (0.45 + rng.next() * 0.4), { fill: tones[i % 3] });
    g.restore();
  }

  // Woods stain — deeper, mossier ground under the conifers (NW).
  g.save();
  g.globalAlpha = 0.55;
  blob(g, rng, px(-120), pz(-110), 105 * S, 92 * S, { fill: SAGE.light }, 16, 0.12);
  g.globalAlpha = 0.35;
  blob(g, rng, px(-130), pz(-120), 70 * S, 60 * S, { fill: SAGE.mid }, 12, 0.15);
  g.restore();

  // Trail patch — warmer, packed earth around the community loop (E).
  g.save();
  g.globalAlpha = 0.5;
  blob(g, rng, px(130), pz(-30), 80 * S, 68 * S, { fill: GROUND.path }, 14, 0.12);
  g.restore();

  // Worn paths from home to each zone heart (under the lake/woods features).
  g.strokeStyle = GROUND.path;
  g.lineCap = 'round';
  for (const zone of DESTINATION_ZONES) {
    const steps = 14;
    g.lineWidth = 3.2 * S;
    g.beginPath();
    g.moveTo(px(0), pz(0));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const wob = Math.sin(t * Math.PI * 2.5 + zone.x) * 9 + (rng.next() * 2 - 1) * 5;
      const dx = zone.x * t;
      const dz = zone.z * t;
      const len = Math.hypot(zone.x, zone.z) || 1;
      const nx = -zone.z / len;
      const nz = zone.x / len;
      g.lineTo(px(dx + nx * wob), pz(dz + nz * wob));
    }
    g.stroke();
  }

  // The lake: sand rim, then water, then a few quiet ripple strokes.
  blob(
    g,
    rng,
    px(LAKE.x),
    pz(LAKE.z),
    (LAKE.radius + 7) * S,
    (LAKE.radius + 5) * S,
    { fill: WATER.sand },
    18,
    0.05,
  );
  blob(
    g,
    rng,
    px(LAKE.x),
    pz(LAKE.z),
    (LAKE.radius + 1) * S,
    (LAKE.radius - 1) * S,
    { fill: WATER.edge },
    18,
    0.045,
  );
  blob(
    g,
    rng,
    px(LAKE.x),
    pz(LAKE.z),
    (LAKE.radius - 4) * S,
    (LAKE.radius - 6) * S,
    { fill: WATER.mid },
    16,
    0.05,
  );
  blob(
    g,
    rng,
    px(LAKE.x + 4),
    pz(LAKE.z + 6),
    (LAKE.radius - 18) * S,
    (LAKE.radius - 22) * S,
    { fill: WATER.deep },
    14,
    0.07,
  );
  g.strokeStyle = WATER.edge;
  g.lineCap = 'round';
  g.lineWidth = 1.6 * S;
  for (let i = 0; i < 8; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.next() * (LAKE.radius - 24) * S;
    const x = px(LAKE.x) + Math.cos(a) * d;
    const y = pz(LAKE.z) + Math.sin(a) * d * 0.8;
    g.save();
    g.globalAlpha = 0.6;
    g.beginPath();
    g.moveTo(x - 8 * S, y);
    g.quadraticCurveTo(x, y - 1.6 * S, x + 8 * S, y);
    g.stroke();
    g.restore();
  }

  // Stamp every prop's contact shadow into the paint.
  g.fillStyle = INK.line;
  for (const s of shadows) {
    g.save();
    g.globalAlpha = 0.13;
    g.beginPath();
    g.ellipse(px(s.x), pz(s.z) + s.r * 0.18 * S, s.r * S, s.r * 0.55 * S, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Sparse grain over everything (cheap at this scale).
  g.fillStyle = INK.grain;
  for (let i = 0; i < 1600; i++) {
    g.globalAlpha = 0.03 + rng.next() * 0.04;
    g.beginPath();
    g.arc(rng.next() * size, rng.next() * size, 0.6 + rng.next() * 1.6, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.restore();

  // Ink the cut edge.
  g.save();
  traceBlob(g, edge);
  g.strokeStyle = GROUND.edge;
  g.lineWidth = 10;
  g.stroke();
  g.restore();

  return c;
}
