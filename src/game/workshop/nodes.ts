/**
 * Resource nodes — the bulk-material supply side (BUILDING_SYSTEM §8).
 *
 * A few huge, landmark-sized sources that yield materials in bulk, but only
 * when Datou works them with the right tool. Pure data + a seeded daily-charge
 * model (anti-FOMO: nodes always come back — §8.1). The work loop lives in
 * Harvest.ts; the world layer renders the plates + harvest states.
 *
 * Determinism (§9): placements are static layout data; charges refresh on a
 * date-seeded schedule, so "what's available today" is the same for everyone.
 */

import type { ToolKind, ToolTier } from './tools';
import type { MaterialId } from './materials';

export type NodeType = 'great-tree' | 'old-boulder' | 'clay-seam' | 'flint-lode' | 'bolt-cache';

export interface NodeDef {
  /** Tool kind required to work it. */
  tool: ToolKind;
  /** Minimum tool tier that can work it (Terraria-style gating, §8.2). */
  minTier: ToolTier;
  /** Materials it yields, with relative weights (per worked beat). */
  yields: { material: MaterialId; weight: number }[];
  /** Charges per day (each charge ≈ one worked beat burst). */
  charges: number;
  /** Days to fully regrow once spent (visible stages between). */
  regrowDays: number;
}

export const NODE_DEFS: Record<NodeType, NodeDef> = {
  'great-tree': {
    tool: 'axe',
    minTier: 1,
    yields: [
      { material: 'log', weight: 5 },
      { material: 'bark', weight: 3 },
      { material: 'twig', weight: 4 },
    ],
    charges: 12,
    regrowDays: 2,
  },
  'old-boulder': {
    tool: 'pickaxe',
    minTier: 1,
    yields: [
      { material: 'stone-block', weight: 5 },
      { material: 'flat-stone', weight: 3 },
      { material: 'pebble', weight: 4 },
    ],
    charges: 12,
    regrowDays: 2,
  },
  'clay-seam': {
    tool: 'pickaxe',
    minTier: 1,
    yields: [{ material: 'clay-lump', weight: 1 }],
    charges: 9,
    regrowDays: 3,
  },
  'flint-lode': {
    tool: 'pickaxe',
    minTier: 2,
    yields: [
      { material: 'flint', weight: 4 },
      { material: 'pebble', weight: 2 },
    ],
    charges: 9,
    regrowDays: 7,
  },
  'bolt-cache': {
    tool: 'pickaxe',
    minTier: 3,
    yields: [{ material: 'old-bolt', weight: 1 }],
    charges: 7,
    regrowDays: 7,
  },
};

export interface NodePlacement {
  id: string;
  type: NodeType;
  x: number;
  z: number;
}

/**
 * Curated node placements (§8.1: woods hearts, meadow, lake shore, ruin
 * outcrop, far-corner machine site). Stable ids are save keys.
 */
export const NODE_PLACEMENTS: readonly NodePlacement[] = [
  { id: 'tree-woods-1', type: 'great-tree', x: -126, z: -116 },
  { id: 'tree-meadow-1', type: 'great-tree', x: 54, z: -96 },
  { id: 'boulder-meadow-1', type: 'old-boulder', x: -64, z: 64 },
  { id: 'boulder-ruin-1', type: 'old-boulder', x: 162, z: -156 },
  { id: 'clay-lake-1', type: 'clay-seam', x: -10, z: 128 },
  { id: 'flint-ruin-1', type: 'flint-lode', x: 174, z: -150 },
  { id: 'bolt-corner-1', type: 'bolt-cache', x: 214, z: 196 },
];

/** Harvest visual states by remaining-charge fraction (§8.1). */
export type HarvestState = 'full' | 'worked' | 'spent' | 'regrowing';

export function harvestState(charges: number, max: number): HarvestState {
  if (charges <= 0) return 'spent';
  const f = charges / max;
  if (f > 0.6) return 'full';
  if (f > 0) return 'worked';
  return 'regrowing';
}
