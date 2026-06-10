/**
 * The Workshop — shape grammar (BUILDING_SYSTEM §3.2 step 2 & 3).
 *
 * The magic that fills the 1 000-item space: when no exact pattern matches, the
 * bench still produces SOMETHING from the arrangement's readable structure, so
 * experimentation is never punished. Pure function of the bench state:
 *
 *     GrammarResult = f(shapeClass, dominantMaterial, mass)        // §9
 *
 * - `shapeClass` (row/column/L/T/cross/ring/block/diagonal/scatter) → a FORM
 *   FAMILY then a concrete form;
 * - `dominantMaterial` → the item's material (its group must be accepted by the
 *   chosen form; we pick the best-fitting form for that group);
 * - `mass` (total stack height) → SIZE (light→S, heavy→L);
 * - a secondary material → FINISH (flowers/blossom-y plant → blossom; a second
 *   group present → banded).
 *
 * A truly unreadable scatter fizzles into a CURIO (§3.2 step 3) — a tiny
 * collectible, never nothing. Deterministic: no randomness, no dates.
 */

import {
  accepts,
  finishesFor,
  isValid,
  itemId,
  sizesFor,
  type ItemId,
  type ItemSpec,
} from './items';
import { FORM_IDS, form as formDef, type FormId, type FormFamily, type Finish, type Size } from './forms';
import { groupOf, type MaterialGroup, type MaterialId } from './materials';
import { filledCount, mass, type Arrangement } from './pattern';

export type ShapeClass =
  | 'row'
  | 'column'
  | 'L'
  | 'T'
  | 'cross'
  | 'ring'
  | 'block'
  | 'diagonal'
  | 'scatter';

export type GrammarResult =
  | { kind: 'item'; id: ItemId; spec: ItemSpec }
  | { kind: 'curio'; tone: number };

// --- Shape classification ----------------------------------------------------

const ROWS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
];
const COLS = [
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
];
const DIAGS = [
  [0, 4, 8],
  [2, 4, 6],
];
const RING = [0, 1, 2, 3, 5, 6, 7, 8]; // all but center
const CROSS = [1, 3, 5, 7]; // plus arms
const CENTER = 4;

function filled(a: Arrangement): boolean[] {
  return a.cells.map((c) => c !== null);
}

/**
 * Read the arrangement's dominant geometry. Order matters: more specific shapes
 * are tested before looser ones, so a clean ring isn't misread as scatter.
 */
export function classify(a: Arrangement): ShapeClass {
  const f = filled(a);
  const n = f.filter(Boolean).length;
  if (n === 0) return 'scatter';

  const allOf = (idx: number[]): boolean => idx.every((i) => f[i]);
  const noneOf = (idx: number[]): boolean => idx.every((i) => !f[i]);
  const countOf = (idx: number[]): number => idx.filter((i) => f[i]).length;

  // Ring: the 8-border filled, center empty.
  if (allOf(RING) && !f[CENTER]) return 'ring';
  // Block: a full 2×2 (any corner).
  for (const q of [
    [0, 1, 3, 4],
    [1, 2, 4, 5],
    [3, 4, 6, 7],
    [4, 5, 7, 8],
  ]) {
    if (allOf(q)) return 'block';
  }
  // Cross / plus: center + all four edge-mid arms, corners empty.
  if (f[CENTER] && allOf(CROSS) && noneOf([0, 2, 6, 8])) return 'cross';

  // Clean straight line — exactly the 3 cells of one row/column, nothing else.
  for (const line of ROWS) if (n === 3 && allOf(line)) return 'row';
  for (const line of COLS) if (n === 3 && allOf(line)) return 'column';

  // T: a full edge row/col (3 cells) plus a perpendicular stem from its center
  // that points into the grid (cells NOT on the line). 4–5 cells total.
  if (n >= 4 && n <= 5) {
    const stems: Array<[number[], number[]]> = [
      [ROWS[0], [4, 7]], // top edge → stem down through center
      [ROWS[2], [1, 4]], // bottom edge → stem up
      [COLS[0], [4, 5]], // left edge → stem right
      [COLS[2], [3, 4]], // right edge → stem left
    ];
    for (const [line, stem] of stems) {
      if (allOf(line) && countOf(stem) >= 1) return 'T';
    }
  }

  // L: two perpendicular arms (≥2 each) meeting at a corner; small footprint.
  if (n <= 5) {
    for (const corner of [0, 2, 6, 8]) {
      if (!f[corner]) continue;
      const r = Math.floor(corner / 3);
      const c = corner % 3;
      if (countOf(ROWS[r]) >= 2 && countOf(COLS[c]) >= 2) return 'L';
    }
  }

  // Diagonal: a thin diagonal streak.
  for (const d of DIAGS) if (countOf(d) >= 2 && n <= 3) return 'diagonal';

  // Loose lean: predominantly horizontal or vertical.
  const bestRow = Math.max(...ROWS.map(countOf));
  const bestCol = Math.max(...COLS.map(countOf));
  if (bestRow >= 2 && bestRow > bestCol) return 'row';
  if (bestCol >= 2 && bestCol > bestRow) return 'column';
  return 'scatter';
}

// --- Material reads -----------------------------------------------------------

/** The material that appears most (by stacked weight), and the runner-up group. */
export function dominantMaterial(a: Arrangement): {
  material: MaterialId | null;
  secondaryGroup: MaterialGroup | null;
} {
  const weight = new Map<MaterialId, number>();
  const groupWeight = new Map<MaterialGroup, number>();
  for (let i = 0; i < 9; i++) {
    const g = a.cells[i];
    if (!g) continue;
    // cells store GROUPS on the bench; the dominant *material* is decided by
    // the actual placed materials, threaded via `a.materials` when present.
    const m = a.materials?.[i] ?? null;
    if (m) weight.set(m, (weight.get(m) ?? 0) + Math.max(1, a.stacks[i]));
    groupWeight.set(g, (groupWeight.get(g) ?? 0) + Math.max(1, a.stacks[i]));
  }
  let material: MaterialId | null = null;
  let best = -1;
  for (const [m, w] of weight) {
    if (w > best) {
      best = w;
      material = m;
    }
  }

  const sortedGroups = [...groupWeight.entries()].sort((x, y) => y[1] - x[1]);
  const primaryGroup = material ? groupOf(material) : (sortedGroups[0]?.[0] ?? null);
  const secondaryGroup = sortedGroups.find(([g]) => g !== primaryGroup)?.[0] ?? null;
  return { material, secondaryGroup };
}

// --- Shape → family → form ----------------------------------------------------

/** Which form families a shape class evokes (BUILDING_SYSTEM §3.2). */
const SHAPE_FAMILY: Record<ShapeClass, FormFamily[]> = {
  row: ['furnishing', 'component'],
  column: ['component', 'structure'],
  L: ['furnishing', 'datou'],
  T: ['furnishing', 'keepsake'],
  cross: ['furnishing', 'keepsake'],
  ring: ['furnishing', 'structure'],
  block: ['structure', 'component'],
  diagonal: ['component', 'tool'],
  scatter: ['keepsake', 'component'],
};

function sizeFromMass(m: number): Size {
  if (m <= 2) return 'S';
  if (m <= 5) return 'M';
  return 'L';
}

function finishFromSecondary(secondary: MaterialGroup | null): Finish {
  if (secondary === 'plant') return 'blossom';
  if (secondary) return 'banded';
  return 'plain';
}

/**
 * Pick the form for a (shapeClass, material) read: the first form, in registry
 * order, whose family the shape evokes AND that accepts the material's group.
 * Registry order makes this deterministic and gives lower-tier forms priority
 * (they come first), which suits the "any try yields something sensible" goal.
 */
function pickForm(shape: ShapeClass, material: MaterialId): FormId | null {
  const families = SHAPE_FAMILY[shape];
  for (const fam of families) {
    for (const id of FORM_IDS) {
      const f = formDef(id);
      if (f.family === fam && accepts(id, material) && f.use !== 'tool') return id;
    }
  }
  // Fallback: any form that accepts the material at all.
  for (const id of FORM_IDS) {
    const f = formDef(id);
    if (accepts(id, material) && f.use !== 'tool') return id;
  }
  return null;
}

/** Snap a size/finish into the form's supported range. */
function snapSpec(form: FormId, material: MaterialId, size: Size, finish: Finish): ItemSpec {
  const sizes = sizesFor(form);
  const finishes = finishesFor(form);
  const s = sizes.includes(size) ? size : sizes[sizes.length === 1 ? 0 : Math.min(1, sizes.length - 1)];
  const fin = finishes.includes(finish) ? finish : 'plain';
  return { form, material, size: s, finish: fin };
}

/**
 * Resolve an arrangement that did NOT match an exact pattern into a grammar
 * item — or a curio if it's an unreadable scatter (§3.2 step 3).
 */
export function grammarResult(a: Arrangement): GrammarResult {
  const n = filledCount(a);
  const { material, secondaryGroup } = dominantMaterial(a);

  // Fizzle: too sparse / no real material to read → a small curio (a win,
  // with a wink). Tone is a deterministic flavor index for the curio sprite.
  if (n === 0 || !material) {
    return { kind: 'curio', tone: (mass(a) * 7 + n * 3) % 5 };
  }

  const shape = classify(a);
  const form = pickForm(shape, material);
  if (!form) return { kind: 'curio', tone: (mass(a) * 7 + n * 3) % 5 };

  const spec = snapSpec(
    form,
    material,
    sizeFromMass(mass(a)),
    finishFromSecondary(secondaryGroup),
  );
  // Guard: the snapped spec must be valid (form accepts material, size/finish
  // in range). pickForm already ensures material acceptance, so this holds; we
  // keep the check so a future table edit can't silently emit a bad id.
  if (!isValid(spec)) return { kind: 'curio', tone: (mass(a) * 7 + n * 3) % 5 };
  return { kind: 'item', id: itemId(spec), spec };
}
