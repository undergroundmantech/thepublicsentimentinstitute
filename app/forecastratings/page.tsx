"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─── FIPS → State abbreviation ────────────────────────────────────────────────
const FIPS: Record<string, string> = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
  "12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS",
  "21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS",
  "29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY",
  "37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC",
  "46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
  "55":"WI","56":"WY",
};

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",
  IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",
  NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",
  ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",
  RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",
  UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",
  WI:"Wisconsin",WY:"Wyoming",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Poll {
  date: string;
  pollster: string;
  grade: string;
  sampleSize: number;
  sampleType: string;
  dem: number;
  rep: number;
  ind?: number;
  demLabel?: string;
  repLabel?: string;
  indLabel?: string;
}

interface Race {
  state: string;
  stateCode: string;         // abbreviation for map lookup
  incumbent: string;
  incumbentParty: "D" | "R" | "I";
  demCandidate: string;
  repCandidate: string;
  indCandidate?: string;
  rating: Rating;
  trend: Trend;
  latestDem: number;
  latestRep: number;
  latestInd?: number;
  historicalLean: number;
  forecastMargin: number;    // from spreadsheet "2028 Forecast" col (used as 2026 base)
  polls: Poll[];
  notes?: string;
}

type Rating = "Safe D" | "Likely D" | "Lean D" | "Toss-Up" | "Lean R" | "Likely R" | "Safe R";
type Trend  = "→" | "←D" | "←R" | "↑D" | "↑R";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const r1 = (n: number) => Math.round(n * 10) / 10;

function ratingColor(r: Rating): string {
  return { "Safe D":"#1d4ed8","Likely D":"#2563eb","Lean D":"#60a5fa",
    "Toss-Up":"#9333ea","Lean R":"#f87171","Likely R":"#ef4444","Safe R":"#b91c1c" }[r];
}
function ratingBg(r: Rating): string {
  return { "Safe D":"rgba(29,78,216,0.14)","Likely D":"rgba(37,99,235,0.11)",
    "Lean D":"rgba(96,165,250,0.10)","Toss-Up":"rgba(147,51,234,0.12)",
    "Lean R":"rgba(248,113,113,0.10)","Likely R":"rgba(239,68,68,0.12)",
    "Safe R":"rgba(185,28,28,0.16)" }[r];
}

function ratingFromMargin(m: number): Rating {
  if (m >  12) return "Safe D";
  if (m >   6) return "Likely D";
  if (m >   2) return "Lean D";
  if (m >  -2) return "Toss-Up";
  if (m >  -6) return "Lean R";
  if (m > -12) return "Likely R";
  return "Safe R";
}

function gradeWeight(g: string): number {
  return ({"A+":1.5,"A":1.3,"A-":1.2,"B+":1.1,"B":1.0,"B-":0.9,
           "C+":0.75,"C":0.65,"C-":0.5,"D+":0.4,"D":0.3} as Record<string,number>)[g] ?? 0.7;
}

function computeRating(polls: Poll[], historicalLean: number, forecastMargin: number) {
  if (polls.length === 0) {
    const margin = forecastMargin !== 0 ? forecastMargin * 0.6 : historicalLean;
    return { smoothedDem: 45 + margin/2, smoothedRep: 45 - margin/2,
             margin: r1(margin), rating: ratingFromMargin(margin), trend: "→" as Trend };
  }
  const now = Date.now();
  const weighted = polls.map(p => {
    const age    = (now - new Date(p.date + "T00:00:00").getTime()) / 86400000;
    const gradeW = gradeWeight(p.grade);
    const recW   = Math.exp(-age / 90);
    const sizeW  = Math.sqrt(Math.min(p.sampleSize, 2000)) / Math.sqrt(2000);
    const typeW  = p.sampleType.startsWith("LV") ? 1.1 : p.sampleType.startsWith("RV") ? 0.95 : 0.85;
    return { dem: p.dem, rep: p.rep, w: gradeW * recW * sizeW * typeW };
  });
  const totalW  = weighted.reduce((s, x) => s + x.w, 0);
  const avgDem  = weighted.reduce((s, x) => s + x.dem * x.w, 0) / totalW;
  const avgRep  = weighted.reduce((s, x) => s + x.rep * x.w, 0) / totalW;

  // Blend historical lean + spreadsheet forecast as a prior, diluted by poll count
  const histW   = Math.max(0, 1 - polls.length / 10);
  const priorM  = forecastMargin !== 0 ? forecastMargin * 0.5 : historicalLean;
  const blDem   = avgDem * (1 - histW) + (45 + priorM / 2) * histW;
  const blRep   = avgRep * (1 - histW) + (45 - priorM / 2) * histW;
  const margin  = r1(blDem - blRep);

  let trend: Trend = "→";
  if (polls.length >= 4) {
    const s = [...polls].sort((a, b) => b.date.localeCompare(a.date));
    const nAvg = (s[0].dem - s[0].rep + s[1].dem - s[1].rep) / 2;
    const oAvg = (s[s.length-2].dem - s[s.length-2].rep + s[s.length-1].dem - s[s.length-1].rep) / 2;
    const d = nAvg - oAvg;
    if (d > 3) trend = "↑D"; else if (d > 1) trend = "←D";
    else if (d < -3) trend = "↑R"; else if (d < -1) trend = "←R";
  }
  return { smoothedDem: r1(blDem), smoothedRep: r1(blRep), margin, rating: ratingFromMargin(margin), trend };
}

// ─── Race Data (sourced from spreadsheet + existing polls) ───────────────────
// forecastMargin = spreadsheet "2028 Forecast" value (positive = D lead, negative = R lead)
// historicalLean = adjusted for off-year cycle
const RAW: Omit<Race, "rating"|"trend"|"latestDem"|"latestRep">[] = [
  {
    state: "Alaska", stateCode: "AK",
    incumbent: "Dan Sullivan", incumbentParty: "R",
    demCandidate: "Mary Peltola", repCandidate: "Dan Sullivan",
    forecastMargin: 0.6,   // spreadsheet: 0.6 (true tossup)
    historicalLean: -8,
    polls: [
      { date:"2026-03-29", pollster:"AK Survey Research",       grade:"A+", sampleSize:1340, sampleType:"LV", dem:49, rep:44, demLabel:"Peltola", repLabel:"Sullivan" },
      { date:"2026-01-21", pollster:"PPP (D)",                  grade:"B",  sampleSize:611,  sampleType:"V",  dem:49, rep:47 },
      { date:"2026-01-14", pollster:"AK Survey Research",       grade:"A+", sampleSize:1681, sampleType:"LV", dem:48, rep:46 },
      { date:"2025-10-21", pollster:"Alaska Survey Research",   grade:"A+", sampleSize:1708, sampleType:"LV", dem:48, rep:46 },
      { date:"2025-08-25", pollster:"Alaska Survey Research",   grade:"A+", sampleSize:2053, sampleType:"RV", dem:42, rep:47 },
      { date:"2025-08-08", pollster:"Data for Progress",        grade:"B-", sampleSize:678,  sampleType:"LV", dem:45, rep:46 },
    ],
    notes: "Sullivan is a strong incumbent, but Peltola's name recognition from the House race makes this surprisingly competitive. Alaska's ranked-choice system adds uncertainty.",
  },
  {
    state: "Colorado", stateCode: "CO",
    incumbent: "John Hickenlooper", incumbentParty: "D",
    demCandidate: "John Hickenlooper", repCandidate: "TBD (R)",
    forecastMargin: -14.1,
    historicalLean: 8,
    polls: [],
    notes: "Hickenlooper is a popular incumbent in a state that has trended strongly D. Spreadsheet projects a comfortable D+14 margin.",
  },
  {
    state: "Delaware", stateCode: "DE",
    incumbent: "Chris Coons", incumbentParty: "D",
    demCandidate: "Chris Coons", repCandidate: "TBD (R)",
    forecastMargin: -22.2,
    historicalLean: 15,
    polls: [],
    notes: "Safe Democratic seat. Delaware has not elected a Republican senator in decades.",
  },
  {
    state: "Florida", stateCode: "FL",
    incumbent: "Ashley Moody", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Ashley Moody",
    forecastMargin: 8.9,
    historicalLean: -9,
    polls: [
      { date:"2026-04-02", pollster:"Emerson College",        grade:"A+", sampleSize:1125, sampleType:"LV", dem:36, rep:47 },
      { date:"2026-03-04", pollster:"Univ. of North Florida", grade:"A",  sampleSize:786,  sampleType:"LV", dem:38, rep:46 },
    ],
    notes: "Florida has shifted sharply R. Moody was appointed after Marco Rubio joined the cabinet. Democrats lack a strong recruit. Spreadsheet: R+8.9.",
  },
  {
    state: "Georgia", stateCode: "GA",
    incumbent: "Jon Ossoff", incumbentParty: "D",
    demCandidate: "Jon Ossoff", repCandidate: "TBD (R)",
    forecastMargin: -3.8,
    historicalLean: 0,
    polls: [
      { date:"2026-03-05", pollster:"Emerson College",    grade:"A+", sampleSize:1000, sampleType:"LV", dem:48, rep:43 },
      { date:"2025-09-15", pollster:"Quantus",            grade:"B-", sampleSize:624,  sampleType:"LV", dem:38, rep:38 },
      { date:"2025-08-07", pollster:"TIPP",               grade:"A+", sampleSize:2424, sampleType:"LV", dem:45, rep:44 },
      { date:"2025-05-22", pollster:"Cygnal",             grade:"A+", sampleSize:800,  sampleType:"LV", dem:46, rep:43 },
      { date:"2025-04-30", pollster:"Trafalgar Group",    grade:"C+", sampleSize:1426, sampleType:"LV", dem:48, rep:43 },
      { date:"2025-01-16", pollster:"WPAi (Kemp)",        grade:"B+", sampleSize:500,  sampleType:"LV", dem:44, rep:34 },
    ],
    notes: "Ossoff won his 2020 runoff in a rare D pickup. Spreadsheet gives Ossoff D+3.8 — genuine tossup in a cycle that typically favors the out-party.",
  },
  {
    state: "Illinois", stateCode: "IL",
    incumbent: "Dick Durbin (retiring)", incumbentParty: "D",
    demCandidate: "TBD (D)", repCandidate: "TBD (R)",
    forecastMargin: -17.4,
    historicalLean: 14,
    polls: [],
    notes: "Safe D open seat. Illinois has not elected a Republican senator since 1998.",
  },
  {
    state: "Iowa", stateCode: "IA",
    incumbent: "Joni Ernst", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Joni Ernst",
    forecastMargin: 2.9,
    historicalLean: -8,
    polls: [
      { date:"2026-02-20", pollster:"Change Research (D)", grade:"C-", sampleSize:1108, sampleType:"LV", dem:41, rep:44 },
    ],
    notes: "Iowa has drifted heavily R. Ernst is a strong incumbent. Spreadsheet shows R+2.9 — potentially competitive if D environment is strong but likely leans R.",
  },
  {
    state: "Kansas", stateCode: "KS",
    incumbent: "Roger Marshall", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Roger Marshall",
    forecastMargin: 9.6,
    historicalLean: -16,
    polls: [],
    notes: "Safe Republican seat. Spreadsheet: R+9.6.",
  },
  {
    state: "Kentucky", stateCode: "KY",
    incumbent: "Mitch McConnell", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "TBD (R)",
    forecastMargin: 8.6,
    historicalLean: -20,
    polls: [],
    notes: "McConnell has announced he will not seek re-election in 2026. Open seat but Kentucky is safely R. Spreadsheet: R+8.6.",
  },
  {
    state: "Louisiana", stateCode: "LA",
    incumbent: "Bill Cassidy", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Bill Cassidy",
    forecastMargin: 24.4,
    historicalLean: -18,
    polls: [],
    notes: "Safe Republican seat. Cassidy survived a primary challenge after voting to convict Trump. Spreadsheet: R+24.4.",
  },
  {
    state: "Maine", stateCode: "ME",
    incumbent: "Susan Collins", incumbentParty: "R",
    demCandidate: "Chloe Maxmin / Sara Gideon", repCandidate: "Susan Collins",
    forecastMargin: -1.2,
    historicalLean: 4,
    polls: [
      { date:"2026-03-26", pollster:"Emerson College",    grade:"A+", sampleSize:1075, sampleType:"LV", dem:48, rep:41 },
      { date:"2026-03-11", pollster:"OnMessage Inc.",     grade:"A+", sampleSize:600,  sampleType:"LV", dem:44, rep:42 },
      { date:"2026-03-09", pollster:"Quantus",            grade:"B-", sampleSize:800,  sampleType:"LV", dem:49, rep:42 },
      { date:"2026-03-04", pollster:"Pan Atlantic",       grade:"B+", sampleSize:810,  sampleType:"LV", dem:44, rep:40 },
      { date:"2026-02-24", pollster:"UNH",                grade:"C",  sampleSize:1120, sampleType:"LV", dem:49, rep:38 },
      { date:"2026-02-05", pollster:"Fabrizio (R)",       grade:"A-", sampleSize:800,  sampleType:"LV", dem:44, rep:45 },
      { date:"2026-01-13", pollster:"Workbench (Platner)",grade:"B",  sampleSize:900,  sampleType:"RV", dem:50, rep:50 },
      { date:"2025-12-10", pollster:"Pan Atlantic",       grade:"B+", sampleSize:820,  sampleType:"LV", dem:43, rep:42 },
      { date:"2025-11-12", pollster:"ME Resource Center", grade:"B",  sampleSize:783,  sampleType:"RV", dem:45, rep:41 },
      { date:"2025-10-10", pollster:"Zenith Polls",       grade:"B+", sampleSize:501,  sampleType:"LV", dem:38, rep:38 },
      { date:"2025-09-19", pollster:"PPP (D)",            grade:"B",  sampleSize:642,  sampleType:"V",  dem:44, rep:35 },
    ],
    notes: "Collins is perennially competitive despite Maine trending D. Challenger 'Platner' polling shows a genuine race. Spreadsheet forecast: D+1.2 — true tossup.",
  },
  {
    state: "Massachusetts", stateCode: "MA",
    incumbent: "Ed Markey", incumbentParty: "D",
    demCandidate: "Ed Markey", repCandidate: "TBD (R)",
    forecastMargin: -24.6,
    historicalLean: 20,
    polls: [],
    notes: "Safe D. Markey survived a high-profile primary challenge in 2020 and is well-positioned for re-election. Spreadsheet: D+24.6.",
  },
  {
    state: "Michigan", stateCode: "MI",
    incumbent: "Gary Peters (retiring)", incumbentParty: "D",
    demCandidate: "Mallory McMorrow", repCandidate: "Mike Rogers",
    forecastMargin: -1.2,
    historicalLean: 2,
    polls: [
      { date:"2026-01-29", pollster:"Emerson College",      grade:"A+", sampleSize:1000, sampleType:"LV", dem:46, rep:43, demLabel:"McMorrow", repLabel:"Rogers" },
      { date:"2026-01-14", pollster:"Glengariff Group",     grade:"B+", sampleSize:600,  sampleType:"LV", dem:42, rep:46 },
      { date:"2025-12-02", pollster:"Mitchell Research (D)",grade:"D",  sampleSize:1456, sampleType:"LV", dem:38, rep:44 },
      { date:"2025-11-14", pollster:"EPIC-MRA",             grade:"B+", sampleSize:600,  sampleType:"RV", dem:43, rep:42 },
      { date:"2025-11-06", pollster:"Rosetta Stone",        grade:"B",  sampleSize:637,  sampleType:"LV", dem:39, rep:46 },
      { date:"2025-07-07", pollster:"Normington Petts",     grade:"C-", sampleSize:700,  sampleType:"LV", dem:44, rep:48 },
      { date:"2025-05-27", pollster:"Glengariff Group",     grade:"B+", sampleSize:600,  sampleType:"RV", dem:42, rep:46 },
    ],
    notes: "Open seat. Michigan remains a core battleground. Spreadsheet: D+1.2 — pure tossup. McMorrow is a rising star; Rogers lost the 2024 Senate race narrowly.",
  },
  {
    state: "Minnesota", stateCode: "MN",
    incumbent: "Tina Smith (retiring)", incumbentParty: "D",
    demCandidate: "Angie Craig", repCandidate: "TBD (R)",
    forecastMargin: -7.1,
    historicalLean: 5,
    polls: [
      { date:"2026-02-11", pollster:"Emerson College", grade:"A+", sampleSize:1000, sampleType:"LV", dem:47, rep:40 },
    ],
    notes: "Open D seat. Craig is a strong recruit from MN-02. MN has voted D for Senate for decades. Spreadsheet: D+7.1 — likely but not safe.",
  },
  {
    state: "Mississippi", stateCode: "MS",
    incumbent: "Cindy Hyde-Smith", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Cindy Hyde-Smith",
    forecastMargin: 12.3,
    historicalLean: -18,
    polls: [],
    notes: "Safe R. Hyde-Smith is an entrenched incumbent. Spreadsheet: R+12.3.",
  },
  {
    state: "Montana", stateCode: "MT",
    incumbent: "Steve Daines", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Steve Daines",
    forecastMargin: 16.4,
    historicalLean: -14,
    polls: [],
    notes: "Safe R after Jon Tester's 2024 loss. Montana is now a reliably Republican state at the federal level. Spreadsheet: R+16.4.",
  },
  {
    state: "Nebraska", stateCode: "NE",
    incumbent: "Pete Ricketts", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Pete Ricketts",
    indCandidate: "Dan Osborn",
    forecastMargin: 7.2,
    historicalLean: -15,
    polls: [
      { date:"2026-02-19", pollster:"Impact Research (D)",    grade:"B",  sampleSize:600, sampleType:"LV", dem:0,  rep:48, ind:47, indLabel:"Osborn", repLabel:"Ricketts" },
      { date:"2026-01-23", pollster:"Lake Research Partners", grade:"B+", sampleSize:900, sampleType:"LV", dem:0,  rep:48, ind:47 },
      { date:"2025-04-10", pollster:"Change Research",        grade:"C-", sampleSize:526, sampleType:"LV", dem:0,  rep:46, ind:45 },
    ],
    notes: "Osborn nearly won in 2024 as an independent. A rematch is possible. Spreadsheet R+7.2, but three-way race dynamics make this more competitive than the number suggests.",
  },
  {
    state: "New Hampshire", stateCode: "NH",
    incumbent: "Jeanne Shaheen (retiring)", incumbentParty: "D",
    demCandidate: "Chris Pappas", repCandidate: "Chris Sununu",
    forecastMargin: -6.0,
    historicalLean: 3,
    polls: [
      { date:"2026-03-26", pollster:"Emerson College",      grade:"A+", sampleSize:1000, sampleType:"LV", dem:45, rep:44 },
      { date:"2026-03-23", pollster:"Saint Anselm",         grade:"A-", sampleSize:1491, sampleType:"RV", dem:46, rep:43 },
      { date:"2026-01-21", pollster:"UNH",                  grade:"C",  sampleSize:2053, sampleType:"LV", dem:50, rep:45 },
      { date:"2026-01-06", pollster:"One Nation (Sununu)",  grade:"B",  sampleSize:600,  sampleType:"LV", dem:47, rep:44 },
      { date:"2026-01-05", pollster:"Praecones Analytica",  grade:"B+", sampleSize:603,  sampleType:"RV", dem:42, rep:36 },
      { date:"2025-11-24", pollster:"Saint Anselm",         grade:"A-", sampleSize:2112, sampleType:"RV", dem:44, rep:41 },
      { date:"2025-10-15", pollster:"co/efficient",         grade:"B",  sampleSize:1034, sampleType:"LV", dem:45, rep:42 },
      { date:"2025-09-29", pollster:"UNH",                  grade:"C",  sampleSize:1235, sampleType:"LV", dem:49, rep:43 },
      { date:"2025-09-15", pollster:"co/efficient",         grade:"B",  sampleSize:904,  sampleType:"LV", dem:46, rep:43 },
      { date:"2025-09-09", pollster:"1892 Polling (R)",     grade:"C+", sampleSize:500,  sampleType:"LV", dem:45, rep:43 },
    ],
    notes: "Open D seat. Pappas leads in most polls; Sununu would be formidable if he enters. Spreadsheet: D+6 — leans D but Sununu candidacy changes the math.",
  },
  {
    state: "New Jersey", stateCode: "NJ",
    incumbent: "Cory Booker", incumbentParty: "D",
    demCandidate: "Cory Booker", repCandidate: "TBD (R)",
    forecastMargin: -19.1,
    historicalLean: 14,
    polls: [],
    notes: "Likely D. NJ has trended toward Rs in recent cycles but a presidential-environment blowout is unlikely at Senate level. Spreadsheet: D+19.1.",
  },
  {
    state: "New Mexico", stateCode: "NM",
    incumbent: "Ben Ray Luján", incumbentParty: "D",
    demCandidate: "Ben Ray Luján", repCandidate: "TBD (R)",
    forecastMargin: -15.2,
    historicalLean: 8,
    polls: [],
    notes: "Safe D. New Mexico has shifted blue over the past decade driven by its large Hispanic population and Albuquerque/Santa Fe metro areas. Spreadsheet: D+15.2.",
  },
  {
    state: "North Carolina", stateCode: "NC",
    incumbent: "Thom Tillis (retiring)", incumbentParty: "R",
    demCandidate: "Roy Cooper", repCandidate: "TBD (R)",
    forecastMargin: -9.8,
    historicalLean: -2,
    polls: [
      { date:"2026-04-02", pollster:"Quantus",             grade:"B-", sampleSize:987,  sampleType:"LV", dem:49, rep:44 },
      { date:"2026-03-31", pollster:"YouGov",              grade:"B+", sampleSize:871,  sampleType:"RV", dem:48, rep:34 },
      { date:"2026-03-30", pollster:"Nexus Strategies",    grade:"C",  sampleSize:800,  sampleType:"RV", dem:50, rep:32 },
      { date:"2026-03-26", pollster:"Harper Polling",      grade:"B+", sampleSize:600,  sampleType:"LV", dem:49, rep:41 },
      { date:"2026-03-16", pollster:"PPP (D)",             grade:"B",  sampleSize:556,  sampleType:"LV", dem:47, rep:44 },
      { date:"2026-02-20", pollster:"Change Research (D)", grade:"C-", sampleSize:1069, sampleType:"LV", dem:50, rep:40 },
      { date:"2026-01-20", pollster:"Change Research (D)", grade:"C-", sampleSize:1105, sampleType:"LV", dem:47, rep:42 },
      { date:"2026-01-19", pollster:"TIPP",                grade:"A+", sampleSize:1512, sampleType:"RV", dem:48, rep:24 },
      { date:"2025-11-13", pollster:"Harper Polling",      grade:"B+", sampleSize:600,  sampleType:"LV", dem:47, rep:39 },
      { date:"2025-09-19", pollster:"Harper Polling",      grade:"B+", sampleSize:600,  sampleType:"LV", dem:46, rep:42 },
      { date:"2025-08-14", pollster:"Harper Polling",      grade:"B+", sampleSize:600,  sampleType:"LV", dem:47, rep:39 },
      { date:"2025-08-01", pollster:"Emerson College",     grade:"A+", sampleSize:1000, sampleType:"RV", dem:47, rep:41 },
      { date:"2025-07-31", pollster:"Victory Insights",    grade:"D+", sampleSize:600,  sampleType:"LV", dem:44, rep:44 },
      { date:"2025-09-15", pollster:"Change Research (D)", grade:"C-", sampleSize:855,  sampleType:"LV", dem:48, rep:41 },
    ],
    notes: "Open seat with Cooper (former Gov.) polling strongly. Spreadsheet: D+9.8 — leans D but NC fundamentals are competitive. R nominee TBD; several candidates are exploring a run.",
  },
  {
    state: "Ohio", stateCode: "OH",
    incumbent: "Jon Husted (appointed)", incumbentParty: "R",
    demCandidate: "Sherrod Brown", repCandidate: "Jon Husted",
    forecastMargin: 3.7,
    historicalLean: -6,
    polls: [
      { date:"2026-03-16", pollster:"Quantus",         grade:"B-", sampleSize:925,  sampleType:"LV", dem:44, rep:46 },
      { date:"2026-03-12", pollster:"EMC Research (D)",grade:"D+", sampleSize:1343, sampleType:"LV", dem:51, rep:47 },
      { date:"2026-03-11", pollster:"OnMessage Inc.",  grade:"A+", sampleSize:600,  sampleType:"LV", dem:47, rep:45 },
      { date:"2025-12-11", pollster:"Emerson College", grade:"A+", sampleSize:850,  sampleType:"RV", dem:46, rep:49 },
      { date:"2025-11-12", pollster:"Hart Research",   grade:"A-", sampleSize:800,  sampleType:"LV", dem:48, rep:45 },
      { date:"2025-10-20", pollster:"YouGov",          grade:"B+", sampleSize:800,  sampleType:"RV", dem:49, rep:48 },
      { date:"2025-08-22", pollster:"Emerson College", grade:"A+", sampleSize:1000, sampleType:"RV", dem:44, rep:50 },
      { date:"2025-05-02", pollster:"YouGov",          grade:"B+", sampleSize:800,  sampleType:"RV", dem:46, rep:49 },
      { date:"2025-03-09", pollster:"YouGov",          grade:"B+", sampleSize:800,  sampleType:"RV", dem:41, rep:47 },
    ],
    notes: "Husted holds an open seat appointment after JD Vance's VP election. Sherrod Brown may run again after his 2024 loss. Spreadsheet: R+3.7 — competitive lean R.",
  },
  {
    state: "Oregon", stateCode: "OR",
    incumbent: "Jeff Merkley", incumbentParty: "D",
    demCandidate: "Jeff Merkley", repCandidate: "TBD (R)",
    forecastMargin: -21.9,
    historicalLean: 14,
    polls: [],
    notes: "Safe D. Merkley is well-entrenched. Oregon has trended left in recent cycles. Spreadsheet: D+21.9.",
  },
  {
    state: "Rhode Island", stateCode: "RI",
    incumbent: "Jack Reed", incumbentParty: "D",
    demCandidate: "Jack Reed", repCandidate: "TBD (R)",
    forecastMargin: -39.0,
    historicalLean: 20,
    polls: [],
    notes: "Safe D. Reed is one of the most secure incumbents in the Senate. Spreadsheet: D+39.",
  },
  {
    state: "South Carolina", stateCode: "SC",
    incumbent: "Lindsey Graham", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Lindsey Graham",
    forecastMargin: 4.6,
    historicalLean: -10,
    polls: [],
    notes: "Likely R. Graham remains a well-known incumbent. Spreadsheet: R+4.6.",
  },
  {
    state: "South Dakota", stateCode: "SD",
    incumbent: "Mike Rounds", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Mike Rounds",
    forecastMargin: 17.1,
    historicalLean: -18,
    polls: [],
    notes: "Safe R. Spreadsheet: R+17.1.",
  },
  {
    state: "Tennessee", stateCode: "TN",
    incumbent: "Bill Hagerty", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Bill Hagerty",
    forecastMargin: 27.0,
    historicalLean: -22,
    polls: [],
    notes: "Safe R. Tennessee has not been competitive for Democrats since the 1990s. Spreadsheet: R+27.",
  },
  {
    state: "Texas", stateCode: "TX",
    incumbent: "John Cornyn", incumbentParty: "R",
    demCandidate: "James Talarico", repCandidate: "Ken Paxton",
    forecastMargin: 4.0,
    historicalLean: -12,
    polls: [
      { date:"2026-03-20", pollster:"Impact Research (D)", grade:"B",  sampleSize:900,  sampleType:"LV", dem:44, rep:43 },
      { date:"2026-03-09", pollster:"PPP (D)",             grade:"B",  sampleSize:576,  sampleType:"LV", dem:47, rep:45 },
      { date:"2026-02-09", pollster:"YouGov (TSU/UH)",    grade:"B+", sampleSize:1502, sampleType:"LV", dem:44, rep:46 },
      { date:"2026-01-15", pollster:"Emerson College",     grade:"A+", sampleSize:1165, sampleType:"LV", dem:46, rep:46 },
      { date:"2025-11-19", pollster:"Ragnar",              grade:"B",  sampleSize:1000, sampleType:"LV", dem:44, rep:44 },
      { date:"2025-10-21", pollster:"Texas at Tyler",      grade:"C-", sampleSize:1032, sampleType:"RV", dem:37, rep:38 },
      { date:"2025-10-09", pollster:"YouGov (TSU/UH)",    grade:"B+", sampleSize:1650, sampleType:"RV", dem:46, rep:49 },
    ],
    notes: "Paxton's legal controversies and Texas's demographic shift make this interesting. Polls show a near-tie but the state's structural R lean is significant. Spreadsheet: R+4.",
  },
  {
    state: "Virginia", stateCode: "VA",
    incumbent: "Mark Warner", incumbentParty: "D",
    demCandidate: "Mark Warner", repCandidate: "Hung Cao / TBD",
    forecastMargin: -16.8,
    historicalLean: 6,
    polls: [
      { date:"2026-03-17", pollster:"Impact Research (D)", grade:"B", sampleSize:700, sampleType:"LV", dem:42, rep:47 },
      { date:"2025-12-11", pollster:"PPP (D)",             grade:"B", sampleSize:704, sampleType:"V",  dem:36, rep:42 },
    ],
    notes: "Warner is seeking re-election in a state that has trended D but polls show him underperforming. Spreadsheet: D+16.8, though recent polls are tighter.",
  },
  {
    state: "West Virginia", stateCode: "WV",
    incumbent: "Shelley Moore Capito", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Shelley Moore Capito",
    forecastMargin: 30.4,
    historicalLean: -25,
    polls: [],
    notes: "Safe R. WV is the most Republican state in the nation at the Senate level since Manchin's retirement. Spreadsheet: R+30.4.",
  },
  {
    state: "Wyoming", stateCode: "WY",
    incumbent: "Cynthia Lummis", incumbentParty: "R",
    demCandidate: "TBD (D)", repCandidate: "Cynthia Lummis",
    forecastMargin: 36.9,
    historicalLean: -30,
    polls: [],
    notes: "Safe R. Wyoming is the most Republican state in presidential elections. Spreadsheet: R+36.9.",
  },
];

// Build full race objects
const RACES: Race[] = RAW.map(r => {
  const { smoothedDem, smoothedRep, margin, rating, trend } = computeRating(r.polls, r.historicalLean, r.forecastMargin);
  const sorted = [...r.polls].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  return {
    ...r,
    rating,
    trend,
    latestDem: latest?.dem ?? smoothedDem,
    latestRep: latest?.rep ?? smoothedRep,
    latestInd: latest?.ind,
  };
});

// ─── Constants ────────────────────────────────────────────────────────────────
const CURRENT = { D: 47, R: 53 };
const RATING_ORDER: Rating[] = ["Safe D","Likely D","Lean D","Toss-Up","Lean R","Likely R","Safe R"];

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: { active?: boolean; payload?: {name:string;value:number;color:string}[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#141412", border:"1px solid rgba(255,255,255,0.1)", borderRadius:2,
      padding:"10px 14px", fontSize:11, fontFamily:"monospace", boxShadow:"0 8px 24px rgba(0,0,0,0.6)" }}>
      <div style={{ color:"rgba(255,255,255,0.3)", marginBottom:6, fontSize:9, textTransform:"uppercase", letterSpacing:"0.1em" }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:p.color, flexShrink:0 }} />
          <span style={{ color:"rgba(255,255,255,0.4)" }}>{p.name}</span>
          <span style={{ fontWeight:700, color:p.color, marginLeft:"auto", paddingLeft:14 }}>{Math.round(p.value * 10) / 10}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── Split bar ────────────────────────────────────────────────────────────────
function SplitBar({ dem, rep, h = 5 }: { dem: number; rep: number; h?: number }) {
  const total = dem + rep;
  if (total === 0) return <div style={{ height:h, background:"rgba(255,255,255,0.06)", borderRadius:1 }} />;
  const pct = (dem / total) * 100;
  return (
    <div style={{ display:"flex", height:h, borderRadius:1, overflow:"hidden", background:"rgba(255,255,255,0.06)" }}>
      <div style={{ width:`${pct}%`, background:"#2563eb", transition:"width 700ms cubic-bezier(0.22,1,0.36,1)" }} />
      <div style={{ flex:1, background:"#e63946" }} />
    </div>
  );
}

// ─── D3 US Map ────────────────────────────────────────────────────────────────
function SenateMap({ races, onSelect }: { races: Race[]; onSelect: (r: Race) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const raceMap = useMemo(() => {
    const m: Record<string, Race> = {};
    races.forEach(r => { m[r.stateCode] = r; });
    return m;
  }, [races]);

  // colors for states not in model
  const defaultFill = "#2a2a35";

  function fillFor(stateCode: string): string {
    const race = raceMap[stateCode];
    if (!race) return defaultFill;
    return ratingColor(race.rating);
  }

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        // Dynamic imports for D3 modules
        const d3geo = await import("https://esm.sh/d3-geo@3?bundle" as string);
        const topoclient = await import("https://esm.sh/topojson-client@3?bundle" as string);
        const topo = await fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(r => r.json());
        if (dead || !svgRef.current) return;

        const svg = svgRef.current;
        const proj = d3geo.geoAlbersUsa().scale(1280).translate([480, 300]);
        const path = d3geo.geoPath().projection(proj);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const states = (topoclient as any).feature(topo, topo.objects.states);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const border = (topoclient as any).mesh(topo, topo.objects.states, (a: any, b: any) => a !== b);

        while (svg.firstChild) svg.removeChild(svg.firstChild);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const f of states.features as any[]) {
          const fips = String(f.id).padStart(2, "0");
          const abbr = FIPS[fips];
          if (!abbr) continue;
          const race = raceMap[abbr];

          const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
          el.setAttribute("d", path(f) ?? "");
          el.style.fill = fillFor(abbr);
          el.style.stroke = "#111";
          el.style.strokeWidth = "0.8";
          el.style.cursor = race ? "pointer" : "default";
          el.style.transition = "filter 160ms ease, opacity 160ms ease";

          if (race) {
            el.addEventListener("click", () => onSelect(race));
            el.addEventListener("mouseover", () => { el.style.filter = "brightness(1.3) saturate(1.2)"; });
            el.addEventListener("mouseout",  () => { el.style.filter = ""; });
          }
          svg.appendChild(el);
        }

        // border mesh
        const be = document.createElementNS("http://www.w3.org/2000/svg", "path");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        be.setAttribute("d", path(border as any) ?? "");
        be.style.fill = "none";
        be.style.stroke = "#111";
        be.style.strokeWidth = "0.6";
        be.style.pointerEvents = "none";
        svg.appendChild(be);

      } catch (e) {
        // Map unavailable — fail silently
        console.warn("Map load failed", e);
      }
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceMap]);

  return (
    <div style={{ background:"#0b0b0f", border:"1px solid rgba(255,255,255,0.07)", padding:"16px 20px", marginBottom:20 }}>
      <div style={{ fontFamily:"monospace", fontSize:8, letterSpacing:"0.16em", textTransform:"uppercase",
        color:"rgba(255,255,255,0.3)", marginBottom:10 }}>
        Interactive race map — click a state
      </div>
      <svg ref={svgRef} viewBox="0 0 960 600" style={{ width:"100%", height:"auto", display:"block" }} />
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:10 }}>
        {RATING_ORDER.map(r => (
          <span key={r} style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:9,
            fontFamily:"monospace", color:"rgba(255,255,255,0.5)", letterSpacing:"0.06em" }}>
            <span style={{ width:8, height:8, borderRadius:2, background:ratingColor(r), display:"inline-block" }} />
            {r}
          </span>
        ))}
        <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:9,
          fontFamily:"monospace", color:"rgba(255,255,255,0.35)", letterSpacing:"0.06em" }}>
          <span style={{ width:8, height:8, borderRadius:2, background:defaultFill, display:"inline-block" }} />
          Not tracked
        </span>
      </div>
    </div>
  );
}

// ─── Seat balance bar ─────────────────────────────────────────────────────────
function SeatMap({ races }: { races: Race[] }) {
  const proj = {
    safe_d:    races.filter(r => r.rating === "Safe D").length,
    likely_d:  races.filter(r => r.rating === "Likely D").length,
    lean_d:    races.filter(r => r.rating === "Lean D").length,
    toss:      races.filter(r => r.rating === "Toss-Up").length,
    lean_r:    races.filter(r => r.rating === "Lean R").length,
    likely_r:  races.filter(r => r.rating === "Likely R").length,
    safe_r:    races.filter(r => r.rating === "Safe R").length,
  };

  // seats not in tracked races (the ~66 not up this cycle)
  const tracked = Object.values(proj).reduce((a, b) => a + b, 0);
  const notUp_D = Math.max(0, CURRENT.D - tracked);  // simplification
  const notUp_R = Math.max(0, CURRENT.R - tracked);

  const segments = [
    { label:"Not up (D)",    count: notUp_D,       color:"#1e3a5f" },
    { label:"Safe D",        count: proj.safe_d,   color:"#1d4ed8" },
    { label:"Likely D",      count: proj.likely_d, color:"#2563eb" },
    { label:"Lean D",        count: proj.lean_d,   color:"#60a5fa" },
    { label:"Toss-Up",       count: proj.toss,     color:"#9333ea" },
    { label:"Lean R",        count: proj.lean_r,   color:"#f87171" },
    { label:"Likely R",      count: proj.likely_r, color:"#ef4444" },
    { label:"Safe R",        count: proj.safe_r,   color:"#b91c1c" },
    { label:"Not up (R)",    count: notUp_R,        color:"#3d1515" },
  ];

  return (
    <div style={{ background:"#0b0b0f", border:"1px solid rgba(255,255,255,0.07)", padding:"16px 20px", marginBottom:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12 }}>
        <div style={{ fontFamily:"monospace", fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color:"rgba(255,255,255,0.35)" }}>
          Senate balance of power · 2026 projection
        </div>
        <div style={{ fontFamily:"monospace", fontSize:8, color:"rgba(255,255,255,0.2)" }}>Majority = 51 seats</div>
      </div>

      <div style={{ display:"flex", height:24, borderRadius:1, overflow:"hidden", marginBottom:10 }}>
        {segments.map(s => s.count > 0 && (
          <div key={s.label} style={{ flex:s.count, background:s.color, position:"relative", display:"flex",
            alignItems:"center", justifyContent:"center" }} title={`${s.label}: ${s.count}`}>
            {s.count >= 5 && (
              <span style={{ fontFamily:"monospace", fontSize:8, color:"rgba(255,255,255,0.75)", fontWeight:600 }}>
                {s.count}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:14 }}>
        {segments.filter(s => s.count > 0).map(s => (
          <div key={s.label} style={{ display:"flex", alignItems:"center", gap:4, padding:"2px 7px",
            background:`${s.color}22`, border:`1px solid ${s.color}44` }}>
            <div style={{ width:5, height:5, background:s.color, flexShrink:0 }} />
            <span style={{ fontFamily:"monospace", fontSize:7, color:"rgba(255,255,255,0.5)", letterSpacing:"0.08em" }}>{s.label}</span>
            <span style={{ fontFamily:"var(--font-display), sans-serif", fontSize:11, color:s.color }}>{s.count}</span>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"monospace", fontSize:7, letterSpacing:"0.16em", textTransform:"uppercase", color:"#2563eb", marginBottom:3 }}>Democrats</div>
          <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:36, color:"#2563eb", lineHeight:1 }}>{CURRENT.D}</div>
          <div style={{ fontFamily:"monospace", fontSize:7, color:"rgba(255,255,255,0.25)", marginTop:2 }}>Current seats</div>
        </div>
        <div style={{ textAlign:"center", padding:"0 16px", borderLeft:"1px solid rgba(255,255,255,0.06)", borderRight:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontFamily:"monospace", fontSize:7, letterSpacing:"0.16em", textTransform:"uppercase", color:"rgba(255,255,255,0.25)", marginBottom:3 }}>Majority</div>
          <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:26, color:"rgba(255,255,255,0.3)", lineHeight:1 }}>51</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontFamily:"monospace", fontSize:7, letterSpacing:"0.16em", textTransform:"uppercase", color:"#e63946", marginBottom:3 }}>Republicans</div>
          <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:36, color:"#e63946", lineHeight:1 }}>{CURRENT.R}</div>
          <div style={{ fontFamily:"monospace", fontSize:7, color:"rgba(255,255,255,0.25)", marginTop:2 }}>Current seats</div>
        </div>
      </div>
    </div>
  );
}

// ─── Race detail drawer ────────────────────────────────────────────────────────
function RaceDrawer({ race, onClose }: { race: Race; onClose: () => void }) {
  const sorted = [...race.polls].sort((a, b) => b.date.localeCompare(a.date));
  const chartData = [...race.polls]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(p => ({ date: p.date.slice(5), Dem: p.dem, Rep: p.rep }));

  const margin = race.latestDem - race.latestRep;
  const marginStr = margin > 0 ? `D+${Math.abs(margin)}` : margin < 0 ? `R+${Math.abs(margin)}` : "Even";
  const marginColor = margin > 0 ? "#2563eb" : margin < 0 ? "#e63946" : "rgba(255,255,255,0.5)";

  return (
    <div style={{ position:"fixed", inset:0, zIndex:999, display:"flex", justifyContent:"flex-end",
      background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div style={{ width:"min(620px, 100vw)", height:"100%", background:"#0b0b0f",
        borderLeft:"1px solid rgba(255,255,255,0.1)", display:"flex", flexDirection:"column",
        overflowY:"auto" }} onClick={e => e.stopPropagation()}>

        <div style={{ height:3, background:"linear-gradient(90deg, #e63946 0%, #7c3aed 50%, #2563eb 100%)", flexShrink:0 }} />

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)",
          display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:"monospace", fontSize:8, letterSpacing:"0.2em", textTransform:"uppercase",
              color:"rgba(255,255,255,0.3)", marginBottom:6 }}>
              {race.stateCode} · 2026 Senate · {race.incumbentParty === "D" ? "D Hold" : race.incumbentParty === "R" ? "R Hold" : "Open"}
            </div>
            <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:28, letterSpacing:"0.04em",
              textTransform:"uppercase", color:"#fff", lineHeight:1 }}>
              {race.state}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1px solid rgba(255,255,255,0.15)",
            color:"rgba(255,255,255,0.5)", fontFamily:"monospace", fontSize:9, letterSpacing:"0.1em",
            padding:"4px 10px", cursor:"pointer", textTransform:"uppercase" }}>
            Close ✕
          </button>
        </div>

        {/* Stats row */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
            {[
              { label:"Rating", val: race.rating, color: ratingColor(race.rating), bg: ratingBg(race.rating) },
              { label:"Latest margin", val: marginStr, color: marginColor, bg: "#0f0f15" },
              { label:"Trend", val: race.trend,
                color: race.trend.includes("D") ? "#2563eb" : race.trend.includes("R") ? "#e63946" : "rgba(255,255,255,0.5)",
                bg: "#0f0f15" },
            ].map(s => (
              <div key={s.label} style={{ padding:"12px 14px", background:s.bg,
                border:`1px solid ${s.color}33` }}>
                <div style={{ fontFamily:"monospace", fontSize:7, letterSpacing:"0.18em", textTransform:"uppercase",
                  color:"rgba(255,255,255,0.3)", marginBottom:4 }}>{s.label}</div>
                <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:14, textTransform:"uppercase",
                  color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", gap:16, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"monospace", fontSize:8, letterSpacing:"0.12em", textTransform:"uppercase",
                color:"#2563eb", marginBottom:3 }}>{race.demCandidate}</div>
              <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:26, color:"#2563eb", lineHeight:1 }}>
                {race.latestDem}%
              </div>
            </div>
            {race.latestInd != null && (
              <div style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontFamily:"monospace", fontSize:8, letterSpacing:"0.12em", textTransform:"uppercase",
                  color:"#a855f7", marginBottom:3 }}>{race.indCandidate ?? "Ind."}</div>
                <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:26, color:"#a855f7", lineHeight:1 }}>
                  {race.latestInd}%
                </div>
              </div>
            )}
            <div style={{ textAlign:"right", flex:1 }}>
              <div style={{ fontFamily:"monospace", fontSize:8, letterSpacing:"0.12em", textTransform:"uppercase",
                color:"#e63946", marginBottom:3 }}>{race.repCandidate}</div>
              <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:26, color:"#e63946", lineHeight:1 }}>
                {race.latestRep}%
              </div>
            </div>
          </div>
          <SplitBar dem={race.latestDem} rep={race.latestRep} h={6} />

          {/* Spreadsheet forecast note */}
          <div style={{ marginTop:12, padding:"8px 10px", background:"rgba(124,58,237,0.08)",
            border:"1px solid rgba(124,58,237,0.2)", fontFamily:"monospace", fontSize:8,
            color:"rgba(255,255,255,0.45)", letterSpacing:"0.04em" }}>
            PSI model forecast: {race.forecastMargin > 0
              ? `D+${Math.abs(r1(race.forecastMargin))}`
              : `R+${Math.abs(r1(race.forecastMargin))}`}
            {" "}· {race.polls.length} polls in model
          </div>
        </div>

        {/* Trend chart */}
        {chartData.length > 1 && (
          <div style={{ padding:"16px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
            <div style={{ fontFamily:"monospace", fontSize:8, letterSpacing:"0.16em", textTransform:"uppercase",
              color:"rgba(255,255,255,0.3)", marginBottom:10 }}>Poll trend</div>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={chartData} margin={{ top:4, right:10, left:-20, bottom:0 }}>
                <XAxis dataKey="date" tick={{ fontSize:8, fill:"rgba(255,255,255,0.25)", fontFamily:"monospace" }} tickLine={false} axisLine={false} />
                <YAxis domain={[25, 65]} tick={{ fontSize:8, fill:"rgba(255,255,255,0.25)", fontFamily:"monospace" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine y={50} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="Dem" stroke="#2563eb" strokeWidth={2} dot={{ fill:"#2563eb", r:3, strokeWidth:0 }} activeDot={{ r:4, fill:"#2563eb", strokeWidth:0 }} />
                <Line type="monotone" dataKey="Rep" stroke="#e63946" strokeWidth={2} dot={{ fill:"#e63946", r:3, strokeWidth:0 }} activeDot={{ r:4, fill:"#e63946", strokeWidth:0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Analysis */}
        {race.notes && (
          <div style={{ padding:"14px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
            <div style={{ fontFamily:"monospace", fontSize:8, letterSpacing:"0.16em", textTransform:"uppercase",
              color:"rgba(255,255,255,0.3)", marginBottom:6 }}>Analysis</div>
            <div style={{ fontFamily:"monospace", fontSize:10, color:"rgba(255,255,255,0.45)", lineHeight:1.8, letterSpacing:"0.02em" }}>
              {race.notes}
            </div>
          </div>
        )}

        {/* Poll table */}
        <div style={{ padding:"14px 24px", flex:1 }}>
          <div style={{ fontFamily:"monospace", fontSize:8, letterSpacing:"0.16em", textTransform:"uppercase",
            color:"rgba(255,255,255,0.3)", marginBottom:10 }}>
            Poll history · {sorted.length} polls
          </div>
          {sorted.length === 0 && (
            <div style={{ fontFamily:"monospace", fontSize:10, color:"rgba(255,255,255,0.25)", padding:"12px 0" }}>
              No public polls yet — forecast derived from historical lean and spreadsheet model.
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
            {sorted.map((p, i) => {
              const m = p.dem - p.rep;
              return (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"72px 1fr 40px 40px 70px",
                  gap:8, alignItems:"center", padding:"8px 10px",
                  background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", borderRadius:1 }}>
                  <div style={{ fontFamily:"monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:"0.04em" }}>
                    {p.date}
                  </div>
                  <div>
                    <div style={{ fontFamily:"monospace", fontSize:9, color:"rgba(255,255,255,0.6)", letterSpacing:"0.02em" }}>{p.pollster}</div>
                    <div style={{ fontFamily:"monospace", fontSize:7, color:"rgba(255,255,255,0.2)", letterSpacing:"0.06em" }}>{p.sampleType} n={p.sampleSize} {p.grade}</div>
                  </div>
                  <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:13, color:"#2563eb", textAlign:"right" }}>
                    {p.dem > 0 ? `${p.dem}%` : "—"}
                  </div>
                  <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:13, color:"#e63946", textAlign:"right" }}>
                    {p.rep}%
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <span style={{
                      display:"inline-flex", alignItems:"center", padding:"2px 7px", borderRadius:2,
                      fontFamily:"monospace", fontSize:8, fontWeight:500, letterSpacing:"0.04em",
                      color: m > 0 ? "#2563eb" : m < 0 ? "#e63946" : "rgba(255,255,255,0.4)",
                      background: m > 0 ? "rgba(37,99,235,0.12)" : m < 0 ? "rgba(230,57,70,0.12)" : "rgba(255,255,255,0.05)",
                    }}>
                      {m > 0 ? `D+${m}` : m < 0 ? `R+${Math.abs(m)}` : "Even"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Race Card ────────────────────────────────────────────────────────────────
function RaceCard({ race, onClick }: { race: Race; onClick: () => void }) {
  const margin = race.latestDem - race.latestRep;
  const marginStr = margin > 0 ? `D+${Math.abs(margin)}` : margin < 0 ? `R+${Math.abs(margin)}` : "Even";
  const marginColor = margin > 0 ? "#2563eb" : margin < 0 ? "#e63946" : "rgba(255,255,255,0.5)";
  const latestDate = [...race.polls].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;

  return (
    <div onClick={onClick}
      style={{ background:"#0f0f15", border:"1px solid rgba(255,255,255,0.07)", cursor:"pointer",
        display:"flex", flexDirection:"column", transition:"border-color 120ms, background 120ms" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.4)"; (e.currentTarget as HTMLElement).style.background = "#141420"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.background = "#0f0f15"; }}>
      <div style={{ height:3, background:`linear-gradient(90deg, #2563eb 0%, ${ratingColor(race.rating)} 100%)` }} />
      <div style={{ padding:"14px 16px", flex:1, display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontFamily:"monospace", fontSize:7, letterSpacing:"0.2em", textTransform:"uppercase",
              color:"rgba(255,255,255,0.25)", marginBottom:3 }}>
              {race.stateCode} · {race.incumbentParty === "D" ? "D Hold" : race.incumbentParty === "R" ? "R Hold" : "Open"}
            </div>
            <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:18, letterSpacing:"0.04em",
              textTransform:"uppercase", color:"#fff", lineHeight:1 }}>
              {race.state}
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
            <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 8px",
              fontFamily:"monospace", fontSize:8, fontWeight:500, letterSpacing:"0.08em",
              color: ratingColor(race.rating), background: ratingBg(race.rating),
              border:`1px solid ${ratingColor(race.rating)}44` }}>
              {race.rating}
            </span>
            <span style={{ fontFamily:"monospace", fontSize:9,
              color: race.trend.includes("D") ? "#2563eb" : race.trend.includes("R") ? "#e63946" : "rgba(255,255,255,0.3)" }}>
              {race.trend}
            </span>
          </div>
        </div>

        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <div>
              <div style={{ fontFamily:"monospace", fontSize:7, letterSpacing:"0.12em", textTransform:"uppercase", color:"#2563eb", marginBottom:2 }}>
                {race.demCandidate}
              </div>
              <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:22, color:"#2563eb", lineHeight:1 }}>
                {race.latestDem}%
              </div>
            </div>
            <div style={{ textAlign:"center", display:"flex", flexDirection:"column", justifyContent:"center" }}>
              <span style={{ fontFamily:"monospace", fontSize:9, color:marginColor, letterSpacing:"0.04em" }}>
                {marginStr}
              </span>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"monospace", fontSize:7, letterSpacing:"0.12em", textTransform:"uppercase", color:"#e63946", marginBottom:2 }}>
                {race.repCandidate}
              </div>
              <div style={{ fontFamily:"Bebas Neue, sans-serif", fontSize:22, color:"#e63946", lineHeight:1 }}>
                {race.latestRep}%
              </div>
            </div>
          </div>
          <SplitBar dem={race.latestDem} rep={race.latestRep} h={4} />
        </div>

        {/* PSI forecast badge */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontFamily:"monospace", fontSize:7, color:"rgba(255,255,255,0.2)", letterSpacing:"0.06em" }}>
            {race.polls.length > 0 ? `${race.polls.length} poll${race.polls.length > 1 ? "s" : ""} · ${latestDate}` : "Model-only"}
          </div>
          <span style={{ fontFamily:"monospace", fontSize:7, color:"#7c3aed", letterSpacing:"0.1em", textTransform:"uppercase" }}>
            Detail →
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SenateForecastPage() {
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [filter, setFilter] = useState<"all" | "D" | "R" | "toss">("all");
  const [sortBy, setSortBy] = useState<"rating" | "state" | "margin">("rating");

  const filtered = useMemo(() => {
    let list = [...RACES];
    if (filter === "D")    list = list.filter(r => r.rating.includes("D") || r.rating === "Toss-Up");
    if (filter === "R")    list = list.filter(r => r.rating.includes("R") || r.rating === "Toss-Up");
    if (filter === "toss") list = list.filter(r => ["Toss-Up","Lean D","Lean R"].includes(r.rating));
    if (sortBy === "state")  list.sort((a, b) => a.state.localeCompare(b.state));
    if (sortBy === "margin") list.sort((a, b) => (b.latestDem - b.latestRep) - (a.latestDem - a.latestRep));
    if (sortBy === "rating") list.sort((a, b) => RATING_ORDER.indexOf(a.rating) - RATING_ORDER.indexOf(b.rating));
    return list;
  }, [filter, sortBy]);

  const totalPolls = RACES.reduce((s, r) => s + r.polls.length, 0);
  const proj = {
    safe_d:   RACES.filter(r => r.rating === "Safe D").length,
    likely_d: RACES.filter(r => r.rating === "Likely D").length,
    lean_d:   RACES.filter(r => r.rating === "Lean D").length,
    toss:     RACES.filter(r => r.rating === "Toss-Up").length,
    lean_r:   RACES.filter(r => r.rating === "Lean R").length,
    likely_r: RACES.filter(r => r.rating === "Likely R").length,
    safe_r:   RACES.filter(r => r.rating === "Safe R").length,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
        body { background: #070709 !important; }

        .sf-wrap { max-width: 1280px; margin: 0 auto; padding: 32px 32px 80px; }
        @media(max-width:768px) { .sf-wrap { padding: 20px 16px 60px; } }

        .sf-tri { height: 3px; background: linear-gradient(90deg, #e63946 0%, #7c3aed 50%, #2563eb 100%); }

        .sf-hero { background: #0f0f15; border: 1px solid rgba(255,255,255,0.09); margin-bottom: 20px; overflow: hidden; }
        .sf-hero-inner { padding: 40px 48px 36px; }
        @media(max-width:768px) { .sf-hero-inner { padding: 24px 20px; } }
        .sf-hero-grid { display: grid; grid-template-columns: 1fr 340px; gap: 40px; align-items: center; }
        @media(max-width:900px) { .sf-hero-grid { grid-template-columns: 1fr; } }

        .sf-tag { display: inline-flex; align-items: center; gap: 6px; font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 20px; }
        .sf-headline { font-family: "Bebas Neue", sans-serif; font-size: clamp(36px,5.5vw,72px); letter-spacing: 0.03em; line-height: 0.93; text-transform: uppercase; color: #fff; margin-bottom: 14px; }
        .sf-headline .dem { color: #3b82f6; }
        .sf-headline .rep { color: #ef4444; }
        .sf-desc { font-family: "DM Mono", monospace; font-size: 10px; color: rgba(255,255,255,0.35); line-height: 1.85; letter-spacing: 0.04em; max-width: 480px; }

        .sf-summary-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.06); }
        @media(max-width:600px) { .sf-summary-grid { grid-template-columns: repeat(2,1fr); } }
        .sf-summary-cell { background: #0b0b0f; padding: 14px 16px; }
        .sf-summary-eyebrow { font-family: "DM Mono", monospace; font-size: 7px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 4px; }
        .sf-summary-num { font-family: "Bebas Neue", sans-serif; font-size: 30px; line-height: 1; }
        .sf-summary-sub { font-family: "DM Mono", monospace; font-size: 7px; color: rgba(255,255,255,0.2); letter-spacing: 0.06em; margin-top: 3px; }

        .sf-controls { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; justify-content: space-between; }
        .sf-filter-group { display: flex; gap: 4px; }
        .sf-filter-btn { padding: 5px 14px; background: transparent; border: 1px solid rgba(255,255,255,0.1); font-family: "DM Mono", monospace; font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 120ms; }
        .sf-filter-btn.active { border-color: #7c3aed; color: #7c3aed; background: rgba(124,58,237,0.1); }
        .sf-filter-btn:hover:not(.active) { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.6); }

        .sf-races-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        @media(max-width:1000px) { .sf-races-grid { grid-template-columns: repeat(2,1fr); } }
        @media(max-width:640px) { .sf-races-grid { grid-template-columns: 1fr; } }

        .sf-methodology { background: #0f0f15; border: 1px solid rgba(255,255,255,0.07); padding: 24px 28px; margin-top: 20px; }
        .sf-meth-title { font-family: "Bebas Neue", sans-serif; font-size: 18px; letter-spacing: 0.04em; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 10px; }
        .sf-meth-text { font-family: "DM Mono", monospace; font-size: 9.5px; color: rgba(255,255,255,0.3); line-height: 1.85; letter-spacing: 0.02em; }
      `}</style>

      {selectedRace && <RaceDrawer race={selectedRace} onClose={() => setSelectedRace(null)} />}

      <div className="sf-wrap">

        {/* ── Hero ── */}
        <div className="sf-hero">
          <div className="sf-tri" />
          <div className="sf-hero-inner">
            <div className="sf-hero-grid">
              <div>
                <div className="sf-tag">
                  <span style={{ color:"rgba(255,255,255,0.15)" }}>—</span>
                  <span>2026 Midterm Cycle</span>
                  <span style={{ color:"rgba(255,255,255,0.15)" }}>·</span>
                  <span style={{ color:"#7c3aed" }}>Senate Forecast</span>
                </div>
                <h1 className="sf-headline">
                  2026<br />
                  <span className="dem">Senate</span><br />
                  <span className="rep">Forecast</span>
                </h1>
                <p className="sf-desc">
                  PSI&rsquo;s weighted polling model for every competitive 2026 U.S. Senate race.
                  Ratings incorporate poll quality grades, recency, sample type, and historical
                  state lean. Forecast margins sourced from the PSI 2026 model spreadsheet and
                  blended with live polling averages.
                </p>
              </div>
              <div className="sf-summary-grid">
                {[
                  { label:"Safe / Likely D", val: proj.safe_d + proj.likely_d, color:"#2563eb", sub:"Strong D terrain" },
                  { label:"Lean D",          val: proj.lean_d,                  color:"#60a5fa", sub:"D-favored" },
                  { label:"Toss-Up",         val: proj.toss,                    color:"#9333ea", sub:"Could go either way" },
                  { label:"Lean / Likely R", val: proj.lean_r + proj.likely_r,  color:"#ef4444", sub:"R-favored" },
                  { label:"Safe R",          val: proj.safe_r,                  color:"#b91c1c", sub:"Uncompetitive" },
                  { label:"Races tracked",   val: RACES.length,                 color:"rgba(255,255,255,0.6)", sub:"In model" },
                  { label:"Polls ingested",  val: totalPolls,                   color:"rgba(255,255,255,0.6)", sub:"Total poll count" },
                  { label:"Updated",         val:"Apr 6",                       color:"rgba(255,255,255,0.6)", sub:"2026" },
                ].map(s => (
                  <div key={s.label} className="sf-summary-cell">
                    <div className="sf-summary-eyebrow"
                      style={{ color: s.color === "rgba(255,255,255,0.6)" ? "rgba(255,255,255,0.25)" : s.color }}>
                      {s.label}
                    </div>
                    <div className="sf-summary-num" style={{ color: s.color }}>{s.val}</div>
                    <div className="sf-summary-sub">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Seat Balance Bar ── */}
        <SeatMap races={RACES} />

        {/* ── D3 Map ── */}
        <SenateMap races={RACES} onSelect={setSelectedRace} />

        {/* ── Controls ── */}
        <div className="sf-controls">
          <span style={{ fontFamily:"DM Mono, monospace", fontSize:9, fontWeight:500,
            letterSpacing:"0.2em", textTransform:"uppercase", color:"rgba(255,255,255,0.35)" }}>
            Race Ratings · {filtered.length} races
          </span>
          <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
            <div className="sf-filter-group">
              {(["all","D","toss","R"] as const).map(f => (
                <button key={f} className={`sf-filter-btn${filter === f ? " active" : ""}`}
                  onClick={() => setFilter(f)}>
                  {f === "all" ? "All" : f === "D" ? "D Races" : f === "toss" ? "Toss-Ups" : "R Races"}
                </button>
              ))}
            </div>
            <div className="sf-filter-group">
              <span style={{ fontFamily:"DM Mono, monospace", fontSize:7, letterSpacing:"0.12em",
                textTransform:"uppercase", color:"rgba(255,255,255,0.25)", marginRight:4 }}>Sort:</span>
              {(["rating","state","margin"] as const).map(s => (
                <button key={s} className={`sf-filter-btn${sortBy === s ? " active" : ""}`}
                  onClick={() => setSortBy(s)}>
                  {s === "rating" ? "Rating" : s === "state" ? "State" : "Margin"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Race Cards ── */}
        <div className="sf-races-grid">
          {filtered.map(race => (
            <RaceCard key={race.stateCode} race={race} onClick={() => setSelectedRace(race)} />
          ))}
        </div>

        {/* ── Methodology ── */}
        <div className="sf-methodology">
          <div className="sf-tri" style={{ margin:"-24px -28px 20px" }} />
          <div className="sf-meth-title">Model Methodology</div>
          <p className="sf-meth-text">
            PSI&rsquo;s 2026 Senate Forecast blends three inputs: (1) a weighted polling average
            that discounts polls by age (90-day half-life), pollster grade (A+ through D+), sample
            size (&radic;n weighting), and sample type (LV 1.1&times;, RV 0.95&times;, adults
            0.85&times;); (2) a prior derived from the PSI 2026 forecast spreadsheet
            (blended at decreasing weight as more polls accumulate — zero weight at 10+ polls);
            and (3) a trend signal that compares the two most-recent polls to the two oldest polls
            in the dataset. Race ratings: Safe &ge; &plusmn;12 pts, Likely &plusmn;6&ndash;12, Lean
            &plusmn;2&ndash;6, Toss-Up within &plusmn;2. Nebraska models a three-way race with
            independent Dan Osborn. Spreadsheet forecast margins are sourced from PSI&rsquo;s
            internal model incorporating state baselines, partisan elasticity, turnout, presidential
            approval, and demographic shifts.
          </p>
        </div>

      </div>
    </>
  );
}