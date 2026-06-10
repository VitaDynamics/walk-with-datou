/**
 * CameraRig — one calm framing of the walk.
 *
 * A fixed-pitch orbit that follows the human (Datou close by), with drag to
 * turn and a restrained zoom whose top end gives a planning overview of the
 * park. All motion is eased; nothing snaps. Far plane covers the 500 m world.
 */

import * as THREE from 'three';

const PITCH = 0.62; // rad — the storybook three-quarter view
const MIN_DIST = 6;
const MAX_DIST = 26;
const DRAG_RATE = 0.0045; // rad per px
const ZOOM_STEP = 1.1;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  private yaw = 0;
  private targetYaw = 0;
  private dist = 10;
  private targetDist = 10;
  private readonly focus = new THREE.Vector3(0, 0, 0.6);

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 900);
    this.update(0, new THREE.Vector3());
  }

  /** Camera azimuth — billboards align to this. */
  get azimuth(): number {
    return this.yaw;
  }

  addDrag(dxPixels: number): void {
    this.targetYaw -= dxPixels * DRAG_RATE;
  }

  addZoom(direction: number): void {
    this.targetDist = THREE.MathUtils.clamp(
      this.targetDist + direction * ZOOM_STEP,
      MIN_DIST,
      MAX_DIST,
    );
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, target: THREE.Vector3): void {
    const k = dt > 0 ? 1 - Math.exp(-dt * 5) : 1;
    this.yaw += (this.targetYaw - this.yaw) * k;
    this.dist += (this.targetDist - this.dist) * k;

    // Follow the walking pair with calm easing (never a hard lock).
    const kf = dt > 0 ? 1 - Math.exp(-dt * 3.2) : 1;
    this.focus.x += (target.x - this.focus.x) * kf;
    this.focus.z += (target.z - this.focus.z) * kf;

    const hr = this.dist * Math.cos(PITCH);
    this.camera.position.set(
      this.focus.x + Math.sin(this.yaw) * hr,
      this.dist * Math.sin(PITCH),
      this.focus.z + Math.cos(this.yaw) * hr,
    );
    this.camera.lookAt(this.focus.x, 0.45, this.focus.z);
  }
}
