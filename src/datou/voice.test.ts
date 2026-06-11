import { describe, expect, it } from 'vitest';
import { VOICE_POOL, Voice, type VoiceContext } from './voice';

function makeVoice(seq: number[] = [0.0]): Voice {
  let i = 0;
  return new Voice(() => seq[i++ % seq.length]);
}

describe('Voice — line picking', () => {
  it('returns keys in the voice.<context>.<n> format within the pool', () => {
    const v = makeVoice([0.99]);
    const key = v.request('discover', 1);
    expect(key).toBe(`voice.discover.${VOICE_POOL.discover}`);
  });

  it('never repeats the same line back to back from one pool', () => {
    const v = makeVoice([0.0]); // would always pick index 1
    const first = v.request('greet', 1);
    v.update(100);
    const second = v.request('greet', 1);
    expect(first).toBe('voice.greet.1');
    expect(second).toBe('voice.greet.2');
  });
});

describe('Voice — rate limiting (one quiet chip at a time)', () => {
  it('beat lines need a short breath between them', () => {
    const v = makeVoice();
    expect(v.request('discover', 1)).not.toBeNull();
    v.update(3);
    expect(v.request('craft', 1)).toBeNull(); // too soon
    v.update(4);
    expect(v.request('craft', 1)).not.toBeNull();
  });

  it('ambient chatter respects a long floor that shrinks with familiarity', () => {
    const stranger = makeVoice();
    stranger.update(999);
    expect(stranger.request('wonder', 0.35)).not.toBeNull();
    stranger.update(30); // stranger floor ≈ 37.5 s — still quiet
    expect(stranger.request('wonder', 0.35)).toBeNull();

    const bestie = makeVoice();
    bestie.update(999);
    expect(bestie.request('wonder', 1)).not.toBeNull();
    bestie.update(30); // bestFriend floor = 18 s — talkative again
    expect(bestie.request('wonder', 1)).not.toBeNull();
  });

  it('a dropped beat is silence, not a queue', () => {
    const v = makeVoice();
    v.request('discover', 1);
    expect(v.request('pet', 1)).toBeNull();
    expect(v.request('pet', 1)).toBeNull(); // still nothing banked
  });
});

describe('Voice — pools', () => {
  it('every context has at least 3 authored lines', () => {
    for (const n of Object.values(VOICE_POOL)) expect(n).toBeGreaterThanOrEqual(3);
  });

  it('cycles through a pool without throwing for any rand value', () => {
    const contexts = Object.keys(VOICE_POOL) as VoiceContext[];
    for (const r of [0, 0.4999, 0.5, 0.999999]) {
      const v = makeVoice([r]);
      for (const c of contexts) {
        v.update(100);
        const key = v.request(c, 1)!;
        const idx = Number(key.split('.')[2]);
        expect(idx).toBeGreaterThanOrEqual(1);
        expect(idx).toBeLessThanOrEqual(VOICE_POOL[c]);
      }
    }
  });
});
