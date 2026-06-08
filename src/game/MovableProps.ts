import type { Collider } from './World';
import { resolveCircleCollisions } from './collision';

/**
 * Kinematic movable props (docs/ENVIRONMENT_DESIGN.md §4.2). The cozy
 * object-manipulation verbs — push, throw, carry, knock-over, break/scatter —
 * run entirely on the existing XZ circle-collision model (collision.ts), with
 * NO physics-engine dependency and NO PhysicsAdapter change. Balls slide and
 * settle, sticks get carried and thrown, leaf piles scatter and regrow.
 *
 * Determinism: the integrator is a pure function of (dt, mover positions, static
 * colliders). Initial placement is date/scatter-seeded elsewhere, so the diary
 * can replay "Datou knocked the pail into the lake."
 *
 * This module is pure XZ math, unit-tested like collision.ts — it owns no THREE
 * objects. The render layer reads `list()` each frame and writes the meshes.
 */

export type MovablePropState = 'rest' | 'sliding' | 'toppled' | 'broken' | 'carried';
export type CarrierId = 'player' | 'datou';

export interface MovableProp {
  id: number;
  kindId: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Physical radius (footprint × scale). */
  radius: number;
  /** Mass for push response (heavier ⇒ moves less). */
  mass: number;
  yaw: number;
  scale: number;
  state: MovablePropState;
  /** Cooldown timer (s) until a toppled/broken prop auto-rights/regrows. */
  cooldown: number;
  /** Cosmetic vertical offset for a throw arc (render-only; not part of the XZ sim). */
  renderY: number;
  /** Cosmetic upward render velocity during a throw arc (render-only). */
  arcUp?: number;
  carriedBy?: CarrierId;
}

/** A circular mover (player or Datou body) that can push props. */
export interface Mover {
  x: number;
  z: number;
  radius: number;
}

/** Tunables — gentle, cozy motion (not a rigid-body solver). */
const DAMPING = 3.5; // velocity decays e^(-DAMPING·dt); higher = settles sooner
const REST_SPEED = 0.05; // below this, snap to rest
const PUSH_STRENGTH = 6; // how hard a mover's penetration imparts velocity
const TOPPLE_TIME = 4; // s a knocked-over prop stays down before auto-righting
const BREAK_TIME = 6; // s a broken prop stays scattered before regrowing
const THROW_GRAVITY = 14; // m/s² for the cosmetic throw arc
const PARK_HALF = 250;

let nextId = 1;

export interface MovablePropSpec {
  kindId: string;
  x: number;
  z: number;
  yaw: number;
  scale: number;
  radius: number;
  mass?: number;
}

/**
 * Owns the live movable props: their kinematic state and the push/throw/topple/
 * break/carry transitions. Stepped from Game.tick after physics.step so it sees
 * the latest player + Datou positions.
 */
export class MovableProps {
  private readonly props: MovableProp[] = [];
  private readonly byId = new Map<number, MovableProp>();

  /** Spawn a movable prop at rest. Returns its id. */
  spawn(spec: MovablePropSpec): number {
    const prop: MovableProp = {
      id: nextId++,
      kindId: spec.kindId,
      x: spec.x,
      z: spec.z,
      vx: 0,
      vz: 0,
      radius: spec.radius,
      mass: spec.mass ?? 1,
      yaw: spec.yaw,
      scale: spec.scale,
      state: 'rest',
      cooldown: 0,
      renderY: 0,
    };
    this.props.push(prop);
    this.byId.set(prop.id, prop);
    return prop.id;
  }

  get(id: number): MovableProp | undefined {
    return this.byId.get(id);
  }

  list(): readonly MovableProp[] {
    return this.props;
  }

  /** Remove a prop entirely (e.g. it was collected into Datou's backpack). */
  remove(id: number): void {
    const idx = this.props.findIndex((p) => p.id === id);
    if (idx >= 0) this.props.splice(idx, 1);
    this.byId.delete(id);
  }

  /** Nearest non-carried prop to a point within `maxDist`, or null. */
  nearest(x: number, z: number, maxDist: number): MovableProp | null {
    let best: MovableProp | null = null;
    let bestD = maxDist;
    for (const p of this.props) {
      if (p.state === 'carried') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d <= bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Give a prop a planar velocity (a nudge/kick). */
  push(id: number, dirX: number, dirZ: number, speed: number): void {
    const p = this.byId.get(id);
    if (!p || p.state === 'carried') return;
    const len = Math.hypot(dirX, dirZ) || 1;
    p.vx += (dirX / len) * speed;
    p.vz += (dirZ / len) * speed;
    p.state = 'sliding';
  }

  /** Throw a (typically carried) prop on a ballistic arc; lands as a pushable. */
  throw(id: number, dirX: number, dirZ: number, speed: number, arc = 4): void {
    const p = this.byId.get(id);
    if (!p) return;
    const len = Math.hypot(dirX, dirZ) || 1;
    p.carriedBy = undefined;
    p.vx = (dirX / len) * speed;
    p.vz = (dirZ / len) * speed;
    // Encode the arc as an initial upward render velocity in renderY's integrator.
    p.renderY = 0;
    p.arcUp = arc;
    p.state = 'sliding';
  }

  /** Pick a prop up (carry). It tracks the carrier until dropped/thrown. */
  carry(id: number, by: CarrierId): void {
    const p = this.byId.get(id);
    if (!p) return;
    p.state = 'carried';
    p.carriedBy = by;
    p.vx = 0;
    p.vz = 0;
  }

  /** Drop a carried prop at a position. */
  drop(id: number, x: number, z: number): void {
    const p = this.byId.get(id);
    if (!p || p.state !== 'carried') return;
    p.x = x;
    p.z = z;
    p.state = 'rest';
    p.carriedBy = undefined;
  }

  /** Tip a prop over (a one-shot; auto-rights after a cooldown). */
  topple(id: number): void {
    const p = this.byId.get(id);
    if (!p || p.state === 'carried') return;
    p.state = 'toppled';
    p.cooldown = TOPPLE_TIME;
  }

  /** Burst a prop into scatter pieces (auto-regrows after a cooldown). */
  break(id: number): void {
    const p = this.byId.get(id);
    if (!p || p.state === 'carried') return;
    p.state = 'broken';
    p.cooldown = BREAK_TIME;
  }

  /**
   * Advance one step. `carriers` maps a CarrierId to its current position so
   * carried props track their carrier. `movers` are the pushers (player + Datou
   * body); `colliders` is the static world set (getParkColliders()).
   */
  step(
    dt: number,
    movers: readonly Mover[],
    colliders: readonly Collider[],
    carriers?: Partial<Record<CarrierId, { x: number; z: number }>>,
  ): void {
    for (const p of this.props) {
      // Carried props snap to their carrier; nothing else to integrate.
      if (p.state === 'carried') {
        const c = p.carriedBy ? carriers?.[p.carriedBy] : undefined;
        if (c) {
          p.x = c.x;
          p.z = c.z;
        }
        continue;
      }

      // Toppled / broken: tick the cooldown, then auto-recover.
      if (p.state === 'toppled' || p.state === 'broken') {
        p.cooldown -= dt;
        if (p.cooldown <= 0) {
          p.state = 'rest';
          p.cooldown = 0;
        }
        continue;
      }

      // Movers push the prop (reversed circle resolution: the prop yields).
      for (const m of movers) {
        const dx = p.x - m.x;
        const dz = p.z - m.z;
        const minDist = p.radius + m.radius;
        const distSq = dx * dx + dz * dz;
        if (distSq >= minDist * minDist) continue;
        const dist = Math.sqrt(distSq) || 1e-6;
        const nx = dx / dist;
        const nz = dz / dist;
        const pen = minDist - dist;
        // Push out of overlap and impart velocity scaled by penetration / mass.
        p.x += nx * pen;
        p.z += nz * pen;
        const impulse = (PUSH_STRENGTH * pen) / p.mass;
        p.vx += nx * impulse;
        p.vz += nz * impulse;
        p.state = 'sliding';
      }

      // Integrate planar motion, decay, settle.
      if (p.state === 'sliding') {
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        const decay = Math.exp(-DAMPING * dt);
        p.vx *= decay;
        p.vz *= decay;

        // Resolve against static colliders + park bounds (reuse the player path).
        resolveCircleCollisions(p, p.radius, colliders);
        p.x = clamp(p.x, -PARK_HALF + p.radius, PARK_HALF - p.radius);
        p.z = clamp(p.z, -PARK_HALF + p.radius, PARK_HALF - p.radius);

        if (Math.hypot(p.vx, p.vz) < REST_SPEED) {
          p.vx = 0;
          p.vz = 0;
          p.state = 'rest';
        }
      }

      // Cosmetic throw arc (render-only; never affects XZ).
      if (p.arcUp !== undefined) {
        p.renderY += p.arcUp * dt;
        p.arcUp -= THROW_GRAVITY * dt;
        if (p.renderY <= 0) {
          p.renderY = 0;
          p.arcUp = undefined;
        }
      }
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
