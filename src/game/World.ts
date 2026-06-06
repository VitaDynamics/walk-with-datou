import * as THREE from 'three';

/**
 * Half the side length of the (square) park, in metres. The world spans
 * [-PARK_HALF, +PARK_HALF] on both X and Z. This is the single source of truth
 * for world size: the ground mesh, the player's clamp, the placeholder's
 * wander bounds, and the MuJoCo ground geom all derive from it.
 *
 * The old prototype was 60×60 (PARK_HALF 30-ish); we grow to a 500×500 park so
 * there is real distance to walk and the whole world can't be seen at once.
 * See docs/ENVIRONMENT_DESIGN.md. The home meadow + dressing still cluster near
 * the origin; zones radiate outward (added in a later milestone).
 */
export const PARK_HALF = 250;

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

// Tree placements (x, z, variant). Hand-placed: clustered at the edges so the
// centre stays open for walking. Shared by the visual build and getColliders().
const TREE_LAYOUT: ReadonlyArray<readonly [number, number, number]> = [
  [-14, -12, 0],
  [-18, 4, 1],
  [-12, 14, 0],
  [-6, 18, 1],
  [10, 16, 0],
  [16, 8, 1],
  [18, -4, 0],
  [12, -14, 1],
  [3, -18, 0],
  [-8, -18, 1],
  [-20, -5, 0],
  [20, -12, 1],
];

// Collision radii. Trunks are thin, but we pad them a little so Datou and the
// player brush past the trunk rather than clipping the visual foliage base.
const TREE_COLLIDER_RADIUS = 0.5;
const HOME_POST = { x: 0, z: -2, radius: 0.45 };

/**
 * The park's solid obstacles as XZ-plane circles, derived purely from the
 * static layout (no random visual jitter). Exported as a free function so the
 * physics backend can build matching colliders at init time, before any World
 * instance exists. World.getColliders() returns the same set.
 */
export function getParkColliders(): Collider[] {
  const colliders: Collider[] = TREE_LAYOUT.map(([x, z]) => ({
    x,
    z,
    radius: TREE_COLLIDER_RADIUS,
  }));
  colliders.push({ x: HOME_POST.x, z: HOME_POST.z, radius: HOME_POST.radius });
  return colliders;
}

/**
 * The static park scene. No game logic, just visuals + collision geometry.
 *
 * The park is roughly 60 x 60 metres. The owner spawn is near (0, 0, 3); the
 * "home" post sits at (0, 0, -2). Trees are scattered around the edges so the
 * middle is open for walking.
 */
export class World {
  readonly group = new THREE.Group();
  private readonly colliders: Collider[] = getParkColliders();

  constructor() {
    this.buildGround();
    this.buildPath();
    this.buildHomePost();
    this.buildTrees();
    this.buildFlowers();
  }

  /**
   * Solid obstacles in the park (trees, home post) as XZ-plane circles. The
   * physics layer turns these into MuJoCo geoms and the player uses them for
   * kinematic collision, so there is a single source of truth for what blocks
   * movement.
   */
  getColliders(): readonly Collider[] {
    return this.colliders;
  }

  private buildGround(): void {
    // Flat plane spanning the whole park (heightfield terrain is deferred —
    // see docs/ENVIRONMENT_DESIGN.md §3.2). Kept at 1 segment: it's flat, so
    // subdivision buys nothing until the heightfield lands.
    const geo = new THREE.PlaneGeometry(PARK_HALF * 2, PARK_HALF * 2, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8ec97a,
      flatShading: true,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private buildPath(): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd6c79a,
      flatShading: true,
    });
    const segments = 14;
    for (let i = 0; i < segments; i++) {
      const t = i - segments / 2;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 2.4), mat);
      // gentle S-curve
      const curve = Math.sin((t / segments) * Math.PI * 1.4) * 5;
      tile.position.set(curve, 0.03, t * 2.4);
      tile.receiveShadow = true;
      this.group.add(tile);
    }
  }

  private buildHomePost(): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9a6a30,
      flatShading: true,
    });
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

  private buildTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x7a4a25,
      flatShading: true,
    });
    const leafMatA = new THREE.MeshStandardMaterial({
      color: 0x4a8a3a,
      flatShading: true,
    });
    const leafMatB = new THREE.MeshStandardMaterial({
      color: 0x5fa84d,
      flatShading: true,
    });

    for (const [x, z, variant] of TREE_LAYOUT) {
      const tree = new THREE.Group();
      const trunkH = 1.1 + Math.random() * 0.4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, trunkH, 6), trunkMat);
      trunk.position.y = trunkH / 2;
      trunk.castShadow = true;
      tree.add(trunk);

      const leafR = 1.0 + Math.random() * 0.5;
      const leafH = 2.2 + Math.random() * 0.6;
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(leafR, leafH, 6),
        variant === 0 ? leafMatA : leafMatB,
      );
      leaves.position.y = trunkH + leafH / 2 - 0.1;
      leaves.castShadow = true;
      tree.add(leaves);

      tree.position.set(x, 0, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(tree);
    }
  }

  private buildFlowers(): void {
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x4a7a3a,
      flatShading: true,
    });
    const petalColors = [0xf07a8a, 0xf5d050, 0xa7c8f0, 0xf5a050];

    for (let i = 0; i < 18; i++) {
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

      const x = (Math.random() - 0.5) * 36;
      const z = (Math.random() - 0.5) * 36;
      // keep flowers off the central path strip
      if (Math.abs(x) < 4 && Math.abs(z) < 14) continue;
      flower.position.set(x, 0, z);
      this.group.add(flower);
    }
  }
}
