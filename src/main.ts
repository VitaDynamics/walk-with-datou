import { Game } from './game/Game';
import { createPhysics } from './physics/createPhysics';
import { applyStaticI18n, getLang } from './i18n';
import { mountSettings } from './ui/Settings';

const canvas = document.getElementById('game-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#game-canvas not found or wrong type');
}

// Localise the static HUD/Settings text immediately (the backend may take a
// moment to load on the MuJoCo path; we don't want English flashing first).
document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
applyStaticI18n();

// The backend is chosen in-game via the ⚙️ Settings panel (persisted to
// localStorage) or a one-off `?physics=mujoco` URL override; default is the
// lightweight placeholder, with automatic fallback if MuJoCo fails to load.
createPhysics()
  .then(({ adapter, backend }) => {
    const tag = document.getElementById('physics-tag');
    if (tag) tag.textContent = `physics: ${backend}`;

    mountSettings({ activeBackend: backend });

    const game = new Game(canvas, adapter);
    // Expose a minimal debug handle (used by automated checks and the console).
    (window as unknown as { game?: Game }).game = game;
    return game.start();
  })
  .catch((err) => {
    console.error('Failed to start Walk with Datou:', err);
  });
