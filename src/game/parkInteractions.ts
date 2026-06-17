/**
 * Park-keepsake interactions — eight new placeable items that DO something when
 * you set them down and tap them. This is the PURE data model behind the
 * feature: for each form, its ordered states, the per-tap advance grammar, the
 * gate that keeps a payoff once-a-day (so the farmable emotions can't be
 * ground), Datou's canonical reaction (mapped onto the REAL rig + emotion engine
 * — no new rig art), the bond/personality it seeds, and the i18n/voice stems.
 *
 * It is the sibling of `starterInteractions.ts` and `labItems.ts`:
 *  - the calm ones (steam-rest, paw-rinse-step, moonwater-lamp, nesting-frame,
 *    weather-wheel, snack-tin) use the warm body beat (pulse + reach) + an
 *    emotion + one line, with NO signature clip — the quiet items stay quiet;
 *  - the two PLAY ones (nose-puzzle-drawer, spin-choice-wheel) carry an EARNED
 *    signature clip (spin / stomp), familiarity-gated exactly like the loud lab
 *    items, suppressed to a muted body beat below `friend`.
 *
 * Engine facts this model is built around (verified against source, same as
 * starterInteractions.ts):
 *  - `emotion.apply('comfort'|'praise'|'pet')` routes through notePraise() → it
 *    is farmable into the over-praise→shy tip-over, so every repeatable payoff
 *    here is gated once-per-day (`gate: 'daily'`) with a re-tap guard.
 *  - `emotion.apply('discover')` sets the ~3-minute *excited* body posture, so
 *    it is WRONG for a calm dwell; the calm reads use 'helped'/'pet'/'comfort'
 *    or no event at all (steam-rest), letting pulse+reach carry it.
 *  - signature clips (`spin`/`stomp`) are familiarity-gated in character.ts and
 *    only belong on the loud play items; quiet items set `clip: null`.
 *
 * No rendering, no Three.js, no RNG — fully unit-testable.
 */

import type { EmotionEvent } from '../datou/emotion';
import type { SignatureClip, FamiliarityStage } from '../datou/character';
import type { PlaySignal } from './workshop/personality';
import type { VoiceContext } from '../datou/voice';
import { parseItemId } from './workshop/items';

/** The eight new interactive park forms. */
export const PARK_ITEM_FORMS = [
  'steam-rest',
  'nose-puzzle-drawer',
  'paw-rinse-step',
  'moonwater-lamp',
  'bird-nesting-fiber-frame',
  'weather-log-wheel',
  'spin-choice-wheel',
  'shared-snack-tin',
] as const;

export type ParkItemForm = (typeof PARK_ITEM_FORMS)[number];

/**
 * How a form's payoff is allowed to repeat:
 *  - 'daily'  : fires once per real day, re-arms on the date rollover (the
 *               farmable emotions live here — a re-tap the same day is silent);
 *  - 'free'   : fires on every Datou arrival but rides the engine's
 *               reactCooldown (the spin-choice toy: a fresh seeded pick each
 *               time, never a state to over-advance, the cooldown stops stacking).
 */
export type ParkGate = 'daily' | 'free';

/** The Datou payoff for a park item, in our engine's terms. */
export interface ParkReaction {
  /** Emotion to apply on arrival (or null for a clip-free, event-free body beat). */
  readonly event: EmotionEvent | null;
  /** An EARNED signature move (gated by character.ts); null for the quiet items. */
  readonly clip: SignatureClip | null;
  /** Familiarity stage the full reaction (esp. the clip) unlocks at. */
  readonly minStage: FamiliarityStage;
  /** Bond points on the gated payoff. */
  readonly bond: number;
  /** Personality axis nudged on the payoff. */
  readonly note: PlaySignal;
  /** BOBO's caption when it lands (single line). */
  readonly voice: VoiceContext;
}

/** One interactive park item: its states, gating, reaction, and toasts. */
export interface ParkItem {
  readonly form: ParkItemForm;
  /** Ordered persisted states (the first is the resting/default state). */
  readonly states: readonly string[];
  /** The state the active/payoff plate shows. */
  readonly activeState: string;
  readonly gate: ParkGate;
  readonly reaction: ParkReaction;
  /** Toast key shown on the payoff beat (EN+ZH required). */
  readonly toast: string;
  /** Plate metrics (keeps Datou the focal point). */
  readonly height: number;
  readonly shadowRadius: number;
}

/**
 * The eight, in catalogue order. Stage gates and emotions follow the verified
 * design: only the two play items carry an earned clip (spin/stomp at friend+);
 * every farmable emotion (comfort/praise/pet) is `gate: 'daily'`.
 */
export const PARK_ITEMS: readonly ParkItem[] = [
  {
    // Warm the cup → one still steam curl → Datou watches calmly. No emotion
    // event (null) — pulse+reach carry the quiet dwell, like seed-chest 'chosen'.
    form: 'steam-rest',
    states: ['cool', 'warm'],
    activeState: 'warm',
    gate: 'daily',
    reaction: { event: null, clip: null, minStage: 'stranger', bond: 1, note: 'care', voice: 'parkSteamRest' },
    toast: 'item.steam-rest.warm',
    height: 0.45,
    shadowRadius: 0.27,
  },
  {
    // A drawer slides open → Datou solves it, delighted → praise + the spin
    // (earned at friend). The loud play burst.
    form: 'nose-puzzle-drawer',
    states: ['closed', 'open'],
    activeState: 'open',
    gate: 'daily',
    reaction: { event: 'praise', clip: 'spin', minStage: 'friend', bond: 2, note: 'play', voice: 'parkNosePuzzle' },
    toast: 'item.nose-puzzle-drawer.open',
    height: 0.45,
    shadowRadius: 0.5,
  },
  {
    // Fill the wells → Datou steps in to rinse → the calm care settle (comfort,
    // strictly once/day via the daily revert — the pet-bed/garden-lantern gate).
    form: 'paw-rinse-step',
    states: ['dry', 'filled', 'clean'],
    activeState: 'filled',
    gate: 'daily',
    reaction: { event: 'comfort', clip: null, minStage: 'friend', bond: 1, note: 'care', voice: 'parkPawRinse' },
    toast: 'item.paw-rinse-step.filled',
    height: 0.28,
    shadowRadius: 0.62,
  },
  {
    // Light the water → it holds a small warm pool → the calm dusk settle.
    // Mirrors garden-lantern's wired beat (comfort, once/day, no clip).
    form: 'moonwater-lamp',
    states: ['unlit', 'lit'],
    activeState: 'lit',
    gate: 'daily',
    reaction: { event: 'comfort', clip: null, minStage: 'stranger', bond: 1, note: 'care', voice: 'parkMoonwater' },
    toast: 'item.moonwater-lamp.lit',
    height: 0.34,
    shadowRadius: 0.36,
  },
  {
    // The birds took some fibers (daily renew) → Datou notices the change.
    // Calm proud ('helped', NOT 'discover'); note 'explore'.
    form: 'bird-nesting-fiber-frame',
    states: ['full', 'taken'],
    activeState: 'taken',
    gate: 'daily',
    reaction: { event: 'helped', clip: null, minStage: 'stranger', bond: 1, note: 'explore', voice: 'parkNestingFrame' },
    toast: 'item.bird-nesting-fiber-frame.taken',
    height: 0.55,
    shadowRadius: 0.42,
  },
  {
    // Turn the wheel one notch to today's sky → a quiet logged-it beat ('helped',
    // note 'work', once/day — the seed-chest register).
    form: 'weather-log-wheel',
    states: ['rest', 'logged'],
    activeState: 'logged',
    gate: 'daily',
    reaction: { event: 'helped', clip: null, minStage: 'stranger', bond: 1, note: 'work', voice: 'parkWeatherWheel' },
    toast: 'item.weather-log-wheel.logged',
    height: 0.55,
    shadowRadius: 0.3,
  },
  {
    // Datou turns the wheel to CHOOSE a game → praise + the stomp ("this one!",
    // earned at friend). A repeatable toy (free gate, rides reactCooldown).
    form: 'spin-choice-wheel',
    states: ['rest', 'landed'],
    activeState: 'landed',
    gate: 'free',
    reaction: { event: 'praise', clip: 'stomp', minStage: 'friend', bond: 1, note: 'play', voice: 'parkSpinWheel' },
    toast: 'item.spin-choice-wheel.landed',
    height: 0.62,
    shadowRadius: 0.26,
  },
  {
    // Nose the lid open → a warm side-by-side share ('pet' = joy, not farmable
    // comfort; once/day so it's a ritual, never a feeder).
    form: 'shared-snack-tin',
    states: ['closed', 'open'],
    activeState: 'open',
    gate: 'daily',
    reaction: { event: 'pet', clip: null, minStage: 'stranger', bond: 1, note: 'care', voice: 'parkSnackTin' },
    toast: 'item.shared-snack-tin.open',
    height: 0.34,
    shadowRadius: 0.34,
  },
];

const BY_FORM = new Map<string, ParkItem>(PARK_ITEMS.map((it) => [it.form, it]));

export function parkItemFor(form: string): ParkItem | undefined {
  return BY_FORM.get(form);
}

export function isParkItemForm(form: string): form is ParkItemForm {
  return BY_FORM.has(form);
}

/** The park form of a placed id, if it is one of these. */
export function parkFormOf(id: string): ParkItemForm | null {
  const form = parseItemId(id)?.form;
  return form && isParkItemForm(form) ? form : null;
}

/** Coerce a persisted state back into a form's range (resting state on miss). */
export function normalizeParkState(form: ParkItemForm, s: unknown): string {
  const item = BY_FORM.get(form);
  if (!item) return 'rest';
  return item.states.includes(s as string) ? (s as string) : item.states[0];
}

/** The next state in a form's order, resting at the terminal (for staged taps). */
export function nextParkState(form: ParkItemForm, s: string): string {
  const item = BY_FORM.get(form);
  if (!item) return s;
  const i = item.states.indexOf(s);
  return item.states[Math.min(i + 1, item.states.length - 1)];
}

/** Every voice context these interactions reference (for the i18n completeness test). */
export const PARK_VOICE_CONTEXTS: readonly VoiceContext[] = [
  'parkSteamRest',
  'parkNosePuzzle',
  'parkPawRinse',
  'parkMoonwater',
  'parkNestingFrame',
  'parkWeatherWheel',
  'parkSpinWheel',
  'parkSnackTin',
];

/** Toast i18n keys per payoff beat (EN/ZH both required). */
export const PARK_TOASTS: readonly string[] = PARK_ITEMS.map((it) => it.toast);
