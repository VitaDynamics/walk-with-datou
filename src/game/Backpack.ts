/**
 * Backpack — the satchel you carry on walks (the Don't Starve loop, softened):
 * gather small things from the world, craft them into keepsakes and toys,
 * place some of them back into the world. Counts persist across sessions.
 */

export type ResourceId = 'twig' | 'pebble' | 'berry' | 'flower' | 'mushroom' | 'pinecone';
/** Coffer-granted finds — not gatherable from the ground, but they sit in the
 *  pack and feed the Workshop bench like any material (landmark plan §9). */
export type FoundId = 'feather' | 'reed' | 'old-bolt';
export type CraftedId =
  // tier 1 — components & keepsakes
  | 'bundle'
  | 'stonepile'
  | 'stick'
  | 'garland'
  // tier 2 — furnishings
  | 'fence'
  | 'cairn'
  | 'lantern'
  | 'campfire'
  | 'plot'
  | 'bench'
  | 'birdbath'
  | 'windchime'
  // tier 3 — structures
  | 'shelter'
  | 'archway';
export type ItemId = ResourceId | FoundId | CraftedId;
/** Anything the pack can hold: the ids above, plus Workshop-made generative
 *  ItemIds (`form:material:size:finish`). `string & {}` keeps the literal
 *  autocomplete while accepting the open id space. */
export type PackId = ItemId | (string & {});

export const RESOURCE_IDS: readonly ResourceId[] = [
  'twig',
  'pebble',
  'berry',
  'flower',
  'mushroom',
  'pinecone',
];

export class Backpack {
  private readonly counts = new Map<PackId, number>();
  private readonly listeners = new Set<() => void>();
  private readonly storageKey: string;

  constructor(storageKey = 'wwd.backpack') {
    this.storageKey = storageKey;
    this.load();
  }

  count(id: PackId): number {
    return this.counts.get(id) ?? 0;
  }

  /** All item ids currently held (count > 0), resources first. */
  held(): PackId[] {
    return [...this.counts.entries()].filter(([, n]) => n > 0).map(([id]) => id);
  }

  add(id: PackId, n = 1): void {
    this.counts.set(id, this.count(id) + n);
    this.changed();
  }

  /** Remove up to n; returns true if the backpack had them. */
  take(id: PackId, n = 1): boolean {
    if (this.count(id) < n) return false;
    this.counts.set(id, this.count(id) - n);
    this.changed();
    return true;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...this.counts.entries()]));
    } catch {
      // Session-only in private mode.
    }
    for (const fn of this.listeners) fn();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      for (const entry of parsed) {
        if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number') {
          this.counts.set(entry[0], entry[1]);
        }
      }
    } catch {
      // Corrupt save — start fresh.
    }
  }
}
