// Published forecast vs expected results: public/results/2026 is generated from public/forecast by
// scripts/results/build_2026_expected.py, and both are read by the site. This fails when they disagree, e.g. results
// regenerated from a model run that was never committed. Run: node --test scripts/test-forecast-results-consistency.mjs
// FORECAST_ROOT=<dir> checks another checkout (a directory holding public/forecast and public/results).
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = process.env.FORECAST_ROOT || path.resolve(import.meta.dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, "public", p), "utf8"));
const model = read("forecast/model.json"), db = read("forecast/downballot.json");
const meas = read("forecast/measures.json"), sh = read("forecast/statehouse.json");
const index = read("results/2026/index.json");
const byId = new Map(index.races.map((r) => [r.id, r]));
const stFile = new Map();
const state = (st) => {
  if (!stFile.has(st)) { const p = `results/2026/st/${st}.json`; stFile.set(st, fs.existsSync(path.join(root, "public", p)) ? read(p) : null); }
  return stFile.get(st);
};

// the generator rounds margins to 2 places and probabilities to 4; anything beyond these is a real disagreement
const M_TOL = 0.011, P_TOL = 0.0051;
const side = (x) => (x == null || Math.abs(x) < 1e-9 ? 0 : Math.sign(x));

function compare(label, pairs) {
  const bad = [];
  for (const [id, fields] of pairs) {
    for (const [name, want, got, tol, flip] of fields) {
      if (want == null && got == null) continue;
      if (want == null || got == null) { bad.push(`${id} ${name}: forecast ${want} vs results ${got}`); continue; }
      const a = side(want - flip), b = side(got - flip);
      const off = Math.abs(want - got) > tol, flipped = flip !== 0 && a !== 0 && b !== 0 && a !== b;
      if (off || flipped) bad.push(`${id} ${name}: forecast ${want} vs results ${got}${flipped ? " (leader differs)" : ""}`);
    }
  }
  bad.sort((x, y) => y.endsWith("(leader differs)") - x.endsWith("(leader differs)"));
  assert.equal(bad.length, 0, `${label}: ${bad.length} disagreement(s)\n  ${bad.slice(0, 25).join("\n  ")}${bad.length > 25 ? "\n  ..." : ""}`);
}

const missing = (ids) => ids.filter((id) => !byId.has(id));

test("results index is dated from the same model run", () => {
  assert.equal(index.asOf, model.meta.updated);
});

test("Senate, governor and House: margin, win probability and nominees match model.json", () => {
  assert.deepEqual(missing(model.races.map((r) => r.id)), []);
  compare("model.json", model.races.map((r) => {
    const x = byId.get(r.id);
    return [r.id, [["margin", r.est.margin, x.m, M_TOL, 0], ["pR", r.est.prob, x.pR, P_TOL, 0.5]]];
  }));
  // same rule as the generator: named entries of cands, without "No Republican on the ballot" style placeholders
  const want = (r) => (r.cands || []).filter((c) => c.name && !c.name.startsWith("No ")).map((c) => `${c.name}|${c.party}`).join(",");
  const names = model.races.filter((r) => want(r) !== byId.get(r.id).c.map((y) => `${y[0]}|${y[1]}`).join(","));
  assert.deepEqual(names.map((r) => r.id), []);
});

test("statewide down ballot races match downballot.json", () => {
  const rs = db.races.filter((r) => byId.has(r.id) || r.est);
  assert.deepEqual(missing(rs.map((r) => r.id)), []);
  compare("downballot.json", rs.map((r) => {
    const x = byId.get(r.id), e = r.est || {};
    return [r.id, [["margin", e.margin ?? null, x.m ?? null, M_TOL, 0], ["pR", e.prob ?? null, x.pR ?? null, P_TOL, 0.5]]];
  }));
});

test("ballot measures match measures.json", () => {
  assert.deepEqual(missing(meas.measures.map((r) => r.id)), []);
  compare("measures.json", meas.measures.map((r) => {
    const x = byId.get(r.id), e = r.est || {};
    return [r.id, [["yes", e.yes ?? null, x.yes ?? null, M_TOL, 0], ["pPass", e.prob ?? null, x.pPass ?? null, P_TOL, 0.5]]];
  }));
});

test("legislative chambers and districts match statehouse.json", () => {
  assert.deepEqual(missing(sh.chambers.map((c) => c.id)), []);
  compare("statehouse.json chambers", sh.chambers.map((c) => {
    const x = byId.get(c.id);
    return [c.id, [["demSeats", c.demSeats ?? null, x.dS ?? null, M_TOL, 0], ["gopSeats", c.gopSeats ?? null, x.rS ?? null, M_TOL, 0],
      ["pD", c.demControl ?? null, x.pD ?? null, P_TOL, 0.5]]];
  }));
  const pairs = [];
  for (const c of sh.chambers) {
    const out = new Map(((state(c.st) || {}).leg?.[c.id] || []).map((d) => [d.d, d]));
    for (const d of c.districts || []) {
      const x = out.get(String(d.d));
      if (!x) { pairs.push([`${c.id} ${d.d}`, [["district", 1, null, 0, 0]]]); continue; }
      pairs.push([`${c.id} ${d.d}`, [["margin", d.margin ?? null, x.m ?? null, M_TOL, 0], ["pD", d.probD ?? null, x.pD ?? null, P_TOL, 0.5]]]);
    }
  }
  compare("statehouse.json districts", pairs);
});
