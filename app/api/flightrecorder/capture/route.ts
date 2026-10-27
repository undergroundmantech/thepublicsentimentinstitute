// Flight data recorder capture endpoint (CHANGE-ORDER-04 §6). Meant to be
// hit on a 1-minute schedule by whatever scheduler the deployment provides
// (e.g. a Vercel Cron entry in vercel.json, or an external cron hitting this
// URL) — it is intentionally decoupled from any race page being open, since
// the recorder must build continuous history regardless of visitor traffic.
//
// Silent by design: writes only, no race-facing UI reads this route or its
// output in August. Scope guard: only tiers 3+ from getRecorderRaceIds()
// (never the local board, per §6).
import { NextResponse } from "next/server";
import { getRaceCapabilities, getRecorderRaceIds } from "@/app/results/_data/raceCapabilities";
import { buildSnapshot, appendSnapshotIfNew } from "@/app/results/_lib/flightRecorder";
import { legacyCaptureGate } from "@/app/results/_lib/legacyCaptureGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CIVIC_BASE = "https://civicapi.org";

export async function GET(req: Request) {
  const gate = legacyCaptureGate(process.env, req.headers.get("authorization"));
  if (gate) return NextResponse.json(gate.body, { status: gate.status, headers: { "cache-control": "no-store" } });

  const raceIds = getRecorderRaceIds();
  const results = await Promise.allSettled(
    raceIds.map(async (raceId) => {
      const res = await fetch(`${CIVIC_BASE}/api/v2/race/${raceId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`civicapi ${res.status} for race ${raceId}`);
      const race = await res.json();
      const caps = getRaceCapabilities(raceId);
      const snapshot = buildSnapshot(race, caps.raceRule);
      const wrote = await appendSnapshotIfNew(raceId, snapshot);
      return { raceId, wrote };
    }),
  );

  const summary = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { raceId: raceIds[i], error: String(r.reason) },
  );
  return NextResponse.json({ capturedAt: new Date().toISOString(), summary });
}
