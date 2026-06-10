/**
 * CameraRig — one calm framing of the diorama.
 *
 * A fixed-pitch orbit around the glade center that leans gently toward Datou
 * (the robot stays the focal point without the camera chasing it). The player
 * can turn the diorama by dragging and zoom within quiet limits. All motion
 * is eased; nothing snaps.
 */

import * as THREE from 'three';

const PITCH = 0.62; // rad — the storybook three-quarter view
const MIN_DIST = 7;
const MAX_DIST = 14;
const DRAG_RATE = 0.0045; // rad per px
const ZOOM_STEP = 0.8;
/** How far the focus leans toward Datou (0 = locked center, 1 = full follow). */
const LEAN = 0.38;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  private yaw = 0;
  private targetYaw = 0;
  private dist = 11;
  private targetDist = 11;
  private readonly focus = new THREE.Vector3(0, 0, 0.6);

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 120);
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

  update(dt: number, datouPos: THREE.Vector3): void {
    const k = dt > 0 ? 1 - Math.exp(-dt * 5) : 1;
    this.yaw += (this.targetYaw - this.yaw) * k;
    this.dist += (this.targetDist - this.dist) * k;

    // Lean the focus toward Datou, slowly (slower than the orbit easing).
    const kf = dt > 0 ? 1 - Math.exp(-dt * 1.8) : 1;
    this.focus.x += (datouPos.x * LEAN - this.focus.x) * kf;
    this.focus.z += (datouPos.z * LEAN + 0.6 - this.focus.z) * kf;

    const hr = this.dist * Math.cos(PITCH);
    this.camera.position.set(
      this.focus.x + Math.sin(this.yaw) * hr,
      this.dist * Math.sin(PITCH),
      this.focus.z + Math.cos(this.yaw) * hr,
    );
    this.camera.lookAt(this.focus.x, 0.45, this.focus.z);
  }
}
