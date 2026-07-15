/**
 * Forage — Datou as the worker (BUILDING_SYSTEM §7).
 *
 * Pin a material ("need twigs"): leash off, Datou enters forage mode, seeks the
 * nearest matching pickable within ~60 m, trots there (faster than the player
 * — a standing rule), picks it into the back bucket with the sniff/reach pose,
 * and repeats until the bucket fills or nothing's left, then trots the haul
 * back to dump into your pack with the happy pulse. Bond ticks per delivery; a
 * full solo delivery writes a memory.
 *
 * Pure logic, mirroring Fetch: the game injects world queries (find/take) and
 * renders the bucket fill + arm poses; this owns the state machine.
 */

import type { DatouMode, DatouState } from '../physics/PhysicsAdapter';

export interface ForageTarget {
  id: string;
  kind: string;
  x: number;
  z: number;
}

export interface ForageActions {
  setMode(mode: DatouMode): void;
  setTarget(x: number, z: number): void;
  /** Nearest pickable of `kind` within radius of (x,z), or null. */
  findNearest(kind: string, x: number, z: number, radius: number): ForageTarget | null;
  /** Remove a pickable from the world (Datou picked it). false if already gone. */
  pick(id: string): boolean;
  /** A single item went into the bucket (render the fill + reach pose). */
  onPick(kind: string): void;
  /** The haul was dumped into the pack. `items` = kinds gathered this trip. */
  onDeliver(items: string[]): void;
}

type Phase = 'idle' | 'seeking' | 'picking' | 'returning';

const FORAGE_RADIUS = 60; // §7
const PICK_DIST = 1.0;
const DROP_DIST = 1.6;
const PICK_BEAT = 1.0; // one calm beat per pick (arm unfold→grip→stow)
const SEEK_TIMEOUT = 25; // give up walking to a target that never arrives
export const BUCKET_CAPACITY = 6; // §7 (upgradeable via a crafted bucket form)

export class Forage {
  private phase: Phase = 'idle';
  private pinned: string | null = null;
  private bucket: string[] = [];
  private target: ForageTarget | null = null;
  private beat = 0;
  private timeout = 0;
  private capacity = BUCKET_CAPACITY;
  private readonly actions: ForageActions;

  constructor(actions: ForageActions) {
    this.actions = actions;
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  get pinnedMaterial(): string | null {
    return this.pinned;
  }

  /** How full the bucket is (0..capacity) — drives the rig plate's sketch state. */
  get fill(): number {
    return this.bucket.length;
  }

  get bucketCapacity(): number {
    return this.capacity;
  }

  setCapacity(n: number): void {
    this.capacity = Math.max(1, n);
  }

  /** Pin a material kind to forage for. Starts the loop (leash should be off). */
  pin(kind: string): void {
    this.pinned = kind;
    if (this.phase === 'idle') this.phase = 'seeking';
    this.timeout = SEEK_TIMEOUT;
    this.target = null;
  }

  /** Call it off; deliver whatever's in the bucket so far. */
  stop(): void {
    if (this.bucket.length > 0) this.deliver();
    this.phase = 'idle';
    this.pinned = null;
    this.target = null;
    this.actions.setMode('follow');
  }

  update(dt: number, datou: DatouState, player: { x: number; z: number }): void {
    if (this.phase === 'idle') return;
    const dx = datou.position.x;
    const dz = datou.position.z;

    switch (this.phase) {
      case 'seeking': {
        if (!this.pinned) return this.beginReturn();
        if (!this.target) {
          this.target = this.actions.findNearest(this.pinned, dx, dz, FORAGE_RADIUS);
          if (!this.target) return this.beginReturn(); // nothing nearby → bring what we have
          this.actions.setMode('explore');
          this.actions.setTarget(this.target.x, this.target.z);
          this.timeout = SEEK_TIMEOUT;
        }
        this.timeout -= dt;
        if (this.timeout <= 0) {
          this.target = null; // re-seek
          return;
        }
        const d = Math.hypot(dx - this.target.x, dz - this.target.z);
        if (d <= PICK_DIST) {
          this.phase = 'picking';
          this.beat = PICK_BEAT;
        }
        break;
      }
      case 'picking': {
        this.beat -= dt;
        if (this.beat > 0) return;
        // The beat completed — drop the find into the bucket (if still there).
        if (this.target && this.actions.pick(this.target.id)) {
          this.bucket.push(this.target.kind);
          this.actions.onPick(this.target.kind);
        }
        this.target = null;
        if (this.bucket.length >= this.capacity) this.beginReturn();
        else this.phase = 'seeking';
        break;
      }
      case 'returning': {
        const d = Math.hypot(dx - player.x, dz - player.z);
        if (d <= DROP_DIST) this.deliver();
        break;
      }
    }
  }

  private beginReturn(): void {
    if (this.bucket.length === 0) {
      // Nothing to bring — stand down quietly.
      this.phase = 'idle';
      this.pinned = null;
      this.actions.setMode('follow');
      return;
    }
    this.phase = 'returning';
    this.actions.setMode('follow'); // home onto the player
  }

  private deliver(): void {
    const items = this.bucket.slice();
    this.bucket = [];
    this.actions.onDeliver(items);
    // Keep foraging if still pinned and more remains; else stand down.
    if (this.pinned) {
      this.phase = 'seeking';
      this.target = null;
      this.timeout = SEEK_TIMEOUT;
    } else {
      this.phase = 'idle';
      this.actions.setMode('follow');
    }
  }
}
