/**
 * The Workshop — exact-pattern table (BUILDING_SYSTEM §3.2 step 1, §4).
 *
 * The authored treasures: specific 3×3 shapes + material groups → a specific
 * FORM. Everything else falls through to the shape grammar (grammar.ts), so
 * these are the discoveries worth finding, not the only way to make things.
 *
 * Each pattern "looks like the thing" (authoring template §2.4): a row of wood
 * is a beam, a column a post, a ring of stone a firepit, a cross of reed a
 * chime. They are matched modulo rotation+mirror via `canonical()` — so a row
 * and a column are DISTINCT (rotation of a 3-in-a-row is still a line, but the
 * grammar reads orientation), while the same shape mirrored is the same
 * pattern. We assert table uniqueness in tests.
 *
 * `PATTERNS_VERSION` bumps when the table changes; saves carry it so found
 * knowledge never invalidates (§9).
 */

import { canonical, type ExactPattern } from './pattern';
import type { FormId } from './forms';

export const PATTERNS_VERSION = 3;

const W = 'wood';
const S = 'stone';
const P = 'plant';
const F = 'found';
const _ = null;

/**
 * Authored patterns. `result` must be a real FormId. Cells use group literals;
 * stacks 1..3 (heavier = bigger size via the grammar's size read downstream).
 *
 * Ordered roughly tier 1 → 3 for readability; order does not affect matching.
 */
export const EXACT_PATTERNS: readonly ExactPattern[] = [
  // --- Components (tier 1–2) ------------------------------------------------
  // A row of wood lying flat → a beam.
  pat('beam', [_, _, _, W, W, W, _, _, _], [0, 0, 0, 2, 2, 2, 0, 0, 0]),
  // A column of wood standing up → a post.
  pat('post', [_, W, _, _, W, _, _, W, _], [0, 2, 0, 0, 2, 0, 0, 2, 0]),
  // A 2×2 block of wood → a panel.
  pat('panel', [W, W, _, W, W, _, _, _, _], [1, 1, 0, 1, 1, 0, 0, 0, 0]),
  // Three plant strands twisted → a cord.
  pat('cord', [P, P, P, _, _, _, _, _, _], [1, 1, 1, 0, 0, 0, 0, 0, 0]),
  // A loop of plant → a ring.
  pat('ring', [_, P, _, P, _, P, _, P, _], [1, 1, 1, 1, 0, 1, 1, 1, 1]),
  // A heaped pile of stone → a block.
  pat('block', [_, _, _, S, S, S, S, S, S], [0, 0, 0, 2, 3, 2, 3, 3, 3]),
  // A hollow of stone → a vessel.
  pat('vessel', [S, _, S, S, _, S, S, S, S], [1, 0, 1, 1, 0, 1, 1, 1, 1]),

  // --- Furnishings (tier 2) -------------------------------------------------
  // Two legs under a flat top → a bench.
  pat('bench', [_, _, _, W, W, W, W, _, W], [0, 0, 0, 1, 1, 1, 2, 0, 2]),
  // A taller four-legged top → a table.
  pat('table', [W, W, W, _, _, _, W, _, W], [1, 1, 1, 0, 0, 0, 2, 0, 2]),
  // A single seat on legs → a stool.
  pat('stool', [_, W, _, W, _, W, _, _, _], [0, 1, 0, 2, 0, 2, 0, 0, 0]),
  // A ring of stone around an empty center → a firepit / campfire base.
  pat('campfire', [S, S, S, S, _, S, S, S, S], [1, 1, 1, 1, 0, 1, 1, 1, 1]),
  // A post with a warm top → a lamp.
  pat('lamp', [_, F, _, _, W, _, _, W, _], [0, 2, 0, 0, 1, 0, 0, 2, 0]),
  // A hanging cross of plant with a center → a chime.
  pat('chime', [_, P, _, P, F, P, _, P, _], [0, 1, 0, 1, 1, 1, 0, 1, 0]),
  // A low woven bed → a mat.
  pat('mat', [_, _, _, P, P, P, _, _, _], [0, 0, 0, 1, 1, 1, 0, 0, 0]),
  // A stone bowl on a foot → a birdbath.
  pat('birdbath', [_, S, _, S, S, S, _, S, _], [0, 1, 0, 1, 1, 1, 0, 2, 0]),
  // A frame of wood holding earth → a planter.
  pat('planter', [W, _, W, W, P, W, W, W, W], [1, 0, 1, 1, 1, 1, 1, 1, 1]),
  // A lattice of wood → a trellis.
  pat('trellis', [W, _, W, _, W, _, W, _, W], [1, 0, 1, 0, 1, 0, 1, 0, 1]),
  // A flat run of stone → a path tile.
  pat('path-tile', [S, S, S, _, _, _, _, _, _], [2, 2, 2, 0, 0, 0, 0, 0, 0]),
  // A board on a post → a sign.
  pat('sign', [W, W, W, _, W, _, _, W, _], [1, 1, 1, 0, 2, 0, 0, 2, 0]),
  // A woven open basket → a basket.
  pat('basket', [P, _, P, P, _, P, P, P, P], [1, 0, 1, 1, 0, 1, 1, 1, 1]),
  // A lidded box with a small found latch → a cache box.
  pat('cache-box', [W, W, W, W, F, W, _, W, _], [1, 1, 1, 1, 1, 1, 0, 2, 0]),
  // A low open stone curve → a drinking bowl.
  pat('drinking-bowl', [S, _, S, S, S, S, _, _, _], [1, 0, 1, 2, 1, 2, 0, 0, 0]),
  // A timber frame divided into plant-filled nesting rooms → a bug hotel.
  pat('bug-hotel', [W, W, W, W, P, W, _, P, _], [1, 1, 1, 2, 1, 2, 0, 1, 0]),
  // A little clay pot holding one living sprout.
  pat('sprout-pot', [_, P, _, S, S, S, _, _, _], [0, 1, 0, 1, 2, 1, 0, 0, 0]),
  // A roofed letter box on a wooden post.
  pat('mailbox', [W, W, _, _, F, _, _, W, _], [1, 1, 0, 0, 1, 0, 0, 2, 0]),
  // A mushroom cap gathered around a small found-light center.
  pat('mushroom-lamp', [P, P, P, _, F, _, _, W, _], [1, 2, 1, 0, 1, 0, 0, 2, 0]),
  // A padded nest with an open center for Datou to curl into.
  pat('pet-bed', [P, P, P, P, _, P, _, P, _], [1, 1, 1, 1, 0, 1, 0, 1, 0]),
  // A shallow ceramic bowl prepared for a meal.
  pat('food-bowl', [_, _, _, S, _, S, _, S, S], [0, 0, 0, 1, 0, 1, 0, 2, 2]),
  // A stone cap and window carried by a squat pedestal.
  pat('garden-lantern', [S, S, S, S, F, S, _, S, _], [1, 1, 1, 1, 1, 1, 0, 2, 0]),
  // A compartmented wooden chest with seeds tucked inside.
  pat('seed-chest', [W, P, W, W, _, W, W, _, W], [1, 1, 1, 1, 0, 1, 2, 0, 2]),
  // A small toy body with found joints and a repaired wooden foot.
  pat('repair-toy', [F, W, F, _, F, _, W, _, W], [1, 1, 1, 0, 2, 0, 1, 0, 1]),

  // --- Interactive park keepsakes (the eight code-cutout items, tier 2) ------
  // A fired-clay vessel cradled in a paste collar on a wood foot → steam-rest.
  pat('steam-rest', [_, P, _, P, F, P, _, W, _], [0, 1, 0, 1, 1, 1, 0, 1, 0]),
  // A wide stone carcass with plant nose-tabs under a wood lid → nose-puzzle.
  pat('nose-puzzle-drawer', [_, W, _, P, S, P, _, _, _], [0, 1, 0, 1, 2, 1, 0, 0, 0]),
  // A low plank spine spread with water wells → paw-rinse-step.
  pat('paw-rinse-step', [_, W, _, P, P, P, W, _, W], [0, 1, 0, 1, 2, 1, 1, 0, 1]),
  // A glass water globe over a squat clay tripod → moonwater-lamp.
  pat('moonwater-lamp', [_, W, _, P, W, P, P, P, P], [0, 1, 0, 1, 1, 1, 2, 1, 2]),
  // An F-flanked woven grid on a stick leg → bird-nesting-fiber-frame.
  pat('bird-nesting-fiber-frame', [F, P, F, P, P, P, _, S, _], [1, 1, 1, 1, 2, 1, 0, 1, 0]),
  // A paper disc with a sage glyph ring on a wood easel → weather-log-wheel.
  pat('weather-log-wheel', [_, P, _, S, P, S, _, W, _], [0, 1, 0, 1, 1, 1, 0, 1, 0]),
  // A cross-braced sage wheel on a clay foot → spin-choice-wheel.
  pat('spin-choice-wheel', [_, P, _, W, S, W, _, F, _], [0, 1, 0, 1, 2, 1, 0, 1, 0]),
  // A found lid over a soft pad in a heavy stone round → shared-snack-tin.
  pat('shared-snack-tin', [_, F, _, S, P, S, _, S, _], [0, 1, 0, 2, 1, 2, 0, 2, 0]),

  // --- For Datou & keepsakes (tier 1) ---------------------------------------
  // A garland: a sweeping arc of flowers.
  pat('garland', [P, _, _, _, P, _, _, _, P], [2, 0, 0, 0, 2, 0, 0, 0, 2]),
  // A small found+plant trinket → a collar charm.
  pat('collar-charm', [_, F, _, _, P, _, _, _, _], [0, 1, 0, 0, 1, 0, 0, 0, 0]),
  // Four wrapped plant pads → a soft play ball.
  pat('play-ball', [_, P, _, P, _, P, _, P, _], [0, 2, 0, 2, 0, 2, 0, 2, 0]),
  // A balanced stack of stones → a cairn.
  pat('cairn', [_, _, _, _, S, _, _, S, _], [0, 0, 0, 0, 1, 0, 0, 2, 0]),
  // Two twigs lashed → the fetch stick.
  pat('stick', [_, _, _, W, W, _, _, _, _], [0, 0, 0, 1, 1, 0, 0, 0, 0]),
  // A wood frame around a center → a memory frame.
  pat('memory-frame', [W, W, W, W, _, W, W, W, W], [1, 1, 1, 1, 0, 1, 1, 1, 1]),

  // --- Structures (tier 3, consume heavier stock) ---------------------------
  // A gabled body with a roof peak → a shelter.
  pat('shelter', [_, W, _, W, W, W, W, W, W], [0, 2, 0, 1, 1, 1, 2, 1, 2]),
  // Two posts and an arch → an archway.
  pat('archway', [W, W, W, W, _, W, W, _, W], [1, 1, 1, 2, 0, 2, 2, 0, 2]),
  // Posts holding a flat lattice overhead → a pergola.
  pat('pergola', [W, W, W, W, _, W, _, _, _], [2, 2, 2, 3, 0, 3, 0, 0, 0]),
  // A long flat span of plank → a bridge.
  pat('bridge-plank', [_, _, _, W, W, W, _, _, _], [0, 0, 0, 3, 3, 3, 0, 0, 0]),
  // A raised platform on a tall post → a lookout perch.
  pat('lookout-perch', [W, W, W, _, W, _, _, W, _], [2, 2, 2, 0, 3, 0, 0, 3, 0]),
  // A ring of stone with an upright center → a shrine.
  pat('shrine', [S, S, S, S, W, S, _, S, _], [1, 1, 1, 1, 2, 1, 0, 1, 0]),
  // A deep stone shaft with a frame → a well.
  pat('well', [S, S, S, S, _, S, S, S, S], [2, 1, 2, 1, 0, 1, 2, 2, 2]),
  // A glazed box over earth → a cold-frame.
  pat('cold-frame', [S, S, S, W, P, W, W, W, W], [1, 1, 1, 2, 1, 2, 1, 1, 1]),
  // A bound deck of wood → a small lake raft.
  pat('raft', [_, P, _, W, W, W, W, W, W], [0, 2, 0, 1, 1, 1, 2, 2, 2]),

  // --- Tools (§8.2 — discovered on the bench like everything else) ----------
  // A wedge head on a handle, edge out → an axe.
  pat('axe', [_, S, _, _, W, _, _, W, _], [0, 2, 0, 0, 1, 0, 0, 1, 0]),
  // A broad head crossing a handle → a pickaxe.
  pat('pickaxe', [S, _, S, _, W, _, _, W, _], [1, 0, 1, 0, 1, 0, 0, 1, 0]),
  // Two blades hinged → shears.
  pat('shears', [F, _, F, _, F, _, _, W, _], [1, 0, 1, 0, 1, 0, 0, 1, 0]),
  // A cupped head on a handle → a scoop.
  pat('scoop', [W, _, _, W, _, _, _, W, _], [1, 0, 0, 1, 0, 0, 0, 1, 0]),
  // Soft bristles bound to a short handle → a brush.
  pat('brush', [_, P, _, _, W, _, _, _, _], [0, 1, 0, 0, 2, 0, 0, 0, 0]),
  // A short cardinal pointer around a weighted center → a wayfinder.
  pat('wayfinder', [_, F, _, S, F, S, _, _, _], [0, 1, 0, 1, 2, 1, 0, 0, 0]),
  // Two lenses joined by a light tube → a field glass.
  pat('field-glass', [F, _, _, _, W, _, _, _, F], [1, 0, 0, 0, 2, 0, 0, 0, 1]),

  // --- Second signatures (W7 density pass) ----------------------------------
  // Alternate, still-readable recipes — a heavier build, a different material
  // grain, a mirrored emphasis — so a form has more than one path to discover
  // and the exact space rewards experimentation. All distinct under V₄.

  // Components — heavier / alternate grains.
  pat('post', [_, W, _, _, W, _, _, W, _], [0, 3, 0, 0, 3, 0, 0, 3, 0]), // a tall post
  pat('cord', [P, P, P, _, _, _, _, _, _], [2, 2, 2, 0, 0, 0, 0, 0, 0]), // a thick rope
  pat('ring', [_, W, _, W, _, W, _, W, _], [0, 1, 0, 1, 0, 1, 0, 1, 0]), // a wood ring
  pat('vessel', [F, _, F, F, _, F, F, F, F], [1, 0, 1, 1, 0, 1, 1, 1, 1]), // a found-metal vessel
  pat('block', [S, S, S, S, S, S, S, S, S], [2, 2, 2, 2, 2, 2, 2, 2, 2]), // a full quarry block
  pat('wheel', [_, W, _, W, F, W, _, W, _], [0, 1, 0, 1, 1, 1, 0, 1, 0]), // spoked wheel

  // Furnishings — sizes / materials.
  pat('bench', [_, _, _, S, S, S, S, _, S], [0, 0, 0, 1, 1, 1, 2, 0, 2]), // a stone bench
  pat('stool', [_, S, _, S, _, S, _, _, _], [0, 1, 0, 2, 0, 2, 0, 0, 0]), // a stone stool
  pat('table', [W, W, W, _, _, _, W, _, W], [2, 2, 2, 0, 0, 0, 3, 0, 3]), // a big table
  pat('lamp', [_, F, _, _, W, _, _, W, _], [0, 3, 0, 0, 2, 0, 0, 3, 0]), // a tall lamp
  pat('lantern', [_, P, _, P, F, P, _, W, _], [0, 1, 0, 1, 1, 1, 0, 2, 0]), // a woven lantern
  pat('gate', [W, W, W, W, _, W, W, _, W], [2, 2, 2, 1, 0, 1, 2, 0, 2]), // a heavier gate
  pat('trellis', [P, _, P, _, P, _, P, _, P], [1, 0, 1, 0, 1, 0, 1, 0, 1]), // a reed trellis
  pat('planter', [S, _, S, S, P, S, S, S, S], [1, 0, 1, 1, 1, 1, 1, 1, 1]), // a stone planter
  pat('basket', [W, _, W, W, _, W, W, W, W], [1, 0, 1, 1, 0, 1, 1, 1, 1]), // a wood basket
  pat('mat', [_, _, _, P, P, P, _, _, _], [0, 0, 0, 2, 2, 2, 0, 0, 0]), // a thick mat
  pat('mobile', [_, F, _, F, _, F, _, P, _], [0, 1, 0, 1, 0, 1, 0, 1, 0]), // a hanging mobile
  pat('birdbath', [_, S, _, S, S, S, _, S, _], [0, 1, 0, 1, 1, 1, 0, 3, 0]), // a tall birdbath

  // Datou & keepsakes — alternates.
  pat('collar-charm', [_, F, _, _, F, _, _, _, _], [0, 1, 0, 0, 1, 0, 0, 0, 0]), // a metal charm
  pat('cairn', [_, _, _, _, S, _, _, S, _], [0, 0, 0, 0, 2, 0, 0, 3, 0]), // a tall cairn
  pat('memory-frame', [W, W, W, W, _, W, W, W, W], [2, 2, 2, 2, 0, 2, 2, 2, 2]), // a deep frame
  pat('postcard-stand', [_, W, _, _, W, _, W, W, W], [0, 1, 0, 0, 1, 0, 1, 1, 1]), // a stand
  pat('wind-vane', [_, F, _, _, F, _, _, W, _], [0, 2, 0, 0, 1, 0, 0, 2, 0]), // a found-metal vane
  pat('music-post', [_, F, _, _, W, _, _, W, _], [0, 1, 0, 0, 2, 0, 0, 2, 0]), // a music post

  // Structures — heavier / stone readings.
  pat('shelter', [_, S, _, S, S, S, S, S, S], [0, 2, 0, 1, 1, 1, 2, 1, 2]), // a stone shelter
  pat('archway', [S, S, S, S, _, S, S, _, S], [1, 1, 1, 2, 0, 2, 2, 0, 2]), // a stone arch
  pat('pergola', [W, W, W, W, _, W, _, _, _], [3, 3, 3, 2, 0, 2, 0, 0, 0]), // a grand pergola
  pat('lookout-perch', [W, W, W, _, W, _, _, W, _], [3, 3, 3, 0, 2, 0, 0, 2, 0]), // a low perch
  pat('well', [S, S, S, S, _, S, S, S, S], [3, 1, 3, 1, 0, 1, 3, 3, 3]), // a deep stone well
  pat('shrine', [W, W, W, W, S, W, _, W, _], [1, 1, 1, 1, 2, 1, 0, 1, 0]), // a wood shrine
  pat('cold-frame', [W, W, W, S, P, S, S, S, S], [1, 1, 1, 2, 1, 2, 1, 1, 1]), // a framed cold-frame
];

function pat(result: FormId, cells: ExactPattern['cells'], stacks: number[]): ExactPattern {
  return { result, cells, stacks };
}

/** Lookup table: canonical key → form result. Built once, deterministic. */
const TABLE: ReadonlyMap<string, FormId> = (() => {
  const m = new Map<string, FormId>();
  for (const p of EXACT_PATTERNS) m.set(canonical(p), p.result as FormId);
  return m;
})();

/** Exact-match a bench arrangement → form result, or null to fall through. */
export function matchExact(key: string): FormId | null {
  return TABLE.get(key) ?? null;
}

/** All canonical keys in the table (for near-miss search, §3.2). */
export function patternKeys(): string[] {
  return [...TABLE.keys()];
}

/** The authored pattern for a canonical key (first one that matches it). */
const BY_KEY: ReadonlyMap<string, ExactPattern> = (() => {
  const m = new Map<string, ExactPattern>();
  for (const p of EXACT_PATTERNS) {
    const k = canonical(p);
    if (!m.has(k)) m.set(k, p);
  }
  return m;
})();

export function patternByKey(key: string): ExactPattern | null {
  return BY_KEY.get(key) ?? null;
}

/** A readable recipe: how many filled cells of each material group a pattern wants. */
export function patternRecipe(
  p: ExactPattern,
): Partial<Record<'wood' | 'stone' | 'plant' | 'found', number>> {
  const need: Record<string, number> = {};
  for (let i = 0; i < 9; i++) {
    const g = p.cells[i];
    if (!g) continue;
    need[g] = (need[g] ?? 0) + Math.max(1, p.stacks[i]);
  }
  return need;
}

/** First authored pattern that yields a given form (for Tree-tab recipes). */
export function patternForForm(form: FormId): ExactPattern | null {
  return EXACT_PATTERNS.find((p) => p.result === form) ?? null;
}
