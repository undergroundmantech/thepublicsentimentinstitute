// Race history: contract, series semantics, store and display performance. SYNTHETIC data except where a test says it reads the
// repository's frozen forecast dataset, which is real published history.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildChart, decimate, defaultRange, fmtLead, fmtProb, fmtPp, fmtStamp, fmtVotes, heldAt, HISTORY_SCHEMA, lastUpdated, prepareHistory, rangeHasData, rangeWindow, readoutAt, stepTime, timeTicks,
  windowSeries, zoneOffset, zonedToUtc, ELECTION_NIGHT_START,
  type HistoryCandidate, type HistoryPoint, type ModelOutputPoint, type ResultPoint, type Series, type SeriesPoint,
} from "../../app/lib/intelligence/raceHistory";
import { DEMO_NIGHT_START, DEMO_RACE_ID, syntheticNight, syntheticOutages } from "../../app/lib/intelligence/raceHistoryDemo";
import {
  frozenPointsFor, frozenRaceIds, loadFrozenDataset, loadRaceHistory, partyCode, readModelOutputs, recordModelOutput, resolveCandidate, resultPointsFrom, seedFrozenForecasts, type ModelOutputInput,
} from "../../app/lib/intelligence/raceHistoryStore";
import { foldObservations, readObservationRecords, recordObservation, type ObservationInput } from "../../app/lib/intelligence/capture";
import { MemoryStore } from "../../app/lib/intelligence/captureStore";
import { obs } from "./fixtures";

const SYN = { statuses: ["SYNTHETIC"] as const };
const night = (o?: Parameters<typeof syntheticNight>[0]) => prepareHistory(DEMO_RACE_ID, syntheticNight(o), { surface: "PREVIEW", ...SYN, outages: syntheticOutages(o) });
const iso = (t: number) => new Date(t).toISOString();

const CANDS: HistoryCandidate[] = [
  { id: "a", name: "Ann Able", party: "D", side: "A" },
  { id: "b", name: "Bo Baker", party: "R", side: "B" },
  { id: "c", name: "Cy Cole", party: "I", side: null },
];
const REF = { plus: "b", minus: "a" };

function model(id: string, at: string, over: Partial<ModelOutputPoint> = {}): ModelOutputPoint {
  return {
    schema: HISTORY_SCHEMA, kind: "MODEL_OUTPUT", pointId: id, raceId: "r1", observedAt: at, sourceTimestamp: null, sourceClass: "LIVE_PROJECTION", status: "LIVE", candidates: CANDS,
    revision: { status: "ORIGINAL", supersedes: null, note: null }, reporting: null, model: { id: "m", version: "1.0", snapshot: id, asOf: null },
    winProbability: { a: 0.6, b: 0.3, c: 0.1 }, winProbabilityBasis: "MULTI_CANDIDATE", margin: { pp: -1, reference: REF, low: -3, high: 1, intervalBasis: "p10-p90" },
    projectedFinalVotes: { a: 500, b: 480, c: 20 }, provenance: { origin: "test", ref: null },
    ...(over.sourceClass === "FROZEN_FORECAST" ? { publication: { class: "PUBLISHED" as const, publishedAt: at, evidence: "test deployment", revertedBy: null } } : {}), ...over,
  };
}
function result(id: string, at: string, votes: Record<string, number>, over: Partial<ResultPoint> = {}): ResultPoint {
  const total = Object.values(votes).reduce((x, y) => x + y, 0);
  return {
    schema: HISTORY_SCHEMA, kind: "RESULT_OBSERVATION", pointId: id, raceId: "r1", observedAt: at, sourceTimestamp: at, sourceClass: "RESULT_FEED", status: "LIVE", candidates: CANDS,
    revision: { status: "ORIGINAL", supersedes: null, note: null }, reporting: { pct: 10, definition: "provider" }, provider: "feed", reportedVotes: votes,
    countedMargin: { pp: ((votes.b - votes.a) / total) * 100, reference: REF }, totalsDecreased: false, outOfOrder: false, confirmedThrough: null, provenance: { origin: "test", ref: null }, ...over,
  };
}
const prep = (pts: HistoryPoint[], surface: "PUBLIC" | "PREVIEW" = "PUBLIC") => prepareHistory("r1", pts, { surface });
const T = "2026-11-04T02:00:00Z";
const at = (min: number) => iso(Date.parse(T) + min * 60_000);

// ---- the contract and the frozen dataset ---------------------------------------------------------------------------------

test("the frozen dataset reproduces the pinned baseline exactly and keeps third parties without inventing probabilities", () => {
  const baseline = JSON.parse(readFileSync(path.join(process.cwd(), "data/intelligence/baseline/2026-10-25.json"), "utf8")) as { races: { raceId: string; margin: number; probB: number; p10: number; p90: number }[] };
  const ids = new Set(frozenRaceIds());
  assert.equal(ids.size, 506);
  // The baseline was pinned from commit d1738e7e; later published snapshots move the figures on, so compare as of that commit.
  const cut = Date.parse(loadFrozenDataset().snapshots.find((s) => s.commit.startsWith("d1738e7e"))!.committedAt);
  for (const b of baseline.races) {
    const last = frozenPointsFor(b.raceId, undefined, "ALL").filter((p) => Date.parse(p.observedAt) <= cut).at(-1)!;
    assert.equal(last.margin?.pp, b.margin, b.raceId);
    assert.equal(last.margin?.low, b.p10);
    assert.equal(last.margin?.high, b.p90);
    const gop = last.margin!.reference.plus;
    assert.equal(last.winProbability![gop], b.probB, b.raceId);
  }
  const ia = frozenPointsFor("sen-IA");
  assert.ok(ia.length > 5);
  const last = ia.at(-1)!;
  const third = last.candidates.find((c) => c.party === "L")!;
  assert.ok(third, "the Libertarian candidate is kept");
  assert.ok(!(third.id in last.winProbability!), "no probability is invented for a candidate the model does not price");
  assert.ok(last.projectedFinalVotes![third.id]! > 0);
  const [dem, gop] = [last.candidates.find((c) => c.side === "A")!, last.candidates.find((c) => c.side === "B")!];
  assert.ok(Math.abs(last.winProbability![dem.id]! + last.winProbability![gop.id]! - 1) < 1e-9);
  assert.equal(last.winProbabilityBasis, "TWO_SIDE");
  assert.equal(last.model.version, "UNVERSIONED");
  assert.ok(Date.parse(last.observedAt) > Date.parse(ia[0].observedAt));
  assert.ok(ia.every((p) => p.sourceClass === "FROZEN_FORECAST" && p.sourceTimestamp === null && p.revision.status === "ORIGINAL"));
});

test("a top-two race with no candidate list still has both sides, with no party invented", () => {
  const p = frozenPointsFor("house-CA-04").at(-1)!;
  assert.deepEqual(p.candidates.map((c) => c.side).sort(), ["A", "B"]);
  assert.ok(p.candidates.every((c) => c.party === null));
  assert.equal(p.projectedFinalVotes, null);
});

test("every point passes validation and ids are unique", () => {
  const d = loadFrozenDataset();
  assert.ok(d.snapshots.length >= 40);
  const seen = new Set<string>();
  for (const id of frozenRaceIds().slice(0, 120)) for (const p of frozenPointsFor(id)) { assert.ok(!seen.has(p.pointId)); seen.add(p.pointId); }
  const prepared = prepareHistory("sen-IA", frozenPointsFor("sen-IA"), { surface: "PUBLIC" });
  assert.equal(prepared.excluded.invalid, 0);
  assert.ok(prepared.finalFrozenIndex === prepared.models.length - 1);
});

test("public frozen history is published-only, timed by go-live, and starts at the first verified publication", () => {
  const d = loadFrozenDataset();
  assert.equal(d.schema, "TPSI_FROZEN_FORECAST_HISTORY/2");
  const live = new Set(d.publications.map((e) => e.liveAt));
  const first = Date.parse(d.publications[0].liveAt);
  const unpublished = new Set(d.snapshots.filter((s) => s.class !== "PUBLISHED").map((s) => s.snapshot));
  assert.ok(unpublished.size >= 1, "the dataset carries at least one snapshot never verified as published");
  let sawUnverified = false;
  for (const id of frozenRaceIds().slice(0, 200)) {
    const pub = frozenPointsFor(id);
    for (let i = 0; i < pub.length; i++) {
      const p = pub[i];
      assert.equal(p.publication?.class, "PUBLISHED", id);
      assert.ok(live.has(p.observedAt), `${id} point is timed at a deployment go-live`);
      assert.ok(Date.parse(p.observedAt) >= first);
      assert.ok(!unpublished.has(p.model.snapshot), `${id} shows an unverified snapshot`);
      if (i) assert.ok(Date.parse(p.observedAt) > Date.parse(pub[i - 1].observedAt), `${id} out of order`);
    }
    const all = frozenPointsFor(id, undefined, "ALL");
    for (let i = 1; i < all.length; i++) assert.ok(Date.parse(all[i].observedAt) >= Date.parse(all[i - 1].observedAt));
    if (all.some((p) => p.publication?.class === "UNVERIFIED")) {
      sawUnverified = true;
      const pubSurface = prepareHistory(id, all, { surface: "PUBLIC" });
      assert.ok(pubSurface.excluded.unpublished > 0);
      assert.ok(pubSurface.models.every((m) => m.publication?.class === "PUBLISHED"));
      assert.equal(prepareHistory(id, all, { surface: "PREVIEW" }).excluded.unpublished, 0);
    }
  }
  assert.ok(sawUnverified, "diagnostic mode exposes unverified snapshots for at least one race");
  // A frozen point with no publication evidence never reaches a public chart.
  const bare = model("f1", T, { sourceClass: "FROZEN_FORECAST", publication: undefined, model: { id: "m", version: "UNVERSIONED", snapshot: "x", asOf: null } });
  assert.equal(prep([bare]).models.length, 0);
  assert.equal(prep([bare], "PREVIEW").models.length, 1);
});

test("a published forecast that was later reverted remains published history", () => {
  const d = loadFrozenDataset();
  const s = d.snapshots.find((x) => x.commit.startsWith("d6010cb6"))!;
  assert.equal(s.class, "PUBLISHED");
  assert.ok(s.publishedAt && s.deployment);
  assert.ok(s.revertedBy?.startsWith("50cc9fd9"));
  const marked = frozenRaceIds().some((id) => frozenPointsFor(id).some((p) => p.publication?.revertedBy === s.revertedBy));
  assert.ok(marked, "the reverted publication is still drawn, marked as later reverted");
});

test("recording refuses non-durable storage inside a deployment", async () => {
  const prev = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    const input = { ...model("x", T), raceId: "sen-GA" } as unknown as ModelOutputInput;
    await assert.rejects(recordModelOutput(new MemoryStore(), input), (e: Error & { code?: string }) => e.code === "EPHEMERAL_STORE");
  } finally {
    if (prev === undefined) delete process.env.VERCEL; else process.env.VERCEL = prev;
  }
});

// ---- series semantics --------------------------------------------------------------------------------------------------------

test("multiple candidates: one probability series per priced candidate, and an unpriced one is listed, not drawn as zero", () => {
  const two = model("m1", at(0), { winProbability: { a: 0.62, b: 0.38 }, winProbabilityBasis: "TWO_SIDE" });
  const c = buildChart(prep([two]), "prob");
  assert.deepEqual(c.series.map((s) => s.candidateId).sort(), ["a", "b"]);
  assert.deepEqual(c.notShown.map((n) => n.candidateId), ["c"]);
  const full = buildChart(prep([model("m1", at(0))]), "prob");
  assert.equal(full.series.length, 3);
  assert.deepEqual(full.yDomain, [0, 100]);
  const votes = buildChart(prep([result("r1", at(0), { a: 100, b: 90, c: 5 })]), "votes");
  assert.equal(votes.series.filter((s) => s.dash === "SOLID").length, 3);
});

test("a missing probability is a gap: the line stops, nothing is filled in, and the readout is empty", () => {
  const pts = [model("m1", at(0)), model("m2", at(10), { winProbability: null, winProbabilityBasis: null }), model("m3", at(20), { winProbability: { a: 0.7, b: 0.2, c: 0.1 } })];
  const c = buildChart(prep(pts), "prob");
  const a = c.series.find((s) => s.candidateId === "a")!;
  assert.deepEqual(a.pts.map((q) => q.v), [60, null, 70]);
  assert.equal(heldAt(a, Date.parse(at(5)))!.point.v, 60);
  assert.equal(heldAt(a, Date.parse(at(15))), null, "no value is shown inside the gap");
  assert.equal(heldAt(a, Date.parse(at(25)))!.point.v, 70);
  assert.equal(readoutAt(c, prep(pts), Date.parse(at(15))).rows.find((r) => r.seriesKey.includes(":a:"))!.value, null);
  const margin = buildChart(prep([model("m1", at(0)), model("m2", at(10), { margin: null }), model("m3", at(20))]), "margin");
  assert.deepEqual(margin.series[0].pts.map((q) => q.v === null), [false, true, false]);
});

test("no live data: only the frozen forecast shows, election night is unavailable and the default range is All", () => {
  const frozen = [model("f1", "2026-10-20T15:00:00Z", { sourceClass: "FROZEN_FORECAST" }), model("f2", "2026-10-25T15:00:00Z", { sourceClass: "FROZEN_FORECAST" })];
  const p = prep(frozen);
  for (const ch of ["prob", "margin", "votes"] as const) { const c = buildChart(p, ch); assert.ok(c.series.every((s) => s.phase === "FROZEN"), ch); }
  const prob = buildChart(p, "prob");
  assert.equal(rangeHasData(prob, "NIGHT", p.bounds), false);
  assert.equal(rangeHasData(prob, "ALL", p.bounds), true);
  assert.equal(defaultRange(prob, p.bounds), "ALL");
  assert.equal(p.results.length, 0);
  assert.ok(buildChart(p, "votes").series.every((s) => s.dash === "DASHED"), "frozen votes are estimates, never reported counts");
  const empty = buildChart(prep([]), "prob");
  assert.ok(empty.emptyReason);
  assert.equal(empty.series.length, 0);
  assert.ok(buildChart(prep([]), "margin").emptyReason);
  assert.ok(buildChart(prep([]), "votes").emptyReason);
});

test("pre-election baseline transitions to live: the frozen figure stands until the first live projection, with markers for both", () => {
  const f = model("f1", "2026-11-03T15:00:00Z", { sourceClass: "FROZEN_FORECAST", winProbability: { a: 0.55, b: 0.4, c: 0.05 } });
  const l1 = model("l1", "2026-11-04T01:00:00Z", { winProbability: { a: 0.4, b: 0.55, c: 0.05 } });
  const p = prep([l1, f]);
  const c = buildChart(p, "prob");
  assert.deepEqual(c.markers.map((m) => m.kind), ["FREEZE", "LIVE_START"]);
  const frozen = c.series.find((s) => s.key === "prob:a:FROZEN")!, live = c.series.find((s) => s.key === "prob:a:LIVE")!;
  assert.equal(frozen.extendTo, Date.parse("2026-11-04T01:00:00Z"));
  assert.equal(heldAt(frozen, Date.parse("2026-11-04T00:30:00Z"))!.point.v, 55);
  assert.equal(heldAt(frozen, Date.parse("2026-11-04T01:30:00Z")), null, "the frozen forecast is not carried past the first live projection");
  assert.equal(heldAt(live, Date.parse("2026-11-04T00:30:00Z")), null, "no live value before there is one");
  assert.equal(heldAt(live, Date.parse("2026-11-04T01:30:00Z"))!.point.v, 40);
  assert.ok(c.series.every((s) => s.phase !== "FROZEN" || s.key.endsWith("FROZEN")));
});

test("model revisions: the same snapshot with different figures is a REVISION, and a version change gets a marker", () => {
  const a = model("m1", at(0), { model: { id: "m", version: "1.0", snapshot: "S1", asOf: null } });
  const b = model("m2", at(5), { model: { id: "m", version: "1.0", snapshot: "S1", asOf: null }, winProbability: { a: 0.5, b: 0.4, c: 0.1 } });
  const c = model("m3", at(10), { model: { id: "m", version: "2.0", snapshot: "S2", asOf: null } });
  const p = prep([a, b, c]);
  assert.deepEqual(p.models.map((m) => m.revision.status), ["ORIGINAL", "REVISION", "ORIGINAL"]);
  assert.equal(p.models[1].revision.supersedes, "m1");
  const chart = buildChart(p, "prob");
  assert.deepEqual(chart.markers.filter((m) => m.kind === "MODEL_VERSION").map((m) => m.label), ["Model 2.0"]);
  assert.equal(chart.series[0].pts[1].flag, "REVISION");
  // the unversioned frozen history never produces version markers
  const f = [model("f1", at(-9000), { sourceClass: "FROZEN_FORECAST", model: { id: "m", version: "UNVERSIONED", snapshot: "x", asOf: null } }), model("f2", at(-8000), { sourceClass: "FROZEN_FORECAST", model: { id: "m", version: "UNVERSIONED", snapshot: "y", asOf: null } })];
  assert.equal(buildChart(prep(f), "prob").markers.filter((m) => m.kind === "MODEL_VERSION").length, 0);
});

test("vote totals: a downward correction is kept and flagged, estimated and reported series are never merged", () => {
  const pts = [
    result("r1", at(0), { a: 1000, b: 900, c: 50 }), result("r2", at(5), { a: 1200, b: 1100, c: 60 }),
    result("r3", at(10), { a: 1200, b: 1000, c: 60 }, { totalsDecreased: true, revision: { status: "CORRECTION", supersedes: "r2", note: null } }), result("r4", at(15), { a: 1300, b: 1100, c: 70 }),
    model("m1", at(2)),
  ];
  const c = buildChart(prep(pts), "votes");
  const b = c.series.find((s) => s.key === "votes:b:reported")!;
  assert.deepEqual(b.pts.map((q) => q.v), [900, 1100, 1000, 1100]);
  assert.equal(b.pts[2].flag, "DECREASE");
  assert.equal(b.dash, "SOLID");
  const est = c.series.find((s) => s.key === "votes:b:est:LIVE")!;
  assert.equal(est.dash, "DASHED");
  assert.deepEqual(est.pts.map((q) => q.v), [480]);
  assert.ok(c.series.every((s) => (s.source === "RESULT") === (s.dash === "SOLID")));
  // and through the real recorder
});

test("margin: projected and counted margins are separate series, the interval exists only where the model published one, and the zero line is in range", () => {
  const pts = [model("m1", at(0)), model("m2", at(10), { margin: { pp: 2, reference: REF, low: null, high: null, intervalBasis: null } }), result("r1", at(5), { a: 100, b: 120, c: 5 })];
  const c = buildChart(prep(pts), "margin");
  assert.deepEqual(c.series.map((s) => s.key), ["margin:LIVE", "margin:counted"]);
  const proj = c.series[0];
  assert.equal(proj.band, true);
  assert.equal(proj.pts[0].lo, -3);
  assert.equal(proj.pts[1].lo, null);
  assert.equal(c.series[1].dash, "DASHED");
  assert.ok(c.yDomain[0] < 0 && c.yDomain[1] > 0 && c.yDomain[0] === -c.yDomain[1]);
  assert.ok(c.series[1].meaning.includes("Not a projection"));
});

test("margin reference: a point stated with the sides swapped is aligned to the latest reference, with its interval swapped too", () => {
  const swapped = model("m1", at(0), { margin: { pp: 2, reference: { plus: "a", minus: "b" }, low: 1, high: 4, intervalBasis: "x" } });
  const latest = model("m2", at(10), { margin: { pp: -1, reference: REF, low: -2, high: 0, intervalBasis: "x" } });
  const c = buildChart(prep([swapped, latest]), "margin");
  assert.deepEqual(c.series[0].pts.map((q) => [q.v, q.lo, q.hi]), [[-2, -4, -1], [-1, -2, 0]]);
  assert.equal(fmtLead(-2, c.reference), "D +2.0");
  assert.equal(fmtLead(1.26, c.reference), "R +1.3");
  assert.equal(fmtLead(0.01, c.reference), "Even");
});

test("out-of-order and shuffled input is ordered by observation time and flagged, never rewritten", () => {
  const pts = [result("r3", at(10), { a: 3, b: 3, c: 0 }), result("r1", at(0), { a: 1, b: 1, c: 0 }), result("r2", at(5), { a: 2, b: 2, c: 0 })];
  const p = prep(pts);
  assert.deepEqual(p.results.map((r) => r.pointId), ["r1", "r2", "r3"]);
  const late = prep([result("r1", at(0), { a: 1, b: 1, c: 0 }), result("r2", at(5), { a: 2, b: 2, c: 0 }, { sourceTimestamp: at(-30), outOfOrder: true })]);
  assert.equal(late.outOfOrder, 1);
  assert.equal(buildChart(late, "votes").series[0].pts[1].flag, "OUT_OF_ORDER");
  const dup = prep([result("r1", at(0), { a: 1, b: 1, c: 0 }), result("r1", at(0), { a: 1, b: 1, c: 0 })]);
  assert.equal(dup.excluded.duplicate, 1);
  assert.equal(dup.results.length, 1);
});

test("sparse observations: a reported value stands until the next update, and the readout says what was known then", () => {
  const sparse = prep([result("r1", at(0), { a: 10, b: 10, c: 0 }), result("r2", at(180), { a: 90, b: 80, c: 0 })]);
  const vc = buildChart(sparse, "votes");
  const s = vc.series[0];
  assert.equal(heldAt(s, Date.parse(at(60)))!.point.v, 10, "a quiet count is still the last reported count, not missing");
  assert.equal(heldAt(s, Date.parse(at(181)))!.point.v, 90);
  const w = windowSeries(s, Date.parse(at(60)), Date.parse(at(200)));
  assert.equal(w[0].carried, true);
  assert.deepEqual(readoutAt(vc, sparse, Date.parse(at(0))).rows[0].freshness, { kind: "NEW" });
  assert.deepEqual(readoutAt(vc, sparse, Date.parse(at(60))).rows[0].freshness, { kind: "NO_NEW", since: Date.parse(at(0)) });
  // re-confirmation is only claimed once it has happened: before confirmedThrough the readout must not use that later knowledge
  const held = prep([result("r1", at(0), { a: 10, b: 10, c: 0 }, { confirmedThrough: at(100) }), result("r2", at(110), { a: 11, b: 10, c: 0 })]);
  const hc = buildChart(held, "votes");
  assert.deepEqual(readoutAt(hc, held, Date.parse(at(50))).rows[0].freshness, { kind: "NO_NEW", since: Date.parse(at(0)) });
  assert.deepEqual(readoutAt(hc, held, Date.parse(at(105))).rows[0].freshness, { kind: "CONFIRMED", at: Date.parse(at(100)) });
  assert.equal(heldAt(hc.series[0], Date.parse(at(125)))!.point.v, 11);
  assert.equal(lastUpdated(held), Date.parse(at(110)));
  assert.equal(lastUpdated(prep([result("r1", at(0), { a: 1, b: 1, c: 0 }, { confirmedThrough: at(40) })])), Date.parse(at(40)));
  // a null value is a known gap and still breaks the line
  const gap = buildChart(prep([result("r1", at(0), { a: 10, b: 10, c: 0 }), result("r2", at(30), { b: 12, c: 0 }, { countedMargin: null }), result("r3", at(60), { a: 20, b: 10, c: 0 })]), "votes");
  assert.equal(heldAt(gap.series[0], Date.parse(at(45))), null);
});

test("a known source outage is marked and named in the readout; nothing is drawn inside it", () => {
  const pts = [result("r1", at(0), { a: 10, b: 10, c: 0 }), result("r2", at(90), { a: 30, b: 20, c: 0 })];
  const p = prepareHistory("r1", pts, { surface: "PUBLIC", outages: [{ provider: "feed", from: at(20), to: at(80), reason: "feed returned errors" }, { provider: "feed", from: "bad", to: null, reason: "x" }] });
  assert.equal(p.outages.length, 1, "an unparseable outage is dropped");
  const c = buildChart(p, "votes");
  const f = readoutAt(c, p, Date.parse(at(40))).rows[0].freshness;
  assert.deepEqual(f, { kind: "SOURCE_UNAVAILABLE", since: Date.parse(at(20)), reason: "feed returned errors" });
  assert.deepEqual(readoutAt(c, p, Date.parse(at(85))).rows[0].freshness, { kind: "NO_NEW", since: Date.parse(at(0)) });
  assert.equal(c.series[0].pts.length, 2, "the outage adds no points");
});

test("an early lopsided count cannot flatten the forecast: the margin scale is capped and the count is marked off scale", () => {
  const ms = [model("m1", at(0), { margin: { pp: 2, reference: REF, low: -1, high: 5, intervalBasis: "p10-p90" } })];
  const rs = [result("r1", at(10), { a: 5, b: 95, c: 0 })];
  const c = buildChart(prep([...ms, ...rs]), "margin");
  const counted = c.series.find((s) => s.source === "RESULT")!;
  assert.ok(counted.pts[0].v! > 80);
  assert.ok(c.yDomain[1] < 30, `domain ${c.yDomain} follows the forecast, not the 90-point count`);
  const near = buildChart(prep([...ms, result("r1", at(10), { a: 45, b: 55, c: 0 })]), "margin");
  assert.ok(near.yDomain[1] >= 10, "a count within reach still fits on the scale");
  const only = buildChart(prep(rs), "margin");
  assert.ok(only.yDomain[1] >= 90, "with no forecast, the count sets the scale");
});

test("chart colors are theme tokens, not fixed values", () => {
  const p = night();
  for (const ch of ["prob", "margin", "votes"] as const) for (const s of buildChart(p, ch).series) assert.match(s.color, /^var\(--rh-[a-z0-9]+\)$/, `${ch} ${s.key}`);
});

test("shadow separation: never on a public surface, never in a public series, and apart and labelled in the preview", () => {
  const all = syntheticNight();
  const pub = prepareHistory(DEMO_RACE_ID, all, { surface: "PUBLIC", statuses: ["SYNTHETIC"] });
  assert.equal(pub.shadow.length, 0);
  assert.ok(pub.excluded.shadow > 10);
  assert.ok(pub.models.every((m) => m.sourceClass !== "SHADOW_MODEL"));
  for (const ch of ["prob", "margin", "votes"] as const) {
    const c = buildChart(pub, ch, { overlayShadow: true });
    assert.ok(c.series.every((s) => s.phase !== "SHADOW" && s.source !== "SHADOW"), `${ch} public`);
  }
  const prev = prepareHistory(DEMO_RACE_ID, all, { surface: "PREVIEW", ...SYN });
  assert.ok(prev.shadow.length > 10);
  assert.ok(prev.models.every((m) => m.sourceClass !== "SHADOW_MODEL"));
  for (const ch of ["prob", "margin"] as const) {
    assert.ok(buildChart(prev, ch).series.every((s) => s.phase !== "SHADOW"), `${ch} preview without the overlay`);
    const o = buildChart(prev, ch, { overlayShadow: true });
    assert.ok(o.series.some((s) => s.phase === "SHADOW" && s.source === "SHADOW"), `${ch} overlay`);
    assert.ok(o.series.filter((s) => s.phase === "SHADOW").every((s) => /not published/i.test(s.meaning)));
  }
  // the live series never absorb a shadow value
  const live = buildChart(prev, "prob", { overlayShadow: true }).series.find((s) => s.key === "prob:alvarez:LIVE")!;
  assert.equal(live.pts.length, prev.models.filter((m) => m.sourceClass === "LIVE_PROJECTION").length);
});

test("test and synthetic data are excluded unless asked for, and counted", () => {
  const pts = [model("m1", at(0)), model("m2", at(1), { status: "TEST" }), model("m3", at(2), { status: "SYNTHETIC" }), result("r1", at(3), { a: 1, b: 1, c: 0 }, { status: "NOT_PROVIDED" })];
  const pub = prep(pts);
  assert.equal(pub.models.length, 1);
  assert.equal(pub.results.length, 1, "a feed that states neither live nor test is admitted and labelled by its status");
  assert.deepEqual(pub.excluded.status, { TEST: 1, SYNTHETIC: 1 });
  assert.equal(prepareHistory("r1", pts, { surface: "PUBLIC", statuses: ["LIVE", "TEST"] }).models.length, 2);
});

test("invalid points are dropped and counted, not charted", () => {
  const pts = [model("m1", at(0)), model("bad1", at(1), { winProbability: { a: 1.4, b: 0, c: 0 } }), model("bad2", at(2), { winProbability: { a: 0.7, b: 0.7, c: 0 } }), result("bad3", at(3), { a: -5, b: 1, c: 0 }), model("bad4", "not a date")];
  const p = prep(pts);
  assert.equal(p.excluded.invalid, 4);
  assert.equal(p.models.length, 1);
});

// ---- time zones ---------------------------------------------------------------------------------------------------------------

test("time zones: the same instant reads correctly in ET, UTC and across the November change from EDT to EST", () => {
  const t = Date.parse("2026-11-04T01:30:00Z");
  assert.equal(fmtStamp(t, "America/New_York"), "Nov 3 8:30 PM EST");
  assert.equal(fmtStamp(t, "UTC"), "Nov 4 1:30 AM UTC");
  assert.equal(fmtStamp(Date.parse("2026-10-31T23:30:00Z"), "America/New_York"), "Oct 31 7:30 PM EDT");
  assert.equal(zoneOffset(Date.parse("2026-10-31T12:00:00Z"), "America/New_York"), -4 * 3_600_000);
  assert.equal(zoneOffset(Date.parse("2026-11-02T12:00:00Z"), "America/New_York"), -5 * 3_600_000);
  assert.equal(zoneOffset(t, "UTC"), 0);
  assert.equal(iso(zonedToUtc(2026, 11, 1, 0, 0, "America/New_York")), "2026-11-01T04:00:00.000Z");
  assert.equal(iso(zonedToUtc(2026, 11, 2, 0, 0, "America/New_York")), "2026-11-02T05:00:00.000Z");
  assert.equal(ELECTION_NIGHT_START, zonedToUtc(2026, 11, 3, 16, 0, "America/New_York"));
});

test("time axis ticks sit on the zone's own midnights, including the 25-hour day, and on whole hours on election night", () => {
  const t0 = Date.parse("2026-10-31T12:00:00Z"), t1 = Date.parse("2026-11-03T12:00:00Z");
  const days = timeTicks(t0, t1, "America/New_York", 6);
  assert.deepEqual(days.map((d) => iso(d.t)), ["2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z", "2026-11-03T05:00:00.000Z"]);
  assert.deepEqual(days.map((d) => d.label), ["Nov 1", "Nov 2", "Nov 3"]);
  const hours = timeTicks(Date.parse("2026-11-04T00:00:00Z"), Date.parse("2026-11-04T08:00:00Z"), "America/New_York", 9);
  assert.ok(hours.length >= 4 && hours.length <= 9);
  assert.ok(hours.every((h) => new Date(h.t).getUTCMinutes() === 0));
  assert.equal(hours[0].label, "7\u202fPM");
  const utc = timeTicks(Date.parse("2026-11-04T00:00:00Z"), Date.parse("2026-11-04T08:00:00Z"), "UTC", 9);
  assert.equal(utc[0].label, "Nov 4", "midnight UTC is a date tick");
  const all = timeTicks(Date.parse("2026-09-23T00:00:00Z"), Date.parse("2026-11-03T00:00:00Z"), "America/New_York", 7);
  assert.ok(all.length <= 8 && all.length >= 3);
});

test("range windows follow the data, election night opens at 4 PM ET, and a lone point still has a visible span", () => {
  const p = night();
  assert.deepEqual(rangeWindow("NIGHT", p.bounds)[0], ELECTION_NIGHT_START);
  const [a, b] = rangeWindow("24H", p.bounds);
  assert.equal(b - a, 86_400_000);
  const [x, y] = rangeWindow("ALL", [1_000_000, 1_000_000]);
  assert.ok(y - x >= 3_600_000);
  assert.deepEqual(rangeWindow("NIGHT", null), [ELECTION_NIGHT_START, ELECTION_NIGHT_START + 12 * 3_600_000]);
});

test("formatting: percentages, percentage points and vote counts", () => {
  assert.equal(fmtProb(62.4), "62%");
  assert.equal(fmtProb(0.3), "<1%");
  assert.equal(fmtProb(99.6), ">99%");
  assert.equal(fmtProb(null), "—");
  assert.equal(fmtPp(1.234), "+1.2 pp");
  assert.equal(fmtPp(-0.04), "−0.0 pp");
  assert.equal(fmtPp(0), "0.0 pp");
  assert.equal(fmtVotes(1234567), "1,234,567");
  assert.equal(fmtVotes(null), "—");
});

// ---- the synthetic night end to end ----------------------------------------------------------------------------------------

test("the synthetic night shows every case the charts must handle", () => {
  const p = night();
  assert.ok(p.models.some((m) => m.sourceClass === "FROZEN_FORECAST") && p.models.some((m) => m.sourceClass === "LIVE_PROJECTION"));
  const prob = buildChart(p, "prob");
  const live = prob.series.find((s) => s.key === "prob:alvarez:LIVE")!;
  assert.deepEqual(live.pts.slice(0, 3).map((q) => q.v), [null, null, null], "the first live projections have no valid probability");
  assert.ok(live.pts[3].v !== null);
  assert.equal(prob.series.filter((s) => s.phase === "LIVE").length, 3);
  assert.equal(prob.markers.some((m) => m.kind === "MODEL_VERSION"), true);
  const votes = buildChart(p, "votes");
  assert.ok(votes.series.find((s) => s.key === "votes:brandt:reported")!.pts.some((q) => q.flag === "DECREASE"));
  assert.ok(p.results.some((r) => r.outOfOrder) && p.results.some((r) => r.sourceTimestamp === null));
  const brandt = votes.series.find((s) => s.key === "votes:brandt:reported")!;
  // the 40-minute outage is declared: the last count stands, and the readout says the source was unavailable
  const gapStart = brandt.pts[39].t;
  assert.equal(heldAt(brandt, gapStart + 30 * 60_000)!.point.t, gapStart);
  assert.equal(readoutAt(votes, p, gapStart + 30 * 60_000).rows.find((r) => r.seriesKey === brandt.key)!.freshness?.kind, "SOURCE_UNAVAILABLE");
  const margin = buildChart(p, "margin");
  assert.equal(margin.reference!.plus.id, "brandt");
  assert.ok(margin.series.some((s) => s.key === "margin:counted"));
});

test("the cursor readout names the figure's time, source class and model", () => {
  const p = night();
  const c = buildChart(p, "prob");
  const t = DEMO_NIGHT_START + 3 * 3_600_000;
  const r = readoutAt(c, p, t);
  const row = r.rows.find((x) => x.seriesKey === "prob:brandt:LIVE")!;
  assert.ok(row.value !== null && row.asOf !== null && row.asOf <= t);
  assert.equal((row.source as ModelOutputPoint).sourceClass, "LIVE_PROJECTION");
  assert.ok((row.source as ModelOutputPoint).model.version);
  const before = readoutAt(c, p, DEMO_NIGHT_START - 20 * 86_400_000);
  assert.ok(before.rows.every((x) => x.value === null));
  assert.equal(stepTime(c.times, null, 1), c.times[0]);
  assert.equal(stepTime(c.times, c.times[3], 1), c.times[4]);
  assert.equal(stepTime(c.times, c.times[3], -1), c.times[2]);
  assert.equal(stepTime(c.times, c.times[0], -1), c.times[0]);
  assert.equal(stepTime(c.times, c.times.at(-1)!, 1), c.times.at(-1));
});

// ---- display performance ----------------------------------------------------------------------------------------------------

test("thousands of observations: building, windowing and decimating stay fast, and extremes and corrections survive", () => {
  const N = 20_000;
  const pts: HistoryPoint[] = [];
  let a = 0, b = 0;
  for (let i = 0; i < N; i++) {
    const t = DEMO_NIGHT_START + i * 1000; // one a second
    a += 3 + (i % 7); b += 2 + (i % 5);
    if (i === 12_345) b -= 5_000; // a correction in the middle of a dense run
    pts.push(result(`r${i}`, iso(t), { a, b, c: Math.floor(i / 9) }, { totalsDecreased: i === 12_345, confirmedThrough: null }));
    if (i % 4 === 0) pts.push(model(`m${i}`, iso(t), { winProbability: { a: 0.5 + Math.sin(i / 900) * 0.4, b: 0.4 - Math.sin(i / 900) * 0.4, c: 0.1 } }));
  }
  const t0 = performance.now();
  const p = prepareHistory("r1", pts, { surface: "PUBLIC" });
  const prob = buildChart(p, "prob"), votes = buildChart(p, "votes"), margin = buildChart(p, "margin");
  const [w0, w1] = rangeWindow("ALL", p.bounds);
  const cols = 900;
  const shown = [prob, votes, margin].flatMap((c) => c.series.map((s) => decimate(windowSeries(s, w0, w1), w0, w1, cols)));
  const ms = performance.now() - t0;
  assert.ok(ms < 3000, `built in ${ms.toFixed(0)} ms`);
  assert.equal(p.results.length, N);
  assert.equal(p.models.length, N / 4);
  for (const s of shown) assert.ok(s.length <= cols * 4 + 8, `a series is reduced to ${s.length} points`);
  // the full-resolution history is untouched by display decimation
  assert.equal(votes.series.find((s) => s.key === "votes:b:reported")!.pts.length, N);
  const bSeries = votes.series.find((s) => s.key === "votes:b:reported")!;
  const bShown = decimate(windowSeries(bSeries, w0, w1), w0, w1, cols);
  assert.ok(bShown.some((q) => q.flag === "DECREASE" && q.v === bSeries.pts[12_345].v), "the downward correction survives decimation");
  // min and max of a smooth series survive
  const pa = prob.series.find((s) => s.key === "prob:a:LIVE")!;
  const da = decimate(windowSeries(pa, w0, w1), w0, w1, cols);
  const vals = pa.pts.map((q) => q.v as number);
  assert.equal(Math.max(...da.map((q) => q.v as number)), Math.max(...vals));
  assert.equal(Math.min(...da.map((q) => q.v as number)), Math.min(...vals));
  const t1 = performance.now();
  const s = votes.series[0];
  for (let i = 0; i < 20_000; i++) heldAt(s, DEMO_NIGHT_START + (i % N) * 1000);
  assert.ok(performance.now() - t1 < 500, "cursor lookups are binary searches");
});

test("decimation never drops a gap or a flagged point", () => {
  const pts: SeriesPoint[] = [];
  for (let i = 0; i < 5000; i++) pts.push({ t: i, v: i === 2500 ? null : i === 3000 ? 10 : 100 + (i % 10), src: i, ...(i === 3000 ? { flag: "DECREASE" as const } : {}) });
  const d = decimate(pts, 0, 5000, 50);
  assert.ok(d.length < pts.length);
  assert.ok(d.some((q) => q.v === null));
  assert.ok(d.some((q) => q.flag === "DECREASE"));
  assert.equal(d[0].t, 0);
  assert.equal(d.at(-1)!.t, 4999);
  assert.deepEqual(d.map((q) => q.t), [...d.map((q) => q.t)].sort((x, y) => x - y));
  const s: Series = { key: "k", candidateId: null, label: "", color: "", dash: "SOLID", phase: "LIVE", source: "RESULT", meaning: "", breakAfterMs: null, extendTo: null, band: false, pts };
  assert.equal(decimate(windowSeries(s, 0, 100), 0, 100, 1000).length, 101);
});

// ---- the stores ---------------------------------------------------------------------------------------------------------------

const liveInput = (over: Partial<ModelOutputInput> = {}): ModelOutputInput => {
  const { schema: _s, pointId: _p, kind: _k, ...rest } = model("x", at(0));
  void _s; void _p; void _k;
  return { ...rest, raceId: "sen-GA", ...over } as ModelOutputInput;
};

test("model outputs: stored once, only material updates are kept, a revision is a new record, and nothing is rewritten", async () => {
  const s = new MemoryStore();
  const first = await recordModelOutput(s, liveInput({ observedAt: at(0) }));
  const same = await recordModelOutput(s, liveInput({ observedAt: at(10) }));
  const again = await recordModelOutput(s, liveInput({ observedAt: at(0) }));
  const changed = await recordModelOutput(s, liveInput({ observedAt: at(20), winProbability: { a: 0.5, b: 0.4, c: 0.1 } }));
  assert.equal(first.outcome, "NEW");
  assert.equal(same.outcome, "UNCHANGED");
  assert.equal(again.outcome, "ALREADY_RECORDED");
  assert.equal(changed.outcome, "NEW");
  assert.equal((await s.list("model/sen-GA/")).length, 2);
  const read = await readModelOutputs(s, "sen-GA");
  assert.equal(read.points.length, 2);
  assert.equal(read.corrupt, 0);
  // an older record arriving late is kept, not dropped as unchanged
  const late = await recordModelOutput(s, liveInput({ observedAt: at(-30), winProbability: { a: 0.9, b: 0.05, c: 0.05 } }));
  assert.equal(late.outcome, "NEW");
  assert.equal((await readModelOutputs(s, "sen-GA")).points.length, 3);
});

test("model output validation: an unversioned live projection, a probability sum above one and an unsafe race id are refused", async () => {
  const s = new MemoryStore();
  await assert.rejects(recordModelOutput(s, liveInput({ model: { id: "m", version: "UNVERSIONED", snapshot: "s", asOf: null } })), /model version/);
  await assert.rejects(recordModelOutput(s, liveInput({ winProbability: { a: 0.8, b: 0.8, c: 0 } })), /sum/);
  await assert.rejects(recordModelOutput(s, liveInput({ raceId: "../evil" })), /safe key/);
  await assert.rejects(recordModelOutput(s, liveInput({ observedAt: "never" })), /date/);
  assert.equal((await s.list("")).length, 0);
});

test("a tampered or misfiled model record is skipped and counted, and a shadow record is unreachable by the public reader", async () => {
  const s = new MemoryStore();
  await recordModelOutput(s, liveInput({ observedAt: at(0) }));
  await recordModelOutput(s, liveInput({ observedAt: at(5), sourceClass: "SHADOW_MODEL", model: { id: "sh", version: "0.1", snapshot: "s1", asOf: null }, winProbability: { a: 0.1, b: 0.9, c: 0 } }));
  assert.equal((await s.list("model/sen-GA/")).length, 1);
  assert.equal((await s.list("model-shadow/sen-GA/")).length, 1);
  assert.equal((await readModelOutputs(s, "sen-GA")).points.length, 1);
  assert.equal((await readModelOutputs(s, "sen-GA", { shadow: true })).points.length, 1);
  // forge: copy the shadow record under the public prefix
  const [shadowKey] = await s.list("model-shadow/sen-GA/");
  const bytes = (await s.get(shadowKey))!;
  await s.put(shadowKey.replace("model-shadow/", "model/"), bytes);
  const pub = await readModelOutputs(s, "sen-GA");
  assert.equal(pub.points.length, 1);
  assert.equal(pub.corrupt, 1, "a shadow record filed as public is refused");
  // tamper
  const [k] = await s.list("model/sen-GA/");
  await s.put(k, Buffer.from((await s.get(k))!.toString().replace('"a":0.6', '"a":0.7')));
  assert.equal((await readModelOutputs(s, "sen-GA")).corrupt, 2);
  const h = await loadRaceHistory(s, "sen-GA", { surface: "PUBLIC", includeShadow: true, frozenFallback: false });
  assert.equal(h.prepared.shadow.length, 0);
  assert.ok(h.prepared.models.every((m) => m.sourceClass !== "SHADOW_MODEL"));
});

function recInput(votes: Record<string, number>, source: string | null, observedAt: string, over: Partial<ObservationInput> = {}): ObservationInput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { retrievedAt, ...ob } = obs({ a: votes.Alpha, b: votes.Bravo, o: votes.Other ?? 0, sourceTimestamp: source });
  return {
    electionId: "TEST", raceId: "sen-GA", state: "GA", provider: { name: "civicAPI", endpoint: null }, testStatus: "LIVE", sourceTimestamp: source, observedAt,
    candidates: Object.entries(votes).map(([name, v]) => ({ name, party: name === "Alpha" ? "Democratic" : name === "Bravo" ? "Republican" : "Independent", votes: v, percent: 0, winner: false })),
    observations: [ob], reportingPct: 10, rawText: JSON.stringify({ votes, source }), payloadForm: "TEST", ...over,
  };
}

test("recorder observations become result points: parties and surnames resolve to the forecast's candidates, corrections and decreases carry through, unchanged re-reads extend the held value", async () => {
  const s = new MemoryStore();
  const roster: HistoryCandidate[] = [{ id: "alpha-a", name: "Alpha A", party: "D", side: "A" }, { id: "bravo-b", name: "Bravo B", party: "R", side: "B" }, { id: "oth", name: "Olive Other", party: "I", side: null }];
  await recordObservation(s, recInput({ Alpha: 100, Bravo: 90, Other: 5 }, at(-1), at(0)));
  await recordObservation(s, recInput({ Alpha: 100, Bravo: 90, Other: 5 }, at(1), at(2)));
  await recordObservation(s, recInput({ Alpha: 100, Bravo: 90, Other: 5 }, at(3), at(4)));
  await recordObservation(s, recInput({ Alpha: 120, Bravo: 130, Other: 6 }, at(5), at(6)));
  await recordObservation(s, recInput({ Alpha: 120, Bravo: 110, Other: 6 }, at(5), at(7))); // same source time, lower: a correction
  const views = foldObservations(await readObservationRecords(s, "sen-GA"));
  const pts = resultPointsFrom(views, roster);
  assert.equal(pts.length, 3, "two unchanged re-reads are not new points");
  assert.equal(pts[0].confirmedThrough, at(4));
  assert.deepEqual(pts[0].reportedVotes, { "alpha-a": 100, "bravo-b": 90, oth: 5 }, "'Alpha'/'Democratic' resolves to the roster's Democratic candidate");
  assert.equal(pts[2].revision.status, "CORRECTION");
  assert.equal(pts[2].totalsDecreased, true);
  assert.equal(pts[2].reportedVotes["bravo-b"], 110, "the lower figure is kept");
  assert.ok(Math.abs(pts[1].countedMargin!.pp - ((130 - 120) / 256) * 100) < 1e-9);
  assert.equal(pts[0].reporting!.definition.includes("not stated"), true);
  assert.equal(pts[0].status, "LIVE");
});

test("party and name resolution", () => {
  const roster: HistoryCandidate[] = [{ id: "x", name: "Xavier Q. Doe", party: "D", side: "A" }, { id: "y", name: "Yolanda Roe", party: "R", side: "B" }];
  assert.equal(partyCode("Democratic"), "D");
  assert.equal(partyCode("Republican Party"), "R");
  assert.equal(partyCode("L"), "L");
  assert.equal(partyCode(""), null);
  assert.equal(resolveCandidate(roster, "xavier q doe", "").id, "x");
  assert.equal(resolveCandidate(roster, "X. Doe", "Democratic").id, "x");
  assert.equal(resolveCandidate(roster, "Someone Else", "Republican").id, "y");
  const other = resolveCandidate(roster, "Pat Newcomer", "Libertarian");
  assert.deepEqual([other.id, other.party, other.side], ["pat-newcomer", "L", null]);
});

test("the whole path: frozen history from the dataset, live outputs and results from the store, shadow kept out, and no request leaves the process", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => { calls++; throw new Error("history must not call a provider"); }) as typeof fetch;
  try {
    const s = new MemoryStore();
    const frozen = frozenPointsFor("sen-GA");
    assert.ok(frozen.length > 3);
    const [dem, gop] = [frozen.at(-1)!.candidates.find((c) => c.side === "A")!, frozen.at(-1)!.candidates.find((c) => c.side === "B")!];
    const probs = (p: number) => ({ [dem.id]: 1 - p, [gop.id]: p });
    await recordModelOutput(s, liveInput({ raceId: "sen-GA", observedAt: "2026-11-04T01:00:00Z", candidates: frozen.at(-1)!.candidates, winProbability: probs(0.4), winProbabilityBasis: "TWO_SIDE", margin: { pp: -1.2, reference: { plus: gop.id, minus: dem.id }, low: -4, high: 2, intervalBasis: "x" }, projectedFinalVotes: null }));
    await recordObservation(s, recInput({ [dem.name]: 1000, [gop.name]: 1200 }, "2026-11-04T01:00:30Z", "2026-11-04T01:01:00Z"));
    const { prepared, corrupt } = await loadRaceHistory(s, "sen-GA", { surface: "PUBLIC" });
    assert.deepEqual(corrupt, { model: 0, observations: 0 });
    assert.equal(prepared.models.filter((m) => m.sourceClass === "FROZEN_FORECAST").length, frozen.length);
    assert.equal(prepared.models.filter((m) => m.sourceClass === "LIVE_PROJECTION").length, 1);
    assert.equal(prepared.results.length, 1);
    assert.ok(prepared.results[0].reportedVotes[dem.id] === 1000 && prepared.results[0].reportedVotes[gop.id] === 1200, "feed candidates resolve to the forecast's candidate ids");
    const margin = buildChart(prepared, "margin");
    assert.ok(margin.series.some((x) => x.key === "margin:counted"));
    assert.ok(margin.series.find((x) => x.key === "margin:FROZEN")!.band);
    assert.equal(margin.markers.filter((m) => m.kind === "FREEZE").length, 1);
    assert.equal(calls, 0);
    // a store already holding the frozen history is read as is, without the dataset
    const seeded = new MemoryStore();
    const r = await seedFrozenForecasts(seeded, ["sen-GA"]);
    assert.equal(r.written, frozen.length);
    assert.equal((await seedFrozenForecasts(seeded, ["sen-GA"])).written, 0);
    const fromStore = await loadRaceHistory(seeded, "sen-GA", { surface: "PUBLIC", frozenFile: "/definitely/not/there.json.gz" });
    assert.equal(fromStore.prepared.models.length, frozen.length);
  } finally { globalThis.fetch = realFetch; }
});

test("a race with a forecast but no election-night data loads as pre-election history with an empty live side", async () => {
  const { prepared } = await loadRaceHistory(new MemoryStore(), "sen-IA", { surface: "PUBLIC" });
  assert.ok(prepared.models.length > 5);
  assert.equal(prepared.results.length, 0);
  assert.ok(prepared.models.every((m) => m.sourceClass === "FROZEN_FORECAST"));
  const unknown = await loadRaceHistory(new MemoryStore(), "sen-ZZ", { surface: "PUBLIC" });
  assert.equal(unknown.prepared.models.length + unknown.prepared.results.length, 0);
  assert.equal(buildChart(unknown.prepared, "prob").emptyReason !== null, true);
});
