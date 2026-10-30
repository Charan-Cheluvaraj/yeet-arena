import { GAME_CONSTANTS, GameStateStatus } from './constants.js';
import {
  PlayerPhysicsState,
  Vector2D,
  updatePlayerMovement,
  resolvePlayerCollisions,
  checkEliminations,
  calculateSuddenDeathRadius,
  CollisionEvent,
} from './physics.js';

export interface MatchState {
  status: GameStateStatus;
  countdownTimer: number; // starts at COUNTDOWN_DURATION
  matchTimer: number;     // starts at MATCH_DURATION
  suddenDeathElapsed: number;
  arenaRadius: number;
  winnerId: string | null;
  isDraw: boolean;
  players: PlayerPhysicsState[];
}

export function createInitialMatchState(
  players: PlayerPhysicsState[],
  skipSpawnProtection: boolean = false,
): MatchState {
  return {
    status: 'COUNTDOWN',
    countdownTimer: GAME_CONSTANTS.COUNTDOWN_DURATION,
    matchTimer: GAME_CONSTANTS.MATCH_DURATION,
    suddenDeathElapsed: 0,
    arenaRadius: GAME_CONSTANTS.ARENA_RADIUS,
    winnerId: null,
    isDraw: false,
    players: players.map((p) => ({
      ...p,
      spawnProtectionTimer: skipSpawnProtection ? 0 : GAME_CONSTANTS.SPAWN_PROTECTION,
      dashCooldownTimer: 0,
      hitStunTimer: 0,
      isDashing: false,
      dashTimer: 0,
      vx: 0,
      vy: 0,
      isAlive: true,
    })),
  };
}

export interface MatchUpdateResult {
  state: MatchState;
  collisionEvents: CollisionEvent[];
  eliminatedIds: string[];
  countdownChanged: boolean;
  statusChanged: boolean;
}

export function stepMatch(
  state: MatchState,
  inputs: Map<string, { dir: Vector2D; wantDash: boolean }>,
  dt: number,
  arenaCenter: Vector2D = { x: GAME_CONSTANTS.ARENA_CENTER_X, y: GAME_CONSTANTS.ARENA_CENTER_Y },
): MatchUpdateResult {
  let statusChanged = false;
  let countdownChanged = false;
  const collisionEvents: CollisionEvent[] = [];
  let eliminatedIds: string[] = [];

  if (state.status === 'FINISHED') {
    return {
      state,
      collisionEvents,
      eliminatedIds,
      countdownChanged,
      statusChanged,
    };
  }

  // 1. COUNTDOWN
  if (state.status === 'COUNTDOWN') {
    const prevInt = Math.ceil(state.countdownTimer);
    state.countdownTimer -= dt;
    const currentInt = Math.ceil(state.countdownTimer);

    if (prevInt !== currentInt) {
      countdownChanged = true;
    }

    if (state.countdownTimer <= 0) {
      state.status = 'PLAYING';
      statusChanged = true;
    }

    return {
      state,
      collisionEvents,
      eliminatedIds,
      countdownChanged,
      statusChanged,
    };
  }

  // 2. PLAYING / SUDDEN_DEATH
  if (state.status === 'PLAYING' || state.status === 'SUDDEN_DEATH') {
    if (state.status === 'PLAYING') {
      state.matchTimer -= dt;
      if (state.matchTimer <= 0) {
        state.matchTimer = 0;
        const aliveCount = state.players.filter((p) => p.isAlive).length;
        if (aliveCount > 1) {
          state.status = 'SUDDEN_DEATH';
          statusChanged = true;
        }
      }
    }

    if (state.status === 'SUDDEN_DEATH') {
      state.suddenDeathElapsed += dt;
      state.arenaRadius = calculateSuddenDeathRadius(state.suddenDeathElapsed);
    }

    // Process movements
    for (const player of state.players) {
      if (!player.isAlive) continue;
      const input = inputs.get(player.id) || { dir: { x: 0, y: 0 }, wantDash: false };
      updatePlayerMovement(player, input.dir, input.wantDash, dt);
    }

    // Collisions
    const events = resolvePlayerCollisions(state.players);
    collisionEvents.push(...events);

    // Eliminations
    eliminatedIds = checkEliminations(state.players, arenaCenter, state.arenaRadius);

    // Outcome check
    const survivors = state.players.filter((p) => p.isAlive);
    if (survivors.length <= 1) {
      state.status = 'FINISHED';
      statusChanged = true;
      if (survivors.length === 1) {
        state.winnerId = survivors[0].id;
        state.isDraw = false;
      } else {
        state.winnerId = null;
        state.isDraw = true;
      }
    }
  }

  return {
    state,
    collisionEvents,
    eliminatedIds,
    countdownChanged,
    statusChanged,
  };
}
