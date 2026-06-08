import type { DatouMode, DatouState } from '../physics/PhysicsAdapter';
import { Bond } from './Bond';

/**
 * Companion — Datou's "brain" for the want/read loop (docs/GAMEPLAY_DESIGN.md
 * §F1, and the verb layer in docs/INTERACTION_VERBS.md).
 *
 * Instead of a happiness bar, Datou periodically surfaces ONE want through body
 * language; the player reads it and responds. This class owns that state
 * machine: it picks a want, runs a readable wind-up, opens a response window,
 * judges the player's response, grants Bond on success, and expires gracefully
 * (never punishing) if ignored.
 *
 * It is game-layer only: it reads DatouState (from the physics backend) + the
 * player position + the per-frame input, and acts on the world through the
 * physics *mode/target* levers it's given (a thin command sink), so it never
 * imports a concrete physics backend. The renderer reads `expression` to pose
 * Datou (play-bow, sit, gaze).
 */

export type WantKind = 'attention' | 'play' | 'curious';

/** What the renderer needs to pose Datou for the current want. */
export type Expression =
  | { kind: 'none' }
  | { kind: 'attention' } // sitting, looking up at the player
  | { kind: 'play' } // play-bow
  | { kind: 'curious'; dirX: number; dirZ: number }; // ears up, facing a point

/** The command sink the Companion uses to make Datou act (the physics levers). */
export interface CompanionActions {
  setMode(mode: DatouMode): void;
  setTarget(x: number, z: number): void;
}

interface Vec2 {
  x: number;
  z: number;
}

type Phase = 'rest' | 'windup' | 'active' | 'cooldown';

interface ActiveWant {
  kind: WantKind;
  /** For a curious want, the point of interest Datou is drawn toward. */
  poi?: Vec2;
}

export class Companion {
  // Timing (seconds). A want shows its tell during WINDUP before it "expects" a
  // response, so an attentive player can always catch it (§F1 readability).
  private static readonly REST_MIN = 6;
  private static readonly REST_MAX = 14;
  private static readonly WINDUP = 1.4;
  private static readonly ACTIVE_WINDOW = 6;
  private static readonly COOLDOWN = 2.5;
  /** Player within this distance counts as "near" for proximity + responses. */
  private static readonly NEAR_DIST = 3.2;

  private phase: Phase = 'rest';
  private timer: number;
  private want: ActiveWant | null = null;
  private expressionState: Expression = { kind: 'none' };

  private readonly bond: Bond;
  private readonly actions: CompanionActions;
  private readonly rand: () => number;

  constructor(bond: Bond, actions: CompanionActions, rand: () => number = Math.random) {
    this.bond = bond;
    this.actions = actions;
    this.rand = rand;
    this.timer = this.restDuration();
  }

  /** Current expression for the renderer to pose Datou. */
  get expression(): Expression {
    return this.expressionState;
  }

  /** The active want kind, or null. Used by the optional "?" onboarding bubble. */
  get activeWant(): WantKind | null {
    return this.phase === 'active' || this.phase === 'windup' ? (this.want?.kind ?? null) : null;
  }

  /**
   * Advance the want machine one frame.
   * @param datou  Datou's current state (position/mood/velocity).
   * @param player The player's world position.
   * @param petted True if the player petted Datou this frame (a tap landed).
   * @param dt     Seconds since last frame.
   */
  update(datou: DatouState, player: Vec2, petted: boolean, dt: number): void {
    const near = this.distTo(datou.position, player) <= Companion.NEAR_DIST;

    // Passive companionship: being near trickles bond regardless of wants.
    if (near) this.bond.proximity(dt);

    switch (this.phase) {
      case 'rest':
        this.timer -= dt;
        // A pet during rest is always welcome — small bond, no want needed.
        if (petted) this.bond.add('pet');
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
        if (this.judgeResponse(datou, player, petted, near)) {
          this.satisfy();
        } else if (this.timer <= 0) {
          this.expire(datou);
        }
        break;

      case 'cooldown':
        this.timer -= dt;
        this.expressionState = { kind: 'none' };
        if (petted) this.bond.add('pet');
        if (this.timer <= 0) {
          this.phase = 'rest';
          this.timer = this.restDuration();
        }
        break;
    }
  }

  // --- want lifecycle ---

  private beginWant(datou: DatouState): void {
    this.want = { kind: this.pickWant() };
    if (this.want.kind === 'curious') {
      this.want.poi = this.pickCuriousPoint(datou);
    }
    this.phase = 'windup';
    this.timer = Companion.WINDUP;
  }

  /**
   * Choose which want to surface. Biased by mood and by what's unlocked:
   * - play needs the fetch-era bond (~30) to show often;
   * - a tired Datou leans toward attention (wants comfort) over play.
   */
  private pickWant(): WantKind {
    const r = this.rand();
    const playReady = this.bond.has('fetch');
    if (!playReady) {
      // Early game: attention vs curious only.
      return r < 0.6 ? 'attention' : 'curious';
    }
    if (r < 0.4) return 'attention';
    if (r < 0.75) return 'curious';
    return 'play';
  }

  /** Pick a nearby point of interest for a curious want to face/lead toward. */
  private pickCuriousPoint(datou: DatouState): Vec2 {
    const a = this.rand() * Math.PI * 2;
    const dist = 8 + this.rand() * 14;
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

  /** Has the player given the correct response for the active want this frame? */
  private judgeResponse(datou: DatouState, player: Vec2, petted: boolean, near: boolean): boolean {
    if (!this.want) return false;
    switch (this.want.kind) {
      case 'attention':
        // Pet, or simply stay close through the window.
        return petted || near;
      case 'play':
        // Engage the bow with a pet (a throw/fetch also counts, wired later).
        return petted;
      case 'curious': {
        // Follow the gaze: move toward the POI side, ending up nearer it.
        const poi = this.want.poi!;
        const playerToPoi = this.distTo(player, poi);
        const datouToPoi = this.distTo(datou.position, poi);
        // Player has walked out toward the POI (past Datou, roughly).
        return playerToPoi < datouToPoi - 1;
      }
    }
  }

  private satisfy(): void {
    if (this.want) {
      this.bond.add(`want-${this.want.kind}` as const);
      if (this.want.kind === 'curious' && this.want.poi) {
        // Lead the shared approach: send Datou to the POI (explore lever).
        this.actions.setMode('explore');
        this.actions.setTarget(this.want.poi.x, this.want.poi.z);
      }
    }
    this.endWant();
  }

  /** Ignored want: no punishment — just settle back to following the player. */
  private expire(datou: DatouState): void {
    // Curiosity gently pulls Datou a little toward the POI even if unanswered,
    // but the default is to resume following.
    void datou;
    this.actions.setMode('follow');
    this.endWant();
  }

  private endWant(): void {
    this.want = null;
    this.expressionState = { kind: 'none' };
    this.phase = 'cooldown';
    this.timer = Companion.COOLDOWN;
  }

  private restDuration(): number {
    return Companion.REST_MIN + this.rand() * (Companion.REST_MAX - Companion.REST_MIN);
  }

  private distTo(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
}
