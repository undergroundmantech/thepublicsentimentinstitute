// SYNTHETIC test data only. These tests check the recorder's scheduling, polling and health, not any election.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readObservationRecords } from "../../app/lib/intelligence/capture";
import { computeHealth, readHealthInputs } from "../../app/lib/intelligence/captureHealth";
import { readTick } from "../../app/lib/intelligence/captureRunner";
import { defaultWindows, planTick, QUIET_POLLS_TO_SLOW } from "../../app/lib/intelligence/captureSchedule";
import { FsStore } from "../../app/lib/intelligence/captureStore";
import { EXPECTED, FlakyStore, MIN, rig, sen, W } from "./captureFixtures";

// ---- schedule ---------------------------------------------------------------------------------------------------------

test("the schedule moves through its phases by UTC time", () => {
  const phase = (iso: string) => planTick(iso, { lastPollAt: null, quietPolls: 0 }, W).phase;
  assert.equal(phase("2026-10-30T12:00:00Z"), "PRE_ELECTION");
  assert.equal(phase("2026-11-03T15:00:00Z"), "POLLS_OPEN");
  assert.equal(phase("2026-11-04T01:00:00Z"), "ELECTION_NIGHT");
  assert.equal(phase("2026-11-04T12:00:00Z"), "OVERNIGHT");
  assert.equal(phase("2026-11-06T12:00:00Z"), "COUNTING");
  assert.equal(phase("2026-11-12T12:00:00Z"), "CANVASS");
  assert.equal(phase("2026-12-01T00:00:00Z"), "ENDED");
});

test("a poll is due once its interval has passed, with a little tolerance for cron jitter", () => {
  const p = (lastPollAt: string, now: string) => planTick(now, { lastPollAt, quietPolls: 0 }, W);
  assert.equal(p("2026-11-04T01:00:00Z", "2026-11-04T01:00:30Z").due, false);
  assert.equal(p("2026-11-04T01:00:03Z", "2026-11-04T01:00:58Z").due, true);
  assert.equal(p("2026-11-04T01:00:00Z", "2026-11-04T01:00:46Z").due, true);
  assert.equal(planTick("2026-11-04T01:00:00Z", { lastPollAt: null, quietPolls: 0 }, W).due, true);
});

test("quiet polls slow the cadence outside election night, and election night never slows", () => {
  const quiet = { lastPollAt: "2026-11-06T12:00:00Z", quietPolls: QUIET_POLLS_TO_SLOW };
  assert.equal(planTick("2026-11-06T12:06:00Z", { ...quiet, quietPolls: 0 }, W).due, true);
  const slowed = planTick("2026-11-06T12:06:00Z", quiet, W);
  assert.equal(slowed.intervalMinutes, 10);
  assert.equal(slowed.due, false);
  assert.equal(planTick("2026-11-04T01:01:00Z", { lastPollAt: "2026-11-04T01:00:00Z", quietPolls: 99 }, W).intervalMinutes, 1);
  assert.ok(planTick("2026-11-12T12:00:00Z", { lastPollAt: null, quietPolls: 99 }, W).intervalMinutes! <= 30);
});

test("after the window ends nothing is due, except a deliberate forced poll", () => {
  const s = { lastPollAt: null, quietPolls: 0 };
  assert.equal(planTick("2026-12-01T00:00:00Z", s, W).due, false);
  assert.equal(planTick("2026-12-01T00:00:00Z", s, W, { force: true }).due, true);
  assert.equal(planTick("2026-12-01T00:00:00Z", s, defaultWindows("2026-12-20")).phase, "CANVASS");
});

// ---- one poll ---------------------------------------------------------------------------------------------------------

test("a poll reads each feed once and each tracked race once, and records them", async () => {
  const r = rig();
  sen(r.provider, 100, 90, "2026-11-04T00:59:00Z");
  const { run } = await r.tick();
  assert.ok(run);
  assert.equal(run.ok, true);
  assert.equal(r.provider.count("/race/search"), 3);
  assert.equal(r.provider.count("/race/101"), 1);
  assert.equal(new Set(r.provider.requests).size, r.provider.requests.length, "no URL requested twice in one poll");
  assert.deepEqual(run.races.map((x) => x.outcome), ["NEW", "NEW", "NEW"]);
  assert.deepEqual(run.feeds.map((x) => x.outcome).sort(), ["NEW", "NEW", "NEW"]);
  assert.equal((await readObservationRecords(r.store, "sen-GA")).records[0].record.sourceTimestamp, "2026-11-04T00:59:00.000Z");
});

test("a minute that is not due makes no upstream request but still leaves a heartbeat", async () => {
  const r = rig();
  await r.tick();
  r.provider.requests.length = 0;
  r.clock.advance(20_000);
  const { run, plan, tick } = await r.tick();
  assert.equal(run, null);
  assert.equal(plan.due, false);
  assert.equal(r.provider.requests.length, 0);
  assert.equal(tick.at, r.clock.iso());
  assert.equal((await readTick(r.store))?.due, false);
});

test("an unchanged poll is recorded as unchanged and counted as quiet; a change resets it", async () => {
  const r = rig();
  sen(r.provider, 100, 90, "2026-11-04T00:59:00Z");
  await r.tick();
  r.clock.advance(MIN);
  const quiet = await r.tick();
  assert.equal(quiet.run?.anyMaterial, false);
  assert.deepEqual(quiet.run?.races.map((x) => x.outcome), ["UNCHANGED", "UNCHANGED", "UNCHANGED"]);
  assert.equal(quiet.tick.quietPolls, 1);
  r.clock.advance(MIN);
  sen(r.provider, 150, 130, "2026-11-04T01:02:00Z");
  const changed = await r.tick();
  assert.equal(changed.run?.anyMaterial, true);
  assert.equal(changed.tick.quietPolls, 0);
  assert.equal((await readObservationRecords(r.store, "sen-GA")).records.length, 2);
});

test("a forced poll runs when nothing is due", async () => {
  const r = rig();
  await r.tick();
  r.clock.advance(5_000);
  assert.equal((await r.tick({ force: true, trigger: "MANUAL" })).run?.trigger, "MANUAL");
});

test("duplicate cron delivery at the same instant leaves one copy of every record", async () => {
  const r = rig();
  sen(r.provider, 100, 90, "2026-11-04T00:59:00Z");
  await Promise.all([r.tick(), r.tick()]);
  assert.equal((await r.store.list("obs/sen-GA/")).length, 1);
  assert.equal((await r.store.list("feed/us-senate/")).length, 1);
  assert.equal((await r.store.list("raw/")).length, new Set((await r.store.list("raw/"))).size);
});

test("a provider outage is recorded as a failed poll, with no invented data and no upstream detail", async () => {
  const r = rig();
  r.provider.mode = "down";
  const { run, tick } = await r.tick();
  assert.equal(run?.ok, false);
  assert.equal(tick.consecutiveFailures, 1);
  assert.equal(tick.lastOkPollAt, null);
  assert.equal((await r.store.list("obs/")).length, 0);
  assert.ok(run!.errors.every((e) => !/secret-host|ECONNREFUSED connect/.test(e.message)));
  assert.ok(run!.errors.some((e) => e.code === "ECONNREFUSED"));
});

test("a provider that answers 500 is an error, not data", async () => {
  const r = rig();
  r.provider.mode = "http500";
  const { run } = await r.tick();
  assert.equal(run?.ok, false);
  assert.ok(run!.errors.some((e) => e.code === "HTTP_500"));
  assert.ok(run!.errors.every((e) => !/exploded/.test(e.message)));
});

test("a feed that is not JSON is kept as raw evidence only and reported", async () => {
  const r = rig();
  r.provider.mode = "notjson";
  const { run } = await r.tick();
  assert.ok(run!.errors.some((e) => e.code === "MALFORMED_JSON"));
  assert.ok((await r.store.list("raw/")).length >= 1);
  assert.equal((await r.store.list("feed/")).length, 0);
  assert.equal((await r.store.list("obs/")).length, 0);
});

test("a feed of the wrong shape, and a race payload of the wrong shape, are reported and write no records", async () => {
  const r = rig();
  r.provider.mode = "malformed";
  assert.ok((await r.tick()).run!.errors.some((e) => e.code === "UNEXPECTED_SHAPE"));
  const r2 = rig();
  r2.provider.failing.set("/race/10", "malformed");
  const { run } = await r2.tick();
  assert.equal(run!.errors.filter((e) => e.code === "MALFORMED_PAYLOAD").length, 3);
  assert.equal((await r2.store.list("obs/")).length, 0);
  assert.ok((await r2.store.list("raw/")).length >= 1);
});

test("one failing race does not stop the others", async () => {
  const r = rig();
  r.provider.failing.set("/race/102", "down");
  const { run } = await r.tick();
  assert.equal(run?.ok, true);
  assert.deepEqual(run!.races.map((x) => `${x.raceId}:${x.outcome}`), ["gov-AZ:ERROR", "house-PA-07:NEW", "sen-GA:NEW"]);
});

test("a race the feeds do not contain is reported as unmatched, not silently dropped", async () => {
  const r = rig();
  delete r.provider.races[102];
  const { run } = await r.tick();
  assert.ok(run!.errors.some((e) => e.code === "NO_MATCH" && e.scope === "race:gov-AZ"));
  assert.equal(run!.races.find((x) => x.raceId === "gov-AZ")?.outcome, "SKIPPED");
});

test("a slow provider ends the poll at its budget and says so", async () => {
  const r = rig();
  r.provider.latencyMs = 30_000;
  const { run } = await r.tick();
  assert.equal(run?.deadlineHit, true);
  assert.ok(run!.errors.some((e) => e.code === "DEADLINE"));
});

test("a total storage failure is raised to the caller, never swallowed", async () => {
  const flaky = new FlakyStore();
  const r = rig({ store: flaky });
  flaky.failWrites = true;
  await assert.rejects(r.tick(), { code: "DISK_FULL" });
  flaky.failWrites = false;
  flaky.failReads = true;
  await assert.rejects(r.tick(), { code: "DISK_FULL" });
});

test("a partial storage failure fails the run and is recorded, with the other data kept", async () => {
  const flaky = new FlakyStore();
  flaky.failPrefix = "obs/gov-AZ/";
  const r = rig({ store: flaky });
  const { run, tick } = await r.tick();
  assert.equal(run?.ok, false);
  assert.ok(run!.errors.some((e) => e.code === "STORAGE_WRITE_FAILED" && e.scope === "race:gov-AZ"));
  assert.equal(tick.consecutiveFailures, 1);
  assert.equal((await flaky.inner.list("obs/sen-GA/")).length, 1);
  assert.ok(run!.errors.every((e) => !/secret/.test(e.message)));
});

test("restart and recovery: a new process continues from the stored tick without polling early", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tpsi-run-"));
  try {
    const first = rig({ store: new FsStore(dir) });
    sen(first.provider, 100, 90, "2026-11-04T00:59:00Z");
    await first.tick();
    const second = rig({ store: new FsStore(dir), t: first.clock.t + 20_000 });
    second.provider.races = first.provider.races;
    const early = await second.tick();
    assert.equal(early.run, null);
    second.clock.advance(MIN);
    const next = await second.tick();
    assert.equal(next.run?.races[2].outcome, "UNCHANGED");
    assert.equal((await new FsStore(dir).list("obs/sen-GA/")).length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("an ended window polls nothing", async () => {
  const r = rig({ t: Date.parse("2026-12-05T00:00:00Z") });
  const { run } = await r.tick();
  assert.equal(run, null);
  assert.equal(r.provider.requests.length, 0);
  assert.equal((await r.health()).status, "ENDED");
});

// ---- health -----------------------------------------------------------------------------------------------------------

test("health tells a missing store, a broken store and a recorder that never ran apart", async () => {
  const none = computeHealth(await readHealthInputs(null, "no durable store", "2026-11-04T01:00:00Z", EXPECTED, W));
  assert.equal(none.status, "NOT_CONFIGURED");
  const flaky = new FlakyStore();
  flaky.failReads = true;
  assert.equal(computeHealth(await readHealthInputs(flaky, null, "2026-11-04T01:00:00Z", EXPECTED, W)).status, "STORAGE_ERROR");
  assert.equal((await rig().health()).status, "NEVER_RAN");
});

test("health is HEALTHY while polls succeed and results change", async () => {
  const r = rig();
  for (let i = 0; i < 5; i++) { sen(r.provider, 100 * (i + 1), 90 * (i + 1), new Date(r.clock.t - 30_000).toISOString()); await r.tick(); r.clock.advance(MIN); }
  const h = await r.health();
  assert.equal(h.status, "HEALTHY");
  assert.equal(h.coverage.observed, 3);
  assert.equal(h.lastSourceUpdateAt !== null, true);
  assert.equal(h.uniqueMaterialUpdates >= 5, true);
});

test("a recorder that runs but receives nothing new is RUNNING_NO_NEW_DATA, not healthy and not interrupted", async () => {
  const r = rig();
  sen(r.provider, 100, 90, "2026-11-04T00:59:00Z");
  for (let i = 0; i < 40; i++) { await r.tick(); r.clock.advance(MIN); }
  const h = await r.health();
  assert.equal(h.status, "RUNNING_NO_NEW_DATA");
  assert.ok(h.alerts.some((a) => a.level === "WARNING" && /no race has changed/.test(a.message)));
});

test("a recorder whose polls keep failing is INTERRUPTED and raises a critical alert", async () => {
  const r = rig();
  sen(r.provider, 100, 90, "2026-11-04T00:59:00Z");
  await r.tick();
  r.provider.mode = "down";
  for (let i = 0; i < 8; i++) { r.clock.advance(MIN); await r.tick(); }
  const h = await r.health();
  assert.equal(h.status, "INTERRUPTED");
  assert.ok(h.alerts.some((a) => a.level === "CRITICAL" && /interrupted/.test(a.message)));
  assert.ok(h.recentErrors.length > 0);
  assert.ok(h.provider.consecutiveFailedRuns >= 8);
});

test("a scheduler that stops calling the recorder is SCHEDULER_SILENT", async () => {
  const r = rig();
  await r.tick();
  r.clock.advance(10 * MIN);
  const h = await r.health();
  assert.equal(h.status, "SCHEDULER_SILENT");
  assert.ok(h.alerts.some((a) => a.level === "CRITICAL"));
});

test("health reports test data, missing counties and replay availability", async () => {
  const r = rig({ test: true });
  await r.tick();
  const h = await r.health();
  assert.ok(h.alerts.some((a) => a.level === "INFO" && /test data/.test(a.message)));
  assert.equal(h.replay.testOnly, 3);
  assert.equal(h.replay.available, 0);
  assert.equal(h.races.find((x) => x.raceId === "sen-GA")?.jurisdictionsMissing, 0);
});

test("a non-durable store raises a critical alert", async () => {
  const r = rig();
  await r.tick();
  assert.ok((await r.health()).alerts.some((a) => a.level === "CRITICAL" && /not durable/.test(a.message)));
});

