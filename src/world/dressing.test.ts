import { describe, expect, it } from 'vitest';
import { DRESSING, dressedNear } from './dressing';
import { isValid, parseItemId } from '../game/workshop/items';
import { patternForForm } from '../game/workshop/patterns';
import { LAKE } from './scatter';
import { WORLD_HALF } from './zones';

describe('world dressing (E6)', () => {
  it('every dressed item is a VALID workshop item (form accepts material)', () => {
    for (const item of DRESSING) {
      expect(isValid(item.spec), item.id).toBe(true);
      expect(parseItemId(item.id), item.id).not.toBeNull();
    }
  });

  it('every piece sits inside the world and out of the water', () => {
    for (const item of DRESSING) {
      expect(Math.abs(item.x), item.id).toBeLessThan(WORLD_HALF - 6);
      expect(Math.abs(item.z), item.id).toBeLessThan(WORLD_HALF - 6);
      expect(Math.hypot(item.x - LAKE.x, item.z - LAKE.z), item.id).toBeGreaterThan(LAKE.radius);
    }
  });

  it('most dressed forms can teach a pattern (neighbor teaching has teeth)', () => {
    const teachable = DRESSING.filter((d) => patternForForm(d.spec.form)).length;
    expect(teachable).toBeGreaterThanOrEqual(DRESSING.length / 2);
  });

  it('dressedNear finds furniture, not open meadow', () => {
    const first = DRESSING[0];
    expect(dressedNear(first.x + 0.4, first.z - 0.4)?.id).toBe(first.id);
    expect(dressedNear(0, 0)).toBeNull();
  });
});
