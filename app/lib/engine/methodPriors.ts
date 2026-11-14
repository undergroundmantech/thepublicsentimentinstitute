// Vote-method priors: for a state, the expected share of ballots cast by each method and how far each method's margin
// sits from the state's overall margin. OFF by default (ONPOINT_METHOD_PRIORS=on to try them), for two reasons:
//   1. civicAPI labels no batch by method, so on election night every unit is UNKNOWN anyway;
//   2. the only evidence in the repository is one or two past elections per state (MEDSL precinct returns compiled
//      in data/intelligence/research), marked LOW confidence and "not validated for adjustment". A past year is
//      context, not a forecast of 2026; the spreads below are deliberately wide.
// A prior is used only for a race whose two principals are a Democrat and a Republican (the history is D v R), and
// only for a unit whose counted votes the provider has labelled by method. Nothing is inferred from report times.
import type { VotingMethod } from "./types";

export type MethodPrior = {
  method: Exclude<VotingMethod, "UNKNOWN">;
  /** the source's own label(s) folded into this method */
  labels: string[];
  share: { mean: number; sd: number };
  /** method margin minus the overall margin, B minus A (R minus D) points */
  offset: { mean: number; sd: number };
};
export type StatePriors = { state: string; source: string; year: number | null; office: string | null; evidence: "HISTORICAL" | "CONFIG"; methods: MethodPrior[] };
export type MethodPriorTable = Record<string, StatePriors>;

export const methodPriorsEnabled = () => process.env.ONPOINT_METHOD_PRIORS === "on" || process.env.ONPOINT_METHOD_PRIORS === "1";

/** Source label -> method. Labels whose meaning is ambiguous across states go to OTHER rather than being guessed. */
const LABEL: Record<string, MethodPrior["method"]> = {
  "ELECTION DAY": "ELECTION_DAY", PROVISIONAL: "PROVISIONAL", "FAILSAFE PROVISIONAL": "PROVISIONAL",
  ABSENTEE: "MAIL_ABSENTEE", ADVANCED: "EARLY_IN_PERSON", EARLY: "EARLY_IN_PERSON",
};

type CbmRecord = { recordType: string; state: string; office: string | null; contestYear: number | null; modeLabel: string; coverage?: string; votesA: number; votesB: number; votesOther: number; sourceName?: string };

/**
 * Build priors from CANDIDATE_BY_METHOD research records. Per state it takes ONE contest (a RECONCILED statewide
 * Senate or governor contest, latest year first) so methods of different contests are never mixed.
 */
export function priorsFromCandidateByMethod(records: readonly CbmRecord[]): MethodPriorTable {
  const out: MethodPriorTable = {};
  const cbm = records.filter((r) => r.recordType === "CANDIDATE_BY_METHOD" && (r.office === "senate" || r.office === "governor"));
  const states = [...new Set(cbm.map((r) => r.state))];
  for (const st of states) {
    const groups = new Map<string, CbmRecord[]>();
    for (const r of cbm.filter((x) => x.state === st)) { const k = `${r.contestYear}|${r.office}`; groups.set(k, [...(groups.get(k) ?? []), r]); }
    const pick = [...groups.entries()].filter(([, rs]) => rs.every((r) => r.coverage === "RECONCILED")).sort((a, b) => Number(b[0].split("|")[0]) - Number(a[0].split("|")[0]))[0];
    if (!pick) continue;
    const rs = pick[1];
    const tot = rs.reduce((s, r) => s + r.votesA + r.votesB + r.votesOther, 0); if (!(tot > 0)) continue;
    const all = (100 * rs.reduce((s, r) => s + r.votesB - r.votesA, 0)) / tot;
    const by = new Map<MethodPrior["method"], { labels: string[]; a: number; b: number; o: number }>();
    for (const r of rs) {
      const m = LABEL[r.modeLabel.toUpperCase()] ?? "OTHER";
      const g = by.get(m) ?? { labels: [], a: 0, b: 0, o: 0 }; g.labels.push(r.modeLabel); g.a += r.votesA; g.b += r.votesB; g.o += r.votesOther; by.set(m, g);
    }
    const methods: MethodPrior[] = [...by.entries()].map(([method, g]) => {
      const t = g.a + g.b + g.o, share = t / tot, off = t > 0 ? (100 * (g.b - g.a)) / t - all : 0;
      // wide on purpose: one past election is context. sd of the share is a quarter of it (at least 5 points);
      // sd of the offset is half of it (at least 5 margin points).
      return { method, labels: g.labels, share: { mean: share, sd: Math.max(0.05, 0.25 * share) }, offset: { mean: off, sd: Math.max(5, 0.5 * Math.abs(off)) } };
    });
    const [year, office] = pick[0].split("|");
    out[st] = { state: st, source: rs[0].sourceName ?? "research record", year: Number(year) || null, office, evidence: "HISTORICAL", methods };
  }
  return out;
}
