"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import DarkNav from "@/app/components/DarkNav";

// ─── Types ────────────────────────────────────────────────────────────────────
type RatingKey =
  | "Safe D" | "Likely D" | "Lean D" | "Tilt D"
  | "Toss-up"
  | "Tilt R" | "Lean R" | "Likely R" | "Safe R";
type Office = "senate" | "gov";

interface RaceRow {
  state: string;
  name: string;
  incRunning: boolean;
  incParty: "D" | "R" | "I";
  approval: number | null;
  pollingAvg: number | null;
  modeledResult: number | null; // + = R advantage, − = D advantage
  rating: RatingKey;
}

// ─── Rating derivation ────────────────────────────────────────────────────────
function deriveRating(modeledResult: number | null, pollingAvg: number | null): RatingKey {
  const raw = modeledResult ?? pollingAvg;
  if (raw === null) return "Toss-up";
  const s = Math.max(-50, Math.min(50, raw));
  if (s >= 12) return "Safe R";
  if (s >= 6)  return "Likely R";
  if (s >= 2)  return "Lean R";
  if (s > 0)   return "Tilt R";
  if (s === 0) return "Toss-up";
  if (s > -2)  return "Tilt D";
  if (s > -6)  return "Lean D";
  if (s > -12) return "Likely D";
  return "Safe D";
}
function ratingSide(r: RatingKey): "D" | "R" | "T" {
  if (r === "Toss-up") return "T";
  return r.endsWith("D") ? "D" : "R";
}
function effMargin(r: { modeledResult: number | null; pollingAvg: number | null }): number {
  return Math.max(-50, Math.min(50, r.modeledResult ?? r.pollingAvg ?? 0));
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATE_NAMES: Record<string, string> = {
  AL:"Alabama", AK:"Alaska", AZ:"Arizona", AR:"Arkansas", CA:"California",
  CO:"Colorado", CT:"Connecticut", DE:"Delaware", DC:"D.C.", FL:"Florida",
  GA:"Georgia", HI:"Hawaii", ID:"Idaho", IL:"Illinois", IN:"Indiana",
  IA:"Iowa", KS:"Kansas", KY:"Kentucky", LA:"Louisiana", ME:"Maine",
  MD:"Maryland", MA:"Massachusetts", MI:"Michigan", MN:"Minnesota",
  MS:"Mississippi", MO:"Missouri", MT:"Montana", NV:"Nevada", NH:"New Hampshire",
  NJ:"New Jersey", NM:"New Mexico", NY:"New York", NC:"North Carolina",
  ND:"North Dakota", OH:"Ohio", OK:"Oklahoma", OR:"Oregon", PA:"Pennsylvania",
  RI:"Rhode Island", SC:"South Carolina", SD:"South Dakota", TN:"Tennessee",
  TX:"Texas", UT:"Utah", VT:"Vermont", VA:"Virginia", WA:"Washington",
  WV:"West Virginia", WI:"Wisconsin", WY:"Wyoming", NE:"Nebraska",
};
const FIPS: Record<string, string> = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
  "10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL",
  "18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
  "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE",
  "32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND",
  "39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD",
  "47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
  "55":"WI","56":"WY",
};
// Editorial diverging scale — deep royal-navy → soft → oxblood. Warmer and
// deeper than the stock #1a5fd4/#d42020 election crayons, so it reads as a
// designed palette, not a default.
const RATING_COLORS: Record<RatingKey, string> = {
  "Safe D":"#3568e6","Likely D":"#5b8cff","Lean D":"#84a8ff","Tilt D":"#b3caff",
  "Toss-up":"#565c6b",
  "Tilt R":"#ffb3b9","Lean R":"#ff8791","Likely R":"#ff5d6c","Safe R":"#e84450",
};
const RATING_INK: Record<RatingKey, string> = {
  "Safe D":"#6f9bff","Likely D":"#5b8cff","Lean D":"#84a8ff","Tilt D":"#a3c0fa",
  "Toss-up":"#8b91a3",
  "Tilt R":"#ffb3b9","Lean R":"#ff8791","Likely R":"#ff5d6c","Safe R":"#ff6b75",
};
const RATING_ORDER: RatingKey[] = [
  "Safe D","Likely D","Lean D","Tilt D","Toss-up","Tilt R","Lean R","Likely R","Safe R",
];
const LABEL_INK = new Set<RatingKey>(["Tilt D","Tilt R","Toss-up"]);
// States too small to carry an on-map label — broken out as an inset rail
// (the standard cartographic move for the dense Northeast).
const SMALL_STATES = new Set(["VT","NH","MA","RI","CT","NJ","DE","MD","DC"]);
const BLUE = "#5b8cff";
const RED  = "#ff5d6c";

// ─── Data ──────────────────────────────────────────────────────────────────────
const SENATE_RAW = [
  { state:"AL", name:"Tommy Tuberville",    incRunning:false, incParty:"R" as const, approval:19,  pollingAvg:16.6,  modeledResult:16.1  },
  { state:"AK", name:"Dan Sullivan",         incRunning:true,  incParty:"R" as const, approval:-8,  pollingAvg:-5.5,  modeledResult:-6.5  },
  { state:"AR", name:"Tom Cotton",           incRunning:true,  incParty:"R" as const, approval:15,  pollingAvg:16.6,  modeledResult:14.0  },
  { state:"CO", name:"John Hickenlooper",    incRunning:true,  incParty:"D" as const, approval:-22, pollingAvg:-11.5, modeledResult:-17.5 },
  { state:"DE", name:"Chris Coons",          incRunning:true,  incParty:"D" as const, approval:-20, pollingAvg:-24.5, modeledResult:-23.8 },
  { state:"FL", name:"Ashley Moody",         incRunning:true,  incParty:"R" as const, approval:17,  pollingAvg:5.6,   modeledResult:5.6   },
  { state:"GA", name:"Jon Ossoff",           incRunning:true,  incParty:"D" as const, approval:-18, pollingAvg:-4.5,  modeledResult:-10.8 },
  { state:"ID", name:"Jim Risch",            incRunning:true,  incParty:"R" as const, approval:22,  pollingAvg:14.6,  modeledResult:17.3  },
  { state:"IL", name:"Dick Durbin",          incRunning:false, incParty:"D" as const, approval:-12, pollingAvg:-18.5, modeledResult:-20.6 },
  { state:"IA", name:"Joni Ernst",           incRunning:false, incParty:"R" as const, approval:-5,  pollingAvg:2.6,   modeledResult:0.7   },
  { state:"KS", name:"Roger Marshall",       incRunning:true,  incParty:"R" as const, approval:6,   pollingAvg:8.6,   modeledResult:4.8   },
  { state:"KY", name:"Mitch McConnell",      incRunning:false, incParty:"R" as const, approval:-36, pollingAvg:5.6,   modeledResult:8.1   },
  { state:"LA", name:"Bill Cassidy",         incRunning:true,  incParty:"R" as const, approval:9,   pollingAvg:16.6,  modeledResult:10.7  },
  { state:"ME", name:"Susan Collins",        incRunning:true,  incParty:"R" as const, approval:-13, pollingAvg:-8.5,  modeledResult:-13.0 },
  { state:"MA", name:"Ed Markey",            incRunning:true,  incParty:"D" as const, approval:-15, pollingAvg:-27.5, modeledResult:-27.0 },
  { state:"MI", name:"Gary Peters",          incRunning:false, incParty:"D" as const, approval:-17, pollingAvg:-2.5,  modeledResult:-5.6  },
  { state:"MN", name:"Tina Smith",           incRunning:false, incParty:"D" as const, approval:-16, pollingAvg:-7.5,  modeledResult:-10.1 },
  { state:"MS", name:"Cindy Hyde-Smith",     incRunning:true,  incParty:"R" as const, approval:9,   pollingAvg:7.6,   modeledResult:6.5   },
  { state:"MT", name:"Steve Daines",         incRunning:false, incParty:"R" as const, approval:13,  pollingAvg:12.6,  modeledResult:12.1  },
  { state:"NE", name:"Pete Ricketts",        incRunning:true,  incParty:"R" as const, approval:1,   pollingAvg:-0.4,  modeledResult:-0.2  },
  { state:"NH", name:"Jeanne Shaheen",       incRunning:false, incParty:"D" as const, approval:12,  pollingAvg:-7.5,  modeledResult:-10.5 },
  { state:"NJ", name:"Cory Booker",          incRunning:true,  incParty:"D" as const, approval:-19, pollingAvg:-18.5, modeledResult:-20.0 },
  { state:"NM", name:"Ben Ray Luján",        incRunning:true,  incParty:"D" as const, approval:-20, pollingAvg:null,  modeledResult:-62.2 },
  { state:"NC", name:"Thom Tillis",          incRunning:false, incParty:"R" as const, approval:4,   pollingAvg:-12.5, modeledResult:-8.1  },
  { state:"OH", name:"Jon Husted",           incRunning:true,  incParty:"R" as const, approval:15,  pollingAvg:-4.5,  modeledResult:-0.9  },
  { state:"OK", name:"James Lankford",       incRunning:true,  incParty:"R" as const, approval:17,  pollingAvg:27.6,  modeledResult:20.1  },
  { state:"OR", name:"Jeff Merkley",         incRunning:true,  incParty:"D" as const, approval:-21, pollingAvg:-20.5, modeledResult:-23.2 },
  { state:"RI", name:"Jack Reed",            incRunning:true,  incParty:"D" as const, approval:-28, pollingAvg:-35.5, modeledResult:-33.2 },
  { state:"SC", name:"Lindsey Graham",       incRunning:true,  incParty:"R" as const, approval:-2,  pollingAvg:4.6,   modeledResult:0.5   },
  { state:"SD", name:"Mike Rounds",          incRunning:true,  incParty:"R" as const, approval:23,  pollingAvg:17.6,  modeledResult:15.1  },
  { state:"TN", name:"Bill Hagerty",         incRunning:true,  incParty:"R" as const, approval:27,  pollingAvg:24.6,  modeledResult:21.1  },
  { state:"TX", name:"John Cornyn",          incRunning:true,  incParty:"R" as const, approval:6,   pollingAvg:-1.5,  modeledResult:-1.7  },
  { state:"VA", name:"Mark Warner",          incRunning:true,  incParty:"D" as const, approval:-25, pollingAvg:-14.5, modeledResult:-18.5 },
  { state:"WV", name:"Shelley Moore Capito", incRunning:true,  incParty:"R" as const, approval:19,  pollingAvg:40.6,  modeledResult:28.6  },
  { state:"WY", name:"Cynthia Lummis",       incRunning:false, incParty:"R" as const, approval:26,  pollingAvg:42.6,  modeledResult:36.2  },
];
const GOV_RAW = [
  { state:"AL", name:"Kay Ivey",                  incRunning:false, incParty:"R" as const, approval:31,  pollingAvg:15.55, modeledResult:15.6  },
  { state:"AK", name:"Mike Dunleavy",             incRunning:true,  incParty:"R" as const, approval:11,  pollingAvg:-2.45, modeledResult:-0.3  },
  { state:"AZ", name:"Katie Hobbs",               incRunning:true,  incParty:"D" as const, approval:-14, pollingAvg:-9.15, modeledResult:-10.6 },
  { state:"AR", name:"Sarah Huckabee Sanders",    incRunning:true,  incParty:"R" as const, approval:21,  pollingAvg:25.55, modeledResult:20.0  },
  { state:"CA", name:"Gavin Newsom",              incRunning:false, incParty:"D" as const, approval:-12, pollingAvg:-13.45,modeledResult:-18.6 },
  { state:"CO", name:"Jared Polis",               incRunning:false, incParty:"D" as const, approval:-21, pollingAvg:-21.45,modeledResult:-19.1 },
  { state:"CT", name:"Ned Lamont",                incRunning:true,  incParty:"D" as const, approval:-32, pollingAvg:-11.45,modeledResult:-21.5 },
  { state:"FL", name:"Ron DeSantis",              incRunning:false, incParty:"R" as const, approval:13,  pollingAvg:1.35,  modeledResult:2.0   },
  { state:"GA", name:"Brian Kemp",                incRunning:false, incParty:"R" as const, approval:34,  pollingAvg:5.55,  modeledResult:-1.1  },
  { state:"HI", name:"Josh Green",                incRunning:true,  incParty:"D" as const, approval:-33, pollingAvg:-28.45,modeledResult:-33.7 },
  { state:"ID", name:"Brad Little",               incRunning:true,  incParty:"R" as const, approval:16,  pollingAvg:37.55, modeledResult:27.3  },
  { state:"IL", name:"J.B. Pritzker",             incRunning:true,  incParty:"D" as const, approval:-17, pollingAvg:-22.45,modeledResult:-23.3 },
  { state:"IA", name:"Kim Reynolds",              incRunning:false, incParty:"R" as const, approval:-5,  pollingAvg:-8.45, modeledResult:-4.8  },
  { state:"KS", name:"Laura Kelly",               incRunning:false, incParty:"D" as const, approval:-30, pollingAvg:-4.45, modeledResult:0.1   },
  { state:"ME", name:"Janet Mills",               incRunning:false, incParty:"D" as const, approval:-7,  pollingAvg:-15.45,modeledResult:-14.5 },
  { state:"MD", name:"Wes Moore",                 incRunning:true,  incParty:"D" as const, approval:-32, pollingAvg:-17.45,modeledResult:-27.2 },
  { state:"MA", name:"Maura Healey",              incRunning:true,  incParty:"D" as const, approval:-29, pollingAvg:-25.45,modeledResult:-29.5 },
  { state:"MI", name:"Gretchen Whitmer",          incRunning:false, incParty:"D" as const, approval:-21, pollingAvg:-1.55, modeledResult:-5.2  },
  { state:"MN", name:"Tim Walz",                  incRunning:false, incParty:"D" as const, approval:-17, pollingAvg:-16.45,modeledResult:-14.6 },
  { state:"NE", name:"Jim Pillen",                incRunning:true,  incParty:"R" as const, approval:15,  pollingAvg:20.55, modeledResult:13.8  },
  { state:"NV", name:"Joe Lombardo",              incRunning:true,  incParty:"R" as const, approval:23,  pollingAvg:-0.45, modeledResult:1.6   },
  { state:"NH", name:"Kelly Ayotte",              incRunning:true,  incParty:"R" as const, approval:18,  pollingAvg:11.55, modeledResult:4.8   },
  { state:"NM", name:"Michelle Lujan Grisham",    incRunning:false, incParty:"D" as const, approval:-17, pollingAvg:-8.45, modeledResult:-12.0 },
  { state:"NY", name:"Kathy Hochul",              incRunning:true,  incParty:"D" as const, approval:-10, pollingAvg:-17.45,modeledResult:-18.1 },
  { state:"OH", name:"Mike DeWine",               incRunning:false, incParty:"R" as const, approval:21,  pollingAvg:-5.45, modeledResult:-3.3  },
  { state:"OK", name:"Kevin Stitt",               incRunning:false, incParty:"R" as const, approval:18,  pollingAvg:11.55, modeledResult:14.1  },
  { state:"OR", name:"Tina Kotek",                incRunning:true,  incParty:"D" as const, approval:-4,  pollingAvg:-7.45, modeledResult:-12.5 },
  { state:"PA", name:"Josh Shapiro",              incRunning:true,  incParty:"D" as const, approval:-32, pollingAvg:-22.45,modeledResult:-22.7 },
  { state:"RI", name:"Dan McKee",                 incRunning:true,  incParty:"D" as const, approval:-2,  pollingAvg:-21.45,modeledResult:-19.7 },
  { state:"SC", name:"Henry McMaster",            incRunning:false, incParty:"R" as const, approval:22,  pollingAvg:14.55, modeledResult:8.9   },
  { state:"SD", name:"Larry Rhoden",              incRunning:true,  incParty:"R" as const, approval:34,  pollingAvg:24.55, modeledResult:21.3  },
  { state:"TN", name:"Bill Lee",                  incRunning:false, incParty:"R" as const, approval:27,  pollingAvg:12.55, modeledResult:14.7  },
  { state:"TX", name:"Greg Abbott",               incRunning:true,  incParty:"R" as const, approval:10,  pollingAvg:5.55,  modeledResult:2.8   },
  { state:"VT", name:"Phil Scott",                incRunning:true,  incParty:"R" as const, approval:58,  pollingAvg:49.55, modeledResult:28.0  },
  { state:"WI", name:"Tony Evers",                incRunning:false, incParty:"D" as const, approval:-15, pollingAvg:-4.85, modeledResult:-6.8  },
  { state:"WY", name:"Mark Gordon",               incRunning:true,  incParty:"R" as const, approval:34,  pollingAvg:55.55, modeledResult:41.6  },
];
const SENATE_RACES: RaceRow[] = SENATE_RAW.map(r => ({ ...r, rating: deriveRating(r.modeledResult, r.pollingAvg) }));
const GOV_RACES: RaceRow[]    = GOV_RAW.map(r => ({ ...r, rating: deriveRating(r.modeledResult, r.pollingAvg) }));

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtMargin(n: number | null): string {
  if (n === null) return "—";
  if (n === 0) return "EVEN";
  return `${n > 0 ? "R+" : "D+"}${Math.abs(n).toFixed(1)}`;
}
function marginColor(n: number | null): string {
  if (n === null) return "var(--muted2)";
  if (n === 0) return "var(--muted)";
  return n > 0 ? RED : BLUE;
}
function fmtApproval(n: number | null): string { return n === null ? "—" : `${n > 0 ? "+" : ""}${n}`; }
function approvalColor(n: number | null): string { return n === null ? "var(--muted2)" : n >= 0 ? BLUE : RED; }
function balance(races: RaceRow[]) {
  let d = 0, r = 0, t = 0;
  for (const x of races) { const s = ratingSide(x.rating); if (s === "D") d++; else if (s === "R") r++; else t++; }
  return { d, r, t, total: races.length };
}

// ─── PartyTag (the only "badge" — a tiny inline letter, not a card) ─────────────
function PartyTag({ party }: { party: "D" | "R" | "I" }) {
  const c = party === "D" ? BLUE : party === "R" ? RED : "#6d3ee9";
  return <span className="x-party" style={{ color: c }}>{party === "I" ? "I" : party}</span>;
}

// ─── Tooltip (the lone popover surface) ─────────────────────────────────────────
interface TT {
  visible: boolean; x: number; y: number; state: string; name: string; raceType: string;
  incRunning: boolean; incParty: "D" | "R" | "I";
  approval: number | null; pollingAvg: number | null; modeledResult: number | null; rating: RatingKey;
}
const EMPTY_TT: TT = { visible:false,x:0,y:0,state:"",name:"",raceType:"",incRunning:false,incParty:"R",approval:null,pollingAvg:null,modeledResult:null,rating:"Toss-up" };
function Tooltip({ d }: { d: TT }) {
  if (!d.visible || typeof document === "undefined") return null;
  const c = RATING_INK[d.rating];
  const poll = d.pollingAvg === null || Math.abs(d.pollingAvg) > 50 ? null : d.pollingAvg;
  // mini diverging margin bar
  const cap = 20;
  const mb = d.modeledResult;
  const m = mb === null ? null : Math.max(-cap, Math.min(cap, mb));
  const half = m === null ? 0 : (Math.abs(m) / cap) * 50;

  // d.x/d.y are VIEWPORT coords (clientX/clientY). Portaled to <body> + fixed so
  // the page's transformed animate-in wrapper can't capture the positioning and
  // shove it away from the cursor.
  const W = 246, H = 160, OFF = 16;
  const vw = window.innerWidth, vh = window.innerHeight;
  const left = (d.x + OFF + W) > vw ? d.x - W - OFF : d.x + OFF;
  const top  = (d.y + OFF + H) > vh ? d.y - H - OFF : d.y + OFF;
  return createPortal(
    <div className="x-tip" style={{ left, top }}>
      <span className="x-tip-spine" style={{ background: c }} />
      <div className="x-tip-in">
        <div className="x-tip-hd">
          <span className="x-tip-state">{STATE_NAMES[d.state] || d.state}</span>
          <span className="x-tip-rate" style={{ color: c }}>{d.rating}</span>
        </div>
        <div className="x-tip-meta">{d.raceType} · {d.incRunning ? "Incumbent running" : "Open seat"}</div>
        <div className="x-tip-bar" aria-hidden>
          <span className="x-tip-bar-seam" />
          {m !== null && m !== 0 && (
            <span className="x-tip-bar-fill" style={{ left: m > 0 ? "50%" : `${50 - half}%`, width: `${half}%`, background: m > 0 ? RED : BLUE }} />
          )}
        </div>
        <div className="x-tip-cand">
          <span className="x-tip-name">{d.name} <PartyTag party={d.incParty} /></span>
          <span className="x-tip-mod" style={{ color: marginColor(d.modeledResult) }}>{fmtMargin(d.modeledResult)}</span>
        </div>
        <div className="x-tip-stats">
          <span><i>Approval</i><b style={{ color: approvalColor(d.approval) }}>{fmtApproval(d.approval)}</b></span>
          <span><i>Polling</i><b style={{ color: marginColor(poll) }}>{fmtMargin(poll)}</b></span>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Beeswarm — the signature, unframed ─────────────────────────────────────────
const AX = 40, BW = 1000, BPAD = 54, BR = 16, BSTEP_X = 2 * BR + 3, BSTEP_Y = 2 * BR + 5, BTOP = 34, BAXIS_LABEL = 56;
const xFor = (m: number) => ((Math.max(-AX, Math.min(AX, m)) + AX) / (2 * AX)) * (BW - 2 * BPAD) + BPAD;
function Beeswarm({ races, raceType }: { races: RaceRow[]; raceType: string }) {
  const { placed, axisY, height } = useMemo(() => {
    const items = races.map(r => ({ r, m: r.modeledResult ?? r.pollingAvg ?? 0 }))
      .sort((a, b) => a.m - b.m).map(it => ({ ...it, cx: xFor(it.m) }));
    const out: { r: RaceRow; cx: number; row: number }[] = [];
    for (const it of items) {
      let row = 0;
      while (out.some(p => p.row === row && Math.abs(p.cx - it.cx) < BSTEP_X)) row++;
      out.push({ r: it.r, cx: it.cx, row });
    }
    const maxRow = out.reduce((mx, p) => Math.max(mx, p.row), 0);
    const ay = BTOP + 2 * BR + maxRow * BSTEP_Y;
    return { placed: out, axisY: ay, height: ay + BAXIS_LABEL };
  }, [races]);
  const [tt, setTT] = useState<TT>(EMPTY_TT);
  const [hover, setHover] = useState<string | null>(null);
  const tickLab: Record<number, string> = { [-40]:"D+40", [-20]:"D+20", 0:"EVEN", 20:"R+20", 40:"R+40" };
  const ticks = [-40, -30, -20, -10, 0, 10, 20, 30, 40];
  return (
    <div className="x-swarm-scroll">
      <svg viewBox={`0 0 ${BW} ${height}`} className="x-swarm" preserveAspectRatio="xMidYMax meet" style={{ minWidth: 640 }}>
        <defs>
          {/* top-left highlight → minted-coin sheen on solid tokens */}
          <radialGradient id="bfSheen" cx="34%" cy="26%" r="72%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.36" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          {/* soft contact shadow so tokens sit ON the page, not in it */}
          <filter id="bfShadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="1.6" stdDeviation="2.2" floodColor="#17171b" floodOpacity="0.22" />
          </filter>
        </defs>
        {[-12, -6, 6, 12].map(t => <line key={t} x1={xFor(t)} x2={xFor(t)} y1={BTOP} y2={axisY} className="x-sw-grid" />)}
        {ticks.map(t => <line key={"t"+t} x1={xFor(t)} x2={xFor(t)} y1={axisY} y2={axisY + 7} className="x-sw-tick" />)}
        <line x1={BPAD} x2={BW - BPAD} y1={axisY} y2={axisY} className="x-sw-axis" />
        <line x1={xFor(0)} x2={xFor(0)} y1={BTOP - 14} y2={axisY + 7} className="x-sw-seam" />
        <text x={xFor(0)} y={BTOP - 18} className="x-sw-evencap" textAnchor="middle">EVEN</text>
        {ticks.map(t => tickLab[t] ? <text key={"l"+t} x={xFor(t)} y={axisY + 26} textAnchor="middle" className={"x-sw-axlab" + (t === 0 ? " is-even" : "")}>{tickLab[t]}</text> : null)}
        <text x={BPAD} y={axisY + 46} textAnchor="start" className="x-sw-dir" style={{ fill: BLUE }}>← DEMOCRAT</text>
        <text x={BW - BPAD} y={axisY + 46} textAnchor="end" className="x-sw-dir" style={{ fill: RED }}>REPUBLICAN →</text>
        {placed.map(p => {
          const cy = axisY - BR - p.row * BSTEP_Y;
          const c = RATING_COLORS[p.r.rating];
          const open = !p.r.incRunning;             // open seats render as hollow tokens
          const isH = hover === p.r.state;
          const rr = isH ? BR + 2 : BR;
          const ink = open ? RATING_INK[p.r.rating] : LABEL_INK.has(p.r.rating) ? "#17171b" : "#fff";
          return (
            <g key={p.r.state} style={{ cursor: "pointer" }}
              onMouseMove={(e) => { setHover(p.r.state); setTT({ visible:true, x:e.clientX, y:e.clientY, state:p.r.state, name:p.r.name, raceType, incRunning:p.r.incRunning, incParty:p.r.incParty, approval:p.r.approval, pollingAvg:p.r.pollingAvg, modeledResult:p.r.modeledResult, rating:p.r.rating }); }}
              onMouseLeave={() => { setHover(null); setTT(t => ({ ...t, visible: false })); }}>
              {open ? (
                <>
                  {/* opaque base masks neighbours behind, then a tinted, ringed token */}
                  <circle cx={p.cx} cy={cy} r={rr} fill="var(--background)" filter="url(#bfShadow)" style={{ transition: "r 110ms" }} />
                  <circle cx={p.cx} cy={cy} r={rr} fill={`${c}26`} stroke={isH ? "var(--foreground)" : c} strokeWidth={isH ? 3 : 2.4} style={{ transition: "r 110ms" }} />
                  <circle cx={p.cx} cy={cy} r={rr - 4} fill="none" stroke={c} strokeWidth={1} strokeDasharray="1.5 3" opacity={0.55} pointerEvents="none" />
                </>
              ) : (
                <>
                  <circle cx={p.cx} cy={cy} r={rr} fill={c} stroke="var(--background)" strokeWidth={2.5} filter="url(#bfShadow)" style={{ transition: "r 110ms" }} />
                  <circle cx={p.cx} cy={cy} r={rr} fill="url(#bfSheen)" stroke={isH ? "var(--foreground)" : "transparent"} strokeWidth={isH ? 1.6 : 0} pointerEvents="none" style={{ transition: "r 110ms" }} />
                </>
              )}
              <text x={p.cx} y={cy} textAnchor="middle" dominantBaseline="central" className="x-sw-bub" style={{ fill: ink, textShadow: open ? "none" : "0 1px 1.4px rgba(23, 23, 27,0.32)" }}>{p.r.state}</text>
            </g>
          );
        })}
      </svg>
      <Tooltip d={tt} />
    </div>
  );
}

// ─── Geographic map — unframed SVG ──────────────────────────────────────────────
function RaceMap({ svgId, races, raceType }: { svgId: string; races: RaceRow[]; raceType: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tt, setTT] = useState<TT>(EMPTY_TT);
  const raceMap = Object.fromEntries(races.map(r => [r.state, r]));
  const onMove = useCallback((e: MouseEvent, abbr: string, r: RaceRow) => {
    setTT({ visible:true, x:e.clientX, y:e.clientY, state:abbr, name:r.name, raceType, incRunning:r.incRunning, incParty:r.incParty, approval:r.approval, pollingAvg:r.pollingAvg, modeledResult:r.modeledResult, rating:r.rating });
  }, [raceType]);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [{ geoAlbersUsa, geoPath }, { feature, mesh }, topo] = await Promise.all([
          import("d3-geo"), import("topojson-client"),
          fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(r => r.json()),
        ]);
        if (dead || !svgRef.current) return;
        const svg = svgRef.current;
        const NS = "http://www.w3.org/2000/svg";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proj = (geoAlbersUsa as any)().scale(1280).translate([480, 300]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pathFn = (geoPath as any)().projection(proj);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const states = (feature as any)(topo, topo.objects.states);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const borders = (mesh as any)(topo, topo.objects.states, (a: any, b: any) => a !== b);
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        // 1) state shapes
        for (const f of states.features) {
          const abbr = FIPS[String(f.id).padStart(2, "0")];
          if (!abbr) continue;
          const race = raceMap[abbr];
          const el = document.createElementNS(NS, "path");
          el.setAttribute("d", pathFn(f) ?? "");
          el.style.cssText = `fill:${race ? RATING_COLORS[race.rating] : "var(--x-nodata)"};stroke:var(--background);stroke-width:1.2;opacity:${race ? 1 : 0.4};cursor:${race ? "pointer" : "default"};transition:filter 140ms`;
          if (race) {
            el.addEventListener("mousemove", (e: MouseEvent) => onMove(e, abbr, race));
            el.addEventListener("mouseleave", () => setTT(t => ({ ...t, visible: false })));
            el.addEventListener("mouseover", () => { el.style.filter = "brightness(1.12) saturate(1.18)"; el.style.stroke = "var(--foreground)"; el.style.strokeWidth = "2"; });
            el.addEventListener("mouseout",  () => { el.style.filter = ""; el.style.stroke = "var(--background)"; el.style.strokeWidth = "1.2"; });
          }
          svg.appendChild(el);
        }
        // 2) interior borders
        const be = document.createElementNS(NS, "path");
        be.setAttribute("d", pathFn(borders) ?? "");
        be.style.cssText = "fill:none;stroke:var(--background);stroke-width:1;pointer-events:none;";
        svg.appendChild(be);
        // 3) on-map abbreviations (skip small NE states + anything that can't fit)
        for (const f of states.features) {
          const abbr = FIPS[String(f.id).padStart(2, "0")];
          if (!abbr) continue;
          const race = raceMap[abbr];
          if (!race || SMALL_STATES.has(abbr)) continue;
          const [[x0, y0], [x1, y1]] = pathFn.bounds(f);
          if (x1 - x0 < 26 || y1 - y0 < 18) continue;
          const [cx, cy] = pathFn.centroid(f);
          const t = document.createElementNS(NS, "text");
          t.setAttribute("x", String(cx));
          t.setAttribute("y", String(cy));
          t.setAttribute("text-anchor", "middle");
          t.setAttribute("dominant-baseline", "central");
          t.setAttribute("class", "x-geo-lab");
          const dark = LABEL_INK.has(race.rating);
          t.style.cssText = `fill:${dark ? "#17171b" : "#fff"};text-shadow:0 1px 1.5px ${dark ? "rgba(255,255,255,0.45)" : "rgba(23, 23, 27,0.4)"};pointer-events:none;`;
          t.textContent = abbr;
          svg.appendChild(t);
        }
      } catch { /* offline */ }
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const smallRated = races
    .filter(r => SMALL_STATES.has(r.state))
    .sort((a, b) => RATING_ORDER.indexOf(a.rating) - RATING_ORDER.indexOf(b.rating));

  return (
    <>
      <svg ref={svgRef} id={svgId} viewBox="0 0 960 600" className="x-geo" preserveAspectRatio="xMidYMid meet" />
      {smallRated.length > 0 && (
        <div className="x-geo-inset">
          <span className="x-geo-inset-cap">Northeast &amp; small states</span>
          <div className="x-geo-chips">
            {smallRated.map(r => (
              <button key={r.state} className="x-geo-chip"
                onMouseMove={(e) => setTT({ visible:true, x:e.clientX, y:e.clientY, state:r.state, name:r.name, raceType, incRunning:r.incRunning, incParty:r.incParty, approval:r.approval, pollingAvg:r.pollingAvg, modeledResult:r.modeledResult, rating:r.rating })}
                onMouseLeave={() => setTT(t => ({ ...t, visible: false }))}>
                <span className="x-geo-chip-sw" style={{ background: RATING_COLORS[r.rating] }} />
                <span className="x-geo-chip-ab">{r.state}</span>
                <em style={{ color: marginColor(r.modeledResult) }}>{fmtMargin(r.modeledResult)}</em>
              </button>
            ))}
          </div>
        </div>
      )}
      <Tooltip d={tt} />
    </>
  );
}

// ─── Power bar (masthead balance — a line, not a box) ───────────────────────────
function PowerBar({ label, races, active, onClick }: { label: string; races: RaceRow[]; active: boolean; onClick: () => void }) {
  const b = balance(races);
  const seg = (n: number) => `${(n / b.total) * 100}%`;
  const lead = b.d === b.r ? "Even" : b.d > b.r ? `D +${b.d - b.r}` : `R +${b.r - b.d}`;
  const leadColor = b.d > b.r ? BLUE : b.r > b.d ? RED : "var(--muted)";
  return (
    <button className={`x-power${active ? " is-active" : ""}`} onClick={onClick} aria-pressed={active}>
      <div className="x-power-top">
        <span className="x-power-label">{label}</span>
        <span className="x-power-lead" style={{ color: leadColor }}>{lead}<i>lead</i></span>
      </div>
      <div className="x-power-bar">
        <span className="x-power-n" style={{ color: BLUE, opacity: b.d >= b.r ? 1 : 0.6 }}>{b.d}</span>
        <span className="x-power-track">
          <i style={{ width: seg(b.d), background: `linear-gradient(90deg, ${RATING_COLORS["Safe D"]}, ${RATING_COLORS["Lean D"]})` }} />
          <i style={{ width: seg(b.t), background: "var(--muted3)" }} />
          <i style={{ width: seg(b.r), background: `linear-gradient(90deg, ${RATING_COLORS["Lean R"]}, ${RATING_COLORS["Safe R"]})` }} />
          <span className="x-power-seam" />
          {b.t > 0 && <span className="x-power-toss" style={{ left: `${(b.d + b.t / 2) / b.total * 100}%` }}>{b.t}</span>}
        </span>
        <span className="x-power-n" style={{ color: RED, opacity: b.r >= b.d ? 1 : 0.6 }}>{b.r}</span>
      </div>
    </button>
  );
}

// ─── Section (marginalia grid) ──────────────────────────────────────────────────
function Section({ n, title, note, rail, children }: { n: string; title: string; note: string; rail?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="x-sec">
      <aside className="x-rail">
        <div className="x-rail-num">{n}</div>
        <h2 className="x-rail-title">{title}</h2>
        <p className="x-rail-note">{note}</p>
        {rail}
      </aside>
      <div className="x-main">{children}</div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ForecastRatingsPage() {
  const [office, setOffice] = useState<Office>("senate");
  const isSenate = office === "senate";
  const races = isSenate ? SENATE_RACES : GOV_RACES;
  const officeLabel = isSenate ? "U.S. Senate" : "Governor";

  const tilts = useMemo(() => races.filter(r => r.rating === "Tilt D" || r.rating === "Tilt R").sort((a, b) => Math.abs(effMargin(a)) - Math.abs(effMargin(b))), [races]);
  const tableRows = useMemo(() => [...races].sort((a, b) => RATING_ORDER.indexOf(a.rating) - RATING_ORDER.indexOf(b.rating) || effMargin(a) - effMargin(b)), [races]);
  const grouped = useMemo(() => {
    const m = new Map<RatingKey, RaceRow[]>();
    for (const r of tableRows) { if (!m.has(r.rating)) m.set(r.rating, []); m.get(r.rating)!.push(r); }
    return [...m.entries()];
  }, [tableRows]);
  const competitive = races.filter(r => ["Toss-up","Tilt D","Tilt R","Lean D","Lean R"].includes(r.rating)).length;

  return (
    <div className="x-page">
      <style>{CSS}</style>

      <DarkNav />

      {/* ══ MASTHEAD ══ */}
      <div className="x-mast">
        <div className="x-folio">
          <span>TPSI Forecast</span><span>2026 General Election</span><span>Updated April 2026</span>
        </div>
        <h1 className="x-hero">Race Ratings</h1>
        <div className="x-mast-body">
          <div className="x-mast-deck">
            <p className="x-deck">Every contested U.S. Senate and gubernatorial race, placed on a single axis from the safest Democratic seat to the safest Republican one. Built from weighted polling, structural state baselines, incumbency, and the national environment.</p>
            <div className="x-mast-links">
              <Link href="/polling" className="x-link">Polling data →</Link>
              <Link href="/electoralmap" className="x-link">Electoral map →</Link>
              <a href="#method" className="x-link">Methodology →</a>
            </div>
          </div>
          <div className="x-mast-power">
            <div className="x-power-cap">Projected control · contested seats</div>
            <PowerBar label="Senate"   races={SENATE_RACES} active={isSenate}  onClick={() => setOffice("senate")} />
            <PowerBar label="Governor" races={GOV_RACES}    active={!isSenate} onClick={() => setOffice("gov")} />
          </div>
        </div>
      </div>

      {/* ══ OFFICE SWITCH (typographic) ══ */}
      <div className="x-office">
        <div className="x-office-toggle">
          <button className={isSenate ? "is-active" : ""} onClick={() => setOffice("senate")}>Senate</button>
          <span className="x-office-sep">/</span>
          <button className={!isSenate ? "is-active" : ""} onClick={() => setOffice("gov")}>Governor</button>
        </div>
        <div className="x-office-meta">{races.length} seats<span>·</span>{competitive} competitive</div>
      </div>

      {/* ══ 01 · BATTLEFIELD ══ */}
      <Section
        n="01" title="The Battlefield" note={`${officeLabel} — every seat by modeled margin. Hover for detail.`}
        rail={<>
          <ul className="x-legend">{(["Safe D","Lean D","Tilt D","Toss-up","Tilt R","Lean R","Safe R"] as RatingKey[]).map(k => (
            <li key={k}><span style={{ background: RATING_COLORS[k] }} />{k}</li>
          ))}</ul>
          <div className="x-legend-key">
            <span><i className="x-key-solid" />Incumbent</span>
            <span><i className="x-key-open" />Open seat</span>
          </div>
        </>}
      >
        <Beeswarm races={races} raceType={officeLabel} />
        {tilts.length > 0 && (
          <p className="x-edge"><span className="x-edge-cap">Within two points</span>
            {tilts.map((r, i) => {
              const m = r.modeledResult ?? r.pollingAvg;
              return <span key={r.state}>{i > 0 && <s> · </s>}<b>{r.state}</b> <em style={{ color: marginColor(m) }}>{fmtMargin(m)}</em></span>;
            })}
          </p>
        )}
      </Section>

      {/* ══ 02 · GEOGRAPHY ══ */}
      <Section n="02" title="Geography" note={`${officeLabel} — the same ratings on the map.`}
        rail={<div className="x-geo-key"><span style={{ color: BLUE }}>Safe D</span><span className="x-geo-ramp" /><span style={{ color: RED }}>Safe R</span></div>}>
        <RaceMap key={office} svgId={`${office}-svg`} races={races} raceType={officeLabel} />
      </Section>

      {/* ══ 03 · THE RECORD (ledger) ══ */}
      <Section n="03" title="The Record" note={`${officeLabel} — full ratings, grouped Safe D → Safe R.`}>
        <div className="x-ledger">
          <div className="x-led-head">
            <span>State</span><span>{isSenate ? "Senator / seat" : "Governor / seat"}</span>
            <span className="x-hide">Incumbent</span><span className="x-r x-hide">Approval</span>
            <span className="x-r x-hide">Polling</span><span className="x-r">Modeled</span>
          </div>
          {grouped.map(([rk, rows]) => (
            <div key={rk}>
              <div className="x-led-tier"><span style={{ background: RATING_COLORS[rk] }} /><b style={{ color: RATING_INK[rk] }}>{rk}</b><em>{rows.length}</em></div>
              {rows.map(r => {
                const poll = r.pollingAvg === null || Math.abs(r.pollingAvg) > 50 ? null : r.pollingAvg;
                return (
                  <div key={r.state} className="x-led-row">
                    <span className="x-led-state"><b>{r.state}</b> {STATE_NAMES[r.state]}</span>
                    <span className="x-led-name">{r.name} <PartyTag party={r.incParty} /></span>
                    <span className="x-hide x-led-inc">{r.incRunning ? "Running" : "Open seat"}</span>
                    <span className="x-r x-hide x-mono" style={{ color: approvalColor(r.approval) }}>{fmtApproval(r.approval)}</span>
                    <span className="x-r x-hide x-mono" style={{ color: marginColor(poll) }}>{fmtMargin(poll)}</span>
                    <span className="x-r x-mono x-led-mod" style={{ color: marginColor(r.modeledResult) }}>{fmtMargin(r.modeledResult)}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Section>

      {/* ══ 04 · METHOD ══ */}
      <section className="x-sec" id="method">
        <aside className="x-rail"><div className="x-rail-num">04</div><h2 className="x-rail-title">Method</h2><p className="x-rail-note">Convention — positive = R advantage, negative = D.</p></aside>
        <div className="x-main">
          <div className="x-method">
            <div className="x-mcol">
              <h3 className="x-mh">Rating tiers</h3>
              {([
                { l:"Safe",   r:">12 pts",  d:"Outcome not in doubt under any reasonable scenario." },
                { l:"Likely", r:"6–12 pts", d:"Strongly favors one party; a major shift would be needed to flip." },
                { l:"Lean",   r:"2–6 pts",  d:"Favored party holds a clear but not decisive edge." },
                { l:"Tilt",   r:"0–2 pts",  d:"Effectively a toss-up with a measurable directional lean." },
              ] as const).map(t => (
                <dl key={t.l} className="x-def">
                  <dt><span className="x-def-dots"><i style={{ background: RATING_COLORS[`${t.l} D` as RatingKey] }} /><i style={{ background: RATING_COLORS[`${t.l} R` as RatingKey] }} /></span>{t.l}<em>{t.r}</em></dt>
                  <dd>{t.d}</dd>
                </dl>
              ))}
            </div>
            <div className="x-mcol">
              <h3 className="x-mh">Input signals</h3>
              {[
                { l:"Modeled result", d:"Primary signal — structural baseline + polling + incumbency + national environment." },
                { l:"Polling average", d:"TPSI weighted model (recency, sample size, pollster grade). Fallback when no model result." },
                { l:"Approval rating", d:"Net in-state approval of the incumbent — informs open-seat baselines and candidate quality." },
                { l:"National environment", d:"Generic ballot, presidential approval, and historical midterm-wave patterns as a correction." },
              ].map(s => <dl key={s.l} className="x-def"><dt>{s.l}</dt><dd>{s.d}</dd></dl>)}
            </div>
            <div className="x-mcol">
              <h3 className="x-mh">Correction factors</h3>
              {[
                { v:"−8.5 pts", l:"Generic-ballot correction", d:"Applied to the Dem baseline for structural partisan lean per state." },
                { v:"+16.7 pts", l:"Structural R adjustment", d:"Republican structural advantage from 2024-cycle modeling." },
                { v:"Split", l:"Office independence", d:"Popular incumbents can outperform their state's presidential baseline." },
                { v:"Live", l:"Update cadence", d:"Ratings refresh automatically as new polls enter the database." },
              ].map(c => <dl key={c.l} className="x-def"><dt><span className="x-def-v">{c.v}</span>{c.l}</dt><dd>{c.d}</dd></dl>)}
            </div>
          </div>
          <p className="x-foot"><b>Toss-up</b> is reserved for races where polling and structural signals are in direct conflict or unavailable. A <b>Tilt</b> carries a measurable lean but stays within the margin of error.</p>
        </div>
      </section>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');

html, body { background: #050505 !important; }
body header, body footer { display: none !important; }

.x-page {
  --disp: var(--font-display);
  --serif: var(--font-body);
  --data: var(--font-numeric);
  --lab: var(--font-numeric);
  --background: #050505; --foreground: #f4f4ef; --foreground2: rgba(244,244,239,0.74);
  --muted: rgba(244,244,239,0.58); --muted2: rgba(244,244,239,0.40); --muted3: rgba(244,244,239,0.26);
  --border: rgba(255,255,255,0.10); --border2: rgba(255,255,255,0.16); --border3: rgba(255,255,255,0.24);
  --panel: rgba(255,255,255,0.03); --panel2: rgba(255,255,255,0.05);
  --purple: #b7ff00; --purple-dim: rgba(183,255,0,0.10);
  --x-nodata: #1b1d29;
  --rail-w: 178px; --gap: 56px;
  max-width: 1180px; margin: 0 auto; padding: 0 2px 64px;
  position: relative; z-index: 1; color: var(--foreground);
  font-family: var(--lab); font-size: 14px; letter-spacing: -0.01em;
}
.x-page ::selection { background: rgba(183,255,0,0.24); }

/* ── Masthead ── */
.x-folio { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 14px 0; border-top: 1px solid var(--border2); border-bottom: 1px solid var(--border); font-family: var(--lab); font-size: 10.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted2); }
.x-folio span:first-child { color: var(--foreground); }
.x-hero { font-family: var(--disp); font-weight: 500; text-transform: lowercase; letter-spacing: -0.035em; line-height: 0.9; font-size: clamp(48px, 10vw, 120px); margin: 20px 0 0; color: var(--foreground); }
.x-mast-body { display: grid; grid-template-columns: 1.35fr 1fr; gap: var(--gap); align-items: end; margin-top: 26px; padding-bottom: 8px; }
.x-deck { font-family: var(--serif); font-size: clamp(16px, 1.7vw, 21px); line-height: 1.55; color: var(--foreground2); max-width: 56ch; margin: 0; }
.x-mast-links { display: flex; flex-wrap: wrap; gap: 22px; margin-top: 22px; }
.x-link { font-family: var(--lab); font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--foreground); border-bottom: 1px solid var(--border3); padding-bottom: 3px; transition: border-color var(--dur-1) var(--ease-out), opacity var(--dur-1); }
.x-link:hover { border-color: var(--purple); opacity: 1; }
.x-power-cap { font-family: var(--lab); font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted2); margin-bottom: 12px; }
.x-power { display: block; width: 100%; background: none; border: 0; border-top: 1px solid var(--border); padding: 12px 0 13px; cursor: pointer; text-align: left; transition: opacity var(--dur-1); }
.x-power:not(.is-active) { opacity: 0.55; }
.x-power:not(.is-active):hover { opacity: 0.82; }
.x-power-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 9px; }
.x-power-label { font-family: var(--disp); text-transform: uppercase; font-size: 16px; letter-spacing: 0.03em; color: var(--foreground); }
.x-power-lead { font-family: var(--data); font-size: 11px; font-weight: 800; letter-spacing: 0.02em; }
.x-power-lead i { font-style: normal; font-family: var(--lab); font-weight: 600; font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted2); margin-left: 5px; }
.x-power-bar { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; }
.x-power-n { font-family: var(--disp); font-size: 27px; line-height: 0.85; min-width: 24px; text-align: center; transition: opacity var(--dur-1); }
.x-power-track { position: relative; display: flex; height: 9px; background: var(--panel2); }
.x-power-track i { display: block; height: 100%; }
.x-power-track i:first-child { border-radius: 2px 0 0 2px; }
.x-power-track i:last-child { border-radius: 0 2px 2px 0; }
.x-power-seam { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--foreground); opacity: 0.5; transform: translateX(-50%); }
.x-power-toss { position: absolute; top: -15px; transform: translateX(-50%); font-family: var(--data); font-size: 9px; font-weight: 700; color: var(--muted2); }

/* ── Office switch ── */
.x-office { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; flex-wrap: wrap; margin-top: 40px; padding-bottom: 4px; }
.x-office-toggle { display: inline-flex; align-items: baseline; gap: 16px; }
.x-office-toggle button { font-family: var(--disp); text-transform: uppercase; letter-spacing: 0.01em; font-size: clamp(30px, 5vw, 52px); line-height: 1; background: none; border: 0; padding: 0; cursor: pointer; color: var(--muted3); transition: color var(--dur-1) var(--ease-out); }
.x-office-toggle button.is-active { color: var(--foreground); }
.x-office-toggle button:not(.is-active):hover { color: var(--muted); }
.x-office-sep { font-family: var(--disp); font-size: clamp(30px, 5vw, 52px); color: var(--border3); line-height: 1; }
.x-office-meta { font-family: var(--data); font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted2); }
.x-office-meta span { margin: 0 8px; color: var(--muted3); }

/* ── Section / marginalia grid ── */
.x-sec { display: grid; grid-template-columns: var(--rail-w) 1fr; gap: var(--gap); margin-top: 22px; padding-top: 26px; border-top: 1px solid var(--border); }
.x-rail { position: sticky; top: 18px; align-self: start; }
.x-rail-num { font-family: var(--disp); font-size: 30px; line-height: 1; color: transparent; -webkit-text-stroke: 1.2px var(--border3); letter-spacing: 0.03em; }
.x-rail-title { font-family: var(--disp); text-transform: uppercase; letter-spacing: 0.01em; font-size: 22px; line-height: 0.95; margin: 10px 0 0; color: var(--foreground); }
.x-rail-note { font-family: var(--serif); font-size: 13px; line-height: 1.5; color: var(--muted); margin: 10px 0 0; }
.x-main { min-width: 0; }

/* legend in rail */
.x-legend { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.x-legend li { display: flex; align-items: center; gap: 8px; font-family: var(--lab); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.x-legend li span { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.x-legend-key { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 12px; }
.x-legend-key span { display: inline-flex; align-items: center; font-family: var(--lab); font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.x-legend-key i { width: 11px; height: 11px; border-radius: 50%; margin-right: 6px; flex-shrink: 0; }
.x-key-solid { background: var(--muted); box-shadow: inset 1.5px 1.5px 1.5px rgba(255,255,255,0.5); }
.x-key-open { background: transparent; border: 2px solid var(--muted); }
.x-geo-key { display: flex; align-items: center; gap: 8px; margin-top: 16px; font-family: var(--lab); font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.x-geo-ramp { flex: 1; height: 6px; border-radius: 9999px; background: linear-gradient(90deg, ${RATING_COLORS["Safe D"]}, ${RATING_COLORS["Lean D"]}, ${RATING_COLORS["Toss-up"]}, ${RATING_COLORS["Lean R"]}, ${RATING_COLORS["Safe R"]}); }

/* ── Beeswarm ── */
.x-swarm-scroll { overflow-x: auto; margin: 0 -2px; }
.x-swarm { width: 100%; display: block; }
.x-sw-grid { stroke: var(--border); stroke-width: 1; }
.x-sw-tick { stroke: var(--border2); stroke-width: 1; }
.x-sw-axis { stroke: var(--foreground); stroke-width: 1.2; opacity: 0.5; }
.x-sw-seam { stroke: var(--foreground); stroke-width: 1; opacity: 0.4; stroke-dasharray: 2 4; }
.x-sw-evencap { fill: var(--muted2); font-family: var(--lab); font-size: 10px; font-weight: 700; letter-spacing: 0.18em; }
.x-sw-axlab { fill: var(--muted2); font-family: var(--data); font-size: 12px; font-weight: 700; }
.x-sw-axlab.is-even { fill: var(--foreground); }
.x-sw-dir { font-family: var(--lab); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; }
.x-sw-bub { font-family: var(--data); font-size: 13px; font-weight: 800; pointer-events: none; }
.x-edge { font-family: var(--lab); font-size: 12.5px; line-height: 1.9; color: var(--muted); margin: 18px 0 0; }
.x-edge-cap { font-family: var(--lab); font-size: 9.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted2); margin-right: 14px; }
.x-edge b { font-family: var(--disp); font-weight: 400; font-size: 14px; color: var(--foreground); letter-spacing: 0.03em; }
.x-edge em { font-family: var(--data); font-style: normal; font-weight: 700; }
.x-edge s { color: var(--muted3); text-decoration: none; }

/* ── Geographic ── */
.x-geo { width: 100%; display: block; }
.x-geo-lab { font-family: var(--data); font-size: 12px; font-weight: 800; letter-spacing: 0.01em; }
.x-geo-inset { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 8px; padding-top: 15px; border-top: 1px solid var(--border); }
.x-geo-inset-cap { font-family: var(--lab); font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted2); }
.x-geo-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.x-geo-chip { display: inline-flex; align-items: center; gap: 7px; padding: 5px 9px; background: none; border: 0; cursor: pointer; transition: background var(--dur-1); }
.x-geo-chip:hover { background: var(--panel2); }
.x-geo-chip-sw { width: 11px; height: 11px; border-radius: 2px; flex-shrink: 0; }
.x-geo-chip-ab { font-family: var(--disp); font-size: 14px; color: var(--foreground); letter-spacing: 0.02em; }
.x-geo-chip em { font-style: normal; font-family: var(--data); font-size: 10.5px; font-weight: 700; }

/* ── Ledger (no box; hairline rows + typographic tier heads) ── */
.x-ledger { width: 100%; }
.x-led-head, .x-led-row { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(0,1.7fr) 0.9fr 0.8fr 0.8fr 0.8fr; align-items: center; gap: 14px; }
.x-led-head { font-family: var(--lab); font-size: 9px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted2); padding: 0 0 10px; border-bottom: 1px solid var(--foreground); }
.x-r { text-align: right; }
.x-mono { font-family: var(--data); font-variant-numeric: tabular-nums; }
.x-led-tier { display: flex; align-items: center; gap: 9px; padding: 18px 0 8px; }
.x-led-tier span { width: 9px; height: 9px; border-radius: 50%; }
.x-led-tier b { font-family: var(--disp); font-weight: 400; text-transform: uppercase; font-size: 16px; letter-spacing: 0.03em; }
.x-led-tier em { font-style: normal; font-family: var(--data); font-size: 10.5px; color: var(--muted2); margin-left: 2px; }
.x-led-row { padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 13px; transition: background var(--dur-1); }
.x-led-row:hover { background: linear-gradient(90deg, var(--purple-dim), transparent 70%); }
.x-led-state { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.x-led-state b { font-family: var(--disp); font-weight: 400; font-size: 15px; color: var(--foreground); letter-spacing: 0.03em; margin-right: 4px; }
.x-led-name { color: var(--foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.x-led-inc { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted2); }
.x-led-mod { font-weight: 800; }

/* party letter */
.x-party { font-family: var(--data); font-size: 10px; font-weight: 800; letter-spacing: 0.02em; vertical-align: 1px; }

/* ── Method (definition lists, no boxes) ── */
.x-method { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; }
.x-mh { font-family: var(--lab); font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--purple); margin: 0 0 6px; }
.x-def { margin: 0; padding: 13px 0; border-top: 1px solid var(--border); }
.x-def dt { display: flex; align-items: baseline; gap: 8px; font-size: 13px; font-weight: 600; color: var(--foreground); }
.x-def dt em { font-style: normal; font-family: var(--data); font-size: 11px; color: var(--muted2); margin-left: auto; }
.x-def dd { margin: 5px 0 0; font-family: var(--serif); font-size: 13.5px; line-height: 1.55; color: var(--muted); }
.x-def-dots { display: inline-flex; gap: 3px; }
.x-def-dots i { width: 9px; height: 9px; border-radius: 50%; }
.x-def-v { font-family: var(--data); font-size: 14px; font-weight: 800; color: var(--purple); margin-right: 4px; }
.x-foot { font-family: var(--serif); font-size: 13.5px; line-height: 1.7; color: var(--muted); margin: 28px 0 0; padding-top: 16px; border-top: 1px solid var(--border); max-width: 78ch; }
.x-foot b { color: var(--foreground); font-weight: 600; font-family: var(--lab); }

/* ── Tooltip (only surface) ── */
/* portaled to <body> → use GLOBAL font vars ('Anton' is document-wide via @import) */
.x-tip { position: fixed; z-index: 9999; pointer-events: none; width: 246px; display: flex; background: rgba(12,12,13,0.98); border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 26px 64px rgba(0,0,0,0.62); border-radius: 12px; overflow: hidden; -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); }
.x-tip-spine { width: 4px; flex-shrink: 0; }
.x-tip-in { flex: 1; min-width: 0; padding: 11px 13px 12px; }
.x-tip-hd { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.x-tip-state { font-family: inherit; font-weight: 700; font-size: 17px; text-transform: none; letter-spacing: -0.02em; color: #f4f4ef; line-height: 1; }
.x-tip-rate { font-family: inherit; font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; white-space: nowrap; }
.x-tip-meta { font-family: inherit; font-size: 9.5px; letter-spacing: 0.05em; text-transform: uppercase; color: rgba(244,244,239,0.42); margin-top: 4px; }
.x-tip-bar { position: relative; height: 6px; background: rgba(255,255,255,0.06); margin: 11px 0 10px; }
.x-tip-bar-seam { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: #f4f4ef; opacity: 0.4; }
.x-tip-bar-fill { position: absolute; top: 0; bottom: 0; }
.x-tip-cand { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.x-tip-name { font-size: 12px; font-weight: 600; color: #f4f4ef; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: inherit; }
.x-tip-mod { font-family: inherit; font-size: 13px; font-weight: 800; white-space: nowrap; }
.x-tip-stats { display: flex; gap: 20px; margin-top: 9px; padding-top: 9px; border-top: 1px solid rgba(255,255,255,0.10); }
.x-tip-stats span { display: flex; flex-direction: column; gap: 2px; }
.x-tip-stats i { font-style: normal; font-family: inherit; font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(244,244,239,0.42); }
.x-tip-stats b { font-family: inherit; font-size: 12.5px; font-weight: 700; }

/* ── Responsive ── */
@media (max-width: 880px) {
  .x-mast-body { grid-template-columns: 1fr; gap: 28px; align-items: start; }
  .x-sec { grid-template-columns: 1fr; gap: 18px; }
  .x-rail { position: static; display: grid; grid-template-columns: auto 1fr; column-gap: 14px; align-items: baseline; }
  .x-rail-num { font-size: 22px; }
  .x-rail-title { margin-top: 0; }
  .x-rail-note { grid-column: 1 / -1; }
  .x-legend, .x-geo-key { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; }
  .x-method { grid-template-columns: 1fr; gap: 24px; }
  .x-hide { display: none; }
  .x-led-head, .x-led-row { grid-template-columns: minmax(0,1.4fr) minmax(0,1fr) 0.7fr; }
}
@media (max-width: 520px) {
  .x-led-head, .x-led-row { grid-template-columns: minmax(0,1fr) 0.6fr; gap: 10px; }
  .x-led-head span:nth-child(2), .x-led-row .x-led-name { display: none; }
}
`;
