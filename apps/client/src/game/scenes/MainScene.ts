import * as Phaser from 'phaser';
import { GAME_CONSTANTS } from '@yeet-arena/shared';

export class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  create() {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background cosmic tint
    this.cameras.main.setBackgroundColor('#1a0933');

    // Outer arena border (turquoise)
    const outerRing = this.add.circle(centerX, centerY, GAME_CONSTANTS.ARENA_RADIUS + 8, 0x14b8a6);
    outerRing.setDepth(1);

    // Inner arena surface (light pink)
    const arenaSurface = this.add.circle(centerX, centerY, GAME_CONSTANTS.ARENA_RADIUS, 0xf472b6);
    arenaSurface.setDepth(2);

    // Center arena mark
    const centerMark = this.add.circle(centerX, centerY, 8, 0xdb2777);
    centerMark.setDepth(3);

    // Title placeholder text
    const text = this.add.text(centerX, 40, 'YEET ARENA', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#38bdf8',
      align: 'center',
    });
    text.setOrigin(0.5);
    text.setDepth(10);
  }
}

