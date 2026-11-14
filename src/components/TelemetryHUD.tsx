/**
 * TelemetryHUD — right-hand glassmorphism drawer:
 * status banner, θ₁..θₙ readouts, end-effector (X, Y), ω sparkline,
 * and the arm-tuning controls.
 */

"use client";

import { useEffect, useRef } from "react";
import { useSimStore } from "@/store/useSimStore";
import KinematicsControls from "./KinematicsControls";
import { Activity, Crosshair, Gauge, Radio } from "lucide-react";

const STATUS_STYLES = {
  OPTIMAL: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  AVOIDING: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  OUT_OF_REACH: "border-red-500/40 bg-red-500/10 text-red-300",
} as const;

const STATUS_LABEL = {
  OPTIMAL: "OPTIMAL PATH",
  AVOIDING: "REROUTING OBSTACLE",
  OUT_OF_REACH: "OUT OF REACH",
} as const;

const SPARK_LENGTH = 100;

export default function TelemetryHUD() {
  const telemetry = useSimStore((s) => s.telemetry);
  const dof = useSimStore((s) => s.dof);
  const sparkRef = useRef<number[]>(Array(SPARK_LENGTH).fill(0));
  const sparkPathRef = useRef<SVGPolylineElement>(null);

  const { angles, endEffector, omega, status, fps } = telemetry;

  // Append ω to the sparkline history and repaint the polyline imperatively.
  useEffect(() => {
    const history = sparkRef.current;
    history.push(omega);
    if (history.length > SPARK_LENGTH) history.shift();

    const max = Math.max(...history, 1);
    const W = 248;
    const H = 44;
    const step = W / (SPARK_LENGTH - 1);
    const points = history
      .map((v, i) => `${(i * step).toFixed(1)},${(H - (v / max) * (H - 4) - 2).toFixed(1)}`)
      .join(" ");
    sparkPathRef.current?.setAttribute("points", points);
  }, [omega]);

  return (
    <aside
      aria-label="Telemetry and arm configuration"
      className="glass absolute right-4 top-4 z-20 flex max-h-[calc(100vh-2rem)] w-80 flex-col gap-3 overflow-y-auto rounded-2xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          <Radio size={11} className="text-cyan-400" /> Live Telemetry
        </span>
        <span className="tabular rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400">
          {fps} FPS
        </span>
      </div>

      {/* Status banner */}
      <div
        role="status"
        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold tracking-[0.18em] transition-colors duration-300 ${STATUS_STYLES[status]}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            status === "OPTIMAL"
              ? "bg-emerald-400"
              : status === "AVOIDING"
                ? "animate-pulse bg-amber-400"
                : "animate-pulse bg-red-400"
          }`}
        />
        {STATUS_LABEL[status]}
      </div>

      {/* Joint angles */}
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: dof }, (_, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-2 py-1.5 text-center"
          >
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">
              θ{subscript(i + 1)}
            </div>
            <div className="tabular text-sm font-semibold text-zinc-100">
              {angles[i] !== undefined ? `${angles[i].toFixed(1)}°` : "—"}
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-widest text-cyan-500">
            <Crosshair size={9} /> EE X
          </div>
          <div className="tabular text-sm font-semibold text-cyan-300">{endEffector.x}</div>
        </div>
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-widest text-cyan-500">
            <Crosshair size={9} /> EE Y
          </div>
          <div className="tabular text-sm font-semibold text-cyan-300">{endEffector.y}</div>
        </div>
      </div>

      {/* Angular velocity sparkline */}
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-zinc-500">
            <Activity size={10} className="text-cyan-400" /> Angular Velocity ω
          </span>
          <span className="tabular text-[10px] text-zinc-400">{omega}°/s</span>
        </div>
        <svg viewBox="0 0 248 44" className="h-11 w-full" aria-hidden="true">
          <line x1="0" y1="43" x2="248" y2="43" stroke="#27272a" strokeWidth="1" />
          <polyline
            ref={sparkPathRef}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points=""
          />
        </svg>
      </div>

      {/* Arm tuning */}
      <KinematicsControls />

      {/* Footer readout */}
      <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[9px] uppercase tracking-widest text-zinc-600">
        <span className="flex items-center gap-1">
          <Gauge size={10} /> FABRIK · 12 iter
        </span>
        <span>Zero-latency client engine</span>
      </div>
    </aside>
  );
}

function subscript(n: number): string {
  const subs = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
  return String(n)
    .split("")
    .map((d) => subs[Number(d)] ?? d)
    .join("");
}
