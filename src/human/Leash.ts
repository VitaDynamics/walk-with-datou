/**
 * Leash — a real little rope, max 2 m.
 *
 * A verlet chain: point masses with gravity, pinned at the hand and the
 * harness, relaxed with distance constraints each frame. Hangs in a loose
 * curve when the pair is close, pulls taut when Datou reaches the end of it.
 * Rendered as a slim ink tube through the simulated points.
 */

import * as THREE from 'three';
import { INK } from '../art/palette';

export const LEASH_LENGTH = 2.0; // metres, hard max
const POINTS = 14;
const SEG = LEASH_LENGTH / (POINTS - 1);
const GRAVITY = -5.2; // gentle — it's a light rope, and calm reads better
const ITERATIONS = 4;
const DAMPING = 0.985;

export class Leash {
  readonly mesh: THREE.Mesh;
  private readonly pos: THREE.Vector3[] = [];
  private readonly prev: THREE.Vector3[] = [];
  private readonly curvePts: THREE.Vector3[] = [];
  private initialized = false;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: INK.line }),
    );
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < POINTS; i++) {
      this.pos.push(new THREE.Vector3());
      this.prev.push(new THREE.Vector3());
      this.curvePts.push(new THREE.Vector3());
    }
  }

  setVisible(v: boolean): void {
    if (this.mesh.visible && !v) this.initialized = false;
    this.mesh.visible = v;
  }

  update(dt: number, hand: THREE.Vector3, harness: THREE.Vector3): void {
    if (!this.mesh.visible) return;

    if (!this.initialized) {
      // Lay the rope along the line between the anchors.
      for (let i = 0; i < POINTS; i++) {
        const t = i / (POINTS - 1);
        this.pos[i].lerpVectors(hand, harness, t);
        this.prev[i].copy(this.pos[i]);
      }
      this.initialized = true;
    }

    // Verlet integration for the interior points.
    const dt2 = Math.min(dt, 1 / 30) ** 2;
    for (let i = 1; i < POINTS - 1; i++) {
      const p = this.pos[i];
      const vx = (p.x - this.prev[i].x) * DAMPING;
      const vy = (p.y - this.prev[i].y) * DAMPING;
      const vz = (p.z - this.prev[i].z) * DAMPING;
      this.prev[i].copy(p);
      p.x += vx;
      p.y += vy + GRAVITY * dt2;
      p.z += vz;
      if (p.y < 0.02) p.y = 0.02; // rope rests on the ground, never sinks
    }

    // Pin the ends, then relax segment lengths.
    this.pos[0].copy(hand);
    this.pos[POINTS - 1].copy(harness);
    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (let i = 0; i < POINTS - 1; i++) {
        const a = this.pos[i];
        const b = this.pos[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dy, dz) || 1e-6;
        const diff = (dist - SEG) / dist;
        const aPinned = i === 0;
        const bPinned = i + 1 === POINTS - 1;
        const wa = aPinned ? 0 : bPinned ? 1 : 0.5;
        const wb = bPinned ? 0 : aPinned ? 1 : 0.5;
        a.x += dx * diff * wa;
        a.y += dy * diff * wa;
        a.z += dz * diff * wa;
        b.x -= dx * diff * wb;
        b.y -= dy * diff * wb;
        b.z -= dz * diff * wb;
      }
    }

    for (let i = 0; i < POINTS; i++) this.curvePts[i].copy(this.pos[i]);
    const curve = new THREE.CatmullRomCurve3(this.curvePts);
    const next = new THREE.TubeGeometry(curve, 26, 0.015, 5, false);
    this.mesh.geometry.dispose();
    this.mesh.geometry = next;
  }
}
