"use client";

import { useState } from "react";

// ─── Color tokens (match homepage vars) ───────────────────────────────────────
const C = {
  blue:      "#2563eb",
  pink:      "#e63946",
  purple:    "#7c3aed",
  purpleLt:  "#9d5cf0",
  cyan:      "#2fd8e4",
  green:     "#2fe4a0",
  orange:    "#f7a34f",
  gold:      "#f7d94f",
  muted:     "var(--muted2)",
  neutral:   "var(--muted2)",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface NetStat   { val: string; lbl: string; color: string }
interface BarRow    { label: string; pct: number; color: string; strong?: boolean; group?: string }
interface IssueRow  { issue: string; disApprove: number; approve: number }
interface RankRow   { label: string; pct1: number; color: string; rank: string }

interface Slide {
  id: string; qNum: string; category: string;
  title: string; subtitle: string;
  nets?:       NetStat[];
  bars?:       BarRow[];
  issueTable?: IssueRow[];
  rankTable?:  RankRow[];
  isCover?:    boolean;
}

// ─── Slide data (LV Weighted) ─────────────────────────────────────────────────
const SLIDES: Slide[] = [
  { id:"cover", qNum:"", category:"", title:"", subtitle:"", isCover:true },

  {
    id:"q10a", qNum:"Q10", category:"Mayoral Race",
    title:"Los Angeles Mayor — Primary Vote",
    subtitle:"Who will you vote for in the LA Mayoral Election on June 2nd? · N=465 · LV Weighted",
    nets:[
      { val:"29.7%", lbl:"Karen Bass",    color:C.blue },
      { val:"15.2%", lbl:"Spencer Pratt", color:C.pink },
      { val:"31.1%", lbl:"Undecided",     color:C.muted },
    ],
    bars:[
      { label:"Karen Bass",            pct:30, color:C.blue,    strong:true },
      { label:"Spencer Pratt",         pct:15, color:C.pink,    strong:true },
      { label:"Other candidate",       pct:8,  color:C.purpleLt },
      { label:"Nithya Raman",          pct:7,  color:C.cyan },
      { label:"Adam Miller",           pct:5,  color:C.orange },
      { label:"Rae Huang",             pct:4,  color:C.green },
      { label:"Not sure / undecided",  pct:31, color:C.muted },
    ],
  },

  {
    id:"q10b", qNum:"Q10+Q11", category:"Mayoral Race",
    title:"Mayoral Race — With Leaners Allocated",
    subtitle:"First choice + leaner allocation · N=465 · LV Weighted",
    nets:[
      { val:"39.9%", lbl:"Karen Bass",    color:C.blue },
      { val:"21.1%", lbl:"Spencer Pratt", color:C.pink },
      { val:"B+18.8",lbl:"Bass Margin",   color:C.blue },
    ],
    bars:[
      { label:"Karen Bass",      pct:40, color:C.blue,    strong:true },
      { label:"Spencer Pratt",   pct:21, color:C.pink,    strong:true },
      { label:"Nithya Raman",    pct:12, color:C.cyan },
      { label:"Rae Huang",       pct:8,  color:C.green },
      { label:"Adam Miller",     pct:7,  color:C.orange },
      { label:"Other candidate", pct:12, color:C.purpleLt },
    ],
  },

  {
    id:"q3", qNum:"Q3", category:"Voter Behavior",
    title:"Voter Motivation — 2026 Midterm Election",
    subtitle:"How would you describe your intention and motivation to vote? · N=465 · LV Weighted",
    nets:[
      { val:"82%",   lbl:"Certain / Very Likely",        color:C.green },
      { val:"66.4%", lbl:"Certain + Highly Motivated",   color:C.blue },
    ],
    bars:[
      { label:"Certain to vote & highly motivated",       pct:66, color:C.green, strong:true },
      { label:"Very likely to vote & feel motivated",     pct:16, color:C.blue },
      { label:"Somewhat likely, not strongly motivated",  pct:9,  color:C.gold },
      { label:"Motivated but unsure if will vote",        pct:5,  color:C.orange },
      { label:"Not very likely, little motivation",       pct:2,  color:C.muted },
      { label:"Certain not to vote",                      pct:3,  color:C.muted },
    ],
  },

  {
    id:"q4", qNum:"Q4", category:"Voter Behavior",
    title:"How Do You Plan to Cast Your Ballot?",
    subtitle:"2026 Midterm Election · N=465 · LV Weighted",
    bars:[
      { label:"In person Election Day — know polling location",          pct:29, color:C.blue,    strong:true },
      { label:"Mail-in — already turned in ballot",                      pct:17, color:C.blue },
      { label:"Mail-in — already requested or received",                 pct:17, color:C.blue },
      { label:"Haven't decided how I will vote yet",                     pct:8,  color:C.gold },
      { label:"In person Election Day — need to confirm location",       pct:8,  color:C.cyan },
      { label:"Early in-person — know when and where",                   pct:7,  color:C.green },
      { label:"Mail-in — plan to request",                               pct:4,  color:C.purpleLt },
      { label:"Early in-person — still need to look up details",         pct:3,  color:C.orange },
      { label:"Do not plan to vote",                                     pct:4,  color:C.muted },
    ],
  },

  {
    id:"q5", qNum:"Q5", category:"Voter Behavior",
    title:"Social Circle Turnout Expectation",
    subtitle:"How many of the 5–10 people closest to you do you expect to vote? · N=465 · LV",
    bars:[
      { label:"All or nearly all of them", pct:39, color:C.green,  strong:true },
      { label:"Most of them",              pct:31, color:C.blue },
      { label:"About half",                pct:13, color:C.gold },
      { label:"A few of them",             pct:11, color:C.orange },
      { label:"Not sure",                  pct:3,  color:C.muted },
      { label:"None of them",              pct:2,  color:C.muted },
    ],
  },

  {
    id:"q6", qNum:"Q6", category:"2024 Presidential Election",
    title:"Who Did You Vote for in 2024?",
    subtitle:"Presidential Recall Vote · N=465 · LV Weighted",
    nets:[
      { val:"61%",  lbl:"Kamala Harris", color:C.blue },
      { val:"25%",  lbl:"Donald Trump",  color:C.pink },
      { val:"D+36", lbl:"LV Advantage",  color:C.blue },
    ],
    bars:[
      { label:"Kamala Harris", pct:61, color:C.blue,    strong:true },
      { label:"Donald Trump",  pct:25, color:C.pink,    strong:true },
      { label:"Third party",   pct:4,  color:C.purpleLt },
      { label:"Did not vote",  pct:10, color:C.muted },
    ],
  },

  {
    id:"q8", qNum:"Q8", category:"Political Identity",
    title:"General Political Outlook",
    subtitle:"Which best describes your political outlook? · N=465 · LV Weighted",
    bars:[
      { label:"Progressive / Socialist Democrat",   pct:24, color:C.blue,     strong:true, group:"DEMOCRAT" },
      { label:"Mainline / Institutional Democrat",   pct:11, color:C.blue },
      { label:"Working-Class / Union Democrat",      pct:8,  color:C.blue },
      { label:"Coalition / Civil Rights Democrat",   pct:5,  color:C.blue },
      { label:"America First Republican",            pct:5,  color:C.pink,     strong:true, group:"REPUBLICAN" },
      { label:"Suburban / Professional Republican",  pct:4,  color:C.pink },
      { label:"Populist / Working-Class Republican", pct:3,  color:C.pink },
      { label:"Libertarian-Oriented Republican",     pct:3,  color:C.pink },
      { label:"Lean Democratic Independent",         pct:16, color:C.purpleLt, strong:true, group:"INDEPENDENT" },
      { label:"Moderate Independent / Centrist",     pct:7,  color:C.purpleLt },
      { label:"Lean Republican Independent",         pct:5,  color:C.purpleLt },
      { label:"Anti-Establishment Independent",      pct:3,  color:C.purpleLt },
      { label:"None / No clear preference",          pct:7,  color:C.muted },
    ],
  },

  {
    id:"q9", qNum:"Q9", category:"Party Registration",
    title:"Which Party Are You Registered With?",
    subtitle:"N=465 · LV Weighted",
    nets:[
      { val:"56.6%", lbl:"Democrat",           color:C.blue },
      { val:"16.0%", lbl:"Republican",         color:C.pink },
      { val:"27.3%", lbl:"Independent/Other",  color:C.purpleLt },
      { val:"D+41",  lbl:"LV Reg. Advantage",  color:C.blue },
    ],
    bars:[
      { label:"Democrat",            pct:57, color:C.blue,     strong:true },
      { label:"Republican",          pct:16, color:C.pink,     strong:true },
      { label:"Independent / Other", pct:27, color:C.purpleLt },
    ],
  },

  {
    id:"q7", qNum:"Q7", category:"Issue Priority",
    title:"Issue Priority Ranking",
    subtitle:"% who ranked each issue #1 (most important) · N=465 · LV Weighted",
    rankTable:[
      { label:"Economy, Jobs & Cost of Living",           pct1:43, color:C.gold,     rank:"Most Important" },
      { label:"Political Corruption, Lobbying & Money",   pct1:13, color:C.blue,     rank:"#2 Choice" },
      { label:"Healthcare, Social Security & Medicare",   pct1:8,  color:C.cyan,     rank:"#3 Choice" },
      { label:"Immigration & Border Security",            pct1:7,  color:C.pink,     rank:"#4 Choice" },
      { label:"Civil Rights, Personal Freedoms & Social", pct1:6,  color:C.purpleLt, rank:"#5 Choice" },
      { label:"Crime, Public Safety & Policing",          pct1:6,  color:C.orange,   rank:"#6 Choice" },
      { label:"Guns & Second Amendment Rights",           pct1:5,  color:C.pink,     rank:"#7 Choice" },
      { label:"Energy, Climate & the Environment",        pct1:4,  color:C.green,    rank:"#8 Choice" },
      { label:"Education, Housing & Family Issues",       pct1:3,  color:C.purpleLt, rank:"#9 Choice" },
      { label:"Foreign Policy & National Security",       pct1:2,  color:C.muted,    rank:"#10 Choice" },
    ],
  },

  {
    id:"q12", qNum:"Q12", category:"Candidate Trust",
    title:"Karen Bass — Trusted Most Per Issue",
    subtitle:"% selecting Bass as most trusted candidate per issue · N=465 · LV Weighted · Sorted by score",
    bars:[
      { label:"Civil Rights & Social Issues",  pct:34, color:C.blue,  strong:true },
      { label:"Energy, Climate & Environment", pct:29, color:C.green },
      { label:"Crime, Public Safety",          pct:29, color:C.blue },
      { label:"Guns & 2nd Amendment",          pct:29, color:C.blue },
      { label:"Healthcare & Medicare",         pct:28, color:C.cyan },
      { label:"Economy & Jobs",                pct:28, color:C.blue },
      { label:"Immigration",                   pct:28, color:C.blue },
      { label:"Education & Housing",           pct:27, color:C.blue },
      { label:"Foreign Policy",                pct:27, color:C.blue },
      { label:"Political Corruption",          pct:25, color:C.purpleLt },
    ],
  },

  {
    id:"q13a", qNum:"Q13", category:"Candidate Favorability",
    title:"Mayor Candidates — Favorability",
    subtitle:"NET Approve vs NET Disapprove · N=465 · LV Weighted",
    nets:[
      { val:"+0.6",  lbl:"Bass Net Fav",  color:C.gold },
      { val:"−2.3",  lbl:"Pratt Net Fav", color:C.pink },
      { val:"+6.7",  lbl:"Raman Net Fav", color:C.green },
    ],
    bars:[
      { label:"Approve",             pct:46, color:C.green, strong:true, group:"KAREN BASS" },
      { label:"Disapprove",          pct:45, color:C.pink },
      { label:"Approve",             pct:34, color:C.green, strong:true, group:"SPENCER PRATT" },
      { label:"Disapprove",          pct:37, color:C.pink },
      { label:"Approve",             pct:33, color:C.green, strong:true, group:"NITHYA RAMAN" },
      { label:"Disapprove",          pct:27, color:C.pink },
      { label:"Approve",             pct:21, color:C.green, group:"ADAM MILLER" },
      { label:"Disapprove",          pct:23, color:C.pink },
      { label:"Approve",             pct:23, color:C.green, group:"RAE HUANG" },
      { label:"Disapprove",          pct:21, color:C.pink },
    ],
  },

  {
    id:"q13b", qNum:"Q13", category:"Statewide Figures",
    title:"Statewide & National Figure Approvals",
    subtitle:"NET Approve · N=465 · LV Weighted",
    bars:[
      { label:"Gavin Newsom",     pct:58, color:C.green,    strong:true, group:"APPROVE" },
      { label:"Kendrick Lamar",   pct:45, color:C.blue },
      { label:"Xavier Becerra",   pct:42, color:C.blue },
      { label:"Steve Hilton",     pct:25, color:C.orange,   group:"DISAPPROVE-LEANING" },
      { label:"Donald Trump",     pct:21, color:C.pink,     strong:true },
      { label:"JD Vance",         pct:20, color:C.pink },
      { label:"Chad Bianco",      pct:22, color:C.orange },
    ],
  },

  {
    id:"q13trump", qNum:"Q13", category:"Presidential Approval",
    title:"Trump — Overall Presidential Approval",
    subtitle:"Do you approve or disapprove of President Trump's performance? · N=465 · LV",
    nets:[
      { val:"75.9%", lbl:"NET Disapprove", color:C.pink },
      { val:"21.4%", lbl:"NET Approve",    color:C.green },
      { val:"−54.5", lbl:"Net Approval",   color:C.pink },
    ],
    bars:[
      { label:"Strongly disapprove",  pct:70, color:C.pink,  strong:true, group:"DISAPPROVE" },
      { label:"Somewhat disapprove",  pct:6,  color:C.pink },
      { label:"Strongly approve",     pct:13, color:C.green, strong:true, group:"APPROVE" },
      { label:"Somewhat approve",     pct:9,  color:C.green },
      { label:"Not sure / no opinion",pct:3,  color:C.muted, group:"NEUTRAL" },
    ],
  },

  {
    id:"q14", qNum:"Q14", category:"Trump Issue Approval",
    title:"Trump Approval by Issue — Los Angeles",
    subtitle:"NET Approve vs NET Disapprove per issue · N=465 · LV Weighted · Sorted by disapproval",
    issueTable:[
      { issue:"Handling of Epstein Files",                disApprove:76, approve:19 },
      { issue:"Economy, Jobs & Cost of Living",           disApprove:76, approve:22 },
      { issue:"Handling of Iran (Operation Epic Fury)",   disApprove:74, approve:22 },
      { issue:"Healthcare, Social Security & Medicare",   disApprove:73, approve:23 },
      { issue:"Political Corruption & Lobbying",          disApprove:72, approve:22 },
      { issue:"Education, Housing & Family Issues",       disApprove:72, approve:23 },
      { issue:"Energy, Climate & the Environment",        disApprove:71, approve:23 },
      { issue:"Civil Rights, Personal Freedoms & Social", disApprove:71, approve:25 },
      { issue:"Foreign Policy & National Security",       disApprove:71, approve:26 },
      { issue:"Crime, Public Safety & Policing",          disApprove:70, approve:25 },
      { issue:"Immigration & Border Security",            disApprove:68, approve:30 },
      { issue:"Guns & Second Amendment Rights",           disApprove:67, approve:25 },
    ],
  },

  {
    id:"q15", qNum:"Q15", category:"Economic Conditions",
    title:"Household Economic Difficulty",
    subtitle:"Over the last month, how difficult has it been to pay usual household expenses? · N=465 · LV",
    nets:[
      { val:"56.9%", lbl:"Some Difficulty",   color:C.pink },
      { val:"41.9%", lbl:"Little Difficulty", color:C.green },
    ],
    bars:[
      { label:"Very difficult",       pct:22, color:C.pink,  strong:true },
      { label:"Somewhat difficult",   pct:35, color:C.pink },
      { label:"Not very difficult",   pct:27, color:C.green },
      { label:"Not at all difficult", pct:15, color:C.green, strong:true },
      { label:"Not sure / no opinion",pct:1,  color:C.muted },
    ],
  },

  {
    id:"q16", qNum:"Q16", category:"Candidate Character",
    title:"Israel PAC Donations",
    subtitle:"If a candidate accepted donations from a PAC supporting Israel, more or less likely to vote for them? · N=465 · LV",
    nets:[
      { val:"44.8%", lbl:"NET Less Likely", color:C.pink },
      { val:"21.6%", lbl:"NET More Likely", color:C.green },
      { val:"33.6%", lbl:"No Difference",  color:C.muted },
    ],
    bars:[
      { label:"Much less likely",           pct:29, color:C.pink,    strong:true, group:"LESS LIKELY" },
      { label:"Somewhat less likely",       pct:16, color:C.pink },
      { label:"No difference / No opinion", pct:34, color:C.neutral, group:"NO DIFFERENCE" },
      { label:"Somewhat more likely",       pct:12, color:C.green,   group:"MORE LIKELY" },
      { label:"Much more likely",           pct:9,  color:C.green,   strong:true },
    ],
  },

  {
    id:"q17", qNum:"Q17", category:"Culture & Community",
    title:"Kendrick Lamar vs. Drake — Who Won?",
    subtitle:"Who do you believe won the 2024 Kendrick Lamar versus Drake Rap Battle? · N=465 · LV",
    nets:[
      { val:"47.6%", lbl:"Kendrick Lamar", color:C.purple },
      { val:"10.2%", lbl:"Drake",          color:C.orange },
    ],
    bars:[
      { label:"Kendrick Lamar",       pct:48, color:C.purple, strong:true },
      { label:"Undecided / not sure", pct:42, color:C.muted },
      { label:"Drake",                pct:10, color:C.orange },
    ],
  },
];

// ─── National Poll Slide data (N=893, LV Weighted, May 2026) ─────────────────
const NATIONAL_SLIDES: Slide[] = [
  { id:"nat-cover", qNum:"", category:"", title:"", subtitle:"", isCover:true },

  {
    id:"nat-q3", qNum:"Q3", category:"Electorate",
    title:"Voter Motivation — 2026 Midterm Election",
    subtitle:"How would you describe your intention and motivation to vote? · N=893 · LV Weighted",
    nets:[
      { val:"93.0%", lbl:"Certain / Very Likely",      color:C.green },
      { val:"77.2%", lbl:"Certain + Highly Motivated", color:C.blue },
    ],
    bars:[
      { label:"Certain to vote & highly motivated",      pct:77, color:C.green, strong:true },
      { label:"Very likely to vote & feel motivated",    pct:16, color:C.blue },
      { label:"Somewhat likely, not strongly motivated", pct:3,  color:C.gold },
      { label:"Motivated but unsure if will vote",       pct:2,  color:C.orange },
      { label:"Not very likely, little motivation",      pct:1,  color:C.muted },
      { label:"Certain not to vote",                     pct:1,  color:C.muted },
    ],
  },

  {
    id:"nat-q4", qNum:"Q4", category:"Electorate",
    title:"How Do You Plan to Cast Your Ballot?",
    subtitle:"2026 Midterm Election · N=893 · LV Weighted",
    bars:[
      { label:"In person Election Day — know polling location",    pct:49, color:C.blue,    strong:true },
      { label:"Mail-in — already requested or received",           pct:20, color:C.blue },
      { label:"Early in-person — know when and where",             pct:12, color:C.green },
      { label:"In person Election Day — need to confirm location", pct:7,  color:C.cyan },
      { label:"Mail-in — plan to request",                         pct:5,  color:C.purpleLt },
      { label:"Haven't decided how I will vote yet",               pct:4,  color:C.gold },
      { label:"Early in-person — still need to look up details",   pct:2,  color:C.orange },
      { label:"Do not plan to vote",                               pct:2,  color:C.muted },
    ],
  },

  {
    id:"nat-q5", qNum:"Q5", category:"Electorate",
    title:"Social Circle Turnout Expectation",
    subtitle:"How many of the 5–10 people closest to you do you expect to vote? · N=893 · LV Weighted",
    bars:[
      { label:"All or nearly all of them", pct:46, color:C.green,  strong:true },
      { label:"Most of them",              pct:36, color:C.blue },
      { label:"About half",                pct:10, color:C.gold },
      { label:"A few of them",             pct:5,  color:C.orange },
      { label:"Not sure",                  pct:2,  color:C.muted },
      { label:"None of them",              pct:1,  color:C.muted },
    ],
  },

  {
    id:"nat-q6", qNum:"Q6", category:"Electorate",
    title:"Who Did You Vote for in 2024?",
    subtitle:"Presidential Recall Vote · N=893 · LV Weighted",
    nets:[
      { val:"44.3%", lbl:"Kamala Harris", color:C.blue },
      { val:"43.9%", lbl:"Donald Trump",  color:C.pink },
      { val:"R+0.4", lbl:"LV Spread",     color:C.pink },
    ],
    bars:[
      { label:"Kamala Harris", pct:44, color:C.blue,    strong:true },
      { label:"Donald Trump",  pct:44, color:C.pink,    strong:true },
      { label:"Third party",   pct:2,  color:C.purpleLt },
      { label:"Did not vote",  pct:10, color:C.muted },
    ],
  },

  {
    id:"nat-q8", qNum:"Q8", category:"Political Identity",
    title:"General Political Outlook",
    subtitle:"Which best describes your political outlook? · N=893 · LV Weighted",
    bars:[
      { label:"Progressive / Socialist Democrat",    pct:14, color:C.blue,     strong:true, group:"DEMOCRAT" },
      { label:"Mainline / Institutional Democrat",   pct:7,  color:C.blue },
      { label:"Working-Class / Union Democrat",      pct:6,  color:C.blue },
      { label:"Coalition / Civil Rights Democrat",   pct:3,  color:C.blue },
      { label:"America First Republican",            pct:12, color:C.pink,     strong:true, group:"REPUBLICAN" },
      { label:"Populist / Working-Class Republican", pct:6,  color:C.pink },
      { label:"Suburban / Professional Republican",  pct:6,  color:C.pink },
      { label:"Libertarian-Oriented Republican",     pct:4,  color:C.pink },
      { label:"Lean Republican Independent",         pct:11, color:C.purpleLt, strong:true, group:"INDEPENDENT" },
      { label:"Lean Democratic Independent",         pct:14, color:C.purpleLt },
      { label:"Moderate Independent / Centrist",     pct:11, color:C.purpleLt },
      { label:"Anti-Establishment Independent",      pct:2,  color:C.purpleLt },
      { label:"None / No clear preference",          pct:3,  color:C.muted },
    ],
  },

  {
    id:"nat-q9", qNum:"Q9", category:"Political Identity",
    title:"Which Party Do You Identify With?",
    subtitle:"N=893 · LV Weighted",
    nets:[
      { val:"40.1%", lbl:"Democrat",          color:C.blue },
      { val:"37.5%", lbl:"Republican",        color:C.pink },
      { val:"22.5%", lbl:"Independent/Other", color:C.purpleLt },
    ],
    bars:[
      { label:"Democrat",            pct:40, color:C.blue,     strong:true },
      { label:"Republican",          pct:38, color:C.pink,     strong:true },
      { label:"Independent / Other", pct:23, color:C.purpleLt },
    ],
  },

  {
    id:"nat-q10", qNum:"Q10", category:"Political Identity",
    title:"Groyper Identification",
    subtitle:"Do you identify as a Groyper (supporter of Nick Fuentes)? · N=893 · LV Weighted",
    nets:[
      { val:"7.8%",  lbl:"Yes — Groyper",     color:C.pink },
      { val:"92.2%", lbl:"No — Not a Groyper", color:C.green },
    ],
    bars:[
      { label:"Yes", pct:8,  color:C.pink },
      { label:"No",  pct:92, color:C.green, strong:true },
    ],
  },

  {
    id:"nat-q11", qNum:"Q11", category:"Track & Ballot",
    title:"Right Track / Wrong Track",
    subtitle:"Is the direction of the country on the right track or wrong track? · N=893 · LV Weighted",
    nets:[
      { val:"30.2%", lbl:"Right Track", color:C.green },
      { val:"62.1%", lbl:"Wrong Track", color:C.pink },
      { val:"−31.9", lbl:"Net Track",   color:C.pink },
    ],
    bars:[
      { label:"Right track", pct:30, color:C.green, strong:true },
      { label:"Wrong track", pct:62, color:C.pink,  strong:true },
      { label:"Not sure",    pct:8,  color:C.muted },
    ],
  },

  {
    id:"nat-q13", qNum:"Q13", category:"Track & Ballot",
    title:"2026 Generic Congressional Ballot",
    subtitle:"If the 2026 Midterms were held today, who would you vote for? · N=893 · LV Weighted",
    nets:[
      { val:"46.8%", lbl:"Democrat",   color:C.blue },
      { val:"40.0%", lbl:"Republican", color:C.pink },
      { val:"D+6.8", lbl:"Dem Lead",   color:C.blue },
    ],
    bars:[
      { label:"The Democrat candidate",          pct:47, color:C.blue,     strong:true },
      { label:"The Republican candidate",        pct:40, color:C.pink,     strong:true },
      { label:"Undecided / Not sure",            pct:10, color:C.muted },
      { label:"A third-party / independent",     pct:3,  color:C.purpleLt },
    ],
  },

  {
    id:"nat-q14", qNum:"Q14", category:"Trump",
    title:"Trump — Presidential Approval",
    subtitle:"Do you approve or disapprove of President Trump's performance? · N=893 · LV Weighted",
    nets:[
      { val:"41.6%", lbl:"NET Approve",    color:C.green },
      { val:"57.6%", lbl:"NET Disapprove", color:C.pink },
      { val:"−16.0", lbl:"Net Approval",   color:C.pink },
    ],
    bars:[
      { label:"Strongly approve",     pct:22, color:C.green, strong:true, group:"APPROVE" },
      { label:"Somewhat approve",     pct:20, color:C.green },
      { label:"Strongly disapprove",  pct:50, color:C.pink,  strong:true, group:"DISAPPROVE" },
      { label:"Somewhat disapprove",  pct:8,  color:C.pink },
      { label:"Neutral / no opinion", pct:1,  color:C.muted, group:"NEUTRAL" },
    ],
  },

  {
    id:"nat-q16", qNum:"Q16", category:"Trump",
    title:"Trump Approval by Issue",
    subtitle:"NET Approve vs NET Disapprove per issue · N=893 · LV Weighted · Sorted by disapproval",
    issueTable:[
      { issue:"Economy, Jobs & Cost of Living",         disApprove:61, approve:37 },
      { issue:"Healthcare, Social Security & Medicare", disApprove:57, approve:38 },
      { issue:"Education, Housing & Family Issues",     disApprove:55, approve:39 },
      { issue:"Foreign Policy & National Security",     disApprove:53, approve:43 },
      { issue:"Immigration & Border Security",          disApprove:52, approve:47 },
      { issue:"Crime, Public Safety & Policing",        disApprove:49, approve:47 },
    ],
  },

  {
    id:"nat-q18", qNum:"Q18", category:"Trump",
    title:"Trump's Actions in Office — Assessment",
    subtitle:"How would you describe President Trump's actions and policies in office so far? · N=893 · LV Weighted",
    nets:[
      { val:"54.0%", lbl:"Too Conservative", color:C.pink },
      { val:"31.0%", lbl:"About Right",       color:C.green },
      { val:"8.5%",  lbl:"Too Liberal",       color:C.gold },
    ],
    bars:[
      { label:"Far too conservative",     pct:42, color:C.pink,   strong:true, group:"TOO CONSERVATIVE" },
      { label:"Somewhat too conservative", pct:12, color:C.pink },
      { label:"About the right balance",  pct:31, color:C.green,  strong:true, group:"ABOUT RIGHT" },
      { label:"Somewhat too liberal",     pct:3,  color:C.gold,   group:"TOO LIBERAL" },
      { label:"Far too liberal",          pct:6,  color:C.orange },
      { label:"Not sure / no opinion",    pct:7,  color:C.muted,  group:"NOT SURE" },
    ],
  },

  {
    id:"nat-q12a", qNum:"Q12", category:"2028 Matchups",
    title:"2028 Presidential Matchups — JD Vance",
    subtitle:"JD Vance (R) vs Democratic candidates vs Thomas Massie (I) · N=893 · LV Weighted",
    bars:[
      { label:"Democrat (Gavin Newsom)",   pct:45, color:C.blue,     strong:true, group:"JD VANCE vs GAVIN NEWSOM" },
      { label:"Republican (JD Vance)",     pct:39, color:C.pink },
      { label:"Independent (T. Massie)",   pct:6,  color:C.purpleLt },
      { label:"Undecided",                 pct:10, color:C.muted },
      { label:"Democrat (Kamala Harris)",  pct:47, color:C.blue,     strong:true, group:"JD VANCE vs KAMALA HARRIS" },
      { label:"Republican (JD Vance)",     pct:39, color:C.pink },
      { label:"Independent (T. Massie)",   pct:7,  color:C.purpleLt },
      { label:"Undecided",                 pct:7,  color:C.muted },
      { label:"Democrat (Pete Buttigieg)", pct:46, color:C.blue,     strong:true, group:"JD VANCE vs PETE BUTTIGIEG" },
      { label:"Republican (JD Vance)",     pct:40, color:C.pink },
      { label:"Independent (T. Massie)",   pct:7,  color:C.purpleLt },
      { label:"Undecided",                 pct:8,  color:C.muted },
    ],
  },

  {
    id:"nat-q12b", qNum:"Q12", category:"2028 Matchups",
    title:"2028 Presidential Matchups — Marco Rubio",
    subtitle:"Marco Rubio (R) vs Democratic candidates vs Thomas Massie (I) · N=893 · LV Weighted",
    bars:[
      { label:"Democrat (Gavin Newsom)",   pct:46, color:C.blue,     strong:true, group:"MARCO RUBIO vs GAVIN NEWSOM" },
      { label:"Republican (M. Rubio)",     pct:39, color:C.pink },
      { label:"Independent (T. Massie)",   pct:5,  color:C.purpleLt },
      { label:"Undecided",                 pct:10, color:C.muted },
      { label:"Democrat (Kamala Harris)",  pct:47, color:C.blue,     strong:true, group:"MARCO RUBIO vs KAMALA HARRIS" },
      { label:"Republican (M. Rubio)",     pct:39, color:C.pink },
      { label:"Independent (T. Massie)",   pct:7,  color:C.purpleLt },
      { label:"Undecided",                 pct:8,  color:C.muted },
      { label:"Democrat (Pete Buttigieg)", pct:44, color:C.blue,     strong:true, group:"MARCO RUBIO vs PETE BUTTIGIEG" },
      { label:"Republican (M. Rubio)",     pct:39, color:C.pink },
      { label:"Independent (T. Massie)",   pct:7,  color:C.purpleLt },
      { label:"Undecided",                 pct:10, color:C.muted },
    ],
  },

  {
    id:"nat-q12c", qNum:"Q12", category:"2028 Matchups",
    title:"2028 Presidential Matchups — Ted Cruz",
    subtitle:"Ted Cruz (R) vs Democratic candidates vs Thomas Massie (I) · N=893 · LV Weighted",
    bars:[
      { label:"Democrat (Gavin Newsom)",   pct:44, color:C.blue,     strong:true, group:"TED CRUZ vs GAVIN NEWSOM" },
      { label:"Republican (Ted Cruz)",     pct:39, color:C.pink },
      { label:"Independent (T. Massie)",   pct:6,  color:C.purpleLt },
      { label:"Undecided",                 pct:10, color:C.muted },
      { label:"Democrat (Kamala Harris)",  pct:46, color:C.blue,     strong:true, group:"TED CRUZ vs KAMALA HARRIS" },
      { label:"Republican (Ted Cruz)",     pct:39, color:C.pink },
      { label:"Independent (T. Massie)",   pct:7,  color:C.purpleLt },
      { label:"Undecided",                 pct:8,  color:C.muted },
      { label:"Democrat (Pete Buttigieg)", pct:46, color:C.blue,     strong:true, group:"TED CRUZ vs PETE BUTTIGIEG" },
      { label:"Republican (Ted Cruz)",     pct:38, color:C.pink },
      { label:"Independent (T. Massie)",   pct:7,  color:C.purpleLt },
      { label:"Undecided",                 pct:10, color:C.muted },
    ],
  },

  {
    id:"nat-q12d", qNum:"Q12", category:"2028 Matchups",
    title:"2028 Presidential Matchups — Ron DeSantis",
    subtitle:"Ron DeSantis (R) vs Democratic candidates vs Thomas Massie (I) · N=893 · LV Weighted",
    bars:[
      { label:"Democrat (Gavin Newsom)",   pct:45, color:C.blue,     strong:true, group:"RON DESANTIS vs GAVIN NEWSOM" },
      { label:"Republican (R. DeSantis)",  pct:39, color:C.pink },
      { label:"Independent (T. Massie)",   pct:7,  color:C.purpleLt },
      { label:"Undecided",                 pct:10, color:C.muted },
      { label:"Democrat (Kamala Harris)",  pct:47, color:C.blue,     strong:true, group:"RON DESANTIS vs KAMALA HARRIS" },
      { label:"Republican (R. DeSantis)",  pct:39, color:C.pink },
      { label:"Independent (T. Massie)",   pct:6,  color:C.purpleLt },
      { label:"Undecided",                 pct:8,  color:C.muted },
      { label:"Democrat (Pete Buttigieg)", pct:45, color:C.blue,     strong:true, group:"RON DESANTIS vs PETE BUTTIGIEG" },
      { label:"Republican (R. DeSantis)",  pct:37, color:C.pink },
      { label:"Independent (T. Massie)",   pct:7,  color:C.purpleLt },
      { label:"Undecided",                 pct:10, color:C.muted },
    ],
  },

  {
    id:"nat-q19", qNum:"Q19", category:"Foreign Policy",
    title:"Trump Foreign Policy — Whose Interests?",
    subtitle:"Whose interests do Trump's foreign policy decisions primarily serve? · N=893 · LV Weighted",
    nets:[
      { val:"38.3%", lbl:"Foreign Over US",  color:C.pink },
      { val:"43.0%", lbl:"American-First",   color:C.green },
    ],
    bars:[
      { label:"The American people above all else",                                 pct:24, color:C.green,    strong:true, group:"AMERICAN-FIRST" },
      { label:"Mostly American people w/ significant consideration for allies",     pct:19, color:C.green },
      { label:"A balance between American and foreign ally interests",              pct:9,  color:C.gold,     group:"BALANCED" },
      { label:"Mostly the interests of foreign allies like Israel over Americans",  pct:14, color:C.pink,     group:"FOREIGN-FIRST" },
      { label:"Foreign allies like Israel above the American people",               pct:25, color:C.pink,     strong:true },
      { label:"Not sure / no opinion",                                              pct:10, color:C.muted,    group:"NOT SURE" },
    ],
  },

  {
    id:"nat-q24", qNum:"Q24", category:"Foreign Policy",
    title:"Israel PAC Donations Effect on Vote",
    subtitle:"If a candidate accepted donations from a PAC supporting Israel, more or less likely to vote for them? · N=893 · LV Weighted",
    nets:[
      { val:"31.8%", lbl:"NET Less Likely", color:C.pink },
      { val:"27.4%", lbl:"NET More Likely", color:C.green },
      { val:"40.9%", lbl:"No Difference",   color:C.muted },
    ],
    bars:[
      { label:"Much less likely",           pct:21, color:C.pink,   strong:true, group:"LESS LIKELY" },
      { label:"Somewhat less likely",       pct:11, color:C.pink },
      { label:"No difference / no opinion", pct:41, color:C.neutral, group:"NO DIFFERENCE" },
      { label:"Somewhat more likely",       pct:15, color:C.green,  group:"MORE LIKELY" },
      { label:"Much more likely",           pct:12, color:C.green,  strong:true },
    ],
  },

  {
    id:"nat-q20", qNum:"Q20", category:"Economy",
    title:"Household Economic Difficulty",
    subtitle:"Over the last month, how difficult has it been to pay usual household expenses? · N=893 · LV Weighted",
    nets:[
      { val:"58.0%", lbl:"Some Difficulty",   color:C.pink },
      { val:"40.7%", lbl:"Little Difficulty", color:C.green },
    ],
    bars:[
      { label:"Very difficult",        pct:19, color:C.pink,  strong:true },
      { label:"Somewhat difficult",    pct:39, color:C.pink },
      { label:"Not very difficult",    pct:22, color:C.green },
      { label:"Not at all difficult",  pct:19, color:C.green, strong:true },
      { label:"Not sure / no opinion", pct:1,  color:C.muted },
    ],
  },

  {
    id:"nat-q21", qNum:"Q21", category:"Immigration",
    title:"Mass Deportation of Illegal Immigrants",
    subtitle:"Do you support or oppose the mass deportation of all illegal immigrants? · N=893 · LV Weighted",
    nets:[
      { val:"46.7%", lbl:"NET Support", color:C.green },
      { val:"48.1%", lbl:"NET Oppose",  color:C.pink },
    ],
    bars:[
      { label:"Strongly support", pct:27, color:C.green, strong:true, group:"SUPPORT" },
      { label:"Somewhat support", pct:20, color:C.green },
      { label:"Strongly oppose",  pct:32, color:C.pink,  strong:true, group:"OPPOSE" },
      { label:"Somewhat oppose",  pct:16, color:C.pink },
      { label:"Not sure",         pct:5,  color:C.muted, group:"NOT SURE" },
    ],
  },

  {
    id:"nat-q22", qNum:"Q22", category:"Social",
    title:"Preferred Candidate Generation",
    subtitle:"When voting for a candidate, which generation do you most prefer? · N=893 · LV Weighted",
    bars:[
      { label:"Gen X (ages 45–60)",       pct:45, color:C.blue,     strong:true },
      { label:"Millennial (ages 29–44)",  pct:21, color:C.purpleLt },
      { label:"Baby Boomer (ages 61–79)", pct:13, color:C.gold },
      { label:"Not sure / no opinion",    pct:17, color:C.muted },
      { label:"Gen Z (ages 18–28)",       pct:4,  color:C.cyan },
    ],
  },

  {
    id:"nat-q23", qNum:"Q23", category:"Social",
    title:"Most Important Quality in a Long-Term Partner",
    subtitle:"Which is the single most important quality when considering a long-term partner? · N=893 · LV Weighted",
    bars:[
      { label:"Emotional availability",         pct:30, color:C.blue,     strong:true },
      { label:"Sense of humor",                 pct:19, color:C.purpleLt },
      { label:"Financial stability",            pct:15, color:C.gold },
      { label:"Religious affiliation",          pct:10, color:C.cyan },
      { label:"Ambition / work ethic",          pct:9,  color:C.orange },
      { label:"Physical attractiveness",        pct:6,  color:C.pink },
      { label:"Not sure / no opinion",          pct:8,  color:C.muted },
      { label:"A lot of sexual experience",     pct:3,  color:C.muted },
      { label:"Little to no sexual experience", pct:1,  color:C.muted },
    ],
  },

  {
    id:"nat-q17a", qNum:"Q17", category:"Favorability",
    title:"Individual Favorability — Political Figures",
    subtitle:"NET Approve vs NET Disapprove · N=893 · LV Weighted · Sorted by approval",
    issueTable:[
      { issue:"Kamala Harris",  approve:54, disApprove:44 },
      { issue:"Pete Buttigieg", approve:45, disApprove:34 },
      { issue:"Gavin Newsom",   approve:44, disApprove:40 },
      { issue:"JD Vance",       approve:41, disApprove:53 },
      { issue:"Marco Rubio",    approve:41, disApprove:46 },
      { issue:"Ron DeSantis",   approve:40, disApprove:45 },
      { issue:"Ted Cruz",       approve:39, disApprove:49 },
      { issue:"Ben Shapiro",    approve:35, disApprove:30 },
      { issue:"Tucker Carlson", approve:27, disApprove:50 },
      { issue:"Thomas Massie",  approve:27, disApprove:26 },
      { issue:"Megyn Kelly",    approve:27, disApprove:42 },
      { issue:"Candace Owens",  approve:24, disApprove:39 },
      { issue:"Mark Levin",     approve:24, disApprove:22 },
      { issue:"Laura Loomer",   approve:15, disApprove:33 },
      { issue:"Nick Fuentes",   approve:13, disApprove:38 },
    ],
  },

  {
    id:"nat-q17b", qNum:"Q17", category:"Favorability",
    title:"Individual Favorability — Media & Pop Culture",
    subtitle:"NET Approve vs NET Disapprove · N=893 · LV Weighted",
    issueTable:[
      { issue:"Michael Jackson", approve:45, disApprove:25 },
      { issue:"Kendrick Lamar",  approve:34, disApprove:22 },
      { issue:"Drake",           approve:27, disApprove:30 },
      { issue:"Thomas Massie",   approve:27, disApprove:26 },
      { issue:"Playboi Carti",   approve:14, disApprove:18 },
      { issue:"Clavicular",      approve:10, disApprove:19 },
    ],
  },

  {
    id:"nat-q25", qNum:"Q25", category:"Other",
    title:"Charlie Kirk Assassination — Responsibility",
    subtitle:"Who do you believe was ultimately responsible for the assassination of Charlie Kirk? · N=893 · LV Weighted",
    nets:[
      { val:"29.5%", lbl:"Tyler Robinson Alone", color:C.gold },
      { val:"27.6%", lbl:"Not Sure",             color:C.muted },
    ],
    bars:[
      { label:"Tyler Robinson, acting alone",                         pct:30, color:C.gold,     strong:true },
      { label:"Not sure / no opinion",                                pct:28, color:C.muted },
      { label:"Tyler Robinson, part of a larger organization",        pct:14, color:C.orange },
      { label:"A government or political actor",                      pct:9,  color:C.purpleLt },
      { label:"A left-wing or anti-conservative organization",        pct:8,  color:C.blue },
      { label:"Someone at Turning Point USA (TPUSA)",                 pct:8,  color:C.pink },
      { label:"A right-wing or anti-liberal organization",            pct:5,  color:C.pink },
    ],
  },
];


// ─── Topline executive dashboard ─────────────────────────────────────────────
function RaceSnapshotCard() {
  return (
    <div className="tl-ballot-card">
      <div className="tl-ballot-eyebrow">MAYORAL RACE — PRIMARY VOTE</div>
      <div className="tl-primary-rows">
        {[
          { name: "Karen Bass",           pct: 29.7, color: C.blue },
          { name: "Spencer Pratt",        pct: 15.2, color: C.pink },
          { name: "Nithya Raman",         pct: 7.2,  color: C.cyan },
          { name: "Adam Miller",          pct: 4.6,  color: C.orange },
          { name: "Rae Huang",            pct: 4.4,  color: C.green },
          { name: "Other candidate",      pct: 7.7,  color: C.purpleLt },
          { name: "Not sure / undecided", pct: 31.1, color: "var(--muted2)" },
        ].map((r, i) => (
          <div key={i} className="tl-primary-row">
            <div className="tl-primary-name">{r.name}</div>
            <div className="tl-primary-track">
              <div style={{ width: `${r.pct}%`, height: "100%", background: r.color,
                borderRadius: "var(--r-sm)", transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />
            </div>
            <div className="tl-primary-pct" style={{ color: r.color }}>{r.pct}%</div>
          </div>
        ))}
      </div>
      <div className="tl-ballot-und">N=465 · LV Weighted · Wave 1 · May 2026</div>
    </div>
  );
}

function LeanersCard() {
  return (
    <div className="tl-ballot-card">
      <div className="tl-ballot-eyebrow">MAYORAL RACE — WITH LEANERS</div>
      <div className="tl-primary-rows">
        {[
          { name: "Karen Bass",      pct: 39.9, color: C.blue },
          { name: "Spencer Pratt",   pct: 21.1, color: C.pink },
          { name: "Nithya Raman",    pct: 12.2, color: C.cyan },
          { name: "Rae Huang",       pct: 7.8,  color: C.green },
          { name: "Adam Miller",     pct: 6.9,  color: C.orange },
          { name: "Other candidate", pct: 12.1, color: C.purpleLt },
        ].map((r, i) => (
          <div key={i} className="tl-primary-row">
            <div className="tl-primary-name">{r.name}</div>
            <div className="tl-primary-track">
              <div style={{ width: `${r.pct}%`, height: "100%", background: r.color,
                borderRadius: "var(--r-sm)", transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />
            </div>
            <div className="tl-primary-pct" style={{ color: r.color }}>{r.pct}%</div>
          </div>
        ))}
      </div>
      <div className="tl-ballot-und">First choice + leaner allocation · N=465 LV</div>
    </div>
  );
}

function FavorabilityCard() {
  return (
    <div className="tl-ballot-card">
      <div className="tl-ballot-eyebrow">CANDIDATE FAVORABILITY — NET</div>
      <div className="tl-primary-rows">
        {[
          { name: "Karen Bass",   net: "+0.6", app: 45.7, color: C.gold },
          { name: "Spencer Pratt",net: "−2.3", app: 34.3, color: C.pink },
          { name: "Nithya Raman", net: "+6.7", app: 33.2, color: C.green },
          { name: "Rae Huang",    net: "+1.2", app: 22.6, color: C.muted },
          { name: "Adam Miller",  net: "−1.8", app: 20.9, color: C.muted },
        ].map((r, i) => (
          <div key={i} className="tl-primary-row">
            <div className="tl-primary-name">{r.name}</div>
            <div className="tl-primary-track">
              <div style={{ width: `${r.app}%`, height: "100%", background: r.color,
                borderRadius: "var(--r-sm)", opacity: 0.55 }} />
            </div>
            <div className="tl-primary-pct" style={{ color: r.color }}>{r.net}</div>
          </div>
        ))}
      </div>
      <div className="tl-ballot-und">NET = Approve − Disapprove · N=465 LV</div>
    </div>
  );
}

function KpiTile({ label, val, sub, color, border }: {
  label: string; val: string; sub: string; color: string; border?: string;
}) {
  return (
    <div className="tl-kpi-tile" style={border ? { borderLeft: `3px solid ${border}` } : {}}>
      <div className="tl-kpi-val" style={{ color }}>{val}</div>
      <div className="tl-kpi-lbl">{label}</div>
      <div className="tl-kpi-sub">{sub}</div>
    </div>
  );
}

function NationalToplineDashboard() {
  return (
    <div className="tl-section">
      <div className="tl-section-hdr">
        <span className="tl-section-hdr-lbl">TOPLINE RESULTS</span>
        <span className="tl-section-hdr-sub">National Benchmark Survey · May 2026 · N=893 · LV-Weighted</span>
      </div>
      <div className="tl-ballot-grid">
        {/* Trump Approval */}
        <div className="tl-ballot-card">
          <div className="tl-ballot-eyebrow">TRUMP PRESIDENTIAL APPROVAL</div>
          <div className="tl-primary-rows">
            {[
              { name:"Strongly Approve",    pct:21.8, color:C.green },
              { name:"Somewhat Approve",    pct:19.8, color:C.green },
              { name:"Strongly Disapprove", pct:49.6, color:C.pink },
              { name:"Somewhat Disapprove", pct:8.0,  color:C.pink },
              { name:"Neutral / No Opinion",pct:0.9,  color:"var(--muted2)" },
            ].map((r, i) => (
              <div key={i} className="tl-primary-row">
                <div className="tl-primary-name">{r.name}</div>
                <div className="tl-primary-track">
                  <div style={{ width:`${r.pct}%`, height:"100%", background:r.color,
                    borderRadius:"var(--r-sm)", transition:"width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />
                </div>
                <div className="tl-primary-pct" style={{ color:r.color }}>{r.pct}%</div>
              </div>
            ))}
          </div>
          <div className="tl-ballot-und">41.6% Approve · 57.6% Disapprove · N=893 LV</div>
        </div>

        {/* Generic Ballot */}
        <div className="tl-ballot-card">
          <div className="tl-ballot-eyebrow">2026 GENERIC CONGRESSIONAL BALLOT</div>
          <div className="tl-ballot-matchup">
            <div className="tl-ballot-side">
              <div className="tl-ballot-pct" style={{ color:C.blue }}>46.8%</div>
              <div className="tl-ballot-name">Democrat</div>
              <div className="tl-ballot-party dem">DEM</div>
            </div>
            <div className="tl-ballot-center">
              <div className="tl-ballot-net" style={{ color:C.blue }}>D+6.8</div>
              <div className="tl-ballot-adv-lbl">ADVANTAGE</div>
            </div>
            <div className="tl-ballot-side right">
              <div className="tl-ballot-pct" style={{ color:C.pink }}>40.0%</div>
              <div className="tl-ballot-name">Republican</div>
              <div className="tl-ballot-party rep">REP</div>
            </div>
          </div>
          <div className="tl-split-bar">
            <div style={{ flex:"46.8", background:C.blue }} />
            <div style={{ flex:"10.3", background:"var(--panel2)" }} />
            <div style={{ flex:"40", background:C.pink }} />
          </div>
          <div className="tl-ballot-und">2026 Midterm · N=893 · 10.3% Undecided</div>
        </div>

        {/* Mass Deportation */}
        <div className="tl-ballot-card">
          <div className="tl-ballot-eyebrow">MASS DEPORTATION — SUPPORT VS. OPPOSE</div>
          <div className="tl-primary-rows">
            {[
              { name:"Strongly Support", pct:26.6, color:C.green },
              { name:"Somewhat Support", pct:20.1, color:C.green },
              { name:"Strongly Oppose",  pct:31.7, color:C.pink },
              { name:"Somewhat Oppose",  pct:16.4, color:C.pink },
              { name:"Not Sure",         pct:5.2,  color:"var(--muted2)" },
            ].map((r, i) => (
              <div key={i} className="tl-primary-row">
                <div className="tl-primary-name">{r.name}</div>
                <div className="tl-primary-track">
                  <div style={{ width:`${r.pct}%`, height:"100%", background:r.color,
                    borderRadius:"var(--r-sm)", transition:"width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />
                </div>
                <div className="tl-primary-pct" style={{ color:r.color }}>{r.pct}%</div>
              </div>
            ))}
          </div>
          <div className="tl-ballot-und">46.7% Support · 48.1% Oppose · N=893 LV</div>
        </div>
      </div>
      <div className="tl-kpi-row">
        <KpiTile label="Trump Net Approval"  val="−16"   sub="41.6% Approve · 57.6% Disapprove"       color={C.pink}   border={C.pink} />
        <KpiTile label="Right / Wrong Track" val="−31.9" sub="30.2% Right Track · 62.1% Wrong Track"  color={C.pink}   border={C.pink} />
        <KpiTile label="Generic Ballot"      val="D+6.8" sub="Democrat 46.8% · Republican 40.0%"      color={C.blue}   border={C.blue} />
        <KpiTile label="Household Difficulty"val="58%"   sub="Very or Somewhat Difficult to Pay Bills" color={C.orange} border={C.orange} />
        <KpiTile label="2028: Dem Leads"     val="All 12" sub="Dem candidate leads all 12 matchups"   color={C.blue}   border={C.blue} />
      </div>
    </div>
  );
}

function ToplineDashboard() {
  return (
    <div className="tl-section">
      <div className="tl-section-hdr">
        <span className="tl-section-hdr-lbl">TOPLINE RESULTS</span>
        <span className="tl-section-hdr-sub">Los Angeles Mayoral Election · Wave 1 · May 2026 · N=465 · LV-Weighted</span>
      </div>
      <div className="tl-ballot-grid">
        <RaceSnapshotCard />
        <LeanersCard />
        <FavorabilityCard />
      </div>
      <div className="tl-kpi-row">
        <KpiTile label="Turnout Intensity"    val="82%"  sub="Certain / Very Likely to Vote"         color={C.green}  border={C.green} />
        <KpiTile label="Trump Net Approval"   val="−55"  sub="21.4% Approve · 75.9% Disapprove"     color={C.pink}   border={C.pink} />
        <KpiTile label="Top Issue: Economy"   val="43%"  sub="Ranked #1 Most Important Issue"         color={C.gold}   border={C.gold} />
        <KpiTile label="Household Difficulty" val="57%"  sub="Somewhat or Very Difficult to Pay Bills" color={C.orange} border={C.orange} />
        <KpiTile label="Israel PAC Net"       val="−23"  sub="44.8% Less Likely · 21.6% More Likely" color={C.pink}   border={C.pink} />
      </div>
    </div>
  );
}

// ─── Dashboard components ─────────────────────────────────────────────────────
function getCategories(slides: Slide[]) {
  const cats = new Map<string, Slide[]>();
  slides.forEach(s => {
    if (s.isCover) return;
    if (!cats.has(s.category)) cats.set(s.category, []);
    cats.get(s.category)!.push(s);
  });
  return Array.from(cats.entries()).map(([cat, items]) => ({ cat, items }));
}

function NetBadges({ nets }: { nets: NetStat[] }) {
  return (
    <div className="tpsi-nets">
      {nets.map((n, i) => (
        <div key={i} className="tpsi-net">
          <div className="tpsi-net-val" style={{ color: n.color }}>{n.val}</div>
          <div className="tpsi-net-lbl">{n.lbl}</div>
        </div>
      ))}
    </div>
  );
}

function BarChartView({ bars }: { bars: BarRow[] }) {
  const groups: { name: string; rows: BarRow[] }[] = [];
  let cur: { name: string; rows: BarRow[] } | null = null;
  bars.forEach(r => {
    if (r.group && (!cur || cur.name !== r.group)) {
      cur = { name: r.group, rows: [] };
      groups.push(cur);
    } else if (!cur) {
      cur = { name: "", rows: [] };
      groups.push(cur);
    }
    cur!.rows.push(r);
  });
  return (
    <div className="tpsi-chart">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.name && <div className="tpsi-group-lbl">{g.name}</div>}
          {g.rows.map((row, ri) => (
            <div key={ri} className="tpsi-bar-row">
              <div className="tpsi-bar-lbl">{row.label}</div>
              <div className="tpsi-bar-track">
                <div
                  className="tpsi-bar-fill"
                  style={{ width: `${row.pct}%`, background: row.color, opacity: row.strong ? 1 : 0.55 }}
                />
              </div>
              <div className="tpsi-bar-num" style={{ color: row.strong ? row.color : "var(--muted2)" }}>
                {row.pct}%
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function IssueTableView({ rows }: { rows: IssueRow[] }) {
  const maxDis = Math.max(...rows.map(r => r.disApprove));
  return (
    <div className="tpsi-table">
      <div className="tpsi-table-hdr" style={{ gridTemplateColumns: "1fr 190px 190px" }}>
        <span>Issue</span>
        <span style={{ textAlign: "right", color: C.pink }}>NET Disapprove</span>
        <span style={{ textAlign: "right", color: C.green }}>NET Approve</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="tpsi-table-row" style={{ gridTemplateColumns: "1fr 190px 190px" }}>
          <div className="tpsi-table-lbl">{r.issue}</div>
          <div className="tpsi-table-bar-cell">
            <div className="tpsi-mini-track">
              <div style={{ height: "100%", width: `${(r.disApprove / maxDis) * 100}%`, background: C.pink }} />
            </div>
            <span className="tpsi-table-num" style={{ color: C.pink }}>{r.disApprove}%</span>
          </div>
          <div className="tpsi-table-bar-cell">
            <div className="tpsi-mini-track">
              <div style={{ height: "100%", width: `${r.approve}%`, background: C.green }} />
            </div>
            <span className="tpsi-table-num" style={{ color: C.green }}>{r.approve}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RankTableView({ rows }: { rows: NonNullable<Slide["rankTable"]> }) {
  return (
    <div className="tpsi-table">
      <div className="tpsi-table-hdr" style={{ gridTemplateColumns: "1fr 200px 130px" }}>
        <span>Issue</span>
        <span style={{ textAlign: "right" }}>% Ranked #1</span>
        <span style={{ textAlign: "center" }}>Priority</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="tpsi-table-row" style={{ gridTemplateColumns: "1fr 200px 130px" }}>
          <div className="tpsi-table-lbl">{r.label}</div>
          <div className="tpsi-table-bar-cell">
            <div className="tpsi-mini-track">
              <div style={{ height: "100%", width: `${Math.min(r.pct1 * 2, 100)}%`, background: r.color }} />
            </div>
            <span className="tpsi-table-num" style={{ color: r.color }}>{r.pct1}%</span>
          </div>
          <div style={{ textAlign: "center" }}>
            <span className={`tpsi-rank-bdg${i === 0 ? " top" : ""}`}>{r.rank}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function TPSIPollDashboard() {
  const [activePoll, setActivePoll] = useState<'la'|'national'>('la');
  const [laActiveId, setLaActiveId] = useState("q10a");
  const [natActiveId, setNatActiveId] = useState("nat-q14");

  const slides    = activePoll === 'la' ? SLIDES : NATIONAL_SLIDES;
  const activeId  = activePoll === 'la' ? laActiveId : natActiveId;
  const setActive = activePoll === 'la' ? setLaActiveId : setNatActiveId;

  const categories = getCategories(slides);
  const slide = slides.find(s => s.id === activeId) ?? slides.find(s => !s.isCover)!;

  return (
    <>
      <style>{`
        @keyframes tpsi-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .tpsi-page { max-width: 1280px; margin: 0 auto; padding: 0 10px 64px; }

        /* Header */
        .tpsi-eyebrow {
          font-family: var(--font-body); font-size: 10px; font-weight: 700;
          letter-spacing: 0.22em; text-transform: uppercase; color: var(--purple-soft);
          margin-bottom: 8px;
        }
        .tpsi-page-title {
          font-family: var(--font-display); font-size: clamp(24px, 3vw, 44px);
          font-weight: 900; text-transform: uppercase; letter-spacing: -0.01em;
          color: var(--foreground); margin: 0; line-height: 0.95;
        }
        .tpsi-page-title em {
          font-style: normal;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .tpsi-bdg {
          display: inline-flex; align-items: center; padding: 2px 9px;
          border: 1px solid var(--border2); background: var(--panel2);
          font-family: var(--font-body); font-size: 10px; font-weight: 700;
          letter-spacing: 0.10em; text-transform: uppercase; color: var(--muted);
          border-radius: var(--r-pill);
        }
        .tpsi-bdg-purple {
          border-color: rgba(124,58,237,0.4); background: rgba(124,58,237,0.08); color: var(--purple2);
        }

        /* Layout */
        .tpsi-layout {
          display: grid; grid-template-columns: 258px 1fr; gap: 10px;
          margin-top: 12px; align-items: start;
        }
        @media (max-width: 860px) { .tpsi-layout { grid-template-columns: 1fr; } }

        /* Sidebar nav */
        .tpsi-nav {
          background: var(--panel); border: 1px solid var(--border); border-radius: var(--r-lg);
          overflow: hidden; position: sticky; top: 80px;
          max-height: calc(100vh - 100px); overflow-y: auto; scrollbar-gutter: stable;
        }
        .tpsi-nav-cat-lbl {
          font-family: var(--font-body); font-size: 8.5px; font-weight: 700;
          letter-spacing: 0.20em; text-transform: uppercase; color: var(--muted2);
          padding: 8px 12px 5px; background: var(--panel2);
          border-bottom: 1px solid var(--border); border-top: 1px solid var(--border);
        }
        .tpsi-nav-item {
          display: flex; align-items: flex-start; gap: 8px; width: 100%;
          padding: 7px 12px; background: transparent; border: none;
          border-bottom: 1px solid var(--border); color: var(--muted);
          cursor: pointer; text-align: left; transition: background 100ms, color 100ms;
          border-left: 2px solid transparent;
        }
        .tpsi-nav-item:hover { background: rgba(124,58,237,0.04); color: var(--foreground2); }
        .tpsi-nav-item.active {
          background: rgba(124,58,237,0.08); border-left-color: var(--purple); color: var(--foreground);
        }
        .tpsi-nav-qnum {
          font-family: var(--font-numeric); font-size: 10px; font-weight: 800;
          color: var(--muted2); flex-shrink: 0; min-width: 28px;
        }
        .tpsi-nav-item.active .tpsi-nav-qnum { color: var(--purple2); }
        .tpsi-nav-title { font-family: var(--font-body); font-size: 10.5px; line-height: 1.4; }

        /* Main panel */
        .tpsi-panel {
          background: var(--panel); border: 1px solid var(--border); border-radius: var(--r-lg);
          box-shadow: var(--shadow-sm); position: relative; overflow: hidden;
          animation: tpsi-in 0.35s cubic-bezier(0.16,1,0.3,1) both;
        }
        .tpsi-panel::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 22px;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
          border-radius: var(--r-lg) var(--r-lg) 0 0;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          padding: 2.5px 2.5px 0 2.5px; pointer-events: none; z-index: 2;
        }
        .tpsi-panel-hdr {
          padding: 16px 20px 14px; border-bottom: 1px solid var(--border); background: var(--panel2);
        }
        .tpsi-panel-eyebrow {
          font-family: var(--font-body); font-size: 9.5px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase; color: var(--purple-soft); margin-bottom: 5px;
        }
        .tpsi-panel-title {
          font-family: var(--font-display); font-size: clamp(18px, 2.2vw, 28px); font-weight: 900;
          text-transform: uppercase; letter-spacing: 0.02em; color: var(--foreground);
          line-height: 1.1; margin-bottom: 5px;
        }
        .tpsi-panel-sub {
          font-family: var(--font-body); font-size: 10.5px; color: var(--muted2); letter-spacing: 0.03em;
        }
        .tpsi-panel-body { padding: 20px 22px; }

        /* Net stat badges */
        .tpsi-nets {
          display: flex; gap: 0; margin-bottom: 22px; border: 1px solid var(--border);
          border-radius: var(--r-sm); overflow: hidden; width: fit-content; background: var(--panel2);
        }
        .tpsi-net { padding: 10px 18px; border-right: 1px solid var(--border); }
        .tpsi-net:last-child { border-right: none; }
        .tpsi-net-val {
          font-family: var(--font-numeric); font-size: 28px; font-weight: 900; line-height: 1;
          letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
        }
        .tpsi-net-lbl {
          font-family: var(--font-body); font-size: 8.5px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted2); margin-top: 3px;
        }

        /* Bar chart */
        .tpsi-chart { display: flex; flex-direction: column; }
        .tpsi-group-lbl {
          font-family: var(--font-body); font-size: 8.5px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted2);
          padding: 10px 0 4px; border-top: 1px solid var(--border); margin-top: 6px;
        }
        .tpsi-bar-row {
          display: grid; grid-template-columns: 200px 1fr 52px;
          align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--border);
        }
        .tpsi-bar-row:last-child { border-bottom: none; }
        @media (max-width: 700px) { .tpsi-bar-row { grid-template-columns: 1fr 52px; } .tpsi-bar-lbl { text-align: left; } }
        .tpsi-bar-lbl { font-family: var(--font-body); font-size: 11.5px; color: var(--foreground2); text-align: right; line-height: 1.35; }
        .tpsi-bar-track {
          height: 28px; background: var(--panel2); border-radius: var(--r-sm); overflow: hidden;
          border: 1px solid var(--border);
        }
        .tpsi-bar-fill {
          height: 100%; border-radius: var(--r-sm);
          transition: width 0.55s cubic-bezier(0.16,1,0.3,1);
        }
        .tpsi-bar-num {
          font-family: var(--font-numeric); font-size: 13px; font-weight: 800;
          text-align: right; font-variant-numeric: tabular-nums;
        }

        /* Shared table styles */
        .tpsi-table { width: 100%; }
        .tpsi-table-hdr {
          display: grid; gap: 12px; padding: 5px 0;
          border-bottom: 1px solid var(--border2);
          font-family: var(--font-body); font-size: 8.5px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted2); margin-bottom: 2px;
        }
        .tpsi-table-row {
          display: grid; gap: 12px; padding: 9px 0;
          border-bottom: 1px solid var(--border); align-items: center;
        }
        .tpsi-table-row:last-child { border-bottom: none; }
        .tpsi-table-lbl { font-family: var(--font-body); font-size: 11.5px; color: var(--foreground2); line-height: 1.4; }
        .tpsi-table-bar-cell { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
        .tpsi-mini-track {
          width: 80px; height: 5px; background: var(--panel2); border-radius: 99px;
          overflow: hidden; border: 1px solid var(--border); flex-shrink: 0;
        }
        .tpsi-table-num {
          font-family: var(--font-numeric); font-size: 13px; font-weight: 800;
          font-variant-numeric: tabular-nums; min-width: 38px; text-align: right;
        }
        .tpsi-rank-bdg {
          display: inline-block; font-family: var(--font-body); font-size: 8px; font-weight: 700;
          letter-spacing: 0.10em; text-transform: uppercase; padding: 2px 8px;
          border-radius: var(--r-pill); background: rgba(37,99,235,0.06);
          border: 1px solid rgba(37,99,235,0.15); color: var(--muted2);
        }
        .tpsi-rank-bdg.top {
          background: rgba(247,217,79,0.10); border-color: rgba(247,217,79,0.30); color: #f7d94f;
        }

        /* ── Topline executive panel ────── */
        .tl-section {
          background: var(--panel); border: 1px solid var(--border); border-radius: var(--r-lg);
          box-shadow: var(--shadow-md); overflow: hidden; margin-bottom: 10px; position: relative;
        }
        .tl-section::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
          border-radius: var(--r-lg) var(--r-lg) 0 0;
          box-shadow: 0 4px 18px -2px rgba(124,58,237,0.28);
          pointer-events: none; z-index: 2;
        }
        .tl-section-hdr {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 18px; border-bottom: 1px solid var(--border); background: var(--panel2);
        }
        .tl-section-hdr-lbl {
          font-family: var(--font-body); font-size: 9px; font-weight: 700;
          letter-spacing: 0.22em; text-transform: uppercase; color: var(--purple-soft); flex-shrink: 0;
        }
        .tl-section-hdr-sub {
          font-family: var(--font-body); font-size: 9.5px; color: var(--muted2); letter-spacing: 0.03em;
        }
        /* Ballot grid */
        .tl-ballot-grid {
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          border-bottom: 1px solid var(--border);
        }
        @media (max-width: 860px) { .tl-ballot-grid { grid-template-columns: 1fr; } }
        .tl-ballot-card {
          padding: 20px 22px; border-right: 1px solid var(--border);
        }
        .tl-ballot-card:last-child { border-right: none; }
        .tl-ballot-eyebrow {
          font-family: var(--font-body); font-size: 8.5px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted2); margin-bottom: 14px;
        }
        .tl-ballot-matchup {
          display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin-bottom: 12px;
        }
        .tl-ballot-side { display: flex; flex-direction: column; gap: 2px; }
        .tl-ballot-side.right { text-align: right; align-items: flex-end; }
        .tl-ballot-pct {
          font-family: var(--font-numeric); font-size: 36px; font-weight: 900; line-height: 1;
          letter-spacing: -0.03em; font-variant-numeric: tabular-nums;
        }
        .tl-ballot-name {
          font-family: var(--font-body); font-size: 10.5px; color: var(--foreground2); line-height: 1.3;
        }
        .tl-ballot-party {
          display: inline-block; font-family: var(--font-body); font-size: 7.5px; font-weight: 800;
          letter-spacing: 0.14em; text-transform: uppercase; padding: 1px 6px;
          border-radius: var(--r-pill); margin-top: 2px;
        }
        .tl-ballot-party.dem { background: rgba(37,99,235,0.12); color: #2563eb; border: 1px solid rgba(37,99,235,0.25); }
        .tl-ballot-party.rep { background: rgba(230,57,70,0.10); color: #e63946; border: 1px solid rgba(230,57,70,0.22); }
        .tl-ballot-center { text-align: center; padding: 0 4px; }
        .tl-ballot-net {
          font-family: var(--font-numeric); font-size: 20px; font-weight: 900;
          letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1;
        }
        .tl-ballot-adv-lbl {
          font-family: var(--font-body); font-size: 7px; font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted2); margin-top: 2px;
        }
        .tl-split-bar {
          display: flex; height: 8px; border-radius: var(--r-pill); overflow: hidden;
          gap: 2px; background: var(--panel2); margin-bottom: 7px;
        }
        .tl-split-bar > div { border-radius: var(--r-pill); }
        .tl-ballot-und {
          font-family: var(--font-body); font-size: 9px; color: var(--muted2); letter-spacing: 0.04em;
        }
        /* Primary card */
        .tl-primary-rows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .tl-primary-row { display: grid; grid-template-columns: 150px 1fr 40px; align-items: center; gap: 8px; }
        .tl-primary-name { font-family: var(--font-body); font-size: 10.5px; color: var(--foreground2); }
        .tl-primary-track {
          height: 22px; background: var(--panel2); border-radius: var(--r-sm); overflow: hidden;
          border: 1px solid var(--border);
        }
        .tl-primary-pct {
          font-family: var(--font-numeric); font-size: 13px; font-weight: 800;
          text-align: right; font-variant-numeric: tabular-nums;
        }
        /* KPI strip */
        .tl-kpi-row {
          display: grid; grid-template-columns: repeat(5, 1fr);
        }
        @media (max-width: 860px) { .tl-kpi-row { grid-template-columns: repeat(2, 1fr); } }
        .tl-kpi-tile {
          padding: 14px 18px; border-right: 1px solid var(--border); text-align: center;
          background: var(--panel2);
        }
        .tl-kpi-tile:last-child { border-right: none; }
        .tl-kpi-val {
          font-family: var(--font-numeric); font-size: 30px; font-weight: 900; line-height: 1;
          letter-spacing: -0.03em; font-variant-numeric: tabular-nums; margin-bottom: 4px;
        }
        .tl-kpi-lbl {
          font-family: var(--font-body); font-size: 9px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: var(--foreground2); margin-bottom: 2px;
        }
        .tl-kpi-sub {
          font-family: var(--font-body); font-size: 9px; color: var(--muted2);
        }

        /* Poll switcher tabs */
        .poll-tabs {
          display: flex; gap: 0; margin-bottom: 12px;
          border: 1px solid var(--border); border-radius: var(--r-sm);
          overflow: hidden; width: fit-content; background: var(--panel);
        }
        .poll-tab {
          display: flex; align-items: center; gap: 7px; padding: 8px 18px;
          background: transparent; border: none; border-right: 1px solid var(--border);
          cursor: pointer; color: var(--muted);
          font-family: var(--font-body); font-size: 11px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          transition: background 100ms, color 100ms;
        }
        .poll-tab:last-child { border-right: none; }
        .poll-tab:hover { background: rgba(124,58,237,0.04); color: var(--foreground2); }
        .poll-tab.active { background: rgba(124,58,237,0.10); color: var(--purple2); }
        .poll-tab-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
        }
      `}</style>

      <div className="tpsi-page">
        {/* Page header */}
        {activePoll === 'la' ? (
          <div style={{ padding:"20px 0 14px" }}>
            <div className="tpsi-eyebrow">TPSI POLL · LOS ANGELES MAYOR · WAVE 1 · MAY 2026</div>
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-end", justifyContent:"space-between", gap:12 }}>
              <h1 className="tpsi-page-title">Los Angeles <em>Mayoral Election</em></h1>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                <span className="tpsi-bdg tpsi-bdg-purple">N=465 LV</span>
                <span className="tpsi-bdg">WAVE 1</span>
                <span className="tpsi-bdg">17 QUESTIONS</span>
                <span className="tpsi-bdg">MAY 2026</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding:"20px 0 14px" }}>
            <div className="tpsi-eyebrow">TPSI POLL · NATIONAL BENCHMARK · MAY 2026</div>
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-end", justifyContent:"space-between", gap:12 }}>
              <h1 className="tpsi-page-title">National <em>Benchmark Survey</em></h1>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                <span className="tpsi-bdg tpsi-bdg-purple">N=893 LV</span>
                <span className="tpsi-bdg">25 QUESTIONS</span>
                <span className="tpsi-bdg">MAY 2026</span>
              </div>
            </div>
          </div>
        )}

        {/* Poll switcher */}
        <div className="poll-tabs">
          <button
            className={`poll-tab${activePoll === 'la' ? ' active' : ''}`}
            onClick={() => setActivePoll('la')}
          >
            <span className="poll-tab-dot" style={{ background: activePoll === 'la' ? 'var(--purple)' : 'var(--border2)' }} />
            LA Mayoral · May 2026
          </button>
          <button
            className={`poll-tab${activePoll === 'national' ? ' active' : ''}`}
            onClick={() => setActivePoll('national')}
          >
            <span className="poll-tab-dot" style={{ background: activePoll === 'national' ? 'var(--purple)' : 'var(--border2)' }} />
            National Benchmark · May 2026
          </button>
        </div>

        {/* Topline executive summary */}
        {activePoll === 'la' ? <ToplineDashboard /> : <NationalToplineDashboard />}

        {/* Two-column body */}
        <div className="tpsi-layout">
          {/* Sidebar nav */}
          <nav className="tpsi-nav">
            {categories.map(({ cat, items }) => (
              <div key={cat}>
                <div className="tpsi-nav-cat-lbl">{cat}</div>
                {items.map(s => (
                  <button
                    key={s.id}
                    className={`tpsi-nav-item${activeId === s.id ? " active" : ""}`}
                    onClick={() => setActive(s.id)}
                  >
                    <span className="tpsi-nav-qnum">{s.qNum}</span>
                    <span className="tpsi-nav-title">{s.title}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Main results panel */}
          <div key={activeId} className="tpsi-panel">
            <div className="tpsi-panel-hdr">
              <div className="tpsi-panel-eyebrow">{slide.qNum} · {slide.category}</div>
              <div className="tpsi-panel-title">{slide.title}</div>
              <div className="tpsi-panel-sub">{slide.subtitle}</div>
            </div>
            <div className="tpsi-panel-body">
              {slide.nets       && <NetBadges nets={slide.nets} />}
              {slide.bars       && <BarChartView bars={slide.bars} />}
              {slide.issueTable && <IssueTableView rows={slide.issueTable} />}
              {slide.rankTable  && <RankTableView rows={slide.rankTable} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
