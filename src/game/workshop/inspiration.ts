/**
 * Inspiration engine — Datou as the muse (BUILDING_SYSTEM §5).
 *
 * Datou periodically gets an IDEA: a hint toward an unfound exact pattern,
 * delivered in-character. The trigger is `zone × weather × season × time ×
 * Datou-state`, evaluated on a slow tick with a SEEDED roll, gated by bond
 * depth (not player level), with a cooldown + pity timer. All seeded ⇒
 * diary-replayable (§9): the same day + context + bond bucket yields the same
 * inspiration for everyone.
 *
 * This module is pure: `rollInspiration(ctx)` returns a hint or null. The game
 * layer owns the tick cadence, the cooldown clock, and banking the result.
 */

import { Rng } from '../../physics/mujoco/rng';
import { dailySeed } from '../../world/Spots';
import type { ZoneId } from '../../world/zones';
import { EXACT_PATTERNS } from './patterns';
import { canonical, filledCount } from './pattern';
import { FORMS, type FormFamily, type FormId } from './forms';
import type { Weather, Season } from './weather';
import type { Hint } from './WorkshopState';

/** Datou's coarse mood (matches the physics adapter's DatouMood vocabulary). */
export type Mood = 'happy' | 'calm' | 'curious' | 'tired';

/** Personality axes (research doc) — biases branches at high bond. */
export type Personality = 'explorer' | 'guardian' | 'playful' | 'independent' | 'balanced';

export interface InspoContext {
  zone: ZoneId;
  weather: Weather;
  season: Season;
  mood: Mood;
  bond: number;
  personality: Personality;
  /** A monotonically rising tick id (e.g. session second) for seed variety. */
  tick: number;
  date?: Date;
}

/**
 * Tier gating by relationship depth (§5.2):
 *  - bond < 30 → tier 1 (components, toys)
 *  - 30..70    → tier ≤ 2 (furnishings)
 *  - 70+       → tier ≤ 3 (structures)
 */
function maxTier(bond: number): 1 | 2 | 3 {
  if (bond < 30) return 1;
  if (bond < 70) return 2;
  return 3;
}

/** The trigger matrix (§5.1): which form families a context evokes. */
function favoredFamilies(ctx: InspoContext): FormFamily[] {
  const fams = new Set<FormFamily>();
  // zone × weather pairings.
  if (ctx.zone === 'lake' && ctx.weather === 'rain') fams.add('component'); // vessels/driftwood
  if (ctx.zone === 'woods' && ctx.weather === 'fog') fams.add('furnishing'); // lanterns/lamps
  if (ctx.zone === 'trail' && ctx.weather === 'clear') fams.add('furnishing'); // benches/signs
  if (ctx.zone === 'home' && ctx.mood === 'tired') fams.add('furnishing'); // mats/comfort
  if (ctx.zone === 'meadow') fams.add('structure');
  // season.
  if (ctx.season === 'winter') fams.add('structure'); // cold-frame, warm forms
  // mood → temperament (§5.2): playful unlocks toys, calm unlocks furniture.
  if (ctx.mood === 'happy') fams.add('datou');
  if (ctx.mood === 'calm') fams.add('furnishing');
  if (ctx.mood === 'curious') fams.add('keepsake');
  // personality bias at high bond (§5.2).
  if (ctx.bond >= 70) {
    if (ctx.personality === 'explorer') fams.add('structure');
    if (ctx.personality === 'guardian') fams.add('structure');
    if (ctx.personality === 'playful') fams.add('datou');
  }
  if (fams.size === 0) fams.add('component');
  return [...fams];
}

/** Stable seed for a context's roll — same context → same outcome (§9). */
function ctxSeed(ctx: InspoContext): number {
  const zoneIdx = ['home', 'trail', 'woods', 'lake', 'meadow'].indexOf(ctx.zone) + 1;
  const wIdx = ['clear', 'breeze', 'rain', 'fog'].indexOf(ctx.weather) + 1;
  const bondBucket = Math.floor(ctx.bond / 10);
  let s = dailySeed(ctx.date) >>> 0;
  s = Math.imul(s ^ (zoneIdx * 0x9e37), 0x85eb_ca6b) >>> 0;
  s = Math.imul(s ^ (wIdx * 0xc2b2), 0xc2b2_ae35) >>> 0;
  s = Math.imul(s ^ (bondBucket * 0x27d4), 0x165667b1) >>> 0;
  s = (s ^ (ctx.tick * 0x9e37_79b9)) >>> 0;
  return s;
}

/**
 * Candidate patterns for a context: unfound exacts whose form family is favored
 * and whose tier is within the bond gate. Ordered deterministically.
 */
function candidates(ctx: InspoContext, found: ReadonlySet<string>): typeof EXACT_PATTERNS {
  const fams = new Set(favoredFamilies(ctx));
  const tier = maxTier(ctx.bond);
  return EXACT_PATTERNS.filter((p) => {
    const f = FORMS[p.result as FormId];
    if (f.tier > tier) return false;
    if (!fams.has(f.family)) return false;
    return !found.has(canonical(p));
  });
}

/** Reveal 2..4 cells of the pattern (the rest blank), chosen deterministically. */
function revealCells(rng: Rng, filled: number): number[] {
  const want = Math.min(filled, 2 + Math.floor(rng.next() * 3)); // 2..4
  const idx: number[] = [];
  for (let i = 0; i < 9; i++) idx.push(i);
  // Fisher–Yates with the seeded rng.
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, want).sort((a, b) => a - b);
}

/**
 * Roll an inspiration for the context, or null if nothing fires this tick.
 * `chance` is the per-eligible-tick probability (the game applies the cooldown
 * & pity timer around this — a forced roll passes chance = 1).
 */
export function rollInspiration(
  ctx: InspoContext,
  found: ReadonlySet<string>,
  alreadyHinted: ReadonlySet<string>,
  chance = 0.18,
): Hint | null {
  const rng = new Rng(ctxSeed(ctx));
  if (rng.next() >= chance) return null;

  const pool = candidates(ctx, found).filter((p) => !alreadyHinted.has(canonical(p)));
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(rng.next() * pool.length)];
  const key = canonical(pick);
  const revealed = revealCells(rng, filledCount({ cells: pick.cells, stacks: pick.stacks }));
  return {
    pattern: key,
    revealedCells: revealed,
    context: contextLine(ctx),
    day: String(dailySeed(ctx.date)),
  };
}

/** A short human "where/when/with-whom" line for the Notebook (§6). */
function contextLine(ctx: InspoContext): string {
  return `${ctx.zone} · ${ctx.weather} · ${ctx.season}`;
}
