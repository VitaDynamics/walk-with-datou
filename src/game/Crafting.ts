/**
 * Legacy item registry. The Workshop bench (src/game/workshop/) is THE
 * crafting system; this table survives only to describe the legacy crafted
 * ids that can still sit in a pack — which verb each one answers to ("Place",
 * "Wear", "Throw") and what it once cost. No crafting happens here anymore.
 */

import type { CraftedId, ItemId } from './Backpack';

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

