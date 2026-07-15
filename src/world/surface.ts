/**
 * Surface — what the ground *is* under any point, derived geometrically from the
 * same curated data the floor painter uses (worldPaint.ts): worn paths from home
 * to each zone heart, the lake disc + sand rim, and the jetty planks. Pure logic,
 * no canvas sampling — deterministic and testable, so both the footstep foley and
 * (later) terrain pace can key off it without touching rendering.
 *
 * This is the "spatial interaction / frame of reference" that Game Feel says a
 * walk needs: the walker moves *against* a legible ground, not through a flat
 * void.
 */

import { LAKE } from './scatter';
import { DESTINATION_ZONES } from './zones';

export type SurfaceId = 'path' | 'grass' | 'sand' | 'water' | 'wood';

/** Half-width of a worn path (metres). Painter draws ~3.2px over a 520 m span. */
const PATH_HALF = 2.6;
/** The sand rim painted just outside the water (LAKE.radius + a few metres). */
const SAND_RIM = 6;
/** Jetty planks — a wooden decal reaching into the lake (layout.ts jetty prop). */
const JETTY = { x: 21, z: 122, radius: 4.5 };

/** Squared distance from point (px,pz) to segment a→b, and the clamped t. */
function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((px - ax) * abx + (pz - az) * abz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + abx * t;
  const cz = az + abz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz;
}

/**
 * Classify the ground at a world XZ point. Order matters: the jetty sits over
 * water, the sand rim over grass, the water over everything beneath it, and
 * paths win over the grass they cross.
 */
export function surfaceAt(x: number, z: number): SurfaceId {
  // Jetty planks first — a wooden walkway laid over the lakeshore/water.
  {
    const dx = x - JETTY.x;
    const dz = z - JETTY.z;
    if (dx * dx + dz * dz <= JETTY.radius * JETTY.radius) return 'wood';
  }

  // The lake: water inside the radius, a sand rim just outside it.
  {
    const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
    if (dl <= LAKE.radius) return 'water';
    if (dl <= LAKE.radius + SAND_RIM) return 'sand';
  }

  // Worn paths radiate from home (0,0) to each destination-zone heart.
  const half2 = PATH_HALF * PATH_HALF;
  for (const zone of DESTINATION_ZONES) {
    if (distToSegment(x, z, 0, 0, zone.x, zone.z) <= half2) return 'path';
  }

  return 'grass';
}
