// Read endpoint for a single race's flight-recorder history (CHANGE-ORDER-04
// §6/§4c). Serves Zone 6 Live Timeline once TIMELINE_PUBLIC_FLAG flips true
// for the Nov 3 general — while the flag is off, RaceDesk never calls this
// (see caps.telemetry gating in RaceDesk.tsx), so this route is inert in
// practice during August even though it exists.
import { NextResponse } from "next/server";
import { resolveStore } from "@/app/lib/intelligence/captureStore";
import { readSnapshots } from "@/app/results/_lib/flightRecorder";
import { timelineFor } from "@/app/results/_lib/publicTimeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ raceId: string }> }) {
  const { raceId: raceIdStr } = await params;
  const raceId = Number(raceIdStr);
  if (!Number.isFinite(raceId)) {
    return NextResponse.json({ error: "invalid race id" }, { status: 400 });
  }
  const { snapshots } = await timelineFor(raceId, { env: process.env, legacy: readSnapshots, store: () => resolveStore(process.env).store });
  return NextResponse.json(snapshots, { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" } });
}
