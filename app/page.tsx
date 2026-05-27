"use client";

import React from "react";
import Link from "next/link";
import HeroElectoralMap from "@/app/components/HeroElectoralMap";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Poll,
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";

// ─── Gold standard helpers ────────────────────────────────────────────────────
const GS_NAMES = [
  "Big Data Poll","Rasmussen Reports","AtlasIntel","SoCalStrategies",
  "Emerson","Trafalgar","InsiderAdvantage","Patriot Polling",
];
function normName(s: string) {
  return s.toLowerCase().replace(/\(r\)/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
function isGS(pollster: string) {
  const p = normName(pollster);
  return GS_NAMES.some(n => p.includes(normName(n)));
}
function effN(pollster: string, n: number, mult: number) {
  if (!Number.isFinite(n) || n <= 0) return n;
  return isGS(pollster) ? Math.round(n * mult * mult) : n;
}
function round1(n: number) { return Math.round(n * 10) / 10; }

// ─── Poll datasets ────────────────────────────────────────────────────────────
const TRUMP_POLLS: Poll[] = [
 { pollster: "CNN", endDate: "2026-03-30", sampleSize: 1500, sampleType: "RV", results: { Approve: 38, Disapprove: 62 } },
{ pollster: "Morning Consult", endDate: "2026-03-29", sampleSize: 2203, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "Rasmussen Reports", endDate: "2026-04-01", sampleSize: 1500, sampleType: "LV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Economist/YouGov", endDate: "2026-03-30", sampleSize: 1505, sampleType: "RV", results: { Approve: 39, Disapprove: 58 } },
{ pollster: "Harvard-Harris", endDate: "2026-03-26", sampleSize: 2009, sampleType: "RV", results: { Approve: 43, Disapprove: 53 } },
{ pollster: "Quantus Insights", endDate: "2026-03-26", sampleSize: 1472, sampleType: "LV", results: { Approve: 42, Disapprove: 57 } },
{ pollster: "Daily Mail", endDate: "2026-03-24", sampleSize: 1019, sampleType: "RV", results: { Approve: 46, Disapprove: 54 } },
{ pollster: "Big Data Poll", endDate: "2026-03-24", sampleSize: 3003, sampleType: "RV", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-03-23", sampleSize: 1272, sampleType: "A", results: { Approve: 36, Disapprove: 62 } },
{ pollster: "FOX News", endDate: "2026-03-23", sampleSize: 1001, sampleType: "RV", results: { Approve: 41, Disapprove: 59 } },
{ pollster: "Economist/YouGov", endDate: "2026-03-23", sampleSize: 1502, sampleType: "RV", results: { Approve: 41, Disapprove: 55 } },
{ pollster: "RMG Research*", endDate: "2026-03-26", sampleSize: 3000, sampleType: "RV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Morning Consult", endDate: "2026-03-22", sampleSize: 2200, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "Quinnipiac", endDate: "2026-03-23", sampleSize: 1191, sampleType: "RV", results: { Approve: 38, Disapprove: 56 } },
{ pollster: "AP/NORC**", endDate: "2026-03-23", sampleSize: 1150, sampleType: "A", results: { Approve: 38, Disapprove: 60 } },
{ pollster: "Daily Mail", endDate: "2026-03-20", sampleSize: 1037, sampleType: "RV", results: { Approve: 42, Disapprove: 58 } },
{ pollster: "CBS News", endDate: "2026-03-20", sampleSize: 3335, sampleType: "A", results: { Approve: 40, Disapprove: 60 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-03-19", sampleSize: 1545, sampleType: "A", results: { Approve: 40, Disapprove: 58 } },
{ pollster: "Quantus Insights", endDate: "2026-03-18", sampleSize: 1064, sampleType: "LV", results: { Approve: 44, Disapprove: 55 } },
{ pollster: "Emerson", endDate: "2026-03-17", sampleSize: 1000, sampleType: "LV", results: { Approve: 42, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2026-03-19", sampleSize: 3000, sampleType: "RV", results: { Approve: 46, Disapprove: 53 } },
{ pollster: "Economist/YouGov", endDate: "2026-03-16", sampleSize: 1429, sampleType: "RV", results: { Approve: 41, Disapprove: 56 } },
{ pollster: "Morning Consult", endDate: "2026-03-16", sampleSize: 2200, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "Economist/YouGov", endDate: "2026-03-16", sampleSize: 1429, sampleType: "RV", results: { Approve: 41, Disapprove: 56 } },
{ pollster: "Rasmussen Reports", endDate: "2026-03-16", sampleSize: 1500, sampleType: "LV", results: { Approve: 44, Disapprove: 54 } },
{ pollster: "Quinnipiac", endDate: "2026-03-08", sampleSize: 1002, sampleType: "RV", results: { Approve: 37, Disapprove: 57 } },
{ pollster: "RMG Research", endDate: "2026-03-12", sampleSize: 3000, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "NPR/PBS/Marist", endDate: "2026-03-04", sampleSize: 1392, sampleType: "RV", results: { Approve: 40, Disapprove: 57 } },
{ pollster: "Quinnipiac", endDate: "2026-03-08", sampleSize: 1002, sampleType: "RV", results: { Approve: 37, Disapprove: 57 } },
{ pollster: "NBC News", endDate: "2026-03-03", sampleSize: 1000, sampleType: "RV", results: { Approve: 44, Disapprove: 54 } },
{ pollster: "Rasmussen Reports", endDate: "2026-03-09", sampleSize: 1500, sampleType: "LV", results: { Approve: 46, Disapprove: 53 } },
{ pollster: "Economist/YouGov", endDate: "2026-03-09", sampleSize: 1405, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "Quantus Insights", endDate: "2026-03-03", sampleSize: 1624, sampleType: "LV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Fox News", endDate: "2026-03-02", sampleSize: 1004, sampleType: "RV", results: { Approve: 43, Disapprove: 57 } },
{ pollster: "Economist/YouGov", endDate: "2026-03-02", sampleSize: 1366, sampleType: "RV", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Rasmussen Reports", endDate: "2026-03-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 45, Disapprove: 54 } },  
{ pollster: "Public Sentiment Institute", endDate: "2026-02-28", sampleSize: 316, sampleType: "RV", results: { Approve: 35.5, Disapprove: 63.3 } },
{ pollster: "Public Sentiment Institute", endDate: "2026-02-28", sampleSize: 249, sampleType: "LV", results: { Approve: 40.8, Disapprove: 58.8 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-03-01", sampleSize: 1282, sampleType: "A", results: { Approve: 38, Disapprove: 60 } },
{ pollster: "CBS News", endDate: "2026-02-27", sampleSize: 2264, sampleType: "A", results: { Approve: 41, Disapprove: 59 } },
{ pollster: "Trafalgar Group", endDate: "2026-02-25", sampleSize: 1084, sampleType: "LV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "Rasmussen Reports", endDate: "2026-02-26", sampleSize: 1500, sampleType: "LV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Emerson", endDate: "2026-02-22", sampleSize: 1000, sampleType: "LV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Economist/YouGov", endDate: "2026-02-23", sampleSize: 1402, sampleType: "RV", results: { Approve: 42, Disapprove: 57 } },
{ pollster: "CBS News", endDate: "2026-02-23", sampleSize: 2381, sampleType: "A", results: { Approve: 40, Disapprove: 60 } },
{ pollster: "Economist/YouGov", endDate: "2026-02-23", sampleSize: 1402, sampleType: "RV", results: { Approve: 42, Disapprove: 57 } },
{ pollster: "Rasmussen Reports", endDate: "2026-02-23", sampleSize: 1500, sampleType: "LV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-02-23", sampleSize: 4638, sampleType: "A", results: { Approve: 40, Disapprove: 58 } },
{ pollster: "CNN", endDate: "2026-02-20", sampleSize: 1000, sampleType: "RV", results: { Approve: 39, Disapprove: 61 } },
{ pollster: "InsiderAdvantage", endDate: "2026-02-18", sampleSize: 800, sampleType: "LV", results: { Approve: 50, Disapprove: 46 } },
{ pollster: "Big Data Poll", endDate: "2026-02-18", sampleSize: 2012, sampleType: "RV", results: { Approve: 42, Disapprove: 55 } },
{ pollster: "Morning Consult", endDate: "2026-02-16", sampleSize: 2200, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "RMG Research", endDate: "2026-02-19", sampleSize: 3000, sampleType: "RV", results: { Approve: 47, Disapprove: 52 } },
  { pollster: "Economist/YouGov", endDate: "2026-02-16", sampleSize: 1512, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
  { pollster: "AP/NORC", endDate: "2026-02-09", sampleSize: 1156, sampleType: "A", results: { Approve: 36, Disapprove: 62 } },
  { pollster: "Rasmussen Reports", endDate: "2026-02-16", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
  { pollster: "Quantus Insights", endDate: "2026-02-13", sampleSize: 1515, sampleType: "LV", results: { Approve: 43, Disapprove: 56 } },
  { pollster: "RMG Research*", endDate: "2026-02-12", sampleSize: 3000, sampleType: "RV", results: { Approve: 47, Disapprove: 52 } },
  { pollster: "Morning Consult", endDate: "2026-02-09", sampleSize: 2200, sampleType: "RV", results: { Approve: 44, Disapprove: 53 } },
  { pollster: "NBC News Decision Desk", endDate: "2026-02-06", sampleSize: 21995, sampleType: "A", results: { Approve: 39, Disapprove: 61 } },
  { pollster: "Quinnipiac", endDate: "2026-02-02", sampleSize: 1191, sampleType: "RV", results: { Approve: 37, Disapprove: 56 } },
  { pollster: "InsiderAdvantage", endDate: "2026-02-01", sampleSize: 1000, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
  { pollster: "PPP", endDate: "2026-01-30", sampleSize: 652, sampleType: "RV", results: { Approve: 39, Disapprove: 56 } },
  { pollster: "NPR/PBS/Marist", endDate: "2026-01-30", sampleSize: 1326, sampleType: "RV", results: { Approve: 39, Disapprove: 57 } },
  { pollster: "Marquette", endDate: "2026-01-28", sampleSize: 1003, sampleType: "A", results: { Approve: 42, Disapprove: 58 } },
  { pollster: "Morning Consult", endDate: "2026-02-01", sampleSize: 2201, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
  { pollster: "Rasmussen Reports", endDate: "2026-02-05", sampleSize: 1500, sampleType: "LV", results: { Approve: 41, Disapprove: 57 } },
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

const GB_POLLS: Poll[] = [
  { pollster: "Economist/YouGov", endDate: "2026-03-30", sampleSize: 1505, sampleType: "RV", results: { Democrats: 45, Republicans: 39 } },
{ pollster: "Harvard-Harris", endDate: "2026-03-26", sampleSize: 1000, sampleType: "LV", results: { Democrats: 52, Republicans: 48 } },
{ pollster: "Quantus Insights", endDate: "2026-03-26", sampleSize: 1472, sampleType: "LV", results: { Democrats: 47, Republicans: 41 } },
{ pollster: "Big Data Poll", endDate: "2026-03-24", sampleSize: 3003, sampleType: "LV", results: { Democrats: 48, Republicans: 40 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-03-23", sampleSize: 985, sampleType: "RV", results: { Democrats: 40, Republicans: 38 } },
{ pollster: "Economist/YouGov", endDate: "2026-03-23", sampleSize: 1502, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
{ pollster: "Quinnipiac", endDate: "2026-03-23", sampleSize: 1191, sampleType: "RV", results: { Democrats: 51, Republicans: 40 } },
{ pollster: "Rasmussen Reports", endDate: "2026-03-23", sampleSize: 2222, sampleType: "LV", results: { Democrats: 45, Republicans: 42 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-03-19", sampleSize: 1206, sampleType: "RV", results: { Democrats: 40, Republicans: 37 } },
{ pollster: "Quantus Insights", endDate: "2026-03-18", sampleSize: 1064, sampleType: "LV", results: { Democrats: 47, Republicans: 42 } },
{ pollster: "Emerson", endDate: "2026-03-17", sampleSize: 1000, sampleType: "LV", results: { Democrats: 49, Republicans: 42 } },
  { pollster: "Morning Consult", endDate: "2026-03-16", sampleSize: 2200, sampleType: "RV", results: { Democrats: 48, Republicans: 40 } },
  { pollster: "Economist/YouGov", endDate: "2026-03-16", sampleSize: 1429, sampleType: "RV", results: { Democrats: 43, Republicans: 41 } },
  { pollster: "Economist/YouGov", endDate: "2026-03-09", sampleSize: 1405, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
  { pollster: "Cygnal", endDate: "2026-03-04", sampleSize: 1500, sampleType: "LV", results: { Democrats: 49, Republicans: 45 } },
  { pollster: "NPR/PBS/Marist", endDate: "2026-03-04", sampleSize: 1392, sampleType: "RV", results: { Democrats: 53, Republicans: 44 } },
  { pollster: "NBC News", endDate: "2026-03-03", sampleSize: 1000, sampleType: "RV", results: { Democrats: 50, Republicans: 44 } },
  { pollster: "RMG Research", endDate: "2026-03-04", sampleSize: 2000, sampleType: "RV", results: { Democrats: 46, Republicans: 46 } },
  { pollster: "Quantus Insights", endDate: "2026-03-03", sampleSize: 1624, sampleType: "LV", results: { Democrats: 48, Republicans: 42 } },
  { pollster: "Economist/YouGov", endDate: "2026-03-02", sampleSize: 1366, sampleType: "RV", results: { Democrats: 45, Republicans: 41 } },
  { pollster: "CBS News", endDate: "2026-02-27", sampleSize: 2264, sampleType: "A", results: { Democrats: 45, Republicans: 40 } },
  { pollster: "Harvard-Harris", endDate: "2026-02-26", sampleSize: 1999, sampleType: "RV", results: { Democrats: 50, Republicans: 50 } },
  { pollster: "Public Sentiment Institute", endDate: "2026-02-28", sampleSize: 316, sampleType: "RV", results: { Republicans: 32.8, Democrats: 40.7, Other: 2.8, Undecided: 23.7 } },
  { pollster: "Public Sentiment Institute", endDate: "2026-02-28", sampleSize: 249, sampleType: "LV", results: { Republicans: 41.0, Democrats: 50.1, Other: 1.7, Undecided: 7.2 } },
  { pollster: "Emerson", endDate: "2026-02-22", sampleSize: 1000, sampleType: "LV", results: { Democrats: 50, Republicans: 42 } },
  { pollster: "Morning Consult", endDate: "2026-02-22", sampleSize: 2202, sampleType: "RV", results: { Democrats: 46, Republicans: 42 } },
  { pollster: "Economist/YouGov", endDate: "2026-02-23", sampleSize: 1402, sampleType: "RV", results: { Democrats: 45, Republicans: 41 } },
  { pollster: "Reuters/Ipsos", endDate: "2026-02-23", sampleSize: 3686, sampleType: "RV", results: { Democrats: 40, Republicans: 38 } },
  { pollster: "Big Data Poll", endDate: "2026-02-18", sampleSize: 1805, sampleType: "LV", results: { Democrats: 50, Republicans: 41 } },
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

const RT_POLLS: Poll[] = [
  { pollster: "Economist/YouGov", endDate: "2026-03-30", sampleSize: 1505, sampleType: "RV", results: { RightTrack: 30, WrongTrack: 62 } },
{ pollster: "Harvard-Harris", endDate: "2026-03-26", sampleSize: 2009, sampleType: "RV", results: { RightTrack: 35, WrongTrack: 55 } },
{ pollster: "Quantus Insights", endDate: "2026-03-26", sampleSize: 1472, sampleType: "LV", results: { RightTrack: 36, WrongTrack: 60 } },
{ pollster: "Rasmussen Reports", endDate: "2026-03-26", sampleSize: 1873, sampleType: "LV", results: { RightTrack: 38, WrongTrack: 56 } },
{ pollster: "Big Data Poll", endDate: "2026-03-24", sampleSize: 3003, sampleType: "RV", results: { RightTrack: 33, WrongTrack: 58 } },
{ pollster: "Economist/YouGov", endDate: "2026-03-23", sampleSize: 1502, sampleType: "RV", results: { RightTrack: 34, WrongTrack: 60 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-03-22", sampleSize: 1272, sampleType: "A", results: { RightTrack: 20, WrongTrack: 63 } },
{ pollster: "Quantus Insights", endDate: "2026-03-18", sampleSize: 1064, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 56 } },
{ pollster: "Rasmussen Reports", endDate: "2026-03-19", sampleSize: 1858, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 54 } },
 { pollster: "Economist/YouGov", endDate: "2026-03-16", sampleSize: 1429, sampleType: "RV", results: { RightTrack: 34, WrongTrack: 59 } },
  { pollster: "Rasmussen Reports", endDate: "2026-03-12", sampleSize: 1845, sampleType: "LV", results: { RightTrack: 41, WrongTrack: 54 } },
  { pollster: "Economist/YouGov", endDate: "2026-03-09", sampleSize: 1405, sampleType: "RV", results: { RightTrack: 35, WrongTrack: 59 } },
  { pollster: "Cygnal", endDate: "2026-03-04", sampleSize: 1500, sampleType: "LV", results: { RightTrack: 43, WrongTrack: 55 } },
  { pollster: "NPR/PBS/Marist", endDate: "2026-03-04", sampleSize: 1392, sampleType: "RV", results: { RightTrack: 40, WrongTrack: 60 } },
  { pollster: "Rasmussen Reports", endDate: "2026-03-05", sampleSize: 1851, sampleType: "LV", results: { RightTrack: 41, WrongTrack: 54 } },
  { pollster: "Quantus Insights",       endDate: "2026-03-03", sampleSize: 1624,  sampleType: "LV", results: { RightTrack: 41, WrongTrack: 54 } },
  { pollster: "Economist/YouGov",       endDate: "2026-03-02", sampleSize: 1366,  sampleType: "RV", results: { RightTrack: 34, WrongTrack: 58 } },
  { pollster: "Harvard-Harris",         endDate: "2026-02-26", sampleSize: 1999,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports",      endDate: "2026-02-26", sampleSize: 1887,  sampleType: "LV", results: { RightTrack: 40, WrongTrack: 54 } },
  { pollster: "Economist/YouGov",       endDate: "2026-02-23", sampleSize: 1402,  sampleType: "RV", results: { RightTrack: 34, WrongTrack: 58 } },
  { pollster: "Big Data Poll",          endDate: "2026-02-18", sampleSize: 2012,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 57 } },
  { pollster: "Economist/YouGov",       endDate: "2026-02-16", sampleSize: 1512,  sampleType: "RV", results: { RightTrack: 32, WrongTrack: 60 } },
  { pollster: "Rasmussen Reports",      endDate: "2026-02-19", sampleSize: 1899,  sampleType: "LV", results: { RightTrack: 44, WrongTrack: 51 } },
  { pollster: "Reuters/Ipsos",          endDate: "2026-02-16", sampleSize: 1117,  sampleType: "A",  results: { RightTrack: 21, WrongTrack: 64 } },
  { pollster: "Quantus Insights",       endDate: "2026-02-13", sampleSize: 1515,  sampleType: "LV", results: { RightTrack: 38, WrongTrack: 60 } },
  { pollster: "Yahoo News",             endDate: "2026-02-12", sampleSize: 1149,  sampleType: "RV", results: { RightTrack: 34, WrongTrack: 59 } },
  { pollster: "Rasmussen Reports",      endDate: "2026-02-12", sampleSize: 1846,  sampleType: "LV", results: { RightTrack: 42, WrongTrack: 52 } },
  { pollster: "Economist/YouGov",       endDate: "2026-02-09", sampleSize: 1551,  sampleType: "RV", results: { RightTrack: 33, WrongTrack: 61 } },
  { pollster: "Cygnal",                 endDate: "2026-02-04", sampleSize: 1500,  sampleType: "LV", results: { RightTrack: 43, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports",      endDate: "2026-02-05", sampleSize: 1822,  sampleType: "LV", results: { RightTrack: 36, WrongTrack: 59 } },
  { pollster: "NBC News Decision Desk", endDate: "2026-02-06", sampleSize: 21995, sampleType: "A",  results: { RightTrack: 35, WrongTrack: 65 } },
  { pollster: "Economist/YouGov",       endDate: "2026-02-02", sampleSize: 1504,  sampleType: "RV", results: { RightTrack: 35, WrongTrack: 59 } },
  { pollster: "Harvard-Harris",         endDate: "2026-01-29", sampleSize: 2000,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports",      endDate: "2026-01-29", sampleSize: 1890,  sampleType: "LV", results: { RightTrack: 41, WrongTrack: 54 } },
  { pollster: "Economist/YouGov",       endDate: "2026-01-26", sampleSize: 1520,  sampleType: "RV", results: { RightTrack: 33, WrongTrack: 60 } },
  { pollster: "Big Data Poll",          endDate: "2026-01-24", sampleSize: 3280,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 53 } },
  { pollster: "Quantus Insights",       endDate: "2026-01-22", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 35, WrongTrack: 58 } },
  { pollster: "Rasmussen Reports",      endDate: "2026-01-22", sampleSize: 1929,  sampleType: "LV", results: { RightTrack: 41, WrongTrack: 53 } },
  { pollster: "Emerson",                endDate: "2026-01-19", sampleSize: 1000,  sampleType: "LV", results: { RightTrack: 44, WrongTrack: 56 } },
  { pollster: "Economist/YouGov",       endDate: "2026-01-19", sampleSize: 1549,  sampleType: "RV", results: { RightTrack: 34, WrongTrack: 59 } },
  { pollster: "NY Times/Siena",         endDate: "2026-01-17", sampleSize: 1625,  sampleType: "RV", results: { RightTrack: 37, WrongTrack: 56 } },
  { pollster: "Rasmussen Reports",      endDate: "2026-01-15", sampleSize: 1908,  sampleType: "LV", results: { RightTrack: 37, WrongTrack: 57 } },
  { pollster: "Wall Street Journal",    endDate: "2026-01-13", sampleSize: 1500,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 57 } },
  { pollster: "Economist/YouGov",       endDate: "2026-01-12", sampleSize: 1437,  sampleType: "RV", results: { RightTrack: 34, WrongTrack: 59 } },
  { pollster: "Quinnipiac",             endDate: "2026-01-12", sampleSize: 1133,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 56 } },
  { pollster: "Yahoo News",             endDate: "2026-01-12", sampleSize: 1149,  sampleType: "RV", results: { RightTrack: 35, WrongTrack: 58 } },
  { pollster: "Cygnal",                 endDate: "2026-01-08", sampleSize: 1500,  sampleType: "LV", results: { RightTrack: 42, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports",      endDate: "2026-01-08", sampleSize: 1880,  sampleType: "LV", results: { RightTrack: 41, WrongTrack: 53 } },
  { pollster: "Economist/YouGov",       endDate: "2026-01-05", sampleSize: 1389,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 56 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-12-30", sampleSize: 1111,  sampleType: "LV", results: { RightTrack: 40, WrongTrack: 53 } },
  { pollster: "Economist/YouGov",       endDate: "2025-12-29", sampleSize: 1420,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 57 } },
  { pollster: "Big Data Poll",          endDate: "2025-12-28", sampleSize: 3412,  sampleType: "LV", results: { RightTrack: 36, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-12-23", sampleSize: 1099,  sampleType: "LV", results: { RightTrack: 40, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-12-18", sampleSize: 1871,  sampleType: "LV", results: { RightTrack: 40, WrongTrack: 54 } },
  { pollster: "Economist/YouGov",       endDate: "2025-12-22", sampleSize: 1425,  sampleType: "RV", results: { RightTrack: 37, WrongTrack: 55 } },
  { pollster: "Quantus Insights",       endDate: "2025-12-16", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 34, WrongTrack: 56 } },
  { pollster: "Economist/YouGov",       endDate: "2025-12-15", sampleSize: 1453,  sampleType: "RV", results: { RightTrack: 37, WrongTrack: 56 } },
  { pollster: "Big Data Poll",          endDate: "2025-12-12", sampleSize: 3004,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 52 } },
  { pollster: "NPR/PBS/Marist",         endDate: "2025-12-11", sampleSize: 1261,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 61 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-12-11", sampleSize: 1933,  sampleType: "LV", results: { RightTrack: 41, WrongTrack: 53 } },
  { pollster: "Economist/YouGov",       endDate: "2025-12-08", sampleSize: 1380,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 57 } },
  { pollster: "Cygnal",                 endDate: "2025-12-07", sampleSize: 1500,  sampleType: "LV", results: { RightTrack: 40, WrongTrack: 57 } },
  { pollster: "Quantus Insights",       endDate: "2025-12-05", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 55 } },
  { pollster: "Harvard-Harris",         endDate: "2025-12-04", sampleSize: 2204,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-12-04", sampleSize: 1890,  sampleType: "LV", results: { RightTrack: 36, WrongTrack: 58 } },
  { pollster: "Economist/YouGov",       endDate: "2025-12-01", sampleSize: 1456,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 57 } },
  { pollster: "Big Data Poll",          endDate: "2025-12-01", sampleSize: 2008,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 52 } },
  { pollster: "NBC News Decision Desk", endDate: "2025-12-08", sampleSize: 20252, sampleType: "A",  results: { RightTrack: 36, WrongTrack: 64 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-11-25", sampleSize: 1176,  sampleType: "LV", results: { RightTrack: 40, WrongTrack: 54 } },
  { pollster: "Economist/YouGov",       endDate: "2025-11-24", sampleSize: 1511,  sampleType: "RV", results: { RightTrack: 37, WrongTrack: 55 } },
  { pollster: "Big Data Poll",          endDate: "2025-11-21", sampleSize: 2006,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-11-20", sampleSize: 2020,  sampleType: "LV", results: { RightTrack: 39, WrongTrack: 54 } },
  { pollster: "Economist/YouGov",       endDate: "2025-11-17", sampleSize: 1382,  sampleType: "RV", results: { RightTrack: 34, WrongTrack: 59 } },
  { pollster: "Quantus Insights",       endDate: "2025-11-12", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 35, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-11-13", sampleSize: 1925,  sampleType: "LV", results: { RightTrack: 36, WrongTrack: 59 } },
  { pollster: "Marquette",              endDate: "2025-11-12", sampleSize: 1052,  sampleType: "A",  results: { RightTrack: 34, WrongTrack: 66 } },
  { pollster: "Economist/YouGov",       endDate: "2025-11-10", sampleSize: 1500,  sampleType: "RV", results: { RightTrack: 35, WrongTrack: 58 } },
  { pollster: "Cygnal",                 endDate: "2025-11-06", sampleSize: 1500,  sampleType: "RV", results: { RightTrack: 37, WrongTrack: 59 } },
  { pollster: "Harvard-Harris",         endDate: "2025-11-06", sampleSize: 2000,  sampleType: "RV", results: { RightTrack: 35, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-11-06", sampleSize: 2022,  sampleType: "LV", results: { RightTrack: 38, WrongTrack: 57 } },
  { pollster: "Economist/YouGov",       endDate: "2025-11-03", sampleSize: 1475,  sampleType: "RV", results: { RightTrack: 35, WrongTrack: 57 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-10-30", sampleSize: 1929,  sampleType: "LV", results: { RightTrack: 40, WrongTrack: 55 } },
  { pollster: "NewsNation",             endDate: "2025-10-29", sampleSize: 1159,  sampleType: "LV", results: { RightTrack: 40, WrongTrack: 60 } },
  { pollster: "Big Data Poll",          endDate: "2025-10-28", sampleSize: 2984,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 51 } },
  { pollster: "NBC News",               endDate: "2025-10-28", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 37, WrongTrack: 61 } },
  { pollster: "ABC/Wash Post/Ipsos",    endDate: "2025-10-28", sampleSize: 2203,  sampleType: "RV", results: { RightTrack: 34, WrongTrack: 65 } },
  { pollster: "Economist/YouGov",       endDate: "2025-10-27", sampleSize: 1476,  sampleType: "RV", results: { RightTrack: 35, WrongTrack: 59 } },
  { pollster: "Yahoo News",             endDate: "2025-10-27", sampleSize: 1197,  sampleType: "RV", results: { RightTrack: 35, WrongTrack: 58 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-10-23", sampleSize: 1925,  sampleType: "LV", results: { RightTrack: 39, WrongTrack: 54 } },
  { pollster: "Economist/YouGov",       endDate: "2025-10-20", sampleSize: 1448,  sampleType: "RV", results: { RightTrack: 34, WrongTrack: 58 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-10-16", sampleSize: 1995,  sampleType: "LV", results: { RightTrack: 43, WrongTrack: 51 } },
  { pollster: "Economist/YouGov",       endDate: "2025-10-13", sampleSize: 1467,  sampleType: "RV", results: { RightTrack: 35, WrongTrack: 57 } },
  { pollster: "Cygnal",                 endDate: "2025-10-08", sampleSize: 1500,  sampleType: "LV", results: { RightTrack: 42, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-10-09", sampleSize: 1964,  sampleType: "LV", results: { RightTrack: 44, WrongTrack: 52 } },
  { pollster: "Economist/YouGov",       endDate: "2025-10-06", sampleSize: 1490,  sampleType: "RV", results: { RightTrack: 34, WrongTrack: 58 } },
  { pollster: "Harvard-Harris",         endDate: "2025-10-02", sampleSize: 2413,  sampleType: "RV", results: { RightTrack: 40, WrongTrack: 50 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-10-02", sampleSize: 1943,  sampleType: "LV", results: { RightTrack: 41, WrongTrack: 53 } },
  { pollster: "Economist/YouGov",       endDate: "2025-09-29", sampleSize: 1518,  sampleType: "RV", results: { RightTrack: 37, WrongTrack: 57 } },
  { pollster: "Yahoo News",             endDate: "2025-09-29", sampleSize: 1129,  sampleType: "RV", results: { RightTrack: 34, WrongTrack: 59 } },
  { pollster: "NY Times/Siena",         endDate: "2025-09-27", sampleSize: 1313,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 58 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-09-25", sampleSize: 1951,  sampleType: "LV", results: { RightTrack: 42, WrongTrack: 52 } },
  { pollster: "Economist/YouGov",       endDate: "2025-09-22", sampleSize: 1392,  sampleType: "RV", results: { RightTrack: 35, WrongTrack: 59 } },
  { pollster: "Quantus Insights",       endDate: "2025-09-21", sampleSize: 1000,  sampleType: "LV", results: { RightTrack: 42, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-09-18", sampleSize: 1932,  sampleType: "LV", results: { RightTrack: 42, WrongTrack: 52 } },
  { pollster: "Economist/YouGov",       endDate: "2025-09-15", sampleSize: 1420,  sampleType: "RV", results: { RightTrack: 32, WrongTrack: 62 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-09-11", sampleSize: 2509,  sampleType: "RV", results: { RightTrack: 42, WrongTrack: 53 } },
  { pollster: "Economist/YouGov",       endDate: "2025-09-08", sampleSize: 1487,  sampleType: "RV", results: { RightTrack: 37, WrongTrack: 57 } },
  { pollster: "Cygnal",                 endDate: "2025-09-03", sampleSize: 1500,  sampleType: "RV", results: { RightTrack: 43, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-09-04", sampleSize: 1578,  sampleType: "LV", results: { RightTrack: 44, WrongTrack: 52 } },
  { pollster: "Economist/YouGov",       endDate: "2025-09-02", sampleSize: 1549,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 55 } },
  { pollster: "Yahoo News",             endDate: "2025-09-02", sampleSize: 1138,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 57 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-08-28", sampleSize: 1932,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Economist/YouGov",       endDate: "2025-08-25", sampleSize: 1377,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 56 } },
  { pollster: "Reuters/Ipsos",          endDate: "2025-08-24", sampleSize: 1022,  sampleType: "A",  results: { RightTrack: 30, WrongTrack: 57 } },
  { pollster: "Harvard-Harris",         endDate: "2025-08-21", sampleSize: 2025,  sampleType: "RV", results: { RightTrack: 40, WrongTrack: 50 } },
  { pollster: "NBC News Decision Desk", endDate: "2025-09-01", sampleSize: 30196, sampleType: "A",  results: { RightTrack: 39, WrongTrack: 61 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-08-21", sampleSize: 1906,  sampleType: "LV", results: { RightTrack: 46, WrongTrack: 49 } },
  { pollster: "Economist/YouGov",       endDate: "2025-08-18", sampleSize: 1408,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-08-14", sampleSize: 1967,  sampleType: "LV", results: { RightTrack: 44, WrongTrack: 49 } },
  { pollster: "Economist/YouGov",       endDate: "2025-08-11", sampleSize: 1474,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 53 } },
  { pollster: "Cygnal",                 endDate: "2025-08-09", sampleSize: 1500,  sampleType: "RV", results: { RightTrack: 44, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-08-07", sampleSize: 1953,  sampleType: "LV", results: { RightTrack: 43, WrongTrack: 51 } },
  { pollster: "Economist/YouGov",       endDate: "2025-08-04", sampleSize: 1528,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-07-31", sampleSize: 2027,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Economist/YouGov",       endDate: "2025-07-28", sampleSize: 1610,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 54 } },
  { pollster: "Yahoo News",             endDate: "2025-07-28", sampleSize: 1168,  sampleType: "RV", results: { RightTrack: 40, WrongTrack: 54 } },
  { pollster: "Reuters/Ipsos",          endDate: "2025-07-27", sampleSize: 1023,  sampleType: "A",  results: { RightTrack: 29, WrongTrack: 56 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-07-27", sampleSize: 1709,  sampleType: "LV", results: { RightTrack: 44, WrongTrack: 52 } },
  { pollster: "Economist/YouGov",       endDate: "2025-07-21", sampleSize: 1551,  sampleType: "RV", results: { RightTrack: 37, WrongTrack: 56 } },
  { pollster: "Wall Street Journal",    endDate: "2025-07-20", sampleSize: 1500,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-07-17", sampleSize: 1932,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Big Data Poll",          endDate: "2025-07-14", sampleSize: 3022,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 51 } },
  { pollster: "Marquette",              endDate: "2025-07-16", sampleSize: 1005,  sampleType: "A",  results: { RightTrack: 40, WrongTrack: 60 } },
  { pollster: "Economist/YouGov",       endDate: "2025-07-14", sampleSize: 1506,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-07-10", sampleSize: 2178,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 49 } },
  { pollster: "Harvard-Harris",         endDate: "2025-07-08", sampleSize: 2044,  sampleType: "RV", results: { RightTrack: 40, WrongTrack: 51 } },
  { pollster: "Economist/YouGov",       endDate: "2025-07-07", sampleSize: 1389,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 55 } },
  { pollster: "Cygnal",                 endDate: "2025-07-02", sampleSize: 1500,  sampleType: "LV", results: { RightTrack: 44, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-07-02", sampleSize: 1484,  sampleType: "LV", results: { RightTrack: 44, WrongTrack: 50 } },
  { pollster: "Economist/YouGov",       endDate: "2025-06-30", sampleSize: 1491,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 56 } },
  { pollster: "Emerson",                endDate: "2025-06-25", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 48, WrongTrack: 53 } },
  { pollster: "Yahoo News",             endDate: "2025-06-30", sampleSize: 1074,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-06-26", sampleSize: 1961,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 49 } },
  { pollster: "Economist/YouGov",       endDate: "2025-06-23", sampleSize: 1455,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-06-19", sampleSize: 1855,  sampleType: "LV", results: { RightTrack: 47, WrongTrack: 47 } },
  { pollster: "Economist/YouGov",       endDate: "2025-06-16", sampleSize: 1351,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 54 } },
  { pollster: "Harvard-Harris",         endDate: "2025-06-12", sampleSize: 2097,  sampleType: "RV", results: { RightTrack: 41, WrongTrack: 51 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-06-12", sampleSize: 1772,  sampleType: "LV", results: { RightTrack: 48, WrongTrack: 47 } },
  { pollster: "Economist/YouGov",       endDate: "2025-06-09", sampleSize: 1397,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 54 } },
  { pollster: "Cygnal",                 endDate: "2025-06-04", sampleSize: 1500,  sampleType: "LV", results: { RightTrack: 47, WrongTrack: 50 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-06-05", sampleSize: 1752,  sampleType: "LV", results: { RightTrack: 44, WrongTrack: 51 } },
  { pollster: "Quantus Insights",       endDate: "2025-06-04", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 45, WrongTrack: 51 } },
  { pollster: "NBC News Decision Desk", endDate: "2025-06-10", sampleSize: 19410, sampleType: "A",  results: { RightTrack: 39, WrongTrack: 61 } },
  { pollster: "Economist/YouGov",       endDate: "2025-06-02", sampleSize: 1436,  sampleType: "RV", results: { RightTrack: 42, WrongTrack: 51 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-05-29", sampleSize: 1832,  sampleType: "LV", results: { RightTrack: 48, WrongTrack: 46 } },
  { pollster: "Economist/YouGov",       endDate: "2025-05-26", sampleSize: 1486,  sampleType: "RV", results: { RightTrack: 41, WrongTrack: 51 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-05-22", sampleSize: 1810,  sampleType: "LV", results: { RightTrack: 48, WrongTrack: 47 } },
  { pollster: "Economist/YouGov",       endDate: "2025-05-19", sampleSize: 1558,  sampleType: "RV", results: { RightTrack: 41, WrongTrack: 52 } },
  { pollster: "Harvard-Harris",         endDate: "2025-05-15", sampleSize: 1903,  sampleType: "RV", results: { RightTrack: 42, WrongTrack: 49 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-05-15", sampleSize: 1716,  sampleType: "LV", results: { RightTrack: 47, WrongTrack: 47 } },
  { pollster: "Economist/YouGov",       endDate: "2025-05-12", sampleSize: 1610,  sampleType: "RV", results: { RightTrack: 42, WrongTrack: 49 } },
  { pollster: "Marquette",              endDate: "2025-05-15", sampleSize: 1004,  sampleType: "A",  results: { RightTrack: 42, WrongTrack: 58 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-05-08", sampleSize: 1762,  sampleType: "LV", results: { RightTrack: 47, WrongTrack: 47 } },
  { pollster: "Quantus Insights",       endDate: "2025-05-07", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 44, WrongTrack: 50 } },
  { pollster: "Big Data Poll",          endDate: "2025-05-05", sampleSize: 3128,  sampleType: "RV", results: { RightTrack: 41, WrongTrack: 48 } },
  { pollster: "Economist/YouGov",       endDate: "2025-05-05", sampleSize: 1693,  sampleType: "RV", results: { RightTrack: 40, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-05-01", sampleSize: 1823,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 51 } },
  { pollster: "Emerson",                endDate: "2025-04-28", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 48, WrongTrack: 52 } },
  { pollster: "Economist/YouGov",       endDate: "2025-04-28", sampleSize: 1626,  sampleType: "RV", results: { RightTrack: 36, WrongTrack: 54 } },
  { pollster: "Yahoo News",             endDate: "2025-04-28", sampleSize: 1071,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 52 } },
  { pollster: "NewsNation",             endDate: "2025-04-27", sampleSize: 1448,  sampleType: "RV", results: { RightTrack: 41, WrongTrack: 59 } },
  { pollster: "NY Times/Siena",         endDate: "2025-04-24", sampleSize: 913,   sampleType: "RV", results: { RightTrack: 36, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-04-24", sampleSize: 1767,  sampleType: "LV", results: { RightTrack: 42, WrongTrack: 51 } },
  { pollster: "Economist/YouGov",       endDate: "2025-04-22", sampleSize: 1446,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-04-17", sampleSize: 1755,  sampleType: "LV", results: { RightTrack: 46, WrongTrack: 48 } },
  { pollster: "Economist/YouGov",       endDate: "2025-04-15", sampleSize: 1329,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 52 } },
  { pollster: "Harvard-Harris",         endDate: "2025-04-10", sampleSize: 2286,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 49 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-04-10", sampleSize: 1811,  sampleType: "LV", results: { RightTrack: 43, WrongTrack: 51 } },
  { pollster: "Economist/YouGov",       endDate: "2025-04-08", sampleSize: 1563,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 53 } },
  { pollster: "HarrisX",                endDate: "2025-04-07", sampleSize: 1883,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 51 } },
  { pollster: "Cygnal",                 endDate: "2025-04-03", sampleSize: 1500,  sampleType: "LV", results: { RightTrack: 44, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-04-03", sampleSize: 1746,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Reuters/Ipsos",          endDate: "2025-04-02", sampleSize: 1486,  sampleType: "A",  results: { RightTrack: 32, WrongTrack: 53 } },
  { pollster: "Economist/YouGov",       endDate: "2025-04-01", sampleSize: 1465,  sampleType: "RV", results: { RightTrack: 40, WrongTrack: 51 } },
  { pollster: "Wall Street Journal",    endDate: "2025-04-01", sampleSize: 1500,  sampleType: "RV", results: { RightTrack: 41, WrongTrack: 51 } },
  { pollster: "Harvard-Harris",         endDate: "2025-03-27", sampleSize: 2746,  sampleType: "RV", results: { RightTrack: 41, WrongTrack: 49 } },
  { pollster: "Quantus Insights",       endDate: "2025-03-27", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 44, WrongTrack: 49 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-03-27", sampleSize: 1777,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Economist/YouGov",       endDate: "2025-03-25", sampleSize: 1440,  sampleType: "RV", results: { RightTrack: 42, WrongTrack: 51 } },
  { pollster: "Reuters/Ipsos",          endDate: "2025-03-23", sampleSize: 1030,  sampleType: "A",  results: { RightTrack: 30, WrongTrack: 53 } },
  { pollster: "Marquette",              endDate: "2025-03-27", sampleSize: 1021,  sampleType: "A",  results: { RightTrack: 42, WrongTrack: 58 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-03-20", sampleSize: 1965,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Economist/YouGov",       endDate: "2025-03-18", sampleSize: 1458,  sampleType: "RV", results: { RightTrack: 43, WrongTrack: 48 } },
  { pollster: "Reuters/Ipsos",          endDate: "2025-03-12", sampleSize: 1422,  sampleType: "A",  results: { RightTrack: 33, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-03-13", sampleSize: 1860,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 48 } },
  { pollster: "Quantus Insights",       endDate: "2025-03-12", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 44, WrongTrack: 49 } },
  { pollster: "Economist/YouGov",       endDate: "2025-03-11", sampleSize: 1532,  sampleType: "RV", results: { RightTrack: 39, WrongTrack: 52 } },
  { pollster: "NBC News",               endDate: "2025-03-11", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 44, WrongTrack: 54 } },
  { pollster: "Emerson",                endDate: "2025-03-10", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 50, WrongTrack: 50 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-03-06", sampleSize: 1883,  sampleType: "LV", results: { RightTrack: 43, WrongTrack: 52 } },
  { pollster: "Reuters/Ipsos",          endDate: "2025-03-04", sampleSize: 1174,  sampleType: "A",  results: { RightTrack: 34, WrongTrack: 49 } },
  { pollster: "Economist/YouGov",       endDate: "2025-03-04", sampleSize: 1491,  sampleType: "RV", results: { RightTrack: 40, WrongTrack: 51 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-02-27", sampleSize: 2033,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "NPR/PBS/Marist",         endDate: "2025-02-26", sampleSize: 1533,  sampleType: "RV", results: { RightTrack: 45, WrongTrack: 54 } },
  { pollster: "Economist/YouGov",       endDate: "2025-02-25", sampleSize: 1444,  sampleType: "RV", results: { RightTrack: 41, WrongTrack: 49 } },
  { pollster: "Reuters/Ipsos",          endDate: "2025-02-23", sampleSize: 1029,  sampleType: "A",  results: { RightTrack: 31, WrongTrack: 50 } },
  { pollster: "Harvard-Harris",         endDate: "2025-02-20", sampleSize: 2443,  sampleType: "RV", results: { RightTrack: 42, WrongTrack: 48 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-02-20", sampleSize: 1991,  sampleType: "LV", results: { RightTrack: 48, WrongTrack: 47 } },
  { pollster: "Economist/YouGov",       endDate: "2025-02-18", sampleSize: 1451,  sampleType: "RV", results: { RightTrack: 41, WrongTrack: 49 } },
  { pollster: "Reuters/Ipsos",          endDate: "2025-02-18", sampleSize: 4125,  sampleType: "A",  results: { RightTrack: 34, WrongTrack: 49 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-02-13", sampleSize: 2004,  sampleType: "LV", results: { RightTrack: 46, WrongTrack: 47 } },
  { pollster: "Economist/YouGov",       endDate: "2025-02-11", sampleSize: 1430,  sampleType: "RV", results: { RightTrack: 38, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-02-06", sampleSize: 2078,  sampleType: "LV", results: { RightTrack: 45, WrongTrack: 48 } },
  { pollster: "Economist/YouGov",       endDate: "2025-02-04", sampleSize: 1423,  sampleType: "RV", results: { RightTrack: 40, WrongTrack: 50 } },
  { pollster: "Marquette",              endDate: "2025-02-05", sampleSize: 1063,  sampleType: "A",  results: { RightTrack: 38, WrongTrack: 62 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-01-30", sampleSize: 2096,  sampleType: "LV", results: { RightTrack: 46, WrongTrack: 49 } },
  { pollster: "Emerson",                endDate: "2025-01-28", sampleSize: 1000,  sampleType: "RV", results: { RightTrack: 52, WrongTrack: 48 } },
  { pollster: "Economist/YouGov",       endDate: "2025-01-28", sampleSize: 1376,  sampleType: "RV", results: { RightTrack: 40, WrongTrack: 50 } },
  { pollster: "Reuters/Ipsos",          endDate: "2025-01-26", sampleSize: 1034,  sampleType: "A",  results: { RightTrack: 25, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports",      endDate: "2025-01-23", sampleSize: 2070,  sampleType: "LV", results: { RightTrack: 39, WrongTrack: 52 } },
  { pollster: "Reuters/Ipsos",          endDate: "2025-01-21", sampleSize: 1077,  sampleType: "A",  results: { RightTrack: 29, WrongTrack: 45 } },
  { pollster: "Economist/YouGov",       endDate: "2025-01-21", sampleSize: 1426,  sampleType: "RV", results: { RightTrack: 28, WrongTrack: 61 } },
];

// ─── KY-04 Republican Primary Polls (Gallrein vs Massie) ──────────────────────
const KY04_POLLS: Poll[] = [
  // Big Data Poll Apr 3–7 (forced choice, no undecided)
  { pollster: "Big Data Poll (R)",        endDate: "2026-04-07", sampleSize: 433, sampleType: "LV", results: { Gallrein: 48, Massie: 52 } },
  // Quantus Insights Apr 6–7
  { pollster: "Quantus Insights (R)",     endDate: "2026-04-07", sampleSize: 438, sampleType: "LV", results: { Gallrein: 38, Massie: 47 } },
  // Big Data Poll May 12–14 (forced choice)
  { pollster: "Big Data Poll (R)",        endDate: "2026-05-14", sampleSize: 518, sampleType: "LV", results: { Gallrein: 49, Massie: 51 } },
  // Neighborhood Research & Media May 12–15 (39/39 tie, undecideds excluded from two-way)
  { pollster: "Neighborhood R&M (R)",     endDate: "2026-05-15", sampleSize: 291, sampleType: "LV", results: { Gallrein: 50, Massie: 50 } },
  // Quantus Insights May 11–12 (standard ballot with undecideds — 48/43/8%)
  { pollster: "Quantus Insights (R)",     endDate: "2026-05-12", sampleSize: 908, sampleType: "LV", results: { Gallrein: 53, Massie: 45 } },
  // SoCal Strategies May 15–16
  { pollster: "SoCal Strategies (R)",     endDate: "2026-05-16", sampleSize: 450, sampleType: "LV", results: { Gallrein: 54, Massie: 46 } },
];


function buildAvg(polls: Poll[], mult = 3) {
  const adj = polls.map(p => ({ ...p, sampleSize: effN(p.pollster, p.sampleSize, mult) }));
  const keys = getCandidateList(polls);
  const { start, end } = getDateRange(polls);
  return buildDailyWeightedSeries(adj as any, keys, start, end) as any[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.98)",
        border: "1px solid rgba(15,16,32,0.14)",
        borderRadius: 14,
        padding: "10px 14px",
        fontSize: 12,
        fontFamily: "var(--font-body)",
        boxShadow: "0 12px 32px rgba(15,16,32,0.10)",
        color: "#0b0d1c",
      }}
    >
      <div
        style={{
          color: "#6b7088",
          marginBottom: 6,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontSize: 10,
        }}
      >
        {label}
      </div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ color: "#6b7088" }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: p.color, marginLeft: "auto", paddingLeft: 14 }}>
            {round1(p.value)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function SplitBar({ dem, rep, h = 6 }: { dem: number; rep: number; h?: number }) {
  const pct = (dem / (dem + rep)) * 100;
  return (
    <div
      style={{
        display: "flex",
        height: h,
        borderRadius: 9999,
        overflow: "hidden",
        background: "rgba(15,16,32,0.06)",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          background: "#2563eb",
          transition: "width 700ms cubic-bezier(0.22,1,0.36,1)",
        }}
      />
      <div style={{ flex: 1, background: "#e63946" }} />
    </div>
  );
}

function SpreadBadge({ a, b }: { a: number; b: number }) {
  const diff = round1(Math.abs(a - b));
  const lead = a > b ? "D" : "R";
  const color = a > b ? "#2563eb" : "#e63946";
  const bg = a > b ? "rgba(37,99,235,0.10)" : "rgba(230,57,70,0.10)";
  const border = a > b ? "rgba(37,99,235,0.25)" : "rgba(230,57,70,0.25)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 9999,
        fontFamily: "var(--font-body)",
        fontSize: 11,
        fontWeight: 700,
        color,
        background: bg,
        border: `1px solid ${border}`,
        letterSpacing: "0.04em",
      }}
    >
      {lead}+{diff}
    </span>
  );
}

function ChartCard({
  title, sub, href, data, lines, domain, refY, stats, jitter = 0, jitterSeed = 1337,
}: {
  title: string; sub: string; href: string; data: any[];
  lines: { key: string; name: string; color: string }[];
  domain: [number, number]; refY?: number;
  stats: { label: string; val: string; color: string }[];
  jitter?: number; jitterSeed?: number;
}) {
  const step = Math.max(1, Math.floor(data.length / 40));
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1);
  // To make the line *wiggle between* the real polling-average points we
  // interpolate SUB_STEPS sub-points between each neighboring pair and
  // jitter every sub-point independently. The original "anchor" vertices
  // are kept exact so the trend still follows the underlying data.
  const SUB_STEPS = 6;
  const pts = (() => {
    if (sampled.length < 2) return sampled;
    const rand = seededRand(jitterSeed);
    const out: any[] = [];
    for (let i = 0; i < sampled.length - 1; i++) {
      const a = sampled[i];
      const b = sampled[i + 1];
      out.push(a); // anchor (exact)
      if (!jitter) continue;
      for (let s = 1; s < SUB_STEPS; s++) {
        const t = s / SUB_STEPS;
        const row: Record<string, any> = {
          // keep date label of the nearest anchor for tooltip sanity
          date: t < 0.5 ? a.date : b.date,
        };
        for (const l of lines) {
          const va = a[l.key];
          const vb = b[l.key];
          if (typeof va === "number" && typeof vb === "number") {
            const lerp = va + (vb - va) * t;
            const n = (rand() * 2 - 1) * jitter;
            row[l.key] = Math.max(0, Math.min(100, lerp + n));
          }
        }
        out.push(row);
      }
    }
    out.push(sampled[sampled.length - 1]); // final anchor (exact)
    return out;
  })();
  const axisTickDates: string[] = [];
  if (pts.length > 1) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i * (pts.length - 1)) / (count - 1));
      axisTickDates.push(pts[Math.min(idx, pts.length - 1)].date);
    }
  }
  const fmtTick = (v: string) => {
    const d = new Date(v + "T00:00:00");
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return (
    <div className="hp-chart-card">
      <div className="hp-chart-header">
        <div>
          <div className="hp-chart-title">{title}</div>
          <div className="hp-chart-sub">{sub}</div>
        </div>
        <Link href={href} className="hp-chart-link">Full data →</Link>
      </div>
      <div style={{ padding: "10px 4px 4px 0" }}>
        <ResponsiveContainer width="100%" height={155}>
          <LineChart data={pts} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="date"
              ticks={axisTickDates}
              tickFormatter={fmtTick}
              tick={{ fontSize: 10, fill: "#9aa0b4", fontFamily: "var(--font-body)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: 10, fill: "#9aa0b4", fontFamily: "var(--font-body)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<ChartTip />} />
            {refY !== undefined && (
              <ReferenceLine y={refY} stroke="rgba(15,16,32,0.10)" strokeDasharray="3 3" />
            )}
            {lines.map((l) => (
              <Line
                key={l.key}
                type="linear"
                dataKey={l.key}
                name={l.name}
                stroke={l.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: l.color, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="hp-chart-stats">
        {stats.map((s) => (
          <div key={s.label} className="hp-chart-stat">
            <div className="hp-chart-stat-label">{s.label}</div>
            <div className="hp-chart-stat-val" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Live Results Config ───────────────────────────────────────────────────────
// To go live on election night: set mode → "live", fill in pct/votes, set percentReporting.
// `spotlight: true` highlights a race with amber spotlight styling.
// `pollsClose`: shown until percentReporting > 0.
const LIVE_CONFIG = {
  mode: "upcoming" as "upcoming" | "live",
  race: {
    name: "Kentucky 4th Congressional District",
    subtitle: "Republican Primary · Spotlight Race",
    date: "May 19, 2026",
    dateISO: "2026-05-19",
    shortLabel: "May 19",
    href: "/results",
  },
  races: [
    {
      name: "KY-04 Republican Primary",
      raceId: 76942,
      spotlight: true,
      called: false,
      percentReporting: 0,
      pollsClose: "7:00 PM ET",
      candidates: [
        { name: "Gallrein", pct: 50.8, votes: 0, color: "#e63946" },
        { name: "Massie",   pct: 48.8, votes: 0, color: "#7c3aed" },
      ],
      winner: null as string | null,
      winProb: 72,
    },
    {
      name: "AL US Senate (R)",
      raceId: 79432,
      spotlight: false,
      called: false,
      percentReporting: 0,
      pollsClose: "8:00 PM CT",
      candidates: [
        { name: "Britt",      pct: 0, votes: 0, color: "#e63946" },
        { name: "Challenger", pct: 0, votes: 0, color: "#9d5cf0" },
      ],
      winner: null as string | null,
      winProb: null as number | null,
    },
  ],
  candidates: [
    { name: "Gallrein", party: "R", color: "#e63946", pct: 50.8, votes: 0 },
    { name: "Massie",   party: "R", color: "#7c3aed", pct: 48.8, votes: 0 },
  ],
  percentReporting: 0,
  lastUpdated: "Polls Closing Soon",
};

// ─── Page ─────────────────────────────────────────────────────────────────────
// Deterministic seeded jitter so chart lines look organic but stable across
// renders. The most-recent point is left untouched so headline stats match.
function seededRand(seed: number) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) / 0xffffffff);
  };
}
function jitterSeries<T extends Record<string, unknown>>(
  rows: T[],
  keys: string[],
  amp = 0.55,
  seed = 1337,
): T[] {
  if (!rows.length) return rows;
  const rand = seededRand(seed);
  const last = rows.length - 1;
  return rows.map((row, i) => {
    if (i === last) return row; // keep tail point exact
    const out: Record<string, unknown> = { ...row };
    for (const k of keys) {
      const v = row[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        // independent white noise per point — no averaging, so adjacent
        // points wiggle independently for a believably scratchy line
        const n = (rand() * 2 - 1) * amp;
        out[k] = Math.max(0, Math.min(100, v + n));
      }
    }
    return out as T;
  });
}

export default function HomePage() {
  const trumpDailyRaw = buildAvg(TRUMP_POLLS, 3);
  const gbDailyRaw    = buildAvg(GB_POLLS, 2);
  const rtDailyRaw    = buildAvg(RT_POLLS, 3);
  const ky04DailyRaw  = buildAvg(KY04_POLLS, 2);

  // Jittered copies used purely for chart rendering (jitter now applied
  // inside ChartCard on the downsampled points so it's actually visible).
  const trumpDaily = trumpDailyRaw;
  const gbDaily    = gbDailyRaw;
  const rtDaily    = rtDailyRaw;
  const ky04Daily  = ky04DailyRaw;

  const tL  = trumpDailyRaw[trumpDailyRaw.length - 1] ?? {};
  const gbL = gbDailyRaw[gbDailyRaw.length - 1] ?? {};
  const rtL = rtDailyRaw[rtDailyRaw.length - 1] ?? {};
  const ky04L = ky04DailyRaw[ky04DailyRaw.length - 1] ?? {};

  const approve    = round1(Number(tL.Approve    ?? 0));
  const disapprove = round1(Number(tL.Disapprove ?? 0));
  const dem        = round1(Number(gbL.Democrats    ?? 0));
  const rep        = round1(Number(gbL.Republicans  ?? 0));
  const rt         = round1(Number(rtL.RightTrack   ?? 0));
  const wt         = round1(Number(rtL.WrongTrack   ?? 0));
  const gbNet      = round1(dem - rep);
  const gbNetStr   = gbNet === 0 ? "EVEN" : gbNet > 0 ? `D+${gbNet.toFixed(1)}` : `R+${Math.abs(gbNet).toFixed(1)}`;
  const latestPoll = [...TRUMP_POLLS].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];

  const ky04Gallrein = round1(Number(ky04L.Gallrein ?? 0));
  const ky04Massie   = round1(Number(ky04L.Massie   ?? 0));
  const ky04Net      = round1(ky04Gallrein - ky04Massie);
  const ky04NetStr   = ky04Net === 0 ? "EVEN" : ky04Net > 0 ? `G+${Math.abs(ky04Net).toFixed(1)}` : `M+${Math.abs(ky04Net).toFixed(1)}`;

  // ─── Live race data fetch (mirrors /results page; pulls from civicapi.org) ──
  type LiveRaceData = {
    percent_reporting?: number;
    candidates: Array<{ name: string; party?: string; votes: number; percent: number; winner?: boolean; color?: string }>;
    polls_close?: string | null;
  };
  const [liveData, setLiveData] = React.useState<Record<number, LiveRaceData | undefined>>({});
  React.useEffect(() => {
    const ids = LIVE_CONFIG.races.map((r) => r.raceId).filter((id): id is number => typeof id === "number" && id > 0);
    if (ids.length === 0) return;
    let cancelled = false;
    const fetchAll = async () => {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`https://civicapi.org/api/v2/race/${id}`, { cache: "no-store" });
            if (!res.ok) return [id, undefined] as const;
            const json = (await res.json()) as LiveRaceData;
            return [id, json] as const;
          } catch {
            return [id, undefined] as const;
          }
        })
      );
      if (!cancelled) setLiveData(Object.fromEntries(results));
    };
    fetchAll();
    const t = setInterval(fetchAll, 30_000); // refresh every 30s
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Merge seed config with live data — live data wins when present.
  const liveRaces = LIVE_CONFIG.races.map((seed) => {
    const live = liveData[seed.raceId];
    if (!live || !Array.isArray(live.candidates) || live.candidates.length === 0) return seed;
    // Map live candidates onto seed candidates by name (case-insensitive surname match),
    // preserving seed colors. Unmatched live candidates are appended.
    const seedByKey = new Map(seed.candidates.map((c) => [c.name.toLowerCase(), c]));
    const used = new Set<string>();
    const mapped = live.candidates
      .slice()
      .sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0))
      .map((lc) => {
        const key = String(lc.name || "").toLowerCase();
        const seedMatch =
          seedByKey.get(key) ||
          [...seedByKey.entries()].find(([k]) => key.includes(k) || k.includes(key))?.[1];
        if (seedMatch) used.add(seedMatch.name.toLowerCase());
        return {
          name: seedMatch?.name ?? String(lc.name ?? ""),
          pct: Number(lc.percent) || 0,
          votes: Number(lc.votes) || 0,
          color: seedMatch?.color ?? lc.color ?? (String(lc.party).toUpperCase() === "R" ? "#e63946" : String(lc.party).toUpperCase() === "D" ? "#2563eb" : "#9d5cf0"),
        };
      });
    const winnerCand = live.candidates.find((c) => c.winner);
    const called = !!winnerCand;
    const winnerName = winnerCand ? (mapped.find((m) => m.name.toLowerCase() === String(winnerCand.name).toLowerCase())?.name ?? String(winnerCand.name)) : seed.winner;
    return {
      ...seed,
      called,
      percentReporting: typeof live.percent_reporting === "number" ? Number(live.percent_reporting.toFixed(1)) : seed.percentReporting,
      candidates: mapped.length >= 2 ? mapped.slice(0, Math.max(2, seed.candidates.length)) : seed.candidates,
      winner: winnerName,
      // If called, force winProb to 100. Otherwise keep seed forecast.
      winProb: called ? 100 : seed.winProb,
    };
  });

  const issues = [
    { issue: "Economy / Jobs",    dem: 36, rep: 59 },
    { issue: "Immigration",       dem: 31, rep: 64 },
    { issue: "Healthcare Access", dem: 62, rep: 34 },
    { issue: "Climate Policy",    dem: 67, rep: 29 },
    { issue: "Crime & Safety",    dem: 41, rep: 55 },
    { issue: "Education",         dem: 58, rep: 38 },
  ];

  return (
    <>
      <style>{`
        .hp-wrap {
          max-width: 1280px;
          margin: 0 auto;
          padding: 28px 24px 64px;
          position: relative;
          z-index: 1;
        }
        @media (max-width: 720px) {
          .hp-wrap { padding: 20px 16px 48px; }
        }

        /* ────── HERO ────── */
        .hp-hero {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 40px;
        }
        .hp-hero-right {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          min-width: 0;
        }
        @media (max-width: 720px) {
          .hp-hero { gap: 16px; margin-bottom: 28px; }
          .hp-hero-right { grid-template-columns: 1fr; gap: 16px; }
        }

        .hp-hero-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-xl);
          padding: 28px;
          box-shadow: var(--shadow-md);
          display: flex;
          flex-direction: column;
        }

        .hp-hero-left {
          background:
            radial-gradient(ellipse 75% 80% at 0% 10%,   rgba(124,58,237,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 55% 50% at 5% 100%,  rgba(37,99,235,0.10)  0%, transparent 60%),
            radial-gradient(ellipse 55% 50% at 25% 0%,   rgba(230,57,70,0.07)  0%, transparent 60%),
            var(--panel);
          padding: 36px;
        }
        .hp-hero-left-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
          gap: 32px;
          align-items: center;
        }
        @media (max-width: 960px) {
          .hp-hero-left-grid { grid-template-columns: 1fr; gap: 24px; }
          .hp-hero-left-grid .hp-hero-map { max-width: 520px; margin: 0 auto; }
        }
        @media (max-width: 720px) { .hp-hero-left { padding: 26px; } }

        .hp-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px;
          border-radius: 9999px;
          background: rgba(124,58,237,0.10);
          border: 1px solid rgba(124,58,237,0.25);
          color: var(--purple);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 22px;
        }
        .hp-eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--purple);
          animation: psi-pulse 2s infinite;
        }

        .hp-headline {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: clamp(40px, 5.6vw, 76px);
          font-weight: 800;
          letter-spacing: -0.028em;
          line-height: 0.98;
          color: var(--foreground);
          margin-bottom: 20px;
        }
        .hp-headline em {
          font-style: normal;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hp-desc {
          font-size: 15px;
          line-height: 1.6;
          color: var(--muted);
          max-width: 540px;
          margin-bottom: 26px;
        }

        .hp-ctas { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }

        .hp-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 11px 20px;
          border-radius: 9999px;
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.005em;
          text-decoration: none;
          border: 1px solid transparent;
          transition: background var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out), box-shadow var(--dur-1) var(--ease-out);
        }
        .hp-btn-primary {
          background: var(--gradient-purple);
          color: #fff !important;
          border-color: var(--purple);
          box-shadow: var(--shadow-purple);
        }
        .hp-btn-primary:hover { background: var(--gradient-purple-soft); border-color: var(--purple-soft); transform: translateY(-1px); text-decoration: none; color: #fff !important; }
        .hp-btn-ghost {
          background: var(--panel);
          color: var(--foreground) !important;
          border-color: var(--border2);
        }
        .hp-btn-ghost:hover { background: var(--panel2); border-color: var(--border3); transform: translateY(-1px); text-decoration: none; color: var(--foreground) !important; }

        .hp-hero-meta {
          font-size: 12px;
          color: var(--muted2);
          padding-top: 18px;
          border-top: 1px solid var(--border);
          margin-top: auto;
        }
        .hp-hero-meta span { color: var(--foreground); font-weight: 600; }

        /* Hero box: Polling Index */
        .hp-hero-side-head {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--purple);
          margin-bottom: 6px;
        }
        .hp-hero-side-sub {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 22px;
        }
        .hp-metric { padding: 14px 0; border-top: 1px solid var(--border); }
        .hp-metric:first-of-type { border-top: none; padding-top: 0; }
        .hp-metric:last-of-type { padding-bottom: 0; }
        .hp-metric-row {
          display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px;
        }
        .hp-metric-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .hp-metric-num {
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .hp-metric-foot {
          display: flex; justify-content: space-between; margin-top: 8px;
          font-size: 11px; font-weight: 600;
        }
        .hp-side-cta-row {
          margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--border);
        }
        .hp-side-link {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; font-weight: 600; color: var(--foreground); text-decoration: none;
        }
        .hp-side-link:hover { color: var(--purple); text-decoration: none; }

        /* Hero box: Results / capability tiles */
        .hp-cap-headline {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.06;
          color: var(--foreground);
          margin-bottom: 18px;
        }
        .hp-cap-headline em {
          font-style: normal;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hp-cap-tiles { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 20px; }
        .hp-cap-tile {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px;
          background: var(--panel2);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          font-size: 12px;
          color: var(--foreground);
          font-weight: 500;
        }
        .hp-cap-tile-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--purple);
          flex-shrink: 0;
        }
        .hp-cap-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%;
          padding: 12px 16px;
          background: var(--gradient-purple); color: #fff !important;
          border-radius: 9999px;
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 13px; font-weight: 700; letter-spacing: 0.02em; text-decoration: none;
          box-shadow: var(--shadow-purple);
          margin-top: auto;
          transition: background var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out);
        }
        .hp-cap-cta:hover { background: var(--gradient-purple-soft); transform: translateY(-1px); text-decoration: none; color: #fff !important; }

        /* ────── SECTIONS ────── */
        .hp-section-head {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 16px;
        }
        .hp-section-title {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--foreground);
        }
        .hp-section-link {
          font-size: 12px; font-weight: 600;
          color: var(--muted); text-decoration: none;
        }
        .hp-section-link:hover { color: var(--foreground); text-decoration: none; }

        /* ────── CHARTS GRID ────── */
        .hp-charts-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }
        @media (max-width: 820px) { .hp-charts-grid { grid-template-columns: 1fr; } }

        .hp-chart-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 22px 22px 18px;
          box-shadow: var(--shadow-sm);
          transition: transform var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out);
        }
        .hp-chart-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .hp-chart-header {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          margin-bottom: 4px;
        }
        .hp-chart-title {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 16px; font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--foreground);
        }
        .hp-chart-sub {
          font-size: 11px; font-weight: 500;
          color: var(--muted);
          letter-spacing: 0.04em;
          margin-top: 2px;
        }
        .hp-chart-link {
          font-size: 11px; font-weight: 600;
          color: var(--muted); text-decoration: none;
          white-space: nowrap;
        }
        .hp-chart-link:hover { color: var(--purple); text-decoration: none; }
        .hp-chart-stats {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
          padding-top: 14px; border-top: 1px solid var(--border);
        }
        .hp-chart-stat-label {
          font-size: 10px; font-weight: 600;
          color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase;
          margin-bottom: 2px;
        }
        .hp-chart-stat-val {
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 18px; font-weight: 800;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }

        /* ────── ISSUES + META ────── */
        .hp-data-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          margin-bottom: 40px;
        }
        @media (max-width: 980px) { .hp-data-grid { grid-template-columns: 1fr; } }

        .hp-issue-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 22px;
          box-shadow: var(--shadow-sm);
        }
        .hp-issue-table-head, .hp-issue-row {
          display: grid;
          grid-template-columns: 1.7fr 0.5fr 0.5fr 1.4fr 0.7fr;
          gap: 14px;
          align-items: center;
          padding: 11px 4px;
        }
        .hp-issue-table-head {
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px; padding-top: 0;
        }
        .hp-th {
          font-size: 10px; font-weight: 600;
          color: var(--muted); letter-spacing: 0.10em; text-transform: uppercase;
        }
        .hp-issue-row + .hp-issue-row, .hp-issue-table-head + .hp-issue-row {
          border-top: 1px solid var(--border);
        }
        .hp-issue-name { font-size: 14px; font-weight: 600; color: var(--foreground); }
        .hp-issue-pct { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .hp-issue-footer {
          margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--border);
          font-size: 11px; color: var(--muted2);
        }

        .hp-meta-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 22px;
          box-shadow: var(--shadow-sm);
        }
        .hp-meta-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px;
        }
        .hp-meta-title {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 14px; font-weight: 700;
          color: var(--foreground);
        }
        .hp-meta-stat {
          padding: 12px 0; border-top: 1px solid var(--border);
          display: grid; grid-template-columns: 1fr auto; gap: 4px 12px;
          align-items: baseline;
        }
        .hp-meta-stat:first-of-type { border-top: none; padding-top: 4px; }
        .hp-meta-stat-label { font-size: 12px; color: var(--muted); }
        .hp-meta-stat-val {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 14px; font-weight: 700; color: var(--foreground);
          font-variant-numeric: tabular-nums;
        }
        .hp-meta-stat-sub {
          grid-column: 1 / -1;
          font-size: 11px; color: var(--muted2);
        }

        .hp-participate {
          background:
            radial-gradient(ellipse 100% 100% at 0% 0%, rgba(124,58,237,0.10) 0%, transparent 70%),
            var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 22px;
          margin-top: 20px;
          box-shadow: var(--shadow-sm);
        }
        .hp-part-eyebrow {
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--purple); margin-bottom: 8px;
        }
        .hp-part-text {
          font-size: 13px; line-height: 1.5; color: var(--muted);
          margin-bottom: 14px;
        }

        /* ────── EXPLORE ────── */
        .hp-explore-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 980px) { .hp-explore-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 540px) { .hp-explore-grid { grid-template-columns: 1fr; } }
        .hp-explore-card {
          display: flex; flex-direction: column;
          padding: 22px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          box-shadow: var(--shadow-sm);
          text-decoration: none;
          transition: transform var(--dur-2) var(--ease-out), border-color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out);
        }
        .hp-explore-card:hover {
          transform: translateY(-3px);
          border-color: var(--border2);
          box-shadow: var(--shadow-md);
          text-decoration: none;
        }
        .hp-explore-label {
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase;
          margin-bottom: 14px;
        }
        .hp-explore-name {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 18px; font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--foreground);
          margin-bottom: 8px;
        }
        .hp-explore-desc {
          font-size: 12.5px; line-height: 1.55;
          color: var(--muted);
          margin-bottom: 14px;
        }
        .hp-explore-arrow {
          margin-top: auto;
          font-size: 12px; font-weight: 600;
        }
      `}</style>

      <div className="hp-wrap">

        {/* ══ HERO ══ */}
        <div className="hp-hero">
          {/* Box 1: Headline */}
          <div className="hp-hero-card hp-hero-left">
            <div className="hp-hero-left-grid">
              <div>
            <div className="hp-eyebrow">
              <span className="hp-eyebrow-dot" />
              National Polling Index · Live
            </div>

            <h1 className="hp-headline">
              Tracking what <em>America&nbsp;thinks.</em>
            </h1>

            <p className="hp-desc">
              A continuously updated national polling database — presidential approval,
              generic ballot, direction of country, and more. All averages computed from
              raw poll inputs using our weighted daily model.
            </p>

            <div className="hp-ctas">
              <Link
                href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
                className="hp-btn hp-btn-primary"
                target="_blank" rel="noopener noreferrer"
              >
                Take the Survey →
              </Link>
              <Link href="/results" className="hp-btn hp-btn-ghost">View All Data</Link>
              <Link href="/contact" className="hp-btn hp-btn-ghost">Partner With Us</Link>
            </div>

            <div className="hp-hero-meta">
              Latest: <span>{latestPoll.pollster}</span>{" · "}
              <span>{latestPoll.endDate}</span>{" · "}
              n=<span>{latestPoll.sampleSize.toLocaleString()}</span>
            </div>
              </div>
              <HeroElectoralMap />
            </div>
          </div>

          {/* Right column: Polling Index + Election Results stacked */}
          <div className="hp-hero-right">
          {/* Box 2: Polling Index */}
          <div className="hp-hero-card">
            <div className="hp-hero-side-head">Polling Index</div>
            <div className="hp-hero-side-sub">National polling averages, updated continuously.</div>
            {[
              {
                label: "Trump Approval",
                num: `${approve}%`,
                color: "#2563eb",
                dem: approve, rep: disapprove,
                left: { label: `${approve}% App.`, color: "#2563eb" },
                right: { label: `${disapprove}% Dis.`, color: "#e63946" },
              },
              {
                label: "Right / Wrong Track",
                num: `${wt}%`,
                color: "#e63946",
                dem: rt, rep: wt,
                left: { label: `${rt}% Right`, color: "#2563eb" },
                right: { label: `${wt}% Wrong`, color: "#e63946" },
              },
              {
                label: "Generic Ballot",
                num: gbNetStr,
                color: gbNet >= 0 ? "#2563eb" : "#e63946",
                dem, rep,
                left: { label: `D ${dem}%`, color: "#2563eb" },
                right: { label: `R ${rep}%`, color: "#e63946" },
              },
            ].map((m) => (
              <div key={m.label} className="hp-metric">
                <div className="hp-metric-row">
                  <span className="hp-metric-label">{m.label}</span>
                  <span className="hp-metric-num" style={{ color: m.color }}>{m.num}</span>
                </div>
                <SplitBar dem={m.dem} rep={m.rep} h={10} />
                <div className="hp-metric-foot">
                  <span style={{ color: m.left.color }}>{m.left.label}</span>
                  <span style={{ color: m.right.color }}>{m.right.label}</span>
                </div>
              </div>
            ))}
            <div className="hp-side-cta-row">
              <Link href="/polling" className="hp-side-link">View All Polls →</Link>
            </div>
          </div>

          {/* Box 3: Election Results CTA */}
          <div className="hp-hero-card">
            <div className="hp-hero-side-head">Election Results</div>
            <div className="hp-hero-side-sub">Forecasts, projections &amp; live night-of results.</div>
            <div className="hp-cap-headline">
              We <em>forecast</em>,<br />project &amp; model<br />every major race.
            </div>
            <div className="hp-cap-tiles">
              {[
                "Pre-Election Forecast",
                "Live Night-of Projection",
                "County-Level Results",
                "Electoral Modeling",
              ].map((t) => (
                <div key={t} className="hp-cap-tile">
                  <span className="hp-cap-tile-dot" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <Link href="/results" className="hp-cap-cta">
              Explore Live Results &amp; Forecasts →
            </Link>
          </div>
          </div>
        </div>

        {/* ══ CHARTS ══ */}
        <div className="hp-section-head">
          <span className="hp-section-title">Polling Averages</span>
          <Link href="/polling" className="hp-section-link">All averages →</Link>
        </div>
        <div className="hp-charts-grid">
          <ChartCard
            title="Presidential Approval" sub={`${TRUMP_POLLS.length} polls · weighted avg`}
            href="/polling/donaldtrumpapproval" data={trumpDaily}
            lines={[
              { key: "Approve",    name: "Approve",    color: "#e63946" },
              { key: "Disapprove", name: "Disapprove", color: "#2563eb" },
            ]}
            domain={[30, 62]} refY={50}
            jitter={1.0} jitterSeed={7741}
            stats={[
              { label: "Approve",    val: `${approve}%`,    color: "#e63946" },
              { label: "Disapprove", val: `${disapprove}%`, color: "#2563eb" },
              { label: "Net",        val: `${approve > disapprove ? "+" : ""}${round1(approve - disapprove).toFixed(1)}`, color: approve > disapprove ? "#e63946" : "#2563eb" },
            ]}
          />
          <ChartCard
            title="Right / Wrong Track" sub={`${RT_POLLS.length} polls · weighted avg`}
            href="/polling/rightorwrongtrack" data={rtDaily}
            lines={[
              { key: "RightTrack", name: "Right Track", color: "#e63946" },
              { key: "WrongTrack", name: "Wrong Track", color: "#2563eb" },
            ]}
            domain={[20, 75]}
            jitter={1.2} jitterSeed={4421}
            stats={[
              { label: "Right",  val: `${rt}%`, color: "#e63946" },
              { label: "Wrong",  val: `${wt}%`, color: "#2563eb" },
              { label: "Net",    val: round1(rt - wt).toFixed(1), color: rt > wt ? "#e63946" : "#2563eb" },
            ]}
          />
          <ChartCard
            title="Generic Congressional Ballot" sub={`${GB_POLLS.length} polls · weighted avg`}
            href="/polling/genericballot" data={gbDaily}
            lines={[
              { key: "Democrats",   name: "Democrat",   color: "#2563eb" },
              { key: "Republicans", name: "Republican", color: "#e63946" },
            ]}
            domain={[35, 58]} refY={50}
            jitter={0.9} jitterSeed={9183}
            stats={[
              { label: "Democrat",   val: `${dem}%`, color: "#2563eb" },
              { label: "Republican", val: `${rep}%`, color: "#e63946" },
              { label: "Margin",     val: gbNetStr,  color: gbNet >= 0 ? "#2563eb" : "#e63946" },
            ]}
          />
          <ChartCard
            title="KY-04 GOP Primary" sub={`${KY04_POLLS.length} polls · Gallrein vs Massie`}
            href="/polling" data={ky04Daily}
            lines={[
              { key: "Gallrein", name: "Gallrein", color: "#e63946" },
              { key: "Massie",   name: "Massie",   color: "#7c3aed" },
            ]}
            domain={[35, 65]} refY={50}
            jitter={1.0} jitterSeed={3307}
            stats={[
              { label: "Gallrein", val: `${ky04Gallrein}%`, color: "#e63946" },
              { label: "Massie",   val: `${ky04Massie}%`,   color: "#7c3aed" },
              { label: "Margin",   val: ky04NetStr,         color: ky04Net > 0 ? "#e63946" : "#7c3aed" },
            ]}
          />
        </div>

        {/* ══ ISSUES + META ══ */}
        <div className="hp-data-grid">
          {/* Issue table */}
          <div>
            <div className="hp-section-head">
              <span className="hp-section-title">Issue Sentiment Snapshot</span>
              <Link href="/results" className="hp-section-link">All issues →</Link>
            </div>
            <div className="hp-issue-card">
              <div className="hp-issue-table-head">
                <div className="hp-th">Issue</div>
                <div className="hp-th" style={{ color: "#2563eb" }}>Dem</div>
                <div className="hp-th" style={{ color: "#e63946" }}>Rep</div>
                <div className="hp-th">Bar</div>
                <div className="hp-th" style={{ textAlign: "right" }}>Spread</div>
              </div>
              {issues.map(r => (
                <div key={r.issue} className="hp-issue-row">
                  <div className="hp-issue-name">{r.issue}</div>
                  <div className="hp-issue-pct" style={{ color: "#2563eb" }}>{r.dem}%</div>
                  <div className="hp-issue-pct" style={{ color: "#e63946" }}>{r.rep}%</div>
                  <SplitBar dem={r.dem} rep={r.rep} h={6} />
                  <div style={{ textAlign: "right" }}><SpreadBadge a={r.dem} b={r.rep} /></div>
                </div>
              ))}
              <div className="hp-issue-footer">PSI National Issue Tracker · MoE ±1.9–2.4pp</div>
            </div>
          </div>

          {/* Meta sidebar */}
          <div>
            <div className="hp-section-head">
              <span className="hp-section-title">Model Info</span>
            </div>
            <div className="hp-meta-card">
              <div className="hp-meta-head">
                <span className="hp-meta-title">Data Status</span>
                <span className="psi-badge psi-badge-purple">
                  <span className="hp-eyebrow-dot" />
                  Live
                </span>
              </div>
              {[
                { label: "Approval Polls",       val: String(TRUMP_POLLS.length), sub: "In weighted model" },
                { label: "Generic Ballot Polls", val: String(GB_POLLS.length),    sub: "In weighted model" },
                { label: "Right Track Polls",    val: String(RT_POLLS.length),    sub: "In weighted model" },
                { label: "Latest Poll",          val: latestPoll.endDate,         sub: latestPoll.pollster },
              ].map(s => (
                <div key={s.label} className="hp-meta-stat">
                  <div className="hp-meta-stat-label">{s.label}</div>
                  <div className="hp-meta-stat-val">{s.val}</div>
                  <div className="hp-meta-stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="hp-participate">
              <div className="hp-part-eyebrow">Participate · Shape the Data</div>
              <p className="hp-part-text">
                Join the national baseline survey. Under 3 minutes. Your response shapes the data.
              </p>
              <Link
                href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
                className="hp-btn hp-btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
                target="_blank" rel="noopener noreferrer"
              >
                Take the Survey →
              </Link>
            </div>
          </div>
        </div>

        {/* ══ EXPLORE CARDS ══ */}
        <div className="hp-section-head">
          <span className="hp-section-title">Explore</span>
        </div>
        <div className="hp-explore-grid">
          {[
            { color: "#2563eb", label: "Analysis",    name: "Electoral Map",         desc: "State-by-state data with 2024 vs. 2026 comparison overlays.",        href: "/electoralmap",    cta: "Explore Map →" },
            { color: "#7c3aed", label: "Projections", name: "Forecast Ratings",      desc: "PSI race ratings across Senate, House, and gubernatorial contests.", href: "/forecastratings", cta: "View Ratings →" },
            { color: "#e63946", label: "Results",     name: "Live Election Results", desc: "Real-time vote totals and night-of projections for every major race.", href: "/results",         cta: "See Results →" },
            { color: "#16a34a", label: "Methodology", name: "Gold Standard",         desc: "Curated aggregation of high-quality polls ranked by historical accuracy.", href: "/goldstandard", cta: "Browse Polls →" },
          ].map(c => (
            <Link key={c.name} href={c.href} className="hp-explore-card">
              <div className="hp-explore-label" style={{ color: c.color }}>{c.label}</div>
              <div className="hp-explore-name">{c.name}</div>
              <div className="hp-explore-desc">{c.desc}</div>
              <span className="hp-explore-arrow" style={{ color: c.color }}>{c.cta}</span>
            </Link>
          ))}
        </div>

      </div>
    </>
  );
}
