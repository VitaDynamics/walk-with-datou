import { describe, expect, it } from 'vitest';
import { __tables, featureText, poiKindName, t } from './i18n';
import { FEATURES } from './game/features';
import { POI_KINDS } from './game/pois';

describe('i18n', () => {
  it('every UI key exists in both locales', () => {
    const en = Object.keys(__tables.UI.en).sort();
    const zh = Object.keys(__tables.UI.zh).sort();
    expect(zh).toEqual(en);
  });

  it('every feature has en + zh name and description', () => {
    for (const f of FEATURES) {
      for (const lang of ['en', 'zh'] as const) {
        const text = __tables.FEATURE_TEXT[lang][f.id];
        expect(text, `${f.id} missing ${lang} text`).toBeDefined();
        expect(text.name.length).toBeGreaterThan(0);
        expect(text.description.length).toBeGreaterThan(0);
      }
    }
  });

  it('every POI kind has en + zh names', () => {
    for (const kind of Object.keys(POI_KINDS)) {
      expect(__tables.POI_KIND_NAME.en[kind], `${kind} missing en`).toBeDefined();
      expect(__tables.POI_KIND_NAME.zh[kind], `${kind} missing zh`).toBeDefined();
    }
  });

  it('t() interpolates {vars}', () => {
    // Default locale is detected; the creator-hint key has a {key} placeholder.
    expect(t('hud.creator', { key: 'C' })).toContain('C');
    expect(t('hud.creator', { key: 'C' })).not.toContain('{key}');
  });

  it('featureText / poiKindName fall back gracefully for unknown ids', () => {
    expect(featureText('nope')).toEqual({ name: 'nope', description: '' });
    expect(poiKindName('nope')).toBe('nope');
  });
});
