// PostgresStore against a real PostgreSQL. Skipped unless RECORDER_PG_TEST_URL names a disposable database called `oop`
// on this machine (it is emptied between tests), e.g. a throwaway container:
//   docker run -d --rm --name oop-test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=oop -p 127.0.0.1:55433:5432 postgres:17
//   RECORDER_PG_TEST_URL=postgres://postgres:test@127.0.0.1:55433/oop npm run -s test:intelligence
// The suite never connects anywhere else.

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";
import type { CDetail, XRace } from "../../app/results/2026/live";
import { checkKey, resolveStore, type ObjectStore } from "../../app/lib/intelligence/captureStore";
import { checkDatabaseUrl, isRetryable, postgresPool, PostgresStore } from "../../app/lib/intelligence/postgresStore";
import { runTick } from "../../app/lib/intelligence/captureRunner";
import { compareReplay, computePublicEngine, listCheckpoints, readCheckpoint, replayArchive, type ModelIdentity } from "../../app/lib/intelligence/checkpointArchive";
import { PUBLIC_HEAD, publishCheckpoint, readPublicSnapshot, readTimeline } from "../../app/lib/intelligence/publicSnapshot";
import { readHealth, recorderWindows, restoreAt, runSlot, slotKey, verifyArchive, type FetchPublished, type SlotDeps } from "../../app/lib/intelligence/ghRecorder";
import { Clock, ELECTION_NIGHT, FAKE_IDS, FakeProvider, FlakyStore, RACES, rig, sen, testConfig } from "./captureFixtures";

const URL_ = process.env.RECORDER_PG_TEST_URL;
const local = (() => { try { const u = new URL(URL_ ?? ""); return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(u.hostname) && u.pathname === "/oop"; } catch { return false; } })();
const skip = !URL_ ? "set RECORDER_PG_TEST_URL to a disposable local database named oop" : !local ? "RECORDER_PG_TEST_URL must be a database named oop on this machine" : false;

const V: ModelIdentity = { name: "onpoint-results-live", version: "commit-test", configSha256: "a".repeat(64) };
const MIN = 60_000;
const J = "application/json";
let admin: Pool;
let store: PostgresStore;

const fresh = (extra: Parameters<typeof postgresPool>[1] = {}, tag = "") => new PostgresStore(postgresPool(`${URL_}${URL_!.includes("?") ? "&" : "?"}application_name=t${tag || Math.random().toString(36).slice(2)}`, extra), checkKey, async () => {});

let migration = "";
before(async () => {
  if (skip) return;
  admin = postgresPool(URL_!);
  migration = await readFile(path.join(process.cwd(), "db/migrations/20261031_recorder_objects.sql"), "utf8");
  store = new PostgresStore(admin, checkKey);
});
after(async () => { if (!skip) await admin.end(); });
// every test starts from an empty, freshly migrated schema (the migration is applied twice: it must be idempotent)
beforeEach(async () => {
  if (skip) return;
  await admin.query("DROP SCHEMA IF EXISTS onpoint CASCADE");
  await admin.query(migration);
  await admin.query(migration);
});

test("the URL check fails closed: wrong database, bad escapes, no TLS off this machine", { skip: false }, () => {
  const env = {};
  assert.match(checkDatabaseUrl(undefined, env)!, /missing/);
  assert.match(checkDatabaseUrl("postgres://u:p%zz@db.example:5432/oop?sslmode=verify-full", env)!, /percent/);
  assert.match(checkDatabaseUrl("postgres://u:p@db.example:5432/users?sslmode=verify-full", env)!, /oop/);
  assert.match(checkDatabaseUrl("mysql://u:p@db.example/oop", env)!, /PostgreSQL/);
  assert.match(checkDatabaseUrl("postgres://u:p@db.example:5432/oop", env)!, /TLS/);
  assert.match(checkDatabaseUrl("postgres://u:p@db.example:5432/oop?sslmode=prefer", env)!, /TLS/);
  assert.equal(checkDatabaseUrl("postgres://u:p%40x@db.example:5432/oop?sslmode=verify-full", env), null);
  assert.equal(checkDatabaseUrl("postgres://u:p@127.0.0.1:5432/oop", env), null);
  const r = resolveStore({ INTELLIGENCE_CAPTURE_STORE: "postgres", ONPOINT_DATABASE_URL: "postgres://u:secret@db.example/oop" });
  assert.equal(r.store, null, "no fallback to another store");
  assert.ok(!r.problem!.includes("secret"), "the credential is never echoed");
  assert.equal(resolveStore({ INTELLIGENCE_CAPTURE_STORE: "postgres", ONPOINT_DATABASE_URL: "postgres://u:p@db.example/oop?sslmode=verify-full" }).store?.kind, "postgres");
  assert.ok(isRetryable({ code: "ECONNRESET" }) && isRetryable({ code: "57P01" }) && isRetryable(new Error("Query read timeout")));
  assert.ok(!isRetryable({ code: "23505" }) && !isRetryable({ code: "P0001" }));
});

test("objects: write-once, deduplicated, verified on read, listed by escaped prefix", { skip }, async () => {
  const a = Buffer.from('{"v":1}'), b = Buffer.from('{"v":2}');
  assert.equal(await store.putIfAbsent("raw/2026-11-04/x_1.json", a, J), "CREATED");
  assert.equal(await store.putIfAbsent("raw/2026-11-04/x_1.json", b, J), "EXISTS");
  assert.deepEqual(await store.get("raw/2026-11-04/x_1.json"), a, "the first write wins");
  assert.equal(await store.get("raw/none.json"), null);
  await store.putIfAbsent("raw/2026-11-04/x_10.json", a, J);
  await store.putIfAbsent("raw/2026-11-04/xa1.json", a, J);
  await store.putIfAbsent("raw/2026-11-04/sub/deeper.json", a, J);
  assert.deepEqual(await store.list("raw/2026-11-04/x_"), ["raw/2026-11-04/x_1.json", "raw/2026-11-04/x_10.json"], "_ is literal, not a wildcard");
  assert.deepEqual([...(await store.readDir("raw/2026-11-04")).keys()], ["raw/2026-11-04/x_1.json", "raw/2026-11-04/x_10.json", "raw/2026-11-04/xa1.json"], "one level only");
  await assert.rejects(() => store.put("raw/2026-11-04/x_1.json", b, J), (e: { code?: string }) => e.code === "IMMUTABLE_KEY");
  await assert.rejects(() => store.putIfAbsent("../etc/passwd", a, J));
  await store.put("heads/h.json", a, J);
  await store.put("heads/h.json", b, J);
  await store.put("public/timeline/civic-1.json", a, J);
  await store.put("public/timeline/civic-1.json", b, J);
  assert.deepEqual(await store.get("heads/h.json"), b);
  assert.deepEqual(await store.get("public/timeline/civic-1.json"), b);
  const many = await Promise.all(Array.from({ length: 12 }, (_, i) => store.putIfAbsent("raw/race.json", Buffer.from(String(i)), J)));
  assert.equal(many.filter((x) => x === "CREATED").length, 1, "concurrent writers: exactly one wins");
});

test("the database itself refuses to change or delete evidence, even for a direct SQL client", { skip }, async () => {
  await store.putIfAbsent("raw/e.json", Buffer.from("x"), J);
  await store.put("heads/h.json", Buffer.from("x"), J);
  await assert.rejects(() => admin.query("UPDATE onpoint.recorder_objects SET body = 'y' WHERE object_key = 'raw/e.json'"), /cannot be overwritten/);
  await assert.rejects(() => admin.query("DELETE FROM onpoint.recorder_objects WHERE object_key = 'raw/e.json'"), /cannot be deleted/);
  await assert.rejects(() => admin.query("DELETE FROM onpoint.recorder_objects WHERE object_key = 'heads/h.json'"), /cannot be deleted/);
  await assert.rejects(() => admin.query("UPDATE onpoint.recorder_objects SET object_key = 'heads/z.json' WHERE object_key = 'heads/h.json'"), /cannot be changed/);
  const { rows } = await admin.query("SELECT created_at < updated_at AS moved FROM onpoint.recorder_objects WHERE object_key = 'raw/e.json'");
  assert.equal(rows[0].moved, false);

  await assert.rejects(() => admin.query("TRUNCATE onpoint.recorder_objects"), /cannot be truncated/);
  await assert.rejects(() => admin.query("INSERT INTO onpoint.recorder_objects (object_key, body, content_type, sha256) VALUES ('raw/f.json', 'x', 'text/plain', repeat('0', 64))"), /recorder_sha256_matches_body/);

  // even with the triggers switched off by the table owner, a body cannot drift from its digest
  await admin.query("ALTER TABLE onpoint.recorder_objects DISABLE TRIGGER USER");
  try { await assert.rejects(() => admin.query("UPDATE onpoint.recorder_objects SET body = 'tampered' WHERE object_key = 'raw/e.json'"), /recorder_sha256_matches_body/); }
  finally { await admin.query("ALTER TABLE onpoint.recorder_objects ENABLE TRIGGER USER"); }
  assert.deepEqual(await store.get("raw/e.json"), Buffer.from("x"));

  // and if the constraint were dropped too, the read check refuses the object
  const forged = { query: async () => ({ rows: [{ object_key: "raw/e.json", body: Buffer.from("tampered"), sha256: "0".repeat(64) }], rowCount: 1 }) };
  const reader = new PostgresStore(forged as unknown as Pool, checkKey);
  await assert.rejects(() => reader.get("raw/e.json"), (e: { code?: string }) => e.code === "INTEGRITY");
  await assert.rejects(() => reader.readDir("raw"), (e: { code?: string }) => e.code === "INTEGRITY");
});

test("recorder slots: raw, calculated and published layers recorded, verified, restored; a repeat slot records nothing", { skip }, async () => {
  const clock = new Clock(Date.parse("2026-11-04T01:03:00Z"));
  const provider = new FakeProvider(clock);
  let n = 0;
  const pub: FetchPublished = async (url) => ({ status: url.includes("public-snapshot") ? 404 : 200, body: Buffer.from(JSON.stringify({ asOf: "2026-11-03", races: [{ id: "sen-GA" }] })), ms: 3, headers: {} });
  const deps = (s: ObjectStore): SlotDeps => ({
    store: s, fetchText: provider.fetchText, fetchPublished: pub, now: clock.now, races: RACES, config: testConfig({ windows: recorderWindows() }),
    archive: { now: clock.now, expFor: async () => null }, siteBase: "https://example.test", newId: () => `r${++n}`,
    context: { trigger: "SCHEDULE", githubRunId: "1", githubRunAttempt: "1", codeSha: "abc" },
  });
  sen(provider, 100, 90, "2026-11-04T01:00:00Z");
  assert.equal((await runSlot(deps(store))).outcome, "RECORDED");
  const count = (await store.list("")).length;
  clock.advance(4 * MIN);
  assert.equal((await runSlot(deps(store))).outcome, "ALREADY_RECORDED");
  assert.equal((await store.list("")).length, count);

  // a separate process (new pool) picks up where the first left off
  const second = fresh();
  clock.advance(6 * MIN);
  sen(provider, 200, 150, "2026-11-04T01:12:00Z");
  provider.mode = "down";
  assert.equal((await runSlot(deps(second))).outcome, "FAILED");
  provider.mode = "ok";
  clock.advance(10 * MIN);
  assert.equal((await runSlot(deps(second))).outcome, "RECORDED");
  const h = (await readHealth(second))!;
  assert.equal(h.consecutiveFailures, 0);
  assert.equal(h.lastRecordedSlot, "2026-11-04T01:20:00.000Z");

  const rep = await verifyArchive(second, "2026-11-04", "2026-11-04");
  assert.deepEqual(rep.problems, []);
  assert.equal(rep.slots, 3);
  const at = await restoreAt(second, "2026-11-04T01:15:00Z");
  assert.equal(at!.record.slot, "2026-11-04T01:00:00.000Z", "the failed slot is skipped");
  assert.ok(at!.checkpoint && at!.checkpoint.problems.length === 0);
  assert.ok(await second.get(slotKey("2026-11-04T01:20:00.000Z")));
});

test("publications: sequential, duplicate, out of order, timeline, restart and replay", { skip }, async () => {
  const flaky = new FlakyStore(store);
  const r = rig({ store: flaky, t: ELECTION_NIGHT });
  const tick = async () => { const o = await runTick({ ...r.deps(), archive: { now: r.clock.now, expFor: async () => null, engine: V, raceHistory: true, publicationReady: true } }, { trigger: "CRON", force: true }); r.clock.advance(MIN); return o; };

  sen(r.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await tick();
  sen(r.provider, 1200, 900, "2026-11-04T01:01:00Z");
  await tick();
  const [k1, k2] = await listCheckpoints(store, "2026-11-04", "2026-11-04");
  const p1 = (await readCheckpoint(store, k1))!.publication!, p2 = (await readCheckpoint(store, k2))!.publication!;
  assert.equal(p2.previousPublicationId, p1.publicationId, "the publication history is a chain");
  assert.equal((await readPublicSnapshot(store))!.publicationId, p2.publicationId);
  assert.deepEqual(await publishCheckpoint(store, k2, r.clock.now), { status: "NOT_PUBLISHED", code: "ALREADY_PUBLISHED" });

  // two checkpoints archived while the document store is failing, then published in the wrong order
  flaky.failPrefix = "public/snapshots/";
  sen(r.provider, 1300, 950, "2026-11-04T01:02:00Z");
  await tick();
  sen(r.provider, 1400, 1000, "2026-11-04T01:03:00Z");
  await tick();
  flaky.failPrefix = null;
  const [, , k3, k4] = await listCheckpoints(store, "2026-11-04", "2026-11-04");
  assert.equal((await publishCheckpoint(store, k4, r.clock.now)).status, "PUBLISHED");
  assert.deepEqual(await publishCheckpoint(store, k3, r.clock.now), { status: "NOT_PUBLISHED", code: "OUT_OF_ORDER" });
  assert.equal((await readPublicSnapshot(store))!.checkpointId, (await readCheckpoint(store, k4))!.manifest.checkpointId);

  const tl = await readTimeline(store, FAKE_IDS["sen-GA"]);
  assert.deepEqual(tl.map((e) => e.candidates.map((c) => c.votes)), [[1000, 900], [1200, 900], [1400, 1000]], "the timeline is in order and never shows the skipped checkpoint");
  assert.ok(tl.every((e, i) => i === 0 || e.publishedAt > tl[i - 1].publishedAt));

  // restart: a new process reads the same history and continues the chain
  const again = fresh();
  for (const k of [k1, k2, k3, k4]) assert.deepEqual((await readCheckpoint(again, k))!.problems, []);
  const r2 = rig({ store: again, t: r.clock.t + MIN });
  sen(r2.provider, 1500, 1000, "2026-11-04T01:05:00Z");
  await runTick({ ...r2.deps(), newId: () => "restart1", archive: { now: r2.clock.now, expFor: async () => null, engine: V, raceHistory: true, publicationReady: true } }, { trigger: "CRON", force: true });
  const k5 = (await listCheckpoints(again, "2026-11-04", "2026-11-04")).at(-1)!;
  assert.equal((await readCheckpoint(again, k5))!.publication!.previousPublicationId, (await readCheckpoint(again, k4))!.publication!.publicationId);
  assert.equal((await readTimeline(again, FAKE_IDS["sen-GA"])).length, 4);

  // replay into a separate dataset leaves every original object as it was
  const before = new Map<string, string>();
  for (const k of await store.list("")) if (!k.startsWith("heads/")) before.set(k, (await store.get(k))!.toString("base64"));
  const V2: ModelIdentity = { name: "onpoint-2028", version: "v1", configSha256: "d".repeat(64) };
  const rep = await replayArchive(store, { datasetId: "pg-replay", model: V2, raceOf: (id) => RACES.find((x) => x.id === id) ?? null, expFor: async () => null, now: r.clock.now, compute: (race: XRace, d: CDetail, e) => computePublicEngine(race, d, e) });
  assert.equal(rep.written.length, 5);
  const rows = await compareReplay(store, "pg-replay", V2, "sen-GA");
  assert.equal(rows.length, 5);
  for (const row of rows) assert.deepEqual(row.replay!.raw, row.original.raw);
  for (const [k, v] of before) assert.equal((await store.get(k))!.toString("base64"), v, `${k} unchanged by replay`);
  assert.ok(await store.get(PUBLIC_HEAD));
});

test("a dropped connection is retried; a retried insert that had already committed is still ours", { skip }, async () => {
  const s = fresh({}, "drop");
  await s.putIfAbsent("raw/warm.json", Buffer.from("w"), J);
  const killed = await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'tdrop'");
  assert.ok(killed.rowCount! >= 1, "the store's connection was terminated");
  assert.equal(await s.putIfAbsent("raw/after-drop.json", Buffer.from("a"), J), "CREATED", "the pool reconnects");
  assert.deepEqual(await s.get("raw/after-drop.json"), Buffer.from("a"));

  // the first attempt commits, then the connection is lost before the answer arrives
  const pool = postgresPool(URL_! + "?application_name=tlost");
  let first = true;
  const lossy = { query: async (sql: string, args: unknown[]) => { const res = await pool.query(sql, args); if (first) { first = false; throw Object.assign(new Error("Connection terminated unexpectedly"), {}); } return res; } };
  const s2 = new PostgresStore(lossy as unknown as Pool, checkKey, async () => {});
  assert.equal(await s2.putIfAbsent("raw/lost-ack.json", Buffer.from("mine"), J), "CREATED");
  await store.putIfAbsent("raw/theirs.json", Buffer.from("theirs"), J);
  first = true;
  assert.equal(await s2.putIfAbsent("raw/theirs.json", Buffer.from("mine"), J), "EXISTS", "someone else's object is not claimed");
});

test("a database that stops answering fails the call within the timeout, and the store recovers afterwards", { skip }, async () => {
  const s = fresh({ query_timeout: 400, statement_timeout: 400, connectionTimeoutMillis: 1_000 }, "hang");
  await s.putIfAbsent("raw/pre.json", Buffer.from("p"), J);
  const locker = await admin.connect();
  try {
    await locker.query("BEGIN");
    await locker.query("LOCK TABLE onpoint.recorder_objects IN ACCESS EXCLUSIVE MODE");
    const t0 = Date.now();
    await assert.rejects(() => s.get("raw/pre.json"));
    const took = Date.now() - t0;
    assert.ok(took < 4_000, `gave up after ${took} ms`);
    await locker.query("ROLLBACK");
  } finally { locker.release(); }
  assert.deepEqual(await s.get("raw/pre.json"), Buffer.from("p"), "working again once the database answers");
});
