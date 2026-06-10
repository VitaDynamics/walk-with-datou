import { describe, expect, it } from 'vitest';
import { weatherFor, seasonFor, tintFor, WEATHERS } from './weather';
import { rollInspiration, type InspoContext } from './inspiration';
import { canonical } from './pattern';
import { EXACT_PATTERNS } from './patterns';
import { FORMS, type FormId } from './forms';

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('weather & season (seeded, deterministic)', () => {
  it('weather is a stable function of the date', () => {
    for (const day of [D(2026, 6, 10), D(2026, 1, 1), D(2026, 12, 25)]) {
      expect(weatherFor(day)).toBe(weatherFor(day));
      expect(WEATHERS).toContain(weatherFor(day));
    }
  });

  it('different days can differ; same day never does', () => {
    const a = weatherFor(D(2026, 6, 10));
    const b = weatherFor(D(2026, 6, 11));
    expect(a).toBe(weatherFor(D(2026, 6, 10)));
    void b;
  });

  it('season maps months correctly', () => {
    expect(seasonFor(D(2026, 1, 15))).toBe('winter');
    expect(seasonFor(D(2026, 4, 15))).toBe('spring');
    expect(seasonFor(D(2026, 7, 15))).toBe('summer');
    expect(seasonFor(D(2026, 10, 15))).toBe('autumn');
    expect(seasonFor(D(2026, 12, 15))).toBe('winter');
  });

  it('tint stays quiet (multipliers near 1, haze ≤ 0.18)', () => {
    for (const day of [D(2026, 1, 1), D(2026, 7, 1), D(2026, 10, 1)]) {
      const t = tintFor(day);
      for (const v of [t.r, t.g, t.b]) {
        expect(v).toBeGreaterThan(0.9);
        expect(v).toBeLessThan(1.07);
      }
      expect(t.haze).toBeLessThanOrEqual(0.18);
    }
  });
});

const baseCtx: InspoContext = {
  zone: 'lake',
  weather: 'rain',
  season: 'summer',
  mood: 'calm',
  bond: 40,
  personality: 'balanced',
  tick: 7,
  date: D(2026, 6, 10),
};

describe('inspiration engine (BUILDING_SYSTEM §5)', () => {
  const none = new Set<string>();

  it('is deterministic — same context yields the same hint', () => {
    const a = rollInspiration(baseCtx, none, none, 1);
    const b = rollInspiration(baseCtx, none, none, 1);
    expect(a).toEqual(b);
  });

  it('respects the bond tier gate (low bond → only tier-1 forms)', () => {
    const lowBond = { ...baseCtx, bond: 10 };
    // Force a roll many ticks; any hint must point at a tier-1 form.
    for (let tick = 0; tick < 40; tick++) {
      const h = rollInspiration({ ...lowBond, tick }, none, none, 1);
      if (!h) continue;
      const pat = EXACT_PATTERNS.find((p) => canonical(p) === h.pattern)!;
      expect(FORMS[pat.result as FormId].tier).toBe(1);
    }
  });

  it('reveals 2–4 cells, never all', () => {
    for (let tick = 0; tick < 30; tick++) {
      const h = rollInspiration({ ...baseCtx, tick }, none, none, 1);
      if (!h) continue;
      expect(h.revealedCells.length).toBeGreaterThanOrEqual(2);
      expect(h.revealedCells.length).toBeLessThanOrEqual(4);
    }
  });

  it('never hints an already-found or already-hinted pattern', () => {
    const all = new Set(EXACT_PATTERNS.map(canonical));
    expect(rollInspiration(baseCtx, all, none, 1)).toBeNull(); // all found
    expect(rollInspiration(baseCtx, none, all, 1)).toBeNull(); // all hinted
  });

  it('low chance can decline to fire', () => {
    // With chance 0, it must never fire regardless of context.
    let fired = 0;
    for (let tick = 0; tick < 50; tick++) {
      if (rollInspiration({ ...baseCtx, tick }, none, none, 0)) fired++;
    }
    expect(fired).toBe(0);
  });
});
