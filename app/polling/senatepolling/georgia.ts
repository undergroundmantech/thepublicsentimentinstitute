// georgia.ts
// 2026 Georgia (U.S. Senate) polling — Jon Ossoff (D) vs potential GOP nominees
// Source rows provided by user.

export type Population = "LV" | "RV" | "V";

export type PollRow = {
  pollster: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  sampleSize: number;
  population: Population;
  moe?: number; // percent, e.g. 3.7 means ±3.7%
  results: Record<string, number>; // candidate -> %
  other?: number; // if reported
  undecided?: number;
  note?: string;
};

export type Matchup = {
  race: "GA-SEN-2026";
  candidates: string[]; // ordered display
  polls: PollRow[];
};

export const GA_SEN_2026_MATCHUPS: Matchup[] = [
  // Jon Ossoff vs Buddy Carter
  {
    race: "GA-SEN-2026",
    candidates: ["Jon Ossoff (D)", "Buddy Carter (R)"],
    polls: [
      {
        pollster: "Quantus Insights (R)",
        start: "2025-09-09",
        end: "2025-09-12",
        sampleSize: 624,
        population: "RV",
        moe: 4.3,
        results: { "Jon Ossoff (D)": 40, "Buddy Carter (R)": 37 },
        undecided: 22,
      },
      {
        pollster: "TIPP Insights",
        start: "2025-07-28",
        end: "2025-08-01",
        sampleSize: 2956,
        population: "RV",
        moe: 1.8,
        results: { "Jon Ossoff (D)": 44, "Buddy Carter (R)": 40 },
        other: 3,
        undecided: 13,
      },
      {
        pollster: "Cygnal (R)",
        start: "2025-06-16",
        end: "2025-06-18",
        sampleSize: 610,
        population: "LV",
        moe: 3.9,
        results: { "Jon Ossoff (D)": 49, "Buddy Carter (R)": 42 },
        undecided: 9,
      },
      {
        pollster: "Cygnal (R)",
        start: "2025-05-15",
        end: "2025-05-17",
        sampleSize: 800,
        population: "LV",
        moe: 3.4,
        results: { "Jon Ossoff (D)": 46, "Buddy Carter (R)": 42 },
        undecided: 12,
      },
      {
        pollster: "Tyson Group (R)",
        start: "2025-01-30",
        end: "2025-01-31",
        sampleSize: 600,
        population: "LV",
        moe: 4.0,
        results: { "Jon Ossoff (D)": 47, "Buddy Carter (R)": 39 },
        undecided: 13,
      },
      {
        pollster: "WPA Intelligence (R)",
        start: "2025-01-14",
        end: "2025-01-15",
        sampleSize: 500,
        population: "LV",
        moe: 4.4,
        results: { "Jon Ossoff (D)": 45, "Buddy Carter (R)": 32 },
        undecided: 23,
      },
    ],
  },

  // Jon Ossoff vs Mike Collins
  {
    race: "GA-SEN-2026",
    candidates: ["Jon Ossoff (D)", "Mike Collins (R)"],
    polls: [
      {
        pollster: "Quantus Insights (R)",
        start: "2025-09-09",
        end: "2025-09-12",
        sampleSize: 624,
        population: "RV",
        moe: 4.3,
        results: { "Jon Ossoff (D)": 38, "Mike Collins (R)": 38 },
        undecided: 23,
      },
      {
        pollster: "TIPP Insights",
        start: "2025-07-28",
        end: "2025-08-01",
        sampleSize: 2956,
        population: "RV",
        moe: 1.8,
        results: { "Jon Ossoff (D)": 45, "Mike Collins (R)": 44 },
        other: 3,
        undecided: 8,
      },
      {
        pollster: "Cygnal (R)",
        start: "2025-05-15",
        end: "2025-05-17",
        sampleSize: 800,
        population: "LV",
        moe: 3.4,
        results: { "Jon Ossoff (D)": 46, "Mike Collins (R)": 43 },
        undecided: 11,
      },
      {
        pollster: "Trafalgar Group (R)",
        start: "2025-04-24",
        end: "2025-04-27",
        sampleSize: 1426,
        population: "LV",
        moe: 2.9,
        results: { "Jon Ossoff (D)": 48, "Mike Collins (R)": 43 },
        other: 3,
        undecided: 6,
      },
      {
        pollster: "WPA Intelligence (R)",
        start: "2025-01-14",
        end: "2025-01-15",
        sampleSize: 500,
        population: "LV",
        moe: 4.4,
        results: { "Jon Ossoff (D)": 44, "Mike Collins (R)": 34 },
        undecided: 22,
      },
    ],
  },

  // Jon Ossoff vs Derek Dooley
  {
    race: "GA-SEN-2026",
    candidates: ["Jon Ossoff (D)", "Derek Dooley (R)"],
    polls: [
      {
        pollster: "Quantus Insights (R)",
        start: "2025-09-09",
        end: "2025-09-12",
        sampleSize: 624,
        population: "RV",
        moe: 4.3,
        results: { "Jon Ossoff (D)": 42, "Derek Dooley (R)": 35 },
        undecided: 22,
      },
      {
        pollster: "TIPP Insights",
        start: "2025-07-28",
        end: "2025-08-01",
        sampleSize: 2956,
        population: "RV",
        moe: 1.8,
        results: { "Jon Ossoff (D)": 44, "Derek Dooley (R)": 39 },
        other: 4,
        undecided: 14,
      },
      {
        pollster: "Cygnal (R)",
        start: "2025-06-16",
        end: "2025-06-18",
        sampleSize: 610,
        population: "LV",
        moe: 3.9,
        results: { "Jon Ossoff (D)": 50, "Derek Dooley (R)": 41 },
        undecided: 9,
      },
    ],
  },
];

// Convenience map
export const GA_SEN_2026_BY_MATCHUP = {
  ossoff_vs_carter: GA_SEN_2026_MATCHUPS[0],
  ossoff_vs_collins: GA_SEN_2026_MATCHUPS[1],
  ossoff_vs_dooley: GA_SEN_2026_MATCHUPS[2],
} as const;

/* =========================
   Compatibility exports for your 2026 map/table page
   (page.tsx expects STATE_POLLS[abbr] or getStateSummary(abbr))
========================= */

type PollLike = {
  pollster?: string;
  endDate?: string;
  sampleSize?: number;
  results: Record<string, number>;
};

// Pick which matchup represents "Georgia" on the national map.
const DEFAULT_MATCHUP_INDEX = 1; // 0 = Carter, 1 = Collins, 2 = Dooley

function matchupToPollLikes(matchupIndex = DEFAULT_MATCHUP_INDEX): PollLike[] {
  const m = GA_SEN_2026_MATCHUPS[matchupIndex];
  if (!m) return [];
  return m.polls.map((p) => ({
    pollster: p.pollster,
    endDate: p.end,
    sampleSize: p.sampleSize,
    results: p.results,
  }));
}

export const STATE_POLLS: Record<string, PollLike[]> = {
  GA: matchupToPollLikes(DEFAULT_MATCHUP_INDEX),
};

export function getStateSummary(abbr: string) {
  if (abbr !== "GA") return null;

  const polls = STATE_POLLS.GA;
  if (!polls.length) return null;

  const round1 = (n: number) => Math.round(n * 10) / 10;

  const now = new Date();
  const weights = polls.map((p) => {
    const n = Number(p.sampleSize ?? 1000);
    const iso = p.endDate ? new Date(p.endDate + "T00:00:00") : null;
    const daysOld =
      iso && !Number.isNaN(iso.getTime())
        ? Math.max(0, Math.floor((now.getTime() - iso.getTime()) / (1000 * 60 * 60 * 24)))
        : 30;
    const recency = 1 / (1 + daysOld / 14);
    return Math.max(1, n) * recency;
  });

  const totals: Record<string, number> = {};
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;

  polls.forEach((p, i) => {
    const w = weights[i] / wSum;
    Object.entries(p.results || {}).forEach(([k, v]) => {
      const val = Number(v);
      if (!Number.isFinite(val)) return;
      totals[k] = (totals[k] ?? 0) + val * w;
    });
  });

  const ranked = Object.entries(totals)
    .map(([name, pct]) => ({ name, pct: round1(pct) }))
    .sort((a, b) => b.pct - a.pct);

  const leader = ranked[0];
  const runner = ranked[1];

  const lastDate = polls
    .map((p) => p.endDate)
    .filter(Boolean)
    .sort()
    .slice(-1)[0];

  if (!leader) return null;

  const leaderPct = leader.pct ?? 0;
  const runnerPct = runner?.pct ?? 0;

  return {
    leaderName: leader.name,
    leaderPct,
    runnerUpName: runner?.name,
    runnerUpPct: runner?.pct,
    margin: round1(leaderPct - runnerPct),
    lastDate,
    pollsUsed: polls.length,
  };
}
