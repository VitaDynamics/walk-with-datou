/**
 * The Workshop — form registry (BUILDING_SYSTEM §2.2, §2.3, §9).
 *
 * A FORM is the F-axis of the grammar `ITEM = FORM(MATERIAL, SIZE, FINISH)`: a
 * distinct visual/functional identity with a parametric hand-drawn template
 * (same canvas-procedural pipeline as `src/art/props.ts`) that takes a material
 * PROFILE as input. Materials, sizes, and finishes vary a form; they never
 * create fake adjective-reskin forms.
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
import { CATALOG_FORMS, type CatalogFormId } from './formCatalog';

export const FORMS_VERSION = 4;

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

/** Form-level discovery rarity. It affects bench odds and presentation. */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const ITEM_RARITIES: readonly ItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
];

/** Structural silhouette families used by placeholder art and design prompts. */
export type IdentitySilhouette =
  | 'slab'
  | 'beam'
  | 'frame'
  | 'joint'
  | 'mechanism'
  | 'conduit'
  | 'panel'
  | 'binding'
  | 'seat'
  | 'seat-wide'
  | 'table'
  | 'storage'
  | 'light'
  | 'garden'
  | 'textile'
  | 'utility'
  | 'kitchen'
  | 'house'
  | 'canopy'
  | 'bridge'
  | 'pavilion'
  | 'workshop'
  | 'tower'
  | 'pet-rest'
  | 'pet-play'
  | 'pet-care'
  | 'pet-course'
  | 'memory'
  | 'sound'
  | 'display'
  | 'seasonal'
  | 'hand-tool'
  | 'bench-tool'
  | 'instrument';

export interface FormIdentity {
  /** Human-readable noun phrase; materials and rarity do not belong here. */
  readonly name: string;
  /** Primary outer contour. Two forms may share this only if their cues differ. */
  readonly silhouette: IdentitySilhouette;
  readonly proportions:
    | 'flat'
    | 'compact'
    | 'upright'
    | 'tall'
    | 'wide'
    | 'low-wide'
    | 'long-thin'
    | 'long-wide';
  /** The function that must be visible before surface decoration. */
  readonly functionalCue: string;
  /** Three concrete details used by prompting and duplicate review. */
  readonly signatureFeatures: readonly [string, string, string];
  /** Nearest comparison set for CLIP/VLM duplicate checks. */
  readonly duplicateGroup: string;
}

export interface Form {
  readonly family: FormFamily;
  /** Material groups this form accepts. A material is eligible iff its group is listed. */
  readonly accepts: readonly MaterialGroup[];
  /** Optional authoring-template whitelist for forms that need tighter physical eligibility. */
  readonly materials?: readonly MaterialId[];
  readonly use: FormUse;
  readonly tier: 1 | 2 | 3;
  readonly rarity: ItemRarity;
  readonly identity: FormIdentity;
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

type CoreForm = Omit<Form, 'rarity' | 'identity'> & {
  readonly rarity?: ItemRarity;
  readonly identity?: FormIdentity;
};

/**
 * The hand-authored core forms. The identity-first broad catalog is merged
 * below. Iteration order stays stable for deterministic enumeration and layout.
 */
const CORE_FORMS = {
  // --- Components (§2.2) — raw stock assembled one step up -------------------
  bundle: {
    family: 'component',
    accepts: ['wood', 'plant'],
    use: 'component',
    tier: 1,
    rarity: 'common',
    sizes: true,
    legacySprite: 'drawBundle',
  },
  pile: {
    family: 'component',
    accepts: ['stone'],
    use: 'component',
    tier: 1,
    rarity: 'common',
    sizes: true,
    legacySprite: 'drawStonepile',
  },
  cord: {
    family: 'component',
    accepts: ['plant'],
    use: 'component',
    tier: 1,
    rarity: 'common',
    sizes: true,
  },
  beam: {
    family: 'component',
    accepts: ['wood'],
    use: 'component',
    tier: 2,
    rarity: 'common',
    sizes: true,
  },
  post: {
    family: 'component',
    accepts: ['wood'],
    use: 'component',
    tier: 2,
    rarity: 'common',
    sizes: true,
  },
  panel: {
    family: 'component',
    accepts: ['wood', 'stone'],
    use: 'component',
    tier: 2,
    rarity: 'common',
    sizes: true,
  },
  ring: {
    family: 'component',
    accepts: ['plant', 'wood'],
    use: 'component',
    tier: 1,
    rarity: 'uncommon',
    sizes: true,
    finishes: true,
  },
  vessel: {
    family: 'component',
    accepts: ['stone', 'found'],
    use: 'component',
    tier: 2,
    rarity: 'uncommon',
    sizes: true,
  },
  wheel: {
    family: 'component',
    accepts: ['wood', 'found'],
    use: 'component',
    tier: 2,
    rarity: 'rare',
  },
  block: {
    family: 'component',
    accepts: ['stone'],
    use: 'component',
    tier: 3,
    rarity: 'uncommon',
    sizes: true,
  },

  // --- Furnishings (§2.2) — for the home & trail ----------------------------
  fence: {
    family: 'furnishing',
    accepts: ['wood'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    legacySprite: 'drawFence',
  },
  gate: { family: 'furnishing', accepts: ['wood'], use: 'place', tier: 2, finishes: true },
  bench: {
    family: 'furnishing',
    accepts: ['wood', 'stone'],
    use: 'place',
    tier: 2,
    sizes: true,
    legacySprite: 'drawBench',
  },
  table: {
    family: 'furnishing',
    accepts: ['wood', 'stone'],
    use: 'place',
    tier: 2,
    sizes: true,
    legacySprite: 'drawPicnicTable',
  },
  stool: { family: 'furnishing', accepts: ['wood', 'stone'], use: 'place', tier: 1, sizes: true },
  lamp: {
    family: 'furnishing',
    accepts: ['wood', 'found'],
    use: 'place',
    tier: 2,
    finishes: true,
    legacySprite: 'drawLamp',
  },
  lantern: {
    family: 'furnishing',
    accepts: ['wood', 'plant', 'found'],
    use: 'place',
    tier: 2,
    finishes: true,
  },
  planter: {
    family: 'furnishing',
    accepts: ['wood', 'stone'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    legacySprite: 'drawSoil',
  },
  trellis: {
    family: 'furnishing',
    accepts: ['wood', 'plant'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
  },
  birdbath: {
    family: 'furnishing',
    accepts: ['stone'],
    use: 'place',
    tier: 2,
    sizes: true,
    legacySprite: 'drawBirdbath',
  },
  chime: {
    family: 'furnishing',
    accepts: ['plant', 'found', 'stone'],
    use: 'place',
    tier: 2,
    finishes: true,
    legacySprite: 'drawWindchime',
  },
  mobile: {
    family: 'furnishing',
    accepts: ['plant', 'found'],
    use: 'place',
    tier: 2,
    finishes: true,
  },
  'path-tile': { family: 'furnishing', accepts: ['stone'], use: 'place', tier: 1, sizes: true },
  sign: {
    family: 'furnishing',
    accepts: ['wood'],
    use: 'place',
    tier: 1,
    sizes: true,
    legacySprite: 'drawSignpost',
  },
  mat: {
    family: 'furnishing',
    accepts: ['plant'],
    use: 'place',
    tier: 1,
    sizes: true,
    finishes: true,
    legacySprite: 'drawPad',
  },
  basket: { family: 'furnishing', accepts: ['plant', 'wood'], use: 'place', tier: 2, sizes: true },
  'cache-box': {
    family: 'furnishing',
    accepts: ['wood', 'stone'],
    materials: ['plank', 'driftwood', 'bark', 'log', 'stone-block', 'clay-lump'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'Datou drops gathered finds into the box while you sort and remember the walk together.',
    inspiration: 'home + clear + any season + calm mood, bond 30+',
    world: { heightM: 0.72, shadowRadiusM: 0.58, colliderM: 0.45, placement: 'billboard' },
  },
  'drinking-bowl': {
    family: 'furnishing',
    accepts: ['stone', 'found'],
    materials: ['flat-stone', 'stone-block', 'clay-lump', 'shell'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You refill the bowl after a long walk and Datou pauses beside you for a drink.',
    inspiration: 'lake + clear + summer + tired mood, bond 30+',
    world: { heightM: 0.32, shadowRadiusM: 0.38, colliderM: 0.22, placement: 'billboard' },
  },
  'bug-hotel': {
    family: 'furnishing',
    accepts: ['wood', 'plant'],
    materials: ['twig', 'bark', 'pine-branch', 'log', 'reed', 'pinecone'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You and Datou return to quietly watch which tiny visitors have moved into its rooms.',
    inspiration: 'meadow + breeze + spring + curious mood, bond 30+',
    world: { heightM: 1.1, shadowRadiusM: 0.48, colliderM: 0.3, placement: 'billboard' },
  },
  'sprout-pot': {
    family: 'furnishing',
    accepts: ['stone'],
    materials: ['flat-stone', 'stone-block', 'clay-lump'],
    use: 'place',
    tier: 1,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You water the tiny sprout together and Datou checks each new leaf on the way home.',
    inspiration: 'home + clear + spring + curious mood, bond 0+',
    world: { heightM: 0.48, shadowRadiusM: 0.3, colliderM: 0.18, placement: 'billboard' },
  },
  mailbox: {
    family: 'furnishing',
    accepts: ['wood'],
    materials: ['twig', 'bark', 'plank', 'driftwood'],
    use: 'place',
    tier: 1,
    sizes: true,
    finishes: true,
    companionshipHook:
      'Datou waits beside the little door while you check whether a neighbor left a note.',
    inspiration: 'home + clear + any season + calm mood, bond 0+',
    world: { heightM: 0.95, shadowRadiusM: 0.32, colliderM: 0.2, placement: 'billboard' },
  },
  'food-bowl': {
    family: 'furnishing',
    accepts: ['stone', 'found'],
    materials: ['flat-stone', 'stone-block', 'clay-lump', 'shell'],
    use: 'place',
    tier: 1,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You set down a small meal and stay nearby while Datou settles into its evening routine.',
    inspiration: 'home + clear + any season + tired mood, bond 0+',
    world: { heightM: 0.25, shadowRadiusM: 0.34, colliderM: 0.18, placement: 'billboard' },
  },
  'garden-lantern': {
    family: 'furnishing',
    accepts: ['stone'],
    materials: ['flat-stone', 'stone-block', 'clay-lump'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You light the low garden lantern and Datou follows its warm pool along the path.',
    inspiration: 'home + evening + autumn + calm mood, bond 0+',
    world: { heightM: 0.92, shadowRadiusM: 0.42, colliderM: 0.26, placement: 'billboard' },
  },
  'seed-chest': {
    family: 'furnishing',
    accepts: ['wood'],
    materials: ['twig', 'bark', 'plank', 'driftwood'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You choose seeds for the next planting while Datou noses the open compartments.',
    inspiration: 'home + clear + spring + curious mood, bond 0+',
    world: { heightM: 0.62, shadowRadiusM: 0.5, colliderM: 0.38, placement: 'billboard' },
  },

  // --- Interactive park keepsakes (the eight code-cutout items) --------------
  'steam-rest': {
    family: 'furnishing',
    accepts: ['stone'],
    materials: ['flat-stone', 'stone-block', 'clay-lump'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You warm the cup and Datou settles beside you to watch the steam curl up.',
    inspiration: 'home + clear + winter + tired mood, bond 0+',
    world: { heightM: 0.45, shadowRadiusM: 0.27, colliderM: 0.32, placement: 'billboard' },
  },
  'nose-puzzle-drawer': {
    family: 'datou',
    accepts: ['stone', 'wood', 'plant'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You slide a drawer and Datou noses out the hidden scent — solved, never frustrated.',
    inspiration: 'home + clear + any season + curious mood, bond 20+',
    world: { heightM: 0.45, shadowRadiusM: 0.5, colliderM: 0.7, placement: 'billboard' },
  },
  'paw-rinse-step': {
    family: 'furnishing',
    accepts: ['stone'],
    materials: ['flat-stone', 'stone-block', 'clay-lump'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You fill the four little wells and Datou rinses each muddy paw before coming home.',
    inspiration: 'home + rain + any season + tired mood, bond 20+',
    world: { heightM: 0.28, shadowRadiusM: 0.62, colliderM: 0.55, placement: 'billboard' },
  },
  'moonwater-lamp': {
    family: 'keepsake',
    accepts: ['stone', 'found'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You light it at dusk and the still water holds a small warm pool you both watch.',
    inspiration: 'lake + evening + summer + calm mood, bond 0+',
    world: { heightM: 0.34, shadowRadiusM: 0.36, colliderM: 0.42, placement: 'billboard' },
  },
  'bird-nesting-fiber-frame': {
    family: 'furnishing',
    accepts: ['wood', 'plant'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You set out soft fibers and return to find what the little birds took for their nests.',
    inspiration: 'meadow + clear + spring + curious mood, bond 0+',
    world: { heightM: 0.55, shadowRadiusM: 0.42, colliderM: 0.36, placement: 'billboard' },
  },
  'weather-log-wheel': {
    family: 'keepsake',
    accepts: ['wood', 'plant'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      "You turn the dial one notch to today's sky and Datou reads the new glyph with you.",
    inspiration: 'home + any weather + any season + calm mood, bond 0+',
    world: { heightM: 0.55, shadowRadiusM: 0.3, colliderM: 0.34, placement: 'billboard' },
  },
  'spin-choice-wheel': {
    family: 'furnishing',
    accepts: ['wood', 'stone', 'plant'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'Datou turns the pointer to pick which game you play — the choice is honestly its own.',
    inspiration: 'meadow + clear + any season + playful mood, bond 20+',
    world: { heightM: 0.62, shadowRadiusM: 0.26, colliderM: 0.3, placement: 'billboard' },
  },
  'shared-snack-tin': {
    family: 'furnishing',
    accepts: ['stone', 'found'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You nose the lid open together for a quiet once-a-day share, shoulder to shoulder.',
    inspiration: 'home + clear + any season + tired mood, bond 0+',
    world: { heightM: 0.34, shadowRadiusM: 0.34, colliderM: 0.5, placement: 'billboard' },
  },

  // --- Structures (§2.2) — the big keepsakes, consume bulk stock -------------
  shelter: {
    family: 'structure',
    accepts: ['wood', 'stone'],
    use: 'place',
    tier: 3,
    sizes: true,
    legacySprite: 'drawShelter',
  },
  archway: {
    family: 'structure',
    accepts: ['wood', 'stone'],
    use: 'place',
    tier: 3,
    finishes: true,
    legacySprite: 'drawArchway',
  },
  pergola: {
    family: 'structure',
    accepts: ['wood'],
    use: 'place',
    tier: 3,
    sizes: true,
    finishes: true,
  },
  'bridge-plank': { family: 'structure', accepts: ['wood'], use: 'place', tier: 3, sizes: true },
  'lookout-perch': { family: 'structure', accepts: ['wood'], use: 'place', tier: 3, sizes: true },
  shrine: {
    family: 'structure',
    accepts: ['stone', 'wood'],
    use: 'place',
    tier: 3,
    finishes: true,
  },
  well: { family: 'structure', accepts: ['stone'], use: 'place', tier: 3, sizes: true },
  'cold-frame': {
    family: 'structure',
    accepts: ['wood', 'stone'],
    use: 'place',
    tier: 3,
    sizes: true,
  },
  campfire: {
    family: 'structure',
    accepts: ['wood', 'stone'],
    use: 'place',
    tier: 2,
    legacySprite: 'drawCampfire',
  },
  raft: {
    family: 'structure',
    accepts: ['wood', 'plant'],
    materials: ['plank', 'driftwood', 'log', 'reed'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'You step onto the raft together and Datou scans the quiet shoreline from the bow.',
    inspiration: 'lake + clear + summer + Explorer personality, bond 45+',
    world: { heightM: 0.28, shadowRadiusM: 1.05, colliderM: 0.85, placement: 'decal' },
  },

  // --- For Datou (§2.2) -----------------------------------------------------
  garland: {
    family: 'datou',
    accepts: ['plant'],
    use: 'wear',
    tier: 1,
    finishes: true,
    legacySprite: 'drawGarland',
  },
  'collar-charm': {
    family: 'datou',
    accepts: ['found', 'plant', 'stone'],
    use: 'wear',
    tier: 1,
    finishes: true,
  },
  ramp: { family: 'datou', accepts: ['wood', 'stone'], use: 'place', tier: 2, sizes: true },
  tunnel: { family: 'datou', accepts: ['wood', 'plant'], use: 'place', tier: 2, sizes: true },
  'ball-run': { family: 'datou', accepts: ['wood'], use: 'place', tier: 2, sizes: true },
  'play-ball': {
    family: 'datou',
    accepts: ['wood', 'plant', 'found'],
    materials: ['bark', 'grass-wisp', 'reed', 'flower', 'feather'],
    use: 'throw',
    tier: 1,
    sizes: true,
    finishes: true,
    companionshipHook:
      'Datou chases, nudges, and brings the soft ball back for another shared turn.',
    inspiration: 'home + clear + any season + playful mood, bond 15+',
    world: { heightM: 0.3, shadowRadiusM: 0.22, colliderM: 0.12, placement: 'billboard' },
  },
  'pet-bed': {
    family: 'datou',
    accepts: ['wood', 'plant', 'found'],
    materials: ['bark', 'grass-wisp', 'reed', 'flower', 'feather'],
    use: 'place',
    tier: 2,
    sizes: true,
    finishes: true,
    companionshipHook:
      'Datou circles the soft bed, curls down, and leaves room for you to sit close beside it.',
    inspiration: 'home + evening + any season + tired mood, bond 0+',
    world: { heightM: 0.34, shadowRadiusM: 0.52, colliderM: 0.28, placement: 'billboard' },
  },

  // --- Keepsakes (§2.2) -----------------------------------------------------
  'memory-frame': { family: 'keepsake', accepts: ['wood'], use: 'place', tier: 1, finishes: true },
  'postcard-stand': { family: 'keepsake', accepts: ['wood'], use: 'place', tier: 1 },
  cairn: {
    family: 'keepsake',
    accepts: ['stone'],
    use: 'place',
    tier: 1,
    sizes: true,
    legacySprite: 'drawCairn',
  },
  'wind-vane': {
    family: 'keepsake',
    accepts: ['found', 'wood'],
    use: 'place',
    tier: 2,
    finishes: true,
  },
  'music-post': {
    family: 'keepsake',
    accepts: ['wood', 'found'],
    use: 'place',
    tier: 2,
    finishes: true,
  },
  stick: {
    family: 'keepsake',
    accepts: ['wood'],
    use: 'throw',
    tier: 1,
    legacySprite: 'drawStick',
  },
  'repair-toy': {
    family: 'keepsake',
    accepts: ['wood', 'found'],
    materials: ['twig', 'plank', 'driftwood', 'old-bolt'],
    use: 'place',
    tier: 2,
    sizes: true,
    companionshipHook:
      'You tighten the toy together and Datou watches its familiar little wobble return.',
    inspiration: 'home + rain + any season + curious mood, bond 0+',
    world: { heightM: 0.46, shadowRadiusM: 0.26, colliderM: 0.12, placement: 'billboard' },
  },

  // --- Tools (§8.2) — same grammar; gate resource nodes ---------------------
  axe: { family: 'tool', accepts: ['wood', 'stone', 'found'], use: 'tool', tier: 1 },
  pickaxe: { family: 'tool', accepts: ['wood', 'stone', 'found'], use: 'tool', tier: 1 },
  shears: { family: 'tool', accepts: ['stone', 'found'], use: 'tool', tier: 2 },
  scoop: { family: 'tool', accepts: ['wood', 'stone', 'found'], use: 'tool', tier: 1 },
  brush: {
    family: 'tool',
    accepts: ['wood', 'plant', 'found'],
    materials: ['twig', 'grass-wisp', 'reed', 'feather'],
    use: 'tool',
    tier: 1,
    companionshipHook:
      'You brush trail dust from Datou while it leans into the slow, familiar care.',
    inspiration: 'home + clear + any season + calm mood, bond 10+',
    world: { heightM: 0.48, shadowRadiusM: 0.22, colliderM: 0, placement: 'billboard' },
  },
  wayfinder: {
    family: 'tool',
    accepts: ['wood', 'stone', 'found'],
    materials: ['driftwood', 'flat-stone', 'shell', 'old-bolt'],
    use: 'tool',
    tier: 1,
    companionshipHook:
      'You mark a favorite route, and Datou later recognizes the way back to its shared memory.',
    inspiration: 'trail + fog + autumn + Explorer personality, bond 20+',
    world: { heightM: 0.42, shadowRadiusM: 0.24, colliderM: 0, placement: 'billboard' },
  },
  'field-glass': {
    family: 'tool',
    accepts: ['wood', 'plant', 'found'],
    materials: ['driftwood', 'reed', 'shell', 'old-bolt'],
    use: 'tool',
    tier: 1,
    companionshipHook:
      'You point out a distant detail and Datou turns its visor toward the same discovery.',
    inspiration: 'meadow + clear + any season + curious mood, bond 25+',
    world: { heightM: 0.5, shadowRadiusM: 0.28, colliderM: 0, placement: 'billboard' },
  },
} as const satisfies Record<string, CoreForm>;

type CoreFormId = keyof typeof CORE_FORMS;
export type FormId = CoreFormId | CatalogFormId;

/** The ten hand-authored forms revealed by the home coffer in the first session. */
export const STARTER_ITEM_FORMS = [
  'sprout-pot',
  'mailbox',
  'mushroom-lamp',
  'chime',
  'pet-bed',
  'stool',
  'food-bowl',
  'garden-lantern',
  'seed-chest',
  'repair-toy',
] as const satisfies readonly FormId[];

function defaultCoreRarity(def: CoreForm): ItemRarity {
  if (def.tier === 1) return 'common';
  if (def.tier === 2) return 'uncommon';
  return 'rare';
}

function coreIdentity(id: CoreFormId, def: CoreForm): FormIdentity {
  const name = id.replaceAll('-', ' ');
  const silhouette = CORE_SILHOUETTES[id] ?? FAMILY_SILHOUETTES[def.family];
  return {
    name,
    silhouette,
    proportions: coreProportions(silhouette),
    functionalCue: `${name} function must be readable from its silhouette before material or finish`,
    signatureFeatures: [
      `${name} defining outer contour`,
      `${name} functional working detail`,
      `one restrained asymmetrical handmade feature`,
    ],
    duplicateGroup: `core-${def.family}`,
  };
}

const FAMILY_SILHOUETTES: Record<FormFamily, IdentitySilhouette> = {
  component: 'joint',
  furnishing: 'utility',
  structure: 'house',
  datou: 'pet-play',
  keepsake: 'memory',
  tool: 'hand-tool',
};

const CORE_SILHOUETTES: Partial<Record<CoreFormId, IdentitySilhouette>> = {
  bundle: 'binding',
  pile: 'slab',
  cord: 'binding',
  beam: 'beam',
  post: 'beam',
  panel: 'panel',
  ring: 'mechanism',
  vessel: 'storage',
  wheel: 'mechanism',
  block: 'slab',
  fence: 'frame',
  gate: 'frame',
  bench: 'seat-wide',
  table: 'table',
  stool: 'seat',
  lamp: 'light',
  lantern: 'light',
  planter: 'garden',
  trellis: 'garden',
  birdbath: 'garden',
  chime: 'sound',
  mobile: 'display',
  'path-tile': 'slab',
  sign: 'display',
  mat: 'textile',
  basket: 'storage',
  'cache-box': 'storage',
  'drinking-bowl': 'pet-care',
  'bug-hotel': 'garden',
  'sprout-pot': 'garden',
  mailbox: 'storage',
  'food-bowl': 'pet-care',
  'garden-lantern': 'light',
  'seed-chest': 'storage',
  'steam-rest': 'kitchen',
  'nose-puzzle-drawer': 'pet-play',
  'paw-rinse-step': 'pet-care',
  'moonwater-lamp': 'light',
  'bird-nesting-fiber-frame': 'garden',
  'weather-log-wheel': 'instrument',
  'spin-choice-wheel': 'pet-play',
  'shared-snack-tin': 'kitchen',
  shelter: 'house',
  archway: 'canopy',
  pergola: 'canopy',
  'bridge-plank': 'bridge',
  'lookout-perch': 'tower',
  shrine: 'display',
  well: 'garden',
  'cold-frame': 'garden',
  campfire: 'light',
  raft: 'bridge',
  garland: 'seasonal',
  'collar-charm': 'display',
  ramp: 'pet-course',
  tunnel: 'pet-course',
  'ball-run': 'pet-play',
  'play-ball': 'pet-play',
  'pet-bed': 'pet-rest',
  'memory-frame': 'memory',
  'postcard-stand': 'display',
  cairn: 'display',
  'wind-vane': 'instrument',
  'music-post': 'sound',
  stick: 'pet-play',
  'repair-toy': 'memory',
  axe: 'hand-tool',
  pickaxe: 'hand-tool',
  shears: 'hand-tool',
  scoop: 'hand-tool',
  brush: 'hand-tool',
  wayfinder: 'instrument',
  'field-glass': 'instrument',
};

function coreProportions(silhouette: IdentitySilhouette): FormIdentity['proportions'] {
  if (['beam', 'binding', 'conduit', 'hand-tool'].includes(silhouette)) return 'long-thin';
  if (['bridge', 'pet-course'].includes(silhouette)) return 'long-wide';
  if (['slab', 'panel', 'textile'].includes(silhouette)) return 'flat';
  if (['seat-wide', 'table', 'pet-rest'].includes(silhouette)) return 'low-wide';
  if (['tower', 'light'].includes(silhouette)) return 'tall';
  if (['house', 'canopy', 'pavilion', 'workshop', 'storage'].includes(silhouette)) return 'wide';
  if (['frame', 'garden', 'utility', 'kitchen', 'pet-care', 'display'].includes(silhouette))
    return 'upright';
  return 'compact';
}

const NORMALIZED_CORE_FORMS = Object.fromEntries(
  Object.entries(CORE_FORMS).map(([id, def]) => [
    id,
    {
      ...def,
      rarity: 'rarity' in def ? def.rarity : defaultCoreRarity(def),
      identity: 'identity' in def ? def.identity : coreIdentity(id as CoreFormId, def),
    },
  ]),
) as unknown as Record<CoreFormId, Form>;

/** Complete 500+ form registry: hand-authored core first, broad catalog next. */
export const FORMS: Readonly<Record<FormId, Form>> = {
  ...NORMALIZED_CORE_FORMS,
  ...CATALOG_FORMS,
};

export const FORM_IDS = Object.keys(FORMS) as FormId[];

export function form(id: FormId): Form {
  return FORMS[id];
}
