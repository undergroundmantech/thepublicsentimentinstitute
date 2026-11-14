// A race page's headline figures, rebuilt from the engine's stored row. Pure.
import type { RaceRow } from "@/app/lib/engine/pipeline";
import { assignSides } from "./candidates";
import { PROB_CEIL, type Proj, type XRace } from "./live";

/** The page's projection object, rebuilt from the engine's row so every headline figure is the engine's. */
export function engineProj(r: XRace, row: RaceRow, P0: Proj): Proj {
  const as = assignSides(r, row.c.map((c) => [c[1], c[2] ?? ""] as const));
  const fin = { a: 0, b: 0, o: 0, t: 0 }, rep = { a: 0, b: 0, o: 0, t: 0 };
  row.c.forEach((c, i) => { const k = as.side[i]; fin[k] += c[4]; fin.t += c[4]; rep[k] += c[3] ?? 0; rep.t += c[3] ?? 0; });
  const pctIn = row.expectedFinal && row.expectedFinal > 0 ? Math.min(100, (100 * row.counted) / row.expectedFinal) : P0.pctIn;
  return { ...P0, rep, fin, pctIn, m: row.pm?.mean ?? P0.m, band: row.pm ? (row.pm.hi - row.pm.lo) / 2 : P0.band };
}

/** The page's two-sided odds from the engine's row. An uncalled, contested race is never shown above the cap
 *  (PROB_CEIL), whatever the raw draw fraction: a model probability is not a certainty. */
export function engineOdds(row: RaceRow) {
  const raw = row.pm!.probB, open = !row.settled && !row.call;
  const pB = open ? Math.min(PROB_CEIL, Math.max(1 - PROB_CEIL, raw)) : raw;
  return { pA: 1 - pB, pB, sd: (row.pm!.hi - row.pm!.lo) / (2 * 1.2816), lo: row.pm!.lo, hi: row.pm!.hi, capped: pB !== raw };
}
