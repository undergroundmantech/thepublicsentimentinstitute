// One way to write a percentage on the election-night pages.
//
// The input convention is always explicit and never guessed from the size of the number:
//   pctPoints(x)   x is already in percentage points, 0 to 100: civicAPI's reporting share (`pr`), a vote share
//                  computed as 100 * votes / total, a margin in points.
//   pctFraction(x) x is a fraction, 0 to 1: a model probability (`pR`, `pD`, `pPass`), a share stored as a fraction.
// A guess such as `p > 1 ? p : p * 100` misreads a certainty of 1.0 as "1%" and a 0.6-point share as "60%".
//
// One decimal by default ("52.3%"). `headline: true` gives a whole number for a large display figure ("52%"),
// the only exception. A value that rounds to zero is written "0.0%", never "-0.0%". A missing or non-finite value
// gives the fallback (an em dash unless the caller passes its own).
export type PctOpts = { headline?: boolean; fallback?: string };

export const pctPoints = (x: number | null | undefined, o: PctOpts = {}): string => {
  if (x == null || !Number.isFinite(x)) return o.fallback ?? "\u2014";
  const d = o.headline ? 0 : 1, f = 10 ** d;
  // round half away from zero on the decimal value, which toFixed alone does not do for inputs such as 0.05
  const r = (Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9)) / f;
  return `${(r === 0 ? 0 : r).toFixed(d)}%`;
};

export const pctFraction = (x: number | null | undefined, o: PctOpts = {}): string =>
  pctPoints(x == null || !Number.isFinite(x) ? x : x * 100, o);

// Percent In only (the provider's reporting share, in points): above 99.0, judged on the unrounded value, it reads
// ">99%" so a race that is still counting never shows "100.0%". Every other percentage, win probabilities included,
// uses pctPoints / pctFraction unchanged. The caller appends " in" or " reporting".
export const percentIn = (x: number | null | undefined, o: PctOpts = {}): string =>
  x != null && Number.isFinite(x) && x > 99 ? ">99%" : pctPoints(x, o);
