import { describe, expect, it } from 'vitest';
import {
  ORCHARD_TREES,
  VEG_ROWS,
  orchardTreeNear,
  treeStageFor,
  vegRowNear,
} from './orchard';
import { LAKE } from './scatter';
import { WORLD_HALF } from './zones';

describe('the Meadow Orchard (E4)', () => {
  it('every tree and row sits inside the world and out of the lake', () => {
    for (const p of [...ORCHARD_TREES, ...VEG_ROWS]) {
      expect(Math.abs(p.x), p.id).toBeLessThan(WORLD_HALF - 8);
      expect(Math.abs(p.z), p.id).toBeLessThan(WORLD_HALF - 8);
      expect(Math.hypot(p.x - LAKE.x, p.z - LAKE.z), p.id).toBeGreaterThan(LAKE.radius + 2);
    }
  });

  it('seasons shape the trees: blossom → fruit → bare', () => {
    expect(treeStageFor('spring')).toBe('blossom');
    expect(treeStageFor('summer')).toBe('fruiting');
    expect(treeStageFor('autumn')).toBe('fruiting');
    expect(treeStageFor('winter')).toBe('bare');
  });

  it('proximity helpers find the orchard, not the meadow', () => {
    const t = ORCHARD_TREES[0];
    expect(orchardTreeNear(t.x + 0.5, t.z - 0.5)?.id).toBe(t.id);
    expect(orchardTreeNear(0, 0)).toBeNull();
    const r = VEG_ROWS[0];
    expect(vegRowNear(r.x + 2, r.z)?.id).toBe(r.id);
    expect(vegRowNear(0, 0)).toBeNull();
  });
});
