"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DarkNav from "@/app/components/DarkNav";

// ─── Palette tuned for the #050505 canvas ─────────────────────────────────────
const C = {
  blue:     "#5b8cff",   // Democrat
  pink:     "#ff5d6c",   // Republican
  purple:   "#b98cff",   // Independent / third
  purpleLt: "#b98cff",
  cyan:     "#5b8cff",
  green:    "#5fe3a3",   // approve / positive
  orange:   "rgba(244,244,239,0.40)",
  gold:     "#6d3ee9",   // signal / #1 highlight
  muted:    "rgba(244,244,239,0.34)",
  neutral:  "rgba(244,244,239,0.34)",
};
const LIME = "#6d3ee9";

// ─── Types ────────────────────────────────────────────────────────────────────
interface NetStat   { val: string; lbl: string; color: string }
interface BarRow    { label: string; pct: number; color: string; strong?: boolean; group?: string }
interface IssueRow  { issue: string; disApprove: number; approve: number }
interface RankRow   { label: string; pct1: number; color: string; rank: string }
interface Slide {
  id: string; qNum: string; category: string; title: string; subtitle: string;
  chart?: "race" | "diverging" | "grouped";
  nets?: NetStat[]; bars?: BarRow[]; issueTable?: IssueRow[]; rankTable?: RankRow[]; isCover?: boolean;
}

// ─── Slide data (LV Weighted) ─────────────────────────────────────────────────
const LA_SLIDES: Slide[] = [
  { id:"cover", qNum:"", category:"", title:"", subtitle:"", isCover:true },
  {
    id:"q10a", qNum:"Q10", category:"Mayoral Race", chart:"race",
    title:"Los Angeles Mayor — Primary Vote",
    subtitle:"Who will you vote for in the LA Mayoral Election on June 2nd? · N=465 · LV Weighted",
    nets:[
      { val:"29.7%", lbl:"Karen Bass", color:C.blue },
      { val:"15.2%", lbl:"Spencer Pratt", color:C.pink },
      { val:"31.1%", lbl:"Undecided", color:C.muted },
    ],
    bars:[
      { label:"Karen Bass", pct:30, color:C.blue, strong:true },
      { label:"Spencer Pratt", pct:15, color:C.pink, strong:true },
      { label:"Other candidate", pct:8, color:C.purpleLt },
      { label:"Nithya Raman", pct:7, color:C.cyan },
      { label:"Adam Miller", pct:5, color:C.orange },
      { label:"Rae Huang", pct:4, color:C.green },
      { label:"Not sure / undecided", pct:31, color:C.muted },
    ],
  },
  {
    id:"q10b", qNum:"Q10+Q11", category:"Mayoral Race", chart:"race",
    title:"Mayoral Race — With Leaners Allocated",
    subtitle:"First choice + leaner allocation · N=465 · LV Weighted",
    nets:[
      { val:"39.9%", lbl:"Karen Bass", color:C.blue },
      { val:"21.1%", lbl:"Spencer Pratt", color:C.pink },
      { val:"B+18.8", lbl:"Bass Margin", color:C.blue },
    ],
    bars:[
      { label:"Karen Bass", pct:40, color:C.blue, strong:true },
      { label:"Spencer Pratt", pct:21, color:C.pink, strong:true },
      { label:"Nithya Raman", pct:12, color:C.cyan },
      { label:"Rae Huang", pct:8, color:C.green },
      { label:"Adam Miller", pct:7, color:C.orange },
      { label:"Other candidate", pct:12, color:C.purpleLt },
    ],
  },
  {
    id:"q3", qNum:"Q3", category:"Voter Behavior",
    title:"Voter Motivation — 2026 Midterm Election",
    subtitle:"How would you describe your intention and motivation to vote? · N=465 · LV Weighted",
    nets:[
      { val:"82%", lbl:"Certain / Very Likely", color:C.green },
      { val:"66.4%", lbl:"Certain + Highly Motivated", color:C.blue },
    ],
    bars:[
      { label:"Certain to vote & highly motivated", pct:66, color:C.green, strong:true },
      { label:"Very likely to vote & feel motivated", pct:16, color:C.blue },
      { label:"Somewhat likely, not strongly motivated", pct:9, color:C.gold },
      { label:"Motivated but unsure if will vote", pct:5, color:C.orange },
      { label:"Not very likely, little motivation", pct:2, color:C.muted },
      { label:"Certain not to vote", pct:3, color:C.muted },
    ],
  },
  {
    id:"q4", qNum:"Q4", category:"Voter Behavior",
    title:"How Do You Plan to Cast Your Ballot?",
    subtitle:"2026 Midterm Election · N=465 · LV Weighted",
    bars:[
      { label:"In person Election Day — know polling location", pct:29, color:C.blue, strong:true },
      { label:"Mail-in — already turned in ballot", pct:17, color:C.blue },
      { label:"Mail-in — already requested or received", pct:17, color:C.blue },
      { label:"Haven't decided how I will vote yet", pct:8, color:C.gold },
      { label:"In person Election Day — need to confirm location", pct:8, color:C.cyan },
      { label:"Early in-person — know when and where", pct:7, color:C.green },
      { label:"Mail-in — plan to request", pct:4, color:C.purpleLt },
      { label:"Early in-person — still need to look up details", pct:3, color:C.orange },
      { label:"Do not plan to vote", pct:4, color:C.muted },
    ],
  },
  {
    id:"q5", qNum:"Q5", category:"Voter Behavior",
    title:"Social Circle Turnout Expectation",
    subtitle:"How many of the 5–10 people closest to you do you expect to vote? · N=465 · LV",
    bars:[
      { label:"All or nearly all of them", pct:39, color:C.green, strong:true },
      { label:"Most of them", pct:31, color:C.blue },
      { label:"About half", pct:13, color:C.gold },
      { label:"A few of them", pct:11, color:C.orange },
      { label:"Not sure", pct:3, color:C.muted },
      { label:"None of them", pct:2, color:C.muted },
    ],
  },
  {
    id:"q6", qNum:"Q6", category:"2024 Presidential Election", chart:"race",
    title:"Who Did You Vote for in 2024?",
    subtitle:"Presidential Recall Vote · N=465 · LV Weighted",
    nets:[
      { val:"61%", lbl:"Kamala Harris", color:C.blue },
      { val:"25%", lbl:"Donald Trump", color:C.pink },
      { val:"D+36", lbl:"LV Advantage", color:C.blue },
    ],
    bars:[
      { label:"Kamala Harris", pct:61, color:C.blue, strong:true },
      { label:"Donald Trump", pct:25, color:C.pink, strong:true },
      { label:"Third party", pct:4, color:C.purpleLt },
      { label:"Did not vote", pct:10, color:C.muted },
    ],
  },
  {
    id:"q8", qNum:"Q8", category:"Political Identity",
    title:"General Political Outlook",
    subtitle:"Which best describes your political outlook? · N=465 · LV Weighted",
    bars:[
      { label:"Progressive / Socialist Democrat", pct:24, color:C.blue, strong:true, group:"DEMOCRAT" },
      { label:"Mainline / Institutional Democrat", pct:11, color:C.blue },
      { label:"Working-Class / Union Democrat", pct:8, color:C.blue },
      { label:"Coalition / Civil Rights Democrat", pct:5, color:C.blue },
      { label:"America First Republican", pct:5, color:C.pink, strong:true, group:"REPUBLICAN" },
      { label:"Suburban / Professional Republican", pct:4, color:C.pink },
      { label:"Populist / Working-Class Republican", pct:3, color:C.pink },
      { label:"Libertarian-Oriented Republican", pct:3, color:C.pink },
      { label:"Lean Democratic Independent", pct:16, color:C.purpleLt, strong:true, group:"INDEPENDENT" },
      { label:"Moderate Independent / Centrist", pct:7, color:C.purpleLt },
      { label:"Lean Republican Independent", pct:5, color:C.purpleLt },
      { label:"Anti-Establishment Independent", pct:3, color:C.purpleLt },
      { label:"None / No clear preference", pct:7, color:C.muted },
    ],
  },
  {
    id:"q9", qNum:"Q9", category:"Party Registration", chart:"race",
    title:"Which Party Are You Registered With?",
    subtitle:"N=465 · LV Weighted",
    nets:[
      { val:"56.6%", lbl:"Democrat", color:C.blue },
      { val:"16.0%", lbl:"Republican", color:C.pink },
      { val:"27.3%", lbl:"Independent/Other", color:C.purpleLt },
      { val:"D+41", lbl:"LV Reg. Advantage", color:C.blue },
    ],
    bars:[
      { label:"Democrat", pct:57, color:C.blue, strong:true },
      { label:"Republican", pct:16, color:C.pink, strong:true },
      { label:"Independent / Other", pct:27, color:C.purpleLt },
    ],
  },
  {
    id:"q7", qNum:"Q7", category:"Issue Priority",
    title:"Issue Priority Ranking",
    subtitle:"% who ranked each issue #1 (most important) · N=465 · LV Weighted",
    rankTable:[
      { label:"Economy, Jobs & Cost of Living", pct1:43, color:C.gold, rank:"Most Important" },
      { label:"Political Corruption, Lobbying & Money", pct1:13, color:C.blue, rank:"#2 Choice" },
      { label:"Healthcare, Social Security & Medicare", pct1:8, color:C.cyan, rank:"#3 Choice" },
      { label:"Immigration & Border Security", pct1:7, color:C.pink, rank:"#4 Choice" },
      { label:"Civil Rights, Personal Freedoms & Social", pct1:6, color:C.purpleLt, rank:"#5 Choice" },
      { label:"Crime, Public Safety & Policing", pct1:6, color:C.orange, rank:"#6 Choice" },
      { label:"Guns & Second Amendment Rights", pct1:5, color:C.pink, rank:"#7 Choice" },
      { label:"Energy, Climate & the Environment", pct1:4, color:C.green, rank:"#8 Choice" },
      { label:"Education, Housing & Family Issues", pct1:3, color:C.purpleLt, rank:"#9 Choice" },
      { label:"Foreign Policy & National Security", pct1:2, color:C.muted, rank:"#10 Choice" },
    ],
  },
  {
    id:"q12", qNum:"Q12", category:"Candidate Trust",
    title:"Karen Bass — Trusted Most Per Issue",
    subtitle:"% selecting Bass as most trusted candidate per issue · N=465 · LV Weighted · Sorted by score",
    bars:[
      { label:"Civil Rights & Social Issues", pct:34, color:C.blue, strong:true },
      { label:"Energy, Climate & Environment", pct:29, color:C.green },
      { label:"Crime, Public Safety", pct:29, color:C.blue },
      { label:"Guns & 2nd Amendment", pct:29, color:C.blue },
      { label:"Healthcare & Medicare", pct:28, color:C.cyan },
      { label:"Economy & Jobs", pct:28, color:C.blue },
      { label:"Immigration", pct:28, color:C.blue },
      { label:"Education & Housing", pct:27, color:C.blue },
      { label:"Foreign Policy", pct:27, color:C.blue },
      { label:"Political Corruption", pct:25, color:C.purpleLt },
    ],
  },
  {
    id:"q13a", qNum:"Q13", category:"Candidate Favorability", chart:"grouped",
    title:"Mayor Candidates — Favorability",
    subtitle:"NET Approve vs NET Disapprove · N=465 · LV Weighted",
    nets:[
      { val:"+0.6", lbl:"Bass Net Fav", color:C.gold },
      { val:"−2.3", lbl:"Pratt Net Fav", color:C.pink },
      { val:"+6.7", lbl:"Raman Net Fav", color:C.green },
    ],
    bars:[
      { label:"Approve", pct:46, color:C.green, strong:true, group:"KAREN BASS" },
      { label:"Disapprove", pct:45, color:C.pink },
      { label:"Approve", pct:34, color:C.green, strong:true, group:"SPENCER PRATT" },
      { label:"Disapprove", pct:37, color:C.pink },
      { label:"Approve", pct:33, color:C.green, strong:true, group:"NITHYA RAMAN" },
      { label:"Disapprove", pct:27, color:C.pink },
      { label:"Approve", pct:21, color:C.green, group:"ADAM MILLER" },
      { label:"Disapprove", pct:23, color:C.pink },
      { label:"Approve", pct:23, color:C.green, group:"RAE HUANG" },
      { label:"Disapprove", pct:21, color:C.pink },
    ],
  },
  {
    id:"q13b", qNum:"Q13", category:"Statewide Figures",
    title:"Statewide & National Figure Approvals",
    subtitle:"NET Approve · N=465 · LV Weighted",
    bars:[
      { label:"Gavin Newsom", pct:58, color:C.green, strong:true, group:"APPROVE" },
      { label:"Kendrick Lamar", pct:45, color:C.blue },
      { label:"Xavier Becerra", pct:42, color:C.blue },
      { label:"Steve Hilton", pct:25, color:C.orange, group:"DISAPPROVE-LEANING" },
      { label:"Donald Trump", pct:21, color:C.pink, strong:true },
      { label:"JD Vance", pct:20, color:C.pink },
      { label:"Chad Bianco", pct:22, color:C.orange },
    ],
  },
  {
    id:"q13trump", qNum:"Q13", category:"Presidential Approval", chart:"diverging",
    title:"Trump — Overall Presidential Approval",
    subtitle:"Do you approve or disapprove of President Trump's performance? · N=465 · LV",
    nets:[
      { val:"75.9%", lbl:"NET Disapprove", color:C.pink },
      { val:"21.4%", lbl:"NET Approve", color:C.green },
      { val:"−54.5", lbl:"Net Approval", color:C.pink },
    ],
    bars:[
      { label:"Strongly disapprove", pct:70, color:C.pink, strong:true, group:"DISAPPROVE" },
      { label:"Somewhat disapprove", pct:6, color:C.pink },
      { label:"Strongly approve", pct:13, color:C.green, strong:true, group:"APPROVE" },
      { label:"Somewhat approve", pct:9, color:C.green },
      { label:"Not sure / no opinion", pct:3, color:C.muted, group:"NEUTRAL" },
    ],
  },
  {
    id:"q14", qNum:"Q14", category:"Trump Issue Approval",
    title:"Trump Approval by Issue — Los Angeles",
    subtitle:"NET Approve vs NET Disapprove per issue · N=465 · LV Weighted · Sorted by disapproval",
    issueTable:[
      { issue:"Handling of Epstein Files", disApprove:76, approve:19 },
      { issue:"Economy, Jobs & Cost of Living", disApprove:76, approve:22 },
      { issue:"Handling of Iran (Operation Epic Fury)", disApprove:74, approve:22 },
      { issue:"Healthcare, Social Security & Medicare", disApprove:73, approve:23 },
      { issue:"Political Corruption & Lobbying", disApprove:72, approve:22 },
      { issue:"Education, Housing & Family Issues", disApprove:72, approve:23 },
      { issue:"Energy, Climate & the Environment", disApprove:71, approve:23 },
      { issue:"Civil Rights, Personal Freedoms & Social", disApprove:71, approve:25 },
      { issue:"Foreign Policy & National Security", disApprove:71, approve:26 },
      { issue:"Crime, Public Safety & Policing", disApprove:70, approve:25 },
      { issue:"Immigration & Border Security", disApprove:68, approve:30 },
      { issue:"Guns & Second Amendment Rights", disApprove:67, approve:25 },
    ],
  },
  {
    id:"q15", qNum:"Q15", category:"Economic Conditions", chart:"diverging",
    title:"Household Economic Difficulty",
    subtitle:"Over the last month, how difficult has it been to pay usual household expenses? · N=465 · LV",
    nets:[
      { val:"56.9%", lbl:"Some Difficulty", color:C.pink },
      { val:"41.9%", lbl:"Little Difficulty", color:C.green },
    ],
    bars:[
      { label:"Very difficult", pct:22, color:C.pink, strong:true },
      { label:"Somewhat difficult", pct:35, color:C.pink },
      { label:"Not very difficult", pct:27, color:C.green },
      { label:"Not at all difficult", pct:15, color:C.green, strong:true },
      { label:"Not sure / no opinion", pct:1, color:C.muted },
    ],
  },
  {
    id:"q16", qNum:"Q16", category:"Candidate Character", chart:"diverging",
    title:"Israel PAC Donations",
    subtitle:"If a candidate accepted donations from a PAC supporting Israel, more or less likely to vote for them? · N=465 · LV",
    nets:[
      { val:"44.8%", lbl:"NET Less Likely", color:C.pink },
      { val:"21.6%", lbl:"NET More Likely", color:C.green },
      { val:"33.6%", lbl:"No Difference", color:C.muted },
    ],
    bars:[
      { label:"Much less likely", pct:29, color:C.pink, strong:true, group:"LESS LIKELY" },
      { label:"Somewhat less likely", pct:16, color:C.pink },
      { label:"No difference / No opinion", pct:34, color:C.neutral, group:"NO DIFFERENCE" },
      { label:"Somewhat more likely", pct:12, color:C.green, group:"MORE LIKELY" },
      { label:"Much more likely", pct:9, color:C.green, strong:true },
    ],
  },
  {
    id:"q17", qNum:"Q17", category:"Culture & Community", chart:"race",
    title:"Kendrick Lamar vs. Drake — Who Won?",
    subtitle:"Who do you believe won the 2024 Kendrick Lamar versus Drake Rap Battle? · N=465 · LV",
    nets:[
      { val:"47.6%", lbl:"Kendrick Lamar", color:C.purple },
      { val:"10.2%", lbl:"Drake", color:C.orange },
    ],
    bars:[
      { label:"Kendrick Lamar", pct:48, color:C.purple, strong:true },
      { label:"Undecided / not sure", pct:42, color:C.muted },
      { label:"Drake", pct:10, color:C.orange },
    ],
  },
];

const NATIONAL_SLIDES: Slide[] = [
  {
    id:"nat-q3", qNum:"Q3", category:"Electorate",
    title:"Voter Motivation — 2026 Midterm Election",
    subtitle:"How would you describe your intention and motivation to vote? · N=893 · LV Weighted",
    nets:[
      { val:"93.0%", lbl:"Certain / Very Likely",      color:C.green },
      { val:"77.2%", lbl:"Certain + Highly Motivated", color:C.blue },
    ],
    bars:[
      { label:"Certain to vote & highly motivated",      pct:77.2, color:C.green, strong:true },
      { label:"Very likely to vote & feel motivated",    pct:15.8, color:C.blue },
      { label:"Somewhat likely, not strongly motivated", pct:2.9,  color:C.gold },
      { label:"Motivated but unsure if will vote",       pct:2.1,  color:C.orange },
      { label:"Not very likely, little motivation",      pct:1.3,  color:C.muted },
      { label:"Certain not to vote",                     pct:0.7,  color:C.muted },
    ],
  },

  {
    id:"nat-q4", qNum:"Q4", category:"Electorate",
    title:"How Do You Plan to Cast Your Ballot?",
    subtitle:"2026 Midterm Election · N=893 · LV Weighted",
    bars:[
      { label:"In person Election Day — know polling location",    pct:48.7, color:C.blue,    strong:true },
      { label:"Mail-in — already requested or received",           pct:20.4, color:C.blue },
      { label:"Early in-person — know when and where",             pct:11.9, color:C.green },
      { label:"In person Election Day — need to confirm location", pct:6.6,  color:C.cyan },
      { label:"Mail-in — plan to request",                         pct:5.2,  color:C.purpleLt },
      { label:"Haven't decided how I will vote yet",               pct:3.7,  color:C.gold },
      { label:"Early in-person — still need to look up details",   pct:2.0,  color:C.orange },
      { label:"Do not plan to vote",                               pct:1.6,  color:C.muted },
    ],
  },

  {
    id:"nat-q5", qNum:"Q5", category:"Electorate",
    title:"Social Circle Turnout Expectation",
    subtitle:"How many of the 5–10 people closest to you do you expect to vote? · N=893 · LV Weighted",
    bars:[
      { label:"All or nearly all of them", pct:45.7, color:C.green,  strong:true },
      { label:"Most of them",              pct:35.5, color:C.blue },
      { label:"About half",                pct:10.3, color:C.gold },
      { label:"A few of them",             pct:5.2,  color:C.orange },
      { label:"Not sure",                  pct:2.3,  color:C.muted },
      { label:"None of them",              pct:0.9,  color:C.muted },
    ],
  },

  {
    id:"nat-q6", chart:"race", qNum:"Q6", category:"Electorate",
    title:"Who Did You Vote for in 2024?",
    subtitle:"Presidential Recall Vote · N=893 · LV Weighted",
    nets:[
      { val:"44.3%", lbl:"Kamala Harris", color:C.blue },
      { val:"43.9%", lbl:"Donald Trump",  color:C.pink },
      { val:"R+0.4", lbl:"LV Spread",     color:C.pink },
    ],
    bars:[
      { label:"Kamala Harris", pct:44.3, color:C.blue,    strong:true },
      { label:"Donald Trump",  pct:43.9, color:C.pink,    strong:true },
      { label:"Third party",   pct:1.5,  color:C.purpleLt },
      { label:"Did not vote",  pct:10.2, color:C.muted },
    ],
  },

  {
    id:"nat-q8", qNum:"Q8", category:"Political Identity",
    title:"General Political Outlook",
    subtitle:"Which best describes your political outlook? · N=893 · LV Weighted",
    bars:[
      { label:"Progressive / Socialist Democrat",    pct:14.0, color:C.blue,     strong:true, group:"DEMOCRAT" },
      { label:"Mainline / Institutional Democrat",   pct:7.4,  color:C.blue },
      { label:"Working-Class / Union Democrat",      pct:5.9,  color:C.blue },
      { label:"Coalition / Civil Rights Democrat",   pct:2.8,  color:C.blue },
      { label:"America First Republican",            pct:12.3, color:C.pink,     strong:true, group:"REPUBLICAN" },
      { label:"Populist / Working-Class Republican", pct:6.3,  color:C.pink },
      { label:"Suburban / Professional Republican",  pct:6.0,  color:C.pink },
      { label:"Libertarian-Oriented Republican",     pct:3.7,  color:C.pink },
      { label:"Lean Republican Independent",         pct:11.1, color:C.purpleLt, strong:true, group:"INDEPENDENT" },
      { label:"Lean Democratic Independent",         pct:13.9, color:C.purpleLt },
      { label:"Moderate Independent / Centrist",     pct:11.1, color:C.purpleLt },
      { label:"Anti-Establishment Independent",      pct:2.3,  color:C.purpleLt },
      { label:"None / No clear preference",          pct:3.1,  color:C.muted },
    ],
  },

  {
    id:"nat-q9", chart:"race", qNum:"Q9", category:"Political Identity",
    title:"Which Party Do You Identify With?",
    subtitle:"N=893 · LV Weighted",
    nets:[
      { val:"40.1%", lbl:"Democrat",          color:C.blue },
      { val:"37.5%", lbl:"Republican",        color:C.pink },
      { val:"22.5%", lbl:"Independent/Other", color:C.purpleLt },
    ],
    bars:[
      { label:"Democrat",            pct:40.1, color:C.blue,     strong:true },
      { label:"Republican",          pct:37.5, color:C.pink,     strong:true },
      { label:"Independent / Other", pct:22.5, color:C.purpleLt },
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
      { label:"Yes", pct:7.8,  color:C.pink },
      { label:"No",  pct:92.2, color:C.green, strong:true },
    ],
  },

  {
    id:"nat-q11", chart:"diverging", qNum:"Q11", category:"Track & Ballot",
    title:"Right Track / Wrong Track",
    subtitle:"Is the direction of the country on the right track or wrong track? · N=893 · LV Weighted",
    nets:[
      { val:"30.2%", lbl:"Right Track", color:C.green },
      { val:"62.1%", lbl:"Wrong Track", color:C.pink },
      { val:"−31.9", lbl:"Net Track",   color:C.pink },
    ],
    bars:[
      { label:"Right track", pct:30.2, color:C.green, strong:true },
      { label:"Wrong track", pct:62.1, color:C.pink,  strong:true },
      { label:"Not sure",    pct:7.7,  color:C.muted },
    ],
  },

  {
    id:"nat-q13", chart:"race", qNum:"Q13", category:"Track & Ballot",
    title:"2026 Generic Congressional Ballot",
    subtitle:"If the 2026 Midterms were held today, who would you vote for? · N=893 · LV Weighted",
    nets:[
      { val:"46.8%", lbl:"Democrat",   color:C.blue },
      { val:"40.0%", lbl:"Republican", color:C.pink },
      { val:"D+6.8", lbl:"Dem Lead",   color:C.blue },
    ],
    bars:[
      { label:"The Democrat candidate",          pct:46.8, color:C.blue,     strong:true },
      { label:"The Republican candidate",        pct:40.0, color:C.pink,     strong:true },
      { label:"Undecided / Not sure",            pct:10.3, color:C.muted },
      { label:"A third-party / independent",     pct:2.9,  color:C.purpleLt },
    ],
  },

  {
    id:"nat-q14", chart:"diverging", qNum:"Q14", category:"Trump",
    title:"Trump — Presidential Approval",
    subtitle:"Do you approve or disapprove of President Trump's performance? · N=893 · LV Weighted",
    nets:[
      { val:"41.6%", lbl:"NET Approve",    color:C.green },
      { val:"57.6%", lbl:"NET Disapprove", color:C.pink },
      { val:"−16.0", lbl:"Net Approval",   color:C.pink },
    ],
    bars:[
      { label:"Strongly approve",     pct:21.8, color:C.green, strong:true, group:"APPROVE" },
      { label:"Somewhat approve",     pct:19.8, color:C.green },
      { label:"Strongly disapprove",  pct:49.6, color:C.pink,  strong:true, group:"DISAPPROVE" },
      { label:"Somewhat disapprove",  pct:8.0,  color:C.pink },
      { label:"Neutral / no opinion", pct:0.9,  color:C.muted, group:"NEUTRAL" },
    ],
  },

  {
    id:"nat-q16", qNum:"Q16", category:"Trump",
    title:"Trump Approval by Issue",
    subtitle:"NET Approve vs NET Disapprove per issue · N=893 · LV Weighted · Sorted by disapproval",
    issueTable:[
      { issue:"Economy, Jobs & Cost of Living",         disApprove:61.3, approve:37.2 },
      { issue:"Healthcare, Social Security & Medicare", disApprove:56.6, approve:38.1 },
      { issue:"Education, Housing & Family Issues",     disApprove:55.1, approve:38.5 },
      { issue:"Foreign Policy & National Security",     disApprove:53.4, approve:42.9 },
      { issue:"Immigration & Border Security",          disApprove:51.7, approve:46.7 },
      { issue:"Crime, Public Safety & Policing",        disApprove:49.3, approve:47.0 },
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
      { label:"Far too conservative",      pct:42.1, color:C.pink,   strong:true, group:"TOO CONSERVATIVE" },
      { label:"Somewhat too conservative", pct:11.9, color:C.pink },
      { label:"About the right balance",   pct:31.0, color:C.green,  strong:true, group:"ABOUT RIGHT" },
      { label:"Somewhat too liberal",      pct:2.9,  color:C.gold,   group:"TOO LIBERAL" },
      { label:"Far too liberal",           pct:5.6,  color:C.orange },
      { label:"Not sure / no opinion",     pct:6.5,  color:C.muted,  group:"NOT SURE" },
    ],
  },

  {
    id:"nat-q12a", qNum:"Q12", category:"2028 Matchups",
    title:"2028 Presidential Matchups — JD Vance",
    subtitle:"JD Vance (R) vs Democratic candidates vs Thomas Massie (I) · N=893 · LV Weighted",
    bars:[
      { label:"Democrat (Gavin Newsom)",   pct:45.1, color:C.blue,     strong:true, group:"JD VANCE vs GAVIN NEWSOM" },
      { label:"Republican (JD Vance)",     pct:38.6, color:C.pink },
      { label:"Independent (T. Massie)",   pct:5.9,  color:C.purpleLt },
      { label:"Undecided",                 pct:10.4, color:C.muted },
      { label:"Democrat (Kamala Harris)",  pct:47.0, color:C.blue,     strong:true, group:"JD VANCE vs KAMALA HARRIS" },
      { label:"Republican (JD Vance)",     pct:38.9, color:C.pink },
      { label:"Independent (T. Massie)",   pct:7.2,  color:C.purpleLt },
      { label:"Undecided",                 pct:6.8,  color:C.muted },
      { label:"Democrat (Pete Buttigieg)", pct:45.7, color:C.blue,     strong:true, group:"JD VANCE vs PETE BUTTIGIEG" },
      { label:"Republican (JD Vance)",     pct:39.8, color:C.pink },
      { label:"Independent (T. Massie)",   pct:6.5,  color:C.purpleLt },
      { label:"Undecided",                 pct:8.0,  color:C.muted },
    ],
  },

  {
    id:"nat-q12b", qNum:"Q12", category:"2028 Matchups",
    title:"2028 Presidential Matchups — Marco Rubio",
    subtitle:"Marco Rubio (R) vs Democratic candidates vs Thomas Massie (I) · N=893 · LV Weighted",
    bars:[
      { label:"Democrat (Gavin Newsom)",   pct:45.9, color:C.blue,     strong:true, group:"MARCO RUBIO vs GAVIN NEWSOM" },
      { label:"Republican (M. Rubio)",     pct:39.1, color:C.pink },
      { label:"Independent (T. Massie)",   pct:4.9,  color:C.purpleLt },
      { label:"Undecided",                 pct:10.1, color:C.muted },
      { label:"Democrat (Kamala Harris)",  pct:46.9, color:C.blue,     strong:true, group:"MARCO RUBIO vs KAMALA HARRIS" },
      { label:"Republican (M. Rubio)",     pct:38.9, color:C.pink },
      { label:"Independent (T. Massie)",   pct:6.5,  color:C.purpleLt },
      { label:"Undecided",                 pct:7.7,  color:C.muted },
      { label:"Democrat (Pete Buttigieg)", pct:44.3, color:C.blue,     strong:true, group:"MARCO RUBIO vs PETE BUTTIGIEG" },
      { label:"Republican (M. Rubio)",     pct:39.0, color:C.pink },
      { label:"Independent (T. Massie)",   pct:6.7,  color:C.purpleLt },
      { label:"Undecided",                 pct:10.0, color:C.muted },
    ],
  },

  {
    id:"nat-q12c", qNum:"Q12", category:"2028 Matchups",
    title:"2028 Presidential Matchups — Ted Cruz",
    subtitle:"Ted Cruz (R) vs Democratic candidates vs Thomas Massie (I) · N=893 · LV Weighted",
    bars:[
      { label:"Democrat (Gavin Newsom)",   pct:44.4, color:C.blue,     strong:true, group:"TED CRUZ vs GAVIN NEWSOM" },
      { label:"Republican (Ted Cruz)",     pct:39.4, color:C.pink },
      { label:"Independent (T. Massie)",   pct:5.9,  color:C.purpleLt },
      { label:"Undecided",                 pct:10.3, color:C.muted },
      { label:"Democrat (Kamala Harris)",  pct:46.1, color:C.blue,     strong:true, group:"TED CRUZ vs KAMALA HARRIS" },
      { label:"Republican (Ted Cruz)",     pct:38.5, color:C.pink },
      { label:"Independent (T. Massie)",   pct:7.4,  color:C.purpleLt },
      { label:"Undecided",                 pct:8.0,  color:C.muted },
      { label:"Democrat (Pete Buttigieg)", pct:45.5, color:C.blue,     strong:true, group:"TED CRUZ vs PETE BUTTIGIEG" },
      { label:"Republican (Ted Cruz)",     pct:37.5, color:C.pink },
      { label:"Independent (T. Massie)",   pct:6.7,  color:C.purpleLt },
      { label:"Undecided",                 pct:10.3, color:C.muted },
    ],
  },

  {
    id:"nat-q12d", qNum:"Q12", category:"2028 Matchups",
    title:"2028 Presidential Matchups — Ron DeSantis",
    subtitle:"Ron DeSantis (R) vs Democratic candidates vs Thomas Massie (I) · N=893 · LV Weighted",
    bars:[
      { label:"Democrat (Gavin Newsom)",   pct:44.7, color:C.blue,     strong:true, group:"RON DESANTIS vs GAVIN NEWSOM" },
      { label:"Republican (R. DeSantis)",  pct:38.7, color:C.pink },
      { label:"Independent (T. Massie)",   pct:6.7,  color:C.purpleLt },
      { label:"Undecided",                 pct:9.9,  color:C.muted },
      { label:"Democrat (Kamala Harris)",  pct:47.2, color:C.blue,     strong:true, group:"RON DESANTIS vs KAMALA HARRIS" },
      { label:"Republican (R. DeSantis)",  pct:38.8, color:C.pink },
      { label:"Independent (T. Massie)",   pct:6.2,  color:C.purpleLt },
      { label:"Undecided",                 pct:7.8,  color:C.muted },
      { label:"Democrat (Pete Buttigieg)", pct:45.2, color:C.blue,     strong:true, group:"RON DESANTIS vs PETE BUTTIGIEG" },
      { label:"Republican (R. DeSantis)",  pct:37.3, color:C.pink },
      { label:"Independent (T. Massie)",   pct:7.0,  color:C.purpleLt },
      { label:"Undecided",                 pct:10.4, color:C.muted },
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
      { label:"The American people above all else",                                pct:23.7, color:C.green,    strong:true, group:"AMERICAN-FIRST" },
      { label:"Mostly American people w/ significant consideration for allies",    pct:19.3, color:C.green },
      { label:"A balance between American and foreign ally interests",             pct:8.6,  color:C.gold,     group:"BALANCED" },
      { label:"Mostly the interests of foreign allies like Israel over Americans", pct:13.8, color:C.pink,     group:"FOREIGN-FIRST" },
      { label:"Foreign allies like Israel above the American people",              pct:24.5, color:C.pink,     strong:true },
      { label:"Not sure / no opinion",                                             pct:10.0, color:C.muted,    group:"NOT SURE" },
    ],
  },

  {
    id:"nat-q24", chart:"diverging", qNum:"Q24", category:"Foreign Policy",
    title:"Israel PAC Donations Effect on Vote",
    subtitle:"If a candidate accepted donations from a PAC supporting Israel, more or less likely to vote for them? · N=893 · LV Weighted",
    nets:[
      { val:"31.8%", lbl:"NET Less Likely", color:C.pink },
      { val:"27.4%", lbl:"NET More Likely", color:C.green },
      { val:"40.9%", lbl:"No Difference",   color:C.muted },
    ],
    bars:[
      { label:"Much less likely",           pct:20.6, color:C.pink,    strong:true, group:"LESS LIKELY" },
      { label:"Somewhat less likely",       pct:11.2, color:C.pink },
      { label:"No difference / no opinion", pct:40.9, color:C.neutral, group:"NO DIFFERENCE" },
      { label:"Somewhat more likely",       pct:15.0, color:C.green,   group:"MORE LIKELY" },
      { label:"Much more likely",           pct:12.4, color:C.green,   strong:true },
    ],
  },

  {
    id:"nat-q20", chart:"diverging", qNum:"Q20", category:"Economy",
    title:"Household Economic Difficulty",
    subtitle:"Over the last month, how difficult has it been to pay usual household expenses? · N=893 · LV Weighted",
    nets:[
      { val:"58.0%", lbl:"Some Difficulty",   color:C.pink },
      { val:"40.7%", lbl:"Little Difficulty", color:C.green },
    ],
    bars:[
      { label:"Very difficult",        pct:19.2, color:C.pink,  strong:true },
      { label:"Somewhat difficult",    pct:38.8, color:C.pink },
      { label:"Not very difficult",    pct:22.0, color:C.green },
      { label:"Not at all difficult",  pct:18.7, color:C.green, strong:true },
      { label:"Not sure / no opinion", pct:1.3,  color:C.muted },
    ],
  },

  {
    id:"nat-q21", chart:"diverging", qNum:"Q21", category:"Immigration",
    title:"Mass Deportation of Illegal Immigrants",
    subtitle:"Do you support or oppose the mass deportation of all illegal immigrants? · N=893 · LV Weighted",
    nets:[
      { val:"46.7%", lbl:"NET Support", color:C.green },
      { val:"48.1%", lbl:"NET Oppose",  color:C.pink },
    ],
    bars:[
      { label:"Strongly support", pct:26.6, color:C.green, strong:true, group:"SUPPORT" },
      { label:"Somewhat support", pct:20.1, color:C.green },
      { label:"Strongly oppose",  pct:31.7, color:C.pink,  strong:true, group:"OPPOSE" },
      { label:"Somewhat oppose",  pct:16.4, color:C.pink },
      { label:"Not sure",         pct:5.2,  color:C.muted, group:"NOT SURE" },
    ],
  },

  {
    id:"nat-q22", qNum:"Q22", category:"Social",
    title:"Preferred Candidate Generation",
    subtitle:"When voting for a candidate, which generation do you most prefer? · N=893 · LV Weighted",
    bars:[
      { label:"Gen X (ages 45–60)",       pct:44.8, color:C.blue,     strong:true },
      { label:"Millennial (ages 29–44)",  pct:20.9, color:C.purpleLt },
      { label:"Baby Boomer (ages 61–79)", pct:13.2, color:C.gold },
      { label:"Not sure / no opinion",    pct:17.4, color:C.muted },
      { label:"Gen Z (ages 18–28)",       pct:3.7,  color:C.cyan },
    ],
  },

  {
    id:"nat-q23", qNum:"Q23", category:"Social",
    title:"Most Important Quality in a Long-Term Partner",
    subtitle:"Which is the single most important quality when considering a long-term partner? · N=893 · LV Weighted",
    bars:[
      { label:"Emotional availability",         pct:29.6, color:C.blue,     strong:true },
      { label:"Sense of humor",                 pct:19.1, color:C.purpleLt },
      { label:"Financial stability",            pct:14.6, color:C.gold },
      { label:"Religious affiliation",          pct:9.9,  color:C.cyan },
      { label:"Ambition / work ethic",          pct:9.4,  color:C.orange },
      { label:"Physical attractiveness",        pct:5.7,  color:C.pink },
      { label:"Not sure / no opinion",          pct:8.2,  color:C.muted },
      { label:"A lot of sexual experience",     pct:2.6,  color:C.muted },
      { label:"Little to no sexual experience", pct:0.8,  color:C.muted },
    ],
  },

  {
    id:"nat-q17a", qNum:"Q17", category:"Favorability",
    title:"Individual Favorability — Political Figures",
    subtitle:"NET Approve vs NET Disapprove · N=893 · LV Weighted · Sorted by approval",
    issueTable:[
      { issue:"Kamala Harris",  approve:53.7, disApprove:43.7 },
      { issue:"Pete Buttigieg", approve:44.6, disApprove:34.4 },
      { issue:"Gavin Newsom",   approve:44.0, disApprove:39.9 },
      { issue:"JD Vance",       approve:40.9, disApprove:53.3 },
      { issue:"Marco Rubio",    approve:41.1, disApprove:45.8 },
      { issue:"Ron DeSantis",   approve:40.2, disApprove:44.6 },
      { issue:"Ted Cruz",       approve:38.5, disApprove:48.8 },
      { issue:"Ben Shapiro",    approve:34.7, disApprove:29.7 },
      { issue:"Tucker Carlson", approve:27.4, disApprove:50.4 },
      { issue:"Thomas Massie",  approve:27.3, disApprove:26.4 },
      { issue:"Megyn Kelly",    approve:27.0, disApprove:42.4 },
      { issue:"Candace Owens",  approve:23.7, disApprove:38.5 },
      { issue:"Mark Levin",     approve:24.0, disApprove:22.1 },
      { issue:"Laura Loomer",   approve:14.8, disApprove:32.6 },
      { issue:"Nick Fuentes",   approve:13.4, disApprove:37.5 },
    ],
  },

  {
    id:"nat-q17b", qNum:"Q17", category:"Favorability",
    title:"Individual Favorability — Media & Pop Culture",
    subtitle:"NET Approve vs NET Disapprove · N=893 · LV Weighted",
    issueTable:[
      { issue:"Michael Jackson", approve:44.8, disApprove:24.9 },
      { issue:"Kendrick Lamar",  approve:33.5, disApprove:22.3 },
      { issue:"Drake",           approve:27.3, disApprove:29.5 },
      { issue:"Thomas Massie",   approve:27.3, disApprove:26.4 },
      { issue:"Playboi Carti",   approve:14.0, disApprove:17.7 },
      { issue:"Clavicular",      approve:9.8,  disApprove:18.7 },
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
      { label:"Tyler Robinson, acting alone",                         pct:29.5, color:C.gold,     strong:true },
      { label:"Not sure / no opinion",                                pct:27.6, color:C.muted },
      { label:"Tyler Robinson, part of a larger organization",        pct:13.7, color:C.orange },
      { label:"A government or political actor",                      pct:8.5,  color:C.purpleLt },
      { label:"A left-wing or anti-conservative organization",        pct:7.8,  color:C.blue },
      { label:"Someone at Turning Point USA (TPUSA)",                 pct:7.5,  color:C.pink },
      { label:"A right-wing or anti-liberal organization",            pct:5.4,  color:C.pink },
    ],
  },
];

const SD_SLIDES: Slide[] = [
  {
    id:"sd-q6", chart:"race", qNum:"Q6", category:"Primary Race",
    title:"Republican Primary for Governor",
    subtitle:"If the Republican Primary election for Governor were held today, for whom would you vote?",
    bars:[
      { label:"Larry Rhoden",  pct:32.4, color:C.pink,     strong:true },
      { label:"Dusty Johnson", pct:27.2, color:C.orange,   strong:true },
      { label:"Toby Doeden",   pct:24.0, color:C.gold,     strong:true },
      { label:"Jon Hansen",    pct:13.2, color:C.purpleLt, strong:true },
      { label:"Undecided",     pct:3.3,  color:C.muted },
    ],
  },
  {
    id:"sd-q3", qNum:"Q3", category:"Electorate",
    title:"Voter Intent & Motivation",
    subtitle:"How would you describe your intention and motivation to vote in the 2026 Republican Primary Election?",
    bars:[
      { label:"Certain to vote — highly motivated",      pct:80.6, color:C.green,  strong:true },
      { label:"Very likely — feel motivated",            pct:11.2, color:C.green },
      { label:"Somewhat likely — not strongly motivated",pct:5.0,  color:C.gold },
      { label:"Motivated but unsure if will vote",       pct:2.1,  color:C.orange },
      { label:"Not very likely — little motivation",     pct:0.9,  color:C.muted },
      { label:"Certain not to vote",                     pct:0.2,  color:C.muted },
    ],
  },
  {
    id:"sd-q4", qNum:"Q4", category:"Electorate",
    title:"How Respondents Plan to Cast Their Ballot",
    subtitle:"How do you plan to cast your ballot in the 2026 Midterm Election?",
    bars:[
      { label:"In-person on Election Day (confirmed location)",  pct:46.9, color:C.blue,     strong:true },
      { label:"Early in-person (confirmed details)",             pct:14.1, color:C.cyan,     strong:true },
      { label:"Mail-in / absentee (already requested)",          pct:14.1, color:C.purpleLt, strong:true },
      { label:"In-person on Election Day (need to confirm)",     pct:6.8,  color:C.blue },
      { label:"Haven't decided how to vote",                     pct:5.8,  color:C.muted },
      { label:"Do not plan to vote",                             pct:5.3,  color:C.muted },
      { label:"Mail-in / absentee (plan to request)",            pct:4.9,  color:C.purpleLt },
      { label:"Early in-person (need to look up details)",       pct:2.2,  color:C.cyan },
    ],
  },
  {
    id:"sd-q5", qNum:"Q5", category:"Electorate",
    title:"Social Network Voting Expectation",
    subtitle:"Thinking about the 5–10 people you are closest to, how many do you expect to vote?",
    bars:[
      { label:"All or nearly all of them", pct:42.5, color:C.green,  strong:true },
      { label:"Most of them",              pct:31.0, color:C.green },
      { label:"About half",                pct:16.2, color:C.gold },
      { label:"A few of them",             pct:8.1,  color:C.orange },
      { label:"Not sure",                  pct:1.9,  color:C.muted },
      { label:"None of them",              pct:0.3,  color:C.muted },
    ],
  },
];

const SC_SLIDES: Slide[] = [
  {
    id:"sc-senate", qNum:"Q1", category:"Senate Primary", chart:"race",
    title:"U.S. Senate — Republican Primary",
    subtitle:"Meridian Coalition Voter model · N=369 · LV Weighted · June 2026",
    nets:[
      { val:"51.0%", lbl:"Lindsey Graham",   color:C.blue },
      { val:"26.4%", lbl:"Mark Lynch",       color:C.pink },
      { val:"G+24.6",lbl:"Graham Margin",    color:C.blue },
    ],
    bars:[
      { label:"Lindsey Graham",    pct:51.0, color:C.blue,     strong:true },
      { label:"Mark Lynch",        pct:26.4, color:C.pink,     strong:true },
      { label:"Thomas Dismukes",   pct:6.6,  color:C.gold },
      { label:"Patrick Herrmann",  pct:5.4,  color:C.orange },
      { label:"Darius L. Mitchell",pct:4.2,  color:C.purpleLt },
      { label:"Calvin Cowen",      pct:2.0,  color:C.cyan },
      { label:"Undecided",         pct:4.4,  color:C.muted },
    ],
  },
  {
    id:"sc-gov", qNum:"Q2", category:"Governor Primary", chart:"race",
    title:"Governor — Republican Primary",
    subtitle:"Meridian Coalition Voter model · N=369 · LV Weighted · June 2026",
    nets:[
      { val:"30.0%", lbl:"Nancy Mace",    color:C.pink },
      { val:"24.9%", lbl:"Pamela Evette", color:C.blue },
      { val:"M+5.1", lbl:"Mace Margin",   color:C.pink },
    ],
    bars:[
      { label:"Nancy Mace",    pct:30.0, color:C.pink,     strong:true },
      { label:"Pamela Evette", pct:24.9, color:C.blue,     strong:true },
      { label:"Ralph Norman",  pct:15.2, color:C.gold },
      { label:"Rom Reddy",     pct:13.4, color:C.orange },
      { label:"Alan Wilson",   pct:12.0, color:C.purpleLt },
      { label:"Undecided",     pct:4.6,  color:C.muted },
    ],
  },
  {
    id:"sc-q3", qNum:"Q3", category:"Electorate",
    title:"Voter Intent & Motivation",
    subtitle:"How would you describe your intention and motivation to vote? · N=369 · LV Weighted",
    nets:[
      { val:"96.2%", lbl:"Certain / Very Likely",      color:C.green },
      { val:"78.6%", lbl:"Certain + Highly Motivated", color:C.blue },
    ],
    bars:[
      { label:"Certain to vote & highly motivated",      pct:78.6, color:C.green, strong:true },
      { label:"Very likely to vote & feel motivated",    pct:17.6, color:C.blue },
      { label:"Somewhat likely, not strongly motivated", pct:3.6,  color:C.gold },
      { label:"Motivated but unsure if will vote",       pct:0.2,  color:C.orange },
      { label:"Not very likely, little motivation",      pct:0.1,  color:C.muted },
    ],
  },
  {
    id:"sc-q4", qNum:"Q4", category:"Electorate",
    title:"How Do You Plan to Cast Your Ballot?",
    subtitle:"2026 Midterm Election · N=369 · LV Weighted",
    bars:[
      { label:"In person Election Day — know polling location",     pct:74.1, color:C.blue,     strong:true },
      { label:"Early in-person — already voted",                    pct:9.0,  color:C.green,    strong:true },
      { label:"Early in-person — know when and where",              pct:6.8,  color:C.cyan },
      { label:"In person Election Day — need to confirm location",  pct:5.0,  color:C.blue },
      { label:"Early in-person — still need to look up details",    pct:1.6,  color:C.orange },
      { label:"Mail-in — already turned in ballot",                 pct:1.1,  color:C.purpleLt },
      { label:"Haven't decided how I will vote yet",                pct:0.3,  color:C.gold },
    ],
  },
  {
    id:"sc-q5", qNum:"Q5", category:"Electorate",
    title:"Social Circle Turnout Expectation",
    subtitle:"How many of the 5–10 people closest to you do you expect to vote? · N=369 · LV Weighted",
    bars:[
      { label:"All or nearly all of them", pct:50.0, color:C.green, strong:true },
      { label:"Most of them",              pct:37.9, color:C.blue },
      { label:"About half",                pct:10.3, color:C.gold },
      { label:"A few of them",             pct:1.3,  color:C.orange },
      { label:"Not sure",                  pct:0.5,  color:C.muted },
    ],
  },
  {
    id:"sc-q6", qNum:"Q6", category:"Political Identity",
    title:"General Political Outlook",
    subtitle:"Which best describes your political outlook? · N=369 · LV Weighted",
    bars:[
      { label:"America First Republican",            pct:20.2, color:C.pink,     strong:true, group:"REPUBLICAN" },
      { label:"Lean Rep. Independent",               pct:15.5, color:C.pink },
      { label:"Suburban / Professional Republican",  pct:8.9,  color:C.pink },
      { label:"Populist / Working-Class Republican", pct:7.1,  color:C.pink },
      { label:"Libertarian Republican",              pct:4.6,  color:C.pink },
      { label:"Lean Democratic Independent",         pct:11.3, color:C.purpleLt, strong:true, group:"INDEPENDENT" },
      { label:"Moderate Independent / Centrist",     pct:5.8,  color:C.purpleLt },
      { label:"Anti-Establishment Independent",      pct:1.3,  color:C.purpleLt },
      { label:"Progressive Democrat",                pct:7.8,  color:C.blue,     strong:true, group:"DEMOCRAT" },
      { label:"Working-Class Democrat",              pct:7.0,  color:C.blue },
      { label:"Mainline Democrat",                   pct:2.2,  color:C.blue },
      { label:"Coalition / Civil Rights Democrat",   pct:2.1,  color:C.blue },
      { label:"No Clear Preference",                 pct:6.2,  color:C.muted,    group:"OTHER" },
    ],
  },
  {
    id:"sc-q12", qNum:"Q12", category:"Approval Ratings", chart:"diverging",
    title:"Trump Job Approval",
    subtitle:"Do you approve or disapprove of the job Donald Trump is doing as President? · N=369 · LV Weighted",
    nets:[
      { val:"54.1%", lbl:"NET Approve",    color:C.green },
      { val:"43.9%", lbl:"NET Disapprove", color:C.pink },
      { val:"+10.2", lbl:"Net Approval",   color:C.green },
    ],
    bars:[
      { label:"Strongly approve",    pct:28.2, color:C.green, strong:true, group:"APPROVE" },
      { label:"Somewhat approve",    pct:26.0, color:C.green },
      { label:"Neutral / no opinion",pct:1.9,  color:C.muted, group:"NEUTRAL" },
      { label:"Somewhat disapprove", pct:8.7,  color:C.pink,  group:"DISAPPROVE" },
      { label:"Strongly disapprove", pct:35.2, color:C.pink,  strong:true },
    ],
  },
  {
    id:"sc-q13", qNum:"Q13", category:"Approval Ratings",
    title:"Lindsey Graham Approval",
    subtitle:"Do you approve or disapprove of the job Sen. Lindsey Graham is doing? · N=369 · LV Weighted",
    nets:[
      { val:"51.1%", lbl:"NET Approve",    color:C.blue },
      { val:"44.8%", lbl:"NET Disapprove", color:C.pink },
      { val:"+6.3",  lbl:"Net Approval",   color:C.blue },
    ],
    bars:[
      { label:"Strongly approve",    pct:18.3, color:C.blue,  strong:true, group:"APPROVE" },
      { label:"Somewhat approve",    pct:32.8, color:C.blue },
      { label:"Neutral / no opinion",pct:4.2,  color:C.muted, group:"NEUTRAL" },
      { label:"Somewhat disapprove", pct:12.9, color:C.pink,  group:"DISAPPROVE" },
      { label:"Strongly disapprove", pct:31.9, color:C.pink,  strong:true },
    ],
  },
  {
    id:"sc-q15", qNum:"Q15", category:"Issues", chart:"diverging",
    title:"Israel PAC Donations — Vote Likelihood",
    subtitle:"If a candidate accepted donations from a PAC supporting Israel, would you be more or less likely to vote for them? · N=369 · LV",
    nets:[
      { val:"35.7%", lbl:"NET More Likely", color:C.green },
      { val:"26.2%", lbl:"NET Less Likely", color:C.pink },
      { val:"38.2%", lbl:"No Difference",  color:C.muted },
    ],
    bars:[
      { label:"Much more likely",           pct:15.3, color:C.green, strong:true, group:"MORE LIKELY" },
      { label:"Somewhat more likely",       pct:20.4, color:C.green },
      { label:"No difference / no opinion", pct:38.2, color:C.muted, group:"NO DIFFERENCE" },
      { label:"Somewhat less likely",       pct:10.9, color:C.pink,  group:"LESS LIKELY" },
      { label:"Much less likely",           pct:15.3, color:C.pink,  strong:true },
    ],
  },
  {
    id:"sc-q16", qNum:"Q16", category:"Issues",
    title:"Israel's Influence in American Politics",
    subtitle:"Do you think Israel has too much, too little, or the right amount of influence in American politics? · N=369 · LV",
    bars:[
      { label:"Too much influence",      pct:36.0, color:C.pink,     strong:true },
      { label:"The right amount",        pct:37.4, color:C.green,    strong:true },
      { label:"Too little influence",    pct:6.8,  color:C.blue },
      { label:"Not sure / no opinion",   pct:19.7, color:C.muted },
    ],
  },
  {
    id:"sc-q17", qNum:"Q17", category:"Graham Fox News",
    title:"Graham Fox News Statement — Awareness",
    subtitle:"Were you aware of Graham's recent statement on Fox News? · N=369 · LV Weighted",
    nets:[
      { val:"49.1%", lbl:"Aware",     color:C.blue },
      { val:"50.9%", lbl:"Not Aware", color:C.muted },
    ],
    bars:[
      { label:"Yes, I was aware",    pct:49.1, color:C.blue,  strong:true },
      { label:"No, I was not aware", pct:50.9, color:C.muted },
    ],
  },
  {
    id:"sc-q18", qNum:"Q18", category:"Graham Fox News", chart:"diverging",
    title:"Graham Fox News Statement — Approve or Disapprove?",
    subtitle:"Do you approve or disapprove of Graham's statement? · N=369 · LV Weighted",
    nets:[
      { val:"58.4%", lbl:"NET Approve",    color:C.green },
      { val:"35.8%", lbl:"NET Disapprove", color:C.pink },
      { val:"+22.6", lbl:"Net Approval",   color:C.green },
    ],
    bars:[
      { label:"Strongly approve",    pct:33.3, color:C.green, strong:true, group:"APPROVE" },
      { label:"Somewhat approve",    pct:25.1, color:C.green },
      { label:"Not sure / no opinion",pct:5.8, color:C.muted, group:"NEUTRAL" },
      { label:"Somewhat disapprove", pct:8.7,  color:C.pink,  group:"DISAPPROVE" },
      { label:"Strongly disapprove", pct:27.1, color:C.pink,  strong:true },
    ],
  },
  {
    id:"sc-coalition", qNum:"—", category:"Coalition Model", chart:"race",
    title:"Meridian Coalition Assignment",
    subtitle:"Voter coalition segmentation · N=369 · LV Weighted",
    nets:[
      { val:"42.2%", lbl:"Graham Base",           color:C.blue },
      { val:"41.9%", lbl:"Open Primary Crossover", color:C.purple },
      { val:"15.6%", lbl:"Lynch / Anti-Graham",   color:C.pink },
    ],
    bars:[
      { label:"Graham Base",            pct:42.2, color:C.blue,     strong:true },
      { label:"Open Primary Crossover", pct:41.9, color:C.purpleLt, strong:true },
      { label:"Lynch / Anti-Graham",    pct:15.6, color:C.pink,     strong:true },
      { label:"Unresolved",             pct:0.3,  color:C.muted },
    ],
  },
];


const READS: Record<string, string> = {
  q10a:"Bass leads the first-choice ballot, but a 31% undecided bloc leaves the race genuinely unsettled heading into June.",
  q10b:"Allocate the leaners and Bass opens a commanding 18.8-point margin — yet a third of the field still scatters beyond the top two.",
  q3:"This is a high-intent electorate: 82% call themselves certain or very likely to vote, and two-thirds are both certain and highly motivated.",
  q4:"Mail voting dominates — roughly a third have already returned or received a ballot well before Election Day.",
  q5:"Engagement runs deep: 70% expect most or all of their close circle to turn out.",
  q6:"The likely-voter pool skews heavily Harris (+36), a reminder of how blue the Los Angeles mayoral electorate runs.",
  q8:"Progressives are the single largest bloc at 24%; Democrats of every stripe make up roughly half the electorate.",
  q9:"Registered Democrats outnumber Republicans better than three to one — a structural D+41 advantage.",
  q7:"The economy towers over everything else: 43% rank it first, more than triple the next-closest issue.",
  q12:"Bass's issue-trust ceiling sits in the high-20s to mid-30s, strongest on civil rights and the environment.",
  q13a:"Raman posts the best net favorability in the field (+6.7); Pratt is the only candidate tested who lands underwater.",
  q13b:"Newsom leads the approval field; Trump and Vance anchor the bottom among Los Angeles voters.",
  q13trump:"Trump is deeply underwater in Los Angeles — a −54.5 net, with strong-disapprove alone at 70%.",
  q14:"Disapproval of Trump clears 67% on every issue tested, peaking on the Epstein files and the economy.",
  q15:"A 57% majority report at least some difficulty covering monthly expenses — the cost-of-living squeeze is broad.",
  q16:"Israel-PAC money reads as a net liability here: 45% say it makes them less likely to back a candidate.",
  q17:"Los Angeles sides with its own — Kendrick beats Drake nearly five to one among those with an opinion.",
  "nat-q3":"Nine in ten call themselves certain or very likely to vote — a midterm electorate that already looks engaged.",
  "nat-q4":"Nearly half still vote in person on Election Day, while mail and early voting together account for four in ten ballots.",
  "nat-q5":"Eight in ten expect most or all of their closest circle to turn out — engagement runs through whole social networks.",
  "nat-q6":"The 2024 recall vote lands within half a point — a sample that mirrors the photo-finish presidential result.",
  "nat-q8":"No single tribe dominates: progressives (14%) and America First Republicans (12%) anchor the poles, with a deep independent middle between them.",
  "nat-q9":"Party identification runs D+2.6 — close enough that independents hold the balance.",
  "nat-q10":"Fewer than one in twelve identify as Groypers — though 7.8% of a national likely-voter sample is not nothing.",
  "nat-q11":"Pessimism is the majority position: wrong-track sentiment outruns right-track by nearly 32 points.",
  "nat-q13":"Democrats open a 6.8-point generic-ballot lead, with one in ten still on the fence.",
  "nat-q14":"Trump sits 16 points underwater, and intensity cuts against him — strong disapproval (49.6%) more than doubles strong approval.",
  "nat-q16":"Trump is net-negative on every issue tested; the economy, once his strongest card, is now his worst number.",
  "nat-q18":"A 54% majority call Trump's record too conservative — including 42% who say far too conservative.",
  "nat-q12a":"Every named Democrat beats Vance by six to eight points, with Massie pulling mid-single digits as an independent.",
  "nat-q12b":"Rubio fares no better — trailing all three Democrats by five to eight points.",
  "nat-q12c":"Cruz trails the full Democratic field, falling furthest against Harris (−7.6).",
  "nat-q12d":"DeSantis loses all three tests; Harris posts the widest margin against him (+8.4).",
  "nat-q19":"The country splits on whether Trump's foreign policy puts Americans first — 43% say it does, 38% say foreign allies come first.",
  "nat-q24":"Israel-PAC money is a wash nationally: 32% less likely, 27% more likely, and a 41% plurality unmoved.",
  "nat-q20":"58% report difficulty covering monthly expenses — the affordability squeeze spans the electorate.",
  "nat-q21":"Mass deportation splits the country in two: 47% support, 48% oppose, with intensity higher on the opposition side.",
  "nat-q22":"Gen X is the generation voters most want on the ballot — preferred over Millennials by better than two to one.",
  "nat-q23":"Emotional availability tops the partner rankings at 30%; sexual experience, in either direction, barely registers.",
  "nat-q17a":"Harris posts the best net favorability in the political field (+10); Tucker Carlson the worst (−23).",
  "nat-q17b":"Michael Jackson is the most favorably viewed figure tested — and Kendrick beats Drake again, +11.2 net to −2.2.",
  "nat-q25":"No consensus on the Kirk assassination: Robinson-acting-alone leads at 29.5%, but seven in ten believe something else — or aren't sure.",
  "sd-q6":"Rhoden leads Johnson by 5.2 with Doeden within ten — a genuine three-way race, and just 3% undecided.",
  "sd-q3":"South Dakota's primary electorate is locked in: 92% certain or very likely, and 81% both certain and highly motivated.",
  "sd-q4":"Election Day still rules here — over half vote in person on the day, with early and mail splitting most of the rest.",
  "sd-q5":"Nearly three-quarters expect most or all of their closest circle to vote.",
  "sc-senate":"Graham holds a commanding 51% against a fractured field — Lynch's 26% is the only real consolidation of the anti-incumbent vote.",
  "sc-gov":"The governor's primary is wide open: Mace edges Evette by five, with three more candidates packed in the teens.",
  "sc-q3":"An extraordinary 96% call themselves certain or very likely to vote — primary electorates don't come more engaged.",
  "sc-q4":"Three-quarters vote in person on Election Day with their polling place already known.",
  "sc-q5":"Half expect their entire close circle to turn out — engagement here is communal.",
  "sc-q6":"America First Republicans are the largest bloc at 20%, but lean-Republican independents (15.5%) are the swing weight of an open primary.",
  "sc-q12":"Trump runs +10 with this primary electorate — though a 35% strongly-disapprove bloc marks the crossover voters an open primary lets in.",
  "sc-q13":"Graham sits at +6.3 — softer than Trump, with approval leaning somewhat rather than strongly.",
  "sc-q15":"Unlike the national picture, Israel-PAC money reads as a net positive here: +9.5 more likely.",
  "sc-q16":"The electorate splits on Israel's influence — 37% say the right amount, 36% say too much.",
  "sc-q17":"Graham's Fox News statement reached half the electorate before this poll did.",
  "sc-q18":"The statement lands at +22.6 net approval — whatever it cost him elsewhere, it is helping him here.",
  "sc-coalition":"The Meridian model cuts the electorate into camps: Graham's base (42%) and open-primary crossovers (42%) dwarf the committed anti-Graham vote (16%).",
};

// ─── Lenses for the dot-field ─────────────────────────────────────────────────
interface Lens { id: string; tab: string; question: string; bins: { label: string; pct: number; color: string }[]; big: string; lead: string; sub: string; }
const LA_LENSES: Lens[] = [
  { id:"ballot", tab:"Mayoral ballot", question:"If the LA mayoral election were held today, with leaners allocated —",
    bins:[
      { label:"Bass", pct:39.9, color:C.blue }, { label:"Pratt", pct:21.1, color:C.pink },
      { label:"Raman", pct:12.2, color:C.purple }, { label:"Other", pct:12.1, color:"rgba(244,244,239,0.46)" },
      { label:"Huang", pct:7.8, color:"rgba(244,244,239,0.34)" }, { label:"Miller", pct:6.9, color:"rgba(244,244,239,0.24)" },
    ], big:"+18.8", lead:"Bass leads", sub:"the field with leaners allocated" },
  { id:"party", tab:"Party reg.", question:"Which party are these likely voters registered with?",
    bins:[ { label:"Democrat", pct:56.6, color:C.blue }, { label:"Independent", pct:27.3, color:C.purple }, { label:"Republican", pct:16.0, color:C.pink } ],
    big:"D+41", lead:"Democratic", sub:"registration advantage in the sample" },
  { id:"trump", tab:"Trump approval", question:"Do they approve or disapprove of President Trump?",
    bins:[ { label:"Disapprove", pct:75.9, color:C.pink }, { label:"Approve", pct:21.4, color:C.green }, { label:"No opinion", pct:2.7, color:"rgba(244,244,239,0.30)" } ],
    big:"−54.5", lead:"Underwater", sub:"net Trump approval across Los Angeles" },
  { id:"cost", tab:"Cost of living", question:"How difficult has it been to pay monthly household expenses?",
    bins:[ { label:"Difficulty", pct:56.9, color:C.pink }, { label:"Little / none", pct:41.9, color:C.green }, { label:"Not sure", pct:1.2, color:"rgba(244,244,239,0.30)" } ],
    big:"57%", lead:"Squeezed", sub:"report difficulty covering the bills" },
  { id:"turnout", tab:"Turnout", question:"How locked-in is each voter for 2026?",
    bins:[ { label:"Certain + motivated", pct:66.0, color:C.green }, { label:"Very likely", pct:16.0, color:C.blue }, { label:"Softer / unsure", pct:18.0, color:"rgba(244,244,239,0.36)" } ],
    big:"82%", lead:"Locked in", sub:"are certain or very likely to vote" },
  { id:"recall", tab:"2024 vote", question:"Who did they vote for in the 2024 presidential election?",
    bins:[ { label:"Harris", pct:61.0, color:C.blue }, { label:"Trump", pct:25.0, color:C.pink }, { label:"Didn't vote", pct:10.0, color:"rgba(244,244,239,0.36)" }, { label:"Third party", pct:4.0, color:C.purple } ],
    big:"D+36", lead:"Harris country", sub:"2024 recall vote margin" },
];

const NATIONAL_LENSES: Lens[] = [
  { id:"ballot", tab:"Generic ballot", question:"If the 2026 midterms were held today, who would these voters choose for Congress?",
    bins:[
      { label:"Democrat", pct:46.8, color:C.blue }, { label:"Republican", pct:40.0, color:C.pink },
      { label:"Undecided", pct:10.3, color:"rgba(244,244,239,0.34)" }, { label:"Third party", pct:2.9, color:C.purple },
    ], big:"D+6.8", lead:"Democrats lead", sub:"the 2026 generic congressional ballot" },
  { id:"trump", tab:"Trump approval", question:"Do they approve or disapprove of President Trump?",
    bins:[ { label:"Disapprove", pct:57.6, color:C.pink }, { label:"Approve", pct:41.6, color:C.green }, { label:"No opinion", pct:0.9, color:"rgba(244,244,239,0.30)" } ],
    big:"−16.0", lead:"Underwater", sub:"net Trump approval nationwide" },
  { id:"track", tab:"Direction", question:"Is the country on the right track or the wrong track?",
    bins:[ { label:"Wrong track", pct:62.1, color:C.pink }, { label:"Right track", pct:30.2, color:C.green }, { label:"Not sure", pct:7.7, color:"rgba(244,244,239,0.30)" } ],
    big:"−31.9", lead:"Wrong track", sub:"net direction of the country" },
  { id:"party", tab:"Party ID", question:"Which party do these likely voters identify with?",
    bins:[ { label:"Democrat", pct:40.1, color:C.blue }, { label:"Republican", pct:37.5, color:C.pink }, { label:"Independent", pct:22.5, color:C.purple } ],
    big:"D+2.6", lead:"Narrow edge", sub:"in national party identification" },
  { id:"cost", tab:"Cost of living", question:"How difficult has it been to pay monthly household expenses?",
    bins:[ { label:"Difficulty", pct:58.0, color:C.pink }, { label:"Little / none", pct:40.7, color:C.green }, { label:"Not sure", pct:1.3, color:"rgba(244,244,239,0.30)" } ],
    big:"58%", lead:"Squeezed", sub:"report difficulty covering the bills" },
  { id:"recall", tab:"2024 vote", question:"Who did they vote for in the 2024 presidential election?",
    bins:[ { label:"Harris", pct:44.3, color:C.blue }, { label:"Trump", pct:43.9, color:C.pink }, { label:"Didn't vote", pct:10.2, color:"rgba(244,244,239,0.36)" }, { label:"Third party", pct:1.5, color:C.purple } ],
    big:"+0.4", lead:"Dead even", sub:"Harris over Trump in the 2024 recall" },
];

const SD_LENSES: Lens[] = [
  { id:"gov", tab:"Governor primary", question:"If the Republican primary for governor were held today —",
    bins:[
      { label:"Rhoden", pct:32.4, color:C.pink }, { label:"Johnson", pct:27.2, color:"rgba(244,244,239,0.46)" },
      { label:"Doeden", pct:24.0, color:C.gold }, { label:"Hansen", pct:13.2, color:C.purple },
      { label:"Undecided", pct:3.3, color:"rgba(244,244,239,0.28)" },
    ], big:"+5.2", lead:"Rhoden leads", sub:"a genuine three-way race for governor" },
  { id:"turnout", tab:"Turnout", question:"How locked-in is each primary voter?",
    bins:[ { label:"Certain + motivated", pct:80.6, color:C.green }, { label:"Very likely", pct:11.2, color:C.blue }, { label:"Softer / unsure", pct:8.2, color:"rgba(244,244,239,0.36)" } ],
    big:"92%", lead:"Locked in", sub:"are certain or very likely to vote" },
  { id:"method", tab:"Ballot method", question:"How do they plan to cast their ballot?",
    bins:[ { label:"Election Day", pct:53.7, color:C.blue }, { label:"Mail / absentee", pct:19.0, color:C.purple }, { label:"Early in person", pct:16.3, color:C.green }, { label:"Undecided / won't", pct:11.1, color:"rgba(244,244,239,0.32)" } ],
    big:"54%", lead:"Election Day", sub:"still vote in person on the day" },
  { id:"circle", tab:"Social circle", question:"How many of their closest 5–10 people do they expect to vote?",
    bins:[ { label:"All / nearly all", pct:42.5, color:C.green }, { label:"Most", pct:31.0, color:C.blue }, { label:"About half", pct:16.2, color:C.gold }, { label:"Fewer", pct:10.3, color:"rgba(244,244,239,0.32)" } ],
    big:"74%", lead:"Networked", sub:"expect most or all of their circle to vote" },
];

const SC_LENSES: Lens[] = [
  { id:"senate", tab:"Senate primary", question:"If the Republican primary for U.S. Senate were held today —",
    bins:[
      { label:"Graham", pct:51.0, color:C.blue }, { label:"Lynch", pct:26.4, color:C.pink },
      { label:"Others", pct:18.2, color:C.purple }, { label:"Undecided", pct:4.4, color:"rgba(244,244,239,0.28)" },
    ], big:"+24.6", lead:"Graham leads", sub:"the Senate primary over Mark Lynch" },
  { id:"gov", tab:"Governor primary", question:"And the open Republican primary for governor —",
    bins:[
      { label:"Mace", pct:30.0, color:C.pink }, { label:"Evette", pct:24.9, color:C.blue },
      { label:"Norman", pct:15.2, color:C.gold }, { label:"Reddy", pct:13.4, color:"rgba(244,244,239,0.44)" },
      { label:"Wilson", pct:12.0, color:C.purple }, { label:"Und.", pct:4.6, color:"rgba(244,244,239,0.26)" },
    ], big:"+5.1", lead:"Mace edges", sub:"a wide-open governor's primary" },
  { id:"trump", tab:"Trump approval", question:"Do they approve or disapprove of President Trump?",
    bins:[ { label:"Approve", pct:54.1, color:C.green }, { label:"Disapprove", pct:43.9, color:C.pink }, { label:"Neutral", pct:1.9, color:"rgba(244,244,239,0.30)" } ],
    big:"+10.2", lead:"Trump country", sub:"net Trump approval in the primary electorate" },
  { id:"graham", tab:"Graham approval", question:"And Senator Lindsey Graham?",
    bins:[ { label:"Approve", pct:51.1, color:C.blue }, { label:"Disapprove", pct:44.8, color:C.pink }, { label:"Neutral", pct:4.2, color:"rgba(244,244,239,0.30)" } ],
    big:"+6.3", lead:"Softer ground", sub:"net Graham approval — gentler than Trump's" },
  { id:"coalition", tab:"Coalition", question:"How does the Meridian model segment this electorate?",
    bins:[ { label:"Graham base", pct:42.2, color:C.blue }, { label:"Crossover", pct:41.9, color:C.purple }, { label:"Anti-Graham", pct:15.6, color:C.pink } ],
    big:"42.2%", lead:"Two camps", sub:"Graham base against open-primary crossover" },
  { id:"turnout", tab:"Turnout", question:"How locked-in is each primary voter?",
    bins:[ { label:"Certain + motivated", pct:78.6, color:C.green }, { label:"Very likely", pct:17.6, color:C.blue }, { label:"Softer", pct:3.9, color:"rgba(244,244,239,0.36)" } ],
    big:"96%", lead:"Maximal", sub:"are certain or very likely to vote" },
];

// ─── Field reports registry ──────────────────────────────────────────────────
type PollId = "national" | "la" | "sd" | "sc";
interface PollDef {
  id: PollId; no: string; tab: string; date: string; defaultSlide: string;
  eyebrow: string; h: React.ReactNode; sub: string; meta: { b: string; t: string }[];
  intro: string; secH: React.ReactNode; method: string;
  slides: Slide[]; lenses: Lens[];
}
const POLLS: PollDef[] = [
  {
    id: "national", no: "№ 02", tab: "National Benchmark", date: "May 2026", defaultSlide: "nat-q13",
    eyebrow: "TPSI Poll — Field report № 02",
    h: <>the national<br /><span className="dim">mood,</span> measured.</>,
    sub: "An original national likely-voter benchmark — the generic ballot, Trump approval, the 2028 field, and the issues underneath it all.",
    meta: [ { b:"893", t:"likely voters" }, { b:"May 2026", t:"· national LV" }, { b:"±3.3", t:"pts margin" }, { b:"25", t:"questions" } ],
    intro: "Every likely voter in the national sample, recut by whichever lens you choose.",
    secH: <>twenty-five questions, <span className="dim">one country.</span></>,
    method: "The Public Sentiment Institute surveyed 893 likely voters nationwide in May 2026. Results are weighted to the modeled likely-voter electorate; the margin of sampling error is approximately ±3.3 points. Figures may not sum to 100 due to rounding.",
    slides: NATIONAL_SLIDES, lenses: NATIONAL_LENSES,
  },
  {
    id: "la", no: "№ 01", tab: "LA Mayoral", date: "May 2026", defaultSlide: "q10a",
    eyebrow: "TPSI Poll — Field report № 01",
    h: <>the los angeles<br /><span className="dim">mayoral race,</span> measured.</>,
    sub: "An original likely-voter survey of the June ballot — candidate favorability, the issues driving the city, and a verdict on Donald Trump.",
    meta: [ { b:"465", t:"likely voters" }, { b:"May 2026", t:"· Wave I" }, { b:"±4.5", t:"pts margin" }, { b:"17", t:"questions" } ],
    intro: "Every likely voter in the survey, recut by whichever lens you choose.",
    secH: <>seventeen questions, <span className="dim">one electorate.</span></>,
    method: "The Public Sentiment Institute surveyed 465 likely Los Angeles voters in May 2026 (Wave I). Results are weighted to the modeled likely-voter electorate; the margin of sampling error is approximately ±4.5 points. Leaner allocation distributes undecided respondents by stated second preference. Figures may not sum to 100 due to rounding.",
    slides: LA_SLIDES, lenses: LA_LENSES,
  },
  {
    id: "sd", no: "№ 03", tab: "SD GOP Primary", date: "May 2026", defaultSlide: "sd-q6",
    eyebrow: "TPSI Poll — Field report № 03",
    h: <>south dakota&rsquo;s<br /><span className="dim">gop primary,</span> measured.</>,
    sub: "A likely-voter read on the Republican primary for governor — a genuine three-way race at the top of the ticket.",
    meta: [ { b:"400", t:"likely voters" }, { b:"May 2026", t:"· GOP LV" }, { b:"±4.9", t:"pts margin" }, { b:"4", t:"questions" } ],
    intro: "Every likely Republican primary voter in the sample, recut by lens.",
    secH: <>four questions, <span className="dim">one primary.</span></>,
    method: "The Public Sentiment Institute surveyed 400 likely Republican primary voters in South Dakota in May 2026. Results are weighted to the modeled primary electorate; the margin of sampling error is approximately ±4.9 points. Figures may not sum to 100 due to rounding.",
    slides: SD_SLIDES, lenses: SD_LENSES,
  },
  {
    id: "sc", no: "№ 04", tab: "SC GOP Primary", date: "June 2026", defaultSlide: "sc-senate",
    eyebrow: "TPSI Poll — Field report № 04",
    h: <>south carolina&rsquo;s<br /><span className="dim">gop primary,</span> measured.</>,
    sub: "Senate and governor primaries under the Meridian Coalition Voter model — Graham's standing, an open governor's race, and the currents moving an open primary.",
    meta: [ { b:"369", t:"likely voters" }, { b:"June 2026", t:"· Meridian model" }, { b:"±5.1", t:"pts margin" }, { b:"13", t:"questions" } ],
    intro: "Every likely primary voter in the Meridian sample, recut by lens.",
    secH: <>thirteen questions, <span className="dim">one primary.</span></>,
    method: "The Public Sentiment Institute surveyed 369 likely Republican primary voters in South Carolina in June 2026 under the Meridian Coalition Voter model, which segments respondents by primary behavior. Results are weighted to the modeled open-primary electorate; the margin of sampling error is approximately ±5.1 points. Figures may not sum to 100 due to rounding.",
    slides: SC_SLIDES, lenses: SC_LENSES,
  },
];
const COUNT_WORDS: Record<number, string> = { 3:"three", 4:"four", 5:"five", 6:"six", 7:"seven" };

// ─── Animation helpers ────────────────────────────────────────────────────────
function prefersReducedMotion() { return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; }
function useCountUp(target: number, decimals = 0, duration = 950) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    if (prefersReducedMotion()) { raf = requestAnimationFrame(() => setVal(target)); return () => cancelAnimationFrame(raf); }
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => { const t = Math.min(1, Math.max(0, (now - start) / duration)); setVal(target * ease(t)); if (t < 1) raf = requestAnimationFrame(tick); else setVal(target); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, decimals, duration]);
  return val.toFixed(decimals);
}
function useMounted() { const [m, setM] = useState(false); useEffect(() => { const r = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(r); }, []); return m; }
function parseStat(raw: string) {
  const m = raw.match(/^([A-Za-z][+\-])?\s*([+\-−])?\s*(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return { prefix: raw, value: NaN, decimals: 0, suffix: "" };
  const letter = m[1] ?? "", signRaw = m[2] ?? "", numStr = m[3];
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  let value = parseFloat(numStr); if (signRaw === "−" || signRaw === "-") value = -value;
  let prefix = letter; if (!letter && signRaw === "+") prefix = "+";
  return { prefix, value, decimals, suffix: m[4] ?? "" };
}
function CountNum({ value, decimals = 0, prefix = "", suffix = "" }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const v = useCountUp(Math.abs(value), decimals);
  return <span className="cup">{prefix}{value < 0 ? "−" : ""}{v}{suffix}</span>;
}
function StatNumber({ raw }: { raw: string }) {
  const p = parseStat(raw);
  if (Number.isNaN(p.value)) return <span className="cup">{raw}</span>;
  return <CountNum value={p.value} decimals={p.decimals} prefix={p.prefix} suffix={p.suffix} />;
}

// ═══ THE ELECTORATE ═══════════════════════════════════════════════════════════
function ShareBar({ lens }: { lens: Lens }) {
  const lead = lens.bins.reduce((a, b, i) => (b.pct > lens.bins[a].pct ? i : a), 0);
  return (
    <div className="share">
      {lens.bins.map((b, i) => (
        <div key={i} className="share-col" style={{ width: `${b.pct}%` }}>
          <div className="share-seg" style={{ background: b.color, boxShadow: i === lead ? `0 10px 44px ${b.color}55` : "none", animationDelay: `${i * 65}ms` }} />
          <div className="share-lab"><b>{b.label}</b><i>{b.pct}%</i></div>
        </div>
      ))}
    </div>
  );
}
function Electorate({ lenses, intro }: { lenses: Lens[]; intro: string }) {
  const [active, setActive] = useState(0);
  const lens = lenses[Math.min(active, lenses.length - 1)];
  return (
    <section className="elec">
      <div className="shell">
        <div className="elec-head">
          <div>
            <div className="eyebrow">The electorate</div>
            <h2 className="elec-h">one sample, <span className="dim">{COUNT_WORDS[lenses.length] ?? lenses.length}&nbsp;lenses.</span></h2>
            <p className="elec-intro">{intro}</p>
          </div>
          <div className="lens" role="tablist" aria-label="Electorate lenses">
            {lenses.map((l, i) => (
              <button key={l.id} role="tab" aria-selected={i === active} className={`lens-pill${i === active ? " on" : ""}`} onClick={() => setActive(i)}>{l.tab}</button>
            ))}
          </div>
        </div>
        <div key={lens.id} className="elec-stage">
          <div className="elec-readout">
            <div className="elec-figure">
              <span className="elec-big" style={{ color: lens.bins[0].color }}><StatNumber raw={lens.big} /></span>
              <span className="elec-lead">{lens.lead}<em>{lens.sub}</em></span>
            </div>
            <div className="elec-q">{lens.question}</div>
          </div>
          <ShareBar lens={lens} />
        </div>
      </div>
    </section>
  );
}

// ═══ Charts + survey ══════════════════════════════════════════════════════════
type ChartKind = "race" | "diverging" | "grouped-diverging" | "distribution" | "rank" | "issue-diverging";
function classify(s: Slide): ChartKind {
  if (s.rankTable) return "rank"; if (s.issueTable) return "issue-diverging";
  if (s.chart === "race") return "race"; if (s.chart === "diverging") return "diverging"; if (s.chart === "grouped") return "grouped-diverging";
  return "distribution";
}
function groupBars(bars: BarRow[]) { const g: { name: string; rows: BarRow[] }[] = []; let cur: { name: string; rows: BarRow[] } | null = null; bars.forEach(r => { if (r.group) { cur = { name: r.group, rows: [] }; g.push(cur); } else if (!cur) { cur = { name: "", rows: [] }; g.push(cur); } cur!.rows.push(r); }); return g; }
function navLead(s: Slide): { text: string; color: string } {
  if (s.rankTable) return { text: `${s.rankTable[0].pct1}%`, color: s.rankTable[0].color };
  if (s.issueTable) return { text: `${Math.max(...s.issueTable.map(r => r.disApprove))}%`, color: C.pink };
  if (s.chart === "diverging" && s.bars) { const neg = s.bars.filter(r => r.color === C.pink).reduce((a, b) => a + b.pct, 0); const pos = s.bars.filter(r => r.color === C.green).reduce((a, b) => a + b.pct, 0); const net = +(pos - neg).toFixed(1); return { text: `${net > 0 ? "+" : "−"}${Math.abs(net)}`, color: net < 0 ? C.pink : C.green }; }
  if (s.bars) { const top = s.chart === "race" ? s.bars[0] : s.bars.reduce((a, b) => (b.pct > a.pct ? b : a), s.bars[0]); return { text: `${top.pct}%`, color: top.color }; }
  return { text: "", color: C.muted };
}
function getCategories(slides: Slide[]) { const cats = new Map<string, Slide[]>(); slides.forEach(s => { if (s.isCover) return; if (!cats.has(s.category)) cats.set(s.category, []); cats.get(s.category)!.push(s); }); return Array.from(cats.entries()).map(([cat, items]) => ({ cat, items })); }

function Rail({ categories, activeId, onSelect }: { categories: { cat: string; items: Slide[] }[]; activeId: string; onSelect: (id: string) => void }) {
  return (
    <nav className="rail" aria-label="Survey contents">
      {categories.map(({ cat, items }) => (
        <div key={cat} className="rail-group">
          <div className="rail-cat">{cat}</div>
          {items.map(s => { const active = activeId === s.id; const lead = navLead(s); return (
            <button key={s.id} className={`rail-item${active ? " on" : ""}`} onClick={() => onSelect(s.id)} aria-current={active ? "true" : undefined}>
              <span className="rail-name">{s.title}</span>
              <span className="rail-lead" style={{ color: active ? lead.color : undefined }}>{lead.text}</span>
            </button>
          ); })}
        </div>
      ))}
    </nav>
  );
}
function Readout({ nets }: { nets: NetStat[] }) {
  return (<div className="readout">{nets.map((n, i) => (<div key={i} className="rd-cell"><div className="rd-val" style={{ color: n.color }}><StatNumber raw={n.val} /></div><div className="rd-lbl">{n.lbl}</div></div>))}</div>);
}
function RaceChart({ rows }: { rows: BarRow[] }) {
  const m = useMounted(); const max = Math.max(...rows.map(r => r.pct), 1);
  return (<div className="rc">{rows.map((r, i) => (
    <div key={i} className={`rc-row${i === 0 ? " lead" : ""}`}>
      <div className="rc-name">{r.label}</div>
      <div className="rc-track"><div className="rc-fill" style={{ width: m ? `${(r.pct / max) * 100}%` : "0%", background: r.color, opacity: r.strong ? 1 : 0.4, transitionDelay: `${i * 55}ms` }} /></div>
      <div className="rc-pct" style={{ color: i === 0 ? r.color : undefined }}>{r.pct}<i>%</i></div>
    </div>
  ))}</div>);
}
function DistributionChart({ bars }: { bars: BarRow[] }) {
  const m = useMounted(); const groups = groupBars(bars);
  return (<div className="rc">{groups.map((g, gi) => (
    <div key={gi}>{g.name && <div className="rc-glabel">{g.name}</div>}
      {g.rows.map((r, ri) => (
        <div key={ri} className="rc-row">
          <div className="rc-name">{r.label}</div>
          <div className="rc-track"><div className="rc-fill" style={{ width: m ? `${r.pct}%` : "0%", background: r.color, opacity: r.strong ? 1 : 0.45, transitionDelay: `${ri * 35}ms` }} /></div>
          <div className="rc-pct" style={{ color: r.strong ? r.color : undefined }}>{r.pct}<i>%</i></div>
        </div>
      ))}
    </div>
  ))}</div>);
}
function DivergingChart({ rows }: { rows: BarRow[] }) {
  const m = useMounted();
  const isNeg = (r: BarRow) => r.color === C.pink, isPos = (r: BarRow) => r.color === C.green;
  const left = rows.filter(isNeg), right = rows.filter(isPos), neutral = rows.filter(r => !isNeg(r) && !isPos(r));
  const sum = (rs: BarRow[]) => rs.reduce((a, b) => a + b.pct, 0); const sumL = sum(left), sumR = sum(right); const net = +(sumR - sumL).toFixed(1);
  const w = (v: number) => (m ? `${v}%` : "0%");
  return (
    <div className="dv">
      <div className="dv-poles"><span style={{ color: C.pink }}>{left[0]?.label.replace(/^Strongly /i, "").replace(/^Very /i, "") || "Negative"}</span><span className="dv-net" style={{ color: net < 0 ? C.pink : C.green }}>net <CountNum value={net} decimals={1} prefix={net > 0 ? "+" : ""} /></span><span style={{ color: C.green }}>{right[0]?.label.replace(/^Strongly /i, "").replace(/^Not at all /i, "Not ") || "Positive"}</span></div>
      <div className="dv-bar">
        <span className="dv-spine" />
        <div className="dv-side l">{left.map((r, i) => <div key={i} className="dv-seg" title={`${r.label} · ${r.pct}%`} style={{ width: w(r.pct), background: r.color, opacity: r.strong ? 1 : 0.5 }} />)}</div>
        <div className="dv-side r">{right.map((r, i) => <div key={i} className="dv-seg" title={`${r.label} · ${r.pct}%`} style={{ width: w(r.pct), background: r.color, opacity: r.strong ? 1 : 0.5 }} />)}</div>
      </div>
      <div className="dv-legend">{[...left, ...right, ...neutral].map((r, i) => (<span key={i} className="dv-chip"><i style={{ background: r.color, opacity: r.strong ? 1 : 0.5 }} />{r.label}<b>{r.pct}%</b></span>))}</div>
    </div>
  );
}
function DivergingMatrix({ rows, leftLabel, rightLabel }: { rows: { label: string; neg: number; pos: number }[]; leftLabel: string; rightLabel: string }) {
  const m = useMounted(); const maxSide = Math.max(...rows.flatMap(r => [r.neg, r.pos]), 1); const w = (v: number) => (m ? `${(v / maxSide) * 100}%` : "0%");
  return (
    <div className="mx">
      <div className="mx-head"><span /><span className="mx-poles"><i style={{ color: C.pink }}>{leftLabel}</i><i style={{ color: C.green }}>{rightLabel}</i></span><span className="mx-neth">Net</span></div>
      {rows.map((r, i) => { const net = +(r.pos - r.neg).toFixed(0); return (
        <div key={i} className="mx-row">
          <div className="mx-name">{r.label}</div>
          <div className="mx-bar"><span className="dv-spine" />
            <div className="dv-side l"><span className="mx-val">{r.neg}</span><div className="dv-seg" style={{ width: w(r.neg), background: C.pink, transitionDelay: `${i * 26}ms` }} /></div>
            <div className="dv-side r"><div className="dv-seg" style={{ width: w(r.pos), background: C.green, transitionDelay: `${i * 26}ms` }} /><span className="mx-val">{r.pos}</span></div></div>
          <div className="mx-net" style={{ color: net < 0 ? C.pink : C.green }}>{net > 0 ? "+" : net < 0 ? "−" : ""}{Math.abs(net)}</div>
        </div>
      ); })}
    </div>
  );
}
function IssueLedger({ rows }: { rows: RankRow[] }) {
  const m = useMounted(); const max = Math.max(...rows.map(r => r.pct1), 1);
  return (<div className="iss">{rows.map((r, i) => (
    <div key={i} className={`iss-row${i === 0 ? " top" : ""}`}>
      <div className="iss-rank">{String(i + 1).padStart(2, "0")}</div>
      <div className="iss-label">{r.label}<span className="iss-tag">{r.rank}</span></div>
      <div className="iss-track"><div className="iss-fill" style={{ width: m ? `${(r.pct1 / max) * 100}%` : "0%", background: r.color, transitionDelay: `${i * 40}ms` }} /></div>
      <div className="iss-pct" style={{ color: i === 0 ? r.color : undefined }}>{r.pct1}<i>%</i></div>
    </div>
  ))}</div>);
}
function QuestionChart({ slide }: { slide: Slide }) {
  const kind = classify(slide);
  if (kind === "race" && slide.bars) return <RaceChart rows={slide.bars} />;
  if (kind === "diverging" && slide.bars) return <DivergingChart rows={slide.bars} />;
  if (kind === "grouped-diverging" && slide.bars) { const rows = groupBars(slide.bars).map(g => ({ label: g.name, pos: g.rows.find(r => /^approve$/i.test(r.label))?.pct ?? 0, neg: g.rows.find(r => /^disapprove$/i.test(r.label))?.pct ?? 0 })).sort((a, b) => (b.pos - b.neg) - (a.pos - a.neg)); return <DivergingMatrix rows={rows} leftLabel="Disapprove" rightLabel="Approve" />; }
  if (kind === "issue-diverging" && slide.issueTable) return <DivergingMatrix rows={slide.issueTable.map(r => ({ label: r.issue, neg: r.disApprove, pos: r.approve }))} leftLabel="Disapprove" rightLabel="Approve" />;
  if (kind === "rank" && slide.rankTable) return <IssueLedger rows={slide.rankTable} />;
  if (slide.bars) return <DistributionChart bars={slide.bars} />;
  return null;
}
function QuestionView({ slide, index, total, ordered, onSelect }: { slide: Slide; index: number; total: number; ordered: Slide[]; onSelect: (id: string) => void }) {
  const prev = ordered[index - 1], next = ordered[index + 1], read = READS[slide.id];
  return (
    <article className="qv">
      <div className="qv-kick"><span className="qv-q">{slide.qNum}</span><span>{slide.category}</span><span className="qv-pos">{String(index + 1).padStart(2, "0")} / {total}</span></div>
      <h3 className="qv-title">{slide.title}</h3>
      <p className="qv-sub">{slide.subtitle}</p>
      {slide.nets && <Readout nets={slide.nets} />}
      <div className="qv-chart"><QuestionChart slide={slide} /></div>
      {read && <p className="qv-read">{read}</p>}
      <div className="qv-nav">
        <button className="qv-step" disabled={!prev} onClick={() => prev && onSelect(prev.id)}><span>← Previous</span><b>{prev ? prev.title : "—"}</b></button>
        <button className="qv-step r" disabled={!next} onClick={() => next && onSelect(next.id)}><span>Next →</span><b>{next ? next.title : "—"}</b></button>
      </div>
    </article>
  );
}

// ═══ MAIN ═════════════════════════════════════════════════════════════════════
export default function TPSIPollDashboard() {
  const [pollId, setPollId] = useState<PollId>("national");
  const poll = POLLS.find(p => p.id === pollId)!;
  const categories = useMemo(() => getCategories(poll.slides), [poll]);
  const ordered = useMemo(() => poll.slides.filter(s => !s.isCover), [poll]);
  const [ids, setIds] = useState<Record<PollId, string>>(() =>
    Object.fromEntries(POLLS.map(p => [p.id, p.defaultSlide])) as Record<PollId, string>
  );
  const activeId = ids[pollId];
  const setActiveId = (id: string) => setIds(m => ({ ...m, [pollId]: id }));
  const index = Math.max(0, ordered.findIndex(s => s.id === activeId));
  const slide = ordered[index] ?? ordered[0];

  // deep links: ?poll=la|national|sd|sc&slide=<id>
  const booted = useRef(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get("poll") as PollId | null;
    const s = sp.get("slide");
    const def = p ? POLLS.find(x => x.id === p) : undefined;
    if (def) {
      setPollId(def.id);
      if (s && def.slides.some(sl => sl.id === s)) setIds(m => ({ ...m, [def.id]: s }));
    }
    booted.current = true;
  }, []);
  useEffect(() => {
    if (!booted.current) return;
    const sp = new URLSearchParams();
    sp.set("poll", pollId); sp.set("slide", slide.id);
    window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
    document.title = `${poll.tab} · TPSI Poll`;
  }, [pollId, slide.id, poll.tab]);

  return (
    <div className="tps">
      <style>{CSS}</style>

      <div className="shell"><DarkNav /></div>

      <div className="shell">
        <div className="reports" role="tablist" aria-label="Field reports">
          {POLLS.map(p => (
            <button key={p.id} role="tab" aria-selected={p.id === pollId} className={`rep${p.id === pollId ? " on" : ""}`} onClick={() => setPollId(p.id)}>
              <span className="rep-no">{p.no}</span>
              <span className="rep-name">{p.tab}</span>
              <span className="rep-date">{p.date}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="hero" key={`hero-${poll.id}`}>
        <div className="shell">
          <div className="eyebrow">{poll.eyebrow}</div>
          <h1 className="hero-h">{poll.h}</h1>
          <p className="hero-sub">{poll.sub}</p>
          <div className="hero-meta">{poll.meta.map((m, i) => <span key={i}><b>{m.b}</b> {m.t}</span>)}</div>
        </div>
      </section>

      <Electorate key={`elec-${poll.id}`} lenses={poll.lenses} intro={poll.intro} />

      <section className="survey">
        <div className="shell">
          <div className="sec-head"><div className="eyebrow">The full survey</div><h2 className="sec-h">{poll.secH}</h2></div>
          <div className="survey-grid">
            <Rail categories={categories} activeId={slide.id} onSelect={setActiveId} />
            <div key={`${poll.id}-${slide.id}`} className="survey-main"><QuestionView slide={slide} index={index} total={ordered.length} ordered={ordered} onSelect={setActiveId} /></div>
          </div>
        </div>
      </section>

      <div className="tps-foot"><div className="shell">
        <p><b>Methodology.</b> {poll.method}</p>
        <div className="tps-foot-org">The Public Sentiment Institute</div>
      </div></div>
    </div>
  );
}

// ═══ STYLES ═══════════════════════════════════════════════════════════════════
const CSS = `
  body { background: var(--background) !important; color: var(--foreground); overflow-x: clip; }
  body header, body footer { display: none !important; }
  body main > div { max-width: none !important; padding-left: 0 !important; padding-right: 0 !important; }
  body main > div > div { padding-top: 0 !important; padding-bottom: 0 !important; }

  .tps {
    --ink: var(--foreground); --lime: ${LIME};
    --m1: var(--muted); --m2: var(--muted2); --m3: var(--muted3);
    --line: var(--border); --line2: var(--border2); --surf: var(--panel);
    --ease: cubic-bezier(.16,1,.3,1);
    position: relative; min-height: 100vh; background: var(--background); color: var(--ink); overflow-x: clip;
    font-family: var(--font-body); letter-spacing: -0.01em;
    width: 100vw; margin-left: calc(50% - 50vw);
  }
  .tps::before { content: ''; position: absolute; top: -120px; left: 50%; transform: translateX(-50%); width: 900px; height: 600px; background: radial-gradient(closest-side, rgba(109,62,233,0.07), transparent 70%); pointer-events: none; }
  .tps h1, .tps h2, .tps h3, .tps h4 {
    font-family: var(--font-display);
    text-transform: none;
    margin: 0;
  }
  .tps p, .tps a, .tps button, .tps span, .tps div {
    font-family: var(--font-body);
    text-transform: none;
  }
  .tps .cup { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
  .shell { width: min(1100px, calc(100vw - 120px)); margin: 0 auto; }
  .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--m2); }
  .dim { color: var(--m2); }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes dot-in { from { opacity: 0; } to { opacity: 1; } }


  /* Field-report switcher */
  .reports { display: flex; flex-wrap: wrap; gap: 0; border-top: 1px solid var(--line2); border-bottom: 1px solid var(--line2); }
  .rep { position: relative; display: flex; flex-direction: column; gap: 3px; align-items: flex-start; padding: 16px 26px 17px 0; margin-right: 26px; background: none; border: none; cursor: pointer; text-align: left; }
  .rep::after { content: ''; position: absolute; left: 0; right: 26px; bottom: -1px; height: 1.5px; background: var(--brand-grad); transform: scaleX(0); transform-origin: left center; transition: transform .3s var(--ease); }
  .rep.on::after { transform: scaleX(1); }
  .rep-no { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; color: var(--m3); font-variant-numeric: tabular-nums; }
  .rep.on .rep-no { color: var(--lime); }
  .rep-name { font-size: 14.5px; font-weight: 600; letter-spacing: -0.01em; color: var(--m1); transition: color .15s ease; white-space: nowrap; }
  .rep:hover .rep-name, .rep.on .rep-name { color: var(--ink); }
  .rep-date { font-size: 11px; color: var(--m3); }

  /* Hero */
  .hero { position: relative; z-index: 2; padding: 64px 0 70px; }
  .hero .eyebrow { color: var(--lime); }
  .hero-h { margin: 26px 0 0; font-size: clamp(42px, 7vw, 92px); line-height: 0.98; font-weight: 500; letter-spacing: -0.035em; color: var(--ink); animation: rise .7s var(--ease) both; }
  .hero-sub { margin: 28px 0 0; max-width: 620px; font-size: clamp(17px, 1.8vw, 21px); line-height: 1.45; font-weight: 400; color: var(--m1); animation: rise .7s var(--ease) .08s both; }
  .hero-meta { display: flex; flex-wrap: wrap; gap: 14px 38px; margin-top: 42px; padding-top: 22px; border-top: 1px solid var(--line); animation: rise .7s var(--ease) .16s both; }
  .hero-meta span { font-size: 13px; color: var(--m2); } .hero-meta b { color: var(--ink); font-weight: 700; }

  /* Electorate */
  .elec { position: relative; z-index: 2; padding: 26px 0 80px; }
  .elec-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 24px; }
  .elec-h { margin: 16px 0 0; font-size: clamp(28px, 3.4vw, 44px); font-weight: 500; line-height: 1; letter-spacing: -0.03em; color: var(--ink); }
  .elec-intro { margin: 14px 0 0; max-width: 380px; font-size: 15px; line-height: 1.45; color: var(--m1); }
  .lens { display: flex; flex-wrap: wrap; gap: 7px; max-width: 540px; justify-content: flex-end; }
  .lens-pill { padding: 9px 15px; border-radius: 999px; border: 1px solid var(--line); background: var(--surf); color: var(--m1); font-family: inherit; font-size: 13px; font-weight: 600; letter-spacing: -0.01em; cursor: pointer; transition: all .18s var(--ease); }
  .lens-pill:hover { color: var(--ink); border-color: rgba(255,255,255,0.22); }
  .lens-pill.on { background: #f4f4ef; border-color: #6d3ee9; color: #050505; }

  .elec-stage { animation: rise .5s var(--ease) both; }
  .elec-readout { margin-top: 46px; }
  .elec-figure { display: flex; align-items: baseline; gap: 22px; flex-wrap: wrap; }
  .elec-big { font-size: clamp(58px, 9vw, 104px); font-weight: 700; line-height: 0.82; letter-spacing: -0.05em; }
  .elec-lead { display: flex; flex-direction: column; font-size: 22px; font-weight: 600; color: var(--ink); letter-spacing: -0.02em; }
  .elec-lead em { font-style: normal; font-size: 14px; font-weight: 400; color: var(--m2); margin-top: 4px; max-width: 320px; }
  .elec-q { margin-top: 18px; font-size: 15px; color: var(--m1); max-width: 560px; }

  .share { display: flex; align-items: stretch; gap: 5px; margin-top: 42px; }
  .share-col { display: flex; flex-direction: column; min-width: 0; }
  .share-seg { height: 74px; border-radius: 10px; transform-origin: left center; animation: grow-x .8s var(--ease) both; transition: background .55s ease, box-shadow .55s ease; }
  @keyframes grow-x { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }
  .share-lab { display: flex; flex-direction: column; gap: 3px; padding: 14px 4px 0; text-align: center; min-width: 0; }
  .share-lab b { font-size: 13px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .share-lab i { font-style: normal; font-size: 12px; font-weight: 600; color: var(--m2); font-variant-numeric: tabular-nums; }

  /* Survey */
  .survey { position: relative; z-index: 2; padding: 30px 0 90px; border-top: 1px solid var(--line2); }
  .sec-head { margin-bottom: 46px; }
  .sec-h { margin: 16px 0 0; font-size: clamp(28px, 3.4vw, 44px); font-weight: 500; line-height: 1; letter-spacing: -0.03em; color: var(--ink); }
  .survey-grid { display: grid; grid-template-columns: 234px 1fr; gap: 56px; align-items: start; }

  .rail { position: sticky; top: 24px; max-height: calc(100vh - 48px); overflow-y: auto; scrollbar-width: thin; }
  .rail-cat { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--m3); padding: 18px 0 8px; }
  .rail-group:first-child .rail-cat { padding-top: 0; }
  .rail-item { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; width: 100%; padding: 7px 0; background: none; border: none; cursor: pointer; text-align: left; }
  .rail-name { font-size: 13px; font-weight: 500; line-height: 1.3; color: var(--m1); transition: color .15s ease; }
  .rail-lead { font-size: 12px; font-weight: 700; color: var(--m3); font-variant-numeric: tabular-nums; }
  .rail-item:hover .rail-name { color: var(--ink); }
  .rail-item.on .rail-name { color: var(--ink); font-weight: 700; }

  .survey-main { min-width: 0; animation: rise .45s var(--ease) both; }
  .qv-kick { display: flex; align-items: center; gap: 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--m2); }
  .qv-q { color: var(--lime); }
  .qv-pos { margin-left: auto; color: var(--m3); }
  .qv-title { margin: 18px 0 0; font-size: clamp(26px, 3vw, 38px); font-weight: 500; line-height: 1.04; letter-spacing: -0.03em; color: var(--ink); }
  .qv-sub { margin: 14px 0 0; max-width: 60ch; font-size: 14px; line-height: 1.5; color: var(--m2); }

  .readout { display: flex; flex-wrap: wrap; gap: 36px; margin: 34px 0 6px; }
  .rd-val { font-size: 40px; font-weight: 700; line-height: 1; letter-spacing: -0.04em; }
  .rd-lbl { margin-top: 8px; font-size: 12px; font-weight: 600; color: var(--m2); }

  .qv-chart { margin-top: 34px; }
  .rc { display: flex; flex-direction: column; }
  .rc-glabel { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--m3); padding: 18px 0 8px; }
  .rc-row { display: grid; grid-template-columns: 196px 1fr 62px; align-items: center; gap: 18px; padding: 11px 0; border-bottom: 1px solid var(--line2); }
  .rc-row:last-child { border-bottom: none; }
  .rc-name { font-size: 13.5px; color: var(--m1); text-align: right; line-height: 1.25; } .rc-row.lead .rc-name { color: var(--ink); font-weight: 600; }
  .rc-track { height: 8px; background: var(--surf); border-radius: 999px; overflow: hidden; }
  .rc-fill { height: 100%; border-radius: 999px; transition: width .8s var(--ease); }
  .rc-pct { font-size: 17px; font-weight: 700; text-align: right; color: var(--m1); font-variant-numeric: tabular-nums; } .rc-pct i { font-style: normal; font-size: 0.62em; color: var(--m3); margin-left: 1px; }
  .rc-row.lead .rc-pct { font-size: 21px; }

  .dv { display: flex; flex-direction: column; gap: 16px; }
  .dv-poles { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; }
  .dv-net { font-weight: 700; font-variant-numeric: tabular-nums; }
  .dv-bar { position: relative; display: grid; grid-template-columns: 1fr 1fr; height: 42px; }
  .dv-spine { position: absolute; left: 50%; top: -6px; bottom: -6px; width: 1px; background: var(--line); z-index: 3; }
  .dv-side { display: flex; height: 100%; align-items: center; } .dv-side.l { justify-content: flex-end; } .dv-side.r { justify-content: flex-start; }
  .dv-seg { height: 100%; transition: width .8s var(--ease); } .dv-side.l .dv-seg:first-child { border-radius: 4px 0 0 4px; } .dv-side.r .dv-seg:last-child { border-radius: 0 4px 4px 0; }
  .dv-legend { display: flex; flex-wrap: wrap; gap: 8px 18px; padding-top: 16px; border-top: 1px solid var(--line2); }
  .dv-chip { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--m1); }
  .dv-chip i { width: 9px; height: 9px; border-radius: 2px; } .dv-chip b { font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }

  .mx { display: flex; flex-direction: column; }
  .mx-head { display: grid; grid-template-columns: 168px 1fr 50px; align-items: center; gap: 16px; padding-bottom: 11px; border-bottom: 1px solid var(--line); }
  .mx-poles { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; } .mx-poles i { font-style: normal; }
  .mx-neth { font-size: 11px; font-weight: 600; color: var(--m2); text-align: right; }
  .mx-row { display: grid; grid-template-columns: 168px 1fr 50px; align-items: center; gap: 16px; padding: 11px 0; border-bottom: 1px solid var(--line2); } .mx-row:last-child { border-bottom: none; }
  .mx-name { font-size: 13px; color: var(--ink); text-align: right; line-height: 1.25; }
  .mx-bar { position: relative; display: grid; grid-template-columns: 1fr 1fr; height: 16px; } .mx-bar .dv-side { gap: 8px; } .mx-bar .dv-seg { height: 100%; border-radius: 2px; }
  .mx-val { font-size: 11px; font-weight: 600; color: var(--m2); font-variant-numeric: tabular-nums; }
  .mx-net { font-size: 16px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }

  .iss { display: flex; flex-direction: column; }
  .iss-row { display: grid; grid-template-columns: 36px 1fr 150px 58px; align-items: center; gap: 18px; padding: 14px 0; border-bottom: 1px solid var(--line2); } .iss-row:last-child { border-bottom: none; } .iss-row.top { padding: 18px 0; }
  .iss-rank { font-size: 13px; font-weight: 700; color: var(--m3); font-variant-numeric: tabular-nums; } .iss-row.top .iss-rank { color: var(--lime); }
  .iss-label { font-size: 13.5px; color: var(--m1); line-height: 1.3; display: flex; flex-direction: column; gap: 4px; } .iss-row.top .iss-label { color: var(--ink); font-weight: 600; font-size: 16px; }
  .iss-tag { font-size: 9.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--m3); } .iss-row.top .iss-tag { color: var(--lime); }
  .iss-track { height: 8px; background: var(--surf); border-radius: 999px; overflow: hidden; } .iss-fill { height: 100%; border-radius: 999px; transition: width .8s var(--ease); }
  .iss-pct { font-size: 18px; font-weight: 700; text-align: right; color: var(--m1); font-variant-numeric: tabular-nums; } .iss-pct i { font-style: normal; font-size: 0.6em; color: var(--m3); } .iss-row.top .iss-pct { font-size: 24px; }

  .qv-read { margin: 36px 0 0; padding-top: 22px; border-top: 1px solid var(--line); max-width: 62ch; font-size: 17px; line-height: 1.5; font-weight: 400; color: var(--m1); }
  .qv-read::before { content: '“'; color: var(--lime); } .qv-read::after { content: '”'; color: var(--lime); }
  .qv-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 40px; padding-top: 22px; border-top: 1px solid var(--line2); }
  .qv-step { display: flex; flex-direction: column; gap: 6px; padding: 0; background: none; border: none; cursor: pointer; text-align: left; } .qv-step.r { text-align: right; align-items: flex-end; }
  .qv-step:disabled { opacity: 0.3; cursor: default; }
  .qv-step span { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--m2); }
  .qv-step b { font-size: 15px; font-weight: 500; color: var(--m1); transition: color .15s ease; } .qv-step:not(:disabled):hover b { color: var(--lime); }

  .tps-foot { position: relative; z-index: 2; padding: 40px 0 70px; border-top: 1px solid var(--line2); }
  .tps-foot p { font-size: 12.5px; line-height: 1.65; color: var(--m2); max-width: 80ch; margin: 0; } .tps-foot b { color: var(--m1); font-weight: 700; }
  .tps-foot-org { margin-top: 28px; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; color: var(--m3); }

  @media (max-width: 920px) {
    .shell, .tps-nav { width: calc(100vw - 44px); }
    .elec-head { flex-direction: column; align-items: flex-start; } .lens { justify-content: flex-start; max-width: none; }
    .survey-grid { grid-template-columns: 1fr; gap: 30px; }
    .rail { position: static; max-height: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0 22px; }
  }
  @media (max-width: 600px) {
    .rc-row { grid-template-columns: 1fr 52px; } .rc-name { grid-column: 1 / -1; text-align: left; padding-bottom: 4px; } .rc-track { grid-column: 1; } .rc-pct { grid-column: 2; }
    .mx-head { display: none; } .mx-row { grid-template-columns: 1fr 46px; row-gap: 6px; } .mx-name { grid-column: 1 / -1; text-align: left; } .mx-bar { grid-column: 1; } .mx-net { grid-column: 2; }
    .iss-row { grid-template-columns: 28px 1fr 48px; row-gap: 8px; } .iss-track { grid-column: 2 / -1; }
    .readout { gap: 24px; } .qv-nav { grid-template-columns: 1fr; } .qv-step.r { text-align: left; align-items: flex-start; }
    .elec-figure { flex-direction: column; align-items: flex-start; gap: 8px; }
  }
  @media (prefers-reduced-motion: reduce) { .tps *, .tps *::before, .ef-dot { transition: none !important; animation: none !important; } }
`;
