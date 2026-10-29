// T2 election-rule registry: the committed file is reproducible from the committed inputs, covers every race once,
// and never treats 50% as the threshold without saying where that came from.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { collectRaceRules, renderRaceRules, RULES_INPUTS, RULES_OUT } from "../../scripts/vai/build_race_rules";
import { REPO_ROOT, readInput } from "../../scripts/vai/io";
import { allows, ruleFor } from "../../app/results/_vai/rules";
import type { RaceRulesFile } from "../../app/results/_vai/types";

const committedText = fs.readFileSync(path.join(REPO_ROOT, RULES_OUT), "utf8");
const committed = JSON.parse(committedText) as RaceRulesFile;
const index = readInput<{ races: { id: string; k: string }[] }>(REPO_ROOT, RULES_INPUTS.index).json;
const R = (id: string) => {
  const r = ruleFor(committed, id);
  assert.ok(r, `${id} has a rule`);
  return r;
};

const current = committed.inputs.every((i) => readInput(REPO_ROOT, i.path).sha256 === i.sha256);

test("deterministic: rebuilding from the committed inputs reproduces the committed file byte for byte", (t) => {
  if (!current) {
    t.skip("the results index or forecast has moved since the registry was built; run `npm run vai:rules` and commit");
    return;
  }
  assert.equal(renderRaceRules(collectRaceRules(REPO_ROOT)), committedText);
});

test("every index race has exactly one rule, and nothing else is listed", () => {
  const ids = committed.races.map((r) => r.raceId);
  assert.equal(new Set(ids).size, ids.length, "no duplicates");
  assert.deepEqual([...ids].sort(), index.races.map((r) => r.id).sort());
  console.log(`# ${ids.length} races  by rule ${JSON.stringify(committed.counts.byRule)}  by support ${JSON.stringify(committed.counts.bySupport)}`);
});

test("every non-default rule carries provenance, and only plurality may be a default", () => {
  for (const r of committed.races) {
    if (r.isDefault) {
      assert.equal(r.rule, "PLURALITY", r.raceId);
      assert.equal(r.threshold, null, `${r.raceId}: a default rule never asserts a threshold`);
    } else {
      assert.ok(r.provenance, `${r.raceId} (${r.rule}) has provenance`);
      assert.ok(r.provenance.citation || r.provenance.file || r.provenance.urls.length, `${r.raceId}: provenance points somewhere`);
    }
  }
});

test("no 50% threshold without a source", () => {
  for (const r of committed.races.filter((x) => x.threshold === 0.5)) {
    assert.equal(r.isDefault, false, r.raceId);
    assert.ok(r.provenance, r.raceId);
  }
});

test("every measure has a measure rule with its source, or is unsupported", () => {
  for (const r of committed.races.filter((x) => x.kind === "measure")) {
    assert.match(r.rule, /^MEASURE_|^MULTI_OPTION_ADVISORY$|^UNKNOWN$/, r.raceId);
    assert.ok(r.provenance?.urls.length || r.support === "UNSUPPORTED", `${r.raceId}: research URLs`);
  }
});

test("unsupported and partial rules never offer a win probability", () => {
  for (const r of committed.races) {
    if (r.support === "UNSUPPORTED") assert.ok(!allows(r, "P_WIN") && !allows(r, "P_PASS") && !allows(r, "P_MAJORITY"), r.raceId);
  }
});

test("spot checks: runoff, RCV, majority, plurality exception", () => {
  for (const id of ["sen-GA", "gov-GA"]) {
    assert.equal(R(id).rule, "MAJORITY_RUNOFF");
    assert.ok(allows(R(id), "P_RUNOFF") && allows(R(id), "P_MAJORITY") && !allows(R(id), "P_WIN"));
  }
  for (const id of ["sen-AK", "gov-AK", "house-AK-01", "sen-ME", "house-ME-01", "house-ME-02"]) {
    assert.equal(R(id).rule, "RCV", id);
    assert.ok(!allows(R(id), "P_WIN"), `${id}: no first-round winner probability`);
  }
  assert.equal(R("gov-ME").rule, "PLURALITY");
  assert.equal(R("gov-ME").isDefault, false);
  for (const id of ["gov-VT", "lg-VT", "treas-VT"]) assert.equal(R(id).rule, "MAJORITY_ELSE_LEGISLATURE", id);
  assert.equal(R("gov-PA").rule, "PLURALITY");
  assert.equal(R("gov-PA").isDefault, true);
  assert.equal(ruleFor(committed, "sen-XX"), null, "an unknown race has no rule; it is never assumed plurality");
});

test("spot checks: measure thresholds and denominators", () => {
  for (const n of [1, 2, 3]) assert.equal(R(`bm-FL-amendment-${n}`).threshold, 0.6);
  for (let n = 81; n <= 87; n++) assert.equal(R(`bm-CO-amendment-${n}`).threshold, 0.55);
  assert.equal(R("bm-CO-proposition-132").threshold, 0.5);
  assert.equal(R("bm-NH-question-1").threshold, 0.6667);
  for (const id of ["bm-MN-constitutional-amendment-1", "bm-TN-amendment-1", "bm-HI-question-1", "bm-WY-proposed-initiative-proposition-number-one"]) {
    assert.equal(R(id).rule, "MEASURE_ALL_BALLOTS_DENOMINATOR", id);
    assert.equal(R(id).support, "UNSUPPORTED", id);
  }
  assert.deepEqual(R("bm-NE-initiative-measure-440").ballotFloor, { side: "YES", shareOfAllBallots: 0.35 });
  assert.deepEqual(R("bm-MA-question-9").ballotFloor, { side: "NO", shareOfAllBallots: 0.3 });
  assert.equal(R("bm-ID-advisory-question").rule, "MULTI_OPTION_ADVISORY");
  assert.equal(R("bm-ID-advisory-question").support, "UNSUPPORTED");
});

test("chamber entries are deferred, not scored", () => {
  for (const r of committed.races.filter((x) => x.kind === "leg")) assert.equal(r.rule, "CHAMBER_AGGREGATE", r.raceId);
});
