import { Game } from './game/Game';
import { createPhysics } from './physics/createPhysics';

const canvas = document.getElementById('game-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#game-canvas not found or wrong type');
}

// Default is PlaceholderPhysics; `?physics=mujoco` opts into the MuJoCo backend
// (with automatic fallback to the placeholder if the engine fails to load).
createPhysics()
  .then(({ adapter, backend }) => {
    const tag = document.getElementById('physics-tag');
    if (tag) tag.textContent = `physics: ${backend}`;

    const game = new Game(canvas, adapter);
    return game.start();
  })
  .catch((err) => {
    console.error('Failed to start Walk with Datou:', err);
  });
