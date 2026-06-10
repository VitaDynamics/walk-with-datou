/**
 * Harvest — the work loop (BUILDING_SYSTEM §8.3).
 *
 * Equip a tool → tap a node → Datou trots over, braces, and the dorsal arm
 * works in CALM BEATS (a few swings, never frantic): each beat drops a yield
 * burst into the bucket; when the bucket fills he trots the haul back and dumps
 * it, then returns — until the node's daily charges are spent or you call him
 * off. Standing close to "steady" the work gives +20% yield (being together
 * pays). A tired Datou gently refuses heavy work (the relationship outranks the
 * economy).
 *
 * Pure logic, mirroring Forage: the game injects node/tool/state queries and
 * renders the arm beats + node shake; deterministic yields via a seeded Rng so
 * a worked session replays identically (§9).
 */

import { Rng } from '../../physics/mujoco/rng';
import type { DatouState } from '../../physics/PhysicsAdapter';
import type { DatouMode } from '../../physics/PhysicsAdapter';
import { NODE_DEFS, type NodePlacement } from './nodes';
import type { MaterialId } from './materials';

export interface HarvestActions {
  setMode(mode: DatouMode): void;
  setTarget(x: number, z: number): void;
  /** Charges left on the node right now. */
  charges(nodeId: string): number;
  /** Spend one charge (one beat); returns remaining. */
  spend(nodeId: string): number;
  /** Effective yield multiplier of the equipped tool (tier × dullness). 0 = no/invalid tool. */
  toolMultiplier(): number;
  /** Record one tool swing (advances dullness). */
  swing(): void;
  /** Bucket capacity (shared with forage). */
  bucketCapacity(): number;
  /** Is Datou too tired for heavy work? (care boundary, §8.3) */
  tooTired(): boolean;
  /** A beat landed — render the arm swing + node shake + bucket fill. */
  onBeat(nodeId: string, gained: MaterialId[]): void;
  /** Haul dumped into the pack. */
  onDeliver(items: MaterialId[]): void;
  /** Datou is at the node with no usable tool — the "we need something" nudge. */
  onNeedTool(nodeId: string): void;
  /** Datou refused heavy work and sat (tired). */
  onRefuse(nodeId: string): void;
}

type Phase = 'idle' | 'approach' | 'working' | 'returning';

const REACH_DIST = 1.4;
const DROP_DIST = 1.6;
const BEAT_TIME = 1.1; // one calm beat (§8.3)
const STEADY_DIST = 3.0; // stand within this to "steady" the work (+20%)
const STEADY_BONUS = 0.2;

export class Harvest {
  private phase: Phase = 'idle';
  private node: NodePlacement | null = null;
  private bucket: MaterialId[] = [];
  private beat = 0;
  private rng = new Rng(1);
  private readonly actions: HarvestActions;

  constructor(actions: HarvestActions) {
    this.actions = actions;
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  get fill(): number {
    return this.bucket.length;
  }

  get workingNodeId(): string | null {
    return this.node?.id ?? null;
  }

  /** Begin working a node (seed makes the yield sequence replayable). */
  start(node: NodePlacement, seed: number): void {
    this.node = node;
    this.rng = new Rng((seed ^ hashId(node.id)) >>> 0);
    this.phase = 'approach';
    this.actions.setMode('explore');
    this.actions.setTarget(node.x, node.z);
  }

  stop(): void {
    if (this.bucket.length > 0) this.deliver();
    this.phase = 'idle';
    this.node = null;
    this.actions.setMode('follow');
  }

  update(dt: number, datou: DatouState, player: { x: number; z: number }): void {
    if (this.phase === 'idle' || !this.node) return;
    const dx = datou.position.x;
    const dz = datou.position.z;

    switch (this.phase) {
      case 'approach': {
        const d = Math.hypot(dx - this.node.x, dz - this.node.z);
        if (d <= REACH_DIST) {
          // Gate checks at the node (tool present? tired?).
          if (this.actions.toolMultiplier() <= 0) {
            this.actions.onNeedTool(this.node.id);
            return this.standDown();
          }
          if (heavy(this.node) && this.actions.tooTired()) {
            this.actions.onRefuse(this.node.id);
            return this.standDown();
          }
          if (this.actions.charges(this.node.id) <= 0) return this.beginReturn();
          this.phase = 'working';
          this.beat = BEAT_TIME;
        }
        break;
      }
      case 'working': {
        this.beat -= dt;
        if (this.beat > 0) return;
        this.beat = BEAT_TIME;
        if (this.actions.charges(this.node.id) <= 0) return this.beginReturn();

        // One beat: spend a charge, roll a yield burst, swing the tool.
        this.actions.spend(this.node.id);
        this.actions.swing();
        const steady =
          Math.hypot(player.x - this.node.x, player.z - this.node.z) <= STEADY_DIST;
        const gained = this.rollYield(this.node, steady);
        for (const g of gained) {
          if (this.bucket.length >= this.actions.bucketCapacity()) break;
          this.bucket.push(g);
        }
        this.actions.onBeat(this.node.id, gained);
        if (this.bucket.length >= this.actions.bucketCapacity()) this.beginReturn();
        break;
      }
      case 'returning': {
        const d = Math.hypot(dx - player.x, dz - player.z);
        if (d <= DROP_DIST) this.deliver();
        break;
      }
    }
  }

  /** Yield for one beat: base count scaled by tool multiplier (+steady bonus). */
  private rollYield(node: NodePlacement, steady: boolean): MaterialId[] {
    const def = NODE_DEFS[node.type];
    const mult = this.actions.toolMultiplier() * (steady ? 1 + STEADY_BONUS : 1);
    const base = 1 + Math.floor(this.rng.next() * 2); // 1..2 per beat
    const count = Math.max(1, Math.round(base * mult));
    const total = def.yields.reduce((n, y) => n + y.weight, 0);
    const out: MaterialId[] = [];
    for (let i = 0; i < count; i++) {
      let r = this.rng.next() * total;
      for (const y of def.yields) {
        r -= y.weight;
        if (r < 0) {
          out.push(y.material);
          break;
        }
      }
    }
    return out;
  }

  private beginReturn(): void {
    if (this.bucket.length === 0) return this.standDown();
    this.phase = 'returning';
    this.actions.setMode('follow');
  }

  private standDown(): void {
    this.phase = 'idle';
    this.node = null;
    this.actions.setMode('follow');
  }

  private deliver(): void {
    const items = this.bucket.slice();
    this.bucket = [];
    this.actions.onDeliver(items);
    // Keep working if charges remain; else stand down.
    if (this.node && this.actions.charges(this.node.id) > 0 && this.actions.toolMultiplier() > 0) {
      this.phase = 'approach';
      this.actions.setMode('explore');
      this.actions.setTarget(this.node.x, this.node.z);
    } else {
      this.standDown();
    }
  }
}

/** Heavy nodes (logs/blocks/bolts) are the ones a tired Datou will refuse. */
function heavy(node: NodePlacement): boolean {
  return node.type === 'great-tree' || node.type === 'old-boulder' || node.type === 'bolt-cache';
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
