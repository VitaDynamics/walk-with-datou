import { Rng } from '../physics/mujoco/rng';
import type { ItemKind } from './catalog/types';
import type { Placement } from './props';
import {
  inDeepWater,
  inPark,
  LAKE,
  LANDMARKS,
  PARK_HALF,
  ZONES,
  zoneAt,
  type Zone,
  type ZoneId,
} from './zones';

/**
 * Deterministic catalog scatter (Phase 3). Generalises the per-kind scatter
 * functions that were inlined in World.ts into one pure, seeded function over
 * the whole item catalog.
 *
 * Determinism is load-bearing: the diary replays sessions, and getParkColliders()
 * must agree with the visual build. So:
 *  - every kind is seeded by `seed ^ hash(kind.id)` — a *stable* per-id salt, so
 *    reordering the catalog never changes any placement;
 *  - placement is pure numbers, available synchronously before any GLB resolves;
 *  - rejection (park bounds, deep water, landmark footprints, the spawn meadow,
 *    and overlap with already-placed blockers) is deterministic.
 *
 * Returns a Map keyed by kind id → its placements. World feeds each into
 * `instanced()`/`instancedMulti()` and the blocking ones into the collider list.
 */

/** Tunables shared with the legacy World scatter so density reads similarly. */
const SPAWN_CLEAR_RADIUS = 16; // keep the immediate home meadow walkable
const LANDMARK_CLEAR = 8; // don't bury a landmark in scatter
const DEFAULT_BLOCKER_GAP = 1.4; // min centre-gap between two blockers

/** FNV-1a 32-bit hash of a string → a stable per-id seed salt. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A uniform spatial-hash grid of placed *blocker* centres, so overlap rejection
 * is O(1) per query instead of O(n) over all prior placements — the difference
 * between feasible and not at thousands of items.
 */
export class BlockerGrid {
  private readonly cell: number;
  private readonly buckets = new Map<number, { x: number; z: number; r: number }[]>();

  constructor(cellSize: number) {
    this.cell = Math.max(1, cellSize);
  }

  private key(cx: number, cz: number): number {
    // Pack two signed cell coords into one number (offset to stay non-negative).
    return (cx + 4096) * 100000 + (cz + 4096);
  }

  /** True if a circle (x,z,r) clears every stored blocker by `gap`. */
  clear(x: number, z: number, r: number, gap: number): boolean {
    const reach = r + gap + this.maxR;
    const minCx = Math.floor((x - reach) / this.cell);
    const maxCx = Math.floor((x + reach) / this.cell);
    const minCz = Math.floor((z - reach) / this.cell);
    const maxCz = Math.floor((z + reach) / this.cell);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.buckets.get(this.key(cx, cz));
        if (!bucket) continue;
        for (const b of bucket) {
          if (Math.hypot(x - b.x, z - b.z) < r + b.r + gap) return false;
        }
      }
    }
    return true;
  }

  add(x: number, z: number, r: number): void {
    const cx = Math.floor(x / this.cell);
    const cz = Math.floor(z / this.cell);
    const k = this.key(cx, cz);
    const bucket = this.buckets.get(k) ?? [];
    bucket.push({ x, z, r });
    this.buckets.set(k, bucket);
    if (r > this.maxR) this.maxR = r;
  }

  private maxR = 0;
}

/** Pre-existing fixed blockers (landmarks, home post) the scatter must avoid. */
export interface SeedBlocker {
  x: number;
  z: number;
  r: number;
}

export interface ScatterOptions {
  /** Base seed XORed with each kind's id hash. */
  seed: number;
  /** Fixed blockers (landmarks etc.) to seed the overlap grid with. */
  seedBlockers?: readonly SeedBlocker[];
  /** Grid cell size for the overlap hash (≈ largest footprint). */
  gridCell?: number;
}

/** Area of a zone's soft disc, used to turn spawnWeight into an instance count. */
function zoneArea(zone: Zone): number {
  return Math.PI * zone.radius * zone.radius;
}

/** Eligible zones for a kind ([] = all land zones). */
function eligibleZones(kind: ItemKind): readonly ZoneId[] {
  return kind.zones.length ? kind.zones : (['meadow', 'woods', 'lake', 'grove'] as ZoneId[]);
}

/**
 * Target instance count for a kind in one zone. spawnWeight is "instances per
 * 10,000 m² of eligible zone", so a weight-1 kind gets ~1 per 100×100 m patch —
 * tuned to land near the legacy densities without per-kind hand counts.
 */
function targetCount(kind: ItemKind, zone: Zone): number {
  return Math.round((kind.spawnWeight * zoneArea(zone)) / 10000);
}

/**
 * Place one kind's instances across its eligible zones, clumped (cluster centres
 * + jitter, like the legacy scatterTrees) so fields read organic, not stamped.
 * Mutates `grid` with any blockers it places (so later kinds avoid them).
 */
function scatterKind(
  kind: ItemKind,
  opts: Required<Pick<ScatterOptions, 'seed'>>,
  grid: BlockerGrid,
): Placement[] {
  const rng = new Rng((opts.seed ^ hashId(kind.id)) >>> 0);
  const out: Placement[] = [];
  const isBlocker = kind.blocking;
  const baseR = kind.collider ?? kind.footprintRadius;

  const tryPlace = (x: number, z: number): void => {
    if (!inPark(x, z, 3)) return;
    if (inDeepWater(x, z)) return;
    if (Math.hypot(x, z) < SPAWN_CLEAR_RADIUS) return;
    for (const lm of LANDMARKS) {
      if (Math.hypot(x - lm.x, z - lm.z) < LANDMARK_CLEAR) return;
    }
    const scale = rng.range(kind.scaleRange[0], kind.scaleRange[1]);
    const r = baseR * scale;
    if (isBlocker && !grid.clear(x, z, r, DEFAULT_BLOCKER_GAP)) return;
    out.push({ x, z, yaw: rng.range(0, Math.PI * 2), scale, tint: rng.range(-1, 1) });
    if (isBlocker) grid.add(x, z, r);
  };

  for (const zid of eligibleZones(kind)) {
    const zone = ZONES.find((z) => z.id === zid);
    if (!zone) continue;
    const total = targetCount(kind, zone);
    if (total <= 0) continue;

    // Lake-zone kinds that aren't water plants cluster on the shoreline band;
    // everything else clumps around the zone centre with Gaussian-ish falloff.
    const clusters = Math.max(1, Math.round(total / 5));
    for (let c = 0; c < clusters; c++) {
      const ca = rng.range(0, Math.PI * 2);
      const cr = ((rng.next() + rng.next()) / 2) * zone.radius;
      const cx = zone.center.x + Math.cos(ca) * cr;
      const cz = zone.center.z + Math.sin(ca) * cr;
      const per = Math.ceil(total / clusters);
      for (let i = 0; i < per; i++) {
        tryPlace(cx + rng.range(-7, 7), cz + rng.range(-7, 7));
      }
    }
  }
  return out;
}

/**
 * Scatter every scatterable (spawnWeight > 0) kind in the catalog. Kinds are
 * processed in a stable id-sorted order so the shared overlap grid resolves the
 * same way every run regardless of catalog insertion order.
 */
export function scatterCatalog(
  kinds: readonly ItemKind[],
  options: ScatterOptions,
): Map<string, Placement[]> {
  const grid = new BlockerGrid(options.gridCell ?? 4);
  for (const b of options.seedBlockers ?? []) grid.add(b.x, b.z, b.r);

  const ordered = [...kinds]
    .filter((k) => k.spawnWeight > 0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const result = new Map<string, Placement[]>();
  for (const kind of ordered) {
    result.set(kind.id, scatterKind(kind, { seed: options.seed }, grid));
  }
  return result;
}

/** Re-export so World/tests can avoid a second import path. */
export { zoneAt, PARK_HALF, LAKE };
