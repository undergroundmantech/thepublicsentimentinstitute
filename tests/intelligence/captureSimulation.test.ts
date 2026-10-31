// SYNTHETIC test data only. A fabricated election night, run through the real recorder, store and replay code against a
// fake provider and a fake clock. It tests the software. It is not an election-night test, and no real provider or count
// is involved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { foldObservations, loadCapturesForReplay, readObservationRecords, reconstructAt, reportingGaps } from "../../app/lib/intelligence/capture";
import { pollingGaps, readRuns } from "../../app/lib/intelligence/captureRunner";
import { FAKE_IDS, MIN, rig, sen } from "./captureFixtures";

const START = Date.parse("2026-11-03T23:00:00Z");
const at = (m: number) => new Date(START + m * MIN).toISOString();

test("synthetic election night: outage, correction, decrease, duplicate delivery and a stall, then replay", async () => {
  const r = rig({ t: START });
  const sid = FAKE_IDS["sen-GA"];
  r.provider.set(sid, { updated: "2026-11-03T22:55:00Z" });
  let d = 0, rr = 0;
  const status: Record<number, string> = {};

  for (let m = 0; m < 360; m++) {
    // results begin at 00:00Z and arrive every 5 minutes until 04:00Z; then the provider stalls
    if (m >= 60 && m <= 300 && m % 5 === 0) {
      d += 1000; rr += 900;
      if (m === 160) d -= 3000; // a real decrease at 01:40Z
      sen(r.provider, d, rr, new Date(r.clock.t - 20_000).toISOString(), Math.min(99, (m - 60) / 3));
    }
    if (m === 187) r.provider.set(sid, { votes: { d: d - 50, r: rr, o: 0 } }); // a correction under the same source timestamp
    r.provider.mode = m >= 130 && m < 145 ? "down" : "ok";                      // a 15 minute outage, 01:10Z to 01:25Z
    await Promise.all(Array.from({ length: m === 120 ? 2 : 1 }, () => r.tick())); // duplicate cron delivery at 01:00Z
    if ([100, 144, 147, 359].includes(m)) status[m] = (await r.health()).status;
    r.clock.advance(MIN);
  }

  assert.equal(status[100], "HEALTHY");
  assert.equal(status[144], "INTERRUPTED", "15 minutes without a successful poll is an interruption");
  assert.equal(status[147], "HEALTHY", "and the recorder recovers when polls succeed again");
  assert.equal(status[359], "RUNNING_NO_NEW_DATA", "an hour of polling with nothing new is not the same as a dead recorder");

  const records = await readObservationRecords(r.store, "sen-GA");
  const views = foldObservations(records);
  assert.equal(records.corrupt, 0);
  assert.equal(views.length, 48, "the opening reading, 46 updates (three arrived during the outage and were never seen) and the correction; the duplicate delivery added nothing");
  assert.ok(views.some((v) => v.totalsDecreased && v.revisionStatus === "ORIGINAL"), "the decrease is kept");
  assert.equal(views.filter((v) => v.revisionStatus === "CORRECTION").length, 1, "the correction is kept beside the original");
  assert.ok(views.every((v) => v.sourceTimestamp !== null && Date.parse(v.firstObservedAt) >= Date.parse(v.sourceTimestamp)), "no observation precedes its own source timestamp");

  // the outage is visible in the run history, and the quiet stretch is not mistaken for an outage
  const runs = await readRuns(r.store, at(0), at(360));
  const gaps = pollingGaps(runs, 5);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].from, at(129));
  assert.equal(gaps[0].to, at(145));
  assert.equal(runs.filter((x) => !x.ok).length, 15);
  const loaded = await loadCapturesForReplay(r.store, "sen-GA");
  assert.ok(reportingGaps(loaded, 10).some((g) => g.kind === "SOURCE_TIMESTAMP" && g.minutes === 20));

  // a replay at 01:00Z cannot see the later decrease or correction, whatever is in the store now
  const T = at(120);
  const early = reconstructAt(loaded, T);
  assert.deepEqual(early, reconstructAt(await loadCapturesForReplay(r.store, "sen-GA", { knownAt: T }), T));
  assert.equal(early.returns?.reported.a, 13000);
  assert.equal(reconstructAt(loaded, at(186)).returns?.reported.a, 23000, "after the decrease and before the correction");
  assert.equal(reconstructAt(loaded, at(187)).returns?.reported.a, 22950, "after the correction");
});
