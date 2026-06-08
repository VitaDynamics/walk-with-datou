import type { DatouState } from '../physics/PhysicsAdapter';
import type { MovableProp, MovableProps } from './MovableProps';
import { catalog } from './World';
import type { Verb } from './catalog/verbs';

/**
 * The contextual-action resolver (docs/INTERACTION_VERBS.md §4 +
 * docs/ENVIRONMENT_DESIGN.md §4.2.1). One button (E / on-screen prompt) and
 * direct touch must resolve unambiguously to a single verb, by priority, each
 * frame. This module owns *selection*; MovableProps / Companion own *behaviour*.
 *
 * Priority ladder:
 *   1. cursor on Datou           → a creature verb (wake / take / play / pet)
 *   2. near a movable world prop → its context verb (kick / pick-up / jump-in…)
 *   3. at a trailhead / POI      → lead / commit (handled by Companion)
 *   4. Datou far & idle          → call
 *
 * Pure and deterministic (no THREE, no DOM) so it unit-tests like collision.ts.
 * Returns exactly ONE resolution (never two competing prompts).
 */

export type ActionTargetKind = 'datou' | 'movable' | 'poi' | 'none';

export interface ActionResolution {
  /** The verb the contextual action would perform. */
  verb: Verb;
  /** What the verb acts on. */
  target: ActionTargetKind;
  /** The movable prop id, when target = 'movable'. */
  propId?: number;
  /** A short label for the on-screen prompt. */
  label: string;
}

export interface ResolveContext {
  player: { x: number; z: number; yaw: number };
  datou: DatouState;
  movables: MovableProps;
  /** True when the cursor/tap is on Datou's hitbox (direct touch). */
  cursorOnDatou: boolean;
  /** Whether Datou is currently offering a carried item to take. */
  datouOffering?: boolean;
  /** Whether Datou is resting/asleep (→ wake). */
  datouResting?: boolean;
  /** Whether Datou is play-bowing (→ play). */
  datouBowing?: boolean;
  /** Reach distance for world-prop interaction (m). */
  reach?: number;
}

const DEFAULT_REACH = 2.5;
const CALL_DIST = 12; // Datou must be at least this far + idle for "call".

/** Resolve the single best contextual action for this frame, or null. */
export function resolveAction(ctx: ResolveContext): ActionResolution | null {
  // 1. Direct touch on Datou → a creature verb by Datou's state.
  if (ctx.cursorOnDatou) {
    if (ctx.datouResting) return { verb: 'wake', target: 'datou', label: 'Wake' };
    if (ctx.datouOffering) return { verb: 'take', target: 'datou', label: 'Take' };
    if (ctx.datouBowing) return { verb: 'play', target: 'datou', label: 'Play' };
    return { verb: 'pet', target: 'datou', label: 'Pet' };
  }

  // 2. Nearest movable world prop within reach → its context verb.
  const reach = ctx.reach ?? DEFAULT_REACH;
  const prop = ctx.movables.nearest(ctx.player.x, ctx.player.z, reach);
  if (prop) {
    const res = resolvePropVerb(prop);
    if (res) return res;
  }

  // 3. Datou far + idle (calm/tired, low speed) → call.
  const dd = Math.hypot(ctx.datou.position.x - ctx.player.x, ctx.datou.position.z - ctx.player.z);
  const datouSpeed = Math.hypot(ctx.datou.velocity.x, ctx.datou.velocity.z);
  if (dd > CALL_DIST && datouSpeed < 0.5) {
    return { verb: 'call', target: 'datou', label: 'Call' };
  }

  return null;
}

/**
 * Pick the contextual verb for a movable prop from the kind's declared verbs,
 * by the prop's current state. The verb is a property of the prop, not a mode
 * the player toggles — so one button reads "kick" at a ball, "pick up" at a
 * stick, "jump in" at a leaf pile.
 */
function resolvePropVerb(prop: MovableProp): ActionResolution | null {
  const kind = catalog.get(prop.kindId);
  if (!kind) return null;
  const verbs = kind.verbs;

  // A carried prop's action is to drop/throw; otherwise prefer the most
  // "playful" verb the kind supports, in a fixed, predictable order.
  if (prop.state === 'carried') {
    if (verbs.has('throw')) return mk('throw', prop, 'Throw');
    if (verbs.has('carry')) return mk('carry', prop, 'Drop');
  }

  const order: [Verb, string][] = [
    ['carry', 'Pick up'],
    ['throw', 'Throw'],
    ['breakScatter', 'Jump in'],
    ['knockOver', 'Knock over'],
    ['push', 'Kick'],
    ['move', 'Move'],
    ['use', 'Use'],
  ];
  for (const [verb, label] of order) {
    if (verbs.has(verb)) return mk(verb, prop, label);
  }
  return null;
}

function mk(verb: Verb, prop: MovableProp, label: string): ActionResolution {
  return { verb, target: 'movable', propId: prop.id, label };
}
