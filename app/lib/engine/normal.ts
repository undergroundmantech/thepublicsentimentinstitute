// Normal distribution helpers for the engine. Accurate in the tails (no rounding to exactly 0 or 1).
const SQRT_PI = Math.sqrt(Math.PI);
function erfcPos(x: number): number {
  if (x === 0) return 1;
  if (x < 2.5) { let term = x, sum = x; for (let n = 1; n < 200; n++) { term *= (2 * x * x) / (2 * n + 1); sum += term; if (term < sum * 1e-17) break; } return 1 - (2 / SQRT_PI) * Math.exp(-x * x) * sum; }
  let t = x; for (let k = 80; k >= 1; k--) t = x + (k / 2) / t;
  return Math.exp(-x * x) / (SQRT_PI * t);
}
export const Phi = (z: number) => { if (Number.isNaN(z)) return NaN; const h = 0.5 * erfcPos(Math.abs(z) / Math.SQRT2); return z >= 0 ? 1 - h : h; };
export function PhiInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  let x: number;
  if (q < 0.02425) { const r = Math.sqrt(-2 * Math.log(q)); x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1); }
  else if (q > 1 - 0.02425) { const r = Math.sqrt(-2 * Math.log(1 - q)); x = -(((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1); }
  else { const r = q - 0.5, s = r * r; x = (((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1); }
  const e = Phi(x) - q, u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}
/** Quantile of a sample (sorts a copy). Linear interpolation between order statistics. */
export function quantiles(xs: ArrayLike<number>, ps: number[]): number[] {
  const s = Float64Array.from(xs).sort(); const n = s.length;
  return ps.map((p) => { if (!n) return NaN; const h = (n - 1) * p, i = Math.floor(h), f = h - i; return i + 1 < n ? s[i] + f * (s[i + 1] - s[i]) : s[i]; });
}
export function dist(xs: ArrayLike<number>) {
  const n = xs.length; let m = 0; for (let i = 0; i < n; i++) m += xs[i]; m /= Math.max(1, n);
  const [l95, l80, p50, h80, h95] = quantiles(xs, [0.025, 0.1, 0.5, 0.9, 0.975]);
  return { mean: m, p50, i80: { lo: l80, hi: h80 }, i95: { lo: l95, hi: h95 } };
}
/** Seat counts are whole numbers: nearest-rank quantiles, so an interval reads "246 to 273", never "273.1". */
export function seatDist(xs: ArrayLike<number>) {
  const s = Float64Array.from(xs).sort(), n = s.length; let m = 0; for (let i = 0; i < n; i++) m += s[i];
  const q = (p: number) => (n ? s[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))] : NaN);
  return { mean: n ? m / n : NaN, p50: q(0.5), i50: { lo: q(0.25), hi: q(0.75) }, i80: { lo: q(0.1), hi: q(0.9) }, i95: { lo: q(0.025), hi: q(0.975) } };
}
