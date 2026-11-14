/**
 * TopControlBar — floating brand block (top-left) and preset/action bar
 * (top-center): brand badge, AUTO-PILOT toggle, 1-click presets,
 * spawn-obstacle, share URL and export.
 */

"use client";

import { useCallback, useState } from "react";
import { useSimStore } from "@/store/useSimStore";
import { PRESETS } from "@/engine/presets";
import { encodeScenario } from "@/utils/urlSerializer";
import {
  Bot,
  Check,
  Download,
  Eraser,
  Link2,
  MousePointer2,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";

export default function TopControlBar() {
  const autoPilot = useSimStore((s) => s.autoPilot);
  const setAutoPilot = useSimStore((s) => s.setAutoPilot);
  const activePreset = useSimStore((s) => s.activePreset);
  const applyPreset = useSimStore((s) => s.applyPreset);
  const addObstacle = useSimStore((s) => s.addObstacle);
  const clearObstacles = useSimStore((s) => s.clearObstacles);
  const setExportOpen = useSimStore((s) => s.setExportOpen);
  const fps = useSimStore((s) => s.telemetry.fps);

  const [copied, setCopied] = useState(false);

  const shareScenario = useCallback(async () => {
    const s = useSimStore.getState();
    const url = `${window.location.origin}${window.location.pathname}?sim=${encodeScenario({
      dof: s.dof,
      linkLengths: s.linkLengths,
      obstacles: s.obstacles,
      waypoints: s.waypoints,
    })}`;
    try {
      window.history.replaceState(null, "", url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy scenario URL:", url);
    }
  }, []);

  const spawnObstacle = useCallback(() => {
    // Spawn in the upper workspace, clear of the base.
    const angle = Math.random() * Math.PI * 2;
    const radius = 90 + Math.random() * 130;
    addObstacle(Math.cos(angle) * radius, Math.sin(angle) * radius - 30);
  }, [addObstacle]);

  return (
    <>
      {/* ── Top-left: brand + FPS + AUTO-PILOT ─────────────────────── */}
      <header className="glass absolute left-4 top-4 z-20 flex flex-col gap-2 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10">
            <Bot size={18} className="text-cyan-400" strokeWidth={1.75} />
          </div>
          <div className="leading-tight">
            <h1 className="text-[13px] font-bold tracking-[0.18em] text-zinc-100">
              ROBOVIBE <span className="text-cyan-400">STUDIO</span>
            </h1>
            <p className="tabular text-[9px] uppercase tracking-[0.28em] text-zinc-500">
              v1.0 · IK Sandbox · <span className="text-emerald-400">{fps} FPS</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setAutoPilot(!autoPilot)}
          aria-pressed={autoPilot}
          className={`group flex items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[0.22em] transition-all duration-300 ${
            autoPilot
              ? "autopilot-on border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
              : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              autoPilot ? "animate-pulse bg-emerald-400" : "bg-zinc-600"
            }`}
          />
          AUTO-PILOT: {autoPilot ? "ON" : "OFF"}
          {autoPilot ? (
            <MousePointer2 size={10} className="opacity-70" />
          ) : (
            <MousePointer2 size={10} className="opacity-40" />
          )}
        </button>
      </header>

      {/* ── Top-center: presets + actions ──────────────────────────── */}
      <div className="glass absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl px-2 py-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id)}
            aria-pressed={activePreset === p.id}
            className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              activePreset === p.id
                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
                : "border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
            }`}
          >
            {p.name}
          </button>
        ))}

        <div className="mx-1 h-5 w-px bg-zinc-800" />

        <button
          onClick={spawnObstacle}
          title="Spawn obstacle"
          className="flex items-center gap-1 rounded-xl border border-transparent px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
        >
          <Plus size={12} strokeWidth={2.5} /> Obstacle
        </button>
        <button
          onClick={clearObstacles}
          title="Clear obstacles"
          className="rounded-xl border border-transparent p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200"
          aria-label="Clear obstacles"
        >
          <Trash2 size={14} />
        </button>

        <div className="mx-1 h-5 w-px bg-zinc-800" />

        <button
          onClick={shareScenario}
          title="Copy shareable scenario URL"
          className="flex items-center gap-1 rounded-xl border border-transparent px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-cyan-300"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" /> Copied
            </>
          ) : (
            <>
              <Share2 size={12} /> Share
            </>
          )}
        </button>
        <button
          onClick={() => setExportOpen(true)}
          title="Export waypoints / G-Code"
          className="flex items-center gap-1 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-500/20"
        >
          <Download size={12} /> Export
        </button>
      </div>

      {/* ── Bottom-left hint ───────────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-3 left-4 z-10 flex items-center gap-3 text-[9px] uppercase tracking-[0.2em] text-zinc-600">
        <span className="flex items-center gap-1.5">
          <Link2 size={10} className="text-zinc-700" /> Drag obstacles into the arm&apos;s path
        </span>
        <span className="hidden sm:inline text-zinc-800">|</span>
        <span className="hidden sm:flex items-center gap-1.5">
          <Eraser size={10} className="text-zinc-700" /> Auto-Pilot OFF → steer with cursor
        </span>
      </div>
    </>
  );
}
