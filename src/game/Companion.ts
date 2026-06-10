/**
 * Companion — Datou's "brain" for the want/read loop, diorama edition.
 *
 * Datou periodically surfaces ONE want through body language; the player
 * reads it and answers with a touch. No meters begging to be filled, no
 * punishment for ignoring — wants expire gracefully and Datou goes back to
 * its own life. The loop ties into the glade's hidden discoveries: curious
 * wants gaze toward a real undiscovered spot, and guiding Datou there turns
 * the want into a shared discovery (the heart of the exploration loop).
 *
 * Pure game logic: reads DatouState, acts only through the physics
 * mode/target levers, never imports a backend. The renderer poses Datou
 * from `expression`.
 */

import type { DatouMode, DatouState } from '../physics/PhysicsAdapter';
import { Bond } from './Bond';
import type { Spot, SpotField } from '../world/Spots';

export type WantKind = 'attention' | 'play' | 'curious';

/** What the rig needs to pose Datou for the current want. */
export type Expression =
  | { kind: 'none' }
  | { kind: 'attention' } // sitting, looking up at you
  | { kind: 'play' } // play-bow
  | { kind: 'curious'; dirX: number; dirZ: number }; // gaze toward a point

/** The command sink the Companion uses to make Datou act. */
export interface CompanionActions {
  setMode(mode: DatouMode): void;
  setTarget(x: number, z: number): void;
  /** Datou reached a hidden spot — the game reveals it + writes the memory. */
  onDiscover?(spot: Spot): void;
  /** A want was answered — the game plays the warm feedback (mood, pulse). */
  onWantSatisfied?(kind: WantKind): void;
}

/** What the player did this frame (from the pointer layer). */
export interface CompanionEvents {
  /** Tap landed on Datou. */
  petted: boolean;
  /** A comforting hold on Datou completed this frame. */
  comforted: boolean;
  /** Tap landed on the ground at this point (guide attention), or null. */
  guidedTo: { x: number; z: number } | null;
}

interface Vec2 {
  x: number;
  z: number;
}

type Phase = 'rest' | 'windup' | 'active' | 'approach' | 'cooldown';

interface ActiveWant {
  kind: WantKind;
  /** For a curious want, the point Datou is drawn toward. */
  poi?: Vec2;
  /** The real spot the want is anchored to, when one is undiscovered. */
  spot?: Spot;
}

export class Companion {
  // Timing (seconds). The tell shows during WINDUP before a response is
  // "expected", so an attentive player can always catch it.
  private static readonly REST_MIN = 7;
  private static readonly REST_MAX = 15;
  private static readonly WINDUP = 1.4;
  private static readonly ACTIVE_WINDOW = 7;
  private static readonly COOLDOWN = 2.5;
  /** Datou within this distance of the player counts as "keeping company". */
  private static readonly NEAR_DIST = 2.8;
  /** A guide tap within this distance of a hidden spot counts as pointing at it. */
  private static readonly GUIDE_SPOT_DIST = 1.2;
  /** Datou within this distance of a spot reveals it. */
  private static readonly REACH_DIST = 0.55;
  /** Give up an approach after this long (blocked path etc.) — no punishment. */
  private static readonly APPROACH_TIMEOUT = 10;
  /** Min seconds between bond-granting pets, so tapping can't farm it. */
  private static readonly PET_COOLDOWN = 1.5;

  private phase: Phase = 'rest';
  private timer: number;
  private want: ActiveWant | null = null;
  private expressionState: Expression = { kind: 'none' };
  private approachSpot: Spot | null = null;
  private approachTarget: Vec2 | null = null;
  private petCooldown = 0;

  /** The stance the game restores after a want resolves (idle = its own life,
   *  follow = staying close to the pad). Set by the console buttons. */
  homeMode: DatouMode = 'idle';

  private readonly bond: Bond;
  private readonly actions: CompanionActions;
  private readonly rand: () => number;
  private readonly spots: SpotField | null;

  constructor(
    bond: Bond,
    actions: CompanionActions,
    rand: () => number = Math.random,
    spots: SpotField | null = null,
  ) {
    this.bond = bond;
    this.actions = actions;
    this.rand = rand;
    this.spots = spots;
    this.timer = this.restDuration();
  }

  get expression(): Expression {
    return this.expressionState;
  }

  get activeWant(): WantKind | null {
    return this.phase === 'active' || this.phase === 'windup' ? (this.want?.kind ?? null) : null;
  }

  /** The spot id the current curious want gazes at, or null. */
  get activeSpotId(): number | null {
    return this.activeWant === 'curious' ? (this.want?.spot?.id ?? null) : null;
  }

  /**
   * Player-initiated guidance: a tap on the glade. Steers Datou there; if the
   * tap points at (or near) a hidden spot, Datou approaches it and the find
   * fires on arrival — discovery works even without an active curious want.
   */
  investigate(x: number, z: number): void {
    const spot = this.spots?.nearestUndiscovered(x, z, Companion.GUIDE_SPOT_DIST) ?? null;
    this.approachSpot = null;
    if (this.phase === 'active' || this.phase === 'windup') {
      // Guiding during a curious want toward its spot answers the want.
      if (this.want?.kind === 'curious' && this.want.spot && spot?.id === this.want.spot.id) {
        this.satisfyCurious();
        return;
      }
      this.endWant();
    }
    this.actions.setMode('explore');
    this.approachSpot = spot;
    this.approachTarget = spot ? { x: spot.x, z: spot.z } : { x, z };
    this.actions.setTarget(this.approachTarget.x, this.approachTarget.z);
    this.phase = 'approach';
    this.timer = Companion.APPROACH_TIMEOUT;
  }

  /**
   * Advance one frame.
   * @param datou  Datou's state from the physics backend.
   * @param player The human's position.
   * @param events What the player did this frame.
   */
  update(datou: DatouState, player: Vec2, events: CompanionEvents, dt: number): void {
    if (this.petCooldown > 0) this.petCooldown -= dt;

    // Keeping company: walking together trickles bond passively.
    if (this.distTo(datou.position, player) <= Companion.NEAR_DIST) this.bond.proximity(dt);

    // A comforting hold is always meaningful (and calms a want too).
    if (events.comforted) this.bond.add('play', 2);

    // Ground taps move the HUMAN now; they only reach Datou as an answer to
    // an active curious want (judgeResponse) — explicit prop taps use
    // investigate() directly.

    switch (this.phase) {
      case 'rest':
        this.timer -= dt;
        if (events.petted) this.grantPet();
        if (this.timer <= 0) this.beginWant(datou);
        break;

      case 'windup':
        this.timer -= dt;
        this.poseForWant(datou);
        if (this.timer <= 0) {
          this.phase = 'active';
          this.timer = Companion.ACTIVE_WINDOW;
        }
        break;

      case 'active':
        this.timer -= dt;
        this.poseForWant(datou);
        if (this.judgeResponse(events)) {
          this.satisfy();
        } else if (this.timer <= 0) {
          this.expire();
        }
        break;

      case 'approach': {
        this.timer -= dt;
        const goal = this.approachTarget;
        const spot = this.approachSpot && !this.approachSpot.found ? this.approachSpot : null;
        if (!goal) {
          this.finishApproach();
          break;
        }
        // Keep gazing toward the goal while trotting over.
        const dx = goal.x - datou.position.x;
        const dz = goal.z - datou.position.z;
        const dist = Math.hypot(dx, dz);
        const len = dist || 1;
        this.expressionState = { kind: 'curious', dirX: dx / len, dirZ: dz / len };
        if (dist <= Companion.REACH_DIST) {
          if (spot) {
            this.bond.add('discovery');
            this.actions.onDiscover?.(spot);
          }
          this.finishApproach();
        } else if (this.timer <= 0) {
          this.finishApproach();
        }
        break;
      }

      case 'cooldown':
        this.timer -= dt;
        this.expressionState = { kind: 'none' };
        if (events.petted) this.grantPet();
        if (this.timer <= 0) {
          this.phase = 'rest';
          this.timer = this.restDuration();
        }
        break;
    }
  }

  // --- want lifecycle ---

  private grantPet(): void {
    if (this.petCooldown > 0) return;
    this.petCooldown = Companion.PET_COOLDOWN;
    this.bond.add('pet');
  }

  private beginWant(datou: DatouState): void {
    const kind = this.pickWant();
    this.want = { kind };
    if (kind === 'curious') {
      // Anchor on a REAL undiscovered spot when one remains — this is what
      // makes the want loop about the actual glade.
      const spot = this.spots?.nearestUndiscovered(datou.position.x, datou.position.z, 100) ?? null;
      if (spot) {
        this.want.spot = spot;
        this.want.poi = { x: spot.x, z: spot.z };
      } else {
        this.want.poi = this.pickCuriousPoint(datou);
      }
    }
    // Pause for the tell: Datou stops to communicate.
    this.actions.setMode('leashed');
    this.actions.setTarget(datou.position.x, datou.position.z);
    this.phase = 'windup';
    this.timer = Companion.WINDUP;
  }

  private pickWant(): WantKind {
    const r = this.rand();
    const playReady = this.bond.has('fetch');
    if (!playReady) return r < 0.55 ? 'attention' : 'curious';
    if (r < 0.35) return 'attention';
    if (r < 0.7) return 'curious';
    return 'play';
  }

  private pickCuriousPoint(datou: DatouState): Vec2 {
    const a = this.rand() * Math.PI * 2;
    const dist = 2 + this.rand() * 3;
    return {
      x: datou.position.x + Math.cos(a) * dist,
      z: datou.position.z + Math.sin(a) * dist,
    };
  }

  private poseForWant(datou: DatouState): void {
    if (!this.want) return;
    switch (this.want.kind) {
      case 'attention':
        this.expressionState = { kind: 'attention' };
        break;
      case 'play':
        this.expressionState = { kind: 'play' };
        break;
      case 'curious': {
        const poi = this.want.poi!;
        const dx = poi.x - datou.position.x;
        const dz = poi.z - datou.position.z;
        const len = Math.hypot(dx, dz) || 1;
        this.expressionState = { kind: 'curious', dirX: dx / len, dirZ: dz / len };
        break;
      }
    }
  }

  /** Did the player answer the active want this frame? */
  private judgeResponse(events: CompanionEvents): boolean {
    if (!this.want) return false;
    switch (this.want.kind) {
      case 'attention':
        return events.petted || events.comforted;
      case 'play':
        return events.petted;
      case 'curious': {
        if (!events.guidedTo) return false;
        const poi = this.want.poi!;
        return this.distTo(events.guidedTo, poi) <= Companion.GUIDE_SPOT_DIST + 0.4;
      }
    }
  }

  private satisfy(): void {
    if (!this.want) return;
    const kind = this.want.kind;
    this.bond.add(`want-${kind}` as const);
    this.actions.onWantSatisfied?.(kind);
    if (kind === 'curious' && this.want.poi) {
      const spot = this.want.spot ?? null;
      const poi = this.want.poi;
      this.endWant();
      this.beginApproach(poi, spot);
      return;
    }
    this.endWant();
  }

  private satisfyCurious(): void {
    if (this.want?.kind === 'curious') {
      this.bond.add('want-curious');
      this.actions.onWantSatisfied?.('curious');
      const spot = this.want.spot ?? null;
      const poi = this.want.poi ?? null;
      this.endWant();
      if (poi) this.beginApproach(poi, spot);
    }
  }

  /** Trot to a point of interest; a real spot becomes a discovery on arrival. */
  private beginApproach(goal: Vec2, spot: Spot | null): void {
    this.actions.setMode('explore');
    this.actions.setTarget(goal.x, goal.z);
    this.approachTarget = goal;
    this.approachSpot = spot;
    this.phase = 'approach';
    this.timer = Companion.APPROACH_TIMEOUT;
  }

  /** Ignored want: no punishment — settle back into the home stance. */
  private expire(): void {
    this.actions.setMode(this.homeMode);
    this.endWant();
  }

  private finishApproach(): void {
    this.approachSpot = null;
    this.approachTarget = null;
    this.actions.setMode(this.homeMode);
    this.expressionState = { kind: 'none' };
    this.phase = 'cooldown';
    this.timer = Companion.COOLDOWN;
  }

  private endWant(): void {
    this.want = null;
    this.expressionState = { kind: 'none' };
    this.phase = 'cooldown';
    this.timer = Companion.COOLDOWN;
    this.actions.setMode(this.homeMode);
  }

  private restDuration(): number {
    return Companion.REST_MIN + this.rand() * (Companion.REST_MAX - Companion.REST_MIN);
  }

  private distTo(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
}
