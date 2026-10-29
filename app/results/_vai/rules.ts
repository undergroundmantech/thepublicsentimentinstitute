// T2: the election-rule registry. Pure: the builder (scripts/vai/build_race_rules.ts) reads the files and hashes them.
//
// No race is assumed to be decided at 50%. Every race gets an explicit rule. The only default is PLURALITY for a
// single-winner candidate race with no known exception, and it is labelled as a default (isDefault, no provenance)
// rather than as a verified fact. Every other rule carries provenance: a statute or constitution citation (cited, not
// retrieved in this repository) or the forecast's own research note for a measure, with the URLs that note lists.

import type { RaceRule, RaceRulesFile, RuleKind, RuleOutput, VaiProvenance } from "./types";

/** The subset of public/results/2026/index.json a rule needs. */
export interface IndexRace {
  id: string;
  k: string;
  st: string;
  off?: string;
  nm?: string;
  cat?: string;
  c?: [string, string, number][];
  thr?: number;
}

/** The subset of public/forecast/measures.json a rule needs. */
export interface MeasureRuleSource {
  id: string;
  st: string;
  threshold: number;
  thresholdNote: string | null;
  ruleNote: string | null;
  sources: string[];
}

export interface RuleContext {
  measures: Map<string, MeasureRuleSource>;
  /** Race ids the forecast models with a ranked-choice final round (model.json races[].rcv). */
  forecastRcv: Set<string>;
  files: { index: string; measures: string; model: string };
}

export const DEFAULT_RULE_STATEMENT =
  "Single-winner candidate race with no known exception: the candidate with the most votes wins. This is an assumption, not a per-race verification; any race found to differ must be added as an exception with provenance.";

const cite = (basis: VaiProvenance["basis"], citation: string, note: string | null, extra: Partial<VaiProvenance> = {}): VaiProvenance => ({
  basis, citation, file: null, urls: [], verification: "CITED_NOT_RETRIEVED", confidence: "MEDIUM", note, ...extra,
});

// ---- candidate-race exceptions, each with its citation -------------------------------------------------------------

const GA_MAJORITY = cite("STATUTE_CITATION", "O.C.G.A. § 21-2-501(a)",
  "Georgia general elections require a majority of the votes cast for the office; with no majority, the top two meet in a runoff. The runoff winner is not modelled.");
const VT_MAJORITY = cite("CONSTITUTION_CITATION", "Vt. Const. ch. II, § 47",
  "Governor, Lieutenant Governor and Treasurer need a majority of the votes; with no majority the General Assembly elects. VAI reports only P(majority).");
const AK_RCV = (rid: string, ctx: RuleContext) => cite("STATUTE_CITATION", "AS 15.15.350 as amended by 2020 Ballot Measure 2 (ranked-choice general elections)",
  ctx.forecastRcv.has(rid)
    ? "The forecast itself models a ranked-choice final round for this race (model.json races[].rcv). Live counts are first choices; no transfer model in v1."
    : "Live counts are first choices; no transfer model in v1.",
  ctx.forecastRcv.has(rid) ? { file: ctx.files.model } : {});
const ME_RCV = cite("STATUTE_CITATION", "21-A M.R.S. § 723-A (ranked-choice tabulation; federal general elections)",
  "U.S. Senate and House general elections in Maine are tabulated by ranked choice. Live counts are first choices; no transfer model in v1.");
const ME_GOV_PLURALITY = cite("CONSTITUTION_CITATION", "Me. Const. art. V, pt. 1, § 3",
  "The governor is elected by plurality, which is why Maine's ranked-choice law does not reach the governor's general election.");

const VT_MAJORITY_OFFICES = new Set(["gov-VT", "lg-VT", "treas-VT"]);
const ME_FEDERAL = /^(sen-ME|house-ME-\d+)$/;

const SUPPORT_OF: Record<RuleKind, { support: RaceRule["support"]; outputs: RuleOutput[] }> = {
  PLURALITY: { support: "SUPPORTED", outputs: ["P_WIN"] },
  MAJORITY_RUNOFF: { support: "SUPPORTED", outputs: ["P_MAJORITY", "P_RUNOFF"] },
  MAJORITY_ELSE_LEGISLATURE: { support: "PARTIAL", outputs: ["P_MAJORITY"] },
  RCV: { support: "PARTIAL", outputs: ["FIRST_CHOICE_SHARES"] },
  MEASURE_THRESHOLD: { support: "SUPPORTED", outputs: ["P_PASS"] },
  MEASURE_THRESHOLD_WITH_BALLOT_FLOOR: { support: "PARTIAL", outputs: ["REPORTED_ONLY"] },
  MEASURE_ALL_BALLOTS_DENOMINATOR: { support: "UNSUPPORTED", outputs: ["REPORTED_ONLY"] },
  MULTI_OPTION_ADVISORY: { support: "UNSUPPORTED", outputs: ["REPORTED_ONLY"] },
  RETENTION: { support: "UNSUPPORTED", outputs: ["REPORTED_ONLY"] },
  CHAMBER_AGGREGATE: { support: "UNSUPPORTED", outputs: ["REPORTED_ONLY"] },
  UNKNOWN: { support: "UNSUPPORTED", outputs: ["REPORTED_ONLY"] },
};

function record(r: IndexRace, rule: RuleKind, o: Partial<RaceRule> = {}): RaceRule {
  const s = SUPPORT_OF[rule];
  return {
    raceId: r.id, kind: r.k, state: r.st, office: r.off ?? "", rule,
    threshold: null, denominator: null, ballotFloor: null,
    support: s.support, outputs: [...s.outputs], isDefault: false, provenance: null, flags: [],
    ...o,
  };
}

/** Downgrade a candidate rule when the two-way machinery cannot represent the race. */
function candidateFlags(r: IndexRace, rr: RaceRule): RaceRule {
  const c = r.c ?? [];
  const flags = [...rr.flags];
  if (c.length === 0) flags.push("NO_CANDIDATES_LISTED");
  else if (c.length === 1) flags.push("UNCONTESTED");
  if (c.length >= 2) {
    const [pa, pb] = [c[0][1], c[1][1]];
    if (!(["D", "IND", "I"].includes(pa) && pb === "R")) flags.push("NONSTANDARD_SIDES");
    const weaker = Math.min(c[0][2], c[1][2]);
    const third = c.slice(2).reduce((m, x) => Math.max(m, x[2]), 0);
    if (weaker > 0 && third >= 0.5 * weaker) flags.push("THIRD_CANDIDATE_MATERIAL");
  }
  let { support, outputs } = rr;
  if (flags.includes("NO_CANDIDATES_LISTED")) { support = "UNSUPPORTED"; outputs = ["REPORTED_ONLY"]; }
  else if (flags.includes("UNCONTESTED")) outputs = ["REPORTED_ONLY"];
  else if (support === "SUPPORTED" && (flags.includes("THIRD_CANDIDATE_MATERIAL") || flags.includes("NONSTANDARD_SIDES"))) { support = "PARTIAL"; outputs = ["REPORTED_ONLY"]; }
  return { ...rr, flags, support, outputs };
}

function candidateRule(r: IndexRace, ctx: RuleContext): RaceRule {
  if (r.st === "GA") return record(r, "MAJORITY_RUNOFF", { threshold: 0.5, denominator: "VOTES_FOR_OFFICE", provenance: GA_MAJORITY });
  if (r.st === "AK") return record(r, "RCV", { provenance: AK_RCV(r.id, ctx), flags: ["RCV_FIRST_CHOICE_ONLY"] });
  if (ME_FEDERAL.test(r.id)) return record(r, "RCV", { provenance: ME_RCV, flags: ["RCV_FIRST_CHOICE_ONLY"] });
  if (r.id === "gov-ME") return record(r, "PLURALITY", { provenance: ME_GOV_PLURALITY });
  if (VT_MAJORITY_OFFICES.has(r.id)) return record(r, "MAJORITY_ELSE_LEGISLATURE", { threshold: 0.5, denominator: "VOTES_FOR_OFFICE", provenance: VT_MAJORITY });
  const flags: string[] = [];
  if (r.st === "VT" && r.k === "state") flags.push("VT_MAJORITY_RULE_UNCHECKED");
  if (r.st === "LA") flags.push("LA_2026_ELECTION_SYSTEM_UNVERIFIED");
  const rr = record(r, "PLURALITY", { isDefault: true, flags });
  return flags.length ? { ...rr, support: "PARTIAL", outputs: ["REPORTED_ONLY"] } : rr;
}

// ---- measures: read from the forecast's own research notes ---------------------------------------------------------

function measureRule(r: IndexRace, ctx: RuleContext): RaceRule {
  const m = ctx.measures.get(r.id);
  if (!m) return record(r, "UNKNOWN", { flags: ["MEASURE_RULE_SOURCE_MISSING"] });
  const note = (m.thresholdNote ?? "").toLowerCase();
  const rule = m.ruleNote ?? "";
  const prov: VaiProvenance = {
    basis: "FORECAST_RESEARCH_NOTE",
    citation: `measures.json ${m.id}: thresholdNote "${m.thresholdNote ?? ""}"`,
    file: ctx.files.measures, urls: [...m.sources], verification: "FORECAST_INPUT",
    confidence: /confirm|unclear|not confirmed/i.test(rule) ? "LOW" : "MEDIUM",
    note: rule || null,
  };
  const flags: string[] = [];
  if (typeof r.thr === "number" && Math.abs(r.thr - m.threshold) > 1e-9) flags.push("INDEX_THRESHOLD_DISAGREES_WITH_MEASURES");
  if (/unclear|not confirmed|confirm against/i.test(rule)) flags.push("RULE_NOTE_UNCERTAIN");

  const options = rule.match(/one of (\w+) options/i);
  if (options) return record(r, "MULTI_OPTION_ADVISORY", { provenance: prov, flags: [...flags, "NON_BINARY_QUESTION"] });

  if (/all ballots cast|all votes cast in the governor|majority of all/i.test(note + " " + rule) && !/at least (30|35)/i.test(note)) {
    return record(r, "MEASURE_ALL_BALLOTS_DENOMINATOR", {
      threshold: 0.5, denominator: "ALL_BALLOTS_CAST", provenance: { ...prov, note: `${rule} The forecast's effective share-of-question threshold (${m.threshold}) assumes 6% roll-off; VAI does not adopt it.` },
      flags: [...flags, "DENOMINATOR_RULE_UNSUPPORTED"],
    });
  }
  const floor = note.match(/at least (\d+) percent of all ballots/);
  if (floor) {
    const side: "YES" | "NO" = /\bNo wins a majority\b|\bNo votes are at least\b/i.test(rule) ? "NO" : "YES";
    return record(r, "MEASURE_THRESHOLD_WITH_BALLOT_FLOOR", {
      threshold: m.threshold, denominator: "VOTES_ON_QUESTION", ballotFloor: { side, shareOfAllBallots: Number(floor[1]) / 100 },
      provenance: prov, flags: [...flags, "BALLOT_FLOOR_NEEDS_TOTAL_BALLOTS", ...(side === "NO" ? ["NO_SIDE_FLOOR"] : [])],
    });
  }
  const pct = note.match(/^(\d+) percent of the votes on the question$/);
  if (pct || note === "a simple majority") {
    const thr = m.threshold;
    if (pct && Math.abs(Number(pct[1]) / 100 - thr) > 0.01) flags.push("THRESHOLD_NOTE_DISAGREES");
    return record(r, "MEASURE_THRESHOLD", { threshold: thr, denominator: "VOTES_ON_QUESTION", provenance: prov, flags });
  }
  return record(r, "UNKNOWN", { provenance: prov, flags: [...flags, "MEASURE_RULE_UNPARSED"] });
}

// ---- everything else -------------------------------------------------------------------------------------------------

function otherRule(r: IndexRace, ctx: RuleContext): RaceRule {
  const c = r.c ?? [];
  if (r.cat === "court" && c.length === 1) {
    return record(r, "RETENTION", { flags: ["RETENTION_THRESHOLD_UNVERIFIED"], provenance: cite("FORECAST_MODEL_FIELD", "index.json: cat \"court\" with one named judge", "Read as a retention question. Retention thresholds differ by state (some above 50%); none is assumed.", { file: ctx.files.index, verification: "FORECAST_INPUT", confidence: "LOW" }) });
  }
  if (r.st === "GA") return candidateFlags(r, record(r, "MAJORITY_RUNOFF", { threshold: 0.5, denominator: "VOTES_FOR_OFFICE", provenance: GA_MAJORITY }));
  if (r.st === "AK") return record(r, "RCV", { provenance: AK_RCV(r.id, ctx), flags: ["RCV_FIRST_CHOICE_ONLY"] });
  const flags = ["LOCAL_OR_SPECIAL_RULE_UNVERIFIED"];
  if (/districts?-\d+(-\d+)+/.test(r.id)) flags.push("POSSIBLE_MULTI_SEAT");
  if (r.st === "LA") flags.push("LA_2026_ELECTION_SYSTEM_UNVERIFIED");
  return { ...candidateFlags(r, record(r, "PLURALITY", { isDefault: true, flags })), support: "PARTIAL", outputs: ["REPORTED_ONLY"] };
}

export function classifyRace(r: IndexRace, ctx: RuleContext): RaceRule {
  switch (r.k) {
    case "measure": return measureRule(r, ctx);
    case "leg": return record(r, "CHAMBER_AGGREGATE", { flags: ["CHAMBER_LAYER_PHASE_B"], provenance: cite("FORECAST_MODEL_FIELD", "index.json leg entry: seats, maj", "A chamber is a seat count, not a single race; out of Phase A scope.", { file: ctx.files.index, verification: "FORECAST_INPUT" }) });
    case "other": return otherRule(r, ctx);
    case "sen": case "gov": case "house": case "state": return candidateFlags(r, candidateRule(r, ctx));
    default: return record(r, "UNKNOWN", { flags: ["UNKNOWN_RACE_KIND"] });
  }
}

const tally = (xs: string[]) => Object.fromEntries([...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort(([a], [b]) => a.localeCompare(b)));

export function buildRaceRules(races: IndexRace[], ctx: RuleContext, meta: { builder: string; indexAsOf: string | null; inputs: { path: string; sha256: string }[] }): RaceRulesFile {
  const out = [...races].sort((a, b) => a.id.localeCompare(b.id)).map((r) => classifyRace(r, ctx));
  return {
    schema: "vai-race-rules/1",
    builder: meta.builder,
    indexAsOf: meta.indexAsOf,
    inputs: meta.inputs,
    defaultRule: { rule: "PLURALITY", statement: DEFAULT_RULE_STATEMENT },
    counts: { byRule: tally(out.map((r) => r.rule)), bySupport: tally(out.map((r) => r.support)), byFlag: tally(out.flatMap((r) => r.flags)) },
    races: out,
  };
}

/** Rule lookup. A race missing from the registry is UNKNOWN, never plurality. */
export function ruleFor(file: RaceRulesFile, raceId: string): RaceRule | null {
  return file.races.find((r) => r.raceId === raceId) ?? null;
}

/** Whether an output may be computed for a race. The registry is the only authority. */
export function allows(rule: RaceRule | null, output: RuleOutput): boolean {
  return !!rule && rule.outputs.includes(output);
}
