// The small arithmetic the seat panels and the tallies share. Pure (no React), so it can be unit-tested.
import { sides, type CRace, type XRace } from "../2026/live";

export const hasReturns = (c?: CRace) => !!c && (c.pr > 0 || c.c.some((x) => x[2] > 0));
export const liveMargin = (r: XRace, c: CRace | undefined) => { if (!c) return null; const s = sides(r, c.c); return s.t > 0 ? (100 * (s.b - s.a)) / s.t : null; };
export const expM = (r: XRace) => (r.k === "measure" ? (r.yes != null ? 100 - 2 * r.yes : null) : r.m ?? null);
