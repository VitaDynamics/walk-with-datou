/**
 * Crafting — a small, warm recipe book. Nothing industrial: toys and
 * keepsakes that feed the companionship loop (a stick to throw, a cairn to
 * mark a walk, a garland Datou can wear, a lantern for a favourite corner).
 */

import type { Backpack, CraftedId, ResourceId } from './Backpack';

export interface Recipe {
  id: CraftedId;
  needs: Partial<Record<ResourceId, number>>;
  /** What you can do with the result. */
  use: 'throw' | 'place' | 'wear';
}

export const RECIPES: readonly Recipe[] = [
  { id: 'stick', needs: { twig: 2 }, use: 'throw' },
  { id: 'cairn', needs: { pebble: 3 }, use: 'place' },
  { id: 'garland', needs: { flower: 3 }, use: 'wear' },
  { id: 'lantern', needs: { twig: 2, pinecone: 1 }, use: 'place' },
];

export function recipe(id: CraftedId): Recipe {
  return RECIPES.find((r) => r.id === id)!;
}

export function canCraft(r: Recipe, pack: Backpack): boolean {
  return Object.entries(r.needs).every(([res, n]) => pack.count(res as ResourceId) >= n);
}

/** Consume ingredients and add the result. Returns false if short. */
export function craft(r: Recipe, pack: Backpack): boolean {
  if (!canCraft(r, pack)) return false;
  for (const [res, n] of Object.entries(r.needs)) pack.take(res as ResourceId, n);
  pack.add(r.id);
  return true;
}
