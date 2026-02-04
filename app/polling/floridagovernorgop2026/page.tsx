// app/polling/fl-gov-2026-gop/page.tsx
"use client";

import React, { useMemo } from "react";
import PollingTimeSeriesChart from "@/app/components/PollingTimeSeriesChart";
import {
  Poll,
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";

/**
 * Gold Standard upweighting (from /methodology/gold-standard-pollsters):
 * We implement this WITHOUT changing the model by inflating sampleSize:
 * model uses √n, so using n' = n * (m^2) yields √n' = m * √n (i.e., an m× weight boost).
 */
const GOLD_STANDARD_MULTIPLIER = 2;

const GOLD_STANDARD_NAMES = [
  "Big Data Poll",
  "Rasmussen Reports",
  "AtlasIntel",
  "SoCalStrategies",
  "Emerson",
  "Trafalgar",
  "InsiderAdvantage",
  "Patriot Polling",
];

function normalizeName(s: string) {
  return s
    .toLowerCase()
    .replace(/\(r\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isGoldStandard(pollster: string) {
  const p = normalizeName(pollster);
  return GOLD_STANDARD_NAMES.some((n) => p.includes(normalizeName(n)));
}

function effectiveSampleSize(pollster: string, n: number) {
  if (!Number.isFinite(n) || n <= 0) return n;
  if (!isGoldStandard(pollster)) return n;
  return Math.round(n * GOLD_STANDARD_MULTIPLIER * GOLD_STANDARD_MULTIPLIER);
}

const RAW_POLLS: Poll[] = [
  {
    pollster: "Patriot Polling (R)",
    endDate: "2026-01-29",
    sampleSize: 827,
    sampleType: "LV",
    results: { "Byron Donalds": 37, "James Fishback": 23, Undecided: 40 },
  },
  {
    pollster: "Mason-Dixon Polling & Strategy",
    endDate: "2026-01-13",
    sampleSize: 400,
    sampleType: "RV",
    results: {
      "Jay Collins": 7,
      "Byron Donalds": 37,
      "James Fishback": 3,
      "Paul Renner": 4,
      Undecided: 49,
    },
  },
  {
    pollster: "Fabrizio, Lee & Associates (R)",
    endDate: "2026-01-06",
    sampleSize: 600,
    sampleType: "LV",
    results: {
      "Jay Collins": 6,
      "Byron Donalds": 45,
      "James Fishback": 4,
      "Paul Renner": 3,
      Undecided: 41,
    },
  },
  {
    pollster: "Fabrizio, Lee & Associates (R) — Ballot Test 2",
    endDate: "2026-01-06",
    sampleSize: 600,
    sampleType: "LV",
    results: {
      "Byron Donalds": 39,
      "James Fishback": 3,
      "Paul Renner": 1,
      Other: 26,
      Undecided: 31,
    },
  },
  {
    pollster: "Fabrizio, Lee & Associates (R) — Ballot Test 3",
    endDate: "2026-01-06",
    sampleSize: 600,
    sampleType: "LV",
    results: { "Byron Donalds": 47, "James Fishback": 5, "Paul Renner": 4, Undecided: 43 },
  },
  {
    pollster: "Public Opinion Strategies (R)",
    endDate: "2025-12-11",
    sampleSize: 700,
    sampleType: "RV",
    results: { "Jay Collins": 13, "Byron Donalds": 40, Other: 9, Undecided: 38 },
  },
  {
    pollster: "The Tyson Group (R)",
    endDate: "2025-12-09",
    sampleSize: 800,
    sampleType: "LV",
    results: { "Jay Collins": 9, "Byron Donalds": 38, "James Fishback": 2, "Paul Renner": 1, Undecided: 49 },
  },
  {
    pollster: "The American Promise",
    endDate: "2025-11-19",
    sampleSize: 800,
    sampleType: "LV",
    results: { "Jay Collins": 1, "Byron Donalds": 43, "James Fishback": 0, "Paul Renner": 2, Undecided: 54 },
  },
  {
    pollster: "Victory Insights (R)",
    endDate: "2025-11-13",
    sampleSize: 600,
    sampleType: "LV",
    results: { "Jay Collins": 1, "Byron Donalds": 45, "James Fishback": 1, "Paul Renner": 3, Undecided: 49 },
  },
  {
    pollster: "St. Pete Polls",
    endDate: "2025-10-15",
    sampleSize: 1034,
    sampleType: "LV",
    results: { "Jay Collins": 4, "Byron Donalds": 39, "Paul Renner": 3, Undecided: 54 },
  },
  {
    pollster: "St. Pete Polls — Ballot Test 2",
    endDate: "2025-10-15",
    sampleSize: 1034,
    sampleType: "LV",
    results: { "Jay Collins": 12, "Byron Donalds": 52, Undecided: 36 },
  },
  {
    pollster: "Targoz Market Research",
    endDate: "2025-09-18",
    sampleSize: 506,
    sampleType: "RV",
    results: { "Byron Donalds": 29, "Paul Renner": 9, Undecided: 62 },
  },
  {
    pollster: "The American Promise",
    endDate: "2025-09-05",
    sampleSize: 800,
    sampleType: "LV",
    results: { "Jay Collins": 2, "Byron Donalds": 40, "Paul Renner": 2, Undecided: 54 },
  },
];

const COLORS: Record<string, string> = {
  "Byron Donalds": "#2563eb",
  "James Fishback": "#b01f3a",
  "Jay Collins": "#7a1f7a",
  "Paul Renner": "#16a34a",
  Other: "#94a3b8",
  Undecided: "#cbd5e1",
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function fmtISO(iso: string) {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function leadText(
  leader: { name: string; avg: number } | null,
  runner: { name: string; avg: number } | null
) {
  if (!leader || !runner) return "—";
  const diff = round1(leader.avg - runner.avg);
  const sign = diff >= 0 ? "+" : "";
  return `${leader.name} ${sign}${diff.toFixed(1)}`;
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="psi-chip">{children}</span>;
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="psi-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-white/55">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white/90">{value}</div>
      {sub ? <div className="mt-1 text-sm text-white/60">{sub}</div> : null}
    </div>
  );
}

export default function FLGovGOP2026AveragesPage() {
  const {
    pollsAdjusted,
    candidatesForChart,
    daily,
    range,
    lastDate,
    ranked,
    leader,
    runner,
    series,
  } = useMemo(() => {
    const pollsAdjusted = RAW_POLLS.map((p) => ({
      ...p,
      sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
    }));

    // For chart/leaderboard: exclude Undecided/Other
    const allKeys = getCandidateList(RAW_POLLS).sort((a, b) => a.localeCompare(b));
    const candidatesForChart = allKeys.filter((k) => k !== "Undecided" && k !== "Other");

    const range = getDateRange(RAW_POLLS);
    const daily = buildDailyWeightedSeries(pollsAdjusted as any, candidatesForChart, range.start, range.end);

    const latest = daily[daily.length - 1] ?? null;

    const ranked = candidatesForChart
      .map((c) => ({ name: c, avg: Number((latest as any)?.[c] ?? 0) }))
      .sort((a, b) => b.avg - a.avg);

    const leader = ranked[0] ?? null;
    const runner = ranked[1] ?? null;

    const series = candidatesForChart.map((c) => ({
      key: c,
      label: c,
      color: COLORS[c] ?? "#334155",
    }));

    return { pollsAdjusted, candidatesForChart, daily, range, ranked, leader, runner, series, lastDate: range.end };
  }, []);

  return (
    <div className="space-y-10 psi-animate-in">
      {/* HERO */}
      <section className="relative overflow-hidden psi-card p-7 md:p-10">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-[rgba(37,99,235,0.14)] blur-3xl" />
          <div className="absolute -right-28 top-10 h-96 w-96 rounded-full bg-[rgba(176,31,58,0.14)] blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white/90 md:text-5xl">
              Florida Governor GOP Primary
            </h1>

            <p className="mt-3 text-white/65">
              Daily weighted average across included polls using recency, sample size, LV/RV/A adjustments,
              and PSI <span className="font-semibold text-white/85">Gold Standard</span> upweighting.
            </p>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-2 lg:grid-cols-4">
        <KpiCard
          label="Leader"
          value={leader ? leader.name : "—"}
          sub={leader ? `${round1(leader.avg).toFixed(1)}%` : undefined}
        />
        <KpiCard
          label="Runner-up"
          value={runner ? runner.name : "—"}
          sub={runner ? `${round1(runner.avg).toFixed(1)}%` : undefined}
        />
        <KpiCard label="Lead" value={leadText(leader, runner)} sub="Average spread" />
        <KpiCard label="Polls" value={`${RAW_POLLS.length}`} sub="Included in model" />
      </section>

      {/* CHART */}
      <PollingTimeSeriesChart
        data={daily as any[]}
        series={series}
        yDomain={[0, 60]}
        title="Polling average"
        subtitle="Candidate trendlines over time; Hover to view data"
      />

      {/* POLL TABLE (below chart, like Trump approval page) */}
      <section className="psi-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white/85">Included polls</div>
          </div>
          <div className="psi-mono text-xs text-white/45">Sorted by end date</div>
        </div>

        <div className="my-4 psi-divider" />

        <div className="overflow-x-auto">
          <table className="psi-table w-full min-w-[960px]">
            <thead>
              <tr>
                <th>Pollster</th>
                <th className="psi-num">End date</th>
                <th className="psi-num">N</th>
                <th className="psi-num">Type</th>
                <th className="psi-num">Weight</th>
                {candidatesForChart.map((c) => (
                  <th key={c} className="psi-num">
                    {c}
                  </th>
                ))}
                <th className="psi-num">Other</th>
                <th className="psi-num">Undecided</th>
              </tr>
            </thead>
            <tbody>
              {[...RAW_POLLS]
                .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                .map((p) => {
                  const gold = isGoldStandard(p.pollster);
                  const effN = effectiveSampleSize(p.pollster, p.sampleSize);
                  const w = gold ? `×${GOLD_STANDARD_MULTIPLIER.toFixed(2)}` : "×1.00";

                  return (
                    <tr key={`${p.pollster}-${p.endDate}-${p.sampleSize}`}>
                      <td className="text-white/80">
                        <div className="flex items-center gap-2">
                          <span>{p.pollster}</span>
                          {gold ? (
                            <span className="psi-chip psi-chip-gradient text-[11px]">Gold</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="psi-num text-white/70">{p.endDate}</td>
                      <td className="psi-num text-white/70">
                        {p.sampleSize.toLocaleString()}
                        {gold ? (
                          <span className="ml-2 psi-mono text-[11px] text-white/45">
                            (eff {effN.toLocaleString()})
                          </span>
                        ) : null}
                      </td>
                      <td className="psi-num text-white/70">{p.sampleType}</td>
                      <td className="psi-num text-white/80">{w}</td>

                      {candidatesForChart.map((c) => {
                        const v = Number((p.results as any)?.[c]);
                        return (
                          <td key={c} className="psi-num text-white/85">
                            {Number.isFinite(v) ? `${v.toFixed(0)}%` : "—"}
                          </td>
                        );
                      })}

                      <td className="psi-num text-white/80">
                        {Number.isFinite(Number((p.results as any)?.Other))
                          ? `${Number((p.results as any).Other).toFixed(0)}%`
                          : "—"}
                      </td>
                      <td className="psi-num text-white/80">
                        {Number.isFinite(Number((p.results as any)?.Undecided))
                          ? `${Number((p.results as any).Undecided).toFixed(0)}%`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
