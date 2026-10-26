// SYNTHETIC FIXTURES. Every number, timestamp and URL in this file is invented to exercise the software. None of it
// is research, none of it describes a real count, and no result produced from it is a backtest.

import type { BaselineRace, LoggedObservation, ResearchRecord, VoteObservation } from "../../app/lib/intelligence/types";

export const SYNTHETIC = "SYNTHETIC" as const;
export const URL_BASE = "https://example.org/SYNTHETIC";

export const BASE_SEN: BaselineRace = { raceId: "sen-GA", office: "senate", state: "GA", district: null, name: "SYNTHETIC Georgia Senate", sideA: "Synthetic A", sideB: "Synthetic B", margin: -2, probB: 0.4, p10: -8, p90: 4 };
export const BASE_HOUSE: BaselineRace = { raceId: "house-PA-07", office: "house", state: "PA", district: 7, name: "SYNTHETIC Pennsylvania 7", sideA: "Synthetic A", sideB: "Synthetic B", margin: 1, probB: 0.55, p10: -5, p90: 7 };
export const KNOWN = new Set(["sen-GA", "house-PA-07", "gov-AZ"]);

let n = 0;
export function obs(p: Partial<VoteObservation> & { raceId?: string; a?: number; b?: number; o?: number }): VoteObservation {
  return {
    raceId: p.raceId ?? "sen-GA",
    jurisdictionId: p.jurisdictionId ?? "STATE",
    jurisdictionLevel: p.jurisdictionLevel ?? "STATE",
    scope: p.scope ?? "WHOLE",
    method: p.method ?? "UNKNOWN",
    sides: p.sides ?? { a: p.a ?? 0, b: p.b ?? 0, o: p.o ?? 0 },
    precinctsReportingPct: p.precinctsReportingPct ?? null,
    sourceTimestamp: p.sourceTimestamp === undefined ? "2026-11-04T01:00:00Z" : p.sourceTimestamp,
    retrievedAt: p.retrievedAt ?? "2026-11-04T01:00:30Z",
    source: "SYNTHETIC fixture",
    sourceUrl: null,
    test: p.test ?? false,
  };
}

export function log(...os: VoteObservation[]): LoggedObservation[] {
  return os.map((o) => ({ seq: ++n, observation: o, raw: { synthetic: true } }));
}

const prov = (over: Partial<ResearchRecord["provenance"]> = {}): ResearchRecord["provenance"] => ({
  evidenceClass: "VERIFIED", valueKind: "OBSERVATION", sourceUrl: `${URL_BASE}/source`, sourceName: "SYNTHETIC", publishedAt: "2026-10-01T00:00:00Z",
  retrievedAt: "2026-10-20T00:00:00Z", historicalYear: null, confidence: "MEDIUM", limitations: ["SYNTHETIC"], ...over,
});
const base = { state: "GA", jurisdictionId: "STATE", jurisdictionLevel: "STATE" as const, method: null, reportingWindow: null, notes: SYNTHETIC, packageId: "synthetic-fixture", synthetic: true };

export const turnout = (raceId: string, low: number, central: number | null, high: number, evidenceClass: "VERIFIED" | "INFERRED" = "INFERRED", id = `t-${raceId}-${low}`): ResearchRecord => ({
  ...base, state: raceId.split("-")[1], jurisdictionLevel: raceId.startsWith("house") ? "DISTRICT" : "STATE", jurisdictionId: raceId.startsWith("house") ? "PA-07" : "STATE",
  recordId: id, recordType: "TURNOUT_EXPECTATION", raceId, expectedLow: low, expectedCentral: central, expectedHigh: high,
  provenance: prov({ evidenceClass, valueKind: evidenceClass === "VERIFIED" ? "OBSERVATION" : "ESTIMATE" }),
});

export const outstanding = (o: { id: string; raceId?: string | null; state?: string; jurisdictionId?: string; level?: "STATE" | "COUNTY" | "DISTRICT"; method?: ResearchRecord["method"]; n: number; asOf: string; status?: "CONFIRMED" | "NOT_YET_ELIGIBLE" }): ResearchRecord => ({
  ...base, state: o.state ?? "GA", jurisdictionId: o.jurisdictionId ?? "STATE", jurisdictionLevel: o.level ?? "STATE", method: o.method ?? null,
  recordId: o.id, recordType: "OUTSTANDING_REPORT", raceId: o.raceId ?? null, outstanding: o.n, outstandingStatus: o.status ?? "CONFIRMED", asOf: o.asOf, provenance: prov(),
});

export const split = (id: string, county: string, district: string, weight: number): ResearchRecord => ({
  ...base, state: "PA", jurisdictionId: county, jurisdictionLevel: "COUNTY", recordId: id, recordType: "GEO_SPLIT", raceId: null,
  countyFips: county, districtId: district, weight, weightBasis: "SYNTHETIC population share", provenance: prov({ historicalYear: 2026 }),
});

export const pollClose = (id: string, at: string, evidenceClass: "VERIFIED" | "HISTORICAL" = "VERIFIED", year: number | null = null): ResearchRecord => ({
  ...base, recordId: id, recordType: "POLL_CLOSE", raceId: null, closesAtUtc: at, provenance: prov({ evidenceClass, historicalYear: year }),
});

export const methodHistory = (id: string, method: ResearchRecord["method"], year: number, share: number): ResearchRecord => ({
  ...base, recordId: id, recordType: "METHOD_HISTORY", raceId: null, method, votes: null, shareOfTotal: share, provenance: prov({ evidenceClass: "HISTORICAL", historicalYear: year }),
});
