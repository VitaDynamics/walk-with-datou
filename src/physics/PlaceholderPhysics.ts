import type {
  DatouMode,
  DatouMood,
  DatouState,
  PhysicsAdapter,
  WorldCollider,
} from './PhysicsAdapter';

/**
 * Lightweight kinematic stand-in for the real MuJoCo simulation. Good enough to
 * test Sprint 0-2 interactions without blocking on the sim team.
 *
 * Behaviour:
 *  - follow mode: steer toward the player, stop at FOLLOW_MIN_DIST.
 *  - idle mode: random wander within the park.
 *  - explore / leashed modes: steer toward `target`.
 *  - mood: defaults to 'calm', bumps to 'happy' for HAPPY_DURATION after a pet,
 *    drifts to 'curious' while moving, and to 'tired' if stationary too long.
 */
export class PlaceholderPhysics implements PhysicsAdapter {
  // Companionable walking pace near a target, with a real trot when it has
  // ground to cover (the human walks 3.1 / runs 5.4 m/s — Datou keeps up).
  private static readonly SPEED_NEAR = 1.8; // m/s
  private static readonly SPEED_FAR = 5.8; // a touch above the human's run
  private static readonly FAR_DIST = 6; // beyond this, trot (explore/idle)
  // In follow mode the leash is only 2 m — trot as soon as the slack is gone.
  private static readonly FAR_DIST_FOLLOW = 1.9;
  private static readonly FOLLOW_MIN_DIST = 1.3;
  private static readonly ARRIVE_DIST = 0.25;
  private static readonly HAPPY_DURATION = 5; // seconds
  private static readonly WANDER_INTERVAL_MIN = 3;
  private static readonly WANDER_INTERVAL_MAX = 7;
  // Off-leash potter range around the player — idle wander stays companionable
  // instead of roaming the whole 500 m park.
  private static readonly WANDER_NEAR = 3;
  private static readonly WANDER_FAR = 11;
  // Clamp bound, kept just inside the world's walkable radius
  // (WORLD_WALK_RADIUS 245 in world/zones.ts). The physics layer stays
  // independent of the game layer, so this mirrors that value.
  private static readonly HALF_EXTENT = 245;

  private state: DatouState = {
    position: { x: 1.4, y: 0, z: 0.8 },
    yaw: 0,
    velocity: { x: 0, y: 0, z: 0 },
    mood: 'calm',
  };
  private static readonly DATOU_RADIUS = 0.45; // for obstacle push-out

  private mode: DatouMode = 'follow';
  private playerPos = { x: 0, z: 0 };
  private target = { x: 0, z: 0 };
  private wanderTarget = { x: 0, z: 0 };
  private wanderTimer = 0;
  private happyTimer = 0;
  private stationaryTimer = 0;
  private colliders: readonly WorldCollider[] = [];

  async init(): Promise<void> {
    // Nothing to load.
  }

  setColliders(colliders: readonly WorldCollider[]): void {
    this.colliders = colliders;
  }

  setMode(mode: DatouMode): void {
    this.mode = mode;
    this.wanderTimer = 0;
  }

  setPlayerPosition(x: number, z: number): void {
    this.playerPos.x = x;
    this.playerPos.z = z;
  }

  setTarget(x: number, z: number): void {
    this.target.x = x;
    this.target.z = z;
  }

  applyPet(): void {
    this.happyTimer = PlaceholderPhysics.HAPPY_DURATION;
    this.state.mood = 'happy';
  }

  step(dt: number): void {
    const desired = this.computeDesiredTarget(dt);
    this.moveToward(desired.x, desired.z, dt);
    this.resolveCollisions();
    this.updateMood(dt);
  }

  /** Push Datou out of any park obstacle it overlaps (circle vs circle). */
  private resolveCollisions(): void {
    const r = PlaceholderPhysics.DATOU_RADIUS;
    for (const c of this.colliders) {
      const dx = this.state.position.x - c.x;
      const dz = this.state.position.z - c.z;
      const minDist = c.radius + r;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minDist * minDist) continue;
      const dist = Math.sqrt(distSq);
      if (dist < 1e-6) {
        this.state.position.x = c.x + minDist;
        continue;
      }
      const push = (minDist - dist) / dist;
      this.state.position.x += dx * push;
      this.state.position.z += dz * push;
    }
  }

  getDatouState(): DatouState {
    return this.state;
  }

  dispose(): void {
    // Nothing to free.
  }

  private computeDesiredTarget(dt: number): { x: number; z: number } {
    switch (this.mode) {
      case 'follow':
        return { x: this.playerPos.x, z: this.playerPos.z };
      case 'leashed':
      case 'explore':
        return { x: this.target.x, z: this.target.z };
      case 'idle': {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer =
            PlaceholderPhysics.WANDER_INTERVAL_MIN +
            Math.random() *
              (PlaceholderPhysics.WANDER_INTERVAL_MAX - PlaceholderPhysics.WANDER_INTERVAL_MIN);
          // Potter around the player, not the whole park.
          const a = Math.random() * Math.PI * 2;
          const d =
            PlaceholderPhysics.WANDER_NEAR +
            Math.random() * (PlaceholderPhysics.WANDER_FAR - PlaceholderPhysics.WANDER_NEAR);
          this.wanderTarget = {
            x: this.playerPos.x + Math.cos(a) * d,
            z: this.playerPos.z + Math.sin(a) * d,
          };
        }
        return this.wanderTarget;
      }
      default:
        return { x: this.state.position.x, z: this.state.position.z };
    }
  }

  private moveToward(tx: number, tz: number, dt: number): void {
    const dx = tx - this.state.position.x;
    const dz = tz - this.state.position.z;
    const dist = Math.hypot(dx, dz);
    const stopDist =
      this.mode === 'follow' ? PlaceholderPhysics.FOLLOW_MIN_DIST : PlaceholderPhysics.ARRIVE_DIST;

    if (dist > stopDist) {
      const farDist =
        this.mode === 'follow' ? PlaceholderPhysics.FAR_DIST_FOLLOW : PlaceholderPhysics.FAR_DIST;
      const speed = dist > farDist ? PlaceholderPhysics.SPEED_FAR : PlaceholderPhysics.SPEED_NEAR;
      const vx = (dx / dist) * speed;
      const vz = (dz / dist) * speed;
      this.state.position.x += vx * dt;
      this.state.position.z += vz * dt;
      this.state.velocity.x = vx;
      this.state.velocity.z = vz;
      this.state.yaw = Math.atan2(vx, vz);
      this.stationaryTimer = 0;
    } else {
      this.state.velocity.x = 0;
      this.state.velocity.z = 0;
      this.stationaryTimer += dt;
      // Face the thing we are watching (player in follow mode, last target otherwise).
      if (this.mode === 'follow' && dist > 0.01) {
        this.state.yaw = Math.atan2(dx, dz);
      }
    }

    this.clampToPark();
  }

  private clampToPark(): void {
    const r = PlaceholderPhysics.HALF_EXTENT;
    if (this.state.position.x > r) this.state.position.x = r;
    if (this.state.position.x < -r) this.state.position.x = -r;
    if (this.state.position.z > r) this.state.position.z = r;
    if (this.state.position.z < -r) this.state.position.z = -r;
  }

  private updateMood(dt: number): void {
    if (this.happyTimer > 0) {
      this.happyTimer -= dt;
      this.state.mood = 'happy';
      return;
    }
    const speed = Math.hypot(this.state.velocity.x, this.state.velocity.z);
    let next: DatouMood;
    if (speed > 0.2) {
      next = 'curious';
    } else if (this.stationaryTimer > 12) {
      next = 'tired';
    } else {
      next = 'calm';
    }
    if (next !== this.state.mood) {
      this.state.mood = next;
    }
  }
}
