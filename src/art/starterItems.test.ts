import { describe, expect, it } from 'vitest';
import { STARTER_ITEM_FORMS } from '../game/workshop/forms';
import { isStarterAssetForm, STARTER_ASSET_FORMS, starterItemSpriteUrl } from './starterItems';

describe('starter item assets', () => {
  it('covers every starter form except the separately staged food bowl', () => {
    expect(STARTER_ASSET_FORMS).toHaveLength(9);
    expect([...STARTER_ASSET_FORMS, 'food-bowl'].sort()).toEqual([...STARTER_ITEM_FORMS].sort());
  });

  it('exposes one bundled bitmap URL per authored form', () => {
    for (const form of STARTER_ASSET_FORMS) {
      expect(isStarterAssetForm(form)).toBe(true);
      expect(starterItemSpriteUrl(form)).toMatch(/\.png$/);
    }
    expect(isStarterAssetForm('bench')).toBe(false);
  });
});
