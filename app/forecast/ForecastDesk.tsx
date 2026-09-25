"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SwingOMeter from "../results/components/SwingOMeter";
import {
  DEM, GOP, IND, INK, LIME, RATING_BANDS, TILT_D_TONE, TILT_R_TONE,
  type CountiesPayload, type CountyRow, type Crosstabs, type CrosstabRow, type Cand,
  partyColor, partyLabel,
  type Geo, type Model, type Office, type Race, type RaceSide, type StateDetail, type ViewMode,
  OFFICE_LABEL, fmtMargin, fmtPct, inkOn, marginColor, onLight, raceColor, ratingFor, surname,
  indSide, sideColor, sideLabel, fmtRaceMargin, raceMarginColor,
  isUncontested,
  isPlaceholderName,
} from "./lib";

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
  const counties = (useJson<Record<string, unknown>>("/forecast/counties.json") ?? null) as CountiesPayload | null;

  const [office, setOffice] = useState<Office>("house");
  const [view, setView] = useState<ViewMode>("margin");
  const [mapKind, setMapKind] = useState<"geo" | "hex">("geo");
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
  const chamber = model ? model.chambers[office] : null;

  const head = useMemo(() => {
    if (!chamber) return null;
    const dem = chamber.demControl;
    const fav = dem >= 0.5 ? "dem" : "gop";
    const p = Math.round(Math.max(dem, 1 - dem) * 100);
    const partyName = fav === "dem" ? "Democrats" : "Republicans";
    const object =
      office === "house" ? "of winning the House" :
      office === "senate" ? (fav === "gop" ? "of holding the Senate" : "of flipping the Senate") :
      "of holding most of the 50 governorships";
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
    if (sortKey === "close") sorted.sort((a, b) => Math.abs(a.est.margin) - Math.abs(b.est.margin));
    else if (sortKey === "prob") sorted.sort((a, b) => b.est.prob - a.est.prob);
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (!q && !showAll && sorted.length > 24) return sorted.slice(0, 24);
    return sorted;
  }, [races, query, sortKey, showAll]);
  const truncated = !query.trim() && !showAll && races.length > 24;

  if (!model || !geo || !chamber || !head) {
    return (
      <div className="fc-page">
        <style>{CSS}</style>
        <div className="fc-loading"><span /><em>loading the forecast…</em></div>
      </div>
    );
  }

  const gb = model.meta.genericBallot;

  return (
    <div className="fc-page">
      <style>{CSS}</style>
      <div className="fc-grain" aria-hidden />

      <div className="fc-status">
        <div className="fc-shell fc-status-in">
          <span><i className="fc-pip" /> THE FORECAST <em>·</em> 2026 MIDTERMS</span>
          <span>{model.meta.sims.toLocaleString()} SIMULATIONS <em>·</em> UPDATED {fmtDate(model.meta.updated).toUpperCase()}</span>
        </div>
      </div>

      <div className="fc-shell">
</div>

      {/* ── headline ── */}
      <header className="fc-head">
        <Eyebrow live>the 2026 forecast</Eyebrow>
        <h1 className="fc-h1">
          <b style={{ color: head.fav === "dem" ? "var(--fc-dem)" : "var(--fc-gop)" }}>{head.partyName}</b> have {article(head.p)}{" "}
          <b style={{ color: head.fav === "dem" ? "var(--fc-dem)" : "var(--fc-gop)" }}>{head.p}%</b> chance {head.object}<em>.</em>
        </h1>
        <div className="fc-updated">
          last updated {fmtDate(model.meta.updated).toLowerCase()} · 2:00 pm et · {model.meta.daysOut} days to election day
        </div>
        <div className="fc-envline">
          <span>national environment <b style={{ color: "var(--fc-dem)" }}>D+{Math.abs(model.meta.npe).toFixed(1)}</b></span>
          <em>·</em>
          <span>generic ballot <b style={{ color: "var(--fc-dem)" }}>D+{Math.abs(gb.avg).toFixed(1)}</b></span>
          <em>·</em>
          <span>net approval <b style={{ color: "var(--fc-gop)" }}>{gb.netApproval}</b></span>
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
        {/* the map controls only reach the national map: inside a state the stage
            draws its own counties and districts, and neither switch does anything */}
        {sel ? null : <div className="fc-controls-r">
          <span className="fc-ctl-label">view</span>
          <Seg small ariaLabel="Map style" value={mapKind} onChange={setMapKind} options={[
            { v: "geo", label: "map" }, { v: "hex", label: "cartogram" },
          ]} />
          <span className="fc-ctl-label" style={{ marginLeft: 16 }}>color by</span>
          <Seg small ariaLabel="Color mode" value={view} onChange={setView} options={[
            { v: "margin", label: "margin" }, { v: "odds", label: "odds" }, { v: "rating", label: "rating" },
          ]} />
        </div>}
      </div>

      {/* ── the map ── */}
      <section className="fc-mapwrap">
        {!sel ? (
          <>
            <NationalMap geo={geo} races={races} office={office} view={view} kind={mapKind} onPick={pick} hover={hover} setHover={setHover} />
            <Legend view={view} />
            {hover && byId.get(hover.id) ? <MapTip race={byId.get(hover.id)!} x={hover.x} y={hover.y} /> : null}
          </>
        ) : (
          <RaceStage
            race={sel} detail={detail} counties={counties} onBack={back} onPick={pick}
            stateRaces={model.races.filter((r) => r.office === sel.office && r.st === sel.st)
              .sort((a, b) => a.district - b.district)}
          />
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
              <RaceTable rows={tableRows} onPick={pick} />
              {truncated ? (
                <button className="fc-more" onClick={() => setShowAll(true)}>
                  show all {races.length} races <span aria-hidden>↓</span>
                </button>
              ) : null}
            </div>
          </section>
        </>
      ) : (
        <RaceSections race={sel} byId={byId} onPick={pick} sims={model.meta.sims} updated={model.meta.updated} env={{ npe: model.meta.npe, gb: model.meta.genericBallot.avg, approval: model.meta.genericBallot.netApproval }} />
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
type ChamberT = Model["chambers"]["house"];
// The bar carries the seat by seat call — every race given to its projected
// winner — because that is the forecast's answer to "who wins what" and it is
// what the OnPoint pages print. The average across the simulations is a
// different number, and sits underneath where it can be read as one: the mean
// leans toward whoever holds the close seats, which is why the House calls 235
// Democratic seats and averages 244.
function SeatBar({ chamber, office, model }: { chamber: ChamberT; office: Office; model: Model }) {
  const dem = chamber.projD, gop = chamber.projR;
  const total = dem + gop;
  const control = office === "house" ? 218 : office === "senate" ? 50 : 26;
  const seats = seatNoun(office, 2);
  return (
    <div className="fc-seatbar">
      <div className="fc-seatbar-ends">
        <span style={{ color: "var(--fc-dem)" }}><b>{dem}</b> Democrats</span>
        <span className="fc-seatbar-mid">{office === "senate" ? "50 + tiebreak controls" : `${control} to control`}</span>
        <span style={{ color: "var(--fc-gop)" }}><b>{gop}</b> Republicans</span>
      </div>
      <div className="fc-seatbar-track" role="img" aria-label={`Projected: ${dem} Democratic ${seats}, ${gop} Republican`}>
        <span className="fc-seatbar-fill" style={{ width: `${(dem / total) * 100}%` }} />
        <span className="fc-seatbar-tick" style={{ left: `${(control / total) * 100}%` }} />
      </div>
      <div className="fc-seatbar-note">
        every race called for its projected winner · across {model.meta.sims.toLocaleString()} simulations
        the Democratic count averages {chamber.demSeats.toFixed(1)}, with 80% of runs between {chamber.demP10} and {chamber.demP90}
        {office === "senate" ? ` · ${model.meta.senNotUpD} Democratic and ${model.meta.senNotUpR} Republican seats are not on the 2026 ballot` : ""}
        {office === "governor" ? ` · ${model.meta.govOnBallot} are on the 2026 ballot, and ${model.meta.govNotUpD} Democratic and ${model.meta.govNotUpR} Republican governorships are not` : ""}
      </div>
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

function NationalMap({ geo, races, office, view, kind, onPick, hover, setHover }: {
  geo: Geo; races: Race[]; office: Office; view: ViewMode; kind: "geo" | "hex";
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
                fill={raceColor(r, view)}
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
                fill={raceColor(r, view)}
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
              fill={raceColor(r, view)}
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
            fill={raceColor(r, view)}
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
      ? [...RATING_BANDS].reverse().map((b) => [b.cat, b.color] as [string, string])   // Safe D through Safe R, straight off the bands
      : view === "odds"
        ? [["Safe D", "#183685"], ["Favored D", "#4a5fb8"], ["Tilt D", TILT_D_TONE], ["Tilt R", TILT_R_TONE], ["Favored R", "#c2536b"], ["Safe R", "#a01426"]]
        : [["D+30", "#16306f"], ["D+12", "#2c56c4"], ["D+6", "#3b6fde"], ["D+2", "#7b8fe0"], ["tilt D", TILT_D_TONE], ["tilt R", TILT_R_TONE], ["R+2", "#e08a94"], ["R+6", "#e23950"], ["R+12", "#c22638"], ["R+30", "#701020"]];
  return (
    <div className="fc-legend" aria-hidden>
      {items.map(([label, c]) => (
        <span key={label}><i style={{ background: c }} />{label}</span>
      ))}
    </div>
  );
}

// The tooltips are position:fixed, but a wrapper in the site layout carries a
// transform, and a transformed ancestor becomes the containing block for fixed
// children — so the tip rendered offset by exactly the scroll distance. Sending
// it to document.body escapes that ancestor and puts it back under the cursor.
function TipPortal({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); return () => setHost(null); }, []);
  return host ? createPortal(children, host) : null;
}

function MapTip({ race, x, y }: { race: Race; x: number; y: number }) {
  const s = race.est;
  const fav = s.margin > 0 ? race.gop : race.dem;
  const tone = sideColor(race, s.margin > 0 ? "gop" : "dem");
  const p = s.margin > 0 ? s.prob : 1 - s.prob;
  const flip = typeof window !== "undefined" && x > window.innerWidth - 330;
  const yc = typeof window !== "undefined" ? Math.min(y, window.innerHeight - 130) : y;
  return (
    <TipPortal>
    <div className="fc-tip" style={{ left: x + (flip ? -292 : 18), top: yc - 14 }}>
      <div className="fc-tip-name">{race.name}</div>
      <div className="fc-tip-row">
        <i style={{ background: tone }} />
        <b>{surname(fav)}</b>
        <span style={{ color: tone }}>{fmtRaceMargin(race, s.margin)}</span>
        <em>{fmtPct(p)} to win</em>
      </div>
      <div className="fc-tip-foot">{ratingFor(s.margin).cat} · click for the full race</div>
    </div>
    </TipPortal>
  );
}

// ── race stage — the map swaps in place ──────────────────────────
type StageHover = { kind: "county" | "district"; id: string; x: number; y: number };

const commas = (n: number) => Math.round(n).toLocaleString("en-US");

// Surnames alone are the right label right up until two people on the same ballot
// share one. Alaska's Senate race runs Dan S. Sullivan against Dan J. Sullivan, and
// Oregon's runs two Smiths; printing "Sullivan" twice in a county tooltip is worse
// than printing nothing. Where a surname repeats, those candidates get their full
// name and everyone else keeps the short one.
function ballotLabels(cands: { name: string }[]): string[] {
  const short = cands.map((c) => surname(c.name));
  const seen = new Map<string, number>();
  for (const s of short) seen.set(s, (seen.get(s) ?? 0) + 1);
  return short.map((s, i) => ((seen.get(s) ?? 0) > 1 ? cands[i].name : s));
}
const shareOf = (v: number, t: number) => (t > 0 ? `${((v / t) * 100).toFixed(1)}%` : "\u2014");

// One tooltip shape for both layers: who, how many votes, what share, and the margin
// underneath. Counts are the point — a shade alone never told anyone the size of a place.
function VoteTip({ title, sub, demName, gopName, demColor = DEM, dem, rep, total, margin, foot, x, y, cands }: {
  title: string; sub?: string; demName: string; gopName: string; demColor?: string;
  dem: number; rep: number; total: number; margin: number; foot?: string; x: number; y: number;
  // when the race runs more than two names, the county's whole ballot rather than
  // a Democrat, a Republican and an undifferentiated "other"
  cands?: { name: string; party: string; pct: number }[];
}) {
  const flip = typeof window !== "undefined" && x > window.innerWidth - 350;
  const yc = typeof window !== "undefined" ? Math.min(y, window.innerHeight - 200) : y;
  return (
    <TipPortal>
    <div className="fc-tip wide" style={{ left: x + (flip ? -320 : 18), top: yc - 14 }}>
      <div className="fc-tip-name">{title}</div>
      {sub ? <div className="fc-tip-sub">{sub}</div> : null}
      {cands && cands.length > 2
        ? ballotLabels(cands).map((label, i) => { const c = cands[i]; return (
            <div key={`${c.name}-${i}`} className="fc-tip-vote">
              <i style={{ background: partyColor(c.party) }} />
              <b>{label}</b>
              <span>{commas(Math.round(total * c.pct / 100))}</span>
              <em>{c.pct.toFixed(1)}%</em>
            </div>
          ); })
        : (<>
            <div className="fc-tip-vote"><i style={{ background: demColor }} /><b>{demName}</b><span>{commas(dem)}</span><em>{shareOf(dem, total)}</em></div>
            <div className="fc-tip-vote"><i style={{ background: GOP }} /><b>{gopName}</b><span>{commas(rep)}</span><em>{shareOf(rep, total)}</em></div>
            {total > 0 && (total - dem - rep) / total >= 0.0005
              ? <div className="fc-tip-vote"><i style={{ background: "rgba(var(--fc-ink-rgb),calc(0.3 * var(--fc-mute) + var(--fc-floor)))" }} /><b>other candidates</b><span>{commas(total - dem - rep)}</span><em>{shareOf(total - dem - rep, total)}</em></div>
              : null}
          </>)}
      <div className="fc-tip-vote total"><i /><b>total votes</b><span>{commas(total)}</span><em style={{ color: margin > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{fmtMargin(margin)}</em></div>
      {foot ? <div className="fc-tip-foot">{foot}</div> : null}
    </div>
    </TipPortal>
  );
}

const OFFICE_WORD: Record<Office, string> = { house: "U.S. House", senate: "U.S. Senate", governor: "governor" };

// The page follows the site's data-theme attribute. CSS handles almost all of
// it; this is for the few colours computed in JS, where the value depends on
// data rather than on a rule.
function useLightMode() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const read = () => setLight(document.documentElement.getAttribute("data-theme") === "light");
    read();
    const ob = new MutationObserver(read);
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => ob.disconnect();
  }, []);
  return light;
}

// A rating chip paints the band colour as text over a tint of itself. On white
// the pale bands — Tilt, Lean — vanish, so light mode darkens the ink while
// keeping the tint, which preserves the colour coding either way.
function RatingChip({ color, cat, outlet }: { color: string; cat: string; outlet?: string }) {
  const light = useLightMode();
  const ink = light ? onLight(color) : color;
  return (
    <i className="fc-rating" style={{ color: ink, borderColor: `${ink}55`, background: `${color}1f` }}>
      {cat}{outlet ? <u>{outlet}</u> : null}
    </i>
  );
}

const OVERVIEW = "Overview";
const ALLCUTS = "All cuts";

// "an 83% chance", not "a 83% chance": 8, 11 and 18 lead with a vowel sound.
const article = (n: number) => (/^(8|11$|11\d|18$|18\d)/.test(String(n)) ? "an" : "a");

function RaceStage({ race, detail, counties, stateRaces, onPick, onBack }: {
  race: Race; detail: StateDetail | null;
  counties: CountiesPayload | null; stateRaces: Race[];
  onPick: (id: string) => void; onBack: () => void;
}) {
  const s = race.est;
  const fav = s.margin > 0 ? race.gop : race.dem;
  const tone = s.margin > 0 ? GOP : DEM;
  const isHouse = race.office === "house";
  // every district in a state reads the same county map, so it is stored once
  const rows = (counties ? counties[isHouse ? `house-${race.st}` : race.id] : undefined) as
    Record<string, CountyRow> | undefined ?? null;
  const names = (counties?._n ?? {}) as Record<string, string>;
  const byDist = useMemo(() => new Map(stateRaces.map((r) => [r.id, r])), [stateRaces]);

  // A state with one at-large district has nothing to switch between, so it opens
  // on its counties rather than on a district outline of the whole state.
  const multiDist = stateRaces.length > 1;
  const [layer, setLayer] = useState<"district" | "county">("district");
  // The county shading is a two party margin. Where a third candidate is projected
  // to finish ahead of one of the majors, that shading is not the story of the race,
  // so the caption says so rather than letting the colour speak for itself.
  const runnerUpMinor = (() => {
    const cs = race.cands;
    if (!cs || cs.length < 3) return null;
    const ranked = [...cs].sort((a, b) => b.pct - a.pct);
    const second = ranked[1];
    return second && second.party !== "D" && second.party !== "R" ? second : null;
  })();
  const [tip, setTip] = useState<StageHover | null>(null);
  useEffect(() => { setTip(null); setLayer(multiDist ? "district" : "county"); }, [race.id, multiDist]);

  const showDistricts = isHouse && multiDist && layer === "district";

  const countyPath = (c: { id: string; d: string }, faded: boolean) => {
    const row = rows ? rows[c.id] : undefined;
    const m = row ? row[0] : null;
    return (
      <path
        key={c.id} d={c.d}
        fill={m == null ? undefined : raceMarginColor(race, m)}
        fillOpacity={m == null ? 1 : faded ? 0.3 : 1}
        strokeWidth="0.8"
        style={{ stroke: "var(--fc-idle-line)", ...(m == null ? { fill: "var(--fc-idle)" } : null) }}
        className={row ? "fc-unit" : undefined}
        onMouseMove={row ? (e) => setTip({ kind: "county", id: c.id, x: e.clientX, y: e.clientY }) : undefined}
        onMouseLeave={row ? () => setTip(null) : undefined}
      />
    );
  };

  const districtPath = (d: { id: string; d: string }) => {
    const dr = byDist.get(d.id);
    const on = d.id === race.id;
    const fill = dr ? raceColor(dr, "margin") : "transparent";
    return (
      <path
        key={d.id} d={d.d}
        fill={fill}
        fillOpacity={dr ? (on ? 0.98 : 0.92) : 0}
        stroke={on ? "currentColor" : "rgba(var(--fc-ink-rgb),calc(0.34 * var(--fc-mute) + var(--fc-floor)))"}
        strokeWidth={on ? 1.8 : 0.8}
        className={dr ? "fc-unit" : undefined}
        style={on ? { filter: `drop-shadow(0 0 18px ${fill}66)` } : undefined}
        onMouseMove={dr ? (e) => setTip({ kind: "district", id: d.id, x: e.clientX, y: e.clientY }) : undefined}
        onMouseLeave={dr ? () => setTip(null) : undefined}
        onClick={dr && !on ? () => onPick(d.id) : undefined}
      />
    );
  };

  let stage: React.ReactNode;
  // Alaska and Hawaii were excluded here by hand on the assumption that no county
  // file ships for a state with a single at-large district. Both do ship, and both
  // carry a full forecast row for every borough and island county, so the only
  // condition that should suppress the layer is an actually empty geometry file.
  if (detail && detail.counties.length === 0) {
    stage = <div className="fc-map-loading static"><em>no county detail for {race.state} — the model prices this race statewide</em></div>;
  } else if (!detail) {
    stage = <div className="fc-map-loading"><span /><em>drawing {race.state}…</em></div>;
  } else {
    stage = (
      <svg viewBox="0 0 900 620" className="fc-map race" role="img"
        aria-label={isHouse ? `${race.state} districts and counties` : `${race.state} county projection`}>
        {detail.counties.map((c) => countyPath(c, showDistricts))}
        {isHouse ? detail.districts.map((d) => (showDistricts
          ? districtPath(d)
          : <path key={d.id} d={d.d} fill="none" stroke="currentColor" strokeOpacity={0.26} strokeWidth={d.id === race.id ? 1.8 : 0.7} style={{ pointerEvents: "none" }} />
        )) : null}
      </svg>
    );
  }

  const tipNode = (() => {
    if (!tip) return null;
    if (tip.kind === "county") {
      const row = rows ? rows[tip.id] : undefined;
      if (!row) return null;
      const [m, dv, rv, tv, shares] = row;
      const nm = names[tip.id] || "County";
      return (
        <VoteTip
          title={/\b(city|parish|borough|census area|municipality|municipio)\b/i.test(nm) ? nm : `${nm} County`}
          sub={`${race.state} · ${OFFICE_WORD[race.office]}`}
          demName={isHouse ? "Democratic" : surname(race.dem)}
          gopName={isHouse ? "Republican" : surname(race.gop)}
          demColor={isHouse ? DEM : sideColor(race, "dem")}
          dem={dv} rep={rv} total={tv} margin={m}
          cands={shares && race.cands
            ? race.cands.map((c, i) => ({ name: c.name, party: c.party, pct: shares[i] ?? 0 }))
            : undefined}
          foot={`${ratingFor(m, indSide(race)).cat} · projected county vote`}
          x={tip.x} y={tip.y}
        />
      );
    }
    const dr = byDist.get(tip.id);
    if (!dr) return null;
    const v = dr.votes ?? { dem: 0, rep: 0, other: 0, total: 0 };
    const ds = dr.est;
    return (
      <VoteTip
        title={dr.name} sub={`${dr.dem} · ${dr.gop}`}
        demName={surname(dr.dem)} gopName={surname(dr.gop)}
        dem={v.dem} rep={v.rep} total={v.total} margin={ds.margin}
        foot={`${ratingFor(ds.margin).cat} · ${dr.id === race.id ? "the race on screen" : "click to open this district"}`}
        x={tip.x} y={tip.y}
      />
    );
  })();

  const rv = race.votes;
  const unopposed = isUncontested(race);
  const noFiler = isPlaceholderName(race.gop) || isPlaceholderName(race.dem);

  return (
    <div className="fc-stage">
      <div className="fc-shell">
        <button className="fc-back" onClick={onBack}>
          <span aria-hidden>←</span> the national map
        </button>
        <div className="fc-stage-title">
          <span className="fc-stage-year">2026 · {race.office}{race.marquee ? " · marquee" : ""}</span>
          <h2>{race.name}</h2>
          <div className="fc-stage-banner" style={{ color: s.margin > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>
            {unopposed
              ? (noFiler
                ? `${surname(fav)} is unopposed \u2014 no major-party opponent filed`
                : `${surname(race.dem)} against ${surname(race.gop)} \u2014 the model does not price this ballot`)
              : <>{surname(fav)} favored by {Math.abs(s.margin).toFixed(1)} · {fmtPct(s.margin > 0 ? s.prob : 1 - s.prob)} to win</>}
          </div>
          {rv && rv.total > 0 && rv.dem + rv.rep > 0 ? (
            <div className="fc-stage-votes">
              <span><i style={{ background: sideColor(race, "dem") }} />{surname(race.dem)} <b>{commas(rv.dem)}</b> <em>{shareOf(rv.dem, rv.total)}</em></span>
              <span><i style={{ background: GOP }} />{surname(race.gop)} <b>{commas(rv.rep)}</b> <em>{shareOf(rv.rep, rv.total)}</em></span>
              <span>projected turnout <b>{commas(rv.total)}</b></span>
            </div>
          ) : null}
          {race.rcv ? (
            <div className="fc-stage-votes rcv">
              <span>ranked choice final round</span>
              <span><i style={{ background: sideColor(race, "dem") }} />{surname(race.dem)} <b>{commas(race.rcv.dem)}</b> <em>{race.rcv.demPct.toFixed(1)}%</em></span>
              <span><i style={{ background: GOP }} />{surname(race.gop)} <b>{commas(race.rcv.rep)}</b> <em>{race.rcv.repPct.toFixed(1)}%</em></span>
              <span>exhausted <b>{commas(race.rcv.exhausted)}</b></span>
              <span>first choice <b>{fmtMargin(-race.rcv.firstChoice)}</b></span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="fc-stage-map">{stage}</div>

      {isHouse && detail && detail.counties.length > 0 && multiDist ? (
        <div className="fc-stage-layer" role="group" aria-label="Map layer">
          <button className={layer === "district" ? "on" : ""} aria-pressed={layer === "district"} onClick={() => setLayer("district")}>districts</button>
          <button className={layer === "county" ? "on" : ""} aria-pressed={layer === "county"} onClick={() => setLayer("county")}>counties</button>
        </div>
      ) : null}

      {detail && detail.counties.length === 0 ? null : (
        <div className="fc-stage-caption">
          {isHouse
            ? (showDistricts
              ? `all ${stateRaces.length} ${race.state} districts · hover for its projected vote · click to open another`
              : `${race.state} counties · the projected statewide House vote in each, shared by every district in the state`)
            : runnerUpMinor
              ? `county-level projection · shaded by ${indSide(race) ? "the independent" : "the Democrat"} against the Republican, but ${surname(runnerUpMinor.name)} is projected second here · hover a county for the whole ballot`
              : `county-level projection${indSide(race) ? ", the independent against the Republican" : ""} · hover a county for its projected vote`}
        </div>
      )}
      {tipNode}
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
  // Democratic-seat control thresholds, counted over the whole chamber. Ties
  // break Republican — the VP for the Senate — so D needs 51 of 100. The
  // governors are counted the same way the Senate is, over all 50 seats with
  // the 14 not on the 2026 ballot included, so D needs 26.
  const control = office === "house" ? 218 : office === "senate" ? 51 : 26;
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
    // the published OnPoint run carries its own median; prefer it when present
    if (typeof chamber.median === "number") median = chamber.median;
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
              ? "The rule marks 26 \u2014 a majority of all 50 governorships, counting the 14 not on this year\u2019s ballot."
              : "The rule marks control — 218."}
        </p>

        <div className="fc-hist">
          <div className="fc-hist-anno gop">
            <b style={{ color: "var(--fc-gop)" }}>{gopLabel}</b>
            <span>Republican {chamberNoun}</span>
            <em>{gopRuns.toLocaleString()} of {sims.toLocaleString()} simulations</em>
          </div>
          <div className="fc-hist-anno dem">
            <b style={{ color: "var(--fc-dem)" }}>{demLabel}</b>
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
            <line x1="0" x2={W} y1={CH} y2={CH} stroke="currentColor" strokeOpacity={0.14} />
            {entries.map(([s, p]) => {
              const h = Math.max(1.5, (p / maxP) * (CH - 88));
              return (
                <rect key={s} x={xBin(s) - bw / 2} y={CH - h} width={bw} height={h} rx={bw > 4 ? 1.5 : 0.8}
                  fill={s + binW - 1 >= control ? "url(#fcHistD)" : "url(#fcHistR)"} className="fc-hist-bar" />
              );
            })}
            {/* control rule */}
            <line x1={x(control) - (W / span) * 0.5} x2={x(control) - (W / span) * 0.5} y1={26} y2={CH}
              stroke="currentColor" strokeOpacity={0.4} strokeDasharray="2 4" />
            {/* median marker */}
            {(() => {
              const bin = entries.find((e) => median >= e[0] && median < e[0] + binW);
              if (!bin) return null;
              const top = CH - (bin[1] / maxP) * (CH - 88) - 14;
              return (
                <g>
                  <path d={`M${xBin(bin[0]) - 5},${top} h10 l-5,7 z`} fill="currentColor" opacity="0.9" />
                  <text x={xBin(bin[0])} y={top - 8} textAnchor="middle" className="fc-hist-svglabel">median {median}</text>
                </g>
              );
            })()}
            {/* bottom values: bracket ends + the control line, dodging collisions */}
            {(() => {
              // The bracket ends are what the caption underneath names, so they
              // always print. The control tick has its own label above the rule,
              // so it is the one that yields when the two would collide.
              const xc = x(control) - (W / span) * 0.5;
              const out = [
                { v: chamber.demP10, px: bx1, fill: chamber.demP10 >= control ? DEM : GOP, key: "a" },
                { v: chamber.demP90, px: bx2, fill: chamber.demP90 >= control ? DEM : GOP, key: "b" },
              ];
              if (Math.abs(bx1 - xc) > 40 && Math.abs(bx2 - xc) > 40) out.push({ v: control, px: xc, fill: "rgba(var(--fc-ink-rgb),calc(0.75 * var(--fc-mute) + var(--fc-floor)))", key: "c" });
              return out.map((t) => (
                <text key={t.key} x={t.px} y={CH + 46} textAnchor="middle" className="fc-hist-svglabel side" fill={t.fill}>{t.v}</text>
              ));
            })()}
            {/* 80% bracket */}
            <line x1={bx1} x2={bx2} y1={CH + 24} y2={CH + 24} stroke="currentColor" strokeOpacity={0.35} />
            <line x1={bx1} x2={bx1} y1={CH + 20} y2={CH + 28} stroke="currentColor" strokeOpacity={0.35} />
            <line x1={bx2} x2={bx2} y1={CH + 20} y2={CH + 28} stroke="currentColor" strokeOpacity={0.35} />
          </svg>

          <span className="fc-hist-rulelabel" style={{ left: `${((x(control) - (W / span) * 0.5) / W) * 100}%` }}>
            {office === "senate" ? "51 — vp breaks 50\u201350 gop" : `${control} to control`}
          </span>
          <div className="fc-hist-bracket" style={{ left: `${(((bx1 + bx2) / 2) / W) * 100}%` }}>
            the bracket holds the middle 80% of {sims.toLocaleString()} simulations —{" "}
            <b style={{ color: chamber.demP10 >= control ? "var(--fc-dem)" : "var(--fc-gop)" }}>{chamber.demP10}</b> to{" "}
            <b style={{ color: chamber.demP90 >= control ? "var(--fc-dem)" : "var(--fc-gop)" }}>{chamber.demP90}</b> democratic {seatNoun(office, 2)}
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
  const control = office === "house" ? 218 : office === "senate" ? 50 : 26;
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
              <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="currentColor" strokeOpacity={0.04} />
            ))}
            <path d={band(dem)} fill="url(#fcBandD)" />
            <path d={band(gop)} fill="url(#fcBandR)" />
            {control >= min && control <= max ? (
              <line x1="0" x2={W} y1={y(control)} y2={y(control)} stroke="currentColor" strokeOpacity={0.28} strokeDasharray="3 5" />
            ) : null}
            <path d={chartPath(dem, W, H, min, max)} fill="none" stroke={DEM} strokeWidth="2.4" />
            <path d={chartPath(gop, W, H, min, max)} fill="none" stroke={GOP} strokeWidth="2.4" />
            {hi != null ? (
              <g>
                <line x1={(hi / (n - 1)) * W} x2={(hi / (n - 1)) * W} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.28} />
                <circle cx={(hi / (n - 1)) * W} cy={y(dem[hi])} r="4.5" fill={DEM} style={{ stroke: "var(--fc-bg)" }} strokeWidth="1.5" />
                <circle cx={(hi / (n - 1)) * W} cy={y(gop[hi])} r="4.5" fill={GOP} style={{ stroke: "var(--fc-bg)" }} strokeWidth="1.5" />
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
            <span style={{ color: "var(--fc-dem)", top: `${(y(dem[n - 1]) / H) * 100}%` }}>{chamber.demSeats.toFixed(1)}</span>
            <span style={{ color: "var(--fc-gop)", top: `${(y(gop[n - 1]) / H) * 100}%` }}>{chamber.gopSeats.toFixed(1)}</span>
          </div>
          {hi != null ? (
            <div className="fc-xhair" style={{ left: `${(hi / (n - 1)) * 100}%`, transform: hi / (n - 1) > 0.72 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}>
              <em>{dayLabel(updated, n, hi)}</em>
              <span style={{ color: "var(--fc-dem)" }}>D {dem[hi].toFixed(1)}</span>
              <span style={{ color: "var(--fc-gop)" }}>R {gop[hi].toFixed(1)}</span>
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
              <line key={g} x1="0" x2={W} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.05} />
            ))}
            <line x1="0" x2={W} y1={y(50)} y2={y(50)} stroke="currentColor" strokeOpacity={0.24} strokeDasharray="3 5" />
            <path d={area(dem)} fill="url(#fcProbD)" />
            <path d={area(gop)} fill="url(#fcProbR)" />
            <path d={chartPath(dem, W, H, 0, 100)} fill="none" stroke={DEM} strokeWidth="2.4" />
            <path d={chartPath(gop, W, H, 0, 100)} fill="none" stroke={GOP} strokeWidth="2.4" />
            {hi != null ? (
              <g>
                <line x1={(hi / (n - 1)) * W} x2={(hi / (n - 1)) * W} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.28} />
                <circle cx={(hi / (n - 1)) * W} cy={y(dem[hi])} r="4.5" fill={DEM} style={{ stroke: "var(--fc-bg)" }} strokeWidth="1.5" />
                <circle cx={(hi / (n - 1)) * W} cy={y(gop[hi])} r="4.5" fill={GOP} style={{ stroke: "var(--fc-bg)" }} strokeWidth="1.5" />
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
            <span style={{ color: "var(--fc-dem)", top: `${(y(dem[n - 1]) / H) * 100}%` }}>{dem[n - 1].toFixed(1)}%</span>
            <span style={{ color: "var(--fc-gop)", top: `${(y(gop[n - 1]) / H) * 100}%` }}>{gop[n - 1].toFixed(1)}%</span>
          </div>
          {hi != null ? (
            <div className="fc-xhair" style={{ left: `${(hi / (n - 1)) * 100}%`, transform: hi / (n - 1) > 0.72 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}>
              <em>{dayLabel(updated, n, hi)}</em>
              <span style={{ color: "var(--fc-dem)" }}>D {dem[hi].toFixed(1)}%</span>
              <span style={{ color: "var(--fc-gop)" }}>R {gop[hi].toFixed(1)}%</span>
            </div>
          ) : null}
        </div>
        <div className="fc-chart-x"><span>sixty days ago</span><span>today</span></div>
      </div>
    </section>
  );
}

// ── races table ──────────────────────────────────────────────────────────────
function RaceTable({ rows, onPick }: { rows: Race[]; onPick: (id: string) => void }) {
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
        const s = r.est;
        const fav = s.margin > 0 ? "gop" : "dem";
        const ind = indSide(r);
        const tone = sideColor(r, fav);
        const favProb = fav === "gop" ? s.prob : 1 - s.prob;
        const rt = ratingFor(s.margin, ind);
        return (
          <button key={r.id} className="fc-tr" role="row" onClick={() => onPick(r.id)}>
            <span role="cell" className="fc-td-name">
              <b>{r.name}</b>
              <em>{r.marquee ? "marquee · " : ""}{r.open ? "open seat" : "incumbent running"}</em>
            </span>
            <span role="cell" className="fc-td-cands">
              <span><i className={ind ? "i" : "d"}>{ind ? "I" : "D"}</i>{r.dem}</span>
              <span><i className="r">R</i>{r.gop}</span>
            </span>
            <span role="cell" className="fc-td-margin num" style={{ color: s.margin > 0 ? "var(--fc-gop)" : ind ? IND : "var(--fc-dem)" }}>{fmtRaceMargin(r, s.margin)}</span>
            <span role="cell" className="fc-td-bar"><MarginBar m={s.margin} p10={s.p10} p90={s.p90} /></span>
            <span role="cell" className="fc-td-prob num">{fmtPct(favProb, 1)}</span>
            <span role="cell"><RatingChip color={rt.color} cat={rt.cat} /></span>
            <span role="cell"><Spark pts={r.trend.map((t) => 100 - t.p * 100)} color={tone} /></span>
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
          <line x1="0" x2={W} y1={CH} y2={CH} stroke="currentColor" strokeOpacity={0.14} />
          <path d={area} fill="url(#fcOdD)" clipPath="url(#fcOdClipD)" />
          <path d={area} fill="url(#fcOdR)" clipPath="url(#fcOdClipR)" />
          <path d={line} fill="none" stroke="currentColor" strokeOpacity={0.4} strokeWidth="1.4" />
          {/* even line */}
          <line x1={xOf(0)} x2={xOf(0)} y1={14} y2={CH} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="2 4" />
          {/* 80% interval ticks */}
          {[s.p10, s.p90].map((v, i) => (
            <line key={i} x1={xOf(v)} x2={xOf(v)} y1={CH - 12} y2={CH} stroke="currentColor" strokeOpacity={0.5} strokeWidth="1.4" />
          ))}
          {/* median needle */}
          <line x1={medianX} x2={medianX} y1={8} y2={CH} stroke={tone} strokeWidth="2.2"
            style={{ filter: `drop-shadow(0 0 8px ${tone}aa)` }} />
        </svg>
        <span className="fc-outcome-median" style={{
          left: `${(medianX / W) * 100}%`, color: s.margin > 0 ? "var(--fc-gop)" : "var(--fc-dem)",
          transform: medianX / W > 0.8 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
        }}>
          {surname(fav)} +{Math.abs(s.margin).toFixed(1)}
        </span>
        {[s.p10, s.p90].map((v, i) => (
          <span key={i} className="fc-outcome-tick" style={{ left: `${(xOf(v) / W) * 100}%`, color: v > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{fmtRaceMargin(race, v)}</span>
        ))}
        <div className="fc-outcome-axis">
          {[-30, -15, 0, 15, 30].map((v) => (
            <span key={v} style={{ left: `${(xOf(v) / W) * 100}%`, color: v === 0 ? "rgba(var(--fc-ink-rgb),calc(0.45 * var(--fc-mute) + var(--fc-floor)))" : v > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>
              {v === 0 ? "even" : v > 0 ? `R+${v}` : `D+${-v}`}
            </span>
          ))}
        </div>
      </div>
      <div className="fc-outcome-note">
        the ticks bracket the middle 80% of simulations — <b style={{ color: s.p10 > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{fmtRaceMargin(race, s.p10)}</b> to{" "}
        <b style={{ color: s.p90 > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{fmtRaceMargin(race, s.p90)}</b>
      </div>
    </div>
  );
}

// ── the estimate waterfall: each methodology layer pulls the number ──────────
function StageFlow({ race, env, sims }: {
  race: Race; env: { npe: number; gb: number; approval: number }; sims: number;
}) {
  const st = race.stages;
  const complete = true;   // the desk runs all six stages; there is no shorter cut any more
  const s = race.est;
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
      cap: <>presidential lean <b style={{ color: st.anchor > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{fmtRaceMargin(race, st.anchor)}</b> — the last two presidential results, candidate record priced in</>,
    },
    {
      k: "the environment", v: st.fund, on: true, carry: `${fundShare}%`,
      cap: <>a <b style={{ color: env.npe > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{env.npe > 0 ? `R+${Math.abs(env.npe).toFixed(1)}` : `D+${Math.abs(env.npe).toFixed(1)}`}</b> national
        environment lands through ×{race.elast.toFixed(2)} elasticity · {race.open ? "open seat" : "incumbent running"}</>,
    },
    {
      k: "the polls", v: st.poll, on: true, carry: `${pollShare}%`,
      cap: race.pollAvg != null
        ? <>{race.enop.toFixed(1)} effective polls averaging <b style={{ color: race.pollAvg > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{fmtRaceMargin(race, race.pollAvg)}</b> · weights decay with age and pollster record</>
        : <>no usable polling — the fundamentals carry through untouched</>,
    },
    {
      k: "expert ratings", v: st.rate, on: complete,
      cap: complete ? (
        <>
          <span className="fc-flow-chips">
            {race.ratings.map((rt) => {
              const band = RATING_BANDS.find((b) => b.cat.toLowerCase() === rt.cat.toLowerCase());
              const c = band ? band.color : "rgba(var(--fc-ink-rgb),calc(0.6 * var(--fc-mute) + var(--fc-floor)))";
              return <RatingChip key={rt.outlet} color={c} cat={rt.cat} outlet={rt.outlet} />;
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
          ? <><b style={{ color: race.market.q > 0.5 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{fmtPct(Math.max(race.market.q, 1 - race.market.q), 0)}</b> implied {surname(mktFav!)} · liquidity {(race.market.liquidity * 100).toFixed(0)} · trade-vs-book λ blend</>
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
          <b style={{ color: lo > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{fmtRaceMargin(race, lo)}</b>
          <i />
          <b style={{ color: hi > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{fmtRaceMargin(race, hi)}</b>
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
                {row.on ? row.cap : "no usable input at this stage"}
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
                    left: `${x(row.v)}%`, color: row.v > 0 ? "var(--fc-gop)" : "var(--fc-dem)",
                    transform: labelLeft ? "translate(calc(-100% - 9px), -50%)" : "translate(9px, -50%)",
                  }}>
                    {fmtRaceMargin(race, row.v)}{moved ? <em> {row.v < from! ? "←" : "→"} {Math.abs(row.v - from!).toFixed(1)}</em> : null}
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
          <p className="fc-flow-cap">all six stages · {sims.toLocaleString()} simulations run on it today</p>
        </div>
        <div className="fc-flow-track final">
          {zeroIn ? <i className="fc-flow-even" style={{ left: `${x(0)}%` }} /> : null}
          <i className="fc-flow-dot final" style={{ left: `${x(final)}%`, background: tone, boxShadow: `0 0 14px ${tone}aa` }} />
          <b className="fc-flow-val final" style={{
            left: `${x(final)}%`, color: final > 0 ? "var(--fc-gop)" : "var(--fc-dem)",
            transform: x(final) > 70 ? "translate(calc(-100% - 11px), -50%)" : "translate(11px, -50%)",
          }}>
            {fmtRaceMargin(race, final)} <em>· {surname(fav)} {fmtPct(favProb)} to win</em>
          </b>
        </div>
      </div>
    </div>
  );
}

// ── selected-race sections ───────────────────────────────────────────────────
// ── simulated crosstabs ───────────────────────────────────────
// Every statewide race carries an estimated exit poll: 54 groups read off the
// simulated voter file, not asked of anyone. It loads on its own the first time
// a statewide race is opened, because the national page never needs it.
function SectionCrosstabs({ race }: { race: Race }) {
  const data = useJson<Crosstabs>(race.office === "house" ? null : "/forecast/crosstabs.json");
  const rows = data ? data[race.id] ?? null : null;
  const [cut, setCut] = useState<string>(OVERVIEW);
  useEffect(() => { setCut(OVERVIEW); }, [race.id]);
  if (race.office === "house") return null;

  const total = rows ? rows.find((r) => r[0] === "All voters") ?? null : null;
  const cats: { name: string; rows: CrosstabRow[] }[] = [];
  for (const r of rows ?? []) {
    if (r[0] === "All voters") continue;
    const last = cats[cats.length - 1];
    if (last && last.name === r[0]) last.rows.push(r);
    else cats.push({ name: r[0], rows: [r] });
  }
  // the third party column only earns its place where somebody is actually there
  const showO = (rows ?? []).some((r) => r[5] >= 0.5);
  const dNm = surname(race.dem), rNm = surname(race.gop);
  const marg = (r: CrosstabRow) => r[4] - r[3];   // GOP positive, as everywhere else
  const allMargin = total ? marg(total) : 0;

  // Which groups actually decide the race. A group's pull is its share of the
  // electorate times how far its margin sits from the statewide one: a lopsided
  // sliver and an evenly split bloc both move the result very little, and this
  // is the product that separates them. Positive pull drags the race
  // Republican relative to the state as a whole, negative drags it Democratic.
  const pulls = cats
    .flatMap((c) => c.rows.map((r) => ({ cut: c.name, row: r, pull: (r[2] / 100) * (marg(r) - allMargin) })))
    .sort((a, b) => Math.abs(b.pull) - Math.abs(a.pull))
    .slice(0, 10);

  const nGroups = cats.reduce((n, c) => n + c.rows.length, 0);

  const line = (r: CrosstabRow) => {
    const lead = r[3] >= r[4] ? "d" : "r";
    return (
      <tr key={r[0] + r[1]}>
        <td className="g">
          <span>{r[1]}</span>
          <span className="fc-xt-bar" aria-hidden>
            <i style={{ width: `${r[3]}%`, background: DEM }} />
            <i style={{ width: `${Math.max(0, r[5])}%`, background: "rgba(var(--fc-ink-rgb),calc(0.28 * var(--fc-struct)))" }} />
            <i style={{ width: `${r[4]}%`, background: GOP }} />
          </span>
        </td>
        <td className="sh">{r[2].toFixed(1)}</td>
        <td className={lead === "d" ? "lead" : ""} style={{ color: "var(--fc-dem)" }}>{r[3].toFixed(1)}</td>
        <td className={lead === "r" ? "lead" : ""} style={{ color: "var(--fc-gop)" }}>{r[4].toFixed(1)}</td>
        {showO ? <td className="sh">{r[5].toFixed(1)}</td> : null}
        <td className="mg"><i style={{ background: ratingFor(marg(r)).color, color: inkOn(ratingFor(marg(r)).color) }}>{fmtRaceMargin(race, marg(r))}</i></td>
      </tr>
    );
  };
  const head = (
    <tr>
      <th>Group</th><th className="sh">Share</th><th>{dNm}</th><th>{rNm}</th>
      {showO ? <th className="sh">Other</th> : null}<th className="mg">Margin</th>
    </tr>
  );
  const oneTable = (c: { name: string; rows: CrosstabRow[] }) => (
    <table className="fc-xt" key={c.name}>
      <thead>{head}</thead>
      <tbody>{c.rows.map(line)}</tbody>
    </table>
  );

  return (
    <section className="fc-sec">
      <div className="fc-shell">
        <Eyebrow>simulated crosstabs</Eyebrow>
        <h2 className="fc-h2">how {race.state} is projected to vote<em>.</em></h2>
        <p className="fc-body">
          Estimates for the {race.name} race read off the simulated voter file, not asked of anyone. Every
          county&rsquo;s adults are rebuilt as TPSI respondents matched on age, race, college, party and vote history,
          each one given a chance of turning out and a vote, and then summed by group. Share is the group&rsquo;s
          portion of projected voters; the candidate columns are percent of that group. Margins run Republican positive,
          as they do everywhere else on this page.
        </p>

        {!rows ? (
          <div className="fc-map-loading"><span /><em>reading the simulated electorate…</em></div>
        ) : (
          <>
            {total ? (
              <div className="fc-xt-total">
                <div className="k">All projected voters</div>
                <div className="v">
                  <span style={{ color: "var(--fc-dem)" }}>{dNm} <b>{total[3].toFixed(1)}</b></span>
                  <span style={{ color: "var(--fc-gop)" }}>{rNm} <b>{total[4].toFixed(1)}</b></span>
                  {showO ? <span>other <b>{total[5].toFixed(1)}</b></span> : null}
                  <span className="mg" style={{ background: ratingFor(allMargin).color, color: inkOn(ratingFor(allMargin).color) }}>{fmtRaceMargin(race, allMargin)}</span>
                </div>
              </div>
            ) : null}

            {/* one cut at a time — the whole table set is 50-odd rows and nobody
                should have to scroll past all of it to reach the one they want */}
            <div className="fc-xt-tabs" role="tablist" aria-label="Crosstab groups">
              {[OVERVIEW, ...cats.map((c) => c.name), ALLCUTS].map((name) => (
                <button key={name} role="tab" aria-selected={cut === name}
                  className={`fc-xt-tab${cut === name ? " on" : ""}${name === OVERVIEW || name === ALLCUTS ? " alt" : ""}`}
                  onClick={() => setCut(name)}>
                  {name}
                  {name !== OVERVIEW && name !== ALLCUTS
                    ? <em>{(cats.find((c) => c.name === name)?.rows.length) ?? 0}</em>
                    : null}
                </button>
              ))}
            </div>

            <div className="fc-xt-panel" role="tabpanel">
              {cut === OVERVIEW ? (
                <>
                  <h3 className="fc-xt-ph">where the race is decided</h3>
                  <p className="fc-xt-pn">
                    Each group&rsquo;s share of projected voters times how far its margin sits from the
                    statewide {fmtRaceMargin(race, allMargin)}. Blocs at the top are the ones actually moving this
                    result; a lopsided sliver of the electorate moves it very little. Pick any cut above
                    for its full table.
                  </p>
                  <table className="fc-xt lead-table">
                    <thead>
                      <tr><th>Group</th><th className="sh">Cut</th><th className="sh">Share</th><th className="mg">Margin</th><th className="mg">Pull</th></tr>
                    </thead>
                    <tbody>
                      {pulls.map(({ cut: cn, row: r, pull }) => (
                        <tr key={cn + r[1]} onClick={() => setCut(cn)} className="clickable" tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCut(cn); } }}>
                          <td className="g"><span>{r[1]}</span></td>
                          <td className="sh">{cn}</td>
                          <td className="sh">{r[2].toFixed(1)}</td>
                          <td className="mg"><i style={{ background: ratingFor(marg(r)).color, color: inkOn(ratingFor(marg(r)).color) }}>{fmtRaceMargin(race, marg(r))}</i></td>
                          <td className="mg pull" style={{ color: pull > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>
                            {pull > 0 ? "R" : "D"}+{Math.abs(pull).toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : cut === ALLCUTS ? (
                <div className="fc-xt-grid">
                  {cats.map((c) => (
                    <div key={c.name} className="fc-xt-card">
                      <h3>{c.name}</h3>
                      <div className="fc-xt-scroll">{oneTable(c)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                (() => {
                  const c = cats.find((x) => x.name === cut);
                  return c ? <div className="fc-xt-one">{oneTable(c)}</div> : null;
                })()
              )}
            </div>

            <p className="fc-note" style={{ marginTop: 14 }}>
              {nGroups} groups across {cats.length} cuts. Approval, economic and issue rows cover the voters
              who were asked those questions. Groups under 1 percent of projected voters are not shown.
              Figures are model estimates and are rounded, so columns need not total exactly 100.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

// ── the projected ballot ──────────────────────────────────────
// The odds block above is a two way question and stays that way: who wins. This
// is the other question, what the ballot actually looks like, and it carries every
// name the model prices. It only renders where there is more than a Democrat and a
// Republican, so a straight two way race is not given a section that says nothing.
function SectionBallot({ race }: { race: Race }) {
  const cands = race.cands;
  if (!cands || cands.length < 3) return null;
  const ranked = [...cands].sort((a, b) => b.pct - a.pct);
  const top = ranked[0]?.pct ?? 0;
  const known = ranked.reduce((a, c) => a + c.pct, 0);
  const rest = Math.max(0, 100 - known);
  return (
    <div className="fc-ballot">
      <div className="fc-ballot-h">
        <span>projected ballot</span>
        <span>{race.votes ? `${commas(race.votes.total)} votes projected` : `${ranked.length} candidates`}</span>
      </div>
      <div className="fc-ballot-bar" role="img"
        aria-label={ranked.map((c) => `${c.name} ${c.pct.toFixed(1)} percent`).join(", ")}>
        {ranked.map((c, i) => (
          <i key={`${c.name}-${i}`} style={{ width: `${c.pct}%`, background: partyColor(c.party) }} />
        ))}
        {rest > 0.05 ? <i style={{ width: `${rest}%`, background: "rgba(var(--fc-ink-rgb),calc(0.18 * var(--fc-mute) + var(--fc-floor)))" }} /> : null}
      </div>
      <div className="fc-ballot-list">
        {ranked.map((c, i) => (
          <div key={`${c.name}-${i}`} className="fc-ballot-row">
            <i style={{ background: partyColor(c.party) }} />
            <div className="fc-ballot-id">
              <b>{c.name}</b>
              {/* The incumbent tag belongs to one person, not to a party. Alaska runs
                  three Republicans, so keying it off the party put "incumbent" on Dan J.
                  Sullivan and Gerald Heikes as well as on the senator. Match the name. */}
              <em>{partyLabel(c.party)}
                {!race.open && ((race.inc < 0 && c.name === race.dem) || (race.inc > 0 && c.name === race.gop)) ? " · incumbent" : ""}
              </em>
            </div>
            <div className="fc-ballot-num">
              <b style={{ color: partyColor(c.party) }}>{c.pct.toFixed(1)}%</b>
              <em>{commas(c.votes)}</em>
            </div>
            <div className="fc-ballot-track"><i style={{ width: `${top > 0 ? (c.pct / top) * 100 : 0}%`, background: partyColor(c.party) }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RaceSections({ race, byId, onPick, sims, updated, env }: {
  race: Race; byId: Map<string, Race>; onPick: (id: string) => void; sims: number; updated: string;
  env: { npe: number; gb: number; approval: number };
}) {
  const light = useLightMode();
  const s = race.est;
  const demProb = 1 - s.prob;
  const demTone = sideColor(race, "dem");
  const trend = race.trend;
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
                  { name: race.dem, party: "D", tone: sideColor(race, "dem"), prob: demProb, label: dLab, margin: -s.margin },
                  { name: race.gop, party: "R", tone: GOP, prob: s.prob, label: rLab, margin: s.margin },
                ].sort((a, b) => b.prob - a.prob);
              })().map((c) => (
                <div key={c.party} className="fc-score-row">
                  <div className="fc-score-id">
                    <b>{c.name}</b>
                    <em>{sideLabel(race, c.party === "D" ? "dem" : "gop")}
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
              <div className="fc-h2h-x"><span style={{ color: "var(--fc-dem)" }}>{surname(race.dem)}</span><span style={{ color: "var(--fc-gop)" }}>{surname(race.gop)}</span></div>
            </div>
            <div className="fc-odds-dial">
              <SwingOMeter
                c1Name={race.dem} c2Name={race.gop}
                c1Color={light ? "#1d5fc4" : "#3b7bde"} c2Color={light ? "#c22f3b" : "#d64550"}
                c1Prob={demProb} c2Prob={s.prob}
                reportingPct={0}
                marginPp={Math.abs(s.margin)}
                fixedOrientation
              />
            </div>
          </div>
          <SectionBallot race={race} />
          {isUncontested(race) ? (
            <p className="fc-uncontested-note">
              No distribution is drawn for this race. The build parks an unpriced ballot at a
              flat 100 points, so a curve here would be a picture of that placeholder rather
              than of 2,000 simulations.
            </p>
          ) : (
            <OutcomeDist race={race} s={s} sims={sims} />
          )}
        </div>
      </section>

      {/* the tracker */}
      <section className="fc-sec">
        <div className="fc-shell">
          <Eyebrow>the tracker</Eyebrow>
          <h2 className="fc-h2">sixty days of this race<em>.</em></h2>
          <div className="fc-chartwrap" onMouseMove={thover.onMove} onMouseLeave={thover.onLeave}>
            <svg viewBox={`0 0 ${W} ${H}`} className="fc-chart" role="img" aria-label="Race win-probability trend" preserveAspectRatio="none">
              <line x1="0" x2={W} y1={y(50)} y2={y(50)} stroke="currentColor" strokeOpacity={0.22} strokeDasharray="3 5" />
              <path d={`${chartPath(demPts, W, H, 0, 100)}L${W},${H}L0,${H}Z`} fill={demTone} opacity="0.07" />
              <path d={chartPath(demPts, W, H, 0, 100)} fill="none" stroke={demTone} strokeWidth="2.4" />
              <path d={chartPath(demPts.map((v) => 100 - v), W, H, 0, 100)} fill="none" stroke={GOP} strokeWidth="2.4" />
              {ti != null ? (
                <g>
                  <line x1={(ti / (demPts.length - 1)) * W} x2={(ti / (demPts.length - 1)) * W} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.28} />
                  <circle cx={(ti / (demPts.length - 1)) * W} cy={y(demPts[ti])} r="4.5" fill={demTone} style={{ stroke: "var(--fc-bg)" }} strokeWidth="1.5" />
                  <circle cx={(ti / (demPts.length - 1)) * W} cy={y(100 - demPts[ti])} r="4.5" fill={GOP} style={{ stroke: "var(--fc-bg)" }} strokeWidth="1.5" />
                </g>
              ) : (
                <g>
                  <circle cx={W} cy={y(demPts[demPts.length - 1])} r="4" fill={demTone} />
                  <circle cx={W} cy={y(100 - demPts[demPts.length - 1])} r="4" fill={GOP} />
                </g>
              )}
            </svg>
            <span className="fc-chart-tag" style={{ top: `${(y(50) / H) * 100}%` }}>even odds</span>
            <div className="fc-chart-ends">
              <span style={{ color: "var(--fc-dem)", top: `${(y(demPts[demPts.length - 1]) / H) * 100}%` }}>{surname(race.dem)} {fmtPct(demProb)}</span>
              <span style={{ color: "var(--fc-gop)", top: `${(y(100 - demPts[demPts.length - 1]) / H) * 100}%` }}>{surname(race.gop)} {fmtPct(s.prob)}</span>
            </div>
            {ti != null ? (
              <div className="fc-xhair" style={{ left: `${(ti / (demPts.length - 1)) * 100}%`, transform: ti / (demPts.length - 1) > 0.72 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}>
                <em>{dayLabel(updated, demPts.length, ti)}</em>
                <span style={{ color: "var(--fc-dem)" }}>{surname(race.dem)} {demPts[ti].toFixed(0)}%</span>
                <span style={{ color: "var(--fc-gop)" }}>{surname(race.gop)} {(100 - demPts[ti]).toFixed(0)}%</span>
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
            <span role="listitem">national environment <b style={{ color: env.npe > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{env.npe > 0 ? "R" : "D"}+{Math.abs(env.npe).toFixed(1)}</b></span>
            <span role="listitem">generic ballot <b style={{ color: env.gb > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{env.gb > 0 ? "R" : "D"}+{Math.abs(env.gb).toFixed(1)}</b></span>
            <span role="listitem">net approval <b style={{ color: "var(--fc-gop)" }}>{env.approval}</b></span>
            <span role="listitem"><b className="lime">{sims.toLocaleString()}</b> sims run today</span>
          </div>
          <StageFlow race={race} env={env} sims={sims} />

          {race.polls.length ? (
            <div className="fc-polls">
              <div className="fc-polls-h"><span>latest polls</span><span>weighted by recency · pollster record · sponsorship</span></div>
              {race.polls.map((p, i) => (
                <div key={i} className="fc-poll">
                  <b>{p.pollster}{p.grade ? <i className="fc-grade">{p.grade}</i> : null}</b>
                  <i className={`fc-kind ${p.kind !== "public" ? "flag" : ""}`}>{p.kind}</i>
                  <span>{p.age}d ago · n={p.n}</span>
                  <em style={{ color: p.margin > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{fmtRaceMargin(race, p.margin)}</em>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <SectionCrosstabs race={race} />

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
              const so = other.est;
              return (
                <button key={sim.id} className="fc-simchip" onClick={() => onPick(sim.id)}>
                  <b>{other.name}</b>
                  <span style={{ color: so.margin > 0 ? "var(--fc-gop)" : indSide(other) ? IND : "var(--fc-dem)" }}>{fmtRaceMargin(other, so.margin)}</span>
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
/* @import must be the first rule in a sheet or the parser drops it. It was
   sitting a hundred lines down, so Oswald never loaded and every heading fell
   back to the system condensed face. */
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap');

/* ── theme tokens ──────────────────────────────────────────────────────────
   The desk is dark by default and the site sets data-theme on <html>, so the
   base below is the dark rendering and the [data-theme="light"] block is the
   inversion. Every rule downstream keeps its own alpha.

   This used to be three near-identical copies of the same block, and the last
   two set --fc-bg and --fc-ink to var(--fc-bg) and var(--fc-ink). A custom
   property that references itself is a cycle, which is invalid at computed-value
   time, so both resolved to nothing. Light mode still worked because the light
   block assigns literals; dark mode had no background at all, fell through to
   the site's light canvas, and then painted near-white ink on it. That is the
   washed-out page. One block, literal values, no cycles. */
:root {
  --fc-bg: #050505;
  --fc-bg-rgb: 5,5,5;
  --fc-ink: #f4f4ef;
  --fc-ink-rgb: 244,244,239;
  --fc-line-rgb: 255,255,255;        /* hairlines and panel fills, as overlays */
  --fc-band: #08080a;                /* the lifted band behind the distribution */
  --fc-idle: #0b0c10;                /* a unit with no race in it */
  --fc-idle-line: rgba(5,5,7,0.55);  /* the hairline between map units */
  --fc-elev: rgba(10,11,15,0.94);    /* tooltips and crosshairs, above the page */
  --fc-elev-shadow: 0 24px 60px rgba(0,0,0,0.6);
  --fc-dem: #3b7bde; --fc-dem-rgb: 59,123,222;
  --fc-gop: #d64550; --fc-gop-rgb: 214,69,80;
  --fc-accent: #8a63ef;
  --fc-gold: #e0b34c; --fc-gold-rgb: 224,179,76;
  --fc-mute: 1; --fc-floor: 0.13; --fc-struct: 1.25;
  --fc-shadow: none;
}
:root[data-theme="light"] {
  --fc-bg: #f7f7f4;
  --fc-bg-rgb: 247,247,244;
  --fc-ink: #17171b;
  --fc-ink-rgb: 23,23,27;
  --fc-line-rgb: 23,23,27;
  --fc-band: #f1f1ed;
  --fc-idle: #e4e4de;
  --fc-idle-line: rgba(23,23,27,0.28);
  /* The raised surface has to be a light panel here. It was written as
     rgba(var(--fc-line-rgb),0.97), and in light mode the line colour IS the ink,
     so every tooltip came out a near-black card carrying near-black text. */
  --fc-elev: rgba(255,255,255,0.97);
  --fc-elev-shadow: 0 18px 44px rgba(23,23,27,0.16);
  /* the site's own light-theme party colours — the dark-lifted pair sits just
     under AA as text on white */
  --fc-dem: #1d5fc4; --fc-dem-rgb: 29,95,196;
  --fc-gop: #c22f3b; --fc-gop-rgb: 194,47,59;
  --fc-accent: #5a2fd4;
  --fc-gold: #7a5a10; --fc-gold-rgb: 122,90,16;
  --fc-mute: 1.05; --fc-floor: 0.24; --fc-struct: 1.5;
  --fc-shadow: 0 1px 2px rgba(23,23,27,0.04), 0 2px 10px rgba(23,23,27,0.06);
}

html, body { background: var(--fc-bg, #050505) !important; }
html { height: auto !important; overflow-y: auto !important; }
body { height: auto !important; min-height: 100svh; overflow: visible !important; overflow-x: clip !important; }
body main > div { max-width: none !important; padding-left: 0 !important; padding-right: 0 !important; }
body main > div > div { padding-top: 0 !important; padding-bottom: 0 !important; }

.fc-page { position: relative; min-height: 100svh; color: var(--fc-ink); background: var(--fc-bg); overflow-x: clip;
  font-family: var(--font-body); font-size: 15px; letter-spacing: -0.01em;
  width: 100vw; margin-left: calc(50% - 50vw); }
.fc-page h1, .fc-page h2, .fc-page h3 { text-transform: none; margin: 0; font-family: var(--font-display); font-weight: 500; letter-spacing: -0.02em; }
.fc-shell { position: relative; z-index: 2; max-width: 1280px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 44px); }
.fc-grain { position: fixed; inset: -40px; z-index: 3; pointer-events: none; opacity: 0.045; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E"); }

.fc-loading { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 70svh; color: rgba(var(--fc-ink-rgb),calc(0.55 * var(--fc-mute) + var(--fc-floor))); font-size: 14px; }
.fc-loading span, .fc-map-loading span { width: 8px; height: 8px; border-radius: 99px; background: var(--brand-grad); animation: fcPulse 1.4s ease-in-out infinite; }
.fc-loading em, .fc-map-loading em { font-style: normal; }
@keyframes fcPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }

.fc-eyebrow { display: inline-flex; align-items: center; gap: 9px; font-family: ${MONO}; font-size: 11.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.5 * var(--fc-mute) + var(--fc-floor))); }
.fc-eyebrow-mk { width: 7px; height: 7px; background: var(--brand-grad); border-radius: 1.5px; flex-shrink: 0; }
.fc-eyebrow-pip { width: 6px; height: 6px; border-radius: 99px; background: #e23950; box-shadow: 0 0 0 3px rgba(226,57,80,0.16); animation: fcPulse 1.8s ease-in-out infinite; }
.fc-h2 { font-size: clamp(26px, 3.4vw, 42px); font-weight: 500; letter-spacing: -0.03em; line-height: 1.06; text-transform: lowercase; color: var(--fc-ink); margin-top: 14px; }
.fc-h2 em, .fc-h1 em { font-style: normal; color: var(--fc-accent); }
.fc-body { margin-top: 14px; max-width: 56ch; font-size: 15px; line-height: 1.6; color: rgba(var(--fc-ink-rgb),calc(0.58 * var(--fc-mute) + var(--fc-floor))); }

.fc-status { position: sticky; top: 0; z-index: 40; background: rgba(var(--fc-bg-rgb),0.82); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(var(--fc-line-rgb),0.07); }
.fc-status-in { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px clamp(20px,4vw,44px); font-size: 10.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.42 * var(--fc-mute) + var(--fc-floor))); }
.fc-status-in em { font-style: normal; color: rgba(var(--fc-ink-rgb),calc(0.36 * var(--fc-mute) + var(--fc-floor))); margin: 0 6px; }
.fc-pip { display: inline-block; width: 6px; height: 6px; border-radius: 99px; background: #e23950; margin-right: 7px; animation: fcPulse 1.8s ease-in-out infinite; }

.fc-head { max-width: 980px; margin: clamp(34px, 6vh, 64px) auto 0; padding: 0 clamp(20px,4vw,44px); text-align: center; }
.fc-h1 { margin-top: 18px; font-size: clamp(34px, 4.6vw, 58px); font-weight: 500; letter-spacing: -0.035em; line-height: 1.08; text-transform: lowercase; color: var(--fc-ink); }
.fc-h1 b { font-weight: 800; }
.fc-updated { margin-top: 16px; font-family: ${MONO}; font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); }
.fc-envline { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; margin-top: 12px; font-size: 13px; font-weight: 500; color: rgba(var(--fc-ink-rgb),calc(0.5 * var(--fc-mute) + var(--fc-floor))); }
.fc-envline b { font-weight: 800; font-variant-numeric: tabular-nums; }
.fc-envline em { font-style: normal; color: rgba(var(--fc-ink-rgb),calc(0.36 * var(--fc-mute) + var(--fc-floor))); }

.fc-seatbar { max-width: 980px; margin: clamp(26px, 4.4vh, 44px) auto 0; }
.fc-seatbar-ends { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 15px; font-weight: 600; }
.fc-seatbar-ends b { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
.fc-seatbar-mid { font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.35 * var(--fc-mute) + var(--fc-floor))); }
.fc-seatbar-track { position: relative; height: 12px; margin-top: 10px; border-radius: 99px; overflow: hidden; background: linear-gradient(90deg, #b62c3c, #a01426); }
.fc-seatbar-fill { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #183685, #3b6fde); }
.fc-seatbar-tick { position: absolute; top: -2px; bottom: -2px; width: 2.5px; background: var(--fc-ink); box-shadow: 0 0 8px rgba(var(--fc-bg-rgb),0.8); }
.fc-seatbar-note { margin-top: 8px; text-align: center; font-size: 11.5px; color: rgba(var(--fc-ink-rgb),calc(0.38 * var(--fc-mute) + var(--fc-floor))); }

.fc-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-top: clamp(24px, 4vh, 40px); scroll-margin-top: 60px; }
.fc-controls-r { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fc-ctl-label { font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.38 * var(--fc-mute) + var(--fc-floor))); }
.fc-seg { display: inline-flex; padding: 3px; border: 1px solid rgba(var(--fc-line-rgb),0.12); border-radius: 10px; background: rgba(var(--fc-line-rgb),0.03); }
.fc-seg button { appearance: none; border: 0; background: none; cursor: pointer; padding: 9px 18px; border-radius: 8px;
  font-family: inherit; font-size: 14px; font-weight: 600; color: rgba(var(--fc-ink-rgb),calc(0.55 * var(--fc-mute) + var(--fc-floor))); letter-spacing: -0.01em; transition: color .15s ease, background .15s ease; }
.fc-seg button:hover { color: rgba(var(--fc-ink-rgb),calc(0.85 * var(--fc-mute) + var(--fc-floor))); }
.fc-seg button.on { background: var(--fc-ink); color: var(--fc-bg); }
.fc-seg.sm button { padding: 6px 12px; font-size: 12.5px; }
.fc-seg button:focus-visible { outline: 2px solid #6d3ee9; outline-offset: 2px; }

.fc-mapwrap { position: relative; margin-top: clamp(18px, 3vh, 30px); }
.fc-map { display: block; width: min(1180px, 96vw); margin: 0 auto; overflow: visible; }
.fc-map.race { width: min(760px, 92vw); }
.fc-map-idle { fill: var(--fc-idle); stroke: rgba(var(--fc-ink-rgb),calc(0.06 * var(--fc-struct))); stroke-width: 0.8; }
.fc-map-race { stroke: rgba(5,5,7,0.6); stroke-width: 0.7; cursor: pointer; transition: filter .15s ease; }
.fc-map-race.cd { stroke: rgba(5,5,7,0.5); stroke-width: 0.45; }
.fc-map-race:hover { filter: brightness(1.25); }
.fc-map-stateline { fill: none; stroke: rgba(var(--fc-ink-rgb),calc(0.3 * var(--fc-mute) + var(--fc-floor))); stroke-width: 0.9; pointer-events: none; }
.fc-map-halo { fill: none; stroke: var(--fc-ink); stroke-width: 1.6; pointer-events: none; }
.fc-map-loading { display: flex; align-items: center; justify-content: center; gap: 12px; height: 420px; color: rgba(var(--fc-ink-rgb),calc(0.5 * var(--fc-mute) + var(--fc-floor))); font-size: 13.5px; }
.fc-map-loading.static { height: 120px; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }
.fc-map.anim { animation: fcMapIn 420ms cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fcMapIn { from { opacity: 0; transform: scale(0.985); } to { opacity: 1; transform: none; } }
.fc-hex { stroke: rgba(5,5,7,0.65); stroke-width: 1; cursor: pointer; transition: filter .15s ease; animation: fcHexIn 360ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.fc-hexg { animation: fcHexIn 360ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.fc-hexg .fc-hex { animation: none; }
.fc-hex:hover { filter: brightness(1.25); }
.fc-hex.idle { fill: var(--fc-idle); stroke: rgba(var(--fc-ink-rgb),calc(0.07 * var(--fc-struct))); cursor: default; }
.fc-hex.idle:hover { filter: none; }
.fc-hex-label { fill: rgba(var(--fc-ink-rgb),calc(0.9 * var(--fc-mute) + var(--fc-floor))); font-family: ${MONO}; font-size: 12px; font-weight: 700; text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: rgba(5,5,7,0.55); stroke-width: 2.5px; }
.fc-hex-label.idle { fill: rgba(var(--fc-ink-rgb),calc(0.22 * var(--fc-struct))); stroke: none; }
@keyframes fcHexIn { from { opacity: 0; transform: scale(0.6); transform-box: fill-box; transform-origin: center; } to { opacity: 1; transform: scale(1); transform-box: fill-box; transform-origin: center; } }
.fc-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-top: 18px; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.5 * var(--fc-mute) + var(--fc-floor))); }
.fc-legend span { display: inline-flex; align-items: center; gap: 6px; }
.fc-legend i { width: 12px; height: 12px; border-radius: 3px; }

.fc-tip { position: fixed; z-index: 60; width: 274px; padding: 12px 14px; border-radius: 12px; pointer-events: none;
  background: var(--fc-elev); border: 1px solid rgba(var(--fc-line-rgb),0.13); box-shadow: var(--fc-elev-shadow);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
.fc-tip-name { font-family: ${OSWALD}; font-weight: 600; font-size: 15px; letter-spacing: 0.03em; text-transform: uppercase; color: var(--fc-ink); }
.fc-tip-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 13.5px; }
.fc-tip-row i { width: 3px; height: 16px; flex-shrink: 0; }
.fc-tip-row b { font-weight: 700; }
.fc-tip-row span { font-family: ${MONO}; font-size: 12px; font-weight: 700; }
.fc-tip-row em { font-style: normal; margin-left: auto; font-size: 12px; color: rgba(var(--fc-ink-rgb),calc(0.55 * var(--fc-mute) + var(--fc-floor))); }
.fc-tip-foot { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(var(--fc-line-rgb),0.08); font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.38 * var(--fc-mute) + var(--fc-floor))); }
.fc-tip.wide { width: 304px; }
.fc-tip-sub { margin-top: 3px; font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); }
.fc-tip-vote { display: flex; align-items: center; gap: 8px; margin-top: 7px; font-size: 13px; }
.fc-tip-vote i { width: 3px; height: 15px; flex-shrink: 0; }
.fc-tip-vote b { font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fc-tip-vote span { font-family: ${MONO}; font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fc-tip-vote em { font-style: normal; width: 48px; text-align: right; font-family: ${MONO}; font-size: 11.5px; font-variant-numeric: tabular-nums; color: rgba(var(--fc-ink-rgb),calc(0.55 * var(--fc-mute) + var(--fc-floor))); }
.fc-tip-vote.total { margin-top: 9px; padding-top: 8px; border-top: 1px solid rgba(var(--fc-line-rgb),0.08); }
.fc-tip-vote.total b { color: rgba(var(--fc-ink-rgb),calc(0.55 * var(--fc-mute) + var(--fc-floor))); font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.fc-unit { cursor: pointer; transition: filter .15s ease; }
.fc-unit:hover { filter: brightness(1.3); }
.fc-stage-layer { display: flex; justify-content: center; gap: 6px; margin-top: 14px; }
.fc-stage-layer button { font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.42 * var(--fc-mute) + var(--fc-floor))); background: rgba(var(--fc-line-rgb),0.03); border: 1px solid rgba(var(--fc-line-rgb),0.09); border-radius: 999px; padding: 7px 16px; cursor: pointer; }
.fc-stage-layer button:hover { color: rgba(var(--fc-ink-rgb),calc(0.75 * var(--fc-mute) + var(--fc-floor))); }
.fc-stage-layer button.on { color: var(--fc-ink); background: rgba(var(--fc-line-rgb),0.1); border-color: rgba(var(--fc-line-rgb),0.22); }
.fc-stage-votes { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 22px; margin-top: 12px; font-size: 13px; }
.fc-stage-votes span { display: inline-flex; align-items: center; gap: 7px; color: rgba(var(--fc-ink-rgb),calc(0.58 * var(--fc-mute) + var(--fc-floor))); }
.fc-stage-votes i { width: 3px; height: 14px; flex-shrink: 0; }
.fc-stage-votes b { color: var(--fc-ink); font-family: ${MONO}; font-weight: 700; font-variant-numeric: tabular-nums; }
.fc-stage-votes em { font-style: normal; font-family: ${MONO}; font-size: 11.5px; color: rgba(var(--fc-ink-rgb),calc(0.45 * var(--fc-mute) + var(--fc-floor))); }
.fc-stage-votes.rcv { margin-top: 8px; font-size: 12px; gap: 6px 18px; }
.fc-stage-votes.rcv > span:first-child { font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.36 * var(--fc-mute) + var(--fc-floor))); }

.fc-back { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 20px; background: none; border: 1px solid rgba(var(--fc-line-rgb),0.14); border-radius: 99px; padding: 8px 16px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; color: rgba(var(--fc-ink-rgb),calc(0.7 * var(--fc-mute) + var(--fc-floor))); transition: border-color .15s ease, color .15s ease; }
.fc-back:hover { color: var(--fc-ink); border-color: rgba(109,62,233,0.5); }
.fc-back span { transition: transform .15s ease; display: inline-block; }
.fc-back:hover span { transform: translateX(-3px); }
.fc-stage-year { font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); }
.fc-stage-title h2 { margin-top: 8px; font-family: ${OSWALD}; font-weight: 600; font-size: clamp(28px, 4vw, 44px); letter-spacing: 0.01em; text-transform: uppercase; line-height: 1.04; color: var(--fc-ink); }
.fc-stage-banner { margin-top: 10px; font-family: ${MONO}; font-size: 12.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.fc-stage-map { margin-top: 10px; }
.fc-stage-caption { margin-top: 12px; text-align: center; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.35 * var(--fc-mute) + var(--fc-floor))); }

.fc-sec { padding: clamp(48px, 8vh, 92px) 0 0; }
.fc-sec.last { padding-bottom: clamp(40px, 6vh, 70px); }
.fc-band { margin-top: clamp(48px, 8vh, 92px); padding: clamp(44px, 7vh, 80px) 0; background: var(--fc-band); border-top: 1px solid rgba(var(--fc-line-rgb),0.05); border-bottom: 1px solid rgba(var(--fc-line-rgb),0.05); }
.fc-band + .fc-sec { padding-top: clamp(40px, 6.5vh, 76px); }

.fc-hist { position: relative; margin-top: 40px; padding-bottom: 44px; }
.fc-hist-svg { display: block; width: 100%; height: auto; }
.fc-hist-bar { transition: opacity .15s ease; }
.fc-hist:hover .fc-hist-bar { opacity: 0.92; }
.fc-hist-anno { position: absolute; top: -6px; z-index: 2; display: flex; flex-direction: column; gap: 3px; pointer-events: none; }
.fc-hist-anno.gop { left: 0; }
.fc-hist-anno.dem { right: 0; text-align: right; }
.fc-hist-anno b { font-size: clamp(34px, 4vw, 52px); font-weight: 800; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.fc-hist-anno span { font-size: 13.5px; font-weight: 600; color: rgba(var(--fc-ink-rgb),calc(0.85 * var(--fc-mute) + var(--fc-floor))); }
.fc-hist-anno em { font-style: normal; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); }
.fc-hist-rulelabel { position: absolute; top: -2px; transform: translateX(-50%); font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.6 * var(--fc-mute) + var(--fc-floor))); white-space: nowrap; }
.fc-hist-axis { position: absolute; left: 0; right: 0; bottom: 36px; height: 0; }
.fc-hist-axis span { position: absolute; top: -22px; transform: translateX(-50%); font-family: ${MONO}; font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fc-hist-bracket { position: absolute; bottom: 0; transform: translateX(-50%); font-family: ${MONO}; font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.45 * var(--fc-mute) + var(--fc-floor))); white-space: nowrap; }
.fc-hist-svglabel { fill: rgba(var(--fc-ink-rgb),calc(0.85 * var(--fc-mute) + var(--fc-floor))); font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.fc-hist-svglabel.side { font-size: 11.5px; }

.fc-chartwrap { position: relative; margin-top: 28px; padding-right: 96px; }
.fc-chart { display: block; width: 100%; }
.fc-chart-ends { position: absolute; right: 0; top: 0; bottom: 0; width: 90px; pointer-events: none; }
.fc-chart-ends span { position: absolute; left: 8px; transform: translateY(-50%); font-family: ${MONO}; font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fc-chart-x { display: flex; justify-content: space-between; margin-top: 10px; padding-right: 96px; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.35 * var(--fc-mute) + var(--fc-floor))); }
.fc-chart-tag { position: absolute; left: 4px; transform: translateY(-135%); font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); pointer-events: none; }
.fc-xhair { position: absolute; top: 10px; z-index: 3; display: flex; flex-direction: column; gap: 2px; padding: 9px 12px; border: 1px solid rgba(var(--fc-line-rgb),0.12); border-radius: 10px; background: var(--fc-elev); pointer-events: none; }
.fc-xhair em { font-style: normal; font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.45 * var(--fc-mute) + var(--fc-floor))); }
.fc-xhair span { font-family: ${MONO}; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }

.fc-table-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-top: 26px; }
.fc-find { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 260px; max-width: 460px; height: 44px; padding: 0 14px;
  border: 1px solid rgba(var(--fc-line-rgb),0.12); border-radius: 12px; background: rgba(var(--fc-line-rgb),0.03); color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); transition: border-color .15s ease; }
.fc-find:focus-within { border-color: rgba(109,62,233,0.5); }
.fc-find input { flex: 1; background: none; border: 0; outline: none; color: var(--fc-ink); font-family: inherit; font-size: 14px; }
.fc-find input::placeholder { color: rgba(var(--fc-ink-rgb),calc(0.35 * var(--fc-mute) + var(--fc-floor))); }
.fc-sorts { display: inline-flex; gap: 4px; }
.fc-sorts button { appearance: none; background: none; border: 1px solid transparent; border-radius: 99px; padding: 7px 13px; cursor: pointer;
  font-family: ${MONO}; font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.45 * var(--fc-mute) + var(--fc-floor))); transition: color .15s ease, border-color .15s ease; }
.fc-sorts button:hover { color: rgba(var(--fc-ink-rgb),calc(0.8 * var(--fc-mute) + var(--fc-floor))); }
.fc-sorts button.on { color: var(--fc-accent); border-color: rgba(109,62,233,0.35); }

.fc-table { margin-top: 14px; }
.fc-tr { display: grid; grid-template-columns: minmax(0, 2.1fr) minmax(0, 1.7fr) 74px minmax(90px, 1fr) 84px 100px 76px; align-items: center; gap: 16px;
  width: 100%; text-align: left; padding: 14px 10px; background: none; border: 0; border-top: 1px solid rgba(var(--fc-line-rgb),0.08); cursor: pointer; transition: background .15s ease; font-family: inherit; color: inherit; }
.fc-tr:last-of-type { border-bottom: 1px solid rgba(var(--fc-line-rgb),0.08); }
.fc-tr:not(.fc-th):hover { background: rgba(var(--fc-line-rgb),0.03); }
.fc-th { cursor: default; border-top: 0; padding-bottom: 8px; }
.fc-th span { font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.38 * var(--fc-mute) + var(--fc-floor))); }
.fc-th .num { text-align: right; }
.fc-td-name b { display: block; font-size: 14.5px; font-weight: 600; }
.fc-td-name em { display: block; margin-top: 2px; font-style: normal; font-size: 11px; color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); }
.fc-td-cands { display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; color: rgba(var(--fc-ink-rgb),calc(0.8 * var(--fc-mute) + var(--fc-floor))); }
.fc-td-cands i { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; margin-right: 7px; border-radius: 4px; font-style: normal; font-family: ${MONO}; font-size: 9px; font-weight: 700; }
.fc-td-cands i.d { background: rgba(var(--fc-dem-rgb),0.07); color: var(--fc-dem); }
.fc-td-cands i.r { background: rgba(var(--fc-gop-rgb),0.045); color: var(--fc-gop); }
/* Independents take the same chip, in the independent purple. Osborn, Bengs, Achilles
   and Bodnar sit in the build's Democratic slot and were reading as Democrats. */
.fc-td-cands i.i { background: rgba(122,75,176,0.10); color: #8d5cc6; }
.fc-td-margin, .fc-td-prob { font-family: ${MONO}; font-size: 13px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.fc-rating { display: inline-flex; align-items: center; gap: 6px; font-style: normal; font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 4px 9px; border-radius: 6px; border: 1px solid rgba(var(--fc-line-rgb),0.16); white-space: nowrap; }
.fc-rating u { text-decoration: none; font-weight: 500; opacity: 0.6; }

.fc-mbar { position: relative; display: block; height: 14px; }
.fc-mbar-track { position: absolute; left: 0; right: 0; top: 5px; height: 4px; border-radius: 99px;
  background: linear-gradient(90deg, #1d3a85, #6f92e8 40%, ${TILT_D_TONE} 49.6%, ${TILT_R_TONE} 50.4%, #e05c6a 60%, #8f1f2b); opacity: 0.5; }
.fc-mbar-band { position: absolute; top: 4px; height: 6px; border-radius: 99px; background: rgba(var(--fc-ink-rgb),calc(0.26 * var(--fc-struct))); }
.fc-mbar-dot { position: absolute; top: 50%; width: 9px; height: 9px; border-radius: 99px; background: var(--fc-ink); transform: translate(-50%, -50%); box-shadow: 0 0 0 2px var(--fc-bg); }
.fc-mbar-mid { position: absolute; left: 50%; top: 1px; bottom: 1px; width: 1px; background: rgba(var(--fc-ink-rgb),calc(0.35 * var(--fc-mute) + var(--fc-floor))); }

.fc-more { display: block; margin: 18px auto 0; background: none; border: 1px solid rgba(var(--fc-line-rgb),0.14); border-radius: 99px; padding: 10px 22px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; color: rgba(var(--fc-ink-rgb),calc(0.7 * var(--fc-mute) + var(--fc-floor))); transition: border-color .15s ease, color .15s ease; }
.fc-more:hover { color: var(--fc-ink); border-color: rgba(109,62,233,0.5); }

.fc-odds { display: grid; grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); gap: clamp(28px, 4vw, 64px); align-items: center; margin-top: 30px; }
.fc-score { padding-top: 6px; }
.fc-score-row { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; padding: 14px 0; }
.fc-score-row + .fc-score-row { border-top: 1px solid rgba(var(--fc-line-rgb),0.08); }
.fc-score-id { min-width: 0; }
.fc-score-id b { display: block; font-size: clamp(19px, 2vw, 24px); font-weight: 700; letter-spacing: -0.015em; }
.fc-score-id em { display: block; margin-top: 4px; font-style: normal; font-family: ${MONO}; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: rgba(var(--fc-ink-rgb),calc(0.45 * var(--fc-mute) + var(--fc-floor))); }
.fc-score-p { font-size: clamp(34px, 3.6vw, 46px); font-weight: 800; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.fc-h2h { position: relative; height: 8px; margin-top: 16px; border-radius: 99px; background: ${GOP}; overflow: visible; }
.fc-h2h i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px 0 0 99px; background: ${DEM}; }
.fc-h2h-notch { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 2px; background: var(--fc-bg); box-shadow: 0 0 0 1px rgba(var(--fc-ink-rgb),calc(0.35 * var(--fc-mute) + var(--fc-floor))); }
.fc-h2h-x { display: flex; justify-content: space-between; margin-top: 9px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.fc-odds-dial { max-width: 470px; }

/* the projected ballot */
.fc-ballot { margin-top: clamp(30px, 4vh, 44px); }
.fc-ballot-h { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(var(--fc-line-rgb),0.08); font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.38 * var(--fc-mute) + var(--fc-floor))); }
.fc-ballot-bar { display: flex; height: 10px; margin-top: 16px; border-radius: 99px; overflow: hidden; background: rgba(var(--fc-ink-rgb),calc(0.1 * var(--fc-mute) + var(--fc-floor))); }
.fc-ballot-bar i { display: block; height: 100%; }
.fc-ballot-bar i + i { box-shadow: inset 1px 0 0 var(--fc-bg); }
.fc-ballot-list { margin-top: 6px; }
.fc-ballot-row { display: grid; grid-template-columns: 10px minmax(0,1fr) auto; grid-template-areas: "dot id num" ". track track"; align-items: baseline; gap: 4px 12px; padding: 13px 0; }
.fc-ballot-row + .fc-ballot-row { border-top: 1px solid rgba(var(--fc-line-rgb),0.08); }
.fc-ballot-row > i { grid-area: dot; width: 10px; height: 10px; border-radius: 50%; align-self: center; }
.fc-ballot-id { grid-area: id; min-width: 0; }
.fc-ballot-id b { display: block; font-size: clamp(15px, 1.5vw, 18px); font-weight: 700; letter-spacing: -0.01em; }
.fc-ballot-id em { display: block; margin-top: 3px; font-style: normal; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; color: rgba(var(--fc-ink-rgb),calc(0.45 * var(--fc-mute) + var(--fc-floor))); }
.fc-ballot-num { grid-area: num; text-align: right; flex-shrink: 0; }
.fc-ballot-num b { display: block; font-size: clamp(19px, 2vw, 24px); font-weight: 800; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.fc-ballot-num em { display: block; margin-top: 4px; font-style: normal; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; font-variant-numeric: tabular-nums; color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); }
.fc-ballot-track { grid-area: track; height: 4px; margin-top: 6px; border-radius: 99px; background: rgba(var(--fc-ink-rgb),calc(0.08 * var(--fc-mute) + var(--fc-floor))); overflow: hidden; }
.fc-ballot-track i { display: block; height: 100%; border-radius: 99px; }
@media (max-width: 520px) {
  .fc-ballot-row { gap: 4px 10px; }
  .fc-ballot-num b { font-size: 18px; }
}

/* the outcome distribution */
.fc-outcome { margin-top: clamp(36px, 5vh, 56px); }
.fc-uncontested-note { margin: clamp(36px, 5vh, 56px) 0 0; padding: 16px 18px; border: 1px solid var(--fc-line); border-radius: 10px; background: rgba(var(--fc-ink-rgb),calc(0.03 * var(--fc-mute) + var(--fc-floor))); font-size: 13px; line-height: 1.6; color: var(--fc-ink-2); max-width: 70ch; }
.fc-outcome-h { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(var(--fc-line-rgb),0.08); font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.38 * var(--fc-mute) + var(--fc-floor))); }
.fc-outcome-chart { position: relative; margin-top: 18px; }
.fc-outcome-chart .fc-chart { display: block; width: 100%; height: auto; }
.fc-outcome-median { position: absolute; top: 0; font-family: ${MONO}; font-size: 11.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }
.fc-outcome-tick { position: absolute; bottom: 34px; transform: translateX(-50%); font-family: ${MONO}; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; }
.fc-outcome-axis { position: absolute; left: 0; right: 0; bottom: 6px; height: 0; }
.fc-outcome-axis span { position: absolute; transform: translateX(-50%); font-family: ${MONO}; font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; opacity: 0.75; }
.fc-outcome-note { margin-top: 14px; font-size: 13px; color: rgba(var(--fc-ink-rgb),calc(0.5 * var(--fc-mute) + var(--fc-floor))); }
.fc-outcome-note b { font-family: ${MONO}; font-size: 12.5px; font-weight: 700; }

/* what carries the estimate */
.fc-grade { font-style: normal; margin-left: 8px; padding: 2px 6px; border-radius: 5px; font-family: ${MONO}; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; color: var(--fc-accent); border: 1px solid rgba(109,62,233,0.3); background: rgba(109,62,233,0.06); vertical-align: 2px; }

/* the environment chips */
.fc-envchips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.fc-envchips span { display: inline-flex; align-items: baseline; gap: 7px; padding: 8px 13px; border: 1px solid rgba(var(--fc-line-rgb),0.1); border-radius: 9px; font-family: ${MONO}; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; color: rgba(var(--fc-ink-rgb),calc(0.55 * var(--fc-mute) + var(--fc-floor))); }
.fc-envchips b { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fc-envchips b.lime { color: var(--fc-accent); }

/* the estimate waterfall */
.fc-flow { margin-top: 30px; border-top: 1px solid rgba(var(--fc-line-rgb),0.1); }
.fc-flow-scalehead { display: flex; justify-content: space-between; align-items: center; padding: 14px 0 4px; }
.fc-flow-k { display: flex; align-items: center; gap: 10px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.6 * var(--fc-mute) + var(--fc-floor))); }
.fc-flow-k.head { color: rgba(var(--fc-ink-rgb),calc(0.38 * var(--fc-mute) + var(--fc-floor))); }
.fc-flow-k.final { color: var(--fc-accent); }
.fc-flow-num { font-style: normal; color: rgba(var(--fc-ink-rgb),calc(0.38 * var(--fc-mute) + var(--fc-floor))); }
.fc-flow-carry { font-style: normal; margin-left: 4px; padding: 3px 7px; border-radius: 5px; border: 1px solid rgba(109,62,233,0.28); color: var(--fc-accent); font-size: 9px; letter-spacing: 0.1em; }
.fc-flow-window { display: inline-flex; align-items: center; gap: 8px; font-family: ${MONO}; font-size: 10.5px; font-weight: 700; }
.fc-flow-window i { width: 44px; height: 1px; background: rgba(var(--fc-ink-rgb),calc(0.2 * var(--fc-struct))); }
.fc-flow-row { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: clamp(20px, 3vw, 44px); align-items: center; padding: 17px 0; border-top: 1px solid rgba(var(--fc-line-rgb),0.06); }
.fc-flow-row.off .fc-flow-k, .fc-flow-row.off .fc-flow-cap { opacity: 0.32; }
.fc-flow-row.final { border-top: 1px solid rgba(var(--fc-line-rgb),0.14); background: linear-gradient(180deg, rgba(109,62,233,0.025), transparent); }
.fc-flow-cap { margin: 6px 0 0; font-size: 13px; line-height: 1.55; color: rgba(var(--fc-ink-rgb),calc(0.55 * var(--fc-mute) + var(--fc-floor))); }
.fc-flow-cap b { font-family: ${MONO}; font-size: 12.5px; font-weight: 700; }
.fc-flow-chips { display: inline-flex; flex-wrap: wrap; gap: 6px; margin-right: 8px; vertical-align: middle; }
.fc-flow-track { position: relative; height: 40px; border-left: 1px solid rgba(var(--fc-line-rgb),0.12); border-right: 1px solid rgba(var(--fc-line-rgb),0.12); }
.fc-flow-track::before { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(var(--fc-line-rgb),0.08); }
.fc-flow-even { position: absolute; top: 4px; bottom: 4px; width: 1px; background: rgba(var(--fc-ink-rgb),calc(0.22 * var(--fc-struct))); }
.fc-flow-even::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, transparent 0 3px, var(--fc-bg) 3px 6px); }
.fc-flow-link { position: absolute; top: 50%; height: 2px; transform: translateY(-50%); background: rgba(var(--fc-ink-rgb),calc(0.3 * var(--fc-mute) + var(--fc-floor))); border-radius: 2px; }
.fc-flow-ghost { position: absolute; top: 50%; width: 7px; height: 7px; transform: translate(-50%, -50%); border-radius: 99px; border: 1.4px solid rgba(var(--fc-ink-rgb),calc(0.35 * var(--fc-mute) + var(--fc-floor))); background: var(--fc-bg); }
.fc-flow-dot { position: absolute; top: 50%; width: 11px; height: 11px; transform: translate(-50%, -50%); border-radius: 99px; box-shadow: 0 0 0 3px var(--fc-bg); }
.fc-flow-dot.final { width: 13px; height: 13px; }
.fc-flow-val { position: absolute; top: 50%; font-family: ${MONO}; font-size: 12.5px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.fc-flow-val em { font-style: normal; font-size: 10.5px; font-weight: 600; color: rgba(var(--fc-ink-rgb),calc(0.45 * var(--fc-mute) + var(--fc-floor))); letter-spacing: 0.04em; }
.fc-flow-val.final { font-size: 14px; }
.fc-flow-val.final em { font-size: 11.5px; color: rgba(var(--fc-ink-rgb),calc(0.6 * var(--fc-mute) + var(--fc-floor))); }


.fc-polls { margin-top: 26px; }
.fc-polls-h { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 10px; font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.38 * var(--fc-mute) + var(--fc-floor))); }
.fc-poll { display: flex; align-items: center; gap: 14px; padding: 11px 4px; border-top: 1px solid rgba(var(--fc-line-rgb),0.07); font-size: 13.5px; }
.fc-poll b { font-weight: 600; min-width: 180px; }
.fc-kind { font-style: normal; font-family: ${MONO}; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); border: 1px solid rgba(var(--fc-line-rgb),0.14); border-radius: 5px; padding: 3px 7px; min-width: 92px; text-align: center; }
.fc-kind.flag { color: var(--fc-gold); border-color: rgba(var(--fc-gold-rgb),0.4); }
.fc-poll > span { color: rgba(var(--fc-ink-rgb),calc(0.45 * var(--fc-mute) + var(--fc-floor))); font-size: 12px; flex: 1; }
.fc-poll em { font-style: normal; font-family: ${MONO}; font-weight: 700; font-size: 13px; }

/* simulated crosstabs */
.fc-xt-total { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 26px; margin-top: 24px; padding: 16px 18px;
  border: 1px solid rgba(var(--fc-line-rgb),0.1); border-radius: 14px; background: rgba(var(--fc-line-rgb),0.025); }
.fc-xt-total .k { font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); }
.fc-xt-total .v { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; margin-left: auto; font-size: 13px; color: rgba(var(--fc-ink-rgb),calc(0.6 * var(--fc-mute) + var(--fc-floor))); }
.fc-xt-total .v b { font-family: ${MONO}; font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; margin-left: 5px; }
.fc-xt-total .mg { padding: 3px 9px; border-radius: 6px; font-family: ${MONO}; font-size: 11px; font-weight: 700; color: var(--fc-ink); }
.fc-xt-toggle { display: inline-flex; align-items: baseline; gap: 8px; margin-top: 18px; padding: 8px 16px; cursor: pointer;
  background: rgba(var(--fc-line-rgb),0.03); border: 1px solid rgba(var(--fc-line-rgb),0.1); border-radius: 999px;
  font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.6 * var(--fc-mute) + var(--fc-floor))); }
.fc-xt-toggle:hover { color: var(--fc-ink); border-color: rgba(var(--fc-line-rgb),0.22); }
.fc-xt-toggle span { letter-spacing: 0.1em; color: rgba(var(--fc-ink-rgb),calc(0.35 * var(--fc-mute) + var(--fc-floor))); }
.fc-xt-grid { columns: 3 310px; column-gap: 16px; margin-top: 18px; }
.fc-xt-tabs { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 20px; }
.fc-xt-tab { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; cursor: pointer;
  font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: rgba(var(--fc-ink-rgb),calc(0.5 * var(--fc-mute) + var(--fc-floor))); background: rgba(var(--fc-line-rgb),0.03);
  border: 1px solid rgba(var(--fc-line-rgb),0.09); border-radius: 999px; transition: color .15s ease, border-color .15s ease, background .15s ease; }
.fc-xt-tab:hover { color: var(--fc-ink); border-color: rgba(var(--fc-line-rgb),0.24); }
.fc-xt-tab.on { color: var(--fc-bg); background: var(--fc-ink); border-color: var(--fc-ink); }
.fc-xt-tab.alt { letter-spacing: 0.14em; }
.fc-xt-tab em { font-style: normal; font-size: 9.5px; font-weight: 700; color: rgba(var(--fc-ink-rgb),calc(0.42 * var(--fc-mute) + var(--fc-floor))); }
.fc-xt-tab.on em { color: rgba(var(--fc-bg-rgb),0.45); }
.fc-xt-tab:focus-visible { outline: 2px solid ${DEM}; outline-offset: 2px; }
.fc-xt-panel { margin-top: 18px; }
.fc-xt-one { padding: 6px 18px 10px; border: 1px solid rgba(var(--fc-line-rgb),0.08); border-radius: 14px; background: rgba(var(--fc-line-rgb),0.02); overflow-x: auto; }
.fc-page .fc-xt-ph { margin: 0 0 6px; font-family: ${OSWALD}; font-size: 15px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fc-ink); }
.fc-xt-pn { margin: 0 0 14px; max-width: 68ch; font-size: 13.5px; line-height: 1.55; color: rgba(var(--fc-ink-rgb),calc(0.6 * var(--fc-mute) + var(--fc-floor))); }
table.fc-xt.lead-table { padding: 0; }
table.fc-xt.lead-table tr.clickable { cursor: pointer; }
table.fc-xt.lead-table tr.clickable:hover td { background: rgba(var(--fc-line-rgb),0.04); }
table.fc-xt.lead-table tr.clickable:focus-visible { outline: 2px solid ${DEM}; outline-offset: -2px; }
table.fc-xt td.pull { font-family: ${MONO}; font-size: 12.5px; font-weight: 700; }
table.fc-xt.lead-table td.g { width: 26%; min-width: 150px; }
table.fc-xt.lead-table td.sh, table.fc-xt.lead-table th.sh { text-align: left; padding-left: 22px; }
table.fc-xt.lead-table th:nth-child(3), table.fc-xt.lead-table td:nth-child(3) { text-align: right; padding-right: 8%; }
.fc-xt-card { break-inside: avoid; -webkit-column-break-inside: avoid; margin-bottom: 16px; padding: 16px 16px 10px; border: 1px solid rgba(var(--fc-line-rgb),0.08); border-radius: 14px; background: rgba(var(--fc-line-rgb),0.02); min-width: 0; }
.fc-page .fc-xt-card h3 { margin: 0 0 10px; font-family: ${OSWALD}; font-size: 13px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.75 * var(--fc-mute) + var(--fc-floor))); }
.fc-xt-scroll { overflow-x: auto; }
table.fc-xt { width: 100%; border-collapse: collapse; font-size: 12.5px; font-variant-numeric: tabular-nums; }
table.fc-xt th { font-family: ${MONO}; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: rgba(var(--fc-ink-rgb),calc(0.35 * var(--fc-mute) + var(--fc-floor))); text-align: right; padding: 0 0 8px 10px; white-space: nowrap; }
table.fc-xt th:first-child { text-align: left; padding-left: 0; }
table.fc-xt td { padding: 7px 0 7px 10px; text-align: right; border-top: 1px solid rgba(var(--fc-line-rgb),0.05); color: rgba(var(--fc-ink-rgb),calc(0.7 * var(--fc-mute) + var(--fc-floor))); white-space: nowrap; }
table.fc-xt td:first-child { padding-left: 0; }
table.fc-xt td.g { text-align: left; min-width: 116px; white-space: normal; color: rgba(var(--fc-ink-rgb),calc(0.85 * var(--fc-mute) + var(--fc-floor))); }
.fc-xt-one table.fc-xt td.g, .fc-xt-panel > table.fc-xt td.g { min-width: 210px; }
.fc-xt-one table.fc-xt td, .fc-xt-one table.fc-xt th { padding-left: 18px; }
table.fc-xt td.sh, table.fc-xt th.sh { color: rgba(var(--fc-ink-rgb),calc(0.42 * var(--fc-mute) + var(--fc-floor))); }
table.fc-xt td.lead { font-weight: 700; }
table.fc-xt td.mg i { display: inline-block; padding: 2px 7px; border-radius: 5px; font-family: ${MONO}; font-size: 10.5px; font-weight: 700; font-style: normal; color: var(--fc-ink); }
.fc-xt-bar { display: flex; height: 4px; margin-top: 5px; border-radius: 99px; overflow: hidden; background: rgba(var(--fc-line-rgb),0.06); }
.fc-xt-bar i { display: block; height: 100%; }
@media (max-width: 560px) {
  .fc-xt-grid { columns: 1; }
  .fc-xt-tab { padding: 6px 10px; font-size: 9.5px; letter-spacing: 0.06em; }
  .fc-xt-one { padding: 4px 10px 8px; }
  .fc-xt-one table.fc-xt td, .fc-xt-one table.fc-xt th { padding-left: 8px; }
  .fc-xt-one table.fc-xt td.g, .fc-xt-panel > table.fc-xt td.g { min-width: 120px; }
  .fc-xt-card { padding: 14px 12px 8px; }
  table.fc-xt { font-size: 11.5px; }
  table.fc-xt th, table.fc-xt td { padding-left: 6px; }
  table.fc-xt td.g { min-width: 78px; }
  table.fc-xt td.mg i { padding: 2px 5px; font-size: 9.5px; }
  .fc-xt-total .v { margin-left: 0; gap: 8px 14px; }
}

.fc-similar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
.fc-simchip { display: inline-flex; align-items: baseline; gap: 10px; background: rgba(var(--fc-line-rgb),0.03); border: 1px solid rgba(var(--fc-line-rgb),0.12); border-radius: 99px; padding: 10px 16px; cursor: pointer;
  font-family: inherit; color: inherit; transition: border-color .15s ease, background .15s ease; }
.fc-simchip:hover { border-color: rgba(109,62,233,0.4); background: rgba(109,62,233,0.05); }
.fc-simchip b { font-size: 13px; font-weight: 600; }
.fc-simchip span { font-family: ${MONO}; font-size: 11.5px; font-weight: 700; }
.fc-simchip em { font-style: normal; font-family: ${MONO}; font-size: 10px; color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); }

.fc-foot { margin-top: clamp(50px, 9vh, 100px); border-top: 1px solid rgba(var(--fc-line-rgb),0.08); }
.fc-foot-in { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; padding-top: 18px; padding-bottom: 26px; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.35 * var(--fc-mute) + var(--fc-floor))); }

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
