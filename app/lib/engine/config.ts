// Every number the engine assumes, in one place, with what it means. None of them is calibrated: there is no
// timestamped election-night history in the repository to fit them to (Gate E). They are set to be honest about
// what is NOT known, which mostly means wide. Change them here, bump MODEL_VERSION, and every output says so.

export const MODEL_VERSION = "onpoint-engine/2.4.0";

export type EngineConfig = {
  draws: number;
  /**
   * The seed of every Monte Carlo draw. One fixed seed for the whole night (common random numbers): each race keeps
   * the same draws from one update to the next, so a change between two updates is the data's, not the simulation's.
   * Seeding by snapshot instead made a projected seat total wander by about a seat with no new votes.
   */
  seed: string;
  /**
   * Multiplies the prior spread of every race's final margin. 1 = the published forecast's own spread.
   * The proposed sqrt(2) rule is an EXPERIMENT: set Math.SQRT2 here explicitly to try it. The published pre-election
   * model already applied sqrt(2) to its probabilities (public/forecast/model.json meta.uncertainty), so the forecast
   * spread read here may already include it; applying it again would be a second, separate decision.
   */
  spreadFactor: number;
  turnout: {
    /** sd of the statewide log ratio final / forecast total (0.12 is about +/-12%) */
    sdState: number;
    /** sd of a county's own log ratio, on top of the state's */
    sdUnit: number;
    /** a unit at 100% of precincts still receives late ballots: mean and sd of log(final / counted) */
    lateMean: number; sdComplete: number;
    /**
     * Evidence from the provider's precinct percent: counted / pct is a NOISY estimate of the final, never an identity.
     * The noise does not shrink as the percent nears 100: in the 2026 checkpoints, races at 95-99% of precincts still
     * had 16-27% of their ballots to count (mail and provisional ballots are tallied outside precinct totals).
     */
    sdPrecinct: number; kPrecinct: number; minPctForEvidence: number;
    /**
     * County mode (2.4.0): a county is taken as finished with a chance that rises with how long its count has not
     * moved. Below `fromMin` minutes the chance is 0; it rises in a line to `max` at `fullMin`. It applies only to a
     * county holding at least `minShare` of its forecast vote, and never in `slowStates`: the states that mail every
     * voter a ballot or are known to count for days, and the New England states that report by town, where a quiet
     * county is routinely unfinished. A finished county still receives late ballots: counted x (1 + h), h half-normal
     * with sd `sdLate`. On November 3, 2026, outside the slow states, a county quiet for two to three hours with 60%
     * of its forecast vote was within 5% of its final count 92% of the time, and 97% after four hours. The numbers
     * here are set below those rates on purpose; they are a judgement checked against one night, not a fit.
     */
    quiet: { fromMin: number; fullMin: number; max: number; minShare: number; sdLate: number; slowStates: string[];
      /** past fullMin: the chance rises in a line to maxLong at longMin minutes of quiet, and sdLate falls to sdLateLong */ longMin: number; maxLong: number; sdLateLong: number;
      /** the spread of counties around their state's turnout level is read from the finished counties, the prior (sdUnit) counting as spreadPrior counties, never below spreadFloor */ spreadPrior: number; spreadFloor: number;
      /** the chance that a county which has only just moved is finished, before its place against the state is weighed */ base: number;
      /** the uncertain remainder of an open county (in place of sdRemainder, which is sized for a whole race read from its total) */ sdRemainder: number };
    /**
     * A unit short of 100% of precincts keeps an uncertain remainder on top of what is counted: final >= counted x
     * (1 + h), h half-normal with this sd (mean about 0.8 x sd). It stops "counted already beats the forecast total"
     * from reading as "nothing left to count". A judgement (see sdOrderRace for the same caveat), not a fitted value.
     */
    sdRemainder: number;
    /** hard bound on the log ratio, so a tiny denominator can never project a turnout spike */
    clampLog: number;
    /** share of the statewide turnout surprise that is national (turnout tends to beat or miss forecasts everywhere at once) */
    rhoNational: number;
  };
  margin: {
    /** county noise around the state's swing, margin points */
    sdUnit: number;
    /**
     * Reporting-order bias when the voting method of counted and outstanding ballots is UNKNOWN: the difference in
     * margin between ballots counted so far and ballots still out. Race-wide part and county part, margin points.
     * Wide on purpose: early and mail ballots can differ from Election Day ballots by tens of points.
     * History of this value: 8 in the first draft. The as-of sanity run over the operator's own 2026 export
     * checkpoints (docs/ELECTION_NIGHT_2.md) showed that at 8 the model gave Osborn 98.8% with 39% of
     * precincts in, and Ricketts won by 6.7: the ballots counted first in NE, GA and PA-07 ran 23 to 33 margin
     * points bluer than the rest. 20 is a judgement on the size of such shifts, NOT a value fitted to those races;
     * fitting it belongs to Gate E, on held-out timestamped history.
     */
    sdOrderRace: number; sdOrderUnit: number;
    /**
     * County mode (2.4.0): a county's noise is sqrt(sdUnit^2 + sdUnitSmall^2 x sqrt(2000 / its forecast votes)), so about
     * 8 points for a county of 2,000 votes and 4.5 for one of 200,000: what the 2026 Senate and governor's races
     * showed county by county against their state's swing (7.5 and 4.2; in-sample). unitOutlierZ: a county further
     * than this many predictive sds from the prior is down-weighted by the excess.
     */
    sdUnitSmall: number; unitOutlierZ: number;
    /**
     * County mode: sd, in margin points, of a shift common to every ballot still out in a race, on top of the county
     * forecasts, the swing and the order terms. It is what keeps a projection built from 90 counties from being
     * surer than the night justifies: set so that the 95% ranges of the 2026 Senate and governor's races held the
     * final margin at least 95% of the time at every stage of the count (in-sample; docs, section 9).
     */
    sdOutstanding: number;
    /** the same sd when almost nothing is left to count; the sd moves in a line from this to sdOutstanding as the share still out goes from 0 to outstandingLateBelow */
    sdOutstandingLate: number; outstandingLateBelow: number;
    /** true: sdOutstanding applies to the uncounted ballots of counties still open and sdOutstandingLate to the late ballots of counties taken as finished, each with its own draw; false: one draw for all, sized by the share still out */
    outstandingSplit: boolean;
    minPriorSd: number; maxPriorSd: number;
  };
  others: { sdShift: number; shrinkVotes: number };
  /**
   * Ranked choice: sd of the net share of other candidates' ballots that transfers to one finalist, around the
   * split the published final-round margin implies. 0.15 is a judgement, not a fitted value. The first-choice margin's
   * prior spread is reduced by the same amount, so the published chance is reproduced before any vote.
   */
  rcv: { sdTransfer: number };
  national: {
    /**
     * One structure for both the estimate and the draws, in margin POINTS (a uniform swing):
     *   a race's error from its forecast = national swing + its state's swing + its own,
     * with sd sdNational, sdState and whatever is left of the race's own forecast spread. The national swing is
     * learned from finished races; every race's prior, and how much the races move together in the draws, follow
     * from these same two numbers. They are set so that, before any vote, the engine's House seat range matches the
     * published forecast's own (80% range 219 to 294 Democratic seats; see docs, "Audit"). They are large because
     * the published forecast's stated uncertainty is large (it was widened by sqrt(2) before the election).
     */
    sdNational: number; sdState: number;
    /**
     * How strongly a kind of race follows the national swing (1 = point for point). Governors' races are less
     * nationalised than federal ones, and the published forecast did not widen them: at 0.6 the engine's pre-vote
     * range for governorships matches the published one (26 to 34).
     * Senate 1.15: with independents counted in the Democratic caucus (senate.independentsCaucus), 1.15 brings the
     * pre-vote Senate picture to the published one (chance 82% v 81%, seats 48 to 60 v 48 to 61); at 1 it read 85%.
     */
    loading: Record<string, number>;
    /** how much of the swing's prior variance is kept, per share of races not yet finished, because early finishers are not a random sample (0 = trust them fully) */
    selectionShare: number;
    /**
     * Share of the reporting-order variance that is common to every race: ballots of one kind tend to be counted
     * first across the country on one night (the 2026 checkpoints show early counts running bluer than the rest
     * almost everywhere). Without it, 300 partly counted races "average out" a bias they all share.
     */
    orderNationalShare: number;
    /**
     * In a draw where a majority-runoff race has no first-round majority, the seat is projected for the side with
     * more first-round votes (its leading candidate). The seat is still "not decided" and never called; this only
     * stops projected seat totals from losing every runoff seat (Georgia; Louisiana's 2026 House primaries).
     */
    runoffToFirstRoundSide: boolean;
  };
  /**
   * A race's prior spread is read from the published forecast as |margin| / |z(win chance)|. For a near toss-up both
   * are near zero and the ratio is meaningless (it gave some toss-ups a spread of 1.5 points). Below `minZ` the
   * spread is the median that the published forecast itself implies for well-determined races of the same kind.
   */
  priorSd: { minZ: number; byKind: Record<string, number> };
  /** a model probability shown for an uncalled race never exceeds this (Phase 1 PROB_CEIL) */
  probCeil: number;
  /** use the provider's own winner flags as settled outcomes in national seat counts */
  useProviderCalls: boolean;
  senate: {
    seats: number;
    /** the Vice President's party breaks a 50-50 tie. JD Vance (R) since January 20, 2025. */
    vpParty: "D" | "R";
    /** caucus of independent or third-party winners by candidate name key. Absent = UNKNOWN: never assumed. */
    caucus: Record<string, "D" | "R">;
    /**
     * Where an independent Senate winner is not named in `caucus`: the caucus assumed. Operator decision of
     * November 11, 2026: independents (Osborn in Nebraska and the other independent challengers) are counted with
     * the Democratic caucus. An ASSUMPTION about what a winner would do, stated wherever the Senate number is shown.
     * null = count them for neither party.
     */
    independentsCaucus: "D" | "R" | null;
  };
  house: { seats: number; majority: number };
  governors: { offices: number; majority: number };
};

export const DEFAULT_CONFIG: EngineConfig = {
  draws: 2000,
  seed: "onpoint-2026-11-03",
  spreadFactor: 1,
  turnout: { sdState: 0.12, sdUnit: 0.1, lateMean: 0.02, sdComplete: 0.04, sdPrecinct: 0.2, kPrecinct: 0, minPctForEvidence: 10,
    quiet: { fromMin: 45, fullMin: 150, max: 0.9, minShare: 0.6, base: 0.15, sdLate: 0.008, longMin: 600, maxLong: 0.97, sdLateLong: 0.005, spreadPrior: 5, spreadFloor: 0.03, sdRemainder: 0.06, slowStates: ["AK", "AZ", "CA", "CO", "HI", "IL", "MD", "NJ", "NV", "NY", "OR", "UT", "WA", "CT", "MA", "ME", "NH", "RI", "VT"] },
    sdRemainder: 0.15, clampLog: 1.2, rhoNational: 0.6 },
  margin: { sdUnit: 4, sdUnitSmall: 7, unitOutlierZ: 2.5, sdOrderRace: 20, sdOrderUnit: 6, sdOutstanding: 14, sdOutstandingLate: 25, outstandingLateBelow: 0.3, outstandingSplit: true, minPriorSd: 1.5, maxPriorSd: 20 },
  others: { sdShift: 1, shrinkVotes: 50_000 },
  national: { sdNational: 5.4, sdState: 4, loading: { sen: 1.15, house: 1, gov: 0.6 }, selectionShare: 0.5, orderNationalShare: 0.5, runoffToFirstRoundSide: true },
  priorSd: { minZ: 0.15, byKind: { sen: 9.3, house: 9.4, gov: 6.1, state: 5.7, measure: 20 } },
  probCeil: 0.995,
  useProviderCalls: true,
  senate: { seats: 100, vpParty: "R", caucus: {}, independentsCaucus: "D" },
  rcv: { sdTransfer: 0.15 },
  house: { seats: 435, majority: 218 },
  governors: { offices: 50, majority: 26 },
};

export const withConfig = (over: Partial<EngineConfig> = {}): EngineConfig => ({ ...DEFAULT_CONFIG, ...over });
