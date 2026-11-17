// Phase 5: score the engine from a recorded archive.
//
//   node --import ./scripts/intelligence/ts-resolve.mjs scripts/engine/evaluate.ts --store <dir> --source <ns/id> \
//        (--outcomes certified.json | --pipeline-test) [--out <dir>] [--threshold 0.993]
//
// certified.json: { "<raceId>": { "winnerName": "...", "marginPp": 2.3, "source": "State canvass, Dec 1" }, ... }
// (or "winnerId"). With --pipeline-test the outcomes are the source's last frame, every output says
// PIPELINE TEST - NOT CALIBRATION, and the gate is not applicable. Without it, a simulated or interpolated source is
// refused, and so is anything but certified outcomes.
import fs from "node:fs";
import path from "node:path";
import { FsStore } from "../../app/lib/intelligence/captureStore";
import { evaluateArchive, outcomesFromFinalState, type Frame, type Outcomes, type Report } from "../../app/lib/engine/evaluate";
import { nameKey } from "../../app/results/2026/candidates";
import { openArchive, readState, snapshotOf, sourceMeta, type Namespace } from "../../app/lib/engine/recorder";

const arg = (k: string, d?: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const storeDir = arg("--store"), source = arg("--source"), outDir = arg("--out", "eval-out"), pipelineTest = process.argv.includes("--pipeline-test");
if (!storeDir || !source || (!pipelineTest && !arg("--outcomes"))) { console.error("usage: evaluate.ts --store <dir> --source <ns/id> (--outcomes <file> | --pipeline-test) [--out <dir>]"); process.exit(2); }
const [ns, id] = source.split("/") as [Namespace, string];
const store = new FsStore(path.resolve(storeDir), { durable: true });
const a = await openArchive(store, ns, id);
if (!a.manifests.length) { console.error(`no frames in ${source}`); process.exit(2); }
if (a.problems.length) { console.error(`archive problems: ${a.problems.join("; ")}`); process.exit(1); }
const meta = await sourceMeta(store, ns, id);
const frames: Frame[] = [];
// a long archive (a full night at two minutes) does not fit in memory whole: only the last frame's ledger is read
// by the scoring, so every earlier frame drops its own, and county rows are not scored at all
for (let i = 0; i < a.manifests.length; i++) {
  const state = await readState(store, a.manifests[i]), snapshot = await snapshotOf(store, a.manifests[i]);
  if (i < a.manifests.length - 1) (state as { ledger: unknown }).ledger = { mode: state.mode, config: state.ledger.config, asOf: null, snapshotId: null, races: {}, events: [] };
  for (const o of Object.values(snapshot.races)) o.units = null;
  frames.push({ state, snapshot });
}
// what disqualifies the source from scoring, from its own provenance
const blockers: string[] = [];
if (ns === "simulated" || frames.some((f) => f.state.mode === "SIMULATED")) blockers.push("the source is SIMULATED");
if (a.manifests.some((m) => m.usesFutureObservation)) blockers.push("it contains values built from later observations (interpolation)");
if (a.manifests.some((m) => m.synthetic)) blockers.push("it contains synthetic observations");

let outcomes: Outcomes;
if (pipelineTest) {
  // measures are judged against their stated bar, read from the results index
  const ixr = JSON.parse(fs.readFileSync(path.join(path.resolve(import.meta.dirname, "../.."), "public/results/2026/index.json"), "utf8")) as { races: { id: string; thr?: number }[] };
  outcomes = outcomesFromFinalState(frames[frames.length - 1].state, 99, Object.fromEntries(ixr.races.filter((r) => r.thr != null).map((r) => [r.id, r.thr as number])));
}
else {
  const raw = JSON.parse(fs.readFileSync(path.resolve(arg("--outcomes")!), "utf8")) as Record<string, { winnerId?: string; winnerName?: string; marginPp: number; source: string }>;
  const last = frames[frames.length - 1].state; outcomes = {};
  for (const [rid, o] of Object.entries(raw)) {
    const row = last.races[rid]; const wid = o.winnerId ?? row?.c.find((c) => nameKey(c[1]) === nameKey(o.winnerName))?.[0];
    if (!wid) { console.error(`${rid}: winner "${o.winnerName}" is not a candidate in the archive`); continue; }
    outcomes[rid] = { winnerId: wid, marginPp: o.marginPp, certified: true, source: o.source };
  }
}
let report: Report;
try { report = evaluateArchive(frames, outcomes, { sourceLabel: `${source}: ${meta?.label ?? ""}`, blockers, pipelineTest, threshold: Number(arg("--threshold", "0.993")) }); }
catch (e) { console.error((e as Error).message); process.exit(1); }

const f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : "n/a"), f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "n/a"), pc = (x: number) => (Number.isFinite(x) ? `${(100 * x).toFixed(1)}%` : "n/a");
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? f1(s[s.length >> 1]) : "n/a"; };
const L: string[] = [];
L.push(`# Engine evaluation: ${report.kind}`, "");
if (report.kind !== "CALIBRATION") L.push(`> **PIPELINE TEST - NOT CALIBRATION.** ${report.blockers.length ? `This source cannot score the model: ${report.blockers.join("; ")}.` : ""} Outcomes are the source's own last frame, not certified results. These numbers show only that the evaluation runs end to end.`, "");
L.push(`Source: ${report.source}  `, `Frames: ${report.frames} · races with an outcome: ${report.outcomes} (${report.outcomeSource}) · model ${report.modelVersion}`, "");
for (const h of ["A", "B"] as const) {
  const H = report.byHalf[h];
  L.push(`## Races in half ${h}${h === "A" ? " (for tuning)" : " (held out: report this one)"}`, "", "| share of vote counted | race-frames | Brier | log loss | margin error (pts) | in 80% range | in 95% range | >= threshold on the loser |", "|---|---|---|---|---|---|---|---|");
  for (const [k, g] of [["all", H.overall], ...Object.entries(H.byCounted)] as [string, typeof H.overall][]) L.push(`| ${k} | ${g.n} | ${f3(g.brier)} | ${f3(g.logloss)} | ${f1(g.absErr)} | ${pc(g.in80)} | ${pc(g.in95)} | ${g.confidentWrong} |`);
  L.push("", `Calibration (every candidate's stated chance v how often it happened), ECE ${f3(H.ece)}:`, "", "| stated | n | said | happened |", "|---|---|---|---|");
  for (const c of H.calibration) if (c.n) L.push(`| ${c.bin} | ${c.n} | ${pc(c.stated)} | ${pc(c.observed)} |`);
  L.push("");
}
const mc = report.modelCalls;
L.push("## Model calls as recorded", "", `${mc.total} model calls, ${mc.withOutcome} with an outcome, ${mc.wrong.length} wrong${mc.wrong.length ? `: ${mc.wrong.map((w) => `${w.raceId} (${w.called}, ${w.at})`).join("; ")}` : ""}. Median minutes from first qualifying to the call: ${med(mc.minutesFirstToCall)}. Median minutes before the official call: ${med(mc.minutesBeforeOfficial)} (${mc.minutesBeforeOfficial.length} with an official call).`, "");
L.push("## The call rule at other thresholds (same stored forecasts)", "", "| threshold | model calls | wrong | median minutes before the last frame |", "|---|---|---|---|");
for (const s of report.sweep) L.push(`| ${(100 * s.threshold).toFixed(1)}% | ${s.calls} | ${s.wrong} | ${s.medianMinutesBeforeEnd == null ? "n/a" : f1(s.medianMinutesBeforeEnd)} |`);
L.push("", "## Gate E", "", report.gate.applicable ? "| test | value | result |\n|---|---|---|\n" + report.gate.results.map((r) => `| ${r.test} | ${r.value} | ${r.pass ? "PASS" : "FAIL"} |`).join("\n") : "NOT APPLICABLE: a pipeline test cannot pass or fail the gate. Run with certified outcomes on authentic, timestamped history.", "");
L.push("## National projection through the night", "", "| time (UTC) | House D seats | Senate D seats | D governors |", "|---|---|---|---|");
const step = Math.max(1, Math.floor(report.national.length / 24));
for (let i = 0; i < report.national.length; i += step) { const n = report.national[i]; L.push(`| ${n.t} | ${f1(n.houseD)} | ${f1(n.senD)} | ${f1(n.govD)} |`); }
fs.mkdirSync(outDir!, { recursive: true });
const base = path.join(outDir!, `${ns}-${id}${report.kind === "CALIBRATION" ? "" : "-PIPELINE-TEST"}`);
fs.writeFileSync(`${base}.md`, L.join("\n")); fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 1));
console.log(`${report.kind}: ${base}.md`);
