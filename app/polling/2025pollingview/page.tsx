"use client";

import React, { useMemo, useState } from "react";
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
  "Atlas Intel",
  "SoCalStrategies",
  "SoCal Strategies",
  "Emerson",
  "Trafalgar",
  "InsiderAdvantage",
  "Patriot Polling",
];

function normalizeName(s: string) {
  return s
    .toLowerCase()
    .replace(/\(r\)/g, "")
    .replace(/\(d\)/g, "")
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

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function isoToDate(iso: string) {
  return new Date(iso + "T00:00:00");
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

/**
 * Build a daily linear series between two labeled endpoints.
 * - Outside the endpoint range: hold flat at nearest endpoint.
 */
function buildLinearDailySeries(args: {
  startISO: string;
  endISO: string;
  startValue: number;
  endValue: number;
}) {
  const { startISO, endISO, startValue, endValue } = args;

  const start = isoToDate(startISO);
  const end = isoToDate(endISO);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const spanMs = Math.max(1, endMs - startMs);

  return (dateISO: string) => {
    const t = isoToDate(dateISO).getTime();
    const frac = clamp01((t - startMs) / spanMs);
    return round1(startValue + frac * (endValue - startValue));
  };
}

function blendIfPresent(pollValue: number, trumpValue: number, wPoll: number, wTrump: number) {
  // If model returned 0/undefined for a candidate on a given day, don't inject Trump into it.
  if (!Number.isFinite(pollValue) || pollValue <= 0) return pollValue;
  return round1(pollValue * wPoll + trumpValue * wTrump);
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
      <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white/90">
        {value}
      </div>
      {sub ? <div className="mt-1 text-sm text-white/60">{sub}</div> : null}
    </div>
  );
}

type RaceKey = "VA_GOV" | "VA_LTGOV" | "VA_AG" | "NJ_GOV";

type RaceDef = {
  key: RaceKey;
  title: string;
  subtitle: string;
  state: "VA" | "NJ";
  candidates: { dem: string; rep: string };
  polls: Poll[];
};

// -------------------------
// POLLS
// -------------------------

const VA_GOV_POLLS: Poll[] = [
  { pollster: "Quantus Insights (R)", endDate: "2025-11-03", sampleSize: 1201, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 44, "Abigail Spanberger (D)": 53, Other: 1, Undecided: 2 } },
  { pollster: "InsiderAdvantage (R)", endDate: "2025-11-03", sampleSize: 800, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 50, Other: 5, Undecided: 5 } },
  { pollster: "Research Co.", endDate: "2025-11-03", sampleSize: 423, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 46, "Abigail Spanberger (D)": 54 } },
  { pollster: "Research Co.", endDate: "2025-11-03", sampleSize: 450, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 51, Undecided: 6 } },

  { pollster: "The Trafalgar Group (R)", endDate: "2025-11-02", sampleSize: 1057, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 50, Other: 1, Undecided: 6 } },
  { pollster: "Emerson College", endDate: "2025-10-31", sampleSize: 880, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 44, "Abigail Spanberger (D)": 55, Other: 0, Undecided: 1 } },
  { pollster: "Echelon Insights", endDate: "2025-10-31", sampleSize: 606, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 55, Undecided: 2 } },
  { pollster: "AtlasIntel", endDate: "2025-10-30", sampleSize: 1325, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 54, Other: 0, Undecided: 1 } },
  { pollster: "SoCal Strategies (R)", endDate: "2025-10-29", sampleSize: 800, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 53, Undecided: 4 } },
  { pollster: "State Navigate", endDate: "2025-10-28", sampleSize: 614, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 54, Undecided: 5 } },

  { pollster: "InsiderAdvantage (R)/Trafalgar (R)", endDate: "2025-10-28", sampleSize: 800, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 46, Other: 4, Undecided: 8 } },
  { pollster: "Roanoke College", endDate: "2025-10-27", sampleSize: 1041, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 51, Other: 3, Undecided: 5 } },

  { pollster: "YouGov", endDate: "2025-10-28", sampleSize: 1179, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 57, Other: 2 } },
  { pollster: "YouGov", endDate: "2025-10-28", sampleSize: 1179, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 55, Other: 0, Undecided: 4 } },

  { pollster: "A2 Insights", endDate: "2025-10-26", sampleSize: 776, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 46, "Abigail Spanberger (D)": 54, Undecided: 1 } },
  { pollster: "Christopher Newport University", endDate: "2025-10-23", sampleSize: 803, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 50, Undecided: 6 } },
  { pollster: "Suffolk University", endDate: "2025-10-21", sampleSize: 500, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 52, Other: 1, Undecided: 4 } },

  { pollster: "Quantus Insights (R)", endDate: "2025-10-20", sampleSize: 1302, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 46, "Abigail Spanberger (D)": 51, Other: 1, Undecided: 2 } },
  { pollster: "State Navigate", endDate: "2025-10-20", sampleSize: 694, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 55, Undecided: 3 } },

  { pollster: "Washington Post/Schar School", endDate: "2025-10-20", sampleSize: 927, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 54, Other: 2, Undecided: 2 } },
  { pollster: "Washington Post/Schar School", endDate: "2025-10-20", sampleSize: 927, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 53, Other: 5, Undecided: 2 } },

  { pollster: "Kaplan Strategies (R)", endDate: "2025-10-18", sampleSize: 556, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 51, Undecided: 7 } },
  { pollster: "co/efficient (R)", endDate: "2025-10-17", sampleSize: 937, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 44, "Abigail Spanberger (D)": 49, Other: 1, Undecided: 6 } },
  { pollster: "Clarity Campaign Labs (D)", endDate: "2025-10-17", sampleSize: 958, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 53, Undecided: 4 } },

  { pollster: "The Trafalgar Group (R)/InsiderAdvantage (R)", endDate: "2025-10-15", sampleSize: 1039, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 47, Other: 1, Undecided: 6 } },
  { pollster: "Virginia Commonwealth University", endDate: "2025-10-14", sampleSize: 842, sampleType: "A", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 49, Undecided: 9 } },
  { pollster: "The Trafalgar Group (R)", endDate: "2025-10-10", sampleSize: 1034, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 48, Other: 2, Undecided: 6 } },

  { pollster: "Public Policy Polling (D)", endDate: "2025-10-08", sampleSize: 558, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 52, Undecided: 5 } },
  { pollster: "Cygnal (R)", endDate: "2025-10-07", sampleSize: 600, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 49, Undecided: 6 } },

  { pollster: "Christopher Newport University", endDate: "2025-10-01", sampleSize: 805, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 52, Undecided: 6 } },
  { pollster: "The Trafalgar Group (R)", endDate: "2025-10-01", sampleSize: 1034, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 47, Other: 2, Undecided: 9 } },
  { pollster: "Emerson College", endDate: "2025-09-29", sampleSize: 725, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 52, Undecided: 5 } },

  { pollster: "Washington Post/Schar School", endDate: "2025-09-29", sampleSize: 1002, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 55, Other: 1, Undecided: 2 } },
  { pollster: "Washington Post/Schar School", endDate: "2025-09-29", sampleSize: 1002, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 53, Other: 4, Undecided: 3 } },

  { pollster: "A2 Insights", endDate: "2025-09-28", sampleSize: 771, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 48, Other: 1, Undecided: 6 } },
  { pollster: "co/efficient (R)", endDate: "2025-09-23", sampleSize: 1024, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 49, Other: 1, Undecided: 7 } },

  // source table says (V) for this one; mapping to RV to fit your SampleType union
  { pollster: "OnMessage Inc. (R)", endDate: "2025-09-18", sampleSize: 800, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 50, Undecided: 5 } },

  { pollster: "Christopher Newport University", endDate: "2025-09-14", sampleSize: 808, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 52, Undecided: 8 } },

  // source table has missing N: "– (V)" so sampleSize=0 (this makes its weight 0 in your model)
  { pollster: "Cygnal (R)", endDate: "2025-09-07", sampleSize: 0, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 50, Undecided: 7 } },

  { pollster: "Pulse Decision Science (R)", endDate: "2025-09-05", sampleSize: 512, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 48, Other: 1, Undecided: 8 } },
  { pollster: "SoCal Strategies (R)", endDate: "2025-09-01", sampleSize: 700, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 53, Undecided: 6 } },

  { pollster: "Virginia Commonwealth University", endDate: "2025-08-28", sampleSize: 764, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 49, Other: 2, Undecided: 11 } },
  { pollster: "co/efficient (R)", endDate: "2025-08-26", sampleSize: 1025, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 48, Other: 3, Undecided: 7 } },
  { pollster: "Roanoke College", endDate: "2025-08-15", sampleSize: 702, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 39, "Abigail Spanberger (D)": 46, Other: 1, Undecided: 14 } },

  { pollster: "Wick Insights", endDate: "2025-07-11", sampleSize: 1000, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 50, Other: 2, Undecided: 8 } },
  { pollster: "American Directions Research Group/AARP", endDate: "2025-07-08", sampleSize: 1001, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 34, "Abigail Spanberger (D)": 49, Other: 8, Undecided: 9 } },
  { pollster: "Virginia Commonwealth University", endDate: "2025-07-03", sampleSize: 806, sampleType: "A", results: { "Winsome Earle-Sears (R)": 37, "Abigail Spanberger (D)": 49, Other: 2, Undecided: 12 } },
  { pollster: "co/efficient (R)", endDate: "2025-06-10", sampleSize: 1127, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 46, Other: 2, Undecided: 9 } },

  { pollster: "Roanoke College", endDate: "2025-05-19", sampleSize: 609, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 26, "Abigail Spanberger (D)": 43, Other: 3, Undecided: 28 } },

  { pollster: "Pantheon Insight/HarrisX", endDate: "2025-05-13", sampleSize: 1000, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 48, "Abigail Spanberger (D)": 52 } },
  { pollster: "Pantheon Insight/HarrisX", endDate: "2025-05-13", sampleSize: 1000, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 48, Other: 7 } },

  { pollster: "Cygnal (R)", endDate: "2025-02-28", sampleSize: 600, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 46, Undecided: 14 } },
  { pollster: "Roanoke College", endDate: "2025-02-20", sampleSize: 690, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 24, "Abigail Spanberger (D)": 39, Other: 4, Undecided: 33 } },
  { pollster: "co/efficient (R)", endDate: "2025-01-20", sampleSize: 867, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 40, Other: 5, Undecided: 15 } },

  { pollster: "Virginia Commonwealth University", endDate: "2025-01-15", sampleSize: 806, sampleType: "A", results: { "Winsome Earle-Sears (R)": 34, "Abigail Spanberger (D)": 44, Other: 5, Undecided: 17 } },
  { pollster: "Christopher Newport University", endDate: "2025-01-13", sampleSize: 806, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 39, "Abigail Spanberger (D)": 44, Other: 6, Undecided: 12 } },
  { pollster: "Emerson College", endDate: "2025-01-08", sampleSize: 1000, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 42, Other: 4, Undecided: 13 } },

  { pollster: "Mason-Dixon Polling & Strategy", endDate: "2024-12-19", sampleSize: 625, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 44, "Abigail Spanberger (D)": 47, Undecided: 9 } },
  { pollster: "Research America Inc.", endDate: "2024-09-09", sampleSize: 1000, sampleType: "A", results: { "Winsome Earle-Sears (R)": 39, "Abigail Spanberger (D)": 39, Other: 10, Undecided: 12 } },

  { pollster: "co/efficient (R)", endDate: "2023-09-10", sampleSize: 834, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 26, "Abigail Spanberger (D)": 27, Undecided: 47 } },
];

const VA_LTGOV_POLLS: Poll[] = [
  { pollster: "Quantus Insights (R)", endDate: "2025-11-03", sampleSize: 1069, sampleType: "LV", results: { "John Reid (R)": 44, "Ghazala Hashmi (D)": 52, Other: 1, Undecided: 3 } },

  { pollster: "The Trafalgar Group (R)", endDate: "2025-11-02", sampleSize: 1057, sampleType: "LV", results: { "John Reid (R)": 46, "Ghazala Hashmi (D)": 48, Undecided: 6 } },

  { pollster: "Echelon Insights", endDate: "2025-10-31", sampleSize: 606, sampleType: "LV", results: { "John Reid (R)": 46, "Ghazala Hashmi (D)": 49, Undecided: 5 } },

  { pollster: "AtlasIntel", endDate: "2025-10-30", sampleSize: 1325, sampleType: "LV", results: { "John Reid (R)": 46, "Ghazala Hashmi (D)": 52, Other: 1, Undecided: 1 } },

  { pollster: "SoCal Strategies (R)", endDate: "2025-10-29", sampleSize: 800, sampleType: "LV", results: { "John Reid (R)": 45, "Ghazala Hashmi (D)": 47, Undecided: 8 } },

  { pollster: "State Navigate", endDate: "2025-10-28", sampleSize: 614, sampleType: "LV", results: { "John Reid (R)": 41, "Ghazala Hashmi (D)": 53, Undecided: 6 } },

  { pollster: "Roanoke College", endDate: "2025-10-27", sampleSize: 1041, sampleType: "LV", results: { "John Reid (R)": 40, "Ghazala Hashmi (D)": 42, Other: 4, Undecided: 14 } },

  { pollster: "A2 Insights", endDate: "2025-10-26", sampleSize: 776, sampleType: "LV", results: { "John Reid (R)": 45, "Ghazala Hashmi (D)": 53, Undecided: 2 } },

  { pollster: "Christopher Newport University", endDate: "2025-10-23", sampleSize: 803, sampleType: "LV", results: { "John Reid (R)": 45, "Ghazala Hashmi (D)": 47, Other: 1, Undecided: 7 } },

  { pollster: "Suffolk University", endDate: "2025-10-21", sampleSize: 500, sampleType: "LV", results: { "John Reid (R)": 45, "Ghazala Hashmi (D)": 45, Other: 2, Undecided: 8 } },

  { pollster: "State Navigate", endDate: "2025-10-20", sampleSize: 694, sampleType: "LV", results: { "John Reid (R)": 42, "Ghazala Hashmi (D)": 53, Undecided: 5 } },

  { pollster: "The Washington Post/Schar School", endDate: "2025-10-20", sampleSize: 927, sampleType: "LV", results: { "John Reid (R)": 44, "Ghazala Hashmi (D)": 51, Other: 3, Undecided: 2 } },
  { pollster: "The Washington Post/Schar School", endDate: "2025-10-20", sampleSize: 927, sampleType: "RV", results: { "John Reid (R)": 42, "Ghazala Hashmi (D)": 48, Other: 8, Undecided: 2 } },

  { pollster: "Quantus Insights (R)", endDate: "2025-10-20", sampleSize: 1302, sampleType: "RV", results: { "John Reid (R)": 45, "Ghazala Hashmi (D)": 49, Other: 1, Undecided: 5 } },

  { pollster: "Kaplan Strategies (R)", endDate: "2025-10-18", sampleSize: 556, sampleType: "LV", results: { "John Reid (R)": 41, "Ghazala Hashmi (D)": 48, Undecided: 11 } },

  { pollster: "co/efficient (R)", endDate: "2025-10-17", sampleSize: 937, sampleType: "LV", results: { "John Reid (R)": 42, "Ghazala Hashmi (D)": 47, Undecided: 11 } },

  { pollster: "Clarity Campaign Labs (D)", endDate: "2025-10-17", sampleSize: 958, sampleType: "RV", results: { "John Reid (R)": 44, "Ghazala Hashmi (D)": 48, Undecided: 8 } },

  { pollster: "The Trafalgar Group/InsiderAdvantage (R)", endDate: "2025-10-15", sampleSize: 1039, sampleType: "LV", results: { "John Reid (R)": 46, "Ghazala Hashmi (D)": 46, Undecided: 8 } },

  { pollster: "Virginia Commonwealth University", endDate: "2025-10-14", sampleSize: 842, sampleType: "A", results: { "John Reid (R)": 43, "Ghazala Hashmi (D)": 44, Undecided: 13 } },

  { pollster: "The Trafalgar Group (R)", endDate: "2025-10-10", sampleSize: 1034, sampleType: "LV", results: { "John Reid (R)": 46, "Ghazala Hashmi (D)": 47, Undecided: 7 } },

  { pollster: "Christopher Newport University", endDate: "2025-10-01", sampleSize: 805, sampleType: "RV", results: { "John Reid (R)": 39, "Ghazala Hashmi (D)": 48, Undecided: 12 } },

  { pollster: "The Trafalgar Group (R)", endDate: "2025-10-01", sampleSize: 1034, sampleType: "LV", results: { "John Reid (R)": 44, "Ghazala Hashmi (D)": 48, Undecided: 8 } },

  { pollster: "The Washington Post/Schar School", endDate: "2025-09-29", sampleSize: 1002, sampleType: "LV", results: { "John Reid (R)": 45, "Ghazala Hashmi (D)": 49, Other: 2, Undecided: 3 } },
  { pollster: "The Washington Post/Schar School", endDate: "2025-09-29", sampleSize: 1002, sampleType: "RV", results: { "John Reid (R)": 42, "Ghazala Hashmi (D)": 47, Other: 6, Undecided: 4 } },

  { pollster: "A2 Insights", endDate: "2025-09-28", sampleSize: 771, sampleType: "LV", results: { "John Reid (R)": 44, "Ghazala Hashmi (D)": 49, Other: 1, Undecided: 6 } },

  { pollster: "Christopher Newport University", endDate: "2025-09-14", sampleSize: 808, sampleType: "RV", results: { "John Reid (R)": 37, "Ghazala Hashmi (D)": 48, Undecided: 15 } },

  { pollster: "Pulse Decision Science (R)", endDate: "2025-09-05", sampleSize: 512, sampleType: "LV", results: { "John Reid (R)": 45, "Ghazala Hashmi (D)": 42, Undecided: 13 } },

  { pollster: "Virginia Commonwealth University", endDate: "2025-08-28", sampleSize: 804, sampleType: "A", results: { "John Reid (R)": 41, "Ghazala Hashmi (D)": 45, Undecided: 14 } },

  { pollster: "SoCal Strategies (R)", endDate: "2025-09-01", sampleSize: 700, sampleType: "LV", results: { "John Reid (R)": 41, "Ghazala Hashmi (D)": 46, Undecided: 14 } },

  { pollster: "co/efficient (R)", endDate: "2025-08-26", sampleSize: 1025, sampleType: "LV", results: { "John Reid (R)": 43, "Ghazala Hashmi (D)": 43, Undecided: 14 } },

  { pollster: "Roanoke College", endDate: "2025-08-15", sampleSize: 702, sampleType: "LV", results: { "John Reid (R)": 35, "Ghazala Hashmi (D)": 38, Undecided: 27 } },

  { pollster: "American Directions Research Group/AARP", endDate: "2025-07-08", sampleSize: 1001, sampleType: "LV", results: { "John Reid (R)": 32, "Ghazala Hashmi (D)": 47, Other: 9, Undecided: 12 } },

  // note: table says RV 764; you provided VCU 804(A) earlier in the list too.
  { pollster: "Virginia Commonwealth University", endDate: "2025-07-03", sampleSize: 764, sampleType: "RV", results: { "John Reid (R)": 36, "Ghazala Hashmi (D)": 45, Other: 4, Undecided: 15 } },
];

const VA_AG_POLLS: Poll[] = [
  { pollster: "Quantus Insights (R)", endDate: "2025-11-03", sampleSize: 1039, sampleType: "LV", results: { "Jason Miyares (R)": 47, "Jay Jones (D)": 47, Other: 1, Undecided: 5 } },
  { pollster: "InsiderAdvantage (R)", endDate: "2025-11-03", sampleSize: 800, sampleType: "LV", results: { "Jason Miyares (R)": 47, "Jay Jones (D)": 49, Undecided: 4 } },

  { pollster: "The Trafalgar Group (R)", endDate: "2025-11-02", sampleSize: 1057, sampleType: "LV", results: { "Jason Miyares (R)": 46, "Jay Jones (D)": 46, Undecided: 8 } },

  { pollster: "Emerson College", endDate: "2025-10-31", sampleSize: 880, sampleType: "LV", results: { "Jason Miyares (R)": 47, "Jay Jones (D)": 49, Undecided: 4 } },
  { pollster: "Echelon Insights", endDate: "2025-10-31", sampleSize: 606, sampleType: "LV", results: { "Jason Miyares (R)": 49, "Jay Jones (D)": 46, Other: 1, Undecided: 4 } },

  { pollster: "AtlasIntel", endDate: "2025-10-30", sampleSize: 1325, sampleType: "LV", results: { "Jason Miyares (R)": 48, "Jay Jones (D)": 47, Other: 3, Undecided: 2 } },

  { pollster: "SoCal Strategies (R)", endDate: "2025-10-29", sampleSize: 800, sampleType: "LV", results: { "Jason Miyares (R)": 48, "Jay Jones (D)": 46, Undecided: 6 } },
  { pollster: "State Navigate", endDate: "2025-10-28", sampleSize: 614, sampleType: "LV", results: { "Jason Miyares (R)": 46, "Jay Jones (D)": 49, Undecided: 5 } },
  { pollster: "Roanoke College", endDate: "2025-10-27", sampleSize: 1041, sampleType: "LV", results: { "Jason Miyares (R)": 46, "Jay Jones (D)": 38, Other: 4, Undecided: 12 } },

  { pollster: "A2 Insights", endDate: "2025-10-26", sampleSize: 776, sampleType: "LV", results: { "Jason Miyares (R)": 49, "Jay Jones (D)": 48, Undecided: 3 } },
  { pollster: "Christopher Newport University", endDate: "2025-10-23", sampleSize: 803, sampleType: "LV", results: { "Jason Miyares (R)": 46, "Jay Jones (D)": 45, Other: 1, Undecided: 8 } },
  { pollster: "Suffolk University", endDate: "2025-10-21", sampleSize: 500, sampleType: "LV", results: { "Jason Miyares (R)": 46, "Jay Jones (D)": 42, Other: 2, Undecided: 9 } },

  { pollster: "Quantus Insights (R)", endDate: "2025-10-20", sampleSize: 1302, sampleType: "RV", results: { "Jason Miyares (R)": 49, "Jay Jones (D)": 42, Other: 2, Undecided: 7 } },
  { pollster: "State Navigate", endDate: "2025-10-20", sampleSize: 694, sampleType: "LV", results: { "Jason Miyares (R)": 45, "Jay Jones (D)": 50, Undecided: 5 } },

  { pollster: "The Washington Post/Schar School", endDate: "2025-10-20", sampleSize: 927, sampleType: "LV", results: { "Jason Miyares (R)": 46, "Jay Jones (D)": 46, Other: 5, Undecided: 3 } },
  { pollster: "The Washington Post/Schar School", endDate: "2025-10-20", sampleSize: 927, sampleType: "RV", results: { "Jason Miyares (R)": 44, "Jay Jones (D)": 44, Other: 9, Undecided: 3 } },

  { pollster: "Kaplan Strategies (R)", endDate: "2025-10-18", sampleSize: 556, sampleType: "LV", results: { "Jason Miyares (R)": 45, "Jay Jones (D)": 44, Undecided: 10 } },
  { pollster: "co/efficient (R)", endDate: "2025-10-17", sampleSize: 937, sampleType: "LV", results: { "Jason Miyares (R)": 46, "Jay Jones (D)": 42, Undecided: 11 } },
  { pollster: "Clarity Campaign Labs (D)", endDate: "2025-10-17", sampleSize: 958, sampleType: "RV", results: { "Jason Miyares (R)": 47, "Jay Jones (D)": 47, Undecided: 6 } },

  { pollster: "The Trafalgar Group/InsiderAdvantage (R)", endDate: "2025-10-15", sampleSize: 1039, sampleType: "LV", results: { "Jason Miyares (R)": 50, "Jay Jones (D)": 45, Undecided: 6 } },

  { pollster: "Virginia Commonwealth University", endDate: "2025-10-14", sampleSize: 842, sampleType: "A", results: { "Jason Miyares (R)": 45, "Jay Jones (D)": 42, Undecided: 12 } },

  { pollster: "The Trafalgar Group (R)", endDate: "2025-10-10", sampleSize: 1034, sampleType: "LV", results: { "Jason Miyares (R)": 49, "Jay Jones (D)": 43, Undecided: 8 } },

  { pollster: "Cygnal (R)", endDate: "2025-10-07", sampleSize: 600, sampleType: "LV", results: { "Jason Miyares (R)": 46, "Jay Jones (D)": 44, Undecided: 10 } },
  { pollster: "Hart Research (D)", endDate: "2025-10-06", sampleSize: 600, sampleType: "LV", results: { "Jason Miyares (R)": 45, "Jay Jones (D)": 46, Undecided: 9 } },

  { pollster: "Christopher Newport University", endDate: "2025-10-01", sampleSize: 805, sampleType: "RV", results: { "Jason Miyares (R)": 43, "Jay Jones (D)": 49, Undecided: 8 } },
  { pollster: "The Trafalgar Group (R)", endDate: "2025-10-01", sampleSize: 1034, sampleType: "LV", results: { "Jason Miyares (R)": 45, "Jay Jones (D)": 49, Undecided: 6 } },

  { pollster: "The Washington Post/Schar School", endDate: "2025-09-29", sampleSize: 1002, sampleType: "LV", results: { "Jason Miyares (R)": 45, "Jay Jones (D)": 51, Other: 1, Undecided: 3 } },
  { pollster: "The Washington Post/Schar School", endDate: "2025-09-29", sampleSize: 1002, sampleType: "RV", results: { "Jason Miyares (R)": 42, "Jay Jones (D)": 48, Other: 6, Undecided: 3 } },

  { pollster: "A2 Insights", endDate: "2025-09-28", sampleSize: 771, sampleType: "LV", results: { "Jason Miyares (R)": 46, "Jay Jones (D)": 49, Other: 1, Undecided: 5 } },

  { pollster: "OnMessage Inc. (R)", endDate: "2025-09-18", sampleSize: 800, sampleType: "RV", results: { "Jason Miyares (R)": 46, "Jay Jones (D)": 46, Undecided: 8 } },

  { pollster: "Christopher Newport University", endDate: "2025-09-14", sampleSize: 808, sampleType: "RV", results: { "Jason Miyares (R)": 41, "Jay Jones (D)": 48, Undecided: 12 } },

  // table row has no sample size; keeping it but using sampleSize: 0 so it doesn't affect averages unless you prefer to delete it
  { pollster: "Cygnal (R)", endDate: "2025-09-07", sampleSize: 0, sampleType: "RV", results: { "Jason Miyares (R)": 43, "Jay Jones (D)": 46, Undecided: 11 } },

  { pollster: "Virginia Commonwealth University", endDate: "2025-08-28", sampleSize: 804, sampleType: "A", results: { "Jason Miyares (R)": 41, "Jay Jones (D)": 47, Undecided: 12 } },

  { pollster: "SoCal Strategies (R)", endDate: "2025-09-01", sampleSize: 700, sampleType: "LV", results: { "Jason Miyares (R)": 41, "Jay Jones (D)": 46, Undecided: 12 } },

  { pollster: "co/efficient (R)", endDate: "2025-08-26", sampleSize: 1025, sampleType: "LV", results: { "Jason Miyares (R)": 44, "Jay Jones (D)": 45, Undecided: 11 } },

  { pollster: "Roanoke College", endDate: "2025-08-15", sampleSize: 702, sampleType: "LV", results: { "Jason Miyares (R)": 38, "Jay Jones (D)": 41, Undecided: 21 } },

  { pollster: "Wick Insights", endDate: "2025-07-11", sampleSize: 1000, sampleType: "LV", results: { "Jason Miyares (R)": 41, "Jay Jones (D)": 48, Undecided: 11 } },

  { pollster: "American Directions Research Group/AARP", endDate: "2025-07-08", sampleSize: 1001, sampleType: "LV", results: { "Jason Miyares (R)": 36, "Jay Jones (D)": 53, Undecided: 11 } },

  { pollster: "Virginia Commonwealth University", endDate: "2025-07-03", sampleSize: 764, sampleType: "RV", results: { "Jason Miyares (R)": 37, "Jay Jones (D)": 46, Other: 3, Undecided: 13 } },
];


const NJ_GOV_POLLS: Poll[] = [
  // Research Co. (2 samples)
  { pollster: "Research Co.", endDate: "2025-11-03", sampleSize: 429, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 48, Other: 1 } },
  { pollster: "Research Co. (2)", endDate: "2025-11-03", sampleSize: 450, sampleType: "LV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 46, Other: 1, Undecided: 5 } },

  { pollster: "John Zogby Strategies (D)", endDate: "2025-11-03", sampleSize: 1205, sampleType: "LV", results: { "Mikie Sherrill (D)": 55, "Jack Ciattarelli (R)": 43, Other: 2 } },

  { pollster: "AtlasIntel", endDate: "2025-10-30", sampleSize: 1639, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 49, Undecided: 1 } },

  { pollster: "SoCal Strategies (R)", endDate: "2025-10-29", sampleSize: 800, sampleType: "LV", results: { "Mikie Sherrill (D)": 52, "Jack Ciattarelli (R)": 45, Undecided: 3 } },
  { pollster: "Suffolk University", endDate: "2025-10-29", sampleSize: 500, sampleType: "LV", results: { "Mikie Sherrill (D)": 46, "Jack Ciattarelli (R)": 42, Other: 2, Undecided: 7 } },

  // Emerson (2 lines, same n)
  { pollster: "Emerson College", endDate: "2025-10-28", sampleSize: 1000, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 48, Other: 1, Undecided: 1 } },
  { pollster: "Emerson College (2)", endDate: "2025-10-28", sampleSize: 1000, sampleType: "LV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 48, Other: 1, Undecided: 2 } },

  // Beacon/Shaw (LV + RV)
  { pollster: "Beacon (D)/Shaw (R)", endDate: "2025-10-28", sampleSize: 956, sampleType: "LV", results: { "Mikie Sherrill (D)": 52, "Jack Ciattarelli (R)": 45, Undecided: 3 } },
  { pollster: "Beacon (D)/Shaw (R) (RV)", endDate: "2025-10-28", sampleSize: 1107, sampleType: "RV", results: { "Mikie Sherrill (D)": 52, "Jack Ciattarelli (R)": 43, Undecided: 5 } },

  // Quinnipiac (2 lines)
  { pollster: "Quinnipiac University", endDate: "2025-10-28", sampleSize: 1166, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 43, Other: 2, Undecided: 4 } },
  { pollster: "Quinnipiac University (2)", endDate: "2025-10-28", sampleSize: 1166, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 44, Undecided: 4 } },

  // YouGov (2 lines)
  { pollster: "YouGov", endDate: "2025-10-28", sampleSize: 1153, sampleType: "LV", results: { "Mikie Sherrill (D)": 54, "Jack Ciattarelli (R)": 44, Other: 2 } },
  { pollster: "YouGov (2)", endDate: "2025-10-28", sampleSize: 1153, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 42, Other: 1, Undecided: 6 } },

  { pollster: "Quantus Insights (R)", endDate: "2025-10-27", sampleSize: 1380, sampleType: "LV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 46, Undecided: 5 } },
  { pollster: "co/efficient (R)", endDate: "2025-10-27", sampleSize: 995, sampleType: "LV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 47, Other: 1, Undecided: 5 } },
  { pollster: "A2 Insights", endDate: "2025-10-26", sampleSize: 812, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 47, Undecided: 2 } },

  { pollster: "GQR (D)", endDate: "2025-10-20", sampleSize: 1000, sampleType: "LV", results: { "Mikie Sherrill (D)": 52, "Jack Ciattarelli (R)": 40, Undecided: 8 } },
  { pollster: "Concord Public Opinion Partners (D)", endDate: "2025-10-18", sampleSize: 605, sampleType: "LV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 40, Undecided: 11 } },
  { pollster: "Rutgers-Eagleton", endDate: "2025-10-17", sampleSize: 795, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 45, Undecided: 5 } },

  // RV/LV combined — stored as RV so it fits your SampleType union
  { pollster: "KAConsulting (R)", endDate: "2025-10-16", sampleSize: 601, sampleType: "RV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 44, Undecided: 9 } },

  { pollster: "InsiderAdvantage (R)/Trafalgar (R)", endDate: "2025-10-15", sampleSize: 800, sampleType: "LV", results: { "Mikie Sherrill (D)": 45, "Jack Ciattarelli (R)": 44, Other: 4, Undecided: 7 } },
  { pollster: "Fairleigh Dickinson University", endDate: "2025-10-15", sampleSize: 814, sampleType: "RV", results: { "Mikie Sherrill (D)": 52, "Jack Ciattarelli (R)": 45, Undecided: 3 } },

  // Beacon/Shaw (Oct 10–14) LV + RV
  { pollster: "Beacon (D)/Shaw (R) (Oct 10–14 LV)", endDate: "2025-10-14", sampleSize: 869, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 45, Undecided: 5 } },
  { pollster: "Beacon (D)/Shaw (R) (Oct 10–14 RV)", endDate: "2025-10-14", sampleSize: 1002, sampleType: "RV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 44, Undecided: 8 } },

  // Quinnipiac (Oct 9–13) 2 lines
  { pollster: "Quinnipiac University (Oct 9–13)", endDate: "2025-10-13", sampleSize: 1327, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 44, Other: 2, Undecided: 4 } },
  { pollster: "Quinnipiac University (Oct 9–13) (2)", endDate: "2025-10-13", sampleSize: 1327, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 44, Undecided: 4 } },

  { pollster: "Rasmussen Reports (R)", endDate: "2025-10-09", sampleSize: 955, sampleType: "LV", results: { "Mikie Sherrill (D)": 46, "Jack Ciattarelli (R)": 40, Other: 4, Undecided: 9 } },
  { pollster: "Neighborhood Research (R)", endDate: "2025-10-09", sampleSize: 311, sampleType: "LV", results: { "Mikie Sherrill (D)": 44, "Jack Ciattarelli (R)": 44, Undecided: 12 } },

  { pollster: "Public Policy Polling (D)", endDate: "2025-10-03", sampleSize: 703, sampleType: "RV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 43, Undecided: 8 } },
  { pollster: "John Zogby Strategies (D) (Sep 30–Oct 2)", endDate: "2025-10-02", sampleSize: 912, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 42, Undecided: 8 } },
  { pollster: "Quantus Insights (R) (Sep 29–30)", endDate: "2025-09-30", sampleSize: 900, sampleType: "LV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 46, Undecided: 6 } },

  // Beacon/Shaw (Sep 25–28) LV + RV
  { pollster: "Beacon (D)/Shaw (R) (Sep 25–28 LV)", endDate: "2025-09-28", sampleSize: 822, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 42, Undecided: 8 } },
  { pollster: "Beacon (D)/Shaw (R) (Sep 25–28 RV)", endDate: "2025-09-28", sampleSize: 1002, sampleType: "RV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 41, Undecided: 11 } },

  { pollster: "Global Strategy Group (D)", endDate: "2025-09-25", sampleSize: 800, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 43, Undecided: 7 } },
  { pollster: "Valcour/Save Jersey (R)", endDate: "2025-09-24", sampleSize: 1274, sampleType: "LV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 45, Undecided: 7 } },
  { pollster: "Emerson College (Sep 22–23)", endDate: "2025-09-23", sampleSize: 935, sampleType: "LV", results: { "Mikie Sherrill (D)": 43, "Jack Ciattarelli (R)": 43, Other: 3, Undecided: 11 } },
  { pollster: "yes. every kid.", endDate: "2025-09-22", sampleSize: 704, sampleType: "LV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 41, Undecided: 10 } },

  { pollster: "National Research Inc. (R) (Sep 16–18)", endDate: "2025-09-18", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 45, "Jack Ciattarelli (R)": 46, Undecided: 9 } },

  // Quinnipiac (Sep 11–15) 2 lines
  { pollster: "Quinnipiac University (Sep 11–15)", endDate: "2025-09-15", sampleSize: 1238, sampleType: "LV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 41, Other: 2, Undecided: 6 } },
  { pollster: "Quinnipiac University (Sep 11–15) (2)", endDate: "2025-09-15", sampleSize: 1238, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 42, Undecided: 7 } },

  { pollster: "National Research Inc. (R) (Sep 8–10)", endDate: "2025-09-10", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 45, Undecided: 8 } },

  // Quantus (Sep 2–4) 2 lines
  { pollster: "Quantus Insights (R) (Sep 2–4)", endDate: "2025-09-04", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 37, Undecided: 16 } },
  { pollster: "Quantus Insights (R) (Sep 2–4) (2)", endDate: "2025-09-04", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 39, Undecided: 12 } },

  // TIPP (3 samples)
  { pollster: "TIPP Insights (R)", endDate: "2025-08-28", sampleSize: 1524, sampleType: "RV", results: { "Mikie Sherrill (D)": 37, "Jack Ciattarelli (R)": 36, Undecided: 27 } },
  { pollster: "TIPP Insights (R) (LV)", endDate: "2025-08-28", sampleSize: 1349, sampleType: "LV", results: { "Mikie Sherrill (D)": 46, "Jack Ciattarelli (R)": 39, Other: 2, Undecided: 12 } },
  { pollster: "TIPP Insights (R) (RV 1073)", endDate: "2025-08-28", sampleSize: 1073, sampleType: "RV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 43, Other: 2, Undecided: 8 } },

  // Rutgers-Eagleton (Jul 31–Aug 11) 2 lines
  { pollster: "Rutgers-Eagleton (Jul 31–Aug 11)", endDate: "2025-08-11", sampleSize: 1650, sampleType: "LV", results: { "Mikie Sherrill (D)": 44, "Jack Ciattarelli (R)": 35, Other: 3, Undecided: 17 } },
  { pollster: "Rutgers-Eagleton (Jul 31–Aug 11) (2)", endDate: "2025-08-11", sampleSize: 1650, sampleType: "LV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 37, Other: 3, Undecided: 12 } },

  { pollster: "A2 Insights (Jul 29–Aug 2)", endDate: "2025-08-02", sampleSize: 629, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 45, Undecided: 4 } },

  { pollster: "StimSight Research", endDate: "2025-07-24", sampleSize: 1108, sampleType: "LV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 42, Other: 1, Undecided: 9 } },
  { pollster: "Fairleigh Dickinson University (Jul 17–23)", endDate: "2025-07-23", sampleSize: 806, sampleType: "LV", results: { "Mikie Sherrill (D)": 45, "Jack Ciattarelli (R)": 37, Other: 3, Undecided: 15 } },

  // "July 2025" (no exact range in your pasted table)
  { pollster: "National Research Inc. (R) (July 2025)", endDate: "2025-07-15", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 46, "Jack Ciattarelli (R)": 43, Undecided: 11 } },

  // RV/LV combined — stored as RV so it fits your SampleType union
  { pollster: "KAConsulting (R) (Jun 24–27)", endDate: "2025-06-27", sampleSize: 800, sampleType: "RV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 42, Undecided: 11 } },

  { pollster: "Cygnal (R)", endDate: "2025-06-20", sampleSize: 500, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 43, Undecided: 7 } },

  // Rutgers-Eagleton (Jun 13–16) 2 lines
  { pollster: "Rutgers-Eagleton (Jun 13–16)", endDate: "2025-06-16", sampleSize: 621, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 31, Undecided: 18 } },
  { pollster: "Rutgers-Eagleton (Jun 13–16) (2)", endDate: "2025-06-16", sampleSize: 621, sampleType: "LV", results: { "Mikie Sherrill (D)": 56, "Jack Ciattarelli (R)": 35, Undecided: 9 } },

  { pollster: "National Research Inc. (R) (Jun 11–12)", endDate: "2025-06-12", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 45, "Jack Ciattarelli (R)": 42, Undecided: 12 } },

  { pollster: "SurveyUSA (D)", endDate: "2025-05-30", sampleSize: 576, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 38, Undecided: 12 } },
];


// -------------------------
// RACE DEFINITIONS
// -------------------------

const RACES: RaceDef[] = [
  {
    key: "VA_GOV",
    title: "Virginia Governor (2025)",
    subtitle: "Daily weighted polling average",
    state: "VA",
    candidates: { dem: "Abigail Spanberger (D)", rep: "Winsome Earle-Sears (R)" },
    polls: VA_GOV_POLLS,
  },
  {
    key: "VA_LTGOV",
    title: "Virginia Lt. Governor (2025)",
    subtitle: "Daily weighted polling average",
    state: "VA",
    candidates: { dem: "Ghazala Hashmi (D)", rep: "John Reid (R)" },
    polls: VA_LTGOV_POLLS,
  },
  {
    key: "VA_AG",
    title: "Virginia Attorney General (2025)",
    subtitle: "Daily weighted polling average",
    state: "VA",
    candidates: { dem: "Jay Jones (D)", rep: "Jason Miyares (R)" },
    polls: VA_AG_POLLS,
  },
  {
    key: "NJ_GOV",
    title: "New Jersey Governor (2025)",
    subtitle: "Daily weighted polling average",
    state: "NJ",
    candidates: { dem: "Mikie Sherrill (D)", rep: "Jack Ciattarelli (R)" },
    polls: NJ_GOV_POLLS,
  },
];

// -------------------------
// TRUMP STATE APPROVAL/DISAPPROVAL (from your screenshots)
// These are used ONLY to blend into candidate daily values when box is checked.
// - GOP candidate gets Trump APPROVE
// - DEM candidate gets Trump DISAPPROVE
//
// NJ endpoints:
// - 2025-01-29: Approve 38, Disapprove 59
// - 2025-12-13: Approve 34, Disapprove 63
//
// VA endpoints:
// - 2025-01-26: Approve 40, Disapprove 56
// - 2026-02-04: Approve 36, Disapprove 59
// -------------------------

const trumpApproveNJ = buildLinearDailySeries({
  startISO: "2025-01-29",
  endISO: "2025-12-13",
  startValue: 38,
  endValue: 34,
});
const trumpDisapproveNJ = buildLinearDailySeries({
  startISO: "2025-01-29",
  endISO: "2025-12-13",
  startValue: 59,
  endValue: 63,
});

const trumpApproveVA = buildLinearDailySeries({
  startISO: "2025-01-26",
  endISO: "2026-02-04",
  startValue: 40,
  endValue: 36,
});
const trumpDisapproveVA = buildLinearDailySeries({
  startISO: "2025-01-26",
  endISO: "2026-02-04",
  startValue: 56,
  endValue: 59,
});

// blend weights (your spec)
const W_POLL = 0.66;
const W_TRUMP = 0.33;

export default function GovernorElections2025Page() {
  const [raceKey, setRaceKey] = useState<RaceKey>("VA_GOV");
  const [factorTrump, setFactorTrump] = useState<boolean>(false);

  const race = useMemo(() => RACES.find((r) => r.key === raceKey)!, [raceKey]);

  const { daily, latestDem, latestRep, latestNetDemMinusRep, seriesForChart, pollCount } =
    useMemo(() => {
      const raw = race.polls ?? [];

      // gold-standard effective sample size
      const pollsAdjusted = raw.map((p) => ({
        ...p,
        sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
      }));

      const keys = getCandidateList(raw).sort((a, b) => a.localeCompare(b));
      const range = getDateRange(raw);

      const dailyBase = buildDailyWeightedSeries(
        pollsAdjusted as any,
        keys,
        range.start,
        range.end
      );

      const dailyFinal = dailyBase.map((row) => {
        const date = String((row as any).date);

        const trumpApprove =
          race.state === "NJ" ? trumpApproveNJ(date) : trumpApproveVA(date);
        const trumpDisapprove =
          race.state === "NJ" ? trumpDisapproveNJ(date) : trumpDisapproveVA(date);

        const demPoll = Number((row as any)[race.candidates.dem] ?? 0);
        const repPoll = Number((row as any)[race.candidates.rep] ?? 0);

        if (!factorTrump) {
          return {
            ...row,
            DemMinusRep: round1(demPoll - repPoll),
          } as any;
        }

        // ✅ KEY FIX:
        // - Democrat gets Trump DISAPPROVE blended in
        // - Republican gets Trump APPROVE blended in
        const demAdj = blendIfPresent(demPoll, trumpDisapprove, W_POLL, W_TRUMP);
        const repAdj = blendIfPresent(repPoll, trumpApprove, W_POLL, W_TRUMP);

        return {
          ...row,
          [race.candidates.dem]: demAdj,
          [race.candidates.rep]: repAdj,
          DemMinusRep: round1(Number(demAdj ?? 0) - Number(repAdj ?? 0)),
        } as any;
      });

      const latest = dailyFinal[dailyFinal.length - 1] ?? null;

      const latestDem = latest ? Number((latest as any)[race.candidates.dem] ?? 0) : 0;
      const latestRep = latest ? Number((latest as any)[race.candidates.rep] ?? 0) : 0;
      const latestNet = latest ? Number((latest as any).DemMinusRep ?? 0) : 0;

      // Chart series stays candidates-only (no Trump line shown)
      const series: { key: string; label: string; color: string }[] = [
        { key: race.candidates.dem, label: race.candidates.dem, color: "#184dfc" },
        { key: race.candidates.rep, label: race.candidates.rep, color: "#ff1717" },
      ];

      return {
        daily: dailyFinal,
        latestDem,
        latestRep,
        latestNetDemMinusRep: latestNet,
        seriesForChart: series,
        pollCount: raw.length,
      };
    }, [race, factorTrump]);

  const netText =
    latestNetDemMinusRep === 0
      ? "Even"
      : latestNetDemMinusRep > 0
      ? `D+${round1(latestNetDemMinusRep).toFixed(1)}`
      : `R+${Math.abs(round1(latestNetDemMinusRep)).toFixed(1)}`;

  return (
    <div className="space-y-10 psi-animate-in">
      {/* HERO */}
      <section className="relative overflow-hidden psi-card p-7 md:p-10">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-[rgba(34,197,94,0.14)] blur-3xl" />
          <div className="absolute -right-28 top-10 h-96 w-96 rounded-full bg-[rgba(255,79,216,0.14)] blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white/90 md:text-5xl">
              {race.title}
            </h1>
            <p className="mt-3 text-white/65">{race.subtitle}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Dropdown */}
            <div className="psi-card p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
                Race
              </div>
              <select
                className="mt-2 w-full rounded-md bg-black/30 px-3 py-2 text-sm text-white/90 outline-none ring-1 ring-white/10"
                value={raceKey}
                onChange={(e) => setRaceKey(e.target.value as RaceKey)}
              >
                {RACES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Toggle */}
            <div className="psi-card p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
                Model
              </div>
              <label className="mt-2 flex cursor-pointer items-center gap-3 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={factorTrump}
                  onChange={(e) => setFactorTrump(e.target.checked)}
                />
                <span>
                  {factorTrump
                    ? "Polling + Trump approvals modeled together for accuracy"
                    : "Polling avg only"}
                </span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 lg:grid-cols-4">
        <KpiCard
          label={race.candidates.dem}
          value={`${round1(latestDem).toFixed(1)}%`}
          sub={factorTrump ? "Blended daily avg" : "Daily weighted avg"}
        />
        <KpiCard
          label={race.candidates.rep}
          value={`${round1(latestRep).toFixed(1)}%`}
          sub={factorTrump ? "Blended daily avg" : "Daily weighted avg"}
        />
        <KpiCard label="Net" value={netText} sub="(Dem − Rep)" />
        <KpiCard label="Polls" value={`${pollCount}`} sub="Included in model" />
      </section>

      {/* CHART */}
      <PollingTimeSeriesChart
        data={daily as any[]}
        series={seriesForChart}
        yDomain={[20, 70]}
        title="Polling average over time"
        subtitle={
          factorTrump
            ? "Blended model: Polling + Trump approvals blended for accuracy"
            : "Candidates only."
        }
      />

      {/* POLL TABLE */}
      <section className="psi-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white/85">Included polls</div>
          </div>
          <div className="psi-mono text-xs text-white/45">Sorted by end date</div>
        </div>

        <div className="my-4 psi-divider" />

        <div className="overflow-x-auto">
          <table className="psi-table w-full min-w-[980px]">
            <thead>
              <tr>
                <th>Pollster</th>
                <th className="psi-num">End date</th>
                <th className="psi-num">N</th>
                <th className="psi-num">Type</th>
                <th className="psi-num">Weight</th>
                <th className="psi-num">{race.candidates.dem}</th>
                <th className="psi-num">{race.candidates.rep}</th>
                <th className="psi-num">Net (D−R)</th>
              </tr>
            </thead>
            <tbody>
              {[...race.polls]
                .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                .map((p) => {
                  const dem = Number((p.results as any)[race.candidates.dem] ?? 0);
                  const rep = Number((p.results as any)[race.candidates.rep] ?? 0);
                  const net = round1(dem - rep);
                  const netStr =
                    net === 0 ? "0.0" : net > 0 ? `+${net.toFixed(1)}` : net.toFixed(1);

                  const gold = isGoldStandard(p.pollster);
                  const effN = effectiveSampleSize(p.pollster, p.sampleSize);
                  const w = gold ? `×${GOLD_STANDARD_MULTIPLIER.toFixed(2)}` : "×1.00";

                  return (
                    <tr key={`${p.pollster}-${p.endDate}-${p.sampleSize}-${p.sampleType}`}>
                      <td className="text-white/80">
                        <div className="flex items-center gap-2">
                          <span>{p.pollster}</span>
                          {gold ? (
                            <span className="psi-chip psi-chip-gradient text-[11px]">
                              Gold
                            </span>
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
                      <td className="psi-num text-white/85">{dem ? `${dem.toFixed(0)}%` : "—"}</td>
                      <td className="psi-num text-white/85">{rep ? `${rep.toFixed(0)}%` : "—"}</td>
                      <td className="psi-num text-white/85">{dem && rep ? netStr : "—"}</td>
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
