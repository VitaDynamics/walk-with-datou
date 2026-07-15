import { describe, expect, it } from 'vitest';
import { EmotionEngine, type EmotionEvent } from './emotion';

/** Step the engine in small frames (decay is exponential, dt-stable). */
function step(e: EmotionEngine, seconds: number, dt = 0.1): void {
  for (let t = 0; t < seconds; t += dt) e.update(dt);
}

describe('EmotionEngine — transitions', () => {
  it('starts neutral', () => {
    const e = new EmotionEngine();
    expect(e.state.kind).toBe('neutral');
    expect(e.state.intensity).toBe(0);
  });

  it('a pet brings joy; discovery brings excitement; craft brings pride', () => {
    const joy = new EmotionEngine();
    joy.apply('pet');
    expect(joy.state.kind).toBe('joy');

    const exc = new EmotionEngine();
    exc.apply('discover');
    expect(exc.state.kind).toBe('excited');

    const proud = new EmotionEngine();
    proud.apply('craft');
    expect(proud.state.kind).toBe('proud');
  });

  it('startle is an interrupt that wins while alive, then resolves toward curiosity', () => {
    const e = new EmotionEngine();
    e.apply('discover'); // excited at 1.0
    e.apply('startle');
    expect(e.state.kind).toBe('startled');
    step(e, 9); // startled half-life is 2 s — long gone
    expect(e.state.kind).toBe('excited');
  });
});

describe('EmotionEngine — 三分钟热度 (interest half-life)', () => {
  it('excitement is still the face after 2 minutes but fades by ~6', () => {
    const e = new EmotionEngine();
    e.apply('discover');
    step(e, 120, 0.5);
    expect(e.state.kind).toBe('excited');
    step(e, 240, 0.5);
    expect(e.state.kind).toBe('neutral');
  });

  it('joy is brief by comparison', () => {
    const e = new EmotionEngine();
    e.apply('pet');
    step(e, 40, 0.5);
    expect(e.state.kind).toBe('neutral');
  });
});

describe('EmotionEngine — 不记仇 (the no-grudge invariants)', () => {
  it('no negative emotion outlives 60 s after its trigger', () => {
    const negativeSetups: EmotionEvent[][] = [
      ['ignoredWant', 'ignoredWant', 'ignoredWant'], // wronged
      ['rainStart', 'rainEnd'], // afraid, released
      ['startle'],
    ];
    for (const events of negativeSetups) {
      const e = new EmotionEngine();
      for (const ev of events) e.apply(ev);
      step(e, 60, 0.5);
      expect(['neutral', 'excited']).toContain(e.state.kind); // startle leaves curiosity
      expect(['wronged', 'miffed', 'afraid', 'startled']).not.toContain(e.state.kind);
    }
  });

  it('kindness clears a grudge instantly', () => {
    const e = new EmotionEngine();
    e.apply('ignoredWant');
    e.apply('ignoredWant');
    e.apply('ignoredWant');
    expect(e.state.kind).toBe('wronged');
    e.apply('pet');
    expect(e.state.kind).not.toBe('wronged');
  });

  it('two ignored wants are forgiven; only the third wounds', () => {
    const e = new EmotionEngine();
    e.apply('ignoredWant');
    e.apply('ignoredWant');
    expect(e.state.kind).toBe('neutral');
    e.apply('ignoredWant');
    expect(e.state.kind).toBe('wronged');
  });

  it('spaced-out ignores never accumulate into a wound', () => {
    const e = new EmotionEngine();
    for (let i = 0; i < 5; i++) {
      e.apply('ignoredWant');
      step(e, 100, 1); // outside the 90 s window
    }
    expect(e.state.kind).toBe('neutral');
  });
});

describe('EmotionEngine — rain (his one fear)', () => {
  it('fear is sustained while it rains and releases after', () => {
    const e = new EmotionEngine();
    e.apply('rainStart');
    step(e, 120, 0.5); // a long shower
    expect(e.state.kind).toBe('afraid');
    e.apply('rainEnd');
    step(e, 40, 0.5);
    expect(e.state.kind).toBe('neutral');
  });
});

describe('EmotionEngine — over-praise tips into shyness', () => {
  it('a fourth praise within the window turns joy shy', () => {
    const e = new EmotionEngine();
    e.apply('pet');
    e.apply('pet');
    e.apply('pet');
    expect(e.state.kind).toBe('joy');
    e.apply('pet');
    expect(e.state.kind).toBe('shy');
  });

  it('spaced praise stays pure joy', () => {
    const e = new EmotionEngine();
    for (let i = 0; i < 6; i++) {
      e.apply('pet');
      step(e, 35, 1);
    }
    e.apply('pet');
    expect(e.state.kind).toBe('joy');
  });
});

describe('EmotionEngine — motion grammar (兴奋类 vs 伤心类)', () => {
  it('joy/excited/proud are body-dominant, wronged/shy/afraid expression-dominant', () => {
    const a = new EmotionEngine();
    a.apply('discover');
    expect(a.grammar).toBe('excited');

    const b = new EmotionEngine();
    b.apply('ignoredWant');
    b.apply('ignoredWant');
    b.apply('ignoredWant');
    expect(b.grammar).toBe('sad');

    const c = new EmotionEngine();
    expect(c.grammar).toBeNull();
  });
});
