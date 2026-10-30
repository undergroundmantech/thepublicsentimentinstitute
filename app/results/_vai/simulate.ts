// T7: race-level Monte Carlo simulation (B2). Joins the inventory (T5) and the preference model (T6) for one supported race and returns a
// research record plus the joint draws behind it. Research only: every record is marked WITHHELD, nothing here is served, and no
// output is a call, a projection or a forecast.
//
// Joint draws. Each output draw carries one coherent set of remaining votes per county, one set of preference log-ratios and one
// scenario. The margin, the final total and the outcome are computed from the same draw, so margin quantiles and outcome
// probabilities always describe one distribution. They are never assembled from marginal quantiles.
//
// What it does not do: more than two candidates (side A and side B only; other candidates keep their forecast county share and are
// flagged), ranked-choice, measures and chambers (those stay UNSUPPORTED), and any use of a precinct share.

import { estimateInventory, INVENTORY_MODEL_VERSION, INVENTORY_MODEL_VERSION_V2, quantilesOf, type InventoryInput, type InventoryPosterior, type InventoryUnit } from "./inventory";
import type { VaiHyper } from "./hyper";
import { cleanRow, PREFERENCE_MODEL_VERSION, prefUnitsFromRows, runPreference, scenariosFor, stageOf, type CountOrderProfile, type PreferenceResult, type StateShift } from "./preference";
import type { CountyRows } from "./prior";
import { allows } from "./rules";
import type { CompletionLevel, PriorRace, Quantiles, RaceRule } from "./types";

export const SIMULATION_SCHEMA = "vai-simulation/1";
export const SIMULATION_MODEL_VERSION = "vai-sim/1";

/** Thresholds of the research gates. Assumed, unfitted, and written into every record so a reader can see them. */
export const SIM_GATES = {
  /** Reported votes as a share of the forecast's expected total at which a count counts as near-complete. */
  nearCompleteShare: 0.9,
  /** Minimum share of reported votes attributed to a known county. */
  coverageFloor: 0.98,
  /** Monte Carlo standard error of P(B wins) above which the probability is flagged. */
  maxProbabilityStdError: 0.02,
} as const;

export type SimulationStatus = "SIMULATED" | "UNSUPPORTED" | "NOT_ANCHORED";
export type OutputQuality = "OK" | "DEGRADED" | "INSUFFICIENT";
export type ModelStage = "PRIOR_ONLY" | "EARLY" | "MIDDLE" | "LATE" | "NEAR_COMPLETE";
export type EvidenceLabel = "VERIFIED" | "OFFICIAL_STATEMENT" | "ESTIMATED" | "PRIOR" | "UNKNOWN";

export interface SimulationInput {
  raceId: string;
  asOf: string;
  /** The race's rule from T2. A null rule is unsupported. */
  rule: RaceRule | null;
  /** The frozen prior (T4) for the race, and the id of the prior file it came from. */
  priorId: string;
  prior: PriorRace;
  /** The forecast's county rows [a, b, other, total]. */
  rows: CountyRows;
  /** Votes counted so far by county [a, b, other]. A county that is absent has counted nothing. */
  counted: Record<string, [number, number, number]>;
  region?: (county: string) => string;
  /** Per-county completion evidence (schema §6) and official outstanding statements, when the caller holds them. */
  completion?: Record<string, CompletionLevel>;
  official?: InventoryInput["statewideOfficial"];
  /** The state's count-order profile from the ledger (T1). */
  profile: CountOrderProfile;
  receipt: InventoryInput["receipt"];
  /** Feed state from the reconciled frame (T3). */
  feed?: { coverage: number | null; stale: boolean; latestSourceTimestamp: string | null; flags: string[] };
  /** The published state-shift draws (anchored), at least `draws` of them. */
  stateShift: StateShift;
  hyper: VaiHyper;
  shiftMode: "WEIGHTED" | "MARGINALISED";
  seed: number;
  draws: number;
  /** Provenance strings the caller owns: artefact ids and hashes. Copied into the record. */
  provenance: { priorSha256?: string; countOrderSha256?: string; hyperSha256?: string; rulesId?: string };
}

export interface JointDraws {
  draws: number;
  /** B minus A, in points of all votes, per draw. */
  margin: Float64Array;
  /** Final counted total per draw. */
  total: Float64Array;
  /** Remaining votes per draw. */
  remaining: Float64Array;
  /** Index of the scenario used in each draw. */
  scenario: Int32Array;
}

export interface RaceSimulation {
  schema: typeof SIMULATION_SCHEMA;
  raceId: string;
  asOf: string;
  status: SimulationStatus;
  /** Why the race has no simulation, when status is not SIMULATED. */
  unsupportedReason: string | null;
  reported: { a: number; b: number; other: number; total: number; label: EvidenceLabel; latestSourceTimestamp: string | null; coverage: number | null } | null;
  outstanding: {
    official: { votes: number | null; scope: string | null; label: EvidenceLabel };
    estimated: (Quantiles & { label: "ESTIMATED" }) | null;
  } | null;
  finalTotal: (Quantiles & { label: "ESTIMATED" }) | null;
  /** Margin B − A in points of all votes. */
  margin: { mean: number; sd: number; quantiles: Record<string, number>; label: "ESTIMATED" } | null;
  /** Outcome probabilities for the two-way contest. Null when quality is INSUFFICIENT. */
  outcome: { pB: number; pA: number; pTie: number; pBStdError: number; label: "ESTIMATED" } | null;
  priorReference: { margin: number | null; probB: number | null; label: "PRIOR" };
  modelStage: ModelStage;
  quality: OutputQuality;
  countOrder: { category: string | null; countSpeed: number | null; receiptClass: string | null; evidence: "LEDGER_DOCUMENTED" | "LEDGER_CAVEATED" | "ABSENT"; observed: false; verified: false; effect: "VARIANCE_ONLY"; scenarioPosterior: { id: string; column: string; sigmaGap: number; prior: number; posterior: number }[] };
  versions: { simulation: string; inventory: string; preference: string; hyperId: string; hyperStatus: string; priorId: string; shiftMode: string; progressModel: string };
  seed: number;
  draws: number;
  diagnostics: { essFraction: number | null; essDraws: number | null; reportingUnits: number | null; inventoryFlags: string[]; preferenceFlags: string[]; progressPosterior: { components: unknown[]; posterior: number[] } | null; unmatchedOrOutOfFile: number };
  guardrails: { flags: string[]; gates: typeof SIM_GATES };
  provenance: SimulationInput["provenance"] & { priorId: string; hyperId: string; asOf: string };
  publication: { eligible: false; status: "WITHHELD"; reasons: string[] };
}

const QUANTILE_POINTS = [0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975];
const sorted = (x: Float64Array) => Float64Array.from(x).sort();
const at = (s: Float64Array, p: number) => s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))];

function stageLabel(share: number, hyper: VaiHyper): ModelStage {
  if (share <= 0) return "PRIOR_ONLY";
  if (share >= SIM_GATES.nearCompleteShare) return "NEAR_COMPLETE";
  const s = stageOf(share, hyper);
  return s === "FIRST" ? "EARLY" : s === "MIXED" ? "MIDDLE" : "LATE";
}

/** Reasons every research record is withheld, whatever its numbers say. */
const ALWAYS_WITHHELD = ["RESEARCH_ONLY_NOT_APPROVED", "NO_POINT_IN_TIME_VALIDATION_ON_REAL_COUNTS", "INDEPENDENT_VALIDATION_PENDING"];

function emptyRecord(i: SimulationInput, status: SimulationStatus, reason: string): RaceSimulation {
  return {
    schema: SIMULATION_SCHEMA, raceId: i.raceId, asOf: i.asOf, status, unsupportedReason: reason, reported: null, outstanding: null, finalTotal: null, margin: null, outcome: null,
    priorReference: { margin: i.prior?.published.margin ?? null, probB: i.prior?.published.probB ?? null, label: "PRIOR" },
    modelStage: "PRIOR_ONLY", quality: "INSUFFICIENT",
    countOrder: { category: i.profile.category, countSpeed: i.profile.countSpeed, receiptClass: i.profile.receiptClass, evidence: i.profile.category === null ? "ABSENT" : i.profile.unresolved ? "LEDGER_CAVEATED" : "LEDGER_DOCUMENTED", observed: false, verified: false, effect: "VARIANCE_ONLY", scenarioPosterior: [] },
    versions: { simulation: SIMULATION_MODEL_VERSION, inventory: "none", preference: "none", hyperId: i.hyper.hyperId, hyperStatus: i.hyper.status, priorId: i.priorId, shiftMode: "none", progressModel: i.hyper.inventory.progress?.model ?? "TOBIT" },
    seed: i.seed, draws: 0,
    diagnostics: { essFraction: null, essDraws: null, reportingUnits: null, inventoryFlags: [], preferenceFlags: [], progressPosterior: null, unmatchedOrOutOfFile: 0 },
    guardrails: { flags: [status], gates: SIM_GATES },
    provenance: { ...i.provenance, priorId: i.priorId, hyperId: i.hyper.hyperId, asOf: i.asOf },
    publication: { eligible: false, status: "WITHHELD", reasons: [...ALWAYS_WITHHELD, status] },
  };
}

/**
 * Simulates one race. Deterministic for the seed. Never throws on unsupported input: it returns a record that says why there is
 * no simulation.
 */
export function simulateRace(input: SimulationInput): { record: RaceSimulation; joint: JointDraws | null; inventory: InventoryPosterior | null; preference: PreferenceResult | null } {
  const none = (status: SimulationStatus, reason: string) => ({ record: emptyRecord(input, status, reason), joint: null, inventory: null, preference: null });
  if (!input.rule) return none("UNSUPPORTED", "NO_RULE");
  if (input.rule.support === "UNSUPPORTED" || !allows(input.rule, "P_WIN")) return none("UNSUPPORTED", `RULE_${input.rule.rule}_NOT_SUPPORTED`);
  if (input.prior.status !== "ANCHORED" || input.prior.liveUse !== "ELIGIBLE") return none("NOT_ANCHORED", `PRIOR_${input.prior.status}_${input.prior.liveUse}`);

  const keys = Object.keys(input.rows).sort();
  const region = input.region ?? (() => "ALL");
  const J = input.draws;
  const units: InventoryUnit[] = keys.map((k) => {
    const c = input.counted[k] ?? [0, 0, 0];
    const u: InventoryUnit = { id: k, expected: cleanRow(input.rows[k]).row[3], reported: c[0] + c[1] + c[2], region: region(k) };
    const level = input.completion?.[k];
    if (level) u.completion = level;
    return u;
  });
  const inventory = estimateInventory({ raceId: input.raceId, asOf: input.asOf, units, receipt: input.receipt, statewideOfficial: input.official ?? null, hyper: input.hyper, seed: input.seed, draws: J });
  const ps = input.hyper.preference.pseudoCount;
  const pref = prefUnitsFromRows(input.rows, region, (k) => (input.counted[k] ? { a: input.counted[k][0], b: input.counted[k][1] } : null), ps);

  let countedA = 0, countedB = 0, countedOther = 0;
  for (const k of keys) { const c = input.counted[k]; if (c) { countedA += c[0]; countedB += c[1]; countedOther += c[2]; } }
  const reportedTotal = inventory.summary.reported;

  const margin = new Float64Array(J), total = new Float64Array(J), remaining = new Float64Array(J);
  const scenario = new Int32Array(J);
  const other = keys.map((k) => { const row = cleanRow(input.rows[k]).row; return row[3] > 0 ? row[2] / row[3] : 0; });
  const rows = keys.map((k) => cleanRow(input.rows[k]).row);
  void rows;
  const preference = runPreference({ raceId: input.raceId, units: pref, inventory, stateShift: [input.stateShift], scenarios: scenariosFor(input.profile, input.hyper), shiftMode: input.shiftMode, hyper: input.hyper, seed: input.seed }, (d) => {
    let vb = countedB, va = countedA, tot = reportedTotal, rem = 0;
    for (let c = 0; c < keys.length; c++) {
      const r = d.remaining[c];
      const sb = 1 / (1 + Math.exp(-d.q[0][c]));
      vb += r * (1 - other[c]) * sb;
      va += r * (1 - other[c]) * (1 - sb);
      tot += r;
      rem += r;
    }
    margin[d.index] = tot > 0 ? (100 * (vb - va)) / tot : 0;
    total[d.index] = tot;
    remaining[d.index] = rem;
    scenario[d.index] = d.scenario;
  });

  const expectedTotal = units.reduce((s, u) => s + u.expected, 0);
  const share = expectedTotal > 0 ? reportedTotal / expectedTotal : 0;
  const modelStage = stageLabel(share, input.hyper);
  const flags: string[] = [...inventory.flags, ...preference.flags];
  const feed = input.feed;
  if (feed?.stale) flags.push("STALE_FEED");
  if (feed && feed.coverage !== null && feed.coverage < SIM_GATES.coverageFloor) flags.push("COUNTY_COVERAGE_LOW");
  if (feed) flags.push(...feed.flags);
  const verifiedComplete = units.length > 0 && units.every((u) => u.reported <= 0 || u.completion === "ALL_KNOWN_BALLOTS_COUNTED" || u.completion === "CERTIFIED");
  if (share >= SIM_GATES.nearCompleteShare && !verifiedComplete && !input.official) flags.push("NEAR_COMPLETION_UNVERIFIED");
  if (!input.official && !units.some((u) => u.completion)) flags.push("NO_OFFICIAL_OUTSTANDING_EVIDENCE");
  if (input.hyper.status !== "RESEARCH_CANDIDATE" || input.hyper.provenance && Object.values(input.hyper.provenance).some((p) => p.status !== "DERIVED_FROM_FINALS")) flags.push("HYPERPARAMETERS_UNCALIBRATED");
  if (input.profile.category === null) flags.push("NO_COUNT_ORDER_LEDGER_ENTRY");
  if (input.counted && keys.length && Object.keys(input.counted).some((k) => !(k in input.rows))) flags.push("COUNTED_COUNTY_NOT_IN_FORECAST_FILE");
  if (input.rule.isDefault) flags.push("RULE_IS_DEFAULT_PLURALITY");
  flags.push("OTHER_CANDIDATES_AT_FORECAST_SHARE");

  const ms = sorted(margin), ts = sorted(total), rs = sorted(remaining);
  let sum = 0, pos = 0, neg = 0;
  for (const m of margin) { sum += m; if (m > 0) pos++; else if (m < 0) neg++; }
  const mean = sum / J;
  let v = 0;
  for (const m of margin) v += (m - mean) ** 2;
  const pB = pos / J, pA = neg / J;
  const essDraws = preference.essFraction * J;
  const pbSe = Math.sqrt(Math.max(pB * (1 - pB), 1e-12) / Math.max(essDraws, 1));
  if (pbSe > SIM_GATES.maxProbabilityStdError) flags.push("PROBABILITY_NOISY");

  let quality: OutputQuality = "OK";
  if (flags.some((f) => ["STALE_FEED", "COUNTY_COVERAGE_LOW", "NEAR_COMPLETION_UNVERIFIED", "PROBABILITY_NOISY", "COUNTED_COUNTY_NOT_IN_FORECAST_FILE", "NO_COUNT_ORDER_LEDGER_ENTRY", "STATE_SHIFT_DRAWS_REPLACED_BY_GAUSSIAN"].includes(f))) quality = "DEGRADED";
  if (flags.includes("LOW_EFFECTIVE_SAMPLE_SIZE")) quality = "INSUFFICIENT";
  const qs: Record<string, number> = {};
  for (const p of QUANTILE_POINTS) qs[`q${(p * 1000).toFixed(0).padStart(3, "0")}`] = at(ms, p);
  const withProb = quality !== "INSUFFICIENT";
  const provenanceFlags = [...new Set(flags)].sort();

  const record: RaceSimulation = {
    schema: SIMULATION_SCHEMA, raceId: input.raceId, asOf: input.asOf, status: "SIMULATED", unsupportedReason: null,
    reported: { a: countedA, b: countedB, other: countedOther, total: reportedTotal, label: "VERIFIED", latestSourceTimestamp: feed?.latestSourceTimestamp ?? null, coverage: feed?.coverage ?? null },
    outstanding: {
      official: { votes: inventory.summary.officialOutstanding, scope: inventory.summary.officialScope, label: inventory.summary.officialOutstanding === null ? "UNKNOWN" : "OFFICIAL_STATEMENT" },
      estimated: { ...quantilesOf(remaining), label: "ESTIMATED" },
    },
    finalTotal: { median: at(ts, 0.5), q10: at(ts, 0.1), q90: at(ts, 0.9), label: "ESTIMATED" },
    margin: { mean, sd: Math.sqrt(v / Math.max(J - 1, 1)), quantiles: qs, label: "ESTIMATED" },
    outcome: withProb ? { pB, pA, pTie: 1 - pB - pA, pBStdError: pbSe, label: "ESTIMATED" } : null,
    priorReference: { margin: input.prior.published.margin, probB: input.prior.published.probB, label: "PRIOR" },
    modelStage, quality,
    countOrder: {
      category: input.profile.category, countSpeed: input.profile.countSpeed, receiptClass: input.profile.receiptClass,
      evidence: input.profile.category === null ? "ABSENT" : input.profile.unresolved ? "LEDGER_CAVEATED" : "LEDGER_DOCUMENTED",
      observed: false, verified: false, effect: "VARIANCE_ONLY",
      scenarioPosterior: preference.scenarios.map((s) => ({ id: s.id, column: s.column, sigmaGap: s.sigmaGap, prior: s.prior, posterior: s.posterior })),
    },
    versions: {
      simulation: SIMULATION_MODEL_VERSION, inventory: inventory.model === INVENTORY_MODEL_VERSION_V2 ? INVENTORY_MODEL_VERSION_V2 : INVENTORY_MODEL_VERSION, preference: PREFERENCE_MODEL_VERSION,
      hyperId: input.hyper.hyperId, hyperStatus: input.hyper.status, priorId: input.priorId, shiftMode: preference.shiftMode, progressModel: inventory.diagnostics.progress.model,
    },
    seed: input.seed, draws: J,
    diagnostics: {
      essFraction: preference.essFraction, essDraws, reportingUnits: preference.reportingUnits, inventoryFlags: inventory.flags, preferenceFlags: preference.flags,
      progressPosterior: inventory.diagnostics.progress.model === "TOBIT" ? null : { components: inventory.diagnostics.progress.components, posterior: inventory.diagnostics.progress.posterior },
      unmatchedOrOutOfFile: Object.keys(input.counted).filter((k) => !(k in input.rows)).length,
    },
    guardrails: { flags: provenanceFlags, gates: SIM_GATES },
    provenance: { ...input.provenance, priorId: input.priorId, hyperId: input.hyper.hyperId, asOf: input.asOf },
    publication: { eligible: false, status: "WITHHELD", reasons: [...ALWAYS_WITHHELD, ...provenanceFlags.filter((f) => ["LOW_EFFECTIVE_SAMPLE_SIZE", "NEAR_COMPLETION_UNVERIFIED", "STALE_FEED", "COUNTY_COVERAGE_LOW", "HYPERPARAMETERS_UNCALIBRATED", "PROBABILITY_NOISY"].includes(f))] },
  };
  void rs;
  return { record, joint: { draws: J, margin, total, remaining, scenario }, inventory, preference };
}
