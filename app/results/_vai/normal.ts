// Normal distribution functions with accurate tails. The inventory model truncates log-turnout at what is already
// counted, and a county can be many standard deviations above its expectation, so Φ(x) = 1 − Q(x) is never computed by
// subtraction in the upper tail: everything goes through the survival function Q.

const SQRT2 = Math.SQRT2;
const LOG_SQRT_2PI = 0.5 * Math.log(2 * Math.PI);

/** erf(z) for 0 ≤ z ≤ ~2.2 from the all-positive series 2/√π · e^(−z²) · Σ 2ⁿ z^(2n+1) / (2n+1)!!. */
function erfSmall(z: number): number {
  let term = z, sum = z;
  for (let n = 1; n < 200; n++) {
    term *= (2 * z * z) / (2 * n + 1);
    sum += term;
    if (term < sum * 1e-17) break;
  }
  return (2 / Math.sqrt(Math.PI)) * Math.exp(-z * z) * sum;
}

/** Continued fraction for the Mills ratio: Q(x) = φ(x) / t(x), t = x + 1/(x + 2/(x + 3/(x + …))), for x ≥ 3. */
function millsDenominator(x: number): number {
  let t = x;
  for (let k = 80; k >= 1; k--) t = x + k / t;
  return t;
}

/** Q(x) = P(Z > x). Relative error about 1e-13 everywhere it is representable. */
export function normalSurvival(x: number): number {
  if (x < 0) return 1 - normalSurvival(-x);
  if (x < 3) return 0.5 * (1 - erfSmall(x / SQRT2));
  if (x > 38) return 0;
  return Math.exp(-0.5 * x * x - LOG_SQRT_2PI) / millsDenominator(x);
}

/** log Q(x), finite for every finite x (no underflow in the far tail). */
export function logNormalSurvival(x: number): number {
  if (x < 3) return Math.log(normalSurvival(x));
  return -0.5 * x * x - LOG_SQRT_2PI - Math.log(millsDenominator(x));
}

export const normalCdf = (x: number) => (x < 0 ? normalSurvival(-x) : 1 - normalSurvival(x));

// Acklam's rational approximation, then one Halley step against the accurate CDF.
const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

/** Φ⁻¹(p) for 0 < p < 1. */
export function normalQuantile(p: number): number {
  if (!(p > 0)) return -Infinity;
  if (!(p < 1)) return Infinity;
  const lo = 0.02425;
  let x: number;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  } else if (p <= 1 - lo) {
    const q = p - 0.5, r = q * q;
    x = ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  if (p > 1e-300 && p < 1 - 1e-16 && Math.abs(x) < 37) {
    const e = normalCdf(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp(0.5 * x * x);
    x -= u / (1 + 0.5 * x * u);
  }
  return x;
}

/** The z with Q(z) = p, i.e. the upper-tail quantile: accurate for tiny p. */
export const normalSurvivalInverse = (p: number) => -normalQuantile(p);

export function logSumExp(xs: ArrayLike<number>, n = xs.length): number {
  let m = -Infinity;
  for (let i = 0; i < n; i++) if (xs[i] > m) m = xs[i];
  if (m === -Infinity) return -Infinity;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.exp(xs[i] - m);
  return m + Math.log(s);
}
