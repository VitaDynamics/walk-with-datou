#!/usr/bin/env node
/**
 * Generate public/assetManifest.json from the GLB files under public/models/
 * (Phase 5). This is the ONLY place the ~1000-kind catalog scales: drop a GLB
 * into public/models/<category>/ (via fetch-assets.mjs) and re-run this — no
 * hand-authored TypeScript per model.
 *
 * For each `public/models/<category>/<id>.glb` it emits one ManifestEntry,
 * merging:
 *   1. CATEGORY_DEFAULTS[category]  — verbs / blocking / footprint / zones / etc.
 *   2. public/models/<category>/_overrides.json  — per-id tweaks (optional)
 *
 * Licensing: every entry is tagged CC0 (the only license fetch-assets pulls).
 * If you wire in a non-CC0 source, add real license tracking here and FAIL on
 * anything that isn't CC0 — the runtime/catalog assume CC0 throughout.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS_DIR = join(ROOT, 'public', 'models');
const OUT = join(ROOT, 'public', 'assetManifest.json');

/**
 * Per-category defaults. Verbs are *behaviours* (MovableProps/Interaction own
 * them); a category just declares which its items support. `blocking` /
 * `footprintRadius` / `zones` / `spawnWeight` tune scatter + collision.
 *
 * Interactable categories (toys/food/collectibles/containers) declare the
 * movable verbs so they become live MovableProps; decorative ones (tree/rock/
 * infrastructure) are static dressing.
 */
const CATEGORY_DEFAULTS = {
  tree: {
    blocking: true,
    footprintRadius: 0.6,
    interactable: false,
    verbs: [],
    zones: ['woods', 'grove'],
    spawnWeight: 0.6,
    scaleRange: [0.8, 1.4],
  },
  shrub: {
    blocking: false,
    footprintRadius: 0,
    interactable: true,
    verbs: ['sniff'],
    zones: [],
    spawnWeight: 1,
    scaleRange: [0.8, 1.4],
  },
  flower: {
    blocking: false,
    footprintRadius: 0,
    interactable: true,
    verbs: ['sniff', 'carry'],
    zones: ['meadow', 'grove'],
    spawnWeight: 2,
    scaleRange: [0.7, 1.3],
  },
  grass: {
    blocking: false,
    footprintRadius: 0,
    interactable: true,
    verbs: ['sniff'],
    zones: [],
    spawnWeight: 2,
    scaleRange: [0.8, 1.6],
  },
  fern: {
    blocking: false,
    footprintRadius: 0,
    interactable: true,
    verbs: ['sniff'],
    zones: ['woods'],
    spawnWeight: 1.5,
    scaleRange: [0.8, 1.4],
  },
  mushroom: {
    blocking: true,
    minorCollider: true,
    footprintRadius: 0.25,
    interactable: true,
    verbs: ['sniff', 'breakScatter'],
    zones: ['woods'],
    spawnWeight: 0.8,
    scaleRange: [0.8, 1.3],
  },
  vine: {
    blocking: false,
    footprintRadius: 0,
    interactable: false,
    verbs: [],
    zones: ['woods'],
    spawnWeight: 0.3,
    scaleRange: [0.9, 1.2],
  },
  crop: {
    blocking: false,
    footprintRadius: 0,
    interactable: true,
    verbs: ['eat', 'carry'],
    zones: ['meadow'],
    spawnWeight: 0.5,
    scaleRange: [0.9, 1.1],
  },
  rock: {
    blocking: true,
    footprintRadius: 0.5,
    interactable: false,
    verbs: [],
    zones: [],
    spawnWeight: 0.8,
    scaleRange: [0.5, 1.6],
  },
  log: {
    blocking: true,
    footprintRadius: 0.9,
    interactable: false,
    verbs: [],
    zones: ['woods', 'grove'],
    spawnWeight: 0.3,
    scaleRange: [0.8, 1.2],
  },
  terrain: {
    blocking: false,
    footprintRadius: 0,
    interactable: false,
    verbs: [],
    zones: [],
    spawnWeight: 0.5,
    scaleRange: [0.8, 1.4],
  },
  water: {
    blocking: false,
    footprintRadius: 0,
    interactable: false,
    verbs: [],
    zones: ['lake'],
    spawnWeight: 0.6,
    scaleRange: [0.8, 1.3],
  },
  infrastructure: {
    blocking: true,
    footprintRadius: 0.5,
    interactable: false,
    verbs: [],
    zones: [],
    spawnWeight: 0.15,
    scaleRange: [0.9, 1.1],
  },
  play: {
    blocking: true,
    footprintRadius: 0.6,
    interactable: false,
    verbs: [],
    zones: ['grove', 'meadow'],
    spawnWeight: 0.12,
    scaleRange: [0.9, 1.1],
  },
  animal: {
    blocking: false,
    footprintRadius: 0.3,
    interactable: true,
    verbs: ['watch'],
    zones: [],
    spawnWeight: 0.4,
    scaleRange: [0.9, 1.1],
  },
  food: {
    blocking: false,
    footprintRadius: 0.2,
    interactable: true,
    verbs: ['eat', 'carry', 'throw', 'push'],
    zones: ['meadow'],
    spawnWeight: 0.3,
    scaleRange: [0.9, 1.1],
    mass: 0.5,
  },
  toy: {
    blocking: false,
    footprintRadius: 0.2,
    interactable: true,
    verbs: ['carry', 'throw', 'push'],
    zones: [],
    spawnWeight: 0.4,
    scaleRange: [0.9, 1.1],
    mass: 0.4,
  },
  tool: {
    blocking: false,
    footprintRadius: 0.25,
    interactable: true,
    verbs: ['carry', 'use', 'push'],
    zones: [],
    spawnWeight: 0.2,
    scaleRange: [0.9, 1.1],
    mass: 0.8,
  },
  decor: {
    blocking: false,
    footprintRadius: 0.3,
    interactable: true,
    verbs: ['knockOver', 'push'],
    zones: [],
    spawnWeight: 0.3,
    scaleRange: [0.9, 1.2],
    mass: 1,
  },
  collectible: {
    blocking: false,
    footprintRadius: 0.15,
    interactable: true,
    verbs: ['carry'],
    zones: [],
    spawnWeight: 0.6,
    scaleRange: [0.8, 1.2],
    mass: 0.3,
  },
  seasonal: {
    blocking: false,
    footprintRadius: 0.3,
    interactable: true,
    verbs: ['push', 'breakScatter'],
    zones: [],
    spawnWeight: 0.3,
    scaleRange: [0.9, 1.2],
    mass: 0.8,
  },
  ambient: {
    blocking: false,
    footprintRadius: 0,
    interactable: false,
    verbs: [],
    zones: [],
    spawnWeight: 0.2,
    scaleRange: [0.9, 1.1],
  },
  container: {
    blocking: true,
    footprintRadius: 0.4,
    interactable: true,
    verbs: ['push', 'knockOver', 'breakScatter'],
    zones: [],
    spawnWeight: 0.2,
    scaleRange: [0.9, 1.1],
    mass: 2,
  },
};

function titleCase(stem) {
  return stem.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function readOverrides(catDir) {
  const f = join(catDir, '_overrides.json');
  if (!existsSync(f)) return {};
  try {
    return JSON.parse(await readFile(f, 'utf8'));
  } catch (err) {
    console.warn(`[gen-manifest] bad _overrides.json in ${catDir}: ${err.message}`);
    return {};
  }
}

async function main() {
  if (!existsSync(MODELS_DIR)) {
    console.error('[gen-manifest] public/models/ does not exist — run fetch:assets first.');
    process.exit(1);
  }

  const entries = [];
  const seenIds = new Set();
  const problems = [];

  const categories = (await readdir(MODELS_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const category of categories) {
    const defaults = CATEGORY_DEFAULTS[category];
    if (!defaults) {
      problems.push(`unknown category folder "${category}" (no CATEGORY_DEFAULTS)`);
      continue;
    }
    const catDir = join(MODELS_DIR, category);
    const overrides = await readOverrides(catDir);
    const files = (await readdir(catDir)).filter((f) => f.endsWith('.glb'));

    for (const file of files) {
      const id = basename(file, '.glb');
      if (seenIds.has(id)) {
        problems.push(`duplicate id "${id}" (in ${category})`);
        continue;
      }
      seenIds.add(id);

      const ov = overrides[id] ?? {};
      const verbs = ov.verbs ?? defaults.verbs;
      const interactable = ov.interactable ?? defaults.interactable;
      const entry = {
        id,
        name: ov.name ?? titleCase(id),
        category,
        modelPath: `models/${category}/${file}`,
        license: 'CC0',
        footprintRadius: ov.footprintRadius ?? defaults.footprintRadius,
        blocking: ov.blocking ?? defaults.blocking,
        ...(defaults.minorCollider || ov.minorCollider ? { minorCollider: true } : {}),
        interactable,
        verbs: interactable ? verbs : [],
        zones: ov.zones ?? defaults.zones,
        spawnWeight: ov.spawnWeight ?? defaults.spawnWeight,
        scaleRange: ov.scaleRange ?? defaults.scaleRange,
        ...((ov.mass ?? defaults.mass) ? { mass: ov.mass ?? defaults.mass } : {}),
        ...(ov.collider !== undefined ? { collider: ov.collider } : {}),
        ...(ov.persistent ? { persistent: true } : {}),
      };

      // License gate: this pipeline is CC0-only.
      if (entry.license !== 'CC0') {
        problems.push(`${id}: non-CC0 license`);
        continue;
      }
      entries.push(entry);
    }
  }

  if (problems.length) {
    console.error('[gen-manifest] problems:\n  ' + problems.join('\n  '));
    if (entries.length === 0) process.exit(1);
  }

  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const manifest = { version: 1, entries };
  await writeFile(OUT, JSON.stringify(manifest, null, 2) + '\n');

  const interactableN = entries.filter((e) => e.interactable).length;
  console.log(
    `[gen-manifest] wrote ${entries.length} kinds (${interactableN} interactable) → public/assetManifest.json`,
  );
}

main().catch((err) => {
  console.error('[gen-manifest] failed:', err);
  process.exit(1);
});
