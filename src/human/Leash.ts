/**
 * Leash — a hand-inked rope from the human's hand to Datou's harness.
 * A quadratic curve with gravity sag (more slack when they're close),
 * rendered as a slim tube; rebuilt only while visible.
 */

import * as THREE from 'three';
import { INK } from '../art/palette';

const REST_LENGTH = 2.6;
const SEGMENTS = 22;

export class Leash {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly mid = new THREE.Vector3();

  constructor() {
    this.material = new THREE.MeshBasicMaterial({ color: INK.line });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
  }

  setVisible(v: boolean): void {
    this.mesh.visible = v;
  }

  update(hand: THREE.Vector3, harness: THREE.Vector3): void {
    if (!this.mesh.visible) return;
    this.from.copy(hand);
    this.to.copy(harness);
    const dist = this.from.distanceTo(this.to);
    const slack = Math.max(0.06, (REST_LENGTH - dist) * 0.35 + 0.12);
    this.mid
      .addVectors(this.from, this.to)
      .multiplyScalar(0.5)
      .setY(
        Math.min(this.from.y, this.to.y) * 0.5 +
          0.18 -
          slack * 0.5 +
          Math.max(0, dist - REST_LENGTH) * 0.05,
      );
    const curve = new THREE.QuadraticBezierCurve3(this.from, this.mid, this.to);
    const next = new THREE.TubeGeometry(curve, SEGMENTS, 0.016, 5, false);
    this.mesh.geometry.dispose();
    this.mesh.geometry = next;
  }
}
