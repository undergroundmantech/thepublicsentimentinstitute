"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DarkNav from "@/app/components/DarkNav";
import { SENATE_MODEL } from "@/app/components/senateModel";

// ─── types ────────────────────────────────────────────────────────────────────
type MapMode  = "pres" | "senate" | "redist" | "house";
type PartyBrush = "D" | "R" | "T";
type Rating     = "SAFE" | "LIKELY" | "LEAN" | "TILT";
type Pick       = "T" | `D_${Rating}` | `R_${Rating}`;

interface TooltipState {
  visible: boolean; x: number; y: number;
  abbr: string; name: string; ev: number; pick: Pick;
}

// ─── data ─────────────────────────────────────────────────────────────────────
const EV_BY_STATE: Record<string, number> = {
  AL:9,  AK:3,  AZ:11, AR:6,  CA:54, CO:10, CT:7,  DE:3,  DC:3,
  FL:30, GA:16, HI:4,  ID:4,  IL:19, IN:11, IA:6,  KS:6,  KY:8,
  LA:8,  MD:10, MA:11, MI:15, MN:10, MS:6,  MO:10, MT:4,  NV:6,
  NH:4,  NJ:14, NM:5,  NY:28, NC:16, ND:3,  OH:17, OK:7,  OR:8,
  PA:19, RI:4,  SC:9,  SD:3,  TN:11, TX:40, UT:6,  VT:3,  VA:13,
  WA:12, WV:4,  WI:10, WY:3,
};
const EV_SPLIT: Record<string, number> = {
  "ME-AL":2,"ME-01":1,"ME-02":1,
  "NE-AL":2,"NE-01":1,"NE-02":1,"NE-03":1,
};
const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"D.C.",FL:"Florida",
  GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",
  IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",
  MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NV:"Nevada",NH:"New Hampshire",
  NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",
  ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",
  RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",
  TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",
  WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
  "ME-AL":"Maine · at-large","ME-01":"Maine · 1st","ME-02":"Maine · 2nd",
  "NE-AL":"Nebraska · at-large","NE-01":"Nebraska · 1st","NE-02":"Nebraska · 2nd","NE-03":"Nebraska · 3rd",
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
// States too small to label on-map (+ the ME/NE split districts) → inset tiles.
const TILES = [
  { key:"NH", ev:4 }, { key:"VT", ev:3 }, { key:"MA", ev:11 }, { key:"RI", ev:4 },
  { key:"CT", ev:7 }, { key:"NJ", ev:14 }, { key:"DE", ev:3 }, { key:"MD", ev:10 }, { key:"DC", ev:3 },
  { key:"ME-AL", ev:2 }, { key:"ME-01", ev:1 }, { key:"ME-02", ev:1 },
  { key:"NE-AL", ev:2 }, { key:"NE-01", ev:1 }, { key:"NE-02", ev:1 }, { key:"NE-03", ev:1 },
];
const TILE_SET = new Set(["NH","VT","MA","RI","CT","NJ","DE","MD","DC"]);
const SMALL_TILES = TILES.filter(t => !t.key.includes("-"));

// ── 2026 Senate ────────────────────────────────────────────────────────────────
// Seats on the ballot come from the shared model (positive = R margin).
const SENATE_UP = new Map(SENATE_MODEL.map(r => [r.st, r.m]));
const D_HOLDOVERS = 34;  // Democratic seats not on the 2026 ballot
const R_HOLDOVERS = 31;  // Republican seats not on the 2026 ballot
const SENATE_TOTAL = 100;

function senateModelPicks(): Record<string, Pick> {
  const out: Record<string, Pick> = {};
  for (const r of SENATE_MODEL) {
    const a = Math.abs(r.m);
    if (a < 0.05) { out[r.st] = "T"; continue; }
    const tier: Rating = a >= 12 ? "SAFE" : a >= 6 ? "LIKELY" : a >= 2 ? "LEAN" : "TILT";
    out[r.st] = `${r.m < 0 ? "D" : "R"}_${tier}` as Pick;
  }
  return out;
}

// ── 2026 House redistricting (statuses as of June 2026 — they evolve) ─────────
type RedistStatus = "ENACTED_R" | "ENACTED_D" | "COURT" | "MOTION_R" | "MOTION_D";
const REDIST: Record<string, { s: RedistStatus; net: number; note: string }> = {
  TX: { s: "ENACTED_R", net: +5, note: "Mid-decade map signed Aug 2025" },
  MO: { s: "ENACTED_R", net: +1, note: "New map enacted Sep 2025" },
  NC: { s: "ENACTED_R", net: +1, note: "Redraw enacted Oct 2025" },
  OH: { s: "ENACTED_R", net: +2, note: "Required redraw enacted Oct 2025" },
  CA: { s: "ENACTED_D", net: -5, note: "Prop 50 approved Nov 2025" },
  UT: { s: "COURT",     net: -1, note: "Court-ordered remedial map" },
  FL: { s: "MOTION_R",  net: 0,  note: "Redraw under consideration" },
  IN: { s: "MOTION_R",  net: 0,  note: "Redraw push — not enacted" },
  KS: { s: "MOTION_R",  net: 0,  note: "Redraw push in legislature" },
  MD: { s: "MOTION_D",  net: 0,  note: "Response map under consideration" },
  VA: { s: "MOTION_D",  net: 0,  note: "Amendment process under way" },
  IL: { s: "MOTION_D",  net: 0,  note: "Response map floated" },
};
const REDIST_COLOR: Record<RedistStatus, string> = {
  ENACTED_R: "#e84450", MOTION_R: "#ff8791",
  ENACTED_D: "#3568e6", MOTION_D: "#84a8ff",
  COURT: "#b98cff",
};
const REDIST_WORD: Record<RedistStatus, string> = {
  ENACTED_R: "Enacted · R gain", MOTION_R: "In motion · R",
  ENACTED_D: "Enacted · D gain", MOTION_D: "In motion · D",
  COURT: "Court-ordered",
};

const STORAGE_PRES = "psi-electoral-map-v3";
const STORAGE_SEN  = "psi-senate-map-v1";
const STORAGE_HOUSE = "psi-house-map-v1";
const HOUSE_TOTAL = 435;
const ORDINAL = (n: number) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + "th";
  return n + (["th", "st", "nd", "rd"][Math.min(n % 10, 4)] ?? "th");
};
const TOTAL_EV = 538;
const RATINGS: Rating[] = ["SAFE", "LIKELY", "LEAN", "TILT"];

// ─── palette (matches the forecast page — editorial, not crayon) ────────────────
const DEM: Record<Rating, string> = { SAFE:"#3568e6", LIKELY:"#5b8cff", LEAN:"#84a8ff", TILT:"#b3caff" };
const REP: Record<Rating, string> = { SAFE:"#e84450", LIKELY:"#ff5d6c", LEAN:"#ff8791", TILT:"#ffb3b9" };
const DEM_MID = "#5b8cff", REP_MID = "#ff5d6c";

function fillFor(p: Pick | undefined): string {
  if (!p || p === "T") return "var(--em-toss)";
  const [party, rating] = p.split("_") as ["D" | "R", Rating];
  return (party === "D" ? DEM : REP)[rating];
}
function labelInk(p: Pick | undefined): { fill: string; opacity: number } {
  if (!p || p === "T") return { fill: "var(--foreground)", opacity: 0.45 };
  const rating = p.split("_")[1] as Rating;
  return rating === "TILT" ? { fill: "#17171b", opacity: 1 } : { fill: "#ffffff", opacity: 1 };
}
const RATING_WORD: Record<Rating, string> = { SAFE:"Safe", LIKELY:"Likely", LEAN:"Lean", TILT:"Tilt" };
function pickLabel(p: Pick | undefined): string {
  if (!p || p === "T") return "Toss-up";
  const [party, rating] = p.split("_") as ["D" | "R", Rating];
  return `${RATING_WORD[rating]} ${party}`;
}
function pickColor(p: Pick | undefined): string {
  if (!p || p === "T") return "var(--muted)";
  const [party, rating] = p.split("_") as ["D" | "R", Rating];
  return (party === "D" ? DEM : REP)[rating === "TILT" ? "LEAN" : rating]; // readable as text
}
function nextRating(cur: Rating): Rating { return RATINGS[(RATINGS.indexOf(cur) + 1) % RATINGS.length]; }
function stateKey(abbr: string) { return abbr === "ME" ? "ME-AL" : abbr === "NE" ? "NE-AL" : abbr; }
function sumEV(picks: Record<string, Pick>) {
  let d = 0, r = 0, t = 0;
  const add = (p: Pick | undefined, ev: number) => { if (!p || p === "T") t += ev; else if (p[0] === "D") d += ev; else r += ev; };
  for (const [st, ev] of Object.entries(EV_BY_STATE)) add(picks[st], ev);
  for (const [k, ev] of Object.entries(EV_SPLIT)) add(picks[k], ev);
  return { d, r, t };
}
function sumSeats(picks: Record<string, Pick>) {
  let d = D_HOLDOVERS, r = R_HOLDOVERS, t = 0;
  for (const st of SENATE_UP.keys()) {
    const p = picks[st];
    if (!p || p === "T") t += 1;
    else if (p[0] === "D") d += 1;
    else r += 1;
  }
  return { d, r, t };
}
function applyBrush(picks: Record<string, Pick>, key: string, brush: PartyBrush): Record<string, Pick> {
  const next = { ...picks };
  if (brush === "T") { next[key] = "T"; return next; }
  const cur = picks[key];
  const curParty = cur && cur !== "T" ? (cur[0] as "D" | "R") : null;
  const curRating = cur && cur !== "T" ? (cur.split("_")[1] as Rating) : null;
  next[key] = curParty === brush && curRating ? (`${brush}_${nextRating(curRating)}` as Pick) : (`${brush}_SAFE` as Pick);
  return next;
}

const MODE_META: Record<MapMode, { folio: string; scope: string; deck: string }> = {
  pres: {
    folio: "2028 Presidential", scope: "538 electoral votes",
    deck: "Assign each state and the count updates as you go — 270 wins. Repeated clicks step a call from safe down to tilt. Maps save locally and share by link.",
  },
  senate: {
    folio: "2026 Senate", scope: "35 seats on the ballot · 100 total",
    deck: "The 35 seats on the 2026 ballot; the 65 holdovers are locked. Fifty-one wins the chamber. Starts from the desk's model — repaint from there.",
  },
  redist: {
    folio: "2026 House", scope: "the mid-decade redraw",
    deck: "The mid-decade redistricting fight, state by state — maps enacted, ordered by courts, and still in motion. The net enacted shift updates as the lines change.",
  },
  house: {
    folio: "2026 House", scope: "435 districts · 218 to control",
    deck: "All 435 districts, rated seat by seat — 218 wins the chamber. Boundaries are the 118th-Congress lines, so mid-decade redraws render approximately.",
  },
};

// ─── page ─────────────────────────────────────────────────────────────────────
export default function ElectoralMapPage() {
  const [mode, setMode] = useState<MapMode>("pres");
  const [brush, setBrush] = useState<PartyBrush>("D");
  const [presPicks, setPresPicks] = useState<Record<string, Pick>>({});
  const [senPicks, setSenPicks] = useState<Record<string, Pick>>(senateModelPicks);
  const [housePicks, setHousePicks] = useState<Record<string, Pick>>({});
  const [shareLabel, setShareLabel] = useState("Share map");
  const [tip, setTip] = useState<TooltipState>({ visible:false, x:0, y:0, abbr:"", name:"", ev:0, pick:"T" });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // the click choreography: the shape flashes, a brush-colored ring blooms
  // from the cursor — feedback you can feel, not just a recolor.
  const popState = useCallback((el: SVGPathElement | SVGElement, e: MouseEvent) => {
    el.classList.remove("em-pop");
    void (el as SVGPathElement).getBBox?.();
    el.classList.add("em-pop");
    el.addEventListener("animationend", () => el.classList.remove("em-pop"), { once: true });
    const host = stageRef.current;
    if (!host) return;
    const r = host.getBoundingClientRect();
    const s = document.createElement("span");
    s.className = "em-ripple";
    const b = brushRef.current;
    s.style.borderColor = b === "D" ? DEM_MID : b === "R" ? REP_MID : "rgba(244,244,239,0.65)";
    s.style.left = `${e.clientX - r.left}px`;
    s.style.top = `${e.clientY - r.top}px`;
    host.appendChild(s);
    s.addEventListener("animationend", () => s.remove(), { once: true });
  }, []);

  const svgRef = useRef<SVGSVGElement>(null);
  const brushRef = useRef<PartyBrush>("D");
  const modeRef = useRef<MapMode>("pres");
  brushRef.current = brush;
  modeRef.current = mode;

  const picks = mode === "senate" ? senPicks : mode === "house" ? housePicks : presPicks;

  // load picks + mode (URL ?picks= wins, else localStorage)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const m = url.searchParams.get("mode");
      if (m === "senate" || m === "redist" || m === "house") setMode(m);
      const q = url.searchParams.get("picks");
      if (q) {
        const parsed = JSON.parse(decodeURIComponent(q));
        if (m === "senate") setSenPicks(parsed); else if (m === "house") setHousePicks(parsed); else setPresPicks(parsed);
        return;
      }
      const rp = localStorage.getItem(STORAGE_PRES); if (rp) setPresPicks(JSON.parse(rp));
      const rs = localStorage.getItem(STORAGE_SEN); if (rs) setSenPicks(JSON.parse(rs));
      const rh = localStorage.getItem(STORAGE_HOUSE); if (rh) setHousePicks(JSON.parse(rh));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_PRES, JSON.stringify(presPicks)); } catch {} }, [presPicks]);
  useEffect(() => { try { localStorage.setItem(STORAGE_SEN, JSON.stringify(senPicks)); } catch {} }, [senPicks]);
  useEffect(() => { try { localStorage.setItem(STORAGE_HOUSE, JSON.stringify(housePicks)); } catch {} }, [housePicks]);

  const applyPick = useCallback((key: string) => {
    const m = modeRef.current;
    if (m === "redist") return;
    if (m === "senate" && !SENATE_UP.has(key)) return;
    const set = m === "senate" ? setSenPicks : m === "house" ? setHousePicks : setPresPicks;
    set(prev => {
      const next = applyBrush(prev, key, brushRef.current);
      // keep the hovering tooltip honest about the rating it just produced
      const np = (next[key] ?? "T") as Pick;
      requestAnimationFrame(() => setTip(t => (t.visible ? { ...t, pick: np } : t)));
      return next;
    });
  }, []);

  // draw the map once
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
        const proj = geoAlbersUsa().scale(1280).translate([480, 300]);
        const path = geoPath().projection(proj);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const states = feature(topo as any, (topo as any).objects.states) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const border = mesh(topo as any, (topo as any).objects.states, (a:any, b:any) => a !== b);
        svg.querySelectorAll('[data-layer="states"]').forEach(g => g.remove());
        const gStates = document.createElementNS(NS, "g");
        gStates.setAttribute("data-layer", "states");
        svg.appendChild(gStates);

        // shapes
        for (const f of states.features) {
          const abbr = FIPS[String(f.id).padStart(2, "0")];
          if (!abbr) continue;
          const key = stateKey(abbr);
          const el = document.createElementNS(NS, "path");
          el.setAttribute("d", path(f) ?? "");
          el.setAttribute("data-key", key);
          el.setAttribute("data-abbr", abbr);
          el.style.cssText = `fill:var(--em-toss);stroke:var(--background);stroke-width:1.2;transition:filter 180ms ease, fill 420ms cubic-bezier(.2,.8,.2,1);`;
          el.addEventListener("click", (e: MouseEvent) => { applyPick(key); popState(el, e); });
          el.addEventListener("mouseover", () => {
            const m = modeRef.current;
            const interactive = m === "pres" ? (EV_BY_STATE[abbr] != null && abbr !== "ME" && abbr !== "NE")
              : m === "senate" ? SENATE_UP.has(abbr)
              : REDIST[abbr] != null;
            if (!interactive) return;
            el.style.filter = "brightness(1.12) saturate(1.16)"; el.style.stroke = "var(--foreground)"; el.style.strokeWidth = "2";
          });
          el.addEventListener("mouseout",  () => { el.style.filter = ""; el.style.stroke = "var(--background)"; el.style.strokeWidth = "1.2"; });
          el.addEventListener("mousemove", (e: MouseEvent) => {
            const setCur = modeRef.current === "senate" ? setSenPicks : setPresPicks;
            setCur(cur => {
              setTip({ visible:true, x:e.clientX, y:e.clientY, abbr, name:STATE_NAMES[abbr] ?? abbr, ev:EV_BY_STATE[abbr] ?? 0, pick:(cur[key] ?? "T") as Pick });
              return cur;
            });
          });
          el.addEventListener("mouseleave", () => setTip(t => ({ ...t, visible:false })));
          gStates.appendChild(el);
        }
        // borders
        const be = document.createElementNS(NS, "path");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        be.setAttribute("d", path(border as any) ?? "");
        be.style.cssText = "fill:none;stroke:var(--background);stroke-width:1;pointer-events:none;";
        gStates.appendChild(be);
        // labels (skip tile states + ME/NE + anything too small)
        for (const f of states.features) {
          const abbr = FIPS[String(f.id).padStart(2, "0")];
          if (!abbr || EV_BY_STATE[abbr] == null || TILE_SET.has(abbr) || abbr === "ME" || abbr === "NE") continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [[x0, y0], [x1, y1]] = (path as any).bounds(f);
          if (x1 - x0 < 26 || y1 - y0 < 17) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [cx, cy] = (path as any).centroid(f);
          const t = document.createElementNS(NS, "text");
          t.setAttribute("x", String(cx)); t.setAttribute("y", String(cy));
          t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "central");
          t.setAttribute("data-lab", abbr); t.setAttribute("class", "em-lab");
          t.textContent = abbr;
          gStates.appendChild(t);
        }
        gStates.style.display = modeRef.current === "house" ? "none" : "";
      } catch { /* offline */ }
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // build the 435-district layer on first entry into house mode
  useEffect(() => {
    if (mode !== "house") return;
    if (svgRef.current?.querySelector('[data-layer="house"]')) return;
    let dead = false;
    (async () => {
      try {
        const [{ geoAlbersUsa, geoPath }, { feature, mesh }, topo] = await Promise.all([
          import("d3-geo"), import("topojson-client"),
          fetch("/cd118.json").then(r => r.json()),
        ]);
        if (dead || !svgRef.current) return;
        if (svgRef.current.querySelector('[data-layer="house"]')) return;
        const svg = svgRef.current;
        const NS = "http://www.w3.org/2000/svg";
        const proj = geoAlbersUsa().scale(1280).translate([480, 300]);
        const path = geoPath().projection(proj);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cds = feature(topo as any, (topo as any).objects.cd) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const border = mesh(topo as any, (topo as any).objects.cd, (a: any, b: any) => a !== b);
        const gHouse = document.createElementNS(NS, "g");
        gHouse.setAttribute("data-layer", "house");
        gHouse.style.display = modeRef.current === "house" ? "" : "none";
        for (const f of cds.features) {
          const abbr = FIPS[String(f.properties.STATEFP).padStart(2, "0")];
          if (!abbr) continue;
          const num = parseInt(f.properties.CD118FP, 10);
          const key = `${abbr}-${Number.isFinite(num) && num > 0 ? num : "AL"}`;
          const name = `${STATE_NAMES[abbr] ?? abbr} · ${Number.isFinite(num) && num > 0 ? ORDINAL(num) : "at-large"}`;
          const el = document.createElementNS(NS, "path");
          el.setAttribute("d", path(f) ?? "");
          el.setAttribute("data-cd", key);
          el.style.cssText = "fill:var(--em-toss);stroke:var(--background);stroke-width:0.55;cursor:pointer;transition:filter 120ms ease;";
          el.addEventListener("click", (e: MouseEvent) => { applyPick(key); popState(el, e); });
          el.addEventListener("mouseover", () => { el.style.filter = "brightness(1.18) saturate(1.16)"; el.style.stroke = "var(--foreground)"; el.style.strokeWidth = "1.4"; });
          el.addEventListener("mouseout",  () => { el.style.filter = ""; el.style.stroke = "var(--background)"; el.style.strokeWidth = "0.55"; });
          el.addEventListener("mousemove", (e: MouseEvent) => {
            setHousePicks(cur => {
              setTip({ visible: true, x: e.clientX, y: e.clientY, abbr: key, name, ev: 1, pick: (cur[key] ?? "T") as Pick });
              return cur;
            });
          });
          el.addEventListener("mouseleave", () => setTip(t => ({ ...t, visible: false })));
          gHouse.appendChild(el);
        }
        const be = document.createElementNS(NS, "path");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        be.setAttribute("d", path(border as any) ?? "");
        be.style.cssText = "fill:none;stroke:var(--background);stroke-width:0.5;pointer-events:none;";
        gHouse.appendChild(be);
        svg.appendChild(gHouse);
        // paint current picks immediately
        gHouse.querySelectorAll<SVGPathElement>("[data-cd]").forEach(el => {
          el.style.fill = fillFor((housePicks[el.getAttribute("data-cd")!] ?? "T") as Pick);
        });
      } catch { /* offline */ }
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // layer visibility per mode
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const gStates = svg.querySelector<SVGGElement>('[data-layer="states"]');
    const gHouse = svg.querySelector<SVGGElement>('[data-layer="house"]');
    if (gStates) gStates.style.display = mode === "house" ? "none" : "";
    if (gHouse) gHouse.style.display = mode === "house" ? "" : "none";
  }, [mode]);

  // recolor shapes + labels for the active mode
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    svg.querySelectorAll<SVGPathElement>("[data-key]").forEach(el => {
      const key = el.getAttribute("data-key")!;
      const abbr = el.getAttribute("data-abbr")!;
      if (mode === "redist") {
        const st = REDIST[abbr];
        el.style.fill = st ? REDIST_COLOR[st.s] : "var(--em-out)";
        el.style.cursor = "default";
      } else if (mode === "senate") {
        const up = SENATE_UP.has(abbr);
        el.style.fill = up ? fillFor((senPicks[abbr] ?? "T") as Pick) : "var(--em-out)";
        el.style.cursor = up ? "pointer" : "default";
      } else {
        const clickable = EV_BY_STATE[abbr] != null && abbr !== "ME" && abbr !== "NE";
        el.style.fill = fillFor((presPicks[key] ?? "T") as Pick);
        el.style.cursor = clickable ? "pointer" : "default";
      }
    });
    svg.querySelectorAll<SVGPathElement>("[data-cd]").forEach(el => {
      el.style.fill = fillFor((housePicks[el.getAttribute("data-cd")!] ?? "T") as Pick);
    });
    svg.querySelectorAll<SVGTextElement>("[data-lab]").forEach(el => {
      const abbr = el.getAttribute("data-lab")!;
      if (mode === "redist") {
        const st = REDIST[abbr];
        el.style.fill = st ? (st.s === "MOTION_D" || st.s === "COURT" ? "#17171b" : "#ffffff") : "var(--foreground)";
        el.style.opacity = st ? "1" : "0.3";
      } else if (mode === "senate") {
        if (!SENATE_UP.has(abbr)) { el.style.fill = "var(--foreground)"; el.style.opacity = "0.22"; return; }
        const ink = labelInk((senPicks[abbr] ?? "T") as Pick);
        el.style.fill = ink.fill; el.style.opacity = String(ink.opacity);
      } else {
        const ink = labelInk((presPicks[abbr] ?? "T") as Pick);
        el.style.fill = ink.fill; el.style.opacity = String(ink.opacity);
      }
    });
  }, [picks, presPicks, senPicks, housePicks, mode]);

  const meta = MODE_META[mode];
  const ev = sumEV(presPicks);
  const seats = sumSeats(senPicks);
  const redistEnacted = Object.values(REDIST).filter(x => x.s === "ENACTED_R" || x.s === "ENACTED_D" || x.s === "COURT");
  const rGain = redistEnacted.filter(x => x.net > 0).reduce((s, x) => s + x.net, 0);
  const dGain = -redistEnacted.filter(x => x.net < 0).reduce((s, x) => s + x.net, 0);
  const inMotion = Object.values(REDIST).filter(x => x.s === "MOTION_R" || x.s === "MOTION_D").length;

  const house = (() => {
    let d = 0, r = 0, t = 0;
    for (const p of Object.values(housePicks)) { if (!p || p === "T") continue; if (p[0] === "D") d += 1; else r += 1; }
    t = HOUSE_TOTAL - d - r;
    return { d, r, t };
  })();

  // composition of the board by rating — the beam shows HOW each side gets
  // its number, not just the totals. Locked = senate holdovers not on the ballot.
  const composition = (() => {
    const RATINGS: Rating[] = ["SAFE", "LIKELY", "LEAN", "TILT"];
    const z = () => ({ SAFE: 0, LIKELY: 0, LEAN: 0, TILT: 0 } as Record<Rating, number>);
    const D = z(), R = z();
    let dLock = 0, rLock = 0, t = 0;
    const add = (p: Pick | undefined, w: number) => {
      if (!p || p === "T") { t += w; return; }
      const side = p[0] === "D" ? D : R;
      side[p.slice(2) as Rating] += w;
    };
    if (mode === "senate") {
      dLock = D_HOLDOVERS; rLock = R_HOLDOVERS;
      for (const st of SENATE_UP.keys()) add(senPicks[st], 1);
    } else if (mode === "house") {
      const seen = new Set<string>();
      for (const [k, p] of Object.entries(housePicks)) { seen.add(k); add(p, 1); }
      t += HOUSE_TOTAL - Object.keys(housePicks).length;
    } else {
      for (const [st, w] of Object.entries(EV_BY_STATE)) add(presPicks[st], w);
      for (const [k, w] of Object.entries(EV_SPLIT)) add(presPicks[k], w);
    }
    const segs: { w: number; c: string; k: string }[] = [];
    if (dLock) segs.push({ w: dLock, c: DEM.SAFE, k: "d-lock" });
    for (const rt of RATINGS) if (D[rt]) segs.push({ w: D[rt], c: DEM[rt], k: `d-${rt}` });
    if (t) segs.push({ w: t, c: "var(--em-toss)", k: "toss" });
    for (const rt of [...RATINGS].reverse()) if (R[rt]) segs.push({ w: R[rt], c: REP[rt], k: `r-${rt}` });
    if (rLock) segs.push({ w: rLock, c: REP.SAFE, k: "r-lock" });
    return segs;
  })();
  const board = mode === "senate"
    ? { d: seats.d, r: seats.r, t: seats.t, total: SENATE_TOTAL, win: 51, unit: "seats" }
    : mode === "house"
    ? { d: house.d, r: house.r, t: house.t, total: HOUSE_TOTAL, win: 218, unit: "seats" }
    : { d: ev.d, r: ev.r, t: ev.t, total: TOTAL_EV, win: 270, unit: "EV" };
  const dWins = board.d >= board.win, rWins = board.r >= board.win;
  const lead = board.d === board.r ? null : board.d > board.r ? "D" : "R";
  const need = (n: number) => Math.max(0, board.win - n);

  const handleShare = () => {
    const base = window.location.href.split("?")[0];
    const url = mode === "redist"
      ? `${base}?mode=redist`
      : `${base}?mode=${mode}&picks=${encodeURIComponent(JSON.stringify(picks))}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setShareLabel("Copied ✓");
    setTimeout(() => setShareLabel("Share map"), 1800);
  };
  const resetMap = () => {
    if (mode === "house") { setHousePicks({}); return; }
    if (mode === "senate") { setSenPicks(senateModelPicks()); return; }
    const next: Record<string, Pick> = {};
    Object.keys(EV_BY_STATE).forEach(k => { next[k] = "T"; });
    Object.keys(EV_SPLIT).forEach(k => { next[k] = "T"; });
    setPresPicks(next);
  };
  const clearMap = () => {
    if (mode === "house") { setHousePicks({}); return; }
    if (mode === "senate") {
      const next: Record<string, Pick> = {};
      for (const st of SENATE_UP.keys()) next[st] = "T";
      setSenPicks(next);
      return;
    }
    setPresPicks({});
  };

  // the narrator: a live sentence describing the painted map and where the
  // path runs — falls back to the instructions while the canvas is untouched.
  const openPrizes = (() => {
    if (mode === "pres") {
      return [...Object.entries(EV_BY_STATE), ...Object.entries(EV_SPLIT)]
        .filter(([k]) => ((presPicks[k] ?? "T") === "T"))
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([k]) => STATE_NAMES[k] ?? k);
    }
    if (mode === "senate") {
      return [...SENATE_UP.entries()]
        .filter(([st]) => ((senPicks[st] ?? "T") === "T"))
        .sort((a, b) => Math.abs(a[1]) - Math.abs(b[1])).slice(0, 3)
        .map(([st]) => STATE_NAMES[st] ?? st);
    }
    return [];
  })();
  const scenario = (() => {
    if (mode === "redist") return meta.deck;
    const { d, r, t } = board;
    if (d === 0 && r === 0 && mode !== "senate") return meta.deck;
    if (dWins || rWins) {
      const w = dWins ? "Democrats" : "Republicans";
      return `${w} reach ${dWins ? d : r} and take ${mode === "pres" ? "the presidency" : "the chamber"} — ${d}–${r}, with ${t} ${board.unit} still on the table.`;
    }
    const leadTxt = d === r ? `Dead even at ${d}–${r}` : `${d > r ? "Democrats" : "Republicans"} lead ${Math.max(d, r)}–${Math.min(d, r)}`;
    const through = openPrizes.length ? ` — the path runs through ${openPrizes.join(", ")}` : "";
    return `${leadTxt}, ${need(Math.max(d, r))} ${board.unit} from ${board.win}${through}.`;
  })();

  const brushHint = mode === "redist"
    ? "An informational map — hover any highlighted state for its status. Statuses as of June 2026."
    : brush === "D" ? "Click a state → Safe D. Click again to cycle Safe → Likely → Lean → Tilt."
    : brush === "R" ? "Click a state → Safe R. Click again to cycle Safe → Likely → Lean → Tilt."
    : "Click any state to reset it to toss-up.";

  const tiles = mode === "pres" ? TILES : SMALL_TILES;

  return (
    <div className="em-page">
      <style>{CSS}</style>

      <DarkNav />

      {/* ── Masthead ── */}
      <div className="em-mast">
        <div className="em-folio"><span>TPSI Interactive</span><span>{meta.folio}</span><span>{meta.scope}</span></div>
        <h1 className="em-title">Electoral Map</h1>
        <p className="em-deck"><span key={scenario} className="em-live">{scenario}</span></p>
      </div>

      {/* ── Scoreboard (sticky) ── */}
      {mode !== "redist" ? (
        <div className="em-board">
          <div className={`em-board-side${dWins ? " is-win" : ""}`}>
            <span className="em-board-party" style={{ color: DEM_MID }}>Democrat</span>
            <span className="em-board-ev" style={{ color: DEM_MID }}><span key={board.d} className="em-num">{board.d}</span></span>
            <span className="em-board-need">{dWins ? <b style={{ color: DEM_MID }}>majority</b> : <><b>{need(board.d)}</b> to {board.win}</>}</span>
          </div>
          <div className="em-board-mid">
            <div className="em-beam">
              {composition.map((s) => (
                <i key={s.k} style={{ width: `${(s.w / board.total) * 100}%`, background: s.c }} title={`${s.w} ${board.unit}`} />
              ))}
              <span className="em-beam-needle" style={{ left: `${(board.win / board.total) * 100}%` }}>
                <b>{board.win}</b>
              </span>
            </div>
            <div className="em-board-meta">
              <span className="em-board-lead">
                {lead
                  ? <span style={{ color: lead === "D" ? DEM_MID : REP_MID }}>{lead === "D" ? "Democrats" : "Republicans"} +{Math.abs(board.d - board.r)}</span>
                  : <span>dead even</span>}
              </span>
              <span className="em-board-toss">{board.t} {board.unit} toss-up{mode === "senate" ? ` · ${D_HOLDOVERS + R_HOLDOVERS} holdovers locked` : ""}</span>
            </div>
          </div>
          <div className={`em-board-side em-r${rWins ? " is-win" : ""}`}>
            <span className="em-board-party" style={{ color: REP_MID }}>Republican</span>
            <span className="em-board-ev" style={{ color: REP_MID }}><span key={board.r} className="em-num">{board.r}</span></span>
            <span className="em-board-need">{rWins ? <b style={{ color: REP_MID }}>majority</b> : <><b>{need(board.r)}</b> to {board.win}</>}</span>
          </div>
        </div>
      ) : (
        <div className="em-board">
          <div className="em-board-side">
            <span className="em-board-party" style={{ color: DEM_MID }}>Dem gains</span>
            <span className="em-board-ev" style={{ color: DEM_MID }}>+{dGain}</span>
            <span className="em-board-need">enacted &amp; court-ordered</span>
          </div>
          <div className="em-board-mid">
            <div className="em-board-bar">
              <i style={{ width: `${(dGain / (dGain + rGain)) * 100}%`, background: `linear-gradient(90deg, ${DEM.SAFE}, ${DEM.LEAN})` }} />
              <i style={{ flex: 1, background: `linear-gradient(90deg, ${REP.LEAN}, ${REP.SAFE})` }} />
            </div>
            <div className="em-board-meta">
              <span style={{ color: rGain > dGain ? REP_MID : DEM_MID }}>Net {rGain === dGain ? "even" : rGain > dGain ? `R +${rGain - dGain}` : `D +${dGain - rGain}`} enacted</span>
              <span className="em-board-toss">{inMotion} states in motion</span>
            </div>
          </div>
          <div className="em-board-side em-r">
            <span className="em-board-party" style={{ color: REP_MID }}>Rep gains</span>
            <span className="em-board-ev" style={{ color: REP_MID }}>+{rGain}</span>
            <span className="em-board-need">enacted maps</span>
          </div>
        </div>
      )}

      {/* ── The ink tray — the rating ramps ARE the brush selector ── */}
      <div className="em-controls">
        {mode !== "redist" ? (
          <div className="em-tray" role="radiogroup" aria-label="Paint brush">
            <button
              className={`em-ink${brush === "D" ? " is-on" : ""}`}
              role="radio" aria-checked={brush === "D"}
              onClick={() => setBrush("D")}
            >
              <span className="em-ink-ramp">
                {(["SAFE","LIKELY","LEAN","TILT"] as Rating[]).map(r => (
                  <i key={r} style={{ background: DEM[r] }} />
                ))}
              </span>
              <span className="em-ink-lab" style={brush === "D" ? { color: DEM_MID } : undefined}>Democrat</span>
            </button>

            <button
              className={`em-ink em-ink-t${brush === "T" ? " is-on" : ""}`}
              role="radio" aria-checked={brush === "T"}
              onClick={() => setBrush("T")}
              title="Eraser — set a state back to toss-up"
            >
              <span className="em-ink-ramp"><i style={{ background: "var(--em-toss)" }} /></span>
              <span className="em-ink-lab">Toss-up</span>
            </button>

            <button
              className={`em-ink em-ink-r${brush === "R" ? " is-on" : ""}`}
              role="radio" aria-checked={brush === "R"}
              onClick={() => setBrush("R")}
            >
              <span className="em-ink-ramp">
                {(["TILT","LEAN","LIKELY","SAFE"] as Rating[]).map(r => (
                  <i key={r} style={{ background: REP[r] }} />
                ))}
              </span>
              <span className="em-ink-lab" style={brush === "R" ? { color: REP_MID } : undefined}>Republican</span>
            </button>
          </div>
        ) : <span className="em-cap em-cap-loose">Status map · informational</span>}
        <div className="em-actions">
          {mode !== "redist" && mode !== "house" && <button className="em-act" onClick={resetMap}>{mode === "senate" ? "Model map" : "Reset"}</button>}
          {mode !== "redist" && <button className="em-act" onClick={clearMap}>{mode === "senate" ? "All toss-up" : "Clear"}</button>}
          <button className="em-share" onClick={handleShare}>{shareLabel}</button>
        </div>
      </div>

      {/* ── Cycle legend — the click grammar, drawn instead of described ── */}
      {mode !== "redist" ? (
        <div className="em-cycle" aria-label={brushHint}>
          {brush === "T" ? (
            <span className="em-cycle-note">click any painted state to erase it back to toss-up</span>
          ) : (
            <>
              <span className="em-cycle-word">click</span>
              {(["SAFE","LIKELY","LEAN","TILT"] as Rating[]).map((r, i) => (
                <span className="em-cycle-step" key={r}>
                  {i > 0 && <span className="em-cycle-arrow" aria-hidden>→</span>}
                  <i style={{ background: (brush === "R" ? REP : DEM)[r] }} />
                  <em>{r.toLowerCase()}</em>
                </span>
              ))}
              <span className="em-cycle-word em-cycle-loop" aria-hidden>↺</span>
            </>
          )}
        </div>
      ) : (
        <p className="em-hint">{brushHint}</p>
      )}

      {/* ── Map ── */}
      <div className="em-stage" ref={stageRef}>
        <div className="em-stage-glow" aria-hidden />
        <svg ref={svgRef} viewBox="0 0 960 600" className="em-svg" preserveAspectRatio="xMidYMid meet" />
      </div>

      {/* ── Inset tiles (small states + split districts) ── */}
      {mode !== "house" && (
      <div className="em-tiles-row">
        <span className="em-cap">{mode === "pres" ? "Northeast & split districts" : "Northeast"}</span>
        <div className="em-tiles">
          {tiles.map(tile => {
            const senUp = SENATE_UP.has(tile.key);
            const interactive = mode === "pres" ? true : mode === "senate" ? senUp : false;
            const fill = mode === "redist"
              ? (REDIST[tile.key] ? REDIST_COLOR[REDIST[tile.key].s] : "var(--em-out)")
              : mode === "senate"
                ? (senUp ? fillFor((senPicks[tile.key] ?? "T") as Pick) : "var(--em-out)")
                : fillFor((presPicks[tile.key] ?? "T") as Pick);
            const p = mode === "senate" ? ((senPicks[tile.key] ?? "T") as Pick) : ((presPicks[tile.key] ?? "T") as Pick);
            const ink = mode === "redist"
              ? { fill: REDIST[tile.key] ? "#ffffff" : "var(--foreground)", opacity: REDIST[tile.key] ? 1 : 0.3 }
              : (mode === "senate" && !senUp) ? { fill: "var(--foreground)", opacity: 0.3 } : labelInk(p);
            return (
              <button key={tile.key} className={`em-tile${interactive ? "" : " is-out"}`} style={{ background: fill }}
                onClick={() => interactive && applyPick(tile.key)}
                onMouseMove={(e) => setTip({ visible:true, x:e.clientX, y:e.clientY, abbr:tile.key, name:STATE_NAMES[tile.key] ?? tile.key, ev:tile.ev, pick:p })}
                onMouseLeave={() => setTip(t => ({ ...t, visible:false }))}>
                <span className="em-tile-ab" style={{ color: ink.fill, opacity: ink.opacity }}>{tile.key.replace("-AL", "")}</span>
                {mode === "pres" && <span className="em-tile-ev" style={{ color: ink.fill, opacity: ink.opacity * 0.7 }}>{tile.ev}</span>}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* ── Legend ── */}
      <div className="em-legend">
        <span className="em-cap">{mode === "redist" ? "Status" : "Ratings"}</span>
        {mode === "redist" ? (
          <div className="em-leg-row">
            {(Object.keys(REDIST_COLOR) as RedistStatus[]).map(st => (
              <span key={st} className="em-leg"><i style={{ background: REDIST_COLOR[st] }} />{REDIST_WORD[st]}</span>
            ))}
            <span className="em-leg"><i style={{ background: "var(--em-out)" }} />No change</span>
            <span className="em-leg em-leg-note">as of june 2026 — statuses evolve</span>
          </div>
        ) : (
          <div className="em-leg-row">
            {(["SAFE","LIKELY","LEAN","TILT"] as Rating[]).map(rt => <span key={"d"+rt} className="em-leg"><i style={{ background: DEM[rt] }} />{rt[0] + rt.slice(1).toLowerCase()} D</span>)}
            <span className="em-leg"><i style={{ background: "var(--em-toss)" }} />Toss-up</span>
            {mode === "senate" && <span className="em-leg"><i style={{ background: "var(--em-out)" }} />Not up in 2026</span>}
            {(["TILT","LEAN","LIKELY","SAFE"] as Rating[]).map(rt => <span key={"r"+rt} className="em-leg"><i style={{ background: REP[rt] }} />{rt[0] + rt.slice(1).toLowerCase()} R</span>)}
          </div>
        )}
      </div>

      {mounted && createPortal(
        <div className="em-dock" role="tablist" aria-label="Map mode" style={{ fontFamily: "var(--font-numeric)" }}>
          {([["pres","2028 presidential"],["senate","2026 senate"],["house","2026 house"],["redist","redistricting"]] as [MapMode, string][]).map(([m, label]) => (
            <button key={m} role="tab" aria-selected={mode === m}
              className={`em-dock-btn${mode === m ? " is-on" : ""}`}
              onClick={() => { setMode(m); setTip(t => ({ ...t, visible: false })); }}>
              {label}
            </button>
          ))}
        </div>,
        document.body
      )}

      {tip.visible && typeof document !== "undefined" && createPortal((() => {
        // Portaled to <body> so position:fixed tracks the viewport (the page's
        // animate-in wrapper carries a transform, which would otherwise capture
        // fixed positioning and shove the tooltip away from the cursor).
        const W = 220, H = 100;
        const abbr = tip.abbr;
        const redistInfo = REDIST[abbr];
        const senUp = SENATE_UP.has(abbr);
        const left = (tip.x + 16 + W > window.innerWidth) ? tip.x - W - 16 : tip.x + 16;
        const top  = (tip.y + 16 + H > window.innerHeight) ? tip.y - H - 16 : tip.y + 16;

        let statusEl: React.ReactNode;
        let hintEl: React.ReactNode;
        let spineColor = pickColor(tip.pick);
        let evEl: React.ReactNode = <span className="em-tip-ev">{tip.ev}<i>EV</i></span>;

        if (mode === "redist") {
          spineColor = redistInfo ? REDIST_COLOR[redistInfo.s] : "var(--em-toss)";
          statusEl = <span className="em-tip-pick"><b style={{ background: spineColor }} />{redistInfo ? REDIST_WORD[redistInfo.s] : "No change"}</span>;
          hintEl = <span className="em-tip-hint">{redistInfo ? redistInfo.note : "current map stands"}</span>;
          evEl = redistInfo && redistInfo.net !== 0
            ? <span className="em-tip-ev">{redistInfo.net > 0 ? `R+${redistInfo.net}` : `D+${-redistInfo.net}`}<i>seats</i></span>
            : <span className="em-tip-ev">—</span>;
        } else if (mode === "house") {
          evEl = <span className="em-tip-ev">1<i>seat</i></span>;
          statusEl = <span className="em-tip-pick"><b style={{ background: pickColor(tip.pick) }} />{pickLabel(tip.pick)}</span>;
          const cur = tip.pick;
          hintEl = <span className="em-tip-hint">{brush === "T" ? "Click → toss-up" : (cur && cur !== "T" && cur[0] === brush) ? `Click → ${RATING_WORD[nextRating(cur.split("_")[1] as Rating)]} ${brush}` : `Click → Safe ${brush}`}</span>;
        } else if (mode === "senate") {
          evEl = <span className="em-tip-ev">{senUp ? "2026" : "—"}<i>{senUp ? "race" : "not up"}</i></span>;
          if (!senUp) {
            spineColor = "var(--em-out)";
            statusEl = <span className="em-tip-pick"><b style={{ background: "var(--em-out)" }} />Holdover seat</span>;
            hintEl = <span className="em-tip-hint">not on the 2026 ballot</span>;
          } else {
            statusEl = <span className="em-tip-pick"><b style={{ background: pickColor(tip.pick) }} />{pickLabel(tip.pick)}</span>;
            const cur = tip.pick;
            hintEl = <span className="em-tip-hint">{brush === "T" ? "Click → toss-up" : (cur && cur !== "T" && cur[0] === brush) ? `Click → ${RATING_WORD[nextRating(cur.split("_")[1] as Rating)]} ${brush}` : `Click → Safe ${brush}`}</span>;
          }
        } else {
          statusEl = <span className="em-tip-pick"><b style={{ background: pickColor(tip.pick) }} />{pickLabel(tip.pick)}</span>;
          const cur = tip.pick;
          hintEl = <span className="em-tip-hint">{brush === "T" ? "Click → toss-up" : (cur && cur !== "T" && cur[0] === brush) ? `Click → ${RATING_WORD[nextRating(cur.split("_")[1] as Rating)]} ${brush}` : `Click → Safe ${brush}`}</span>;
        }

        return (
          <div className="em-tip" style={{ left, top, borderLeftColor: spineColor }}>
            <div className="em-tip-top">
              <span className="em-tip-state">{tip.name}</span>
              {evEl}
            </div>
            <div className="em-tip-row">
              {statusEl}
              {hintEl}
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────
const CSS = `
html, body { background: var(--background) !important; }
body header, body footer { display: none !important; }

.em-page { padding-bottom: 86px; position: relative;
  --disp: var(--font-display);
  --serif: var(--font-body);
  --data: var(--font-numeric);
  --lab: var(--font-numeric);
  --em-toss: #33394a;
  --em-out: #191c24;
  max-width: 1280px; margin: 0 auto; padding: 0 2px 64px;
  position: relative; z-index: 1; color: var(--foreground);
  font-family: var(--lab); font-size: 14px; letter-spacing: -0.01em;
}

/* masthead */
.em-folio { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 14px 0; border-top: 1px solid var(--border2); border-bottom: 1px solid var(--border); font-family: var(--lab); font-size: 10.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted2); }
.em-folio span:first-child { color: var(--foreground); }
.em-title { font-family: var(--disp); font-weight: 500; text-transform: lowercase; letter-spacing: -0.03em; line-height: 0.92; font-size: clamp(44px, 8.5vw, 96px); margin: 18px 0 0; color: var(--foreground); }
.em-deck { font-family: var(--serif); font-size: clamp(15px, 1.6vw, 19px); line-height: 1.55; color: var(--foreground2); max-width: 62ch; margin: 16px 0 0; }

/* mode tabs — hairline editorial, not chips */
/* atmosphere — feathered light, never panels */
.em-page::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(46% 30% at 12% 4%, rgba(118,110,210,0.05), transparent 70%),
    radial-gradient(40% 26% at 92% 16%, rgba(244,125,140,0.035), transparent 72%);
}
.em-page > * { position: relative; z-index: 1; }

/* the stage — the country sits in pooled light, not on flat black */
.em-stage { position: relative; width: 100%; margin-top: 6px; }
.em-stage-glow {
  position: absolute; inset: -8% -5% -12%; pointer-events: none; z-index: 0;
  background:
    radial-gradient(56% 52% at 50% 46%, rgba(118,110,210,0.11), transparent 72%),
    radial-gradient(32% 30% at 73% 26%, rgba(244,125,140,0.05), transparent 70%),
    radial-gradient(38% 36% at 25% 62%, rgba(86,110,230,0.07), transparent 72%);
  filter: blur(26px);
}
.em-stage .em-svg { position: relative; z-index: 1; }

/* click choreography */
.em-ripple {
  position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; z-index: 6;
  border-radius: 999px; border: 1.5px solid rgba(244,244,239,0.65); pointer-events: none;
  animation: em-ripple 560ms cubic-bezier(.2,.8,.4,1) both;
}
@keyframes em-ripple { from { opacity: 0.9; transform: scale(0.4); } to { opacity: 0; transform: scale(5.2); } }
.em-svg path.em-pop, .em-svg .em-pop { animation: em-pop 420ms ease both; }
@keyframes em-pop { 0% { filter: brightness(1.75) saturate(1.35); } 100% { filter: none; } }

/* live numerals tick in as the count moves */
.em-num { display: inline-block; animation: em-num-in 300ms cubic-bezier(.2,.9,.3,1.25) both; }
@keyframes em-num-in { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
.em-live { display: inline; animation: em-fade 420ms ease both; }
@keyframes em-fade { from { opacity: 0.25; } to { opacity: 1; } }

/* entry choreography — the page assembles itself */
@keyframes em-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
.em-mast > * { animation: em-rise 0.6s cubic-bezier(.16,1,.3,1) both; }
.em-mast > *:nth-child(1) { animation-delay: 0.02s; }
.em-mast > *:nth-child(2) { animation-delay: 0.08s; }
.em-mast > *:nth-child(3) { animation-delay: 0.15s; }
.em-board { animation: em-rise 0.6s cubic-bezier(.16,1,.3,1) 0.22s both; }
.em-controls { animation: em-rise 0.6s cubic-bezier(.16,1,.3,1) 0.3s both; }
.em-cycle, .em-hint { animation: em-rise 0.6s cubic-bezier(.16,1,.3,1) 0.36s both; }
.em-stage { animation: em-rise 0.7s cubic-bezier(.16,1,.3,1) 0.42s both; }
.em-tiles-row { animation: em-rise 0.6s cubic-bezier(.16,1,.3,1) 0.52s both; }
.em-beam > i { transform-origin: left center; animation: em-grow 0.9s cubic-bezier(.2,.8,.2,1) 0.34s both; }
@keyframes em-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

@media (prefers-reduced-motion: reduce) {
  .em-mast > *, .em-board, .em-controls, .em-cycle, .em-hint, .em-stage, .em-tiles-row,
  .em-beam > i, .em-num, .em-live, .em-dock { animation: none !important; }
  .em-ripple { display: none; }
}

/* the floating mode dock — fixed to the real viewport via body portal */
.em-dock {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 240;
  animation: em-dock-in 0.7s cubic-bezier(.16,1,.3,1) 0.55s both;
  display: inline-flex; align-items: center; gap: 3px; padding: 5px;
  border-radius: 999px; border: 1px solid var(--border2);
  background: color-mix(in srgb, var(--background) 62%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(150%); backdrop-filter: blur(18px) saturate(150%);
  box-shadow: 0 18px 50px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07);
  max-width: calc(100vw - 24px); overflow-x: auto; scrollbar-width: none;
}
.em-dock::-webkit-scrollbar { display: none; }
.em-dock-btn {
  flex-shrink: 0; padding: 9px 16px; border: 0; border-radius: 999px; background: transparent;
  font-size: 12px; font-weight: 650; letter-spacing: 0.02em; text-transform: lowercase;
  color: var(--muted); cursor: pointer; white-space: nowrap;
  transition: color 180ms ease, background 220ms cubic-bezier(.2,.8,.2,1);
}
.em-dock-btn:hover { color: var(--foreground); }
.em-dock-btn.is-on { background: #f4f4ef; color: #050505; }
@keyframes em-dock-in { from { opacity: 0; transform: translate(-50%, 18px); } to { opacity: 1; transform: translate(-50%, 0); } }
@media (max-width: 560px) { .em-dock { bottom: 12px; } .em-dock-btn { padding: 8px 12px; font-size: 11px; } }

.em-modes { display: flex; gap: 26px; margin-top: 20px; border-bottom: 1px solid var(--border); }
.em-mode { position: relative; font-family: var(--lab); font-size: 12px; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted2); background: none; border: 0; padding: 0 1px 11px; cursor: pointer; transition: color 180ms ease; }
.em-mode:hover { color: var(--foreground2); }
.em-mode:after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1.5px; background: var(--foreground); transform: scaleX(0); transform-origin: left center; transition: transform 280ms cubic-bezier(.2,.8,.2,1); }
.em-mode.is-on { color: var(--foreground); }
.em-mode.is-on:after { transform: scaleX(1); }

/* scoreboard (sticky) */
.em-board { position: sticky; top: 0; z-index: 40; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: clamp(16px, 4vw, 48px); margin-top: 26px; padding: 16px 4px; background: var(--background); border-top: 1px solid var(--border); border-bottom: 1px solid var(--foreground); }
.em-board-side { display: flex; flex-direction: column; align-items: flex-start; line-height: 1; }
.em-board-side.em-r { align-items: flex-end; text-align: right; }
.em-board-party { font-family: var(--lab); font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
.em-board-ev { font-family: var(--disp); font-weight: 700; font-size: clamp(46px, 7.5vw, 78px); line-height: 0.82; letter-spacing: -0.04em; margin: 6px 0 5px; font-variant-numeric: tabular-nums; transition: text-shadow 240ms ease; }
.em-board-side.is-win .em-board-ev { text-shadow: 0 0 22px currentColor; }
.em-board-need { font-family: var(--data); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted2); }
.em-board-mid { min-width: 0; padding-top: 10px; }
.em-board-need b { font-family: var(--data); font-weight: 800; color: var(--foreground2); font-variant-numeric: tabular-nums; }

.em-board-bar { position: relative; display: flex; gap: 2px; height: 14px; }
.em-board-bar > i { display: block; height: 100%; border-radius: 3px; transition: width 360ms cubic-bezier(.2,.8,.2,1); }

/* the beam — composition by rating, not just totals */
.em-beam { position: relative; display: flex; gap: 2px; height: 18px; }
.em-beam > i {
  display: block; height: 100%; min-width: 0; border-radius: 2px;
  transition: width 420ms cubic-bezier(.2,.8,.2,1);
}
.em-beam > i:first-child { border-radius: 9px 2px 2px 9px; }
.em-beam > i:last-child { border-radius: 2px 9px 9px 2px; }
.em-beam-needle {
  position: absolute; top: -9px; bottom: -9px; width: 0; z-index: 2;
  border-left: 1.5px solid var(--foreground);
}
.em-beam-needle::after { content: ''; position: absolute; left: -3.25px; bottom: -2px; width: 5px; height: 5px; transform: rotate(45deg); background: var(--foreground); }
.em-beam-needle b {
  position: absolute; top: -16px; left: 50%; transform: translateX(-50%);
  font-family: var(--data); font-size: 10px; font-weight: 800; letter-spacing: 0.06em;
  color: var(--foreground); background: var(--background); padding: 0 4px;
}
.em-board-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-top: 16px; }
.em-board-lead { font-family: var(--data); font-size: 12px; font-weight: 750; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
.em-board-toss { font-family: var(--lab); font-weight: 600; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted2); }

/* controls — the ink tray */
.em-controls { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 18px 28px; margin-top: 30px; }
.em-cap { font-family: var(--lab); font-size: 9.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted2); flex-shrink: 0; }
.em-cap-loose { letter-spacing: 0.12em; }

.em-tray { display: flex; align-items: flex-end; gap: 26px; }
.em-ink { position: relative; display: flex; flex-direction: column; gap: 9px; background: none; border: 0; padding: 0; cursor: pointer; }
.em-ink-ramp { display: flex; gap: 3px; }
.em-ink-ramp i {
  display: block; width: 30px; height: 14px; border-radius: 3px;
  transform-origin: bottom center;
  transition: transform 240ms cubic-bezier(.2,.9,.25,1.25), box-shadow 240ms ease, opacity 200ms ease;
  opacity: 0.45;
}
.em-ink-t .em-ink-ramp i { width: 30px; }
.em-ink:hover .em-ink-ramp i { opacity: 0.8; }
.em-ink.is-on .em-ink-ramp i { opacity: 1; transform: scaleY(1.55); }
.em-ink.is-on .em-ink-ramp i:nth-child(1) { box-shadow: 0 6px 22px -4px currentColor; }
.em-ink-lab { font-family: var(--lab); font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted2); text-align: left; transition: color 180ms ease; }
.em-ink:hover .em-ink-lab { color: var(--foreground); }
.em-ink.is-on .em-ink-lab { color: var(--foreground); }
.em-ink.is-on::after { content: ''; position: absolute; left: 0; right: auto; bottom: -8px; width: 18px; height: 1.5px; background: var(--foreground); }
.em-ink.em-ink-r .em-ink-lab { text-align: left; }

.em-actions { display: flex; align-items: center; gap: 20px; padding-bottom: 2px; }
.em-act { font-family: var(--lab); font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted); background: none; border: 0; border-bottom: 1px solid var(--border3); padding: 0 0 3px; cursor: pointer; transition: color 160ms ease, border-color 160ms ease; }
.em-act:hover { color: var(--foreground); border-color: var(--foreground); }
.em-share {
  font-family: var(--lab); font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  color: #050505; background: #f4f4ef; border: 0; border-radius: 999px; padding: 9px 18px; cursor: pointer;
  transition: transform 200ms cubic-bezier(.16,1,.3,1), box-shadow 200ms ease;
}
.em-share:hover { transform: translateY(-1.5px); box-shadow: 0 12px 30px rgba(109,62,233,0.32); }

/* cycle legend — the click grammar drawn as chips */
.em-cycle { display: flex; align-items: center; flex-wrap: wrap; gap: 7px 10px; margin: 18px 0 20px; min-height: 18px; }
.em-cycle-word { font-family: var(--serif); font-size: 13.5px; font-style: italic; color: var(--muted); margin-right: 2px; }
.em-cycle-loop { font-style: normal; font-size: 14px; color: var(--muted2); margin-left: 2px; }
.em-cycle-step { display: inline-flex; align-items: center; gap: 7px; }
.em-cycle-step i { display: block; width: 13px; height: 13px; border-radius: 3px; }
.em-cycle-step em { font-style: normal; font-family: var(--lab); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.em-cycle-arrow { font-size: 11px; color: var(--muted2); margin-right: 3px; }
.em-cycle-note { font-family: var(--serif); font-size: 13.5px; font-style: italic; color: var(--muted); }
.em-hint { font-family: var(--serif); font-size: 13.5px; line-height: 1.5; color: var(--muted); margin: 18px 0 20px; max-width: 70ch; }

/* map */
.em-map { width: 100%; }
.em-svg { width: 100%; display: block; }
.em-lab { font-family: var(--data); font-size: 12px; font-weight: 800; letter-spacing: 0.01em; pointer-events: none; }

/* inset tiles */
.em-tiles-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 6px; padding-top: 16px; border-top: 1px solid var(--border); }
.em-tiles { display: flex; flex-wrap: wrap; gap: 4px; }
.em-tile { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; min-width: 50px; height: 42px; padding: 4px 6px; border: 0; border-radius: 7px; cursor: pointer; line-height: 1.1; transition: filter 160ms ease, transform 260ms cubic-bezier(.2,.9,.3,1.45), background 380ms cubic-bezier(.2,.8,.2,1), box-shadow 240ms ease; }
.em-tile:not(.is-out):hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 10px 26px rgba(0,0,0,0.45); }
.em-tile:hover { filter: brightness(1.12) saturate(1.15); }
.em-tile.is-out { cursor: default; }
.em-tile.is-out:hover { filter: none; }
.em-tile-ab { font-family: var(--disp); font-size: 13px; letter-spacing: 0.02em; }
.em-tile-ev { font-family: var(--data); font-size: 9px; font-weight: 700; margin-top: 1px; }

/* legend */
.em-legend { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--border); }
.em-leg-row { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.em-leg { display: inline-flex; align-items: center; gap: 7px; font-family: var(--lab); font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.em-leg i { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
.em-leg-note { color: var(--muted3); letter-spacing: 0.08em; }

/* tooltip — portaled to <body>, so it uses GLOBAL font vars (page-scoped --disp
   etc. don't resolve outside .em-page). */
.em-tip { position: fixed; z-index: 99999; pointer-events: none; width: 210px; animation: em-tip-in 0.16s cubic-bezier(.2,.9,.3,1.2) both; transform-origin: top left; background: color-mix(in srgb, var(--background) 97%, transparent); border: 1px solid var(--border2); border-left: 3px solid var(--em-toss); border-radius: 12px; box-shadow: 0 24px 60px rgba(0,0,0,0.6); overflow: hidden; -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); }
@keyframes em-tip-in { from { opacity: 0; transform: scale(0.94) translateY(5px); } to { opacity: 1; transform: none; } }
.em-tip-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 11px 14px 9px; }
.em-tip-state { font-family: inherit; font-weight: 700; font-size: 15px; letter-spacing: -0.02em; line-height: 1; color: var(--foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.em-tip-ev { font-family: inherit; font-size: 17px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; color: var(--foreground); white-space: nowrap; }
.em-tip-ev i { font-style: normal; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; margin-left: 3px; color: var(--muted2); }
.em-tip-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 14px 11px; border-top: 1px solid var(--border); }
.em-tip-pick { display: inline-flex; align-items: center; gap: 7px; font-family: inherit; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; color: var(--foreground); }
.em-tip-pick b { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.em-tip-hint { font-family: inherit; font-size: 9.5px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* responsive */
@media (max-width: 720px) {
  .em-board { grid-template-columns: 1fr; gap: 14px; }
  .em-board-side, .em-board-side.em-r { flex-direction: row; align-items: baseline; gap: 10px; text-align: left; }
  .em-board-ev { font-size: 40px; margin: 0; }
  .em-board-need { margin-left: auto; }
  .em-controls { flex-direction: column; align-items: flex-start; }
  .em-modes { gap: 18px; overflow-x: auto; }
}
`;
