/* =============================================================================
   PSI LOWESS trend lines, and the Election Day polling average they project.

   The PSI daily average (buildDailyModel.ts) weights every poll by recency,
   sample size, voter screen and pollster grade. This is a second, deliberately
   plainer read of the same polls, built to get past poll-to-poll noise and show
   whether the newest polling is pulling away from the broader trend or
   confirming it.

   • Every individual poll is one observation. No sample-size or pollster weight.
   • y is the poll's margin, first series minus second series. On a D vs R race
     that is the Democratic margin when the Democrat is listed first.
   • x is the midpoint of the poll's field dates. A poll that publishes only an
     end date is placed 1.5 days before it, half the site's median field length
     of 3 days, and is flagged as an estimated midpoint.
   • Published polling averages (RCP and the like) are left out, so no poll is
     counted twice.
   • Robust LOWESS (Cleveland 1979): local linear fits with tricube distance
     weights, then three robustness passes with bisquare weights, so one odd
     poll cannot drag the line. It reproduces statsmodels' lowess(it=3,
     delta=0) to within 0.002 of a point on every aggregate on the site.
   • Three spans: 0.30 recent trend, 0.45 balanced trend, 0.60 long-term trend.

   Election Day polling average. LOWESS cannot extrapolate: a local line pushed
   a month past the last poll swings wildly. The projection is instead a fixed
   blend of where the trends stand now, chosen on a backtest of the site's own
   polls. The backtest used 31 aggregates with enough polling, 1,018 cut points,
   and scored each projection 14 to 42 days ahead against the median of the
   real polls taken within a week of that date.

       Election Day average = 0.40 x recent trend + 0.60 long-term trend

   Leaving one race out at a time, that blend missed the later polling by 2.62
   points on average. The long-term trend alone missed by 2.63, equal thirds by
   2.66 and the latest single poll by 4.55. Every blend from 20/80 to 40/60
   lands within 0.03 points of the others, so the exact split matters less than
   leaning on the long-term trend. Carrying the recent slope forward made every
   horizon worse: adding the full slope took the six week miss from 3.0 to 9.8
   points, so the projection carries none.

   The 80% range is sqrt(12.37 + 0.1708 x days) points, about 4.3 at 36 days,
   fitted on the same backtest. On the 2024 presidential and 2025 governor
   races, whose polling ran to Election Day, it covered 96% of outcomes, so it
   runs a little wide on well polled races.
============================================================================= */

export const SPANS = { recent: 0.30, balanced: 0.45, long: 0.60 } as const;
export type SpanKey = keyof typeof SPANS;
export const ROBUST_PASSES = 3;
export const IMPUTED_HALF_FIELD_DAYS = 1.5;
export const EDAY_WEIGHTS = { recent: 0.40, balanced: 0.0, long: 0.60 } as const;
export const MIN_POLLS_TREND = 6;
export const MIN_POLLS_PROJECTION = 8;
const BAND_A = 12.37, BAND_B = 0.1708;           // 80% half width squared = A + B x days

const PUBLISHED_AVERAGE = /\b(avg|average|aggregate|consensus)\b/i;
const DAY = 86400000;

export type TrendPoll = { pollster: string; t: number; margin: number; imputed: boolean };
export type TrendCurve = { t: number; v: number }[];
export type TrendResult = {
  n: number;
  excluded: number;                         // published averages left out
  imputed: number;                          // polls placed from their end date
  points: TrendPoll[];
  curves: Record<SpanKey, TrendCurve>;
  latest: Record<SpanKey, number>;          // each trend at the newest poll midpoint
  latestT: number;
  recentWindow: number;                     // polls in each recent-trend window, int(0.30 x n)
  divergence: number;                       // recent minus long-term
  noise: number;                            // robust SD of polls around the balanced trend
  reading: "toward-a" | "toward-b" | "confirming";
  eday: null | { t: number; days: number; value: number; lo: number; hi: number; half: number };
};

/* ---------------------------------------------------------------- LOWESS -- */
// A line for line match of statsmodels' lowess(frac, it=3, delta=0): the k = int(frac x n)
// nearest polls found as a sliding window over sorted x, tricube weights on distance over the
// window radius (the farthest neighbour gets zero), bisquare robustness weights from residuals
// over six times their median, and a poll on the same date as the one before it takes that
// poll's fit. A window with fewer than two usable weights returns the poll's own value, and on
// the drawing grid is filled in from its neighbours.

function windowAt(x: number[], x0: number, k: number): [number, number] {
  let left = 0, right = k;
  while (right < x.length && x0 > (x[left] + x[right]) / 2) { left++; right++; }
  return [left, right];
}

function fitAt(x0: number, x: number[], y: number[], wRob: number[], k: number, own?: number): number {
  const [left, right] = windowAt(x, x0, k);
  const radius = Math.max(x0 - x[left], x[right - 1] - x0);
  const w: number[] = [];
  let nonzero = 0, sw = 0;
  for (let j = left; j < right; j++) {
    const d = radius > 0 ? Math.abs(x[j] - x0) / radius : 0;
    const wj = (d < 1 ? (1 - d * d * d) ** 3 : 0) * wRob[j];
    w.push(wj); sw += wj; if (wj > 1e-12) nonzero++;
  }
  if (nonzero < 2) return own ?? NaN;
  let xm = 0;
  for (let j = left; j < right; j++) xm += (w[j - left] / sw) * x[j];
  let sq = 0;
  for (let j = left; j < right; j++) sq += (w[j - left] / sw) * (x[j] - xm) ** 2;
  sq = Math.max(sq, 1e-12);
  let v = 0;
  for (let j = left; j < right; j++) v += (w[j - left] / sw) * (1 + ((x0 - xm) * (x[j] - xm)) / sq) * y[j];
  return v;
}

const median = (a: number[]) => {
  const s = [...a].sort((p, q) => p - q); const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Robust LOWESS on x sorted ascending. Returns the fitted values at x and, if given, at grid. */
export function lowess(x: number[], y: number[], frac: number, passes = ROBUST_PASSES, grid?: number[]) {
  const n = x.length;
  const k = Math.floor(frac * n + 1e-10);
  let wRob = new Array(n).fill(1);
  const fit = new Array<number>(n);
  for (let it = 0; it <= passes; it++) {
    for (let i = 0; i < n; i++) fit[i] = i > 0 && x[i] === x[i - 1] ? fit[i - 1] : fitAt(x[i], x, y, wRob, k, y[i]);
    if (it === passes) break;
    const e = y.map((yi, i) => Math.abs(yi - fit[i]));
    const m = median(e);
    wRob = e.map((ei) => { const u = m === 0 ? (ei > 0 ? 1 : 0) : Math.min(ei / (6 * m), 1); return (1 - u * u) ** 2; });
  }
  let g: number[] | undefined;
  if (grid) {
    g = grid.map((g0) => fitAt(g0, x, y, wRob, k));
    // a thin window on the grid is filled from the fits at the polls themselves, which is what
    // statsmodels returns at those points
    const src = x.map((xi, i) => [xi, fit[i]] as [number, number]);
    g = g.map((v, i) => (Number.isFinite(v) ? v : interp(grid[i], src)));
  }
  return { fit, grid: g };
}

function interp(x0: number, pts: [number, number][]): number {
  if (x0 <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x0 <= pts[i][0]) {
      const [xa, ya] = pts[i - 1], [xb, yb] = pts[i];
      return xb === xa ? yb : ya + ((x0 - xa) * (yb - ya)) / (xb - xa);
    }
  }
  return pts[pts.length - 1][1];
}

/* ------------------------------------------------------------ the trends -- */

type RawPoll = { pollster: string; startDate?: string; endDate: string; results: Record<string, number> };
const ts = (iso: string) => new Date(iso + "T00:00:00").getTime();

/** Election Day for the aggregate's contest, or null where there is no election
 *  to project to, such as approval ratings. */
export function electionDayFor(category: string, id: string): number | null {
  if (/^2026/.test(category)) return ts("2026-11-03");
  if (/^2025/.test(category)) return ts("2025-11-04");
  if (/^2024/.test(category)) return ts("2024-11-05");
  if (/^2028/.test(category) || id.startsWith("2028")) return ts("2028-11-07");
  return null;
}

export function buildTrends(polls: RawPoll[], keyA: string, keyB: string, eday: number | null): TrendResult | null {
  let excluded = 0, imputed = 0;
  const pts: TrendPoll[] = [];
  for (const p of polls) {
    if (PUBLISHED_AVERAGE.test(p.pollster)) { excluded++; continue; }
    const a = Number(p.results?.[keyA]), b = Number(p.results?.[keyB]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const end = ts(p.endDate);
    const hasStart = !!p.startDate && Number.isFinite(ts(p.startDate));
    const t = hasStart ? (ts(p.startDate!) + end) / 2 : end - IMPUTED_HALF_FIELD_DAYS * DAY;
    if (!hasStart) imputed++;
    pts.push({ pollster: p.pollster.replace(/\*\*/g, "").trim(), t, margin: a - b, imputed: !hasStart });
  }
  pts.sort((p, q) => p.t - q.t);
  if (pts.length < MIN_POLLS_TREND) return null;

  const t0 = pts[0].t;
  const x = pts.map((p) => (p.t - t0) / DAY), y = pts.map((p) => p.margin);

  const curves = {} as Record<SpanKey, TrendCurve>;
  const latest = {} as Record<SpanKey, number>;
  let balancedFit: number[] = [];
  for (const k of Object.keys(SPANS) as SpanKey[]) {
    const { fit } = lowess(x, y, SPANS[k], ROBUST_PASSES);
    // The line is drawn through the smoother's fitted value at each poll, the way statsmodels
    // returns it. Evaluating a local fit on a daily grid swings through gaps between sparse polls.
    const last = fit[fit.length - 1];
    curves[k] = x.map((xi, i) => ({ t: t0 + xi * DAY, v: fit[i] })).filter((c, i, arr) => i === arr.length - 1 || c.t !== arr[i + 1].t);
    latest[k] = last;
    if (k === "balanced") balancedFit = fit;
  }

  const noise = 1.4826 * median(y.map((yi, i) => Math.abs(yi - balancedFit[i])));
  const divergence = latest.recent - latest.long;
  // The recent trend leans on about 30% of the polls; its level is uncertain by
  // roughly the poll noise over the square root of that count.
  const seRecent = noise / Math.sqrt(Math.max(1, Math.floor(SPANS.recent * pts.length)));
  const moving = Math.abs(divergence) >= Math.max(1.0, 1.5 * seRecent);
  const reading: TrendResult["reading"] = !moving ? "confirming" : divergence > 0 ? "toward-a" : "toward-b";

  let edayOut: TrendResult["eday"] = null;
  const lastT = pts[pts.length - 1].t;
  if (eday !== null && eday > lastT && pts.length >= MIN_POLLS_PROJECTION) {
    const value = EDAY_WEIGHTS.recent * latest.recent + EDAY_WEIGHTS.balanced * latest.balanced + EDAY_WEIGHTS.long * latest.long;
    // horizon from the newest poll, the way the backtest measured it
    const days = Math.round((eday - lastT) / DAY);
    const half = Math.sqrt(BAND_A + BAND_B * days);
    edayOut = { t: eday, days, value, lo: value - half, hi: value + half, half };
  }

  return { n: pts.length, excluded, imputed, points: pts, curves, latest, latestT: lastT,
    recentWindow: Math.floor(SPANS.recent * pts.length + 1e-10), divergence, noise, reading, eday: edayOut };
}
