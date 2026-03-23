import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const rect = (key, color) => {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(color, 1);
      g.fillRect(0, 0, 16, 16);
      g.generateTexture(key, 16, 16);
      g.destroy();
    };
    rect('player', 0xffffff);
    rect('enemy', 0xff0000);
    rect('floor', 0x2a2a2a);
    rect('wall', 0x1a0a28);
  }

  create() {
    this.scene.start('MenuScene');
  }
}
