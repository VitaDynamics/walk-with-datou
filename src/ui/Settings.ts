import {
  readSavedBackend,
  saveBackendPreference,
  type PhysicsBackend,
} from '../physics/createPhysics';
import { applyStaticI18n, getLang, onLangChange, setLang, t, type Lang } from '../i18n';

/**
 * In-game settings panel: a cog button that opens a small cozy popover for
 * switching the **language** and the **physics engine**. Because the backend is
 * constructed once at boot (the WASM engine must be loaded before the loop
 * starts), changing it persists the choice and reloads the page — the honest,
 * simple approach. Language switches live, no reload.
 *
 * The UI is plain DOM so it overlays the Three.js canvas without pulling in a
 * framework. Markup + styling live in index.html; this wires up behaviour and
 * drives the static i18n (data-i18n attributes).
 */
export interface SettingsOptions {
  /** The backend actually running this session (after any fallback). */
  activeBackend: PhysicsBackend;
}

/** i18n key for each backend's short "now running" label. */
const BACKEND_LABEL_KEY: Record<PhysicsBackend, 'settings.lite' | 'settings.mujoco'> = {
  placeholder: 'settings.lite',
  mujoco: 'settings.mujoco',
};

export function mountSettings(opts: SettingsOptions): void {
  const button = document.getElementById('settings-button');
  const panel = document.getElementById('settings-panel');
  const radios = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="physics-choice"]'),
  );
  const note = document.getElementById('settings-note');
  const activeTag = document.getElementById('settings-active');
  const langButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.lang-btn'));

  if (!button || !panel || radios.length === 0) return;

  // Reflect the active backend in the panel header (localised).
  const refreshActiveTag = (): void => {
    if (activeTag) activeTag.textContent = t(BACKEND_LABEL_KEY[opts.activeBackend]);
  };
  // Reflect the active language on the segmented toggle.
  const refreshLangButtons = (): void => {
    const lang = getLang();
    for (const b of langButtons) b.classList.toggle('active', b.dataset.lang === lang);
  };

  // Apply all static text in the current language at boot.
  applyStaticI18n();
  refreshActiveTag();
  refreshLangButtons();

  // Re-localise everything when the language changes (also fired by the toggle).
  onLangChange(() => {
    applyStaticI18n();
    refreshActiveTag();
    refreshLangButtons();
  });

  for (const b of langButtons) {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      setLang(b.dataset.lang as Lang);
    });
  }

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
          note.textContent = t('settings.reloadMujoco');
        } else if (needsReload) {
          note.textContent = t('settings.reloading');
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
