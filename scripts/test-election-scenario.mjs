// Election-night scenario (R+3.5 opening adjustment) checks. Run: node scripts/test-election-scenario.mjs
// Margins in the engine are Republican minus Democrat: positive is a Republican lead. D+10.5 is -10.5 here.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const m = { exports: {} }; cache.set(file, m);
  const req = (spec) => {
    const base = path.resolve(path.dirname(file), spec);
    const hit = [".ts", ".tsx", ""].map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
    return hit ? load(hit) : require(spec);
  };
  new Function("exports", "require", "module", "process", out)(m.exports, req, m, process);
  return m.exports;
}
const live = load(path.join(root, "app/results/2026/live.ts"));
const { SCENARIO, SCENARIO_PUBLIC, scenarioActive, scenarioEligible, scenarioProject } = load(path.join(root, "app/results/2026/scenario.ts"));
const { project, liveOdds, fmtM, Phi } = live;

const close = (a, b, eps = 1e-9, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} vs ${b}`);
// Three counties, each expected D+10.5 (550 D, 445 R, 5 other per 1000), so the statewide forecast is D+10.5.
const exp = { "1": [550, 445, 5, 1000], "2": [5500, 4450, 50, 10000], "3": [2750, 2225, 25, 5000] };
const T = 16000;
const race = (c, extra = {}) => ({ id: "sen-XX", k: "sen", st: "XX", nm: "XX Senate", off: "sen", c, m: -10.5, pR: 0.2, civ: {}, ...extra });
const DR = race([["Dana Dem", "D", 8800], ["Ray Rep", "R", 7120], ["Lee Lib", "L", 80]]);
const cand = (n, p, v) => [n, p, v, 0, 0, null];
const region = (pr, d, r, o = 0) => ({ n: "c", pr, c: [cand("Dana Dem", "D", d), cand("Ray Rep", "R", r), cand("Lee Lib", "L", o)] });

test("convention: the official forecast here is D+10.5 and the opening is D+7.0, not a Republican lead", () => {
  const v = scenarioProject(exp, {}, DR, null);
  close(v.official.m, -10.5, 1e-9, "official");
  close(v.adjusted.m, -7.0, 1e-9, "opening");
  assert.equal(fmtM(v.official.m), "D +10.5");
  assert.equal(fmtM(v.adjusted.m), "D +7.0");
  assert.ok(v.pRAdjusted < 0.5, "Democrat still favored");
  assert.equal(v.label, "OnPoint Election-Night Scenario · R+3.5 opening adjustment");
});

test("zero votes: exactly R+3.5 in every input shape (no regions, zero-vote regions, zero-vote topline)", () => {
  const zero = { "1": region(0, 0, 0), "2": region(0, 0, 0), "3": region(0, 0, 0) };
  for (const [ex, lv, top] of [[exp, {}, null], [exp, zero, null], [null, null, [cand("Dana Dem", "D", 0), cand("Ray Rep", "R", 0)]]]) {
    const v = scenarioProject(ex, lv, DR, top, T);
    close(v.shift, 3.5, 1e-9);
  }
});

test("prior 0 reproduces the official live estimate exactly", () => {
  const lv = { "1": region(40, 300, 200, 4), "2": region(10, 600, 380, 5) };
  for (const [ex, l, top] of [[exp, lv, null], [null, null, [cand("Dana Dem", "D", 4000), cand("Ray Rep", "R", 3500)]]]) {
    assert.deepEqual(project(ex, l, DR, top, T, 0), project(ex, l, DR, top, T));
  }
});

test("unchanged versus origin/main when no prior is passed (public output untouched)", (t) => {
  let src;
  try { src = execFileSync("git", ["show", "origin/main:app/results/2026/live.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { t.skip("origin/main not available"); return; }
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "live-main-")), "live.ts");
  fs.writeFileSync(tmp, src);
  const base = load(tmp);
  const fixtures = [
    [exp, {}, null], [exp, { "1": region(40, 300, 200, 4) }, null], [exp, { "1": region(100, 520, 470, 10), "2": region(70, 3900, 3000, 30), "3": region(5, 100, 90) }, null],
    [null, null, [cand("Dana Dem", "D", 4000), cand("Ray Rep", "R", 3500)]], [exp, null, null],
  ];
  for (const [ex, l, top] of fixtures) {
    const a = base.project(ex, l, DR, top, T), b = project(ex, l, DR, top, T);
    assert.deepEqual(b, a);
    assert.deepEqual(liveOdds(DR, b), base.liveOdds(DR, a));
  }
});

test("counted votes are never moved; the adjustment touches only the forecast share of the outstanding vote", () => {
  const lv = { "1": region(60, 400, 180, 4), "2": region(25, 1500, 1000, 10) };
  const v = scenarioProject(exp, lv, DR, null, T);
  assert.deepEqual(v.adjusted.rep, v.official.rep);
  close(v.adjusted.fin.t, v.official.fin.t, 1e-6, "total vote conserved");
  close(v.adjusted.fin.o, v.official.fin.o, 1e-6, "third-party vote untouched");
  assert.ok(v.shift > 0 && v.shift < 3.5);
});

test("fades as counted votes arrive, bounded by 3.5 x (1 - counted share), never applied twice", () => {
  let last = 3.5 + 1e-12;
  for (const p of [0, 2, 10, 25, 50, 75, 90, 99]) {
    const lv = {};
    for (const [f, e] of Object.entries(exp)) lv[f] = region(p, Math.round(e[3] * p / 100 * 0.52), Math.round(e[3] * p / 100 * 0.47), Math.round(e[3] * p / 100 * 0.01));
    const v = scenarioProject(exp, lv, DR, null, T);
    assert.ok(v.shift <= 3.5 * (1 - v.counted) + 1e-9, `bound at ${p}%: ${v.shift} > ${3.5 * (1 - v.counted)}`);
    assert.ok(v.shift <= last + 1e-9, `monotone at ${p}%`);
    assert.ok(v.shift >= 0);
    last = v.shift;
  }
});

test("complete count: zero adjustment, and the result is not pulled toward the forecast", () => {
  // returns finish at R+2.0, far from the D+10.5 forecast
  const lv = {}; for (const [f, e] of Object.entries(exp)) lv[f] = region(100, e[3] * 0.485, e[3] * 0.505, e[3] * 0.01);
  const v = scenarioProject(exp, lv, DR, null, T);
  assert.equal(v.shift, 0);
  close(v.adjusted.m, 2.0, 1e-9);
  const top = [cand("Dana Dem", "D", 7760), cand("Ray Rep", "R", 8080), cand("Lee Lib", "L", 160)];
  const w = scenarioProject(null, null, DR, top, T);
  assert.equal(w.shift, 0);
});

test("probability comes from the adjusted margin at the official spread, not a 3.5-point probability bump", () => {
  const v0 = scenarioProject(exp, {}, DR, null);
  assert.equal(v0.pROfficial, 0.2);
  assert.ok(v0.pRAdjusted > 0.2 && v0.pRAdjusted < 0.5);
  assert.ok(Math.abs(v0.pRAdjusted - v0.pROfficial - 0.035) > 0.01, "not a flat 3.5-point shift");
  const lv = { "1": region(60, 400, 180, 4), "2": region(25, 1500, 1000, 10) };
  const v = scenarioProject(exp, lv, DR, null, T);
  const so = liveOdds(DR, v.official), sa = liveOdds(DR, v.adjusted, SCENARIO.openingR);
  close(sa.sd, so.sd, 1e-9, "uncertainty unchanged");
  close(v.pRAdjusted, Phi(v.adjusted.m / so.sd), 1e-12);
});

test("unsupported races keep the official estimate", () => {
  const cases = {
    independent: race([["Indy", "I", 8000], ["Ray Rep", "R", 8000]]),
    twoRepublicans: race([["R One", "R", 8000], ["R Two", "R", 8000]]),
    twoDemocratsAndRepublican: race([["D One", "D", 5000], ["D Two", "D", 4000], ["Ray Rep", "R", 7000]]),
    noRepublican: race([["Dana Dem", "D", 9000], ["Lee Lib", "L", 7000]]),
    measure: race([["Yes", "Y", 9000], ["No", "N", 7000]], { k: "measure", yes: 56 }),
    legislature: race([["Dana Dem", "D", 9000], ["Ray Rep", "R", 7000]], { k: "leg" }),
    statewideOffice: race([["Dana Dem", "D", 9000], ["Ray Rep", "R", 7000]], { k: "state" }),
  };
  for (const [name, r] of Object.entries(cases)) {
    assert.equal(scenarioEligible(r).ok, false, name);
    const v = scenarioProject(exp, {}, r, null);
    assert.equal(v.eligible, false, name);
    assert.equal(v.shift, 0, name);
    assert.equal(v.adjusted, v.official, name);
    assert.equal(v.pRAdjusted, v.pROfficial, name);
    assert.ok(v.reason, name);
  }
  assert.equal(scenarioEligible(DR).ok, true, "D vs R with a minor third party");
  assert.equal(scenarioEligible({ ...DR, k: "house" }).ok, true);
  assert.equal(scenarioEligible({ ...DR, k: "gov" }).ok, true);
});

test("off in public output: needs a research build and ?scenario=r35", () => {
  assert.equal(SCENARIO_PUBLIC, false);
  assert.equal(scenarioActive("?scenario=r35", false), false);
  assert.equal(scenarioActive("", true), false);
  assert.equal(scenarioActive("?scenario=other", true), false);
  assert.equal(scenarioActive("?scenario=r35", true), true);
});
