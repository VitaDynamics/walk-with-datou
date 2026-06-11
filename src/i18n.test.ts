import { describe, expect, it } from 'vitest';
import { __tables, t } from './i18n';
import { MAJOR_PROPS, SPOT_ANCHORS } from './world/layout';
import { SETPIECES } from './world/setpieces';
import { ORCHARD_TREES, VEG_ROWS } from './world/orchard';
import { KIND_DEFS } from './world/scatter';
import { NODE_DEFS } from './game/workshop/nodes';
import { BOND_UNLOCKS } from './game/Bond';

const ART_KINDS = ['sprout', 'shiny', 'feather', 'mushroom', 'ladybug'] as const;
const WANT_KINDS = ['attention', 'play', 'curious'] as const;
const MOODS = ['happy', 'calm', 'curious', 'tired'] as const;

describe('i18n tables', () => {
  it('every UI key exists in both locales', () => {
    const en = Object.keys(__tables.UI.en).sort();
    const zh = Object.keys(__tables.UI.zh).sort();
    expect(zh).toEqual(en);
  });

  it('no locale string is empty', () => {
    for (const lang of ['en', 'zh'] as const) {
      for (const [key, value] of Object.entries(__tables.UI[lang])) {
        expect(value, `${lang}:${key}`).not.toBe('');
      }
    }
  });

  it('covers every discovery thing, hiding place, want, milestone, and mood', () => {
    const en = __tables.UI.en as Record<string, string>;
    for (const art of ART_KINDS) expect(en[`thing.${art}`], `thing.${art}`).toBeDefined();
    for (const a of SPOT_ANCHORS) expect(en[`place.${a.place}`], `place.${a.place}`).toBeDefined();
    for (const w of WANT_KINDS) {
      expect(en[`want.${w}`], `want.${w}`).toBeDefined();
      expect(en[`memory.want.${w}`], `memory.want.${w}`).toBeDefined();
    }
    for (const u of BOND_UNLOCKS)
      expect(en[`milestone.${u.id}`], `milestone.${u.id}`).toBeDefined();
    for (const m of MOODS) expect(en[`mood.${m}`], `mood.${m}`).toBeDefined();
  });

  it('covers every setpiece: name, both lines, memory (E2)', () => {
    const en = __tables.UI.en as Record<string, string>;
    for (const sp of SETPIECES) {
      expect(en[`setpiece.${sp.id}.name`], `setpiece.${sp.id}.name`).toBeDefined();
      expect(en[`setpiece.${sp.id}.line.1`], `setpiece.${sp.id}.line.1`).toBeDefined();
      expect(en[`setpiece.${sp.id}.line.2`], `setpiece.${sp.id}.line.2`).toBeDefined();
      expect(en[`memory.setpiece.${sp.id}`], `memory.setpiece.${sp.id}`).toBeDefined();
    }
  });

  it('covers the orchard: trees, rows, food things and materials (E4)', () => {
    const en = __tables.UI.en as Record<string, string>;
    for (const tree of ORCHARD_TREES) {
      expect(en[`orchard.tree.${tree.kind}`], `orchard.tree.${tree.kind}`).toBeDefined();
    }
    for (const row of VEG_ROWS) {
      expect(en[`orchard.row.${row.kind}`], `orchard.row.${row.kind}`).toBeDefined();
    }
    for (const food of ['apple', 'pear', 'plum', 'pumpkin', 'turnip', 'carrot']) {
      expect(en[`thing.${food}`], `thing.${food}`).toBeDefined();
      expect(en[`material.${food}`], `material.${food}`).toBeDefined();
    }
  });

  it('covers every critter: name, tap line, resident memory (E5)', () => {
    const en = __tables.UI.en as Record<string, string>;
    for (const kind of ['bird', 'butterfly', 'duck', 'squirrel', 'dog'] as const) {
      expect(en[`critter.${kind}`], `critter.${kind}`).toBeDefined();
      expect(en[`critter.${kind}.line`], `critter.${kind}.line`).toBeDefined();
      expect(en[`memory.want.critter.${kind}`], `memory.want.critter.${kind}`).toBeDefined();
    }
    expect(en['critter.cat']).toBeDefined();
    expect(en['critter.cat.line.1']).toBeDefined();
    expect(en['critter.cat.line.2']).toBeDefined();
    expect(en['memory.want.critter.cat']).toBeDefined();
    expect(en['critter.gift']).toBeDefined();
    expect(en['thing.acorn']).toBeDefined();
  });

  it('names every touchable prop and resource node (E1)', () => {
    const en = __tables.UI.en as Record<string, string>;
    const kinds = new Set<string>();
    for (const k of KIND_DEFS) if (!k.pickable && k.verb !== 'none') kinds.add(k.kind);
    for (const m of MAJOR_PROPS) kinds.add(m.kind);
    for (const kind of kinds) {
      expect(en[`prop.${kind}`], `prop.${kind}`).toBeDefined();
      expect(en[`obs.${kind}.1`], `obs.${kind}.1`).toBeDefined();
      expect(en[`obs.${kind}.2`], `obs.${kind}.2`).toBeDefined();
    }
    for (const type of Object.keys(NODE_DEFS)) {
      expect(en[`node.name.${type}`], `node.name.${type}`).toBeDefined();
      expect(en[`node.line.${type}`], `node.line.${type}`).toBeDefined();
    }
  });

  it('interpolates {vars}', () => {
    expect(t('console.foundToday', { n: '2', total: '5' })).toContain('2/5');
  });
});
