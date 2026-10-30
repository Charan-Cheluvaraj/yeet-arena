import { describe, it, expect } from 'vitest';
import {
  distance,
  normalize,
  updatePlayerMovement,
  resolvePlayerCollisions,
  checkEliminations,
  calculateSuddenDeathRadius,
  createInitialMatchState,
  stepMatch,
  PlayerPhysicsState,
  GAME_CONSTANTS,
} from '../src/index.js';

function createMockPlayer(id: string, x: number, y: number): PlayerPhysicsState {
  return {
    id,
    name: id,
    color: 0xff0000,
    x,
    y,
    vx: 0,
    vy: 0,
    facingX: 1,
    facingY: 0,
    isDashing: false,
    dashTimer: 0,
    dashCooldownTimer: 0,
    hitStunTimer: 0,
    spawnProtectionTimer: 0,
    isAlive: true,
    isBot: false,
  };
}

describe('Shared Physics & Brawler Logic', () => {
  it('calculates distance and normalization correctly', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    const n = normalize({ x: 10, y: 0 });
    expect(n.x).toBe(1);
    expect(n.y).toBe(0);
  });

  it('updates movement with acceleration and friction', () => {
    const player = createMockPlayer('p1', 100, 100);
    updatePlayerMovement(player, { x: 1, y: 0 }, false, 0.1);
    expect(player.vx).toBeGreaterThan(0);
    expect(player.x).toBeGreaterThan(100);
  });

  it('triggers dash speed boost and enforces cooldown', () => {
    const player = createMockPlayer('p1', 100, 100);
    updatePlayerMovement(player, { x: 1, y: 0 }, true, 0.016);
    expect(player.isDashing).toBe(true);
    expect(player.vx).toBeCloseTo(GAME_CONSTANTS.DASH_SPEED, -1);
    expect(player.dashCooldownTimer).toBeGreaterThan(0);

    // Immediate second dash request should be ignored due to cooldown
    updatePlayerMovement(player, { x: 1, y: 0 }, true, 0.016);
    expect(player.dashCooldownTimer).toBeGreaterThan(0);
  });

  it('resolves collision and separates overlapping players', () => {
    const p1 = createMockPlayer('p1', 100, 100);
    const p2 = createMockPlayer('p2', 110, 100); // 10px apart, minDist is 28px
    resolvePlayerCollisions([p1, p2]);

    expect(p1.x).toBeLessThan(100);
    expect(p2.x).toBeGreaterThan(110);
    expect(p1.vx).toBeLessThan(0);
    expect(p2.vx).toBeGreaterThan(0);
  });

  it('applies stronger knockback when dashing into an opponent', () => {
    const p1 = createMockPlayer('p1', 100, 100);
    p1.isDashing = true;
    const p2 = createMockPlayer('p2', 120, 100);
    const events = resolvePlayerCollisions([p1, p2]);

    expect(p2.vx).toBeGreaterThanOrEqual(GAME_CONSTANTS.DASH_KNOCKBACK);
    expect(p2.hitStunTimer).toBe(GAME_CONSTANTS.HIT_STUN_DURATION);
    expect(events.length).toBe(1);
    expect(events[0].isStrong).toBe(true);
  });

  it('respects spawn protection against knockback and elimination', () => {
    const p1 = createMockPlayer('p1', 320, 400); // outside arena
    p1.spawnProtectionTimer = 1.0;
    const eliminated = checkEliminations([p1], { x: 320, y: 180 }, GAME_CONSTANTS.ARENA_RADIUS);
    expect(eliminated.length).toBe(0);
    expect(p1.isAlive).toBe(true);
  });

  it('detects elimination when unprotected fighter is knocked outside the arena boundary', () => {
    const center = { x: 320, y: 180 };
    const p1 = createMockPlayer('p1', 320, 180);
    const p2 = createMockPlayer('p2', 320, 400);

    const eliminated = checkEliminations([p1, p2], center, GAME_CONSTANTS.ARENA_RADIUS);
    expect(eliminated).toEqual(['p2']);
    expect(p1.isAlive).toBe(true);
    expect(p2.isAlive).toBe(false);
  });
});

describe('Match State Machine & Lifecycle', () => {
  it('initializes match in COUNTDOWN state with spawn protection', () => {
    const p1 = createMockPlayer('p1', 300, 180);
    const p2 = createMockPlayer('p2', 340, 180);
    const match = createInitialMatchState([p1, p2]);

    expect(match.status).toBe('COUNTDOWN');
    expect(match.countdownTimer).toBe(GAME_CONSTANTS.COUNTDOWN_DURATION);
    expect(match.players[0].spawnProtectionTimer).toBe(GAME_CONSTANTS.SPAWN_PROTECTION);
  });

  it('transitions from COUNTDOWN to PLAYING after duration', () => {
    const p1 = createMockPlayer('p1', 300, 180);
    const p2 = createMockPlayer('p2', 340, 180);
    const match = createInitialMatchState([p1, p2]);

    const res = stepMatch(match, new Map(), 3.1);
    expect(res.state.status).toBe('PLAYING');
    expect(res.statusChanged).toBe(true);
  });

  it('activates SUDDEN_DEATH when match timer expires with multiple survivors', () => {
    const p1 = createMockPlayer('p1', 300, 180);
    const p2 = createMockPlayer('p2', 340, 180);
    const match = createInitialMatchState([p1, p2]);
    match.status = 'PLAYING';
    match.matchTimer = 0.5;

    const res = stepMatch(match, new Map(), 0.6);
    expect(res.state.status).toBe('SUDDEN_DEATH');
  });

  it('shrinks arena radius during SUDDEN_DEATH towards minimum', () => {
    const radiusAtHalf = calculateSuddenDeathRadius(10, 140, 72, 20);
    expect(radiusAtHalf).toBeCloseTo(106, 0);

    const radiusAtEnd = calculateSuddenDeathRadius(25, 140, 72, 20);
    expect(radiusAtEnd).toBe(72);
  });

  it('determines winner accurately when one survives', () => {
    const p1 = createMockPlayer('p1', 300, 180);
    const p2 = createMockPlayer('p2', 500, 180); // outside arena (center is 320, 180, radius is 140)
    const match = createInitialMatchState([p1, p2], true);
    match.status = 'PLAYING';

    const res = stepMatch(match, new Map(), 0.1);
    expect(res.state.status).toBe('FINISHED');
    expect(res.state.winnerId).toBe('p1');
    expect(res.state.isDraw).toBe(false);
  });

  it('declares DRAW when all fighters are eliminated simultaneously', () => {
    const p1 = createMockPlayer('p1', 500, 180); // outside arena
    const p2 = createMockPlayer('p2', 100, 180); // outside arena (320 - 100 = 220 > 140)
    const match = createInitialMatchState([p1, p2], true);
    match.status = 'PLAYING';

    const res = stepMatch(match, new Map(), 0.1);
    expect(res.state.status).toBe('FINISHED');
    expect(res.state.winnerId).toBeNull();
    expect(res.state.isDraw).toBe(true);
  });
});
