import { describe, expect, it } from 'vitest';
import { CLEARINGS } from './landmarks';
import { KIND_DEFS, LAKE, kindDef, scatterPickables, scatterStatic } from './scatter';
import { WORLD_HALF, zoneAt } from './zones';

describe('world scatter', () => {
  it('is deterministic for the same seed', () => {
    expect(scatterStatic(123)).toEqual(scatterStatic(123));
    expect(scatterPickables(20260610)).toEqual(scatterPickables(20260610));
  });

  it('pickables re-roll with the daily seed; statics do not move', () => {
    const a = scatterPickables(20260610);
    const b = scatterPickables(20260611);
    expect(a.map((i) => `${i.x},${i.z}`)).not.toEqual(b.map((i) => `${i.x},${i.z}`));
  });

  it('places a substantial, bounded world', () => {
    const all = [...scatterStatic(1), ...scatterPickables(2)];
    expect(all.length).toBeGreaterThan(8000);
    for (const inst of all) {
      const r = Math.hypot(inst.x, inst.z);
      expect(r).toBeLessThanOrEqual(WORLD_HALF);
      // Small detail may grow close to home; solid props keep their distance.
      expect(r).toBeGreaterThanOrEqual((kindDef(inst.kind).collider > 0 ? 9 : 4.5) - 1e-9);
    }
  });

  it('keeps everything except reeds out of the lake', () => {
    for (const inst of [...scatterStatic(1), ...scatterPickables(2)]) {
      const d = Math.hypot(inst.x - LAKE.x, inst.z - LAKE.z);
      if (inst.kind === 'reed') {
        expect(d).toBeGreaterThan(LAKE.radius - 2.5);
      } else {
        expect(d, inst.id).toBeGreaterThan(LAKE.radius);
      }
    }
  });

  it('reeds only grow at the lake rim and pines mostly in the woods', () => {
    const statics = scatterStatic(7);
    const reeds = statics.filter((i) => i.kind === 'reed');
    expect(reeds.length).toBeGreaterThan(50);
    const pines = statics.filter((i) => i.kind === 'pine');
    const inWoods = pines.filter((i) => zoneAt(i.x, i.z).id === 'woods').length;
    expect(inWoods / pines.length).toBeGreaterThan(0.7);
  });

  it('keeps landmark activity rings clear of all scatter (reed screens stay)', () => {
    const all = [...scatterStatic(1), ...scatterPickables(2)];
    for (const c of CLEARINGS.filter((c) => c.density === 0)) {
      for (const inst of all) {
        if (inst.kind === 'reed') continue; // the pump garden's concealment
        expect(Math.hypot(inst.x - c.x, inst.z - c.z), inst.id).toBeGreaterThanOrEqual(c.r);
      }
    }
  });

  it('damps scatter density in the landmark approach rings', () => {
    // Same seed with and without clearings: the damped annulus thins out.
    const damped = [...scatterStatic(1), ...scatterPickables(2)];
    const baseline = [...scatterStatic(1, []), ...scatterPickables(2, [])];
    // Reeds are exempt from clearings by design (the garden's concealment
    // screen) — skip them so lake-adjacent rings measure what's damped.
    const inRing = (list: typeof damped, c: (typeof CLEARINGS)[number]): number =>
      list.filter((i) => i.kind !== 'reed' && Math.hypot(i.x - c.x, i.z - c.z) < c.r).length;
    // Per-ring counts are noisy (clustered kinds re-roll whole patches and
    // the damped run consumes extra rng draws), so assert on the aggregate
    // across all damped rings, plus a lax per-ring sanity bound.
    let beforeSum = 0;
    let afterSum = 0;
    for (const c of CLEARINGS.filter((c) => c.density > 0)) {
      const before = inRing(baseline, c);
      const after = inRing(damped, c);
      expect(before).toBeGreaterThan(30); // the ring isn't empty to begin with
      expect(after).toBeLessThan(before); // every ring thins at least somewhat
      beforeSum += before;
      afterSum += after;
    }
    expect(afterSum).toBeLessThan(beforeSum * 0.6);
  });

  it('ids are unique and every kind has a definition', () => {
    const all = [...scatterStatic(1), ...scatterPickables(2)];
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    for (const def of KIND_DEFS) expect(kindDef(def.kind)).toBe(def);
  });
});
