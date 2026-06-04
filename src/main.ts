import { Game } from './game/Game';
import { PlaceholderPhysics } from './physics/PlaceholderPhysics';

const canvas = document.getElementById('game-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#game-canvas not found or wrong type');
}

const physics = new PlaceholderPhysics();
const game = new Game(canvas, physics);

game.start().catch((err) => {
  console.error('Failed to start Walk with Datou:', err);
});
