export const GAME_CONSTANTS = {
  CANVAS_WIDTH: 640,
  CANVAS_HEIGHT: 360,
  ARENA_CENTER_X: 320,
  ARENA_CENTER_Y: 180,
  ARENA_RADIUS: 140,
  PLAYER_RADIUS: 14,
  MAX_PLAYERS: 4,
  TICK_RATE: 30,
  PATCH_RATE: 50, // ms between Colyseus patches (20 Hz)

  // Movement & Physics
  MOVE_ACCEL: 750,      // px/s^2
  MAX_SPEED: 160,       // px/s
  FRICTION: 6.0,        // damping factor
  DASH_SPEED: 420,      // instant dash velocity boost
  DASH_DURATION: 0.18,  // seconds
  DASH_COOLDOWN: 1.8,   // seconds
  BASE_KNOCKBACK: 220,  // regular bump
  DASH_KNOCKBACK: 540,  // dash hit impulse
  HIT_STUN_DURATION: 0.25, // seconds
} as const;

export type GameStateStatus =
  | 'WAITING'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'SUDDEN_DEATH'
  | 'FINISHED';
