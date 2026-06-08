# Item Catalog & GLB Asset Pipeline

**Status:** Implemented (Phases 1–5)
**Scope:** A data-driven item catalog that scales to ~1000 kinds (~500 interactable),
unifying the original procedural `THREE` props with downloadable **CC0 GLB models**,
plus the kinematic interaction engine (push/throw/carry/topple/break/use) the
gameplay docs specified.

> This is the implementation companion to `ENVIRONMENT_DESIGN.md §4.2` (object
> manipulation verbs) and `INTERACTION_VERBS.md` (creature verbs). It deliberately
> revisits the `ENVIRONMENT_DESIGN.md §9` "procedural-only" decision: procedural
> authoring cannot economically reach 1000 distinct kinds, so a GLB pipeline was
> added alongside (not replacing) the procedural props.

---

## The pieces

| Module | Role |
| --- | --- |
| `src/game/assets/ModelLoader.ts` | GLTFLoader wrapper: cache/dedupe, `prepareInstanceable` (bakes mesh world transforms into geometry, splits by material), `assetUrl`. |
| `src/game/catalog/types.ts` | `ItemKind` + `MeshSource` union — the single seam unifying procedural + GLB. |
| `src/game/catalog/verbs.ts` | The fixed `Verb` set; `MOVABLE_VERBS` / `needsMovable`. Verbs are **behaviours that live once in the engine**; a kind just declares which it supports. |
| `src/game/catalog/proceduralKinds.ts` | The original 13 props re-expressed as `ItemKind`s (no `props.ts` rewrite). |
| `src/game/catalog/manifest.ts` | Loads `public/assetManifest.json` → `ItemKind`s. |
| `src/game/catalog/catalog.ts` | The registry: id map + pre-bucketed zone/category indexes + `validateCatalog`. |
| `src/game/scatter.ts` | `scatterCatalog` — deterministic, seeded-per-id, spatial-hash overlap rejection. |
| `src/game/MovableProps.ts` | Pure-XZ kinematic prop sim (push/throw/carry/topple/break), reuses `collision.ts`. |
| `src/game/MovablePropRenderer.ts` | One Object3D per movable prop, transform rewritten each frame from state. |
| `src/game/Interaction.ts` | Nearest-eligible contextual-action resolver (one verb per frame). |
| `scripts/fetch-assets.mjs` | Download CC0 GLB packs into `public/models/<category>/`. |
| `scripts/gen-manifest.mjs` | Walk `public/models`, emit `public/assetManifest.json` (category defaults + `_overrides.json`, CC0-gated). |

The original procedural props in `props.ts` are **unchanged**; `instanced()` is reused
for GLB too, and `instancedMulti()` was added for multi-material GLB.

---

## How a kind becomes content

1. **Source the model** (CC0 only): `npm run fetch:assets` pulls GLB into
   `public/models/<category>/`. `--full` additionally pulls the full
   kenney.nl / quaternius.com packs (needs network to those hosts).
2. **Generate the manifest:** `npm run gen:manifest` writes `public/assetManifest.json`,
   merging `CATEGORY_DEFAULTS` (in the script) with an optional per-category
   `public/models/<category>/_overrides.json` (verbs/footprint/mass/zones per id).
   It **fails on any non-CC0 license**.
3. **Runtime:** `Game.start()` calls `loadManifestKinds()` → `world.mergeManifestKinds()`,
   which merges GLB kinds into the catalog, recomputes the deterministic scatter,
   refreshes colliders, and spawns movable props. The game is fully playable on
   procedural props **before** the manifest resolves (GLB pop in when ready).

To add an interactable item: drop a GLB in the right `public/models/<category>/`,
optionally add an `_overrides.json` line, re-run `gen:manifest`. **No new code** —
the ~10 verb behaviours already exist; the kind just declares its `verbs`.

---

## Determinism & colliders (the invariants)

- Placement is **seeded per kind id** (`SCATTER_SEED ^ hash(id)`), so it is
  reproducible (diary replay) and **invariant to catalog order**.
- Placement is **synchronous numbers**, computed before any GLB resolves — so
  `getParkColliders()` and interaction are available immediately; meshes pop in late.
- **Movable kinds are excluded from static colliders** (they become live
  `MovableProps`), so MuJoCo never bakes them as immovable.
- Tiny blockers are flagged `minor`, so `getPhysicsColliders()` drops them for the
  MuJoCo backend while the player still collides with the full set — the existing
  decimation seam, reused.

---

## Sources & licensing

CC0 only (public domain — no attribution, commercial OK). Default seed set comes
from GitHub-hosted Kenney CC0 starter kits (reachable from CI/sandboxes). The full
~1000-kind catalog comes from the Kenney (Nature 330 / Food 200 / Furniture 140 / …)
and Quaternius CC0 packs via `--full`. `public/models/` is git-ignored and
reproduced by `fetch:assets`; the generated manifest is committed so the catalog is
known even before assets are fetched.

---

## Tests

`catalog.test.ts`, `scatter.test.ts`, `colliders.test.ts`, `MovableProps.test.ts`,
`Interaction.test.ts`, `assets/ModelLoader.test.ts` — catalog integrity, deterministic
placement, collider generation, the kinematic integrator (no tunneling / stays in
park / throw-arc doesn't perturb XZ / topple+break auto-revert), verb resolution,
and transform baking. The in-browser GLB **render** is GPU-dependent — verify with
`npm run dev` on a machine with a GPU (console logs `[wwd] catalog: merged N GLB kinds`).
