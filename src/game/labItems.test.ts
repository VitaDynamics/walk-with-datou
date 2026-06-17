import { describe, expect, it } from 'vitest';
import { LAB_ITEMS, labItemFor, isLabItem } from './labItems';
import { clipAllowed, stageReached } from '../datou/character';
import { VOICE_POOL } from '../datou/voice';
import { verbFor } from './placed';
import { __tables } from '../i18n';

describe('field-lab items', () => {
  it('has the ten co-inventions with unique lab-* ids', () => {
    expect(LAB_ITEMS).toHaveLength(10);
    const ids = LAB_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(10);
    for (const id of ids) expect(id.startsWith('lab-')).toBe(true);
  });

  it('looks items up by id and rejects non-lab ids', () => {
    expect(labItemFor('lab-bulb')?.no).toBe('01');
    expect(isLabItem('lab-poof')).toBe(true);
    expect(isLabItem('lantern')).toBe(false);
    expect(labItemFor('nope')).toBeUndefined();
  });

  it('every lab id places (the pack offers the place verb)', () => {
    for (const it of LAB_ITEMS) expect(verbFor(it.id)).toBe('place');
  });

  it('every clip a lab item uses is gated at or below its own minStage', () => {
    // The reaction can only fire once the item itself is reachable, so its
    // signature clip must not require a deeper bond than the item does.
    for (const it of LAB_ITEMS) {
      for (const clip of [it.clip, it.clip2]) {
        if (!clip) continue;
        expect(clipAllowed(clip, it.minStage), `${it.id}:${clip}`).toBe(true);
      }
    }
  });

  it('keeps the loud personality moves earned', () => {
    // The bulb's spin and the poof easter egg must be locked for a stranger.
    const bulb = labItemFor('lab-bulb')!;
    expect(stageReached('stranger', bulb.minStage)).toBe(false);
    const poof = labItemFor('lab-poof')!;
    expect(poof.minStage).toBe('bestFriend');
    expect(poof.cooldownDays).toBeGreaterThanOrEqual(7);
  });

  it('manipulations are short and single (loudness budget ≤ 1.6 s)', () => {
    for (const it of LAB_ITEMS) {
      expect(it.manipDur, it.id).toBeGreaterThan(0);
      expect(it.manipDur, it.id).toBeLessThanOrEqual(1600);
    }
  });

  it('has a voice pool and localized strings for every item, both locales', () => {
    const en = __tables.UI.en as Record<string, string>;
    const zh = __tables.UI.zh as Record<string, string>;
    for (const it of LAB_ITEMS) {
      expect(VOICE_POOL[it.voice], it.voice).toBeGreaterThanOrEqual(1);
      for (const tbl of [en, zh]) {
        expect(tbl[`voice.${it.voice}.1`], `${it.voice}.1`).toBeTruthy();
        expect(tbl[`thing.${it.id}`], `thing.${it.id}`).toBeTruthy();
        expect(tbl[`lab.${it.id}.proactive`], `lab.${it.id}.proactive`).toBeTruthy();
      }
    }
    for (const stage of ['stranger', 'friend', 'closeFriend', 'bestFriend']) {
      expect(en[`stage.${stage}`]).toBeTruthy();
      expect(zh[`stage.${stage}`]).toBeTruthy();
    }
    expect(en['lab.locked']).toBeTruthy();
    expect(en['lab.resting']).toBeTruthy();
  });
});
