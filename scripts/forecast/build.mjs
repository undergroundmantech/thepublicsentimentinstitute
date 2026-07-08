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
//   Sims       national + region + state + office + idiosyncratic factor
//              model (guaranteed-PSD structured covariance), M = 10,000
//   Output     race table, chamber histograms/control odds, 60-day trends,
//              county-level projections from real registration data.
//
// Deterministic: a seeded PRNG drives every stochastic step.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { buildUniverse, STATE_NAMES, REGION, ELASTICITY, PRES_2024 } from "./universe.mjs";

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
// down-ballot races absorb less of the national swing than the presidential
// anchor implies (incumbency, localization) — office-specific transmission
const ENV_TRANSMIT = { house: 0.72, senate: 0.85, governor: 0.62 };
function fundamentals(r) {
  const ex = (ELASTICITY[r.st] ?? 1.0) * (Math.abs(r.pvi) < 8 ? 1.04 : 1.0); // competitive races run hotter
  const envShift = (NPE_2024 - NPE_2026) * ex * ENV_TRANSMIT[r.office];       // shift from '24 anchor to '26
  let m = r.pvi - envShift;
  m += r.inc * INC_BONUS[r.office];
  if (r.open) m += (m > 0 ? -0.7 : 0.7); // open seats drift toward the center
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
    adj += eta * kappa * (proj - mFP);
  }
  return mFP + adj;
}

// ── Stage IV–VI · markets ────────────────────────────────────────────────────
function genMarket(r, mTrue, days) {
  const rng = rngFor("mkt·" + r.id);
  const liquidity = clamp((r.marquee ? 0.75 : 0.3) + (20 - Math.abs(mTrue)) / 45 + rng() * 0.15, 0.05, 0.98);
  if (!r.marquee && Math.abs(mTrue) > 22 && rng() < 0.6) return null; // no usable book
  const sigmaNow = (7.5 + 0.55 * Math.pow(days, 0.62)) / 100;
  const qRaw = phi((mTrue / 200 + gauss(rng) * 0.012) / sigmaNow);
  const alpha = 1.06; // favorite-longshot sharpening
  const q = Math.pow(qRaw, alpha) / (Math.pow(qRaw, alpha) + Math.pow(1 - qRaw, alpha));
  return { q: clamp(q, 0.015, 0.985), liquidity: Math.round(liquidity * 100) / 100 };
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
  const rOff = { house: 1.15, senate: 1.0, governor: 1.08 }[office];
  const sigma = (0.052 + 0.0042 * Math.pow(days, 0.55)) * rOff;
  const raw = 200 * sigma * invPhi(q);
  return Math.sign(raw) * Math.pow(Math.abs(raw), 1.06); // mild stretch
}

function marketWeight(mFPE, wPoll, office) {
  const base = 0.1 + 0.3 * Math.exp(-Math.abs(mFPE) / 7);
  const g = wPoll <= 0 ? 1.7 : wPoll >= 0.45 ? 1 : 1.7 - 0.7 * (wPoll / 0.45);
  const h = { governor: 1.35, senate: 1.15, house: 1.0 }[office];
  return Math.min(0.34, base * g * h);
}

// ── marginal race uncertainty ────────────────────────────────────────────────
function raceSigma(office, days, enop) {
  const base = 3.1 + 0.72 * Math.pow(days, 0.5); // ≈ 11 pts at 120 days out
  const off = { house: 1.0, senate: 0.94, governor: 1.12 }[office];
  const info = 1 - 0.14 * Math.min(1, enop / 6); // polling trims uncertainty a bit
  return base * off * info;
}

// ── correlated simulation (factor model — PSD by construction) ───────────────
// var shares: national·elasticity, region, state, office, idiosyncratic
function loadings(r, sigma) {
  let ex = ELASTICITY[r.st] ?? 1.0;
  // district elasticity: landslide districts swing harder in margin than
  // knife-edge ones, so each district gets its own responsiveness
  if (r.office === "house") ex *= 0.88 + 0.24 * Math.min(Math.abs(r.pvi ?? 0), 25) / 25;
  // office transmission of the national shock: house rides the generic ballot,
  // governors are partly insulated (candidate-quality dominated)
  const offNat = r.office === "house" ? 1.18 : r.office === "senate" ? 1.0 : 0.62;
  const vNat = 0.42 * ex * ex * offNat, vReg = 0.1, vState = 0.2, vOff = 0.05;
  const tot = vNat + vReg + vState + vOff;
  // well-polled races carry more race-specific information, so a larger share
  // of their remaining uncertainty is idiosyncratic
  const vIdio = Math.max(0.12, 1 - tot) + 0.35 * (r.wPoll || 0);
  const norm = sigma / Math.sqrt(vNat + vReg + vState + vOff + vIdio);
  return {
    nat: Math.sqrt(vNat) * norm,
    reg: Math.sqrt(vReg) * norm,
    state: Math.sqrt(vState) * norm,
    off: Math.sqrt(vOff) * norm,
    idio: Math.sqrt(vIdio) * norm,
  };
}

const M = 10000;
function simulate(races, means, tag) {
  const rng = rngFor("sim·" + tag);
  const regions = ["NE", "MW", "SO", "WE"];
  const states = [...new Set(races.map((r) => r.st))];
  const offices = ["governor", "senate", "house"];
  const L = races.map((r, i) => loadings(r, races[i].sigma));

  const wins = new Float64Array(races.length);
  const seatHists = { governor: new Map(), senate: new Map(), house: new Map() };
  const margins = races.map(() => new Float64Array(7)); // for quantiles: reservoir? store sums
  // store per-race sorted sample subset for quantiles (every 8th sim)
  const qSamples = races.map(() => []);

  for (let s = 0; s < M; s++) {
    const z0 = gauss(rng);
    const zr = Object.fromEntries(regions.map((g) => [g, gauss(rng)]));
    const zs = Object.fromEntries(states.map((g) => [g, gauss(rng)]));
    const zo = Object.fromEntries(offices.map((g) => [g, gauss(rng)]));
    let seatsR = { governor: 0, senate: 0, house: 0 };
    for (let i = 0; i < races.length; i++) {
      const r = races[i], l = L[i];
      const m = means[i] + l.nat * z0 + l.reg * zr[REGION[r.st]] + l.state * zs[r.st] + l.off * zo[r.office] + l.idio * gauss(rng);
      if (m > 0) { wins[i]++; seatsR[r.office]++; }
      if (s % 8 === 0) qSamples[i].push(m);
    }
    for (const o of offices) {
      const k = seatsR[o];
      seatHists[o].set(k, (seatHists[o].get(k) || 0) + 1);
    }
  }

  const probs = Array.from(wins, (w) => w / M);
  const quantiles = qSamples.map((arr) => {
    arr.sort((a, b) => a - b);
    const at = (p) => arr[Math.floor(p * (arr.length - 1))];
    return { p10: Math.round(at(0.1) * 10) / 10, p90: Math.round(at(0.9) * 10) / 10 };
  });
  return { probs, seatHists, quantiles, L };
}

// analytic pairwise correlation from loadings → top-k similar races
function topCorrelated(races, L, k = 8) {
  const out = races.map(() => []);
  for (let i = 0; i < races.length; i++) {
    const cands = [];
    for (let j = 0; j < races.length; j++) {
      if (i === j) continue;
      const a = L[i], b = L[j], ri = races[i], rj = races[j];
      let cov = a.nat * b.nat;
      if (REGION[ri.st] === REGION[rj.st]) cov += a.reg * b.reg;
      if (ri.st === rj.st) cov += a.state * b.state;
      if (ri.office === rj.office) cov += a.off * b.off;
      const corr = cov / (races[i].sigma * races[j].sigma);
      cands.push({ id: rj.id, corr, sameState: ri.st === rj.st, statewide: rj.office !== "house" });
    }
    cands.sort((x, y) => y.corr - x.corr);
    // mix the list: same-state races cluster at nearly one value, so cap them
    // and let the strongest out-of-state partners through
    const same = [], other = [];
    for (const c of cands) (c.sameState ? same : other).push(c);
    // a same-state statewide race is the pairing readers look for first
    same.sort((x, y) => (y.statewide ? 1 : 0) - (x.statewide ? 1 : 0) || y.corr - x.corr);
    const picked = [...same.slice(0, 4), ...other.slice(0, k - Math.min(same.length, 4))]
      .sort((x, y) => y.corr - x.corr)
      .slice(0, k);
    out[i] = picked.map((c) => ({ id: c.id, corr: Math.round(c.corr * 1000) / 1000 }));
  }
  return out;
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
  if (r.market) {
    const mk = marketMargin(r.market.q, r.office, DAYS_OUT);
    const wk = marketWeight(r.mFPE, w, r.office) * (0.55 + 0.45 * r.market.liquidity);
    r.mPE = (1 - wk) * r.mFPE + wk * mk;                                        // Complete
    r.wMkt = Math.round(wk * 1000) / 1000;
    r.mktMargin = Math.round(mk * 10) / 10;
  } else {
    r.mPE = r.mFPE;
    r.wMkt = 0;
  }
  r.sigma = raceSigma(r.office, DAYS_OUT, r.enop);
}

const meansLegacy = races.map((r) => r.mFP);
const meansComplete = races.map((r) => r.mPE);
const simL = simulate(races, meansLegacy, "legacy");
const simC = simulate(races, meansComplete, "complete");
const similar = topCorrelated(races, simC.L);

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
  let cum = 0, p10R = rows.length ? rows[0][0] : 0, p90R = p10R, got10 = false;
  for (const [seatsR, count] of rows) {
    cum += count / M;
    if (!got10 && cum >= 0.1) { p10R = seatsR; got10 = true; }
    if (cum <= 0.9) p90R = seatsR;
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
    const sigmaAt = raceSigma(r.office, DAYS_OUT + i * 2, r.enop);
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
    const key = `${c[0]}-${c[1].toUpperCase()}`;
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
    totals.set(`${c[0]}-${c[3].toUpperCase()}`, +c[5] || 0);
  }
  return { reg, totals };
}

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
  for (const [st, ids] of byState) {
    let leans = [], weights = [];
    for (const id of ids) {
      const e = reg.get(id);
      const t = totals.get(id) ?? (e ? e.d + e.r + e.o : 0);
      let lean;
      if (e && e.d + e.r > 200) {
        lean = (100 * (e.r - e.d)) / (e.d + e.r + 0.6 * e.o);
        lean *= 1.35; // registration understates behavioral polarization
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
  }

  const out = {};
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
    fundamentals: Math.round(r.mF * 10) / 10,
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
    },
    complete: {
      margin: Math.round(r.mPE * 10) / 10,
      prob: Math.round(simC.probs[i] * 1000) / 1000,
      p10: simC.quantiles[i].p10,
      p90: simC.quantiles[i].p90,
    },
    polls: r.polls.slice(0, 8).map((p) => ({ pollster: p.pollster, kind: p.kind, age: p.age, n: p.size, margin: p.margin })),
    similar: similar[i],
    trend: { legacy: raceTrend(r, "legacy"), complete: raceTrend(r, "complete") },
  };
});

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
console.log("races", raceOut.length, "| within ±3:", close, "| county overlays:", Object.keys(counties).length, "| districts:", Object.keys(geoOut.districts).length);
const sizes = ["model.json", "counties.json", "geo.json"].map((f) => `${f} ${(readFileSync(`${OUT}/${f}`).length / 1e6).toFixed(2)}MB`);
console.log(sizes.join(" · "));
