/**
 * DatouRig — the hand-drawn VITA quadruped, animated as a paper puppet.
 *
 * Assembled like the real robot (vita01evt MJCF): torso plate, four
 * TWO-segment legs (thigh pivoting at the hip, calf pivoting at the knee with
 * a counter-swing — the Z-fold of a real quadruped), and a sensor head on a
 * short neck at the top-front whose pitch/tilt is the main emotion channel
 * (the real head_pitch/head_yaw joints). No tail — the VITA has none.
 *
 * Posed every frame from the physics state + the Companion's expression:
 * gait while moving, breathing at rest, eye-plate swaps + head/leg posture
 * for emotion. Facing flips horizontally with screen-space movement.
 */

import * as THREE from 'three';
import {
  drawArmForearm,
  drawArmUpper,
  drawCalf,
  drawEyes,
  drawHead,
  drawThigh,
  drawTorso,
  type EyeState,
} from '../art/datouParts';
import { drawGarland } from '../art/props';
import { canvasTexture } from '../art/textures';
import type { PropSprite } from '../art/props';
import type { DatouState } from '../physics/PhysicsAdapter';
import type { Expression } from '../game/Companion';

/** Real-robot proportions (× a small readability factor). */
const SCALE = 1.15;
// Hip height sits a little under full leg reach (0.41) so the standing legs
// keep the real robot's visible Z-fold instead of locking out straight.
const HIP_Y = 0.36 * SCALE;
const HIP_X = 0.181 * SCALE;
const THIGH_LEN = 0.1985 * SCALE;
const CALF_LEN = 0.214 * SCALE;
const BODY_Y = 0.42 * SCALE;
// Head pivot sits INSIDE the shell so the dome visibly rests on the body —
// one connected creature, no floating head (the neck stem stays hidden).
const HEAD_BASE_Y = 0.4 * SCALE;
const HEAD_BASE_X = 0.2 * SCALE;

/** Smoothed pose targets — everything expressions/moods drive. */
interface Pose {
  bodyRot: number;
  bodyY: number;
  headRot: number;
  headLift: number;
  frontThighBias: number;
  frontCalfBias: number;
  rearThighBias: number;
  rearCalfBias: number;
  headBob: number; // extra head bob amplitude (happy)
}

/**
 * Standing Z-fold, matching the real robot's default pose: the thigh slopes
 * BACK from the hip (knee behind, like every Go1-class quadruped), and the
 * calf swings forward to plant the foot under the hip. Positive rotation.z
 * swings a hanging segment toward +X (forward).
 */
const REST_POSE: Pose = {
  bodyRot: 0,
  bodyY: BODY_Y,
  headRot: 0,
  headLift: 0,
  frontThighBias: -0.45,
  frontCalfBias: 1.0,
  rearThighBias: -0.52,
  rearCalfBias: 1.06,
  headBob: 0,
};

interface Leg {
  thigh: THREE.Group;
  calf: THREE.Group;
  front: boolean;
  phase: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Dorsal work arm (2-segment manipulator folded along the spine). */
const ARM_UPPER_LEN = 0.21;
const ARM_FOREARM_LEN = 0.23;
const ARM_BASE_X = -0.08; // shoulder mount on the back of the shell
type ArmMode = 'folded' | 'reach' | 'carry';
/** [upper, forearm] rotations per mode (facing right; + folds backward). */
const ARM_POSES: Record<ArmMode, [number, number]> = {
  folded: [-1.78, 2.62],
  reach: [0.55, -0.5],
  carry: [-0.5, -1.05],
};

function partPlane(
  sprite: PropSprite,
  height: number,
  anchor: 'center' | 'top' | 'bottom',
  tint = 1,
): THREE.Mesh {
  const w = height * sprite.aspect;
  const geo = new THREE.PlaneGeometry(w, height);
  if (anchor === 'top') geo.translate(0, -height / 2, 0);
  if (anchor === 'bottom') geo.translate(0, height / 2, 0);
  const mat = new THREE.MeshBasicMaterial({
    map: canvasTexture(sprite.canvas),
    transparent: true,
    alphaTest: 0.08,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  mat.color.setScalar(tint);
  return new THREE.Mesh(geo, mat);
}

export class DatouRig {
  /** World-positioned root (billboarded around Y). */
  readonly group = new THREE.Group();
  /** Generous invisible plate so taps on Datou land reliably. */
  readonly hitMesh: THREE.Mesh;

  private readonly flip = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly headGroup = new THREE.Group();
  private readonly eyes: THREE.Mesh;
  private readonly legs: Leg[] = [];
  private readonly shadow: THREE.Mesh;

  private readonly eyeTextures = new Map<EyeState, THREE.Texture>();
  private readonly eyeMat: THREE.MeshBasicMaterial;

  private pose: Pose = { ...REST_POSE };
  private gaitPhase = 0;
  private legAmp = 0;
  private facing = 1;
  private time = 0;
  private blinkIn = 3;
  private blinkLeft = 0;
  private petPulse = 0;
  private garland: THREE.Mesh | null = null;
  private readonly anchorWork = new THREE.Vector3();
  private readonly armUpper = new THREE.Group();
  private readonly armForearm = new THREE.Group();
  private readonly gripperTip = new THREE.Object3D();
  private armMode: ArmMode = 'folded';
  private reachLeft = 0;
  private readonly gripperWork = new THREE.Vector3();

  constructor(shadowTexture: THREE.Texture) {
    // Legs: far pair drawn behind (small -z, slight tint), near pair in front.
    // Each leg = thigh group (hip pivot) + calf group (knee pivot, child).
    const makeLeg = (front: boolean, near: boolean, seed: number): Leg => {
      const tint = near ? 1 : 0.8;
      const thighPlane = partPlane(drawThigh(seed), THIGH_LEN + 0.07, 'top', tint);
      const calfPlane = partPlane(drawCalf(seed + 10), CALF_LEN + 0.08, 'top', tint);
      const thigh = new THREE.Group();
      const calf = new THREE.Group();
      thigh.add(thighPlane);
      calf.add(calfPlane);
      calf.position.y = -THIGH_LEN;
      thigh.add(calf);
      thigh.position.set(front ? HIP_X : -HIP_X, HIP_Y, near ? 0.04 : -0.04);
      this.flip.add(thigh);
      return { thigh, calf, front, phase: 0 };
    };
    // Diagonal pairs share gait phase: nearFront+farRear = 0, others = π.
    const nearFront = makeLeg(true, true, 1);
    const nearRear = makeLeg(false, true, 2);
    const farFront = makeLeg(true, false, 3);
    const farRear = makeLeg(false, false, 4);
    nearFront.phase = 0;
    farRear.phase = 0;
    nearRear.phase = Math.PI;
    farFront.phase = Math.PI;
    this.legs.push(nearFront, nearRear, farFront, farRear);

    this.body = partPlane(drawTorso(6), 0.3 * SCALE, 'center');
    this.body.position.set(0, BODY_Y, 0);
    this.flip.add(this.body);

    // Head on its neck — anchor bottom = the head_pitch joint. Oversized on
    // purpose: 大头 is all dome, chibi like the sticker sheet.
    const head = partPlane(drawHead(7), 0.42 * SCALE, 'bottom');
    this.eyes = partPlane(drawEyes('neutral'), 0.17 * SCALE, 'center');
    // Centered on the big charcoal face plate (front of the dome).
    this.eyes.position.set(0.045 * SCALE, 0.23 * SCALE, 0.012);
    this.eyeMat = this.eyes.material as THREE.MeshBasicMaterial;
    for (const s of ['neutral', 'happy', 'curious', 'sleepy', 'blink'] as const) {
      this.eyeTextures.set(s, canvasTexture(drawEyes(s).canvas));
    }
    this.headGroup.add(head, this.eyes);
    this.headGroup.position.set(HEAD_BASE_X, HEAD_BASE_Y, 0.06);
    this.flip.add(this.headGroup);

    // Dorsal work arm: shoulder on the back of the shell, folded at rest.
    const upperPlane = partPlane(drawArmUpper(8), ARM_UPPER_LEN + 0.06, 'top');
    const forearmPlane = partPlane(drawArmForearm(9), ARM_FOREARM_LEN + 0.07, 'top');
    this.armUpper.add(upperPlane);
    this.armForearm.add(forearmPlane);
    this.armForearm.position.y = -ARM_UPPER_LEN;
    this.gripperTip.position.y = -ARM_FOREARM_LEN;
    this.armForearm.add(this.gripperTip);
    this.armUpper.add(this.armForearm);
    this.armUpper.position.set(ARM_BASE_X, BODY_Y + 0.1, -0.02);
    this.armUpper.rotation.z = ARM_POSES.folded[0];
    this.armForearm.rotation.z = ARM_POSES.folded[1];
    this.flip.add(this.armUpper);

    this.group.add(this.flip);

    // Contact shadow (flat, not billboarded).
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.9),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.006;
    this.shadow.renderOrder = 0.5;
    this.group.add(this.shadow);

    // Invisible-but-raycastable tap target.
    this.hitMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.3),
      new THREE.MeshBasicMaterial({ transparent: true, colorWrite: false, depthWrite: false }),
    );
    this.hitMesh.position.y = 0.55;
    this.group.add(this.hitMesh);
  }

  /** Quick warm feedback for a pet/comfort touch (a soft lean, not a bounce). */
  pulse(): void {
    this.petPulse = 1;
  }

  /** Wear / remove the flower garland (crafted keepsake). */
  setGarland(on: boolean): void {
    if (on && !this.garland) {
      this.garland = partPlane(drawGarland(9), 0.12, 'center');
      this.garland.position.set(HEAD_BASE_X - 0.02, HEAD_BASE_Y - 0.04, 0.07);
      this.flip.add(this.garland);
    } else if (!on && this.garland) {
      this.flip.remove(this.garland);
      this.garland = null;
    }
  }

  /** World position of the harness (leash attach point, top of the shoulders). */
  get harnessPosition(): THREE.Vector3 {
    return this.localToWorld(0.1, BODY_Y + 0.1);
  }

  /** World position of the dorsal arm's gripper tip (carried items ride here). */
  get gripperPosition(): THREE.Vector3 {
    this.gripperTip.getWorldPosition(this.gripperWork);
    return this.gripperWork;
  }

  /** Hold something in the gripper (carry pose) or stow the arm. */
  setCarrying(on: boolean): void {
    this.armMode = on ? 'carry' : 'folded';
  }

  /** One calm reach-down beat (picking / inspecting with the arm). */
  reach(seconds = 1.2): void {
    if (this.armMode !== 'carry') this.reachLeft = seconds;
  }

  private localToWorld(x: number, y: number): THREE.Vector3 {
    this.anchorWork.set(x * this.facing, y, 0);
    this.anchorWork.applyAxisAngle(UP, this.flip.rotation.y);
    this.anchorWork.add(this.group.position);
    return this.anchorWork;
  }

  update(dt: number, state: DatouState, expression: Expression, camYaw: number): void {
    this.time += dt;

    this.group.position.set(state.position.x, 0, state.position.z);
    this.flip.rotation.y = camYaw;
    this.hitMesh.rotation.y = camYaw;

    // Facing from screen-space velocity (keep last when ambiguous).
    const rightX = Math.cos(camYaw);
    const rightZ = -Math.sin(camYaw);
    const vScreen = state.velocity.x * rightX + state.velocity.z * rightZ;
    if (Math.abs(vScreen) > 0.08) this.facing = vScreen > 0 ? 1 : -1;

    const speed = Math.hypot(state.velocity.x, state.velocity.z);
    const moving = speed > 0.06;

    // --- Pose targets from expression + mood ---
    const target: Pose = { ...REST_POSE };
    switch (expression.kind) {
      case 'attention': // sit: rear legs fold, chest up, head looks up at you
        target.bodyRot = 0.3;
        target.bodyY = BODY_Y - 0.08;
        target.rearThighBias = 1.25;
        target.rearCalfBias = -1.9;
        target.frontThighBias = -0.35;
        target.frontCalfBias = 0.85;
        target.headRot = -0.16;
        target.headLift = 0.02;
        break;
      case 'play': // play-bow: front legs fold, rump up, head low and eager
        target.bodyRot = -0.24;
        target.bodyY = BODY_Y - 0.05;
        target.frontThighBias = 1.0;
        target.frontCalfBias = -1.7;
        target.rearThighBias = 0.15;
        target.rearCalfBias = -0.3;
        target.headRot = 0.14;
        target.headLift = -0.02;
        target.headBob = 0.04;
        break;
      case 'curious': {
        target.headRot = 0.18; // head tilt (the real head_yaw flavour)
        target.headLift = 0.025;
        const dirScreen = expression.dirX * rightX + expression.dirZ * rightZ;
        if (Math.abs(dirScreen) > 0.15) this.facing = dirScreen > 0 ? 1 : -1;
        break;
      }
      case 'none':
        break;
    }
    if (state.mood === 'happy') {
      target.headBob = Math.max(target.headBob, 0.035);
    } else if (state.mood === 'tired') {
      // Body settles down onto the standing Z-fold; the droop lives in the
      // head — folding the legs further would lift the feet off the ground.
      target.bodyY -= 0.05;
      target.headRot += 0.22; // head droops forward
      target.headLift -= 0.03;
    }

    // Smooth toward targets (calm easing, never snappy).
    const k = 1 - Math.exp(-dt * 7);
    for (const key of Object.keys(this.pose) as (keyof Pose)[]) {
      this.pose[key] += (target[key] - this.pose[key]) * k;
    }

    // --- Gait: thigh swings, calf counter-swings with a lag (Z-fold walk) ---
    this.gaitPhase += dt * (4 + speed * 4.2);
    const ampTarget = moving ? 0.38 : 0;
    this.legAmp += (ampTarget - this.legAmp) * (1 - Math.exp(-dt * 10));
    for (const leg of this.legs) {
      const thighBias = leg.front ? this.pose.frontThighBias : this.pose.rearThighBias;
      const calfBias = leg.front ? this.pose.frontCalfBias : this.pose.rearCalfBias;
      const swing = Math.sin(this.gaitPhase + leg.phase) * this.legAmp;
      // The calf lags the thigh and folds on the back-swing — reads as a knee.
      const kneeSwing = Math.sin(this.gaitPhase + leg.phase + 1.1) * this.legAmp * 0.7;
      leg.thigh.rotation.z = thighBias + swing;
      leg.calf.rotation.z = calfBias + kneeSwing;
    }

    // --- Body: walk bob or breathing ---
    const bob = moving ? Math.abs(Math.sin(this.gaitPhase)) * 0.028 : 0;
    const breath = moving ? 0 : Math.sin((this.time * Math.PI * 2) / 2.4) * 0.007;
    this.body.position.y = this.pose.bodyY + bob + breath;
    this.body.rotation.z = this.pose.bodyRot;
    this.flip.scale.x = this.facing;

    // Head rides the body posture; happy adds a soft nod.
    const happyBob = this.pose.headBob * Math.sin(this.time * 5.2);
    this.headGroup.position.y =
      HEAD_BASE_Y + (this.pose.bodyY - BODY_Y) + this.pose.headLift + bob * 0.7 + breath + happyBob;
    this.headGroup.position.x = HEAD_BASE_X - this.pose.bodyRot * 0.1;
    this.headGroup.rotation.z = this.pose.headRot + (moving ? Math.sin(this.gaitPhase) * 0.02 : 0);

    // --- Dorsal arm: folded at rest, reaching or carrying when asked ---
    if (this.reachLeft > 0) this.reachLeft -= dt;
    const armMode: ArmMode =
      this.armMode === 'carry' ? 'carry' : this.reachLeft > 0 ? 'reach' : 'folded';
    const [upTarget, foreTarget] = ARM_POSES[armMode];
    const ka = 1 - Math.exp(-dt * 6);
    this.armUpper.rotation.z += (upTarget - this.armUpper.rotation.z) * ka;
    this.armForearm.rotation.z += (foreTarget - this.armForearm.rotation.z) * ka;

    // --- Eyes: mood plate + blink ---
    let eye: EyeState =
      state.mood === 'happy'
        ? 'happy'
        : state.mood === 'curious'
          ? 'curious'
          : state.mood === 'tired'
            ? 'sleepy'
            : 'neutral';
    if (expression.kind === 'curious') eye = 'curious';
    if (this.petPulse > 0) eye = 'happy';
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkLeft = 0.12;
      this.blinkIn = 2.6 + Math.random() * 3;
    }
    if (this.blinkLeft > 0) {
      this.blinkLeft -= dt;
      if (eye === 'neutral' || eye === 'curious') eye = 'blink';
    }
    const tex = this.eyeTextures.get(eye);
    if (tex && this.eyeMat.map !== tex) {
      this.eyeMat.map = tex;
      this.eyeMat.needsUpdate = true;
    }

    // Pet pulse: one soft lean-in and release.
    if (this.petPulse > 0) {
      this.petPulse = Math.max(0, this.petPulse - dt / 0.5);
      this.flip.scale.y = 1 + Math.sin((1 - this.petPulse) * Math.PI) * 0.04;
    } else {
      this.flip.scale.y = 1;
    }

    const shMat = this.shadow.material as THREE.MeshBasicMaterial;
    shMat.opacity = 0.9 - bob * 4;
  }
}
