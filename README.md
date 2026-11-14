# 🦾 RoboVibe Studio

**Zero-backend, browser-based 2D Inverse Kinematics (IK) & Obstacle-Avoidance Trajectory Sandbox.**

Built for a vibe-coding hackathon: launches straight into an autonomous 60 FPS simulation — no login, no setup, no external APIs. Judges can drag obstacles into the arm's path and watch the FABRIK solver re-plan in real time.

![Stack](https://img.shields.io/badge/Next.js-15-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss&logoColor=white)

## ✨ Features

- **60 FPS `<canvas>` renderer** — coordinate grid, dashed max-reach envelope, HiDPI-aware, fading end-effector trail
- **FABRIK inverse kinematics** — 2 to 5 configurable links, 12 solver iterations per frame, joint telemetry in degrees
- **Dynamic obstacle avoidance** — circle↔segment collision tests bend the trajectory via a quadratic Bézier detour with an 18 px safety halo
- **Auto-Pilot demos** — Pick & Place, Obstacle Slalom, 5-DOF Reach Test presets; toggle OFF to steer the arm with your cursor
- **Live glassmorphism HUD** — status pill (`OPTIMAL PATH` / `REROUTING OBSTACLE` / `OUT OF REACH`), θ₁..θₙ readouts, EE (X, Y), angular-velocity sparkline
- **Zero-backend persistence** — LocalStorage auto-save + shareable `?sim=<base64>` URLs (works offline)
- **Exports** — waypoint JSON and simulated G-Code (`G01 X… Y…`) downloads
- **Optional API** — `/api/scenarios` (GET/POST) in-memory community-preset store; swap with Supabase/Vercel KV for persistence

## 🚀 Getting Started

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm start       # serve production build
```

## 🗂 Project Structure

```text
src/
├── app/
│   ├── layout.tsx               # Pitch-black shell + JetBrains Mono
│   ├── page.tsx                 # Workspace orchestrator (URL/localStorage hydration)
│   └── api/scenarios/route.ts   # Optional community preset API (in-memory)
├── components/
│   ├── SimulationCanvas.tsx     # 60 FPS canvas + FABRIK loop + pointer drag/hit-test
│   ├── TopControlBar.tsx        # Brand badge, AUTO-PILOT toggle, presets, Share, Export
│   ├── TelemetryHUD.tsx         # Status banner, θ readouts, EE coords, ω sparkline
│   ├── KinematicsControls.tsx   # DOF (2–5), link lengths, solver damping
│   └── ExportModal.tsx          # Copy/download waypoint JSON or G-Code
├── engine/
│   ├── fabrik.ts                # Pure TS FABRIK solver
│   ├── obstacleAvoidance.ts     # Circle-segment collision + Bézier detour planner
│   └── presets.ts               # Demo scenarios
├── store/useSimStore.ts         # Zustand store (UI + throttled telemetry @ 15 Hz)
└── utils/urlSerializer.ts       # ?sim=<base64url> scenario encode/decode
```

## 🧮 Math Core

- **FABRIK**: backward pass pins the end-effector to the target, forward pass re-anchors the base — iterated 12× per frame. Out-of-reach targets stretch all links collinearly and raise the `OUT OF REACH` flag.
- **Avoidance**: if segment A→B intersects an obstacle's clearance circle `(r + 18 px)`, a control point is placed on the perpendicular bisector offset to the opposite side, generating `B(t) = (1−t)²A + 2(1−t)tM + t²B`.

## 🖱 Interactions

| Action | Result |
| :--- | :--- |
| Drag a hazard circle | Repositions the obstacle; solver reroutes live |
| `AUTO-PILOT: OFF` + move cursor | Arm tracks your cursor |
| `+ OBSTACLE` / 🗑 | Spawn / clear hazards |
| `SHARE` | Copies a `?sim=` URL encoding the full scenario |
| `EXPORT` | Download waypoint JSON or G-Code toolpath |

## 📄 License

MIT — see [LICENSE](LICENSE).
