import type { DatouMode } from '../PhysicsAdapter';
import type { Rng } from './rng';

/**
 * Outer behaviour controller: turns a high-level DatouMode + targets into a
 * desired planar velocity (game frame: x east, z south). MujocoAdapter feeds
 * this velocity into the solver each step. The waypoint logic mirrors the
 * proven PlaceholderPhysics behaviour so the two backends behave alike
 * (docs/MUJOCO_DESIGN.md §4.3).
 *
 * This class is pure given its inputs and its injected Rng, which makes the
 * whole motion stream reproducible for diary replay (§4.7).
 */
export interface ControllerConfig {
  speed: number; // m/s
  followMinDist: number; // stop this far from the player in follow mode
  arriveDist: number; // stop this close to an explicit target
  wanderIntervalMin: number; // seconds
  wanderIntervalMax: number;
  parkHalfExtent: number; // wander stays within +/- this (scaled)
}

export const DEFAULT_CONTROLLER_CONFIG: ControllerConfig = {
  speed: 2.8,
  followMinDist: 1.8,
  arriveDist: 0.4,
  wanderIntervalMin: 3,
  wanderIntervalMax: 7,
  parkHalfExtent: 22,
};

export interface ControllerInputs {
  mode: DatouMode;
  pos: { x: number; z: number };
  player: { x: number; z: number };
  target: { x: number; z: number };
}

export interface DesiredMotion {
  /** Desired planar velocity, game frame. */
  vx: number;
  vz: number;
}

export class Controller {
  private readonly cfg: ControllerConfig;
  private readonly rng: Rng;
  private wanderTarget = { x: 0, z: 0 };
  private wanderTimer = 0;

  constructor(rng: Rng, cfg: ControllerConfig = DEFAULT_CONTROLLER_CONFIG) {
    this.rng = rng;
    this.cfg = cfg;
  }

  /** Reset wander cadence, e.g. on a mode change. */
  resetWander(): void {
    this.wanderTimer = 0;
  }

  /** Snapshot the only mutable controller state (for replay seek). */
  getState(): { wanderTarget: { x: number; z: number }; wanderTimer: number } {
    return { wanderTarget: { ...this.wanderTarget }, wanderTimer: this.wanderTimer };
  }

  setState(s: { wanderTarget: { x: number; z: number }; wanderTimer: number }): void {
    this.wanderTarget = { ...s.wanderTarget };
    this.wanderTimer = s.wanderTimer;
  }

  /** Compute the waypoint for the current mode (mirrors PlaceholderPhysics). */
  desiredWaypoint(inp: ControllerInputs, dt: number): { x: number; z: number } {
    switch (inp.mode) {
      case 'follow':
        return { x: inp.player.x, z: inp.player.z };
      case 'leashed':
      case 'explore':
        return { x: inp.target.x, z: inp.target.z };
      case 'idle': {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = this.rng.range(this.cfg.wanderIntervalMin, this.cfg.wanderIntervalMax);
          const r = this.cfg.parkHalfExtent * 0.7;
          this.wanderTarget = {
            x: this.rng.range(-r, r),
            z: this.rng.range(-r, r),
          };
        }
        return this.wanderTarget;
      }
      default:
        return { x: inp.pos.x, z: inp.pos.z };
    }
  }

  /** Desired planar velocity toward the waypoint, with a stop band. */
  compute(inp: ControllerInputs, dt: number): DesiredMotion {
    const wp = this.desiredWaypoint(inp, dt);
    const dx = wp.x - inp.pos.x;
    const dz = wp.z - inp.pos.z;
    const dist = Math.hypot(dx, dz);
    const stopDist = inp.mode === 'follow' ? this.cfg.followMinDist : this.cfg.arriveDist;

    if (dist <= stopDist) {
      return { vx: 0, vz: 0 };
    }
    return {
      vx: (dx / dist) * this.cfg.speed,
      vz: (dz / dist) * this.cfg.speed,
    };
  }
}
