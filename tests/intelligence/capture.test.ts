// SYNTHETIC data only. These tests check the capture ledger and the replay reader, not any election.
import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { canonicalJson, captureStatus, foldLedger, knownAt, loadCapturesForReplay, readLedger, recordCapture, sha256Hex, CaptureError, type CaptureInput, type CapturedObservation } from "../../app/lib/intelligence/capture";
import { backtestFromCaptures } from "../../app/lib/intelligence/replay";
import { BASE_SEN } from "./fixtures";

const T = (min: number) => `2026-11-04T02:${String(min).padStart(2, "0")}:00Z`;
const topline = (a: number, b: number, o = 0, over: Partial<CapturedObservation> = {}): CapturedObservation => ({
  raceId: "sen-GA", jurisdictionId: "STATE", jurisdictionLevel: "STATE", scope: "WHOLE", method: "UNKNOWN", sides: { a, b, o }, precinctsReportingPct: 10,
  sourceTimestamp: T(0), source: "SYNTHETIC", sourceUrl: "https://example.org/SYNTHETIC", test: false, ...over,
});
const input = (over: Partial<CaptureInput> & { a?: number; b?: number } = {}): CaptureInput => {
  const { a = 100, b = 110, ...rest } = over;
  const ts = rest.sourceTimestamp === undefined ? T(0) : rest.sourceTimestamp;
  return { raceId: "sen-GA", state: "GA", source: { name: "SYNTHETIC", url: "https://example.org/SYNTHETIC" }, sourceTimestamp: ts, observedAt: T(1), observations: [topline(a, b, 0, { sourceTimestamp: ts })], raw: { a, b, ts }, payloadForm: "SYNTHETIC", ...rest };
};

async function withDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "tpsi-capture-"));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test("canonical JSON ignores key order, so equal payloads hash equally", () => {
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] }), canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
  assert.equal(sha256Hex(canonicalJson({ x: 1 })), sha256Hex(canonicalJson({ x: 1 })));
});

test("a capture records first and last observed times, source timestamp, totals, indicators, source identity and the payload", async () => {
  await withDir(async (dir) => {
    const r = await recordCapture(dir, input());
    assert.equal(r.outcome, "NEW");
    const [v] = foldLedger(await readLedger(dir, "sen-GA"));
    assert.equal(v.firstObservedAt, T(1));
    assert.equal(v.lastObservedAt, T(1));
    assert.equal(v.sourceTimestamp, T(0));
    assert.deepEqual(v.toplineSides, { a: 100, b: 110, o: 0 });
    assert.equal(v.precinctsReportingPct, 10);
    assert.equal(v.source.name, "SYNTHETIC");
    assert.equal(v.flag, "LIVE");
    const payload = JSON.parse(await readFile(path.join(dir, v.payloadRef), "utf8"));
    assert.deepEqual(payload.raw, { a: 100, b: 110, ts: T(0) });
    assert.equal(sha256Hex(canonicalJson(payload.raw)), v.payloadSha256);
  });
});

test("idempotent: the same capture twice changes nothing; the same payload at a later time only extends the last-observed time", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input());
    const before = await readFile(path.join(dir, "sen-GA.ndjson"), "utf8");
    assert.equal((await recordCapture(dir, input())).outcome, "ALREADY_RECORDED");
    assert.equal(await readFile(path.join(dir, "sen-GA.ndjson"), "utf8"), before);
    assert.equal((await recordCapture(dir, input({ observedAt: T(2) }))).outcome, "SEEN_AGAIN");
    assert.equal((await recordCapture(dir, input({ observedAt: T(2) }))).outcome, "ALREADY_RECORDED");
    const views = foldLedger(await readLedger(dir, "sen-GA"));
    assert.equal(views.length, 1);
    assert.equal(views[0].firstObservedAt, T(1));
    assert.equal(views[0].lastObservedAt, T(2));
    assert.equal(views[0].observationCount, 2);
  });
});

test("the diff from the previous observation is stored", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input({ a: 100, b: 110, sourceTimestamp: T(0), observedAt: T(1) }));
    await recordCapture(dir, input({ a: 150, b: 140, sourceTimestamp: T(3), observedAt: T(4) }));
    const v = foldLedger(await readLedger(dir, "sen-GA"));
    assert.equal(v[0].diffFromPrevious, null);
    assert.deepEqual(v[1].diffFromPrevious, { previousCaptureId: v[0].captureId, dA: 50, dB: 30, dO: 0, dTotal: 80, dPrecinctsPct: 0, dSourceSeconds: 180 });
  });
});

test("a late correction is flagged CORRECTED and links both ways; it is invisible to an earlier knowledge time", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input({ a: 100, b: 110, sourceTimestamp: T(0), observedAt: T(1) }));
    await recordCapture(dir, input({ a: 100, b: 118, sourceTimestamp: T(0), observedAt: T(9) }));
    const views = foldLedger(await readLedger(dir, "sen-GA"));
    assert.equal(views.length, 2);
    assert.equal(views[0].flag, "LIVE");
    assert.equal(views[0].supersededBy, views[1].captureId);
    assert.equal(views[1].flag, "CORRECTED");
    assert.equal(views[1].correctsCaptureId, views[0].captureId);
    assert.deepEqual(knownAt(views, T(5)).map((v) => v.captureId), [views[0].captureId]);
  });
});

test("an out-of-order arrival is flagged and ordered by observation, not rewritten", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input({ a: 200, b: 200, sourceTimestamp: T(5), observedAt: T(6) }));
    await recordCapture(dir, input({ a: 100, b: 100, sourceTimestamp: T(2), observedAt: T(7) }));
    const views = foldLedger(await readLedger(dir, "sen-GA"));
    assert.deepEqual(views.map((v) => v.outOfOrder), [false, true]);
  });
});

test("test data is flagged TEST", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input({ observations: [topline(1, 2, 0, { test: true })] }));
    assert.equal(foldLedger(await readLedger(dir, "sen-GA"))[0].flag, "TEST");
  });
});

test("a missing source timestamp stays null", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input({ sourceTimestamp: null, observations: [topline(1, 2, 0, { sourceTimestamp: null })] }));
    const s = await captureStatus(dir, "sen-GA");
    assert.equal(s.withoutSourceTimestamp, 1);
  });
});

test("interruption: a torn last line is skipped and counted, and the next capture is not swallowed by it", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input({ observedAt: T(1) }));
    await appendFile(path.join(dir, "sen-GA.ndjson"), '{"type":"CAPTURE","schemaVersion":"TPSI_CAPTURE/1","capt', "utf8");
    const torn = await readLedger(dir, "sen-GA");
    assert.equal(torn.tornTail, true);
    assert.equal(torn.corruptLines, 1);
    assert.equal(torn.captures.length, 1);
    const r = await recordCapture(dir, input({ a: 120, b: 130, sourceTimestamp: T(2), observedAt: T(3) }));
    assert.equal(r.outcome, "NEW");
    const after = await readLedger(dir, "sen-GA");
    assert.equal(after.captures.length, 2);
    assert.equal(after.corruptLines, 1, "the torn fragment stays on its own line");
  });
});

test("interruption: a ledger line that was edited fails its checksum and is not trusted", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input());
    const f = path.join(dir, "sen-GA.ndjson");
    await writeFile(f, (await readFile(f, "utf8")).replace('"a":100', '"a":999'), "utf8");
    const l = await readLedger(dir, "sen-GA");
    assert.equal(l.captures.length, 0);
    assert.equal(l.corruptLines, 1);
  });
});

test("interruption: a payload written before a crash is reused when the capture is retried", async () => {
  await withDir(async (dir) => {
    const r1 = await recordCapture(dir, input());
    await rm(path.join(dir, "sen-GA.ndjson"));
    const r2 = await recordCapture(dir, input());
    assert.equal(r2.outcome, "NEW");
    assert.equal(r2.captureId, r1.captureId);
  });
});

test("unsafe race ids and invalid input are refused", async () => {
  await withDir(async (dir) => {
    await assert.rejects(recordCapture(dir, input({ raceId: "../escape" })), (e: unknown) => e instanceof CaptureError && e.code === "INVALID_RACE_ID");
    await assert.rejects(recordCapture(dir, input({ observations: [] })), (e: unknown) => e instanceof CaptureError && e.code === "NO_OBSERVATIONS");
    await assert.rejects(recordCapture(dir, input({ observedAt: "not a date" })), (e: unknown) => e instanceof CaptureError && e.code === "INVALID_DATE");
    await assert.rejects(recordCapture(dir, input({ observations: [topline(-1, 2)] })), (e: unknown) => e instanceof CaptureError && e.code === "INVALID_VOTES");
  });
});

// ---- replay reader ---------------------------------------------------------------------------------------------------

const base = { raceId: "sen-GA", baseline: BASE_SEN, research: [], expectedJurisdictions: null, forecastExpectedTotal: null, forecastSource: null };
const certified = { raceId: "sen-GA", margin: 1.5, votes: { a: 100, b: 102, o: 3 }, certifiedAt: "2026-11-20T00:00:00Z", sourceUrl: "https://example.org/SYNTHETIC/cert" };

test("replay with no snapshots is BLOCKED and says so; nothing is fabricated", async () => {
  await withDir(async (dir) => {
    const loaded = await loadCapturesForReplay(dir, "sen-GA");
    const r = backtestFromCaptures(loaded, certified, base);
    assert.equal(r.status, "BLOCKED");
    assert.match(r.reasons.join(" "), /no captured snapshots/);
    assert.equal(r.stepsUsed, 0);
    assert.equal(r.summary, null);
  });
});

test("replay is BLOCKED without a source timestamp and without a certified result", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input({ sourceTimestamp: null, observations: [topline(1, 2, 0, { sourceTimestamp: null })] }));
    const noTs = backtestFromCaptures(await loadCapturesForReplay(dir, "sen-GA"), certified, base);
    assert.equal(noTs.status, "BLOCKED");
    assert.match(noTs.reasons.join(" "), /no source timestamp/);
  });
  await withDir(async (dir) => {
    await recordCapture(dir, input());
    const noCert = backtestFromCaptures(await loadCapturesForReplay(dir, "sen-GA"), null, base);
    assert.equal(noCert.status, "BLOCKED");
    assert.match(noCert.reasons.join(" "), /no certified result/);
  });
});

test("replay consumes timestamped snapshots, evaluates each when it was first observed, and excludes test data", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input({ a: 100, b: 110, sourceTimestamp: T(0), observedAt: T(1) }));
    await recordCapture(dir, input({ a: 160, b: 170, sourceTimestamp: T(3), observedAt: T(4) }));
    await recordCapture(dir, input({ a: 1, b: 1, sourceTimestamp: T(5), observedAt: T(6), observations: [topline(1, 1, 0, { sourceTimestamp: T(5), test: true })] }));
    const loaded = await loadCapturesForReplay(dir, "sen-GA");
    assert.deepEqual(loaded.steps.map((s) => s.at), [T(1), T(4)]);
    assert.deepEqual(loaded.excluded.map((e) => e.reason), ["TEST_DATA"]);
    assert.ok(loaded.archive && /^[0-9a-f]{64}$/.test(loaded.archive.sha256));
    const r = backtestFromCaptures(loaded, certified, base);
    assert.equal(r.status, "COMPLETED");
    assert.equal(r.checkpoints.length, 2);
    assert.deepEqual(r.checkpoints.map((c) => c.at), [T(1), T(4)]);
  });
});

test("a tampered payload is excluded, not replayed", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input());
    const v = foldLedger(await readLedger(dir, "sen-GA"))[0];
    const f = path.join(dir, v.payloadRef);
    const body = JSON.parse(await readFile(f, "utf8"));
    body.raw.a = 12345;
    await writeFile(f, JSON.stringify(body), "utf8");
    const loaded = await loadCapturesForReplay(dir, "sen-GA");
    assert.equal(loaded.steps.length, 0);
    assert.deepEqual(loaded.excluded.map((e) => e.reason), ["PAYLOAD_HASH_MISMATCH"]);
  });
});

test("knowledge time: a correction observed after the cutoff does not enter an earlier replay", async () => {
  await withDir(async (dir) => {
    await recordCapture(dir, input({ a: 100, b: 110, sourceTimestamp: T(0), observedAt: T(1) }));
    await recordCapture(dir, input({ a: 100, b: 118, sourceTimestamp: T(0), observedAt: T(9) }));
    const early = await loadCapturesForReplay(dir, "sen-GA", { knownAt: T(5) });
    assert.equal(early.steps.length, 1);
    const full = await loadCapturesForReplay(dir, "sen-GA");
    assert.deepEqual(full.steps.map((s) => s.flag), ["LIVE", "CORRECTED"]);
    assert.equal(backtestFromCaptures(full, certified, base).corrections, 1);
  });
});
