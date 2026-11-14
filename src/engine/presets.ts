/**
 * Pre-configured arm setups, obstacle layouts and waypoint programmes
 * for one-click judge/demo scenarios. Coordinates are relative to canvas center.
 */

import type { Obstacle } from "./obstacleAvoidance";
import type { Vec2 } from "./fabrik";

export interface Preset {
  id: string;
  name: string;
  dof: number;
  linkLengths: number[];
  obstacles: Omit<Obstacle, "id">[];
  waypoints: Vec2[];
}

export const PRESETS: Preset[] = [
  {
    id: "pick-and-place",
    name: "Pick & Place",
    dof: 3,
    linkLengths: [150, 125, 100],
    obstacles: [{ x: 40, y: -60, r: 34 }],
    waypoints: [
      { x: -190, y: -110 },
      { x: 200, y: -120 },
      { x: 200, y: 130 },
      { x: -190, y: 120 },
    ],
  },
  {
    id: "obstacle-slalom",
    name: "Obstacle Slalom",
    dof: 4,
    linkLengths: [140, 120, 105, 85],
    obstacles: [
      { x: -80, y: -90, r: 32 },
      { x: 60, y: 0, r: 40 },
      { x: -70, y: 100, r: 30 },
    ],
    waypoints: [
      { x: -220, y: 0 },
      { x: 0, y: -190 },
      { x: 220, y: 0 },
      { x: 0, y: 190 },
    ],
  },
  {
    id: "reach-test",
    name: "5-DOF Reach Test",
    dof: 5,
    linkLengths: [125, 105, 90, 75, 60],
    obstacles: [{ x: 0, y: 0, r: 22 }],
    waypoints: [
      { x: -240, y: -160 },
      { x: 240, y: -160 },
      { x: 240, y: 160 },
      { x: -240, y: 160 },
    ],
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
