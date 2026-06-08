import * as THREE from 'three';
import type { DatouState } from '../physics/PhysicsAdapter';
import type { Expression } from './Companion';

/**
 * Datou's visual representation. Pure rendering - all state comes from a
 * PhysicsAdapter via `apply()`. The mesh's local +Z is "forward" so that the
 * physics yaw (atan2(vx, vz)) maps directly to `group.rotation.y`.
 */
export class Datou {
  readonly group = new THREE.Group();
  private readonly head: THREE.Mesh;
  private readonly tail: THREE.Mesh;
  private readonly tailPivot = new THREE.Group();
  private readonly hitbox: THREE.Mesh;

  constructor() {
    const furMat = new THREE.MeshStandardMaterial({
      color: 0xc97a3a,
      flatShading: true,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x8b4f23,
      flatShading: true,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.85), furMat);
    body.position.y = 0.4;
    body.castShadow = true;
    this.group.add(body);

    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), furMat);
    this.head.position.set(0, 0.58, 0.5);
    this.head.castShadow = true;
    this.group.add(this.head);

    const earGeo = new THREE.BoxGeometry(0.08, 0.16, 0.05);
    const leftEar = new THREE.Mesh(earGeo, darkMat);
    leftEar.position.set(-0.14, 0.82, 0.5);
    this.group.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, darkMat);
    rightEar.position.set(0.14, 0.82, 0.5);
    this.group.add(rightEar);

    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 4);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 0.62, 0.7);
    this.group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 0.62, 0.7);
    this.group.add(rightEye);

    // Tail with pivot for wagging.
    this.tailPivot.position.set(0, 0.5, -0.42);
    this.group.add(this.tailPivot);
    this.tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.3), furMat);
    this.tail.position.set(0, 0, -0.15);
    this.tailPivot.add(this.tail);

    // Legs.
    const legGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    const legPositions: Array<[number, number, number]> = [
      [-0.18, 0, 0.3],
      [0.18, 0, 0.3],
      [-0.18, 0, -0.3],
      [0.18, 0, -0.3],
    ];
    for (const [x, y, z] of legPositions) {
      const leg = new THREE.Mesh(legGeo, darkMat);
      leg.position.set(x, 0.2 + y, z);
      leg.castShadow = true;
      this.group.add(leg);
    }

    // Invisible hitbox enclosing the whole dog for reliable click detection.
    this.hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.1, 1.1),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.hitbox.position.set(0, 0.55, 0.05);
    this.group.add(this.hitbox);
  }

  apply(state: DatouState): void {
    this.group.position.set(state.position.x, state.position.y, state.position.z);
    this.group.rotation.y = state.yaw;

    const t = performance.now() * 0.001;
    // Tail wagging speed scales with mood.
    const wagSpeed = state.mood === 'happy' ? 16 : state.mood === 'curious' ? 8 : 3;
    const wagAmp = state.mood === 'happy' ? 0.9 : 0.4;
    this.tailPivot.rotation.y = Math.sin(t * wagSpeed) * wagAmp;

    // Head bob on happy / lower on tired.
    if (state.mood === 'happy') {
      this.head.position.y = 0.58 + Math.sin(t * 10) * 0.06;
    } else if (state.mood === 'tired') {
      this.head.position.y = 0.5;
    } else {
      this.head.position.y = 0.58;
    }
  }

  /**
   * Pose Datou for the current want (docs/INTERACTION_VERBS.md). Layered on top
   * of apply(): apply() sets yaw + mood animation; this adds the want's body
   * language. Call once per frame, after apply().
   *
   * - attention: sit back a little, head up toward the player.
   * - play: a play-bow — front end dips down.
   * - curious: ears/head turn toward the point of interest.
   * - none: relax to the neutral pose.
   */
  applyExpression(expr: Expression): void {
    const t = performance.now() * 0.001;
    switch (expr.kind) {
      case 'attention':
        // Tip back onto the haunches and lift the head.
        this.group.rotation.x = -0.12;
        this.head.position.z = 0.5;
        this.head.position.y = 0.66;
        break;
      case 'play':
        // Front-down/rear-up bow, with a little bounce.
        this.group.rotation.x = 0.32 + Math.sin(t * 6) * 0.05;
        this.head.position.z = 0.5;
        break;
      case 'curious': {
        // Turn the head to face the point of interest (relative to body yaw).
        this.group.rotation.x = 0;
        const headYaw = Math.atan2(expr.dirX, expr.dirZ) - this.group.rotation.y;
        this.head.rotation.y = THREE.MathUtils.clamp(headYaw, -0.9, 0.9);
        break;
      }
      case 'none':
      default:
        // Relax back to neutral.
        this.group.rotation.x = 0;
        this.head.rotation.y = 0;
        this.head.position.z = 0.5;
        break;
    }
  }

  intersectsRay(ray: THREE.Raycaster): boolean {
    return ray.intersectObject(this.hitbox, false).length > 0;
  }
}
