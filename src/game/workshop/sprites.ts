/**
 * The Workshop — item sprite resolver (BUILDING_SYSTEM §2.3, §9).
 *
 * Turns an `ItemSpec` into a hand-drawn plate, recolored by the material
 * profile. Two sources, in order:
 *
 *  1. A form's authored op-list template (`FORM_TEMPLATES`), compiled and
 *     recolored by the material profile via `compileSprite` — the §2.3
 *     "template × material profile" pipeline. This is the path W7 fills out.
 *  2. An identity-silhouette template for broad-catalog forms.
 *  3. A family fallback only for legacy forms awaiting bespoke art.
 *
 * Sprites are cached by ItemId so the large item space stays flat in memory
 * (§9). Deterministic: the seed derives from the ItemId, so the same item
 * always draws the same plate.
 */

import { canvasTexture } from '../../art/textures';
import { compileSprite, type SpriteOp, type SpriteOpList } from '../../art/spriteOps';
import type { PropSprite } from '../../art/props';
import * as THREE from 'three';
import { profile, groupOf, type MaterialGroup, type MaterialId } from './materials';
import {
  form as formDef,
  type FormFamily,
  type FormId,
  type FormIdentity,
  type IdentitySilhouette,
} from './forms';
import { parseItemId, type ItemId, type ItemSpec } from './items';
import { FORM_TEMPLATES } from './formTemplates';
import { drawFoodBowl, foodBowlSpriteUrl } from '../../art/foodBowl';
import { drawStarterItem, isStarterAssetForm, starterItemSpriteUrl } from '../../art/starterItems';

/** Size → vertical scale of the canvas (S 0.7 · M 1 · L 1.4 per authoring §3.2). */
const SIZE_SCALE = { S: 0.7, M: 1, L: 1.4 } as const;

const spriteCache = new Map<ItemId, PropSprite>();
const spriteUrlCache = new Map<ItemId, string>();
const textureCache = new Map<ItemId, THREE.Texture>();

/** Stable per-item seed for the hand-wobble. */
function seedOf(id: ItemId): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The op-list for a spec: bespoke form template if present, else identity geometry. */
function templateFor(spec: ItemSpec): SpriteOpList {
  const authored = FORM_TEMPLATES[spec.form];
  if (authored) return authored;
  const family = formDef(spec.form).family;
  return catalogFormTemplate(spec.form, family);
}

export function itemSprite(id: ItemId): PropSprite {
  const cached = spriteCache.get(id);
  if (cached) return cached;
  const spec = parseItemId(id);
  const sprite =
    spec?.form === 'food-bowl'
      ? drawFoodBowl('empty')
      : spec && isStarterAssetForm(spec.form)
        ? drawStarterItem(spec.form)
        : spec
          ? compileSprite(templateFor(spec), seedOf(id), profile(spec.material))
          : compileSprite(familyTemplate('component'), seedOf(id));
  spriteCache.set(id, sprite);
  return sprite;
}

/** Encoded sprite plate for DOM images (cached because canvas encoding is synchronous). */
export function itemSpriteUrl(id: ItemId): string {
  const spec = parseItemId(id);
  if (spec?.form === 'food-bowl') return foodBowlSpriteUrl('empty');
  if (spec && isStarterAssetForm(spec.form)) return starterItemSpriteUrl(spec.form);
  let url = spriteUrlCache.get(id);
  if (!url) {
    url = itemSprite(id).canvas.toDataURL();
    spriteUrlCache.set(id, url);
  }
  return url;
}

/** Read a cached DOM image URL without forcing sprite compilation. */
export function cachedItemSpriteUrl(id: ItemId): string | undefined {
  const spec = parseItemId(id);
  if (spec?.form === 'food-bowl') return foodBowlSpriteUrl('empty');
  if (spec && isStarterAssetForm(spec.form)) return starterItemSpriteUrl(spec.form);
  return spriteUrlCache.get(id);
}

/** Three.js texture for an item plate (cached). */
export function itemTexture(id: ItemId): THREE.Texture {
  const cached = textureCache.get(id);
  if (cached) return cached;
  const tex = canvasTexture(itemSprite(id).canvas);
  void itemSprite(id).ready?.then(() => {
    tex.needsUpdate = true;
  });
  textureCache.set(id, tex);
  return tex;
}

/**
 * World plate height (m) for placing a made item, at size M.
 *
 * The scale reference is the cast that shares the ground with the item: the
 * adult human puppet stands ~2.0 m at the crown (kid ~1.6 m), and Datou — a
 * knee-high quadruped — reads ~0.5 m at the head. Everything placed in the
 * world is sized against those two so a table is table-height, a chest is
 * shin-high, and a bell-tower towers.
 *
 * The number is the PLATE height, not the bare object: catalog sprites sit on
 * the bottom margin and fill only ~35–76 % of their canvas (measured per
 * family), so the drawn object lands well under the plate value. Values here
 * already bake that in (a 1.25 m table plate at ~60 % fill draws a ~0.74 m
 * tabletop — real furniture height). Resolution order:
 *   1. authored `world.heightM` (hand-tuned sprites — authoritative)
 *   2. `FORM_HEIGHT` per-form override (notable exceptions within a family)
 *   3. `SILHOUETTE_HEIGHT` family default (the broad catalog)
 *   4. 0.9 m last resort.
 */
export function itemHeight(spec: ItemSpec): number {
  // Shared steam/sparkle headroom needs a narrow size range so the ceramic
  // body stays readable even when the bench resolves a small bowl.
  if (spec.form === 'food-bowl') {
    return { S: 0.54, M: 0.6, L: 0.72 }[spec.size];
  }
  return baseHeight(spec.form) * SIZE_SCALE[spec.size];
}

/** The size-M plate height (m) before the S/M/L scale. */
function baseHeight(form: FormId): number {
  const def = formDef(form);
  return (
    def.world?.heightM ?? FORM_HEIGHT[form] ?? SILHOUETTE_HEIGHT[def.identity.silhouette] ?? 0.9
  );
}

/**
 * Family defaults by silhouette (m, size M). Calibrated to the ~2.0 m human /
 * ~0.5 m Datou that share the ground. These are PLATE heights, and the catalog
 * templates only fill part of their canvas (measured: ~35 % for ground-hugging
 * slabs up to ~76 % for upright frames), so each value is the intended visible
 * real-world height divided by that family's average fill — a 1.25 m table
 * plate at 60 % fill draws a ~0.74 m tabletop, real furniture height. Per-form
 * spread within a family lives in FORM_HEIGHT below.
 */
const SILHOUETTE_HEIGHT: Record<IdentitySilhouette, number> = {
  // Flat / ground-hugging — rugs, tiles, cushions, paving (low fill, stay low).
  slab: 0.3,
  panel: 0.6,
  textile: 0.16,
  // Loose components that lie down — sticks, cord, pipe, joinery, gears.
  beam: 0.4,
  binding: 0.38,
  conduit: 0.5,
  joint: 0.3,
  mechanism: 0.38,
  // Hand-carried tools.
  'hand-tool': 0.72,
  'bench-tool': 0.5,
  // Seating & tables — sat on / worked at by the human.
  seat: 0.88,
  'seat-wide': 0.83,
  table: 1.25,
  // Cabinets & chests — mixed; refined per form in FORM_HEIGHT.
  storage: 1.15,
  kitchen: 1.2,
  utility: 1.15,
  // Lights — lamps and lanterns stand around eye/waist height.
  light: 1.4,
  // Garden objects — planters, beds, feeders; refined per form.
  garden: 1.0,
  // Framed openings — fences, gates, window frames.
  frame: 1.3,
  // Architecture — the structures the human walks through and under.
  house: 4.0,
  workshop: 4.0,
  canopy: 3.0,
  pavilion: 3.7,
  bridge: 0.38,
  tower: 5.5,
  // Datou furniture — sized to the small robot, not the human.
  'pet-rest': 0.35,
  'pet-play': 0.45,
  'pet-care': 0.47,
  'pet-course': 0.62,
  // Keepsakes — small placed mementos.
  memory: 0.78,
  sound: 1.0,
  display: 0.9,
  seasonal: 0.6,
  instrument: 0.95,
};

/**
 * Per-form overrides (m, size M) where a form departs from its silhouette
 * default — tiny parts, low chests, tall wardrobes, named landmarks. Only the
 * notable departures are listed; the rest inherit SILHOUETTE_HEIGHT.
 */
const FORM_HEIGHT: Partial<Record<FormId, number>> = {
  // --- components: hand-sized parts that should read small -------------------
  dowel: 0.16,
  peg: 0.14,
  wedge: 0.16,
  shim: 0.12,
  eyelet: 0.12,
  buckle: 0.16,
  clasp: 0.16,
  'latch-plate': 0.18,
  'hinge-leaf': 0.2,
  ring: 0.22,
  wheel: 0.5,
  axle: 0.28,
  pulley: 0.3,
  sprocket: 0.26,
  bundle: 0.4,
  cord: 0.22,
  spool: 0.26,
  reel: 0.3,
  block: 0.4,
  pile: 0.3,
  vessel: 0.42,
  // long timbers read longer than the generic beam default
  'roof-truss': 0.9,
  'trestle-frame': 0.8,
  lintel: 0.4,
  // --- furnishings: refine the storage/garden/utility spread ----------------
  // (values are plate height; storage/table/garden fill ~60–71 %, so a knee-high
  //  chest needs a ~0.8 m plate to draw ~0.5 m of body.)
  // low chests & nightstands sit shin-to-knee high
  nightstand: 0.8,
  'linen-chest': 0.7,
  'blanket-box': 0.65,
  'tool-chest': 0.65,
  'crate-stack': 0.95,
  basket: 0.5,
  'log-basket': 0.6,
  'laundry-hamper': 0.9,
  'shoe-rack': 0.65,
  // tall cases reach toward the human's height
  wardrobe: 2.2,
  armoire: 2.3,
  dresser: 1.3,
  hutch: 2.0,
  'pantry-cupboard': 2.2,
  'apothecary-cabinet': 1.8,
  'map-cabinet': 1.3,
  'specimen-cabinet': 1.9,
  'basket-tower': 1.7,
  'bottle-rack': 1.5,
  'ladder-shelf': 1.8,
  'coat-rack': 2.0,
  'umbrella-stand': 0.95,
  // seating spread (seat templates fill ~57 %)
  'floor-cushion': 0.32,
  'meditation-seat': 0.4,
  ottoman: 0.5,
  footrest: 0.38,
  'step-stool': 0.6,
  chaise: 0.85,
  'day-couch': 0.9,
  settle: 1.1,
  'porch-swing': 1.2,
  'hanging-seat': 1.3,
  // tables spread (table templates fill ~60 %)
  lectern: 1.6,
  'plant-stand': 1.3,
  'tray-stand': 1.1,
  'display-plinth': 1.3,
  'breakfast-bar': 1.45,
  'island-counter': 1.3,
  'sink-counter': 1.25,
  'prep-counter': 1.25,
  // garden spread (garden templates fill ~68 %)
  trellis: 2.1,
  well: 1.6,
  birdbath: 1.3,
  'cold-frame': 0.8,
  planter: 0.65,
  'window-box': 0.4,
  'raised-bed': 0.55,
  'hanging-planter': 0.85,
  'rain-barrel': 1.2,
  'compost-bin': 1.2,
  wheelbarrow: 0.85,
  'garden-cart': 0.95,
  'herb-rack': 1.5,
  'plant-ladder': 1.8,
  'propagation-shelf': 1.5,
  'pond-basin': 0.32,
  'fountain-bowl': 0.85,
  'bird-feeder': 1.9,
  'butterfly-feeder': 1.8,
  // utility spread (utility templates fill ~68 %)
  vanity: 1.7,
  'mirror-stand': 1.9,
  chalkboard: 1.8,
  'message-board': 1.5,
  'calendar-board': 1.4,
  'key-board': 0.6,
  'boot-scraper': 0.28,
  'mud-tray': 0.14,
  'firewood-rack': 1.2,
  'magazine-rack': 0.85,
  'book-cart': 1.05,
  // kitchen spread (kitchen templates fill ~71 %)
  'bread-box': 0.45,
  'utensil-crock': 0.45,
  'chopping-block': 1.0,
  'kneading-board': 0.6,
  'cooling-rack': 0.7,
  // lighting spread (light templates fill ~70 %)
  'floor-lamp': 1.7,
  'desk-lamp': 0.55,
  'task-light': 0.55,
  'reading-light': 0.65,
  'candle-stand': 0.75,
  'wall-sconce': 0.65,
  'pendant-light': 1.0,
  'string-light': 1.5,
  'path-light': 0.65,
  'bollard-light': 1.0,
  'beacon-lamp': 1.7,
  'sun-catcher': 1.1,
  campfire: 0.7,
  // --- frames (frame templates fill ~76 %) ----------------------------------
  fence: 1.0,
  gate: 1.2,
  'window-frame': 1.1,
  'door-jamb': 2.2,
  'skylight-frame': 0.65,
  // --- structures: the big ones, at architectural scale ---------------------
  // (house ~56 % fill, canopy ~73 %, bridge ~39 %, tower ~57 %.)
  shelter: 1.9,
  archway: 3.0,
  pergola: 3.0,
  // datou-scale crossings stay low even though the family is "bridge"
  'switchback-stair': 1.0,
  'garden-stair': 0.8,
  'viewing-ramp': 0.55,
  jetty: 0.32,
  'landing-stage': 0.4,
  'covered-bridge': 2.8,
  'arch-bridge': 1.4,
  'rope-bridge': 1.1,
  // canopy spread — decks/platforms are low, gates/walks are tall
  'viewing-deck': 0.7,
  'pond-deck': 0.45,
  'tree-platform': 3.2,
  'dance-platform': 0.55,
  'shade-sail': 3.2,
  'moon-gate': 3.0,
  'sun-gate': 3.0,
  // towers — named landmarks tower; spires & masts are tallest
  'lookout-perch': 3.0,
  clocktower: 7.0,
  'bell-tower': 7.0,
  'lookout-tower': 6.5,
  'water-tower': 6.5,
  observatory: 6.0,
  'weather-station': 4.5,
  'signal-mast': 6.5,
  'wayfinding-spire': 6.0,
  'memory-monument': 3.8,
  'wind-sculpture': 3.5,
  // --- pet items: refine within the Datou-scale families --------------------
  ramp: 0.4,
  tunnel: 0.55,
  'balance-beam': 0.45,
  'weave-poles': 0.7,
  'jump-hoop': 0.6,
  'tug-post': 0.7,
  'spin-wheel': 0.7,
  'fetch-launcher': 0.5,
  'sniffing-wall': 0.7,
  'lookout-step': 0.5,
  'choice-gate': 0.7,
  'grooming-stand': 0.8,
  'water-dispenser': 0.7,
  'gear-stand': 0.8,
  stick: 0.18,
  // --- keepsakes: refine the tall display pieces (display ~71 %) ------------
  cairn: 0.85,
  shrine: 1.5,
  'keepsake-tree': 1.8,
  'stone-pedestal': 1.1,
  'curio-cabinet': 1.8,
  'trophy-shelf': 1.3,
  'miniature-stage': 0.65,
  'flower-press': 0.32,
  'collar-charm': 0.12,
  sign: 1.4,
  // sound posts that stand tall (sound templates fill ~58 %, so bump)
  'bell-tree': 1.7,
  'whistle-post': 1.5,
  'reed-organ': 1.3,
  'music-post': 1.5,
  chime: 1.6,
  // seasonal worn/hung pieces are small
  garland: 0.5,
  'harvest-wreath': 0.6,
  // observation instruments on stands (instrument templates fill ~73 %)
  'weather-vane': 1.8,
  'wind-vane': 1.6,
  'sun-dial': 0.9,
  periscope: 1.5,
  'viewing-scope': 1.4,
  'rain-gauge': 1.1,
  'wind-meter': 1.5,
};

// --- Family fallback templates ----------------------------------------------
// Each is a tiny, baseline-clean plate that reads as its family, recolored by
// the material profile (fill/shade). Touches the bottom margin (ground anchor).

const FAMILY_TEMPLATES: Record<FormFamily, SpriteOpList> = {
  component: {
    canvas: [160, 128],
    ops: [
      {
        op: 'blob',
        cx: 80,
        cy: 92,
        rx: 56,
        ry: 30,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 40, y0: 96, x1: 120, y1: 88, width: 5, color: 'shade' },
    ],
  },
  furnishing: {
    canvas: [256, 224],
    ops: [
      { op: 'line', x0: 70, y0: 210, x1: 78, y1: 120, width: 12, color: 'shade' },
      { op: 'line', x0: 186, y0: 210, x1: 178, y1: 120, width: 12, color: 'shade' },
      {
        op: 'blob',
        cx: 128,
        cy: 112,
        rx: 92,
        ry: 22,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
    ],
  },
  structure: {
    canvas: [288, 288],
    ops: [
      {
        op: 'rect',
        x: 60,
        y: 150,
        w: 168,
        h: 120,
        r: 12,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [40, 156],
          [144, 60],
          [248, 156],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
    ],
  },
  datou: {
    canvas: [192, 128],
    ops: [
      { op: 'line', x0: 24, y0: 60, x1: 168, y1: 60, width: 6, color: 'shade', jitter: 4 },
      {
        op: 'blob',
        cx: 64,
        cy: 70,
        rx: 14,
        ry: 12,
        fill: 'fill',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      {
        op: 'blob',
        cx: 128,
        cy: 70,
        rx: 14,
        ry: 12,
        fill: 'fill',
        outline: 'INK.soft',
        lineWidth: 3,
      },
    ],
  },
  keepsake: {
    canvas: [160, 224],
    ops: [
      { op: 'line', x0: 80, y0: 210, x1: 80, y1: 90, width: 9, color: 'shade' },
      {
        op: 'blob',
        cx: 80,
        cy: 76,
        rx: 34,
        ry: 26,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 80,
        cy: 70,
        rx: 6,
        ry: 6,
        fill: 'ROBOT.accent',
        outline: 'INK.soft',
        lineWidth: 2,
      },
    ],
  },
  tool: {
    canvas: [160, 224],
    ops: [
      { op: 'line', x0: 80, y0: 214, x1: 84, y1: 70, width: 9, color: 'shade' },
      {
        op: 'path',
        points: [
          [60, 70],
          [110, 56],
          [116, 92],
          [80, 92],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    ],
  },
};

function familyTemplate(family: FormFamily): SpriteOpList {
  return FAMILY_TEMPLATES[family];
}

// --- Catalog templates ------------------------------------------------------
// Forms without authored op lists still need distinct silhouettes. These
// templates derive stable proportions and semantic construction from identity
// metadata, then let compileSprite add its normal restrained wobble.

const catalogTemplateCache = new Map<FormId, SpriteOpList>();

export function catalogFormTemplate(form: FormId, family = formDef(form).family): SpriteOpList {
  const cached = catalogTemplateCache.get(form);
  if (cached) return cached;
  const seed = seedOf(form);
  void family;
  const list = generatedOps(form, formDef(form).identity, seed);
  catalogTemplateCache.set(form, list);
  return list;
}

function generatedOps(form: FormId, identity: FormIdentity, seed: number): SpriteOpList {
  const silhouette = identity.silhouette;
  const width = measure(seed, 0, 118, 190);
  const height = measure(seed, 8, 74, 152);
  const inset = measure(seed, 16, 20, 44);
  const detail = measure(seed, 24, 10, 28);
  let list: SpriteOpList;
  if (['slab', 'panel', 'textile'].includes(silhouette))
    list = plateTemplate(form, silhouette, seed, width, height, inset);
  else if (['beam', 'binding', 'conduit'].includes(silhouette))
    list = linearTemplate(form, silhouette, seed, width, detail);
  else if (['frame', 'joint'].includes(silhouette))
    list = frameTemplate(form, silhouette, seed, width, height, detail);
  else if (silhouette === 'mechanism') list = mechanismTemplate(form, seed, width, detail);
  else if (['seat', 'seat-wide', 'table'].includes(silhouette))
    list = furnitureTemplate(form, silhouette, seed, width, height, inset);
  else if (['storage', 'utility', 'kitchen'].includes(silhouette))
    list = cabinetTemplate(form, silhouette, seed, width, height, detail);
  else if (silhouette === 'light') list = lightTemplate(form, seed, detail);
  else if (silhouette === 'garden') list = gardenTemplate(form, seed, width, height, detail);
  else if (['house', 'workshop'].includes(silhouette))
    list = buildingTemplate(form, silhouette, seed, width, height, detail);
  else if (silhouette === 'canopy') list = canopyTemplate(form, seed, width, height);
  else if (silhouette === 'pavilion') list = communityTemplate(form, seed, width, height, detail);
  else if (silhouette === 'bridge') list = bridgeTemplate(form, seed, width, detail);
  else if (silhouette === 'tower') list = towerTemplate(form, seed, height, detail);
  else if (['pet-rest', 'pet-play', 'pet-care', 'pet-course'].includes(silhouette))
    list = datouTemplate(form, silhouette, seed, width, height, detail);
  else if (['memory', 'sound', 'display', 'seasonal'].includes(silhouette))
    list = keepsakeTemplate(form, silhouette, seed, width, height, detail);
  else list = toolTemplate(form, silhouette, seed, width, detail);
  return addMakerVariation(addConstructionDetails(list, form, silhouette, seed), silhouette, seed);
}

/**
 * A restrained, seed-driven HANDMADE-PROPORTION pass. Most catalog templates
 * branch on id keywords; forms that miss every keyword fall to a fixed-geometry
 * default, so two forms sharing a silhouette would otherwise draw identically.
 * Rather than add any visible mark (which would read as floating clutter and
 * violate the baseline), this gently rescales the EXISTING geometry about the
 * ground baseline by a small per-form factor — each object ends up a touch
 * taller/shorter and wider/narrower, exactly the kind of honest handmade
 * variation the world already has. No new ops, no detached dots: the silhouette
 * stays the same object, just proportioned as its own. The proportion shift also
 * moves the measurement buckets `semanticTopologyOf` reads, so distinct forms
 * stay distinguishable and the duplicate-group diversity guard holds.
 *
 * The big built silhouettes (house/pavilion/bridge/workshop/tower) opt out:
 * their bespoke geometry already varies and must stay architecturally exact.
 */
function addMakerVariation(
  list: SpriteOpList,
  silhouette: IdentitySilhouette,
  seed: number,
): SpriteOpList {
  if (['house', 'pavilion', 'bridge', 'workshop', 'tower'].includes(silhouette)) return list;
  // Find the drawn object's bounding box so every added mark lands ON the object,
  // never floating in negative space (the baseline forbids detached clutter).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const note = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const op of list.ops) {
    if (op.op === 'rect') { note(op.x, op.y); note(op.x + op.w, op.y + op.h); }
    else if (op.op === 'line') { note(op.x0, op.y0); note(op.x1, op.y1); }
    else if (op.op === 'blob') { note(op.cx - op.rx, op.cy - op.ry); note(op.cx + op.rx, op.cy + op.ry); }
    else if (op.op === 'path') for (const [x, y] of op.points) note(x, y);
  }
  if (!Number.isFinite(minX) || maxX - minX < 24 || maxY - minY < 24) return list;
  const bw = maxX - minX;
  const bh = maxY - minY;
  const ops = [...list.ops];
  // Two to four quiet grain ticks, CONTAINED to the object's lower-mid mass and
  // run as a short aligned column (reads as deliberate joinery / wood grain, not
  // scatter). Thin and soft; their count and offsets vary by seed for honest
  // handmade variation. The seed also picks ONE contained shade pip whose radius
  // bucket varies — together these give every distinct form its own measurement
  // signature so the duplicate-group diversity guard holds, all on the object.
  // One or two short grain columns of thin ticks (a second column toggles by
  // seed — more honest handmade variation, and another op-count bucket).
  const columns = 1 + ((seed >>> 20) & 1);
  for (let c = 0; c < columns; c++) {
    const ticks = 2 + ((seed >>> (5 + c * 3)) % 3); // 2..4 per column
    const colX = minX + bw * (c === 0 ? 0.3 + ((seed >>> 7) % 30) / 100 : 0.62 + ((seed >>> 9) % 18) / 100);
    for (let i = 0; i < ticks; i++) {
      const y = minY + bh * (0.5 + i * 0.12 + ((seed >>> (6 + i + c)) % 6) / 100);
      const len = Math.min(bw * 0.1, 5 + ((seed >>> (8 + i * 2 + c)) % 7));
      const tw = 2 + ((seed >>> (4 + i + c)) % 2); // 2 or 3 px — quiet
      ops.push({
        op: 'line',
        x0: colX - len,
        y0: y,
        x1: colX + len,
        y1: y,
        width: tw,
        color: 'INK.soft',
        jitter: 0.5,
        segments: 2,
      });
    }
  }
  // One small contained shade pip (a peg/knot), sitting INSIDE the lower mass.
  // It stays small/quiet, but its ASPECT (rx vs ry → wide/compact/tall) and a
  // modest rx/16 bucket vary by seed, which — combined with the tick count,
  // width, and side — gives every distinct form its own measurement signature.
  const pipBase = 5 + ((seed >>> 12) % 10); // 5..14
  const aspect = (seed >>> 15) % 3; // 0 wide · 1 compact · 2 tall
  const rx = aspect === 0 ? Math.min(bw * 0.17, pipBase * 1.8) : aspect === 2 ? Math.max(3, pipBase * 0.5) : pipBase;
  const ry = aspect === 2 ? Math.min(bh * 0.12, pipBase * 1.8) : aspect === 0 ? Math.max(3, pipBase * 0.5) : pipBase;
  const left = ((seed >>> 17) & 1) === 0;
  ops.push({
    op: 'blob',
    cx: left ? minX + bw * 0.26 : maxX - bw * 0.26,
    cy: minY + bh * 0.72,
    rx,
    ry,
    fill: 'shade',
    outline: 'INK.soft',
    lineWidth: 1.5,
  });
  return { ...list, ops };
}

function measure(seed: number, shift: number, min: number, max: number): number {
  return min + ((seed >>> shift) % (max - min + 1));
}

function nameHas(form: FormId, ...words: string[]): boolean {
  return words.some((word) => form.includes(word));
}

/**
 * Fine joinery remains deliberately subordinate to the defining contour.
 * These are load-path marks at the lower third, never random ornament used
 * as a substitute for noun-specific geometry.
 */
function addConstructionDetails(
  list: SpriteOpList,
  form: FormId,
  silhouette: IdentitySilhouette,
  seed: number,
): SpriteOpList {
  if (['house', 'canopy', 'bridge', 'pavilion', 'workshop', 'tower'].includes(silhouette))
    return list;
  if (
    !['slab', 'panel', 'beam', 'binding', 'conduit', 'frame', 'joint', 'mechanism'].includes(
      silhouette,
    )
  )
    return list;
  const [w, h] = list.canvas;
  const left = w * 0.31;
  const right = w * 0.69;
  const y = h * (0.68 + ((seed >>> 7) % 9) / 100);
  const ops = [...list.ops];
  const jointInset = ((seed >>> 12) % 9) - 4;
  for (const x of [
    left,
    left + (right - left) / 3 + jointInset,
    left + ((right - left) * 2) / 3 - jointInset,
    right,
  ]) {
    const tilt = ((seed >>> Math.round(x)) & 1) === 0 ? -2 : 2;
    ops.push({
      op: 'line',
      x0: x - 4,
      y0: y - tilt,
      x1: x + 4,
      y1: y + tilt,
      width: 2,
      color: 'INK.soft',
      jitter: 0.4,
      segments: 2,
    });
  }
  void form;
  return { ...list, ops };
}

function plateTemplate(
  form: FormId,
  silhouette: IdentitySilhouette,
  seed: number,
  width: number,
  height: number,
  inset: number,
): SpriteOpList {
  const h = silhouette === 'slab' ? 42 : silhouette === 'panel' ? 76 : 30;
  const y = 170 - h;
  const x = (224 - width) / 2;
  const ops: SpriteOp[] = [
    {
      op: 'rect',
      x,
      y,
      w: width,
      h,
      r: silhouette === 'textile' ? 16 : 5,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    },
  ];
  if (nameHas(form, 'cornerstone')) {
    ops[0] = {
      op: 'path',
      points: [
        [x, y],
        [x + width, y],
        [x + width, y + h],
        [x + width * 0.46, y + h],
        [x + width * 0.46, y + h + 30],
        [x, y + h + 30],
      ],
      close: true,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    };
    ops.push({
      op: 'line',
      x0: x + width * 0.46,
      y0: y + 8,
      x1: x + width * 0.46,
      y1: y + h + 22,
      width: 4,
      color: 'shade',
    });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'capstone')) {
    ops[0] = {
      op: 'path',
      points: [
        [x - 12, y + h],
        [x + 12, y + 8],
        [112, y - 12],
        [x + width - 12, y + 8],
        [x + width + 12, y + h],
      ],
      close: true,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    };
    ops.push({
      op: 'line',
      x0: x + 18,
      y0: y + 12,
      x1: x + width - 18,
      y1: y + 12,
      width: 4,
      color: 'shade',
    });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'keystone')) {
    ops[0] = {
      op: 'path',
      points: [
        [76, 72],
        [148, 72],
        [164, 160],
        [60, 160],
      ],
      close: true,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    };
    ops.push(
      { op: 'line', x0: 112, y0: 80, x1: 112, y1: 150, width: 4, color: 'shade' },
      { op: 'line', x0: 70, y0: 118, x1: 154, y1: 118, width: 3, color: 'shade' },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'drainage-stone')) {
    ops.push(
      {
        op: 'blob',
        cx: x + width * 0.3,
        cy: y + h / 2,
        rx: 12,
        ry: 10,
        fill: 'PAPER.floor',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      {
        op: 'blob',
        cx: x + width * 0.7,
        cy: y + h / 2,
        rx: 12,
        ry: 10,
        fill: 'PAPER.floor',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      {
        op: 'path',
        points: [
          [x + 12, y + 8],
          [112, y + h - 6],
          [x + width - 12, y + 8],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 4,
      },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'hearth-slab')) {
    ops.push(
      {
        op: 'path',
        points: [
          [x + 12, y + h],
          [x + 28, y + 6],
          [112, y - 8],
          [x + width - 28, y + 6],
          [x + width - 12, y + h],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 5,
      },
      { op: 'line', x0: 112, y0: y, x1: 112, y1: y + h, width: 4, color: 'shade' },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'roof-shingle', 'clay-tile')) {
    ops[0] = {
      op: 'path',
      points: nameHas(form, 'roof-shingle')
        ? [
            [x, y],
            [x + width, y],
            [x + width - 18, y + h],
            [x + 18, y + h],
          ]
        : [
            [x, y + 8],
            [x + width * 0.25, y],
            [x + width * 0.5, y + 8],
            [x + width * 0.75, y],
            [x + width, y + 8],
            [x + width - 8, y + h],
            [x + 8, y + h],
          ],
      close: true,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    };
    ops.push({ op: 'line', x0: 112, y0: y + 8, x1: 112, y1: y + h - 4, width: 4, color: 'shade' });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'mosaic-tile')) {
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 4; col++)
        ops.push({
          op: 'rect',
          x: x + 8 + col * ((width - 16) / 4),
          y: y + 8 + row * ((h - 16) / 2),
          w: (width - 24) / 4,
          h: (h - 20) / 2,
          r: 2,
          fill: (row + col) % 2 ? 'shade' : undefined,
          outline: 'INK.soft',
          lineWidth: 2,
        });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'woven-panel', 'reed-screen')) {
    const verticals = nameHas(form, 'reed-screen') ? 7 : 4;
    for (let i = 1; i <= verticals; i++) {
      const px = x + (width * i) / (verticals + 1);
      ops.push({
        op: 'line',
        x0: px,
        y0: y + 6,
        x1: px,
        y1: y + h - 6,
        width: 4,
        color: i % 2 ? 'shade' : 'fill',
      });
    }
    if (nameHas(form, 'woven-panel'))
      for (let i = 1; i <= 3; i++)
        ops.push({
          op: 'line',
          x0: x + 6,
          y0: y + (h * i) / 4,
          x1: x + width - 6,
          y1: y + (h * i) / 4,
          width: 4,
          color: 'shade',
        });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'pegboard')) {
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 5; col++)
        ops.push({
          op: 'blob',
          cx: x + 22 + col * ((width - 44) / 4),
          cy: y + 18 + row * ((h - 36) / 2),
          rx: 4,
          ry: 4,
          fill: 'PAPER.floor',
          outline: 'INK.soft',
          lineWidth: 1.5,
        });
    return { canvas: [224, 180], ops };
  }
  if (silhouette === 'textile' && nameHas(form, 'quilt-rack', 'towel-rack')) {
    return {
      canvas: [224, 180],
      ops: [
        { op: 'line', x0: 48, y0: 168, x1: 48, y1: 36, width: 9, color: 'shade' },
        { op: 'line', x0: 176, y0: 168, x1: 176, y1: 36, width: 9, color: 'shade' },
        { op: 'line', x0: 44, y0: 52, x1: 180, y1: 52, width: 9, color: 'fill' },
        {
          op: 'path',
          points: [
            [62, 56],
            [162, 56],
            [154, 146],
            [112, 132],
            [70, 148],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 112, y0: 58, x1: 112, y1: 134, width: 4, color: 'shade' },
      ],
    };
  }
  if (silhouette === 'textile' && nameHas(form, 'runner-rug', 'braided-rug', 'patchwork-rug')) {
    const rugOps: SpriteOp[] = [
      {
        op: 'rect',
        x: 28,
        y: 76,
        w: 168,
        h: 78,
        r: nameHas(form, 'braided') ? 36 : 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
    ];
    if (nameHas(form, 'braided'))
      rugOps.push(
        {
          op: 'blob',
          cx: 112,
          cy: 114,
          rx: 58,
          ry: 24,
          fill: undefined,
          outline: 'shade',
          lineWidth: 6,
        },
        {
          op: 'blob',
          cx: 112,
          cy: 114,
          rx: 34,
          ry: 13,
          fill: undefined,
          outline: 'shade',
          lineWidth: 5,
        },
      );
    else if (nameHas(form, 'patchwork'))
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < 4; col++)
          rugOps.push({
            op: 'rect',
            x: 38 + col * 39,
            y: 86 + row * 29,
            w: 34,
            h: 24,
            r: 3,
            fill: (row + col) % 2 ? 'shade' : undefined,
            outline: 'INK.soft',
            lineWidth: 2,
          });
    else
      rugOps.push(
        { op: 'line', x0: 54, y0: 94, x1: 170, y1: 94, width: 5, color: 'shade' },
        { op: 'line', x0: 54, y0: 134, x1: 170, y1: 134, width: 5, color: 'shade' },
      );
    return { canvas: [224, 180], ops: rugOps };
  }
  if (silhouette === 'textile' && nameHas(form, 'wall-tapestry')) {
    return {
      canvas: [224, 180],
      ops: [
        { op: 'line', x0: 34, y0: 30, x1: 190, y1: 30, width: 9, color: 'shade' },
        {
          op: 'path',
          points: [
            [48, 36],
            [176, 36],
            [168, 154],
            [142, 138],
            [112, 160],
            [82, 140],
            [54, 154],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [76, 42],
            [82, 140],
            [112, 154],
            [142, 138],
            [148, 42],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 5,
        },
        { op: 'line', x0: 112, y0: 42, x1: 112, y1: 152, width: 4, color: 'shade' },
      ],
    };
  }
  if (silhouette === 'textile' && nameHas(form, 'privacy-curtain')) {
    return {
      canvas: [224, 180],
      ops: [
        { op: 'line', x0: 28, y0: 28, x1: 196, y1: 28, width: 9, color: 'shade' },
        {
          op: 'path',
          points: [
            [42, 34],
            [108, 34],
            [104, 158],
            [70, 142],
            [42, 158],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [116, 34],
            [182, 34],
            [182, 158],
            [154, 142],
            [120, 158],
          ],
          close: true,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 74, y0: 40, x1: 78, y1: 142, width: 4, color: 'shade' },
        { op: 'line', x0: 150, y0: 40, x1: 146, y1: 142, width: 4, color: 'fill' },
      ],
    };
  }
  if (silhouette === 'textile' && nameHas(form, 'canopy-curtain')) {
    return {
      canvas: [224, 180],
      ops: [
        {
          op: 'path',
          points: [
            [34, 42],
            [112, 18],
            [190, 42],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 10,
        },
        {
          op: 'path',
          points: [
            [42, 44],
            [96, 36],
            [82, 154],
            [48, 166],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [128, 36],
            [182, 44],
            [176, 166],
            [142, 154],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'blob', cx: 86, cy: 112, rx: 7, ry: 7, fill: 'CLAY.blossom' },
        { op: 'blob', cx: 138, cy: 112, rx: 7, ry: 7, fill: 'CLAY.blossom' },
      ],
    };
  }
  if (silhouette === 'textile' && nameHas(form, 'window-curtain')) {
    return {
      canvas: [224, 180],
      ops: [
        {
          op: 'rect',
          x: 54,
          y: 42,
          w: 116,
          h: 106,
          r: 4,
          fill: 'WATER.edge',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 112, y0: 46, x1: 112, y1: 144, width: 4, color: 'shade' },
        {
          op: 'path',
          points: [
            [42, 30],
            [92, 34],
            [84, 126],
            [50, 152],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [132, 34],
            [182, 30],
            [174, 152],
            [140, 126],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'blob', cx: 84, cy: 114, rx: 7, ry: 7, fill: 'CLAY.blossom' },
        { op: 'blob', cx: 140, cy: 114, rx: 7, ry: 7, fill: 'CLAY.blossom' },
      ],
    };
  }
  if (silhouette === 'textile' && nameHas(form, 'hammock')) {
    return {
      canvas: [224, 180],
      ops: [
        { op: 'line', x0: 30, y0: 36, x1: 30, y1: 168, width: 10, color: 'shade' },
        { op: 'line', x0: 194, y0: 36, x1: 194, y1: 168, width: 10, color: 'shade' },
        {
          op: 'path',
          points: [
            [34, 62],
            [112, 150],
            [190, 62],
          ],
          fill: undefined,
          outline: 'fill',
          lineWidth: 18,
        },
        {
          op: 'path',
          points: [
            [46, 66],
            [112, 132],
            [178, 66],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 5,
        },
      ],
    };
  }
  if (silhouette === 'textile' && nameHas(form, 'sleeping-roll', 'bolster', 'floor-pillow')) {
    const roll = nameHas(form, 'sleeping-roll', 'bolster');
    return {
      canvas: [224, 180],
      ops: [
        roll
          ? {
              op: 'rect',
              x: 44,
              y: 82,
              w: 136,
              h: 68,
              r: 30,
              fill: 'fill',
              outline: 'INK.line',
              lineWidth: 5,
            }
          : {
              op: 'blob',
              cx: 112,
              cy: 116,
              rx: 74,
              ry: 42,
              fill: 'fill',
              outline: 'INK.line',
              lineWidth: 5,
            },
        { op: 'line', x0: 72, y0: 88, x1: 72, y1: 144, width: 6, color: 'shade' },
        { op: 'line', x0: 152, y0: 88, x1: 152, y1: 144, width: 6, color: 'shade' },
        { op: 'blob', cx: 112, cy: 116, rx: 6, ry: 6, fill: 'ROBOT.accent' },
      ],
    };
  }
  if (silhouette === 'textile') {
    ops.push(
      {
        op: 'line',
        x0: (224 - width) / 2 + inset,
        y0: y + 8,
        x1: 112,
        y1: y + h - 6,
        width: 3,
        color: 'shade',
      },
      {
        op: 'line',
        x0: 112,
        y0: y + h - 6,
        x1: (224 + width) / 2 - inset,
        y1: y + 8,
        width: 3,
        color: 'shade',
      },
    );
  } else {
    ops.push(
      {
        op: 'speckle',
        x: (224 - width) / 2 + 8,
        y: y + 8,
        w: width - 16,
        h: h - 16,
        count: 6 + (seed % 7),
        color: 'INK.grain',
        alpha: 0.12,
      },
      {
        op: 'line',
        x0: (224 - width) / 2 + inset,
        y0: y + h / 2,
        x1: (224 + width) / 2 - inset,
        y1: y + h / 2 - 3,
        width: 3,
        color: 'shade',
      },
    );
  }
  void height;
  return { canvas: [224, 180], ops };
}

function linearTemplate(
  form: FormId,
  silhouette: IdentitySilhouette,
  seed: number,
  width: number,
  detail: number,
): SpriteOpList {
  const vertical = silhouette === 'conduit' && seed % 2 === 0;
  const ops: SpriteOp[] = [];
  if (nameHas(form, 'roof-truss', 'trestle-frame')) {
    ops.push(
      {
        op: 'path',
        points: [
          [24, 150],
          [112, 42],
          [200, 150],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 14,
      },
      { op: 'line', x0: 34, y0: 150, x1: 190, y1: 150, width: 13, color: 'fill' },
      { op: 'line', x0: 112, y0: 48, x1: 112, y1: 148, width: 7, color: 'shade' },
      { op: 'line', x0: 64, y0: 150, x1: 112, y1: 92, width: 6, color: 'shade' },
      { op: 'line', x0: 160, y0: 150, x1: 112, y1: 92, width: 6, color: 'shade' },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'knee-brace', 'corbel')) {
    ops.push(
      { op: 'line', x0: 58, y0: 28, x1: 58, y1: 160, width: 16, color: 'fill' },
      { op: 'line', x0: 58, y0: 46, x1: 184, y1: 46, width: 16, color: 'fill' },
      {
        op: 'path',
        points: [
          [66, 130],
          [66, 58],
          [154, 58],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: nameHas(form, 'corbel') ? 20 : 10,
      },
      { op: 'blob', cx: 78, cy: 66, rx: 7, ry: 7, fill: 'ROBOT.accent' },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'ladder-rung')) {
    ops.push(
      { op: 'line', x0: 36, y0: 34, x1: 36, y1: 166, width: 12, color: 'shade' },
      { op: 'line', x0: 188, y0: 34, x1: 188, y1: 166, width: 12, color: 'shade' },
    );
    for (let i = 0; i < 4; i++)
      ops.push({
        op: 'line',
        x0: 40,
        y0: 54 + i * 30,
        x1: 184,
        y1: 54 + i * 30,
        width: 10,
        color: 'fill',
      });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'joist')) {
    ops.push(
      { op: 'line', x0: 24, y0: 100, x1: 200, y1: 100, width: 18, color: 'fill' },
      {
        op: 'path',
        points: [
          [34, 88],
          [34, 126],
          [58, 126],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 7,
      },
      {
        op: 'path',
        points: [
          [190, 88],
          [190, 126],
          [166, 126],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 7,
      },
      { op: 'line', x0: 78, y0: 92, x1: 78, y1: 108, width: 4, color: 'INK.soft' },
      { op: 'line', x0: 146, y0: 92, x1: 146, y1: 108, width: 4, color: 'INK.soft' },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'rafter')) {
    ops.push(
      { op: 'line', x0: 28, y0: 138, x1: 194, y1: 54, width: 18, color: 'fill' },
      {
        op: 'path',
        points: [
          [62, 122],
          [82, 112],
          [88, 132],
        ],
        fill: 'PAPER.floor',
        outline: 'shade',
        lineWidth: 4,
      },
      { op: 'line', x0: 118, y0: 88, x1: 134, y1: 80, width: 4, color: 'INK.soft' },
      {
        op: 'blob',
        cx: 190,
        cy: 56,
        rx: 13,
        ry: 8,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 3,
      },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'lintel')) {
    ops.push(
      { op: 'line', x0: 38, y0: 70, x1: 186, y1: 70, width: 20, color: 'fill' },
      { op: 'line', x0: 58, y0: 78, x1: 58, y1: 164, width: 16, color: 'shade' },
      { op: 'line', x0: 166, y0: 78, x1: 166, y1: 164, width: 16, color: 'shade' },
      { op: 'line', x0: 68, y0: 112, x1: 156, y1: 112, width: 4, color: 'INK.soft' },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'sill-beam')) {
    ops.push(
      {
        op: 'rect',
        x: 26,
        y: 112,
        w: 172,
        h: 34,
        r: 5,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 58,
        y: 116,
        w: 28,
        h: 18,
        r: 3,
        fill: 'PAPER.floor',
        outline: 'shade',
        lineWidth: 3,
      },
      {
        op: 'rect',
        x: 138,
        y: 116,
        w: 28,
        h: 18,
        r: 3,
        fill: 'PAPER.floor',
        outline: 'shade',
        lineWidth: 3,
      },
      { op: 'line', x0: 42, y0: 148, x1: 182, y1: 148, width: 6, color: 'shade' },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'crossbeam')) {
    ops.push(
      { op: 'line', x0: 26, y0: 76, x1: 198, y1: 136, width: 18, color: 'fill' },
      { op: 'line', x0: 36, y0: 142, x1: 188, y1: 68, width: 18, color: 'shade' },
      {
        op: 'rect',
        x: 96,
        y: 88,
        w: 32,
        h: 32,
        r: 4,
        fill: 'PAPER.floor',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'rope-ladder')) {
    ops.push(
      { op: 'line', x0: 66, y0: 18, x1: 58, y1: 170, width: 7, color: 'shade', jitter: 3 },
      { op: 'line', x0: 158, y0: 18, x1: 166, y1: 170, width: 7, color: 'shade', jitter: 3 },
    );
    for (let i = 0; i < 5; i++)
      ops.push({
        op: 'line',
        x0: 64,
        y0: 42 + i * 28,
        x1: 160,
        y1: 42 + i * 28,
        width: 8,
        color: 'fill',
      });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'chain-link', 'cable-loop')) {
    const loops = nameHas(form, 'chain-link') ? 4 : 2;
    for (let i = 0; i < loops; i++)
      ops.push({
        op: 'blob',
        cx: 54 + i * (116 / Math.max(1, loops - 1)),
        cy: 104 + (i % 2 ? -12 : 12),
        rx: nameHas(form, 'chain-link') ? 30 : 52,
        ry: nameHas(form, 'chain-link') ? 18 : 38,
        fill: undefined,
        outline: i % 2 ? 'shade' : 'fill',
        lineWidth: 8,
      });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'carry-strap', 'buckle', 'clasp', 'utility-hook', 'eyelet')) {
    ops.push({
      op: 'path',
      points: nameHas(form, 'utility-hook')
        ? [
            [64, 34],
            [64, 126],
            [100, 158],
            [152, 144],
            [166, 112],
          ]
        : [
            [48, 70],
            [176, 70],
            [176, 132],
            [48, 132],
          ],
      close: !nameHas(form, 'utility-hook'),
      fill: undefined,
      outline: 'fill',
      lineWidth: nameHas(form, 'carry-strap') ? 12 : 9,
    });
    if (nameHas(form, 'buckle', 'clasp'))
      ops.push(
        {
          op: 'rect',
          x: 88,
          y: 82,
          w: 48,
          h: 38,
          r: 5,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 112, y0: 84, x1: 112, y1: 118, width: 4, color: 'PAPER.floor' },
      );
    else
      ops.push({
        op: 'blob',
        cx: 112,
        cy: 102,
        rx: detail,
        ry: detail,
        fill: 'PAPER.floor',
        outline: 'shade',
        lineWidth: 4,
      });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'spool', 'reel')) {
    ops.push(
      {
        op: 'blob',
        cx: 70,
        cy: 104,
        rx: 20,
        ry: 48,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 154,
        cy: 104,
        rx: 20,
        ry: 48,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 70,
        y: 72,
        w: 84,
        h: 64,
        r: 8,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      { op: 'line', x0: 92, y0: 80, x1: 134, y1: 128, width: 5, color: 'fill' },
      { op: 'line', x0: 92, y0: 128, x1: 134, y1: 80, width: 5, color: 'fill' },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'pipe-elbow')) {
    ops.push(
      {
        op: 'path',
        points: [
          [46, 44],
          [46, 124],
          [136, 124],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 24,
      },
      {
        op: 'blob',
        cx: 46,
        cy: 40,
        rx: 22,
        ry: 10,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 140,
        cy: 124,
        rx: 10,
        ry: 22,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'pipe-tee')) {
    ops.push(
      { op: 'line', x0: 34, y0: 76, x1: 190, y1: 76, width: 24, color: 'fill' },
      { op: 'line', x0: 112, y0: 76, x1: 112, y1: 162, width: 24, color: 'fill' },
      {
        op: 'blob',
        cx: 34,
        cy: 76,
        rx: 10,
        ry: 22,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 190,
        cy: 76,
        rx: 10,
        ry: 22,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 112,
        cy: 162,
        rx: 22,
        ry: 10,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'funnel')) {
    ops.push(
      {
        op: 'path',
        points: [
          [42, 38],
          [182, 38],
          [138, 104],
          [124, 104],
          [124, 166],
          [100, 166],
          [100, 104],
          [86, 104],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 62, y0: 54, x1: 162, y1: 54, width: 4, color: 'shade' },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'chute')) {
    ops.push(
      {
        op: 'path',
        points: [
          [30, 54],
          [76, 38],
          [194, 126],
          [170, 154],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 58, y0: 58, x1: 174, y1: 142, width: 4, color: 'shade' },
      {
        op: 'path',
        points: [
          [34, 48],
          [24, 76],
          [48, 86],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 7,
      },
      {
        op: 'blob',
        cx: 184,
        cy: 140,
        rx: 20,
        ry: 10,
        fill: 'PAPER.floor',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'spout')) {
    ops.push(
      {
        op: 'path',
        points: [
          [54, 48],
          [54, 112],
          [128, 112],
          [150, 134],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 22,
      },
      {
        op: 'blob',
        cx: 54,
        cy: 44,
        rx: 22,
        ry: 10,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'path',
        points: [
          [150, 134],
          [174, 134],
          [174, 156],
        ],
        fill: undefined,
        outline: 'WATER.deep',
        lineWidth: 6,
      },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'nozzle')) {
    ops.push(
      {
        op: 'path',
        points: [
          [30, 92],
          [142, 76],
          [184, 98],
          [142, 120],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 184,
        cy: 98,
        rx: 16,
        ry: 24,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 52, y0: 98, x1: 138, y1: 98, width: 4, color: 'shade' },
      { op: 'line', x0: 198, y0: 88, x1: 216, y1: 78, width: 3, color: 'WATER.deep' },
      { op: 'line', x0: 198, y0: 98, x1: 220, y1: 98, width: 3, color: 'WATER.deep' },
      { op: 'line', x0: 198, y0: 108, x1: 216, y1: 118, width: 3, color: 'WATER.deep' },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'duct')) {
    ops.push(
      {
        op: 'path',
        points: [
          [34, 54],
          [104, 54],
          [104, 110],
          [190, 110],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 30,
      },
      { op: 'line', x0: 38, y0: 54, x1: 96, y1: 54, width: 5, color: 'shade' },
      { op: 'line', x0: 106, y0: 110, x1: 186, y1: 110, width: 5, color: 'shade' },
      {
        op: 'rect',
        x: 176,
        y: 88,
        w: 34,
        h: 44,
        r: 4,
        fill: 'PAPER.floor',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'vent-cover')) {
    ops.push({
      op: 'rect',
      x: 44,
      y: 44,
      w: 136,
      h: 112,
      r: 8,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    });
    for (let i = 0; i < 5; i++)
      ops.push({
        op: 'line',
        x0: 62,
        y0: 66 + i * 18,
        x1: 162,
        y1: 58 + i * 18,
        width: 6,
        color: 'shade',
      });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'valve-body')) {
    ops.push(
      { op: 'line', x0: 24, y0: 118, x1: 200, y1: 118, width: 22, color: 'fill' },
      {
        op: 'blob',
        cx: 112,
        cy: 116,
        rx: 38,
        ry: 30,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 112, y0: 88, x1: 112, y1: 48, width: 8, color: 'shade' },
      {
        op: 'blob',
        cx: 112,
        cy: 42,
        rx: 34,
        ry: 12,
        fill: undefined,
        outline: 'fill',
        lineWidth: 7,
      },
    );
    return { canvas: [224, 180], ops };
  }
  if (vertical) {
    ops.push(
      {
        op: 'line',
        x0: 96,
        y0: 236,
        x1: 96 + (seed % 17) - 8,
        y1: 48,
        width: detail,
        color: 'fill',
      },
      {
        op: 'blob',
        cx: 96 + (seed % 17) - 8,
        cy: 48,
        rx: detail,
        ry: detail / 2,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 96 - detail, y0: 142, x1: 96 + detail, y1: 142, width: 6, color: 'shade' },
    );
  } else {
    ops.push(
      {
        op: 'line',
        x0: 20,
        y0: 112,
        x1: 20 + width,
        y1: 100 + (seed % 19) - 9,
        width: silhouette === 'binding' ? 8 : detail,
        color: 'fill',
        jitter: silhouette === 'binding' ? 5 : 2,
      },
      {
        op: 'line',
        x0: 32,
        y0: 118,
        x1: 32 + width - 24,
        y1: 108 + (seed % 13) - 6,
        width: 3,
        color: 'shade',
      },
      {
        op: 'blob',
        cx: 20 + width * 0.68,
        cy: 105 + (seed % 11) - 5,
        rx: 7,
        ry: 5,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 2,
      },
    );
    if (silhouette === 'binding')
      ops.push({
        op: 'blob',
        cx: 112,
        cy: 106,
        rx: 24,
        ry: 16,
        fill: undefined,
        outline: 'INK.line',
        lineWidth: 4,
      });
    if (silhouette === 'conduit')
      ops.push({
        op: 'blob',
        cx: 20 + width,
        cy: 100 + (seed % 19) - 9,
        rx: detail,
        ry: detail * 0.7,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      });
  }
  return { canvas: vertical ? [192, 256] : [224, 180], ops };
}

function frameTemplate(
  form: FormId,
  silhouette: IdentitySilhouette,
  seed: number,
  width: number,
  height: number,
  detail: number,
): SpriteOpList {
  const w = silhouette === 'joint' ? Math.min(100, width) : width;
  const h = silhouette === 'joint' ? Math.min(100, height) : height;
  const x = (224 - w) / 2;
  const y = 174 - h;
  if (silhouette === 'joint') {
    const ops: SpriteOp[] = [];
    if (nameHas(form, 'dowel', 'peg')) {
      ops.push(
        {
          op: 'line',
          x0: 54,
          y0: 106,
          x1: 170,
          y1: 106,
          width: nameHas(form, 'dowel') ? 22 : 30,
          color: 'fill',
        },
        {
          op: 'blob',
          cx: 54,
          cy: 106,
          rx: 12,
          ry: nameHas(form, 'dowel') ? 11 : 15,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        {
          op: 'path',
          points: [
            [170, 90],
            [198, 106],
            [170, 122],
          ],
          close: true,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
      );
    } else if (nameHas(form, 'wedge', 'shim')) {
      ops.push(
        {
          op: 'path',
          points: nameHas(form, 'wedge')
            ? [
                [42, 134],
                [184, 74],
                [184, 134],
              ]
            : [
                [38, 122],
                [188, 96],
                [188, 126],
              ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 74, y0: 122, x1: 168, y1: 88, width: 4, color: 'shade' },
      );
    } else if (nameHas(form, 'mortise-block')) {
      ops.push(
        {
          op: 'rect',
          x: 56,
          y: 56,
          w: 112,
          h: 112,
          r: 8,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'rect',
          x: 88,
          y: 78,
          w: 48,
          h: 68,
          r: 4,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 5,
        },
      );
    } else if (nameHas(form, 'tenon-block')) {
      ops.push(
        {
          op: 'rect',
          x: 48,
          y: 70,
          w: 96,
          h: 84,
          r: 7,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'rect',
          x: 144,
          y: 92,
          w: 48,
          h: 40,
          r: 4,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
      );
    } else if (nameHas(form, 'scarf-joint', 'lap-joint')) {
      ops.push(
        {
          op: 'path',
          points: [
            [24, 88],
            [110, 88],
            [134, 112],
            [200, 112],
            [200, 138],
            [124, 138],
            [100, 114],
            [24, 114],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 100, y0: 92, x1: 134, y1: 134, width: 5, color: 'shade' },
      );
      if (nameHas(form, 'lap-joint'))
        ops.push({ op: 'line', x0: 112, y0: 62, x1: 112, y1: 160, width: 18, color: 'shade' });
    } else if (nameHas(form, 'hinge-leaf')) {
      ops.push(
        {
          op: 'rect',
          x: 38,
          y: 64,
          w: 58,
          h: 96,
          r: 6,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'rect',
          x: 128,
          y: 64,
          w: 58,
          h: 96,
          r: 6,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 112, y0: 52, x1: 112, y1: 172, width: 16, color: 'shade' },
        { op: 'blob', cx: 66, cy: 88, rx: 6, ry: 6, fill: 'PAPER.floor' },
        { op: 'blob', cx: 158, cy: 136, rx: 6, ry: 6, fill: 'PAPER.floor' },
      );
    } else {
      ops.push(
        {
          op: 'rect',
          x: 42,
          y: 72,
          w: 140,
          h: 80,
          r: 7,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [54, 112],
            [92, 112],
            [112, 92],
            [132, 112],
            [172, 112],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 8,
        },
        { op: 'blob', cx: 112, cy: 92, rx: 7, ry: 7, fill: 'ROBOT.accent' },
      );
    }
    return { canvas: [224, 180], ops };
  }
  const ops: SpriteOp[] = [
    { op: 'rect', x, y, w, h, r: 8, fill: undefined, outline: 'fill', lineWidth: detail },
    {
      op: 'line',
      x0: x + detail,
      y0: y + h - detail,
      x1: x + w - detail,
      y1: y + detail,
      width: 5,
      color: 'shade',
    },
  ];
  if (nameHas(form, 'window-frame', 'mullion', 'transom', 'lattice')) {
    if (nameHas(form, 'window-frame', 'mullion', 'lattice'))
      ops.push({
        op: 'line',
        x0: 112,
        y0: y + 4,
        x1: 112,
        y1: y + h - 4,
        width: 6,
        color: 'shade',
      });
    if (nameHas(form, 'window-frame', 'transom', 'lattice'))
      ops.push({
        op: 'line',
        x0: x + 4,
        y0: y + h * 0.45,
        x1: x + w - 4,
        y1: y + h * 0.45,
        width: 6,
        color: 'shade',
      });
    if (nameHas(form, 'lattice'))
      ops.push(
        {
          op: 'line',
          x0: x + 10,
          y0: y + h - 10,
          x1: x + w - 10,
          y1: y + 10,
          width: 4,
          color: 'shade',
        },
        {
          op: 'line',
          x0: x + 10,
          y0: y + 10,
          x1: x + w - 10,
          y1: y + h - 10,
          width: 4,
          color: 'shade',
        },
      );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'door-jamb')) {
    ops.push(
      { op: 'line', x0: x - 8, y0: y + h, x1: x + w + 8, y1: y + h, width: 10, color: 'shade' },
      { op: 'blob', cx: x + w - 18, cy: y + h * 0.58, rx: 6, ry: 6, fill: 'ROBOT.accent' },
    );
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'shutter-frame')) {
    for (let i = 1; i <= 4; i++)
      ops.push({
        op: 'line',
        x0: x + 10,
        y0: y + (h * i) / 5,
        x1: x + w - 10,
        y1: y + (h * i) / 5,
        width: 5,
        color: 'shade',
      });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'screen-frame', 'vent-frame')) {
    for (let i = 1; i <= 5; i++)
      ops.push({
        op: 'line',
        x0: x + 10,
        y0: y + (h * i) / 6,
        x1: x + w - 10,
        y1: y + (h * i) / 6 + (nameHas(form, 'vent') ? -8 : 0),
        width: 4,
        color: 'shade',
      });
    return { canvas: [224, 180], ops };
  }
  if (nameHas(form, 'hatch-frame', 'skylight-frame')) {
    ops.push(
      {
        op: 'path',
        points: [
          [x + 12, y + h - 8],
          [x + w - 12, y + h - 8],
          [x + w - 30, y + 18],
          [x + 30, y + 18],
        ],
        close: true,
        fill: 'WATER.edge',
        outline: 'shade',
        lineWidth: 5,
      },
      { op: 'line', x0: 112, y0: y + 20, x1: 112, y1: y + h - 10, width: 4, color: 'shade' },
    );
    return { canvas: [224, 180], ops };
  }
  ops.push({
    op: 'line',
    x0: 112 + (seed % 15) - 7,
    y0: y + 4,
    x1: 112,
    y1: y + h - 4,
    width: 5,
    color: 'shade',
  });
  void detail;
  return { canvas: [224, 180], ops };
}

function mechanismTemplate(
  form: FormId,
  seed: number,
  width: number,
  detail: number,
): SpriteOpList {
  const r = Math.min(70, width / 2);
  const ops: SpriteOp[] = [];
  const wheel = (cx: number, cy: number, radius: number, spokes: number) => {
    ops.push(
      {
        op: 'blob',
        cx,
        cy,
        rx: radius,
        ry: radius,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
        irregularity: 0.03,
      },
      {
        op: 'blob',
        cx,
        cy,
        rx: Math.max(8, detail * 0.55),
        ry: Math.max(8, detail * 0.55),
        fill: 'PAPER.floor',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
    for (let i = 0; i < spokes; i++) {
      const a = (Math.PI * 2 * i) / spokes;
      ops.push({
        op: 'line',
        x0: cx + Math.cos(a) * detail * 0.55,
        y0: cy + Math.sin(a) * detail * 0.55,
        x1: cx + Math.cos(a) * (radius - 8),
        y1: cy + Math.sin(a) * (radius - 8),
        width: 5,
        color: 'shade',
      });
    }
  };

  if (nameHas(form, 'axle')) {
    ops.push(
      { op: 'line', x0: 30, y0: 104, x1: 194, y1: 104, width: 16, color: 'fill' },
      {
        op: 'blob',
        cx: 38,
        cy: 104,
        rx: 25,
        ry: 34,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 186,
        cy: 104,
        rx: 25,
        ry: 34,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else if (nameHas(form, 'pulley')) {
    wheel(112, 98, r * 0.72, 4);
    ops.push(
      { op: 'line', x0: 112, y0: 24, x1: 112, y1: 52, width: 7, color: 'shade' },
      {
        op: 'path',
        points: [
          [112 - r * 0.72, 98],
          [112 - r * 0.72, 160],
          [112 + r * 0.72, 160],
          [112 + r * 0.72, 98],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 5,
      },
    );
  } else if (nameHas(form, 'hand-crank')) {
    wheel(92, 104, r * 0.58, 4);
    ops.push(
      { op: 'line', x0: 92, y0: 104, x1: 154, y1: 70, width: 8, color: 'shade' },
      {
        op: 'blob',
        cx: 166,
        cy: 64,
        rx: 11,
        ry: 18,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else if (nameHas(form, 'gear-train')) {
    wheel(78, 112, 44, 6);
    wheel(148, 78, 34, 5);
  } else if (nameHas(form, 'ratchet')) {
    wheel(100, 104, r * 0.72, 7);
    ops.push({
      op: 'path',
      points: [
        [142, 42],
        [176, 60],
        [136, 94],
      ],
      close: true,
      fill: 'shade',
      outline: 'INK.line',
      lineWidth: 4,
    });
  } else if (nameHas(form, 'spring-coil')) {
    for (let i = 0; i < 6; i++) {
      ops.push({
        op: 'blob',
        cx: 112,
        cy: 46 + i * 21,
        rx: 48 - i * 2,
        ry: 15,
        fill: undefined,
        outline: i % 2 ? 'shade' : 'fill',
        lineWidth: 8,
      });
    }
  } else if (nameHas(form, 'counterweight')) {
    ops.push(
      { op: 'line', x0: 46, y0: 42, x1: 178, y1: 42, width: 10, color: 'fill' },
      { op: 'line', x0: 64, y0: 42, x1: 64, y1: 126, width: 5, color: 'shade' },
      { op: 'line', x0: 160, y0: 42, x1: 160, y1: 94, width: 5, color: 'shade' },
      {
        op: 'rect',
        x: 38,
        y: 126,
        w: 52,
        h: 38,
        r: 7,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'rect',
        x: 138,
        y: 94,
        w: 44,
        h: 70,
        r: 7,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else if (nameHas(form, 'bearing-block')) {
    ops.push(
      {
        op: 'rect',
        x: 46,
        y: 76,
        w: 132,
        h: 88,
        r: 15,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 112,
        cy: 112,
        rx: 34,
        ry: 34,
        fill: 'PAPER.floor',
        outline: 'shade',
        lineWidth: 8,
      },
      { op: 'line', x0: 24, y0: 112, x1: 200, y1: 112, width: 12, color: 'shade' },
    );
  } else {
    wheel(112, 102, r, nameHas(form, 'sprocket') ? 8 : 4 + (seed % 4));
  }
  return { canvas: [224, 180], ops };
}

function furnitureTemplate(
  form: FormId,
  silhouette: IdentitySilhouette,
  seed: number,
  width: number,
  height: number,
  inset: number,
): SpriteOpList {
  void seed;
  void width;
  void height;
  void inset;
  if (silhouette === 'seat') return compactSeatTemplate(form);
  if (silhouette === 'seat-wide') return sharedSeatTemplate(form);
  return workSurfaceTemplate(form);
}

function compactSeatTemplate(form: FormId): SpriteOpList {
  const ops: SpriteOp[] = [];
  const seat = (x: number, y: number, w: number, h = 22) =>
    ops.push({ op: 'rect', x, y, w, h, r: 8, fill: 'fill', outline: 'INK.line', lineWidth: 5 });
  const leg = (x0: number, y0: number, x1: number, y1 = 214, width = 9) =>
    ops.push({ op: 'line', x0, y0, x1, y1, width, color: 'shade' });

  if (nameHas(form, 'rocking-chair')) {
    seat(78, 132, 100);
    ops.push(
      {
        op: 'path',
        points: [
          [86, 132],
          [90, 60],
          [158, 72],
          [170, 132],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 14,
      },
      { op: 'line', x0: 92, y0: 150, x1: 78, y1: 204, width: 9, color: 'shade' },
      { op: 'line', x0: 164, y0: 150, x1: 178, y1: 204, width: 9, color: 'shade' },
      {
        op: 'path',
        points: [
          [58, 204],
          [128, 222],
          [198, 204],
        ],
        fill: undefined,
        outline: 'INK.line',
        lineWidth: 8,
      },
    );
  } else if (nameHas(form, 'kneeling-chair')) {
    ops.push(
      {
        op: 'rect',
        x: 86,
        y: 92,
        w: 84,
        h: 24,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 56,
        y: 158,
        w: 78,
        h: 22,
        r: 8,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 96, y0: 112, x1: 68, y1: 208, width: 10, color: 'shade' },
      { op: 'line', x0: 158, y0: 112, x1: 184, y1: 208, width: 10, color: 'shade' },
      { op: 'line', x0: 72, y0: 176, x1: 178, y1: 208, width: 7, color: 'fill' },
    );
  } else if (nameHas(form, 'deck-chair')) {
    ops.push(
      {
        op: 'path',
        points: [
          [74, 52],
          [156, 142],
          [178, 202],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 17,
      },
      {
        op: 'path',
        points: [
          [72, 58],
          [150, 142],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 10,
      },
      { op: 'line', x0: 80, y0: 62, x1: 66, y1: 208, width: 8, color: 'shade' },
      { op: 'line', x0: 150, y0: 138, x1: 190, y1: 208, width: 8, color: 'shade' },
      { op: 'line', x0: 68, y0: 208, x1: 190, y1: 208, width: 6, color: 'fill' },
    );
  } else if (nameHas(form, 'sling-chair')) {
    ops.push(
      {
        op: 'path',
        points: [
          [76, 66],
          [84, 148],
          [128, 170],
          [174, 142],
          [180, 66],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 14,
      },
      {
        op: 'path',
        points: [
          [88, 76],
          [96, 136],
          [128, 154],
          [162, 132],
          [168, 76],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 9,
      },
      { op: 'line', x0: 80, y0: 146, x1: 64, y1: 212, width: 8, color: 'shade' },
      { op: 'line', x0: 176, y0: 142, x1: 192, y1: 212, width: 8, color: 'shade' },
    );
  } else if (nameHas(form, 'saddle-stool')) {
    ops.push(
      {
        op: 'path',
        points: [
          [72, 116],
          [96, 96],
          [128, 106],
          [160, 96],
          [184, 116],
          [164, 138],
          [92, 138],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 112, y0: 136, x1: 84, y1: 214, width: 9, color: 'shade' },
      { op: 'line', x0: 144, y0: 136, x1: 172, y1: 214, width: 9, color: 'shade' },
      { op: 'line', x0: 102, y0: 178, x1: 154, y1: 178, width: 6, color: 'fill' },
    );
  } else if (nameHas(form, 'tripod-stool')) {
    seat(84, 108, 88);
    leg(112, 128, 70);
    leg(128, 128, 128);
    leg(144, 128, 186);
  } else if (nameHas(form, 'window-seat')) {
    ops.push(
      {
        op: 'rect',
        x: 52,
        y: 116,
        w: 152,
        h: 76,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 66,
        y: 126,
        w: 124,
        h: 22,
        r: 8,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      { op: 'line', x0: 128, y0: 148, x1: 128, y1: 190, width: 4, color: 'shade' },
      {
        op: 'rect',
        x: 72,
        y: 48,
        w: 112,
        h: 62,
        r: 4,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 128, y0: 52, x1: 128, y1: 106, width: 4, color: 'shade' },
    );
  } else if (nameHas(form, 'reading-chair')) {
    seat(76, 142, 104);
    ops.push(
      {
        op: 'path',
        points: [
          [72, 142],
          [62, 72],
          [86, 48],
          [128, 62],
          [170, 48],
          [194, 72],
          [184, 142],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 128,
        cy: 98,
        rx: 34,
        ry: 42,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
    );
    leg(90, 162, 84);
    leg(166, 162, 172);
  } else if (nameHas(form, 'floor-cushion')) {
    ops.push(
      {
        op: 'blob',
        cx: 128,
        cy: 166,
        rx: 78,
        ry: 38,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 76, y0: 166, x1: 180, y1: 166, width: 4, color: 'shade' },
      { op: 'line', x0: 128, y0: 134, x1: 128, y1: 196, width: 3, color: 'shade' },
      { op: 'blob', cx: 128, cy: 166, rx: 6, ry: 6, fill: 'ROBOT.accent' },
    );
  } else {
    ops.push(
      {
        op: 'blob',
        cx: 128,
        cy: 166,
        rx: 62,
        ry: 24,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 128,
        cy: 156,
        rx: 38,
        ry: 20,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      { op: 'line', x0: 82, y0: 176, x1: 174, y1: 176, width: 5, color: 'shade' },
      { op: 'line', x0: 96, y0: 184, x1: 88, y1: 208, width: 6, color: 'fill' },
      { op: 'line', x0: 160, y0: 184, x1: 168, y1: 208, width: 6, color: 'fill' },
    );
  }
  return { canvas: [256, 224], ops };
}

function sharedSeatTemplate(form: FormId): SpriteOpList {
  const ops: SpriteOp[] = [];
  const base = (x = 52, y = 142, w = 152) =>
    ops.push({ op: 'rect', x, y, w, h: 26, r: 8, fill: 'fill', outline: 'INK.line', lineWidth: 5 });
  const feet = (left = 72, right = 184, y = 166) =>
    ops.push(
      { op: 'line', x0: left, y0: y, x1: left - 6, y1: 212, width: 9, color: 'shade' },
      { op: 'line', x0: right, y0: y, x1: right + 6, y1: 212, width: 9, color: 'shade' },
    );

  if (nameHas(form, 'porch-swing')) {
    base(48, 126, 160);
    ops.push(
      {
        op: 'rect',
        x: 56,
        y: 70,
        w: 144,
        h: 58,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 58, y0: 128, x1: 42, y1: 18, width: 5, color: 'shade' },
      { op: 'line', x0: 198, y0: 128, x1: 214, y1: 18, width: 5, color: 'shade' },
    );
  } else if (nameHas(form, 'hanging-seat')) {
    ops.push(
      {
        op: 'path',
        points: [
          [74, 54],
          [82, 142],
          [128, 170],
          [174, 142],
          [182, 54],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 15,
      },
      { op: 'line', x0: 74, y0: 54, x1: 94, y1: 8, width: 5, color: 'shade' },
      { op: 'line', x0: 182, y0: 54, x1: 162, y1: 8, width: 5, color: 'shade' },
      {
        op: 'blob',
        cx: 128,
        cy: 136,
        rx: 42,
        ry: 24,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
    );
  } else if (nameHas(form, 'conversation-seat')) {
    ops.push(
      {
        op: 'path',
        points: [
          [42, 154],
          [54, 94],
          [112, 122],
          [112, 166],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [214, 154],
          [202, 94],
          [144, 122],
          [144, 166],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 128,
        cy: 164,
        rx: 15,
        ry: 15,
        fill: 'ROBOT.accent',
        outline: 'INK.soft',
        lineWidth: 2,
      },
    );
    feet(62, 194, 156);
  } else if (nameHas(form, 'corner-seat')) {
    ops.push(
      {
        op: 'path',
        points: [
          [44, 142],
          [156, 142],
          [206, 108],
          [218, 130],
          [166, 170],
          [44, 170],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [48, 140],
          [48, 76],
          [164, 76],
          [164, 142],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 12,
      },
    );
    feet(66, 194);
  } else if (nameHas(form, 'storage-bench')) {
    ops.push(
      {
        op: 'rect',
        x: 44,
        y: 128,
        w: 168,
        h: 72,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 36,
        y: 116,
        w: 184,
        h: 24,
        r: 8,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 128, y0: 142, x1: 128, y1: 196, width: 4, color: 'shade' },
      { op: 'blob', cx: 118, cy: 162, rx: 4, ry: 4, fill: 'ROBOT.accent' },
      { op: 'blob', cx: 138, cy: 162, rx: 4, ry: 4, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'step-stool')) {
    ops.push(
      {
        op: 'rect',
        x: 60,
        y: 150,
        w: 136,
        h: 24,
        r: 5,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 88,
        y: 104,
        w: 108,
        h: 24,
        r: 5,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 76, y0: 174, x1: 68, y1: 212, width: 9, color: 'shade' },
      { op: 'line', x0: 180, y0: 128, x1: 194, y1: 212, width: 9, color: 'shade' },
    );
  } else if (nameHas(form, 'drafting-stool')) {
    base(80, 98, 96);
    ops.push(
      { op: 'line', x0: 128, y0: 122, x1: 128, y1: 182, width: 12, color: 'shade' },
      {
        op: 'blob',
        cx: 128,
        cy: 150,
        rx: 34,
        ry: 9,
        fill: undefined,
        outline: 'fill',
        lineWidth: 6,
      },
    );
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5;
      ops.push({
        op: 'line',
        x0: 128,
        y0: 182,
        x1: 128 + Math.cos(a) * 48,
        y1: 202 + Math.sin(a) * 10,
        width: 6,
        color: 'shade',
      });
    }
  } else if (nameHas(form, 'piano-stool')) {
    ops.push(
      {
        op: 'blob',
        cx: 128,
        cy: 108,
        rx: 50,
        ry: 22,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 128, y0: 128, x1: 128, y1: 166, width: 12, color: 'shade' },
      { op: 'line', x0: 96, y0: 154, x1: 84, y1: 210, width: 8, color: 'shade' },
      { op: 'line', x0: 160, y0: 154, x1: 172, y1: 210, width: 8, color: 'shade' },
      { op: 'line', x0: 92, y0: 176, x1: 164, y1: 176, width: 6, color: 'fill' },
    );
  } else if (nameHas(form, 'garden-seat')) {
    ops.push(
      {
        op: 'path',
        points: [
          [42, 148],
          [70, 112],
          [128, 100],
          [186, 112],
          [214, 148],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 18,
      },
      {
        op: 'path',
        points: [
          [58, 112],
          [72, 70],
          [128, 56],
          [184, 70],
          [198, 112],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 9,
      },
    );
    feet(70, 186, 150);
  } else if (nameHas(form, 'hearth-seat', 'settle')) {
    base(46, 146, 164);
    ops.push(
      {
        op: 'rect',
        x: 46,
        y: 52,
        w: 164,
        h: 96,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 72, y0: 62, x1: 72, y1: 138, width: 5, color: 'shade' },
      { op: 'line', x0: 184, y0: 62, x1: 184, y1: 138, width: 5, color: 'shade' },
    );
    feet();
  } else if (nameHas(form, 'day-couch')) {
    base(38, 148, 180);
    ops.push(
      {
        op: 'blob',
        cx: 68,
        cy: 120,
        rx: 30,
        ry: 40,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 188,
        cy: 136,
        rx: 24,
        ry: 18,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
    );
    feet(58, 198);
  } else if (nameHas(form, 'chaise')) {
    ops.push(
      {
        op: 'path',
        points: [
          [38, 158],
          [92, 154],
          [132, 78],
          [170, 56],
          [218, 158],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 52, y0: 172, x1: 48, y1: 210, width: 8, color: 'shade' },
      { op: 'line', x0: 202, y0: 172, x1: 208, y1: 210, width: 8, color: 'shade' },
      { op: 'line', x0: 94, y0: 148, x1: 148, y1: 76, width: 4, color: 'shade' },
    );
  } else if (nameHas(form, 'ottoman')) {
    ops.push(
      {
        op: 'blob',
        cx: 128,
        cy: 150,
        rx: 66,
        ry: 38,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 84, y0: 154, x1: 172, y1: 154, width: 4, color: 'shade' },
      { op: 'line', x0: 88, y0: 178, x1: 84, y1: 204, width: 7, color: 'shade' },
      { op: 'line', x0: 168, y0: 178, x1: 172, y1: 204, width: 7, color: 'shade' },
    );
  } else {
    base(62, 152, 132);
    feet(82, 174, 168);
    ops.push({ op: 'line', x0: 88, y0: 150, x1: 168, y1: 150, width: 4, color: 'shade' });
  }
  return { canvas: [256, 224], ops };
}

function workSurfaceTemplate(form: FormId): SpriteOpList {
  const ops: SpriteOp[] = [];
  const top = (x = 34, y = 104, w = 188, angle = 0) =>
    ops.push({
      op: 'path',
      points: angle
        ? [
            [x, y + angle],
            [x + w, y],
            [x + w, y + 22],
            [x, y + 22 + angle],
          ]
        : [
            [x, y],
            [x + w, y],
            [x + w, y + 22],
            [x, y + 22],
          ],
      close: true,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    });
  const legs = (left = 62, right = 194, y = 126) =>
    ops.push(
      { op: 'line', x0: left, y0: y, x1: left - 5, y1: 214, width: 9, color: 'shade' },
      { op: 'line', x0: right, y0: y, x1: right + 5, y1: 214, width: 9, color: 'shade' },
    );

  if (nameHas(form, 'rolltop-desk')) {
    top(36, 118, 184);
    ops.push(
      {
        op: 'path',
        points: [
          [48, 118],
          [48, 54],
          [184, 54],
          [208, 80],
          [208, 118],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 14,
      },
      { op: 'line', x0: 72, y0: 72, x1: 184, y1: 72, width: 5, color: 'shade' },
      {
        op: 'rect',
        x: 48,
        y: 142,
        w: 48,
        h: 58,
        r: 5,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
    legs(198, 198, 140);
  } else if (nameHas(form, 'writing-desk')) {
    top();
    legs();
    ops.push(
      {
        op: 'rect',
        x: 46,
        y: 130,
        w: 66,
        h: 34,
        r: 4,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      { op: 'line', x0: 128, y0: 116, x1: 192, y1: 116, width: 3, color: 'shade' },
    );
  } else if (nameHas(form, 'drafting-table', 'lectern')) {
    top(nameHas(form, 'lectern') ? 70 : 28, 82, nameHas(form, 'lectern') ? 116 : 200, 24);
    ops.push(
      { op: 'line', x0: 128, y0: 124, x1: 128, y1: 198, width: 11, color: 'shade' },
      { op: 'line', x0: 78, y0: 208, x1: 178, y1: 208, width: 9, color: 'fill' },
      { op: 'line', x0: 88, y0: 98, x1: 176, y1: 82, width: 4, color: 'shade' },
    );
  } else if (nameHas(form, 'nesting-table')) {
    top(30, 84, 128);
    legs(48, 142, 106);
    top(104, 130, 120);
    legs(120, 208, 152);
  } else if (nameHas(form, 'console-table')) {
    top(28, 86, 200);
    legs(48, 208, 108);
    ops.push(
      { op: 'line', x0: 54, y0: 154, x1: 202, y1: 154, width: 7, color: 'shade' },
      { op: 'blob', cx: 128, cy: 110, rx: 5, ry: 5, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'potting-table')) {
    top(28, 100, 200);
    legs(50, 206, 122);
    ops.push(
      {
        op: 'rect',
        x: 42,
        y: 48,
        w: 172,
        h: 54,
        r: 5,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 54, y0: 170, x1: 202, y1: 170, width: 8, color: 'fill' },
    );
  } else if (nameHas(form, 'wash-table')) {
    top();
    legs();
    ops.push(
      {
        op: 'blob',
        cx: 128,
        cy: 102,
        rx: 48,
        ry: 18,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 174, y0: 100, x1: 174, y1: 66, width: 7, color: 'shade' },
      {
        op: 'path',
        points: [
          [174, 68],
          [194, 68],
          [194, 84],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 7,
      },
    );
  } else if (nameHas(form, 'breakfast-bar', 'island-counter')) {
    top(26, 82, 204);
    ops.push(
      {
        op: 'rect',
        x: 56,
        y: 106,
        w: 144,
        h: 96,
        r: 7,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 76,
        y: 128,
        w: 48,
        h: 54,
        r: 4,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      {
        op: 'rect',
        x: 134,
        y: 128,
        w: 46,
        h: 54,
        r: 4,
        fill: undefined,
        outline: 'shade',
        lineWidth: 3,
      },
    );
  } else if (nameHas(form, 'folding-counter')) {
    top(34, 104, 188);
    ops.push(
      { op: 'line', x0: 56, y0: 126, x1: 112, y1: 210, width: 9, color: 'shade' },
      { op: 'line', x0: 200, y0: 126, x1: 144, y1: 210, width: 9, color: 'shade' },
      { op: 'line', x0: 88, y0: 168, x1: 168, y1: 168, width: 6, color: 'fill' },
    );
  } else if (nameHas(form, 'map-table')) {
    top(42, 92, 172);
    legs(64, 192, 114);
    ops.push(
      {
        op: 'path',
        points: [
          [66, 106],
          [104, 98],
          [132, 112],
          [188, 100],
        ],
        fill: undefined,
        outline: 'SAGE.mid',
        lineWidth: 5,
      },
      { op: 'blob', cx: 176, cy: 104, rx: 7, ry: 7, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'game-table')) {
    top(42, 92, 172);
    legs(64, 192, 114);
    ops.push(
      {
        op: 'rect',
        x: 82,
        y: 96,
        w: 92,
        h: 18,
        r: 4,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      { op: 'line', x0: 112, y0: 96, x1: 112, y1: 114, width: 3, color: 'PAPER.floor' },
      { op: 'line', x0: 144, y0: 96, x1: 144, y1: 114, width: 3, color: 'PAPER.floor' },
      { op: 'blob', cx: 64, cy: 104, rx: 8, ry: 8, fill: 'ROBOT.accent' },
      { op: 'blob', cx: 192, cy: 104, rx: 8, ry: 8, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'display-plinth')) {
    ops.push(
      {
        op: 'rect',
        x: 76,
        y: 96,
        w: 104,
        h: 28,
        r: 5,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [92, 124],
          [164, 124],
          [178, 204],
          [78, 204],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 128,
        cy: 76,
        rx: 22,
        ry: 14,
        fill: 'WATER.edge',
        outline: 'INK.soft',
        lineWidth: 3,
      },
    );
  } else if (nameHas(form, 'plant-stand')) {
    ops.push(
      {
        op: 'blob',
        cx: 128,
        cy: 94,
        rx: 48,
        ry: 15,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 128, y0: 108, x1: 128, y1: 196, width: 11, color: 'shade' },
      { op: 'line', x0: 78, y0: 204, x1: 178, y1: 204, width: 9, color: 'fill' },
      { op: 'grass', x: 114, baseY: 88, height: 48, lean: -12, width: 5, color: 'SAGE.mid' },
      { op: 'grass', x: 142, baseY: 88, height: 54, lean: 12, width: 5, color: 'SAGE.mid' },
    );
  } else if (nameHas(form, 'tray-stand')) {
    ops.push(
      {
        op: 'rect',
        x: 54,
        y: 92,
        w: 148,
        h: 24,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 68, y0: 116, x1: 178, y1: 210, width: 9, color: 'shade' },
      { op: 'line', x0: 188, y0: 116, x1: 78, y1: 210, width: 9, color: 'shade' },
      { op: 'line', x0: 96, y0: 160, x1: 160, y1: 160, width: 6, color: 'fill' },
    );
  } else if (nameHas(form, 'sewing-table')) {
    top();
    legs();
    ops.push(
      {
        op: 'blob',
        cx: 94,
        cy: 88,
        rx: 26,
        ry: 26,
        fill: undefined,
        outline: 'shade',
        lineWidth: 7,
      },
      { op: 'line', x0: 94, y0: 88, x1: 118, y1: 104, width: 4, color: 'shade' },
      {
        op: 'rect',
        x: 150,
        y: 68,
        w: 42,
        h: 34,
        r: 5,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 3,
      },
    );
  } else if (nameHas(form, 'tea-table')) {
    ops.push(
      {
        op: 'blob',
        cx: 128,
        cy: 126,
        rx: 72,
        ry: 18,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 128, y0: 142, x1: 128, y1: 190, width: 11, color: 'shade' },
      { op: 'line', x0: 82, y0: 202, x1: 174, y1: 202, width: 9, color: 'fill' },
      {
        op: 'blob',
        cx: 128,
        cy: 118,
        rx: 12,
        ry: 8,
        fill: 'CLAY.blossom',
        outline: 'INK.soft',
        lineWidth: 2,
      },
    );
  } else if (nameHas(form, 'side-table')) {
    top(72, 112, 112);
    legs(88, 168, 134);
    ops.push(
      {
        op: 'rect',
        x: 82,
        y: 138,
        w: 92,
        h: 34,
        r: 4,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      { op: 'blob', cx: 128, cy: 154, rx: 5, ry: 5, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'worktable')) {
    top(24, 94, 208);
    legs(48, 208, 116);
    ops.push(
      { op: 'line', x0: 54, y0: 176, x1: 202, y1: 176, width: 10, color: 'fill' },
      { op: 'line', x0: 64, y0: 116, x1: 192, y1: 202, width: 6, color: 'shade' },
      { op: 'line', x0: 192, y0: 116, x1: 64, y1: 202, width: 6, color: 'shade' },
    );
  } else {
    top(38, 104, 180);
    legs(60, 196, 126);
    ops.push({ op: 'line', x0: 76, y0: 116, x1: 180, y1: 116, width: 3, color: 'shade' });
  }
  return { canvas: [256, 224], ops };
}

function cabinetTemplate(
  form: FormId,
  silhouette: IdentitySilhouette,
  seed: number,
  width: number,
  height: number,
  detail: number,
): SpriteOpList {
  void seed;
  void width;
  void height;
  void detail;
  if (silhouette === 'storage') return storageTemplate(form);
  if (silhouette === 'utility') return utilityTemplate(form);
  return kitchenTemplate(form);
}

function storageTemplate(form: FormId): SpriteOpList {
  const ops: SpriteOp[] = [];
  const box = (x: number, y: number, w: number, h: number, fill = 'fill') =>
    ops.push({ op: 'rect', x, y, w, h, r: 8, fill, outline: 'INK.line', lineWidth: 5 });
  if (nameHas(form, 'wardrobe', 'armoire')) {
    box(52, 34, 152, 176);
    ops.push(
      { op: 'line', x0: 128, y0: 42, x1: 128, y1: 202, width: 5, color: 'shade' },
      {
        op: 'path',
        points: [
          [58, 50],
          [128, 24],
          [198, 50],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: nameHas(form, 'armoire') ? 10 : 5,
      },
      { op: 'blob', cx: 116, cy: 116, rx: 5, ry: 5, fill: 'ROBOT.accent' },
      { op: 'blob', cx: 140, cy: 116, rx: 5, ry: 5, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'dresser', 'drawer-unit')) {
    box(38, 76, 180, 134);
    for (let row = 0; row < 3; row++)
      ops.push(
        {
          op: 'rect',
          x: 52,
          y: 88 + row * 38,
          w: 152,
          h: 30,
          r: 4,
          fill: row % 2 ? 'shade' : undefined,
          outline: 'shade',
          lineWidth: 3,
        },
        { op: 'blob', cx: 128, cy: 103 + row * 38, rx: 5, ry: 5, fill: 'ROBOT.accent' },
      );
  } else if (nameHas(form, 'nightstand')) {
    box(72, 104, 112, 106);
    ops.push(
      {
        op: 'rect',
        x: 84,
        y: 118,
        w: 88,
        h: 38,
        r: 4,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      { op: 'line', x0: 92, y0: 160, x1: 92, y1: 202, width: 5, color: 'shade' },
      { op: 'line', x0: 164, y0: 160, x1: 164, y1: 202, width: 5, color: 'shade' },
      { op: 'blob', cx: 128, cy: 136, rx: 5, ry: 5, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'sideboard')) {
    box(30, 104, 196, 106);
    ops.push(
      { op: 'line', x0: 96, y0: 112, x1: 96, y1: 202, width: 4, color: 'shade' },
      { op: 'line', x0: 160, y0: 112, x1: 160, y1: 202, width: 4, color: 'shade' },
      {
        op: 'rect',
        x: 42,
        y: 116,
        w: 42,
        h: 72,
        r: 4,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      { op: 'blob', cx: 128, cy: 152, rx: 5, ry: 5, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'hutch')) {
    box(44, 102, 168, 108);
    box(66, 34, 124, 76, 'shade');
    ops.push(
      { op: 'line', x0: 76, y0: 66, x1: 180, y1: 66, width: 5, color: 'fill' },
      { op: 'line', x0: 128, y0: 38, x1: 128, y1: 106, width: 4, color: 'fill' },
      { op: 'line', x0: 128, y0: 112, x1: 128, y1: 204, width: 4, color: 'shade' },
    );
  } else if (nameHas(form, 'pantry-cupboard')) {
    box(68, 30, 120, 180);
    for (let row = 1; row <= 3; row++)
      ops.push({
        op: 'line',
        x0: 80,
        y0: 34 + row * 40,
        x1: 176,
        y1: 34 + row * 40,
        width: 5,
        color: 'shade',
      });
    ops.push({ op: 'blob', cx: 166, cy: 130, rx: 5, ry: 5, fill: 'ROBOT.accent' });
  } else if (nameHas(form, 'chest', 'blanket-box', 'tool-chest', 'linen-chest')) {
    box(38, 112, 180, 90);
    if (nameHas(form, 'blanket-box'))
      ops.push(
        {
          op: 'blob',
          cx: 128,
          cy: 106,
          rx: 86,
          ry: 28,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 58, y0: 142, x1: 198, y1: 142, width: 5, color: 'shade' },
        { op: 'line', x0: 68, y0: 194, x1: 68, y1: 214, width: 7, color: 'shade' },
        { op: 'line', x0: 188, y0: 194, x1: 188, y1: 214, width: 7, color: 'shade' },
      );
    else if (nameHas(form, 'tool-chest'))
      ops.push(
        {
          op: 'rect',
          x: 34,
          y: 92,
          w: 188,
          h: 30,
          r: 6,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [92, 92],
            [92, 62],
            [164, 62],
            [164, 92],
          ],
          fill: undefined,
          outline: 'fill',
          lineWidth: 8,
        },
        {
          op: 'rect',
          x: 104,
          y: 136,
          w: 48,
          h: 32,
          r: 5,
          fill: 'PAPER.floor',
          outline: 'INK.soft',
          lineWidth: 3,
        },
        { op: 'line', x0: 54, y0: 176, x1: 202, y1: 176, width: 5, color: 'shade' },
      );
    else
      ops.push(
        {
          op: 'rect',
          x: 34,
          y: 86,
          w: 188,
          h: 34,
          r: 5,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [54, 94],
            [84, 112],
            [114, 94],
            [144, 112],
            [194, 94],
          ],
          fill: undefined,
          outline: 'fill',
          lineWidth: 4,
        },
        {
          op: 'rect',
          x: 106,
          y: 134,
          w: 44,
          h: 30,
          r: 5,
          fill: 'PAPER.floor',
          outline: 'INK.soft',
          lineWidth: 3,
        },
      );
  } else if (nameHas(form, 'apothecary', 'map-cabinet', 'specimen-cabinet')) {
    box(42, 48, 172, 162);
    const cols = nameHas(form, 'apothecary') ? 4 : 2;
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < cols; col++)
        ops.push({
          op: 'rect',
          x: 52 + col * (152 / cols),
          y: 58 + row * 34,
          w: 142 / cols,
          h: 27,
          r: 3,
          fill: (row + col) % 2 ? 'shade' : undefined,
          outline: 'INK.soft',
          lineWidth: 2,
        });
  } else if (nameHas(form, 'coat-rack')) {
    ops.push(
      { op: 'line', x0: 128, y0: 210, x1: 128, y1: 36, width: 11, color: 'shade' },
      { op: 'line', x0: 76, y0: 78, x1: 180, y1: 78, width: 8, color: 'fill' },
      {
        op: 'path',
        points: [
          [76, 78],
          [64, 98],
          [82, 104],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 6,
      },
      {
        op: 'path',
        points: [
          [180, 78],
          [192, 98],
          [174, 104],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 6,
      },
      { op: 'line', x0: 76, y0: 210, x1: 180, y1: 210, width: 9, color: 'fill' },
    );
  } else if (nameHas(form, 'umbrella-stand')) {
    ops.push(
      {
        op: 'path',
        points: [
          [72, 92],
          [184, 92],
          [170, 210],
          [86, 210],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [98, 124],
          [82, 48],
          [112, 28],
          [142, 48],
          [126, 124],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 8,
      },
      { op: 'line', x0: 86, y0: 118, x1: 170, y1: 118, width: 5, color: 'shade' },
    );
  } else if (nameHas(form, 'wall-shelf')) {
    for (let row = 0; row < 4; row++)
      ops.push(
        {
          op: 'line',
          x0: 48,
          y0: 58 + row * 44,
          x1: 208,
          y1: 58 + row * 44,
          width: 10,
          color: row % 2 ? 'shade' : 'fill',
        },
        {
          op: 'path',
          points: [
            [62, 60 + row * 44],
            [52, 82 + row * 44],
            [72, 82 + row * 44],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 5,
        },
      );
  } else if (nameHas(form, 'corner-shelf')) {
    ops.push(
      { op: 'line', x0: 128, y0: 38, x1: 128, y1: 210, width: 9, color: 'shade' },
      { op: 'line', x0: 44, y0: 210, x1: 44, y1: 54, width: 8, color: 'shade' },
      { op: 'line', x0: 212, y0: 210, x1: 212, y1: 54, width: 8, color: 'shade' },
    );
    for (let row = 0; row < 4; row++)
      ops.push({
        op: 'path',
        points: [
          [52, 72 + row * 40],
          [128, 62 + row * 40],
          [204, 72 + row * 40],
        ],
        fill: undefined,
        outline: row % 2 ? 'shade' : 'fill',
        lineWidth: 9,
      });
  } else if (nameHas(form, 'cubby-unit')) {
    box(42, 46, 172, 164);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++)
        ops.push({
          op: 'rect',
          x: 54 + col * 52,
          y: 58 + row * 46,
          w: 42,
          h: 36,
          r: 3,
          fill: (row + col) % 2 ? 'shade' : undefined,
          outline: 'INK.soft',
          lineWidth: 2,
        });
  } else if (nameHas(form, 'shoe-rack', 'ladder-shelf')) {
    const ladder = nameHas(form, 'ladder-shelf');
    ops.push(
      {
        op: 'line',
        x0: ladder ? 66 : 48,
        y0: 210,
        x1: ladder ? 86 : 48,
        y1: 46,
        width: 9,
        color: 'shade',
      },
      {
        op: 'line',
        x0: ladder ? 190 : 208,
        y0: 210,
        x1: ladder ? 170 : 208,
        y1: 46,
        width: 9,
        color: 'shade',
      },
    );
    for (let row = 0; row < 4; row++)
      ops.push({
        op: 'line',
        x0: 58 + row * 3,
        y0: 70 + row * 38,
        x1: 198 - row * 3,
        y1: 70 + row * 38,
        width: 9,
        color: row % 2 ? 'shade' : 'fill',
      });
  } else if (nameHas(form, 'crate-stack')) {
    box(38, 132, 90, 72);
    box(128, 124, 88, 80, 'shade');
    box(82, 54, 94, 76);
    ops.push(
      { op: 'line', x0: 48, y0: 142, x1: 118, y1: 194, width: 4, color: 'shade' },
      { op: 'line', x0: 138, y0: 134, x1: 206, y1: 194, width: 4, color: 'fill' },
      { op: 'line', x0: 92, y0: 64, x1: 166, y1: 120, width: 4, color: 'shade' },
    );
  } else if (nameHas(form, 'bottle-rack', 'plate-rack')) {
    box(40, 56, 176, 154);
    for (let row = 0; row < 3; row++) {
      ops.push({
        op: 'line',
        x0: 52,
        y0: 92 + row * 46,
        x1: 204,
        y1: 92 + row * 46,
        width: 6,
        color: 'shade',
      });
      for (let col = 0; col < 4; col++)
        ops.push({
          op: 'blob',
          cx: 70 + col * 38,
          cy: 76 + row * 46,
          rx: nameHas(form, 'plate') ? 14 : 8,
          ry: 15,
          fill: 'PAPER.floor',
          outline: 'INK.soft',
          lineWidth: 2,
        });
    }
  } else {
    ops.push(
      { op: 'line', x0: 72, y0: 210, x1: 72, y1: 44, width: 9, color: 'shade' },
      { op: 'line', x0: 184, y0: 210, x1: 184, y1: 44, width: 9, color: 'shade' },
    );
    for (let row = 0; row < 3; row++)
      ops.push({
        op: 'path',
        points: [
          [82, 62 + row * 48],
          [174, 62 + row * 48],
          [162, 100 + row * 48],
          [94, 100 + row * 48],
        ],
        close: true,
        fill: row % 2 ? 'shade' : 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      });
  }
  return { canvas: [256, 224], ops };
}

function utilityTemplate(form: FormId): SpriteOpList {
  const ops: SpriteOp[] = [];
  if (nameHas(form, 'wash-basin')) {
    ops.push(
      {
        op: 'blob',
        cx: 128,
        cy: 94,
        rx: 70,
        ry: 24,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [72, 96],
          [184, 96],
          [166, 150],
          [90, 150],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 128, y0: 150, x1: 128, y1: 206, width: 10, color: 'shade' },
      { op: 'line', x0: 80, y0: 210, x1: 176, y1: 210, width: 8, color: 'fill' },
    );
  } else if (nameHas(form, 'mirror-stand')) {
    ops.push(
      {
        op: 'blob',
        cx: 128,
        cy: 78,
        rx: 54,
        ry: 62,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 128, y0: 140, x1: 128, y1: 188, width: 9, color: 'shade' },
      {
        op: 'rect',
        x: 54,
        y: 174,
        w: 148,
        h: 28,
        r: 7,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 76, y0: 202, x1: 70, y1: 218, width: 7, color: 'shade' },
      { op: 'line', x0: 180, y0: 202, x1: 186, y1: 218, width: 7, color: 'shade' },
    );
  } else if (nameHas(form, 'vanity')) {
    ops.push(
      {
        op: 'blob',
        cx: 128,
        cy: 72,
        rx: 50,
        ry: 54,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 34,
        y: 132,
        w: 188,
        h: 34,
        r: 7,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 48,
        y: 166,
        w: 58,
        h: 42,
        r: 5,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      {
        op: 'rect',
        x: 150,
        y: 166,
        w: 58,
        h: 42,
        r: 5,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      { op: 'blob', cx: 128, cy: 148, rx: 7, ry: 7, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'boot-scraper')) {
    ops.push(
      {
        op: 'rect',
        x: 52,
        y: 150,
        w: 152,
        h: 34,
        r: 6,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 70, y0: 150, x1: 70, y1: 112, width: 6, color: 'shade' },
      { op: 'line', x0: 186, y0: 150, x1: 186, y1: 112, width: 6, color: 'shade' },
      { op: 'line', x0: 82, y0: 140, x1: 174, y1: 140, width: 9, color: 'shade' },
    );
  } else if (nameHas(form, 'mud-tray')) {
    ops.push(
      {
        op: 'path',
        points: [
          [40, 134],
          [216, 134],
          [196, 194],
          [60, 194],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [72, 154],
          [106, 146],
          [128, 176],
          [164, 150],
          [188, 176],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 5,
      },
      { op: 'line', x0: 58, y0: 184, x1: 198, y1: 184, width: 4, color: 'shade' },
    );
  } else if (nameHas(form, 'key-board', 'message-board', 'calendar-board', 'chalkboard')) {
    ops.push(
      {
        op: 'rect',
        x: 48,
        y: 42,
        w: 160,
        h: 126,
        r: 8,
        fill: nameHas(form, 'chalk') ? 'shade' : 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 128, y0: 168, x1: 128, y1: 212, width: 8, color: 'shade' },
    );
    if (nameHas(form, 'key'))
      for (let i = 0; i < 4; i++)
        ops.push({
          op: 'path',
          points: [
            [72 + i * 36, 78],
            [72 + i * 36, 126],
            [82 + i * 36, 134],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 5,
        });
    else if (nameHas(form, 'calendar'))
      for (let row = 0; row < 3; row++)
        ops.push({
          op: 'line',
          x0: 62,
          y0: 84 + row * 26,
          x1: 194,
          y1: 84 + row * 26,
          width: 4,
          color: row === 1 ? 'ROBOT.accent' : 'shade',
        });
    else
      ops.push(
        {
          op: 'rect',
          x: 66,
          y: 66,
          w: 48,
          h: 38,
          r: 4,
          fill: 'PAPER.floor',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        {
          op: 'rect',
          x: 126,
          y: 96,
          w: 58,
          h: 44,
          r: 4,
          fill: 'PAPER.floor',
          outline: 'INK.soft',
          lineWidth: 2,
        },
      );
  } else if (nameHas(form, 'firewood-rack')) {
    ops.push(
      {
        op: 'path',
        points: [
          [52, 196],
          [72, 74],
          [184, 74],
          [204, 196],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 12,
      },
      { op: 'line', x0: 62, y0: 170, x1: 194, y1: 170, width: 8, color: 'shade' },
    );
    for (let i = 0; i < 4; i++)
      ops.push({
        op: 'line',
        x0: 82 + i * 28,
        y0: 164,
        x1: 70 + i * 30,
        y1: 100,
        width: 12,
        color: i % 2 ? 'shade' : 'fill',
      });
  } else if (nameHas(form, 'log-basket')) {
    ops.push(
      {
        op: 'path',
        points: [
          [52, 92],
          [204, 92],
          [178, 206],
          [78, 206],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [74, 96],
          [82, 54],
          [174, 54],
          [182, 96],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 8,
      },
      { op: 'line', x0: 72, y0: 140, x1: 184, y1: 140, width: 5, color: 'shade' },
    );
    for (let i = 0; i < 4; i++)
      ops.push({
        op: 'line',
        x0: 92 + i * 24,
        y0: 178,
        x1: 78 + i * 28,
        y1: 112,
        width: 11,
        color: i % 2 ? 'shade' : 'fill',
      });
  } else if (nameHas(form, 'magazine-rack', 'laundry-hamper')) {
    ops.push(
      {
        op: 'path',
        points: [
          [56, 70],
          [200, 70],
          [180, 206],
          [76, 206],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [70, 92],
          [128, 120],
          [186, 92],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 7,
      },
      { op: 'line', x0: 84, y0: 150, x1: 172, y1: 150, width: 5, color: 'shade' },
    );
  } else if (nameHas(form, 'book-cart')) {
    ops.push(
      {
        op: 'rect',
        x: 46,
        y: 58,
        w: 164,
        h: 122,
        r: 7,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 56, y0: 104, x1: 200, y1: 104, width: 6, color: 'shade' },
      { op: 'line', x0: 56, y0: 150, x1: 200, y1: 150, width: 6, color: 'shade' },
      {
        op: 'blob',
        cx: 76,
        cy: 198,
        rx: 16,
        ry: 16,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 180,
        cy: 198,
        rx: 16,
        ry: 16,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else {
    ops.push(
      { op: 'line', x0: 128, y0: 206, x1: 128, y1: 48, width: 11, color: 'shade' },
      { op: 'line', x0: 68, y0: 64, x1: 188, y1: 64, width: 10, color: 'fill' },
      {
        op: 'path',
        points: [
          [76, 64],
          [62, 102],
          [88, 112],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 7,
      },
      {
        op: 'path',
        points: [
          [180, 64],
          [194, 102],
          [168, 112],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 7,
      },
      { op: 'line', x0: 78, y0: 210, x1: 178, y1: 210, width: 9, color: 'fill' },
    );
  }
  return { canvas: [256, 224], ops };
}

function kitchenTemplate(form: FormId): SpriteOpList {
  const ops: SpriteOp[] = [];
  if (nameHas(form, 'baker-rack', 'spice-rack', 'cooling-rack')) {
    ops.push(
      { op: 'line', x0: 54, y0: 212, x1: 54, y1: 38, width: 9, color: 'shade' },
      { op: 'line', x0: 202, y0: 212, x1: 202, y1: 38, width: 9, color: 'shade' },
    );
    for (let row = 0; row < 4; row++)
      ops.push({
        op: 'line',
        x0: 60,
        y0: 58 + row * 44,
        x1: 196,
        y1: 58 + row * 44,
        width: nameHas(form, 'cooling') ? 5 : 9,
        color: row % 2 ? 'shade' : 'fill',
      });
  } else if (nameHas(form, 'dish-hutch')) {
    ops.push({
      op: 'rect',
      x: 46,
      y: 40,
      w: 164,
      h: 170,
      r: 8,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    });
    for (let row = 0; row < 3; row++) {
      ops.push({
        op: 'line',
        x0: 58,
        y0: 88 + row * 50,
        x1: 198,
        y1: 88 + row * 50,
        width: 5,
        color: 'shade',
      });
      for (let col = 0; col < 3; col++)
        ops.push({
          op: 'blob',
          cx: 82 + col * 46,
          cy: 70 + row * 50,
          rx: 14,
          ry: 12,
          fill: 'PAPER.floor',
          outline: 'INK.soft',
          lineWidth: 2,
        });
    }
  } else if (nameHas(form, 'drying-cabinet')) {
    ops.push(
      {
        op: 'rect',
        x: 46,
        y: 40,
        w: 164,
        h: 170,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 128, y0: 46, x1: 128, y1: 204, width: 4, color: 'shade' },
    );
    for (let row = 0; row < 5; row++)
      ops.push({
        op: 'line',
        x0: 60,
        y0: 68 + row * 28,
        x1: 196,
        y1: 68 + row * 28,
        width: 5,
        color: row % 2 ? 'shade' : 'PAPER.floor',
      });
  } else if (nameHas(form, 'pie-safe')) {
    ops.push({
      op: 'rect',
      x: 46,
      y: 40,
      w: 164,
      h: 170,
      r: 8,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    });
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++)
        ops.push({
          op: 'blob',
          cx: 72 + col * 36,
          cy: 66 + row * 38,
          rx: 7,
          ry: 7,
          fill: 'PAPER.floor',
          outline: 'INK.soft',
          lineWidth: 1.5,
        });
    ops.push({ op: 'line', x0: 128, y0: 46, x1: 128, y1: 204, width: 4, color: 'shade' });
  } else if (nameHas(form, 'utensil-crock')) {
    ops.push(
      {
        op: 'path',
        points: [
          [72, 82],
          [184, 82],
          [166, 196],
          [90, 196],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 128,
        cy: 82,
        rx: 56,
        ry: 18,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 102, y0: 82, x1: 86, y1: 34, width: 7, color: 'shade' },
      { op: 'line', x0: 128, y0: 82, x1: 128, y1: 26, width: 7, color: 'fill' },
      { op: 'line', x0: 154, y0: 82, x1: 170, y1: 38, width: 7, color: 'shade' },
    );
  } else if (nameHas(form, 'crock-stand')) {
    ops.push(
      { op: 'line', x0: 54, y0: 206, x1: 54, y1: 58, width: 9, color: 'shade' },
      { op: 'line', x0: 202, y0: 206, x1: 202, y1: 58, width: 9, color: 'shade' },
      { op: 'line', x0: 60, y0: 100, x1: 196, y1: 100, width: 8, color: 'fill' },
      { op: 'line', x0: 60, y0: 170, x1: 196, y1: 170, width: 8, color: 'fill' },
      {
        op: 'blob',
        cx: 94,
        cy: 84,
        rx: 28,
        ry: 20,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 158,
        cy: 84,
        rx: 24,
        ry: 18,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 128,
        cy: 152,
        rx: 36,
        ry: 22,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else if (nameHas(form, 'bread-box')) {
    ops.push(
      {
        op: 'path',
        points: [
          [46, 116],
          [70, 62],
          [186, 62],
          [210, 116],
          [210, 196],
          [46, 196],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [62, 116],
          [194, 116],
          [194, 174],
          [62, 174],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 6,
      },
      { op: 'line', x0: 82, y0: 94, x1: 174, y1: 94, width: 5, color: 'shade' },
    );
  } else if (nameHas(form, 'grain-bin')) {
    ops.push(
      {
        op: 'path',
        points: [
          [50, 84],
          [206, 84],
          [184, 206],
          [72, 206],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [46, 86],
          [76, 52],
          [180, 52],
          [210, 86],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'rect',
        x: 100,
        y: 120,
        w: 56,
        h: 42,
        r: 6,
        fill: 'PAPER.floor',
        outline: 'INK.soft',
        lineWidth: 3,
      },
    );
  } else if (nameHas(form, 'flour-chest')) {
    ops.push(
      {
        op: 'rect',
        x: 42,
        y: 110,
        w: 172,
        h: 96,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [38, 112],
          [62, 78],
          [194, 78],
          [218, 112],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'rect',
        x: 102,
        y: 130,
        w: 52,
        h: 38,
        r: 6,
        fill: 'PAPER.floor',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      { op: 'line', x0: 58, y0: 178, x1: 198, y1: 178, width: 5, color: 'shade' },
    );
  } else if (nameHas(form, 'sink-counter')) {
    ops.push(
      {
        op: 'rect',
        x: 34,
        y: 92,
        w: 188,
        h: 112,
        r: 7,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 104,
        cy: 92,
        rx: 52,
        ry: 18,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 156, y0: 90, x1: 156, y1: 54, width: 8, color: 'shade' },
      {
        op: 'path',
        points: [
          [156, 56],
          [184, 56],
          [184, 76],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 8,
      },
      { op: 'line', x0: 128, y0: 112, x1: 128, y1: 198, width: 4, color: 'shade' },
    );
  } else if (nameHas(form, 'prep-counter')) {
    ops.push(
      {
        op: 'rect',
        x: 28,
        y: 80,
        w: 200,
        h: 30,
        r: 6,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 46,
        y: 110,
        w: 164,
        h: 96,
        r: 6,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 62,
        y: 130,
        w: 58,
        h: 58,
        r: 4,
        fill: 'PAPER.floor',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      { op: 'line', x0: 134, y0: 140, x1: 194, y1: 140, width: 5, color: 'shade' },
      { op: 'line', x0: 134, y0: 174, x1: 194, y1: 174, width: 5, color: 'shade' },
    );
  } else if (nameHas(form, 'kneading-board', 'chopping-block')) {
    ops.push(
      {
        op: 'rect',
        x: 38,
        y: 92,
        w: 180,
        h: nameHas(form, 'chopping') ? 54 : 28,
        r: 7,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 66, y0: 120, x1: 58, y1: 206, width: 10, color: 'shade' },
      { op: 'line', x0: 190, y0: 120, x1: 198, y1: 206, width: 10, color: 'shade' },
      { op: 'line', x0: 76, y0: 154, x1: 180, y1: 154, width: 7, color: 'fill' },
      {
        op: 'path',
        points: [
          [82, 104],
          [128, 96],
          [176, 108],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 4,
      },
    );
  } else {
    ops.push(
      {
        op: 'rect',
        x: 48,
        y: 46,
        w: 160,
        h: 164,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 60, y0: 92, x1: 196, y1: 92, width: 6, color: 'shade' },
      { op: 'line', x0: 60, y0: 144, x1: 196, y1: 144, width: 6, color: 'shade' },
      { op: 'line', x0: 128, y0: 50, x1: 128, y1: 204, width: 4, color: 'shade' },
      { op: 'blob', cx: 116, cy: 174, rx: 5, ry: 5, fill: 'ROBOT.accent' },
      { op: 'blob', cx: 140, cy: 174, rx: 5, ry: 5, fill: 'ROBOT.accent' },
    );
  }
  return { canvas: [256, 224], ops };
}

function lightTemplate(form: FormId, seed: number, detail: number): SpriteOpList {
  const top = 44 + (seed % 16);
  const ops: SpriteOp[] = [{ op: 'halo', cx: 96, cy: top + 24, r: 54 }];
  if (nameHas(form, 'desk-lamp')) {
    ops.push(
      { op: 'line', x0: 58, y0: 214, x1: 58, y1: 138, width: 9, color: 'shade' },
      { op: 'line', x0: 58, y0: 138, x1: 118, y1: 82, width: 9, color: 'shade' },
      {
        op: 'path',
        points: [
          [108, 72],
          [164, 82],
          [146, 126],
          [112, 104],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'blob', cx: 138, cy: 100, rx: 7, ry: 7, fill: 'ROBOT.accent' },
      {
        op: 'blob',
        cx: 58,
        cy: 216,
        rx: 42,
        ry: 12,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else if (nameHas(form, 'reading-light')) {
    ops.push(
      {
        op: 'path',
        points: [
          [52, 214],
          [58, 92],
          [104, 52],
          [144, 70],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 10,
      },
      {
        op: 'path',
        points: [
          [126, 58],
          [174, 72],
          [156, 114],
          [126, 94],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'blob', cx: 150, cy: 86, rx: 7, ry: 7, fill: 'ROBOT.accent' },
      {
        op: 'blob',
        cx: 52,
        cy: 216,
        rx: 42,
        ry: 12,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else if (nameHas(form, 'task-light')) {
    ops.push(
      {
        op: 'rect',
        x: 26,
        y: 176,
        w: 48,
        h: 42,
        r: 6,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 68, y0: 184, x1: 104, y1: 112, width: 9, color: 'shade' },
      { op: 'line', x0: 104, y0: 112, x1: 138, y1: 74, width: 9, color: 'fill' },
      {
        op: 'path',
        points: [
          [126, 62],
          [176, 76],
          [156, 116],
          [130, 94],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'blob', cx: 150, cy: 86, rx: 7, ry: 7, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'wall-sconce')) {
    ops.push(
      {
        op: 'rect',
        x: 34,
        y: 70,
        w: 30,
        h: 94,
        r: 6,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 62, y0: 116, x1: 116, y1: 116, width: 10, color: 'fill' },
      {
        op: 'path',
        points: [
          [98, 108],
          [156, 92],
          [168, 136],
          [112, 138],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'blob', cx: 136, cy: 118, rx: 7, ry: 7, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'pendant-light')) {
    ops.push(
      { op: 'line', x0: 96, y0: 0, x1: 96, y1: 72, width: 7, color: 'shade' },
      {
        op: 'path',
        points: [
          [46, 116],
          [146, 116],
          [124, 66],
          [68, 66],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'blob', cx: 96, cy: 100, rx: 8, ry: 8, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'oil-lamp')) {
    ops.push(
      {
        op: 'blob',
        cx: 96,
        cy: 154,
        rx: 50,
        ry: 38,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 72,
        y: 86,
        w: 48,
        h: 72,
        r: 16,
        fill: 'WATER.edge',
        outline: 'shade',
        lineWidth: 5,
      },
      { op: 'blob', cx: 96, cy: 108, rx: 9, ry: 14, fill: 'ROBOT.accent' },
      {
        op: 'path',
        points: [
          [54, 144],
          [36, 126],
          [44, 110],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 8,
      },
      { op: 'line', x0: 70, y0: 194, x1: 122, y1: 194, width: 7, color: 'shade' },
    );
  } else if (nameHas(form, 'candelabrum', 'candle-stand')) {
    const count = nameHas(form, 'candelabrum') ? 3 : 1;
    ops.push(
      { op: 'line', x0: 96, y0: 214, x1: 96, y1: 94, width: 9, color: 'shade' },
      {
        op: 'blob',
        cx: 96,
        cy: 216,
        rx: 42,
        ry: 12,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 96 : 58 + i * 38;
      ops.push(
        {
          op: 'path',
          points: [
            [96, 112],
            [x, 88],
            [x, 62],
          ],
          fill: undefined,
          outline: 'fill',
          lineWidth: 7,
        },
        { op: 'blob', cx: x, cy: 52, rx: 7, ry: 12, fill: 'CLAY.blossom' },
      );
    }
  } else if (nameHas(form, 'paper-lantern')) {
    ops.push(
      { op: 'line', x0: 96, y0: 8, x1: 96, y1: 48, width: 6, color: 'shade' },
      {
        op: 'blob',
        cx: 96,
        cy: 110,
        rx: 54,
        ry: 66,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 48, y0: 84, x1: 144, y1: 84, width: 4, color: 'shade' },
      { op: 'line', x0: 46, y0: 128, x1: 146, y1: 128, width: 4, color: 'shade' },
      { op: 'blob', cx: 96, cy: 108, rx: 8, ry: 8, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'storm-lantern', 'jar-lantern')) {
    ops.push(
      {
        op: 'rect',
        x: 58,
        y: 72,
        w: 76,
        h: 116,
        r: 18,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [64, 82],
          [70, 38],
          [122, 38],
          [128, 82],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 7,
      },
      { op: 'blob', cx: 96, cy: 130, rx: 11, ry: 18, fill: 'ROBOT.accent' },
      { op: 'line', x0: 58, y0: 100, x1: 134, y1: 100, width: 5, color: 'shade' },
      { op: 'line', x0: 58, y0: 168, x1: 134, y1: 168, width: 5, color: 'shade' },
    );
  } else if (nameHas(form, 'mushroom-lamp')) {
    ops.push(
      {
        op: 'blob',
        cx: 96,
        cy: 76,
        rx: 62,
        ry: 34,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [76, 92],
          [116, 92],
          [126, 210],
          [66, 210],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'blob', cx: 96, cy: 94, rx: 8, ry: 8, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'path-light')) {
    ops.push(
      {
        op: 'rect',
        x: 66,
        y: 74,
        w: 60,
        h: 142,
        r: 14,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 58,
        y: 58,
        w: 76,
        h: 58,
        r: 12,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'blob', cx: 96, cy: 86, rx: 9, ry: 9, fill: 'ROBOT.accent' },
      { op: 'line', x0: 72, y0: 116, x1: 120, y1: 116, width: 4, color: 'PAPER.floor' },
    );
  } else if (nameHas(form, 'bollard-light')) {
    ops.push(
      {
        op: 'path',
        points: [
          [62, 70],
          [130, 70],
          [122, 216],
          [70, 216],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 52,
        y: 48,
        w: 88,
        h: 58,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 60, y0: 84, x1: 132, y1: 84, width: 6, color: 'PAPER.floor' },
      { op: 'blob', cx: 96, cy: 76, rx: 8, ry: 8, fill: 'ROBOT.accent' },
    );
  } else if (nameHas(form, 'string-light')) {
    ops.push({
      op: 'path',
      points: [
        [18, 56],
        [64, 92],
        [112, 70],
        [160, 106],
        [184, 72],
      ],
      fill: undefined,
      outline: 'shade',
      lineWidth: 6,
    });
    for (const [x, y] of [
      [34, 68],
      [76, 88],
      [118, 76],
      [154, 100],
      [178, 78],
    ] as const)
      ops.push(
        { op: 'line', x0: x, y0: y, x1: x, y1: y + 18, width: 4, color: 'shade' },
        {
          op: 'blob',
          cx: x,
          cy: y + 24,
          rx: 8,
          ry: 10,
          fill: 'ROBOT.accent',
          outline: 'INK.soft',
          lineWidth: 2,
        },
      );
  } else if (nameHas(form, 'beacon-lamp')) {
    ops.push(
      { op: 'line', x0: 96, y0: 216, x1: 96, y1: 74, width: 9, color: 'shade' },
      {
        op: 'path',
        points: [
          [42, 96],
          [96, 56],
          [150, 96],
          [96, 126],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 96,
        cy: 92,
        rx: 16,
        ry: 16,
        fill: 'ROBOT.accent',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      { op: 'line', x0: 54, y0: 216, x1: 138, y1: 216, width: 8, color: 'fill' },
    );
  } else if (nameHas(form, 'reflector-lamp')) {
    ops.push(
      { op: 'line', x0: 72, y0: 216, x1: 86, y1: 112, width: 9, color: 'shade' },
      {
        op: 'path',
        points: [
          [64, 116],
          [132, 52],
          [164, 82],
          [94, 136],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 124,
        cy: 88,
        rx: 14,
        ry: 14,
        fill: 'ROBOT.accent',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      { op: 'line', x0: 42, y0: 216, x1: 112, y1: 216, width: 8, color: 'fill' },
    );
  } else if (nameHas(form, 'sun-catcher')) {
    ops.push(
      { op: 'line', x0: 96, y0: 8, x1: 96, y1: 48, width: 5, color: 'shade' },
      {
        op: 'blob',
        cx: 96,
        cy: 92,
        rx: 46,
        ry: 46,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [96, 58],
          [106, 82],
          [132, 92],
          [106, 102],
          [96, 128],
          [86, 102],
          [60, 92],
          [86, 82],
        ],
        close: true,
        fill: 'ROBOT.accent',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      { op: 'line', x0: 96, y0: 138, x1: 96, y1: 188, width: 5, color: 'shade' },
      { op: 'blob', cx: 96, cy: 198, rx: 12, ry: 16, fill: 'CLAY.blossom' },
    );
  } else if (nameHas(form, 'hearth-lamp')) {
    ops.push(
      {
        op: 'blob',
        cx: 96,
        cy: 168,
        rx: 66,
        ry: 28,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [54, 156],
          [74, 88],
          [96, 118],
          [118, 80],
          [140, 156],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'blob', cx: 96, cy: 130, rx: 13, ry: 20, fill: 'ROBOT.accent' },
      { op: 'line', x0: 46, y0: 194, x1: 146, y1: 194, width: 8, color: 'shade' },
    );
  } else {
    ops.push(
      { op: 'line', x0: 96, y0: 244, x1: 96, y1: top + 30, width: 8, color: 'shade' },
      {
        op: 'path',
        points: [
          [58, top + 36],
          [134, top + 36],
          [116 + detail / 2, top],
          [76 - detail / 2, top],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 96,
        cy: top + 22,
        rx: 7,
        ry: 7,
        fill: 'ROBOT.accent',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'blob',
        cx: 96,
        cy: 244,
        rx: 44,
        ry: 12,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  }
  return { canvas: [192, 256], ops };
}

function gardenTemplate(
  form: FormId,
  seed: number,
  width: number,
  height: number,
  detail: number,
): SpriteOpList {
  void seed;
  void width;
  void height;
  void detail;
  const ops: SpriteOp[] = [];
  if (nameHas(form, 'potting-bench')) {
    ops.push(
      {
        op: 'rect',
        x: 30,
        y: 102,
        w: 164,
        h: 24,
        r: 5,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 42,
        y: 50,
        w: 140,
        h: 54,
        r: 5,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 52, y0: 126, x1: 44, y1: 214, width: 9, color: 'shade' },
      { op: 'line', x0: 172, y0: 126, x1: 180, y1: 214, width: 9, color: 'shade' },
      { op: 'line', x0: 58, y0: 174, x1: 166, y1: 174, width: 8, color: 'fill' },
    );
  } else if (nameHas(form, 'raised-bed')) {
    ops.push(
      {
        op: 'path',
        points: [
          [24, 128],
          [200, 128],
          [182, 202],
          [42, 202],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 112,
        cy: 130,
        rx: 86,
        ry: 20,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
    for (let i = 0; i < 5; i++)
      ops.push({
        op: 'grass',
        x: 62 + i * 25,
        baseY: 126,
        height: 42 + (i % 2) * 18,
        lean: i % 2 ? 10 : -10,
        width: 5,
        color: 'SAGE.mid',
      });
  } else if (nameHas(form, 'window-box')) {
    ops.push(
      {
        op: 'rect',
        x: 40,
        y: 96,
        w: 144,
        h: 48,
        r: 5,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [34, 144],
          [190, 144],
          [170, 202],
          [54, 202],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
    );
    for (let i = 0; i < 4; i++)
      ops.push({
        op: 'grass',
        x: 66 + i * 30,
        baseY: 142,
        height: 44 + (i % 2) * 16,
        lean: i % 2 ? 12 : -12,
        width: 5,
        color: 'SAGE.mid',
      });
  } else if (nameHas(form, 'hanging-planter')) {
    ops.push(
      { op: 'line', x0: 68, y0: 24, x1: 88, y1: 116, width: 5, color: 'shade' },
      { op: 'line', x0: 156, y0: 24, x1: 136, y1: 116, width: 5, color: 'shade' },
      {
        op: 'path',
        points: [
          [62, 116],
          [162, 116],
          [142, 186],
          [82, 186],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'grass', x: 92, baseY: 116, height: 50, lean: -18, width: 5, color: 'SAGE.mid' },
      { op: 'grass', x: 132, baseY: 116, height: 58, lean: 18, width: 5, color: 'SAGE.mid' },
    );
  } else if (nameHas(form, 'herb-rack')) {
    ops.push(
      { op: 'line', x0: 54, y0: 214, x1: 54, y1: 38, width: 9, color: 'shade' },
      { op: 'line', x0: 170, y0: 214, x1: 170, y1: 38, width: 9, color: 'shade' },
    );
    for (let row = 0; row < 3; row++)
      ops.push(
        {
          op: 'line',
          x0: 60,
          y0: 74 + row * 52,
          x1: 164,
          y1: 74 + row * 52,
          width: 8,
          color: 'fill',
        },
        {
          op: 'path',
          points: [
            [84, 76 + row * 52],
            [92, 100 + row * 52],
            [108, 100 + row * 52],
            [116, 76 + row * 52],
          ],
          close: true,
          fill: 'shade',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        {
          op: 'grass',
          x: 100,
          baseY: 76 + row * 52,
          height: 26,
          lean: row % 2 ? 10 : -10,
          width: 4,
          color: 'SAGE.mid',
        },
      );
  } else if (nameHas(form, 'propagation-shelf')) {
    ops.push(
      {
        op: 'rect',
        x: 42,
        y: 42,
        w: 140,
        h: 166,
        r: 8,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 48, y0: 96, x1: 176, y1: 96, width: 7, color: 'shade' },
      { op: 'line', x0: 48, y0: 150, x1: 176, y1: 150, width: 7, color: 'shade' },
      { op: 'line', x0: 112, y0: 46, x1: 112, y1: 202, width: 4, color: 'shade' },
    );
    for (const [x, y] of [
      [78, 92],
      [144, 92],
      [78, 146],
      [144, 146],
    ] as const)
      ops.push({
        op: 'grass',
        x,
        baseY: y,
        height: 24,
        lean: x < 100 ? -8 : 8,
        width: 4,
        color: 'SAGE.mid',
      });
  } else if (nameHas(form, 'plant-ladder')) {
    ops.push(
      { op: 'line', x0: 48, y0: 214, x1: 82, y1: 38, width: 10, color: 'shade' },
      { op: 'line', x0: 176, y0: 214, x1: 142, y1: 38, width: 10, color: 'shade' },
    );
    for (let row = 0; row < 4; row++)
      ops.push(
        {
          op: 'line',
          x0: 72 - row * 4,
          y0: 72 + row * 38,
          x1: 152 + row * 4,
          y1: 72 + row * 38,
          width: 8,
          color: 'fill',
        },
        {
          op: 'grass',
          x: 112,
          baseY: 68 + row * 38,
          height: 24,
          lean: row % 2 ? 10 : -10,
          width: 4,
          color: 'SAGE.mid',
        },
      );
  } else if (nameHas(form, 'seed-tray')) {
    ops.push({
      op: 'path',
      points: [
        [34, 120],
        [190, 120],
        [178, 188],
        [46, 188],
      ],
      close: true,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    });
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 5; col++)
        ops.push({
          op: 'rect',
          x: 52 + col * 27,
          y: 132 + row * 24,
          w: 20,
          h: 18,
          r: 4,
          fill: (row + col) % 2 ? 'shade' : 'PAPER.floor',
          outline: 'INK.soft',
          lineWidth: 2,
        });
  } else if (nameHas(form, 'compost-bin')) {
    ops.push(
      {
        op: 'path',
        points: [
          [44, 64],
          [180, 64],
          [166, 210],
          [58, 210],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [36, 66],
          [62, 38],
          [162, 38],
          [188, 66],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
    for (let i = 0; i < 4; i++)
      ops.push({
        op: 'line',
        x0: 66 + i * 30,
        y0: 82,
        x1: 66 + i * 30,
        y1: 194,
        width: 5,
        color: 'shade',
      });
  } else if (nameHas(form, 'rain-barrel')) {
    ops.push(
      {
        op: 'blob',
        cx: 112,
        cy: 70,
        rx: 62,
        ry: 18,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'rect',
        x: 50,
        y: 70,
        w: 124,
        h: 136,
        r: 22,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 54, y0: 112, x1: 170, y1: 112, width: 7, color: 'shade' },
      { op: 'line', x0: 54, y0: 166, x1: 170, y1: 166, width: 7, color: 'shade' },
      {
        op: 'path',
        points: [
          [174, 172],
          [204, 172],
          [204, 192],
        ],
        fill: undefined,
        outline: 'WATER.deep',
        lineWidth: 8,
      },
    );
  } else if (nameHas(form, 'watering-station')) {
    ops.push(
      { op: 'line', x0: 78, y0: 214, x1: 78, y1: 42, width: 10, color: 'shade' },
      { op: 'line', x0: 54, y0: 58, x1: 166, y1: 58, width: 9, color: 'fill' },
      {
        op: 'path',
        points: [
          [116, 58],
          [116, 116],
          [154, 116],
          [154, 140],
        ],
        fill: undefined,
        outline: 'WATER.deep',
        lineWidth: 8,
      },
      {
        op: 'blob',
        cx: 154,
        cy: 168,
        rx: 44,
        ry: 18,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else if (nameHas(form, 'hose-reel')) {
    ops.push(
      {
        op: 'blob',
        cx: 112,
        cy: 112,
        rx: 58,
        ry: 58,
        fill: undefined,
        outline: 'fill',
        lineWidth: 13,
      },
      {
        op: 'blob',
        cx: 112,
        cy: 112,
        rx: 14,
        ry: 14,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'path',
        points: [
          [112, 112],
          [154, 132],
          [188, 106],
          [206, 130],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 7,
      },
      { op: 'line', x0: 74, y0: 160, x1: 62, y1: 208, width: 8, color: 'shade' },
      { op: 'line', x0: 150, y0: 160, x1: 162, y1: 208, width: 8, color: 'shade' },
    );
  } else if (nameHas(form, 'garden-cart', 'wheelbarrow')) {
    ops.push(
      {
        op: 'path',
        points: [
          [38, 92],
          [166, 92],
          [142, 162],
          [60, 162],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 146, y0: 144, x1: 210, y1: 92, width: 9, color: 'shade' },
      {
        op: 'blob',
        cx: 72,
        cy: 188,
        rx: 22,
        ry: 22,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 130, y0: 158, x1: 150, y1: 204, width: 8, color: 'shade' },
    );
  } else if (nameHas(form, 'cold-cloche')) {
    ops.push(
      {
        op: 'blob',
        cx: 112,
        cy: 126,
        rx: 76,
        ry: 70,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 112, y0: 58, x1: 112, y1: 192, width: 4, color: 'shade' },
      { op: 'line', x0: 48, y0: 154, x1: 176, y1: 154, width: 4, color: 'shade' },
      { op: 'grass', x: 92, baseY: 178, height: 50, lean: -12, width: 5, color: 'SAGE.mid' },
      { op: 'grass', x: 132, baseY: 178, height: 58, lean: 12, width: 5, color: 'SAGE.mid' },
    );
  } else if (nameHas(form, 'bee-waterer')) {
    ops.push(
      { op: 'line', x0: 112, y0: 210, x1: 112, y1: 104, width: 10, color: 'shade' },
      {
        op: 'blob',
        cx: 112,
        cy: 126,
        rx: 62,
        ry: 20,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 88,
        cy: 122,
        rx: 12,
        ry: 8,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'blob',
        cx: 130,
        cy: 128,
        rx: 10,
        ry: 7,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      { op: 'line', x0: 66, y0: 210, x1: 158, y1: 210, width: 8, color: 'fill' },
    );
  } else if (nameHas(form, 'butterfly-feeder')) {
    ops.push(
      { op: 'line', x0: 112, y0: 210, x1: 112, y1: 78, width: 9, color: 'shade' },
      {
        op: 'blob',
        cx: 112,
        cy: 104,
        rx: 52,
        ry: 14,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'blob', cx: 112, cy: 98, rx: 8, ry: 8, fill: 'ROBOT.accent' },
      {
        op: 'path',
        points: [
          [88, 82],
          [72, 58],
          [96, 70],
          [112, 92],
        ],
        close: true,
        fill: 'CLAY.blossom',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'path',
        points: [
          [136, 82],
          [152, 58],
          [128, 70],
          [112, 92],
        ],
        close: true,
        fill: 'CLAY.blossom',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      { op: 'line', x0: 70, y0: 210, x1: 154, y1: 210, width: 8, color: 'fill' },
    );
  } else if (nameHas(form, 'bird-feeder')) {
    ops.push(
      { op: 'line', x0: 112, y0: 210, x1: 112, y1: 74, width: 10, color: 'shade' },
      {
        op: 'blob',
        cx: 112,
        cy: 112,
        rx: 58,
        ry: 16,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [58, 94],
          [112, 48],
          [166, 94],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'blob', cx: 112, cy: 110, rx: 9, ry: 9, fill: 'ROBOT.accent' },
      { op: 'line', x0: 66, y0: 210, x1: 158, y1: 210, width: 8, color: 'fill' },
    );
  } else {
    ops.push(
      {
        op: 'blob',
        cx: 112,
        cy: 142,
        rx: 76,
        ry: 28,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [52, 142],
          [172, 142],
          [154, 194],
          [70, 194],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 112, y0: 140, x1: 112, y1: 76, width: 8, color: 'shade' },
      {
        op: 'blob',
        cx: 112,
        cy: 70,
        rx: 18,
        ry: 12,
        fill: 'WATER.deep',
        outline: 'INK.soft',
        lineWidth: 2,
      },
    );
  }
  return { canvas: [224, 224], ops };
}

function buildingTemplate(
  form: FormId,
  silhouette: IdentitySilhouette,
  seed: number,
  width: number,
  height: number,
  detail: number,
): SpriteOpList {
  const w = Math.max(132, width);
  const h = Math.max(104, height);
  const x = (288 - w) / 2;
  const y = 270 - h;
  const ops: SpriteOp[] = [];

  if (nameHas(form, 'courtyard')) {
    ops.push(
      {
        op: 'rect',
        x,
        y: y + 28,
        w: w * 0.32,
        h: h - 28,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: x + w * 0.68,
        y: y + 28,
        w: w * 0.32,
        h: h - 28,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [x - 10, y + 36],
          [x + w * 0.22, y],
          [x + w * 0.5, y + 22],
          [x + w * 0.78, y],
          [x + w + 10, y + 36],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 18,
      },
      {
        op: 'line',
        x0: x + w * 0.34,
        y0: 270,
        x1: x + w * 0.66,
        y1: 270,
        width: 12,
        color: 'fill',
      },
    );
  } else if (nameHas(form, 'gatehouse')) {
    const towerW = w * 0.3;
    ops.push(
      {
        op: 'rect',
        x,
        y: y + 20,
        w: towerW,
        h: h - 20,
        r: 7,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: x + w - towerW,
        y: y + 20,
        w: towerW,
        h: h - 20,
        r: 7,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: x + towerW - 4,
        y: y + 24,
        w: w - towerW * 2 + 8,
        h: 34,
        r: 5,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [x - 10, y + 22],
          [x + towerW / 2, y - 28],
          [x + towerW + 8, y + 22],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'path',
        points: [
          [x + w - towerW - 8, y + 22],
          [x + w - towerW / 2, y - 28],
          [x + w + 10, y + 22],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else if (nameHas(form, 'roundhouse', 'earth-lodge', 'sleeping-pod', 'bath-hut')) {
    ops.push(
      {
        op: 'blob',
        cx: 144,
        cy: y + h * 0.56,
        rx: w * 0.49,
        ry: h * 0.58,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
        irregularity: nameHas(form, 'earth-lodge') ? 0.18 : 0.06,
      },
      {
        op: 'blob',
        cx: 144,
        cy: y + 14,
        rx: w * 0.43,
        ry: nameHas(form, 'sleeping-pod') ? 38 : 24,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
    );
  } else if (nameHas(form, 'a-frame')) {
    ops.push(
      {
        op: 'path',
        points: [
          [144, y - 70],
          [x - 12, 270],
          [x + w + 12, 270],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 6,
      },
      { op: 'line', x0: 144, y0: y - 58, x1: 144, y1: 270, width: 5, color: 'shade' },
      { op: 'line', x0: x + 20, y0: 232, x1: x + w - 20, y1: 232, width: 5, color: 'shade' },
    );
  } else if (nameHas(form, 'lean-to')) {
    ops.push(
      {
        op: 'path',
        points: [
          [x - 8, y - 26],
          [x + w + 10, y + 16],
          [x + w - 2, 270],
          [x + 8, 270],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 6,
      },
      { op: 'line', x0: x - 14, y0: y - 32, x1: x + w + 18, y1: y + 12, width: 9, color: 'shade' },
      { op: 'line', x0: x + 24, y0: y - 12, x1: x + 24, y1: 270, width: 5, color: 'shade' },
    );
  } else if (nameHas(form, 'sunroom', 'glasshouse')) {
    ops.push(
      {
        op: 'path',
        points: [
          [x, 270],
          [x, y + 30],
          [144, y - 38],
          [x + w, y + 30],
          [x + w, 270],
        ],
        close: true,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 6,
      },
      { op: 'line', x0: 144, y0: y - 34, x1: 144, y1: 270, width: 5, color: 'shade' },
      {
        op: 'line',
        x0: x + w * 0.25,
        y0: y + 15,
        x1: x + w * 0.25,
        y1: 270,
        width: 4,
        color: 'shade',
      },
      {
        op: 'line',
        x0: x + w * 0.75,
        y0: y + 15,
        x1: x + w * 0.75,
        y1: 270,
        width: 4,
        color: 'shade',
      },
      {
        op: 'line',
        x0: x + 4,
        y0: y + h * 0.56,
        x1: x + w - 4,
        y1: y + h * 0.56,
        width: 4,
        color: 'shade',
      },
    );
  } else {
    const raised = nameHas(form, 'stilt', 'lake', 'boathouse');
    const bodyBottom = raised ? 224 : 270;
    const bodyY = raised ? y - 6 : y;
    const roofVariant = seed % 4;
    ops.push({
      op: 'rect',
      x,
      y: bodyY,
      w,
      h: bodyBottom - bodyY,
      r: roofVariant === 3 ? 18 : 8,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    });
    const roofPoints: Array<[number, number]> =
      roofVariant === 0
        ? [
            [x - 14, bodyY + 6],
            [144, bodyY - 68],
            [x + w + 14, bodyY + 6],
          ]
        : roofVariant === 1
          ? [
              [x - 12, bodyY + 3],
              [x + w * 0.68, bodyY - 48],
              [x + w + 12, bodyY - 12],
            ]
          : roofVariant === 2
            ? [
                [x - 12, bodyY + 4],
                [x + w * 0.28, bodyY - 54],
                [x + w * 0.72, bodyY - 54],
                [x + w + 12, bodyY + 4],
              ]
            : [
                [x - 10, bodyY + 4],
                [144, bodyY - 34],
                [x + w + 10, bodyY + 4],
              ];
    ops.push({
      op: 'path',
      points: roofPoints,
      close: true,
      fill: 'shade',
      outline: 'INK.line',
      lineWidth: 5,
    });
    if (raised)
      ops.push(
        { op: 'line', x0: x + 24, y0: bodyBottom, x1: x + 14, y1: 274, width: 9, color: 'shade' },
        {
          op: 'line',
          x0: x + w - 24,
          y0: bodyBottom,
          x1: x + w - 14,
          y1: 274,
          width: 9,
          color: 'shade',
        },
        { op: 'line', x0: 144, y0: bodyBottom, x1: 174, y1: 274, width: 7, color: 'fill' },
      );
  }

  const doorY = nameHas(form, 'stilt', 'lake', 'boathouse') ? 162 : 270 - h * 0.55;
  if (!nameHas(form, 'courtyard', 'gatehouse', 'sunroom', 'glasshouse')) {
    ops.push({
      op: 'rect',
      x: 144 - detail,
      y: doorY,
      w: detail * 2,
      h: Math.max(46, 270 - doorY),
      r: nameHas(form, 'roundhouse', 'pod') ? detail : 5,
      fill: 'PAPER.floor',
      outline: 'INK.soft',
      lineWidth: 3,
    });
  }
  if (!nameHas(form, 'a-frame', 'lean-to', 'courtyard', 'gatehouse'))
    ops.push({
      op: 'blob',
      cx: x + 30,
      cy: y + h * 0.42,
      rx: 13,
      ry: 17,
      fill: 'WATER.edge',
      outline: 'INK.soft',
      lineWidth: 3,
    });

  if (silhouette === 'house') {
    if (nameHas(form, 'garden-cabin'))
      ops.push(
        { op: 'line', x0: x - 8, y0: 206, x1: x + w * 0.56, y1: 206, width: 10, color: 'shade' },
        { op: 'line', x0: x + 8, y0: 208, x1: x + 8, y1: 270, width: 7, color: 'shade' },
        {
          op: 'rect',
          x: x - 14,
          y: 242,
          w: 42,
          h: 18,
          r: 5,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 3,
        },
      );
    else if (nameHas(form, 'tea-house'))
      ops.push(
        { op: 'line', x0: x - 24, y0: y + 8, x1: x + w + 24, y1: y + 8, width: 12, color: 'shade' },
        {
          op: 'rect',
          x: x - 10,
          y: 250,
          w: w + 20,
          h: 18,
          r: 4,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
        {
          op: 'line',
          x0: x + w * 0.3,
          y0: 198,
          x1: x + w * 0.3,
          y1: 248,
          width: 5,
          color: 'shade',
        },
        {
          op: 'line',
          x0: x + w * 0.7,
          y0: 198,
          x1: x + w * 0.7,
          y1: 248,
          width: 5,
          color: 'shade',
        },
      );
    else if (nameHas(form, 'cottage') && !nameHas(form, 'lake-cottage'))
      ops.push(
        {
          op: 'rect',
          x: x + w - 38,
          y: y - 48,
          w: 22,
          h: 74,
          r: 4,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        {
          op: 'path',
          points: [
            [x - 18, 270],
            [x - 18, 226],
            [x + 26, 208],
            [x + 48, 270],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
      );
    else if (nameHas(form, 'hill-shelter'))
      ops.push({
        op: 'path',
        points: [
          [x - 34, y + 18],
          [x + w * 0.35, y - 32],
          [x + w + 34, y + 30],
        ],
        fill: undefined,
        outline: 'SAGE.mid',
        lineWidth: 18,
      });
    else if (nameHas(form, 'tool-shed'))
      ops.push(
        { op: 'line', x0: 118, y0: 202, x1: 170, y1: 252, width: 6, color: 'shade' },
        { op: 'line', x0: 170, y0: 202, x1: 118, y1: 252, width: 6, color: 'shade' },
      );
    else if (nameHas(form, 'seed-house'))
      ops.push(
        {
          op: 'rect',
          x: 128,
          y: y - 48,
          w: 32,
          h: 34,
          r: 6,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
        {
          op: 'path',
          points: [
            [122, y - 44],
            [144, y - 68],
            [166, y - 44],
          ],
          close: true,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
      );
    else if (nameHas(form, 'potting-shed'))
      ops.push(
        {
          op: 'rect',
          x: x + w - 8,
          y: 216,
          w: 64,
          h: 18,
          r: 4,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: x + w + 4, y0: 232, x1: x + w, y1: 270, width: 7, color: 'shade' },
        { op: 'line', x0: x + w + 44, y0: 232, x1: x + w + 50, y1: 270, width: 7, color: 'shade' },
      );
    else if (nameHas(form, 'reading-hut'))
      ops.push({
        op: 'path',
        points: [
          [x - 12, 190],
          [x + 34, 176],
          [x + 52, 224],
          [x - 8, 232],
        ],
        close: true,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 4,
      });
    else if (nameHas(form, 'quiet-room'))
      ops.push({
        op: 'blob',
        cx: x + w * 0.7,
        cy: 202,
        rx: 24,
        ry: 24,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 4,
      });
    else if (nameHas(form, 'lake-cottage'))
      ops.push(
        { op: 'line', x0: x - 20, y0: 232, x1: x + w + 20, y1: 232, width: 7, color: 'fill' },
        { op: 'line', x0: x - 10, y0: 210, x1: x - 10, y1: 246, width: 5, color: 'shade' },
        { op: 'line', x0: x + w + 10, y0: 210, x1: x + w + 10, y1: 246, width: 5, color: 'shade' },
      );
  }

  if (silhouette === 'workshop') {
    if (nameHas(form, 'watermill'))
      ops.push(
        {
          op: 'blob',
          cx: x + w + 10,
          cy: 208,
          rx: 42,
          ry: 42,
          fill: undefined,
          outline: 'shade',
          lineWidth: 10,
        },
        { op: 'line', x0: x + w - 28, y0: 208, x1: x + w + 48, y1: 208, width: 5, color: 'shade' },
        { op: 'line', x0: x + w + 10, y0: 170, x1: x + w + 10, y1: 246, width: 5, color: 'shade' },
      );
    else if (nameHas(form, 'windmill'))
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI * i) / 2;
        ops.push({
          op: 'line',
          x0: 144,
          y0: y + 36,
          x1: 144 + Math.cos(angle) * 60,
          y1: y + 36 + Math.sin(angle) * 60,
          width: 9,
          color: 'shade',
        });
      }
    else if (nameHas(form, 'barn', 'granary'))
      ops.push({ op: 'line', x0: 112, y0: 190, x1: 176, y1: 246, width: 6, color: 'shade' });
    else if (nameHas(form, 'pottery', 'kiln', 'smoke'))
      ops.push({
        op: 'path',
        points: [
          [x + w - 50, y],
          [x + w - 46, y - 66],
          [x + w - 22, y - 66],
          [x + w - 16, y + 8],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      });
    if (nameHas(form, 'carpentry'))
      ops.push(
        {
          op: 'rect',
          x: x - 34,
          y: 218,
          w: 74,
          h: 16,
          r: 3,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: x - 20, y0: 234, x1: x - 28, y1: 272, width: 6, color: 'shade' },
        { op: 'line', x0: x + 26, y0: 234, x1: x + 34, y1: 272, width: 6, color: 'shade' },
      );
    else if (nameHas(form, 'weaving'))
      for (let i = 0; i < 4; i++) {
        ops.push({
          op: 'line',
          x0: x + 28 + i * 16,
          y0: 174,
          x1: x + 28 + i * 16,
          y1: 248,
          width: 4,
          color: i % 2 ? 'shade' : 'fill',
        });
      }
    else if (nameHas(form, 'repair-bay'))
      ops.push({
        op: 'rect',
        x: x + 26,
        y: 170,
        w: w - 52,
        h: 100,
        r: 8,
        fill: 'PAPER.floor',
        outline: 'shade',
        lineWidth: 6,
      });
    else if (nameHas(form, 'wash-house'))
      ops.push(
        {
          op: 'blob',
          cx: x + w * 0.25,
          cy: 232,
          rx: 24,
          ry: 14,
          fill: 'WATER.edge',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: x + 18, y0: 158, x1: x + w - 18, y1: 158, width: 4, color: 'shade' },
      );
    else if (nameHas(form, 'drying-house'))
      for (let row = 0; row < 3; row++) {
        ops.push({
          op: 'line',
          x0: x + 18,
          y0: 170 + row * 28,
          x1: x + w - 18,
          y1: 170 + row * 28,
          width: 5,
          color: 'shade',
        });
      }
    else if (nameHas(form, 'pump-house'))
      ops.push(
        { op: 'line', x0: x + w - 18, y0: 212, x1: x + w + 42, y1: 212, width: 12, color: 'shade' },
        { op: 'line', x0: x + w + 38, y0: 210, x1: x + w + 38, y1: 250, width: 8, color: 'fill' },
      );
    else if (nameHas(form, 'compost-house'))
      for (let i = 0; i < 4; i++) {
        ops.push({
          op: 'line',
          x0: x + 22 + i * 24,
          y0: 180,
          x1: x + 22 + i * 24,
          y1: 250,
          width: 5,
          color: 'shade',
        });
      }
  }
  return { canvas: [288, 288], ops };
}

function canopyTemplate(form: FormId, seed: number, width: number, height: number): SpriteOpList {
  const w = Math.max(150, width);
  const x = (288 - w) / 2;
  const top = 72 + (seed % 24);
  const ops: SpriteOp[] = [];
  if (nameHas(form, 'gate', 'bower', 'arbor')) {
    ops.push(
      {
        op: 'path',
        points: [
          [x + 14, 270],
          [x + 18, top + 44],
          [144, top - 42],
          [x + w - 18, top + 44],
          [x + w - 14, 270],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 16,
      },
      {
        op: 'line',
        x0: x + 26,
        y0: top + 84,
        x1: x + w - 26,
        y1: top + 84,
        width: 6,
        color: 'shade',
      },
    );
  } else if (nameHas(form, 'tunnel', 'winter-garden', 'fern-house')) {
    for (let i = 0; i < 4; i++) {
      const inset = i * 18;
      ops.push({
        op: 'path',
        points: [
          [x + inset, 270 - inset * 0.2],
          [x + inset + 8, top + inset * 0.25],
          [144, top - 34 + inset * 0.15],
          [x + w - inset - 8, top + inset * 0.25],
          [x + w - inset, 270 - inset * 0.2],
        ],
        fill: undefined,
        outline: i === 0 ? 'fill' : 'shade',
        lineWidth: i === 0 ? 10 : 5,
      });
    }
  } else if (nameHas(form, 'shade-sail')) {
    ops.push(
      {
        op: 'path',
        points: [
          [x - 6, top + 36],
          [x + w * 0.68, top - 24],
          [x + w + 12, top + 72],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: x, y0: top + 34, x1: x - 8, y1: 270, width: 8, color: 'shade' },
      { op: 'line', x0: x + w, y0: top + 68, x1: x + w + 8, y1: 270, width: 8, color: 'shade' },
      {
        op: 'line',
        x0: x + w * 0.68,
        y0: top - 20,
        x1: x + w * 0.72,
        y1: 270,
        width: 8,
        color: 'shade',
      },
    );
  } else if (nameHas(form, 'deck', 'platform')) {
    ops.push(
      { op: 'rect', x, y: 188, w, h: 24, r: 4, fill: 'fill', outline: 'INK.line', lineWidth: 5 },
      { op: 'line', x0: x + 18, y0: 210, x1: x + 8, y1: 270, width: 9, color: 'shade' },
      { op: 'line', x0: x + w - 18, y0: 210, x1: x + w - 8, y1: 270, width: 9, color: 'shade' },
      { op: 'line', x0: x + 8, y0: 164, x1: x + w - 8, y1: 164, width: 6, color: 'shade' },
      { op: 'line', x0: x + 16, y0: 164, x1: x + 16, y1: 208, width: 5, color: 'shade' },
      { op: 'line', x0: x + w - 16, y0: 164, x1: x + w - 16, y1: 208, width: 5, color: 'shade' },
    );
  } else if (nameHas(form, 'walk', 'colonnade')) {
    ops.push({ op: 'line', x0: x - 8, y0: top, x1: x + w + 8, y1: top, width: 18, color: 'fill' });
    for (let i = 0; i < 5; i++) {
      const px = x + (w * i) / 4;
      ops.push({
        op: 'line',
        x0: px,
        y0: top + 4,
        x1: px + (i % 2 ? 3 : -3),
        y1: 270,
        width: 8,
        color: 'shade',
      });
    }
  } else if (nameHas(form, 'nursery-frame')) {
    ops.push(
      {
        op: 'path',
        points: [
          [x, 270],
          [144, top - 42],
          [x + w, 270],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 12,
      },
      { op: 'line', x0: x + w * 0.25, y0: 270, x1: 144, y1: top - 38, width: 5, color: 'shade' },
      { op: 'line', x0: x + w * 0.75, y0: 270, x1: 144, y1: top - 38, width: 5, color: 'shade' },
      { op: 'line', x0: x + 22, y0: 204, x1: x + w - 22, y1: 204, width: 5, color: 'shade' },
    );
  } else {
    const roofStyle = seed % 3;
    const roof =
      roofStyle === 0
        ? [
            [x - 12, top + 16],
            [144, top - 38],
            [x + w + 12, top + 16],
          ]
        : roofStyle === 1
          ? [
              [x - 12, top + 10],
              [x + w * 0.3, top - 26],
              [x + w * 0.76, top - 14],
              [x + w + 12, top + 18],
            ]
          : [
              [x - 12, top + 12],
              [x + w * 0.25, top - 18],
              [x + w * 0.75, top - 18],
              [x + w + 12, top + 12],
            ];
    ops.push({
      op: 'path',
      points: roof as Array<[number, number]>,
      close: true,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    });
    for (let i = 0; i < 3; i++) {
      const px = x + 18 + (i * (w - 36)) / 2;
      ops.push({
        op: 'line',
        x0: px,
        y0: top + 8,
        x1: px + (i % 2 ? 4 : -4),
        y1: 270,
        width: 9,
        color: 'shade',
      });
    }
  }
  if (nameHas(form, 'shade-pavilion'))
    ops.push(
      {
        op: 'path',
        points: [
          [x - 26, top + 18],
          [144, top - 12],
          [x + w + 26, top + 18],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 12,
      },
      { op: 'line', x0: 144, y0: top + 8, x1: 144, y1: 270, width: 7, color: 'shade' },
    );
  else if (nameHas(form, 'vine-pavilion', 'wisteria'))
    ops.push(
      {
        op: 'path',
        points: [
          [x + 8, 154],
          [x + w * 0.32, 124],
          [x + w * 0.58, 162],
          [x + w - 8, 118],
        ],
        fill: undefined,
        outline: 'SAGE.mid',
        lineWidth: 8,
      },
      { op: 'blob', cx: x + w * 0.32, cy: 124, rx: 10, ry: 7, fill: 'SAGE.mid' },
      { op: 'blob', cx: x + w * 0.72, cy: 138, rx: 10, ry: 7, fill: 'SAGE.mid' },
    );
  else if (nameHas(form, 'rose-bower'))
    ops.push(
      {
        op: 'blob',
        cx: x + 30,
        cy: top + 46,
        rx: 10,
        ry: 10,
        fill: 'CLAY.blossom',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'blob',
        cx: x + w - 34,
        cy: top + 66,
        rx: 10,
        ry: 10,
        fill: 'CLAY.blossom',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'blob',
        cx: 144,
        cy: top - 24,
        rx: 10,
        ry: 10,
        fill: 'CLAY.blossom',
        outline: 'INK.soft',
        lineWidth: 2,
      },
    );
  else if (nameHas(form, 'orchard-arbor'))
    ops.push(
      {
        op: 'blob',
        cx: x + 44,
        cy: top + 66,
        rx: 8,
        ry: 8,
        fill: 'CLAY.mid',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'blob',
        cx: x + w - 48,
        cy: top + 54,
        rx: 8,
        ry: 8,
        fill: 'CLAY.mid',
        outline: 'INK.soft',
        lineWidth: 2,
      },
    );
  else if (nameHas(form, 'sun-gate'))
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * i) / 5;
      ops.push({
        op: 'line',
        x0: 144 + Math.cos(angle) * 14,
        y0: top + 60 + Math.sin(angle) * 14,
        x1: 144 + Math.cos(angle) * 38,
        y1: top + 60 + Math.sin(angle) * 38,
        width: 4,
        color: 'shade',
      });
    }
  else if (nameHas(form, 'moon-gate'))
    ops.push({
      op: 'blob',
      cx: 132,
      cy: top + 62,
      rx: 25,
      ry: 34,
      fill: undefined,
      outline: 'shade',
      lineWidth: 7,
    });
  else if (nameHas(form, 'terrace-canopy'))
    ops.push(
      { op: 'line', x0: x - 12, y0: 174, x1: x + w + 12, y1: 174, width: 11, color: 'fill' },
      {
        op: 'path',
        points: [
          [x + w - 30, 176],
          [x + w + 10, 198],
          [x + w - 30, 220],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 6,
      },
    );
  else if (nameHas(form, 'picnic-pavilion'))
    ops.push(
      {
        op: 'rect',
        x: x + w * 0.22,
        y: 190,
        w: w * 0.56,
        h: 18,
        r: 5,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: x + w * 0.36, y0: 208, x1: x + w * 0.3, y1: 250, width: 7, color: 'shade' },
      { op: 'line', x0: x + w * 0.64, y0: 208, x1: x + w * 0.7, y1: 250, width: 7, color: 'shade' },
    );
  else if (nameHas(form, 'rain-shelter'))
    ops.push(
      {
        op: 'line',
        x0: x - 10,
        y0: top + 24,
        x1: x + w + 12,
        y1: top + 34,
        width: 6,
        color: 'WATER.deep',
      },
      {
        op: 'line',
        x0: x + w + 10,
        y0: top + 30,
        x1: x + w + 10,
        y1: 236,
        width: 7,
        color: 'WATER.deep',
      },
    );
  else if (nameHas(form, 'viewing-deck'))
    ops.push(
      { op: 'line', x0: x + 6, y0: 166, x1: x + w - 6, y1: 166, width: 6, color: 'shade' },
      { op: 'line', x0: x + 20, y0: 166, x1: x + 20, y1: 206, width: 5, color: 'shade' },
      { op: 'line', x0: x + w - 20, y0: 166, x1: x + w - 20, y1: 206, width: 5, color: 'shade' },
    );
  else if (nameHas(form, 'pond-deck'))
    ops.push(
      { op: 'line', x0: x + 28, y0: 206, x1: x + 18, y1: 278, width: 9, color: 'shade' },
      { op: 'line', x0: x + w - 28, y0: 206, x1: x + w - 18, y1: 278, width: 9, color: 'shade' },
      {
        op: 'path',
        points: [
          [x - 10, 258],
          [144, 250],
          [x + w + 10, 258],
        ],
        fill: undefined,
        outline: 'WATER.deep',
        lineWidth: 5,
      },
    );
  else if (nameHas(form, 'tree-platform'))
    ops.push(
      { op: 'line', x0: 144, y0: 96, x1: 144, y1: 278, width: 22, color: 'shade' },
      {
        op: 'blob',
        cx: 144,
        cy: 188,
        rx: w * 0.32,
        ry: 16,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 112, y0: 190, x1: 92, y1: 244, width: 7, color: 'shade' },
      { op: 'line', x0: 176, y0: 190, x1: 196, y1: 244, width: 7, color: 'shade' },
    );
  else if (nameHas(form, 'covered-walk'))
    ops.push({
      op: 'path',
      points: [
        [x - 12, top + 4],
        [x + w * 0.7, top - 26],
        [x + w + 12, top + 6],
      ],
      fill: undefined,
      outline: 'fill',
      lineWidth: 14,
    });
  else if (nameHas(form, 'garden-colonnade'))
    for (let i = 0; i < 4; i++) {
      const px = x + (i * w) / 4;
      ops.push({
        op: 'path',
        points: [
          [px, 212],
          [px + w / 8, 166],
          [px + w / 4, 212],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 5,
      });
    }
  else if (nameHas(form, 'green-tunnel'))
    for (let i = 0; i < 5; i++) {
      ops.push({
        op: 'blob',
        cx: x + 24 + i * ((w - 48) / 4),
        cy: top + 18 + (i % 2) * 28,
        rx: 10,
        ry: 7,
        fill: 'SAGE.mid',
        outline: 'INK.soft',
        lineWidth: 2,
      });
    }
  else if (nameHas(form, 'winter-garden'))
    ops.push(
      { op: 'line', x0: x + 16, y0: 164, x1: x + w - 16, y1: 164, width: 4, color: 'shade' },
      { op: 'line', x0: 144, y0: top - 24, x1: 144, y1: 270, width: 4, color: 'shade' },
    );
  else if (nameHas(form, 'fern-house'))
    for (let i = 0; i < 3; i++) {
      ops.push({
        op: 'grass',
        x: 112 + i * 16,
        baseY: 252,
        height: 44 + i * 10,
        lean: i === 1 ? 0 : i ? 14 : -14,
        width: 5,
        color: 'SAGE.mid',
      });
    }
  void height;
  return { canvas: [288, 288], ops };
}

function communityTemplate(
  form: FormId,
  seed: number,
  width: number,
  height: number,
  detail: number,
): SpriteOpList {
  const w = Math.max(164, width);
  const x = (288 - w) / 2;
  const ops: SpriteOp[] = [];
  if (nameHas(form, 'story-circle')) {
    ops.push(
      {
        op: 'blob',
        cx: 144,
        cy: 206,
        rx: w * 0.48,
        ry: 36,
        fill: undefined,
        outline: 'fill',
        lineWidth: 14,
      },
      {
        op: 'blob',
        cx: 144,
        cy: 168,
        rx: detail,
        ry: detail,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 144, y0: 188, x1: 144, y1: 248, width: 7, color: 'shade' },
    );
  } else if (nameHas(form, 'music')) {
    ops.push(
      {
        op: 'blob',
        cx: 144,
        cy: 148,
        rx: w * 0.5,
        ry: 92,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 6,
      },
      {
        op: 'blob',
        cx: 144,
        cy: 170,
        rx: w * 0.34,
        ry: 64,
        fill: 'PAPER.floor',
        outline: 'shade',
        lineWidth: 5,
      },
      { op: 'rect', x, y: 226, w, h: 24, r: 5, fill: 'shade', outline: 'INK.line', lineWidth: 4 },
    );
  } else if (nameHas(form, 'dance-platform')) {
    ops.push(
      { op: 'rect', x, y: 208, w, h: 34, r: 5, fill: 'fill', outline: 'INK.line', lineWidth: 5 },
      { op: 'line', x0: x, y0: 96, x1: x, y1: 242, width: 8, color: 'shade' },
      { op: 'line', x0: x + w, y0: 96, x1: x + w, y1: 242, width: 8, color: 'shade' },
      {
        op: 'path',
        points: [
          [x, 100],
          [x + w * 0.25, 122],
          [144, 98],
          [x + w * 0.75, 122],
          [x + w, 100],
        ],
        fill: undefined,
        outline: 'ROBOT.accent',
        lineWidth: 5,
      },
    );
  } else if (nameHas(form, 'welcome-gate', 'trail-kiosk')) {
    ops.push(
      { op: 'line', x0: x + 18, y0: 270, x1: x + 18, y1: 70, width: 11, color: 'shade' },
      { op: 'line', x0: x + w - 18, y0: 270, x1: x + w - 18, y1: 70, width: 11, color: 'shade' },
      {
        op: 'rect',
        x: x + 24,
        y: 80,
        w: w - 48,
        h: 74,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [x + 34, 132],
          [144, 100],
          [x + w - 34, 132],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 5,
      },
    );
  } else if (nameHas(form, 'observation-hide')) {
    ops.push(
      {
        op: 'path',
        points: [
          [x, 250],
          [x + 16, 120],
          [x + w * 0.72, 92],
          [x + w, 250],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 6,
      },
      {
        op: 'rect',
        x: x + 38,
        y: 142,
        w: w - 76,
        h: 18,
        r: 5,
        fill: 'PAPER.floor',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      { op: 'line', x0: x + 28, y0: 168, x1: x + 18, y1: 250, width: 6, color: 'shade' },
      { op: 'line', x0: x + w - 28, y0: 160, x1: x + w - 18, y1: 250, width: 6, color: 'shade' },
      {
        op: 'path',
        points: [
          [x + 4, 132],
          [x + 38, 112],
          [x + 72, 126],
          [x + 108, 102],
          [x + w - 4, 124],
        ],
        fill: undefined,
        outline: 'SAGE.mid',
        lineWidth: 8,
      },
    );
  } else {
    const top = 78 + (seed % 24);
    ops.push(
      {
        op: 'path',
        points: [
          [x - 10, top + 24],
          [144, top - 42],
          [x + w + 10, top + 24],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: x + 14, y0: top + 18, x1: x + 8, y1: 270, width: 10, color: 'shade' },
      {
        op: 'line',
        x0: x + w - 14,
        y0: top + 18,
        x1: x + w - 8,
        y1: 270,
        width: 10,
        color: 'shade',
      },
      {
        op: 'rect',
        x: x + w * 0.2,
        y: 188,
        w: w * 0.6,
        h: 22,
        r: 6,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: x + w * 0.32, y0: 208, x1: x + w * 0.28, y1: 258, width: 7, color: 'fill' },
      { op: 'line', x0: x + w * 0.68, y0: 208, x1: x + w * 0.72, y1: 258, width: 7, color: 'fill' },
    );
  }
  if (nameHas(form, 'outdoor-classroom'))
    ops.push(
      {
        op: 'rect',
        x: x + 32,
        y: 128,
        w: w - 64,
        h: 48,
        r: 5,
        fill: 'PAPER.floor',
        outline: 'shade',
        lineWidth: 5,
      },
      { op: 'line', x0: x + 48, y0: 220, x1: x + w - 48, y1: 220, width: 7, color: 'fill' },
    );
  else if (nameHas(form, 'picnic-hall'))
    ops.push(
      { op: 'line', x0: x + w * 0.18, y0: 230, x1: x + w * 0.82, y1: 230, width: 9, color: 'fill' },
      {
        op: 'line',
        x0: x + w * 0.18,
        y0: 248,
        x1: x + w * 0.82,
        y1: 248,
        width: 7,
        color: 'shade',
      },
    );
  else if (nameHas(form, 'tea-pavilion'))
    ops.push(
      {
        op: 'blob',
        cx: 144,
        cy: 188,
        rx: 28,
        ry: 12,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 144, y0: 198, x1: 144, y1: 244, width: 7, color: 'shade' },
      { op: 'line', x0: 144, y0: 72, x1: 144, y1: 126, width: 5, color: 'shade' },
      {
        op: 'blob',
        cx: 144,
        cy: 132,
        rx: 10,
        ry: 14,
        fill: 'CLAY.blossom',
        outline: 'INK.soft',
        lineWidth: 3,
      },
    );
  else if (nameHas(form, 'market-shelter'))
    ops.push(
      {
        op: 'path',
        points: [
          [x + 12, 130],
          [x + w - 12, 130],
          [x + w - 28, 164],
          [x + 28, 164],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'rect',
        x: x + 18,
        y: 190,
        w: w - 36,
        h: 20,
        r: 4,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  else if (nameHas(form, 'repair-commons'))
    ops.push(
      {
        op: 'blob',
        cx: 144,
        cy: 178,
        rx: 30,
        ry: 30,
        fill: undefined,
        outline: 'shade',
        lineWidth: 8,
      },
      { op: 'line', x0: 144, y0: 148, x1: 144, y1: 208, width: 4, color: 'shade' },
      { op: 'line', x0: 114, y0: 178, x1: 174, y1: 178, width: 4, color: 'shade' },
    );
  else if (nameHas(form, 'tool-library'))
    for (let row = 0; row < 3; row++) {
      ops.push({
        op: 'line',
        x0: x + 28,
        y0: 142 + row * 32,
        x1: x + w - 28,
        y1: 142 + row * 32,
        width: 5,
        color: 'shade',
      });
    }
  else if (nameHas(form, 'seed-exchange'))
    for (let i = 0; i < 3; i++) {
      ops.push({
        op: 'rect',
        x: x + 30 + i * ((w - 80) / 3),
        y: 174,
        w: (w - 90) / 3,
        h: 34,
        r: 5,
        fill: i % 2 ? 'shade' : 'fill',
        outline: 'INK.line',
        lineWidth: 3,
      });
    }
  else if (nameHas(form, 'trail-kiosk'))
    ops.push(
      {
        op: 'rect',
        x: x + 38,
        y: 104,
        w: w - 76,
        h: 72,
        r: 5,
        fill: 'PAPER.floor',
        outline: 'shade',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [x + 48, 158],
          [144, 122],
          [x + w - 48, 146],
        ],
        fill: undefined,
        outline: 'SAGE.mid',
        lineWidth: 5,
      },
      { op: 'line', x0: 144, y0: 176, x1: 144, y1: 258, width: 7, color: 'shade' },
    );
  else if (nameHas(form, 'welcome-gate'))
    ops.push(
      {
        op: 'path',
        points: [
          [x + 8, 94],
          [144, 54],
          [x + w - 8, 94],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 12,
      },
      {
        op: 'path',
        points: [
          [144, 54],
          [184, 68],
          [144, 82],
        ],
        close: true,
        fill: 'ROBOT.accent',
        outline: 'INK.line',
        lineWidth: 3,
      },
    );
  else if (nameHas(form, 'rest-station'))
    ops.push(
      { op: 'line', x0: x + 34, y0: 206, x1: x + w - 34, y1: 206, width: 12, color: 'fill' },
      { op: 'line', x0: x + 48, y0: 210, x1: x + 42, y1: 254, width: 7, color: 'shade' },
      { op: 'line', x0: x + w - 48, y0: 210, x1: x + w - 42, y1: 254, width: 7, color: 'shade' },
    );
  void height;
  return { canvas: [288, 288], ops };
}

function bridgeTemplate(form: FormId, seed: number, width: number, detail: number): SpriteOpList {
  const w = Math.min(220, width + 32);
  const x = (288 - w) / 2;
  const y = 168 + (seed % 22);
  const ops: SpriteOp[] = [];
  if (nameHas(form, 'stepping')) {
    for (let i = 0; i < 6; i++) {
      ops.push({
        op: 'blob',
        cx: x + 16 + (i * (w - 32)) / 5,
        cy: y + (i % 2 ? -10 : 8),
        rx: 22 + ((seed >>> i) % 8),
        ry: 10 + ((seed >>> (i + 2)) % 5),
        fill: i % 2 ? 'fill' : 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      });
    }
  } else if (nameHas(form, 'rope')) {
    ops.push(
      {
        op: 'path',
        points: [
          [x, y - 30],
          [144, y + 20],
          [x + w, y - 30],
        ],
        fill: undefined,
        outline: 'INK.line',
        lineWidth: 7,
      },
      {
        op: 'path',
        points: [
          [x, y - 72],
          [144, y - 26],
          [x + w, y - 72],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 5,
      },
    );
    for (let i = 0; i < 6; i++) {
      const px = x + (i * w) / 5;
      const sag = Math.sin((Math.PI * i) / 5) * 44;
      ops.push({
        op: 'line',
        x0: px,
        y0: y - 70 + sag,
        x1: px,
        y1: y - 28 + sag,
        width: 3,
        color: 'shade',
      });
    }
  } else if (nameHas(form, 'covered')) {
    ops.push(
      { op: 'rect', x, y: y - 42, w, h: 76, r: 5, fill: 'fill', outline: 'INK.line', lineWidth: 5 },
      {
        op: 'path',
        points: [
          [x - 10, y - 38],
          [144, y - 100],
          [x + w + 10, y - 38],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: x + 14,
        y: y - 24,
        w: 30,
        h: 44,
        r: 15,
        fill: 'PAPER.floor',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      {
        op: 'rect',
        x: x + w - 44,
        y: y - 24,
        w: 30,
        h: 44,
        r: 15,
        fill: 'PAPER.floor',
        outline: 'INK.soft',
        lineWidth: 3,
      },
    );
  } else if (nameHas(form, 'boardwalk', 'jetty', 'landing-stage')) {
    ops.push(
      {
        op: 'path',
        points: [
          [x, y - 34],
          [x + w, y - 34],
          [x + w - 34, y + 34],
          [x + 34, y + 34],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: x + 28, y0: y + 22, x1: x + 18, y1: 220, width: 8, color: 'shade' },
      { op: 'line', x0: x + w - 28, y0: y + 22, x1: x + w - 18, y1: 220, width: 8, color: 'shade' },
    );
    for (let i = 1; i < 6; i++) {
      const px = x + (i * w) / 6;
      ops.push({
        op: 'line',
        x0: px,
        y0: y - 30,
        x1: 144 + (px - 144) * 0.7,
        y1: y + 28,
        width: 3,
        color: 'shade',
      });
    }
  } else if (nameHas(form, 'stair', 'ramp')) {
    const steps = nameHas(form, 'stair') ? 6 : 1;
    for (let i = 0; i < steps; i++) {
      const sx = x + (i * w) / steps;
      const sy = y + 32 - (i * 72) / steps;
      ops.push({
        op: 'rect',
        x: sx,
        y: sy,
        w: w / steps + 8,
        h: 18,
        r: 3,
        fill: i % 2 ? 'shade' : 'fill',
        outline: 'INK.line',
        lineWidth: 3,
      });
    }
    if (steps === 1)
      ops.push(
        { op: 'line', x0: x, y0: y + 40, x1: x + w, y1: y - 40, width: 18, color: 'fill' },
        { op: 'line', x0: x, y0: y + 14, x1: x + w, y1: y - 66, width: 5, color: 'shade' },
        {
          op: 'line',
          x0: x + w * 0.72,
          y0: y - 18,
          x1: x + w * 0.72,
          y1: 216,
          width: 7,
          color: 'shade',
        },
      );
  } else {
    const arch = nameHas(form, 'arch', 'causeway', 'canal');
    ops.push({
      op: 'path',
      points: arch
        ? [
            [x, y],
            [x + w * 0.25, y - 34],
            [144, y - 54],
            [x + w * 0.75, y - 34],
            [x + w, y],
            [x + w, y + 24],
            [144, y - 24],
            [x, y + 24],
          ]
        : [
            [x, y - 16],
            [x + w, y - 16],
            [x + w, y + 18],
            [x, y + 18],
          ],
      close: true,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    });
    ops.push(
      { op: 'line', x0: x + detail, y0: y + 8, x1: x + detail, y1: 216, width: 9, color: 'shade' },
      {
        op: 'line',
        x0: x + w - detail,
        y0: y + 8,
        x1: x + w - detail,
        y1: 216,
        width: 9,
        color: 'shade',
      },
      { op: 'line', x0: x + 14, y0: y - 24, x1: x + w - 14, y1: y - 24, width: 4, color: 'shade' },
    );
  }
  if (nameHas(form, 'beam-bridge'))
    ops.push(
      { op: 'line', x0: x + 18, y0: y + 16, x1: 144, y1: y - 30, width: 5, color: 'shade' },
      { op: 'line', x0: 144, y0: y - 30, x1: x + w - 18, y1: y + 16, width: 5, color: 'shade' },
    );
  else if (nameHas(form, 'ford-platform'))
    ops.push(
      {
        op: 'blob',
        cx: x + 34,
        cy: y + 30,
        rx: 18,
        ry: 8,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'blob',
        cx: 144,
        cy: y + 38,
        rx: 18,
        ry: 8,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'blob',
        cx: x + w - 34,
        cy: y + 30,
        rx: 18,
        ry: 8,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'path',
        points: [
          [x - 12, y + 50],
          [144, y + 42],
          [x + w + 12, y + 50],
        ],
        fill: undefined,
        outline: 'WATER.deep',
        lineWidth: 4,
      },
    );
  else if (nameHas(form, 'ditch-crossing'))
    ops.push(
      { op: 'line', x0: 144, y0: y - 38, x1: 144, y1: y + 52, width: 6, color: 'shade' },
      {
        op: 'line',
        x0: x + 8,
        y0: y + 38,
        x1: x + w - 8,
        y1: y + 38,
        width: 5,
        color: 'WATER.deep',
      },
    );
  else if (nameHas(form, 'causeway'))
    for (let i = 0; i < 4; i++) {
      ops.push({
        op: 'rect',
        x: x + 16 + i * ((w - 52) / 3),
        y: y + 14,
        w: 20,
        h: 38,
        r: 3,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 3,
      });
    }
  else if (nameHas(form, 'jetty'))
    ops.push(
      { op: 'line', x0: x + 4, y0: y - 48, x1: x + 4, y1: y + 54, width: 8, color: 'shade' },
      {
        op: 'line',
        x0: x + w - 4,
        y0: y - 48,
        x1: x + w - 4,
        y1: y + 54,
        width: 8,
        color: 'shade',
      },
    );
  else if (nameHas(form, 'landing-stage'))
    ops.push(
      { op: 'line', x0: x + 18, y0: y - 18, x1: x + 18, y1: y + 58, width: 7, color: 'shade' },
      {
        op: 'path',
        points: [
          [x + w - 54, y + 24],
          [x + w, y + 24],
          [x + w, y + 58],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 9,
      },
    );
  return { canvas: [288, 224], ops };
}

function towerTemplate(form: FormId, seed: number, height: number, detail: number): SpriteOpList {
  const h = Math.max(140, height);
  const y = 276 - h;
  const ops: SpriteOp[] = [];
  if (nameHas(form, 'water-tower')) {
    ops.push(
      {
        op: 'blob',
        cx: 112,
        cy: y + 42,
        rx: 58,
        ry: 42,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 78, y0: y + 74, x1: 58, y1: 276, width: 9, color: 'shade' },
      { op: 'line', x0: 146, y0: y + 74, x1: 166, y1: 276, width: 9, color: 'shade' },
      { op: 'line', x0: 66, y0: 228, x1: 158, y1: 228, width: 5, color: 'shade' },
    );
  } else if (nameHas(form, 'observatory')) {
    ops.push(
      {
        op: 'rect',
        x: 72,
        y: y + 54,
        w: 80,
        h: 222 - y,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 112,
        cy: y + 48,
        rx: 62,
        ry: 52,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 112, y0: y + 2, x1: 152, y1: y - 34, width: 12, color: 'fill' },
      {
        op: 'blob',
        cx: 154,
        cy: y - 36,
        rx: 13,
        ry: 13,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else if (nameHas(form, 'signal-mast', 'weather-station', 'wind-sculpture')) {
    ops.push(
      { op: 'line', x0: 112, y0: 278, x1: 112, y1: y - 24, width: 10, color: 'shade' },
      { op: 'line', x0: 58, y0: y + 36, x1: 166, y1: y + 36, width: 7, color: 'fill' },
      {
        op: 'path',
        points: [
          [112, y - 20],
          [164, y + 6],
          [112, y + 24],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 112,
        cy: y + 36,
        rx: 17,
        ry: 17,
        fill: 'ROBOT.accent',
        outline: 'INK.soft',
        lineWidth: 3,
      },
    );
    if (nameHas(form, 'wind-sculpture'))
      ops.push(
        {
          op: 'blob',
          cx: 66,
          cy: y + 36,
          rx: 22,
          ry: 10,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 3,
        },
        {
          op: 'blob',
          cx: 158,
          cy: y + 36,
          rx: 22,
          ry: 10,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 3,
        },
      );
  } else if (nameHas(form, 'memory-monument', 'wayfinding-spire')) {
    ops.push(
      {
        op: 'path',
        points: [
          [62, 276],
          [92, y + 52],
          [112, y - 34],
          [134, y + 52],
          [162, 276],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 112,
        cy: y + 42,
        rx: detail,
        ry: detail,
        fill: 'ROBOT.accent',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      {
        op: 'rect',
        x: 52,
        y: 256,
        w: 120,
        h: 24,
        r: 5,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else {
    ops.push(
      {
        op: 'path',
        points: [
          [76, 276],
          [90, y + 36],
          [134, y + 36],
          [150, 276],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 112,
        cy: y + 18,
        rx: 44 + (seed % 18),
        ry: 22,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
    );
    if (nameHas(form, 'clock'))
      ops.push(
        {
          op: 'rect',
          x: 68,
          y: y + 34,
          w: 88,
          h: 82,
          r: 8,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 58, y0: y + 34, x1: 166, y1: y + 34, width: 10, color: 'shade' },
        {
          op: 'blob',
          cx: 112,
          cy: y + 68,
          rx: 25,
          ry: 25,
          fill: 'PAPER.floor',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 112, y0: y + 68, x1: 112, y1: y + 50, width: 3, color: 'shade' },
        { op: 'line', x0: 112, y0: y + 68, x1: 128, y1: y + 75, width: 3, color: 'shade' },
      );
    else if (nameHas(form, 'bell'))
      ops.push(
        { op: 'line', x0: 54, y0: y + 34, x1: 170, y1: y + 34, width: 11, color: 'shade' },
        { op: 'line', x0: 76, y0: y + 38, x1: 76, y1: y + 118, width: 7, color: 'fill' },
        { op: 'line', x0: 148, y0: y + 38, x1: 148, y1: y + 118, width: 7, color: 'fill' },
        {
          op: 'blob',
          cx: 112,
          cy: y + 72,
          rx: 24,
          ry: 20,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 112, y0: y + 86, x1: 112, y1: y + 104, width: 5, color: 'shade' },
      );
    else if (nameHas(form, 'lookout'))
      ops.push(
        {
          op: 'rect',
          x: 52,
          y: y + 52,
          w: 120,
          h: 22,
          r: 5,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 58, y0: y + 18, x1: 58, y1: y + 66, width: 5, color: 'shade' },
        { op: 'line', x0: 166, y0: y + 18, x1: 166, y1: y + 66, width: 5, color: 'shade' },
        { op: 'line', x0: 58, y0: y + 20, x1: 166, y1: y + 20, width: 5, color: 'shade' },
      );
    else
      ops.push({
        op: 'line',
        x0: 112,
        y0: y,
        x1: 112 + (seed % 17) - 8,
        y1: Math.max(12, y - detail * 2),
        width: 5,
        color: 'shade',
      });
  }
  return { canvas: [224, 288], ops };
}

function datouTemplate(
  form: FormId,
  silhouette: IdentitySilhouette,
  seed: number,
  width: number,
  height: number,
  detail: number,
): SpriteOpList {
  void height;
  if (silhouette === 'pet-course') {
    const ops: SpriteOp[] = [];
    if (form === 'ramp') {
      ops.push(
        {
          op: 'path',
          points: [
            [26, 160],
            [214, 66],
            [226, 94],
            [44, 174],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 60, y0: 146, x1: 198, y1: 78, width: 4, color: 'shade' },
        { op: 'line', x0: 174, y0: 78, x1: 174, y1: 38, width: 6, color: 'shade' },
        { op: 'line', x0: 206, y0: 68, x1: 206, y1: 112, width: 6, color: 'shade' },
      );
    } else if (form === 'tunnel') {
      ops.push(
        {
          op: 'rect',
          x: 30,
          y: 56,
          w: 196,
          h: 104,
          r: 50,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 30,
          cy: 108,
          rx: 34,
          ry: 52,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 226,
          cy: 108,
          rx: 34,
          ry: 52,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 5,
        },
        { op: 'line', x0: 82, y0: 62, x1: 82, y1: 154, width: 4, color: 'shade' },
        { op: 'line', x0: 174, y0: 62, x1: 174, y1: 154, width: 4, color: 'shade' },
      );
    } else if (nameHas(form, 'scent-gate', 'choice-gate')) {
      ops.push(
        { op: 'line', x0: 50, y0: 166, x1: 50, y1: 44, width: 11, color: 'shade' },
        { op: 'line', x0: 206, y0: 166, x1: 206, y1: 44, width: 11, color: 'shade' },
        { op: 'line', x0: 48, y0: 48, x1: 208, y1: 48, width: 10, color: 'fill' },
        {
          op: 'path',
          points: [
            [128, 48],
            [128, 112],
            [92, 152],
          ],
          fill: undefined,
          outline: 'fill',
          lineWidth: 8,
        },
        {
          op: 'path',
          points: [
            [128, 112],
            [166, 152],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 8,
        },
      );
      if (nameHas(form, 'scent'))
        ops.push({
          op: 'blob',
          cx: 92,
          cy: 92,
          rx: 12,
          ry: 18,
          fill: 'SAGE.mid',
          outline: 'INK.soft',
          lineWidth: 2,
        });
    } else if (nameHas(form, 'texture-path', 'memory-route')) {
      for (let i = 0; i < 5; i++)
        ops.push({
          op: 'rect',
          x: 18 + i * 46,
          y: 126 - (i % 2) * 18,
          w: 40,
          h: 32,
          r: i % 2 ? 12 : 4,
          fill: i % 2 ? 'shade' : 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        });
      if (nameHas(form, 'memory'))
        ops.push({
          op: 'path',
          points: [
            [38, 112],
            [84, 78],
            [130, 112],
            [176, 78],
            [222, 112],
          ],
          fill: undefined,
          outline: 'ROBOT.accent',
          lineWidth: 4,
        });
    } else if (nameHas(form, 'sound-post')) {
      ops.push(
        { op: 'line', x0: 104, y0: 166, x1: 104, y1: 58, width: 12, color: 'shade' },
        {
          op: 'path',
          points: [
            [92, 54],
            [130, 42],
            [130, 82],
            [92, 70],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 68, y0: 166, x1: 142, y1: 166, width: 9, color: 'fill' },
        {
          op: 'path',
          points: [
            [146, 52],
            [170, 42],
            [170, 68],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [150, 82],
            [182, 70],
            [182, 96],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 4,
        },
      );
    } else if (nameHas(form, 'light-marker')) {
      ops.push(
        { op: 'line', x0: 128, y0: 166, x1: 128, y1: 88, width: 12, color: 'shade' },
        {
          op: 'path',
          points: [
            [128, 34],
            [164, 72],
            [128, 108],
            [92, 72],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 128,
          cy: 72,
          rx: 13,
          ry: 13,
          fill: 'ROBOT.accent',
          outline: 'INK.soft',
          lineWidth: 3,
        },
        { op: 'line', x0: 88, y0: 166, x1: 168, y1: 166, width: 9, color: 'fill' },
      );
    } else if (nameHas(form, 'trail-beacon')) {
      ops.push(
        { op: 'line', x0: 116, y0: 164, x1: 116, y1: 42, width: 10, color: 'shade' },
        {
          op: 'path',
          points: [
            [120, 52],
            [192, 72],
            [120, 98],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 116, y0: 132, x1: 72, y1: 170, width: 8, color: 'shade' },
        { op: 'line', x0: 116, y0: 132, x1: 162, y1: 170, width: 8, color: 'shade' },
        { op: 'blob', cx: 116, cy: 42, rx: 9, ry: 9, fill: 'ROBOT.accent' },
      );
    } else if (nameHas(form, 'sniffing-wall')) {
      ops.push(
        {
          op: 'rect',
          x: 38,
          y: 42,
          w: 180,
          h: 118,
          r: 9,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 82,
          cy: 86,
          rx: 14,
          ry: 14,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        {
          op: 'blob',
          cx: 132,
          cy: 116,
          rx: 14,
          ry: 14,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        {
          op: 'blob',
          cx: 182,
          cy: 78,
          rx: 14,
          ry: 14,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        { op: 'line', x0: 58, y0: 160, x1: 52, y1: 176, width: 8, color: 'shade' },
        { op: 'line', x0: 198, y0: 160, x1: 204, y1: 176, width: 8, color: 'shade' },
      );
    } else if (nameHas(form, 'lookout-step', 'discovery-dock')) {
      ops.push(
        {
          op: 'rect',
          x: 30,
          y: 132,
          w: 196,
          h: 26,
          r: 5,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'rect',
          x: 70,
          y: 94,
          w: 156,
          h: 26,
          r: 5,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        {
          op: 'rect',
          x: 116,
          y: 56,
          w: 110,
          h: 26,
          r: 5,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 212, y0: 54, x1: 212, y1: 136, width: 6, color: 'shade' },
      );
    } else {
      ops.push(
        {
          op: 'path',
          points: [
            [24, 164],
            [84, 112],
            [132, 148],
            [220, 72],
            [232, 164],
          ],
          fill: undefined,
          outline: 'fill',
          lineWidth: 14,
        },
        {
          op: 'blob',
          cx: 132,
          cy: 148,
          rx: detail,
          ry: detail / 2,
          fill: 'ROBOT.accent',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        { op: 'line', x0: 42, y0: 150, x1: 42, y1: 92, width: 6, color: 'shade' },
      );
    }
    return {
      canvas: [256, 180],
      ops,
    };
  }
  if (silhouette === 'pet-rest') {
    const ops: SpriteOp[] = [];
    if (nameHas(form, 'chin-rest')) {
      ops.push(
        {
          op: 'blob',
          cx: 112,
          cy: 104,
          rx: 62,
          ry: 26,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [58, 104],
            [78, 70],
            [146, 70],
            [166, 104],
          ],
          close: true,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 76, y0: 126, x1: 68, y1: 166, width: 8, color: 'shade' },
        { op: 'line', x0: 148, y0: 126, x1: 156, y1: 166, width: 8, color: 'shade' },
      );
    } else if (nameHas(form, 'window-nook', 'rain-nook')) {
      ops.push(
        {
          op: 'path',
          points: [
            [38, 166],
            [38, 56],
            [112, 24],
            [186, 56],
            [186, 166],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 112,
          cy: 132,
          rx: 54,
          ry: 24,
          fill: 'shade',
          outline: 'INK.soft',
          lineWidth: 3,
        },
        {
          op: 'rect',
          x: 70,
          y: 58,
          w: 84,
          h: 46,
          r: 5,
          fill: 'WATER.edge',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 112, y0: 60, x1: 112, y1: 100, width: 3, color: 'shade' },
      );
    } else if (nameHas(form, 'charging-nest')) {
      ops.push(
        {
          op: 'blob',
          cx: 112,
          cy: 130,
          rx: 82,
          ry: 42,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 112,
          cy: 124,
          rx: 56,
          ry: 26,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        { op: 'line', x0: 174, y0: 118, x1: 202, y1: 86, width: 8, color: 'shade' },
        { op: 'blob', cx: 204, cy: 82, rx: 8, ry: 8, fill: 'ROBOT.accent' },
      );
    } else if (nameHas(form, 'travel-bed')) {
      ops.push(
        {
          op: 'rect',
          x: 42,
          y: 112,
          w: 140,
          h: 48,
          r: 12,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [54, 112],
            [54, 76],
            [170, 76],
            [170, 112],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 8,
        },
        { op: 'line', x0: 68, y0: 160, x1: 68, y1: 174, width: 7, color: 'shade' },
        { op: 'line', x0: 156, y0: 160, x1: 156, y1: 174, width: 7, color: 'shade' },
      );
    } else if (nameHas(form, 'quiet-cradle')) {
      ops.push(
        {
          op: 'path',
          points: [
            [38, 104],
            [62, 154],
            [162, 154],
            [186, 104],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [48, 162],
            [112, 176],
            [176, 162],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 8,
        },
        {
          op: 'blob',
          cx: 112,
          cy: 126,
          rx: 48,
          ry: 20,
          fill: 'shade',
          outline: 'INK.soft',
          lineWidth: 3,
        },
      );
    } else {
      ops.push(
        {
          op: 'blob',
          cx: 112,
          cy: 132,
          rx: Math.min(90, width / 2),
          ry: 36,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 112,
          cy: 126,
          rx: 58,
          ry: 22,
          fill: nameHas(form, 'cooling') ? 'WATER.edge' : 'shade',
          outline: 'INK.soft',
          lineWidth: 3,
        },
        { op: 'line', x0: 54, y0: 140, x1: 170, y1: 140, width: 4, color: 'shade' },
        {
          op: 'blob',
          cx: 112,
          cy: 126,
          rx: 6,
          ry: 6,
          fill: nameHas(form, 'warming', 'sun-patch') ? 'ROBOT.accent' : 'PAPER.floor',
        },
      );
    }
    return { canvas: [224, 180], ops };
  }
  if (silhouette === 'pet-play') {
    const ops: SpriteOp[] = [];
    if (form === 'ball-run') {
      ops.push(
        {
          op: 'path',
          points: [
            [32, 54],
            [194, 54],
            [74, 112],
            [202, 112],
            [52, 166],
          ],
          fill: undefined,
          outline: 'fill',
          lineWidth: 14,
        },
        {
          op: 'blob',
          cx: 54,
          cy: 46,
          rx: 14,
          ry: 14,
          fill: 'ROBOT.accent',
          outline: 'INK.line',
          lineWidth: 3,
        },
        { op: 'blob', cx: 88, cy: 104, rx: 10, ry: 10, fill: 'shade' },
        { op: 'line', x0: 42, y0: 166, x1: 42, y1: 176, width: 7, color: 'shade' },
        { op: 'line', x0: 198, y0: 112, x1: 208, y1: 176, width: 7, color: 'shade' },
      );
    } else if (nameHas(form, 'rolling-drum', 'spin-wheel')) {
      ops.push(
        {
          op: 'blob',
          cx: 112,
          cy: 104,
          rx: 58,
          ry: 58,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 112,
          cy: 104,
          rx: 15,
          ry: 15,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        { op: 'line', x0: 112, y0: 46, x1: 112, y1: 162, width: 5, color: 'shade' },
        { op: 'line', x0: 54, y0: 104, x1: 170, y1: 104, width: 5, color: 'shade' },
      );
    } else if (nameHas(form, 'wobble-board', 'balance-beam')) {
      ops.push(
        {
          op: 'line',
          x0: 34,
          y0: 104,
          x1: 190,
          y1: nameHas(form, 'wobble') ? 86 : 104,
          width: 18,
          color: 'fill',
        },
        {
          op: 'blob',
          cx: 112,
          cy: 132,
          rx: nameHas(form, 'wobble') ? 28 : 14,
          ry: 18,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 72, y0: 112, x1: 64, y1: 156, width: 7, color: 'shade' },
        { op: 'line', x0: 152, y0: 104, x1: 160, y1: 156, width: 7, color: 'shade' },
      );
    } else if (nameHas(form, 'weave-poles')) {
      for (let i = 0; i < 5; i++)
        ops.push({
          op: 'line',
          x0: 42 + i * 35,
          y0: 166,
          x1: 42 + i * 35,
          y1: 54 + (i % 2) * 18,
          width: 8,
          color: i % 2 ? 'shade' : 'fill',
        });
    } else if (nameHas(form, 'jump-hoop')) {
      ops.push(
        {
          op: 'blob',
          cx: 112,
          cy: 96,
          rx: 58,
          ry: 68,
          fill: undefined,
          outline: 'fill',
          lineWidth: 12,
        },
        { op: 'line', x0: 54, y0: 126, x1: 42, y1: 170, width: 8, color: 'shade' },
        { op: 'line', x0: 170, y0: 126, x1: 182, y1: 170, width: 8, color: 'shade' },
      );
    } else if (nameHas(form, 'crawl-tube')) {
      ops.push(
        {
          op: 'rect',
          x: 34,
          y: 70,
          w: 156,
          h: 84,
          r: 40,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 34,
          cy: 112,
          rx: 30,
          ry: 42,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 190,
          cy: 112,
          rx: 30,
          ry: 42,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 5,
        },
        { op: 'line', x0: 76, y0: 76, x1: 76, y1: 148, width: 4, color: 'shade' },
      );
    } else if (nameHas(form, 'fetch-launcher')) {
      ops.push(
        {
          op: 'path',
          points: [
            [56, 144],
            [104, 58],
            [150, 76],
            [104, 158],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 132, y0: 70, x1: 190, y1: 44, width: 12, color: 'shade' },
        {
          op: 'blob',
          cx: 202,
          cy: 38,
          rx: 14,
          ry: 14,
          fill: 'ROBOT.accent',
          outline: 'INK.line',
          lineWidth: 3,
        },
        { op: 'line', x0: 72, y0: 154, x1: 58, y1: 174, width: 8, color: 'shade' },
      );
    } else if (nameHas(form, 'tug-post', 'bell-target', 'nose-target')) {
      ops.push(
        { op: 'line', x0: 112, y0: 166, x1: 112, y1: 48, width: 12, color: 'shade' },
        { op: 'line', x0: 72, y0: 166, x1: 152, y1: 166, width: 10, color: 'fill' },
        {
          op: 'blob',
          cx: 112,
          cy: 58,
          rx: 28,
          ry: 22,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 112, y0: 78, x1: 156, y1: 112, width: 7, color: 'shade' },
      );
    } else {
      ops.push(
        {
          op: 'rect',
          x: 50,
          y: 72,
          w: 124,
          h: 88,
          r: 12,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 112,
          cy: 112,
          rx: 24,
          ry: 24,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        {
          op: 'blob',
          cx: 112 + (seed % 27) - 13,
          cy: 104,
          rx: detail / 2,
          ry: detail / 2,
          fill: 'ROBOT.accent',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        { op: 'line', x0: 64, y0: 148, x1: 160, y1: 148, width: 5, color: 'shade' },
      );
    }
    return { canvas: [224, 180], ops };
  }
  if (silhouette === 'pet-care') {
    const ops: SpriteOp[] = [];
    if (nameHas(form, 'paw-wash')) {
      ops.push(
        {
          op: 'blob',
          cx: 112,
          cy: 134,
          rx: 68,
          ry: 28,
          fill: 'WATER.edge',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 168, y0: 130, x1: 168, y1: 58, width: 9, color: 'shade' },
        {
          op: 'path',
          points: [
            [168, 62],
            [196, 62],
            [196, 84],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 8,
        },
        {
          op: 'blob',
          cx: 112,
          cy: 130,
          rx: 24,
          ry: 16,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 3,
        },
      );
    } else if (nameHas(form, 'inspection-ramp')) {
      ops.push(
        {
          op: 'path',
          points: [
            [30, 158],
            [190, 72],
            [206, 104],
            [48, 170],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 68, y0: 142, x1: 184, y1: 82, width: 4, color: 'shade' },
        { op: 'line', x0: 168, y0: 84, x1: 168, y1: 42, width: 6, color: 'shade' },
      );
    } else if (nameHas(form, 'grooming-stand')) {
      ops.push(
        {
          op: 'path',
          points: [
            [54, 166],
            [54, 72],
            [112, 42],
            [170, 72],
            [170, 166],
          ],
          fill: undefined,
          outline: 'fill',
          lineWidth: 12,
        },
        { op: 'line', x0: 72, y0: 166, x1: 152, y1: 166, width: 10, color: 'shade' },
        { op: 'line', x0: 164, y0: 82, x1: 190, y1: 104, width: 6, color: 'shade' },
        {
          op: 'rect',
          x: 178,
          y: 100,
          w: 20,
          h: 48,
          r: 7,
          fill: 'ROBOT.accent',
          outline: 'INK.line',
          lineWidth: 3,
        },
      );
    } else if (nameHas(form, 'drying-station')) {
      ops.push(
        {
          op: 'path',
          points: [
            [46, 162],
            [46, 72],
            [76, 44],
            [148, 44],
            [178, 72],
            [178, 162],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 78,
          cy: 100,
          rx: 22,
          ry: 22,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        {
          op: 'blob',
          cx: 146,
          cy: 100,
          rx: 22,
          ry: 22,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        { op: 'line', x0: 66, y0: 100, x1: 90, y1: 100, width: 4, color: 'ROBOT.accent' },
        { op: 'line', x0: 146, y0: 88, x1: 146, y1: 112, width: 4, color: 'ROBOT.accent' },
      );
    } else if (nameHas(form, 'towel-warmer')) {
      ops.push(
        {
          op: 'rect',
          x: 62,
          y: 36,
          w: 100,
          h: 132,
          r: 12,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 78, y0: 70, x1: 146, y1: 70, width: 7, color: 'shade' },
        { op: 'line', x0: 78, y0: 100, x1: 146, y1: 100, width: 7, color: 'shade' },
        { op: 'line', x0: 78, y0: 130, x1: 146, y1: 130, width: 7, color: 'shade' },
        { op: 'blob', cx: 146, cy: 148, rx: 7, ry: 7, fill: 'ROBOT.accent' },
      );
    } else if (nameHas(form, 'visor-cleaner')) {
      ops.push(
        {
          op: 'blob',
          cx: 112,
          cy: 102,
          rx: 58,
          ry: 48,
          fill: 'WATER.edge',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 112,
          cy: 102,
          rx: 36,
          ry: 27,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        { op: 'line', x0: 82, y0: 126, x1: 150, y1: 74, width: 8, color: 'ROBOT.accent' },
        { op: 'line', x0: 112, y0: 150, x1: 112, y1: 174, width: 10, color: 'shade' },
        { op: 'line', x0: 70, y0: 174, x1: 154, y1: 174, width: 8, color: 'fill' },
      );
    } else if (nameHas(form, 'brush-rack', 'gear-stand')) {
      ops.push(
        { op: 'line', x0: 52, y0: 58, x1: 52, y1: 168, width: 10, color: 'shade' },
        { op: 'line', x0: 172, y0: 58, x1: 172, y1: 168, width: 10, color: 'shade' },
        { op: 'line', x0: 48, y0: 70, x1: 176, y1: 70, width: 10, color: 'fill' },
        { op: 'line', x0: 78, y0: 70, x1: 78, y1: 126, width: 6, color: 'shade' },
        { op: 'line', x0: 112, y0: 70, x1: 112, y1: 142, width: 6, color: 'shade' },
        { op: 'line', x0: 146, y0: 70, x1: 146, y1: 118, width: 6, color: 'shade' },
      );
    } else if (nameHas(form, 'water-dispenser', 'snack-drawer')) {
      ops.push(
        {
          op: 'rect',
          x: 58,
          y: 42,
          w: 108,
          h: 118,
          r: 10,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'rect',
          x: 72,
          y: 58,
          w: 80,
          h: 42,
          r: 6,
          fill: nameHas(form, 'water') ? 'WATER.edge' : 'shade',
          outline: 'INK.soft',
          lineWidth: 3,
        },
        { op: 'line', x0: 112, y0: 100, x1: 112, y1: 132, width: 8, color: 'shade' },
        {
          op: 'blob',
          cx: 112,
          cy: 146,
          rx: 38,
          ry: 12,
          fill: 'PAPER.floor',
          outline: 'INK.line',
          lineWidth: 4,
        },
      );
    } else {
      ops.push(
        {
          op: 'rect',
          x: 54,
          y: 54,
          w: 116,
          h: 102,
          r: 12,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [70, 116],
            [112, 82],
            [154, 116],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 8,
        },
        { op: 'line', x0: 112, y0: 156, x1: 112, y1: 176, width: 10, color: 'shade' },
        { op: 'line', x0: 72, y0: 176, x1: 152, y1: 176, width: 8, color: 'fill' },
      );
    }
    return { canvas: [224, 180], ops };
  }
  return { canvas: [224, 180], ops: [] };
}

function keepsakeTemplate(
  form: FormId,
  silhouette: IdentitySilhouette,
  seed: number,
  width: number,
  height: number,
  detail: number,
): SpriteOpList {
  const cx = 96 + (seed % 19) - 9;
  const cy = 102;
  if (nameHas(form, 'memory-album', 'pressed-leaf-book', 'shared-journal')) {
    return {
      canvas: [192, 224],
      ops: [
        {
          op: 'path',
          points: [
            [38, 54],
            [92, 44],
            [96, 172],
            [42, 184],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [96, 44],
            [154, 54],
            [150, 184],
            [96, 172],
          ],
          close: true,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 96, y0: 48, x1: 96, y1: 174, width: 5, color: 'INK.soft' },
        {
          op: 'path',
          points: [
            [58, 90],
            [76, 76],
            [86, 104],
            [66, 118],
          ],
          close: true,
          fill: 'SAGE.mid',
          outline: 'INK.soft',
          lineWidth: 2,
        },
      ],
    };
  }
  if (nameHas(form, 'shadow-box', 'memory-diorama', 'ticket-frame')) {
    return {
      canvas: [192, 224],
      ops: [
        {
          op: 'rect',
          x: 30,
          y: 40,
          w: 132,
          h: 132,
          r: 8,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'rect',
          x: 48,
          y: 58,
          w: 96,
          h: 92,
          r: 5,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        {
          op: 'path',
          points: [
            [54, 138],
            [82, 102],
            [102, 120],
            [132, 82],
            [140, 140],
          ],
          close: true,
          fill: 'SAGE.mid',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        {
          op: 'blob',
          cx: 112,
          cy: 92,
          rx: 10,
          ry: 10,
          fill: 'ROBOT.accent',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        { op: 'line', x0: 96, y0: 172, x1: 96, y1: 214, width: 8, color: 'shade' },
      ],
    };
  }
  if (nameHas(form, 'postcard-carousel')) {
    const ops: SpriteOp[] = [
      { op: 'line', x0: 96, y0: 30, x1: 96, y1: 210, width: 8, color: 'shade' },
      {
        op: 'blob',
        cx: 96,
        cy: 78,
        rx: 58,
        ry: 16,
        fill: undefined,
        outline: 'fill',
        lineWidth: 7,
      },
      {
        op: 'blob',
        cx: 96,
        cy: 136,
        rx: 46,
        ry: 14,
        fill: undefined,
        outline: 'shade',
        lineWidth: 6,
      },
    ];
    for (const [x, y] of [
      [48, 74],
      [140, 72],
      [62, 132],
      [126, 138],
    ] as const)
      ops.push({
        op: 'rect',
        x,
        y,
        w: 34,
        h: 24,
        r: 3,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 3,
      });
    return { canvas: [192, 224], ops };
  }
  if (nameHas(form, 'photo-cube')) {
    return {
      canvas: [192, 224],
      ops: [
        {
          op: 'path',
          points: [
            [48, 76],
            [96, 48],
            [144, 76],
            [144, 138],
            [96, 166],
            [48, 138],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [48, 76],
            [96, 102],
            [144, 76],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 4,
        },
        { op: 'line', x0: 96, y0: 102, x1: 96, y1: 164, width: 4, color: 'shade' },
        {
          op: 'rect',
          x: 62,
          y: 92,
          w: 24,
          h: 32,
          r: 3,
          fill: 'WATER.edge',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        {
          op: 'rect',
          x: 106,
          y: 92,
          w: 24,
          h: 32,
          r: 3,
          fill: 'WATER.edge',
          outline: 'INK.soft',
          lineWidth: 2,
        },
      ],
    };
  }
  if (nameHas(form, 'story-scroll', 'route-map')) {
    return {
      canvas: [192, 224],
      ops: [
        { op: 'line', x0: 36, y0: 44, x1: 156, y1: 44, width: 10, color: 'shade' },
        {
          op: 'path',
          points: [
            [48, 48],
            [144, 48],
            [150, 166],
            [96, 154],
            [42, 170],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [58, 132],
            [82, 92],
            [108, 112],
            [136, 74],
          ],
          fill: undefined,
          outline: 'SAGE.mid',
          lineWidth: 5,
        },
        { op: 'blob', cx: 136, cy: 74, rx: 7, ry: 7, fill: 'ROBOT.accent' },
      ],
    };
  }
  if (nameHas(form, 'pawprint-plaque', 'date-marker', 'milestone-board')) {
    const ops: SpriteOp[] = [
      {
        op: 'rect',
        x: 38,
        y: 42,
        w: 116,
        h: 120,
        r: 12,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 96, y0: 162, x1: 96, y1: 214, width: 8, color: 'shade' },
    ];
    if (nameHas(form, 'pawprint'))
      ops.push(
        { op: 'blob', cx: 96, cy: 112, rx: 24, ry: 20, fill: 'shade' },
        { op: 'blob', cx: 68, cy: 78, rx: 10, ry: 13, fill: 'shade' },
        { op: 'blob', cx: 94, cy: 70, rx: 10, ry: 13, fill: 'shade' },
        { op: 'blob', cx: 120, cy: 78, rx: 10, ry: 13, fill: 'shade' },
      );
    else
      for (let i = 0; i < 3; i++)
        ops.push({
          op: 'line',
          x0: 58,
          y0: 76 + i * 28,
          x1: 134,
          y1: 76 + i * 28,
          width: 5,
          color: i === 1 ? 'ROBOT.accent' : 'shade',
        });
    return { canvas: [192, 224], ops };
  }
  if (nameHas(form, 'memory-jar', 'memory-lantern', 'specimen-dome')) {
    return {
      canvas: [192, 224],
      ops: [
        {
          op: 'blob',
          cx: 96,
          cy: 114,
          rx: 54,
          ry: 68,
          fill: 'WATER.edge',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'rect',
          x: 54,
          y: 42,
          w: 84,
          h: 18,
          r: 5,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        {
          op: 'blob',
          cx: 96,
          cy: 122,
          rx: 22,
          ry: 18,
          fill: 'fill',
          outline: 'INK.soft',
          lineWidth: 3,
        },
        { op: 'blob', cx: 96, cy: 116, rx: 6, ry: 6, fill: 'ROBOT.accent' },
        {
          op: 'rect',
          x: 44,
          y: 180,
          w: 104,
          h: 18,
          r: 5,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
      ],
    };
  }
  if (silhouette === 'sound') {
    const ops: SpriteOp[] = [];
    if (nameHas(form, 'thumb-piano', 'reed-organ')) {
      ops.push({
        op: 'rect',
        x: 36,
        y: 70,
        w: 120,
        h: 104,
        r: 10,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      });
      const count = nameHas(form, 'thumb') ? 7 : 5;
      for (let i = 0; i < count; i++)
        ops.push({
          op: 'line',
          x0: 58 + i * (76 / (count - 1)),
          y0: 82,
          x1: 58 + i * (76 / (count - 1)),
          y1: 132 + (i % 2) * 20,
          width: 5,
          color: i % 2 ? 'shade' : 'fill',
        });
    } else if (nameHas(form, 'rain-stick')) {
      ops.push(
        { op: 'line', x0: 62, y0: 184, x1: 130, y1: 42, width: 24, color: 'fill' },
        {
          op: 'blob',
          cx: 132,
          cy: 40,
          rx: 20,
          ry: 10,
          fill: 'PAPER.floor',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 76, y0: 150, x1: 118, y1: 66, width: 4, color: 'shade' },
        { op: 'blob', cx: 88, cy: 126, rx: 5, ry: 5, fill: 'ROBOT.accent' },
        { op: 'blob', cx: 104, cy: 96, rx: 5, ry: 5, fill: 'ROBOT.accent' },
      );
    } else if (nameHas(form, 'whistle-post')) {
      ops.push(
        { op: 'line', x0: 96, y0: 198, x1: 96, y1: 96, width: 11, color: 'shade' },
        {
          op: 'path',
          points: [
            [58, 72],
            [126, 72],
            [148, 54],
            [148, 92],
            [126, 82],
            [58, 82],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 82,
          cy: 77,
          rx: 7,
          ry: 7,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 2,
        },
        { op: 'line', x0: 62, y0: 198, x1: 130, y1: 198, width: 9, color: 'fill' },
      );
    } else if (nameHas(form, 'echo-tube')) {
      ops.push(
        {
          op: 'path',
          points: [
            [42, 150],
            [62, 64],
            [126, 52],
            [148, 76],
            [84, 94],
            [70, 162],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 137,
          cy: 64,
          rx: 25,
          ry: 15,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        { op: 'line', x0: 56, y0: 158, x1: 132, y1: 190, width: 9, color: 'shade' },
      );
    } else if (nameHas(form, 'tone-stones')) {
      for (let i = 0; i < 4; i++)
        ops.push({
          op: 'blob',
          cx: 48 + i * 32,
          cy: 138 - i * 18,
          rx: 24 - i * 2,
          ry: 14,
          fill: i % 2 ? 'shade' : 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        });
    } else if (nameHas(form, 'bell-tree')) {
      ops.push({ op: 'line', x0: 96, y0: 202, x1: 96, y1: 46, width: 9, color: 'shade' });
      for (const [x, y] of [
        [56, 88],
        [136, 76],
        [70, 138],
        [126, 146],
      ] as const)
        ops.push(
          { op: 'line', x0: 96, y0: y - 10, x1: x, y1: y - 10, width: 5, color: 'fill' },
          {
            op: 'blob',
            cx: x,
            cy: y,
            rx: 13,
            ry: 16,
            fill: 'fill',
            outline: 'INK.line',
            lineWidth: 3,
          },
        );
    } else if (nameHas(form, 'drum-box')) {
      ops.push(
        {
          op: 'rect',
          x: 42,
          y: 66,
          w: 108,
          h: 112,
          r: 10,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 96,
          cy: 122,
          rx: 30,
          ry: 30,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 6,
        },
        { op: 'line', x0: 58, y0: 78, x1: 134, y1: 166, width: 4, color: 'shade' },
      );
    } else {
      ops.push(
        {
          op: 'rect',
          x: 38,
          y: 58,
          w: 116,
          h: 118,
          r: 12,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 96,
          cy: 112,
          rx: 42,
          ry: 42,
          fill: 'shade',
          outline: 'INK.soft',
          lineWidth: 3,
        },
        { op: 'line', x0: 96, y0: 112, x1: 132, y1: 78, width: 5, color: 'ROBOT.accent' },
        { op: 'blob', cx: 96, cy: 112, rx: 7, ry: 7, fill: 'PAPER.floor' },
      );
    }
    return { canvas: [192, 224], ops };
  }
  if (silhouette === 'display') {
    const ops: SpriteOp[] = [
      { op: 'line', x0: 96, y0: 210, x1: 96, y1: 126, width: 8, color: 'shade' },
      {
        op: 'rect',
        x: 42,
        y: 190,
        w: 108,
        h: 20,
        r: 5,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    ];
    if (nameHas(form, 'shell-stand'))
      ops.push({
        op: 'path',
        points: [
          [54, 126],
          [72, 76],
          [96, 112],
          [120, 72],
          [140, 126],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 13,
      });
    else if (nameHas(form, 'stone-pedestal'))
      ops.push(
        {
          op: 'path',
          points: [
            [54, 146],
            [66, 84],
            [126, 84],
            [138, 146],
          ],
          close: true,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 96,
          cy: 64,
          rx: 34,
          ry: 25,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 70, y0: 112, x1: 122, y1: 112, width: 4, color: 'INK.soft' },
      );
    else if (nameHas(form, 'keepsake-tree'))
      ops.push(
        {
          op: 'path',
          points: [
            [96, 150],
            [96, 58],
            [62, 84],
            [96, 70],
            [132, 88],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 9,
        },
        { op: 'line', x0: 62, y0: 84, x1: 48, y1: 64, width: 6, color: 'shade' },
        { op: 'line', x0: 132, y0: 88, x1: 146, y1: 66, width: 6, color: 'shade' },
        {
          op: 'blob',
          cx: 48,
          cy: 58,
          rx: 10,
          ry: 12,
          fill: 'CLAY.blossom',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        {
          op: 'blob',
          cx: 148,
          cy: 60,
          rx: 10,
          ry: 12,
          fill: 'SAGE.mid',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        {
          op: 'blob',
          cx: 96,
          cy: 48,
          rx: 10,
          ry: 12,
          fill: 'ROBOT.accent',
          outline: 'INK.soft',
          lineWidth: 2,
        },
      );
    else if (nameHas(form, 'feather-stand'))
      ops.push(
        {
          op: 'path',
          points: [
            [96, 130],
            [66, 56],
            [92, 34],
            [116, 66],
            [96, 130],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 94, y0: 120, x1: 88, y1: 50, width: 4, color: 'shade' },
      );
    else if (nameHas(form, 'flower-press'))
      ops.push(
        {
          op: 'rect',
          x: 46,
          y: 64,
          w: 100,
          h: 86,
          r: 5,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 58, y0: 54, x1: 58, y1: 160, width: 8, color: 'shade' },
        { op: 'line', x0: 134, y0: 54, x1: 134, y1: 160, width: 8, color: 'shade' },
        { op: 'blob', cx: 96, cy: 108, rx: 18, ry: 12, fill: 'CLAY.blossom' },
      );
    else if (nameHas(form, 'curio-cabinet', 'trophy-shelf'))
      ops.push(
        {
          op: 'rect',
          x: 36,
          y: 42,
          w: 120,
          h: 130,
          r: 7,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 46, y0: 88, x1: 146, y1: 88, width: 5, color: 'shade' },
        { op: 'line', x0: 46, y0: 132, x1: 146, y1: 132, width: 5, color: 'shade' },
      );
    else if (nameHas(form, 'miniature-stage'))
      ops.push(
        {
          op: 'path',
          points: [
            [32, 158],
            [44, 64],
            [148, 64],
            [160, 158],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 96,
          cy: 82,
          rx: 40,
          ry: 28,
          fill: 'PAPER.floor',
          outline: 'shade',
          lineWidth: 4,
        },
        {
          op: 'rect',
          x: 46,
          y: 148,
          w: 100,
          h: 24,
          r: 4,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
      );
    else if (nameHas(form, 'discovery-mobile'))
      ops.push(
        { op: 'line', x0: 44, y0: 64, x1: 148, y1: 64, width: 7, color: 'fill' },
        { op: 'line', x0: 66, y0: 64, x1: 58, y1: 122, width: 4, color: 'shade' },
        { op: 'line', x0: 126, y0: 64, x1: 136, y1: 110, width: 4, color: 'shade' },
        { op: 'blob', cx: 58, cy: 128, rx: 12, ry: 12, fill: 'CLAY.blossom' },
        { op: 'blob', cx: 136, cy: 116, rx: 12, ry: 12, fill: 'SAGE.mid' },
      );
    else
      ops.push(
        {
          op: 'path',
          points: [
            [96, 142],
            [60, 104],
            [74, 70],
            [96, 88],
            [118, 58],
            [136, 104],
          ],
          fill: undefined,
          outline: 'fill',
          lineWidth: 10,
        },
        { op: 'blob', cx: 96, cy: 74, rx: 8, ry: 8, fill: 'ROBOT.accent' },
      );
    return { canvas: [192, 224], ops };
  }
  if (silhouette === 'seasonal') {
    const ops: SpriteOp[] = [];
    if (nameHas(form, 'summer-fan')) {
      ops.push(
        {
          op: 'path',
          points: [
            [96, 120],
            [32, 84],
            [48, 42],
            [96, 28],
            [144, 42],
            [160, 84],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 96, y0: 114, x1: 96, y1: 210, width: 9, color: 'shade' },
      );
      for (let i = 0; i < 5; i++)
        ops.push({
          op: 'line',
          x0: 96,
          y0: 110,
          x1: 48 + i * 24,
          y1: 48 + Math.abs(2 - i) * 12,
          width: 3,
          color: 'shade',
        });
    } else if (nameHas(form, 'moon-calendar')) {
      ops.push({ op: 'line', x0: 28, y0: 72, x1: 164, y1: 72, width: 8, color: 'shade' });
      for (let i = 0; i < 4; i++)
        ops.push({
          op: 'blob',
          cx: 48 + i * 32,
          cy: 112,
          rx: 14,
          ry: 20,
          fill: i === 1 ? 'PAPER.floor' : 'fill',
          outline: 'INK.line',
          lineWidth: 3,
        });
      ops.push({ op: 'line', x0: 96, y0: 132, x1: 96, y1: 210, width: 8, color: 'shade' });
    } else if (nameHas(form, 'first-snow-globe')) {
      ops.push(
        {
          op: 'blob',
          cx: 96,
          cy: 100,
          rx: 58,
          ry: 58,
          fill: 'WATER.edge',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [62, 126],
            [96, 74],
            [130, 126],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.soft',
          lineWidth: 3,
        },
        {
          op: 'rect',
          x: 50,
          y: 158,
          w: 92,
          h: 24,
          r: 5,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
      );
    } else if (nameHas(form, 'harvest-wreath', 'spring-crown')) {
      ops.push({
        op: 'blob',
        cx: 96,
        cy: 106,
        rx: 60,
        ry: 54,
        fill: undefined,
        outline: 'SAGE.mid',
        lineWidth: 15,
      });
      for (const [x, y] of [
        [54, 80],
        [82, 54],
        [128, 58],
        [142, 112],
        [70, 138],
      ] as const)
        ops.push({
          op: 'blob',
          cx: x,
          cy: y,
          rx: 9,
          ry: 9,
          fill: 'CLAY.blossom',
          outline: 'INK.soft',
          lineWidth: 2,
        });
    } else if (nameHas(form, 'autumn-wheel')) {
      ops.push(
        {
          op: 'blob',
          cx: 96,
          cy: 102,
          rx: 58,
          ry: 58,
          fill: undefined,
          outline: 'fill',
          lineWidth: 12,
        },
        { op: 'line', x0: 96, y0: 44, x1: 96, y1: 160, width: 5, color: 'shade' },
        { op: 'line', x0: 38, y0: 102, x1: 154, y1: 102, width: 5, color: 'shade' },
        { op: 'line', x0: 56, y0: 62, x1: 136, y1: 142, width: 5, color: 'shade' },
        { op: 'blob', cx: 96, cy: 102, rx: 12, ry: 12, fill: 'ROBOT.accent' },
        { op: 'line', x0: 96, y0: 160, x1: 96, y1: 214, width: 8, color: 'shade' },
      );
    } else if (nameHas(form, 'winter-star')) {
      ops.push(
        { op: 'line', x0: 96, y0: 34, x1: 96, y1: 172, width: 9, color: 'fill' },
        { op: 'line', x0: 36, y0: 68, x1: 156, y1: 138, width: 9, color: 'fill' },
        { op: 'line', x0: 36, y0: 138, x1: 156, y1: 68, width: 9, color: 'fill' },
        {
          op: 'blob',
          cx: 96,
          cy: 103,
          rx: 13,
          ry: 13,
          fill: 'ROBOT.accent',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        { op: 'line', x0: 96, y0: 172, x1: 96, y1: 214, width: 8, color: 'shade' },
      );
    } else if (nameHas(form, 'rain-day-marker')) {
      ops.push(
        {
          op: 'path',
          points: [
            [48, 86],
            [62, 64],
            [88, 66],
            [104, 46],
            [136, 56],
            [148, 82],
            [132, 96],
            [60, 96],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [72, 112],
            [60, 140],
            [84, 132],
          ],
          fill: 'WATER.edge',
          outline: 'shade',
          lineWidth: 3,
        },
        {
          op: 'path',
          points: [
            [120, 112],
            [108, 148],
            [134, 136],
          ],
          fill: 'WATER.edge',
          outline: 'shade',
          lineWidth: 3,
        },
        { op: 'line', x0: 96, y0: 148, x1: 96, y1: 214, width: 8, color: 'shade' },
      );
    } else if (nameHas(form, 'fog-bell')) {
      ops.push(
        { op: 'line', x0: 96, y0: 36, x1: 96, y1: 58, width: 8, color: 'shade' },
        {
          op: 'path',
          points: [
            [48, 130],
            [62, 72],
            [96, 56],
            [130, 72],
            [144, 130],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 44, y0: 132, x1: 148, y1: 132, width: 9, color: 'shade' },
        { op: 'blob', cx: 96, cy: 148, rx: 12, ry: 12, fill: 'ROBOT.accent' },
        { op: 'line', x0: 96, y0: 160, x1: 96, y1: 214, width: 8, color: 'shade' },
      );
    } else if (nameHas(form, 'sun-disc')) {
      ops.push(
        {
          op: 'blob',
          cx: 96,
          cy: 100,
          rx: 48,
          ry: 48,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 96,
          cy: 100,
          rx: 18,
          ry: 18,
          fill: 'ROBOT.accent',
          outline: 'INK.soft',
          lineWidth: 2,
        },
      );
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * i) / 4;
        ops.push({
          op: 'line',
          x0: 96 + Math.cos(angle) * 58,
          y0: 100 + Math.sin(angle) * 58,
          x1: 96 + Math.cos(angle) * 76,
          y1: 100 + Math.sin(angle) * 76,
          width: 6,
          color: 'shade',
        });
      }
      ops.push({ op: 'line', x0: 96, y0: 176, x1: 96, y1: 214, width: 8, color: 'shade' });
    } else {
      ops.push(
        {
          op: 'path',
          points: [
            [96, 34],
            [114, 82],
            [162, 96],
            [114, 114],
            [96, 166],
            [78, 114],
            [30, 96],
            [78, 82],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 96,
          cy: 96,
          rx: 18,
          ry: 18,
          fill: 'ROBOT.accent',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        { op: 'line', x0: 96, y0: 166, x1: 96, y1: 214, width: 8, color: 'shade' },
      );
    }
    return { canvas: [192, 224], ops };
  }
  const ops: SpriteOp[] = [
    { op: 'line', x0: 96, y0: 216, x1: cx, y1: cy + 28, width: 8, color: 'shade' },
  ];
  ops.push(
    {
      op: 'rect',
      x: cx - 46,
      y: cy - 54,
      w: 92,
      h: 84,
      r: 8,
      fill: 'fill',
      outline: 'INK.line',
      lineWidth: 5,
    },
    {
      op: 'rect',
      x: cx - 28,
      y: cy - 36,
      w: 56,
      h: 48,
      r: 4,
      fill: 'PAPER.floor',
      outline: 'INK.soft',
      lineWidth: 3,
    },
  );
  void silhouette;
  void width;
  void height;
  void detail;
  return { canvas: [192, 224], ops };
}

function toolTemplate(
  form: FormId,
  silhouette: IdentitySilhouette,
  seed: number,
  width: number,
  detail: number,
): SpriteOpList {
  if (silhouette === 'bench-tool') {
    const ops: SpriteOp[] = [];
    if (nameHas(form, 'mallet')) {
      ops.push(
        { op: 'line', x0: 72, y0: 162, x1: 132, y1: 74, width: 12, color: 'shade' },
        {
          op: 'rect',
          x: 86,
          y: 42,
          w: 112,
          h: 52,
          r: 10,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 104, y0: 50, x1: 104, y1: 86, width: 4, color: 'shade' },
      );
    } else if (nameHas(form, 'hand-saw')) {
      ops.push(
        {
          op: 'path',
          points: [
            [34, 132],
            [154, 56],
            [180, 82],
            [62, 158],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [52, 138],
            [70, 150],
            [82, 132],
            [96, 140],
            [108, 120],
            [122, 130],
            [136, 108],
          ],
          fill: undefined,
          outline: 'shade',
          lineWidth: 4,
        },
        {
          op: 'blob',
          cx: 174,
          cy: 68,
          rx: 28,
          ry: 22,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
      );
    } else if (nameHas(form, 'brace-drill')) {
      ops.push(
        {
          op: 'path',
          points: [
            [72, 48],
            [132, 48],
            [152, 94],
            [112, 126],
            [82, 106],
          ],
          fill: undefined,
          outline: 'fill',
          lineWidth: 12,
        },
        { op: 'line', x0: 112, y0: 122, x1: 112, y1: 166, width: 8, color: 'shade' },
        {
          op: 'blob',
          cx: 70,
          cy: 48,
          rx: 18,
          ry: 12,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'blob', cx: 112, cy: 166, rx: 8, ry: 8, fill: 'ROBOT.accent' },
      );
    } else if (nameHas(form, 'clamp')) {
      ops.push(
        {
          op: 'path',
          points: [
            [54, 42],
            [54, 146],
            [146, 146],
            [146, 118],
            [84, 118],
            [84, 70],
            [162, 70],
          ],
          fill: undefined,
          outline: 'fill',
          lineWidth: 16,
        },
        { op: 'line', x0: 162, y0: 52, x1: 162, y1: 92, width: 9, color: 'shade' },
        { op: 'line', x0: 138, y0: 52, x1: 186, y1: 52, width: 7, color: 'shade' },
      );
    } else if (nameHas(form, 'wood-plane', 'spokeshave')) {
      ops.push(
        {
          op: 'path',
          points: [
            [42, 130],
            [64, 78],
            [166, 78],
            [190, 130],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [92, 82],
            [112, 48],
            [140, 82],
          ],
          close: true,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 58, y0: 136, x1: 176, y1: 136, width: 7, color: 'shade' },
        { op: 'blob', cx: 112, cy: 116, rx: 8, ry: 8, fill: 'ROBOT.accent' },
      );
    } else if (nameHas(form, 'chisel', 'awl')) {
      ops.push(
        {
          op: 'line',
          x0: 54,
          y0: 150,
          x1: 146,
          y1: 58,
          width: nameHas(form, 'awl') ? 7 : 12,
          color: 'shade',
        },
        {
          op: 'blob',
          cx: 56,
          cy: 152,
          rx: 28,
          ry: 16,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
        {
          op: 'path',
          points: [
            [144, 50],
            [178, 34],
            [160, 72],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
      );
    } else if (nameHas(form, 'measuring-square')) {
      ops.push(
        {
          op: 'path',
          points: [
            [42, 44],
            [70, 44],
            [70, 140],
            [180, 140],
            [180, 168],
            [42, 168],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 78, y0: 76, x1: 78, y1: 154, width: 4, color: 'shade' },
        { op: 'line', x0: 92, y0: 132, x1: 164, y1: 132, width: 4, color: 'shade' },
      );
    } else if (nameHas(form, 'marking-gauge')) {
      ops.push(
        { op: 'line', x0: 30, y0: 112, x1: 194, y1: 112, width: 10, color: 'shade' },
        {
          op: 'rect',
          x: 78,
          y: 70,
          w: 56,
          h: 84,
          r: 7,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 166, y0: 98, x1: 166, y1: 132, width: 5, color: 'shade' },
        { op: 'blob', cx: 106, cy: 112, rx: 7, ry: 7, fill: 'ROBOT.accent' },
      );
    } else {
      ops.push(
        {
          op: 'rect',
          x: 42,
          y: 112,
          w: 140,
          h: 50,
          r: 10,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [72, 112],
            [112, 60 + (seed % 20)],
            [152, 112],
          ],
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        {
          op: 'blob',
          cx: 112,
          cy: 126,
          rx: detail / 2,
          ry: detail / 2,
          fill: 'ROBOT.accent',
          outline: 'INK.soft',
          lineWidth: 2,
        },
      );
    }
    return {
      canvas: [224, 180],
      ops,
    };
  }
  if (silhouette === 'instrument') {
    const ops: SpriteOp[] = [];
    if (nameHas(form, 'magnifier')) {
      ops.push(
        {
          op: 'blob',
          cx: 82,
          cy: 78,
          rx: 48,
          ry: 48,
          fill: 'WATER.edge',
          outline: 'INK.line',
          lineWidth: 7,
        },
        { op: 'line', x0: 116, y0: 112, x1: 168, y1: 188, width: 14, color: 'shade' },
        { op: 'line', x0: 64, y0: 62, x1: 94, y1: 48, width: 4, color: 'PAPER.floor' },
      );
    } else if (nameHas(form, 'periscope')) {
      ops.push(
        {
          op: 'path',
          points: [
            [66, 38],
            [130, 38],
            [130, 70],
            [104, 70],
            [104, 166],
            [138, 166],
            [138, 198],
            [72, 198],
            [72, 166],
            [94, 166],
            [94, 70],
            [66, 70],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'rect',
          x: 76,
          y: 46,
          w: 44,
          h: 18,
          r: 4,
          fill: 'WATER.edge',
          outline: 'INK.soft',
          lineWidth: 3,
        },
        {
          op: 'rect',
          x: 82,
          y: 170,
          w: 46,
          h: 18,
          r: 4,
          fill: 'WATER.edge',
          outline: 'INK.soft',
          lineWidth: 3,
        },
      );
    } else if (nameHas(form, 'viewing-scope', 'sound-funnel')) {
      ops.push(
        {
          op: 'path',
          points: [
            [38, 76],
            [142, 58],
            [150, 112],
            [42, 106],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 148,
          cy: 84,
          rx: 18,
          ry: 30,
          fill: 'WATER.edge',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 104, y0: 108, x1: 104, y1: 184, width: 9, color: 'shade' },
        { op: 'line', x0: 66, y0: 196, x1: 142, y1: 196, width: 8, color: 'fill' },
      );
    } else if (nameHas(form, 'weather-vane')) {
      ops.push(
        { op: 'line', x0: 96, y0: 210, x1: 96, y1: 44, width: 9, color: 'shade' },
        { op: 'line', x0: 34, y0: 92, x1: 158, y1: 92, width: 7, color: 'fill' },
        {
          op: 'path',
          points: [
            [158, 70],
            [184, 92],
            [158, 114],
          ],
          close: true,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'blob', cx: 96, cy: 92, rx: 9, ry: 9, fill: 'ROBOT.accent' },
      );
    } else if (nameHas(form, 'rain-gauge')) {
      ops.push(
        {
          op: 'rect',
          x: 72,
          y: 40,
          w: 48,
          h: 132,
          r: 10,
          fill: 'WATER.edge',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 96, y0: 172, x1: 96, y1: 210, width: 8, color: 'shade' },
      );
      for (let i = 0; i < 4; i++)
        ops.push({
          op: 'line',
          x0: 78,
          y0: 68 + i * 24,
          x1: 94,
          y1: 68 + i * 24,
          width: 3,
          color: 'shade',
        });
    } else if (nameHas(form, 'wind-meter')) {
      ops.push(
        { op: 'line', x0: 96, y0: 210, x1: 96, y1: 104, width: 9, color: 'shade' },
        { op: 'blob', cx: 96, cy: 88, rx: 12, ry: 12, fill: 'ROBOT.accent' },
      );
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 * i) / 3;
        const x = 96 + Math.cos(a) * 52;
        const y = 88 + Math.sin(a) * 52;
        ops.push(
          { op: 'line', x0: 96, y0: 88, x1: x, y1: y, width: 6, color: 'fill' },
          {
            op: 'blob',
            cx: x,
            cy: y,
            rx: 16,
            ry: 10,
            fill: 'shade',
            outline: 'INK.line',
            lineWidth: 3,
          },
        );
      }
    } else if (nameHas(form, 'sun-dial')) {
      ops.push(
        {
          op: 'blob',
          cx: 96,
          cy: 132,
          rx: 66,
          ry: 28,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [96, 126],
            [96, 56],
            [132, 126],
          ],
          close: true,
          fill: 'shade',
          outline: 'INK.line',
          lineWidth: 4,
        },
        { op: 'line', x0: 96, y0: 160, x1: 96, y1: 210, width: 9, color: 'shade' },
      );
    } else if (nameHas(form, 'soil-tester')) {
      ops.push(
        {
          op: 'blob',
          cx: 96,
          cy: 68,
          rx: 42,
          ry: 42,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        { op: 'line', x0: 96, y0: 68, x1: 122, y1: 48, width: 4, color: 'ROBOT.accent' },
        { op: 'line', x0: 84, y0: 110, x1: 78, y1: 210, width: 7, color: 'shade' },
        { op: 'line', x0: 108, y0: 110, x1: 114, y1: 210, width: 7, color: 'shade' },
      );
    } else if (nameHas(form, 'specimen-viewer')) {
      ops.push(
        {
          op: 'rect',
          x: 42,
          y: 44,
          w: 108,
          h: 112,
          r: 12,
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 96,
          cy: 98,
          rx: 34,
          ry: 34,
          fill: 'WATER.edge',
          outline: 'shade',
          lineWidth: 5,
        },
        {
          op: 'path',
          points: [
            [82, 106],
            [96, 74],
            [110, 106],
            [96, 124],
          ],
          close: true,
          fill: 'SAGE.mid',
          outline: 'INK.soft',
          lineWidth: 2,
        },
        { op: 'line', x0: 96, y0: 156, x1: 96, y1: 210, width: 8, color: 'shade' },
      );
    } else {
      ops.push(
        {
          op: 'blob',
          cx: 96,
          cy: 96,
          rx: Math.min(58, width / 3),
          ry: Math.min(58, width / 3),
          fill: 'fill',
          outline: 'INK.line',
          lineWidth: 5,
        },
        {
          op: 'blob',
          cx: 96,
          cy: 96,
          rx: 34,
          ry: 34,
          fill: 'PAPER.floor',
          outline: 'INK.soft',
          lineWidth: 3,
        },
        {
          op: 'line',
          x0: 96,
          y0: 96,
          x1: 96 + (seed % 41) - 20,
          y1: 64,
          width: 4,
          color: 'ROBOT.accent',
        },
        { op: 'line', x0: 96, y0: 154, x1: 96, y1: 216, width: 8, color: 'shade' },
      );
    }
    return {
      canvas: [192, 224],
      ops,
    };
  }
  const lean = (seed % 35) - 17;
  const headY = 62 + (seed % 30);
  const ops: SpriteOp[] = [];
  if (nameHas(form, 'hand-fork', 'soil-rake', 'leaf-rake')) {
    ops.push(
      { op: 'line', x0: 96, y0: 244, x1: 96 + lean, y1: headY + 24, width: 10, color: 'shade' },
      {
        op: 'line',
        x0: 96 + lean - 44,
        y0: headY + 18,
        x1: 96 + lean + 44,
        y1: headY + 18,
        width: 9,
        color: 'fill',
      },
    );
    const teeth = nameHas(form, 'leaf-rake') ? 7 : nameHas(form, 'soil-rake') ? 5 : 3;
    for (let i = 0; i < teeth; i++) {
      const x = 96 + lean - 36 + i * (72 / (teeth - 1));
      ops.push({
        op: 'line',
        x0: 96 + lean,
        y0: headY + 20,
        x1: x,
        y1: headY - 22,
        width: nameHas(form, 'leaf') ? 4 : 6,
        color: 'fill',
      });
    }
  } else if (nameHas(form, 'dibber')) {
    ops.push(
      { op: 'line', x0: 96, y0: 236, x1: 102, y1: 74, width: 14, color: 'shade' },
      {
        op: 'path',
        points: [
          [88, 74],
          [116, 74],
          [102, 36],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 70, y0: 92, x1: 134, y1: 92, width: 8, color: 'fill' },
    );
  } else if (nameHas(form, 'weeding-hook')) {
    ops.push(
      { op: 'line', x0: 92, y0: 240, x1: 108, y1: 86, width: 10, color: 'shade' },
      {
        op: 'path',
        points: [
          [108, 88],
          [146, 54],
          [170, 72],
          [146, 100],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 12,
      },
      {
        op: 'blob',
        cx: 92,
        cy: 226,
        rx: 14,
        ry: 22,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    );
  } else if (nameHas(form, 'bulb-planter')) {
    ops.push(
      { op: 'line', x0: 96, y0: 230, x1: 96, y1: 72, width: 11, color: 'shade' },
      {
        op: 'path',
        points: [
          [68, 72],
          [124, 72],
          [116, 132],
          [76, 132],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 54, y0: 84, x1: 138, y1: 84, width: 8, color: 'shade' },
      {
        op: 'path',
        points: [
          [78, 132],
          [96, 154],
          [114, 132],
        ],
        fill: undefined,
        outline: 'shade',
        lineWidth: 5,
      },
    );
  } else if (nameHas(form, 'watering-wand')) {
    ops.push(
      { op: 'line', x0: 62, y0: 228, x1: 132, y1: 70, width: 11, color: 'shade' },
      {
        op: 'path',
        points: [
          [128, 74],
          [166, 42],
          [178, 56],
          [142, 88],
        ],
        fill: undefined,
        outline: 'fill',
        lineWidth: 11,
      },
      {
        op: 'blob',
        cx: 184,
        cy: 50,
        rx: 18,
        ry: 26,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 176, y0: 42, x1: 190, y1: 32, width: 3, color: 'WATER.deep' },
    );
  } else if (nameHas(form, 'pruning-knife')) {
    ops.push(
      {
        op: 'blob',
        cx: 76,
        cy: 190,
        rx: 22,
        ry: 42,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'path',
        points: [
          [82, 154],
          [130, 52],
          [164, 40],
          [142, 76],
          [102, 164],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 96, y0: 144, x1: 142, y1: 58, width: 3, color: 'shade' },
    );
  } else if (nameHas(form, 'garden-sieve')) {
    ops.push(
      {
        op: 'blob',
        cx: 96,
        cy: 104,
        rx: 64,
        ry: 52,
        fill: undefined,
        outline: 'fill',
        lineWidth: 12,
      },
      { op: 'line', x0: 48, y0: 76, x1: 144, y1: 132, width: 4, color: 'shade' },
      { op: 'line', x0: 48, y0: 132, x1: 144, y1: 76, width: 4, color: 'shade' },
      { op: 'line', x0: 96, y0: 54, x1: 96, y1: 154, width: 4, color: 'shade' },
      { op: 'line', x0: 36, y0: 104, x1: 156, y1: 104, width: 4, color: 'shade' },
      { op: 'line', x0: 96, y0: 156, x1: 96, y1: 232, width: 9, color: 'shade' },
    );
  } else if (nameHas(form, 'seed-scoop')) {
    ops.push(
      { op: 'line', x0: 70, y0: 230, x1: 108, y1: 132, width: 11, color: 'shade' },
      {
        op: 'path',
        points: [
          [66, 132],
          [150, 62],
          [174, 92],
          [112, 150],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 128,
        cy: 96,
        rx: 20,
        ry: 12,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 2,
      },
    );
  } else {
    ops.push(
      { op: 'line', x0: 96, y0: 244, x1: 96 + lean, y1: headY, width: 10, color: 'shade' },
      {
        op: 'path',
        points: [
          [96 + lean - width * 0.26, headY - detail],
          [96 + lean + width * 0.26, headY - detail / 2],
          [96 + lean + detail, headY + detail],
          [96 + lean - detail, headY + detail],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 92, y0: 198, x1: 100, y1: 166, width: 3, color: 'INK.soft' },
    );
  }
  return {
    canvas: [192, 256],
    ops,
  };
}

// --- Raw-material chips ------------------------------------------------------
// A material on its own (Fetch menu, bench strip) is a *raw find*, not a built
// item — so it gets its own tiny plate per group, recolored by the material
// profile. Without this every material reused the `bundle` form and read as the
// same grey lump regardless of group. One readable silhouette per group:
//   wood  → a tied bundle of stems        plant → a leafy sprig
//   stone → a little cairn of pebbles     found → a single kept trinket
// All anchored to the bottom margin, baseline-clean (no neon, no outline chrome).

const MATERIAL_CHIP_TEMPLATES: Record<MaterialGroup, SpriteOpList> = {
  wood: {
    canvas: [128, 128],
    ops: [
      { op: 'line', x0: 40, y0: 112, x1: 56, y1: 24, width: 7, color: 'fill', jitter: 3 },
      { op: 'line', x0: 64, y0: 112, x1: 64, y1: 20, width: 7, color: 'fill', jitter: 3 },
      { op: 'line', x0: 88, y0: 112, x1: 74, y1: 26, width: 7, color: 'fill', jitter: 3 },
      // the binding tie
      { op: 'line', x0: 36, y0: 78, x1: 92, y1: 74, width: 6, color: 'shade' },
    ],
  },
  stone: {
    canvas: [128, 128],
    ops: [
      {
        op: 'blob',
        cx: 64,
        cy: 100,
        rx: 40,
        ry: 18,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
        irregularity: 0.25,
      },
      {
        op: 'blob',
        cx: 48,
        cy: 78,
        rx: 22,
        ry: 16,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
        irregularity: 0.3,
      },
      {
        op: 'blob',
        cx: 82,
        cy: 74,
        rx: 20,
        ry: 15,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
        irregularity: 0.3,
      },
      {
        op: 'blob',
        cx: 64,
        cy: 54,
        rx: 18,
        ry: 14,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
        irregularity: 0.3,
      },
    ],
  },
  plant: {
    canvas: [128, 128],
    ops: [
      { op: 'line', x0: 64, y0: 116, x1: 64, y1: 50, width: 6, color: 'shade' },
      // a pair of leaves off the stem, plus a soft crown — reads as a sprig
      {
        op: 'blob',
        cx: 46,
        cy: 78,
        rx: 16,
        ry: 9,
        fill: 'fill',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      {
        op: 'blob',
        cx: 82,
        cy: 70,
        rx: 16,
        ry: 9,
        fill: 'fill',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      {
        op: 'blob',
        cx: 64,
        cy: 48,
        rx: 18,
        ry: 16,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    ],
  },
  found: {
    canvas: [128, 128],
    ops: [
      { op: 'line', x0: 64, y0: 116, x1: 64, y1: 84, width: 5, color: 'shade' },
      {
        op: 'blob',
        cx: 64,
        cy: 64,
        rx: 26,
        ry: 26,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
        irregularity: 0.2,
      },
      {
        op: 'blob',
        cx: 64,
        cy: 60,
        rx: 8,
        ry: 8,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 2,
      },
    ],
  },
};

/**
 * A standalone plate for a RAW material (not a built item), recolored by the
 * material profile. Used by the Fetch menu and the bench strip so every
 * material reads as its own find. Cached under a reserved id so it never
 * collides with a real `ItemId`.
 */
export function materialSprite(mat: MaterialId): PropSprite {
  const id = `mat:${mat}`;
  const cached = spriteCache.get(id);
  if (cached) return cached;
  const sprite = compileSprite(MATERIAL_CHIP_TEMPLATES[groupOf(mat)], seedOf(id), profile(mat));
  spriteCache.set(id, sprite);
  return sprite;
}

/** Encoded plate URL for a raw material (cached). */
export function materialSpriteUrl(mat: MaterialId): string {
  const id = `mat:${mat}`;
  let url = spriteUrlCache.get(id);
  if (!url) {
    url = materialSprite(mat).canvas.toDataURL();
    spriteUrlCache.set(id, url);
  }
  return url;
}

/** Clear caches (tests / language-independent — sprites have no text). */
export function clearSpriteCache(): void {
  spriteCache.clear();
  textureCache.clear();
}

export type { MaterialId };
