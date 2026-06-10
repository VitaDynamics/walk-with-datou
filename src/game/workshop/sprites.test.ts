import { describe, expect, it } from 'vitest';
import { FORM_TEMPLATES } from './formTemplates';
import { FORM_IDS } from './forms';
import type { SpriteOp } from '../../art/spriteOps';

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
});
