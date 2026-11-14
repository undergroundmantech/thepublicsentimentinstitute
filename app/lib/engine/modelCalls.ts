// The model-call ledger: when the engine's own probability for a race has been high enough, for long enough, with
// sound enough data, to register a MODEL CALL. Pure: a ledger plus one evaluated snapshot gives the next ledger.
//
// A model call is the engine's record, kept on the Calls Desk. It is not an official call and not an editorial call:
// those are separate entries (`official`, `editorial`) with their own origin and time, and nothing here creates them.
//
// The rule (every number is in CallConfig, so 99.0%, 99.3% and 99.5% can be compared later on the same data):
//   1. a candidate reaches the threshold: FIRST_QUALIFIED, with the time;
//   2. on the NEXT distinct update the SAME candidate is still at or above it: MODEL_CALLED, with the time;
//   3. both times, every safeguard passes.
// "Distinct update" means new data: the race's own observation changed, or, for a race whose count the provider shows
// as finished, the snapshot as a whole changed. A re-read of the same cached data, or a re-render, is not an update
// and changes nothing. A drop below the threshold, a different leader or a failed safeguard before confirmation
// resets the sequence. After a model call nothing is ever erased: if the model later loses confidence or favours
// someone else, the original call stays and an alert event is added beside it.
//
// The probabilities are NOT calibrated (Gate E). The safeguards exist because a formula printing 99.3% is not
// evidence of 99.3%: a race cannot qualify on a narrow distribution alone.
import { fnv64, canonicalJson } from "./rng";
import type { DataMode, QualityFlag, RaceForecast, RaceObservation } from "./types";

export type CallConfig = {
  /** modeled win probability needed. 0.993 is about 2.46 sigma one-sided under a normal model. */
  threshold: number;
  /** distinct qualifying updates needed in a row (the first one included) */
  consecutive: number;
  /** shown as "approaching" from here */
  approach: number;
  /** the probability must clear the threshold after subtracting this many Monte Carlo standard errors */
  mcZ: number;
  /** at least this share of the expected final vote must be counted */
  minCountedShare: number;
  /** stress test: the runner-up would need at least this share of the HIGH estimate (97.5th percentile) of outstanding
   *  ballots, head to head with the leader, to catch up. Below it the race is too open to call on a probability. */
  minNeededShare: number;
  /** the same test for a race modeled county by county: the share the runner-up needs must exceed the share those counties are expected to give him by at least this (0.1 = 10 points of share, 20 of margin). Absent: the plain test. */
  minNeededOverExpected?: number;
  /** a race whose 95% range of the projected margin starts below `belowLo` points must have qualified without a break for `holdMin` minutes before it is called. Absent: no hold. */
  close?: { belowLo: number; holdMin: number };
  /** the low end of the 95% range of the projected margin must be at least this many points. Absent: only above zero. */
  minMarginLo?: number;
  /** quality flags that block qualification outright */
  blockingFlags: QualityFlag[];
  /** after a model call: an alert when the called candidate's probability falls below this */
  deteriorationAlert: number;
  /**
   * First-report quarantine: a race cannot qualify until this many distinct updates with votes have been seen for it.
   * NY-01 was called four minutes after its first report, on a count the provider had doubled (November 3, 2026).
   */
  minUpdates: number;
  /**
   * The safe-seat lane, as the networks call safe seats early. A race is in it when the pre-election forecast gave its
   * favourite at least `minPrior`, the race is a plain-plurality partisan race of one of `kinds`, and the model's
   * leader now is that same favourite. For such a race the counted-share floor is `minCountedShare` instead of the
   * standard one, and the outstanding-ballots stress test is not applied (early in a count it cannot be passed by
   * anyone). Everything else still applies: the threshold after simulation error, the favourite leading the count, a
   * 95% margin range that excludes a loss, every data flag, the quarantine and the updates in a row. Ballot measures
   * are never in it: Massachusetts Question 7 was 99.1% to pass in the forecast and failed.
   */
  fast: { on: boolean; minPrior: number; minCountedShare: number; kinds: string[];
    /**
     * The lane's counted-share floor for a race modeled county by county. Higher, because in the first part of a
     * count that model reads single counties' first batches and moves more from update to update than a race total
     * does: on the recorded night Tennessee's Senate race qualified at 10% counted and read 88% twenty minutes later
     * (the call was right). The standard floor when absent.
     */
    minCountedShareCounty?: number;
    /** the quarantine for a safe seat: distinct updates with votes before it can qualify (the standard `minUpdates` when absent) */
    minUpdates?: number };
};
export const DEFAULT_CALL_CONFIG: CallConfig = {
  threshold: 0.993, consecutive: 2, approach: 0.95, mcZ: 2, minCountedShare: 0.5, minNeededShare: 0.6, minNeededOverExpected: 0.1, minMarginLo: 0.5, close: { belowLo: 2, holdMin: 30 },
  blockingFlags: ["NO_FORECAST", "NO_OBSERVATION", "TEST_DATA", "COUNT_UNKNOWN", "COUNT_EXCEEDS_FORECAST", "UNIT_TOPLINE_MISMATCH", "PROVIDER_ROWS_INCONSISTENT", "AMBIGUOUS_CANDIDATE", "TURNOUT_WEAK_EVIDENCE", "RULE_RANKED_CHOICE", "RULE_NOT_MODELED"],
  deteriorationAlert: 0.9,
  minUpdates: 3,
  fast: { on: true, minPrior: 0.97, minCountedShare: 0.1, minCountedShareCounty: 0.25, kinds: ["sen", "gov", "house"], minUpdates: 1 },
};

export type CallStatus = "MONITORING" | "APPROACHING" | "FIRST_QUALIFIED" | "MODEL_CALLED" | "SETTLED_UNCONTESTED";
export type CallEventKind =
  | "FIRST_QUALIFIED" | "MODEL_CALLED" | "RESET" | "OFFICIAL_CALL" | "OFFICIAL_CALL_CHANGED" | "OFFICIAL_CALL_WITHDRAWN" | "EDITORIAL_CALL"
  | "ALERT_CONFIDENCE_DETERIORATED" | "ALERT_MODEL_CONTRADICTS_CALL" | "ALERT_OFFICIAL_DISAGREES";
export type CallEvent = { seq: number; kind: CallEventKind; raceId: string; at: string; snapshotId: string; candidateId: string | null; name: string | null; probability: number | null; detail: string };

export type RaceCallState = {
  raceId: string;
  status: CallStatus;
  leader: { candidateId: string; name: string; partyRaw: string | null } | null;
  /** the model's raw probability for the leader, and its Monte Carlo standard error */
  probability: number | null; mcStdErr: number | null;
  /** 80% interval of the projected top-two margin, points */
  marginI80: { lo: number; hi: number } | null;
  providerPctReporting: number | null; countedShare: number | null;
  outstanding: { mean: number; hi: number } | null;
  /** why the race does not qualify right now, in words; empty when it does */
  blockers: string[];
  qualifying: number;                       // distinct qualifying updates in a row
  /** distinct updates with votes seen so far (the quarantine counts these), and whether the race is in the safe-seat lane */
  updates?: number; safeSeat?: boolean;
  qualifyingCandidateId: string | null;
  firstQualifiedAt: string | null;
  modelCall: null | { candidateId: string; name: string; partyRaw: string | null; calledAt: string; snapshotId: string; probability: number; threshold: number;
    /** which rule made the call, and the share of the expected vote counted at that moment */
    lane?: CallLane; countedShare?: number | null };
  /** a provider's call: reported, never produced here */
  official: null | { candidateId: string; name: string; source: string; firstSeenAt: string; /** the provider's own stated call time, when it gives one; firstSeenAt is when this site first read the call */ calledAt?: string | null };
  /** an operator's recorded decision (see recordEditorialCall): never produced by the model */
  editorial: null | { candidateId: string; name: string; decidedBy: string; decidedAt: string; reason: string; snapshotId: string | null };
  alerts: number;
  /** fingerprint of the race's observation at its last distinct update */
  lastObsKey: string | null; lastSnapshotId: string | null; updatedAt: string | null;
};
export type Ledger = { mode: DataMode; config: CallConfig; asOf: string | null; snapshotId: string | null; races: Record<string, RaceCallState>; events: CallEvent[] };

export const emptyLedger = (mode: DataMode, config: CallConfig = DEFAULT_CALL_CONFIG): Ledger => ({ mode, config, asOf: null, snapshotId: null, races: {}, events: [] });

/** What makes two reads of a race "the same data": its counts, winner flags and percent reporting. Never a clock. */
export const observationKey = (o: RaceObservation | null | undefined): string => (o ? fnv64(canonicalJson([o.candidates.map((c) => [c.candidateId, c.votes, c.providerWinner]), o.providerPctReporting, o.units?.map((u) => [u.unitId, u.votes, u.providerPctReporting]) ?? null])) : "none");

export type CallLane = "standard" | "safe-seat";
type Probe = { leader: RaceCallState["leader"]; p: number | null; se: number | null; countedShare: number | null; outstanding: RaceCallState["outstanding"]; blockers: string[]; qualifies: boolean;
  /** which rule the race qualifies under (null when it does not), and whether it is a safe seat at all */
  lane: CallLane | null; safeSeat: boolean };

/** The leader, the probability and every safeguard for one race at one moment. */
export function probe(f: RaceForecast, cfg: CallConfig, stale: boolean): Probe {
  const runoff = f.rule === "majority_runoff";
  const pOf = (c: RaceForecast["candidates"][number]) => (runoff ? c.outrightProbability ?? 0 : c.winProbability ?? -1);
  const top = [...f.candidates].sort((a, b) => pOf(b) - pOf(a))[0];
  const p = top && pOf(top) >= 0 ? pOf(top) : null;
  const se = p == null ? null : Math.sqrt(Math.max(p * (1 - p), 1 / f.draws) / f.draws);
  const ef = f.turnout.expectedFinal, out = f.turnout.outstanding;
  const countedShare = ef && ef.mean > 0 ? f.turnout.counted / ef.mean : null;
  // the safe-seat lane: the forecast's heavy favourite, in a plain partisan race, still the model's leader
  const prior = f.principalMargin?.prior.probB ?? null, fast = cfg.fast;
  const safeSeat = !!fast?.on && prior != null && f.rule === "plurality" && fast.kinds.includes(f.raceId.split("-")[0]) && Math.max(prior, 1 - prior) >= fast.minPrior && !!top && top.side === (prior >= 0.5 ? "b" : "a");
  const blockers: string[] = [], slow: string[] = [];      // `slow`: safeguards the safe-seat lane replaces
  if (stale) blockers.push("the data is stale");
  for (const fl of cfg.blockingFlags) if (f.flags.includes(fl)) blockers.push(`data-quality flag ${fl}`);
  if (f.dataState === "MISSING" || f.dataState === "INVALID" || f.dataState === "STALE") blockers.push(`data state ${f.dataState}`);
  if (p == null) blockers.push("no model probability");
  if (countedShare == null || countedShare < cfg.minCountedShare) slow.push(`under ${(100 * cfg.minCountedShare).toFixed(0)}% of the expected vote is counted`);
  const fastFloor = f.flags.includes("COUNTY_MODEL") ? fast?.minCountedShareCounty ?? fast?.minCountedShare : fast?.minCountedShare;
  if (safeSeat && (countedShare == null || countedShare < (fastFloor as number))) blockers.push(`under ${(100 * (fastFloor as number)).toFixed(0)}% of the expected vote is counted (safe-seat floor)`);
  if (!out) blockers.push("no estimate of the outstanding vote");
  // stress test against the high estimate of what is still out
  if (out && top && f.projectedTopTwo) {
    const sorted = [...f.candidates].filter((c) => c.reportedVotes != null).sort((a, b) => (b.reportedVotes as number) - (a.reportedVotes as number));
    const lead = sorted.length > 1 && sorted[0].candidateId === top.candidateId ? (sorted[0].reportedVotes as number) - (sorted[1].reportedVotes as number) : -1;
    if (lead < 0) blockers.push("the model's leader does not lead the count");
    else if (out.i95.hi > 0) {
      const needed = 0.5 + lead / (2 * out.i95.hi);
      // A race modeled county by county knows where the outstanding ballots are, so the test is against what those
      // counties are expected to give the runner-up: he must need at least minNeededOverExpected more of them, head
      // to head, than the model expects him to get. ("All that is left is the Panhandle": needing 48% there is not
      // the same as needing 48% of Miami.) It cuts both ways: where what is left favours the runner-up, more is asked.
      const oL = top.projectedVotes.mean - (sorted[0].reportedVotes as number), oR = sorted[1].projectedVotes.mean - (sorted[1].reportedVotes as number);
      if (f.flags.includes("COUNTY_MODEL") && cfg.minNeededOverExpected != null && oL + oR > 0 && oL >= 0 && oR >= 0) {
        const expected = oR / (oL + oR);
        if (needed - expected < cfg.minNeededOverExpected) slow.push(`the runner-up needs ${(100 * needed).toFixed(0)}% of the high estimate of outstanding ballots, and their counties are expected to give him ${(100 * expected).toFixed(0)}%: under ${(100 * cfg.minNeededOverExpected).toFixed(0)} points apart`);
      } else if (needed < cfg.minNeededShare) slow.push(`the runner-up needs under ${(100 * cfg.minNeededShare).toFixed(0)}% of the high estimate of outstanding ballots`);
    }
    if (f.projectedTopTwo.leaderId !== top.candidateId || f.projectedTopTwo.marginPp.i95.lo <= 0) blockers.push("the 95% range of the projected margin includes a loss");
    // too close to call: most states recount at half a point, and provisional and cured ballots are settled at the canvass, days later
    else if (cfg.minMarginLo != null && f.projectedTopTwo.marginPp.i95.lo < cfg.minMarginLo) blockers.push(`the 95% range of the projected margin reaches below ${cfg.minMarginLo} points: recount territory`);
  }
  const clears = p != null && se != null && p >= cfg.threshold && p - cfg.mcZ * se >= cfg.threshold;
  if (p != null && p >= cfg.threshold && !clears) blockers.push("the probability does not clear the threshold after simulation error");
  // the standard rule needs every safeguard; a safe seat may qualify without the two the lane replaces
  const standard = clears && blockers.length === 0 && slow.length === 0, viaFast = !standard && safeSeat && clears && blockers.length === 0;
  return { leader: top ? { candidateId: top.candidateId, name: top.name, partyRaw: top.partyRaw } : null, p, se, countedShare, outstanding: out ? { mean: out.mean, hi: out.i95.hi } : null,
    blockers: safeSeat ? blockers : [...blockers, ...slow], qualifies: standard || viaFast, lane: standard ? "standard" : viaFast ? "safe-seat" : null, safeSeat };
}

export type StepInput = {
  snapshotId: string;
  /** the time of this update: the snapshot's receipt time live, the replay clock's observation time in a replay */
  at: string;
  forecasts: Record<string, RaceForecast>;
  observations: Record<string, RaceObservation>;
  stale?: boolean;
};

/** Advance the ledger by one evaluated snapshot. Returns a new ledger; the input is not modified. */
export function stepLedger(prev: Ledger, inp: StepInput): Ledger {
  const cfg = prev.config; const events = [...prev.events]; const races: Record<string, RaceCallState> = { ...prev.races };
  const push = (kind: CallEventKind, raceId: string, c: { candidateId: string; name: string } | null, probability: number | null, detail: string) =>
    events.push({ seq: events.length + 1, kind, raceId, at: inp.at, snapshotId: inp.snapshotId, candidateId: c?.candidateId ?? null, name: c?.name ?? null, probability, detail });
  for (const [raceId, f] of Object.entries(inp.forecasts)) {
    const old: RaceCallState = races[raceId] ?? { raceId, status: "MONITORING", leader: null, probability: null, mcStdErr: null, marginI80: null, providerPctReporting: null, countedShare: null, outstanding: null, blockers: [], qualifying: 0, qualifyingCandidateId: null, firstQualifiedAt: null, modelCall: null, official: null, editorial: null, alerts: 0, lastObsKey: null, lastSnapshotId: null, updatedAt: null };
    const obs = inp.observations[raceId]; const key = observationKey(obs);
    const finished = (obs?.providerPctReporting ?? 0) >= 99.5;
    const distinct = key !== old.lastObsKey || (finished && inp.snapshotId !== old.lastSnapshotId);
    const pr = probe(f, cfg, !!inp.stale);
    // first-report quarantine: count the distinct updates that carried votes
    const updates = (old.updates ?? 0) + (distinct && f.turnout.counted > 0 ? 1 : 0);
    // (a safe seat has its own, shorter quarantine: there the forecast and the count must agree, so a faulty first
    // report cannot by itself produce a call against the forecast, which is what happened in NY-01)
    const need = (pr.safeSeat ? cfg.fast.minUpdates : undefined) ?? cfg.minUpdates ?? 0;
    if (!old.modelCall && updates < need && f.turnout.counted > 0) { pr.blockers.push(`fewer than ${need} updates since its first returns (${updates} so far)`); pr.qualifies = false; pr.lane = null; }
    const s: RaceCallState = { ...old, updates, safeSeat: pr.safeSeat, leader: pr.leader, probability: pr.p, mcStdErr: pr.se, marginI80: f.projectedTopTwo?.marginPp.i80 ?? null, providerPctReporting: obs?.providerPctReporting ?? null, countedShare: pr.countedShare, outstanding: pr.outstanding, blockers: pr.blockers };
    // a provider can take a call back or move it to another candidate (civicAPI did both within two minutes in South
    // Carolina's Senate race on November 3, 2026). The record follows the provider, and the log keeps every step.
    if (s.official && obs && !obs.candidates.some((c) => c.candidateId === s.official!.candidateId && c.providerWinner)) {
      const was = s.official; s.official = null; s.alerts++;
      if (f.call) push("OFFICIAL_CALL_CHANGED", raceId, { candidateId: f.call.winnerId, name: f.call.name }, null, `${f.call.source} moved its call from ${was.name} (first seen ${was.firstSeenAt}) to ${f.call.name}`);
      else push("OFFICIAL_CALL_WITHDRAWN", raceId, { candidateId: was.candidateId, name: was.name }, null, `${was.source} withdrew its call for ${was.name} (first seen ${was.firstSeenAt})`);
    }
    // a provider's call is recorded the first time it is seen, whatever the model thinks
    if (f.call && !s.official) {
      const pca = inp.observations?.[raceId]?.providerCalledAt;
      s.official = { candidateId: f.call.winnerId, name: f.call.name, source: f.call.source, firstSeenAt: inp.at, ...(pca ? { calledAt: pca } : {}) };
      if (events[events.length - 1]?.kind !== "OFFICIAL_CALL_CHANGED" || events[events.length - 1]?.raceId !== raceId) push("OFFICIAL_CALL", raceId, { candidateId: f.call.winnerId, name: f.call.name }, null, `${f.call.source} called the race`);
      if (s.modelCall && s.modelCall.candidateId !== f.call.winnerId) { s.alerts++; push("ALERT_OFFICIAL_DISAGREES", raceId, { candidateId: f.call.winnerId, name: f.call.name }, null, `the official call is for ${f.call.name}; the model call of ${s.modelCall.calledAt} was for ${s.modelCall.name}`); }
    }
    if (f.settled) { races[raceId] = { ...s, status: "SETTLED_UNCONTESTED", lastObsKey: key, lastSnapshotId: inp.snapshotId, updatedAt: inp.at }; continue; }
    if (!distinct) { races[raceId] = s; continue; }      // the same data again: nothing advances, nothing resets
    s.lastObsKey = key; s.lastSnapshotId = inp.snapshotId; s.updatedAt = inp.at;
    if (s.modelCall) {
      // the call stands. Later trouble is added beside it, never in place of it.
      const called = f.candidates.find((c) => c.candidateId === s.modelCall!.candidateId);
      const pc = called ? (f.rule === "majority_runoff" ? called.outrightProbability ?? 0 : called.winProbability ?? 0) : 0;
      const wasBad = old.status === "MODEL_CALLED" && (old.leader?.candidateId !== old.modelCall?.candidateId || (old.probability ?? 1) < cfg.deteriorationAlert);
      if (pr.leader && pr.leader.candidateId !== s.modelCall.candidateId) { if (!wasBad || old.leader?.candidateId !== pr.leader.candidateId) { s.alerts++; push("ALERT_MODEL_CONTRADICTS_CALL", raceId, pr.leader, pr.p, `the model now favours ${pr.leader.name}; the model call for ${s.modelCall.name} stands on the record`); } }
      else if (pc < cfg.deteriorationAlert && !wasBad) { s.alerts++; push("ALERT_CONFIDENCE_DETERIORATED", raceId, s.modelCall, pc, `probability for the called candidate fell to ${(100 * pc).toFixed(1)}%`); }
      races[raceId] = s; continue;
    }
    if (pr.qualifies && pr.leader) {
      const same = s.qualifyingCandidateId === pr.leader.candidateId;
      s.qualifying = same ? s.qualifying + 1 : 1; s.qualifyingCandidateId = pr.leader.candidateId;
      if (s.qualifying === 1) { s.firstQualifiedAt = inp.at; s.status = "FIRST_QUALIFIED"; push("FIRST_QUALIFIED", raceId, pr.leader, pr.p, `${pr.leader.name} at ${(pr.p as number) >= 0.9995 ? "over 99.9" : (100 * (pr.p as number)).toFixed(2)}%, threshold ${(100 * cfg.threshold).toFixed(1)}%${same ? "" : old.qualifying ? " (a different candidate than before: the sequence restarted)" : ""}`); }
      // a close race must hold its qualification for a while, not just for two updates: a count that looks finished at
      // 9 PM and takes another batch at 9:20 is the commonest way to be wrong
      const lo95 = f.projectedTopTwo?.marginPp.i95.lo ?? null, hold = cfg.close && lo95 != null && lo95 < cfg.close.belowLo ? cfg.close.holdMin : 0;
      const held = s.firstQualifiedAt ? (Date.parse(inp.at) - Date.parse(s.firstQualifiedAt)) / 60_000 : 0;
      if (s.qualifying >= cfg.consecutive && held >= hold) {
        s.status = "MODEL_CALLED"; s.modelCall = { ...pr.leader, calledAt: inp.at, snapshotId: inp.snapshotId, probability: pr.p as number, threshold: cfg.threshold, lane: pr.lane ?? "standard", countedShare: pr.countedShare };
        push("MODEL_CALLED", raceId, pr.leader, pr.p, `${cfg.consecutive} distinct qualifying updates in a row, first at ${s.firstQualifiedAt}${pr.lane === "safe-seat" ? `; safe-seat lane (the forecast's ${(100 * cfg.fast.minPrior).toFixed(0)}%-or-more favourite, ${(100 * (pr.countedShare ?? 0)).toFixed(0)}% of the expected vote counted)` : ""}. A model call, not an official call.`);
        if (s.official && s.official.candidateId !== pr.leader.candidateId) { s.alerts++; push("ALERT_OFFICIAL_DISAGREES", raceId, pr.leader, pr.p, `the model call is for ${pr.leader.name}; the official call is for ${s.official.name}`); }
      }
    } else {
      if (s.qualifying > 0) push("RESET", raceId, pr.leader, pr.p, pr.blockers.length ? `qualification reset: ${pr.blockers[0]}` : `qualification reset: probability ${(100 * (pr.p ?? 0)).toFixed(2)}% is below the threshold`);
      s.qualifying = 0; s.qualifyingCandidateId = null; s.firstQualifiedAt = null;
      s.status = pr.p != null && pr.p >= cfg.approach ? "APPROACHING" : "MONITORING";
    }
    races[raceId] = s;
  }
  return { ...prev, asOf: inp.at, snapshotId: inp.snapshotId, races, events };
}

/** An operator's editorial call: a separate, attributed entry. Never produced by the model, never changes a model call. */
export function recordEditorialCall(prev: Ledger, e: { raceId: string; candidateId: string; name: string; decidedBy: string; decidedAt: string; reason: string }): Ledger {
  const s = prev.races[e.raceId]; if (!s) throw new Error(`unknown race ${e.raceId}`);
  if (!e.decidedBy.trim() || !e.reason.trim()) throw new Error("an editorial call needs a named person and a reason");
  const events = [...prev.events, { seq: prev.events.length + 1, kind: "EDITORIAL_CALL" as const, raceId: e.raceId, at: e.decidedAt, snapshotId: prev.snapshotId ?? "", candidateId: e.candidateId, name: e.name, probability: null, detail: `editorial call by ${e.decidedBy}: ${e.reason}` }];
  return { ...prev, events, races: { ...prev.races, [e.raceId]: { ...s, editorial: { candidateId: e.candidateId, name: e.name, decidedBy: e.decidedBy, decidedAt: e.decidedAt, reason: e.reason, snapshotId: prev.snapshotId } } } };
}

/** Counts for the Calls Desk header. */
export function ledgerSummary(l: Ledger) {
  const v = Object.values(l.races);
  return { monitored: v.length, approaching: v.filter((s) => s.status === "APPROACHING").length, firstQualified: v.filter((s) => s.status === "FIRST_QUALIFIED").length, modelCalled: v.filter((s) => s.modelCall).length,
    official: v.filter((s) => s.official).length, editorial: v.filter((s) => s.editorial).length, alerts: v.reduce((n, s) => n + s.alerts, 0), uncontested: v.filter((s) => s.status === "SETTLED_UNCONTESTED").length };
}
