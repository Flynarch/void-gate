import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    const mono = { fontFamily: 'monospace' };

    this.add
      .text(240, 160, 'VOID GATE', {
        ...mono,
        fontSize: '36px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(240, 220, 'Enter the Gate. Become the Void.', {
        ...mono,
        fontSize: '14px',
        color: '#888888',
      })
      .setOrigin(0.5);

    const btn = this.add
      .text(240, 300, 'ENTER DUNGEON', {
        ...mono,
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#1a1a24',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#2a2a38' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#1a1a24' }));
    btn.on('pointerdown', () => this.scene.start('GameScene'));
  }
}
