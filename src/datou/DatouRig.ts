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
  drawBucket,
  drawCalf,
  drawEyes,
  drawHead,
  drawThigh,
  drawTorso,
  type EyeState,
} from '../art/datouParts';
import { drawGarland } from '../art/props';
import { canvasTexture } from '../art/textures';
import { ROBOT } from '../art/palette';
import type { PropSprite } from '../art/props';
import type { DatouState } from '../physics/PhysicsAdapter';
import type { Expression } from '../game/Companion';
import type { EmotionState, EmotionGrammar } from './emotion';
import type { SignatureClip } from './character';

/**
 * The per-frame character feed (BOBO refactor, CHARACTER_IMPLEMENTATION §3).
 * Optional — when absent the rig behaves exactly as before, so callers and
 * tests that don't know about the character layer keep working.
 */
export interface CharacterChannel {
  emotion: EmotionState;
  grammar: EmotionGrammar;
  /** Expressiveness scalar 0.35..1 (familiarity — R1). */
  amplitude: number;
  /** What he watches when nothing else demands his gaze (usually you). */
  gazeX: number;
  gazeZ: number;
  /** 0..1 — head-turn speed encodes familiarity (bible §motion). */
  gazeUrgency: number;
}

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
  frontHipY: number;
  rearHipY: number;
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
  frontHipY: HIP_Y,
  rearHipY: HIP_Y,
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

// Real vita01evt head-pitch travel mapped onto the plate rig's in-plane head
// rotation (positive = droop/down). Respecting the hardware limits is part of
// feeling like the real robot (bible: 低头13° 仰头32°).
const HEAD_ROT_UP = -0.56; // 32° up
const HEAD_ROT_DOWN = 0.227; // 13° down

/** Signature clip lengths — every burst is short (loudness budget, R2). */
const CLIP_DURATION: Record<SignatureClip, number> = {
  spin: 0.9,
  backTurn: 1.2,
  shiver: 1.0,
  stretch: 1.4,
  stomp: 0.5,
  shyTurn: 0.8,
};

/** Head pose keys lag the body by design (staggered channels, bible §标志性特征). */
const HEAD_KEYS = ['headRot', 'headLift', 'headBob'] as const;
type HeadKey = (typeof HEAD_KEYS)[number];

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Dorsal work arm (2-segment manipulator folded along the spine). */
const ARM_UPPER_LEN = 0.21;
const ARM_FOREARM_LEN = 0.23;
const ARM_BASE_X = -0.08; // shoulder mount on the back of the shell
const ARM_BASE_Y = BODY_Y + 0.16;
type ArmMode = 'folded' | 'reach' | 'carry';
/** [upper, forearm] rotations per mode (facing right; + folds backward). */
const ARM_POSES: Record<ArmMode, [number, number]> = {
  // Both links form a low arch above the spine instead of disappearing
  // through the torso plate.
  folded: [-1.82, -2.56],
  reach: [0.9, -0.6],
  carry: [-1.75, -2.9],
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
  /** First stage of the head's chained easing (the +~80 ms lag). */
  private headMid: Record<HeadKey, number> = { headRot: 0, headLift: 0, headBob: 0 };
  private gaitPhase = 0;
  private legAmp = 0;
  private facing = 1;
  private time = 0;
  private blinkIn = 3;
  /** Blink grammar: eyes close slower than they open (vitality). */
  private blinkPhase: 'idle' | 'closing' | 'hold' | 'opening' = 'idle';
  private blinkPhaseLeft = 0;
  private blinkQueue = 0;
  private blinkGap = 0;
  /** A gaze turn waits for its double-blink tell, then flips. */
  private pendingFacing = 0;
  private pendingFacingIn = 0;
  private clip: SignatureClip | null = null;
  private clipT = 0;
  private earMat: THREE.MeshBasicMaterial;
  private petPulse = 0;
  private garland: THREE.Mesh | null = null;
  private readonly anchorWork = new THREE.Vector3();
  private readonly armUpper = new THREE.Group();
  private readonly armForearm = new THREE.Group();
  private readonly gripperTip = new THREE.Object3D();
  private armMode: ArmMode = 'folded';
  private reachLeft = 0;
  private pickupLeft = 0;
  private reachBlend = 0;
  private readonly gripperWork = new THREE.Vector3();
  private bucket: THREE.Mesh | null = null;
  private bucketFill = -1;
  private bucketCapacity = 6;
  private readonly bucketTextures = new Map<number, THREE.Texture>();

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

    // Ear breathing-light (耳语) — canon hardware, rendered as a quiet status
    // LED in the single permitted accent: a tiny flat dot, no glow, no bloom.
    const ear = new THREE.Mesh(
      new THREE.CircleGeometry(0.018, 12),
      new THREE.MeshBasicMaterial({
        color: ROBOT.accent,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ear.position.set(-0.07 * SCALE, 0.36 * SCALE, 0.014);
    this.earMat = ear.material as THREE.MeshBasicMaterial;
    this.headGroup.add(ear);

    // Dorsal work arm: shoulder on the back of the shell, folded at rest.
    const upperPlane = partPlane(drawArmUpper(8), ARM_UPPER_LEN + 0.06, 'top');
    const forearmPlane = partPlane(drawArmForearm(9), ARM_FOREARM_LEN + 0.07, 'top');
    this.armUpper.add(upperPlane);
    this.armForearm.add(forearmPlane);
    this.armForearm.position.y = -ARM_UPPER_LEN;
    this.gripperTip.position.y = -ARM_FOREARM_LEN;
    this.armForearm.add(this.gripperTip);
    this.armUpper.add(this.armForearm);
    this.armUpper.position.set(ARM_BASE_X, ARM_BASE_Y, 0.025);
    this.armUpper.rotation.z = ARM_POSES.folded[0];
    this.armForearm.rotation.z = ARM_POSES.folded[1];
    this.flip.add(this.armUpper);

    // Back bucket (forage pannier) — mounted low on the rear of the shell,
    // hidden until it holds something so the idle silhouette stays clean (§7).
    this.bucket = partPlane(drawBucket(0), 0.2 * SCALE, 'center');
    this.bucket.position.set(ARM_BASE_X - 0.02, BODY_Y - 0.06, -0.05);
    this.bucket.visible = false;
    this.flip.add(this.bucket);

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

  /**
   * Play one signature clip (spin 原地转圈, backTurn, shiver, stretch,
   * stomp 跺脚, shyTurn). One at a time, never looping — the rig refuses
   * overlap; stage permission (clipAllowed) and cooldowns are the CALLER's
   * job (loudness budget, R2). Returns whether the clip started.
   */
  playClip(clip: SignatureClip): boolean {
    if (this.clip) return false;
    this.clip = clip;
    this.clipT = 0;
    return true;
  }

  /** The clip currently playing, if any (callers rate-limit on this). */
  get activeClip(): SignatureClip | null {
    return this.clip;
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
    if (on && this.armMode !== 'carry') this.pickupLeft = 0.55;
    this.armMode = on ? 'carry' : 'folded';
  }

  /** One calm reach-down beat (picking / inspecting with the arm). */
  reach(seconds = 1.2): void {
    if (this.armMode !== 'carry') this.reachLeft = seconds;
  }

  /** True while a reach-down beat is still playing (re-fire guard for callers). */
  isReaching(): boolean {
    return this.reachLeft > 0;
  }

  /**
   * Set how full the back bucket reads (BUILDING_SYSTEM §7). Snaps to three
   * sketch states (empty/half/full) so it's a clear glanceable signal; hidden
   * entirely at 0 so the resting silhouette stays clean. Cached per state.
   */
  setBucketFill(n: number, capacity = this.bucketCapacity): void {
    this.bucketCapacity = Math.max(1, capacity);
    if (n === this.bucketFill) return;
    this.bucketFill = n;
    if (!this.bucket) return;
    if (n <= 0) {
      this.bucket.visible = false;
      return;
    }
    this.bucket.visible = true;
    const frac = n / this.bucketCapacity;
    const state = frac >= 0.66 ? 2 : frac >= 0.33 ? 1 : 0;
    let tex = this.bucketTextures.get(state);
    if (!tex) {
      tex = canvasTexture(drawBucket(state === 2 ? 1 : state === 1 ? 0.5 : 0.18).canvas);
      this.bucketTextures.set(state, tex);
    }
    const mat = this.bucket.material as THREE.MeshBasicMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
  }

  private localToWorld(x: number, y: number): THREE.Vector3 {
    this.anchorWork.set(x * this.facing, y, 0);
    this.anchorWork.applyAxisAngle(UP, this.flip.rotation.y);
    this.anchorWork.add(this.group.position);
    return this.anchorWork;
  }

  update(
    dt: number,
    state: DatouState,
    expression: Expression,
    camYaw: number,
    ch?: CharacterChannel,
  ): void {
    this.time += dt;

    this.group.position.set(state.position.x, 0, state.position.z);
    this.flip.rotation.y = camYaw;
    this.hitMesh.rotation.y = camYaw;

    const emotion = ch?.emotion ?? null;
    const intensity = emotion?.intensity ?? 0;
    const amp = ch?.amplitude ?? 1;
    const grammar = ch?.grammar ?? null;

    // Clip clock — clips are short, single, and self-clearing.
    if (this.clip) {
      this.clipT += dt;
      if (this.clipT >= CLIP_DURATION[this.clip]) this.clip = null;
    }

    // Facing from screen-space velocity (keep last when ambiguous).
    const rightX = Math.cos(camYaw);
    const rightZ = -Math.sin(camYaw);
    const vScreen = state.velocity.x * rightX + state.velocity.z * rightZ;
    if (Math.abs(vScreen) > 0.08) {
      this.facing = vScreen > 0 ? 1 : -1;
      this.pendingFacing = 0;
    }

    const speed = Math.hypot(state.velocity.x, state.velocity.z);
    const moving = speed > 0.06;

    // --- Gaze: at rest he watches you (bible: always feel watched) ---
    if (ch) {
      const gx = ch.gazeX - state.position.x;
      const gz = ch.gazeZ - state.position.z;
      const gazeDist = Math.hypot(gx, gz);
      const gazeScreen = gx * rightX + gz * rightZ;
      if (
        (this.clip === 'backTurn' || this.clip === 'shyTurn') &&
        Math.abs(gazeScreen) > 0.05
      ) {
        // Turning away IS the message.
        this.facing = gazeScreen > 0 ? -1 : 1;
        this.pendingFacing = 0;
      } else if (
        !moving &&
        expression.kind === 'none' &&
        !this.clip &&
        gazeDist < 4.5 &&
        Math.abs(gazeScreen) > 0.25
      ) {
        const want = gazeScreen > 0 ? 1 : -1;
        if (want !== this.facing && this.pendingFacing !== want) {
          // The curiosity tell: a left-right double-blink, THEN the turn.
          // Urgency sets the delay — strangers track lazily, friends snap.
          this.pendingFacing = want;
          this.pendingFacingIn = 0.22 - 0.16 * ch.gazeUrgency;
          this.queueBlink(2);
        }
      }
    }
    if (this.pendingFacing !== 0) {
      this.pendingFacingIn -= dt;
      if (this.pendingFacingIn <= 0) {
        this.facing = this.pendingFacing;
        this.pendingFacing = 0;
      }
    }

    if (this.reachLeft > 0) this.reachLeft = Math.max(0, this.reachLeft - dt);
    if (this.pickupLeft > 0) this.pickupLeft = Math.max(0, this.pickupLeft - dt);
    const reaching = this.reachLeft > 0 || this.pickupLeft > 0;
    this.reachBlend += ((reaching ? 1 : 0) - this.reachBlend) * (1 - Math.exp(-dt * 10));

    // --- Pose targets from expression + mood ---
    const target: Pose = { ...REST_POSE };
    switch (expression.kind) {
      case 'attention':
        // Stay on four supported feet while looking up. The old pose reversed
        // the rear knee and made the thigh/calf cross at an impossible angle.
        target.bodyRot = 0.045;
        target.bodyY = BODY_Y - 0.015;
        target.rearThighBias = -0.62;
        target.rearCalfBias = 1.18;
        target.frontThighBias = -0.38;
        target.frontCalfBias = 0.88;
        target.headRot = -0.14;
        target.headLift = 0.02;
        break;
      case 'play':
        // A quadruped bow: front knees fold in the normal Z direction while
        // the straighter rear legs keep the rump supported.
        target.bodyRot = -0.16;
        target.bodyY = BODY_Y - 0.035;
        target.frontHipY = HIP_Y - 0.055;
        target.rearHipY = HIP_Y + 0.015;
        target.frontThighBias = -0.82;
        target.frontCalfBias = 1.62;
        target.rearThighBias = -0.35;
        target.rearCalfBias = 0.82;
        target.headRot = 0.14;
        target.headLift = -0.06;
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

    // --- Emotion overlays (the bible's grammar: 兴奋类 body-dominant,
    // 伤心类 expression-dominant) — all scaled by familiarity amplitude ---
    if (emotion && intensity > 0.25) {
      const e = intensity * amp;
      switch (emotion.kind) {
        case 'joy':
        case 'excited':
          target.headBob = Math.max(target.headBob, 0.025 + 0.02 * e);
          target.bodyRot -= 0.02 * e; // a touch forward, ready to go
          break;
        case 'proud':
          target.headLift += 0.02 * e; // chest up, head high (inventor beat)
          target.headRot -= 0.06 * e;
          break;
        case 'wronged':
          target.headRot += 0.18 * e; // the droop carries it; body stays small
          target.headLift -= 0.02 * e;
          target.bodyY -= 0.02 * e;
          break;
        case 'afraid':
          target.bodyY -= 0.03 * e; // low, close to the ground
          target.headRot += 0.1 * e;
          break;
        case 'shy':
          target.headRot += 0.12 * e; // ducked head, nothing else
          break;
        case 'startled':
          target.headLift += 0.03 * e; // up and alert
          break;
      }
    }

    // Clip-held postures (the turn-away family adds a wounded droop).
    if (this.clip === 'backTurn') {
      target.headRot += 0.12;
    } else if (this.clip === 'shyTurn') {
      target.headRot += 0.1;
      target.headLift -= 0.02;
    }

    if (this.reachBlend > 0.001) {
      // Ground work is a whole-body motion, as on the real quadruped: lower
      // the shoulders and front hips, keep the rear pair planted, then let the
      // dorsal arm reach past the face.
      const r = this.reachBlend;
      target.bodyRot = THREE.MathUtils.lerp(target.bodyRot, -0.22, r);
      target.bodyY = THREE.MathUtils.lerp(target.bodyY, BODY_Y - 0.045, r);
      target.headRot = THREE.MathUtils.lerp(target.headRot, 0.12, r);
      target.headLift = THREE.MathUtils.lerp(target.headLift, -0.1, r);
      target.frontHipY = THREE.MathUtils.lerp(target.frontHipY, HIP_Y - 0.075, r);
      target.rearHipY = THREE.MathUtils.lerp(target.rearHipY, HIP_Y + 0.01, r);
      target.frontThighBias = THREE.MathUtils.lerp(target.frontThighBias, -0.95, r);
      target.frontCalfBias = THREE.MathUtils.lerp(target.frontCalfBias, 1.9, r);
      target.rearThighBias = THREE.MathUtils.lerp(target.rearThighBias, -0.38, r);
      target.rearCalfBias = THREE.MathUtils.lerp(target.rearCalfBias, 0.88, r);
    }

    // Stretch clip: a slow bow in and out (伸懒腰), blended over the target.
    if (this.clip === 'stretch') {
      const env = Math.sin(Math.PI * Math.min(1, this.clipT / CLIP_DURATION.stretch)) * amp;
      target.bodyRot = THREE.MathUtils.lerp(target.bodyRot, -0.2, env);
      target.bodyY = THREE.MathUtils.lerp(target.bodyY, BODY_Y - 0.03, env);
      target.frontHipY = THREE.MathUtils.lerp(target.frontHipY, HIP_Y - 0.06, env);
      target.frontThighBias = THREE.MathUtils.lerp(target.frontThighBias, -0.95, env);
      target.frontCalfBias = THREE.MathUtils.lerp(target.frontCalfBias, 1.8, env);
      target.headRot = THREE.MathUtils.lerp(target.headRot, 0.06, env);
      target.headLift = THREE.MathUtils.lerp(target.headLift, -0.05, env);
    }

    // Real head-pitch travel — every composed pose respects the hardware.
    target.headRot = THREE.MathUtils.clamp(target.headRot, HEAD_ROT_UP, HEAD_ROT_DOWN);

    // Smooth toward targets — staggered channels (bible: body, head and
    // expression deliberately out of sync). Body leads; the head follows
    // through a chained easing (≈ +80 ms). Excited inverts: the head keys
    // ease fast and direct while the body lags a beat. Sad slows everything.
    const slow = grammar === 'sad' ? 0.7 : 1;
    const kBody = 1 - Math.exp(-dt * 7 * slow * (grammar === 'excited' ? 0.75 : 1));
    const headSet = new Set<keyof Pose>(HEAD_KEYS);
    for (const key of Object.keys(this.pose) as (keyof Pose)[]) {
      if (headSet.has(key)) continue;
      this.pose[key] += (target[key] - this.pose[key]) * kBody;
    }
    if (grammar === 'excited') {
      const kHead = 1 - Math.exp(-dt * 10);
      for (const key of HEAD_KEYS) {
        this.pose[key] += (target[key] - this.pose[key]) * kHead;
        this.headMid[key] = this.pose[key];
      }
    } else {
      const kMid = 1 - Math.exp(-dt * 7 * slow);
      const kHead = 1 - Math.exp(-dt * 12 * slow);
      for (const key of HEAD_KEYS) {
        this.headMid[key] += (target[key] - this.headMid[key]) * kMid;
        this.pose[key] += (this.headMid[key] - this.pose[key]) * kHead;
      }
    }

    // --- Gait: thigh swings, calf counter-swings with a lag (Z-fold walk) ---
    // Excited quickens the rhythm (兴奋类 fast/large); sad shrinks the steps.
    const freqMult = grammar === 'excited' ? 1 + 0.18 * intensity * amp : 1;
    this.gaitPhase += dt * (4 + speed * 4.2) * freqMult;
    // 小踏步 — his signature: tiny in-place steps when he's pleased and idle.
    const tinySteps = !moving && !this.clip && grammar === 'excited' && intensity > 0.35;
    const gaitScale = grammar === 'sad' ? 0.8 : 1;
    const ampTarget = moving ? 0.38 * gaitScale : tinySteps ? 0.07 * amp : 0;
    this.legAmp += (ampTarget - this.legAmp) * (1 - Math.exp(-dt * 10));
    // Stomp clip (跺脚, his unconscious tic): the near-front foot taps twice.
    const stompLift =
      this.clip === 'stomp'
        ? Math.abs(Math.sin((this.clipT / CLIP_DURATION.stomp) * Math.PI * 2)) * 0.3 * amp
        : 0;
    for (const leg of this.legs) {
      const thighBias = leg.front ? this.pose.frontThighBias : this.pose.rearThighBias;
      const calfBias = leg.front ? this.pose.frontCalfBias : this.pose.rearCalfBias;
      const swing = Math.sin(this.gaitPhase + leg.phase) * this.legAmp;
      // The calf lags the thigh and folds on the back-swing — reads as a knee.
      const kneeSwing = Math.sin(this.gaitPhase + leg.phase + 1.1) * this.legAmp * 0.7;
      const stomp = leg === this.legs[0] ? stompLift : 0;
      leg.thigh.position.y = leg.front ? this.pose.frontHipY : this.pose.rearHipY;
      leg.thigh.rotation.z = thighBias + swing - stomp;
      leg.calf.rotation.z = calfBias + kneeSwing + stomp * 1.3;
    }

    // --- Body: walk bob or breathing ---
    const bobScale = grammar === 'excited' ? 1.2 : 1;
    const bob = moving ? Math.abs(Math.sin(this.gaitPhase)) * 0.028 * bobScale : 0;
    const breath = moving ? 0 : Math.sin((this.time * Math.PI * 2) / 2.4) * 0.007;
    // Shiver (afraid / cold): a fast, tiny tremor — read, not spectacle.
    const shiver =
      this.clip === 'shiver' ? Math.sin(this.time * Math.PI * 2 * 13) * 0.022 * amp : 0;
    this.body.position.y = this.pose.bodyY + bob + breath;
    this.body.rotation.z = this.pose.bodyRot + shiver;
    this.flip.scale.x = this.facing;

    // Spin (原地转圈, the praised twirl): one full paper-doll turn with a
    // soft lift — the plate passes edge-on, a cutout's pirouette.
    if (this.clip === 'spin') {
      const p = Math.min(1, this.clipT / CLIP_DURATION.spin);
      this.flip.rotation.y = camYaw + easeInOut(p) * Math.PI * 2 * this.facing;
      this.flip.position.y = Math.sin(Math.PI * p) * 0.045 * amp;
    } else {
      this.flip.position.y = 0;
    }

    // Head rides the body posture; happy adds a soft nod.
    const happyBob = this.pose.headBob * Math.sin(this.time * 5.2);
    this.headGroup.position.y =
      HEAD_BASE_Y + (this.pose.bodyY - BODY_Y) + this.pose.headLift + bob * 0.7 + breath + happyBob;
    this.headGroup.position.x = HEAD_BASE_X - this.pose.bodyRot * 0.1;
    this.headGroup.rotation.z = this.pose.headRot + (moving ? Math.sin(this.gaitPhase) * 0.02 : 0);

    // --- Dorsal arm: folded at rest, reaching or carrying when asked ---
    const armMode: ArmMode =
      this.pickupLeft > 0.2 || this.reachLeft > 0
        ? 'reach'
        : this.armMode === 'carry'
          ? 'carry'
          : 'folded';
    const [upTarget, foreTarget] = ARM_POSES[armMode];
    const ka = 1 - Math.exp(-dt * 6);
    this.armUpper.rotation.z += (upTarget - this.armUpper.rotation.z) * ka;
    this.armForearm.rotation.z += (foreTarget - this.armForearm.rotation.z) * ka;
    this.armUpper.position.y = ARM_BASE_Y + (this.pose.bodyY - BODY_Y) - this.reachBlend * 0.035;

    // --- Eyes: emotion plate (mood as fallback) + the blink grammar ---
    let eye: EyeState =
      state.mood === 'happy'
        ? 'happy'
        : state.mood === 'curious'
          ? 'curious'
          : state.mood === 'tired'
            ? 'sleepy'
            : 'neutral';
    if (emotion && intensity >= 0.3) {
      // Stand-in plates until dedicated ones land (IMPLEMENTATION §4):
      // lidded 'sleepy' reads downcast; wide 'curious' reads alert.
      if (emotion.kind === 'joy' || emotion.kind === 'excited' || emotion.kind === 'proud') {
        eye = 'happy';
      } else if (emotion.kind === 'startled' || emotion.kind === 'afraid') {
        eye = 'curious';
      } else if (emotion.kind === 'wronged' || emotion.kind === 'shy') {
        eye = 'sleepy';
      }
    }
    if (expression.kind === 'curious') eye = 'curious';
    if (this.petPulse > 0) eye = 'happy';

    // Blink grammar (bible 表情动作设定): slightly quick blinks for liveliness,
    // and the eyes OPEN faster than they close — vitality in one asymmetry.
    this.blinkIn -= dt;
    if (this.blinkIn <= 0 && this.blinkPhase === 'idle' && this.blinkQueue === 0) {
      this.queueBlink(1);
      this.blinkIn = 2.2 + Math.random() * 2.6; // cosmetic randomness only
    }
    if (this.blinkQueue > 0 && this.blinkPhase === 'idle') {
      if (this.blinkGap > 0) {
        this.blinkGap -= dt;
      } else {
        this.blinkQueue--;
        this.blinkPhase = 'closing';
        this.blinkPhaseLeft = 0.075;
      }
    }
    let lidScale = 1;
    if (this.blinkPhase !== 'idle') {
      this.blinkPhaseLeft -= dt;
      const p = Math.max(0, this.blinkPhaseLeft);
      if (this.blinkPhase === 'closing') {
        lidScale = 0.12 + (p / 0.075) * 0.88;
        if (this.blinkPhaseLeft <= 0) {
          this.blinkPhase = 'hold';
          this.blinkPhaseLeft = 0.04;
        }
      } else if (this.blinkPhase === 'hold') {
        lidScale = 0.12;
        if (this.blinkPhaseLeft <= 0) {
          this.blinkPhase = 'opening';
          this.blinkPhaseLeft = 0.045; // open ≈1.6× faster than close
        }
      } else {
        lidScale = 1 - (p / 0.045) * 0.88;
        if (this.blinkPhaseLeft <= 0) {
          this.blinkPhase = 'idle';
          if (this.blinkQueue > 0) this.blinkGap = 0.08; // double-blink spacing
        }
      }
      if (this.blinkPhase === 'hold' && (eye === 'neutral' || eye === 'curious')) eye = 'blink';
    }
    this.eyes.scale.y = lidScale;

    const tex = this.eyeTextures.get(eye);
    if (tex && this.eyeMat.map !== tex) {
      this.eyeMat.map = tex;
      this.eyeMat.needsUpdate = true;
    }

    // --- Ear breathing light (耳语): calm sine at rest, quickens with
    // feeling. A status LED, never a glow.
    const earRate = 0.45 + intensity * 0.65;
    this.earMat.opacity =
      (0.13 + 0.2 * (0.5 + 0.5 * Math.sin(this.time * Math.PI * 2 * earRate))) *
      (0.55 + 0.45 * amp);

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

  /** Queue n quick blinks (n = 2 is the pre-turn curiosity tell). */
  private queueBlink(n: number): void {
    this.blinkQueue = Math.max(this.blinkQueue, n);
    this.blinkGap = 0;
  }
}
