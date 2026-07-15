/**
 * The Workshop bench — arrangement representation & canonicalization
 * (BUILDING_SYSTEM §3.2, §9).
 *
 * The 3×3 bench is read as an `Arrangement`: per cell, which MATERIAL GROUP
 * sits there (or null) and a STACK height 0..3. Two things resolve against it:
 * exact patterns (§3.2 step 1, authored treasures) and the shape grammar
 * (§3.2 step 2, the space-filling magic — see grammar.ts).
 *
 * Exact matching is invariant under the bench's *orientation-preserving*
 * symmetries — horizontal flip, vertical flip, and 180° rotation (the Klein
 * four-group V₄) — so the player isn't punished for building the same thing
 * mirrored or upside-down, but a ROW stays distinct from a COLUMN (§3.2: "a
 * row is not a column"). A quarter-turn would turn a beam into a post, which
 * the design treats as two different makes, so 90° rotations are deliberately
 * NOT in the group. `canonical()` returns the lexicographically-smallest of
 * the 4 transforms as the match key (§9 `PatternKey`). Pure & deterministic:
 * no randomness, no dates, stable forever.
 */

import type { MaterialGroup, MaterialId } from './materials';

/** 3×3, row-major (index 0..8 = row*3 + col). null = empty cell. */
export type Cells = readonly (MaterialGroup | null)[];
export type Stacks = readonly number[]; // 0..3 per cell

export interface Arrangement {
  /** Material GROUP per cell — what exact-match & shape grammar read. */
  readonly cells: Cells; // length 9
  readonly stacks: Stacks; // length 9
  /**
   * The actual MATERIAL placed per cell (when known — the live bench fills
   * this; authored patterns leave it undefined). The grammar uses it to pick
   * the produced item's material; matching uses only `cells`/`stacks` so a
   * pattern holds across every material of the right group.
   */
  readonly materials?: readonly (MaterialId | null)[]; // length 9
}

/** An authored signature recipe (§3.2 step 1). */
export interface ExactPattern {
  readonly cells: Cells;
  readonly stacks: Stacks;
  /** The form id this arrangement makes (resolved to a full item by material). */
  readonly result: string;
}

export const EMPTY: Arrangement = {
  cells: Array(9).fill(null),
  stacks: Array(9).fill(0),
};

/** Number of filled cells. */
export function filledCount(a: Arrangement): number {
  return a.cells.reduce((n, c) => n + (c ? 1 : 0), 0);
}

/** Total stack height across all cells (the bench "mass", §3.2). */
export function mass(a: Arrangement): number {
  return a.stacks.reduce((n, s) => n + s, 0);
}

/** True if no cell is filled. */
export function isEmpty(a: Arrangement): boolean {
  return filledCount(a) === 0;
}

// --- Symmetry group ----------------------------------------------------------

// The 4 orientation-preserving index permutations of a 3×3 grid (Klein V₄:
// identity, horizontal flip, vertical flip, 180° rotation). Each maps the
// OUTPUT cell index → the SOURCE cell index it reads from. 90° rotations are
// excluded on purpose so rows ≠ columns (§3.2).
const V4: readonly number[][] = buildV4();

function buildV4(): number[][] {
  const id = (r: number, c: number): number => r * 3 + c;
  const out: number[][] = [];
  // (fr, fc) flip flags → permutation.
  for (const [fr, fc] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ] as const) {
    const perm = new Array<number>(9);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) perm[id(r, c)] = id(fr ? 2 - r : r, fc ? 2 - c : c);
    out.push(perm);
  }
  return out;
}

/** Encode one (cells, stacks) pair as a comparable string. */
function encode(cells: Cells, stacks: Stacks): string {
  let s = '';
  for (let i = 0; i < 9; i++) s += (cells[i] ?? '_')[0] + String(stacks[i]);
  return s;
}

/**
 * Canonical key: the lexicographically smallest encoding over the 4 V₄
 * transforms. Same shape (modulo flip / 180°) AND same per-cell material group
 * + stack ⇒ same key; a row and a column get different keys. This is the
 * exact-match key of §9.
 */
export function canonical(a: Arrangement): string {
  let best: string | null = null;
  for (const perm of V4) {
    const cells = perm.map((src) => a.cells[src]);
    const stacks = perm.map((src) => a.stacks[src]);
    const enc = encode(cells, stacks);
    if (best === null || enc < best) best = enc;
  }
  return best!;
}

/** Convenience to build an Arrangement from a 3×3 of group/stack literals. */
export function arrangement(
  cells: readonly (MaterialGroup | null)[],
  stacks: readonly number[],
): Arrangement {
  if (cells.length !== 9 || stacks.length !== 9) throw new Error('arrangement must be 3×3');
  return { cells, stacks };
}
