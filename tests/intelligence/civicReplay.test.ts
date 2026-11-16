// The recorded replay from civicAPI's history export: frames hold only what was published at or before their time,
// a provider's changed or withdrawn call is followed, key moments are derived from recorded states only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { detailAt, frameTimes, prepare, rawAt, regionsAt, snapIndexAt, type CompactRace } from "../../app/lib/engine/civicHistory";
import { DEFAULT_CONFIG } from "../../app/lib/engine/config";
import { evaluateArchive } from "../../app/lib/engine/evaluate";
import { applyDelta, isDelta, makeDelta } from "../../app/lib/engine/frameDelta";
import { emptyLedger, stepLedger } from "../../app/lib/engine/modelCalls";
import { momentsBetween, pollCloseMoments, type RaceMeta } from "../../app/lib/engine/moments";
import { preElectionFrom } from "../../app/lib/engine/national";
import { evaluate } from "../../app/lib/engine/pipeline";
import { forecastRace } from "../../app/lib/engine/raceModel";
import { canonicalJson } from "../../app/lib/engine/rng";
import { viewOf } from "../../app/lib/engine/serve";
import { snapshotFromCivic, type CivicRawRace } from "../../app/lib/engine/snapshot";
import type { RaceObservation } from "../../app/lib/engine/types";
import { candidateId } from "../../app/results/2026/candidates";
import { CIVIC_PINS, matchCivic, type CRace, type XIndex, type XRace } from "../../app/results/2026/live";

const root = path.join(import.meta.dirname, "../..");
const ix = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8")) as XIndex;
const pre = preElectionFrom(JSON.parse(fs.readFileSync(path.join(root, "public/forecast/archive/final-2026-11-03/model.json"), "utf8")));
const race = (id: string) => ix.races.find((x) => x.id === id) as XRace;
const T = (hm: string) => `2026-11-04T${hm}:00.000Z`;

// a small history in the export's compact form: South Carolina's Senate race, with the call civicAPI made, took back
// and moved within two minutes (the times and the order are the recorded ones; the counts are rounded)
const sc: CompactRace = {
  id: 87409, name: "South Carolina US Senate", state: "SC", category: "federal", type: "US Senate",
  cands: [["Darline Graham", "Republican", 1], ["Annie Andrews", "Democratic", 2]],
  regions: { richland: ["45079", "Richland", "County"], horry: ["45051", "Horry", "County"] },
  final: { pr: 99, ca: T("03:00"), lu: null, pc: T("00:00"), v: [[1, 1_044_000], [0, 952_000]], w: [1], r: {}, district: null, ename: "South Carolina US Senate", etype: "US Senate" },
  snaps: [
    { t: "2026-08-21T18:40:00.000Z", pr: 0, ca: null, lu: null, pc: T("00:00"), v: [[0, 0], [1, 0]], w: [], r: { richland: [0, [0, 0], [1, 0]], horry: [0, [0, 0], [1, 0]] } },
    { t: T("00:20"), pr: 12, ca: null, lu: null, pc: T("00:00"), v: [[1, 90_000], [0, 70_000]], w: [], r: { richland: [30, [0, 20_000], [1, 60_000]] } },
    { t: T("02:53"), pr: 88.7, ca: null, lu: null, pc: T("00:00"), v: [[1, 918_000], [0, 843_000]], w: [], r: { horry: [80, [0, 90_000], [1, 50_000]] } },
    { t: "2026-11-04T02:58:31.000Z", pr: 88.7, ca: "2026-11-04T02:58:15.000Z", lu: null, pc: T("00:00"), v: [[1, 918_000], [0, 843_000]], w: [0], r: {} },
    { t: "2026-11-04T03:00:15.000Z", pr: 88.7, ca: null, lu: null, pc: T("00:00"), v: [[1, 918_000], [0, 843_000]], w: [], r: {} },
    { t: "2026-11-04T03:01:03.000Z", pr: 88.8, ca: "2026-11-04T03:00:15.730Z", lu: null, pc: T("00:00"), v: [[1, 919_000], [0, 844_000]], w: [1], r: {} },
  ],
};
const hs = prepare([sc]);

test("a frame holds the latest snapshot at or before its time, and nothing after it", () => {
  const h = hs[0];
  assert.equal(snapIndexAt(h, Date.parse("2026-01-01T00:00:00Z")), -1);
  assert.equal(rawAt(h, Date.parse("2026-01-01T00:00:00Z")), null, "before the first snapshot there is no race");
  const a = rawAt(h, Date.parse(T("02:58")))!;      // 31 seconds before the mistaken call was published
  assert.deepEqual(a.candidates!.map((c) => [c.name, c.votes, c.winner]), [["Annie Andrews", 918_000, false], ["Darline Graham", 843_000, false]]);
  const b = rawAt(h, Date.parse(T("03:00")))!;
  assert.equal(b.candidates!.find((c) => c.winner)?.name, "Darline Graham"); assert.equal(b.called_at, "2026-11-04T02:58:15.000Z");
  const c = rawAt(h, Date.parse(T("03:02")))!;
  assert.equal(c.candidates!.find((c2) => c2.winner)?.name, "Annie Andrews");
  // every frame time: the snapshot used is never later than the frame
  for (let t = Date.parse(T("00:00")); t <= Date.parse(T("04:00")); t += 60_000) { const i = snapIndexAt(h, t); assert.ok(i < 0 || h.timesMs[i] <= t); assert.ok(i === h.timesMs.length - 1 || h.timesMs[i + 1] > t); }
});

test("county rows are each county's latest published row at the moment, with the provider's own figures", () => {
  const h = hs[0];
  const early = regionsAt(h, snapIndexAt(h, Date.parse(T("00:30"))));
  assert.equal(early.richland.percent_reporting, 30); assert.equal(early.horry.percent_reporting, 0, "Horry had not reported at 12:30");
  const late = detailAt(h.race, Date.parse(T("03:02")))!;
  assert.equal(late.regions["45051"].pr, 80); assert.deepEqual(late.regions["45051"].c.map((c) => [c[0], c[2]]), [["Darline Graham", 90_000], ["Annie Andrews", 50_000]]);
  assert.equal(late.regions["45079"].c[1][2], 60_000, "Richland keeps its last published row");
  assert.equal(late.c.find((c) => c[4] === 1)?.[0], "Annie Andrews");
  assert.equal(detailAt(h.race, Date.parse("2026-01-01T00:00:00Z")), null);
});

test("frame times follow the cadence and skip ticks with nothing new", () => {
  const plan = [{ fromMs: Date.parse(T("00:00")), toMs: Date.parse(T("04:00")), everyMs: 120_000 }];
  const ft = frameTimes(hs, plan).map((t) => new Date(t).toISOString());
  assert.equal(ft[0], T("00:00"), "the first tick is kept: the state before the count");
  assert.deepEqual(ft.slice(1), [T("00:20"), T("02:54"), T("03:00"), T("03:02")], "one frame per tick that has something new; the 03:00:15 withdrawal and the 03:01:03 call share the 03:02 tick");
});

test("a provider's call that is taken back or moved is followed, and every step stays in the log", () => {
  const r = race("sen-SC"); const names = (r.c ?? []).map(([n]) => n);
  const A = names[0], B = names[1];
  const obs = (winner: string | null, calledAt: string | null): RaceObservation => ({ raceId: r.id, providerRaceId: 87409, providerPctReporting: 88.7, units: null, sourceAsOf: null, receivedAt: "x", test: false, providerCalledAt: calledAt,
    candidates: [[A, 918_000], [B, 843_000]].map(([n, v]) => ({ candidateId: candidateId(r.id, n as string), name: n as string, partyRaw: null, votes: v as number, providerWinner: n === winner })) });
  const step = (prev: ReturnType<typeof emptyLedger>, o: RaceObservation, at: string, sid: string) => stepLedger(prev, { snapshotId: sid, at, forecasts: { [r.id]: forecastRace(r, o, null, { seed: "s", computedAt: at, snapshotId: sid, draws: 400 }) }, observations: { [r.id]: o } });
  let l = step(emptyLedger("HISTORICAL"), obs(null, null), T("02:58"), "a");
  assert.equal(l.races[r.id].official, null);
  l = step(l, obs(B, "2026-11-04T02:58:15.000Z"), T("03:00"), "b");
  assert.equal(l.races[r.id].official?.name, B); assert.equal(l.races[r.id].official?.calledAt, "2026-11-04T02:58:15.000Z"); assert.equal(l.races[r.id].official?.firstSeenAt, T("03:00"));
  const withdrawn = step(l, obs(null, null), T("03:01"), "c");
  assert.equal(withdrawn.races[r.id].official, null, "a withdrawn call is no longer a standing call");
  assert.equal(withdrawn.events.at(-1)?.kind, "OFFICIAL_CALL_WITHDRAWN");
  const moved = step(l, obs(A, "2026-11-04T03:00:15.730Z"), T("03:02"), "d");
  assert.equal(moved.races[r.id].official?.name, A); assert.equal(moved.races[r.id].official?.calledAt, "2026-11-04T03:00:15.730Z");
  assert.deepEqual(moved.events.filter((e) => e.raceId === r.id && e.kind.startsWith("OFFICIAL")).map((e) => [e.kind, e.name]), [["OFFICIAL_CALL", B], ["OFFICIAL_CALL_CHANGED", A]]);
  assert.ok(moved.races[r.id].alerts >= 1, "a changed call raises an alert");
  // the same call seen again changes nothing
  const again = step(moved, obs(A, "2026-11-04T03:00:15.730Z"), T("03:04"), "e");
  assert.equal(again.events.filter((e) => e.kind.startsWith("OFFICIAL")).length, 2);
});

test("key moments come only from the two states they lie between", () => {
  const meta = new Map<string, RaceMeta>(ix.races.map((r) => [r.id, { id: r.id, nm: r.nm, k: r.k, st: r.st, fav: r.pR == null ? null : Math.max(r.pR, 1 - r.pR) }]));
  const raws = (t: string) => [rawAt(hs[0], Date.parse(t))!] as CivicRawRace[];
  const st = (t: string, ledger: Parameters<typeof evaluate>[0]["ledger"]) => evaluate({ index: ix, pre, snapshot: snapshotFromCivic(ix, raws(t), { receivedAt: t, mode: "HISTORICAL", source: "t" }), ledger, t, cfg: { ...DEFAULT_CONFIG, draws: 300 } });
  const s0 = st(T("00:00"), null), s1 = st(T("00:20"), s0.ledger), s2 = st(T("03:00"), s1.ledger), s3 = st(T("03:02"), s2.ledger);
  assert.ok(Object.keys(s1.races).length > 900 && s1.racesObserved === 1, "one provider race matched: sen-SC");
  const m1 = momentsBetween(s0, s1, meta);
  assert.ok(m1.some((m) => m.kind === "FIRST_VOTES" && m.st === "SC"), "first returns in South Carolina");
  const m2 = momentsBetween(s1, s2, meta), m3 = momentsBetween(s2, s3, meta);
  // civicAPI called South Carolina at 02:58 and moved its call two minutes later. Both are on the ledger; neither
  // is a moment: the pages show On Point's calls only (2.5.0).
  assert.ok(s2.ledger.events.some((e) => e.kind === "OFFICIAL_CALL" && e.raceId === "sen-SC") && s3.ledger.events.some((e) => e.kind === "OFFICIAL_CALL_CHANGED" && e.raceId === "sen-SC"), "the provider's call and its change stay on the ledger");
  assert.ok(![...m1, ...m2, ...m3].some((m) => m.kind.startsWith("OFFICIAL_")), "no moment is made from a provider call");
  assert.ok(![...m1, ...m2, ...m3].some((m) => /civicAPI calls|civicAPI moves/.test(m.title)));
  assert.equal(momentsBetween(s3, s3, meta).length, 0, "no change, no moments");
  for (const m of [...m1, ...m2, ...m3]) assert.ok(m.title.length > 8 && [1, 2, 3].includes(m.imp));
  const pc = pollCloseMoments([{ st: "SC", close: T("00:00") }, { st: "GA", close: T("00:00") }, { st: "FL", close: T("01:00") }], [T("00:00"), T("00:20"), T("01:02")]);
  assert.deepEqual(pc.map((m) => [m.t, m.at]), [[T("00:00"), T("00:00")], [T("01:02"), T("01:00")]], "a closing shows from the first frame at or after it");
  assert.match(pc[0].title, /Georgia, South Carolina/);
});

test("the engine draws from one fixed seed all night: the same data gives the same state whenever it is read", () => {
  const raws = [rawAt(hs[0], Date.parse(T("00:20")))!] as CivicRawRace[];
  const a = evaluate({ index: ix, pre, snapshot: snapshotFromCivic(ix, raws, { receivedAt: T("00:20"), mode: "HISTORICAL", source: "t" }), ledger: null, t: T("00:20"), cfg: { ...DEFAULT_CONFIG, draws: 300 } });
  const b = evaluate({ index: ix, pre, snapshot: snapshotFromCivic(ix, raws, { receivedAt: T("00:20"), mode: "HISTORICAL", source: "t" }), ledger: null, t: T("00:20"), cfg: { ...DEFAULT_CONFIG, draws: 300 } });
  assert.equal(a.stateId, b.stateId);
  // a race with no new data keeps its chance when another race reports (apart from what the national swing moves)
  const none = evaluate({ index: ix, pre, snapshot: snapshotFromCivic(ix, [], { receivedAt: T("00:00"), mode: "HISTORICAL", source: "t" }), ledger: null, t: T("00:00"), cfg: { ...DEFAULT_CONFIG, draws: 300 } });
  assert.ok(Math.abs(none.national.house.seats.D.mean - a.national.house.seats.D.mean) < 0.75, `one Senate race reporting barely moves the House projection: ${none.national.house.seats.D.mean} v ${a.national.house.seats.D.mean}`);
});

test("pinned provider races win over the matcher and only when present", () => {
  const civ: CRace[] = [
    { id: 86927, type: "Corporation Commission", province: "AZ", district: null, name: "Arizona Corporation Commission", pr: 10, c: [["Ralph Heap", "R", 5, 0, 0, null]] },
    { id: 155750, type: "University Board", province: "MI", district: null, name: "Michigan State University Board of Trustees", pr: 10, c: [["Brianna Scott", "D", 5, 0, 0, null]] },
    { id: 155748, type: "State Board of Education", province: "MI", district: null, name: "Michigan State Board of Education", pr: 10, c: [["Judith Pritchett", "D", 5, 0, 0, null]] },
  ];
  const m = matchCivic(ix.races, civ);
  assert.equal(m["psc-AZ"]?.id, 86927); assert.equal(m["edb-MI-michigan-state-university-board-of-trustees"]?.id, 155750); assert.equal(m["edb-MI-state-board-of-education"]?.id, 155748);
  assert.equal(m["edb-MI-university-of-michigan-board-of-regents"], undefined, "a pin with no provider race present matches nothing");
  for (const id of Object.keys(CIVIC_PINS)) assert.ok(ix.races.some((r) => r.id === id), `${id} is a race in the index`);
  assert.equal(new Set(Object.values(CIVIC_PINS)).size, Object.keys(CIVIC_PINS).length, "no provider race is pinned twice");
});

test("a frame rebuilt from the frame before it and its delta is the frame, value for value", () => {
  const raws = (t: string) => [rawAt(hs[0], Date.parse(t))!] as CivicRawRace[];
  const st = (t: string, ledger: Parameters<typeof evaluate>[0]["ledger"]) => evaluate({ index: ix, pre, snapshot: snapshotFromCivic(ix, raws(t), { receivedAt: t, mode: "HISTORICAL", source: "t" }), ledger, t, cfg: { ...DEFAULT_CONFIG, draws: 300 } });
  const s0 = st(T("00:00"), null), s1 = st(T("00:20"), s0.ledger), s2 = st(T("03:00"), s1.ledger), s3 = st(T("03:02"), s2.ledger);
  const views = [s0, s1, s2, s3].map((s) => JSON.parse(JSON.stringify(viewOf(s, "historical/t", false))) as ReturnType<typeof viewOf>);
  let cur = views[0];
  for (let i = 1; i < views.length; i++) {
    const d = JSON.parse(JSON.stringify(makeDelta(views[i - 1], views[i])));     // as it travels: through JSON
    assert.ok(isDelta(d) && !isDelta(views[i]));
    assert.ok(Object.keys(d.races).length < Object.keys(views[i].races).length / 2, `a delta carries only the rows that changed: ${Object.keys(d.races).length}`);
    cur = applyDelta(cur, d);
    assert.equal(canonicalJson(cur), canonicalJson(views[i]), `frame ${i}`);
  }
  assert.deepEqual(views[3].ledger.events.map((e) => e.seq), cur.ledger.events.map((e) => e.seq));
  // nothing is shared by reference with the delta in a way that lets a later frame alter an earlier one
  const before = canonicalJson(views[1]); applyDelta(views[1], makeDelta(views[1], views[3])); assert.equal(canonicalJson(views[1]), before);
});

test("the harness counts a confident miss: a chance at or above the threshold stated for someone who lost", () => {
  const snap = (t: string) => snapshotFromCivic(ix, [rawAt(hs[0], Date.parse(t))!] as CivicRawRace[], { receivedAt: t, mode: "HISTORICAL", source: "t" });
  const s1 = evaluate({ index: ix, pre, snapshot: snap(T("02:54")), ledger: null, t: T("02:54"), cfg: { ...DEFAULT_CONFIG, draws: 300 } });
  const row = s1.races["sen-SC"]; const lead = row.c.find((c) => c[0] === row.leaderId)!, other = row.c.find((c) => c[0] !== row.leaderId && c[6] != null)!;
  assert.ok((lead[6] as number) > 0.6, `the leader in the count is the favourite: ${lead[6]}`);
  const frames = [{ state: s1, snapshot: snap(T("02:54")) }];
  const run = (winnerId: string) => { const r = evaluateArchive(frames, { "sen-SC": { winnerId, marginPp: 4, certified: false, source: "test" } }, { sourceLabel: "t", blockers: [], pipelineTest: true, threshold: 0.6 }); return r.byHalf.A.overall.confidentWrong + r.byHalf.B.overall.confidentWrong; };
  assert.equal(run(lead[0]), 0, "the favourite won: no miss");
  assert.equal(run(other[0]), 1, "the favourite lost: one confident miss");
});
