/**
 * The Workshop — item sprite resolver (BUILDING_SYSTEM §2.3, §9).
 *
 * Turns an `ItemSpec` into a hand-drawn plate, recolored by the material
 * profile. Two sources, in order:
 *
 *  1. A form's authored op-list template (`FORM_TEMPLATES`), compiled and
 *     recolored by the material profile via `compileSprite` — the §2.3
 *     "template × material profile" pipeline. This is the path W7 fills out.
 *  2. A family fallback template, so EVERY one of the ~1 500 items has a
 *     readable plate even before its bespoke template is authored.
 *
 * Sprites are cached by ItemId so the 1 000-item space stays flat in memory
 * (§9). Deterministic: the seed derives from the ItemId, so the same item
 * always draws the same plate.
 */

import { canvasTexture } from '../../art/textures';
import { compileSprite, type SpriteOpList } from '../../art/spriteOps';
import type { PropSprite } from '../../art/props';
import * as THREE from 'three';
import { profile, groupOf, type MaterialGroup, type MaterialId } from './materials';
import { form as formDef, type FormFamily, type FormId } from './forms';
import { parseItemId, type ItemId, type ItemSpec } from './items';
import { FORM_TEMPLATES } from './formTemplates';

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

/** The op-list for a spec: bespoke form template if present, else family fallback. */
function templateFor(spec: ItemSpec): SpriteOpList {
  return FORM_TEMPLATES[spec.form] ?? familyTemplate(formDef(spec.form).family);
}

export function itemSprite(id: ItemId): PropSprite {
  const cached = spriteCache.get(id);
  if (cached) return cached;
  const spec = parseItemId(id);
  const sprite = spec
    ? compileSprite(templateFor(spec), seedOf(id), profile(spec.material))
    : compileSprite(familyTemplate('component'), seedOf(id));
  spriteCache.set(id, sprite);
  return sprite;
}

/** Encoded sprite plate for DOM images (cached because canvas encoding is synchronous). */
export function itemSpriteUrl(id: ItemId): string {
  let url = spriteUrlCache.get(id);
  if (!url) {
    url = itemSprite(id).canvas.toDataURL();
    spriteUrlCache.set(id, url);
  }
  return url;
}

/** Read a cached DOM image URL without forcing sprite compilation. */
export function cachedItemSpriteUrl(id: ItemId): string | undefined {
  return spriteUrlCache.get(id);
}

/** Three.js texture for an item plate (cached). */
export function itemTexture(id: ItemId): THREE.Texture {
  const cached = textureCache.get(id);
  if (cached) return cached;
  const tex = canvasTexture(itemSprite(id).canvas);
  textureCache.set(id, tex);
  return tex;
}

/** World plate height (m) for placing a made item, by size. */
export function itemHeight(spec: ItemSpec): number {
  const base = formDef(spec.form).world?.heightM ?? FORM_HEIGHT[spec.form] ?? 0.9;
  return base * SIZE_SCALE[spec.size];
}

// Per-form world heights (m). Coarse; tuned in W7 balancing.
const FORM_HEIGHT: Partial<Record<FormId, number>> = {
  shelter: 1.5,
  archway: 2.5,
  pergola: 2.4,
  'lookout-perch': 2.6,
  well: 1.6,
  shrine: 1.4,
  'cold-frame': 1.0,
  bench: 0.9,
  table: 1.0,
  birdbath: 1.2,
  chime: 1.5,
  lamp: 1.6,
  lantern: 1.1,
  fence: 0.95,
  trellis: 1.6,
  cairn: 0.8,
  campfire: 1.0,
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
        op: 'blob', cx: 64, cy: 100, rx: 40, ry: 18, fill: 'shade',
        outline: 'INK.line', lineWidth: 4, irregularity: 0.25,
      },
      {
        op: 'blob', cx: 48, cy: 78, rx: 22, ry: 16, fill: 'fill',
        outline: 'INK.line', lineWidth: 4, irregularity: 0.3,
      },
      {
        op: 'blob', cx: 82, cy: 74, rx: 20, ry: 15, fill: 'fill',
        outline: 'INK.line', lineWidth: 4, irregularity: 0.3,
      },
      {
        op: 'blob', cx: 64, cy: 54, rx: 18, ry: 14, fill: 'fill',
        outline: 'INK.line', lineWidth: 4, irregularity: 0.3,
      },
    ],
  },
  plant: {
    canvas: [128, 128],
    ops: [
      { op: 'line', x0: 64, y0: 116, x1: 64, y1: 50, width: 6, color: 'shade' },
      // a pair of leaves off the stem, plus a soft crown — reads as a sprig
      { op: 'blob', cx: 46, cy: 78, rx: 16, ry: 9, fill: 'fill', outline: 'INK.soft', lineWidth: 3 },
      { op: 'blob', cx: 82, cy: 70, rx: 16, ry: 9, fill: 'fill', outline: 'INK.soft', lineWidth: 3 },
      { op: 'blob', cx: 64, cy: 48, rx: 18, ry: 16, fill: 'fill', outline: 'INK.line', lineWidth: 4 },
    ],
  },
  found: {
    canvas: [128, 128],
    ops: [
      { op: 'line', x0: 64, y0: 116, x1: 64, y1: 84, width: 5, color: 'shade' },
      {
        op: 'blob', cx: 64, cy: 64, rx: 26, ry: 26, fill: 'fill',
        outline: 'INK.line', lineWidth: 4, irregularity: 0.2,
      },
      {
        op: 'blob', cx: 64, cy: 60, rx: 8, ry: 8, fill: 'shade',
        outline: 'INK.soft', lineWidth: 2,
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
