import type * as THREE from 'three';
import type { ZoneId } from '../zones';
import type { Verb } from './verbs';

/**
 * The item catalog (docs/quadruped-game-design-research.md "reward density"):
 * a data-driven registry of every *kind* of thing that can dress the park —
 * scaling to ~1000 kinds, ~500 interactable — unifying the hand-built
 * procedural props (props.ts) and downloaded CC0 GLB models (assets/) behind a
 * single `ItemKind` interface.
 *
 * Nothing downstream (scatter, colliders, interaction) branches on
 * procedural-vs-GLB: it all reads `footprintRadius` / `blocking` / `verbs` /
 * `zones` / `spawnWeight`. The only seam is `mesh: MeshSource`.
 */

/** How an item's mesh is produced. The single seam between procedural + GLB. */
export type MeshSource =
  | {
      /** A procedural geometry factory (props.ts *Geometry()) → one InstancedMesh. */
      kind: 'procedural';
      build: () => { geo: THREE.BufferGeometry; mat: THREE.Material };
    }
  | {
      /** A procedural Group factory (props.ts build*()) for one-off hero props. */
      kind: 'procedural-group';
      build: () => THREE.Object3D;
    }
  | {
      /** A downloaded GLB, loaded lazily by ModelLoader. `url` is public/-relative. */
      kind: 'gltf';
      url: string;
    };

/** Broad grouping used for spawn defaults, manifest folders, and zone tuning. */
export type ItemCategory =
  | 'tree'
  | 'shrub'
  | 'flower'
  | 'grass'
  | 'fern'
  | 'mushroom'
  | 'vine'
  | 'crop'
  | 'rock'
  | 'log'
  | 'terrain'
  | 'water'
  | 'infrastructure'
  | 'play' // playground equipment
  | 'animal'
  | 'food'
  | 'toy'
  | 'tool'
  | 'decor'
  | 'collectible'
  | 'seasonal'
  | 'ambient'
  | 'container';

/** One kind of thing that can populate the park. */
export interface ItemKind {
  /** Stable unique id; also the GLB filename stem for gltf kinds. */
  id: string;
  name: string;
  category: ItemCategory;
  mesh: MeshSource;

  /** Physical XZ radius at scale 1 (0 = flat/no footprint). */
  footprintRadius: number;
  /** Contributes a static collider (player walks around it). */
  blocking: boolean;
  /**
   * Tiny/numerous blocker: still blocks the player kinematically, but is dropped
   * from the MuJoCo physics set (mirrors World.Collider.minor). Only meaningful
   * when `blocking`.
   */
  minorCollider?: boolean;

  interactable: boolean;
  /** Which interaction verbs this kind supports (empty ⇔ decorative). */
  verbs: ReadonlySet<Verb>;

  /** Eligible zones ([] = any land zone). */
  zones: readonly ZoneId[];
  /** Relative density within eligible zones (0 ⇒ never auto-scattered). */
  spawnWeight: number;
  /** Uniform-scale range applied per instance. */
  scaleRange: readonly [number, number];

  /** Mass for the push/throw integrator (movable kinds). Default 1. */
  mass?: number;
  /** Override footprintRadius for collision if the visual differs. */
  collider?: number;
  /** Opt-in intentional persistence (souvenirs, tidying) — ENV §4.2.4. */
  persistent?: boolean;

  /** License tag — the catalog is CC0-only; procedural props are 'procedural'. */
  license: 'CC0' | 'procedural';
}
