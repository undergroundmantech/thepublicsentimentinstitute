// The election-night checkpoint archive: raw, calculated and published layers per checkpoint, the GitHub mirror and
// replay. Everything here is SYNTHETIC.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CDetail, XRace } from "../../app/results/2026/live";
import { MemoryStore, type ObjectStore } from "../../app/lib/intelligence/captureStore";
import { runCronSlots, runTick, type RunnerDeps } from "../../app/lib/intelligence/captureRunner";
import {
  archiveCheckpoint, computePublicEngine, listCheckpoints, publicEngineIdentity, readCheckpoint, stateAt,
  type ArchiveDeps, type CalcRecord, type EngineOutputs, type ModelIdentity,
} from "../../app/lib/intelligence/checkpointArchive";
import { readRaw, sha256Hex } from "../../app/lib/intelligence/capture";
import { trimDetail } from "../../app/lib/intelligence/civic";
import { mirrorPending, readMirrorFile, repoPathOf, verifyCheckpointFiles, type Fetch, type GitHubTarget } from "../../app/lib/intelligence/githubArchive";
import { ELECTION_NIGHT, FlakyStore, RACES, rig, sen } from "./captureFixtures";

const V1: ModelIdentity = { name: "onpoint-results-live", version: "commit-aaaa", configSha256: "a".repeat(64) };
const V2: ModelIdentity = { ...V1, version: "commit-bbbb" };

function setup(over: Partial<ArchiveDeps> = {}, store?: ObjectStore) {
  const r = rig({ store, t: ELECTION_NIGHT });
  let calls = 0;
  const archive: ArchiveDeps = { now: r.clock.now, expFor: async () => null, engine: V1, raceHistory: true, ...over };
  const counted = { ...archive, compute: (race: XRace, d: CDetail, e: Parameters<typeof computePublicEngine>[2]) => { calls++; return (over.compute ?? computePublicEngine)(race, d, e); } };
  const deps = (a: Partial<ArchiveDeps> = {}): RunnerDeps => ({ ...r.deps(), archive: { ...counted, ...a } });
  const tick = async (a: Partial<ArchiveDeps> = {}) => { const out = await runTick(deps(a), { trigger: "CRON" }); r.clock.advance(60_000); return out; };
  const manifests = async () => listCheckpoints(r.store, "2026-11-03", "2026-11-05");
  const latest = async () => (await readCheckpoint(r.store, (await manifests()).at(-1)!))!;
  return { ...r, tick, deps, manifests, latest, calls: () => calls };
}
const pubCalc = (cs: CalcRecord[], id: string) => cs.find((c) => c.raceId === id && c.designation === "PUBLIC_ENGINE")!;

test("each checkpoint keeps raw refs, versioned calculations and the published state, and the manifest says complete", async () => {
  const s = setup();
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  const out = await s.tick();
  assert.ok(out.run?.ok);
  const cp = await s.latest();
  assert.equal(cp.manifest.complete, true);
  assert.deepEqual(cp.problems, []);
  assert.equal(cp.manifest.counts.tracked, RACES.length);
  const c = pubCalc(cp.calculated, "sen-GA");
  assert.equal(c.status, "OK");
  assert.equal(c.model.version, V1.version);
  assert.match(c.inputSha256!, /^[0-9a-f]{64}$/);
  assert.match(c.outputSha256!, /^[0-9a-f]{64}$/);
  assert.ok(c.raw && (await s.store.get(c.raw.observationKey)), "the raw observation the calculation used is stored");
  assert.ok(Date.parse(c.calculatedAt!) >= Date.parse(c.observedAt!));
  const o = c.outputs as EngineOutputs;
  assert.equal(o.reportedTotal, 1900);
  assert.ok(o.estimatedFinalTotal >= o.reportedTotal);
  assert.equal(o.estimatedOutstandingVotes, o.estimatedFinalTotal - o.reportedTotal);
  assert.ok(Math.abs((o.winProbability.alpha ?? 0) + (o.winProbability.bravo ?? 0) - 1) < 1e-12);
  assert.ok(o.uncertainty.lowPp <= o.expectedFinalMarginPp && o.expectedFinalMarginPp <= o.uncertainty.highPp);
  assert.equal(o.adjustments.reportingOrder, null);
  assert.ok(o.unavailable["adjustments.reportingOrder"]);
  const p = cp.snapshot.find((x) => x.raceId === "sen-GA")!;
  assert.equal(p.status, "OK");
  assert.equal(p.calculatedOutputSha256, c.outputSha256);
  assert.equal(p.calculationId, c.calculationId, "the snapshot names the calculation it shows");
  assert.deepEqual(p.raw, c.raw, "and the raw snapshot under it");
  assert.equal(p.classification, "PUBLIC_ENGINE_RECOMPUTED_NOT_VERIFIED_PUBLISHED", "a recomputation is not a publication");
  assert.equal(cp.publication, null);
  assert.equal(p.displayed!.expectedFinalMarginPp, o.expectedFinalMarginPp);
  assert.equal(p.onpointCall, null);
  assert.ok(p.onpointCallReason);
  // and Race History gets the published projection, with projected votes kept apart from reported ones
  const keys = await s.store.list("model/sen-GA/");
  assert.equal(keys.length, 1);
  const point = JSON.parse((await s.store.get(keys[0]))!.toString("utf8"));
  assert.equal(point.sourceClass, "LIVE_PROJECTION");
  assert.equal(point.model.snapshot, cp.manifest.checkpointId);
  assert.equal(point.projectedFinalVotes.alpha, o.estimatedFinalVotes.alpha);
});

test("raw data is preserved when a calculation fails, and the failure is recorded", async () => {
  const s = setup({ compute: () => { throw new RangeError("boom"); } });
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  const out = await s.tick();
  assert.ok(out.run?.ok, "a failed calculation does not fail the capture");
  const cp = await s.latest();
  const c = pubCalc(cp.calculated, "sen-GA");
  assert.equal(c.status, "FAILED");
  assert.match(c.reason!, /RangeError/);
  assert.equal(c.outputs, null);
  assert.ok(await s.store.get(c.raw!.observationKey), "raw kept");
  assert.equal(cp.snapshot.find((x) => x.raceId === "sen-GA")!.calculationId, c.calculationId, "the missing layer is linked, not dropped");
  assert.equal(cp.snapshot.find((x) => x.raceId === "sen-GA")!.status, "UNAVAILABLE");
  assert.equal(cp.manifest.counts.failed, RACES.length);
  assert.equal(cp.manifest.complete, true, "every layer is present; failures are explicit");
  assert.deepEqual(await s.store.list("model/sen-GA/"), [], "no Race History point from a failed calculation");
});

test("multiple candidates: only the two margin sides are priced; others are null with a reason, never zero", () => {
  const race: XRace = { id: "sen-XX", k: "sen", st: "XX", nm: "SYNTHETIC", off: "US Senate", c: [["Alpha", "D", 0], ["Bravo", "R", 0]], civ: {}, m: 2, pR: 0.6 };
  const detail: CDetail = { id: 1, name: "x", type: "US Senate", province: "XX", district: null, pr: 40, close: null, updated: null, test: false, regions: {},
    c: [["Alpha", "Democratic", 4000, 40, 0, null], ["Bravo", "Republican", 4500, 45, 0, null], ["Lima", "Libertarian", 1500, 15, 0, null]] };
  const o = computePublicEngine(race, detail, null);
  assert.deepEqual(o.candidates.map((c) => c.side), ["A", "B", null]);
  assert.equal(o.winProbability.lima, null);
  assert.ok(o.unavailable["winProbability.lima"]);
  assert.ok(Math.abs(o.winProbability.alpha! + o.winProbability.bravo! - 1) < 1e-12);
  assert.equal(o.estimatedFinalVotes.lima, o.sides.estimatedFinal.o, "the only other candidate gets the other-side total");
  assert.equal(o.reportedTotal, 10_000);
});

test("unchanged inputs reuse the earlier calculation; a model-version change recalculates without touching the earlier checkpoint", async () => {
  const s = setup();
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await s.tick();
  const first = await s.latest();
  const firstCalcBytes = (await s.store.get(first.manifest.layers.calculated.key))!;
  const n = s.calls();
  await s.tick();
  const second = await s.latest();
  assert.equal(s.calls(), n, "no duplicate calculation for identical inputs and model");
  const reused = pubCalc(second.calculated, "sen-GA");
  assert.equal(reused.reusedFrom, first.manifest.checkpointId);
  assert.equal(reused.calculatedAt, pubCalc(first.calculated, "sen-GA").calculatedAt, "a reused calculation keeps its real time");
  assert.equal(second.manifest.counts.reused, RACES.length);
  await s.tick({ engine: V2 });
  const third = await s.latest();
  const c3 = pubCalc(third.calculated, "sen-GA");
  assert.equal(c3.model.version, V2.version);
  assert.equal(c3.reusedFrom, null);
  assert.equal(c3.inputSha256, pubCalc(first.calculated, "sen-GA").inputSha256, "same inputs");
  assert.ok(s.calls() > n);
  assert.deepEqual(await s.store.get(first.manifest.layers.calculated.key), firstCalcBytes, "earlier checkpoint unchanged");
});

test("identical inputs but changed calculations are both kept, each with its own engine hash and output hash", async () => {
  const s = setup();
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await s.tick();
  const a = pubCalc((await s.latest()).calculated, "sen-GA");
  const tweak = (race: XRace, d: CDetail, e: Parameters<typeof computePublicEngine>[2]) => ({ ...computePublicEngine(race, d, e), expectedFinalMarginPp: 99 });
  await s.tick({ engine: { ...V1, configSha256: "b".repeat(64) }, compute: tweak });
  const b = pubCalc((await s.latest()).calculated, "sen-GA");
  assert.equal(a.inputSha256, b.inputSha256);
  assert.notEqual(a.outputSha256, b.outputSha256);
  assert.notEqual(a.model.configSha256, b.model.configSha256);
  assert.equal((a.outputs as EngineOutputs).expectedFinalMarginPp === 99, false);
});

test("corrected vote totals: a lower count is a new snapshot and calculation; the earlier one is not rewritten", async () => {
  const s = setup();
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await s.tick();
  const t1 = new Date(s.clock.t - 1).toISOString();
  sen(s.provider, 950, 900, "2026-11-04T01:01:00Z");
  await s.tick();
  const before = await stateAt(s.store, "sen-GA", t1);
  const after = await stateAt(s.store, "sen-GA", s.clock.iso());
  assert.equal((before!.calculated!.outputs as EngineOutputs).reportedTotal, 1900);
  assert.equal((after!.calculated!.outputs as EngineOutputs).reportedTotal, 1850);
  assert.notEqual(before!.raw!.contentId, after!.raw!.contentId);
  assert.equal((await s.store.list("model/sen-GA/")).length, 2);
  // the original observation and its exact payload are still there, unaltered
  const obs = JSON.parse((await s.store.get(before!.raw!.observationKey))!.toString("utf8"));
  const text = (await readRaw(s.store, obs))!;
  assert.equal(before!.raw!.responseSha256, sha256Hex(text));
  assert.deepEqual(trimDetail(JSON.parse(text), before!.calculated!.civicId!).c.map((c) => c[2]), [1000, 900]);
});

test("an unchanged checkpoint is still recorded, pointing at the stored payload instead of copying it", async () => {
  const s = setup();
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await s.tick();
  const rawCount = (await s.store.list("raw/")).length;
  await s.tick();
  const [k1, k2] = await s.manifests();
  assert.ok(k1 && k2 && k1 !== k2, "both scheduled checkpoints exist");
  const a = pubCalc((await readCheckpoint(s.store, k1))!.calculated, "sen-GA"), b = pubCalc((await readCheckpoint(s.store, k2))!.calculated, "sen-GA");
  assert.equal(b.raw!.outcome, "UNCHANGED");
  assert.equal(b.raw!.responseSha256, a.raw!.responseSha256);
  assert.equal((await s.store.list("raw/")).length, rawCount, "no duplicate payload");
  assert.equal(b.reusedFrom, a.checkpointId);
  assert.notEqual(b.calculationId, a.calculationId);
});

test("a race with no published projection is listed as unavailable with a reason, and the checkpoint is not complete", async () => {
  const ghost: XRace = { id: "sen-ZZ", k: "sen", st: "ZZ", nm: "SYNTHETIC ghost", off: "US Senate", c: [["Xray", "D", 0], ["Yankee", "R", 0]], civ: { t: ["US Senate"] } };
  const s = setup();
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await runTick({ ...s.deps(), races: [...RACES, ghost] }, { trigger: "CRON" });
  const cp = await s.latest();
  const c = pubCalc(cp.calculated, "sen-ZZ");
  assert.equal(c.status, "UNAVAILABLE");
  assert.match(c.reason!, /NO_MATCH/);
  const p = cp.snapshot.find((x) => x.raceId === "sen-ZZ")!;
  assert.equal(p.status, "UNAVAILABLE");
  assert.equal(p.displayed, null);
  assert.equal(cp.manifest.layers.raw.status, "PARTIAL");
  assert.equal(cp.manifest.complete, false);
  assert.ok(cp.manifest.incompleteReasons.some((r) => r.includes("sen-ZZ")));
});

test("contests no OnPoint model covers are recorded as calculation-unavailable, not omitted", async () => {
  const s = new MemoryStore();
  const m = await archiveCheckpoint(s, { runId: "u1", phase: "ELECTION_NIGHT", startedAt: "2026-11-04T01:00:00.000Z", rawFinishedAt: "2026-11-04T01:00:05.000Z", runKey: "runs/x", captures: [], feeds: [], rawIssues: [],
    untracked: [{ civicId: 555, type: "State House", province: "Ohio", district: "12", name: "SYNTHETIC" }] }, { now: () => new Date("2026-11-04T01:00:06Z"), expFor: async () => null, engine: V1 });
  const cp = (await readCheckpoint(s, (await listCheckpoints(s, "2026-11-04", "2026-11-04"))[0]))!;
  assert.equal(m.counts.untracked, 1);
  assert.equal(cp.calculated[0].raceId, "civic-555");
  assert.equal(cp.calculated[0].status, "UNAVAILABLE");
});

test("shadow outputs are stored apart and never reach the published layer or the public history", async () => {
  const shadowModel: ModelIdentity = { name: "intelligence-shadow", version: "s1", configSha256: "c".repeat(64) };
  const s = setup({ shadow: { model: shadowModel, run: () => ({ pB: 0.999, note: "shadow" }) } });
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await s.tick();
  const cp = await s.latest();
  const shadow = cp.calculated.find((c) => c.raceId === "sen-GA" && c.designation === "SHADOW")!;
  const pub = pubCalc(cp.calculated, "sen-GA");
  assert.equal(shadow.model.name, "intelligence-shadow");
  const p = cp.snapshot.find((x) => x.raceId === "sen-GA")!;
  assert.equal(p.calculatedOutputSha256, pub.outputSha256);
  assert.notEqual(p.calculatedOutputSha256, shadow.outputSha256);
  assert.equal(p.model.name, "onpoint-results-live");
  assert.ok(!JSON.stringify(cp.snapshot).includes("0.999"));
  const point = JSON.parse((await s.store.get((await s.store.list("model/sen-GA/"))[0]))!.toString("utf8"));
  assert.equal(point.model.id, "onpoint-results-live");
  assert.deepEqual(await s.store.list("model-shadow/"), []);
});

test("a delayed calculation carries its real time, and replay before the archive finished does not see it", async () => {
  const s = setup();
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await s.tick();
  const firstId = (await s.latest()).manifest.checkpointId;
  sen(s.provider, 1200, 900, "2026-11-04T01:01:00Z");
  const slow = (race: XRace, d: CDetail, e: Parameters<typeof computePublicEngine>[2]) => { s.clock.advance(20_000); return computePublicEngine(race, d, e); };
  const mid = new Date(s.clock.t + 10_000).toISOString();
  await s.tick({ compute: slow });
  const cp = await s.latest();
  const c = pubCalc(cp.calculated, "sen-GA");
  assert.ok(Date.parse(c.calculatedAt!) - Date.parse(c.observedAt!) >= 20_000, "not backdated");
  assert.ok(Date.parse(cp.manifest.archivedAt) >= Date.parse(c.calculatedAt!));
  const replay = await stateAt(s.store, "sen-GA", mid);
  assert.equal(replay!.checkpointId, firstId, "at that moment only the first checkpoint was archived");
  assert.equal((replay!.calculated!.outputs as EngineOutputs).reportedTotal, 1900);
  assert.equal(await stateAt(s.store, "sen-GA", "2026-11-04T00:00:00Z"), null, "nothing before the first checkpoint");
});

test("a layer that cannot be stored leaves the checkpoint incomplete; a lost manifest fails the run but keeps the raw", async () => {
  const flaky = new FlakyStore();
  const s = setup({}, flaky);
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  flaky.failPrefix = "archive/2026-11-04/snapshot/";
  await s.tick();
  const cp = await s.latest();
  assert.equal(cp.manifest.layers.snapshot.status, "FAILED");
  assert.equal(cp.manifest.layers.calculated.status, "WRITTEN");
  assert.equal(cp.manifest.complete, false);
  flaky.failPrefix = "archive/2026-11-04/checkpoints/";
  sen(s.provider, 1100, 900, "2026-11-04T01:01:00Z");
  const out = await s.tick();
  assert.equal(out.run!.ok, false);
  assert.ok(out.run!.errors.some((e) => e.code === "ARCHIVE_WRITE_FAILED"));
  assert.equal(out.run!.races.find((r) => r.raceId === "sen-GA")!.outcome, "NEW", "raw still recorded");
  assert.equal((await s.manifests()).length, 1, "no manifest, so no checkpoint claims to exist");
});

test("cron runs the second 30-second slot of an election-night minute", async () => {
  const s = setup();
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  const slots = await runCronSlots(s.deps(), { trigger: "CRON" }, async (ms) => s.clock.advance(ms));
  assert.equal(slots.length, 2);
  assert.ok(slots.every((x) => x.run));
  assert.equal(Date.parse(slots[1].run!.startedAt) - Date.parse(slots[0].run!.startedAt), 30_000);
  assert.equal((await s.manifests()).length, 2);
});

function fakeGitHub() {
  const trees = new Map<string, Record<string, string>>([["t0", {}]]);
  const commits = new Map<string, { tree: string; parents: string[] }>([["c0", { tree: "t0", parents: [] }]]);
  const st = { ref: "c0", failPatch: 0, raceOnce: false, n: 0, auth: new Set<string>() };
  const j = (status: number, b: unknown) => new Response(JSON.stringify(b), { status });
  const f: Fetch = async (url, init) => {
    const u = new URL(url);
    const p = u.pathname.replace("/repos/org/archive", "");
    const m = init?.method ?? "GET";
    st.auth.add(String((init?.headers as Record<string, string>)?.authorization));
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (m === "GET" && p === "/git/ref/heads/main") return j(200, { object: { sha: st.ref } });
    if (m === "GET" && p.startsWith("/git/commits/")) return j(200, { tree: { sha: commits.get(p.split("/").pop()!)!.tree } });
    if (m === "POST" && p === "/git/trees") { const t = { ...trees.get(body.base_tree)! }; for (const e of body.tree) t[e.path] = e.content; const id = `t${++st.n}`; trees.set(id, t); return j(201, { sha: id }); }
    if (m === "POST" && p === "/git/commits") { const id = `c${++st.n}`; commits.set(id, { tree: body.tree, parents: body.parents }); return j(201, { sha: id }); }
    if (m === "PATCH" && p === "/git/refs/heads/main") {
      if (st.failPatch > 0) { st.failPatch--; return j(500, {}); }
      if (st.raceOnce) { st.raceOnce = false; const id = `c${++st.n}`; trees.set(`t${id}`, { ...trees.get(commits.get(st.ref)!.tree)!, "other.txt": "x" }); commits.set(id, { tree: `t${id}`, parents: [st.ref] }); st.ref = id; }
      if (commits.get(body.sha)!.parents[0] !== st.ref) return j(422, {});
      st.ref = body.sha; return j(200, {});
    }
    if (m === "GET" && p.startsWith("/contents/")) { const c = trees.get(commits.get(st.ref)!.tree)![decodeURIComponent(p.slice(10))]; return c === undefined ? new Response("", { status: 404 }) : new Response(c, { status: 200 }); }
    return j(404, {});
  };
  return { f, st, files: () => trees.get(commits.get(st.ref)!.tree)! };
}

test("GitHub mirror: one commit per batch, retried after failure and conflict, recoverable and integrity-checked", async () => {
  const s = setup();
  const gh = fakeGitHub();
  const token = "ghp_" + "t".repeat(36);
  const target: GitHubTarget = { repo: "org/archive", branch: "main", token, apiBase: "https://api.github.test", fetch: gh.f };
  sen(s.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await s.tick();
  gh.st.failPatch = 1;
  const failed = await mirrorPending(s.store, target, { now: s.clock.now });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.code, "GITHUB_500");
  assert.ok(!JSON.stringify(failed).includes(token));
  sen(s.provider, 1100, 900, "2026-11-04T01:01:00Z");
  await s.tick();
  gh.st.raceOnce = true;
  const ok = await mirrorPending(s.store, target, { now: s.clock.now });
  assert.equal(ok.status, "MIRRORED");
  assert.equal(ok.checkpoints, 2, "the backlog goes in one commit");
  assert.equal(gh.files()["other.txt"], "x", "a concurrent commit is kept, not overwritten");
  assert.deepEqual([...gh.st.auth], [`Bearer ${token}`]);
  assert.equal((await mirrorPending(s.store, target, { now: s.clock.now })).status, "NOTHING_PENDING");

  // recovery: read a checkpoint back from the repository and verify it
  const key = (await s.manifests())[1];
  const cp = (await readCheckpoint(s.store, key))!;
  const manifest = (await readMirrorFile(target, repoPathOf(key)))!;
  const calculated = await readMirrorFile(target, repoPathOf(cp.manifest.layers.calculated.key));
  const snapshot = await readMirrorFile(target, repoPathOf(cp.manifest.layers.snapshot.key));
  const raw = await readMirrorFile(target, repoPathOf(key).replace("/checkpoints/", "/raw/").replace(/\.json$/, ".jsonl"));
  assert.ok(raw && raw.includes("sen-GA"), "the new raw response is in the mirror");
  assert.match(repoPathOf(key), /^2026\/11-04\/checkpoints\//);
  const v = verifyCheckpointFiles({ manifest, calculated, snapshot, raw });
  assert.deepEqual(v.problems, []);
  assert.equal(v.complete, true);
  const tampered = verifyCheckpointFiles({ manifest, calculated, snapshot: snapshot!.replace(/"OK"/, "\"UNAVAILABLE\""), raw });
  assert.equal(tampered.ok, false);
  assert.ok(tampered.problems.includes("snapshot layer hash mismatch"));
  assert.equal(await readMirrorFile(target, "2026/11-04/checkpoints/missing.json"), null);
});

test("the public engine identity is versioned, never UNVERSIONED", () => {
  assert.equal(publicEngineIdentity({ VERCEL_GIT_COMMIT_SHA: "0123456789abcdef" }).version, "0123456789ab");
  assert.match(publicEngineIdentity({}).version, /^local-[0-9a-f]{12}$/);
});
