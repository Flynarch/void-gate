import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';

export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 480,
  height: 480,
  pixelArt: true,
  backgroundColor: '#0a0a0f',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
    },
  },
  scene: [BootScene, MenuScene, GameScene],
};
