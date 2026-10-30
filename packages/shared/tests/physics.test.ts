import { describe, it, expect } from 'vitest';
import { distance, isWithinArena, GAME_CONSTANTS } from '../src/index.js';

describe('Shared Physics & Logic', () => {
  it('calculates distance accurately', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('determines if coordinates are within the arena boundary', () => {
    const center = { x: 320, y: 180 };
    expect(isWithinArena({ x: 320, y: 180 }, center, GAME_CONSTANTS.ARENA_RADIUS)).toBe(true);
    expect(isWithinArena({ x: 320, y: 330 }, center, GAME_CONSTANTS.ARENA_RADIUS)).toBe(false);
  });
});

