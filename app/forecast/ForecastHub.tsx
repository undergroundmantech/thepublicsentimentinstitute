"use client";

// The forecast front page: chamber odds, a map you can recolor six ways, the closest
// races, a single race's full picture down to its counties, and an election night
// simulator that draws one plausible night from the model's own uncertainty.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DEM, GOP, IND, RATING_BANDS,
  type Geo, type Model, type Office, type Race, type StateDetail, type CountiesPayload, type CountyRow,
  fmtPct, ratingFor, raceMarginColor, marginColor, oddsColor, indSide, sideColor, fmtRaceMargin,
  surname, isUncontested, OFFICE_LABEL, inkOn,
} from "./lib";

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const OSWALD = '"Oswald", "Barlow Condensed", system-ui, sans-serif';

type Pres24 = { c: Record<string, [number, number]>; s: Record<string, [number, number]> };
type View = "winner" | "rating" | "margin" | "chance" | "shift" | "turnout";
type CView = "winner" | "margin" | "bubbles" | "shift" | "turnout";

const VIEWS: { v: View; label: string; help: string }[] = [
  { v: "winner", label: "Winner", help: "Who the model expects to win each race." },
  { v: "rating", label: "Rating", help: "How safe each race is, from Tilt to Safe." },
  { v: "margin", label: "Margin", help: "The projected margin. Deeper color means a wider win." },
  { v: "chance", label: "Chance", help: "How often each side wins across 10,000 simulated elections." },
  { v: "shift", label: "Shift", help: "How far each race runs from the state's 2024 presidential result." },
  { v: "turnout", label: "Turnout", help: "Projected 2026 votes as a share of the 2024 presidential vote." },
];
const CVIEWS: { v: CView; label: string }[] = [
  { v: "winner", label: "Winner" }, { v: "margin", label: "Margin" }, { v: "bubbles", label: "Vote lead" },
  { v: "shift", label: "Shift from 2024" }, { v: "turnout", label: "Turnout" },
];
const CONTROL: Record<Office, number> = { senate: 51, house: 218, governor: 26 };
const CHAMBER_NAME: Record<Office, string> = { senate: "Senate", house: "House", governor: "Governors" };

// ── data ─────────────────────────────────────────────────────────────────────
const cache = new Map<string, unknown>();
function useJson<T>(url: string | null): T | null {
  const [d, setD] = useState<T | null>(() => (url && cache.has(url) ? (cache.get(url) as T) : null));
  useEffect(() => {
    if (!url) { setD(null); return; }
    if (cache.has(url)) { setD(cache.get(url) as T); return; }
    let dead = false;
    fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j) cache.set(url, j);
      if (!dead) setD(j as T);
    }).catch(() => {});
    return () => { dead = true; };
  }, [url]);
  return d;
}

// ── helpers ──────────────────────────────────────────────────────────────────
const commas = (n: number) => Math.round(n).toLocaleString("en-US");
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const sdOf = (r: Race) => Math.max(1.5, (r.est.p90 - r.est.p10) / 2.563);
function lerp(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, "0")).join("")}`;
}
// turnout: projected votes against 2024, a sequential scale that is neither party's color
const turnColor = (ratio: number) => lerp("#e9e2fb", "#3b1a8f", (ratio - 0.45) / 0.45);
function demWins(r: Race, m = r.est.margin) { return m < 0; }
function winnerColor(r: Race, m = r.est.margin) { return demWins(r, m) ? sideColor(r, "dem") : sideColor(r, "gop"); }
function favName(r: Race) { return surname(demWins(r) ? r.dem : r.gop); }
function chanceFav(r: Race) { return Math.max(r.est.prob, 1 - r.est.prob); }
function pathBox(d: string): [number, number, number, number] {
  const n = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < n.length; i += 2) {
    x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]);
  }
  return [x0, y0, x1, y1];
}
function gauss(rand: () => number) {
  const u = Math.max(1e-9, rand()), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useCountdown(targetIso: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const s = Math.max(0, Math.floor((Date.parse(targetIso) - now) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

function CountUp({ value, dp = 0, suffix = "" }: { value: number; dp?: number; suffix?: string }) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduceMotion()) { setV(value); from.current = value; return; }
    const a = from.current, t0 = performance.now(); let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3);
      setV(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{v.toFixed(dp)}{suffix}</>;
}

function Chips<T extends string>({ value, options, onChange, label, disabled }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string; disabled?: Set<T>;
}) {
  return (
    <div className="fh-chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? "on" : ""}
          disabled={disabled?.has(o.v)} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

// ── race colors by view ──────────────────────────────────────────────────────
function raceFill(r: Race, view: View, p24: Pres24 | null, simM?: number): string {
  const m = simM ?? r.est.margin;
  if (simM !== undefined) return winnerColor(r, m);
  switch (view) {
    case "winner": return winnerColor(r);
    case "rating": return ratingFor(m, indSide(r)).color;
    case "margin": return raceMarginColor(r, m);
    case "chance": return indSide(r) && r.est.prob < 0.5 ? lerp("#cdb9ea", "#40206b", (0.5 - r.est.prob) / 0.48) : oddsColor(r.est.prob);
    case "shift": {
      const base = baseline(r, p24);
      return base === null ? "var(--fh-idle)" : marginColor(clamp(m - base, -30, 30));
    }
    case "turnout": {
      const t = turnout(r, p24);
      return t === null ? "var(--fh-idle)" : turnColor(t);
    }
    default: return winnerColor(r);
  }
}
function baseline(r: Race, p24: Pres24 | null): number | null {
  if (r.office === "house") return Number.isFinite(r.pvi) ? r.pvi : null;
  const s = p24?.s[r.st];
  return s ? s[0] : null;
}
function turnout(r: Race, p24: Pres24 | null): number | null {
  if (r.office === "house" || !r.votes) return null;
  const s = p24?.s[r.st];
  return s && s[1] > 0 ? r.votes.total / s[1] : null;
}

// ── the chance gauge: 100 dots on a half dial ────────────────────────────────
function ChanceDial({ r }: { r: Race }) {
  const dDots = Math.round((1 - r.est.prob) * 100);
  const dots = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    const rows = [40, 34, 26];
    rows.forEach((n, ri) => {
      const rad = 96 - ri * 13;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (1 - (i + 0.5) / n);
        out.push({ x: 110 + rad * Math.cos(a), y: 104 - rad * Math.sin(a) });
      }
    });
    return out.sort((a, b) => a.x - b.x);
  }, []);
  const dc = sideColor(r, "dem"), rc = sideColor(r, "gop");
  const fav = r.est.prob >= 0.5 ? "gop" : "dem";
  const favP = chanceFav(r);
  return (
    <div className="fh-dial">
      <svg viewBox="0 0 220 116" role="img" aria-label={`${surname(fav === "dem" ? r.dem : r.gop)} wins ${fmtPct(favP)} of simulations`}>
        {dots.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4.1} fill={i < dDots ? dc : rc} className="fh-dot" style={{ animationDelay: `${i * 6}ms` }} />
        ))}
        <text x="110" y="94" textAnchor="middle" className="fh-dial-n" fill={fav === "dem" ? dc : rc}>{fmtPct(favP)}</text>
        <text x="110" y="110" textAnchor="middle" className="fh-dial-l">{surname(fav === "dem" ? r.dem : r.gop).toUpperCase()}</text>
      </svg>
      <p className="fh-dial-cap">
        Out of 100 simulated elections, <b style={{ color: dc }}>{surname(r.dem)}</b> wins about <b>{dDots}</b> and{" "}
        <b style={{ color: rc }}>{surname(r.gop)}</b> about <b>{100 - dDots}</b>.
      </p>
    </div>
  );
}

// ── the margin histogram from the race's own simulations ─────────────────────
function MarginHist({ r }: { r: Race }) {
  const d = r.est.dist;
  if (!d || !d.c.length) return null;
  const W = 300, H = 92, max = Math.max(...d.c);
  const lo = d.lo, hi = d.lo + d.w * d.c.length;
  const x = (m: number) => ((m - lo) / (hi - lo)) * W;
  return (
    <figure className="fh-hist">
      <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="Distribution of simulated margins">
        {d.c.map((c, i) => {
          const m = lo + (i + 0.5) * d.w;
          const h = (c / max) * H;
          return <rect key={i} x={x(lo + i * d.w) + 0.5} y={H - h} width={Math.max(1, (d.w / (hi - lo)) * W - 1)} height={h}
            fill={m < 0 ? sideColor(r, "dem") : sideColor(r, "gop")} opacity={0.85} rx={1} />;
        })}
        {lo < 0 && hi > 0 ? <line x1={x(0)} x2={x(0)} y1={0} y2={H} className="fh-hist-zero" /> : null}
        <text x={x(Math.max(lo, Math.min(hi, 0)))} y={H + 14} textAnchor="middle" className="fh-hist-l">even</text>
        <text x={4} y={H + 14} className="fh-hist-l">{fmtRaceMargin(r, lo)}</text>
        <text x={W - 4} y={H + 14} textAnchor="end" className="fh-hist-l">{fmtRaceMargin(r, hi)}</text>
      </svg>
      <figcaption>Every bar is a slice of the 10,000 simulated margins. The middle 80 percent runs from{" "}
        <b>{fmtRaceMargin(r, r.est.p10)}</b> to <b>{fmtRaceMargin(r, r.est.p90)}</b>.</figcaption>
    </figure>
  );
}

// ── one state's counties for a statewide race ────────────────────────────────
function CountyMap({ r, detail, rows, names, p24 }: {
  r: Race; detail: StateDetail; rows: Record<string, CountyRow>; names: Record<string, string>; p24: Pres24 | null;
}) {
  const [cv, setCv] = useState<CView>("winner");
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  const shapes = useMemo(() => detail.counties.map((c) => ({ ...c, b: pathBox(c.d) })), [detail]);
  const box = useMemo(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    shapes.forEach(({ b }) => { x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); });
    return [x0, y0, x1 - x0, y1 - y0];
  }, [shapes]);
  const maxLead = useMemo(() => Math.max(1, ...Object.values(rows).map((v) => Math.abs(v[2] - v[1]))), [rows]);
  const fill = (id: string) => {
    const v = rows[id];
    if (!v) return "var(--fh-idle)";
    const m = v[0];
    if (cv === "winner") return winnerColor(r, m);
    if (cv === "margin") return raceMarginColor(r, m);
    if (cv === "bubbles") return "var(--fh-land)";
    const base = p24?.c[id];
    if (!base) return "var(--fh-idle)";
    if (cv === "shift") return marginColor(clamp(m - base[0], -30, 30));
    return turnColor(v[3] / base[1]);
  };
  const t = tip ? rows[tip.id] : null;
  const tb = tip ? p24?.c[tip.id] : null;
  const pad = Math.max(box[2], box[3]) * 0.03;
  return (
    <div className="fh-cmap" ref={wrap}>
      <div className="fh-cmap-head">
        <span className="fh-eyebrow">county by county</span>
        <Chips label="County map view" value={cv} options={CVIEWS} onChange={setCv} />
      </div>
      <svg viewBox={`${box[0] - pad} ${box[1] - pad} ${box[2] + 2 * pad} ${box[3] + 2 * pad}`} role="img"
        aria-label={`${r.name} projected result by county`} onMouseLeave={() => setTip(null)}>
        {shapes.map((c) => (
          <path key={c.id} d={c.d} fill={fill(c.id)} className={`fh-county ${tip?.id === c.id ? "hot" : ""}`}
            onMouseMove={(e) => {
              const rc = wrap.current?.getBoundingClientRect();
              if (rc) setTip({ id: c.id, x: e.clientX - rc.left, y: e.clientY - rc.top });
            }} />
        ))}
        {cv === "bubbles" ? shapes.map((c) => {
          const v = rows[c.id];
          if (!v) return null;
          const lead = Math.abs(v[2] - v[1]);
          const rad = Math.sqrt(lead / maxLead) * Math.max(box[2], box[3]) * 0.075;
          return <circle key={`b${c.id}`} cx={(c.b[0] + c.b[2]) / 2} cy={(c.b[1] + c.b[3]) / 2} r={Math.max(0.6, rad)}
            fill={winnerColor(r, v[0])} className="fh-bubble" />;
        }) : null}
      </svg>
      <CountyLegend cv={cv} r={r} />
      {tip && t ? (
        <div className="fh-tip" style={{ left: tip.x, top: tip.y }}>
          <b>{names[tip.id] ?? tip.id}</b>
          <span>{fmtRaceMargin(r, t[0])} <em>projected</em></span>
          <span>{surname(r.dem)} {commas(t[1])} <em>·</em> {surname(r.gop)} {commas(t[2])}</span>
          {tb ? <span>2024: {tb[0] > 0 ? "R" : "D"}+{Math.abs(tb[0]).toFixed(1)} <em>·</em> shift {t[0] - tb[0] > 0 ? "R" : "D"}+{Math.abs(t[0] - tb[0]).toFixed(1)}</span> : null}
          {tb ? <span>turnout {Math.round((t[3] / tb[1]) * 100)}% of 2024</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function CountyLegend({ cv, r }: { cv: CView; r: Race }) {
  if (cv === "winner" || cv === "bubbles") return (
    <div className="fh-legend">
      <span><i style={{ background: sideColor(r, "dem") }} />{surname(r.dem)} {cv === "bubbles" ? "vote lead" : "ahead"}</span>
      <span><i style={{ background: sideColor(r, "gop") }} />{surname(r.gop)} {cv === "bubbles" ? "vote lead" : "ahead"}</span>
      {cv === "bubbles" ? <span className="fh-legend-note">circle size is the projected vote lead</span> : null}
    </div>
  );
  if (cv === "turnout") return <TurnLegend />;
  return <MarginLegend label={cv === "shift" ? "shift from the 2024 presidential margin" : "projected margin"} />;
}
function MarginLegend({ label }: { label: string }) {
  const stops = [-24, -12, -6, -2, 2, 6, 12, 24];
  return (
    <div className="fh-legend">
      <span className="fh-ramp">{stops.map((s) => <i key={s} style={{ background: marginColor(s) }} />)}</span>
      <span className="fh-legend-note">D+24 · even · R+24 · {label}</span>
    </div>
  );
}
function TurnLegend() {
  return (
    <div className="fh-legend">
      <span className="fh-ramp">{[0.45, 0.55, 0.65, 0.75, 0.85].map((s) => <i key={s} style={{ background: turnColor(s) }} />)}</span>
      <span className="fh-legend-note">45% · 90% of the 2024 presidential vote</span>
    </div>
  );
}
function MapLegend({ view, office }: { view: View; office: Office }) {
  if (view === "winner") return (
    <div className="fh-legend">
      <span><i style={{ background: DEM }} />Democrat</span><span><i style={{ background: GOP }} />Republican</span>
      <span><i style={{ background: IND }} />Independent</span>
    </div>
  );
  if (view === "rating") return (
    <div className="fh-legend">{[...RATING_BANDS].reverse().map((b) => <span key={b.cat}><i style={{ background: b.color }} />{b.cat}</span>)}</div>
  );
  if (view === "chance") return (
    <div className="fh-legend">
      <span className="fh-ramp">{[0.02, 0.15, 0.3, 0.45, 0.55, 0.7, 0.85, 0.98].map((p) => <i key={p} style={{ background: oddsColor(p) }} />)}</span>
      <span className="fh-legend-note">certain D · coin flip · certain R</span>
    </div>
  );
  if (view === "turnout") return <TurnLegend />;
  if (view === "shift") return <MarginLegend label={office === "house" ? "against the district's partisan lean" : "against the 2024 presidential margin"} />;
  return <MarginLegend label="projected margin" />;
}

// ── the page ─────────────────────────────────────────────────────────────────
export default function ForecastHub() {
  const model = useJson<Model>("/forecast/model.json");
  const geo = useJson<Geo>("/forecast/geo.json");
  const p24 = useJson<Pres24>("/forecast/pres24.json");
  const [office, setOffice] = useState<Office>("senate");
  const [view, setView] = useState<View>("winner");
  const [selId, setSelId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [night, setNight] = useState<{ m: Record<string, number>; order: string[]; shown: number; nat: number } | null>(null);
  const [tally, setTally] = useState<{ runs: number; dem: number }>({ runs: 0, dem: 0 });
  const mapWrap = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clock = useCountdown("2026-11-04T00:00:00Z");

  const races = useMemo(() => (model ? model.races.filter((r) => r.office === office && !isUncontested(r)) : []), [model, office]);
  const allOffice = useMemo(() => (model ? model.races.filter((r) => r.office === office) : []), [model, office]);
  const byId = useMemo(() => new Map(model ? model.races.map((r) => [r.id, r]) : []), [model]);
  const sel = selId ? byId.get(selId) ?? null : null;
  const detail = useJson<StateDetail>(sel && sel.office !== "house" ? `/forecast/states/${sel.st}.json` : null);
  const counties = useJson<CountiesPayload>(sel && sel.office !== "house" ? "/forecast/counties.json" : null);

  useEffect(() => { setSelId(null); stopNight(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [office]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => { if (office === "house" && view === "turnout") setView("winner"); }, [office, view]);

  const closest = useMemo(() => [...races].sort((a, b) => Math.abs(a.est.margin) - Math.abs(b.est.margin)).slice(0, 8), [races]);

  // the race that decides control: line up every seat from most Democratic to most Republican
  const tipping = useMemo(() => {
    if (!model) return null;
    const notUp = office === "senate" ? model.meta.senNotUpD : office === "governor" ? model.meta.govNotUpD : 0;
    const need = CONTROL[office] - notUp;
    const sorted = [...allOffice].sort((a, b) => a.est.margin - b.est.margin);
    return need >= 1 && need <= sorted.length ? sorted[need - 1] : null;
  }, [model, allOffice, office]);

  function stopNight() { if (timer.current) clearInterval(timer.current); timer.current = null; setNight(null); }

  function runNight() {
    if (!model || !geo) return;
    if (timer.current) clearInterval(timer.current);
    const rand = Math.random;
    const natSd = 2.3;
    const nat = gauss(rand) * natSd;
    const m: Record<string, number> = {};
    for (const r of allOffice) {
      if (isUncontested(r)) { m[r.id] = r.est.margin; continue; }
      const sd = sdOf(r), shared = natSd * (r.elast || 1);
      const own = Math.sqrt(Math.max(1, sd * sd - shared * shared));
      m[r.id] = r.est.margin + (r.elast || 1) * nat + own * gauss(rand);
    }
    // results come in east to west, the way polls close
    const xOf = (r: Race) => {
      const b = r.office === "house" ? geo.districts[r.id]?.box : geo.box[r.st];
      return b ? b[0] : 500;
    };
    const order = [...allOffice].sort((a, b) => xOf(b) - xOf(a)).map((r) => r.id);
    const notUpD = office === "senate" ? model.meta.senNotUpD : office === "governor" ? model.meta.govNotUpD : 0;
    const demSeats = notUpD + allOffice.filter((r) => m[r.id] < 0).length;
    setTally((t) => ({ runs: t.runs + 1, dem: t.dem + (demSeats >= CONTROL[office] ? 1 : 0) }));
    if (reduceMotion()) { setNight({ m, order, shown: order.length, nat }); return; }
    setNight({ m, order, shown: 0, nat });
    const step = Math.max(1, Math.ceil(order.length / 40));
    timer.current = setInterval(() => {
      setNight((n) => {
        if (!n) return n;
        const shown = Math.min(n.order.length, n.shown + step);
        if (shown >= n.order.length && timer.current) { clearInterval(timer.current); timer.current = null; }
        return { ...n, shown };
      });
    }, 60);
  }

  if (!model || !geo) return <div className="fh"><style>{CSS}</style><div className="fh-loading">Loading the forecast…</div></div>;

  const [W, H] = geo.frame;
  const revealed = night ? new Set(night.order.slice(0, night.shown)) : null;
  const notUpD = office === "senate" ? model.meta.senNotUpD : office === "governor" ? model.meta.govNotUpD : 0;
  const notUpR = office === "senate" ? model.meta.senNotUpR : office === "governor" ? model.meta.govNotUpR : 0;
  const nightD = night ? notUpD + allOffice.filter((r) => revealed!.has(r.id) && night.m[r.id] < 0).length : 0;
  const nightR = night ? notUpR + allOffice.filter((r) => revealed!.has(r.id) && night.m[r.id] >= 0).length : 0;
  const nightDone = night && night.shown >= night.order.length;
  const upsets = night ? allOffice.filter((r) => revealed!.has(r.id) && !isUncontested(r) && (night.m[r.id] < 0) !== (r.est.margin < 0)) : [];
  const byState = new Map<string, Race>();
  if (office !== "house") for (const r of [...allOffice].sort((a, b) => b.id.length - a.id.length)) byState.set(r.st, r);
  const hv = hover ? byId.get(hover.id) : null;
  const pick = (id: string) => { setSelId(id); setHover(null); requestAnimationFrame(() => mapWrap.current?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const disabledViews = office === "house" ? new Set<View>(["turnout"]) : undefined;

  return (
    <div className="fh">
      <style>{CSS}</style>
      <div className="fh-glow" aria-hidden />

      {/* ── hero ── */}
      <header className="fh-hero">
        <div className="fh-hero-l">
          <span className="fh-eyebrow"><i className="fh-pip" /> TPSI 2026 forecast · updated {new Date(model.meta.updated + "T14:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}</span>
          <h1>Who wins the <span className="fh-grad">2026 midterms?</span></h1>
          <p className="fh-lede">Every Senate, governor and House race, simulated 10,000 times from the polls, the fundamentals and TPSI&apos;s own voter file. Pick a chamber, recolor the map, or run election night yourself.</p>
        </div>
        {clock ? (
          <div className="fh-clock" aria-label="Time until the first polls close">
            {([["days", clock.d], ["hrs", clock.h], ["min", clock.m], ["sec", clock.s]] as [string, number][]).map(([l, v]) => (
              <div key={l}><b>{String(v).padStart(2, "0")}</b><span>{l}</span></div>
            ))}
            <em>until the first polls close, Nov 3</em>
          </div>
        ) : null}
      </header>

      {/* ── chamber cards ── */}
      <section className="fh-chambers">
        {(["senate", "house", "governor"] as Office[]).map((o) => {
          const c = model.chambers[o];
          const dem = c.demControl;
          const fav = dem >= 0.5 ? "dem" : "gop";
          const p = Math.max(dem, 1 - dem);
          const dSeats = Math.round(c.median ?? c.demSeats);
          const total = c.seatsTotal;
          return (
            <button key={o} className={`fh-card fh-ch ${office === o ? "on" : ""} ${fav}`} onClick={() => setOffice(o)}>
              <span className="fh-ch-k">{CHAMBER_NAME[o]} <em>{CONTROL[o]} for control</em></span>
              <span className="fh-ch-p" style={{ color: fav === "dem" ? DEM : GOP }}><CountUp value={p * 100} /><small>%</small></span>
              <span className="fh-ch-w">chance <b>{fav === "dem" ? "Democrats" : "Republicans"}</b> {o === "governor" ? "hold most governorships" : `control the ${CHAMBER_NAME[o]}`}</span>
              <span className="fh-seatbar" aria-hidden>
                <i style={{ width: `${(dSeats / total) * 100}%`, background: DEM }} />
                <i style={{ width: `${((total - dSeats) / total) * 100}%`, background: GOP }} />
                <b style={{ left: `${(CONTROL[o] / total) * 100}%` }} />
              </span>
              <span className="fh-ch-s"><span style={{ color: DEM }}>D {dSeats}</span><em>likeliest outcome · 80% range D {c.demP10} to {c.demP90}</em><span style={{ color: GOP }}>{total - dSeats} R</span></span>
            </button>
          );
        })}
      </section>

      {/* ── closest races ── */}
      <section className="fh-sec">
        <div className="fh-sec-h">
          <h2>The closest {OFFICE_LABEL[office] === "Governors" ? "governor" : OFFICE_LABEL[office]} races</h2>
          {tipping ? <p className="fh-tp">Tipping point: <button onClick={() => pick(tipping.id)}>{tipping.name}</button>, the seat that would hand {CHAMBER_NAME[office] === "Governors" ? "the majority of governorships" : `the ${CHAMBER_NAME[office]}`} to whoever wins it, now <b style={{ color: winnerColor(tipping) }}>{fmtRaceMargin(tipping, tipping.est.margin)}</b>.</p> : null}
        </div>
        <div className="fh-close">
          {closest.map((r, i) => {
            const fc = winnerColor(r);
            return (
              <button key={r.id} className="fh-card fh-cl" style={{ "--c": fc, animationDelay: `${i * 50}ms` } as React.CSSProperties} onClick={() => pick(r.id)}>
                <span className="fh-cl-top"><b>{r.name.replace(/ Senate| Governor/, "")}</b><em style={{ background: ratingFor(r.est.margin, indSide(r)).color, color: inkOn(ratingFor(r.est.margin, indSide(r)).color) }}>{ratingFor(r.est.margin, indSide(r)).cat}</em></span>
                <span className="fh-cl-m" style={{ color: fc }}>{fmtRaceMargin(r, r.est.margin)}</span>
                <span className="fh-cl-n">{surname(r.dem)} <em>vs</em> {surname(r.gop)}</span>
                <span className="fh-cl-bar"><i style={{ width: `${(1 - r.est.prob) * 100}%`, background: sideColor(r, "dem") }} /><i style={{ width: `${r.est.prob * 100}%`, background: sideColor(r, "gop") }} /></span>
                <span className="fh-cl-p">{favName(r)} wins {fmtPct(chanceFav(r))}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── the map lab ── */}
      <section className="fh-sec" ref={mapWrap}>
        <div className="fh-lab-h">
          <Chips label="Chamber" value={office} onChange={(v) => setOffice(v)} options={[
            { v: "senate", label: "Senate" }, { v: "house", label: "House" }, { v: "governor", label: "Governors" }]} />
          {!night ? <Chips label="Map view" value={view} options={VIEWS} onChange={setView} disabled={disabledViews} /> : null}
          <div className="fh-sim-ctl">
            <button className="fh-btn" onClick={runNight}>{night ? "Run another night" : "Simulate election night"}</button>
            {night ? <button className="fh-btn ghost" onClick={stopNight}>Back to the forecast</button> : null}
          </div>
        </div>
        <p className="fh-help">{night
          ? `One simulated night, drawn from the model's uncertainty. The whole country moved ${night.nat < 0 ? "D" : "R"}+${Math.abs(night.nat).toFixed(1)} from the forecast, and every race moved on its own too.`
          : VIEWS.find((x) => x.v === view)!.help}</p>

        <div className={`fh-lab ${sel ? "with" : ""}`}>
          <div className="fh-mapbox">
            {night ? (
              <div className="fh-night">
                <div className="fh-night-n"><span style={{ color: DEM }}><CountUp value={nightD} /></span><em>{nightDone ? "final" : `${Math.round((night.shown / night.order.length) * 100)}% in`}</em><span style={{ color: GOP }}><CountUp value={nightR} /></span></div>
                <div className="fh-night-t">{nightDone
                  ? (nightD >= CONTROL[office] ? <><b style={{ color: DEM }}>Democrats</b> win {office === "governor" ? "most governorships" : `the ${CHAMBER_NAME[office]}`}</> : <><b style={{ color: GOP }}>Republicans</b> {office === "governor" ? "hold most governorships" : `hold the ${CHAMBER_NAME[office]}`}</>)
                  : "counting…"}{upsets.length ? ` · ${upsets.length} upset${upsets.length > 1 ? "s" : ""}` : ""}</div>
                {tally.runs > 1 ? <div className="fh-night-s">Your nights so far: Democrats won {tally.dem} of {tally.runs}. The model&apos;s 10,000 say {fmtPct(model.chambers[office].demControl)}.</div> : null}
              </div>
            ) : null}
            <svg className="fh-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${CHAMBER_NAME[office]} forecast map`} onMouseLeave={() => setHover(null)}>
              {office !== "house" ? Object.entries(geo.states).map(([st, d]) => {
                const r = byState.get(st);
                const simM = night && r ? (revealed!.has(r.id) ? night.m[r.id] : undefined) : undefined;
                const pending = night && r && simM === undefined;
                const up = night && r && simM !== undefined && !isUncontested(r) && (simM < 0) !== (r.est.margin < 0);
                return (
                  <path key={st} d={d} className={`fh-st ${r ? "live" : ""} ${selId && r?.id === selId ? "sel" : ""} ${up ? "upset" : ""}`}
                    fill={!r ? "var(--fh-idle)" : pending ? "var(--fh-pending)" : raceFill(r, view, p24, simM)}
                    onMouseMove={r ? (e) => setHover({ id: r.id, x: e.clientX, y: e.clientY }) : undefined}
                    onClick={r ? () => pick(r.id) : undefined} />
                );
              }) : Object.entries(geo.districts).map(([id, g]) => {
                const r = byId.get(id);
                if (!g.d || !r) return null;
                const simM = night ? (revealed!.has(id) ? night.m[id] : undefined) : undefined;
                const pending = night && simM === undefined;
                const up = night && simM !== undefined && !isUncontested(r) && (simM < 0) !== (r.est.margin < 0);
                return (
                  <path key={id} d={g.d} className={`fh-st live dist ${selId === id ? "sel" : ""} ${up ? "upset" : ""}`}
                    fill={pending ? "var(--fh-pending)" : raceFill(r, view, p24, simM)}
                    onMouseMove={(e) => setHover({ id, x: e.clientX, y: e.clientY })} onClick={() => pick(id)} />
                );
              })}
              {office !== "house" ? Object.entries(geo.states).map(([st, d]) => <path key={`o${st}`} d={d} className="fh-st-line" />) : null}
            </svg>
            {!night ? <MapLegend view={view} office={office} /> : <div className="fh-legend"><span><i style={{ background: DEM }} />Democrat wins</span><span><i style={{ background: GOP }} />Republican wins</span><span><i className="fh-upset-key" />upset against the forecast</span></div>}
            {hv && hover ? (
              <div className="fh-tip fixed" style={{ left: hover.x, top: hover.y }}>
                <b>{hv.name}</b>
                {night && revealed?.has(hv.id) ? <span>tonight: <b style={{ color: winnerColor(hv, night.m[hv.id]) }}>{fmtRaceMargin(hv, night.m[hv.id])}</b> <em>· forecast {fmtRaceMargin(hv, hv.est.margin)}</em></span>
                  : <span><b style={{ color: winnerColor(hv) }}>{fmtRaceMargin(hv, hv.est.margin)}</b> <em>·</em> {favName(hv)} {fmtPct(chanceFav(hv))}</span>}
                <span>{surname(hv.dem)} <em>vs</em> {surname(hv.gop)}</span>
                {view === "shift" && !night && baseline(hv, p24) !== null ? <span>shift {(hv.est.margin - baseline(hv, p24)!) > 0 ? "R" : "D"}+{Math.abs(hv.est.margin - baseline(hv, p24)!).toFixed(1)} from {hv.office === "house" ? "partisan lean" : "2024"}</span> : null}
                {view === "turnout" && !night && turnout(hv, p24) !== null ? <span>{commas(hv.votes!.total)} votes, {Math.round(turnout(hv, p24)! * 100)}% of 2024</span> : null}
                <span className="fh-tip-cta">click for the full race</span>
              </div>
            ) : null}
          </div>

          {sel ? <RacePanel r={sel} onClose={() => setSelId(null)} detail={detail} counties={counties} p24={p24} nightM={night && revealed?.has(sel.id) ? night.m[sel.id] : undefined} /> : null}
        </div>
      </section>
    </div>
  );
}

function RacePanel({ r, onClose, detail, counties, p24, nightM }: {
  r: Race; onClose: () => void; detail: StateDetail | null; counties: CountiesPayload | null; p24: Pres24 | null; nightM?: number;
}) {
  const band = ratingFor(r.est.margin, indSide(r));
  const cands = (r.cands && r.cands.length ? r.cands : [
    { name: r.dem, party: "D", pct: NaN, votes: NaN }, { name: r.gop, party: "R", pct: NaN, votes: NaN },
  ]).slice(0, 4);
  const rows = counties ? (counties[r.id] as Record<string, CountyRow> | undefined) : undefined;
  const names = (counties?._n ?? {}) as Record<string, string>;
  const pD = 1 - r.est.prob;
  return (
    <aside className="fh-card fh-panel" aria-label={`${r.name} details`}>
      <div className="fh-panel-h">
        <div>
          <span className="fh-eyebrow">{r.office === "house" ? `District ${r.district}` : r.office === "senate" ? "Senate" : "Governor"} · {r.open ? "open seat" : "incumbent running"}</span>
          <h3>{r.name}</h3>
        </div>
        <button className="fh-x" onClick={onClose} aria-label="Close race">×</button>
      </div>
      <div className="fh-panel-rate">
        <em style={{ background: band.color, color: inkOn(band.color) }}>{band.cat}</em>
        <b style={{ color: winnerColor(r) }}>{fmtRaceMargin(r, r.est.margin)}</b>
        {nightM !== undefined ? <span>tonight <b style={{ color: winnerColor(r, nightM) }}>{fmtRaceMargin(r, nightM)}</b></span> : null}
      </div>
      <div className="fh-cands">
        {cands.map((c) => {
          const isD = c.name === r.dem, isR = c.name === r.gop;
          const col = isD ? sideColor(r, "dem") : isR ? sideColor(r, "gop") : "var(--fh-mute)";
          const chance = isD ? pD : isR ? r.est.prob : null;
          return (
            <div key={c.name} className="fh-cand" style={{ "--c": col } as React.CSSProperties}>
              <span className="fh-cand-n"><b>{c.name}</b><em>{c.party}</em></span>
              <span className="fh-cand-v">{Number.isFinite(c.pct) ? <b><CountUp value={c.pct} dp={1} suffix="%" /></b> : null}{Number.isFinite(c.votes) ? <em>{commas(c.votes)} votes</em> : null}</span>
              {chance !== null ? <span className="fh-cand-c">{fmtPct(chance)} to win</span> : null}
              <span className="fh-cand-bar"><i style={{ width: `${Number.isFinite(c.pct) ? c.pct : 50}%` }} /></span>
            </div>
          );
        })}
      </div>
      {!isUncontested(r) ? <ChanceDial r={r} /> : null}
      <MarginHist r={r} />
      {r.office !== "house" && detail && rows ? <CountyMap r={r} detail={detail} rows={rows} names={names} p24={p24} /> : null}
      {r.office !== "house" && (!detail || !rows) ? <p className="fh-mute">County map loading…</p> : null}
      {r.polls?.length ? (
        <div className="fh-polls">
          <span className="fh-eyebrow">latest polls</span>
          {r.polls.slice(0, 5).map((p, i) => (
            <div key={i} className="fh-poll"><span>{p.pollster}</span><em>{p.age}d ago · {p.kind}</em><b style={{ color: p.margin < 0 ? sideColor(r, "dem") : sideColor(r, "gop") }}>{p.margin < 0 ? surname(r.dem) : surname(r.gop)} +{Math.abs(p.margin).toFixed(1)}</b></div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

const CSS = `
.fh { --fh-dem:${DEM}; --fh-gop:${GOP}; --fh-acc:#6d3ee9; --fh-acc2:#b14de8;
  --fh-card: rgba(var(--ink-rgb, 23,23,27), 0.035); --fh-line: rgba(var(--ink-rgb, 23,23,27), 0.12);
  --fh-mute: rgba(var(--ink-rgb, 23,23,27), 0.6); --fh-idle: rgba(var(--ink-rgb, 23,23,27), 0.09);
  --fh-pending: rgba(var(--ink-rgb, 23,23,27), 0.2); --fh-land: rgba(var(--ink-rgb, 23,23,27), 0.08);
  position: relative; max-width: 1240px; margin: 0 auto; padding: 28px 16px 8px; color: var(--ink, #17171b); overflow: hidden; }
.fh-glow { position: absolute; inset: -120px -40px auto; height: 420px; pointer-events: none; z-index: 0;
  background: radial-gradient(40% 60% at 15% 30%, rgba(59,111,222,0.18), transparent 70%), radial-gradient(40% 60% at 85% 20%, rgba(226,57,80,0.16), transparent 70%), radial-gradient(30% 50% at 55% 0%, rgba(109,62,233,0.2), transparent 70%); }
.fh > * { position: relative; z-index: 1; }
.fh-loading { padding: 80px 0; text-align: center; font-family: ${MONO}; color: var(--fh-mute); }
.fh-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-family: ${MONO}; font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--fh-mute); }
.fh-pip { width: 8px; height: 8px; border-radius: 50%; background: #e23950; box-shadow: 0 0 0 0 rgba(226,57,80,.6); animation: fhPulse 1.8s infinite; }
@keyframes fhPulse { 70% { box-shadow: 0 0 0 9px rgba(226,57,80,0); } 100% { box-shadow: 0 0 0 0 rgba(226,57,80,0); } }
.fh-hero { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 22px; }
.fh-hero-l { max-width: 680px; }
.fh-hero h1 { font-family: ${OSWALD}; font-size: clamp(34px, 5.4vw, 60px); line-height: 1.02; margin: 10px 0 12px; font-weight: 700; letter-spacing: -.01em; text-wrap: balance; }
.fh-grad { background: linear-gradient(90deg, var(--fh-dem), var(--fh-acc), var(--fh-gop)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.fh-lede { font-size: 16px; line-height: 1.55; color: var(--fh-mute); max-width: 60ch; margin: 0; }
.fh-clock { display: grid; grid-template-columns: repeat(4, auto); gap: 6px 10px; align-items: end; }
.fh-clock div { display: flex; flex-direction: column; align-items: center; min-width: 58px; padding: 10px 6px 8px; border-radius: 12px; background: var(--fh-card); border: 1px solid var(--fh-line); }
.fh-clock b { font-family: ${OSWALD}; font-size: 30px; line-height: 1; font-variant-numeric: tabular-nums; }
.fh-clock span { font-family: ${MONO}; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--fh-mute); margin-top: 4px; }
.fh-clock em { grid-column: 1 / -1; font-style: normal; font-family: ${MONO}; font-size: 11px; color: var(--fh-mute); text-align: right; }
.fh-card { background: var(--fh-card); border: 1px solid var(--fh-line); border-radius: 16px; backdrop-filter: blur(6px); }
.fh-chambers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 30px; }
.fh-ch { text-align: left; padding: 18px 18px 16px; cursor: pointer; color: inherit; font: inherit; display: flex; flex-direction: column; gap: 6px; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
.fh-ch:hover { transform: translateY(-2px); }
.fh-ch.on { border-color: var(--fh-acc); box-shadow: 0 10px 34px -16px rgba(109,62,233,.55); }
.fh-ch.dem { background-image: linear-gradient(160deg, rgba(59,111,222,.12), transparent 55%); }
.fh-ch.gop { background-image: linear-gradient(160deg, rgba(226,57,80,.12), transparent 55%); }
.fh-ch-k { font-family: ${MONO}; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; display: flex; justify-content: space-between; gap: 8px; }
.fh-ch-k em { font-style: normal; font-weight: 500; color: var(--fh-mute); letter-spacing: .06em; }
.fh-ch-p { font-family: ${OSWALD}; font-size: 54px; line-height: 1; font-weight: 700; font-variant-numeric: tabular-nums; }
.fh-ch-p small { font-size: 26px; margin-left: 2px; }
.fh-ch-w { font-size: 14px; color: var(--fh-mute); }
.fh-ch-w b { color: var(--ink, inherit); }
.fh-seatbar { position: relative; display: flex; height: 10px; border-radius: 6px; overflow: visible; margin-top: 8px; }
.fh-seatbar i { display: block; height: 100%; }
.fh-seatbar i:first-child { border-radius: 6px 0 0 6px; } .fh-seatbar i:last-child { border-radius: 0 6px 6px 0; }
.fh-seatbar b { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--ink, #17171b); transform: translateX(-1px); }
.fh-ch-s { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-family: ${MONO}; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fh-ch-s em { font-style: normal; font-weight: 500; color: var(--fh-mute); font-size: 10.5px; text-align: center; }
.fh-sec { margin-bottom: 30px; scroll-margin-top: 80px; }
.fh-sec-h { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px 20px; margin-bottom: 12px; }
.fh-sec-h h2 { font-family: ${OSWALD}; font-size: 26px; margin: 0; font-weight: 600; }
.fh-tp { margin: 0; font-size: 14px; color: var(--fh-mute); max-width: 70ch; }
.fh-tp button { background: none; border: 0; padding: 0; font: inherit; font-weight: 700; color: var(--fh-acc); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.fh-close { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(180px, 1fr); gap: 12px; overflow-x: auto; padding-bottom: 6px; scroll-snap-type: x mandatory; }
.fh-cl { text-align: left; font: inherit; color: inherit; cursor: pointer; padding: 14px; display: flex; flex-direction: column; gap: 6px; scroll-snap-align: start; position: relative; overflow: hidden; animation: fhRise .5s both; }
.fh-cl::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--c); }
.fh-cl:hover { border-color: var(--c); }
@keyframes fhRise { from { opacity: 0; transform: translateY(8px); } }
.fh-cl-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 15px; }
.fh-cl-top em { font-style: normal; font-family: ${MONO}; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; white-space: nowrap; }
.fh-cl-m { font-family: ${OSWALD}; font-size: 32px; line-height: 1; font-weight: 700; }
.fh-cl-n { font-size: 13px; color: var(--fh-mute); } .fh-cl-n em { font-style: normal; opacity: .7; }
.fh-cl-bar { display: flex; height: 6px; border-radius: 4px; overflow: hidden; }
.fh-cl-p { font-family: ${MONO}; font-size: 11px; color: var(--fh-mute); }
.fh-chips { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 4px; border-radius: 999px; background: var(--fh-card); border: 1px solid var(--fh-line); }
.fh-chips button { border: 0; background: transparent; color: inherit; font: inherit; font-size: 13px; font-weight: 600; padding: 6px 13px; border-radius: 999px; cursor: pointer; transition: background .15s ease, color .15s ease; }
.fh-chips button:hover:not(:disabled) { background: var(--fh-idle); }
.fh-chips button.on { background: var(--fh-acc); color: #fff; }
.fh-chips button:disabled { opacity: .35; cursor: not-allowed; }
.fh-chips button:focus-visible, .fh-btn:focus-visible, .fh-ch:focus-visible, .fh-cl:focus-visible { outline: 2px solid var(--fh-acc); outline-offset: 2px; }
.fh-lab-h { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 8px; }
.fh-sim-ctl { margin-left: auto; display: flex; gap: 8px; }
.fh-btn { border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 700; font-size: 14px; color: #fff; cursor: pointer; background: linear-gradient(90deg, var(--fh-acc), var(--fh-acc2)); box-shadow: 0 8px 24px -10px rgba(109,62,233,.8); transition: transform .15s ease; }
.fh-btn:hover { transform: translateY(-1px); }
.fh-btn.ghost { background: var(--fh-card); color: inherit; border: 1px solid var(--fh-line); box-shadow: none; }
.fh-help { margin: 0 0 12px; font-size: 14px; color: var(--fh-mute); }
.fh-lab { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
.fh-lab.with { grid-template-columns: minmax(0, 1.55fr) minmax(300px, 1fr); }
.fh-mapbox { position: relative; }
.fh-map { width: 100%; height: auto; max-height: 68vh; display: block; margin: 0 auto; }
.fh-st { stroke: var(--background, #f7f7f4); stroke-width: .8; transition: fill .35s ease, opacity .2s ease; }
.fh-st.dist { stroke-width: .25; }
.fh-st.live { cursor: pointer; }
.fh-st.live:hover { opacity: .82; }
.fh-st.sel { stroke: var(--ink, #17171b); stroke-width: 2.2; }
.fh-st.upset { stroke: #f6c443; stroke-width: 2.4; stroke-dasharray: 4 2; }
.fh-st-line { fill: none; stroke: var(--background, #f7f7f4); stroke-width: 1; pointer-events: none; }
.fh-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; margin-top: 8px; font-size: 12px; color: var(--fh-mute); font-family: ${MONO}; }
.fh-legend span { display: inline-flex; align-items: center; gap: 6px; }
.fh-legend i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.fh-ramp { gap: 0 !important; } .fh-ramp i { width: 22px; border-radius: 0; }
.fh-upset-key { border: 2px dashed #f6c443; background: transparent !important; }
.fh-legend-note { font-family: ${MONO}; }
.fh-tip { position: absolute; z-index: 30; pointer-events: none; transform: translate(14px, 14px); min-width: 190px; max-width: 280px; padding: 10px 12px; border-radius: 12px; background: var(--panel, #fff); border: 1px solid var(--fh-line); box-shadow: 0 14px 36px -12px rgba(0,0,0,.35); display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
.fh-tip.fixed { position: fixed; }
.fh-tip em { font-style: normal; color: var(--fh-mute); }
.fh-tip-cta { font-family: ${MONO}; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--fh-acc); margin-top: 3px; }
.fh-night { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; margin-bottom: 10px; padding: 12px 16px; border-radius: 14px; background: var(--fh-card); border: 1px solid var(--fh-line); }
.fh-night-n { display: flex; align-items: baseline; gap: 12px; font-family: ${OSWALD}; font-size: 40px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.fh-night-n em { font-style: normal; font-family: ${MONO}; font-size: 11px; color: var(--fh-mute); font-weight: 500; }
.fh-night-t { font-size: 15px; }
.fh-night-s { font-size: 12px; color: var(--fh-mute); flex-basis: 100%; }
.fh-panel { padding: 16px; display: flex; flex-direction: column; gap: 14px; animation: fhRise .35s both; }
.fh-panel-h { display: flex; justify-content: space-between; gap: 12px; }
.fh-panel-h h3 { font-family: ${OSWALD}; font-size: 28px; margin: 4px 0 0; line-height: 1.05; }
.fh-x { border: 1px solid var(--fh-line); background: transparent; color: inherit; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; cursor: pointer; flex: none; }
.fh-panel-rate { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fh-panel-rate em { font-style: normal; font-family: ${MONO}; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; }
.fh-panel-rate b { font-family: ${OSWALD}; font-size: 26px; }
.fh-panel-rate span { font-size: 13px; color: var(--fh-mute); }
.fh-cands { display: flex; flex-direction: column; gap: 8px; }
.fh-cand { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--fh-line); border-left: 4px solid var(--c); }
.fh-cand-n b { font-size: 15px; } .fh-cand-n em { font-style: normal; font-family: ${MONO}; font-size: 11px; color: var(--fh-mute); margin-left: 6px; }
.fh-cand-v { text-align: right; } .fh-cand-v b { font-family: ${OSWALD}; font-size: 22px; color: var(--c); } .fh-cand-v em { display: block; font-style: normal; font-size: 11px; color: var(--fh-mute); }
.fh-cand-c { font-family: ${MONO}; font-size: 11px; color: var(--fh-mute); }
.fh-cand-bar { grid-column: 1 / -1; height: 4px; border-radius: 3px; background: var(--fh-idle); overflow: hidden; }
.fh-cand-bar i { display: block; height: 100%; background: var(--c); border-radius: 3px; transition: width .6s ease; }
.fh-dial svg { width: 100%; max-width: 320px; display: block; margin: 0 auto; }
.fh-dot { animation: fhPop .4s both; }
@keyframes fhPop { from { opacity: 0; } }
.fh-dial-n { font-family: ${OSWALD}; font-size: 26px; font-weight: 700; }
.fh-dial-l { font-family: ${MONO}; font-size: 9px; letter-spacing: .14em; fill: var(--fh-mute); }
.fh-dial-cap { font-size: 13px; color: var(--fh-mute); text-align: center; margin: 4px 0 0; }
.fh-hist svg { width: 100%; display: block; }
.fh-hist-zero { stroke: var(--ink, #17171b); stroke-width: 1.2; stroke-dasharray: 3 2; }
.fh-hist-l { font-family: ${MONO}; font-size: 9px; fill: var(--fh-mute); }
.fh-hist figcaption { font-size: 12.5px; color: var(--fh-mute); margin-top: 4px; }
.fh-hist { margin: 0; }
.fh-cmap { position: relative; }
.fh-cmap-head { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.fh-cmap svg { width: 100%; height: auto; max-height: 420px; display: block; }
.fh-county { stroke: var(--background, #f7f7f4); stroke-width: .5; vector-effect: non-scaling-stroke; transition: fill .3s ease; }
.fh-county.hot { stroke: var(--ink, #17171b); stroke-width: 1.5; }
.fh-bubble { opacity: .78; stroke: var(--background, #f7f7f4); stroke-width: .6; vector-effect: non-scaling-stroke; pointer-events: none; }
.fh-polls { display: flex; flex-direction: column; gap: 6px; }
.fh-poll { display: grid; grid-template-columns: 1fr auto; gap: 0 10px; font-size: 13px; padding: 6px 0; border-bottom: 1px solid var(--fh-line); }
.fh-poll em { font-style: normal; font-size: 11px; color: var(--fh-mute); grid-row: 2; }
.fh-poll b { grid-row: 1 / 3; grid-column: 2; align-self: center; font-family: ${MONO}; font-size: 12px; }
.fh-mute { color: var(--fh-mute); font-size: 13px; margin: 0; }
@media (max-width: 900px) {
  .fh-chambers { grid-template-columns: minmax(0, 1fr); }
  .fh-lab.with { grid-template-columns: minmax(0, 1fr); }
  .fh-sim-ctl { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .fh *, .fh *::before { animation: none !important; transition: none !important; }
}
`;
