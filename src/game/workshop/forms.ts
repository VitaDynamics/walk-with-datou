/**
 * The Workshop — form registry (BUILDING_SYSTEM §2.2, §2.3, §9).
 *
 * A FORM is the F-axis of the grammar `ITEM = FORM(MATERIAL, SIZE, FINISH)`: a
 * parametric hand-drawn template (same canvas-procedural pipeline as
 * `src/art/props.ts`) that takes a material PROFILE as input. Authoring cost is
 * forms × templates, NOT items — ~40 templates here recolor/re-detail across
 * ~18 materials × 3 sizes × finishes to reach the ~1 000-item space (§2.3).
 *
 * This registry is pure metadata — no drawing here. It declares, per form:
 * which material GROUPS the form accepts (eligibility — a ring wants flexible
 * stock, a beam wants strong wood), its FAMILY (the Tree-tab branch), its
 * use, its tier, and whether SIZE / FINISH vary it. Sprite templates are wired
 * in a later phase (W3/W7); §11 calls W1 "form-template refactor" — the
 * registry is the contract those templates fill, and ~25 existing props map
 * onto it via `legacySprite`.
 *
 * Determinism & versioning (§9): static table, stable ids. `FORMS_VERSION`
 * bumps when the table changes so saves can migrate discovered knowledge.
 */

import type { MaterialGroup } from './materials';

export const FORMS_VERSION = 1;

/** Tree-tab branches (BUILDING_SYSTEM §2.2 groupings). */
export type FormFamily = 'component' | 'furnishing' | 'structure' | 'datou' | 'keepsake' | 'tool';

/** What the made item does (extends today's Crafting.RecipeUse). */
export type FormUse = 'component' | 'place' | 'wear' | 'throw' | 'tool';

/** The three coarse sizes (§2.3). Mass on the bench picks one. */
export type Size = 'S' | 'M' | 'L';
export const SIZES: readonly Size[] = ['S', 'M', 'L'];

/** Finishes (§2.3): plain, or a secondary material reading (e.g. flowers → blossom). */
export type Finish = 'plain' | 'banded' | 'blossom';
export const FINISHES: readonly Finish[] = ['plain', 'banded', 'blossom'];

export interface Form {
  readonly family: FormFamily;
  /** Material groups this form accepts. A material is eligible iff its group is listed. */
  readonly accepts: readonly MaterialGroup[];
  readonly use: FormUse;
  readonly tier: 1 | 2 | 3;
  /** Does size vary this form? (Most do; a few one-size keepsakes don't.) */
  readonly sizes?: boolean;
  /** Does finish vary this form? */
  readonly finishes?: boolean;
  /**
   * Name of an existing `src/art/props.ts` draw fn this form already has art
   * for (the ~25 mapped in W1). Absent ⇒ template still to author (W3/W7).
   */
  readonly legacySprite?: string;
}

/**
 * The launch forms (F ≈ 40, BUILDING_SYSTEM §2.2). Grouped by family for
 * reading; iteration order is stable (insertion order) for deterministic
 * enumeration and Tree-tab layout.
 */
export const FORMS = {
  // --- Components (§2.2) — raw stock assembled one step up -------------------
  bundle: { family: 'component', accepts: ['wood', 'plant'], use: 'component', tier: 1, sizes: true, legacySprite: 'drawBundle' },
  pile: { family: 'component', accepts: ['stone'], use: 'component', tier: 1, sizes: true, legacySprite: 'drawStonepile' },
  cord: { family: 'component', accepts: ['plant'], use: 'component', tier: 1, sizes: true },
  beam: { family: 'component', accepts: ['wood'], use: 'component', tier: 2, sizes: true },
  post: { family: 'component', accepts: ['wood'], use: 'component', tier: 2, sizes: true },
  panel: { family: 'component', accepts: ['wood', 'stone'], use: 'component', tier: 2, sizes: true },
  ring: { family: 'component', accepts: ['plant', 'wood'], use: 'component', tier: 1, sizes: true, finishes: true },
  vessel: { family: 'component', accepts: ['stone', 'found'], use: 'component', tier: 2, sizes: true },
  wheel: { family: 'component', accepts: ['wood', 'found'], use: 'component', tier: 2 },
  block: { family: 'component', accepts: ['stone'], use: 'component', tier: 3, sizes: true },

  // --- Furnishings (§2.2) — for the home & trail ----------------------------
  fence: { family: 'furnishing', accepts: ['wood'], use: 'place', tier: 2, sizes: true, finishes: true, legacySprite: 'drawFence' },
  gate: { family: 'furnishing', accepts: ['wood'], use: 'place', tier: 2, finishes: true },
  bench: { family: 'furnishing', accepts: ['wood', 'stone'], use: 'place', tier: 2, sizes: true, legacySprite: 'drawBench' },
  table: { family: 'furnishing', accepts: ['wood', 'stone'], use: 'place', tier: 2, sizes: true, legacySprite: 'drawPicnicTable' },
  stool: { family: 'furnishing', accepts: ['wood', 'stone'], use: 'place', tier: 1, sizes: true },
  lamp: { family: 'furnishing', accepts: ['wood', 'found'], use: 'place', tier: 2, finishes: true, legacySprite: 'drawLamp' },
  lantern: { family: 'furnishing', accepts: ['wood', 'plant', 'found'], use: 'place', tier: 2, finishes: true },
  planter: { family: 'furnishing', accepts: ['wood', 'stone'], use: 'place', tier: 2, sizes: true, finishes: true, legacySprite: 'drawSoil' },
  trellis: { family: 'furnishing', accepts: ['wood', 'plant'], use: 'place', tier: 2, sizes: true, finishes: true },
  birdbath: { family: 'furnishing', accepts: ['stone'], use: 'place', tier: 2, sizes: true, legacySprite: 'drawBirdbath' },
  chime: { family: 'furnishing', accepts: ['plant', 'found', 'stone'], use: 'place', tier: 2, finishes: true, legacySprite: 'drawWindchime' },
  mobile: { family: 'furnishing', accepts: ['plant', 'found'], use: 'place', tier: 2, finishes: true },
  'path-tile': { family: 'furnishing', accepts: ['stone'], use: 'place', tier: 1, sizes: true },
  sign: { family: 'furnishing', accepts: ['wood'], use: 'place', tier: 1, sizes: true, legacySprite: 'drawSignpost' },
  mat: { family: 'furnishing', accepts: ['plant'], use: 'place', tier: 1, sizes: true, finishes: true, legacySprite: 'drawPad' },
  basket: { family: 'furnishing', accepts: ['plant', 'wood'], use: 'place', tier: 2, sizes: true },

  // --- Structures (§2.2) — the big keepsakes, consume bulk stock -------------
  shelter: { family: 'structure', accepts: ['wood', 'stone'], use: 'place', tier: 3, sizes: true, legacySprite: 'drawShelter' },
  archway: { family: 'structure', accepts: ['wood', 'stone'], use: 'place', tier: 3, finishes: true, legacySprite: 'drawArchway' },
  pergola: { family: 'structure', accepts: ['wood'], use: 'place', tier: 3, sizes: true, finishes: true },
  'bridge-plank': { family: 'structure', accepts: ['wood'], use: 'place', tier: 3, sizes: true },
  'lookout-perch': { family: 'structure', accepts: ['wood'], use: 'place', tier: 3, sizes: true },
  shrine: { family: 'structure', accepts: ['stone', 'wood'], use: 'place', tier: 3, finishes: true },
  well: { family: 'structure', accepts: ['stone'], use: 'place', tier: 3, sizes: true },
  'cold-frame': { family: 'structure', accepts: ['wood', 'stone'], use: 'place', tier: 3, sizes: true },
  campfire: { family: 'structure', accepts: ['wood', 'stone'], use: 'place', tier: 2, legacySprite: 'drawCampfire' },

  // --- For Datou (§2.2) -----------------------------------------------------
  garland: { family: 'datou', accepts: ['plant'], use: 'wear', tier: 1, finishes: true, legacySprite: 'drawGarland' },
  'collar-charm': { family: 'datou', accepts: ['found', 'plant', 'stone'], use: 'wear', tier: 1, finishes: true },
  ramp: { family: 'datou', accepts: ['wood', 'stone'], use: 'place', tier: 2, sizes: true },
  tunnel: { family: 'datou', accepts: ['wood', 'plant'], use: 'place', tier: 2, sizes: true },
  'ball-run': { family: 'datou', accepts: ['wood'], use: 'place', tier: 2, sizes: true },

  // --- Keepsakes (§2.2) -----------------------------------------------------
  'memory-frame': { family: 'keepsake', accepts: ['wood'], use: 'place', tier: 1, finishes: true },
  'postcard-stand': { family: 'keepsake', accepts: ['wood'], use: 'place', tier: 1 },
  cairn: { family: 'keepsake', accepts: ['stone'], use: 'place', tier: 1, sizes: true, legacySprite: 'drawCairn' },
  'wind-vane': { family: 'keepsake', accepts: ['found', 'wood'], use: 'place', tier: 2, finishes: true },
  'music-post': { family: 'keepsake', accepts: ['wood', 'found'], use: 'place', tier: 2, finishes: true },
  stick: { family: 'keepsake', accepts: ['wood'], use: 'throw', tier: 1, legacySprite: 'drawStick' },

  // --- Tools (§8.2) — same grammar; gate resource nodes ---------------------
  axe: { family: 'tool', accepts: ['wood', 'stone', 'found'], use: 'tool', tier: 1 },
  pickaxe: { family: 'tool', accepts: ['wood', 'stone', 'found'], use: 'tool', tier: 1 },
  shears: { family: 'tool', accepts: ['stone', 'found'], use: 'tool', tier: 2 },
  scoop: { family: 'tool', accepts: ['wood', 'stone', 'found'], use: 'tool', tier: 1 },
} as const satisfies Record<string, Form>;

export type FormId = keyof typeof FORMS;

export const FORM_IDS = Object.keys(FORMS) as FormId[];

export function form(id: FormId): Form {
  return FORMS[id];
}
