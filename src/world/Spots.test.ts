import { describe, expect, it } from 'vitest';
import { SPOT_ANCHORS } from './layout';
import { SPOTS_PER_DAY, SpotField, dailyKey, dailySeed } from './Spots';

describe('SpotField', () => {
  it('is deterministic for a given seed', () => {
    const a = new SpotField(20260610, SPOT_ANCHORS);
    const b = new SpotField(20260610, SPOT_ANCHORS);
    expect(a.spots).toEqual(b.spots);
  });

  it('rotates hiding places across days', () => {
    const a = new SpotField(20260610, SPOT_ANCHORS);
    const b = new SpotField(20260611, SPOT_ANCHORS);
    expect(a.spots.map((s) => `${s.place}:${s.art}`)).not.toEqual(
      b.spots.map((s) => `${s.place}:${s.art}`),
    );
  });

  it(`hides ${SPOTS_PER_DAY} distinct places per day`, () => {
    const f = new SpotField(20260610, SPOT_ANCHORS);
    expect(f.spots).toHaveLength(SPOTS_PER_DAY);
    expect(new Set(f.spots.map((s) => s.place)).size).toBe(SPOTS_PER_DAY);
  });

  it('keeps spots near their anchors (small jitter only)', () => {
    const f = new SpotField(20260610, SPOT_ANCHORS);
    for (const s of f.spots) {
      const anchor = SPOT_ANCHORS.find((a) => a.place === s.place)!;
      expect(Math.hypot(s.x - anchor.x, s.z - anchor.z)).toBeLessThanOrEqual(Math.SQRT2 * 0.5);
    }
  });

  it('finds the nearest undiscovered spot and consumes found ones', () => {
    const f = new SpotField(20260610, SPOT_ANCHORS);
    const first = f.nearestUndiscovered(0, 0, 100)!;
    expect(first).not.toBeNull();
    f.markFound(first.id);
    expect(f.foundCount).toBe(1);
    const second = f.nearestUndiscovered(0, 0, 100);
    expect(second?.id).not.toBe(first.id);
    // markFound is idempotent.
    expect(f.markFound(first.id)).toBeNull();
  });

  it('restores found state from persisted ids', () => {
    const f = new SpotField(20260610, SPOT_ANCHORS);
    f.markFound(f.spots[1].id);
    const g = new SpotField(20260610, SPOT_ANCHORS);
    g.restoreFound(f.foundIds());
    expect(g.foundIds()).toEqual(f.foundIds());
  });

  it('derives a stable daily seed/key from a date', () => {
    const d = new Date(2026, 5, 10); // June 10, 2026
    expect(dailySeed(d)).toBe(20260610);
    expect(dailyKey(d)).toBe('20260610');
  });
});
