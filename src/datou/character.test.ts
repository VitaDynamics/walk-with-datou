import { describe, expect, it } from 'vitest';
import {
  TRAITS,
  amplitude,
  clipAllowed,
  familiarityStage,
  gazeUrgency,
  type FamiliarityStage,
} from './character';

const STAGES: FamiliarityStage[] = ['stranger', 'friend', 'closeFriend', 'bestFriend'];

describe('character — familiarity stages (R1)', () => {
  it('maps the existing bond thresholds exactly (no save migration)', () => {
    expect(familiarityStage(0)).toBe('stranger');
    expect(familiarityStage(14)).toBe('stranger');
    expect(familiarityStage(15)).toBe('friend');
    expect(familiarityStage(49)).toBe('friend');
    expect(familiarityStage(50)).toBe('closeFriend');
    expect(familiarityStage(89)).toBe('closeFriend');
    expect(familiarityStage(90)).toBe('bestFriend');
    expect(familiarityStage(500)).toBe('bestFriend');
  });

  it('amplitude and gaze urgency grow strictly with the relationship', () => {
    for (let i = 1; i < STAGES.length; i++) {
      expect(amplitude(STAGES[i])).toBeGreaterThan(amplitude(STAGES[i - 1]));
      expect(gazeUrgency(STAGES[i])).toBeGreaterThan(gazeUrgency(STAGES[i - 1]));
    }
    // Stranger-tier BOBO must stay deep inside the baseline envelope.
    expect(amplitude('stranger')).toBeLessThanOrEqual(0.4);
    expect(amplitude('bestFriend')).toBe(1);
  });
});

describe('character — clip permissions (big moves are earned)', () => {
  it('strangers only get functional/biological reads', () => {
    expect(clipAllowed('shiver', 'stranger')).toBe(true);
    expect(clipAllowed('stretch', 'stranger')).toBe(true);
    expect(clipAllowed('stomp', 'stranger')).toBe(true);
    expect(clipAllowed('spin', 'stranger')).toBe(false);
    expect(clipAllowed('backTurn', 'stranger')).toBe(false);
    expect(clipAllowed('shyTurn', 'stranger')).toBe(false);
  });

  it('personality bursts unlock with friendship and never re-lock', () => {
    expect(clipAllowed('spin', 'friend')).toBe(true);
    expect(clipAllowed('shyTurn', 'friend')).toBe(false);
    expect(clipAllowed('shyTurn', 'closeFriend')).toBe(true);
    for (const stage of STAGES) {
      for (const clip of ['spin', 'backTurn', 'shiver', 'stretch', 'stomp', 'shyTurn'] as const) {
        if (clipAllowed(clip, stage)) {
          const later = STAGES.slice(STAGES.indexOf(stage));
          for (const s of later) expect(clipAllowed(clip, s)).toBe(true);
        }
      }
    }
  });

  it('the canon has exactly seven traits', () => {
    expect(TRAITS).toHaveLength(7);
  });
});
