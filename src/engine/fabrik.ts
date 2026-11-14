/**
 * FABRIK (Forward And Backward Reaching Inverse Kinematics) solver.
 * Pure TypeScript — no React, no DOM. Safe to run at 60 FPS.
 *
 * Segment-length invariant: after every pass, and at return, each link
 * i satisfies |joints[i+1] - joints[i]| === linkLengths[i] (within ε).
 * Angle convention:
 *   θ₁  — absolute world-frame heading of link 1 (degrees)
 *   θᵢ  — heading of link i relative to link i−1, wrapped to [-180, 180]
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface SolveResult {
  /** Joint positions, joints[0] = base. Length = linkLengths.length + 1 */
  joints: Vec2[];
  /**
   * Per-link angles in degrees. angles[0] is the absolute heading of the
   * first link; angles[i > 0] is the relative bend of link i vs link i−1.
   */
  angles: number[];
  /** False when the target lies outside the total reach radius */
  reachable: boolean;
  /** Distance from the base to the target */
  distance: number;
}

export const FABRIK_ITERATIONS = 12;

/** Below this distance two joints are considered coincident and a fallback direction is used. */
const EPSILON = 1e-6;

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Normalize (dx, dy). If the vector is degenerate, return `fallback`
 * instead of producing NaN/Inf (this is what previously collapsed links).
 */
function normalize(dx: number, dy: number, fallbackX: number, fallbackY: number) {
  const len = Math.hypot(dx, dy);
  if (len < EPSILON) return { x: fallbackX, y: fallbackY, len: 0 };
  return { x: dx / len, y: dy / len, len };
}

/** Wrap an angle difference into (-180, 180] degrees. */
function wrapDegrees(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/**
 * Solve a multi-link arm anchored at `base`.
 * If the target is beyond total reach, all links are stretched collinearly
 * toward the target (and `reachable` is reported as false).
 */
export function solveFABRIK(
  base: Vec2,
  linkLengths: number[],
  target: Vec2,
  iterations: number = FABRIK_ITERATIONS,
  initialJoints?: Vec2[]
): SolveResult {
  const n = linkLengths.length;
  const totalReach = linkLengths.reduce((a, b) => a + b, 0);
  const distance = dist(base, target);

  // Seed: along base→target direction (much better conditioned than +x),
  // or reuse the previous frame's solution if provided.
  const seedAngle = Math.atan2(target.y - base.y, target.x - base.x);
  let joints: Vec2[] =
    initialJoints && initialJoints.length === n + 1
      ? initialJoints.map((p) => ({ ...p }))
      : (() => {
          const pts: Vec2[] = [{ ...base }];
          let acc = 0;
          for (let i = 0; i < n; i++) {
            acc += linkLengths[i];
            pts.push({
              x: base.x + Math.cos(seedAngle) * acc,
              y: base.y + Math.sin(seedAngle) * acc,
            });
          }
          return pts;
        })();

  const reachable = distance <= totalReach;

  if (!reachable) {
    // Stretch all joints collinearly toward the target — lengths preserved exactly.
    const dir = normalize(target.x - base.x, target.y - base.y, 1, 0);
    joints = [{ ...base }];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += linkLengths[i];
      joints.push({ x: base.x + dir.x * acc, y: base.y + dir.y * acc });
    }
    return makeResult(joints, distance, false);
  }

  joints[0] = { ...base };

  // Direction memory for degenerate (coincident-joint) steps.
  let fallbackX = Math.cos(seedAngle);
  let fallbackY = Math.sin(seedAngle);

  for (let iter = 0; iter < iterations; iter++) {
    /* ---- Backward reaching pass ------------------------------------
     * Pin the end-effector to the target, then walk toward the base.
     * Every segment is re-solved to its fixed length from the child:
     *   p[i] = p[i+1] + normalize(p[i] - p[i+1]) * linkLengths[i]
     * ------------------------------------------------------------ */
    joints[n] = { ...target };
    for (let i = n - 1; i >= 0; i--) {
      const child = joints[i + 1];
      const dir = normalize(joints[i].x - child.x, joints[i].y - child.y, fallbackX, fallbackY);
      joints[i] = {
        x: child.x + dir.x * linkLengths[i],
        y: child.y + dir.y * linkLengths[i],
      };
      fallbackX = dir.x;
      fallbackY = dir.y;
    }

    /* ---- Forward reaching pass -------------------------------------
     * Re-anchor the base, then walk toward the end-effector.
     *   p[i+1] = p[i] + normalize(p[i+1] - p[i]) * linkLengths[i]
     * This re-imposes every fixed-length constraint exactly.
     * ------------------------------------------------------------ */
    joints[0] = { ...base };
    for (let i = 0; i < n; i++) {
      const parent = joints[i];
      const dir = normalize(joints[i + 1].x - parent.x, joints[i + 1].y - parent.y, fallbackX, fallbackY);
      joints[i + 1] = {
        x: parent.x + dir.x * linkLengths[i],
        y: parent.y + dir.y * linkLengths[i],
      };
      fallbackX = dir.x;
      fallbackY = dir.y;
    }

    if (dist(joints[n], target) < 0.01) break;
  }

  return makeResult(joints, distance, true);
}

function makeResult(joints: Vec2[], distance: number, reachable: boolean): SolveResult {
  // Headings of each link in world frame.
  const headings: number[] = [];
  for (let i = 0; i < joints.length - 1; i++) {
    const a = joints[i];
    const b = joints[i + 1];
    headings.push((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  }

  // θ₁ absolute; θᵢ relative to the preceding link vector, wrapped to [-180, 180].
  const angles: number[] = headings.map((h, i) =>
    i === 0 ? h : wrapDegrees(h - headings[i - 1])
  );

  return { joints, angles, reachable, distance };
}
