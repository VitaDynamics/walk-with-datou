import { describe, expect, it } from 'vitest';
import { MovableProps, type Mover } from './MovableProps';
import type { Collider } from './World';

const NO_COLLIDERS: Collider[] = [];

function spawnBall(mp: MovableProps, x = 0, z = 0) {
  return mp.spawn({ kindId: 'ball', x, z, yaw: 0, scale: 1, radius: 0.2, mass: 0.5 });
}

describe('MovableProps: push & integrate', () => {
  it('a mover pushing into a prop imparts velocity away from the mover', () => {
    const mp = new MovableProps();
    const id = spawnBall(mp, 0.3, 0);
    const mover: Mover = { x: 0, z: 0, radius: 0.4 };
    mp.step(1 / 60, [mover], NO_COLLIDERS);
    const p = mp.get(id)!;
    expect(p.x).toBeGreaterThan(0.3); // pushed in +x (away from mover at origin)
    expect(p.state).toBe('sliding');
    expect(Math.abs(p.vx)).toBeGreaterThan(0);
  });

  it('a pushed prop coasts and settles to rest', () => {
    const mp = new MovableProps();
    const id = spawnBall(mp, 0, 0);
    mp.push(id, 1, 0, 4);
    let moved = 0;
    for (let i = 0; i < 300; i++) {
      const before = mp.get(id)!.x;
      mp.step(1 / 60, [], NO_COLLIDERS);
      moved += mp.get(id)!.x - before;
    }
    const p = mp.get(id)!;
    expect(moved).toBeGreaterThan(0.3); // it travelled
    expect(p.state).toBe('rest'); // and stopped
    expect(p.vx).toBe(0);
  });
});

describe('MovableProps: bounds & colliders', () => {
  it('never leaves the park', () => {
    const mp = new MovableProps();
    const id = spawnBall(mp, 240, 0);
    mp.push(id, 1, 0, 50); // hurl it at the east edge
    for (let i = 0; i < 600; i++) mp.step(1 / 60, [], NO_COLLIDERS);
    const p = mp.get(id)!;
    expect(p.x).toBeLessThanOrEqual(250);
  });

  it('does not tunnel through a static collider', () => {
    const mp = new MovableProps();
    const id = spawnBall(mp, -2, 0);
    const wall: Collider[] = [{ x: 0, z: 0, radius: 1 }];
    mp.push(id, 1, 0, 20); // drive it straight at the wall
    for (let i = 0; i < 300; i++) mp.step(1 / 60, [], wall);
    const p = mp.get(id)!;
    // It must end outside the wall: distance ≥ wall.radius + prop.radius.
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(1 + 0.2 - 1e-3);
  });
});

describe('MovableProps: throw arc', () => {
  it('the cosmetic arc never perturbs the XZ path and lands flat', () => {
    const mp = new MovableProps();
    const id = spawnBall(mp, 0, 0);
    mp.throw(id, 1, 0, 6, 4);
    const xs: number[] = [];
    for (let i = 0; i < 200; i++) {
      mp.step(1 / 60, [], NO_COLLIDERS);
      xs.push(mp.get(id)!.x);
    }
    const p = mp.get(id)!;
    expect(p.renderY).toBe(0); // landed
    expect(p.arcUp).toBeUndefined();
    // XZ motion is monotonic non-decreasing in x (no arc-induced jitter).
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-9);
  });
});

describe('MovableProps: carry / drop', () => {
  it('a carried prop tracks its carrier and drops at a position', () => {
    const mp = new MovableProps();
    const id = spawnBall(mp, 5, 5);
    mp.carry(id, 'player');
    mp.step(1 / 60, [], NO_COLLIDERS, { player: { x: 10, z: 20 } });
    let p = mp.get(id)!;
    expect(p.state).toBe('carried');
    expect(p.x).toBe(10);
    expect(p.z).toBe(20);
    mp.drop(id, 11, 21);
    p = mp.get(id)!;
    expect(p.state).toBe('rest');
    expect(p.x).toBe(11);
    expect(p.carriedBy).toBeUndefined();
  });
});

describe('MovableProps: topple / break auto-revert', () => {
  it('a toppled prop auto-rights after its cooldown', () => {
    const mp = new MovableProps();
    const id = spawnBall(mp);
    mp.topple(id);
    expect(mp.get(id)!.state).toBe('toppled');
    for (let i = 0; i < 60 * 5; i++) mp.step(1 / 60, [], NO_COLLIDERS); // 5 s
    expect(mp.get(id)!.state).toBe('rest');
  });

  it('a broken prop auto-regrows after its cooldown', () => {
    const mp = new MovableProps();
    const id = spawnBall(mp);
    mp.break(id);
    expect(mp.get(id)!.state).toBe('broken');
    for (let i = 0; i < 60 * 7; i++) mp.step(1 / 60, [], NO_COLLIDERS); // 7 s
    expect(mp.get(id)!.state).toBe('rest');
  });
});

describe('MovableProps: determinism', () => {
  it('same inputs ⇒ same trajectory', () => {
    const run = () => {
      const mp = new MovableProps();
      const id = spawnBall(mp, 1, 1);
      mp.push(id, 0.7, 0.3, 5);
      const path: number[] = [];
      for (let i = 0; i < 120; i++) {
        mp.step(1 / 60, [], NO_COLLIDERS);
        const p = mp.get(id)!;
        path.push(p.x, p.z);
      }
      return path;
    };
    expect(run()).toEqual(run());
  });
});
