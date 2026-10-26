// SYNTHETIC test data only. These tests check the software, not any election.
import { test } from "node:test";
import assert from "node:assert/strict";
import { importCsvPackage, importJsonPackage, mergePackages } from "../../app/lib/intelligence/research";
import { KNOWN, URL_BASE } from "./fixtures";

const NOW = new Date("2026-10-26T00:00:00Z");
const opts = { knownRaceIds: KNOWN, now: NOW };
const meta = { packageId: "SYNTHETIC-pkg", producer: "test suite", createdAt: "2026-10-25T00:00:00Z", synthetic: true, baselineSnapshot: "2026-10-25" };
const good = {
  record_id: "r1", record_type: "TURNOUT_EXPECTATION", race_id: "sen-GA", state: "GA", jurisdiction_id: "STATE", jurisdiction_level: "STATE",
  evidence_class: "INFERRED", value_kind: "ESTIMATE", source_url: `${URL_BASE}/t`, retrieved_at: "2026-10-20T00:00:00Z", confidence: "LOW",
  limitations: "SYNTHETIC; invented range", expected_low: 4000000, expected_central: 4300000, expected_high: 4600000,
};
const pkg = (...records: object[]) => JSON.stringify({ meta, records });
const codes = (r: ReturnType<typeof importJsonPackage>) => r.rejected.flatMap((x) => x.issues.map((i) => i.code));

test("a well formed record is accepted and marked synthetic", () => {
  const r = importJsonPackage(pkg(good), opts);
  assert.equal(r.accepted.length, 1);
  assert.equal(r.accepted[0].synthetic, true);
  assert.ok(r.issues.some((i) => i.code === "SYNTHETIC"));
});

test("the production loader refuses synthetic packages", () => {
  const r = importJsonPackage(pkg(good), { ...opts, rejectSynthetic: true });
  assert.equal(r.accepted.length, 0);
  assert.ok(r.issues.some((i) => i.code === "SYNTHETIC_REFUSED"));
});

test("VERIFIED without a source URL is rejected, not repaired", () => {
  const r = importJsonPackage(pkg({ ...good, evidence_class: "VERIFIED", value_kind: "OBSERVATION", source_url: "" }), opts);
  assert.equal(r.accepted.length, 0);
  assert.ok(codes(r).includes("MISSING_PROVENANCE"));
});

test("a non-http source URL is rejected", () => {
  const r = importJsonPackage(pkg({ ...good, source_url: "javascript:alert(1)" }), opts);
  assert.ok(codes(r).includes("INVALID_URL"));
});

test("unmatched race ids are rejected and listed", () => {
  const r = importJsonPackage(pkg({ ...good, race_id: "sen-ZZ" }, { ...good, record_id: "r2", race_id: "house-PA-99" }), opts);
  assert.equal(r.accepted.length, 0);
  assert.deepEqual(r.unmatchedRaceIds, ["house-PA-99", "sen-ZZ"]);
});

test("contradictory metadata is rejected", () => {
  const cases: [object, string][] = [
    [{ ...good, state: "AZ" }, "race in another state"],
    [{ ...good, evidence_class: "INFERRED", value_kind: "OBSERVATION" }, "INFERRED observation"],
    [{ ...good, published_at: "2026-10-22T00:00:00Z", retrieved_at: "2026-10-20T00:00:00Z" }, "published after retrieved"],
    [{ ...good, jurisdiction_level: "STATE", jurisdiction_id: "13121" }, "STATE level with a county id"],
    [{ ...good, expected_low: 5, expected_high: 4 }, "low above high"],
  ];
  for (const [rec, why] of cases) assert.equal(importJsonPackage(pkg(rec), opts).accepted.length, 0, why);
});

test("historical data that does not apply to 2026", () => {
  // HISTORICAL cannot claim 2026
  let r = importJsonPackage(pkg({ ...good, record_type: "METHOD_HISTORY", race_id: "", method: "MAIL_ABSENTEE", evidence_class: "HISTORICAL", value_kind: "OBSERVATION", historical_year: 2026, share_of_total: 0.3 }), opts);
  assert.ok(codes(r).includes("CONTRADICTORY_METADATA"));
  // a past turnout is not a 2026 expectation
  r = importJsonPackage(pkg({ ...good, evidence_class: "HISTORICAL", value_kind: "OBSERVATION", historical_year: 2022 }), opts);
  assert.equal(r.accepted.length, 0);
  // VERIFIED is current-election evidence only
  r = importJsonPackage(pkg({ ...good, evidence_class: "VERIFIED", value_kind: "OBSERVATION", historical_year: 2022 }), opts);
  assert.equal(r.accepted.length, 0);
  // a historical poll close is accepted as a record but flagged as not applicable
  r = importJsonPackage(pkg({ record_id: "pc", record_type: "POLL_CLOSE", state: "GA", jurisdiction_id: "STATE", jurisdiction_level: "STATE", evidence_class: "HISTORICAL", value_kind: "OBSERVATION", source_url: `${URL_BASE}/pc`, retrieved_at: "2026-10-20T00:00:00Z", historical_year: 2022, confidence: "LOW", closes_at_utc: "2022-11-09T00:00:00Z" }), opts);
  assert.equal(r.accepted.length, 1);
  assert.ok(r.issues.some((i) => i.code === "NOT_APPLICABLE_2026"));
});

test("UNKNOWN records carry no value and confidence NONE", () => {
  let r = importJsonPackage(pkg({ ...good, evidence_class: "UNKNOWN", confidence: "NONE" }), opts);
  assert.ok(codes(r).includes("UNKNOWN_HAS_VALUE"));
  r = importJsonPackage(pkg({ ...good, evidence_class: "UNKNOWN", confidence: "NONE", expected_low: "", expected_central: "", expected_high: "" }), opts);
  assert.equal(r.accepted.length, 1);
});

test("a single-number turnout expectation is rejected: no stated uncertainty", () => {
  const r = importJsonPackage(pkg({ ...good, expected_low: "", expected_high: "" }), opts);
  assert.equal(r.accepted.length, 0);
});

test("retrieval in the future is rejected", () => {
  const r = importJsonPackage(pkg({ ...good, retrieved_at: "2026-12-01T00:00:00Z" }), opts);
  assert.ok(codes(r).includes("FUTURE_TIMESTAMP"));
});

test("duplicate record ids inside a package and across packages", () => {
  const r = importJsonPackage(pkg(good, good), opts);
  assert.equal(r.accepted.length, 1);
  assert.ok(codes(r).includes("DUPLICATE_RECORD_ID"));
  const m = mergePackages([r, r]);
  assert.equal(m.records.length, 1);
  assert.ok(m.issues.some((i) => i.code === "DUPLICATE_RECORD_ID"));
});

test("county splits that add to more than the whole county are all excluded", () => {
  const sp = (id: string, d: string, w: number) => ({ record_id: id, record_type: "GEO_SPLIT", state: "PA", jurisdiction_id: "42091", jurisdiction_level: "COUNTY", evidence_class: "VERIFIED", value_kind: "OBSERVATION", source_url: `${URL_BASE}/x`, retrieved_at: "2026-10-20T00:00:00Z", confidence: "MEDIUM", county_fips: "42091", district_id: d, weight: w, weight_basis: "SYNTHETIC" });
  const r = importJsonPackage(pkg(sp("a", "PA-04", 0.7), sp("b", "PA-01", 0.6)), opts);
  assert.equal(r.accepted.filter((x) => x.recordType === "GEO_SPLIT").length, 0);
  assert.ok(r.issues.some((i) => i.code === "GEO_SPLIT_OVERALLOCATED"));
  const ok = importJsonPackage(pkg(sp("a", "PA-04", 0.7), sp("b", "PA-01", 0.3)), opts);
  assert.equal(ok.accepted.length, 2);
});

test("CSV packages: header row, sidecar meta, spreadsheet row numbers", () => {
  const csv = [
    "record_id,record_type,race_id,state,jurisdiction_id,jurisdiction_level,method,evidence_class,value_kind,source_url,retrieved_at,historical_year,confidence,share_of_total,limitations",
    `m1,METHOD_HISTORY,,GA,STATE,STATE,MAIL_ABSENTEE,HISTORICAL,OBSERVATION,${URL_BASE}/m,2026-10-20T00:00:00Z,2022,MEDIUM,0.2,SYNTHETIC`,
    `m2,METHOD_HISTORY,,GA,STATE,STATE,NOT_A_METHOD,HISTORICAL,OBSERVATION,${URL_BASE}/m,2026-10-20T00:00:00Z,2022,MEDIUM,0.2,SYNTHETIC`,
  ].join("\n");
  const r = importCsvPackage(csv, meta, opts);
  assert.equal(r.accepted.length, 1);
  assert.equal(r.rejected[0].row, 3);
  assert.equal(importCsvPackage(csv, { producer: "x" }, opts).meta, null);
  const missingCol = importCsvPackage("record_id,state\nx,GA", meta, opts);
  assert.ok(missingCol.issues.some((i) => i.code === "MISSING_COLUMN"));
});

test("invalid JSON is reported, not thrown", () => {
  const r = importJsonPackage("{not json", opts);
  assert.equal(r.accepted.length, 0);
  assert.equal(r.issues[0].code, "PARSE_ERROR");
});
