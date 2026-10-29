// T4 anchor: with zero reported votes the prior must reproduce the published forecast, race by race.
// Everything here runs from committed files; nothing reads ~/research/vai.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { collectPrior, priorIdOf, priorPath, renderPrior, PRIOR_DIR } from "../../scripts/vai/build_prior";
import { REPO_ROOT, readInput } from "../../scripts/vai/io";
import { aggregateMargin, anchorCheck, calibrate, calibratedQuantile, histogramCdf, solveShift, stratifiedDraws, TOLERANCE } from "../../app/results/_vai/prior";
import type { PriorFile, PublishedHistogram } from "../../app/results/_vai/types";

const files = fs.readdirSync(path.join(REPO_ROOT, PRIOR_DIR)).filter((f) => /^prior_[0-9a-f]{12}\.json$/.test(f)).sort();
const committed = files.map((f) => ({ name: f, text: fs.readFileSync(path.join(REPO_ROOT, PRIOR_DIR, f), "utf8") })).map((x) => ({ ...x, prior: JSON.parse(x.text) as PriorFile }));
const latest = committed.find((c) => c.prior.inputs.every((i) => fs.existsSync(path.join(REPO_ROOT, i.path)) && readInput(REPO_ROOT, i.path).sha256 === i.sha256));

test("every committed prior is addressed by the hash of its own inputs", () => {
  assert.ok(committed.length >= 1, "at least one prior is committed");
  for (const c of committed) {
    assert.equal(c.prior.priorId, priorIdOf(c.prior.inputs), c.name);
    assert.equal(`${PRIOR_DIR}/${c.name}`, priorPath(c.prior.priorId));
  }
});

test("rebuilding from the current inputs reproduces a committed prior byte for byte", (t) => {
  if (!latest) {
    t.skip("the forecast or results inputs have moved since the last prior; run `npm run vai:prior` and commit the new file");
    return;
  }
  assert.equal(renderPrior(collectPrior(REPO_ROOT)), latest.text);
});

for (const c of committed) {
  const P = c.prior;
  test(`${c.name}: every ANCHORED race reproduces the published mean and P(R) when recomputed from the file`, () => {
    const failures: string[] = [];
    for (const r of P.races.filter((x) => x.status === "ANCHORED")) {
      const h = r.published.dist!;
      const pub = { margin: r.published.margin!, probB: r.published.probB!, p10: r.published.p10!, p90: r.published.p90! };
      const cal = calibrate(h, pub).calibration;
      assert.deepEqual(cal, r.calibration, `${r.raceId}: calibration is reproducible`);
      const a = anchorCheck(stratifiedDraws(h, cal, P.method.draws), h, cal, pub);
      assert.deepEqual(a, r.anchor, `${r.raceId}: anchor is reproducible`);
      if (Math.abs(a.marginGap) > TOLERANCE.margin || Math.abs(a.pGap) > TOLERANCE.prob) failures.push(`${r.raceId} mean ${a.marginGap} P ${a.pGap}`);
      assert.ok(a.maxBinCdfGap <= 1 / P.method.draws, `${r.raceId}: bin masses unchanged`);
    }
    assert.deepEqual(failures, []);
    const A = P.races.filter((x) => x.status === "ANCHORED");
    const worst = (k: "marginGap" | "pGap" | "p10Gap" | "p90Gap") => Math.max(...A.map((r) => Math.abs(r.anchor![k] ?? 0)));
    console.log(`# ${A.length} anchored  worst |mean gap| ${worst("marginGap")}  |P gap| ${worst("pGap")}  |p10 gap| ${worst("p10Gap")}  |p90 gap| ${worst("p90Gap")}`);
    console.log(`# by status ${JSON.stringify(P.counts.byStatus)}  live use ${JSON.stringify(P.counts.byLiveUse)}`);
  });

  test(`${c.name}: every race is accounted for, and every non-anchored race says why and what is needed`, () => {
    assert.equal(new Set(P.races.map((r) => r.raceId)).size, P.races.length);
    for (const r of P.races) {
      if (r.status === "ANCHORED") {
        assert.equal(r.reason, null);
        continue;
      }
      assert.equal(r.liveUse, "WITHHELD", r.raceId);
      assert.ok(r.reason, `${r.raceId}: reason`);
      if (r.status !== "UNCONTESTED") assert.ok(r.needsFromForecast && P.needs[r.needsFromForecast], `${r.raceId}: needs`);
    }
    for (const r of P.races.filter((x) => x.liveUse === "ELIGIBLE")) {
      assert.equal(r.status, "ANCHORED", r.raceId);
      assert.ok(r.flags.every((f) => f.startsWith("KNOT_INFEASIBLE_")), `${r.raceId}: eligible with ${r.flags}`);
    }
  });

  test(`${c.name}: RCV, runoff and misaligned races anchor but are withheld from live use`, () => {
    const R = (id: string) => P.races.find((r) => r.raceId === id)!;
    for (const id of ["sen-AK", "gov-AK", "sen-ME"]) {
      assert.equal(R(id).liveUse, "WITHHELD", id);
      assert.ok(R(id).flags.includes("RCV_FINAL_ROUND_MARGIN"), id);
    }
    for (const id of ["sen-GA", "gov-GA"]) assert.ok(R(id).flags.includes("LIVE_RULE_NOT_PLURALITY"), id);
    assert.ok(R("gov-AK").flags.includes("COUNTY_BASELINE_DISCREPANCY"));
  });

  test(`${c.name}: county geography re-aggregates to every sampled draw`, () => {
    for (const r of P.races.filter((x) => x.geography)) {
      const g = r.geography!;
      assert.equal(g.check.outsideReachable, 0, `${r.raceId}: every draw is reachable`);
      assert.ok(g.check.maxAggregateError < 1e-6, `${r.raceId}: ${g.check.maxAggregateError}`);
    }
  });

  test(`${c.name}: the seven county files that disagree with the published figure are reported, not edited`, () => {
    const d = P.countyAudit.filter((a) => a.discrepant).map((a) => a.raceId).sort();
    console.log(`# discrepant county files: ${P.countyAudit.filter((a) => a.discrepant).map((a) => `${a.raceId} ${a.gap}`).join(", ")}`);
    assert.ok(d.includes("gov-AK"));
    assert.ok(d.every((id) => /AK|MO/.test(id)), d.join(","));
  });
}

test("a single offset cannot match both the mean and P(R): the original design fails where this one passes", () => {
  const P = committed[committed.length - 1].prior;
  const A = P.races.filter((x) => x.status === "ANCHORED");
  const median = A.filter((r) => !r.singleOffset!.medianShift.pass).length, mean = A.filter((r) => !r.singleOffset!.meanShift.pass).length;
  console.log(`# single offset fails: to the median ${median}/${A.length}, to the mean ${mean}/${A.length}; calibrated: 0/${A.length}`);
  assert.ok(median > 0 && mean > 0);
});

// ---- math, on a synthetic histogram ---------------------------------------------------------------------------------

const H: PublishedHistogram = { lo: -10, w: 1, c: [1, 3, 8, 20, 40, 60, 70, 60, 40, 30, 25, 20, 10, 6, 4, 2, 1, 0, 0, 0] };

test("calibration keeps every bin's mass and hits mean, P, p10 and p90 together", () => {
  const n = H.c.reduce((s, x) => s + x, 0);
  const pub = { margin: -2.62, probB: 0.15, p10: -5.8, p90: 1.4 };
  const { calibration } = calibrate(H, pub);
  assert.ok(calibration.knots.every((k) => k.feasible));
  const draws = stratifiedDraws(H, calibration, 40000);
  const a = anchorCheck(draws, H, calibration, pub);
  assert.ok(a.pass, JSON.stringify(a));
  assert.ok(Math.abs(a.p10Gap!) < 1e-9 && Math.abs(a.p90Gap!) < 1e-9);
  for (let k = 0; k <= H.c.length; k++) {
    const edge = H.lo + k * H.w;
    const below = draws.filter((x) => x < edge).length / draws.length;
    assert.ok(Math.abs(below - histogramCdf(H, edge)) <= 1 / draws.length, `edge ${edge}`);
  }
  assert.equal(n, 400);
});

test("quantiles are monotone and draws are deterministic", () => {
  const { calibration } = calibrate(H, { margin: -3, probB: 0.2, p10: -6.5, p90: 1 });
  let prev = -Infinity;
  for (let u = 0; u <= 1; u += 0.001) {
    const x = calibratedQuantile(H, calibration, u);
    assert.ok(x >= prev - 1e-12);
    prev = x;
  }
  assert.deepEqual(stratifiedDraws(H, calibration, 1000), stratifiedDraws(H, calibration, 1000));
});

test("an infeasible knot is recorded, not forced", () => {
  const { calibration } = calibrate(H, { margin: -3, probB: 0.6, p10: -6.5, p90: 1 });
  const k = calibration.knots.find((x) => x.target === "P_B")!;
  assert.equal(k.feasible, false);
});

test("county shift: monotone, reaches only what two-party votes allow, solves exactly", () => {
  const rows: [number, number, number, number][] = [[600, 300, 100, 1000], [200, 700, 100, 1000], [0, 50, 0, 50]];
  assert.ok(aggregateMargin(rows, -1) < aggregateMargin(rows, 0) && aggregateMargin(rows, 0) < aggregateMargin(rows, 1));
  assert.ok(aggregateMargin(rows, 40) < 100 * (1850 - 0) / 2050 + 1e-9);
  const d = solveShift(rows, 5)!;
  assert.ok(Math.abs(aggregateMargin(rows, d) - 5) < 1e-9);
  assert.equal(solveShift(rows, 99), null);
});
