import { describe, expect, it } from 'vitest';
import { InputRecorder } from './replay';

describe('InputRecorder', () => {
  it('records discrete events verbatim', () => {
    const r = new InputRecorder();
    r.record({ t: 0, kind: 'setMode', mode: 'follow' });
    r.record({ t: 1.5, kind: 'applyPet' });
    expect(r.getEvents()).toEqual([
      { t: 0, kind: 'setMode', mode: 'follow' },
      { t: 1.5, kind: 'applyPet' },
    ]);
  });

  it('downsamples setPlayerPosition to the configured cadence', () => {
    const r = new InputRecorder(10); // 10 Hz => one sample per 0.1 s
    // Feed 0.02 s apart; only every ~5th should be kept.
    for (let i = 0; i <= 50; i++) {
      r.record({ t: i * 0.02, kind: 'setPlayerPosition', x: i, z: 0 });
    }
    const playerEvents = r.getEvents().filter((e) => e.kind === 'setPlayerPosition');
    // 51 inputs over 1.0 s fed at 50 Hz, downsampled to ~10 Hz => roughly a
    // 5x reduction (~9-12 samples; exact count varies with FP boundary timing).
    expect(playerEvents.length).toBeGreaterThanOrEqual(9);
    expect(playerEvents.length).toBeLessThanOrEqual(12);
    // The point of downsampling: far fewer than the 51 raw inputs.
    expect(playerEvents.length).toBeLessThan(20);
  });

  it('does not downsample discrete events interleaved with player samples', () => {
    const r = new InputRecorder(10);
    r.record({ t: 0, kind: 'setPlayerPosition', x: 0, z: 0 });
    r.record({ t: 0.01, kind: 'applyPet' });
    r.record({ t: 0.02, kind: 'setMode', mode: 'idle' });
    expect(r.getEvents().filter((e) => e.kind !== 'setPlayerPosition')).toHaveLength(2);
  });

  it('clear() resets the log and the sampling clock', () => {
    const r = new InputRecorder(10);
    r.record({ t: 0, kind: 'setPlayerPosition', x: 0, z: 0 });
    r.clear();
    r.record({ t: 0, kind: 'setPlayerPosition', x: 9, z: 9 });
    expect(r.getEvents()).toHaveLength(1);
  });
});
