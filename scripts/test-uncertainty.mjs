// Published √2 uncertainty widening (Senate + House only): math invariants, untouched fields, idempotency and
// byte-for-byte reproducibility of the committed forecast files from Lester's baseline.
// Run: node --test scripts/test-uncertainty.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { SCALE, OFFICES, widenProb, phi, phiInv, seatDist, apply } from "./calibration/apply-uncertainty.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const BASE_SHA = "f4ec965c"; // last production commit carrying Lester's unwidened Nov 2 publish
const read = (p) => readFileSync(join(ROOT, "public/forecast", p), "utf8");
const model = JSON.parse(read("model.json"));
const U = model.meta.uncertainty;
const gitShow = (sha, p) => { try { return execFileSync("git", ["show", `${sha}:${p}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 }); } catch { return null; } };
const pinned = gitShow(BASE_SHA, "public/forecast/model.json");
// Byte-level checks only apply while the committed files were widened from that exact baseline publish.
const baseRaw = pinned && createHash("sha256").update(pinned).digest("hex") === U?.source?.sha256 ? pinned : null;
const SKIP = baseRaw ? false : `baseline ${BASE_SHA} unavailable or superseded by a newer publish`;

test("widenProb: identity at scale 1, fixed points, symmetry, pulls toward 50%", () => {
  for (const p of [0.01, 0.2, 0.5, 0.7071, 0.99]) assert.ok(Math.abs(widenProb(p, 1) - p) < 1e-6);
  for (const p of [0, 1]) assert.equal(widenProb(p), p);
  assert.ok(Math.abs(widenProb(0.5) - 0.5) < 1e-6);
  for (const p of [0.03, 0.31, 0.6, 0.97]) {
    assert.ok(Math.abs(widenProb(1 - p) - (1 - widenProb(p))) < 1e-6);
    assert.ok(Math.abs(widenProb(p) - 0.5) < Math.abs(p - 0.5));
  }
  assert.ok(Math.abs(phi(phiInv(0.8854)) - 0.8854) < 1e-6);
  assert.ok(Math.abs(widenProb(phi(1)) - phi(1 / Math.SQRT2)) < 1e-6);
});

test("seat distribution is a proper distribution", () => {
  const d = seatDist([0.1, 0.5, 0.9, 1, 0], 0.6);
  assert.ok(Math.abs(d.reduce((a, b) => a + b, 0) - 1) < 1e-6);
  assert.equal(d[0], 0); // the certain D seat is always won
});

test("published model carries the √2 marker for Senate and House only", () => {
  assert.ok(U, "meta.uncertainty");
  assert.equal(U.scale, SCALE);
  assert.deepEqual(U.offices, OFFICES);
  assert.equal(U.status, "published");
});

test("race probabilities are the widened baseline; uncontested races stay certain", () => {
  let n = 0;
  for (const r of model.races) {
    if (!OFFICES.includes(r.office)) continue;
    const b = U.baseline.raceProb[r.id];
    assert.ok(b != null, r.id);
    assert.ok(Math.abs(r.est.prob - widenProb(b)) < 6e-5, `${r.id} ${r.est.prob} vs ${widenProb(b)}`);
    if (b === 0 || b === 1) assert.equal(r.est.prob, b);
    n++;
  }
  assert.ok(n > 400);
});

test("chamber control matches its own seat histogram and is widened toward 50%", () => {
  for (const [ch, need] of [["senate", 51], ["house", 218]]) {
    const c = model.chambers[ch], b = U.baseline.chambers[ch], seats = ch === "senate" ? 100 : 435;
    const pHist = c.hist.filter(([g]) => seats - g >= need).reduce((a, [, p]) => a + p, 0);
    assert.ok(Math.abs(pHist - c.demControl) < 0.01, `${ch} hist ${pHist} vs ${c.demControl}`);
    assert.ok(Math.abs(c.demControl + c.gopControl - 1) < 1e-6);
    assert.ok(c.demControl < b.demControl && c.demControl > 0.5, ch);
    assert.ok(c.demP90 - c.demP10 > b.demP90 - b.demP10, `${ch} range widens`);
  }
});

test("margins, governors and every non-probability field match Lester's baseline", { skip: SKIP }, () => {
  // JSON round-trip equality: a baseline poll margin of -0.0 serialises as 0, which is the same displayed value.
  const J = (x) => JSON.stringify(x);
  const base = JSON.parse(baseRaw), byId = new Map(base.races.map((r) => [r.id, r]));
  assert.equal(model.races.length, base.races.length);
  for (const r of model.races) {
    const b = byId.get(r.id);
    assert.equal(r.est.margin, b.est.margin, r.id);
    assert.equal(r.rating, b.rating, r.id);
    if (!OFFICES.includes(r.office)) assert.equal(J(r), J(b), `${r.id} untouched`);
  }
  assert.equal(J(model.chambers.governor), J(base.chambers.governor));
  const { uncertainty, ...meta } = model.meta;
  assert.equal(J(meta), J(base.meta));
  assert.ok(uncertainty);
});

test("transform is deterministic: baseline → apply() reproduces committed files; rerun is a no-op", { skip: SKIP }, () => {
  const tmp = mkdtempSync(join(tmpdir(), "unc-")), dir = join(tmp, "public/forecast");
  try {
    mkdirSync(join(dir, "scenarios"), { recursive: true });
    const files = ["model.json", "whatif.json", ...readdirSync(join(ROOT, "public/forecast/scenarios")).map((f) => `scenarios/${f}`)];
    for (const f of files) writeFileSync(join(dir, f), gitShow(BASE_SHA, `public/forecast/${f}`));
    const first = apply(tmp);
    assert.ok(first.files.includes("model.json") && first.files.includes("whatif.json"));
    for (const f of files) assert.equal(readFileSync(join(dir, f), "utf8"), read(f), `${f} reproducible`);
    assert.equal(apply(tmp).files.length, 0);
    assert.equal(apply(ROOT, { check: true }).files.length, 0);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("What-if joint sims agree with the widened chamber odds", () => {
  const w = JSON.parse(read("whatif.json")), N = w.meta.sims;
  assert.ok(w.meta.uncertainty);
  const bits = Buffer.from(w.hwin, "base64"), seats = new Array(N).fill(0);
  w.house.forEach((_, i) => { for (let s = 0; s < N; s++) if (bits[i * w.hbytes + (s >> 3)] & (0x80 >> (s & 7))) seats[s]++; });
  const ctl = seats.filter((x) => x >= 218).length / N;
  assert.ok(Math.abs(ctl - model.chambers.house.demControl) < 0.03, `house sims ${ctl}`);
  const dev = new Int16Array(new Uint8Array(Buffer.from(w.dev, "base64")).buffer), sen = w.races.map((r, i) => [r, i]).filter(([r]) => r.office === "senate");
  let win = 0;
  for (let s = 0; s < N; s++) win += 34 + sen.filter(([r, i]) => r.m + dev[i * N + s] / 10 < 0).length >= 51;
  assert.ok(Math.abs(win / N - model.chambers.senate.demControl) < 0.12, `senate sims ${win / N}`);
});

test("Senate scenario files mirror the model's widened probability", () => {
  const idx = JSON.parse(read("scenarios/index.json")), byId = new Map(model.races.map((r) => [r.id, r]));
  for (const r of idx.races) {
    const m = byId.get(r.id);
    if (!m || m.office !== "senate") continue;
    assert.ok(Math.abs(r.pD - (1 - m.est.prob)) < 2e-4, `${r.id} ${r.pD} vs ${1 - m.est.prob}`);
  }
});
