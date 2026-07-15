import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng (mulberry32)', () => {
  it('is reproducible: same seed produces the same sequence', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different seeds diverge', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    let differ = false;
    for (let i = 0; i < 10; i++) {
      if (a.next() !== b.next()) differ = true;
    }
    expect(differ).toBe(true);
  });

  it('stays in [0, 1)', () => {
    const r = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('range(min,max) stays within bounds', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const x = r.range(-5, 5);
      expect(x).toBeGreaterThanOrEqual(-5);
      expect(x).toBeLessThan(5);
    }
  });

  it('getState/setState restore the exact stream', () => {
    const r = new Rng(42);
    for (let i = 0; i < 13; i++) r.next();
    const saved = r.getState();
    const expected = [r.next(), r.next(), r.next()];

    r.setState(saved);
    expect([r.next(), r.next(), r.next()]).toEqual(expected);
  });
});
