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

  // Landmark aprons — each authored area stains the ground around it
  // (positions match src/world/landmarks.ts). Billboarded plates are edge-on
  // from the overview camera, so this paint IS the area's long-range
  // signature, on the big map and the minimap alike.
  //
  // A. Trail Repair Commons (126,−28): a swept work-yard with a warm wash —
  // packed pale earth where volunteers walk, one quiet amber-ochre note.
  g.save();
  g.globalAlpha = 0.8;
  blob(g, rng, px(126), pz(-28), 20 * S, 16 * S, { fill: GROUND.path }, 14, 0.1);
  g.globalAlpha = 0.16;
  blob(g, rng, px(127), pz(-28.5), 12 * S, 10 * S, { fill: '#d9a441' }, 12, 0.12);
  g.restore();
  // B. Reedwater Pump Garden (14,110): a wet basin spreading from the pump,
  // with two painted irrigation channels curving toward the lake water.
  g.save();
  g.globalAlpha = 0.55;
  blob(g, rng, px(14), pz(110), 17 * S, 14 * S, { fill: WATER.sand }, 14, 0.1);
  g.globalAlpha = 0.5;
  blob(g, rng, px(15), pz(112), 11 * S, 9 * S, { fill: WATER.edge }, 12, 0.12);
  g.strokeStyle = WATER.edge;
  g.lineCap = 'round';
  g.lineWidth = 1.3 * S;
  g.globalAlpha = 0.8;
  for (const [sx, sz, mx, mz, ex, ez] of [
    [14, 108, 10, 113, 9, 119],
    [14, 108, 18, 113, 21, 118],
  ] as const) {
    g.beginPath();
    g.moveTo(px(sx), pz(sz));
    g.quadraticCurveTo(px(mx), pz(mz), px(ex), pz(ez));
    g.stroke();
  }
  g.restore();
  // C. Old Pine Relay Camp (−114,−104): a kept clearing in the woods stain,
  // its pale triangle ground-mark readable from above.
  g.save();
  g.globalAlpha = 0.55;
  blob(g, rng, px(-114), pz(-104), 14 * S, 12 * S, { fill: GROUND.path }, 12, 0.12);
  g.globalAlpha = 0.5;
  g.strokeStyle = '#efe8d6';
  g.lineWidth = 1.1 * S;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(px(-114), pz(-107.5));
  g.lineTo(px(-110.8), pz(-101.8));
  g.lineTo(px(-117.2), pz(-101.8));
  g.closePath();
  g.stroke();
  g.restore();
  // D. Ruin Stones (168,−160): a stone-dust ground with the giant, half-worn
  // ring-and-notch mark — the corner finally has a face from above.
  g.save();
  g.globalAlpha = 0.6;
  blob(g, rng, px(168), pz(-160), 13 * S, 11 * S, { fill: '#e3ddc8' }, 13, 0.1);
  g.globalAlpha = 0.45;
  g.strokeStyle = '#cfc6a8';
  g.lineWidth = 1.4 * S;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(px(168), pz(-160), 6 * S, 0.6, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(px(172.2), pz(-164.2));
  g.lineTo(px(175.5), pz(-167.5));
  g.stroke();
  g.restore();
  // E. Watchers' Knoll (−98,88): a sun-paled rise with a worn sitting spot.
  g.save();
  g.globalAlpha = 0.7;
  blob(g, rng, px(-98), pz(88), 12 * S, 10 * S, { fill: GROUND.blotchC }, 12, 0.12);
  g.globalAlpha = 0.5;
  blob(g, rng, px(-97), pz(87), 4 * S, 3 * S, { fill: GROUND.path }, 10, 0.15);
  g.restore();
  // F. Meadow Orchard (60,−110): four tilled rows — unmistakable from the sky.
  g.save();
  g.globalAlpha = 0.4;
  blob(g, rng, px(60), pz(-110), 14 * S, 11 * S, { fill: SAGE.light }, 12, 0.1);
  g.globalAlpha = 0.55;
  g.strokeStyle = GROUND.path;
  g.lineWidth = 1.5 * S;
  g.lineCap = 'round';
  for (let row = 0; row < 4; row++) {
    const oz = -114.5 + row * 3.2;
    g.beginPath();
    g.moveTo(px(52), pz(oz + 0.4));
    g.quadraticCurveTo(px(60), pz(oz - 0.4), px(68), pz(oz + 0.3));
    g.stroke();
  }
  g.restore();

  // --- Connective features (the leading lines between areas) ----------------
  // Not everything radiates from home: areas are found along a stream, a
  // boardwalk, a mown strip, cart ruts, footprint trails, a flower drift and
  // a forest corridor — each line a different way of being led somewhere.

  /** A wobbled polyline through world-space waypoints. */
  const flow = (pts: Array<[number, number]>, wobble: number): void => {
    g.beginPath();
    g.moveTo(px(pts[0][0]), pz(pts[0][1]));
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k];
      const [bx, bz] = pts[k + 1];
      const steps = 10;
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const wob = Math.sin((k + t) * Math.PI * 1.7 + bx) * wobble + (rng.next() * 2 - 1) * 2;
        g.lineTo(px(ax + (bx - ax) * t + nx * wob), pz(az + (bz - az) * t + nz * wob));
      }
    }
    g.stroke();
  };

  // THE STREAM: rises in the woods, crosses at the stepping stones, bends
  // under the willow, and feeds the lake — the west side's waterway.
  const streamPts: Array<[number, number]> = [
    [-150, -58],
    [-112, -18],
    [-72, 28],
    [-50, 62],
    [-38, 92],
    [-24, 116],
    [-12, 138],
  ];
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = WATER.edge;
  g.lineWidth = 3.6 * S;
  flow(streamPts, 5);
  g.strokeStyle = WATER.mid;
  g.lineWidth = 2 * S;
  flow(streamPts, 5);
  g.restore();

  // THE BOARDWALK: a planked pavement from the jetty along the east shore
  // to the driftwood beach — pale runner band with plank ticks.
  const walkPts: Array<[number, number]> = [
    [26, 126],
    [54, 130],
    [82, 138],
    [92, 162],
    [96, 188],
  ];
  g.save();
  g.lineCap = 'round';
  g.globalAlpha = 0.85;
  g.strokeStyle = '#e0d3b4';
  g.lineWidth = 2.4 * S;
  flow(walkPts, 2);
  g.globalAlpha = 0.5;
  g.strokeStyle = INK.soft;
  g.lineWidth = 0.5 * S;
  for (let k = 0; k < walkPts.length - 1; k++) {
    const [ax, az] = walkPts[k];
    const [bx, bz] = walkPts[k + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let d = 3; d < len; d += 4.5) {
      const t = d / len;
      const cx = ax + (bx - ax) * t;
      const cz = az + (bz - az) * t;
      g.beginPath();
      g.moveTo(px(cx - nx * 1.1), pz(cz - nz * 1.1));
      g.lineTo(px(cx + nx * 1.1), pz(cz + nz * 1.1));
      g.stroke();
    }
  }
  g.restore();

  // THE MOWN STRIP: a wide cut lane through the tall south-east meadow,
  // straight to the kite field.
  g.save();
  g.globalAlpha = 0.5;
  g.strokeStyle = GROUND.blotchC;
  g.lineCap = 'round';
  g.lineWidth = 6 * S;
  flow(
    [
      [132, 10],
      [142, 50],
      [150, 90],
    ],
    3,
  );
  g.restore();

  // THE CART RUTS: two parallel worn lines out to the old quarry.
  g.save();
  g.globalAlpha = 0.7;
  g.strokeStyle = GROUND.path;
  g.lineCap = 'round';
  g.lineWidth = 0.7 * S;
  for (const off of [-0.9, 0.9] as const) {
    g.beginPath();
    const ruts: Array<[number, number]> = [
      [-138, -52],
      [-162, -32],
      [-185, -10],
    ];
    g.moveTo(px(ruts[0][0]), pz(ruts[0][1] + off));
    for (let k = 0; k < ruts.length - 1; k++) {
      const [ax, az] = ruts[k];
      const [bx, bz] = ruts[k + 1];
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const wob = Math.sin((k + t) * 4.1) * 1.5;
        g.lineTo(px(ax + (bx - ax) * t), pz(az + (bz - az) * t + off + wob));
      }
    }
    g.stroke();
  }
  g.restore();

  // FOOTPRINT TRAILS: little alternating dabs — home toward the swing tree
  // and the hollow oak; the orchard out to the star circle; the willow bend
  // across to the watchers' knoll.
  g.save();
  g.fillStyle = INK.soft;
  const trails: Array<Array<[number, number]>> = [
    [
      [-8, -10],
      [-34, -70],
      [-65, -45],
    ],
    [
      [48, -120],
      [20, -146],
      [-10, -170],
    ],
    [
      [-46, 92],
      [-72, 90],
      [-98, 88],
    ],
  ];
  for (const trail of trails) {
    for (let k = 0; k < trail.length - 1; k++) {
      const [ax, az] = trail[k];
      const [bx, bz] = trail[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      let side = 1;
      for (let d = 2; d < len; d += 3.4) {
        const t = d / len;
        side = -side;
        const cx = ax + (bx - ax) * t + nx * side * 0.55 + (rng.next() - 0.5) * 0.8;
        const cz = az + (bz - az) * t + nz * side * 0.55 + (rng.next() - 0.5) * 0.8;
        g.globalAlpha = 0.22 + rng.next() * 0.1;
        g.beginPath();
        g.ellipse(px(cx), pz(cz), 0.42 * S, 0.62 * S, Math.atan2(bx - ax, -(bz - az)), 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.restore();

  // THE FLOWER DRIFT: a soft blossom band from home's north path through the
  // bee meadow to the orchard rows.
  g.save();
  g.globalAlpha = 0.14;
  g.strokeStyle = '#d9b3a0';
  g.lineCap = 'round';
  g.lineWidth = 8 * S;
  flow(
    [
      [12, -18],
      [38, -64],
      [52, -92],
    ],
    4,
  );
  g.globalAlpha = 0.3;
  g.fillStyle = '#d9b3a0';
  for (let i = 0; i < 60; i++) {
    const t = rng.next();
    const bx = 12 + (52 - 12) * t + (rng.next() - 0.5) * 12;
    const bz = -18 + (-92 + 18) * t + (rng.next() - 0.5) * 12;
    g.beginPath();
    g.arc(px(bx), pz(bz), (0.3 + rng.next() * 0.35) * S, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // THE FOREST CORRIDOR: a lighter winding gap through the deep woods stain,
  // from the camp down into the fern hollow.
  g.save();
  g.globalAlpha = 0.3;
  g.strokeStyle = GROUND.path;
  g.lineCap = 'round';
  g.lineWidth = 2.6 * S;
  flow(
    [
      [-128, -118],
      [-144, -132],
      [-160, -145],
    ],
    3,
  );
  g.restore();

  // One spur stays: the trail loop up to the ruin stones (not from home).
  g.save();
  g.strokeStyle = GROUND.path;
  g.lineCap = 'round';
  g.globalAlpha = 0.75;
  g.lineWidth = 2.2 * S;
  flow(
    [
      [138, -52],
      [155, -106],
      [168, -160],
    ],
    6,
  );
  g.restore();

  // Small aprons so each light landmark holds its ground from above.
  g.save();
  const aprons: Array<[number, number, number, string, number]> = [
    [-72, 28, 7, WATER.sand, 0.5], // stepping stones
    [-38, 92, 8, SAGE.light, 0.35], // willow bend
    [-45, 160, 9, WATER.sand, 0.45], // frog shallows
    [4, 70, 7, GROUND.path, 0.6], // lantern walk paving
    [96, 188, 10, '#e8ddc2', 0.55], // driftwood strand
    [150, 90, 8, GROUND.blotchC, 0.5], // kite field
    [172, -78, 6, GROUND.path, 0.5], // meadow gate
    [118, -150, 7, GROUND.blotchA, 0.5], // beacon rise
    [-10, -170, 8, GROUND.blotchB, 0.55], // star circle
    [-160, -145, 9, SAGE.mid, 0.3], // fern hollow (deeper green)
    [-185, -10, 9, '#e3ddc8', 0.55], // quarry floor
    [-18, -26, 6, GROUND.blotchA, 0.5], // starter great tree (E3)
    [22, 18, 5, '#e3ddc8', 0.5], // starter boulder (E3)
    [-65, -45, 7, GROUND.blotchA, 0.45], // hollow oak
    [-34, -70, 7, SAGE.light, 0.3], // swing tree clover
    [38, -64, 8, '#e8d8cb', 0.3], // bee meadow blossom ground
  ];
  for (const [ax, az, r, fill, alpha] of aprons) {
    g.globalAlpha = alpha;
    blob(g, rng, px(ax), pz(az), r * S, r * 0.8 * S, { fill }, 11, 0.12);
  }
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
