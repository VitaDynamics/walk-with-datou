/**
 * Interaction verbs — the small, fixed set of *behaviours* an interactable item
 * can support (docs/ENVIRONMENT_DESIGN.md §4.2 world verbs +
 * docs/INTERACTION_VERBS.md creature verbs).
 *
 * The crucial design rule: **verbs are behaviours that live once in the engine
 * (MovableProps.ts / Interaction.ts); a catalog item merely declares which it
 * supports.** That is how ~500 interactable kinds map onto ~10 behaviours with
 * no per-kind code — a new interactable item is a data row + (optionally) a GLB,
 * never new logic.
 */

/** World-manipulation verbs (act on a prop). */
export type WorldVerb =
  | 'push' // nudge it; it slides and settles (ball, pinecone, log)
  | 'move' // pick-up-and-place via the contextual action (pot, gnome)
  | 'knockOver' // tip-over animation; lies on its side, auto-rights (reeds, sign)
  | 'breakScatter' // bursts into short-lived pieces (leaf pile, dandelion, mushroom)
  | 'carry' // hold one small object; drop/deliver (stick, ball, souvenir)
  | 'throw' // release a carried object on a ballistic arc (ball, stick)
  | 'use' // trigger a special behaviour in place (pump, bell, swing)
  | 'sniff' // Datou investigates (the sniff-spot POI flavour)
  | 'dig' // Datou digs; reveals a souvenir (dig-spot)
  | 'eat'; // consumable (food, berries)

/** Creature verbs (act on Datou). Resolved by Interaction, handled by Companion. */
export type CreatureVerb =
  | 'pet'
  | 'call'
  | 'play'
  | 'lead'
  | 'wait'
  | 'take' // take an offered object from Datou
  | 'give'
  | 'wake'
  | 'watch'; // observe a critter / ambient thing

export type Verb = WorldVerb | CreatureVerb;

export const WORLD_VERBS: readonly WorldVerb[] = [
  'push',
  'move',
  'knockOver',
  'breakScatter',
  'carry',
  'throw',
  'use',
  'sniff',
  'dig',
  'eat',
];

export const CREATURE_VERBS: readonly CreatureVerb[] = [
  'pet',
  'call',
  'play',
  'lead',
  'wait',
  'take',
  'give',
  'wake',
  'watch',
];

const WORLD_SET: ReadonlySet<Verb> = new Set<Verb>(WORLD_VERBS);

/** Verbs that move the prop's position/state and so need a MovableProp entity
 *  (the physical-simulation subset). Excludes purely observational/forageable
 *  verbs (sniff/watch/dig/eat are handled by POI/Companion, not the integrator). */
export const MOVABLE_VERBS: ReadonlySet<Verb> = new Set<Verb>([
  'push',
  'move',
  'knockOver',
  'breakScatter',
  'carry',
  'throw',
]);

/** True if a verb acts on the world (vs. on Datou). */
export function isWorldVerb(v: Verb): v is WorldVerb {
  return WORLD_SET.has(v);
}

/** True if any of the kind's verbs needs a live MovableProp entity. */
export function needsMovable(verbs: ReadonlySet<Verb>): boolean {
  for (const v of verbs) if (MOVABLE_VERBS.has(v)) return true;
  return false;
}
