import { describe, it, expect } from 'vitest';
import {
  distance,
  normalize,
  updatePlayerMovement,
  resolvePlayerCollisions,
  checkEliminations,
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
    resolvePlayerCollisions([p1, p2]);

    expect(p2.vx).toBeGreaterThanOrEqual(GAME_CONSTANTS.DASH_KNOCKBACK);
    expect(p2.hitStunTimer).toBe(GAME_CONSTANTS.HIT_STUN_DURATION);
  });

  it('detects elimination when knocked outside the arena boundary', () => {
    const center = { x: 320, y: 180 };
    const p1 = createMockPlayer('p1', 320, 180);
    const p2 = createMockPlayer('p2', 320, 400); // Outside radius 140

    const eliminated = checkEliminations([p1, p2], center, GAME_CONSTANTS.ARENA_RADIUS);
    expect(eliminated).toEqual(['p2']);
    expect(p1.isAlive).toBe(true);
    expect(p2.isAlive).toBe(false);
  });
});
