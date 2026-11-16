// One evaluated moment: a snapshot goes in; the national forecast, every race's forecast and the advanced model-call
// ledger come out, as one stored state. LIVE, HISTORICAL and SIMULATED all pass through this same function; only the
// snapshot's provenance differs. Deterministic: the seed is fixed for the night (config), and the clock is the frame's
// own time, so recomputing a stored snapshot reproduces the stored state exactly.
import type { XIndex } from "../../results/2026/live";
import { DEFAULT_CONFIG, MODEL_VERSION, type EngineConfig } from "./config";
import type { MethodPriorTable } from "./methodPriors";
import { DEFAULT_CALL_CONFIG, emptyLedger, stepLedger, type CallConfig, type Ledger } from "./modelCalls";
import { nationalForecast, type PreElection } from "./national";
import { forecastRace, type UnitBaseline } from "./raceModel";
import { canonicalJson, fnv64 } from "./rng";
import type { DataMode, ElectionSnapshot, NationalForecast, QualityFlag, RaceForecast } from "./types";

/** One race at one moment, compact: what the pages, the Calls Desk and the charts read. */
export type RaceRow = {
  id: string; /** the provider's race id, when there is one */ pid: string | number | null; rule: RaceForecast["rule"]; dataState: RaceForecast["dataState"]; flags: QualityFlag[];
  /** REPORTED: provider figures only */
  counted: number; providerPct: number | null;
  /** MODELED */
  leaderId: string | null; probability: number | null; shown: number | null; capped: boolean;
  /** forecast principals, B minus A points: reported, projected mean and 80% range */
  pm: null | { rep: number | null; mean: number; lo: number; hi: number; probB: number };
  /** projected top two (by candidate, any party): leader, runner-up, margin points mean and 80% range */
  top2: null | { a: string; b: string; mean: number; lo: number; hi: number; lo95: number; hi95: number };
  expectedFinal: number | null; outstanding: number | null; outstandingHi: number | null;
  /** every candidate, most projected votes first: [id, name, party, reported votes or null, projected votes, projected share, win probability or null] */
  c: [string, string, string | null, number | null, number, number, number | null][];
  /** CALLED: provider call (never the model's) and logical settlement */
  call: RaceForecast["call"]; settled: RaceForecast["settled"];
};
export type StoredState = {
  t: string; snapshotId: string; mode: DataMode; modelVersion: string; stateId: string;
  provenance: ElectionSnapshot["provenance"];
  national: NationalForecast; races: Record<string, RaceRow>; ledger: Ledger;
  racesObserved: number; unmatchedProviderRaces: number;
};

export const rowOf = (f: RaceForecast, providerPct: number | null, pid: string | number | null = null): RaceRow => {
  const by = [...f.candidates].sort((a, b) => b.projectedVotes.mean - a.projectedVotes.mean);
  const lead = f.display.leaderId ? f.candidates.find((c) => c.candidateId === f.display.leaderId) : undefined;
  const raw = lead ? (f.rule === "majority_runoff" ? lead.firstChoiceLeadProbability ?? null : lead.winProbability) : null;
  const r1 = (x: number) => Math.round(x * 10) / 10, r3 = (x: number) => Math.round(x * 1000) / 1000;
  return { id: f.raceId, pid, rule: f.rule, dataState: f.dataState, flags: f.flags, counted: f.turnout.counted, providerPct, leaderId: f.display.leaderId, probability: raw, shown: f.display.probability, capped: f.display.capped,
    pm: f.principalMargin ? { rep: f.principalMargin.reported == null ? null : r3(f.principalMargin.reported), mean: r3(f.principalMargin.projected.mean), lo: r3(f.principalMargin.projected.i80.lo), hi: r3(f.principalMargin.projected.i80.hi), probB: f.principalMargin.probB } : null,
    top2: f.projectedTopTwo ? { a: f.projectedTopTwo.leaderId, b: f.projectedTopTwo.runnerUpId, mean: r3(f.projectedTopTwo.marginPp.mean), lo: r3(f.projectedTopTwo.marginPp.i80.lo), hi: r3(f.projectedTopTwo.marginPp.i80.hi), lo95: r3(f.projectedTopTwo.marginPp.i95.lo), hi95: r3(f.projectedTopTwo.marginPp.i95.hi) } : null,
    expectedFinal: f.turnout.expectedFinal ? Math.round(f.turnout.expectedFinal.mean) : null, outstanding: f.turnout.outstanding ? Math.round(f.turnout.outstanding.mean) : null, outstandingHi: f.turnout.outstanding ? Math.round(f.turnout.outstanding.i95.hi) : null,
    c: by.map((c) => [c.candidateId, c.name, c.partyRaw, c.reportedVotes, Math.round(c.projectedVotes.mean), r1(c.projectedShare.mean), c.winProbability]),
    call: f.call, settled: f.settled };
};

export type EvaluateInput = {
  index: XIndex; pre: PreElection; snapshot: ElectionSnapshot;
  /** the ledger after the previous evaluated snapshot, or null at the start */
  ledger: Ledger | null;
  /** the time of this frame (receipt time live; observation time in a replay) */
  t: string;
  cfg?: EngineConfig; baselines?: Record<string, UnitBaseline>; priors?: MethodPriorTable | null; stale?: boolean;
  /** the model-call rule for a ledger started here (ignored once a ledger exists: a ledger keeps the rule it began with) */
  callConfig?: CallConfig;
};

/** On Point's calls on a ledger: race id -> the called candidate's id. */
export const callsOf = (l: Ledger | null | undefined): Record<string, string> => { const o: Record<string, string> = {}; if (l) for (const [id, r] of Object.entries(l.races)) if (r.modelCall) o[id] = r.modelCall.candidateId; return o; };

export function evaluate(inp: EvaluateInput): StoredState {
  const cfg = inp.cfg ?? DEFAULT_CONFIG, snap = inp.snapshot, seed = cfg.seed;
  // the seat counts settle on On Point's own calls: the ones on the ledger before this update (this update's calls
  // are made from the forecasts below, and added to the called and leading counts afterwards)
  const before = callsOf(inp.ledger);
  const { national, races, tallyInfo } = nationalForecast({ index: inp.index, snapshot: snap, pre: inp.pre, seed, computedAt: inp.t, cfg, baselines: inp.baselines, priors: inp.priors, calls: before });
  // every other race in the index, on its own forecast: statewide offices, measures; those without a forecast are still followed for provider calls
  const all: Record<string, RaceForecast> = { ...races };
  for (const r of inp.index.races) if (!all[r.id]) all[r.id] = forecastRace(r, snap.races[r.id] ?? null, inp.baselines?.[r.id] ?? null, { seed, computedAt: inp.t, snapshotId: snap.snapshotId, cfg, priors: inp.priors, mode: snap.provenance.mode, draws: 1000 });
  const ledger = stepLedger(inp.ledger ?? emptyLedger(snap.provenance.mode, inp.callConfig ?? DEFAULT_CALL_CONFIG), { snapshotId: snap.snapshotId, at: inp.t, forecasts: all, observations: snap.races, stale: inp.stale });
  const CH = { sen: "senate", house: "house", gov: "governors" } as const, PB = ["D", "R", "other"] as const;
  for (const [id, cand] of Object.entries(callsOf(ledger))) {
    const ti = tallyInfo[id]; if (!ti || before[id] || ti.called != null) continue;
    const b = ti.bucket[cand]; if (b == null) continue; const c = national[CH[ti.key]];
    c.called[PB[b]]++; if (ti.leading != null) c.leading[PB[ti.leading]]--;
  }
  const rows: Record<string, RaceRow> = {}; for (const [id, f] of Object.entries(all)) rows[id] = rowOf(f, snap.races[id]?.providerPctReporting ?? null, snap.races[id]?.providerRaceId ?? null);
  const body = { t: inp.t, snapshotId: snap.snapshotId, mode: snap.provenance.mode, modelVersion: MODEL_VERSION, provenance: snap.provenance, national, races: rows, ledger, racesObserved: Object.keys(snap.races).length, unmatchedProviderRaces: snap.unmatchedProviderRaces };
  return { ...body, stateId: fnv64(canonicalJson(body)) };
}
