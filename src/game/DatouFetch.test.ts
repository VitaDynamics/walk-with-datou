import { describe, expect, it, beforeAll } from 'vitest';
import { DatouFetch } from './DatouFetch';
import { MovableProps } from './MovableProps';
import { Inventory } from './Inventory';
import { catalog } from './World';
import { entryToKind, type ManifestEntry } from './catalog/manifest';
import type { DatouState } from '../physics/PhysicsAdapter';

const datou = (x: number, z: number): DatouState => ({
  position: { x, y: 0, z },
  yaw: 0,
  velocity: { x: 0, y: 0, z: 0 },
  mood: 'curious',
});

const FETCHABLE: ManifestEntry = {
  id: 'fetch-ball',
  name: 'Fetch Ball',
  category: 'toy',
  modelPath: 'models/toy/fetch-ball.glb',
  license: 'CC0',
  footprintRadius: 0.2,
  blocking: false,
  interactable: true,
  verbs: ['carry', 'throw'],
  zones: [],
  spawnWeight: 0,
  scaleRange: [1, 1],
};
const NON_CARRY: ManifestEntry = { ...FETCHABLE, id: 'fetch-rock', name: 'Rock', verbs: ['push'] };

beforeAll(() => {
  catalog.addAll([entryToKind(FETCHABLE), entryToKind(NON_CARRY)]);
});

function setup() {
  const movables = new MovableProps();
  const inventory = new Inventory();
  const calls: { mode?: string; target?: [number, number] } = {};
  const actions = {
    setMode: (m: string) => (calls.mode = m),
    setTarget: (x: number, z: number) => (calls.target = [x, z]),
  };
  const fetch = new DatouFetch(actions as never, movables, inventory);
  return { movables, inventory, fetch, calls };
}

describe('DatouFetch: request gating', () => {
  it('accepts a carryable interactable prop and steers Datou to it', () => {
    const { movables, fetch, calls } = setup();
    const id = movables.spawn({ kindId: 'fetch-ball', x: 10, z: 5, yaw: 0, scale: 1, radius: 0.2 });
    expect(fetch.request(id)).toBe(true);
    expect(fetch.isBusy).toBe(true);
    expect(calls.mode).toBe('explore');
    expect(calls.target).toEqual([10, 5]);
  });

  it('rejects a non-carryable prop', () => {
    const { movables, fetch } = setup();
    const id = movables.spawn({ kindId: 'fetch-rock', x: 10, z: 5, yaw: 0, scale: 1, radius: 0.5 });
    expect(fetch.request(id)).toBe(false);
    expect(fetch.isBusy).toBe(false);
  });

  it('rejects a second request while busy', () => {
    const { movables, fetch } = setup();
    const a = movables.spawn({ kindId: 'fetch-ball', x: 10, z: 5, yaw: 0, scale: 1, radius: 0.2 });
    const b = movables.spawn({ kindId: 'fetch-ball', x: 20, z: 5, yaw: 0, scale: 1, radius: 0.2 });
    expect(fetch.request(a)).toBe(true);
    expect(fetch.request(b)).toBe(false);
  });
});

describe('DatouFetch: full loop', () => {
  it('Datou reaches the prop, carries it, returns, and deposits to the backpack', () => {
    const { movables, inventory, fetch } = setup();
    const id = movables.spawn({ kindId: 'fetch-ball', x: 10, z: 0, yaw: 0, scale: 1, radius: 0.2 });
    fetch.request(id);

    // Datou far from the prop → still going, not carried.
    fetch.update(datou(0, 0), { x: 0, z: 0 });
    expect(movables.get(id)?.state).not.toBe('carried');
    expect(fetch.carriedPropId).toBeNull();

    // Datou arrives at the prop → it gets carried, phase flips to returning.
    fetch.update(datou(10, 0), { x: 0, z: 0 });
    expect(movables.get(id)?.state).toBe('carried');
    expect(movables.get(id)?.carriedBy).toBe('datou');
    expect(fetch.carriedPropId).toBe(id);

    // Datou is still away from the player → not delivered yet.
    fetch.update(datou(5, 0), { x: 0, z: 0 });
    expect(inventory.backpackCount).toBe(0);

    // Datou reaches the player → item drops into the backpack, prop removed.
    fetch.update(datou(0.5, 0), { x: 0, z: 0 });
    expect(inventory.backpackCount).toBe(1);
    expect(inventory.backpack()[0].kindId).toBe('fetch-ball');
    expect(movables.get(id)).toBeUndefined(); // removed from the world
    expect(fetch.isBusy).toBe(false);
  });

  it('aborts cleanly if the prop vanishes mid-fetch', () => {
    const { movables, inventory, fetch } = setup();
    const id = movables.spawn({ kindId: 'fetch-ball', x: 10, z: 0, yaw: 0, scale: 1, radius: 0.2 });
    fetch.request(id);
    movables.remove(id); // prop gone
    fetch.update(datou(5, 0), { x: 0, z: 0 });
    expect(fetch.isBusy).toBe(false);
    expect(inventory.backpackCount).toBe(0);
  });
});
