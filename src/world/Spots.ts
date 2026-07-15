/**
 * Discovery spots — the diorama's hidden small things.
 *
 * Each day the glade hides a handful of tiny discoveries (a sprout, a shiny
 * pebble, a feather…) near its landmarks. They are invisible until found:
 * Datou senses them (curious wants gaze toward them); guiding it there
 * reveals the find, grants bond, and writes a shared memory. Selection is
 * seeded — same seed (the date), same hiding places — so "what's hidden
 * today" is a daily reason to visit, and replays are deterministic.
 *
 * Pure logic: no THREE, no storage. The game layer renders + persists.
 */

import { Rng } from '../physics/mujoco/rng';
import type { DiscoveryArt } from '../art/props';

export interface SpotAnchor {
  /** Stable id of the hiding place (also the i18n key suffix). */
  place: string;
  x: number;
  z: number;
}

export interface Spot {
  id: number;
  place: string;
  art: DiscoveryArt;
  x: number;
  z: number;
  found: boolean;
}

const ART_KINDS: readonly DiscoveryArt[] = ['sprout', 'shiny', 'feather', 'mushroom', 'ladybug'];

export const SPOTS_PER_DAY = 6;

/** Seed for "today" — yyyymmdd as an int, so hiding places rotate daily. */
export function dailySeed(date: Date = new Date()): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/** Storage key suffix for the day, so found-state resets each morning. */
export function dailyKey(date: Date = new Date()): string {
  return String(dailySeed(date));
}

export class SpotField {
  readonly spots: Spot[];

  constructor(seed: number, anchors: readonly SpotAnchor[], count = SPOTS_PER_DAY) {
    const rng = new Rng(seed);
    // Shuffle anchors deterministically and take the first `count`.
    const pool = [...anchors];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.spots = pool.slice(0, Math.min(count, pool.length)).map((a, i) => ({
      id: i,
      place: a.place,
      art: ART_KINDS[Math.floor(rng.next() * ART_KINDS.length)],
      // Small jitter so the same hiding place isn't pixel-identical every day.
      x: a.x + (rng.next() * 2 - 1) * 0.5,
      z: a.z + (rng.next() * 2 - 1) * 0.5,
      found: false,
    }));
  }

  get foundCount(): number {
    return this.spots.filter((s) => s.found).length;
  }

  get(id: number): Spot | undefined {
    return this.spots.find((s) => s.id === id);
  }

  /** Nearest not-yet-found spot within `maxDist` of (x, z), or null. */
  nearestUndiscovered(x: number, z: number, maxDist: number): Spot | null {
    let best: Spot | null = null;
    let bestD = maxDist;
    for (const s of this.spots) {
      if (s.found) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d <= bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  markFound(id: number): Spot | null {
    const s = this.get(id);
    if (!s || s.found) return null;
    s.found = true;
    return s;
  }

  /** Restore previously-found ids (same-day reload). */
  restoreFound(ids: readonly number[]): void {
    for (const id of ids) {
      const s = this.get(id);
      if (s) s.found = true;
    }
  }

  foundIds(): number[] {
    return this.spots.filter((s) => s.found).map((s) => s.id);
  }
}
