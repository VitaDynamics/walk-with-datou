/**
 * The Workshop — the live 3×3 bench (BUILDING_SYSTEM §3.1, §3.2).
 *
 * Holds what the player has dragged onto the bench: a material id and a stack
 * height (0..3) per cell. Derives the group `Arrangement` the matcher/grammar
 * read, resolves the outcome (exact pattern → grammar → curio), and reports
 * near-miss state for the amber-pulse feedback (§3.2).
 *
 * Pure logic, no DOM — the Workshop window drives it. Deterministic.
 */

import { canonical, filledCount, type Arrangement } from './pattern';
import { matchExact, patternKeys } from './patterns';
import { grammarResult, type GrammarResult } from './grammar';
import { groupOf, type MaterialId } from './materials';
import { accepts, finishesFor, itemId, sizesFor, type ItemId } from './items';
import type { FormId } from './forms';

export const MAX_STACK = 3;

export type Outcome =
  | { kind: 'exact'; form: FormId; id: ItemId; patternKey: string }
  | { kind: 'grammar'; id: ItemId }
  | { kind: 'curio'; tone: number }
  | { kind: 'empty' };

export class Bench {
  private readonly materials: (MaterialId | null)[] = Array(9).fill(null);
  private readonly stacks: number[] = Array(9).fill(0);

  cellMaterial(i: number): MaterialId | null {
    return this.materials[i];
  }

  cellStack(i: number): number {
    return this.stacks[i];
  }

  /** Place one of `mat` into cell `i`, stacking up to MAX_STACK. Returns false if full or mismatched. */
  place(i: number, mat: MaterialId): boolean {
    const cur = this.materials[i];
    if (cur && cur !== mat) return false; // a cell holds one material kind
    if (this.stacks[i] >= MAX_STACK) return false;
    this.materials[i] = mat;
    this.stacks[i] += 1;
    return true;
  }

  /** Remove one unit from cell `i`; returns the material removed (or null). */
  removeOne(i: number): MaterialId | null {
    if (this.stacks[i] <= 0) return null;
    const mat = this.materials[i];
    this.stacks[i] -= 1;
    if (this.stacks[i] === 0) this.materials[i] = null;
    return mat;
  }

  /** Clear the whole bench; returns the materials that were on it (to refund). */
  clear(): MaterialId[] {
    const out: MaterialId[] = [];
    for (let i = 0; i < 9; i++) {
      for (let s = 0; s < this.stacks[i]; s++) if (this.materials[i]) out.push(this.materials[i]!);
      this.materials[i] = null;
      this.stacks[i] = 0;
    }
    return out;
  }

  /** The group/stack arrangement the matcher & grammar read. */
  arrangement(): Arrangement {
    const cells = this.materials.map((m) => (m ? groupOf(m) : null));
    return { cells, stacks: this.stacks.slice(), materials: this.materials.slice() };
  }

  /** Resolve the current bench into an outcome (exact → grammar → curio). */
  resolve(): Outcome {
    const a = this.arrangement();
    if (filledCount(a) === 0) return { kind: 'empty' };
    const key = canonical(a);
    const exact = matchExact(key);
    if (exact) {
      const id = resolveExactItem(exact, a);
      if (id) return { kind: 'exact', form: exact, id, patternKey: key };
    }
    const g: GrammarResult = grammarResult(a);
    if (g.kind === 'curio') return { kind: 'curio', tone: g.tone };
    return { kind: 'grammar', id: g.id };
  }

  /**
   * Near-miss: is the current bench exactly ONE single-unit edit (add one to an
   * empty cell, or remove one unit) away from an unfound exact pattern? Used for
   * the amber pulse + Datou lean-in (§3.2). Cheap: ≤ ~18 probes × table lookup.
   */
  nearMiss(found: ReadonlySet<string>): boolean {
    const a = this.arrangement();
    if (filledCount(a) === 0) return false;
    const cur = canonical(a);
    const unfound = new Set(patternKeys().filter((k) => !found.has(k)));
    if (unfound.has(cur)) return false; // already on a (just-unfound) pattern
    for (const probe of oneEdits(this)) {
      if (unfound.has(probe)) return true;
    }
    return false;
  }
}

/**
 * Map an exact pattern's form result + the bench's dominant material to a full
 * ItemId. The pattern fixes the FORM; the material comes from the bench, sized
 * by mass and finished plain (exact makes read clean).
 */
function resolveExactItem(form: FormId, a: Arrangement): ItemId | null {
  // Heaviest-weighted material the form accepts.
  let bestMat: MaterialId | null = null;
  let best = -1;
  for (let i = 0; i < 9; i++) {
    const m = a.materials?.[i];
    if (!m || !accepts(form, m)) continue;
    const w = Math.max(1, a.stacks[i]);
    if (w > best) {
      best = w;
      bestMat = m;
    }
  }
  if (!bestMat) return null;
  const mass = a.stacks.reduce((n, s) => n + s, 0);
  const sizes = sizesFor(form);
  const size = sizes.length === 1 ? sizes[0] : mass <= 3 ? sizes[0] : mass <= 6 ? sizes[Math.min(1, sizes.length - 1)] : sizes[sizes.length - 1];
  const finish = finishesFor(form)[0];
  return itemId({ form, material: bestMat, size, finish });
}

/** Canonical keys for every single-unit edit of the bench (add to empty / remove one). */
function oneEdits(bench: Bench): string[] {
  const out: string[] = [];
  for (let i = 0; i < 9; i++) {
    const mat = bench.cellMaterial(i);
    const stack = bench.cellStack(i);
    // Remove one unit from a filled cell.
    if (stack > 0) {
      const probe = cloneArr(bench);
      probe.stacks[i] -= 1;
      if (probe.stacks[i] === 0) probe.materials[i] = null;
      out.push(canonicalOf(probe));
    }
    // Add one unit (matching material if present, else try each group rep via existing materials on the bench).
    if (stack < MAX_STACK) {
      const fill = mat ?? firstMaterialOnBench(bench);
      if (fill) {
        const probe = cloneArr(bench);
        probe.materials[i] = fill;
        probe.stacks[i] = Math.max(1, stack + 1);
        out.push(canonicalOf(probe));
      }
    }
  }
  return out;
}

interface RawArr {
  materials: (MaterialId | null)[];
  stacks: number[];
}

function cloneArr(bench: Bench): RawArr {
  const materials: (MaterialId | null)[] = [];
  const stacks: number[] = [];
  for (let i = 0; i < 9; i++) {
    materials.push(bench.cellMaterial(i));
    stacks.push(bench.cellStack(i));
  }
  return { materials, stacks };
}

function canonicalOf(raw: RawArr): string {
  return canonical({
    cells: raw.materials.map((m) => (m ? groupOf(m) : null)),
    stacks: raw.stacks,
    materials: raw.materials,
  });
}

function firstMaterialOnBench(bench: Bench): MaterialId | null {
  for (let i = 0; i < 9; i++) {
    const m = bench.cellMaterial(i);
    if (m) return m;
  }
  return null;
}
