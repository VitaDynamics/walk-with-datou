import * as THREE from 'three';

/**
 * A game-style orbit-follow camera. The camera orbits a pivot that smoothly
 * tracks a world target (the player), so it always frames the action but the
 * user can drag to look around and wheel to zoom.
 *
 * Orbit state is spherical around the pivot:
 *  - `yaw`   horizontal angle (radians), 0 looks toward +Z (down the start view)
 *  - `pitch` vertical angle (radians), clamped so we never flip under/over
 *  - `dist`  distance from pivot, clamped to a comfortable range
 *
 * Drag rotates yaw/pitch; wheel (or pinch) changes dist. The pivot lerps toward
 * the target each frame so following stays smooth.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  // Orbit parameters.
  private yaw = 0;
  private pitch = 0.62; // ~35° looking down, matches the original framing
  private dist = 15;

  // Smoothed pivot the camera orbits around (follows the target).
  private readonly pivot = new THREE.Vector3(0, 1, 0);

  // Drag state.
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private activePointer: number | null = null;

  private static readonly MIN_PITCH = 0.16; // ~9°  — keep some downward tilt
  private static readonly MAX_PITCH = 1.35; // ~77° — near top-down, not flipped
  private static readonly MIN_DIST = 6;
  private static readonly MAX_DIST = 32;
  private static readonly ROTATE_SPEED = 0.005; // rad per pixel
  private static readonly ZOOM_SPEED = 0.0015; // dist per wheel delta
  private static readonly PIVOT_HEIGHT = 1; // look slightly above the ground

  constructor(canvas: HTMLCanvasElement, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 200);
    this.attach(canvas);
    this.snapTo(0, 3); // initial target ~ player spawn
  }

  /** The horizontal view direction (radians) — lets movement be camera-relative. */
  get viewYaw(): number {
    return this.yaw;
  }

  /** Snap the pivot directly to a target (no smoothing) — used at startup. */
  snapTo(x: number, z: number): void {
    this.pivot.set(x, CameraRig.PIVOT_HEIGHT, z);
    this.applyToCamera();
  }

  /** Smoothly follow `target`, then place the camera on its orbit. */
  update(target: { x: number; z: number }, dt: number): void {
    const lerp = Math.min(1, dt * 4);
    this.pivot.x += (target.x - this.pivot.x) * lerp;
    this.pivot.z += (target.z - this.pivot.z) * lerp;
    this.pivot.y += (CameraRig.PIVOT_HEIGHT - this.pivot.y) * lerp;
    this.applyToCamera();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private applyToCamera(): void {
    // Spherical -> Cartesian offset from the pivot.
    const cosPitch = Math.cos(this.pitch);
    const offsetX = Math.sin(this.yaw) * cosPitch * this.dist;
    const offsetZ = Math.cos(this.yaw) * cosPitch * this.dist;
    const offsetY = Math.sin(this.pitch) * this.dist;

    this.camera.position.set(
      this.pivot.x + offsetX,
      this.pivot.y + offsetY,
      this.pivot.z + offsetZ,
    );
    this.camera.lookAt(this.pivot);
  }

  private attach(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', (e) => {
      if (this.activePointer !== null) return;
      this.activePointer = e.pointerId;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging || e.pointerId !== this.activePointer) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      this.yaw -= dx * CameraRig.ROTATE_SPEED;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + dy * CameraRig.ROTATE_SPEED,
        CameraRig.MIN_PITCH,
        CameraRig.MAX_PITCH,
      );
      this.applyToCamera();
    });

    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointer) return;
      this.dragging = false;
      this.activePointer = null;
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.dist = THREE.MathUtils.clamp(
          this.dist + e.deltaY * CameraRig.ZOOM_SPEED * this.dist,
          CameraRig.MIN_DIST,
          CameraRig.MAX_DIST,
        );
        this.applyToCamera();
      },
      { passive: false },
    );
  }
}
