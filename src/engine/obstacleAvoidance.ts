/**
 * Circle–segment collision detection & quadratic Bézier detour generator
 * for obstacle-aware trajectory planning.
 */

import type { Vec2 } from "./fabrik";

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  r: number;
}

export const SAFETY_MARGIN = 18; // px of clearance around each obstacle

/** Distance from point P to segment AB. */
export function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * abx;
  const cy = a.y + t * aby;
  return Math.hypot(p.x - cx, p.y - cy);
}

/** True if segment AB intersects the clearance circle of the obstacle. */
export function segmentIntersectsObstacle(
  a: Vec2,
  b: Vec2,
  obstacle: Obstacle,
  margin: number = SAFETY_MARGIN
): boolean {
  return pointToSegmentDistance({ x: obstacle.x, y: obstacle.y }, a, b) <= obstacle.r + margin;
}

export interface BezierPath {
  a: Vec2;
  control: Vec2;
  b: Vec2;
  /** Obstacles the detour was bent around */
  avoided: string[];
}

/**
 * Build a quadratic Bézier from A to B that bends around any obstacle
 * intersecting the straight segment. The control point is placed on the
 * perpendicular bisector, offset to the side opposite the deepest intruder.
 */
export function planDetour(a: Vec2, b: Vec2, obstacles: Obstacle[]): BezierPath {
  const blocking = obstacles.filter((o) => segmentIntersectsObstacle(a, b, o));

  if (blocking.length === 0) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return { a, control: mid, b, avoided: [] };
  }

  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len = Math.hypot(abx, aby) || 1;
  // Unit perpendicular to AB.
  const px = -aby / len;
  const py = abx / len;

  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  // For each blocking obstacle, compute the signed perpendicular distance of
  // its center from the line and the clearance it demands.
  let bestSide = 1;
  let maxOffset = 0;
  for (const o of blocking) {
    const cx = o.x - mid.x;
    const cy = o.y - mid.y;
    const side = cx * px + cy * py >= 0 ? 1 : -1;
    const offset = o.r + SAFETY_MARGIN + 24; // clearance + detour amplitude
    if (offset > maxOffset) {
      maxOffset = offset;
      bestSide = -side; // push to the opposite side of the intruder
    }
  }

  const control = {
    x: mid.x + px * bestSide * maxOffset,
    y: mid.y + py * bestSide * maxOffset,
  };

  return { a, control, b, avoided: blocking.map((o) => o.id) };
}

/** Evaluate a quadratic Bézier at t ∈ [0, 1]. */
export function evalBezier(path: BezierPath, t: number): Vec2 {
  const mt = 1 - t;
  return {
    x: mt * mt * path.a.x + 2 * mt * t * path.control.x + t * t * path.b.x,
    y: mt * mt * path.a.y + 2 * mt * t * path.control.y + t * t * path.b.y,
  };
}
