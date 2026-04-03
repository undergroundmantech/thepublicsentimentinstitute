"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── types ────────────────────────────────────────────────────────────────────
type PartyBrush = "D" | "R" | "T";
type Rating     = "SAFE" | "LIKELY" | "LEAN" | "TILT";
type Pick       = "T" | `D_${Rating}` | `R_${Rating}`;

interface TooltipState {
  visible: boolean;
  x: number; y: number;
  abbr: string; name: string; ev: number; isAtLarge: boolean;
  pick: Pick; hint: string;
}

// ─── data ─────────────────────────────────────────────────────────────────────
const RATINGS: Rating[] = ["SAFE", "LIKELY", "LEAN", "TILT"];

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

const SIDE_TILES = [
  {key:"DC",    label:"DC",    ev:3  },
  {key:"DE",    label:"DE",    ev:3  },
  {key:"RI",    label:"RI",    ev:4  },
  {key:"CT",    label:"CT",    ev:7  },
  {key:"NJ",    label:"NJ",    ev:14 },
  {key:"MD",    label:"MD",    ev:10 },
  {key:"MA",    label:"MA",    ev:11 },
  {key:"VT",    label:"VT",    ev:3  },
  {key:"NH",    label:"NH",    ev:4  },
  {key:"ME-AL", label:"ME-AL", ev:2  },
  {key:"ME-01", label:"ME-01", ev:1  },
  {key:"ME-02", label:"ME-02", ev:1  },
  {key:"NE-AL", label:"NE-AL", ev:2  },
  {key:"NE-01", label:"NE-01", ev:1  },
  {key:"NE-02", label:"NE-02", ev:1  },
  {key:"NE-03", label:"NE-03", ev:1  },
];

const STORAGE_KEY = "psi-electoral-map-picks-v2";
const TOTAL_EV    = 538;

// ─── helpers ──────────────────────────────────────────────────────────────────
const RATINGS_LIST: Rating[] = ["SAFE", "LIKELY", "LEAN", "TILT"];

// High-contrast palette — blues vs reds, clearly distinguishable at each tier
const DEM_FILLS: Record<Rating, string> = {
  SAFE:   "#0033a0",   // deep royal blue
  LIKELY: "#1a5fd4",   // vivid blue
  LEAN:   "#4a9dff",   // bright sky blue
  TILT:   "#8dc8ff",   // pale blue
};
const REP_FILLS: Record<Rating, string> = {
  SAFE:   "#9b0000",   // deep crimson
  LIKELY: "#d42020",   // vivid red
  LEAN:   "#ff6040",   // orange-red
  TILT:   "#ffaa88",   // peach
};

const DEM_FILLS_LIGHT: Record<Rating, string> = {
  SAFE:   "#0033a0",
  LIKELY: "#1a5fd4",
  LEAN:   "#3a88f0",
  TILT:   "#70b0f8",
};
const REP_FILLS_LIGHT: Record<Rating, string> = {
  SAFE:   "#8b0000",
  LIKELY: "#c41c1c",
  LEAN:   "#e84020",
  TILT:   "#f08060",
};

function fillFor(p: Pick | undefined, dark: boolean): string {
  if (!p || p === "T") return dark ? "#2a2a2a" : "#d4d4d4";
  const [party, rating] = p.split("_") as ["D"|"R", Rating];
  const table = dark
    ? (party === "D" ? DEM_FILLS : REP_FILLS)
    : (party === "D" ? DEM_FILLS_LIGHT : REP_FILLS_LIGHT);
  return table[rating];
}
function strokeFor(p: Pick | undefined, dark: boolean): string {
  if (!p || p === "T") return dark ? "#444" : "#aaa";
  return p.startsWith("D_") ? "#1a5fd4" : "#d42020";
}
function labelFor(p: Pick | undefined): string {
  if (!p || p === "T") return "TOSSUP";
  const [party, rating] = p.split("_") as ["D"|"R", Rating];
  return `${party === "D" ? "DEM" : "GOP"} · ${rating}`;
}
function labelColorFor(p: Pick | undefined, dark: boolean): string {
  if (!p || p === "T") return dark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.45)";
  return p.startsWith("D_") ? (dark ? "rgba(147,197,253,.9)" : "#1a3a8f") : (dark ? "rgba(252,165,165,.9)" : "#7f1d1d");
}
function nextRating(cur: Rating): Rating {
  return RATINGS_LIST[(RATINGS_LIST.indexOf(cur) + 1) % RATINGS_LIST.length];
}
function stateKey(abbr: string) {
  return abbr === "ME" ? "ME-AL" : abbr === "NE" ? "NE-AL" : abbr;
}
function sumEV(picks: Record<string, Pick>) {
  let d = 0, r = 0, t = 0;
  for (const [st, ev] of Object.entries(EV_BY_STATE)) {
    const p = picks[st] ?? "T";
    if (p === "T") t += ev; else if (p.startsWith("D_")) d += ev; else r += ev;
  }
  for (const [k, ev] of Object.entries(EV_SPLIT)) {
    const p = picks[k] ?? "T";
    if (p === "T") t += ev; else if (p.startsWith("D_")) d += ev; else r += ev;
  }
  return { d, r, t };
}
function applyBrush(picks: Record<string, Pick>, key: string, brush: PartyBrush): Record<string, Pick> {
  const next = { ...picks };
  if (brush === "T") { next[key] = "T"; return next; }
  const cur       = picks[key];
  const curParty  = cur && cur !== "T" ? cur[0] as "D"|"R" : null;
  const curRating = cur && cur !== "T" ? cur.split("_")[1] as Rating : null;
  next[key] = curParty === brush && curRating
    ? `${brush}_${nextRating(curRating)}` as Pick
    : `${brush}_SAFE` as Pick;
  return next;
}


// ─── page ─────────────────────────────────────────────────────────────────────
export default function ElectoralMapPage() {
  const [brush,      setBrush]      = useState<PartyBrush>("T");
  const [picks,      setPicks]      = useState<Record<string, Pick>>({});
  const [shareLabel, setShareLabel] = useState("↗ Share");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [darkMode,   setDarkMode]   = useState(true);
  const [tooltip,    setTooltip]    = useState<TooltipState>({
    visible:false, x:0, y:0, abbr:"", name:"", ev:0, isAtLarge:false, pick:"T", hint:"",
  });

  const svgRef        = useRef<SVGSVGElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const brushRef      = useRef<PartyBrush>("T");
  const darkRef       = useRef<boolean>(true);
  brushRef.current    = brush;
  darkRef.current     = darkMode;

  // localStorage
  useEffect(() => {
    try { const r = localStorage.getItem(STORAGE_KEY); if (r) setPicks(JSON.parse(r)); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(picks)); } catch {}
  }, [picks]);

  // fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  }, []);

  const applyPick = useCallback((key: string) => {
    setPicks(prev => applyBrush(prev, key, brushRef.current));
  }, []);

  // draw map once + labels
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
        const svg  = svgRef.current;
        const proj = geoAlbersUsa().scale(1280).translate([480, 300]);
        const path = geoPath().projection(proj);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const states = feature(topo as any, (topo as any).objects.states) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const border = mesh(topo as any, (topo as any).objects.states, (a:any, b:any) => a !== b);
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        for (const f of states.features) {
          const fips = String(f.id).padStart(2, "0");
          const abbr = FIPS[fips];
          if (!abbr) continue;
          const key       = stateKey(abbr);
          const clickable = abbr === "ME" || abbr === "NE" || EV_BY_STATE[abbr] != null;
          const evCount   = EV_BY_STATE[abbr] ?? 0;

          const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
          el.setAttribute("d", path(f) ?? "");
          el.setAttribute("data-key", key);
          el.setAttribute("data-abbr", abbr);
          el.style.cssText = `fill:${fillFor("T", darkRef.current)};stroke:#111;stroke-width:0.8;cursor:${clickable?"pointer":"default"};transition:filter 160ms ease;`;

          if (clickable) {
            el.addEventListener("click", () => applyPick(key));
            el.addEventListener("mouseover",  () => { el.style.filter = "brightness(1.25) saturate(1.3)"; });
            el.addEventListener("mouseout",   () => { el.style.filter = ""; });
          }
          el.addEventListener("mousemove", (ev: MouseEvent) => {
            const evC = abbr === "ME" || abbr === "NE" ? (EV_SPLIT[key] ?? 0) : (EV_BY_STATE[abbr] ?? 0);
            setPicks(cur => {
              const p    = (cur[key] ?? "T") as Pick;
              const hint = brushRef.current === "T"
                ? "Click to set TOSSUP"
                : `Click: ${brushRef.current === "D" ? "DEM" : "GOP"} · cycles rating`;
              setTooltip({ visible:true, x:ev.clientX, y:ev.clientY, abbr, name:STATE_NAMES[abbr]??abbr, ev:evC, isAtLarge:abbr==="ME"||abbr==="NE", pick:p, hint });
              return cur;
            });
          });
          el.addEventListener("mouseleave", () => setTooltip(t => ({ ...t, visible:false })));
          svg.appendChild(el);
        }

        const be = document.createElementNS("http://www.w3.org/2000/svg", "path");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        be.setAttribute("d", path(border as any) ?? "");
        be.style.cssText = "fill:none;stroke:#111;stroke-width:0.8;pointer-events:none;";
        svg.appendChild(be);
      } catch { /* network unavailable */ }
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync colors to picks + dark mode
  useEffect(() => {
    svgRef.current?.querySelectorAll<SVGPathElement>("[data-key]").forEach(el => {
      const p = (picks[el.getAttribute("data-key")!] ?? "T") as Pick;
      el.style.fill   = fillFor(p, darkMode);
      el.style.stroke = darkMode ? "#111" : "#888";
    });
    // Update border stroke
    svgRef.current?.querySelectorAll<SVGPathElement>("path:not([data-key])").forEach(el => {
      if (el.style.fill === "none") el.style.stroke = darkMode ? "#111" : "#999";
    });
  }, [picks, darkMode]);

  const { d, r, t } = sumEV(picks);
  const pct = (n: number) => `${((n / TOTAL_EV) * 100).toFixed(2)}%`;

  const handleShare = () => {
    const url = window.location.href.split("?")[0] + "?picks=" + encodeURIComponent(JSON.stringify(picks));
    navigator.clipboard?.writeText(url).catch(() => {});
    setShareLabel("✓ Copied!");
    setTimeout(() => setShareLabel("↗ Share"), 2000);
  };

  const setAllTossup = () => {
    const next: Record<string, Pick> = {};
    Object.keys(EV_BY_STATE).forEach(k => { next[k] = "T"; });
    Object.keys(EV_SPLIT).forEach(k   => { next[k] = "T"; });
    setPicks(next);
  };

  const dWins = d >= 270;
  const rWins = r >= 270;

  const dm = darkMode;

  return (
    <>
      <style>{buildCSS(dm)}</style>
      <div ref={containerRef} className={`em-root${isFullscreen ? " em-fs" : ""}${dm ? " em-dark" : " em-light"}`}>

        {/* ── TOP BAR ── */}
        <div className="em-top">
          <div className="em-top-brand">
            <span className="em-logo">PSI</span>
            <div className="em-brand-text">
              <span className="em-brand-main">Electoral Forecaster</span>
              <span className="em-brand-sub">2028 Presidential · Interactive Map</span>
            </div>
          </div>

          {/* EV bar – center */}
          <div className="em-ev-center">
            <div className="em-ev-side" style={{ color: dm ? "#4a9dff" : "#0033a0" }}>
              <span className="em-ev-label">DEM</span>
              <span className="em-ev-num">{d}</span>
            </div>
            <div className="em-ev-middle">
              <div className="em-ev-bar">
                <div style={{ width:pct(d), background: dm ? "#1a5fd4" : "#0033a0", height:"100%", transition:"width .5s" }} />
                <div style={{ width:pct(t), background: dm ? "#333" : "#bbb",       height:"100%", transition:"width .5s" }} />
                <div style={{ flex:1,       background: dm ? "#d42020" : "#9b0000", height:"100%" }} />
              </div>
              <span className="em-270-txt">270 TO WIN</span>
            </div>
            <div className="em-ev-side" style={{ color: dm ? "#ff6040" : "#9b0000" }}>
              <span className="em-ev-label">GOP</span>
              <span className="em-ev-num">{r}</span>
            </div>
          </div>

          {/* Actions – right */}
          <div className="em-top-actions">
            <button className="em-btn" onClick={() => setDarkMode(v => !v)}>
              {dm ? "☀ Light" : "☾ Dark"}
            </button>
            <button className="em-btn" onClick={setAllTossup}>Reset</button>
            <button className="em-btn" onClick={() => setPicks({})}>Clear</button>
            <button className="em-btn" onClick={handleShare}>{shareLabel}</button>
            <button className="em-btn em-btn-gold" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              )}
              {isFullscreen ? "Exit" : "Fullscreen"}
            </button>
          </div>
        </div>

        {/* ── WIN BANNER ── */}
        {(dWins || rWins) && (
          <div className="em-win" style={{
            background: dWins
              ? (dm ? "rgba(0,51,160,0.18)" : "rgba(0,51,160,0.08)")
              : (dm ? "rgba(155,0,0,0.18)" : "rgba(155,0,0,0.08)"),
            borderColor: dWins ? "#1a5fd4" : "#d42020"
          }}>
            <span style={{ color: dWins ? (dm ? "#4a9dff" : "#0033a0") : (dm ? "#ff6040" : "#9b0000") }}>
              ★ {dWins ? "DEMOCRAT" : "REPUBLICAN"} WINS WITH {dWins ? d : r} ELECTORAL VOTES
            </span>
          </div>
        )}

        {/* ── BRUSH BAR ── */}
        <div className="em-brush-bar">
          <span className="em-brush-label">PAINT:</span>
          <div className="em-brush-group">
            {(["D","R","T"] as PartyBrush[]).map(b => (
              <button key={b}
                className={`em-brush-btn${brush === b ? " active" : ""}`}
                style={brush === b ? {
                  background: b === "D" ? (dm ? "#1a5fd4" : "#0033a0")
                            : b === "R" ? (dm ? "#d42020" : "#9b0000")
                            : (dm ? "#444" : "#888"),
                  borderColor: b === "D" ? (dm ? "#4a9dff" : "#1a5fd4")
                             : b === "R" ? (dm ? "#ff6040" : "#d42020")
                             : (dm ? "#888" : "#666"),
                  color: "#fff",
                } : {}}
                onClick={() => setBrush(b)}
              >
                {b === "D" ? "◀ Democrat" : b === "R" ? "Republican ▶" : "○ Tossup"}
              </button>
            ))}
          </div>
          <span className="em-brush-hint">
            {brush === "D" ? "Click → DEM, click again to cycle SAFE→LIKELY→LEAN→TILT" :
             brush === "R" ? "Click → GOP, click again to cycle SAFE→LIKELY→LEAN→TILT" :
             "Click states to reset to TOSSUP"}
          </span>
          <span className="em-tossup-chip">{t} TOSSUP</span>
        </div>

        {/* ── MAIN BODY ── */}
        <div className="em-body">

          {/* MAP */}
          <div className="em-map-area">
            <svg ref={svgRef} viewBox="0 0 960 600" className="em-svg" preserveAspectRatio="xMidYMid meet" />
            {/* Small-state tiles */}
            <div className="em-tiles">
              {SIDE_TILES.map(tile => {
                const p = (picks[tile.key] ?? "T") as Pick;
                return (
                  <button key={tile.key} className="em-tile"
                    onClick={() => applyPick(tile.key)}
                    style={{
                      background: fillFor(p, dm),
                      borderColor: strokeFor(p, dm),
                      color: labelColorFor(p, dm),
                    }}
                  >
                    <span className="em-tile-lbl">{tile.label}</span>
                    <span className="em-tile-ev">{tile.ev}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="em-sidebar">

            {/* Legend */}
            <div className="em-panel">
              <div className="em-panel-title">LEGEND</div>
              <div className="em-legend">
                {[
                  { l:"Safe D",   f: dm ? "#0033a0" : "#0033a0", tc: "rgba(255,255,255,.9)" },
                  { l:"Likely D", f: dm ? "#1a5fd4" : "#1a5fd4", tc: "rgba(255,255,255,.9)" },
                  { l:"Lean D",   f: dm ? "#4a9dff" : "#3a88f0", tc: "rgba(255,255,255,.9)" },
                  { l:"Tilt D",   f: dm ? "#8dc8ff" : "#70b0f8", tc: dm ? "rgba(0,0,0,.7)" : "rgba(0,0,0,.75)" },
                  { l:"Tossup",   f: dm ? "#2a2a2a" : "#d4d4d4", tc: dm ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.55)" },
                  { l:"Tilt R",   f: dm ? "#ffaa88" : "#f08060", tc: dm ? "rgba(0,0,0,.7)" : "rgba(0,0,0,.75)" },
                  { l:"Lean R",   f: dm ? "#ff6040" : "#e84020", tc: "rgba(255,255,255,.9)" },
                  { l:"Likely R", f: dm ? "#d42020" : "#c41c1c", tc: "rgba(255,255,255,.9)" },
                  { l:"Safe R",   f: dm ? "#9b0000" : "#8b0000", tc: "rgba(255,255,255,.9)" },
                ].map(({ l, f, tc }) => (
                  <div key={l} className="em-chip" style={{ background:f, color:tc }}>{l}</div>
                ))}
              </div>
            </div>

            {/* Scoreboard */}
            <div className="em-panel">
              <div className="em-panel-title">SCOREBOARD</div>
              <div className="em-score-card">
                <div className="em-score-party">DEMOCRAT</div>
                <div className="em-score-num" style={{ color: dm ? "#4a9dff" : "#0033a0" }}>{d}</div>
                <div className="em-score-track">
                  <div style={{ width:`${Math.min((d/270)*100, 100)}%`, background: dm ? "#1a5fd4" : "#0033a0", height:"100%", transition:"width .5s cubic-bezier(.22,1,.36,1)" }} />
                </div>
                <div className="em-score-need" style={{ color:d>=270?"#22c55e": dm ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)" }}>
                  {d >= 270 ? "★ WINNER" : `Needs ${270-d} more`}
                </div>
              </div>
              <div className="em-score-tossup">{t} EV TOSSUP</div>
              <div className="em-score-card">
                <div className="em-score-party">REPUBLICAN</div>
                <div className="em-score-num" style={{ color: dm ? "#ff6040" : "#9b0000" }}>{r}</div>
                <div className="em-score-track">
                  <div style={{ width:`${Math.min((r/270)*100, 100)}%`, background: dm ? "#d42020" : "#9b0000", height:"100%", transition:"width .5s cubic-bezier(.22,1,.36,1)" }} />
                </div>
                <div className="em-score-need" style={{ color:r>=270?"#22c55e": dm ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)" }}>
                  {r >= 270 ? "★ WINNER" : `Needs ${270-r} more`}
                </div>
              </div>
            </div>

            {/* How to use */}
            <div className="em-panel em-how">
              <div className="em-panel-title">HOW TO USE</div>
              <p className="em-how-text">Select a <strong>brush</strong> above, then click any state. Click again to cycle ratings: SAFE → LIKELY → LEAN → TILT. Use <strong>Tossup</strong> brush to reset. Picks auto-save locally.</p>
            </div>

          </div>
        </div>

        {/* ── BOTTOM BAR ── */}
        <div className="em-bottom">
          <span>PSI · Electoral Forecaster · 538 Total EV · 270 to Win</span>
          <span className="em-bottom-sub">Picks saved locally · Share via URL</span>
        </div>

      </div>

      {/* TOOLTIP */}
      {tooltip.visible && (
        <div className={`em-tooltip${dm ? "" : " em-tooltip-light"}`} style={{ left:tooltip.x+16, top:tooltip.y+16 }}>
          <div className="em-tt-name">{tooltip.name} <span className="em-tt-abbr">({tooltip.abbr})</span></div>
          <div className="em-tt-ev">{tooltip.ev} Electoral Vote{tooltip.ev !== 1 ? "s" : ""}</div>
          <div className="em-tt-div" />
          <div className="em-tt-pick" style={{ color:labelColorFor(tooltip.pick, dm) }}>{labelFor(tooltip.pick)}</div>
          <div className="em-tt-hint">{tooltip.hint}</div>
        </div>
      )}
    </>
  );
}

// ─── CSS factory ──────────────────────────────────────────────────────────────
function buildCSS(dm: boolean): string {
  const bg        = dm ? "#0a0a0a" : "#f0ede8";
  const bg2       = dm ? "#111"    : "#e8e4de";
  const bg3       = dm ? "#0d0d0d" : "#ebe7e0";
  const border1   = dm ? "#1e1e1e" : "#d4cfc8";
  const border2   = dm ? "#161616" : "#cbc6be";
  const text      = dm ? "#fff"    : "#111";
  const textSub   = dm ? "rgba(255,255,255,.18)"  : "rgba(0,0,0,.35)";
  const textMuted = dm ? "rgba(255,255,255,.22)"  : "rgba(0,0,0,.35)";
  const textFaint = dm ? "rgba(255,255,255,.25)"  : "rgba(0,0,0,.25)";
  const panelBg   = dm ? "#0a0a0a" : "#e4e0d8";
  const btnBorder = dm ? "#2a2a2a" : "#b8b3aa";
  const btnText   = dm ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.5)";
  const btnHover  = dm ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)";
  const brushGrp  = dm ? "#252525" : "#c4bfb8";
  const brushBtn  = dm ? "#0a0a0a" : "#ddd9d2";
  const tossupChip = dm ? "#161616" : "#ddd9d2";
  const evBar     = dm ? "#1a1a1a" : "#ccc8c0";
  const scoreCard = dm ? "#0a0a0a" : "#ddd9d2";
  const scoreTrack = dm ? "#1a1a1a" : "#ccc8c0";

  return `
  html, body {
    margin: 0; padding: 0; height: 100%; overflow: hidden;
    background: ${bg};
  }

  .em-root {
    display: flex; flex-direction: column; height: 100vh; max-height: 100vh;
    overflow: hidden; background: ${bg}; color: ${text};
    font-family: 'DM Mono', 'Geist Mono', ui-monospace, monospace;
    position: relative; transition: background 0.2s, color 0.2s;
  }
  .em-root.em-fs { position: fixed; inset: 0; z-index: 9999; }

  .em-top {
    flex-shrink: 0; display: flex; align-items: center;
    justify-content: space-between; padding: 0 18px; height: 52px;
    background: ${bg2}; border-bottom: 1px solid ${border1}; gap: 12px;
  }
  .em-top-brand { display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .em-logo {
    font-size: 10px; font-weight: 700; letter-spacing: 0.22em; color: #c5a55a;
    border: 1px solid #c5a55a44; padding: 3px 7px; flex-shrink: 0;
  }
  .em-brand-text { display:flex; flex-direction:column; gap:1px; }
  .em-brand-main { font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${text}; }
  .em-brand-sub  { font-size:7.5px; letter-spacing:0.18em; text-transform:uppercase; color:${textFaint}; }

  .em-ev-center {
    display: flex; align-items: center; gap: 14px; flex: 1;
    max-width: 420px; justify-content: center;
  }
  .em-ev-side { display:flex; flex-direction:column; align-items:center; gap:1px; flex-shrink:0; }
  .em-ev-label { font-size:6.5px; letter-spacing:0.22em; text-transform:uppercase; color:${textFaint}; }
  .em-ev-num   { font-size:28px; font-weight:900; line-height:1; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; }
  .em-ev-middle { flex:1; display:flex; flex-direction:column; gap:3px; align-items:center; }
  .em-ev-bar {
    width: 100%; height: 5px; background: ${evBar}; display: flex;
    overflow: hidden; border: 1px solid ${border1};
  }
  .em-270-txt { font-size:6.5px; letter-spacing:0.18em; text-transform:uppercase; color:${textSub}; }

  .em-top-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
  .em-btn {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 8.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    border: 1px solid ${btnBorder}; background: transparent; color: ${btnText};
    padding: 5px 10px; cursor: pointer; transition: all 100ms;
  }
  .em-btn:hover { border-color:${dm?"#555":"#888"}; color:${dm?"rgba(255,255,255,.8)":"rgba(0,0,0,.8)"}; background:${btnHover}; }
  .em-btn-gold { border-color:#c5a55a44; color:#c5a55a; display:flex; align-items:center; gap:5px; }
  .em-btn-gold:hover { border-color:#c5a55a; background:rgba(197,165,90,.08); color:#d4b46a; }

  .em-win {
    flex-shrink: 0; padding: 5px 18px; border-bottom: 1px solid;
    text-align: center; font-weight: 700; font-size: 11px; letter-spacing: 0.2em;
  }

  .em-brush-bar {
    flex-shrink: 0; display: flex; align-items: center; padding: 0 18px;
    height: 36px; background: ${bg3}; border-bottom: 1px solid ${border2}; gap: 10px; overflow: hidden;
  }
  .em-brush-label { font-size:7.5px; letter-spacing:0.22em; text-transform:uppercase; color:${textFaint}; flex-shrink:0; }
  .em-brush-group { display:flex; border:1px solid ${brushGrp}; overflow:hidden; flex-shrink:0; }
  .em-brush-btn {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 8.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    border: none; border-right: 1px solid ${brushGrp}; background: ${brushBtn};
    color: ${dm ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.4)"}; padding: 6px 12px; cursor: pointer;
    transition: all 100ms; height: 26px;
  }
  .em-brush-btn:last-child { border-right:none; }
  .em-brush-btn:hover:not(.active) { background:${btnHover}; color:${dm?"rgba(255,255,255,.7)":"rgba(0,0,0,.7)"}; }
  .em-brush-hint { font-size:7.5px; letter-spacing:0.08em; color:${textMuted}; text-transform:uppercase; flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  .em-tossup-chip {
    display: inline-flex; align-items:center; padding: 3px 8px;
    border:1px solid ${btnBorder}; background:${tossupChip};
    font-size:8px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:${btnText}; flex-shrink:0;
  }

  .em-body {
    flex: 1; min-height: 0; display: grid;
    grid-template-columns: 1fr 210px; overflow: hidden;
  }
  @media(max-width: 860px) { .em-body { grid-template-columns: 1fr; } }

  .em-map-area {
    position: relative; display: flex; align-items: center; justify-content: center;
    background: ${bg}; border-right: 1px solid ${border2}; overflow: hidden; min-height: 0;
  }
  .em-svg { width: 100%; height: 100%; display: block; }

  .em-tiles {
    position: absolute; top: 8px; right: 8px;
    display: grid; grid-template-columns: repeat(2, 52px); gap: 2px;
  }
  .em-tile {
    display: flex; flex-direction:column; align-items:center; justify-content:center;
    padding: 3px 2px; border: 1px solid; cursor: pointer;
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 7px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase;
    transition: filter 120ms; line-height:1.2;
  }
  .em-tile:hover { filter:brightness(1.2) saturate(1.2); }
  .em-tile-lbl { font-size:7.5px; }
  .em-tile-ev  { font-size:7px; opacity:0.65; }

  .em-sidebar {
    background: ${bg3}; display: flex; flex-direction: column;
    overflow-y: auto; overflow-x: hidden; min-height: 0;
  }
  .em-panel { padding:12px 14px; border-bottom:1px solid ${border2}; }
  .em-panel-title { font-size:7px; font-weight:700; letter-spacing:0.28em; text-transform:uppercase; color:${textFaint}; margin-bottom:9px; }

  .em-legend { display:grid; grid-template-columns:1fr 1fr; gap:2px; }
  .em-chip { padding:3px 5px; font-size:7px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; text-align:center; }

  .em-score-card { padding:10px; border:1px solid ${border1}; background:${scoreCard}; margin-bottom:3px; }
  .em-score-party { font-size:7px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; color:${textFaint}; margin-bottom:3px; }
  .em-score-num   { font-size:34px; font-weight:900; line-height:1; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; }
  .em-score-track { height:3px; background:${scoreTrack}; margin-top:7px; overflow:hidden; }
  .em-score-need  { font-size:7.5px; letter-spacing:0.1em; text-transform:uppercase; margin-top:4px; }
  .em-score-tossup { text-align:center; padding:5px; font-size:7.5px; letter-spacing:0.16em; text-transform:uppercase; color:${textFaint}; }

  .em-how-text { font-size:8.5px; line-height:1.75; letter-spacing:0.04em; color:${textMuted}; margin:0; }
  .em-how-text strong { color:${dm?"rgba(255,255,255,.45)":"rgba(0,0,0,.6)"}; font-weight:700; }

  .em-bottom {
    flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
    padding: 0 18px; height: 28px; background: ${bg3}; border-top: 1px solid ${border2};
    font-size: 7px; letter-spacing: 0.14em; text-transform: uppercase; color: ${textSub};
  }
  .em-bottom-sub { color: ${textSub}; }

  .em-tooltip {
    position: fixed; pointer-events: none; z-index: 99999; width: 196px;
    background: #111; border: 1px solid #2e2e2e; padding: 11px 13px;
    box-shadow: 0 16px 40px rgba(0,0,0,.85);
  }
  .em-tooltip-light {
    background: #fff; border-color: #ccc;
    box-shadow: 0 16px 40px rgba(0,0,0,.2);
  }
  .em-tt-name { font-size:11.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; }
  .em-tooltip .em-tt-name { color: #fff; }
  .em-tooltip-light .em-tt-name { color: #111; }
  .em-tt-abbr { font-size:9.5px; }
  .em-tooltip .em-tt-abbr { color: rgba(255,255,255,.3); }
  .em-tooltip-light .em-tt-abbr { color: rgba(0,0,0,.4); }
  .em-tt-ev { font-size:7.5px; letter-spacing:0.14em; margin-top:3px; text-transform:uppercase; }
  .em-tooltip .em-tt-ev { color: rgba(255,255,255,.25); }
  .em-tooltip-light .em-tt-ev { color: rgba(0,0,0,.4); }
  .em-tt-div { height:1px; margin:7px 0; }
  .em-tooltip .em-tt-div { background: #222; }
  .em-tooltip-light .em-tt-div { background: #ddd; }
  .em-tt-pick { font-size:9.5px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; }
  .em-tt-hint { font-size:7.5px; letter-spacing:0.1em; margin-top:4px; text-transform:uppercase; }
  .em-tooltip .em-tt-hint { color: rgba(255,255,255,.22); }
  .em-tooltip-light .em-tt-hint { color: rgba(0,0,0,.35); }

  @media(prefers-reduced-motion:reduce) {
    .em-score-track div { transition:none !important; }
  }
`;
}