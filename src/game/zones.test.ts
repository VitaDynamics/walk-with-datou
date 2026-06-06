import { describe, expect, it } from 'vitest';
import { getParkColliders, PARK_HALF } from './World';
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
});
