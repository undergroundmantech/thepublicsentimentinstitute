// Combines one poll of civicAPI (one read per race type, through the caching proxy) with the last good read of each
// type. A type whose read fails keeps its previous races rather than dropping to "no votes", and the page is told the
// returns may be behind. Freshness is the proxy's own read time, never the browser clock, so a stale cache is visible
// and a read whose time is unknown is treated as stale rather than as fresh.
//
// What these times are: the proxy's read time is when On Point's server last fetched civicAPI (a RECEIPT time).
// civicAPI's race search carries no per-race "last changed" time, so there is no provider SOURCE time on the list
// reads; the single-race read has one (`updated`). The two are kept apart and neither is invented.
import type { CRace } from "./live";

export type TypeRead = { races: CRace[]; at: number | null };
export type GoodReads = Record<string, TypeRead>;
export type Merged = { good: GoodReads; races: CRace[]; failed: string[]; missing: string[]; oldest: number | null; stale: boolean; warning: string | null; /** race types whose read carried no provider-side read time */ untimed: string[] };

// ---- one set of clocks for every page -------------------------------------------------------------------------------
// The numbers below describe what the code actually does. They were out of step before: the browser polled every five
// minutes, the proxy cached for five minutes, returns were called stale after three, and the page text said "30 second
// cache". A healthy read could therefore be flagged stale, and the text promised a refresh rate nothing delivered.
// The cadence itself is unchanged here: polling civicAPI faster needs the provider's agreed rate limit, not a guess.
/** How often a page asks the proxy for returns. */
export const LIVE_POLL_MS = 5 * 60_000;
/** How long the proxy serves one civicAPI read before reading again (the routes' `revalidate` must match). */
export const PROXY_CACHE_MS = 5 * 60_000;
/** Returns older than this, by the proxy's own read time, are flagged as behind: one full poll plus one full cache
 *  window is the oldest a healthy read can be, plus a minute's grace. */
export const STALE_MS = LIVE_POLL_MS + PROXY_CACHE_MS + 60_000;
/** The cadence in words, for page text, so the text cannot drift from the numbers. */
export const CADENCE_TEXT = `checked every ${Math.round(LIVE_POLL_MS / 60_000)} minutes through a ${Math.round(PROXY_CACHE_MS / 60_000)} minute cache`;

const etTime = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";

/** One poll's results (a read or an Error per type) merged over the last good read of every type. Pure. */
export function mergeReads(prev: GoodReads, results: Record<string, TypeRead | Error>, now: number): Merged {
  const good: GoodReads = { ...prev }; const failed: string[] = []; const missing: string[] = [];
  for (const [t, r] of Object.entries(results)) {
    if (r instanceof Error) { failed.push(t); if (!prev[t]) missing.push(t); }
    else good[t] = { races: r.races, at: r.at };   // a read with no proxy time keeps `null`: the browser clock is never passed off as a provider read time
  }
  const used = Object.keys(results).filter((t) => good[t]);
  const races = used.flatMap((t) => good[t].races);
  const times = used.map((t) => good[t].at).filter((x): x is number => x != null);
  const oldest = times.length ? Math.min(...times) : null;
  const untimed = used.filter((t) => good[t].at == null);
  const stale = (oldest != null && now - oldest > STALE_MS) || untimed.length > 0;
  let warning: string | null = null;
  if (failed.length && !used.length) warning = "Live returns are not reachable right now; showing the forecast.";
  else if (missing.length) warning = "Some live returns could not be loaded; those races show only the forecast for now.";
  else if (failed.length && oldest != null) warning = `Some live returns could not be refreshed. Showing the last good read, from ${etTime(oldest)}; counts may be behind.`;
  else if (untimed.length) warning = "The time of the last civicAPI read is unknown for some returns; counts may be behind.";
  else if (stale && oldest != null) warning = `Live returns have not updated since ${etTime(oldest)}; counts may be behind.`;
  return { good, races, failed, missing, oldest: untimed.length ? null : oldest, stale, warning, untimed };
}
