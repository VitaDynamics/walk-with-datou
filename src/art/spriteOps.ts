/**
 * Declarative sprite-op compiler (ITEM_AUTHORING_TEMPLATE §2.2).
 *
 * New Workshop forms author their art as an ordered list of draw OPS over the
 * baseline palette, instead of an imperative draw fn. The engine interprets
 * them against the existing hand-drawn stroke primitives (`strokes.ts`),
 * adding its OWN seeded wobble — the op coordinates are clean constants, the
 * "hand-made" jitter is added here, so authored content stays deterministic
 * but never ruler-straight.
 *
 * Palette tokens are referenced by name ("SAGE.mid"); colors resolve through
 * `PALETTE_TOKENS` so no op can introduce an off-baseline color. A material
 * PROFILE may recolor the form: ops tagged `tone:"fill"|"shade"` take the
 * material's fill/shade, so one template renders across all eligible
 * materials (the §2.3 "template × material profile" pipeline).
 */

import { Rng } from '../physics/mujoco/rng';
import { CLAY, GROUND, INK, LAMP_WARM, PAPER, ROBOT, SAGE, WATER } from './palette';
import { blob, grassStroke, wobblyLine, paintBlob } from './strokes';
import { createCanvas, ctx2d } from './textures';
import type { PropSprite } from './props';
import type { MaterialProfile } from '../game/workshop/materials';

/** The only colors an op may name (ITEM_AUTHORING_TEMPLATE §2.1). */
const PALETTE_TOKENS: Record<string, string> = {
  'PAPER.skyTop': PAPER.skyTop,
  'PAPER.skyBottom': PAPER.skyBottom,
  'PAPER.floor': PAPER.floor,
  'INK.line': INK.line,
  'INK.soft': INK.soft,
  'INK.grain': INK.grain,
  'GROUND.base': GROUND.base,
  'GROUND.path': GROUND.path,
  'GROUND.edge': GROUND.edge,
  'SAGE.light': SAGE.light,
  'SAGE.mid': SAGE.mid,
  'SAGE.deep': SAGE.deep,
  'SAGE.shade': SAGE.shade,
  'CLAY.pale': CLAY.pale,
  'CLAY.light': CLAY.light,
  'CLAY.mid': CLAY.mid,
  'CLAY.deep': CLAY.deep,
  'CLAY.blossom': CLAY.blossom,
  'WATER.deep': WATER.deep,
  'WATER.mid': WATER.mid,
  'WATER.edge': WATER.edge,
  'WATER.sand': WATER.sand,
  'ROBOT.shell': ROBOT.shell,
  'ROBOT.shellShade': ROBOT.shellShade,
  'ROBOT.dark': ROBOT.dark,
  'ROBOT.darkShade': ROBOT.darkShade,
  'ROBOT.visor': ROBOT.visor,
  'ROBOT.accent': ROBOT.accent,
};

/** A color is a palette token, or `"fill"`/`"shade"` to take the material profile's tone. */
export type ColorRef = string;

export type SpriteOp =
  | { op: 'blob'; cx: number; cy: number; rx: number; ry: number; fill?: ColorRef; outline?: ColorRef; lineWidth?: number; n?: number; irregularity?: number }
  | { op: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill?: ColorRef; outline?: ColorRef; lineWidth?: number }
  | { op: 'line'; x0: number; y0: number; x1: number; y1: number; width: number; color: ColorRef; jitter?: number; segments?: number }
  | { op: 'path'; points: Array<[number, number]>; close?: boolean; fill?: ColorRef; outline?: ColorRef; lineWidth?: number }
  | { op: 'grass'; x: number; baseY: number; height: number; lean: number; width: number; color: ColorRef }
  | { op: 'halo'; cx: number; cy: number; r: number }
  | { op: 'speckle'; x: number; y: number; w: number; h: number; count: number; color: ColorRef; alpha?: number; maxR?: number };

export interface SpriteOpList {
  /** [w, h] canvas size, 128–512 per side. */
  canvas: [number, number];
  ops: SpriteOp[];
}

function resolveColor(ref: ColorRef | undefined, profile?: MaterialProfile): string | undefined {
  if (!ref) return undefined;
  if (ref === 'fill') return profile?.fill ?? CLAY.mid;
  if (ref === 'shade') return profile?.shade ?? CLAY.deep;
  return PALETTE_TOKENS[ref] ?? CLAY.mid;
}

/**
 * Compile an op-list into a PropSprite, optionally recolored by a material
 * profile. `seed` drives the hand-wobble (deterministic per placed instance).
 */
export function compileSprite(
  list: SpriteOpList,
  seed: number,
  profile?: MaterialProfile,
): PropSprite {
  const [w, h] = list.canvas;
  const c = createCanvas(w, h);
  const g = ctx2d(c);
  const rng = new Rng(seed >>> 0);

  for (const op of list.ops) {
    switch (op.op) {
      case 'blob':
        blob(
          g,
          rng,
          op.cx,
          op.cy,
          op.rx,
          op.ry,
          {
            fill: resolveColor(op.fill, profile),
            outline: resolveColor(op.outline, profile),
            lineWidth: op.lineWidth ?? 4,
          },
          op.n ?? 9,
          op.irregularity ?? 0.1,
        );
        break;
      case 'rect': {
        roundedRect(g, op.x, op.y, op.w, op.h, op.r ?? 0);
        const fill = resolveColor(op.fill, profile);
        if (fill) {
          g.fillStyle = fill;
          g.fill();
        }
        const outline = resolveColor(op.outline, profile);
        if (outline) {
          g.strokeStyle = outline;
          g.lineWidth = op.lineWidth ?? 4;
          g.lineJoin = 'round';
          g.stroke();
        }
        break;
      }
      case 'line':
        wobblyLine(
          g,
          rng,
          op.x0,
          op.y0,
          op.x1,
          op.y1,
          op.width,
          resolveColor(op.color, profile) ?? INK.line,
          op.jitter ?? 1.5,
          op.segments ?? 5,
        );
        break;
      case 'path': {
        // Jitter each authored vertex slightly, then smooth as a blob path.
        const pts = op.points.map(([x, y]) => ({
          x: x + (rng.next() * 2 - 1) * 2,
          y: y + (rng.next() * 2 - 1) * 2,
        }));
        paintBlob(g, pts, {
          fill: resolveColor(op.fill, profile),
          outline: resolveColor(op.outline, profile),
          lineWidth: op.lineWidth ?? 4,
        });
        break;
      }
      case 'grass':
        grassStroke(
          g,
          rng,
          op.x,
          op.baseY,
          op.height,
          op.lean,
          op.width,
          resolveColor(op.color, profile) ?? SAGE.mid,
        );
        break;
      case 'halo': {
        const halo = g.createRadialGradient(op.cx, op.cy, 6, op.cx, op.cy, op.r);
        halo.addColorStop(0, LAMP_WARM);
        halo.addColorStop(1, 'rgba(233, 196, 124, 0)');
        g.fillStyle = halo;
        g.fillRect(op.cx - op.r, op.cy - op.r, op.r * 2, op.r * 2);
        break;
      }
      case 'speckle':
        speckleOp(g, rng, op, resolveColor(op.color, profile) ?? INK.grain);
        break;
    }
  }
  return { canvas: c, aspect: w / h };
}

function roundedRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function speckleOp(
  g: CanvasRenderingContext2D,
  rng: Rng,
  op: Extract<SpriteOp, { op: 'speckle' }>,
  color: string,
): void {
  g.save();
  g.fillStyle = color;
  for (let i = 0; i < op.count; i++) {
    g.globalAlpha = (op.alpha ?? 0.1) * (0.4 + rng.next() * 0.6);
    const r = 0.4 + rng.next() * (op.maxR ?? 1.6);
    g.beginPath();
    g.arc(op.x + rng.next() * op.w, op.y + rng.next() * op.h, r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
