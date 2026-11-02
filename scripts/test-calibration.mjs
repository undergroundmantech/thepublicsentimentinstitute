// The uncertainty calibration layer: at scale 1.0 it reproduces the published model with no drift; at √2 it only
// widens, labels everything it cannot compute as unavailable, leaves governors alone and never touches model.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { calibrate, compare, phi, phiInv, probit, above } from "./calibration/uncertainty.mjs";

const root = process.env.REPO || process.cwd();
const model = JSON.parse(readFileSync(join(root, "public/forecast/model.json"), "utf8"));
const base = calibrate(model, 1);
const alt = calibrate(model, Math.SQRT2);
const byId = (d) => new Map(d.races.map((r) => [r.id, r]));

test("normal CDF and its inverse agree", () => {
  for (const p of [1e-6, 0.001, 0.0244, 0.3, 0.5, 0.8832, 0.9999]) assert.ok(Math.abs(phi(phiInv(p)) - p) < 1e-7 * Math.max(1, p / 1e-3), `${p}`);
  assert.equal(probit(0, Math.SQRT2), 0);
  assert.equal(probit(1, Math.SQRT2), 1);
});

test("scale 1.0 reproduces every published race and chamber number exactly", () => {
  const b = byId(base);
  for (const r of model.races) assert.deepEqual(b.get(r.id).est, r.est, r.id);
  for (const k of ["senate", "house"]) {
    const c = base.chambers[k], m = model.chambers[k];
    for (const f of ["demControl", "gopControl", "gopSeats", "demSeats", "median", "demP10", "demP90", "hist"]) assert.deepEqual(c[f], m[f], `${k}.${f}`);
  }
  assert.deepEqual({ ...base.chambers.governor, labels: undefined }, { ...model.chambers.governor, labels: undefined });
});

test("√2 widens Senate and House toward 50% without flipping a leader; governors unchanged", () => {
  const b = byId(base);
  for (const r of alt.races) {
    const p0 = b.get(r.id).est.prob, p1 = r.est.prob;
    if (r.office === "governor") { assert.deepEqual(r.est, b.get(r.id).est); continue; }
    assert.equal(r.est.margin, b.get(r.id).est.margin, r.id);
    if (p0 === 0 || p0 === 1) { assert.equal(p1, p0, r.id); continue; }
    assert.ok(Math.abs(p1 - 0.5) <= Math.abs(p0 - 0.5) + 2e-3, `${r.id} ${p0} -> ${p1}`);
    if (Math.abs(p0 - 0.5) > 0.01) assert.equal(Math.sign(p1 - 0.5), Math.sign(p0 - 0.5), r.id);
    if (r.est.p10 != null) assert.ok(r.est.p90 - r.est.p10 >= b.get(r.id).est.p90 - b.get(r.id).est.p10, r.id);
  }
});

test("widened Senate histograms keep their counts and their centre", () => {
  const b = byId(base);
  for (const r of alt.races.filter((x) => x.office === "senate")) {
    const d0 = b.get(r.id).est.dist, d1 = r.est.dist;
    assert.deepEqual(d1.c, d0.c);
    assert.ok(Math.abs(d1.w - Math.SQRT2 * d0.w) < 1e-5);
    assert.ok(Math.abs(above(d1, r.est.margin) - above(d0, r.est.margin)) < 1e-6, r.id);
  }
});

test("labels: nothing at √2 claims to be exact except arithmetic, and joint quantities are unavailable", () => {
  for (const k of ["senate", "house"]) {
    const c = alt.chambers[k];
    for (const f of ["median", "demP10", "demP90", "hist"]) { assert.equal(c[f], null); assert.equal(c.labels[f], "unavailable"); }
    for (const f of ["demControl", "gopSeats"]) assert.equal(c.labels[f], "approximate");
  }
  assert.ok(alt.races.filter((r) => r.office !== "governor").every((r) => r.label === "approximate"));
  assert.match(alt.calibration.status, /not authorised for production/);
});

test("comparison pairs the two scenarios and records checksums and the source", () => {
  const cmp = compare(base, alt);
  assert.deepEqual(cmp.scales, [1, Math.SQRT2]);
  assert.equal(cmp.checksums.baseline, base.checksum);
  assert.ok(cmp.races.length > 0 && cmp.races.every((r) => r.office !== "governor"));
});

test("nothing in the app reads the calibrated files", () => {
  const hits = spawnSync("git", ["-C", root, "grep", "-l", "forecast/calibrated", "--", "app", "middleware.ts", "next.config.ts"], { encoding: "utf8" }).stdout.trim();
  assert.equal(hits, "", `app code reads calibrated output: ${hits}`);
});
