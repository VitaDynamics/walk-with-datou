import { describe, expect, it } from 'vitest';
import {
  allItemIds,
  accepts,
  finishesFor,
  formName,
  isValid,
  itemCount,
  itemId,
  itemName,
  materialsAcceptedBy,
  parseItemId,
  rarityFor,
  sizesFor,
} from './items';
import {
  FORMS,
  FORM_IDS,
  ITEM_RARITIES,
  STARTER_ITEM_FORMS,
  type Form,
  type FormId,
} from './forms';
import { CATALOG_FORMS } from './formCatalog';
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
  it('offers at least 500 distinct forms', () => {
    expect(FORM_IDS.length).toBeGreaterThanOrEqual(500);
    expect(Object.keys(CATALOG_FORMS)).toHaveLength(942);
  });

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

  it('gives every form a complete visual identity card', () => {
    const fingerprints = new Set<string>();
    for (const id of FORM_IDS) {
      const identity = FORMS[id].identity;
      expect(identity.name.length, id).toBeGreaterThan(2);
      expect(identity.functionalCue.length, id).toBeGreaterThan(20);
      expect(identity.signatureFeatures, id).toHaveLength(3);
      expect(identity.duplicateGroup.length, id).toBeGreaterThan(2);
      const fingerprint = JSON.stringify(identity);
      expect(fingerprints.has(fingerprint), `duplicate identity: ${id}`).toBe(false);
      fingerprints.add(fingerprint);
    }
  });

  it('does not treat style, rarity, or condition adjectives as separate forms', () => {
    const retired = [
      'simple-chair',
      'rustic-chair',
      'painted-chair',
      'moonlit-chair',
      'heirloom-chair',
      'rough-wall-section',
      'clockwork-wall-section',
      'ancient-cabin',
      'starlit-windmill',
      'masterwork-hammer',
    ];
    for (const id of retired) expect(FORM_IDS).not.toContain(id);
  });

  it('assigns every form one of all five rarity levels', () => {
    const seen = new Set();
    for (const id of FORM_IDS) {
      expect(ITEM_RARITIES, id).toContain(rarityFor(id));
      seen.add(rarityFor(id));
    }
    expect(seen).toEqual(new Set(ITEM_RARITIES));
  });

  it('gives generated catalog forms readable fallback names', () => {
    const generated = Object.keys(CATALOG_FORMS) as FormId[];
    for (const id of generated.slice(0, 30)) {
      expect(formName(id), id).not.toContain('form.');
      expect(formName(id), id).not.toContain('-');
    }
  });

  it('ships ten distinct opening forms with readable localized names', () => {
    expect(STARTER_ITEM_FORMS).toHaveLength(10);
    expect(new Set(STARTER_ITEM_FORMS).size).toBe(10);
    for (const id of STARTER_ITEM_FORMS) {
      expect(FORM_IDS).toContain(id);
      for (const lang of ['en', 'zh'] as const) {
        setLang(lang);
        expect(formName(id), `${lang}:${id}`).not.toContain('form.');
      }
    }
    setLang('en');
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

  it('eligibility follows group membership and optional material whitelists', () => {
    for (const f of FORM_IDS) {
      for (const m of MATERIAL_IDS) {
        const def: Form = FORMS[f];
        const expected =
          def.accepts.includes(MATERIALS[m].group) && (!def.materials || def.materials.includes(m));
        expect(accepts(f, m)).toBe(expected);
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

describe('Minecraft-inspired companion forms', () => {
  const ids = [
    'brush',
    'wayfinder',
    'field-glass',
    'play-ball',
    'cache-box',
    'drinking-bowl',
    'bug-hotel',
    'raft',
  ] as const satisfies readonly FormId[];

  it('carry complete authoring metadata and sensible material lists', () => {
    for (const id of ids) {
      const def: Form = FORMS[id];
      expect(def.materials?.length, id).toBeGreaterThanOrEqual(3);
      expect(def.materials?.length, id).toBeLessThanOrEqual(12);
      expect(def.companionshipHook?.length, id).toBeGreaterThan(20);
      expect(def.inspiration?.length, id).toBeGreaterThan(10);
      expect(def.world, id).toBeDefined();
      for (const material of def.materials ?? []) {
        expect(def.accepts, `${id}:${material}`).toContain(MATERIALS[material].group);
      }
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
