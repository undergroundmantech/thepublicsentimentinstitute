// app/polling/generic-ballot/page.tsx
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
  { pollster: "Economist/YouGov", endDate: "2026-02-16", sampleSize: 1512, sampleType: "RV", results: { Democrats: 47, Republicans: 40 } },
  { pollster: "Quantus Insights", endDate: "2026-02-13", sampleSize: 1515, sampleType: "LV", results: { Democrats: 48, Republicans: 42 } },
  { pollster: "Morning Consult", endDate: "2026-02-09", sampleSize: 2200, sampleType: "RV", results: { Democrats: 45, Republicans: 41 } },
  { pollster: "Cygnal", endDate: "2026-02-04", sampleSize: 1500, sampleType: "LV", results: { Democrats: 48, Republicans: 44 } },
  { pollster: "PPP", endDate: "2026-01-30", sampleSize: 652, sampleType: "RV", results: { Democrats: 48, Republicans: 41 } },
  { pollster: "Harvard-Harris", endDate: "2026-01-29", sampleSize: 2000, sampleType: "RV", results: { Democrats: 52, Republicans: 48 } },
  { pollster: "I&I/TIPP", endDate: "2026-01-29", sampleSize: 1126, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
  { pollster: "FOX News", endDate: "2026-01-26", sampleSize: 1005, sampleType: "RV", results: { Democrats: 52, Republicans: 46 } },
  { pollster: "Marquette", endDate: "2026-01-28", sampleSize: 0, sampleType: "LV", results: { Democrats: 52, Republicans: 45 } },
  { pollster: "Morning Consult", endDate: "2026-02-01", sampleSize: 2201, sampleType: "RV", results: { Democrats: 47, Republicans: 42 } },
  { pollster: "Harvard-Harris", endDate: "2026-01-29", sampleSize: 2000, sampleType: "RV", results: { Democrats: 52, Republicans: 48 } },
  { pollster: "Economist/YouGov", endDate: "2026-02-02", sampleSize: 1504, sampleType: "RV", results: { Democrats: 44, Republicans: 40 } },
  { pollster: "Cygnal", endDate: "2026-01-28", sampleSize: 1004, sampleType: "LV", results: { Democrats: 48, Republicans: 44 } },
  { pollster: "FOX News", endDate: "2026-01-26", sampleSize: 1005, sampleType: "RV", results: { Democrats: 52, Republicans: 46 } },
  { pollster: "Economist/YouGov", endDate: "2026-01-26", sampleSize: 1520, sampleType: "RV", results: { Democrats: 43, Republicans: 38 } },
  { pollster: "Morning Consult", endDate: "2026-01-25", sampleSize: 2201, sampleType: "RV", results: { Democrats: 45, Republicans: 43 } },
  { pollster: "Reuters/Ipsos", endDate: "2026-01-25", sampleSize: 906, sampleType: "RV", results: { Democrats: 41, Republicans: 37 } },
  { pollster: "Big Data Poll", endDate: "2026-01-24", sampleSize: 2909, sampleType: "LV", results: { Democrats: 48, Republicans: 44 } },
  { pollster: "Quantus Insights", endDate: "2026-01-22", sampleSize: 1000, sampleType: "RV", results: { Democrats: 47, Republicans: 41 } },
  { pollster: "Emerson", endDate: "2026-01-19", sampleSize: 1000, sampleType: "LV", results: { Democrats: 48, Republicans: 42 } },
  { pollster: "Economist/YouGov", endDate: "2026-01-19", sampleSize: 1549, sampleType: "RV", results: { Democrats: 43, Republicans: 39 } },
  { pollster: "Morning Consult", endDate: "2026-01-18", sampleSize: 2201, sampleType: "RV", results: { Democrats: 45, Republicans: 43 } },
  { pollster: "NY Times/Siena", endDate: "2026-01-17", sampleSize: 1625, sampleType: "RV", results: { Democrats: 48, Republicans: 43 } },
  { pollster: "Reuters/Ipsos", endDate: "2026-01-13", sampleSize: 941, sampleType: "RV", results: { Democrats: 40, Republicans: 38 } },
  { pollster: "Wall Street Journal", endDate: "2026-01-13", sampleSize: 1500, sampleType: "RV", results: { Democrats: 47, Republicans: 43 } },
  { pollster: "Rasmussen Reports", endDate: "2026-01-14", sampleSize: 2273, sampleType: "LV", results: { Democrats: 47, Republicans: 41 } },
  { pollster: "CNN", endDate: "2026-01-12", sampleSize: 968, sampleType: "RV", results: { Democrats: 46, Republicans: 41 } },
  { pollster: "Morning Consult", endDate: "2026-01-12", sampleSize: 2201, sampleType: "RV", results: { Democrats: 46, Republicans: 43 } },
  { pollster: "Economist/YouGov", endDate: "2026-01-12", sampleSize: 1437, sampleType: "RV", results: { Democrats: 44, Republicans: 40 } },
  { pollster: "Cygnal", endDate: "2026-01-08", sampleSize: 1500, sampleType: "LV", results: { Democrats: 48, Republicans: 45 } },
  { pollster: "RMG Research**", endDate: "2026-01-08", sampleSize: 2000, sampleType: "RV", results: { Democrats: 47, Republicans: 46 } },
  { pollster: "Economist/YouGov", endDate: "2026-01-05", sampleSize: 1389, sampleType: "RV", results: { Democrats: 45, Republicans: 39 } },
  { pollster: "Morning Consult", endDate: "2026-01-04", sampleSize: 2201, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
  { pollster: "Economist/YouGov", endDate: "2025-12-29", sampleSize: 1420, sampleType: "RV", results: { Democrats: 42, Republicans: 38 } },
  { pollster: "Big Data Poll", endDate: "2025-12-28", sampleSize: 3412, sampleType: "LV", results: { Democrats: 49, Republicans: 44 } },
  { pollster: "Economist/YouGov", endDate: "2025-12-22", sampleSize: 1425, sampleType: "RV", results: { Democrats: 43, Republicans: 40 } },
  { pollster: "Morning Consult", endDate: "2025-12-21", sampleSize: 2203, sampleType: "RV", results: { Democrats: 47, Republicans: 43 } },
  { pollster: "Atlas Intel", endDate: "2025-12-19", sampleSize: 2315, sampleType: "A", results: { Democrats: 54, Republicans: 38 } },
  { pollster: "Quantus Insights", endDate: "2025-12-16", sampleSize: 1000, sampleType: "RV", results: { Democrats: 43, Republicans: 41 } },
  { pollster: "Emerson", endDate: "2025-12-15", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 42 } },
  { pollster: "Economist/YouGov", endDate: "2025-12-15", sampleSize: 1453, sampleType: "RV", results: { Democrats: 43, Republicans: 39 } },
  { pollster: "Morning Consult", endDate: "2025-12-15", sampleSize: 2201, sampleType: "RV", results: { Democrats: 45, Republicans: 44 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-12-15", sampleSize: 775, sampleType: "RV", results: { Democrats: 40, Republicans: 36 } },
  { pollster: "Quinnipiac", endDate: "2025-12-15", sampleSize: 1035, sampleType: "RV", results: { Democrats: 47, Republicans: 43 } },
  { pollster: "Big Data Poll", endDate: "2025-12-12", sampleSize: 3004, sampleType: "RV", results: { Democrats: 47, Republicans: 43 } },
  { pollster: "Economist/YouGov", endDate: "2025-12-08", sampleSize: 1380, sampleType: "RV", results: { Democrats: 42, Republicans: 37 } },
  { pollster: "CNBC", endDate: "2025-12-08", sampleSize: 800, sampleType: "RV", results: { Democrats: 50, Republicans: 46 } },
  { pollster: "Morning Consult", endDate: "2025-12-07", sampleSize: 2201, sampleType: "RV", results: { Democrats: 46, Republicans: 43 } },
  { pollster: "Cygnal", endDate: "2025-12-07", sampleSize: 1500, sampleType: "LV", results: { Democrats: 48, Republicans: 44 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-12-08", sampleSize: 3521, sampleType: "RV", results: { Democrats: 40, Republicans: 39 } },
  { pollster: "Quantus Insights", endDate: "2025-12-05", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 40 } },
  { pollster: "RMG Research**", endDate: "2025-12-04", sampleSize: 2000, sampleType: "RV", results: { Democrats: 41, Republicans: 45 } },
  { pollster: "Economist/YouGov", endDate: "2025-12-01", sampleSize: 1456, sampleType: "RV", results: { Democrats: 45, Republicans: 39 } },
  { pollster: "Big Data Poll", endDate: "2025-12-01", sampleSize: 2008, sampleType: "RV", results: { Democrats: 44, Republicans: 42 } },
  { pollster: "Morning Consult", endDate: "2025-11-30", sampleSize: 2200, sampleType: "RV", results: { Democrats: 45, Republicans: 41 } },
  { pollster: "Economist/YouGov", endDate: "2025-11-24", sampleSize: 1511, sampleType: "RV", results: { Democrats: 44, Republicans: 39 } },
  { pollster: "Morning Consult", endDate: "2025-11-23", sampleSize: 2200, sampleType: "RV", results: { Democrats: 45, Republicans: 43 } },
  { pollster: "Daily Mail", endDate: "2025-11-25", sampleSize: 797, sampleType: "LV", results: { Democrats: 50, Republicans: 46 } },
  { pollster: "Rasmussen Reports", endDate: "2025-11-23", sampleSize: 2410, sampleType: "LV", results: { Democrats: 45, Republicans: 42 } },
  { pollster: "Economist/YouGov", endDate: "2025-11-17", sampleSize: 1382, sampleType: "RV", results: { Democrats: 43, Republicans: 40 } },
  { pollster: "Morning Consult", endDate: "2025-11-16", sampleSize: 2201, sampleType: "RV", results: { Democrats: 46, Republicans: 44 } },
  { pollster: "NPR/PBS/Marist", endDate: "2025-11-13", sampleSize: 1291, sampleType: "RV", results: { Democrats: 55, Republicans: 41 } },
  { pollster: "Quantus Insights", endDate: "2025-11-12", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 39 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-11-12", sampleSize: 938, sampleType: "RV", results: { Democrats: 41, Republicans: 40 } },
  { pollster: "Marquette", endDate: "2025-11-12", sampleSize: 903, sampleType: "RV", results: { Democrats: 49, Republicans: 44 } },
  { pollster: "Economist/YouGov", endDate: "2025-11-10", sampleSize: 1500, sampleType: "RV", results: { Democrats: 46, Republicans: 39 } },
  { pollster: "Morning Consult", endDate: "2025-11-09", sampleSize: 2201, sampleType: "RV", results: { Democrats: 48, Republicans: 43 } },
  { pollster: "Cygnal", endDate: "2025-11-06", sampleSize: 1500, sampleType: "RV", results: { Democrats: 50, Republicans: 44 } },
  { pollster: "Emerson", endDate: "2025-11-04", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 40 } },
  { pollster: "Economist/YouGov", endDate: "2025-11-03", sampleSize: 1475, sampleType: "RV", results: { Democrats: 44, Republicans: 41 } },
  { pollster: "Morning Consult", endDate: "2025-11-02", sampleSize: 2202, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
  { pollster: "CNN", endDate: "2025-10-30", sampleSize: 954, sampleType: "RV", results: { Democrats: 47, Republicans: 42 } },
  { pollster: "NewsNation", endDate: "2025-10-29", sampleSize: 1159, sampleType: "LV", results: { Democrats: 47, Republicans: 47 } },
  { pollster: "Big Data Poll", endDate: "2025-10-29", sampleSize: 2984, sampleType: "RV", results: { Democrats: 43, Republicans: 41 } },
  { pollster: "NBC News", endDate: "2025-10-28", sampleSize: 1000, sampleType: "RV", results: { Democrats: 50, Republicans: 42 } },
  { pollster: "ABC/Wash Post/Ipsos", endDate: "2025-10-28", sampleSize: 2203, sampleType: "RV", results: { Democrats: 46, Republicans: 44 } },
  { pollster: "Economist/YouGov", endDate: "2025-10-27", sampleSize: 1476, sampleType: "RV", results: { Democrats: 43, Republicans: 40 } },
  { pollster: "Morning Consult", endDate: "2025-10-26", sampleSize: 2202, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
  { pollster: "Yahoo News", endDate: "2025-10-27", sampleSize: 1197, sampleType: "RV", results: { Democrats: 45, Republicans: 40 } },
  { pollster: "Economist/YouGov", endDate: "2025-10-20", sampleSize: 1448, sampleType: "RV", results: { Democrats: 45, Republicans: 40 } },
  { pollster: "Morning Consult", endDate: "2025-10-19", sampleSize: 2200, sampleType: "RV", results: { Democrats: 46, Republicans: 43 } },
  { pollster: "Quinnipiac", endDate: "2025-10-20", sampleSize: 1327, sampleType: "RV", results: { Democrats: 50, Republicans: 41 } },
  { pollster: "Emerson", endDate: "2025-10-14", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 43 } },
  { pollster: "Economist/YouGov", endDate: "2025-10-13", sampleSize: 1467, sampleType: "RV", results: { Democrats: 43, Republicans: 40 } },
  { pollster: "Morning Consult", endDate: "2025-10-12", sampleSize: 2202, sampleType: "RV", results: { Democrats: 46, Republicans: 43 } },
  { pollster: "CNBC", endDate: "2025-10-12", sampleSize: 0, sampleType: "RV", results: { Democrats: 48, Republicans: 47 } },
  { pollster: "Quantus Insights", endDate: "2025-10-08", sampleSize: 1000, sampleType: "RV", results: { Democrats: 42, Republicans: 43 } },
  { pollster: "Cygnal", endDate: "2025-10-08", sampleSize: 1500, sampleType: "LV", results: { Democrats: 48, Republicans: 45 } },
  { pollster: "Economist/YouGov", endDate: "2025-10-06", sampleSize: 1490, sampleType: "RV", results: { Democrats: 44, Republicans: 39 } },
  { pollster: "Morning Consult", endDate: "2025-10-05", sampleSize: 2200, sampleType: "RV", results: { Democrats: 46, Republicans: 43 } },
  { pollster: "Economist/YouGov", endDate: "2025-09-29", sampleSize: 1518, sampleType: "RV", results: { Democrats: 44, Republicans: 41 } },
  { pollster: "Yahoo News", endDate: "2025-09-29", sampleSize: 1126, sampleType: "RV", results: { Democrats: 44, Republicans: 40 } },
  { pollster: "NY Times/Siena", endDate: "2025-09-27", sampleSize: 1313, sampleType: "RV", results: { Democrats: 47, Republicans: 45 } },
  { pollster: "RMG Research**", endDate: "2025-09-24", sampleSize: 2000, sampleType: "RV", results: { Democrats: 45, Republicans: 46 } },
  { pollster: "Economist/YouGov", endDate: "2025-09-22", sampleSize: 1392, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
  { pollster: "Atlas Intel", endDate: "2025-09-16", sampleSize: 1066, sampleType: "A", results: { Democrats: 52, Republicans: 44 } },
  { pollster: "NAIP**", endDate: "2025-09-13", sampleSize: 2071, sampleType: "LV", results: { Democrats: 45, Republicans: 43 } },
  { pollster: "Economist/YouGov", endDate: "2025-09-15", sampleSize: 1420, sampleType: "RV", results: { Democrats: 43, Republicans: 41 } },
  { pollster: "Economist/YouGov", endDate: "2025-09-08", sampleSize: 1487, sampleType: "RV", results: { Democrats: 44, Republicans: 40 } },
  { pollster: "Morning Consult", endDate: "2025-09-07", sampleSize: 2200, sampleType: "RV", results: { Democrats: 45, Republicans: 41 } },
  { pollster: "Cygnal", endDate: "2025-09-03", sampleSize: 1500, sampleType: "RV", results: { Democrats: 48, Republicans: 45 } },
  { pollster: "Economist/YouGov", endDate: "2025-09-02", sampleSize: 1549, sampleType: "RV", results: { Democrats: 43, Republicans: 39 } },
  { pollster: "Yahoo News", endDate: "2025-09-02", sampleSize: 1136, sampleType: "RV", results: { Democrats: 44, Republicans: 40 } },
  { pollster: "Emerson", endDate: "2025-08-26", sampleSize: 1000, sampleType: "RV", results: { Democrats: 43, Republicans: 43 } },
  { pollster: "Economist/YouGov", endDate: "2025-08-25", sampleSize: 1377, sampleType: "RV", results: { Democrats: 43, Republicans: 41 } },
  { pollster: "CNN", endDate: "2025-09-01", sampleSize: 0, sampleType: "RV", results: { Democrats: 52, Republicans: 48 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-08-24", sampleSize: 1022, sampleType: "A", results: { Democrats: 38, Republicans: 34 } },
  { pollster: "RMG Research**", endDate: "2025-08-21", sampleSize: 2000, sampleType: "RV", results: { Democrats: 47, Republicans: 47 } },
  { pollster: "Economist/YouGov", endDate: "2025-08-18", sampleSize: 1408, sampleType: "RV", results: { Democrats: 44, Republicans: 39 } },
  { pollster: "Quantus Insights", endDate: "2025-08-13", sampleSize: 1000, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
  { pollster: "Economist/YouGov", endDate: "2025-08-11", sampleSize: 1474, sampleType: "RV", results: { Democrats: 42, Republicans: 40 } },
  { pollster: "Cygnal", endDate: "2025-08-09", sampleSize: 1500, sampleType: "RV", results: { Democrats: 47, Republicans: 46 } },
  { pollster: "Economist/YouGov", endDate: "2025-08-04", sampleSize: 1528, sampleType: "RV", results: { Democrats: 44, Republicans: 38 } },
  { pollster: "CNBC", endDate: "2025-08-03", sampleSize: 1000, sampleType: "A", results: { Democrats: 49, Republicans: 44 } },
  { pollster: "Economist/YouGov", endDate: "2025-07-28", sampleSize: 1610, sampleType: "RV", results: { Democrats: 43, Republicans: 41 } },
  { pollster: "Yahoo News", endDate: "2025-07-28", sampleSize: 1167, sampleType: "RV", results: { Democrats: 46, Republicans: 39 } },
  { pollster: "Emerson", endDate: "2025-07-22", sampleSize: 1400, sampleType: "RV", results: { Democrats: 44, Republicans: 42 } },
  { pollster: "Wall Street Journal", endDate: "2025-07-20", sampleSize: 1500, sampleType: "RV", results: { Democrats: 46, Republicans: 43 } },
  { pollster: "Atlas Intel", endDate: "2025-07-18", sampleSize: 1935, sampleType: "A", results: { Democrats: 51, Republicans: 43 } },
  { pollster: "Rasmussen Reports", endDate: "2025-07-17", sampleSize: 2288, sampleType: "LV", results: { Democrats: 46, Republicans: 42 } },
  { pollster: "Quantus Insights", endDate: "2025-07-16", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 42 } },
  { pollster: "RMG Research**", endDate: "2025-07-16", sampleSize: 2000, sampleType: "RV", results: { Democrats: 45, Republicans: 49 } },
  { pollster: "Big Data Poll", endDate: "2025-07-14", sampleSize: 3022, sampleType: "RV", results: { Democrats: 42, Republicans: 41 } },
  { pollster: "Cygnal", endDate: "2025-07-02", sampleSize: 1500, sampleType: "LV", results: { Democrats: 47, Republicans: 46 } },
  { pollster: "Emerson", endDate: "2025-06-25", sampleSize: 1000, sampleType: "RV", results: { Democrats: 43, Republicans: 40 } },
  { pollster: "RMG Research**", endDate: "2025-06-19", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 52 } },
  { pollster: "Quantus Insights", endDate: "2025-06-11", sampleSize: 1000, sampleType: "RV", results: { Democrats: 43, Republicans: 43 } },
  { pollster: "Cygnal", endDate: "2025-06-04", sampleSize: 1500, sampleType: "LV", results: { Democrats: 47, Republicans: 47 } },
  { pollster: "Quantus Insights", endDate: "2025-06-04", sampleSize: 1000, sampleType: "RV", results: { Democrats: 46, Republicans: 45 } },
  { pollster: "Economist/YouGov", endDate: "2025-06-02", sampleSize: 1436, sampleType: "RV", results: { Democrats: 44, Republicans: 42 } },
  { pollster: "Atlas Intel", endDate: "2025-05-27", sampleSize: 3469, sampleType: "A", results: { Democrats: 51, Republicans: 42 } },
  { pollster: "RMG Research**", endDate: "2025-05-21", sampleSize: 1000, sampleType: "RV", results: { Democrats: 48, Republicans: 45 } },
  { pollster: "Rasmussen Reports", endDate: "2025-05-15", sampleSize: 1012, sampleType: "LV", results: { Democrats: 45, Republicans: 44 } },
  { pollster: "Quantus Insights", endDate: "2025-05-07", sampleSize: 1000, sampleType: "RV", results: { Democrats: 45, Republicans: 45 } },
  { pollster: "Big Data Poll", endDate: "2025-05-05", sampleSize: 3128, sampleType: "RV", results: { Democrats: 40, Republicans: 42 } },
  { pollster: "NewsNation", endDate: "2025-04-27", sampleSize: 1448, sampleType: "RV", results: { Democrats: 45, Republicans: 40 } },
  { pollster: "NY Times/Siena", endDate: "2025-04-24", sampleSize: 913, sampleType: "RV", results: { Democrats: 47, Republicans: 44 } },
  { pollster: "FOX News", endDate: "2025-04-21", sampleSize: 1104, sampleType: "RV", results: { Democrats: 49, Republicans: 42 } },
  { pollster: "RMG Research**", endDate: "2025-04-16", sampleSize: 1000, sampleType: "RV", results: { Democrats: 50, Republicans: 45 } },
  { pollster: "CNBC", endDate: "2025-04-13", sampleSize: 800, sampleType: "RV", results: { Democrats: 48, Republicans: 46 } },
  { pollster: "Economist/YouGov", endDate: "2025-04-08", sampleSize: 1563, sampleType: "RV", results: { Democrats: 43, Republicans: 42 } },
  { pollster: "Cygnal", endDate: "2025-04-03", sampleSize: 1500, sampleType: "LV", results: { Democrats: 48, Republicans: 47 } },
  { pollster: "Wall Street Journal", endDate: "2025-04-01", sampleSize: 1500, sampleType: "RV", results: { Democrats: 44, Republicans: 43 } },
  { pollster: "Quantus Insights", endDate: "2025-03-27", sampleSize: 1000, sampleType: "RV", results: { Democrats: 45, Republicans: 46 } },
  { pollster: "NBC News", endDate: "2025-03-11", sampleSize: 1000, sampleType: "RV", results: { Democrats: 48, Republicans: 47 } },
  { pollster: "Emerson", endDate: "2025-03-03", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 41 } },
  { pollster: "Cygnal", endDate: "2025-02-05", sampleSize: 1500, sampleType: "LV", results: { Democrats: 46, Republicans: 47 } },
  { pollster: "CC Labs**", endDate: "2025-02-06", sampleSize: 1102, sampleType: "RV", results: { Democrats: 45, Republicans: 44 } },
  { pollster: "Fabrizio/Anzalone", endDate: "2025-02-01", sampleSize: 3000, sampleType: "RV", results: { Democrats: 43, Republicans: 43 } },
  { pollster: "Quantus Insights", endDate: "2025-01-23", sampleSize: 1000, sampleType: "RV", results: { Democrats: 45, Republicans: 48 } },
];

const COLORS: Record<string, string> = {
  Republicans: "#ff1717",
  Democrats: "#184dfc",
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// ─── Shared CSS Design System (matching Trump approval page) ──────────────────
const CSS = `
  .pgb-root {
    --bg:          #070709;
    --bg2:         #0b0b0f;
    --panel:       #0f0f15;
    --border:      rgba(255,255,255,0.09);
    --border2:     rgba(255,255,255,0.15);
    --muted:       rgba(240,240,245,0.62);
    --muted2:      rgba(240,240,245,0.40);
    --muted3:      rgba(240,240,245,0.22);
    --purple:      #7c3aed;
    --purple2:     #9d5cf0;
    --purple-soft: #a78bfa;
    --dem:         #184dfc;
    --rep:         #ff1717;
  }

  @keyframes pgb-fade-up {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes pgb-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.35; transform:scale(0.75); }
  }
  @keyframes pgb-bar-in {
    from { width:0; }
  }

  .pgb-root {
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: pgb-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }

  /* TRI STRIPE */
  .pgb-stripe {
    height: 3px;
    background: linear-gradient(90deg,
      var(--rep)    0%,    var(--rep)    33.33%,
      var(--purple) 33.33%,var(--purple) 66.66%,
      var(--dem)    66.66%,var(--dem)    100%
    );
  }

  /* LIVE DOT */
  .pgb-live-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--purple);
    box-shadow: 0 0 8px rgba(124,58,237,0.7);
    animation: pgb-pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* EYEBROW */
  .pgb-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: ui-monospace,'Courier New',monospace;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--purple-soft);
    margin-bottom: 12px;
  }
  .pgb-eyebrow::before {
    content: '';
    display: block;
    width: 16px; height: 1px;
    background: var(--purple-soft);
    opacity: 0.5;
  }

  /* HERO */
  .pgb-hero {
    border: 1px solid var(--border);
    background: var(--panel);
    position: relative;
    overflow: hidden;
  }
  .pgb-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 45% 100% at 0% 60%,   rgba(24,77,252,0.06)   0%, transparent 65%),
      radial-gradient(ellipse 45% 100% at 100% 60%,  rgba(255,23,23,0.07)  0%, transparent 65%),
      radial-gradient(ellipse 30% 60%  at 50% 0%,    rgba(124,58,237,0.04) 0%, transparent 70%);
    pointer-events: none;
  }
  .pgb-hero::after {
    content: '';
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      0deg, transparent, transparent 3px,
      rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px
    );
    pointer-events: none;
  }
  .pgb-hero-inner {
    position: relative;
    padding: 26px 28px 24px;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: 20px;
  }
  @media (max-width:640px) { .pgb-hero-inner { grid-template-columns:1fr; } }

  .pgb-hero-title {
    font-family: ui-monospace,'Courier New',monospace;
    font-size: clamp(22px,3.5vw,46px);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 0.92;
    color: #fff;
    margin: 0 0 14px;
  }
  .pgb-hero-title .dem {
    font-style: normal;
    background: linear-gradient(110deg, rgba(24,77,252,1) 0%, rgba(100,140,255,0.85) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .pgb-hero-title .rep {
    font-style: normal;
    background: linear-gradient(110deg, rgba(255,23,23,1) 0%, rgba(255,100,100,0.85) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .pgb-hero-desc {
    font-family: ui-monospace,monospace;
    font-size: 9.5px;
    letter-spacing: 0.12em;
    line-height: 1.75;
    color: var(--muted2);
    text-transform: uppercase;
    max-width: 520px;
  }
  .pgb-hero-badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 16px;
  }

  /* BADGES */
  .pgb-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pgb-badge-live   { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .pgb-badge-purple { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .pgb-badge-gold   { border-color:rgba(167,139,250,0.30); background:rgba(124,58,237,0.07); color:var(--purple-soft); }

  /* HERO RIGHT — current reading panel */
  .pgb-hero-read {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 170px;
  }
  .pgb-hero-read-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    position: relative;
    overflow: hidden;
  }
  .pgb-hero-read-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.24em; text-transform: uppercase;
    color: var(--muted3);
  }
  .pgb-hero-read-val {
    font-family: ui-monospace,monospace;
    font-size: 20px; font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  /* SECTION LABEL */
  .pgb-section-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--muted3);
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 12px;
  }
  .pgb-section-label::before { content:''; width:20px; height:1px; background:var(--purple-soft); opacity:0.5; }
  .pgb-section-label::after  { content:''; flex:1; height:1px; background:var(--border); }

  /* KPI GRID */
  .pgb-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 8px;
  }
  @media (max-width:860px) { .pgb-kpi-grid { grid-template-columns:repeat(2,1fr); } }
  @media (max-width:480px) { .pgb-kpi-grid { grid-template-columns:1fr; } }

  .pgb-kpi {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 16px 18px;
    position: relative;
    overflow: hidden;
    transition: border-color 150ms ease;
  }
  .pgb-kpi:hover { border-color: var(--border2); }
  .pgb-kpi-accent {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
  }
  .pgb-kpi-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--muted3); margin-bottom: 8px;
  }
  .pgb-kpi-val {
    font-family: ui-monospace,monospace;
    font-size: clamp(22px,2.5vw,30px);
    font-weight: 900;
    color: #fff; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .pgb-kpi-sub {
    font-family: ui-monospace,monospace;
    font-size: 8px; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--muted3);
    margin-top: 6px;
  }
  .pgb-kpi-bar { height: 2px; margin-top: 10px; background: rgba(255,255,255,0.07); }
  .pgb-kpi-bar-fill {
    height: 100%;
    animation: pgb-bar-in 800ms cubic-bezier(0.22,1,0.36,1) both;
  }

  /* TABLE PANEL */
  .pgb-table-panel {
    background: var(--panel);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .pgb-table-head {
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    padding: 14px 20px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
  }
  .pgb-table-head-title {
    font-family: ui-monospace,monospace;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase;
    color: var(--purple-soft);
  }
  .pgb-table-head-note {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; letter-spacing: 0.20em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pgb-table-scroll {
    overflow-x: auto;
    max-height: 520px;
    overflow-y: auto;
  }
  table.pgb-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 820px;
  }
  table.pgb-table thead {
    position: sticky; top: 0;
    background: var(--bg2);
    z-index: 2;
  }
  table.pgb-table th {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--muted3);
    padding: 10px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  table.pgb-table th.r { text-align: right; }
  table.pgb-table td {
    font-family: ui-monospace,monospace;
    font-size: 10.5px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    color: var(--muted); vertical-align: middle;
    font-variant-numeric: tabular-nums;
  }
  table.pgb-table td.r { text-align: right; }
  table.pgb-table tbody tr:hover { background: rgba(255,255,255,0.014); }
  table.pgb-table tbody tr:last-child td { border-bottom: none; }

  .pgb-gold-badge {
    display: inline-flex; align-items: center;
    padding: 1px 6px;
    border: 1px solid rgba(167,139,250,0.28);
    background: rgba(124,58,237,0.07);
    font-family: ui-monospace,monospace;
    font-size: 7px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--purple-soft);
  }

  .pgb-dem-col   { color: rgba(100,140,255,0.95) !important; font-weight: 700; }
  .pgb-rep-col   { color: rgba(255,80,80,0.95)   !important; font-weight: 700; }
  .pgb-net-dem   { color: rgba(100,140,255,0.9)  !important; font-weight: 700; }
  .pgb-net-rep   { color: rgba(255,80,80,0.9)    !important; font-weight: 700; }
  .pgb-net-even  { color: rgba(167,139,250,0.85) !important; font-weight: 700; }

  @media (prefers-reduced-motion:reduce) {
    .pgb-root { animation:none !important; }
    .pgb-live-dot { animation:none !important; }
    .pgb-kpi-bar-fill { animation:none !important; }
  }
`;

function KpiCard({
  label,
  value,
  sub,
  accentColor,
  barPct,
}: {
  label: string;
  value: string;
  sub?: string;
  accentColor?: string;
  barPct?: number;
}) {
  return (
    <div className="pgb-kpi">
      {accentColor && <div className="pgb-kpi-accent" style={{ background: accentColor }} />}
      <div className="pgb-kpi-label">{label}</div>
      <div className="pgb-kpi-val" style={accentColor ? { color: accentColor } : {}}>
        {value}
      </div>
      {sub && <div className="pgb-kpi-sub">{sub}</div>}
      {barPct !== undefined && (
        <div className="pgb-kpi-bar">
          <div
            className="pgb-kpi-bar-fill"
            style={{ width: `${barPct}%`, background: accentColor ?? "var(--purple)" }}
          />
        </div>
      )}
    </div>
  );
}

export default function GenericBallotPage() {
  const {
    daily,
    latestRepublicans,
    latestDemocrats,
    latestNet,
    seriesForChart,
  } = useMemo(() => {
    const pollsAdjusted = RAW_POLLS.map((p) => ({
      ...p,
      sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
    }));

    const keys = getCandidateList(RAW_POLLS).sort((a, b) => a.localeCompare(b));
    const range = getDateRange(RAW_POLLS);
    const dailyBase = buildDailyWeightedSeries(pollsAdjusted as any, keys, range.start, range.end);

    const dailyWithNet = dailyBase.map((row) => {
      const r = Number((row as any).Republicans ?? 0);
      const d = Number((row as any).Democrats ?? 0);
      return { ...row, Net: round1(d - r) } as any; // Dem margin
    });

    const latest = dailyWithNet[dailyWithNet.length - 1] ?? null;
    const latestRepublicans = latest ? Number((latest as any).Republicans ?? 0) : 0;
    const latestDemocrats = latest ? Number((latest as any).Democrats ?? 0) : 0;
    const latestNet = latest ? Number((latest as any).Net ?? 0) : 0;

    const seriesForChart = [
      { key: "Republicans", label: "Republicans", color: COLORS.Republicans },
      { key: "Democrats", label: "Democrats", color: COLORS.Democrats },
    ];

    return { daily: dailyWithNet, latestRepublicans, latestDemocrats, latestNet, seriesForChart };
  }, []);

  const netText =
    latestNet === 0
      ? "EVEN"
      : latestNet > 0
      ? `D+${round1(latestNet).toFixed(1)}`
      : `R+${Math.abs(round1(latestNet)).toFixed(1)}`;

  const netColor =
    latestNet > 0
      ? "rgba(100,140,255,0.9)"
      : latestNet < 0
      ? "rgba(255,80,80,0.9)"
      : "rgba(167,139,250,0.85)";

  return (
    <>
      <style>{CSS}</style>
      <div className="pgb-root">
        {/* TRI STRIPE */}
        <div className="pgb-stripe" />

        {/* ── HERO ── */}
        <div className="pgb-hero">
          <div className="pgb-stripe" />
          <div className="pgb-hero-inner">
            <div>
              <div className="pgb-eyebrow">2026 Midterm Elections · U.S. House of Representatives</div>
              <h1 className="pgb-hero-title">
                National <span className="dem">Generic</span><br />
                <span className="rep">Ballot</span> Poll
              </h1>
              <p className="pgb-hero-desc">
                Daily weighted average across all included polls — recency decay,
                √n sample adjustment, LV/RV/A screen, and PSI Gold Standard upweighting.
              </p>
              <div className="pgb-hero-badge-row">
                <span className="pgb-badge pgb-badge-live">
                  <span className="pgb-live-dot" />LIVE TRACKING
                </span>
                <span className="pgb-badge pgb-badge-gold">★ GOLD STANDARD ×2 WEIGHT</span>
                <span className="pgb-badge">{RAW_POLLS.length} POLLS IN MODEL</span>
                <span className="pgb-badge pgb-badge-purple">RECENCY · √N · LV/RV/A</span>
              </div>
            </div>

            {/* Current readings panel */}
            <div className="pgb-hero-read">
              {[
                {
                  label: "DEMOCRATS",
                  val: `${round1(latestDemocrats).toFixed(1)}%`,
                  color: "rgba(100,140,255,0.95)",
                },
                {
                  label: "REPUBLICANS",
                  val: `${round1(latestRepublicans).toFixed(1)}%`,
                  color: "rgba(255,80,80,0.95)",
                },
                { label: "MARGIN", val: netText, color: netColor },
              ].map(({ label, val, color }) => (
                <div key={label} className="pgb-hero-read-row">
                  <span className="pgb-hero-read-label">{label}</span>
                  <span className="pgb-hero-read-val" style={{ color }}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="pgb-section-label">CURRENT AVERAGES</div>
        <div className="pgb-kpi-grid">
          <KpiCard
            label="Democrats"
            value={`${round1(latestDemocrats).toFixed(1)}%`}
            sub="Daily weighted avg"
            accentColor="rgba(100,140,255,0.8)"
            barPct={latestDemocrats}
          />
          <KpiCard
            label="Republicans"
            value={`${round1(latestRepublicans).toFixed(1)}%`}
            sub="Daily weighted avg"
            accentColor="rgba(255,80,80,0.8)"
            barPct={latestRepublicans}
          />
          <KpiCard
            label="Margin"
            value={netText}
            sub="Democrats − Republicans"
            accentColor={netColor}
          />
          <KpiCard
            label="Polls"
            value={`${RAW_POLLS.length}`}
            sub="Included in model"
            barPct={Math.min(100, RAW_POLLS.length / 2)}
          />
        </div>

        {/* ── CHART ── */}
        <PollingTimeSeriesChart
          data={daily as any[]}
          series={seriesForChart}
          yDomain={[30, 60]}
          title="2026 National Generic Ballot polling average"
          subtitle="Democrat & Republican trendlines — hover to view daily values"
        />

        {/* ── POLL TABLE ── */}
        <div className="pgb-table-panel">
          <div className="pgb-stripe" />
          <div className="pgb-table-head">
            <span className="pgb-table-head-title">ALL INCLUDED POLLS</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className="pgb-badge pgb-badge-gold">
                ★ GOLD STANDARD = ×{GOLD_STANDARD_MULTIPLIER} WEIGHT
              </span>
              <span className="pgb-table-head-note">SORTED BY END DATE ↓</span>
            </div>
          </div>

          <div className="pgb-table-scroll">
            <table className="pgb-table">
              <thead>
                <tr>
                  <th>POLLSTER</th>
                  <th className="r">END DATE</th>
                  <th className="r">N</th>
                  <th className="r">TYPE</th>
                  <th className="r">WEIGHT</th>
                  <th className="r">DEMOCRATS</th>
                  <th className="r">REPUBLICANS</th>
                  <th className="r">MARGIN</th>
                </tr>
              </thead>
              <tbody>
                {[...RAW_POLLS]
                  .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                  .map((p) => {
                    const r = Number((p.results as any).Republicans ?? 0);
                    const d = Number((p.results as any).Democrats ?? 0);
                    const net = round1(d - r);
                    const netStr =
                      net === 0
                        ? "EVEN"
                        : net > 0
                        ? `D+${net.toFixed(1)}`
                        : `R+${Math.abs(net).toFixed(1)}`;
                    const netClass =
                      net > 0 ? "pgb-net-dem" : net < 0 ? "pgb-net-rep" : "pgb-net-even";

                    const gold = isGoldStandard(p.pollster);
                    const effN = effectiveSampleSize(p.pollster, p.sampleSize);

                    return (
                      <tr key={`${p.pollster}-${p.endDate}-${p.sampleSize}`}>
                        <td style={{ color: "rgba(255,255,255,0.85)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{p.pollster}</span>
                            {gold && <span className="pgb-gold-badge">GOLD</span>}
                          </div>
                        </td>
                        <td className="r">{p.endDate}</td>
                        <td className="r">
                          {p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "—"}
                          {gold && p.sampleSize > 0 && (
                            <span style={{ marginLeft: "6px", fontSize: "9px", color: "var(--muted3)" }}>
                              (eff {effN.toLocaleString()})
                            </span>
                          )}
                        </td>
                        <td className="r">{p.sampleType}</td>
                        <td className="r" style={{ color: "rgba(255,255,255,0.7)" }}>
                          {gold ? `×${GOLD_STANDARD_MULTIPLIER}.00` : "×1.00"}
                        </td>
                        <td className={`r pgb-dem-col`}>{d.toFixed(0)}%</td>
                        <td className={`r pgb-rep-col`}>{r.toFixed(0)}%</td>
                        <td className={`r ${netClass}`}>{netStr}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}