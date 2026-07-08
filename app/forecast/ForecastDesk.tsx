"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Manrope } from "next/font/google";
import DarkNav from "@/app/components/DarkNav";
import SwingOMeter from "../results/components/SwingOMeter";
import {
  DEM, GOP, INK, LIME, TOSS, RATING_BANDS,
  type Geo, type Model, type ModelKey, type Office, type Race, type RaceSide, type StateDetail, type ViewMode,
  OFFICE_LABEL, fmtMargin, fmtPct, marginColor, raceColor, ratingFor, surname,
} from "./lib";

const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "800"], variable: "--font-mp" });

// ─────────────────────────────────────────────────────────────────────────────
// The Forecast — one editorial page, top to bottom:
//   headline → seat bar → controls → THE MAP → the aggregate, in sections →
//   every race, as a table. Selecting a race swaps the map itself for that
//   race's real geography, and the sections below become that race's work-up.
// No drawers, no dashboard tiles. The desk's own type, tones, and hairlines.
// ─────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const OSWALD = '"Oswald", "Barlow Condensed", system-ui, sans-serif';

// ── data hooks ───────────────────────────────────────────────────────────────
const jsonCache = new Map<string, unknown>();
function useJson<T>(url: string | null): T | null {
  const [data, setData] = useState<T | null>(() => (url && jsonCache.has(url) ? (jsonCache.get(url) as T) : null));
  useEffect(() => {
    if (!url) return;
    if (jsonCache.has(url)) { setData(jsonCache.get(url) as T); return; }
    let dead = false;
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        jsonCache.set(url, j);
        if (!dead) setData(j as T);
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [url]);
  return url ? data : null;
}

const fmtDate = (iso: string) =>
  new Date(iso + "T14:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// ── shared micro-components ──────────────────────────────────────────────────
function Eyebrow({ children, live }: { children: React.ReactNode; live?: boolean }) {
  return (
    <span className="fc-eyebrow">
      <span className="fc-eyebrow-mk" aria-hidden />
      {children}
      {live ? <span className="fc-eyebrow-pip" aria-hidden /> : null}
    </span>
  );
}

function Seg<T extends string>({ value, options, onChange, small, ariaLabel }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; small?: boolean; ariaLabel: string;
}) {
  return (
    <div className={`fc-seg ${small ? "sm" : ""}`} role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.v} role="tab" aria-selected={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// the reference's margin bar: gradient track, the 80% band, a dot at the estimate
function MarginBar({ m, p10, p90 }: { m: number; p10: number; p90: number }) {
  const x = (v: number) => 50 + Math.max(-24, Math.min(24, v)) * (50 / 24);
  return (
    <span className="fc-mbar" aria-hidden>
      <span className="fc-mbar-track" />
      <span className="fc-mbar-band" style={{ left: `${Math.min(x(p10), x(p90))}%`, width: `${Math.max(2, Math.abs(x(p90) - x(p10)))}%` }} />
      <span className="fc-mbar-mid" />
      <span className="fc-mbar-dot" style={{ left: `${x(m)}%` }} />
    </span>
  );
}

function Spark({ pts, color }: { pts: number[]; color: string }) {
  if (!pts.length) return null;
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = Math.max(0.04, max - min);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * 64).toFixed(1)},${(18 - ((p - min) / span) * 16).toFixed(1)}`).join("");
  return (
    <svg width="64" height="20" viewBox="0 0 64 20" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
      <circle cx="64" cy={18 - ((pts[pts.length - 1] - min) / span) * 16} r="2" fill={color} />
    </svg>
  );
}

// ── the page ─────────────────────────────────────────────────────────────────
export default function ForecastDesk() {
  const model = useJson<Model>("/forecast/model.json");
  const geo = useJson<Geo>("/forecast/geo.json");
  const counties = (useJson<Record<string, unknown>>("/forecast/counties.json") ?? null) as
    (Record<string, Record<string, number>> & { _reg?: string[] }) | null;

  const [office, setOffice] = useState<Office>("house");
  const [view, setView] = useState<ViewMode>("margin");
  const [mapKind, setMapKind] = useState<"geo" | "hex">("geo");
  const [mk, setMk] = useState<ModelKey>("complete");
  const [selId, setSelId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"close" | "prob" | "name">("close");
  const [showAll, setShowAll] = useState(false);
  const mapAnchor = useRef<HTMLDivElement | null>(null);

  const races = useMemo(() => (model ? model.races.filter((r) => r.office === office) : []), [model, office]);
  const byId = useMemo(() => new Map(model ? model.races.map((r) => [r.id, r]) : []), [model]);
  const sel = selId ? byId.get(selId) ?? null : null;

  const detail = useJson<StateDetail>(sel ? `/forecast/states/${sel.st}.json` : null);
  const chamber = model ? model.chambers[office][mk] : null;

  const head = useMemo(() => {
    if (!chamber) return null;
    const dem = chamber.demControl;
    const fav = dem >= 0.5 ? "dem" : "gop";
    const p = Math.round(Math.max(dem, 1 - dem) * 100);
    const partyName = fav === "dem" ? "Democrats" : "Republicans";
    const object =
      office === "house" ? "of winning the House" :
      office === "senate" ? (fav === "gop" ? "of holding the Senate" : "of flipping the Senate") :
      "of winning most governorships";
    return { fav, p, partyName, object };
  }, [chamber, office]);

  const pick = (id: string) => {
    setSelId(id);
    setHover(null);
    requestAnimationFrame(() => mapAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const back = () => setSelId(null);
  useEffect(() => { setSelId(null); setQuery(""); setShowAll(false); }, [office]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tableRows = useMemo(() => {
    let rows = races;
    const q = query.trim().toLowerCase();
    if (q) rows = rows.filter((r) => (r.name + " " + r.dem + " " + r.gop + " " + r.st).toLowerCase().includes(q));
    const sorted = [...rows];
    if (sortKey === "close") sorted.sort((a, b) => Math.abs(a[mk].margin) - Math.abs(b[mk].margin));
    else if (sortKey === "prob") sorted.sort((a, b) => b[mk].prob - a[mk].prob);
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (!q && !showAll && sorted.length > 24) return sorted.slice(0, 24);
    return sorted;
  }, [races, query, sortKey, mk, showAll]);
  const truncated = !query.trim() && !showAll && races.length > 24;

  if (!model || !geo || !chamber || !head) {
    return (
      <div className={`fc-page ${manrope.variable}`}>
        <style>{CSS}</style>
        <div className="fc-loading"><span /><em>loading the forecast…</em></div>
      </div>
    );
  }

  const gb = model.meta.genericBallot;

  return (
    <div className={`fc-page ${manrope.variable}`}>
      <style>{CSS}</style>
      <div className="fc-grain" aria-hidden />

      <div className="fc-status">
        <div className="fc-shell fc-status-in">
          <span><i className="fc-pip" /> THE FORECAST <em>·</em> 2026 MIDTERMS</span>
          <span>{model.meta.sims.toLocaleString()} SIMULATIONS <em>·</em> UPDATED {fmtDate(model.meta.updated).toUpperCase()}</span>
        </div>
      </div>

      <div className="fc-shell"><DarkNav /></div>

      {/* ── headline ── */}
      <header className="fc-head">
        <Eyebrow live>the 2026 forecast</Eyebrow>
        <h1 className="fc-h1">
          <b style={{ color: head.fav === "dem" ? DEM : GOP }}>{head.partyName}</b> have a{" "}
          <b style={{ color: head.fav === "dem" ? DEM : GOP }}>{head.p}%</b> chance {head.object}<em>.</em>
        </h1>
        <div className="fc-updated">
          last updated {fmtDate(model.meta.updated).toLowerCase()} · 2:00 pm et · {model.meta.daysOut} days to election day
        </div>
        <div className="fc-envline">
          <span>national environment <b style={{ color: DEM }}>D+{Math.abs(model.meta.npe).toFixed(1)}</b></span>
          <em>·</em>
          <span>generic ballot <b style={{ color: DEM }}>D+{Math.abs(gb.avg).toFixed(1)}</b></span>
          <em>·</em>
          <span>net approval <b style={{ color: GOP }}>{gb.netApproval}</b></span>
          <em>·</em>
          <span>{model.meta.sims.toLocaleString()} sims run today</span>
        </div>
      </header>

      {/* ── seat bar ── */}
      <div className="fc-shell">
        <SeatBar chamber={chamber} office={office} model={model} />
      </div>

      {/* ── controls ── */}
      <div className="fc-shell fc-controls" ref={mapAnchor}>
        <Seg ariaLabel="Office" value={office} onChange={setOffice} options={[
          { v: "governor", label: "Governors" }, { v: "senate", label: "Senate" }, { v: "house", label: "House" },
        ]} />
        <div className="fc-controls-r">
          <span className="fc-ctl-label">view</span>
          <Seg small ariaLabel="Map style" value={mapKind} onChange={setMapKind} options={[
            { v: "geo", label: "map" }, { v: "hex", label: "cartogram" },
          ]} />
          <span className="fc-ctl-label" style={{ marginLeft: 16 }}>color by</span>
          <Seg small ariaLabel="Color mode" value={view} onChange={setView} options={[
            { v: "margin", label: "margin" }, { v: "odds", label: "odds" }, { v: "rating", label: "rating" },
          ]} />
          <span className="fc-ctl-label" style={{ marginLeft: 16 }}>model</span>
          <Seg small ariaLabel="Model" value={mk} onChange={setMk} options={[
            { v: "legacy", label: "legacy" }, { v: "complete", label: "complete" },
          ]} />
        </div>
      </div>

      {/* ── the map ── */}
      <section className="fc-mapwrap">
        {!sel ? (
          <>
            <NationalMap geo={geo} races={races} office={office} view={view} mk={mk} kind={mapKind} onPick={pick} hover={hover} setHover={setHover} />
            <Legend view={view} />
            {hover && byId.get(hover.id) ? <MapTip race={byId.get(hover.id)!} mk={mk} x={hover.x} y={hover.y} /> : null}
          </>
        ) : (
          <RaceStage race={sel} mk={mk} detail={detail} counties={counties} onBack={back} />
        )}
      </section>

      {/* ── below the map ── */}
      {!sel ? (
        <>
          <SectionDistribution chamber={chamber} office={office} sims={model.meta.sims} />
          <SectionSeats chamber={chamber} office={office} updated={model.meta.updated} />
          <SectionProbability chamber={chamber} office={office} updated={model.meta.updated} />
          <section className="fc-sec last">
            <div className="fc-shell">
              <Eyebrow>every race</Eyebrow>
              <h2 className="fc-h2">the {OFFICE_LABEL[office].toLowerCase()} board, closest first<em>.</em></h2>
              <div className="fc-table-tools">
                <div className="fc-find">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search races, states, or candidates" aria-label="Search races" spellCheck={false} />
                </div>
                <div className="fc-sorts" role="group" aria-label="Sort">
                  {([["close", "closest"], ["prob", "win prob."], ["name", "a–z"]] as const).map(([k, label]) => (
                    <button key={k} className={sortKey === k ? "on" : ""} onClick={() => setSortKey(k)}>{label}</button>
                  ))}
                </div>
              </div>
              <RaceTable rows={tableRows} mk={mk} onPick={pick} />
              {truncated ? (
                <button className="fc-more" onClick={() => setShowAll(true)}>
                  show all {races.length} races <span aria-hidden>↓</span>
                </button>
              ) : null}
            </div>
          </section>
        </>
      ) : (
        <RaceSections race={sel} mk={mk} byId={byId} onPick={pick} sims={model.meta.sims} updated={model.meta.updated} env={{ npe: model.meta.npe, gb: model.meta.genericBallot.avg, approval: model.meta.genericBallot.netApproval }} />
      )}

      <footer className="fc-foot">
        <div className="fc-shell fc-foot-in">
          <span>fundamentals → polling (ENOP-weighted) → expert ratings → markets → {model.meta.sims.toLocaleString()} correlated simulations</span>
          <span>TPSI · the public sentiment institute</span>
        </div>
      </footer>
    </div>
  );
}

// ── seat bar ─────────────────────────────────────────────────────────────────
type ChamberT = Model["chambers"]["house"]["complete"];
function SeatBar({ chamber, office, model }: { chamber: ChamberT; office: Office; model: Model }) {
  const total = chamber.seatsTotal;
  const dem = chamber.demSeats, gop = chamber.gopSeats;
  const control = office === "house" ? 218 : office === "senate" ? 50 : 18;
  return (
    <div className="fc-seatbar">
      <div className="fc-seatbar-ends">
        <span style={{ color: DEM }}><b>{Math.round(dem)}</b> Democrats</span>
        <span className="fc-seatbar-mid">{office === "senate" ? "50 + tiebreak controls" : `${control} to control`}</span>
        <span style={{ color: GOP }}><b>{Math.round(gop)}</b> Republicans</span>
      </div>
      <div className="fc-seatbar-track" role="img" aria-label={`Expected: ${Math.round(dem)} Democratic seats, ${Math.round(gop)} Republican`}>
        <span className="fc-seatbar-fill" style={{ width: `${(dem / total) * 100}%` }} />
        <span className="fc-seatbar-tick" style={{ left: `${(control / total) * 100}%` }} />
      </div>
      {office === "senate" ? (
        <div className="fc-seatbar-note">{model.meta.senNotUpD} Democratic and {model.meta.senNotUpR} Republican seats are not on the 2026 ballot</div>
      ) : null}
    </div>
  );
}

// ── national map ─────────────────────────────────────────────────────────────
function hexPts(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function NationalMap({ geo, races, office, view, mk, kind, onPick, hover, setHover }: {
  geo: Geo; races: Race[]; office: Office; view: ViewMode; mk: ModelKey; kind: "geo" | "hex";
  onPick: (id: string) => void; hover: { id: string; x: number; y: number } | null;
  setHover: (h: { id: string; x: number; y: number } | null) => void;
}) {
  const [W, H] = geo.frame;
  const move = (id: string) => (e: React.MouseEvent) => setHover({ id, x: e.clientX, y: e.clientY });

  // ── cartogram ──
  if (kind === "hex") {
    if (office === "house") {
      const byId = new Map(races.map((r) => [r.id, r]));
      const hovered = hover ? geo.hexHouse[hover.id] : null;
      return (
        <svg key="hex-house" className="fc-map anim" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="House cartogram — one hexagon per district">
          {Object.entries(geo.hexHouse).map(([id, [x, y]], i) => {
            const r = byId.get(id);
            if (!r) return null;
            return (
              <polygon
                key={id}
                points={hexPts(x, y, geo.hexHouseR - 0.7)}
                fill={raceColor(r, mk, view)}
                className="fc-hex"
                style={{ animationDelay: `${(i % 44) * 9}ms` }}
                onMouseMove={move(id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onPick(id)}
              />
            );
          })}
          {hovered ? <polygon points={hexPts(hovered[0], hovered[1], geo.hexHouseR - 0.7)} className="fc-map-halo" /> : null}
        </svg>
      );
    }
    const byState = new Map(races.map((r) => [r.st, r]));
    const hoverSt = hover ? hover.id.split("-")[1] : null;
    return (
      <svg key="hex-state" className="fc-map anim" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${OFFICE_LABEL[office]} cartogram — one tile per state`}>
        {Object.entries(geo.hexStates).map(([st, [x, y]], i) => {
          const r = byState.get(st);
          const delay = `${(i % 26) * 14}ms`;
          if (!r) {
            return (
              <g key={st} className="fc-hexg" style={{ animationDelay: delay }}>
                <polygon points={hexPts(x, y, geo.hexStatesR - 1.5)} className="fc-hex idle" />
                <text x={x} y={y + 4} className="fc-hex-label idle">{st}</text>
              </g>
            );
          }
          return (
            <g key={st} className="fc-hexg" style={{ animationDelay: delay }}>
              <polygon
                points={hexPts(x, y, geo.hexStatesR - 1.5)}
                fill={raceColor(r, mk, view)}
                className="fc-hex"
                onMouseMove={move(r.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onPick(r.id)}
              />
              <text x={x} y={y + 4} className="fc-hex-label">{st}</text>
            </g>
          );
        })}
        {hoverSt && geo.hexStates[hoverSt] ? (
          <polygon points={hexPts(geo.hexStates[hoverSt][0], geo.hexStates[hoverSt][1], geo.hexStatesR - 1.5)} className="fc-map-halo" />
        ) : null}
      </svg>
    );
  }

  // ── geography ──
  if (office !== "house") {
    const byState = new Map(races.map((r) => [r.st, r]));
    const hoverRace = hover ? races.find((r) => r.id === hover.id) : null;
    return (
      <svg key="geo-state" className="fc-map anim" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${OFFICE_LABEL[office]} forecast map`}>
        {Object.entries(geo.states).map(([st, d]) => {
          const r = byState.get(st);
          if (!r) return <path key={st} d={d} className="fc-map-idle" />;
          return (
            <path
              key={st} d={d}
              fill={raceColor(r, mk, view)}
              className="fc-map-race"
              onMouseMove={move(r.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(r.id)}
            />
          );
        })}
        {hoverRace ? <path d={geo.states[hoverRace.st]} className="fc-map-halo" /> : null}
      </svg>
    );
  }

  const byId = new Map(races.map((r) => [r.id, r]));
  return (
    <svg key="geo-house" className="fc-map anim" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="House forecast map">
      {Object.entries(geo.districts).map(([id, g]) => {
        if (!g.d) return null;
        const r = byId.get(id);
        if (!r) return null;
        return (
          <path
            key={id} d={g.d}
            fill={raceColor(r, mk, view)}
            className="fc-map-race cd"
            onMouseMove={move(id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onPick(id)}
          />
        );
      })}
      {Object.values(geo.states).map((d, i) => (
        <path key={i} d={d} className="fc-map-stateline" />
      ))}
      {hover && geo.districts[hover.id]?.d ? <path d={geo.districts[hover.id].d!} className="fc-map-halo" /> : null}
    </svg>
  );
}

function Legend({ view }: { view: ViewMode }) {
  const items: [string, string][] =
    view === "rating"
      ? [["Safe D", "#1d3a85"], ["Likely D", "#2f5bc4"], ["Lean D", "#6f92e8"], ["Toss-up", "#8b5cf6"], ["Lean R", "#e56471"], ["Likely R", "#c22e3c"], ["Safe R", "#8f1f2b"]]
      : view === "odds"
        ? [["Safe D", "#183685"], ["Favored D", "#4a5fb8"], ["Toss-up", "#9b8bd4"], ["Favored R", "#c2536b"], ["Safe R", "#a01426"]]
        : [["D+30", "#16306f"], ["D+10", "#2c56c4"], ["D+2", "#7b8fe0"], ["Even", "#8b5cf6"], ["R+2", "#e08a94"], ["R+10", "#c22638"], ["R+30", "#701020"]];
  return (
    <div className="fc-legend" aria-hidden>
      {items.map(([label, c]) => (
        <span key={label}><i style={{ background: c }} />{label}</span>
      ))}
    </div>
  );
}

function MapTip({ race, mk, x, y }: { race: Race; mk: ModelKey; x: number; y: number }) {
  const s = race[mk];
  const fav = s.margin > 0 ? race.gop : race.dem;
  const tone = s.margin > 0 ? GOP : DEM;
  const p = s.margin > 0 ? s.prob : 1 - s.prob;
  const flip = typeof window !== "undefined" && x > window.innerWidth - 330;
  const yc = typeof window !== "undefined" ? Math.min(y, window.innerHeight - 130) : y;
  return (
    <div className="fc-tip" style={{ left: x + (flip ? -292 : 18), top: yc - 14 }}>
      <div className="fc-tip-name">{race.name}</div>
      <div className="fc-tip-row">
        <i style={{ background: tone }} />
        <b>{surname(fav)}</b>
        <span style={{ color: tone }}>{fmtMargin(s.margin)}</span>
        <em>{fmtPct(p)} to win</em>
      </div>
      <div className="fc-tip-foot">{ratingFor(s.margin).cat} · click for the full race</div>
    </div>
  );
}

// ── race stage — the map swaps in place ──────────────────────────────────────
const NO_DETAIL = new Set(["AK", "HI"]); // unified districts — no county file ships

type CountiesPayload = Record<string, Record<string, number>> & { _reg?: string[] };

function RaceStage({ race, mk, detail, counties, onBack }: {
  race: Race; mk: ModelKey; detail: StateDetail | null;
  counties: CountiesPayload | null; onBack: () => void;
}) {
  const s = race[mk];
  const fav = s.margin > 0 ? race.gop : race.dem;
  const tone = s.margin > 0 ? GOP : DEM;
  // county projections are built on the Complete estimate — re-center for Legacy
  const delta = mk === "legacy" ? race.legacy.margin - race.complete.margin : 0;
  const rows = race.office !== "house" && counties ? (counties[race.id] as Record<string, number> | undefined) ?? null : null;
  const regBacked = !!counties?._reg?.includes(race.st);

  return (
    <div className="fc-stage">
      <div className="fc-shell">
        <button className="fc-back" onClick={onBack}>
          <span aria-hidden>←</span> the national map
        </button>
        <div className="fc-stage-title">
          <span className="fc-stage-year">2026 · {race.office}{race.marquee ? " · marquee" : ""}</span>
          <h2>{race.name}</h2>
          <div className="fc-stage-banner" style={{ color: tone }}>
            {surname(fav)} favored by {Math.abs(s.margin).toFixed(1)} · {fmtPct(s.margin > 0 ? s.prob : 1 - s.prob)} to win
          </div>
        </div>
      </div>

      <div className="fc-stage-map">
        {NO_DETAIL.has(race.st) ? (
          <div className="fc-map-loading static"><em>no county detail for {race.state} — the model prices this race statewide</em></div>
        ) : race.office !== "house" ? (
          detail && rows ? (
            <svg viewBox="0 0 900 620" className="fc-map race" role="img" aria-label={`${race.state} county projection`}>
              {detail.counties.map((c) => {
                const m = rows[c.id];
                return <path key={c.id} d={c.d} fill={m == null ? "#101014" : marginColor(m + delta)} stroke="rgba(5,5,7,0.55)" strokeWidth="0.8" />;
              })}
            </svg>
          ) : (
            <div className="fc-map-loading"><span /><em>drawing {race.state}…</em></div>
          )
        ) : detail ? (
          <svg viewBox="0 0 900 620" className="fc-map race" role="img" aria-label={`${race.name} within ${race.state}`}>
            {detail.counties.map((c) => (
              <path key={c.id} d={c.d} fill="#111318" stroke="rgba(244,244,239,0.08)" strokeWidth="0.8" />
            ))}
            {detail.districts.map((d) => {
              const on = d.id === race.id;
              return (
                <path
                  key={d.id} d={d.d}
                  fill={on ? raceColor(race, mk, "margin") : "transparent"}
                  fillOpacity={on ? 0.94 : 0}
                  stroke={on ? INK : "rgba(244,244,239,0.2)"}
                  strokeWidth={on ? 1.6 : 0.7}
                  style={on ? { filter: `drop-shadow(0 0 18px ${raceColor(race, mk, "margin")}66)` } : undefined}
                />
              );
            })}
          </svg>
        ) : (
          <div className="fc-map-loading"><span /><em>drawing {race.state}…</em></div>
        )}
      </div>
      {NO_DETAIL.has(race.st) ? null : <div className="fc-stage-caption">
        {race.office === "house"
          ? `the ${race.state} delegation · ${race.name.toLowerCase()} highlighted`
          : regBacked
            ? "county-level projection from party registration · shaded by projected 2026 margin"
            : "county-level structural estimate — no registration data in this state"}
      </div>}
    </div>
  );
}

// ── national aggregate sections ──────────────────────────────────────────────
// One shared x-hover for the trend charts: index into the series under the cursor.
function useXHover(n: number) {
  const [idx, setIdx] = useState<number | null>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left) / Math.max(1, r.width);
    setIdx(Math.max(0, Math.min(n - 1, Math.round(f * (n - 1)))));
  };
  return { idx, onMove, onLeave: () => setIdx(null) };
}

// Date label for point i of an n-point series spanning the last 60 days.
function dayLabel(updated: string, n: number, i: number) {
  const d = new Date(updated + "T14:00:00");
  d.setDate(d.getDate() - Math.round((n - 1 - i) * (60 / Math.max(1, n - 1))));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase();
}

const seatNoun = (office: Office, n: number) =>
  office === "governor" ? (n === 1 ? "governorship" : "governorships") : n === 1 ? "seat" : "seats";

function SectionDistribution({ chamber, office, sims }: { chamber: ChamberT; office: Office; sims: number }) {
  // Democratic-seat control thresholds. Ties break Republican (the VP for the
  // Senate; the model's 18–18 convention for governorships), so D needs 51/19.
  const control = office === "house" ? 218 : office === "senate" ? 51 : 19;
  const total = chamber.seatsTotal;
  const binW = office === "house" ? 2 : 1;
  const { entries, median } = useMemo(() => {
    const raw = new Map<number, number>();
    for (const [rSeats, p] of chamber.hist) {
      const d = total - rSeats;
      raw.set(d, (raw.get(d) || 0) + p);
    }
    const sorted = [...raw.entries()].sort((a, b) => a[0] - b[0]);
    let cum = 0, median = sorted.length ? sorted[0][0] : 0;
    for (const [s, p] of sorted) { cum += p; if (cum >= 0.5) { median = s; break; } }
    // clip the 0.2% tails — outlier sims stretch the axis and flatten the shape
    let acc = 0; const kept: [number, number][] = [];
    for (const [s, p] of sorted) { acc += p; if (acc > 0.002 && acc - p < 0.998) kept.push([s, p]); }
    // bin (house outcomes are dense — 2-seat bins read cleaner)
    const m = new Map<number, number>();
    for (const [s, p] of kept) {
      const b = Math.floor(s / binW) * binW;
      m.set(b, (m.get(b) || 0) + p);
    }
    return { entries: [...m.entries()].sort((a, b) => a[0] - b[0]), median };
  }, [chamber, total, binW]);
  if (!entries.length) return null;

  const lo = entries[0][0], hi = entries[entries.length - 1][0] + binW - 1;
  const span = Math.max(1, hi - lo + 1);
  const maxP = Math.max(...entries.map((e) => e[1]));
  const W = 1080, H = 344, AXIS = 58, CH = H - AXIS;
  const x = (s: number) => ((s - lo + 0.5) / span) * W;
  const xBin = (b: number) => ((b - lo + binW / 2) / span) * W;
  const bw = Math.min(16, Math.max(2.5, (W / span) * binW * 0.66));
  const demP = chamber.demControl;
  const demRuns = Math.round(demP * sims), gopRuns = sims - demRuns;
  const dp = Math.round(demP * 100);
  const demLabel = dp > 99 ? ">99%" : dp < 1 ? "<1%" : `${dp}%`;
  const gopLabel = dp > 99 ? "<1%" : dp < 1 ? ">99%" : `${100 - dp}%`;
  const chamberNoun = office === "house" ? "House majority" : office === "senate" ? "Senate control" : "majority of governorships";
  const bx1 = x(chamber.demP10), bx2 = x(chamber.demP90);

  return (
    <section className="fc-sec fc-band">
      <div className="fc-shell">
        <Eyebrow>the distribution</Eyebrow>
        <h2 className="fc-h2">every way the {office === "house" ? "house" : office === "senate" ? "senate" : "map"} could go<em>.</em></h2>
        <p className="fc-body">
          {sims.toLocaleString()} full runs of the model this morning — every bar is a Democratic {office === "governor" ? "governorship" : "seat"} total
          the simulation landed on.{" "}
          {office === "senate"
            ? "Democrats need 51 — a 50–50 chamber stays Republican on the Vice President\u2019s tiebreak."
            : office === "governor"
              ? "The rule marks 19 of 36 — a majority of the governorships on the ballot plus the holdovers."
              : "The rule marks control — 218."}
        </p>

        <div className="fc-hist">
          <div className="fc-hist-anno gop">
            <b style={{ color: GOP }}>{gopLabel}</b>
            <span>Republican {chamberNoun}</span>
            <em>{gopRuns.toLocaleString()} of {sims.toLocaleString()} simulations</em>
          </div>
          <div className="fc-hist-anno dem">
            <b style={{ color: DEM }}>{demLabel}</b>
            <span>Democratic {chamberNoun}</span>
            <em>{demRuns.toLocaleString()} of {sims.toLocaleString()} simulations</em>
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="fc-hist-svg" role="img"
            aria-label={`Distribution of simulated Democratic ${seatNoun(office, 2)}`}>
            <defs>
              <linearGradient id="fcHistD" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={DEM} stopOpacity="1" />
                <stop offset="100%" stopColor={DEM} stopOpacity="0.55" />
              </linearGradient>
              <linearGradient id="fcHistR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOP} stopOpacity="1" />
                <stop offset="100%" stopColor={GOP} stopOpacity="0.55" />
              </linearGradient>
            </defs>
            <line x1="0" x2={W} y1={CH} y2={CH} stroke="rgba(244,244,239,0.14)" />
            {entries.map(([s, p]) => {
              const h = Math.max(1.5, (p / maxP) * (CH - 88));
              return (
                <rect key={s} x={xBin(s) - bw / 2} y={CH - h} width={bw} height={h} rx={bw > 4 ? 1.5 : 0.8}
                  fill={s + binW - 1 >= control ? "url(#fcHistD)" : "url(#fcHistR)"} className="fc-hist-bar" />
              );
            })}
            {/* control rule */}
            <line x1={x(control) - (W / span) * 0.5} x2={x(control) - (W / span) * 0.5} y1={26} y2={CH}
              stroke="rgba(244,244,239,0.4)" strokeDasharray="2 4" />
            {/* median marker */}
            {(() => {
              const bin = entries.find((e) => median >= e[0] && median < e[0] + binW);
              if (!bin) return null;
              const top = CH - (bin[1] / maxP) * (CH - 88) - 14;
              return (
                <g>
                  <path d={`M${xBin(bin[0]) - 5},${top} h10 l-5,7 z`} fill={INK} opacity="0.9" />
                  <text x={xBin(bin[0])} y={top - 8} textAnchor="middle" className="fc-hist-svglabel">median {median}</text>
                </g>
              );
            })()}
            {/* bottom values: bracket ends + the control line, dodging collisions */}
            {(() => {
              const xc = x(control) - (W / span) * 0.5;
              const out = [
                { v: control, px: xc, fill: "rgba(244,244,239,0.75)", key: "c" },
              ];
              if (Math.abs(bx1 - xc) > 40) out.push({ v: chamber.demP10, px: bx1, fill: chamber.demP10 >= control ? DEM : GOP, key: "a" });
              if (Math.abs(bx2 - xc) > 40) out.push({ v: chamber.demP90, px: bx2, fill: chamber.demP90 >= control ? DEM : GOP, key: "b" });
              return out.map((t) => (
                <text key={t.key} x={t.px} y={CH + 46} textAnchor="middle" className="fc-hist-svglabel side" fill={t.fill}>{t.v}</text>
              ));
            })()}
            {/* 80% bracket */}
            <line x1={bx1} x2={bx2} y1={CH + 24} y2={CH + 24} stroke="rgba(244,244,239,0.35)" />
            <line x1={bx1} x2={bx1} y1={CH + 20} y2={CH + 28} stroke="rgba(244,244,239,0.35)" />
            <line x1={bx2} x2={bx2} y1={CH + 20} y2={CH + 28} stroke="rgba(244,244,239,0.35)" />
          </svg>

          <span className="fc-hist-rulelabel" style={{ left: `${((x(control) - (W / span) * 0.5) / W) * 100}%` }}>
            {office === "senate" ? "51 — vp breaks 50\u201350 gop" : `${control} to control`}
          </span>
          <div className="fc-hist-bracket" style={{ left: `${(((bx1 + bx2) / 2) / W) * 100}%` }}>
            the bracket holds the middle 80% of {sims.toLocaleString()} simulations —{" "}
            <b style={{ color: chamber.demP10 >= control ? DEM : GOP }}>{chamber.demP10}</b> to{" "}
            <b style={{ color: chamber.demP90 >= control ? DEM : GOP }}>{chamber.demP90}</b> democratic {seatNoun(office, 2)}
          </div>
        </div>
      </div>
    </section>
  );
}

function chartPath(pts: number[], W: number, H: number, min: number, max: number) {
  const span = Math.max(1e-9, max - min);
  return pts.map((v, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * W).toFixed(1)},${(H - ((v - min) / span) * H).toFixed(1)}`).join("");
}

function SectionSeats({ chamber, office, updated }: { chamber: ChamberT; office: Office; updated: string }) {
  const W = 1080, H = 280;
  const dem = chamber.trend.map((t) => t.demSeats);
  const gop = chamber.trend.map((t) => chamber.seatsTotal - t.demSeats);
  const n = dem.length;
  const hover = useXHover(n);
  const bandHalf = Math.max(2, (chamber.demP90 - chamber.demP10) / 2);
  const all = [...dem, ...gop];
  const min = Math.min(...all) - bandHalf - 4, max = Math.max(...all) + bandHalf + 4;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const band = (pts: number[]) =>
    pts.map((v, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * W).toFixed(1)},${y(v + bandHalf).toFixed(1)}`).join("") +
    [...pts].reverse().map((v, i) => `L${(((pts.length - 1 - i) / (pts.length - 1)) * W).toFixed(1)},${y(v - bandHalf).toFixed(1)}`).join("") + "Z";
  const control = office === "house" ? 218 : office === "senate" ? 50 : 18;
  const hi = hover.idx;

  return (
    <section className="fc-sec">
      <div className="fc-shell">
        <Eyebrow>expected seats</Eyebrow>
        <h2 className="fc-h2">the {office === "governor" ? "map" : "seat count"}, day by day<em>.</em></h2>
        <p className="fc-body">Daily model average; the shaded band holds 80% of simulations.</p>
        <div className="fc-chartwrap" onMouseMove={hover.onMove} onMouseLeave={hover.onLeave}>
          <svg viewBox={`0 0 ${W} ${H}`} className="fc-chart" role="img" aria-label="Expected seats trend" preserveAspectRatio="none">
            <defs>
              <linearGradient id="fcBandD" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={DEM} stopOpacity="0.16" />
                <stop offset="100%" stopColor={DEM} stopOpacity="0.03" />
              </linearGradient>
              <linearGradient id="fcBandR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOP} stopOpacity="0.16" />
                <stop offset="100%" stopColor={GOP} stopOpacity="0.03" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(244,244,239,0.04)" />
            ))}
            <path d={band(dem)} fill="url(#fcBandD)" />
            <path d={band(gop)} fill="url(#fcBandR)" />
            {control >= min && control <= max ? (
              <line x1="0" x2={W} y1={y(control)} y2={y(control)} stroke="rgba(244,244,239,0.28)" strokeDasharray="3 5" />
            ) : null}
            <path d={chartPath(dem, W, H, min, max)} fill="none" stroke={DEM} strokeWidth="2.4" />
            <path d={chartPath(gop, W, H, min, max)} fill="none" stroke={GOP} strokeWidth="2.4" />
            {hi != null ? (
              <g>
                <line x1={(hi / (n - 1)) * W} x2={(hi / (n - 1)) * W} y1={0} y2={H} stroke="rgba(244,244,239,0.28)" />
                <circle cx={(hi / (n - 1)) * W} cy={y(dem[hi])} r="4.5" fill={DEM} stroke="#050505" strokeWidth="1.5" />
                <circle cx={(hi / (n - 1)) * W} cy={y(gop[hi])} r="4.5" fill={GOP} stroke="#050505" strokeWidth="1.5" />
              </g>
            ) : (
              <g>
                <circle cx={W} cy={y(dem[n - 1])} r="4" fill={DEM} />
                <circle cx={W} cy={y(gop[n - 1])} r="4" fill={GOP} />
              </g>
            )}
          </svg>
          {control >= min && control <= max ? (
            <span className="fc-chart-tag" style={{ top: `${(y(control) / H) * 100}%` }}>{office === "senate" ? "50 + vp" : `${control} to control`}</span>
          ) : null}
          <div className="fc-chart-ends">
            <span style={{ color: DEM, top: `${(y(dem[n - 1]) / H) * 100}%` }}>{chamber.demSeats.toFixed(1)}</span>
            <span style={{ color: GOP, top: `${(y(gop[n - 1]) / H) * 100}%` }}>{chamber.gopSeats.toFixed(1)}</span>
          </div>
          {hi != null ? (
            <div className="fc-xhair" style={{ left: `${(hi / (n - 1)) * 100}%`, transform: hi / (n - 1) > 0.72 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}>
              <em>{dayLabel(updated, n, hi)}</em>
              <span style={{ color: DEM }}>D {dem[hi].toFixed(1)}</span>
              <span style={{ color: GOP }}>R {gop[hi].toFixed(1)}</span>
            </div>
          ) : null}
        </div>
        <div className="fc-chart-x"><span>sixty days ago</span><span>today · {dayLabel(updated, n, n - 1)}</span></div>
      </div>
    </section>
  );
}

function SectionProbability({ chamber, office, updated }: { chamber: ChamberT; office: Office; updated: string }) {
  const W = 1080, H = 250;
  const dem = chamber.trend.map((t) => t.dem * 100);
  const gop = dem.map((v) => 100 - v);
  const n = dem.length;
  const hover = useXHover(n);
  const y = (v: number) => H - (v / 100) * H;
  const area = (pts: number[]) => `${chartPath(pts, W, H, 0, 100)}L${W},${H}L0,${H}Z`;
  const hi = hover.idx;

  return (
    <section className="fc-sec">
      <div className="fc-shell">
        <Eyebrow live>the probability</Eyebrow>
        <h2 className="fc-h2">each side&rsquo;s chance of {office === "house" ? "the majority" : office === "senate" ? "the chamber" : "the map"}<em>.</em></h2>
        <div className="fc-chartwrap" onMouseMove={hover.onMove} onMouseLeave={hover.onLeave}>
          <svg viewBox={`0 0 ${W} ${H}`} className="fc-chart" role="img" aria-label="Win probability trend" preserveAspectRatio="none">
            <defs>
              <linearGradient id="fcProbD" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={DEM} stopOpacity="0.22" />
                <stop offset="55%" stopColor={DEM} stopOpacity="0.04" />
                <stop offset="100%" stopColor={DEM} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="fcProbR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOP} stopOpacity="0.22" />
                <stop offset="55%" stopColor={GOP} stopOpacity="0.04" />
                <stop offset="100%" stopColor={GOP} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[25, 75].map((g) => (
              <line key={g} x1="0" x2={W} y1={y(g)} y2={y(g)} stroke="rgba(244,244,239,0.05)" />
            ))}
            <line x1="0" x2={W} y1={y(50)} y2={y(50)} stroke="rgba(244,244,239,0.24)" strokeDasharray="3 5" />
            <path d={area(dem)} fill="url(#fcProbD)" />
            <path d={area(gop)} fill="url(#fcProbR)" />
            <path d={chartPath(dem, W, H, 0, 100)} fill="none" stroke={DEM} strokeWidth="2.4" />
            <path d={chartPath(gop, W, H, 0, 100)} fill="none" stroke={GOP} strokeWidth="2.4" />
            {hi != null ? (
              <g>
                <line x1={(hi / (n - 1)) * W} x2={(hi / (n - 1)) * W} y1={0} y2={H} stroke="rgba(244,244,239,0.28)" />
                <circle cx={(hi / (n - 1)) * W} cy={y(dem[hi])} r="4.5" fill={DEM} stroke="#050505" strokeWidth="1.5" />
                <circle cx={(hi / (n - 1)) * W} cy={y(gop[hi])} r="4.5" fill={GOP} stroke="#050505" strokeWidth="1.5" />
              </g>
            ) : (
              <g>
                <circle cx={W} cy={y(dem[n - 1])} r="4" fill={DEM} />
                <circle cx={W} cy={y(gop[n - 1])} r="4" fill={GOP} />
              </g>
            )}
          </svg>
          <span className="fc-chart-tag" style={{ top: `${(y(50) / H) * 100}%` }}>even odds</span>
          <div className="fc-chart-ends">
            <span style={{ color: DEM, top: `${(y(dem[n - 1]) / H) * 100}%` }}>{dem[n - 1].toFixed(1)}%</span>
            <span style={{ color: GOP, top: `${(y(gop[n - 1]) / H) * 100}%` }}>{gop[n - 1].toFixed(1)}%</span>
          </div>
          {hi != null ? (
            <div className="fc-xhair" style={{ left: `${(hi / (n - 1)) * 100}%`, transform: hi / (n - 1) > 0.72 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}>
              <em>{dayLabel(updated, n, hi)}</em>
              <span style={{ color: DEM }}>D {dem[hi].toFixed(1)}%</span>
              <span style={{ color: GOP }}>R {gop[hi].toFixed(1)}%</span>
            </div>
          ) : null}
        </div>
        <div className="fc-chart-x"><span>sixty days ago</span><span>today</span></div>
      </div>
    </section>
  );
}

// ── races table ──────────────────────────────────────────────────────────────
function RaceTable({ rows, mk, onPick }: { rows: Race[]; mk: ModelKey; onPick: (id: string) => void }) {
  return (
    <div className="fc-table" role="table" aria-label="Race outlooks">
      <div className="fc-tr fc-th" role="row">
        <span role="columnheader">race</span>
        <span role="columnheader">candidates</span>
        <span role="columnheader" className="num">margin</span>
        <span role="columnheader" aria-hidden />
        <span role="columnheader" className="num">win prob.</span>
        <span role="columnheader">rating</span>
        <span role="columnheader">trend</span>
      </div>
      {rows.map((r) => {
        const s = r[mk];
        const fav = s.margin > 0 ? "gop" : "dem";
        const tone = fav === "gop" ? GOP : DEM;
        const favProb = fav === "gop" ? s.prob : 1 - s.prob;
        const rt = ratingFor(s.margin);
        return (
          <button key={r.id} className="fc-tr" role="row" onClick={() => onPick(r.id)}>
            <span role="cell" className="fc-td-name">
              <b>{r.name}</b>
              <em>{r.marquee ? "marquee · " : ""}{r.open ? "open seat" : "incumbent running"}</em>
            </span>
            <span role="cell" className="fc-td-cands">
              <span><i className="d">D</i>{r.dem}</span>
              <span><i className="r">R</i>{r.gop}</span>
            </span>
            <span role="cell" className="fc-td-margin num" style={{ color: tone }}>{fmtMargin(s.margin)}</span>
            <span role="cell" className="fc-td-bar"><MarginBar m={s.margin} p10={s.p10} p90={s.p90} /></span>
            <span role="cell" className="fc-td-prob num">{fmtPct(favProb, 1)}</span>
            <span role="cell"><i className="fc-rating" style={{ color: rt.color, borderColor: `${rt.color}77`, background: `${rt.color}1f` }}>{rt.cat}</i></span>
            <span role="cell"><Spark pts={r.trend[mk].map((t) => 100 - t.p * 100)} color={tone} /></span>
          </button>
        );
      })}
    </div>
  );
}

// ── the outcome distribution: what the simulations actually drew ─────────────
function OutcomeDist({ race, s, sims }: { race: Race; s: RaceSide; sims: number }) {
  const W = 1080, H = 250, AXIS = 30, CH = H - AXIS;
  const LO = -40, HI = 40;
  const xOf = (v: number) => ((Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO)) * W;

  // Density over the margin axis. Real per-race sim histogram when the build
  // emits one; a p10/p90-matched two-sided normal otherwise.
  const pts = useMemo(() => {
    if (s.dist && s.dist.c.length > 2) {
      const { lo, w, c } = s.dist;
      const sm = c.map((v, i) => (c[i - 1] ?? 0) * 0.25 + v * 0.5 + (c[i + 1] ?? 0) * 0.25);
      const max = Math.max(1, ...sm);
      return sm.map((v, i) => ({ x: lo + (i + 0.5) * w, y: v / max }));
    }
    const z = 1.2816;
    const sL = Math.max(1.5, (s.margin - s.p10) / z), sR = Math.max(1.5, (s.p90 - s.margin) / z);
    return Array.from({ length: 121 }, (_, i) => {
      const x = LO + (i / 120) * (HI - LO);
      const sd = x < s.margin ? sL : sR;
      return { x, y: Math.exp(-0.5 * ((x - s.margin) / sd) ** 2) };
    });
  }, [s]);

  const yOf = (v: number) => 20 + (1 - v) * (CH - 24);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${xOf(p.x).toFixed(1)},${yOf(p.y).toFixed(1)}`).join("");
  const area = `${line}L${xOf(pts[pts.length - 1].x).toFixed(1)},${CH}L${xOf(pts[0].x).toFixed(1)},${CH}Z`;
  const fav = s.margin > 0 ? race.gop : race.dem;
  const tone = s.margin > 0 ? GOP : DEM;
  const medianX = xOf(s.margin);

  return (
    <div className="fc-outcome">
      <div className="fc-outcome-h">
        <span>the range of outcomes</span>
        <span>{sims.toLocaleString()} simulated two-party margins</span>
      </div>
      <div className="fc-outcome-chart">
        <svg viewBox={`0 0 ${W} ${H}`} className="fc-chart" role="img" aria-label="Simulated margin distribution" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fcOdD" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={DEM} stopOpacity="0.5" />
              <stop offset="100%" stopColor={DEM} stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="fcOdR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOP} stopOpacity="0.5" />
              <stop offset="100%" stopColor={GOP} stopOpacity="0.04" />
            </linearGradient>
            <clipPath id="fcOdClipD"><rect x="0" y="0" width={xOf(0)} height={CH} /></clipPath>
            <clipPath id="fcOdClipR"><rect x={xOf(0)} y="0" width={W - xOf(0)} height={CH} /></clipPath>
          </defs>
          <line x1="0" x2={W} y1={CH} y2={CH} stroke="rgba(244,244,239,0.14)" />
          <path d={area} fill="url(#fcOdD)" clipPath="url(#fcOdClipD)" />
          <path d={area} fill="url(#fcOdR)" clipPath="url(#fcOdClipR)" />
          <path d={line} fill="none" stroke="rgba(244,244,239,0.4)" strokeWidth="1.4" />
          {/* even line */}
          <line x1={xOf(0)} x2={xOf(0)} y1={14} y2={CH} stroke="rgba(244,244,239,0.3)" strokeDasharray="2 4" />
          {/* 80% interval ticks */}
          {[s.p10, s.p90].map((v, i) => (
            <line key={i} x1={xOf(v)} x2={xOf(v)} y1={CH - 12} y2={CH} stroke="rgba(244,244,239,0.5)" strokeWidth="1.4" />
          ))}
          {/* median needle */}
          <line x1={medianX} x2={medianX} y1={8} y2={CH} stroke={tone} strokeWidth="2.2"
            style={{ filter: `drop-shadow(0 0 8px ${tone}aa)` }} />
        </svg>
        <span className="fc-outcome-median" style={{
          left: `${(medianX / W) * 100}%`, color: tone,
          transform: medianX / W > 0.8 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
        }}>
          {surname(fav)} +{Math.abs(s.margin).toFixed(1)}
        </span>
        {[s.p10, s.p90].map((v, i) => (
          <span key={i} className="fc-outcome-tick" style={{ left: `${(xOf(v) / W) * 100}%`, color: v > 0 ? GOP : DEM }}>{fmtMargin(v)}</span>
        ))}
        <div className="fc-outcome-axis">
          {[-30, -15, 0, 15, 30].map((v) => (
            <span key={v} style={{ left: `${(xOf(v) / W) * 100}%`, color: v === 0 ? "rgba(244,244,239,0.45)" : v > 0 ? GOP : DEM }}>
              {v === 0 ? "even" : v > 0 ? `R+${v}` : `D+${-v}`}
            </span>
          ))}
        </div>
      </div>
      <div className="fc-outcome-note">
        the ticks bracket the middle 80% of simulations — <b style={{ color: s.p10 > 0 ? GOP : DEM }}>{fmtMargin(s.p10)}</b> to{" "}
        <b style={{ color: s.p90 > 0 ? GOP : DEM }}>{fmtMargin(s.p90)}</b>
      </div>
    </div>
  );
}

// ── the estimate waterfall: each methodology layer pulls the number ──────────
function StageFlow({ race, mk, env, sims }: {
  race: Race; mk: ModelKey; env: { npe: number; gb: number; approval: number }; sims: number;
}) {
  const st = race.stages;
  const complete = mk === "complete";
  const s = race[mk];
  const wMkt = complete && race.market ? race.wMkt : 0;
  const pollShare = Math.round((race.pollAvg != null ? race.wPoll : 0) * (1 - wMkt) * 100);
  const mktShare = Math.round(wMkt * 100);
  const fundShare = Math.max(0, 100 - pollShare - mktShare);

  const final = complete ? st.market : st.poll;
  const fav = final > 0 ? race.gop : race.dem;
  const tone = final > 0 ? GOP : DEM;
  const favProb = s.margin > 0 ? s.prob : 1 - s.prob;
  const mktFav = race.market ? (race.market.q > 0.5 ? race.gop : race.dem) : null;

  type Row = { k: string; v: number; on: boolean; carry?: string; cap: React.ReactNode };
  const rows: Row[] = [
    {
      k: "the anchor", v: st.anchor, on: true,
      cap: <>presidential lean <b style={{ color: st.anchor > 0 ? GOP : DEM }}>{fmtMargin(st.anchor)}</b> — the last two presidential results, candidate record priced in</>,
    },
    {
      k: "the environment", v: st.fund, on: true, carry: `${fundShare}%`,
      cap: <>a <b style={{ color: env.npe > 0 ? GOP : DEM }}>{env.npe > 0 ? `R+${Math.abs(env.npe).toFixed(1)}` : `D+${Math.abs(env.npe).toFixed(1)}`}</b> national
        environment lands through ×{race.elast.toFixed(2)} elasticity · {race.open ? "open seat" : "incumbent running"}</>,
    },
    {
      k: "the polls", v: st.poll, on: true, carry: `${pollShare}%`,
      cap: race.pollAvg != null
        ? <>{race.enop.toFixed(1)} effective polls averaging <b style={{ color: race.pollAvg > 0 ? GOP : DEM }}>{fmtMargin(race.pollAvg)}</b> · weights decay with age and pollster record</>
        : <>no usable polling — the fundamentals carry through untouched</>,
    },
    {
      k: "expert ratings", v: st.rate, on: complete,
      cap: complete ? (
        <>
          <span className="fc-flow-chips">
            {race.ratings.map((rt) => {
              const band = RATING_BANDS.find((b) => b.cat.toLowerCase() === rt.cat.toLowerCase());
              const c = band ? band.color : "rgba(244,244,239,0.6)";
              return <i key={rt.outlet} className="fc-rating" style={{ color: c, borderColor: `${c}77`, background: `${c}1f` }}>{rt.cat}<u>{rt.outlet}</u></i>;
            })}
          </span>
          guardrails — they pull only when the estimate drifts outside the category
        </>
      ) : null,
    },
    {
      k: "the market", v: st.market, on: complete,
      carry: complete && mktShare ? `${mktShare}%` : undefined,
      cap: complete
        ? race.market
          ? <><b style={{ color: race.market.q > 0.5 ? GOP : DEM }}>{fmtPct(Math.max(race.market.q, 1 - race.market.q), 0)}</b> implied {surname(mktFav!)} · liquidity {(race.market.liquidity * 100).toFixed(0)} · trade-vs-book λ blend</>
          : <>no usable order book — the estimate passes through</>
        : null,
    },
  ];

  // shared window around the action, so each pull is readable
  const active = rows.filter((r) => r.on).map((r) => r.v).concat([final]);
  let lo = Math.min(...active) - 4, hi = Math.max(...active) + 4;
  if (hi - lo < 12) { const mid = (hi + lo) / 2; lo = mid - 6; hi = mid + 6; }
  lo = Math.max(-48, lo); hi = Math.min(48, hi);
  const x = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100;
  const zeroIn = lo < 0 && hi > 0;
  let prev: number | null = null;

  return (
    <div className="fc-flow">
      <div className="fc-flow-scalehead">
        <span className="fc-flow-k head">how the number gets made</span>
        <span className="fc-flow-window">
          <b style={{ color: lo > 0 ? GOP : DEM }}>{fmtMargin(lo)}</b>
          <i />
          <b style={{ color: hi > 0 ? GOP : DEM }}>{fmtMargin(hi)}</b>
        </span>
      </div>

      {rows.map((row, i) => {
        const from = prev;
        if (row.on) prev = row.v;
        const moved = from != null && Math.abs(row.v - from) >= 0.05;
        // connector occupies the side toward the previous value — label takes the other
        const labelLeft = moved ? row.v < from! : x(row.v) > 82;
        return (
          <div key={row.k} className={`fc-flow-row${row.on ? "" : " off"}`}>
            <div className="fc-flow-left">
              <span className="fc-flow-k">
                <i className="fc-flow-num">{String(i + 1).padStart(2, "0")}</i>
                {row.k}
                {row.on && row.carry ? <em className="fc-flow-carry">carries {row.carry}</em> : null}
              </span>
              <p className="fc-flow-cap">
                {row.on ? row.cap : "complete model only — the legacy model stops at the polls"}
              </p>
            </div>
            <div className="fc-flow-track" aria-hidden={!row.on}>
              {zeroIn ? <i className="fc-flow-even" style={{ left: `${x(0)}%` }} /> : null}
              {row.on && from != null ? (
                <>
                  <i className="fc-flow-link" style={{
                    left: `${Math.min(x(from), x(row.v))}%`,
                    width: `${Math.max(0.2, Math.abs(x(from) - x(row.v)))}%`,
                  }} />
                  <i className="fc-flow-ghost" style={{ left: `${x(from)}%` }} />
                </>
              ) : null}
              {row.on ? (
                <>
                  <i className="fc-flow-dot" style={{ left: `${x(row.v)}%`, background: row.v > 0 ? GOP : DEM }} />
                  <b className="fc-flow-val" style={{
                    left: `${x(row.v)}%`, color: row.v > 0 ? GOP : DEM,
                    transform: labelLeft ? "translate(calc(-100% - 9px), -50%)" : "translate(9px, -50%)",
                  }}>
                    {fmtMargin(row.v)}{moved ? <em> {row.v < from! ? "←" : "→"} {Math.abs(row.v - from!).toFixed(1)}</em> : null}
                  </b>
                </>
              ) : null}
            </div>
          </div>
        );
      })}

      <div className="fc-flow-row final">
        <div className="fc-flow-left">
          <span className="fc-flow-k final">the estimate</span>
          <p className="fc-flow-cap">{mk === "complete" ? "all six stages" : "stages one and two — the legacy model"} · {sims.toLocaleString()} simulations run on it today</p>
        </div>
        <div className="fc-flow-track final">
          {zeroIn ? <i className="fc-flow-even" style={{ left: `${x(0)}%` }} /> : null}
          <i className="fc-flow-dot final" style={{ left: `${x(final)}%`, background: tone, boxShadow: `0 0 14px ${tone}aa` }} />
          <b className="fc-flow-val final" style={{
            left: `${x(final)}%`, color: tone,
            transform: x(final) > 70 ? "translate(calc(-100% - 11px), -50%)" : "translate(11px, -50%)",
          }}>
            {fmtMargin(final)} <em>· {surname(fav)} {fmtPct(favProb)} to win</em>
          </b>
        </div>
      </div>
    </div>
  );
}

// ── selected-race sections ───────────────────────────────────────────────────
function RaceSections({ race, mk, byId, onPick, sims, updated, env }: {
  race: Race; mk: ModelKey; byId: Map<string, Race>; onPick: (id: string) => void; sims: number; updated: string;
  env: { npe: number; gb: number; approval: number };
}) {
  const s = race[mk];
  const demProb = 1 - s.prob;
  const trend = race.trend[mk];
  const W = 1080, H = 220;
  const demPts = trend.map((t) => (1 - t.p) * 100);
  const y = (v: number) => H - (v / 100) * H;
  const thover = useXHover(demPts.length);
  const ti = thover.idx;

  return (
    <>
      {/* the odds */}
      <section className="fc-sec">
        <div className="fc-shell">
          <Eyebrow live>the odds</Eyebrow>
          <h2 className="fc-h2">where the race stands today<em>.</em></h2>
          <div className="fc-odds">
            <div className="fc-score">
              {(() => {
                const dpp = Math.round(demProb * 100);
                const dLab = dpp > 99 ? ">99%" : dpp < 1 ? "<1%" : `${dpp}%`;
                const rLab = dpp > 99 ? "<1%" : dpp < 1 ? ">99%" : `${100 - dpp}%`;
                return [
                  { name: race.dem, party: "D", tone: DEM, prob: demProb, label: dLab, margin: -s.margin },
                  { name: race.gop, party: "R", tone: GOP, prob: s.prob, label: rLab, margin: s.margin },
                ].sort((a, b) => b.prob - a.prob);
              })().map((c) => (
                <div key={c.party} className="fc-score-row">
                  <div className="fc-score-id">
                    <b>{c.name}</b>
                    <em>{c.party === "D" ? "Democrat" : "Republican"}
                      {!race.open && ((c.party === "D" && race.inc < 0) || (c.party === "R" && race.inc > 0)) ? " · incumbent" : ""}
                      {" · "}{c.margin > 0 ? "+" : ""}{c.margin.toFixed(1)} expected</em>
                  </div>
                  <b className="fc-score-p" style={{ color: c.tone }}>{c.label}</b>
                </div>
              ))}
              <div className="fc-h2h" role="img" aria-label="Head-to-head win probability">
                <i style={{ width: `${demProb * 100}%` }} />
                <span className="fc-h2h-notch" />
              </div>
              <div className="fc-h2h-x"><span style={{ color: DEM }}>{surname(race.dem)}</span><span style={{ color: GOP }}>{surname(race.gop)}</span></div>
            </div>
            <div className="fc-odds-dial">
              <SwingOMeter
                c1Name={race.dem} c2Name={race.gop}
                c1Color={DEM} c2Color={GOP}
                c1Prob={demProb} c2Prob={s.prob}
                reportingPct={0}
                marginPp={Math.abs(s.margin)}
                fixedOrientation
              />
            </div>
          </div>
          <OutcomeDist race={race} s={s} sims={sims} />
        </div>
      </section>

      {/* the tracker */}
      <section className="fc-sec">
        <div className="fc-shell">
          <Eyebrow>the tracker</Eyebrow>
          <h2 className="fc-h2">sixty days of this race<em>.</em></h2>
          <div className="fc-chartwrap" onMouseMove={thover.onMove} onMouseLeave={thover.onLeave}>
            <svg viewBox={`0 0 ${W} ${H}`} className="fc-chart" role="img" aria-label="Race win-probability trend" preserveAspectRatio="none">
              <line x1="0" x2={W} y1={y(50)} y2={y(50)} stroke="rgba(244,244,239,0.22)" strokeDasharray="3 5" />
              <path d={`${chartPath(demPts, W, H, 0, 100)}L${W},${H}L0,${H}Z`} fill={DEM} opacity="0.07" />
              <path d={chartPath(demPts, W, H, 0, 100)} fill="none" stroke={DEM} strokeWidth="2.4" />
              <path d={chartPath(demPts.map((v) => 100 - v), W, H, 0, 100)} fill="none" stroke={GOP} strokeWidth="2.4" />
              {ti != null ? (
                <g>
                  <line x1={(ti / (demPts.length - 1)) * W} x2={(ti / (demPts.length - 1)) * W} y1={0} y2={H} stroke="rgba(244,244,239,0.28)" />
                  <circle cx={(ti / (demPts.length - 1)) * W} cy={y(demPts[ti])} r="4.5" fill={DEM} stroke="#050505" strokeWidth="1.5" />
                  <circle cx={(ti / (demPts.length - 1)) * W} cy={y(100 - demPts[ti])} r="4.5" fill={GOP} stroke="#050505" strokeWidth="1.5" />
                </g>
              ) : (
                <g>
                  <circle cx={W} cy={y(demPts[demPts.length - 1])} r="4" fill={DEM} />
                  <circle cx={W} cy={y(100 - demPts[demPts.length - 1])} r="4" fill={GOP} />
                </g>
              )}
            </svg>
            <span className="fc-chart-tag" style={{ top: `${(y(50) / H) * 100}%` }}>even odds</span>
            <div className="fc-chart-ends">
              <span style={{ color: DEM, top: `${(y(demPts[demPts.length - 1]) / H) * 100}%` }}>{surname(race.dem)} {fmtPct(demProb)}</span>
              <span style={{ color: GOP, top: `${(y(100 - demPts[demPts.length - 1]) / H) * 100}%` }}>{surname(race.gop)} {fmtPct(s.prob)}</span>
            </div>
            {ti != null ? (
              <div className="fc-xhair" style={{ left: `${(ti / (demPts.length - 1)) * 100}%`, transform: ti / (demPts.length - 1) > 0.72 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}>
                <em>{dayLabel(updated, demPts.length, ti)}</em>
                <span style={{ color: DEM }}>{surname(race.dem)} {demPts[ti].toFixed(0)}%</span>
                <span style={{ color: GOP }}>{surname(race.gop)} {(100 - demPts[ti]).toFixed(0)}%</span>
              </div>
            ) : null}
          </div>
          <div className="fc-chart-x"><span>sixty days ago</span><span>today</span></div>
        </div>
      </section>

      {/* the inputs */}
      <section className="fc-sec">
        <div className="fc-shell">
          <Eyebrow>the inputs</Eyebrow>
          <h2 className="fc-h2">what the model is looking at<em>.</em></h2>
          <div className="fc-envchips" role="list" aria-label="The national environment">
            <span role="listitem">national environment <b style={{ color: env.npe > 0 ? GOP : DEM }}>{env.npe > 0 ? "R" : "D"}+{Math.abs(env.npe).toFixed(1)}</b></span>
            <span role="listitem">generic ballot <b style={{ color: env.gb > 0 ? GOP : DEM }}>{env.gb > 0 ? "R" : "D"}+{Math.abs(env.gb).toFixed(1)}</b></span>
            <span role="listitem">net approval <b style={{ color: GOP }}>{env.approval}</b></span>
            <span role="listitem"><b className="lime">{sims.toLocaleString()}</b> sims run today</span>
          </div>
          <StageFlow race={race} mk={mk} env={env} sims={sims} />

          {race.polls.length ? (
            <div className="fc-polls">
              <div className="fc-polls-h"><span>latest polls</span><span>weighted by recency · pollster record · sponsorship</span></div>
              {race.polls.map((p, i) => (
                <div key={i} className="fc-poll">
                  <b>{p.pollster}{p.grade ? <i className="fc-grade">{p.grade}</i> : null}</b>
                  <i className={`fc-kind ${p.kind !== "public" ? "flag" : ""}`}>{p.kind}</i>
                  <span>{p.age}d ago · n={p.n}</span>
                  <em style={{ color: p.margin > 0 ? GOP : DEM }}>{fmtMargin(p.margin)}</em>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* moves with */}
      <section className="fc-sec last">
        <div className="fc-shell">
          <Eyebrow>moves with</Eyebrow>
          <h2 className="fc-h2">races correlated with this one<em>.</em></h2>
          <p className="fc-body">Shared national, regional, and state shocks tie outcomes together — when this race moves, these tend to move too. ρ is the correlation of simulated outcomes between the two races.</p>
          <div className="fc-similar">
            {race.similar.slice(0, 10).map((sim) => {
              const other = byId.get(sim.id);
              if (!other) return null;
              const so = other[mk];
              return (
                <button key={sim.id} className="fc-simchip" onClick={() => onPick(sim.id)}>
                  <b>{other.name}</b>
                  <span style={{ color: so.margin > 0 ? GOP : DEM }}>{fmtMargin(so.margin)}</span>
                  <em>ρ {sim.corr.toFixed(2)}</em>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap');

html, body { background: #050505 !important; }
html { height: auto !important; overflow-y: auto !important; }
body { height: auto !important; min-height: 100svh; overflow: visible !important; overflow-x: clip !important; }
body header:not(.fc-head), body footer { display: none !important; }
body main > div { max-width: none !important; padding-left: 0 !important; padding-right: 0 !important; }
body main > div > div { padding-top: 0 !important; padding-bottom: 0 !important; }

.fc-page { position: relative; min-height: 100svh; color: #f4f4ef; background: #050505; overflow-x: clip;
  font-family: var(--font-mp), "Manrope", "Helvetica Neue", Arial, sans-serif; font-size: 15px; letter-spacing: -0.01em;
  width: 100vw; margin-left: calc(50% - 50vw); }
.fc-page h1, .fc-page h2, .fc-page h3 { text-transform: none; margin: 0; font-family: var(--font-mp), "Manrope", "Helvetica Neue", Arial, sans-serif; font-weight: 500; letter-spacing: -0.02em; }
.fc-shell { position: relative; z-index: 2; max-width: 1180px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 44px); }
.fc-grain { position: fixed; inset: -40px; z-index: 3; pointer-events: none; opacity: 0.045; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E"); }

.fc-loading { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 70svh; color: rgba(244,244,239,0.55); font-size: 14px; }
.fc-loading span, .fc-map-loading span { width: 8px; height: 8px; border-radius: 99px; background: #b7ff00; animation: fcPulse 1.4s ease-in-out infinite; }
.fc-loading em, .fc-map-loading em { font-style: normal; }
@keyframes fcPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }

.fc-eyebrow { display: inline-flex; align-items: center; gap: 9px; font-family: ${MONO}; font-size: 11.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.5); }
.fc-eyebrow-mk { width: 7px; height: 7px; background: #b7ff00; border-radius: 1.5px; flex-shrink: 0; }
.fc-eyebrow-pip { width: 6px; height: 6px; border-radius: 99px; background: #e23950; box-shadow: 0 0 0 3px rgba(226,57,80,0.16); animation: fcPulse 1.8s ease-in-out infinite; }
.fc-h2 { font-size: clamp(26px, 3.4vw, 42px); font-weight: 500; letter-spacing: -0.03em; line-height: 1.06; text-transform: lowercase; color: #f4f4ef; margin-top: 14px; }
.fc-h2 em, .fc-h1 em { font-style: normal; color: #b7ff00; }
.fc-body { margin-top: 14px; max-width: 56ch; font-size: 15px; line-height: 1.6; color: rgba(244,244,239,0.58); }

.fc-status { position: sticky; top: 0; z-index: 40; background: rgba(5,5,5,0.82); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.07); }
.fc-status-in { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px clamp(20px,4vw,44px); font-size: 10.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.42); }
.fc-status-in em { font-style: normal; color: rgba(244,244,239,0.22); margin: 0 6px; }
.fc-pip { display: inline-block; width: 6px; height: 6px; border-radius: 99px; background: #e23950; margin-right: 7px; animation: fcPulse 1.8s ease-in-out infinite; }

.fc-head { max-width: 980px; margin: clamp(34px, 6vh, 64px) auto 0; padding: 0 clamp(20px,4vw,44px); text-align: center; }
.fc-h1 { margin-top: 18px; font-size: clamp(34px, 4.6vw, 58px); font-weight: 500; letter-spacing: -0.035em; line-height: 1.08; text-transform: lowercase; color: #f4f4ef; }
.fc-h1 b { font-weight: 800; }
.fc-updated { margin-top: 16px; font-family: ${MONO}; font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.4); }
.fc-envline { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; margin-top: 12px; font-size: 13px; font-weight: 500; color: rgba(244,244,239,0.5); }
.fc-envline b { font-weight: 800; font-variant-numeric: tabular-nums; }
.fc-envline em { font-style: normal; color: rgba(244,244,239,0.2); }

.fc-seatbar { max-width: 980px; margin: clamp(26px, 4.4vh, 44px) auto 0; }
.fc-seatbar-ends { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 15px; font-weight: 600; }
.fc-seatbar-ends b { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
.fc-seatbar-mid { font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244,244,239,0.35); }
.fc-seatbar-track { position: relative; height: 12px; margin-top: 10px; border-radius: 99px; overflow: hidden; background: linear-gradient(90deg, #b62c3c, #a01426); }
.fc-seatbar-fill { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #183685, #3b6fde); }
.fc-seatbar-tick { position: absolute; top: -2px; bottom: -2px; width: 2.5px; background: #f4f4ef; box-shadow: 0 0 8px rgba(0,0,0,0.8); }
.fc-seatbar-note { margin-top: 8px; text-align: center; font-size: 11.5px; color: rgba(244,244,239,0.38); }

.fc-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-top: clamp(24px, 4vh, 40px); scroll-margin-top: 60px; }
.fc-controls-r { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fc-ctl-label { font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.38); }
.fc-seg { display: inline-flex; padding: 3px; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; background: rgba(255,255,255,0.03); }
.fc-seg button { appearance: none; border: 0; background: none; cursor: pointer; padding: 9px 18px; border-radius: 8px;
  font-family: inherit; font-size: 14px; font-weight: 600; color: rgba(244,244,239,0.55); letter-spacing: -0.01em; transition: color .15s ease, background .15s ease; }
.fc-seg button:hover { color: rgba(244,244,239,0.85); }
.fc-seg button.on { background: #f4f4ef; color: #08080a; }
.fc-seg.sm button { padding: 6px 12px; font-size: 12.5px; }
.fc-seg button:focus-visible { outline: 2px solid #b7ff00; outline-offset: 2px; }

.fc-mapwrap { position: relative; margin-top: clamp(18px, 3vh, 30px); }
.fc-map { display: block; width: min(1180px, 96vw); margin: 0 auto; overflow: visible; }
.fc-map.race { width: min(760px, 92vw); }
.fc-map-idle { fill: #0b0c10; stroke: rgba(244,244,239,0.06); stroke-width: 0.8; }
.fc-map-race { stroke: rgba(5,5,7,0.6); stroke-width: 0.7; cursor: pointer; transition: filter .15s ease; }
.fc-map-race.cd { stroke: rgba(5,5,7,0.5); stroke-width: 0.45; }
.fc-map-race:hover { filter: brightness(1.25); }
.fc-map-stateline { fill: none; stroke: rgba(244,244,239,0.3); stroke-width: 0.9; pointer-events: none; }
.fc-map-halo { fill: none; stroke: #f4f4ef; stroke-width: 1.6; pointer-events: none; }
.fc-map-loading { display: flex; align-items: center; justify-content: center; gap: 12px; height: 420px; color: rgba(244,244,239,0.5); font-size: 13.5px; }
.fc-map-loading.static { height: 120px; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }
.fc-map.anim { animation: fcMapIn 420ms cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fcMapIn { from { opacity: 0; transform: scale(0.985); } to { opacity: 1; transform: none; } }
.fc-hex { stroke: rgba(5,5,7,0.65); stroke-width: 1; cursor: pointer; transition: filter .15s ease; animation: fcHexIn 360ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.fc-hexg { animation: fcHexIn 360ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.fc-hexg .fc-hex { animation: none; }
.fc-hex:hover { filter: brightness(1.25); }
.fc-hex.idle { fill: #0b0c10; stroke: rgba(244,244,239,0.07); cursor: default; }
.fc-hex.idle:hover { filter: none; }
.fc-hex-label { fill: rgba(244,244,239,0.9); font-family: ${MONO}; font-size: 12px; font-weight: 700; text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: rgba(5,5,7,0.55); stroke-width: 2.5px; }
.fc-hex-label.idle { fill: rgba(244,244,239,0.22); stroke: none; }
@keyframes fcHexIn { from { opacity: 0; transform: scale(0.6); transform-box: fill-box; transform-origin: center; } to { opacity: 1; transform: scale(1); transform-box: fill-box; transform-origin: center; } }
.fc-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-top: 18px; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(244,244,239,0.5); }
.fc-legend span { display: inline-flex; align-items: center; gap: 6px; }
.fc-legend i { width: 12px; height: 12px; border-radius: 3px; }

.fc-tip { position: fixed; z-index: 60; width: 274px; padding: 12px 14px; border-radius: 12px; pointer-events: none;
  background: rgba(10,11,15,0.94); border: 1px solid rgba(255,255,255,0.13); box-shadow: 0 24px 60px rgba(0,0,0,0.6);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
.fc-tip-name { font-family: ${OSWALD}; font-weight: 600; font-size: 15px; letter-spacing: 0.03em; text-transform: uppercase; color: #f4f4ef; }
.fc-tip-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 13.5px; }
.fc-tip-row i { width: 3px; height: 16px; flex-shrink: 0; }
.fc-tip-row b { font-weight: 700; }
.fc-tip-row span { font-family: ${MONO}; font-size: 12px; font-weight: 700; }
.fc-tip-row em { font-style: normal; margin-left: auto; font-size: 12px; color: rgba(244,244,239,0.55); }
.fc-tip-foot { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(244,244,239,0.38); }

.fc-back { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 20px; background: none; border: 1px solid rgba(255,255,255,0.14); border-radius: 99px; padding: 8px 16px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; color: rgba(244,244,239,0.7); transition: border-color .15s ease, color .15s ease; }
.fc-back:hover { color: #f4f4ef; border-color: rgba(183,255,0,0.5); }
.fc-back span { transition: transform .15s ease; display: inline-block; }
.fc-back:hover span { transform: translateX(-3px); }
.fc-stage-year { font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(244,244,239,0.4); }
.fc-stage-title h2 { margin-top: 8px; font-family: ${OSWALD}; font-weight: 600; font-size: clamp(28px, 4vw, 44px); letter-spacing: 0.01em; text-transform: uppercase; line-height: 1.04; color: #f4f4ef; }
.fc-stage-banner { margin-top: 10px; font-family: ${MONO}; font-size: 12.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.fc-stage-map { margin-top: 10px; }
.fc-stage-caption { margin-top: 12px; text-align: center; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.35); }

.fc-sec { padding: clamp(48px, 8vh, 92px) 0 0; }
.fc-sec.last { padding-bottom: clamp(40px, 6vh, 70px); }
.fc-band { margin-top: clamp(48px, 8vh, 92px); padding: clamp(44px, 7vh, 80px) 0; background: #08080a; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); }
.fc-band + .fc-sec { padding-top: clamp(40px, 6.5vh, 76px); }

.fc-hist { position: relative; margin-top: 40px; padding-bottom: 44px; }
.fc-hist-svg { display: block; width: 100%; height: auto; }
.fc-hist-bar { transition: opacity .15s ease; }
.fc-hist:hover .fc-hist-bar { opacity: 0.92; }
.fc-hist-anno { position: absolute; top: -6px; z-index: 2; display: flex; flex-direction: column; gap: 3px; pointer-events: none; }
.fc-hist-anno.gop { left: 0; }
.fc-hist-anno.dem { right: 0; text-align: right; }
.fc-hist-anno b { font-size: clamp(34px, 4vw, 52px); font-weight: 800; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.fc-hist-anno span { font-size: 13.5px; font-weight: 600; color: rgba(244,244,239,0.85); }
.fc-hist-anno em { font-style: normal; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(244,244,239,0.4); }
.fc-hist-rulelabel { position: absolute; top: -2px; transform: translateX(-50%); font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244,244,239,0.6); white-space: nowrap; }
.fc-hist-axis { position: absolute; left: 0; right: 0; bottom: 36px; height: 0; }
.fc-hist-axis span { position: absolute; top: -22px; transform: translateX(-50%); font-family: ${MONO}; font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fc-hist-bracket { position: absolute; bottom: 0; transform: translateX(-50%); font-family: ${MONO}; font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(244,244,239,0.45); white-space: nowrap; }
.fc-hist-svglabel { fill: rgba(244,244,239,0.85); font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.fc-hist-svglabel.side { font-size: 11.5px; }

.fc-chartwrap { position: relative; margin-top: 28px; padding-right: 96px; }
.fc-chart { display: block; width: 100%; }
.fc-chart-ends { position: absolute; right: 0; top: 0; bottom: 0; width: 90px; pointer-events: none; }
.fc-chart-ends span { position: absolute; left: 8px; transform: translateY(-50%); font-family: ${MONO}; font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fc-chart-x { display: flex; justify-content: space-between; margin-top: 10px; padding-right: 96px; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244,244,239,0.35); }
.fc-chart-tag { position: absolute; left: 4px; transform: translateY(-135%); font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244,244,239,0.4); pointer-events: none; }
.fc-xhair { position: absolute; top: 10px; z-index: 3; display: flex; flex-direction: column; gap: 2px; padding: 9px 12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; background: rgba(8,8,10,0.92); pointer-events: none; }
.fc-xhair em { font-style: normal; font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244,244,239,0.45); }
.fc-xhair span { font-family: ${MONO}; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }

.fc-table-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-top: 26px; }
.fc-find { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 260px; max-width: 460px; height: 44px; padding: 0 14px;
  border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: rgba(244,244,239,0.4); transition: border-color .15s ease; }
.fc-find:focus-within { border-color: rgba(183,255,0,0.5); }
.fc-find input { flex: 1; background: none; border: 0; outline: none; color: #f4f4ef; font-family: inherit; font-size: 14px; }
.fc-find input::placeholder { color: rgba(244,244,239,0.35); }
.fc-sorts { display: inline-flex; gap: 4px; }
.fc-sorts button { appearance: none; background: none; border: 1px solid transparent; border-radius: 99px; padding: 7px 13px; cursor: pointer;
  font-family: ${MONO}; font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(244,244,239,0.45); transition: color .15s ease, border-color .15s ease; }
.fc-sorts button:hover { color: rgba(244,244,239,0.8); }
.fc-sorts button.on { color: #b7ff00; border-color: rgba(183,255,0,0.35); }

.fc-table { margin-top: 14px; }
.fc-tr { display: grid; grid-template-columns: minmax(0, 2.1fr) minmax(0, 1.7fr) 74px minmax(90px, 1fr) 84px 100px 76px; align-items: center; gap: 16px;
  width: 100%; text-align: left; padding: 14px 10px; background: none; border: 0; border-top: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: background .15s ease; font-family: inherit; color: inherit; }
.fc-tr:last-of-type { border-bottom: 1px solid rgba(255,255,255,0.08); }
.fc-tr:not(.fc-th):hover { background: rgba(255,255,255,0.03); }
.fc-th { cursor: default; border-top: 0; padding-bottom: 8px; }
.fc-th span { font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.38); }
.fc-th .num { text-align: right; }
.fc-td-name b { display: block; font-size: 14.5px; font-weight: 600; }
.fc-td-name em { display: block; margin-top: 2px; font-style: normal; font-size: 11px; color: rgba(244,244,239,0.4); }
.fc-td-cands { display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; color: rgba(244,244,239,0.8); }
.fc-td-cands i { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; margin-right: 7px; border-radius: 4px; font-style: normal; font-family: ${MONO}; font-size: 9px; font-weight: 700; }
.fc-td-cands i.d { background: rgba(59,111,222,0.22); color: #8fb0f5; }
.fc-td-cands i.r { background: rgba(226,57,80,0.2); color: #f0808d; }
.fc-td-margin, .fc-td-prob { font-family: ${MONO}; font-size: 13px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.fc-rating { display: inline-flex; align-items: center; gap: 6px; font-style: normal; font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 4px 9px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.16); white-space: nowrap; }
.fc-rating u { text-decoration: none; font-weight: 500; opacity: 0.6; }

.fc-mbar { position: relative; display: block; height: 14px; }
.fc-mbar-track { position: absolute; left: 0; right: 0; top: 5px; height: 4px; border-radius: 99px;
  background: linear-gradient(90deg, #1d3a85, #6f92e8 40%, #8b5cf6 50%, #e56471 60%, #8f1f2b); opacity: 0.5; }
.fc-mbar-band { position: absolute; top: 4px; height: 6px; border-radius: 99px; background: rgba(244,244,239,0.26); }
.fc-mbar-dot { position: absolute; top: 50%; width: 9px; height: 9px; border-radius: 99px; background: #f4f4ef; transform: translate(-50%, -50%); box-shadow: 0 0 0 2px rgba(5,5,7,0.85); }
.fc-mbar-mid { position: absolute; left: 50%; top: 1px; bottom: 1px; width: 1px; background: rgba(244,244,239,0.35); }

.fc-more { display: block; margin: 18px auto 0; background: none; border: 1px solid rgba(255,255,255,0.14); border-radius: 99px; padding: 10px 22px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; color: rgba(244,244,239,0.7); transition: border-color .15s ease, color .15s ease; }
.fc-more:hover { color: #f4f4ef; border-color: rgba(183,255,0,0.5); }

.fc-odds { display: grid; grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); gap: clamp(28px, 4vw, 64px); align-items: center; margin-top: 30px; }
.fc-score { padding-top: 6px; }
.fc-score-row { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; padding: 14px 0; }
.fc-score-row + .fc-score-row { border-top: 1px solid rgba(255,255,255,0.08); }
.fc-score-id { min-width: 0; }
.fc-score-id b { display: block; font-size: clamp(19px, 2vw, 24px); font-weight: 700; letter-spacing: -0.015em; }
.fc-score-id em { display: block; margin-top: 4px; font-style: normal; font-family: ${MONO}; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: rgba(244,244,239,0.45); }
.fc-score-p { font-size: clamp(34px, 3.6vw, 46px); font-weight: 800; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.fc-h2h { position: relative; height: 8px; margin-top: 16px; border-radius: 99px; background: ${GOP}; overflow: visible; }
.fc-h2h i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px 0 0 99px; background: ${DEM}; }
.fc-h2h-notch { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 2px; background: #050505; box-shadow: 0 0 0 1px rgba(244,244,239,0.35); }
.fc-h2h-x { display: flex; justify-content: space-between; margin-top: 9px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.fc-odds-dial { max-width: 470px; }

/* the outcome distribution */
.fc-outcome { margin-top: clamp(36px, 5vh, 56px); }
.fc-outcome-h { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.38); }
.fc-outcome-chart { position: relative; margin-top: 18px; }
.fc-outcome-chart .fc-chart { display: block; width: 100%; height: auto; }
.fc-outcome-median { position: absolute; top: 0; font-family: ${MONO}; font-size: 11.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }
.fc-outcome-tick { position: absolute; bottom: 34px; transform: translateX(-50%); font-family: ${MONO}; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; }
.fc-outcome-axis { position: absolute; left: 0; right: 0; bottom: 6px; height: 0; }
.fc-outcome-axis span { position: absolute; transform: translateX(-50%); font-family: ${MONO}; font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; opacity: 0.75; }
.fc-outcome-note { margin-top: 14px; font-size: 13px; color: rgba(244,244,239,0.5); }
.fc-outcome-note b { font-family: ${MONO}; font-size: 12.5px; font-weight: 700; }

/* what carries the estimate */
.fc-grade { font-style: normal; margin-left: 8px; padding: 2px 6px; border-radius: 5px; font-family: ${MONO}; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; color: ${LIME}; border: 1px solid rgba(183,255,0,0.3); background: rgba(183,255,0,0.06); vertical-align: 2px; }

/* the environment chips */
.fc-envchips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.fc-envchips span { display: inline-flex; align-items: baseline; gap: 7px; padding: 8px 13px; border: 1px solid rgba(255,255,255,0.1); border-radius: 9px; font-family: ${MONO}; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; color: rgba(244,244,239,0.55); }
.fc-envchips b { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fc-envchips b.lime { color: ${LIME}; }

/* the estimate waterfall */
.fc-flow { margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.1); }
.fc-flow-scalehead { display: flex; justify-content: space-between; align-items: center; padding: 14px 0 4px; }
.fc-flow-k { display: flex; align-items: center; gap: 10px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.6); }
.fc-flow-k.head { color: rgba(244,244,239,0.38); }
.fc-flow-k.final { color: ${LIME}; }
.fc-flow-num { font-style: normal; color: rgba(244,244,239,0.3); }
.fc-flow-carry { font-style: normal; margin-left: 4px; padding: 3px 7px; border-radius: 5px; border: 1px solid rgba(183,255,0,0.28); color: ${LIME}; font-size: 9px; letter-spacing: 0.1em; }
.fc-flow-window { display: inline-flex; align-items: center; gap: 8px; font-family: ${MONO}; font-size: 10.5px; font-weight: 700; }
.fc-flow-window i { width: 44px; height: 1px; background: rgba(244,244,239,0.2); }
.fc-flow-row { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: clamp(20px, 3vw, 44px); align-items: center; padding: 17px 0; border-top: 1px solid rgba(255,255,255,0.06); }
.fc-flow-row.off .fc-flow-k, .fc-flow-row.off .fc-flow-cap { opacity: 0.32; }
.fc-flow-row.final { border-top: 1px solid rgba(255,255,255,0.14); background: linear-gradient(180deg, rgba(183,255,0,0.025), transparent); }
.fc-flow-cap { margin: 6px 0 0; font-size: 13px; line-height: 1.55; color: rgba(244,244,239,0.55); }
.fc-flow-cap b { font-family: ${MONO}; font-size: 12.5px; font-weight: 700; }
.fc-flow-chips { display: inline-flex; flex-wrap: wrap; gap: 6px; margin-right: 8px; vertical-align: middle; }
.fc-flow-track { position: relative; height: 40px; border-left: 1px solid rgba(255,255,255,0.12); border-right: 1px solid rgba(255,255,255,0.12); }
.fc-flow-track::before { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(255,255,255,0.08); }
.fc-flow-even { position: absolute; top: 4px; bottom: 4px; width: 1px; background: rgba(244,244,239,0.22); }
.fc-flow-even::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, transparent 0 3px, #050505 3px 6px); }
.fc-flow-link { position: absolute; top: 50%; height: 2px; transform: translateY(-50%); background: rgba(244,244,239,0.3); border-radius: 2px; }
.fc-flow-ghost { position: absolute; top: 50%; width: 7px; height: 7px; transform: translate(-50%, -50%); border-radius: 99px; border: 1.4px solid rgba(244,244,239,0.35); background: #050505; }
.fc-flow-dot { position: absolute; top: 50%; width: 11px; height: 11px; transform: translate(-50%, -50%); border-radius: 99px; box-shadow: 0 0 0 3px rgba(5,5,7,0.9); }
.fc-flow-dot.final { width: 13px; height: 13px; }
.fc-flow-val { position: absolute; top: 50%; font-family: ${MONO}; font-size: 12.5px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.fc-flow-val em { font-style: normal; font-size: 10.5px; font-weight: 600; color: rgba(244,244,239,0.45); letter-spacing: 0.04em; }
.fc-flow-val.final { font-size: 14px; }
.fc-flow-val.final em { font-size: 11.5px; color: rgba(244,244,239,0.6); }


.fc-polls { margin-top: 26px; }
.fc-polls-h { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 10px; font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.38); }
.fc-poll { display: flex; align-items: center; gap: 14px; padding: 11px 4px; border-top: 1px solid rgba(255,255,255,0.07); font-size: 13.5px; }
.fc-poll b { font-weight: 600; min-width: 180px; }
.fc-kind { font-style: normal; font-family: ${MONO}; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(244,244,239,0.4); border: 1px solid rgba(255,255,255,0.14); border-radius: 5px; padding: 3px 7px; min-width: 92px; text-align: center; }
.fc-kind.flag { color: #e0b34c; border-color: rgba(224,179,76,0.4); }
.fc-poll > span { color: rgba(244,244,239,0.45); font-size: 12px; flex: 1; }
.fc-poll em { font-style: normal; font-family: ${MONO}; font-weight: 700; font-size: 13px; }

.fc-similar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
.fc-simchip { display: inline-flex; align-items: baseline; gap: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.12); border-radius: 99px; padding: 10px 16px; cursor: pointer;
  font-family: inherit; color: inherit; transition: border-color .15s ease, background .15s ease; }
.fc-simchip:hover { border-color: rgba(183,255,0,0.4); background: rgba(183,255,0,0.05); }
.fc-simchip b { font-size: 13px; font-weight: 600; }
.fc-simchip span { font-family: ${MONO}; font-size: 11.5px; font-weight: 700; }
.fc-simchip em { font-style: normal; font-family: ${MONO}; font-size: 10px; color: rgba(244,244,239,0.4); }

.fc-foot { margin-top: clamp(50px, 9vh, 100px); border-top: 1px solid rgba(255,255,255,0.08); }
.fc-foot-in { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; padding-top: 18px; padding-bottom: 26px; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(244,244,239,0.35); }

@media (max-width: 900px) {
  .fc-tr { grid-template-columns: minmax(0, 2fr) 70px minmax(70px, 1fr) 72px; }
  .fc-td-cands, .fc-tr span:nth-child(6), .fc-tr span:nth-child(7) { display: none; }
  .fc-odds { grid-template-columns: 1fr; }
  .fc-hist-anno { position: static; margin-bottom: 12px; }
  .fc-flow-row { grid-template-columns: 1fr; gap: 12px; }
  .fc-hist-anno.dem { text-align: left; }
  .fc-hist-anno b { font-size: 30px; }
  .fc-outcome-axis span:nth-child(2), .fc-outcome-axis span:nth-child(4) { display: none; }
  .fc-score-p { font-size: 30px; }
  .fc-xhair { display: none; }
  .fc-controls { justify-content: center; }
  .fc-chartwrap, .fc-chart-x { padding-right: 58px; }
  .fc-chart-ends { width: 54px; }
}
@media (prefers-reduced-motion: reduce) {
  .fc-pip, .fc-eyebrow-pip, .fc-loading span, .fc-map-loading span { animation: none; }
}
`;
