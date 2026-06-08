import { describe, expect, it } from 'vitest';
import { getParkColliders, getPhysicsColliders, PARK_HALF } from './World';
import { inDeepWater, inPark, LAKE, LANDMARKS, zoneAt } from './zones';

describe('zones', () => {
  it('classifies each zone centre as its own zone', () => {
    // The meadow centre is the origin; woods/lake/grove sit off-axis.
    expect(zoneAt(0, 0).id).toBe('meadow');
    expect(zoneAt(-40, 170).id).toBe('woods');
    expect(zoneAt(30, -170).id).toBe('lake');
    expect(zoneAt(175, 20).id).toBe('grove');
  });

  it('inPark respects the bounds and margin', () => {
    expect(inPark(0, 0)).toBe(true);
    expect(inPark(PARK_HALF - 1, 0)).toBe(true);
    expect(inPark(PARK_HALF + 1, 0)).toBe(false);
    expect(inPark(PARK_HALF - 1, 0, 5)).toBe(false);
  });

  it('inDeepWater is true at the lake centre and false on land', () => {
    expect(inDeepWater(LAKE.center.x, LAKE.center.z)).toBe(true);
    expect(inDeepWater(0, 0)).toBe(false);
  });
});

describe('getParkColliders', () => {
  const colliders = getParkColliders();

  it('returns a non-empty, deterministic set', () => {
    expect(colliders.length).toBeGreaterThan(50);
    // Deterministic: a second call yields the same count (seeded scatter).
    expect(getParkColliders().length).toBe(colliders.length);
  });

  it('includes the solid landmark bases', () => {
    for (const lm of LANDMARKS) {
      if (lm.colliderRadius <= 0) continue;
      const hit = colliders.some(
        (c) => Math.hypot(c.x - lm.x, c.z - lm.z) < 0.01 && c.radius === lm.colliderRadius,
      );
      expect(hit, `missing collider for landmark ${lm.id}`).toBe(true);
    }
  });

  it('keeps every collider inside the park', () => {
    for (const c of colliders) {
      expect(inPark(c.x, c.z, -2)).toBe(true);
    }
  });

  it('does not place blocking trees in the open home meadow', () => {
    // The spawn area (~origin) must stay clear so the player isn't boxed in.
    const nearOrigin = colliders.filter(
      (c) => Math.hypot(c.x, c.z) < 15 && c.radius < 1, // exclude the home post itself is small too
    );
    // Only the home post (radius 0.45 at (0,-2)) should be this close.
    expect(nearOrigin.length).toBeLessThanOrEqual(1);
  });

  /** Smallest distance from a point to any collider's edge (negative = inside). */
  const distToNearestCollider = (x: number, z: number): number => {
    let best = Infinity;
    for (const c of colliders) best = Math.min(best, Math.hypot(x - c.x, z - c.z) - c.radius);
    return best;
  };

  it('blocks (nearly) the whole visible lake shore, not just the deep core', () => {
    // Walk the lake's visual edge in fine steps. Almost every point should sit
    // inside a collider (the dense shoreline ring) — you can't wade onto the
    // water plane. The only open stretch is the narrow bridge crossing, so we
    // require the overwhelming majority of the circle to be blocked.
    const steps = 360;
    let blocked = 0;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const x = LAKE.center.x + Math.cos(a) * (LAKE.radius - 1);
      const z = LAKE.center.z + Math.sin(a) * (LAKE.radius - 1);
      if (distToNearestCollider(x, z) < 0) blocked++;
    }
    expect(blocked / steps).toBeGreaterThan(0.9);
  });

  it('leaves a bridge gap across the lake so you can cross on the deck', () => {
    // There must be an open stretch on the shore (the crossing) — at least one
    // edge point on the +X side near the centreline that is NOT blocked, so the
    // deck is reachable from land.
    let foundOpen = false;
    for (let dz = -2; dz <= 2; dz += 0.5) {
      const x = LAKE.center.x + (LAKE.radius - 1);
      const z = LAKE.center.z + dz;
      if (distToNearestCollider(x, z) > 0) foundOpen = true;
    }
    expect(foundOpen).toBe(true);
  });
});

describe('getPhysicsColliders', () => {
  it('drops the minor props the full set keeps', () => {
    const all = getParkColliders();
    const physics = getPhysicsColliders();
    const minorCount = all.filter((c) => c.minor).length;
    expect(minorCount).toBeGreaterThan(0); // reeds + mushrooms are flagged minor
    expect(physics.length).toBe(all.length - minorCount);
    // None of the physics colliders is a minor one.
    expect(physics.some((c) => c.minor)).toBe(false);
  });

  it('still keeps the major obstacles (trees, landmarks)', () => {
    const physics = getPhysicsColliders();
    // The home post + the solid landmark bases must survive the filter.
    expect(physics.some((c) => Math.hypot(c.x, c.z - -2) < 0.01)).toBe(true); // home post
    for (const lm of LANDMARKS) {
      if (lm.colliderRadius <= 0) continue;
      expect(physics.some((c) => Math.hypot(c.x - lm.x, c.z - lm.z) < 0.01)).toBe(true);
    }
  });
});
