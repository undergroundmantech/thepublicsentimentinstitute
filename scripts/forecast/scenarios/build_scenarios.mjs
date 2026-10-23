// Within a state scenarios: county inputs for the county what if (/what-if?mode=state) and the
// demographic swingometer inside a state (/swingometer?mode=state).
//
// Rerun after any forecast update, from the repo root:
//   node scripts/forecast/scenarios/build_scenarios.mjs
//
// Reads only published files and writes compact JSON:
//   public/forecast/model.json            race forecasts: margin, win chance, p10 and p90, votes, candidates
//   public/forecast/counties.json         each statewide race's county forecast: margin, D, R and total votes
//   public/watchdog/county_profiles.json  each county's modeled 2026 electorate by group: share and margin
//   public/forecast/states/{ST}.json      county paths, only to place counties in the north, south, east or west
// Writes:
//   public/forecast/scenarios/index.json  every Senate and governor race with a county forecast
//   public/forecast/scenarios/{id}.json   one file per race: counties, group shares and margins, area groups
//
// County profiles were built from one forecast run per state, the Senate race where there is one. A race whose
// profile came from another race in the state keeps the profile's group shares, and each county's group margins
// move together by one amount so they add up to this race's own county forecast. Nothing is invented: a group
// missing from a county's profile is left out for that county, and a breakdown missing from every county in a
// state is left out of that state's file. Margins are R minus D in points, the sign the site uses.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUB = path.join(ROOT, "public");
const OUT = path.join(PUB, "forecast", "scenarios");
const read = (p) => JSON.parse(fs.readFileSync(path.join(PUB, p), "utf8"));

const model = read("forecast/model.json");
const counties = read("forecast/counties.json");
const profiles = read("watchdog/county_profiles.json");
const NAMES = counties._n ?? {};
const P = profiles.c ?? {};

const r1 = (x) => Math.round(x * 10) / 10;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// the breakdowns a county profile carries, in the order the tool shows them
// each returns [[share of the county's expected voters, two party margin R minus D], ...] or null
const DIMS = [
  { k: "race", l: "Race", g: ["White", "Black", "Latino", "Asian and other"], get: (p) => p.race_ },
  { k: "edu", l: "Education", g: ["College graduates", "No college degree"], get: (p) => (p.col ? [p.col[1], p.col[0]] : null) },
  { k: "age", l: "Age", g: ["18 to 29", "30 to 44", "45 to 64", "65 and older"], get: (p) => p.age },
  { k: "party", l: "Party", g: ["Democrats", "Republicans", "Independents"], get: (p) => {
    if (!p.pp || p.pp.length < 6) return null;
    const join = (a, b) => { const s = a[0] + b[0]; return [s, s ? (a[0] * a[1] + b[0] * b[1]) / s : 0]; };
    return [join(p.pp[0], p.pp[1]), join(p.pp[2], p.pp[3]), join(p.pp[4], p.pp[5])];
  } },
  { k: "vote24", l: "2024 vote", g: ["Trump voters", "Harris voters", "Third party voters", "Did not vote in 2024"], get: (p) => {
    if (!p.vp || p.vp.length < 6) return null;
    const v = p.vp, tot = v.reduce((a, x) => a + x[1], 0) || 1;
    const join = (rows) => { const s = rows.reduce((a, x) => a + x[1], 0); const m = s ? rows.reduce((a, x) => a + x[1] * (x[2] ?? 0), 0) / s : 0; return [(100 * s) / tot, m]; };
    return [join([v[0], v[1]]), join([v[2], v[3]]), join([v[4]]), join([v[5]])];
  } },
  { k: "prop", l: "Turnout propensity", g: ["High propensity", "Medium propensity", "Low propensity"], get: (p) => (p.prop ? p.prop.map((x) => [x[1], x[2]]) : null) },
  { k: "approval", l: "Trump approval", g: ["Approve of Trump", "No opinion", "Disapprove of Trump"], get: (p) => p.ap },
];

function bbox(d) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const re = /(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g; let m;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

fs.mkdirSync(OUT, { recursive: true });
const index = [];
const geoCache = {};
const unitOf = (st) => (st === "AK" ? "boroughs" : st === "LA" ? "parishes" : "counties");
const countyName = (raw, st) => {
  if (/county|parish|borough|city|census area|municipality|district/i.test(raw)) return raw;
  if (st === "LA") return `${raw} Parish`;
  if (st === "AK" || /^[0-9]/.test(raw)) return raw;
  return `${raw} County`;
};
const missing = [];

for (const r of model.races) {
  if (r.office !== "senate" && r.office !== "governor") continue;
  const rows = counties[r.id];
  if (!rows || !r.est) continue;
  const e = r.est;
  if (Math.abs(e.margin) >= 99) continue;
  const st = r.st;
  geoCache[st] ??= JSON.parse(fs.readFileSync(path.join(PUB, "forecast", "states", `${st}.json`), "utf8"));
  const paths = new Map((geoCache[st].counties ?? []).map((p) => [p.id, p.d]));
  const ids = Object.keys(rows).filter((k) => !k.startsWith("_") && Array.isArray(rows[k]) && paths.has(k));
  if (!ids.length) continue;
  // largest first, so the file reads like the race page's county table
  ids.sort((a, b) => rows[b][3] - rows[a][3]);

  const c = [], x = {}, profRaces = new Set();
  for (const d of DIMS) x[d.k] = [];
  for (const id of ids) {
    const [, D, R, T] = rows[id];
    const O = Math.max(0, T - D - R);
    c.push([id, countyName(NAMES[id] ?? id, st), Math.round(D), Math.round(R), Math.round(O)]);
    const pf = P[id];
    if (pf?.race) profRaces.add(pf.race);
    const two = D + R > 0 ? ((R - D) / (D + R)) * 100 : 0;
    for (const d of DIMS) {
      const g = pf ? d.get(pf) : null;
      if (!g || g.length !== d.g.length || g.some((v) => !Array.isArray(v) || !Number.isFinite(v[0]) || !Number.isFinite(v[1]))) { x[d.k].push(null); continue; }
      const s = g.reduce((a, v) => a + v[0], 0);
      if (s <= 0) { x[d.k].push(null); continue; }
      // shares to 100, then one common offset so the groups add up to this race's county margin
      const sh = g.map((v) => (100 * v[0]) / s);
      const comp = g.reduce((a, v, i) => a + sh[i] * v[1], 0) / 100;
      const off = two - comp;
      x[d.k].push(g.flatMap((v, i) => [r1(sh[i]), r1(clamp(v[1] + off, -100, 100))]));
    }
  }
  const dims = DIMS.filter((d) => x[d.k].some((v) => v)).map((d) => ({ k: d.k, l: d.l, g: d.g }));
  const gone = DIMS.filter((d) => !x[d.k].some((v) => v)).map((d) => d.l);
  if (gone.length) missing.push(`${r.id}: no ${gone.join(", ")}`);
  for (const d of DIMS) if (!dims.some((y) => y.k === d.k)) delete x[d.k];

  // area groups, from the forecast itself and the map
  const tot = c.reduce((a, v) => a + v[2] + v[3] + v[4], 0) || 1;
  const regions = [];
  let run = 0; const big = [];
  for (let i = 0; i < c.length && run < tot / 2; i++) { big.push(i); run += c[i][2] + c[i][3] + c[i][4]; }
  const rest = c.map((_, i) => i).filter((i) => !big.includes(i));
  const marg = (v) => { const t = v[2] + v[3] + v[4]; return t ? ((v[3] - v[2]) / t) * 100 : 0; };
  const add = (k, l, i) => { if (i.length && i.length < c.length) regions.push({ k, l, i }); };
  add("big", big.length === 1 ? `${c[big[0]][1]}, half the vote` : `The ${big.length} biggest ${unitOf(st)}, half the vote`, big);
  add("rest", `The other ${rest.length} ${unitOf(st)}`, rest);
  const ind = !!r.cands?.[0] && r.cands[0].party === "IND" && e.margin < 0;
  const L = ind ? "I" : "D";
  add("dsafe", `${L} +10 or more`, c.map((v, i) => [v, i]).filter(([v]) => marg(v) <= -10).map(([, i]) => i));
  add("close", "Within 10 points", c.map((v, i) => [v, i]).filter(([v]) => Math.abs(marg(v)) < 10).map(([, i]) => i));
  add("rsafe", "R +10 or more", c.map((v, i) => [v, i]).filter(([v]) => marg(v) >= 10).map(([, i]) => i));
  const bx = c.map((v) => bbox(paths.get(v[0])));
  const all = [Math.min(...bx.map((b) => b[0])), Math.min(...bx.map((b) => b[1])), Math.max(...bx.map((b) => b[2])), Math.max(...bx.map((b) => b[3]))];
  const mx = (all[0] + all[2]) / 2, my = (all[1] + all[3]) / 2;
  const cx = bx.map((b) => (b[0] + b[2]) / 2), cy = bx.map((b) => (b[1] + b[3]) / 2);
  if (c.length >= 6) {
    add("north", "North", c.map((_, i) => i).filter((i) => cy[i] < my));
    add("south", "South", c.map((_, i) => i).filter((i) => cy[i] >= my));
    add("east", "East", c.map((_, i) => i).filter((i) => cx[i] >= mx));
    add("west", "West", c.map((_, i) => i).filter((i) => cx[i] < mx));
  }

  const pD = 1 - e.prob;
  const sd = e.p90 > e.p10 ? (e.p90 - e.p10) / 2.5631 : 6;
  const prof = [...profRaces][0] ?? null;
  const out = {
    v: 1, updated: String(model.meta.updated), id: r.id, st, office: r.office, state: r.state,
    name: `${r.state} ${r.office === "senate" ? "Senate" : "governor"}`, dem: r.dem, gop: r.gop, ind,
    m: e.margin, pD: Math.round(pD * 10000) / 10000, sd: r1(sd), p10: e.p10, p90: e.p90,
    votes: r.votes ?? null, unit: unitOf(st),
    prof: prof && prof !== r.id ? prof : null,
    dims, c, x, regions,
  };
  fs.writeFileSync(path.join(OUT, `${r.id}.json`), JSON.stringify(out));
  index.push({ id: r.id, st, state: r.state, office: r.office, dem: r.dem, gop: r.gop, ind, m: e.margin, pD: out.pD, n: c.length, dims: dims.length });
}

index.sort((a, b) => (a.office === b.office ? Math.abs(a.m) - Math.abs(b.m) : a.office === "senate" ? -1 : 1));
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ updated: String(model.meta.updated), races: index }));
const bytes = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`${index.length} statewide races, ${(bytes / 1024).toFixed(0)} KB in public/forecast/scenarios`);
if (missing.length) console.log("Breakdowns left out:\n  " + missing.join("\n  "));
