/**
 * Zones — the world's regions, per the research doc's scene types:
 * Home Base (center), Community Trail (east), Woods (north-west, semi-wild),
 * Lakeside (south), and open meadow between. Pure data + math; rendering
 * tints and scatter densities key off these.
 */

export const WORLD_HALF = 250;
/** Anything that walks is clamped inside this radius. */
export const WORLD_WALK_RADIUS = 245;

export type ZoneId = 'home' | 'trail' | 'woods' | 'lake' | 'meadow';

export interface Zone {
  id: ZoneId;
  /** Zone heart — paths run from home to here; discoveries cluster nearby. */
  x: number;
  z: number;
  radius: number;
}

/** Order matters: first zone containing the point wins; meadow is the rest. */
export const ZONES: readonly Zone[] = [
  { id: 'home', x: 0, z: 0, radius: 16 },
  { id: 'woods', x: -120, z: -110, radius: 95 },
  { id: 'lake', x: 30, z: 150, radius: 90 },
  { id: 'trail', x: 130, z: -30, radius: 75 },
  { id: 'meadow', x: 0, z: 0, radius: WORLD_HALF * 2 },
];

export function zoneAt(x: number, z: number): Zone {
  for (const zone of ZONES) {
    if (Math.hypot(x - zone.x, z - zone.z) <= zone.radius) return zone;
  }
  return ZONES[ZONES.length - 1];
}

/** The named (non-meadow) zones, for paths/suggestions/discovery anchors. */
export const DESTINATION_ZONES: readonly Zone[] = ZONES.filter(
  (z) => z.id !== 'meadow' && z.id !== 'home',
);
