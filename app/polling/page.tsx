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
  "Big Data Poll", "AtlasIntel","SoCalStrategies",
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

{ pollster: "Emerson", endDate: "2026-04-26", sampleSize: 1000, sampleType: "LV", results: { Approve: 40, Disapprove: 56 } },
{ pollster: "Morning Consult", endDate: "2026-04-27", sampleSize: 2201, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "InsiderAdvantage", endDate: "2026-04-27", sampleSize: 800, sampleType: "LV", results: { Approve: 44, Disapprove: 49 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-04-27", sampleSize: 1014, sampleType: "RV", results: { Approve: 37, Disapprove: 62 } },
{ pollster: "Economist/YouGov", endDate: "2026-04-27", sampleSize: 1647, sampleType: "RV", results: { Approve: 40, Disapprove: 57 } },
{ pollster: "Harvard-Harris", endDate: "2026-04-26", sampleSize: 2745, sampleType: "RV", results: { Approve: 42, Disapprove: 53 } },
{ pollster: "Rasmussen Reports", endDate: "2026-04-27", sampleSize: 1500, sampleType: "LV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Quantus Insights", endDate: "2026-04-23", sampleSize: 1452, sampleType: "LV", results: { Approve: 43, Disapprove: 56 } },
{ pollster: "FOX News", endDate: "2026-04-20", sampleSize: 1001, sampleType: "RV", results: { Approve: 42, Disapprove: 58 } },
{ pollster: "Morning Consult", endDate: "2026-04-20", sampleSize: 2203, sampleType: "RV", results: { Approve: 44, Disapprove: 53 } },
{ pollster: "Economist/YouGov", endDate: "2026-04-20", sampleSize: 1553, sampleType: "RV", results: { Approve: 41, Disapprove: 56 } },
{ pollster: "Echelon Insights", endDate: "2026-04-20", sampleSize: 1012, sampleType: "LV", results: { Approve: 41, Disapprove: 57 } },
{ pollster: "RMG Research", endDate: "2026-04-23", sampleSize: 3000, sampleType: "RV", results: { Approve: 42, Disapprove: 55 } },
{ pollster: "AP/NORC", endDate: "2026-04-20", sampleSize: 2596, sampleType: "A", results: { Approve: 33, Disapprove: 67 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-04-20", sampleSize: 4557, sampleType: "A", results: { Approve: 36, Disapprove: 62 } },
{ pollster: "CNBC", endDate: "2026-04-19", sampleSize: 1000, sampleType: "RV", results: { Approve: 40, Disapprove: 58 } },

// ── Rasmussen Reports ──────────────────────────────────────────────────────────
{ pollster: "Rasmussen Reports", endDate: "2026-04-14", sampleSize: 1500, sampleType: "LV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Rasmussen Reports", endDate: "2026-04-09", sampleSize: 1500, sampleType: "LV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Rasmussen Reports", endDate: "2026-04-01", sampleSize: 1500, sampleType: "LV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Rasmussen Reports", endDate: "2026-03-16", sampleSize: 1500, sampleType: "LV", results: { Approve: 44, Disapprove: 54 } },
{ pollster: "Rasmussen Reports", endDate: "2026-03-09", sampleSize: 1500, sampleType: "LV", results: { Approve: 46, Disapprove: 53 } },
{ pollster: "Rasmussen Reports", endDate: "2026-03-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Rasmussen Reports", endDate: "2026-02-26", sampleSize: 1500, sampleType: "LV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Rasmussen Reports", endDate: "2026-02-23", sampleSize: 1500, sampleType: "LV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Rasmussen Reports", endDate: "2026-02-16", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2026-02-05", sampleSize: 1500, sampleType: "LV", results: { Approve: 41, Disapprove: 57 } },
{ pollster: "Rasmussen Reports", endDate: "2025-12-09", sampleSize: 1500, sampleType: "LV", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2025-12-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Rasmussen Reports", endDate: "2025-11-25", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2025-11-18", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2025-11-11", sampleSize: 1500, sampleType: "LV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Rasmussen Reports", endDate: "2025-11-04", sampleSize: 1500, sampleType: "LV", results: { Approve: 46, Disapprove: 53 } },
{ pollster: "Rasmussen Reports", endDate: "2025-10-28", sampleSize: 1500, sampleType: "LV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Rasmussen Reports", endDate: "2025-10-21", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Rasmussen Reports", endDate: "2025-10-14", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Rasmussen Reports", endDate: "2025-10-07", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Rasmussen Reports", endDate: "2025-09-30", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "Rasmussen Reports", endDate: "2025-09-23", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Rasmussen Reports", endDate: "2025-09-10", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2025-09-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2025-08-26", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 50 } },
{ pollster: "Rasmussen Reports", endDate: "2025-08-19", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 49 } },
{ pollster: "Rasmussen Reports", endDate: "2025-08-12", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 49 } },
{ pollster: "Rasmussen Reports", endDate: "2025-08-05", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2025-07-29", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2025-07-22", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Rasmussen Reports", endDate: "2025-07-15", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Rasmussen Reports", endDate: "2025-07-08", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 49 } },
{ pollster: "Rasmussen Reports", endDate: "2025-06-30", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "Rasmussen Reports", endDate: "2025-06-23", sampleSize: 1500, sampleType: "LV", results: { Approve: 52, Disapprove: 47 } },
{ pollster: "Rasmussen Reports", endDate: "2025-06-16", sampleSize: 1500, sampleType: "LV", results: { Approve: 52, Disapprove: 47 } },
{ pollster: "Rasmussen Reports", endDate: "2025-06-09", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "Rasmussen Reports", endDate: "2025-05-29", sampleSize: 1500, sampleType: "LV", results: { Approve: 53, Disapprove: 46 } },
{ pollster: "Rasmussen Reports", endDate: "2025-05-22", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Rasmussen Reports", endDate: "2025-05-15", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "Rasmussen Reports", endDate: "2025-05-08", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "Rasmussen Reports", endDate: "2025-05-01", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Rasmussen Reports", endDate: "2025-04-24", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Rasmussen Reports", endDate: "2025-04-17", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "Rasmussen Reports", endDate: "2025-04-10", sampleSize: 1500, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Rasmussen Reports", endDate: "2025-04-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 49, Disapprove: 50 } },
{ pollster: "Rasmussen Reports", endDate: "2025-03-27", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "Rasmussen Reports", endDate: "2025-03-20", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "Rasmussen Reports", endDate: "2025-03-13", sampleSize: 1500, sampleType: "LV", results: { Approve: 52, Disapprove: 47 } },
{ pollster: "Rasmussen Reports", endDate: "2025-03-06", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "Rasmussen Reports", endDate: "2025-02-27", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "Rasmussen Reports", endDate: "2025-02-20", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "Rasmussen Reports", endDate: "2025-02-13", sampleSize: 1500, sampleType: "LV", results: { Approve: 54, Disapprove: 44 } },
{ pollster: "Rasmussen Reports", endDate: "2025-02-06", sampleSize: 1500, sampleType: "LV", results: { Approve: 51, Disapprove: 45 } },
{ pollster: "Rasmussen Reports", endDate: "2025-01-30", sampleSize: 1500, sampleType: "LV", results: { Approve: 52, Disapprove: 45 } },
{ pollster: "Rasmussen Reports", endDate: "2025-01-23", sampleSize: 1667, sampleType: "LV", results: { Approve: 53, Disapprove: 42 } },
// ── Emerson ────────────────────────────────────────────────────────────────────
{ pollster: "Emerson", endDate: "2026-03-17", sampleSize: 1000, sampleType: "LV", results: { Approve: 42, Disapprove: 51 } },
{ pollster: "Emerson", endDate: "2026-02-22", sampleSize: 1000, sampleType: "LV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Emerson", endDate: "2025-12-15", sampleSize: 1000, sampleType: "RV", results: { Approve: 41, Disapprove: 50 } },
{ pollster: "Emerson", endDate: "2025-11-21", sampleSize: 1000, sampleType: "RV", results: { Approve: 45, Disapprove: 55 } },
{ pollster: "Emerson", endDate: "2025-11-04", sampleSize: 1000, sampleType: "RV", results: { Approve: 41, Disapprove: 49 } },
{ pollster: "Emerson", endDate: "2025-10-14", sampleSize: 1000, sampleType: "RV", results: { Approve: 45, Disapprove: 48 } },
{ pollster: "Emerson", endDate: "2025-08-26", sampleSize: 1000, sampleType: "RV", results: { Approve: 45, Disapprove: 47 } },
{ pollster: "Emerson", endDate: "2025-07-22", sampleSize: 1400, sampleType: "RV", results: { Approve: 46, Disapprove: 47 } },
{ pollster: "Emerson", endDate: "2025-06-25", sampleSize: 1000, sampleType: "RV", results: { Approve: 45, Disapprove: 46 } },
{ pollster: "Emerson", endDate: "2025-04-28", sampleSize: 1000, sampleType: "RV", results: { Approve: 45, Disapprove: 45 } },
{ pollster: "Emerson", endDate: "2025-03-10", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 45 } },
{ pollster: "Emerson", endDate: "2025-03-03", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 43 } },
{ pollster: "Emerson", endDate: "2025-02-17", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 42 } },
{ pollster: "Emerson", endDate: "2025-01-28", sampleSize: 1000, sampleType: "RV", results: { Approve: 49, Disapprove: 41 } },
// ── RMG Research ───────────────────────────────────────────────────────────────
{ pollster: "RMG Research", endDate: "2026-04-09", sampleSize: 4000, sampleType: "RV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "RMG Research", endDate: "2026-04-02", sampleSize: 3000, sampleType: "RV", results: { Approve: 40, Disapprove: 58 } },
{ pollster: "RMG Research*", endDate: "2026-03-26", sampleSize: 3000, sampleType: "RV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "RMG Research*", endDate: "2026-03-19", sampleSize: 3000, sampleType: "RV", results: { Approve: 46, Disapprove: 53 } },
{ pollster: "RMG Research", endDate: "2026-03-12", sampleSize: 3000, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "RMG Research*", endDate: "2026-02-12", sampleSize: 3000, sampleType: "RV", results: { Approve: 47, Disapprove: 52 } },
{ pollster: "RMG Research", endDate: "2026-02-19", sampleSize: 3000, sampleType: "RV", results: { Approve: 47, Disapprove: 52 } },
{ pollster: "RMG Research*", endDate: "2026-01-28", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2026-01-21", sampleSize: 3000, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2026-01-14", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2026-01-08", sampleSize: 2000, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2025-12-18", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "RMG Research*", endDate: "2025-12-11", sampleSize: 3000, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2025-12-04", sampleSize: 3000, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "RMG Research*", endDate: "2025-11-20", sampleSize: 3000, sampleType: "RV", results: { Approve: 46, Disapprove: 53 } },
{ pollster: "RMG Research*", endDate: "2025-11-13", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 50 } },
{ pollster: "RMG Research*", endDate: "2025-11-06", sampleSize: 3000, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2025-10-30", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 49 } },
{ pollster: "RMG Research*", endDate: "2025-10-22", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "RMG Research*", endDate: "2025-10-16", sampleSize: 3000, sampleType: "RV", results: { Approve: 52, Disapprove: 47 } },
{ pollster: "RMG Research*", endDate: "2025-10-09", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-10-01", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-09-24", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "RMG Research*", endDate: "2025-09-17", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "RMG Research*", endDate: "2025-09-11", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-09-03", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-08-28", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "RMG Research*", endDate: "2025-08-21", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-08-14", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "RMG Research*", endDate: "2025-08-07", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "RMG Research*", endDate: "2025-07-31", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-07-24", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-07-16", sampleSize: 3000, sampleType: "RV", results: { Approve: 52, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-07-10", sampleSize: 3000, sampleType: "RV", results: { Approve: 50, Disapprove: 47 } },
{ pollster: "RMG Research*", endDate: "2025-06-26", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "RMG Research*", endDate: "2025-06-19", sampleSize: 3000, sampleType: "RV", results: { Approve: 53, Disapprove: 46 } },
{ pollster: "RMG Research*", endDate: "2025-06-12", sampleSize: 3000, sampleType: "RV", results: { Approve: 52, Disapprove: 46 } },
{ pollster: "RMG Research*", endDate: "2025-06-03", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 46 } },
{ pollster: "RMG Research*", endDate: "2025-05-29", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 50 } },
{ pollster: "RMG Research*", endDate: "2025-05-21", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "RMG Research*", endDate: "2025-05-15", sampleSize: 3000, sampleType: "RV", results: { Approve: 52, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-05-08", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 49 } },
{ pollster: "RMG Research*", endDate: "2025-05-01", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-04-24", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-04-16", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "RMG Research*", endDate: "2025-04-10", sampleSize: 3000, sampleType: "RV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "RMG Research*", endDate: "2025-04-03", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 47 } },
{ pollster: "RMG Research*", endDate: "2025-03-27", sampleSize: 3000, sampleType: "RV", results: { Approve: 52, Disapprove: 45 } },
{ pollster: "RMG Research*", endDate: "2025-03-19", sampleSize: 3000, sampleType: "RV", results: { Approve: 53, Disapprove: 45 } },
{ pollster: "RMG Research*", endDate: "2025-03-13", sampleSize: 3000, sampleType: "RV", results: { Approve: 54, Disapprove: 44 } },
{ pollster: "RMG Research*", endDate: "2025-02-28", sampleSize: 3000, sampleType: "RV", results: { Approve: 53, Disapprove: 45 } },
{ pollster: "RMG Research*", endDate: "2025-02-21", sampleSize: 3000, sampleType: "RV", results: { Approve: 53, Disapprove: 44 } },
{ pollster: "RMG Research*", endDate: "2025-02-14", sampleSize: 3000, sampleType: "RV", results: { Approve: 55, Disapprove: 43 } },
{ pollster: "RMG Research*", endDate: "2025-02-06", sampleSize: 3000, sampleType: "RV", results: { Approve: 51, Disapprove: 45 } },
{ pollster: "RMG Research*", endDate: "2025-01-31", sampleSize: 4000, sampleType: "RV", results: { Approve: 53, Disapprove: 43 } },
{ pollster: "RMG Research*", endDate: "2025-01-23", sampleSize: 3000, sampleType: "RV", results: { Approve: 57, Disapprove: 39 } },
// ── Big Data Poll ──────────────────────────────────────────────────────────────
{ pollster: "Big Data Poll", endDate: "2026-03-24", sampleSize: 3003, sampleType: "RV", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Big Data Poll", endDate: "2026-02-18", sampleSize: 2012, sampleType: "RV", results: { Approve: 42, Disapprove: 55 } },
{ pollster: "Big Data Poll", endDate: "2026-01-24", sampleSize: 3280, sampleType: "RV", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "Big Data Poll", endDate: "2025-12-28", sampleSize: 3412, sampleType: "LV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Big Data Poll", endDate: "2025-12-12", sampleSize: 3004, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Big Data Poll", endDate: "2025-12-01", sampleSize: 2008, sampleType: "RV", results: { Approve: 45, Disapprove: 51 } },
{ pollster: "Big Data Poll", endDate: "2025-11-21", sampleSize: 2006, sampleType: "RV", results: { Approve: 45, Disapprove: 50 } },
{ pollster: "Big Data Poll", endDate: "2025-10-28", sampleSize: 2984, sampleType: "RV", results: { Approve: 45, Disapprove: 51 } },
{ pollster: "Big Data Poll", endDate: "2025-07-14", sampleSize: 3022, sampleType: "RV", results: { Approve: 48, Disapprove: 49 } },
{ pollster: "Big Data Poll", endDate: "2025-05-05", sampleSize: 3128, sampleType: "RV", results: { Approve: 48, Disapprove: 47 } },
{ pollster: "Big Data Poll", endDate: "2025-01-22", sampleSize: 2979, sampleType: "RV", results: { Approve: 56, Disapprove: 37 } },
// ── InsiderAdvantage ───────────────────────────────────────────────────────────
{ pollster: "InsiderAdvantage", endDate: "2026-02-18", sampleSize: 800, sampleType: "LV", results: { Approve: 50, Disapprove: 46 } },
{ pollster: "InsiderAdvantage", endDate: "2026-02-01", sampleSize: 1000, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "InsiderAdvantage", endDate: "2025-12-20", sampleSize: 800, sampleType: "LV", results: { Approve: 50, Disapprove: 41 } },
{ pollster: "InsiderAdvantage", endDate: "2025-11-21", sampleSize: 800, sampleType: "LV", results: { Approve: 44, Disapprove: 49 } },
{ pollster: "InsiderAdvantage", endDate: "2025-09-30", sampleSize: 800, sampleType: "LV", results: { Approve: 52, Disapprove: 46 } },
{ pollster: "InsiderAdvantage", endDate: "2025-08-17", sampleSize: 1000, sampleType: "LV", results: { Approve: 54, Disapprove: 44 } },
{ pollster: "InsiderAdvantage", endDate: "2025-06-16", sampleSize: 1000, sampleType: "LV", results: { Approve: 54, Disapprove: 44 } },
{ pollster: "InsiderAdvantage", endDate: "2025-05-19", sampleSize: 1000, sampleType: "LV", results: { Approve: 55, Disapprove: 44 } },
{ pollster: "InsiderAdvantage", endDate: "2025-02-01", sampleSize: 1000, sampleType: "LV", results: { Approve: 50, Disapprove: 49 } },
{ pollster: "InsiderAdvantage", endDate: "2025-01-20", sampleSize: 800, sampleType: "RV", results: { Approve: 56, Disapprove: 39 } },
// ── Trafalgar Group ────────────────────────────────────────────────────────────
{ pollster: "Trafalgar Group", endDate: "2026-02-25", sampleSize: 1084, sampleType: "LV", results: { Approve: 51, Disapprove: 48 } },
{ pollster: "Trafalgar Group", endDate: "2025-12-27", sampleSize: 1098, sampleType: "LV", results: { Approve: 50, Disapprove: 45 } },
{ pollster: "Trafalgar Group", endDate: "2025-06-20", sampleSize: 1085, sampleType: "LV", results: { Approve: 54, Disapprove: 45 } },
{ pollster: "Trafalgar Group", endDate: "2025-06-01", sampleSize: 1098, sampleType: "LV", results: { Approve: 54, Disapprove: 46 } },
{ pollster: "Trafalgar/InsiderAdvantage", endDate: "2025-07-23", sampleSize: 1200, sampleType: "LV", results: { Approve: 50, Disapprove: 48 } },
{ pollster: "Trafalgar/InsiderAdvantage", endDate: "2025-05-01", sampleSize: 1200, sampleType: "LV", results: { Approve: 46, Disapprove: 44 } },
{ pollster: "Trafalgar/InsiderAdvantage", endDate: "2025-03-05", sampleSize: 800, sampleType: "RV", results: { Approve: 50, Disapprove: 45 } },
{ pollster: "Trafalgar/InsiderAdvantage", endDate: "2025-02-09", sampleSize: 1321, sampleType: "RV", results: { Approve: 54, Disapprove: 45 } },
// ── Harvard-Harris ─────────────────────────────────────────────────────────────
{ pollster: "Harvard-Harris", endDate: "2026-03-26", sampleSize: 2009, sampleType: "RV", results: { Approve: 43, Disapprove: 53 } },
{ pollster: "Harvard-Harris", endDate: "2026-02-26", sampleSize: 1999, sampleType: "RV", results: { Approve: 45, Disapprove: 51 } },
{ pollster: "Harvard-Harris", endDate: "2026-01-29", sampleSize: 2000, sampleType: "RV", results: { Approve: 45, Disapprove: 51 } },
{ pollster: "Harvard-Harris", endDate: "2025-12-04", sampleSize: 2204, sampleType: "RV", results: { Approve: 47, Disapprove: 49 } },
{ pollster: "Harvard-Harris", endDate: "2025-11-06", sampleSize: 2000, sampleType: "RV", results: { Approve: 44, Disapprove: 51 } },
{ pollster: "Harvard-Harris", endDate: "2025-10-02", sampleSize: 2413, sampleType: "RV", results: { Approve: 46, Disapprove: 50 } },
{ pollster: "Harvard-Harris", endDate: "2025-08-21", sampleSize: 2025, sampleType: "RV", results: { Approve: 47, Disapprove: 49 } },
{ pollster: "Harvard-Harris", endDate: "2025-07-08", sampleSize: 2044, sampleType: "RV", results: { Approve: 47, Disapprove: 49 } },
{ pollster: "Harvard-Harris", endDate: "2025-06-12", sampleSize: 2097, sampleType: "RV", results: { Approve: 46, Disapprove: 50 } },
{ pollster: "Harvard-Harris", endDate: "2025-05-15", sampleSize: 1903, sampleType: "RV", results: { Approve: 47, Disapprove: 48 } },
{ pollster: "Harvard-Harris", endDate: "2025-04-10", sampleSize: 2286, sampleType: "RV", results: { Approve: 48, Disapprove: 46 } },
{ pollster: "Harvard-Harris", endDate: "2025-03-27", sampleSize: 2746, sampleType: "RV", results: { Approve: 49, Disapprove: 46 } },
{ pollster: "Harvard-Harris", endDate: "2025-02-20", sampleSize: 2443, sampleType: "RV", results: { Approve: 52, Disapprove: 43 } },
// ── Quantus Insights ───────────────────────────────────────────────────────────
{ pollster: "Quantus Insights", endDate: "2026-03-26", sampleSize: 1472, sampleType: "LV", results: { Approve: 42, Disapprove: 57 } },
{ pollster: "Quantus Insights", endDate: "2026-03-18", sampleSize: 1064, sampleType: "LV", results: { Approve: 44, Disapprove: 55 } },
{ pollster: "Quantus Insights", endDate: "2026-03-03", sampleSize: 1624, sampleType: "LV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Quantus Insights", endDate: "2026-02-13", sampleSize: 1515, sampleType: "LV", results: { Approve: 43, Disapprove: 56 } },
{ pollster: "Quantus Insights", endDate: "2026-01-22", sampleSize: 1000, sampleType: "RV", results: { Approve: 44, Disapprove: 52 } },
{ pollster: "Quantus Insights", endDate: "2025-12-16", sampleSize: 1000, sampleType: "RV", results: { Approve: 44, Disapprove: 53 } },
{ pollster: "Quantus Insights", endDate: "2025-12-05", sampleSize: 1000, sampleType: "RV", results: { Approve: 43, Disapprove: 53 } },
{ pollster: "Quantus Insights", endDate: "2025-11-12", sampleSize: 1000, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Quantus Insights", endDate: "2025-10-08", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Quantus Insights", endDate: "2025-09-21", sampleSize: 1000, sampleType: "LV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Quantus Insights", endDate: "2025-08-26", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 51 } },
{ pollster: "Quantus Insights", endDate: "2025-08-13", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Quantus Insights", endDate: "2025-07-23", sampleSize: 1123, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Quantus Insights", endDate: "2025-07-16", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Quantus Insights", endDate: "2025-07-02", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 49 } },
{ pollster: "Quantus Insights", endDate: "2025-06-25", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Quantus Insights", endDate: "2025-06-11", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 49 } },
{ pollster: "Quantus Insights", endDate: "2025-06-04", sampleSize: 1000, sampleType: "RV", results: { Approve: 49, Disapprove: 48 } },
{ pollster: "Quantus Insights", endDate: "2025-05-20", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 48 } },
{ pollster: "Quantus Insights", endDate: "2025-05-07", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 48 } },
{ pollster: "Quantus Insights", endDate: "2025-04-23", sampleSize: 1000, sampleType: "RV", results: { Approve: 48, Disapprove: 50 } },
{ pollster: "Quantus Insights", endDate: "2025-04-09", sampleSize: 1000, sampleType: "RV", results: { Approve: 47, Disapprove: 50 } },
{ pollster: "Quantus Insights", endDate: "2025-03-27", sampleSize: 1000, sampleType: "RV", results: { Approve: 49, Disapprove: 46 } },
{ pollster: "Quantus Insights", endDate: "2025-03-12", sampleSize: 1000, sampleType: "RV", results: { Approve: 50, Disapprove: 47 } },
{ pollster: "Quantus Insights", endDate: "2025-02-26", sampleSize: 1000, sampleType: "RV", results: { Approve: 51, Disapprove: 45 } },
{ pollster: "Quantus Insights", endDate: "2025-02-12", sampleSize: 1000, sampleType: "RV", results: { Approve: 53, Disapprove: 44 } },
{ pollster: "Quantus Insights", endDate: "2025-02-03", sampleSize: 1000, sampleType: "RV", results: { Approve: 52, Disapprove: 45 } },
{ pollster: "Quantus Insights", endDate: "2025-01-23", sampleSize: 1000, sampleType: "RV", results: { Approve: 54, Disapprove: 40 } },
// ── I&I/TIPP ───────────────────────────────────────────────────────────────────
{ pollster: "I&I/TIPP", endDate: "2026-04-02", sampleSize: 1464, sampleType: "A", results: { Approve: 39, Disapprove: 53 } },
{ pollster: "I&I/TIPP", endDate: "2026-01-29", sampleSize: 1384, sampleType: "RV", results: { Approve: 40, Disapprove: 51 } },
{ pollster: "I&I/TIPP", endDate: "2025-11-29", sampleSize: 1483, sampleType: "A", results: { Approve: 43, Disapprove: 47 } },
{ pollster: "I&I/TIPP", endDate: "2025-10-31", sampleSize: 1418, sampleType: "A", results: { Approve: 40, Disapprove: 51 } },
{ pollster: "I&I/TIPP", endDate: "2025-10-02", sampleSize: 1459, sampleType: "A", results: { Approve: 42, Disapprove: 46 } },
{ pollster: "I&I/TIPP", endDate: "2025-08-29", sampleSize: 1362, sampleType: "A", results: { Approve: 43, Disapprove: 47 } },
{ pollster: "I&I/TIPP", endDate: "2025-06-27", sampleSize: 1421, sampleType: "A", results: { Approve: 44, Disapprove: 45 } },
{ pollster: "I&I/TIPP", endDate: "2025-05-30", sampleSize: 1395, sampleType: "A", results: { Approve: 43, Disapprove: 45 } },
{ pollster: "I&I/TIPP", endDate: "2025-05-02", sampleSize: 1400, sampleType: "A", results: { Approve: 42, Disapprove: 47 } },
{ pollster: "I&I/TIPP", endDate: "2025-02-28", sampleSize: 1434, sampleType: "A", results: { Approve: 46, Disapprove: 43 } },
{ pollster: "IBD/TIPP", endDate: "2025-08-01", sampleSize: 1362, sampleType: "RV", results: { Approve: 45, Disapprove: 46 } },
// ── Atlas Intel ────────────────────────────────────────────────────────────────
{ pollster: "Atlas Intel", endDate: "2025-12-19", sampleSize: 2315, sampleType: "A", results: { Approve: 39, Disapprove: 60 } },
{ pollster: "Atlas Intel", endDate: "2025-09-16", sampleSize: 1066, sampleType: "A", results: { Approve: 47, Disapprove: 52 } },
{ pollster: "Atlas Intel", endDate: "2025-07-18", sampleSize: 1935, sampleType: "A", results: { Approve: 44, Disapprove: 55 } },
{ pollster: "Atlas Intel", endDate: "2025-05-27", sampleSize: 3469, sampleType: "A", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Atlas Intel", endDate: "2025-04-14", sampleSize: 2347, sampleType: "A", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Atlas Intel", endDate: "2025-03-12", sampleSize: 2550, sampleType: "A", results: { Approve: 47, Disapprove: 52 } },
{ pollster: "Atlas Intel", endDate: "2025-02-27", sampleSize: 2849, sampleType: "A", results: { Approve: 50, Disapprove: 50 } },
{ pollster: "Atlas Intel", endDate: "2025-01-23", sampleSize: 1882, sampleType: "A", results: { Approve: 50, Disapprove: 50 } },
// ── Reuters/Ipsos ──────────────────────────────────────────────────────────────
{ pollster: "Reuters/Ipsos", endDate: "2026-03-23", sampleSize: 1272, sampleType: "A", results: { Approve: 36, Disapprove: 62 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-03-19", sampleSize: 1545, sampleType: "A", results: { Approve: 40, Disapprove: 58 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-03-01", sampleSize: 1282, sampleType: "A", results: { Approve: 38, Disapprove: 60 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-02-23", sampleSize: 4638, sampleType: "A", results: { Approve: 40, Disapprove: 58 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-01-25", sampleSize: 1139, sampleType: "A", results: { Approve: 38, Disapprove: 59 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-01-13", sampleSize: 1217, sampleType: "A", results: { Approve: 41, Disapprove: 58 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-01-05", sampleSize: 1248, sampleType: "A", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-12-14", sampleSize: 1016, sampleType: "A", results: { Approve: 39, Disapprove: 59 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-12-08", sampleSize: 4434, sampleType: "A", results: { Approve: 41, Disapprove: 57 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-11-17", sampleSize: 1017, sampleType: "A", results: { Approve: 38, Disapprove: 60 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-11-12", sampleSize: 938, sampleType: "RV", results: { Approve: 40, Disapprove: 58 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-10-26", sampleSize: 1018, sampleType: "A", results: { Approve: 40, Disapprove: 57 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-10-20", sampleSize: 4385, sampleType: "A", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-10-07", sampleSize: 1154, sampleType: "A", results: { Approve: 40, Disapprove: 58 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-09-21", sampleSize: 1019, sampleType: "A", results: { Approve: 41, Disapprove: 58 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-09-09", sampleSize: 1084, sampleType: "A", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-08-24", sampleSize: 1022, sampleType: "A", results: { Approve: 40, Disapprove: 54 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-08-18", sampleSize: 4446, sampleType: "A", results: { Approve: 40, Disapprove: 54 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-07-27", sampleSize: 1023, sampleType: "A", results: { Approve: 40, Disapprove: 56 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-07-16", sampleSize: 1027, sampleType: "A", results: { Approve: 41, Disapprove: 54 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-06-23", sampleSize: 1139, sampleType: "A", results: { Approve: 41, Disapprove: 57 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-06-16", sampleSize: 4258, sampleType: "A", results: { Approve: 42, Disapprove: 54 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-05-18", sampleSize: 1024, sampleType: "A", results: { Approve: 42, Disapprove: 52 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-05-13", sampleSize: 1163, sampleType: "A", results: { Approve: 44, Disapprove: 52 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-04-27", sampleSize: 1029, sampleType: "A", results: { Approve: 42, Disapprove: 53 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-04-21", sampleSize: 4306, sampleType: "A", results: { Approve: 42, Disapprove: 53 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-04-02", sampleSize: 1486, sampleType: "A", results: { Approve: 43, Disapprove: 53 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-03-23", sampleSize: 1030, sampleType: "A", results: { Approve: 45, Disapprove: 51 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-03-12", sampleSize: 1422, sampleType: "A", results: { Approve: 44, Disapprove: 52 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-03-04", sampleSize: 1174, sampleType: "A", results: { Approve: 44, Disapprove: 51 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-02-23", sampleSize: 1029, sampleType: "A", results: { Approve: 44, Disapprove: 50 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-02-18", sampleSize: 4145, sampleType: "A", results: { Approve: 44, Disapprove: 51 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-01-26", sampleSize: 1034, sampleType: "A", results: { Approve: 45, Disapprove: 46 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-01-21", sampleSize: 1077, sampleType: "A", results: { Approve: 47, Disapprove: 41 } },
// ── CBS News ──────────────────────────────────────────────────────────────────
{ pollster: "CBS News", endDate: "2026-04-10", sampleSize: 2387, sampleType: "A", results: { Approve: 39, Disapprove: 61 } },
{ pollster: "CBS News", endDate: "2026-03-20", sampleSize: 3335, sampleType: "A", results: { Approve: 40, Disapprove: 60 } },
{ pollster: "CBS News", endDate: "2026-02-27", sampleSize: 2264, sampleType: "A", results: { Approve: 41, Disapprove: 59 } },
{ pollster: "CBS News", endDate: "2026-02-23", sampleSize: 2381, sampleType: "A", results: { Approve: 40, Disapprove: 60 } },
{ pollster: "CBS News", endDate: "2026-01-16", sampleSize: 2523, sampleType: "A", results: { Approve: 41, Disapprove: 59 } },
{ pollster: "CBS News", endDate: "2026-01-07", sampleSize: 2325, sampleType: "A", results: { Approve: 41, Disapprove: 59 } },
{ pollster: "CBS News", endDate: "2025-12-19", sampleSize: 2300, sampleType: "A", results: { Approve: 41, Disapprove: 59 } },
{ pollster: "CBS News", endDate: "2025-11-21", sampleSize: 2489, sampleType: "A", results: { Approve: 40, Disapprove: 60 } },
{ pollster: "CBS News", endDate: "2025-10-31", sampleSize: 2124, sampleType: "A", results: { Approve: 41, Disapprove: 59 } },
{ pollster: "CBS News", endDate: "2025-10-03", sampleSize: 2441, sampleType: "A", results: { Approve: 42, Disapprove: 58 } },
{ pollster: "CBS News", endDate: "2025-09-05", sampleSize: 2385, sampleType: "A", results: { Approve: 44, Disapprove: 56 } },
{ pollster: "CBS News", endDate: "2025-07-18", sampleSize: 2343, sampleType: "A", results: { Approve: 42, Disapprove: 58 } },
{ pollster: "CBS News", endDate: "2025-06-06", sampleSize: 2428, sampleType: "A", results: { Approve: 45, Disapprove: 55 } },
{ pollster: "CBS News", endDate: "2025-04-25", sampleSize: 2365, sampleType: "A", results: { Approve: 45, Disapprove: 55 } },
{ pollster: "CBS News", endDate: "2025-04-11", sampleSize: 2410, sampleType: "A", results: { Approve: 47, Disapprove: 53 } },
{ pollster: "CBS News", endDate: "2025-03-28", sampleSize: 2609, sampleType: "A", results: { Approve: 50, Disapprove: 50 } },
{ pollster: "CBS News", endDate: "2025-02-28", sampleSize: 2311, sampleType: "A", results: { Approve: 51, Disapprove: 49 } },
{ pollster: "CBS News", endDate: "2025-02-07", sampleSize: 2175, sampleType: "A", results: { Approve: 53, Disapprove: 47 } },
// ── FOX News ──────────────────────────────────────────────────────────────────
{ pollster: "FOX News", endDate: "2026-03-23", sampleSize: 1001, sampleType: "RV", results: { Approve: 41, Disapprove: 59 } },
{ pollster: "FOX News", endDate: "2026-01-26", sampleSize: 1005, sampleType: "RV", results: { Approve: 44, Disapprove: 56 } },
{ pollster: "FOX News", endDate: "2025-12-15", sampleSize: 1001, sampleType: "RV", results: { Approve: 44, Disapprove: 56 } },
{ pollster: "FOX News", endDate: "2025-11-17", sampleSize: 1005, sampleType: "RV", results: { Approve: 41, Disapprove: 58 } },
{ pollster: "FOX News", endDate: "2025-09-09", sampleSize: 1004, sampleType: "RV", results: { Approve: 46, Disapprove: 54 } },
{ pollster: "FOX News", endDate: "2025-07-21", sampleSize: 1000, sampleType: "RV", results: { Approve: 46, Disapprove: 54 } },
{ pollster: "FOX News", endDate: "2025-06-16", sampleSize: 1003, sampleType: "RV", results: { Approve: 46, Disapprove: 54 } },
{ pollster: "Fox News", endDate: "2026-03-02", sampleSize: 1004, sampleType: "RV", results: { Approve: 43, Disapprove: 57 } },
{ pollster: "FOX News", endDate: "2025-04-21", sampleSize: 1104, sampleType: "RV", results: { Approve: 44, Disapprove: 55 } },
{ pollster: "FOX News", endDate: "2025-03-17", sampleSize: 994, sampleType: "RV", results: { Approve: 49, Disapprove: 51 } },
// ── Wall Street Journal ───────────────────────────────────────────────────────
{ pollster: "Wall Street Journal", endDate: "2026-01-13", sampleSize: 1500, sampleType: "RV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Wall Street Journal", endDate: "2025-07-20", sampleSize: 1500, sampleType: "RV", results: { Approve: 46, Disapprove: 52 } },
{ pollster: "Wall Street Journal", endDate: "2025-04-01", sampleSize: 1500, sampleType: "RV", results: { Approve: 46, Disapprove: 51 } },
// ── NY Times/Siena ────────────────────────────────────────────────────────────
{ pollster: "NY Times/Siena", endDate: "2026-01-17", sampleSize: 1625, sampleType: "RV", results: { Approve: 40, Disapprove: 56 } },
{ pollster: "NY Times/Siena", endDate: "2025-09-27", sampleSize: 1313, sampleType: "RV", results: { Approve: 43, Disapprove: 54 } },
{ pollster: "NY Times/Siena", endDate: "2025-04-24", sampleSize: 913, sampleType: "RV", results: { Approve: 42, Disapprove: 54 } },
// ── HarrisX ───────────────────────────────────────────────────────────────────
{ pollster: "HarrisX", endDate: "2025-04-07", sampleSize: 1883, sampleType: "RV", results: { Approve: 47, Disapprove: 49 } },
// ── Fabrizio/Anzalone ─────────────────────────────────────────────────────────
{ pollster: "Fabrizio/Anzalone", endDate: "2025-02-01", sampleSize: 3000, sampleType: "RV", results: { Approve: 48, Disapprove: 47 } },
// ── Cygnal ────────────────────────────────────────────────────────────────────
{ pollster: "Cygnal", endDate: "2026-04-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Cygnal", endDate: "2025-04-03", sampleSize: 1500, sampleType: "LV", results: { Approve: 47, Disapprove: 51 } },
{ pollster: "Cygnal", endDate: "2025-02-05", sampleSize: 1500, sampleType: "LV", results: { Approve: 50, Disapprove: 48 } },
// ── PPP ───────────────────────────────────────────────────────────────────────
{ pollster: "PPP", endDate: "2026-01-30", sampleSize: 652, sampleType: "RV", results: { Approve: 39, Disapprove: 56 } },
// ── NewsNation ────────────────────────────────────────────────────────────────
{ pollster: "NewsNation", endDate: "2025-10-29", sampleSize: 1159, sampleType: "LV", results: { Approve: 43, Disapprove: 56 } },
{ pollster: "NewsNation", endDate: "2025-04-27", sampleSize: 1448, sampleType: "RV", results: { Approve: 44, Disapprove: 56 } },
// ── Public Sentiment Institute ────────────────────────────────────────────────
{ pollster: "Public Sentiment Institute", endDate: "2026-02-28", sampleSize: 316, sampleType: "RV", results: { Approve: 35.5, Disapprove: 63.3 } },
{ pollster: "Public Sentiment Institute", endDate: "2026-02-28", sampleSize: 249, sampleType: "LV", results: { Approve: 40.8, Disapprove: 58.8 } },
// ── Yahoo News ────────────────────────────────────────────────────────────────
{ pollster: "Yahoo News", endDate: "2026-01-12", sampleSize: 1149, sampleType: "RV", results: { Approve: 43, Disapprove: 56 } },
{ pollster: "Yahoo News", endDate: "2025-11-24", sampleSize: 1132, sampleType: "RV", results: { Approve: 44, Disapprove: 54 } },
{ pollster: "Yahoo News", endDate: "2025-10-27", sampleSize: 1197, sampleType: "RV", results: { Approve: 43, Disapprove: 55 } },
{ pollster: "Yahoo News", endDate: "2025-09-29", sampleSize: 1129, sampleType: "RV", results: { Approve: 44, Disapprove: 55 } },
{ pollster: "Yahoo News", endDate: "2025-09-02", sampleSize: 1138, sampleType: "RV", results: { Approve: 42, Disapprove: 56 } },
{ pollster: "Yahoo News", endDate: "2025-07-28", sampleSize: 1168, sampleType: "RV", results: { Approve: 44, Disapprove: 54 } },
{ pollster: "Yahoo News", endDate: "2025-06-30", sampleSize: 1074, sampleType: "RV", results: { Approve: 45, Disapprove: 54 } },
{ pollster: "Yahoo News", endDate: "2025-05-27", sampleSize: 1560, sampleType: "A", results: { Approve: 41, Disapprove: 54 } },
{ pollster: "Yahoo News", endDate: "2025-04-28", sampleSize: 1071, sampleType: "RV", results: { Approve: 45, Disapprove: 53 } },
// ── Daily Kos/Civiqs ──────────────────────────────────────────────────────────
{ pollster: "Daily Kos/Civiqs", endDate: "2025-05-20", sampleSize: 1018, sampleType: "RV", results: { Approve: 47, Disapprove: 52 } },
{ pollster: "Daily Kos/Civiqs", endDate: "2025-04-15", sampleSize: 1124, sampleType: "RV", results: { Approve: 46, Disapprove: 53 } },
{ pollster: "Daily Kos/Civiqs", endDate: "2025-03-03", sampleSize: 1031, sampleType: "RV", results: { Approve: 48, Disapprove: 52 } },
// ── SurveyUSA ─────────────────────────────────────────────────────────────────
{ pollster: "SurveyUSA", endDate: "2025-02-16", sampleSize: 2000, sampleType: "A", results: { Approve: 51, Disapprove: 45 } },
// ── TIPP ─────────────────────────────────────────────────────────────────────
{ pollster: "TIPP", endDate: "2025-03-28", sampleSize: 1452, sampleType: "A", results: { Approve: 44, Disapprove: 45 } },
{ pollster: "TIPP", endDate: "2025-01-31", sampleSize: 1478, sampleType: "A", results: { Approve: 46, Disapprove: 41 } },
// ── Susquehanna ───────────────────────────────────────────────────────────────
{ pollster: "Susquehanna", endDate: "2025-12-17", sampleSize: 800, sampleType: "LV", results: { Approve: 38, Disapprove: 56 } },
// ── CNBC ─────────────────────────────────────────────────────────────────────
{ pollster: "CNBC", endDate: "2025-12-08", sampleSize: 1000, sampleType: "A", results: { Approve: 45, Disapprove: 52 } },
{ pollster: "CNBC", endDate: "2025-10-12", sampleSize: 1000, sampleType: "A", results: { Approve: 44, Disapprove: 52 } },
{ pollster: "CNBC", endDate: "2025-08-03", sampleSize: 1000, sampleType: "A", results: { Approve: 46, Disapprove: 51 } },
{ pollster: "CNBC", endDate: "2025-04-13", sampleSize: 1000, sampleType: "A", results: { Approve: 44, Disapprove: 51 } },
];

const GB_POLLS: Poll[] = [
{ pollster: "Emerson", endDate: "2026-04-26", sampleSize: 1000, sampleType: "LV", results: { Democrats: 50, Republicans: 40 } },
{ pollster: "Harvard-Harris", endDate: "2026-04-26", sampleSize: 500, sampleType: "LV", results: { Democrats: 50, Republicans: 50 } },
{ pollster: "Economist/YouGov", endDate: "2026-04-27", sampleSize: 1647, sampleType: "RV", results: { Democrats: 46, Republicans: 41 } },
{ pollster: "Morning Consult", endDate: "2026-04-27", sampleSize: 2201, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-04-27", sampleSize: 1014, sampleType: "RV", results: { Democrats: 41, Republicans: 37 } },
{ pollster: "Quantus Insights", endDate: "2026-04-23", sampleSize: 1452, sampleType: "LV", results: { Democrats: 47, Republicans: 42 } },
{ pollster: "FOX News", endDate: "2026-04-20", sampleSize: 1001, sampleType: "RV", results: { Democrats: 52, Republicans: 47 } },
{ pollster: "CNBC", endDate: "2026-04-19", sampleSize: 1000, sampleType: "RV", results: { Democrats: 49, Republicans: 45 } },
{ pollster: "Morning Consult", endDate: "2026-04-20", sampleSize: 2203, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
{ pollster: "Economist/YouGov", endDate: "2026-04-20", sampleSize: 1553, sampleType: "RV", results: { Democrats: 45, Republicans: 40 } },
{ pollster: "Echelon Insights", endDate: "2026-04-20", sampleSize: 1012, sampleType: "LV", results: { Democrats: 50, Republicans: 44 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-04-20", sampleSize: 3577, sampleType: "RV", results: { Democrats: 41, Republicans: 38 } },
{ pollster: "Marquette", endDate: "2026-04-16", sampleSize: 500, sampleType: "LV", results: { Democrats: 53, Republicans: 43 } },
{ pollster: "Economist/YouGov", endDate: "2026-04-13", sampleSize: 1573, sampleType: "RV", results: { Democrats: 45, Republicans: 40 } },
{ pollster: "RMG Research", endDate: "2026-04-09", sampleSize: 2000, sampleType: "RV", results: { Democrats: 49, Republicans: 44 } },
{ pollster: "Cygnal", endDate: "2026-04-03", sampleSize: 1500, sampleType: "LV", results: { Democrats: 49, Republicans: 43 } },
{ pollster: "Harvard-Harris", endDate: "2026-03-26", sampleSize: 1000, sampleType: "LV", results: { Democrats: 52, Republicans: 48 } },
{ pollster: "Quantus Insights", endDate: "2026-03-26", sampleSize: 1472, sampleType: "LV", results: { Democrats: 47, Republicans: 41 } },
{ pollster: "Big Data Poll", endDate: "2026-03-24", sampleSize: 3003, sampleType: "LV", results: { Democrats: 48, Republicans: 40 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-03-23", sampleSize: 985, sampleType: "RV", results: { Democrats: 40, Republicans: 38 } },
{ pollster: "Rasmussen Reports", endDate: "2026-03-23", sampleSize: 2222, sampleType: "LV", results: { Democrats: 45, Republicans: 42 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-03-19", sampleSize: 1206, sampleType: "RV", results: { Democrats: 40, Republicans: 37 } },
{ pollster: "Quantus Insights", endDate: "2026-03-18", sampleSize: 1064, sampleType: "LV", results: { Democrats: 47, Republicans: 42 } },
{ pollster: "Emerson", endDate: "2026-03-17", sampleSize: 1000, sampleType: "LV", results: { Democrats: 49, Republicans: 42 } },
{ pollster: "Cygnal", endDate: "2026-03-04", sampleSize: 1500, sampleType: "LV", results: { Democrats: 49, Republicans: 45 } },
{ pollster: "RMG Research", endDate: "2026-03-04", sampleSize: 2000, sampleType: "RV", results: { Democrats: 46, Republicans: 46 } },
{ pollster: "Quantus Insights", endDate: "2026-03-03", sampleSize: 1624, sampleType: "LV", results: { Democrats: 48, Republicans: 42 } },
{ pollster: "CBS News", endDate: "2026-02-27", sampleSize: 2264, sampleType: "A", results: { Democrats: 45, Republicans: 40 } },
{ pollster: "Harvard-Harris", endDate: "2026-02-26", sampleSize: 1999, sampleType: "RV", results: { Democrats: 50, Republicans: 50 } },
{ pollster: "Public Sentiment Institute", endDate: "2026-02-28", sampleSize: 316, sampleType: "RV", results: { Republicans: 32.8, Democrats: 40.7 } },
{ pollster: "Public Sentiment Institute", endDate: "2026-02-28", sampleSize: 249, sampleType: "LV", results: { Republicans: 41.0, Democrats: 50.1 } },
{ pollster: "Emerson", endDate: "2026-02-22", sampleSize: 1000, sampleType: "LV", results: { Democrats: 50, Republicans: 42 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-02-23", sampleSize: 3686, sampleType: "RV", results: { Democrats: 40, Republicans: 38 } },
{ pollster: "Big Data Poll", endDate: "2026-02-18", sampleSize: 1805, sampleType: "LV", results: { Democrats: 50, Republicans: 41 } },
{ pollster: "Quantus Insights", endDate: "2026-02-13", sampleSize: 1515, sampleType: "LV", results: { Democrats: 48, Republicans: 42 } },
{ pollster: "Cygnal", endDate: "2026-02-04", sampleSize: 1500, sampleType: "LV", results: { Democrats: 48, Republicans: 44 } },
{ pollster: "PPP", endDate: "2026-01-30", sampleSize: 652, sampleType: "RV", results: { Democrats: 48, Republicans: 41 } },
{ pollster: "Harvard-Harris", endDate: "2026-01-29", sampleSize: 2000, sampleType: "RV", results: { Democrats: 52, Republicans: 48 } },
{ pollster: "I&I/TIPP", endDate: "2026-01-29", sampleSize: 1126, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
{ pollster: "FOX News", endDate: "2026-01-26", sampleSize: 1005, sampleType: "RV", results: { Democrats: 52, Republicans: 46 } },
{ pollster: "Cygnal", endDate: "2026-01-28", sampleSize: 1004, sampleType: "LV", results: { Democrats: 48, Republicans: 44 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-01-25", sampleSize: 906, sampleType: "RV", results: { Democrats: 41, Republicans: 37 } },
{ pollster: "Big Data Poll", endDate: "2026-01-24", sampleSize: 2909, sampleType: "LV", results: { Democrats: 48, Republicans: 44 } },
{ pollster: "Quantus Insights", endDate: "2026-01-22", sampleSize: 1000, sampleType: "RV", results: { Democrats: 47, Republicans: 41 } },
{ pollster: "Emerson", endDate: "2026-01-19", sampleSize: 1000, sampleType: "LV", results: { Democrats: 48, Republicans: 42 } },
{ pollster: "NY Times/Siena", endDate: "2026-01-17", sampleSize: 1625, sampleType: "RV", results: { Democrats: 48, Republicans: 43 } },
{ pollster: "Reuters/Ipsos", endDate: "2026-01-13", sampleSize: 941, sampleType: "RV", results: { Democrats: 40, Republicans: 38 } },
{ pollster: "Wall Street Journal", endDate: "2026-01-13", sampleSize: 1500, sampleType: "RV", results: { Democrats: 47, Republicans: 43 } },
{ pollster: "Rasmussen Reports", endDate: "2026-01-14", sampleSize: 2273, sampleType: "LV", results: { Democrats: 47, Republicans: 41 } },
{ pollster: "Cygnal", endDate: "2026-01-08", sampleSize: 1500, sampleType: "LV", results: { Democrats: 48, Republicans: 45 } },
{ pollster: "RMG Research**", endDate: "2026-01-08", sampleSize: 2000, sampleType: "RV", results: { Democrats: 47, Republicans: 46 } },
{ pollster: "Big Data Poll", endDate: "2025-12-28", sampleSize: 3412, sampleType: "LV", results: { Democrats: 49, Republicans: 44 } },
{ pollster: "Atlas Intel", endDate: "2025-12-19", sampleSize: 2315, sampleType: "A", results: { Democrats: 54, Republicans: 38 } },
{ pollster: "Quantus Insights", endDate: "2025-12-16", sampleSize: 1000, sampleType: "RV", results: { Democrats: 43, Republicans: 41 } },
{ pollster: "Emerson", endDate: "2025-12-15", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 42 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-12-15", sampleSize: 775, sampleType: "RV", results: { Democrats: 40, Republicans: 36 } },
{ pollster: "Big Data Poll", endDate: "2025-12-12", sampleSize: 3004, sampleType: "RV", results: { Democrats: 47, Republicans: 43 } },
{ pollster: "CNBC", endDate: "2025-12-08", sampleSize: 800, sampleType: "RV", results: { Democrats: 50, Republicans: 46 } },
{ pollster: "Cygnal", endDate: "2025-12-07", sampleSize: 1500, sampleType: "LV", results: { Democrats: 48, Republicans: 44 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-12-08", sampleSize: 3521, sampleType: "RV", results: { Democrats: 40, Republicans: 39 } },
{ pollster: "Quantus Insights", endDate: "2025-12-05", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 40 } },
{ pollster: "RMG Research**", endDate: "2025-12-04", sampleSize: 2000, sampleType: "RV", results: { Democrats: 41, Republicans: 45 } },
{ pollster: "Big Data Poll", endDate: "2025-12-01", sampleSize: 2008, sampleType: "RV", results: { Democrats: 44, Republicans: 42 } },
{ pollster: "Rasmussen Reports", endDate: "2025-11-23", sampleSize: 2410, sampleType: "LV", results: { Democrats: 45, Republicans: 42 } },
{ pollster: "Quantus Insights", endDate: "2025-11-12", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 39 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-11-12", sampleSize: 938, sampleType: "RV", results: { Democrats: 41, Republicans: 40 } },
{ pollster: "Cygnal", endDate: "2025-11-06", sampleSize: 1500, sampleType: "RV", results: { Democrats: 50, Republicans: 44 } },
{ pollster: "Emerson", endDate: "2025-11-04", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 40 } },
{ pollster: "NewsNation", endDate: "2025-10-29", sampleSize: 1159, sampleType: "LV", results: { Democrats: 47, Republicans: 47 } },
{ pollster: "Big Data Poll", endDate: "2025-10-29", sampleSize: 2984, sampleType: "RV", results: { Democrats: 43, Republicans: 41 } },
{ pollster: "Quantus Insights", endDate: "2025-10-08", sampleSize: 1000, sampleType: "RV", results: { Democrats: 42, Republicans: 43 } },
{ pollster: "Cygnal", endDate: "2025-10-08", sampleSize: 1500, sampleType: "LV", results: { Democrats: 48, Republicans: 45 } },
{ pollster: "Yahoo News", endDate: "2025-10-27", sampleSize: 1197, sampleType: "RV", results: { Democrats: 45, Republicans: 40 } },
{ pollster: "Emerson", endDate: "2025-10-14", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 43 } },
{ pollster: "NY Times/Siena", endDate: "2025-09-27", sampleSize: 1313, sampleType: "RV", results: { Democrats: 47, Republicans: 45 } },
{ pollster: "RMG Research**", endDate: "2025-09-24", sampleSize: 2000, sampleType: "RV", results: { Democrats: 45, Republicans: 46 } },
{ pollster: "Atlas Intel", endDate: "2025-09-16", sampleSize: 1066, sampleType: "A", results: { Democrats: 52, Republicans: 44 } },
{ pollster: "Cygnal", endDate: "2025-09-03", sampleSize: 1500, sampleType: "RV", results: { Democrats: 48, Republicans: 45 } },
{ pollster: "Yahoo News", endDate: "2025-09-02", sampleSize: 1136, sampleType: "RV", results: { Democrats: 44, Republicans: 40 } },
{ pollster: "Emerson", endDate: "2025-08-26", sampleSize: 1000, sampleType: "RV", results: { Democrats: 43, Republicans: 43 } },
{ pollster: "Reuters/Ipsos", endDate: "2025-08-24", sampleSize: 1022, sampleType: "A", results: { Democrats: 38, Republicans: 34 } },
{ pollster: "RMG Research**", endDate: "2025-08-21", sampleSize: 2000, sampleType: "RV", results: { Democrats: 47, Republicans: 47 } },
{ pollster: "Quantus Insights", endDate: "2025-08-13", sampleSize: 1000, sampleType: "RV", results: { Democrats: 45, Republicans: 42 } },
{ pollster: "Cygnal", endDate: "2025-08-09", sampleSize: 1500, sampleType: "RV", results: { Democrats: 47, Republicans: 46 } },
{ pollster: "CNBC", endDate: "2025-08-03", sampleSize: 1000, sampleType: "A", results: { Democrats: 49, Republicans: 44 } },
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
{ pollster: "Cygnal", endDate: "2025-04-03", sampleSize: 1500, sampleType: "LV", results: { Democrats: 48, Republicans: 47 } },
{ pollster: "Wall Street Journal", endDate: "2025-04-01", sampleSize: 1500, sampleType: "RV", results: { Democrats: 44, Republicans: 43 } },
{ pollster: "Quantus Insights", endDate: "2025-03-27", sampleSize: 1000, sampleType: "RV", results: { Democrats: 45, Republicans: 46 } },
{ pollster: "Emerson", endDate: "2025-03-03", sampleSize: 1000, sampleType: "RV", results: { Democrats: 44, Republicans: 41 } },
{ pollster: "Cygnal", endDate: "2025-02-05", sampleSize: 1500, sampleType: "LV", results: { Democrats: 46, Republicans: 47 } },
{ pollster: "CC Labs**", endDate: "2025-02-06", sampleSize: 1102, sampleType: "RV", results: { Democrats: 45, Republicans: 44 } },
{ pollster: "Fabrizio/Anzalone", endDate: "2025-02-01", sampleSize: 3000, sampleType: "RV", results: { Democrats: 43, Republicans: 43 } },
{ pollster: "Quantus Insights", endDate: "2025-01-23", sampleSize: 1000, sampleType: "RV", results: { Democrats: 45, Republicans: 48 } },
];

const RT_POLLS: Poll[] = [
  { pollster: "Economist/YouGov", endDate: "2026-04-27", sampleSize: 1647, sampleType: "RV", results: { RightTrack: 32, WrongTrack: 62 } },
  { pollster: "Reuters/Ipsos", endDate: "2026-04-27", sampleSize: 1269, sampleType: "A", results: { RightTrack: 19, WrongTrack: 64 } },
  { pollster: "Harvard-Harris", endDate: "2026-04-26", sampleSize: 2745, sampleType: "RV", results: { RightTrack: 37, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports", endDate: "2026-04-23", sampleSize: 1841, sampleType: "LV", results: { RightTrack: 38, WrongTrack: 56 } },
  { pollster: "Economist/YouGov", endDate: "2026-04-20", sampleSize: 1553, sampleType: "RV", results: { RightTrack: 35, WrongTrack: 57 } },
  { pollster: "Rasmussen Reports", endDate: "2026-04-16", sampleSize: 1765, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 56 } },
  { pollster: "Marquette", endDate: "2026-04-16", sampleSize: 870, sampleType: "RV", results: { RightTrack: 34, WrongTrack: 66 } },
  { pollster: "Economist/YouGov", endDate: "2026-04-13", sampleSize: 1573, sampleType: "RV", results: { RightTrack: 34, WrongTrack: 59 } },
  { pollster: "Rasmussen Reports", endDate: "2026-04-09", sampleSize: 1776, sampleType: "LV", results: { RightTrack: 39, WrongTrack: 55 } },
  { pollster: "Cygnal", endDate: "2026-04-03", sampleSize: 1500, sampleType: "LV", results: { RightTrack: 38, WrongTrack: 59 } },
  { pollster: "Rasmussen Reports", endDate: "2026-04-02", sampleSize: 1817, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 55 } },
  { pollster: "Harvard-Harris", endDate: "2026-03-26", sampleSize: 2009, sampleType: "RV", results: { RightTrack: 35, WrongTrack: 55 } },
  { pollster: "Quantus Insights", endDate: "2026-03-26", sampleSize: 1472, sampleType: "LV", results: { RightTrack: 36, WrongTrack: 60 } },
  { pollster: "Rasmussen Reports", endDate: "2026-03-26", sampleSize: 1873, sampleType: "LV", results: { RightTrack: 38, WrongTrack: 56 } },
  { pollster: "Big Data Poll", endDate: "2026-03-24", sampleSize: 3003, sampleType: "RV", results: { RightTrack: 33, WrongTrack: 58 } },
  { pollster: "Reuters/Ipsos", endDate: "2026-03-22", sampleSize: 1272, sampleType: "A", results: { RightTrack: 20, WrongTrack: 63 } },
  { pollster: "Quantus Insights", endDate: "2026-03-18", sampleSize: 1064, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 56 } },
  { pollster: "Rasmussen Reports", endDate: "2026-03-19", sampleSize: 1858, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports", endDate: "2026-03-12", sampleSize: 1845, sampleType: "LV", results: { RightTrack: 41, WrongTrack: 54 } },
  { pollster: "Cygnal", endDate: "2026-03-04", sampleSize: 1500, sampleType: "LV", results: { RightTrack: 43, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports", endDate: "2026-03-05", sampleSize: 1851, sampleType: "LV", results: { RightTrack: 41, WrongTrack: 54 } },
  { pollster: "Quantus Insights", endDate: "2026-03-03", sampleSize: 1624, sampleType: "LV", results: { RightTrack: 41, WrongTrack: 54 } },
  { pollster: "Harvard-Harris", endDate: "2026-02-26", sampleSize: 1999, sampleType: "RV", results: { RightTrack: 38, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports", endDate: "2026-02-26", sampleSize: 1887, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 54 } },
  { pollster: "Big Data Poll", endDate: "2026-02-18", sampleSize: 2012, sampleType: "RV", results: { RightTrack: 36, WrongTrack: 57 } },
  { pollster: "Rasmussen Reports", endDate: "2026-02-19", sampleSize: 1899, sampleType: "LV", results: { RightTrack: 44, WrongTrack: 51 } },
  { pollster: "Reuters/Ipsos", endDate: "2026-02-16", sampleSize: 1117, sampleType: "A", results: { RightTrack: 21, WrongTrack: 64 } },
  { pollster: "Quantus Insights", endDate: "2026-02-13", sampleSize: 1515, sampleType: "LV", results: { RightTrack: 38, WrongTrack: 60 } },
  { pollster: "Yahoo News", endDate: "2026-02-12", sampleSize: 1149, sampleType: "RV", results: { RightTrack: 34, WrongTrack: 59 } },
  { pollster: "Rasmussen Reports", endDate: "2026-02-12", sampleSize: 1846, sampleType: "LV", results: { RightTrack: 42, WrongTrack: 52 } },
  { pollster: "Cygnal", endDate: "2026-02-04", sampleSize: 1500, sampleType: "LV", results: { RightTrack: 43, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports", endDate: "2026-02-05", sampleSize: 1822, sampleType: "LV", results: { RightTrack: 36, WrongTrack: 59 } },
  { pollster: "Harvard-Harris", endDate: "2026-01-29", sampleSize: 2000, sampleType: "RV", results: { RightTrack: 38, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports", endDate: "2026-01-29", sampleSize: 1890, sampleType: "LV", results: { RightTrack: 41, WrongTrack: 54 } },
  { pollster: "Big Data Poll", endDate: "2026-01-24", sampleSize: 3280, sampleType: "RV", results: { RightTrack: 36, WrongTrack: 53 } },
  { pollster: "Quantus Insights", endDate: "2026-01-22", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 35, WrongTrack: 58 } },
  { pollster: "Rasmussen Reports", endDate: "2026-01-22", sampleSize: 1929, sampleType: "LV", results: { RightTrack: 41, WrongTrack: 53 } },
  { pollster: "Emerson", endDate: "2026-01-19", sampleSize: 1000, sampleType: "LV", results: { RightTrack: 44, WrongTrack: 56 } },
  { pollster: "NY Times/Siena", endDate: "2026-01-17", sampleSize: 1625, sampleType: "RV", results: { RightTrack: 37, WrongTrack: 56 } },
  { pollster: "Rasmussen Reports", endDate: "2026-01-15", sampleSize: 1908, sampleType: "LV", results: { RightTrack: 37, WrongTrack: 57 } },
  { pollster: "Wall Street Journal", endDate: "2026-01-13", sampleSize: 1500, sampleType: "RV", results: { RightTrack: 39, WrongTrack: 57 } },
  { pollster: "Yahoo News", endDate: "2026-01-12", sampleSize: 1149, sampleType: "RV", results: { RightTrack: 35, WrongTrack: 58 } },
  { pollster: "Cygnal", endDate: "2026-01-08", sampleSize: 1500, sampleType: "LV", results: { RightTrack: 42, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports", endDate: "2026-01-08", sampleSize: 1880, sampleType: "LV", results: { RightTrack: 41, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports", endDate: "2025-12-30", sampleSize: 1111, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 53 } },
  { pollster: "Big Data Poll", endDate: "2025-12-28", sampleSize: 3412, sampleType: "LV", results: { RightTrack: 36, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports", endDate: "2025-12-23", sampleSize: 1099, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports", endDate: "2025-12-18", sampleSize: 1871, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 54 } },
  { pollster: "Quantus Insights", endDate: "2025-12-16", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 34, WrongTrack: 56 } },
  { pollster: "Big Data Poll", endDate: "2025-12-12", sampleSize: 3004, sampleType: "RV", results: { RightTrack: 38, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports", endDate: "2025-12-11", sampleSize: 1933, sampleType: "LV", results: { RightTrack: 41, WrongTrack: 53 } },
  { pollster: "Cygnal", endDate: "2025-12-07", sampleSize: 1500, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 57 } },
  { pollster: "Quantus Insights", endDate: "2025-12-05", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 36, WrongTrack: 55 } },
  { pollster: "Harvard-Harris", endDate: "2025-12-04", sampleSize: 2204, sampleType: "RV", results: { RightTrack: 39, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports", endDate: "2025-12-04", sampleSize: 1890, sampleType: "LV", results: { RightTrack: 36, WrongTrack: 58 } },
  { pollster: "Big Data Poll", endDate: "2025-12-01", sampleSize: 2008, sampleType: "RV", results: { RightTrack: 36, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports", endDate: "2025-11-25", sampleSize: 1176, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 54 } },
  { pollster: "Big Data Poll", endDate: "2025-11-21", sampleSize: 2006, sampleType: "RV", results: { RightTrack: 36, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports", endDate: "2025-11-20", sampleSize: 2020, sampleType: "LV", results: { RightTrack: 39, WrongTrack: 54 } },
  { pollster: "Quantus Insights", endDate: "2025-11-12", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 35, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports", endDate: "2025-11-13", sampleSize: 1925, sampleType: "LV", results: { RightTrack: 36, WrongTrack: 59 } },
  { pollster: "Cygnal", endDate: "2025-11-06", sampleSize: 1500, sampleType: "RV", results: { RightTrack: 37, WrongTrack: 59 } },
  { pollster: "Harvard-Harris", endDate: "2025-11-06", sampleSize: 2000, sampleType: "RV", results: { RightTrack: 35, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports", endDate: "2025-11-06", sampleSize: 2022, sampleType: "LV", results: { RightTrack: 38, WrongTrack: 57 } },
  { pollster: "Rasmussen Reports", endDate: "2025-10-30", sampleSize: 1929, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 55 } },
  { pollster: "NewsNation", endDate: "2025-10-29", sampleSize: 1159, sampleType: "LV", results: { RightTrack: 40, WrongTrack: 60 } },
  { pollster: "Big Data Poll", endDate: "2025-10-28", sampleSize: 2984, sampleType: "RV", results: { RightTrack: 39, WrongTrack: 51 } },
  { pollster: "Yahoo News", endDate: "2025-10-27", sampleSize: 1197, sampleType: "RV", results: { RightTrack: 35, WrongTrack: 58 } },
  { pollster: "Rasmussen Reports", endDate: "2025-10-23", sampleSize: 1925, sampleType: "LV", results: { RightTrack: 39, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports", endDate: "2025-10-16", sampleSize: 1995, sampleType: "LV", results: { RightTrack: 43, WrongTrack: 51 } },
  { pollster: "Cygnal", endDate: "2025-10-08", sampleSize: 1500, sampleType: "LV", results: { RightTrack: 42, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports", endDate: "2025-10-09", sampleSize: 1964, sampleType: "LV", results: { RightTrack: 44, WrongTrack: 52 } },
  { pollster: "Harvard-Harris", endDate: "2025-10-02", sampleSize: 2413, sampleType: "RV", results: { RightTrack: 40, WrongTrack: 50 } },
  { pollster: "Rasmussen Reports", endDate: "2025-10-02", sampleSize: 1943, sampleType: "LV", results: { RightTrack: 41, WrongTrack: 53 } },
  { pollster: "Yahoo News", endDate: "2025-09-29", sampleSize: 1129, sampleType: "RV", results: { RightTrack: 34, WrongTrack: 59 } },
  { pollster: "NY Times/Siena", endDate: "2025-09-27", sampleSize: 1313, sampleType: "RV", results: { RightTrack: 36, WrongTrack: 58 } },
  { pollster: "Rasmussen Reports", endDate: "2025-09-25", sampleSize: 1951, sampleType: "LV", results: { RightTrack: 42, WrongTrack: 52 } },
  { pollster: "Quantus Insights", endDate: "2025-09-21", sampleSize: 1000, sampleType: "LV", results: { RightTrack: 42, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports", endDate: "2025-09-18", sampleSize: 1932, sampleType: "LV", results: { RightTrack: 42, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports", endDate: "2025-09-11", sampleSize: 2509, sampleType: "RV", results: { RightTrack: 42, WrongTrack: 53 } },
  { pollster: "Cygnal", endDate: "2025-09-03", sampleSize: 1500, sampleType: "RV", results: { RightTrack: 43, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports", endDate: "2025-09-04", sampleSize: 1578, sampleType: "LV", results: { RightTrack: 44, WrongTrack: 52 } },
  { pollster: "Yahoo News", endDate: "2025-09-02", sampleSize: 1138, sampleType: "RV", results: { RightTrack: 36, WrongTrack: 57 } },
  { pollster: "Rasmussen Reports", endDate: "2025-08-28", sampleSize: 1932, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-08-24", sampleSize: 1022, sampleType: "A", results: { RightTrack: 30, WrongTrack: 57 } },
  { pollster: "Harvard-Harris", endDate: "2025-08-21", sampleSize: 2025, sampleType: "RV", results: { RightTrack: 40, WrongTrack: 50 } },
  { pollster: "Rasmussen Reports", endDate: "2025-08-21", sampleSize: 1906, sampleType: "LV", results: { RightTrack: 46, WrongTrack: 49 } },
  { pollster: "Rasmussen Reports", endDate: "2025-08-14", sampleSize: 1967, sampleType: "LV", results: { RightTrack: 44, WrongTrack: 49 } },
  { pollster: "Cygnal", endDate: "2025-08-09", sampleSize: 1500, sampleType: "RV", results: { RightTrack: 44, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports", endDate: "2025-08-07", sampleSize: 1953, sampleType: "LV", results: { RightTrack: 43, WrongTrack: 51 } },
  { pollster: "Rasmussen Reports", endDate: "2025-07-31", sampleSize: 2027, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Yahoo News", endDate: "2025-07-28", sampleSize: 1168, sampleType: "RV", results: { RightTrack: 40, WrongTrack: 54 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-07-27", sampleSize: 1023, sampleType: "A", results: { RightTrack: 29, WrongTrack: 56 } },
  { pollster: "Rasmussen Reports", endDate: "2025-07-27", sampleSize: 1709, sampleType: "LV", results: { RightTrack: 44, WrongTrack: 52 } },
  { pollster: "Wall Street Journal", endDate: "2025-07-20", sampleSize: 1500, sampleType: "RV", results: { RightTrack: 39, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports", endDate: "2025-07-17", sampleSize: 1932, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Big Data Poll", endDate: "2025-07-14", sampleSize: 3022, sampleType: "RV", results: { RightTrack: 39, WrongTrack: 51 } },
  { pollster: "Rasmussen Reports", endDate: "2025-07-10", sampleSize: 2178, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 49 } },
  { pollster: "Harvard-Harris", endDate: "2025-07-08", sampleSize: 2044, sampleType: "RV", results: { RightTrack: 40, WrongTrack: 51 } },
  { pollster: "Cygnal", endDate: "2025-07-02", sampleSize: 1500, sampleType: "LV", results: { RightTrack: 44, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports", endDate: "2025-07-02", sampleSize: 1484, sampleType: "LV", results: { RightTrack: 44, WrongTrack: 50 } },
  { pollster: "Emerson", endDate: "2025-06-25", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 48, WrongTrack: 53 } },
  { pollster: "Yahoo News", endDate: "2025-06-30", sampleSize: 1074, sampleType: "RV", results: { RightTrack: 39, WrongTrack: 55 } },
  { pollster: "Rasmussen Reports", endDate: "2025-06-26", sampleSize: 1961, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 49 } },
  { pollster: "Rasmussen Reports", endDate: "2025-06-19", sampleSize: 1855, sampleType: "LV", results: { RightTrack: 47, WrongTrack: 47 } },
  { pollster: "Harvard-Harris", endDate: "2025-06-12", sampleSize: 2097, sampleType: "RV", results: { RightTrack: 41, WrongTrack: 51 } },
  { pollster: "Rasmussen Reports", endDate: "2025-06-12", sampleSize: 1772, sampleType: "LV", results: { RightTrack: 48, WrongTrack: 47 } },
  { pollster: "Cygnal", endDate: "2025-06-04", sampleSize: 1500, sampleType: "LV", results: { RightTrack: 47, WrongTrack: 50 } },
  { pollster: "Rasmussen Reports", endDate: "2025-06-05", sampleSize: 1752, sampleType: "LV", results: { RightTrack: 44, WrongTrack: 51 } },
  { pollster: "Quantus Insights", endDate: "2025-06-04", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 45, WrongTrack: 51 } },
  { pollster: "Rasmussen Reports", endDate: "2025-05-29", sampleSize: 1832, sampleType: "LV", results: { RightTrack: 48, WrongTrack: 46 } },
  { pollster: "Rasmussen Reports", endDate: "2025-05-22", sampleSize: 1810, sampleType: "LV", results: { RightTrack: 48, WrongTrack: 47 } },
  { pollster: "Harvard-Harris", endDate: "2025-05-15", sampleSize: 1903, sampleType: "RV", results: { RightTrack: 42, WrongTrack: 49 } },
  { pollster: "Rasmussen Reports", endDate: "2025-05-15", sampleSize: 1716, sampleType: "LV", results: { RightTrack: 47, WrongTrack: 47 } },
  { pollster: "Rasmussen Reports", endDate: "2025-05-08", sampleSize: 1762, sampleType: "LV", results: { RightTrack: 47, WrongTrack: 47 } },
  { pollster: "Quantus Insights", endDate: "2025-05-07", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 44, WrongTrack: 50 } },
  { pollster: "Big Data Poll", endDate: "2025-05-05", sampleSize: 3128, sampleType: "RV", results: { RightTrack: 41, WrongTrack: 48 } },
  { pollster: "Rasmussen Reports", endDate: "2025-05-01", sampleSize: 1823, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 51 } },
  { pollster: "Emerson", endDate: "2025-04-28", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 48, WrongTrack: 52 } },
  { pollster: "Yahoo News", endDate: "2025-04-28", sampleSize: 1071, sampleType: "RV", results: { RightTrack: 38, WrongTrack: 52 } },
  { pollster: "NewsNation", endDate: "2025-04-27", sampleSize: 1448, sampleType: "RV", results: { RightTrack: 41, WrongTrack: 59 } },
  { pollster: "NY Times/Siena", endDate: "2025-04-24", sampleSize: 913, sampleType: "RV", results: { RightTrack: 36, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports", endDate: "2025-04-24", sampleSize: 1767, sampleType: "LV", results: { RightTrack: 42, WrongTrack: 51 } },
  { pollster: "Harvard-Harris", endDate: "2025-04-10", sampleSize: 2286, sampleType: "RV", results: { RightTrack: 39, WrongTrack: 49 } },
  { pollster: "Rasmussen Reports", endDate: "2025-04-10", sampleSize: 1811, sampleType: "LV", results: { RightTrack: 43, WrongTrack: 51 } },
  { pollster: "HarrisX", endDate: "2025-04-07", sampleSize: 1883, sampleType: "RV", results: { RightTrack: 39, WrongTrack: 51 } },
  { pollster: "Cygnal", endDate: "2025-04-03", sampleSize: 1500, sampleType: "LV", results: { RightTrack: 44, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports", endDate: "2025-04-03", sampleSize: 1746, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-04-02", sampleSize: 1486, sampleType: "A", results: { RightTrack: 32, WrongTrack: 53 } },
  { pollster: "Wall Street Journal", endDate: "2025-04-01", sampleSize: 1500, sampleType: "RV", results: { RightTrack: 41, WrongTrack: 51 } },
  { pollster: "Harvard-Harris", endDate: "2025-03-27", sampleSize: 2746, sampleType: "RV", results: { RightTrack: 41, WrongTrack: 49 } },
  { pollster: "Quantus Insights", endDate: "2025-03-27", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 44, WrongTrack: 49 } },
  { pollster: "Rasmussen Reports", endDate: "2025-03-27", sampleSize: 1777, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-03-23", sampleSize: 1030, sampleType: "A", results: { RightTrack: 30, WrongTrack: 53 } },
  { pollster: "Rasmussen Reports", endDate: "2025-03-20", sampleSize: 1965, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-03-12", sampleSize: 1422, sampleType: "A", results: { RightTrack: 33, WrongTrack: 52 } },
  { pollster: "Rasmussen Reports", endDate: "2025-03-13", sampleSize: 1860, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 48 } },
  { pollster: "Quantus Insights", endDate: "2025-03-12", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 44, WrongTrack: 49 } },
  { pollster: "Emerson", endDate: "2025-03-10", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 50, WrongTrack: 50 } },
  { pollster: "Rasmussen Reports", endDate: "2025-03-06", sampleSize: 1883, sampleType: "LV", results: { RightTrack: 43, WrongTrack: 52 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-03-04", sampleSize: 1174, sampleType: "A", results: { RightTrack: 34, WrongTrack: 49 } },
  { pollster: "Rasmussen Reports", endDate: "2025-02-27", sampleSize: 2033, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 50 } },
  { pollster: "Harvard-Harris", endDate: "2025-02-20", sampleSize: 2443, sampleType: "RV", results: { RightTrack: 42, WrongTrack: 48 } },
  { pollster: "Rasmussen Reports", endDate: "2025-02-20", sampleSize: 1991, sampleType: "LV", results: { RightTrack: 48, WrongTrack: 47 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-02-23", sampleSize: 1029, sampleType: "A", results: { RightTrack: 31, WrongTrack: 50 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-02-18", sampleSize: 4125, sampleType: "A", results: { RightTrack: 34, WrongTrack: 49 } },
  { pollster: "Rasmussen Reports", endDate: "2025-02-13", sampleSize: 2004, sampleType: "LV", results: { RightTrack: 46, WrongTrack: 47 } },
  { pollster: "Rasmussen Reports", endDate: "2025-02-06", sampleSize: 2078, sampleType: "LV", results: { RightTrack: 45, WrongTrack: 48 } },
  { pollster: "Rasmussen Reports", endDate: "2025-01-30", sampleSize: 2096, sampleType: "LV", results: { RightTrack: 46, WrongTrack: 49 } },
  { pollster: "Emerson", endDate: "2025-01-28", sampleSize: 1000, sampleType: "RV", results: { RightTrack: 52, WrongTrack: 48 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-01-26", sampleSize: 1034, sampleType: "A", results: { RightTrack: 25, WrongTrack: 54 } },
  { pollster: "Rasmussen Reports", endDate: "2025-01-23", sampleSize: 2070, sampleType: "LV", results: { RightTrack: 39, WrongTrack: 52 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-01-21", sampleSize: 1077, sampleType: "A", results: { RightTrack: 29, WrongTrack: 45 } },
];

// ─────────────────────────────────────────────────────────────────────────────
// SENATE RACE POLLING DATA
// ─────────────────────────────────────────────────────────────────────────────

// ── Texas Senate ──────────────────────────────────────────────────────────────
const TX_CORNYN_POLLS: Poll[] = [
  { pollster: "Impact Research (D)",                  endDate: "2026-03-17", sampleSize: 900,  sampleType: "LV", results: { Republican: 41, Democrat: 43 } },
  { pollster: "Public Policy Polling (D)",            endDate: "2026-03-05", sampleSize: 576,  sampleType: "RV", results: { Republican: 43, Democrat: 44 } },
  { pollster: "University of Houston/YouGov",         endDate: "2026-01-31", sampleSize: 1502, sampleType: "LV", results: { Republican: 44, Democrat: 43 } },
  { pollster: "Emerson College",                      endDate: "2026-01-12", sampleSize: 1165, sampleType: "RV", results: { Republican: 47, Democrat: 44 } },
  { pollster: "Ragnar Research Partners (R)",         endDate: "2025-11-17", sampleSize: 1000, sampleType: "LV", results: { Republican: 46, Democrat: 40 } },
  { pollster: "Univ. of Houston/Texas Southern Univ.",endDate: "2025-10-01", sampleSize: 1650, sampleType: "RV", results: { Republican: 48, Democrat: 45 } },
  { pollster: "UT Tyler",                             endDate: "2025-09-24", sampleSize: 1032, sampleType: "RV", results: { Republican: 41, Democrat: 35 } },
];

const TX_PAXTON_POLLS: Poll[] = [
  { pollster: "Impact Research (D)",                  endDate: "2026-03-17", sampleSize: 900,  sampleType: "LV", results: { Republican: 43, Democrat: 44 } },
  { pollster: "Public Policy Polling (D)",            endDate: "2026-03-05", sampleSize: 576,  sampleType: "RV", results: { Republican: 45, Democrat: 47 } },
  { pollster: "University of Houston/YouGov",         endDate: "2026-01-31", sampleSize: 1502, sampleType: "LV", results: { Republican: 46, Democrat: 44 } },
  { pollster: "Emerson College",                      endDate: "2026-01-12", sampleSize: 1165, sampleType: "RV", results: { Republican: 46, Democrat: 46 } },
  { pollster: "Ragnar Research Partners (R)",         endDate: "2025-11-17", sampleSize: 1000, sampleType: "LV", results: { Republican: 44, Democrat: 44 } },
  { pollster: "Univ. of Houston/Texas Southern Univ.",endDate: "2025-10-01", sampleSize: 1650, sampleType: "RV", results: { Republican: 49, Democrat: 46 } },
  { pollster: "UT Tyler",                             endDate: "2025-09-24", sampleSize: 1032, sampleType: "RV", results: { Republican: 38, Democrat: 37 } },
];

// ── Florida Senate (Republican Primary) ──────────────────────────────────────
const FL_SENATE_POLLS: Poll[] = [
  { pollster: "Public Sentiment Institute (LV)",endDate: "2026-04-08", sampleSize: 112, sampleType: "LV", results: { Collins: 11, Donalds: 29, Fishback: 14, Renner: 1 } },
  { pollster: "Keystone Analytics",             endDate: "2026-04-06", sampleSize: 795, sampleType: "LV", results: { Donalds: 43, Fishback: 19 } },
  { pollster: "Tarrance Group (R)",             endDate: "2026-04-02", sampleSize: 466, sampleType: "LV", results: { Collins: 6, Donalds: 50, Fishback: 9, Renner: 3 } },
  { pollster: "Emerson College",                endDate: "2026-03-31", sampleSize: 465, sampleType: "LV", results: { Collins: 4, Donalds: 46, Fishback: 4, Renner: 3 } },
  { pollster: "The American Promise",           endDate: "2026-02-26", sampleSize: 800, sampleType: "LV", results: { Collins: 4, Donalds: 44, Fishback: 5, Renner: 2 } },
  { pollster: "Public Sentiment Institute (LV)",endDate: "2026-02-20", sampleSize: 400, sampleType: "LV", results: { Collins: 12, Donalds: 30, Fishback: 8, Renner: 2 } },
  { pollster: "Univ. of North Florida",         endDate: "2026-02-20", sampleSize: 657, sampleType: "LV", results: { Collins: 4, Donalds: 31, Fishback: 6, Renner: 1 } },
  { pollster: "Targoz Market Research",         endDate: "2026-02-16", sampleSize: 401, sampleType: "RV", results: { Collins: 15, Donalds: 33, Fishback: 3, Renner: 9 } },
  { pollster: "Patriot Polling (R)",            endDate: "2026-01-29", sampleSize: 827, sampleType: "LV", results: { Donalds: 37, Fishback: 23 } },
  { pollster: "Mason-Dixon",                    endDate: "2026-01-13", sampleSize: 400, sampleType: "RV", results: { Collins: 7, Donalds: 37, Fishback: 3, Renner: 4 } },
  { pollster: "Fabrizio, Lee & Associates (R)", endDate: "2026-01-06", sampleSize: 600, sampleType: "LV", results: { Collins: 6, Donalds: 45, Fishback: 4, Renner: 3 } },
  { pollster: "Public Opinion Strategies (R)",  endDate: "2025-12-11", sampleSize: 700, sampleType: "RV", results: { Collins: 13, Donalds: 40 } },
  { pollster: "The Tyson Group (R)",            endDate: "2025-12-09", sampleSize: 800, sampleType: "LV", results: { Collins: 9, Donalds: 38, Fishback: 2, Renner: 1 } },
  { pollster: "The American Promise",           endDate: "2025-11-19", sampleSize: 800, sampleType: "LV", results: { Collins: 1, Donalds: 43, Fishback: 0, Renner: 2 } },
  { pollster: "Victory Insights (R)",           endDate: "2025-11-13", sampleSize: 600, sampleType: "LV", results: { Collins: 1, Donalds: 45, Fishback: 1, Renner: 3 } },
  { pollster: "St. Pete Polls",                 endDate: "2025-10-15", sampleSize: 1034, sampleType: "LV", results: { Collins: 4, Donalds: 39, Renner: 3 } },
  { pollster: "Targoz Market Research",         endDate: "2025-09-18", sampleSize: 506, sampleType: "RV", results: { Donalds: 29, Renner: 9 } },
  { pollster: "The American Promise",           endDate: "2025-09-05", sampleSize: 800, sampleType: "LV", results: { Collins: 2, Donalds: 40, Renner: 2 } },
];

// ── South Carolina Senate ─────────────────────────────────────────────────────
const SC_GRAHAM_POLLS: Poll[] = [
  { pollster: "Impact Research (D)",      endDate: "2026-03-01", sampleSize: 700, sampleType: "LV", results: { Republican: 47, Democrat: 42 } },
  { pollster: "Public Policy Polling (D)",endDate: "2025-11-22", sampleSize: 704, sampleType: "RV", results: { Republican: 42, Democrat: 36 } },
];

// ── Nebraska Senate ───────────────────────────────────────────────────────────
const NE_TUREK_POLLS: Poll[] = [
  { pollster: "GQR (D)",            endDate: "2026-03-16", sampleSize: 1200, sampleType: "LV", results: { Republican: 47, Democrat: 43 } },
  { pollster: "Change Research (D)",endDate: "2026-01-11", sampleSize: 1108, sampleType: "LV", results: { Republican: 44, Democrat: 41 } },
];

const NE_WAHLS_POLLS: Poll[] = [
  { pollster: "GQR (D)",            endDate: "2026-03-16", sampleSize: 1200, sampleType: "LV", results: { Republican: 47, Democrat: 44 } },
  { pollster: "Change Research (D)",endDate: "2026-01-11", sampleSize: 1108, sampleType: "LV", results: { Republican: 44, Democrat: 41 } },
];

// ── Ohio Senate ──────────────────────────────────────────────────────────────
const OH_SENATE_POLLS: Poll[] = [
  { pollster: "Quantus Insights (R)",             endDate: "2026-03-14", sampleSize: 784,  sampleType: "LV", results: { Republican: 46, Democrat: 44 } },
  { pollster: "OnMessage Public Strategies (R)",  endDate: "2026-03-08", sampleSize: 600,  sampleType: "LV", results: { Republican: 45, Democrat: 47 } },
  { pollster: "EMC Research (D)",                 endDate: "2026-02-22", sampleSize: 1343, sampleType: "LV", results: { Republican: 47, Democrat: 51 } },
  { pollster: "Emerson College",                  endDate: "2025-12-08", sampleSize: 850,  sampleType: "RV", results: { Republican: 49, Democrat: 46 } },
  { pollster: "Bowling Green State Univ./YouGov", endDate: "2025-10-14", sampleSize: 800,  sampleType: "RV", results: { Republican: 48, Democrat: 49 } },
  { pollster: "Hart Research (D)",                endDate: "2025-09-22", sampleSize: 800,  sampleType: "LV", results: { Republican: 45, Democrat: 48 } },
  { pollster: "Emerson College",                  endDate: "2025-08-19", sampleSize: 1000, sampleType: "RV", results: { Republican: 50, Democrat: 44 } },
  { pollster: "Bowling Green State Univ./YouGov", endDate: "2025-04-24", sampleSize: 800,  sampleType: "RV", results: { Republican: 49, Democrat: 46 } },
  { pollster: "Bowling Green State Univ./YouGov", endDate: "2025-02-21", sampleSize: 800,  sampleType: "RV", results: { Republican: 47, Democrat: 41 } },
];

// ── Nebraska Senate (Pete Ricketts vs. Dan Osborn) ────────────────────────────
const NE_OSBORN_POLLS: Poll[] = [
  { pollster: "Change Research (D)",       endDate: "2026-04-01", sampleSize: 524, sampleType: "LV", results: { Republican: 46, Independent: 45 } },
  { pollster: "Impact Research (D)",       endDate: "2026-02-05", sampleSize: 600, sampleType: "LV", results: { Republican: 48, Independent: 47 } },
  { pollster: "Lake Research Partners (D)",endDate: "2025-12-17", sampleSize: 900, sampleType: "LV", results: { Republican: 48, Independent: 47 } },
  { pollster: "Lake Research Partners (D)",endDate: "2025-07-29", sampleSize: 900, sampleType: "LV", results: { Republican: 46, Independent: 47 } },
];

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildAvg(polls: Poll[], mult = 3) {
  const adj = polls.map(p => ({ ...p, sampleSize: effN(p.pollster, p.sampleSize, mult) }));
  const keys = getCandidateList(polls);
  const { start, end } = getDateRange(polls);
  return buildDailyWeightedSeries(adj as any, keys, start, end) as any[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#141412", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "2px", padding: "10px 14px", fontSize: 11,
      fontFamily: "var(--font-body), monospace", boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
    }}>
      <div style={{color:"rgba(255,255,255,.3)",marginBottom:6,fontWeight:500,letterSpacing:"0.1em",textTransform:"uppercase",fontSize:9}}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:p.color,flexShrink:0}} />
          <span style={{color:"rgba(255,255,255,.4)"}}>{p.name}</span>
          <span style={{fontWeight:700,color:p.color,marginLeft:"auto",paddingLeft:14}}>{round1(p.value)}%</span>
        </div>
      ))}
    </div>
  );
}

function SplitBar({ a, b, colorA, colorB, h = 5 }: { a: number; b: number; colorA: string; colorB: string; h?: number }) {
  const total = a + b;
  if (!total) return null;
  const pct = (a / total) * 100;
  return (
    <div style={{display:"flex",height:h,overflow:"hidden",background:"rgba(255,255,255,.06)"}}>
      <div style={{width:`${pct}%`,background:colorA,transition:"width 700ms"}} />
      <div style={{flex:1,background:colorB}} />
    </div>
  );
}

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

function LargeChartPanel({
  title, eyebrow, data, lines, domain, refY, stats, pollCount,
}: {
  title: string; eyebrow: string; data: any[];
  lines: {key:string;name:string;color:string}[];
  domain:[number,number]; refY?:number;
  stats:{label:string;val:string;color:string}[];
  pollCount:number;
}) {
  const step = Math.max(1, Math.floor(data.length / 80));
  const pts  = data.filter((_,i) => i % step === 0 || i === data.length - 1);
  const axisTickDates: string[] = [];
  if (pts.length > 1) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const idx = Math.round(i * (pts.length - 1) / (count - 1));
      axisTickDates.push(pts[Math.min(idx, pts.length - 1)].date);
    }
  }
  const fmtTick = (v: string) => {
    const d = new Date(v + "T00:00:00");
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  };
  return (
    <div className="lcp-wrap">
      <div style={{height:3,background:"linear-gradient(90deg,#e63946 33%,#7c3aed 66%,#2563eb 100%)",flexShrink:0}} />
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
              dataKey="date" ticks={axisTickDates} tickFormatter={fmtTick}
              tick={{fontSize:8,fill:"rgba(255,255,255,.25)",fontFamily:"var(--font-body), monospace"}}
              tickLine={false} axisLine={false}
            />
            <YAxis
              domain={domain}
              tick={{fontSize:8,fill:"rgba(255,255,255,.25)",fontFamily:"var(--font-body), monospace"}}
              tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`}
            />
            <Tooltip content={<ChartTip />} />
            {refY !== undefined && (
              <ReferenceLine y={refY} stroke="rgba(255,255,255,.08)" strokeDasharray="4 4" />
            )}
            {lines.map(l => (
              <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
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

// ─────────────────────────────────────────────────────────────────────────────
// SENATE CHART + TABLE PANEL
// ─────────────────────────────────────────────────────────────────────────────

function SenatePollTable({
  polls, keys,
}: {
  polls: Poll[];
  keys: { key: string; name: string; color: string }[];
}) {
  const [expanded, setExpanded] = React.useState(false);
  const sorted = [...polls].sort((a, b) => b.endDate.localeCompare(a.endDate));
  const shown = expanded ? sorted : sorted.slice(0, 5);
  const hidden = sorted.length - 5;
  return (
    <div className="pt-wrap" style={{ marginBottom: 0, borderTop: "1px solid rgba(255,255,255,.07)" }}>
      <div style={{ overflowX: "auto" }}>
        <table className="pt-table">
          <thead>
            <tr>
              <th className="pt-th">Pollster</th>
              <th className="pt-th pt-right">Date</th>
              <th className="pt-th pt-right">N</th>
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
      {sorted.length > 5 && (
        <button className="pt-toggle" onClick={() => setExpanded(e => !e)}>
          {expanded ? `▲  Show less` : `▼  Show ${hidden} more poll${hidden !== 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}

// Generic Senate race panel — builds daily model, shows chart + table
function SenateRaceChartPanel({
  state, raceLabel, polls, lines, domain, eyebrow,
}: {
  state: string; raceLabel: string;
  polls: Poll[];
  lines: { key: string; name: string; color: string }[];
  domain: [number, number];
  eyebrow?: string;
}) {
  const daily = buildAvg(polls, 2);
  const last  = daily[daily.length - 1] ?? {};

  const latestVals = lines.map(l => ({
    ...l,
    val: round1(Number(last[l.key] ?? 0)),
  }));

  const [a, b] = latestVals;
  const spread = a && b ? round1(a.val - b.val) : null;
  const spreadStr = spread === null ? "—"
    : spread === 0 ? "EVEN"
    : spread > 0 ? `${a.name.split(" ")[0]}+${Math.abs(spread)}`
    : `${b.name.split(" ")[0]}+${Math.abs(spread)}`;
  const spreadColor = spread === null ? "rgba(255,255,255,.3)"
    : spread > 0 ? a.color
    : spread < 0 ? b.color
    : "rgba(255,255,255,.4)";

  const stats = [
    ...latestVals.map(l => ({ label: l.name, val: `${l.val}%`, color: l.color })),
    { label: "Margin", val: spreadStr, color: spreadColor },
    { label: "Polls", val: `${polls.length}`, color: "rgba(255,255,255,.3)" },
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      <LargeChartPanel
        title={raceLabel}
        eyebrow={eyebrow ?? `${state} · U.S. Senate · 2026`}
        data={daily}
        lines={lines}
        domain={domain}
        refY={50}
        stats={stats}
        pollCount={polls.length}
      />
      <SenatePollTable polls={polls} keys={lines} />
    </div>
  );
}

// Matchup-switcher panel for races with multiple candidate combos (Texas, Nebraska)
function SenateMultiMatchupPanel({
  state, raceLabel, matchups,
}: {
  state: string; raceLabel: string;
  matchups: {
    label: string;
    polls: Poll[];
    lines: { key: string; name: string; color: string }[];
    domain: [number, number];
  }[];
}) {
  const [selected, setSelected] = React.useState(0);
  const m = matchups[selected];
  return (
    <div style={{ marginBottom: 28 }}>
      {/* Matchup selector header injected above chart */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", background: "#0d0d12",
        border: "1px solid rgba(255,255,255,.09)", borderBottom: "none",
      }}>
        <div style={{ fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,.25)" }}>
          {state} · Matchup
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {matchups.map((mu, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              style={{
                padding: "4px 10px",
                background: selected === i ? "rgba(124,58,237,.15)" : "transparent",
                border: selected === i ? "1px solid rgba(124,58,237,.4)" : "1px solid rgba(255,255,255,.1)",
                color: selected === i ? "#9d5cf0" : "rgba(255,255,255,.3)",
                fontSize: 9, letterSpacing: "0.1em", cursor: "pointer",
                fontFamily: "var(--font-body), ui-monospace, monospace",
                transition: "all 120ms",
              }}
            >
              {mu.label}
            </button>
          ))}
        </div>
      </div>
      <SenateRaceChartPanel
        state={state}
        raceLabel={raceLabel}
        polls={m.polls}
        lines={m.lines}
        domain={m.domain}
        eyebrow={`${state} · U.S. Senate · 2026 · ${m.label}`}
      />
    </div>
  );
}

// Florida Primary — multi-candidate line chart
function FLPrimaryChartPanel() {
  const lines = [
    { key: "Donalds",  name: "Donalds",  color: "#f5a623" },
    { key: "Collins",  name: "Collins",  color: "#e63946" },
    { key: "Fishback", name: "Fishback", color: "#7c3aed" },
    { key: "Renner",   name: "Renner",   color: "#2563eb" },
  ];

  const daily = buildAvg(FL_SENATE_POLLS, 2);
  const last  = daily[daily.length - 1] ?? {};
  const latestVals = lines.map(l => ({ ...l, val: round1(Number(last[l.key] ?? 0)) }));

  const stats = [
    ...latestVals.map(l => ({ label: l.name, val: `${l.val}%`, color: l.color })),
    { label: "Polls", val: `${FL_SENATE_POLLS.length}`, color: "rgba(255,255,255,.3)" },
  ];

  const [expanded, setExpanded] = React.useState(false);
  const sorted = [...FL_SENATE_POLLS].sort((a, b) => b.endDate.localeCompare(a.endDate));
  const shown = expanded ? sorted : sorted.slice(0, 6);
  const hidden = sorted.length - 6;

  return (
    <div style={{ marginBottom: 28 }}>
      <LargeChartPanel
        title="Florida Republican Senate Primary"
        eyebrow="Florida · U.S. Senate · 2026 Republican Primary"
        data={daily}
        lines={lines}
        domain={[0, 60]}
        stats={stats}
        pollCount={FL_SENATE_POLLS.length}
      />
      {/* Custom table showing all 4 candidates */}
      <div className="pt-wrap" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="pt-table">
            <thead>
              <tr>
                <th className="pt-th">Pollster</th>
                <th className="pt-th pt-right">Date</th>
                <th className="pt-th pt-right">N</th>
                <th className="pt-th pt-right">Type</th>
                {lines.map(l => (
                  <th key={l.key} className="pt-th pt-right" style={{ color: l.color }}>{l.name}</th>
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
                  {lines.map(l => (
                    <td key={l.key} className="pt-td pt-right" style={{ color: l.color, fontWeight: 600 }}>
                      {p.results[l.key] !== undefined ? `${round1(Number(p.results[l.key]))}%` : "—"}
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
    </div>
  );
}

function SenateSection() {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        marginBottom: 22, paddingTop: 8,
        borderTop: "1px solid rgba(255,255,255,.06)",
      }}>
        <div style={{
          fontSize: 7.5, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase",
          color: "#9d5cf0", whiteSpace: "nowrap",
        }}>
          2026 U.S. Senate Races
        </div>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
      </div>

      {/* Texas — matchup switcher */}
      <SenateMultiMatchupPanel
        state="Texas"
        raceLabel="Texas Senate vs. James Talarico (D)"
        matchups={[
          {
            label: "Cornyn vs. Talarico",
            polls: TX_CORNYN_POLLS,
            lines: [
              { key: "Republican", name: "Cornyn (R)", color: "#e63946" },
              { key: "Democrat",   name: "Talarico (D)", color: "#2563eb" },
            ],
            domain: [30, 60],
          },
          {
            label: "Paxton vs. Talarico",
            polls: TX_PAXTON_POLLS,
            lines: [
              { key: "Republican", name: "Paxton (R)",   color: "#e63946" },
              { key: "Democrat",   name: "Talarico (D)", color: "#2563eb" },
            ],
            domain: [30, 60],
          },
        ]}
      />

      {/* Florida Republican Primary */}
      <FLPrimaryChartPanel />

      {/* South Carolina */}
      <SenateRaceChartPanel
        state="South Carolina"
        raceLabel="Lindsey Graham (R) vs. Annie Andrews (D)"
        polls={SC_GRAHAM_POLLS}
        lines={[
          { key: "Republican", name: "Graham (R)",   color: "#e63946" },
          { key: "Democrat",   name: "Andrews (D)",  color: "#2563eb" },
        ]}
        domain={[30, 60]}
      />

      {/* Ohio */}
      <SenateRaceChartPanel
        state="Ohio"
        raceLabel="Jon Husted (R) vs. Sherrod Brown (D)"
        polls={OH_SENATE_POLLS}
        lines={[
          { key: "Republican", name: "Husted (R)", color: "#e63946" },
          { key: "Democrat",   name: "Brown (D)",  color: "#2563eb" },
        ]}
        domain={[35, 60]}
      />

      {/* Nebraska — Ricketts vs. Osborn */}
      <SenateRaceChartPanel
        state="Nebraska"
        raceLabel="Pete Ricketts (R) vs. Dan Osborn (I)"
        polls={NE_OSBORN_POLLS}
        lines={[
          { key: "Republican",  name: "Ricketts (R)", color: "#e63946" },
          { key: "Independent", name: "Osborn (I)",   color: "#f5a623" },
        ]}
        domain={[35, 60]}
      />

      {/* Nebraska — Hinson matchups */}
      <SenateMultiMatchupPanel
        state="Nebraska"
        raceLabel="Ashley Hinson (R) vs. Democratic Candidates"
        matchups={[
          {
            label: "Hinson vs. Turek",
            polls: NE_TUREK_POLLS,
            lines: [
              { key: "Republican", name: "Hinson (R)", color: "#e63946" },
              { key: "Democrat",   name: "Turek (D)",  color: "#2563eb" },
            ],
            domain: [35, 60],
          },
          {
            label: "Hinson vs. Wahls",
            polls: NE_WAHLS_POLLS,
            lines: [
              { key: "Republican", name: "Hinson (R)", color: "#e63946" },
              { key: "Democrat",   name: "Wahls (D)",  color: "#2563eb" },
            ],
            domain: [35, 60],
          },
        ]}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
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
    { key: "Approve",    name: "Approve",    color: "#e63946" },
    { key: "Disapprove", name: "Disapprove", color: "#2563eb" },
  ];
  const gbKeys = [
    { key: "Democrats",   name: "Democrats",   color: "#2563eb" },
    { key: "Republicans", name: "Republicans", color: "#e63946" },
  ];
  const rtKeys = [
    { key: "RightTrack", name: "Right Track", color: "#e63946" },
    { key: "WrongTrack", name: "Wrong Track", color: "#2563eb" },
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
                and direction of country — plus 2026 Senate race polling with full daily model charts.
                Weighted daily model with recency decay and Gold Standard upweighting.
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
                  label:"Trump Approval", primary:`${approve}%`, primaryColor:"#e63946",
                  secondary:apNetStr, secondaryColor:approvalNet>=0?"#e63946":"#2563eb",
                  secondaryLabel:"Net", a:approve, b:disapprove, colorA:"#e63946", colorB:"#2563eb",
                  subLeft:`${approve}% App.`, subRight:`${disapprove}% Dis.`,
                },
                {
                  label:"Generic Ballot", primary:gbNetStr, primaryColor:gbNet>=0?"#2563eb":"#e63946",
                  secondary:`D ${dem}% / R ${rep}%`, secondaryColor:"rgba(255,255,255,.35)",
                  secondaryLabel:"Split", a:dem, b:rep, colorA:"#2563eb", colorB:"#e63946",
                  subLeft:`D ${dem}%`, subRight:`R ${rep}%`,
                },
                {
                  label:"Right / Wrong Track", primary:`${wt}%`, primaryColor:"#e63946",
                  secondary:rtNetStr, secondaryColor:rtNet>=0?"#e63946":"#2563eb",
                  secondaryLabel:"Spread", a:rt, b:wt, colorA:"#e63946", colorB:"#2563eb",
                  subLeft:`${rt}% Right`, subRight:`${wt}% Wrong`,
                },
              ].map(m => (
                <div key={m.label} className="pd-metric-card">
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
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ APPROVAL CHART + TABLE ══ */}
        <LargeChartPanel
          title="Donald Trump Job Approval Rating"
          eyebrow="47th President of the United States"
          data={trumpDaily} lines={approvalKeys}
          domain={[30,65]} refY={50}
          stats={[
            {label:"Approve",    val:`${approve}%`,    color:"#e63946"},
            {label:"Disapprove", val:`${disapprove}%`, color:"#2563eb"},
            {label:"Net",        val:apNetStr,          color:approvalNet>=0?"#e63946":"#2563eb"},
            {label:"Polls",      val:`${TRUMP_POLLS.length}`, color:"rgba(255,255,255,.3)"},
          ]}
          pollCount={TRUMP_POLLS.length}
        />
        <PollTable polls={TRUMP_POLLS} keys={approvalKeys} />

        {/* ══ GENERIC BALLOT CHART + TABLE ══ */}
        <LargeChartPanel
          title="2026 National Generic Ballot"
          eyebrow="2026 Midterm Elections · U.S. House of Representatives"
          data={gbDaily} lines={gbKeys}
          domain={[35,58]} refY={50}
          stats={[
            {label:"Democrat",   val:`${dem}%`, color:"#2563eb"},
            {label:"Republican", val:`${rep}%`, color:"#e63946"},
            {label:"Margin",     val:gbNetStr,  color:gbNet>=0?"#2563eb":"#e63946"},
            {label:"Polls",      val:`${GB_POLLS.length}`, color:"rgba(255,255,255,.3)"},
          ]}
          pollCount={GB_POLLS.length}
        />
        <PollTable polls={GB_POLLS} keys={gbKeys} />

        {/* ══ RIGHT/WRONG TRACK CHART + TABLE ══ */}
        <LargeChartPanel
          title="Right Track / Wrong Track"
          eyebrow="National Sentiment · Direction of the Country"
          data={rtDaily} lines={rtKeys}
          domain={[20,75]}
          stats={[
            {label:"Right",  val:`${rt}%`, color:"#e63946"},
            {label:"Wrong",  val:`${wt}%`, color:"#2563eb"},
            {label:"Spread", val:rtNetStr, color:rtNet>=0?"#e63946":"#2563eb"},
            {label:"Polls",  val:`${RT_POLLS.length}`, color:"rgba(255,255,255,.3)"},
          ]}
          pollCount={RT_POLLS.length}
        />
        <PollTable polls={RT_POLLS} keys={rtKeys} />

        {/* ══ SENATE RACES ══ */}
        <SenateSection />

        {/* ══ FOOTER ══ */}
        <div className="pd-footer">
          <span>PSI · All averages: documented weighting · recency decay · sample size adjustment · daily model for all races</span>
          <span style={{color:"rgba(255,255,255,.15)"}}>Methodology on file</span>
        </div>

      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
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
    --purple-soft: #9d5cf0;
    max-width: 1320px;
    margin: 0 auto;
    padding: 28px 28px 72px;
    font-family: var(--font-body), ui-monospace, monospace;
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
    background: linear-gradient(90deg, #e63946 33%, #7c3aed 66%, #2563eb 100%);
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
    width: 5px; height: 5px; border-radius: 50%; background: #7c3aed; flex-shrink: 0;
    box-shadow: 0 0 6px rgba(124,58,237,.5);
    animation: pd-pulse 1.8s ease-in-out infinite;
  }
  @keyframes pd-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  .pd-hero-title {
    font-family: var(--font-display), sans-serif;
    font-size: clamp(44px,5.5vw,80px);
    letter-spacing: 0.03em; line-height: 0.92;
    color: #fff; margin: 0 0 16px; text-transform: uppercase;
  }
  .pd-hero-title em { font-style: normal; color: #9d5cf0; }
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
  .pd-badge-live { border-color: rgba(124,58,237,.3); background: rgba(124,58,237,.07); color: #9d5cf0; }
  .pd-live-dot-sm {
    width: 5px; height: 5px; border-radius: 50%; background: #7c3aed;
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
  .pd-metric-card:hover { background: rgba(255,255,255,.02); }
  .pd-metric-label {
    font-size: 7.5px; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase;
    color: rgba(255,255,255,.25); margin-bottom: 6px;
  }
  .pd-metric-primary {
    font-family: var(--font-display), sans-serif;
    font-size: 42px; letter-spacing: 0.03em; line-height: 1; margin-bottom: 8px; text-transform: uppercase;
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
    flex-wrap: wrap;
  }
  .lcp-eyebrow {
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--purple-soft, #9d5cf0); margin-bottom: 6px;
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
    flex-wrap: wrap;
  }
  .lcp-stat {
    padding: 10px 16px;
    border-right: 1px solid rgba(255,255,255,.06);
    min-width: 72px;
  }
  .lcp-stat:last-child { border-right: none; }
  .lcp-stat-label {
    font-size: 7px; letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(255,255,255,.2); margin-bottom: 4px;
  }
  .lcp-stat-val {
    font-family: var(--font-display), sans-serif;
    font-size: 24px; letter-spacing: 0.04em; line-height: 1; text-transform: uppercase;
  }
  .lcp-chart-area {
    height: 260px; padding: 16px 8px 8px; background: #0f0f15;
  }
  .lcp-legend {
    display: flex; gap: 24px; padding: 12px 24px; flex-wrap: wrap;
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
    font-family: var(--font-body), ui-monospace, monospace;
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
    font-family: var(--font-body), ui-monospace, monospace;
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