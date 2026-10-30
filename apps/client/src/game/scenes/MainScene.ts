import * as Phaser from 'phaser';
import {
  GAME_CONSTANTS,
  PlayerPhysicsState,
  Vector2D,
  normalize,
  updatePlayerMovement,
  resolvePlayerCollisions,
  checkEliminations,
} from '@yeet-arena/shared';

interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  body: Phaser.GameObjects.Arc;
  eyeL: Phaser.GameObjects.Arc;
  eyeR: Phaser.GameObjects.Arc;
  nameText: Phaser.GameObjects.Text;
  dashTrailEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
}

export class MainScene extends Phaser.Scene {
  private players: PlayerPhysicsState[] = [];
  private playerVisuals: Map<string, PlayerVisual> = new Map();

  // Keys
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;

  // Arena graphics
  private arenaGraphics!: Phaser.GameObjects.Graphics;
  private arenaCenter: Vector2D = {
    x: GAME_CONSTANTS.ARENA_CENTER_X,
    y: GAME_CONSTANTS.ARENA_CENTER_Y,
  };

  // Match UI & State
  private matchState: 'PLAYING' | 'FINISHED' = 'PLAYING';
  private winnerName: string = '';
  private uiText!: Phaser.GameObjects.Text;
  private statusBanner!: Phaser.GameObjects.Text;
  private restartPrompt!: Phaser.GameObjects.Text;

  // Bot AI decision timer
  private botTimer: number = 0;
  private botInputs: Map<string, { dir: Vector2D; wantDash: boolean }> = new Map();

  constructor() {
    super({ key: 'MainScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0519');

    this.createArenaDecorations();
    this.setupInput();
    this.setupUI();
    this.startMatch();
  }

  private createArenaDecorations() {
    const { x, y } = this.arenaCenter;
    const r = GAME_CONSTANTS.ARENA_RADIUS;

    this.arenaGraphics = this.add.graphics();
    this.arenaGraphics.setDepth(1);

    // Cosmic background nebula dust
    for (let i = 0; i < 40; i++) {
      const starX = Phaser.Math.Between(10, GAME_CONSTANTS.CANVAS_WIDTH - 10);
      const starY = Phaser.Math.Between(10, GAME_CONSTANTS.CANVAS_HEIGHT - 10);
      const starAlpha = Phaser.Math.FloatBetween(0.2, 0.8);
      const star = this.add.circle(starX, starY, 1.5, 0x818cf8, starAlpha);
      star.setDepth(0);
    }

    // Outer ring shadow
    this.arenaGraphics.fillStyle(0x0a0412, 0.5);
    this.arenaGraphics.fillCircle(x, y + 8, r + 12);

    // Outer floating border (turquoise organic ring)
    this.arenaGraphics.fillStyle(0x14b8a6, 1);
    this.arenaGraphics.fillCircle(x, y, r + 10);

    // Inner rim
    this.arenaGraphics.fillStyle(0x0f766e, 1);
    this.arenaGraphics.fillCircle(x, y, r + 3);

    // Arena main surface (hot pink)
    this.arenaGraphics.fillStyle(0xf472b6, 1);
    this.arenaGraphics.fillCircle(x, y, r);

    // Swirls on pink arena
    this.arenaGraphics.lineStyle(2, 0xec4899, 0.6);
    this.arenaGraphics.strokeCircle(x, y, r * 0.7);
    this.arenaGraphics.strokeCircle(x, y, r * 0.35);

    // Center focal point
    this.arenaGraphics.fillStyle(0xdb2777, 0.9);
    this.arenaGraphics.fillCircle(x, y, 10);
  }

  private setupInput() {
    if (!this.input.keyboard) return;
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
  }

  private setupUI() {
    this.uiText = this.add.text(16, 12, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#fdf2f8',
      backgroundColor: 'rgba(15, 6, 28, 0.8)',
      padding: { x: 8, y: 6 },
    });
    this.uiText.setDepth(100);

    this.statusBanner = this.add.text(
      GAME_CONSTANTS.CANVAS_WIDTH / 2,
      GAME_CONSTANTS.CANVAS_HEIGHT / 2 - 20,
      '',
      {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#fef08a',
        stroke: '#831843',
        strokeThickness: 5,
        align: 'center',
      },
    );
    this.statusBanner.setOrigin(0.5);
    this.statusBanner.setDepth(110);
    this.statusBanner.setVisible(false);

    this.restartPrompt = this.add.text(
      GAME_CONSTANTS.CANVAS_WIDTH / 2,
      GAME_CONSTANTS.CANVAS_HEIGHT / 2 + 25,
      'Press [R] to Restart Match',
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#67e8f9',
        backgroundColor: '#1f1335',
        padding: { x: 10, y: 5 },
      },
    );
    this.restartPrompt.setOrigin(0.5);
    this.restartPrompt.setDepth(110);
    this.restartPrompt.setVisible(false);
  }

  private startMatch() {
    // Clean up any existing visuals
    this.playerVisuals.forEach((vis) => vis.container.destroy());
    this.playerVisuals.clear();

    this.matchState = 'PLAYING';
    this.winnerName = '';
    this.statusBanner.setVisible(false);
    this.restartPrompt.setVisible(false);

    // Initial fighters: 1 Human Player + 2 Bots
    this.players = [
      {
        id: 'p1',
        name: 'PLAYER (You)',
        color: 0x38bdf8, // Cyan / Sky Blue
        x: this.arenaCenter.x - 60,
        y: this.arenaCenter.y,
        vx: 0,
        vy: 0,
        facingX: 1,
        facingY: 0,
        isDashing: false,
        dashTimer: 0,
        dashCooldownTimer: 0,
        hitStunTimer: 0,
        isAlive: true,
        isBot: false,
      },
      {
        id: 'bot1',
        name: 'BOT BLAZE',
        color: 0xf43f5e, // Rose / Red
        x: this.arenaCenter.x + 60,
        y: this.arenaCenter.y - 40,
        vx: 0,
        vy: 0,
        facingX: -1,
        facingY: 0,
        isDashing: false,
        dashTimer: 0,
        dashCooldownTimer: 0,
        hitStunTimer: 0,
        isAlive: true,
        isBot: true,
      },
      {
        id: 'bot2',
        name: 'BOT TOXIC',
        color: 0xa855f7, // Purple
        x: this.arenaCenter.x + 40,
        y: this.arenaCenter.y + 60,
        vx: 0,
        vy: 0,
        facingX: -1,
        facingY: -1,
        isDashing: false,
        dashTimer: 0,
        dashCooldownTimer: 0,
        hitStunTimer: 0,
        isAlive: true,
        isBot: true,
      },
    ];

    // Create visual containers for players
    for (const p of this.players) {
      const container = this.add.container(p.x, p.y);
      container.setDepth(10);

      // Shadow below
      const shadow = this.add.ellipse(0, 12, 22, 9, 0x07010f, 0.45);
      container.add(shadow);

      // Character body circle
      const body = this.add.circle(0, 0, GAME_CONSTANTS.PLAYER_RADIUS, p.color);
      body.setStrokeStyle(2, 0xffffff);
      container.add(body);

      // Eyes for expressive facing direction
      const eyeL = this.add.circle(-4, -2, 2.5, 0xffffff);
      const eyeR = this.add.circle(4, -2, 2.5, 0xffffff);
      container.add(eyeL);
      container.add(eyeR);

      // Overhead name tag
      const nameText = this.add.text(0, -22, p.name, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
      });
      nameText.setOrigin(0.5);
      container.add(nameText);

      this.playerVisuals.set(p.id, {
        container,
        shadow,
        body,
        eyeL,
        eyeR,
        nameText,
      });
    }
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.1);

    // Handle restart input
    if (this.keyR && Phaser.Input.Keyboard.JustDown(this.keyR)) {
      this.startMatch();
      return;
    }

    if (this.matchState === 'PLAYING') {
      this.updateBotAI(dt);
      this.processPhysicsStep(dt);
      this.checkMatchRules();
    }

    this.renderPlayerPositions();
    this.updateHUD();
  }

  private updateBotAI(dt: number) {
    this.botTimer += dt;
    if (this.botTimer < 0.25) return;
    this.botTimer = 0;

    const aliveFighters = this.players.filter((p) => p.isAlive);

    for (const p of this.players) {
      if (!p.isAlive || !p.isBot) continue;

      // Find nearest opponent
      let nearestOpponent: PlayerPhysicsState | null = null;
      let minDistance = Infinity;

      for (const other of aliveFighters) {
        if (other.id === p.id) continue;
        const dist = Math.hypot(other.x - p.x, other.y - p.y);
        if (dist < minDistance) {
          minDistance = dist;
          nearestOpponent = other;
        }
      }

      // Check distance from arena center to avoid ring-out
      const distFromCenter = Math.hypot(p.x - this.arenaCenter.x, p.y - this.arenaCenter.y);
      let dir: Vector2D = { x: 0, y: 0 };
      let wantDash = false;

      if (distFromCenter > GAME_CONSTANTS.ARENA_RADIUS * 0.75) {
        // Move back toward arena center
        const backDir = normalize({
          x: this.arenaCenter.x - p.x,
          y: this.arenaCenter.y - p.y,
        });
        dir = backDir;
      } else if (nearestOpponent) {
        // Chase opponent
        dir = normalize({
          x: nearestOpponent.x - p.x,
          y: nearestOpponent.y - p.y,
        });

        // Dash if close enough and lined up
        if (minDistance < 85 && p.dashCooldownTimer === 0) {
          wantDash = Math.random() > 0.3;
        }
      }

      this.botInputs.set(p.id, { dir, wantDash });
    }
  }

  private processPhysicsStep(dt: number) {
    // 1. Gather input for human player
    let moveX = 0;
    let moveY = 0;
    if (this.keyW?.isDown) moveY -= 1;
    if (this.keyS?.isDown) moveY += 1;
    if (this.keyA?.isDown) moveX -= 1;
    if (this.keyD?.isDown) moveX += 1;
    const playerWantDash = this.keySpace ? Phaser.Input.Keyboard.JustDown(this.keySpace) : false;

    // 2. Update movement for each player
    for (const p of this.players) {
      if (!p.isAlive) continue;

      let inputDir: Vector2D = { x: 0, y: 0 };
      let wantDash = false;

      if (p.isBot) {
        const botInput = this.botInputs.get(p.id);
        if (botInput) {
          inputDir = botInput.dir;
          wantDash = botInput.wantDash;
          // Clear dash trigger after consumed
          botInput.wantDash = false;
        }
      } else {
        inputDir = { x: moveX, y: moveY };
        wantDash = playerWantDash;
      }

      updatePlayerMovement(p, inputDir, wantDash, dt);
    }

    // 3. Resolve circle-to-circle collisions and knockback
    resolvePlayerCollisions(this.players);

    // 4. Check ring-out eliminations
    const eliminatedIds = checkEliminations(
      this.players,
      this.arenaCenter,
      GAME_CONSTANTS.ARENA_RADIUS,
    );

    for (const id of eliminatedIds) {
      this.triggerEliminationEffect(id);
    }
  }

  private triggerEliminationEffect(playerId: string) {
    const visual = this.playerVisuals.get(playerId);
    if (!visual) return;

    // Small camera shake
    this.cameras.main.shake(120, 0.008);

    // Shrink & spin out
    this.tweens.add({
      targets: visual.container,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      angle: 360,
      duration: 400,
      ease: 'Back.easeIn',
      onComplete: () => {
        visual.container.setVisible(false);
      },
    });
  }

  private checkMatchRules() {
    const survivors = this.players.filter((p) => p.isAlive);

    if (survivors.length <= 1) {
      this.matchState = 'FINISHED';
      if (survivors.length === 1) {
        this.winnerName = survivors[0].name;
        this.statusBanner.setText(`WINNER!\n${this.winnerName}`);
      } else {
        this.winnerName = 'DRAW';
        this.statusBanner.setText('DRAW!');
      }
      this.statusBanner.setVisible(true);
      this.restartPrompt.setVisible(true);
    }
  }

  private renderPlayerPositions() {
    for (const p of this.players) {
      const visual = this.playerVisuals.get(p.id);
      if (!visual || !p.isAlive) continue;

      visual.container.setPosition(p.x, p.y);

      // Dash visual feedback (body pulsating scale & flash)
      if (p.isDashing) {
        visual.body.setScale(1.25);
        visual.body.setFillStyle(0xffffff);
      } else if (p.hitStunTimer > 0) {
        visual.body.setScale(0.9);
        visual.body.setFillStyle(0xf87171);
      } else {
        visual.body.setScale(1.0);
        visual.body.setFillStyle(p.color);
      }

      // Offset eyes towards facing direction
      const eyeOffsetX = (p.facingX || 0) * 3;
      const eyeOffsetY = (p.facingY || 0) * 3;
      visual.eyeL.setPosition(-4 + eyeOffsetX, -2 + eyeOffsetY);
      visual.eyeR.setPosition(4 + eyeOffsetX, -2 + eyeOffsetY);
    }
  }

  private updateHUD() {
    const player = this.players.find((p) => !p.isBot);
    const survivors = this.players.filter((p) => p.isAlive);

    const cooldownStr =
      player && player.dashCooldownTimer > 0
        ? `${player.dashCooldownTimer.toFixed(1)}s`
        : 'READY (SPACE)';

    this.uiText.setText(
      [
        'YEET ARENA Prototype v0.2',
        `Survivors: ${survivors.length} / ${this.players.length}`,
        `Dash: ${cooldownStr}`,
        'Controls: [W,A,S,D] Move | [SPACE] Dash | [R] Restart',
      ].join('\n'),
    );
  }
}
