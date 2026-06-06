import type {
  DatouMode,
  DatouMood,
  DatouState,
  PhysicsAdapter,
  WorldCollider,
} from './PhysicsAdapter';
import { Controller, DEFAULT_CONTROLLER_CONFIG } from './mujoco/controller';
import {
  DEFAULT_SCENE_OPTIONS,
  buildDatouSceneXml,
  type DatouSceneOptions,
} from './mujoco/datou.scene';
import {
  gameVelToMujocoXY,
  gameYawToMujoco,
  mujocoToGamePos,
  mujocoVelToGame,
  mujocoYawToGame,
} from './mujoco/frame';
import { loadMujocoModule, type MjDataHandle, type MjModelHandle } from './mujoco/loader';
import { Rng } from './mujoco/rng';
import { InputRecorder, type AdapterSnapshot } from './mujoco/replay';

/**
 * Real MuJoCo-WASM backend. Drives a 3-DOF planar "Datou puck" with the outer
 * Controller and exposes its state through the standard PhysicsAdapter contract.
 *
 * Determinism: with a fixed `seed` the entire motion stream is reproducible,
 * and the optional record/snapshot surface (recorder, snapshot/restore) lets
 * the Sprint-3 diary replay what the user saw. See docs/MUJOCO_DESIGN.md §4.7.
 *
 * Memory: every Embind handle (model, data) is owned here and freed in
 * dispose(). The rest of the game never sees a MuJoCo handle.
 */
export interface MujocoAdapterConfig {
  /** Seed for deterministic wandering / replay. Defaults to a fixed value. */
  seed?: number;
  /** Record external inputs for diary replay. Off by default (cheap when off). */
  record?: boolean;
  /** Override scene options (timestep, park size, body dims). */
  scene?: Partial<DatouSceneOptions>;
}

// qpos / qvel layout for the puck, set by datou.scene.ts joint order.
const SLIDE_X = 0;
const SLIDE_Y = 1;
const HINGE_Z = 2;

const DEFAULT_SEED = 0x9e3779b9;
const HAPPY_DURATION = 5; // seconds, mirrors PlaceholderPhysics
const MAX_DT = 1 / 30;

export class MujocoAdapter implements PhysicsAdapter {
  private readonly seed: number;
  private readonly sceneOpts: DatouSceneOptions;
  private readonly recorder: InputRecorder | null;

  private mujoco!: Awaited<ReturnType<typeof loadMujocoModule>>;
  private model: MjModelHandle | null = null;
  private data: MjDataHandle | null = null;
  private rng: Rng;
  private controller: Controller;

  private mode: DatouMode = 'follow';
  private player = { x: 0, z: 0 };
  private target = { x: 0, z: 0 };

  private happyTimer = 0;
  private stationaryTimer = 0;
  private mood: DatouMood = 'calm';

  // Fixed-timestep accumulator (§4.4).
  private accumulator = 0;

  // Cached state handed to the renderer each frame.
  private readonly cachedState: DatouState = {
    position: { x: 0, y: 0, z: 0 },
    yaw: 0,
    velocity: { x: 0, y: 0, z: 0 },
    mood: 'calm',
  };

  constructor(config: MujocoAdapterConfig = {}) {
    this.seed = config.seed ?? DEFAULT_SEED;
    this.sceneOpts = { ...DEFAULT_SCENE_OPTIONS, ...config.scene };
    this.recorder = config.record ? new InputRecorder() : null;
    this.rng = new Rng(this.seed);
    this.controller = new Controller(this.rng, {
      ...DEFAULT_CONTROLLER_CONFIG,
      parkHalfExtent: this.sceneOpts.parkHalfExtent,
    });
  }

  async init(): Promise<void> {
    // Idempotent: createPhysics() inits to detect load failure, and Game.start()
    // also calls init(); a second call is a cheap no-op.
    if (this.data) return;
    this.mujoco = await loadMujocoModule();
    this.model = this.mujoco.MjModel.from_xml_string(buildDatouSceneXml(this.sceneOpts));
    if (!this.model) {
      throw new Error('MujocoAdapter: failed to compile Datou scene XML.');
    }
    this.data = new this.mujoco.MjData(this.model);
    this.mujoco.mj_forward(this.model, this.data);
    this.refreshCachedState();
  }

  step(dt: number): void {
    if (!this.model || !this.data) return;
    const clamped = Math.max(0, Math.min(dt, MAX_DT));

    // Outer controller -> desired planar velocity (game frame).
    const pos = this.gamePosition();
    const motion = this.controller.compute(
      { mode: this.mode, pos, player: this.player, target: this.target },
      clamped,
    );

    // Drive the planar joints as a velocity servo, and steer the hinge toward
    // the heading of motion. We set qvel directly (Phase-1 approach, §4.3):
    // MuJoCo still integrates contacts and gravity, keeping Datou on the ground.
    const [vX, vY] = gameVelToMujocoXY(motion.vx, motion.vz);
    const moving = Math.hypot(vX, vY) > 1e-4;

    // Step the solver a fixed number of times to cover dt.
    this.accumulator += clamped;
    const ts = this.sceneOpts.timestep;
    while (this.accumulator >= ts) {
      // Re-assert the commanded planar velocity each substep.
      this.data.qvel[SLIDE_X] = vX;
      this.data.qvel[SLIDE_Y] = vY;
      if (moving) {
        // Snap heading toward velocity direction (game yaw -> hinge angle).
        const gameYaw = Math.atan2(motion.vx, motion.vz);
        this.data.qpos[HINGE_Z] = gameYawToMujoco(gameYaw);
        this.data.qvel[HINGE_Z] = 0;
      }
      this.mujoco.mj_step(this.model, this.data);
      this.accumulator -= ts;
    }

    this.updateMood(clamped, moving);
    this.refreshCachedState();
  }

  setMode(mode: DatouMode): void {
    this.mode = mode;
    this.controller.resetWander();
    this.recorder?.record({ t: this.simTime(), kind: 'setMode', mode });
  }

  setPlayerPosition(x: number, z: number): void {
    this.player.x = x;
    this.player.z = z;
    this.recorder?.record({ t: this.simTime(), kind: 'setPlayerPosition', x, z });
  }

  setTarget(x: number, z: number): void {
    this.target.x = x;
    this.target.z = z;
    this.recorder?.record({ t: this.simTime(), kind: 'setTarget', x, z });
  }

  applyPet(): void {
    this.happyTimer = HAPPY_DURATION;
    this.mood = 'happy';
    this.recorder?.record({ t: this.simTime(), kind: 'applyPet' });
  }

  /**
   * Obstacles are baked into the MJCF as fixed geoms at init (passed via the
   * constructor's scene.colliders), so the solver already collides Datou with
   * them. If colliders arrive after init this would require a model rebuild;
   * we warn rather than silently ignore.
   */
  setColliders(colliders: readonly WorldCollider[]): void {
    if (this.data && colliders.length !== this.sceneOpts.colliders.length) {
      console.warn(
        '[MujocoAdapter] setColliders() after init is ignored; pass scene.colliders to the constructor.',
      );
    }
  }

  getDatouState(): DatouState {
    return this.cachedState;
  }

  dispose(): void {
    this.data?.delete();
    this.data = null;
    this.model?.delete();
    this.model = null;
  }

  // --- Determinism / replay surface (optional, additive) ---------------------

  /** The input recorder, if recording was enabled. For the diary feature. */
  getRecorder(): InputRecorder | null {
    return this.recorder;
  }

  /** Capture full state for save/restore or replay seek (§4.7). */
  snapshot(): AdapterSnapshot {
    const cs = this.controller.getState();
    return {
      time: this.simTime(),
      qpos: this.data ? Array.from(this.data.qpos) : [],
      qvel: this.data ? Array.from(this.data.qvel) : [],
      rngState: this.rng.getState(),
      wanderTarget: cs.wanderTarget,
      wanderTimer: cs.wanderTimer,
    };
  }

  /** Restore a previously captured snapshot. */
  restore(snap: AdapterSnapshot): void {
    if (!this.model || !this.data) return;
    this.data.time = snap.time;
    for (let i = 0; i < snap.qpos.length; i++) this.data.qpos[i] = snap.qpos[i];
    for (let i = 0; i < snap.qvel.length; i++) this.data.qvel[i] = snap.qvel[i];
    this.rng.setState(snap.rngState);
    this.controller.setState({ wanderTarget: snap.wanderTarget, wanderTimer: snap.wanderTimer });
    this.accumulator = 0;
    this.mujoco.mj_forward(this.model, this.data);
    this.refreshCachedState();
  }

  // --- internals -------------------------------------------------------------

  private simTime(): number {
    return this.data?.time ?? 0;
  }

  private gamePosition(): { x: number; z: number } {
    if (!this.data) return { x: 0, z: 0 };
    // Slide joints are offsets from the body's rest pose at world origin.
    return { x: this.data.qpos[SLIDE_X], z: this.data.qpos[SLIDE_Y] };
  }

  private refreshCachedState(): void {
    if (!this.data) return;
    const X = this.data.qpos[SLIDE_X];
    const Y = this.data.qpos[SLIDE_Y];
    // DatouState.position.y is the ground-contact (feet) height, because the
    // rendered Datou mesh has its origin at its feet. The MuJoCo body is a
    // capsule whose center sits bodyRadius above the ground; the planar puck
    // has no vertical DOF, so its feet are always on the ground (y = 0). This
    // matches PlaceholderPhysics (which always reports y = 0) and keeps Datou
    // from floating when switching backends.
    const feetY = 0;
    const p = mujocoToGamePos(X, Y, feetY);
    this.cachedState.position.x = p.x;
    this.cachedState.position.y = p.y;
    this.cachedState.position.z = p.z;

    this.cachedState.yaw = mujocoYawToGame(this.data.qpos[HINGE_Z]);

    const v = mujocoVelToGame(this.data.qvel[SLIDE_X], this.data.qvel[SLIDE_Y]);
    this.cachedState.velocity.x = v.x;
    this.cachedState.velocity.y = v.y;
    this.cachedState.velocity.z = v.z;

    this.cachedState.mood = this.mood;
  }

  private updateMood(dt: number, moving: boolean): void {
    if (this.happyTimer > 0) {
      this.happyTimer -= dt;
      this.mood = 'happy';
      return;
    }
    if (moving) {
      this.mood = 'curious';
      this.stationaryTimer = 0;
    } else {
      this.stationaryTimer += dt;
      this.mood = this.stationaryTimer > 12 ? 'tired' : 'calm';
    }
  }
}
