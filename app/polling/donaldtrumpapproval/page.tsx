// app/polling/approval/trump/page.tsx
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
 * Implemented by inflating sampleSize: n' = n * (m^2) so √n' = m * √n.
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
  { pollster: "Marquette", endDate: "2026-01-28", sampleSize: 1003, sampleType: "A", results: { Approve: 42, Disapprove: 58 } },
  { pollster: "Morning Consult", endDate: "2026-02-01", sampleSize: 2201, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
  { pollster: "Rasmussen Reports", endDate: "2026-02-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 43, Disapprove: 56 } },
  { pollster: "InsiderAdvantage", endDate: "2026-02-01", sampleSize: 1000, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
  { pollster: "Economist/YouGov", endDate: "2026-02-02", sampleSize: 1504, sampleType: "RV", results: { Approve: 42, Disapprove: 55 } },
  { pollster: "Harvard-Harris", endDate: "2026-01-29", sampleSize: 2000, sampleType: "RV", results: { Approve: 45, Disapprove: 51 } },
  { pollster: "I&I/TIPP", endDate: "2026-01-29", sampleSize: 1384, sampleType: "RV", results: { Approve: 40, Disapprove: 51 } },
  { pollster: "Daily Mail", endDate: "2026-01-26", sampleSize: 1027, sampleType: "RV", results: { Approve: 45, Disapprove: 55 } },
  { pollster: "FOX News", endDate: "2026-01-26", sampleSize: 1005, sampleType: "RV", results: { Approve: 44, Disapprove: 56 } },
  { pollster: "Economist/YouGov", endDate: "2026-01-26", sampleSize: 1520, sampleType: "RV", results: { Approve: 41, Disapprove: 57 } },
  { pollster: "Morning Consult", endDate: "2026-01-25", sampleSize: 2201, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
  { pollster: "Reuters/Ipsos", endDate: "2026-01-25", sampleSize: 1139, sampleType: "A", results: { Approve: 38, Disapprove: 59 } },
  { pollster: "RMG Research*", endDate: "2026-01-28", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 51 } },
  { pollster: "Big Data Poll", endDate: "2026-01-24", sampleSize: 3280, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
  { pollster: "Pew Research", endDate: "2026-01-26", sampleSize: 8512, sampleType: "A", results: { Approve: 37, Disapprove: 61 } },
  { pollster: "Quantus Insights", endDate: "2026-01-22", sampleSize: 1000, sampleType: "RV", results: { Approve: 44, Disapprove: 52 } },
  { pollster: "Emerson", endDate: "2026-01-19", sampleSize: 1000, sampleType: "LV", results: { Approve: 43, Disapprove: 51 } },
  { pollster: "Economist/YouGov", endDate: "2026-01-19", sampleSize: 1549, sampleType: "RV", results: { Approve: 41, Disapprove: 56 } },
  { pollster: "Morning Consult", endDate: "2026-01-18", sampleSize: 2201, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
  { pollster: "RMG Research*", endDate: "2026-01-21", sampleSize: 3000, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
  { pollster: "CBS News", endDate: "2026-01-16", sampleSize: 2523, sampleType: "A", results: { Approve: 41, Disapprove: 59 } },
  { pollster: "NY Times/Siena", endDate: "2026-01-17", sampleSize: 1625, sampleType: "RV", results: { Approve: 40, Disapprove: 56 } },
  { pollster: "Marist", endDate: "2026-01-13", sampleSize: 1222, sampleType: "RV", results: { Approve: 39, Disapprove: 57 } },
  { pollster: "Reuters/Ipsos", endDate: "2026-01-13", sampleSize: 1217, sampleType: "A", results: { Approve: 41, Disapprove: 58 } },
  { pollster: "CNN", endDate: "2026-01-12", sampleSize: 968, sampleType: "RV", results: { Approve: 40, Disapprove: 59 } },
  { pollster: "Wall Street Journal", endDate: "2026-01-13", sampleSize: 1500, sampleType: "RV", results: { Approve: 45, Disapprove: 54 } },
  { pollster: "Economist/YouGov", endDate: "2026-01-12", sampleSize: 1437, sampleType: "RV", results: { Approve: 44, Disapprove: 54 } },
  { pollster: "Morning Consult", endDate: "2026-01-12", sampleSize: 2201, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
  { pollster: "Yahoo News", endDate: "2026-01-12", sampleSize: 1149, sampleType: "RV", results: { Approve: 43, Disapprove: 56 } },
  { pollster: "RMG Research*", endDate: "2026-01-14", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 51 } },
  { pollster: "Quinnipiac", endDate: "2026-01-12", sampleSize: 1133, sampleType: "RV", results: { Approve: 40, Disapprove: 54 } },
  { pollster: "AP/NORC**", endDate: "2026-01-11", sampleSize: 1203, sampleType: "A", results: { Approve: 40, Disapprove: 59 } },
  { pollster: "I&I/TIPP", endDate: "2026-01-09", sampleSize: 1478, sampleType: "A", results: { Approve: 40, Disapprove: 51 } },
  { pollster: "RMG Research*", endDate: "2026-01-08", sampleSize: 2000, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
  { pollster: "CBS News", endDate: "2026-01-07", sampleSize: 2325, sampleType: "A", results: { Approve: 41, Disapprove: 59 } },
  { pollster: "Reuters/Ipsos", endDate: "2026-01-05", sampleSize: 1248, sampleType: "A", results: { Approve: 42, Disapprove: 56 } },
  { pollster: "Economist/YouGov", endDate: "2026-01-05", sampleSize: 1389, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
  { pollster: "Morning Consult", endDate: "2026-01-04", sampleSize: 2201, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
];

const COLORS: Record<string, string> = {
  Approve: "#22c55e",
  Disapprove: "#ff4fd8",
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function fmtISO(iso: string) {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

export default function TrumpApprovalPage() {
  const { daily, range, lastDate, latestApprove, latestDisapprove, latestNet, seriesForChart } =
    useMemo(() => {
      const pollsAdjusted = RAW_POLLS.map((p) => ({
        ...p,
        sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
      }));

      const keys = getCandidateList(RAW_POLLS).sort((a, b) => a.localeCompare(b)); // Approve, Disapprove
      const range = getDateRange(RAW_POLLS);
      const dailyBase = buildDailyWeightedSeries(pollsAdjusted as any, keys, range.start, range.end);

      // keep Net in DATA for tooltip, but NOT rendered as a line
      const dailyWithNet = dailyBase.map((row) => {
        const a = Number((row as any).Approve ?? 0);
        const d = Number((row as any).Disapprove ?? 0);
        return { ...row, Net: round1(a - d) } as any;
      });

      const latest = dailyWithNet[dailyWithNet.length - 1] ?? null;

      const latestApprove = latest ? Number((latest as any).Approve ?? 0) : 0;
      const latestDisapprove = latest ? Number((latest as any).Disapprove ?? 0) : 0;
      const latestNet = latest ? Number((latest as any).Net ?? 0) : 0;

      const seriesForChart = [
        { key: "Approve", label: "Approve", color: COLORS.Approve },
        { key: "Disapprove", label: "Disapprove", color: COLORS.Disapprove },
      ];

      return {
        daily: dailyWithNet,
        range,
        lastDate: range.end,
        latestApprove,
        latestDisapprove,
        latestNet,
        seriesForChart,
      };
    }, []);

  const netText =
    latestNet === 0 ? "Even" : latestNet > 0 ? `+${round1(latestNet).toFixed(1)}` : `${round1(latestNet).toFixed(1)}`;

  return (
    <div className="space-y-10 psi-animate-in">
      {/* HERO */}
      <section className="relative overflow-hidden psi-card p-7 md:p-10">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-[rgba(34,197,94,0.14)] blur-3xl" />
          <div className="absolute -right-28 top-10 h-96 w-96 rounded-full bg-[rgba(255,79,216,0.14)] blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white/90 md:text-5xl">
              Donald Trump Approval Rating
            </h1>
            <p className="mt-3 text-white/65">
              Daily weighted average across included polls using recency, sample size, LV/RV/A adjustments,
              and PSI <span className="font-semibold text-white/85">Gold Standard</span> upweighting.
            </p>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 lg:grid-cols-4">
        <KpiCard label="Approve" value={`${round1(latestApprove).toFixed(1)}%`} sub="Daily weighted avg" />
        <KpiCard label="Disapprove" value={`${round1(latestDisapprove).toFixed(1)}%`} sub="Daily weighted avg" />
        <KpiCard label="Net" value={netText} sub="Approve − Disapprove" />
        <KpiCard label="Polls" value={`${RAW_POLLS.length}`} sub="Included in model" />
      </section>

      {/* CHART (net stays in tooltip via data, but no net line rendered) */}
      <PollingTimeSeriesChart
        data={daily as any[]}
        series={seriesForChart}
        yDomain={[30, 65]}
        title="Donald Trump national approval polling average"
        subtitle="Candidate trendlines over time; Hover to view data."
      />

      {/* POLL TABLE (below chart) */}
      <section className="psi-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white/85">Included polls</div>
          </div>
          <div className="psi-mono text-xs text-white/45">Sorted by end date</div>
        </div>

        <div className="my-4 psi-divider" />

        <div className="overflow-x-auto">
          <table className="psi-table w-full min-w-[860px]">
            <thead>
              <tr>
                <th>Pollster</th>
                <th className="psi-num">End date</th>
                <th className="psi-num">N</th>
                <th className="psi-num">Type</th>
                <th className="psi-num">Weight</th>
                <th className="psi-num">Approve</th>
                <th className="psi-num">Disapprove</th>
                <th className="psi-num">Net</th>
              </tr>
            </thead>
            <tbody>
              {[...RAW_POLLS]
                .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                .map((p) => {
                  const a = Number((p.results as any).Approve ?? 0);
                  const d = Number((p.results as any).Disapprove ?? 0);
                  const net = round1(a - d);
                  const netStr = net === 0 ? "0.0" : net > 0 ? `+${net.toFixed(1)}` : net.toFixed(1);

                  const gold = isGoldStandard(p.pollster);
                  const effN = effectiveSampleSize(p.pollster, p.sampleSize);
                  const w = gold ? `×${GOLD_STANDARD_MULTIPLIER.toFixed(2)}` : "×1.00";

                  return (
                    <tr key={`${p.pollster}-${p.endDate}-${p.sampleSize}`}>
                      <td className="text-white/80">
                        <div className="flex items-center gap-2">
                          <span>{p.pollster}</span>
                          {gold ? <span className="psi-chip psi-chip-gradient text-[11px]">Gold</span> : null}
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
                      <td className="psi-num text-white/85">{a.toFixed(0)}%</td>
                      <td className="psi-num text-white/85">{d.toFixed(0)}%</td>
                      <td className="psi-num text-white/85">{netStr}</td>
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
