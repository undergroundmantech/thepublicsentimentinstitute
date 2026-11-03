// Publishes the Senate and House forecast with the error standard deviation scaled by √2 (variance doubled).
// Approved for production on 2 November 2026; see docs/UNCERTAINTY_SQRT2.md. Governors, margins, polling averages,
// ratings and every other point estimate are untouched.
//
// It runs as `npm run prebuild`, so a fresh baseline publish of public/forecast is always widened before the site
// is built. Every file it writes carries an `uncertainty` marker and is skipped when the marker is already there,
// so running it twice changes nothing.
//
//   node scripts/calibration/apply-uncertainty.mjs [repoRoot] [--check]
//
// Method
//   race win probability   p' = Φ(Φ⁻¹(p)/√2): the margin stays put and the error sd grows by √2
//   80% range, histogram   stretched by √2 around the published margin
//   chamber control, seats one-factor Gaussian copula over the race probabilities. The shared-error loading λ is
//                          fitted so the copula reproduces the published control exactly at scale 1; the √2 seat
//                          distribution then keeps the same latent draws and moves every race's threshold. Seat
//                          distributions are exact (Poisson-binomial convolution on a quadrature grid), not sampled.
//   chamber trend          each earlier day moved in probit space by the same ratio as today (approximate)
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SCALE = Math.SQRT2;
export const VERSION = "unc-2026.11.03-1";
export const OFFICES = ["senate", "house"];

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
const clampP = (p) => Math.min(1 - 1e-12, Math.max(1e-12, p));

// a win probability under an error sd s times wider; 0 and 1 (uncontested) stay put
export const widenProb = (p, s = SCALE) => (p <= 0 || p >= 1 ? p : phi(phiInv(p) / s));
export const stretch = (x, centre, s = SCALE) => (x == null ? x : centre + s * (x - centre));

// quadrature grid for the shared factor g ~ N(0,1)
const G = (() => {
  const xs = [], ws = [];
  let t = 0;
  for (let k = -70; k <= 70; k++) { const g = k / 10, w = Math.exp(-g * g / 2); xs.push(g); ws.push(w); t += w; }
  return { xs, ws: ws.map((w) => w / t) };
})();

// exact distribution of Democratic wins among races with P(D win) = pD, under a one-factor Gaussian copula with loading lam
export function seatDist(pD, lam) {
  const n = pD.length, out = new Float64Array(n + 1), a = pD.map((p) => phiInv(clampP(p))), c = Math.sqrt(1 - lam * lam);
  const dp = new Float64Array(n + 1);
  for (let k = 0; k < G.xs.length; k++) {
    const g = G.xs[k];
    dp.fill(0); dp[0] = 1;
    for (let i = 0; i < n; i++) {
      const q = pD[i] <= 0 ? 0 : pD[i] >= 1 ? 1 : phi((a[i] + lam * g) / c);
      for (let j = i + 1; j > 0; j--) dp[j] = dp[j] * (1 - q) + dp[j - 1] * q;
      dp[0] *= 1 - q;
    }
    for (let j = 0; j <= n; j++) out[j] += G.ws[k] * dp[j];
  }
  return out;
}

const tail = (dist, k) => { let s = 0; for (let j = Math.max(0, k); j < dist.length; j++) s += dist[j]; return s; };

// λ for which the copula reproduces the published control probability (control falls as λ rises for the favourite)
export function fitLoading(pD, need, control) {
  const ctl = (lam) => tail(seatDist(pD, lam), need);
  let lo = 0, hi = 0.97;
  const c0 = ctl(lo), c1 = ctl(hi);
  if ((control - c0) * (control - c1) > 0) return Math.abs(control - c0) < Math.abs(control - c1) ? lo : hi;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if ((ctl(m) - control) * (c0 - c1) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

const quantile = (dist, base, q) => { let s = 0; for (let j = 0; j < dist.length; j++) { s += dist[j]; if (s >= q - 1e-12) return base + j; } return base + dist.length - 1; };
function variance(d) { let m = 0, v = 0; d.forEach((p, j) => { m += p * j; }); d.forEach((p, j) => { v += p * (j - m) ** 2; }); return v; }

// chamber numbers after widening. pD and pD2 are the race P(D win) before and after, in the same order;
// need is the number of those races Democrats must win (control threshold minus seats not up).
export function chamberAt(ch, pD, pD2, notUpD, need) {
  const lam = fitLoading(pD, need, ch.demControl);
  const d1 = seatDist(pD, lam), d2 = seatDist(pD2, lam);
  const control = tail(d2, need);
  const demSeats = notUpD + pD2.reduce((t, p) => t + p, 0);
  const hist = [];
  for (let j = 0; j < d2.length; j++) { const v = round(d2[j], 5); if (v >= 1e-5) hist.push([ch.seatsTotal - (notUpD + j), v]); }
  // keep the published order (most Republican seats first today)
  const desc = !(ch.hist?.length > 1) || ch.hist[0][0] > ch.hist[ch.hist.length - 1][0];
  hist.sort((x, y) => (desc ? y[0] - x[0] : x[0] - y[0]));
  return {
    lam, fitControl: tail(d1, need), control, demSeats, hist,
    ratio: phiInv(clampP(control)) / phiInv(clampP(ch.demControl)),
    seatShift: demSeats - (notUpD + pD.reduce((t, p) => t + p, 0)),
    median: quantile(d2, notUpD, 0.5), demP10: quantile(d2, notUpD, 0.1), demP90: quantile(d2, notUpD, 0.9),
    sd: { before: Math.sqrt(variance(d1)), after: Math.sqrt(variance(d2)) },
  };
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const MARK = (extra = {}) => ({ scale: SCALE, version: VERSION, offices: OFFICES, ...extra });

// Democratic control thresholds: 51 Senate seats (the vice president breaks ties for Republicans), 218 House seats
const CONTROL = { senate: 51, house: 218 };

// ── model.json ────────────────────────────────────────────────────────────────────────────────────────────────
export function widenModel(model, raw = "") {
  const s = SCALE, races = model.races, report = {}, baseProb = {};
  for (const r of races) {
    if (!OFFICES.includes(r.office) || !r.est) continue;
    const e = r.est, c = e.margin;
    baseProb[r.id] = e.prob;
    e.prob = round(widenProb(e.prob, s), 4);
    if (e.p10 != null && e.p10 !== c) e.p10 = round(stretch(e.p10, c, s), 2);
    if (e.p90 != null && e.p90 !== c) e.p90 = round(stretch(e.p90, c, s), 2);
    if (e.dist) e.dist = { ...e.dist, lo: round(stretch(e.dist.lo, c, s), 6), w: round(e.dist.w * s, 6) };
    if (Array.isArray(r.trend)) r.trend = r.trend.map((t) => (t && typeof t.p === "number" ? { ...t, p: round(widenProb(t.p, s), 4) } : t));
  }
  const notUp = { senate: model.meta.senNotUpD ?? 0, house: 0 };
  const before = {};
  for (const o of OFFICES) {
    const ch = model.chambers[o];
    const rs = races.filter((r) => r.office === o && r.est);
    const res = chamberAt(ch, rs.map((r) => 1 - baseProb[r.id]), rs.map((r) => 1 - r.est.prob), notUp[o], CONTROL[o] - notUp[o]);
    before[o] = { demControl: ch.demControl, gopControl: ch.gopControl, demSeats: ch.demSeats, gopSeats: ch.gopSeats, median: ch.median, demP10: ch.demP10, demP90: ch.demP90 };
    ch.demControl = round(res.control, 4);
    ch.gopControl = round(1 - ch.demControl, 4);
    ch.demSeats = round(res.demSeats, 2);
    ch.gopSeats = round(ch.seatsTotal - ch.demSeats, 2);
    ch.hist = res.hist;
    ch.median = res.median; ch.demP10 = res.demP10; ch.demP90 = res.demP90;
    if (Array.isArray(ch.trend) && ch.trend.length) {
      const last = ch.trend.length - 1;
      ch.trend = ch.trend.map((t, i) => (i === last ? { ...t, dem: ch.demControl, demSeats: ch.demSeats }
        : { ...t, dem: round(phi(phiInv(clampP(t.dem)) * res.ratio), 4), demSeats: round(t.demSeats + res.seatShift, 2) }));
    }
    report[o] = { lambda: round(res.lam, 4), fitControl: round(res.fitControl, 4), seatSd: { before: round(res.sd.before, 2), after: round(res.sd.after, 2) }, before: before[o], after: { demControl: ch.demControl, demSeats: ch.demSeats, median: ch.median, demP10: ch.demP10, demP90: ch.demP90 } };
  }
  model.meta.uncertainty = MARK({
    status: "published",
    method: {
      race: "p' = Φ(Φ⁻¹(p)/√2); margin unchanged; p10, p90 and the margin histogram stretched by √2 around the margin",
      chamber: "one-factor Gaussian copula over the race probabilities, loading fitted to reproduce the published control at scale 1; exact seat distribution",
      trend: "earlier chamber control moved in probit space by today's ratio; earlier expected seats shifted by today's change (approximate)",
      unchanged: "governors, margins, polling averages, ratings, generic ballot",
    },
    source: { sha256: raw ? sha256(raw) : null, updated: model.meta.updated },
    baseline: { chambers: before, raceProb: baseProb },
    fit: Object.fromEntries(OFFICES.map((o) => [o, { lambda: report[o].lambda, seatSd: report[o].seatSd }])),
  });
  return report;
}

// ── whatif.json ───────────────────────────────────────────────────────────────────────────────────────────────
// seeded PRNG (mulberry32) so the published House draws are reproducible
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function widenWhatIf(w, model) {
  const s = SCALE, N = w.meta.sims, by = new Map(model.races.map((r) => [r.id, r]));
  const raw = Buffer.from(w.dev, "base64"), i16 = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  w.races.forEach((r, k) => {
    if (!OFFICES.includes(r.office)) return;
    for (let i = 0; i < N; i++) i16[k * N + i] = Math.max(-32000, Math.min(32000, Math.round(i16[k * N + i] * s)));
    const m = by.get(r.id);
    r.p = m ? round(1 - m.est.prob, 4) : round(widenProb(r.p, s), 4);
  });
  w.dev = Buffer.from(i16.buffer).toString("base64");
  // House: keep each simulation's latent draws. The shared factor of simulation i comes from its rank in Democratic
  // seats; each district's own draw is sampled on the side of its threshold that reproduces the simulated result,
  // then the threshold moves by √2.
  const lam = model.meta.uncertainty?.fit?.house?.lambda ?? 0.6, c = Math.sqrt(1 - lam * lam), H = w.house.length, B = w.hbytes;
  const bits = Buffer.from(w.hwin, "base64");
  const bit = (d, i) => (bits[d * B + (i >> 3)] >> (7 - (i & 7))) & 1;
  const seats = Array.from({ length: N }, (_, i) => { let t = 0; for (let d = 0; d < H; d++) t += bit(d, i); return t; });
  const g = new Float64Array(N);
  seats.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).forEach(([, i], rank) => { g[i] = phiInv((rank + 0.5) / N); });
  const out = Buffer.alloc(bits.length), rand = rng(20261103), base = model.meta.uncertainty?.baseline?.raceProb ?? {};
  w.house.forEach((h, d) => {
    const m = by.get(h.id), pD = 1 - (base[h.id] ?? (m ? m.est.prob : 1 - h.p)), a = phiInv(clampP(pD));
    for (let i = 0; i < N; i++) {
      let won = bit(d, i);
      if (pD > 0 && pD < 1) {
        const ft = phi((-a - lam * g[i]) / c), u = rand();
        const e = phiInv(clampP(won ? ft + u * (1 - ft) : u * ft));
        won = a / s + lam * g[i] + c * e > 0 ? 1 : 0;
      }
      if (won) out[d * B + (i >> 3)] |= 1 << (7 - (i & 7));
    }
    h.p = m ? round(1 - m.est.prob, 4) : round(widenProb(h.p, s), 4);
  });
  w.hwin = out.toString("base64");
  for (const o of OFFICES) if (w.chambers?.[o]) w.chambers[o] = { ...w.chambers[o], demControl: model.chambers[o].demControl, demSeats: model.chambers[o].demSeats };
  w.meta.uncertainty = MARK({ senate: "simulated deviations scaled by √2", house: "district draws re-thresholded on a shared factor from each simulation's seat rank", lambda: lam });
}

// ── scenarios ─────────────────────────────────────────────────────────────────────────────────────────────────
export function widenScenario(x, s = SCALE) {
  if (!OFFICES.includes(x.office)) return false;
  if (typeof x.pD === "number") x.pD = round(widenProb(x.pD, s), 4);
  if (typeof x.sd === "number") x.sd = round(x.sd * s, 2);
  if (typeof x.m === "number") {
    if (x.p10 != null) x.p10 = round(stretch(x.p10, x.m, s), 2);
    if (x.p90 != null) x.p90 = round(stretch(x.p90, x.m, s), 2);
  }
  return true;
}

// ── driver ────────────────────────────────────────────────────────────────────────────────────────────────────
export function apply(root, { check = false } = {}) {
  const dir = join(root, "public/forecast"), log = [], writes = [];
  const rd = (f) => readFileSync(join(dir, f), "utf8");
  const put = (f, o) => writes.push([f, JSON.stringify(o)]);
  const raw = rd("model.json"), model = JSON.parse(raw);
  if (!model.meta.uncertainty) { log.push(["model.json", widenModel(model, raw)]); put("model.json", model); }
  else log.push(["model.json", "already widened"]);
  if (existsSync(join(dir, "whatif.json"))) {
    const w = JSON.parse(rd("whatif.json"));
    if (!w.meta?.uncertainty) { widenWhatIf(w, model); put("whatif.json", w); log.push(["whatif.json", "widened"]); }
    else log.push(["whatif.json", "already widened"]);
  }
  if (existsSync(join(dir, "scenarios"))) {
    let n = 0;
    for (const f of readdirSync(join(dir, "scenarios")).filter((f) => f.endsWith(".json"))) {
      const x = JSON.parse(rd(`scenarios/${f}`));
      if (x.uncertainty) continue;
      if (Array.isArray(x.races)) x.races.forEach((r) => widenScenario(r));
      else if (!widenScenario(x)) continue;
      x.uncertainty = MARK();
      put(`scenarios/${f}`, x); n++;
    }
    log.push(["scenarios", `${n} widened`]);
  }
  if (!check) for (const [f, s] of writes) writeFileSync(join(dir, f), s);
  return { log, files: writes.map(([f]) => f) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), check = args.includes("--check"), root = args.find((a) => !a.startsWith("--")) || process.cwd();
  const t0 = Date.now(), { log, files } = apply(root, { check });
  for (const [k, v] of log) console.log(k, typeof v === "string" ? v : JSON.stringify(v));
  console.log(`${check ? "would write" : "wrote"} ${files.length} files in ${Date.now() - t0} ms`);
}
