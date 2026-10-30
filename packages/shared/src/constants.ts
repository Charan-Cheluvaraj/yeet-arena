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

  // Match Timing
  COUNTDOWN_DURATION: 3.0, // seconds for 3, 2, 1, GO!
  MATCH_DURATION: 60.0,    // seconds regular round
  SPAWN_PROTECTION: 1.0,   // seconds invincible on start

  // Sudden Death
  SUDDEN_DEATH_MIN_RADIUS: 72,     // px minimum arena radius
  SUDDEN_DEATH_SHRINK_DURATION: 20, // seconds to shrink down

  // Movement & Physics
  MOVE_ACCEL: 750,      // px/s^2
  MAX_SPEED: 160,       // px/s
  FRICTION: 6.0,        // damping factor
  DASH_SPEED: 420,      // instant dash velocity boost
  DASH_DURATION: 0.18,  // seconds
  DASH_COOLDOWN: 2.0,   // seconds
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
