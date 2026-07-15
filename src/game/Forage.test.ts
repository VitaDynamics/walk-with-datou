import { describe, expect, it, vi } from 'vitest';
import { Forage, BUCKET_CAPACITY, type ForageActions, type ForageTarget } from './Forage';
import type { DatouState } from '../physics/PhysicsAdapter';

function stateAt(x: number, z: number): DatouState {
  return {
    position: { x, y: 0, z },
    velocity: { x: 0, y: 0, z: 0 },
    heading: 0,
    mood: 'calm',
  } as DatouState;
}

/** A world of fixed twig pickables; findNearest returns the closest unpicked. */
function makeWorld(points: ForageTarget[]) {
  const live = new Map(points.map((p) => [p.id, p]));
  const actions: ForageActions & {
    delivered: string[][];
    picks: string[];
  } = {
    delivered: [],
    picks: [],
    setMode: vi.fn(),
    setTarget: vi.fn(),
    findNearest: (kind, x, z, radius) => {
      let best: ForageTarget | null = null;
      let bestD = radius;
      for (const p of live.values()) {
        if (p.kind !== kind) continue;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d <= bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    },
    pick: (id) => live.delete(id),
    onPick: (kind) => actions.picks.push(kind),
    onDeliver: (items) => actions.delivered.push(items),
  };
  return actions;
}

describe('Forage state machine (§7)', () => {
  it('seeks, picks into the bucket, and delivers to the player', () => {
    const world = makeWorld([
      { id: 'a', kind: 'twig', x: 5, z: 0 },
      { id: 'b', kind: 'twig', x: 5, z: 1 },
    ]);
    const f = new Forage(world);
    f.pin('twig');
    // Datou is always reported at its current setTarget (so it "arrives").
    let lastTarget = { x: 0, z: 0 };
    const origSet = world.setTarget;
    world.setTarget = vi.fn((x: number, z: number) => {
      lastTarget = { x, z };
      origSet(x, z);
    }) as never;

    for (let i = 0; i < 200 && f.active; i++) {
      // When returning (mode follow, no setTarget), home onto player at origin.
      const at = f['phase'] === 'returning' ? { x: 0, z: 0 } : lastTarget;
      f.update(0.3, stateAt(at.x, at.z), { x: 0, z: 0 });
    }
    expect(world.picks.length).toBe(2);
    expect(world.delivered.flat()).toEqual(['twig', 'twig']);
  });

  it('stops at bucket capacity', () => {
    const pts: ForageTarget[] = [];
    for (let i = 0; i < BUCKET_CAPACITY + 3; i++) pts.push({ id: `t${i}`, kind: 'twig', x: 4 + i * 0.1, z: 0 });
    const world = makeWorld(pts);
    const f = new Forage(world);
    f.setCapacity(BUCKET_CAPACITY);
    f.pin('twig');
    let lastTarget = { x: 0, z: 0 };
    const origSet = world.setTarget;
    world.setTarget = vi.fn((x: number, z: number) => {
      lastTarget = { x, z };
      origSet(x, z);
    }) as never;
    // Run until the first delivery.
    for (let i = 0; i < 300 && world.delivered.length === 0; i++) {
      const at = f['phase'] === 'returning' ? { x: 0, z: 0 } : lastTarget;
      f.update(0.3, stateAt(at.x, at.z), { x: 0, z: 0 });
    }
    expect(world.delivered[0].length).toBe(BUCKET_CAPACITY);
  });

  it('brings nothing-needed to a clean stop when no pickables exist', () => {
    const world = makeWorld([]);
    const f = new Forage(world);
    f.pin('twig');
    f.update(0.3, stateAt(0, 0), { x: 0, z: 0 });
    expect(f.active).toBe(false);
    expect(world.delivered.length).toBe(0);
  });

  it('stop() delivers the partial bucket and stands down', () => {
    const world = makeWorld([{ id: 'a', kind: 'pebble', x: 3, z: 0 }]);
    const f = new Forage(world);
    f.pin('pebble');
    let lastTarget = { x: 0, z: 0 };
    const origSet = world.setTarget;
    world.setTarget = vi.fn((x: number, z: number) => {
      lastTarget = { x, z };
      origSet(x, z);
    }) as never;
    // Get one into the bucket.
    for (let i = 0; i < 20 && f.fill === 0; i++) f.update(0.3, stateAt(lastTarget.x, lastTarget.z), { x: 0, z: 0 });
    expect(f.fill).toBeGreaterThan(0);
    f.stop();
    expect(world.delivered.flat()).toContain('pebble');
    expect(f.active).toBe(false);
  });
});
