import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NODE_DEFS, NODE_PLACEMENTS, harvestState, type NodePlacement } from './nodes';
import { NodeState } from './NodeState';
import { Tools, toolInfo, toolTier, canWork, DULL_AFTER } from './tools';
import { Harvest, type HarvestActions } from './Harvest';
import { itemId } from './items';
import type { DatouState } from '../../physics/PhysicsAdapter';
import type { MaterialId } from './materials';

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
}

describe('node defs & placements', () => {
  it('every placement has a known type and a yield table', () => {
    for (const p of NODE_PLACEMENTS) {
      expect(NODE_DEFS[p.type]).toBeDefined();
      expect(NODE_DEFS[p.type].yields.length).toBeGreaterThan(0);
    }
  });

  it('harvest state tracks charge fraction', () => {
    expect(harvestState(12, 12)).toBe('full');
    expect(harvestState(4, 12)).toBe('worked');
    expect(harvestState(0, 12)).toBe('spent');
  });
});

describe('tools — tier gating & durability (§8.2)', () => {
  beforeEach(stubStorage);

  it('material sets the tier', () => {
    expect(toolTier('twig')).toBe(1);
    expect(toolTier('flint')).toBe(2);
    expect(toolTier('old-bolt')).toBe(3);
  });

  it('parses tool ids and rejects non-tools', () => {
    expect(toolInfo(itemId({ form: 'axe', material: 'flint', size: 'M', finish: 'plain' }))?.tier).toBe(2);
    expect(toolInfo(itemId({ form: 'bench', material: 'plank', size: 'M', finish: 'plain' }))).toBeNull();
  });

  it('canWork enforces kind and minimum tier', () => {
    const t1axe = toolInfo(itemId({ form: 'axe', material: 'twig', size: 'M', finish: 'plain' }));
    const t2pick = toolInfo(itemId({ form: 'pickaxe', material: 'flint', size: 'M', finish: 'plain' }));
    expect(canWork(t1axe, 'axe', 1)).toBe(true);
    expect(canWork(t1axe, 'pickaxe', 1)).toBe(false); // wrong kind
    expect(canWork(t2pick, 'pickaxe', 2)).toBe(true);
    expect(canWork(t2pick, 'pickaxe', 3)).toBe(false); // tier too low
  });

  it('dulls after ~30 swings (−50% yield) and re-sharpens instantly; never breaks', () => {
    const tools = new Tools('test.tools');
    const id = itemId({ form: 'axe', material: 'flint', size: 'M', finish: 'plain' });
    tools.equip(id);
    expect(tools.yieldMultiplier(id)).toBeCloseTo(1.5); // t2 fresh
    for (let i = 0; i < DULL_AFTER; i++) tools.swing(id);
    expect(tools.isDull(id)).toBe(true);
    expect(tools.yieldMultiplier(id)).toBeCloseTo(1.5 * 0.5);
    tools.sharpen(id);
    expect(tools.isDull(id)).toBe(false);
    expect(tools.yieldMultiplier(id)).toBeCloseTo(1.5);
  });
});

describe('node charge refresh (§8.1)', () => {
  beforeEach(stubStorage);
  const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);

  it('starts pristine, spends down, and regrows after regrowDays', () => {
    const ns = new NodeState('test.nodes');
    const id = 'tree-woods-1'; // great-tree, regrowDays 2
    const max = ns.max(id);
    expect(ns.charges(id, D(2026, 6, 10))).toBe(max);
    ns.spend(id, D(2026, 6, 10));
    expect(ns.charges(id, D(2026, 6, 10))).toBe(max - 1);
    // Same day, still worked.
    expect(ns.charges(id, D(2026, 6, 10))).toBe(max - 1);
    // After regrowDays, full again.
    expect(ns.charges(id, D(2026, 6, 13))).toBe(max);
  });
});

function stateAt(x: number, z: number): DatouState {
  return { position: { x, y: 0, z }, velocity: { x: 0, y: 0, z: 0 }, heading: 0, mood: 'calm' } as DatouState;
}

describe('Harvest work loop (§8.3)', () => {
  beforeEach(stubStorage);

  function rig(opts: { tool?: number; tired?: boolean; charges?: number } = {}) {
    let charges = opts.charges ?? 12;
    const beats: MaterialId[][] = [];
    const delivered: MaterialId[][] = [];
    const events: string[] = [];
    const actions: HarvestActions = {
      setMode: () => {},
      setTarget: () => {},
      charges: () => charges,
      spend: () => (charges = Math.max(0, charges - 1)),
      toolMultiplier: () => opts.tool ?? 1,
      swing: () => {},
      bucketCapacity: () => 6,
      tooTired: () => opts.tired ?? false,
      onBeat: (_id, g) => beats.push(g),
      onDeliver: (items) => delivered.push(items),
      onNeedTool: () => events.push('need-tool'),
      onRefuse: () => events.push('refuse'),
    };
    return { actions, beats, delivered, events };
  }

  const node: NodePlacement = { id: 'tree-woods-1', type: 'great-tree', x: 5, z: 0 };

  it('works in beats and delivers a bucket of node materials', () => {
    const r = rig({ tool: 1 });
    const h = new Harvest(r.actions);
    h.start(node, 42);
    for (let i = 0; i < 400 && r.delivered.length === 0; i++) {
      const at = h['phase'] === 'returning' ? { x: 0, z: 0 } : { x: 5, z: 0 };
      h.update(0.3, stateAt(at.x, at.z), { x: 0, z: 0 });
    }
    expect(r.beats.length).toBeGreaterThan(0);
    expect(r.delivered[0].length).toBe(6); // bucket capacity
    // Yields are great-tree materials.
    for (const m of r.delivered[0]) expect(['log', 'bark', 'twig']).toContain(m);
  });

  it('refuses heavy work when tired (care boundary)', () => {
    const r = rig({ tool: 1, tired: true });
    const h = new Harvest(r.actions);
    h.start(node, 1);
    h.update(0.3, stateAt(5, 0), { x: 0, z: 0 });
    expect(r.events).toContain('refuse');
    expect(h.active).toBe(false);
  });

  it('nudges for a tool when none is equipped', () => {
    const r = rig({ tool: 0 });
    const h = new Harvest(r.actions);
    h.start(node, 1);
    h.update(0.3, stateAt(5, 0), { x: 0, z: 0 });
    expect(r.events).toContain('need-tool');
    expect(h.active).toBe(false);
  });

  it('is deterministic — same seed yields the same haul', () => {
    const runs = [0, 1].map(() => {
      const r = rig({ tool: 1 });
      const h = new Harvest(r.actions);
      h.start(node, 99);
      for (let i = 0; i < 400 && r.delivered.length === 0; i++) {
        const at = h['phase'] === 'returning' ? { x: 0, z: 0 } : { x: 5, z: 0 };
        h.update(0.3, stateAt(at.x, at.z), { x: 0, z: 0 });
      }
      return r.delivered[0];
    });
    expect(runs[0]).toEqual(runs[1]);
  });
});
