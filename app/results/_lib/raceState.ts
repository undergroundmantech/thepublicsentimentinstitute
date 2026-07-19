// Race state machine + vocabulary canon + shared forecast math for the
// Election Desk rebuild (CHANGE-ORDER-04 §2). Every surface (Race Clock,
// header badges, forecast panels, the local board) must speak this one
// vocabulary — do not restate these strings/thresholds locally.

// ─── Race state machine (§2) ────────────────────────────────────────────────
// SCHEDULED → LIVE·GATED (<10%) → LIVE·FORECAST → PROJECTED (TPSI call) → OFFICIAL (certified)

export type RaceState = "SCHEDULED" | "LIVE_GATED" | "LIVE_FORECAST" | "PROJECTED" | "OFFICIAL";

export const RACE_STATE_LABEL: Record<RaceState, string> = {
  SCHEDULED: "SCHEDULED",
  LIVE_GATED: "LIVE · GATED",
  LIVE_FORECAST: "LIVE · FORECAST",
  PROJECTED: "PROJECTED",
  OFFICIAL: "OFFICIAL",
};

/** Reporting threshold below which the forecast is gated (parity with V1's SPLASH_THRESHOLD / "SHOW FORECAST ANYWAY" override). */
export const GATE_THRESHOLD_PCT = 10;

export function getRaceState(opts: {
  percentReporting: number | null; // 0-100
  hasOfficialCall: boolean;        // AP/CivicAPI winner flag set on a candidate
  tpsiCalled: boolean;             // TPSI model has independently projected a winner
}): RaceState {
  if (opts.hasOfficialCall) return "OFFICIAL";
  if (opts.tpsiCalled) return "PROJECTED";
  const reporting = opts.percentReporting ?? 0;
  if (reporting <= 0) return "SCHEDULED";
  if (reporting < GATE_THRESHOLD_PCT) return "LIVE_GATED";
  return "LIVE_FORECAST";
}

// ─── Reporting-definition vocabulary (§2) ───────────────────────────────────
// EST. REPORTING always leads; PRECINCTS is a secondary, explicitly-labeled detail.

export function formatEstReporting(pct: number | null | undefined): string {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return "EST. REPORTING —";
  return `EST. REPORTING ${Math.max(0, Math.min(100, pct)).toFixed(0)}%`;
}

export function formatPrecincts(pct: number | null | undefined): string {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return "PRECINCTS —";
  return `PRECINCTS ${Math.max(0, Math.min(100, pct)).toFixed(0)}%`;
}

// ─── Vote modes (§2) ─────────────────────────────────────────────────────────

export const VOTE_MODE_LABELS = ["EARLY", "VBM", "ELECTION DAY"] as const;
export type VoteMode = (typeof VOTE_MODE_LABELS)[number];

// ─── Data semantics (§2) ─────────────────────────────────────────────────────

export const NO_HISTORY_LINE = "NO HISTORY SNAPSHOTS — LIVE DATA ONLY";
export const OTHER_OUTCOMES_LABEL = "OTHER OUTCOMES <1%";

// ─── Rating vocabulary (ported from ResultsV1's marginBucket/legend) ───────

export type MarginBucket = "tied" | "tilt" | "lean" | "likely" | "safe";

export const RATING_LABEL: Record<MarginBucket, string> = {
  tied: "TIED",
  tilt: "TILT",
  lean: "LEAN",
  likely: "LIKELY",
  safe: "SAFE",
};

export function marginBucket(absMargin: number): MarginBucket {
  if (absMargin < 0.0001) return "tied";
  if (absMargin < 2) return "tilt";
  if (absMargin < 6) return "lean";
  if (absMargin < 12) return "likely";
  return "safe";
}

// ─── Win probability math (ported unchanged from ResultsV1) ────────────────

export function calculateWinProbability(leaderVotes: number, runnerUpVotes: number, percentReporting: number): number {
  if (percentReporting >= 99) return 100;
  if (percentReporting <= 0 || (leaderVotes === 0 && runnerUpVotes === 0)) return 50;
  const currentTotal = leaderVotes + runnerUpVotes;
  const estimatedTotal = currentTotal / (percentReporting / 100);
  const remainingVotes = estimatedTotal - currentTotal;
  const gap = leaderVotes - runnerUpVotes;
  if (gap > remainingVotes) return 100;
  const margin = (leaderVotes - runnerUpVotes) / currentTotal;
  const certaintyWeight = Math.sqrt(percentReporting / 100);
  const z = margin * 15 * certaintyWeight;
  const prob = 1 / (1 + Math.exp(-z));
  return 50 + (prob - 0.5) * 100;
}

/** Normalizes raw win-probability mass across 1-3 candidates; residual (if any) renders as OTHER_OUTCOMES_LABEL in the wheel legend. */
export function normalizeWinProbabilitiesByCandidateCount(
  src: Partial<Record<"Candidate1" | "Candidate2" | "Candidate3", number>>,
  candidateCount: number,
): { c1: number; c2: number; c3: number } {
  const count = Math.max(1, Math.min(3, candidateCount));
  if (count === 1) return { c1: 1, c2: 0, c3: 0 };

  const raw = [Math.max(0, src.Candidate1 ?? 0), Math.max(0, src.Candidate2 ?? 0), Math.max(0, src.Candidate3 ?? 0)];
  for (let i = count; i < 3; i += 1) raw[i] = 0;

  const total = raw[0] + raw[1] + raw[2];
  if (total <= 0) {
    if (count === 2) return { c1: 0.5, c2: 0.5, c3: 0 };
    return { c1: 1 / 3, c2: 1 / 3, c3: 1 / 3 };
  }

  return { c1: raw[0] / total, c2: raw[1] / total, c3: raw[2] / total };
}

// ─── Poll-close countdown (§7 parity — fixes the "20635d" bug) ──────────────
//
// V1 bug: the race-switcher countdown badge read the close time straight off
// `selectedRace.polls_close` — the raw CivicAPI value — instead of the
// effective/overridden close time, AND never sanity-checked the result. When
// the API returns a missing/placeholder polls_close, the raw diff can resolve
// to a wildly implausible span (observed rendering as "20635d ..."). The fix
// is two-fold: (1) always resolve through the same race-level → state-level →
// API override chain used for every other close-time consumer, and (2) clamp
// obviously-implausible spans to "unknown" rather than rendering them.

const MAX_SANE_COUNTDOWN_DAYS = 60; // primaries/runoffs/general elections are same-day events; a raw close time further out than this is bad data, not a real countdown

export function getEffectivePollsCloseIso(opts: {
  raceLevelIso?: string | null;
  stateLevelIso?: string | null;
  apiIso?: string | null;
}): string | null {
  return opts.raceLevelIso ?? opts.stateLevelIso ?? opts.apiIso ?? null;
}

export function parseIsoDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Milliseconds until polls close, or null if unknown/implausible (see fix note above). */
export function getMsLeftToClose(closeIso: string | null, nowMs: number): number | null {
  const d = parseIsoDate(closeIso);
  if (!d) return null;
  const msLeft = d.getTime() - nowMs;
  if (msLeft > MAX_SANE_COUNTDOWN_DAYS * 86_400_000) return null;
  return msLeft;
}

export function formatCountdown(msLeft: number | null): string {
  if (msLeft === null) return "—";
  if (msLeft <= 0) return "CLOSED";
  const totalSec = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export function formatLocalCloseTime(iso: string | null): string {
  const d = parseIsoDate(iso);
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
