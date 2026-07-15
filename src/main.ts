import { Game } from './game/Game';
import { createPhysics } from './physics/createPhysics';
import { applyStaticI18n, getLang } from './i18n';
import { mountSettings } from './ui/Settings';

const canvas = document.getElementById('game-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#game-canvas not found or wrong type');
}

// Localise the static console text immediately (the backend may take a moment
// on the MuJoCo path; we don't want English flashing first).
document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
applyStaticI18n();

// The backend is chosen in the ⚙ settings (persisted) or via ?physics=mujoco;
// default is the lightweight placeholder with automatic fallback.
createPhysics()
  .then(({ adapter, backend }) => {
    const tag = document.getElementById('physics-tag');
    if (tag) tag.textContent = `physics: ${backend}`;

    const game = new Game(canvas, adapter);
    mountSettings({
      activeBackend: backend,
      onCharacterChange: (c) => game.setCharacter(c),
      onOutfitChange: (d) => game.setOutfit(d),
      onAgeChange: (a) => game.setAge(a),
    });
    // Minimal debug handle (used by automated checks and the console).
    (window as unknown as { game?: Game }).game = game;
    game.start();
  })
  .catch((err: unknown) => {
    console.error('Failed to start Walk with Datou:', err);
  });
