/**
 * World — the 500×500 m hand-painted park, rendered cheap.
 *
 * One painted floor (zone stains, lake, paths, baked prop shadows), a
 * detailed glade disc at home, a handful of unique landmark plates, and
 * EVERYTHING else as InstancedMesh billboard batches: ~1000 scattered plates
 * in ~45 draw calls. Instances share the camera yaw, so billboarding is one
 * matrix pass per batch, only when the camera turns.
 */

import * as THREE from 'three';
import { PAPER } from '../art/palette';
import {
  drawBench,
  drawBerry,
  drawBulletin,
  drawBush,
  drawDiscovery,
  drawFlower,
  drawGrassTuft,
  drawJetty,
  drawLamp,
  drawMushroom,
  drawPad,
  drawPebble,
  drawPicnicTable,
  drawPine,
  drawPinecone,
  drawReed,
  drawRock,
  drawSignpost,
  drawStump,
  drawTree,
  drawTwig,
  drawFallenLog,
  drawFern,
  drawCattail,
  drawAnthill,
  type PropSprite,
} from '../art/props';
import { canvasTexture, paintContactShadow, paintGlade } from '../art/textures';
import { paintWorld, type ShadowStamp } from '../art/worldPaint';
import { Cutout, setSharedShadowTexture } from './Cutout';
import { MAJOR_PROPS, PAD_POSITION, WORLD_SEED, worldColliders } from './layout';
import {
  kindDef,
  scatterPickables,
  scatterStatic,
  type ScatterInstance,
  type ScatterKind,
} from './scatter';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Spot } from './Spots';
import type { WorldCollider } from '../physics/PhysicsAdapter';

const DRAW: Record<ScatterKind, (seed: number) => PropSprite> = {
  tree: drawTree,
  pine: drawPine,
  bush: drawBush,
  rock: drawRock,
  stump: drawStump,
  grass: drawGrassTuft,
  flower: drawFlower,
  reed: drawReed,
  mushroom: drawMushroom,
  lamp: drawLamp,
  bench: drawBench,
  signpost: drawSignpost,
  twig: drawTwig,
  pebble: drawPebble,
  berry: drawBerry,
  pinecone: drawPinecone,
  'fallen-log': drawFallenLog,
  fern: drawFern,
  cattail: drawCattail,
  anthill: drawAnthill,
};

const VARIANTS = 3;

interface BatchInstance extends ScatterInstance {
  alive: boolean;
  batch: Batch;
  slot: number;
}

interface Batch {
  mesh: THREE.InstancedMesh;
  items: BatchInstance[];
  /** Cross batches are static — never re-billboarded. */
  isCross: boolean;
}

interface RevealAnim {
  cutout: Cutout;
  t: number;
}

export class World {
  readonly group = new THREE.Group();
  readonly groundMesh: THREE.Mesh;
  readonly colliders: WorldCollider[];
  readonly padPosition = PAD_POSITION;
  /** The painted floor canvas — the minimap draws from it. */
  readonly paintCanvas: HTMLCanvasElement;

  /** Every scattered instance, queryable for interaction/gathering. */
  private readonly instances = new Map<string, BatchInstance>();
  private readonly batches: Batch[] = [];
  private readonly cutouts: Cutout[] = [];
  private readonly reveals: RevealAnim[] = [];
  private lastYaw = Infinity;
  private readonly dummy = new THREE.Object3D();

  constructor(dailySeed: number, pickedIds: readonly string[]) {
    setSharedShadowTexture(canvasTexture(paintContactShadow()));

    const statics = scatterStatic(WORLD_SEED);
    const pickables = scatterPickables(dailySeed);

    // Paper underlay far past the painted world.
    const paper = new THREE.Mesh(
      new THREE.CircleGeometry(620, 48),
      new THREE.MeshBasicMaterial({ color: PAPER.floor }),
    );
    paper.rotation.x = -Math.PI / 2;
    paper.position.y = -0.04;
    this.group.add(paper);

    // The painted world floor (shadows of all static plates baked in).
    const stamps: ShadowStamp[] = [];
    for (const inst of statics) {
      const def = kindDef(inst.kind);
      if (def.collider > 0 || inst.kind === 'stump') {
        stamps.push({ x: inst.x, z: inst.z, r: Math.max(0.5, def.collider * 1.6) });
      }
    }
    for (const p of MAJOR_PROPS) stamps.push({ x: p.x, z: p.z, r: p.shadowRadius });
    this.paintCanvas = paintWorld(WORLD_SEED, stamps);
    const worldTex = canvasTexture(this.paintCanvas);
    this.groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520),
      new THREE.MeshBasicMaterial({ map: worldTex, transparent: true }),
    );
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.group.add(this.groundMesh);

    // Detailed glade disc at home (close-up richness where sessions start).
    const glade = new THREE.Mesh(
      new THREE.CircleGeometry(8 / 0.92, 48),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(paintGlade(WORLD_SEED)),
        transparent: true,
      }),
    );
    glade.rotation.x = -Math.PI / 2;
    glade.position.y = 0.004;
    this.group.add(glade);

    // Unique landmark plates + zone setpieces.
    const draw = {
      tree: drawTree,
      rock: drawRock,
      bush: drawBush,
      stump: drawStump,
      lamp: drawLamp,
      pine: drawPine,
      bench: drawBench,
      signpost: drawSignpost,
      jetty: drawJetty,
      picnic: drawPicnicTable,
      bulletin: drawBulletin,
      mushroom: drawMushroom,
    };
    for (const p of MAJOR_PROPS) {
      const cut = new Cutout(draw[p.kind](p.seed), {
        height: p.height,
        shadowRadius: p.shadowRadius,
        decal: p.decal,
      });
      cut.setPosition(p.x, p.z);
      this.group.add(cut.group);
      this.cutouts.push(cut);
    }

    // Your pad.
    const pad = new Cutout(drawPad(61), { height: 1.5, decal: true });
    pad.setPosition(PAD_POSITION.x, PAD_POSITION.z);
    this.group.add(pad.group);
    this.cutouts.push(pad);

    // Instanced batches for all scatter.
    this.buildBatches(statics, false);
    this.buildBatches(pickables, true);

    // Already-gathered resources stay gone for the day.
    for (const id of pickedIds) this.removeInstance(id);

    this.colliders = worldColliders();
  }

  private buildBatches(instances: readonly ScatterInstance[], pickable: boolean): void {
    // Group instances by kind + variant so each batch shares one texture.
    const groups = new Map<string, ScatterInstance[]>();
    for (const inst of instances) {
      const variant = inst.seed % VARIANTS;
      const key = `${inst.kind}:${variant}`;
      let list = groups.get(key);
      if (!list) groups.set(key, (list = []));
      list.push(inst);
    }
    for (const [key, list] of groups) {
      const [kind, variantStr] = key.split(':') as [ScatterKind, string];
      const isCross = kindDef(kind).render === 'cross';
      const sprite = DRAW[kind](WORLD_SEED + kind.length * 1000 + Number(variantStr) * 97);
      const plane = new THREE.PlaneGeometry(sprite.aspect, 1);
      plane.translate(0, 0.5, 0);
      let geo: THREE.BufferGeometry = plane;
      if (isCross) {
        // Two crossed planes — reads from every angle with NO per-frame work.
        const second = plane.clone().rotateY(Math.PI / 2);
        geo = mergeGeometries([plane, second])!;
      }
      const mat = new THREE.MeshBasicMaterial({
        map: canvasTexture(sprite.canvas),
        transparent: true,
        alphaTest: 0.08,
        depthWrite: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      if (!isCross) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const batch: Batch = { mesh, items: [], isCross };
      list.forEach((inst, slot) => {
        const item: BatchInstance = { ...inst, alive: true, batch, slot };
        batch.items.push(item);
        this.instances.set(inst.id, item);
        if (isCross) this.writeMatrix(batch, item, (inst.seed % 628) / 100);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.batches.push(batch);
      this.group.add(mesh);
      void pickable;
    }
  }

  private writeMatrix(batch: Batch, item: BatchInstance, yaw: number): void {
    this.dummy.position.set(item.x, 0, item.z);
    this.dummy.rotation.set(0, yaw, 0);
    const sc = item.alive ? item.height : 0.0001;
    this.dummy.scale.set(sc, sc, sc);
    this.dummy.updateMatrix();
    batch.mesh.setMatrixAt(item.slot, this.dummy.matrix);
  }

  /** Billboard the dynamic batches to the camera yaw (only when it changed).
   *  Cross batches refresh only when an instance was removed. */
  private updateBatchMatrices(camYaw: number, crossToo: boolean): void {
    for (const batch of this.batches) {
      if (batch.isCross && !crossToo) continue;
      for (const item of batch.items) {
        this.writeMatrix(batch, item, batch.isCross ? (item.seed % 628) / 100 : camYaw);
      }
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Nearest live scattered instance to a point, optionally pickable-only. */
  nearestInstance(
    x: number,
    z: number,
    maxDist: number,
    pickableOnly = false,
  ): BatchInstance | null {
    let best: BatchInstance | null = null;
    let bestD = maxDist;
    for (const item of this.instances.values()) {
      if (!item.alive) continue;
      if (pickableOnly && !kindDef(item.kind).pickable) continue;
      const d = Math.hypot(item.x - x, item.z - z);
      if (d <= bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  }

  /** Nearest live pickable of a specific kind within range (forage, §7). */
  nearestPickableOfKind(kind: string, x: number, z: number, maxDist: number): BatchInstance | null {
    let best: BatchInstance | null = null;
    let bestD = maxDist;
    for (const item of this.instances.values()) {
      if (!item.alive || item.kind !== kind) continue;
      if (!kindDef(item.kind).pickable) continue;
      const d = Math.hypot(item.x - x, item.z - z);
      if (d <= bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  }

  /** Remove a gathered/consumed instance from the world. */
  removeInstance(id: string): boolean {
    const item = this.instances.get(id);
    if (!item || !item.alive) return false;
    item.alive = false;
    this.writeMatrix(item.batch, item, 0);
    item.batch.mesh.instanceMatrix.needsUpdate = true;
    return true;
  }

  /** Pop a discovered thing into the world (gentle grow-in). */
  revealSpot(spot: Spot): void {
    const cut = new Cutout(drawDiscovery(spot.art, WORLD_SEED + spot.id), {
      height: 0.42,
      shadowRadius: 0.22,
      renderOrder: 2,
    });
    cut.setPosition(spot.x, spot.z);
    cut.group.scale.setScalar(0.01);
    this.group.add(cut.group);
    this.cutouts.push(cut);
    this.reveals.push({ cutout: cut, t: 0 });
  }

  /** Place a player-built plate into the world (crafting/build system). */
  placeCutout(cut: Cutout, x: number, z: number): void {
    cut.setPosition(x, z);
    this.group.add(cut.group);
    this.cutouts.push(cut);
  }

  /** Take a placed plate back out (the player picked the keepsake up). */
  removeCutout(cut: Cutout): void {
    const i = this.cutouts.indexOf(cut);
    if (i >= 0) this.cutouts.splice(i, 1);
    cut.group.removeFromParent();
    cut.dispose();
  }

  update(dt: number, camYaw: number): void {
    for (const c of this.cutouts) c.faceCamera(camYaw);
    if (Math.abs(camYaw - this.lastYaw) > 0.002) {
      const first = this.lastYaw === Infinity;
      this.lastYaw = camYaw;
      this.updateBatchMatrices(camYaw, first);
    }
    for (let i = this.reveals.length - 1; i >= 0; i--) {
      const r = this.reveals[i];
      r.t = Math.min(1, r.t + dt / 0.6);
      const s = 1 - Math.pow(1 - r.t, 3);
      r.cutout.group.scale.setScalar(Math.max(0.01, s));
      if (r.t >= 1) this.reveals.splice(i, 1);
    }
  }
}

export type { BatchInstance };
