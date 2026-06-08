/**
 * Zone definitions for the 500×500 park (docs/ENVIRONMENT_DESIGN.md §1, §3).
 *
 * The park is structured as distinct zones radiating from the home meadow at
 * the origin, each with its own palette and prop mix, so the large flat space
 * reads as "a few dense islands of interest connected by quieter grassland"
 * rather than a uniform field. Zones blend at the edges — these are soft
 * regions used to pick ground tint and which props to scatter, not hard walls.
 *
 * Coordinates are world XZ in metres, spanning [-PARK_HALF, +PARK_HALF].
 */

/**
 * Half the side length of the (square) park, in metres. The world spans
 * [-PARK_HALF, +PARK_HALF] on both X and Z — the single source of truth for
 * world size (ground mesh, player clamp, wander bounds, MuJoCo ground geom).
 *
 * Lives here (the lowest-level geometry module) rather than in World.ts so the
 * import graph stays acyclic: World/features/Player all depend on zones, and
 * zones depends on nothing in the game layer. World re-exports it for callers
 * that historically imported it from there.
 */
export const PARK_HALF = 250;

export type ZoneId = 'meadow' | 'woods' | 'lake' | 'grove';

export interface Zone {
  id: ZoneId;
  /** Human label (debug / future HUD). */
  label: string;
  /** Approximate centre of the zone in world XZ. */
  center: { x: number; z: number };
  /** Soft radius — props scatter within roughly this distance of the centre. */
  radius: number;
  /** Base ground tint for this region (blended toward at the centre). */
  groundColor: number;
}

// Layout mirrors the ASCII map in ENVIRONMENT_DESIGN.md §1: meadow centre,
// woods to the north (+Z), lake to the south (-Z), grove to the east (+X).
// Landmarks sit at each zone's signature point (see LANDMARKS below).
export const ZONES: readonly Zone[] = [
  {
    id: 'meadow',
    label: 'Home Meadow',
    center: { x: 0, z: 0 },
    radius: 90,
    groundColor: 0xa6d873, // bright warm yellow-green
  },
  {
    id: 'woods',
    label: 'Deep Woods',
    center: { x: -40, z: 170 },
    radius: 120,
    groundColor: 0x4f8842, // cool dark green
  },
  {
    id: 'lake',
    label: 'Lakeside',
    center: { x: 30, z: -150 },
    radius: 120,
    groundColor: 0x7fb88f, // teal-tinted grass at the shore
  },
  {
    id: 'grove',
    label: 'East Grove',
    center: { x: 175, z: 20 },
    radius: 110,
    groundColor: 0x84c266, // dappled green
  },
];

/** The lake's footprint — a flat water region, blocked at its core (§1, §5.3).
 *  Centre + radius are chosen so the whole footprint fits inside the park
 *  (centre.z - radius > -PARK_HALF) with margin to spare. */
export const LAKE = {
  center: { x: 30, z: -150 },
  /** Visual water radius. */
  radius: 85,
  /** Walkable shoreline band: inside `radius` but outside this is shallow/edge;
   *  inside this is deep water (blocked). Leaves a band for ripple/splash. */
  deepRadius: 66,
};

export interface Landmark {
  id: string;
  zone: ZoneId;
  x: number;
  z: number;
  /** Collider radius for the landmark's solid base (0 = non-blocking). */
  colliderRadius: number;
}

// One+ "weenie" per zone — tall, distinctive, visible across the grassland so
// there is always something to walk toward (ENVIRONMENT_DESIGN.md §2).
export const LANDMARKS: readonly Landmark[] = [
  { id: 'big-oak', zone: 'woods', x: -30, z: 150, colliderRadius: 1.6 },
  { id: 'lookout-bench', zone: 'grove', x: 175, z: 10, colliderRadius: 0.6 },
  // The bridge spans the lake across its centre along +X; non-blocking (you
  // walk on the deck). The collider ring opens a gap along this crossing band.
  { id: 'bridge', zone: 'lake', x: LAKE.center.x, z: LAKE.center.z, colliderRadius: 0 },
  { id: 'fountain', zone: 'meadow', x: 8, z: -10, colliderRadius: 1.1 },
];

/**
 * The zone whose centre is nearest a point, weighted by each zone's radius so
 * larger zones claim more ground. Used to pick ground tint and prop mix.
 */
export function zoneAt(x: number, z: number): Zone {
  let best = ZONES[0];
  let bestScore = Infinity;
  for (const zone of ZONES) {
    const dx = x - zone.center.x;
    const dz = z - zone.center.z;
    // Normalised distance: <1 means inside the soft radius. Smaller wins.
    const score = Math.hypot(dx, dz) / zone.radius;
    if (score < bestScore) {
      bestScore = score;
      best = zone;
    }
  }
  return best;
}

/** True if (x,z) is inside the deep (blocked) water core of the lake. */
export function inDeepWater(x: number, z: number): boolean {
  const dx = x - LAKE.center.x;
  const dz = z - LAKE.center.z;
  return Math.hypot(dx, dz) < LAKE.deepRadius;
}

/** True if (x,z) is within the park bounds with a small margin. */
export function inPark(x: number, z: number, margin = 0): boolean {
  const r = PARK_HALF - margin;
  return x >= -r && x <= r && z >= -r && z <= r;
}
