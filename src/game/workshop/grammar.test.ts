import { describe, expect, it } from 'vitest';
import { classify, dominantMaterial, grammarResult } from './grammar';
import { arrangement } from './pattern';
import { isValid, parseItemId } from './items';
import { groupOf, MATERIAL_IDS, type MaterialId } from './materials';
import { FORM_IDS } from './forms';

/** Build a live-style arrangement from per-cell materials (groups derived). */
function arr(materials: (MaterialId | null)[], stacks: number[]) {
  return {
    cells: materials.map((m) => (m ? groupOf(m) : null)),
    stacks,
    materials,
  };
}

const W = 'plank' as const;
const S = 'pebble' as const;
const P = 'reed' as const;
const _ = null;

describe('shape classification', () => {
  it('reads a clean row and column distinctly', () => {
    expect(classify(arrangement([_, _, _, 'wood', 'wood', 'wood', _, _, _], [0, 0, 0, 1, 1, 1, 0, 0, 0]))).toBe('row');
    expect(classify(arrangement([_, 'wood', _, _, 'wood', _, _, 'wood', _], [0, 1, 0, 0, 1, 0, 0, 1, 0]))).toBe('column');
  });

  it('reads a ring and a block', () => {
    expect(classify(arrangement(['stone', 'stone', 'stone', 'stone', _, 'stone', 'stone', 'stone', 'stone'], [1, 1, 1, 1, 0, 1, 1, 1, 1]))).toBe('ring');
    expect(classify(arrangement(['wood', 'wood', _, 'wood', 'wood', _, _, _, _], [1, 1, 0, 1, 1, 0, 0, 0, 0]))).toBe('block');
  });

  it('empty bench is scatter', () => {
    expect(classify(arrangement(Array(9).fill(null), Array(9).fill(0)))).toBe('scatter');
  });
});

describe('dominant material', () => {
  it('picks the heaviest-weighted material and a secondary group', () => {
    const a = arr([W, W, _, P, _, _, _, _, _], [2, 2, 0, 1, 0, 0, 0, 0, 0]);
    const { material, secondaryGroup } = dominantMaterial(a);
    expect(material).toBe('plank');
    expect(secondaryGroup).toBe('plant');
  });
});

describe('grammar resolution (§3.2 — always yields something)', () => {
  it('produces a valid item for a readable arrangement', () => {
    const a = arr([_, _, _, W, W, W, _, _, _], [0, 0, 0, 1, 1, 1, 0, 0, 0]);
    const r = grammarResult(a);
    expect(r.kind).toBe('item');
    if (r.kind === 'item') {
      expect(isValid(r.spec)).toBe(true);
      expect(parseItemId(r.id)).not.toBeNull();
    }
  });

  it('fizzles an empty / material-less bench into a curio', () => {
    const r = grammarResult(arr(Array(9).fill(null), Array(9).fill(0)));
    expect(r.kind).toBe('curio');
  });

  it('heavier mass yields a larger size', () => {
    const light = grammarResult(arr([P, _, _, _, _, _, _, _, _], [1, 0, 0, 0, 0, 0, 0, 0, 0]));
    const heavy = grammarResult(arr([P, P, P, P, P, P, P, P, P], [3, 3, 3, 3, 3, 3, 3, 3, 3]));
    if (light.kind === 'item' && heavy.kind === 'item') {
      const order = { S: 0, M: 1, L: 2 } as const;
      expect(order[heavy.spec.size]).toBeGreaterThanOrEqual(order[light.spec.size]);
    }
  });

  it('is a pure function — same input, same output', () => {
    const a = arr([W, W, W, _, S, _, _, _, _], [1, 1, 1, 0, 2, 0, 0, 0, 0]);
    expect(grammarResult(a)).toEqual(grammarResult(a));
  });

  it('every single material as a lone placement yields item or curio (never throws / never invalid)', () => {
    for (const m of MATERIAL_IDS) {
      const r = grammarResult(arr([m, _, _, _, _, _, _, _, _], [1, 0, 0, 0, 0, 0, 0, 0, 0]));
      if (r.kind === 'item') expect(isValid(r.spec), m).toBe(true);
    }
  });
});

describe('grammar picks only real, non-tool forms', () => {
  it('never emits a tool form from the grammar', () => {
    for (const m of MATERIAL_IDS) {
      const r = grammarResult(arr([m, m, m, _, _, _, _, _, _], [2, 2, 2, 0, 0, 0, 0, 0, 0]));
      if (r.kind === 'item') {
        expect(FORM_IDS).toContain(r.spec.form);
      }
    }
  });
});
