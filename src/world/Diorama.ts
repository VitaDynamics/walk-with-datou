/**
 * Diorama — the glade Datou lives in.
 *
 * One intimate hand-painted scene (~13 m across) per the baseline: ≤5 major
 * objects, robot-scale, a single warm focal space. Built entirely from cutout
 * plates over a painted ground disc on paper. Deterministic: same seed, same
 * glade.
 */

import * as THREE from 'three';
import { Rng } from '../physics/mujoco/rng';
import { PAPER } from '../art/palette';
import {
  drawBush,
  drawDiscovery,
  drawFlower,
  drawGrassTuft,
  drawLamp,
  drawPad,
  drawRock,
  drawStump,
  drawTree,
} from '../art/props';
import { canvasTexture, paintContactShadow, paintGlade } from '../art/textures';
import { Cutout, setSharedShadowTexture } from './Cutout';
import type { Spot, SpotAnchor } from './Spots';
import type { WorldCollider } from '../physics/PhysicsAdapter';

export const GLADE_RADIUS = 8;
/** Clamp for anything that walks (kept inside the painted edge). */
export const WALK_RADIUS = 6.2;

const WORLD_SEED = 0x5eed_da70;

interface RevealAnim {
  cutout: Cutout;
  t: number;
  targetHeight: number;
}

export class Diorama {
  readonly group = new THREE.Group();
  readonly groundMesh: THREE.Mesh;
  readonly colliders: WorldCollider[] = [];
  readonly spotAnchors: readonly SpotAnchor[];
  readonly padPosition = { x: 0, z: 3.2 };

  private readonly cutouts: Cutout[] = [];
  private readonly reveals: RevealAnim[] = [];

  constructor() {
    setSharedShadowTexture(canvasTexture(paintContactShadow()));

    // Paper floor far beyond the glade (the diorama sits on paper).
    const paper = new THREE.Mesh(
      new THREE.CircleGeometry(60, 48),
      new THREE.MeshBasicMaterial({ color: PAPER.floor }),
    );
    paper.rotation.x = -Math.PI / 2;
    paper.position.y = -0.02;
    this.group.add(paper);

    // The painted glade disc (hand-cut irregular edge lives in the texture).
    const gladeTex = canvasTexture(paintGlade(WORLD_SEED));
    this.groundMesh = new THREE.Mesh(
      new THREE.CircleGeometry(GLADE_RADIUS / 0.46 / 2, 64),
      new THREE.MeshBasicMaterial({ map: gladeTex, transparent: true }),
    );
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.group.add(this.groundMesh);

    // --- Major plates (the ≤5 anchors of the scene) ---
    this.place(drawTree(11), -3.6, -2.2, { height: 4.4, shadowRadius: 1.5 }, 0.45);
    this.place(drawRock(21), 3.4, -1.6, { height: 1.05, shadowRadius: 0.95 }, 0.7);
    this.place(drawRock(22), 4.15, -0.7, { height: 0.62, shadowRadius: 0.55 }, 0.4);
    this.place(drawBush(31), -3.4, 1.7, { height: 1.0, shadowRadius: 1.05 }, 0.8);
    this.place(drawStump(41), 2.2, -3.4, { height: 0.78, shadowRadius: 0.7 }, 0.45);
    this.place(drawLamp(51), 1.7, 3.5, { height: 1.7, shadowRadius: 0.42 }, 0.22);

    // Your spot — the resting pad (flat decal, no collider: it's walkable).
    const pad = new Cutout(drawPad(61), { height: 1.5, decal: true });
    pad.setPosition(this.padPosition.x, this.padPosition.z);
    this.group.add(pad.group);
    this.cutouts.push(pad);

    // --- Small scatter: grass tufts and flowers (deterministic) ---
    const rng = new Rng(WORLD_SEED ^ 0x77);
    let placed = 0;
    while (placed < 14) {
      const a = rng.next() * Math.PI * 2;
      const d = 1.6 + Math.sqrt(rng.next()) * (WALK_RADIUS - 0.8);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (this.nearCollider(x, z, 0.7) || Math.hypot(x - 0, z - 3.2) < 1.4) continue;
      const flower = rng.next() < 0.28;
      const sprite = flower ? drawFlower(100 + placed) : drawGrassTuft(200 + placed);
      const cut = new Cutout(sprite, { height: flower ? 0.55 : 0.42 });
      cut.setPosition(x, z);
      this.group.add(cut.group);
      this.cutouts.push(cut);
      placed++;
    }

    // Hiding places for today's discoveries (near the landmarks).
    this.spotAnchors = [
      { place: 'under-tree', x: -2.6, z: -1.4 },
      { place: 'behind-rock', x: 3.9, z: -2.4 },
      { place: 'by-stump', x: 1.5, z: -2.8 },
      { place: 'under-bush', x: -2.7, z: 2.4 },
      { place: 'glade-east', x: 5.0, z: 0.9 },
      { place: 'glade-north', x: 0.4, z: -4.7 },
      { place: 'by-lamp', x: 2.6, z: 2.8 },
    ];
  }

  private place(
    sprite: { canvas: HTMLCanvasElement; aspect: number },
    x: number,
    z: number,
    opts: { height: number; shadowRadius?: number },
    colliderRadius?: number,
  ): Cutout {
    const cut = new Cutout(sprite, opts);
    cut.setPosition(x, z);
    this.group.add(cut.group);
    this.cutouts.push(cut);
    if (colliderRadius) this.colliders.push({ x, z, radius: colliderRadius });
    return cut;
  }

  private nearCollider(x: number, z: number, margin: number): boolean {
    return this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.radius + margin);
  }

  /** Pop a discovered thing into the world (gentle grow-in, no fireworks). */
  revealSpot(spot: Spot): void {
    const targetHeight = 0.42;
    const cut = new Cutout(drawDiscovery(spot.art, WORLD_SEED + spot.id), {
      height: targetHeight,
      shadowRadius: 0.22,
      renderOrder: 2,
    });
    cut.setPosition(spot.x, spot.z);
    cut.group.scale.setScalar(0.01);
    this.group.add(cut.group);
    this.cutouts.push(cut);
    this.reveals.push({ cutout: cut, t: 0, targetHeight });
  }

  /** Per-frame: billboard all plates + advance reveal animations. */
  update(dt: number, camYaw: number): void {
    for (const c of this.cutouts) c.faceCamera(camYaw);
    for (let i = this.reveals.length - 1; i >= 0; i--) {
      const r = this.reveals[i];
      r.t = Math.min(1, r.t + dt / 0.6);
      // Smooth ease-out grow (no elastic overshoot — baseline motion rules).
      const s = 1 - Math.pow(1 - r.t, 3);
      r.cutout.group.scale.setScalar(Math.max(0.01, s));
      if (r.t >= 1) this.reveals.splice(i, 1);
    }
  }
}
