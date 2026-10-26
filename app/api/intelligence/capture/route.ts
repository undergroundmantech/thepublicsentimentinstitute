// Evidence capture for the intelligence layer. Records what civicAPI returned and when, for post-election replay.
// It publishes nothing and feeds no public number. It is NOT scheduled: add a cron entry only after approval.
//
// Fails closed: without CRON_SECRET configured the route refuses to run, so a write endpoint is never open.
// Races are named by INTELLIGENCE_CAPTURE_RACES (comma-separated forecast race ids). With none named it does nothing.
// The ledger lives in INTELLIGENCE_CAPTURE_DIR (default data/intelligence-capture); on a serverless filesystem that is
// not durable, so point it at a persistent volume before relying on it.
import { NextResponse } from "next/server";
import { captureDir, CaptureError, recordCapture, type CapturedObservation } from "@/app/lib/intelligence/capture";
import { fromCivicDetail } from "@/app/lib/intelligence/observations";
import { fetchCivicDetail, readIndex } from "@/app/portal/intelligence/inputs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RACE_ID = /^[A-Za-z0-9-]{1,40}$/;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured; capture is disabled" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ids = (process.env.INTELLIGENCE_CAPTURE_RACES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({ observedAt: new Date().toISOString(), note: "INTELLIGENCE_CAPTURE_RACES names no races; nothing captured", summary: [] });
  const index = await readIndex();
  if (!index) return NextResponse.json({ error: "expected-results index unavailable" }, { status: 502 });

  const dir = captureDir();
  const observedAt = new Date().toISOString();
  const summary: Record<string, unknown>[] = [];
  for (const id of ids) {
    if (!RACE_ID.test(id)) { summary.push({ raceId: id, error: "invalid race id" }); continue; }
    const race = index.races.find((r) => r.id === id);
    if (!race) { summary.push({ raceId: id, error: "not in the expected-results index" }); continue; }
    const got = await fetchCivicDetail(race);
    if (!got.detail) { summary.push({ raceId: id, error: got.error ?? "no data" }); continue; }
    try {
      const batch = fromCivicDetail(race, got.detail, observedAt, got.url);
      const observations: CapturedObservation[] = batch.map(({ observation }) => {
        const { retrievedAt: _omit, ...rest } = observation;
        void _omit;
        return rest;
      });
      const r = await recordCapture(dir, {
        raceId: id, state: race.st, source: { name: "civicAPI", url: got.url }, sourceTimestamp: batch[0]?.observation.sourceTimestamp ?? null,
        observedAt, observations, raw: got.raw ?? got.detail, payloadForm: got.raw ? "CIVICAPI_RACE_JSON" : "TRIMMED_CIVICAPI_DETAIL",
      });
      summary.push({ raceId: id, ...r });
    } catch (e) {
      summary.push({ raceId: id, error: e instanceof CaptureError ? `${e.code}: ${e.message}` : "capture failed" });
    }
  }
  return NextResponse.json({ observedAt, summary });
}
