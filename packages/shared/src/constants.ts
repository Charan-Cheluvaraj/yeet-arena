export const GAME_CONSTANTS = {
  CANVAS_WIDTH: 640,
  CANVAS_HEIGHT: 360,
  ARENA_RADIUS: 140,
  PLAYER_RADIUS: 14,
  MAX_PLAYERS: 4,
  TICK_RATE: 30,
  PATCH_RATE: 50, // ms between Colyseus patches (20 Hz)
} as const;

export type GameStateStatus =
  | 'WAITING'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'SUDDEN_DEATH'
  | 'FINISHED';

