// Live Timeline data for RaceDesk. Default: the legacy flight recorder, unchanged. With ONPOINT_PUBLIC_SNAPSHOT=1 and a
// store that serves reads cheaply, it comes from published canonical snapshots instead, in the legacy shape.
// Only PUBLISHED output reaches it: shadow calculations and unavailable outputs are never in the timeline index.

import type { ObjectStore } from "@/app/lib/intelligence/captureStore";
import { readTimeline, type TimelineEntry } from "@/app/lib/intelligence/publicSnapshot";
import type { FlightRecorderSnapshot } from "./flightRecorder";
import { getRaceState } from "./raceState";

export function toFlightRecorderSnapshots(entries: TimelineEntry[]): FlightRecorderSnapshot[] {
  return entries.map((e) => {
    const pct = Math.max(0, Math.min(100, e.providerReportingPct ?? 0));
    const sh = e.projectedSharePct;
    const ts = new Date(e.publishedAt);
    ts.setUTCSeconds(0, 0);
    return {
      ts: ts.toISOString(),
      raceState: getRaceState({ percentReporting: pct, hasOfficialCall: e.providerCalled, tpsiCalled: false }),
      percentReporting: pct,
      candidates: [...e.candidates].sort((a, b) => b.votes - a.votes).slice(0, 3).map((c) => ({ name: c.name, votes: c.votes, winProbPct: c.winProbability === null ? null : c.winProbability * 100 })),
      projectedMarginPp: sh ? Math.abs(e.expectedFinalMarginPp) : null,
      projectedLeaderSharePct: sh ? Math.max(sh.A, sh.B) : null,
      projectedRunnerSharePct: sh ? Math.min(sh.A, sh.B) : null,
      remainingVoteEst: e.estimatedOutstandingVotes,
    };
  });
}

export interface TimelineDeps {
  env: Record<string, string | undefined>;
  legacy: (civicId: number) => Promise<FlightRecorderSnapshot[]>;
  store: () => ObjectStore | null;
}

export async function timelineFor(civicId: number, deps: TimelineDeps): Promise<{ source: "LEGACY" | "PUBLISHED"; snapshots: FlightRecorderSnapshot[] }> {
  if (deps.env.ONPOINT_PUBLIC_SNAPSHOT !== "1") return { source: "LEGACY", snapshots: await deps.legacy(civicId) };
  const store = deps.store();
  // GitHub-only storage keeps no per-race index (see publicSnapshot.ts)
  if (!store?.durable || store.kind === "github") return { source: "LEGACY", snapshots: await deps.legacy(civicId) };
  try { return { source: "PUBLISHED", snapshots: toFlightRecorderSnapshots(await readTimeline(store, civicId)) }; }
  catch { return { source: "LEGACY", snapshots: await deps.legacy(civicId) }; }
}
