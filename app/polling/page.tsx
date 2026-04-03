"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Poll,
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";

// ─── Gold Standard helpers ────────────────────────────────────────────────────
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

function buildAvg(polls: Poll[], mult = 3) {
  const adj = polls.map(p => ({ ...p, sampleSize: effN(p.pollster, p.sampleSize, mult) }));
  const keys = getCandidateList(polls);
  const { start, end } = getDateRange(polls);
  return buildDailyWeightedSeries(adj as any, keys, start, end) as any[];
}

// ─── Chart tooltip ─────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:"#0f0f15",border:"1px solid rgba(255,255,255,0.12)",padding:"12px 16px",
      fontFamily:"ui-monospace,monospace",fontSize:11,boxShadow:"0 8px 32px rgba(0,0,0,.7)",
    }}>
      <div style={{color:"rgba(255,255,255,.3)",marginBottom:8,fontSize:9,letterSpacing:"0.12em",textTransform:"uppercase"}}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0}} />
          <span style={{color:"rgba(255,255,255,.4)",fontSize:10,letterSpacing:"0.06em"}}>{p.name}</span>
          <span style={{fontWeight:700,color:p.color,marginLeft:"auto",paddingLeft:16,fontSize:13}}>{round1(p.value)}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── Split Bar ─────────────────────────────────────────────────────────────────
function SplitBar({ a, b, colorA, colorB, h = 5 }: { a: number; b: number; colorA: string; colorB: string; h?: number }) {
  const pct = (a / (a + b)) * 100;
  return (
    <div style={{display:"flex",height:h,overflow:"hidden",background:"rgba(255,255,255,.06)"}}>
      <div style={{width:`${pct}%`,background:colorA,transition:"width 700ms"}} />
      <div style={{flex:1,background:colorB}} />
    </div>
  );
}

// ─── Poll Table ───────────────────────────────────────────────────────────────
function PollTable({ polls, keys }: { polls: Poll[]; keys: { key: string; name: string; color: string }[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...polls].sort((a, b) => b.endDate.localeCompare(a.endDate));
  const shown = expanded ? sorted : sorted.slice(0, 6);
  const hidden = sorted.length - 6;

  return (
    <div className="pt-wrap">
      <div style={{overflowX:"auto"}}>
        <table className="pt-table">
          <thead>
            <tr>
              <th className="pt-th">Pollster</th>
              <th className="pt-th pt-right">Date</th>
              <th className="pt-th pt-right">Sample</th>
              <th className="pt-th pt-right">Type</th>
              {keys.map(k => (
                <th key={k.key} className="pt-th pt-right" style={{ color: k.color }}>{k.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((p, i) => (
              <tr key={i} className="pt-row">
                <td className="pt-td">{p.pollster}</td>
                <td className="pt-td pt-right pt-muted">{p.endDate}</td>
                <td className="pt-td pt-right pt-muted">{p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "—"}</td>
                <td className="pt-td pt-right pt-muted">{p.sampleType}</td>
                {keys.map(k => (
                  <td key={k.key} className="pt-td pt-right" style={{ color: k.color, fontWeight: 600 }}>
                    {p.results[k.key] !== undefined ? `${round1(Number(p.results[k.key]))}%` : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > 6 && (
        <button className="pt-toggle" onClick={() => setExpanded(e => !e)}>
          {expanded ? `▲  Show less` : `▼  Show ${hidden} more poll${hidden !== 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}

// ─── Large Chart Panel ────────────────────────────────────────────────────────
function LargeChartPanel({
  title, eyebrow, tag, tagColor, href, data, lines, domain, refY, stats, pollCount,
}: {
  title: string; eyebrow: string; tag: string; tagColor: string; href: string; data: any[];
  lines: {key:string;name:string;color:string}[];
  domain:[number,number]; refY?:number;
  stats:{label:string;val:string;color:string}[];
  pollCount:number;
}) {
  const step = Math.max(1, Math.floor(data.length / 80));
  const pts  = data.filter((_,i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="lcp-wrap">
      <div style={{height:3,background:tagColor,flexShrink:0}} />
      <div className="lcp-header">
        <div>
          <div className="lcp-eyebrow">{eyebrow}</div>
          <div className="lcp-title">{title}</div>
          <div className="lcp-meta">{pollCount} polls · weighted daily average</div>
        </div>
        <div className="lcp-header-right">
          <div className="lcp-stats-row">
            {stats.map(s => (
              <div key={s.label} className="lcp-stat">
                <div className="lcp-stat-label">{s.label}</div>
                <div className="lcp-stat-val" style={{color:s.color}}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="lcp-chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pts} margin={{top:8,right:24,left:-16,bottom:4}}>
            <XAxis
              dataKey="date"
              tick={{fontSize:9,fill:"rgba(255,255,255,.2)",fontFamily:"ui-monospace,monospace"}}
              tickLine={false} axisLine={false} interval="preserveStartEnd"
            />
            <YAxis
              domain={domain}
              tick={{fontSize:9,fill:"rgba(255,255,255,.2)",fontFamily:"ui-monospace,monospace"}}
              tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`}
            />
            <Tooltip content={<ChartTip />} />
            {refY !== undefined && (
              <ReferenceLine y={refY} stroke="rgba(255,255,255,.08)" strokeDasharray="4 4" />
            )}
            {lines.map(l => (
              <Line
                key={l.key} type="monotone" dataKey={l.key} name={l.name}
                stroke={l.color} strokeWidth={2.5} dot={false}
                activeDot={{r:4,fill:l.color,strokeWidth:0}}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="lcp-legend">
        {lines.map(l => (
          <div key={l.key} className="lcp-legend-item">
            <div style={{width:24,height:2.5,background:l.color,borderRadius:1}} />
            <span style={{color:l.color}}>{l.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PollingDashboardPage() {
  const trumpDaily = buildAvg(TRUMP_POLLS, 3);
  const gbDaily    = buildAvg(GB_POLLS, 2);
  const rtDaily    = buildAvg(RT_POLLS, 3);

  const tL  = trumpDaily[trumpDaily.length - 1] ?? {};
  const gbL = gbDaily[gbDaily.length - 1] ?? {};
  const rtL = rtDaily[rtDaily.length - 1] ?? {};

  const approve    = round1(Number(tL.Approve    ?? 0));
  const disapprove = round1(Number(tL.Disapprove ?? 0));
  const dem        = round1(Number(gbL.Democrats    ?? 0));
  const rep        = round1(Number(gbL.Republicans  ?? 0));
  const rt         = round1(Number(rtL.RightTrack   ?? 0));
  const wt         = round1(Number(rtL.WrongTrack   ?? 0));
  const approvalNet = round1(approve - disapprove);
  const gbNet      = round1(dem - rep);
  const rtNet      = round1(rt - wt);

  const gbNetStr  = gbNet === 0 ? "EVEN" : gbNet > 0 ? `D+${gbNet.toFixed(1)}` : `R+${Math.abs(gbNet).toFixed(1)}`;
  const rtNetStr  = rtNet === 0 ? "EVEN" : rtNet > 0 ? `+${rtNet.toFixed(1)}` : `${rtNet.toFixed(1)}`;
  const apNetStr  = approvalNet === 0 ? "EVEN" : approvalNet > 0 ? `+${approvalNet.toFixed(1)}` : `${approvalNet.toFixed(1)}`;

  const latestPoll = [...TRUMP_POLLS].sort((a,b) => b.endDate.localeCompare(a.endDate))[0];

  const approvalKeys = [
    { key: "Approve",    name: "Approve",    color: "#4ade80" },
    { key: "Disapprove", name: "Disapprove", color: "#ef4444" },
  ];
  const gbKeys = [
    { key: "Democrats",   name: "Democrats",   color: "#5b8fd4" },
    { key: "Republicans", name: "Republicans", color: "#ef4444" },
  ];
  const rtKeys = [
    { key: "RightTrack", name: "Right Track", color: "#4ade80" },
    { key: "WrongTrack", name: "Wrong Track", color: "#ef4444" },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="pd-root">

        {/* ══ HERO ══ */}
        <div className="pd-hero">
          <div className="pd-hero-stripe" />
          <div className="pd-hero-inner">
            <div className="pd-hero-left">
              <div className="pd-hero-eyebrow">
                <span className="pd-live-dot" />
                <span>Public Sentiment Institute · Live Tracking</span>
              </div>
              <h1 className="pd-hero-title">National Polling<br /><em>Dashboard</em></h1>
              <p className="pd-hero-desc">
                All three national tracking averages — presidential approval, generic ballot,
                and direction of country. Weighted daily model with recency decay and Gold Standard upweighting.
              </p>
              <div className="pd-hero-badges">
                <span className="pd-badge pd-badge-live"><span className="pd-live-dot-sm"/>LIVE</span>
                <span className="pd-badge">GOLD STANDARD ×2–3</span>
                <span className="pd-badge">√N · RECENCY · LV/RV/A</span>
                <span className="pd-badge" style={{color:"rgba(255,255,255,.25)"}}>Latest: {latestPoll.pollster} · {latestPoll.endDate}</span>
              </div>
            </div>

            <div className="pd-hero-metrics">
              {[
                {
                  label:"Trump Approval", primary:`${approve}%`, primaryColor:"#4ade80",
                  secondary:apNetStr, secondaryColor:approvalNet>=0?"#4ade80":"#ef4444",
                  secondaryLabel:"Net", a:approve, b:disapprove, colorA:"#4ade80", colorB:"#ef4444",
                  subLeft:`${approve}% App.`, subRight:`${disapprove}% Dis.`, href:"/polling/",
                },
                {
                  label:"Generic Ballot", primary:gbNetStr, primaryColor:gbNet>=0?"#5b8fd4":"#ef4444",
                  secondary:`D ${dem}% / R ${rep}%`, secondaryColor:"rgba(255,255,255,.35)",
                  secondaryLabel:"Split", a:dem, b:rep, colorA:"#5b8fd4", colorB:"#ef4444",
                  subLeft:`D ${dem}%`, subRight:`R ${rep}%`, href:"/polling/",
                },
                {
                  label:"Right / Wrong Track", primary:`${wt}%`, primaryColor:"#ef4444",
                  secondary:rtNetStr, secondaryColor:rtNet>=0?"#4ade80":"#ef4444",
                  secondaryLabel:"Spread", a:rt, b:wt, colorA:"#4ade80", colorB:"#ef4444",
                  subLeft:`${rt}% Right`, subRight:`${wt}% Wrong`, href:"/polling/",
                },
              ].map(m => (
                <Link key={m.label} href={m.href} className="pd-metric-card">
                  <div className="pd-metric-label">{m.label}</div>
                  <div className="pd-metric-primary" style={{color:m.primaryColor}}>{m.primary}</div>
                  <SplitBar a={m.a} b={m.b} colorA={m.colorA} colorB={m.colorB} h={4} />
                  <div className="pd-metric-sub-row">
                    <span style={{color:m.colorA,fontSize:9}}>{m.subLeft}</span>
                    <span style={{color:m.colorB,fontSize:9}}>{m.subRight}</span>
                  </div>
                  <div className="pd-metric-net-row">
                    <span className="pd-metric-net-label">{m.secondaryLabel}</span>
                    <span className="pd-metric-net-val" style={{color:m.secondaryColor}}>{m.secondary}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ══ APPROVAL CHART + TABLE ══ */}
        <LargeChartPanel
          title="Donald Trump Job Approval Rating"
          eyebrow="47th President of the United States"
          tag="Approval" tagColor="#4ade80"
          href="/polling/donaldtrumpapproval"
          data={trumpDaily} lines={approvalKeys}
          domain={[30,65]} refY={50}
          stats={[
            {label:"Approve",    val:`${approve}%`,    color:"#4ade80"},
            {label:"Disapprove", val:`${disapprove}%`, color:"#ef4444"},
            {label:"Net",        val:apNetStr,          color:approvalNet>=0?"#4ade80":"#ef4444"},
            {label:"Polls",      val:`${TRUMP_POLLS.length}`, color:"rgba(255,255,255,.3)"},
          ]}
          pollCount={TRUMP_POLLS.length}
        />
        <PollTable polls={TRUMP_POLLS} keys={approvalKeys} />

        {/* ══ GENERIC BALLOT CHART + TABLE ══ */}
        <LargeChartPanel
          title="2026 National Generic Ballot"
          eyebrow="2026 Midterm Elections · U.S. House of Representatives"
          tag="2026 Midterms" tagColor="#a78bfa"
          href="/polling/genericballot"
          data={gbDaily} lines={gbKeys}
          domain={[35,58]} refY={50}
          stats={[
            {label:"Democrat",   val:`${dem}%`, color:"#5b8fd4"},
            {label:"Republican", val:`${rep}%`, color:"#ef4444"},
            {label:"Margin",     val:gbNetStr,  color:gbNet>=0?"#5b8fd4":"#ef4444"},
            {label:"Polls",      val:`${GB_POLLS.length}`, color:"rgba(255,255,255,.3)"},
          ]}
          pollCount={GB_POLLS.length}
        />
        <PollTable polls={GB_POLLS} keys={gbKeys} />

        {/* ══ RIGHT/WRONG TRACK CHART + TABLE ══ */}
        <LargeChartPanel
          title="Right Track / Wrong Track"
          eyebrow="National Sentiment · Direction of the Country"
          tag="Direction" tagColor="#f59e0b"
          href="/polling/rightorwrongtrack"
          data={rtDaily} lines={rtKeys}
          domain={[20,75]}
          stats={[
            {label:"Right",  val:`${rt}%`, color:"#4ade80"},
            {label:"Wrong",  val:`${wt}%`, color:"#ef4444"},
            {label:"Spread", val:rtNetStr, color:rtNet>=0?"#4ade80":"#ef4444"},
            {label:"Polls",  val:`${RT_POLLS.length}`, color:"rgba(255,255,255,.3)"},
          ]}
          pollCount={RT_POLLS.length}
        />
        <PollTable polls={RT_POLLS} keys={rtKeys} />

        {/* ══ FOOTER ══ */}
        <div className="pd-footer">
          <span>PSI · All averages: documented weighting · recency decay · sample size adjustment</span>
          <span style={{color:"rgba(255,255,255,.15)"}}>Methodology on file</span>
        </div>

      </div>
    </>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');

  body { background: #070709 !important; }

  .pd-root {
    --bg:          #070709;
    --bg2:         #0b0b0f;
    --panel:       #0f0f15;
    --border:      rgba(255,255,255,0.09);
    --border2:     rgba(255,255,255,0.15);
    --muted:       rgba(240,240,245,0.62);
    --muted2:      rgba(240,240,245,0.40);
    --muted3:      rgba(240,240,245,0.22);
    --purple:      #7c3aed;
    --purple-soft: #a78bfa;
    max-width: 1320px;
    margin: 0 auto;
    padding: 28px 28px 72px;
    font-family: 'DM Mono', ui-monospace, monospace;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  @media(max-width:768px) { .pd-root { padding: 16px 14px 56px; } }

  /* ── HERO ── */
  .pd-hero {
    border: 1px solid rgba(255,255,255,.07);
    background: #0f0f15;
    margin-bottom: 28px;
    overflow: hidden;
  }
  .pd-hero-stripe {
    height: 3px;
    background: linear-gradient(90deg, #4ade80 0%, #4ade80 33%, #a78bfa 33%, #a78bfa 66%, #ef4444 66%, #ef4444 100%);
  }
  .pd-hero-inner {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
  @media(max-width:960px) { .pd-hero-inner { grid-template-columns: 1fr; } }

  .pd-hero-left {
    padding: 40px 44px 36px;
    border-right: 1px solid rgba(255,255,255,.06);
  }
  @media(max-width:768px) { .pd-hero-left { padding: 24px 20px; } }

  .pd-hero-eyebrow {
    display: flex; align-items: center; gap: 8px;
    font-size: 8.5px; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase;
    color: rgba(255,255,255,.3); margin-bottom: 18px;
  }
  .pd-live-dot {
    width: 5px; height: 5px; border-radius: 50%; background: #4ade80; flex-shrink: 0;
    box-shadow: 0 0 6px rgba(74,222,128,.6);
    animation: pd-pulse 1.8s ease-in-out infinite;
  }
  @keyframes pd-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  .pd-hero-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(44px,5.5vw,80px);
    letter-spacing: 0.03em; line-height: 0.92;
    color: #fff; margin: 0 0 16px;
  }
  .pd-hero-title em { font-style: normal; color: #c5a55a; }
  .pd-hero-desc {
    font-size: 10px; letter-spacing: 0.08em; line-height: 1.85;
    color: rgba(255,255,255,.3); max-width: 460px; margin-bottom: 22px;
  }
  .pd-hero-badges { display: flex; flex-wrap: wrap; gap: 6px; }
  .pd-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px; border: 1px solid rgba(255,255,255,.1);
    background: rgba(255,255,255,.03);
    font-size: 7.5px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(255,255,255,.3);
  }
  .pd-badge-live { border-color: rgba(74,222,128,.3); background: rgba(74,222,128,.07); color: #4ade80; }
  .pd-live-dot-sm {
    width: 5px; height: 5px; border-radius: 50%; background: #4ade80;
    animation: pd-pulse 1.8s ease-in-out infinite; display: inline-block;
  }

  /* HERO METRICS */
  .pd-hero-metrics { display: flex; flex-direction: column; gap: 0; background: #0d0d12; }
  .pd-metric-card {
    display: flex; flex-direction: column; gap: 0;
    padding: 22px 26px;
    border-bottom: 1px solid rgba(255,255,255,.05);
    text-decoration: none; transition: background 120ms;
  }
  .pd-metric-card:last-child { border-bottom: none; }
  .pd-metric-card:hover { background: rgba(255,255,255,.02); text-decoration: none; }
  .pd-metric-label {
    font-size: 7.5px; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase;
    color: rgba(255,255,255,.25); margin-bottom: 6px;
  }
  .pd-metric-primary {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 42px; letter-spacing: 0.03em; line-height: 1; margin-bottom: 8px;
  }
  .pd-metric-sub-row {
    display: flex; justify-content: space-between;
    margin-top: 5px; font-size: 8.5px; font-weight: 500; letter-spacing: 0.08em;
  }
  .pd-metric-net-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.04);
  }
  .pd-metric-net-label {
    font-size: 7px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,.2);
  }
  .pd-metric-net-val { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; }

  /* ── LARGE CHART PANEL ── */
  .lcp-wrap {
    border: 1px solid rgba(255,255,255,.09);
    border-bottom: none;
    background: #0f0f15;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .lcp-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 20px;
    padding: 20px 24px 16px;
    border-bottom: 1px solid rgba(255,255,255,.06);
    background: #0b0b0f;
  }
  .lcp-eyebrow {
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--purple-soft, #a78bfa); margin-bottom: 6px;
  }
  .lcp-title {
    font-size: 13px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase;
    color: rgba(255,255,255,.8); margin-bottom: 3px;
  }
  .lcp-meta { font-size: 8px; color: rgba(255,255,255,.22); letter-spacing: 0.08em; }
  .lcp-header-right {
    display: flex; flex-direction: column; align-items: flex-end; gap: 12px; flex-shrink: 0;
  }
  .lcp-stats-row {
    display: flex; gap: 0;
    border: 1px solid rgba(255,255,255,.07);
    background: rgba(255,255,255,.02);
  }
  .lcp-stat {
    padding: 10px 16px;
    border-right: 1px solid rgba(255,255,255,.06);
    min-width: 80px;
  }
  .lcp-stat:last-child { border-right: none; }
  .lcp-stat-label {
    font-size: 7px; letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(255,255,255,.2); margin-bottom: 4px;
  }
  .lcp-stat-val {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 24px; letter-spacing: 0.04em; line-height: 1;
  }
  .lcp-chart-area {
    height: 280px; padding: 16px 8px 8px; background: #0f0f15;
  }
  .lcp-legend {
    display: flex; gap: 24px; padding: 12px 24px;
    border-top: 1px solid rgba(255,255,255,.05);
    background: #0b0b0f;
  }
  .lcp-legend-item {
    display: flex; align-items: center; gap: 8px;
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: rgba(255,255,255,.35);
  }

  /* ── POLL TABLE ── */
  .pt-wrap {
    border: 1px solid rgba(255,255,255,.07);
    border-top: none;
    background: #0a0a10;
    margin-bottom: 28px;
  }
  .pt-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    font-family: 'DM Mono', ui-monospace, monospace;
    letter-spacing: 0.05em;
  }
  .pt-th {
    padding: 8px 14px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 7.5px;
    font-weight: 500;
    color: rgba(255,255,255,.25);
    background: #0d0d12;
    border-bottom: 1px solid rgba(255,255,255,.06);
    white-space: nowrap;
    text-align: left;
  }
  .pt-right { text-align: right !important; }
  .pt-td {
    padding: 7px 14px;
    color: rgba(255,255,255,.7);
    border-bottom: 1px solid rgba(255,255,255,.035);
    white-space: nowrap;
  }
  .pt-muted { color: rgba(255,255,255,.28) !important; font-weight: 400; }
  .pt-row:last-child td { border-bottom: none; }
  .pt-row:hover td { background: rgba(255,255,255,.02); }
  .pt-toggle {
    display: block;
    width: 100%;
    padding: 10px;
    background: transparent;
    border: none;
    border-top: 1px solid rgba(255,255,255,.06);
    color: rgba(255,255,255,.28);
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 120ms, background 120ms;
  }
  .pt-toggle:hover { color: rgba(255,255,255,.55); background: rgba(255,255,255,.02); }

  /* ── FOOTER ── */
  .pd-footer {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
    padding-top: 16px; border-top: 1px solid rgba(255,255,255,.06);
    font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(255,255,255,.18);
  }
`;