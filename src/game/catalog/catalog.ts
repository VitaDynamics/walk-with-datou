import type { ZoneId } from '../zones';
import { PROCEDURAL_KINDS } from './proceduralKinds';
import type { ItemCategory, ItemKind } from './types';

/**
 * The item-catalog registry. Holds every ItemKind (procedural + GLB), keyed by
 * id, with pre-bucketed indexes by zone and category so the scatter (scatter.ts)
 * iterates per-zone buckets rather than the full ~1000 each placement pass.
 *
 * Construction is synchronous and seeded only by data, so the catalog (and thus
 * deterministic placement + colliders) is available before any GLB resolves;
 * GLB kinds are merged in once the manifest has been fetched (Game wires this).
 */
export class Catalog {
  private readonly byId = new Map<string, ItemKind>();
  private readonly byZoneIdx = new Map<ZoneId, ItemKind[]>();
  private readonly byCategoryIdx = new Map<ItemCategory, ItemKind[]>();
  private readonly all: ItemKind[] = [];

  constructor(kinds: readonly ItemKind[] = PROCEDURAL_KINDS) {
    for (const k of kinds) this.add(k);
  }

  /** Register a kind. Throws on duplicate id (catalog integrity). */
  add(kind: ItemKind): void {
    if (this.byId.has(kind.id)) {
      throw new Error(`Catalog: duplicate item id "${kind.id}"`);
    }
    this.byId.set(kind.id, kind);
    this.all.push(kind);

    const cat = this.byCategoryIdx.get(kind.category) ?? [];
    cat.push(kind);
    this.byCategoryIdx.set(kind.category, cat);

    // Index under every eligible zone. Empty zones[] = any land zone, so index
    // it under all four so per-zone scatter sees it everywhere.
    const zones: ZoneId[] = kind.zones.length ? [...kind.zones] : ALL_ZONES;
    for (const z of zones) {
      const arr = this.byZoneIdx.get(z) ?? [];
      arr.push(kind);
      this.byZoneIdx.set(z, arr);
    }
  }

  /** Merge a batch of kinds (e.g. GLB kinds from the manifest). */
  addAll(kinds: readonly ItemKind[]): void {
    for (const k of kinds) this.add(k);
  }

  get(id: string): ItemKind | undefined {
    return this.byId.get(id);
  }

  size(): number {
    return this.all.length;
  }

  list(): readonly ItemKind[] {
    return this.all;
  }

  byZone(zone: ZoneId): readonly ItemKind[] {
    return this.byZoneIdx.get(zone) ?? [];
  }

  byCategory(cat: ItemCategory): readonly ItemKind[] {
    return this.byCategoryIdx.get(cat) ?? [];
  }

  interactable(): ItemKind[] {
    return this.all.filter((k) => k.interactable);
  }

  /** Kinds eligible for automatic seeded scatter (spawnWeight > 0). */
  scatterable(): ItemKind[] {
    return this.all.filter((k) => k.spawnWeight > 0);
  }
}

const ALL_ZONES: ZoneId[] = ['meadow', 'woods', 'lake', 'grove'];

/**
 * Validate catalog integrity. Returns a list of problems (empty = ok). Used by
 * catalog.test.ts and callable at startup in dev to fail fast on a bad manifest.
 */
export function validateCatalog(kinds: readonly ItemKind[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const k of kinds) {
    if (seen.has(k.id)) problems.push(`duplicate id: ${k.id}`);
    seen.add(k.id);
    if (k.interactable && k.verbs.size === 0) {
      problems.push(`${k.id}: interactable but has no verbs`);
    }
    if (!k.interactable && k.verbs.size > 0) {
      problems.push(`${k.id}: has verbs but is not interactable`);
    }
    if (k.mesh.kind === 'gltf' && !k.mesh.url) {
      problems.push(`${k.id}: gltf mesh with empty url`);
    }
    if (k.footprintRadius < 0) problems.push(`${k.id}: negative footprintRadius`);
    if (k.minorCollider && !k.blocking) {
      problems.push(`${k.id}: minorCollider set but not blocking`);
    }
    if (k.scaleRange[0] <= 0 || k.scaleRange[1] < k.scaleRange[0]) {
      problems.push(`${k.id}: invalid scaleRange`);
    }
    if (k.license !== 'CC0' && k.license !== 'procedural') {
      problems.push(`${k.id}: non-CC0 license "${k.license}"`);
    }
  }
  return problems;
}
