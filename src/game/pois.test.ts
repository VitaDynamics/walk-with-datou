import { describe, expect, it } from 'vitest';
import { placePois, PoiField, POI_KINDS, POI_REACH_DIST, type PoiData } from './pois';
import { getParkColliders } from './World';
import { inDeepWater, inPark } from './zones';

describe('placePois', () => {
  const pois = placePois();

  it('places a reasonable number of POIs, deterministically', () => {
    expect(pois.length).toBeGreaterThan(10);
    // Seeded → a second call yields the same set.
    const again = placePois();
    expect(again.length).toBe(pois.length);
    expect(again[0]).toEqual(pois[0]);
  });

  it('never spawns a POI inside the park boundary, deep water, or a collider', () => {
    const colliders = getParkColliders();
    for (const p of pois) {
      expect(inPark(p.x, p.z, 4), `POI ${p.id} out of park`).toBe(true);
      expect(inDeepWater(p.x, p.z), `POI ${p.id} in deep water`).toBe(false);
      const clash = colliders.find((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.radius);
      expect(clash, `POI ${p.id} inside a collider`).toBeUndefined();
    }
  });

  it('keeps the spawn area clear', () => {
    for (const p of pois) {
      expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(10);
    }
  });

  it('only assigns each POI a kind valid for its zone', () => {
    for (const p of pois) {
      const zones = POI_KINDS[p.kind].zones;
      if (zones.length > 0) expect(zones).toContain(p.zone);
    }
  });
});

describe('PoiField', () => {
  const sample: PoiData[] = [
    { id: 0, kind: 'sniff-spot', x: 5, z: 0, zone: 'meadow' },
    { id: 1, kind: 'shiny-thing', x: 20, z: 0, zone: 'grove' },
    { id: 2, kind: 'butterfly', x: 0, z: 100, zone: 'meadow' },
  ];

  it('finds the nearest undiscovered POI within range', () => {
    const f = new PoiField(sample.map((p) => ({ ...p })));
    const near = f.nearestUndiscovered(0, 0, 30);
    expect(near?.id).toBe(0); // (5,0) is nearest; (0,100) is out of range
  });

  it('skips discovered POIs and counts discoveries', () => {
    const f = new PoiField(sample.map((p) => ({ ...p })));
    expect(f.discover(0)?.id).toBe(0);
    expect(f.discover(0)).toBeNull(); // already discovered
    expect(f.discoveredCount).toBe(1);
    expect(f.isDiscovered(0)).toBe(true);
    // Now the nearest undiscovered within 30 m is (20,0).
    expect(f.nearestUndiscovered(0, 0, 30)?.id).toBe(1);
  });

  it('returns null when nothing is in range', () => {
    const f = new PoiField(sample.map((p) => ({ ...p })));
    expect(f.nearestUndiscovered(0, 0, 3)).toBeNull();
  });

  it('zoneScore biases selection toward higher-scored zones', () => {
    const f = new PoiField([
      { id: 0, kind: 'sniff-spot', x: 12, z: 0, zone: 'meadow' },
      { id: 1, kind: 'sniff-spot', x: 14, z: 0, zone: 'woods' },
    ]);
    // Without bias the closer meadow POI (id 0) wins.
    expect(f.nearestUndiscovered(0, 0, 30)?.id).toBe(0);
    // A strong score for 'woods' (1.0) shaves >6 m off its cost → woods wins
    // despite being 2 m farther.
    const score = (z: string) => (z === 'woods' ? 1 : 0);
    expect(f.nearestUndiscovered(0, 0, 30, score)?.id).toBe(1);
  });

  it('poiAt detects an arrival within reach distance', () => {
    const f = new PoiField(sample.map((p) => ({ ...p })));
    expect(f.poiAt(5 + POI_REACH_DIST - 0.1, 0)?.id).toBe(0);
    expect(f.poiAt(5 + POI_REACH_DIST + 1, 0)).toBeNull();
  });
});
