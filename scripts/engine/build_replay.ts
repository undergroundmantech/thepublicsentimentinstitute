// Build a replay archive: run the engine over every frame of a source and store the results with the recorder.
// The same code path as live recording (recordFrame), so a replay shows exactly what the engine would have computed.
//
//   node --import ./scripts/intelligence/ts-resolve.mjs scripts/engine/build_replay.ts --fixture <dir> --kind observed|forward_hold|linear --store <dir> [--verify]
//
// <dir> is the unpacked fixture (original_observed_snapshots.jsonl.gz, replay_*_5min.jsonl.gz).
//   observed       the 14 timestamped exports: HISTORICAL (authentic, sparse)
//   forward_hold   SIMULATED: last export held on a five-minute grid
//   linear         SIMULATED: interpolated, uses later data. UI testing only.
// Simulated output goes to the store's "simulated" namespace and can go nowhere else. Keep --store OUT of public/.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { FsStore } from "../../app/lib/intelligence/captureStore";
import { preElectionFrom } from "../../app/lib/engine/national";
import { ledgerSummary } from "../../app/lib/engine/modelCalls";
import { describeSource, openArchive, recordFrame, verifyArchive } from "../../app/lib/engine/recorder";
import { evaluationBlockers, observedCheckpoints, simulatedFixture, type FixtureFrame } from "../../app/lib/engine/replay";
import { namespaceOf } from "../../app/lib/engine/gate";
import type { XIndex } from "../../app/results/2026/live";

const arg = (k: string, d?: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(import.meta.dirname, "../..");
const fixture = arg("--fixture"), kind = arg("--kind", "observed") as "observed" | "forward_hold" | "linear", storeDir = arg("--store");
if (!fixture || !storeDir) { console.error("usage: build_replay.ts --fixture <dir> --kind observed|forward_hold|linear --store <dir> [--verify]"); process.exit(2); }
if (path.resolve(storeDir).startsWith(path.join(root, "public"))) { console.error("Refusing to write a replay archive under public/: it would be served to anyone."); process.exit(2); }
const file = { observed: "original_observed_snapshots.jsonl.gz", forward_hold: "replay_forward_hold_5min.jsonl.gz", linear: "replay_linear_simulated_5min.jsonl.gz" }[kind];
const frames = zlib.gunzipSync(fs.readFileSync(path.join(fixture, file))).toString("utf8").trim().split("\n").map((l) => JSON.parse(l) as FixtureFrame);
const src = kind === "observed" ? observedCheckpoints(frames) : simulatedFixture(frames, kind);
const index = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8")) as XIndex;
const pre = preElectionFrom(JSON.parse(fs.readFileSync(path.join(root, "public/forecast/archive/final-2026-11-03/model.json"), "utf8")));
const store = new FsStore(path.resolve(storeDir), { durable: true });
const ns = namespaceOf(src.mode);
console.log(`${src.label}\nmode ${src.mode} -> archive ${ns}/${src.id}, ${src.frames.length} frames`);
const blockers = evaluationBlockers(src); if (blockers.length) console.log(`NOT usable to score or calibrate the model: ${blockers.join("; ")}`);
await describeSource(store, ns, src.id, { label: src.label, election: src.election, notes: src.notes });
const t0 = Date.now(); let rec = 0, same = 0;
for (const f of src.frames) {
  const r = await recordFrame(store, src.id, { index, pre, snapshot: f.snapshot, t: f.t });
  if (r.status === "RECORDED") { rec++; const s = ledgerSummary(r.state.ledger), n = r.state.national; console.log(`${f.t}  House D ${n.house.seats.D.mean.toFixed(1)}  Senate D ${n.senate.seats.D.mean.toFixed(1)}  first-qualified ${s.firstQualified}  model calls ${s.modelCalled}  alerts ${s.alerts}`); } else same++;
}
console.log(`recorded ${rec} new states, ${same} unchanged or already present, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (process.argv.includes("--verify")) {
  const a = await openArchive(store, ns, src.id); const v = await verifyArchive(store, a, { index, pre });
  console.log(`verify: ${v.ok} of ${v.frames} frames recompute to the stored state; chain problems ${a.problems.length}; ${v.problems.length ? v.problems.slice(0, 5).join(" | ") : "no problems"}`);
  if (v.problems.length || a.problems.length) process.exit(1);
}
