/**
 * KinematicsControls — arm configuration sliders:
 * joint count (2–5 DOF), per-link base lengths, solver damping.
 */

"use client";

import { useSimStore } from "@/store/useSimStore";
import { Cpu, Ruler, SlidersHorizontal } from "lucide-react";

export default function KinematicsControls() {
  const dof = useSimStore((s) => s.dof);
  const linkLengths = useSimStore((s) => s.linkLengths);
  const damping = useSimStore((s) => s.damping);
  const setDof = useSimStore((s) => s.setDof);
  const setLinkLength = useSimStore((s) => s.setLinkLength);
  const setDamping = useSimStore((s) => s.setDamping);

  return (
    <div className="space-y-3 border-t border-zinc-800/80 pt-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          <Cpu size={11} className="text-cyan-400" /> Arm Configuration
        </span>
        <span className="tabular text-[10px] text-cyan-400">{dof}-DOF</span>
      </div>

      {/* DOF selector */}
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="dof" className="text-[11px] text-zinc-400">
          Joint Count
        </label>
        <div className="flex items-center gap-1.5">
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setDof(n)}
              className={`h-6 w-6 rounded-md border text-[11px] tabular transition-colors ${
                dof === n
                  ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-200"
              }`}
              aria-pressed={dof === n}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Per-link lengths */}
      {linkLengths.map((len, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor={`link-${i}`} className="flex items-center gap-1 text-[11px] text-zinc-400">
              <Ruler size={10} className="text-zinc-600" /> L{i + 1}
              {i === 0 ? " (base)" : ""}
            </label>
            <span className="tabular text-[10px] text-zinc-500">{len}px</span>
          </div>
          <input
            id={`link-${i}`}
            type="range"
            min={60}
            max={180}
            step={2}
            value={len}
            onChange={(e) => setLinkLength(i, Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-cyan-400"
          />
        </div>
      ))}

      {/* Solver damping */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="damping" className="flex items-center gap-1 text-[11px] text-zinc-400">
            <SlidersHorizontal size={10} className="text-zinc-600" /> Solver Damping
          </label>
          <span className="tabular text-[10px] text-zinc-500">{damping}%</span>
        </div>
        <input
          id="damping"
          type="range"
          min={0}
          max={100}
          step={1}
          value={damping}
          onChange={(e) => setDamping(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-cyan-400"
        />
      </div>
    </div>
  );
}
