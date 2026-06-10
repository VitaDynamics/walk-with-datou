import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalityModel } from './personality';

describe('PersonalityModel (W7 gating)', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it('stays balanced below the minimum signal', () => {
    const p = new PersonalityModel('t.p1');
    p.note('explore', 3);
    expect(p.axis()).toBe('balanced');
  });

  it('derives the dominant axis once there is a clear lead', () => {
    const p = new PersonalityModel('t.p2');
    for (let i = 0; i < 15; i++) p.note('explore');
    p.note('play', 2);
    expect(p.axis()).toBe('explorer');
  });

  it('a near-tie stays balanced', () => {
    const p = new PersonalityModel('t.p3');
    p.note('play', 10);
    p.note('care', 9);
    expect(p.axis()).toBe('balanced');
  });

  it('maps each signal to its axis', () => {
    const cases = [
      ['explore', 'explorer'],
      ['play', 'playful'],
      ['care', 'guardian'],
      ['work', 'independent'],
    ] as const;
    for (const [sig, axis] of cases) {
      const p = new PersonalityModel(`t.${sig}`);
      for (let i = 0; i < 20; i++) p.note(sig);
      expect(p.axis()).toBe(axis);
    }
  });

  it('persists across instances', () => {
    const a = new PersonalityModel('t.persist');
    for (let i = 0; i < 20; i++) a.note('work');
    const b = new PersonalityModel('t.persist');
    expect(b.axis()).toBe('independent');
  });
});
