// app/elections/electoral-map/page.tsx
"use client";

/**
 * PSI Electoral Forecaster • Creator/Streamer Edition
 * ---------------------------------------------------
 * Combined:
 * 1) The “creator-grade” visuals (dark, bold, broadcast-style scoreboard)
 * 2) The robust topojson id mapping + stable ME/NE handling
 * 3) Click-to-cycle ratings (Tilt → Lean → Likely → Safe) without a separate rating picker
 *
 * UX:
 * - Select brush: DEM / GOP / TOSSUP
 * - Click state repeatedly:
 *   - If DEM/GOP brush: cycles rating
 *   - If TOSSUP brush: sets Tossup
 * - ME/NE on the main map control AT-LARGE; districts are in side tiles
 * - Persists to localStorage
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";

import usStates from "@/public/us-states.json";

/* =========================
   Types
========================= */
type PartyBrush = "D" | "R" | "T";
type Rating = "SAFE" | "LIKELY" | "LEAN" | "TILT";
type Pick = "T" | `D_${Rating}` | `R_${Rating}`;

const RATINGS: Rating[] = ["SAFE", "LIKELY", "LEAN", "TILT"];

/* =========================
   EV Data
========================= */
const EV_BY_STATE: Record<string, number> = {
  AL: 9,
  AK: 3,
  AZ: 11,
  AR: 6,
  CA: 54,
  CO: 10,
  CT: 7,
  DE: 3,
  DC: 3,
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
};

const EV_SPLIT: Record<string, number> = {
  "ME-AL": 2,
  "ME-01": 1,
  "ME-02": 1,
  "NE-AL": 2,
  "NE-01": 1,
  "NE-02": 1,
  "NE-03": 1,
};

const DEFAULT_PICK: Record<string, Pick> = {};

/* =========================
   Side Tiles
========================= */
const SIDE_TILES: Array<{ key: string; label: string; ev: number; group: "SMALL" | "SPLIT" }> = [
  { key: "DC", label: "DC", ev: 3, group: "SMALL" },
  { key: "DE", label: "DE", ev: 3, group: "SMALL" },
  { key: "RI", label: "RI", ev: 4, group: "SMALL" },
  { key: "CT", label: "CT", ev: 7, group: "SMALL" },
  { key: "NJ", label: "NJ", ev: 14, group: "SMALL" },
  { key: "MD", label: "MD", ev: 10, group: "SMALL" },
  { key: "MA", label: "MA", ev: 11, group: "SMALL" },
  { key: "VT", label: "VT", ev: 3, group: "SMALL" },
  { key: "NH", label: "NH", ev: 4, group: "SMALL" },

  { key: "ME-AL", label: "ME-AL", ev: 2, group: "SPLIT" },
  { key: "ME-01", label: "ME-01", ev: 1, group: "SPLIT" },
  { key: "ME-02", label: "ME-02", ev: 1, group: "SPLIT" },

  { key: "NE-AL", label: "NE-AL", ev: 2, group: "SPLIT" },
  { key: "NE-01", label: "NE-01", ev: 1, group: "SPLIT" },
  { key: "NE-02", label: "NE-02", ev: 1, group: "SPLIT" },
  { key: "NE-03", label: "NE-03", ev: 1, group: "SPLIT" },
];

/* =========================
   Small Utils
========================= */
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);

function ratingAlpha(r: Rating) {
  if (r === "TILT") return 0.22;
  if (r === "LEAN") return 0.38;
  if (r === "LIKELY") return 0.58;
  return 0.78;
}

function nextRating(cur: Rating): Rating {
  const i = RATINGS.indexOf(cur);
  return RATINGS[(i + 1) % RATINGS.length];
}

function getPartyFromPick(p?: Pick): "D" | "R" | null {
  if (!p || p === "T") return null;
  return p.startsWith("D_") ? "D" : "R";
}

function getRatingFromPick(p?: Pick): Rating | null {
  if (!p || p === "T") return null;
  return (p.split("_")[1] as Rating) ?? null;
}

/* =========================
   Broadcast Theme Helpers
========================= */
function fillForPick(p: Pick) {
  if (p === "T") return "rgba(255,255,255,0.06)";
  const [party, rating] = p.split("_") as ["D" | "R", Rating];
  const a = ratingAlpha(rating);
  const base = party === "D" ? "var(--dem)" : "var(--rep)";
  return `color-mix(in srgb, ${base} ${Math.round(a * 100)}%, rgba(0,0,0,1))`;
}

function strokeForPick(p: Pick) {
  if (p === "T") return "rgba(255,255,255,0.14)";
  return p.startsWith("D_") ? "rgba(59,130,246,0.72)" : "rgba(239,68,68,0.72)";
}

function badgeClassForPick(p: Pick) {
  if (p === "T") return "bg-zinc-800 text-zinc-300 border-white/10";
  return p.startsWith("D_")
    ? "bg-blue-500/15 text-blue-300 border-blue-500/25"
    : "bg-red-500/15 text-red-300 border-red-500/25";
}

function labelForPick(p: Pick) {
  if (p === "T") return "TOSSUP";
  const [party, rating] = p.split("_") as ["D" | "R", Rating];
  return `${party === "D" ? "DEM" : "GOP"} • ${rating}`;
}

function sumEV(picks: Record<string, Pick>) {
  let d = 0,
    r = 0,
    t = 0;

  // normal states
  for (const st of Object.keys(EV_BY_STATE)) {
    const ev = EV_BY_STATE[st] ?? 0;
    const pick = picks[st] ?? "T";
    if (pick === "T") t += ev;
    else if (pick.startsWith("D_")) d += ev;
    else r += ev;
  }

  // split keys
  for (const k of Object.keys(EV_SPLIT)) {
    const ev = EV_SPLIT[k] ?? 0;
    const pick = picks[k] ?? "T";
    if (pick === "T") t += ev;
    else if (pick.startsWith("D_")) d += ev;
    else r += ev;
  }

  return { d, r, t, total: d + r + t };
}

/* =========================
   Component
========================= */
export default function ElectoralMapPainterPage() {
  const [brush, setBrush] = useState<PartyBrush>("T");
  const [picks, setPicks] = useState<Record<string, Pick>>(DEFAULT_PICK);

  const [tip, setTip] = useState<{
    show: boolean;
    x: number;
    y: number;
    st?: string;
    name?: string;
    ev?: number;
    pick?: Pick;
    hint?: string;
  }>({ show: false, x: 0, y: 0 });

  const hostRef = useRef<HTMLDivElement | null>(null);

  /* ---------- Persist ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("psi-electoral-map-picks-broadcast-v1");
      if (raw) setPicks(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("psi-electoral-map-picks-broadcast-v1", JSON.stringify(picks));
    } catch {}
  }, [picks]);

  /* ---------- Topo parsing + ID mapping ---------- */
  const { features, stateIdToAbbr } = useMemo(() => {
    const fc = feature(
      usStates as any,
      (usStates as any).objects.states ??
        (usStates as any).objects.usStates ??
        (usStates as any).objects["states"]
    ) as any;

    const feats = (fc.features ?? []) as any[];

    // FIPS -> USPS map fallback
    const USPS_BY_FIPS: Record<string, string> = {
      "01": "AL",
      "02": "AK",
      "04": "AZ",
      "05": "AR",
      "06": "CA",
      "08": "CO",
      "09": "CT",
      "10": "DE",
      "11": "DC",
      "12": "FL",
      "13": "GA",
      "15": "HI",
      "16": "ID",
      "17": "IL",
      "18": "IN",
      "19": "IA",
      "20": "KS",
      "21": "KY",
      "22": "LA",
      "23": "ME",
      "24": "MD",
      "25": "MA",
      "26": "MI",
      "27": "MN",
      "28": "MS",
      "29": "MO",
      "30": "MT",
      "31": "NE",
      "32": "NV",
      "33": "NH",
      "34": "NJ",
      "35": "NM",
      "36": "NY",
      "37": "NC",
      "38": "ND",
      "39": "OH",
      "40": "OK",
      "41": "OR",
      "42": "PA",
      "44": "RI",
      "45": "SC",
      "46": "SD",
      "47": "TN",
      "48": "TX",
      "49": "UT",
      "50": "VT",
      "51": "VA",
      "53": "WA",
      "54": "WV",
      "55": "WI",
      "56": "WY",
    };

    const idMap: Record<string, string> = {};

    for (const f of feats) {
      const p = f.properties ?? {};
      const postal =
        p.postal || p.STUSPS || p.abbr || p.code || p.state || p.STATE_ABBR || null;

      if (postal && typeof postal === "string" && postal.length === 2) {
        idMap[String(f.id ?? postal)] = postal.toUpperCase();
        continue;
      }

      const fips = String(f.id ?? p.id ?? p.STATEFP ?? "");
      const fips2 = fips.padStart(2, "0").slice(-2);
      const usps = USPS_BY_FIPS[fips2];
      if (usps) idMap[String(f.id ?? fips2)] = usps;
    }

    return { features: feats, stateIdToAbbr: idMap };
  }, []);

  /* ---------- Projection ---------- */
  const projection = useMemo(() => geoAlbersUsa().scale(1380).translate([560, 335]), []);
  const path = useMemo(() => geoPath(projection as any), [projection]);

  /* ---------- Totals ---------- */
  const totals = useMemo(() => sumEV(picks), [picks]);
  const demNeed = Math.max(0, 270 - totals.d);
  const repNeed = Math.max(0, 270 - totals.r);

  /* ---------- Apply pick (cycle ratings) ---------- */
  const applyPick = (key: string) => {
  setPicks((prev) => {
    const cur = prev[key] as Pick | undefined;

    if (brush === "T") return { ...prev, [key]: "T" };

    const targetParty: "D" | "R" = brush === "D" ? "D" : "R";
    const curParty = getPartyFromPick(cur);
    const curRating = getRatingFromPick(cur);

    // Same party? cycle SAFE → LIKELY → LEAN → TILT → SAFE
    if (curParty === targetParty && curRating) {
      const nr = nextRating(curRating);
      return { ...prev, [key]: `${targetParty}_${nr}` as Pick };
    }

    // Otherwise start at SAFE (not TILT)
    return { ...prev, [key]: `${targetParty}_SAFE` as Pick };
  });
};

  const clearAll = () => setPicks({});
  const setAllTossup = () => {
    const next: Record<string, Pick> = {};
    for (const st of Object.keys(EV_BY_STATE)) next[st] = "T";
    for (const k of Object.keys(EV_SPLIT)) next[k] = "T";
    setPicks(next);
  };

  /* ---------- Tooltip ---------- */
  const handlePointerMove = (ev: React.PointerEvent, f: any) => {
    const host = hostRef.current;
    if (!host) return;

    const rect = host.getBoundingClientRect();
    const tw = 340;
    const th = 168;
    const pad = 12;

    let x = ev.clientX - rect.left + 14;
    let y = ev.clientY - rect.top + 14;

    if (x + tw > rect.width) x = ev.clientX - rect.left - tw - 14;
    if (y + th > rect.height) y = ev.clientY - rect.top - th - 14;

    x = clamp(x, pad, rect.width - tw - pad);
    y = clamp(y, pad, rect.height - th - pad);

    const id = String(f.id ?? f.properties?.postal ?? f.properties?.STUSPS ?? "");
    const abbr = stateIdToAbbr[id] ?? f.properties?.postal ?? f.properties?.STUSPS ?? "";
    const st = String(abbr).toUpperCase();

    const name = f.properties?.name ?? f.properties?.NAME ?? f.properties?.State ?? "State";

    // main map ME/NE use AT-LARGE
    const keyForTotals = st === "ME" ? "ME-AL" : st === "NE" ? "NE-AL" : st;

    const evs =
      st === "ME" || st === "NE" ? EV_SPLIT[keyForTotals] ?? 0 : EV_BY_STATE[st] ?? 0;

    const pick = (picks[keyForTotals] ?? "T") as Pick;

    const hint =
      brush === "T"
        ? "Click: set TOSSUP"
        : `Click: ${brush === "D" ? "DEM" : "GOP"} cycles TILT→LEAN→LIKELY→SAFE`;

    setTip({ show: true, x, y, st, name, ev: evs, pick, hint });
  };

  const handlePointerLeave = () => setTip((t) => ({ ...t, show: false }));

  /* =========================
     Render
  ========================= */
  return (
    <div className="min-h-screen bg-[#07070a] text-zinc-200 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-[1480px]">
        {/* TOP BAR (broadcast header) */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.6)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-300">
                PSI • STREAMER EDITION
              </span>
            </div>

            <h1 className="mt-3 text-4xl md:text-5xl font-black uppercase italic tracking-tight text-white">
              Electoral <span className="text-indigo-400">Forecaster</span>
            </h1>

            <p className="mt-1 text-sm text-zinc-400 max-w-[78ch]">
              Choose a brush, then click states repeatedly to cycle confidence. ME/NE districts are in the side panel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={setAllTossup}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-zinc-200 hover:bg-white/10 transition"
            >
              Set All Tossup
            </button>
            <button
              onClick={clearAll}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-zinc-200 hover:bg-white/10 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* LEFT: MAP CARD */}
          <div
            ref={hostRef}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-4 shadow-[0_0_40px_rgba(0,0,0,0.55)]"
          >
            {/* TOOLBAR */}
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">
                  Brush
                </span>

                <div className="flex items-center rounded-xl border border-white/10 bg-black/30 p-1">
                  <button
                    onClick={() => setBrush("D")}
                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] rounded-lg transition ${
                      brush === "D"
                        ? "bg-blue-600 text-white shadow-[0_0_18px_rgba(37,99,235,0.55)]"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                    title="DEM brush (click cycles rating)"
                  >
                    DEM
                  </button>
                  <button
                    onClick={() => setBrush("R")}
                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] rounded-lg transition ${
                      brush === "R"
                        ? "bg-red-600 text-white shadow-[0_0_18px_rgba(239,68,68,0.55)]"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                    title="GOP brush (click cycles rating)"
                  >
                    GOP
                  </button>
                  <button
                    onClick={() => setBrush("T")}
                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] rounded-lg transition ${
                      brush === "T"
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                    title="Tossup brush"
                  >
                    TOSSUP
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">
                  Mode
                </span>
                <span className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-200">
                  {brush === "T" ? "Neutral (Tossup)" : "Rating Cycle (Tilt→Safe)"}
                </span>
              </div>
            </div>

            {/* MAP + TILES */}
            <div className="grid gap-4 xl:grid-cols-[1fr_240px]">
              {/* MAP */}
              <div className="relative">
                <svg viewBox="0 0 1120 700" className="h-auto w-full">
                  <defs>
                    <filter id="psiGlow">
                      <feGaussianBlur stdDeviation="2.2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="rgba(255,255,255,0.08)" />
                      <stop offset="1" stopColor="rgba(255,255,255,0.01)" />
                    </linearGradient>
                  </defs>

                  <rect x="0" y="0" width="1120" height="700" fill="transparent" />

                  {features.map((f, i) => {
                    const d = path(f) || "";
                    const id = String(f.id ?? f.properties?.postal ?? f.properties?.STUSPS ?? "");
                    const abbr =
                      (stateIdToAbbr[id] ??
                        f.properties?.postal ??
                        f.properties?.STUSPS ??
                        "") as string;

                    const st = abbr.toUpperCase();

                    // main map ME/NE use AT-LARGE key
                    const keyForTotals = st === "ME" ? "ME-AL" : st === "NE" ? "NE-AL" : st;

                    const pick = (picks[keyForTotals] ?? "T") as Pick;
                    const fill = fillForPick(pick);
                    const stroke = strokeForPick(pick);

                    const clickable = st === "ME" || st === "NE" || (st && EV_BY_STATE[st] != null);

                    return (
                      <path
                        key={i}
                        d={d}
                        onClick={() => {
                          if (!clickable) return;
                          if (st === "ME") return applyPick("ME-AL");
                          if (st === "NE") return applyPick("NE-AL");
                          if (EV_BY_STATE[st] != null) return applyPick(st);
                        }}
                        onPointerMove={(ev) => handlePointerMove(ev, f)}
                        onPointerLeave={handlePointerLeave}
                        className="cursor-pointer transition-[filter,transform] duration-200 hover:brightness-125"
                        style={{
                          fill,
                          stroke,
                          strokeWidth: 0.75,
                          filter: pick === "T" ? "none" : "url(#psiGlow)",
                          opacity: clickable ? 1 : 0.35,
                        }}
                      />
                    );
                  })}

                  {/* subtle rim */}
                  <rect
                    x="10"
                    y="10"
                    width="1100"
                    height="680"
                    fill="none"
                    stroke="url(#rim)"
                    strokeWidth="1"
                    rx="16"
                  />
                </svg>

                {/* TOOLTIP */}
                {tip.show && (
                  <div
                    className="pointer-events-none absolute z-50 w-[340px] rounded-xl border border-white/15 bg-black/80 p-3 shadow-2xl backdrop-blur-md"
                    style={{ left: tip.x, top: tip.y }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400">
                          {tip.st}
                        </div>
                        <div className="mt-1 text-sm font-black uppercase tracking-[0.08em] text-white">
                          {tip.name ?? ""}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                          EV: <span className="font-mono text-zinc-200">{tip.ev ?? 0}</span>
                          {(tip.st === "ME" || tip.st === "NE") && (
                            <span className="ml-2 text-[rgba(255,255,255,0.55)]">(AT-LARGE)</span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${badgeClassForPick(
                          (tip.pick ?? "T") as Pick
                        )}`}
                      >
                        {labelForPick((tip.pick ?? "T") as Pick)}
                      </span>
                    </div>

                    <div className="my-3 h-px bg-white/10" />

                    <div className="text-[11px] font-bold text-zinc-300">
                      <span className="text-zinc-500">Hint:</span> {tip.hint}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: TILES */}
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400">
                    Districts + Small
                  </div>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-200">
                    Click
                  </span>
                </div>

                <div className="my-3 h-px bg-white/10" />

                <div className="grid grid-cols-2 gap-2">
                  {SIDE_TILES.map((t) => {
                    const pick = (picks[t.key] ?? "T") as Pick;
                    const fill = fillForPick(pick);
                    const stroke = strokeForPick(pick);

                    return (
                      <button
                        key={t.key}
                        onClick={() => applyPick(t.key)}
                        className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition hover:brightness-110"
                        style={{
                          borderColor: stroke,
                          background: fill,
                          opacity: t.group === "SPLIT" ? 0.98 : 0.92,
                        }}
                        title={`${t.label} • ${t.ev} EV`}
                      >
                        <span className="font-mono">{t.label}</span>
                        <span className="font-mono text-white/70">{t.ev}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-[11px] text-zinc-300">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">
                    ME/NE
                  </div>
                  <div className="mt-1 text-zinc-400">
                    Main map colors <span className="text-zinc-200 font-mono">ME-AL</span> /{" "}
                    <span className="text-zinc-200 font-mono">NE-AL</span>. Districts are painted here.
                  </div>
                </div>
              </div>
            </div>

            {/* LEGEND FOOTER */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">
                Legend
              </span>
              <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-blue-200">
                DEM • Tilt → Safe
              </span>
              <span className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-red-200">
                GOP • Tilt → Safe
              </span>
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-200">
                Tossup
              </span>

              <span className="ml-auto text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Broadcast-ready • clean edges • glow shading
              </span>
            </div>
          </div>

          {/* RIGHT: SCOREBOARD */}
          <aside className="lg:sticky lg:top-8 h-fit rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-5 shadow-[0_0_40px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">
                  Scoreboard
                </div>
                <div className="mt-1 text-3xl font-black uppercase italic tracking-tight text-white">
                  270 to win
                </div>
              </div>

              <div className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">
                    LIVE
                  </span>
                </div>
              </div>
            </div>

            <div className="my-5 h-px bg-white/10" />

            {/* DEM */}
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-end justify-between">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-300">
                  Democrat
                </div>
                <div className="font-mono text-3xl font-black text-white">
                  {totals.d}
                  <span className="ml-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
                    EV
                  </span>
                </div>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full bg-blue-600 shadow-[0_0_18px_rgba(37,99,235,0.55)] transition-all duration-500"
                  style={{ width: `${clamp(pct(totals.d, 538), 0, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-right text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                {totals.d >= 270 ? "Winner Confirmed" : `Needs ${demNeed} more`}
              </div>
            </div>

            {/* REP */}
            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-end justify-between">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-red-300">
                  Republican
                </div>
                <div className="font-mono text-3xl font-black text-white">
                  {totals.r}
                  <span className="ml-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
                    EV
                  </span>
                </div>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full bg-red-600 shadow-[0_0_18px_rgba(239,68,68,0.55)] transition-all duration-500"
                  style={{ width: `${clamp(pct(totals.r, 538), 0, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-right text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                {totals.r >= 270 ? "Winner Confirmed" : `Needs ${repNeed} more`}
              </div>
            </div>

            {/* TOSSUP */}
            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-end justify-between">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-300">
                  Tossup / Uncalled
                </div>
                <div className="font-mono text-3xl font-black text-white">
                  {totals.t}
                  <span className="ml-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
                    EV
                  </span>
                </div>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full bg-white/20 transition-all duration-500"
                  style={{ width: `${clamp(pct(totals.t, 538), 0, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-right text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Remaining electoral votes
              </div>
            </div>

            {/* HOW IT WORKS */}
            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-[11px] text-zinc-300">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">
                How it works
              </div>
              <div className="mt-2 text-zinc-400 leading-relaxed">
                Select <span className="text-zinc-200 font-black">DEM</span> or{" "}
                <span className="text-zinc-200 font-black">GOP</span>, then click a state repeatedly to cycle:
                <span className="ml-2 font-mono text-zinc-200">TILT</span> →{" "}
                <span className="font-mono text-zinc-200">LEAN</span> →{" "}
                <span className="font-mono text-zinc-200">LIKELY</span> →{" "}
                <span className="font-mono text-zinc-200">SAFE</span>.
                <div className="mt-2">
                  Use <span className="text-zinc-200 font-black">TOSSUP</span> to reset any state instantly.
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* FOOTER */}
        <div className="mt-8 border-t border-white/10 pt-4 text-[10px] text-zinc-500">
          <span className="font-black uppercase tracking-[0.22em]">PSI</span> • Creator-grade electoral map for
          livestreams and video overlays • Save key:{" "}
          <span className="font-mono text-zinc-300">psi-electoral-map-picks-broadcast-v1</span>
        </div>
      </div>

      {/* Theme Variables (local fallback if your globals.css already defines these, you can remove) */}
      <style jsx global>{`
        :root {
          --dem: #2563eb;
          --rep: #dc2626;
        }
      `}</style>
    </div>
  );
}