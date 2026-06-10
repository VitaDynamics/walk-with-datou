/**
 * The Workshop — bespoke form sprite templates (op-lists).
 *
 * Authored per the ITEM_AUTHORING_TEMPLATE: each is an ordered op-list over
 * the baseline palette, recolored at compile time by the material profile
 * (`fill`/`shade` tokens). A form NOT listed here falls back to its family
 * template (`sprites.ts`), so coverage is complete from day one and this table
 * fills in over W3/W7 for the forms that deserve bespoke art.
 *
 * Style budget (authoring §5): 6–16 ops, flat fills + one shade pass + ink
 * outline, item touches the bottom margin (ground anchor). Max 3 dominant
 * color families; `ROBOT.accent` only as a small dot.
 */

import type { SpriteOpList } from '../../art/spriteOps';
import type { FormId } from './forms';

export const FORM_TEMPLATES: Partial<Record<FormId, SpriteOpList>> = {
  // bench — two posts + two plank lines + grain (authoring §5 exemplar).
  bench: {
    canvas: [256, 224],
    ops: [
      { op: 'line', x0: 64, y0: 208, x1: 70, y1: 128, width: 12, color: 'shade' },
      { op: 'line', x0: 192, y0: 208, x1: 186, y1: 128, width: 12, color: 'shade' },
      {
        op: 'path',
        points: [
          [36, 124],
          [220, 120],
          [222, 142],
          [38, 146],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [36, 96],
          [220, 92],
          [222, 110],
          [38, 114],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 70, y0: 132, x1: 90, y1: 131, width: 2, color: 'shade' },
      { op: 'line', x0: 150, y0: 132, x1: 170, y1: 131, width: 2, color: 'shade' },
    ],
  },

  // lantern — dark stem, paper cone, warm halo, accent dot (authoring §5).
  lantern: {
    canvas: [192, 288],
    ops: [
      { op: 'halo', cx: 96, cy: 120, r: 92 },
      { op: 'line', x0: 96, y0: 272, x1: 96, y1: 150, width: 7, color: 'shade' },
      {
        op: 'path',
        points: [
          [60, 150],
          [132, 150],
          [116, 92],
          [76, 92],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 96,
        cy: 132,
        rx: 28,
        ry: 9,
        fill: 'CLAY.pale',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'blob',
        cx: 96,
        cy: 110,
        rx: 6,
        ry: 6,
        fill: 'ROBOT.accent',
        outline: 'INK.soft',
        lineWidth: 2,
      },
    ],
  },

  // birdbath — pedestal + bowl + water + tiny bird (authoring §5).
  birdbath: {
    canvas: [224, 288],
    ops: [
      {
        op: 'path',
        points: [
          [96, 120],
          [88, 200],
          [76, 252],
          [148, 252],
          [136, 200],
          [128, 120],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 112,
        cy: 258,
        rx: 52,
        ry: 13,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 112,
        cy: 112,
        rx: 84,
        ry: 26,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 112,
        cy: 106,
        rx: 62,
        ry: 14,
        fill: 'WATER.mid',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'blob',
        cx: 150,
        cy: 88,
        rx: 14,
        ry: 10,
        fill: 'CLAY.blossom',
        outline: 'INK.line',
        lineWidth: 3,
      },
    ],
  },

  // post — a single upright timber with a capped top.
  post: {
    canvas: [128, 256],
    ops: [
      { op: 'line', x0: 64, y0: 244, x1: 66, y1: 60, width: 22, color: 'fill' },
      { op: 'line', x0: 64, y0: 244, x1: 66, y1: 60, width: 22, color: 'fill', jitter: 0 },
      {
        op: 'blob',
        cx: 65,
        cy: 56,
        rx: 18,
        ry: 10,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 54, y0: 200, x1: 58, y1: 100, width: 2, color: 'shade' },
    ],
  },

  // beam — a horizontal timber lying on supports.
  beam: {
    canvas: [256, 128],
    ops: [
      {
        op: 'path',
        points: [
          [24, 70],
          [232, 64],
          [232, 96],
          [24, 102],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 60, y0: 84, x1: 200, y1: 80, width: 2, color: 'shade' },
    ],
  },

  // cairn — a balanced stack of three stones.
  cairn: {
    canvas: [160, 224],
    ops: [
      {
        op: 'blob',
        cx: 80,
        cy: 190,
        rx: 46,
        ry: 28,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 80,
        cy: 138,
        rx: 34,
        ry: 22,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 80,
        cy: 96,
        rx: 22,
        ry: 16,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 4,
      },
    ],
  },

  // brush — a short handle with a soft, splayed head.
  brush: {
    canvas: [192, 224],
    ops: [
      { op: 'line', x0: 76, y0: 212, x1: 104, y1: 112, width: 14, color: 'shade' },
      {
        op: 'path',
        points: [
          [78, 116],
          [112, 84],
          [142, 108],
          [108, 142],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 112, y0: 92, x1: 132, y1: 70, width: 5, color: 'fill' },
      { op: 'line', x0: 120, y0: 100, x1: 146, y1: 82, width: 5, color: 'fill' },
      { op: 'line', x0: 126, y0: 110, x1: 154, y1: 98, width: 5, color: 'fill' },
      { op: 'line', x0: 86, y0: 180, x1: 94, y1: 150, width: 2, color: 'INK.soft' },
    ],
  },

  // wayfinder — a handmade compass resting on a low foot.
  wayfinder: {
    canvas: [192, 224],
    ops: [
      { op: 'line', x0: 96, y0: 212, x1: 96, y1: 176, width: 10, color: 'shade' },
      {
        op: 'blob',
        cx: 96,
        cy: 204,
        rx: 42,
        ry: 10,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 96,
        cy: 118,
        rx: 62,
        ry: 62,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 6,
      },
      {
        op: 'blob',
        cx: 96,
        cy: 118,
        rx: 44,
        ry: 44,
        fill: 'PAPER.floor',
        outline: 'INK.soft',
        lineWidth: 3,
      },
      {
        op: 'path',
        points: [
          [96, 72],
          [108, 120],
          [96, 112],
          [84, 120],
        ],
        close: true,
        fill: 'ROBOT.accent',
        outline: 'INK.line',
        lineWidth: 3,
      },
      { op: 'line', x0: 60, y0: 118, x1: 132, y1: 118, width: 3, color: 'INK.soft' },
      {
        op: 'blob',
        cx: 96,
        cy: 118,
        rx: 6,
        ry: 6,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 2,
      },
    ],
  },

  // field glass — twin lenses on a small shared observation stand.
  'field-glass': {
    canvas: [224, 224],
    ops: [
      { op: 'line', x0: 112, y0: 210, x1: 112, y1: 132, width: 9, color: 'shade' },
      { op: 'line', x0: 112, y0: 170, x1: 78, y1: 212, width: 6, color: 'shade' },
      { op: 'line', x0: 112, y0: 170, x1: 146, y1: 212, width: 6, color: 'shade' },
      {
        op: 'path',
        points: [
          [44, 82],
          [102, 92],
          [102, 132],
          [44, 142],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [122, 92],
          [180, 82],
          [180, 142],
          [122, 132],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'rect',
        x: 98,
        y: 104,
        w: 28,
        h: 18,
        r: 7,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 3,
      },
      {
        op: 'blob',
        cx: 48,
        cy: 112,
        rx: 12,
        ry: 28,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 4,
      },
      {
        op: 'blob',
        cx: 176,
        cy: 112,
        rx: 12,
        ry: 28,
        fill: 'WATER.edge',
        outline: 'INK.line',
        lineWidth: 4,
      },
    ],
  },

  // play ball — a soft wrapped ball with visible hand-tied bands.
  'play-ball': {
    canvas: [192, 224],
    ops: [
      {
        op: 'blob',
        cx: 96,
        cy: 170,
        rx: 48,
        ry: 44,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [58, 148],
          [82, 132],
          [124, 206],
          [104, 214],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      {
        op: 'path',
        points: [
          [132, 142],
          [144, 164],
          [64, 196],
          [54, 178],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      { op: 'line', x0: 64, y0: 156, x1: 132, y1: 190, width: 3, color: 'INK.soft' },
      { op: 'line', x0: 72, y0: 196, x1: 128, y1: 146, width: 3, color: 'INK.soft' },
      {
        op: 'blob',
        cx: 98,
        cy: 172,
        rx: 7,
        ry: 6,
        fill: 'ROBOT.accent',
        outline: 'INK.line',
        lineWidth: 2,
      },
    ],
  },

  // cache box — a lidded trail chest with one quiet amber latch.
  'cache-box': {
    canvas: [256, 224],
    ops: [
      {
        op: 'rect',
        x: 32,
        y: 92,
        w: 192,
        h: 120,
        r: 14,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 6,
      },
      {
        op: 'path',
        points: [
          [28, 92],
          [48, 62],
          [208, 62],
          [228, 92],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 6,
      },
      { op: 'line', x0: 42, y0: 116, x1: 214, y1: 116, width: 4, color: 'INK.soft' },
      { op: 'line', x0: 72, y0: 104, x1: 72, y1: 204, width: 4, color: 'shade' },
      { op: 'line', x0: 184, y0: 104, x1: 184, y1: 204, width: 4, color: 'shade' },
      {
        op: 'rect',
        x: 116,
        y: 104,
        w: 24,
        h: 34,
        r: 5,
        fill: 'ROBOT.accent',
        outline: 'INK.line',
        lineWidth: 3,
      },
      {
        op: 'speckle',
        x: 42,
        y: 142,
        w: 168,
        h: 56,
        count: 18,
        color: 'INK.grain',
        alpha: 0.1,
        maxR: 1.2,
      },
    ],
  },

  // drinking bowl — a broad low bowl holding a calm water ellipse.
  'drinking-bowl': {
    canvas: [224, 160],
    ops: [
      {
        op: 'blob',
        cx: 112,
        cy: 122,
        rx: 86,
        ry: 34,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'path',
        points: [
          [34, 114],
          [50, 146],
          [174, 146],
          [190, 114],
        ],
        close: true,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 112,
        cy: 108,
        rx: 76,
        ry: 24,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 112,
        cy: 106,
        rx: 62,
        ry: 15,
        fill: 'WATER.mid',
        outline: 'INK.soft',
        lineWidth: 2,
      },
      { op: 'line', x0: 74, y0: 108, x1: 96, y1: 104, width: 2, color: 'WATER.edge' },
      { op: 'line', x0: 120, y0: 110, x1: 148, y1: 106, width: 2, color: 'WATER.edge' },
    ],
  },

  // bug hotel — a tiny roofed cabinet with varied nesting holes.
  'bug-hotel': {
    canvas: [224, 288],
    ops: [
      {
        op: 'rect',
        x: 48,
        y: 92,
        w: 128,
        h: 180,
        r: 8,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 6,
      },
      {
        op: 'path',
        points: [
          [34, 98],
          [112, 42],
          [190, 98],
        ],
        close: true,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 6,
      },
      { op: 'line', x0: 112, y0: 100, x1: 112, y1: 260, width: 5, color: 'INK.soft' },
      { op: 'line', x0: 58, y0: 172, x1: 166, y1: 172, width: 5, color: 'INK.soft' },
      {
        op: 'blob',
        cx: 82,
        cy: 132,
        rx: 13,
        ry: 12,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 3,
      },
      {
        op: 'blob',
        cx: 142,
        cy: 132,
        rx: 10,
        ry: 10,
        fill: 'shade',
        outline: 'INK.line',
        lineWidth: 3,
      },
      { op: 'line', x0: 68, y0: 210, x1: 96, y1: 238, width: 7, color: 'shade' },
      { op: 'line', x0: 128, y0: 232, x1: 154, y1: 202, width: 7, color: 'shade' },
      {
        op: 'speckle',
        x: 60,
        y: 184,
        w: 104,
        h: 66,
        count: 22,
        color: 'INK.grain',
        alpha: 0.12,
        maxR: 1.4,
      },
    ],
  },

  // raft — six lashed floats and a simple upright guide rope.
  raft: {
    canvas: [320, 192],
    ops: [
      {
        op: 'blob',
        cx: 74,
        cy: 160,
        rx: 54,
        ry: 22,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 120,
        cy: 156,
        rx: 56,
        ry: 22,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 168,
        cy: 154,
        rx: 56,
        ry: 22,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 216,
        cy: 156,
        rx: 56,
        ry: 22,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      {
        op: 'blob',
        cx: 260,
        cy: 160,
        rx: 42,
        ry: 20,
        fill: 'fill',
        outline: 'INK.line',
        lineWidth: 5,
      },
      { op: 'line', x0: 64, y0: 144, x1: 266, y1: 148, width: 7, color: 'shade' },
      { op: 'line', x0: 86, y0: 174, x1: 248, y1: 170, width: 7, color: 'shade' },
      { op: 'line', x0: 88, y0: 144, x1: 92, y1: 70, width: 7, color: 'shade' },
      {
        op: 'path',
        points: [
          [92, 72],
          [142, 96],
          [94, 116],
        ],
        close: true,
        fill: 'CLAY.pale',
        outline: 'INK.line',
        lineWidth: 4,
      },
      { op: 'line', x0: 24, y0: 184, x1: 296, y1: 184, width: 3, color: 'WATER.deep', jitter: 3 },
    ],
  },
};
