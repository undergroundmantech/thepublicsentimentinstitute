// Reporting composition: what the returns are made of by voting method, and the reporting context around them.
//
// Measured and estimated stay apart. A method's reported votes are only what the live source attributes to it; the
// rest is UNKNOWN. Historical method shares are shown with their year as context for 2026, not as a forecast of
// it. No method is assumed to favor a party, and the remaining vote by method is not estimated in Phase 1: that
// needs a method model backtested against timestamped history the repository does not yet have.

import type { Issue, MethodComposition, MethodHistoryRecord, OutstandingReportRecord, ReconciledReturns, ReportingContext, ResearchRecord } from "./types";
import { VOTING_METHODS } from "./types";

export function composeMethods(raceId: string, returns: ReconciledReturns, records: ResearchRecord[], confirmedSources: string[]): { composition: MethodComposition; issues: Issue[] } {
  const issues: Issue[] = [];
  const hist = records.filter((r): r is MethodHistoryRecord =>
    r.recordType === "METHOD_HISTORY" && r.provenance.evidenceClass !== "UNKNOWN" && (r.raceId === raceId || r.jurisdictionLevel === "STATE"));
  const used = new Set(confirmedSources);
  const official = records.filter((r): r is OutstandingReportRecord => r.recordType === "OUTSTANDING_REPORT" && used.has(r.recordId) && r.method !== null);

  const methods = VOTING_METHODS.map((method) => {
    const m = returns.byMethod[method];
    const historical = hist.filter((r) => r.method === method && r.provenance.evidenceClass === "HISTORICAL")
      .map((r) => ({ year: r.provenance.historicalYear as number, share: r.shareOfTotal, votes: r.votes, recordId: r.recordId, sourceUrl: r.provenance.sourceUrl }))
      .sort((a, b) => b.year - a.year);
    const off = official.filter((r) => r.method === method);
    return {
      method,
      reported: m ? m.t : null,
      historical,
      officialOutstanding: off.length ? off.reduce((s, r) => s + (r.outstanding ?? 0), 0) : null,
      estimatedRemaining: null,
      estimatedRemainingStatus: "UNAVAILABLE" as const,
    };
  });
  const t = returns.reported.t;
  const unknown = returns.byMethod.UNKNOWN?.t ?? 0;
  const knownMethodShare = t > 0 ? Math.max(0, (t - unknown) / t) : null;
  if (t > 0 && knownMethodShare === 0) issues.push({ code: "NO_METHOD_DATA", severity: "INFO", message: "the live source gives no method breakdown; every reported vote is method UNKNOWN" });
  const years = new Set(hist.filter((r) => r.provenance.evidenceClass === "HISTORICAL").map((r) => r.provenance.historicalYear));
  if (years.size) issues.push({ code: "HISTORICAL_CONTEXT", severity: "INFO", message: `method history from ${[...years].sort().join(", ")} is shown as context; 2026 procedures and behavior may differ` });
  return { composition: { methods, knownMethodShare }, issues };
}

export function reportingContext(records: ResearchRecord[], asOf: string): { context: ReportingContext; issues: Issue[] } {
  const issues: Issue[] = [];
  const now = Date.parse(asOf);
  const pollClose: ReportingContext["pollClose"] = [];
  for (const r of records) {
    if (r.recordType === "POLL_CLOSE" && !r.closesAtUtc && r.closesLocal && r.provenance.evidenceClass === "VERIFIED") {
      issues.push({ code: "POLL_CLOSE_PER_COUNTY", severity: "INFO", message: `${r.recordId}: polls close at ${r.closesLocal} local time in each county; no statewide instant exists, so polls-closed status stays UNKNOWN until county time zones are researched` });
      continue;
    }
    if (r.recordType !== "POLL_CLOSE" || !r.closesAtUtc) continue;
    if (r.provenance.evidenceClass !== "VERIFIED" || !r.closesAtUtc.startsWith("2026-")) {
      issues.push({ code: "NOT_APPLICABLE_2026", severity: "INFO", message: `${r.recordId}: ${r.provenance.evidenceClass} closing time ${r.closesAtUtc} is not used as a 2026 closing time` });
      continue;
    }
    pollClose.push({ jurisdictionId: r.jurisdictionId, closesAtUtc: r.closesAtUtc, recordId: r.recordId, sourceUrl: r.provenance.sourceUrl });
  }
  const closed = pollClose.filter((p) => Date.parse(p.closesAtUtc) <= now).length;
  const pollsClosed: ReportingContext["pollsClosed"] = !pollClose.length ? "UNKNOWN" : closed === pollClose.length ? "ALL" : closed ? "SOME" : "NONE";

  const historicalWindows: ReportingContext["historicalWindows"] = records
    .filter((r) => r.recordType === "REPORTING_WINDOW" && r.provenance.evidenceClass !== "UNKNOWN")
    .map((r) => {
      const w = r as Extract<ResearchRecord, { recordType: "REPORTING_WINDOW" }>;
      return {
        jurisdictionId: w.jurisdictionId, method: w.method, year: w.provenance.historicalYear ?? 2026, window: w.reportingWindow,
        shareReported: w.shareReported, sequenceRank: w.sequenceRank, recordId: w.recordId, sourceUrl: w.provenance.sourceUrl, confidence: w.provenance.confidence,
      };
    })
    .sort((a, b) => b.year - a.year || (a.sequenceRank ?? 99) - (b.sequenceRank ?? 99));

  const deadlines = records
    .filter((r) => r.recordType === "BALLOT_DEADLINE" && r.provenance.evidenceClass !== "UNKNOWN")
    .map((r) => { const d = r as Extract<ResearchRecord, { recordType: "BALLOT_DEADLINE" }>; return { kind: d.deadlineKind, deadlineUtc: d.deadlineUtc, recordId: d.recordId, sourceUrl: d.provenance.sourceUrl }; });

  if (!pollClose.length) issues.push({ code: "MISSING_RESEARCH", severity: "WARNING", message: "no VERIFIED 2026 poll closing time" });
  if (!historicalWindows.length) issues.push({ code: "MISSING_RESEARCH", severity: "INFO", message: "no reporting-window history" });
  return { context: { pollsClosed, pollClose, historicalWindows, deadlines, windowsAreHistoricalContextOnly: true }, issues };
}
