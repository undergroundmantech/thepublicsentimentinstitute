// app/polling/donaldtrumpapproval/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";
import PollingTimeSeriesChart from "@/app/components/PollingTimeSeriesChart";
import {
  Poll,
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";

const GOLD_STANDARD_MULTIPLIER = 3;
const GOLD_STANDARD_NAMES = [
  "Big Data Poll", "Rasmussen Reports", "AtlasIntel", "SoCalStrategies",
  "Emerson", "Trafalgar", "InsiderAdvantage", "Patriot Polling",
];

function normalizeName(s: string) {
  return s.toLowerCase().replace(/\(r\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
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

// ─── State-level raw net approval data ───────────────────────────────────────
const STATE_RAW: Record<string, { civiqs: number; economist: number; mc: number }> = {
  AL: { civiqs: 13.0, economist: 1.6,  mc: 16.0 },
  AK: { civiqs: -11.0, economist: -8.9, mc: -1.0 },
  AZ: { civiqs: -8.0, economist: -15.7, mc: 4.0 },
  AR: { civiqs: 16.0, economist: 0.3,  mc: 15.0 },
  CA: { civiqs: -42.0, economist: -26.7, mc: -23.0 },
  CO: { civiqs: -23.0, economist: -26.5, mc: -16.0 },
  CT: { civiqs: -30.0, economist: -33.0, mc: -21.0 },
  DE: { civiqs: -31.0, economist: -24.3, mc: -14.0 },

  DC: { civiqs: -85, economist: -85, mc: -85 }, // unchanged (not in your update table)

  FL: { civiqs: -6.0, economist: -7.1, mc: 2.0 },
  GA: { civiqs: -16.0, economist: -18.6, mc: -5.0 },
  HI: { civiqs: -58.0, economist: -38.4, mc: -34.0 },
  ID: { civiqs: 16.0, economist: 25.1, mc: 23.0 },
  IL: { civiqs: -30.0, economist: -34.2, mc: -21.0 },
  IN: { civiqs: 7.0, economist: -11.2, mc: 0.0 },
  IA: { civiqs: -9.0, economist: -9.9, mc: -2.0 },
  KS: { civiqs: 5.0, economist: -7.6, mc: 1.0 },
  KY: { civiqs: 7.0, economist: -3.2, mc: 12.0 },
  LA: { civiqs: 4.0, economist: -3.3, mc: 12.0 },
  ME: { civiqs: -20.0, economist: -22.0, mc: -14.0 },
  MD: { civiqs: -44.0, economist: -38.6, mc: -34.0 },
  MA: { civiqs: -43.0, economist: -31.2, mc: -32.0 },
  MI: { civiqs: -18.0, economist: -17.1, mc: -9.0 },
  MN: { civiqs: -22.0, economist: -21.5, mc: -11.0 },
  MS: { civiqs: 4.0, economist: -3.1, mc: 11.0 },
  MO: { civiqs: 2.0, economist: -5.0, mc: 7.0 },
  MT: { civiqs: 11.0, economist: 3.2, mc: 4.0 },
  NE: { civiqs: 6.0, economist: -4.3, mc: 6.0 },
  NV: { civiqs: -14.0, economist: -16.7, mc: -5.0 },
  NH: { civiqs: -24.0, economist: -17.5, mc: -12.0 },
  NJ: { civiqs: -30.0, economist: -21.9, mc: -13.0 },
  NM: { civiqs: -22.0, economist: -30.1, mc: -16.0 },
  NY: { civiqs: -34.0, economist: -25.4, mc: -17.0 },
  NC: { civiqs: -8.0, economist: -12.3, mc: -6.0 },
  ND: { civiqs: 17.0, economist: 9.4, mc: 15.0 },
  OH: { civiqs: -3.0, economist: -13.5, mc: -1.0 },
  OK: { civiqs: 21.0, economist: 3.6, mc: 14.0 },
  OR: { civiqs: -35.0, economist: -30.3, mc: -23.0 },
  PA: { civiqs: -14.0, economist: -19.2, mc: -3.0 },
  RI: { civiqs: -35.0, economist: -31.8, mc: -26.0 },
  SC: { civiqs: 0.0, economist: -9.4, mc: 5.0 },
  SD: { civiqs: 10.0, economist: -2.9, mc: 10.0 },
  TN: { civiqs: 11.0, economist: 4.6, mc: 17.0 },
  TX: { civiqs: -6.0, economist: -16.8, mc: 2.0 },
  UT: { civiqs: 6.0, economist: 1.8, mc: 7.0 },
  VT: { civiqs: -53.0, economist: -41.0, mc: -35.0 },
  VA: { civiqs: -23.0, economist: -16.4, mc: -12.0 },
  WA: { civiqs: -38.0, economist: -34.9, mc: -21.0 },
  WV: { civiqs: 27.0, economist: 15.1, mc: 20.0 },
  WI: { civiqs: -10.0, economist: -19.4, mc: -10.0 },
  WY: { civiqs: 23.0, economist: 22.1, mc: 33.0 },
};

const STATE_POP: Record<string, number> = {
  AL:4.1,AK:0.7,AZ:7.4,AR:3.1,CA:39.0,CO:5.9,CT:3.6,DE:1.0,FL:22.6,
  GA:11.0,HI:1.4,ID:2.0,IL:12.5,IN:6.8,IA:3.2,KS:2.9,KY:4.5,LA:4.6,ME:1.4,
  MD:6.2,MA:7.0,MI:10.1,MN:5.7,MS:3.0,MO:6.2,MT:1.1,NE:2.0,NV:3.2,NH:1.4,
  NJ:9.3,NM:2.1,NY:19.3,NC:10.7,ND:0.8,OH:11.8,OK:4.0,OR:4.2,PA:12.9,RI:1.1,
  SC:5.3,SD:0.9,TN:7.1,TX:30.5,UT:3.4,VT:0.6,VA:8.7,WA:7.8,WV:1.8,WI:5.9,WY:0.6,
};

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",DC:"D.C.",FL:"Florida",GA:"Georgia",HI:"Hawaii",
  ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",
  LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",
  MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",
  NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",
  NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",
  PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",
  WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

// FIPS code → state abbreviation
const FIPS_TO_STATE: Record<number, string> = {
  1:"AL",2:"AK",4:"AZ",5:"AR",6:"CA",8:"CO",9:"CT",10:"DE",11:"DC",
  12:"FL",13:"GA",15:"HI",16:"ID",17:"IL",18:"IN",19:"IA",20:"KS",
  21:"KY",22:"LA",23:"ME",24:"MD",25:"MA",26:"MI",27:"MN",28:"MS",
  29:"MO",30:"MT",31:"NE",32:"NV",33:"NH",34:"NJ",35:"NM",36:"NY",
  37:"NC",38:"ND",39:"OH",40:"OK",41:"OR",42:"PA",44:"RI",45:"SC",
  46:"SD",47:"TN",48:"TX",49:"UT",50:"VT",51:"VA",53:"WA",54:"WV",
  55:"WI",56:"WY",
};

function netToColor(net: number): string {
  if (net > 25)  return "#991b1b";
  if (net > 15)  return "#b91c1c";
  if (net > 8)   return "#dc2626";
  if (net > 3)   return "#ef4444";
  if (net > 0)   return "#f87171";
  if (net === 0) return "#4b2995";
  if (net > -3)  return "#818cf8";
  if (net > -8)  return "#6366f1";
  if (net > -15) return "#4f46e5";
  if (net > -25) return "#3730a3";
  return "#1e1b4b";
}

// ─── Polls data ───────────────────────────────────────────────────────────────
const RAW_POLLS: Poll[] = [
  { pollster: "Rasmussen Reports", endDate: "2026-02-26", sampleSize: 1500, sampleType: "LV", results: { Approve: 45, Disapprove: 53 } },
{ pollster: "Trafalgar Group", endDate: "2026-02-25", sampleSize: 1084, sampleType: "LV", results: { Approve: 51, Disapprove: 48 } },
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

const COLORS: Record<string, string> = { Approve: "#2563eb", Disapprove: "#ff0040" };

function round1(n: number) { return Math.round(n * 10) / 10; }

// ─── D3 State Map ─────────────────────────────────────────────────────────────
function StateMap({ tpsiNet, tpsiApprove, tpsiDisapprove }: {
  tpsiNet: number;
  tpsiApprove: number;
  tpsiDisapprove: number;
}) {
  const [tooltip, setTooltip] = useState<{
    code: string;
    x: number;
    y: number;
  } | null>(null);
  const [topoData, setTopoData] = useState<any>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 960, H = 600;

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
      .then((r) => r.json())
      .then(setTopoData)
      .catch(console.error);
  }, []);

  const { correctedStates, rawNationalNet, correctionOffset } = useMemo(() => {
    const stateNets: Record<string, number> = {};
    for (const [code, d] of Object.entries(STATE_RAW)) {
      stateNets[code] = round1((d.civiqs + d.economist + d.mc) / 3);
    }
    let totalPop = 0, weightedNet = 0;
    for (const [code, net] of Object.entries(stateNets)) {
      if (code === "DC") continue;
      const pop = STATE_POP[code] ?? 1;
      weightedNet += net * pop;
      totalPop += pop;
    }
    const rawNationalNet = round1(weightedNet / totalPop);
    const correctionOffset = round1(tpsiNet - rawNationalNet);
    const correctedStates: Record<string, any> = {};
    for (const [code, rawNet] of Object.entries(stateNets)) {
      const correctedNet = round1(rawNet + correctionOffset);
      correctedStates[code] = {
        rawNet,
        correctedNet,
        approve: round1(50 + correctedNet / 2),
        disapprove: round1(50 - correctedNet / 2),
        civiqs: STATE_RAW[code].civiqs,
        economist: STATE_RAW[code].economist,
        mc: STATE_RAW[code].mc,
      };
    }
    return { correctedStates, rawNationalNet, correctionOffset };
  }, [tpsiNet]);

  // Build D3 paths
  const statePaths = useMemo(() => {
    if (!topoData) return [];
    const projection = geoAlbersUsa().scale(1280).translate([W / 2, H / 2]);
    const pathGen = geoPath().projection(projection);
    const states = (feature(topoData, topoData.objects.states) as any).features;
    return states.map((f: any) => {
      const fips = parseInt(f.id, 10);
      const code = FIPS_TO_STATE[fips];
      const d = pathGen(f) ?? "";
      // Centroid for label
      const c = projection(
        [
          (f.bbox ? (f.bbox[0] + f.bbox[2]) / 2 : 0),
          (f.bbox ? (f.bbox[1] + f.bbox[3]) / 2 : 0),
        ] as [number, number]
      );
      const centroid = pathGen.centroid(f);
      return { code, d, cx: centroid[0], cy: centroid[1] };
    });
  }, [topoData]);

  const ttData = tooltip ? correctedStates[tooltip.code] : null;
  const ttName = tooltip ? (STATE_NAMES[tooltip.code] ?? tooltip.code) : "";

  const sortedStates = Object.entries(correctedStates)
    .filter(([c]) => c !== "DC")
    .sort((a, b) => b[1].correctedNet - a[1].correctedNet);

  return (
    <div>
      {/* ── Map header ── */}
      <div className="pap-hero">
        <div className="pap-stripe" />
        <div className="pap-hero-inner">
          <div>
            <div className="pap-eyebrow">State-by-State · TPSI Correction Applied</div>
            <h2 className="pap-hero-title" style={{ fontSize: "clamp(18px,2.5vw,32px)" }}>
              Trump Approval<br />
              <em style={{
                fontStyle: "normal",
                background: "linear-gradient(110deg,#e63946,#f87171)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>by State</em>
            </h2>
            <p className="pap-hero-desc">
              Averaged from Civiqs, Economist/YouGov & Morning Consult — corrected to TPSI national avg.
              Hover any state for detail.
            </p>
            <div className="pap-hero-badge-row">
              <span className="pap-badge pap-badge-purple">SOURCE: CIVIQS · ECONOMIST · MORNING CONSULT</span>
              <span className="pap-badge pap-badge-gold">CORRECTED TO TPSI NATIONAL AVG</span>
              <span className="pap-badge">RAW NAT'L NET: {rawNationalNet >= 0 ? "+" : ""}{rawNationalNet.toFixed(1)}</span>
              <span className="pap-badge" style={{
                borderColor: "rgba(251,191,36,0.3)",
                background: "rgba(251,191,36,0.06)",
                color: "rgba(251,191,36,0.85)",
              }}>
                CORRECTION: {correctionOffset >= 0 ? "+" : ""}{correctionOffset.toFixed(1)} PTS
              </span>
            </div>
          </div>
          <div className="pap-hero-read">
            {[
              { label: "TPSI APPROVE",    val: `${tpsiApprove.toFixed(1)}%`,    color: "rgba(77,127,212,1)"},
              { label: "TPSI DISAPPROVE", val: `${tpsiDisapprove.toFixed(1)}%`, color: "rgba(255,0,64,0.9)" },
              { label: "TPSI NET",        val: `${tpsiNet >= 0 ? "+" : ""}${tpsiNet.toFixed(1)}`, color: tpsiNet >= 0 ? "rgba(77,127,212,1) " : "rgba(255,0,64,0.9)" },
            ].map(({ label, val, color }) => (
              <div key={label} className="pap-hero-read-row">
                <span className="pap-hero-read-label">{label}</span>
                <span className="pap-hero-read-val" style={{ color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px",
        background: "var(--panel, #0f0f15)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderTop: "none",
      }}>
        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", whiteSpace: "nowrap" }}>NET APPROVE</span>
        <div style={{ display: "flex", gap: 2, flex: 1 }}>
          {[
            { label: "+30", net: 35 }, { label: "+20", net: 22 }, { label: "+10", net: 12 },
            { label: "+3", net: 3 }, { label: "0", net: 0 }, { label: "−3", net: -3 },
            { label: "−10", net: -12 }, { label: "−20", net: -22 }, { label: "−30", net: -35 },
          ].map(({ label, net }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 2 }}>
              <div style={{ width: "100%", height: 8, background: netToColor(net) }} />
              <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 6, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>{label}</span>
            </div>
          ))}
        </div>
        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", whiteSpace: "nowrap" }}>NET DISAPPROVE</span>
      </div>

      {/* ── D3 Albers USA Map ── */}
      <div style={{
        background: "#0b0b0f",
        border: "1px solid rgba(255,255,255,0.09)",
        borderTop: "none",
        padding: "10px",
        position: "relative",
      }}>
        {!topoData && (
          <div style={{
            height: 400, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "ui-monospace,monospace", fontSize: 10, letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.25)", textTransform: "uppercase",
          }}>
            Loading map…
          </div>
        )}
        {topoData && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "auto", display: "block" }}
            onMouseLeave={() => setTooltip(null)}
          >
            <defs>
              <pattern id="sm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.018)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#sm-grid)" />

            {statePaths.map(({ code, d, cx, cy }: { code: string | undefined; d: string; cx: number; cy: number }) => {
              if (!code) return null;
              const data = correctedStates[code];
              const fill = data ? netToColor(data.correctedNet) : "#1e1b4b";
              const isHov = tooltip?.code === code;

              return (
                <g key={code ?? d.slice(0, 20)}>
                  <path
                    d={d}
                    fill={fill}
                    stroke="#070709"
                    strokeWidth={isHov ? 2.5 : 0.6}
                    opacity={isHov ? 1 : 0.88}
                    style={{ cursor: "pointer", transition: "all 80ms" }}
                    onMouseEnter={(e) => {
                      if (!code) return;
                      const svgEl = svgRef.current!;
                      const rect = svgEl.getBoundingClientRect();
                      const scaleX = W / rect.width;
                      const scaleY = H / rect.height;
                      setTooltip({
                        code,
                        x: (e.clientX - rect.left) * scaleX,
                        y: (e.clientY - rect.top) * scaleY,
                      });
                    }}
                    onMouseMove={(e) => {
                      if (!code) return;
                      const svgEl = svgRef.current!;
                      const rect = svgEl.getBoundingClientRect();
                      const scaleX = W / rect.width;
                      const scaleY = H / rect.height;
                      setTooltip({
                        code,
                        x: (e.clientX - rect.left) * scaleX,
                        y: (e.clientY - rect.top) * scaleY,
                      });
                    }}
                  />
                  {/* State label */}
                  {code && cx && cy && (
                    <text
                      x={cx} y={cy + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="9"
                      fontFamily="var(--font-body), 'Geist Mono', monospace"
                      fontWeight="700"
                      fill="rgba(255,255,255,0.65)"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {code}
                    </text>
                  )}
                </g>
              );
            })}

            {/* SVG Tooltip */}
            {tooltip && ttData && (() => {
              const rawTx = tooltip.x + 16;
              const rawTy = tooltip.y - 10;
              const tooltipW = 170;
              const tooltipH = 152;
              const tx = Math.min(rawTx, W - tooltipW - 8);
              const ty = Math.max(rawTy, 4);
              const net = ttData.correctedNet;
              const netColor = net >= 0 ? "rgba(77,127,212,1) " : "rgba(255,0,64,0.9)";
              const netStr = `${net >= 0 ? "+" : ""}${net.toFixed(1)}`;
              return (
                <g transform={`translate(${tx},${ty})`} style={{ pointerEvents: "none" }}>
                  <rect x={0} y={0} width={tooltipW} height={tooltipH} rx={0}
                    fill="rgba(11,11,15,0.97)"
                    stroke="rgba(167,139,250,0.4)"
                    strokeWidth="1"
                  />
                  <rect x={0} y={0} width={tooltipW} height={3}
                    fill="rgba(167,139,250,0.5)"
                  />
                  <text x={10} y={22} fontSize={11} fontWeight="900" fontFamily="ui-monospace,monospace" fill="#fff">
                    {ttName?.toUpperCase()}
                  </text>
                  <text x={10} y={32} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.3)" letterSpacing={2}>{tooltip.code}</text>
                  <line x1={8} y1={38} x2={tooltipW - 8} y2={38} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                  <text x={10} y={52} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.35)" letterSpacing={1.5}>APPROVE</text>
                  <text x={tooltipW - 10} y={52} fontSize={11} fontFamily="ui-monospace,monospace" fontWeight="700" fill="rgba(77,127,212,1) " textAnchor="end">{ttData.approve.toFixed(1)}%</text>
                  <text x={10} y={67} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.35)" letterSpacing={1.5}>DISAPPROVE</text>
                  <text x={tooltipW - 10} y={67} fontSize={11} fontFamily="ui-monospace,monospace" fontWeight="700" fill="rgba(255,0,64,0.9)" textAnchor="end">{ttData.disapprove.toFixed(1)}%</text>
                  <text x={10} y={82} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.35)" letterSpacing={1.5}>NET</text>
                  <text x={tooltipW - 10} y={82} fontSize={11} fontFamily="ui-monospace,monospace" fontWeight="700" fill={netColor} textAnchor="end">{netStr}</text>
                  <line x1={8} y1={90} x2={tooltipW - 8} y2={90} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                  <text x={10} y={102} fontSize={6.5} fontFamily="ui-monospace,monospace" fontWeight="700" fill="rgba(167,139,250,0.6)" letterSpacing={1.5}>RAW SOURCES</text>
                  <text x={10} y={115} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.35)">CIVIQS</text>
                  <text x={tooltipW - 10} y={115} fontSize={9} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.5)" textAnchor="end">{ttData.civiqs >= 0 ? "+" : ""}{ttData.civiqs.toFixed(1)}</text>
                  <text x={10} y={128} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.35)">ECONOMIST</text>
                  <text x={tooltipW - 10} y={128} fontSize={9} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.5)" textAnchor="end">{ttData.economist >= 0 ? "+" : ""}{ttData.economist.toFixed(1)}</text>
                  <text x={10} y={141} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.35)">MORNING CONSULT</text>
                  <text x={tooltipW - 10} y={141} fontSize={9} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.5)" textAnchor="end">{ttData.mc >= 0 ? "+" : ""}{ttData.mc.toFixed(1)}</text>
                </g>
              );
            })()}
          </svg>
        )}
      </div>

      {/* ── State Table ── */}
      <div className="pap-table-panel" style={{ borderTop: "none" }}>
        <div className="pap-stripe" />
        <div className="pap-table-head">
          <span className="pap-table-head-title">ALL STATES — CORRECTED ESTIMATES</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="pap-badge pap-badge-gold">DATA: CIVIQS · ECONOMIST · MORNING CONSULT</span>
            <span className="pap-table-head-note">SORTED BY NET APPROVAL ↓</span>
          </div>
        </div>
        <div className="pap-table-scroll">
          <table className="pap-table">
            <thead>
              <tr>
                <th>STATE</th>
                <th className="r">CIVIQS</th>
                <th className="r">ECONOMIST</th>
                <th className="r">MORN. CONSULT</th>
                <th className="r">RAW AVG</th>
                <th className="r">CORRECTED NET</th>
                <th className="r">APPROVE</th>
                <th className="r">DISAPPROVE</th>
              </tr>
            </thead>
            <tbody>
              {sortedStates.map(([code, d]) => {
                const net = d.correctedNet;
                const pos = net >= 0;
                return (
                  <tr key={code}>
                    <td style={{ color: "rgba(255,255,255,0.85)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, background: netToColor(net), border: "1px solid rgba(255,255,255,0.12)", flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{STATE_NAMES[code] ?? code}</span>
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>{code}</span>
                      </div>
                    </td>
                    <td className="r" style={{ color: d.civiqs >= 0 ? "rgba(77,127,212,1) " : "rgba(255,80,80,0.8)" }}>
                      {d.civiqs >= 0 ? "+" : ""}{d.civiqs.toFixed(1)}
                    </td>
                    <td className="r" style={{ color: d.economist >= 0 ? "rgba(77,127,212,1) " : "rgba(255,80,80,0.8)" }}>
                      {d.economist >= 0 ? "+" : ""}{d.economist.toFixed(1)}
                    </td>
                    <td className="r" style={{ color: d.mc >= 0 ? "rgba(77,127,212,1)" : "rgba(255,80,80,0.8)" }}>
                      {d.mc >= 0 ? "+" : ""}{d.mc.toFixed(1)}
                    </td>
                    <td className="r" style={{ color: d.rawNet >= 0 ? "rgba(77,127,212,1) " : "rgba(255,80,80,0.5)" }}>
                      {d.rawNet >= 0 ? "+" : ""}{d.rawNet.toFixed(1)}
                    </td>
                    <td className="r" style={{ color: pos ? "rgba(77,127,212,1) " : "rgba(255,80,80,0.9)", fontWeight: 700 }}>
                      {net >= 0 ? "+" : ""}{net.toFixed(1)}
                    </td>
                    <td className="r pap-approve-col">{d.approve.toFixed(1)}%</td>
                    <td className="r pap-disapprove-col">{d.disapprove.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology */}
      <div className="pap-table-panel" style={{ borderTop: "none" }}>
        <div style={{ padding: "12px 18px" }}>
          <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--purple-soft, #a78bfa)", marginBottom: 6 }}>
            METHODOLOGY
          </div>
          <p style={{ fontFamily: "ui-monospace,monospace", fontSize: 8.5, lineHeight: 1.75, letterSpacing: "0.08em", color: "rgba(240,240,245,0.22)", margin: 0 }}>
            State net approval figures are sourced from Civiqs, The Economist/YouGov, and Morning Consult
            tracking polls. The three-pollster simple average is corrected by an additive offset equal to the
            difference between the population-weighted implied national net from raw state data and the current
            TPSI-adjusted national average (correction: {correctionOffset >= 0 ? "+" : ""}{correctionOffset.toFixed(1)} points).
            Approve/Disapprove splits are derived symmetrically around 50. State boundaries rendered using
            D3 geoAlbersUsa projection from US Atlas TopoJSON. Data from Civiqs, Economist/YouGov,
            and Morning Consult; corrected to TPSI national weight.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TrumpApprovalPage() {
  const { daily, latestApprove, latestDisapprove, latestNet, seriesForChart } = useMemo(() => {
    const pollsAdj = RAW_POLLS.map((p) => ({
      ...p,
      sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
    }));
    const keys = getCandidateList(RAW_POLLS).sort((a, b) => a.localeCompare(b));
    const range = getDateRange(RAW_POLLS);
    const dailyBase = buildDailyWeightedSeries(pollsAdj as any, keys, range.start, range.end);
    const dailyWithNet = dailyBase.map((row) => {
      const a = Number((row as any).Approve ?? 0);
      const d = Number((row as any).Disapprove ?? 0);
      return { ...row, Net: round1(a - d) };
    }) as any[];
    const latest = dailyWithNet[dailyWithNet.length - 1] ?? null;
    return {
      daily: dailyWithNet,
      latestApprove:    latest ? Number(latest.Approve    ?? 0) : 0,
      latestDisapprove: latest ? Number(latest.Disapprove ?? 0) : 0,
      latestNet:        latest ? Number(latest.Net        ?? 0) : 0,
      seriesForChart: [
        { key: "Approve",    label: "Approve",    color: COLORS.Approve    },
        { key: "Disapprove", label: "Disapprove", color: COLORS.Disapprove },
      ],
    };
  }, []);

  const netText = latestNet === 0 ? "EVEN"
    : latestNet > 0 ? `+${round1(latestNet).toFixed(1)}`
    : `${round1(latestNet).toFixed(1)}`;
  const netColor = latestNet >= 0 ? "rgba(43,255,0,0.85)" : "rgba(255,0,64,0.85)";

  return (
    <>
      <style>{CSS}</style>
      <div className="pap-root">
        <div className="pap-stripe" />

        {/* ── HERO ── */}
        <div className="pap-hero">
          <div className="pap-stripe" />
          <div className="pap-hero-inner">
            <div>
              <div className="pap-eyebrow">Donald Trump · 47th President of the United States</div>
              <h1 className="pap-hero-title">
                Job <em className="pap-em-approve">Approval</em><br />
                Rating
              </h1>
              <p className="pap-hero-desc">
                Daily weighted average across all included polls — recency decay,
                √n sample adjustment, LV/RV/A screen, and PSI Gold Standard upweighting.
              </p>
              <div className="pap-hero-badge-row">
                <span className="pap-badge pap-badge-live"><span className="pap-live-dot" />LIVE TRACKING</span>
                <span className="pap-badge pap-badge-gold">★ GOLD STANDARD ×{GOLD_STANDARD_MULTIPLIER} WEIGHT</span>
                <span className="pap-badge">{RAW_POLLS.length} POLLS IN MODEL</span>
                <span className="pap-badge pap-badge-purple">RECENCY · √N · LV/RV/A</span>
              </div>
            </div>
            <div className="pap-hero-read">
              {[
                { label: "APPROVE",    val: `${round1(latestApprove).toFixed(1)}%`,    color: "rgba(77,127,212,1) "  },
                { label: "DISAPPROVE", val: `${round1(latestDisapprove).toFixed(1)}%`, color: "rgba(255,0,64,0.9)" },
                { label: "NET",        val: netText,                                    color: netColor               },
              ].map(({ label, val, color }) => (
                <div key={label} className="pap-hero-read-row">
                  <span className="pap-hero-read-label">{label}</span>
                  <span className="pap-hero-read-val" style={{ color }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="pap-section-label">CURRENT AVERAGES</div>
        <div className="pap-kpi-grid">
          {[
            { label: "Approve", value: `${round1(latestApprove).toFixed(1)}%`, sub: "Daily weighted avg", color: "#2563eb", bar: latestApprove },
            { label: "Disapprove",  value: `${round1(latestDisapprove).toFixed(1)}%`, sub: "Daily weighted avg",   color: "rgba(255,0,64,0.75)",  bar: latestDisapprove },
            { label: "Net Approval",value: netText,                                    sub: "Approve − Disapprove", color: netColor,               bar: undefined },
            { label: "Polls",       value: `${RAW_POLLS.length}`,                     sub: "Included in model",    color: undefined,              bar: Math.min(100, RAW_POLLS.length / 3) },
          ].map(({ label, value, sub, color, bar }) => (
            <div key={label} className="pap-kpi">
              {color && <div className="pap-kpi-accent" style={{ background: color }} />}
              <div className="pap-kpi-label">{label}</div>
              <div className="pap-kpi-val" style={color ? { color } : {}}>{value}</div>
              <div className="pap-kpi-sub">{sub}</div>
              {bar !== undefined && (
                <div className="pap-kpi-bar">
                  <div className="pap-kpi-bar-fill" style={{ width: `${bar}%`, background: color ?? "var(--purple)" }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── CHART ── */}
        <PollingTimeSeriesChart
          data={daily as any[]}
          series={seriesForChart}
          yDomain={[30, 65]}
          title="Donald Trump national approval polling average"
          subtitle="Approve & Disapprove trendlines — hover to view daily values"
        />

        {/* ── STATE MAP ── */}
        <div className="pap-section-label">STATE-BY-STATE APPROVAL</div>
        <StateMap
          tpsiNet={latestNet}
          tpsiApprove={latestApprove}
          tpsiDisapprove={latestDisapprove}
        />

        {/* ── POLL TABLE ── */}
        <div className="pap-table-panel">
          <div className="pap-stripe" />
          <div className="pap-table-head">
            <span className="pap-table-head-title">ALL INCLUDED NATIONAL POLLS</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className="pap-badge pap-badge-gold">★ GOLD STANDARD = ×{GOLD_STANDARD_MULTIPLIER} WEIGHT</span>
              <span className="pap-table-head-note">SORTED BY END DATE ↓</span>
            </div>
          </div>
          <div className="pap-table-scroll">
            <table className="pap-table">
              <thead>
                <tr>
                  <th>POLLSTER</th>
                  <th className="r">END DATE</th>
                  <th className="r">N</th>
                  <th className="r">TYPE</th>
                  <th className="r">WEIGHT</th>
                  <th className="r">APPROVE</th>
                  <th className="r">DISAPPROVE</th>
                  <th className="r">NET</th>
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
                    return (
                      <tr key={`${p.pollster}-${p.endDate}-${p.sampleSize}`}>
                        <td style={{ color: "rgba(255,255,255,0.85)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{p.pollster}</span>
                            {gold && <span className="pap-gold-badge">GOLD</span>}
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
                        <td className="r pap-approve-col">{a.toFixed(0)}%</td>
                        <td className="r pap-disapprove-col">{d.toFixed(0)}%</td>
                        <td className={`r ${net > 0 ? "pap-net-pos" : net < 0 ? "pap-net-neg" : ""}`}>{netStr}</td>
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

// ─── CSS — unified design system matching generic ballot page ─────────────────
const CSS = `
  .pap-root {
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
    --approve:     rgba(204, 0, 0, 0.85);     /* Republican Red */
    --disapprove:  rgba(0, 51, 160, 0.85);    /* Democratic Blue */
  }

  @keyframes pap-fade-up {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes pap-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.35; transform:scale(0.75); }
  }
  @keyframes pap-bar-in {
    from { width:0; }
  }

  .pap-root {
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: pap-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }

  /* TRI STRIPE */
  .pap-stripe {
    height: 3px;
    background: linear-gradient(90deg,
      rgba(204,0,0,0.9)    0%,     rgba(204,0,0,0.9)    33.33%,
      var(--purple)        33.33%, var(--purple)        66.66%,
      rgba(77,127,212,1)   66.66%, rgba(77,127,212,1)   100%);
    );
  }

  /* LIVE DOT */
  .pap-live-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--purple);
    box-shadow: 0 0 8px rgba(124,58,237,0.7);
    animation: pap-pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* EYEBROW */
  .pap-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--purple-soft);
    margin-bottom: 12px;
  }
  .pap-eyebrow::before {
    content: '';
    display: block;
    width: 16px; height: 1px;
    background: var(--purple-soft);
    opacity: 0.5;
  }

  /* HERO */
  .pap-hero {
    border: 1px solid var(--border);
    background: var(--panel);
    position: relative;
    overflow: hidden;
  }
  .pap-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 45% 100% at 0% 60%,   rgba(255,0,64,0.05)    0%, transparent 65%),
      radial-gradient(ellipse 45% 100% at 100% 60%,  rgba(43,255,0,0.04)   0%, transparent 65%),
      radial-gradient(ellipse 30% 60%  at 50% 0%,    rgba(124,58,237,0.04) 0%, transparent 70%);
    pointer-events: none;
  }
  .pap-hero::after {
    content: '';
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      0deg, transparent, transparent 3px,
      rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px
    );
    pointer-events: none;
  }
  .pap-hero-inner {
    position: relative;
    padding: 26px 28px 24px;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: 20px;
  }
  @media (max-width: 640px) { .pap-hero-inner { grid-template-columns: 1fr; } }

  .pap-hero-title {
    font-family: "Quantico", system-ui, -apple-system, BlinkMacOSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: clamp(22px,3.5vw,46px);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 0.92;
    color: #fff;
    margin: 0 0 14px;
  }
  .pap-em-approve {
    font-style: normal;
    background: linear-gradient(110deg,#e63946,#f87171);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .pap-hero-desc {
    font-family: ui-monospace,monospace;
    font-size: 9.5px;
    letter-spacing: 0.12em;
    line-height: 1.75;
    color: var(--muted2);
    text-transform: uppercase;
    max-width: 520px;
  }
  .pap-hero-badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 16px;
  }

  /* BADGES */
  .pap-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pap-badge-live   { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .pap-badge-purple { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .pap-badge-gold   { border-color:rgba(167,139,250,0.30); background:rgba(124,58,237,0.07); color:var(--purple-soft); }

  /* HERO RIGHT */
  .pap-hero-read {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 170px;
  }
  .pap-hero-read-row {
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
  .pap-hero-read-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.24em; text-transform: uppercase;
    color: var(--muted3);
  }
  .pap-hero-read-val {
    font-family: ui-monospace,monospace;
    font-size: 20px; font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  /* SECTION LABEL */
  .pap-section-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--muted3);
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 12px;
  }
  .pap-section-label::before { content:''; width:20px; height:1px; background:var(--purple-soft); opacity:0.5; }
  .pap-section-label::after  { content:''; flex:1; height:1px; background:var(--border); }

  /* KPI GRID */
  .pap-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 8px;
  }
  @media (max-width: 860px) { .pap-kpi-grid { grid-template-columns: repeat(2,1fr); } }
  @media (max-width: 480px) { .pap-kpi-grid { grid-template-columns: 1fr; } }

  .pap-kpi {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 16px 18px;
    position: relative;
    overflow: hidden;
    transition: border-color 150ms ease;
  }
  .pap-kpi:hover { border-color: var(--border2); }
  .pap-kpi-accent {
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
  }
  .pap-kpi-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--muted3); margin-bottom: 8px;
  }
  .pap-kpi-val {
    font-family: ui-monospace,monospace;
    font-size: clamp(22px,2.5vw,30px);
    font-weight: 900;
    color: #fff; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .pap-kpi-sub {
    font-family: ui-monospace,monospace;
    font-size: 8px; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--muted3);
    margin-top: 6px;
  }
  .pap-kpi-bar { height: 2px; margin-top: 10px; background: rgba(255,255,255,0.07); }
  .pap-kpi-bar-fill {
    height: 100%;
    animation: pap-bar-in 800ms cubic-bezier(0.22,1,0.36,1) both;
  }

  /* TABLE PANEL */
  .pap-table-panel {
    background: var(--panel);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .pap-table-head {
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    padding: 14px 20px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
  }
  .pap-table-head-title {
    font-family: ui-monospace,monospace;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase;
    color: var(--purple-soft);
  }
  .pap-table-head-note {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; letter-spacing: 0.20em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pap-table-scroll {
    overflow-x: auto;
    max-height: 520px;
    overflow-y: auto;
  }
  table.pap-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 820px;
  }
  table.pap-table thead {
    position: sticky; top: 0;
    background: var(--bg2);
    z-index: 2;
  }
  table.pap-table th {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--muted3);
    padding: 10px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  table.pap-table th.r { text-align: right; }
  table.pap-table td {
    font-family: ui-monospace,monospace;
    font-size: 10.5px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    color: var(--muted); vertical-align: middle;
    font-variant-numeric: tabular-nums;
  }
  table.pap-table td.r { text-align: right; }
  table.pap-table tbody tr:hover { background: rgba(255,255,255,0.014); }
  table.pap-table tbody tr:last-child td { border-bottom: none; }

  .pap-gold-badge {
    display: inline-flex; align-items: center;
    padding: 1px 6px;
    border: 1px solid rgba(167,139,250,0.28);
    background: rgba(124,58,237,0.07);
    font-family: ui-monospace,monospace;
    font-size: 7px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--purple-soft);
  }

  .pap-approve-col    { color: rgba(204,0,0,0.85)   !important; font-weight: 700; }
  .pap-disapprove-col { color: rgba(77,127,212,.95)  !important; font-weight: 700; }
  .pap-net-pos        { color: rgba(204,0,0,0.9)    !important; font-weight: 700; }
  .pap-net-neg        { color: rgba(77,127,212,1)   !important; font-weight: 700; }

  @media (prefers-reduced-motion: reduce) {
    .pap-root { animation: none !important; }
    .pap-live-dot { animation: none !important; }
    .pap-kpi-bar-fill { animation: none !important; }
  }
`;