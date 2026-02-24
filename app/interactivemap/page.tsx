// app/elections/electoral-college/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";

// ✅ past performance dataset (statewide)
import { PAST_DATA_BY_STATE } from "@/app/polling/data/pastdata";

/* =========================
   Types (Unchanged)
========================= */
type PartyBrush = "D" | "R" | "T";
type Party = "D" | "R";
type Rating = "SAFE" | "LIKELY" | "LEAN" | "TILT";
type Pick = "T" | `D_${Rating}` | `R_${Rating}`;

type Tip =
  | {
      x: number;
      y: number;
      title: string;
      subtitle?: string;
      ev: number;
      pick: Pick;

      // ✅ tooltip-only dataset lookup
      abbr?: string | null;
    }
  | null;

type EcUnitType =
  | "STATE"
  | "ME_AT_LARGE"
  | "ME_CD1"
  | "ME_CD2"
  | "NE_AT_LARGE"
  | "NE_CD1"
  | "NE_CD2"
  | "NE_CD3";

type EcUnit = {
  id: string;
  label: string;
  type: EcUnitType;
  stateAbbr: string;
  ev: number;
};

/* =========================
   Constants
========================= */
const RATING_CYCLE: Rating[] = ["SAFE", "LIKELY", "LEAN", "TILT"];

const RATING_LABEL: Record<Rating, string> = {
  SAFE: "Safe",
  LIKELY: "Likely",
  LEAN: "Lean",
  TILT: "Tilt",
};

const BRUSH_LABEL: Record<PartyBrush, string> = {
  D: "Democrat",
  R: "Republican",
  T: "Toss-up",
};

// EV map (ME/NE split handled separately)
const STATE_EV: Record<string, number> = {
  AL: 9,
  AK: 3,
  AZ: 11,
  AR: 6,
  CA: 54,
  CO: 10,
  CT: 7,
  DE: 3,
  FL: 30,
  GA: 16,
  HI: 4,
  ID: 4,
  IL: 19,
  IN: 11,
  IA: 6,
  KS: 6,
  KY: 8,
  LA: 8,
  MD: 10,
  MA: 11,
  MI: 15,
  MN: 10,
  MS: 6,
  MO: 10,
  MT: 4,
  NV: 6,
  NH: 4,
  NJ: 14,
  NM: 5,
  NY: 28,
  NC: 16,
  ND: 3,
  OH: 17,
  OK: 7,
  OR: 8,
  PA: 19,
  RI: 4,
  SC: 9,
  SD: 3,
  TN: 11,
  TX: 40,
  UT: 6,
  VT: 3,
  VA: 13,
  WA: 12,
  WV: 4,
  WI: 10,
  WY: 3,
  DC: 3,
};

// ME/NE split EV units
const SPLIT_UNITS: EcUnit[] = [
  { id: "ME_AT_LARGE", label: "ME-AL", type: "ME_AT_LARGE", stateAbbr: "ME", ev: 2 },
  { id: "ME_CD1", label: "ME-01", type: "ME_CD1", stateAbbr: "ME", ev: 1 },
  { id: "ME_CD2", label: "ME-02", type: "ME_CD2", stateAbbr: "ME", ev: 1 },
  { id: "NE_AT_LARGE", label: "NE-AL", type: "NE_AT_LARGE", stateAbbr: "NE", ev: 2 },
  { id: "NE_CD1", label: "NE-01", type: "NE_CD1", stateAbbr: "NE", ev: 1 },
  { id: "NE_CD2", label: "NE-02", type: "NE_CD2", stateAbbr: "NE", ev: 1 },
  { id: "NE_CD3", label: "NE-03", type: "NE_CD3", stateAbbr: "NE", ev: 1 },
];

const STATE_ABBR_BY_NAME: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  NewHampshire: "NH",
  "New Hampshire": "NH",
  NewJersey: "NJ",
  "New Jersey": "NJ",
  NewMexico: "NM",
  "New Mexico": "NM",
  NewYork: "NY",
  "New York": "NY",
  NorthCarolina: "NC",
  "North Carolina": "NC",
  NorthDakota: "ND",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  RhodeIsland: "RI",
  "Rhode Island": "RI",
  SouthCarolina: "SC",
  "South Carolina": "SC",
  SouthDakota: "SD",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  WestVirginia: "WV",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
  DC: "DC",
};

// Label fine-tuning (kept)
const LABEL_OFFSETS: Record<string, { x: number; y: number }> = {
  HI: { x: -15, y: 10 },
  WV: { x: -2, y: 0 },
  LA: { x: -11, y: 0 },
  TX: { x: 6, y: 5 },
  CA: { x: -10, y: 0 },
  MI: { x: 16, y: 25 },
  FL: { x: 14, y: 1 },
};

// States to hide from the main map (because they are in the sidebar)
const SIDEBAR_STATES = ["NH", "VT", "CT", "NJ", "MA", "DE", "RI", "MD", "DC"];

function unitIdForState(abbr: string) {
  return `STATE_${abbr}`;
}

/* =========================
   Pick parsing (Unchanged)
========================= */
function partyFromPick(p: Pick): Party | "T" {
  if (p === "T") return "T";
  return p.startsWith("D_") ? "D" : "R";
}

function ratingFromPick(p: Pick): Rating | null {
  if (p === "T") return null;
  const parts = p.split("_");
  return (parts[1] as Rating) || null;
}

function fmtPick(p: Pick) {
  if (p === "T") return "Toss-up";
  const party = partyFromPick(p);
  const rating = ratingFromPick(p);
  return `${party} ${rating ? RATING_LABEL[rating] : ""}`.trim();
}

/* =========================
   Colors (Unchanged)
========================= */
const COLORS = {
  T: { base: "#6b7280", hover: "#9ca3af" },
  D: {
    SAFE: { base: "#1C408C", hover: "#2D5BB3" },
    LIKELY: { base: "#2F5FB8", hover: "#4A7AE0" },
    LEAN: { base: "#6FA3FF", hover: "#93BBFF" },
    TILT: { base: "#DCE8FF", hover: "#EEF4FF" },
  },
  R: {
    SAFE: { base: "#BF1D29", hover: "#D93644" },
    LIKELY: { base: "#D93644", hover: "#F04A57" },
    LEAN: { base: "#FF5865", hover: "#FF7A84" },
    TILT: { base: "#fcccd0", hover: "#fde1e3" },
  },
};

function fillForPick(p: Pick, hovered: boolean) {
  if (p === "T") return hovered ? COLORS.T.hover : COLORS.T.base;
  const party = partyFromPick(p);
  const rating = ratingFromPick(p) ?? "SAFE";
  if (party === "D") return hovered ? COLORS.D[rating].hover : COLORS.D[rating].base;
  return hovered ? COLORS.R[rating].hover : COLORS.R[rating].base;
}

function getTextColor(p: Pick) {
  if (p === "T") return "fill-white";
  const rating = ratingFromPick(p);
  if (p.startsWith("D_")) return rating === "TILT" || rating === "LEAN" ? "fill-black" : "fill-white";
  return rating === "TILT" || rating === "LEAN" ? "fill-black" : "fill-white";
}

/* =========================
   YAPMS click cycling rules (Unchanged)
========================= */
function nextRating(r: Rating): Rating {
  const i = RATING_CYCLE.indexOf(r);
  return RATING_CYCLE[(i + 1) % RATING_CYCLE.length];
}

function makePick(party: Party, rating: Rating): Pick {
  return `${party}_${rating}` as Pick;
}

function clickCycle(current: Pick, brush: PartyBrush): Pick {
  if (brush === "T") return "T";
  const party: Party = brush;
  if (current === "T") return makePick(party, "SAFE");
  const curParty = partyFromPick(current);
  const curRating = ratingFromPick(current);
  if (curParty !== party || !curRating) return makePick(party, "SAFE");
  return makePick(party, nextRating(curRating));
}

/* =========================
   ME/NE majority tint on base map (Unchanged; still available)
========================= */
function majorityPickForSplit(stateAbbr: "ME" | "NE", picks: Record<string, Pick>): Pick {
  const strength: Record<Rating, number> = { SAFE: 4, LIKELY: 3, LEAN: 2, TILT: 1 };
  function bestRating(ids: string[], party: Party): Rating {
    let best: Rating = "TILT";
    for (const id of ids) {
      const p = picks[id] ?? "T";
      if (partyFromPick(p) !== party) continue;
      const r = ratingFromPick(p) ?? "TILT";
      if (strength[r] > strength[best]) best = r;
    }
    return best;
  }

  const units =
    stateAbbr === "ME"
      ? ["ME_AT_LARGE", "ME_CD1", "ME_CD2"]
      : ["NE_AT_LARGE", "NE_CD1", "NE_CD2", "NE_CD3"];

  const dEV = units.reduce(
    (acc, id) => acc + (partyFromPick(picks[id] ?? "T") === "D" ? (id.includes("AL") ? 2 : 1) : 0),
    0
  );
  const rEV = units.reduce(
    (acc, id) => acc + (partyFromPick(picks[id] ?? "T") === "R" ? (id.includes("AL") ? 2 : 1) : 0),
    0
  );

  if (dEV === 0 && rEV === 0) return "T";
  if (dEV >= rEV) return makePick("D", bestRating(units, "D"));
  return makePick("R", bestRating(units, "R"));
}

/* =========================
   UI helpers (same behavior)
========================= */
function pillBase(active: boolean) {
  return ["psi-btn", active ? "psi-btn-primary" : "psi-btn-ghost", "whitespace-nowrap"].join(" ");
}

function brushPill(mode: PartyBrush, active: boolean) {
  const base = ["psi-btn", active ? "psi-btn-primary" : "psi-btn-ghost", "whitespace-nowrap"].join(" ");
  if (!active) return base;
  if (mode === "D") return `${base} !bg-[rgba(96,165,250,0.22)] !border-[rgba(96,165,250,0.45)] !text-white`;
  if (mode === "R") return `${base} !bg-[rgba(239,68,68,0.22)] !border-[rgba(239,68,68,0.45)] !text-white`;
  return `${base} !bg-[rgba(255,255,255,0.06)] !border-[rgba(255,255,255,0.22)] !text-white`;
}

function tileBtn(p: Pick) {
  const base =
    "w-full select-none border px-3 py-2 text-[11px] font-semibold tracking-[0.14em] uppercase transition hover:opacity-95";
  if (p === "T")
    return `${base} border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.78)]`;
  if (p.startsWith("D_")) return `${base} border-[var(--border)] bg-[rgba(96,165,250,0.14)] text-white`;
  return `${base} border-[var(--border)] bg-[rgba(239,68,68,0.14)] text-white`;
}

function fmtMarginRM(m: number) {
  if (!Number.isFinite(m)) return "—";
  if (m === 0) return "Tied";
  const party = m > 0 ? "R" : "D";
  const abs = Math.abs(m);
  return `${party}+${abs.toFixed(2)}`;
}

/* =========================
   Page (RE-HAUL: layout only)
========================= */
export default function ElectoralCollegeMapPage() {
  const [brush, setBrush] = useState<PartyBrush>("T");
  const [tip, setTip] = useState<Tip>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, Pick>>({});

  // ✅ FIX: load topojson from /public via fetch (reliable in Next)
  const [topo, setTopo] = useState<any | null>(null);
  const [topoErr, setTopoErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/us-states.json", { cache: "force-cache" });
        if (!res.ok) throw new Error(`Failed to load /us-states.json (${res.status})`);
        const json = await res.json();
        if (!cancelled) setTopo(json);
      } catch (e: any) {
        if (!cancelled) setTopoErr(e?.message ?? "Failed to load topojson");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const { mapFeatures, getStateMeta } = useMemo(() => {
    if (!topo) {
      return {
        mapFeatures: [] as any[],
        getStateMeta: (_name: string) => null as any,
      };
    }

    // ✅ Robust object key selection: use "states" if present, else first object
    const objKey =
      topo?.objects?.states ? "states" : topo?.objects ? Object.keys(topo.objects)[0] : null;

    if (!objKey) {
      return {
        mapFeatures: [] as any[],
        getStateMeta: (_name: string) => null as any,
      };
    }

    const fc = feature(topo, topo.objects[objKey]) as any;
    const mapFeatures = (fc?.features ?? []) as any[];

    const getStateMeta = (name: string) => {
      const clean = String(name ?? "").trim();
      if (!clean) return null;
      const abbr = STATE_ABBR_BY_NAME[clean] ?? STATE_ABBR_BY_NAME[clean.replace(/\s+/g, "")] ?? "";
      if (!abbr) return null;
      const ev = abbr === "ME" || abbr === "NE" ? 0 : STATE_EV[abbr] ?? 0;
      return { abbr, ev };
    };

    return { mapFeatures, getStateMeta };
  }, [topo]);

  const allUnits: EcUnit[] = useMemo(() => {
    const normal: EcUnit[] = Object.entries(STATE_EV).map(([abbr, ev]) => ({
      id: unitIdForState(abbr),
      label: abbr,
      type: "STATE",
      stateAbbr: abbr,
      ev,
    }));
    const filtered = normal.filter((u) => u.stateAbbr !== "ME" && u.stateAbbr !== "NE");
    return [...filtered, ...SPLIT_UNITS];
  }, []);

  const totals = useMemo(() => {
    let D = 0,
      R = 0,
      T = 0;
    for (const u of allUnits) {
      const p = picks[u.id] ?? "T";
      const party = partyFromPick(p);
      if (party === "D") D += u.ev;
      else if (party === "R") R += u.ev;
      else T += u.ev;
    }
    return { D, R, T };
  }, [picks, allUnits]);

  // Keep your coordinate system stable with viewBox 1000x600
  const projection = useMemo(() => geoAlbersUsa().translate([535, 300]).scale(1150), []);
  const path = useMemo(() => geoPath(projection), [projection]);

  function clickUnit(unitId: string) {
    const cur = picks[unitId] ?? "T";
    const next = clickCycle(cur, brush);
    setPicks((prev) => ({ ...prev, [unitId]: next }));
  }

  function clickState(abbr: string) {
    if (abbr === "ME") ["ME_AT_LARGE", "ME_CD1", "ME_CD2"].forEach(clickUnit);
    else if (abbr === "NE") ["NE_AT_LARGE", "NE_CD1", "NE_CD2", "NE_CD3"].forEach(clickUnit);
    else clickUnit(unitIdForState(abbr));
  }

  function handleContextMenuState(e: React.MouseEvent, title: string, ev: number, pick: Pick) {
    e.preventDefault();

    let abbr: string | null = null;
    const clean = String(title ?? "").trim();

    if (clean.length === 2 && /^[A-Z]{2}$/.test(clean)) abbr = clean;
    else if (clean.startsWith("ME")) abbr = "ME";
    else if (clean.startsWith("NE")) abbr = "NE";
    else abbr = STATE_ABBR_BY_NAME[clean] ?? STATE_ABBR_BY_NAME[clean.replace(/\s+/g, "")] ?? null;

    setTip({
      x: e.clientX + 12,
      y: e.clientY + 12,
      title,
      subtitle: "Right-click panel coming next",
      ev,
      pick,
      abbr,
    });
  }

  const ME_UNITS = SPLIT_UNITS.filter((u) => u.stateAbbr === "ME");
  const NE_UNITS = SPLIT_UNITS.filter((u) => u.stateAbbr === "NE");
  const RIGHT_COLUMN = ["NH", "VT", "CT", "NJ", "MA", "DE", "RI", "MD", "DC"] as const;

  const selectedPast = tip?.abbr ? PAST_DATA_BY_STATE[tip.abbr] : undefined;

  // small UI state for the new layout
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  return (
    <div
      className="fixed inset-x-6 bottom-6 top-[var(--site-nav-h,105px)] overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Frame */}
      <div className="psi-glass relative h-full w-full flex flex-col min-h-0">
        {/* ============ HEADER (Broadcast / Score strip) ============ */}
        <header className="shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {/* Left identity */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="psi-live-dot" />
              <div className="min-w-0">
                <div className="psi-label psi-label-amber">LIVE MODEL</div>
                <div className="mt-0.5 text-[12px] font-semibold tracking-[0.10em] uppercase text-white/90 truncate">
                  Electoral College Simulator
                </div>
              </div>

              <div className="hidden md:block h-4 w-px" style={{ background: "var(--border)" }} />
              <div className="hidden md:flex items-center gap-2">
                <span className="psi-badge psi-badge-amber">538 EV</span>
                <span className="psi-badge">270 to win</span>
              </div>
            </div>

            {/* Center totals chips */}
            <div className="flex items-center gap-2">
              <button type="button" className={brushPill("T", brush === "T")} onClick={() => setBrush("T")}>
                Toss-up <span className="psi-mono">{totals.T}</span>
              </button>
              <button type="button" className={brushPill("D", brush === "D")} onClick={() => setBrush("D")}>
                Democrat <span className="psi-mono">{totals.D}</span>
              </button>
              <button type="button" className={brushPill("R", brush === "R")} onClick={() => setBrush("R")}>
                Republican <span className="psi-mono">{totals.R}</span>
              </button>
            </div>

            {/* Right utilities */}
            <div className="flex items-center gap-2">
              <button type="button" className={pillBase(false)} onClick={() => setLeftOpen((v) => !v)}>
                {leftOpen ? "Hide" : "Show"} Left
              </button>
              <button type="button" className={pillBase(false)} onClick={() => setRightOpen((v) => !v)}>
                {rightOpen ? "Hide" : "Show"} Right
              </button>
              <button type="button" className={pillBase(false)} onClick={() => setPicks({})}>
                Clear
              </button>
            </div>
          </div>

          {/* Presets row (still the same actions) */}
          <div className="px-4 pb-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className={pillBase(false)}
                onClick={() =>
                  setPicks({
                    STATE_AL: "R_SAFE",
                    STATE_AK: "R_SAFE",
                    STATE_AR: "R_SAFE",
                    STATE_FL: "T",
                    STATE_ID: "R_SAFE",
                    STATE_IN: "R_SAFE",
                    STATE_IA: "T",
                    STATE_KS: "R_SAFE",
                    STATE_KY: "R_SAFE",
                    STATE_LA: "R_SAFE",
                    STATE_MS: "R_SAFE",
                    STATE_MO: "R_SAFE",
                    STATE_MT: "R_SAFE",
                    STATE_ND: "R_SAFE",
                    STATE_OK: "R_SAFE",
                    STATE_SC: "R_SAFE",
                    STATE_SD: "R_SAFE",
                    STATE_TN: "R_SAFE",
                    STATE_TX: "R_SAFE",
                    STATE_UT: "R_SAFE",
                    STATE_WV: "R_SAFE",
                    STATE_WY: "R_SAFE",

                    STATE_OH: "T",

                    STATE_CA: "D_SAFE",
                    STATE_CT: "D_SAFE",
                    STATE_DE: "D_SAFE",
                    STATE_HI: "D_SAFE",
                    STATE_MD: "D_SAFE",
                    STATE_MA: "D_SAFE",
                    STATE_NY: "D_SAFE",
                    STATE_OR: "D_SAFE",
                    STATE_RI: "D_SAFE",
                    STATE_VT: "D_SAFE",
                    STATE_WA: "D_SAFE",
                    STATE_DC: "D_SAFE",

                    STATE_CO: "D_SAFE",
                    STATE_IL: "D_SAFE",
                    STATE_NM: "D_SAFE",

                    ME_AT_LARGE: "D_SAFE",
                    ME_CD1: "D_SAFE",
                    ME_CD2: "T",

                    NE_AT_LARGE: "R_SAFE",
                    NE_CD1: "R_SAFE",
                    NE_CD2: "T",
                    NE_CD3: "R_SAFE",

                    STATE_AZ: "T",
                    STATE_GA: "T",
                    STATE_MI: "T",
                    STATE_MN: "D_SAFE",
                    STATE_NV: "T",
                    STATE_NH: "D_SAFE",
                    STATE_NJ: "D_SAFE",
                    STATE_NC: "R_SAFE",
                    STATE_PA: "T",
                    STATE_VA: "D_SAFE",
                    STATE_WI: "T",
                  })
                }
              >
                Same Since 2012
              </button>

              <button
                type="button"
                className={pillBase(false)}
                onClick={() =>
                  setPicks({
                    STATE_AL: "R_SAFE",
                    STATE_AK: "R_SAFE",
                    STATE_AR: "R_SAFE",
                    STATE_FL: "R_SAFE",
                    STATE_ID: "R_SAFE",
                    STATE_IN: "R_SAFE",
                    STATE_IA: "R_SAFE",
                    STATE_KS: "R_SAFE",
                    STATE_KY: "R_SAFE",
                    STATE_LA: "R_SAFE",
                    STATE_MS: "R_SAFE",
                    STATE_MO: "R_SAFE",
                    STATE_MT: "R_SAFE",
                    STATE_ND: "R_SAFE",
                    STATE_OK: "R_SAFE",
                    STATE_SC: "R_SAFE",
                    STATE_SD: "R_SAFE",
                    STATE_TN: "R_SAFE",
                    STATE_TX: "R_SAFE",
                    STATE_UT: "R_SAFE",
                    STATE_WV: "R_SAFE",
                    STATE_WY: "R_SAFE",

                    STATE_OH: "R_LIKELY",

                    STATE_CA: "D_SAFE",
                    STATE_CT: "D_SAFE",
                    STATE_DE: "D_SAFE",
                    STATE_HI: "D_SAFE",
                    STATE_MD: "D_SAFE",
                    STATE_MA: "D_SAFE",
                    STATE_NY: "D_SAFE",
                    STATE_OR: "D_SAFE",
                    STATE_RI: "D_SAFE",
                    STATE_VT: "D_SAFE",
                    STATE_WA: "D_SAFE",
                    STATE_DC: "D_SAFE",

                    STATE_CO: "D_LIKELY",
                    STATE_IL: "D_LIKELY",
                    STATE_NM: "D_LIKELY",

                    ME_AT_LARGE: "D_LIKELY",
                    ME_CD1: "D_SAFE",
                    ME_CD2: "R_LIKELY",

                    NE_AT_LARGE: "R_SAFE",
                    NE_CD1: "R_SAFE",
                    NE_CD2: "D_LIKELY",
                    NE_CD3: "R_SAFE",

                    STATE_AZ: "R_LEAN",
                    STATE_GA: "R_LEAN",
                    STATE_MI: "R_TILT",
                    STATE_MN: "D_LEAN",
                    STATE_NV: "R_LEAN",
                    STATE_NH: "D_LEAN",
                    STATE_NJ: "D_LEAN",
                    STATE_NC: "R_LEAN",
                    STATE_PA: "R_TILT",
                    STATE_VA: "D_LEAN",
                    STATE_WI: "R_TILT",
                  })
                }
              >
                2024 Results
              </button>

              <button
                type="button"
                className={pillBase(false)}
                onClick={() =>
                  setPicks({
                    STATE_AL: "R_SAFE",
                    STATE_AR: "R_SAFE",
                    STATE_ID: "R_SAFE",
                    STATE_IN: "R_SAFE",
                    STATE_KS: "R_SAFE",
                    STATE_KY: "R_SAFE",
                    STATE_LA: "R_SAFE",
                    STATE_MS: "R_SAFE",
                    STATE_MO: "R_SAFE",
                    STATE_MT: "R_SAFE",
                    STATE_ND: "R_SAFE",
                    STATE_OK: "R_SAFE",
                    STATE_SC: "R_SAFE",
                    STATE_SD: "R_SAFE",
                    STATE_TN: "R_SAFE",
                    STATE_UT: "R_SAFE",
                    STATE_WV: "R_SAFE",
                    STATE_WY: "R_SAFE",

                    STATE_AK: "R_LIKELY",
                    STATE_FL: "R_LIKELY",
                    STATE_IA: "R_LIKELY",
                    STATE_OH: "R_LIKELY",
                    STATE_TX: "R_LIKELY",

                    STATE_CA: "D_SAFE",
                    STATE_CO: "D_SAFE",
                    STATE_CT: "D_SAFE",
                    STATE_DE: "D_SAFE",
                    STATE_HI: "D_SAFE",
                    STATE_IL: "D_SAFE",
                    STATE_MD: "D_SAFE",
                    STATE_MA: "D_SAFE",
                    STATE_MN: "D_SAFE",
                    STATE_NM: "D_SAFE",
                    STATE_NY: "D_SAFE",
                    STATE_OR: "D_SAFE",
                    STATE_RI: "D_SAFE",
                    STATE_VT: "D_SAFE",
                    STATE_VA: "D_SAFE",
                    STATE_WA: "D_SAFE",
                    STATE_DC: "D_SAFE",

                    ME_AT_LARGE: "D_LIKELY",
                    ME_CD1: "D_SAFE",
                    ME_CD2: "R_LIKELY",
                    STATE_NH: "D_LIKELY",
                    STATE_NJ: "D_LIKELY",

                    NE_AT_LARGE: "R_SAFE",
                    NE_CD1: "R_LIKELY",
                    NE_CD2: "D_LIKELY",
                    NE_CD3: "R_SAFE",

                    STATE_AZ: "T",
                    STATE_GA: "T",
                    STATE_MI: "T",
                    STATE_NV: "T",
                    STATE_NC: "T",
                    STATE_PA: "T",
                    STATE_WI: "T",
                  })
                }
              >
                2028 Battleground
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <span className="psi-badge psi-badge-amber">Click</span>
              <span className="psi-badge">Safe → Likely → Lean → Tilt</span>
              <span className="psi-badge">Right-click for history</span>
            </div>
          </div>
        </header>

        {/* ============ BODY (Panels + Map) ============ */}
        <div
          className={[
            "flex-1 min-h-0 grid overflow-hidden",
            leftOpen && rightOpen ? "grid-cols-[320px_1fr_320px]" : "",
            leftOpen && !rightOpen ? "grid-cols-[320px_1fr]" : "",
            !leftOpen && rightOpen ? "grid-cols-[1fr_320px]" : "",
            !leftOpen && !rightOpen ? "grid-cols-[1fr]" : "",
          ].join(" ")}
        >
          {/* LEFT: Control / Legend / EV bar */}
          {leftOpen && (
            <aside className="min-h-0 overflow-hidden" style={{ borderRight: "1px solid var(--border)" }}>
              <div className="h-full min-h-0 p-4 flex flex-col gap-4 overflow-hidden">
                {/* Totals card */}
                <div className="psi-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="psi-label psi-label-amber">Totals</div>
                    <span className="psi-badge">538</span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="psi-inset px-3 py-3">
                      <div className="psi-label" style={{ color: "var(--dem)" }}>
                        DEM
                      </div>
                      <div className="mt-1 text-[18px] font-semibold psi-mono text-white">{totals.D}</div>
                    </div>
                    <div className="psi-inset px-3 py-3">
                      <div className="psi-label" style={{ color: "var(--rep)" }}>
                        GOP
                      </div>
                      <div className="mt-1 text-[18px] font-semibold psi-mono text-white">{totals.R}</div>
                    </div>
                    <div className="psi-inset px-3 py-3">
                      <div className="psi-label">TOSS</div>
                      <div className="mt-1 text-[18px] font-semibold psi-mono text-white">{totals.T}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4 psi-inset p-3">
                    <div className="flex items-center justify-between">
                      <div className="psi-label">EV bar</div>
                      <span className="psi-badge psi-badge-amber">270</span>
                    </div>
                    <div className="mt-3 h-3 w-full overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                      <div className="h-full flex">
                        <div style={{ width: `${(totals.D / 538) * 100}%`, background: "rgba(96,165,250,0.70)" }} />
                        <div style={{ width: `${(totals.T / 538) * 100}%`, background: "rgba(255,255,255,0.12)" }} />
                        <div style={{ width: `${(totals.R / 538) * 100}%`, background: "rgba(239,68,68,0.70)" }} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--muted)" }}>
                      <span className="psi-mono">D {totals.D}</span>
                      <span className="psi-mono">T {totals.T}</span>
                      <span className="psi-mono">R {totals.R}</span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="psi-card p-4">
                  <div className="psi-label psi-label-amber">Legend</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    {(["SAFE", "LIKELY", "LEAN", "TILT"] as Rating[]).map((r) => (
                      <div key={r} className="psi-inset px-3 py-2">
                        <div className="psi-label">{RATING_LABEL[r]}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-block h-2 w-6" style={{ background: COLORS.D[r].base }} />
                          <span className="inline-block h-2 w-6" style={{ background: COLORS.R[r].base }} />
                          <span className="psi-label" style={{ color: "var(--muted2)" }}>
                            D / R
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instruction strip */}
                <div className="psi-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="psi-label psi-label-amber">How it works</div>
                    <span className="psi-badge">YAPMS</span>
                  </div>
                  <div className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
                    Use the brush in the header.
                    <br />
                    Click a state to cycle:{" "}
                    <span className="text-white/90 font-semibold">Safe → Likely → Lean → Tilt</span>.
                    <br />
                    Right-click any state for its 2012–2024 history.
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* CENTER: Map stage */}
          <main className="min-h-0 overflow-hidden">
            <div className="h-full min-h-0 p-4">
              <div className="psi-card h-full w-full p-3 flex flex-col min-h-0">
                {/* Map header */}
                <div className="flex items-center justify-between px-2 pb-3">
                  <div className="min-w-0">
                    <div className="psi-label psi-label-amber">Map</div>
                    <div className="mt-0.5 text-[12px] font-semibold tracking-[0.10em] uppercase text-white/90 truncate">
                      Click to rate · Right-click for history
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="psi-badge">Brush: {BRUSH_LABEL[brush]}</span>
                    <span className="psi-badge psi-badge-amber">Hover: {hoverKey ? "ON" : "—"}</span>
                  </div>
                </div>

                {/* Stage: ME/NE chips overlay + map */}
                <div className="relative flex-1 min-h-0">
                  {/* Split chip dock (top-left) */}
                  <div className="absolute left-3 top-3 z-10 flex gap-3">
                    {[{ name: "NE", units: NE_UNITS }, { name: "ME", units: ME_UNITS }].map((s) => (
                      <div key={s.name} className="psi-card p-2">
                        <div className="px-2 pt-1 pb-2 flex items-center justify-between gap-2">
                          <div className="psi-label psi-label-amber">{s.name} Split</div>
                          <span className="psi-badge">Units</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                          {s.units.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              className={`${tileBtn(picks[u.id] ?? "T")} py-1`}
                              onClick={() => clickUnit(u.id)}
                              onContextMenu={(e) => handleContextMenuState(e, u.label, u.ev, picks[u.id] ?? "T")}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="psi-mono">{u.label}</span>
                                <span className="psi-mono" style={{ color: "var(--muted2)" }}>
                                  {u.ev}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Map */}
                  <div className="psi-inset overflow-hidden h-full relative">
                    {/* ✅ Topo loading / error overlay */}
                    {!topo && !topoErr && (
                      <div className="absolute inset-0 grid place-items-center">
                        <div className="psi-badge">Loading map…</div>
                      </div>
                    )}
                    {topoErr && (
                      <div className="absolute inset-0 grid place-items-center p-6 text-center">
                        <div className="psi-card p-4 max-w-[520px]">
                          <div className="psi-label psi-label-red">Map failed to load</div>
                          <div className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
                            {topoErr}
                            <br />
                            Check that <span className="psi-mono">/public/us-states.json</span> exists and is reachable.
                          </div>
                        </div>
                      </div>
                    )}

                    <svg viewBox="0 0 1000 600" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                      <g>
                        {mapFeatures.map((f: any, idx: number) => {
                          const name = String(f?.properties?.name ?? "").trim();
                          const meta = getStateMeta(name);
                          const d = (path as any)(f) || undefined;

                          if (!meta)
                            return (
                              <path
                                key={idx}
                                d={d}
                                style={{ fill: "rgba(255,255,255,0.04)" }}
                                className="stroke-[rgba(255,255,255,0.08)]"
                                strokeWidth={0.5}
                              />
                            );

                          let pick: Pick = "T";
                          if (meta.abbr === "ME") pick = picks["ME_AT_LARGE"] ?? "T";
                          else if (meta.abbr === "NE") pick = picks["NE_AT_LARGE"] ?? "T";
                          else pick = picks[unitIdForState(meta.abbr)] ?? "T";

                          const ev = meta.abbr === "ME" ? 4 : meta.abbr === "NE" ? 5 : STATE_EV[meta.abbr] ?? 0;

                          const key =
                            meta.abbr === "ME" ? "STATE_ME" : meta.abbr === "NE" ? "STATE_NE" : unitIdForState(meta.abbr);

                          const centroid = path.centroid(f);
                          const offset = LABEL_OFFSETS[meta.abbr] ?? { x: 0, y: 0 };
                          const shouldShowLabel = !SIDEBAR_STATES.includes(meta.abbr);

                          return (
                            <g key={idx}>
                              <path
                                d={d}
                                style={{
                                  fill: fillForPick(pick, hoverKey === key),
                                  filter: hoverKey === key ? "brightness(1.05) saturate(1.05)" : undefined,
                                }}
                                className="cursor-pointer transition duration-150"
                                stroke="rgba(245,158,11,0.18)"
                                strokeWidth={hoverKey === key ? 1.25 : 0.9}
                                onMouseEnter={() => setHoverKey(key)}
                                onMouseLeave={() => {
                                  setHoverKey((k) => (k === key ? null : k));
                                  setTip(null);
                                }}
                                onClick={() => clickState(meta.abbr)}
                                onContextMenu={(e) => handleContextMenuState(e, name, ev, pick)}
                              />
                              {centroid[0] && centroid[1] && shouldShowLabel && (
                                <text
                                  x={centroid[0] + offset.x}
                                  y={centroid[1] + offset.y}
                                  textAnchor="middle"
                                  className={`pointer-events-none text-[10px] font-bold ${getTextColor(pick)}`}
                                  style={{ dominantBaseline: "central" }}
                                >
                                  {meta.abbr} {ev > 0 ? ev : ""}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    </svg>
                  </div>
                </div>

                {/* Bottom ticker */}
                <div className="mt-3 psi-divider" />
                <div className="mt-3 flex items-center justify-between px-2">
                  <div className="psi-label">
                    Tip: <span className="psi-label-amber">Right-click</span> any state for 2012–2024 trend.
                  </div>
                  <div className="psi-label">
                    Totals:{" "}
                    <span className="psi-mono" style={{ color: "var(--dem)" }}>
                      D {totals.D}
                    </span>{" "}
                    ·{" "}
                    <span className="psi-mono" style={{ color: "var(--rep)" }}>
                      R {totals.R}
                    </span>{" "}
                    ·{" "}
                    <span className="psi-mono" style={{ color: "var(--muted)" }}>
                      T {totals.T}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* RIGHT: Small states + quick actions */}
          {rightOpen && (
            <aside className="min-h-0 overflow-hidden" style={{ borderLeft: "1px solid var(--border)" }}>
              <div className="h-full min-h-0 p-4 flex flex-col gap-4 overflow-hidden">
                <div className="psi-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="psi-label psi-label-amber">Small states</div>
                    <span className="psi-badge">Sidebar</span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {RIGHT_COLUMN.map((abbr) => (
                      <button
                        key={abbr}
                        type="button"
                        className={`${tileBtn(picks[unitIdForState(abbr)] ?? "T")} py-2`}
                        onClick={() => clickState(abbr)}
                        onContextMenu={(e) =>
                          handleContextMenuState(e, abbr, STATE_EV[abbr] ?? 0, picks[unitIdForState(abbr)] ?? "T")
                        }
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="psi-mono">{abbr}</span>
                          <span className="psi-mono" style={{ color: "var(--muted2)" }}>
                            {STATE_EV[abbr]}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 psi-inset px-3 py-3">
                    <div className="psi-label">Hotkeys</div>
                    <div className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
                      Left-click: cycle rating
                      <br />
                      Brush buttons: set party
                      <br />
                      Right-click: history panel
                    </div>
                  </div>
                </div>

                {/* Quick legend mini */}
                <div className="psi-card p-4">
                  <div className="psi-label psi-label-amber">Quick</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="psi-inset px-3 py-3">
                      <div className="psi-label">ME tint</div>
                      <div className="mt-2 psi-mono text-[12px]" style={{ color: "var(--muted)" }}>
                        {fmtPick(majorityPickForSplit("ME", picks))}
                      </div>
                    </div>
                    <div className="psi-inset px-3 py-3">
                      <div className="psi-label">NE tint</div>
                      <div className="mt-2 psi-mono text-[12px]" style={{ color: "var(--muted)" }}>
                        {fmtPick(majorityPickForSplit("NE", picks))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Tooltip (same content/logic) */}
      {tip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] psi-tooltip p-4"
            style={{
              width: "min(560px, calc(100vw - 24px))",
              maxWidth: "calc(100vw - 24px)",
              maxHeight: "calc(100vh - 24px)",
              left: Math.min(tip.x, window.innerWidth - 12 - 560),
              top: Math.min(tip.y, window.innerHeight - 12 - 520),
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-white/95 break-words uppercase tracking-[0.06em]">
                  {tip.title}
                </div>
                {tip.subtitle && (
                  <div className="mt-1 text-[12px] break-words" style={{ color: "var(--muted)" }}>
                    {tip.subtitle}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="psi-badge psi-badge-amber">{tip.ev} EV</span>
                <span className="psi-badge">{selectedPast?.abbr ?? "—"}</span>
              </div>
            </div>

            <div className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
              Pick: <span className="font-semibold text-white/95">{fmtPick(tip.pick)}</span>
            </div>

            {/* Past performance */}
            <div className="mt-3 psi-inset p-3">
              <div className="flex items-center justify-between">
                <div className="psi-label psi-label-amber">Past performance{selectedPast ? ` — ${selectedPast.name}` : ""}</div>
                <span className="psi-badge">2012–2024</span>
              </div>

              {!selectedPast ? (
                <div className="mt-2 text-[12px] break-words" style={{ color: "var(--muted)" }}>
                  Right-click any state to show its 2012–2024 margins and shift summary here.
                </div>
              ) : (
                <div className="mt-3 space-y-3 text-[12px] text-white/85">
                  {/* Margins */}
                  <div className="psi-inset p-2">
                    <div className="psi-label">Margins</div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                      <div style={{ color: "var(--muted2)" }}>2012</div>
                      <div className="text-right font-semibold psi-mono">{fmtMarginRM(selectedPast.margins.y2012)}</div>
                      <div style={{ color: "var(--muted2)" }}>2016</div>
                      <div className="text-right font-semibold psi-mono">{fmtMarginRM(selectedPast.margins.y2016)}</div>
                      <div style={{ color: "var(--muted2)" }}>2020</div>
                      <div className="text-right font-semibold psi-mono">{fmtMarginRM(selectedPast.margins.y2020)}</div>
                      <div style={{ color: "var(--muted2)" }}>2024</div>
                      <div className="text-right font-semibold psi-mono">{fmtMarginRM(selectedPast.margins.y2024)}</div>
                      <div style={{ color: "var(--muted2)" }}>Trend (12→24)</div>
                      <div className="text-right font-semibold psi-mono">
                        {selectedPast.trend_2012_to_2024 > 0 ? "+" : ""}
                        {selectedPast.trend_2012_to_2024.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="psi-inset p-2">
                    <div className="psi-label">Summary</div>
                    <div className="mt-2 break-words leading-relaxed" style={{ color: "var(--muted)" }}>
                      {selectedPast.shiftSummary}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}