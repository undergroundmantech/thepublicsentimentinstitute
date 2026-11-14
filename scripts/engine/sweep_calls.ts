// Replay candidate call rules over a recorded night: for each rule, how many model calls, how many wrong, and how the
// timing compares with the provider's own calls. The stored forecasts are re-read; the engine is not re-run.
//
//   node --max-old-space-size=4600 --import ./scripts/intelligence/ts-resolve.mjs scripts/engine/sweep_calls.ts --store <archive dir>
//
// "Wrong" is against the provider's final call, or the leader in its last count where it made none: not certified.
// A rule chosen from this table is chosen knowing the answer; it is evidence about one night, not a validation.
// A stored row is a close copy of the live forecast, not an exact one, so read the table for the comparison between
// its rows; the last row (AS SHIPPED) should sit close to the archive's own ledger.
import fs from "node:fs";
import path from "node:path";
import { FsStore } from "../../app/lib/intelligence/captureStore";
import { forecastFromRow } from "../../app/lib/engine/evaluate";
import { DEFAULT_CALL_CONFIG, emptyLedger, stepLedger, type CallConfig, type RaceCallState } from "../../app/lib/engine/modelCalls";
import type { RaceRow, StoredState } from "../../app/lib/engine/pipeline";
import { openArchive, readState, snapshotOf } from "../../app/lib/engine/recorder";
import type { RaceForecast, RaceObservation } from "../../app/lib/engine/types";
import { matchToForecast } from "../../app/results/2026/candidates";
import type { XIndex, XRace } from "../../app/results/2026/live";

const arg = (k: string, d?: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
if (!arg("--store")) { console.error("usage: sweep_calls.ts --store <archive dir> [--source civicapi-2026-11-03]"); process.exit(2); }
const root = path.resolve(import.meta.dirname, "../..");
const index = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8")) as XIndex; const IX = new Map<string, XRace>(index.races.map((r) => [r.id, r]));
const store = new FsStore(path.resolve(arg("--store") as string), { durable: true });
const a = await openArchive(store, "historical", arg("--source", "civicapi-2026-11-03") as string);
if (!a.manifests.length) { console.error("no such archive"); process.exit(1); }
const draws = (id: string) => (/^(sen|house|gov)-/.test(id) ? 2000 : 1000);
// a stored row does not keep the forecast's sides or its pre-election chance; both are rebuilt from the index
const sides = new Map<string, [string | null, string | null]>();
function fromRow(row: RaceRow): RaceForecast {
  const f = forecastFromRow(row, draws(row.id)), r = IX.get(row.id);
  if (r && r.pR != null && row.pm) {
    const key = `${row.id}|${row.c.length}`; let s = sides.get(key);
    if (!s) { const m = matchToForecast((r.c ?? []).map((c) => c[0]), row.c.map((c) => c[1])); s = [m.match[0] != null ? row.c[m.match[0]][0] : null, m.match[1] != null ? row.c[m.match[1]][0] : null]; sides.set(key, s); }
    for (const c of f.candidates) c.side = c.candidateId === s[0] ? "a" : c.candidateId === s[1] ? "b" : "o";
    const d = { mean: row.pm.mean, p50: row.pm.mean, i80: { lo: row.pm.lo, hi: row.pm.hi }, i95: { lo: row.pm.lo, hi: row.pm.hi } };
    f.principalMargin = { reported: row.pm.rep, projected: d, probB: row.pm.probB, prior: { margin: 0, probB: r.pR } };
  }
  return f;
}
const fcs: Record<string, RaceForecast>[] = [], obs: Record<string, RaceObservation>[] = [], meta: { id: string; t: string }[] = []; let last: StoredState | null = null;
for (let i = 0; i < a.manifests.length; i++) {
  const st = await readState(store, a.manifests[i]), sn = await snapshotOf(store, a.manifests[i]);
  fcs.push(Object.fromEntries(Object.values(st.races).filter((r) => r.dataState !== "MISSING").map((r) => [r.id, fromRow(r)])));
  for (const o of Object.values(sn.races)) o.units = null;
  obs.push(sn.races); meta.push({ id: st.snapshotId, t: st.t }); if (i === a.manifests.length - 1) last = st;
}
const end = last as StoredState;
const truth: Record<string, string | null> = {}, offAt: Record<string, number> = {};
for (const [id, row] of Object.entries(end.races)) { const off = end.ledger.races[id]?.official; let b: RaceRow["c"][number] | null = null; for (const c of row.c) if ((c[3] ?? 0) > 0 && (!b || (c[3] as number) > (b[3] as number))) b = c; truth[id] = off?.candidateId ?? b?.[0] ?? null; if (off) offAt[id] = Date.parse(off.calledAt ?? off.firstSeenAt); }
const med = (d: number[]) => (d.length ? [...d].sort((p, q) => p - q)[d.length >> 1] : NaN);
console.log(`${a.manifests.length} frames, ${end.modelVersion}. Minutes are the provider's call time minus the model's: positive = the model was first.`);
console.log("rule | model calls (safe-seat lane) | wrong | median minutes: all races / Senate, governor, House | model first: all / Senate, governor, House | wrong races");
function run(label: string, over: Partial<CallConfig>) {
  const cfg: CallConfig = { ...DEFAULT_CALL_CONFIG, ...over }; let l = emptyLedger("HISTORICAL", cfg);
  for (let i = 0; i < fcs.length; i++) l = stepLedger(l, { snapshotId: meta[i].id, at: meta[i].t, forecasts: fcs[i], observations: obs[i] });
  type Called = RaceCallState & { modelCall: NonNullable<RaceCallState["modelCall"]> };
  const cs = Object.values(l.races).filter((x): x is Called => !!x.modelCall), fast = cs.filter((x) => x.modelCall.lane === "safe-seat"), wrong = cs.filter((x) => truth[x.raceId] && truth[x.raceId] !== x.modelCall.candidateId);
  const lead = (x: Called) => (offAt[x.raceId] - Date.parse(x.modelCall.calledAt)) / 60_000, both = cs.filter((x) => offAt[x.raceId] && !wrong.includes(x)), big = both.filter((x) => /^(sen|gov|house)-/.test(x.raceId));
  console.log(`${label} | ${cs.length} (${fast.length}) | ${wrong.length} | ${med(both.map(lead)).toFixed(0)} / ${med(big.map(lead)).toFixed(0)} | ${both.filter((x) => lead(x) > 0).length} of ${both.length} / ${big.filter((x) => lead(x) > 0).length} of ${big.length} | ${wrong.map((x) => `${x.raceId}@${x.modelCall.calledAt.slice(11, 16)}${x.modelCall.lane === "safe-seat" ? " (safe-seat lane)" : ""}`).join(" ")}`);
}
const off = { ...DEFAULT_CALL_CONFIG.fast, on: false }, flags = DEFAULT_CALL_CONFIG.blockingFlags.filter((f) => f !== "PROVIDER_ROWS_INCONSISTENT");
run("the 2.2.0 rule: no row checks, no quarantine, no safe-seat lane", { minUpdates: 0, fast: off, blockingFlags: flags });
run("row checks only", { minUpdates: 0, fast: off });
run("quarantine only (3 updates)", { minUpdates: 3, fast: off, blockingFlags: flags });
run("row checks and quarantine, no safe-seat lane", { fast: off });
for (const fu of [3, 2, 1]) for (const mp of [0.95, 0.97, 0.99]) run(`safe seat: forecast >= ${mp}, its own quarantine ${fu}`, { fast: { ...DEFAULT_CALL_CONFIG.fast, minPrior: mp, minUpdates: fu } });
run("as shipped, at a 99.5% threshold", { threshold: 0.995 });
run("AS SHIPPED", {});
