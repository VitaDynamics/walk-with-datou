import type { ZoneId } from '../zones';
import { assetUrl } from '../assets/ModelLoader';
import type { ItemCategory, ItemKind } from './types';
import type { Verb } from './verbs';

/**
 * Loader for the generated GLB asset manifest (public/assetManifest.json,
 * produced by scripts/gen-manifest.mjs). The manifest is the data-driven path to
 * ~1000 kinds: the build script walks the public/models GLB files and emits one
 * entry per file, merging category defaults with per-asset overrides. The
 * runtime just maps each entry into an ItemKind — no hand-authored TS per model.
 */

/** One manifest entry as emitted by gen-manifest.mjs. */
export interface ManifestEntry {
  id: string;
  name: string;
  category: ItemCategory;
  /** public/-relative path, e.g. "models/toy/ball.glb". */
  modelPath: string;
  license: 'CC0';
  footprintRadius: number;
  blocking: boolean;
  minorCollider?: boolean;
  interactable: boolean;
  verbs: Verb[];
  zones: ZoneId[];
  spawnWeight: number;
  scaleRange: [number, number];
  mass?: number;
  collider?: number;
  persistent?: boolean;
}

export interface AssetManifest {
  version: number;
  entries: ManifestEntry[];
}

/** Map a manifest entry to a runtime ItemKind (gltf mesh source, resolved url). */
export function entryToKind(e: ManifestEntry): ItemKind {
  return {
    id: e.id,
    name: e.name,
    category: e.category,
    mesh: { kind: 'gltf', url: assetUrl(e.modelPath) },
    footprintRadius: e.footprintRadius,
    blocking: e.blocking,
    minorCollider: e.minorCollider,
    interactable: e.interactable,
    verbs: new Set<Verb>(e.verbs),
    zones: e.zones,
    spawnWeight: e.spawnWeight,
    scaleRange: e.scaleRange,
    mass: e.mass,
    collider: e.collider,
    persistent: e.persistent,
    license: e.license,
  };
}

/**
 * Fetch + parse the GLB manifest into ItemKinds. Returns [] (not throw) if the
 * manifest is absent — the game must run with only procedural props when no
 * assets have been fetched yet (the seed-set / fetch:assets step is optional).
 */
export async function loadManifestKinds(url = assetUrl('assetManifest.json')): Promise<ItemKind[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const manifest = (await res.json()) as AssetManifest;
    if (!manifest || !Array.isArray(manifest.entries)) return [];
    return manifest.entries.map(entryToKind);
  } catch {
    return [];
  }
}
