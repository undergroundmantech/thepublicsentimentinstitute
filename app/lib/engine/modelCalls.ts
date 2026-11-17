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
  /**
   * When a count has stopped (2.5.0). `quietMin`: minutes without any move in the race's total after which the count is
   * taken as over (`slowQuietMin` in the states that count for days). Then: the recount floor is read on the counted
   * margin (`minCountedMargin` points) instead of the low end of the range, so a finished race at 0.7 points can be
   * called and one at 0.1 cannot; and a race with no forecast at all, which the model cannot reason about, is called
   * for its leader when he is `noForecastMargin` points clear (the "count-settled" lane: arithmetic, not a model).
   * `stepMin`: silence itself is an update. A race whose data has not changed is looked at again after this many
   * minutes, so a count that has gone still can be called without waiting for a correction of three votes.
   */
  /**
   * The final phase (2.5.1). `finalAfterMin` minutes after a race's polls closed (ten days: the canvass is over or
   * nearly so in most states), a count that has stopped is settled by its own arithmetic: the leader in the count is
   * called at `minCountedMargin` points or more (the recount floor) as long as the model still favours him at
   * `finalMinProb`; a 10-point lead is called on a stopped count whatever the provider's percent-reporting field says
   * (the TURNOUT_WEAK_EVIDENCE flag is about that field); and a race with no forecast is called while still counting
   * at `noForecastMargin` points when the lead is `noForecastLeadOver` times the vote listed as uncounted.
   */
  finished?: { finalAfterMin?: number; finalMinProb?: number; quietMin: number; slowQuietMin: number; minCountedMargin: number; noForecastMargin: number; /** a race with no forecast is also called while counting, when the provider lists at least `noForecastMinPct` percent reporting and the lead is `noForecastLeadOver` times the vote that percent leaves uncounted */ noForecastMinPct?: number; noForecastLeadOver?: number; /** and the counted lead is at least this many points (`...Slow` in the states that count for days, where the provider's percent says little) */ noForecastReachMargin?: number; noForecastReachMarginSlow?: number; /** once the count has stopped, a race the model gives at least `settledMinProb` is called on a counted lead of `settledMargin` points, in the count-settled lane */ settledMinProb?: number; settledMargin?: number; stepMin: number; /** and only once the total has been still this long: a second look at data a few minutes old confirms nothing */ stepAfterMin: number };
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
  threshold: 0.993, consecutive: 2, approach: 0.95, mcZ: 2, minCountedShare: 0.5, minNeededShare: 0.6, minNeededOverExpected: 0.1, minMarginLo: 0.5, close: { belowLo: 2, holdMin: 30 }, finished: { finalAfterMin: 14400, finalMinProb: 0.85, quietMin: 4320, slowQuietMin: 7200, minCountedMargin: 0.5, noForecastMargin: 10, noForecastMinPct: 60, noForecastLeadOver: 3, noForecastReachMargin: 20, noForecastReachMarginSlow: 40, settledMinProb: 0.95, settledMargin: 1, stepMin: 30, stepAfterMin: 120 },
  blockingFlags: ["NO_FORECAST", "NO_OBSERVATION", "TEST_DATA", "COUNT_UNKNOWN", "COUNT_EXCEEDS_FORECAST", "COUNT_DECREASED", "UNIT_TOPLINE_MISMATCH", "PROVIDER_ROWS_INCONSISTENT", "AMBIGUOUS_CANDIDATE", "TURNOUT_WEAK_EVIDENCE", "RULE_RANKED_CHOICE", "RULE_NOT_MODELED"],
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
  modelCall: null | { candidateId: string; name: string; partyRaw: string | null; calledAt: string; snapshotId: string; /** null in the count-settled lane, which has no model */ probability: number | null; threshold: number;
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

export type CallLane = "standard" | "safe-seat" | "count-settled" | "uncontested";
/** Polls have closed for a race: the provider's listed closing time has passed, or votes are already reported. */
const closed = (o: RaceObservation | null | undefined, at: string) => !!o && !o.test && ((o.pollsCloseAt ? Date.parse(at) >= Date.parse(o.pollsCloseAt) : false) || o.candidates.some((c) => (c.votes ?? 0) > 0));
type Probe = { leader: RaceCallState["leader"]; p: number | null; se: number | null; countedShare: number | null; outstanding: RaceCallState["outstanding"]; blockers: string[]; qualifies: boolean;
  /** which rule the race qualifies under (null when it does not), and whether it is a safe seat at all */
  lane: CallLane | null; safeSeat: boolean };

/** The leader, the probability and every safeguard for one race at one moment. */
export function probe(f: RaceForecast, cfg: CallConfig, stale: boolean, providerPct: number | null = null, /** minutes since the race's polls closed, where known */ sinceCloseMin: number | null = null): Probe {
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
  const byVotes = [...f.candidates].filter((c) => c.reportedVotes != null).sort((a, b) => (b.reportedVotes as number) - (a.reportedVotes as number));
  // A measure is decided against its bar, not by which side has more votes (2.5.1): Florida's Amendment 2 "led" by 16
  // points and failed at 58%. Its leader in the count is the side the count puts over the bar, and its margin is the
  // Yes share's distance from the bar, doubled so that a 50% bar reads exactly as Yes minus No.
  const mYes = f.rule === "measure" ? f.candidates.find((c) => c.side === "a") : undefined, mNo = f.rule === "measure" ? f.candidates.find((c) => c.side === "b") : undefined;
  const bar = f.rule === "measure" ? f.passShare ?? 0.5 : null, yn = (mYes?.reportedVotes ?? 0) + (mNo?.reportedVotes ?? 0);
  const onBar = bar != null && !!mYes && !!mNo && mYes.reportedVotes != null && mNo.reportedVotes != null && yn > 0;
  const yesShare = onBar ? (mYes!.reportedVotes as number) / yn : null, passing = yesShare != null && (bar! > 0.5 ? yesShare >= bar! : yesShare > 0.5);
  const countLeaderId = onBar ? (passing ? mYes! : mNo!).candidateId : byVotes[0]?.candidateId ?? null;
  const countedMargin = onBar ? 200 * Math.abs((yesShare as number) - bar!)
    : byVotes.length > 1 && f.turnout.counted > 0 ? (100 * ((byVotes[0].reportedVotes as number) - (byVotes[1].reportedVotes as number))) / f.turnout.counted : null;
  const F0 = cfg.finished, finalPhase = !!F0 && F0.finalAfterMin != null && sinceCloseMin != null && sinceCloseMin >= F0.finalAfterMin;
  const over = !!cfg.finished && f.turnout.quietMin != null && f.turnout.quietMin >= (f.turnout.slowCount ? cfg.finished.slowQuietMin : cfg.finished.quietMin);
  // no forecast, so no model: once the count has stopped, a leader far enough ahead has won. Arithmetic, and labelled as such.
  if (cfg.finished && f.flags.includes("NO_FORECAST") && !f.settled && f.rule === "plurality") {
    const bad = cfg.blockingFlags.filter((fl) => fl !== "NO_FORECAST" && f.flags.includes(fl)), b: string[] = [];
    if (stale) b.push("the data is stale"); for (const fl of bad) b.push(`data-quality flag ${fl}`);
    // or before it has stopped, when the lead is several times everything the provider says is still uncounted
    const F = cfg.finished, leadVotes = byVotes.length > 1 ? (byVotes[0].reportedVotes as number) - (byVotes[1].reportedVotes as number) : 0;
    const uncounted = providerPct != null && providerPct > 0 ? (f.turnout.counted * (100 - providerPct)) / providerPct : Infinity;
    // (the provider's percent is of precincts in some states, not of ballots: California showed 100% with half its
    // mail uncounted on election night. So the lead must also be wide in points, and far wider where counts run for days.)
    const reachMargin = f.turnout.slowCount ? F.noForecastReachMarginSlow : F.noForecastReachMargin;
    // (in the final phase the wide-margin guard has done its work: what is left is days of canvass, not half the mail)
    const reach = finalPhase ? F.noForecastMargin : reachMargin;
    const outOfReach = F.noForecastMinPct != null && F.noForecastLeadOver != null && reach != null && providerPct != null && providerPct >= F.noForecastMinPct && leadVotes > F.noForecastLeadOver * uncounted && countedMargin != null && countedMargin >= reach;
    if (countedMargin == null || countedMargin < F.noForecastMargin) b.push(`no forecast for this race, and the leader is under ${F.noForecastMargin} points clear`);
    else if (!over && !outOfReach) b.push(F.noForecastLeadOver != null ? `no forecast for this race: it is called once its count has stopped, or once the lead is ${reachMargin} points and ${F.noForecastLeadOver} times the vote the provider lists as uncounted` : "no forecast for this race: it is called only once its count has stopped");
    const lead = byVotes[0] ?? null;
    return { leader: lead ? { candidateId: lead.candidateId, name: lead.name, partyRaw: lead.partyRaw } : null, p: null, se: null, countedShare, outstanding: null, blockers: b, qualifies: !b.length && !!lead, lane: !b.length && lead ? "count-settled" : null, safeSeat: false };
  }
  if (stale) blockers.push("the data is stale");
  // Ranked choice: the transfers are not modeled well enough to call on, but a majority of first choices needs none.
  // Such a race is called on the chance of that majority, never on the simulated final round.
  const rcv = !!cfg.finished && f.rule === "ranked_choice", pMaj = rcv ? top?.outrightProbability ?? 0 : null;
  // (final phase: a 10-point lead is not held back by the provider's percent-reporting field once the count has
  // stopped, or once the model counts 90% of its expected vote in and is past the call threshold. The flag is about
  // that field, which civicAPI leaves at 0 for some states' measures: Alaska's Measure 3 sat at 68-32 with "0%".)
  const pctMoot = finalPhase && countedMargin != null && countedMargin >= F0!.noForecastMargin && (over || (countedShare != null && countedShare >= 0.9 && p != null && p >= cfg.threshold));
  for (const fl of cfg.blockingFlags) if (f.flags.includes(fl) && !(rcv && fl === "RULE_RANKED_CHOICE") && !(pctMoot && fl === "TURNOUT_WEAK_EVIDENCE")) blockers.push(`data-quality flag ${fl}`);
  if (rcv && (pMaj as number) < cfg.threshold) blockers.push("ranked choice: called only on a certain majority of first choices, and there is none yet");
  if (f.dataState === "MISSING" || f.dataState === "INVALID" || f.dataState === "STALE") blockers.push(`data state ${f.dataState}`);
  if (p == null) blockers.push("no model probability");
  if (countedShare == null || countedShare < cfg.minCountedShare) slow.push(`under ${(100 * cfg.minCountedShare).toFixed(0)}% of the expected vote is counted`);
  const fastFloor = f.flags.includes("COUNTY_MODEL") ? fast?.minCountedShareCounty ?? fast?.minCountedShare : fast?.minCountedShare;
  if (safeSeat && (countedShare == null || countedShare < (fastFloor as number))) blockers.push(`under ${(100 * (fastFloor as number)).toFixed(0)}% of the expected vote is counted (safe-seat floor)`);
  if (!out) blockers.push("no estimate of the outstanding vote");
  // stress test against the high estimate of what is still out
  // (not once the count has stopped: three days of silence is the evidence then, and the tests below are on the votes
  // actually counted. The model's own tail still holds a small chance that the count reopens, which is what kept a
  // finished race at 1.2 points "too open to call" for a week.)
  // (plain plurality races only: a measure with a 60% bar, a runoff rule or ranked choice is not settled by who leads)
  // (a measure counts as one since 2.5.1, measured against its bar)
  const overPl = over && (f.rule === "plurality" || onBar);
  if (overPl && cfg.finished && top) {
    if (countLeaderId !== top.candidateId) blockers.push("the model's leader does not lead the count");
    else if (countedMargin == null || countedMargin < cfg.finished.minCountedMargin) blockers.push(`the count has stopped with the leader under ${cfg.finished.minCountedMargin} points ahead: recount territory`);
  } else if (out && top && f.projectedTopTwo) {
    const sorted = [...f.candidates].filter((c) => c.reportedVotes != null).sort((a, b) => (b.reportedVotes as number) - (a.reportedVotes as number));
    // (a measure: the votes by which the count clears or misses its bar, and the share of what is out that the other
    // side would need to overturn that, which starts from its own side of the bar)
    const lead = onBar ? (countLeaderId === top.candidateId ? 2 * Math.abs((mYes!.reportedVotes as number) - bar! * yn) : -1)
      : sorted.length > 1 && sorted[0].candidateId === top.candidateId ? (sorted[0].reportedVotes as number) - (sorted[1].reportedVotes as number) : -1;
    if (lead < 0) blockers.push("the model's leader does not lead the count");
    else if (out.i95.hi > 0) {
      const needed = (onBar ? (passing ? 1 - bar! : bar!) : 0.5) + lead / (2 * out.i95.hi);
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
    // (once the count has stopped, what matters is the margin actually counted)
    else if (cfg.minMarginLo != null && (over && cfg.finished && countedMargin != null ? countedMargin < cfg.finished.minCountedMargin : f.projectedTopTwo.marginPp.i95.lo < cfg.minMarginLo))
      blockers.push(over ? `the count has stopped with the leader under ${cfg.finished!.minCountedMargin} points ahead: recount territory` : `the 95% range of the projected margin reaches below ${cfg.minMarginLo} points: recount territory`);
  }
  const pc = p != null && pMaj != null ? Math.min(p, pMaj) : p;      // ranked choice: the smaller of the two chances
  const clears = pc != null && se != null && pc >= cfg.threshold && pc - cfg.mcZ * se >= cfg.threshold;
  if (pc != null && pc >= cfg.threshold && !clears) blockers.push("the probability does not clear the threshold after simulation error");
  // the standard rule needs every safeguard; a safe seat may qualify without the two the lane replaces
  const standard = clears && blockers.length === 0 && slow.length === 0, viaFast = !standard && safeSeat && clears && blockers.length === 0;
  // A count that has stopped with the leader clearly ahead settles the race even where the probability sits just
  // under the threshold (the model never quite lets go of the chance that a count reopens): the model must still
  // favour the leader strongly, and the counted lead must be twice the recount floor.
  const F = cfg.finished;
  // (final phase: ten days on, the recount floor and a model that still favours the leader are enough)
  const sProb = finalPhase && F?.finalMinProb != null ? F.finalMinProb : F?.settledMinProb, sMargin = finalPhase && F ? F.minCountedMargin : F?.settledMargin;
  const settled = !standard && !viaFast && overPl && !!F && sProb != null && sMargin != null && pc != null && pc >= sProb && countedMargin != null && countedMargin >= sMargin
    && blockers.every((b) => b === "the probability does not clear the threshold after simulation error") && slow.every((b) => !b.startsWith("under "));
  const all = settled ? [] : safeSeat ? blockers : [...blockers, ...slow];
  if (overPl && F && !standard && !viaFast && !settled && !all.length && pc != null) all.push(`the count has stopped, and the model's ${(100 * pc).toFixed(1)}% is under the threshold with the leader under ${F.settledMargin ?? F.minCountedMargin} points ahead`);
  return { leader: top ? { candidateId: top.candidateId, name: top.name, partyRaw: top.partyRaw } : null, p, se, countedShare, outstanding: out ? { mean: out.mean, hi: out.i95.hi } : null,
    blockers: all, qualifies: standard || viaFast || settled, lane: standard ? "standard" : viaFast ? "safe-seat" : settled ? "count-settled" : null, safeSeat };
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
    // silence is an update too: the same data, looked at again after `stepMin` minutes (only where the source says when the total last moved)
    const quietStep = !!cfg.finished && f.turnout.quietMin != null && f.turnout.quietMin >= cfg.finished.stepAfterMin && !!old.updatedAt && (Date.parse(inp.at) - Date.parse(old.updatedAt)) / 60_000 >= cfg.finished.stepMin;
    const fresh = key !== old.lastObsKey || (finished && inp.snapshotId !== old.lastSnapshotId), distinct = fresh || quietStep;
    const pr = probe(f, cfg, !!inp.stale, obs?.providerPctReporting ?? null, obs?.pollsCloseAt ? (Date.parse(inp.at) - Date.parse(obs.pollsCloseAt)) / 60_000 : null);
    // first-report quarantine: count the distinct updates that carried votes
    const updates = (old.updates ?? 0) + (fresh && f.turnout.counted > 0 ? 1 : 0);      // silence does not count toward the quarantine
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
    if (f.settled) {
      // an unopposed candidate has won when the polls close. Recorded then, in a lane of its own: nothing is modeled.
      const st: RaceCallState = { ...s, status: "SETTLED_UNCONTESTED", lastObsKey: key, lastSnapshotId: inp.snapshotId, updatedAt: inp.at };
      const w = f.candidates.find((c) => c.candidateId === f.settled!.winnerId);
      if (cfg.finished && !st.modelCall && w && closed(obs, inp.at)) {
        st.modelCall = { candidateId: w.candidateId, name: w.name, partyRaw: w.partyRaw, calledAt: inp.at, snapshotId: inp.snapshotId, probability: null, threshold: cfg.threshold, lane: "uncontested", countedShare: null };
        push("MODEL_CALLED", raceId, st.modelCall, null, "unopposed: recorded at poll close. Nothing is modeled.");
      }
      races[raceId] = st; continue;
    }
    if (!distinct) { races[raceId] = s; continue; }      // the same data again: nothing advances, nothing resets
    s.lastObsKey = key; s.lastSnapshotId = inp.snapshotId; s.updatedAt = inp.at;
    if (s.modelCall) {
      // the call stands. Later trouble is added beside it, never in place of it.
      const called = f.candidates.find((c) => c.candidateId === s.modelCall!.candidateId);
      const pc = called ? (f.rule === "majority_runoff" ? called.outrightProbability ?? 0 : called.winProbability ?? 0) : 0;
      // no model stands behind a count-settled call or an unopposed one, so none can turn against it. (An unopposed
      // candidate's race can leave the "settled" path later, when the provider adds a line such as Nevada's "None of
      // These Candidates": the call stands, and there is no probability to alert on.)
      if (s.modelCall.lane === "count-settled" || s.modelCall.lane === "uncontested") { races[raceId] = s; continue; }
      const wasBad = old.status === "MODEL_CALLED" && (old.leader?.candidateId !== old.modelCall?.candidateId || (old.probability ?? 1) < cfg.deteriorationAlert);
      if (pr.leader && pr.leader.candidateId !== s.modelCall.candidateId) { if (!wasBad || old.leader?.candidateId !== pr.leader.candidateId) { s.alerts++; push("ALERT_MODEL_CONTRADICTS_CALL", raceId, pr.leader, pr.p, `the model now favours ${pr.leader.name}; the model call for ${s.modelCall.name} stands on the record`); } }
      else if (pc < cfg.deteriorationAlert && !wasBad) { s.alerts++; push("ALERT_CONFIDENCE_DETERIORATED", raceId, s.modelCall, pc, `probability for the called candidate fell to ${(100 * pc).toFixed(1)}%`); }
      races[raceId] = s; continue;
    }
    if (pr.qualifies && pr.leader) {
      const same = s.qualifyingCandidateId === pr.leader.candidateId;
      s.qualifying = same ? s.qualifying + 1 : 1; s.qualifyingCandidateId = pr.leader.candidateId;
      if (s.qualifying === 1) { s.firstQualifiedAt = inp.at; s.status = "FIRST_QUALIFIED"; push("FIRST_QUALIFIED", raceId, pr.leader, pr.p, pr.p == null ? `${pr.leader.name}: the count has stopped with him far ahead (no forecast for this race)` : `${pr.leader.name} at ${(pr.p as number) >= 0.9995 ? "over 99.9" : (100 * (pr.p as number)).toFixed(2)}%, threshold ${(100 * cfg.threshold).toFixed(1)}%${same ? "" : old.qualifying ? " (a different candidate than before: the sequence restarted)" : ""}`); }
      // a close race must hold its qualification for a while, not just for two updates: a count that looks finished at
      // 9 PM and takes another batch at 9:20 is the commonest way to be wrong
      const lo95 = f.projectedTopTwo?.marginPp.i95.lo ?? null, hold = cfg.close && lo95 != null && lo95 < cfg.close.belowLo ? cfg.close.holdMin : 0;
      const held = s.firstQualifiedAt ? (Date.parse(inp.at) - Date.parse(s.firstQualifiedAt)) / 60_000 : 0;
      if (s.qualifying >= cfg.consecutive && held >= hold) {
        s.status = "MODEL_CALLED"; s.modelCall = { ...pr.leader, calledAt: inp.at, snapshotId: inp.snapshotId, probability: pr.p, threshold: cfg.threshold, lane: pr.lane ?? "standard", countedShare: pr.countedShare };
        push("MODEL_CALLED", raceId, pr.leader, pr.p, `${cfg.consecutive} distinct qualifying updates in a row, first at ${s.firstQualifiedAt}${pr.lane === "safe-seat" ? `; safe-seat lane (the forecast's ${(100 * cfg.fast.minPrior).toFixed(0)}%-or-more favourite, ${(100 * (pr.countedShare ?? 0)).toFixed(0)}% of the expected vote counted)` : pr.lane === "count-settled" ? "; count-settled lane (no forecast for this race: the count has stopped and the leader is far ahead)" : ""}. A model call, not an official call.`);
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
