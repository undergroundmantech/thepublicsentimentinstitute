// Combines one poll of civicAPI (one read per race type, through the caching proxy) with the last good read of each
// type. A type whose read fails keeps its previous races rather than dropping to "no votes", and the page is told the
// returns may be behind. Freshness is the proxy's own read time, not the browser clock, so a stale cache is visible.
import type { CRace } from "./live";

export type TypeRead = { races: CRace[]; at: number | null };
export type GoodReads = Record<string, TypeRead>;
export type Merged = { good: GoodReads; races: CRace[]; failed: string[]; missing: string[]; oldest: number | null; stale: boolean; warning: string | null };

/** Returns older than this, by the proxy's read time, are flagged as possibly behind. Three missed one-minute polls. */
export const STALE_MS = 3 * 60_000;

const etTime = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";

/** One poll's results (a read or an Error per type) merged over the last good read of every type. Pure. */
export function mergeReads(prev: GoodReads, results: Record<string, TypeRead | Error>, now: number): Merged {
  const good: GoodReads = { ...prev }; const failed: string[] = []; const missing: string[] = [];
  for (const [t, r] of Object.entries(results)) {
    if (r instanceof Error) { failed.push(t); if (!prev[t]) missing.push(t); }
    else good[t] = { races: r.races, at: r.at ?? now };
  }
  const used = Object.keys(results).filter((t) => good[t]);
  const races = used.flatMap((t) => good[t].races);
  const times = used.map((t) => good[t].at).filter((x): x is number => x != null);
  const oldest = times.length ? Math.min(...times) : null;
  const stale = oldest != null && now - oldest > STALE_MS;
  let warning: string | null = null;
  if (failed.length && !used.length) warning = "Live returns are not reachable right now; showing the forecast.";
  else if (missing.length) warning = "Some live returns could not be loaded; those races show only the forecast for now.";
  else if (failed.length && oldest != null) warning = `Some live returns could not be refreshed. Showing the last good read, from ${etTime(oldest)}; counts may be behind.`;
  else if (stale && oldest != null) warning = `Live returns have not updated since ${etTime(oldest)}; counts may be behind.`;
  return { good, races, failed, missing, oldest, stale, warning };
}
