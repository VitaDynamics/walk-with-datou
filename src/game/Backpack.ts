/**
 * Backpack — the satchel you carry on walks (the Don't Starve loop, softened):
 * gather small things from the world, craft them into keepsakes and toys,
 * place some of them back into the world. Counts persist across sessions.
 */

export type ResourceId = 'twig' | 'pebble' | 'berry' | 'flower' | 'mushroom' | 'pinecone';
export type CraftedId = 'stick' | 'cairn' | 'garland' | 'lantern';
export type ItemId = ResourceId | CraftedId;

export const RESOURCE_IDS: readonly ResourceId[] = [
  'twig',
  'pebble',
  'berry',
  'flower',
  'mushroom',
  'pinecone',
];

export class Backpack {
  private readonly counts = new Map<ItemId, number>();
  private readonly listeners = new Set<() => void>();
  private readonly storageKey: string;

  constructor(storageKey = 'wwd.backpack') {
    this.storageKey = storageKey;
    this.load();
  }

  count(id: ItemId): number {
    return this.counts.get(id) ?? 0;
  }

  /** All item ids currently held (count > 0), resources first. */
  held(): ItemId[] {
    return [...this.counts.entries()].filter(([, n]) => n > 0).map(([id]) => id);
  }

  add(id: ItemId, n = 1): void {
    this.counts.set(id, this.count(id) + n);
    this.changed();
  }

  /** Remove up to n; returns true if the backpack had them. */
  take(id: ItemId, n = 1): boolean {
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
          this.counts.set(entry[0] as ItemId, entry[1]);
        }
      }
    } catch {
      // Corrupt save — start fresh.
    }
  }
}
