/**
 * Optional "Community Presets" API.
 * In-memory fallback store (per server instance) — swap for Supabase /
 * Vercel KV in production by replacing the `store` array below.
 */

import { NextResponse } from "next/server";

export interface ScenarioPayload {
  id: string;
  name: string;
  author: string;
  dof: number;
  linkLengths: number[];
  obstacles: { x: number; y: number; r: number }[];
  createdAt: string;
}

const store: ScenarioPayload[] = [
  {
    id: "featured-slalom",
    name: "Obstacle Slalom (Featured)",
    author: "RoboVibe Team",
    dof: 4,
    linkLengths: [140, 120, 105, 85],
    obstacles: [
      { x: -80, y: -90, r: 32 },
      { x: 60, y: 0, r: 40 },
      { x: -70, y: 100, r: 30 },
    ],
    createdAt: new Date("2026-01-15T00:00:00.000Z").toISOString(),
  },
  {
    id: "featured-pickplace",
    name: "Pick & Place Yard (Featured)",
    author: "RoboVibe Team",
    dof: 3,
    linkLengths: [150, 125, 100],
    obstacles: [{ x: 40, y: -60, r: 34 }],
    createdAt: new Date("2026-01-15T00:00:00.000Z").toISOString(),
  },
];

export async function GET() {
  return NextResponse.json({ scenarios: store.slice(0, 50) });
}

export async function POST(request: Request) {
  let body: Partial<ScenarioPayload>;
  try {
    body = (await request.json()) as Partial<ScenarioPayload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const author = typeof body.author === "string" ? body.author.trim().slice(0, 40) : "Anonymous";
  const dof = Number(body.dof);
  const linkLengths = Array.isArray(body.linkLengths) ? body.linkLengths.map(Number) : [];
  const obstacles = Array.isArray(body.obstacles)
    ? body.obstacles
        .filter(
          (o) =>
            o && Number.isFinite(Number(o.x)) && Number.isFinite(Number(o.y)) && Number.isFinite(Number(o.r))
        )
        .slice(0, 24)
        .map((o) => ({
          x: Number(o.x),
          y: Number(o.y),
          r: Math.max(10, Math.min(120, Number(o.r))),
        }))
    : [];

  if (!name) {
    return NextResponse.json({ error: "`name` is required" }, { status: 422 });
  }
  if (!Number.isFinite(dof) || dof < 2 || dof > 5) {
    return NextResponse.json({ error: "`dof` must be between 2 and 5" }, { status: 422 });
  }
  if (linkLengths.length !== Math.round(dof) || linkLengths.some((n) => !Number.isFinite(n) || n < 20 || n > 400)) {
    return NextResponse.json(
      { error: "`linkLengths` must have exactly `dof` entries, each 20–400" },
      { status: 422 }
    );
  }

  const scenario: ScenarioPayload = {
    id: `scn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    author: author || "Anonymous",
    dof: Math.round(dof),
    linkLengths,
    obstacles,
    createdAt: new Date().toISOString(),
  };
  store.unshift(scenario);
  return NextResponse.json({ scenario }, { status: 201 });
}
