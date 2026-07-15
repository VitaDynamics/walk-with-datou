/**
 * Resource-node charge state (BUILDING_SYSTEM §8.1, §9).
 *
 *     wwd.nodes = { [nodeId]: { charges, lastRefresh } }
 *
 * Each node holds daily charges that refresh on a date-seeded schedule and
 * regrow over `regrowDays` with visible stages. Anti-FOMO: nodes always come
 * back. Pure-ish (localStorage only); the refresh is a function of the current
 * day vs lastRefresh, so it's deterministic and offline-safe.
 */

import { NODE_DEFS, NODE_PLACEMENTS, harvestState, type HarvestState, type NodeType } from './nodes';

interface NodeCharge {
  charges: number;
  /** Day index (yyyymmdd) of the last refresh. */
  lastRefresh: number;
}

const KEY = 'wwd.nodes';

function dayIndex(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export class NodeState {
  private state = new Map<string, NodeCharge>();
  private readonly storageKey: string;

  constructor(storageKey = KEY) {
    this.storageKey = storageKey;
    this.load();
  }

  private defFor(nodeId: string): { type: NodeType } | null {
    return NODE_PLACEMENTS.find((p) => p.id === nodeId) ?? null;
  }

  /**
   * Charges available right now, applying any due refresh/regrow. A node
   * regrows one full charge-set every `regrowDays` since its last refresh;
   * within the same day it stays as worked.
   */
  charges(nodeId: string, date: Date = new Date()): number {
    const placement = this.defFor(nodeId);
    if (!placement) return 0;
    const def = NODE_DEFS[placement.type];
    const today = dayIndex(date);
    const cur = this.state.get(nodeId);
    if (!cur) return def.charges; // pristine
    // Days elapsed (coarse: yyyymmdd diff is fine for whole-day cadence).
    const elapsed = daysBetween(cur.lastRefresh, today);
    if (elapsed >= def.regrowDays) return def.charges; // fully regrown
    return cur.charges;
  }

  max(nodeId: string): number {
    const placement = this.defFor(nodeId);
    return placement ? NODE_DEFS[placement.type].charges : 0;
  }

  state_(nodeId: string, date: Date = new Date()): HarvestState {
    return harvestState(this.charges(nodeId, date), this.max(nodeId));
  }

  /** Spend one charge (one worked beat). Returns the remaining count. */
  spend(nodeId: string, date: Date = new Date()): number {
    const remaining = Math.max(0, this.charges(nodeId, date) - 1);
    this.state.set(nodeId, { charges: remaining, lastRefresh: dayIndex(date) });
    this.save();
    return remaining;
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(Object.fromEntries(this.state)));
    } catch {
      // Session-only.
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, NodeCharge>;
      for (const [k, v] of Object.entries(d)) {
        if (typeof v?.charges === 'number' && typeof v?.lastRefresh === 'number') {
          this.state.set(k, v);
        }
      }
    } catch {
      // Corrupt — start fresh.
    }
  }
}

/** Whole calendar-days between two yyyymmdd indices (approximate, monotone). */
function daysBetween(a: number, b: number): number {
  const toDate = (n: number) =>
    new Date(Math.floor(n / 10000), (Math.floor(n / 100) % 100) - 1, n % 100);
  const ms = toDate(b).getTime() - toDate(a).getTime();
  return Math.floor(ms / 86_400_000);
}
