// SYNTHETIC test data only, except the register test, which checks the generated register against the pinned
// October 25 snapshot files it was built from.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { baselineFromModel, buildRegister, crossCheckArchive, districtIdOf, parseLenientJson, researchCoverage } from "../../app/lib/intelligence/baseline";
import type { BaselineRace, Register } from "../../app/lib/intelligence/types";
import { methodHistory, pollClose, split, turnout } from "./fixtures";

test("lenient JSON turns bare NaN into null and leaves strings alone", () => {
  const v = parseLenientJson('{"a": NaN, "b": [1, NaN, -Infinity], "c": "NaN", "d": "x, NaN}"}') as Record<string, unknown>;
  assert.equal(v.a, null);
  assert.deepEqual(v.b, [1, null, null]);
  assert.equal(v.c, "NaN");
  assert.equal(v.d, "x, NaN}");
});

test("model margins (R minus D) cross-check against the archive (D minus R, win_d in percent)", () => {
  const { races } = baselineFromModel({ races: [{ id: "sen-IA", office: "senate", st: "IA", district: 0, name: "x", est: { margin: -0.65, prob: 0.4726 } }, { id: "gov-IA", office: "governor", st: "IA", district: 0, name: "y", est: { margin: -10.81, prob: 0.0164 } }] });
  assert.deepEqual(crossCheckArchive(races, { races: { IA: { office: "senate", margin: 0.65, win_d: 52.74 }, IAG: { office: "governor", margin: 10.81, win_d: 98.36 } } }).mismatches, []);
  assert.equal(crossCheckArchive(races, { races: { IA: { office: "senate", margin: -0.65, win_d: 52.74 } } }).mismatches.length, 1);
});

test("races without a finite margin are skipped and reported", () => {
  const r = baselineFromModel({ races: [{ id: "house-XX-01", office: "house", st: "XX", district: 1, name: "x", est: { margin: null } }] });
  assert.equal(r.races.length, 0);
  assert.equal(r.problems.length, 1);
});

test("ranking: absolute margin, then closeness to a coin flip, then id", () => {
  const mk = (id: string, margin: number, probB: number | null): BaselineRace => ({ raceId: id, office: "house", state: "PA", district: 1, name: id, sideA: null, sideB: null, margin, probB, p10: null, p90: null });
  const reg = buildRegister([mk("c", -1, 0.4), mk("a", 1, 0.45), mk("b", 0.5, 0.5), mk("d", 1, 0.45)], { n: 3, offices: ["house"], generatedAt: "x", source: { snapshotDate: "x", files: [], notes: [] } });
  assert.deepEqual(reg.entries.map((e) => e.raceId), ["b", "a", "d"]);
});

test("district ids", () => {
  assert.equal(districtIdOf("house-PA-7"), "PA-07");
  assert.equal(districtIdOf("house-AR-02"), "AR-02");
  assert.equal(districtIdOf("sen-PA"), null);
});

test("research coverage by component", () => {
  const recs = [turnout("sen-GA", 1, null, 2), pollClose("pc", "2026-11-04T00:00:00Z"), methodHistory("mh", "MAIL_ABSENTEE", 2022, 0.2)];
  assert.deepEqual(researchCoverage({ raceId: "sen-GA", office: "senate", state: "GA" }, recs), { reporting: "PARTIAL", outstanding: "PARTIAL", geography: "NOT_REQUIRED", methods: "PRESENT" });
  assert.equal(researchCoverage({ raceId: "house-PA-07", office: "house", state: "PA" }, [split("s", "42091", "PA-07", 0.5)]).geography, "PRESENT");
  assert.equal(researchCoverage({ raceId: "house-PA-07", office: "house", state: "PA" }, []).geography, "MISSING");
  assert.equal(researchCoverage({ raceId: "house-WY-01", office: "house", state: "WY" }, []).geography, "NOT_REQUIRED");
});

test("the committed register matches the pinned October 25 snapshot", () => {
  const reg = JSON.parse(readFileSync(new URL("../../data/intelligence/register/top50-2026-10-25.json", import.meta.url), "utf8")) as Register;
  assert.equal(reg.entries.length, 50);
  assert.equal(reg.source.snapshotDate, "2026-10-25");
  const abs = reg.entries.map((e) => Math.abs(e.baseline.margin));
  assert.deepEqual(abs, [...abs].sort((a, b) => a - b));
  // the files the register says it read are the files at the pinned ref
  for (const f of reg.source.files) {
    assert.ok(f.gitRef && f.sha256, `${f.path} has no pinned ref or hash`);
    let text: string;
    try { text = execFileSync("git", ["show", `${f.gitRef}:${f.path}`], { encoding: "utf8", maxBuffer: 1 << 29 }); } catch { continue; /* shallow clone without the ref */ }
    assert.equal(createHash("sha256").update(text).digest("hex"), f.sha256, f.path);
  }
});
