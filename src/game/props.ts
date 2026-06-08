import * as THREE from 'three';

/**
 * Procedural low-poly prop factory (docs/ENVIRONMENT_DESIGN.md §3, §9).
 *
 * All props are hand-built from THREE primitives in the existing flat-shaded
 * style (no glTF pipeline). Scattered foliage (pines, ferns, grass, reeds) is
 * built as InstancedMesh so a 500×500 park can be densely dressed cheaply;
 * one-off "hero" props (oak, bench, bridge, fountain) are Groups.
 *
 * Geometry is intentionally richer than the first pass (branches on pines,
 * clustered boulders, layered canopies, plank-by-plank bridge) while staying
 * cheap: detail lives in the *base* geometry that every instance shares, and
 * variety comes from per-instance scale/yaw/tint (see `instanced`), so adding
 * detail costs vertices once, not per prop.
 *
 * Builders return a THREE.Object3D the caller adds to the scene and positions.
 */

// Shared materials — created once, reused across all instances of a prop type
// to keep draw setup and memory low. Foliage materials enable per-instance
// tint via vertexColors so a field of pines isn't one flat green.
const MAT = {
  trunk: new THREE.MeshStandardMaterial({ color: 0x7a4a25, flatShading: true }),
  darkTrunk: new THREE.MeshStandardMaterial({ color: 0x5e3a1e, flatShading: true }),
  pineNeedle: new THREE.MeshStandardMaterial({
    color: 0x3a7340,
    flatShading: true,
    vertexColors: true,
  }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4a8a3a, flatShading: true }),
  leafDark: new THREE.MeshStandardMaterial({ color: 0x3c7530, flatShading: true }),
  fern: new THREE.MeshStandardMaterial({ color: 0x5a9a4a, flatShading: true, vertexColors: true }),
  grass: new THREE.MeshStandardMaterial({ color: 0x7bb35a, flatShading: true, vertexColors: true }),
  reed: new THREE.MeshStandardMaterial({ color: 0x9fae5a, flatShading: true, vertexColors: true }),
  reedHead: new THREE.MeshStandardMaterial({ color: 0x8a6a3a, flatShading: true }),
  rock: new THREE.MeshStandardMaterial({ color: 0x8a8d92, flatShading: true, vertexColors: true }),
  rockMoss: new THREE.MeshStandardMaterial({ color: 0x6f7d52, flatShading: true }),
  mushroomCap: new THREE.MeshStandardMaterial({ color: 0xc4503a, flatShading: true }),
  mushroomStem: new THREE.MeshStandardMaterial({ color: 0xe8ddc8, flatShading: true }),
  mushroomSpot: new THREE.MeshStandardMaterial({ color: 0xf2e6cf, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9a6a30, flatShading: true }),
  plank: new THREE.MeshStandardMaterial({ color: 0xb98a4e, flatShading: true }),
  plankDark: new THREE.MeshStandardMaterial({ color: 0xa2773f, flatShading: true }),
  stone: new THREE.MeshStandardMaterial({ color: 0xb7b2a6, flatShading: true }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x9a958a, flatShading: true }),
  lily: new THREE.MeshStandardMaterial({ color: 0x4f9e57, flatShading: true }),
  lilyFlower: new THREE.MeshStandardMaterial({ color: 0xf2d6e2, flatShading: true }),
  water: new THREE.MeshStandardMaterial({
    color: 0x6db4d6,
    transparent: true,
    opacity: 0.8,
    flatShading: true,
  }),
  shrub: new THREE.MeshStandardMaterial({ color: 0x4f8a44, flatShading: true, vertexColors: true }),
  blossom: new THREE.MeshStandardMaterial({ color: 0xf4a6c0, flatShading: true }),
  logBark: new THREE.MeshStandardMaterial({ color: 0x6e4a2c, flatShading: true }),
  logEnd: new THREE.MeshStandardMaterial({ color: 0xc8a878, flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: 0x3a3f45, flatShading: true }),
  lampGlow: new THREE.MeshStandardMaterial({
    color: 0xffe6a8,
    emissive: 0xffcf6e,
    emissiveIntensity: 0.9,
    flatShading: true,
  }),
  cloth: new THREE.MeshStandardMaterial({ color: 0xd9534f, flatShading: true }),
  clothAlt: new THREE.MeshStandardMaterial({ color: 0xf2e3c0, flatShading: true }),
  signBoard: new THREE.MeshStandardMaterial({ color: 0xe8cf9a, flatShading: true }),
} as const;

/** A placement: world XZ position, yaw, and uniform scale. An optional `tint`
 *  (0..1) shifts that instance's colour a little so instanced fields vary. */
export interface Placement {
  x: number;
  z: number;
  yaw: number;
  scale: number;
  /** Per-instance brightness jitter in [-1, 1]; 0 = base colour. Optional. */
  tint?: number;
}

/**
 * Build one InstancedMesh from a base geometry + material and a list of
 * placements on the flat ground (y = 0). Far cheaper than one mesh per prop.
 *
 * If the material has `vertexColors` on, each instance gets a per-instance
 * colour derived from its `tint` so a field of one geometry still reads varied.
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
  const useColor = (mat as THREE.MeshStandardMaterial).vertexColors === true;
  const color = new THREE.Color();
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    q.setFromAxisAngle(up, p.yaw);
    pos.set(p.x, 0, p.z);
    scl.set(p.scale, p.scale, p.scale);
    m.compose(pos, q, scl);
    mesh.setMatrixAt(i, m);
    if (useColor) {
      // Lighten/darken the base material colour by the instance tint.
      const t = p.tint ?? 0;
      color.copy((mat as THREE.MeshStandardMaterial).color);
      const hsl = { h: 0, s: 0, l: 0 };
      color.getHSL(hsl);
      color.setHSL(
        hsl.h + t * 0.02,
        THREE.MathUtils.clamp(hsl.s + t * 0.08, 0, 1),
        THREE.MathUtils.clamp(hsl.l + t * 0.12, 0, 1),
      );
      mesh.setColorAt(i, color);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  return mesh;
}

/** Compose the world matrix for a placement (origin on the flat ground, y = 0,
 *  yaw about +Y, uniform scale). Shared by `instanced`/`instancedMulti`. */
export function composePlacementMatrix(p: Placement, out: THREE.Matrix4): THREE.Matrix4 {
  return out.compose(
    _pos.set(p.x, 0, p.z),
    _quat.setFromAxisAngle(_up, p.yaw),
    _scl.set(p.scale, p.scale, p.scale),
  );
}
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _scl = new THREE.Vector3();

/**
 * Build a Group of InstancedMeshes — one per part — sharing the same placement
 * list. Used for multi-material GLB models (ModelLoader.prepareInstanceable
 * returns one `{geo, mat}` per material), so a field of one model kind costs one
 * draw call per material, not per instance. The returned Group is positioned at
 * the origin; each instance's transform comes from `placements`.
 *
 * Unlike `instanced`, GLB materials usually aren't vertex-coloured, so instances
 * vary by scale/yaw but not tint — acceptable for downloaded models.
 */
export function instancedMulti(
  parts: readonly { geo: THREE.BufferGeometry; mat: THREE.Material }[],
  placements: readonly Placement[],
  castShadow = true,
): THREE.Group {
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  for (const part of parts) {
    const mesh = new THREE.InstancedMesh(part.geo, part.mat, placements.length);
    for (let i = 0; i < placements.length; i++) {
      composePlacementMatrix(placements[i], m);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  return group;
}

// --- Scattered-foliage base geometries (unit-ish, scaled per placement) ---
// Origin at the base (feet) so a placement at ground level sits on the plane.
// Each base geometry carries a vertex-colour attribute (white) so instanced
// materials with `vertexColors` can tint per instance without per-vertex art.

function whiten(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const count = geo.getAttribute('position').count;
  const colors = new Float32Array(count * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * Bake a vertical light gradient into vertex colours — darker (multiplier
 * `lo`) at the base, lighter (`hi`) toward `top`. This gives foliage natural
 * depth (shaded near the ground, sun-caught at the tips) without any texture,
 * and still multiplies cleanly with the per-instance tint. The result is far
 * more realistic than a flat single-colour mesh.
 */
function gradient(
  geo: THREE.BufferGeometry,
  top: number,
  lo = 0.62,
  hi = 1.18,
): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / top, 0, 1);
    const shade = lo + (hi - lo) * t;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * A conifer with a tapered trunk, a whorl of low branches, and three stacked
 * needle tiers with slightly jittered radii so the silhouette is bushy, not a
 * plain stack of cones. ~4.5 m tall at scale 1.
 */
export function pineGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  const parts: THREE.BufferGeometry[] = [];
  // Tapered trunk, a touch taller and more segments so it reads round.
  parts.push(new THREE.CylinderGeometry(0.12, 0.26, 1.5, 8).translate(0, 0.75, 0));

  // Five overlapping needle tiers (denser than before) with smoothly shrinking
  // radius/height up the trunk → a fuller, more natural conifer silhouette
  // rather than three obvious stacked cones. Higher radial segments soften it.
  const tiers: Array<[number, number, number]> = [
    [1.35, 1.9, 1.35],
    [1.15, 1.7, 2.0],
    [0.92, 1.5, 2.7],
    [0.66, 1.25, 3.4],
    [0.4, 1.0, 4.05],
  ];
  for (const [r, h, centerY] of tiers) {
    parts.push(new THREE.ConeGeometry(r, h, 9).translate(0, centerY, 0));
  }

  // A whorl of drooping branch stubs at the base for a bushier, grounded look.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const branch = new THREE.ConeGeometry(0.2, 1.0, 5)
      .rotateZ(Math.PI / 2 - 0.4)
      .rotateY(a)
      .translate(Math.cos(a) * 0.55, 1.2, Math.sin(a) * 0.55);
    parts.push(branch);
  }

  // Gradient: shaded at the trunk/base, sun-caught at the crown (~5 m tall).
  return { geo: gradient(mergeGeometries(parts), 5, 0.6, 1.2), mat: MAT.pineNeedle };
}

/** A low fern clump: arching fronds splayed from a centre. ~0.6 m. */
export function fernGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  const blades: THREE.BufferGeometry[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const lean = 0.55 + (i % 2) * 0.15;
    const blade = new THREE.ConeGeometry(0.1, 0.75, 4)
      .rotateZ(lean)
      .rotateY(a)
      .translate(Math.cos(a) * 0.13, 0.36, Math.sin(a) * 0.13);
    blades.push(blade);
  }
  // Shaded at the crown's base, brighter at the frond tips.
  return { geo: gradient(mergeGeometries(blades), 0.7, 0.7, 1.1), mat: MAT.fern };
}

/**
 * A tuft of tall grass: thin tapered blades that fan out AND arch over, with a
 * base→tip light gradient. The arch (two stacked, progressively-leaned segments)
 * and the gradient are what make it read as real grass instead of a spiky star.
 * ~0.6 m.
 */
export function grassGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  const blades: THREE.BufferGeometry[] = [];
  const n = 9; // denser tuft
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2) * 0.5;
    const r = 0.04 + (i % 3) * 0.035;
    const h = 0.42 + (i % 3) * 0.16; // varied heights
    const dir = i % 2 ? 1 : -1;

    // Lower half: near-upright, thicker base.
    const lower = new THREE.CylinderGeometry(0.018, 0.04, h * 0.55, 3)
      .rotateZ(dir * 0.12)
      .translate(Math.cos(a) * r, h * 0.27, Math.sin(a) * r);
    // Upper half: tapers to a point and arches further over (the natural droop).
    const upper = new THREE.ConeGeometry(0.018, h * 0.6, 3)
      .rotateZ(dir * 0.5)
      .translate(Math.cos(a) * (r + 0.05) + dir * 0.04, h * 0.72, Math.sin(a) * (r + 0.05));
    blades.push(lower, upper);
  }
  return { geo: gradient(mergeGeometries(blades), 0.7, 0.5, 1.15), mat: MAT.grass };
}

/** A waterside reed cluster: tall stalks, a couple capped with seed heads. ~1.3 m. */
export function reedGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  const parts: THREE.BufferGeometry[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.08 + (i % 3) * 0.07;
    const h = 1.0 + (i % 3) * 0.25;
    const lean = (i % 2 ? 1 : -1) * 0.08;
    parts.push(
      new THREE.CylinderGeometry(0.025, 0.04, h, 4)
        .rotateZ(lean)
        .translate(Math.cos(a) * r, h / 2, Math.sin(a) * r),
    );
  }
  return { geo: whiten(mergeGeometries(parts)), mat: MAT.reed };
}

/**
 * An irregular boulder cluster: one large lump plus 2–3 smaller ones nudged
 * around it, each a slightly deformed icosahedron, so rocks read as weathered
 * outcrops instead of identical spheres. ~1.0 m across at scale 1.
 */
export function rockGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  const lumps: Array<[number, number, number, number]> = [
    [0, 0.4, 0, 0.55],
    [0.45, 0.22, 0.2, 0.34],
    [-0.35, 0.18, 0.3, 0.28],
    [0.1, 0.16, -0.42, 0.24],
  ];
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, y, z, r] of lumps) {
    const g = new THREE.IcosahedronGeometry(r, 0);
    // Deterministic squash so it isn't a perfect ball; flat-shaded hides seams.
    g.scale(1, 0.78, 1.12);
    g.translate(x, y, z);
    parts.push(g);
  }
  return { geo: whiten(mergeGeometries(parts)), mat: MAT.rock };
}

/** A flat lily pad disc with a small notch and a tiny flower bud. */
export function lilyPadGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  const pad = new THREE.CircleGeometry(0.5, 9, 0.4, Math.PI * 2 - 0.8).rotateX(-Math.PI / 2);
  return { geo: pad, mat: MAT.lily };
}

// --- Hero / one-off props (Groups) ---

/**
 * The Big Oak: the woods landmark, a tall wide-canopy tree. ~10 m. Now with a
 * forked trunk, surface roots flaring at the base, and a layered five-blob
 * canopy in two greens for depth.
 */
export function buildBigOak(): THREE.Group {
  const g = new THREE.Group();

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.15, 4.8, 9), MAT.darkTrunk);
  trunk.position.y = 2.4;
  trunk.castShadow = true;
  g.add(trunk);

  // Two upper limbs splitting off the trunk.
  for (const side of [-1, 1]) {
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 2.6, 7), MAT.darkTrunk);
    limb.position.set(side * 0.7, 4.4, side * 0.2);
    limb.rotation.z = side * 0.4;
    limb.castShadow = true;
    g.add(limb);
  }

  // Flaring surface roots.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 5), MAT.darkTrunk);
    root.rotation.z = Math.PI / 2 - 0.5;
    root.rotation.y = -a;
    root.position.set(Math.cos(a) * 0.9, 0.25, Math.sin(a) * 0.9);
    g.add(root);
  }

  // Layered canopy: big core blobs (light) + smaller accent blobs (dark).
  const blobs: Array<[number, number, number, number, boolean]> = [
    [0, 6.4, 0, 3.5, false],
    [-2.0, 5.6, 1.1, 2.5, false],
    [1.9, 5.8, -0.9, 2.7, false],
    [0.4, 7.6, 0.8, 2.0, true],
    [-1.2, 6.6, -1.6, 1.9, true],
  ];
  for (const [x, y, z, r, dark] of blobs) {
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      dark ? MAT.leafDark : MAT.leaf,
    );
    blob.position.set(x, y, z);
    blob.castShadow = true;
    g.add(blob);
  }
  return g;
}

/** The Lookout Bench: the grove landmark. Now slatted seat + back, angled
 *  back, and arm rests for a recognisable silhouette. */
export function buildBench(): THREE.Group {
  const g = new THREE.Group();

  // Slatted seat (three planks).
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.16), MAT.plank);
    slat.position.set(0, 0.5, -0.22 + i * 0.2);
    slat.castShadow = true;
    g.add(slat);
  }
  // Slatted, slightly reclined back.
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 0.07), MAT.plank);
    slat.position.set(0, 0.72 + i * 0.2, -0.32);
    slat.rotation.x = -0.18;
    slat.castShadow = true;
    g.add(slat);
  }
  // Legs + arm rests.
  for (const x of [-0.9, 0.9]) {
    const frontLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), MAT.wood);
    frontLeg.position.set(x, 0.25, 0.18);
    frontLeg.castShadow = true;
    g.add(frontLeg);
    const backLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.1), MAT.wood);
    backLeg.position.set(x, 0.45, -0.34);
    backLeg.castShadow = true;
    g.add(backLeg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.6), MAT.wood);
    arm.position.set(x, 0.72, -0.05);
    arm.castShadow = true;
    g.add(arm);
  }
  return g;
}

/** A tiered stone fountain by the home post — the meadow's gentle centrepiece.
 *  Stepped basin, a pedestal, an upper bowl, and a little water jet cone. */
export function buildFountain(): THREE.Group {
  const g = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.3, 16), MAT.stoneDark);
  base.position.y = 0.15;
  base.receiveShadow = true;
  g.add(base);

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 0.45, 16), MAT.stone);
  basin.position.y = 0.45;
  basin.castShadow = true;
  basin.receiveShadow = true;
  g.add(basin);

  const lowerWater = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.06, 16), MAT.water);
  lowerWater.position.y = 0.64;
  g.add(lowerWater);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.95, 10), MAT.stone);
  pedestal.position.y = 1.1;
  pedestal.castShadow = true;
  g.add(pedestal);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.3, 0.3, 12), MAT.stone);
  bowl.position.y = 1.7;
  bowl.castShadow = true;
  g.add(bowl);

  const upperWater = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12), MAT.water);
  upperWater.position.y = 1.84;
  g.add(upperWater);

  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 8), MAT.water);
  jet.position.y = 2.1;
  g.add(jet);

  return g;
}

/** A plank bridge spanning the lake neck, built plank-by-plank with railings,
 *  posts, and a slight arch. Length along +X. */
export function buildBridge(length = 16): THREE.Group {
  const g = new THREE.Group();
  const planks = Math.max(8, Math.round(length / 0.7));
  const archHeight = 0.7;

  for (let i = 0; i < planks; i++) {
    const f = i / (planks - 1);
    const x = -length / 2 + f * length;
    // Gentle parabolic arch peaking at the centre.
    const y = 0.5 + archHeight * (1 - (2 * f - 1) ** 2);
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(length / planks - 0.05, 0.12, 2.4),
      i % 2 ? MAT.plank : MAT.plankDark,
    );
    plank.position.set(x, y, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    g.add(plank);
  }

  // Railings: posts following the arch + a top rail per side.
  const postCount = Math.floor(length / 1.8);
  for (const side of [-1, 1]) {
    for (let i = 0; i <= postCount; i++) {
      const f = i / postCount;
      const x = -length / 2 + f * length;
      const deckY = 0.5 + archHeight * (1 - (2 * f - 1) ** 2);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.7, 0.13), MAT.wood);
      post.position.set(x, deckY + 0.35, side * 1.05);
      post.castShadow = true;
      g.add(post);
    }
    // Top rail as a flat arched box (approximate the arch with one tilted box).
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.1, 0.1), MAT.wood);
    rail.position.set(0, 0.5 + archHeight * 0.55 + 0.7, side * 1.05);
    g.add(rail);
  }
  return g;
}

/** A toadstool cluster — a small woods accent / sniff-spot marker. One big cap,
 *  a couple of little ones, white spots on the big cap. */
export function buildMushroom(): THREE.Group {
  const g = new THREE.Group();

  const caps: Array<[number, number, number]> = [
    [0, 0, 1.0],
    [0.22, 0, 0.55],
    [-0.18, 0.02, 0.45],
  ];
  for (const [x, z, s] of caps) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 0.32 * s, 6),
      MAT.mushroomStem,
    );
    stem.position.set(x, 0.16 * s, z);
    stem.castShadow = true;
    g.add(stem);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.2 * s, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      MAT.mushroomCap,
    );
    cap.position.set(x, 0.32 * s, z);
    cap.scale.y = 0.7;
    cap.castShadow = true;
    g.add(cap);
  }

  // Spots on the big cap.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = 0.1;
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), MAT.mushroomSpot);
    spot.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r);
    g.add(spot);
  }
  return g;
}

// --- New filler / dressing props (added to fill the empty grassland) ---

/**
 * A rounded flowering shrub: a clump of leafy lobes with a sprinkle of blossom
 * dots merged in. Instanced filler that breaks up open ground. ~0.9 m. The
 * blossoms are merged into the same geometry (one draw call) but read as a
 * second colour because the leaf lobes carry the vertex tint and the blossoms
 * don't — close enough at filler scale.
 */
export function shrubGeometry(): { geo: THREE.BufferGeometry; mat: THREE.Material } {
  const parts: THREE.BufferGeometry[] = [];
  const lobes: Array<[number, number, number, number]> = [
    [0, 0.45, 0, 0.42],
    [0.32, 0.32, 0.12, 0.3],
    [-0.28, 0.34, -0.1, 0.32],
    [0.05, 0.3, -0.34, 0.26],
  ];
  for (const [x, y, z, r] of lobes) {
    parts.push(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z));
  }
  return { geo: whiten(mergeGeometries(parts)), mat: MAT.shrub };
}

/** A fallen, mossy log — a sittable-looking accent for the woods/grove floor.
 *  Lies along local +X; ~2.4 m long. Solid (gets a collider). */
export function buildFallenLog(): THREE.Group {
  const g = new THREE.Group();
  const len = 2.4;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, len, 8), MAT.logBark);
  trunk.rotation.z = Math.PI / 2;
  trunk.position.y = 0.34;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);
  // Sawn pale ends.
  for (const s of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 8), MAT.logEnd);
    end.rotation.z = Math.PI / 2;
    end.position.set((s * len) / 2, 0.34, 0);
    g.add(end);
  }
  // A couple of stubby broken branches + a moss patch.
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.6, 5), MAT.logBark);
  branch.position.set(0.4, 0.55, 0.2);
  branch.rotation.set(0.5, 0.3, 0.4);
  g.add(branch);
  const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), MAT.rockMoss);
  moss.scale.set(1.4, 0.4, 0.8);
  moss.position.set(-0.5, 0.6, 0);
  g.add(moss);
  return g;
}

/** A trail signpost: a post with one or two arrow boards pointing onward. The
 *  board faces local +Z. A named feature at zone entrances. ~2 m. */
export function buildSignpost(): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.0, 6), MAT.wood);
  post.position.y = 1.0;
  post.castShadow = true;
  g.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.34, 0.06), MAT.signBoard);
  board.position.set(0.2, 1.5, 0);
  board.castShadow = true;
  g.add(board);
  // A pointed tip so it reads as an arrow.
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.36, 3), MAT.signBoard);
  tip.rotation.z = -Math.PI / 2;
  tip.position.set(0.83, 1.5, 0);
  g.add(tip);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 6), MAT.wood);
  cap.position.y = 2.1;
  g.add(cap);
  return g;
}

/** A wrought-iron lamppost with a warm glowing lantern — dressing along trails,
 *  reads especially well at dusk. ~3 m. Solid (gets a collider). */
export function buildLamppost(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.3, 8), MAT.metal);
  base.position.y = 0.15;
  base.castShadow = true;
  g.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 8), MAT.metal);
  pole.position.y = 1.5;
  pole.castShadow = true;
  g.add(pole);
  // Lantern housing + glowing core.
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.34), MAT.metal);
  housing.position.y = 2.95;
  g.add(housing);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.22), MAT.lampGlow);
  glow.position.y = 2.95;
  g.add(glow);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.26, 4), MAT.metal);
  top.position.y = 3.32;
  top.rotation.y = Math.PI / 4;
  g.add(top);
  return g;
}

/** A picnic blanket with a little basket — a cozy named rest spot in the
 *  meadow. Flat on the ground; non-blocking. ~2 m square. */
export function buildPicnicBlanket(): THREE.Group {
  const g = new THREE.Group();
  // Checked blanket: a base cloth + a few alternating squares laid on top.
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 2.0), MAT.cloth);
  base.position.y = 0.03;
  base.receiveShadow = true;
  g.add(base);
  for (let ix = 0; ix < 4; ix++) {
    for (let iz = 0; iz < 4; iz++) {
      if ((ix + iz) % 2 === 0) continue;
      const sq = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.46), MAT.clothAlt);
      sq.position.set(-0.75 + ix * 0.5, 0.06, -0.75 + iz * 0.5);
      g.add(sq);
    }
  }
  // A wicker basket.
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.28, 8), MAT.logEnd);
  basket.position.set(0.5, 0.18, 0.4);
  basket.castShadow = true;
  g.add(basket);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 10, Math.PI), MAT.wood);
  handle.position.set(0.5, 0.32, 0.4);
  handle.rotation.y = Math.PI / 2;
  g.add(handle);
  return g;
}

/** A stone birdbath — a slender pedestal under a shallow bowl of water. A named
 *  meadow accent. ~1.2 m. Solid (gets a collider). */
export function buildBirdbath(): THREE.Group {
  const g = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.16, 12), MAT.stoneDark);
  foot.position.y = 0.08;
  foot.receiveShadow = true;
  g.add(foot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 8), MAT.stone);
  stem.position.y = 0.55;
  stem.castShadow = true;
  g.add(stem);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.28, 0.22, 12), MAT.stone);
  bowl.position.y = 1.05;
  bowl.castShadow = true;
  g.add(bowl);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 12), MAT.water);
  water.position.y = 1.15;
  g.add(water);
  return g;
}

/**
 * Minimal geometry merge (positions + normals + optional colors) so we don't
 * depend on three's BufferGeometryUtils addon. Inputs are primitive geometries;
 * we expand any indexed ones and concatenate. If any input carries a `color`
 * attribute, all inputs contribute colour (missing → white) so the merged
 * geometry stays consistent for vertex-coloured instanced materials.
 */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const anyColor = geos.some((g) => g.getAttribute('color'));
  for (const g of geos) {
    const src = g.index ? g.toNonIndexed() : g;
    const pos = src.getAttribute('position');
    const nrm = src.getAttribute('normal');
    const col = src.getAttribute('color');
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (nrm) normals.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      if (anyColor) {
        if (col) colors.push(col.getX(i), col.getY(i), col.getZ(i));
        else colors.push(1, 1, 1);
      }
    }
    if (src !== g) src.dispose();
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (colors.length) merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return merged;
}
