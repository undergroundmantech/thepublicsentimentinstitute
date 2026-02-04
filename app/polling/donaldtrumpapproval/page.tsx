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
  { pollster: "Economist/YouGov", endDate: "2025-12-29", sampleSize: 1420, sampleType: "RV", results: { Approve: 42, Disapprove: 55 } },
{ pollster: "Big Data Poll", endDate: "2025-12-28", sampleSize: 3412, sampleType: "LV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Trafalgar Group", endDate: "2025-12-27", sampleSize: 1098, sampleType: "LV", results: { Approve: 50, Disapprove: 45 } },
{ pollster: "Economist/YouGov", endDate: "2025-12-22", sampleSize: 1425, sampleType: "RV", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Daily Mail", endDate: "2025-12-21", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 52 } },
{ pollster: "Morning Consult", endDate: "2025-12-21", sampleSize: 2203, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "InsiderAdvantage", endDate: "2025-12-20", sampleSize: 800, sampleType: "LV", results: { Approve: 50, Disapprove: 41 } },
{ pollster: "CBS News", endDate: "2025-12-19", sampleSize: 2300, sampleType: "A", results: { Approve: 41, Disapprove: 59 } },
{ pollster: "Atlas Intel", endDate: "2025-12-19", sampleSize: 2315, sampleType: "A", results: { Approve: 39, Disapprove: 60 } },
{ pollster: "Quantus Insights", endDate: "2025-12-16", sampleSize: 1000, sampleType: "RV", results: { Approve: 44, Disapprove: 53 } },
{ pollster: "Emerson", endDate: "2025-12-15", sampleSize: 1000, sampleType: "RV", results: { Approve: 41, Disapprove: 50 } },
{ pollster: "RMG Research*", endDate: "2025-12-18", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "FOX News", endDate: "2025-12-15", sampleSize: 1001, sampleType: "RV", results: { Approve: 44, Disapprove: 56 } },
{ pollster: "Economist/YouGov", endDate: "2025-12-15", sampleSize: 1453, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Morning Consult", endDate: "2025-12-15", sampleSize: 2201, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-12-14", sampleSize: 1016, sampleType: "A", results: { Approve: 39, Disapprove: 59 } },
{ pollster: "Quinnipiac", endDate: "2025-12-15", sampleSize: 1035, sampleType: "RV", results: { Approve: 40, Disapprove: 54 } },
{ pollster: "Susquehanna", endDate: "2025-12-17", sampleSize: 800, sampleType: "LV", results: { Approve: 38, Disapprove: 56 } },
{ pollster: "Big Data Poll", endDate: "2025-12-12", sampleSize: 3004, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "NPR/PBS/Marist", endDate: "2025-12-11", sampleSize: 1261, sampleType: "RV", results: { Approve: 40, Disapprove: 55 } },
{ pollster: "Gallup", endDate: "2025-12-15", sampleSize: 1016, sampleType: "A", results: { Approve: 36, Disapprove: 59 } },
{ pollster: "RMG Research*", endDate: "2025-12-11", sampleSize: 3000, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Economist/YouGov", endDate: "2025-12-08", sampleSize: 1380, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "CNBC", endDate: "2025-12-08", sampleSize: 1000, sampleType: "A", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "Rasmussen Reports", endDate: "2025-12-09", sampleSize: 1500, sampleType: "LV", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "AP/NORC**", endDate: "2025-12-08", sampleSize: 1146, sampleType: "A", results: { Approve: 36, Disapprove: 61 } },
{ pollster: "Quantus Insights", endDate: "2025-12-05", sampleSize: 1000, sampleType: "RV", results: { Approve: 43, Disapprove: 53 } },
{ pollster: "Daily Mail", endDate: "2025-12-05", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 53 } },
{ pollster: "Harvard-Harris", endDate: "2025-12-04", sampleSize: 2204, sampleType: "RV", results: { Approve: 47, Disapprove: 49 } },
{ pollster: "Morning Consult", endDate: "2025-12-07", sampleSize: 2201, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-12-08", sampleSize: 4434, sampleType: "A", results: { Approve: 41, Disapprove: 57 } },
{ pollster: "Economist/YouGov", endDate: "2025-12-01", sampleSize: 1456, sampleType: "RV", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Big Data Poll", endDate: "2025-12-01", sampleSize: 2008, sampleType: "RV", results: { Approve: 45, Disapprove: 51 } },
{ pollster: "NBC News Decision Desk", endDate: "2025-12-08", sampleSize: 20252, sampleType: "A", results: { Approve: 42, Disapprove: 58 } },
{ pollster: "Rasmussen Reports", endDate: "2025-12-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Morning Consult", endDate: "2025-11-30", sampleSize: 2200, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "I&I/TIPP", endDate: "2025-11-29", sampleSize: 1483, sampleType: "A", results: { Approve: 43, Disapprove: 47 } },
{ pollster: "RMG Research*", endDate: "2025-12-04", sampleSize: 3000, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Economist/YouGov", endDate: "2025-11-24", sampleSize: 1511, sampleType: "RV", results: { Approve: 43, Disapprove: 56 } },
{ pollster: "Yahoo News", endDate: "2025-11-24", sampleSize: 1132, sampleType: "RV", results: { Approve: 44, Disapprove: 54 } },
{ pollster: "Morning Consult", endDate: "2025-11-23", sampleSize: 2200, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "Rasmussen Reports", endDate: "2025-11-25", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "InsiderAdvantage", endDate: "2025-11-21", sampleSize: 800, sampleType: "LV", results: { Approve: 44, Disapprove: 49 } },
{ pollster: "Big Data Poll", endDate: "2025-11-21", sampleSize: 2006, sampleType: "RV", results: { Approve: 45, Disapprove: 50 } },
{ pollster: "CBS News", endDate: "2025-11-21", sampleSize: 2489, sampleType: "A", results: { Approve: 40, Disapprove: 60 } },
{ pollster: "Emerson", endDate: "2025-11-21", sampleSize: 1000, sampleType: "RV", results: { Approve: 45, Disapprove: 55 } },
{ pollster: "Daily Mail", endDate: "2025-11-20", sampleSize: 1246, sampleType: "RV", results: { Approve: 45, Disapprove: 55 } },
{ pollster: "Economist/YouGov", endDate: "2025-11-17", sampleSize: 1382, sampleType: "RV", results: { Approve: 43, Disapprove: 56 } },
{ pollster: "FOX News", endDate: "2025-11-17", sampleSize: 1005, sampleType: "RV", results: { Approve: 41, Disapprove: 58 } },
{ pollster: "RMG Research*", endDate: "2025-11-20", sampleSize: 3000, sampleType: "RV", results: { Approve: 46, Disapprove: 53 } },
{ pollster: "Rasmussen Reports", endDate: "2025-11-18", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Gallup", endDate: "2025-11-25", sampleSize: 1321, sampleType: "A", results: { Approve: 36, Disapprove: 60 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-11-17", sampleSize: 1017, sampleType: "A", results: { Approve: 38, Disapprove: 60 } },
{ pollster: "Morning Consult", endDate: "2025-11-16", sampleSize: 2201, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "NPR/PBS/Marist", endDate: "2025-11-13", sampleSize: 1291, sampleType: "RV", results: { Approve: 40, Disapprove: 57 } },
{ pollster: "Quantus Insights", endDate: "2025-11-12", sampleSize: 1000, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-11-12", sampleSize: 938, sampleType: "RV", results: { Approve: 40, Disapprove: 58 } },
{ pollster: "Marquette", endDate: "2025-11-12", sampleSize: 1052, sampleType: "A", results: { Approve: 43, Disapprove: 57 } },
{ pollster: "Economist/YouGov", endDate: "2025-11-10", sampleSize: 1500, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Morning Consult", endDate: "2025-11-09", sampleSize: 2201, sampleType: "RV", results: { Approve: 44, Disapprove: 54 } },
{ pollster: "RMG Research*", endDate: "2025-11-13", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 50 } },
{ pollster: "AP/NORC**", endDate: "2025-11-10", sampleSize: 1143, sampleType: "A", results: { Approve: 36, Disapprove: 62 } },
{ pollster: "Rasmussen Reports", endDate: "2025-11-11", sampleSize: 1500, sampleType: "LV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Harvard-Harris", endDate: "2025-11-06", sampleSize: 2000, sampleType: "RV", results: { Approve: 44, Disapprove: 51 } },
{ pollster: "Emerson", endDate: "2025-11-04", sampleSize: 1000, sampleType: "RV", results: { Approve: 41, Disapprove: 49 } },
{ pollster: "Economist/YouGov", endDate: "2025-11-03", sampleSize: 1475, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Morning Consult", endDate: "2025-11-02", sampleSize: 2202, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "RMG Research*", endDate: "2025-11-06", sampleSize: 3000, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2025-11-04", sampleSize: 1500, sampleType: "LV", results: { Approve: 46, Disapprove: 53 } },
{ pollster: "CBS News", endDate: "2025-10-31", sampleSize: 2124, sampleType: "A", results: { Approve: 41, Disapprove: 59 } },
{ pollster: "I&I/TIPP", endDate: "2025-10-31", sampleSize: 1418, sampleType: "A", results: { Approve: 40, Disapprove: 51 } },
{ pollster: "CNN", endDate: "2025-10-30", sampleSize: 954, sampleType: "RV", results: { Approve: 39, Disapprove: 61 } },
{ pollster: "NewsNation", endDate: "2025-10-29", sampleSize: 1159, sampleType: "LV", results: { Approve: 43, Disapprove: 56 } },
{ pollster: "Big Data Poll", endDate: "2025-10-28", sampleSize: 2984, sampleType: "RV", results: { Approve: 45, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2025-10-30", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 49 } },
{ pollster: "ABC/Wash Post/Ipsos", endDate: "2025-10-28", sampleSize: 2203, sampleType: "RV", results: { Approve: 43, Disapprove: 57 } },
{ pollster: "NBC News", endDate: "2025-10-28", sampleSize: 1000, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Economist/YouGov", endDate: "2025-10-27", sampleSize: 1476, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Rasmussen Reports", endDate: "2025-10-28", sampleSize: 1500, sampleType: "LV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Morning Consult", endDate: "2025-10-26", sampleSize: 2202, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-10-26", sampleSize: 1018, sampleType: "A", results: { Approve: 40, Disapprove: 57 } },
{ pollster: "Yahoo News", endDate: "2025-10-27", sampleSize: 1197, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Economist/YouGov", endDate: "2025-10-20", sampleSize: 1448, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "RMG Research*", endDate: "2025-10-22", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "Morning Consult", endDate: "2025-10-19", sampleSize: 2200, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "Quinnipiac", endDate: "2025-10-20", sampleSize: 1327, sampleType: "RV", results: { Approve: 40, Disapprove: 54 } },
{ pollster: "Rasmussen Reports", endDate: "2025-10-21", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-10-20", sampleSize: 4385, sampleType: "A", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Daily Mail", endDate: "2025-10-15", sampleSize: 1004, sampleType: "RV", results: { Approve: 51, Disapprove: 49 } },
{ pollster: "Emerson", endDate: "2025-10-14", sampleSize: 1000, sampleType: "RV", results: { Approve: 45, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-10-16", sampleSize: 3000, sampleType: "RV", results: { Approve: 52, Disapprove: 47 } },
{ pollster: "Gallup", endDate: "2025-10-16", sampleSize: 1000, sampleType: "A", results: { Approve: 41, Disapprove: 54 } },
{ pollster: "Economist/YouGov", endDate: "2025-10-13", sampleSize: 1467, sampleType: "RV", results: { Approve: 44, Disapprove: 54 } },
{ pollster: "Morning Consult", endDate: "2025-10-12", sampleSize: 2202, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "AP/NORC**", endDate: "2025-10-13", sampleSize: 1289, sampleType: "A", results: { Approve: 37, Disapprove: 61 } },
{ pollster: "Rasmussen Reports", endDate: "2025-10-14", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "CNBC", endDate: "2025-10-12", sampleSize: 1000, sampleType: "A", results: { Approve: 44, Disapprove: 52 } },
{ pollster: "Quantus Insights", endDate: "2025-10-08", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-10-07", sampleSize: 1154, sampleType: "A", results: { Approve: 40, Disapprove: 58 } },
{ pollster: "Economist/YouGov", endDate: "2025-10-06", sampleSize: 1490, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Rasmussen Reports", endDate: "2025-10-07", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Morning Consult", endDate: "2025-10-05", sampleSize: 2200, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "RMG Research*", endDate: "2025-10-09", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "CBS News", endDate: "2025-10-03", sampleSize: 2441, sampleType: "A", results: { Approve: 42, Disapprove: 58 } },
{ pollster: "Harvard-Harris", endDate: "2025-10-02", sampleSize: 2413, sampleType: "RV", results: { Approve: 46, Disapprove: 50 } },
{ pollster: "InsiderAdvantage", endDate: "2025-09-30", sampleSize: 800, sampleType: "LV", results: { Approve: 52, Disapprove: 46 } },
{ pollster: "I&I/TIPP", endDate: "2025-10-02", sampleSize: 1459, sampleType: "A", results: { Approve: 42, Disapprove: 46 } },
{ pollster: "Economist/YouGov", endDate: "2025-09-29", sampleSize: 1518, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "Rasmussen Reports", endDate: "2025-09-30", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "Morning Consult", endDate: "2025-09-28", sampleSize: 2202, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Yahoo News", endDate: "2025-09-29", sampleSize: 1129, sampleType: "RV", results: { Approve: 44, Disapprove: 55 } },
{ pollster: "RMG Research*", endDate: "2025-10-01", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "Pew Research", endDate: "2025-09-28", sampleSize: 3445, sampleType: "A", results: { Approve: 40, Disapprove: 58 } },
{ pollster: "NY Times/Siena", endDate: "2025-09-27", sampleSize: 1313, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "NPR/PBS/Marist", endDate: "2025-09-26", sampleSize: 1329, sampleType: "RV", results: { Approve: 42, Disapprove: 53 } },
{ pollster: "Economist/YouGov", endDate: "2025-09-22", sampleSize: 1392, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Quantus Insights", endDate: "2025-09-21", sampleSize: 1000, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Morning Consult", endDate: "2025-09-21", sampleSize: 2201, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-09-21", sampleSize: 1019, sampleType: "A", results: { Approve: 41, Disapprove: 58 } },
{ pollster: "RMG Research*", endDate: "2025-09-24", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Rasmussen Reports", endDate: "2025-09-23", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Marquette", endDate: "2025-09-24", sampleSize: 1043, sampleType: "A", results: { Approve: 43, Disapprove: 57 } },
{ pollster: "Quinnipiac", endDate: "2025-09-21", sampleSize: 1276, sampleType: "RV", results: { Approve: 38, Disapprove: 54 } },
{ pollster: "Atlas Intel", endDate: "2025-09-16", sampleSize: 1066, sampleType: "A", results: { Approve: 47, Disapprove: 52 } },
{ pollster: "Economist/YouGov", endDate: "2025-09-15", sampleSize: 1420, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Morning Consult", endDate: "2025-09-14", sampleSize: 2204, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "RMG Research*", endDate: "2025-09-17", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "Wash Post/Ipsos", endDate: "2025-09-15", sampleSize: 0, sampleType: "RV", results: { Approve: 45, Disapprove: 55 } },
{ pollster: "AP/NORC**", endDate: "2025-09-15", sampleSize: 1183, sampleType: "A", results: { Approve: 39, Disapprove: 60 } },
{ pollster: "FOX News", endDate: "2025-09-09", sampleSize: 1004, sampleType: "RV", results: { Approve: 46, Disapprove: 54 } },
{ pollster: "Gallup", endDate: "2025-09-16", sampleSize: 1000, sampleType: "A", results: { Approve: 40, Disapprove: 56 } },
{ pollster: "RMG Research*", endDate: "2025-09-11", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-09-09", sampleSize: 1084, sampleType: "A", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Rasmussen Reports", endDate: "2025-09-10", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "Economist/YouGov", endDate: "2025-09-08", sampleSize: 1487, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "Morning Consult", endDate: "2025-09-07", sampleSize: 2200, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "CBS News", endDate: "2025-09-05", sampleSize: 2385, sampleType: "A", results: { Approve: 44, Disapprove: 56 } },
{ pollster: "Economist/YouGov", endDate: "2025-09-02", sampleSize: 1549, sampleType: "RV", results: { Approve: 44, Disapprove: 55 } },
{ pollster: "Yahoo News", endDate: "2025-09-02", sampleSize: 1138, sampleType: "RV", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "RMG Research*", endDate: "2025-09-03", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "Rasmussen Reports", endDate: "2025-09-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "Morning Consult", endDate: "2025-08-31", sampleSize: 2202, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "I&I/TIPP", endDate: "2025-08-29", sampleSize: 1362, sampleType: "A", results: { Approve: 43, Disapprove: 47 } },
{ pollster: "Daily Mail", endDate: "2025-09-01", sampleSize: 867, sampleType: "RV", results: { Approve: 55, Disapprove: 45 } },
{ pollster: "Emerson", endDate: "2025-08-26", sampleSize: 1000, sampleType: "RV", results: { Approve: 45, Disapprove: 47 } },
{ pollster: "Quantus Insights", endDate: "2025-08-26", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2025-08-28", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Economist/YouGov", endDate: "2025-08-25", sampleSize: 1377, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Morning Consult", endDate: "2025-08-24", sampleSize: 2200, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2025-08-26", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 50 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-08-24", sampleSize: 1022, sampleType: "A", results: { Approve: 40, Disapprove: 54 } },
{ pollster: "AP/NORC**", endDate: "2025-08-25", sampleSize: 1182, sampleType: "A", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Quinnipiac", endDate: "2025-08-25", sampleSize: 1220, sampleType: "RV", results: { Approve: 37, Disapprove: 55 } },
{ pollster: "Harvard-Harris", endDate: "2025-08-21", sampleSize: 2025, sampleType: "RV", results: { Approve: 47, Disapprove: 49 } },
{ pollster: "NBC News Decision Desk", endDate: "2025-09-01", sampleSize: 30196, sampleType: "A", results: { Approve: 43, Disapprove: 57 } },
{ pollster: "InsiderAdvantage", endDate: "2025-08-17", sampleSize: 1000, sampleType: "LV", results: { Approve: 54, Disapprove: 44 } },
{ pollster: "RMG Research*", endDate: "2025-08-21", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "Morning Consult", endDate: "2025-08-17", sampleSize: 2201, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Economist/YouGov", endDate: "2025-08-18", sampleSize: 1408, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "Rasmussen Reports", endDate: "2025-08-19", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 49 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-08-18", sampleSize: 4446, sampleType: "A", results: { Approve: 40, Disapprove: 54 } },
{ pollster: "Quantus Insights", endDate: "2025-08-13", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Economist/YouGov", endDate: "2025-08-11", sampleSize: 1474, sampleType: "RV", results: { Approve: 44, Disapprove: 53 } },
{ pollster: "RMG Research*", endDate: "2025-08-14", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Morning Consult", endDate: "2025-08-10", sampleSize: 2200, sampleType: "RV", results: { Approve: 45, Disapprove: 51 } },
{ pollster: "Gallup", endDate: "2025-08-20", sampleSize: 1094, sampleType: "A", results: { Approve: 40, Disapprove: 56 } },
{ pollster: "Rasmussen Reports", endDate: "2025-08-12", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 49 } },
{ pollster: "Pew Research", endDate: "2025-08-10", sampleSize: 3554, sampleType: "A", results: { Approve: 38, Disapprove: 60 } },
{ pollster: "Economist/YouGov", endDate: "2025-08-04", sampleSize: 1528, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "RMG Research*", endDate: "2025-08-07", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Morning Consult", endDate: "2025-08-03", sampleSize: 2201, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "Rasmussen Reports", endDate: "2025-08-05", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "CNBC", endDate: "2025-08-03", sampleSize: 1000, sampleType: "A", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "IBD/TIPP", endDate: "2025-08-01", sampleSize: 1362, sampleType: "RV", results: { Approve: 45, Disapprove: 46 } },
{ pollster: "Economist/YouGov", endDate: "2025-07-28", sampleSize: 1610, sampleType: "RV", results: { Approve: 44, Disapprove: 53 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-07-27", sampleSize: 1023, sampleType: "A", results: { Approve: 40, Disapprove: 56 } },
{ pollster: "RMG Research*", endDate: "2025-07-31", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "Rasmussen Reports", endDate: "2025-07-29", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "Morning Consult", endDate: "2025-07-27", sampleSize: 2203, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Yahoo News", endDate: "2025-07-28", sampleSize: 1168, sampleType: "RV", results: { Approve: 44, Disapprove: 54 } },
{ pollster: "Trafalgar/InsiderAdvantage", endDate: "2025-07-23", sampleSize: 1200, sampleType: "LV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "Quantus Insights", endDate: "2025-07-23", sampleSize: 1123, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Daily Mail", endDate: "2025-07-22", sampleSize: 1007, sampleType: "RV", results: { Approve: 49, Disapprove: 51 } },
{ pollster: "Emerson", endDate: "2025-07-22", sampleSize: 1400, sampleType: "RV", results: { Approve: 46, Disapprove: 47 } },
{ pollster: "Economist/YouGov", endDate: "2025-07-21", sampleSize: 1551, sampleType: "RV", results: { Approve: 43, Disapprove: 56 } },
{ pollster: "FOX News", endDate: "2025-07-21", sampleSize: 1000, sampleType: "RV", results: { Approve: 46, Disapprove: 54 } },
{ pollster: "RMG Research*", endDate: "2025-07-24", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "Rasmussen Reports", endDate: "2025-07-22", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Morning Consult", endDate: "2025-07-20", sampleSize: 2202, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "Wall Street Journal", endDate: "2025-07-20", sampleSize: 1500, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "CBS News", endDate: "2025-07-18", sampleSize: 2343, sampleType: "A", results: { Approve: 42, Disapprove: 58 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-07-16", sampleSize: 1027, sampleType: "A", results: { Approve: 41, Disapprove: 54 } },
{ pollster: "Quantus Insights", endDate: "2025-07-16", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Atlas Intel", endDate: "2025-07-18", sampleSize: 1935, sampleType: "A", results: { Approve: 44, Disapprove: 55 } },
{ pollster: "Gallup", endDate: "2025-07-21", sampleSize: 1002, sampleType: "A", results: { Approve: 37, Disapprove: 58 } },
{ pollster: "Big Data Poll", endDate: "2025-07-14", sampleSize: 3022, sampleType: "RV", results: { Approve: 48, Disapprove: 49 } },
{ pollster: "AP/NORC**", endDate: "2025-07-14", sampleSize: 1437, sampleType: "A", results: { Approve: 40, Disapprove: 58 } },
{ pollster: "Marquette", endDate: "2025-07-16", sampleSize: 1005, sampleType: "A", results: { Approve: 45, Disapprove: 55 } },
{ pollster: "Economist/YouGov", endDate: "2025-07-14", sampleSize: 1506, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "RMG Research*", endDate: "2025-07-16", sampleSize: 3000, sampleType: "RV", results: { Approve: 52, Disapprove: 48 } },
{ pollster: "Morning Consult", endDate: "2025-07-13", sampleSize: 2201, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Rasmussen Reports", endDate: "2025-07-15", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Quinnipiac", endDate: "2025-07-14", sampleSize: 1290, sampleType: "RV", results: { Approve: 40, Disapprove: 54 } },
{ pollster: "CNN", endDate: "2025-07-13", sampleSize: 0, sampleType: "RV", results: { Approve: 44, Disapprove: 56 } },
{ pollster: "Daily Mail", endDate: "2025-07-10", sampleSize: 1013, sampleType: "RV", results: { Approve: 48, Disapprove: 52 } },
{ pollster: "Harvard-Harris", endDate: "2025-07-08", sampleSize: 2044, sampleType: "RV", results: { Approve: 47, Disapprove: 49 } },
{ pollster: "Economist/YouGov", endDate: "2025-07-07", sampleSize: 1389, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "Morning Consult", endDate: "2025-07-06", sampleSize: 2203, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "Rasmussen Reports", endDate: "2025-07-08", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 49 } },
{ pollster: "RMG Research*", endDate: "2025-07-10", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 47 } },
{ pollster: "Quantus Insights", endDate: "2025-07-02", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 49 } },
{ pollster: "Economist/YouGov", endDate: "2025-06-30", sampleSize: 1491, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Yahoo News", endDate: "2025-06-30", sampleSize: 1074, sampleType: "RV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Morning Consult", endDate: "2025-06-29", sampleSize: 2202, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Rasmussen Reports", endDate: "2025-06-30", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "I&I/TIPP", endDate: "2025-06-27", sampleSize: 1421, sampleType: "A", results: { Approve: 44, Disapprove: 45 } },
{ pollster: "Emerson", endDate: "2025-06-25", sampleSize: 1000, sampleType: "RV", results: { Approve: 45, Disapprove: 46 } },
{ pollster: "NPR/PBS/Marist", endDate: "2025-06-25", sampleSize: 1206, sampleType: "RV", results: { Approve: 44, Disapprove: 53 } },
{ pollster: "Quantus Insights", endDate: "2025-06-25", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Quinnipiac", endDate: "2025-06-24", sampleSize: 979, sampleType: "RV", results: { Approve: 41, Disapprove: 54 } },
{ pollster: "RMG Research*", endDate: "2025-06-26", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-06-23", sampleSize: 1139, sampleType: "A", results: { Approve: 41, Disapprove: 57 } },
{ pollster: "Economist/YouGov", endDate: "2025-06-23", sampleSize: 1455, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "Morning Consult", endDate: "2025-06-22", sampleSize: 2205, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Rasmussen Reports", endDate: "2025-06-23", sampleSize: 1500, sampleType: "LV", results: { Approve: 52, Disapprove: 47 } },
{ pollster: "Trafalgar Group", endDate: "2025-06-20", sampleSize: 1085, sampleType: "LV", results: { Approve: 54, Disapprove: 45 } },
{ pollster: "FOX News", endDate: "2025-06-16", sampleSize: 1003, sampleType: "RV", results: { Approve: 46, Disapprove: 54 } },
{ pollster: "InsiderAdvantage", endDate: "2025-06-16", sampleSize: 1000, sampleType: "LV", results: { Approve: 54, Disapprove: 44 } },
{ pollster: "RMG Research*", endDate: "2025-06-19", sampleSize: 3000, sampleType: "RV", results: { Approve: 53, Disapprove: 46 } },
{ pollster: "Economist/YouGov", endDate: "2025-06-16", sampleSize: 1351, sampleType: "RV", results: { Approve: 44, Disapprove: 53 } },
{ pollster: "Morning Consult", endDate: "2025-06-15", sampleSize: 2207, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-06-16", sampleSize: 4258, sampleType: "A", results: { Approve: 42, Disapprove: 54 } },
{ pollster: "Rasmussen Reports", endDate: "2025-06-16", sampleSize: 1500, sampleType: "LV", results: { Approve: 52, Disapprove: 47 } },
{ pollster: "Harvard-Harris", endDate: "2025-06-12", sampleSize: 2097, sampleType: "RV", results: { Approve: 46, Disapprove: 50 } },
{ pollster: "Daily Mail", endDate: "2025-06-11", sampleSize: 1807, sampleType: "RV", results: { Approve: 48, Disapprove: 52 } },
{ pollster: "Gallup", endDate: "2025-06-19", sampleSize: 1000, sampleType: "A", results: { Approve: 40, Disapprove: 57 } },
{ pollster: "Quantus Insights", endDate: "2025-06-11", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 49 } },
{ pollster: "Economist/YouGov", endDate: "2025-06-09", sampleSize: 1397, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Quinnipiac", endDate: "2025-06-09", sampleSize: 1265, sampleType: "RV", results: { Approve: 38, Disapprove: 54 } },
{ pollster: "AP/NORC**", endDate: "2025-06-09", sampleSize: 1158, sampleType: "A", results: { Approve: 39, Disapprove: 60 } },
{ pollster: "Morning Consult", endDate: "2025-06-08", sampleSize: 1867, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2025-06-09", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-06-12", sampleSize: 3000, sampleType: "RV", results: { Approve: 52, Disapprove: 46 } },
{ pollster: "Pew Research", endDate: "2025-06-08", sampleSize: 5044, sampleType: "A", results: { Approve: 41, Disapprove: 58 } },
{ pollster: "CBS News", endDate: "2025-06-06", sampleSize: 2428, sampleType: "A", results: { Approve: 45, Disapprove: 55 } },
{ pollster: "NBC News Decision Desk", endDate: "2025-06-10", sampleSize: 19410, sampleType: "A", results: { Approve: 45, Disapprove: 55 } },
{ pollster: "Daily Mail", endDate: "2025-06-06", sampleSize: 1006, sampleType: "RV", results: { Approve: 47, Disapprove: 53 } },
{ pollster: "Quantus Insights", endDate: "2025-06-04", sampleSize: 1000, sampleType: "RV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "Economist/YouGov", endDate: "2025-06-02", sampleSize: 1436, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "Trafalgar Group", endDate: "2025-06-01", sampleSize: 1098, sampleType: "LV", results: { Approve: 54, Disapprove: 46 } },
{ pollster: "Morning Consult", endDate: "2025-06-01", sampleSize: 2205, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2025-06-03", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 46 } },
{ pollster: "I&I/TIPP", endDate: "2025-05-30", sampleSize: 1395, sampleType: "A", results: { Approve: 43, Disapprove: 45 } },
{ pollster: "Rasmussen Reports", endDate: "2025-05-29", sampleSize: 1500, sampleType: "LV", results: { Approve: 53, Disapprove: 46 } },
{ pollster: "Economist/YouGov", endDate: "2025-05-26", sampleSize: 1486, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Yahoo News", endDate: "2025-05-27", sampleSize: 1560, sampleType: "A", results: { Approve: 41, Disapprove: 54 } },
{ pollster: "RMG Research*", endDate: "2025-05-29", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 50 } },
{ pollster: "Morning Consult", endDate: "2025-05-25", sampleSize: 2208, sampleType: "RV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "Atlas Intel", endDate: "2025-05-27", sampleSize: 3469, sampleType: "A", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Rasmussen Reports", endDate: "2025-05-22", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Quantus Insights", endDate: "2025-05-20", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 48 } },
{ pollster: "Daily Kos/Civiqs", endDate: "2025-05-20", sampleSize: 1018, sampleType: "RV", results: { Approve: 47, Disapprove: 52 } },
{ pollster: "InsiderAdvantage", endDate: "2025-05-19", sampleSize: 1000, sampleType: "LV", results: { Approve: 55, Disapprove: 44 } },
{ pollster: "Economist/YouGov", endDate: "2025-05-19", sampleSize: 1558, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "Morning Consult", endDate: "2025-05-18", sampleSize: 2200, sampleType: "RV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-05-18", sampleSize: 1024, sampleType: "A", results: { Approve: 42, Disapprove: 52 } },
{ pollster: "RMG Research*", endDate: "2025-05-21", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Harvard-Harris", endDate: "2025-05-15", sampleSize: 1903, sampleType: "RV", results: { Approve: 47, Disapprove: 48 } },
{ pollster: "Daily Mail", endDate: "2025-05-14", sampleSize: 1003, sampleType: "RV", results: { Approve: 50, Disapprove: 50 } },
{ pollster: "Marquette", endDate: "2025-05-15", sampleSize: 1004, sampleType: "A", results: { Approve: 46, Disapprove: 54 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-05-13", sampleSize: 1163, sampleType: "A", results: { Approve: 44, Disapprove: 52 } },
{ pollster: "Rasmussen Reports", endDate: "2025-05-15", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-05-15", sampleSize: 3000, sampleType: "RV", results: { Approve: 52, Disapprove: 48 } },
{ pollster: "Economist/YouGov", endDate: "2025-05-12", sampleSize: 1610, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "Morning Consult", endDate: "2025-05-11", sampleSize: 2221, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Gallup", endDate: "2025-05-18", sampleSize: 1003, sampleType: "A", results: { Approve: 43, Disapprove: 53 } },
{ pollster: "Quantus Insights", endDate: "2025-05-07", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 48 } },
{ pollster: "Rasmussen Reports", endDate: "2025-05-08", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "Big Data Poll", endDate: "2025-05-05", sampleSize: 3128, sampleType: "RV", results: { Approve: 48, Disapprove: 47 } },
{ pollster: "Economist/YouGov", endDate: "2025-05-05", sampleSize: 1693, sampleType: "RV", results: { Approve: 44, Disapprove: 52 } },
{ pollster: "Morning Consult", endDate: "2025-05-04", sampleSize: 2263, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "AP/NORC", endDate: "2025-05-05", sampleSize: 1175, sampleType: "A", results: { Approve: 41, Disapprove: 57 } },
{ pollster: "RMG Research*", endDate: "2025-05-08", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 49 } },
{ pollster: "I&I/TIPP", endDate: "2025-05-02", sampleSize: 1400, sampleType: "A", results: { Approve: 42, Disapprove: 47 } },
{ pollster: "Trafalgar/InsiderAdvantage", endDate: "2025-05-01", sampleSize: 1200, sampleType: "LV", results: { Approve: 46, Disapprove: 44 } },
{ pollster: "Rasmussen Reports", endDate: "2025-05-01", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Emerson", endDate: "2025-04-28", sampleSize: 1000, sampleType: "RV", results: { Approve: 45, Disapprove: 45 } },
{ pollster: "Economist/YouGov", endDate: "2025-04-28", sampleSize: 1626, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "Yahoo News", endDate: "2025-04-28", sampleSize: 1071, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-04-27", sampleSize: 1029, sampleType: "A", results: { Approve: 42, Disapprove: 53 } },
{ pollster: "RMG Research*", endDate: "2025-05-01", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "Daily Mail", endDate: "2025-04-28", sampleSize: 1006, sampleType: "RV", results: { Approve: 45, Disapprove: 55 } },
{ pollster: "NewsNation", endDate: "2025-04-27", sampleSize: 1448, sampleType: "RV", results: { Approve: 44, Disapprove: 56 } },
{ pollster: "CBS News", endDate: "2025-04-25", sampleSize: 2365, sampleType: "A", results: { Approve: 45, Disapprove: 55 } },
{ pollster: "NY Times/Siena", endDate: "2025-04-24", sampleSize: 913, sampleType: "RV", results: { Approve: 42, Disapprove: 54 } },
{ pollster: "Quantus Insights", endDate: "2025-04-23", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "NPR/PBS/Marist", endDate: "2025-04-23", sampleSize: 1324, sampleType: "RV", results: { Approve: 43, Disapprove: 53 } },
{ pollster: "Rasmussen Reports", endDate: "2025-04-24", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "CNN", endDate: "2025-04-24", sampleSize: 0, sampleType: "RV", results: { Approve: 43, Disapprove: 57 } },
{ pollster: "AP/NORC**", endDate: "2025-04-21", sampleSize: 1260, sampleType: "A", results: { Approve: 39, Disapprove: 59 } },
{ pollster: "RMG Research*", endDate: "2025-04-24", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "Economist/YouGov", endDate: "2025-04-22", sampleSize: 1446, sampleType: "RV", results: { Approve: 44, Disapprove: 53 } },
{ pollster: "ABC/Wash Post/Ipsos", endDate: "2025-04-22", sampleSize: 1992, sampleType: "RV", results: { Approve: 42, Disapprove: 55 } },
{ pollster: "FOX News", endDate: "2025-04-21", sampleSize: 1104, sampleType: "RV", results: { Approve: 44, Disapprove: 55 } },
{ pollster: "Morning Consult", endDate: "2025-04-20", sampleSize: 2207, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-04-21", sampleSize: 4306, sampleType: "A", results: { Approve: 42, Disapprove: 53 } },
{ pollster: "Rasmussen Reports", endDate: "2025-04-17", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "Economist/YouGov", endDate: "2025-04-15", sampleSize: 1329, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Daily Kos/Civiqs", endDate: "2025-04-15", sampleSize: 1124, sampleType: "RV", results: { Approve: 46, Disapprove: 53 } },
{ pollster: "Daily Mail", endDate: "2025-04-14", sampleSize: 1002, sampleType: "RV", results: { Approve: 54, Disapprove: 46 } },
{ pollster: "Atlas Intel", endDate: "2025-04-14", sampleSize: 2347, sampleType: "A", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Morning Consult", endDate: "2025-04-13", sampleSize: 2203, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "RMG Research*", endDate: "2025-04-16", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "CNBC", endDate: "2025-04-13", sampleSize: 1000, sampleType: "A", results: { Approve: 44, Disapprove: 51 } },
{ pollster: "Harvard-Harris", endDate: "2025-04-10", sampleSize: 2286, sampleType: "RV", results: { Approve: 48, Disapprove: 46 } },
{ pollster: "CBS News", endDate: "2025-04-11", sampleSize: 2410, sampleType: "A", results: { Approve: 47, Disapprove: 53 } },
{ pollster: "Pew Research", endDate: "2025-04-13", sampleSize: 3589, sampleType: "A", results: { Approve: 40, Disapprove: 59 } },
{ pollster: "Quantus Insights", endDate: "2025-04-09", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Gallup", endDate: "2025-04-14", sampleSize: 1006, sampleType: "A", results: { Approve: 44, Disapprove: 53 } },
{ pollster: "Rasmussen Reports", endDate: "2025-04-10", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Economist/YouGov", endDate: "2025-04-08", sampleSize: 1563, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "HarrisX", endDate: "2025-04-07", sampleSize: 1883, sampleType: "RV", results: { Approve: 47, Disapprove: 49 } },
{ pollster: "Quinnipiac", endDate: "2025-04-07", sampleSize: 1407, sampleType: "RV", results: { Approve: 41, Disapprove: 53 } },
{ pollster: "Morning Consult", endDate: "2025-04-06", sampleSize: 2207, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "RMG Research*", endDate: "2025-04-10", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "Cygnal", endDate: "2025-04-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Daily Mail", endDate: "2025-04-03", sampleSize: 1000, sampleType: "RV", results: { Approve: 53, Disapprove: 47 } },
{ pollster: "Rasmussen Reports", endDate: "2025-04-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 50 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-04-02", sampleSize: 1486, sampleType: "A", results: { Approve: 43, Disapprove: 53 } },
{ pollster: "Economist/YouGov", endDate: "2025-04-01", sampleSize: 1465, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2025-04-03", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "Wall Street Journal", endDate: "2025-04-01", sampleSize: 1500, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "Harvard-Harris", endDate: "2025-03-27", sampleSize: 2746, sampleType: "RV", results: { Approve: 49, Disapprove: 46 } },
{ pollster: "CBS News", endDate: "2025-03-28", sampleSize: 2609, sampleType: "A", results: { Approve: 50, Disapprove: 50 } },
{ pollster: "TIPP", endDate: "2025-03-28", sampleSize: 1452, sampleType: "A", results: { Approve: 44, Disapprove: 45 } },
{ pollster: "Daily Mail", endDate: "2025-03-27", sampleSize: 1001, sampleType: "RV", results: { Approve: 49, Disapprove: 51 } },
{ pollster: "Quantus Insights", endDate: "2025-03-27", sampleSize: 1000, sampleType: "RV", results: { Approve: 49, Disapprove: 46 } },
{ pollster: "Rasmussen Reports", endDate: "2025-03-27", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Economist/YouGov", endDate: "2025-03-25", sampleSize: 1440, sampleType: "RV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "RMG Research*", endDate: "2025-03-27", sampleSize: 3000, sampleType: "RV", results: { Approve: 52, Disapprove: 45 } },
{ pollster: "Marquette", endDate: "2025-03-27", sampleSize: 1021, sampleType: "A", results: { Approve: 46, Disapprove: 54 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-03-23", sampleSize: 1030, sampleType: "A", results: { Approve: 45, Disapprove: 51 } },
{ pollster: "AP/NORC**", endDate: "2025-03-24", sampleSize: 1229, sampleType: "A", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Rasmussen Reports", endDate: "2025-03-20", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "Economist/YouGov", endDate: "2025-03-18", sampleSize: 1458, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "FOX News", endDate: "2025-03-17", sampleSize: 994, sampleType: "RV", results: { Approve: 49, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2025-03-19", sampleSize: 3000, sampleType: "RV", results: { Approve: 53, Disapprove: 45 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-03-12", sampleSize: 1422, sampleType: "A", results: { Approve: 44, Disapprove: 52 } },
{ pollster: "Rasmussen Reports", endDate: "2025-03-13", sampleSize: 1500, sampleType: "LV", results: { Approve: 52, Disapprove: 47 } },
{ pollster: "Quantus Insights", endDate: "2025-03-12", sampleSize: 1000, sampleType: "RV", results: { Approve: 50, Disapprove: 47 } },
{ pollster: "Economist/YouGov", endDate: "2025-03-11", sampleSize: 1532, sampleType: "RV", results: { Approve: 48, Disapprove: 49 } },
{ pollster: "Atlas Intel", endDate: "2025-03-12", sampleSize: 2550, sampleType: "A", results: { Approve: 47, Disapprove: 52 } },
{ pollster: "NBC News", endDate: "2025-03-11", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Emerson", endDate: "2025-03-10", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 45 } },
{ pollster: "Gallup", endDate: "2025-03-16", sampleSize: 1002, sampleType: "A", results: { Approve: 43, Disapprove: 53 } },
{ pollster: "RMG Research*", endDate: "2025-03-13", sampleSize: 3000, sampleType: "RV", results: { Approve: 54, Disapprove: 44 } },
{ pollster: "Quinnipiac", endDate: "2025-03-10", sampleSize: 1198, sampleType: "RV", results: { Approve: 42, Disapprove: 53 } },
{ pollster: "CNN", endDate: "2025-03-09", sampleSize: 0, sampleType: "RV", results: { Approve: 46, Disapprove: 53 } },
{ pollster: "Daily Mail", endDate: "2025-03-07", sampleSize: 1019, sampleType: "RV", results: { Approve: 49, Disapprove: 51 } },
{ pollster: "Trafalgar/InsiderAdvantage", endDate: "2025-03-05", sampleSize: 800, sampleType: "RV", results: { Approve: 50, Disapprove: 45 } },
{ pollster: "Rasmussen Reports", endDate: "2025-03-06", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-03-04", sampleSize: 1174, sampleType: "A", results: { Approve: 44, Disapprove: 51 } },
{ pollster: "Economist/YouGov", endDate: "2025-03-04", sampleSize: 1491, sampleType: "RV", results: { Approve: 49, Disapprove: 49 } },
{ pollster: "Emerson", endDate: "2025-03-03", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 43 } },
{ pollster: "Daily Kos/Civiqs", endDate: "2025-03-03", sampleSize: 1031, sampleType: "RV", results: { Approve: 48, Disapprove: 52 } },
{ pollster: "CBS News", endDate: "2025-02-28", sampleSize: 2311, sampleType: "A", results: { Approve: 51, Disapprove: 49 } },
{ pollster: "I&I/TIPP", endDate: "2025-02-28", sampleSize: 1434, sampleType: "A", results: { Approve: 46, Disapprove: 43 } },
{ pollster: "RMG Research*", endDate: "2025-02-28", sampleSize: 3000, sampleType: "RV", results: { Approve: 53, Disapprove: 45 } },
{ pollster: "CNN", endDate: "2025-02-28", sampleSize: 0, sampleType: "RV", results: { Approve: 48, Disapprove: 52 } },
{ pollster: "Atlas Intel", endDate: "2025-02-27", sampleSize: 2849, sampleType: "A", results: { Approve: 50, Disapprove: 50 } },
{ pollster: "Rasmussen Reports", endDate: "2025-02-27", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "Quantus Insights", endDate: "2025-02-26", sampleSize: 1000, sampleType: "RV", results: { Approve: 51, Disapprove: 45 } },
{ pollster: "NPR/PBS/Marist", endDate: "2025-02-26", sampleSize: 1533, sampleType: "RV", results: { Approve: 45, Disapprove: 51 } },
{ pollster: "Daily Mail", endDate: "2025-02-25", sampleSize: 1001, sampleType: "RV", results: { Approve: 54, Disapprove: 46 } },
{ pollster: "Economist/YouGov", endDate: "2025-02-25", sampleSize: 1444, sampleType: "RV", results: { Approve: 48, Disapprove: 47 } },
{ pollster: "Morning Consult", endDate: "2025-02-24", sampleSize: 2225, sampleType: "RV", results: { Approve: 50, Disapprove: 47 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-02-23", sampleSize: 1029, sampleType: "A", results: { Approve: 44, Disapprove: 50 } },
{ pollster: "RMG Research*", endDate: "2025-02-21", sampleSize: 3000, sampleType: "RV", results: { Approve: 53, Disapprove: 44 } },
{ pollster: "Harvard-Harris", endDate: "2025-02-20", sampleSize: 2443, sampleType: "RV", results: { Approve: 52, Disapprove: 43 } },
{ pollster: "Rasmussen Reports", endDate: "2025-02-20", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "Economist/YouGov", endDate: "2025-02-18", sampleSize: 1451, sampleType: "RV", results: { Approve: 50, Disapprove: 47 } },
{ pollster: "Emerson", endDate: "2025-02-17", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 42 } },
{ pollster: "Wash Post/Ipsos", endDate: "2025-02-18", sampleSize: 2177, sampleType: "RV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-02-18", sampleSize: 4145, sampleType: "A", results: { Approve: 44, Disapprove: 51 } },
{ pollster: "Quinnipiac", endDate: "2025-02-17", sampleSize: 1039, sampleType: "RV", results: { Approve: 45, Disapprove: 49 } },
{ pollster: "CNN", endDate: "2025-02-17", sampleSize: 0, sampleType: "RV", results: { Approve: 46, Disapprove: 54 } },
{ pollster: "SurveyUSA", endDate: "2025-02-16", sampleSize: 2000, sampleType: "A", results: { Approve: 51, Disapprove: 45 } },
{ pollster: "RMG Research*", endDate: "2025-02-14", sampleSize: 3000, sampleType: "RV", results: { Approve: 55, Disapprove: 43 } },
{ pollster: "Quantus Insights", endDate: "2025-02-12", sampleSize: 1000, sampleType: "RV", results: { Approve: 53, Disapprove: 44 } },
{ pollster: "Economist/YouGov", endDate: "2025-02-11", sampleSize: 1430, sampleType: "RV", results: { Approve: 47, Disapprove: 49 } },
{ pollster: "Rasmussen Reports", endDate: "2025-02-13", sampleSize: 1500, sampleType: "LV", results: { Approve: 54, Disapprove: 44 } },
{ pollster: "Gallup", endDate: "2025-02-16", sampleSize: 1004, sampleType: "A", results: { Approve: 45, Disapprove: 51 } },
{ pollster: "Trafalgar/InsiderAdvantage", endDate: "2025-02-09", sampleSize: 1321, sampleType: "RV", results: { Approve: 54, Disapprove: 45 } },
{ pollster: "CBS News", endDate: "2025-02-07", sampleSize: 2175, sampleType: "A", results: { Approve: 53, Disapprove: 47 } },
{ pollster: "RMG Research*", endDate: "2025-02-06", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 45 } },
{ pollster: "Cygnal", endDate: "2025-02-05", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "Economist/YouGov", endDate: "2025-02-04", sampleSize: 1423, sampleType: "RV", results: { Approve: 48, Disapprove: 47 } },
{ pollster: "Quantus Insights", endDate: "2025-02-03", sampleSize: 1000, sampleType: "RV", results: { Approve: 52, Disapprove: 45 } },
{ pollster: "Morning Consult", endDate: "2025-02-03", sampleSize: 2303, sampleType: "RV", results: { Approve: 49, Disapprove: 47 } },
{ pollster: "Rasmussen Reports", endDate: "2025-02-06", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 45 } },
{ pollster: "Marquette", endDate: "2025-02-05", sampleSize: 1063, sampleType: "A", results: { Approve: 48, Disapprove: 52 } },
{ pollster: "Pew Research", endDate: "2025-02-05", sampleSize: 5086, sampleType: "A", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "TIPP", endDate: "2025-01-31", sampleSize: 1478, sampleType: "A", results: { Approve: 46, Disapprove: 41 } },
{ pollster: "Fabrizio/Anzalone", endDate: "2025-02-01", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 47 } },
{ pollster: "RMG Research*", endDate: "2025-01-31", sampleSize: 4000, sampleType: "RV", results: { Approve: 53, Disapprove: 43 } },
{ pollster: "Rasmussen Reports", endDate: "2025-01-30", sampleSize: 1500, sampleType: "LV", results: { Approve: 52, Disapprove: 45 } },
{ pollster: "Emerson", endDate: "2025-01-28", sampleSize: 1000, sampleType: "RV", results: { Approve: 49, Disapprove: 41 } },
{ pollster: "Economist/YouGov", endDate: "2025-01-28", sampleSize: 1376, sampleType: "RV", results: { Approve: 50, Disapprove: 46 } },
{ pollster: "Quinnipiac", endDate: "2025-01-27", sampleSize: 1019, sampleType: "RV", results: { Approve: 46, Disapprove: 43 } },
{ pollster: "Morning Consult", endDate: "2025-01-26", sampleSize: 2302, sampleType: "RV", results: { Approve: 52, Disapprove: 44 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-01-26", sampleSize: 1034, sampleType: "A", results: { Approve: 45, Disapprove: 46 } },
{ pollster: "Gallup", endDate: "2025-01-27", sampleSize: 1001, sampleType: "A", results: { Approve: 47, Disapprove: 48 } },
{ pollster: "Quantus Insights", endDate: "2025-01-23", sampleSize: 1000, sampleType: "RV", results: { Approve: 54, Disapprove: 40 } },
{ pollster: "RMG Research*", endDate: "2025-01-23", sampleSize: 3000, sampleType: "RV", results: { Approve: 57, Disapprove: 39 } },
{ pollster: "Atlas Intel", endDate: "2025-01-23", sampleSize: 1882, sampleType: "A", results: { Approve: 50, Disapprove: 50 } },
{ pollster: "Rasmussen Reports", endDate: "2025-01-23", sampleSize: 1667, sampleType: "LV", results: { Approve: 53, Disapprove: 42 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-01-21", sampleSize: 1077, sampleType: "A", results: { Approve: 47, Disapprove: 41 } },
{ pollster: "Big Data Poll", endDate: "2025-01-22", sampleSize: 2979, sampleType: "RV", results: { Approve: 56, Disapprove: 37 } },
{ pollster: "InsiderAdvantage", endDate: "2025-01-20", sampleSize: 800, sampleType: "RV", results: { Approve: 56, Disapprove: 39 } },
];

const COLORS: Record<string, string> = {
  Approve: "#2bff00",
  Disapprove: "#ff0040",
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
        subtitle="Approval trendlines over time; Hover to view data."
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
