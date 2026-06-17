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
import { isLabItem } from './labItems';
import type { FoodBowlStage } from '../art/foodBowl';
import type {
  SproutStage,
  BedStage,
  SeatStage,
  SeedStage,
} from './starterInteractions';

/** One keepsake set down in the world. `id` is a legacy CraftedId or a Workshop ItemId. */
export interface PlacedEntry {
  id: string;
  x: number;
  z: number;
  /** Only used by the staged food-bowl interaction. */
  bowlStage?: FoodBowlStage;
  // --- Starter-item interaction state (one small field per interactive form,
  //     never overloaded; savePlaced() serializes the entry so each persists). ---
  /** sprout-pot: dry → watered → leafing → bloom (renewable). */
  sproutStage?: SproutStage;
  /** sprout-pot: dailyKey() of the last leaf-check, gating the daily return beat. */
  sproutDay?: string;
  /** mailbox: dailyKey() of the day a note was last collected (once-daily open). */
  mailDay?: string;
  /** mushroom-lamp / garden-lantern: lit toggle (lantern reverts on daily rollover). */
  lampLit?: boolean;
  lanternLit?: boolean;
  /** pet-bed: made → circled → nested. */
  bedStage?: BedStage;
  /** stool: empty → seated → rested. */
  seatStage?: SeatStage;
  /** seed-chest: full → sorted → chosen (one-time). */
  seedStage?: SeedStage;
  // --- Interactive park keepsakes (parkInteractions.ts) -----------------------
  /** The current ordered state of a park item (its form defines the union). */
  parkState?: string;
  /** dailyKey() of the last park-item payoff, gating the once-a-day reactions. */
  parkDay?: string;
  /** weather-log-wheel / spin-choice-wheel: which notch/wedge is showing. */
  parkNotch?: number;
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
  if (isLabItem(id)) return 'place'; // a field-lab keepsake — set it down, then tap it
  return RECIPES.find((r) => r.id === id)?.use ?? null;
}
