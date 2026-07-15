/**
 * behaviors — what BOBO does about being BOBO (CHARACTER_IMPLEMENTATION §C5).
 *
 * The proactive layer that fills companionable dead air so "robot is idle"
 * reads as "BOBO is alive" (the bible's core idea: 让机器狗感觉随时都是"活"
 * 起来的). It only ever acts in the gaps — the Companion want loop, Fetch,
 * Forage and Harvest all outrank it, and any player input pushes it back
 * (he drops everything for you — ENFP).
 *
 * Two cadences:
 *  - biological idles (stranger+): stretch 伸懒腰, stomp 跺脚, a ground
 *    sniff — small, ≤1.5 s, spaced ≥25 s. The body keeps living.
 *  - proactive acts (friend+, the earned tier): show-and-tell (好奇+话痨 —
 *    leads you to something and lectures), asking after you (乐于助人),
 *    playing with the placed keepsakes when you're clearly busy (调皮 —
 *    his "other robots to bother" are the things you two made).
 *
 * Pure logic against injected deps; seeded rand; unit-tested.
 */

import { amplitude, type FamiliarityStage, type SignatureClip } from './character';
import type { VoiceContext } from './voice';

export interface BehaviorDeps {
  /** Seeded — behavior picks are deterministic and replay-safe. */
  rand: () => number;
  stage: () => FamiliarityStage;
  /** True when every higher-priority system is quiet (want loop at rest,
   *  no fetch/forage/harvest, no placement, no comforting hold). */
  resting: () => boolean;
  /** Seconds since the player last moved or touched anything. */
  playerIdleSeconds: () => number;
  /** A show-and-tell candidate near Datou, or null. */
  nearbyProp: () => { x: number; z: number } | null;
  /** A placed keepsake to visit, or null when nothing has been placed. */
  placedKeepsake: () => { x: number; z: number } | null;
  /** Send Datou to a point (the Companion approach — interruptible). */
  investigate: (x: number, z: number) => void;
  playClip: (clip: SignatureClip) => boolean;
  /** The small ground-sniff beat (dorsal-arm reach). */
  reach: () => void;
  say: (context: VoiceContext) => void;
}

const BIO_MIN = 25;
const BIO_SPAN = 20;
/** Base seconds between proactive acts at full familiarity (÷ amplitude). */
const PROACTIVE_BASE = 90;
/** You acted — he yields the floor for at least this long. */
const INPUT_YIELD = 8;
/** You've clearly settled in one spot — he goes and entertains himself. */
const SELF_PLAY_IDLE = 40;

const PROACTIVE_STAGE: Record<FamiliarityStage, boolean> = {
  stranger: false,
  friend: true,
  closeFriend: true,
  bestFriend: true,
};

export class Behaviors {
  private bioIn: number;
  private proactiveIn: number;
  private readonly deps: BehaviorDeps;

  constructor(deps: BehaviorDeps) {
    this.deps = deps;
    this.bioIn = BIO_MIN + deps.rand() * BIO_SPAN;
    // The first proactive act comes a little sooner than the steady cadence —
    // a session should meet his initiative early (but never instantly).
    this.proactiveIn = this.nextProactive() * 0.6;
  }

  /** Player input: he never talks over you — push the initiative back. */
  noteInput(): void {
    this.proactiveIn = Math.max(this.proactiveIn, INPUT_YIELD);
    this.bioIn = Math.max(this.bioIn, 2);
  }

  update(dt: number): void {
    this.bioIn -= dt;
    this.proactiveIn -= dt;
    if (!this.deps.resting()) return;
    if (this.proactiveIn <= 0 && PROACTIVE_STAGE[this.deps.stage()]) {
      this.actProactive();
      this.proactiveIn = this.nextProactive();
      this.bioIn = Math.max(this.bioIn, 12); // a beat of quiet afterwards
      return;
    }
    if (this.bioIn <= 0) {
      this.actBiological();
      this.bioIn = BIO_MIN + this.deps.rand() * BIO_SPAN;
    }
  }

  private nextProactive(): number {
    const base = PROACTIVE_BASE / amplitude(this.deps.stage());
    return base * (0.85 + this.deps.rand() * 0.3);
  }

  private actProactive(): void {
    // You're settled — he entertains himself with the things you two made
    // (调皮: his "other robots" are the placed keepsakes).
    if (this.deps.playerIdleSeconds() > SELF_PLAY_IDLE) {
      const toy = this.deps.placedKeepsake();
      if (toy) {
        this.deps.investigate(toy.x, toy.z);
        return;
      }
    }
    // Otherwise: show-and-tell when there's something to show, else he
    // simply asks after you (the walking encyclopedia needs an audience).
    if (this.deps.rand() < 0.6) {
      const prop = this.deps.nearbyProp();
      if (prop) {
        this.deps.investigate(prop.x, prop.z);
        this.deps.say('showTell');
        return;
      }
    }
    this.deps.say('ask');
  }

  private actBiological(): void {
    const r = this.deps.rand();
    if (r < 0.4) this.deps.playClip('stretch');
    else if (r < 0.7) this.deps.playClip('stomp');
    else this.deps.reach(); // a quiet sniff at the ground
  }
}
