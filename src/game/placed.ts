/**
 * Placed keepsakes — the pure model behind the reversible place verb.
 *
 * A made item is an object you hold; a placed item is that same object set
 * down. One save array (`wwd.placed`) holds everything the player has set into
 * the world, whether it came from the legacy recipes or the Workshop bench —
 * the id tells them apart (Workshop ids parse as `form:material:size:finish`).
 * Positions are player-chosen, so nothing here touches the seeded RNG.
 */

import { RECIPES, type RecipeUse } from './Crafting';
import { parseItemId } from './workshop/items';

/** One keepsake set down in the world. `id` is a legacy CraftedId or a Workshop ItemId. */
export interface PlacedEntry {
  id: string;
  x: number;
  z: number;
}

/** The legacy `wwd.built` entry shape (pre-unification). */
export interface LegacyBuilt {
  kind: string;
  x: number;
  z: number;
}

/**
 * One-time save migration: merge the two pre-unification arrays into the
 * single `wwd.placed` list. Order keeps what's already migrated first so a
 * re-run is harmless (idempotent given the old keys are cleared after).
 */
export function migratePlaced(
  placed: PlacedEntry[],
  legacyBuilt: LegacyBuilt[],
  workshopBuilt: PlacedEntry[],
): PlacedEntry[] {
  return [
    ...placed,
    ...legacyBuilt.map((b) => ({ id: b.kind, x: b.x, z: b.z })),
    ...workshopBuilt,
  ];
}

/** The pack verb for an item id: Workshop items place; legacy ids keep their
 *  recipe use; raw materials have no verb (they feed the bench instead). */
export function verbFor(id: string): RecipeUse | null {
  if (parseItemId(id)) return 'place';
  return RECIPES.find((r) => r.id === id)?.use ?? null;
}
