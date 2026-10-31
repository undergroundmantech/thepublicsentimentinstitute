// One frame of a count-up glide from `a` to `v` at progress k (0..1), cubic ease-out. The value never leaves the
// interval between a and v, and at k >= 1 it is exactly v (no floating-point residue such as 99.70000000000002).
export const countFrame = (a: number, v: number, k: number): number =>
  k >= 1 ? v : k <= 0 ? a : a + (v - a) * (1 - Math.pow(1 - k, 3));
