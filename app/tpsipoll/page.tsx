"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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
  muted:     "rgba(238,238,255,0.42)",
  neutral:   "rgba(238,238,255,0.2)",
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
    id:"q3", qNum:"Q3", category:"Voter Behavior",
    title:"Voter Motivation — 2026 Midterm Election",
    subtitle:"How would you describe your intention and motivation to vote? · N=309 · LV Weighted",
    nets:[
      { val:"98%", lbl:"Certain / Very Likely",    color:C.green },
      { val:"85%", lbl:"Certain + Highly Motivated", color:C.blue },
    ],
    bars:[
      { label:"Certain to vote & highly motivated", pct:85, color:C.green, strong:true },
      { label:"Very likely to vote & feel motivated", pct:13, color:C.blue },
      { label:"Somewhat likely, not strongly motivated", pct:2, color:C.gold },
      { label:"Motivated but unsure if will vote", pct:0, color:C.muted },
      { label:"Not very likely, little motivation", pct:0, color:C.muted },
      { label:"Certain not to vote", pct:0, color:C.muted },
    ],
  },

  {
    id:"q4", qNum:"Q4", category:"Voter Behavior",
    title:"How Do You Plan to Cast Your Ballot?",
    subtitle:"2026 Midterm Election · N=309 · LV Weighted",
    bars:[
      { label:"In person Election Day — know polling location", pct:54, color:C.blue, strong:true },
      { label:"Mail-in — already requested/received",           pct:14, color:C.blue },
      { label:"Early in-person — know when/where",             pct:10, color:C.green },
      { label:"Drop box",                                       pct:8,  color:C.purpleLt },
      { label:"In person Election Day — need to confirm",      pct:6,  color:C.cyan },
      { label:"Mail-in — plan to request",                     pct:3,  color:C.gold },
      { label:"Early in-person — need to look up",             pct:3,  color:C.orange },
      { label:"Haven't decided how I will vote",               pct:1,  color:C.muted },
      { label:"Do not plan to vote",                            pct:0,  color:C.muted },
    ],
  },

  {
    id:"q5", qNum:"Q5", category:"Voter Behavior",
    title:"Social Circle Turnout Expectation",
    subtitle:"How many of the 5–10 closest people to you do you expect to vote? · N=309 · LV",
    bars:[
      { label:"All or nearly all of them", pct:63, color:C.green, strong:true },
      { label:"Most of them",              pct:29, color:C.blue },
      { label:"About half",                pct:5,  color:C.gold },
      { label:"Not sure",                  pct:2,  color:C.muted },
      { label:"A few of them",             pct:1,  color:C.orange },
      { label:"None of them",              pct:0,  color:C.muted },
    ],
  },

  {
    id:"q6", qNum:"Q6", category:"2024 Presidential Election",
    title:"Who Did You Vote for in 2024?",
    subtitle:"Presidential Recall Vote · N=309 · LV Weighted",
    nets:[
      { val:"57%",  lbl:"Kamala Harris", color:C.blue },
      { val:"42%",  lbl:"Donald Trump",  color:C.pink },
      { val:"D+15", lbl:"LV Advantage",  color:C.blue },
    ],
    bars:[
      { label:"Kamala Harris", pct:57, color:C.blue, strong:true },
      { label:"Donald Trump",  pct:42, color:C.pink, strong:true },
      { label:"Third party",   pct:1,  color:C.purpleLt },
      { label:"Did not vote",  pct:0,  color:C.muted },
    ],
  },

  {
    id:"q7", qNum:"Q7", category:"Issue Priority",
    title:"Issue Priority Ranking",
    subtitle:"% who ranked each issue #1 (most important) · N=309 · LV Weighted",
    rankTable:[
      { label:"Economy, Jobs & Cost of Living",              pct1:47, color:C.gold,    rank:"Most Important" },
      { label:"Political Corruption, Lobbying & Money",      pct1:14, color:C.blue,    rank:"#2 Choice" },
      { label:"Energy, Climate & the Environment",           pct1:8,  color:C.green,   rank:"#3 Choice" },
      { label:"Healthcare, Social Security & Medicare",      pct1:7,  color:C.cyan,    rank:"#4 Choice" },
      { label:"Guns & Second Amendment Rights",              pct1:7,  color:C.pink,    rank:"#5 Choice" },
      { label:"Immigration & Border Security",               pct1:6,  color:C.pink,    rank:"#6 Choice" },
      { label:"Crime, Public Safety & Policing",             pct1:4,  color:C.orange,  rank:"#7 Choice" },
      { label:"Foreign Policy & National Security",          pct1:3,  color:C.purpleLt,rank:"#8 Choice" },
      { label:"Education, Housing & Family Issues",          pct1:3,  color:C.purpleLt,rank:"#9 Choice" },
      { label:"Civil Rights, Personal Freedoms & Social",   pct1:2,  color:C.muted,   rank:"#10 Choice" },
    ],
  },

  {
    id:"q8", qNum:"Q8", category:"Political Identity",
    title:"General Political Outlook",
    subtitle:"Which best describes your political outlook? · N=309 · LV Weighted",
    bars:[
      { label:"Moderate Democrat",            pct:22, color:C.blue,    strong:true, group:"DEMOCRAT" },
      { label:"Liberal Democrat",             pct:14, color:C.blue },
      { label:"Progressive Democrat",         pct:13, color:C.blue },
      { label:"Conservative Republican",      pct:15, color:C.pink,    strong:true, group:"REPUBLICAN" },
      { label:"Moderate Republican",          pct:10, color:C.pink },
      { label:"America First Republican",     pct:4,  color:C.pink },
      { label:"Lean Democratic Independent",  pct:7,  color:C.purpleLt, strong:true, group:"INDEPENDENT" },
      { label:"Lean Republican Independent",  pct:6,  color:C.purpleLt },
      { label:"Pure Independent",             pct:6,  color:C.purpleLt },
      { label:"None / No clear preference",   pct:3,  color:C.muted },
    ],
  },

  {
    id:"q9", qNum:"Q9", category:"Party Registration",
    title:"Which Party Are You Registered With?",
    subtitle:"N=309 · LV Weighted",
    nets:[
      { val:"50%",  lbl:"Democrat",           color:C.blue },
      { val:"31%",  lbl:"Republican",         color:C.pink },
      { val:"19%",  lbl:"Independent/Other",  color:C.purpleLt },
      { val:"D+19", lbl:"LV Reg. Advantage",  color:C.blue },
    ],
    bars:[
      { label:"Democrat",           pct:50, color:C.blue,    strong:true },
      { label:"Republican",         pct:31, color:C.pink,    strong:true },
      { label:"Independent / Other",pct:19, color:C.purpleLt },
    ],
  },

  {
    id:"q10", qNum:"Q10", category:"Democratic Primary",
    title:"Democratic Primary — MD 6th CD",
    subtitle:"Registered Democrats only · N=154 · LV Weighted",
    nets:[
      { val:"51%", lbl:"David Trone",   color:C.blue },
      { val:"30%", lbl:"April Delaney", color:C.cyan },
      { val:"15%", lbl:"Undecided",     color:C.muted },
    ],
    bars:[
      { label:"David Trone",          pct:51, color:C.blue,   strong:true },
      { label:"April McClain Delaney",pct:30, color:C.cyan },
      { label:"Undecided / Not sure", pct:15, color:C.muted },
      { label:"Ethan Wechtaluk",      pct:1,  color:C.orange },
      { label:"George Gluck",         pct:1,  color:C.orange },
      { label:"Alexis Goldstein",     pct:1,  color:C.muted },
      { label:"Daniel Krakower",      pct:1,  color:C.muted },
    ],
  },

  {
    id:"q11", qNum:"Q11", category:"Republican Primary",
    title:"Republican Primary — MD 6th CD",
    subtitle:"Registered Republicans only · N=95 · LV Weighted",
    nets:[
      { val:"54%", lbl:"Undecided",    color:C.muted },
      { val:"29%", lbl:"Robin Ficker", color:C.pink },
      { val:"16%", lbl:"Chris Burnett",color:C.pink },
    ],
    bars:[
      { label:"Undecided / Not sure",pct:54, color:C.neutral },
      { label:"Robin Ficker",        pct:29, color:C.pink, strong:true },
      { label:"Chris Burnett",       pct:16, color:C.pink },
      { label:"Maria Roca",          pct:1,  color:C.pink },
    ],
  },

  {
    id:"q12", qNum:"Q12", category:"General Election Ballot Test",
    title:"Delaney vs. Generic Republican",
    subtitle:"April McClain Delaney (D) vs. Generic Republican · N=309 · LV Weighted",
    nets:[
      { val:"55%",  lbl:"Delaney (D)",       color:C.blue },
      { val:"31%",  lbl:"Generic Republican", color:C.pink },
      { val:"D+24", lbl:"LV Advantage",      color:C.blue },
    ],
    bars:[
      { label:"April McClain Delaney (Democrat)", pct:55, color:C.blue, strong:true },
      { label:"Generic Republican",               pct:31, color:C.pink, strong:true },
      { label:"Undecided / Not sure",             pct:15, color:C.muted },
    ],
  },

  {
    id:"q13", qNum:"Q13", category:"General Election Ballot Test",
    title:"Trone vs. Generic Republican",
    subtitle:"David Trone (D) vs. Generic Republican · N=309 · LV Weighted",
    nets:[
      { val:"59%",  lbl:"Trone (D)",         color:C.blue },
      { val:"31%",  lbl:"Generic Republican", color:C.pink },
      { val:"D+28", lbl:"LV Advantage",      color:C.blue },
    ],
    bars:[
      { label:"David Trone (Democrat)", pct:59, color:C.blue, strong:true },
      { label:"Generic Republican",     pct:31, color:C.pink, strong:true },
      { label:"Undecided / Not sure",   pct:10, color:C.muted },
    ],
  },

  {
    id:"q14", qNum:"Q14", category:"Candidate Favorability",
    title:"David Trone — Favorability",
    subtitle:"Do you approve of Former Representative David Trone? · N=309 · LV Weighted",
    nets:[
      { val:"64%", lbl:"NET Approve",    color:C.green },
      { val:"25%", lbl:"NET Disapprove", color:C.pink },
      { val:"+39", lbl:"Net Favorability", color:C.green },
    ],
    bars:[
      { label:"Somewhat approve",    pct:44, color:C.green,   group:"APPROVE" },
      { label:"Strongly approve",    pct:20, color:C.green,   strong:true },
      { label:"Strongly disapprove", pct:17, color:C.pink,    strong:true, group:"DISAPPROVE" },
      { label:"Somewhat disapprove", pct:8,  color:C.pink },
      { label:"Neutral / No opinion",pct:10, color:C.muted,   group:"NEUTRAL" },
    ],
  },

  {
    id:"q15", qNum:"Q15", category:"Candidate Favorability",
    title:"April McClain Delaney — Favorability",
    subtitle:"Do you approve of Representative April McClain Delaney? · N=309 · LV Weighted",
    nets:[
      { val:"60%", lbl:"NET Approve",    color:C.green },
      { val:"24%", lbl:"NET Disapprove", color:C.pink },
      { val:"+36", lbl:"Net Favorability", color:C.green },
    ],
    bars:[
      { label:"Somewhat approve",    pct:38, color:C.green,   group:"APPROVE" },
      { label:"Strongly approve",    pct:22, color:C.green,   strong:true },
      { label:"Strongly disapprove", pct:15, color:C.pink,    strong:true, group:"DISAPPROVE" },
      { label:"Somewhat disapprove", pct:9,  color:C.pink },
      { label:"Neutral / No opinion",pct:16, color:C.muted,   group:"NEUTRAL" },
    ],
  },

  {
    id:"q16", qNum:"Q16", category:"Governor Approval",
    title:"Gov. Wes Moore — Approval Rating",
    subtitle:"Do you approve of Governor Wes Moore? · N=309 · LV Weighted",
    nets:[
      { val:"65%", lbl:"NET Approve",    color:C.green },
      { val:"27%", lbl:"NET Disapprove", color:C.pink },
      { val:"+38", lbl:"Net Approval",   color:C.green },
    ],
    bars:[
      { label:"Somewhat approve",    pct:37, color:C.green,   group:"APPROVE" },
      { label:"Strongly approve",    pct:28, color:C.green,   strong:true },
      { label:"Strongly disapprove", pct:20, color:C.pink,    strong:true, group:"DISAPPROVE" },
      { label:"Somewhat disapprove", pct:7,  color:C.pink },
      { label:"Neutral / No opinion",pct:8,  color:C.muted,   group:"NEUTRAL" },
    ],
  },

  {
    id:"q17", qNum:"Q17", category:"Presidential Approval",
    title:"Trump — Overall Presidential Approval",
    subtitle:"Do you approve or disapprove of Donald J. Trump's performance as President? · N=309 · LV",
    nets:[
      { val:"63%", lbl:"NET Disapprove", color:C.pink },
      { val:"34%", lbl:"NET Approve",    color:C.green },
      { val:"−29", lbl:"Net Approval",   color:C.pink },
    ],
    bars:[
      { label:"Strongly disapprove", pct:52, color:C.pink,  strong:true, group:"DISAPPROVE" },
      { label:"Somewhat disapprove", pct:11, color:C.pink },
      { label:"Strongly approve",    pct:20, color:C.green,  strong:true, group:"APPROVE" },
      { label:"Somewhat approve",    pct:14, color:C.green },
      { label:"Neutral / No opinion",pct:3,  color:C.muted,  group:"NEUTRAL" },
    ],
  },

  {
    id:"q18", qNum:"Q18", category:"Trump Issue-by-Issue Approval",
    title:"Trump Approval by Issue",
    subtitle:"NET Approve vs. NET Disapprove per issue · N=309 · LV Weighted · Sorted by disapproval",
    issueTable:[
      { issue:"Political Corruption, Lobbying & Money",         disApprove:67, approve:29 },
      { issue:"Healthcare, Social Security & Medicare",         disApprove:65, approve:33 },
      { issue:"Civil Rights, Personal Freedoms & Social Issues",disApprove:61, approve:37 },
      { issue:"Energy, Climate & the Environment",              disApprove:61, approve:36 },
      { issue:"Foreign Policy & National Security",             disApprove:60, approve:38 },
      { issue:"Economy, Jobs & Cost of Living",                 disApprove:60, approve:39 },
      { issue:"Education, Housing & Family Issues",             disApprove:59, approve:39 },
      { issue:"Crime, Public Safety & Policing",                disApprove:55, approve:44 },
      { issue:"Immigration & Border Security",                  disApprove:58, approve:42 },
      { issue:"Guns & Second Amendment Rights",                 disApprove:53, approve:45 },
    ],
  },

  {
    id:"q19", qNum:"Q19", category:"Trump Approval",
    title:"Trump — Handling of the Epstein Files",
    subtitle:"Do you approve or disapprove of Trump's handling of the Epstein Files? · N=309 · LV",
    nets:[
      { val:"66%", lbl:"NET Disapprove", color:C.pink },
      { val:"24%", lbl:"NET Approve",    color:C.green },
      { val:"−42", lbl:"Net Approval",   color:C.pink },
    ],
    bars:[
      { label:"Strongly disapprove", pct:57, color:C.pink,  strong:true, group:"DISAPPROVE" },
      { label:"Somewhat disapprove", pct:9,  color:C.pink },
      { label:"Somewhat approve",    pct:13, color:C.green,  group:"APPROVE" },
      { label:"Strongly approve",    pct:11, color:C.green,  strong:true },
      { label:"Neutral / No opinion",pct:10, color:C.muted,  group:"NEUTRAL" },
    ],
  },

  {
    id:"q20", qNum:"Q20", category:"Trump Approval",
    title:"Trump — Action Against Iran",
    subtitle:"Do you approve or disapprove of Trump's action against Iran? · N=309 · LV Weighted",
    nets:[
      { val:"63%", lbl:"NET Disapprove", color:C.pink },
      { val:"32%", lbl:"NET Approve",    color:C.green },
      { val:"−31", lbl:"Net Approval",   color:C.pink },
    ],
    bars:[
      { label:"Strongly disapprove", pct:54, color:C.pink,  strong:true, group:"DISAPPROVE" },
      { label:"Somewhat disapprove", pct:9,  color:C.pink },
      { label:"Strongly approve",    pct:19, color:C.green,  strong:true, group:"APPROVE" },
      { label:"Somewhat approve",    pct:13, color:C.green },
      { label:"Neutral / No opinion",pct:4,  color:C.muted,  group:"NEUTRAL" },
    ],
  },

  {
    id:"q21", qNum:"Q21", category:"Candidate Character",
    title:"Israel PAC Donations",
    subtitle:"If a candidate accepted donations from a PAC supporting Israel, more or less likely to vote for them? · N=309 · LV",
    nets:[
      { val:"31%", lbl:"NET Less Likely",  color:C.pink },
      { val:"27%", lbl:"NET More Likely",  color:C.green },
      { val:"42%", lbl:"No Difference",   color:C.muted },
    ],
    bars:[
      { label:"No difference / No opinion", pct:42, color:C.neutral, group:"NO DIFFERENCE" },
      { label:"Somewhat less likely",        pct:17, color:C.pink,   group:"LESS LIKELY" },
      { label:"Much less likely",            pct:14, color:C.pink,   strong:true },
      { label:"Somewhat more likely",        pct:16, color:C.green,  group:"MORE LIKELY" },
      { label:"Much more likely",            pct:11, color:C.green,  strong:true },
    ],
  },
];

// ─── Shared styles ────────────────────────────────────────────────────────────
const font = { mono:"'IBM Plex Mono', monospace", sans:"'IBM Plex Sans', sans-serif", display:"'Bebas Neue', sans-serif" };
const triStripe = { height:3, background:"linear-gradient(90deg,#e63946 0%,#e63946 33.33%,#7c3aed 33.33%,#7c3aed 66.66%,#2563eb 66.66%,#2563eb 100%)" };

// ─── Sub-components ───────────────────────────────────────────────────────────
function TriStripe({ mx = 0, mb = 24 }: { mx?: number; mb?: number }) {
  return <div style={{ ...triStripe, margin: `0 ${-mx}px ${mb}px` }} />;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, fontFamily:font.mono, fontSize:8, letterSpacing:"0.22em", textTransform:"uppercase", color:C.purpleLt, marginBottom:8 }}>
      <div style={{ width:16, height:1, background:C.purpleLt }} />
      {children}
    </div>
  );
}

function SlideTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily:font.display, fontSize:"clamp(22px,3vw,36px)", letterSpacing:"0.04em", lineHeight:1.05, color:"#eeeeff", marginBottom:4 }}>{children}</div>;
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily:font.mono, fontSize:9, letterSpacing:"0.08em", color:"rgba(238,238,255,0.3)", marginBottom:18 }}>{children}</div>;
}

function Nets({ nets }: { nets: NetStat[] }) {
  return (
    <div style={{ display:"flex", alignItems:"stretch", gap:0, marginBottom:22, border:"1px solid rgba(255,255,255,0.07)", background:"#111120", width:"fit-content" }}>
      {nets.map((n, i) => (
        <div key={i} style={{ padding:"12px 22px", borderRight: i < nets.length-1 ? "1px solid rgba(255,255,255,0.07)" : undefined }}>
          <div style={{ fontFamily:font.display, fontSize:32, letterSpacing:"0.04em", lineHeight:1, color:n.color }}>{n.val}</div>
          <div style={{ fontFamily:font.mono, fontSize:7.5, letterSpacing:"0.14em", textTransform:"uppercase", color:C.muted, marginTop:2 }}>{n.lbl}</div>
        </div>
      ))}
    </div>
  );
}

function BarChart({ bars }: { bars: BarRow[] }) {
  const groups: { name: string; rows: BarRow[] }[] = [];
  let cur: { name: string; rows: BarRow[] } | null = null;
  bars.forEach(r => {
    if (r.group && (!cur || cur.name !== r.group)) { cur = { name:r.group, rows:[] }; groups.push(cur); }
    else if (!cur) { cur = { name:"", rows:[] }; groups.push(cur); }
    cur!.rows.push(r);
  });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0, maxWidth:700 }}>
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom:14 }}>
          {g.name && (
            <div style={{ fontFamily:font.mono, fontSize:7.5, letterSpacing:"0.2em", textTransform:"uppercase", color:"rgba(238,238,255,0.28)", padding:"8px 0 5px 232px", borderBottom:"1px solid rgba(255,255,255,0.05)", marginBottom:2 }}>{g.name}</div>
          )}
          {g.rows.map((row, ri) => (
            <div key={ri} style={{ display:"grid", gridTemplateColumns:"220px 1fr 52px", alignItems:"center", gap:12, padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize:12, color:"rgba(238,238,255,0.75)", textAlign:"right", lineHeight:1.35 }}>{row.label}</div>
              <div style={{ height:26, background:"rgba(255,255,255,0.04)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${row.pct}%`, background:row.color, opacity:row.strong?1:0.65, transition:"width 0.6s cubic-bezier(0.16,1,0.3,1)", borderRadius:2 }} />
              </div>
              <div style={{ fontFamily:font.mono, fontSize:13, fontWeight:600, color:row.strong ? row.color : "rgba(238,238,255,0.5)" }}>{row.pct}%</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function IssueTable({ rows }: { rows: IssueRow[] }) {
  const maxDis = Math.max(...rows.map(r => r.disApprove));
  return (
    <table style={{ width:"100%", maxWidth:720, borderCollapse:"collapse" }}>
      <thead>
        <tr>
          <th style={{ fontFamily:font.mono, fontSize:7.5, letterSpacing:"0.14em", textTransform:"uppercase", color:C.muted, padding:"6px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", textAlign:"left" }}>Issue</th>
          <th style={{ fontFamily:font.mono, fontSize:7.5, letterSpacing:"0.14em", textTransform:"uppercase", color:C.pink, padding:"6px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", textAlign:"right" }}>NET Disapprove</th>
          <th style={{ fontFamily:font.mono, fontSize:7.5, letterSpacing:"0.14em", textTransform:"uppercase", color:C.green, padding:"6px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", textAlign:"right" }}>NET Approve</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <td style={{ padding:"9px 12px", fontSize:12, color:"#eeeeff" }}>{r.issue}</td>
            <td style={{ padding:"9px 12px", textAlign:"right" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, justifyContent:"flex-end" }}>
                <div style={{ width:72, height:4, background:"rgba(255,255,255,0.06)", borderRadius:1, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(r.disApprove/maxDis)*100}%`, background:C.pink, borderRadius:1 }} />
                </div>
                <span style={{ fontFamily:font.mono, fontSize:11, fontWeight:600, color:C.pink, width:32, textAlign:"right" }}>{r.disApprove}%</span>
              </div>
            </td>
            <td style={{ padding:"9px 12px", textAlign:"right" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, justifyContent:"flex-end" }}>
                <div style={{ width:72, height:4, background:"rgba(255,255,255,0.06)", borderRadius:1, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${r.approve}%`, background:C.green, borderRadius:1 }} />
                </div>
                <span style={{ fontFamily:font.mono, fontSize:11, fontWeight:600, color:C.green, width:32, textAlign:"right" }}>{r.approve}%</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RankTable({ rows }: { rows: NonNullable<Slide["rankTable"]> }) {
  return (
    <table style={{ width:"100%", maxWidth:720, borderCollapse:"collapse" }}>
      <thead>
        <tr>
          <th style={{ fontFamily:font.mono, fontSize:7.5, letterSpacing:"0.14em", textTransform:"uppercase", color:C.muted, padding:"6px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", textAlign:"left" }}>Issue</th>
          <th style={{ fontFamily:font.mono, fontSize:7.5, letterSpacing:"0.14em", textTransform:"uppercase", color:C.muted, padding:"6px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", textAlign:"right" }}>% Ranked #1</th>
          <th style={{ fontFamily:font.mono, fontSize:7.5, letterSpacing:"0.14em", textTransform:"uppercase", color:C.muted, padding:"6px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", textAlign:"center" }}>Priority</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <td style={{ padding:"9px 12px", fontSize:12, color:"#eeeeff" }}>{r.label}</td>
            <td style={{ padding:"9px 12px", textAlign:"right" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, justifyContent:"flex-end" }}>
                <div style={{ width:100, height:4, background:"rgba(255,255,255,0.06)", borderRadius:1, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${r.pct1*2.1}%`, background:r.color, borderRadius:1 }} />
                </div>
                <span style={{ fontFamily:font.mono, fontSize:11, fontWeight:600, color:r.color, width:34, textAlign:"right" }}>{r.pct1}%</span>
              </div>
            </td>
            <td style={{ padding:"9px 12px", textAlign:"center" }}>
              <span style={{ fontFamily:font.mono, fontSize:8, fontWeight:700, padding:"2px 8px", borderRadius:2, background:i===0?"rgba(247,217,79,0.2)":"rgba(37,99,235,0.1)", color:i===0?C.gold:"rgba(238,238,255,0.4)" }}>{r.rank}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CoverSlide() {
  const contents = [
    ["Voter Motivation & Ballot Method","Q3–Q5"],
    ["2024 Presidential Recall","Q6"],
    ["Issue Priority Ranking","Q7"],
    ["Political Identity & Party","Q8–Q9"],
    ["Democratic & Republican Primaries","Q10–Q11"],
    ["General Election Ballot Tests","Q12–Q13"],
    ["Candidate Favorability","Q14–Q15"],
    ["Gov. Moore Approval","Q16"],
    ["Trump Approval — Overall & Issues","Q17–Q18"],
    ["Trump — Epstein & Iran","Q19–Q20"],
    ["Israel PAC Donations","Q21"],
  ];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:36, flex:1, alignItems:"center" }}>
      <div>
        <div style={{ fontFamily:font.mono, fontSize:8, letterSpacing:"0.2em", textTransform:"uppercase", color:C.purpleLt, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:16, height:1, background:C.purpleLt }} />
          Maryland's 6th Congressional District · LV · April 2026
        </div>
        <div style={{ fontFamily:font.display, fontSize:"clamp(38px,6vw,76px)", letterSpacing:"0.03em", lineHeight:0.95, textTransform:"uppercase", marginBottom:18 }}>
          TRACKING<br />WHAT <span style={{ color:C.blue }}>MARYLAND</span><br /><span style={{ color:C.pink }}>THINKS.</span>
        </div>
        <p style={{ fontFamily:font.mono, fontSize:10, lineHeight:1.8, color:C.muted, marginBottom:22, maxWidth:460, letterSpacing:"0.03em" }}>
          LV weighted · Score-favoring sigmoid · N=309 likely voters<br />
          Pollfish platform · April 2026 · 21 questions
        </p>
        <div style={{ display:"flex", gap:0, border:"1px solid rgba(255,255,255,0.07)" }}>
          {[["309","Total N (LV)","#2563eb"],["21","Questions","#e63946"],["5","Wave","#f7d94f"],["LV","Weight","#2fe4a0"]].map(([v,l,color],i)=>(
            <div key={i} style={{ padding:"12px 18px", borderRight:i<3?"1px solid rgba(255,255,255,0.07)":undefined }}>
              <div style={{ fontFamily:font.display, fontSize:26, letterSpacing:"0.04em", lineHeight:1, color }}>{v}</div>
              <div style={{ fontFamily:font.mono, fontSize:7, letterSpacing:"0.15em", textTransform:"uppercase", color:C.muted, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:"#111120", border:"1px solid rgba(255,255,255,0.07)", padding:18 }}>
        <div style={{ fontFamily:font.mono, fontSize:7, letterSpacing:"0.2em", textTransform:"uppercase", color:"rgba(238,238,255,0.28)", marginBottom:10, paddingBottom:8, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>Contents</div>
        {contents.map(([label,q],i)=>(
          <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,0.03)", fontFamily:font.mono, fontSize:9, color:C.muted }}>
            <span style={{ color:"#eeeeff" }}>{label}</span>
            <span style={{ color:C.purpleLt }}>{q}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TPSILVSlideshow() {
  const [cur, setCur] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const total = SLIDES.length;

  const goTo = useCallback((idx: number) => {
    setExiting(true);
    setTimeout(() => { setCur(((idx%total)+total)%total); setExiting(false); }, 300);
  }, [total]);

  const next = useCallback(() => { if (cur < total-1) goTo(cur+1); }, [cur, total, goTo]);
  const prev = useCallback(() => { if (cur > 0) goTo(cur-1); }, [cur, goTo]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key==="ArrowRight"||e.key===" ") next();
      if (e.key==="ArrowLeft") prev();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [next, prev]);

  useEffect(() => {
    if (!autoplay) return;
    const t = setInterval(() => setCur(c => c < total-1 ? c+1 : 0), 5000);
    return () => clearInterval(t);
  }, [autoplay, total]);

  const slide = SLIDES[cur];
  const MX = 44; // horizontal padding in px

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 64px)", background:"#09090f", color:"#eeeeff", fontFamily:font.sans, fontWeight:300, overflow:"hidden", position:"relative" }}>

      {/* ── TOOLBAR ── */}
      <div style={{ height:44, display:"flex", alignItems:"center", gap:14, padding:"0 22px", borderBottom:"1px solid rgba(255,255,255,0.07)", background:"rgba(9,9,15,0.96)", backdropFilter:"blur(10px)", flexShrink:0 }}>
        <div style={{ fontFamily:font.mono, fontSize:8, letterSpacing:"0.2em", textTransform:"uppercase", color:C.purpleLt, border:"1px solid rgba(124,58,237,0.3)", padding:"3px 10px" }}>LV WEIGHTED</div>
        <div style={{ fontFamily:font.mono, fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, flex:1 }}>Maryland CD-6 · Likely Voter Results · Wave 5 · April 2026</div>
        <span style={{ fontFamily:font.mono, fontSize:9, color:C.muted, letterSpacing:"0.08em" }}>
          SLIDE <strong style={{ color:"#eeeeff" }}>{cur+1}</strong> / {total}
        </span>
        <button onClick={() => setAutoplay(a=>!a)} style={{ fontFamily:font.mono, fontSize:8, letterSpacing:"0.12em", textTransform:"uppercase", padding:"4px 12px", border:`1px solid ${autoplay?C.purple:"rgba(255,255,255,0.07)"}`, background:autoplay?C.purple:"transparent", color:autoplay?"#fff":C.muted, cursor:"pointer" }}>
          {autoplay ? "STOP ■" : "AUTOPLAY →"}
        </button>
        <button onClick={() => goTo(0)} style={{ fontFamily:font.mono, fontSize:8, letterSpacing:"0.12em", textTransform:"uppercase", padding:"4px 12px", border:`1px solid rgba(255,255,255,0.07)`, background:"transparent", color:C.muted, cursor:"pointer" }}>COVER</button>
      </div>

      {/* ── SLIDE AREA ── */}
      <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
        <div style={{
          position:"absolute", inset:0, padding:`28px ${MX}px`, overflowY:"auto",
          display:"flex", flexDirection:"column",
          opacity: exiting ? 0 : 1,
          transform: exiting ? "translateX(-40px)" : "none",
          transition:"opacity 0.28s ease, transform 0.28s ease",
        }}>
          {slide.isCover ? (
            <>
              <TriStripe mx={MX} mb={24} />
              <CoverSlide />
            </>
          ) : (
            <>
              <TriStripe mx={MX} mb={20} />
              <Eyebrow>{slide.qNum} · {slide.category}</Eyebrow>
              <SlideTitle>{slide.title}</SlideTitle>
              <SubTitle>{slide.subtitle}</SubTitle>
              {slide.nets       && <Nets nets={slide.nets} />}
              {slide.bars       && <BarChart bars={slide.bars} />}
              {slide.issueTable && <IssueTable rows={slide.issueTable} />}
              {slide.rankTable  && <RankTable rows={slide.rankTable} />}
            </>
          )}
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{ height:38, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 22px", borderTop:"1px solid rgba(255,255,255,0.07)", background:"rgba(9,9,15,0.96)", backdropFilter:"blur(10px)", flexShrink:0 }}>
        <div style={{ display:"flex", gap:3, flexWrap:"wrap", maxWidth:"55%" }}>
          {SLIDES.map((_,i) => (
            <div key={i} onClick={() => goTo(i)} style={{
              width:i===cur?16:5, height:5, borderRadius:i===cur?2:"50%",
              background:i===cur?C.purple:"rgba(255,255,255,0.12)",
              cursor:"pointer", transition:"all 0.18s", flexShrink:0,
            }} />
          ))}
        </div>
        <div style={{ fontFamily:font.mono, fontSize:8, color:"rgba(238,238,255,0.25)", letterSpacing:"0.08em" }}>
          TPSI · Maryland CD-6 · LV Weighted · Wave 5 · April 2026 · N=309
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {([["←", prev, cur===0],["→", next, cur===total-1]] as const).map(([lbl,fn,dis],i)=>(
            <button key={i} onClick={fn} disabled={dis} style={{
              width:28, height:28, border:"1px solid rgba(255,255,255,0.07)", background:"transparent",
              color:dis?"rgba(238,238,255,0.2)":C.muted, cursor:dis?"default":"pointer",
              fontSize:13, display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:font.mono, transition:"all 0.15s",
            }}>{lbl}</button>
          ))}
        </div>
      </div>
    </div>
  );
}