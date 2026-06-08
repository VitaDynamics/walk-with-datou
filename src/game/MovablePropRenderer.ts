import * as THREE from 'three';
import type { MovableProp } from './MovableProps';
import { ModelLoader } from './assets/ModelLoader';
import { catalog } from './World';

/**
 * Renders the live MovableProps (Phase 4) — one Object3D per prop, its transform
 * rewritten each frame from the prop's kinematic state (incl. the cosmetic throw
 * `renderY` arc and a toppled/broken pose). Procedural kinds build synchronously;
 * GLB kinds clone a lazily-loaded model. Kept out of Game.ts to keep the loop lean.
 */
export class MovablePropRenderer {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<number, THREE.Object3D>();
  private readonly loader: ModelLoader;

  constructor(loader = new ModelLoader()) {
    this.loader = loader;
  }

  /** Build a mesh for every prop that doesn't have one yet. */
  sync(props: readonly MovableProp[]): void {
    for (const p of props) {
      if (this.meshes.has(p.id)) continue;
      const obj = this.build(p);
      obj.userData.movablePropId = p.id;
      this.meshes.set(p.id, obj);
      this.group.add(obj);
    }
  }

  /** Raycast the prop meshes; return the hovered prop id, or null. Walks up to
   *  the holder that carries `userData.movablePropId` so any sub-mesh hit counts. */
  raycast(raycaster: THREE.Raycaster): number | null {
    const hits = raycaster.intersectObjects(this.group.children, true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        const id = o.userData.movablePropId;
        if (typeof id === 'number') return id;
        o = o.parent;
      }
    }
    return null;
  }

  /** Rewrite every prop's transform from its kinematic state, and drop meshes
   *  for props that no longer exist (e.g. collected into Datou's backpack). */
  update(props: readonly MovableProp[]): void {
    const live = new Set<number>();
    for (const p of props) {
      live.add(p.id);
      const obj = this.meshes.get(p.id);
      if (!obj) continue;
      // A Datou-carried item rides at mouth height; everything else on the ground
      // (plus the cosmetic throw arc in renderY).
      const y = p.state === 'carried' && p.carriedBy === 'datou' ? 0.6 : p.renderY;
      obj.position.set(p.x, y, p.z);
      obj.rotation.set(p.state === 'toppled' ? Math.PI / 2 : 0, p.yaw, 0);
      obj.scale.setScalar(p.state === 'broken' ? p.scale * 0.4 : p.scale);
      obj.visible = p.state !== 'broken'; // scatter pieces handled by particles later
    }
    for (const [id, obj] of this.meshes) {
      if (live.has(id)) continue;
      this.group.remove(obj);
      this.meshes.delete(id);
    }
  }

  private build(p: MovableProp): THREE.Object3D {
    const kind = catalog.get(p.kindId);
    const holder = new THREE.Group();
    holder.position.set(p.x, p.renderY, p.z);

    if (!kind) {
      holder.add(placeholderMesh(p.radius));
      return holder;
    }

    if (kind.mesh.kind === 'procedural') {
      const { geo, mat } = kind.mesh.build();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      holder.add(mesh);
    } else if (kind.mesh.kind === 'procedural-group') {
      holder.add((kind.mesh as { build: () => THREE.Object3D }).build());
    } else {
      // GLB: show a placeholder until the model loads, then swap it in.
      const placeholder = placeholderMesh(p.radius);
      holder.add(placeholder);
      void this.loader
        .load(kind.mesh.url)
        .then((gltf) => {
          holder.remove(placeholder);
          const model = gltf.scene.clone(true);
          model.traverse((o) => {
            const m = o as THREE.Mesh;
            if ((m as THREE.Mesh).isMesh) m.castShadow = true;
          });
          holder.add(model);
        })
        .catch(() => {
          /* keep the placeholder */
        });
    }
    return holder;
  }
}

function placeholderMesh(radius: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.15, radius), 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xd98a4e, flatShading: true }),
  );
  mesh.position.y = radius;
  mesh.castShadow = true;
  return mesh;
}
