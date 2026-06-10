/**
 * CameraRig — one calm framing of the walk.
 *
 * A fixed-pitch orbit that follows the human (Datou close by), with drag to
 * turn and a restrained zoom whose top end gives a planning overview of the
 * park. All motion is eased; nothing snaps. Far plane covers the 500 m world.
 */

import * as THREE from 'three';

const PITCH = 0.62; // rad — the storybook three-quarter view
const PITCH_OVERVIEW = 1.12; // near top-down for the whole-map view
const MIN_DIST = 6;
const MAX_DIST = 26;
const MIN_DIST_OVERVIEW = 40;
const MAX_DIST_OVERVIEW = 430;
const OVERVIEW_DIST = 330;
const DRAG_RATE = 0.0045; // rad per px
const ZOOM_STEP = 1.1;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  private yaw = 0;
  private targetYaw = 0;
  private dist = 10;
  private targetDist = 10;
  private pitch = PITCH;
  private overviewOn = false;
  private readonly focus = new THREE.Vector3(0, 0, 0.6);
  private readonly panFocus = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 900);
    this.update(0, new THREE.Vector3());
  }

  /** Camera azimuth — billboards align to this. */
  get azimuth(): number {
    return this.yaw;
  }

  get overview(): boolean {
    return this.overviewOn;
  }

  /** Toggle the whole-map overview (creator view). */
  toggleOverview(): boolean {
    this.overviewOn = !this.overviewOn;
    if (this.overviewOn) {
      this.panFocus.copy(this.focus);
      this.targetDist = OVERVIEW_DIST;
    } else {
      this.targetDist = 10;
    }
    return this.overviewOn;
  }

  addDrag(dxPixels: number, dyPixels = 0): void {
    if (this.overviewOn) {
      // Pan the map under the camera.
      const rate = this.dist * 0.0016;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      this.panFocus.x -= (dxPixels * cos - dyPixels * sin) * rate;
      this.panFocus.z -= (-dxPixels * sin - dyPixels * cos) * rate;
      return;
    }
    this.targetYaw -= dxPixels * DRAG_RATE;
  }

  addZoom(direction: number): void {
    const step = this.overviewOn ? this.targetDist * 0.12 : ZOOM_STEP;
    this.targetDist = THREE.MathUtils.clamp(
      this.targetDist + direction * step,
      this.overviewOn ? MIN_DIST_OVERVIEW : MIN_DIST,
      this.overviewOn ? MAX_DIST_OVERVIEW : MAX_DIST,
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
    const targetPitch = this.overviewOn ? PITCH_OVERVIEW : PITCH;
    this.pitch += (targetPitch - this.pitch) * k;

    // Follow the walking pair with calm easing — or the free pan in overview.
    const kf = dt > 0 ? 1 - Math.exp(-dt * 3.2) : 1;
    const goal = this.overviewOn ? this.panFocus : target;
    this.focus.x += (goal.x - this.focus.x) * kf;
    this.focus.z += (goal.z - this.focus.z) * kf;

    const hr = this.dist * Math.cos(this.pitch);
    this.camera.position.set(
      this.focus.x + Math.sin(this.yaw) * hr,
      this.dist * Math.sin(this.pitch),
      this.focus.z + Math.cos(this.yaw) * hr,
    );
    this.camera.lookAt(this.focus.x, 0.45, this.focus.z);
  }
}
