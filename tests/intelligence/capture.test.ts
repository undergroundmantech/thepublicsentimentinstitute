// SYNTHETIC test data only. These tests check the recorder's storage and replay, not any election.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  compareCheckpoints, foldObservations, loadCapturesForReplay, readObservationRecords, readRaceHead, reconstructAt, reconstructFeedAt, recordFeedDelta, recordObservation,
  reportingGaps, readRaw, type FeedRow, type ObservationInput,
} from "../../app/lib/intelligence/capture";
import { FsStore, MemoryStore, type ObjectStore } from "../../app/lib/intelligence/captureStore";
import { backtestFromCaptures } from "../../app/lib/intelligence/replay";
import { obs } from "./fixtures";

const T0 = "2026-11-04T01:00:00Z";
const at = (min: number, sec = 0) => new Date(Date.parse(T0) + min * 60_000 + sec * 1000).toISOString();

function input(a: number, b: number, o: number, sourceTimestamp: string | null, observedAt: string, over: Partial<ObservationInput> = {}): ObservationInput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { retrievedAt, ...ob } = obs({ a, b, o, sourceTimestamp });
  return {
    electionId: "TEST-ELECTION", raceId: "sen-GA", state: "GA", provider: { name: "civicAPI", endpoint: "https://example.org/race/101" }, testStatus: "LIVE", sourceTimestamp, observedAt,
    candidates: [{ name: "Alpha", party: "Democratic", votes: a, percent: 0, winner: false }], observations: [ob], reportingPct: 10, rawText: JSON.stringify({ a, b, o, sourceTimestamp }), payloadForm: "TEST", ...over,
  };
}
const views = async (store: MemoryStore | FsStore, raceId = "sen-GA") => foldObservations(await readObservationRecords(store, raceId));

test("recording the same reading twice writes it once", async () => {
  const s = new MemoryStore();
  const first = await recordObservation(s, input(100, 90, 5, at(0), at(1)));
  const again = await recordObservation(s, input(100, 90, 5, at(0), at(2)));
  assert.equal(first.outcome, "NEW");
  assert.equal(again.outcome, "UNCHANGED");
  assert.equal((await s.list("obs/sen-GA/")).length, 1);
  const head = await readRaceHead(s, "sen-GA");
  assert.equal(head?.events, 1);
  assert.equal(head?.materialEvents, 1);
});

test("duplicate delivery of one observation, concurrently, leaves one record", async () => {
  const s = new MemoryStore();
  const out = await Promise.all([recordObservation(s, input(1, 2, 3, at(0), at(1))), recordObservation(s, input(1, 2, 3, at(0), at(1)))]);
  assert.deepEqual(out.map((o) => o.outcome).sort(), ["ALREADY_RECORDED", "NEW"]);
  assert.equal((await s.list("obs/sen-GA/")).length, 1);
});

test("the source timestamp and the observation time are kept apart, and a missing source timestamp stays missing", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(10, 10, 0, at(-5), at(1)));
  await recordObservation(s, input(20, 10, 0, null, at(2)));
  const [a, b] = (await readObservationRecords(s, "sen-GA")).records.map((r) => r.record);
  assert.equal(a.sourceTimestamp, new Date(at(-5)).toISOString());
  assert.equal(a.firstObservedAt, at(1));
  assert.equal(b.sourceTimestamp, null);
  assert.equal(b.reportingPctBasis, "PROVIDER_UNSPECIFIED");
  assert.equal(b.precinctsReporting.reported, null);
  assert.equal(b.officialOutstandingBallots, null);
});

test("a reading whose figures did not change but whose source timestamp did is kept, and is not a material update", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(10, 10, 0, at(0), at(1)));
  const r = await recordObservation(s, input(10, 10, 0, at(5), at(6)));
  assert.equal(r.outcome, "NEW");
  assert.equal(r.material, false);
  const head = await readRaceHead(s, "sen-GA");
  assert.equal(head?.events, 2);
  assert.equal(head?.materialEvents, 1);
});

test("a correction under the same source timestamp is kept beside the original and flagged", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(100, 100, 0, at(0), at(1)));
  await recordObservation(s, input(90, 100, 0, at(0), at(3)));
  const v = await views(s);
  assert.equal(v.length, 2);
  assert.equal(v[1].revisionStatus, "CORRECTION");
  assert.equal(v[1].flag, "CORRECTED");
  assert.equal(v[1].correctsObservationId, v[0].observationId);
  assert.equal(v[0].supersededBy, v[1].observationId);
  assert.equal(v[1].totalsDecreased, true);
  assert.equal(v[1].diffFromPrevious?.dA, -10);
});

test("a decrease in totals is recorded and flagged, never smoothed away", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(100, 100, 0, at(0), at(1)));
  await recordObservation(s, input(100, 80, 0, at(5), at(6)));
  const v = await views(s);
  assert.deepEqual(v.map((x) => x.totalsDecreased), [false, true]);
  assert.equal(v[1].record.toplineSides?.b, 80);
});

test("observations that arrive out of order are stored in observed order and flagged by source time", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(10, 10, 0, at(0), at(1)));
  await recordObservation(s, input(30, 30, 0, at(10), at(11)));
  await recordObservation(s, input(20, 20, 0, at(5), at(12)));
  const v = await views(s);
  assert.deepEqual(v.map((x) => x.firstObservedAt), [at(1), at(11), at(12)]);
  assert.deepEqual(v.map((x) => x.outOfOrder), [false, false, true]);
  const head = await readRaceHead(s, "sen-GA");
  assert.equal(head?.firstObservedAt, at(12));
});

test("an older write never replaces a newer head", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(30, 30, 0, at(10), at(11)));
  await recordObservation(s, input(10, 10, 0, at(0), at(1)));
  assert.equal((await readRaceHead(s, "sen-GA"))?.firstObservedAt, at(11));
});

test("test data is labelled TEST and kept out of replay unless asked for", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(10, 10, 0, at(0), at(1), { testStatus: "TEST" }));
  const live = await loadCapturesForReplay(s, "sen-GA");
  assert.equal(live.steps.length, 0);
  assert.deepEqual(live.excluded.map((e) => e.reason), ["TEST_DATA"]);
  assert.equal((await loadCapturesForReplay(s, "sen-GA", { includeTest: true })).steps[0].flag, "TEST");
});

test("a record altered in storage fails its checksum and is skipped, never trusted", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(10, 10, 0, at(0), at(1)));
  await recordObservation(s, input(20, 10, 0, at(5), at(6)));
  const key = (await s.list("obs/sen-GA/"))[0];
  const rec = JSON.parse((await s.get(key))!.toString());
  rec.toplineSides.a = 9999;
  s.objects.set(key, Buffer.from(JSON.stringify(rec)));
  const loaded = await loadCapturesForReplay(s, "sen-GA");
  assert.equal(loaded.corruptRecords, 1);
  assert.equal(loaded.steps.length, 1);
});

test("a raw payload altered or missing is detected", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(10, 10, 0, at(0), at(1)));
  const [{ record }] = (await readObservationRecords(s, "sen-GA")).records;
  assert.ok(await readRaw(s, record));
  s.objects.set(record.rawRef, Buffer.from("tampered"));
  assert.equal(await readRaw(s, record), null);
  const loaded = await loadCapturesForReplay(s, "sen-GA", { verifyRaw: true });
  assert.deepEqual(loaded.excluded.map((e) => e.reason), ["RAW_MISSING_OR_MISMATCHED"]);
});

test("every record names a raw object that exists, written before the record", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(10, 10, 0, at(0), at(1)));
  await recordObservation(s, input(20, 10, 0, at(5), at(6)));
  for (const { record } of (await readObservationRecords(s, "sen-GA")).records) assert.ok(await readRaw(s, record));
});

test("unsafe or malformed input is refused before anything is written", async () => {
  const s = new MemoryStore();
  await assert.rejects(recordObservation(s, input(1, 1, 1, at(0), at(1), { raceId: "../etc/passwd" })), { code: "INVALID_RACE_ID" });
  await assert.rejects(recordObservation(s, input(-1, 1, 1, at(0), at(1))), { code: "INVALID_VOTES" });
  await assert.rejects(recordObservation(s, input(1, 1, 1, at(0), "not a date")), { code: "INVALID_DATE" });
  await assert.rejects(recordObservation(s, input(1, 1, 1, "garbage", at(1))), { code: "INVALID_DATE" });
  assert.equal(s.objects.size, 0);
});

test("restart and recovery: a new process on the same directory sees everything and carries on without duplicates", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tpsi-cap-"));
  try {
    const before = new FsStore(dir);
    await recordObservation(before, input(10, 10, 0, at(0), at(1)));
    await recordObservation(before, input(20, 10, 0, at(5), at(6)));
    const after = new FsStore(dir);
    assert.equal((await readRaceHead(after, "sen-GA"))?.events, 2);
    assert.equal((await recordObservation(after, input(20, 10, 0, at(5), at(7)))).outcome, "UNCHANGED");
    assert.equal((await recordObservation(after, input(30, 10, 0, at(9), at(10)))).outcome, "NEW");
    assert.equal((await views(after)).length, 3);
    assert.equal((await after.list("raw/")).length, 3);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("an interrupted write leaves no half-written record behind", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tpsi-cap-"));
  try {
    const s = new FsStore(dir);
    await recordObservation(s, input(10, 10, 0, at(0), at(1)));
    // a leftover temp file from a crash mid-write is ignored by listing and reading
    await writeFile(path.join(dir, "obs", "sen-GA", `${at(2).replace(/[-:]/g, "")}_abc.json.123.deadbeef.tmp`), "{half");
    assert.equal((await s.list("obs/sen-GA/")).length, 1);
    assert.equal((await readObservationRecords(s, "sen-GA")).corrupt, 0);
    assert.equal(JSON.parse(await readFile(path.join(dir, (await s.list("heads/race/"))[0]), "utf8")).raceId, "sen-GA");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("the filesystem store refuses to overwrite and refuses unsafe keys", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tpsi-cap-"));
  try {
    const s: ObjectStore = new FsStore(dir);
    assert.equal(await s.putIfAbsent("a/b.json", Buffer.from("1"), "x"), "CREATED");
    assert.equal(await s.putIfAbsent("a/b.json", Buffer.from("2"), "x"), "EXISTS");
    assert.equal((await s.get("a/b.json"))?.toString(), "1");
    await assert.rejects(s.get("../escape"), { code: "INVALID_KEY" });
    await assert.rejects(s.put("/abs", Buffer.from("x"), "x"), { code: "INVALID_KEY" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// ---- replay ----------------------------------------------------------------------------------------------------------

async function seeded() {
  const s = new MemoryStore();
  await recordObservation(s, input(100, 100, 0, at(0), at(1)));
  await recordObservation(s, input(200, 220, 0, at(10), at(11)));
  await recordObservation(s, input(300, 360, 0, at(20), at(21)));
  return s;
}

test("replay is deterministic: loading twice gives the same steps", async () => {
  const s = await seeded();
  const a = await loadCapturesForReplay(s, "sen-GA");
  const b = await loadCapturesForReplay(s, "sen-GA");
  assert.deepEqual(a, b);
  assert.deepEqual(a.steps.map((x) => x.at), [at(1), at(11), at(21)]);
});

test("a reconstruction at time T uses nothing observed after T, even when a later record exists", async () => {
  const s = await seeded();
  const T = at(15);
  const before = reconstructAt(await loadCapturesForReplay(s, "sen-GA"), T);
  await recordObservation(s, input(900, 100, 0, at(16), at(17)));
  const loaded = await loadCapturesForReplay(s, "sen-GA");
  const after = reconstructAt(loaded, T);
  assert.deepEqual(after, before);
  assert.equal(before.observationsKnown, 2);
  assert.equal(before.returns?.reported.a, 200);
  assert.equal(before.ageSeconds, 4 * 60);
  assert.equal((await loadCapturesForReplay(s, "sen-GA", { knownAt: T })).steps.length, 2);
});

test("a reconstruction before the first observation has nothing", async () => {
  const r = reconstructAt(await loadCapturesForReplay(await seeded(), "sen-GA"), at(0));
  assert.equal(r.observationsKnown, 0);
  assert.equal(r.returns, null);
});

test("a correction is not visible to a reconstruction made before it was observed", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(100, 100, 0, at(0), at(1)));
  await recordObservation(s, input(90, 100, 0, at(0), at(8)));
  const loaded = await loadCapturesForReplay(s, "sen-GA");
  assert.equal(reconstructAt(loaded, at(5)).returns?.reported.a, 100);
  assert.equal(reconstructAt(loaded, at(9)).returns?.reported.a, 90);
  assert.deepEqual(loaded.steps.map((x) => x.flag), ["LIVE", "CORRECTED"]);
});

test("gaps are reported by observation time and by the source's own timestamps", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(10, 10, 0, at(0), at(1)));
  await recordObservation(s, input(20, 20, 0, at(2), at(3)));
  await recordObservation(s, input(30, 30, 0, at(40), at(41)));
  const gaps = reportingGaps(await loadCapturesForReplay(s, "sen-GA"), 15);
  assert.deepEqual(gaps.map((g) => g.kind).sort(), ["OBSERVATION", "SOURCE_TIMESTAMP"]);
  assert.equal(gaps[0].minutes, 38);
});

test("checkpoints are compared with the certified margin and labelled provisional", async () => {
  const loaded = await loadCapturesForReplay(await seeded(), "sen-GA");
  const [c] = compareCheckpoints(loaded, { margin: 5 }, [at(15)]);
  assert.equal(c.label, "PROVISIONAL_NOT_CERTIFIED");
  assert.ok(Math.abs(c.provisionalMargin! - (20 / 420) * 100) < 1e-9);
  assert.ok(Math.abs(c.errorPoints! - (c.provisionalMargin! - 5)) < 1e-9);
});

test("a backtest from captures is BLOCKED without a certified result, and never invents one", async () => {
  const loaded = await loadCapturesForReplay(await seeded(), "sen-GA");
  const r = backtestFromCaptures(loaded, null, { raceId: "sen-GA", baseline: null, research: [], expectedJurisdictions: null, forecastExpectedTotal: null, forecastSource: null });
  assert.equal(r.status, "BLOCKED");
  assert.ok(r.reasons.some((x) => /certified/.test(x)));
  const none = backtestFromCaptures(await loadCapturesForReplay(new MemoryStore(), "sen-GA"), null, { raceId: "sen-GA", baseline: null, research: [], expectedJurisdictions: null, forecastExpectedTotal: null, forecastSource: null });
  assert.equal(none.status, "BLOCKED");
  assert.ok(none.reasons[0].includes("nothing to replay"));
});

test("a capture without source timestamps blocks a backtest rather than receiving one", async () => {
  const s = new MemoryStore();
  await recordObservation(s, input(10, 10, 0, null, at(1)));
  const r = backtestFromCaptures(await loadCapturesForReplay(s, "sen-GA"), { raceId: "sen-GA", margin: 1, votes: { a: 1, b: 1, o: 0 }, certifiedAt: at(100), sourceUrl: "https://example.org/x" }, { raceId: "sen-GA", baseline: null, research: [], expectedJurisdictions: null, forecastExpectedTotal: null, forecastSource: null });
  assert.equal(r.status, "BLOCKED");
  assert.ok(r.reasons.some((x) => /source timestamp/.test(x)));
});

// ---- whole-feed capture ----------------------------------------------------------------------------------------------

const row = (id: number, pr: number): FeedRow => ({ id, type: "US Senate", province: "GA", district: null, name: `row ${id}`, pr, c: [] });

test("a feed records only the rows that changed, and reconstructs at any time", async () => {
  const s = new MemoryStore();
  const f = (rows: FeedRow[], t: string) => recordFeedDelta(s, { feed: "US Senate", provider: { name: "civicAPI", endpoint: "x" }, observedAt: t, rows, rawText: JSON.stringify(rows) });
  assert.equal((await f([row(1, 0), row(2, 0), row(3, 0)], at(1))).changed, 3);
  assert.equal((await f([row(1, 0), row(2, 0), row(3, 0)], at(2))).outcome, "UNCHANGED");
  const d = await f([row(1, 10), row(2, 0)], at(3));
  assert.deepEqual([d.changed, d.removed], [1, 1]);
  assert.equal((await s.list("feed/us-senate/")).length, 2);
  assert.equal((await reconstructFeedAt(s, "US Senate", at(2))).rows.size, 3);
  const late = await reconstructFeedAt(s, "US Senate", at(4));
  assert.deepEqual([...late.rows.keys()].sort(), [1, 2]);
  assert.equal(late.rows.get(1)?.pr, 10);
});
