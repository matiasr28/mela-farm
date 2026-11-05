// Punto de entrada: crea el juego y arranca el loop.
import { Game } from './core/Game.js';
import { createItem } from './models/Models.js';

const game = new Game(document.getElementById('app'));
game.start();

// Útil para depurar desde la consola del navegador (ej: game.addMoney(500)).
window.game = game;
game.debug = { createItem };
