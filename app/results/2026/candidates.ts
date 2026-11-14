// Candidate identity and REPORTED results. Pure: no fetch, no React, no clock.
//
// Three rules this file exists to enforce:
//   1. A candidate is a candidate, not a party. Identity is a stable id (the provider's when it sends one, else the
//      race plus the normalised full name). Party and caucus are labels on a candidate; changing or respelling a party
//      never changes who the candidate is, and two candidates of one party are never merged.
//   2. The reported margin is between the two candidates with the most counted votes, whoever they are, over ALL
//      counted candidate votes. A Democrat-minus-Republican margin is a separate, optional figure with its own
//      denominators.
//   3. Unknown is not zero. A missing count is null and never enters a total; fewer than two known counts means the
//      margin is UNAVAILABLE, not 0.
// Nothing here estimates anything. Forecasts and probabilities live elsewhere and are never mixed into these figures.
import type { CCand, XRace } from "./live";

// ---- party --------------------------------------------------------------------------------------------------------
/** Canonical party label. `IND` covers I / IND / Independent / NPA / unaffiliated. Blank is null, not "other". */
export type PartyCode = "D" | "R" | "IND" | "LIB" | "GRN" | "NP" | "OTH";
const squash = (s: string | null | undefined) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function partyCanon(raw: string | null | undefined): PartyCode | null {
  const s = squash(raw);
  if (!s) return null;
  if (s === "d" || s === "dfl" || s.startsWith("dem")) return "D";
  if (s === "r" || s === "gop" || s.startsWith("rep")) return "R";
  if (s === "i" || s === "ind" || s === "npa" || s === "una" || s.startsWith("indep") || s.startsWith("unaffil") || s.startsWith("no party")) return "IND";
  if (s === "l" || s === "lib" || s.startsWith("libert")) return "LIB";
  if (s === "g" || s === "grn" || s.startsWith("green")) return "GRN";
  if (s === "np" || s.startsWith("nonpartisan") || s.startsWith("non partisan")) return "NP";
  return "OTH";
}

// ---- identity -----------------------------------------------------------------------------------------------------
const SUFFIX = /^(jr|sr|ii|iii|iv|v)$/;
/** Normalised full name: accents, case, punctuation and generational suffixes removed. Middle initials are KEPT, so
 *  "Dan S. Sullivan" and "Dan J. Sullivan" stay two people. */
export function nameKey(name: string | null | undefined): string {
  const w = squash(name).split(" ").filter(Boolean);
  while (w.length > 1 && SUFFIX.test(w[w.length - 1])) w.pop();
  return w.join(" ");
}
const surname = (key: string) => key.split(" ").slice(-1)[0] ?? "";
const initial = (key: string) => key.charAt(0);
/** A line that is not one person: pooled write-ins, "Other", scattering. Never a leader's identity match target. */
export const isPooledLine = (name: string | null | undefined) => /^(other|others|write in|write ins|scattering|all others|other write in)\b/.test(squash(name)) || squash(name) === "";

/** Spelling crosswalk: normalised alias -> normalised canonical name. Supplied by the caller; empty by default. */
export type Aliases = Readonly<Record<string, string>>;
/**
 * Spellings the provider uses for candidates the forecast names differently, where the name alone cannot tell two
 * candidates apart. Alaska's 2026 Senate race has two Sullivans: civicAPI lists the senator as "Dan Sullivan" and the
 * other as "Daniel J. Jr. Sullivan"; the forecast has "Dan S. Sullivan" and "Dan J. Sullivan". Without this the
 * senator's votes match neither and the race's model figures mean nothing. A caller's own table wins over this one.
 */
export const DEFAULT_ALIASES: Aliases = { "dan sullivan": "dan s sullivan", "daniel j jr sullivan": "dan j sullivan", "daniel j sullivan": "dan j sullivan" };
const canonKey = (name: string | null | undefined, aliases?: Aliases) => { const k = nameKey(name); return aliases?.[k] ?? DEFAULT_ALIASES[k] ?? k; };

/** Stable candidate id. The provider's own id wins when present; otherwise the race id plus the canonical name key.
 *  Party is deliberately not part of it. */
export function candidateId(raceId: string | number, name: string | null | undefined, upstreamId?: string | number | null, aliases?: Aliases): string {
  if (upstreamId != null && String(upstreamId).trim() !== "") return `up:${String(upstreamId).trim()}`;
  return `${raceId}:${canonKey(name, aliases) || "unnamed"}`;
}

/**
 * Match provider candidates to forecast candidates by NAME, never by party.
 * Returns, for each provider candidate, the index of its forecast candidate or null, plus the provider indexes whose
 * match was ambiguous (same surname on either side and nothing better to go on). An ambiguous candidate is left
 * unmatched: it is never assigned to somebody on a guess.
 *   pass 1  exact normalised full name (after the alias crosswalk)
 *   pass 2  same surname and same first initial, unique on both sides
 *   pass 3  same surname, unique on both sides
 */
export function matchToForecast(forecastNames: readonly string[], providerNames: readonly string[], aliases?: Aliases): { match: (number | null)[]; ambiguous: number[] } {
  const fk = forecastNames.map((n) => (isPooledLine(n) ? "" : canonKey(n, aliases)));
  const pk = providerNames.map((n) => (isPooledLine(n) ? "" : canonKey(n, aliases)));
  const match: (number | null)[] = pk.map(() => null); const taken = new Set<number>(); const ambiguous = new Set<number>();
  for (let i = 0; i < pk.length; i++) { if (!pk[i]) continue; const j = fk.findIndex((k, jj) => k && k === pk[i] && !taken.has(jj)); if (j >= 0) { match[i] = j; taken.add(j); } }
  for (const test of [(a: string, b: string) => surname(a) === surname(b) && initial(a) === initial(b), (a: string, b: string) => surname(a) === surname(b)]) {
    const openP = pk.map((k, i) => (k && match[i] == null ? i : -1)).filter((i) => i >= 0);
    const openF = fk.map((k, j) => (k && !taken.has(j) ? j : -1)).filter((j) => j >= 0);
    const found: [number, number][] = [];
    for (const i of openP) {
      const js = openF.filter((j) => test(pk[i], fk[j]));
      if (js.length === 1) { const rivals = openP.filter((ii) => test(pk[ii], fk[js[0]])); if (rivals.length === 1) found.push([i, js[0]]); else ambiguous.add(i); }
      else if (js.length > 1) ambiguous.add(i);
    }
    for (const [i, j] of found) { match[i] = j; taken.add(j); ambiguous.delete(i); }
  }
  for (const i of [...ambiguous]) if (match[i] != null) ambiguous.delete(i);
  return { match, ambiguous: [...ambiguous].sort((a, b) => a - b) };
}

// ---- race rules ---------------------------------------------------------------------------------------------------
/**
 * How a race is decided. Only `plurality` is an ordinary "most votes wins" contest. The others are routed to their own
 * handling and are never forced through a two-party single-seat reading:
 *   measure          Yes / No against the measure's own threshold
 *   multi_seat       a chamber or board filling several seats: there is no single top-two margin
 *   ranked_choice    first-choice counts are reported; the winner is decided by later tabulation rounds
 *   majority_runoff  a leader below the majority bar goes to a runoff, so leading is not winning
 */
export type RaceRule = "plurality" | "measure" | "multi_seat" | "ranked_choice" | "majority_runoff";
/**
 * States whose November 3, 2026 election for these race kinds is not plain plurality. CONFIGURATION, explicit rather
 * than inferred. Reviewed against the law in force for this election on November 11, 2026:
 *   AK  ranked choice for federal and state offices (the repeal on the same ballot does not govern this election)
 *   ME  ranked choice for U.S. Senate and U.S. House only; the governor and legislature are plurality (the state
 *       constitution requires it; the court's advisory opinion of April 6, 2026 kept it so)
 *   GA  a majority is required in every general election; otherwise a runoff
 *   LA  U.S. House only, this year only: all-party primary on November 3, runoff December 12 without a majority
 */
export const RULE_REGISTRY: Readonly<Record<string, Partial<Record<XRace["k"], RaceRule>>>> = {
  AK: { sen: "ranked_choice", house: "ranked_choice", gov: "ranked_choice", state: "ranked_choice" },
  ME: { sen: "ranked_choice", house: "ranked_choice" },
  GA: { sen: "majority_runoff", gov: "majority_runoff", state: "majority_runoff", house: "majority_runoff" },
  // 2026 only: Act 7 moved Louisiana's U.S. House races to the November 3 all-party primary; without a majority the
  // top two meet on December 12. The Senate race had closed party primaries, so November 3 is a plurality general.
  LA: { house: "majority_runoff" },
};
export function raceRule(r: Pick<XRace, "k" | "st"> & { seats?: number; c?: XRace["c"] }): RaceRule {
  if (r.k === "measure") return "measure";
  if (r.k === "leg") return "multi_seat";
  if (r.k === "other" && (r.seats ?? 1) > 1) return "multi_seat";
  // a board elected two or more at a time: the forecast lists each party's slate as one line ("A and B")
  if ((r.k === "state" || r.k === "other") && (r.c ?? []).some((x) => / and /i.test(x[0]))) return "multi_seat";
  return RULE_REGISTRY[r.st]?.[r.k] ?? "plurality";
}

// ---- reported results ---------------------------------------------------------------------------------------------
export type ReportedInput = { name: string; party?: string | null; votes: number | null | undefined; winner?: boolean; id?: string | number | null };
export type ReportedCandidate = { id: string; name: string; partyRaw: string | null; party: PartyCode | null; votes: number | null; share: number | null; providerWinner: boolean; pooled: boolean };
export type ReportedStatus = "OK" | "NO_VOTES" | "UNAVAILABLE" | "NOT_APPLICABLE";
export type Reported = {
  rule: RaceRule;
  status: ReportedStatus;
  /** why the margin is not available, in words, when status is not OK */
  reason: string | null;
  candidates: ReportedCandidate[];          // known counts first, most votes first; unknown counts last
  /** sum of every KNOWN candidate count, pooled write-in lines included. The denominator of every share here. */
  totalVotes: number;
  knownCounts: number; unknownCounts: number;
  leader: ReportedCandidate | null; runnerUp: ReportedCandidate | null; tie: boolean;
  marginVotes: number | null;
  /** leader minus runner-up, in percentage points of ALL counted candidate votes */
  marginPp: number | null;
  /** Democrats minus Republicans, only when both parties have a known count. Sums every candidate of each party. */
  partyMargin: { dVotes: number; rVotes: number; ppOfAllVotes: number | null; ppOfTwoParty: number | null } | null;
  /** measures only */
  measure: { yes: number | null; no: number | null; yesShare: number | null; threshold: number; passing: boolean | null } | null;
  /** rule-specific warning the page must show next to the margin (first-choice counts, possible runoff) */
  caveat: string | null;
  providerWinner: ReportedCandidate | null;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * The reported state of one race from one provider snapshot. A pure function of that snapshot: a corrected (lower)
 * count is reported as corrected, nothing is smoothed or carried over from an earlier read.
 * Negative or non-finite counts are treated as unknown, never as votes.
 */
export function reported(raceId: string | number, cands: readonly ReportedInput[], opts: { rule?: RaceRule; threshold?: number; aliases?: Aliases } = {}): Reported {
  const rule = opts.rule ?? "plurality";
  const rows: ReportedCandidate[] = cands.map((c) => {
    const votes = isNum(c.votes) && c.votes >= 0 ? c.votes : null;
    return { id: candidateId(raceId, c.name, c.id, opts.aliases), name: c.name, partyRaw: c.party == null || String(c.party).trim() === "" ? null : String(c.party), party: partyCanon(c.party), votes, share: null, providerWinner: !!c.winner, pooled: isPooledLine(c.name) };
  });
  const known = rows.filter((x) => x.votes != null);
  const totalVotes = known.reduce((s, x) => s + (x.votes as number), 0);
  for (const x of known) x.share = totalVotes > 0 ? (100 * (x.votes as number)) / totalVotes : null;
  // stable order: votes descending, then the provider's own order
  const order = new Map(rows.map((x, i) => [x, i]));
  const sorted = [...known].sort((a, b) => (b.votes as number) - (a.votes as number) || (order.get(a) as number) - (order.get(b) as number));
  const candidates = [...sorted, ...rows.filter((x) => x.votes == null)];
  const base: Reported = { rule, status: "UNAVAILABLE", reason: null, candidates, totalVotes, knownCounts: known.length, unknownCounts: rows.length - known.length, leader: null, runnerUp: null, tie: false, marginVotes: null, marginPp: null, partyMargin: null, measure: null, caveat: null, providerWinner: rows.find((x) => x.providerWinner) ?? null };

  const d = known.filter((x) => x.party === "D"), rr = known.filter((x) => x.party === "R");
  if (rule !== "measure" && d.length && rr.length) {
    const dVotes = d.reduce((s, x) => s + (x.votes as number), 0), rVotes = rr.reduce((s, x) => s + (x.votes as number), 0);
    base.partyMargin = { dVotes, rVotes, ppOfAllVotes: totalVotes > 0 ? (100 * (dVotes - rVotes)) / totalVotes : null, ppOfTwoParty: dVotes + rVotes > 0 ? (100 * (dVotes - rVotes)) / (dVotes + rVotes) : null };
  }

  if (rule === "multi_seat") return { ...base, status: "NOT_APPLICABLE", reason: "Several seats are filled in this contest, so there is no single top-two margin." };

  if (rule === "measure") {
    const pick = (re: RegExp, code: string) => known.find((x) => re.test(squash(x.name)) || squash(x.partyRaw) === code);
    const y = pick(/^(yes|for|approve|approved)\b/, "y") ?? null, n = pick(/^(no|against|reject|rejected)\b/, "n") ?? null;
    const threshold = opts.threshold ?? 0.5;
    const yes = y?.votes ?? null, no = n?.votes ?? null;
    if (yes == null || no == null) return { ...base, measure: { yes, no, yesShare: null, threshold, passing: null }, reason: "A Yes and a No count are both needed." };
    const tot = yes + no;
    if (tot <= 0) return { ...base, status: "NO_VOTES", measure: { yes, no, yesShare: null, threshold, passing: null }, reason: "No votes are counted yet." };
    const yesShare = yes / tot; const lead = yes >= no ? y : n, trail = yes >= no ? n : y;
    return { ...base, status: "OK", leader: lead, runnerUp: trail, tie: yes === no, marginVotes: Math.abs(yes - no), marginPp: (100 * Math.abs(yes - no)) / tot, measure: { yes, no, yesShare, threshold, passing: threshold > 0.5 ? yesShare >= threshold : yesShare > 0.5 }, caveat: threshold > 0.5 ? `This measure needs ${(100 * threshold).toFixed(0)}% Yes to pass, not a simple majority.` : null };
  }

  if (known.length < 2) return { ...base, reason: known.length === 0 ? "No candidate has a reported count." : "Only one candidate has a reported count, so there is no margin to report." };
  const [a, b] = sorted;
  const out: Reported = { ...base, leader: a, runnerUp: b, tie: a.votes === b.votes, marginVotes: (a.votes as number) - (b.votes as number) };
  if (totalVotes <= 0) return { ...out, status: "NO_VOTES", leader: null, runnerUp: null, tie: false, marginVotes: null, reason: "No votes are counted yet." };
  out.status = "OK"; out.marginPp = (100 * (out.marginVotes as number)) / totalVotes;
  if (rule === "ranked_choice") out.caveat = "Ranked-choice contest: these are first-choice counts. The winner is decided by later tabulation rounds, so the first-choice leader may not win.";
  if (rule === "majority_runoff") out.caveat = (a.share ?? 0) > 50 ? null : "A majority is required here. The leader is below 50% of the counted vote, so a runoff is possible.";
  return out;
}

/** civicAPI's trimmed tuples read as reported input. The proxy fills a missing count with 0, so 0 here is "0 or not yet sent". */
export const fromCivic = (c: readonly CCand[]): ReportedInput[] => c.map((x) => ({ name: x[0], party: x[1], votes: x[2], winner: !!x[4] }));
/** The reported state of a forecast race from its civicAPI candidates, routed by the race's own rule. */
export const reportedFor = (r: XRace, c: readonly CCand[], aliases?: Aliases): Reported => reported(r.id, fromCivic(c), { rule: raceRule(r), threshold: r.thr, aliases });

// ---- the forecast's two principal sides ---------------------------------------------------------------------------
/**
 * The frozen pre-election forecast is a two-sided model: its expected margin `m`, its chance `pR` and every county
 * row are "side B minus side A". Those sides are CANDIDATES: the first two candidates the forecast lists, in its own
 * order (checked against the index: `m` equals c[1] minus c[0] over the total, and the county files sum to the same
 * two people). In an ordinary race that is the Democrat and the Republican, but it is Osborn (IND) v Ricketts in
 * Nebraska, Bodnar (IND) v Alme in Montana with the Democrat third, and Foulkes (D) v Block (I) in Rhode Island with
 * the Republican third. Reading the sides as party letters put those candidates' votes in the wrong column.
 *
 * `candidate` mode: side A is one named person and side B is one named person; everyone else is "other".
 * `party` mode is the fallback where the forecast does not name two different-party candidates (an unopposed seat, a
 * same-party general, a legislative district with a missing name) or the contest is ranked-choice, where the forecast
 * pools a party's candidates: side A is a party and side B is Republicans, pooled, as before.
 */
export type Principals =
  | { mode: "candidate"; a: { i: number; name: string; party: PartyCode | null }; b: { i: number; name: string; party: PartyCode | null }; names: string[] }
  | { mode: "party"; aParty: PartyCode; bParty: "R"; names: string[] };

export function principals(r: Pick<XRace, "k" | "st" | "c">): Principals {
  const list = r.c ?? []; const names = list.map((x) => x[0]);
  const real = list.map((x, i) => ({ i, name: x[0], party: partyCanon(x[1]) })).filter((x) => !isPooledLine(x.name) && x.party !== null);
  // party mode keeps the old reading: side A is Democrats, or independents where the forecast leads with one
  const partyMode = (): Principals => ({ mode: "party", aParty: real[0]?.party === "IND" ? "IND" : "D", bParty: "R", names });
  const rule = raceRule(r);
  if (rule === "ranked_choice" || rule === "multi_seat" || real.length < 2) return partyMode();
  let [a, b] = real;
  if (!nameKey(a.name) || !nameKey(b.name) || a.party === b.party) return partyMode();
  if (a.party === "R") [a, b] = [b, a];            // the site's sign convention: a Republican principal is always side B
  return { mode: "candidate", a, b, names };
}

export type SideSplit = { a: number; b: number; o: number; t: number; ambiguous: number; sameParty: number };
export type SideKey = "a" | "b" | "o";
export type SideAssignment = {
  /** side of each provider candidate, in the provider's order */
  side: SideKey[];
  /** index of the forecast candidate each provider candidate is (by name), or null */
  forecast: (number | null)[];
  /** provider candidates that could not be told apart from another by name: always "o", never guessed onto a side */
  ambiguous: boolean[];
  /** provider candidates counted for a side through major-party pooling rather than a name match */
  pooled: boolean[];
};

/** Which of the forecast's sides each provider candidate belongs to. Names decide; see `principals`. */
export function assignSides(r: Pick<XRace, "k" | "st" | "c">, cands: readonly (readonly [string, string, ...unknown[]])[], aliases?: Aliases): SideAssignment {
  const n = cands.length; const side: SideKey[] = new Array(n).fill("o"); const pooled: boolean[] = new Array(n).fill(false);
  if (r.k === "measure") {
    cands.forEach(([name, party], i) => { const nm = squash(name), p = squash(party); side[i] = /^(yes|for)\b/.test(nm) || p === "y" || p === "yes" ? "a" : /^(no|against)\b/.test(nm) || p === "n" || p === "no" ? "b" : "o"; });
    return { side, forecast: new Array(n).fill(null), ambiguous: new Array(n).fill(false), pooled };
  }
  const pr = principals(r);
  const { match, ambiguous: amb } = matchToForecast(pr.names, cands.map((x) => x[0]), aliases);
  const ambiguous = cands.map((_, i) => amb.includes(i));
  if (pr.mode === "party") {
    // pooled by party. A candidate the forecast names carries the party the FORECAST gives them (the provider may
    // list the same person as "Nonpartisan"); anyone else carries the provider's label.
    cands.forEach(([, party], i) => {
      const p = match[i] != null ? partyCanon(r.c?.[match[i] as number]?.[1]) : partyCanon(party);
      side[i] = p === pr.aParty ? "a" : p === "R" ? "b" : "o";
    });
    return { side, forecast: match, ambiguous: ambiguous.map((x, i) => x && side[i] === "o"), pooled };
  }
  cands.forEach((_, i) => { side[i] = match[i] === pr.a.i ? "a" : match[i] === pr.b.i ? "b" : "o"; });
  // Major-party pooling, the one place a party label is used: a provider candidate the forecast does not name, who
  // carries the same MAJOR party (D or R) as a principal, is counted with that principal. It covers a respelt name
  // and fields with several candidates of one party (Louisiana), where the forecast's side is really "the party's
  // seat". Those candidates are flagged `pooled` so a page can say the field differs from the forecast. It never
  // applies to independents or minor parties: they are counted for a side only when matched by name.
  cands.forEach((x, i) => {
    if (match[i] != null || ambiguous[i] || isPooledLine(x[0])) return;
    const p = partyCanon(x[1]); if (p !== "D" && p !== "R") return;
    const key = pr.a.party === p ? "a" : pr.b.party === p ? "b" : null; if (!key) return;
    pooled[i] = side.includes(key); side[i] = key;
  });
  return { side, forecast: match, ambiguous, pooled };
}

/** Provider candidates split into the forecast's side A, side B and everyone else. `ambiguous` is the number of votes
 *  whose candidate could not be told apart from another by name; they are in `o`, never guessed onto a side.
 *  `sameParty` is the number of votes counted for a side through major-party pooling rather than a name match. */
export function splitSides(r: Pick<XRace, "k" | "st" | "c">, c: readonly CCand[], aliases?: Aliases): SideSplit {
  const as = assignSides(r, c, aliases); let a = 0, b = 0, o = 0, amb = 0, same = 0;
  c.forEach((x, i) => { const v = x[2]; if (as.side[i] === "a") a += v; else if (as.side[i] === "b") b += v; else o += v; if (as.ambiguous[i]) amb += v; if (as.pooled[i]) same += v; });
  return { a, b, o, t: a + b + o, ambiguous: amb, sameParty: same };
}

/** The forecast's own expected votes for side A, side B and everyone else. */
export function expectedSides(r: Pick<XRace, "k" | "st" | "c">): { a: number; b: number; o: number; t: number } {
  let a = 0, b = 0, o = 0; const list = r.c ?? [];
  if (r.k === "measure") { for (const [, p, v] of list) { if (p === "Y") a += v; else if (p === "N") b += v; else o += v; } return { a, b, o, t: a + b + o }; }
  const pr = principals(r);
  list.forEach(([, p, v], i) => {
    if (pr.mode === "candidate") { if (i === pr.a.i) a += v; else if (i === pr.b.i) b += v; else o += v; }
    else { const pc = partyCanon(p); if (pc === pr.aParty) a += v; else if (pc === "R") b += v; else o += v; }
  });
  return { a, b, o, t: a + b + o };
}

/** One-letter tags for the two sides, for labels such as "I +2.0". Side B is "R" unless the forecast's second principal is not a Republican. */
export function sideTags(r: Pick<XRace, "k" | "st" | "c">): { a: string; b: string } {
  if (r.k === "measure") return { a: "Yes", b: "No" };
  const letter = (p: PartyCode | null) => (p === "D" ? "D" : p === "R" ? "R" : p === "IND" ? "I" : p === "LIB" ? "L" : p === "GRN" ? "G" : "O");
  const pr = principals(r);
  return pr.mode === "candidate" ? { a: letter(pr.a.party), b: letter(pr.b.party) } : { a: letter(pr.aParty), b: "R" };
}

/** The two sides as people, for headings and labels: the forecast's principal candidates where it names them. */
export function sideNames(r: Pick<XRace, "k" | "st" | "c">): { a: { name: string; party: string; tag: string }; b: { name: string; party: string; tag: string } } {
  const t = sideTags(r);
  if (r.k === "measure") return { a: { name: "Yes", party: "Y", tag: t.a }, b: { name: "No", party: "N", tag: t.b } };
  const pr = principals(r); const list = r.c ?? [];
  const generic = (tag: string) => (tag === "D" ? "Democrat" : tag === "R" ? "Republican" : tag === "I" ? "Independent" : "Other");
  if (pr.mode === "candidate") return { a: { name: pr.a.name, party: list[pr.a.i][1], tag: t.a }, b: { name: pr.b.name, party: list[pr.b.i][1], tag: t.b } };
  const first = (code: PartyCode) => list.find((x) => !isPooledLine(x[0]) && partyCanon(x[1]) === code);
  const A = first(pr.aParty), B = first("R");
  return { a: { name: A?.[0] || generic(t.a), party: A?.[1] ?? t.a, tag: t.a }, b: { name: B?.[0] || generic(t.b), party: B?.[1] ?? t.b, tag: t.b } };
}
