import type { PhysicsAdapter } from './PhysicsAdapter';
import { PlaceholderPhysics } from './PlaceholderPhysics';

/**
 * Selects and constructs the physics backend (docs/MUJOCO_DESIGN.md §4.6).
 *
 * Policy (Q2): PlaceholderPhysics is the default through Phase 1–3. MuJoCo is
 * opt-in via `?physics=mujoco`, and even then we fall back to the placeholder
 * if the WASM engine fails to load — so a flaky 8.5 MB download never yields a
 * broken game.
 */
export type PhysicsBackend = 'placeholder' | 'mujoco';

export interface CreatePhysicsResult {
  adapter: PhysicsAdapter;
  /** Which backend is actually running (after any fallback). */
  backend: PhysicsBackend;
}

/** Read the requested backend from the URL (`?physics=mujoco|placeholder`). */
export function readRequestedBackend(search: string): PhysicsBackend {
  const params = new URLSearchParams(search);
  return params.get('physics') === 'mujoco' ? 'mujoco' : 'placeholder';
}

/**
 * Build the adapter and run its async init(). On MuJoCo init failure, logs and
 * falls back to an initialised PlaceholderPhysics.
 */
export async function createPhysics(search = window.location.search): Promise<CreatePhysicsResult> {
  const requested = readRequestedBackend(search);

  if (requested === 'mujoco') {
    try {
      // Lazy import so the placeholder path never pulls the WASM into the bundle.
      const { MujocoAdapter } = await import('./MujocoAdapter');
      const adapter = new MujocoAdapter();
      await adapter.init();
      return { adapter, backend: 'mujoco' };
    } catch (err) {
      console.warn('[physics] MuJoCo backend failed to load; falling back to placeholder.', err);
    }
  }

  const adapter = new PlaceholderPhysics();
  await adapter.init();
  return { adapter, backend: 'placeholder' };
}
