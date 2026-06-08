import { LAKE, LANDMARKS, type ZoneId } from './zones';

/**
 * Named, interactable scene features — the single source of truth for "what is
 * this thing called and what does it say."
 *
 * Players asked: they couldn't tell what the objects were. So every notable
 * built object (the hero landmarks plus a handful of placed dressing props —
 * signposts, a birdbath, a picnic spot) is registered here with a display
 * **name** and a cozy **description**. The renderer (`World`) builds the mesh at
 * the feature's position; the game (`Game`) raycasts these to show the name on
 * hover, an info card on click, and to send Datou over to investigate.
 *
 * Scattered foliage (trees/rocks/reeds/…) is intentionally NOT individually
 * registered — naming a thousand instances would be noise. POIs (pois.ts) carry
 * their own kind names for the discovery loop. This file is for the singular,
 * walk-toward-able things worth knowing by name.
 *
 * Pure data + a tiny lookup. No THREE imports, so it's cheap to consume from
 * both the build and the interaction layer (and easy to unit-test).
 */

/** Which built mesh a feature uses — tells World which builder to call. */
export type FeatureBuild =
  | 'big-oak'
  | 'lookout-bench'
  | 'fountain'
  | 'bridge'
  | 'home-post'
  | 'signpost'
  | 'birdbath'
  | 'picnic';

export interface Feature {
  /** Stable id (also the landmark id where one exists). */
  id: string;
  /** Player-facing name (shown on hover + as the info-card title). */
  name: string;
  /** A cozy one-or-two-sentence description (the info card body). */
  description: string;
  zone: ZoneId;
  x: number;
  z: number;
  /** Which mesh to build for this feature. */
  build: FeatureBuild;
  /**
   * Click/hover hitbox radius in metres (XZ). Generous so a feature is easy to
   * point at without pixel-hunting its thin geometry.
   */
  hitRadius: number;
  /**
   * Optional facing yaw (radians) for directional builds like signposts.
   */
  yaw?: number;
}

// Look up a landmark's world position by id so feature coords can't drift from
// the collision/POI placement that already uses LANDMARKS.
function lm(id: string): { x: number; z: number; zone: ZoneId } {
  const found = LANDMARKS.find((l) => l.id === id);
  if (!found) throw new Error(`features.ts: no landmark '${id}'`);
  return { x: found.x, z: found.z, zone: found.zone };
}

/**
 * Every named feature in the park. The first four mirror the hero landmarks
 * (so their names/descriptions live in one place); the rest are placed dressing
 * the World also builds. Coordinates outside the landmark set are chosen to sit
 * on open ground near a trail or zone edge.
 */
export const FEATURES: readonly Feature[] = [
  {
    id: 'big-oak',
    name: 'The Big Oak',
    description:
      'The oldest tree in the park, tall enough to see from the home meadow. Datou likes to circle its roots, nose down, reading who passed through.',
    ...lm('big-oak'),
    build: 'big-oak',
    hitRadius: 4,
  },
  {
    id: 'lookout-bench',
    name: 'Lookout Bench',
    description:
      'A weathered bench at the edge of the East Grove. A good place to sit while Datou watches the long grass for movement.',
    ...lm('lookout-bench'),
    build: 'lookout-bench',
    hitRadius: 2.2,
  },
  {
    id: 'bridge',
    name: 'Old Plank Bridge',
    description:
      'An arched wooden footbridge across the lake. The boards knock pleasantly underpaw — Datou always trots across a little faster than it needs to.',
    ...lm('bridge'),
    build: 'bridge',
    hitRadius: 3,
  },
  {
    id: 'fountain',
    name: 'Meadow Fountain',
    description:
      'A small tiered stone fountain near home. The trickle is the first sound you hear each visit. Birds bathe here when no one is looking.',
    ...lm('fountain'),
    build: 'fountain',
    hitRadius: 2.4,
  },
  {
    id: 'home-post',
    name: 'Home Post',
    description:
      'The signpost by the spawn — the heart of the park and where shared discoveries come home to. Start and end your walk here.',
    zone: 'meadow',
    x: 0,
    z: -2,
    build: 'home-post',
    hitRadius: 1.6,
  },
  // --- Placed dressing features (also built by World) ---
  {
    id: 'birdbath',
    name: 'Stone Birdbath',
    description:
      'A mossy birdbath the meadow songbirds adore. Datou keeps a respectful distance and just… watches.',
    zone: 'meadow',
    x: -14,
    z: 12,
    build: 'birdbath',
    hitRadius: 1.4,
  },
  {
    id: 'picnic-spot',
    name: 'Picnic Spot',
    description:
      'A checked blanket and a wicker basket, laid out in the sun. The coziest corner of the meadow to rest a while together.',
    zone: 'meadow',
    x: 18,
    z: 16,
    build: 'picnic',
    hitRadius: 1.8,
  },
  {
    id: 'signpost-woods',
    name: 'Woods Trailhead',
    description:
      'A trail sign pointing north into the Deep Woods. Cooler, darker, denser — where curiosity tends to lead.',
    zone: 'meadow',
    x: -10,
    z: 30,
    build: 'signpost',
    hitRadius: 1.6,
    yaw: Math.atan2(-30 - -10, 150 - 30), // face toward the Big Oak
  },
  {
    id: 'signpost-lake',
    name: 'Lakeside Trailhead',
    description:
      'A trail sign pointing south to the Lakeside. Reeds, lily pads, and the old plank bridge wait at the water.',
    zone: 'meadow',
    x: 12,
    z: -28,
    build: 'signpost',
    hitRadius: 1.6,
    yaw: Math.atan2(LAKE.center.x - 12, LAKE.center.z - -28), // face the lake
  },
  {
    id: 'signpost-grove',
    name: 'Grove Trailhead',
    description:
      'A trail sign pointing east to the Grove. Dappled light, scattered shinies, and the Lookout Bench lie that way.',
    zone: 'meadow',
    x: 34,
    z: 6,
    build: 'signpost',
    hitRadius: 1.6,
    yaw: Math.atan2(175 - 34, 10 - 6), // face the grove
  },
];

/** Feature lookup by id (e.g. to resolve a raycast hit back to its data). */
export function featureById(id: string): Feature | undefined {
  return FEATURES.find((f) => f.id === id);
}

/** Features that World should build as placed dressing (i.e. not the hero
 *  landmarks, which World already builds from LANDMARKS, nor the home post). */
export function placedFeatures(): Feature[] {
  return FEATURES.filter(
    (f) => f.build === 'signpost' || f.build === 'birdbath' || f.build === 'picnic',
  );
}
