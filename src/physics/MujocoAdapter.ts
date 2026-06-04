import type { DatouMode, DatouState, PhysicsAdapter } from './PhysicsAdapter';

/**
 * Stub adapter that the VitaDynamics simulation team will fill in with the
 * MuJoCo-WASM backend. See docs/PHYSICS_INTEGRATION.md for the contract.
 *
 * Until that work lands, this class throws on init() so accidental wiring is
 * obvious. Switch to PlaceholderPhysics in src/main.ts for now.
 */
export interface MujocoAdapterConfig {
  /** URL to the .xml MuJoCo scene description. */
  modelXmlUrl?: string;
  /** URL to the mujoco-wasm bundle. */
  wasmUrl?: string;
}

export class MujocoAdapter implements PhysicsAdapter {
  constructor(_config: MujocoAdapterConfig = {}) {
    // TODO(sim team): store config for use in init(). Stub intentionally drops it.
  }

  async init(): Promise<void> {
    // TODO(sim team):
    //  1. Fetch and instantiate the MuJoCo WASM module.
    //  2. Load the model XML from the constructor config.
    //  3. Allocate state buffers.
    //  4. Resolve once the simulation is ready to step.
    throw new Error(
      'MujocoAdapter is a stub. See docs/PHYSICS_INTEGRATION.md for the integration contract.',
    );
  }

  step(_dt: number): void {
    // TODO(sim team): advance MuJoCo by dt and refresh cached state.
  }

  setMode(_mode: DatouMode): void {
    // TODO(sim team): map high-level mode to controller intent.
  }

  setPlayerPosition(_x: number, _z: number): void {
    // TODO(sim team): forward to follow controller.
  }

  setTarget(_x: number, _z: number): void {
    // TODO(sim team): forward to explore / leashed controller.
  }

  applyPet(): void {
    // TODO(sim team): trigger a happy reaction on the policy controller.
  }

  getDatouState(): DatouState {
    // TODO(sim team): convert MuJoCo qpos/qvel + a small mood estimator into DatouState.
    throw new Error('MujocoAdapter.getDatouState() not implemented.');
  }

  dispose(): void {
    // TODO(sim team): free WASM allocations and detach worker.
  }
}
