"use client";

import React from "react";
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
  { pollster:"Morning Consult",   endDate:"2026-03-16", sampleSize:2200, sampleType:"RV", results:{Approve:43,Disapprove:54} },
  { pollster:"Economist/YouGov",  endDate:"2026-03-16", sampleSize:1429, sampleType:"RV", results:{Approve:41,Disapprove:56} },
  { pollster:"Rasmussen Reports", endDate:"2026-03-16", sampleSize:1500, sampleType:"LV", results:{Approve:44,Disapprove:54} },
  { pollster:"Quinnipiac",        endDate:"2026-03-08", sampleSize:1002, sampleType:"RV", results:{Approve:37,Disapprove:57} },
  { pollster:"RMG Research",      endDate:"2026-03-12", sampleSize:3000, sampleType:"RV", results:{Approve:45,Disapprove:53} },
  { pollster:"NPR/PBS/Marist",    endDate:"2026-03-04", sampleSize:1392, sampleType:"RV", results:{Approve:40,Disapprove:57} },
  { pollster:"NBC News",          endDate:"2026-03-03", sampleSize:1000, sampleType:"RV", results:{Approve:44,Disapprove:54} },
  { pollster:"Rasmussen Reports", endDate:"2026-03-09", sampleSize:1500, sampleType:"LV", results:{Approve:46,Disapprove:53} },
  { pollster:"Economist/YouGov",  endDate:"2026-03-09", sampleSize:1405, sampleType:"RV", results:{Approve:43,Disapprove:54} },
  { pollster:"Fox News",          endDate:"2026-03-02", sampleSize:1004, sampleType:"RV", results:{Approve:43,Disapprove:57} },
  { pollster:"Economist/YouGov",  endDate:"2026-03-02", sampleSize:1366, sampleType:"RV", results:{Approve:42,Disapprove:56} },
  { pollster:"Rasmussen Reports", endDate:"2026-03-03", sampleSize:1500, sampleType:"LV", results:{Approve:45,Disapprove:54} },
  { pollster:"Reuters/Ipsos",     endDate:"2026-03-01", sampleSize:1282, sampleType:"A",  results:{Approve:38,Disapprove:60} },
  { pollster:"CBS News",          endDate:"2026-02-27", sampleSize:2264, sampleType:"A",  results:{Approve:41,Disapprove:59} },
  { pollster:"Trafalgar Group",   endDate:"2026-02-25", sampleSize:1084, sampleType:"LV", results:{Approve:51,Disapprove:48} },
  { pollster:"Rasmussen Reports", endDate:"2026-02-26", sampleSize:1500, sampleType:"LV", results:{Approve:45,Disapprove:53} },
  { pollster:"Emerson",           endDate:"2026-02-22", sampleSize:1000, sampleType:"LV", results:{Approve:43,Disapprove:55} },
  { pollster:"Economist/YouGov",  endDate:"2026-02-23", sampleSize:1402, sampleType:"RV", results:{Approve:42,Disapprove:57} },
  { pollster:"CNN",               endDate:"2026-02-20", sampleSize:1000, sampleType:"RV", results:{Approve:39,Disapprove:61} },
  { pollster:"InsiderAdvantage",  endDate:"2026-02-18", sampleSize:800,  sampleType:"LV", results:{Approve:50,Disapprove:46} },
  { pollster:"Big Data Poll",     endDate:"2026-02-18", sampleSize:2012, sampleType:"RV", results:{Approve:42,Disapprove:55} },
  { pollster:"Morning Consult",   endDate:"2026-02-16", sampleSize:2200, sampleType:"RV", results:{Approve:43,Disapprove:55} },
  { pollster:"Economist/YouGov",  endDate:"2026-02-16", sampleSize:1512, sampleType:"RV", results:{Approve:43,Disapprove:55} },
  { pollster:"AP/NORC",           endDate:"2026-02-09", sampleSize:1156, sampleType:"A",  results:{Approve:36,Disapprove:62} },
  { pollster:"Rasmussen Reports", endDate:"2026-02-16", sampleSize:1500, sampleType:"LV", results:{Approve:47,Disapprove:51} },
  { pollster:"Morning Consult",   endDate:"2026-02-09", sampleSize:2200, sampleType:"RV", results:{Approve:44,Disapprove:53} },
  { pollster:"Quinnipiac",        endDate:"2026-02-02", sampleSize:1191, sampleType:"RV", results:{Approve:37,Disapprove:56} },
  { pollster:"InsiderAdvantage",  endDate:"2026-02-01", sampleSize:1000, sampleType:"LV", results:{Approve:50,Disapprove:49} },
  { pollster:"NPR/PBS/Marist",    endDate:"2026-01-30", sampleSize:1326, sampleType:"RV", results:{Approve:39,Disapprove:57} },
  { pollster:"Morning Consult",   endDate:"2026-02-01", sampleSize:2201, sampleType:"RV", results:{Approve:45,Disapprove:53} },
  { pollster:"Economist/YouGov",  endDate:"2026-02-02", sampleSize:1504, sampleType:"RV", results:{Approve:42,Disapprove:55} },
  { pollster:"Harvard-Harris",    endDate:"2026-01-29", sampleSize:2000, sampleType:"RV", results:{Approve:45,Disapprove:51} },
  { pollster:"FOX News",          endDate:"2026-01-26", sampleSize:1005, sampleType:"RV", results:{Approve:44,Disapprove:56} },
  { pollster:"Economist/YouGov",  endDate:"2026-01-26", sampleSize:1520, sampleType:"RV", results:{Approve:41,Disapprove:57} },
  { pollster:"Morning Consult",   endDate:"2026-01-25", sampleSize:2201, sampleType:"RV", results:{Approve:45,Disapprove:52} },
  { pollster:"Big Data Poll",     endDate:"2026-01-24", sampleSize:3280, sampleType:"RV", results:{Approve:45,Disapprove:52} },
  { pollster:"Pew Research",      endDate:"2026-01-26", sampleSize:8512, sampleType:"A",  results:{Approve:37,Disapprove:61} },
  { pollster:"Emerson",           endDate:"2026-01-19", sampleSize:1000, sampleType:"LV", results:{Approve:43,Disapprove:51} },
  { pollster:"Morning Consult",   endDate:"2026-01-18", sampleSize:2201, sampleType:"RV", results:{Approve:46,Disapprove:51} },
  { pollster:"CBS News",          endDate:"2026-01-16", sampleSize:2523, sampleType:"A",  results:{Approve:41,Disapprove:59} },
  { pollster:"NY Times/Siena",    endDate:"2026-01-17", sampleSize:1625, sampleType:"RV", results:{Approve:40,Disapprove:56} },
  { pollster:"Reuters/Ipsos",     endDate:"2026-01-13", sampleSize:1217, sampleType:"A",  results:{Approve:41,Disapprove:58} },
  { pollster:"CNN",               endDate:"2026-01-12", sampleSize:968,  sampleType:"RV", results:{Approve:40,Disapprove:59} },
  { pollster:"Wall Street Journal",endDate:"2026-01-13",sampleSize:1500, sampleType:"RV", results:{Approve:45,Disapprove:54} },
  { pollster:"Economist/YouGov",  endDate:"2026-01-12", sampleSize:1437, sampleType:"RV", results:{Approve:44,Disapprove:54} },
  { pollster:"Morning Consult",   endDate:"2026-01-12", sampleSize:2201, sampleType:"RV", results:{Approve:45,Disapprove:53} },
  { pollster:"Gallup",            endDate:"2025-12-15", sampleSize:1016, sampleType:"A",  results:{Approve:36,Disapprove:59} },
  { pollster:"CBS News",          endDate:"2025-12-19", sampleSize:2300, sampleType:"A",  results:{Approve:41,Disapprove:59} },
  { pollster:"Morning Consult",   endDate:"2025-12-15", sampleSize:2201, sampleType:"RV", results:{Approve:46,Disapprove:52} },
  { pollster:"Big Data Poll",     endDate:"2025-12-12", sampleSize:3004, sampleType:"RV", results:{Approve:47,Disapprove:50} },
  { pollster:"Economist/YouGov",  endDate:"2025-12-08", sampleSize:1380, sampleType:"RV", results:{Approve:43,Disapprove:54} },
  { pollster:"Rasmussen Reports", endDate:"2025-12-09", sampleSize:1500, sampleType:"LV", results:{Approve:46,Disapprove:51} },
  { pollster:"Harvard-Harris",    endDate:"2025-12-04", sampleSize:2204, sampleType:"RV", results:{Approve:47,Disapprove:49} },
  { pollster:"Morning Consult",   endDate:"2025-12-07", sampleSize:2201, sampleType:"RV", results:{Approve:45,Disapprove:52} },
  { pollster:"Economist/YouGov",  endDate:"2025-11-24", sampleSize:1511, sampleType:"RV", results:{Approve:43,Disapprove:56} },
  { pollster:"CBS News",          endDate:"2025-11-21", sampleSize:2489, sampleType:"A",  results:{Approve:40,Disapprove:60} },
  { pollster:"Morning Consult",   endDate:"2025-11-16", sampleSize:2201, sampleType:"RV", results:{Approve:46,Disapprove:52} },
  { pollster:"Gallup",            endDate:"2025-11-25", sampleSize:1321, sampleType:"A",  results:{Approve:36,Disapprove:60} },
  { pollster:"Morning Consult",   endDate:"2025-10-26", sampleSize:2202, sampleType:"RV", results:{Approve:46,Disapprove:51} },
  { pollster:"Economist/YouGov",  endDate:"2025-10-27", sampleSize:1476, sampleType:"RV", results:{Approve:43,Disapprove:55} },
  { pollster:"Rasmussen Reports", endDate:"2025-10-28", sampleSize:1500, sampleType:"LV", results:{Approve:45,Disapprove:53} },
  { pollster:"Harvard-Harris",    endDate:"2025-10-02", sampleSize:2413, sampleType:"RV", results:{Approve:46,Disapprove:50} },
  { pollster:"Morning Consult",   endDate:"2025-09-28", sampleSize:2202, sampleType:"RV", results:{Approve:46,Disapprove:52} },
  { pollster:"Economist/YouGov",  endDate:"2025-09-29", sampleSize:1518, sampleType:"RV", results:{Approve:43,Disapprove:54} },
];

const GB_POLLS: Poll[] = [
  { pollster:"Morning Consult",   endDate:"2026-03-16", sampleSize:2200, sampleType:"RV", results:{Democrats:48,Republicans:40} },
  { pollster:"Economist/YouGov",  endDate:"2026-03-16", sampleSize:1429, sampleType:"RV", results:{Democrats:43,Republicans:41} },
  { pollster:"Economist/YouGov",  endDate:"2026-03-09", sampleSize:1405, sampleType:"RV", results:{Democrats:45,Republicans:42} },
  { pollster:"NPR/PBS/Marist",    endDate:"2026-03-04", sampleSize:1392, sampleType:"RV", results:{Democrats:53,Republicans:44} },
  { pollster:"NBC News",          endDate:"2026-03-03", sampleSize:1000, sampleType:"RV", results:{Democrats:50,Republicans:44} },
  { pollster:"Economist/YouGov",  endDate:"2026-03-02", sampleSize:1366, sampleType:"RV", results:{Democrats:45,Republicans:41} },
  { pollster:"CBS News",          endDate:"2026-02-27", sampleSize:2264, sampleType:"A",  results:{Democrats:45,Republicans:40} },
  { pollster:"Harvard-Harris",    endDate:"2026-02-26", sampleSize:1999, sampleType:"RV", results:{Democrats:50,Republicans:50} },
  { pollster:"Emerson",           endDate:"2026-02-22", sampleSize:1000, sampleType:"LV", results:{Democrats:50,Republicans:42} },
  { pollster:"Morning Consult",   endDate:"2026-02-22", sampleSize:2202, sampleType:"RV", results:{Democrats:46,Republicans:42} },
  { pollster:"Economist/YouGov",  endDate:"2026-02-23", sampleSize:1402, sampleType:"RV", results:{Democrats:45,Republicans:41} },
  { pollster:"Big Data Poll",     endDate:"2026-02-18", sampleSize:1805, sampleType:"LV", results:{Democrats:50,Republicans:41} },
  { pollster:"Economist/YouGov",  endDate:"2026-02-16", sampleSize:1512, sampleType:"RV", results:{Democrats:47,Republicans:40} },
  { pollster:"Morning Consult",   endDate:"2026-02-09", sampleSize:2200, sampleType:"RV", results:{Democrats:45,Republicans:41} },
  { pollster:"PPP",               endDate:"2026-01-30", sampleSize:652,  sampleType:"RV", results:{Democrats:48,Republicans:41} },
  { pollster:"Harvard-Harris",    endDate:"2026-01-29", sampleSize:2000, sampleType:"RV", results:{Democrats:52,Republicans:48} },
  { pollster:"FOX News",          endDate:"2026-01-26", sampleSize:1005, sampleType:"RV", results:{Democrats:52,Republicans:46} },
  { pollster:"Economist/YouGov",  endDate:"2026-01-26", sampleSize:1520, sampleType:"RV", results:{Democrats:43,Republicans:38} },
  { pollster:"Morning Consult",   endDate:"2026-01-25", sampleSize:2201, sampleType:"RV", results:{Democrats:45,Republicans:43} },
  { pollster:"Big Data Poll",     endDate:"2026-01-24", sampleSize:2909, sampleType:"LV", results:{Democrats:48,Republicans:44} },
  { pollster:"Emerson",           endDate:"2026-01-19", sampleSize:1000, sampleType:"LV", results:{Democrats:48,Republicans:42} },
  { pollster:"Economist/YouGov",  endDate:"2026-01-19", sampleSize:1549, sampleType:"RV", results:{Democrats:43,Republicans:39} },
  { pollster:"Morning Consult",   endDate:"2026-01-18", sampleSize:2201, sampleType:"RV", results:{Democrats:45,Republicans:43} },
  { pollster:"NY Times/Siena",    endDate:"2026-01-17", sampleSize:1625, sampleType:"RV", results:{Democrats:48,Republicans:43} },
  { pollster:"Rasmussen Reports", endDate:"2026-01-14", sampleSize:2273, sampleType:"LV", results:{Democrats:47,Republicans:41} },
  { pollster:"CNN",               endDate:"2026-01-12", sampleSize:968,  sampleType:"RV", results:{Democrats:46,Republicans:41} },
  { pollster:"Morning Consult",   endDate:"2026-01-12", sampleSize:2201, sampleType:"RV", results:{Democrats:46,Republicans:43} },
  { pollster:"Economist/YouGov",  endDate:"2026-01-12", sampleSize:1437, sampleType:"RV", results:{Democrats:44,Republicans:40} },
  { pollster:"Economist/YouGov",  endDate:"2025-12-29", sampleSize:1420, sampleType:"RV", results:{Democrats:42,Republicans:38} },
  { pollster:"Big Data Poll",     endDate:"2025-12-28", sampleSize:3412, sampleType:"LV", results:{Democrats:49,Republicans:44} },
  { pollster:"Morning Consult",   endDate:"2025-12-15", sampleSize:2201, sampleType:"RV", results:{Democrats:45,Republicans:44} },
  { pollster:"Economist/YouGov",  endDate:"2025-12-15", sampleSize:1453, sampleType:"RV", results:{Democrats:43,Republicans:39} },
  { pollster:"Morning Consult",   endDate:"2025-11-16", sampleSize:2201, sampleType:"RV", results:{Democrats:46,Republicans:44} },
  { pollster:"NPR/PBS/Marist",    endDate:"2025-11-13", sampleSize:1291, sampleType:"RV", results:{Democrats:55,Republicans:41} },
  { pollster:"Economist/YouGov",  endDate:"2025-11-10", sampleSize:1500, sampleType:"RV", results:{Democrats:46,Republicans:39} },
  { pollster:"Morning Consult",   endDate:"2025-10-26", sampleSize:2202, sampleType:"RV", results:{Democrats:45,Republicans:42} },
  { pollster:"Economist/YouGov",  endDate:"2025-10-27", sampleSize:1476, sampleType:"RV", results:{Democrats:43,Republicans:40} },
  { pollster:"Emerson",           endDate:"2025-10-14", sampleSize:1000, sampleType:"RV", results:{Democrats:44,Republicans:43} },
  { pollster:"NY Times/Siena",    endDate:"2025-09-27", sampleSize:1313, sampleType:"RV", results:{Democrats:47,Republicans:45} },
  { pollster:"Economist/YouGov",  endDate:"2025-09-29", sampleSize:1518, sampleType:"RV", results:{Democrats:44,Republicans:41} },
];

const RT_POLLS: Poll[] = [
  { pollster:"Economist/YouGov",      endDate:"2026-03-16", sampleSize:1429,  sampleType:"RV", results:{RightTrack:34,WrongTrack:59} },
  { pollster:"Rasmussen Reports",     endDate:"2026-03-12", sampleSize:1845,  sampleType:"LV", results:{RightTrack:41,WrongTrack:54} },
  { pollster:"Economist/YouGov",      endDate:"2026-03-09", sampleSize:1405,  sampleType:"RV", results:{RightTrack:35,WrongTrack:59} },
  { pollster:"NPR/PBS/Marist",        endDate:"2026-03-04", sampleSize:1392,  sampleType:"RV", results:{RightTrack:40,WrongTrack:60} },
  { pollster:"Rasmussen Reports",     endDate:"2026-03-05", sampleSize:1851,  sampleType:"LV", results:{RightTrack:41,WrongTrack:54} },
  { pollster:"Economist/YouGov",      endDate:"2026-03-02", sampleSize:1366,  sampleType:"RV", results:{RightTrack:34,WrongTrack:58} },
  { pollster:"Harvard-Harris",        endDate:"2026-02-26", sampleSize:1999,  sampleType:"RV", results:{RightTrack:38,WrongTrack:52} },
  { pollster:"Rasmussen Reports",     endDate:"2026-02-26", sampleSize:1887,  sampleType:"LV", results:{RightTrack:40,WrongTrack:54} },
  { pollster:"Economist/YouGov",      endDate:"2026-02-23", sampleSize:1402,  sampleType:"RV", results:{RightTrack:34,WrongTrack:58} },
  { pollster:"Big Data Poll",         endDate:"2026-02-18", sampleSize:2012,  sampleType:"RV", results:{RightTrack:36,WrongTrack:57} },
  { pollster:"Economist/YouGov",      endDate:"2026-02-16", sampleSize:1512,  sampleType:"RV", results:{RightTrack:32,WrongTrack:60} },
  { pollster:"Rasmussen Reports",     endDate:"2026-02-19", sampleSize:1899,  sampleType:"LV", results:{RightTrack:44,WrongTrack:51} },
  { pollster:"NBC News Decision Desk",endDate:"2026-02-06", sampleSize:21995, sampleType:"A",  results:{RightTrack:35,WrongTrack:65} },
  { pollster:"Harvard-Harris",        endDate:"2026-01-29", sampleSize:2000,  sampleType:"RV", results:{RightTrack:38,WrongTrack:52} },
  { pollster:"Rasmussen Reports",     endDate:"2026-01-29", sampleSize:1890,  sampleType:"LV", results:{RightTrack:41,WrongTrack:54} },
  { pollster:"Economist/YouGov",      endDate:"2026-01-26", sampleSize:1520,  sampleType:"RV", results:{RightTrack:33,WrongTrack:60} },
  { pollster:"Big Data Poll",         endDate:"2026-01-24", sampleSize:3280,  sampleType:"RV", results:{RightTrack:36,WrongTrack:53} },
  { pollster:"Emerson",               endDate:"2026-01-19", sampleSize:1000,  sampleType:"LV", results:{RightTrack:44,WrongTrack:56} },
  { pollster:"Economist/YouGov",      endDate:"2026-01-19", sampleSize:1549,  sampleType:"RV", results:{RightTrack:34,WrongTrack:59} },
  { pollster:"NY Times/Siena",        endDate:"2026-01-17", sampleSize:1625,  sampleType:"RV", results:{RightTrack:37,WrongTrack:56} },
  { pollster:"Wall Street Journal",   endDate:"2026-01-13", sampleSize:1500,  sampleType:"RV", results:{RightTrack:39,WrongTrack:57} },
  { pollster:"Economist/YouGov",      endDate:"2026-01-12", sampleSize:1437,  sampleType:"RV", results:{RightTrack:34,WrongTrack:59} },
  { pollster:"Rasmussen Reports",     endDate:"2026-01-08", sampleSize:1880,  sampleType:"LV", results:{RightTrack:41,WrongTrack:53} },
  { pollster:"Economist/YouGov",      endDate:"2026-01-05", sampleSize:1389,  sampleType:"RV", results:{RightTrack:38,WrongTrack:56} },
  { pollster:"Big Data Poll",         endDate:"2025-12-28", sampleSize:3412,  sampleType:"LV", results:{RightTrack:36,WrongTrack:54} },
  { pollster:"Harvard-Harris",        endDate:"2025-12-04", sampleSize:2204,  sampleType:"RV", results:{RightTrack:39,WrongTrack:52} },
  { pollster:"Economist/YouGov",      endDate:"2025-12-08", sampleSize:1380,  sampleType:"RV", results:{RightTrack:36,WrongTrack:57} },
  { pollster:"Big Data Poll",         endDate:"2025-12-12", sampleSize:3004,  sampleType:"RV", results:{RightTrack:38,WrongTrack:52} },
  { pollster:"NBC News Decision Desk",endDate:"2025-12-08", sampleSize:20252, sampleType:"A",  results:{RightTrack:36,WrongTrack:64} },
  { pollster:"Economist/YouGov",      endDate:"2025-11-24", sampleSize:1511,  sampleType:"RV", results:{RightTrack:37,WrongTrack:55} },
  { pollster:"Economist/YouGov",      endDate:"2025-11-10", sampleSize:1500,  sampleType:"RV", results:{RightTrack:35,WrongTrack:58} },
  { pollster:"Harvard-Harris",        endDate:"2025-11-06", sampleSize:2000,  sampleType:"RV", results:{RightTrack:35,WrongTrack:54} },
  { pollster:"Economist/YouGov",      endDate:"2025-10-27", sampleSize:1476,  sampleType:"RV", results:{RightTrack:35,WrongTrack:59} },
  { pollster:"Harvard-Harris",        endDate:"2025-10-02", sampleSize:2413,  sampleType:"RV", results:{RightTrack:40,WrongTrack:50} },
  { pollster:"NY Times/Siena",        endDate:"2025-09-27", sampleSize:1313,  sampleType:"RV", results:{RightTrack:36,WrongTrack:58} },
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
    <div style={{
      background: "#141412",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "2px",
      padding: "10px 14px",
      fontSize: 11,
      fontFamily: "var(--font-body), monospace",
      boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
    }}>
      <div style={{ color: "rgba(255,255,255,0.3)", marginBottom: 6, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 9 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ color: "rgba(255,255,255,0.4)" }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: p.color, marginLeft: "auto", paddingLeft: 14 }}>{round1(p.value)}%</span>
        </div>
      ))}
    </div>
  );
}

function SplitBar({ dem, rep, h = 6 }: { dem: number; rep: number; h?: number }) {
  const pct = (dem / (dem + rep)) * 100;
  return (
    <div style={{ display: "flex", height: h, borderRadius: 1, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
      <div style={{ width: `${pct}%`, background: "#2563eb", transition: "width 700ms cubic-bezier(0.22,1,0.36,1)" }} />
      <div style={{ flex: 1, background: "#e63946" }} />
    </div>
  );
}

function SpreadBadge({ a, b }: { a: number; b: number }) {
  const diff = round1(Math.abs(a - b));
  const lead = a > b ? "D" : "R";
  const color = a > b ? "#2563eb" : "#e63946";
  const bg    = a > b ? "rgba(37,99,235,0.12)" : "rgba(230,57,70,0.12)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 2,
      fontFamily: "var(--font-body), monospace", fontSize: 11, fontWeight: 500,
      color, background: bg, letterSpacing: "0.04em",
    }}>
      {lead}+{diff}
    </span>
  );
}

function ChartCard({ title, sub, href, data, lines, domain, refY, stats }: {
  title: string; sub: string; href: string; data: any[];
  lines: { key: string; name: string; color: string }[];
  domain: [number, number]; refY?: number;
  stats: { label: string; val: string; color: string }[];
}) {
  const step = Math.max(1, Math.floor(data.length / 40));
  const pts  = data.filter((_, i) => i % step === 0 || i === data.length - 1);
  const axisTickDates: string[] = [];
  if (pts.length > 1) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const idx = Math.round(i * (pts.length - 1) / (count - 1));
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
      <div className="hp-tri-stripe" />
      <div className="hp-chart-header">
        <div>
          <div className="hp-chart-title">{title}</div>
          <div className="hp-chart-sub">{sub}</div>
        </div>
        <Link href={href} className="hp-chart-link">Full data →</Link>
      </div>
      <div style={{ padding: "14px 4px 4px 0" }}>
        <ResponsiveContainer width="100%" height={145}>
          <LineChart data={pts} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" ticks={axisTickDates} tickFormatter={fmtTick} tick={{ fontSize: 8, fill: "rgba(255,255,255,0.25)", fontFamily: "var(--font-body), monospace" }} tickLine={false} axisLine={false} />
            <YAxis domain={domain} tick={{ fontSize: 8, fill: "rgba(255,255,255,0.25)", fontFamily: "var(--font-body), monospace" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip content={<ChartTip />} />
            {refY !== undefined && <ReferenceLine y={refY} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />}
            {lines.map(l => (
              <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color}
                strokeWidth={2} dot={false} activeDot={{ r: 3, fill: l.color, strokeWidth: 0 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="hp-chart-stats">
        {stats.map(s => (
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
const LIVE_CONFIG = {
  mode: "upcoming" as "upcoming" | "live",
  race: {
    name: "Wisconsin Supreme Court",
    subtitle: "State Supreme Court · Spring Election",
    date: "April 7, 2026",
    dateISO: "2026-04-07",
    href: "/results/forecast",
  },
  races: [
    { name: "WI Supreme Court", dPct: 62, rPct: 38 },
  ],
  candidates: [
    { name: "Brad Schimel",   party: "R", color: "#e63946", pct: 0, votes: 0 },
    { name: "Susan Crawford", party: "D", color: "#2563eb", pct: 0, votes: 0 },
  ],
  percentReporting: 0,
  lastUpdated: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
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
  const gbNet      = round1(dem - rep);
  const gbNetStr   = gbNet === 0 ? "EVEN" : gbNet > 0 ? `D+${gbNet.toFixed(1)}` : `R+${Math.abs(gbNet).toFixed(1)}`;
  const latestPoll = [...TRUMP_POLLS].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];

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
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap');

        /* Override page bg for dark theme */
        body { background: #070709 !important; }

        /* ── Tri-stripe (red/purple/blue) ── */
        .hp-tri-stripe { height: 3px; width: 100%; background: linear-gradient(90deg, #e63946 0%, #e63946 33.33%, #7c3aed 33.33%, #7c3aed 66.66%, #2563eb 66.66%, #2563eb 100%); flex-shrink: 0; }

        .hp-wrap {
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px 32px 80px;
        }
        @media(max-width: 768px) { .hp-wrap { padding: 20px 16px 60px; } }

        /* ── Hero ── */
        .hp-hero {
          display: grid;
          grid-template-columns: 1fr 240px 240px;
          gap: 12px;
          background: transparent;
          margin-bottom: 20px;
        }
        @media(max-width: 1100px) { .hp-hero { grid-template-columns: 1fr 220px 220px; } }
        @media(max-width: 900px)  { .hp-hero { grid-template-columns: 1fr; } }

        .hp-hero-left {
          padding: 48px 48px 40px;
          background: #0f0f15;
          border: 1px solid rgba(255,255,255,0.09);
          position: relative;
          overflow: hidden;
        }
        @media(max-width: 768px) { .hp-hero-left { padding: 28px 20px; } }

        /* Subtle background texture */
        .hp-hero-left::before {
          content: '';
          position: absolute;
          top: -60px; right: -60px;
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%);
          pointer-events: none;
        }
        .hp-hero-left::after {
          content: '';
          position: absolute;
          bottom: -40px; left: 200px;
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(230,57,70,0.05) 0%, transparent 70%);
          pointer-events: none;
        }

        .hp-hero-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-body), monospace;
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          margin-bottom: 20px;
        }
        .hp-hero-tag-sep { color: rgba(255,255,255,0.15); }

        .hp-hero-headline {
          font-family: var(--font-display), sans-serif;
          font-size: clamp(36px, 5vw, 68px);
          letter-spacing: 0.03em;
          line-height: 0.95;
          text-transform: uppercase;
          color: #fff;
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }
        .hp-hero-headline .dem { color: #3b82f6; }
        .hp-hero-headline .rep {
          background: linear-gradient(100deg, #ff4d5a 0%, #a78bfa 50%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hp-hero-desc {
          font-family: var(--font-body), monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          line-height: 1.8;
          max-width: 480px;
          margin-bottom: 28px;
          letter-spacing: 0.04em;
          position: relative;
          z-index: 1;
        }

        .hp-hero-ctas {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          position: relative;
          z-index: 1;
        }

        .hp-btn-gold {
          display: inline-flex;
          align-items: center;
          padding: 10px 22px;
          background: #7c3aed;
          color: #fff;
          font-family: var(--font-body), monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background 120ms, transform 80ms;
        }
        .hp-btn-gold:hover { background: #9d5cf0; text-decoration: none; transform: translateY(-1px); }

        .hp-btn-outline {
          display: inline-flex;
          align-items: center;
          padding: 10px 22px;
          background: transparent;
          color: rgba(255,255,255,0.4);
          font-family: var(--font-body), monospace;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.12);
          transition: border-color 120ms, color 120ms;
        }
        .hp-btn-outline:hover { border-color: rgba(255,255,255,0.35); color: rgba(255,255,255,0.7); text-decoration: none; }

        .hp-hero-meta {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-family: var(--font-body), monospace;
          font-size: 9px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          position: relative;
          z-index: 1;
        }
        .hp-hero-meta span { color: rgba(255,255,255,0.4); }

        /* Hero Box 2: Polling metrics */
        .hp-hero-right-polls {
          background: #0b0b0f;
          border: 1px solid rgba(255,255,255,0.09);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex-shrink: 0;
        }
        .hp-hero-right-polls-hd {
          padding: 11px 20px 9px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .hp-hero-right-polls-lbl {
          font-family: var(--font-body), monospace;
          font-size: 8px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(255,255,255,0.25);
        }
        .hp-hero-right-polls-link {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border: 1px solid rgba(124,58,237,0.28);
          font-family: var(--font-body), monospace;
          font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase;
          color: #7c3aed; text-decoration: none; transition: border-color 120ms, color 120ms;
        }
        .hp-hero-right-polls-link:hover { border-color: rgba(124,58,237,0.6); color: #9d5cf0; text-decoration: none; }

        .hp-polls-desc {
          padding: 8px 20px 6px;
          font-family: var(--font-body), monospace;
          font-size: 8.5px; line-height: 1.5;
          color: rgba(255,255,255,0.38);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .hp-polls-cta {
          padding: 10px 20px;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
        }
        .hp-polls-cta-link {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border: 1px solid rgba(124,58,237,0.28);
          font-family: var(--font-body), monospace; font-size: 8px; letter-spacing: 0.14em;
          text-transform: uppercase; color: #7c3aed; text-decoration: none;
          transition: border-color 120ms, color 120ms;
        }
        .hp-polls-cta-link:hover { border-color: rgba(124,58,237,0.6); color: #9d5cf0; text-decoration: none; }

        .hp-hero-metric {
          padding: 10px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .hp-hero-metric:last-child { border-bottom: none; }

        .hp-metric-eyebrow {
          font-family: var(--font-body), monospace;
          font-size: 7.5px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.25);
          margin-bottom: 4px;
        }

        .hp-metric-num {
          font-family: var(--font-display), sans-serif;
          font-size: 32px;
          letter-spacing: 0.03em;
          line-height: 1;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .hp-metric-sub-row {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          font-family: var(--font-body), monospace;
          font-size: 8.5px;
          font-weight: 500;
          letter-spacing: 0.08em;
        }

        /* Hero Box 3: Live / Upcoming */
        .hp-hero-right-live {
          background: #0b0b0f;
          border: 1px solid rgba(255,255,255,0.09);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex: 1;
        }
        .hp-hero-right-live .hp-live-panel { flex: 1; display: flex; flex-direction: column; }
        .hp-hero-right-live .hp-live-body { flex: 1; padding: 13px 18px 13px; gap: 9px; display: flex; flex-direction: column; }
        .hp-hero-right-live .hp-live-race-name { font-size: 17px; }

        /* Upcoming capabilities showcase */
        .hp-cap-headline {
          font-family: var(--font-display), sans-serif;
          font-size: 22px; line-height: 1.1; letter-spacing: 0.04em;
          text-transform: uppercase; color: #fff;
        }
        .hp-cap-headline em {
          font-style: normal; color: #9d5cf0;
        }
        .hp-cap-tiles {
          display: flex; flex-direction: column; gap: 4px;
        }
        .hp-cap-tile {
          display: flex; align-items: center; gap: 9px;
          padding: 8px 11px;
          border: 1px solid rgba(124,58,237,0.18);
          background: rgba(124,58,237,0.05);
        }
        .hp-cap-tile-icon {
          font-family: var(--font-display), sans-serif;
          font-size: 14px; line-height: 1; color: #7c3aed; flex-shrink: 0; width: 18px; text-align: center; text-transform: uppercase;
        }
        .hp-cap-tile-label {
          font-family: var(--font-display), sans-serif;
          font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: #fff;
        }
        .hp-cap-next-race {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 11px;
          border: 1px solid rgba(124,58,237,0.28);
          background: rgba(124,58,237,0.07);
          margin-top: 2px;
        }
        .hp-cap-next-race-left { display: flex; flex-direction: column; gap: 2px; }
        .hp-cap-next-race-eyebrow {
          font-family: var(--font-body), monospace;
          font-size: 7px; font-weight: 600; letter-spacing: 0.2em;
          text-transform: uppercase; color: #7c3aed;
        }
        .hp-cap-next-race-name {
          font-family: var(--font-display), sans-serif;
          font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #fff;
        }
        .hp-cap-next-race-countdown {
          display: flex; flex-direction: column; align-items: flex-end; gap: 1px;
        }
        .hp-cap-next-race-num {
          font-family: var(--font-display), sans-serif;
          font-size: 26px; line-height: 1; color: #9d5cf0; letter-spacing: 0.02em; text-transform: uppercase;
        }
        .hp-cap-next-race-unit {
          font-family: var(--font-body), monospace;
          font-size: 7px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(255,255,255,0.3);
        }

        /* ── Section header ── */
        .hp-section-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .hp-section-title {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
        }
        .hp-section-link {
          display: inline-flex;
          align-items: center;
          padding: 3px 9px;
          border: 1px solid rgba(124,58,237,0.28);
          font-family: var(--font-body), monospace;
          font-size: 8px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #7c3aed;
          text-decoration: none;
          transition: border-color 120ms, color 120ms;
        }
        .hp-section-link:hover { border-color: rgba(124,58,237,0.6); color: #9d5cf0; text-decoration: none; }

        /* ── Chart cards ── */
        .hp-charts-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }
        @media(max-width: 900px) { .hp-charts-grid { grid-template-columns: 1fr; } }

        .hp-chart-card {
          background: #0f0f15;
          border: 1px solid rgba(255,255,255,0.07);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .hp-chart-header {
          padding: 16px 18px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .hp-chart-title {
          font-family: var(--font-body), monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.75);
          margin-bottom: 4px;
        }

        .hp-chart-sub {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          color: rgba(255,255,255,0.25);
          letter-spacing: 0.06em;
        }

        .hp-chart-link {
          display: inline-flex;
          align-items: center;
          padding: 3px 9px;
          border: 1px solid rgba(124,58,237,0.28);
          font-family: var(--font-body), monospace;
          font-size: 8px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #7c3aed;
          text-decoration: none;
          flex-shrink: 0;
          transition: border-color 120ms, color 120ms;
          margin-top: 2px;
        }
        .hp-chart-link:hover { border-color: rgba(124,58,237,0.6); color: #9d5cf0; text-decoration: none; }

        .hp-chart-stats {
          display: flex;
          gap: 0;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: #0b0b0f;
        }

        .hp-chart-stat {
          flex: 1;
          padding: 10px 14px;
          border-right: 1px solid rgba(255,255,255,0.05);
        }
        .hp-chart-stat:last-child { border-right: none; }

        .hp-chart-stat-label {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.25);
          margin-bottom: 4px;
        }

        .hp-chart-stat-val {
          font-family: var(--font-display), sans-serif;
          font-size: 18px;
          letter-spacing: 0.04em;
          line-height: 1;
          text-transform: uppercase;
        }

        /* ── Data grid: issues + meta ── */
        .hp-data-grid {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media(max-width: 900px) { .hp-data-grid { grid-template-columns: 1fr; } }

        /* Issue table */
        .hp-issue-table {
          border: 1px solid rgba(255,255,255,0.09);
          background: #0f0f15;
          overflow: hidden;
        }

        .hp-issue-table-head {
          display: grid;
          grid-template-columns: 1fr 52px 52px 80px 64px;
          padding: 8px 18px;
          gap: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: #0b0b0f;
        }

        .hp-issue-row {
          display: grid;
          grid-template-columns: 1fr 52px 52px 80px 64px;
          align-items: center;
          padding: 10px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          gap: 10px;
          transition: background 60ms;
        }
        .hp-issue-row:last-child { border-bottom: none; }
        .hp-issue-row:hover { background: rgba(255,255,255,0.02); }

        .hp-th {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.2);
          text-align: right;
        }
        .hp-th:first-child { text-align: left; }

        .hp-issue-name {
          font-family: var(--font-body), monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.65);
          letter-spacing: 0.04em;
        }

        .hp-issue-pct {
          font-family: var(--font-body), monospace;
          font-size: 12px;
          font-weight: 500;
          text-align: right;
          letter-spacing: 0.04em;
        }

        .hp-issue-footer {
          padding: 10px 18px;
          border-top: 1px solid rgba(255,255,255,0.04);
          background: #0b0b0f;
          font-family: var(--font-body), monospace;
          font-size: 8px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.15);
        }

        /* Meta sidebar */
        .hp-meta-stack {
          display: flex;
          flex-direction: column;
          gap: 1px;
          background: rgba(255,255,255,0.05);
        }

        .hp-meta-card {
          background: #0f0f15;
          padding: 0;
        }

        .hp-meta-header {
          padding: 12px 18px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .hp-meta-title {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
        }

        .hp-meta-live {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-body), monospace;
          font-size: 8px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #e63946;
        }
        .hp-meta-live-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: #e63946;
          animation: hp-pulse 1.8s ease-in-out infinite;
        }
        @keyframes hp-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }

        .hp-meta-stat {
          padding: 8px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .hp-meta-stat:last-child { border-bottom: none; }

        .hp-meta-stat-label {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.2);
          margin-bottom: 3px;
        }

        .hp-meta-stat-val {
          font-family: var(--font-display), sans-serif;
          font-size: 18px;
          letter-spacing: 0.04em;
          color: #fff;
          line-height: 1;
          text-transform: uppercase;
        }

        .hp-meta-stat-sub {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.04em;
          margin-top: 2px;
        }

        /* CTA card */
        .hp-participate {
          background: rgba(37,99,235,0.06);
          border: 1px solid rgba(37,99,235,0.15);
          padding: 20px 18px;
        }

        .hp-participate-eyebrow {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #2563eb;
          margin-bottom: 8px;
        }

        .hp-participate-text {
          font-family: var(--font-body), monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          line-height: 1.75;
          letter-spacing: 0.02em;
          margin-bottom: 16px;
        }

        /* ── Explore cards ── */
        .hp-explore-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.06);
        }
        @media(max-width: 900px) { .hp-explore-grid { grid-template-columns: repeat(2, 1fr); } }
        @media(max-width: 540px) { .hp-explore-grid { grid-template-columns: 1fr; } }

        .hp-explore-card {
          background: #0f0f15;
          padding: 18px 16px;
          display: flex;
          flex-direction: column;
          gap: 7px;
          text-decoration: none;
          transition: background 120ms;
          position: relative;
          overflow: hidden;
        }
        .hp-explore-card:hover { background: #141420; text-decoration: none; }
        .hp-explore-card:hover .hp-explore-arrow { transform: translateX(4px); }

        .hp-explore-rule {
          height: 3px;
          width: 100%;
          margin-bottom: 4px;
          background: linear-gradient(90deg, #e63946 0%, #e63946 33.33%, #7c3aed 33.33%, #7c3aed 66.66%, #2563eb 66.66%, #2563eb 100%) !important;
        }

        .hp-explore-label {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .hp-explore-name {
          font-family: var(--font-display), sans-serif;
          font-size: 17px;
          letter-spacing: 0.04em;
          color: #fff;
          line-height: 1;
          text-transform: uppercase;
        }

        .hp-explore-desc {
          font-family: var(--font-body), monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.3);
          line-height: 1.7;
          letter-spacing: 0.02em;
          flex: 1;
        }

        .hp-explore-arrow {
          font-family: var(--font-body), monospace;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          transition: transform 150ms;
        }

        /* ── Live Results Panel ── */
        .hp-live-panel { display: flex; flex-direction: column; height: 100%; }
        .hp-live-panel-header {
          padding: 14px 20px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
        }
        .hp-live-label {
          font-family: var(--font-body), monospace;
          font-size: 8px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase;
          color: #7c3aed; display: flex; align-items: center; gap: 5px;
        }
        .hp-live-label-red { color: #e63946; }
        .hp-live-dot {
          width: 5px; height: 5px; border-radius: 50%; background: #e63946;
          animation: hp-pulse 1.8s ease-in-out infinite; display: inline-block; flex-shrink: 0;
        }
        .hp-live-updated {
          font-family: var(--font-body), monospace;
          font-size: 8px; color: rgba(255,255,255,0.2); letter-spacing: 0.06em;
        }
        .hp-live-body {
          padding: 20px; display: flex; flex-direction: column; gap: 14px; flex: 1;
        }
        .hp-live-race-sub {
          font-family: var(--font-body), monospace;
          font-size: 8px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.25);
        }
        .hp-live-race-name {
          font-family: var(--font-display), sans-serif;
          font-size: 22px; letter-spacing: 0.04em; color: #fff; line-height: 1.1; text-transform: uppercase;
        }
        .hp-live-date-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 9px 0; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .hp-live-date-label {
          font-family: var(--font-body), monospace;
          font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.25);
        }
        .hp-live-date-val {
          font-family: var(--font-body), monospace;
          font-size: 10px; font-weight: 500; letter-spacing: 0.06em; color: rgba(255,255,255,0.55);
        }
        .hp-live-countdown { display: flex; align-items: baseline; gap: 10px; }
        .hp-live-countdown-num {
          font-family: var(--font-display), sans-serif;
          font-size: 62px; letter-spacing: 0.02em; line-height: 1; color: #7c3aed; text-transform: uppercase;
        }
        .hp-live-countdown-lbl {
          font-family: var(--font-body), monospace;
          font-size: 9px; font-weight: 500; letter-spacing: 0.18em;
          text-transform: uppercase; color: rgba(255,255,255,0.3); line-height: 1.6;
        }
        .hp-live-upcoming-note {
          font-family: var(--font-body), monospace;
          font-size: 10px; color: rgba(255,255,255,0.3); line-height: 1.8; letter-spacing: 0.02em; margin: 0;
        }
        .hp-live-spacer { flex: 1; }
        .hp-live-reporting { display: flex; flex-direction: column; gap: 5px; }
        .hp-live-reporting-track {
          height: 3px; background: rgba(255,255,255,0.07); border-radius: 1px; overflow: hidden;
        }
        .hp-live-reporting-fill {
          height: 100%; background: #7c3aed; transition: width 600ms ease;
        }
        .hp-live-reporting-lbl {
          font-family: var(--font-body), monospace;
          font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3);
        }
        .hp-live-candidates { display: flex; flex-direction: column; gap: 12px; }
        .hp-live-cand-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .hp-live-cand-name {
          font-family: var(--font-body), monospace; font-size: 11px; color: rgba(255,255,255,0.7); letter-spacing: 0.04em;
        }
        .hp-live-cand-pct {
          font-family: var(--font-display), sans-serif;
          font-size: 20px; letter-spacing: 0.04em; line-height: 1; text-transform: uppercase;
        }
        .hp-live-cand-bar {
          height: 4px; background: rgba(255,255,255,0.06); border-radius: 1px; overflow: hidden; margin-bottom: 3px;
        }
        .hp-live-cand-fill { height: 100%; border-radius: 1px; transition: width 600ms cubic-bezier(0.22,1,0.36,1); }
        .hp-live-cand-votes {
          font-family: var(--font-body), monospace; font-size: 8px; color: rgba(255,255,255,0.2); letter-spacing: 0.06em;
        }
        .hp-live-full-link {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border: 1px solid rgba(124,58,237,0.28);
          font-family: var(--font-body), monospace; font-size: 8px; letter-spacing: 0.14em;
          text-transform: uppercase; color: #7c3aed; text-decoration: none;
          transition: border-color 120ms, color 120ms; margin-top: 4px; align-self: flex-start;
        }
        .hp-live-full-link:hover { border-color: rgba(124,58,237,0.6); color: #9d5cf0; text-decoration: none; }
      `}</style>

      <div className="hp-wrap">

        {/* ══ HERO ══ */}
        <div className="hp-hero">
          <div className="hp-hero-left">
            <div className="hp-tri-stripe" style={{ margin: "-48px -48px 28px" }} />
            <div className="hp-hero-tag">
              <span className="hp-hero-tag-sep">—</span>
              <span>National Polling Index</span>
              <span className="hp-hero-tag-sep">·</span>
              <span style={{ color: "#7c3aed" }}>Live</span>
            </div>

            <h1 className="hp-hero-headline">
              Tracking<br />
              What{" "}
              <span className="dem">America</span><br />
              <span className="rep">Thinks.</span>
            </h1>

            <p className="hp-hero-desc">
              A continuously updated national polling database — presidential approval,
              generic ballot, direction of country, and more. All averages computed from
              raw poll inputs using our weighted daily model.
            </p>

            <div className="hp-hero-ctas">
              <Link
                href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
                className="hp-btn-gold"
                target="_blank" rel="noopener noreferrer"
              >
                Take the Survey →
              </Link>
              <Link href="/results" className="hp-btn-outline">View All Data</Link>
              <Link href="/contact" className="hp-btn-outline">Partner With Us</Link>
            </div>

            <div className="hp-hero-meta">
              Latest: <span>{latestPoll.pollster}</span>
              {" · "}
              <span>{latestPoll.endDate}</span>
              {" · "}
              n=<span>{latestPoll.sampleSize.toLocaleString()}</span>
            </div>
          </div>

          {/* Box 2: Polling Index */}
          <div className="hp-hero-right-polls">
            <div className="hp-tri-stripe" />
              <div className="hp-hero-right-polls-hd">
                <span className="hp-hero-right-polls-lbl">Polling Index</span>
              </div>
              <div className="hp-polls-desc">National polling averages, updated continuously.</div>
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
                <div key={m.label} className="hp-hero-metric">
                  <div className="hp-metric-eyebrow">{m.label}</div>
                  <div className="hp-metric-num" style={{ color: m.color }}>{m.num}</div>
                  <SplitBar dem={m.dem} rep={m.rep} h={3} />
                  <div className="hp-metric-sub-row">
                    <span style={{ color: m.left.color }}>{m.left.label}</span>
                    <span style={{ color: m.right.color }}>{m.right.label}</span>
                  </div>
                </div>
              ))}
              <div className="hp-polls-cta">
                <Link href="/polling" className="hp-polls-cta-link">View All Polls →</Link>
              </div>
          </div>

          {/* Box 3: Live / Upcoming */}
          <div className="hp-hero-right-live">
            <div className="hp-tri-stripe" />
              {(() => {
                const daysUntil = Math.max(0, Math.ceil(
                  (new Date(LIVE_CONFIG.race.dateISO + "T00:00:00").getTime() - Date.now()) / 86400000
                ));
                return LIVE_CONFIG.mode === "upcoming" ? (
                  <div className="hp-live-panel">
                    <div className="hp-live-panel-header">
                      <span className="hp-live-label">
                        <span className="hp-live-dot" style={{ background: "#7c3aed", animationDuration: "2.4s" }} />
                        Election Results
                      </span>
                      <span className="hp-live-updated">Apr 7</span>
                    </div>
                    <div className="hp-live-body">
                      <div className="hp-cap-headline">
                        We <em>forecast</em>,<br />project &amp; model<br />every major race.
                      </div>
                      <div className="hp-cap-tiles">
                        <div className="hp-cap-tile">
                          <span className="hp-cap-tile-icon">&#9642;</span>
                          <span className="hp-cap-tile-label">Pre-Election Forecast</span>
                        </div>
                        <div className="hp-cap-tile">
                          <span className="hp-cap-tile-icon">&#9642;</span>
                          <span className="hp-cap-tile-label">Live Night-of Projection</span>
                        </div>
                        <div className="hp-cap-tile">
                          <span className="hp-cap-tile-icon">&#9642;</span>
                          <span className="hp-cap-tile-label">Electoral Modeling</span>
                        </div>
                      </div>
                      <div className="hp-cap-next-race">
                        <div className="hp-cap-next-race-left">
                          <span className="hp-cap-next-race-eyebrow">Next Race</span>
                          <span className="hp-cap-next-race-name">{LIVE_CONFIG.race.name}</span>
                          <span style={{ fontFamily: "var(--font-body), monospace", fontSize: "8px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}>{LIVE_CONFIG.race.date}</span>
                        </div>
                        <div className="hp-cap-next-race-countdown">
                          <span className="hp-cap-next-race-num">{daysUntil}</span>
                          <span className="hp-cap-next-race-unit">{daysUntil === 1 ? "day" : "days"}</span>
                        </div>
                      </div>
                      <div className="hp-live-spacer" />
                      <Link href={LIVE_CONFIG.race.href} className="hp-live-full-link">
                        See the Apr 7 Forecast →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="hp-live-panel">
                    <div className="hp-live-panel-header" style={{ borderBottomColor: "rgba(230,57,70,0.2)" }}>
                      <span className="hp-live-label hp-live-label-red">
                        <span className="hp-live-dot" /> Live Results
                      </span>
                      {LIVE_CONFIG.lastUpdated && (
                        <span className="hp-live-updated">{LIVE_CONFIG.lastUpdated}</span>
                      )}
                    </div>
                    <div className="hp-live-body">
                      <div>
                        <div className="hp-live-race-sub">{LIVE_CONFIG.race.subtitle}</div>
                        <div className="hp-live-race-name">{LIVE_CONFIG.race.name}</div>
                      </div>
                      <div className="hp-live-reporting">
                        <div className="hp-live-reporting-track">
                          <div className="hp-live-reporting-fill" style={{ width: `${LIVE_CONFIG.percentReporting}%` }} />
                        </div>
                        <span className="hp-live-reporting-lbl">{LIVE_CONFIG.percentReporting}% Reporting</span>
                      </div>
                      <div className="hp-live-candidates">
                        {LIVE_CONFIG.candidates.map(c => (
                          <div key={c.name}>
                            <div className="hp-live-cand-top">
                              <span className="hp-live-cand-name">{c.name}</span>
                              <span className="hp-live-cand-pct" style={{ color: c.color }}>
                                {c.pct > 0 ? `${c.pct.toFixed(1)}%` : "—"}
                              </span>
                            </div>
                            <div className="hp-live-cand-bar">
                              <div className="hp-live-cand-fill" style={{ width: `${c.pct}%`, background: c.color }} />
                            </div>
                            {c.votes > 0 && (
                              <div className="hp-live-cand-votes">{c.votes.toLocaleString()} votes</div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="hp-live-spacer" />
                      <Link href={LIVE_CONFIG.race.href} className="hp-live-full-link">
                        Full Results →
                      </Link>
                    </div>
                  </div>
                );
              })()}
          </div>

        </div>

        {/* ══ CHARTS ══ */}
        <div style={{ marginBottom: 8 }}>
          <div className="hp-section-head">
            <span className="hp-section-title">Polling Averages</span>
            <Link href="/polling" className="hp-section-link">All averages →</Link>
          </div>
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
            stats={[
              { label: "Democrat",   val: `${dem}%`, color: "#2563eb" },
              { label: "Republican", val: `${rep}%`, color: "#e63946" },
              { label: "Margin",     val: gbNetStr,  color: gbNet >= 0 ? "#2563eb" : "#e63946" },
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
            <div className="hp-issue-table">
              <div className="hp-tri-stripe" />
              <div className="hp-issue-table-head">
                <div className="hp-th">Issue</div>
                <div className="hp-th" style={{ color: "#2563eb" }}>Dem</div>
                <div className="hp-th" style={{ color: "#e63946" }}>Rep</div>
                <div className="hp-th">Bar</div>
                <div className="hp-th">Spread</div>
              </div>
              {issues.map(r => (
                <div key={r.issue} className="hp-issue-row">
                  <div className="hp-issue-name">{r.issue}</div>
                  <div className="hp-issue-pct" style={{ color: "#2563eb" }}>{r.dem}%</div>
                  <div className="hp-issue-pct" style={{ color: "#e63946" }}>{r.rep}%</div>
                  <SplitBar dem={r.dem} rep={r.rep} h={5} />
                  <div style={{ textAlign: "right" }}><SpreadBadge a={r.dem} b={r.rep} /></div>
                </div>
              ))}
              <div className="hp-issue-footer">PSI National Issue Tracker · MoE ±1.9–2.4pp</div>
            </div>
          </div>

          {/* Meta sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div className="hp-section-head">
                <span className="hp-section-title">Model Info</span>
              </div>
              <div className="hp-meta-stack">
                <div className="hp-meta-card">
                  <div className="hp-tri-stripe" />
                  <div className="hp-meta-header">
                    <span className="hp-meta-title">Data Status</span>
                    <span className="hp-meta-live">
                      <span className="hp-meta-live-dot" />
                      Live
                    </span>
                  </div>
                  {[
                    { label: "Approval Polls",      val: String(TRUMP_POLLS.length), sub: "In weighted model" },
                    { label: "Generic Ballot Polls", val: String(GB_POLLS.length),   sub: "In weighted model" },
                    { label: "Right Track Polls",   val: String(RT_POLLS.length),    sub: "In weighted model" },
                    { label: "Latest Poll",         val: latestPoll.endDate,          sub: latestPoll.pollster },
                  ].map(s => (
                    <div key={s.label} className="hp-meta-stat">
                      <div className="hp-meta-stat-label">{s.label}</div>
                      <div className="hp-meta-stat-val">{s.val}</div>
                      <div className="hp-meta-stat-sub">{s.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hp-participate">
              <div className="hp-participate-eyebrow">Participate · Shape the Data</div>
              <p className="hp-participate-text">
                Join the national baseline survey. Under 3 minutes. Your response shapes the data.
              </p>
              <Link
                href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
                className="hp-btn-gold"
                style={{ width: "100%", justifyContent: "center" }}
                target="_blank" rel="noopener noreferrer"
              >
                Take the Survey →
              </Link>
            </div>
          </div>
        </div>

        {/* ══ EXPLORE CARDS ══ */}
        <div style={{ marginBottom: 8 }}>
          <div className="hp-section-head">
            <span className="hp-section-title">Explore</span>
          </div>
        </div>
        <div className="hp-explore-grid">
          {[
            {
              color: "#2563eb",
              label: "Analysis",
              name: "Electoral Map",
              desc: "State-by-state data with 2024 vs. 2026 comparison overlays.",
              href: "/electoralmap",
              cta: "Explore Map →",
            },
            {
              color: "rgba(255,255,255,0.35)",
              label: "Projections",
              name: "Forecast Ratings",
              desc: "PSI race ratings across Senate, House, and gubernatorial contests.",
              href: "/forecastratings",
              cta: "View Ratings →",
            },
            {
              color: "#e63946",
              label: "Results",
              name: "Live Election Results",
              desc: "Real-time vote totals and night-of projections for every major race.",
              href: "/results",
              cta: "See Results →",
            },
            {
              color: "#e63946",
              label: "Methodology",
              name: "Gold Standard",
              desc: "Curated aggregation of high-quality polls ranked by historical accuracy.",
              href: "/goldstandard",
              cta: "Browse Polls →",
            },
          ].map(c => (
            <Link key={c.name} href={c.href} className="hp-explore-card">
              <div className="hp-explore-rule" />
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