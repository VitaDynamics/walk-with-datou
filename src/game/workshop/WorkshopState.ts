/**
 * The Workshop — persisted knowledge (BUILDING_SYSTEM §9).
 *
 *     wwd.workshop = { v, made: ItemId[], hints: Hint[], curios: number[],
 *                      foundPatterns: PatternKey[] }
 *
 * `made` are the items you've crafted (full-color in the Tree); `hints` are
 * banked inspirations (a pattern with some cells revealed); `curios` are the
 * fizzle collectibles; `foundPatterns` are the exact-pattern keys you've
 * discovered (drives the near-miss "unfound" set and Tree silhouettes).
 *
 * Versioned so discovered knowledge never invalidates when tables grow (§9).
 */

import { PATTERNS_VERSION } from './patterns';
import type { ItemId } from './items';

export interface Hint {
  /** Canonical pattern key this hint points at. */
  readonly pattern: string;
  /** Which of the 9 cells are revealed to the player (the rest stay blank). */
  readonly revealedCells: readonly number[];
  /** Where/when/with-whom it happened — doubles as a Notebook memory (§6). */
  readonly context?: string;
  /** Day-seed timestamp bucket it was banked (for ordering; not a wall clock). */
  readonly day?: string;
}

interface Saved {
  v: number;
  made: ItemId[];
  hints: Hint[];
  curios: number[];
  foundPatterns: string[];
}

const KEY = 'wwd.workshop';

export class WorkshopState {
  private made = new Set<ItemId>();
  private hints: Hint[] = [];
  private curios: number[] = [];
  private foundPatterns = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private readonly storageKey: string;

  constructor(storageKey = KEY) {
    this.storageKey = storageKey;
    this.load();
  }

  hasMade(id: ItemId): boolean {
    return this.made.has(id);
  }

  madeIds(): ItemId[] {
    return [...this.made];
  }

  madeCount(): number {
    return this.made.size;
  }

  /** Record a make. Returns true if it was the FIRST time (→ memory card). */
  recordMake(id: ItemId): boolean {
    const first = !this.made.has(id);
    this.made.add(id);
    if (first) this.save();
    return first;
  }

  foundPattern(key: string): boolean {
    return this.foundPatterns.has(key);
  }

  /** Record discovery of an exact pattern. Returns true if newly found. */
  recordPattern(key: string): boolean {
    const fresh = !this.foundPatterns.has(key);
    this.foundPatterns.add(key);
    if (fresh) this.save();
    return fresh;
  }

  foundPatternSet(): ReadonlySet<string> {
    return this.foundPatterns;
  }

  addCurio(tone: number): void {
    this.curios.push(tone);
    this.save();
  }

  curioList(): readonly number[] {
    return this.curios;
  }

  bankHint(hint: Hint): boolean {
    if (this.hints.some((h) => h.pattern === hint.pattern)) return false;
    this.hints.push(hint);
    this.save();
    return true;
  }

  hintList(): readonly Hint[] {
    return this.hints;
  }

  hasHintFor(pattern: string): boolean {
    return this.hints.some((h) => h.pattern === pattern);
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private save(): void {
    const data: Saved = {
      v: PATTERNS_VERSION,
      made: [...this.made],
      hints: this.hints,
      curios: this.curios,
      foundPatterns: [...this.foundPatterns],
    };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // Session-only in private mode.
    }
    for (const fn of this.listeners) fn();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<Saved>;
      if (Array.isArray(d.made)) this.made = new Set(d.made);
      if (Array.isArray(d.hints)) this.hints = d.hints as Hint[];
      if (Array.isArray(d.curios)) this.curios = d.curios as number[];
      if (Array.isArray(d.foundPatterns)) this.foundPatterns = new Set(d.foundPatterns);
      // Future: if d.v < PATTERNS_VERSION, migrate. Today v1 only.
    } catch {
      // Corrupt save — start fresh.
    }
  }
}
