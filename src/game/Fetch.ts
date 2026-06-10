/**
 * Fetch — throw the crafted stick, Datou races after it and brings it back.
 * The classic shared-play loop, pure logic: the game renders the stick and
 * grants the warm feedback on completion.
 */

import type { DatouMode, DatouState } from '../physics/PhysicsAdapter';

export interface FetchActions {
  setMode(mode: DatouMode): void;
  setTarget(x: number, z: number): void;
  /** Stick delivered back to the player. */
  onComplete(): void;
}

type Phase = 'idle' | 'flying' | 'going' | 'returning';

const THROW_RANGE = 9;
const FLY_TIME = 0.9;
const PICK_DIST = 0.7;
const DROP_DIST = 1.5;
const GIVE_UP_AFTER = 20;

export class Fetch {
  private phase: Phase = 'idle';
  private from = { x: 0, z: 0 };
  private land = { x: 0, z: 0 };
  private t = 0;
  private timeout = 0;
  private readonly actions: FetchActions;

  constructor(actions: FetchActions) {
    this.actions = actions;
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  get carried(): boolean {
    return this.phase === 'returning';
  }

  /** Stick world position + height while in flight / on the ground. */
  stickPosition(): { x: number; z: number; y: number } | null {
    if (this.phase === 'idle') return null;
    if (this.phase === 'flying') {
      const k = Math.min(1, this.t / FLY_TIME);
      return {
        x: this.from.x + (this.land.x - this.from.x) * k,
        z: this.from.z + (this.land.z - this.from.z) * k,
        y: 0.9 + Math.sin(k * Math.PI) * 2.2,
      };
    }
    if (this.phase === 'going') return { x: this.land.x, z: this.land.z, y: 0.12 };
    return null; // returning: the game renders it at Datou's mouth
  }

  /** Throw from the player's position toward `dir` (normalized-ish). */
  throw(fromX: number, fromZ: number, dirX: number, dirZ: number, clampR: number): void {
    if (this.phase !== 'idle') return;
    const len = Math.hypot(dirX, dirZ) || 1;
    let lx = fromX + (dirX / len) * THROW_RANGE;
    let lz = fromZ + (dirZ / len) * THROW_RANGE;
    const r = Math.hypot(lx, lz);
    if (r > clampR) {
      lx *= clampR / r;
      lz *= clampR / r;
    }
    this.from = { x: fromX, z: fromZ };
    this.land = { x: lx, z: lz };
    this.t = 0;
    this.timeout = GIVE_UP_AFTER;
    this.phase = 'flying';
  }

  update(dt: number, datou: DatouState, player: { x: number; z: number }): void {
    if (this.phase === 'idle') return;
    this.t += dt;
    this.timeout -= dt;
    if (this.timeout <= 0) {
      this.phase = 'idle';
      this.actions.setMode('follow');
      return;
    }
    switch (this.phase) {
      case 'flying':
        if (this.t >= FLY_TIME) {
          this.phase = 'going';
          this.actions.setMode('explore');
          this.actions.setTarget(this.land.x, this.land.z);
        }
        break;
      case 'going': {
        const d = Math.hypot(datou.position.x - this.land.x, datou.position.z - this.land.z);
        if (d <= PICK_DIST) {
          this.phase = 'returning';
          this.actions.setMode('follow');
        }
        break;
      }
      case 'returning': {
        const d = Math.hypot(datou.position.x - player.x, datou.position.z - player.z);
        if (d <= DROP_DIST) {
          this.phase = 'idle';
          this.actions.onComplete();
        }
        break;
      }
    }
  }
}
