/**
 * TPSI — South Carolina US Senate Special Republican Runoff
 * Statewide forecast · Election August 25, 2026
 *
 * WHAT IS MEASURED AND WHAT IS NOT
 * Two inputs here are given: Graham's 57.9% win probability and the turnout
 * assumption. Everything else is arithmetic on those two.
 *
 * There is no TPSI poll of this runoff. The win probability is a desk judgement
 * from the first-round result, endorsements and the runoff's compressed
 * calendar — not a survey. That is why this race gets a statewide forecast and
 * no county model: a county decomposition needs a sample to decompose, and we
 * do not have one. Publishing 46 county estimates off a desk judgement would
 * dress a hunch up as data.
 *
 * DERIVING THE MARGIN
 * A win probability alone does not pin a margin; it pins the ratio of margin to
 * its standard deviation. We assume SD = 8.5 points on the two-way margin —
 * wider than the 7.9 the Oklahoma model carries, because Oklahoma has a poll
 * behind it and this does not. The margin then follows:
 *
 *     margin = z(0.579) * 8.5 = 0.20 * 8.5 = 1.7 points
 *
 * If you disagree with the SD, the margin moves with it and the probability
 * does not. The probability is the input; the margin is the output.
 */

export type ScCandidateKey = "graham" | "norman";

export const SC_CANDIDATE_ORDER: ScCandidateKey[] = ["graham", "norman"];

export const SC_CANDIDATE_NAMES: Record<ScCandidateKey, string> = {
  graham: "Darline Graham",
  norman: "Ralph Norman",
};

export const SC_CANDIDATE_LAST: Record<ScCandidateKey, string> = {
  graham: "Graham",
  norman: "Norman",
};

/** Substring that identifies each candidate in the CivicAPI feed. */
export const SC_CANDIDATE_MATCH: Record<ScCandidateKey, string> = {
  graham: "graham",
  norman: "norman",
};

export const SC_TURNOUT_MODEL = {
  /** Ballots cast in the first round of the special primary. */
  firstRound: 465_076,
  /** Runoff turnout as a share of the first round. Runoffs fall off sharply. */
  dropoffFactor: 0.6,
  /** firstRound * dropoffFactor. */
  projected: 279_046,
};

export const SC_FORECAST = {
  graham: 50.9,
  norman: 49.1,
  votes: { graham: 142_034, norman: 137_012 },
  leader: "graham" as ScCandidateKey,
  runnerUp: "norman" as ScCandidateKey,
  /** Graham − Norman, percentage points. Derived from the win probability. */
  margin: 1.7,
  /** Assumed, not measured. See the header. */
  marginSd: 8.5,
  /** 90% interval on the margin. */
  ci90: [-12.3, 15.7] as [number, number],
  winProbability: { graham: 57.9, norman: 42.1 },
};

export const SC_FORECAST_META = {
  /** No survey behind this race — the probability is a desk judgement. */
  hasPoll: false,
  countyModel: false,
  raceRule: "PLURALITY" as const,
  basis:
    "First-round result, endorsement movement and historical runoff dropoff. " +
    "No TPSI poll of the runoff was fielded.",
};
