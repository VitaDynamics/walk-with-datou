/**
 * Tools — same grammar, gate the nodes (BUILDING_SYSTEM §8.2).
 *
 * Tools are just forms (`axe | pickaxe | shears | scoop`) discovered on the
 * bench like everything else. Their MATERIAL sets the tier (Terraria-style):
 * wooden t1, flint t2, machined (old-bolt) t3 — higher tier reaches more node
 * types and yields more. Soft durability: a tool dulls after ~30 swings
 * (−50% yield) and a single pebble at the bench re-sharpens it; tools never
 * break. Pure logic; the equipped tool + dullness live in `wwd.tools` (§9).
 */

import { parseItemId, type ItemId } from './items';
import type { MaterialId } from './materials';
import { FORMS, type FormId } from './forms';

export type ToolKind = 'axe' | 'pickaxe' | 'shears' | 'scoop';
export type ToolTier = 1 | 2 | 3;

export const DULL_AFTER = 30; // swings before a tool dulls (§8.2)
export const DULL_YIELD_MULT = 0.5;

/** Is this form id a tool? */
export function isToolForm(form: string): form is ToolKind {
  return form in FORMS && FORMS[form as FormId].family === 'tool';
}

/** A tool item's tier, from its material (§8.2). */
export function toolTier(material: MaterialId): ToolTier {
  if (material === 'old-bolt') return 3;
  if (material === 'flint') return 2;
  // Everything else a tool can be made from (wood, plain stone) is t1.
  return 1;
}

export interface ToolInfo {
  id: ItemId;
  kind: ToolKind;
  tier: ToolTier;
  material: MaterialId;
}

/** Parse a tool ItemId into kind/tier, or null if it isn't a tool. */
export function toolInfo(id: ItemId): ToolInfo | null {
  const spec = parseItemId(id);
  if (!spec || !isToolForm(spec.form)) return null;
  return { id, kind: spec.form, tier: toolTier(spec.material), material: spec.material };
}

/** Yield multiplier from tier (§8.2: t2 ~1.5×, t3 ~2×). */
export function tierYieldMult(tier: ToolTier): number {
  return tier === 3 ? 2 : tier === 2 ? 1.5 : 1;
}

interface SavedTools {
  equipped: ItemId | null;
  dullness: Record<ItemId, number>; // swings since last sharpen
}

const KEY = 'wwd.tools';

export class Tools {
  private equipped: ItemId | null = null;
  private dullness = new Map<ItemId, number>();
  private readonly listeners = new Set<() => void>();
  private readonly storageKey: string;

  constructor(storageKey = KEY) {
    this.storageKey = storageKey;
    this.load();
  }

  equippedTool(): ToolInfo | null {
    return this.equipped ? toolInfo(this.equipped) : null;
  }

  equip(id: ItemId | null): void {
    if (id && !toolInfo(id)) return; // not a tool
    this.equipped = id;
    this.save();
  }

  /** Is the equipped tool dulled (≥ DULL_AFTER swings since sharpening)? */
  isDull(id: ItemId): boolean {
    return (this.dullness.get(id) ?? 0) >= DULL_AFTER;
  }

  /** Record one work swing on a tool (advances dullness). */
  swing(id: ItemId): void {
    this.dullness.set(id, (this.dullness.get(id) ?? 0) + 1);
    this.save();
  }

  /** Re-sharpen a tool (a pebble at the bench) — instant, never breaks (§8.2). */
  sharpen(id: ItemId): void {
    this.dullness.set(id, 0);
    this.save();
  }

  /** The effective yield multiplier of the equipped tool right now. */
  yieldMultiplier(id: ItemId): number {
    const info = toolInfo(id);
    if (!info) return 0;
    return tierYieldMult(info.tier) * (this.isDull(id) ? DULL_YIELD_MULT : 1);
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private save(): void {
    const data: SavedTools = {
      equipped: this.equipped,
      dullness: Object.fromEntries(this.dullness),
    };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // Session-only.
    }
    for (const fn of this.listeners) fn();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<SavedTools>;
      if (typeof d.equipped === 'string' || d.equipped === null) this.equipped = d.equipped;
      if (d.dullness) this.dullness = new Map(Object.entries(d.dullness));
    } catch {
      // Corrupt save — start fresh.
    }
  }
}

/** Can a tool of this kind+tier work a node needing `needKind`/`needTier`? */
export function canWork(
  tool: ToolInfo | null,
  needKind: ToolKind,
  needTier: ToolTier,
): boolean {
  if (!tool) return false;
  if (tool.kind !== needKind) return false;
  return tool.tier >= needTier;
}
