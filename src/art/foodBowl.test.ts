import { describe, expect, it } from 'vitest';
import { nextFoodBowlStage, normalizeFoodBowlStage } from './foodBowl';
import { itemHeight } from '../game/workshop/sprites';

describe('food bowl stages', () => {
  it('advances in order and rests at the reward state', () => {
    expect(nextFoodBowlStage('empty')).toBe('filled');
    expect(nextFoodBowlStage('filled')).toBe('enjoyed');
    expect(nextFoodBowlStage('enjoyed')).toBe('reward');
    expect(nextFoodBowlStage('reward')).toBe('reward');
  });

  it('normalizes missing or stale save data to empty', () => {
    expect(normalizeFoodBowlStage(undefined)).toBe('empty');
    expect(normalizeFoodBowlStage('old-stage')).toBe('empty');
    expect(normalizeFoodBowlStage('enjoyed')).toBe('enjoyed');
  });

  it('keeps every crafted size readable in the world', () => {
    expect(
      itemHeight({ form: 'food-bowl', material: 'shell', size: 'S', finish: 'plain' }),
    ).toBe(0.54);
    expect(
      itemHeight({ form: 'food-bowl', material: 'flat-stone', size: 'M', finish: 'plain' }),
    ).toBe(0.6);
    expect(
      itemHeight({ form: 'food-bowl', material: 'clay-lump', size: 'L', finish: 'plain' }),
    ).toBe(0.72);
  });
});
