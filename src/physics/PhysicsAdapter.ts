/**
 * The single contract between the game / rendering layer and any simulation
 * backend. Concrete implementations live in PlaceholderPhysics (default) and
 * MujocoAdapter (stub for the simulation team).
 *
 * See docs/PHYSICS_INTEGRATION.md for conventions and units.
 */

export type DatouMode = 'idle' | 'follow' | 'explore' | 'leashed';

export type DatouMood = 'happy' | 'calm' | 'curious' | 'tired';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface DatouState {
  /** World-frame position in metres. +Y is up. */
  position: Vec3;
  /** Rotation around +Y axis in radians. Convention: 0 faces +Z. */
  yaw: number;
  /** World-frame velocity in m/s. */
  velocity: Vec3;
  /** High-level mood derived by the physics layer. */
  mood: DatouMood;
}

export interface PhysicsAdapter {
  /** Async startup (load WASM, parse models, etc.). Called once. */
  init(): Promise<void>;
  /** Advance the simulation by dt seconds. dt is clamped to [0, 1/30] by the game loop. */
  step(dt: number): void;
  /** Switch high-level behaviour mode. */
  setMode(mode: DatouMode): void;
  /** Inform the simulation where the player is (used by follow mode). */
  setPlayerPosition(x: number, z: number): void;
  /** Set a navigation target (used by explore / leashed modes). */
  setTarget(x: number, z: number): void;
  /** Signal a user pet event. */
  applyPet(): void;
  /** Read Datou's current state for rendering. */
  getDatouState(): DatouState;
  /** Free any resources held by the adapter. */
  dispose(): void;
}
