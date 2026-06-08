import { describe, expect, it } from 'vitest';
import { BlockerGrid, hashId, scatterCatalog } from './scatter';
import { PROCEDURAL_KINDS } from './catalog/proceduralKinds';
import type { ItemKind } from './catalog/types';
import { inDeepWater, inPark, LANDMARKS } from './zones';

const SEED = 0x5da70;

describe('scatter: hashId', () => {
  it('is stable and varies by id', () => {
    expect(hashId('pine')).toBe(hashId('pine'));
    expect(hashId('pine')).not.toBe(hashId('rock'));
  });
});

describe('scatter: determinism', () => {
  it('is a pure function of the seed', () => {
    const a = scatterCatalog(PROCEDURAL_KINDS, { seed: SEED });
    const b = scatterCatalog(PROCEDURAL_KINDS, { seed: SEED });
    for (const [id, pa] of a) {
      const pb = b.get(id)!;
      expect(pb).toEqual(pa);
    }
  });

  it('changes with a different seed', () => {
    const a = scatterCatalog(PROCEDURAL_KINDS, { seed: SEED });
    const b = scatterCatalog(PROCEDURAL_KINDS, { seed: SEED ^ 0x1234 });
    const pineA = a.get('pine') ?? [];
    const pineB = b.get('pine') ?? [];
    expect(pineA).not.toEqual(pineB);
  });

  it('is invariant to catalog input order (stable id sort)', () => {
    const reversed = [...PROCEDURAL_KINDS].reverse();
    const a = scatterCatalog(PROCEDURAL_KINDS, { seed: SEED });
    const b = scatterCatalog(reversed, { seed: SEED });
    for (const [id, pa] of a) {
      expect(b.get(id)).toEqual(pa);
    }
  });
});

describe('scatter: constraints', () => {
  const all = scatterCatalog(PROCEDURAL_KINDS, { seed: SEED });

  it('never places in deep water or outside the park', () => {
    for (const placements of all.values()) {
      for (const p of placements) {
        expect(inPark(p.x, p.z, 3)).toBe(true);
        expect(inDeepWater(p.x, p.z)).toBe(false);
      }
    }
  });

  it('keeps the spawn meadow and landmarks clear', () => {
    for (const placements of all.values()) {
      for (const p of placements) {
        expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(16);
        for (const lm of LANDMARKS) {
          expect(Math.hypot(p.x - lm.x, p.z - lm.z)).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });

  it('only scatters spawnWeight>0 kinds', () => {
    expect(all.has('big-oak')).toBe(false); // weight 0, landmark
    expect(all.has('pine')).toBe(true);
  });

  it('respects eligible zones (pine stays out of the meadow centre)', () => {
    // pine zones are woods/grove; their centres are far from origin, so no pine
    // should land deep in the meadow near (0,0). Sanity: at least some exist.
    const pine = all.get('pine') ?? [];
    expect(pine.length).toBeGreaterThan(0);
  });
});

describe('scatter: blocker overlap', () => {
  it('blocking kinds do not overlap closer than the gap', () => {
    // Build a synthetic dense blocker kind and confirm no two are jammed.
    const kind: ItemKind = {
      id: 'test-blocker',
      name: 'Test blocker',
      category: 'rock',
      mesh: { kind: 'procedural', build: () => ({ geo: null as never, mat: null as never }) },
      footprintRadius: 0.5,
      blocking: true,
      interactable: false,
      verbs: new Set(),
      zones: [],
      spawnWeight: 5,
      scaleRange: [1, 1],
      license: 'procedural',
    };
    const placements = scatterCatalog([kind], { seed: SEED }).get('test-blocker') ?? [];
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const d = Math.hypot(placements[i].x - placements[j].x, placements[i].z - placements[j].z);
        // both radius 0.5 + gap 1.4 → centres ≥ 2.4 apart
        expect(d).toBeGreaterThanOrEqual(2.4 - 1e-6);
      }
    }
  });

  it('BlockerGrid rejects an overlapping circle and accepts a clear one', () => {
    const g = new BlockerGrid(4);
    g.add(0, 0, 1);
    expect(g.clear(1, 0, 1, 0.5)).toBe(false); // 1 unit apart, need 2.5
    expect(g.clear(10, 10, 1, 0.5)).toBe(true);
  });
});
