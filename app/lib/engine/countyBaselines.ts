// County forecasts as the engine's unit baselines. The site's county file (public/forecast/counties.json) lists, for
// each Senate and governor's race, every county's forecast: FIPS -> [margin, side A votes, side B votes, total votes],
// A and B being the race's two principals in the order of the results index. Pure: the caller reads the file.
import type { XIndex } from "../../results/2026/live";
import { expectedSides } from "../../results/2026/candidates";
import type { CountyContext } from "./snapshot";

type CountyFile = Record<string, unknown>;
/** How far a race's county forecasts may sum from the race's own forecast before they are not used. */
export const BASELINE_TOLERANCE = 0.02;

export function countyContext(file: CountyFile, index: XIndex, kinds: string[] = ["sen", "gov"]): CountyContext {
  const names = (file._n ?? {}) as Record<string, string>; const baselines: CountyContext["baselines"] = {};
  for (const r of index.races) {
    if (!kinds.includes(r.k)) continue;
    const rows = file[r.id] as Record<string, [number, number, number, number]> | undefined; if (!rows || typeof rows !== "object") continue;
    const b: Record<string, readonly [number, number, number, number]> = {}; let A = 0, B = 0, T = 0;
    for (const [fips, v] of Object.entries(rows)) {
      if (!Array.isArray(v) || !(v[3] > 0)) continue;
      const a = Math.max(0, v[1]), bb = Math.max(0, v[2]), t = Math.max(v[3], a + bb);
      b[fips] = [a, bb, t - a - bb, t]; A += a; B += bb; T += t;
    }
    // the counties must add up to the race's own forecast, side by side
    const es = expectedSides(r), ea = es.a, eb = es.b, et = es.t;
    const near = (x: number, y: number) => y > 0 && Math.abs(x - y) <= BASELINE_TOLERANCE * y;
    if (T > 0 && near(T, et) && near(A, ea) && near(B, eb)) baselines[r.id] = b;
  }
  return { baselines, names };
}
