// Canonical public snapshots, publication semantics, GitHub as the primary store, cron slot timing and the RaceDesk
// compatibility path. Everything here is SYNTHETIC.

import { test } from "node:test";
import assert from "node:assert/strict";
import { reconstructFeedAt, sha256Hex } from "../../app/lib/intelligence/capture";
import { MemoryStore, type ObjectStore } from "../../app/lib/intelligence/captureStore";
import { runCronSlots, runTick, type RunnerDeps } from "../../app/lib/intelligence/captureRunner";
import { listCheckpoints, readCheckpoint, type ArchiveDeps, type CalcRecord, type EngineOutputs, type ModelIdentity } from "../../app/lib/intelligence/checkpointArchive";
import { GitHubStore, gitBlobSha, type Fetch, type GitHubTarget } from "../../app/lib/intelligence/githubStore";
import { PUBLIC_HEAD, publishCheckpoint, readPublicSnapshot, servePublicSnapshot, type PublicSnapshotDocument } from "../../app/lib/intelligence/publicSnapshot";
import { timelineFor } from "../../app/results/_lib/publicTimeline";
import { legacyCaptureGate } from "../../app/results/_lib/legacyCaptureGate";
import { FlakyStore, fakeRaces, rig, sen } from "./captureFixtures";

const V: ModelIdentity = { name: "onpoint-results-live", version: "commit-test", configSha256: "a".repeat(64) };
const ON = { ONPOINT_PUBLIC_SNAPSHOT: "1" };

function setup(over: Partial<ArchiveDeps> = {}, store?: ObjectStore) {
  const r = rig({ store });
  const deps = (s: ObjectStore = r.store, a: Partial<ArchiveDeps> = {}): RunnerDeps => ({ ...r.deps(), store: s, archive: { now: r.clock.now, expFor: async () => null, engine: V, raceHistory: true, publicationReady: true, ...over, ...a } });
  const tick = async (s?: ObjectStore, a?: Partial<ArchiveDeps>) => { const out = await runTick(deps(s, a), { trigger: "CRON", force: true }); r.clock.advance(60_000); return out; };
  const latest = async (s: ObjectStore = r.store) => (await readCheckpoint(s, (await listCheckpoints(s, "2026-11-03", "2026-11-05")).at(-1)!))!;
  return { ...r, deps, tick, latest };
}
const engineCalc = (cs: CalcRecord[], id: string) => cs.find((c) => c.raceId === id && c.designation === "PUBLIC_ENGINE")!;
const body = async (res: Response) => (await res.json()) as PublicSnapshotDocument;

test("1. a recomputed public-engine result is not classified as published", async () => {
  const s = setup({ publicationReady: false });
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await s.tick();
  const cp = await s.latest();
  assert.ok(cp.snapshot.every((x) => x.classification === "PUBLIC_ENGINE_RECOMPUTED_NOT_VERIFIED_PUBLISHED"));
  assert.equal(cp.manifest.publication, "NONE_BROWSER_DESK");
  assert.equal(cp.publication, null);
  const key = (await listCheckpoints(s.store, "2026-11-04", "2026-11-04"))[0];
  assert.deepEqual(await publishCheckpoint(s.store, key, s.clock.now), { status: "NOT_PUBLISHED", code: "NOT_PUBLICATION_READY" });
  assert.equal(await s.store.get(PUBLIC_HEAD), null);
  assert.equal((await servePublicSnapshot(ON, () => s.store)).status, 503, "nothing to serve");
});

test("2 + 5. the publication references the exact output served, and shadow output never reaches the endpoint", async () => {
  const shadow: ModelIdentity = { name: "intelligence-shadow", version: "s1", configSha256: "c".repeat(64) };
  const s = setup({ shadow: { model: shadow, run: () => ({ pB: 0.999 }) } });
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  const out = await s.tick();
  assert.deepEqual(out.run!.errors.filter((e) => e.scope === "publication"), []);
  const cp = await s.latest();
  const ev = cp.publication!;
  assert.equal(ev.classification, "PUBLISHED");
  assert.equal(ev.checkpointId, cp.manifest.checkpointId);
  assert.equal(ev.snapshotLayer.sha256, cp.manifest.layers.snapshot.sha256);
  assert.ok(Date.parse(ev.publishedAt) >= Date.parse(cp.manifest.archivedAt));

  const res = await servePublicSnapshot(ON, () => s.store);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("cache-control")!, /s-maxage=15/);
  const doc = await body(res);
  assert.equal(doc.publicationId, ev.publicationId);
  assert.equal(sha256Hex(Buffer.from(JSON.stringify(doc))), ev.document.sha256, "the endpoint serves the exact document the event names");
  const c = engineCalc(cp.calculated, "sen-GA");
  const served = doc.races.find((x) => x.raceId === "sen-GA")!;
  const named = ev.races.find((x) => x.raceId === "sen-GA")!;
  assert.equal(served.calculationId, c.calculationId);
  assert.equal(served.calculatedOutputSha256, c.outputSha256);
  assert.deepEqual(named, { raceId: "sen-GA", civicId: c.civicId, calculationId: c.calculationId, calculatedOutputSha256: c.outputSha256, model: V });
  assert.equal(served.displayed!.expectedFinalMarginPp, (c.outputs as EngineOutputs).expectedFinalMarginPp);

  const text = JSON.stringify(doc) + JSON.stringify(ev);
  assert.ok(cp.calculated.some((x) => x.designation === "SHADOW"), "shadow was calculated");
  assert.ok(!text.includes("0.999") && !text.includes("intelligence-shadow") && !text.includes("SHADOW"));
  assert.equal((await servePublicSnapshot({}, () => s.store)).status, 404, "off unless the flag is set");
});

test("3. a failed publication keeps raw and calculated records and creates no published event", async () => {
  const flaky = new FlakyStore();
  const s = setup({}, flaky);
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  flaky.failPrefix = "archive/2026-11-04/published/";
  const a = await s.tick();
  assert.ok(a.run!.errors.some((e) => e.scope === "publication" && e.code === "PUBLICATION_RECORD_FAILED"));
  const cp = await s.latest();
  assert.equal(cp.publication, null);
  assert.equal(engineCalc(cp.calculated, "sen-GA").status, "OK");
  assert.ok(await flaky.get(engineCalc(cp.calculated, "sen-GA").raw!.observationKey));
  assert.equal(await readPublicSnapshot(flaky), null, "the head was moved back: nothing is served without its record");

  flaky.failPrefix = null;
  await s.tick();
  const good = (await s.latest()).publication!;
  flaky.failPrefix = "public/snapshots/";
  sen(s.provider, 1100, 900, "2026-11-04T01:01:00Z");
  const c = await s.tick();
  assert.ok(c.run!.errors.some((e) => e.code === "DOCUMENT_WRITE_FAILED"));
  assert.equal((await s.latest()).publication, null);
  assert.equal((await readPublicSnapshot(flaky))!.publicationId, good.publicationId, "the previous publication stays live");
});

test("a checkpoint that finishes late is never published over newer output; a duplicate publication is refused", async () => {
  const flaky = new FlakyStore();
  const s = setup({}, flaky);
  flaky.failPrefix = "public/snapshots/"; // archive two checkpoints without publishing either
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await s.tick();
  sen(s.provider, 1200, 900, "2026-11-04T01:00:30Z");
  await s.tick();
  flaky.failPrefix = null;
  const [older, newer] = await listCheckpoints(flaky, "2026-11-04", "2026-11-04");
  const pub = await publishCheckpoint(flaky, newer, s.clock.now);
  assert.equal(pub.status, "PUBLISHED");
  assert.deepEqual(await publishCheckpoint(flaky, older, s.clock.now), { status: "NOT_PUBLISHED", code: "OUT_OF_ORDER" });
  assert.deepEqual(await publishCheckpoint(flaky, newer, s.clock.now), { status: "NOT_PUBLISHED", code: "ALREADY_PUBLISHED" });
  const live = (await readPublicSnapshot(flaky))!;
  assert.equal(live.publicationId, (pub as { event: { publicationId: string } }).event.publicationId, "the newer publication stays live");
  assert.equal((await readCheckpoint(flaky, older))!.publication, null, "the older checkpoint stays archived and unpublished");
});

test("9. untracked nationwide contests keep their raw rows and are recorded as calculation-unavailable", async () => {
  const s = setup();
  s.provider.races[555] = { ...fakeRaces()[101], id: 555, province: "OH", names: ["Golf", "Hotel"], votes: { d: 10, r: 20, o: 0 } };
  await s.tick();
  const cp = await s.latest();
  const u = cp.calculated.find((c) => c.raceId === "civic-555")!;
  assert.equal(u.status, "UNAVAILABLE");
  assert.equal(u.contest!.province, "OH");
  assert.ok(!cp.publication!.races.some((r) => r.raceId === "civic-555"));
  const feed = await reconstructFeedAt(s.store, "US Senate", s.clock.iso());
  assert.match(JSON.stringify(feed.rows.get(555)), /Golf/);
});

// ---- GitHub as the primary store ---------------------------------------------------------------------------------------

function fakeRepo() {
  const commits = new Map<string, { files: Record<string, string>; parent: string | null }>([["c0", { files: {}, parent: null }]]);
  const trees = new Map<string, Record<string, string>>();
  const st = { ref: "c0", n: 0, failPatch: 0, requests: 0 };
  const root = (sha: string) => { const [id] = sha.split("|"); return id.startsWith("T") ? trees.get(id)! : commits.get(id)!.files; };
  const under = (files: Record<string, string>, dir: string) => Object.entries(files).filter(([p]) => !dir || p.startsWith(`${dir}/`)).map(([p, c]) => [dir ? p.slice(dir.length + 1) : p, c] as const);
  const j = (status: number, b: unknown) => new Response(JSON.stringify(b), { status });
  const f: Fetch = async (url, init) => {
    st.requests++;
    const u = new URL(url), m = init?.method ?? "GET", p = decodeURIComponent(u.pathname).replace("/repos/o/archive", "");
    const b = init?.body ? JSON.parse(String(init.body)) : null;
    if (m === "GET" && p === "/git/ref/heads/main") return j(200, { object: { sha: st.ref } });
    if (m === "GET" && p.startsWith("/git/commits/")) return j(200, { tree: { sha: `${p.slice(13)}|` } });
    if (m === "GET" && p.startsWith("/git/trees/")) {
      const sha = p.slice(11), [id, dir] = sha.split("|"), rec = u.searchParams.has("recursive");
      const seen = new Set<string>(), tree: { path: string; type: string; sha: string }[] = [];
      for (const [rel] of under(root(sha), dir)) {
        const cut = rel.indexOf("/");
        if (rec || cut < 0) tree.push({ path: rel, type: "blob", sha: "x" });
        else if (!seen.has(rel.slice(0, cut))) { seen.add(rel.slice(0, cut)); tree.push({ path: rel.slice(0, cut), type: "tree", sha: `${id}|${dir ? `${dir}/` : ""}${rel.slice(0, cut)}` }); }
      }
      return j(200, { tree });
    }
    if (m === "GET" && p.startsWith("/contents/")) { const c = commits.get(u.searchParams.get("ref")!)!.files[p.slice(10)]; return c === undefined ? new Response("", { status: 404 }) : new Response(c); }
    if (m === "POST" && p === "/git/trees") { const t = { ...root(b.base_tree) }; for (const e of b.tree) t[e.path] = e.content; const id = `T${++st.n}`; trees.set(id, t); return j(201, { sha: `${id}|` }); }
    if (m === "POST" && p === "/git/commits") { const id = `c${++st.n}`; commits.set(id, { files: { ...root(b.tree) }, parent: b.parents[0] }); return j(201, { sha: id }); }
    if (m === "PATCH" && p === "/git/refs/heads/main") {
      if (st.failPatch > 0) { st.failPatch--; return j(500, {}); }
      if (commits.get(b.sha)!.parent !== st.ref) return j(422, {});
      st.ref = b.sha; return j(200, {});
    }
    if (m === "POST" && u.pathname === "/graphql") {
      const q: string = b.query;
      if (q.includes("entries")) {
        const [, expr] = /expression:"([^"]+)"/.exec(q)!, [c, dir] = expr.split(":");
        const files = under(commits.get(c)!.files, dir);
        return j(200, { data: { repository: { object: files.length ? { entries: files.filter(([rel]) => !rel.includes("/")).map(([name, text]) => ({ name, type: "blob", object: { text, isTruncated: false } })) } : null } } });
      }
      const repo: Record<string, { oid: string } | null> = {};
      for (const [, k, expr] of q.matchAll(/k(\d+):object\(expression:"([^"]+)"\)/g)) { const [c, path] = expr.split(":"); const v = commits.get(c)!.files[path]; repo[`k${k}`] = v === undefined ? null : { oid: gitBlobSha(Buffer.from(v, "utf8")) }; }
      return j(200, { data: { repository: repo } });
    }
    return j(404, {});
  };
  const target: GitHubTarget = { repo: "o/archive", branch: "main", token: "ghp_" + "t".repeat(36), apiBase: "https://api.github.test", fetch: f };
  return { st, target, fresh: () => new GitHubStore(target) };
}

test("7. GitHub primary store: a failed or conflicting commit leaves nothing claiming to be durable; a good one is complete", async (t) => {
  const gh = fakeRepo();
  const s = setup();
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");

  gh.st.failPatch = 1;
  const failed = await s.tick(gh.fresh());
  assert.equal(failed.durability.status, "FAILED");
  assert.equal(failed.durability.code, "GITHUB_500");
  const after = gh.fresh();
  assert.deepEqual(await listCheckpoints(after, "2026-11-03", "2026-11-05"), [], "no checkpoint, run or publication survives a failed commit");
  assert.equal(await readPublicSnapshot(after), null);

  const okStore = gh.fresh();
  const ok = await s.tick(okStore);
  assert.equal(ok.durability.status, "COMMITTED");
  const r = gh.fresh();
  const cp = await s.latest(r);
  assert.deepEqual(cp.problems, []);
  assert.equal(cp.manifest.complete, true);
  assert.equal((await readPublicSnapshot(r))!.publicationId, cp.publication!.publicationId);
  t.diagnostic(`one checkpoint (3 tracked races): ${ok.durability.requests} GitHub requests, ${ok.durability.files} files, ${ok.durability.bytes} bytes in one commit`);

  // overlapping invocations: both read the same branch head; the second commit is refused and nothing of it lands
  const a = gh.fresh(), b = gh.fresh();
  await a.get("heads/tick.json"); await b.get("heads/tick.json");
  sen(s.provider, 1100, 900, "2026-11-04T01:01:00Z");
  assert.equal((await s.tick(a)).durability.status, "COMMITTED");
  const lost = await s.tick(b);
  assert.equal(lost.durability.status, "FAILED");
  assert.ok(["GITHUB_CONFLICT", "IMMUTABLE_CONFLICT"].includes(lost.durability.code!));
  assert.equal((await listCheckpoints(gh.fresh(), "2026-11-03", "2026-11-05")).length, 2);

  // the next poll after an outage reads the branch as it is and carries on
  sen(s.provider, 1200, 900, "2026-11-04T01:03:00Z");
  assert.equal((await s.tick(b)).durability.status, "COMMITTED");
  assert.equal((await listCheckpoints(gh.fresh(), "2026-11-03", "2026-11-05")).length, 3);
});

// ---- cron timing --------------------------------------------------------------------------------------------------------

test("30-second slots: a late invocation stays in its own minute; a slow collection is never overlapped or passed off as complete", async (t) => {
  const s = setup();
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  s.clock.advance(40_000); // cron fired 40 s late
  const sleep = async (ms: number) => s.clock.advance(ms);
  const late = await runCronSlots(s.deps(), { trigger: "CRON" }, sleep);
  assert.equal(late.filter((x) => x.run).length, 1, "the :10 slot belongs to the next invocation");
  s.clock.t = Date.parse("2026-11-04T01:01:00Z") + 2_000; // next cron, on time
  const next = await runCronSlots(s.deps(), { trigger: "CRON" }, sleep);
  assert.deepEqual(next.filter((x) => x.run).map((x) => x.run!.startedAt), ["2026-11-04T01:01:02.000Z", "2026-11-04T01:01:32.000Z"], "the scheduler's early-poll tolerance realigns at once; no slot is lost");
  s.clock.t = Date.parse("2026-11-04T01:02:00Z") + 2_000;
  const realigned = await runCronSlots(s.deps(), { trigger: "CRON" }, sleep);
  assert.deepEqual(realigned.filter((x) => x.run).map((x) => x.run!.startedAt), ["2026-11-04T01:02:02.000Z", "2026-11-04T01:02:32.000Z"], "and the minute after is back to two");

  s.provider.latencyMs = 6_000;
  s.clock.t = Date.parse("2026-11-04T01:03:00Z");
  const slow = await runCronSlots(s.deps(), { trigger: "CRON" }, sleep);
  const runs = slow.filter((x) => x.run).map((x) => x.run!);
  for (let i = 1; i < runs.length; i++) assert.ok(runs[i].startedAt >= runs[i - 1].finishedAt, "slots never overlap");
  const ms = runs.map((x) => Date.parse(x.finishedAt) - Date.parse(x.startedAt));
  for (const run of runs) {
    const k = (await listCheckpoints(s.store, "2026-11-04", "2026-11-04")).find((x) => x.includes(run.runId));
    if (!k) continue;
    const cp = (await readCheckpoint(s.store, k))!;
    if (run.deadlineHit || run.errors.length) assert.equal(cp.manifest.complete, false, "a cut-short collection is not complete");
  }
  t.diagnostic(`at 6 s per provider request: ${runs.length} slot(s) in the minute, durations ${ms.join(", ")} ms, ${s.provider.requests.length} requests so far`);
});

// ---- RaceDesk compatibility -----------------------------------------------------------------------------------------------

test("8. RaceDesk: flag off (or GitHub-only) keeps the legacy timeline; flag on serves only published output, correctly mapped", async () => {
  const legacyCalls: number[] = [];
  const legacy = async (id: number) => { legacyCalls.push(id); return []; };
  let storeAsked = 0;
  assert.equal((await timelineFor(101, { env: {}, legacy, store: () => { storeAsked++; return null; } })).source, "LEGACY");
  assert.equal(storeAsked, 0, "with the flag off the new store is never touched");
  const gh = fakeRepo();
  assert.equal((await timelineFor(101, { env: ON, legacy, store: () => gh.fresh() })).source, "LEGACY");
  assert.equal(gh.st.requests, 0, "no GitHub request per visitor");
  assert.equal(legacyCaptureGate({ CRON_SECRET: "x".repeat(24), INTELLIGENCE_CAPTURE_STORE: "github", ONPOINT_PUBLIC_SNAPSHOT: "1" }, `Bearer ${"x".repeat(24)}`), null, "the legacy recorder keeps feeding the desk");

  const m = new MemoryStore();
  const durable: ObjectStore = { kind: "blob", durable: true, put: m.put.bind(m), putIfAbsent: m.putIfAbsent.bind(m), get: m.get.bind(m), list: m.list.bind(m) };
  const s = setup({ shadow: { model: { name: "intelligence-shadow", version: "s1", configSha256: "c".repeat(64) }, run: () => ({ pB: 0.999 }) } }, durable);
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await s.tick();
  const first = engineCalc((await s.latest()).calculated, "sen-GA").outputs as EngineOutputs;
  await s.tick(); // unchanged: no new entry
  sen(s.provider, 950, 900, "2026-11-04T01:01:00Z"); // a correction
  await s.tick();
  s.provider.set(101, { votes: { d: 950, r: 900, o: 300 } });
  await s.tick();

  const tl = await timelineFor(101, { env: ON, legacy, store: () => durable });
  assert.equal(tl.source, "PUBLISHED");
  assert.equal(tl.snapshots.length, 3);
  const [a, b, c] = tl.snapshots;
  assert.deepEqual(a.candidates.map((x) => [x.name, x.votes]), [["Alpha", 1000], ["Bravo", 900]]);
  assert.ok(Math.abs(a.candidates.reduce((n, x) => n + (x.winProbPct ?? 0), 0) - 100) < 1e-9);
  assert.equal(a.projectedMarginPp, Math.abs(first.expectedFinalMarginPp));
  assert.equal(a.remainingVoteEst, first.estimatedOutstandingVotes);
  assert.equal(a.ts, "2026-11-04T01:00:00.000Z");
  assert.deepEqual(b.candidates.map((x) => x.votes), [950, 900], "the correction is a new entry; the first is unchanged");
  assert.equal(c.candidates.find((x) => x.name === "Other")!.winProbPct, null, "an unpriced candidate is null, not zero");
  assert.ok(!JSON.stringify(tl).includes("0.999"));
  assert.deepEqual((await timelineFor(555, { env: ON, legacy, store: () => durable })).snapshots, [], "no published output, no entry");
});
