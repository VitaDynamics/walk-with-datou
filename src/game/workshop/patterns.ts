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

export const PATTERNS_VERSION = 1;

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

  // --- For Datou & keepsakes (tier 1) ---------------------------------------
  // A garland: a sweeping arc of flowers.
  pat('garland', [P, _, _, _, P, _, _, _, P], [2, 0, 0, 0, 2, 0, 0, 0, 2]),
  // A small found+plant trinket → a collar charm.
  pat('collar-charm', [_, F, _, _, P, _, _, _, _], [0, 1, 0, 0, 1, 0, 0, 0, 0]),
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

  // --- Tools (§8.2 — discovered on the bench like everything else) ----------
  // A wedge head on a handle, edge out → an axe.
  pat('axe', [_, S, _, _, W, _, _, W, _], [0, 2, 0, 0, 1, 0, 0, 1, 0]),
  // A broad head crossing a handle → a pickaxe.
  pat('pickaxe', [S, _, S, _, W, _, _, W, _], [1, 0, 1, 0, 1, 0, 0, 1, 0]),
  // Two blades hinged → shears.
  pat('shears', [F, _, F, _, F, _, _, W, _], [1, 0, 1, 0, 1, 0, 0, 1, 0]),
  // A cupped head on a handle → a scoop.
  pat('scoop', [W, _, _, W, _, _, _, W, _], [1, 0, 0, 1, 0, 0, 0, 1, 0]),
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
