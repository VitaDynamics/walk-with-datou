/**
 * Scatter — deterministic placement of every small thing in the 500×500 world.
 *
 * Pure logic (no THREE): a seeded pass per zone produces instances of each
 * prop kind with position/scale/seed. The same world seed always yields the
 * same world; pickable resources are re-rolled with a DAILY seed so gathering
 * has a gentle renewable rhythm (Don't Starve's renewability, softened).
 *
 * Kinds carry gameplay metadata: solid footprints become physics colliders,
 * `pickable` kinds go to the backpack, others give Datou a reaction verb.
 */

import { Rng } from '../physics/mujoco/rng';
import { CLEARINGS, type Clearing } from './landmarks';
import { WORLD_HALF, ZONES, zoneAt, type ZoneId } from './zones';

export type ScatterKind =
  // flora & rock (interact: Datou reacts)
  | 'tree'
  | 'pine'
  | 'bush'
  | 'rock'
  | 'stump'
  | 'grass'
  | 'flower'
  | 'reed'
  | 'mushroom'
  // trail furniture
  | 'lamp'
  | 'bench'
  | 'signpost'
  // pickable resources (gather to the backpack)
  | 'twig'
  | 'pebble'
  | 'berry'
  | 'pinecone'
  // mid-size filler (E6): between the trees and the grass
  | 'fallen-log'
  | 'fern'
  | 'cattail'
  | 'anthill';

export interface KindDef {
  kind: ScatterKind;
  /** World height range in metres. */
  hMin: number;
  hMax: number;
  /** Solid footprint radius (0 = walk-through). */
  collider: number;
  pickable: boolean;
  /** Datou's reaction when guided to it (i18n key suffix + rig flavour). */
  verb: 'sniff' | 'rustle' | 'hop' | 'watch' | 'drink' | 'peer' | 'none';
  /** Per-zone target counts. */
  counts: Partial<Record<ZoneId, number>>;
  /** Optional clumping: place in patches of `size` within `radius` metres —
   *  flower fields, berry patches, mushroom clumps read as destinations. */
  cluster?: { size: number; radius: number };
  /** 'cross' = two crossed static planes (cheap, never billboarded) — for
   *  small ground detail placed in the thousands. Default: billboard. */
  render?: 'cross';
}

export const KIND_DEFS: readonly KindDef[] = [
  {
    kind: 'tree',
    hMin: 3.6,
    hMax: 5.2,
    collider: 0.5,
    pickable: false,
    verb: 'sniff',
    counts: { meadow: 380, woods: 170, lake: 60, trail: 70, home: 2 },
  },
  {
    kind: 'pine',
    hMin: 4.0,
    hMax: 6.0,
    collider: 0.5,
    pickable: false,
    verb: 'sniff',
    counts: { woods: 320, meadow: 70 },
  },
  {
    kind: 'bush',
    hMin: 0.8,
    hMax: 1.3,
    collider: 0.7,
    pickable: false,
    verb: 'rustle',
    counts: { meadow: 330, woods: 130, trail: 90, lake: 60, home: 3 },
  },
  {
    kind: 'rock',
    hMin: 0.5,
    hMax: 1.3,
    collider: 0.6,
    pickable: false,
    verb: 'hop',
    counts: { meadow: 200, woods: 90, lake: 80, trail: 40, home: 2 },
  },
  {
    kind: 'stump',
    hMin: 0.6,
    hMax: 0.9,
    collider: 0.45,
    pickable: false,
    verb: 'hop',
    counts: { woods: 80, meadow: 50, home: 1 },
  },
  {
    kind: 'grass',
    hMin: 0.35,
    hMax: 0.55,
    collider: 0,
    pickable: false,
    verb: 'none',
    counts: { meadow: 7000, woods: 1400, lake: 1100, trail: 900, home: 110 },
    cluster: { size: 14, radius: 6 },
    render: 'cross',
  },
  {
    kind: 'flower',
    hMin: 0.45,
    hMax: 0.65,
    collider: 0,
    pickable: true,
    verb: 'sniff',
    counts: { meadow: 1500, trail: 280, home: 30, lake: 160 },
    cluster: { size: 16, radius: 6 },
    render: 'cross',
  },
  {
    kind: 'reed',
    hMin: 0.9,
    hMax: 1.4,
    collider: 0,
    pickable: false,
    verb: 'watch',
    counts: { lake: 520 },
    cluster: { size: 8, radius: 5 },
    render: 'cross',
  },
  {
    kind: 'mushroom',
    hMin: 0.3,
    hMax: 0.5,
    collider: 0,
    pickable: true,
    verb: 'sniff',
    counts: { woods: 360, meadow: 60 },
    cluster: { size: 8, radius: 4 },
    render: 'cross',
  },
  {
    kind: 'lamp',
    hMin: 1.7,
    hMax: 1.7,
    collider: 0.22,
    pickable: false,
    verb: 'watch',
    counts: { trail: 26, home: 1 },
  },
  {
    kind: 'bench',
    hMin: 0.9,
    hMax: 0.9,
    collider: 0.8,
    pickable: false,
    verb: 'watch',
    counts: { trail: 14, lake: 6, home: 1 },
  },
  {
    kind: 'signpost',
    hMin: 1.4,
    hMax: 1.4,
    collider: 0.15,
    pickable: false,
    verb: 'watch',
    counts: { trail: 10, woods: 4, lake: 4, meadow: 8 },
  },
  {
    kind: 'twig',
    hMin: 0.3,
    hMax: 0.4,
    collider: 0,
    pickable: true,
    verb: 'none',
    counts: { woods: 380, meadow: 380, trail: 110, lake: 80, home: 8 },
    cluster: { size: 5, radius: 3 },
    render: 'cross',
  },
  {
    kind: 'pebble',
    hMin: 0.22,
    hMax: 0.3,
    collider: 0,
    pickable: true,
    verb: 'none',
    counts: { meadow: 330, lake: 220, woods: 120, trail: 80, home: 8 },
    render: 'cross',
  },
  {
    kind: 'berry',
    hMin: 0.45,
    hMax: 0.6,
    collider: 0,
    pickable: true,
    verb: 'sniff',
    counts: { woods: 170, meadow: 170, trail: 60 },
    cluster: { size: 6, radius: 4 },
    render: 'cross',
  },
  {
    kind: 'pinecone',
    hMin: 0.26,
    hMax: 0.34,
    collider: 0,
    pickable: true,
    verb: 'none',
    counts: { woods: 280, meadow: 70 },
    cluster: { size: 6, radius: 3 },
    render: 'cross',
  },
  // --- mid-size filler (E6) -------------------------------------------------
  {
    kind: 'fallen-log',
    hMin: 0.55,
    hMax: 0.8,
    collider: 0.7,
    pickable: false,
    verb: 'hop',
    counts: { woods: 40, meadow: 28, trail: 8 },
  },
  {
    kind: 'fern',
    hMin: 0.5,
    hMax: 0.75,
    collider: 0,
    pickable: false,
    verb: 'rustle',
    counts: { woods: 380, meadow: 60 },
    cluster: { size: 10, radius: 5 },
    render: 'cross',
  },
  {
    kind: 'cattail',
    hMin: 1.0,
    hMax: 1.5,
    collider: 0,
    pickable: false,
    verb: 'watch',
    counts: { lake: 180 },
    cluster: { size: 7, radius: 4 },
    render: 'cross',
  },
  {
    kind: 'anthill',
    hMin: 0.3,
    hMax: 0.42,
    collider: 0.25,
    pickable: false,
    verb: 'peer',
    counts: { meadow: 22, trail: 8, woods: 8 },
  },
];

export interface ScatterInstance {
  /** Stable id: `${kind}:${index}` across the whole world. */
  id: string;
  kind: ScatterKind;
  x: number;
  z: number;
  height: number;
  /** Sprite variation seed. */
  seed: number;
}

/** The lake water disc (no walking, no scatter except reeds at the rim). */
export const LAKE = { x: 30, z: 165, radius: 52 };

/** Keep the home pad and paths clear; respect the lake and authored hearts. */
function placeable(
  kind: KindDef,
  x: number,
  z: number,
  rng: Rng,
  clearings: readonly Clearing[],
): boolean {
  const r = Math.hypot(x, z);
  if (r > WORLD_HALF - 8) return false;
  // The pad and the very center stay clear; big props stay out of the glade,
  // but small detail (grass, flowers, pickables) grows right up to home.
  if (r < (kind.collider > 0 ? 9 : 4.5)) return false;
  const lakeD = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (kind.kind === 'reed' || kind.kind === 'cattail')
    return lakeD > LAKE.radius - 2 && lakeD < LAKE.radius + 9;
  if (lakeD < LAKE.radius + (kind.collider > 0 ? 3 : 1)) return false;
  // Landmark clearings: the activity ring stays clear so authored compositions
  // never compete with generic scatter; the approach ring is damped (§5).
  // (Reeds returned above on purpose — the lake-rim reed band IS the pump
  // garden's concealment screen, per the plan.)
  for (const c of clearings) {
    if (Math.hypot(x - c.x, z - c.z) >= c.r) continue;
    if (c.density <= 0) return false;
    if (rng.next() >= c.density) return false;
    break; // honour only the innermost containing circle
  }
  return true;
}

/** Deterministic sample inside a zone (disc for named zones, square for meadow). */
function samplePoint(rng: Rng, zoneId: ZoneId): { x: number; z: number } {
  const zone = ZONES.find((z) => z.id === zoneId)!;
  if (zoneId === 'meadow') {
    return {
      x: (rng.next() * 2 - 1) * (WORLD_HALF - 12),
      z: (rng.next() * 2 - 1) * (WORLD_HALF - 12),
    };
  }
  const a = rng.next() * Math.PI * 2;
  const d = Math.sqrt(rng.next()) * zone.radius;
  return { x: zone.x + Math.cos(a) * d, z: zone.z + Math.sin(a) * d };
}

/**
 * Scatter the static flora/furniture (world-seeded) — same forever.
 */
export function scatterStatic(
  worldSeed: number,
  clearings: readonly Clearing[] = CLEARINGS,
): ScatterInstance[] {
  return scatter(
    worldSeed,
    KIND_DEFS.filter((k) => !k.pickable),
    clearings,
  );
}

/**
 * Scatter today's pickable resources (daily-seeded) — gathering renews
 * each morning, in fresh places.
 */
export function scatterPickables(
  dailySeed: number,
  clearings: readonly Clearing[] = CLEARINGS,
): ScatterInstance[] {
  return scatter(
    dailySeed ^ 0x9e3779b9,
    KIND_DEFS.filter((k) => k.pickable),
    clearings,
  );
}

function scatter(
  seed: number,
  kinds: readonly KindDef[],
  clearings: readonly Clearing[] = CLEARINGS,
): ScatterInstance[] {
  const rng = new Rng(seed);
  const out: ScatterInstance[] = [];
  for (const kind of kinds) {
    let index = 0;
    for (const [zoneId, count] of Object.entries(kind.counts) as [ZoneId, number][]) {
      let placed = 0;
      let attempts = 0;
      // Clumped kinds grow in patches around a wandering cluster center.
      let clusterCenter: { x: number; z: number } | null = null;
      let clusterLeft = 0;
      while (placed < count && attempts < count * 14) {
        attempts++;
        let p: { x: number; z: number };
        if (kind.cluster) {
          if (clusterLeft <= 0 || !clusterCenter) {
            clusterCenter = samplePoint(rng, zoneId);
            clusterLeft = kind.cluster.size;
          }
          const a = rng.next() * Math.PI * 2;
          const d = Math.sqrt(rng.next()) * kind.cluster.radius;
          p = { x: clusterCenter.x + Math.cos(a) * d, z: clusterCenter.z + Math.sin(a) * d };
          clusterLeft--;
        } else {
          p = samplePoint(rng, zoneId);
        }
        if (!placeable(kind, p.x, p.z, rng, clearings)) continue;
        // Meadow samples that landed inside a named zone are rejected so the
        // per-zone densities stay meaningful.
        if (zoneId === 'meadow' && zoneAt(p.x, p.z).id !== 'meadow') continue;
        out.push({
          id: `${kind.kind}:${index}`,
          kind: kind.kind,
          x: p.x,
          z: p.z,
          height: kind.hMin + rng.next() * (kind.hMax - kind.hMin),
          seed: (seed ^ (index * 2654435761)) >>> 0,
        });
        index++;
        placed++;
      }
    }
  }
  return out;
}

export function kindDef(kind: ScatterKind): KindDef {
  return KIND_DEFS.find((k) => k.kind === kind)!;
}
