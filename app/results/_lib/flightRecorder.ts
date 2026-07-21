// Flight data recorder — internal capture pipeline (CHANGE-ORDER-04 §6).
//
// Storage: per-race JSON blobs, one file per race id under
// FLIGHT_RECORDER_DIR (default `data/flightrecorder/<raceId>.json`) — the
// owner-approved storage choice (approved 2026-07-21, see
// /memories/repo/co04-status.md). Recording is silent: no public UI reads
// this in August. §4c (Zone 6 Live Timeline) reads it once
// TIMELINE_PUBLIC_FLAG flips for the Nov 3 general.
//
// Cadence: capture is meant to run at a 1-minute cadence, deduped within the
// minute (`appendSnapshotIfNew` no-ops if the last stored entry already
// covers the same minute). Scope guard (§6): only tiers 3+ are captured,
// never the local board — enforced by the caller via
// `getRecorderRaceIds()` / `isRecorderInScope()` in raceCapabilities.ts.
//
// DEPLOYMENT NOTE: this writes to the local filesystem. That's durable on a
// persistent Node process (e.g. `next start` on a long-lived
// server/container) but NOT on a stock serverless deployment (e.g. Vercel's
// default Functions runtime), whose filesystem is read-only outside /tmp and
// does not persist across invocations. If this ships on serverless
// infrastructure, point FLIGHT_RECORDER_DIR at a mounted persistent volume
// (or swap this module's read/write internals for a small managed store)
// before relying on it for real Nov 3 history — the JSON-blob *shape* here
// is unaffected either way.
//
// Server-only module — never import this from a "use client" component.

import { promises as fs } from "fs";
import path from "path";
import { needleFromRace, type NeedleProjection } from "../components/needleModel";
import { getRaceState, type RaceState } from "./raceState";
import type { RaceRule } from "@/app/lib/electoralModel";

export interface FlightRecorderCandidateSnapshot {
  name: string;
  votes: number;
  /** P(win) * 100, from the same needle the live desk renders. Null when the
   *  forecast engine can't produce a needle (e.g. fewer than 2 candidates). */
  winProbPct: number | null;
}

export interface FlightRecorderSnapshot {
  /** ISO timestamp, floored to the minute — the dedupe key. */
  ts: string;
  raceState: RaceState;
  percentReporting: number;
  candidates: FlightRecorderCandidateSnapshot[];
  projectedMarginPp: number | null;
  projectedLeaderSharePct: number | null;
  projectedRunnerSharePct: number | null;
  remainingVoteEst: number | null;
}

const RECORDER_DIR = process.env.FLIGHT_RECORDER_DIR
  ? path.resolve(process.env.FLIGHT_RECORDER_DIR)
  : path.join(process.cwd(), "data", "flightrecorder");

function minuteFloorIso(d: Date): string {
  const t = new Date(d);
  t.setSeconds(0, 0);
  return t.toISOString();
}

/** Builds one snapshot from a live CivicAPI race object (the same raw shape
 *  `needleFromRace` already consumes — not the search-index doc wrapper). */
export function buildSnapshot(race: unknown, raceRule: RaceRule, now: Date = new Date()): FlightRecorderSnapshot {
  const r = race as { percent_reporting?: unknown; candidates?: Array<{ name?: unknown; votes?: unknown; winner?: unknown }> } | null;
  const percentReporting = Math.max(0, Math.min(100, Number(r?.percent_reporting) || 0));
  const called = Array.isArray(r?.candidates) && r!.candidates!.some((c) => !!c?.winner);
  const state = getRaceState({ percentReporting, hasOfficialCall: called, tpsiCalled: false });
  const needle: NeedleProjection | null = needleFromRace(race, raceRule);

  const cands = Array.isArray(r?.candidates)
    ? [...r!.candidates!].sort((a, b) => (Number(b?.votes) || 0) - (Number(a?.votes) || 0))
    : [];
  const candidates: FlightRecorderCandidateSnapshot[] = cands.slice(0, 3).map((c) => {
    let winProbPct: number | null = null;
    if (needle) {
      if (c?.name === needle.leaderName) winProbPct = needle.pLeader * 100;
      else if (c?.name === needle.runnerName) winProbPct = needle.pRunner * 100;
    }
    return { name: String(c?.name || ""), votes: Number(c?.votes) || 0, winProbPct };
  });

  return {
    ts: minuteFloorIso(now),
    raceState: state,
    percentReporting,
    candidates,
    projectedMarginPp: needle ? needle.marginPp : null,
    projectedLeaderSharePct: needle ? needle.leaderProjSharePct : null,
    projectedRunnerSharePct: needle ? needle.runnerProjSharePct : null,
    remainingVoteEst: needle ? needle.modeledVoteRemaining : null,
  };
}

function blobPath(raceId: number): string {
  return path.join(RECORDER_DIR, `${raceId}.json`);
}

export async function readSnapshots(raceId: number): Promise<FlightRecorderSnapshot[]> {
  try {
    const raw = await fs.readFile(blobPath(raceId), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FlightRecorderSnapshot[]) : [];
  } catch {
    return [];
  }
}

/** Appends a snapshot, deduped to a 1-minute cadence (§6): no-ops when the
 *  last stored snapshot already covers the same minute. Returns whether it
 *  wrote a new entry. */
export async function appendSnapshotIfNew(raceId: number, snapshot: FlightRecorderSnapshot): Promise<boolean> {
  const existing = await readSnapshots(raceId);
  const last = existing[existing.length - 1];
  if (last && last.ts === snapshot.ts) return false;
  const next = [...existing, snapshot];
  await fs.mkdir(RECORDER_DIR, { recursive: true });
  await fs.writeFile(blobPath(raceId), JSON.stringify(next), "utf8");
  return true;
}
