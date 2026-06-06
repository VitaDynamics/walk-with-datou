import * as THREE from 'three';
import { Rng } from '../physics/mujoco/rng';
import {
  buildBench,
  buildBigOak,
  buildBridge,
  buildFountain,
  buildMushroom,
  fernGeometry,
  grassGeometry,
  instanced,
  lilyPadGeometry,
  pineGeometry,
  reedGeometry,
  rockGeometry,
  type Placement,
} from './props';
import { inDeepWater, inPark, LAKE, LANDMARKS, zoneAt, ZONES, type ZoneId } from './zones';

/**
 * Half the side length of the (square) park, in metres. The world spans
 * [-PARK_HALF, +PARK_HALF] on both X and Z. This is the single source of truth
 * for world size: the ground mesh, the player's clamp, the placeholder's
 * wander bounds, and the MuJoCo ground geom all derive from it.
 *
 * The old prototype was 60×60; we grow to a 500×500 park so there is real
 * distance to walk and the whole world can't be seen at once. The home meadow +
 * dressing cluster near the origin; zones (zones.ts) radiate outward.
 * See docs/ENVIRONMENT_DESIGN.md.
 */
export const PARK_HALF = 250;

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
}

const HOME_POST = { x: 0, z: -2, radius: 0.45 };

/** A scattered tree placement that also blocks movement (pine trunks). */
interface TreeInstance extends Placement {
  zone: ZoneId;
}

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
  for (const zone of ZONES) {
    if (zone.id !== 'woods' && zone.id !== 'grove') continue;
    const clusters = 22;
    for (let c = 0; c < clusters; c++) {
      const ca = rng.range(0, Math.PI * 2);
      const cr = rng.range(0, zone.radius);
      const cx = zone.center.x + Math.cos(ca) * cr;
      const cz = zone.center.z + Math.sin(ca) * cr;
      const count = 3 + Math.floor(rng.range(0, 5));
      for (let i = 0; i < count; i++) {
        const x = cx + rng.range(-6, 6);
        const z = cz + rng.range(-6, 6);
        tryPlace(x, z, zone.id, rng.range(0.8, 1.5));
      }
    }
  }

  // Thin forest band around the perimeter so the edge reads as "woods get
  // thick," not "the world ends" (§1 edge treatment).
  const ringCount = 120;
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2;
    const r = PARK_HALF - rng.range(6, 30);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    tryPlace(x, z, zoneAt(x, z).id, rng.range(0.9, 1.6));
  }

  return trees;
}

// Computed once at module load so getParkColliders() (called before any World
// exists) and the World visual build share the exact same scatter.
const TREES = scatterTrees();
const TREE_COLLIDER_BASE = 0.45; // trunk radius before scaling

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

  for (const lm of LANDMARKS) {
    if (lm.colliderRadius > 0) {
      colliders.push({ x: lm.x, z: lm.z, radius: lm.colliderRadius });
    }
  }

  // Ring the deep-water core with blockers (a circle of colliders) so movement
  // is stopped at the shoreline without a true polygonal water collider. The
  // bridge spans the lake along +X through the centre, so leave a gap there
  // (where |z - centre.z| is small) — you cross on the deck.
  const ringR = LAKE.deepRadius;
  const ringSegments = 28;
  const bridgeHalfWidth = 1.4; // matches the bridge deck half-width
  for (let i = 0; i < ringSegments; i++) {
    const a = (i / ringSegments) * Math.PI * 2;
    const x = LAKE.center.x + Math.cos(a) * ringR;
    const z = LAKE.center.z + Math.sin(a) * ringR;
    // Gap where the bridge deck meets the shore on either +X / -X side.
    if (Math.abs(z - LAKE.center.z) < bridgeHalfWidth + 1) continue;
    colliders.push({ x, z, radius: ringR * Math.sin(Math.PI / ringSegments) + 0.5 });
  }

  return colliders;
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
  private readonly colliders: Collider[] = getParkColliders();

  constructor() {
    this.buildGround();
    this.buildLake();
    this.buildPath();
    this.buildHomePost();
    this.buildLandmarks();
    this.buildTrees();
    this.buildFoliage();
    this.buildFlowers();
  }

  /**
   * Solid obstacles in the park as XZ-plane circles. The physics layer turns
   * these into MuJoCo geoms and the player uses them for kinematic collision,
   * so there is a single source of truth for what blocks movement.
   */
  getColliders(): readonly Collider[] {
    return this.colliders;
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
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a6a30, flatShading: true });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), mat);
    post.position.set(0, 0.6, -2);
    post.castShadow = true;
    this.group.add(post);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), mat);
    cap.position.set(0, 1.35, -2);
    cap.castShadow = true;
    this.group.add(cap);

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.4, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xf4d39a, flatShading: true }),
    );
    sign.position.set(0, 0.9, -1.8);
    sign.castShadow = true;
    this.group.add(sign);
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
    }
  }

  /** Build the blocking pine trees from the shared deterministic scatter. */
  private buildTrees(): void {
    const pine = pineGeometry();
    this.group.add(instanced(pine.geo, pine.mat, TREES));
  }

  /** Non-blocking scattered foliage: ferns/grass in green zones, reeds by the
   *  lake, rocks here and there, mushrooms in the woods. All instanced. */
  private buildFoliage(): void {
    const rng = new Rng(SCATTER_SEED ^ 0x7c);
    const grass: Placement[] = [];
    const fern: Placement[] = [];
    const reed: Placement[] = [];
    const rock: Placement[] = [];

    // Grass + ferns. Half scattered everywhere (a light, even meadow carpet),
    // half clustered tightly around the zone centres so the "dense islands of
    // interest" read against the quieter connective grassland (§3 clumping).
    const pushBlade = (x: number, z: number, woodsFernChance: number): void => {
      if (!inPark(x, z, 2)) return;
      if (Math.hypot(x - LAKE.center.x, z - LAKE.center.z) < LAKE.radius) return; // off the water
      const zone = zoneAt(x, z);
      const place: Placement = { x, z, yaw: rng.range(0, Math.PI * 2), scale: rng.range(0.8, 1.9) };
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

    // Reeds ring the lake shore.
    for (let i = 0; i < 160; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(LAKE.deepRadius, LAKE.radius + 8);
      const x = LAKE.center.x + Math.cos(a) * r;
      const z = LAKE.center.z + Math.sin(a) * r;
      if (!inPark(x, z, 2)) continue;
      reed.push({ x, z, yaw: rng.range(0, Math.PI * 2), scale: rng.range(0.7, 1.3) });
    }

    // Rocks sprinkled around, denser near the grove/woods.
    for (let i = 0; i < 220; i++) {
      const x = rng.range(-PARK_HALF, PARK_HALF);
      const z = rng.range(-PARK_HALF, PARK_HALF);
      if (!inPark(x, z, 4) || inDeepWater(x, z)) continue;
      if (Math.hypot(x, z) < 16) continue;
      rock.push({ x, z, yaw: rng.range(0, Math.PI * 2), scale: rng.range(0.5, 1.8) });
    }

    const g = grassGeometry();
    this.group.add(instanced(g.geo, g.mat, grass, false));
    const f = fernGeometry();
    this.group.add(instanced(f.geo, f.mat, fern, false));
    const rd = reedGeometry();
    this.group.add(instanced(rd.geo, rd.mat, reed, false));
    const rk = rockGeometry();
    this.group.add(instanced(rk.geo, rk.mat, rock));

    // A handful of mushroom accents in the woods (Groups — few enough).
    for (let i = 0; i < 18; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(0, 90);
      const wood = ZONES.find((zz) => zz.id === 'woods')!;
      const x = wood.center.x + Math.cos(a) * r;
      const z = wood.center.z + Math.sin(a) * r;
      if (!inPark(x, z, 4)) continue;
      const m = buildMushroom();
      m.position.set(x, 0, z);
      m.rotation.y = rng.range(0, Math.PI * 2);
      this.group.add(m);
    }
  }

  /** Bright flower accents, concentrated in the home meadow. */
  private buildFlowers(): void {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, flatShading: true });
    const petalColors = [0xf07a8a, 0xf5d050, 0xa7c8f0, 0xf5a050];
    const rng = new Rng(SCATTER_SEED ^ 0xf10);

    for (let i = 0; i < 120; i++) {
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
