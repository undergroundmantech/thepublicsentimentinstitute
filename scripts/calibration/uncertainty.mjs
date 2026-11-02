// Independent uncertainty calibration layer over the published forecast (public/forecast/model.json).
// It never edits the model or Lester's pipeline: it reads the published file and writes versioned scenarios to
// public/forecast/calibrated/. UNCERTAINTY_SCALE 1.0 is the baseline and must reproduce the input exactly;
// √2 is the adjusted scenario. Senate and House only; governors are carried through unchanged.
// Nothing in the app reads these files. Not authorised for production until Lester's simulation run validates it.
//
//   node scripts/calibration/uncertainty.mjs [repoRoot]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export const CALIBRATION_VERSION = "unc-2026.11.02-1";
export const SCALES = { baseline: 1.0, sqrt2: Math.SQRT2 };

// standard normal CDF via erfc (Numerical Recipes erfcc, fractional error < 1.2e-7)
export function phi(x) {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
    t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? 1 - r / 2 : r / 2;
}

// inverse standard normal CDF (Acklam, relative error < 1.15e-9)
export function phiInv(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

const round = (x, d) => (x == null || !Number.isFinite(x) ? x : Number(x.toFixed(d)));

// probit widening of a win probability: p' = Φ(Φ⁻¹(p)/s). 0 and 1 (uncontested) stay put.
export const probit = (p, s) => (p <= 0 || p >= 1 ? p : phi(phiInv(p) / s));

// share of a histogram above t, uniform within each bin
export function above(dist, t) {
  let n = 0, tot = 0;
  dist.c.forEach((k, i) => {
    const a = dist.lo + i * dist.w, b = a + dist.w;
    tot += k;
    if (t <= a) n += k; else if (t < b) n += (k * (b - t)) / dist.w;
  });
  return tot ? n / tot : NaN;
}

// widen a margin histogram around the race's published margin by s: the same 40 counts on bins s times as wide
export const widen = (dist, centre, s) => ({ lo: round(centre + s * (dist.lo - centre), 6), w: round(s * dist.w, 6), c: dist.c.slice() });
const stretch = (x, centre, s) => (x == null ? x : round(centre + s * (x - centre), 2));

function race(r, s) {
  const e = r.est;
  if (r.office === "governor" || !e) return { id: r.id, office: r.office, st: r.st, est: e, label: "inherited" };
  const out = { margin: e.margin, p10: stretch(e.p10, e.margin, s), p90: stretch(e.p90, e.margin, s) };
  if (r.office === "senate" && e.dist) {
    out.dist = widen(e.dist, e.margin, s);
    // anchored to the published probability: move it by what the widening does to the histogram's own share above 0
    out.prob = round(Math.min(1, Math.max(0, e.prob + above(out.dist, 0) - above(e.dist, 0))), 4);
  } else out.prob = round(probit(e.prob, s), 4);
  return { id: r.id, office: r.office, st: r.st, est: out, label: s === 1 ? "inherited" : "approximate" };
}

function chamber(ch, races, notUpR, s) {
  // race prob is the Republican win probability (margin is R minus D): not-up R seats + Σp reproduces gopSeats
  const sumP = races.reduce((t, r) => t + r.est.prob, 0);
  const base = s === 1;
  const demControl = round(probit(ch.demControl, s), 4);
  const gopSum = round(notUpR + sumP, 2);
  const gopSeats = base ? ch.gopSeats : gopSum;
  return {
    office: ch.office, seatsTotal: ch.seatsTotal, seatsNotUpGop: notUpR,
    demControl, gopControl: round(1 - demControl, 4),
    gopSeats, demSeats: round(ch.seatsTotal - gopSeats, 2),
    gopSeatsSumOfMarginals: gopSum,
    median: base ? ch.median : null, demP10: base ? ch.demP10 : null, demP90: base ? ch.demP90 : null, hist: base ? ch.hist : null,
    labels: {
      seatsNotUpGop: "exact", demControl: base ? "inherited" : "approximate", gopControl: base ? "inherited" : "approximate",
      gopSeats: base ? "inherited" : "approximate", demSeats: base ? "inherited" : "approximate", gopSeatsSumOfMarginals: base ? "exact" : "approximate",
      median: base ? "inherited" : "unavailable", demP10: base ? "inherited" : "unavailable", demP90: base ? "inherited" : "unavailable",
      hist: base ? "inherited" : "unavailable",
    },
  };
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

function lastCommit(root, path) {
  try { return execFileSync("git", ["-C", root, "log", "-1", "--format=%H %cI", "--", path], { encoding: "utf8" }).trim().split(" "); }
  catch { return [null, null]; }
}

export function calibrate(model, s, source = {}) {
  const races = model.races.map((r) => race(r, s));
  const pick = (o) => races.filter((r) => r.office === o);
  const doc = {
    calibration: {
      version: CALIBRATION_VERSION, scale: s, scenario: s === 1 ? "baseline" : s === Math.SQRT2 ? "sqrt2" : `scale-${s}`,
      status: "experimental: not authorised for production; nothing in the app reads this file",
      appliesTo: ["senate", "house"], unchanged: ["governor"],
      method: {
        senateRace: "40-bin margin histogram widened around the published margin (bin edges c+s(x-c), counts unchanged); prob moved by the change in the histogram's share above 0; p10/p90 stretched around the margin",
        houseRace: "probit: p' = Φ(Φ⁻¹(p)/s); p10/p90 stretched around the margin",
        chamberControl: "probit on the published control probability",
        expectedSeats: "Republican seats not up + sum of the adjusted race probabilities (race prob is P(Republican win)); expectation only, no joint simulation",
        notComputed: "seat histograms, medians, seat intervals and correlations need Lester's joint simulation; reported as unavailable",
      },
      labelKey: { exact: "arithmetic on published values", approximate: "derived without re-simulation", inherited: "copied from the published model", unavailable: "needs the joint simulation" },
    },
    source: { file: "public/forecast/model.json", sha256: source.sha256 ?? null, commit: source.commit ?? null, committedAt: source.committedAt ?? null, modelUpdated: model.meta?.updated ?? null, sims: model.meta?.sims ?? null },
    races,
    chambers: {
      senate: chamber(model.chambers.senate, pick("senate"), model.meta.senNotUpR, s),
      house: chamber(model.chambers.house, pick("house"), 0, s),
      governor: { ...model.chambers.governor, labels: { all: "inherited" } },
    },
  };
  doc.checksum = sha256(JSON.stringify(doc));
  return doc;
}

export function compare(base, alt) {
  const by = new Map(base.races.map((r) => [r.id, r]));
  const rows = alt.races.filter((r) => r.office !== "governor").map((r) => {
    const b = by.get(r.id).est;
    return { id: r.id, office: r.office, margin: b.margin, prob: b.prob, probSqrt2: r.est.prob, delta: round(r.est.prob - b.prob, 4), p10: b.p10, p90: b.p90, p10Sqrt2: r.est.p10, p90Sqrt2: r.est.p90 };
  }).filter((r) => r.prob > 0 && r.prob < 1).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const ch = (k) => ({
    demControl: [base.chambers[k].demControl, alt.chambers[k].demControl],
    gopSeats: [base.chambers[k].gopSeats, alt.chambers[k].gopSeats],
    gopSeatsSumOfMarginals: [base.chambers[k].gopSeatsSumOfMarginals, alt.chambers[k].gopSeatsSumOfMarginals],
  });
  return {
    version: CALIBRATION_VERSION, source: base.source, scales: [base.calibration.scale, alt.calibration.scale],
    checksums: { baseline: base.checksum, sqrt2: alt.checksum },
    note: "Pairs are [baseline, sqrt2]. prob is the Republican win probability; margin is R minus D. Expected seats compare like for like on gopSeatsSumOfMarginals. Not authorised for production.",
    chambers: { senate: ch("senate"), house: ch("house") },
    races: rows,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] || process.cwd();
  const raw = readFileSync(join(root, "public/forecast/model.json"), "utf8");
  const [commit, committedAt] = lastCommit(root, "public/forecast/model.json");
  const src = { sha256: sha256(raw), commit, committedAt };
  const model = JSON.parse(raw);
  const out = join(root, "public/forecast/calibrated");
  mkdirSync(out, { recursive: true });
  const docs = Object.fromEntries(Object.entries(SCALES).map(([k, s]) => [k, calibrate(model, s, src)]));
  for (const [k, d] of Object.entries(docs)) writeFileSync(join(out, `${k}.json`), JSON.stringify(d) + "\n");
  writeFileSync(join(out, "comparison.json"), JSON.stringify(compare(docs.baseline, docs.sqrt2), null, 1) + "\n");
  const c = (k) => docs[k].chambers;
  console.log(`source ${commit?.slice(0, 8)} model ${model.meta.updated} sha256 ${src.sha256.slice(0, 12)}`);
  for (const o of ["senate", "house"])
    console.log(`${o}: demControl ${c("baseline")[o].demControl} -> ${c("sqrt2")[o].demControl}; GOP seats (sum of marginals) ${c("baseline")[o].gopSeatsSumOfMarginals} -> ${c("sqrt2")[o].gopSeatsSumOfMarginals}`);
}
