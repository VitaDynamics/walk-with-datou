/**
 * Memories — small, beautiful fragments of time spent together.
 *
 * Each discovery, answered want, and bond milestone is written as one short
 * entry (what, where, Datou's mood, when). The list persists across sessions
 * so the relationship leaves a trace the player can return to — "the world
 * remembers they were there" — and is rendered as quiet cards, never a log.
 */

import type { DatouMood } from '../physics/PhysicsAdapter';

export type MemoryKind = 'discovery' | 'want' | 'comfort' | 'milestone';

export interface MemoryEntry {
  /** Unix ms timestamp. */
  ts: number;
  kind: MemoryKind;
  /** Domain key, e.g. 'feather@under-tree', 'want:play', 'milestone:fetch'. */
  key: string;
  mood: DatouMood;
}

const MAX_ENTRIES = 60;

export class Memories {
  private entries: MemoryEntry[] = [];
  private readonly listeners = new Set<() => void>();
  private readonly storageKey: string;

  constructor(storageKey = 'wwd.memories') {
    this.storageKey = storageKey;
    this.entries = this.load();
  }

  /** Newest first. */
  list(): readonly MemoryEntry[] {
    return this.entries;
  }

  add(entry: MemoryEntry): void {
    this.entries.unshift(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES;
    this.save();
    for (const fn of this.listeners) fn();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private load(): MemoryEntry[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (e): e is MemoryEntry =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as MemoryEntry).ts === 'number' &&
          typeof (e as MemoryEntry).key === 'string',
      );
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
    } catch {
      // Storage unavailable (private mode) — memories live for the session only.
    }
  }
}
