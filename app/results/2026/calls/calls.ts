// The calls board's rules, pure and unit-tested. Three states only, and a probability is never a call:
//   official   civicAPI marks a candidate the winner
//   projected  On Point's own estimate (published forecast + counted vote), labelled as ours, never as a call
//   uncalled   everything else, including races with no civicAPI match
import type { CRace, Kind, XRace } from "../live";

export type CallState = "official" | "projected" | "uncalled";
export type Chamber = "sen" | "house" | "gov" | "state" | "measure" | "leg" | "other";
export type Party = "D" | "R" | "O";

export const CHAMBER_LABEL: Record<Chamber, string> = { sen: "Senate", house: "House", gov: "Governor", state: "Statewide offices", measure: "Ballot measures", leg: "State legislatures", other: "Other" };
export const chamberOf = (k: Kind): Chamber => k;

/** Party bucket for a civicAPI party label or a one-letter code. Yes/No measures have no party. */
export function partyOf(p: string | null | undefined): Party | null {
  const s = String(p ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "d" || s.startsWith("dem")) return "D";
  if (s === "r" || s.startsWith("rep") || s === "gop") return "R";
  if (s === "y" || s === "n" || s === "yes" || s === "no") return null;
  return "O";
}

export type Proj = { name: string; party: string; side: "A" | "B" };
export type CallRow = {
  r: XRace; c: CRace | undefined; state: CallState;
  winner: { name: string; party: string | null } | null;
  source: string; reporting: number | null; counting: boolean;
};

/** The state of one race. `proj` is only honoured when civicAPI has not called it; it is the caller's own estimate. */
export function callRow(r: XRace, c: CRace | undefined, proj: Proj | null | undefined): CallRow {
  const won = c?.c.find((x) => x[4]);
  const counting = !!c && (c.pr > 0 || c.c.some((x) => x[2] > 0));
  const reporting = c ? (counting ? c.pr : null) : null;
  if (won) return { r, c, state: "official", winner: { name: won[0], party: won[1] || null }, source: "civicAPI", reporting, counting };
  if (proj) return { r, c, state: "projected", winner: { name: proj.name, party: proj.party }, source: "On Point projection (not an official call)", reporting, counting };
  return { r, c, state: "uncalled", winner: null, source: c ? "civicAPI: not called" : "No civicAPI match yet", reporting, counting };
}

export type Filters = { chamber: Chamber | "all"; st: string | "all"; party: Party | "all"; state: CallState | "all" };

export function passes(row: CallRow, f: Filters): boolean {
  if (f.chamber !== "all" && row.r.k !== f.chamber) return false;
  if (f.st !== "all" && row.r.st !== f.st) return false;
  if (f.state !== "all" && row.state !== f.state) return false;
  if (f.party !== "all") { if (!row.winner) return false; if (partyOf(row.winner.party) !== f.party) return false; }
  return true;
}

const ORDER: Record<CallState, number> = { official: 0, projected: 1, uncalled: 2 };
/** Calls first (official, then ours), then the races closest to a call: most votes in. */
export const sortRows = (rows: CallRow[]) =>
  [...rows].sort((a, b) => ORDER[a.state] - ORDER[b.state] || (b.reporting ?? -1) - (a.reporting ?? -1) || a.r.st.localeCompare(b.r.st) || a.r.nm.localeCompare(b.r.nm));

export const STALE_MS = 5 * 60_000;
/** A read is stale when a feed failed or the oldest data is older than STALE_MS. */
export const isStale = (liveStale: boolean, at: Date | null, now: number) => liveStale || (at != null && now - at.getTime() > STALE_MS);
