import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Backpack } from './Backpack';
import { RECIPES, canCraft, craft, recipe } from './Crafting';

describe('Backpack + Crafting', () => {
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
    expect(pack.count('twig')).toBe(2);
    expect(pack.take('twig')).toBe(true);
    expect(pack.count('twig')).toBe(1);
    expect(pack.take('pebble')).toBe(false);
    expect(pack.held()).toEqual(['twig']);
  });

  it('persists across instances', () => {
    const a = new Backpack('test.pack');
    a.add('flower', 3);
    const b = new Backpack('test.pack');
    expect(b.count('flower')).toBe(3);
  });

  it('crafts only when ingredients suffice, consuming them', () => {
    const pack = new Backpack('test.pack');
    const stick = recipe('stick');
    expect(canCraft(stick, pack)).toBe(false);
    expect(craft(stick, pack)).toBe(false);
    pack.add('twig', 2);
    expect(craft(stick, pack)).toBe(true);
    expect(pack.count('stick')).toBe(1);
    expect(pack.count('twig')).toBe(0);
  });

  it('every recipe is craftable from gatherable resources', () => {
    const pack = new Backpack('test.pack');
    for (const r of RECIPES) {
      for (const [res, n] of Object.entries(r.needs)) pack.add(res as never, n);
      expect(craft(r, pack), r.id).toBe(true);
      expect(pack.count(r.id)).toBeGreaterThan(0);
    }
  });
});
