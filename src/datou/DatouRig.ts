/**
 * DatouRig — the hand-drawn robot quadruped, animated like a paper puppet.
 *
 * Separate plates (body, head, eyes, 4 legs, antenna-tail) parented into a
 * billboard group. The rig is posed every frame from the physics state +
 * the Companion's expression: gait swing while moving, breathing at rest,
 * eye-plate swaps + posture for emotion. Facing flips horizontally with
 * screen-space movement direction — the classic cutout-game move.
 */

import * as THREE from 'three';
import { drawBody, drawEyes, drawHead, drawLeg, drawTail, type EyeState } from '../art/datouParts';
import { canvasTexture } from '../art/textures';
import type { PropSprite } from '../art/props';
import type { DatouState } from '../physics/PhysicsAdapter';
import type { Expression } from '../game/Companion';

/** Smoothed pose targets — everything the expressions/moods drive. */
interface Pose {
  bodyRot: number;
  bodyY: number;
  headRot: number;
  headLift: number;
  frontLegBias: number;
  backLegBias: number;
  tailBase: number;
  tailAmp: number;
  tailSpeed: number;
}

const REST_POSE: Pose = {
  bodyRot: 0,
  bodyY: 0.46,
  headRot: 0,
  headLift: 0,
  frontLegBias: 0,
  backLegBias: 0,
  tailBase: 0.35,
  tailAmp: 0.16,
  tailSpeed: 2.2,
};

function partPlane(
  sprite: PropSprite,
  height: number,
  anchor: 'center' | 'top' | 'bottom',
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
  private readonly legs: THREE.Mesh[] = [];
  private readonly tail: THREE.Mesh;
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

  constructor(shadowTexture: THREE.Texture) {
    // Layer order via tiny z offsets: far legs < tail < body < near legs < head.
    const farFront = partPlane(drawLeg(3), 0.38, 'top');
    const farBack = partPlane(drawLeg(4), 0.38, 'top');
    const nearFront = partPlane(drawLeg(1), 0.38, 'top');
    const nearBack = partPlane(drawLeg(2), 0.38, 'top');
    for (const [leg, x, z] of [
      [farFront, 0.17, -0.04],
      [farBack, -0.21, -0.04],
      [nearFront, 0.22, 0.04],
      [nearBack, -0.16, 0.04],
    ] as const) {
      leg.position.set(x, 0.42, z);
      this.flip.add(leg);
    }
    // The far pair reads as "behind" with a light tint.
    for (const leg of [farFront, farBack]) {
      (leg.material as THREE.MeshBasicMaterial).color.setScalar(0.82);
    }
    this.legs.push(nearFront, nearBack, farFront, farBack);

    this.tail = partPlane(drawTail(5), 0.34, 'bottom');
    this.tail.position.set(-0.31, 0.47, -0.02);
    this.flip.add(this.tail);

    this.body = partPlane(drawBody(6), 0.5, 'center');
    this.body.position.set(0, 0.46, 0);
    this.flip.add(this.body);

    const head = partPlane(drawHead(7), 0.44, 'center');
    this.eyes = partPlane(drawEyes('neutral'), 0.13, 'center');
    this.eyes.position.set(0.005, -0.012, 0.012);
    this.eyeMat = this.eyes.material as THREE.MeshBasicMaterial;
    for (const s of ['neutral', 'happy', 'curious', 'sleepy', 'blink'] as const) {
      this.eyeTextures.set(s, canvasTexture(drawEyes(s).canvas));
    }
    this.headGroup.add(head, this.eyes);
    this.headGroup.position.set(0.33, 0.72, 0.06);
    this.flip.add(this.headGroup);

    this.group.add(this.flip);

    // Contact shadow (not flipped, not billboarded).
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.0),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.006;
    // Above the (transparent) painted ground in render order, like prop shadows.
    this.shadow.renderOrder = 0.5;
    this.group.add(this.shadow);

    // Invisible-but-raycastable tap target.
    this.hitMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.25),
      new THREE.MeshBasicMaterial({ transparent: true, colorWrite: false, depthWrite: false }),
    );
    this.hitMesh.position.y = 0.55;
    this.group.add(this.hitMesh);
  }

  /** Quick warm feedback for a pet/comfort touch (a soft lean, not a bounce). */
  pulse(): void {
    this.petPulse = 1;
  }

  update(dt: number, state: DatouState, expression: Expression, camYaw: number): void {
    this.time += dt;

    // Position + billboard.
    this.group.position.set(state.position.x, 0, state.position.z);
    this.flip.rotation.y = camYaw;
    this.hitMesh.rotation.y = camYaw;

    // Facing from screen-space velocity (keep last facing when ambiguous).
    const rightX = Math.cos(camYaw);
    const rightZ = -Math.sin(camYaw);
    const vScreen = state.velocity.x * rightX + state.velocity.z * rightZ;
    if (Math.abs(vScreen) > 0.08) this.facing = vScreen > 0 ? 1 : -1;

    const speed = Math.hypot(state.velocity.x, state.velocity.z);
    const moving = speed > 0.06;

    // --- Pose targets from expression + mood ---
    const target: Pose = { ...REST_POSE };
    switch (expression.kind) {
      case 'attention': // sit, look up at you
        target.bodyRot = 0.34;
        target.bodyY = 0.38;
        target.backLegBias = 1.15;
        target.headRot = -0.12;
        target.headLift = 0.05;
        target.tailAmp = 0.3;
        target.tailSpeed = 4;
        break;
      case 'play': // play-bow
        target.bodyRot = -0.24;
        target.bodyY = 0.4;
        target.frontLegBias = -0.55;
        target.headRot = 0.1;
        target.headLift = -0.04;
        target.tailBase = 0.55;
        target.tailAmp = 0.55;
        target.tailSpeed = 9;
        break;
      case 'curious': {
        target.headRot = 0.16;
        target.headLift = 0.03;
        target.tailAmp = 0.28;
        target.tailSpeed = 4.5;
        // Face toward the point of interest.
        const dirScreen = expression.dirX * rightX + expression.dirZ * rightZ;
        if (Math.abs(dirScreen) > 0.15) this.facing = dirScreen > 0 ? 1 : -1;
        break;
      }
      case 'none':
        break;
    }
    if (state.mood === 'happy') {
      target.tailAmp = Math.max(target.tailAmp, 0.5);
      target.tailSpeed = Math.max(target.tailSpeed, 10);
    } else if (state.mood === 'tired') {
      target.bodyY -= 0.04;
      target.headLift -= 0.04;
      target.tailAmp = 0.1;
      target.tailSpeed = 1.4;
    }

    // Smooth toward targets (calm easing, never snappy).
    const k = 1 - Math.exp(-dt * 7);
    for (const key of Object.keys(this.pose) as (keyof Pose)[]) {
      this.pose[key] += (target[key] - this.pose[key]) * k;
    }

    // --- Gait ---
    this.gaitPhase += dt * (4 + speed * 5);
    const ampTarget = moving ? 0.35 : 0;
    this.legAmp += (ampTarget - this.legAmp) * (1 - Math.exp(-dt * 10));
    const phases = [0, Math.PI, Math.PI, 0]; // diagonal pairs
    for (let i = 0; i < 4; i++) {
      const isFront = i === 0 || i === 2;
      const bias = isFront ? this.pose.frontLegBias : this.pose.backLegBias;
      this.legs[i].rotation.z = Math.sin(this.gaitPhase + phases[i]) * this.legAmp + bias;
    }

    // --- Body: walk bob or breathing ---
    const bob = moving ? Math.abs(Math.sin(this.gaitPhase)) * 0.03 : 0;
    const breath = moving ? 0 : Math.sin((this.time * Math.PI * 2) / 2.4) * 0.008;
    this.body.position.y = this.pose.bodyY + bob + breath;
    this.body.rotation.z = this.pose.bodyRot;
    this.flip.scale.x = this.facing;

    // Head rides the body posture.
    this.headGroup.position.y = 0.72 + this.pose.headLift + bob * 0.6 + breath;
    this.headGroup.position.x = 0.33 - this.pose.bodyRot * 0.12;
    this.headGroup.rotation.z = this.pose.headRot + (moving ? Math.sin(this.gaitPhase) * 0.025 : 0);

    // Tail wag.
    this.tail.rotation.z =
      this.pose.tailBase + Math.sin(this.time * this.pose.tailSpeed) * this.pose.tailAmp;

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
      const s = 1 + Math.sin((1 - this.petPulse) * Math.PI) * 0.04;
      this.flip.scale.y = s;
    } else {
      this.flip.scale.y = 1;
    }

    // Shadow tracks gait slightly (lifts a touch mid-stride).
    const shMat = this.shadow.material as THREE.MeshBasicMaterial;
    shMat.opacity = 0.9 - bob * 4;
  }
}
