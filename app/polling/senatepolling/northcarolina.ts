// northcarolina.ts
// 2026 North Carolina (U.S. Senate) polling — Michael Whatley (R) vs Roy Cooper (D)
// Source rows provided by user; includes polls with “Other” and “Undecided” when available.

export type Population = "LV" | "RV" | "V";

export type PollRow = {
  pollster: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  sampleSize: number;
  population: Population;
  moe?: number; // percent (±)
  results: Record<string, number>; // candidate -> %
  other?: number; // optional “Other”
  undecided?: number; // optional “Undecided”
  note?: string;
};

export type Matchup = {
  race: "NC-SEN-2026";
  candidates: string[]; // ordered display
  polls: PollRow[];
};

export const NC_SEN_2026_MATCHUPS: Matchup[] = [
  {
    race: "NC-SEN-2026",
    candidates: ["Roy Cooper (D)", "Michael Whatley (R)"],
    polls: [
      {
        pollster: "TIPP Insights (R)",
        start: "2026-01-12",
        end: "2026-01-15",
        sampleSize: 1512,
        population: "RV",
        moe: 2.7,
        results: { "Michael Whatley (R)": 24, "Roy Cooper (D)": 48 },
        undecided: 27,
        note: "Other not reported in provided row",
      },
      {
        pollster: "Change Research (D)",
        start: "2026-01-05",
        end: "2026-01-07",
        sampleSize: 1105,
        population: "LV",
        moe: 3.5,
        results: { "Michael Whatley (R)": 42, "Roy Cooper (D)": 47 },
        other: 1,
        undecided: 9,
      },
      {
        pollster: "Harper Polling (R)",
        start: "2025-11-09",
        end: "2025-11-10",
        sampleSize: 600,
        population: "LV",
        moe: 4.0,
        results: { "Michael Whatley (R)": 39, "Roy Cooper (D)": 47 },
        other: 4,
        undecided: 10,
      },
      {
        pollster: "Harper Polling (R)",
        start: "2025-09-14",
        end: "2025-09-15",
        sampleSize: 600,
        population: "RV",
        moe: 4.0,
        results: { "Michael Whatley (R)": 42, "Roy Cooper (D)": 46 },
        other: 4,
        undecided: 8,
      },
      {
        pollster: "Change Research (D)",
        start: "2025-09-02",
        end: "2025-09-08",
        sampleSize: 855,
        population: "LV",
        moe: 3.6,
        results: { "Michael Whatley (R)": 41, "Roy Cooper (D)": 48 },
        undecided: 11,
        note: "Other not reported in provided row",
      },
      {
        pollster: "Harper Polling (R)",
        start: "2025-08-11",
        end: "2025-08-12",
        sampleSize: 600,
        population: "RV",
        moe: 4.0,
        results: { "Michael Whatley (R)": 39, "Roy Cooper (D)": 47 },
        other: 4,
        undecided: 10,
      },
      {
        pollster: "Emerson College",
        start: "2025-07-28",
        end: "2025-07-30",
        sampleSize: 1000,
        population: "RV",
        moe: 3.0,
        results: { "Michael Whatley (R)": 41, "Roy Cooper (D)": 47 },
        undecided: 12,
        note: "Other not reported in provided row",
      },
      {
        pollster: "Victory Insights (R)",
        start: "2025-07-28",
        end: "2025-07-30",
        sampleSize: 600,
        population: "LV",
        results: { "Michael Whatley (R)": 40, "Roy Cooper (D)": 43 },
        undecided: 16,
        note: "MOE not reported in provided row",
      },
    ],
  },
];

// Optional convenience export
export const NC_SEN_2026_BY_MATCHUP = {
  cooper_vs_whatley: NC_SEN_2026_MATCHUPS[0],
} as const;

/**
 * Optional: page helper compatibility
 * If your UI expects STATE_POLLS or getStateSummary, this lets it work immediately.
 */
export const STATE_POLLS: Record<string, any[]> = {
  NC: NC_SEN_2026_MATCHUPS[0].polls.map((p) => ({
    pollster: p.pollster,
    endDate: p.end,
    sampleSize: p.sampleSize,
    results: p.results,
  })),
};

// If you want the page to use an official summary from this module:
export function getStateSummary(abbr: string) {
  if (abbr !== "NC") return null;

  const polls = STATE_POLLS.NC;
  if (!polls?.length) return null;

  // quick leader computation (same idea as in your page)
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

  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const totals: Record<string, number> = {};

  polls.forEach((p, i) => {
    const w = weights[i] / wSum;
    Object.entries(p.results || {}).forEach(([name, pct]) => {
      const v = Number(pct);
      if (!Number.isFinite(v)) return;
      totals[name] = (totals[name] ?? 0) + v * w;
    });
  });

  const ranked = Object.entries(totals)
    .map(([name, pct]) => ({ name, pct: Math.round(pct * 10) / 10 }))
    .sort((a, b) => b.pct - a.pct);

  const leader = ranked[0];
  const runner = ranked[1];

  const lastDate =
    polls
      .map((p) => p.endDate)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] ?? "—";

  const leaderPct = leader?.pct ?? 0;
  const runnerPct = runner?.pct ?? 0;

  return {
    leaderName: leader?.name ?? "—",
    leaderPct,
    runnerUpName: runner?.name,
    runnerUpPct: runner?.pct,
    margin: Math.round((leaderPct - runnerPct) * 10) / 10,
    lastDate,
    pollsUsed: polls.length,
  };
}
