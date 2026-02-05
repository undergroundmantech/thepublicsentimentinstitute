// app/elections/electoral-college/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";

// ✅ past performance dataset (statewide)
import { PAST_DATA_BY_STATE } from "@/app/polling/data/pastdata";

// Assuming you have a TopoJSON file for US states
import usStates from "@/public/us-states.json";

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

      // ✅ NEW (tooltip-only): which state should we show pastdata for?
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
  AL: 9, AK: 3, AZ: 11, AR: 6, CA: 54, CO: 10, CT: 7, DE: 3, FL: 30, GA: 16,
  HI: 4, ID: 4, IL: 19, IN: 11, IA: 6, KS: 6, KY: 8, LA: 8, MD: 10, MA: 11,
  MI: 15, MN: 10, MS: 6, MO: 10, MT: 4, NV: 6, NH: 4, NJ: 14, NM: 5, NY: 28,
  NC: 16, ND: 3, OH: 17, OK: 7, OR: 8, PA: 19, RI: 4, SC: 9, SD: 3, TN: 11,
  TX: 40, UT: 6, VT: 3, VA: 13, WA: 12, WV: 4, WI: 10, WY: 3, DC: 3,
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
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", NewHampshire: "NH",
  "New Hampshire": "NH", NewJersey: "NJ", "New Jersey": "NJ", NewMexico: "NM",
  "New Mexico": "NM", NewYork: "NY", "New York": "NY", NorthCarolina: "NC",
  "North Carolina": "NC", NorthDakota: "ND", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", RhodeIsland: "RI",
  "Rhode Island": "RI", SouthCarolina: "SC", "South Carolina": "SC", SouthDakota: "SD",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", WestVirginia: "WV", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC", DC: "DC",
};

// --- NEW CONSTANTS FOR LABEL CUSTOMIZATION ---
const LABEL_OFFSETS: Record<string, { x: number; y: number }> = {
  // Add custom offsets here: { x: horizontal, y: vertical }
  HI: { x: -15, y: 10 },
  WV: { x: -2, y: 0 },
  LA: { x: -11, y: 0 },
  TX: { x: 6, y: 5 },
  CA: { x: -10, y: 0 },
  MI: { x: 16, y: 25 },
  FL: { x: 14, y: 1 },
  // ... add more as needed
};

// States to hide from the main map (because they are in the sidebar)
const SIDEBAR_STATES = ["NH", "VT", "CT", "NJ", "MA", "DE", "RI", "MD", "DC"];
// ----------------------------------------------

function unitIdForState(abbr: string) {
  return `STATE_${abbr}`;
}

/* =========================
   Pick parsing
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
   Colors - UPDATED
========================= */
const COLORS = {
  // Toss-up
  T: {
    base: "#6b7280",
    hover: "#9ca3af",
  },

  // Democrat
  D: {
    SAFE: { base: "#1C408C", hover: "#2D5BB3" },
    LIKELY: { base: "#2F5FB8", hover: "#4A7AE0" },
    LEAN: { base: "#6FA3FF", hover: "#93BBFF" },
    TILT: { base: "#DCE8FF", hover: "#EEF4FF" },
  },

  // Republican
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

// Helper to determine text color based on background
function getTextColor(p: Pick) {
  if (p === "T") return "fill-white";
  const rating = ratingFromPick(p);
  if (p.startsWith("D_")) return rating === "TILT" || rating === "LEAN" ? "fill-black" : "fill-white";
  return rating === "TILT" || rating === "LEAN" ? "fill-black" : "fill-white";
}

/* =========================
   YAPMS click cycling rules
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
   ME/NE majority tint on base map
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
   UI helpers
========================= */
function pillBase(active: boolean) {
  return [
    "select-none rounded-md border px-3 py-1.5 text-xs font-semibold transition",
    active ? "border-white/25 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
  ].join(" ");
}

function brushPill(mode: PartyBrush, active: boolean) {
  const base = "select-none rounded-md border px-3 py-1.5 text-xs font-semibold transition";
  if (mode === "D")
    return `${base} ${
      active
        ? "border-[rgba(59,130,246,0.55)] bg-[rgba(59,130,246,0.20)] text-white"
        : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
    }`;
  if (mode === "R")
    return `${base} ${
      active
        ? "border-[rgba(239,68,68,0.55)] bg-[rgba(239,68,68,0.20)] text-white"
        : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
    }`;
  return `${base} ${
    active ? "border-white/25 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
  }`;
}

function tileBtn(p: Pick) {
  const base = "w-full select-none rounded-md border px-3 py-2 text-xs font-semibold transition hover:bg-white/8";
  if (p === "T") return `${base} border-white/10 bg-white/5 text-white/80`;
  if (p.startsWith("D_")) return `${base} border-white/10 bg-[rgba(59,130,246,0.18)] text-white`;
  return `${base} border-white/10 bg-[rgba(239,68,68,0.18)] text-white`;
}

function fmtNum(n: number) {
  return Intl.NumberFormat("en-US").format(n);
}

function fmtMarginRM(m: number) {
  if (!Number.isFinite(m)) return "—";
  if (m === 0) return "Tied";
  const party = m > 0 ? "R" : "D";
  const abs = Math.abs(m);
  return `${party}+${abs.toFixed(2)}`;
}

/* =========================
   Page
========================= */
export default function ElectoralCollegeMapPage() {
  const [brush, setBrush] = useState<PartyBrush>("T");
  const [tip, setTip] = useState<Tip>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, Pick>>({});

  const { mapFeatures, getStateMeta } = useMemo(() => {
    const topo: any = usStates;
    const fc = feature(topo, topo.objects.states) as any;
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
  }, []);

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
    let D = 0, R = 0, T = 0;
    for (const u of allUnits) {
      const p = picks[u.id] ?? "T";
      const party = partyFromPick(p);
      if (party === "D") D += u.ev;
      else if (party === "R") R += u.ev;
      else T += u.ev;
    }
    return { D, R, T };
  }, [picks, allUnits]);

  // Dynamic projection adjustment based on container size
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

    // ✅ capture abbr for tooltip dataset lookup (best-effort parsing)
    let abbr: string | null = null;

    // Cases:
    // - title is full state name (map right-click)
    // - title is "NH" etc (right panel small states)
    // - title is "ME-AL", "NE-02" (split buttons) -> use stateAbbr
    const clean = String(title ?? "").trim();

    if (clean.length === 2 && /^[A-Z]{2}$/.test(clean)) {
      abbr = clean;
    } else if (clean.startsWith("ME")) {
      abbr = "ME";
    } else if (clean.startsWith("NE")) {
      abbr = "NE";
    } else {
      abbr = STATE_ABBR_BY_NAME[clean] ?? STATE_ABBR_BY_NAME[clean.replace(/\s+/g, "")] ?? null;
    }

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
  const [showInstructions, setShowInstructions] = useState(true);

  // ✅ lookup for tooltip
  const selectedPast = tip?.abbr ? PAST_DATA_BY_STATE[tip.abbr] : undefined;

  return (
    <div className="fixed left-6 right-6 bottom-6 top-[var(--site-nav-h,105px)] overflow-hidden bg-black">
      <div className="relative h-full w-full">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.06),transparent_50%),radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.05),transparent_55%)] animate-[bgfloat_10s_ease-in-out_infinite]" />
        </div>
        {/* Background Gradients */}
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -left-40 -top-40 h-[620px] w-[620px] rounded-full bg-[rgba(34,197,94,0.1)] blur-3xl" />
          <div className="absolute -right-40 top-10 h-[720px] w-[720px] rounded-full bg-[rgba(255,79,216,0.1)] blur-3xl" />
        </div>

        {/* Content Panel */}
        <div className="relative flex h-full flex-col bg-black/40 backdrop-blur">
          {/* Header/Controls */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="text-xs font-semibold text-white/70">Interactive Electoral Map</div>
            <div className="flex items-center gap-2">
              <button type="button" className={brushPill("T", brush === "T")} onClick={() => setBrush("T")}>
                Tossup {totals.T}
              </button>
              <button type="button" className={brushPill("D", brush === "D")} onClick={() => setBrush("D")}>
                Democrat {totals.D}
              </button>
              <button type="button" className={brushPill("R", brush === "R")} onClick={() => setBrush("R")}>
                Republican {totals.R}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={pillBase(false)}
                onClick={() =>
                  setPicks({
                    // SAFE R
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

                    // LIKELY R
                    STATE_OH: "T",

                    // SAFE D
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

                    // LIKELY D
                    STATE_CO: "D_SAFE",
                    STATE_IL: "D_SAFE",
                    STATE_NM: "D_SAFE",

                    // Maine split
                    ME_AT_LARGE: "D_SAFE",
                    ME_CD1: "D_SAFE",
                    ME_CD2: "T",

                    // Nebraska split
                    NE_AT_LARGE: "R_SAFE",
                    NE_CD1: "R_SAFE",
                    NE_CD2: "T",
                    NE_CD3: "R_SAFE",

                    // LEAN / TILT → Toss-up
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
                Voted The Same Since 2012
              </button>
              <button
                type="button"
                className={pillBase(false)}
                onClick={() =>
                  setPicks({
                    // SAFE R
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

                    // LIKELY R
                    STATE_OH: "R_LIKELY",

                    // SAFE D
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

                    // LIKELY D
                    STATE_CO: "D_LIKELY",
                    STATE_IL: "D_LIKELY",
                    STATE_NM: "D_LIKELY",

                    // Maine split
                    ME_AT_LARGE: "D_LIKELY",
                    ME_CD1: "D_SAFE",
                    ME_CD2: "R_LIKELY",

                    // Nebraska split
                    NE_AT_LARGE: "R_SAFE",
                    NE_CD1: "R_SAFE",
                    NE_CD2: "D_LIKELY",
                    NE_CD3: "R_SAFE",

                    // LEAN / TILT → Toss-up
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
                2024 Election Results
              </button>
              <button
                type="button"
                className={pillBase(false)}
                onClick={() =>
                  setPicks({
                    // SAFE R
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

                    // LIKELY R
                    STATE_AK: "R_LIKELY",
                    STATE_FL: "R_LIKELY",
                    STATE_IA: "R_LIKELY",
                    STATE_OH: "R_LIKELY",
                    STATE_TX: "R_LIKELY",

                    // SAFE D
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

                    // LIKELY D
                    ME_AT_LARGE: "D_LIKELY",
                    ME_CD1: "D_SAFE",
                    ME_CD2: "R_LIKELY",
                    STATE_NH: "D_LIKELY",
                    STATE_NJ: "D_LIKELY",

                    // NE is split units (SAFE R)
                    NE_AT_LARGE: "R_SAFE",
                    NE_CD1: "R_LIKELY",
                    NE_CD2: "D_LIKELY",
                    NE_CD3: "R_SAFE",

                    // LEAN/TILT -> Toss-up
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
                2028 Battleground Map
              </button>
              <button type="button" className={pillBase(false)} onClick={() => setPicks({})}>
                Clear
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="grid flex-grow grid-cols-[240px_1fr_200px] overflow-hidden">
            {/* Left Panel */}
            <div className="flex flex-col border-r border-white/10 p-3 overflow-y-auto">
              <div className="text-xs font-semibold text-white/65">Totals</div>

              {/* Instructions (Collapsible) */}
              <div className="mt-2 rounded-lg border border-white/10 bg-white/5">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 p-3 text-left text-[11px] font-semibold text-white/80 hover:bg-white/5"
                  onClick={() => setShowInstructions((v) => !v)}
                >
                  <span>How to use</span>
                  <span className="text-white/60">{showInstructions ? "−" : "+"}</span>
                </button>

                {showInstructions && (
                  <div className="px-3 pb-3 text-[11px] text-white/70 leading-relaxed">
                    Select the <span className="text-blue-400 font-semibold">Democrat</span>,{" "}
                    <span className="text-red-400 font-semibold">Republican</span>, and{" "}
                    <span className="font-semibold">Tossup</span> buttons to brush a state with a specific party.
                    <br />
                    <br />
                    Click on a state to filter through <span className="font-semibold">Safe, Likely, Lean, and Tilt</span>{" "}
                    rating.
                    <br />
                    <br />
                    Right-click on a state to see state data, history, and much more.
                  </div>
                )}
              </div>

              {/* EV Vertical Bar */}
              <div className="mt-3 flex flex-col rounded-xl border border-white/10 bg-white/5 p-3 min-h-0">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-white/65">Electoral Vote Bar</div>
                  <div className="text-[11px] text-white/60">538 total</div>
                </div>

                <div className="mt-3 flex min-h-0 flex-1 items-stretch gap-3">
                  {/* Bar */}
                  <div
                    className="relative w-10 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40"
                    style={{ height: "clamp(220px, 51vh, 650px)" }}
                  >
                    {/* Democrat fill (bottom) */}
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-[rgba(59,130,246,0.65)]"
                      style={{ height: `${(totals.D / 538) * 100}%` }}
                    />
                    {/* Republican fill (top) */}
                    <div
                      className="absolute top-0 left-0 right-0 bg-[rgba(239,68,68,0.65)]"
                      style={{ height: `${(totals.R / 538) * 100}%` }}
                    />

                    {/* Divider line where D ends */}
                    <div
                      className="absolute left-0 right-0 border-t border-white/20"
                      style={{ bottom: `${(totals.D / 538) * 100}%` }}
                    />
                    {/* Divider line where R ends */}
                    <div
                      className="absolute left-0 right-0 border-t border-white/20"
                      style={{ top: `${(totals.R / 538) * 100}%` }}
                    />
                  </div>

                  {/* Labels */}
                  <div className="flex min-h-0 flex-1 flex-col justify-between text-[11px]">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-6">
                        <span className="text-blue-400 font-semibold">Democrat</span>
                        <span className="text-white/80 font-semibold">{totals.D}</span>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <span className="text-red-400 font-semibold">Republican</span>
                        <span className="text-white/80 font-semibold">{totals.R}</span>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <span className="text-white/70 font-semibold">Tossup</span>
                        <span className="text-white/80 font-semibold">{totals.T}</span>
                      </div>
                    </div>

                    <div className="mt-2 text-white/55">
                      <span className="font-semibold text-white/70">270</span> to win
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Center Map Area */}
            <div className="relative overflow-hidden bg-black/20">
              <div className="absolute left-2 top-2 z-10 flex gap-2">
                {[{ name: "NE", units: NE_UNITS }, { name: "ME", units: ME_UNITS }].map((s) => (
                  <div key={s.name} className="rounded-lg border border-white/10 bg-black/60 p-1.5 backdrop-blur-sm">
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
                            <span>{u.label}</span>
                            <span className="text-white/60">{u.ev}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Map SVG */}
              <svg viewBox="0 0 1000 600" className="h-full w-full">
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
                    const key = meta.abbr === "ME" ? "STATE_ME" : meta.abbr === "NE" ? "STATE_NE" : unitIdForState(meta.abbr);

                    // Calculate center for text label
                    const centroid = path.centroid(f);
                    const textLabel = meta.abbr;

                    // --- UPDATED LABEL LOGIC ---
                    const offset = LABEL_OFFSETS[meta.abbr] ?? { x: 0, y: 0 };
                    const shouldShowLabel = !SIDEBAR_STATES.includes(meta.abbr);
                    // ---------------------------

                    return (
                      <g key={idx}>
                        <path
                          d={d}
                          style={{ fill: fillForPick(pick, hoverKey === key) }}
                          className="stroke-[rgba(255,255,255,0.25)] cursor-pointer transition duration-150"
                          strokeWidth={0.8}
                          onMouseEnter={() => setHoverKey(key)}
                          onMouseLeave={() => {
                            setHoverKey((k) => (k === key ? null : k));
                            setTip(null);
                          }}
                          onClick={() => clickState(meta.abbr)}
                          onContextMenu={(e) => handleContextMenuState(e, name, ev, pick)}
                        />
                        {/* Render Label in Center with Custom Offset and Filter */}
                        {centroid[0] && centroid[1] && shouldShowLabel && (
                          <text
                            x={centroid[0] + offset.x}
                            y={centroid[1] + offset.y}
                            textAnchor="middle"
                            className={`pointer-events-none text-[10px] font-bold ${getTextColor(pick)}`}
                            style={{ dominantBaseline: "central" }}
                          >
                            {textLabel} {ev > 0 ? ev : ""}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            {/* Right Panel */}
            <div className="border-l border-white/10 p-3 overflow-y-auto">
              <div className="text-xs font-semibold text-white/70">Small states</div>
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                {RIGHT_COLUMN.map((abbr) => (
                  <button
                    key={abbr}
                    type="button"
                    className={`${tileBtn(picks[unitIdForState(abbr)] ?? "T")} py-1.5`}
                    onClick={() => clickState(abbr)}
                    onContextMenu={(e) =>
                      handleContextMenuState(e, abbr, STATE_EV[abbr] ?? 0, picks[unitIdForState(abbr)] ?? "T")
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{abbr}</span>
                      <span className="text-white/60">{STATE_EV[abbr]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {tip &&
  typeof document !== "undefined" &&
  createPortal(
    <div
      className="pointer-events-none fixed z-[9999] rounded-2xl border border-white/10 bg-black/85 p-4 backdrop-blur"
      style={{
        // ✅ allow bigger tooltip (up to most of the viewport)
        width: "min(560px, calc(100vw - 24px))",
        maxWidth: "calc(100vw - 24px)",

        // ✅ allow it to grow tall, but keep inside viewport
        maxHeight: "calc(100vh - 24px)",

        // ✅ keep it inside viewport (no off-screen)
        left: Math.min(tip.x, window.innerWidth - 12 - 560),
        top: Math.min(tip.y, window.innerHeight - 12 - 520),

        // ✅ IMPORTANT: no scrolling
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-white/90 break-words">
            {tip.title}
          </div>
          {tip.subtitle && (
            <div className="mt-1 text-[12px] text-white/55 break-words">
              {tip.subtitle}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[11px] text-white/75 whitespace-nowrap">{tip.ev} EV</span>
          <span className="text-[11px] text-white/65 whitespace-nowrap">
  {selectedPast?.abbr ?? "—"}
</span>
        </div>
      </div>

      <div className="mt-2 text-[12px] text-white/75">
        Pick: <span className="font-semibold text-white/90">{fmtPick(tip.pick)}</span>
      </div>

      {/* Past performance (no scroll, allow full wrapping) */}
      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="text-[12px] font-semibold text-white/80">
          Past performance
          {selectedPast ? ` — ${selectedPast.name}` : ""}
        </div>

        {!selectedPast ? (
          <div className="mt-2 text-[12px] text-white/60 break-words">
            Right-click any state to show its 2012–2024 margins and vote totals here.
          </div>
        ) : (
          <div className="mt-3 space-y-3 text-[12px] text-white/80">
            {/* Margins */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="text-[11px] font-semibold text-white/70">Margins</div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="text-white/60">2012</div>
                <div className="text-right font-semibold">{fmtMarginRM(selectedPast.margins.y2012)}</div>
                <div className="text-white/60">2016</div>
                <div className="text-right font-semibold">{fmtMarginRM(selectedPast.margins.y2016)}</div>
                <div className="text-white/60">2020</div>
                <div className="text-right font-semibold">{fmtMarginRM(selectedPast.margins.y2020)}</div>
                <div className="text-white/60">2024</div>
                <div className="text-right font-semibold">{fmtMarginRM(selectedPast.margins.y2024)}</div>
                <div className="text-white/60">Trend (12→24)</div>
                <div className="text-right font-semibold">
                  {selectedPast.trend_2012_to_2024 > 0 ? "+" : ""}
                  {selectedPast.trend_2012_to_2024.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Summary + 2028 */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="text-[11px] font-semibold text-white/70">Summary</div>
              <div className="mt-2 text-white/75 break-words leading-relaxed">
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
