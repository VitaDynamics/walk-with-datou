import * as THREE from 'three';
import { resolveCircleCollisions } from './collision';
import type { InputState } from './Input';
import type { Collider } from './World';

/**
 * The owner avatar. A simple capsule + sphere head; movement is fixed-speed and
 * camera-relative. After moving, the player is pushed out of any park
 * obstacles via the shared collider list.
 */
export class Player {
  static readonly SPEED = 4; // m/s
  static readonly PARK_HALF = 28;
  static readonly RADIUS = 0.35; // collision radius

  readonly group = new THREE.Group();
  readonly position = { x: 0, y: 0, z: 3 };
  yaw = 0;

  private colliders: readonly Collider[] = [];

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

  /** Provide the park obstacles the player should collide with. */
  setColliders(colliders: readonly Collider[]): void {
    this.colliders = colliders;
  }

  /**
   * Move the player. Input directions are interpreted relative to the camera
   * via `viewYaw` (radians, the camera's horizontal angle), so "forward" is
   * always away from the camera regardless of how the view has been dragged.
   */
  update(input: InputState, dt: number, viewYaw = 0): void {
    let ix = 0;
    let iz = 0;
    if (input.forward) iz -= 1;
    if (input.back) iz += 1;
    if (input.left) ix -= 1;
    if (input.right) ix += 1;
    const len = Math.hypot(ix, iz);
    if (len === 0) return;

    ix /= len;
    iz /= len;

    // Rotate the screen-space intent into world space by the camera yaw.
    // The rig's yaw=0 looks down +Z, matching the original "forward = -Z" feel.
    const cos = Math.cos(viewYaw);
    const sin = Math.sin(viewYaw);
    const vx = ix * cos + iz * sin;
    const vz = -ix * sin + iz * cos;

    this.position.x += vx * Player.SPEED * dt;
    this.position.z += vz * Player.SPEED * dt;
    this.clampToPark();
    resolveCircleCollisions(this.position, Player.RADIUS, this.colliders);
    this.yaw = Math.atan2(vx, vz);
    this.sync();
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
