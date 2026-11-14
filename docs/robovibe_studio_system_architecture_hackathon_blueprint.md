# RoboVibe Studio — System Architecture & Hackathon Blueprint

## 1. Executive Summary
**RoboVibe Studio** is a zero-backend, browser-based **2D Inverse Kinematics (IK) & Obstacle-Avoidance Trajectory Sandbox**. Designed specifically for rapid "vibe coding" execution, it delivers an immediately engaging, interactive engineering simulation at 60 FPS with live mathematical telemetry, real-time collision avoidance, and one-click autonomous demo presets.

### Why This Wins a Vibe-Coding Hackathon
* **5-Second Visual Hook:** Launches directly into an active autonomous simulation—no login screens, empty states, or setup forms.
* **Zero Infrastructure Fragility:** Runs 100% client-side in the browser with zero API keys, external databases, or network latency.
* **Interactive Judge Experience:** Judges can drag obstacles directly into the robotic arm's workspace during the live pitch and watch the solver dynamically recalculate joint angles and trajectories in real time.

---

## 2. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI & Control Layer                       │
│   (React / Next.js + Tailwind CSS + Pitch-Black AMOLED Theme)   │
│  ┌────────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │ Joint/Link Config  │  │ Preset Scenarios│  │ Export JSON/ │  │
│  │ (Sliders/Toggles)  │  │ (Pick & Place)  │  │ Waypoints    │  │
│  └─────────┬──────────┘  └────────┬────────┘  └──────┬───────┘  │
└────────────┼──────────────────────┼──────────────────┼──────────┘
             │                      │                  │
             ▼                      ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    State & Telemetry Store                      │
│               (Lightweight React Refs / Zustand)                │
│     • Joint Angles (θ₁..θₙ)    • End-Effector (x, y)            │
│     • Angular Velocity (ω)     • Reachability & Collision Flags │
└────────────┬─────────────────────────────────────────▲──────────┘
             │                                         │
             ▼                                         │
┌─────────────────────────────────────────────────────────────────┐
│                 Core Physics & Math Engine (TS)                 │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐  │
│  │      FABRIK IK Solver    │  │   Obstacle Avoidance &      │  │
│  │  • Constraint clamping   │  │   Trajectory Interpolator   │  │
│  │  • Multi-link iteration  │  │   (Cubic Bezier / Waypoints)│  │
│  └──────────────────────────┘  └─────────────────────────────┘  │
└────────────┬─────────────────────────────────────────▲──────────┘
             │                                         │
             ▼                                         │
┌─────────────────────────────────────────────────────────────────┐
│                 60 FPS Rendering & Chart Layer                  │
│  ┌───────────────────────────────────┐  ┌────────────────────┐  │
│  │     HTML5 Canvas Viewport         │  │  Live Telemetry    │  │
│  │ • Arm links, joints & reach halo  │  │  Sparklines        │  │
│  │ • Interactive draggable obstacles │  │  (SVG / Canvas)    │  │
│  └───────────────────────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Architecture Modules

| Module | File Path | Responsibility | Technical Details |
| :--- | :--- | :--- | :--- |
| **IK Physics Engine** | `src/engine/ikSolver.ts` | Computes joint positions $(x_i, y_i)$ from target coordinates $(x_t, y_t)$. | Implements **FABRIK** (Forward And Backward Reaching Inverse Kinematics) over 12 iterations per frame. Supports 2 to 5 configurable links and joint angle clamping. |
| **Path & Collision Engine** | `src/engine/pathPlanner.ts` | Generates smooth paths around circular workspace obstacles. | Uses circle-to-line-segment intersection checks and dynamic **Cubic Bezier** control-point offsetting to steer the end-effector safely around obstacles. |
| **60 FPS Canvas Viewport** | `src/components/Viewport.tsx` | Renders the engineering grid, robotic arm, obstacles, and motion trail. | Uses `requestAnimationFrame` with high-DPI (`devicePixelRatio`) scaling, glowing cyan end-effector trails, and reach-envelope boundary rings. |
| **Telemetry HUD** | `src/components/TelemetryPanel.tsx` | Displays real-time kinematics data and joint health. | Translucent glassmorphism overlay showing joint angles ($\theta_1, \theta_2, \theta_3$), angular velocity ($\omega$), end-effector $(x, y)$, and live SVG sparklines. |
| **Scenario Presets** | `src/engine/presets.ts` | Provides instant one-click demos for judges and users. | Includes **Autonomous Pick & Place**, **Obstacle Slalom**, and **High-Speed Welding Arc**. |

---

## 4. Mathematical Core Specification

### A. FABRIK Inverse Kinematics
Given a fixed base joint $P_0$, link lengths $L_1, L_2, \dots, L_n$, and a target coordinate $T$:
1. **Reachability Check:** Calculate total reach $R = \sum_{i=1}^{n} L_i$. If $\|T - P_0\| > R$, stretch all joints collinearly toward $T$ and trigger the `OUT OF REACH` telemetry warning.
2. **Forward Reaching Pass:** Set end-effector $P_n = T$, then iterate backward from $i = n-1$ down to $0$:
   $$P_i = P_{i+1} + L_{i+1} \frac{P_i - P_{i+1}}{\|P_i - P_{i+1}\|}$$
3. **Backward Reaching Pass:** Reset base $P_0$ to the anchor origin, then iterate forward from $i = 0$ up to $n-1$:
   $$P_{i+1} = P_i + L_{i+1} \frac{P_{i+1} - P_i}{\|P_{i+1} - P_i\|}$$
4. **Joint Angle Extraction:** Compute relative joint angles $\theta_i$ in degrees for the telemetry HUD:
   $$\theta_i = \text{atan2}(y_{i+1} - y_i, x_{i+1} - x_i) \times \frac{180}{\pi}$$

### B. Dynamic Obstacle Avoidance
When traveling between Waypoint $A$ and Waypoint $B$ in Auto-Demo mode:
* Check if segment $\overline{AB}$ intersects any obstacle circle $(C_k, r_k + \text{margin})$.
* If a collision is detected, compute a perpendicular offset vector $\vec{n}$ away from $C_k$ to place a Bezier control point $M$, generating a smooth detour curve $B(t) = (1-t)^2 A + 2(1-t)t M + t^2 B$.

---

## 5. Step-by-Step Vibe Coding Prompt Sequence

Copy and paste these prompts sequentially into your AI app builder to construct the project cleanly without breaking state:

### Prompt 1: Base Canvas & FABRIK Solver
> "Build a full-screen, single-page React + TypeScript application styled in a sleek pitch-black (`#09090b`) technical CAD aesthetic with cyan (`#06b6d4`) and amber (`#f59e0b`) accents. Render a full-viewport HTML5 Canvas with a subtle coordinate grid and a dashed maximum-reach boundary circle centered on screen. Implement a 3-link robotic arm anchored at the center that smoothly follows the user's mouse cursor at 60 FPS using the FABRIK (Forward And Backward Reaching Inverse Kinematics) algorithm. Draw precision mechanical joints, glowing end-effector trails, and real-time coordinate labels."

### Prompt 2: Interactive Obstacles & Autonomous Demo Loop
> "Add interactive circular obstacles to the canvas: users can click 'Add Obstacle' to spawn a hazard circle and drag any obstacle around the workspace in real time. Add an 'Auto-Pilot Demo' toggle (enabled by default on load) where the robotic arm autonomously moves back and forth between two target waypoints, dynamically curving its trajectory via a Bezier detour whenever an obstacle blocks the direct path between waypoints."

### Prompt 3: Live Telemetry HUD & Presets
> "Add a translucent glassmorphism HUD panel on the right side displaying real-time telemetry: joint angles ($\theta_1, \theta_2, \theta_3$) in degrees, end-effector $(X, Y)$ coordinates, live SVG sparkline graphs of joint velocity, and a status badge ('OPTIMAL', 'AVOIDING OBSTACLE', or 'OUT OF REACH'). Add sliders to adjust link lengths and joint count (2 to 5 links), plus top-bar preset buttons for 'Pick & Place', 'Obstacle Slalom', and 'Reset Workspace'."

---

## 6. 2-Minute Hackathon Pitch Script
1. **0:00–0:20 (The Hook):** Show the live app immediately in Auto-Pilot mode. *"Robotics path-planning tools are usually heavy desktop suites. We built RoboVibe Studio—a real-time inverse kinematics and obstacle-avoidance sandbox right in the browser."*
2. **0:20–1:00 (Live Interaction):** Drag an obstacle directly into the moving arm's path. *"Watch the solver detect the collision boundary and dynamically recalculate a smooth Bezier trajectory while solving multi-joint FABRIK kinematics at 60 frames per second."*
3. **1:00–1:30 (Telemetry & Customization):** Switch to a 5-DOF arm using the right-hand HUD and trigger the **Obstacle Slalom** preset while pointing out live joint angle telemetry and reach limits.
4. **1:30–2:00 (Wrap-up):** Highlight the zero-latency client-side engine, exportable waypoint JSON, and potential use cases in robotics education and rapid prototyping.