import { describe, expect, it } from 'vitest';
import { Behaviors, type BehaviorDeps } from './behaviors';
import type { FamiliarityStage } from './character';

interface Log {
  clips: string[];
  reaches: number;
  investigates: { x: number; z: number }[];
  says: string[];
}

function make(
  over: Partial<BehaviorDeps> & { stage?: () => FamiliarityStage } = {},
  rand: () => number = () => 0.5,
): { b: Behaviors; log: Log } {
  const log: Log = { clips: [], reaches: 0, investigates: [], says: [] };
  const deps: BehaviorDeps = {
    rand,
    stage: () => 'friend',
    resting: () => true,
    playerIdleSeconds: () => 0,
    nearbyProp: () => null,
    placedKeepsake: () => null,
    investigate: (x, z) => void log.investigates.push({ x, z }),
    playClip: (c) => {
      log.clips.push(c);
      return true;
    },
    reach: () => void log.reaches++,
    say: (c) => void log.says.push(c),
    ...over,
  };
  return { b: new Behaviors(deps), log };
}

function run(b: Behaviors, seconds: number, dt = 0.5): void {
  for (let t = 0; t < seconds; t += dt) b.update(dt);
}

describe('Behaviors — arbitration', () => {
  it('does nothing at all while higher-priority systems run', () => {
    const { b, log } = make({ resting: () => false });
    run(b, 600);
    expect(log.clips).toHaveLength(0);
    expect(log.says).toHaveLength(0);
    expect(log.investigates).toHaveLength(0);
    expect(log.reaches).toBe(0);
  });

  it('the body keeps living: biological idles fire spaced ≥25 s', () => {
    const { b, log } = make({ stage: () => 'stranger' });
    run(b, 120);
    const acts = log.clips.length + log.reaches;
    expect(acts).toBeGreaterThanOrEqual(2);
    expect(acts).toBeLessThanOrEqual(4); // never a fidgety robot
  });

  it('only stretch/stomp/sniff at stranger tier — initiative is earned', () => {
    const { b, log } = make({ stage: () => 'stranger' });
    run(b, 1200);
    expect(log.says).toHaveLength(0);
    expect(log.investigates).toHaveLength(0);
    for (const c of log.clips) expect(['stretch', 'stomp']).toContain(c);
  });
});

describe('Behaviors — proactive acts (friend+)', () => {
  it('asks after you when there is nothing to show', () => {
    const { b, log } = make();
    run(b, 400);
    expect(log.says).toContain('ask');
  });

  it('show-and-tell: leads to a nearby prop and lectures', () => {
    const { b, log } = make({ nearbyProp: () => ({ x: 3, z: 4 }) });
    run(b, 400);
    expect(log.says).toContain('showTell');
    expect(log.investigates).toContainEqual({ x: 3, z: 4 });
  });

  it('plays with a placed keepsake when you are clearly settled', () => {
    const { b, log } = make({
      playerIdleSeconds: () => 60,
      placedKeepsake: () => ({ x: -2, z: 5 }),
      nearbyProp: () => ({ x: 9, z: 9 }),
    });
    run(b, 400);
    expect(log.investigates).toContainEqual({ x: -2, z: 5 });
  });

  it('a closer friend takes initiative more often', () => {
    const stranger = make({ stage: () => 'friend' });
    const bestie = make({ stage: () => 'bestFriend' });
    run(stranger.b, 900);
    run(bestie.b, 900);
    expect(bestie.log.says.length).toBeGreaterThan(stranger.log.says.length);
  });
});

describe('Behaviors — yielding to the player', () => {
  it('input pushes the initiative back', () => {
    const { b, log } = make();
    run(b, 80); // proactive due at ~0.6 × (90/0.6) ≈ 81 s… almost
    b.noteInput();
    run(b, 7); // inside the yield window
    expect(log.says).toHaveLength(0);
    run(b, 5);
    expect(log.says.length).toBeGreaterThan(0);
  });
});
