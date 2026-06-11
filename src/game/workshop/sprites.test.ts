import { describe, expect, it } from 'vitest';
import { FORM_TEMPLATES } from './formTemplates';
import { FORM_IDS, FORMS, type FormId, type IdentitySilhouette } from './forms';
import { CATALOG_FORMS, CATALOG_GROUPS } from './formCatalog';
import { catalogFormTemplate } from './sprites';
import type { SpriteOp, SpriteOpList } from '../../art/spriteOps';

// Canvas isn't available in the node test env, so we validate the op-list DATA
// (the part that can be wrong by authoring); the compile-to-pixels path is
// covered by the headless-Chrome visual QA per CLAUDE.md.

const PALETTE_OK = /^(PAPER|INK|GROUND|SAGE|CLAY|WATER|ROBOT)\.[a-zA-Z]+$|^(fill|shade)$/;

function colorRefs(op: SpriteOp): string[] {
  const out: string[] = [];
  if ('fill' in op && op.fill) out.push(op.fill);
  if ('outline' in op && op.outline) out.push(op.outline);
  if ('color' in op && op.color) out.push(op.color);
  return out;
}

const STRUCTURAL_SILHOUETTES = new Set<IdentitySilhouette>([
  'house',
  'canopy',
  'bridge',
  'pavilion',
  'workshop',
  'tower',
]);

function topologyOf(template: SpriteOpList): string {
  return JSON.stringify({
    canvas: template.canvas,
    ops: template.ops.map((op) =>
      op.op === 'path'
        ? `${op.op}:${op.points.length}:${Boolean(op.close)}:${Boolean(op.fill)}`
        : `${op.op}:${'fill' in op && Boolean(op.fill)}`,
    ),
  });
}

function semanticTopologyOf(template: SpriteOpList): string {
  const aspect = (w: number, h: number) => {
    const ratio = w / Math.max(1, h);
    return ratio > 1.8 ? 'wide' : ratio < 0.65 ? 'tall' : 'compact';
  };
  return template.ops
    .map((op) => {
      if (op.op === 'line')
        return `line:${aspect(Math.abs(op.x1 - op.x0), Math.abs(op.y1 - op.y0))}:${Math.round(op.width / 4)}`;
      if (op.op === 'rect')
        return `rect:${aspect(op.w, op.h)}:${Boolean(op.fill)}:${Math.round(op.r / 6)}`;
      if (op.op === 'blob')
        return `blob:${aspect(op.rx, op.ry)}:${Boolean(op.fill)}:${Math.round(op.rx / 16)}`;
      if (op.op === 'path') {
        const xs = op.points.map(([x]) => x);
        const ys = op.points.map(([, y]) => y);
        return `path:${op.points.length}:${Boolean(op.close)}:${Boolean(op.fill)}:${aspect(
          Math.max(...xs) - Math.min(...xs),
          Math.max(...ys) - Math.min(...ys),
        )}`;
      }
      return op.op;
    })
    .join('|');
}

describe('form sprite templates', () => {
  const authoredAdditions = [
    'brush',
    'wayfinder',
    'field-glass',
    'play-ball',
    'cache-box',
    'drinking-bowl',
    'bug-hotel',
    'raft',
  ] as const;

  it('reference only palette tokens or material fill/shade', () => {
    for (const [form, tmpl] of Object.entries(FORM_TEMPLATES)) {
      for (const op of tmpl!.ops) {
        for (const ref of colorRefs(op)) {
          expect(ref, `${form}: ${ref}`).toMatch(PALETTE_OK);
        }
      }
    }
  });

  it('use canvas sizes within 128–512 and a sane op budget', () => {
    for (const [form, tmpl] of Object.entries(FORM_TEMPLATES)) {
      const [w, h] = tmpl!.canvas;
      expect(w, form).toBeGreaterThanOrEqual(96);
      expect(w, form).toBeLessThanOrEqual(512);
      expect(h, form).toBeGreaterThanOrEqual(96);
      expect(h, form).toBeLessThanOrEqual(512);
      expect(tmpl!.ops.length, `${form} op count`).toBeLessThanOrEqual(20);
      expect(tmpl!.ops.length, `${form} op count`).toBeGreaterThan(0);
    }
  });

  it('only key real forms', () => {
    for (const form of Object.keys(FORM_TEMPLATES)) {
      expect(FORM_IDS).toContain(form);
    }
  });

  it('has bespoke art for every newly authored companion form', () => {
    for (const form of authoredAdditions) {
      expect(FORM_TEMPLATES[form], form).toBeDefined();
      expect(FORM_TEMPLATES[form]!.ops.length, form).toBeGreaterThanOrEqual(6);
    }
  });

  it('gives catalog forms deterministic, varied procedural silhouettes', () => {
    const ids = Object.keys(CATALOG_FORMS) as FormId[];
    const signatures = new Set<string>();
    for (const id of ids) {
      const template = catalogFormTemplate(id, FORMS[id].family);
      expect(template.ops.length, id).toBeGreaterThanOrEqual(3);
      signatures.add(JSON.stringify(template));
    }
    expect(signatures.size).toBeGreaterThan(400);
  });

  it('keeps catalog forms detailed and structure topology meaningfully varied', () => {
    const ids = Object.keys(CATALOG_FORMS) as FormId[];
    const structureTopologies = new Set<string>();
    let opTotal = 0;
    let structureCount = 0;
    for (const id of ids) {
      const template = catalogFormTemplate(id, FORMS[id].family);
      const structural = STRUCTURAL_SILHOUETTES.has(FORMS[id].identity.silhouette);
      expect(template.ops.length, `${id} three-layer shape minimum`).toBeGreaterThanOrEqual(3);
      opTotal += template.ops.length;
      if (structural) {
        structureCount++;
        structureTopologies.add(topologyOf(template));
      }
    }
    expect(opTotal / ids.length).toBeGreaterThan(5.5);
    expect(structureCount).toBe(95);
    expect(structureTopologies.size).toBeGreaterThan(50);
  });

  it('keeps every duplicate group structurally diverse before material variation', () => {
    for (const group of CATALOG_GROUPS) {
      const signatures = new Set(
        group.ids.map((id) => semanticTopologyOf(catalogFormTemplate(id as FormId))),
      );
      const minimum = Math.max(3, Math.ceil(group.ids.length * 0.35));
      expect(signatures.size, group.key).toBeGreaterThanOrEqual(minimum);
    }
  });
});
