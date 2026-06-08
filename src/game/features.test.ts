import { describe, expect, it } from 'vitest';
import { FEATURES, featureById, placedFeatures } from './features';
import { getParkColliders } from './World';
import { inPark } from './zones';

describe('features', () => {
  it('every feature has a unique id, a name, and a description', () => {
    const ids = new Set<string>();
    for (const f of FEATURES) {
      expect(f.id, 'empty id').toBeTruthy();
      expect(ids.has(f.id), `duplicate id ${f.id}`).toBe(false);
      ids.add(f.id);
      expect(f.name.length, `${f.id} has no name`).toBeGreaterThan(0);
      expect(f.description.length, `${f.id} has no description`).toBeGreaterThan(10);
      expect(f.hitRadius).toBeGreaterThan(0);
    }
  });

  it('places every feature inside the park', () => {
    for (const f of FEATURES) {
      expect(inPark(f.x, f.z, 2), `${f.id} out of park`).toBe(true);
    }
  });

  it('featureById round-trips', () => {
    for (const f of FEATURES) {
      expect(featureById(f.id)).toBe(f);
    }
    expect(featureById('nope')).toBeUndefined();
  });

  it('the hero landmarks are all registered as features', () => {
    for (const id of ['big-oak', 'lookout-bench', 'bridge', 'fountain']) {
      expect(featureById(id), `missing landmark feature ${id}`).toBeDefined();
    }
  });

  it('placedFeatures excludes the hero landmarks + home post', () => {
    const placed = placedFeatures().map((f) => f.id);
    expect(placed).not.toContain('big-oak');
    expect(placed).not.toContain('home-post');
    // Signposts / birdbath / picnic are placed dressing.
    expect(placed).toContain('birdbath');
    expect(placed.some((id) => id.startsWith('signpost'))).toBe(true);
  });

  it('solid placed features (signposts, birdbath) get a collider', () => {
    const colliders = getParkColliders();
    for (const f of placedFeatures()) {
      if (f.build === 'picnic') continue; // flat ground cover — intentionally walk-on-able
      const hit = colliders.some((c) => Math.hypot(c.x - f.x, c.z - f.z) < c.radius + 0.01);
      expect(hit, `no collider for ${f.id}`).toBe(true);
    }
  });
});
