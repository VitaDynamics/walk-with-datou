import { describe, expect, it } from 'vitest';
import { VOICE_POOL, Voice, type VoiceContext } from './voice';
import { STARTER_VOICE_CONTEXTS } from '../game/starterInteractions';
import { PARK_VOICE_CONTEXTS } from '../game/parkInteractions';

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

/**
 * The field-lab item captions are one canonical line each (the design handoff
 * gives each co-invention a single signature line, e.g. 灵感灯泡 → "比 100 个还亮").
 * They're authored payloads tied to a specific item, not chatter pools that need
 * variety — so they're exempt from the ≥3 rule, and pinned to exactly 1.
 */
const LAB_CONTEXTS: readonly VoiceContext[] = [
  'labBulb',
  'labTime',
  'labShelter',
  'labLantern',
  'labToolroll',
  'labWobble',
  'labAntenna',
  'labNote',
  'labBell',
  'labPoof',
];

/**
 * The authored starter keepsakes carry the same kind of single signature line
 * as the lab items (one caption tied to a specific item, not a chatter pool),
 * so they're exempt from the ≥3 rule and pinned to exactly 1.
 */
const SINGLE_LINE_CONTEXTS: readonly VoiceContext[] = [
  ...LAB_CONTEXTS,
  ...STARTER_VOICE_CONTEXTS,
  ...PARK_VOICE_CONTEXTS,
];

describe('Voice — pools', () => {
  it('every chatter context has at least 3 authored lines', () => {
    for (const [ctx, n] of Object.entries(VOICE_POOL)) {
      if (SINGLE_LINE_CONTEXTS.includes(ctx as VoiceContext)) continue;
      expect(n, ctx).toBeGreaterThanOrEqual(3);
    }
  });

  it('every lab-item and starter-item caption is exactly one canonical line', () => {
    for (const ctx of SINGLE_LINE_CONTEXTS) expect(VOICE_POOL[ctx], ctx).toBe(1);
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
