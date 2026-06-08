import { catalog } from './World';

/**
 * Datou's package system (the "backpack"). Datou is a robot dog: the player
 * sends it to fetch interactable things; it carries ONE visibly in-mouth, then
 * that item is stored here. The player reviews the backpack and deposits the
 * collection at the home post.
 *
 * Session-only for now (in memory; resets on reload) — a clean seam for the
 * future IndexedDB `Storage` the design docs mention (ENVIRONMENT_DESIGN §4.2.4
 * intentional persistence). Pure data + a tiny change-callback so the UI can
 * re-render; no DOM here.
 */

export interface InventoryItem {
  /** The catalog kind id (so we can show its name / re-spawn it). */
  kindId: string;
  /** Display name, captured at pickup time. */
  name: string;
  /** How many of this kind Datou has collected. */
  count: number;
}

export class Inventory {
  /** Items currently in Datou's backpack (not yet deposited), by kind. */
  private readonly carried = new Map<string, InventoryItem>();
  /** Items deposited at the home post, by kind. */
  private readonly deposited = new Map<string, InventoryItem>();
  private readonly listeners = new Set<() => void>();

  /** Subscribe to changes (UI re-render). Returns an unsubscribe fn. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** Add a fetched item to the backpack. */
  add(kindId: string): void {
    const name = catalog.get(kindId)?.name ?? kindId;
    const existing = this.carried.get(kindId);
    if (existing) existing.count++;
    else this.carried.set(kindId, { kindId, name, count: 1 });
    this.emit();
  }

  /** Move everything in the backpack to the home-post collection. */
  depositAll(): number {
    let moved = 0;
    for (const [kindId, item] of this.carried) {
      const at = this.deposited.get(kindId);
      if (at) at.count += item.count;
      else this.deposited.set(kindId, { ...item });
      moved += item.count;
    }
    this.carried.clear();
    if (moved > 0) this.emit();
    return moved;
  }

  /** Items in the backpack (carried, not yet deposited). */
  backpack(): InventoryItem[] {
    return [...this.carried.values()];
  }

  /** Items deposited at the home post. */
  home(): InventoryItem[] {
    return [...this.deposited.values()];
  }

  /** Total items Datou is currently carrying in the backpack. */
  get backpackCount(): number {
    let n = 0;
    for (const i of this.carried.values()) n += i.count;
    return n;
  }

  /** Total items deposited at home. */
  get homeCount(): number {
    let n = 0;
    for (const i of this.deposited.values()) n += i.count;
    return n;
  }
}
