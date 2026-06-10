import { describe, expect, it } from 'vitest';
import {
  allItemIds,
  accepts,
  finishesFor,
  isValid,
  itemCount,
  itemId,
  itemName,
  materialsAcceptedBy,
  parseItemId,
  sizesFor,
} from './items';
import { FORMS, FORM_IDS, type FormId } from './forms';
import { MATERIALS, MATERIAL_IDS, materialsInGroup } from './materials';
import { setLang } from '../../i18n';

describe('Workshop materials', () => {
  it('every material belongs to a known group', () => {
    for (const id of MATERIAL_IDS) {
      expect(['wood', 'stone', 'plant', 'found']).toContain(MATERIALS[id].group);
    }
  });

  it('profile dials are normalized 0..1', () => {
    for (const id of MATERIAL_IDS) {
      const p = MATERIALS[id];
      for (const v of [p.strength, p.flexibility, p.warmth]) {
        expect(v, id).toBeGreaterThanOrEqual(0);
        expect(v, id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('groups partition the registry', () => {
    const total = (['wood', 'stone', 'plant', 'found'] as const).reduce(
      (n, g) => n + materialsInGroup(g).length,
      0,
    );
    expect(total).toBe(MATERIAL_IDS.length);
  });
});

describe('Workshop forms', () => {
  it('every form accepts at least one group and has a valid tier', () => {
    for (const id of FORM_IDS) {
      const f = FORMS[id];
      expect(f.accepts.length, id).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(f.tier);
    }
  });

  it('every form has at least one eligible material', () => {
    for (const id of FORM_IDS) {
      expect(materialsAcceptedBy(id).length, id).toBeGreaterThan(0);
    }
  });
});

describe('ItemId scheme', () => {
  it('round-trips build → parse for every reachable id', () => {
    for (const id of allItemIds()) {
      const spec = parseItemId(id);
      expect(spec, id).not.toBeNull();
      expect(itemId(spec!)).toBe(id);
      expect(isValid(spec!)).toBe(true);
    }
  });

  it('rejects malformed and out-of-table ids', () => {
    expect(parseItemId('bench:twig:M')).toBeNull(); // too few parts
    expect(parseItemId('nope:twig:M:plain')).toBeNull(); // unknown form
    expect(parseItemId('bench:unobtanium:M:plain')).toBeNull(); // unknown material
    expect(parseItemId('bench:twig:XL:plain')).toBeNull(); // bad size
    expect(parseItemId('bench:twig:M:sparkly')).toBeNull(); // bad finish
  });

  it('eligibility is exactly group membership', () => {
    for (const f of FORM_IDS) {
      for (const m of MATERIAL_IDS) {
        expect(accepts(f, m)).toBe(FORMS[f].accepts.includes(MATERIALS[m].group));
      }
    }
  });

  it('size/finish ranges honour the form opt-ins', () => {
    for (const f of FORM_IDS) {
      expect(sizesFor(f).length).toBe(FORMS[f].sizes ? 3 : 1);
      expect(finishesFor(f).length).toBe(FORMS[f].finishes ? 3 : 1);
    }
  });
});

describe('Item space (§2.3)', () => {
  it('reaches a Minecraft-scale count (~1000+)', () => {
    expect(itemCount()).toBeGreaterThan(1000);
  });

  it('enumeration is deterministic and unique', () => {
    const a = allItemIds();
    const b = allItemIds();
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
});

describe('Generated names (§2.3 composition, both locales)', () => {
  const spec = (form: FormId) =>
    ({ form, material: materialsAcceptedBy(form)[0], size: 'M', finish: 'plain' }) as const;

  it('composes a non-empty name for every reachable item, no leftover {slots}', () => {
    for (const id of allItemIds().slice(0, 400)) {
      const s = parseItemId(id)!;
      for (const lang of ['en', 'zh'] as const) {
        setLang(lang);
        const name = itemName(s);
        expect(name.length, `${lang} ${id}`).toBeGreaterThan(0);
        expect(name, `${lang} ${id}`).not.toContain('{');
        expect(name, `${lang} ${id}`).not.toMatch(/^material\.|^form\./);
      }
    }
    setLang('en');
  });

  it('M is the unmarked base; S/L add a size adjective', () => {
    setLang('en');
    const base = itemName({ ...spec('trellis'), size: 'M' });
    const tall = itemName({ ...spec('trellis'), size: 'L' });
    const little = itemName({ ...spec('trellis'), size: 'S' });
    expect(tall).toContain('tall');
    expect(little).toContain('little');
    expect(base).not.toContain('tall');
    expect(base).not.toContain('little');
  });

  it('reads material + form (EN word order)', () => {
    setLang('en');
    expect(itemName({ form: 'bench', material: 'plank', size: 'M', finish: 'plain' })).toBe(
      'plank bench',
    );
  });

  it('concatenates naturally in ZH', () => {
    setLang('zh');
    expect(itemName({ form: 'bench', material: 'plank', size: 'M', finish: 'plain' })).toBe(
      '木板长椅',
    );
    expect(itemName({ form: 'trellis', material: 'reed', size: 'L', finish: 'plain' })).toBe(
      '高芦苇花架',
    );
    setLang('en');
  });
});
