import * as THREE from 'three';
import { Rng } from '../physics/mujoco/rng';
import {
  buildBench,
  buildBigOak,
  buildBirdbath,
  buildBridge,
  buildFallenLog,
  buildFountain,
  buildLamppost,
  buildMushroom,
  buildPicnicBlanket,
  buildSignpost,
  fernGeometry,
  grassGeometry,
  instanced,
  lilyPadGeometry,
  pineGeometry,
  reedGeometry,
  rockGeometry,
  shrubGeometry,
  type Placement,
} from './props';
import { instancedMulti } from './props';
import { placedFeatures, FEATURES } from './features';
import {
  inDeepWater,
  inPark,
  LAKE,
  LANDMARKS,
  PARK_HALF,
  zoneAt,
  ZONES,
  type ZoneId,
} from './zones';
import { Catalog } from './catalog/catalog';
import { PROCEDURAL_KINDS } from './catalog/proceduralKinds';
import type { ItemKind } from './catalog/types';
import { needsMovable } from './catalog/verbs';
import { scatterCatalog } from './scatter';
import { ModelLoader } from './assets/ModelLoader';

// PARK_HALF now lives in zones.ts (the lowest-level geometry module) to keep the
// import graph acyclic. Re-export it here so the historical `import { PARK_HALF }
// from './World'` call sites (Player.ts, tests) keep working unchanged.
export { PARK_HALF };

/** Seed for the deterministic prop/collider scatter — same seed everywhere so
 *  the visual build and getParkColliders() agree on where solid props sit. */
const SCATTER_SEED = 0x5da70;

/**
 * A solid, walk-blocking obstacle, modelled as an upright cylinder in the XZ
 * plane (height is irrelevant for ground navigation). Both the player's
 * kinematic movement and the MuJoCo scene consume the same list so the
 * collision the user sees matches the simulation. Radius is the *physical*
 * radius; callers add the mover's own radius on top.
 */
export interface Collider {
  x: number;
  z: number;
  radius: number;
  /**
   * "Minor" obstacles (small foliage like reeds and toadstools) the player
   * still pushes out of kinematically, but which are NOT emitted as MuJoCo
   * geoms. They are tiny and numerous; baking each as a static cylinder
   * roughly doubles the geom count for collisions Datou would barely notice.
   * The physics backend consumes getPhysicsColliders() (which drops these);
   * the player consumes the full getParkColliders() set, so what you bump into
   * is unchanged. See createPhysics.ts / docs/PHYSICS_INTEGRATION.md.
   */
  minor?: boolean;
}

const HOME_POST = { x: 0, z: -2, radius: 0.45 };

/** A scattered tree placement that also blocks movement (pine trunks). */
interface TreeInstance extends Placement {
  zone: ZoneId;
}

/**
 * Collider radii (the *physical* radius, before the mover's own radius is added)
 * for each solid prop type, at instance scale 1. Scaled per instance. Kept here
 * as one table so the visual build and getParkColliders() can't drift: change a
 * prop's footprint in one place. Reeds/mushrooms are small but solid enough that
 * you shouldn't walk through them (the user asked for full collision).
 */
const PROP_COLLIDER = {
  tree: 0.45, // pine trunk
  rock: 0.5, // boulder cluster core
  reed: 0.3, // reed clump
  mushroom: 0.28, // toadstool cluster
  log: 1.1, // fallen log (lies along +X; a fat circle is close enough)
  lamppost: 0.22, // lamppost pole
} as const;

/**
 * Deterministically scatter the blocking pine trees across the woods and grove
 * (the dense zones) plus a thin forest band along the park perimeter. Seeded so
 * the visual build and getParkColliders() produce the identical set — there is
 * one source of truth for what blocks movement. Trees never spawn in the open
 * meadow, on the lake, or on top of a landmark.
 */
function scatterTrees(): TreeInstance[] {
  const rng = new Rng(SCATTER_SEED);
  const trees: TreeInstance[] = [];
  const tryPlace = (x: number, z: number, zone: ZoneId, scale: number): void => {
    if (!inPark(x, z, 4)) return;
    if (inDeepWater(x, z)) return;
    // Keep the immediate home meadow open and clear of landmark footprints.
    if (Math.hypot(x, z) < 22) return;
    for (const lm of LANDMARKS) {
      if (Math.hypot(x - lm.x, z - lm.z) < 8) return;
    }
    trees.push({ x, z, yaw: rng.range(0, Math.PI * 2), scale, zone });
  };

  // Dense clusters in the woods and grove (clumped, not even — §3 "clumping").
  // Denser than before (more clusters, slightly larger) to fill the space.
  for (const zone of ZONES) {
    if (zone.id !== 'woods' && zone.id !== 'grove') continue;
    const clusters = 40;
    for (let c = 0; c < clusters; c++) {
      const ca = rng.range(0, Math.PI * 2);
      const cr = rng.range(0, zone.radius);
      const cx = zone.center.x + Math.cos(ca) * cr;
      const cz = zone.center.z + Math.sin(ca) * cr;
      const count = 4 + Math.floor(rng.range(0, 6));
      for (let i = 0; i < count; i++) {
        const x = cx + rng.range(-7, 7);
        const z = cz + rng.range(-7, 7);
        tryPlace(x, z, zone.id, rng.range(0.8, 1.5));
      }
    }
  }

  // A scattering of lone trees / small copses across the meadow + lakeside too,
  // so the connective grassland isn't bare between the dense zones.
  for (let i = 0; i < 90; i++) {
    const x = rng.range(-PARK_HALF, PARK_HALF);
    const z = rng.range(-PARK_HALF, PARK_HALF);
    tryPlace(x, z, zoneAt(x, z).id, rng.range(0.8, 1.4));
  }

  // Thin forest band around the perimeter so the edge reads as "woods get
  // thick," not "the world ends" (§1 edge treatment). Denser ring.
  const ringCount = 200;
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2;
    const r = PARK_HALF - rng.range(6, 30);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    tryPlace(x, z, zoneAt(x, z).id, rng.range(0.9, 1.6));
  }

  return trees;
}

/**
 * Deterministically scatter the solid waterside reeds: a ring around the lake
 * shore. Shared by the visual build and the collider list so a reed you see is
 * a reed you bump into. (Reeds outside the park or in deep water are skipped.)
 */
function scatterReeds(): Placement[] {
  const rng = new Rng(SCATTER_SEED ^ 0x2ee);
  const out: Placement[] = [];
  for (let i = 0; i < 320; i++) {
    const a = rng.range(0, Math.PI * 2);
    // Reeds sit just outside the deep core, on the shallow shoreline band.
    const r = rng.range(LAKE.deepRadius + 1, LAKE.radius + 6);
    const x = LAKE.center.x + Math.cos(a) * r;
    const z = LAKE.center.z + Math.sin(a) * r;
    if (!inPark(x, z, 2)) continue;
    if (inDeepWater(x, z)) continue;
    out.push({ x, z, yaw: rng.range(0, Math.PI * 2), scale: rng.range(0.7, 1.3), tint: rng.range(-1, 1) });
  }
  return out;
}

/**
 * Deterministically scatter the solid boulders: sprinkled across the park,
 * denser away from the open meadow, never in the spawn area or deep water.
 */
function scatterRocks(): Placement[] {
  const rng = new Rng(SCATTER_SEED ^ 0x70c);
  const out: Placement[] = [];
  for (let i = 0; i < 420; i++) {
    const x = rng.range(-PARK_HALF, PARK_HALF);
    const z = rng.range(-PARK_HALF, PARK_HALF);
    if (!inPark(x, z, 4) || inDeepWater(x, z)) continue;
    if (Math.hypot(x, z) < 16) continue; // keep the spawn meadow walkable
    out.push({ x, z, yaw: rng.range(0, Math.PI * 2), scale: rng.range(0.5, 1.8), tint: rng.range(-1, 1) });
  }
  return out;
}

/** A generic clear-of-colliders test against an existing placement list (so new
 *  scatters don't pile on top of trees/rocks). Cheap O(n·m) — fine for these
 *  counts at module load. */
function clearOf(x: number, z: number, taken: readonly Placement[], gap: number): boolean {
  for (const t of taken) {
    if (Math.hypot(x - t.x, z - t.z) < gap) return false;
  }
  return true;
}

/**
 * Deterministically scatter fallen logs across the woods and grove floor. Solid
 * (each gets a collider). Kept clear of tree trunks so a log doesn't bisect one.
 */
function scatterLogs(trees: readonly Placement[]): Placement[] {
  const rng = new Rng(SCATTER_SEED ^ 0x106);
  const out: Placement[] = [];
  for (let i = 0; i < 40; i++) {
    const zone = rng.next() < 0.6 ? 'woods' : 'grove';
    const z0 = ZONES.find((zz) => zz.id === zone)!;
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0, z0.radius);
    const x = z0.center.x + Math.cos(a) * r;
    const z = z0.center.z + Math.sin(a) * r;
    if (!inPark(x, z, 6) || inDeepWater(x, z)) continue;
    if (Math.hypot(x, z) < 22) continue;
    if (!clearOf(x, z, trees, 3)) continue;
    out.push({ x, z, yaw: rng.range(0, Math.PI * 2), scale: rng.range(0.8, 1.2) });
  }
  return out;
}

/**
 * Deterministically place lampposts along the trails radiating from home to
 * each landmark — warm waypoints that also read as "civilised park." Solid.
 */
function scatterLampposts(): Placement[] {
  const rng = new Rng(SCATTER_SEED ^ 0x1a3b);
  const out: Placement[] = [];
  for (const lm of LANDMARKS) {
    const len = Math.hypot(lm.x, lm.z);
    const yaw = Math.atan2(lm.x, lm.z);
    // A lamp every ~45 m along the trail, offset slightly to the side.
    for (let d = 35; d < len - 12; d += 45) {
      const side = (Math.round(d / 45) % 2 ? 1 : -1) * 3;
      const x = Math.sin(yaw) * d + Math.cos(yaw) * side;
      const z = Math.cos(yaw) * d - Math.sin(yaw) * side;
      if (!inPark(x, z, 6) || inDeepWater(x, z)) continue;
      out.push({ x, z, yaw: 0, scale: 1, tint: rng.range(-1, 1) });
    }
  }
  return out;
}

/**
 * Non-blocking flowering shrubs — instanced filler to break up open ground.
 * Scattered park-wide with a bias toward zone centres, off the water + spawn.
 */
function scatterShrubs(): Placement[] {
  const rng = new Rng(SCATTER_SEED ^ 0x5b78);
  const out: Placement[] = [];
  const push = (x: number, z: number): void => {
    if (!inPark(x, z, 3) || inDeepWater(x, z)) return;
    if (Math.hypot(x - LAKE.center.x, z - LAKE.center.z) < LAKE.radius) return;
    if (Math.hypot(x, z) < 14) return;
    out.push({ x, z, yaw: rng.range(0, Math.PI * 2), scale: rng.range(0.7, 1.6), tint: rng.range(-1, 1) });
  };
  for (let i = 0; i < 300; i++) {
    push(rng.range(-PARK_HALF, PARK_HALF), rng.range(-PARK_HALF, PARK_HALF));
  }
  for (const zone of ZONES) {
    for (let i = 0; i < 80; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = ((rng.next() + rng.next()) / 2) * zone.radius;
      push(zone.center.x + Math.cos(a) * r, zone.center.z + Math.sin(a) * r);
    }
  }
  return out;
}

/**
 * Deterministically place the woods toadstool clusters. Solid (you step around
 * them), so they're part of the shared scatter / collider set.
 */
function scatterMushrooms(): Placement[] {
  const rng = new Rng(SCATTER_SEED ^ 0xf00d);
  const out: Placement[] = [];
  const wood = ZONES.find((zz) => zz.id === 'woods')!;
  for (let i = 0; i < 18; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0, 90);
    const x = wood.center.x + Math.cos(a) * r;
    const z = wood.center.z + Math.sin(a) * r;
    if (!inPark(x, z, 4)) continue;
    out.push({ x, z, yaw: rng.range(0, Math.PI * 2), scale: 1 });
  }
  return out;
}

// Computed once at module load so getParkColliders() (called before any World
// exists) and the World visual build share the exact same scatter. Solid props
// (trees, rocks, reeds, mushrooms, logs, lampposts) are all derived here, once.
const TREES = scatterTrees();
const REEDS = scatterReeds();
const ROCKS = scatterRocks();
const MUSHROOMS = scatterMushrooms();
const LOGS = scatterLogs(TREES);
const LAMPPOSTS = scatterLampposts();
const SHRUBS = scatterShrubs(); // non-blocking filler (no collider)
const TREE_COLLIDER_BASE = PROP_COLLIDER.tree; // trunk radius before scaling

// --- Catalog layer (Phase 3) -------------------------------------------------
// The original 13 props keep their hand-tuned scatter above. The data-driven
// catalog (catalog/) adds the *extra* kinds — downloaded CC0 GLB models and any
// new catalog-only kinds — scattered deterministically by scatter.ts. The two
// never double-place: the catalog layer skips ids the legacy path already owns.
//
// Computed once at module load (like the legacy arrays) so getParkColliders()
// and the World visual build share the identical placement. Movable kinds are
// deliberately EXCLUDED from the static collider set (they become live
// MovableProps in Phase 4, so MuJoCo must not bake them as immovable).
const LEGACY_KIND_IDS = new Set(PROCEDURAL_KINDS.map((k) => k.id));

/** The shared catalog. Starts with the procedural kinds; GLB kinds are merged
 *  in by the World instance once the manifest has been fetched. */
export const catalog = new Catalog();

/** Catalog kinds the catalog *layer* is responsible for scattering — i.e. not
 *  the legacy-handled originals, and only those with spawnWeight > 0. */
function catalogScatterKinds(): ItemKind[] {
  return catalog.scatterable().filter((k) => !LEGACY_KIND_IDS.has(k.id));
}

const CATALOG_SEED_BLOCKERS = LANDMARKS.filter((l) => l.colliderRadius > 0).map((l) => ({
  x: l.x,
  z: l.z,
  r: l.colliderRadius,
}));

/** Static (non-movable) placements from the catalog layer, keyed by kind id. */
let CATALOG_STATIC = scatterCatalog(catalogScatterKinds().filter((k) => !needsMovable(k.verbs)), {
  seed: SCATTER_SEED ^ 0xca7a,
  seedBlockers: CATALOG_SEED_BLOCKERS,
});

/** Movable-kind placements from the catalog layer, keyed by kind id. These do
 *  NOT contribute static colliders — Game spawns one live MovableProp each. */
let CATALOG_MOVABLE = scatterCatalog(catalogScatterKinds().filter((k) => needsMovable(k.verbs)), {
  seed: SCATTER_SEED ^ 0x300d,
  seedBlockers: CATALOG_SEED_BLOCKERS,
});

/**
 * Recompute the catalog layer after new kinds (e.g. GLB from the manifest) have
 * been merged into the catalog. World calls this once the manifest is loaded so
 * the new kinds appear in both the collider set and the visual build. Returns
 * the static placements keyed by kind id.
 */
export function rebuildCatalogScatter(): Map<string, Placement[]> {
  CATALOG_STATIC = scatterCatalog(
    catalogScatterKinds().filter((k) => !needsMovable(k.verbs)),
    { seed: SCATTER_SEED ^ 0xca7a, seedBlockers: CATALOG_SEED_BLOCKERS },
  );
  CATALOG_MOVABLE = scatterCatalog(
    catalogScatterKinds().filter((k) => needsMovable(k.verbs)),
    { seed: SCATTER_SEED ^ 0x300d, seedBlockers: CATALOG_SEED_BLOCKERS },
  );
  return CATALOG_STATIC;
}

/** A movable-prop placement plus the catalog metadata Game needs to spawn it. */
export interface MovableSpec {
  kindId: string;
  x: number;
  z: number;
  yaw: number;
  scale: number;
  radius: number;
  mass: number;
}

/**
 * Flatten the catalog's movable-kind scatter into spawn specs. Game seeds the
 * MovableProps system from these (one live prop per placement). Deterministic:
 * derived from the same seeded scatter.
 */
export function getMovableSpecs(): MovableSpec[] {
  const specs: MovableSpec[] = [];
  for (const k of catalogScatterKinds()) {
    if (!needsMovable(k.verbs)) continue;
    const placements = CATALOG_MOVABLE.get(k.id);
    if (!placements) continue;
    const baseR = k.collider ?? k.footprintRadius;
    for (const p of placements) {
      specs.push({
        kindId: k.id,
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        scale: p.scale,
        radius: Math.max(0.1, baseR * p.scale),
        mass: k.mass ?? 1,
      });
    }
  }
  return specs;
}

/**
 * The park's solid obstacles as XZ-plane circles. Exported as a free function
 * so the physics backend can build matching colliders at init time, before any
 * World instance exists. World.getColliders() returns the same set.
 *
 * Includes: the home post, every scattered pine trunk, the landmark bases
 * (oak, bench, fountain), and a ring of blockers around the lake's deep-water
 * core so the player/Datou can't walk into the middle of the lake.
 */
export function getParkColliders(): Collider[] {
  const colliders: Collider[] = [];
  colliders.push({ x: HOME_POST.x, z: HOME_POST.z, radius: HOME_POST.radius });

  for (const t of TREES) {
    colliders.push({ x: t.x, z: t.z, radius: TREE_COLLIDER_BASE * t.scale });
  }

  // Solid scattered props — the user asked for full collision, so rocks, reeds,
  // and mushrooms all block movement (you walk around them, not through them).
  for (const r of ROCKS) {
    colliders.push({ x: r.x, z: r.z, radius: PROP_COLLIDER.rock * r.scale });
  }
  // Reeds + mushrooms are small + numerous; they block the player (kinematic
  // push-out) but are flagged `minor` so the MuJoCo backend can skip them.
  for (const r of REEDS) {
    colliders.push({ x: r.x, z: r.z, radius: PROP_COLLIDER.reed * r.scale, minor: true });
  }
  for (const m of MUSHROOMS) {
    colliders.push({ x: m.x, z: m.z, radius: PROP_COLLIDER.mushroom * m.scale, minor: true });
  }
  for (const l of LOGS) {
    colliders.push({ x: l.x, z: l.z, radius: PROP_COLLIDER.log * l.scale });
  }
  for (const l of LAMPPOSTS) {
    colliders.push({ x: l.x, z: l.z, radius: PROP_COLLIDER.lamppost });
  }

  for (const lm of LANDMARKS) {
    if (lm.colliderRadius > 0) {
      colliders.push({ x: lm.x, z: lm.z, radius: lm.colliderRadius });
    }
  }

  // Solid placed features (signpost poles, birdbath). The picnic blanket is flat
  // ground cover, so it stays walk-on-able (non-blocking).
  for (const f of placedFeatures()) {
    if (f.build === 'signpost') colliders.push({ x: f.x, z: f.z, radius: 0.25 });
    else if (f.build === 'birdbath') colliders.push({ x: f.x, z: f.z, radius: 0.55 });
  }

  // Catalog-layer blockers (downloaded GLB + new catalog kinds). Movable kinds
  // are already excluded from CATALOG_STATIC, so only static dressing blocks.
  // Tiny ones are flagged `minor` so the physics backend can drop them (the
  // player still walks around them), matching the reed/mushroom treatment.
  for (const k of catalogScatterKinds()) {
    if (!k.blocking || needsMovable(k.verbs)) continue;
    const placements = CATALOG_STATIC.get(k.id);
    if (!placements) continue;
    const baseR = k.collider ?? k.footprintRadius;
    for (const p of placements) {
      colliders.push({ x: p.x, z: p.z, radius: baseR * p.scale, minor: k.minorCollider });
    }
  }

  // Block the WHOLE visible lake, not just the deep core, so you can't wade out
  // onto the translucent water plane. We ring the shoreline at the *visual*
  // radius with overlapping circles dense enough to read as a continuous wall
  // (each circle's radius ≥ the gap between centres, so there are no squeeze-
  // through gaps). The bridge spans the lake along ±X through the centre, so we
  // leave a gap there (small |z - centre.z|) — you cross on the deck.
  const ringR = LAKE.radius;
  const bridgeHalfWidth = 1.4; // matches the bridge deck half-width
  // Spacing along the circumference ≈ 2 m; circle radius covers it with overlap.
  const ringSegments = Math.max(48, Math.ceil((2 * Math.PI * ringR) / 2));
  const segSpan = ringR * Math.sin(Math.PI / ringSegments); // half chord between centres
  for (let i = 0; i < ringSegments; i++) {
    const a = (i / ringSegments) * Math.PI * 2;
    const x = LAKE.center.x + Math.cos(a) * ringR;
    const z = LAKE.center.z + Math.sin(a) * ringR;
    // Gap where the bridge deck meets the shore on either +X / -X side.
    if (Math.abs(z - LAKE.center.z) < bridgeHalfWidth + 1) continue;
    colliders.push({ x, z, radius: segSpan + 1.0 });
  }

  return colliders;
}

/**
 * The subset of park colliders the *physics backend* should bake (everything
 * except `minor` props). The player still collides with the full set; this just
 * keeps the MuJoCo model from emitting ~hundreds of tiny reed/mushroom geoms
 * Datou would barely register, cutting model size and load time. Returns the
 * same Collider shape so the backend code is unchanged. See createPhysics.ts.
 */
export function getPhysicsColliders(): Collider[] {
  return getParkColliders().filter((c) => !c.minor);
}

/**
 * The static park scene. No game logic, just visuals + collision geometry.
 *
 * A 500×500 m park: the owner spawns near the origin (home meadow); zones
 * (woods N, lake S, grove E) radiate outward, each with its own palette, prop
 * mix, and landmark. See docs/ENVIRONMENT_DESIGN.md and zones.ts.
 */
export class World {
  readonly group = new THREE.Group();
  /** Invisible cylinder hitboxes for the named features, tagged with their
   *  feature id in userData. Game raycasts THESE (not the detailed geometry) to
   *  resolve hover/click to a feature reliably and cheaply. */
  readonly featureHitboxes = new THREE.Group();
  /** The visual mesh (Object3D) for each named feature, keyed by feature id, so
   *  the game can highlight the hovered one. Populated during build. */
  private readonly featureMeshes = new Map<string, THREE.Object3D>();
  private readonly colliders: Collider[] = getParkColliders();
  /** Foliage materials that should sway in the wind (filled during build). */
  private readonly swayMaterials: THREE.Material[] = [];
  /** Per-World GLB loader (lazy; only touched when GLB kinds exist). */
  private readonly modelLoader = new ModelLoader();
  /** Catalog-layer group, rebuilt when GLB kinds are merged in. */
  private readonly catalogGroup = new THREE.Group();

  constructor() {
    this.buildGround();
    this.buildLake();
    this.buildPath();
    this.buildHomePost();
    this.buildLandmarks();
    this.buildPlacedFeatures();
    this.buildTrees();
    this.buildFoliage();
    this.buildFlowers();
    this.buildCatalogLayer();
    this.buildFeatureHitboxes();
    this.group.add(this.featureHitboxes);
  }

  /**
   * Solid obstacles in the park as XZ-plane circles. The physics layer turns
   * these into MuJoCo geoms and the player uses them for kinematic collision,
   * so there is a single source of truth for what blocks movement.
   */
  getColliders(): readonly Collider[] {
    return this.colliders;
  }

  /** Foliage materials the wind system should animate (grass, fern, reed,
   *  pine). Game wires these into the shared Wind shader after construction. */
  getSwayMaterials(): readonly THREE.Material[] {
    return this.swayMaterials;
  }

  /** The visual mesh for a named feature (for hover highlighting), or undefined. */
  getFeatureMesh(id: string): THREE.Object3D | undefined {
    return this.featureMeshes.get(id);
  }

  /**
   * Build the catalog layer's CURRENT static placements. Procedural-kind
   * catalog instances render synchronously; GLB kinds are loaded lazily and
   * filled in when ready (so the layer is non-blocking and gameplay-deterministic
   * even before any model resolves). Idempotent: clears + rebuilds the group.
   */
  private buildCatalogLayer(): void {
    this.catalogGroup.clear();
    if (this.catalogGroup.parent !== this.group) this.group.add(this.catalogGroup);

    for (const kind of catalogScatterKinds()) {
      if (needsMovable(kind.verbs)) continue; // movable kinds are owned by MovableProps
      const placements = CATALOG_STATIC.get(kind.id);
      if (!placements || placements.length === 0) continue;
      this.instanceKind(kind, placements);
    }
  }

  /** Instance one catalog kind at its placements (procedural now, GLB on load). */
  private instanceKind(kind: ItemKind, placements: readonly Placement[]): void {
    if (kind.mesh.kind === 'procedural') {
      const { geo, mat } = kind.mesh.build();
      this.catalogGroup.add(instanced(geo, mat, [...placements], kind.blocking));
      return;
    }
    if (kind.mesh.kind === 'procedural-group') {
      // Few-count hero kinds: one Group per placement.
      for (const p of placements) {
        const obj = (kind.mesh as { build: () => THREE.Object3D }).build();
        obj.position.set(p.x, 0, p.z);
        obj.rotation.y = p.yaw;
        obj.scale.setScalar(p.scale);
        this.catalogGroup.add(obj);
      }
      return;
    }
    // GLB: load lazily, then instance one InstancedMesh per material.
    const url = kind.mesh.url;
    void this.modelLoader
      .load(url)
      .then((gltf) => {
        const parts = ModelLoader.prepareInstanceable(gltf);
        this.catalogGroup.add(instancedMulti(parts, [...placements], kind.blocking));
      })
      .catch((err) => {
        console.warn(`[world] failed to load model for "${kind.id}" (${url})`, err);
      });
  }

  /**
   * Merge GLB ItemKinds (from the asset manifest) into the catalog, recompute
   * the catalog scatter, refresh the collider set, and rebuild the visual layer.
   * Game calls this after fetching the manifest. Safe to call with [].
   */
  mergeManifestKinds(kinds: readonly ItemKind[]): void {
    if (kinds.length === 0) return;
    catalog.addAll(kinds);
    rebuildCatalogScatter();
    // Refresh the instance colliders to include the new blocking kinds.
    this.colliders.length = 0;
    this.colliders.push(...getParkColliders());
    this.buildCatalogLayer();
  }

  private buildGround(): void {
    // Flat plane spanning the whole park (heightfield terrain is deferred —
    // docs/ENVIRONMENT_DESIGN.md §3.2). Subdivided just enough to paint a soft
    // per-zone vertex-colour tint so zone transitions read on flat ground.
    const segs = 48;
    const geo = new THREE.PlaneGeometry(PARK_HALF * 2, PARK_HALF * 2, segs, segs);
    geo.rotateX(-Math.PI / 2); // lie flat; vertices now in world XZ

    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const zone = zoneAt(pos.getX(i), pos.getZ(i));
      c.set(zone.groundColor);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private buildLake(): void {
    // A cheap flat translucent water plane (§5.3 / §9 — no shader surface yet).
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(LAKE.radius, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0x4f8fc4,
        transparent: true,
        opacity: 0.82,
        flatShading: true,
      }),
    );
    water.position.set(LAKE.center.x, 0.04, LAKE.center.z);
    this.group.add(water);

    // A few lily pads near the shore.
    const lily = lilyPadGeometry();
    const pads: Placement[] = [];
    const rng = new Rng(SCATTER_SEED ^ 0x11);
    for (let i = 0; i < 24; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(LAKE.deepRadius - 6, LAKE.radius - 4);
      pads.push({
        x: LAKE.center.x + Math.cos(a) * r,
        z: LAKE.center.z + Math.sin(a) * r,
        yaw: rng.range(0, Math.PI * 2),
        scale: rng.range(0.7, 1.4),
      });
    }
    const padMesh = instanced(lily.geo, lily.mat, pads, false);
    padMesh.position.y = 0.06;
    this.group.add(padMesh);
  }

  private buildPath(): void {
    // A continuous dirt trail: the home-meadow S-curve plus trails radiating to
    // each landmark, built as small overlapping tiles so it reads as a path,
    // not stepping-stones (§1 paths). One instanced mesh keeps it cheap.
    const tiles: Placement[] = [];
    const TILE = 2.0; // tile side; spacing below is < TILE so tiles overlap

    const layTrail = (x0: number, z0: number, x1: number, z1: number, wiggle = 0): void => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const yaw = Math.atan2(x1 - x0, z1 - z0);
      const steps = Math.ceil(len / 1.5); // overlap (1.5 < 2.0)
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const perp = wiggle ? Math.sin(f * Math.PI * 3) * wiggle : 0;
        const x = x0 + (x1 - x0) * f + Math.cos(yaw) * perp;
        const z = z0 + (z1 - z0) * f - Math.sin(yaw) * perp;
        if (inDeepWater(x, z)) continue;
        tiles.push({ x, z, yaw, scale: 1 });
      }
    };

    // Trails from the home post out to each landmark, with a gentle wiggle.
    for (const lm of LANDMARKS) {
      layTrail(0, 0, lm.x, lm.z, 6);
    }

    const geo = new THREE.BoxGeometry(TILE, 0.06, TILE);
    const mat = new THREE.MeshStandardMaterial({ color: 0xc9b488, flatShading: true });
    const mesh = instanced(geo, mat, tiles, false);
    // Tiles sit just above the ground; lift the instanced mesh slightly.
    mesh.position.y = 0.03;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildHomePost(): void {
    // Grouped so it can be highlighted/registered as one named feature.
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a6a30, flatShading: true });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), mat);
    post.position.set(0, 0.6, -2);
    post.castShadow = true;
    g.add(post);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), mat);
    cap.position.set(0, 1.35, -2);
    cap.castShadow = true;
    g.add(cap);

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.4, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xf4d39a, flatShading: true }),
    );
    sign.position.set(0, 0.9, -1.8);
    sign.castShadow = true;
    g.add(sign);

    this.group.add(g);
    this.featureMeshes.set('home-post', g);
  }

  /** Place the hero landmarks — one+ "weenie" per zone (zones.ts LANDMARKS). */
  private buildLandmarks(): void {
    for (const lm of LANDMARKS) {
      let obj: THREE.Object3D;
      switch (lm.id) {
        case 'big-oak':
          obj = buildBigOak();
          break;
        case 'lookout-bench':
          obj = buildBench();
          break;
        case 'fountain':
          obj = buildFountain();
          break;
        case 'bridge':
          obj = buildBridge(LAKE.radius * 2 - 4);
          break;
        default:
          continue;
      }
      obj.position.set(lm.x, 0, lm.z);
      this.group.add(obj);
      this.featureMeshes.set(lm.id, obj);
    }
  }

  /** Build the placed dressing features (signposts, birdbath, picnic spot). The
   *  hero landmarks are built in buildLandmarks(); these are the extra named
   *  things from features.ts. */
  private buildPlacedFeatures(): void {
    for (const f of placedFeatures()) {
      let obj: THREE.Object3D;
      switch (f.build) {
        case 'signpost':
          obj = buildSignpost();
          break;
        case 'birdbath':
          obj = buildBirdbath();
          break;
        case 'picnic':
          obj = buildPicnicBlanket();
          break;
        default:
          continue;
      }
      obj.position.set(f.x, 0, f.z);
      if (f.yaw !== undefined) obj.rotation.y = f.yaw;
      this.group.add(obj);
      this.featureMeshes.set(f.id, obj);
    }
  }

  /** One invisible cylinder hitbox per named feature, tagged with its id, so
   *  the game can raycast hover/click to a feature without pixel-hunting thin
   *  geometry. Tall enough to catch a click anywhere on the object. */
  private buildFeatureHitboxes(): void {
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const f of FEATURES) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(f.hitRadius, f.hitRadius, 6, 8), hitMat);
      h.position.set(f.x, 3, f.z);
      h.userData.featureId = f.id;
      this.featureHitboxes.add(h);
    }
  }

  /** Build the blocking pine trees from the shared deterministic scatter. */
  private buildTrees(): void {
    const pine = pineGeometry();
    this.group.add(instanced(pine.geo, pine.mat, TREES));
    this.swayMaterials.push(pine.mat); // tips sway gently in the wind
  }

  /**
   * Scattered foliage. The non-blocking carpet (grass/ferns) is rolled here;
   * the *solid* props (reeds, rocks, mushrooms) come from the shared module-load
   * scatter (REEDS/ROCKS/MUSHROOMS) so what you see is exactly what blocks you
   * (getParkColliders consumes the same arrays). All instanced + per-instance
   * tinted so a field doesn't read as one flat colour.
   */
  private buildFoliage(): void {
    const rng = new Rng(SCATTER_SEED ^ 0x7c);
    const grass: Placement[] = [];
    const fern: Placement[] = [];

    // Grass + ferns. Half scattered everywhere (a light, even meadow carpet),
    // half clustered tightly around the zone centres so the "dense islands of
    // interest" read against the quieter connective grassland (§3 clumping).
    const pushBlade = (x: number, z: number, woodsFernChance: number): void => {
      if (!inPark(x, z, 2)) return;
      if (Math.hypot(x - LAKE.center.x, z - LAKE.center.z) < LAKE.radius) return; // off the water
      const zone = zoneAt(x, z);
      const place: Placement = {
        x,
        z,
        yaw: rng.range(0, Math.PI * 2),
        scale: rng.range(0.8, 1.9),
        tint: rng.range(-1, 1),
      };
      if (zone.id === 'woods' && rng.next() < woodsFernChance) fern.push(place);
      else grass.push(place);
    };

    // Even light carpet across the whole park.
    for (let i = 0; i < 1400; i++) {
      pushBlade(rng.range(-PARK_HALF, PARK_HALF), rng.range(-PARK_HALF, PARK_HALF), 0.5);
    }
    // Dense clusters around each zone centre (Gaussian-ish falloff).
    for (const zone of ZONES) {
      const n = zone.id === 'meadow' ? 900 : 650;
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, Math.PI * 2);
        // Bias toward the centre: two samples averaged → tighter clustering.
        const r = ((rng.next() + rng.next()) / 2) * zone.radius;
        pushBlade(zone.center.x + Math.cos(a) * r, zone.center.z + Math.sin(a) * r, 0.65);
      }
    }

    const g = grassGeometry();
    this.group.add(instanced(g.geo, g.mat, grass, false));
    const f = fernGeometry();
    this.group.add(instanced(f.geo, f.mat, fern, false));
    const rd = reedGeometry();
    this.group.add(instanced(rd.geo, rd.mat, REEDS, false));
    const rk = rockGeometry();
    this.group.add(instanced(rk.geo, rk.mat, ROCKS));
    const sh = shrubGeometry();
    this.group.add(instanced(sh.geo, sh.mat, SHRUBS));
    // Grass, ferns, reeds, and shrubs bend in the wind; rocks don't.
    this.swayMaterials.push(g.mat, f.mat, rd.mat, sh.mat);

    // Toadstool clusters in the woods (Groups — few enough), from the shared
    // scatter so each one also has a collider.
    for (const m of MUSHROOMS) {
      const mush = buildMushroom();
      mush.position.set(m.x, 0, m.z);
      mush.rotation.y = m.yaw;
      mush.scale.setScalar(m.scale);
      this.group.add(mush);
    }

    // Fallen logs on the woods/grove floor (Groups; each has a collider).
    for (const l of LOGS) {
      const log = buildFallenLog();
      log.position.set(l.x, 0, l.z);
      log.rotation.y = l.yaw;
      log.scale.setScalar(l.scale);
      this.group.add(log);
    }

    // Lampposts along the trails (Groups; each has a collider).
    for (const l of LAMPPOSTS) {
      const lamp = buildLamppost();
      lamp.position.set(l.x, 0, l.z);
      this.group.add(lamp);
    }
  }

  /** Bright flower accents, concentrated in the home meadow. */
  private buildFlowers(): void {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, flatShading: true });
    const petalColors = [0xf07a8a, 0xf5d050, 0xa7c8f0, 0xf5a050];
    const rng = new Rng(SCATTER_SEED ^ 0xf10);

    for (let i = 0; i < 260; i++) {
      const flower = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 4), stemMat);
      stem.position.y = 0.2;
      flower.add(stem);

      const petalMat = new THREE.MeshStandardMaterial({
        color: petalColors[i % petalColors.length],
        flatShading: true,
      });
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), petalMat);
      petal.position.y = 0.45;
      flower.add(petal);

      // Cluster most flowers in the meadow, a few along trails further out.
      const inMeadow = rng.next() < 0.7;
      const r = inMeadow ? rng.range(6, 80) : rng.range(80, PARK_HALF - 20);
      const a = rng.range(0, Math.PI * 2);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!inPark(x, z, 2) || inDeepWater(x, z)) continue;
      flower.position.set(x, 0, z);
      this.group.add(flower);
    }
  }
}
