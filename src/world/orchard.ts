/**
 * The Meadow Orchard (E4) — pure layout data for the food district.
 *
 * worldPaint has painted four tilled rows at (60, -110) since the connective
 * pass; this gives them their plants: twelve tended fruit trees in loose
 * rows and four vegetable rows on the strips. Charges are daily and
 * date-seeded (anti-FOMO: food always comes back tomorrow).
 *
 * Season shapes the trees (weather.ts): spring → blossom (no fruit yet),
 * summer/autumn → fruiting, winter → bare.
 */

import type { FruitKind, TreeStage, VegKind } from '../art/orchard';
import type { Season } from '../game/workshop/weather';

export interface OrchardTree {
  id: string;
  kind: FruitKind;
  x: number;
  z: number;
}

export interface VegRow {
  id: string;
  kind: VegKind;
  x: number;
  z: number;
}

/** Fruit drops per tree per day. */
export const TREE_CHARGES = 3;
/** Pulls per vegetable row per day. */
export const ROW_CHARGES = 4;

/** Twelve tended trees in loose rows west and north of the tilled strips. */
export const ORCHARD_TREES: readonly OrchardTree[] = [
  { id: 'apple-1', kind: 'apple', x: 46, z: -122 },
  { id: 'apple-2', kind: 'apple', x: 54, z: -124 },
  { id: 'apple-3', kind: 'apple', x: 62, z: -123 },
  { id: 'apple-4', kind: 'apple', x: 70, z: -121 },
  { id: 'apple-5', kind: 'apple', x: 50, z: -130 },
  { id: 'pear-1', kind: 'pear', x: 44, z: -106 },
  { id: 'pear-2', kind: 'pear', x: 42, z: -114 },
  { id: 'pear-3', kind: 'pear', x: 66, z: -130 },
  { id: 'pear-4', kind: 'pear', x: 74, z: -128 },
  { id: 'plum-1', kind: 'plum', x: 78, z: -112 },
  { id: 'plum-2', kind: 'plum', x: 76, z: -104 },
  { id: 'plum-3', kind: 'plum', x: 70, z: -98 },
];

/** Four rows on the painted strips, offset like a real kitchen garden. */
export const VEG_ROWS: readonly VegRow[] = [
  { id: 'row-pumpkin', kind: 'pumpkin', x: 58, z: -116 },
  { id: 'row-turnip', kind: 'turnip', x: 60, z: -112 },
  { id: 'row-carrot', kind: 'carrot', x: 58, z: -108 },
  { id: 'row-turnip-2', kind: 'turnip', x: 60, z: -104 },
];

export function treeStageFor(season: Season): TreeStage {
  if (season === 'spring') return 'blossom';
  if (season === 'winter') return 'bare';
  return 'fruiting';
}

export function orchardTreeNear(x: number, z: number, r = 2.0): OrchardTree | null {
  let best: OrchardTree | null = null;
  let bestD = r;
  for (const t of ORCHARD_TREES) {
    const d = Math.hypot(t.x - x, t.z - z);
    if (d <= bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

export function vegRowNear(x: number, z: number, r = 1.8): VegRow | null {
  let best: VegRow | null = null;
  let bestD = r;
  for (const row of VEG_ROWS) {
    // Rows are long and thin: stretch the test along x.
    const d = Math.hypot((row.x - x) * 0.45, row.z - z);
    if (d <= bestD) {
      bestD = d;
      best = row;
    }
  }
  return best;
}
