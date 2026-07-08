"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Manrope } from "next/font/google";
import DarkNav from "@/app/components/DarkNav";
import SwingOMeter from "../results/components/SwingOMeter";
import {
  DEM, GOP, INK,
  type Geo, type Model, type ModelKey, type Office, type Race, type StateDetail, type ViewMode,
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
    fetch(url)
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
  const counties = useJson<Record<string, Record<string, number>>>("/forecast/counties.json");

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
          <SectionDistribution chamber={chamber} office={office} />
          <SectionSeats chamber={chamber} office={office} updated={model.meta.updated} />
          <SectionProbability chamber={chamber} office={office} />
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
        <RaceSections race={sel} mk={mk} byId={byId} onPick={pick} />
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
function RaceStage({ race, mk, detail, counties, onBack }: {
  race: Race; mk: ModelKey; detail: StateDetail | null;
  counties: Record<string, Record<string, number>> | null; onBack: () => void;
}) {
  const s = race[mk];
  const fav = s.margin > 0 ? race.gop : race.dem;
  const tone = s.margin > 0 ? GOP : DEM;
  // county projections are built on the Complete estimate — re-center for Legacy
  const delta = mk === "legacy" ? race.legacy.margin - race.complete.margin : 0;
  const rows = race.office !== "house" && counties ? counties[race.id] : null;

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
        {race.office !== "house" ? (
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
      <div className="fc-stage-caption">
        {race.office === "house"
          ? `the ${race.state} delegation · ${race.name.toLowerCase()} highlighted`
          : "county-level projection · shaded by projected 2026 margin"}
      </div>
    </div>
  );
}

// ── national aggregate sections ──────────────────────────────────────────────
function SectionDistribution({ chamber, office }: { chamber: ChamberT; office: Office }) {
  const control = office === "house" ? 218 : office === "senate" ? 50 : 18;
  const total = chamber.seatsTotal;
  const cols = useMemo(() => {
    const m = new Map<number, number>();
    for (const [rSeats, p] of chamber.hist) {
      const demSeats = total - rSeats;
      m.set(demSeats, (m.get(demSeats) || 0) + p);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([seats, p]) => ({ seats, dots: Math.round(p * 200) }));
  }, [chamber, total]);
  const shown = cols.filter((c) => c.dots > 0);
  if (!shown.length) return null;
  const maxDots = Math.max(...shown.map((c) => c.dots));
  const lo = shown[0].seats, hi = shown[shown.length - 1].seats;
  const span = Math.max(1, hi - lo);
  const CH = Math.min(46, maxDots) * 5 + 20;

  return (
    <section className="fc-sec fc-band">
      <div className="fc-shell">
        <Eyebrow>the distribution</Eyebrow>
        <h2 className="fc-h2">every way it could go<em>.</em></h2>
        <p className="fc-body">
          Each dot is a bundle of ~50 simulations landing on a Democratic seat total.
          The rule marks control{office === "senate" ? " — 50 seats plus the tiebreak" : ` — ${control} seats`}.
        </p>
        <div className="fc-dist" style={{ height: CH + 52 }}>
          {shown.map((c) => {
            const xPos = ((c.seats - lo) / span) * 100;
            const demSide = c.seats >= control;
            return (
              <div key={c.seats} className="fc-dist-col" style={{ left: `${xPos}%` }}>
                {Array.from({ length: Math.min(c.dots, 46) }, (_, i) => (
                  <i key={i} style={{ bottom: i * 5, background: demSide ? DEM : GOP }} />
                ))}
              </div>
            );
          })}
          <span className="fc-dist-rule" style={{ left: `${((control - 0.5 - lo) / span) * 100}%` }}>
            <em>{office === "senate" ? "50 + VP" : control}</em>
          </span>
          <div className="fc-dist-axis">
            {[0.02, 0.25, 0.5, 0.75, 0.98].map((f) => {
              const v = Math.round(lo + span * f);
              return <span key={f} style={{ left: `${f * 100}%`, color: v >= control ? DEM : GOP }}>{v}</span>;
            })}
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
  const W = 1080, H = 260;
  const dem = chamber.trend.map((t) => t.demSeats);
  const gop = chamber.trend.map((t) => chamber.seatsTotal - t.demSeats);
  const bandHalf = Math.max(2, (chamber.demP90 - chamber.demP10) / 2);
  const all = [...dem, ...gop];
  const min = Math.min(...all) - bandHalf - 4, max = Math.max(...all) + bandHalf + 4;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const band = (pts: number[]) =>
    pts.map((v, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * W).toFixed(1)},${y(v + bandHalf).toFixed(1)}`).join("") +
    [...pts].reverse().map((v, i) => `L${(((pts.length - 1 - i) / (pts.length - 1)) * W).toFixed(1)},${y(v - bandHalf).toFixed(1)}`).join("") + "Z";
  const control = office === "house" ? 218 : office === "senate" ? 50 : 18;
  const day = new Date(updated + "T14:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase();

  return (
    <section className="fc-sec">
      <div className="fc-shell">
        <Eyebrow>expected seats</Eyebrow>
        <h2 className="fc-h2">the seat count, day by day<em>.</em></h2>
        <p className="fc-body">Daily model average; the shaded band holds 80% of simulations.</p>
        <div className="fc-chartwrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="fc-chart" role="img" aria-label="Expected seats trend">
            <path d={band(dem)} fill={DEM} opacity="0.09" />
            <path d={band(gop)} fill={GOP} opacity="0.09" />
            {control >= min && control <= max ? (
              <line x1="0" x2={W} y1={y(control)} y2={y(control)} stroke="rgba(244,244,239,0.25)" strokeDasharray="3 5" />
            ) : null}
            <path d={chartPath(dem, W, H, min, max)} fill="none" stroke={DEM} strokeWidth="2.4" />
            <path d={chartPath(gop, W, H, min, max)} fill="none" stroke={GOP} strokeWidth="2.4" />
            <circle cx={W} cy={y(dem[dem.length - 1])} r="4" fill={DEM} />
            <circle cx={W} cy={y(gop[gop.length - 1])} r="4" fill={GOP} />
          </svg>
          <div className="fc-chart-ends">
            <span style={{ color: DEM, top: `${(y(dem[dem.length - 1]) / H) * 100}%` }}>{chamber.demSeats.toFixed(1)}</span>
            <span style={{ color: GOP, top: `${(y(gop[gop.length - 1]) / H) * 100}%` }}>{chamber.gopSeats.toFixed(1)}</span>
          </div>
        </div>
        <div className="fc-chart-x"><span>sixty days ago</span><span>today · {day}</span></div>
      </div>
    </section>
  );
}

function SectionProbability({ chamber, office }: { chamber: ChamberT; office: Office }) {
  const W = 1080, H = 240;
  const dem = chamber.trend.map((t) => t.dem * 100);
  const gop = dem.map((v) => 100 - v);
  const y = (v: number) => H - (v / 100) * H;
  return (
    <section className="fc-sec">
      <div className="fc-shell">
        <Eyebrow live>the probability</Eyebrow>
        <h2 className="fc-h2">each side&rsquo;s chance of {office === "house" ? "the majority" : office === "senate" ? "the chamber" : "the map"}<em>.</em></h2>
        <div className="fc-chartwrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="fc-chart" role="img" aria-label="Win probability trend">
            <line x1="0" x2={W} y1={y(50)} y2={y(50)} stroke="rgba(244,244,239,0.22)" strokeDasharray="3 5" />
            {[25, 75].map((g) => (
              <line key={g} x1="0" x2={W} y1={y(g)} y2={y(g)} stroke="rgba(244,244,239,0.05)" />
            ))}
            <path d={chartPath(dem, W, H, 0, 100)} fill="none" stroke={DEM} strokeWidth="2.4" />
            <path d={chartPath(gop, W, H, 0, 100)} fill="none" stroke={GOP} strokeWidth="2.4" />
            <circle cx={W} cy={y(dem[dem.length - 1])} r="4" fill={DEM} />
            <circle cx={W} cy={y(gop[gop.length - 1])} r="4" fill={GOP} />
          </svg>
          <div className="fc-chart-ends">
            <span style={{ color: DEM, top: `${(y(dem[dem.length - 1]) / H) * 100}%` }}>{dem[dem.length - 1].toFixed(1)}%</span>
            <span style={{ color: GOP, top: `${(y(gop[gop.length - 1]) / H) * 100}%` }}>{gop[gop.length - 1].toFixed(1)}%</span>
          </div>
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

// ── selected-race sections ───────────────────────────────────────────────────
function RaceSections({ race, mk, byId, onPick }: {
  race: Race; mk: ModelKey; byId: Map<string, Race>; onPick: (id: string) => void;
}) {
  const s = race[mk];
  const demProb = 1 - s.prob;
  const trend = race.trend[mk];
  const W = 1080, H = 220;
  const demPts = trend.map((t) => (1 - t.p) * 100);
  const y = (v: number) => H - (v / 100) * H;

  return (
    <>
      {/* the odds */}
      <section className="fc-sec">
        <div className="fc-shell">
          <Eyebrow live>the odds</Eyebrow>
          <h2 className="fc-h2">where the race stands today<em>.</em></h2>
          <div className="fc-odds">
            <div>
              {[
                { name: race.dem, party: "D", tone: DEM, prob: demProb, margin: -s.margin },
                { name: race.gop, party: "R", tone: GOP, prob: s.prob, margin: s.margin },
              ].sort((a, b) => b.prob - a.prob).map((c) => (
                <div key={c.party} className="fc-cand" style={{ borderColor: `${c.tone}44` }}>
                  <span className="fc-cand-tick" style={{ background: c.tone }} />
                  <div className="fc-cand-main">
                    <b>{c.name}</b>
                    <em>{c.party === "D" ? "Democrat" : "Republican"}{!race.open && ((c.party === "D" && race.inc < 0) || (c.party === "R" && race.inc > 0)) ? " · incumbent" : ""}</em>
                  </div>
                  <div className="fc-cand-nums">
                    <b style={{ color: c.tone }}>{fmtPct(c.prob, 0)}</b>
                    <em>{c.margin > 0 ? "+" : ""}{c.margin.toFixed(1)} expected</em>
                  </div>
                </div>
              ))}
              <div className="fc-interval">
                <span>80% of simulations land between</span>
                <b style={{ color: s.p10 > 0 ? GOP : DEM }}>{fmtMargin(s.p10)}</b>
                <span>and</span>
                <b style={{ color: s.p90 > 0 ? GOP : DEM }}>{fmtMargin(s.p90)}</b>
              </div>
            </div>
            <div className="fc-odds-dial">
              <SwingOMeter
                c1Name={race.dem} c2Name={race.gop}
                c1Color={DEM} c2Color={GOP}
                c1Prob={demProb} c2Prob={s.prob}
                reportingPct={0}
                marginPp={Math.abs(s.margin)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* the tracker */}
      <section className="fc-sec">
        <div className="fc-shell">
          <Eyebrow>the tracker</Eyebrow>
          <h2 className="fc-h2">sixty days of this race<em>.</em></h2>
          <div className="fc-chartwrap">
            <svg viewBox={`0 0 ${W} ${H}`} className="fc-chart" role="img" aria-label="Race win-probability trend">
              <line x1="0" x2={W} y1={y(50)} y2={y(50)} stroke="rgba(244,244,239,0.22)" strokeDasharray="3 5" />
              <path d={`${chartPath(demPts, W, H, 0, 100)}L${W},${H}L0,${H}Z`} fill={DEM} opacity="0.07" />
              <path d={chartPath(demPts, W, H, 0, 100)} fill="none" stroke={DEM} strokeWidth="2.4" />
              <path d={chartPath(demPts.map((v) => 100 - v), W, H, 0, 100)} fill="none" stroke={GOP} strokeWidth="2.4" />
              <circle cx={W} cy={y(demPts[demPts.length - 1])} r="4" fill={DEM} />
              <circle cx={W} cy={y(100 - demPts[demPts.length - 1])} r="4" fill={GOP} />
            </svg>
            <div className="fc-chart-ends">
              <span style={{ color: DEM, top: `${(y(demPts[demPts.length - 1]) / H) * 100}%` }}>{surname(race.dem)} {fmtPct(demProb)}</span>
              <span style={{ color: GOP, top: `${(y(100 - demPts[demPts.length - 1]) / H) * 100}%` }}>{surname(race.gop)} {fmtPct(s.prob)}</span>
            </div>
          </div>
          <div className="fc-chart-x"><span>sixty days ago</span><span>today</span></div>
        </div>
      </section>

      {/* the inputs */}
      <section className="fc-sec">
        <div className="fc-shell">
          <Eyebrow>the inputs</Eyebrow>
          <h2 className="fc-h2">what the model is looking at<em>.</em></h2>
          <div className="fc-inputs">
            <div className="fc-input">
              <span className="fc-input-k">fundamentals</span>
              <b style={{ color: race.fundamentals > 0 ? GOP : DEM }}>{fmtMargin(race.fundamentals)}</b>
              <em>lean {fmtMargin(race.pvi)} · {race.open ? "open seat" : "incumbent running"} · the national environment applied through the state&rsquo;s elasticity</em>
            </div>
            <div className="fc-input">
              <span className="fc-input-k">polling</span>
              {race.pollAvg != null ? (
                <>
                  <b style={{ color: race.pollAvg > 0 ? GOP : DEM }}>{fmtMargin(race.pollAvg)}</b>
                  <em>{race.enop.toFixed(1)} effective polls · carries {(race.wPoll * 100).toFixed(0)}% of the estimate</em>
                </>
              ) : (
                <><b className="dim">no usable polling</b><em>fundamentals carry the race</em></>
              )}
            </div>
            <div className="fc-input">
              <span className="fc-input-k">expert ratings</span>
              <span className="fc-input-chips">
                {race.ratings.map((rt) => (
                  <i key={rt.outlet} className="fc-rating">{rt.cat}<u>{rt.outlet}</u></i>
                ))}
              </span>
              <em>categories act as guardrails — they pull only when the estimate drifts outside them</em>
            </div>
            <div className="fc-input">
              <span className="fc-input-k">the market</span>
              {race.market && mk === "complete" ? (
                <>
                  <b>{fmtPct(race.market.q, 0)} <span style={{ fontWeight: 500, fontSize: 14, color: "rgba(244,244,239,0.5)" }}>implied GOP</span></b>
                  <em>liquidity score {(race.market.liquidity * 100).toFixed(0)} · carries {(race.wMkt * 100).toFixed(0)}% · complete model only</em>
                </>
              ) : (
                <><b className="dim">{mk === "legacy" ? "excluded from legacy" : "no usable book"}</b><em>{mk === "legacy" ? "the legacy model is fundamentals + polling only" : "order book too thin to price this race"}</em></>
              )}
            </div>
          </div>

          {race.polls.length ? (
            <div className="fc-polls">
              <div className="fc-polls-h"><span>latest polls</span><span>weighted by recency · pollster record · sponsorship</span></div>
              {race.polls.map((p, i) => (
                <div key={i} className="fc-poll">
                  <b>{p.pollster}</b>
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
          <p className="fc-body">Shared national, regional, and state shocks tie outcomes together — when this race moves, these tend to move too.</p>
          <div className="fc-similar">
            {race.similar.slice(0, 8).map((sim) => {
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

.fc-dist { position: relative; margin-top: 34px; }
.fc-dist-col { position: absolute; bottom: 52px; width: 4px; margin-left: -2px; }
.fc-dist-col i { position: absolute; width: 4px; height: 4px; border-radius: 99px; }
.fc-dist-rule { position: absolute; top: -4px; bottom: 48px; width: 1.5px; background: rgba(244,244,239,0.3); }
.fc-dist-rule em { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-style: normal; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: rgba(244,244,239,0.6); white-space: nowrap; }
.fc-dist-axis { position: absolute; left: 0; right: 0; bottom: 18px; border-top: 1px solid rgba(255,255,255,0.09); }
.fc-dist-axis span { position: absolute; top: 8px; transform: translateX(-50%); font-family: ${MONO}; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }

.fc-chartwrap { position: relative; margin-top: 28px; padding-right: 96px; }
.fc-chart { display: block; width: 100%; }
.fc-chart-ends { position: absolute; right: 0; top: 0; bottom: 0; width: 90px; pointer-events: none; }
.fc-chart-ends span { position: absolute; left: 8px; transform: translateY(-50%); font-family: ${MONO}; font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fc-chart-x { display: flex; justify-content: space-between; margin-top: 10px; padding-right: 96px; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244,244,239,0.35); }

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
.fc-cand { display: flex; align-items: center; gap: 14px; padding: 18px; border: 1px solid; border-radius: 14px; background: rgba(255,255,255,0.02); }
.fc-cand + .fc-cand { margin-top: 12px; }
.fc-cand-tick { width: 4px; height: 40px; border-radius: 2px; flex-shrink: 0; }
.fc-cand-main { min-width: 0; flex: 1; }
.fc-cand-main b { display: block; font-size: 19px; font-weight: 700; }
.fc-cand-main em { display: block; margin-top: 2px; font-style: normal; font-size: 12px; color: rgba(244,244,239,0.45); }
.fc-cand-nums { text-align: right; }
.fc-cand-nums b { display: block; font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; }
.fc-cand-nums em { display: block; margin-top: 2px; font-style: normal; font-family: ${MONO}; font-size: 11px; color: rgba(244,244,239,0.45); }
.fc-interval { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-top: 16px; font-size: 13px; color: rgba(244,244,239,0.5); }
.fc-interval b { font-family: ${MONO}; font-size: 13px; font-weight: 700; }
.fc-odds-dial { max-width: 470px; }

.fc-inputs { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); column-gap: 34px; margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.09); }
.fc-input { padding: 20px 0 22px; border-bottom: 1px solid rgba(255,255,255,0.09); }
.fc-input-k { display: block; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.4); }
.fc-input b { display: block; margin-top: 10px; font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
.fc-input b.dim { color: rgba(244,244,239,0.4); font-size: 17px; font-weight: 600; }
.fc-input em { display: block; margin-top: 7px; font-style: normal; font-size: 12px; line-height: 1.55; color: rgba(244,244,239,0.45); max-width: 36ch; }
.fc-input-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
.fc-input-chips .fc-rating { color: rgba(244,244,239,0.75); }

.fc-polls { margin-top: 26px; }
.fc-polls-h { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 10px; font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.38); }
.fc-poll { display: flex; align-items: center; gap: 14px; padding: 11px 4px; border-top: 1px solid rgba(255,255,255,0.07); font-size: 13.5px; }
.fc-poll b { font-weight: 600; min-width: 180px; }
.fc-kind { font-style: normal; font-family: ${MONO}; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(244,244,239,0.4); border: 1px solid rgba(255,255,255,0.14); border-radius: 5px; padding: 3px 7px; }
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
  .fc-controls { justify-content: center; }
  .fc-chartwrap, .fc-chart-x { padding-right: 58px; }
  .fc-chart-ends { width: 54px; }
}
@media (prefers-reduced-motion: reduce) {
  .fc-pip, .fc-eyebrow-pip, .fc-loading span, .fc-map-loading span { animation: none; }
}
`;
