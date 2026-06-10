/**
 * Glade layout — the single source of truth for where the major plates stand
 * and how big their colliders are. Pure data: imported by the Diorama (for
 * rendering) and by createPhysics (to bake obstacles into the MuJoCo model
 * before the renderer exists).
 */

import type { WorldCollider } from '../physics/PhysicsAdapter';

export interface MajorProp {
  kind: 'tree' | 'rock' | 'bush' | 'stump' | 'lamp';
  x: number;
  z: number;
  height: number;
  shadowRadius: number;
  /** Solid footprint; omitted = walk-through. */
  colliderRadius?: number;
  /** Sprite seed (stable per placement). */
  seed: number;
}

export const MAJOR_PROPS: readonly MajorProp[] = [
  {
    kind: 'tree',
    x: -3.6,
    z: -2.2,
    height: 4.4,
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
  {
    kind: 'rock',
    x: 4.15,
    z: -0.7,
    height: 0.62,
    shadowRadius: 0.55,
    colliderRadius: 0.4,
    seed: 22,
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
];

/** The resting pad — "your spot". Walkable (no collider). */
export const PAD_POSITION = { x: 0, z: 3.2 } as const;

/** Hiding places for the daily discoveries (near the landmarks). Each `place`
 *  id must have a `place.<id>` string in i18n (a test enforces this). */
export const SPOT_ANCHORS = [
  { place: 'under-tree', x: -2.6, z: -1.4 },
  { place: 'behind-rock', x: 3.9, z: -2.4 },
  { place: 'by-stump', x: 1.5, z: -2.8 },
  { place: 'under-bush', x: -2.7, z: 2.4 },
  { place: 'glade-east', x: 5.0, z: 0.9 },
  { place: 'glade-north', x: 0.4, z: -4.7 },
  { place: 'by-lamp', x: 2.6, z: 2.8 },
] as const;

/** Colliders for the physics backends (placeholder push-out / MuJoCo geoms). */
export function gladeColliders(): WorldCollider[] {
  return MAJOR_PROPS.filter((p) => p.colliderRadius).map((p) => ({
    x: p.x,
    z: p.z,
    radius: p.colliderRadius!,
  }));
}
