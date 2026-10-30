export interface Vector2D {
  x: number;
  y: number;
}

export function distance(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isWithinArena(pos: Vector2D, arenaCenter: Vector2D, arenaRadius: number): boolean {
  return distance(pos, arenaCenter) <= arenaRadius;
}

