/**
 * The Workshop — material registry (BUILDING_SYSTEM §2.1, §9).
 *
 * Materials are the M-axis of the item grammar `ITEM = FORM(MATERIAL, SIZE,
 * FINISH)`. Each material is a point in a small generative space: it belongs to
 * a **group** (which gates the forms that accept it), and carries a **profile**
 * — a color family keyed to the binding baseline palette plus three normalized
 * 0..1 dials (strength · flexibility · warmth). The profile drives BOTH which
 * forms a material can become AND how its sprite is composited (the form
 * template is recolored / re-detailed from these numbers — no per-item art).
 *
 * Determinism: this is a static table. No `Math.random`, no dates. The same
 * material id resolves to the same profile forever, so saved `ItemId`s and
 * diary replays never drift (§9 versioning).
 *
 * Extensible: add a row here (and one i18n key per locale) and the whole item
 * space grows — every eligible form gains a new variant automatically.
 */

import { CLAY, ROBOT, SAGE, WATER, INK } from '../../art/palette';

/** The four raw-find families. Forms declare which groups they accept. */
export type MaterialGroup = 'wood' | 'stone' | 'plant' | 'found';

/**
 * A material's physical character, all normalized 0..1 so forms and sprites can
 * read them uniformly:
 * - `strength`   — how load-bearing (gates structural forms: beams, posts).
 * - `flexibility`— how it bends (gates woven / cord / ring forms).
 * - `warmth`     — emotional/visual warmth (biases finish + which forms "feel"
 *                  right, and nudges the composited tone warmer).
 */
export interface MaterialProfile {
  readonly group: MaterialGroup;
  /** Primary fill, from the baseline palette (never a raw neon). */
  readonly fill: string;
  /** Darker companion tone for baked shading / detail strokes. */
  readonly shade: string;
  readonly strength: number;
  readonly flexibility: number;
  readonly warmth: number;
}

/**
 * The launch set (M ≈ 18, BUILDING_SYSTEM §2.1). `plank`, `log`, `stone-block`
 * etc. are the bulk materials that resource nodes (§8) supply; the ground
 * pickables stay the trickle. Crafted intermediates (plank) live here too so
 * forms can require them.
 *
 * Hyphenated ids match the design doc; they are stable save keys.
 */
export const MATERIALS = {
  // wood ---------------------------------------------------------------------
  twig: { group: 'wood', fill: CLAY.mid, shade: CLAY.deep, strength: 0.3, flexibility: 0.7, warmth: 0.6 },
  bark: { group: 'wood', fill: CLAY.deep, shade: INK.soft, strength: 0.35, flexibility: 0.5, warmth: 0.55 },
  plank: { group: 'wood', fill: CLAY.light, shade: CLAY.deep, strength: 0.7, flexibility: 0.2, warmth: 0.65 },
  driftwood: { group: 'wood', fill: CLAY.pale, shade: CLAY.mid, strength: 0.5, flexibility: 0.3, warmth: 0.45 },
  'pine-branch': { group: 'wood', fill: SAGE.deep, shade: SAGE.shade, strength: 0.4, flexibility: 0.6, warmth: 0.5 },
  log: { group: 'wood', fill: CLAY.mid, shade: CLAY.deep, strength: 0.95, flexibility: 0.05, warmth: 0.7 },

  // stone --------------------------------------------------------------------
  pebble: { group: 'stone', fill: CLAY.pale, shade: CLAY.light, strength: 0.5, flexibility: 0.0, warmth: 0.3 },
  'flat-stone': { group: 'stone', fill: CLAY.light, shade: CLAY.mid, strength: 0.7, flexibility: 0.0, warmth: 0.3 },
  'stone-block': { group: 'stone', fill: CLAY.pale, shade: CLAY.mid, strength: 0.98, flexibility: 0.0, warmth: 0.25 },
  'clay-lump': { group: 'stone', fill: CLAY.blossom, shade: CLAY.mid, strength: 0.4, flexibility: 0.4, warmth: 0.6 },
  flint: { group: 'stone', fill: ROBOT.visor, shade: INK.line, strength: 0.85, flexibility: 0.0, warmth: 0.2 },

  // plant --------------------------------------------------------------------
  'grass-wisp': { group: 'plant', fill: SAGE.light, shade: SAGE.mid, strength: 0.1, flexibility: 0.95, warmth: 0.55 },
  reed: { group: 'plant', fill: SAGE.mid, shade: SAGE.shade, strength: 0.2, flexibility: 0.9, warmth: 0.5 },
  flower: { group: 'plant', fill: CLAY.blossom, shade: SAGE.shade, strength: 0.1, flexibility: 0.8, warmth: 0.9 },
  berry: { group: 'plant', fill: CLAY.blossom, shade: CLAY.deep, strength: 0.05, flexibility: 0.6, warmth: 0.85 },
  mushroom: { group: 'plant', fill: CLAY.pale, shade: CLAY.blossom, strength: 0.15, flexibility: 0.3, warmth: 0.6 },
  pinecone: { group: 'plant', fill: CLAY.mid, shade: CLAY.deep, strength: 0.4, flexibility: 0.1, warmth: 0.6 },
  acorn: { group: 'plant', fill: CLAY.light, shade: CLAY.deep, strength: 0.5, flexibility: 0.1, warmth: 0.65 },

  // found --------------------------------------------------------------------
  feather: { group: 'found', fill: CLAY.pale, shade: SAGE.mid, strength: 0.05, flexibility: 0.95, warmth: 0.7 },
  shell: { group: 'found', fill: WATER.edge, shade: WATER.mid, strength: 0.6, flexibility: 0.0, warmth: 0.4 },
  'old-bolt': { group: 'found', fill: ROBOT.dark, shade: ROBOT.darkShade, strength: 0.9, flexibility: 0.0, warmth: 0.35 },
} as const satisfies Record<string, MaterialProfile>;

export type MaterialId = keyof typeof MATERIALS;

export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];

export function profile(id: MaterialId): MaterialProfile {
  return MATERIALS[id];
}

export function groupOf(id: MaterialId): MaterialGroup {
  return MATERIALS[id].group;
}

/** Every material id in a given group, in registry order (stable). */
export function materialsInGroup(group: MaterialGroup): MaterialId[] {
  return MATERIAL_IDS.filter((id) => MATERIALS[id].group === group);
}
