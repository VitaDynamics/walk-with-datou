import { Rng } from '../physics/mujoco/rng';
import { getParkColliders, type Collider } from './World';
import { inDeepWater, inPark, LANDMARKS, zoneAt, type ZoneId } from './zones';

/**
 * Points of interest — the bridge between the gameplay loop and the world
 * (docs/GAMEPLAY_DESIGN.md §F3; docs/ENVIRONMENT_DESIGN.md §4.1; and the
 * "Scene Exploration Loop" / reward-density lesson in
 * docs/quadruped-game-design-research.md).
 *
 * Before this, Datou's "curious" want pointed at a random empty point, so
 * exploration had nothing to do with the actual park. POIs fix that: they are
 * real, located things scattered across the zones — concentrated near the
 * landmarks and sprinkled along the connective grassland so there is "a
 * discovery every few steps" (the Mario-Odyssey density lesson). Datou notices
 * the nearest unseen one and leads you to it; arriving *together* is the shared
 * moment that feeds Bond.
 *
 * Pure data + placement logic, no rendering — Poi.ts builds the marker mesh.
 */

export type PoiKind =
  | 'sniff-spot' // an interesting smell in the grass
  | 'shiny-thing' // something glinting — a "treasure"
  | 'butterfly' // a flitting insect to watch
  | 'puddle' // a little water to investigate
  | 'burrow' // a small animal hole to peer into
  | 'berry-bush' // a snackable bush
  | 'scent-trail'; // a trail leading somewhere

/** Per-kind flavour used by the renderer (Poi.ts) and the diary later. */
export interface PoiKindInfo {
  /** Which zones this kind prefers to spawn in (empty = any land zone). */
  zones: ZoneId[];
  /** Datou's reaction verb, for the diary / future animation selection. */
  reaction: 'sniff' | 'dig' | 'watch' | 'splash' | 'alert';
  /** Marker accent colour (hex), used by Poi.ts. */
  color: number;
}

export const POI_KINDS: Record<PoiKind, PoiKindInfo> = {
  'sniff-spot': { zones: [], reaction: 'sniff', color: 0xb59b6a },
  'shiny-thing': { zones: ['grove', 'woods', 'meadow'], reaction: 'dig', color: 0xf2d24b },
  butterfly: { zones: ['meadow', 'grove'], reaction: 'watch', color: 0xf08ab0 },
  puddle: { zones: ['lake', 'woods'], reaction: 'splash', color: 0x6db4d6 },
  burrow: { zones: ['woods', 'grove'], reaction: 'alert', color: 0x5e3a1e },
  'berry-bush': { zones: ['woods', 'grove', 'meadow'], reaction: 'sniff', color: 0x9c3b5a },
  'scent-trail': { zones: [], reaction: 'sniff', color: 0xc7a06a },
};

export interface PoiData {
  id: number;
  kind: PoiKind;
  x: number;
  z: number;
  zone: ZoneId;
}

/** How close the pair must get to a POI for it to count as "reached". */
export const POI_REACH_DIST = 3.0;

const POI_SEED = 0x90015;
/** Roughly how many POIs the park holds at once. Tuned for "a discovery every
 *  few steps without clutter" across the 500×500 park. */
const POI_COUNT = 40;

function pickKind(zone: ZoneId, rng: Rng): PoiKind {
  // Kinds whose preferred-zone list includes this zone (or is unrestricted).
  const eligible = (Object.keys(POI_KINDS) as PoiKind[]).filter((k) => {
    const z = POI_KINDS[k].zones;
    return z.length === 0 || z.includes(zone);
  });
  return eligible[Math.floor(rng.next() * eligible.length)];
}

/** True if a point is clear of every solid collider (with a little margin so
 *  POIs don't spawn jammed against a tree trunk). */
function isClear(x: number, z: number, colliders: readonly Collider[]): boolean {
  for (const c of colliders) {
    if (Math.hypot(x - c.x, z - c.z) < c.radius + 1.2) return false;
  }
  return true;
}

/**
 * Deterministically place the park's POIs. Distribution (per the research
 * doc's reward-density principle): a cluster of POIs near each landmark (the
 * destinations worth walking toward), plus a scatter through the open
 * grassland so the walk between landmarks also pays off. Avoids colliders,
 * deep water, and the immediate spawn so the first thing you see isn't underfoot.
 */
export function placePois(): PoiData[] {
  const rng = new Rng(POI_SEED);
  const colliders = getParkColliders();
  const out: PoiData[] = [];
  let id = 0;

  const tryPlace = (x: number, z: number): boolean => {
    if (!inPark(x, z, 4) || inDeepWater(x, z)) return false;
    if (Math.hypot(x, z) < 10) return false; // keep the spawn underfoot clear
    if (!isClear(x, z, colliders)) return false;
    const zone = zoneAt(x, z).id;
    out.push({ id: id++, kind: pickKind(zone, rng), x, z, zone });
    return true;
  };

  // Clusters near each landmark — the "weenies" you walk toward should reward
  // arrival with things to discover nearby.
  const perLandmark = Math.floor((POI_COUNT * 0.6) / LANDMARKS.length);
  for (const lm of LANDMARKS) {
    let placed = 0;
    for (let attempt = 0; attempt < perLandmark * 6 && placed < perLandmark; attempt++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(6, 28);
      if (tryPlace(lm.x + Math.cos(a) * r, lm.z + Math.sin(a) * r)) placed++;
    }
  }

  // Scatter the rest across the whole park (the connective grassland).
  const target = POI_COUNT;
  for (let attempt = 0; attempt < target * 12 && out.length < target; attempt++) {
    const x = rng.range(-225, 225);
    const z = rng.range(-225, 225);
    tryPlace(x, z);
  }

  return out;
}

/**
 * The live set of POIs and the "have we discovered it yet" state. Owns the
 * read queries the Companion uses to pick a real curious target and the game
 * uses to fire a discovery moment. Pure logic; Game wires it to Poi markers.
 */
export class PoiField {
  private readonly pois: PoiData[];
  private readonly discovered = new Set<number>();

  constructor(pois: PoiData[] = placePois()) {
    this.pois = pois;
  }

  all(): readonly PoiData[] {
    return this.pois;
  }

  isDiscovered(id: number): boolean {
    return this.discovered.has(id);
  }

  /** How many POIs have been found this session (for the diary / souvenirs). */
  get discoveredCount(): number {
    return this.discovered.size;
  }

  /**
   * The nearest still-undiscovered POI to a point, within `maxDist`, or null.
   * Used by the Companion to aim a "curious" want at something real.
   * `zoneBias` (0..1) gently prefers POIs in zones the player has visited least,
   * so wants pull exploration toward fresh ground (landmark/zone-aware wants).
   */
  nearestUndiscovered(
    x: number,
    z: number,
    maxDist: number,
    zoneScore?: (zone: ZoneId) => number,
  ): PoiData | null {
    let best: PoiData | null = null;
    let bestCost = Infinity;
    for (const p of this.pois) {
      if (this.discovered.has(p.id)) continue;
      const dist = Math.hypot(p.x - x, p.z - z);
      if (dist > maxDist) continue;
      // Lower cost = preferred. Distance is the base; an optional zone score
      // (smaller = more wanted) shaves cost so under-visited zones win ties.
      const cost = dist - (zoneScore ? zoneScore(p.zone) * 6 : 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = p;
      }
    }
    return best;
  }

  /** Mark a POI discovered. Returns the POI if it was newly discovered. */
  discover(id: number): PoiData | null {
    if (this.discovered.has(id)) return null;
    const p = this.pois.find((q) => q.id === id);
    if (!p) return null;
    this.discovered.add(id);
    return p;
  }

  /** The undiscovered POI whose centre is within `dist` of a point (the one a
   *  player+Datou pair has "arrived at"), or null. */
  poiAt(x: number, z: number, dist = POI_REACH_DIST): PoiData | null {
    for (const p of this.pois) {
      if (this.discovered.has(p.id)) continue;
      if (Math.hypot(p.x - x, p.z - z) <= dist) return p;
    }
    return null;
  }
}
