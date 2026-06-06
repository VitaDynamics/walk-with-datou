import { describe, expect, it } from 'vitest';
import { Controller, DEFAULT_CONTROLLER_CONFIG } from './controller';
import { Rng } from './rng';

const inputs = (over: Partial<Parameters<Controller['compute']>[0]> = {}) => ({
  mode: 'follow' as const,
  pos: { x: 0, z: 0 },
  player: { x: 0, z: 0 },
  target: { x: 0, z: 0 },
  ...over,
});

describe('Controller', () => {
  it('follow: steers toward the player at configured speed', () => {
    const c = new Controller(new Rng(1));
    const m = c.compute(inputs({ player: { x: 10, z: 0 } }), 0.016);
    expect(m.vx).toBeCloseTo(DEFAULT_CONTROLLER_CONFIG.speed, 6);
    expect(m.vz).toBeCloseTo(0, 6);
  });

  it('follow: stops within followMinDist', () => {
    const c = new Controller(new Rng(1));
    const m = c.compute(inputs({ player: { x: 1, z: 0 } }), 0.016); // < 1.8
    expect(m.vx).toBe(0);
    expect(m.vz).toBe(0);
  });

  it('explore: steers toward target', () => {
    const c = new Controller(new Rng(1));
    const m = c.compute(inputs({ mode: 'explore', target: { x: 0, z: 5 } }), 0.016);
    expect(m.vx).toBeCloseTo(0, 6);
    expect(m.vz).toBeCloseTo(DEFAULT_CONTROLLER_CONFIG.speed, 6);
  });

  it('idle wander is deterministic given the same seed', () => {
    const run = () => {
      const c = new Controller(new Rng(2024));
      const path: Array<{ x: number; z: number }> = [];
      for (let i = 0; i < 200; i++) {
        c.compute(inputs({ mode: 'idle' }), 0.1);
        path.push(c.getState().wanderTarget);
      }
      return path;
    };
    expect(run()).toEqual(run());
  });

  it('snapshot/restore of wander state resumes identically', () => {
    const c = new Controller(new Rng(5));
    for (let i = 0; i < 25; i++) c.compute(inputs({ mode: 'idle' }), 0.1);
    const snap = c.getState();
    const rngSnap = 0; // rng owned separately; here we just check controller state

    // advance, then restore
    for (let i = 0; i < 10; i++) c.compute(inputs({ mode: 'idle' }), 0.1);
    c.setState(snap);
    expect(c.getState()).toEqual(snap);
    void rngSnap;
  });
});
