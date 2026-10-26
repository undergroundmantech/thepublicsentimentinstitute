// Phase 2 tests. The importer and replay cases use SYNTHETIC records. The "real package" cases read the committed
// priority-15 research package and assert what it contains and, as importantly, what it does not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { importJsonPackage } from "../../app/lib/intelligence/research";
import { loadResearchDir, RESEARCH_DIR } from "../../app/lib/intelligence/load";
import { runPipeline } from "../../app/lib/intelligence/pipeline";
import { precinctVsBallots } from "../../app/lib/intelligence/reportingOrder";
import { backtestBlockers, runBacktest, type BacktestSource } from "../../app/lib/intelligence/replay";
import type { BaselineRace, ReconciledReturns, ShadowProjection } from "../../app/lib/intelligence/types";
import { TIMING_KINDS } from "../../app/lib/intelligence/types";
import { BASE_SEN, KNOWN, log, obs, URL_BASE } from "./fixtures";

const NOW = new Date("2026-10-26T00:00:00Z");
const opts = { knownRaceIds: KNOWN, now: NOW };
const meta = { packageId: "SYNTHETIC-p2", producer: "test suite", createdAt: "2026-10-25T00:00:00Z", synthetic: true, baselineSnapshot: "2026-10-25" };
const pkg = (...records: object[]) => JSON.stringify({ meta, records });
const codes = (r: ReturnType<typeof importJsonPackage>) => r.rejected.flatMap((x) => x.issues.map((i) => i.code));

const common = {
  state: "GA", jurisdiction_id: "STATE", jurisdiction_level: "STATE", source_url: `${URL_BASE}/s`, source_name: "SYNTHETIC",
  retrieved_at: "2026-10-20T00:00:00Z", published_at: "2026-10-01T00:00:00Z", confidence: "MEDIUM", limitations: "SYNTHETIC", source_tier: "PRIMARY_OFFICIAL",
};
const timing = (over: object = {}) => ({ ...common, record_id: "t1", record_type: "RELEASE_TIMING", evidence_class: "VERIFIED", value_kind: "OBSERVATION", timing_kind: "LEGAL_PROCESSING_TIME", local_text: "SYNTHETIC statement", ...over });
const cbm = (over: object = {}) => ({
  ...common, record_id: "c1", record_type: "CANDIDATE_BY_METHOD", evidence_class: "HISTORICAL", value_kind: "OBSERVATION", historical_year: 2022,
  source_tier: "RESEARCH_COMPILATION", measure_kind: "A", contest_year: 2022, office: "senate", mode_label: "ELECTION DAY", votes_a: 10, votes_b: 20, votes_other: 1, coverage: "RECONCILED", ...over,
});

// ---- the five timings are never inferred from one another ---------------------------------------------------------

test("an INFERRED timing is rejected: a timing is documented or unknown", () => {
  for (const kind of TIMING_KINDS) assert.ok(codes(importJsonPackage(pkg(timing({ evidence_class: "INFERRED", value_kind: "ESTIMATE", timing_kind: kind })), opts)).includes("TIMING_NOT_INFERRED"), kind);
});

test("a past observation cannot be recorded as a 2026 timing, and a 2026 timing cannot be HISTORICAL", () => {
  const a = importJsonPackage(pkg(timing({ evidence_class: "HISTORICAL", historical_year: 2022, timing_kind: "LEGAL_SCANNING_TIME" })), opts);
  assert.ok(codes(a).includes("TIMING_KIND_MISMATCH"));
  const b = importJsonPackage(pkg(timing({ timing_kind: "HISTORICAL_OBSERVED_RELEASE_TIME", at_utc: "2022-11-08T04:00:00Z", time_zone: "America/New_York" })), opts);
  assert.ok(codes(b).includes("TIMING_KIND_MISMATCH"));
});

test("an actual 2026 release in the future is rejected, and one that is not in 2026 is contradictory", () => {
  const future = importJsonPackage(pkg(timing({ timing_kind: "ACTUAL_2026_RELEASE_TIME", at_utc: "2026-11-04T03:00:00Z", time_zone: "UTC", source_tier: "PRIMARY_OFFICIAL" })), opts);
  assert.ok(codes(future).includes("FUTURE_TIMESTAMP"));
  const wrongYear = importJsonPackage(pkg(timing({ timing_kind: "ACTUAL_2026_RELEASE_TIME", at_utc: "2022-11-08T03:00:00Z", time_zone: "UTC" })), opts);
  assert.ok(codes(wrongYear).includes("CONTRADICTORY_METADATA"));
});

test("an exact expected release time must come from the election authority itself", () => {
  const secondary = importJsonPackage(pkg(timing({ timing_kind: "OFFICIAL_EXPECTED_RELEASE_TIME", at_utc: "2026-11-04T02:00:00Z", time_zone: "America/New_York", source_tier: "SECONDARY_SUMMARY" })), opts);
  assert.ok(codes(secondary).includes("NOT_AN_AUTHORITY"));
  const primary = importJsonPackage(pkg(timing({ timing_kind: "OFFICIAL_EXPECTED_RELEASE_TIME", at_utc: "2026-11-04T02:00:00Z", time_zone: "America/New_York", source_tier: "PRIMARY_OFFICIAL" })), opts);
  assert.equal(primary.accepted.length, 1);
});

test("a source tier caps confidence: a secondary summary is never HIGH", () => {
  const r = importJsonPackage(pkg(timing({ source_tier: "SECONDARY_SUMMARY", confidence: "HIGH" })), opts);
  assert.equal(r.accepted.length, 1);
  assert.equal(r.accepted[0].provenance.confidence, "MEDIUM");
  assert.ok(r.issues.some((i) => i.code === "CONFIDENCE_CAPPED"));
});

test("a Phase 2 record without a source tier is rejected", () => {
  const rec: Record<string, unknown> = timing();
  delete rec.source_tier;
  assert.ok(codes(importJsonPackage(pkg(rec), opts)).includes("MISSING_PROVENANCE"));
});

// ---- candidate-by-method classes ------------------------------------------------------------------------------------

test("class A candidate votes by method are accepted as HISTORICAL with the source's own mode label", () => {
  const r = importJsonPackage(pkg(cbm()), opts);
  assert.equal(r.accepted.length, 1);
  assert.equal(r.accepted[0].provenance.evidenceClass, "HISTORICAL");
});

test("party registration is never vote share (class C)", () => {
  assert.ok(codes(importJsonPackage(pkg(cbm({ measure_kind: "C" })), opts)).includes("REGISTRATION_IS_NOT_VOTE_SHARE"));
});

test("class B (ballots by method, no candidate split) belongs in METHOD_HISTORY", () => {
  assert.ok(codes(importJsonPackage(pkg(cbm({ measure_kind: "B" })), opts)).includes("USE_METHOD_HISTORY"));
});

test("class D needs a methodology and a stated uncertainty, and is INFERRED", () => {
  const bare = importJsonPackage(pkg(cbm({ measure_kind: "D", evidence_class: "INFERRED", value_kind: "ESTIMATE", historical_year: undefined })), opts);
  assert.ok(codes(bare).filter((c) => c === "MISSING_BASIS").length >= 2);
  const asHistorical = importJsonPackage(pkg(cbm({ measure_kind: "D", methodology: "m", uncertainty: "u" })), opts);
  assert.ok(codes(asHistorical).includes("CONTRADICTORY_METADATA"));
});

test("class A needs all three vote fields, a coverage label, and a district for the House", () => {
  assert.ok(codes(importJsonPackage(pkg(cbm({ votes_other: undefined })), opts)).includes("MISSING_FIELD"));
  assert.ok(codes(importJsonPackage(pkg(cbm({ coverage: undefined })), opts)).includes("MISSING_FIELD"));
  assert.ok(codes(importJsonPackage(pkg(cbm({ office: "house" })), opts)).includes("MISSING_FIELD"));
});

// ---- precinct progress versus ballots counted ---------------------------------------------------------------------

test("precincts at 100% against 88.5% of expected ballots is flagged, not repaired", () => {
  const returns = { reported: { t: 885_000 }, byJurisdiction: { "13001": { t: 400_000, precinctsReportingPct: 100 }, "13003": { t: 485_000, precinctsReportingPct: 100 } } } as unknown as ReconciledReturns;
  const shadow = { shareOfExpectedCounted: { low: 85, central: 88.5, high: 92 } } as unknown as ShadowProjection;
  const d = precinctVsBallots(returns, shadow, null, null);
  assert.equal(d?.flag, "PRECINCTS_COMPLETE_BALLOTS_INCOMPLETE");
  assert.equal(d?.precinctPctWeighted, 100);
  assert.ok(Math.abs((d?.gapPoints ?? 0) - 11.5) < 1e-9);
});

test("consistent precinct and ballot measures are not flagged; no precinct data is UNAVAILABLE", () => {
  const returns = { reported: { t: 90 }, byJurisdiction: { a: { t: 90, precinctsReportingPct: 91 } } } as unknown as ReconciledReturns;
  const shadow = { shareOfExpectedCounted: { low: 88, central: 90, high: 92 } } as unknown as ShadowProjection;
  assert.equal(precinctVsBallots(returns, shadow, null, null)?.flag, "PRECINCTS_AND_BALLOTS_CONSISTENT");
  const none = { reported: { t: 90 }, byJurisdiction: { a: { t: 90, precinctsReportingPct: null } } } as unknown as ReconciledReturns;
  assert.equal(precinctVsBallots(none, shadow, null, null)?.flag, "UNAVAILABLE");
  assert.equal(precinctVsBallots(null, shadow, null, null), null);
});

// ---- the committed priority-15 package ------------------------------------------------------------------------------

const baselineFile = JSON.parse(readFileSync(path.join(process.cwd(), "data/intelligence/baseline/2026-10-25.json"), "utf8")) as { races: BaselineRace[] };
const known = new Set(baselineFile.races.map((b) => b.raceId));
const real = loadResearchDir(RESEARCH_DIR, known, new Date("2026-10-27T00:00:00Z"));
const p15 = real.files.find((f) => f.file.startsWith("priority15-reporting"));

test("the real priority-15 package validates with no rejections", () => {
  assert.ok(p15, "package is present in data/intelligence/research");
  assert.equal(p15.result.rejected.length, 0);
  assert.equal(p15.result.accepted.length, 227);
  assert.deepEqual(p15.result.unmatchedRaceIds, []);
  assert.ok(real.records.every((r) => !r.synthetic));
});

test("the real package asserts no actual 2026 release times and no historical observed release times", () => {
  const timings = real.records.filter((r) => r.recordType === "RELEASE_TIMING") as unknown as { timingKind: string; provenance: { evidenceClass: string } }[];
  assert.ok(timings.length > 0);
  assert.ok(!timings.some((t) => t.timingKind === "ACTUAL_2026_RELEASE_TIME" && t.provenance.evidenceClass !== "UNKNOWN"));
  assert.ok(!timings.some((t) => t.timingKind === "HISTORICAL_OBSERVED_RELEASE_TIME" && t.provenance.evidenceClass !== "UNKNOWN"));
});

test("the real package carries no party-registration vote shares and no INFERRED method estimates", () => {
  const cbms = real.records.filter((r) => r.recordType === "CANDIDATE_BY_METHOD") as unknown as { measureKind: string; provenance: { evidenceClass: string } }[];
  assert.ok(cbms.length > 0);
  assert.ok(cbms.every((c) => c.measureKind === "A" && c.provenance.evidenceClass === "HISTORICAL"));
});

const baseFor = (id: string) => baselineFile.races.find((b) => b.raceId === id) ?? null;

test("shadow integration: partisan composition is NOT_APPLIED and method outstanding UNAVAILABLE for every priority race", () => {
  for (const id of ["gov-GA", "sen-AK", "house-AZ-08", "house-SC-01"]) {
    const b = baseFor(id);
    assert.ok(b, id);
    const r = runPipeline({ raceId: id, asOf: "2026-11-04T06:00:00Z", baseline: b, log: [], research: real.records, expectedJurisdictions: null, forecastExpectedTotal: null, forecastSource: null });
    const o = r.reportingOrder;
    assert.ok(o, id);
    assert.equal(o.partisanComposition.status, "NOT_APPLIED", id);
    assert.equal(o.partisanComposition.appliedToProjection, false, id);
    assert.equal(o.methodOutstanding.status, "UNAVAILABLE", id);
    assert.equal(o.timings.ACTUAL_2026_RELEASE_TIME.length, 0, id);
    assert.equal(o.timings.HISTORICAL_OBSERVED_RELEASE_TIME.length, 0, id);
    assert.ok(o.missing.some((m) => /method/i.test(m)), id);
  }
});

test("shadow integration changes no number: the projection is identical with and without the Phase 2 research", () => {
  const input = { raceId: "gov-GA", asOf: "2026-11-04T06:00:00Z", baseline: baseFor("gov-GA"), log: log(obs({ raceId: "gov-GA", a: 500_000, b: 600_000 })), expectedJurisdictions: null, forecastExpectedTotal: 4_000_000, forecastSource: "x", generatedAt: "2026-11-04T06:00:01Z" };
  const phase2 = real.records.filter((r) => ["RELEASE_TIMING", "REPORTING_PRACTICE", "CANDIDATE_BY_METHOD", "POLL_CLOSE"].includes(r.recordType));
  const without = runPipeline({ ...input, research: [] });
  const withP2 = runPipeline({ ...input, research: phase2 });
  assert.deepEqual(withP2.shadow, without.shadow);
  assert.deepEqual(withP2.outstanding, without.outstanding);
});

// ---- replay and backtest ---------------------------------------------------------------------------------------------

const archive = { sourceUrl: `${URL_BASE}/archive`, retrievedAt: "2026-10-20T00:00:00Z", sha256: "0".repeat(64) };
const certified = { raceId: "sen-GA", margin: 1.5, votes: { a: 100, b: 102, o: 3 }, certifiedAt: "2026-11-20T00:00:00Z", sourceUrl: `${URL_BASE}/cert` };
const step = (at: string, ts: string | null) => ({ at, batch: log(obs({ a: 10, b: 12, sourceTimestamp: ts })) });
const goodSource = (over: Partial<BacktestSource> = {}): BacktestSource => ({ synthetic: false, archive, steps: [step("2026-11-04T02:00:00Z", "2026-11-04T01:59:00Z")], ...over }) as BacktestSource;
const reasonsFor = (s: BacktestSource, c: typeof certified | null = certified) => backtestBlockers(s, c).join(" | ");

test("a replay with no timestamped data is BLOCKED, never fabricated", () => {
  const empty = runBacktest(goodSource({ steps: [] }), certified, { raceId: "sen-GA", baseline: BASE_SEN, research: [], expectedJurisdictions: null, forecastExpectedTotal: null, forecastSource: null }, BASE_SEN);
  assert.equal(empty.status, "BLOCKED");
  assert.match(empty.reasons.join(" "), /no timestamped returns/);
  assert.equal(empty.summary, null);
});

test("backtest blockers: synthetic, no archive, no certified result, missing timestamp, future leakage, out-of-order", () => {
  assert.match(reasonsFor(goodSource({ synthetic: true })), /synthetic/);
  assert.match(reasonsFor(goodSource({ archive: null })), /no archive record/);
  assert.match(reasonsFor(goodSource(), null), /no certified result/);
  assert.match(reasonsFor(goodSource({ steps: [step("2026-11-04T02:00:00Z", null)] })), /no source timestamp/);
  assert.match(reasonsFor(goodSource({ steps: [step("2026-11-04T02:00:00Z", "2026-11-04T03:00:00Z")] })), /future leakage/);
  assert.match(reasonsFor(goodSource({ steps: [step("2026-11-04T03:00:00Z", "2026-11-04T01:00:00Z"), step("2026-11-04T02:00:00Z", "2026-11-04T01:00:00Z")] })), /earlier than the step before/);
  assert.deepEqual(backtestBlockers(goodSource(), certified), []);
});

test("the GA runoff file holds scrape times only, so it cannot be a backtest source", () => {
  // Retrieval times are when a scraper looked, not when a jurisdiction published; they are not source timestamps.
  const scraped = goodSource({ steps: [step("2026-11-04T02:00:00Z", null)] });
  assert.match(reasonsFor(scraped), /no source timestamp/);
});

// ---- Phase 2b: poll closes ---------------------------------------------------------------------------------------------

type PC = { state: string; closesAtUtc: string | null; closesLocal: string | null; timeZoneRule: string | null; provenance: { evidenceClass: string } };
const pollCloses = real.records.filter((r) => r.recordType === "POLL_CLOSE") as unknown as PC[];
const pcOf = (s: string) => pollCloses.find((p) => p.state === s);

test("every one of the 15 states has a VERIFIED poll close, as a closing time and not a release time", () => {
  const states = ["AK", "AZ", "CO", "FL", "GA", "IA", "KS", "ME", "NE", "NY", "OH", "PA", "SC", "TX", "WI"];
  for (const s of states) assert.equal(pcOf(s)?.provenance.evidenceClass, "VERIFIED", s);
  assert.equal(pollCloses.length, 15);
});

test("GA closes 7pm ET and PA 8pm ET, with the instants after DST ended", () => {
  assert.equal(pcOf("GA")?.closesAtUtc, "2026-11-04T00:00:00Z");
  assert.equal(pcOf("PA")?.closesAtUtc, "2026-11-04T01:00:00Z");
});

test("Texas has a local clock rule and no statewide UTC instant", () => {
  const tx = pcOf("TX");
  assert.equal(tx?.closesLocal, "19:00");
  assert.equal(tx?.closesAtUtc, null);
  assert.equal(tx?.timeZoneRule, "PER_COUNTY_LOCAL");
});

const pollRec = (over: object = {}) => ({ ...common, record_id: "pc1", record_type: "POLL_CLOSE", evidence_class: "VERIFIED", value_kind: "OBSERVATION", state: "TX", ...over });

test("a per-county local poll close with a single UTC instant is rejected; one without a local time is rejected", () => {
  assert.ok(codes(importJsonPackage(pkg(pollRec({ time_zone_rule: "PER_COUNTY_LOCAL", closes_local: "19:00", closes_at_utc: "2026-11-04T01:00:00Z" })), opts)).includes("NO_STATEWIDE_INSTANT"));
  assert.ok(codes(importJsonPackage(pkg(pollRec({ time_zone_rule: "PER_COUNTY_LOCAL" })), opts)).includes("MISSING_FIELD"));
  assert.equal(importJsonPackage(pkg(pollRec({ time_zone_rule: "PER_COUNTY_LOCAL", closes_local: "19:00" })), opts).accepted.length, 1);
  assert.ok(codes(importJsonPackage(pkg(pollRec({ time_zone_rule: "PER_COUNTY_LOCAL", closes_local: "7pm" })), opts)).includes("INVALID_FIELD"));
});

// ---- Phase 2b: sequence findings ---------------------------------------------------------------------------------------

const seq = (over: object = {}) => ({ ...common, record_id: "s1", record_type: "REPORTING_PRACTICE", evidence_class: "VERIFIED", value_kind: "OBSERVATION", practice_kind: "SEQUENCE_FINDING", summary: "SYNTHETIC finding", ballot_category: "MAIL_ABSENTEE", sequence_fact: "PROCESSING_WINDOW", ...over });

test("a sequence finding needs a category, a fact kind and a limitation; a category on any other practice is contradictory", () => {
  assert.equal(importJsonPackage(pkg(seq()), opts).accepted.length, 1);
  assert.ok(codes(importJsonPackage(pkg(seq({ ballot_category: undefined })), opts)).includes("MISSING_FIELD"));
  assert.ok(codes(importJsonPackage(pkg(seq({ sequence_fact: undefined })), opts)).includes("MISSING_FIELD"));
  assert.ok(codes(importJsonPackage(pkg(seq({ limitations: undefined })), opts)).includes("MISSING_LIMITATION"));
  assert.ok(codes(importJsonPackage(pkg(seq({ practice_kind: "LATE_BALLOT_RULE" })), opts)).includes("CONTRADICTORY_METADATA"));
});

type Prac = { practiceKind: string; ballotCategory: string | null; sequenceFact: string | null; provenance: { sourceUrl: string | null; limitations: string[]; confidence: string; sourceTier?: string; evidenceClass: string } };
const findings = real.records.filter((r) => r.recordType === "REPORTING_PRACTICE" && (r as unknown as Prac).practiceKind === "SEQUENCE_FINDING") as unknown as Prac[];

test("every real sequence finding has a category, a fact kind, a source URL and a limitation; secondary tiers are never HIGH", () => {
  assert.ok(findings.length >= 30);
  for (const f of findings) {
    assert.ok(f.ballotCategory && f.sequenceFact, "category and fact");
    assert.ok(f.provenance.sourceUrl?.startsWith("https://") || f.provenance.sourceUrl?.startsWith("http://"), "source url");
    assert.ok(f.provenance.limitations.length > 0, "limitation");
    if (f.provenance.sourceTier !== "PRIMARY_OFFICIAL") assert.notEqual(f.provenance.confidence, "HIGH");
  }
});

test("no sequence finding or rule is expressed as a release time", () => {
  const timings = real.records.filter((r) => r.recordType === "RELEASE_TIMING") as unknown as { timingKind: string; provenance: { evidenceClass: string } }[];
  assert.ok(!timings.some((t) => ["ACTUAL_2026_RELEASE_TIME", "HISTORICAL_OBSERVED_RELEASE_TIME"].includes(t.timingKind) && t.provenance.evidenceClass !== "UNKNOWN"));
});

test("the Georgia profile lists mail findings, names categories with no finding, and carries the poll close", () => {
  const b = baseFor("gov-GA");
  const r = runPipeline({ raceId: "gov-GA", asOf: "2026-11-04T06:00:00Z", baseline: b, log: [], research: real.records, expectedJurisdictions: null, forecastExpectedTotal: null, forecastSource: null });
  const o = r.reportingOrder;
  assert.ok(o);
  assert.ok(o.sequence.byCategory.MAIL_ABSENTEE.length > 0);
  assert.ok(o.sequence.byCategory.MAIL_ABSENTEE.every((p) => p.evidenceClass === "VERIFIED" && p.limitations.length > 0));
  assert.ok(o.sequence.undocumented.includes("EARLY_IN_PERSON"), "no early-in-person sequence evidence was found for GA");
  assert.ok(o.missing.some((m) => m.startsWith("sequence EARLY_IN_PERSON")));
  assert.equal(o.pollClose.find((p) => p.jurisdictionId === "STATE")?.closesAtUtc, "2026-11-04T00:00:00Z");
});

test("an undocumented category is a gap, never a guess: documented and undocumented are disjoint and cover every category", () => {
  for (const id of ["gov-GA", "sen-AK", "house-AZ-08", "house-SC-01"]) {
    const r = runPipeline({ raceId: id, asOf: "2026-11-04T06:00:00Z", baseline: baseFor(id), log: [], research: real.records, expectedJurisdictions: null, forecastExpectedTotal: null, forecastSource: null });
    const s = r.reportingOrder!.sequence;
    for (const c of Object.keys(s.byCategory) as (keyof typeof s.byCategory)[]) {
      if (c === "MIXED_OR_UNKNOWN") continue;
      assert.equal(s.byCategory[c].length === 0, s.undocumented.includes(c), `${id} ${c}`);
    }
  }
});

// ---- Phase 2b: committed outputs match their manifest -----------------------------------------------------------------

test("the build manifest's output checksums match the committed files", () => {
  const dir = path.join(process.cwd(), "data/intelligence/build");
  const manifestFile = readdirSync(dir).find((f) => f.startsWith("priority15-build-manifest"));
  assert.ok(manifestFile, "build manifest is committed");
  const m = JSON.parse(readFileSync(path.join(dir, manifestFile), "utf8")) as { outputs?: { path: string; sha256: string }[] };
  assert.ok(m.outputs && m.outputs.length >= 3, "manifest lists outputs");
  for (const o of m.outputs) {
    const sha = createHash("sha256").update(readFileSync(path.join(process.cwd(), o.path))).digest("hex");
    assert.equal(sha, o.sha256, o.path);
  }
});
