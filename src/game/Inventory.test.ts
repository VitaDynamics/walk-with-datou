import { describe, expect, it, vi } from 'vitest';
import { Inventory } from './Inventory';

describe('Inventory: backpack & deposit', () => {
  it('stacks items by kind in the backpack', () => {
    const inv = new Inventory();
    inv.add('acorn');
    inv.add('acorn');
    inv.add('feather');
    expect(inv.backpackCount).toBe(3);
    const pack = inv.backpack();
    expect(pack.find((i) => i.kindId === 'acorn')?.count).toBe(2);
    expect(pack.find((i) => i.kindId === 'feather')?.count).toBe(1);
  });

  it('depositAll moves the backpack to the home post and clears it', () => {
    const inv = new Inventory();
    inv.add('acorn');
    inv.add('acorn');
    const moved = inv.depositAll();
    expect(moved).toBe(2);
    expect(inv.backpackCount).toBe(0);
    expect(inv.homeCount).toBe(2);
    expect(inv.home().find((i) => i.kindId === 'acorn')?.count).toBe(2);
  });

  it('accumulates across multiple deposits', () => {
    const inv = new Inventory();
    inv.add('shell');
    inv.depositAll();
    inv.add('shell');
    inv.depositAll();
    expect(inv.homeCount).toBe(2);
    expect(inv.home().find((i) => i.kindId === 'shell')?.count).toBe(2);
  });

  it('depositAll on an empty pack moves nothing and does not emit', () => {
    const inv = new Inventory();
    const fn = vi.fn();
    inv.onChange(fn);
    expect(inv.depositAll()).toBe(0);
    expect(fn).not.toHaveBeenCalled();
  });

  it('notifies listeners on add and deposit', () => {
    const inv = new Inventory();
    const fn = vi.fn();
    const off = inv.onChange(fn);
    inv.add('coin');
    expect(fn).toHaveBeenCalledTimes(1);
    inv.depositAll();
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    inv.add('coin');
    expect(fn).toHaveBeenCalledTimes(2); // unsubscribed
  });
});
