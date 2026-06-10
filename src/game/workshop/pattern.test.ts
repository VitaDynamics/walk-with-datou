import { describe, expect, it } from 'vitest';
import { arrangement, canonical, filledCount, mass, isEmpty, EMPTY } from './pattern';
import { EXACT_PATTERNS, matchExact, patternKeys } from './patterns';
import { FORMS } from './forms';

const rowWood = arrangement(
  [null, null, null, 'wood', 'wood', 'wood', null, null, null],
  [0, 0, 0, 2, 2, 2, 0, 0, 0],
);
// Same row, rotated 90° → a column.
const colWood = arrangement(
  [null, 'wood', null, null, 'wood', null, null, 'wood', null],
  [0, 2, 0, 0, 2, 0, 0, 2, 0],
);
// The row mirrored is the same row (symmetric) — must share the key.
const rowWoodMirror = arrangement(
  [null, null, null, 'wood', 'wood', 'wood', null, null, null],
  [0, 0, 0, 2, 2, 2, 0, 0, 0],
);

describe('arrangement basics', () => {
  it('counts filled cells and mass', () => {
    expect(filledCount(rowWood)).toBe(3);
    expect(mass(rowWood)).toBe(6);
    expect(isEmpty(EMPTY)).toBe(true);
    expect(isEmpty(rowWood)).toBe(false);
  });
});

describe('canonical (V₄ flip/180° invariance, orientation-preserving)', () => {
  it('is invariant under mirror but NOT under quarter-turn', () => {
    // A row mirrored is the same row (shared key)…
    expect(canonical(rowWood)).toBe(canonical(rowWoodMirror));
    // …but a row rotated 90° is a column — a DIFFERENT thing (§3.2).
    expect(canonical(rowWood)).not.toBe(canonical(colWood));
  });

  it('distinguishes different material groups in the same shape', () => {
    const rowStone = arrangement(
      [null, null, null, 'stone', 'stone', 'stone', null, null, null],
      [0, 0, 0, 2, 2, 2, 0, 0, 0],
    );
    expect(canonical(rowWood)).not.toBe(canonical(rowStone));
  });

  it('distinguishes different stacks in the same shape', () => {
    const rowLight = arrangement(
      [null, null, null, 'wood', 'wood', 'wood', null, null, null],
      [0, 0, 0, 1, 1, 1, 0, 0, 0],
    );
    expect(canonical(rowWood)).not.toBe(canonical(rowLight));
  });

  it('is stable (same input → same key)', () => {
    expect(canonical(rowWood)).toBe(canonical(rowWood));
  });
});

describe('exact pattern table', () => {
  const authoredAdditions = [
    'brush',
    'wayfinder',
    'field-glass',
    'play-ball',
    'cache-box',
    'drinking-bowl',
    'bug-hotel',
    'raft',
  ] as const;

  it('every pattern result is a real form', () => {
    for (const p of EXACT_PATTERNS) expect(p.result in FORMS, p.result).toBe(true);
  });

  it('all patterns are unique under rotation+mirror', () => {
    const keys = EXACT_PATTERNS.map(canonical);
    expect(new Set(keys).size, 'duplicate canonical patterns').toBe(keys.length);
  });

  it('matchExact resolves an authored pattern and rejects the empty bench', () => {
    expect(matchExact(canonical(rowWood))).toBe('beam');
    // Rotated row still matches the same beam (it is a line in any orientation
    // — but the column pattern is a *distinct* authored entry; the row maps to
    // beam, so a rotated row resolves to beam regardless).
    expect(matchExact(canonical(EMPTY))).toBeNull();
  });

  it('exposes its keys for near-miss search', () => {
    expect(patternKeys().length).toBe(EXACT_PATTERNS.length);
  });

  it('gives each new companion form one recipe within its tier cell budget', () => {
    for (const id of authoredAdditions) {
      const recipes = EXACT_PATTERNS.filter((pattern) => pattern.result === id);
      expect(recipes, id).toHaveLength(1);
      const cells = filledCount(recipes[0]);
      expect(cells, id).toBeLessThanOrEqual(FORMS[id].tier === 1 ? 4 : 7);
      if (FORMS[id].tier === 2) expect(cells, id).toBeGreaterThanOrEqual(4);
    }
  });
});
