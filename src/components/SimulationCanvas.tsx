/**
 * SimulationCanvas — full-viewport 60 FPS HTML5 canvas.
 *
 * Physics runs inside requestAnimationFrame against refs (never React state).
 * The Zustand store is only touched every 4th frame to sync telemetry.
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSimStore } from "@/store/useSimStore";
import { solveFABRIK, dist, type Vec2 } from "@/engine/fabrik";
import {
  planDetour,
  evalBezier,
  pointToSegmentDistance,
  SAFETY_MARGIN,
  type BezierPath,
} from "@/engine/obstacleAvoidance";

const TRAIL_LENGTH = 60;
const AUTOPILOT_SPEED = 155; // px/s along the active segment

/** Base anchor is PERMANENTLY fixed at the dead-center origin of the world space. */
const WORLD_ORIGIN: Vec2 = Object.freeze({ x: 0, y: 0 }) as Vec2;

export default function SimulationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const jointsRef = useRef<Vec2[]>([]);
  const effTargetRef = useRef<Vec2>({ x: 180, y: -120 });
  const manualTargetRef = useRef<Vec2 | null>(null);
  const pointerRef = useRef<Vec2 | null>(null);
  const trailRef = useRef<Vec2[]>([]);
  const waypointIdxRef = useRef(0);
  const pathTRef = useRef(0);
  const plannedPathRef = useRef<BezierPath | null>(null);
  const draggingObstacleRef = useRef<string | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const fpsRef = useRef(60);
  const prevAnglesRef = useRef<number[]>([]);
  const prevTimeRef = useRef<number>(0);
  const frameRef = useRef(0);

  const setTelemetry = useSimStore((s) => s.setTelemetry);

  /* ------------------------------------------------------------------ */
  /* Canvas sizing with HiDPI support                                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? window.innerWidth;
      const h = parent?.clientHeight ?? window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sizeRef.current = { w, h, dpr };
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Main render / physics loop                                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      const prev = prevTimeRef.current || now - 16.7;
      const dt = Math.min((now - prev) / 1000, 0.05);
      prevTimeRef.current = now;
      frameRef.current += 1;
      fpsRef.current = fpsRef.current * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;

      const { w: W, h: H, dpr } = sizeRef.current;
      if (W === 0 || H === 0) return;
      const cx = W / 2;
      const cy = H / 2;

      const state = useSimStore.getState();
      const { linkLengths, obstacles, waypoints, autoPilot, damping } = state;
      const base: Vec2 = { ...WORLD_ORIGIN }; // (0, 0) in translated world space

      /* ---- resolve (smooth) target -------------------------------- */
      let rawTarget: Vec2;
      let planned: BezierPath | null = null;
      let avoiding = false;

      if (autoPilot && waypoints.length >= 2) {
        const i = waypointIdxRef.current % waypoints.length;
        const a = waypoints[i];
        const b = waypoints[(i + 1) % waypoints.length];
        planned = planDetour(a, b, obstacles);
        avoiding = planned.avoided.length > 0;

        const chord = Math.max(dist(a, b), 1);
        pathTRef.current += (AUTOPILOT_SPEED * dt) / chord;
        if (pathTRef.current >= 1) {
          pathTRef.current = 0;
          waypointIdxRef.current = (i + 1) % waypoints.length;
        }
        rawTarget = evalBezier(planned, Math.min(pathTRef.current, 1));
        plannedPathRef.current = planned;
      } else if (autoPilot && waypoints.length === 1) {
        rawTarget = waypoints[0];
        plannedPathRef.current = null;
      } else {
        rawTarget = manualTargetRef.current ?? pointerRef.current ?? { x: 170, y: -130 };
        plannedPathRef.current = null;
      }

      // Solver damping: low-pass the target so the arm glides instead of snapping.
      const alpha = 1 - damping / 130;
      const eff = effTargetRef.current;
      eff.x += (rawTarget.x - eff.x) * alpha;
      eff.y += (rawTarget.y - eff.y) * alpha;

      /* ---- solve FABRIK ------------------------------------------- */
      const solved = solveFABRIK(base, linkLengths, eff, 12, jointsRef.current);
      jointsRef.current = solved.joints;

      // Angular velocity (mean |Δθ| per second across joints).
      const prevAngles = prevAnglesRef.current;
      let omega = 0;
      if (prevAngles.length === solved.angles.length && dt > 0) {
        let acc = 0;
        for (let i = 0; i < solved.angles.length; i++) {
          acc += Math.abs(solved.angles[i] - prevAngles[i]);
        }
        omega = acc / solved.angles.length / dt;
      }
      prevAnglesRef.current = solved.angles.slice();

      // End-effector collision proximity (manual-mode rerouting indicator).
      const ee = solved.joints[solved.joints.length - 1];
      const eeBlocked = obstacles.some(
        (o) => Math.hypot(ee.x - o.x, ee.y - o.y) <= o.r + SAFETY_MARGIN
      );

      const status = !solved.reachable
        ? "OUT_OF_REACH"
        : avoiding || eeBlocked
          ? "AVOIDING"
          : "OPTIMAL";

      /* ---- trail --------------------------------------------------- */
      trailRef.current.push({ ...ee });
      if (trailRef.current.length > TRAIL_LENGTH) trailRef.current.shift();

      /* ================= DRAW =================
       * Two explicit transform passes, both in device pixels:
       *  1. Screen space: scale(dpr) only — background + grid, origin top-left
       *  2. World space:  scale(dpr) * translate(cx, cy) — origin dead-center
       *     so (0,0) is the arm base in world coordinates.
       * ------------------------------------------------------------ */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, W, H);

      drawGrid(ctx, W, H, cx, cy);

      // World space: device-pixel transform with the center offset folded in.
      ctx.setTransform(dpr, 0, 0, dpr, dpr * cx, dpr * cy);

      // Max-reach boundary (dashed).
      const totalReach = linkLengths.reduce((a, b) => a + b, 0);
      ctx.beginPath();
      ctx.setLineDash([6, 10]);
      ctx.arc(0, 0, totalReach, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(6, 182, 212, 0.22)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Planned path preview (dashed cyan Bézier).
      if (plannedPathRef.current) {
        const p = plannedPathRef.current;
        ctx.beginPath();
        ctx.setLineDash([8, 6]);
        ctx.moveTo(p.a.x, p.a.y);
        ctx.quadraticCurveTo(p.control.x, p.control.y, p.b.x, p.b.y);
        ctx.strokeStyle = avoiding ? "rgba(245, 158, 11, 0.75)" : "rgba(6, 182, 212, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);

        // Waypoint diamonds.
        for (let i = 0; i < waypoints.length; i++) {
          const wp = waypoints[i];
          const active = i === waypointIdxRef.current % waypoints.length;
          ctx.save();
          ctx.translate(wp.x, wp.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = active ? "#06b6d4" : "rgba(6,182,212,0.35)";
          ctx.fillRect(-5, -5, 10, 10);
          ctx.restore();
        }
      }

      // Obstacles + clearance halos.
      for (const o of obstacles) {
        ctx.beginPath();
        ctx.setLineDash([4, 6]);
        ctx.arc(o.x, o.y, o.r + SAFETY_MARGIN, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
        ctx.fill();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Hazard glyph.
        ctx.fillStyle = "rgba(245, 158, 11, 0.85)";
        ctx.font = "600 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", o.x, o.y + 0.5);
      }

      // End-effector trail (fading).
      const trail = trailRef.current;
      for (let i = 1; i < trail.length; i++) {
        const t = i / trail.length;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `rgba(6, 182, 212, ${(t * 0.65).toFixed(3)})`;
        ctx.lineWidth = 1.5 + t * 1.5;
        ctx.stroke();
      }

      // Target reticle.
      drawReticle(ctx, eff.x, eff.y, status);

      // Robot arm: casing then core.
      const joints = solved.joints;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(joints[0].x, joints[0].y);
      for (let i = 1; i < joints.length; i++) ctx.lineTo(joints[i].x, joints[i].y);
      ctx.strokeStyle = "#27272a";
      ctx.lineWidth = 13;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(joints[0].x, joints[0].y);
      for (let i = 1; i < joints.length; i++) ctx.lineTo(joints[i].x, joints[i].y);
      const linkGrad = ctx.createLinearGradient(joints[0].x, joints[0].y, ee.x, ee.y);
      linkGrad.addColorStop(0, "#e4e4e7");
      linkGrad.addColorStop(1, "#a1a1aa");
      ctx.strokeStyle = linkGrad;
      ctx.lineWidth = 6.5;
      ctx.stroke();

      // Servo housings / joint pivots.
      for (let i = 0; i < joints.length; i++) {
        const isBase = i === 0;
        const isEE = i === joints.length - 1;
        const r = isBase ? 9 : isEE ? 5 : 6.5;

        ctx.save();
        ctx.shadowColor = "#06b6d4";
        ctx.shadowBlur = isBase ? 8 : 16;
        ctx.beginPath();
        ctx.arc(joints[i].x, joints[i].y, r, 0, Math.PI * 2);
        ctx.fillStyle = isBase ? "#3f3f46" : "#06b6d4";
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(joints[i].x, joints[i].y, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = isBase ? "#06b6d4" : "#ecfeff";
        ctx.fill();
      }

      // Base pedestal.
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.strokeStyle = "#52525b";
      ctx.lineWidth = 2;
      ctx.stroke();

      // End-effector gripper (two prongs along final link direction).
      const last = joints[joints.length - 1];
      const prevJ = joints[joints.length - 2];
      const gripAngle = Math.atan2(last.y - prevJ.y, last.x - prevJ.x);
      for (const spread of [-0.55, 0.55]) {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(
          last.x + Math.cos(gripAngle + spread) * 13,
          last.y + Math.sin(gripAngle + spread) * 13
        );
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Base + target coordinate labels.
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(161, 161, 170, 0.8)";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("P0 (0, 0)", 12, 14);
      ctx.fillStyle = "rgba(6, 182, 212, 0.9)";
      ctx.fillText(`T (${Math.round(eff.x)}, ${Math.round(-eff.y)})`, eff.x + 14, eff.y + 12);

      /* ---- throttled HUD sync (every 4th frame ≈ 15 Hz) ------------ */
      if (frameRef.current % 4 === 0) {
        setTelemetry({
          angles: solved.angles.map((a) => Math.round(a * 10) / 10),
          endEffector: { x: Math.round(ee.x), y: Math.round(-ee.y) },
          omega: Math.round(omega),
          status: status as "OPTIMAL" | "AVOIDING" | "OUT_OF_REACH",
          fps: Math.round(fpsRef.current),
        });
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------------ */
  /* Pointer handling: drag obstacles / steer target                      */
  /* ------------------------------------------------------------------ */
  /* Pointer → world coordinates: CSS-pixel space centered on (0, 0).
   * Independent of devicePixelRatio by design — the ctx transform maps
   * these same CSS px to sharp device pixels, and toWorld maps client px
   * to the centered origin that (0,0)-dead-center world space uses. */
  const toWorld = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Vec2 => {
    const rect = canvasRef.current!.getBoundingClientRect();
    // rect.width / 2 === sizeRef.current.w / 2 (CSS pixels) — the same
    // center used for the world-space ctx.setTransform offset.
    return {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pos = toWorld(e);
      const { obstacles, autoPilot, moveObstacle } = useSimStore.getState();

      // Hit-test obstacles, top-most first.
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        if (Math.hypot(pos.x - o.x, pos.y - o.y) <= o.r + 8) {
          draggingObstacleRef.current = o.id;
          moveObstacle(o.id, pos.x, pos.y);
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          return;
        }
      }
      if (!autoPilot) manualTargetRef.current = pos;
    },
    [toWorld]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pos = toWorld(e);
      pointerRef.current = pos;
      const { autoPilot, moveObstacle } = useSimStore.getState();

      if (draggingObstacleRef.current) {
        moveObstacle(draggingObstacleRef.current, pos.x, pos.y);
      } else if (!autoPilot) {
        manualTargetRef.current = pos;
      }
    },
    [toWorld]
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingObstacleRef.current = null;
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => {
        pointerRef.current = null;
      }}
    />
  );
}

/* ================================================================== */
/* Drawing helpers                                                     */
/* ================================================================== */

function drawGrid(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cx: number,
  cy: number
) {
  const minor = 10;
  const majorEvery = 4; // 40 px majors

  // Minor subdivisions
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#121215";
  ctx.beginPath();
  for (let x = cx % minor; x <= W; x += minor) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = cy % minor; y <= H; y += minor) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  // Major lines
  ctx.strokeStyle = "#18181b";
  ctx.beginPath();
  for (let x = cx % (minor * majorEvery), i = 0; x <= W; x += minor, i++) {
    if (i % majorEvery === 0) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
  }
  for (let y = cy % (minor * majorEvery), i = 0; y <= H; y += minor, i++) {
    if (i % majorEvery === 0) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
  }
  ctx.stroke();

  // Axes through origin
  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(W, cy);
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, H);
  ctx.stroke();
}

function drawReticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  status: string
) {
  const color = status === "OUT_OF_REACH" ? "#ef4444" : "#06b6d4";
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.75;

  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair ticks.
  for (const [dx, dy] of [
    [0, -16],
    [0, 16],
    [-16, 0],
    [16, 0],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * 0.65, y + dy * 0.65);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
