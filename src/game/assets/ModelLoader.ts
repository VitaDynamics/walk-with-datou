import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * GLB/glTF asset loader for the data-driven item catalog (catalog/).
 *
 * The park's original dressing is 100% procedural THREE primitives (props.ts).
 * To scale variety to ~1000 kinds we add downloadable CC0 GLB models alongside
 * the procedural props. This module is the only place that touches GLTFLoader.
 *
 * Design points:
 * - **Cache + dedupe.** A GLB is parsed at most once; concurrent requests for
 *   the same url share one in-flight promise. Catalog kinds reference a model by
 *   url, so many instances of one kind cost a single load.
 * - **Instanceable output.** `prepareInstanceable` flattens a loaded scene graph
 *   into a flat list of `{ geo, mat }` parts with each mesh's world transform
 *   *baked into the geometry*, so the result feeds the existing `instanced()` /
 *   `instancedMulti()` path in props.ts exactly like a procedural geometry. We
 *   deliberately do NOT route GLB through props.ts `mergeGeometries` (that helper
 *   drops UVs/tangents/skinning — fine for procedural flat-shaded props, wrong
 *   for textured GLB).
 * - **No bundling.** GLB live under `public/models/...` and are fetched at
 *   runtime, so the 1000 models never enter the JS bundle. Reference them with
 *   `assetUrl()` so they resolve under Vite's `base: './'` and any deploy subpath.
 */

/** A flat, instanceable piece of a model: one geometry + one material. */
export interface InstanceablePart {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

/**
 * Resolve a `public/`-relative asset path to a runtime URL that works under
 * Vite's `base: './'` and any deploy subpath. Pass a path WITHOUT a leading
 * slash, e.g. `assetUrl('models/toy/ball.glb')`.
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const sep = base.endsWith('/') ? '' : '/';
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${sep}${clean}`;
}

export class ModelLoader {
  private readonly loader = new GLTFLoader();
  private readonly inFlight = new Map<string, Promise<GLTF>>();
  private readonly resolved = new Map<string, GLTF>();

  /**
   * Load (or return the cached) parsed GLTF for a url. Concurrent callers for
   * the same url share one network/parse. The url should come from `assetUrl()`.
   */
  load(url: string): Promise<GLTF> {
    const cached = this.resolved.get(url);
    if (cached) return Promise.resolve(cached);

    const existing = this.inFlight.get(url);
    if (existing) return existing;

    const promise = this.loader
      .loadAsync(url)
      .then((gltf) => {
        normalizeMaterials(gltf);
        this.resolved.set(url, gltf);
        this.inFlight.delete(url);
        return gltf;
      })
      .catch((err) => {
        this.inFlight.delete(url);
        throw err;
      });

    this.inFlight.set(url, promise);
    return promise;
  }

  /** True if the url has finished loading and is cached. */
  isLoaded(url: string): boolean {
    return this.resolved.has(url);
  }

  /** The cached GLTF for a url, or undefined if not loaded yet. */
  get(url: string): GLTF | undefined {
    return this.resolved.get(url);
  }

  /**
   * Flatten a loaded GLTF scene into instanceable parts: one `{ geo, mat }` per
   * (mesh, material), with the mesh's world transform baked into a cloned
   * geometry so the part sits at the model's intended local pose when instanced
   * at the origin. Groups parts by material so the caller can build one
   * InstancedMesh per material (draw calls = distinct materials, not instances).
   */
  static prepareInstanceable(gltf: GLTF): InstanceablePart[] {
    const parts: InstanceablePart[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as THREE.Mesh).isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const groups =
        mesh.geometry.groups && mesh.geometry.groups.length > 0 ? mesh.geometry.groups : null;

      if (mats.length <= 1 || !groups) {
        // Single-material mesh: bake world transform into a clone.
        const geo = mesh.geometry.clone();
        geo.applyMatrix4(mesh.matrixWorld);
        parts.push({ geo, mat: mats[0] });
        return;
      }

      // Multi-material mesh: split by geometry group so each material gets its
      // own geometry (the catalog instances each part separately).
      for (const g of groups) {
        const sub = extractGroup(mesh.geometry, g.start, g.count);
        sub.applyMatrix4(mesh.matrixWorld);
        parts.push({ geo: sub, mat: mats[g.materialIndex ?? 0] });
      }
    });
    return parts;
  }

  /** Dispose a cached model's geometries/materials and drop it from the cache. */
  dispose(url: string): void {
    const gltf = this.resolved.get(url);
    if (!gltf) return;
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as THREE.Mesh).isMesh) return;
      mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) m.dispose();
    });
    this.resolved.delete(url);
  }
}

/**
 * Make a loaded GLB render correctly in our flat-lit scene. Kenney/Quaternius
 * CC0 models carry a baseColor **atlas texture** (named "colormap") addressed via
 * `KHR_texture_transform` per mesh — GLTFLoader applies the transform, but we
 * also (a) ensure the colour-map is treated as sRGB so it isn't washed out, and
 * (b) guarantee the texture survives by keeping `map` and forcing a needsUpdate.
 * Without this some atlas-textured models read as flat/untextured.
 */
function normalizeMaterials(gltf: GLTF): void {
  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as THREE.Mesh).isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      if (std.map) {
        std.map.colorSpace = THREE.SRGBColorSpace;
        std.map.needsUpdate = true;
      }
      // Kenney atlases are matte; keep them readable under the warm sun.
      if (std.isMeshStandardMaterial) {
        std.roughness = std.roughness ?? 1;
        std.metalness = 0;
      }
      std.needsUpdate = true;
    }
  });
}

/**
 * Extract a [start, start+count) slice of an indexed/non-indexed geometry into a
 * standalone non-indexed BufferGeometry (positions/normals/uvs/color carried
 * over). Used to split multi-material GLB meshes by material group.
 */
function extractGroup(
  geo: THREE.BufferGeometry,
  start: number,
  count: number,
): THREE.BufferGeometry {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const out = new THREE.BufferGeometry();
  const copyAttr = (name: string): void => {
    const attr = src.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!attr) return;
    const itemSize = attr.itemSize;
    const sliced = new Float32Array(count * itemSize);
    // When the source was indexed, toNonIndexed() expands triangles so the
    // group's [start,count) refers directly to vertex positions.
    const base = geo.index ? start : start;
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < itemSize; c++) {
        sliced[i * itemSize + c] = attr.getComponent(base + i, c);
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(sliced, itemSize));
  };
  copyAttr('position');
  copyAttr('normal');
  copyAttr('uv');
  copyAttr('color');
  if (src !== geo) src.dispose();
  return out;
}
