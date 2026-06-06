import { describe, expect, it } from 'vitest';
import { resolveCircleCollisions } from './collision';

describe('resolveCircleCollisions', () => {
  const tree = { x: 5, z: 0, radius: 0.5 };

  it('leaves a point outside all colliders untouched', () => {
    const p = { x: 0, z: 0 };
    resolveCircleCollisions(p, 0.35, [tree]);
    expect(p).toEqual({ x: 0, z: 0 });
  });

  it('pushes an overlapping point to exactly the contact distance', () => {
    const p = { x: 5.2, z: 0 }; // inside (gap 0.2 < 0.85)
    resolveCircleCollisions(p, 0.35, [tree]);
    const dist = Math.hypot(p.x - tree.x, p.z - tree.z);
    expect(dist).toBeCloseTo(0.85, 6); // radius + moverRadius
    expect(p.x).toBeGreaterThan(5.2); // pushed outward along +x
  });

  it('pushes along the approach direction', () => {
    const p = { x: 5, z: 0.3 }; // approaching from +z
    resolveCircleCollisions(p, 0.35, [tree]);
    expect(p.x).toBeCloseTo(5, 6);
    expect(p.z).toBeCloseTo(0.85, 6);
  });

  it('handles a point exactly on the centre deterministically', () => {
    const p = { x: 5, z: 0 };
    resolveCircleCollisions(p, 0.35, [tree]);
    expect(p.x).toBeCloseTo(5.85, 6);
    expect(p.z).toBe(0);
  });

  it('resolves against multiple colliders', () => {
    const colliders = [
      { x: 0, z: 0, radius: 1 },
      { x: 3, z: 0, radius: 1 },
    ];
    const p = { x: 0.5, z: 0 };
    resolveCircleCollisions(p, 0.2, colliders);
    // ends up outside the first one (the only one it overlapped)
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(1.2 - 1e-6);
  });
});
