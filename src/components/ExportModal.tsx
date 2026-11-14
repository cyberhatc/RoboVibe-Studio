/**
 * ExportModal — copy/download the waypoint program as JSON
 * or as simulated G-Code (G01 X... Y...) toolpaths.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSimStore } from "@/store/useSimStore";
import { X, FileJson, FileCode2, Copy, Download, Check } from "lucide-react";

type Tab = "json" | "gcode";

export default function ExportModal() {
  const open = useSimStore((s) => s.exportOpen);
  const setOpen = useSimStore((s) => s.setExportOpen);
  const [tab, setTab] = useState<Tab>("json");
  const [copied, setCopied] = useState(false);

  const waypoints = useSimStore((s) => s.waypoints);
  const linkLengths = useSimStore((s) => s.linkLengths);
  const obstacles = useSimStore((s) => s.obstacles);
  const dof = useSimStore((s) => s.dof);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const waypointJson = useMemo(
    () =>
      JSON.stringify(
        {
          meta: {
            generator: "RoboVibe Studio v1.0",
            createdAt: new Date().toISOString(),
            dof,
            linkLengths,
          },
          obstacles: obstacles.map((o) => ({ x: Math.round(o.x), y: Math.round(-o.y), r: o.r })),
          waypoints: waypoints.map((w) => ({ x: Math.round(w.x), y: Math.round(-w.y) })),
        },
        null,
        2
      ),
    [waypoints, linkLengths, obstacles, dof]
  );

  const gcode = useMemo(() => {
    const lines = [
      "; RoboVibe Studio — simulated toolpath",
      `; ${dof}-DOF arm · links [${linkLengths.join(", ")}]`,
      "G21 ; millimeters",
      "G90 ; absolute positioning",
      "G17 ; XY plane",
      "G0 Z5.0 ; safe height",
    ];
    waypoints.forEach((w, i) => {
      lines.push(`; waypoint ${i + 1}`);
      lines.push(`G0 X${w.x.toFixed(2)} Y${(-w.y).toFixed(2)}`);
      lines.push(`G1 Z0.0 F800`);
      lines.push(`G1 Z5.0`);
    });
    lines.push("G0 Z10.0", "M30");
    return lines.join("\n");
  }, [waypoints, linkLengths, dof]);

  if (!open) return null;

  const content = tab === "json" ? waypointJson : gcode;
  const filename = tab === "json" ? "robovibe-waypoints.json" : "robovibe-toolpath.gcode";
  const mime = tab === "json" ? "application/json" : "text/plain";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — user can select the text manually */
    }
  };

  const download = () => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Export scenario"
    >
      <div
        className="glass w-[min(560px,92vw)] rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-100">
            Export <span className="text-cyan-400">Scenario</span>
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex gap-1.5">
          {(
            [
              { id: "json", label: "Waypoint JSON", icon: FileJson },
              { id: "gcode", label: "G-Code Toolpath", icon: FileCode2 },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                tab === id
                  ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
                  : "border-zinc-800 text-zinc-500 hover:text-zinc-200"
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <pre className="tabular max-h-64 overflow-auto rounded-xl border border-zinc-800 bg-black/60 p-3 text-[10px] leading-relaxed text-zinc-300">
          {content}
        </pre>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={download}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-500/25"
          >
            <Download size={12} /> Download
          </button>
        </div>
      </div>
    </div>
  );
}
