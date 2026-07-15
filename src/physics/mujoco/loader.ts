/**
 * Loads the single-threaded MuJoCo WASM module from the official
 * `@mujoco/mujoco` package (Apache-2.0, published by Google DeepMind),
 * resolving the .wasm asset through Vite's pipeline so it is fingerprinted and
 * works under the GitHub Pages subpath. See docs/MUJOCO_DESIGN.md §5.2.
 *
 * The package's root export is the single-threaded build. The multi-threaded
 * one (`@mujoco/mujoco/mt`) needs COOP/COEP headers GitHub Pages cannot send,
 * so it is deliberately not used. See docs/MUJOCO_DESIGN.md §6.
 */
import loadMujoco from '@mujoco/mujoco';
// Vite rewrites this to the hashed asset URL at build time.
import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';

/**
 * The narrow slice of the MuJoCo module surface that MujocoAdapter actually
 * uses. We deliberately avoid leaking the full ambient `MainModule` (and its
 * `any`-typed members) across the codebase; everything here is contained to
 * the adapter. Handles are Embind objects that must be `.delete()`d.
 */
export interface MujocoModule {
  MjModel: { from_xml_string(xml: string): MjModelHandle };
  MjData: new (model: MjModelHandle) => MjDataHandle;
  mj_step(model: MjModelHandle, data: MjDataHandle): void;
  mj_forward(model: MjModelHandle, data: MjDataHandle): void;
  mj_resetData(model: MjModelHandle, data: MjDataHandle): void;
}

export interface MjModelHandle {
  delete(): void;
}

export interface MjDataHandle {
  /** Simulation time, seconds. Advances by model.opt.timestep per mj_step. */
  time: number;
  /** Live Float64 view into joint positions on the WASM heap. */
  qpos: Float64Array;
  /** Live Float64 view into joint velocities on the WASM heap. */
  qvel: Float64Array;
  delete(): void;
}

let modulePromise: Promise<MujocoModule> | null = null;

/**
 * Load (and cache) the MuJoCo module. Subsequent calls return the same promise
 * so the ~10 MB WASM is fetched and compiled at most once per page.
 */
export function loadMujocoModule(): Promise<MujocoModule> {
  if (!modulePromise) {
    // The package's .d.ts types the module's full ambient surface; we narrow it
    // to MujocoModule (only what the adapter uses) via an unknown cast.
    const factory = loadMujoco as unknown as (opts?: unknown) => Promise<MujocoModule>;
    modulePromise = factory({
      locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path),
    });
  }
  return modulePromise;
}
