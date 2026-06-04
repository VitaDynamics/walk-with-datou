import type { DatouMode, DatouMood, DatouState, PhysicsAdapter } from './PhysicsAdapter';

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
  private static readonly SPEED = 2.8; // m/s
  private static readonly FOLLOW_MIN_DIST = 1.8;
  private static readonly ARRIVE_DIST = 0.4;
  private static readonly HAPPY_DURATION = 5; // seconds
  private static readonly WANDER_INTERVAL_MIN = 3;
  private static readonly WANDER_INTERVAL_MAX = 7;
  private static readonly PARK_HALF_EXTENT = 22;

  private state: DatouState = {
    position: { x: 2, y: 0, z: 0 },
    yaw: 0,
    velocity: { x: 0, y: 0, z: 0 },
    mood: 'calm',
  };
  private mode: DatouMode = 'follow';
  private playerPos = { x: 0, z: 0 };
  private target = { x: 0, z: 0 };
  private wanderTarget = { x: 0, z: 0 };
  private wanderTimer = 0;
  private happyTimer = 0;
  private stationaryTimer = 0;

  async init(): Promise<void> {
    // Nothing to load.
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
    this.updateMood(dt);
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
          const r = PlaceholderPhysics.PARK_HALF_EXTENT;
          this.wanderTarget = {
            x: (Math.random() - 0.5) * 2 * r * 0.7,
            z: (Math.random() - 0.5) * 2 * r * 0.7,
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
      const vx = (dx / dist) * PlaceholderPhysics.SPEED;
      const vz = (dz / dist) * PlaceholderPhysics.SPEED;
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
    const r = PlaceholderPhysics.PARK_HALF_EXTENT;
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
