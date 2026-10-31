// SYNTHETIC test data only. These tests check the capture endpoint's authentication, limits and failure behaviour.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FailureLimiter, handleCapture, MIN_SECRET_LENGTH, type HandlerDeps } from "../../app/lib/intelligence/captureHandler";
import { FsStore, MemoryStore, type ObjectStore } from "../../app/lib/intelligence/captureStore";
import { Clock, ELECTION_NIGHT, EXPECTED, FakeProvider, FlakyStore, RACES, testConfig } from "./captureFixtures";

const CRON = "c".repeat(MIN_SECRET_LENGTH + 8);
const MANUAL = "m".repeat(MIN_SECRET_LENGTH + 8);
const URL0 = "https://tpsi.test/api/intelligence/capture";

function setup(over: Partial<Omit<HandlerDeps, "store">> & { store?: ObjectStore | null; problem?: string | null } = {}) {
  const clock = new Clock(ELECTION_NIGHT);
  const provider = new FakeProvider(clock);
  const { store: given, problem, ...rest } = over;
  const store = given === undefined ? new MemoryStore() : given;
  const deps: HandlerDeps = {
    env: { CRON_SECRET: CRON, INTELLIGENCE_CAPTURE_SECRET: MANUAL },
    store: () => ({ store, problem: problem ?? null }),
    tracked: async () => ({ races: RACES, expected: EXPECTED, missing: [] }),
    fetchText: provider.fetchText, now: clock.now, limiter: new FailureLimiter(), config: testConfig(), ...rest,
  };
  const call = (method: string, qs = "", headers: Record<string, string> = {}) => handleCapture(new Request(`${URL0}${qs}`, { method, headers }), deps);
  const get = (secret: string | null = CRON, qs = "", h: Record<string, string> = {}) => call("GET", qs, secret ? { authorization: `Bearer ${secret}`, ...h } : h);
  const post = (secret: string | null = MANUAL, qs = "", h: Record<string, string> = {}) => call("POST", qs, secret ? { authorization: `Bearer ${secret}`, ...h } : h);
  return { clock, provider, store, deps, call, get, post };
}
const body = async (r: Response) => JSON.parse(await r.text());
const untouched = (s: ReturnType<typeof setup>) => {
  assert.equal(s.provider.requests.length, 0);
  assert.equal((s.store as MemoryStore).objects.size, 0);
};

test("with no secret configured the route is closed, for the scheduler and for manual calls", async () => {
  const s = setup({ env: {} });
  assert.equal((await s.get()).status, 503);
  assert.equal((await s.post()).status, 503);
  untouched(s);
});

test("a secret that is too short disables the route rather than accepting a weak one", async () => {
  const s = setup({ env: { CRON_SECRET: "short", INTELLIGENCE_CAPTURE_SECRET: "also-short" } });
  assert.equal((await s.get("short")).status, 503);
  assert.equal((await s.post("also-short")).status, 503);
  untouched(s);
});

test("unauthorized requests get 401 and cause no upstream request and no write", async () => {
  const s = setup();
  for (const r of [
    await s.get(null), await s.get("wrong-secret-wrong-secret-wrong-secret"), await s.post(null), await s.post("x"),
    await s.call("GET", "", { authorization: `Basic ${Buffer.from(`u:${CRON}`).toString("base64")}` }),
    await s.call("GET", "", { authorization: CRON }),
    await s.call("GET", "", { authorization: `bearer ${CRON}` }),
    await s.call("POST", "", { cookie: "tpsi_portal=1.abc", authorization: "Bearer " }),
    await s.call("GET", "", { "x-vercel-cron": "1" }),
  ]) { assert.equal(r.status, 401); assert.deepEqual(await body(r), { error: "unauthorized" }); }
  untouched(s);
});

test("the two secrets are not interchangeable", async () => {
  const s = setup();
  assert.equal((await s.get(MANUAL)).status, 401);
  assert.equal((await s.post(CRON)).status, 401);
  untouched(s);
});

test("the scheduler credential runs a poll; unchanged polls and duplicates are safe", async () => {
  const s = setup();
  const r = await s.get();
  assert.equal(r.status, 200);
  const j = await body(r);
  assert.equal(j.due, true);
  assert.equal(j.run.ok, true);
  assert.equal(j.trackedRaces, 3);
  assert.equal((await body(await s.get())).due, false);
  assert.equal(s.provider.count("/race/search"), 3);
});

test("a manual forced poll needs the manual secret, and repeats are spaced", async () => {
  const s = setup();
  assert.equal((await s.get(CRON, "?force=1")).status, 400, "the scheduler credential cannot force");
  assert.equal((await s.post(MANUAL, "?force=1")).status, 200);
  assert.equal((await s.post(MANUAL, "?force=1")).status, 429);
  s.clock.advance(11_000);
  assert.equal((await s.post(MANUAL, "?force=1")).status, 200);
});

test("repeated failed authentication from one client is throttled, and other clients are not affected", async () => {
  const s = setup();
  const bad = (ip: string) => s.get("nope-nope-nope-nope-nope-nope-nope", "", { "x-forwarded-for": ip });
  for (let i = 0; i < 10; i++) assert.equal((await bad("203.0.113.7")).status, 401);
  assert.equal((await bad("203.0.113.7")).status, 429);
  assert.equal((await s.get(CRON, "", { "x-forwarded-for": "203.0.113.7" })).status, 429, "even the right secret is refused while throttled");
  assert.equal((await s.get(CRON, "", { "x-forwarded-for": "198.51.100.2" })).status, 200);
  s.clock.advance(61_000);
  assert.equal((await s.get(CRON, "", { "x-forwarded-for": "203.0.113.7" })).status, 200);
});

test("oversized, malformed and unexpected requests are refused", async () => {
  const s = setup();
  assert.equal((await s.post(MANUAL, "", { "content-length": "5000" })).status, 413);
  assert.equal((await s.post(MANUAL, "?foo=1")).status, 400);
  assert.equal((await s.get(CRON, "?mode=preflight")).status, 400);
  assert.equal((await s.post(MANUAL, "?mode=../../etc")).status, 400);
  assert.equal((await s.post(MANUAL, "?force=2")).status, 400);
  assert.equal((await s.call("PUT")).status, 405);
  assert.equal((await s.call("DELETE")).status, 405);
  untouched(s);
});

test("responses are never cached and never echo a secret", async () => {
  const s = setup();
  for (const r of [await s.get(), await s.get(null), await s.post(MANUAL, "?mode=preflight"), await s.call("PUT")]) {
    assert.equal(r.headers.get("cache-control"), "no-store");
    const text = await r.text();
    assert.ok(!text.includes(CRON) && !text.includes(MANUAL));
  }
});

test("without a usable store the route says so and polls nothing", async () => {
  const s = setup({ store: null, problem: "no durable store is configured" });
  const r = await s.get();
  assert.equal(r.status, 503);
  assert.equal((await body(r)).error, "store_not_configured");
  assert.equal(s.provider.requests.length, 0);
});

test("a storage failure is a 500 with no internal detail", async () => {
  const flaky = new FlakyStore();
  flaky.failWrites = true;
  const s = setup({ store: flaky });
  const r = await s.get();
  assert.equal(r.status, 500);
  const text = await r.text();
  assert.deepEqual(JSON.parse(text), { error: "storage_failure" });
  assert.ok(!/secret|path|DISK/.test(text));
});

test("a provider outage is a 502, reports error codes, and leaks no upstream text", async () => {
  const s = setup();
  s.provider.mode = "http500";
  const r = await s.get();
  assert.equal(r.status, 502);
  const text = await r.text();
  assert.ok(text.includes("HTTP_500"));
  assert.ok(!/exploded/.test(text));
});

test("preflight proves write, read-back, refusal to overwrite, listing, durability and the provider", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tpsi-pre-"));
  try {
    const s = setup({ store: new FsStore(dir) });
    const j = await body(await s.post(MANUAL, "?mode=preflight"));
    assert.equal(j.ok, true, JSON.stringify(j.checks.filter((c: { ok: boolean }) => !c.ok)));
    assert.deepEqual(j.checks.map((c: { name: string }) => c.name), ["create", "read back", "refuses overwrite", "original intact", "list", "overwrite head", "durable", "provider", "tracked races", "secrets"]);
    assert.equal(j.store.durable, true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("preflight fails on a store that is not durable, on a provider outage and on a failing store", async () => {
  const mem = setup();
  const a = await body(await mem.post(MANUAL, "?mode=preflight"));
  assert.equal(a.ok, false);
  assert.equal(a.checks.find((c: { name: string }) => c.name === "durable").ok, false);

  const down = setup();
  down.provider.mode = "down";
  assert.equal((await body(await down.post(MANUAL, "?mode=preflight"))).checks.find((c: { name: string }) => c.name === "provider").ok, false);

  const flaky = new FlakyStore();
  flaky.failWrites = true;
  const f = await body(await setup({ store: flaky }).post(MANUAL, "?mode=preflight"));
  assert.equal(f.ok, false);
  assert.equal(f.checks.find((c: { name: string }) => c.name === "store").ok, false);
  assert.ok(!JSON.stringify(f).includes(CRON) && !JSON.stringify(f).includes(MANUAL) && !/\/tmp|\/home|ENOENT/.test(JSON.stringify(f)));
});

test("preflight writes only under preflight/ and heads/preflight.json, never into race records", async () => {
  const s = setup();
  await s.post(MANUAL, "?mode=preflight");
  const keys = [...(s.store as MemoryStore).objects.keys()];
  assert.ok(keys.every((k) => k.startsWith("preflight/") || k === "heads/preflight.json"), keys.join(","));
});
