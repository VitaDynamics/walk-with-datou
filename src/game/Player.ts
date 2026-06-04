import * as THREE from 'three';
import type { InputState } from './Input';

/**
 * The owner avatar. A simple capsule + sphere head; movement is fixed-speed
 * along world-space cardinal directions (no camera-relative steering in
 * Sprint 0 - keeps the controls predictable).
 */
export class Player {
  static readonly SPEED = 4; // m/s
  static readonly PARK_HALF = 28;

  readonly group = new THREE.Group();
  readonly position = { x: 0, y: 0, z: 3 };
  yaw = 0;

  constructor() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x3a8acc,
      flatShading: true,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), bodyMat);
    body.position.y = 0.7;
    body.castShadow = true;
    this.group.add(body);

    const headMat = new THREE.MeshStandardMaterial({
      color: 0xf2d0a4,
      flatShading: true,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), headMat);
    head.position.y = 1.45;
    head.castShadow = true;
    this.group.add(head);

    this.sync();
  }

  update(input: InputState, dt: number): void {
    let vx = 0;
    let vz = 0;
    if (input.forward) vz -= 1;
    if (input.back) vz += 1;
    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    const len = Math.hypot(vx, vz);
    if (len > 0) {
      vx /= len;
      vz /= len;
      this.position.x += vx * Player.SPEED * dt;
      this.position.z += vz * Player.SPEED * dt;
      this.clampToPark();
      this.yaw = Math.atan2(vx, vz);
      this.sync();
    }
  }

  private clampToPark(): void {
    const r = Player.PARK_HALF;
    if (this.position.x > r) this.position.x = r;
    if (this.position.x < -r) this.position.x = -r;
    if (this.position.z > r) this.position.z = r;
    if (this.position.z < -r) this.position.z = -r;
  }

  private sync(): void {
    this.group.position.set(this.position.x, this.position.y, this.position.z);
    this.group.rotation.y = this.yaw;
  }
}
