// When to poll. Pure functions: the scheduler calls the route every minute and this decides whether that minute is due.
//
// The cadence follows the news cycle rather than a fixed rate. civicAPI serves each response with `max-age=15`, so asking
// more than once a minute cannot return newer data, and Vercel cron cannot fire faster than once a minute anyway.
// Windows are UTC. DST ended 2026-11-01, so Nov 3 is EST (ET = UTC-5).

export const PHASES = ["PRE_ELECTION", "POLLS_OPEN", "ELECTION_NIGHT", "OVERNIGHT", "COUNTING", "CANVASS", "ENDED"] as const;
export type Phase = (typeof PHASES)[number];

export interface Window {
  phase: Phase;
  /** Inclusive start. */
  from: string;
  /** Exclusive end. */
  to: string;
  /** Minutes between polls; null means no polling. */
  intervalMinutes: number | null;
  /** Tracked-race detail requests: every race, a few for a connectivity check, or none. */
  details: "ALL" | "SAMPLE" | "NONE";
}

const FAR_PAST = "2000-01-01T00:00:00Z";
const FAR_FUTURE = "2100-01-01T00:00:00Z";

/**
 * 2026-11-03 12:00Z is 7 a.m. ET, when the first polls open. 22:30Z is 5:30 p.m. ET, half an hour before the first
 * polls close (6 p.m. ET in Kentucky and Indiana's eastern counties).
 */
export function defaultWindows(until?: string): Window[] {
  const end = until && Number.isFinite(Date.parse(until)) ? new Date(until).toISOString() : "2026-11-25T00:00:00.000Z";
  return [
    { phase: "PRE_ELECTION", from: FAR_PAST, to: "2026-11-03T12:00:00Z", intervalMinutes: 60, details: "SAMPLE" },
    { phase: "POLLS_OPEN", from: "2026-11-03T12:00:00Z", to: "2026-11-03T22:30:00Z", intervalMinutes: 10, details: "ALL" },
    { phase: "ELECTION_NIGHT", from: "2026-11-03T22:30:00Z", to: "2026-11-04T00:00:00Z", intervalMinutes: 1, details: "ALL" },
    // the approved archive schedule: 7 p.m. ET Nov 3 to 7 a.m. ET Nov 4 every 30 seconds, then every 10 minutes to 7 a.m. ET Nov 11
    { phase: "ELECTION_NIGHT", from: "2026-11-04T00:00:00Z", to: "2026-11-04T12:00:00Z", intervalMinutes: 0.5, details: "ALL" },
    { phase: "OVERNIGHT", from: "2026-11-04T12:00:00Z", to: "2026-11-05T00:00:00Z", intervalMinutes: 10, details: "ALL" },
    { phase: "COUNTING", from: "2026-11-05T00:00:00Z", to: "2026-11-11T12:00:00Z", intervalMinutes: 10, details: "ALL" },
    { phase: "CANVASS", from: "2026-11-11T12:00:00Z", to: end, intervalMinutes: 15, details: "ALL" },
    { phase: "ENDED", from: end, to: FAR_FUTURE, intervalMinutes: null, details: "NONE" },
  ];
}

export interface TickState {
  /** When the last poll began. Null when none has run. */
  lastPollAt: string | null;
  /** Polls in a row, up to the last, that found no material change anywhere. */
  quietPolls: number;
}

export interface TickPlan {
  phase: Phase;
  baseIntervalMinutes: number | null;
  intervalMinutes: number | null;
  due: boolean;
  details: Window["details"];
  feeds: boolean;
  reason: string;
}

/** Cron fires on the minute, a little early or late; a poll is due when this much of the interval has passed. */
const TOLERANCE_MS = 15_000;
/** In POLLS_OPEN and CANVASS, this many quiet polls in a row doubles the interval, up to MAX_MINUTES. The approved archive windows never slow. */
export const QUIET_POLLS_TO_SLOW = 6;
const MAX_MINUTES = 30;

export function planTick(nowIso: string, state: TickState, windows: Window[] = defaultWindows(), opts: { force?: boolean } = {}): TickPlan {
  const t = Date.parse(nowIso);
  const w = windows.find((x) => t >= Date.parse(x.from) && t < Date.parse(x.to)) ?? windows[windows.length - 1];
  if (w.intervalMinutes === null) return { phase: w.phase, baseIntervalMinutes: null, intervalMinutes: null, due: !!opts.force, details: opts.force ? "ALL" : "NONE", feeds: !!opts.force, reason: opts.force ? "forced after the capture window ended" : "the capture window has ended" };
  const slow = (w.phase === "POLLS_OPEN" || w.phase === "CANVASS") && state.quietPolls >= QUIET_POLLS_TO_SLOW;
  const interval = slow ? Math.min(w.intervalMinutes * 2, MAX_MINUTES) : w.intervalMinutes;
  const last = state.lastPollAt ? Date.parse(state.lastPollAt) : NaN;
  const elapsed = t - last;
  const due = !!opts.force || !Number.isFinite(last) || elapsed >= interval * 60_000 - TOLERANCE_MS;
  const reason = opts.force ? "forced" : !Number.isFinite(last) ? "no earlier poll" : due ? `${Math.round(elapsed / 1000)}s since the last poll, interval ${interval} min` : `next poll in ${Math.max(0, Math.round((interval * 60_000 - elapsed) / 1000))}s`;
  return { phase: w.phase, baseIntervalMinutes: w.intervalMinutes, intervalMinutes: interval, due, details: w.details, feeds: true, reason };
}

/** Minutes without a successful poll after which the recorder is called interrupted. Never under five minutes. */
export const staleAfterMinutes = (intervalMinutes: number | null) => (intervalMinutes === null ? Infinity : Math.max(5, intervalMinutes * 3));
