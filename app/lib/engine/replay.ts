// Replay: one clock, one source of frames, three modes. Pure.
//
// A ReplaySource is an ordered list of observations, each with the time it was OBSERVED. Playback is driven by
// timestamps: at replay time T the world is the latest frame observed at or before T, and nothing after it. Seeking
// backward therefore cannot leave later data on screen: the state at T is looked up (or recomputed) from frames
// up to T only.
//
//   LIVE        the provider, now
//   HISTORICAL  authentic observations: the engine's own recorder archive, or original timestamped provider captures
//   SIMULATED   development fixtures. Never authentic history; never servable in production (gate.ts)
// The forecasting code is identical for all three; only this adapter and the provenance differ.
import { candidateId } from "../../results/2026/candidates";
import { canonicalJson, fnv64 } from "./rng";
import type { DataMode, ElectionSnapshot, RaceObservation } from "./types";

export type ReplayFrame = {
  /** when this state of the world was observed (the replay clock's axis) */
  t: string;
  snapshot: ElectionSnapshot;
  /** minutes between the true observations either side of this frame, when the source records it */
  gapMinutes?: number | null;
};
export type ReplaySource = { mode: DataMode; id: string; label: string; election: string; frames: ReplayFrame[]; notes: string[] };

/** Index of the frame in force at time tMs (latest observed at or before it), or -1 before the first. */
export function frameIndexAt(timesMs: readonly number[], tMs: number): number {
  let lo = 0, hi = timesMs.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (timesMs[mid] <= tMs) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}

/** Why a source may not be used to score, backtest or calibrate the model. Empty means it may. Enforced server side. */
export function evaluationBlockers(src: ReplaySource): string[] {
  const out: string[] = [];
  if (src.mode === "SIMULATED") out.push("the source is SIMULATED");
  if (src.frames.some((f) => f.snapshot.provenance.synthetic)) out.push("it contains synthetic observations");
  if (src.frames.some((f) => f.snapshot.provenance.usesFutureObservation)) out.push("it contains values built from later observations (interpolation)");
  for (let i = 1; i < src.frames.length; i++) if (Date.parse(src.frames[i].t) <= Date.parse(src.frames[i - 1].t)) { out.push("frames are not in strictly increasing time order"); break; }
  return out;
}

// ---- the supplied fixture (test_data/OnPoint_2026_ElectionNight_5min_Replay_SIMULATED.zip) ---------------------------
type FxCand = { name: string; party: string | null; votes: number | null };
type FxRace = { race_id: string; source_percent_reporting: number | null; candidates: FxCand[] | null };
export type FixtureFrame = { timestamp_utc: string; snapshot_kind: string; source_provenance?: { previous_capture_utc?: string | null; checkpoint_gap_minutes?: number | null; uses_future_observation?: boolean }; races: FxRace[] };

function fixtureSnapshot(f: FixtureFrame, mode: DataMode, synthetic: boolean, source: string): ElectionSnapshot {
  const races: Record<string, RaceObservation> = {}; const receivedAt = f.source_provenance?.previous_capture_utc ?? f.timestamp_utc;
  for (const x of f.races) {
    if (!x.candidates?.length) continue;                       // the export did not include this race at this time: absent, not zero
    races[x.race_id] = { raceId: x.race_id, providerRaceId: null, providerPctReporting: typeof x.source_percent_reporting === "number" ? x.source_percent_reporting : null, units: null, sourceAsOf: null, receivedAt, test: false,
      candidates: x.candidates.map((c) => ({ candidateId: candidateId(x.race_id, c.name), name: c.name, partyRaw: c.party == null || c.party === "" ? null : c.party, votes: typeof c.votes === "number" && Number.isFinite(c.votes) && c.votes >= 0 ? c.votes : null, providerWinner: false })) };
  }
  const content = Object.keys(races).sort().map((k) => [k, races[k].candidates.map((c) => [c.candidateId, c.votes]), races[k].providerPctReporting]);
  return { snapshotId: `${mode.toLowerCase()}-${fnv64(canonicalJson(content))}`, races, unmatchedProviderRaces: 0,
    provenance: { mode, source, sourceAsOf: null, receivedAt, usesFutureObservation: !!f.source_provenance?.uses_future_observation, synthetic } };
}

/**
 * The five-minute fixture streams. BOTH are SIMULATED: `forward_hold` repeats the last real export on a five-minute
 * grid (no lookahead, but not five-minute reporting); `linear` interpolates between exports, so it uses later data.
 */
export function simulatedFixture(frames: FixtureFrame[], kind: "forward_hold" | "linear"): ReplaySource {
  const want = kind === "linear" ? "LINEAR_SIMULATION" : "OBSERVED_FORWARD_HOLD";
  for (const f of frames) if (f.snapshot_kind !== want) throw new Error(`fixture frame at ${f.timestamp_utc} is ${f.snapshot_kind}, expected ${want}`);
  return { mode: "SIMULATED", id: `sim-2026-${kind}`, label: kind === "linear" ? "SIMULATED: interpolated five-minute test stream (uses later data)" : "SIMULATED: last export held on a five-minute grid", election: "2026-11-03",
    frames: frames.map((f) => ({ t: f.timestamp_utc, gapMinutes: f.source_provenance?.checkpoint_gap_minutes ?? null, snapshot: fixtureSnapshot(f, "SIMULATED", true, `development fixture (${kind})`) })),
    notes: ["Development fixture. Not authentic election-night history. Never to be shown as real results or used to score the model."] };
}

/** The operator's own timestamped exports (original_observed_snapshots): authentic counts at the times they were
 *  exported. Sparse, with long gaps; every frame must be a genuine observation or the source is refused. */
export function observedCheckpoints(frames: FixtureFrame[]): ReplaySource {
  for (const f of frames) if (f.source_provenance?.uses_future_observation || /SIMUL|LINEAR/i.test(f.snapshot_kind)) throw new Error(`frame at ${f.timestamp_utc} is not a genuine observation`);
  const fs = frames.map((f, i) => ({ t: f.timestamp_utc, gapMinutes: i ? (Date.parse(f.timestamp_utc) - Date.parse(frames[i - 1].timestamp_utc)) / 60_000 : null, snapshot: fixtureSnapshot({ ...f, source_provenance: { previous_capture_utc: f.timestamp_utc } }, "HISTORICAL", false, "operator CSV export of civicAPI returns") }));
  return { mode: "HISTORICAL", id: "hist-2026-exports", label: "November 3, 2026: the 14 timestamped exports", election: "2026-11-03", frames: fs,
    notes: [`${fs.length} observations with gaps of up to ${Math.round(Math.max(0, ...fs.map((f) => f.gapMinutes ?? 0)))} minutes; no county or vote-method detail; no provider call flags. Unofficial until certified.`] };
}

// ---- the replay clock -------------------------------------------------------------------------------------------------
/** Seconds of election time per second of watching. */
export const REPLAY_SPEEDS = [1, 10, 60, 360, 3600] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
export type Clock = { tMs: number; startMs: number; endMs: number; speed: ReplaySpeed; playing: boolean };

export const newClock = (startMs: number, endMs: number, at?: number): Clock => ({ tMs: Math.min(endMs, Math.max(startMs, at ?? startMs)), startMs, endMs, speed: 60, playing: false });
/** Advance by real elapsed milliseconds. Timestamp arithmetic only: never "one row per tick". Stops at the end. */
export function tick(c: Clock, realMs: number): Clock {
  if (!c.playing || !(realMs > 0)) return c;
  const t = c.tMs + realMs * c.speed;
  return t >= c.endMs ? { ...c, tMs: c.endMs, playing: false } : { ...c, tMs: t };
}
export const seek = (c: Clock, tMs: number): Clock => ({ ...c, tMs: Math.min(c.endMs, Math.max(c.startMs, tMs)) });
export const setSpeed = (c: Clock, speed: number): Clock => ((REPLAY_SPEEDS as readonly number[]).includes(speed) ? { ...c, speed: speed as ReplaySpeed } : c);
export const play = (c: Clock): Clock => (c.tMs >= c.endMs ? c : { ...c, playing: true });
export const pause = (c: Clock): Clock => ({ ...c, playing: false });
/** Step to the next (+1) or previous (-1) observation. Pauses. */
export function step(c: Clock, timesMs: readonly number[], dir: 1 | -1): Clock {
  const i = frameIndexAt(timesMs, c.tMs);
  const j = dir > 0 ? i + 1 : timesMs[i] === c.tMs || i < 0 ? i - 1 : i;      // back from mid-interval lands on the frame in force
  if (j < 0 || j >= timesMs.length) return { ...c, playing: false };
  return { ...c, tMs: Math.min(c.endMs, Math.max(c.startMs, timesMs[j])), playing: false };
}
