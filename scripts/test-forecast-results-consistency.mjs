// Published expected results vs the committed forecast they are generated from.
// public/results/2026 is written by scripts/results/build_2026_expected.py and contains nothing new: every field below is
// re-derived here from the committed public/forecast files by the generator's own rules and compared. A disagreement means
// the results were generated from different inputs (e.g. a model run that was never committed) or edited by hand.
//
//   index field                 derived from (public/forecast/...)
//   ids, k, st                  model.races, downballot.races, measures.measures, statehouse.chambers, other_races (Nov 3)
//   sen/gov/house c, tot        model.races[].cands (named, not "No ..."), [].votes.total
//   sen/gov/house m, pR         model.races[].est.margin (2 places), .est.prob (4 places)
//   house civ.d / civ.al        model.races[].st + district
//   state c, tot, m, pR         downballot.races[].dem/gop/others + votes.dem/rep/total, est.margin/prob
//   measure c, tot, yes, pPass  measures.measures[].votes.yes/no/total, est.yes/prob, threshold
//   leg dS rS pD pR seats maj   statehouse.chambers[] demSeats gopSeats demControl gopControl seats majority up
//   other c                     other_races.races[].candidates (no expected vote)
//   st/<ST>.json counties[id]   counties.json (sen, gov), downballot_counties.json, measures_counties.json
//   st/<ST>.json leg[chamber]   statehouse.chambers[].districts[]: d seats dem gop ind votes[0..3] margin probD status
//   st/<ST>.json names          counties.json._n
// Not compared, because they are separate estimates rather than copies: county sums vs statewide totals, spending.json.
//
// Run: node --test scripts/test-forecast-results-consistency.mjs
//   FORECAST_ROOT=<dir>   check another checkout (a directory holding public/forecast and public/results)
//   CONSISTENCY_CSV=<f>   also write every disagreement to a CSV
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = process.env.FORECAST_ROOT || path.resolve(import.meta.dirname, "..");
const pub = (p) => path.join(root, "public", p);
const read = (p) => JSON.parse(fs.readFileSync(pub(p), "utf8"));
const F = (n) => read(`forecast/${n}`);
const model = F("model.json"), db = F("downballot.json"), dbc = F("downballot_counties.json"), cnty = F("counties.json");
const meas = F("measures.json"), mc = F("measures_counties.json"), sh = F("statehouse.json"), other = F("other_races.json");
const index = read("results/2026/index.json");
const stDir = pub("results/2026/st");
const stFiles = Object.fromEntries(fs.readdirSync(stDir).filter((f) => f.endsWith(".json")).map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(stDir, f), "utf8"))]));

// generator rounding: margins and shares to 2 places, probabilities to 4; a gap beyond these is a real disagreement
const M_TOL = 0.011, P_TOL = 0.0051;
const int = (x) => Math.trunc(Number(x || 0));
const FIPS = "01AL02AK04AZ05AR06CA08CO09CT10DE11DC12FL13GA15HI16ID17IL18IN19IA20KS21KY22LA23ME24MD25MA26MI27MN28MS29MO30MT31NE32NV33NH34NJ35NM36NY37NC38ND39OH40OK41OR42PA44RI45SC46SD47TN48TX49UT50VT51VA53WA54WV55WI56WY";
const FIPS_ST = Object.fromEntries(FIPS.match(/.{4}/g).map((x) => [x.slice(0, 2), x.slice(2)]));

// every disagreement is collected first, so one failing area never hides another
const issues = [];
const add = (area, id, field, forecast, results, kind) => issues.push({ area, id, field, forecast, results, kind });
const show = (x) => (x === undefined ? "missing" : typeof x === "object" ? JSON.stringify(x) : String(x));

// numbers: within tolerance, a material gap, or a different projected leader (sides differ and the gap is not rounding)
function num(area, id, field, want, got, tol, mid) {
  if (want == null && got == null) return;
  if (want == null || got == null) return add(area, id, field, want, got, "material");
  if (Math.abs(want - got) <= tol) return;
  const side = (x) => (Math.abs(x - mid) < 1e-9 ? 0 : Math.sign(x - mid));
  const leader = mid != null && side(want) !== 0 && side(got) !== 0 && side(want) !== side(got);
  add(area, id, field, want, got, leader ? "leader" : "material");
}
const same = (area, id, field, want, got, kind) => { if (JSON.stringify(want) !== JSON.stringify(got)) add(area, id, field, want, got, kind); };
const names = (c) => (c || []).map((x) => [x[0], x[1]]);
const votes = (c) => (c || []).map((x) => x[2]);

// race ids: exactly the forecast's races, once each, in no other order than the generator's
const want = [
  ...model.races.map((r) => r.id), ...db.races.map((r) => r.id), ...meas.measures.map((r) => r.id),
  ...sh.chambers.map((c) => c.id), ...other.races.filter((r) => r.date === "2026-11-03").map((r) => r.id),
];
const byId = new Map();
for (const r of index.races) { if (byId.has(r.id)) add("ids", r.id, "duplicate", null, r.id, "structure"); byId.set(r.id, r); }
const wantSet = new Set(want);
for (const id of want) if (!byId.has(id)) add("ids", id, "race", id, undefined, "structure");
for (const id of byId.keys()) if (!wantSet.has(id)) add("ids", id, "race", undefined, id, "structure");
same("ids", "index", "asOf", model.meta.updated, index.asOf, "structure");
same("ids", "index", "election", "2026-11-03", index.election, "structure");

const OFFICE = { senate: "sen", governor: "gov", house: "house" };
const AT_LARGE = new Set(["AK", "WY", "ND", "SD", "VT", "DE"]);

// county blocks: [D, R, other = total - D - R, total] from the county files; measures: [yes, no, 0, yes + no]
const rows = (src, id) => {
  const out = {};
  for (const [f, v] of Object.entries(src[id] || {})) {
    if (!Array.isArray(v) || v.length < 4) continue;
    const d = int(v[1]), r = int(v[2]), t = int(v[3]);
    out[f] = [d, r, Math.max(0, t - d - r), t];
  }
  return out;
};
const mrows = (id) => {
  const out = {};
  for (const [f, x] of Object.entries(mc[id] || {})) if (Array.isArray(x) && x.length >= 3) out[f] = [int(x[1]), int(x[2]), 0, int(x[1]) + int(x[2])];
  return out;
};
const countyWant = new Map(); // id -> {st, rows}

for (const r of model.races) {
  const x = byId.get(r.id); if (!x) continue;
  const k = OFFICE[r.office], v = r.votes || {};
  const c = (r.cands || []).filter((y) => y.name && !y.name.startsWith("No ")).map((y) => [y.name, y.party, int(y.votes)]);
  same("ids", r.id, "k/st", [k, r.st], [x.k, x.st], "structure");
  same("candidates", r.id, "candidates", names(c), names(x.c), "material");
  same("votes", r.id, "candidate votes", votes(c), votes(x.c), "votes");
  same("votes", r.id, "total", int(v.total), x.tot, "votes");
  num("forecast", r.id, "margin", r.est.margin, x.m, M_TOL, 0);
  num("forecast", r.id, "pR", r.est.prob, x.pR, P_TOL, 0.5);
  if (k === "house") {
    same("ids", r.id, "civicAPI district", `${r.st}-${String(int(r.district)).padStart(2, "0")}`, x.civ?.d, "structure");
    same("ids", r.id, "at large", AT_LARGE.has(r.st) || undefined, x.civ?.al, "structure");
  } else countyWant.set(r.id, { st: r.st, rows: rows(cnty, r.id) });
}

for (const r of db.races) {
  const x = byId.get(r.id); if (!x) continue;
  const v = r.votes || {};
  const c = [];
  if (r.dem) c.push([r.dem, "D", int(v.dem)]);
  if (r.gop) c.push([r.gop, "R", int(v.rep)]);
  for (const o of r.others || []) { const nm = typeof o === "object" ? o?.name : o; if (nm) c.push([nm, (typeof o === "object" && o.party) || "O", 0]); }
  same("ids", r.id, "k/st", ["state", r.st], [x.k, x.st], "structure");
  same("candidates", r.id, "candidates", names(c), names(x.c), "material");
  same("votes", r.id, "candidate votes", votes(c), votes(x.c), "votes");
  same("votes", r.id, "total", int(v.total), x.tot, "votes");
  num("forecast", r.id, "margin", r.est?.margin ?? null, x.m ?? null, M_TOL, 0);
  num("forecast", r.id, "pR", r.est?.prob ?? null, x.pR ?? null, P_TOL, 0.5);
  countyWant.set(r.id, { st: r.st, rows: rows(dbc, r.id) });
}

for (const r of meas.measures) {
  const x = byId.get(r.id); if (!x) continue;
  const v = r.votes || {};
  same("ids", r.id, "k/st", ["measure", r.st], [x.k, x.st], "structure");
  same("votes", r.id, "yes/no votes", [int(v.yes), int(v.no)], votes(x.c), "votes");
  same("votes", r.id, "total", int(v.total), x.tot, "votes");
  num("forecast", r.id, "yes share", r.est?.yes ?? null, x.yes ?? null, M_TOL, 50);
  num("forecast", r.id, "pPass", r.est?.prob ?? null, x.pPass ?? null, P_TOL, 0.5);
  same("forecast", r.id, "threshold", r.threshold ?? null, x.thr ?? null, "material");
  countyWant.set(r.id, { st: r.st, rows: mrows(r.id) });
}

for (const ch of sh.chambers) {
  const x = byId.get(ch.id); if (!x) continue;
  const ds = ch.districts || [];
  same("ids", ch.id, "k/st", ["leg", ch.st], [x.k, x.st], "structure");
  same("chambers", ch.id, "seats/majority/up", [ch.seats, ch.majority, ch.up], [x.seats, x.maj, x.up], "material");
  num("chambers", ch.id, "demSeats", ch.demSeats ?? null, x.dS ?? null, M_TOL, ch.majority == null ? null : ch.majority - 0.5);
  num("chambers", ch.id, "gopSeats", ch.gopSeats ?? null, x.rS ?? null, M_TOL, ch.majority == null ? null : ch.majority - 0.5);
  num("chambers", ch.id, "pD", ch.demControl ?? null, x.pD ?? null, P_TOL, 0.5);
  num("chambers", ch.id, "pR", ch.gopControl ?? null, x.pR ?? null, P_TOL, 0.5);
  same("chambers", ch.id, "district count", ds.length, x.nd, "structure");
  const out = stFiles[ch.st]?.leg?.[ch.id];
  if (!out) { add("districts", ch.id, "chamber block", ds.length, undefined, "structure"); continue; }
  same("districts", ch.id, "district ids", ds.map((d) => String(d.d)), out.map((d) => d.d), "structure");
  const got = new Map(out.map((d) => [d.d, d]));
  for (const d of ds) {
    const id = `${ch.id} ${d.d}`, y = got.get(String(d.d));
    if (!y) continue;
    same("districts", id, "candidates", [d.dem ?? null, d.gop ?? null, d.ind ?? null], [y.D ?? null, y.R ?? null, y.I ?? null], "material");
    same("districts", id, "seats/status", [d.seats ?? 1, d.status ?? null], [y.s, y.st ?? null], "material");
    same("districts", id, "votes", (d.votes || [0, 0, 0, 0]).slice(0, 4).map(int), y.v, "votes");
    num("districts", id, "margin", d.margin ?? null, y.m ?? null, M_TOL, 0);
    num("districts", id, "pD", d.probD ?? null, y.pD ?? null, P_TOL, 0.5);
  }
}

for (const r of other.races.filter((r) => r.date === "2026-11-03")) {
  const x = byId.get(r.id); if (!x) continue;
  same("ids", r.id, "k/st", ["other", r.state], [x.k, x.st], "structure");
  same("candidates", r.id, "candidates", (r.candidates || []).map((c) => [c.name, c.party || "O"]), names(x.c), "material");
}

// state files vs the index: county blocks, their FIPS codes, county counts, names and no orphans
const seen = new Set();
for (const [id, { st, rows: w }] of countyWant) {
  const x = byId.get(id), got = stFiles[st]?.counties?.[id];
  const n = Object.keys(w).length;
  if (!n) { if (got) add("counties", id, "county block", undefined, Object.keys(got).length, "structure"); if (x?.cty != null) add("counties", id, "cty", undefined, x.cty, "structure"); continue; }
  seen.add(`${st}|${id}`);
  if (!got) { add("counties", id, "county block", n, undefined, "structure"); continue; }
  same("counties", id, "cty", n, x?.cty, "structure");
  same("counties", id, "county FIPS", Object.keys(w).sort(), Object.keys(got).sort(), "structure");
  // county FIPS, or a whole-state key such as DC-DISTRICT_OF_COLUMBIA where the source has no counties
  const wrong = Object.keys(got).filter((f) => (/^\d{5}$/.test(f) ? FIPS_ST[f.slice(0, 2)] : f.split("-")[0]) !== st);
  if (wrong.length) add("counties", id, "counties outside the state", st, wrong.slice(0, 5), "structure");
  const diff = Object.keys(w).filter((f) => got[f] && JSON.stringify(w[f]) !== JSON.stringify(got[f]));
  if (diff.length) add("counties", id, `county votes (${diff.length} counties)`, w[diff[0]], got[diff[0]], "votes");
}
for (const [st, f] of Object.entries(stFiles)) {
  for (const id of Object.keys(f.counties || {})) if (!seen.has(`${st}|${id}`)) add("counties", id, "orphan county block", undefined, st, "structure");
  for (const id of Object.keys(f.leg || {})) if (sh.chambers.find((c) => c.id === id)?.st !== st) add("districts", id, "orphan chamber block", undefined, st, "structure");
  const wn = Object.fromEntries(Object.entries(cnty._n || {}).filter(([k]) => FIPS_ST[k.slice(0, 2)] === st));
  same("counties", st, "county names", wn, f.names || {}, "structure");
}

if (process.env.CONSISTENCY_CSV) {
  const q = (s) => `"${show(s).replaceAll('"', '""')}"`;
  fs.writeFileSync(process.env.CONSISTENCY_CSV, ["area,id,field,kind,forecast,results", ...issues.map((i) => [i.area, i.id, i.field, i.kind, i.forecast, i.results].map(q).join(","))].join("\n") + "\n");
}

const report = (area) => {
  const xs = issues.filter((i) => i.area === area).sort((a, b) => (b.kind === "leader") - (a.kind === "leader"));
  const kinds = {}; for (const i of xs) kinds[i.kind] = (kinds[i.kind] || 0) + 1;
  return `${xs.length} disagreement(s) ${JSON.stringify(kinds)}\n  ${xs.slice(0, 20).map((i) => `${i.id} ${i.field}: forecast ${show(i.forecast)} vs results ${show(i.results)}${i.kind === "leader" ? " (leader differs)" : ""}`).join("\n  ")}${xs.length > 20 ? "\n  ..." : ""}`;
};
const none = (area) => assert.equal(issues.filter((i) => i.area === area).length, 0, report(area));

test("summary: projected leaders agree", (t) => {
  const leaders = issues.filter((i) => i.kind === "leader");
  const kinds = {}; for (const i of issues) kinds[i.kind] = (kinds[i.kind] || 0) + 1;
  t.diagnostic(`${issues.length} disagreement(s) ${JSON.stringify(kinds)}; records ${new Set(issues.map((i) => i.id)).size}`);
  assert.deepEqual(leaders.map((i) => `${i.id} ${i.field}: forecast ${i.forecast} vs results ${i.results}`), []);
});
test("race ids, offices, states and civicAPI district ids", () => none("ids"));
test("candidate names and parties", () => none("candidates"));
test("expected margins and win probabilities", () => none("forecast"));
test("expected votes by candidate and totals", () => none("votes"));
test("legislative chambers: seats, majority, control", () => none("chambers"));
test("legislative districts: candidates, votes, margins, probabilities, status", () => none("districts"));
test("state files agree with the index: county blocks, FIPS codes, names, no orphans", () => none("counties"));
