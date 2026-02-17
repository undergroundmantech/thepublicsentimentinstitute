// app/polling/generic-ballot/page.tsx  (or wherever you want it)
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

// NOTE: Using plural keys to match your input data
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

function fmtISO(iso: string) {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

export default function GenericBallotPage() {
  const {
    daily,
    range,
    lastDate,
    latestRepublicans,
    latestDemocrats,
    latestNet,
    seriesForChart,
    pollsAdjusted,
  } = useMemo(() => {
    const pollsAdjusted = RAW_POLLS.map((p) => ({
      ...p,
      sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
    }));

    const keys = getCandidateList(RAW_POLLS).sort((a, b) => a.localeCompare(b)); // ["Democrats","Republicans"]
    const range = getDateRange(RAW_POLLS);
    const dailyBase = buildDailyWeightedSeries(pollsAdjusted as any, keys, range.start, range.end);

    // Keep Net in the DATA (for tooltip) but do NOT render it as a line
    const dailyWithNet = dailyBase.map((row) => {
      const r = Number((row as any).Republicans ?? 0);
      const d = Number((row as any).Democrats ?? 0);
      return { ...row, Net: round1(r - d) } as any; // GOP margin
    });

    const latest = dailyWithNet[dailyWithNet.length - 1] ?? null;

    const latestRepublicans = latest ? Number((latest as any).Republicans ?? 0) : 0;
    const latestDemocrats = latest ? Number((latest as any).Democrats ?? 0) : 0;
    const latestNet = latest ? Number((latest as any).Net ?? 0) : 0;

    const seriesForChart = [
      { key: "Republicans", label: "Republicans", color: COLORS.Republicans },
      { key: "Democrats", label: "Democrats", color: COLORS.Democrats },
    ];

    return {
      daily: dailyWithNet,
      range,
      lastDate: range.end,
      latestRepublicans,
      latestDemocrats,
      latestNet,
      seriesForChart,
      pollsAdjusted,
    };
  }, []);

  const marginText =
    latestNet === 0
      ? "Even"
      : latestNet > 0
      ? `R+${round1(latestNet).toFixed(1)}`
      : `D+${Math.abs(round1(latestNet)).toFixed(1)}`;

  return (
    <div className="space-y-10 psi-animate-in">
      {/* HERO */}
      <section className="relative overflow-hidden psi-card p-7 md:p-10">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-[rgba(255,23,23,0.14)] blur-3xl" />
          <div className="absolute -right-28 top-10 h-96 w-96 rounded-full bg-[rgba(24,77,252,0.14)] blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white/90 md:text-5xl">
              2026 National Generic Ballot
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
        <KpiCard label="Republicans" value={`${round1(latestRepublicans).toFixed(1)}%`} sub="Daily weighted avg" />
        <KpiCard label="Democrats" value={`${round1(latestDemocrats).toFixed(1)}%`} sub="Daily weighted avg" />
        <KpiCard label="Margin" value={marginText} sub="Republicans − Democrats" />
        <KpiCard label="Polls" value={`${RAW_POLLS.length}`} sub="Included in model" />
      </section>

      {/* CHART (Net stays in tooltip via data, but no Net line rendered) */}
      <PollingTimeSeriesChart
        data={daily as any[]}
        series={seriesForChart}
        yDomain={[30, 60]}
        title="Polling average"
        subtitle="Party trendlines over time; Hover to view data"
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
                <th className="psi-num">Republicans</th>
                <th className="psi-num">Democrats</th>
                <th className="psi-num">Margin</th>
              </tr>
            </thead>
            <tbody>
              {[...RAW_POLLS]
                .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                .map((p) => {
                  const r = Number((p.results as any).Republicans ?? 0);
                  const d = Number((p.results as any).Democrats ?? 0);
                  const net = round1(r - d);
                  const netStr =
                    net === 0 ? "Even" : net > 0 ? `R+${net.toFixed(1)}` : `D+${Math.abs(net).toFixed(1)}`;

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
                        {p.sampleSize ? p.sampleSize.toLocaleString() : "—"}
                        {gold && p.sampleSize ? (
                          <span className="ml-2 psi-mono text-[11px] text-white/45">
                            (eff {effN.toLocaleString()})
                          </span>
                        ) : null}
                      </td>
                      <td className="psi-num text-white/70">{p.sampleType}</td>
                      <td className="psi-num text-white/80">{w}</td>
                      <td className="psi-num text-white/85">{r.toFixed(0)}%</td>
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
