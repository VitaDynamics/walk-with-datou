import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ModelLoader, assetUrl } from './ModelLoader';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Build a minimal GLTF-shaped object around a scene (the only field we read). */
function fakeGltf(scene: THREE.Object3D): GLTF {
  return {
    scene,
    scenes: [scene],
    animations: [],
    cameras: [],
    asset: {},
    parser: {},
    userData: {},
  } as unknown as GLTF;
}

describe('ModelLoader.prepareInstanceable', () => {
  it('bakes a mesh world transform into the geometry', () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(5, 2, -3);
    const scene = new THREE.Group();
    scene.add(mesh);

    const parts = ModelLoader.prepareInstanceable(fakeGltf(scene));
    expect(parts).toHaveLength(1);
    // The baked geometry's bounding box should be centred on the mesh position.
    parts[0].geo.computeBoundingBox();
    const center = new THREE.Vector3();
    parts[0].geo.boundingBox!.getCenter(center);
    expect(center.x).toBeCloseTo(5, 5);
    expect(center.y).toBeCloseTo(2, 5);
    expect(center.z).toBeCloseTo(-3, 5);
    expect(parts[0].mat).toBe(mat);
  });

  it('splits a multi-material mesh into one part per material group', () => {
    const geo = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    // 12 triangles → 36 verts. Two groups, two materials.
    geo.clearGroups();
    geo.addGroup(0, 18, 0);
    geo.addGroup(18, 18, 1);
    const matA = new THREE.MeshStandardMaterial({ name: 'A' });
    const matB = new THREE.MeshStandardMaterial({ name: 'B' });
    const mesh = new THREE.Mesh(geo, [matA, matB]);
    const scene = new THREE.Group();
    scene.add(mesh);

    const parts = ModelLoader.prepareInstanceable(fakeGltf(scene));
    expect(parts.length).toBe(2);
    const mats = parts.map((p) => p.mat);
    expect(mats).toContain(matA);
    expect(mats).toContain(matB);
  });

  it('inherits parent transforms when baking', () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    mesh.position.set(1, 0, 0);
    const parent = new THREE.Group();
    parent.position.set(10, 0, 0);
    parent.add(mesh);
    const scene = new THREE.Group();
    scene.add(parent);

    const parts = ModelLoader.prepareInstanceable(fakeGltf(scene));
    parts[0].geo.computeBoundingBox();
    const center = new THREE.Vector3();
    parts[0].geo.boundingBox!.getCenter(center);
    expect(center.x).toBeCloseTo(11, 5); // 10 (parent) + 1 (mesh)
  });
});

describe('ModelLoader: cache', () => {
  it('dedupes concurrent loads of the same url (one parse)', async () => {
    const loader = new ModelLoader();
    let calls = 0;
    // Monkeypatch the internal three loader to count loads without network.
    const scene = new THREE.Group();
    (loader as unknown as { loader: { loadAsync: (u: string) => Promise<GLTF> } }).loader = {
      loadAsync: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        return fakeGltf(scene);
      },
    };
    const [a, b] = await Promise.all([loader.load('x.glb'), loader.load('x.glb')]);
    expect(a).toBe(b);
    expect(calls).toBe(1);
    expect(loader.isLoaded('x.glb')).toBe(true);
  });
});

describe('assetUrl', () => {
  it('joins the base url without double slashes', () => {
    expect(assetUrl('models/x.glb')).toMatch(/models\/x\.glb$/);
    expect(assetUrl('/models/x.glb')).not.toMatch(/\/\/models/);
  });
});
