// Build the recorded replay of election night from civicAPI's per-race history export.
//
//   1. python3 scripts/engine/extract_civic_history.py <CivicAPI_..._History.zip> <history dir>     (once per zip)
//   2. node --import ./scripts/intelligence/ts-resolve.mjs scripts/engine/build_civic_replay.ts --history <history dir> --store <dir> [--verify]
//      (about an hour; --verify recomputes every frame and takes as long again; --verify-only checks a finished archive)
//   3. node --import ./scripts/intelligence/ts-resolve.mjs scripts/engine/export_static_replay.ts --history <history dir> --store <dir> --out public/replay/2026
//
// Every frame is a genuine observation: at frame time T each race holds the latest snapshot civicAPI had stored at or
// before T, unchanged. Nothing is interpolated and nothing after T is read (app/lib/engine/civicHistory.ts). The
// archive is HISTORICAL and is written through the same recorder as a live night, so the model-call ledger is the one
// the live site would have kept. --store is the working archive (keep it out of public/); step 3 writes the public pack.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { FsStore } from "../../app/lib/intelligence/captureStore";
import { frameTimes, prepare, rawAt, type CompactRace, type FramePlan } from "../../app/lib/engine/civicHistory";
import { countyContext } from "../../app/lib/engine/countyBaselines";
import { preElectionFrom } from "../../app/lib/engine/national";
import { ledgerSummary } from "../../app/lib/engine/modelCalls";
import { describeSource, openArchive, recordFrame, verifyArchive } from "../../app/lib/engine/recorder";
import { snapshotFromCivic, type CivicRawRace } from "../../app/lib/engine/snapshot";
import type { XIndex } from "../../app/results/2026/live";

const arg = (k: string, d?: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(import.meta.dirname, "../..");
const histDir = arg("--history"), storeDir = arg("--store"), limit = Number(arg("--limit", "0"));
if (!histDir || !storeDir) { console.error("usage: build_civic_replay.ts --history <dir> --store <dir> [--night-every 120] [--verify | --verify-only] [--limit n] [--until <ISO>] [--after <ISO>]"); process.exit(2); }
if (path.resolve(storeDir).startsWith(path.join(root, "public"))) { console.error("Keep the working archive out of public/. export_static_replay.ts writes the public pack."); process.exit(2); }
export const CIVIC_REPLAY_ID = "civicapi-2026-11-03";
const d = (s: string) => Date.parse(s), nightEvery = Number(arg("--night-every", "120")) * 1000;
// election night at a fine cadence, the next day at ten minutes, the long count hourly; a tick with nothing new is skipped
export const PLAN: FramePlan = [
  { fromMs: d("2026-11-03T22:58:00Z"), toMs: d("2026-11-04T10:00:00Z"), everyMs: nightEvery },
  { fromMs: d("2026-11-04T10:00:00Z"), toMs: d("2026-11-05T06:00:00Z"), everyMs: 600_000 },
  // --until extends the hourly stretch for a history that has later snapshots added (scripts/engine/append_civic_live.py)
  { fromMs: d("2026-11-05T06:00:00Z"), toMs: d(arg("--until", "2026-11-12T02:00:00Z")!), everyMs: 3_600_000 },
];
const hs = prepare(fs.readdirSync(histDir).filter((f) => f.endsWith(".json.gz")).map((f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(histDir, f))).toString("utf8")) as CompactRace));
const index = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8")) as XIndex;
const pre = preElectionFrom(JSON.parse(fs.readFileSync(path.join(root, "public/forecast/archive/final-2026-11-03/model.json"), "utf8")));
// county forecasts for the Senate and governor's races: those races are modeled county by county (app/lib/engine/countyBaselines.ts)
const county = countyContext(JSON.parse(fs.readFileSync(path.join(root, "public/forecast/counties.json"), "utf8")), index);
let times = frameTimes(hs, PLAN); if (limit) times = times.slice(0, limit);
// --after <ISO time>: continue a finished archive, recording only the frames later than its last one
const after = arg("--after"); if (after) times = times.filter((t) => t > d(after));
const store = new FsStore(path.resolve(storeDir), { durable: true });
const nSnaps = hs.reduce((n, h) => n + h.timesMs.length, 0);
console.log(`civicAPI history: ${hs.length} races, ${nSnaps} stored snapshots -> ${times.length} frames, ${new Date(times[0]).toISOString()} to ${new Date(times[times.length - 1]).toISOString()}`);
await describeSource(store, "historical", CIVIC_REPLAY_ID, { label: "November 3, 2026: election night as civicAPI recorded it", election: "2026-11-03",
  notes: [`Recorded replay of civicAPI's stored snapshots (${nSnaps.toLocaleString("en-US")} across ${hs.length} races), shown as published at each moment: every 2 minutes on election night, every 10 minutes the next day, hourly through ${new Date(times[times.length - 1]).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/New_York" })}. Unofficial; not certified results. Used with civicAPI's permission.`] });
const t0 = Date.now(); let rec = 0, same = 0;
// --verify-only: check an archive that is already built, without recording anything
const verifyOnly = process.argv.includes("--verify-only");
for (const tMs of verifyOnly ? [] : times) {
  const t = new Date(tMs).toISOString();
  // county rows ride along for the data checks (a total row among the counties, a total far above them) and, for the
  // Senate and governor's races that have a county forecast, as the model's units, each with the time it last changed
  const raws = hs.map((h) => rawAt(h, tMs, true)).filter((x): x is NonNullable<typeof x> => !!x) as CivicRawRace[];
  const snapshot = snapshotFromCivic(index, raws, { receivedAt: t, mode: "HISTORICAL", source: "civicAPI race history export", county });
  const r = await recordFrame(store, CIVIC_REPLAY_ID, { index, pre, snapshot, t, baselines: county.baselines });
  if (r.status === "RECORDED") { rec++; const s = ledgerSummary(r.state.ledger), n = r.state.national; if (rec % 10 === 1 || limit) console.log(`${t}  observed ${r.state.racesObserved}  House D ${n.house.seats.D.mean.toFixed(1)}  Senate D ${n.senate.seats.D.mean.toFixed(1)}  official ${s.official}  model calls ${s.modelCalled}  alerts ${s.alerts}  [${((Date.now() - t0) / 1000).toFixed(0)} s]`); } else same++;
}
console.log(`recorded ${rec} new states, ${same} unchanged or already present, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (verifyOnly || process.argv.includes("--verify")) {
  const a = await openArchive(store, "historical", CIVIC_REPLAY_ID); const v = await verifyArchive(store, a, { index, pre, baselines: county.baselines });
  console.log(`verify: ${v.ok} of ${v.frames} frames recompute to the stored state; chain problems ${a.problems.length}; ${v.problems.length ? v.problems.slice(0, 5).join(" | ") : "no problems"}`);
  if (v.problems.length || a.problems.length) process.exit(1);
}
