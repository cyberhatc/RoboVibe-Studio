# RoboVibe Studio — Frontend & Backend Engineering Specification (`frontend.md`)

## 1. Tech Stack & Architectural Philosophy

To maximize execution speed in a vibe-coding environment while delivering a lag-free, aerospace-grade simulation, the stack separates **high-frequency physics rendering** from **low-frequency React UI controls**, paired with a lightweight, zero-latency storage/sharing backend.

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | React 19 / Next.js (App Router) + TypeScript | Component structure, HUD controls, and responsive layout. |
| **Styling** | Tailwind CSS + Lucide Icons | Pitch-black AMOLED CAD theme (`#09090b`) with glassmorphism panels. |
| **Graphics Engine** | Native HTML5 `<canvas>` (2D Context) | 60 FPS hardware-accelerated rendering of links, joints, grids, and trails. |
| **State Management** | React `useRef` (Physics Loop) + Zustand (UI HUD) | Prevents 60 FPS React re-render bottlenecks while keeping HUD sliders reactive. |
| **Backend / Persistence** | Client-Side Engine + LocalStorage / URL State + Optional Supabase Edge Sync | Instant zero-login persistence, shareable base64 simulation URLs, and optional cloud preset leaderboard. |

---

## 2. Frontend Component Hierarchy

```text
src/
├── app/
│   ├── layout.tsx               # Pitch-black viewport shell & monospace font setup (JetBrains Mono)
│   └── page.tsx                 # Main full-screen workspace orchestrator
├── components/
│   ├── TopControlBar.tsx        # Floating top bar: Brand badge, Auto-Pilot toggle, 1-click Presets, Share URL
│   ├── SimulationCanvas.tsx     # Full-viewport 60 FPS HTML5 Canvas + pointer drag/hit-testing handlers
│   ├── TelemetryHUD.tsx         # Right-hand glassmorphism panel: θ₁..θₙ readouts, SVG sparklines, status pill
│   ├── KinematicsControls.tsx   # Arm configuration: DOF slider (2–5 joints), link lengths, solver speed
│   └── ExportModal.tsx          # Modal to copy/download waypoint JSON or simulated G-Code
├── engine/
│   ├── fabrik.ts                # Pure TypeScript FABRIK inverse kinematics math solver
│   ├── obstacleAvoidance.ts     # Circle-segment collision detector & Cubic Bezier detour generator
│   └── presets.ts               # Pre-configured coordinates & obstacle layouts for instant demos
└── store/
    └── useSimStore.ts           # Zustand store bridging UI controls, URL hash serialization, and telemetry
```

---

## 3. UI/UX & Visual Design System

### Color Palette (Technical CAD / AMOLED Dark)
* **Canvas Background:** `#09090b` (Deep Obsidian) with `#18181b` 40px major grid lines and `#121215` 10px minor subdivisions.
* **Primary Robot Arm Links:** `#e4e4e7` (Brushed Titanium) with `#06b6d4` (Electric Cyan) glowing joint pivots and inverse-kinematics target reticle.
* **End-Effector Motion Trail:** Linear-alpha fading polyline in `rgba(6, 182, 212, 0.65)` (last 60 frames).
* **Hazard Obstacles:** `#f59e0b` (Warning Amber) translucent fill (`rgba(245, 158, 11, 0.15)`) with dashed safety buffer rings (`+18px` clearance).
* **HUD Panels:** `bg-zinc-950/75 backdrop-blur-md border border-zinc-800/80` with `JetBrains Mono` tabular numbers (`tabular-nums`) so digits never jitter during rapid motion.

### Screen Layout & Spatial Zones
1. **100vw × 100vh Canvas Base:** Occupies the entire screen with zero scrollbars.
2. **Floating Top-Left Header (`top-4 left-4`):**
   * App title (`ROBOVIBE STUDIO v1.0`) + live FPS counter (`60 FPS`).
   * Primary CTA pill: **`[● AUTO-PILOT: ON]`** (glowing emerald/cyan toggle).
3. **Floating Top-Center Preset Bar (`top-4 left-1/2 -translate-x-1/2`):**
   * Quick-switch buttons: `Pick & Place` | `Obstacle Slalom` | `5-DOF Reach Test` | `+ Spawn Obstacle`.
4. **Floating Right Telemetry & Config Drawer (`top-4 right-4 w-80`):**
   * **Status Banner:** Dynamic pill (`OPTIMAL PATH` in green, `REROUTING OBSTACLE` in amber, `OUT OF REACH` in red).
   * **Live Joint Angles:** Real-time readout cards for $\theta_1, \theta_2, \theta_3 \dots \theta_n$ and End-Effector $(X, Y)$.
   * **Velocity Sparkline:** Lightweight inline `<svg>` polyline plotting angular velocity $\omega$ over the last 100 ticks.
   * **Arm Tuning Sliders:** Joint Count (`2` to `5`), Base Link Length (`80px–180px`), and Solver Damping.

---

## 4. 60 FPS Canvas Rendering & Interaction Pipeline

To ensure zero lag during hackathon demos, **never store frame-by-frame $(x, y)$ coordinates in React `useState`**. Instead, run an isolated `requestAnimationFrame` loop inside `SimulationCanvas.tsx`:

1. **Input & Hit-Testing (`onPointerDown` / `onPointerMove`):**
   * Convert screen pointer coordinates $(e.\text{clientX}, e.\text{clientY})$ into canvas world coordinates centered at $(W/2, H/2)$.
   * Check distance to each obstacle center $C_k$: if $d \le r_k$, lock `draggedObstacleId = k` so the user can drag hazards smoothly across the arm's path.
   * If `autoPilot === false`, set target $T = (x_{\text{pointer}}, y_{\text{pointer}})$.
2. **Physics & Trajectory Step:**
   * If `autoPilot === true`, advance interpolation parameter $t \in [0, 1]$ between active waypoints $A$ and $B$.
   * Query `obstacleAvoidance.ts` to bend the path via a quadratic/cubic Bezier control point whenever any obstacle intersects $\overline{AB}$.
   * Pass target $T$ into `solveFABRIK(joints, linkLengths, target)` to compute updated joint positions.
3. **Canvas Draw Pass:**
   * Clear frame $\rightarrow$ Draw coordinate grid $\rightarrow$ Draw max-reach dashed circle ($R = \sum L_i$) $\rightarrow$ Draw planned Bezier path preview $\rightarrow$ Draw obstacles & clearance halos $\rightarrow$ Draw fading end-effector trail $\rightarrow$ Draw robotic arm links, servo housings, and end-effector gripper.
4. **Throttled HUD Sync (15 Hz):**
   * Every 4th animation frame (~15 times/sec), push rounded joint angles $\theta_i$ and velocity metrics to the Zustand store so the React telemetry panel updates smoothly without hurting frame rate.

---

## 5. Backend & Data Persistence Architecture

Because hackathon demos suffer when external APIs rate-limit or fail on conference Wi-Fi, **RoboVibe Studio** uses a **Local-First + Stateless URL Backend** with an optional lightweight REST endpoint for saving/sharing custom obstacle courses.

### A. Zero-Latency Client Backend (Primary — Always Works Offline)
* **URL Hash State Serialization (`src/utils/urlSerializer.ts`):**
  * Clicking **"Share Simulation"** encodes the current arm configuration (`linkLengths`, `obstacles`, `waypoints`) into a compressed Base64 URL query parameter (`?sim=eyJsaW5rcyI6...`).
  * Opening that URL immediately hydrates the exact scenario on any judge's laptop or phone with zero database queries.
* **LocalStorage Auto-Save:**
  * Automatically persists user-created obstacle layouts and custom DOF presets in `localStorage` under `robovibe_workspace_v1`.
* **Client-Side Code/JSON Generator:**
  * Generates downloadable `.json` trajectory files and simulated **G-Code (`G01 X... Y...`)** toolpaths directly via browser `Blob` URLs.

### B. Optional Lightweight Cloud API (Next.js Route Handler `/api/scenarios`)
If you want a **"Community Presets"** drawer where judges can publish and load scenarios in real time, add a single stateless API route backed by Supabase / Vercel KV (or an in-memory fallback store):

```typescript
// src/app/api/scenarios/route.ts
import { NextResponse } from 'next/server';

export interface ScenarioPayload {
  id: string;
  name: string;
  author: string;
  dof: number;
  linkLengths: number[];
  obstacles: { x: number; y: number; r: number }[];
  createdAt: string;
}

// GET /api/scenarios — Fetch top featured & user-submitted obstacle courses
// POST /api/scenarios — Validate & save a new custom obstacle course JSON
```

---

## 6. Vibe-Coding Implementation Prompt for `frontend.md`

You can feed this specification directly into your AI coding tool with the following instruction:

> "Implement the frontend and client-side state architecture described in `frontend.md`. Create `src/engine/fabrik.ts` for the multi-joint inverse kinematics solver, `src/engine/obstacleAvoidance.ts` for real-time Bezier obstacle detours, `src/components/SimulationCanvas.tsx` for the 60 FPS HTML5 Canvas renderer with draggable obstacles, and `src/components/TelemetryHUD.tsx` for the translucent glassmorphism telemetry panel and URL-hash scenario sharing."