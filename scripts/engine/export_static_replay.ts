// Write the public replay pack from a recorded archive: static, compressed files the pages read directly, so the
// replay needs no database, no server store and no environment switch.
//
//   node --import ./scripts/intelligence/ts-resolve.mjs scripts/engine/export_static_replay.ts --history <history dir> --store <dir> --out public/replay/2026
//
//   index.json                         the source: label, notes, frame times, windows (plain JSON, small)
//   <id>/f/<n>.json.gz                 the engine state the pages show at frame n: whole every KEY_EVERY frames, and
//                                      between them only what changed since the frame before (frameDelta.ts)
//   <id>/national.json.gz              the national chart history
//   <id>/race/<raceId>.json.gz         one race's chart history
//   <id>/county/<providerId>.json.gz   one race's county returns through the night (civicAPI's own rows)
//   <id>/moments.json.gz               key moments, for the markers and the jump list
//
// Only HISTORICAL archives are exported: a recorded night, shown as recorded. Simulated or interpolated data is refused.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { FsStore } from "../../app/lib/intelligence/captureStore";
import { prepare, rowsAt, type CompactRace } from "../../app/lib/engine/civicHistory";
import { applyDelta, makeDelta } from "../../app/lib/engine/frameDelta";
import { canonicalJson } from "../../app/lib/engine/rng";
import type { View } from "../../app/lib/engine/serve";
import { momentsBetween, pollCloseMoments, type Moment, type RaceMeta } from "../../app/lib/engine/moments";
import type { StoredState } from "../../app/lib/engine/pipeline";
import { openArchive, racePoint, readState, sourceMeta, type RacePoint } from "../../app/lib/engine/recorder";
import { viewOf } from "../../app/lib/engine/serve";
import type { XIndex } from "../../app/results/2026/live";

const arg = (k: string, d?: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(import.meta.dirname, "../..");
const histDir = arg("--history"), storeDir = arg("--store"), outDir = arg("--out"), id = arg("--source", "civicapi-2026-11-03") as string;
if (!histDir || !storeDir || !outDir) { console.error("usage: export_static_replay.ts --history <dir> --store <dir> --out <dir> [--source id]"); process.exit(2); }
// the public copy carries display precision (the working archive keeps every digit): whole numbers above 100, two
// decimals above 1, four below, which is finer than anything a page prints
const trim = (_k: string, x: unknown) => (typeof x === "number" && !Number.isInteger(x) ? (Math.abs(x) >= 100 ? Math.round(x) : Math.abs(x) >= 1 ? Math.round(x * 100) / 100 : Math.round(x * 1e4) / 1e4) : x);
const gz = (v: unknown) => zlib.gzipSync(Buffer.from(JSON.stringify(v, trim)), { level: 9 });
const KEY_EVERY = 10;
/** the state as the pack carries it: display precision, and without the two ledger fields no page reads (they change on every frame) */
const packed = (s: StoredState, source: string): View => { const v = JSON.parse(JSON.stringify(viewOf(s, source, false), trim)) as View; for (const r of Object.values(v.ledger.races)) { r.lastSnapshotId = null; r.updatedAt = null; } return v; };
const put = (rel: string, body: Buffer | string) => { const f = path.join(outDir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); return typeof body === "string" ? Buffer.byteLength(body) : body.length; };

const store = new FsStore(path.resolve(storeDir), { durable: true });
const a = await openArchive(store, "historical", id);
if (!a.manifests.length) { console.error(`no historical archive "${id}" in ${storeDir}`); process.exit(1); }
if (a.problems.length) { console.error(`archive problems: ${a.problems.slice(0, 3).join(" | ")}`); process.exit(1); }
if (a.manifests.some((m) => m.mode !== "HISTORICAL" || m.synthetic || m.usesFutureObservation)) { console.error("Refusing to export: the archive holds frames that are not genuine recorded observations."); process.exit(1); }
const index = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8")) as XIndex;
const meta = new Map<string, RaceMeta>(index.races.map((r) => { const p = r.k === "measure" ? r.pPass ?? null : r.pR ?? null; return [r.id, { id: r.id, nm: r.nm, k: r.k, st: r.st, fav: p == null ? null : Math.max(p, 1 - p) }]; }));
const hs = prepare(fs.readdirSync(histDir).filter((f) => f.endsWith(".json.gz")).map((f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(histDir, f))).toString("utf8")) as CompactRace));
const src = `historical/${id}`, base = id, times = a.manifests.map((m) => m.t);
let bytes = 0, prev: StoredState | null = null, prevView: View | null = null, keyBytes = 0, deltaBytes = 0; const moments: Moment[] = []; const byRace = new Map<string, RacePoint[]>(); const pids = new Set<number>();
const same = (x: RacePoint, y: RacePoint) => JSON.stringify({ ...x, t: "" }) === JSON.stringify({ ...y, t: "" });
for (let i = 0; i < a.manifests.length; i++) {
  const s = await readState(store, a.manifests[i]);
  const view = packed(s, src);
  if (i % KEY_EVERY === 0 || !prevView) keyBytes += put(`${base}/f/${i}.json.gz`, gz(view));
  else {
    const d = makeDelta(prevView, view);
    // exact or not at all: the frame rebuilt from its delta must equal the frame
    if (canonicalJson(applyDelta(prevView, JSON.parse(JSON.stringify(d)))) !== canonicalJson(view)) { console.error(`frame ${i}: the delta does not rebuild the frame`); process.exit(1); }
    deltaBytes += put(`${base}/f/${i}.json.gz`, gz(d));
  }
  prevView = view;
  moments.push(...momentsBetween(prev, s, meta));
  for (const rid of Object.keys(s.races)) { const p = racePoint(s, rid); if (p) { const arr = byRace.get(rid) ?? []; arr.push(p); byRace.set(rid, arr); } const pid = s.races[rid].pid; if (typeof pid === "number") pids.add(pid); }
  prev = s; if (i % 50 === 0) console.log(`frame ${i} of ${a.manifests.length}  ${s.t}`);
}
bytes += put(`${base}/national.json.gz`, gz(a.manifests.map((m) => m.np)));
// a race's history keeps both ends of every flat stretch, so a held value still draws as a flat line
let pts = 0;
for (const [rid, arr] of byRace) { const keep = arr.filter((p, i) => i === 0 || i === arr.length - 1 || !same(p, arr[i - 1]) || !same(p, arr[i + 1])); pts += keep.length; bytes += put(`${base}/race/${encodeURIComponent(rid)}.json.gz`, gz(keep)); }
// county returns: civicAPI's rows for every race the pages can show, from the first night frame on
const t0 = Date.parse(times[0]);
for (const h of hs) if (pids.has(h.race.id)) {
  const keepFrom = Math.max(0, h.race.snaps.findIndex((s) => Date.parse(s.t) >= t0) - 1);
  // fold everything before the window into its first kept snapshot, so county rows are complete from the start
  const first = { ...h.race.snaps[keepFrom], x: [], r: Object.fromEntries(rowsAt(h.race, keepFrom)) as CompactRace["snaps"][number]["r"] };
  bytes += put(`${base}/county/${h.race.id}.json.gz`, gz({ ...h.race, snaps: [first, ...h.race.snaps.slice(keepFrom + 1)] }));
}
moments.push(...pollCloseMoments(hs.filter((h) => pids.has(h.race.id)).map((h) => ({ st: h.race.state, close: h.race.final?.pc ?? "" })), times));
moments.sort((x, y) => x.t.localeCompare(y.t) || y.imp - x.imp);
bytes += put(`${base}/moments.json.gz`, gz(moments));
const m = await sourceMeta(store, "historical", id); const gaps: { from: string; to: string; minutes: number }[] = [];
for (let i = 1; i < times.length; i++) { const min = (a.timesMs[i] - a.timesMs[i - 1]) / 60_000; if (min > 90) gaps.push({ from: times[i - 1], to: times[i], minutes: Math.round(min) }); }
const info = { id: src, ns: "historical", mode: "HISTORICAL", label: m?.label ?? id, election: m?.election ?? "2026-11-03", notes: m?.notes ?? [], times, gaps, base: `/replay/2026/${base}`, frames: times.length, keyEvery: KEY_EVERY,
  modelVersion: a.manifests[a.manifests.length - 1].modelVersion,
  windows: [{ id: "night", label: "Election night", from: "2026-11-03T22:55:00.000Z", to: "2026-11-04T12:00:00.000Z" }, { id: "full", label: "The whole count", from: "2026-11-03T22:55:00.000Z", to: times[times.length - 1] }] };
put("index.json", JSON.stringify({ v: 1, sources: [info] }));
const kinds: Record<string, number> = {}; for (const x of moments) kinds[x.kind] = (kinds[x.kind] ?? 0) + 1;
bytes += keyBytes + deltaBytes; console.log(`frames: ${(keyBytes / 1e6).toFixed(1)} MB whole, ${(deltaBytes / 1e6).toFixed(1)} MB deltas`);
console.log(`exported ${times.length} frames, ${byRace.size} race histories (${pts} points), ${pids.size} county files, ${moments.length} moments (${moments.filter((x) => x.imp === 3).length} headline) -> ${(bytes / 1e6).toFixed(1)} MB in ${outDir}`);
console.log(JSON.stringify(kinds));
