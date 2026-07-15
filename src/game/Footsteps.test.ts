import { describe, it, expect } from 'vitest';
import { Footsteps } from './Footsteps';

// cueFootstep no-ops without an AudioContext (jsdom has none), so we assert on
// the footfall count Footsteps.update returns.

function walkFor(fs: Footsteps, seconds: number, speed: number, dt = 1 / 60): number {
  let steps = 0;
  for (let t = 0; t < seconds; t += dt) steps += fs.update(dt, 0, 0, speed);
  return steps;
}

describe('Footsteps', () => {
  it('fires no steps while standing still', () => {
    const fs = new Footsteps({ gain: 1, pitch: 1 });
    expect(walkFor(fs, 2, 0)).toBe(0);
  });

  it('fires steps while walking', () => {
    const fs = new Footsteps({ gain: 1, pitch: 1 });
    expect(walkFor(fs, 2, 3.1)).toBeGreaterThan(0);
  });

  it('runs at a faster cadence than a walk over the same time', () => {
    const walk = walkFor(new Footsteps({ gain: 1, pitch: 1 }), 4, 3.1);
    const run = walkFor(new Footsteps({ gain: 1, pitch: 1 }), 4, 5.4);
    expect(run).toBeGreaterThan(walk);
  });

  it('caps footfalls per tick so a long-dt hitch cannot burst', () => {
    const fs = new Footsteps({ gain: 1, pitch: 1 });
    // A 1-second frame at full run would be ~8 strides; the cap holds it to 3.
    expect(fs.update(1, 0, 0, 5.4)).toBeLessThanOrEqual(3);
  });

  it('does not fire on the very first moving frame from rest', () => {
    const fs = new Footsteps({ gain: 1, pitch: 1 });
    expect(fs.update(1 / 60, 0, 0, 3.1)).toBe(0);
  });
});
