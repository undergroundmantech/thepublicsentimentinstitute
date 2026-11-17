// The engine's forecast for election night, computed on the server from one canonical snapshot of civicAPI, so
// every page reads the same numbers. OFF unless ONPOINT_ENGINE_API=on: switching it on is an operator decision.
//   GET /api/results/forecast            national: Senate, House, governors, House popular vote, race summaries
//   GET /api/results/forecast?race=ID    one race in full, with county detail when civicAPI has it
// Only LIVE civicAPI data is accepted here. There is no input path for simulated data.
// Reads use exactly the URLs and cache lifetimes of the /api/civic proxies, so civicAPI sees no extra requests.
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { FIRST_CLOSE, type StFile, type XIndex } from "@/app/results/2026/live";
import { fetchCivicRaces, REVAL } from "@/app/lib/engine/civicFetch";
import { MODEL_VERSION } from "@/app/lib/engine/config";
import { engineApiEnabled } from "@/app/lib/engine/gate";
import { nationalForecast, preElectionFrom } from "@/app/lib/engine/national";
import { forecastRace } from "@/app/lib/engine/raceModel";
import { blankTestCounts, observe, snapshotFromCivic, type CivicRawRace } from "@/app/lib/engine/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";   // never prerendered: the switch and the query decide each response
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), f), "utf8"));
const memo = new Map<string, unknown>();

export async function GET(req: Request) {
  if (!engineApiEnabled()) return NextResponse.json({ error: "The engine API is switched off (ONPOINT_ENGINE_API)." }, { status: 404 });
  const raceId = new URL(req.url).searchParams.get("race");
  const index = read("public/results/2026/index.json") as XIndex;
  const receivedAt = new Date().toISOString(); const blankTest = Date.now() < FIRST_CLOSE;
  const { raws, failed } = await fetchCivicRaces(["fed"]);   // one type at a time (this goes to civicAPI itself)
  if (!raws.length) return NextResponse.json({ error: "civicAPI unreachable", failed }, { status: 502 });
  const snap = snapshotFromCivic(index, raws, { receivedAt, mode: "LIVE", source: "civicAPI race search", blankTest });
  const head = { "cache-control": `public, max-age=60, s-maxage=${REVAL}, stale-while-revalidate=600` };

  if (raceId) {
    const r = index.races.find((x) => x.id === raceId); if (!r) return NextResponse.json({ error: "unknown race" }, { status: 404 });
    const base = snap.races[raceId];
    let obs = base ?? null;
    if (base?.providerRaceId != null) {
      try {
        const d = await fetch(`https://civicapi.org/api/v2/race/${base.providerRaceId}`, { next: { revalidate: REVAL }, headers: { accept: "application/json" } });
        if (d.ok) { obs = observe(raceId, (await d.json()) as CivicRawRace, receivedAt, true); if (blankTest && obs.test) obs = blankTestCounts(obs); }
      } catch { /* the topline from the search stands */ }
    }
    let sf: StFile | null = null; try { sf = read(`public/results/2026/st/${r.st}.json`) as StFile; } catch { sf = null; }
    const key = `${MODEL_VERSION}|${snap.snapshotId}|${raceId}|${obs ? JSON.stringify(obs.units?.length ?? 0) : "-"}`;
    const f = (memo.get(key) as object | undefined) ?? forecastRace(r, obs, sf?.counties?.[raceId] ?? null, { seed: snap.snapshotId, computedAt: receivedAt, snapshotId: snap.snapshotId });
    memo.set(key, f);
    return NextResponse.json({ provenance: snap.provenance, snapshotId: snap.snapshotId, failed, forecast: f }, { headers: head });
  }

  const key = `${MODEL_VERSION}|${snap.snapshotId}`;
  let body = memo.get(key) as object | undefined;
  if (!body) {
    const pre = preElectionFrom(read("public/forecast/archive/final-2026-11-03/model.json"));
    const { national, races } = nationalForecast({ index, snapshot: snap, pre, seed: snap.snapshotId, computedAt: receivedAt });
    const summary = Object.fromEntries(Object.entries(races).map(([id, f]) => [id, { leaderId: f.display.leaderId, probability: f.display.probability, capped: f.display.capped, principalMargin: f.principalMargin?.projected.mean ?? null, i80: f.principalMargin?.projected.i80 ?? null, dataState: f.dataState, call: f.call, settled: f.settled }]));
    body = { provenance: snap.provenance, snapshotId: snap.snapshotId, unmatchedProviderRaces: snap.unmatchedProviderRaces, failed, national, races: summary };
    if (memo.size > 8) memo.delete(memo.keys().next().value as string);
    memo.set(key, body);
  }
  return NextResponse.json(body, { headers: head });
}
