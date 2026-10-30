import * as Phaser from 'phaser';
import {
  GAME_CONSTANTS,
  PlayerPhysicsState,
  Vector2D,
  normalize,
  createInitialMatchState,
  stepMatch,
  MatchState,
  CollisionEvent,
} from '@yeet-arena/shared';

interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  shield: Phaser.GameObjects.Arc;
  body: Phaser.GameObjects.Arc;
  eyeL: Phaser.GameObjects.Arc;
  eyeR: Phaser.GameObjects.Arc;
  nameText: Phaser.GameObjects.Text;
}

export class MainScene extends Phaser.Scene {
  private matchState!: MatchState;
  private playerVisuals: Map<string, PlayerVisual> = new Map();

  // Input keys
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

  // UI GameObjects
  private topHudText!: Phaser.GameObjects.Text;
  private playerStatusText!: Phaser.GameObjects.Text;
  private centerBannerText!: Phaser.GameObjects.Text;
  private centerSubText!: Phaser.GameObjects.Text;
  private eventAnnouncementText!: Phaser.GameObjects.Text;
  private announcementTimer: number = 0;

  // Bot AI decision timer & cache
  private botDecisionTimer: number = 0;
  private botInputs: Map<string, { dir: Vector2D; wantDash: boolean }> = new Map();

  // FX Pool
  private fxGraphics!: Phaser.GameObjects.Graphics;
  private trails: Array<{ x: number; y: number; radius: number; color: number; alpha: number }> = [];

  constructor() {
    super({ key: 'MainScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0519');

    this.createBackgroundStars();
    this.arenaGraphics = this.add.graphics().setDepth(1);
    this.fxGraphics = this.add.graphics().setDepth(15);

    this.setupInput();
    this.setupUI();
    this.initMatch();
  }

  private createBackgroundStars() {
    for (let i = 0; i < 45; i++) {
      const starX = Phaser.Math.Between(10, GAME_CONSTANTS.CANVAS_WIDTH - 10);
      const starY = Phaser.Math.Between(10, GAME_CONSTANTS.CANVAS_HEIGHT - 10);
      const starAlpha = Phaser.Math.FloatBetween(0.2, 0.7);
      const star = this.add.circle(starX, starY, 1.5, 0x818cf8, starAlpha);
      star.setDepth(0);
    }
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
    // Top HUD (Timer & Survivors)
    this.topHudText = this.add.text(GAME_CONSTANTS.CANVAS_WIDTH / 2, 14, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#fdf2f8',
      backgroundColor: 'rgba(15, 6, 28, 0.85)',
      padding: { x: 12, y: 5 },
    });
    this.topHudText.setOrigin(0.5, 0);
    this.topHudText.setDepth(100);

    // Player Status Box (Bottom Left)
    this.playerStatusText = this.add.text(16, GAME_CONSTANTS.CANVAS_HEIGHT - 38, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#67e8f9',
      backgroundColor: 'rgba(15, 6, 28, 0.85)',
      padding: { x: 8, y: 5 },
    });
    this.playerStatusText.setDepth(100);

    // Center Big Banner (Countdown, GO, Sudden Death, Winner)
    this.centerBannerText = this.add.text(
      GAME_CONSTANTS.CANVAS_WIDTH / 2,
      GAME_CONSTANTS.CANVAS_HEIGHT / 2 - 25,
      '',
      {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#fef08a',
        stroke: '#831843',
        strokeThickness: 6,
        align: 'center',
      },
    );
    this.centerBannerText.setOrigin(0.5);
    this.centerBannerText.setDepth(110);
    this.centerBannerText.setVisible(false);

    // Center Subtitle (Restart instructions or details)
    this.centerSubText = this.add.text(
      GAME_CONSTANTS.CANVAS_WIDTH / 2,
      GAME_CONSTANTS.CANVAS_HEIGHT / 2 + 25,
      '',
      {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#67e8f9',
        backgroundColor: '#1f1335',
        padding: { x: 10, y: 5 },
      },
    );
    this.centerSubText.setOrigin(0.5);
    this.centerSubText.setDepth(110);
    this.centerSubText.setVisible(false);

    // Quick event announcement (e.g., PLAYER ELIMINATED)
    this.eventAnnouncementText = this.add.text(
      GAME_CONSTANTS.CANVAS_WIDTH / 2,
      GAME_CONSTANTS.CANVAS_HEIGHT / 2 + 70,
      '',
      {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f43f5e',
        backgroundColor: 'rgba(20, 5, 25, 0.85)',
        padding: { x: 8, y: 4 },
      },
    );
    this.eventAnnouncementText.setOrigin(0.5);
    this.eventAnnouncementText.setDepth(105);
    this.eventAnnouncementText.setVisible(false);
  }

  private initMatch() {
    // Clean up previous visuals
    this.playerVisuals.forEach((vis) => vis.container.destroy());
    this.playerVisuals.clear();
    this.trails = [];
    this.fxGraphics.clear();
    this.botDecisionTimer = 0;
    this.botInputs.clear();
    this.announcementTimer = 0;
    this.eventAnnouncementText.setVisible(false);

    // 1 Controllable Player + 2 Distinct AI Opponents
    const initialFighters: PlayerPhysicsState[] = [
      {
        id: 'p1',
        name: 'PLAYER (You)',
        color: 0x38bdf8, // Cyan / Sky Blue
        x: this.arenaCenter.x - 65,
        y: this.arenaCenter.y,
        vx: 0,
        vy: 0,
        facingX: 1,
        facingY: 0,
        isDashing: false,
        dashTimer: 0,
        dashCooldownTimer: 0,
        hitStunTimer: 0,
        spawnProtectionTimer: GAME_CONSTANTS.SPAWN_PROTECTION,
        isAlive: true,
        isBot: false,
      },
      {
        id: 'bot1',
        name: 'BOT BLAZE (Aggressive)',
        color: 0xf43f5e, // Rose / Red
        x: this.arenaCenter.x + 65,
        y: this.arenaCenter.y - 45,
        vx: 0,
        vy: 0,
        facingX: -1,
        facingY: 0,
        isDashing: false,
        dashTimer: 0,
        dashCooldownTimer: 0,
        hitStunTimer: 0,
        spawnProtectionTimer: GAME_CONSTANTS.SPAWN_PROTECTION,
        isAlive: true,
        isBot: true,
      },
      {
        id: 'bot2',
        name: 'BOT TOXIC (Tactical)',
        color: 0xa855f7, // Purple
        x: this.arenaCenter.x + 40,
        y: this.arenaCenter.y + 65,
        vx: 0,
        vy: 0,
        facingX: -1,
        facingY: -1,
        isDashing: false,
        dashTimer: 0,
        dashCooldownTimer: 0,
        hitStunTimer: 0,
        spawnProtectionTimer: GAME_CONSTANTS.SPAWN_PROTECTION,
        isAlive: true,
        isBot: true,
      },
    ];

    this.matchState = createInitialMatchState(initialFighters);

    // Build visual containers
    for (const p of this.matchState.players) {
      const container = this.add.container(p.x, p.y);
      container.setDepth(10);

      // Shadow below
      const shadow = this.add.ellipse(0, 12, 22, 9, 0x07010f, 0.45);
      container.add(shadow);

      // Spawn protection shield aura
      const shield = this.add.circle(0, 0, GAME_CONSTANTS.PLAYER_RADIUS + 4, 0x38bdf8, 0.35);
      shield.setStrokeStyle(1.5, 0x67e8f9);
      shield.setVisible(true);
      container.add(shield);

      // Character body circle
      const body = this.add.circle(0, 0, GAME_CONSTANTS.PLAYER_RADIUS, p.color);
      body.setStrokeStyle(2, 0xffffff);
      container.add(body);

      // Expressive eyes
      const eyeL = this.add.circle(-4, -2, 2.5, 0xffffff);
      const eyeR = this.add.circle(4, -2, 2.5, 0xffffff);
      container.add(eyeL);
      container.add(eyeR);

      // Overhead name tag
      const nameText = this.add.text(0, -22, p.name.split(' ')[0], {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
      });
      nameText.setOrigin(0.5);
      container.add(nameText);

      this.playerVisuals.set(p.id, {
        container,
        shadow,
        shield,
        body,
        eyeL,
        eyeR,
        nameText,
      });
    }

    this.centerBannerText.setVisible(true);
    this.centerSubText.setVisible(false);
    this.renderArenaGraphics();
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.1);

    // Global match restart
    if (this.keyR && Phaser.Input.Keyboard.JustDown(this.keyR)) {
      this.initMatch();
      return;
    }

    // Step match state machine
    if (this.matchState.status !== 'FINISHED') {
      const inputs = this.gatherInputs(dt);
      const result = stepMatch(this.matchState, inputs, dt, this.arenaCenter);

      // Handle events
      if (result.collisionEvents.length > 0) {
        this.handleCollisions(result.collisionEvents);
      }
      if (result.eliminatedIds.length > 0) {
        for (const id of result.eliminatedIds) {
          this.handleElimination(id);
        }
      }
    }

    // Render systems
    this.updateTrails(dt);
    this.renderArenaGraphics();
    this.renderPlayerVisuals();
    this.updateHUD(dt);
  }

  private gatherInputs(dt: number): Map<string, { dir: Vector2D; wantDash: boolean }> {
    const inputs = new Map<string, { dir: Vector2D; wantDash: boolean }>();

    // 1. Human player input (W, A, S, D + Space)
    let moveX = 0;
    let moveY = 0;
    if (this.keyW?.isDown) moveY -= 1;
    if (this.keyS?.isDown) moveY += 1;
    if (this.keyA?.isDown) moveX -= 1;
    if (this.keyD?.isDown) moveX += 1;
    const wantDash = this.keySpace ? Phaser.Input.Keyboard.JustDown(this.keySpace) : false;

    inputs.set('p1', {
      dir: { x: moveX, y: moveY },
      wantDash,
    });

    // 2. Bot AI inputs
    this.updateBotDecisions(dt);
    for (const [botId, botInput] of this.botInputs) {
      inputs.set(botId, {
        dir: botInput.dir,
        wantDash: botInput.wantDash,
      });
      // Dash consumed
      botInput.wantDash = false;
    }

    return inputs;
  }

  private updateBotDecisions(dt: number) {
    this.botDecisionTimer += dt;
    if (this.botDecisionTimer < 0.2) return;
    this.botDecisionTimer = 0;

    const aliveFighters = this.matchState.players.filter((p) => p.isAlive);
    const arenaR = this.matchState.arenaRadius;

    for (const bot of this.matchState.players) {
      if (!bot.isAlive || !bot.isBot) continue;

      const distFromCenter = Math.hypot(bot.x - this.arenaCenter.x, bot.y - this.arenaCenter.y);
      const isNearEdge = distFromCenter > arenaR * 0.72;

      // Nearest opponent
      let nearestOpponent: PlayerPhysicsState | null = null;
      let minDist = Infinity;
      for (const other of aliveFighters) {
        if (other.id === bot.id) continue;
        const dist = Math.hypot(other.x - bot.x, other.y - bot.y);
        if (dist < minDist) {
          minDist = dist;
          nearestOpponent = other;
        }
      }

      let dir: Vector2D = { x: 0, y: 0 };
      let wantDash = false;

      // BOT BLAZE: Aggressive brawler
      if (bot.id === 'bot1') {
        if (isNearEdge && distFromCenter > arenaR * 0.88) {
          // Urgent retreat only when dangerously close
          dir = normalize({ x: this.arenaCenter.x - bot.x, y: this.arenaCenter.y - bot.y });
        } else if (nearestOpponent) {
          dir = normalize({ x: nearestOpponent.x - bot.x, y: nearestOpponent.y - bot.y });
          // Dashing when close
          if (minDist < 95 && bot.dashCooldownTimer === 0 && !nearestOpponent.isDashing) {
            wantDash = Math.random() > 0.25;
          }
        }
      }

      // BOT TOXIC: Tactical survivor
      if (bot.id === 'bot2') {
        if (isNearEdge) {
          // Swiftly repositions to safe ground
          dir = normalize({ x: this.arenaCenter.x - bot.x, y: this.arenaCenter.y - bot.y });
        } else if (nearestOpponent) {
          if (minDist < 60 && bot.dashCooldownTimer === 0) {
            // Counter-dash on approach
            dir = normalize({ x: nearestOpponent.x - bot.x, y: nearestOpponent.y - bot.y });
            wantDash = true;
          } else if (minDist < 80) {
            // Keep spacing
            dir = normalize({ x: bot.x - nearestOpponent.x, y: bot.y - nearestOpponent.y });
          } else {
            // Cautious flank
            const dx = nearestOpponent.x - bot.x;
            const dy = nearestOpponent.y - bot.y;
            dir = normalize({ x: dx - dy * 0.4, y: dy + dx * 0.4 });
          }
        }
      }

      this.botInputs.set(bot.id, { dir, wantDash });
    }
  }

  private handleCollisions(events: CollisionEvent[]) {
    for (const ev of events) {
      if (ev.isStrong) {
        // Impact camera shake
        this.cameras.main.shake(110, 0.007);

        // Burst impact particles
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8;
          const dist = Phaser.Math.Between(6, 16);
          this.trails.push({
            x: ev.x + Math.cos(angle) * dist,
            y: ev.y + Math.sin(angle) * dist,
            radius: Phaser.Math.Between(2, 4),
            color: 0xfef08a,
            alpha: 1.0,
          });
        }
      }
    }
  }

  private handleElimination(id: string) {
    const visual = this.playerVisuals.get(id);
    const player = this.matchState.players.find((p) => p.id === id);

    this.showAnnouncement(`${player ? player.name.split(' ')[0] : 'FIGHTER'} YEETED!`);
    this.cameras.main.shake(140, 0.01);

    if (visual) {
      this.tweens.add({
        targets: visual.container,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        angle: 480,
        duration: 450,
        ease: 'Back.easeIn',
        onComplete: () => {
          visual.container.setVisible(false);
        },
      });
    }
  }

  private showAnnouncement(text: string) {
    this.eventAnnouncementText.setText(text);
    this.eventAnnouncementText.setVisible(true);
    this.announcementTimer = 1.8;
  }

  private updateTrails(dt: number) {
    this.fxGraphics.clear();

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.alpha -= dt * 3.5;
      if (t.alpha <= 0) {
        this.trails.splice(i, 1);
        continue;
      }
      this.fxGraphics.fillStyle(t.color, t.alpha);
      this.fxGraphics.fillCircle(t.x, t.y, t.radius);
    }
  }

  private renderArenaGraphics() {
    const { x, y } = this.arenaCenter;
    const r = this.matchState.arenaRadius;
    const isSuddenDeath = this.matchState.status === 'SUDDEN_DEATH';

    this.arenaGraphics.clear();

    // Outer shadow
    this.arenaGraphics.fillStyle(0x0a0412, 0.5);
    this.arenaGraphics.fillCircle(x, y + 8, r + 12);

    // Outer boundary ring (Turquoise / Flashing Crimson during Sudden Death)
    const ringColor = isSuddenDeath
      ? (Math.floor(this.time.now / 200) % 2 === 0 ? 0xef4444 : 0x14b8a6)
      : 0x14b8a6;
    this.arenaGraphics.fillStyle(ringColor, 1);
    this.arenaGraphics.fillCircle(x, y, r + 9);

    // Inner rim
    this.arenaGraphics.fillStyle(0x0f766e, 1);
    this.arenaGraphics.fillCircle(x, y, r + 3);

    // Arena surface (Hot pink)
    this.arenaGraphics.fillStyle(0xf472b6, 1);
    this.arenaGraphics.fillCircle(x, y, r);

    // Surface design rings
    this.arenaGraphics.lineStyle(2, 0xec4899, 0.6);
    this.arenaGraphics.strokeCircle(x, y, r * 0.7);
    this.arenaGraphics.strokeCircle(x, y, r * 0.35);

    // Center focal point
    this.arenaGraphics.fillStyle(0xdb2777, 0.9);
    this.arenaGraphics.fillCircle(x, y, 9);
  }

  private renderPlayerVisuals() {
    for (const p of this.matchState.players) {
      const visual = this.playerVisuals.get(p.id);
      if (!visual || !p.isAlive) continue;

      visual.container.setPosition(p.x, p.y);

      // Spawn protection shield visibility & pulse
      if (p.spawnProtectionTimer > 0) {
        visual.shield.setVisible(true);
        const shieldPulse = 1.0 + Math.sin(this.time.now * 0.015) * 0.15;
        visual.shield.setScale(shieldPulse);
      } else {
        visual.shield.setVisible(false);
      }

      // Dash trail & visual states
      if (p.isDashing) {
        visual.body.setScale(1.25);
        visual.body.setFillStyle(0xffffff);
        // Leave a ghost trail
        this.trails.push({
          x: p.x,
          y: p.y,
          radius: GAME_CONSTANTS.PLAYER_RADIUS * 0.8,
          color: p.color,
          alpha: 0.6,
        });
      } else if (p.hitStunTimer > 0) {
        visual.body.setScale(0.85);
        visual.body.setFillStyle(0xf87171); // Red flash on stun
      } else {
        visual.body.setScale(1.0);
        visual.body.setFillStyle(p.color);
      }

      // Eye orientation
      const eyeOffsetX = (p.facingX || 0) * 3;
      const eyeOffsetY = (p.facingY || 0) * 3;
      visual.eyeL.setPosition(-4 + eyeOffsetX, -2 + eyeOffsetY);
      visual.eyeR.setPosition(4 + eyeOffsetX, -2 + eyeOffsetY);
    }
  }

  private updateHUD(dt: number) {
    const survivors = this.matchState.players.filter((p) => p.isAlive);
    const humanPlayer = this.matchState.players.find((p) => p.id === 'p1');

    // Format MM:SS
    const totalSec = Math.ceil(this.matchState.matchTimer);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Top HUD
    let statusLabel = `TIME ${timeStr}`;
    if (this.matchState.status === 'COUNTDOWN') {
      statusLabel = 'PREPARING';
    } else if (this.matchState.status === 'SUDDEN_DEATH') {
      statusLabel = '🔥 SUDDEN DEATH 🔥';
    } else if (this.matchState.status === 'FINISHED') {
      statusLabel = 'MATCH FINISHED';
    }
    this.topHudText.setText(`${statusLabel}  |  SURVIVORS: ${survivors.length}/${this.matchState.players.length}`);

    // Bottom Player Box
    if (humanPlayer) {
      let dashStatus = 'READY [SPACE]';
      if (!humanPlayer.isAlive) {
        dashStatus = 'ELIMINATED';
      } else if (humanPlayer.hitStunTimer > 0) {
        dashStatus = 'STUNNED!';
      } else if (humanPlayer.dashCooldownTimer > 0) {
        dashStatus = `COOLDOWN (${humanPlayer.dashCooldownTimer.toFixed(1)}s)`;
      }

      const shieldStatus = humanPlayer.spawnProtectionTimer > 0 ? ' [SHIELD ACTIVE]' : '';
      this.playerStatusText.setText(
        `YOU: ${humanPlayer.isAlive ? 'ALIVE' : 'ELIMINATED'}${shieldStatus}\nDASH: ${dashStatus}\nRESTART: [R]`,
      );
    }

    // Center Announcements / State Overlays
    if (this.matchState.status === 'COUNTDOWN') {
      const count = Math.ceil(this.matchState.countdownTimer);
      this.centerBannerText.setText(count > 0 ? count.toString() : 'GO!');
      this.centerBannerText.setVisible(true);
      this.centerSubText.setVisible(false);
    } else if (this.matchState.status === 'SUDDEN_DEATH' && this.matchState.suddenDeathElapsed < 2.5) {
      this.centerBannerText.setText('SUDDEN DEATH!\nARENA SHRINKING');
      this.centerBannerText.setVisible(true);
      this.centerSubText.setVisible(false);
    } else if (this.matchState.status === 'FINISHED') {
      if (this.matchState.isDraw) {
        this.centerBannerText.setText('DRAW!');
      } else {
        const winner = this.matchState.players.find((p) => p.id === this.matchState.winnerId);
        this.centerBannerText.setText(`WINNER!\n${winner ? winner.name : 'UNKNOWN'}`);
      }
      this.centerBannerText.setVisible(true);
      this.centerSubText.setText('Press [R] to Restart Match');
      this.centerSubText.setVisible(true);
    } else {
      this.centerBannerText.setVisible(false);
      this.centerSubText.setVisible(false);
    }

    // Temporary event announcements
    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
      if (this.announcementTimer <= 0) {
        this.eventAnnouncementText.setVisible(false);
      }
    }
  }
}
