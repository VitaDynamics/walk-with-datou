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
  | 'pinecone';

export interface KindDef {
  kind: ScatterKind;
  /** World height range in metres. */
  hMin: number;
  hMax: number;
  /** Solid footprint radius (0 = walk-through). */
  collider: number;
  pickable: boolean;
  /** Datou's reaction when guided to it (i18n key suffix + rig flavour). */
  verb: 'sniff' | 'rustle' | 'hop' | 'watch' | 'drink' | 'none';
  /** Per-zone target counts. */
  counts: Partial<Record<ZoneId, number>>;
}

export const KIND_DEFS: readonly KindDef[] = [
  {
    kind: 'tree',
    hMin: 3.6,
    hMax: 5.2,
    collider: 0.5,
    pickable: false,
    verb: 'sniff',
    counts: { meadow: 170, woods: 110, lake: 30, trail: 36, home: 2 },
  },
  {
    kind: 'pine',
    hMin: 4.0,
    hMax: 6.0,
    collider: 0.5,
    pickable: false,
    verb: 'sniff',
    counts: { woods: 170, meadow: 30 },
  },
  {
    kind: 'bush',
    hMin: 0.8,
    hMax: 1.3,
    collider: 0.7,
    pickable: false,
    verb: 'rustle',
    counts: { meadow: 130, woods: 60, trail: 40, lake: 26, home: 3 },
  },
  {
    kind: 'rock',
    hMin: 0.5,
    hMax: 1.3,
    collider: 0.6,
    pickable: false,
    verb: 'hop',
    counts: { meadow: 90, woods: 44, lake: 36, trail: 20, home: 2 },
  },
  {
    kind: 'stump',
    hMin: 0.6,
    hMax: 0.9,
    collider: 0.45,
    pickable: false,
    verb: 'hop',
    counts: { woods: 36, meadow: 22, home: 1 },
  },
  {
    kind: 'grass',
    hMin: 0.35,
    hMax: 0.55,
    collider: 0,
    pickable: false,
    verb: 'none',
    counts: { meadow: 600, woods: 130, lake: 110, trail: 90, home: 12 },
  },
  {
    kind: 'flower',
    hMin: 0.45,
    hMax: 0.65,
    collider: 0,
    pickable: true,
    verb: 'sniff',
    counts: { meadow: 220, trail: 50, home: 4, lake: 24 },
  },
  {
    kind: 'reed',
    hMin: 0.9,
    hMax: 1.4,
    collider: 0,
    pickable: false,
    verb: 'watch',
    counts: { lake: 150 },
  },
  {
    kind: 'mushroom',
    hMin: 0.3,
    hMax: 0.5,
    collider: 0,
    pickable: true,
    verb: 'sniff',
    counts: { woods: 90, meadow: 16 },
  },
  {
    kind: 'lamp',
    hMin: 1.7,
    hMax: 1.7,
    collider: 0.22,
    pickable: false,
    verb: 'watch',
    counts: { trail: 18, home: 1 },
  },
  {
    kind: 'bench',
    hMin: 0.9,
    hMax: 0.9,
    collider: 0.8,
    pickable: false,
    verb: 'watch',
    counts: { trail: 10, lake: 4, home: 1 },
  },
  {
    kind: 'signpost',
    hMin: 1.4,
    hMax: 1.4,
    collider: 0.15,
    pickable: false,
    verb: 'watch',
    counts: { trail: 8, woods: 3, lake: 3, meadow: 6 },
  },
  {
    kind: 'twig',
    hMin: 0.3,
    hMax: 0.4,
    collider: 0,
    pickable: true,
    verb: 'none',
    counts: { woods: 110, meadow: 110, trail: 30, lake: 24 },
  },
  {
    kind: 'pebble',
    hMin: 0.22,
    hMax: 0.3,
    collider: 0,
    pickable: true,
    verb: 'none',
    counts: { meadow: 110, lake: 70, woods: 40, trail: 26 },
  },
  {
    kind: 'berry',
    hMin: 0.45,
    hMax: 0.6,
    collider: 0,
    pickable: true,
    verb: 'sniff',
    counts: { woods: 50, meadow: 50, trail: 18 },
  },
  {
    kind: 'pinecone',
    hMin: 0.26,
    hMax: 0.34,
    collider: 0,
    pickable: true,
    verb: 'none',
    counts: { woods: 80, meadow: 20 },
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

/** Keep the home pad and paths clear; respect the lake. */
function placeable(kind: KindDef, x: number, z: number): boolean {
  const r = Math.hypot(x, z);
  if (r > WORLD_HALF - 8) return false;
  // Home stays curated: only tiny detail scatter near the very center.
  if (r < 12) return false;
  const lakeD = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (kind.kind === 'reed') return lakeD > LAKE.radius - 2 && lakeD < LAKE.radius + 9;
  if (lakeD < LAKE.radius + (kind.collider > 0 ? 3 : 1)) return false;
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
export function scatterStatic(worldSeed: number): ScatterInstance[] {
  return scatter(
    worldSeed,
    KIND_DEFS.filter((k) => !k.pickable),
  );
}

/**
 * Scatter today's pickable resources (daily-seeded) — gathering renews
 * each morning, in fresh places.
 */
export function scatterPickables(dailySeed: number): ScatterInstance[] {
  return scatter(
    dailySeed ^ 0x9e3779b9,
    KIND_DEFS.filter((k) => k.pickable),
  );
}

function scatter(seed: number, kinds: readonly KindDef[]): ScatterInstance[] {
  const rng = new Rng(seed);
  const out: ScatterInstance[] = [];
  for (const kind of kinds) {
    let index = 0;
    for (const [zoneId, count] of Object.entries(kind.counts) as [ZoneId, number][]) {
      let placed = 0;
      let attempts = 0;
      while (placed < count && attempts < count * 8) {
        attempts++;
        const p = samplePoint(rng, zoneId);
        if (!placeable(kind, p.x, p.z)) continue;
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
