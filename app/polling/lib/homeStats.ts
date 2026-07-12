// Live numbers for the landing page, computed from the same raw poll sets and
// daily weighted model that power /polling/genericballot and
// /polling/donaldtrumpapproval — so the homepage can never drift from the
// trackers it links to. Kept separate from aggregates.ts on purpose: that
// module fans out into a dozen page bundles; this one touches only the two
// datasets the landing page quotes.

import {
  Poll,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";
import {
  RAW_POLLS as GENERIC_POLLS,
  GOLD_STANDARD_NAMES as GENERIC_GOLD,
} from "@/app/polling/genericballot/data";
import {
  RAW_POLLS as APPROVAL_POLLS,
  GOLD_STANDARD_NAMES as APPROVAL_GOLD,
} from "@/app/polling/donaldtrumpapproval/data";
import {
  RAW_POLLS as TRACK_POLLS,
  GOLD_STANDARD_NAMES as TRACK_GOLD,
} from "@/app/polling/rightorwrongtrack/data";

const round1 = (n: number) => Math.round(n * 10) / 10;

function normalizeName(s: string) {
  return s.toLowerCase().replace(/\(r\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function isGold(pollster: string, gold: string[]) {
  const p = normalizeName(pollster);
  return gold.some((g) => p.includes(normalizeName(g)));
}
// Same effective-sample boost the destination pages apply (mult² on n).
function boostGold(polls: Poll[], gold: string[], mult: number): Poll[] {
  return polls.map((p) =>
    Number.isFinite(p.sampleSize) && p.sampleSize > 0 && isGold(p.pollster, gold)
      ? { ...p, sampleSize: Math.round(p.sampleSize * mult * mult) }
      : p,
  );
}

export type HomeSeriesPoint = { t: number; net: number; a: number; b: number };
export type HomePollPoint = { t: number; net: number; a: number; b: number };

export type HomeStats = {
  approval: {
    net: number; count: number; approve: number; disapprove: number;
    /** Daily weighted Approve/Disapprove, oldest → newest. */
    daily: HomeSeriesPoint[];
  };
  generic: {
    net: number;
    count: number;
    /** Daily weighted margin (D − R), full series, oldest → newest. */
    daily: HomeSeriesPoint[];
    /** Individual poll margins for the scatter cloud, oldest → newest. */
    polls: HomePollPoint[];
  };
  track: {
    net: number; count: number; right: number; wrong: number;
    /** Daily weighted RightTrack/WrongTrack, oldest → newest. */
    daily: HomeSeriesPoint[];
  };
};

function buildNetSeries(polls: Poll[], gold: string[], mult: number, keyA: string, keyB: string) {
  const range = getDateRange(polls);
  const rows = buildDailyWeightedSeries(boostGold(polls, gold, mult), [keyA, keyB], range.start, range.end);
  return rows.map((row) => {
    const rec = row as Record<string, number | string>;
    const a = Number(rec[keyA] ?? 0);
    const b = Number(rec[keyB] ?? 0);
    return { t: new Date(row.date + "T00:00:00").getTime(), net: round1(a - b), a: round1(a), b: round1(b) };
  });
}

let cached: HomeStats | null = null;

export function getHomeStats(): HomeStats {
  if (cached) return cached;

  // /polling/donaldtrumpapproval boosts gold pollsters ×3; the generic-ballot
  // aggregate (aggregates.ts) boosts ×2. Match each destination exactly.
  const approvalDaily = buildNetSeries(APPROVAL_POLLS, APPROVAL_GOLD, 3, "Approve", "Disapprove");
  const genericDaily = buildNetSeries(GENERIC_POLLS, GENERIC_GOLD, 2, "Democrats", "Republicans");
  // /polling/rightorwrongtrack boosts gold pollsters ×3, matching that page.
  const trackDaily = buildNetSeries(TRACK_POLLS, TRACK_GOLD, 3, "RightTrack", "WrongTrack");

  const genericPollPoints = GENERIC_POLLS.map((p) => {
    const a = Number((p.results as Record<string, number>)["Democrats"] ?? NaN);
    const b = Number((p.results as Record<string, number>)["Republicans"] ?? NaN);
    return { t: new Date(p.endDate + "T00:00:00").getTime(), net: round1(a - b), a: round1(a), b: round1(b) };
  })
    .filter((p) => Number.isFinite(p.net))
    .sort((x, y) => x.t - y.t);

  cached = {
    approval: {
      net: approvalDaily.length ? approvalDaily[approvalDaily.length - 1].net : 0,
      count: APPROVAL_POLLS.length,
      approve: approvalDaily.length ? approvalDaily[approvalDaily.length - 1].a : 0,
      disapprove: approvalDaily.length ? approvalDaily[approvalDaily.length - 1].b : 0,
      daily: approvalDaily,
    },
    generic: {
      net: genericDaily.length ? genericDaily[genericDaily.length - 1].net : 0,
      count: GENERIC_POLLS.length,
      daily: genericDaily,
      polls: genericPollPoints,
    },
    track: {
      net: trackDaily.length ? trackDaily[trackDaily.length - 1].net : 0,
      count: TRACK_POLLS.length,
      right: trackDaily.length ? trackDaily[trackDaily.length - 1].a : 0,
      wrong: trackDaily.length ? trackDaily[trackDaily.length - 1].b : 0,
      daily: trackDaily,
    },
  };
  return cached;
}
