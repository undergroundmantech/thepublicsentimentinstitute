// Recorder configuration: which races are tracked, which feeds are captured whole, and the environment's settings.
// Server-only: reads files from the deployment.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { XIndex, XRace } from "@/app/results/2026/live";
import { DEFAULT_FEED_TYPES, type RunnerConfig } from "./captureRunner";
import { defaultWindows } from "./captureSchedule";
import type { ExpectedRace } from "./captureHealth";

export const ELECTION_ID = "US-2026-11-03-GENERAL";
const ELECTION_DATE = "2026-11-03";
const STATES_FILE = path.join(process.cwd(), "data", "intelligence", "states", "priority15-2026-10-26.json");
const INDEX_FILE = path.join(process.cwd(), "public", "results", "2026", "index.json");

/**
 * The tracked races: the research states' races, from the committed 15-state dataset, as the forecast index describes
 * them. A race named in the dataset but missing from the index is returned in `missing`, never silently dropped.
 */
export async function loadTrackedRaces(): Promise<{ races: XRace[]; expected: ExpectedRace[]; missing: string[] }> {
  const states = JSON.parse(await readFile(STATES_FILE, "utf8")) as { states: { raceIds: string[] }[] };
  const ids = [...new Set(states.states.flatMap((s) => s.raceIds))].sort();
  const index = JSON.parse(await readFile(INDEX_FILE, "utf8")) as XIndex;
  const byId = new Map(index.races.map((r) => [r.id, r]));
  const races = ids.map((id) => byId.get(id)).filter((r): r is XRace => !!r);
  return { races, expected: races.map((r) => ({ raceId: r.id, state: r.st, expectedJurisdictions: r.cty ?? null })), missing: ids.filter((id) => !byId.has(id)) };
}

export function runnerConfig(env: Record<string, string | undefined> = process.env): RunnerConfig {
  const feeds = (env.INTELLIGENCE_CAPTURE_FEEDS ?? "").split(",").map((s) => s.trim()).filter((s) => /^[A-Za-z .'&-]{2,60}$/.test(s)).slice(0, 12);
  return {
    electionId: ELECTION_ID, electionDate: ELECTION_DATE, feedTypes: feeds.length ? feeds : DEFAULT_FEED_TYPES, windows: defaultWindows(env.INTELLIGENCE_CAPTURE_UNTIL),
    deadlineMs: 40_000, detailConcurrency: 6,
  };
}
