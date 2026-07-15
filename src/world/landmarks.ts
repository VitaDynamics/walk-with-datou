/**
 * Landmark areas — the authored community places the park leads to
 * (COMMUNITY_LANDMARK_PLAN). Each area is a handmade composition with a
 * Datou-sensed approach, one cooperative activity, and a community supply
 * coffer whose reward is a full blueprint + the exact materials to build it
 * once. Discovery is companion-led: Datou notices an `unseen` area from its
 * notice radius and the player follows his attention — no map markers.
 *
 * Pure logic + data (no THREE, no storage): the Game layer renders the props,
 * drives transitions from positions, and persists via serialize()/restore()
 * under `wwd.landmarks` (versioned, like `wwd.workshop`).
 */

import type { FormId } from '../game/workshop/forms';
import type { MaterialId } from '../game/workshop/materials';

export type LandmarkId =
  | 'repair-commons'
  | 'pump-garden'
  | 'relay-camp'
  | 'ruin-stones'
  | 'watch-knoll'
  | 'meadow-orchard'
  | 'stepping-stones'
  | 'willow-bend'
  | 'frog-shallows'
  | 'lantern-walk'
  | 'boardwalk-rest'
  | 'driftwood-beach'
  | 'kite-field'
  | 'gate-arch'
  | 'beacon-rise'
  | 'star-circle'
  | 'fern-hollow'
  | 'quarry-scar'
  | 'hollow-oak'
  | 'swing-tree'
  | 'bee-meadow';

/**
 * How far the player has come with a place:
 * unseen → noticed (Datou gave the notice beat) → arrived (stepped into the
 * activity ring) → completed (the cooperative activity is done). Finding a
 * later area first is valid — transitions only ever move forward.
 */
export type LandmarkProgress = 'unseen' | 'noticed' | 'arrived' | 'completed';

const PROGRESS_ORDER: readonly LandmarkProgress[] = ['unseen', 'noticed', 'arrived', 'completed'];

export interface LandmarkDef {
  readonly id: LandmarkId;
  /** Heart of the composition (the activity lives here). */
  readonly center: { readonly x: number; readonly z: number };
  /** Datou senses the area from this far while it is still unseen (§6). */
  readonly noticeRadius: number;
  /** The activity ring — kept clear of generic scatter; arrival triggers here. */
  readonly activityRadius: number;
  /** The community supply coffer (placed off the main face, §9). */
  readonly coffer: {
    readonly x: number;
    readonly z: number;
    /** Form whose authored EXACT_PATTERN is granted fully revealed. */
    readonly blueprintForm: FormId;
    /** Exactly one build's worth of starter materials. */
    readonly materials: Readonly<Partial<Record<MaterialId, number>>>;
  };
  /** The diegetic clue at this area points toward… (qualities, never arrows). */
  readonly clueTo?: LandmarkId;
}

/** A selected landmark object that can explain itself when tapped. */
export interface LandmarkInspection {
  readonly key: string;
  readonly area: LandmarkId;
  readonly x: number;
  readonly z: number;
  /** Height of the floating label anchor above the ground. */
  readonly y: number;
  readonly radius: number;
}

/**
 * Focal objects across the landmark network. These are intentionally selective:
 * enough to make each place readable without turning every decorative plate
 * into a UI target.
 */
export const LANDMARK_INSPECTIONS: readonly LandmarkInspection[] = [
  { key: 'pennant-mast', area: 'repair-commons', x: 132, z: -26, y: 7.2, radius: 2.3 },
  { key: 'message-chime', area: 'repair-commons', x: 127.5, z: -30.5, y: 1.9, radius: 1.8 },
  { key: 'pump-wheel', area: 'pump-garden', x: 14, z: 108, y: 3.4, radius: 2.1 },
  { key: 'floating-planter', area: 'pump-garden', x: 15, z: 119, y: 1.0, radius: 1.8 },
  { key: 'relay-mast', area: 'relay-camp', x: -114, z: -104, y: 6.3, radius: 2.2 },
  { key: 'signal-vane', area: 'relay-camp', x: -111, z: -107, y: 1.6, radius: 1.6 },
  { key: 'marked-stone', area: 'ruin-stones', x: 169.5, z: -163.5, y: 2.1, radius: 1.8 },
  { key: 'spotter-tube', area: 'watch-knoll', x: -96.5, z: 88.5, y: 1.7, radius: 1.7 },
  { key: 'orchard-sapling', area: 'meadow-orchard', x: 61, z: -109, y: 2.1, radius: 1.7 },
  { key: 'stepping-stones', area: 'stepping-stones', x: -72, z: 28, y: 0.8, radius: 2.3 },
  { key: 'willow-tree', area: 'willow-bend', x: -38, z: 92, y: 4.7, radius: 2.4 },
  { key: 'marsh-pool', area: 'frog-shallows', x: -45, z: 160, y: 0.8, radius: 2.5 },
  { key: 'lantern-avenue', area: 'lantern-walk', x: 4, z: 70, y: 2.0, radius: 2.3 },
  { key: 'old-boardwalk', area: 'boardwalk-rest', x: 82, z: 138, y: 0.9, radius: 2.5 },
  { key: 'driftwood-arch', area: 'driftwood-beach', x: 96, z: 188, y: 2.6, radius: 2.0 },
  { key: 'kite-post', area: 'kite-field', x: 150, z: 90, y: 3.0, radius: 2.1 },
  { key: 'meadow-gate', area: 'gate-arch', x: 172, z: -78, y: 2.8, radius: 2.1 },
  { key: 'beacon-basket', area: 'beacon-rise', x: 118, z: -150, y: 3.8, radius: 2.1 },
  { key: 'star-stone', area: 'star-circle', x: -6.1, z: -168.4, y: 1.0, radius: 1.6 },
  { key: 'hollow-oak', area: 'hollow-oak', x: -65, z: -45, y: 4.2, radius: 2.4 },
  { key: 'swing-board', area: 'swing-tree', x: -34, z: -70, y: 2.8, radius: 2.2 },
  { key: 'hive-stand', area: 'bee-meadow', x: 38, z: -64, y: 1.7, radius: 1.8 },
  { key: 'giant-fern', area: 'fern-hollow', x: -160, z: -145, y: 1.9, radius: 1.8 },
  { key: 'quarry-face', area: 'quarry-scar', x: -185, z: -10, y: 3.1, radius: 2.4 },
];

/**
 * The first three areas (§7). Centers sit on the existing layout anchors:
 * the east-trail cluster, the lake jetty reed bank, and the Old Pine.
 */
export const LANDMARK_DEFS: readonly LandmarkDef[] = [
  {
    // A. The Trail Repair Commons — friendly volunteer repair stop. Heart is
    // the existing bench (128,−32) · signpost (124,−28) · bulletin (121,−22).
    id: 'repair-commons',
    center: { x: 126, z: -28 },
    noticeRadius: 70,
    activityRadius: 10,
    // Tucked under the bulletin-board steps, read from the back of the heart.
    coffer: { x: 120, z: -20.5, blueprintForm: 'chime', materials: { flower: 4, feather: 1 } },
    clueTo: 'pump-garden',
  },
  {
    // B. The Reedwater Pump Garden — on the shore by the jetty (21,122),
    // behind the reed screen the lake-rim scatter already grows.
    id: 'pump-garden',
    center: { x: 14, z: 110 },
    noticeRadius: 70,
    activityRadius: 10,
    // Lodged in a dry side channel behind the rest platform.
    coffer: { x: 7, z: 105, blueprintForm: 'planter', materials: { twig: 7, reed: 1 } },
    clueTo: 'relay-camp',
  },
  {
    // C. The Old Pine Relay Camp — sheltered under the Old Pine (−120,−110),
    // beside the mushroom ring. Its response tone points at the ruin stones.
    id: 'relay-camp',
    center: { x: -114, z: -104 },
    noticeRadius: 70,
    activityRadius: 10,
    // A narrow field case in the hollow beneath the Old Pine.
    coffer: {
      x: -119,
      z: -108.5,
      blueprintForm: 'wayfinder',
      materials: { 'old-bolt': 3, pebble: 2 },
    },
    clueTo: 'ruin-stones',
  },
  {
    // D. The Ruin Stones — the park's first shelter, far NE corner. The relay
    // response originates here; the ring-and-notch mark is traced with Datou,
    // and the recovered network sketch opens the west and north areas.
    id: 'ruin-stones',
    center: { x: 168, z: -160 },
    noticeRadius: 75,
    activityRadius: 11,
    // An old waxed satchel beneath the fallen lintel stone.
    coffer: {
      x: 163.5,
      z: -157,
      blueprintForm: 'lantern',
      materials: { reed: 3, feather: 1, twig: 2 },
    },
    clueTo: 'watch-knoll',
  },
  {
    // E. The Watchers' Knoll — a birdwatching rise in the south-west meadow.
    id: 'watch-knoll',
    center: { x: -98, z: 88 },
    noticeRadius: 65,
    activityRadius: 9,
    // The watchers' weathered kit chest in the long grass.
    coffer: { x: -94, z: 91, blueprintForm: 'field-glass', materials: { 'old-bolt': 2, twig: 2 } },
    clueTo: 'meadow-orchard',
  },
  {
    // F. The Meadow Orchard — planted rows in the high north meadow.
    id: 'meadow-orchard',
    center: { x: 60, z: -110 },
    noticeRadius: 65,
    activityRadius: 10,
    // The planters' seed chest at the row end.
    coffer: { x: 55, z: -106, blueprintForm: 'bug-hotel', materials: { twig: 7, flower: 2 } },
  },

  // --- The light landmarks (map-fill wave): smaller hearts, one tend-beat
  // each, found along the connective features — the stream, the boardwalk,
  // the mown strip, the fence line, cairn lines, footprint trails, the
  // flower drift, the forest corridor, and the old cart ruts.

  // Along the STREAM (woods → lake west shore).
  {
    id: 'stepping-stones',
    center: { x: -72, z: 28 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: -68, z: 31, blueprintForm: 'path-tile', materials: { pebble: 6 } },
    clueTo: 'willow-bend',
  },
  {
    id: 'willow-bend',
    center: { x: -38, z: 92 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: -42, z: 95, blueprintForm: 'garland', materials: { flower: 6 } },
    clueTo: 'frog-shallows',
  },
  {
    id: 'frog-shallows',
    center: { x: -45, z: 160 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: -41, z: 156, blueprintForm: 'raft', materials: { reed: 2, twig: 9 } },
  },
  // Along the PAVEMENTS (the lantern avenue; the lakeshore boardwalk).
  {
    id: 'lantern-walk',
    center: { x: 4, z: 70 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: 8, z: 66, blueprintForm: 'lamp', materials: { 'old-bolt': 2, twig: 3 } },
    clueTo: 'boardwalk-rest',
  },
  {
    id: 'boardwalk-rest',
    center: { x: 82, z: 138 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: 80, z: 143, blueprintForm: 'bridge-plank', materials: { twig: 9 } },
    clueTo: 'driftwood-beach',
  },
  {
    id: 'driftwood-beach',
    center: { x: 96, z: 188 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: 92, z: 184, blueprintForm: 'archway', materials: { twig: 11 } },
  },
  // The MOWN STRIP through the tall south-east meadow.
  {
    id: 'kite-field',
    center: { x: 150, z: 90 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: {
      x: 146,
      z: 86,
      blueprintForm: 'wind-vane',
      materials: { 'old-bolt': 2, feather: 1, twig: 2 },
    },
    clueTo: 'gate-arch',
  },
  // The FENCE LINE along the east edge.
  {
    id: 'gate-arch',
    center: { x: 172, z: -78 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: 168, z: -74, blueprintForm: 'gate', materials: { twig: 12 } },
    clueTo: 'beacon-rise',
  },
  // The CAIRN LINE (orchard → beacon → ruins).
  {
    id: 'beacon-rise',
    center: { x: 118, z: -150 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: 114, z: -146, blueprintForm: 'lookout-perch', materials: { twig: 12 } },
    clueTo: 'star-circle',
  },
  // FOOTPRINT TRAILS through the open north and west meadow.
  {
    id: 'star-circle',
    center: { x: -10, z: -170 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: -6, z: -166, blueprintForm: 'mobile', materials: { feather: 3, flower: 1 } },
    clueTo: 'fern-hollow',
  },
  {
    id: 'hollow-oak',
    center: { x: -65, z: -45 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: -61, z: -41, blueprintForm: 'cache-box', materials: { twig: 7, 'old-bolt': 1 } },
    clueTo: 'swing-tree',
  },
  {
    id: 'swing-tree',
    center: { x: -34, z: -70 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: -30, z: -66, blueprintForm: 'cord', materials: { reed: 3 } },
    clueTo: 'bee-meadow',
  },
  // The FLOWER DRIFT north of home.
  {
    id: 'bee-meadow',
    center: { x: 38, z: -64 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: 42, z: -60, blueprintForm: 'vessel', materials: { pebble: 7 } },
    clueTo: 'meadow-orchard',
  },
  // The FOREST CORRIDOR deep in the north-west woods.
  {
    id: 'fern-hollow',
    center: { x: -160, z: -145 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: -156, z: -141, blueprintForm: 'brush', materials: { reed: 1, twig: 2 } },
    clueTo: 'quarry-scar',
  },
  // The CART RUTS out to the old quarry, far west.
  {
    id: 'quarry-scar',
    center: { x: -185, z: -10 },
    noticeRadius: 60,
    activityRadius: 9,
    coffer: { x: -181, z: -14, blueprintForm: 'well', materials: { pebble: 13 } },
    clueTo: 'hollow-oak',
  },
];

/** Scatter exclusion/damping around the authored hearts (consulted by scatter). */
export interface Clearing {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  /** Keep-probability for scatter inside the circle (0 = full exclusion). */
  readonly density: number;
}

/** Per area: a clear activity ring, then a damped approach ring around it.
 *  Order matters — placeable() honours the first containing circle. */
export const CLEARINGS: readonly Clearing[] = LANDMARK_DEFS.flatMap((d) => [
  { x: d.center.x, z: d.center.z, r: d.activityRadius, density: 0 },
  { x: d.center.x, z: d.center.z, r: 30, density: 0.4 },
]);

export interface LandmarkArea {
  readonly def: LandmarkDef;
  progress: LandmarkProgress;
  cofferOpened: boolean;
}

interface SavedArea {
  id: LandmarkId;
  progress: LandmarkProgress;
  cofferOpened: boolean;
}

export interface LandmarksSave {
  v: number;
  areas: SavedArea[];
  /** The one scripted first-hook want toward the Commons fired already (§6). */
  firstHookDone: boolean;
  /** The garden's donation socket holds the player's crafted planter (§7B). */
  socketFilled?: boolean;
  /** A crafted chime was donated to the Commons (§9 intended first use). */
  chimeDonated?: boolean;
  /** The volunteers' time capsule under the Old Pine was found (Phase 3). */
  capsuleFound?: boolean;
}

export const LANDMARKS_VERSION = 1;

export class LandmarkField {
  readonly areas: LandmarkArea[];
  /** Set once the scripted first want toward the Commons has played. */
  firstHookDone = false;
  /** The garden donation socket holds the player's planter. */
  socketFilled = false;
  /** A crafted chime hangs at the Commons. */
  chimeDonated = false;
  /** The Old Pine time capsule was found. */
  capsuleFound = false;

  constructor(defs: readonly LandmarkDef[] = LANDMARK_DEFS) {
    this.areas = defs.map((def) => ({ def, progress: 'unseen', cofferOpened: false }));
  }

  get(id: LandmarkId): LandmarkArea | undefined {
    return this.areas.find((a) => a.def.id === id);
  }

  /** Forward-only progress; returns true when the state actually advanced. */
  private advance(id: LandmarkId, to: LandmarkProgress): boolean {
    const area = this.get(id);
    if (!area) return false;
    if (PROGRESS_ORDER.indexOf(to) <= PROGRESS_ORDER.indexOf(area.progress)) return false;
    area.progress = to;
    return true;
  }

  /** Datou gave the notice beat. */
  notice(id: LandmarkId): boolean {
    const area = this.get(id);
    if (!area || area.progress !== 'unseen') return false;
    return this.advance(id, 'noticed');
  }

  /** The player stepped into the activity ring (valid from any earlier state). */
  arrive(id: LandmarkId): boolean {
    return this.advance(id, 'arrived');
  }

  /** The cooperative activity finished (early discovery completes normally). */
  complete(id: LandmarkId): boolean {
    return this.advance(id, 'completed');
  }

  /** Open the supply coffer exactly once. */
  openCoffer(id: LandmarkId): boolean {
    const area = this.get(id);
    if (!area || area.cofferOpened) return false;
    area.cofferOpened = true;
    return true;
  }

  /** Nearest still-unseen area whose notice radius contains the point (§6).
   *  `radiusScale` lets personality shade the sense range (presentation only). */
  nearestNoticeable(x: number, z: number, radiusScale = 1): LandmarkArea | null {
    let best: LandmarkArea | null = null;
    let bestD = Infinity;
    for (const a of this.areas) {
      if (a.progress !== 'unseen') continue;
      const d = Math.hypot(a.def.center.x - x, a.def.center.z - z);
      if (d <= a.def.noticeRadius * radiusScale && d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  /** The area whose activity ring contains the point, if any. */
  areaAt(x: number, z: number): LandmarkArea | null {
    for (const a of this.areas) {
      if (Math.hypot(a.def.center.x - x, a.def.center.z - z) <= a.def.activityRadius) return a;
    }
    return null;
  }

  /** Nearest area with an unopened coffer within `maxDist` of the point. */
  nearestUnopenedCoffer(x: number, z: number, maxDist: number): LandmarkArea | null {
    let best: LandmarkArea | null = null;
    let bestD = maxDist;
    for (const a of this.areas) {
      if (a.cofferOpened) continue;
      const d = Math.hypot(a.def.coffer.x - x, a.def.coffer.z - z);
      if (d <= bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  serialize(): LandmarksSave {
    return {
      v: LANDMARKS_VERSION,
      areas: this.areas.map((a) => ({
        id: a.def.id,
        progress: a.progress,
        cofferOpened: a.cofferOpened,
      })),
      firstHookDone: this.firstHookDone,
      socketFilled: this.socketFilled,
      chimeDonated: this.chimeDonated,
      capsuleFound: this.capsuleFound,
    };
  }

  /** Tolerant restore: unknown ids and malformed fields are ignored. */
  restore(save: unknown): void {
    if (!save || typeof save !== 'object') return;
    const s = save as Partial<LandmarksSave>;
    if (Array.isArray(s.areas)) {
      for (const raw of s.areas) {
        if (!raw || typeof raw !== 'object') continue;
        const area = this.get((raw as SavedArea).id);
        if (!area) continue;
        const p = (raw as SavedArea).progress;
        if (PROGRESS_ORDER.includes(p)) area.progress = p;
        if ((raw as SavedArea).cofferOpened === true) area.cofferOpened = true;
      }
    }
    if (s.firstHookDone === true) this.firstHookDone = true;
    if (s.socketFilled === true) this.socketFilled = true;
    if (s.chimeDonated === true) this.chimeDonated = true;
    if (s.capsuleFound === true) this.capsuleFound = true;
  }
}
