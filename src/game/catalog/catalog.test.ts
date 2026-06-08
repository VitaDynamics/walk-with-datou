import { describe, expect, it } from 'vitest';
import { Catalog, validateCatalog } from './catalog';
import { PROCEDURAL_KINDS } from './proceduralKinds';
import { entryToKind, type ManifestEntry } from './manifest';
import { needsMovable } from './verbs';

describe('catalog: procedural kinds', () => {
  it('has unique ids', () => {
    const ids = PROCEDURAL_KINDS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('passes integrity validation', () => {
    expect(validateCatalog(PROCEDURAL_KINDS)).toEqual([]);
  });

  it('registers the original 13+ props', () => {
    const c = new Catalog();
    expect(c.size()).toBeGreaterThanOrEqual(13);
    expect(c.get('pine')?.blocking).toBe(true);
    expect(c.get('lily-pad')?.blocking).toBe(false);
  });
});

describe('catalog: indexes', () => {
  it('buckets by zone, treating empty zones[] as any-zone', () => {
    const c = new Catalog();
    // 'rock' has zones: [] → should appear in every zone bucket.
    for (const z of ['meadow', 'woods', 'lake', 'grove'] as const) {
      expect(c.byZone(z).some((k) => k.id === 'rock')).toBe(true);
    }
    // 'pine' is woods/grove only.
    expect(c.byZone('woods').some((k) => k.id === 'pine')).toBe(true);
    expect(c.byZone('meadow').some((k) => k.id === 'pine')).toBe(false);
  });

  it('buckets by category', () => {
    const c = new Catalog();
    expect(c.byCategory('tree').map((k) => k.id)).toContain('pine');
    expect(c.byCategory('tree').map((k) => k.id)).toContain('big-oak');
  });

  it('throws on duplicate id', () => {
    const c = new Catalog();
    expect(() => c.add(PROCEDURAL_KINDS[0])).toThrow(/duplicate/);
  });

  it('scatterable() excludes hand-placed landmarks (spawnWeight 0)', () => {
    const c = new Catalog();
    const ids = c.scatterable().map((k) => k.id);
    expect(ids).not.toContain('big-oak');
    expect(ids).toContain('pine');
  });
});

describe('catalog: verbs', () => {
  it('interactable kinds declare verbs; decoratives do not', () => {
    for (const k of PROCEDURAL_KINDS) {
      if (k.interactable) expect(k.verbs.size).toBeGreaterThan(0);
      else expect(k.verbs.size).toBe(0);
    }
  });

  it('needsMovable detects physical verbs', () => {
    expect(needsMovable(new Set(['sniff']))).toBe(false);
    expect(needsMovable(new Set(['throw']))).toBe(true);
    expect(needsMovable(new Set(['knockOver']))).toBe(true);
  });
});

describe('catalog: manifest entries', () => {
  const entry: ManifestEntry = {
    id: 'ball-red',
    name: 'Red ball',
    category: 'toy',
    modelPath: 'models/toy/ball-red.glb',
    license: 'CC0',
    footprintRadius: 0.2,
    blocking: false,
    interactable: true,
    verbs: ['carry', 'throw', 'push'],
    zones: [],
    spawnWeight: 1,
    scaleRange: [0.9, 1.1],
    mass: 0.4,
  };

  it('maps a manifest entry into a gltf ItemKind', () => {
    const k = entryToKind(entry);
    expect(k.mesh.kind).toBe('gltf');
    if (k.mesh.kind === 'gltf') expect(k.mesh.url).toContain('models/toy/ball-red.glb');
    expect(k.verbs.has('throw')).toBe(true);
    expect(k.license).toBe('CC0');
  });

  it('GLB-derived kinds pass validation and merge into the catalog', () => {
    const k = entryToKind(entry);
    expect(validateCatalog([...PROCEDURAL_KINDS, k])).toEqual([]);
    const c = new Catalog();
    c.addAll([k]);
    expect(c.get('ball-red')?.category).toBe('toy');
    expect(c.interactable().some((x) => x.id === 'ball-red')).toBe(true);
  });
});
