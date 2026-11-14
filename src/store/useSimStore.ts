/**
 * Zustand store bridging UI controls, URL-hash serialization and telemetry.
 * The 60 FPS physics loop reads/writes the mutable canvas state directly
 * through refs; this store carries low-frequency UI + throttled telemetry.
 */

import { create } from "zustand";
import type { Vec2 } from "@/engine/fabrik";
import type { Obstacle } from "@/engine/obstacleAvoidance";
import { PRESETS } from "@/engine/presets";

export type SimStatus = "OPTIMAL" | "AVOIDING" | "OUT_OF_REACH";

export interface Telemetry {
  angles: number[];
  endEffector: Vec2;
  omega: number;
  status: SimStatus;
  fps: number;
}

export interface SimState {
  autoPilot: boolean;
  dof: number;
  linkLengths: number[];
  damping: number; // 0–100, higher = smoother/slower solver tracking
  obstacles: Obstacle[];
  waypoints: Vec2[];
  activePreset: string | null;
  exportOpen: boolean;
  telemetry: Telemetry;

  setAutoPilot: (v: boolean) => void;
  setDof: (dof: number) => void;
  setLinkLength: (index: number, length: number) => void;
  setDamping: (v: number) => void;
  addObstacle: (x?: number, y?: number, r?: number) => void;
  updateObstacle: (id: string, patch: Partial<Omit<Obstacle, "id">>) => void;
  moveObstacle: (id: string, x: number, y: number) => void;
  spawnObstacleAt: (x: number, y: number) => void;
  clearObstacles: () => void;
  applyPreset: (id: string) => void;
  resetWorkspace: () => void;
  setExportOpen: (open: boolean) => void;
  setTelemetry: (t: Telemetry) => void;
  hydrateScenario: (s: {
    dof: number;
    linkLengths: number[];
    obstacles: Obstacle[];
    waypoints: Vec2[];
  }) => void;
}

let obstacleCounter = 0;
const nextObstacleId = () => `obs-${Date.now().toString(36)}-${obstacleCounter++}`;

const DEFAULT_PRESET = PRESETS[0];

function resizeLinkLengths(current: number[], dof: number): number[] {
  const next = current.slice(0, dof);
  while (next.length < dof) next.push(110);
  return next;
}

const defaultObstacles = (): Obstacle[] =>
  DEFAULT_PRESET.obstacles.map((o) => ({ ...o, id: nextObstacleId() }));

export const useSimStore = create<SimState>((set, get) => ({
  autoPilot: true,
  dof: DEFAULT_PRESET.dof,
  linkLengths: [...DEFAULT_PRESET.linkLengths],
  damping: 35,
  obstacles: defaultObstacles(),
  waypoints: DEFAULT_PRESET.waypoints.map((w) => ({ ...w })),
  activePreset: DEFAULT_PRESET.id,
  exportOpen: false,
  telemetry: {
    angles: [],
    endEffector: { x: 0, y: 0 },
    omega: 0,
    status: "OPTIMAL",
    fps: 60,
  },

  setAutoPilot: (v) => set({ autoPilot: v }),

  setDof: (dof) =>
    set((state) => {
      const clamped = Math.max(2, Math.min(5, Math.round(dof)));
      return {
        dof: clamped,
        linkLengths: resizeLinkLengths(state.linkLengths, clamped),
        activePreset: null,
      };
    }),

  setLinkLength: (index, length) =>
    set((state) => {
      const linkLengths = state.linkLengths.slice();
      linkLengths[index] = Math.max(40, Math.min(200, Math.round(length)));
      return { linkLengths, activePreset: null };
    }),

  setDamping: (v) => set({ damping: Math.max(0, Math.min(100, Math.round(v))) }),

  addObstacle: (x = 0, y = -40, r = 30) =>
    set((state) => ({
      obstacles: [...state.obstacles, { id: nextObstacleId(), x, y, r }],
      activePreset: null,
    })),

  updateObstacle: (id, patch) =>
    set((state) => ({
      obstacles: state.obstacles.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })),

  moveObstacle: (id, x, y) =>
    set((state) => ({
      obstacles: state.obstacles.map((o) => (o.id === id ? { ...o, x, y } : o)),
    })),

  spawnObstacleAt: (x, y) => get().addObstacle(x, y, 28 + Math.random() * 14),

  clearObstacles: () => set({ obstacles: [], activePreset: null }),

  applyPreset: (id) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    set({
      dof: preset.dof,
      linkLengths: [...preset.linkLengths],
      obstacles: preset.obstacles.map((o) => ({ ...o, id: nextObstacleId() })),
      waypoints: preset.waypoints.map((w) => ({ ...w })),
      activePreset: preset.id,
      autoPilot: true,
    });
  },

  resetWorkspace: () => get().applyPreset(DEFAULT_PRESET.id),

  setExportOpen: (open) => set({ exportOpen: open }),

  setTelemetry: (t) => set({ telemetry: t }),

  hydrateScenario: (s) =>
    set({
      dof: s.dof,
      linkLengths: s.linkLengths,
      obstacles: s.obstacles.map((o) => ({ ...o, id: o.id || nextObstacleId() })),
      waypoints: s.waypoints,
      activePreset: null,
    }),
}));

const WORKSPACE_KEY = "robovibe_workspace_v1";

export interface PersistedWorkspace {
  dof: number;
  linkLengths: number[];
  obstacles: Obstacle[];
  waypoints: Vec2[];
  damping: number;
}

export function saveWorkspace(state: SimState) {
  if (typeof window === "undefined") return;
  try {
    const data: PersistedWorkspace = {
      dof: state.dof,
      linkLengths: state.linkLengths,
      obstacles: state.obstacles,
      waypoints: state.waypoints,
      damping: state.damping,
    };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

export function loadWorkspace(): PersistedWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>;
    if (!Array.isArray(parsed.linkLengths) || !Array.isArray(parsed.obstacles)) return null;
    return {
      dof: Math.max(2, Math.min(5, Number(parsed.dof) || 3)),
      linkLengths: parsed.linkLengths.map((n) => Number(n) || 110),
      obstacles: parsed.obstacles,
      waypoints: Array.isArray(parsed.waypoints) ? parsed.waypoints : [],
      damping: Number(parsed.damping) || 35,
    };
  } catch {
    return null;
  }
}
