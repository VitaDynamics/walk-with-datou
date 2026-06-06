import * as THREE from 'three';

/**
 * Procedural low-poly prop factory (docs/ENVIRONMENT_DESIGN.md §3, §9).
 *
 * All props are hand-built from THREE primitives in the existing flat-shaded
 * style (no glTF pipeline). Scattered foliage (pines, ferns, grass, reeds) is
 * built as InstancedMesh so a 500×500 park can be densely dressed cheaply;
 * one-off "hero" props (oak, bench, bridge, fountain) are Groups.
 *
 * Builders return a THREE.Object3D the caller adds to the scene and positions.
 */

// Shared materials — created once, reused across all instances of a prop type
// to keep draw setup and memory low.
const MAT = {
  trunk: new THREE.MeshStandardMaterial({ color: 0x7a4a25, flatShading: true }),
  darkTrunk: new THREE.MeshStandardMaterial({ color: 0x5e3a1e, flatShading: true }),
  pineNeedle: new THREE.MeshStandardMaterial({ color: 0x356b3a, flatShading: true }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4a8a3a, flatShading: true }),
  fern: new THREE.MeshStandardMaterial({ color: 0x5a9a4a, flatShading: true }),
  grass: new THREE.MeshStandardMaterial({ color: 0x7bb35a, flatShading: true }),
  reed: new THREE.MeshStandardMaterial({ color: 0x9fae5a, flatShading: true }),
  rock: new THREE.MeshStandardMaterial({ color: 0x8a8d92, flatShading: true }),
  mushroomCap: new THREE.MeshStandardMaterial({ color: 0xc4503a, flatShading: true }),
  mushroomStem: new THREE.MeshStandardMaterial({ color: 0xe8ddc8, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9a6a30, flatShading: true }),
  plank: new THREE.MeshStandardMaterial({ color: 0xb98a4e, flatShading: true }),
  stone: new THREE.MeshStandardMaterial({ color: 0xb7b2a6, flatShading: true }),
  lily: new THREE.MeshStandardMaterial({ color: 0x4f9e57, flatShading: true }),
} as const;

/** A placement: world XZ position, yaw, and uniform scale. */
export interface Placement {
  x: number;
  z: number;
  yaw: number;
  scale: number;
}

/**
 * Build one InstancedMesh from a base geometry + material and a list of
 * placements on the flat ground (y = 0). Far cheaper than one mesh per prop.
 */
export function instanced(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  placements: readonly Placement[],
  castShadow = true,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    q.setFromAxisAngle(up, p.yaw);
    pos.set(p.x, 0, p.z);
    scl.set(p.scale, p.scale, p.scale);
    m.compose(pos, q, scl);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  return mesh;
}

// --- Scattered-foliage base geometries (unit-ish, scaled per placement) ---
// Origin at the base (feet) so a placement at ground level sits on the plane.

/** A conifer: brown trunk + 2 stacked needle cones. ~4 m tall at scale 1. */
export function pineGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.16, 0.24, 1.2, 6).translate(0, 0.6, 0);
  const lower = new THREE.ConeGeometry(1.2, 2.0, 7).translate(0, 1.9, 0);
  const upper = new THREE.ConeGeometry(0.85, 1.6, 7).translate(0, 3.0, 0);
  parts.push(trunk, lower, upper);
  // Merge into one geometry; needles + trunk share a single instanced material,
  // so tint the whole tree as foliage (trunk reads fine in silhouette at range).
  return { geo: mergeGeometries(parts), mat: MAT.pineNeedle };
}

/** A low fern clump. ~0.6 m. */
export function fernGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const blade = new THREE.ConeGeometry(0.12, 0.7, 4)
      .rotateZ(0.5)
      .rotateY(a)
      .translate(Math.cos(a) * 0.12, 0.35, Math.sin(a) * 0.12);
    blades.push(blade);
  }
  return { geo: mergeGeometries(blades), mat: MAT.fern };
}

/** A tuft of tall grass. ~0.5 m. */
export function grassGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    blades.push(
      new THREE.ConeGeometry(0.06, 0.55, 3).translate(Math.cos(a) * 0.07, 0.27, Math.sin(a) * 0.07),
    );
  }
  return { geo: mergeGeometries(blades), mat: MAT.grass };
}

/** A waterside reed cluster. ~1.2 m. */
export function reedGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  const stalks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = 0.1 + (i % 2) * 0.08;
    stalks.push(
      new THREE.CylinderGeometry(0.03, 0.04, 1.2, 4).translate(
        Math.cos(a) * r,
        0.6,
        Math.sin(a) * r,
      ),
    );
  }
  return { geo: mergeGeometries(stalks), mat: MAT.reed };
}

/** A rounded boulder. ~0.8 m. */
export function rockGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  return { geo: new THREE.DodecahedronGeometry(0.5, 0).translate(0, 0.35, 0), mat: MAT.rock };
}

/** A flat lily pad disc, sits just above the water plane. */
export function lilyPadGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  return { geo: new THREE.CircleGeometry(0.5, 7).rotateX(-Math.PI / 2), mat: MAT.lily };
}

// --- Hero / one-off props (Groups) ---

/** The Big Oak: the woods landmark, a tall wide-canopy tree. ~9 m. */
export function buildBigOak(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 4.5, 8), MAT.darkTrunk);
  trunk.position.y = 2.25;
  trunk.castShadow = true;
  g.add(trunk);
  // Three overlapping canopy blobs for a fuller silhouette.
  const blobs: Array<[number, number, number, number]> = [
    [0, 6.0, 0, 3.4],
    [-1.8, 5.2, 1.0, 2.4],
    [1.7, 5.4, -0.8, 2.6],
  ];
  for (const [x, y, z, r] of blobs) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), MAT.leaf);
    blob.position.set(x, y, z);
    blob.castShadow = true;
    g.add(blob);
  }
  return g;
}

/** The Lookout Bench: the grove landmark, a distinctive bench silhouette. */
export function buildBench(): THREE.Group {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.6), MAT.plank);
  seat.position.y = 0.5;
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.1), MAT.plank);
  back.position.set(0, 0.78, -0.25);
  back.castShadow = true;
  g.add(back);
  for (const x of [-0.85, 0.85]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.5), MAT.wood);
    leg.position.set(x, 0.25, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

/** A small stone fountain by the home post — the meadow's gentle centrepiece. */
export function buildFountain(): THREE.Group {
  const g = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.5, 12), MAT.stone);
  basin.position.y = 0.25;
  basin.castShadow = true;
  basin.receiveShadow = true;
  g.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.25, 0.06, 12),
    new THREE.MeshStandardMaterial({
      color: 0x6db4d6,
      transparent: true,
      opacity: 0.8,
      flatShading: true,
    }),
  );
  water.position.y = 0.46;
  g.add(water);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.9, 8), MAT.stone);
  pillar.position.y = 0.9;
  pillar.castShadow = true;
  g.add(pillar);
  return g;
}

/** A simple plank bridge spanning the lake neck. Length along +X. */
export function buildBridge(length = 16): THREE.Group {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 0.16, 2.4), MAT.plank);
  deck.position.y = 0.55;
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);
  // Railings + posts.
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.1, 0.1), MAT.wood);
    rail.position.set(0, 1.05, side * 1.05);
    g.add(rail);
    const posts = Math.floor(length / 2);
    for (let i = 0; i <= posts; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), MAT.wood);
      post.position.set(-length / 2 + (i / posts) * length, 0.75, side * 1.05);
      post.castShadow = true;
      g.add(post);
    }
  }
  return g;
}

/** A toadstool — a small woods accent / sniff-spot marker. */
export function buildMushroom(): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.32, 6), MAT.mushroomStem);
  stem.position.y = 0.16;
  g.add(stem);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    MAT.mushroomCap,
  );
  cap.position.y = 0.32;
  cap.scale.y = 0.7;
  g.add(cap);
  return g;
}

/**
 * Minimal geometry merge (positions + normals) so we don't depend on three's
 * BufferGeometryUtils addon. All inputs are non-indexed-friendly primitive
 * geometries; we expand any indexed ones and concatenate.
 */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const g of geos) {
    const src = g.index ? g.toNonIndexed() : g;
    const pos = src.getAttribute('position');
    const nrm = src.getAttribute('normal');
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (nrm) normals.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    }
    if (src !== g) src.dispose();
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return merged;
}
