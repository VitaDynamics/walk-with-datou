import type { Collider } from './World';

/**
 * Resolve a moving point (radius `moverRadius`) against a list of circular
 * colliders in the XZ plane by pushing it out of any it overlaps. Used for the
 * player's kinematic movement (the MuJoCo backend handles Datou's collisions
 * in the solver; this keeps the player consistent with what Datou hits).
 *
 * Mutates and returns `pos`. A single pass is enough for sparse, non-
 * overlapping obstacles like the park's trees.
 */
export function resolveCircleCollisions(
  pos: { x: number; z: number },
  moverRadius: number,
  colliders: readonly Collider[],
): { x: number; z: number } {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const minDist = c.radius + moverRadius;
    const distSq = dx * dx + dz * dz;
    if (distSq >= minDist * minDist) continue;

    const dist = Math.sqrt(distSq);
    if (dist < 1e-6) {
      // Exactly on the centre: push along +x deterministically.
      pos.x = c.x + minDist;
      continue;
    }
    const push = (minDist - dist) / dist;
    pos.x += dx * push;
    pos.z += dz * push;
  }
  return pos;
}
