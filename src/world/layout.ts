/**
 * World layout — the single source of truth for curated placements: the home
 * base set, one hero landmark per zone, the resting pad, and the hiding
 * places for daily discoveries. Pure data: imported by the World renderer,
 * the spots system, and createPhysics (MuJoCo geoms) alike.
 */

import { LAKE, scatterStatic, kindDef } from './scatter';
import type { WorldCollider } from '../physics/PhysicsAdapter';

export interface MajorProp {
  kind: 'tree' | 'rock' | 'bush' | 'stump' | 'lamp' | 'pine' | 'bench' | 'signpost';
  x: number;
  z: number;
  height: number;
  shadowRadius: number;
  colliderRadius?: number;
  seed: number;
}

/** Curated home base + one hero anchor per zone. */
export const MAJOR_PROPS: readonly MajorProp[] = [
  // Home glade (kept intimate and curated).
  {
    kind: 'tree',
    x: -3.6,
    z: -2.2,
    height: 4.6,
    shadowRadius: 1.5,
    colliderRadius: 0.45,
    seed: 11,
  },
  {
    kind: 'rock',
    x: 3.4,
    z: -1.6,
    height: 1.05,
    shadowRadius: 0.95,
    colliderRadius: 0.7,
    seed: 21,
  },
  { kind: 'bush', x: -3.4, z: 1.7, height: 1.0, shadowRadius: 1.05, colliderRadius: 0.8, seed: 31 },
  {
    kind: 'stump',
    x: 2.2,
    z: -3.4,
    height: 0.78,
    shadowRadius: 0.7,
    colliderRadius: 0.45,
    seed: 41,
  },
  { kind: 'lamp', x: 1.7, z: 3.5, height: 1.7, shadowRadius: 0.42, colliderRadius: 0.22, seed: 51 },
  // Zone hearts.
  { kind: 'pine', x: -120, z: -110, height: 7.2, shadowRadius: 2.0, colliderRadius: 0.7, seed: 61 }, // the Old Pine (woods)
  {
    kind: 'bench',
    x: 128,
    z: -32,
    height: 0.95,
    shadowRadius: 1.1,
    colliderRadius: 0.85,
    seed: 71,
  }, // trail rest stop
  {
    kind: 'signpost',
    x: 124,
    z: -28,
    height: 1.45,
    shadowRadius: 0.35,
    colliderRadius: 0.15,
    seed: 72,
  },
  { kind: 'tree', x: 36, z: 96, height: 5.4, shadowRadius: 1.8, colliderRadius: 0.55, seed: 81 }, // lakeshore tree
];

/** The resting pad — "your spot" at home. Walkable (no collider). */
export const PAD_POSITION = { x: 0, z: 3.2 } as const;

/** Hiding places for the daily discoveries — spread across all zones. Each
 *  `place` id must have a `place.<id>` string in i18n (a test enforces this). */
export const SPOT_ANCHORS = [
  // Home
  { place: 'under-tree', x: -2.6, z: -1.4 },
  { place: 'behind-rock', x: 3.9, z: -2.4 },
  { place: 'by-lamp', x: 2.6, z: 2.8 },
  // Woods
  { place: 'old-pine', x: -117, z: -106 },
  { place: 'woods-hollow', x: -98, z: -132 },
  { place: 'mossy-clearing', x: -142, z: -88 },
  // Trail
  { place: 'rest-stop', x: 131, z: -35 },
  { place: 'trail-bend', x: 96, z: -12 },
  // Lake
  { place: 'lakeshore', x: 38, z: 101 },
  { place: 'reed-bank', x: -6, z: 132 },
  // Meadow wilds
  { place: 'lone-boulder', x: -70, z: 70 },
  { place: 'high-meadow', x: 60, z: -110 },
] as const;

/**
 * Colliders for the physics backends. The placeholder takes them all; MuJoCo
 * bakes a capped subset (model arrays scale with geom count).
 */
export function worldColliders(limit = Infinity): WorldCollider[] {
  const out: WorldCollider[] = [];
  for (const p of MAJOR_PROPS) {
    if (p.colliderRadius) out.push({ x: p.x, z: p.z, radius: p.colliderRadius });
  }
  // The lake blocks walking as one big disc.
  out.push({ x: LAKE.x, z: LAKE.z, radius: LAKE.radius });
  for (const inst of scatterStatic(WORLD_SEED)) {
    const def = kindDef(inst.kind);
    if (def.collider > 0) out.push({ x: inst.x, z: inst.z, radius: def.collider });
  }
  if (out.length > limit) {
    // Keep the nearest-to-home subset (where the MuJoCo puck mostly lives).
    out.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
    out.length = limit;
  }
  return out;
}

/** One world seed — the same world, forever. */
export const WORLD_SEED = 0x5eed_da70;
