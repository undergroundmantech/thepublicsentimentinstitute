// Shadow projection: combines the forecast, the reported vote, the outstanding estimate, geography and method
// evidence, and says only what that evidence supports.
//
// What it computes is arithmetic on stated inputs:
//   - the share of the expected final vote that is counted, as a range
//   - the share of the outstanding vote the trailing side would need to draw level
//   - whether the lead exceeds the high estimate of everything outstanding (context, never a race call)
//   - two labeled conditional scenarios for the final margin
// What it does not compute is a win probability: that needs an error model for the outstanding vote, fitted and
// backtested on timestamped returns. Until then it is UNAVAILABLE rather than approximated with made-up spreads.

import type { BaselineRace, Interval, OutstandingInventory, ReconciledReturns, ShadowProjection, ShadowScenario } from "./types";

const pct = (x: number) => Math.round(x * 1000) / 10;

export function shadowProject(returns: ReconciledReturns, inv: OutstandingInventory | null, baseline: BaselineRace | null): ShadowProjection {
  const reasons: string[] = [];
  const { a, b, t } = returns.reported;
  const reportedMargin = t > 0 ? (100 * (b - a)) / t : null;
  const leader = b > a ? "B" : a > b ? "A" : null;
  const votesAhead = Math.abs(b - a);
  const N = inv?.estimatedOutstanding ?? null;
  const expectedFinal = inv?.expectedFinal ?? null;
  const notYet = inv?.notYetEligible.value ?? 0;

  const shareOfExpectedCounted: Interval | null = expectedFinal && expectedFinal.high > 0
    ? { low: pct(t / expectedFinal.high), central: expectedFinal.central ? pct(t / expectedFinal.central) : null, high: expectedFinal.low > 0 ? pct(t / expectedFinal.low) : 100 }
    : null;

  // two-party share of n outstanding votes the trailing side needs: (n + lead) / 2n
  const need = (n: number) => (n > 0 ? (n + votesAhead) / (2 * n) : null);
  let trailingNeedsShare: Interval | null = null;
  if (N && leader && N.high > 0) {
    const lo = need(N.high), hi = need(N.low), c = N.central === null ? null : need(N.central);
    trailingNeedsShare = { low: lo as number, central: c, high: hi ?? Infinity };
  }
  const leadExceedsOutstandingHigh = N && leader ? votesAhead > N.high + notYet : N ? false : null;

  const scenarios: ShadowScenario[] = [];
  if (reportedMargin !== null) {
    scenarios.push({ id: "OUTSTANDING_SPLITS_LIKE_REPORTED", description: "If every outstanding vote splits like the votes counted so far. The final margin is then the reported margin, whatever the turnout.", finalMargin: { low: reportedMargin, central: reportedMargin, high: reportedMargin } });
  }
  if (baseline && N) {
    const fm = (n: number) => (t + n > 0 ? (100 * (b - a + (baseline.margin / 100) * n)) / (t + n) : null);
    const x = fm(N.low), y = fm(N.high), c = N.central === null ? null : fm(N.central);
    if (x !== null && y !== null) scenarios.push({ id: "OUTSTANDING_SPLITS_LIKE_FORECAST", description: `If the outstanding vote splits at the October 25 forecast margin (${baseline.margin > 0 ? "R" : "D"} +${Math.abs(baseline.margin).toFixed(1)}). Range over the outstanding estimate.`, finalMargin: { low: Math.min(x, y), central: c, high: Math.max(x, y) } });
  }

  let status: ShadowProjection["status"];
  if (!inv || !expectedFinal) { status = "UNAVAILABLE"; reasons.push("no usable expected final turnout, so nothing about the outstanding vote can be said"); }
  else if (inv.uncertainty !== "QUANTIFIED") { status = "PARTIAL"; reasons.push("the turnout expectation has no stated range; shares and scenarios are point values"); }
  else status = "AVAILABLE";
  if (t === 0) { if (status === "AVAILABLE") status = "PARTIAL"; reasons.push("no votes reported"); }
  if (!baseline) reasons.push("no forecast baseline for this race");
  if (inv?.unknownInventory) reasons.push("no official statement of outstanding ballots; the inventory is estimated only");

  return {
    status, reasons, reportedMargin, expectedFinal, shareOfExpectedCounted,
    arithmetic: { leader, votesAhead, trailingNeedsShare, leadExceedsOutstandingHigh },
    scenarios,
    winProbability: { status: "UNAVAILABLE", reason: "requires an outstanding-vote error model backtested on timestamped historical returns (not in Phase 1)" },
  };
}
