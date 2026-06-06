import {
  readSavedBackend,
  saveBackendPreference,
  type PhysicsBackend,
} from '../physics/createPhysics';

/**
 * In-game settings panel: a cog button that opens a small cozy popover for
 * switching the physics engine. Because the backend is constructed once at
 * boot (the WASM engine must be loaded before the loop starts), changing it
 * persists the choice and reloads the page — the honest, simple approach.
 *
 * The UI is plain DOM so it overlays the Three.js canvas without pulling in a
 * framework. Markup + styling live in index.html; this wires up behaviour.
 */
export interface SettingsOptions {
  /** The backend actually running this session (after any fallback). */
  activeBackend: PhysicsBackend;
}

const BACKEND_LABEL: Record<PhysicsBackend, string> = {
  placeholder: 'Lite (instant)',
  mujoco: 'MuJoCo physics',
};

export function mountSettings(opts: SettingsOptions): void {
  const button = document.getElementById('settings-button');
  const panel = document.getElementById('settings-panel');
  const radios = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="physics-choice"]'),
  );
  const note = document.getElementById('settings-note');
  const activeTag = document.getElementById('settings-active');

  if (!button || !panel || radios.length === 0) return;

  // Reflect the active session in the panel header.
  if (activeTag) activeTag.textContent = BACKEND_LABEL[opts.activeBackend];

  // Pre-select the *saved* choice (what will load next reload), falling back to
  // whatever is actually running this session.
  const selected = readSavedBackend() ?? opts.activeBackend;
  for (const r of radios) r.checked = r.value === selected;

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(panel.hidden);
  });

  // Close when clicking outside the panel.
  document.addEventListener('click', (e) => {
    if (panel.hidden) return;
    if (e.target instanceof Node && (panel.contains(e.target) || button.contains(e.target))) return;
    setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  for (const radio of radios) {
    radio.addEventListener('change', () => {
      const choice = radio.value as PhysicsBackend;
      const needsReload = choice !== opts.activeBackend;

      if (note) {
        if (choice === 'mujoco' && opts.activeBackend !== 'mujoco') {
          note.textContent = 'MuJoCo downloads a ~8.5 MB engine on first load. Reloading…';
        } else if (needsReload) {
          note.textContent = 'Reloading…';
        } else {
          note.textContent = '';
        }
      }

      saveBackendPreference(choice);

      if (needsReload) {
        // Drop any one-off ?physics= override so the saved choice takes effect.
        const url = new URL(window.location.href);
        url.searchParams.delete('physics');
        // Brief delay so the user sees the note before the reload.
        window.setTimeout(() => window.location.replace(url.toString()), 350);
      }
    });
  }
}
