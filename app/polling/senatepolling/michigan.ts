// michigan.ts
// 2026 Michigan (U.S. Senate) polling — Mike Rogers (R) vs potential Dem nominees
// Source rows provided by user; includes cases where a pollster reported multiple ballot tests in the same field dates.

export type Population = "LV" | "RV" | "V";

export type PollRow = {
  pollster: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  sampleSize: number;
  population: Population;
  moe?: number; // percent, e.g. 3.7 means ±3.7%
  results: Record<string, number>; // candidate -> %
  undecided?: number;
  note?: string; // for alternate ballot tests
};

export type Matchup = {
  race: "MI-SEN-2026";
  candidates: string[]; // ordered display
  polls: PollRow[];
};

export const MI_SEN_2026_MATCHUPS: Matchup[] = [
  {
    race: "MI-SEN-2026",
    candidates: ["Haley Stevens (D)", "Mike Rogers (R)"],
    polls: [
      {
        pollster: "Emerson College",
        start: "2026-01-24",
        end: "2026-01-25",
        sampleSize: 1000,
        population: "LV",
        moe: 3.0,
        results: { "Haley Stevens (D)": 47, "Mike Rogers (R)": 42 },
        undecided: 11,
      },
      {
        pollster: "Glengariff Group",
        start: "2026-01-02",
        end: "2026-01-06",
        sampleSize: 600,
        population: "LV",
        moe: 4.0,
        results: { "Haley Stevens (D)": 47, "Mike Rogers (R)": 42 },
        undecided: 11,
        note: "Ballot test A (as listed)",
      },
      {
        pollster: "Glengariff Group",
        start: "2026-01-02",
        end: "2026-01-06",
        sampleSize: 600,
        population: "LV",
        moe: 4.0,
        results: { "Haley Stevens (D)": 44, "Mike Rogers (R)": 44 },
        undecided: 12,
        note: "Ballot test B (as listed)",
      },
      {
        pollster: "Mitchell Research & Communications",
        start: "2025-11-18",
        end: "2025-11-21",
        sampleSize: 616,
        population: "LV",
        moe: 3.7,
        results: { "Haley Stevens (D)": 40, "Mike Rogers (R)": 42 },
        undecided: 18,
      },
      {
        pollster: "EPIC-MRA",
        start: "2025-11-06",
        end: "2025-11-11",
        sampleSize: 600,
        population: "RV",
        moe: 4.0,
        results: { "Haley Stevens (D)": 44, "Mike Rogers (R)": 42 },
        undecided: 14,
      },
      {
        pollster: "Rosetta Stone Communications (R)",
        start: "2025-10-23",
        end: "2025-10-25",
        sampleSize: 637,
        population: "LV",
        moe: 3.9,
        results: { "Haley Stevens (D)": 40, "Mike Rogers (R)": 47 },
        undecided: 13,
      },
      {
        pollster: "Normington Petts (D)",
        start: "2025-06-12",
        end: "2025-06-16",
        sampleSize: 700,
        population: "LV",
        moe: 3.7,
        results: { "Haley Stevens (D)": 47, "Mike Rogers (R)": 45 },
        undecided: 8,
      },
      {
        pollster: "Glengariff Group",
        start: "2025-05-05",
        end: "2025-05-08",
        sampleSize: 600,
        population: "RV",
        moe: 4.0,
        results: { "Haley Stevens (D)": 45, "Mike Rogers (R)": 44 },
        undecided: 11,
        note: "Ballot test A (as listed)",
      },
      {
        pollster: "Glengariff Group",
        start: "2025-05-05",
        end: "2025-05-08",
        sampleSize: 600,
        population: "RV",
        moe: 4.0,
        results: { "Haley Stevens (D)": 49, "Mike Rogers (R)": 43 },
        undecided: 8,
        note: "Ballot test B (as listed)",
      },
      {
        pollster: "Target Insyght",
        start: "2025-03-03",
        end: "2025-03-06",
        sampleSize: 600,
        population: "V",
        moe: 4.0,
        results: { "Haley Stevens (D)": 35, "Mike Rogers (R)": 41 },
        undecided: 24,
      },
    ],
  },

  {
    race: "MI-SEN-2026",
    candidates: ["Abdul El-Sayed (D)", "Mike Rogers (R)"],
    polls: [
      {
        pollster: "Emerson College",
        start: "2026-01-24",
        end: "2026-01-25",
        sampleSize: 1000,
        population: "LV",
        moe: 3.0,
        results: { "Abdul El-Sayed (D)": 43, "Mike Rogers (R)": 43 },
        undecided: 14,
      },
      {
        pollster: "Glengariff Group",
        start: "2026-01-02",
        end: "2026-01-06",
        sampleSize: 600,
        population: "LV",
        moe: 4.0,
        results: { "Abdul El-Sayed (D)": 47, "Mike Rogers (R)": 43 },
        undecided: 10,
        note: "Ballot test A (as listed)",
      },
      {
        pollster: "Glengariff Group",
        start: "2026-01-02",
        end: "2026-01-06",
        sampleSize: 600,
        population: "LV",
        moe: 4.0,
        results: { "Abdul El-Sayed (D)": 42, "Mike Rogers (R)": 48 },
        undecided: 10,
        note: "Ballot test B (as listed)",
      },
      {
        pollster: "Mitchell Research & Communications",
        start: "2025-11-18",
        end: "2025-11-21",
        sampleSize: 616,
        population: "LV",
        moe: 3.7,
        results: { "Abdul El-Sayed (D)": 38, "Mike Rogers (R)": 41 },
        undecided: 22,
      },
      {
        pollster: "Rosetta Stone Communications (R)",
        start: "2025-10-23",
        end: "2025-10-25",
        sampleSize: 637,
        population: "LV",
        moe: 3.9,
        results: { "Abdul El-Sayed (D)": 31, "Mike Rogers (R)": 45 },
        undecided: 24,
      },
      {
        pollster: "Glengariff Group",
        start: "2025-05-05",
        end: "2025-05-08",
        sampleSize: 600,
        population: "RV",
        moe: 4.0,
        results: { "Abdul El-Sayed (D)": 41, "Mike Rogers (R)": 47 },
        undecided: 12,
        note: "Ballot test A (as listed)",
      },
      {
        pollster: "Glengariff Group",
        start: "2025-05-05",
        end: "2025-05-08",
        sampleSize: 600,
        population: "RV",
        moe: 4.0,
        results: { "Abdul El-Sayed (D)": 45, "Mike Rogers (R)": 47 },
        undecided: 8,
        note: "Ballot test B (as listed)",
      },
    ],
  },

  {
    race: "MI-SEN-2026",
    candidates: ["Mallory McMorrow (D)", "Mike Rogers (R)"],
    polls: [
      {
        pollster: "Emerson College",
        start: "2026-01-24",
        end: "2026-01-25",
        sampleSize: 1000,
        population: "LV",
        moe: 3.0,
        results: { "Mallory McMorrow (D)": 46, "Mike Rogers (R)": 43 },
        undecided: 11,
      },
      {
        pollster: "Glengariff Group",
        start: "2026-01-02",
        end: "2026-01-06",
        sampleSize: 600,
        population: "LV",
        moe: 4.0,
        results: { "Mallory McMorrow (D)": 46, "Mike Rogers (R)": 43 },
        undecided: 11,
        note: "Ballot test A (as listed)",
      },
      {
        pollster: "Glengariff Group",
        start: "2026-01-02",
        end: "2026-01-06",
        sampleSize: 600,
        population: "LV",
        moe: 4.0,
        results: { "Mallory McMorrow (D)": 42, "Mike Rogers (R)": 46 },
        undecided: 12,
        note: "Ballot test B (as listed)",
      },
      {
        pollster: "Mitchell Research & Communications",
        start: "2025-11-18",
        end: "2025-11-21",
        sampleSize: 616,
        population: "LV",
        moe: 3.7,
        results: { "Mallory McMorrow (D)": 38, "Mike Rogers (R)": 44 },
        undecided: 19,
      },
      {
        pollster: "EPIC-MRA",
        start: "2025-11-06",
        end: "2025-11-11",
        sampleSize: 600,
        population: "RV",
        moe: 4.0,
        results: { "Mallory McMorrow (D)": 43, "Mike Rogers (R)": 42 },
        undecided: 15,
      },
      {
        pollster: "Rosetta Stone Communications (R)",
        start: "2025-10-23",
        end: "2025-10-25",
        sampleSize: 637,
        population: "LV",
        moe: 3.9,
        results: { "Mallory McMorrow (D)": 39, "Mike Rogers (R)": 46 },
        undecided: 15,
      },
      {
        pollster: "Normington Petts (D)",
        start: "2025-06-12",
        end: "2025-06-16",
        sampleSize: 700,
        population: "LV",
        moe: 3.7,
        results: { "Mallory McMorrow (D)": 44, "Mike Rogers (R)": 48 },
        undecided: 8,
      },
      {
        pollster: "Glengariff Group",
        start: "2025-05-05",
        end: "2025-05-08",
        sampleSize: 600,
        population: "RV",
        moe: 4.0,
        results: { "Mallory McMorrow (D)": 42, "Mike Rogers (R)": 46 },
        undecided: 12,
        note: "Ballot test A (as listed)",
      },
      {
        pollster: "Glengariff Group",
        start: "2025-05-05",
        end: "2025-05-08",
        sampleSize: 600,
        population: "RV",
        moe: 4.0,
        results: { "Mallory McMorrow (D)": 46, "Mike Rogers (R)": 44 },
        undecided: 10,
        note: "Ballot test B (as listed)",
      },
    ],
  },
];

// Optional convenience export if you want a single object map by matchup key
export const MI_SEN_2026_BY_MATCHUP = {
  stevens_vs_rogers: MI_SEN_2026_MATCHUPS[0],
  elsayed_vs_rogers: MI_SEN_2026_MATCHUPS[1],
  mcmorrow_vs_rogers: MI_SEN_2026_MATCHUPS[2],
} as const;

type PollLike = {
  pollster?: string;
  endDate?: string;
  sampleSize?: number;
  results: Record<string, number>;
};

// Choose which matchup you want to represent "Michigan" on the national map.
// I default to Stevens vs Rogers (index 0).
const DEFAULT_MATCHUP_INDEX = 0;

function matchupToPollLikes(matchupIndex = DEFAULT_MATCHUP_INDEX): PollLike[] {
  const m = MI_SEN_2026_MATCHUPS[matchupIndex];
  if (!m) return [];
  return m.polls.map((p) => ({
    pollster: p.pollster,
    endDate: p.end,
    sampleSize: p.sampleSize,
    results: p.results,
  }));
}

// Fallback path used by your page if getStateSummary isn't present:
export const STATE_POLLS: Record<string, PollLike[]> = {
  MI: matchupToPollLikes(DEFAULT_MATCHUP_INDEX),
};

// Preferred path used by your page:
export function getStateSummary(abbr: string) {
  if (abbr !== "MI") return null;

  const polls = STATE_POLLS.MI;
  if (!polls.length) return null;

  // Same logic as your page's computeLeaderFromPolls, copied here so the module is self-contained:
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
