/**
 * Crafting — the building tree.
 *
 * Three tiers, Don't Starve-style but warm: raw finds become COMPONENTS
 * (bundles of twigs, piles of stones), components become FURNISHINGS for the
 * home (fences, lanterns, a campfire, a garden plot…), and furnishings-grade
 * parts combine into STRUCTURES (Datou's shelter, an archway). Everything you
 * make either goes back into play (the fetch stick), onto Datou (the
 * garland), or INTO THE WORLD — the home grows out of what the two of you
 * found on walks ("the relationship and the space are co-transformed").
 */

import type { Backpack, CraftedId, ItemId } from './Backpack';

export type RecipeUse = 'throw' | 'place' | 'wear' | 'component';

export interface Recipe {
  id: CraftedId;
  /** Ingredients — resources OR crafted components (this makes it a tree). */
  needs: Partial<Record<ItemId, number>>;
  use: RecipeUse;
  /** 1 = components · 2 = furnishings · 3 = structures. */
  tier: 1 | 2 | 3;
}

export const RECIPES: readonly Recipe[] = [
  // Tier 1 — components & keepsakes straight from the ground.
  { id: 'bundle', needs: { twig: 3 }, use: 'component', tier: 1 },
  { id: 'stonepile', needs: { pebble: 3 }, use: 'component', tier: 1 },
  { id: 'stick', needs: { twig: 2 }, use: 'throw', tier: 1 },
  { id: 'garland', needs: { flower: 3 }, use: 'wear', tier: 1 },
  // Tier 2 — furnishings for the home and the trail.
  { id: 'fence', needs: { bundle: 1 }, use: 'place', tier: 2 },
  { id: 'cairn', needs: { stonepile: 1 }, use: 'place', tier: 2 },
  { id: 'lantern', needs: { bundle: 1, pinecone: 1 }, use: 'place', tier: 2 },
  { id: 'campfire', needs: { bundle: 1, stonepile: 1 }, use: 'place', tier: 2 },
  { id: 'plot', needs: { bundle: 1, stonepile: 1 }, use: 'place', tier: 2 },
  { id: 'bench', needs: { bundle: 2 }, use: 'place', tier: 2 },
  { id: 'birdbath', needs: { stonepile: 2 }, use: 'place', tier: 2 },
  { id: 'windchime', needs: { stick: 1, pinecone: 1, flower: 1 }, use: 'place', tier: 2 },
  // Tier 3 — structures (the big keepsakes).
  { id: 'shelter', needs: { bundle: 2, stonepile: 1, pinecone: 1 }, use: 'place', tier: 3 },
  { id: 'archway', needs: { bundle: 2, stonepile: 1 }, use: 'place', tier: 3 },
];

export function recipe(id: CraftedId): Recipe {
  return RECIPES.find((r) => r.id === id)!;
}

export function canCraft(r: Recipe, pack: Backpack): boolean {
  return Object.entries(r.needs).every(([id, n]) => pack.count(id as ItemId) >= n);
}

/** Consume ingredients and add the result. Returns false if short. */
export function craft(r: Recipe, pack: Backpack): boolean {
  if (!canCraft(r, pack)) return false;
  for (const [id, n] of Object.entries(r.needs)) pack.take(id as ItemId, n);
  pack.add(r.id);
  return true;
}
