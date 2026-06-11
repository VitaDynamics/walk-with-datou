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

export type LandmarkId = 'repair-commons' | 'pump-garden' | 'relay-camp';

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
    coffer: { x: -119, z: -108.5, blueprintForm: 'wayfinder', materials: { 'old-bolt': 3, pebble: 2 } },
    // The next mystery is the ruin stones — already standing, not a landmark.
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
  { x: d.center.x, z: d.center.z, r: 26, density: 0.4 },
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
}

export const LANDMARKS_VERSION = 1;

export class LandmarkField {
  readonly areas: LandmarkArea[];
  /** Set once the scripted first want toward the Commons has played. */
  firstHookDone = false;
  /** The garden donation socket holds the player's planter. */
  socketFilled = false;

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

  /** Nearest still-unseen area whose notice radius contains the point (§6). */
  nearestNoticeable(x: number, z: number): LandmarkArea | null {
    let best: LandmarkArea | null = null;
    let bestD = Infinity;
    for (const a of this.areas) {
      if (a.progress !== 'unseen') continue;
      const d = Math.hypot(a.def.center.x - x, a.def.center.z - z);
      if (d <= a.def.noticeRadius && d < bestD) {
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
  }
}
