// Engine 2.5.0: the pages show On Point's own calls and nothing else, so the engine has to finish what it starts.
//   - an unopposed candidate is recorded as a call when the polls close (and never while only one of two has votes);
//   - a count that has stopped settles a race the model cannot quite let go of;
//   - a race with no forecast is called on the count itself;
//   - ranked choice is called only on a certain first-choice majority;
//   - a count that has gone DOWN blocks a call; a canvass sliver does not reopen a count;
//   - the national seat counts follow On Point's calls, not the provider's;
//   - the pages' winner flags come from the call book.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { COUNT_DROP_HOLD_MS, QUIET_LONG_MS, prepare, rawAt, type CompactRace } from "../../app/lib/engine/civicHistory";
import { DEFAULT_CALL_CONFIG, emptyLedger, probe, stepLedger, type Ledger } from "../../app/lib/engine/modelCalls";
import { momentsBetween, type RaceMeta } from "../../app/lib/engine/moments";
import { nationalForecast, pollsClosed, preElectionFrom } from "../../app/lib/engine/national";
import { callsOf, evaluate } from "../../app/lib/engine/pipeline";
import { forecastRace } from "../../app/lib/engine/raceModel";
import type { ElectionSnapshot, RaceForecast, RaceObservation } from "../../app/lib/engine/types";
import { applyCalls, calledIndex, callsFromLedger, callsFromRecorded, certainParty, withoutProviderCall } from "../../app/results/2026/onpointCalls";
import { tally } from "../../app/results/2026/nationalTally";
import type { CRace, XIndex, XRace } from "../../app/results/2026/live";

const root = path.resolve(import.meta.dirname, "../..");
const ix = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8")) as XIndex;
const pre = preElectionFrom(JSON.parse(fs.readFileSync(path.join(root, "public/forecast/archive/final-2026-11-03/model.json"), "utf8")));
const race = (id: string) => ix.races.find((r) => r.id === id) as XRace;

const D = (m: number, lo = m, hi = m) => ({ mean: m, p50: m, i80: { lo, hi }, i95: { lo, hi } });
type Opt = { counted?: [number, number]; expected?: number; flags?: RaceForecast["flags"]; rule?: RaceForecast["rule"]; marginLo?: number; quietMin?: number; slow?: boolean; outHi?: number; outright?: number; settled?: boolean };
function fc(pA: number, o: Opt = {}): RaceForecast {
  const [a, b] = o.counted ?? [52_000, 48_000], exp = o.expected ?? a + b + 1000, counted = a + b, out = Math.max(0, exp - counted);
  const cand = (id: string, votes: number, p: number) => ({ candidateId: id, name: id === "A" ? "Ann Able" : "Bo Baker", partyRaw: id === "A" ? "Democratic" : "Republican", side: (id === "A" ? "a" : "b") as "a" | "b", reportedVotes: votes, projectedVotes: D(votes), projectedShare: D(50), winProbability: p,
    ...(o.outright != null ? { outrightProbability: id === "A" ? o.outright : 0 } : {}) });
  const lead = pA >= 0.5 ? "A" : "B";
  return { raceId: "house-ZZ-01", rule: o.rule ?? "plurality", computedAt: "", snapshotId: "", modelVersion: "t", dataState: "LIMITED", forecastAvailable: true, calibration: "UNCALIBRATED", settled: o.settled ? { basis: "UNCONTESTED", winnerId: "A" } : null, call: null,
    candidates: [cand("A", a, pA), cand("B", b, 1 - pA)],
    principalMargin: { reported: null, projected: D(-4), probB: 1 - pA, prior: { margin: -4, probB: 0.5 } },
    projectedTopTwo: { leaderId: lead, runnerUpId: lead === "A" ? "B" : "A", marginPp: D(4, o.marginLo ?? -1, 9), marginVotes: D(1) },
    turnout: { counted, expectedFinal: D(exp), outstanding: D(out, 0, o.outHi ?? 30_000), byUnit: [], ...(o.quietMin != null ? { quietMin: o.quietMin, slowCount: !!o.slow } : {}) },
    display: { leaderId: lead, probability: 0.995, capped: false }, draws: 20_000, mcStdErr: 0, flags: o.flags ?? ["METHOD_UNKNOWN"], notes: [] };
}
const ob = (votes: [number, number], extra: Partial<RaceObservation> = {}): RaceObservation => ({ raceId: "house-ZZ-01", providerRaceId: 1, providerPctReporting: 95, units: null, sourceAsOf: null, receivedAt: "", test: false,
  candidates: [{ candidateId: "A", name: "Ann Able", partyRaw: "Democratic", votes: votes[0], providerWinner: false }, { candidateId: "B", name: "Bo Baker", partyRaw: "Republican", votes: votes[1], providerWinner: false }], ...extra });
const id = "house-ZZ-01", C = DEFAULT_CALL_CONFIG, F = C.finished!;
const at = (min: number) => new Date(Date.parse("2026-11-04T02:00:00Z") + min * 60_000).toISOString();
let n = 0;
const step = (l: Ledger, f: RaceForecast, o: RaceObservation | undefined, t: string) => stepLedger(l, { snapshotId: `s${++n}`, at: t, forecasts: { [f.raceId]: f }, observations: o ? { [f.raceId]: o } : {} });

test("a count that has stopped is judged on the votes counted: the open-count safeguards no longer apply", () => {
  // 4 points ahead on the count, the model at 98.7%: its 95% range still touches a loss and the high estimate of the
  // outstanding vote is large, because the model never quite lets go of the chance that a count reopens
  const open = probe(fc(0.987, { marginLo: -0.4 }), C, false);
  assert.equal(open.qualifies, false); assert.match(open.blockers.join(" | "), /includes a loss/);
  const stopped = probe(fc(0.987, { marginLo: -0.4, quietMin: F.quietMin }), C, false);
  assert.equal(stopped.qualifies, true); assert.equal(stopped.lane, "count-settled", "called on the count, and labelled so");
  // not before the three days are up, and not in a state that counts for days until its longer wait is over
  assert.equal(probe(fc(0.987, { marginLo: -0.4, quietMin: F.quietMin - 1 }), C, false).qualifies, false);
  assert.equal(probe(fc(0.987, { marginLo: -0.4, quietMin: F.quietMin, slow: true }), C, false).qualifies, false);
  assert.equal(probe(fc(0.987, { marginLo: -0.4, quietMin: F.slowQuietMin, slow: true }), C, false).qualifies, true);
});

test("a stopped count inside the recount margin is never called, and between the floors it needs the full threshold", () => {
  // 0.3 points: recount territory, whatever the model says
  const thin = probe(fc(0.9995, { counted: [50_150, 49_850], quietMin: F.quietMin }), C, false);
  assert.equal(thin.qualifies, false); assert.match(thin.blockers.join(" "), /recount territory/);
  // 0.7 points: over the recount floor, under the count-settled margin. The standard rule (the full threshold) calls it; a 98% model does not
  assert.equal(probe(fc(0.9995, { counted: [50_350, 49_650], quietMin: F.quietMin }), C, false).lane, "standard");
  const mid = probe(fc(0.98, { counted: [50_350, 49_650], quietMin: F.quietMin }), C, false);
  assert.equal(mid.qualifies, false); assert.match(mid.blockers.join(" "), /under the threshold/);
  // the model must still favour the leader strongly, and its leader must be the count's
  assert.equal(probe(fc(0.9, { quietMin: F.quietMin }), C, false).qualifies, false, "90% is not enough, stopped or not");
  assert.match(probe(fc(0.02, { quietMin: F.quietMin }), C, false).blockers.join(" "), /does not lead the count/);
});

test("the count-settled rule is for plain plurality races: a measure, a runoff rule and ranked choice keep their own tests", () => {
  for (const rule of ["measure", "majority_runoff"] as const) assert.equal(probe(fc(0.987, { marginLo: -0.4, quietMin: F.quietMin, rule }), C, false).qualifies, false, rule);
});

test("ranked choice is called only on a certain majority of first choices", () => {
  const base = { rule: "ranked_choice" as const, flags: ["RULE_RANKED_CHOICE", "METHOD_UNKNOWN"] as RaceForecast["flags"], counted: [66_000, 34_000] as [number, number], marginLo: 20, outHi: 5_000 };
  const maj = probe(fc(0.9999, { ...base, outright: 0.9999 }), C, false);
  assert.equal(maj.qualifies, true, "a first-choice majority needs no transfers"); assert.equal(maj.lane, "standard");
  const no = probe(fc(0.9999, { ...base, outright: 0.6 }), C, false);
  assert.equal(no.qualifies, false); assert.match(no.blockers.join(" "), /ranked choice: called only on a certain majority/);
  // the simulated final round alone, however sure, is never enough
  assert.equal(probe(fc(0.9999, { ...base, outright: 0 }), C, false).qualifies, false);
  // and the race model reports that majority chance for a ranked-choice race
  const me = race("house-ME-01"), f = forecastRace(me, { raceId: me.id, providerRaceId: 1, providerPctReporting: 97, units: null, sourceAsOf: null, receivedAt: "", test: false,
    candidates: [{ candidateId: "p", name: me.c![0][0], partyRaw: "Democratic", votes: 248_000, providerWinner: false }, { candidateId: "q", name: me.c![1][0], partyRaw: "Republican", votes: 127_000, providerWinner: false }] }, null, { seed: "t", computedAt: "x", snapshotId: "s", draws: 400 });
  assert.equal(f.rule, "ranked_choice"); assert.ok((f.candidates.find((c) => c.reportedVotes === 248_000)?.outrightProbability ?? 0) > 0.99);
});

test("a race with no forecast is called on the count: once it has stopped, or once the lead is out of reach", () => {
  const nf = (counted: [number, number], quietMin?: number) => fc(0.5, { counted, flags: ["NO_FORECAST"], quietMin });
  const p = (counted: [number, number], pct: number | null, quietMin?: number) => probe(nf(counted, quietMin), C, false, pct);
  // 20 points ahead with 95% reporting: the lead (20,000) is more than three times what 95% leaves uncounted (5,263)
  const reach = p([60_000, 40_000], 95); assert.equal(reach.qualifies, true); assert.equal(reach.lane, "count-settled"); assert.equal(reach.p, null, "no model stands behind it");
  // the same lead at 70% reporting is not out of reach (42,857 uncounted), and waits for the count to stop
  assert.equal(p([60_000, 40_000], 70).qualifies, false); assert.match(p([60_000, 40_000], 70).blockers.join(" "), /called once its count has stopped, or once the lead is 20 points and 3 times/);
  assert.equal(p([60_000, 40_000], 70, F.quietMin).qualifies, true);
  // under 60% reporting nothing is out of reach; under ten points nothing is called at all without a forecast
  assert.equal(p([90_000, 10_000], 55).qualifies, false);
  assert.equal(p([54_000, 46_000], 100).qualifies, false); assert.match(p([54_000, 46_000], 100, F.quietMin).blockers.join(" "), /under 10 points clear/);
  assert.equal(p([60_000, 40_000], null).qualifies, false, "no percent reporting, no arithmetic");
  // the provider's percent can be of precincts, not ballots, so the lead must be wide in points too: 20, and 40 where
  // counts run for days (California showed 100% with half its mail uncounted and a 15-point lead that ended at 7)
  assert.equal(p([57_000, 43_000], 100).qualifies, false, "14 points at '100%': not out of reach on a percent alone");
  const slow = (counted: [number, number], pct: number) => probe(fc(0.5, { counted, flags: ["NO_FORECAST"], slow: true, quietMin: 60 }), C, false, pct);
  assert.equal(slow([65_000, 35_000], 100).qualifies, false, "30 points in a state that counts for days: wait");
  assert.equal(slow([80_000, 20_000], 100).qualifies, true, "60 points is out of reach anywhere");
});

test("an unopposed candidate is recorded as a call when the polls close, in a lane of its own", () => {
  const f = fc(1, { settled: true, flags: ["UNCONTESTED"] }), one = (votes: number, extra: Partial<RaceObservation> = {}) => ob([votes, 0], extra);
  // before the provider's closing time, and with no votes: nothing
  let l = step(emptyLedger("LIVE"), f, one(0, { pollsCloseAt: at(30) }), at(0));
  assert.equal(l.races[id].status, "SETTLED_UNCONTESTED"); assert.equal(l.races[id].modelCall, null, "not before the polls close");
  l = step(l, f, one(0, { pollsCloseAt: at(30) }), at(30));
  assert.equal(l.races[id].modelCall?.lane, "uncontested"); assert.equal(l.races[id].modelCall?.calledAt, at(30)); assert.equal(l.races[id].modelCall?.probability, null);
  assert.equal(l.events.filter((e) => e.kind === "MODEL_CALLED").length, 1);
  l = step(l, f, one(5_000, { pollsCloseAt: at(30) }), at(40)); assert.equal(l.events.filter((e) => e.kind === "MODEL_CALLED").length, 1, "recorded once");
  // the provider later adds a line that cannot win (Nevada's "None of These Candidates"), so the race is no longer
  // "settled" for the model, which has no probability for it: the call stands and nothing alerts
  const later = fc(0, { settled: false, flags: ["NO_FORECAST"], counted: [5_000, 1_500] });
  for (let i = 0; i < 3; i++) l = step(l, later, ob([5_000 + i, 1_500], { pollsCloseAt: at(30) }), at(50 + 10 * i));
  assert.equal(l.races[id].modelCall?.lane, "uncontested"); assert.equal(l.races[id].alerts, 0); assert.equal(l.events.filter((e) => e.kind.startsWith("ALERT")).length, 0);
  // test returns before the close never count; with no closing time listed, the first votes do
  assert.equal(step(emptyLedger("LIVE"), f, one(9_000, { test: true }), at(0)).races[id].modelCall, null);
  assert.equal(step(emptyLedger("LIVE"), f, one(9_000), at(0)).races[id].modelCall?.lane, "uncontested");
  assert.equal(pollsClosed({ pollsCloseAt: at(30), candidates: [{ votes: 0 }] }, at(29)), false); assert.equal(pollsClosed({ pollsCloseAt: at(30), candidates: [{ votes: 0 }] }, at(30)), true);
});

test("a two-candidate race is never 'unopposed' because only one of them has votes yet", () => {
  // a seat the index lists with no candidates (two Democrats in a top-two general): the first batch has votes for one
  const r = race("house-CA-12"); assert.ok(!(r.c ?? []).length, "the fixture: a seat with no candidates in the index");
  const obs = (a: number, b: number): RaceObservation => ({ raceId: r.id, providerRaceId: 1, providerPctReporting: 5, units: null, sourceAsOf: null, receivedAt: "", test: false,
    candidates: [{ candidateId: "x", name: "First Listed", partyRaw: "Democratic", votes: a, providerWinner: false }, { candidateId: "y", name: "Second Listed", partyRaw: "Democratic", votes: b, providerWinner: false }] });
  const O = { seed: "t", computedAt: "x", snapshotId: "s", draws: 200 };
  assert.equal(forecastRace(r, obs(0, 0), null, O).settled, null, "two listed candidates: contested before a vote is in");
  assert.equal(forecastRace(r, obs(4_000, 0), null, O).settled, null, "and while only one has votes");
  // one listed candidate is unopposed, votes or no votes
  const solo: RaceObservation = { ...obs(0, 0), candidates: [obs(0, 0).candidates[0]] };
  assert.equal(forecastRace(r, solo, null, O).settled?.basis, "UNCONTESTED");
});

test("a count that has gone down blocks a call, and the lower figure becomes the reference after a day", () => {
  const snap = (t: string, v: number) => ({ t, pr: 80, lu: t, ca: null, pc: null, v: [[0, v], [1, Math.round(v * 0.8)]], w: [] });
  const t0 = Date.parse("2026-11-04T02:00:00Z"), iso = (h: number) => new Date(t0 + h * 3_600_000).toISOString();
  const c = { id: 9, name: "x", type: "US House", state: "IN", cands: [["A", "Republican", 1], ["B", "Democratic", 2]], snaps: [snap(iso(0), 100_000), snap(iso(1), 85_000), snap(iso(30), 85_100)] } as unknown as CompactRace;
  const [h] = prepare([c]);
  assert.equal(rawAt(h, t0 + 1)?.total_peak, 180_000, "the highest total so far");
  assert.equal(rawAt(h, t0 + 3_600_000 + 1)?.total_peak, 180_000, "the drop is measured against it");
  assert.equal(rawAt(h, t0 + 3_600_000 + COUNT_DROP_HOLD_MS + 1)?.total_peak, null, "a lower total that has stood for a day is the provider's correction: no reference, no flag");
  // the race model flags it, and the flag blocks a call
  const r = race("house-IN-03"); const o = (votes: number, peak?: number): RaceObservation => ({ raceId: r.id, providerRaceId: 1, providerPctReporting: 80, units: null, sourceAsOf: null, receivedAt: "", test: false, ...(peak ? { peakTotal: peak } : {}),
    candidates: [{ candidateId: "a", name: r.c![0][0], partyRaw: r.c![0][1] === "D" ? "Democratic" : "Republican", votes, providerWinner: false }, { candidateId: "b", name: r.c![1][0], partyRaw: r.c![1][1] === "D" ? "Democratic" : "Republican", votes: Math.round(votes * 0.8), providerWinner: false }] });
  const O = { seed: "t", computedAt: "x", snapshotId: "s", draws: 200 };
  assert.ok(forecastRace(r, o(85_000, 180_000), null, O).flags.includes("COUNT_DECREASED"));
  assert.ok(!forecastRace(r, o(100_000, 180_000), null, O).flags.includes("COUNT_DECREASED"), "at or near its high: no flag");
  assert.ok(C.blockingFlags.includes("COUNT_DECREASED"));
  assert.match(probe(fc(0.9999, { counted: [70_000, 30_000], marginLo: 20, outHi: 100, flags: ["COUNT_DECREASED"] }), C, false).blockers.join(" "), /COUNT_DECREASED/);
});

test("a canvass sliver after half a day of silence does not restart a race's clock; a real batch does", () => {
  const t0 = Date.parse("2026-11-04T04:00:00Z"), iso = (ms: number) => new Date(t0 + ms).toISOString();
  const snap = (ms: number, v: number) => ({ t: iso(ms), pr: 99, lu: iso(ms), ca: null, pc: null, v: [[0, v], [1, v]], w: [] });
  const mk = (state: string, add: number) => prepare([{ id: 9, name: "x", type: "US House", state, cands: [["A", "Republican", 1], ["B", "Democratic", 2]], snaps: [snap(0, 100_000), snap(QUIET_LONG_MS + 3_600_000, 100_000 + add)] } as unknown as CompactRace])[0];
  const late = t0 + QUIET_LONG_MS + 3_600_000 + 1;
  assert.equal(rawAt(mk("VA", 600), late)?.total_last_changed, iso(0), "0.6% after 13 hours still: the clock runs on");
  assert.equal(rawAt(mk("VA", 2_000), late)?.total_last_changed, iso(QUIET_LONG_MS + 3_600_000), "2% is a batch: the clock restarts");
  assert.equal(rawAt(mk("CA", 600), late)?.total_last_changed, iso(QUIET_LONG_MS + 3_600_000), "in a state that counts for days a small daily batch is the count itself");
});

test("the national seat counts follow On Point's calls and ignore the provider's winner flags", () => {
  const r = race("sen-NE"), [c0, c1] = [r.c![0][0], r.c![1][0]];
  const obs: RaceObservation = { raceId: r.id, providerRaceId: 1, providerPctReporting: 60, units: null, sourceAsOf: null, receivedAt: "2026-11-04T03:00:00Z", test: false,
    candidates: [{ candidateId: "a", name: c0, partyRaw: r.c![0][1] === "R" ? "Republican" : "Independent", votes: 300_000, providerWinner: true }, { candidateId: "b", name: c1, partyRaw: r.c![1][1] === "R" ? "Republican" : "Independent", votes: 290_000, providerWinner: false }] };
  const snap: ElectionSnapshot = { snapshotId: "n", provenance: { mode: "LIVE", source: "t", receivedAt: "2026-11-04T03:00:00Z" } as ElectionSnapshot["provenance"], races: { [r.id]: obs }, unmatchedProviderRaces: 0 } as ElectionSnapshot;
  const base = { index: ix, snapshot: snap, pre, seed: "s", computedAt: "2026-11-04T03:00:00Z", draws: 300 };
  const none = nationalForecast({ ...base, calls: {} });
  assert.deepEqual(none.national.senate.called, { D: 0, R: 0, other: 0 }, "a provider winner flag is not a call");
  assert.equal(none.national.senate.leading.D + none.national.senate.leading.R + none.national.senate.leading.other, 1, "the race is counted as led, not called");
  const mine = nationalForecast({ ...base, calls: { [r.id]: "b" } });
  assert.equal(mine.national.senate.called.D + mine.national.senate.called.R + mine.national.senate.called.other, 1, "On Point's call is");
  assert.equal(mine.tallyInfo[r.id].called, mine.tallyInfo[r.id].bucket.b, "for the candidate On Point called, not the one the provider flagged");
  assert.match(mine.national.senate.display.basis, /Model estimate|On Point's calls/);
});

test("a call made in an update is in that update's called count: the ledger and the national tally never disagree", () => {
  const r = race("sen-NE");
  const obs = (v: number): RaceObservation => ({ raceId: r.id, providerRaceId: 1, providerPctReporting: 99, units: null, sourceAsOf: null, receivedAt: "", test: false,
    candidates: [{ candidateId: "a", name: r.c![0][0], partyRaw: "Republican", votes: v, providerWinner: false }, { candidateId: "b", name: r.c![1][0], partyRaw: "Independent", votes: Math.round(v / 4), providerWinner: false }] });
  let ledger: Ledger | null = null; const called: number[] = []; const onLedger: number[] = [];
  for (let i = 0; i < 6; i++) {
    const t = at(10 * i), snap = { snapshotId: `e${i}`, provenance: { mode: "LIVE", source: "t", receivedAt: t }, races: { [r.id]: { ...obs(600_000 + 1000 * i), receivedAt: t } }, unmatchedProviderRaces: 0 } as unknown as ElectionSnapshot;
    const s = evaluate({ index: ix, pre, snapshot: snap, ledger, t }); ledger = s.ledger;
    called.push(s.national.senate.called.D + s.national.senate.called.R + s.national.senate.called.other); onLedger.push(Object.keys(callsOf(s.ledger)).filter((k) => k.startsWith("sen-")).length);
  }
  assert.deepEqual(called, onLedger, `called per update ${called} v ledger ${onLedger}`);
  assert.equal(called[called.length - 1], 1, "the race is called by the end of the run");
});

test("the pages' winner flags come from On Point's call book, and a provider flag is dropped", () => {
  const c: CRace = { id: 5, type: "US Senate", province: "NE", district: null, name: "x", pr: 90, c: [["Pete Ricketts", "Republican", 60, 60, 1, null], ["Dan Osborn", "Independent", 40, 40, 0, null]] };
  assert.deepEqual(withoutProviderCall(c).c.map((x) => x[4]), [0, 0]);
  const book = callsFromRecorded({ v: 1, engine: "t", source: "t", asOf: "x", calls: { "sen-NE": ["Dan Osborn", "Independent", "2026-11-04T05:00:00Z", "standard"] } });
  assert.deepEqual(applyCalls({ "sen-NE": c, "sen-KS": c }, book)["sen-NE"].c.map((x) => x[4]), [0, 1], "On Point's call, whoever the provider flagged");
  assert.deepEqual(applyCalls({ "sen-KS": c }, book)["sen-KS"].c.map((x) => x[4]), [0, 0], "no call, no winner");
  assert.equal(calledIndex({ ...c, c: [["José Peña-Ruiz", "D", 1, 1, 0, null]] }, { name: "Jose Pena Ruiz", party: "D", at: null, lane: "standard" }), 0, "accents and punctuation folded");
  assert.equal(calledIndex(c, { name: "Someone Else", party: null, at: null, lane: "standard" }), -1);
  const led = callsFromLedger({ "sen-NE": { modelCall: { candidateId: "z", name: "Dan Osborn", partyRaw: "Independent", calledAt: "t", lane: "safe-seat" } }, "sen-KS": { modelCall: null } });
  assert.deepEqual(Object.keys(led), ["sen-NE"]); assert.equal(led["sen-NE"].lane, "safe-seat");
});

test("tallies: an unopposed winner counts with no votes at all, and a one-party seat counts for its party before a name is called", () => {
  const rs = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }].map((x) => ({ ...race("house-CA-12"), id: x.id })) as XRace[];
  const mk = (rows: [string, string, number, number][]): CRace => ({ id: 1, type: "US House", province: "CA", district: null, name: "x", pr: 50, c: rows.map(([n1, p, v, w]) => [n1, p, v, 0, w, null]) });
  const byId = { a: mk([["Solo", "Democratic", 0, 1]]), b: mk([["One", "Democratic", 60, 0], ["Two", "Democratic", 40, 0]]), c: mk([["Dee", "Democratic", 60, 0], ["Arr", "Republican", 40, 0]]), d: mk([["Won", "Republican", 70, 1], ["Lost", "Democratic", 30, 0]]) };
  const t = tally(rs, byId);
  assert.equal(t.cD, 2, "the unopposed Democrat and the two-Democrat seat"); assert.equal(t.cR, 1); assert.equal(t.called, 3); assert.equal(t.lD, 1, "the open race is only led");
  assert.equal(certainParty(byId.b), "D"); assert.equal(certainParty(byId.c), null); assert.equal(certainParty(byId.a), null, "one candidate is not a one-party contest: it needs a call");
});

test("moments: On Point's calls are the calls of the night; an unopposed winner is a footnote", () => {
  const meta = new Map<string, RaceMeta>([[id, { id, nm: "Zed 1", k: "house", st: "ZZ", fav: 0.6 }]]);
  const f = fc(1, { settled: true, flags: ["UNCONTESTED"] });
  const l0 = emptyLedger("LIVE"), l1 = step(l0, f, ob([9_000, 0]), at(0));
  const st = (l: Ledger, t: string) => ({ t, ledger: l, races: {}, national: { senate: { pD: 0.5, pR: 0.5, called: { D: 0, R: 0, other: 0 } }, house: { pD: 0.5, pR: 0.5, called: { D: 0, R: 0, other: 0 } }, governors: { pD: 0.5, pR: 0.5, called: { D: 0, R: 0, other: 0 } } } }) as unknown as Parameters<typeof momentsBetween>[1];
  const m = momentsBetween(st(l0, at(0)), st(l1, at(0)), meta);
  assert.equal(m.length, 1); assert.equal(m[0].kind, "MODEL_CALL"); assert.equal(m[0].imp, 1); assert.match(m[0].title, /is unopposed/);
});
