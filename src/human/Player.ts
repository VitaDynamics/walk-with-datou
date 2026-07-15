/**
 * Player — kinematic movement for the human: WASD (camera-relative) or
 * tap-to-walk targets, circle push-out against the world's colliders, clamped
 * to the painted world. Pure logic; HumanRig renders it.
 */

import { WORLD_WALK_RADIUS } from '../world/zones';
import type { WorldCollider } from '../physics/PhysicsAdapter';

const WALK_SPEED = 3.1; // m/s
const RUN_SPEED = 5.4;
const ARRIVE = 0.3;
const RADIUS = 0.35;

export class Player {
  x = 0;
  z = 5.5;
  vx = 0;
  vz = 0;

  private target: { x: number; z: number } | null = null;
  private colliders: readonly WorldCollider[] = [];

  setColliders(colliders: readonly WorldCollider[]): void {
    this.colliders = colliders;
  }

  /** Tap-to-walk destination (cleared by WASD input or on arrival). */
  walkTo(x: number, z: number): void {
    this.target = { x, z };
  }

  get hasTarget(): boolean {
    return this.target !== null;
  }

  update(dt: number, axis: { x: number; z: number; run: boolean }, camYaw: number): void {
    let dx = 0;
    let dz = 0;
    let speed = axis.run ? RUN_SPEED : WALK_SPEED;

    if (axis.x !== 0 || axis.z !== 0) {
      this.target = null;
      // Camera-relative: forward = away from the camera.
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      dx = axis.x * cos - axis.z * sin;
      dz = -axis.x * sin - axis.z * cos;
    } else if (this.target) {
      const tx = this.target.x - this.x;
      const tz = this.target.z - this.z;
      const dist = Math.hypot(tx, tz);
      if (dist <= ARRIVE) {
        this.target = null;
      } else {
        dx = tx / dist;
        dz = tz / dist;
        speed = Math.min(speed, dist * 3 + 0.5); // ease into arrival
      }
    }

    if (dx !== 0 || dz !== 0) {
      this.vx = dx * speed;
      this.vz = dz * speed;
      this.x += this.vx * dt;
      this.z += this.vz * dt;
    } else {
      this.vx = 0;
      this.vz = 0;
    }

    // Push out of solid props (and the lake disc).
    for (const c of this.colliders) {
      const ox = this.x - c.x;
      const oz = this.z - c.z;
      const min = c.radius + RADIUS;
      const d2 = ox * ox + oz * oz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 1e-6;
      const push = (min - d) / d;
      this.x += ox * push;
      this.z += oz * push;
    }

    // Stay on the painted world.
    const r = Math.hypot(this.x, this.z);
    if (r > WORLD_WALK_RADIUS) {
      this.x *= WORLD_WALK_RADIUS / r;
      this.z *= WORLD_WALK_RADIUS / r;
    }
  }
}
