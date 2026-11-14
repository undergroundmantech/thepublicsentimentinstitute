// The engine's recorder, as a scheduled job: read civicAPI once, evaluate, and store the raw response, the canonical
// snapshot, the computed state and the published view (app/lib/engine/recorder.ts). It publishes nothing.
//   GET  authenticated with CRON_SECRET (Vercel Cron sends it as a bearer token), as the existing capture route is
// OFF unless ONPOINT_ENGINE_RECORDER=on, and it refuses to run without a DURABLE store (INTELLIGENCE_CAPTURE_STORE).
// A 200 from this route is not proof of recording: the response reports what was written and the recorder's health.
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { resolveStore } from "@/app/lib/intelligence/captureStore";
import { fetchCivicRaces } from "@/app/lib/engine/civicFetch";
import { engineRecorderEnabled } from "@/app/lib/engine/gate";
import { preElectionFrom } from "@/app/lib/engine/national";
import { recordFrame, recorderHealth } from "@/app/lib/engine/recorder";
import { snapshotFromCivic } from "@/app/lib/engine/snapshot";
import { FIRST_CLOSE, type XIndex } from "@/app/results/2026/live";
import { LIVE_POLL_MS } from "@/app/results/2026/liveFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), f), "utf8"));

export async function GET(req: Request) {
  if (!engineRecorderEnabled()) return NextResponse.json({ error: "The engine recorder is switched off (ONPOINT_ENGINE_RECORDER)." }, { status: 404 });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { store, problem } = resolveStore();
  if (!store) return NextResponse.json({ error: problem }, { status: 503 });
  if (!store.durable) return NextResponse.json({ error: `The ${store.kind} store is not durable here; nothing was recorded.` }, { status: 503 });
  const t = new Date().toISOString();
  const { raws, failed, bodies } = await fetchCivicRaces();
  if (!raws.length) return NextResponse.json({ error: "civicAPI unreachable", failed }, { status: 502 });
  const index = read("public/results/2026/index.json") as XIndex;
  const snapshot = snapshotFromCivic(index, raws, { receivedAt: t, mode: "LIVE", source: "civicAPI race search", blankTest: Date.now() < FIRST_CLOSE });
  try {
    const res = await recordFrame(store, "civicapi", { index, pre: preElectionFrom(read("public/forecast/archive/final-2026-11-03/model.json")), snapshot, t, raw: gzipSync(Buffer.from(JSON.stringify(bodies))), failures: failed, stale: failed.length > 0 });
    const health = await recorderHealth(store, "live", "civicapi", { fromMs: Date.now() - 6 * 3_600_000, toMs: Date.now(), everyMs: LIVE_POLL_MS });
    return NextResponse.json({ status: res.status, t, snapshotId: snapshot.snapshotId, stateId: res.state.stateId, manifest: res.manifestKey, failed, health });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, failed }, { status: 500 });
  }
}
