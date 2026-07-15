import { describe, expect, it } from 'vitest';
import {
  RITUAL_FORMS,
  LIGHT_FORMS,
  RITUAL_REACTIONS,
  LIGHT_STARTERS,
  STARTER_VOICE_CONTEXTS,
  STARTER_TOASTS,
  lightStarterFor,
  starterFormOf,
  isRitualForm,
  isLightForm,
  normalizeSproutStage,
  normalizeBedStage,
  nextBedStage,
  normalizeSeatStage,
  nextSeatStage,
  normalizeSeedStage,
  nextSeedStage,
} from './starterInteractions';
import { STARTER_ITEM_FORMS } from './workshop/forms';
import { itemId } from './workshop/items';
import { verbFor } from './placed';
import { VOICE_POOL } from '../datou/voice';
import { __tables } from '../i18n';

describe('starter-item interactions', () => {
  it('covers every authored starter form (9 = 7 rituals + 2 light, food-bowl is separate)', () => {
    const all = [...RITUAL_FORMS, ...LIGHT_FORMS].sort();
    const authored = STARTER_ITEM_FORMS.filter((f) => f !== 'food-bowl').sort();
    expect(all).toEqual(authored);
    expect(RITUAL_FORMS).toHaveLength(7);
    expect(LIGHT_FORMS).toHaveLength(2);
  });

  it('classifies forms and resolves placed ids back to their form', () => {
    expect(isRitualForm('sprout-pot')).toBe(true);
    expect(isLightForm('chime')).toBe(true);
    expect(isRitualForm('chime')).toBe(false);
    const id = itemId({ form: 'pet-bed', material: 'bark', size: 'M', finish: 'plain' });
    expect(starterFormOf(id)).toBe('pet-bed');
    expect(starterFormOf('lab-bulb')).toBeNull();
    expect(starterFormOf('not-an-item')).toBeNull();
  });

  it('every interactive starter places (the pack offers the place verb)', () => {
    for (const form of [...RITUAL_FORMS, ...LIGHT_FORMS]) {
      const id = itemId({ form, material: 'twig', size: 'M', finish: 'plain' });
      // twig isn't accepted by every form, but the id still parses → 'place'.
      expect(verbFor(id)).toBe('place');
    }
  });

  it('light starters have a calm, clip-free reaction', () => {
    for (const form of LIGHT_FORMS) {
      const r = lightStarterFor(form);
      expect(r, form).toBeTruthy();
      expect(r!.voice.startsWith('starter')).toBe(true);
    }
    expect(LIGHT_STARTERS.chime.event).toBe('pet');
    expect(LIGHT_STARTERS['repair-toy'].event).toBe('helped');
  });

  it('keeps the calm-read invariants from the verified design (no excited dwell, gated comfort)', () => {
    // 'discover' is the ~3-min excited body posture — it must NOT be used for
    // these quiet rituals. The calm reads use 'helped' / 'comfort' / null.
    const events = Object.values(RITUAL_REACTIONS).flatMap((beats) =>
      Object.values(beats).map((r) => r.event),
    );
    expect(events).not.toContain('discover');
    // The seed-chest's quiet nosing carries on pulse+reach alone (no event).
    expect(RITUAL_REACTIONS['seed-chest'].chosen.event).toBeNull();
    // The mailbox empty-day fires no emotion (resting "nobody today").
    expect(RITUAL_REACTIONS.mailbox.empty.event).toBeNull();
    // garden-lantern is calm tending (comfort), distinct from lab-lantern's craft.
    expect(RITUAL_REACTIONS['garden-lantern'].lit.event).toBe('comfort');
  });

  it('advances each staged ritual in order and rests at its terminal state', () => {
    expect(normalizeSproutStage('nope')).toBe('dry');
    expect(normalizeSproutStage('bloom')).toBe('bloom');

    expect(nextBedStage('made')).toBe('circled');
    expect(nextBedStage('circled')).toBe('nested');
    expect(nextBedStage('nested')).toBe('nested');
    expect(normalizeBedStage(undefined)).toBe('made');

    expect(nextSeatStage('empty')).toBe('seated');
    expect(nextSeatStage('rested')).toBe('rested');
    expect(normalizeSeatStage('x')).toBe('empty');

    expect(nextSeedStage('full')).toBe('sorted');
    expect(nextSeedStage('chosen')).toBe('chosen');
    expect(normalizeSeedStage(null)).toBe('full');
  });

  it('defines a reaction for every beat the rituals actually fire', () => {
    // Guards against the dead-beat class of bug: a fireStarterReaction(form,beat)
    // call site whose beat has no entry in RITUAL_REACTIONS.
    const beatsFired: Record<string, string[]> = {
      'sprout-pot': ['watered', 'bloom'], // 'leafing' is documented but not fired
      mailbox: ['note', 'empty'],
      'mushroom-lamp': ['lit'],
      'garden-lantern': ['lit'],
      'pet-bed': ['nested'],
      stool: ['rested'],
      'seed-chest': ['chosen'],
    };
    const table = RITUAL_REACTIONS as Record<string, Record<string, unknown>>;
    for (const [form, beats] of Object.entries(beatsFired)) {
      for (const beat of beats) {
        expect(table[form]?.[beat], `${form}.${beat}`).toBeTruthy();
      }
    }
  });

  it('keeps the sprout pot terminal at bloom and renewable via re-seed to dry', () => {
    // The renewable loop relies on normalize coercing a fresh (stateless) entry
    // back to 'dry' — re-placing a picked-up bloom pot starts the ritual over.
    expect(normalizeSproutStage(undefined)).toBe('dry');
    expect(normalizeSproutStage('bloom')).toBe('bloom');
  });

  it('has a voice pool and localized strings for every context + toast, both locales', () => {
    const en = __tables.UI.en as Record<string, string>;
    const zh = __tables.UI.zh as Record<string, string>;
    for (const ctx of STARTER_VOICE_CONTEXTS) {
      expect(VOICE_POOL[ctx], ctx).toBeGreaterThanOrEqual(1);
      expect(en[`voice.${ctx}.1`], `${ctx}.1 en`).toBeTruthy();
      expect(zh[`voice.${ctx}.1`], `${ctx}.1 zh`).toBeTruthy();
    }
    for (const key of STARTER_TOASTS) {
      expect(en[key], `${key} en`).toBeTruthy();
      expect(zh[key], `${key} zh`).toBeTruthy();
    }
  });
});
