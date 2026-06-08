import type { DatouMode, DatouState } from '../physics/PhysicsAdapter';
import { Bond } from './Bond';
import { POI_REACH_DIST, type PoiData, type PoiField } from './pois';
import type { ZoneId } from './zones';
import { zoneAt, ZONES } from './zones';

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
  /**
   * Optional: the player + Datou reached a real POI together. The game reveals
   * the marker, plays Datou's reaction, and grants a "discovery" bond moment.
   * This is the hook that ties the want loop to the actual scene (F3 / the
   * research doc's Scene Exploration Loop).
   */
  onDiscover?(poi: PoiData): void;
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
  /** The real POI this want points at, when it's anchored to one (vs a fallback
   *  empty point in the rare case no POI is in range). */
  poiData?: PoiData;
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
  /** How far Datou will look for a real POI to be curious about. POIs further
   *  than this are too far to lead the player to in one want window. */
  private static readonly CURIOUS_SEARCH_DIST = 40;
  /** Min seconds between bond-granting investigates, so clicking can't farm it. */
  private static readonly INVESTIGATE_COOLDOWN = 4;

  private phase: Phase = 'rest';
  private timer: number;
  private want: ActiveWant | null = null;
  private expressionState: Expression = { kind: 'none' };
  private investigateCooldown = 0;

  private readonly bond: Bond;
  private readonly actions: CompanionActions;
  private readonly rand: () => number;
  /** Real POIs in the park. Optional so the want loop still runs (with random
   *  curious points) when no field is supplied (e.g. in unit tests). */
  private readonly pois: PoiField | null;
  /** Seconds the player has spent in each zone this session — drives the
   *  landmark/zone-aware want bias (under-visited zones are pulled toward). */
  private readonly zoneTime: Record<ZoneId, number> = {
    meadow: 0,
    woods: 0,
    lake: 0,
    grove: 0,
  };

  constructor(
    bond: Bond,
    actions: CompanionActions,
    rand: () => number = Math.random,
    pois: PoiField | null = null,
  ) {
    this.bond = bond;
    this.actions = actions;
    this.rand = rand;
    this.pois = pois;
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

  /** The POI id the current curious want points at, or null. Lets the renderer
   *  highlight exactly the marker Datou is interested in. */
  get activePoiId(): number | null {
    return this.activeWant === 'curious' ? (this.want?.poiData?.id ?? null) : null;
  }

  /**
   * Player-initiated: send Datou over to investigate a point in the world (a
   * named feature the player clicked). Cancels any active want, steers Datou
   * there via the explore lever, and grants a small "examined it together"
   * bond — turning a click on the scenery into a shared moment. Returns the
   * bond actually granted (0 if a recent investigate is still on cooldown, so
   * spamming clicks can't farm bond).
   */
  investigate(x: number, z: number): number {
    if (this.investigateCooldown > 0) {
      // Still steer Datou (responsive feel), but don't grant bond again.
      this.actions.setMode('explore');
      this.actions.setTarget(x, z);
      return 0;
    }
    this.investigateCooldown = Companion.INVESTIGATE_COOLDOWN;
    if (this.phase === 'active' || this.phase === 'windup') this.endWant();
    this.actions.setMode('explore');
    this.actions.setTarget(x, z);
    return this.bond.add('discovery');
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

    // Track where the player spends time so wants can pull toward fresh ground.
    this.zoneTime[zoneAt(player.x, player.z).id] += dt;
    if (this.investigateCooldown > 0) this.investigateCooldown -= dt;

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
    const kind = this.pickWant();
    this.want = { kind };
    if (kind === 'curious') {
      // Anchor the curious want on a REAL nearby undiscovered POI when one is
      // in range — this is what makes the want loop about the actual park. The
      // zone-time bias gently prefers POIs in under-visited zones so wants pull
      // exploration toward fresh ground (landmark/zone-aware wants). Fall back
      // to a random nearby point only when there's no POI to head for.
      const poiData = this.pois?.nearestUndiscovered(
        datou.position.x,
        datou.position.z,
        Companion.CURIOUS_SEARCH_DIST,
        (zone) => this.zoneFreshness(zone),
      );
      if (poiData) {
        this.want.poiData = poiData;
        this.want.poi = { x: poiData.x, z: poiData.z };
      } else {
        this.want.poi = this.pickCuriousPoint(datou);
      }
    }
    this.phase = 'windup';
    this.timer = Companion.WINDUP;
  }

  /** A zone's "freshness" in [0,1]: 1 = least-visited this session, 0 = most.
   *  Drives the curious-want bias toward unexplored ground. */
  private zoneFreshness(zone: ZoneId): number {
    let max = 0;
    for (const z of ZONES) max = Math.max(max, this.zoneTime[z.id]);
    if (max <= 0) return 0.5; // nothing visited yet — neutral
    return 1 - this.zoneTime[zone] / max;
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
        const poi = this.want.poi!;
        if (this.want.poiData) {
          // Anchored on a real POI: success is the player ARRIVING at it (the
          // shared moment), not merely stepping past Datou. Reaching it fires
          // the discovery in satisfy().
          return this.distTo(player, poi) <= POI_REACH_DIST;
        }
        // Fallback (no real POI): follow the gaze — end up nearer it than Datou.
        const playerToPoi = this.distTo(player, poi);
        const datouToPoi = this.distTo(datou.position, poi);
        return playerToPoi < datouToPoi - 1;
      }
    }
  }

  private satisfy(): void {
    if (this.want) {
      this.bond.add(`want-${this.want.kind}` as const);
      if (this.want.kind === 'curious' && this.want.poi) {
        // Lead the shared approach: send Datou to the POI (explore lever) so it
        // trots over to react where you arrived.
        this.actions.setMode('explore');
        this.actions.setTarget(this.want.poi.x, this.want.poi.z);
        // A real POI reached together is a discovery moment: mark it found, let
        // the game play Datou's reaction, and grant the bigger "discovery"
        // bond — the heart of the Scene Exploration Loop.
        if (this.want.poiData) {
          this.bond.add('discovery');
          this.actions.onDiscover?.(this.want.poiData);
        }
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
