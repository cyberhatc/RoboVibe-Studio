/**
 * Zero-backend scenario sharing: serialize arm configuration + obstacles +
 * waypoints into a compressed Base64 URL query parameter (?sim=...).
 * Works offline, no database required.
 */

import type { Vec2 } from "@/engine/fabrik";
import type { Obstacle } from "@/engine/obstacleAvoidance";

export interface ShareableScenario {
  dof: number;
  linkLengths: number[];
  obstacles: Obstacle[];
  waypoints: Vec2[];
}

function toBase64Url(input: string): string {
  const b64 =
    typeof window !== "undefined"
      ? window.btoa(unescape(encodeURIComponent(input)))
      : Buffer.from(input, "utf-8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return typeof window !== "undefined"
    ? decodeURIComponent(escape(window.atob(padded)))
    : Buffer.from(padded, "base64").toString("utf-8");
}

export function encodeScenario(scenario: ShareableScenario): string {
  return toBase64Url(JSON.stringify(scenario));
}

export function decodeScenario(encoded: string): ShareableScenario | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as Partial<ShareableScenario>;
    if (
      typeof parsed.dof !== "number" ||
      !Array.isArray(parsed.linkLengths) ||
      !Array.isArray(parsed.obstacles) ||
      !Array.isArray(parsed.waypoints)
    ) {
      return null;
    }
    return {
      dof: Math.max(2, Math.min(5, Math.round(parsed.dof))),
      linkLengths: parsed.linkLengths.map((n) => Number(n) || 100),
      obstacles: parsed.obstacles
        .filter((o) => o && Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.r))
        .map((o, i) => ({ id: o.id ?? `obs-${i}`, x: Number(o.x), y: Number(o.y), r: Math.max(10, Number(o.r)) })),
      waypoints: parsed.waypoints
        .filter((w) => w && Number.isFinite(w.x) && Number.isFinite(w.y))
        .map((w) => ({ x: Number(w.x), y: Number(w.y) })),
    };
  } catch {
    return null;
  }
}

/** Read ?sim=... (supports both query-param and hash styles) from the current URL. */
export function readScenarioFromLocation(): ShareableScenario | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  let encoded = params.get("sim");
  if (!encoded && window.location.hash.includes("sim=")) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    encoded = hashParams.get("sim");
  }
  if (!encoded) return null;
  return decodeScenario(encoded);
}
