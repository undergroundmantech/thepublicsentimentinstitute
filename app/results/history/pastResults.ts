// Past statewide results by county, 2018 to 2024: the shapes of public/results/history/<ST>.json and the arithmetic
// the pages do with them (shares, margins, the shift from one election to another). Pure, so it can be unit-tested.
//
// The files are built by scripts/history/build_past_results.py from the MIT Election Data and Science Lab's returns.
// A contest's two sides are its two leading candidates statewide: side A is the Democrat (or whoever is not the
// Republican), side B the Republican (or the other). A margin is side B minus side A in points of the total vote, so
// it is negative where A leads: the same sign as every margin on the results pages (D negative, R positive).

export type Office = "P" | "S" | "G";
/** [side A votes, side B votes, all votes] */
export type Counts = [number, number, number];
export type Contest = {
  y: number; o: Office; /** a special election (kept only where the state had no regular one that year) */ sp: boolean;
  a: [name: string, party: string] | null; b: [name: string, party: string] | null;
  tot: Counts; /** both leading candidates are of one party: no partisan shift is drawn from it */ same: boolean;
  /** the source covers only this many of the state's counties: [covered, all]. The statewide total is not the result. */
  part?: [number, number];
  /** the source has no usable county returns for this contest: only the statewide line, from its statewide file */
  nocty?: boolean;
  c: Record<string, Counts>;
};
export type StateHistory = { v: 1; st: string; source: string; names: Record<string, string>; contests: Contest[] };

export const OFFICE_NAME: Record<Office, string> = { P: "President", S: "U.S. Senate", G: "Governor" };
export const OFFICE_SHORT: Record<Office, string> = { P: "Pres.", S: "Senate", G: "Gov." };
export const contestKey = (c: Pick<Contest, "y" | "o">) => `${c.y}${c.o}`;
export const contestLabel = (c: Pick<Contest, "y" | "o" | "sp">, short = false) => `${c.y} ${(short ? OFFICE_SHORT : OFFICE_NAME)[c.o]}${c.sp ? " (special)" : ""}`;

/** Side B minus side A, in points of the total vote. Null with no votes. */
export const marginOf = (x: Counts | null | undefined): number | null => (x && x[2] > 0 ? (100 * (x[1] - x[0])) / x[2] : null);
export const shareOf = (x: Counts | null | undefined, side: 0 | 1): number | null => (x && x[2] > 0 ? (100 * x[side]) / x[2] : null);

const letter = (p: string | undefined) => (p === "D" || p === "R" ? p : p === "I" || p === "O" || p === "N" ? "I" : p ? p[0] : "");
/** "D+4.2", "R+11.0", "Even"; for a contest between two candidates of one party, the leader's surname. */
export function marginText(m: number | null, c?: Pick<Contest, "a" | "b" | "same">, digits = 1): string {
  if (m == null || !Number.isFinite(m)) return "—";
  if (Math.abs(m) < 0.05) return "Even";
  const lead = m < 0 ? c?.a : c?.b;
  const tag = c?.same ? surname(lead?.[0] ?? "") : c ? letter(lead?.[1]) || (m < 0 ? "D" : "R") : m < 0 ? "D" : "R";
  return `${tag}${c?.same ? " " : ""}+${Math.abs(m).toFixed(digits)}`;
}
export const surname = (n: string) => n.split(/\s+/).filter((w) => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(w)).pop() ?? n;

/**
 * The shift from one contest to another: the later margin minus the earlier one, so negative is a move toward side A
 * (the Democrat) and positive toward side B (the Republican). Null where either has no votes, or where either contest
 * is between two candidates of one party (no partisan reading).
 */
export function shiftOf(now: Counts | null | undefined, then: Counts | null | undefined, nowC?: Pick<Contest, "same">, thenC?: Pick<Contest, "same">): number | null {
  if (nowC?.same || thenC?.same) return null;
  const a = marginOf(now), b = marginOf(then);
  return a == null || b == null ? null : a - b;
}
export function shiftText(s: number | null, digits = 1): string {
  if (s == null || !Number.isFinite(s)) return "—";
  if (Math.abs(s) < 0.05) return "No shift";
  return `${s < 0 ? "D" : "R"}+${Math.abs(s).toFixed(digits)}`;
}
/** The change in votes cast, in percent of the earlier total. */
export const turnoutChange = (now: Counts | null | undefined, then: Counts | null | undefined): number | null => (now && then && then[2] > 0 ? (100 * (now[2] - then[2])) / then[2] : null);

/** The contest to compare a given one with by default: the one before it for the same office, else the nearest earlier contest that reads as two parties. */
export function defaultBaseline(h: StateHistory, of: Pick<Contest, "y" | "o">): Contest | null {
  const earlier = h.contests.filter((c) => c.y < of.y && !c.same && !c.part && !c.nocty);
  return earlier.filter((c) => c.o === of.o).sort((a, b) => b.y - a.y)[0] ?? earlier.sort((a, b) => b.y - a.y || "PSG".indexOf(a.o) - "PSG".indexOf(b.o))[0] ?? null;
}
/** Contests newest first, President before Senate before Governor within a year. */
export const ordered = (h: StateHistory): Contest[] => [...h.contests].sort((a, b) => b.y - a.y || "PSG".indexOf(a.o) - "PSG".indexOf(b.o));

/** Every county in the file, with its name, in name order. The statewide stand-in row (a code ending 000) goes last. */
export function counties(h: StateHistory): { fips: string; name: string; whole: boolean }[] {
  const ids = new Set<string>(); for (const c of h.contests) for (const f of Object.keys(c.c)) ids.add(f);
  return [...ids].map((fips) => ({ fips, name: h.names[fips] || fips, whole: fips.endsWith("000") })).sort((a, b) => Number(a.whole) - Number(b.whole) || a.name.localeCompare(b.name));
}

/** A background tint for a margin cell: blue for side A, red for side B, deeper with the size of the lead (full at 40 points). */
export function marginTint(m: number | null, same = false): string {
  if (m == null || same) return "transparent";
  const a = Math.min(1, Math.abs(m) / 40) * 0.5 + 0.06;
  return m < 0 ? `rgba(61,123,255,${a.toFixed(3)})` : `rgba(255,59,92,${a.toFixed(3)})`;
}

export const CITATION = "MIT Election Data and Science Lab, precinct-level and county-level election returns, 2018 to 2024 (Harvard Dataverse), added up to counties by On Point Politics.";

// ---- a past election on the map ----
/** How a map set to a past election is shaded: as it voted then, the shift since, or votes cast now against then. */
export type PastView = "then" | "shift" | "turnout";
export const PAST_VIEW_LABEL: Record<PastView, string> = { then: "As it voted", shift: "Shift since", turnout: "Turnout" };
/** A contest without its counties: the statewide line kept in public/results/history/states.json for the national map. */
export type StateContest = Omit<Contest, "c">;
export type StatesHistory = { v: 1; source: string; states: Record<string, StateContest[]> };

/** Votes counted now as a percentage of all votes cast then (100 = the same number of votes). */
export const turnoutShare = (now: Counts | null | undefined, then: Counts | null | undefined): number | null => (now && then && then[2] > 0 ? (100 * now[2]) / then[2] : null);
export function turnoutText(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct >= 99.5 && pct < 100.5 ? "100" : pct.toFixed(pct < 10 ? 1 : 0)}%`;
}
/** A fill for a shift: blue toward side A, red toward side B, full at 20 points. */
export const SHIFT_FULL = 20, TURNOUT_FULL = 40;
export function shiftTint(s: number | null, colors: [string, string] = ["61,123,255", "255,59,92"]): string | null {
  if (s == null || !Number.isFinite(s)) return null;
  return `rgba(${s <= 0 ? colors[0] : colors[1]},${(0.16 + 0.8 * Math.min(1, Math.abs(s) / SHIFT_FULL)).toFixed(3)})`;
}
/** A fill for votes now against votes then: amber for fewer, teal for more, full at 40% fewer or more. */
export function turnoutTint(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  return `rgba(${pct < 100 ? "231,121,74" : "47,191,155"},${(0.3 + 0.68 * Math.min(1, Math.abs(pct - 100) / TURNOUT_FULL)).toFixed(3)})`;
}
/** The contests a map can be set to: those that read as two parties and cover the whole state, newest first. */
export const mapContests = <T extends Pick<Contest, "y" | "o" | "same" | "part">>(list: T[]): T[] =>
  list.filter((c) => !c.same && !c.part).sort((a, b) => b.y - a.y || "PSG".indexOf(a.o) - "PSG".indexOf(b.o));
/** Every election the national map can be set to, from the statewide lines of all states, newest first. Specials go by their year and office. */
export function nationalContests(h: StatesHistory): { key: string; label: string; states: number }[] {
  const n: Record<string, { y: number; o: Office; states: number }> = {};
  for (const list of Object.values(h.states)) for (const k of new Set(mapContests(list).map((c) => contestKey(c)))) { const c = list.find((x) => contestKey(x) === k)!; (n[k] ??= { y: c.y, o: c.o, states: 0 }).states++; }
  return Object.entries(n).sort(([, a], [, b]) => b.y - a.y || "PSG".indexOf(a.o) - "PSG".indexOf(b.o)).map(([key, c]) => ({ key, label: `${c.y} ${OFFICE_NAME[c.o]}`, states: c.states }));
}
/** A state's contest for a map key. Where a state held both a regular and a special election that year, the regular one. */
export const contestFor = <T extends Pick<Contest, "y" | "o" | "sp" | "same" | "part">>(list: T[] | null | undefined, key: string | null): T | null =>
  (key && list ? mapContests(list).filter((c) => contestKey(c) === key).sort((a, b) => Number(a.sp) - Number(b.sp))[0] : null) ?? null;
/** The office letter a 2026 race is compared by: the same office last time where there is one. */
export const officeOfKind = (k: string): Office | null => (k === "sen" ? "S" : k === "gov" ? "G" : null);
/** The election a map opens on for a state: this office the last time it was up, else the 2024 presidential vote, else the newest. */
export function defaultMapKey<T extends Pick<Contest, "y" | "o" | "sp" | "same" | "part">>(list: T[], kind: string): string | null {
  const ok = mapContests(list), o = officeOfKind(kind);
  const c = (o ? ok.find((x) => x.o === o) : null) ?? ok.find((x) => x.o === "P") ?? ok[0];
  return c ? contestKey(c) : null;
}
/**
 * Whether a 2026 race's two sides read as a Democrat (or a Democratic-aligned independent) against a Republican, in
 * that order: the only case in which its margin can be set against a past election's as a partisan shift.
 */
export const twoPartySides = (parties: (string | undefined)[]): boolean => (parties[0] === "D" || parties[0] === "I" || parties[0] === "IND") && parties[1] === "R";
