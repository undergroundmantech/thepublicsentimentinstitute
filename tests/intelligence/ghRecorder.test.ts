// SYNTHETIC test data only. Checks the GitHub flight recorder's slots: idempotency, missed cycles, outages, invalid
// payloads, integrity and restore. No election is represented.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FsStore, MemoryStore, type ObjectStore } from "../../app/lib/intelligence/captureStore";
import { readHealth, recorderWindows, restoreAt, runSlot, slotKey, slotOf, slotsBetween, verifyArchive, type FetchPublished, type SlotDeps } from "../../app/lib/intelligence/ghRecorder";
import { Clock, FakeProvider, RACES, sen, testConfig } from "./captureFixtures";

const T0 = Date.parse("2026-11-04T01:03:00Z");
const MIN = 60_000;

function published(mode: { status?: number; body?: string; down?: boolean } = {}): FetchPublished {
  return async (url) => {
    if (mode.down) throw Object.assign(new Error("offline"), { code: "ECONNREFUSED" });
    const body = Buffer.from(mode.body ?? JSON.stringify({ asOf: "2026-11-03", races: [{ id: "sen-GA" }], url }));
    return { status: url.includes("public-snapshot") ? 404 : mode.status ?? 200, body, ms: 3, headers: { age: "1" } };
  };
}

function rig(store: ObjectStore = new MemoryStore(), t = T0) {
  const clock = new Clock(t);
  const provider = new FakeProvider(clock);
  let n = 0;
  let pub = published();
  const deps = (): SlotDeps => ({
    store, fetchText: provider.fetchText, fetchPublished: pub, now: clock.now, races: RACES, config: testConfig({ windows: recorderWindows() }),
    archive: { now: clock.now, expFor: async () => null }, siteBase: "https://example.test", newId: () => `r${++n}`,
    context: { trigger: "SCHEDULE", githubRunId: "1", githubRunAttempt: "1", codeSha: "abc" },
  });
  return { clock, provider, store, slot: () => runSlot(deps()), setPublished: (f: FetchPublished) => { pub = f; } };
}

test("slots are the UTC ten-minute floor", () => {
  assert.equal(slotOf(new Date("2026-11-04T01:09:59.999Z")), "2026-11-04T01:00:00.000Z");
  assert.equal(slotKey("2026-11-04T01:10:00.000Z"), "slots/2026-11-04/20261104T011000.000Z.json");
  assert.deepEqual(slotsBetween("2026-11-04T01:00:00.000Z", "2026-11-04T01:30:00.000Z"), ["2026-11-04T01:10:00.000Z", "2026-11-04T01:20:00.000Z"]);
});

test("a slot records raw, calculated and published layers, and a repeat run in the same slot records nothing", async () => {
  const r = rig();
  sen(r.provider, 100, 90, "2026-11-04T01:00:00Z");
  const a = await r.slot();
  assert.equal(a.outcome, "RECORDED");
  assert.ok(a.record!.checkpoint!.present && a.record!.checkpoint!.complete);
  assert.ok(a.record!.files.some((f) => f.key.startsWith("raw/")));
  assert.ok(a.record!.files.some((f) => f.key.startsWith("published/raw/")));
  assert.equal(a.record!.published.find((p) => p.name === "public-snapshot")!.status, 404);
  const before = (await r.store.list("")).length;
  const requests = r.provider.requests.length;
  r.clock.advance(4 * MIN);
  const b = await r.slot();
  assert.equal(b.outcome, "ALREADY_RECORDED");
  assert.equal((await r.store.list("")).length, before);
  assert.equal(r.provider.requests.length, requests, "a recorded slot makes no provider requests");
});

test("missed cycles are named in the next record and counted in health, never backfilled", async () => {
  const r = rig();
  await r.slot();
  r.clock.advance(35 * MIN);
  const b = await r.slot();
  assert.deepEqual(b.record!.missedSlots, ["2026-11-04T01:10:00.000Z", "2026-11-04T01:20:00.000Z"]);
  assert.equal(b.record!.delaySeconds, 8 * 60);
  const h = await readHealth(r.store);
  assert.equal(h!.missedTotal, 2);
  assert.equal(await r.store.get(slotKey("2026-11-04T01:10:00.000Z")), null);
});

test("a provider outage writes a FAILED record and counts consecutive failures; recovery resets them", async () => {
  const r = rig();
  r.provider.mode = "down";
  assert.equal((await r.slot()).outcome, "FAILED");
  r.clock.advance(10 * MIN);
  assert.equal((await r.slot()).outcome, "FAILED");
  assert.equal((await readHealth(r.store))!.consecutiveFailures, 2);
  r.provider.mode = "ok";
  r.clock.advance(10 * MIN);
  assert.equal((await r.slot()).outcome, "RECORDED");
  const h = await readHealth(r.store);
  assert.equal(h!.consecutiveFailures, 0);
  assert.equal(h!.lastRecordedSlot, "2026-11-04T01:20:00.000Z");
});

test("an invalid published payload is kept as evidence and marks the slot PARTIAL", async () => {
  const r = rig();
  r.setPublished(published({ body: "<html>error</html>" }));
  const a = await r.slot();
  assert.equal(a.outcome, "PARTIAL");
  const idx = a.record!.published.find((p) => p.name === "results-index")!;
  assert.equal(idx.error, "MALFORMED_JSON");
  assert.ok(idx.key && (await r.store.get(idx.key)));
});

test("a production outage leaves the civicAPI layers intact and marks the slot PARTIAL", async () => {
  const r = rig();
  r.setPublished(published({ down: true }));
  const a = await r.slot();
  assert.equal(a.outcome, "PARTIAL");
  assert.ok(a.record!.checkpoint!.present);
  assert.ok(a.record!.published.every((p) => p.error === "ECONNREFUSED"));
});

test("a provider 5xx on one race marks the slot PARTIAL with the error recorded", async () => {
  const r = rig();
  r.provider.failing.set("/race/103", "http500");
  const a = await r.slot();
  assert.equal(a.outcome, "PARTIAL");
  assert.ok(a.record!.run!.errors.some((e) => e.code === "HTTP_500"));
});

test("verification passes on an intact archive and catches tampering, deletion and a forged record", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ghrec-"));
  try {
    const store = new FsStore(dir);
    const r = rig(store);
    sen(r.provider, 100, 90, "2026-11-04T01:00:00Z");
    await r.slot();
    r.clock.advance(10 * MIN);
    sen(r.provider, 200, 150, "2026-11-04T01:12:00Z");
    await r.slot();
    const ok = await verifyArchive(store, "2026-11-04", "2026-11-04");
    assert.deepEqual(ok.problems, []);
    assert.equal(ok.slots, 2);
    assert.equal(ok.checkpoints, 2);

    const rec = JSON.parse((await store.get(slotKey("2026-11-04T01:00:00.000Z")))!.toString());
    const raw = rec.files.find((f: { key: string }) => f.key.startsWith("raw/")).key;
    await writeFile(path.join(dir, raw), "tampered");
    const pub = rec.published[0].key;
    await rm(path.join(dir, pub));
    const forged = { ...rec, status: "RECORDED", delaySeconds: 0 };
    await writeFile(path.join(dir, slotKey("2026-11-04T01:10:00.000Z")), JSON.stringify(forged));
    const bad = await verifyArchive(store, "2026-11-04", "2026-11-04");
    assert.ok(bad.problems.some((p) => p.includes(raw) && p.includes("hash mismatch")));
    assert.ok(bad.problems.some((p) => p.includes(pub) && p.includes("missing")));
    assert.ok(bad.problems.some((p) => p.includes("checksum mismatch")));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("restore returns the latest finished slot at a time, skips failed slots and never sees the future", async () => {
  const r = rig();
  sen(r.provider, 100, 90, "2026-11-04T01:00:00Z");
  await r.slot();
  const firstDone = r.clock.iso();
  r.clock.advance(10 * MIN);
  r.provider.mode = "down";
  await r.slot();
  r.provider.mode = "ok";
  r.clock.advance(10 * MIN);
  await r.slot();
  const mid = await restoreAt(r.store, new Date(Date.parse(firstDone) + 15 * MIN).toISOString());
  assert.equal(mid!.record.slot, "2026-11-04T01:00:00.000Z", "the failed 01:10 slot is skipped");
  assert.ok(mid!.published["results-index"]);
  assert.ok(mid!.checkpoint && mid!.checkpoint.problems.length === 0);
  assert.equal(await restoreAt(r.store, "2026-11-04T00:59:00Z"), null);
});

test("after the capture window ends, scheduled runs record nothing", async () => {
  const r = rig(new MemoryStore(), Date.parse("2026-12-01T00:05:00Z"));
  assert.equal((await r.slot()).outcome, "WINDOW_ENDED");
  assert.deepEqual(await r.store.list(""), []);
});
