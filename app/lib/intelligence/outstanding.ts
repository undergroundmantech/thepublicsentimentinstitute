// Outstanding vote estimator.
//
//   Expected final votes = reported votes + estimated outstanding votes
//
// The inventory keeps apart what is measured and what is estimated:
//   reported                          counted and published
//   officially confirmed outstanding  an official statement of ballots still to count (VERIFIED research)
//   not yet eligible                  ballots that may still arrive or be cured (VERIFIED research)
//   estimated outstanding             expected final turnout minus reported, an estimate with its stated range
//   unknown inventory                 true when no official statement of the outstanding ballots is usable
//
// The estimate never comes from precincts reporting. It comes from a turnout expectation: a research record with
// its own low and high, or else the forecast's expected total, which has no stated range and is reported as
// UNQUANTIFIED. No spread is invented around a point.

import type { EstimatorRung, EstimatorTier, EvidenceClass, Interval, Issue, OutstandingInventory, OutstandingReportRecord, Quantity, ResearchRecord, TurnoutExpectationRecord } from "./types";

export interface OutstandingInput {
  raceId: string;
  office: "senate" | "governor" | "house";
  asOf: string;
  reported: number;
  /** Latest source timestamp per reporting jurisdiction id, and "TOPLINE" for the race total. */
  latestByJurisdiction: Record<string, string | null>;
  records: ResearchRecord[];
  /** Postal code of the race's state, used only to find a verified method inventory. */
  state?: string;
  /** The OnPoint forecast's expected total vote for the race, if it has one. */
  forecastExpectedTotal: number | null;
  forecastSource: string | null;
}

const ms = (s: string | null | undefined) => (s ? Date.parse(s) : NaN);

/** Usable official statements of one status: as of the evaluation time, the newest per jurisdiction and method. */
function officialStatements(input: OutstandingInput, status: OutstandingReportRecord["outstandingStatus"], issues: Issue[]): { quantity: Quantity; used: OutstandingReportRecord[] } {
  const cutoff = ms(input.asOf);
  const all = input.records.filter((r): r is OutstandingReportRecord =>
    r.recordType === "OUTSTANDING_REPORT" && r.outstandingStatus === status && r.provenance.evidenceClass === "VERIFIED" && r.outstanding !== null &&
    // a county statement covers every race on that county's ballot; for a district race only a statement made for the race itself applies
    (r.raceId === input.raceId || (r.raceId === null && input.office !== "house")));
  const current = all.filter((r) => !(ms(r.asOf) > cutoff));
  const newest = new Map<string, OutstandingReportRecord>();
  for (const r of current) {
    const k = `${r.jurisdictionId}|${r.method ?? "ALL"}`;
    const p = newest.get(k);
    if (!p || ms(r.asOf) > ms(p.asOf)) newest.set(k, r);
  }
  let pool = [...newest.values()];
  // a statewide statement and county statements describe the same ballots; prefer the statewide one
  const top = pool.filter((r) => r.jurisdictionLevel === "STATE" || r.jurisdictionLevel === "DISTRICT");
  if (top.length && pool.length > top.length) {
    issues.push({ code: "OVERLAPPING_STATEMENTS", severity: "INFO", message: `${status}: statewide and jurisdiction statements both present; the statewide statement is used` });
    pool = top;
  }
  // with a method breakdown and an all-method figure for the same jurisdiction, use the all-method figure
  const byJ = new Map<string, OutstandingReportRecord[]>();
  for (const r of pool) byJ.set(r.jurisdictionId, [...(byJ.get(r.jurisdictionId) ?? []), r]);
  const used: OutstandingReportRecord[] = [];
  for (const rs of byJ.values()) { const allM = rs.find((r) => r.method === null); used.push(...(allM ? [allM] : rs)); }
  // a statement older than the latest returns from its jurisdiction may already be partly counted
  const fresh = used.filter((r) => {
    const latest = input.latestByJurisdiction[r.jurisdictionLevel === "STATE" || r.jurisdictionLevel === "DISTRICT" ? "TOPLINE" : r.jurisdictionId];
    if (latest && ms(r.asOf) < ms(latest)) {
      issues.push({ code: "STALE_STATEMENT", severity: "WARNING", message: `${r.recordId}: official statement as of ${r.asOf} predates returns at ${latest}; not used` });
      return false;
    }
    return true;
  });
  if (!fresh.length) return { quantity: { value: null, evidenceClass: "UNKNOWN", sources: [] }, used: [] };
  return { quantity: { value: fresh.reduce((s, r) => s + (r.outstanding ?? 0), 0), evidenceClass: "VERIFIED", sources: fresh.map((r) => r.recordId) }, used: fresh };
}

export function estimateOutstanding(input: OutstandingInput): { inventory: OutstandingInventory; issues: Issue[] } {
  const issues: Issue[] = [];
  const reported = input.reported;
  const confirmed = officialStatements(input, "CONFIRMED", issues);
  const notYet = officialStatements(input, "NOT_YET_ELIGIBLE", issues);

  // turnout expectation for the race as a whole
  const exp = input.records.filter((r): r is TurnoutExpectationRecord =>
    r.recordType === "TURNOUT_EXPECTATION" && r.raceId === input.raceId && (r.jurisdictionLevel === "STATE" || r.jurisdictionLevel === "DISTRICT") &&
    r.provenance.evidenceClass !== "UNKNOWN" && r.expectedLow !== null && r.expectedHigh !== null);
  const countyLevel = input.records.filter((r) => r.recordType === "TURNOUT_EXPECTATION" && r.raceId === input.raceId && r.jurisdictionLevel !== "STATE" && r.jurisdictionLevel !== "DISTRICT");
  if (countyLevel.length) issues.push({ code: "UNUSED_INPUT", severity: "INFO", message: `${countyLevel.length} jurisdiction-level turnout expectation(s) are not combined in Phase 1` });

  let band: Interval | null = null;
  let basis: OutstandingInventory["turnoutBasis"] = { kind: "NONE", recordIds: [], evidenceClass: "UNKNOWN" };
  let uncertainty: OutstandingInventory["uncertainty"] = "UNAVAILABLE";

  if (exp.length) {
    const lo = Math.min(...exp.map((r) => r.expectedLow as number)), hi = Math.max(...exp.map((r) => r.expectedHigh as number));
    const disjoint = exp.some((x) => exp.some((y) => (x.expectedHigh as number) < (y.expectedLow as number)));
    if (disjoint) issues.push({ code: "CONTRADICTORY_METADATA", severity: "WARNING", message: `turnout expectations do not overlap (${exp.map((r) => `${r.recordId} ${r.expectedLow}-${r.expectedHigh}`).join("; ")}); the envelope ${lo}-${hi} is used` });
    const centrals = exp.filter((r) => r.expectedCentral !== null);
    const central = exp.length === 1 && centrals.length === 1 ? (centrals[0].expectedCentral as number) : null;
    if (reported > hi) {
      issues.push({ code: "BAD_TURNOUT_ESTIMATE", severity: "ERROR", message: `reported ${reported} exceeds the high turnout expectation ${hi}; the research expectation is discarded` });
    } else {
      band = { low: lo, central, high: hi };
      const ev: EvidenceClass = exp.every((r) => r.provenance.evidenceClass === "VERIFIED") ? "VERIFIED" : "INFERRED";
      basis = { kind: "RESEARCH", recordIds: exp.map((r) => r.recordId), evidenceClass: ev };
      uncertainty = "QUANTIFIED";
      if (reported > lo) issues.push({ code: "TURNOUT_LOW_EXCEEDED", severity: "INFO", message: `reported ${reported} is above the low expectation ${lo}; the low end of outstanding is 0` });
    }
  }
  if (!band && input.forecastExpectedTotal !== null && input.forecastExpectedTotal > 0) {
    const T = input.forecastExpectedTotal;
    if (reported > T) issues.push({ code: "BAD_TURNOUT_ESTIMATE", severity: "ERROR", message: `reported ${reported} exceeds the forecast's expected total ${T}; it is not used` });
    else {
      band = { low: T, central: T, high: T };
      basis = { kind: "FORECAST_EXPECTED_TOTAL", recordIds: input.forecastSource ? [input.forecastSource] : [], evidenceClass: "INFERRED" };
      uncertainty = "UNQUANTIFIED";
      issues.push({ code: "UNQUANTIFIED_UNCERTAINTY", severity: "WARNING", message: "turnout comes from the forecast's expected total, which states no range; no range is invented" });
    }
  }

  let estimated: Interval | null = band
    ? { low: Math.max(0, band.low - reported), central: band.central === null ? null : Math.max(0, band.central - reported), high: Math.max(0, band.high - reported) }
    : null;

  // an official count of ballots still to count is a floor on what is outstanding
  if (estimated && confirmed.quantity.value !== null) {
    const c = confirmed.quantity.value;
    if (c > estimated.high) {
      issues.push({ code: "BAD_TURNOUT_ESTIMATE", severity: "ERROR", message: `officially confirmed outstanding ${c} exceeds the estimated high ${Math.round(estimated.high)}; the turnout expectation is contradicted and discarded` });
      estimated = null; basis = { kind: "NONE", recordIds: [], evidenceClass: "UNKNOWN" }; uncertainty = "UNAVAILABLE";
    } else if (c > estimated.low) {
      estimated = { low: c, central: estimated.central === null ? null : Math.max(c, estimated.central), high: estimated.high };
    }
  }
  if (!estimated) issues.push({ code: "OUTSTANDING_UNAVAILABLE", severity: "WARNING", message: "no usable turnout expectation; estimated outstanding is unavailable" });

  const expectedFinal: Interval | null = estimated
    ? { low: reported + estimated.low, central: estimated.central === null ? null : reported + estimated.central, high: reported + estimated.high }
    : null;

  // which rung the figure rests on
  const officialUsed = confirmed.quantity.value !== null;
  const methodInventory = input.records.filter((r) => r.recordType === "METHOD_HISTORY" && r.provenance.evidenceClass === "VERIFIED" && input.state !== undefined && r.state === input.state);
  const tier: EstimatorTier = officialUsed ? "OFFICIAL_JURISDICTION_COUNT" : !estimated ? "UNKNOWN" : basis.kind === "RESEARCH" ? "HISTORICAL_ESTIMATE_WITH_RANGE" : "FORECAST_POINT_NO_RANGE";
  const rung = (t: EstimatorTier, present: boolean, detail: string, absent: string): EstimatorRung => ({ tier: t, status: tier === t ? "USED" : present ? "PRESENT_NOT_USED" : "ABSENT", detail: present || tier === t ? detail : absent });
  const ladder: EstimatorRung[] = [
    rung("OFFICIAL_JURISDICTION_COUNT", officialUsed, `official statement(s): ${confirmed.used.map((r) => r.recordId).join(", ")}`, "no usable official statement of ballots still to count"),
    rung("VERIFIED_METHOD_INVENTORY", methodInventory.length > 0, `${methodInventory.length} verified ballot-count record(s) by method exist, but they cannot be netted against counted votes: the returns carry no method label`, "no verified method inventory for this state"),
    rung("HISTORICAL_ESTIMATE_WITH_RANGE", basis.kind === "RESEARCH", `turnout expectation with its own range (${basis.recordIds.join(", ")}); not backtested`, "no turnout expectation with a stated range"),
    rung("FORECAST_POINT_NO_RANGE", basis.kind === "FORECAST_EXPECTED_TOTAL", "the forecast's expected total, a point with no stated range", "no forecast expected total used"),
    { tier: "UNKNOWN", status: tier === "UNKNOWN" ? "USED" : "ABSENT", detail: tier === "UNKNOWN" ? "no usable basis; no outstanding figure is produced" : "not needed: a higher rung supplies the figure" },
  ];
  const officialScope: OutstandingInventory["officialScope"] = !officialUsed ? null : confirmed.used.every((r) => r.jurisdictionLevel === "STATE" || r.jurisdictionLevel === "DISTRICT") ? "STATEWIDE_OR_DISTRICT" : "COUNTIES";
  if (officialScope === "COUNTIES") issues.push({ code: "OFFICIAL_SCOPE_PARTIAL", severity: "INFO", message: "the official outstanding figure sums county statements, which may not cover every jurisdiction of the race" });

  return {
    inventory: {
      reported,
      officiallyConfirmedOutstanding: confirmed.quantity,
      notYetEligible: notYet.quantity,
      estimatedOutstanding: estimated,
      expectedFinal,
      tier,
      ladder,
      officialScope,
      uncertainty,
      turnoutBasis: basis,
      unknownInventory: confirmed.quantity.value === null,
    },
    issues,
  };
}
