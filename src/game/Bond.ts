/**
 * Bond — the single shared relationship metric (docs/GAMEPLAY_DESIGN.md §F2).
 *
 * One integer fed by *every* interaction (answering a want, petting, play,
 * sharing a discovery, simply being near). It is never shown to the player as a
 * number; it is expressed only through unlocks — new idle habits and activities
 * Datou grows into as the bond deepens.
 *
 * Pure logic, no rendering. The game ticks `proximity()` for the passive
 * trickle and calls `add()` on interaction moments; it reads `has()` to gate
 * unlocked behaviours and drains `takeUnlocks()` to react to newly crossed
 * thresholds (e.g. a one-off "Datou lies at your feet now" flourish).
 */

export type BondUnlock = 'glance-back' | 'fetch' | 'lie-at-feet' | 'initiate-explore' | 'signature';

/** Thresholds at which each habit/activity unlocks (§F2 table). */
export const BOND_UNLOCKS: ReadonlyArray<{ at: number; id: BondUnlock }> = [
  { at: 15, id: 'glance-back' },
  { at: 30, id: 'fetch' },
  { at: 50, id: 'lie-at-feet' },
  { at: 70, id: 'initiate-explore' },
  { at: 90, id: 'signature' },
];

/** Reasons bond is granted — kept for the diary/telemetry, not shown raw. */
export type BondReason =
  | 'pet'
  | 'want-attention'
  | 'want-play'
  | 'want-curious'
  | 'play'
  | 'discovery'
  | 'proximity';

export class Bond {
  private value: number;
  /** Per-session running total, used for diminishing returns within a session
   *  so bond can't be farmed by spamming one interaction (§F2). */
  private sessionGained = 0;
  /** Unlocks crossed but not yet consumed by the game for their one-off cue. */
  private pendingUnlocks: BondUnlock[] = [];
  /** All unlocks ever reached (for has()). */
  private readonly reached = new Set<BondUnlock>();

  /** Proximity trickle accumulator (whole points are added as they build up). */
  private proximityCarry = 0;

  // Base bond granted per reason, before session diminishing returns.
  private static readonly BASE: Record<BondReason, number> = {
    pet: 1,
    'want-attention': 2,
    'want-play': 3,
    'want-curious': 2,
    play: 3,
    discovery: 4,
    proximity: 0, // handled via proximity()
  };

  // Bond per second of being near Datou (slow — a passive walk still counts).
  private static readonly PROXIMITY_RATE = 0.05;
  // After this much gained in a session, additional gains are halved (soft cap
  // that nudges players toward variety + the daily ritual rather than grinding).
  private static readonly SOFT_CAP = 40;

  constructor(initial = 0) {
    this.value = Math.max(0, Math.floor(initial));
    // Seed `reached` from the starting value so a returning player with a saved
    // bond doesn't re-fire every unlock cue on load.
    for (const u of BOND_UNLOCKS) {
      if (this.value >= u.at) this.reached.add(u.id);
    }
  }

  /** Current bond (for persistence only — never render this as a number). */
  get level(): number {
    return this.value;
  }

  /**
   * Grant bond for an interaction moment. Applies session diminishing returns
   * and records any unlocks newly crossed. Returns the amount actually added.
   */
  add(reason: BondReason, amount = Bond.BASE[reason]): number {
    if (amount <= 0) return 0;
    const scaled = this.sessionGained >= Bond.SOFT_CAP ? amount * 0.5 : amount;
    this.commit(scaled);
    return scaled;
  }

  /**
   * Accumulate the passive proximity trickle. Call each frame with dt seconds
   * while Datou is within companionable range of the player.
   */
  proximity(dt: number): void {
    this.proximityCarry += dt * Bond.PROXIMITY_RATE;
    if (this.proximityCarry >= 1) {
      const whole = Math.floor(this.proximityCarry);
      this.proximityCarry -= whole;
      this.commit(this.sessionGained >= Bond.SOFT_CAP ? whole * 0.5 : whole);
    }
  }

  /** Whether a given habit/activity has unlocked at the current bond. */
  has(unlock: BondUnlock): boolean {
    return this.reached.has(unlock);
  }

  /**
   * Drain unlocks crossed since the last call, so the game can play a one-off
   * cue for each (e.g. the first time Datou lies at your feet). Empty if none.
   */
  takeUnlocks(): BondUnlock[] {
    const out = this.pendingUnlocks;
    this.pendingUnlocks = [];
    return out;
  }

  private commit(amount: number): void {
    if (amount <= 0) return;
    const before = this.value;
    this.value += amount;
    this.sessionGained += amount;
    for (const u of BOND_UNLOCKS) {
      if (before < u.at && this.value >= u.at && !this.reached.has(u.id)) {
        this.reached.add(u.id);
        this.pendingUnlocks.push(u.id);
      }
    }
  }
}
