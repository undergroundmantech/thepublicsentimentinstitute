"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
type RatingKey =
  | "Safe D" | "Likely D" | "Lean D" | "Tilt D"
  | "Toss-up"
  | "Tilt R" | "Lean R" | "Likely R" | "Safe R";

interface SenateRace {
  state: string;
  senator: string;
  incRunning: boolean;
  incParty: "D" | "R" | "I";
  approval: number | null;
  pollingAvg: number | null;
  // modeledResult: POSITIVE = R wins, NEGATIVE = D wins (R-advantage convention)
  modeledResult: number | null;
  rating: RatingKey;
}

interface GovRace {
  state: string;
  governor: string;
  incRunning: boolean;
  incParty: "D" | "R" | "I";
  approval: number | null;
  pollingAvg: number | null;
  // modeledResult: POSITIVE = R wins, NEGATIVE = D wins (R-advantage convention)
  modeledResult: number | null;
  rating: RatingKey;
}

type TabKey = "methodology" | "senate-map" | "gov-map" | "senate-table" | "gov-table";

// ─── Rating derivation ────────────────────────────────────────────────────────
// Convention: positive = R advantage, negative = D advantage
// Safe = margin > 12 pts either side
// Likely = 6–12 pts
// Lean = 2–6 pts
// Tilt = 0–2 pts
function deriveRating(modeledResult: number | null, pollingAvg: number | null): RatingKey {
  // Use modeled result as primary; fall back to polling avg
  // Clamp extreme outliers (e.g. NM senate polling -100)
  const raw = modeledResult ?? pollingAvg;
  if (raw === null) return "Toss-up";
  const s = Math.max(-50, Math.min(50, raw));

  // positive = R wins
  if (s >= 12)  return "Safe R";
  if (s >= 6)   return "Likely R";
  if (s >= 2)   return "Lean R";
  if (s > 0)    return "Tilt R";
  if (s === 0)  return "Toss-up";
  if (s > -2)   return "Tilt D";
  if (s > -6)   return "Lean D";
  if (s > -12)  return "Likely D";
  return "Safe D";
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
  WV:"West Virginia", WI:"Wisconsin", WY:"Wyoming",
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

const RATING_COLORS: Record<RatingKey, string> = {
  "Safe D":   "#0033a0",
  "Likely D": "#1a5fd4",
  "Lean D":   "#4a9dff",
  "Tilt D":   "#8dc8ff",
  "Toss-up":  "#888888",
  "Tilt R":   "#ffaa88",
  "Lean R":   "#ff6040",
  "Likely R": "#d42020",
  "Safe R":   "#9b0000",
};

const RATING_ORDER: RatingKey[] = [
  "Safe D","Likely D","Lean D","Tilt D","Toss-up","Tilt R","Lean R","Likely R","Safe R"
];

// ─── Senate Data ──────────────────────────────────────────────────────────────
// Source: user-provided spreadsheet. Columns: Senator | Inc Running | Approval | Polling Avg | Senator Results
// Senator Results = modeledResult (positive = R wins, negative = D wins)
// Extra trailing numbers on some rows are from a separate 2028 projection column — ignored here.
const SENATE_RAW = [
  { state:"AL", senator:"Tommy Tuberville",    incRunning:false, incParty:"R" as const, approval:19,  pollingAvg:16.6,  modeledResult:16.1  },
  { state:"AK", senator:"Dan Sullivan",         incRunning:true,  incParty:"R" as const, approval:-8,  pollingAvg:-5.5,  modeledResult:-6.5  },
  { state:"AR", senator:"Tom Cotton",           incRunning:true,  incParty:"R" as const, approval:15,  pollingAvg:16.6,  modeledResult:14.0  },
  { state:"CO", senator:"John Hickenlooper",    incRunning:true,  incParty:"D" as const, approval:-22, pollingAvg:-11.5, modeledResult:-17.5 },
  { state:"DE", senator:"Chris Coons",          incRunning:true,  incParty:"D" as const, approval:-20, pollingAvg:-24.5, modeledResult:-23.8 },
  { state:"FL", senator:"Ashley Moody",         incRunning:true,  incParty:"R" as const, approval:17,  pollingAvg:5.6,   modeledResult:5.6   },
  { state:"GA", senator:"Jon Ossoff",           incRunning:true,  incParty:"D" as const, approval:-18, pollingAvg:-4.5,  modeledResult:-10.8 },
  { state:"ID", senator:"Jim Risch",            incRunning:true,  incParty:"R" as const, approval:22,  pollingAvg:14.6,  modeledResult:17.3  },
  { state:"IL", senator:"Dick Durbin",          incRunning:false, incParty:"D" as const, approval:-12, pollingAvg:-18.5, modeledResult:-20.6 },
  { state:"IA", senator:"Joni Ernst",           incRunning:false, incParty:"R" as const, approval:-5,  pollingAvg:2.6,   modeledResult:0.7   },
  { state:"KS", senator:"Roger Marshall",       incRunning:true,  incParty:"R" as const, approval:6,   pollingAvg:8.6,   modeledResult:4.8   },
  { state:"KY", senator:"Mitch McConnell",      incRunning:false, incParty:"R" as const, approval:-36, pollingAvg:5.6,   modeledResult:8.1   },
  { state:"LA", senator:"Bill Cassidy",         incRunning:true,  incParty:"R" as const, approval:9,   pollingAvg:16.6,  modeledResult:10.7  },
  { state:"ME", senator:"Susan Collins",        incRunning:true,  incParty:"R" as const, approval:-13, pollingAvg:-8.5,  modeledResult:-13.0 },
  { state:"MA", senator:"Ed Markey",            incRunning:true,  incParty:"D" as const, approval:-15, pollingAvg:-27.5, modeledResult:-27.0 },
  { state:"MI", senator:"Gary Peters",          incRunning:false, incParty:"D" as const, approval:-17, pollingAvg:-2.5,  modeledResult:-5.6  },
  { state:"MN", senator:"Tina Smith",           incRunning:false, incParty:"D" as const, approval:-16, pollingAvg:-7.5,  modeledResult:-10.1 },
  { state:"MS", senator:"Cindy Hyde-Smith",     incRunning:true,  incParty:"R" as const, approval:9,   pollingAvg:7.6,   modeledResult:6.5   },
  { state:"MT", senator:"Steve Daines",         incRunning:false, incParty:"R" as const, approval:13,  pollingAvg:12.6,  modeledResult:12.1  },
  { state:"NE", senator:"Pete Ricketts",        incRunning:true,  incParty:"R" as const, approval:1,   pollingAvg:-0.4,  modeledResult:-0.2  },
  { state:"NH", senator:"Jeanne Shaheen",       incRunning:false, incParty:"D" as const, approval:12,  pollingAvg:-7.5,  modeledResult:-10.5 },
  { state:"NJ", senator:"Cory Booker",          incRunning:true,  incParty:"D" as const, approval:-19, pollingAvg:-18.5, modeledResult:-20.0 },
  { state:"NM", senator:"Ben Ray Luján",        incRunning:true,  incParty:"D" as const, approval:-20, pollingAvg:null,  modeledResult:-62.2 },
  { state:"NC", senator:"Thom Tillis",          incRunning:false, incParty:"R" as const, approval:4,   pollingAvg:-12.5, modeledResult:-8.1  },
  { state:"OH", senator:"Jon Husted",           incRunning:true,  incParty:"R" as const, approval:15,  pollingAvg:-4.5,  modeledResult:-0.9  },
  { state:"OK", senator:"James Lankford",       incRunning:true,  incParty:"R" as const, approval:17,  pollingAvg:27.6,  modeledResult:20.1  },
  { state:"OR", senator:"Jeff Merkley",         incRunning:true,  incParty:"D" as const, approval:-21, pollingAvg:-20.5, modeledResult:-23.2 },
  { state:"RI", senator:"Jack Reed",            incRunning:true,  incParty:"D" as const, approval:-28, pollingAvg:-35.5, modeledResult:-33.2 },
  { state:"SC", senator:"Lindsey Graham",       incRunning:true,  incParty:"R" as const, approval:-2,  pollingAvg:4.6,   modeledResult:0.5   },
  { state:"SD", senator:"Mike Rounds",          incRunning:true,  incParty:"R" as const, approval:23,  pollingAvg:17.6,  modeledResult:15.1  },
  { state:"TN", senator:"Bill Hagerty",         incRunning:true,  incParty:"R" as const, approval:27,  pollingAvg:24.6,  modeledResult:21.1  },
  { state:"TX", senator:"John Cornyn",          incRunning:true,  incParty:"R" as const, approval:6,   pollingAvg:-1.5,  modeledResult:-1.7  },
  { state:"VA", senator:"Mark Warner",          incRunning:true,  incParty:"D" as const, approval:-25, pollingAvg:-14.5, modeledResult:-18.5 },
  { state:"WV", senator:"Shelley Moore Capito", incRunning:true,  incParty:"R" as const, approval:19,  pollingAvg:40.6,  modeledResult:28.6  },
  { state:"WY", senator:"Cynthia Lummis",       incRunning:false, incParty:"R" as const, approval:26,  pollingAvg:42.6,  modeledResult:36.2  },
];

const SENATE_RACES: SenateRace[] = SENATE_RAW.map(r => ({
  ...r,
  rating: deriveRating(r.modeledResult, r.pollingAvg),
}));

// ─── Governor Data ────────────────────────────────────────────────────────────
// Source: user-provided spreadsheet. Columns: Governor | Inc Running | Approval | Polling Avg | Governor Results
// Governor Results = modeledResult (positive = R wins, negative = D wins)
// NJ incumbent running listed as "—" in original; treated as true (Sherrill running).
// NC (Josh Stein) not in user's updated list; retained from original spreadsheet doc.
const GOV_RAW = [
  { state:"AL", governor:"Kay Ivey",                  incRunning:false, incParty:"R" as const, approval:31,  pollingAvg:15.55, modeledResult:15.6  },
  { state:"AK", governor:"Mike Dunleavy",             incRunning:true,  incParty:"R" as const, approval:11,  pollingAvg:-2.45, modeledResult:-0.3  },
  { state:"AZ", governor:"Katie Hobbs",               incRunning:true,  incParty:"D" as const, approval:-14, pollingAvg:-9.15, modeledResult:-10.6 },
  { state:"AR", governor:"Sarah Huckabee Sanders",    incRunning:true,  incParty:"R" as const, approval:21,  pollingAvg:25.55, modeledResult:20.0  },
  { state:"CA", governor:"Gavin Newsom",              incRunning:false, incParty:"D" as const, approval:-12, pollingAvg:-13.45,modeledResult:-18.6 },
  { state:"CO", governor:"Jared Polis",               incRunning:false, incParty:"D" as const, approval:-21, pollingAvg:-21.45,modeledResult:-19.1 },
  { state:"CT", governor:"Ned Lamont",                incRunning:true,  incParty:"D" as const, approval:-32, pollingAvg:-11.45,modeledResult:-21.5 },
  { state:"FL", governor:"Ron DeSantis",              incRunning:false, incParty:"R" as const, approval:13,  pollingAvg:1.35,  modeledResult:2.0   },
  { state:"GA", governor:"Brian Kemp",                incRunning:false, incParty:"R" as const, approval:34,  pollingAvg:5.55,  modeledResult:-1.1  },
  { state:"HI", governor:"Josh Green",                incRunning:true,  incParty:"D" as const, approval:-33, pollingAvg:-28.45,modeledResult:-33.7 },
  { state:"ID", governor:"Brad Little",               incRunning:true,  incParty:"R" as const, approval:16,  pollingAvg:37.55, modeledResult:27.3  },
  { state:"IL", governor:"J.B. Pritzker",             incRunning:true,  incParty:"D" as const, approval:-17, pollingAvg:-22.45,modeledResult:-23.3 },
  { state:"IA", governor:"Kim Reynolds",              incRunning:false, incParty:"R" as const, approval:-5,  pollingAvg:-8.45, modeledResult:-4.8  },
  { state:"KS", governor:"Laura Kelly",               incRunning:false, incParty:"D" as const, approval:-30, pollingAvg:-4.45, modeledResult:0.1   },
  { state:"ME", governor:"Janet Mills",               incRunning:false, incParty:"D" as const, approval:-7,  pollingAvg:-15.45,modeledResult:-14.5 },
  { state:"MD", governor:"Wes Moore",                 incRunning:true,  incParty:"D" as const, approval:-32, pollingAvg:-17.45,modeledResult:-27.2 },
  { state:"MA", governor:"Maura Healey",              incRunning:true,  incParty:"D" as const, approval:-29, pollingAvg:-25.45,modeledResult:-29.5 },
  { state:"MI", governor:"Gretchen Whitmer",          incRunning:false, incParty:"D" as const, approval:-21, pollingAvg:-1.55, modeledResult:-5.2  },
  { state:"MN", governor:"Tim Walz",                  incRunning:false, incParty:"D" as const, approval:-17, pollingAvg:-16.45,modeledResult:-14.6 },
  { state:"NE", governor:"Jim Pillen",                incRunning:true,  incParty:"R" as const, approval:15,  pollingAvg:20.55, modeledResult:13.8  },
  { state:"NV", governor:"Joe Lombardo",              incRunning:true,  incParty:"R" as const, approval:23,  pollingAvg:-0.45, modeledResult:1.6   },
  { state:"NH", governor:"Kelly Ayotte",              incRunning:true,  incParty:"R" as const, approval:18,  pollingAvg:11.55, modeledResult:4.8   },
  // NJ governor race was November 2025 (won by Mikie Sherrill) — not on 2026 ballot, excluded
  { state:"NM", governor:"Michelle Lujan Grisham",    incRunning:false, incParty:"D" as const, approval:-17, pollingAvg:-8.45, modeledResult:-12.0 },
  { state:"NY", governor:"Kathy Hochul",              incRunning:true,  incParty:"D" as const, approval:-10, pollingAvg:-17.45,modeledResult:-18.1 },
  { state:"OH", governor:"Mike DeWine",               incRunning:false, incParty:"R" as const, approval:21,  pollingAvg:-5.45, modeledResult:-3.3  },
  { state:"OK", governor:"Kevin Stitt",               incRunning:false, incParty:"R" as const, approval:18,  pollingAvg:11.55, modeledResult:14.1  },
  { state:"OR", governor:"Tina Kotek",                incRunning:true,  incParty:"D" as const, approval:-4,  pollingAvg:-7.45, modeledResult:-12.5 },
  { state:"PA", governor:"Josh Shapiro",              incRunning:true,  incParty:"D" as const, approval:-32, pollingAvg:-22.45,modeledResult:-22.7 },
  { state:"RI", governor:"Dan McKee",                 incRunning:true,  incParty:"D" as const, approval:-2,  pollingAvg:-21.45,modeledResult:-19.7 },
  { state:"SC", governor:"Henry McMaster",            incRunning:false, incParty:"R" as const, approval:22,  pollingAvg:14.55, modeledResult:8.9   },
  { state:"SD", governor:"Larry Rhoden",              incRunning:true,  incParty:"R" as const, approval:34,  pollingAvg:24.55, modeledResult:21.3  },
  { state:"TN", governor:"Bill Lee",                  incRunning:false, incParty:"R" as const, approval:27,  pollingAvg:12.55, modeledResult:14.7  },
  { state:"TX", governor:"Greg Abbott",               incRunning:true,  incParty:"R" as const, approval:10,  pollingAvg:5.55,  modeledResult:2.8   },
  { state:"VT", governor:"Phil Scott",                incRunning:true,  incParty:"R" as const, approval:58,  pollingAvg:49.55, modeledResult:28.0  },
  { state:"WI", governor:"Tony Evers",                incRunning:false, incParty:"D" as const, approval:-15, pollingAvg:-4.85, modeledResult:-6.8  },
  { state:"WY", governor:"Mark Gordon",               incRunning:true,  incParty:"R" as const, approval:34,  pollingAvg:55.55, modeledResult:41.6  },
];

const GOV_RACES: GovRace[] = GOV_RAW.map(r => ({
  ...r,
  rating: deriveRating(r.modeledResult, r.pollingAvg),
}));

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtMargin(n: number | null): string {
  if (n === null) return "—";
  if (n === 0) return "EVEN";
  return `${n > 0 ? "R+" : "D+"}${Math.abs(n).toFixed(1)}`;
}
function marginColor(n: number | null): string {
  if (n === null) return "var(--muted2)";
  if (n === 0) return "#888";
  return n > 0 ? "#ff6040" : "#4a9dff";
}
function fmtApproval(n: number | null): string {
  if (n === null) return "—";
  return `${n > 0 ? "+" : ""}${n}`;
}
function approvalColor(n: number | null): string {
  if (n === null) return "var(--muted2)";
  return n >= 0 ? "#4a9dff" : "#ff6040";
}

// ─── Shared components ────────────────────────────────────────────────────────
function RatingBadge({ rating }: { rating: RatingKey }) {
  const c = RATING_COLORS[rating];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 10px",
      background: `${c}22`, color: c, border: `1px solid ${c}44`,
      fontFamily: "var(--font-body),monospace", fontSize: 10, fontWeight: 500,
      letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
    }}>
      {rating}
    </span>
  );
}

function PartyBadge({ party }: { party: "D" | "R" | "I" }) {
  const cfg = {
    D: { bg: "#1a5fd422", c: "#4a9dff", b: "#1a5fd444", l: "Dem" },
    R: { bg: "#d4202022", c: "#ff6040", b: "#d4202044", l: "GOP" },
    I: { bg: "#7c3aed22", c: "#9d5cf0", b: "#7c3aed44", l: "Ind" },
  }[party];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 8px",
      background: cfg.bg, color: cfg.c, border: `1px solid ${cfg.b}`,
      fontFamily: "var(--font-body),monospace", fontSize: 10, fontWeight: 500,
      letterSpacing: "0.08em", textTransform: "uppercase",
    }}>
      {cfg.l}
    </span>
  );
}

function SummaryBar({ races }: { races: Array<{ rating: RatingKey }> }) {
  const tiles = [
    { label: "Safe D",   color: "#0033a0", key: "Safe D"   as RatingKey },
    { label: "Likely D", color: "#1a5fd4", key: "Likely D" as RatingKey },
    { label: "Lean D",   color: "#4a9dff", key: "Lean D"   as RatingKey },
    { label: "Toss-up",  color: "#888",    key: "Toss-up"  as RatingKey },
    { label: "Lean R",   color: "#ff6040", key: "Lean R"   as RatingKey },
    { label: "Likely R", color: "#d42020", key: "Likely R" as RatingKey },
    { label: "Safe R",   color: "#9b0000", key: "Safe R"   as RatingKey },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 20 }}>
      {tiles.map(t => (
        <div key={t.key} style={{ background: "var(--panel)", border: `1px solid ${t.color}44`, borderRadius: "var(--r-sm)", padding: "12px 10px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 6 }}>{t.label}</div>
          <div style={{ fontFamily: "var(--font-display),sans-serif", textTransform: "uppercase", fontSize: 28, lineHeight: 1, color: t.color }}>
            {races.filter(r => r.rating === t.key).length}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
interface TT {
  visible: boolean; x: number; y: number;
  state: string; name: string; raceType: string;
  incRunning: boolean; incParty: "D" | "R" | "I";
  approval: number | null; pollingAvg: number | null; modeledResult: number | null;
  rating: RatingKey;
}

function Tooltip({ d }: { d: TT }) {
  if (!d.visible) return null;
  const c = RATING_COLORS[d.rating];
  // Suppress NM outlier poll
  const displayPoll = d.pollingAvg === null || Math.abs(d.pollingAvg) > 50 ? null : d.pollingAvg;

  // Tooltip dimensions (must match minWidth/maxWidth below)
  const TT_W = 260;
  const TT_H = 220;
  const MARGIN = 12;

  const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
  const scrollX = typeof window !== "undefined" ? window.scrollX : 0;
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // d.x/d.y are pageX/pageY — convert to viewport coords for clamping
  const viewX = d.x - scrollX;
  const viewY = d.y - scrollY;

  // Prefer just above cursor; flip below if near top of viewport
  const rawTop  = d.y - TT_H - 12;
  const rawLeft = d.x + 14;

  const top  = (viewY - TT_H - 12) < MARGIN ? d.y + 16 : rawTop;
  const left = (viewX + 14 + TT_W + MARGIN) > vw ? d.x - TT_W - 14 : rawLeft;

  return (
    <div style={{
      position: "absolute",
      left: Math.max(MARGIN + scrollX, left),
      top:  Math.max(MARGIN + scrollY, top),
      background: "var(--panel)",
      border: `1px solid ${c}55`,
      padding: "14px 16px",
      zIndex: 9999,
      pointerEvents: "none",
      minWidth: 230,
      maxWidth: 260,
      boxShadow: `0 0 0 1px ${c}22, 0 12px 40px rgba(0,0,0,0.25)`,
      borderRadius: "var(--r-md)",
    }}>
      {/* State name + race type */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display),sans-serif", fontSize: 20, letterSpacing: "-0.01em", textTransform: "uppercase", color: "var(--foreground)", lineHeight: 1 }}>
            {STATE_NAMES[d.state] || d.state}
          </div>
          <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted2)", marginTop: 3 }}>
            {d.raceType}
          </div>
        </div>
        <RatingBadge rating={d.rating} />
      </div>

      {/* Divider */}
      <div style={{ height: "0.5px", background: `${c}44`, margin: "10px 0" }} />

      {/* Candidate row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 12, color: "var(--foreground)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {d.name}
          </div>
          <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 10, color: "var(--muted2)", letterSpacing: "0.06em", marginTop: 2 }}>
            {d.incRunning ? "Incumbent running" : "Not running · open seat"}
          </div>
        </div>
        <PartyBadge party={d.incParty} />
      </div>

      {/* Stats: Approval | Polling Avg | Modeled Result */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
        {[
          { label: "Approval",   value: fmtApproval(d.approval),    color: approvalColor(d.approval)     },
          { label: "Polling Avg",value: fmtMargin(displayPoll),      color: marginColor(displayPoll)      },
          { label: "Modeled",    value: fmtMargin(d.modeledResult),  color: marginColor(d.modeledResult)  },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "7px 6px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: "var(--font-display),sans-serif", fontSize: 14, letterSpacing: "0.02em", textTransform: "uppercase", color: s.color, lineHeight: 1 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Map component ────────────────────────────────────────────────────────────
type MapRace = {
  state: string; name: string; rating: RatingKey;
  incRunning: boolean; incParty: "D" | "R" | "I";
  approval: number | null; pollingAvg: number | null; modeledResult: number | null;
};

function RaceMap({ svgId, races, raceType }: { svgId: string; races: MapRace[]; raceType: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tt, setTT] = useState<TT>({
    visible: false, x: 0, y: 0, state: "", name: "", raceType: "",
    incRunning: false, incParty: "R", approval: null, pollingAvg: null,
    modeledResult: null, rating: "Toss-up",
  });
  const raceMap = Object.fromEntries(races.map(r => [r.state, r]));

  const onMove = useCallback((e: MouseEvent, abbr: string, r: MapRace) => {
    setTT({
      visible: true, x: e.pageX, y: e.pageY,
      state: abbr, name: r.name, raceType,
      incRunning: r.incRunning, incParty: r.incParty,
      approval: r.approval, pollingAvg: r.pollingAvg,
      modeledResult: r.modeledResult, rating: r.rating,
    });
  }, [raceType]);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [{ geoAlbersUsa, geoPath }, { feature, mesh }, topo] = await Promise.all([
          import("d3-geo"),
          import("topojson-client"),
          fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(r => r.json()),
        ]);
        if (dead || !svgRef.current) return;
        const svg = svgRef.current;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proj   = (geoAlbersUsa as any)().scale(1280).translate([480, 300]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pathFn = (geoPath as any)().projection(proj);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const states  = (feature as any)(topo, topo.objects.states);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const borders = (mesh as any)(topo, topo.objects.states, (a: any, b: any) => a !== b);
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        for (const f of states.features) {
          const fips = String(f.id).padStart(2, "0");
          const abbr = FIPS[fips];
          if (!abbr) continue;
          const race = raceMap[abbr];
          const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
          el.setAttribute("d", pathFn(f) ?? "");
          el.style.cssText = `fill:${race ? RATING_COLORS[race.rating] : "#1c1c22"};stroke:#080810;stroke-width:0.9;opacity:${race ? 1 : 0.3};cursor:${race ? "pointer" : "default"};transition:filter 100ms`;
          if (race) {
            el.addEventListener("mousemove",  (e: MouseEvent) => onMove(e, abbr, race));
            el.addEventListener("mouseleave", () => setTT(t => ({ ...t, visible: false })));
            el.addEventListener("mouseover",  () => { el.style.filter = "brightness(1.22) saturate(1.3)"; });
            el.addEventListener("mouseout",   () => { el.style.filter = ""; });
          }
          svg.appendChild(el);
        }

        const be = document.createElementNS("http://www.w3.org/2000/svg", "path");
        be.setAttribute("d", pathFn(borders) ?? "");
        be.style.cssText = "fill:none;stroke:#080810;stroke-width:0.8;pointer-events:none;";
        svg.appendChild(be);
      } catch { /* offline / no d3 */ }
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const LEGEND = [
    { l: "Safe D",   c: "#0033a0" }, { l: "Likely D", c: "#1a5fd4" }, { l: "Lean D",   c: "#4a9dff" },
    { l: "Toss-up",  c: "#888"    },
    { l: "Lean R",   c: "#ff6040" }, { l: "Likely R", c: "#d42020" }, { l: "Safe R",   c: "#9b0000" },
  ];

  return (
    <>
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20, borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-sm)" }}>
        <div className="hp-tri-stripe" />
        <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(15,16,32,0.08)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--foreground)", marginBottom: 3 }}>
              {raceType} Race Map · November 2026
            </div>
            <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 10, color: "var(--muted2)" }}>
              Hover states for full race details
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {LEGEND.map(l => (
              <div key={l.l} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", background: `${l.c}22`, border: `1px solid ${l.c}44`, fontFamily: "var(--font-body),monospace", fontSize: 9, color: l.c }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: l.c, display: "inline-block", flexShrink: 0 }} />
                {l.l}
              </div>
            ))}
          </div>
        </div>
        <svg ref={svgRef} id={svgId} viewBox="0 0 960 600" style={{ width: "100%", display: "block" }} preserveAspectRatio="xMidYMid meet" />
      </div>
      <Tooltip d={tt} />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ForecastRatingsPage() {
  const [tab, setTab] = useState<TabKey>("methodology");

  const senateMap: MapRace[] = SENATE_RACES.map(r => ({
    state: r.state, name: r.senator, rating: r.rating,
    incRunning: r.incRunning, incParty: r.incParty,
    approval: r.approval, pollingAvg: r.pollingAvg, modeledResult: r.modeledResult,
  }));
  const govMap: MapRace[] = GOV_RACES.map(r => ({
    state: r.state, name: r.governor, rating: r.rating,
    incRunning: r.incRunning, incParty: r.incParty,
    approval: r.approval, pollingAvg: r.pollingAvg, modeledResult: r.modeledResult,
  }));

  const sortedSenate = [...SENATE_RACES].sort((a, b) =>
    RATING_ORDER.indexOf(a.rating) - RATING_ORDER.indexOf(b.rating) || a.state.localeCompare(b.state)
  );
  const sortedGov = [...GOV_RACES].sort((a, b) =>
    RATING_ORDER.indexOf(a.rating) - RATING_ORDER.indexOf(b.rating) || a.state.localeCompare(b.state)
  );

  const TABS: { key: TabKey; label: string }[] = [
    { key: "methodology",  label: "Methodology"      },
    { key: "senate-map",   label: "Senate Map"       },
    { key: "gov-map",      label: "Governor Map"     },
    { key: "senate-table", label: "Senate Ratings"   },
    { key: "gov-table",    label: "Governor Ratings" },
  ];

  const TH: React.CSSProperties = {
    padding: "10px 14px", fontFamily: "var(--font-body),monospace", fontSize: 8,
    fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase",
    color: "var(--muted)", textAlign: "left",
    borderBottom: "1px solid var(--border)", background: "var(--panel2)", whiteSpace: "nowrap",
  };
  const TD: React.CSSProperties = {
    padding: "9px 14px", borderBottom: "1px solid rgba(15,16,32,0.05)",
    fontFamily: "var(--font-body),monospace", fontSize: 12, color: "var(--foreground)",
  };

  return (
    <>
      <style>{`
        .hp-tri-stripe { height: 3px; background: linear-gradient(90deg,#e63946 0%,#e63946 33.33%,#7c3aed 33.33%,#7c3aed 66.66%,#2563eb 66.66%,#2563eb 100%); border-radius: 9999px 9999px 0 0; }
        .fr-row:hover td { background: rgba(124,58,237,0.04) !important; }
        .fr-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 20px 22px; }
        @media(max-width:900px) { .fr-mg { grid-template-columns: 1fr !important; } }
        @media(max-width:640px) { .fr-sum { grid-template-columns: repeat(4,1fr) !important; } }
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 80px", fontFamily: "var(--font-body),monospace", color: "var(--foreground)", position: "relative", zIndex: 1 }}>

        {/* ── Hero ── */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", marginBottom: 20, overflow: "hidden", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-md)" }}>
          <div className="hp-tri-stripe" />
          <div style={{ padding: "40px 48px 36px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 14 }}>
              TPSI · 2026 Race Ratings · Updated April 2026
            </div>
            <h1 style={{ fontFamily: "var(--font-display),sans-serif", fontSize: "clamp(36px,5vw,64px)", letterSpacing: "-0.02em", lineHeight: 0.95, textTransform: "uppercase", color: "var(--foreground)", marginBottom: 18 }}>
              <span style={{ color: "#4a9dff" }}>Senate</span> &amp;{" "}
              <span style={{ background: "linear-gradient(100deg,#ff4d5a,#a78bfa,#3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Governor
              </span>
              <br />Forecast Ratings
            </h1>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, maxWidth: 600, marginBottom: 24 }}>
              TPSI race ratings for all contested Senate seats and gubernatorial contests on the November 2026 ballot.
              Derived from weighted polling averages, structural state baselines, incumbency signals, and a national environment correction.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/polling" style={{ display: "inline-flex", alignItems: "center", padding: "11px 20px", background: "var(--gradient-purple)", color: "#fff", fontFamily: "var(--font-numeric),ui-monospace,monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", textDecoration: "none", borderRadius: "9999px", border: "1px solid var(--purple)", boxShadow: "var(--shadow-purple)" }}>
                Polling Data →
              </Link>
              <Link href="/electoralmap" style={{ display: "inline-flex", alignItems: "center", padding: "10px 20px", background: "var(--panel2)", color: "var(--foreground)", fontFamily: "var(--font-numeric),ui-monospace,monospace", fontSize: 13, fontWeight: 700, textDecoration: "none", borderRadius: "9999px", border: "1px solid var(--border2)" }}>
                Electoral Map
              </Link>
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--muted2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{SENATE_RACES.length}</span> Senate ·{" "}
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{GOV_RACES.length}</span> Governor ·{" "}
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>
                {[...SENATE_RACES, ...GOV_RACES].filter(r => r.rating === "Toss-up").length}
              </span> Toss-ups
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--panel2)", marginBottom: 20, overflowX: "auto", borderRadius: "var(--r-lg) var(--r-lg) 0 0" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "12px 22px", fontFamily: "var(--font-body),monospace", fontSize: 10,
              fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase",
              cursor: "pointer", background: "transparent",
              color: tab === t.key ? "var(--foreground)" : "var(--muted2)",
              borderBottom: `2px solid ${tab === t.key ? "var(--purple)" : "transparent"}`,
              fontWeight: tab === t.key ? 700 : 500,
              border: "none", whiteSpace: "nowrap", transition: "color 120ms",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Methodology ── */}
        {tab === "methodology" && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
              How we rate races
            </div>
            <div className="fr-mg" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "20px 22px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Rating tiers</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    { l: "Safe",   range: ">12 pts",  c: "#9b0000", desc: "Outcome not in doubt under any reasonable scenario." },
                    { l: "Likely", range: "6–12 pts", c: "#d42020", desc: "Strongly favors one party; requires a major shift to flip." },
                    { l: "Lean",   range: "2–6 pts",  c: "#ff6040", desc: "Favored party has a clear but not decisive edge." },
                    { l: "Tilt",   range: "0–2 pts",  c: "#ffaa88", desc: "Essentially a toss-up with a directional lean." },
                  ].map(item => (
                    <div key={item.l} style={{ display: "flex", gap: 10, padding: "8px 10px", background: `${item.c}10`, border: `1px solid ${item.c}25` }}>
                      <div style={{ flexShrink: 0, width: 60 }}>
                        <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 10, color: item.c, fontWeight: 500 }}>{item.l}</div>
                        <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 11, color: "var(--muted2)" }}>{item.range}</div>
                      </div>
                      <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 12, color: "var(--muted)", lineHeight: 1.65 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "20px 22px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Input signals</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    { l: "Modeled result",      desc: "Primary signal. Structural baseline + polling + incumbency correction + national environment." },
                    { l: "Polling average",      desc: "TPSI weighted model (recency, sample size, pollster grade). Used when model result is unavailable." },
                    { l: "Approval rating",      desc: "Net approval of the incumbent in state. Informs open-seat baseline and candidate quality." },
                    { l: "National environment", desc: "Generic ballot, presidential approval, and historical midterm wave patterns as a correction." },
                  ].map(item => (
                    <div key={item.l} style={{ padding: "8px 10px", background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
                      <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 12, color: "var(--foreground)", fontWeight: 600, marginBottom: 3 }}>{item.l}</div>
                      <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 12, color: "var(--muted)", lineHeight: 1.65 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "20px 22px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Correction factors</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    { val: "−8.5 pts",  l: "Generic ballot correction",    desc: "Applied to Dem baseline to account for structural partisan lean per state." },
                    { val: "+16.7 pts", l: "Structural R adjustment",       desc: "Republican structural advantage derived from 2024 cycle modeling." },
                    { val: "Partial",   l: "Senate / Governor independence",desc: "Popular incumbents can significantly outperform their state's presidential baseline." },
                    { val: "Live",      l: "Update cadence",                desc: "Ratings update automatically as new polls enter the TPSI database." },
                  ].map(item => (
                    <div key={item.l} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
                      <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 12, color: "var(--purple)", fontWeight: 500, flexShrink: 0, width: 64 }}>{item.val}</div>
                      <div>
                        <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 12, color: "var(--foreground)", fontWeight: 500, marginBottom: 2 }}>{item.l}</div>
                        <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 12, color: "var(--muted)", lineHeight: 1.65 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "20px 22px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Full rating scale</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[
                    { l: "Safe D",   c: "#0033a0", r: ">12 pts D"      },
                    { l: "Likely D", c: "#1a5fd4", r: "6–12 pts D"     },
                    { l: "Lean D",   c: "#4a9dff", r: "2–6 pts D"      },
                    { l: "Tilt D",   c: "#8dc8ff", r: "0–2 pts D"      },
                    { l: "Toss-up",  c: "#888",    r: "±0 / no signal" },
                    { l: "Tilt R",   c: "#ffaa88", r: "0–2 pts R"      },
                    { l: "Lean R",   c: "#ff6040", r: "2–6 pts R"      },
                    { l: "Likely R", c: "#d42020", r: "6–12 pts R"     },
                    { l: "Safe R",   c: "#9b0000", r: ">12 pts R"      },
                  ].map(r => (
                    <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 10px", background: `${r.c}12`, border: `1px solid ${r.c}25` }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: r.c, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-body),monospace", fontSize: 11, color: r.c, fontWeight: 500, width: 76 }}>{r.l}</span>
                      <span style={{ fontFamily: "var(--font-body),monospace", fontSize: 11, color: "var(--muted2)", marginLeft: "auto" }}>{r.r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ background: "var(--blue-dim)", border: "1px solid rgba(37,99,235,0.20)", borderRadius: "var(--r-md)", padding: "14px 20px", fontFamily: "var(--font-body),monospace", fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
              <span style={{ color: "#4a9dff", fontWeight: 500 }}>Note:</span> Toss-up is reserved for races where polling and structural signals are in direct conflict or unavailable. A "Tilt" has a measurable lean but remains within the margin of error. Modeled result convention: positive = R advantage, negative = D advantage.
            </div>
          </div>
        )}

        {/* ── Senate Map ── */}
        {tab === "senate-map" && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
              2026 Senate — {SENATE_RACES.length} seats rated
            </div>
            <SummaryBar races={SENATE_RACES} />
            <RaceMap svgId="senate-svg" races={senateMap} raceType="U.S. Senate" />
          </div>
        )}

        {/* ── Governor Map ── */}
        {tab === "gov-map" && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
              2026 Governors — {GOV_RACES.length} seats rated
            </div>
            <SummaryBar races={GOV_RACES} />
            <RaceMap svgId="gov-svg" races={govMap} raceType="Governor" />
          </div>
        )}

        {/* ── Senate Table ── */}
        {tab === "senate-table" && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
              Senate ratings — sorted by competitiveness
            </div>
            <SummaryBar races={SENATE_RACES} />
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <div className="hp-tri-stripe" />
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["State","Senator / Seat","Party","Inc. Running","Approval","Polling Avg","Modeled Result","Rating"].map(h => (
                        <th key={h} style={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSenate.map(r => (
                      <tr key={r.state} className="fr-row">
                        <td style={{ ...TD, color: "var(--foreground)", fontWeight: 600, whiteSpace: "nowrap" }}>{STATE_NAMES[r.state]}</td>
                        <td style={TD}>{r.senator}</td>
                        <td style={TD}><PartyBadge party={r.incParty} /></td>
                        <td style={{ ...TD, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: r.incRunning ? "var(--muted)" : "var(--muted2)" }}>
                          {r.incRunning ? "Yes" : "No"}
                        </td>
                        <td style={{ ...TD, color: approvalColor(r.approval), textAlign: "right" }}>{fmtApproval(r.approval)}</td>
                        <td style={{ ...TD, color: marginColor(r.pollingAvg), textAlign: "right" }}>{r.pollingAvg === null ? "—" : fmtMargin(r.pollingAvg)}</td>
                        <td style={{ ...TD, color: marginColor(r.modeledResult), fontWeight: 500, textAlign: "right" }}>{fmtMargin(r.modeledResult)}</td>
                        <td style={TD}><RatingBadge rating={r.rating} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Governor Table ── */}
        {tab === "gov-table" && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
              Governor ratings — sorted by competitiveness
            </div>
            <SummaryBar races={GOV_RACES} />
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <div className="hp-tri-stripe" />
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["State","Governor / Seat","Party","Inc. Running","Approval","Polling Avg","Modeled Result","Rating"].map(h => (
                        <th key={h} style={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGov.map(r => (
                      <tr key={r.state} className="fr-row">
                        <td style={{ ...TD, color: "var(--foreground)", fontWeight: 600, whiteSpace: "nowrap" }}>{STATE_NAMES[r.state]}</td>
                        <td style={TD}>{r.governor}</td>
                        <td style={TD}><PartyBadge party={r.incParty} /></td>
                        <td style={{ ...TD, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: r.incRunning ? "var(--muted)" : "var(--muted2)" }}>
                          {r.incRunning ? "Yes" : "No"}
                        </td>
                        <td style={{ ...TD, color: approvalColor(r.approval), textAlign: "right" }}>{fmtApproval(r.approval)}</td>
                        <td style={{ ...TD, color: marginColor(r.pollingAvg), textAlign: "right" }}>{fmtMargin(r.pollingAvg)}</td>
                        <td style={{ ...TD, color: marginColor(r.modeledResult), fontWeight: 500, textAlign: "right" }}>{fmtMargin(r.modeledResult)}</td>
                        <td style={TD}><RatingBadge rating={r.rating} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}