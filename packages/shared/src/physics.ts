import { GAME_CONSTANTS } from './constants.js';

export interface Vector2D {
  x: number;
  y: number;
}

export interface PlayerPhysicsState {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  isDashing: boolean;
  dashTimer: number;
  dashCooldownTimer: number;
  hitStunTimer: number;
  isAlive: boolean;
  isBot: boolean;
}

export function distance(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize(v: Vector2D): Vector2D {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function isWithinArena(pos: Vector2D, arenaCenter: Vector2D, arenaRadius: number): boolean {
  return distance(pos, arenaCenter) <= arenaRadius;
}

export function updatePlayerMovement(
  player: PlayerPhysicsState,
  inputDir: Vector2D,
  wantDash: boolean,
  dt: number,
): void {
  if (!player.isAlive) return;

  // Timers
  if (player.dashCooldownTimer > 0) {
    player.dashCooldownTimer = Math.max(0, player.dashCooldownTimer - dt);
  }

  if (player.hitStunTimer > 0) {
    player.hitStunTimer = Math.max(0, player.hitStunTimer - dt);
  }

  if (player.isDashing) {
    player.dashTimer -= dt;
    if (player.dashTimer <= 0) {
      player.isDashing = false;
    }
  }

  // Trigger dash if requested and ready
  if (wantDash && player.dashCooldownTimer === 0 && !player.isDashing && player.hitStunTimer === 0) {
    player.isDashing = true;
    player.dashTimer = GAME_CONSTANTS.DASH_DURATION;
    player.dashCooldownTimer = GAME_CONSTANTS.DASH_COOLDOWN;

    let dashDir = normalize(inputDir);
    if (dashDir.x === 0 && dashDir.y === 0) {
      dashDir = { x: player.facingX || 1, y: player.facingY || 0 };
    }
    player.vx = dashDir.x * GAME_CONSTANTS.DASH_SPEED;
    player.vy = dashDir.y * GAME_CONSTANTS.DASH_SPEED;
  }

  // If in hit-stun, cannot apply regular steering acceleration
  if (player.hitStunTimer === 0 && !player.isDashing) {
    const normalizedInput = normalize(inputDir);
    if (normalizedInput.x !== 0 || normalizedInput.y !== 0) {
      player.facingX = normalizedInput.x;
      player.facingY = normalizedInput.y;

      player.vx += normalizedInput.x * GAME_CONSTANTS.MOVE_ACCEL * dt;
      player.vy += normalizedInput.y * GAME_CONSTANTS.MOVE_ACCEL * dt;

      // Speed clamp
      const currentSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
      if (currentSpeed > GAME_CONSTANTS.MAX_SPEED) {
        player.vx = (player.vx / currentSpeed) * GAME_CONSTANTS.MAX_SPEED;
        player.vy = (player.vy / currentSpeed) * GAME_CONSTANTS.MAX_SPEED;
      }
    }
  }

  // Apply friction/damping
  const frictionFactor = Math.max(0, 1 - GAME_CONSTANTS.FRICTION * dt);
  if (!player.isDashing) {
    player.vx *= frictionFactor;
    player.vy *= frictionFactor;
  }

  // Integrate position
  player.x += player.vx * dt;
  player.y += player.vy * dt;
}

export function resolvePlayerCollisions(players: PlayerPhysicsState[]): void {
  const count = players.length;
  for (let i = 0; i < count; i++) {
    const p1 = players[i];
    if (!p1.isAlive) continue;

    for (let j = i + 1; j < count; j++) {
      const p2 = players[j];
      if (!p2.isAlive) continue;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = GAME_CONSTANTS.PLAYER_RADIUS * 2;

      if (dist < minDist && dist > 0.0001) {
        // Normal vector from p1 to p2
        const nx = dx / dist;
        const ny = dy / dist;

        // Separate bodies so they don't overlap or stick
        const overlap = minDist - dist;
        p1.x -= nx * (overlap * 0.5);
        p1.y -= ny * (overlap * 0.5);
        p2.x += nx * (overlap * 0.5);
        p2.y += ny * (overlap * 0.5);

        // Calculate knockback impulse
        let knockbackP1: number = GAME_CONSTANTS.BASE_KNOCKBACK;
        let knockbackP2: number = GAME_CONSTANTS.BASE_KNOCKBACK;

        if (p1.isDashing && !p2.isDashing) {
          knockbackP2 = GAME_CONSTANTS.DASH_KNOCKBACK;
          p2.hitStunTimer = GAME_CONSTANTS.HIT_STUN_DURATION;
          p2.vx = nx * knockbackP2;
          p2.vy = ny * knockbackP2;
          p1.vx = -nx * (knockbackP1 * 0.4);
          p1.vy = -ny * (knockbackP1 * 0.4);
        } else if (p2.isDashing && !p1.isDashing) {
          knockbackP1 = GAME_CONSTANTS.DASH_KNOCKBACK;
          p1.hitStunTimer = GAME_CONSTANTS.HIT_STUN_DURATION;
          p1.vx = -nx * knockbackP1;
          p1.vy = -ny * knockbackP1;
          p2.vx = nx * (knockbackP2 * 0.4);
          p2.vy = ny * (knockbackP2 * 0.4);
        } else {
          // Both dashing or both regular
          const impulse = (p1.isDashing && p2.isDashing)
            ? GAME_CONSTANTS.DASH_KNOCKBACK
            : GAME_CONSTANTS.BASE_KNOCKBACK;
          p1.vx = -nx * impulse;
          p1.vy = -ny * impulse;
          p2.vx = nx * impulse;
          p2.vy = ny * impulse;
          if (p1.isDashing && p2.isDashing) {
            p1.hitStunTimer = GAME_CONSTANTS.HIT_STUN_DURATION;
            p2.hitStunTimer = GAME_CONSTANTS.HIT_STUN_DURATION;
          }
        }
      }
    }
  }
}

export function checkEliminations(
  players: PlayerPhysicsState[],
  arenaCenter: Vector2D,
  arenaRadius: number,
): string[] {
  const newlyEliminated: string[] = [];
  for (const p of players) {
    if (p.isAlive) {
      if (!isWithinArena({ x: p.x, y: p.y }, arenaCenter, arenaRadius)) {
        p.isAlive = false;
        newlyEliminated.push(p.id);
      }
    }
  }
  return newlyEliminated;
}
