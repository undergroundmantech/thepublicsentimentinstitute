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

const TICKER_ITEMS = [
  {key:"TOSSUP",          val:"538 EV",          color:"rgba(255,255,255,.5)"},
  {key:"WIN THRESHOLD",   val:"270 EV",           color:"#a78bfa"},
  {key:"ELECTORAL VOTES", val:"538 TOTAL",        color:"rgba(255,255,255,.5)"},
  {key:"STATES",          val:"50 + DC",          color:"rgba(255,255,255,.5)"},
  {key:"SPLIT DISTRICTS", val:"ME · NE",          color:"rgba(255,255,255,.5)"},
  {key:"LAST UPDATED",    val:"LIVE",             color:"#4ade80"},
  {key:"VERSION",         val:"STREAMER EDITION", color:"#a78bfa"},
];

const STORAGE_KEY = "psi-electoral-map-picks-v1";
const TOTAL_EV    = 538;

// ─── helpers ──────────────────────────────────────────────────────────────────
// Exact fill colors per party + rating, sampled from the reference image
// D: SAFE=deep navy, LIKELY=medium cobalt, LEAN=medium-light blue, TILT=pale blue
// R: SAFE=deep crimson, LIKELY=medium red, LEAN=medium-light red, TILT=pale red
const DEM_FILLS: Record<Rating, string> = {
  SAFE:   "#1a3a8f",
  LIKELY: "#1e50b3",
  LEAN:   "#2d6fd4",
  TILT:   "#4d8ee8",
};
const REP_FILLS: Record<Rating, string> = {
  SAFE:   "#8b1a1a",
  LIKELY: "#b02020",
  LEAN:   "#cc3333",
  TILT:   "#e05555",
};
const DEM_STROKE = "#2d6fd4";
const REP_STROKE = "#cc3333";

function fillFor(p?: Pick) {
  if (!p || p === "T") return "rgba(255,255,255,0.055)";
  const [party, rating] = p.split("_") as ["D"|"R", Rating];
  return party === "D" ? DEM_FILLS[rating] : REP_FILLS[rating];
}
function strokeFor(p?: Pick) {
  if (!p || p === "T") return "rgba(255,255,255,0.15)";
  return p.startsWith("D_") ? DEM_STROKE : REP_STROKE;
}
function labelFor(p?: Pick) {
  if (!p || p === "T") return "TOSSUP";
  const [party, rating] = p.split("_") as ["D"|"R", Rating];
  return `${party === "D" ? "DEM" : "GOP"} · ${rating}`;
}
function colorFor(p?: Pick) {
  if (!p || p === "T") return "var(--muted2)";
  return p.startsWith("D_") ? "rgba(147,197,253,.9)" : "rgba(252,165,165,.9)";
}
function nextRating(cur: Rating): Rating {
  return RATINGS[(RATINGS.indexOf(cur) + 1) % RATINGS.length];
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
  const [shareLabel, setShareLabel] = useState("↗ Share Map");
  const [tooltip,    setTooltip]    = useState<TooltipState>({
    visible:false, x:0, y:0, abbr:"", name:"", ev:0, isAtLarge:false, pick:"T", hint:"",
  });

  const svgRef   = useRef<SVGSVGElement>(null);
  const brushRef = useRef<PartyBrush>("T");
  brushRef.current = brush;

  // localStorage
  useEffect(() => {
    try { const r = localStorage.getItem(STORAGE_KEY); if (r) setPicks(JSON.parse(r)); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(picks)); } catch {}
  }, [picks]);

  const applyPick = useCallback((key: string) => {
    setPicks(prev => applyBrush(prev, key, brushRef.current));
  }, []);

  // draw map once
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

          const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
          el.setAttribute("d", path(f) ?? "");
          el.setAttribute("data-key", key);
          el.setAttribute("data-abbr", abbr);
          el.style.cssText = `fill:${fillFor("T")};stroke:${strokeFor("T")};stroke-width:0.6;cursor:${clickable?"pointer":"default"};transition:filter 160ms ease;`;

          if (clickable) {
            el.addEventListener("click", () => applyPick(key));
            el.addEventListener("mouseover",  () => { el.style.filter = "brightness(1.35)"; });
            el.addEventListener("mouseout",   () => { el.style.filter = ""; });
          }
          el.addEventListener("mousemove", (ev: MouseEvent) => {
            const evCount = abbr === "ME" || abbr === "NE" ? (EV_SPLIT[key] ?? 0) : (EV_BY_STATE[abbr] ?? 0);
            setPicks(cur => {
              const p    = (cur[key] ?? "T") as Pick;
              const hint = brushRef.current === "T"
                ? "Click to set TOSSUP"
                : `Click: ${brushRef.current === "D" ? "DEM" : "GOP"} · cycles rating`;
              setTooltip({ visible:true, x:ev.clientX, y:ev.clientY, abbr, name:STATE_NAMES[abbr]??abbr, ev:evCount, isAtLarge:abbr==="ME"||abbr==="NE", pick:p, hint });
              return cur;
            });
          });
          el.addEventListener("mouseleave", () => setTooltip(t => ({ ...t, visible:false })));
          svg.appendChild(el);
        }

        // border mesh
        const be = document.createElementNS("http://www.w3.org/2000/svg", "path");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        be.setAttribute("d", path(border as any) ?? "");
        be.style.cssText = "fill:none;stroke:rgba(255,255,255,0.06);stroke-width:0.6;pointer-events:none;";
        svg.appendChild(be);
      } catch { /* network unavailable */ }
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync colors to picks
  useEffect(() => {
    svgRef.current?.querySelectorAll<SVGPathElement>("[data-key]").forEach(el => {
      const p = (picks[el.getAttribute("data-key")!] ?? "T") as Pick;
      el.style.fill   = fillFor(p);
      el.style.stroke = strokeFor(p);
    });
  }, [picks]);

  // totals
  const { d, r, t } = sumEV(picks);
  const pct = (n: number) => `${((n / TOTAL_EV) * 100).toFixed(2)}%`;

  const modeLabel: Record<PartyBrush, string> = {
    D: "RATING CYCLE (DEM)",
    R: "RATING CYCLE (GOP)",
    T: "NEUTRAL (TOSSUP)",
  };

  const handleShare = () => {
    const url = window.location.href.split("?")[0] + "?picks=" + encodeURIComponent(JSON.stringify(picks));
    navigator.clipboard?.writeText(url).catch(() => {});
    setShareLabel("✓ Copied!");
    setTimeout(() => setShareLabel("↗ Share Map"), 2000);
  };

  const setAllTossup = () => {
    const next: Record<string, Pick> = {};
    Object.keys(EV_BY_STATE).forEach(k => { next[k] = "T"; });
    Object.keys(EV_SPLIT).forEach(k   => { next[k] = "T"; });
    setPicks(next);
  };

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes em-ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes em-pulse  { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes em-count  { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:scale(1)} }

        .em-live-dot {
          display:inline-block; width:6px; height:6px; border-radius:50%; flex-shrink:0;
          background:var(--rep); box-shadow:0 0 8px rgba(230,57,70,.7);
          animation:em-pulse 1.8s ease-in-out infinite;
        }

        /* Layout */
        .em-page-hdr {
          display:flex; align-items:flex-end; justify-content:space-between;
          flex-wrap:wrap; gap:16px; padding-bottom:24px;
          border-bottom:1px solid var(--border); margin-bottom:0;
        }
        .em-eyebrow {
          display:flex; align-items:center; gap:10px;
          font-size:9px; font-weight:700; letter-spacing:.30em; text-transform:uppercase;
          color:var(--purple-soft); margin-bottom:10px;
        }
        .em-eyebrow::before { content:''; display:block; width:18px; height:1px; background:var(--purple-soft); opacity:.6; }
        .em-title { font-size:clamp(28px,3.5vw,52px); font-weight:900; text-transform:uppercase; letter-spacing:-.01em; line-height:.92; color:#fff; font-family:var(--font-display),ui-sans-serif,sans-serif; }
        .em-title em { font-style:normal; background:linear-gradient(100deg,var(--red2) 0%,var(--purple-soft) 50%,var(--blue2) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .em-sub { margin-top:8px; font-size:10px; letter-spacing:.10em; color:var(--muted2); line-height:1.6; }

        /* Main grid — maps + scoreboard */
        .em-grid {
          display:grid; grid-template-columns:1fr 300px;
          border:1px solid var(--border); border-top:none;
        }
        @media(max-width:1024px) { .em-grid { grid-template-columns:1fr; } }

        /* Map panel */
        .em-map-panel { display:flex; flex-direction:column; border-right:1px solid var(--border); }
        @media(max-width:1024px) { .em-map-panel { border-right:none; border-bottom:1px solid var(--border); } }

        .em-toolbar {
          padding:10px 14px; border-bottom:1px solid var(--border); background:var(--background2);
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;
        }
        .em-brush-grp { display:flex; align-items:center; gap:8px; }
        .em-brush-lbl { font-size:8px; font-weight:700; letter-spacing:.26em; text-transform:uppercase; color:var(--muted3); }
        .em-brush-bar { display:flex; border:1px solid var(--border); background:rgba(0,0,0,.4); padding:2px; gap:2px; }
        .em-brush-btn {
          padding:6px 14px; font-size:8.5px; font-weight:700; letter-spacing:.16em; text-transform:uppercase;
          border:1px solid transparent; background:transparent; color:var(--muted3);
          cursor:pointer; transition:all 120ms ease; font-family:var(--font-body),ui-monospace,monospace;
        }
        .em-brush-btn:hover { color:var(--foreground); background:rgba(255,255,255,.04); }
        .em-b-d { background:#1e40af !important; border-color:rgba(59,130,246,.5) !important; color:#fff !important; box-shadow:0 0 12px rgba(37,99,235,.4); }
        .em-b-r { background:#991b1b !important; border-color:rgba(239,68,68,.5)  !important; color:#fff !important; box-shadow:0 0 12px rgba(239,68,68,.4); }
        .em-b-t { background:rgba(255,255,255,.08) !important; border-color:rgba(255,255,255,.15) !important; color:#fff !important; }
        .em-mode { display:flex; align-items:center; gap:7px; font-size:7.5px; font-weight:700; letter-spacing:.20em; text-transform:uppercase; color:var(--muted3); }
        .em-mode-val { padding:5px 9px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--foreground); font-size:7.5px; letter-spacing:.14em; }

        .em-map-area { flex:1; padding:10px; display:flex; align-items:center; justify-content:center; min-height:280px; position:relative; }
        #em-svg { width:100%; height:auto; display:block; }

        /* Legend */
        .em-legend { padding:9px 14px; border-top:1px solid var(--border); background:var(--background2); display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
        .em-ll { font-size:7.5px; font-weight:700; letter-spacing:.24em; text-transform:uppercase; color:var(--muted3); margin-right:2px; }
        .em-chip { padding:3px 7px; border:1px solid; font-size:7px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
        .lcd4{border-color:#1a3a8f;background:#1a3a8f;color:rgba(255,255,255,.9)}
        .lcd3{border-color:#1e50b3;background:#1e50b3;color:rgba(255,255,255,.85)}
        .lcd2{border-color:#2d6fd4;background:#2d6fd4;color:rgba(255,255,255,.85)}
        .lcd1{border-color:#4d8ee8;background:#4d8ee8;color:rgba(255,255,255,.8)}
        .lct {border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(255,255,255,.5)}
        .lcr1{border-color:#e05555;background:#e05555;color:rgba(255,255,255,.8)}
        .lcr2{border-color:#cc3333;background:#cc3333;color:rgba(255,255,255,.85)}
        .lcr3{border-color:#b02020;background:#b02020;color:rgba(255,255,255,.85)}
        .lcr4{border-color:#8b1a1a;background:#8b1a1a;color:rgba(255,255,255,.9)}

        /* Tiles */
        .em-tiles { padding:10px 12px; border-top:1px solid var(--border); background:var(--background2); }
        .em-tiles-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
        .em-tiles-ttl { font-size:7.5px; font-weight:700; letter-spacing:.24em; text-transform:uppercase; color:var(--muted3); display:flex; align-items:center; gap:7px; }
        .em-tiles-ttl::before { content:''; width:12px; height:1px; background:var(--purple-soft); opacity:.5; }
        .em-tiles-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(58px,1fr)); gap:4px; }
        .em-tile {
          display:flex; flex-direction:column; align-items:center; padding:5px 3px;
          border:1px solid; cursor:pointer; font-family:var(--font-body),ui-monospace,monospace;
          font-size:7.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
          transition:filter 120ms ease; line-height:1;
        }
        .em-tile:hover { filter:brightness(1.2); }
        .em-tile-ev { font-size:6px; margin-top:3px; opacity:.6; font-weight:700; }
        .em-tiles-note { margin-top:7px; padding:6px 8px; border:1px solid var(--border); background:rgba(255,255,255,.02); font-size:7px; letter-spacing:.08em; line-height:1.6; color:var(--muted3); }
        .em-tiles-note strong { color:var(--foreground); }

        /* Scoreboard */
        .em-score { display:flex; flex-direction:column; overflow:hidden; }
        .em-score-hdr { padding:14px 16px 10px; border-bottom:1px solid var(--border); background:var(--background2); display:flex; align-items:flex-start; justify-content:space-between; }
        .em-score-eyebrow { font-size:7px; font-weight:700; letter-spacing:.28em; text-transform:uppercase; color:var(--muted3); }
        .em-score-270 { font-size:22px; font-weight:900; text-transform:uppercase; letter-spacing:-.01em; color:#fff; line-height:1; margin-top:3px; }
        .em-score-270 span { color:var(--purple-soft); }
        .em-live-badge { display:inline-flex; align-items:center; gap:5px; border:1px solid rgba(230,57,70,.25); background:rgba(230,57,70,.07); padding:4px 8px; font-size:7px; font-weight:700; letter-spacing:.24em; text-transform:uppercase; color:rgba(230,57,70,.9); }

        /* Win bar */
        .em-wb-sec { padding:10px 14px; border-bottom:1px solid var(--border); background:var(--background2); }
        .em-wb-lbl { font-size:6.5px; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:var(--muted3); margin-bottom:6px; display:flex; justify-content:space-between; }
        .em-wb-track { height:7px; background:rgba(255,255,255,.05); display:flex; overflow:hidden; position:relative; }
        .em-wb-d { height:100%; background:var(--dem); transition:width .6s cubic-bezier(.22,1,.36,1); }
        .em-wb-t { height:100%; background:rgba(255,255,255,.12); transition:width .6s cubic-bezier(.22,1,.36,1); }
        .em-wb-r { height:100%; background:var(--rep); transition:width .6s cubic-bezier(.22,1,.36,1); }
        .em-wb-line { position:absolute; top:0; bottom:0; left:calc(270/538*100%); width:1px; background:#fff; opacity:.5; }
        .em-wb-270  { position:absolute; top:-14px; left:calc(270/538*100%); transform:translateX(-50%); font-size:6px; font-weight:700; letter-spacing:.10em; color:rgba(255,255,255,.35); }

        /* EV cards */
        .em-score-body { padding:12px; display:flex; flex-direction:column; gap:10px; flex:1; overflow-y:auto; }
        .em-ev-card { border:1px solid var(--border); padding:10px 12px; background:rgba(0,0,0,.25); position:relative; overflow:hidden; }
        .em-ev-card::before { content:''; position:absolute; top:0; left:0; bottom:0; width:2px; }
        .em-evc-d::before { background:var(--dem); box-shadow:2px 0 8px rgba(37,99,235,.4); }
        .em-evc-r::before { background:var(--rep); box-shadow:2px 0 8px rgba(230,57,70,.4); }
        .em-evc-t::before { background:rgba(255,255,255,.18); }
        .em-ev-label { font-size:7.5px; font-weight:700; letter-spacing:.24em; text-transform:uppercase; }
        .em-evl-d { color:rgba(147,197,253,.8); }
        .em-evl-r { color:rgba(252,165,165,.8); }
        .em-evl-t { color:var(--muted2); }
        .em-ev-num  { font-size:30px; font-weight:900; letter-spacing:-.02em; color:#fff; line-height:1; animation:em-count .5s cubic-bezier(.22,1,.36,1) both; }
        .em-ev-unit { font-size:8px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.3); margin-left:3px; }
        .em-ev-track { margin-top:8px; height:3px; background:rgba(255,255,255,.06); position:relative; overflow:hidden; }
        .em-ev-fill  { position:absolute; top:0; left:0; bottom:0; transition:width .6s cubic-bezier(.22,1,.36,1); }
        .em-evf-d { background:var(--dem); box-shadow:0 0 8px rgba(37,99,235,.4); }
        .em-evf-r { background:var(--rep); box-shadow:0 0 8px rgba(230,57,70,.4); }
        .em-evf-t { background:rgba(255,255,255,.22); }
        .em-ev-status { margin-top:5px; text-align:right; font-size:7px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted3); }
        .em-ev-win    { color:rgba(74,222,128,.85); }

        /* How it works */
        .em-how { padding:10px 12px; background:rgba(255,255,255,.02); border:1px solid var(--border); }
        .em-how-ttl { font-size:7px; font-weight:700; letter-spacing:.24em; text-transform:uppercase; color:var(--muted3); margin-bottom:6px; }
        .em-how-body { font-size:8px; letter-spacing:.07em; color:var(--muted2); line-height:1.7; }
        .em-how-body strong { color:var(--foreground); }
        .em-chip-sm { display:inline-block; padding:1px 5px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.05); font-size:7px; font-weight:700; letter-spacing:.09em; margin:0 1px; }

        /* Ticker */
        .em-ticker { border-top:1px solid var(--border); background:var(--background2); overflow:hidden; padding:5px 0; position:relative; margin:0 -16px; }
        @media(min-width:640px) { .em-ticker { margin:0 -24px; } }
        @media(min-width:1024px){ .em-ticker { margin:0 -32px; } }
        .em-ticker::before,.em-ticker::after { content:''; position:absolute; top:0; bottom:0; width:60px; z-index:2; pointer-events:none; }
        .em-ticker::before { left:0;  background:linear-gradient(90deg,var(--background2),transparent); }
        .em-ticker::after  { right:0; background:linear-gradient(270deg,var(--background2),transparent); }
        .em-ticker-track { display:flex; animation:em-ticker 28s linear infinite; width:max-content; }
        .em-ticker-item  { display:inline-flex; align-items:center; gap:7px; padding:0 18px; white-space:nowrap; border-right:1px solid var(--border); }
        .em-tk-key { font-size:6.5px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:var(--muted3); }
        .em-tk-val { font-size:7px;   font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:#fff; }
        .em-tk-dot { width:4px; height:4px; border-radius:50%; flex-shrink:0; }

        /* Footer row */
        .em-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; padding-top:12px; }
        .em-footer-l { font-size:7.5px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:var(--muted3); }
        .em-footer-l strong { color:var(--purple-soft); }
        .em-footer-r { font-size:7px; letter-spacing:.12em; color:rgba(255,255,255,.18); }

        /* Tooltip */
        .em-tooltip {
          position:fixed; pointer-events:none; z-index:9999; width:240px;
          background:rgba(7,7,9,.94); border:1px solid rgba(124,58,237,.45);
          padding:10px 12px; backdrop-filter:blur(16px); box-shadow:0 20px 60px rgba(0,0,0,.8);
        }
        .em-tooltip::before { content:''; position:absolute; top:-1px; left:-1px; right:-1px; height:2px; background:linear-gradient(90deg,var(--red) 0%,var(--purple) 50%,var(--blue) 100%); }
        .em-tt-st   { font-size:7px;   font-weight:700; letter-spacing:.28em; text-transform:uppercase; color:var(--muted3); }
        .em-tt-name { font-size:11px;  font-weight:900; text-transform:uppercase; letter-spacing:.07em; color:#fff; margin-top:3px; }
        .em-tt-ev   { font-size:8px;   letter-spacing:.12em; color:var(--muted2); margin-top:3px; }
        .em-tt-div  { height:1px; background:var(--border); margin:6px 0; }
        .em-tt-pick { font-size:8px;   font-weight:700; letter-spacing:.18em; text-transform:uppercase; }
        .em-tt-hint { font-size:7.5px; letter-spacing:.09em; color:var(--muted3); margin-top:5px; }
      `}</style>

      {/* ── PAGE HEADER ── */}
      <div className="em-page-hdr">
        <div>
          <div className="em-eyebrow">ELECTION TOOLS · FORECASTER</div>
          <h1 className="em-title">Electoral<br /><em>Forecaster</em></h1>
          <p className="em-sub">Select a brush · Click states to cycle confidence ratings · ME/NE districts below</p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button className="psi-btn psi-btn-ghost" onClick={setAllTossup}>⬡ All Tossup</button>
          <button className="psi-btn psi-btn-ghost" onClick={() => setPicks({})}>✕ Clear</button>
          <button className="psi-btn psi-btn-primary" onClick={handleShare}>{shareLabel}</button>
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="em-grid">

        {/* MAP PANEL */}
        <div className="em-map-panel">

          <div className="em-toolbar">
            <div className="em-brush-grp">
              <span className="em-brush-lbl">Brush</span>
              <div className="em-brush-bar">
                {(["D","R","T"] as PartyBrush[]).map(b => (
                  <button key={b}
                    className={`em-brush-btn${brush===b ? b==="D"?" em-b-d":b==="R"?" em-b-r":" em-b-t" : ""}`}
                    onClick={() => setBrush(b)}
                  >
                    {b==="D"?"DEM":b==="R"?"GOP":"TOSSUP"}
                  </button>
                ))}
              </div>
            </div>
            <div className="em-mode">
              <span>Mode</span>
              <span className="em-mode-val">{modeLabel[brush]}</span>
            </div>
          </div>

          <div className="em-map-area">
            <svg ref={svgRef} id="em-svg" viewBox="0 0 960 600" />
          </div>

          <div className="em-legend">
            <span className="em-ll">Legend</span>
            {[["lcd4","D·SAFE"],["lcd3","D·LIKELY"],["lcd2","D·LEAN"],["lcd1","D·TILT"],["lct","TOSSUP"],["lcr1","R·TILT"],["lcr2","R·LEAN"],["lcr3","R·LIKELY"],["lcr4","R·SAFE"]].map(([cls,lbl])=>(
              <span key={cls} className={`em-chip ${cls}`}>{lbl}</span>
            ))}
          </div>

          <div className="em-tiles">
            <div className="em-tiles-hdr">
              <div className="em-tiles-ttl">Districts + Small States</div>
              <span style={{ fontSize:"7px", letterSpacing:".14em", color:"var(--purple-soft)", fontWeight:700 }}>CLICK TO TOGGLE</span>
            </div>
            <div className="em-tiles-grid">
              {SIDE_TILES.map(tile => {
                const p = (picks[tile.key] ?? "T") as Pick;
                return (
                  <button key={tile.key} className="em-tile" onClick={() => applyPick(tile.key)}
                    style={{ background:fillFor(p), borderColor:strokeFor(p), color:colorFor(p) }}
                  >
                    <span>{tile.label}</span>
                    <span className="em-tile-ev">{tile.ev} EV</span>
                  </button>
                );
              })}
            </div>
            <div className="em-tiles-note">
              Map shows <strong>ME-AL</strong> / <strong>NE-AL</strong> at-large color. Districts painted here individually.
            </div>
          </div>
        </div>

        {/* SCOREBOARD */}
        <div className="em-score">
          <div className="em-score-hdr">
            <div>
              <div className="em-score-eyebrow">◈ SCOREBOARD</div>
              <div className="em-score-270"><span>270</span> TO WIN</div>
            </div>
            <div className="em-live-badge"><div className="em-live-dot" />LIVE</div>
          </div>

          <div className="em-wb-sec">
            <div className="em-wb-lbl">
              <span style={{color:"rgba(147,197,253,.7)"}}>DEM · {d}</span>
              <span>538 EV</span>
              <span style={{color:"rgba(252,165,165,.7)"}}>{r} · GOP</span>
            </div>
            <div className="em-wb-track">
              <div className="em-wb-d" style={{width:pct(d)}} />
              <div className="em-wb-t" style={{width:pct(t)}} />
              <div className="em-wb-r" style={{width:pct(r)}} />
              <div className="em-wb-270">270</div>
              <div className="em-wb-line" />
            </div>
          </div>

          <div className="em-score-body">
            {/* DEM */}
            <div className="em-ev-card em-evc-d">
              <div className="em-ev-label em-evl-d">Democrat</div>
              <div style={{display:"flex",alignItems:"baseline",marginTop:5}}>
                <div className="em-ev-num">{d}</div><div className="em-ev-unit">EV</div>
              </div>
              <div className="em-ev-track"><div className="em-ev-fill em-evf-d" style={{width:pct(d)}} /></div>
              <div className={d>=270?"em-ev-status em-ev-win":"em-ev-status"}>
                {d>=270?"★ WINNER CONFIRMED":`Needs ${270-d} more`}
              </div>
            </div>

            {/* REP */}
            <div className="em-ev-card em-evc-r">
              <div className="em-ev-label em-evl-r">Republican</div>
              <div style={{display:"flex",alignItems:"baseline",marginTop:5}}>
                <div className="em-ev-num">{r}</div><div className="em-ev-unit">EV</div>
              </div>
              <div className="em-ev-track"><div className="em-ev-fill em-evf-r" style={{width:pct(r)}} /></div>
              <div className={r>=270?"em-ev-status em-ev-win":"em-ev-status"}>
                {r>=270?"★ WINNER CONFIRMED":`Needs ${270-r} more`}
              </div>
            </div>

            {/* TOSSUP */}
            <div className="em-ev-card em-evc-t">
              <div className="em-ev-label em-evl-t">Tossup / Uncalled</div>
              <div style={{display:"flex",alignItems:"baseline",marginTop:5}}>
                <div className="em-ev-num">{t}</div><div className="em-ev-unit">EV</div>
              </div>
              <div className="em-ev-track"><div className="em-ev-fill em-evf-t" style={{width:pct(t)}} /></div>
              <div className="em-ev-status">Remaining electoral votes</div>
            </div>

            <div className="em-how">
              <div className="em-how-ttl">◫ How It Works</div>
              <div className="em-how-body">
                Select <strong>DEM</strong> or <strong>GOP</strong> brush then click any state.
                Click again to cycle:&nbsp;
                <span className="em-chip-sm">SAFE</span>→
                <span className="em-chip-sm">LIKELY</span>→
                <span className="em-chip-sm">LEAN</span>→
                <span className="em-chip-sm">TILT</span>→
                <span className="em-chip-sm">SAFE</span>
                <br /><br />
                Use <strong>TOSSUP</strong> brush to instantly reset a state.
                Picks auto-save to localStorage.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TICKER ── */}
      <div className="em-ticker">
        <div className="em-ticker-track">
          {[...TICKER_ITEMS,...TICKER_ITEMS].map((item,i) => (
            <div key={i} className="em-ticker-item">
              <div className="em-tk-dot" style={{background:item.color}} />
              <span className="em-tk-key">{item.key}</span>
              <span className="em-tk-val">{item.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ROW ── */}
      <div className="em-footer">
        <div className="em-footer-l"><strong>PSI</strong> · Electoral Forecaster · Streamer Edition · Broadcast-ready</div>
        <div className="em-footer-r">SAVE KEY: {STORAGE_KEY} · 538 EV TOTAL</div>
      </div>

      {/* ── TOOLTIP ── */}
      {tooltip.visible && (
        <div className="em-tooltip" style={{left:tooltip.x+14, top:tooltip.y+14}}>
          <div className="em-tt-st">{tooltip.abbr}</div>
          <div className="em-tt-name">{tooltip.name}</div>
          <div className="em-tt-ev">EV: {tooltip.ev}{tooltip.isAtLarge?" (AT-LARGE)":""}</div>
          <div className="em-tt-div" />
          <div className="em-tt-pick" style={{color:colorFor(tooltip.pick)}}>{labelFor(tooltip.pick)}</div>
          <div className="em-tt-hint">{tooltip.hint}</div>
        </div>
      )}
    </>
  );
}