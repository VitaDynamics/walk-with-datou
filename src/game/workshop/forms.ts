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

import type { MaterialGroup, MaterialId } from './materials';

export const FORMS_VERSION = 2;

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
  /** Optional authoring-template whitelist for forms that need tighter physical eligibility. */
  readonly materials?: readonly MaterialId[];
  readonly use: FormUse;
  readonly tier: 1 | 2 | 3;
  /** Does size vary this form? (Most do; a few one-size keepsakes don't.) */
  readonly sizes?: boolean;
  /** Does finish vary this form? */
  readonly finishes?: boolean;
  /** What the player and Datou concretely do with this form. */
  readonly companionshipHook?: string;
  /** Context in which Datou can hint at the form. */
  readonly inspiration?: string;
  /** Placement metadata authored with the sprite form. */
  readonly world?: {
    readonly heightM: number;
    readonly shadowRadiusM: number;
    readonly colliderM: number;
    readonly placement: 'billboard' | 'decal';
  };
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
  'cache-box': {
    family: 'furnishing', accepts: ['wood', 'stone'], materials: ['plank', 'driftwood', 'bark', 'log', 'stone-block', 'clay-lump'],
    use: 'place', tier: 2, sizes: true, finishes: true,
    companionshipHook: 'Datou drops gathered finds into the box while you sort and remember the walk together.',
    inspiration: 'home + clear + any season + calm mood, bond 30+',
    world: { heightM: 0.72, shadowRadiusM: 0.58, colliderM: 0.45, placement: 'billboard' },
  },
  'drinking-bowl': {
    family: 'furnishing', accepts: ['stone', 'found'], materials: ['flat-stone', 'stone-block', 'clay-lump', 'shell'],
    use: 'place', tier: 2, sizes: true, finishes: true,
    companionshipHook: 'You refill the bowl after a long walk and Datou pauses beside you for a drink.',
    inspiration: 'lake + clear + summer + tired mood, bond 30+',
    world: { heightM: 0.32, shadowRadiusM: 0.38, colliderM: 0.22, placement: 'billboard' },
  },
  'bug-hotel': {
    family: 'furnishing', accepts: ['wood', 'plant'], materials: ['twig', 'bark', 'pine-branch', 'log', 'reed', 'pinecone'],
    use: 'place', tier: 2, sizes: true, finishes: true,
    companionshipHook: 'You and Datou return to quietly watch which tiny visitors have moved into its rooms.',
    inspiration: 'meadow + breeze + spring + curious mood, bond 30+',
    world: { heightM: 1.1, shadowRadiusM: 0.48, colliderM: 0.3, placement: 'billboard' },
  },

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
  raft: {
    family: 'structure', accepts: ['wood', 'plant'], materials: ['plank', 'driftwood', 'log', 'reed'],
    use: 'place', tier: 2, sizes: true, finishes: true,
    companionshipHook: 'You step onto the raft together and Datou scans the quiet shoreline from the bow.',
    inspiration: 'lake + clear + summer + Explorer personality, bond 45+',
    world: { heightM: 0.28, shadowRadiusM: 1.05, colliderM: 0.85, placement: 'decal' },
  },

  // --- For Datou (§2.2) -----------------------------------------------------
  garland: { family: 'datou', accepts: ['plant'], use: 'wear', tier: 1, finishes: true, legacySprite: 'drawGarland' },
  'collar-charm': { family: 'datou', accepts: ['found', 'plant', 'stone'], use: 'wear', tier: 1, finishes: true },
  ramp: { family: 'datou', accepts: ['wood', 'stone'], use: 'place', tier: 2, sizes: true },
  tunnel: { family: 'datou', accepts: ['wood', 'plant'], use: 'place', tier: 2, sizes: true },
  'ball-run': { family: 'datou', accepts: ['wood'], use: 'place', tier: 2, sizes: true },
  'play-ball': {
    family: 'datou', accepts: ['wood', 'plant', 'found'], materials: ['bark', 'grass-wisp', 'reed', 'flower', 'feather'],
    use: 'throw', tier: 1, sizes: true, finishes: true,
    companionshipHook: 'Datou chases, nudges, and brings the soft ball back for another shared turn.',
    inspiration: 'home + clear + any season + playful mood, bond 15+',
    world: { heightM: 0.3, shadowRadiusM: 0.22, colliderM: 0.12, placement: 'billboard' },
  },

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
  brush: {
    family: 'tool', accepts: ['wood', 'plant', 'found'], materials: ['twig', 'grass-wisp', 'reed', 'feather'],
    use: 'tool', tier: 1,
    companionshipHook: 'You brush trail dust from Datou while it leans into the slow, familiar care.',
    inspiration: 'home + clear + any season + calm mood, bond 10+',
    world: { heightM: 0.48, shadowRadiusM: 0.22, colliderM: 0, placement: 'billboard' },
  },
  wayfinder: {
    family: 'tool', accepts: ['wood', 'stone', 'found'], materials: ['driftwood', 'flat-stone', 'shell', 'old-bolt'],
    use: 'tool', tier: 1,
    companionshipHook: 'You mark a favorite route, and Datou later recognizes the way back to its shared memory.',
    inspiration: 'trail + fog + autumn + Explorer personality, bond 20+',
    world: { heightM: 0.42, shadowRadiusM: 0.24, colliderM: 0, placement: 'billboard' },
  },
  'field-glass': {
    family: 'tool', accepts: ['wood', 'plant', 'found'], materials: ['driftwood', 'reed', 'shell', 'old-bolt'],
    use: 'tool', tier: 1,
    companionshipHook: 'You point out a distant detail and Datou turns its visor toward the same discovery.',
    inspiration: 'meadow + clear + any season + curious mood, bond 25+',
    world: { heightM: 0.5, shadowRadiusM: 0.28, colliderM: 0, placement: 'billboard' },
  },
} as const satisfies Record<string, Form>;

export type FormId = keyof typeof FORMS;

export const FORM_IDS = Object.keys(FORMS) as FormId[];

export function form(id: FormId): Form {
  return FORMS[id];
}
