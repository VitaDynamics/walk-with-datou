import type { DatouMode } from '../PhysicsAdapter';

/**
 * Determinism / diary-replay support for MujocoAdapter (docs/MUJOCO_DESIGN.md
 * §4.7). A run is fully reconstructable from (seed, model, timestep) plus the
 * timestamped sequence of external inputs recorded here. Snapshots give cheap
 * save/restore for resuming a session or seeking within a replay.
 *
 * These types are additive and optional: the core PhysicsAdapter contract is
 * unchanged, and PlaceholderPhysics is unaffected.
 */

/** A single external input event, time-stamped with the sim clock (seconds). */
export type InputEvent =
  | { t: number; kind: 'setMode'; mode: DatouMode }
  | { t: number; kind: 'setTarget'; x: number; z: number }
  | { t: number; kind: 'setPlayerPosition'; x: number; z: number }
  | { t: number; kind: 'applyPet' };

/**
 * Records external inputs against the sim clock. The player path is the
 * bulkiest stream, so setPlayerPosition is sampled at a fixed cadence rather
 * than every frame (configurable; default 10 Hz).
 */
export class InputRecorder {
  private readonly events: InputEvent[] = [];
  private readonly playerSamplePeriod: number;
  private lastPlayerSampleT = -Infinity;

  constructor(playerSampleHz = 10) {
    this.playerSamplePeriod = 1 / playerSampleHz;
  }

  record(event: InputEvent): void {
    if (event.kind === 'setPlayerPosition') {
      if (event.t - this.lastPlayerSampleT < this.playerSamplePeriod) return;
      this.lastPlayerSampleT = event.t;
    }
    this.events.push(event);
  }

  /** The full event log, ready to serialize into a diary record. */
  getEvents(): readonly InputEvent[] {
    return this.events;
  }

  clear(): void {
    this.events.length = 0;
    this.lastPlayerSampleT = -Infinity;
  }
}

/**
 * A cheap, JSON-serializable snapshot of the full adapter state. For the 3-DOF
 * puck this is a handful of doubles. Restoring writes these back and re-runs
 * mj_forward (handled by the adapter).
 */
export interface AdapterSnapshot {
  /** Sim clock, seconds. */
  time: number;
  /** Joint positions [slideX, slideY, hingeZ]. */
  qpos: number[];
  /** Joint velocities [slideX, slideY, hingeZ]. */
  qvel: number[];
  /** PRNG internal state, so wander continues identically after restore. */
  rngState: number;
  /** Controller wander state. */
  wanderTarget: { x: number; z: number };
  wanderTimer: number;
}
