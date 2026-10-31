// A future model replayed over archived 2026 raw snapshots: its own versioned dataset, as-of bounded, and the original
// records untouched. Everything here is SYNTHETIC.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CDetail, XRace } from "../../app/results/2026/live";
import type { ObjectStore } from "../../app/lib/intelligence/captureStore";
import { runTick } from "../../app/lib/intelligence/captureRunner";
import { compareReplay, computePublicEngine, replayArchive, type EngineOutputs, type ModelIdentity, type ReplayOptions } from "../../app/lib/intelligence/checkpointArchive";
import { ELECTION_NIGHT, RACES, rig, sen } from "./captureFixtures";

const V2026: ModelIdentity = { name: "onpoint-results-live", version: "commit-2026", configSha256: "a".repeat(64) };
const V2028: ModelIdentity = { name: "onpoint-2028", version: "v1", configSha256: "d".repeat(64) };

async function dump(store: ObjectStore) {
  const out: Record<string, string> = {};
  for (const k of (await store.list("")).sort()) out[k] = (await store.get(k))!.toString("base64");
  return out;
}

test("a 2028 model replays the archived 2026 raw snapshots into its own dataset without changing history", async () => {
  const r = rig({ t: ELECTION_NIGHT });
  const tick = async () => { await runTick({ ...r.deps(), archive: { now: r.clock.now, expFor: async () => null, engine: V2026, raceHistory: true, publicationReady: true } }, { trigger: "CRON" }); r.clock.advance(60_000); };
  sen(r.provider, 1000, 900, "2026-11-04T00:59:00Z");
  await tick();
  const asOf = new Date(r.clock.t - 1).toISOString();
  sen(r.provider, 1200, 900, "2026-11-04T01:01:00Z");
  await tick();
  const history = await dump(r.store);

  const opts: ReplayOptions = {
    datasetId: "replay-2028", model: V2028, raceOf: (id) => RACES.find((x) => x.id === id) ?? null, expFor: async () => null, now: r.clock.now,
    compute: (race: XRace, d: CDetail, e) => ({ ...computePublicEngine(race, d, e), expectedFinalMarginPp: 42 }),
  };

  // as-of: only what had been archived by then
  const early = await replayArchive(r.store, { ...opts, datasetId: "asof-check", asOf });
  assert.equal(early.written.length, 1);
  assert.equal(early.skipped.length, 1);
  const earlyRows = await compareReplay(r.store, "asof-check", V2028, "sen-GA");
  assert.equal((earlyRows[0].replay!.outputs as EngineOutputs).reportedTotal, 1900);
  assert.equal(earlyRows[1].replay, null, "the later observation was never read");

  const full = await replayArchive(r.store, opts);
  assert.equal(full.written.length, 2);
  const again = await replayArchive(r.store, { ...opts, compute: () => { throw new Error("must not run over an existing replay"); } });
  assert.deepEqual(again.written, []);
  assert.equal(again.existing.length, 2, "a replay is written once and never overwritten");

  // three-way comparison, every row on the same raw snapshot
  const rows = await compareReplay(r.store, "replay-2028", V2028, "sen-GA");
  assert.equal(rows.length, 2);
  for (const row of rows) {
    const o = row.original.outputs as EngineOutputs, n = row.replay!.outputs as EngineOutputs;
    assert.equal(row.original.model.version, "commit-2026");
    assert.equal(row.replay!.model.version, "v1");
    assert.deepEqual(row.replay!.raw, row.original.raw, "both models reference the same raw snapshot");
    assert.equal(row.replay!.inputSha256, row.original.inputSha256, "and the same inputs");
    assert.equal(row.replay!.replayOf.calculationId, row.original.calculationId);
    assert.equal(row.published!.calculationId, row.original.calculationId, "the publication names the 2026 calculation it served");
    assert.match(row.published!.publicationId, /^pub_/);
    assert.equal(row.published!.modelVersion, "commit-2026");
    assert.equal(row.replay!.replayOf.publicationId, row.published!.publicationId);
    assert.equal(row.replay!.replayOf.publishedOutputSha256, row.published!.calculatedOutputSha256);
    assert.equal(n.reportedTotal, o.reportedTotal);
    assert.equal(n.expectedFinalMarginPp, 42);
    assert.notEqual(o.expectedFinalMarginPp, 42, "the 2026 calculation is not replaced");
  }
  assert.deepEqual(rows.map((x) => (x.original.outputs as EngineOutputs).reportedTotal), [1900, 2100]);

  // every 2026 record is byte-for-byte what it was; the replay lives only under replays/
  const now = await dump(r.store);
  const added = Object.keys(now).filter((k) => !(k in history));
  assert.ok(added.length === 3 && added.every((k) => k.startsWith("replays/")));
  for (const [k, v] of Object.entries(history)) assert.equal(now[k], v, `${k} changed`);

  await assert.rejects(replayArchive(r.store, { ...opts, datasetId: "../archive" }), /simple identifiers/);
});
