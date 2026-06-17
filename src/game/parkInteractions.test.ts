import { describe, expect, it } from 'vitest';
import {
  PARK_ITEMS,
  PARK_ITEM_FORMS,
  PARK_VOICE_CONTEXTS,
  PARK_TOASTS,
  parkItemFor,
  parkFormOf,
  isParkItemForm,
  normalizeParkState,
  nextParkState,
  type ParkItemForm,
} from './parkInteractions';
import { itemId } from './workshop/items';
import { verbFor } from './placed';
import { FORMS } from './workshop/forms';
import { EXACT_PATTERNS } from './workshop/patterns';
import { canonical, filledCount } from './workshop/pattern';
import { VOICE_POOL } from '../datou/voice';
import { __tables } from '../i18n';

describe('park-item interactions', () => {
  it('defines eight distinct interactive forms, each a real registered form', () => {
    expect(PARK_ITEMS).toHaveLength(8);
    expect(PARK_ITEM_FORMS).toHaveLength(8);
    expect(new Set(PARK_ITEM_FORMS).size).toBe(8);
    for (const form of PARK_ITEM_FORMS) {
      expect(form in FORMS, form).toBe(true);
    }
  });

  it('classifies forms and resolves placed ids back to their form', () => {
    expect(isParkItemForm('steam-rest')).toBe(true);
    expect(isParkItemForm('sprout-pot')).toBe(false);
    const id = itemId({ form: 'moonwater-lamp', material: 'shell', size: 'M', finish: 'plain' });
    expect(parkFormOf(id)).toBe('moonwater-lamp');
    expect(parkFormOf('lab-bulb')).toBeNull();
    expect(parkFormOf('not-an-item')).toBeNull();
  });

  it('every park item places (the pack offers the place verb)', () => {
    for (const form of PARK_ITEM_FORMS) {
      const id = itemId({ form, material: 'twig', size: 'M', finish: 'plain' });
      expect(verbFor(id), form).toBe('place');
    }
  });

  it('keeps the verified emotion invariants (no excited dwell; clips only on the play items)', () => {
    const events = PARK_ITEMS.map((it) => it.reaction.event);
    // 'discover' sets the ~3-min excited posture — never used for these calm rituals.
    expect(events).not.toContain('discover');
    // The only earned signature clips are spin/stomp, on the two play items, friend+.
    const withClip = PARK_ITEMS.filter((it) => it.reaction.clip);
    expect(withClip.map((it) => it.form).sort()).toEqual(
      ['nose-puzzle-drawer', 'spin-choice-wheel'].sort(),
    );
    for (const it of withClip) {
      expect(['spin', 'stomp']).toContain(it.reaction.clip);
      expect(it.reaction.minStage).toBe('friend');
    }
    // Every quiet item is clip-free.
    for (const it of PARK_ITEMS) {
      if (it.form !== 'nose-puzzle-drawer' && it.form !== 'spin-choice-wheel') {
        expect(it.reaction.clip, it.form).toBeNull();
      }
    }
    // steam-rest is the lone event-free quiet dwell (pulse+reach carries it).
    expect(parkItemFor('steam-rest')!.reaction.event).toBeNull();
  });

  it('gives every farmable emotion a daily gate; only the free toy is ungated', () => {
    for (const it of PARK_ITEMS) {
      if (['comfort', 'praise', 'pet'].includes(it.reaction.event ?? '')) {
        // Farmable emotions must be daily-gated, except the free toy which rides
        // the engine reactCooldown instead.
        if (it.gate !== 'free') expect(it.gate, it.form).toBe('daily');
      }
    }
    const free = PARK_ITEMS.filter((it) => it.gate === 'free');
    expect(free.map((it) => it.form)).toEqual(['spin-choice-wheel']);
  });

  it('normalizes and advances state within each form, resting at the terminal', () => {
    expect(normalizeParkState('steam-rest', 'nope')).toBe('cool');
    expect(normalizeParkState('steam-rest', 'warm')).toBe('warm');
    expect(normalizeParkState('paw-rinse-step', undefined)).toBe('dry');

    expect(nextParkState('paw-rinse-step', 'dry')).toBe('filled');
    expect(nextParkState('paw-rinse-step', 'filled')).toBe('clean');
    expect(nextParkState('paw-rinse-step', 'clean')).toBe('clean');
    expect(nextParkState('moonwater-lamp', 'unlit')).toBe('lit');
    expect(nextParkState('moonwater-lamp', 'lit')).toBe('lit');
  });

  it('every active state is a member of its form states', () => {
    for (const it of PARK_ITEMS) {
      expect(it.states, it.form).toContain(it.activeState);
      expect(it.states.length, it.form).toBeGreaterThanOrEqual(2);
    }
  });

  it('has one craft pattern per park form, canonically unique and within tier-2 budget', () => {
    for (const form of PARK_ITEM_FORMS) {
      const recipes = EXACT_PATTERNS.filter((p) => p.result === form);
      expect(recipes, form).toHaveLength(1);
      const cells = filledCount(recipes[0]);
      // Every park form is tier 2 → 4..7 filled cells.
      expect(FORMS[form].tier, form).toBe(2);
      expect(cells, form).toBeGreaterThanOrEqual(4);
      expect(cells, form).toBeLessThanOrEqual(7);
    }
    // No park pattern collides with any other authored pattern.
    const keys = EXACT_PATTERNS.map(canonical);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has a voice pool and localized strings for every context + toast, both locales', () => {
    const en = __tables.UI.en as Record<string, string>;
    const zh = __tables.UI.zh as Record<string, string>;
    expect(PARK_VOICE_CONTEXTS).toHaveLength(8);
    for (const ctx of PARK_VOICE_CONTEXTS) {
      expect(VOICE_POOL[ctx], ctx).toBeGreaterThanOrEqual(1);
      expect(en[`voice.${ctx}.1`], `${ctx}.1 en`).toBeTruthy();
      expect(zh[`voice.${ctx}.1`], `${ctx}.1 zh`).toBeTruthy();
    }
    expect(PARK_TOASTS).toHaveLength(8);
    for (const key of PARK_TOASTS) {
      expect(en[key], `${key} en`).toBeTruthy();
      expect(zh[key], `${key} zh`).toBeTruthy();
    }
  });

  it('exposes a localized form name in both locales (no form. leakage)', () => {
    const en = __tables.UI.en as Record<string, string>;
    const zh = __tables.UI.zh as Record<string, string>;
    for (const form of PARK_ITEM_FORMS as readonly ParkItemForm[]) {
      expect(en[`form.${form}`], `${form} en`).toBeTruthy();
      expect(zh[`form.${form}`], `${form} zh`).toBeTruthy();
    }
  });
});
