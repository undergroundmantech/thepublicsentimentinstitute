// Checks for the shared percentage formatter. Run: node --test scripts/test-fmt-pct.mjs
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const ts = createRequire(import.meta.url)("typescript");
const src = fs.readFileSync(path.join(root, "app/lib/fmtPct.ts"), "utf8");
const m = { exports: {} };
new Function("exports", "module", ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(m.exports, m);
const { pctPoints, pctFraction, percentIn } = m.exports;

test("points: one decimal by default", () => {
  assert.equal(pctPoints(52.34), "52.3%");
  assert.equal(pctPoints(52.35), "52.4%");
  assert.equal(pctPoints(0.05), "0.1%");
  assert.equal(pctPoints(100), "100.0%");
  assert.equal(pctPoints(7), "7.0%");
});

test("fraction: scaled by 100, never guessed from size", () => {
  assert.equal(pctFraction(0.523), "52.3%");
  assert.equal(pctFraction(1), "100.0%");
  assert.equal(pctFraction(0.006), "0.6%");
  assert.equal(pctFraction(0), "0.0%");
  // a share already in points is not rescaled
  assert.equal(pctPoints(1), "1.0%");
  assert.equal(pctPoints(0.6), "0.6%");
});

test("headline: whole number", () => {
  assert.equal(pctFraction(0.716, { headline: true }), "72%");
  assert.equal(pctPoints(49.5, { headline: true }), "50%");
  assert.equal(pctFraction(1, { headline: true }), "100%");
});

test("no negative zero", () => {
  assert.equal(pctPoints(-0.04), "0.0%");
  assert.equal(pctPoints(-0), "0.0%");
  assert.equal(pctFraction(-0.0001, { headline: true }), "0%");
  assert.equal(pctPoints(-2.25), "-2.3%");
});

test("Percent In: >99% only above 99.0, judged unrounded", () => {
  assert.equal(percentIn(95.4), "95.4%");
  assert.equal(percentIn(98.7), "98.7%");
  assert.equal(percentIn(99.0), "99.0%");
  assert.equal(percentIn(99.04), ">99%"); // rounds to 99.0 but the unrounded value is above 99.0
  assert.equal(percentIn(99.1), ">99%");
  assert.equal(percentIn(99.3), ">99%");
  assert.equal(percentIn(99.8), ">99%");
  assert.equal(percentIn(100), ">99%");
  assert.equal(percentIn(0), "0.0%");
  assert.equal(percentIn(null), "\u2014");
});

test("win probabilities are never capped", () => {
  assert.equal(pctPoints(99.7), "99.7%");
  assert.equal(pctPoints(99.9), "99.9%");
  assert.equal(pctPoints(0.1), "0.1%");
  assert.equal(pctPoints(100), "100.0%");
  assert.equal(pctFraction(0.997), "99.7%");
  assert.equal(pctFraction(0.999), "99.9%");
  assert.equal(pctFraction(1), "100.0%");
  assert.equal(pctFraction(0.001), "0.1%");
});

test("missing values give the fallback", () => {
  assert.equal(pctPoints(null), "\u2014");
  assert.equal(pctFraction(undefined), "\u2014");
  assert.equal(pctPoints(NaN, { fallback: "n/a" }), "n/a");
  assert.equal(pctFraction(Infinity, { fallback: "" }), "");
});

const load = (rel) => { const mm = { exports: {} }; new Function("exports", "module", ts.transpileModule(fs.readFileSync(path.join(root, rel), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(mm.exports, mm); return mm.exports; };
const { countFrame } = load("app/lib/countUp.ts");

test("count-up animation never overshoots and lands exactly on the value", () => {
  for (const [a, v] of [[0, 99.7], [0, 100], [99.7, 99.0], [0.1, 0.3], [50, 50], [0, 99.04]]) {
    const lo = Math.min(a, v), hi = Math.max(a, v);
    for (let k = 0; k <= 1.2; k += 0.01) { const y = countFrame(a, v, k); assert.ok(y >= lo && y <= hi, `${a}->${v} at ${k}: ${y}`); }
    assert.equal(countFrame(a, v, 1), v);
    assert.equal(countFrame(a, v, 5), v);
  }
  // the settled display of a 99.7% win probability is 99.7%, and of a 99.04% Percent In is >99%
  assert.equal(pctPoints(countFrame(0, 99.7, 1)), "99.7%");
  assert.equal(percentIn(countFrame(0, 99.04, 1)), ">99%");
});

test("the results index carries each forecast win probability at the forecast's own precision", () => {
  const model = JSON.parse(fs.readFileSync(path.join(root, "public/forecast/model.json"), "utf8"));
  const ix = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8"));
  const byId = new Map(ix.races.map((r) => [r.id, r]));
  let checked = 0;
  for (const r of model.races) {
    const x = byId.get(r.id);
    if (!x || r.est?.prob == null) continue;
    checked++;
    assert.ok(Math.abs(x.pR - r.est.prob) < 5e-5, `${r.id}: index ${x.pR} vs forecast ${r.est.prob}`);
  }
  assert.ok(checked > 400, `checked ${checked} races`);
});
