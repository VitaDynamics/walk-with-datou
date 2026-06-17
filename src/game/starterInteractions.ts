/**
 * Starter-item interactions — the seven authored keepsakes that DO something
 * when you set them down and tap them (chime + repair-toy ship as the
 * lightweight tap→reaction pair, see `lightStarterReaction` below).
 *
 * This is the PURE data model behind the feature: for each interactive starter
 * form, its ordered states, the per-tap advance grammar, Datou's canonical
 * reaction (mapped onto the REAL rig + emotion engine — no new rig art), the
 * bond/personality it seeds, and the i18n/voice stems its captions use.
 *
 * It is the sibling of `labItems.ts`: the lab items are BOBO's loud
 * co-inventions (manipulation → earned signature clip); these are the calm
 * domestic rituals (a sprout you tend, a lamp you light, a bed Datou settles
 * into). Crucially they use NO signature clip — only the warm body beat
 * (pulse + reach) — so the quiet ones stay quiet and Datou stays the focus.
 *
 * Engine facts this model is built around (verified against source):
 *  - `emotion.apply('comfort')` routes through notePraise() → it is farmable
 *    into the over-praise→shy tip-over, so any repeatable comfort beat MUST be
 *    gated (daily/session/once-per-transition).
 *  - `emotion.apply('discover')` sets the ~3-minute *excited* body posture, so
 *    it is WRONG for a "calm dwell"; the calm reads use 'helped' (proud) or no
 *    event at all, letting pulse+reach carry it.
 *  - `this.saying` is one overwriteable slot (one line, ~4.5 s) — every caption
 *    here is a single landed line.
 *
 * No rendering, no Three.js, no RNG — fully unit-testable.
 */

import type { EmotionEvent } from '../datou/emotion';
import type { PlaySignal } from './workshop/personality';
import type { VoiceContext } from '../datou/voice';
import { parseItemId } from './workshop/items';

/** Forms that run a full multi-state ritual. */
export type RitualForm =
  | 'sprout-pot'
  | 'mailbox'
  | 'mushroom-lamp'
  | 'pet-bed'
  | 'stool'
  | 'garden-lantern'
  | 'seed-chest';

/** Forms that ship the lightweight tap→Datou-reaction (no state, no overlay). */
export type LightForm = 'chime' | 'repair-toy';

/** Per-form ordered state unions (the persisted `<form>Stage`). */
export type SproutStage = 'dry' | 'watered' | 'leafing' | 'bloom';
export type BedStage = 'made' | 'circled' | 'nested';
export type SeatStage = 'empty' | 'seated' | 'rested';
export type SeedStage = 'full' | 'sorted' | 'chosen';

/**
 * The reaction that fires when Datou reaches the item. `event` always applies;
 * `event: null` means "let pulse+reach carry it" (the calm nosing reads).
 * No `clip` field — these rituals never play a signature move.
 */
export interface StarterReaction {
  /** Emotion to apply on Datou's arrival (or null for a clip-free body beat). */
  readonly event: EmotionEvent | null;
  /** Bond points granted on the *payoff* beat (gated per the ritual's cadence). */
  readonly bond: number;
  /** Personality axis nudged on the payoff. */
  readonly note?: PlaySignal;
  /** The caption BOBO speaks when it lands (single line). */
  readonly voice: VoiceContext;
}

/**
 * The two calm tap→reaction items. They keep their authored art unchanged and
 * reuse the lab-style payoff (walk over → pulse+reach + emotion + one line),
 * but with NO clip and NO fake sound/sway — honest to what the engine renders.
 */
export const LIGHT_STARTERS: Readonly<Record<LightForm, StarterReaction>> = {
  // The wind chime: a soft "I heard that" turn. lab-bell already owns the loud
  // ring; this one is just a gentle look-over, so it reads as a quieter cousin.
  chime: { event: 'pet', bond: 1, note: 'care', voice: 'starterChime' },
  // The repair toy: he watches its familiar little wobble — a warm, fond beat.
  'repair-toy': { event: 'helped', bond: 1, note: 'play', voice: 'starterRepairToy' },
};

export function lightStarterFor(form: string): StarterReaction | undefined {
  return (LIGHT_STARTERS as Record<string, StarterReaction>)[form];
}

/* ── sprout-pot ──────────────────────────────────────────────────────────── */
export const SPROUT_STAGES: readonly SproutStage[] = ['dry', 'watered', 'leafing', 'bloom'];
export function normalizeSproutStage(s: unknown): SproutStage {
  return SPROUT_STAGES.includes(s as SproutStage) ? (s as SproutStage) : 'dry';
}

/* ── pet-bed ─────────────────────────────────────────────────────────────── */
export const BED_STAGES: readonly BedStage[] = ['made', 'circled', 'nested'];
export function normalizeBedStage(s: unknown): BedStage {
  return BED_STAGES.includes(s as BedStage) ? (s as BedStage) : 'made';
}
export function nextBedStage(s: BedStage): BedStage {
  return BED_STAGES[Math.min(BED_STAGES.indexOf(s) + 1, BED_STAGES.length - 1)];
}

/* ── stool ───────────────────────────────────────────────────────────────── */
export const SEAT_STAGES: readonly SeatStage[] = ['empty', 'seated', 'rested'];
export function normalizeSeatStage(s: unknown): SeatStage {
  return SEAT_STAGES.includes(s as SeatStage) ? (s as SeatStage) : 'empty';
}
export function nextSeatStage(s: SeatStage): SeatStage {
  return SEAT_STAGES[Math.min(SEAT_STAGES.indexOf(s) + 1, SEAT_STAGES.length - 1)];
}

/* ── seed-chest ──────────────────────────────────────────────────────────── */
export const SEED_STAGES: readonly SeedStage[] = ['full', 'sorted', 'chosen'];
export function normalizeSeedStage(s: unknown): SeedStage {
  return SEED_STAGES.includes(s as SeedStage) ? (s as SeedStage) : 'full';
}
export function nextSeedStage(s: SeedStage): SeedStage {
  return SEED_STAGES[Math.min(SEED_STAGES.indexOf(s) + 1, SEED_STAGES.length - 1)];
}

/**
 * Reaction payloads keyed by the *beat* they fire on. The Game wiring picks the
 * payload for the transition it is resolving; this keeps the per-beat emotion /
 * bond / voice in one auditable place (the spec's "wire the right emotion
 * deliberately", e.g. garden-lantern = comfort, NOT lab-lantern's craft).
 */
export const RITUAL_REACTIONS = {
  // sprout: watered & leaf-check are calm 'helped'; bloom is the proud payoff.
  'sprout-pot': {
    watered: { event: 'helped', bond: 0, note: 'care', voice: 'starterSprout' },
    leafing: { event: 'helped', bond: 1, note: 'care', voice: 'starterSprout' },
    bloom: { event: 'praise', bond: 2, note: 'care', voice: 'starterSprout' },
  },
  // mailbox: note-day is warm gratitude; empty-day fires NO emotion (resting
  // neutral is the correct "nobody today" read — see Game wiring).
  mailbox: {
    note: { event: 'helped', bond: 2, note: 'care', voice: 'starterMailboxNote' },
    empty: { event: null, bond: 0, voice: 'starterMailboxEmpty' },
  },
  // mushroom-lamp: calm dusk; NOT comfort (farmable) — 'helped', once/day.
  'mushroom-lamp': {
    lit: { event: 'helped', bond: 1, note: 'care', voice: 'starterMushroomLamp' },
  },
  // pet-bed: the settle. comfort is OK here (once-per-transition + re-tap guard).
  'pet-bed': {
    nested: { event: 'comfort', bond: 1, note: 'care', voice: 'starterPetBed' },
  },
  // stool: sit together. comfort, once on rested.
  stool: {
    rested: { event: 'comfort', bond: 1, note: 'care', voice: 'starterStool' },
  },
  // garden-lantern: calm tending → comfort (canon: distinct from lab-lantern's
  // proud craft). bond on the lighting transition (daily-revert makes it once/day).
  'garden-lantern': {
    lit: { event: 'comfort', bond: 1, note: 'care', voice: 'starterGardenLantern' },
  },
  // seed-chest: quiet shared planning. No emotion event — pulse+reach carries
  // the head-dips read ('discover' would fire 3-min excitement). note('work').
  'seed-chest': {
    chosen: { event: null, bond: 1, note: 'work', voice: 'starterSeedChest' },
  },
} as const satisfies Record<string, Record<string, StarterReaction>>;

/** Every voice context these interactions reference (for the i18n completeness test). */
export const STARTER_VOICE_CONTEXTS: readonly VoiceContext[] = [
  'starterSprout',
  'starterMailboxNote',
  'starterMailboxEmpty',
  'starterMushroomLamp',
  'starterPetBed',
  'starterStool',
  'starterGardenLantern',
  'starterSeedChest',
  'starterChime',
  'starterRepairToy',
];

/** Toast i18n keys per ritual transition (EN/ZH both required). */
export const STARTER_TOASTS: readonly string[] = [
  'item.sprout-pot.watered',
  'item.sprout-pot.bloom',
  'item.mailbox.note',
  'item.mailbox.empty',
  'item.mushroom-lamp.lit',
  'item.pet-bed.nested',
  'item.stool.rested',
  'item.garden-lantern.lit',
  'item.seed-chest.sorted',
  'item.seed-chest.chosen',
];

/** The forms that run a full ritual (drives the Game dispatch + tests). */
export const RITUAL_FORMS: readonly RitualForm[] = [
  'sprout-pot',
  'mailbox',
  'mushroom-lamp',
  'pet-bed',
  'stool',
  'garden-lantern',
  'seed-chest',
];

export const LIGHT_FORMS: readonly LightForm[] = ['chime', 'repair-toy'];

export function isRitualForm(form: string): form is RitualForm {
  return (RITUAL_FORMS as readonly string[]).includes(form);
}
export function isLightForm(form: string): form is LightForm {
  return (LIGHT_FORMS as readonly string[]).includes(form);
}

/** The form of a placed id, if it is one of these starter interactions. */
export function starterFormOf(id: string): RitualForm | LightForm | null {
  const form = parseItemId(id)?.form;
  if (!form) return null;
  if (isRitualForm(form)) return form;
  if (isLightForm(form)) return form;
  return null;
}
