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
const { pctPoints, pctFraction } = m.exports;

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

test("missing values give the fallback", () => {
  assert.equal(pctPoints(null), "\u2014");
  assert.equal(pctFraction(undefined), "\u2014");
  assert.equal(pctPoints(NaN, { fallback: "n/a" }), "n/a");
  assert.equal(pctFraction(Infinity, { fallback: "" }), "");
});
