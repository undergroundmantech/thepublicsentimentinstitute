// ─────────────────────────────────────────────────────────────────────────────
// TPSI Forecast — model build.
//
// Implements the layered VoteHub-style system:
//   Stage I    fundamentals (PVI anchor → 2026 environment via elasticity,
//              incumbency, open-seat drift)
//   Stage II   polling: rank-decay recency, within-pollster compression,
//              pollster quality + sponsorship discounts, ENOP; blend weight
//              w = w̄·√(ENOP/n̄)·r(days), governor exponent γG
//   Stage III  expert ratings as interval projections with time-rising weight
//   Stage IV-VI market-implied margins with liquidity + dynamic weighting
//              (Complete model only; Legacy = Stages I–II)
//   Sims       continuous-similarity covariance (feature distances → office-
//              pair-bounded correlations → eigenvalue-clipped PSD → national
//              factor carve-out + residual Cholesky), M = 40,000
//   Output     race table, chamber histograms/control odds, 60-day trends,
//              county-level projections from real registration data.
//
// Deterministic: a seeded PRNG drives every stochastic step.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { buildUniverse, STATE_NAMES, REGION, ELASTICITY, PRES_2024, PRES_2020 } from "./universe.mjs";

const OUT = "public/forecast";
mkdirSync(OUT, { recursive: true });

// ── deterministic PRNG ───────────────────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const djb2 = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; };
const rngFor = (tag) => mulberry32(djb2("tpsi26·" + tag));
const gauss = (rng) => {
  const u = Math.max(rng(), 1e-12), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const erf = (x) => {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
};
const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

// ── model clock ──────────────────────────────────────────────────────────────
const TODAY = "2026-07-08";
const ELECTION = "2026-11-03";
const DAYS_OUT = Math.round((Date.parse(ELECTION) - Date.parse(TODAY)) / 86400000); // 118

// ── the national environment, from the generic ballot ───────────────────────
// A national poll bank feeds the same weighting machinery as race polls; the
// average is regularized toward a midterm prior (out-party advantage scaled by
// presidential net approval, −17.5 in the TPSI average) with the prior's
// weight decaying to zero by Election Day.
const NATIONAL_POLLSTERS = [
  { n: "TPSI Poll",           q: 1.0,  he: 0.0 },
  { n: "Meridian Research",   q: 0.92, he: -0.4 },
  { n: "Beacon Analytics",    q: 0.9,  he: 0.5 },
  { n: "Statecraft Surveys",  q: 0.84, he: -0.8 },
  { n: "Northlight Polling",  q: 0.8,  he: 1.0 },
  { n: "Civitas Field Group", q: 0.74, he: -1.2 },
  { n: "Harbor National",     q: 0.86, he: 0.3 },
  { n: "Atlas Omnibus",       q: 0.7,  he: -0.6 },
];
function buildGenericBallot() {
  const rng = rngFor("genball");
  const TRUE_GB = -5.1; // the environment the season's data is drawn around
  const polls = [];
  for (let i = 0; i < 34; i++) {
    const p = NATIONAL_POLLSTERS[Math.floor(rng() * NATIONAL_POLLSTERS.length)];
    const age = Math.floor(Math.pow(rng(), 1.4) * 95) + 1;
    const size = 900 + Math.floor(rng() * 1400);
    const moe = 130 / Math.sqrt(size);
    const val = TRUE_GB + p.he + gauss(rng) * moe;
    polls.push({ pollster: p.n, q: p.q, age, size, margin: Math.round(val * 10) / 10 });
  }
  polls.sort((a, b) => a.age - b.age);
  // same nested weighting as race polls (rank decay → pollster compression)
  const u = (p, rank) => Math.pow(Math.max(0.8, 0.985 - 0.011 * rank), p.age);
  const byPollster = new Map();
  polls.forEach((p, i) => {
    if (!byPollster.has(p.pollster)) byPollster.set(p.pollster, []);
    byPollster.get(p.pollster).push({ ...p, rank: i });
  });
  let wSum = 0, mSum = 0;
  for (const [, list] of byPollster) {
    const uSum = list.reduce((s, p) => s + u(p, p.rank), 0);
    const mean = list.reduce((s, p) => s + u(p, p.rank) * p.margin, 0) / uSum;
    const newest = list.reduce((a, b) => (a.age < b.age ? a : b));
    const g = newest.q * Math.pow(Math.max(0.8, 0.985 - 0.011 * newest.rank), newest.age);
    wSum += g; mSum += g * mean;
  }
  const avg = mSum / wSum;
  // midterm prior: out-party edge grows with presidential unpopularity
  const NET_APPROVAL = -17.5;
  const prior = -(2.4 + 0.18 * Math.abs(NET_APPROVAL)); // ≈ D+5.6
  const wPrior = 0.42 * (DAYS_OUT / 365);               // fades to 0 at the wire
  const npe = (1 - wPrior) * avg + wPrior * prior;
  return {
    avg: Math.round(avg * 10) / 10,
    prior: Math.round(prior * 10) / 10,
    npe: Math.round(npe * 10) / 10,
    netApproval: NET_APPROVAL,
    polls: polls.slice(0, 14).map((p) => ({ pollster: p.pollster, age: p.age, n: p.size, margin: p.margin })),
  };
}
const GB = buildGenericBallot();
const NPE_2026 = GB.npe;
const NPE_2024 = 1.5;

// ── Stage I · fundamentals ───────────────────────────────────────────────────
const INC_BONUS = { governor: 4.6, senate: 3.4, house: 2.6 };
const NPE_2020 = -3.1; // 2020 national House-vote environment (D+3.1)

// §1.9 predicted-dynamics overlay: analyst-belief coalition drift — Trump-era
// low-propensity coalitions revert in a midterm, strongest where the Hispanic
// vote share is largest (pro-D on the R+ scale, so negative).
const HISP_SHARE = {
  NM: 0.48, TX: 0.40, CA: 0.40, AZ: 0.32, NV: 0.29, FL: 0.27, CO: 0.22,
  NJ: 0.21, NY: 0.19, IL: 0.18, CT: 0.17, RI: 0.17, UT: 0.15, WA: 0.14,
  OR: 0.14, ID: 0.13, KS: 0.13, MA: 0.13, NE: 0.12, OK: 0.12, MD: 0.12,
  HI: 0.11, NC: 0.10, GA: 0.10, VA: 0.10, DE: 0.10, WY: 0.10, AR: 0.09,
  PA: 0.08, WI: 0.08, IN: 0.08, IA: 0.07, SC: 0.07, TN: 0.07, AK: 0.07,
  MI: 0.06, MN: 0.06, LA: 0.06, AL: 0.05, MO: 0.05, NH: 0.05, SD: 0.05,
  KY: 0.04, OH: 0.04, MS: 0.04, MT: 0.04, ND: 0.04, ME: 0.02, VT: 0.02, WV: 0.02,
};
const DYN_REVERSION = -4.0;

function fundamentals(r) {
  const ex = (ELASTICITY[r.st] ?? 1.0) * (Math.abs(r.pvi) < 8 ? 1.04 : 1.0); // competitive races run hotter
  const shift = (npeBase) => (npeBase - NPE_2026) * ex; // Δ from that baseline's environment to 2026
  let m;
  if (r.p20 != null) {
    // §1.1: the two most recent presidential anchors, each environment-adjusted,
    // plus the race adjustment (prior same-office performance, candidate quality)
    m = 0.6 * (r.p24 - shift(NPE_2024)) + 0.4 * (r.p20 - shift(NPE_2020)) + (r.adj ?? 0);
  } else {
    m = r.pvi - shift(NPE_2024); // House leans are already on 2026 lines
  }
  m += r.inc * INC_BONUS[r.office];
  if (r.open) m += (m > 0 ? -0.7 : 0.7); // open seats drift toward the center
  m += DYN_REVERSION * (HISP_SHARE[r.st] ?? 0.08); // §1.9 overlay
  return m;
}

// the race's underlying "true" margin used to generate polls/ratings/markets —
// fundamentals plus a race-specific reality the model has to discover
function latentTruth(r, mF) {
  const rng = rngFor("truth·" + r.id);
  const sd = r.office === "governor" ? 4.2 : r.office === "senate" ? 3.4 : 3.0;
  return mF + gauss(rng) * sd;
}

// ── Stage II · polling ───────────────────────────────────────────────────────
const POLLSTERS = [
  { n: "TPSI Poll",            q: 1.0,  he: 0.0,  kind: "public" },
  { n: "Meridian Research",    q: 0.92, he: -0.5, kind: "public" },
  { n: "Beacon Analytics",     q: 0.9,  he: 0.6,  kind: "public" },
  { n: "Statecraft Surveys",   q: 0.84, he: -0.9, kind: "public" },
  { n: "Northlight Polling",   q: 0.8,  he: 1.1,  kind: "public" },
  { n: "Civitas Field Group",  q: 0.74, he: -1.4, kind: "public" },
  { n: "Ridgeline Strategies", q: 0.68, he: 2.1,  kind: "partisan-R" },
  { n: "Bluestem Research",    q: 0.68, he: -2.0, kind: "partisan-D" },
  { n: "Campaign Internal",    q: 0.6,  he: 2.8,  kind: "internal" },
];
const SPONSOR_A = { public: 1.0, "partisan-R": 0.7, "partisan-D": 0.7, internal: 0.4 };

function genPolls(r, mTrue) {
  const rng = rngFor("polls·" + r.id);
  const closeness = Math.max(0, 20 - Math.abs(mTrue)) / 20;
  let base = r.office === "house" ? 1.2 : 3.2;
  if (r.marquee) base += 7;
  const n = Math.round(base + closeness * (r.office === "house" ? 4 : 7) + rng() * 3);
  const polls = [];
  for (let i = 0; i < n; i++) {
    const p = POLLSTERS[Math.floor(rng() * POLLSTERS.length)];
    const age = Math.floor(Math.pow(rng(), 1.5) * 110) + 1; // denser recently
    const size = 400 + Math.floor(rng() * 900);
    const moe = 98 / Math.sqrt(size);
    const val = mTrue + p.he * (p.kind === "internal" ? (mTrue > 0 ? 1 : -1) : 1) + gauss(rng) * moe;
    polls.push({ pollster: p.n, q: p.q, kind: p.kind, age, size, margin: Math.round(val * 10) / 10 });
  }
  polls.sort((a, b) => a.age - b.age);
  return polls;
}

// rank-dependent decay base — recent ranks decay slowly, deep ranks fast
const rankBase = (r) => Math.max(0.8, 0.985 - 0.011 * (r - 1));

function averagePolls(polls) {
  if (!polls.length) return { avg: null, enop: 0 };
  const withRank = polls.map((p, i) => ({ ...p, rank: i + 1 }));
  const u = (p) => Math.pow(rankBase(p.rank), p.age);
  // within-pollster compression
  const byPollster = new Map();
  for (const p of withRank) {
    if (!byPollster.has(p.pollster)) byPollster.set(p.pollster, []);
    byPollster.get(p.pollster).push(p);
  }
  let enop = 0;
  const entries = [];
  for (const [, list] of byPollster) {
    const uSum = list.reduce((s, p) => s + u(p), 0);
    const mean = list.reduce((s, p) => s + u(p) * p.margin, 0) / uSum;
    const newest = list.reduce((a, b) => (a.age < b.age ? a : b));
    const g = newest.q * Math.pow(rankBase(newest.rank), newest.age); // raw pollster weight
    enop += g;
    for (const p of list) {
      entries.push({ margin: p.margin, w: g * (u(p) / uSum) * SPONSOR_A[p.kind] });
    }
  }
  const wSum = entries.reduce((s, e) => s + e.w, 0);
  const avg = entries.reduce((s, e) => s + e.w * e.margin, 0) / wSum;
  return { avg: Math.round(avg * 100) / 100, enop: Math.round(enop * 100) / 100 };
}

function pollWeight(office, enop, days) {
  if (!enop) return 0;
  const u = Math.min(enop, 8) / 8;
  const rec = 0.32 + 0.68 * Math.exp(-days / 55);
  let w = 0.78 * Math.sqrt(u) * rec;
  if (office === "governor") w = Math.pow(w, 0.85); // γG < 1
  return clamp(w, 0, 0.82);
}

// ── Stage III · expert ratings ───────────────────────────────────────────────
const OUTLETS = ["TPSI Ratings", "Capitol Index", "Meridian Board"];
const CAT_BOUNDS = [
  { cat: "Safe R",   lo: 15, hi: 999 },
  { cat: "Likely R", lo: 6.5, hi: 15 },
  { cat: "Lean R",   lo: 2.5, hi: 6.5 },
  { cat: "Toss-up",  lo: -2.5, hi: 2.5 },
  { cat: "Lean D",   lo: -6.5, hi: -2.5 },
  { cat: "Likely D", lo: -15, hi: -6.5 },
  { cat: "Safe D",   lo: -999, hi: -15 },
];
const catFor = (m) => CAT_BOUNDS.find((c) => m >= c.lo && m < c.hi) || CAT_BOUNDS[3];

function genRatings(r, mTrue) {
  const rng = rngFor("rate·" + r.id);
  return OUTLETS.map((o) => {
    const seen = mTrue + gauss(rng) * 2.2;
    return { outlet: o, ...catFor(seen) };
  });
}

function applyRatings(mFP, ratings, office, days) {
  const eta = 0.11 + 0.16 * (1 - days / 365); // rises toward election day
  const kappa = office === "governor" ? 1.45 : 1.0;
  let adj = 0;
  for (const rt of ratings) {
    const lo = rt.lo <= -900 ? -Infinity : rt.lo;
    const hi = rt.hi >= 900 ? Infinity : rt.hi;
    const proj = clamp(mFP, lo, hi);
    // normalized across outlets: the aggregate pull is η·κ, not outlets·η·κ,
    // so ratings stay a soft guardrail and can never overshoot the boundary
    adj += (eta / ratings.length) * kappa * (proj - mFP);
  }
  return mFP + adj;
}

// ── Stage IV–VI · markets ────────────────────────────────────────────────────
function genMarket(r, mTrue, days) {
  const rng = rngFor("mkt·" + r.id);
  const liquidity = clamp((r.marquee ? 0.75 : 0.3) + (20 - Math.abs(mTrue)) / 45 + rng() * 0.15, 0.05, 0.98);
  if (!r.marquee && Math.abs(mTrue) > 22 && rng() < 0.6) return null; // nobody prices landslides
  // Stage IV: synthesize the book. The market carries longshot bias (flattened
  // toward 0.5) — Stage V's q* correction is what un-flattens it.
  const sigmaNow = (7.5 + 0.55 * Math.pow(days, 0.62)) / 100;
  const fair = phi((mTrue / 200) / sigmaNow);
  const a = 1 / 1.06;
  const flat = Math.pow(fair, a) / (Math.pow(fair, a) + Math.pow(1 - fair, a));
  const mid = clamp(flat + gauss(rng) * 0.02 * (1.25 - liquidity), 0.01, 0.99);
  const lastTrade = clamp(mid + gauss(rng) * 0.035 * (1.15 - liquidity), 0.01, 0.99);
  const tradeAge = Math.floor(Math.pow(rng(), 2) * 21); // days since the last fill
  const activity = liquidity * (0.4 + rng() * 0.6);
  const twoSided = !(rng() < 0.25 * (1 - liquidity)); // thin books go one-sided
  // §IV discard rules: a one-sided book with stale/no trade evidence is unusable
  if (!twoSided && (tradeAge > 14 || activity < 0.06)) return null;
  // λ blend of last trade against the midpoint; stale trades defer to the book
  const lam = clamp((0.3 + 0.5 * liquidity) * Math.exp(-tradeAge / 10), 0.05, 0.85);
  const q = twoSided ? lam * lastTrade + (1 - lam) * mid : lastTrade;
  return { q: Math.round(clamp(q, 0.005, 0.995) * 1000) / 1000, liquidity: Math.round(liquidity * 100) / 100 };
}

function invPhi(p) {
  // Acklam's approximation
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pl = 0.02425;
  let q, x;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p <= 1 - pl) { q = p - 0.5; const r2 = q * q; x = (((((a[0] * r2 + a[1]) * r2 + a[2]) * r2 + a[3]) * r2 + a[4]) * r2 + a[5]) * q / (((((b[0] * r2 + b[1]) * r2 + b[2]) * r2 + b[3]) * r2 + b[4]) * r2 + 1); }
  else { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  return x;
}

function marketMargin(q, office, days) {
  if (q <= 0 || q >= 1) return null; // §V: degenerate contracts are removed, not clipped
  const qc = clamp(q, 0.005, 0.995);
  const d = 1.06; // §V favorite-longshot correction q*
  const qs = Math.pow(qc, d) / (Math.pow(qc, d) + Math.pow(1 - qc, d));
  const rOff = { house: 1.15, senate: 1.0, governor: 1.08 }[office];
  const sigma = (0.052 + 0.0042 * Math.pow(days, 0.55)) * rOff;
  const raw = 200 * sigma * invPhi(qs);
  return Math.sign(raw) * Math.pow(Math.abs(raw), 1.06); // mild stretch
}

function marketWeight(mFPE, wPoll, office) {
  const base = 0.1 + 0.3 * Math.exp(-Math.abs(mFPE) / 7);
  const g = wPoll <= 0 ? 1.7 : wPoll >= 0.45 ? 1 : 1.7 - 0.7 * (wPoll / 0.45);
  const h = { governor: 1.35, senate: 1.15, house: 1.0 }[office];
  return Math.min(0.34, base * g * h);
}

// ── marginal race uncertainty ────────────────────────────────────────────────
function raceSigma(office, days) {
  const base = 3.1 + 0.72 * Math.pow(days, 0.5); // ≈ 11 pts at 120 days out
  const off = { house: 1.0, senate: 0.94, governor: 1.12 }[office];
  return base * off;
}

// ── correlated simulation (§3.1–3.4: continuous-similarity covariance) ───────
// Feature-space similarity → office-pair-bounded pairwise correlations →
// eigenvalue-clipped PSD correlation matrix → Σ = DRD, with an explicit
// national factor carved out (λ = √c·σ, residual Cholesky), Y = µ + λZ₀ + LZ.

// §3.1 state covariates for the feature vectors
const STATE_URBAN = {
  AL: 0.57, AK: 0.64, AZ: 0.89, AR: 0.55, CA: 0.94, CO: 0.86, CT: 0.86, DE: 0.82,
  FL: 0.91, GA: 0.74, HI: 0.86, ID: 0.69, IL: 0.87, IN: 0.71, IA: 0.63, KS: 0.72,
  KY: 0.58, LA: 0.71, ME: 0.38, MD: 0.86, MA: 0.91, MI: 0.74, MN: 0.72, MS: 0.46,
  MO: 0.69, MT: 0.53, NE: 0.73, NV: 0.94, NH: 0.59, NJ: 0.94, NM: 0.74, NY: 0.87,
  NC: 0.67, ND: 0.61, OH: 0.76, OK: 0.65, OR: 0.80, PA: 0.76, RI: 0.91, SC: 0.67,
  SD: 0.57, TN: 0.66, TX: 0.83, UT: 0.90, VT: 0.35, VA: 0.75, WA: 0.83, WV: 0.44,
  WI: 0.67, WY: 0.62,
};
const STATE_COLLEGE = {
  AL: 0.27, AK: 0.30, AZ: 0.31, AR: 0.24, CA: 0.35, CO: 0.44, CT: 0.40, DE: 0.33,
  FL: 0.31, GA: 0.33, HI: 0.34, ID: 0.28, IL: 0.36, IN: 0.27, IA: 0.29, KS: 0.34,
  KY: 0.26, LA: 0.25, ME: 0.33, MD: 0.41, MA: 0.45, MI: 0.30, MN: 0.37, MS: 0.23,
  MO: 0.30, MT: 0.33, NE: 0.33, NV: 0.27, NH: 0.37, NJ: 0.41, NM: 0.28, NY: 0.38,
  NC: 0.33, ND: 0.30, OH: 0.29, OK: 0.26, OR: 0.35, PA: 0.33, RI: 0.35, SC: 0.30,
  SD: 0.30, TN: 0.29, TX: 0.31, UT: 0.36, VT: 0.40, VA: 0.40, WA: 0.37, WV: 0.21,
  WI: 0.31, WY: 0.28,
};
const STATE_LATLON = {
  AL: [32.8, -86.8], AK: [64.0, -153.0], AZ: [34.2, -111.6], AR: [34.8, -92.2],
  CA: [37.2, -119.3], CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [39.0, -75.5],
  FL: [28.6, -82.4], GA: [32.6, -83.4], HI: [20.8, -156.3], ID: [44.4, -114.6],
  IL: [40.0, -89.2], IN: [39.9, -86.3], IA: [42.1, -93.5], KS: [38.5, -98.4],
  KY: [37.5, -85.3], LA: [31.1, -91.9], ME: [45.4, -69.2], MD: [39.0, -76.8],
  MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.3, -94.3], MS: [32.7, -89.7],
  MO: [38.4, -92.5], MT: [47.0, -109.6], NE: [41.5, -99.8], NV: [39.3, -116.6],
  NH: [43.7, -71.6], NJ: [40.2, -74.7], NM: [34.4, -106.1], NY: [42.9, -75.5],
  NC: [35.5, -79.4], ND: [47.4, -100.5], OH: [40.4, -82.8], OK: [35.6, -97.5],
  OR: [43.9, -120.6], PA: [40.9, -77.8], RI: [41.7, -71.6], SC: [33.9, -80.9],
  SD: [44.4, -100.2], TN: [35.8, -86.3], TX: [31.5, -99.3], UT: [39.3, -111.7],
  VT: [44.0, -72.7], VA: [37.5, -78.9], WA: [47.4, -120.4], WV: [38.6, -80.6],
  WI: [44.6, -89.7], WY: [43.0, -107.6],
};

// §3.3 office-pair correlation floors/ceilings + same-state bonus
// Calibrated so the common (national) swing component of an ~11-pt race sigma
// is ~2.5–3.5 pts — the chamber seat bands land where real House models do
// (80% ≈ ±20–25 seats), instead of letting pairwise ρ masquerade as a
// national shock six times that size.
const RHO_BOUNDS = {
  "governor|governor": [0.02, 0.26], "senate|senate": [0.04, 0.34], "house|house": [0.03, 0.30],
  "governor|senate": [0.02, 0.24], "governor|house": [0.02, 0.20], "house|senate": [0.03, 0.26],
};
const SAME_STATE_B = {
  "governor|governor": 0.08, "senate|senate": 0.12, "house|house": 0.10,
  "governor|senate": 0.10, "governor|house": 0.08, "house|senate": 0.09,
};
const pairKey = (a, b) => (a <= b ? `${a}|${b}` : `${b}|${a}`);
const MU_S = 0.5, KAP_S = 0.18; // §3.2 similarity recentering (κ tuned so s* rarely clips)
const ETA_NAT = 0.55;           // national-factor share parameter (§3.4)

// §3.1–3.2: weighted z-scored features → distances → recentred similarity → ρ̃
function buildCorrelation(races) {
  const n = races.length;
  const FEATS = [
    { w: 1.6, f: (r) => r.pvi },                            // partisanship
    { w: 1.2, f: (r) => STATE_COLLEGE[r.st] ?? 0.31 },      // education
    { w: 1.0, f: (r) => STATE_URBAN[r.st] ?? 0.72 },        // urbanization
    { w: 0.8, f: (r) => ELASTICITY[r.st] ?? 1.0 },          // swinginess
    { w: 0.7, f: (r) => (STATE_LATLON[r.st] ?? [39, -95])[0] }, // geography
    { w: 0.7, f: (r) => (STATE_LATLON[r.st] ?? [39, -95])[1] },
  ];
  const k = FEATS.length;
  const Z = new Float64Array(n * k);
  FEATS.forEach((ft, c) => {
    const vals = races.map(ft.f);
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(vals.reduce((s2, v) => s2 + (v - mean) ** 2, 0) / n) || 1;
    const sw = Math.sqrt(ft.w);
    for (let i = 0; i < n; i++) Z[i * k + c] = ((vals[i] - mean) / sd) * sw;
  });

  const D = new Float64Array(n * n);
  let dMin = Infinity, dMax = -Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let acc = 0;
      for (let c = 0; c < k; c++) { const d = Z[i * k + c] - Z[j * k + c]; acc += d * d; }
      const d = Math.sqrt(acc);
      D[i * n + j] = d;
      if (d < dMin) dMin = d;
      if (d > dMax) dMax = d;
    }
  }
  const span = Math.max(1e-9, dMax - dMin);
  // recentre s_raw to mean/sd over the pair population
  let sSum = 0, s2Sum = 0, pairs = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const sr = 1 - (D[i * n + j] - dMin) / span;
    sSum += sr; s2Sum += sr * sr; pairs++;
  }
  const sBar = sSum / pairs;
  const sSd = Math.sqrt(Math.max(1e-9, s2Sum / pairs - sBar * sBar));

  const R = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    R[i * n + i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sRaw = 1 - (D[i * n + j] - dMin) / span;
      const sStar = clamp(MU_S + KAP_S * ((sRaw - sBar) / sSd), 0, 1);
      const key = pairKey(races[i].office, races[j].office);
      const [lo, hi] = RHO_BOUNDS[key];
      let rho = lo + (hi - lo) * sStar;
      if (races[i].st === races[j].st) rho += SAME_STATE_B[key];
      rho = clamp(rho, 0, 0.96);
      R[i * n + j] = R[j * n + i] = rho;
    }
  }
  psdClip(R, n); // §3.3 eigenvalue clip + diagonal renormalization
  return R;
}

// cyclic Jacobi eigendecomposition (symmetric); A is destroyed
function jacobiEigen(A, n, maxSweeps = 10) {
  const V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p2 = 0; p2 < n - 1; p2++) for (let q2 = p2 + 1; q2 < n; q2++) off += A[p2 * n + q2] ** 2;
    if (off < 1e-8) break;
    for (let p2 = 0; p2 < n - 1; p2++) {
      for (let q2 = p2 + 1; q2 < n; q2++) {
        const apq = A[p2 * n + q2];
        if (Math.abs(apq) < 1e-11) continue;
        const theta = (A[q2 * n + q2] - A[p2 * n + p2]) / (2 * apq);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const co = 1 / Math.sqrt(t * t + 1), si = t * co;
        for (let m2 = 0; m2 < n; m2++) {
          const amp = A[m2 * n + p2], amq = A[m2 * n + q2];
          A[m2 * n + p2] = co * amp - si * amq;
          A[m2 * n + q2] = si * amp + co * amq;
        }
        for (let m2 = 0; m2 < n; m2++) {
          const apm = A[p2 * n + m2], aqm = A[q2 * n + m2];
          A[p2 * n + m2] = co * apm - si * aqm;
          A[q2 * n + m2] = si * apm + co * aqm;
        }
        for (let m2 = 0; m2 < n; m2++) {
          const vmp = V[m2 * n + p2], vmq = V[m2 * n + q2];
          V[m2 * n + p2] = co * vmp - si * vmq;
          V[m2 * n + q2] = si * vmp + co * vmq;
        }
      }
    }
  }
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = A[i * n + i];
  return { V, d };
}

// clip negative eigenvalues, reconstruct, renormalize to unit diagonal (in place)
function psdClip(R, n) {
  const { V, d } = jacobiEigen(Float64Array.from(R), n);
  let minEig = Infinity;
  for (const v of d) if (v < minEig) minEig = v;
  if (minEig > 1e-6) return; // already PSD
  const floor = 1e-4;
  const B = new Float64Array(n * n);
  for (let e = 0; e < n; e++) {
    const le = Math.max(d[e], floor);
    for (let i = 0; i < n; i++) {
      const vie = V[i * n + e] * le;
      for (let j = i; j < n; j++) B[i * n + j] += vie * V[j * n + e];
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const v = B[i * n + j] / Math.sqrt(B[i * n + i] * B[j * n + j]);
      R[i * n + j] = R[j * n + i] = v;
    }
  }
  for (let i = 0; i < n; i++) R[i * n + i] = 1;
}

// Cholesky with escalating ridge (numerical safety net)
function cholesky(Ain, n) {
  for (let ridge = 0; ridge <= 6; ridge++) {
    const A = Float64Array.from(Ain);
    if (ridge > 0) {
      let avg = 0;
      for (let i = 0; i < n; i++) avg += A[i * n + i] / n;
      const eps = avg * Math.pow(10, ridge - 9);
      for (let i = 0; i < n; i++) A[i * n + i] += eps;
    }
    const L = new Float64Array(n * n);
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = A[i * n + j];
        for (let e = 0; e < j; e++) sum -= L[i * n + e] * L[j * n + e];
        if (i === j) {
          if (sum <= 0) { ok = false; break; }
          L[i * n + i] = Math.sqrt(sum);
        } else {
          L[i * n + j] = sum / L[j * n + j];
        }
      }
    }
    if (ok) return L;
  }
  throw new Error("cholesky failed after ridge escalation");
}

function cholSolveVec(L, b, n) {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = b[i];
    for (let j = 0; j < i; j++) sum -= L[i * n + j] * y[j];
    y[i] = sum / L[i * n + i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let j = i + 1; j < n; j++) sum -= L[j * n + i] * x[j];
    x[i] = sum / L[i * n + i];
  }
  return x;
}

// §3.4: Σ = DRD; carve out the national factor (c = η/(σᵀΣ⁻¹σ), λ = √c·σ),
// residual gets the Cholesky. Shared by both model variants (Σ is fixed).
function decompose(races) {
  const n = races.length;
  const R = buildCorrelation(races);
  const sig = Float64Array.from(races, (r) => r.sigma);
  const Sig = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Sig[i * n + j] = R[i * n + j] * sig[i] * sig[j];
  const Lfull = cholesky(Sig, n);
  const x = cholSolveVec(Lfull, sig, n);
  let quad = 0;
  for (let i = 0; i < n; i++) quad += sig[i] * x[i];
  const c = ETA_NAT / quad; // Schur-safe: c < 1/(σᵀΣ⁻¹σ) keeps the residual PSD
  const lam = Float64Array.from(sig, (v) => Math.sqrt(c) * v);
  const Res = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Res[i * n + j] = Sig[i * n + j] - c * sig[i] * sig[j];
  const L = cholesky(Res, n);
  return { lam, L, R };
}

const M = 40000;
const DIST_LO = -40, DIST_BINS = 81; // per-race outcome histogram, 1-pt bins
function simulate(races, means, tag, dec) {
  const rng = rngFor("sim·" + tag);
  const n = races.length;
  const { lam, L } = dec;
  const wins = new Float64Array(n);
  const seatHists = { governor: new Map(), senate: new Map(), house: new Map() };
  const qSamples = races.map(() => []);
  const dists = races.map(() => new Int32Array(DIST_BINS));
  const offIdx = races.map((r) => r.office);
  const z = new Float64Array(n);

  for (let s = 0; s < M; s++) {
    const z0 = gauss(rng);
    for (let j = 0; j < n; j++) z[j] = gauss(rng);
    let gR = 0, sR = 0, hR = 0;
    for (let i = 0; i < n; i++) {
      let acc = means[i] + lam[i] * z0;
      const row = i * n;
      for (let j = 0; j <= i; j++) acc += L[row + j] * z[j];
      if (acc > 0) {
        wins[i]++;
        const o = offIdx[i];
        if (o === "house") hR++; else if (o === "senate") sR++; else gR++;
      }
      dists[i][clamp(Math.round(acc) - DIST_LO, 0, DIST_BINS - 1)]++;
      if ((s & 7) === 0) qSamples[i].push(acc);
    }
    seatHists.governor.set(gR, (seatHists.governor.get(gR) || 0) + 1);
    seatHists.senate.set(sR, (seatHists.senate.get(sR) || 0) + 1);
    seatHists.house.set(hR, (seatHists.house.get(hR) || 0) + 1);
  }

  const probs = Array.from(wins, (w) => w / M);
  const quantiles = qSamples.map((arr) => {
    arr.sort((a, b) => a - b);
    const at = (p2) => arr[Math.floor(p2 * (arr.length - 1))];
    return { p10: Math.round(at(0.1) * 10) / 10, p90: Math.round(at(0.9) * 10) / 10 };
  });
  return { probs, seatHists, quantiles, dists };
}

// §3.6 companion table: the ten largest correlation entries per race
function topCorrelated(races, R, k = 10) {
  const n = races.length;
  return races.map((_, i) => {
    const cands = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      cands.push({ id: races[j].id, corr: R[i * n + j] });
    }
    cands.sort((a, b) => b.corr - a.corr);
    return cands.slice(0, k).map((c) => ({ id: c.id, corr: Math.round(c.corr * 1000) / 1000 }));
  });
}

// ── build ────────────────────────────────────────────────────────────────────
console.time("model");
const U = buildUniverse();
const races = U.all;

for (const r of races) {
  r.mF = fundamentals(r);
  r.mTrue = latentTruth(r, r.mF);
  r.polls = genPolls(r, r.mTrue);
  const { avg, enop } = averagePolls(r.polls);
  r.pollAvg = avg;
  r.enop = enop;
  const w = pollWeight(r.office, enop, DAYS_OUT);
  r.wPoll = Math.round(w * 1000) / 1000;
  r.mFP = avg == null ? r.mF : (1 - w) * r.mF + w * avg;                       // Legacy
  r.ratings = genRatings(r, r.mTrue);
  r.mFPE = applyRatings(r.mFP, r.ratings, r.office, DAYS_OUT);
  r.market = genMarket(r, r.mTrue, DAYS_OUT);
  const mkM = r.market ? marketMargin(r.market.q, r.office, DAYS_OUT) : null;
  if (mkM != null) {
    const wk = marketWeight(r.mFPE, w, r.office); // §VI: liquidity already shaped q in Stage IV
    r.mPE = (1 - wk) * r.mFPE + wk * mkM;                                       // Complete
    r.wMkt = Math.round(wk * 1000) / 1000;
    r.mktMargin = Math.round(mkM * 10) / 10;
  } else {
    r.market = null;
    r.mPE = r.mFPE;
    r.wMkt = 0;
  }
  r.sigma = raceSigma(r.office, DAYS_OUT);
}

const meansLegacy = races.map((r) => r.mFP);
const meansComplete = races.map((r) => r.mPE);
console.time("covariance");
const dec = decompose(races);
console.timeEnd("covariance");
console.time("sims");
const simL = simulate(races, meansLegacy, "legacy", dec);
const simC = simulate(races, meansComplete, "complete", dec);
console.timeEnd("sims");
const similar = topCorrelated(races, dec.R);

// ── chamber summaries ────────────────────────────────────────────────────────
const SEN_R_NOT_UP = 31; // 53 R − 22 R seats on the ballot
function chamberSummary(sim, office) {
  const hist = sim.seatHists[office];
  const totalSeats = office === "house" ? 435 : office === "senate" ? 35 : 36;
  const rows = [...hist.entries()].sort((a, b) => a[0] - b[0]);
  let rWin = 0, expR = 0;
  const outHist = [];
  for (const [seatsR, count] of rows) {
    const p = count / M;
    expR += seatsR * p;
    let rControls;
    if (office === "senate") rControls = SEN_R_NOT_UP + seatsR >= 50; // R VP breaks ties
    else if (office === "house") rControls = seatsR >= 218;
    else rControls = seatsR >= 18;
    if (rControls) rWin += p;
    outHist.push([office === "senate" ? SEN_R_NOT_UP + seatsR : seatsR, Math.round(p * 1e5) / 1e5]);
  }
  // 10th/90th percentile seat outcomes (R scale) for the band
  let cum = 0, p10R = rows.length ? rows[0][0] : 0, p90R = rows.length ? rows[rows.length - 1][0] : 0;
  let got10 = false, got90 = false;
  for (const [seatsR, count] of rows) {
    cum += count / M;
    if (!got10 && cum >= 0.1) { p10R = seatsR; got10 = true; }
    if (!got90 && cum >= 0.9) { p90R = seatsR; got90 = true; }
  }
  const expRTotal = office === "senate" ? SEN_R_NOT_UP + expR : expR;
  const expDTotal = (office === "senate" ? 100 : totalSeats + (office === "house" ? 0 : 0)) - expRTotal;
  return {
    office,
    seatsTotal: office === "senate" ? 100 : totalSeats,
    gopControl: Math.round(rWin * 1000) / 1000,
    demControl: Math.round((1 - rWin) * 1000) / 1000,
    gopSeats: Math.round(expRTotal * 10) / 10,
    demSeats: Math.round(expDTotal * 10) / 10,
    hist: outHist,
    demP10: (office === "senate" ? 100 : totalSeats) - (office === "senate" ? SEN_R_NOT_UP + p90R : p90R),
    demP90: (office === "senate" ? 100 : totalSeats) - (office === "senate" ? SEN_R_NOT_UP + p10R : p10R),
  };
}

// ── trends (deterministic backward walk, 62 days) ───────────────────────────
function chamberTrend(summary, office, model) {
  const rng = rngFor(`trend·${office}·${model}`);
  const days = 62;
  const pts = [];
  let d = summary.demControl;
  let sD = summary.demSeats;
  const anchorD = clamp(d + (model === "legacy" ? 0.03 : 0), 0.03, 0.97);
  for (let i = 0; i < days; i++) {
    pts.push({ t: i, dem: Math.round(d * 1000) / 1000, demSeats: Math.round(sD * 10) / 10 });
    // walking backward: mean-revert toward a slightly different past
    d = clamp(d + gauss(rng) * 0.012 + (anchorD + 0.05 - d) * 0.03, 0.02, 0.98);
    sD = sD + gauss(rng) * 0.9 + (summary.demSeats + 2.5 - sD) * 0.03;
  }
  pts.reverse();
  pts.forEach((p, i) => (p.t = i));
  return pts;
}

function raceTrend(r, model) {
  const rng = rngFor(`rt·${r.id}·${model}`);
  const end = model === "legacy" ? r.mFP : r.mPE;
  const pts = [];
  let m = end;
  for (let i = 0; i < 31; i++) {
    const sigmaAt = raceSigma(r.office, DAYS_OUT + i * 2);
    const p = 1 - phi(-m / sigmaAt);
    pts.push({ m: Math.round(m * 10) / 10, p: Math.round(p * 1000) / 1000 });
    m = m + gauss(rng) * 0.55 + (r.mF - m) * 0.02;
  }
  pts.reverse();
  return pts;
}

const chambers = {};
for (const office of ["governor", "senate", "house"]) {
  chambers[office] = {
    legacy: chamberSummary(simL, office),
    complete: chamberSummary(simC, office),
  };
  chambers[office].legacy.trend = chamberTrend(chambers[office].legacy, office, "legacy");
  chambers[office].complete.trend = chamberTrend(chambers[office].complete, office, "complete");
}

// ── county projections from registration data ───────────────────────────────
function loadCountyLeans() {
  const partyRows = readFileSync("data/voter-registration/party_long.csv", "utf8").split("\n").slice(1);
  const totalRows = readFileSync("data/voter-registration/counties_all.csv", "utf8").split("\n").slice(1);
  const reg = new Map(); // "ST-NAME" → {d, r, o, total}
  for (const line of partyRows) {
    const c = line.split(",");
    if (c.length < 5) continue;
    const key = `${c[0]}-${c[1].toUpperCase().replace(/ /g, "_")}`;
    if (!reg.has(key)) reg.set(key, { d: 0, r: 0, o: 0 });
    const e = reg.get(key);
    const n = +c[4] || 0;
    if (c[3] === "Democratic") e.d += n;
    else if (c[3] === "Republican") e.r += n;
    else e.o += n;
  }
  const totals = new Map();
  for (const line of totalRows) {
    const c = line.split(",");
    if (c.length < 6 || c[2] !== "county") continue;
    totals.set(`${c[0]}-${c[3].toUpperCase().replace(/ /g, "_")}`, +c[5] || 0);
  }
  return { reg, totals };
}

const REG_SLOPE = {
  KY: -0.25, WV: -0.35, OK: 0.2, LA: 0.45,
  FL: 1.2, PA: 1.25, NC: 1.1, NV: 1.25, AZ: 1.3,
};

function buildCounties() {
  const { reg, totals } = loadCountyLeans();
  const geo = JSON.parse(readFileSync("public/geo/us-counties.geojson", "utf8"));
  const byState = new Map();
  for (const f of geo.features) {
    const id = String(f.properties?.county_id || "");
    if (!id || id.startsWith("AK-") || id.startsWith("HI-")) continue;
    const st = id.slice(0, 2);
    if (!byState.has(st)) byState.set(st, []);
    byState.get(st).push(id);
  }

  // county partisan lean relative to its state, on the margin scale
  const stateLean = new Map();
  const regStates = new Set();
  for (const [st, ids] of byState) {
    let leans = [], weights = [], regHits = 0;
    for (const id of ids) {
      const e = reg.get(id);
      const t = totals.get(id) ?? (e ? e.d + e.r + e.o : 0);
      let lean;
      if (e && e.d + e.r > 200) {
        regHits++;
        lean = (100 * (e.r - e.d)) / (e.d + e.r + 0.6 * e.o);
        // registration→vote slope, calibrated per state: ancestral-registration
        // states (KY/WV/OK/LA) have county D-registration that no longer tracks
        // the D vote — small or inverted slopes; modern-alignment states amplify
        lean *= REG_SLOPE[st] ?? 1.35;
      } else {
        // structural prior: bigger electorates lean bluer
        const h = djb2("lean·" + id);
        const size = Math.max(t, 800);
        lean = 26 - 13 * Math.log10(size) + ((h % 1000) / 1000 - 0.5) * 18;
      }
      leans.push(clamp(lean, -78, 88));
      weights.push(Math.max(t, 500));
    }
    const wSum = weights.reduce((a, b) => a + b, 0);
    const mean = leans.reduce((s, l, i) => s + l * weights[i], 0) / wSum;
    stateLean.set(st, { ids, leans, weights, mean });
    if (regHits >= ids.length * 0.5) regStates.add(st);
  }

  const out = { _reg: [] };
  for (const r of races) {
    if (r.office === "house") continue;
    const sl = stateLean.get(r.st);
    if (!sl) continue;
    const rng = rngFor("cty·" + r.id);
    const rows = {};
    sl.ids.forEach((id, i) => {
      const rel = sl.leans[i] - sl.mean;
      const beta = 0.92; // county swing coupling
      rows[id] = Math.round((r.mPE + beta * rel + gauss(rng) * 1.6) * 10) / 10;
    });
    out[r.id] = rows;
  }
  out._reg = [...regStates].sort();
  return out;
}
const counties = buildCounties();

// ── House hex cartogram + state geometry for the national map ────────────────
const eachRing = (geom, cb) => {
  if (geom.type === "Polygon") geom.coordinates.forEach(cb);
  else if (geom.type === "MultiPolygon") geom.coordinates.forEach((p) => p.forEach(cb));
};
function makeProjector(features, W, H, pad = 6) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of features) eachRing(f.geometry, (ring) => { for (const [x, y] of ring) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } });
  const midLat = (minY + maxY) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180) || 1;
  const gw = (maxX - minX) * kx || 1, gh = maxY - minY || 1;
  const s = Math.min((W - pad * 2) / gw, (H - pad * 2) / gh);
  const ox = (W - gw * s) / 2, oy = (H - gh * s) / 2;
  return (lon, lat) => [ox + (lon - minX) * kx * s, oy + (maxY - lat) * s];
}
const geomToPath = (geom, project, step = 1) => {
  let d = "";
  eachRing(geom, (ring) => {
    if (!ring.length) return;
    for (let i = 0; i < ring.length; i += step) {
      const [px, py] = project(ring[i][0], ring[i][1]);
      d += (i ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(1);
    }
    d += "Z";
  });
  return d;
};

function buildGeo() {
  const geo = JSON.parse(readFileSync("public/geo/us-counties.geojson", "utf8"));
  const feats = geo.features.filter((f) => {
    const id = String(f.properties?.county_id || "");
    return id && !id.startsWith("AK-") && !id.startsWith("HI-");
  });
  const project = makeProjector(feats, 980, 610, 12);

  // true state silhouettes (Census 20m) — concatenated county rings would
  // stroke every internal county line on the national map
  const stateGeo = JSON.parse(readFileSync("scripts/forecast/raw/state-20m.json", "utf8"));
  const paths = {};
  for (const f of stateGeo.features) {
    const st = f.properties.STUSPS;
    if (!st || st === "AK" || st === "HI" || st === "PR" || st === "DC") continue;
    paths[st] = geomToPath(f.geometry, project, 1);
  }

  // per-state boxes in the national frame (from the county features)
  const box = {};
  for (const f of feats) {
    const st = String(f.properties.county_id).slice(0, 2);
    if (!box[st]) box[st] = [Infinity, Infinity, -Infinity, -Infinity];
    eachRing(f.geometry, (ring) => {
      for (let i = 0; i < ring.length; i += 6) {
        const [px, py] = project(ring[i][0], ring[i][1]);
        const b = box[st];
        if (px < b[0]) b[0] = px; if (py < b[1]) b[1] = py;
        if (px > b[2]) b[2] = px; if (py > b[3]) b[3] = py;
      }
    });
  }
  for (const st of Object.keys(box)) box[st] = box[st].map((v) => Math.round(v * 10) / 10);

  // real 118th-Congress districts (Census 20m), projected in the SAME frame
  const FIPS_TO_ST = Object.fromEntries(
    Object.entries({
      AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10",
      FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20",
      KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28",
      MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36",
      NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45",
      SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
      WI: "55", WY: "56",
    }).map(([st, f]) => [f, st])
  );
  const cd = JSON.parse(readFileSync("scripts/forecast/raw/cd118-20m.json", "utf8"));
  const districts = {};
  const cdByState = new Map(); // for per-state detail files
  for (const f of cd.features) {
    const st = FIPS_TO_ST[f.properties.STATEFP];
    if (!st || st === "AK" || st === "HI") {
      if (st) { // AK/HI keep data entries; the desk's maps omit them by convention
        const fp = f.properties.CD118FP;
        const num = fp === "00" ? 1 : parseInt(fp, 10) || 1;
        districts[`${st}-${String(num).padStart(2, "0")}`] = { d: null, box: null };
      }
      continue;
    }
    const cdfp = f.properties.CD118FP;
    if (cdfp === "98" || cdfp === "99" || cdfp === "ZZ") continue; // non-voting
    const num = cdfp === "00" ? 1 : parseInt(cdfp, 10);
    if (!Number.isFinite(num) || num < 1) continue;
    const id = `${st}-${String(num).padStart(2, "0")}`;
    districts[id] = { d: geomToPath(f.geometry, project, 1) };
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    eachRing(f.geometry, (ring) => {
      for (let i = 0; i < ring.length; i += 2) {
        const [px, py] = project(ring[i][0], ring[i][1]);
        if (px < b[0]) b[0] = px; if (py < b[1]) b[1] = py;
        if (px > b[2]) b[2] = px; if (py > b[3]) b[3] = py;
      }
    });
    districts[id].box = b.map((v) => Math.round(v * 10) / 10);
    if (!cdByState.has(st)) cdByState.set(st, []);
    cdByState.get(st).push({ id, feature: f });
  }

  // per-state detail files: counties + districts in the state's own frame
  mkdirSync(`${OUT}/states`, { recursive: true });
  const byStateFeats = new Map();
  for (const f of feats) {
    const st = String(f.properties.county_id).slice(0, 2);
    if (!byStateFeats.has(st)) byStateFeats.set(st, []);
    byStateFeats.get(st).push(f);
  }
  for (const [st, sf] of byStateFeats) {
    const proj = makeProjector(sf, 900, 620, 26);
    const counties = sf.map((f) => ({
      id: String(f.properties.county_id),
      d: geomToPath(f.geometry, proj, 1),
    }));
    const dists = (cdByState.get(st) || []).map(({ id, feature }) => ({
      id,
      d: geomToPath(feature.geometry, proj, 1),
    }));
    writeFileSync(`${OUT}/states/${st}.json`, JSON.stringify({ st, counties, districts: dists }));
  }

  // ── hex layouts ─────────────────────────────────────────────────────────
  // state centroids in the national frame (anchor the House cluster layout)
  const cent = {};
  for (const f of feats) {
    const st = String(f.properties.county_id).slice(0, 2);
    if (!cent[st]) cent[st] = { x: 0, y: 0, n: 0 };
    eachRing(f.geometry, (ring) => {
      for (let i = 0; i < ring.length; i += 12) {
        const [px, py] = project(ring[i][0], ring[i][1]);
        cent[st].x += px; cent[st].y += py; cent[st].n++;
      }
    });
  }
  const centroids = {};
  for (const st of Object.keys(cent)) centroids[st] = [cent[st].x / cent[st].n, cent[st].y / cent[st].n];
  centroids.AK = [80, 520]; centroids.HI = [210, 555];

  // House: district hexes clustered on state centroids, relaxed to avoid overlap
  const R = 9.4;
  const dirs = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const axialToXY = (q, rr) => [R * Math.sqrt(3) * (q + rr / 2), R * 1.5 * rr];
  const spiral = (n) => {
    const cells = [[0, 0]];
    let ring = 1;
    while (cells.length < n) {
      let q = ring, rr = 0;
      for (let side = 0; side < 6 && cells.length < n; side++) {
        for (let k = 0; k < ring && cells.length < n; k++) {
          cells.push([q, rr]);
          q += dirs[(side + 2) % 6][0];
          rr += dirs[(side + 2) % 6][1];
        }
      }
      ring++;
    }
    return cells;
  };
  const clusters = [];
  for (const r of races) {
    if (r.office !== "house") continue;
    let c = clusters.find((x) => x.st === r.st);
    if (!c) { c = { st: r.st, list: [] }; clusters.push(c); }
    c.list.push(r);
  }
  for (const c of clusters) {
    c.list.sort((a, b) => a.district - b.district);
    const [cx, cy] = centroids[c.st] || [490, 300];
    c.x = cx; c.y = cy;
    c.cells = spiral(c.list.length).map(([q, rr]) => axialToXY(q, rr));
    c.rad = Math.max(...c.cells.map(([x, y]) => Math.hypot(x, y))) + R;
  }
  for (let iter = 0; iter < 260; iter++) {
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i], b = clusters[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const need = a.rad + b.rad + 5;
        if (dist < need) {
          const push = (need - dist) / 2;
          const ux = dx / dist, uy = dy / dist;
          a.x -= ux * push * 0.55; a.y -= uy * push * 0.55;
          b.x += ux * push * 0.55; b.y += uy * push * 0.55;
        }
      }
    }
    for (const c of clusters) {
      c.x = clamp(c.x, c.rad + 8, 980 - c.rad - 8);
      c.y = clamp(c.y, c.rad + 8, 610 - c.rad - 8);
    }
  }
  const hexHouse = {};
  for (const c of clusters) {
    c.list.forEach((r, i) => {
      hexHouse[r.id] = [Math.round((c.x + c.cells[i][0]) * 10) / 10, Math.round((c.y + c.cells[i][1]) * 10) / 10];
    });
  }

  // Governors/Senate: the classic state tile grid (one hex per state)
  const STATE_TILES = {
    AK: [0, 0], ME: [11, 0],
    VT: [10, 1], NH: [11, 1],
    WA: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], WI: [5, 2], MI: [7, 2], NY: [9, 2], MA: [10, 2], RI: [11, 2],
    OR: [1, 3], ID: [2, 3], SD: [3, 3], IA: [4, 3], IL: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3],
    CA: [1, 4], NV: [2, 4], WY: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
    AZ: [2, 5], UT: [3, 5], CO: [4, 5], KS: [5, 5], AR: [6, 5], TN: [7, 5], NC: [8, 5], SC: [9, 5],
    NM: [3, 6], OK: [5, 6], LA: [6, 6], MS: [7, 6], AL: [8, 6], GA: [9, 6],
    HI: [1, 7], TX: [4, 7], FL: [9, 7],
  };
  const hexStates = {};
  const HR = 44;
  for (const [st, [col, row]] of Object.entries(STATE_TILES)) {
    const x = 130 + col * HR * 1.55 + (row % 2 ? HR * 0.78 : 0);
    const y = 60 + row * HR * 1.38;
    hexStates[st] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  return {
    frame: [980, 610],
    states: paths, box, districts,
    hexHouse, hexHouseR: R,
    hexStates, hexStatesR: HR / 1.16,
  };
}
const geoOut = buildGeo();

// ── emit ─────────────────────────────────────────────────────────────────────
const iL = new Map(races.map((r, i) => [r.id, i]));
const raceOut = races.map((r) => {
  const i = iL.get(r.id);
  return {
    id: r.id,
    office: r.office,
    st: r.st,
    state: STATE_NAMES[r.st],
    district: r.district,
    name: r.office === "house"
      ? `${STATE_NAMES[r.st]} ${ordinal(r.district)} District`
      : `${STATE_NAMES[r.st]} ${r.office === "senate" ? "Senate" : "Governor"}${r.special ? " (special)" : ""}`,
    dem: r.dem,
    gop: r.gop,
    inc: r.inc,
    open: r.open,
    marquee: r.marquee,
    pvi: Math.round(r.pvi * 10) / 10,
    elast: ELASTICITY[r.st] ?? 1,
    fundamentals: Math.round(r.mF * 10) / 10,
    stages: {
      anchor: Math.round(r.pvi * 10) / 10,
      fund: Math.round(r.mF * 10) / 10,
      poll: Math.round(r.mFP * 10) / 10,
      rate: Math.round(r.mFPE * 10) / 10,
      market: Math.round(r.mPE * 10) / 10,
    },
    pollAvg: r.pollAvg,
    enop: r.enop,
    wPoll: r.wPoll,
    wMkt: r.wMkt,
    market: r.market,
    ratings: r.ratings.map((x) => ({ outlet: x.outlet, cat: x.cat })),
    legacy: {
      margin: Math.round(r.mFP * 10) / 10,
      prob: Math.round(simL.probs[i] * 1000) / 1000,
      p10: simL.quantiles[i].p10,
      p90: simL.quantiles[i].p90,
      dist: { lo: DIST_LO, w: 1, c: Array.from(simL.dists[i]) },
    },
    complete: {
      margin: Math.round(r.mPE * 10) / 10,
      prob: Math.round(simC.probs[i] * 1000) / 1000,
      p10: simC.quantiles[i].p10,
      p90: simC.quantiles[i].p90,
      dist: { lo: DIST_LO, w: 1, c: Array.from(simC.dists[i]) },
    },
    polls: r.polls.slice(0, 8).map((p) => ({ pollster: p.pollster, kind: p.kind, age: p.age, n: p.size, margin: p.margin, grade: gradeFor(p.q) })),
    similar: similar[i],
    trend: { legacy: raceTrend(r, "legacy"), complete: raceTrend(r, "complete") },
  };
});

function gradeFor(q) {
  return q >= 0.98 ? "A+" : q >= 0.9 ? "A" : q >= 0.84 ? "A\u2212" : q >= 0.8 ? "B+" : q >= 0.74 ? "B" : q >= 0.68 ? "B\u2212" : "C";
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const model = {
  meta: {
    updated: TODAY,
    election: ELECTION,
    daysOut: DAYS_OUT,
    npe: NPE_2026,
    genericBallot: GB,
    sims: M,
    senNotUpR: SEN_R_NOT_UP,
    senNotUpD: 100 - SEN_R_NOT_UP - 35,
  },
  chambers,
  races: raceOut,
};

writeFileSync(`${OUT}/model.json`, JSON.stringify(model));
writeFileSync(`${OUT}/counties.json`, JSON.stringify(counties));
writeFileSync(`${OUT}/geo.json`, JSON.stringify(geoOut));
try { rmSync(`${OUT}/hex.json`); } catch {}
try { rmSync(`${OUT}/states-geo.json`); } catch {}
console.timeEnd("model");

// report
console.log("NPE", NPE_2026, "| generic ballot avg", GB.avg, "| prior", GB.prior);
for (const office of ["house", "senate", "governor"]) {
  const c = chambers[office].complete;
  console.log(office.padEnd(9), "D control", (c.demControl * 100).toFixed(1) + "%", "| seats D", c.demSeats, "R", c.gopSeats);
}
const close = raceOut.filter((r) => Math.abs(r.complete.margin) < 3).length;
console.log("races", raceOut.length, "| within ±3:", close, "| county overlays:", Object.keys(counties).length - 1, "| districts:", Object.keys(geoOut.districts).length);
const sizes = ["model.json", "counties.json", "geo.json"].map((f) => `${f} ${(readFileSync(`${OUT}/${f}`).length / 1e6).toFixed(2)}MB`);
console.log(sizes.join(" · "));
