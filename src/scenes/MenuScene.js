import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    const mono = { fontFamily: 'monospace' };

    const title = this.add
      .text(0, 0, 'VOID GATE', {
        ...mono,
        fontSize: '36px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const sub = this.add
      .text(0, 0, 'Enter the Gate. Become the Void.', {
        ...mono,
        fontSize: '14px',
        color: '#888888',
      })
      .setOrigin(0.5);

    const btn = this.add
      .text(0, 0, 'ENTER DUNGEON', {
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

    const reposition = (w, h) => {
      title.setPosition(w / 2, h / 2 - 80);
      sub.setPosition(w / 2, h / 2 - 20);
      btn.setPosition(w / 2, h / 2 + 60);
    };

    reposition(this.scale.width, this.scale.height);
    this.scale.on('resize', (gameSize) => {
      reposition(gameSize.width, gameSize.height);
    });
  }
}
