import { describe, expect, it } from 'vitest';
import { Bond } from './Bond';

describe('Bond', () => {
  it('starts at zero with no unlocks', () => {
    const b = new Bond();
    expect(b.level).toBe(0);
    expect(b.has('glance-back')).toBe(false);
    expect(b.takeUnlocks()).toEqual([]);
  });

  it('grants bond per interaction reason', () => {
    const b = new Bond();
    b.add('pet');
    expect(b.level).toBe(1);
    b.add('discovery');
    expect(b.level).toBe(5);
  });

  it('fires unlocks once as thresholds are crossed', () => {
    const b = new Bond();
    for (let i = 0; i < 15; i++) b.add('pet'); // reach 15
    expect(b.has('glance-back')).toBe(true);
    expect(b.takeUnlocks()).toContain('glance-back');
    // Draining clears the pending list; a second drain is empty.
    expect(b.takeUnlocks()).toEqual([]);
  });

  it('does not re-fire an unlock already reached', () => {
    const b = new Bond(20); // starts past the glance-back threshold
    expect(b.has('glance-back')).toBe(true);
    // No pending cue on load — the unlock was seeded, not freshly crossed.
    expect(b.takeUnlocks()).toEqual([]);
  });

  it('applies session diminishing returns past the soft cap', () => {
    const b = new Bond();
    // Push past the 40 soft cap with discoveries (4 each).
    for (let i = 0; i < 10; i++) b.add('discovery'); // 40
    const before = b.level;
    const gained = b.add('discovery'); // should be halved → 2
    expect(gained).toBe(2);
    expect(b.level).toBe(before + 2);
  });

  it('accumulates the passive proximity trickle into whole points', () => {
    const b = new Bond();
    // PROXIMITY_RATE is 0.05/s → 1 point per 20 s. Feed 25 s.
    for (let i = 0; i < 25; i++) b.proximity(1);
    expect(b.level).toBe(1);
  });

  it('seeds reached unlocks from an initial saved value', () => {
    const b = new Bond(55);
    expect(b.has('glance-back')).toBe(true);
    expect(b.has('lie-at-feet')).toBe(true);
    expect(b.has('initiate-explore')).toBe(false);
  });
});
