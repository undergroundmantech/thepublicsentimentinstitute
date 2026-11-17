// The Calls Desk table, pure and unit-tested: one row per race with its call, its count and the model's read of it.
// The desk does not make calls. A race is "called" only when On Point has called it (the winner flag the pages carry,
// useLive.ts); everything else is sorted into plain-language groups from the count alone.
import type { CRace, Kind, XRace } from "../live";

/** called: On Point has called it. close: enough of the vote is in and the lead is under CLOSE_MARGIN points.
 *  counting: enough of the vote is in, the lead is wider, and the race is not called yet (the count, or a ranked-choice
 *  tabulation, is still to finish). early: votes are in, too few to say. waiting: no votes yet. */
export type TrackStatus = "called" | "close" | "counting" | "early" | "waiting";
export const TRACK_LABEL: Record<TrackStatus, string> = { called: "Called", close: "Too close to call", counting: "Still counting", early: "Too early to call", waiting: "No votes yet" };
export const TRACK_ORDER: TrackStatus[] = ["called", "close", "counting", "early", "waiting"];

/** The share counted (as civicAPI reports it) from which a race is judged on its lead; a lead under CLOSE_MARGIN points is too close. */
export const CLOSE_MIN_PCT = 35, CLOSE_MARGIN = 5;
export function trackStatus(x: { called: boolean; votes: number; pct: number | null; margin: number | null }): TrackStatus {
  if (x.called) return "called";
  if (!(x.votes > 0)) return "waiting";
  // (a provider that lists no percent reporting for a race with votes in is judged on its lead)
  const pct = x.pct == null || x.pct === 0 ? 100 : x.pct;
  if (pct < CLOSE_MIN_PCT) return "early";
  return x.margin != null && x.margin < CLOSE_MARGIN ? "close" : "counting";
}

export type Who = { name: string; party: string | null };
/** What the model adds to a row: the leader's chance, and the projected final margin with its 80% range. `pre` marks
 *  the pre-election forecast (no live model on the page). */
export type ModelRead = { prob: number | null; probOf: Who | null; proj: { of: Who; mean: number; lo: number | null; hi: number | null } | null; pre: boolean };
export type TrackRow = {
  r: XRace; status: TrackStatus;
  /** the called winner, and when On Point called it */
  winner: Who | null; calledAt: string | null;
  /** the count as it stands: who leads, by how many points, over whom */
  leader: Who | null; second: Who | null; margin: number | null; leadShare: number | null;
  /** share counted (the provider's figure) and all votes counted */
  pct: number | null; votes: number;
  model: ModelRead | null;
};

const who = (c: [string, string, ...unknown[]]): Who => ({ name: c[0], party: c[1] || null });
export function trackRow(r: XRace, c: CRace | undefined, calledAt: string | null, model: ModelRead | null): TrackRow {
  const by = c ? [...c.c].sort((a, b) => b[2] - a[2]) : [];
  const votes = by.reduce((s, x) => s + (x[2] || 0), 0);
  const won = c?.c.find((x) => x[4]);
  const lead = votes > 0 ? by[0] : undefined, sec = votes > 0 ? by[1] : undefined;
  const margin = lead ? (sec ? (100 * (lead[2] - sec[2])) / votes : 100) : null;
  const pct = c && votes > 0 ? c.pr : null;
  return {
    r, status: trackStatus({ called: !!won, votes, pct, margin }), winner: won ? who(won) : null, calledAt: won ? calledAt : null,
    leader: lead ? who(lead) : null, second: sec && sec[2] > 0 ? who(sec) : null, margin, leadShare: lead ? (100 * lead[2]) / votes : null, pct, votes, model,
  };
}

export type OfficeTab = "all" | "sen" | "house" | "gov" | "state" | "measure" | "other";
export const OFFICE_TABS: [OfficeTab, string][] = [["all", "All races"], ["sen", "Senate"], ["house", "House"], ["gov", "Governor"], ["state", "Statewide offices"], ["measure", "Ballot measures"], ["other", "Courts and other"]];
export const officeOf = (k: Kind): OfficeTab => (k === "sen" || k === "house" || k === "gov" || k === "state" || k === "measure" ? k : "other");

export type TrackFilter = { office: OfficeTab; status: TrackStatus | "all"; st: string | "all"; q: string };
export function trackPasses(x: TrackRow, f: TrackFilter): boolean {
  if (f.office !== "all" && officeOf(x.r.k) !== f.office) return false;
  if (f.status !== "all" && x.status !== f.status) return false;
  if (f.st !== "all" && x.r.st !== f.st) return false;
  const q = f.q.trim().toLowerCase();
  return !q || `${x.r.nm} ${x.r.st} ${x.winner?.name ?? ""} ${x.leader?.name ?? ""} ${x.second?.name ?? ""}`.toLowerCase().includes(q);
}

export type SortKey = "race" | "status" | "leader" | "margin" | "pct" | "votes" | "prob" | "proj" | "called";
const OFFICE_RANK: Record<OfficeTab, number> = { all: 0, sen: 1, gov: 2, house: 3, state: 4, measure: 5, other: 6 };
const natural = (a: TrackRow, b: TrackRow) => OFFICE_RANK[officeOf(a.r.k)] - OFFICE_RANK[officeOf(b.r.k)] || a.r.nm.localeCompare(b.r.nm, "en", { numeric: true }) || a.r.id.localeCompare(b.r.id);
/** Sorted rows. Rows without the sorted value always go last, whichever way the column is sorted. */
export function trackSort(rows: TrackRow[], key: SortKey, dir: 1 | -1): TrackRow[] {
  const num = (f: (x: TrackRow) => number | null | undefined) => (a: TrackRow, b: TrackRow) => {
    const x = f(a), y = f(b); if (x == null && y == null) return natural(a, b); if (x == null) return 1; if (y == null) return -1; return dir * (x - y) || natural(a, b);
  };
  const cmp: Record<SortKey, (a: TrackRow, b: TrackRow) => number> = {
    race: (a, b) => dir * natural(a, b),
    status: (a, b) => dir * (TRACK_ORDER.indexOf(a.status) - TRACK_ORDER.indexOf(b.status)) || natural(a, b),
    leader: (a, b) => { const x = (a.winner ?? a.leader)?.name, y = (b.winner ?? b.leader)?.name; if (!x && !y) return natural(a, b); if (!x) return 1; if (!y) return -1; return dir * x.localeCompare(y) || natural(a, b); },
    margin: num((x) => x.margin), pct: num((x) => x.pct), votes: num((x) => (x.votes > 0 ? x.votes : null)),
    prob: num((x) => x.model?.prob), proj: num((x) => x.model?.proj?.mean),
    called: num((x) => (x.calledAt ? Date.parse(x.calledAt) : null)),
  };
  return [...rows].sort(cmp[key]);
}
/** How many rows are in each status, for the filter buttons. */
export function trackCounts(rows: TrackRow[]): Record<TrackStatus | "all", number> {
  const n = { all: rows.length, called: 0, close: 0, counting: 0, early: 0, waiting: 0 };
  for (const x of rows) n[x.status]++;
  return n;
}
