import type { PhysicsAdapter } from './PhysicsAdapter';
import { PlaceholderPhysics } from './PlaceholderPhysics';

/**
 * Selects and constructs the physics backend (docs/MUJOCO_DESIGN.md §4.6).
 *
 * Policy (Q2): PlaceholderPhysics is the default through Phase 1–3. MuJoCo is
 * opt-in — via the in-game Settings UI (persisted to localStorage) or a
 * `?physics=mujoco` URL override — and even then we fall back to the
 * placeholder if the WASM engine fails to load, so a flaky 8.5 MB download
 * never yields a broken game.
 *
 * Precedence: URL `?physics=` (explicit, one-off) > saved preference > default.
 */
export type PhysicsBackend = 'placeholder' | 'mujoco';

/** localStorage key the Settings UI writes the user's chosen backend to. */
export const PHYSICS_PREF_KEY = 'wwd.physics';

export interface CreatePhysicsResult {
  adapter: PhysicsAdapter;
  /** Which backend is actually running (after any fallback). */
  backend: PhysicsBackend;
}

function parseBackend(value: string | null): PhysicsBackend | null {
  if (value === 'mujoco' || value === 'placeholder') return value;
  return null;
}

/** Read the user's saved backend preference, if any. */
export function readSavedBackend(): PhysicsBackend | null {
  try {
    return parseBackend(localStorage.getItem(PHYSICS_PREF_KEY));
  } catch {
    return null; // private mode / storage disabled
  }
}

/** Persist the user's backend choice (written by the Settings UI). */
export function saveBackendPreference(backend: PhysicsBackend): void {
  try {
    localStorage.setItem(PHYSICS_PREF_KEY, backend);
  } catch {
    // Non-fatal: choice just won't survive a reload.
  }
}

/**
 * Resolve the backend to load: a `?physics=` URL param overrides everything
 * (handy for links and debugging); otherwise the saved preference; otherwise
 * the default placeholder.
 */
export function readRequestedBackend(search: string): PhysicsBackend {
  const fromUrl = parseBackend(new URLSearchParams(search).get('physics'));
  if (fromUrl) return fromUrl;
  return readSavedBackend() ?? 'placeholder';
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
