/**
 * Personality axes (research doc §Personality; BUILDING_SYSTEM §5.2 gating).
 *
 * Datou's personality DIVERGES over time from how you actually play — not a
 * menu choice. We tally the kinds of moments you share (exploring/discovering,
 * playing, quiet care, foraging together) and derive a dominant axis once
 * there's enough signal. The axis biases high-bond inspiration branches (§5.2)
 * — an Explorer-Datou dreams up far-flung structures, a Guardian home ones, a
 * Playful one toys.
 *
 * Pure tally + a deterministic argmax; persisted to `wwd.personality`. Below a
 * minimum signal it reports 'balanced' so early play isn't pigeonholed.
 */

import type { Personality } from './inspiration';

/** The play signals we accumulate (mapped from interaction moments). */
export type PlaySignal = 'explore' | 'play' | 'care' | 'work';

const KEY = 'wwd.personality';
const MIN_SIGNAL = 12; // below this total, stay 'balanced'

const AXIS: Record<PlaySignal, Personality> = {
  explore: 'explorer',
  play: 'playful',
  care: 'guardian',
  work: 'independent',
};

export class PersonalityModel {
  private tally: Record<PlaySignal, number> = { explore: 0, play: 0, care: 0, work: 0 };
  private readonly storageKey: string;

  constructor(storageKey = KEY) {
    this.storageKey = storageKey;
    this.load();
  }

  /** Record a shared moment of a given kind. */
  note(signal: PlaySignal, weight = 1): void {
    this.tally[signal] += weight;
    this.save();
  }

  /** Total signal accumulated. */
  total(): number {
    return Object.values(this.tally).reduce((a, b) => a + b, 0);
  }

  /**
   * The dominant axis, or 'balanced' if there isn't enough signal yet or no
   * single signal clearly leads. Deterministic argmax (ties → 'balanced').
   */
  axis(): Personality {
    if (this.total() < MIN_SIGNAL) return 'balanced';
    const entries = Object.entries(this.tally) as [PlaySignal, number][];
    entries.sort((a, b) => b[1] - a[1]);
    const [topSig, top] = entries[0];
    const second = entries[1][1];
    // Require a clear lead (≥ 1.25×) so a near-tie stays balanced.
    if (top < second * 1.25) return 'balanced';
    return AXIS[topSig];
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.tally));
    } catch {
      // Session-only.
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<Record<PlaySignal, number>>;
      for (const k of ['explore', 'play', 'care', 'work'] as const) {
        if (typeof d[k] === 'number') this.tally[k] = d[k]!;
      }
    } catch {
      // Corrupt — start fresh.
    }
  }
}
