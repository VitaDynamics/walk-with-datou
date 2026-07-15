import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Backpack } from './Backpack';
import { RECIPES } from './Crafting';
import { migratePlaced, verbFor } from './placed';

describe('Backpack', () => {
  beforeEach(() => {
    // Isolated storage per test (node 22 exposes localStorage; stub to be safe).
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it('adds, counts, and takes items', () => {
    const pack = new Backpack('test.pack');
    pack.add('twig', 2);
    pack.add('clay-lump');
    expect(pack.count('twig')).toBe(2);
    expect(pack.count('clay-lump')).toBe(1);
    expect(pack.take('twig')).toBe(true);
    expect(pack.count('twig')).toBe(1);
    expect(pack.take('pebble')).toBe(false);
    expect(pack.held()).toEqual(['twig', 'clay-lump']);
  });

  it('persists across instances', () => {
    const a = new Backpack('test.pack');
    a.add('flower', 3);
    const b = new Backpack('test.pack');
    expect(b.count('flower')).toBe(3);
  });

  it('holds Workshop-made items by generative id, round-tripping the count', () => {
    const pack = new Backpack('test.pack');
    const id = 'stool:twig:M:plain';
    pack.add(id);
    pack.add(id);
    expect(pack.count(id)).toBe(2);
    // Place one (take), pick it back up (add) — the reversible verb.
    expect(pack.take(id)).toBe(true);
    expect(pack.count(id)).toBe(1);
    pack.add(id);
    expect(pack.count(id)).toBe(2);
    const again = new Backpack('test.pack');
    expect(again.count(id)).toBe(2);
  });
});

describe('placed (unified placement model)', () => {
  it('migrates both legacy save arrays into one placed list', () => {
    const merged = migratePlaced(
      [{ id: 'cairn', x: 1, z: 2 }],
      [{ kind: 'lantern', x: 3, z: 4 }],
      [{ id: 'stool:twig:M:plain', x: 5, z: 6 }],
    );
    expect(merged).toEqual([
      { id: 'cairn', x: 1, z: 2 },
      { id: 'lantern', x: 3, z: 4 },
      { id: 'stool:twig:M:plain', x: 5, z: 6 },
    ]);
  });

  it('is a no-op merge when the old arrays are empty (idempotent re-run)', () => {
    const placed = [{ id: 'fence', x: 0, z: 0 }];
    expect(migratePlaced(placed, [], [])).toEqual(placed);
  });

  it('gives every legacy crafted id its recipe verb', () => {
    for (const r of RECIPES) expect(verbFor(r.id)).toBe(r.use);
  });

  it('gives Workshop ids the place verb and resources none', () => {
    expect(verbFor('stool:twig:M:plain')).toBe('place');
    expect(verbFor('twig')).toBeNull();
    expect(verbFor('not-an-item:?:?:?')).toBeNull();
  });
});
