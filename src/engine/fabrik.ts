/**
 * FABRIK (Forward And Backward Reaching Inverse Kinematics) solver.
 * Pure TypeScript — no React, no DOM. Safe to run at 60 FPS.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface SolveResult {
  /** Joint positions, joints[0] = base. Length = linkLengths.length + 1 */
  joints: Vec2[];
  /** Absolute link angles in degrees: angles[i] is the heading of link i */
  angles: number[];
  /** False when the target lies outside the total reach radius */
  reachable: boolean;
  /** Distance from the base to the target */
  distance: number;
}

export const FABRIK_ITERATIONS = 12;

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
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

  // Initialize joints collinearly along +x if no seed is provided.
  let joints: Vec2[] =
    initialJoints && initialJoints.length === n + 1
      ? initialJoints.map((p) => ({ ...p }))
      : (() => {
          const pts: Vec2[] = [{ ...base }];
          let acc = base.x;
          for (let i = 0; i < n; i++) {
            acc += linkLengths[i];
            pts.push({ x: acc, y: base.y });
          }
          return pts;
        })();

  const reachable = distance <= totalReach;

  if (!reachable) {
    // Stretch all joints collinearly toward the target.
    const dx = target.x - base.x;
    const dy = target.y - base.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    joints = [{ ...base }];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += linkLengths[i];
      joints.push({ x: base.x + ux * acc, y: base.y + uy * acc });
    }
    return makeResult(joints, base, distance, false);
  }

  if (distance < 1e-9) {
    // Degenerate: target exactly on the base — fold the arm.
    joints = joints.map(() => ({ ...base }));
    return makeResult(joints, base, distance, true);
  }

  joints[0] = { ...base };

  for (let iter = 0; iter < iterations; iter++) {
    // Backward reaching pass: pin the end-effector to the target.
    joints[n] = { ...target };
    for (let i = n - 1; i >= 0; i--) {
      const next = joints[i + 1];
      const d = dist(joints[i], next) || 1e-9;
      const ratio = linkLengths[i] / d;
      joints[i] = {
        x: next.x + (joints[i].x - next.x) * ratio,
        y: next.y + (joints[i].y - next.y) * ratio,
      };
    }

    // Forward reaching pass: pin the base to the anchor.
    joints[0] = { ...base };
    for (let i = 0; i < n; i++) {
      const prev = joints[i];
      const d = dist(joints[i + 1], prev) || 1e-9;
      const ratio = linkLengths[i] / d;
      joints[i + 1] = {
        x: prev.x + (joints[i + 1].x - prev.x) * ratio,
        y: prev.y + (joints[i + 1].y - prev.y) * ratio,
      };
    }

    if (dist(joints[n], target) < 0.01) break;
  }

  return makeResult(joints, base, distance, true);
}

function makeResult(
  joints: Vec2[],
  base: Vec2,
  distance: number,
  reachable: boolean
): SolveResult {
  const angles: number[] = [];
  for (let i = 0; i < joints.length - 1; i++) {
    const a = joints[i];
    const b = joints[i + 1];
    angles.push((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  }
  void base;
  return { joints, angles, reachable, distance };
}
