"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { US_STATE_PATHS } from "@/app/_polling/lib/usStatePaths";
import { RATE, RATING_LABEL, darkLabel, fmtM, lastName, marginColor, partyColor, rating, ratingPill, raceHref, RAMP_CSS, STATE_NAME, type Rating } from "@/app/lib/opp";
import type { MiniRace } from "@/app/lib/forecastData";
import { Tip, useTip } from "./motion";
import { fit, pathsBox, type CountyPath, type CountyRow } from "./countyGeo";

type Office = "senate" | "governor";
type Chamber = { seatsTotal: number; demSeats: number; gopSeats: number; demControl: number; hist: [number, number][] };
export type CountyBuild = { raceId: string; st: string; paths: CountyPath[]; rows: Record<string, CountyRow>; names: Record<string, string> };

const NO_LABEL = new Set(["DC", "RI", "DE", "CT", "NJ", "MD", "MA", "NH", "VT", "HI"]);

export default function ForecastDeskHome({ races, chambers, notUp, initialCounty, picks }: {
  races: Record<Office, Record<string, MiniRace>>;
  chambers: Record<Office, Chamber>;
  notUp: { senD: number; senR: number; govD: number; govR: number };
  initialCounty: CountyBuild;
  picks: { raceId: string; label: string }[];
}) {
  const [office, setOffice] = useState<Office>("senate");
  const { tip, show, hide } = useTip();
  const [county, setCounty] = useState<CountyBuild>(initialCounty);
  const [loading, setLoading] = useState(false);
  const cache = useRef<{ counties?: Record<string, Record<string, CountyRow> | Record<string, string>>; states: Record<string, CountyPath[]> }>({ states: { [initialCounty.st]: initialCounty.paths } });
  const countyRef = useRef<HTMLElement | null>(null);

  const list = races[office];
  const raceOf = (id: string): MiniRace | undefined => {
    const off: Office = id.startsWith("gov-") ? "governor" : "senate";
    return Object.values(races[off]).find((r) => r.id === id);
  };

  async function pick(raceId: string) {
    const st = raceId.split("-")[1];
    if (countyRef.current && window.scrollY > countyRef.current.offsetTop + 300) countyRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    if (raceId === county.raceId) return;
    setLoading(true);
    try {
      const c = cache.current;
      if (!c.counties) c.counties = await fetch("/forecast/counties.json").then((r) => r.json());
      if (!c.states[st]) c.states[st] = (await fetch(`/forecast/states/${st}.json`).then((r) => r.json())).counties;
      const rows = (c.counties?.[raceId] ?? {}) as Record<string, CountyRow>;
      const names = (c.counties?._n ?? {}) as Record<string, string>;
      setCounty({ raceId, st, paths: c.states[st], rows, names });
    } catch { /* keep the current map */ }
    setLoading(false);
  }

  return (
    <div className="opp">
      <section className="sec" id="forecast">
        <div className="sec-h">
          <div>
            <div className="eye g">2026 forecast</div>
            <h2>The map, county by county</h2>
            <p>Hover any state for the model margin, click it to open the county simulation. Ratings are set by margin: under 2 toss up, 2 to 6 lean, 6 to 12 likely, 12 and over safe.</p>
          </div>
          <div className="seg" role="tablist" aria-label="Office">
            {(["senate", "governor"] as Office[]).map((o) => (
              <button key={o} role="tab" aria-selected={office === o} className={office === o ? "on" : ""} onClick={() => setOffice(o)}>{o === "senate" ? "Senate" : "Governor"}</button>
            ))}
          </div>
        </div>
        <div className="map-wrap">
          <div className="card">
            <div className="card-b" style={{ padding: "12px 12px 16px" }}>
              <UsMap key={office} races={list} office={office} show={show} hide={hide} onPick={(st) => { const r = list[st]; if (r) pick(r.id); }} />
              <div className="legend">
                {([["safeD", "Safe D"], ["likelyD", "Likely D"], ["leanD", "Lean D"], ["toss", "Toss up"], ["leanR", "Lean R"], ["likelyR", "Likely R"], ["safeR", "Safe R"], ["ind", "Independent"], ["none", "No race"]] as [Rating, string][]).map(([k, l]) => (
                  <span key={k}><i style={{ background: RATE[k] }} />{l}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <Seats office={office} chamber={chambers[office]} races={list} notUp={notUp} />
            <div className="card">
              <div className="card-h"><h3>Closest races</h3><span className="eye" style={{ marginLeft: "auto" }}>model margin</span></div>
              <div>
                {Object.values(list).sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, 7).map((r) => {
                  const cls = r.ind ? "i" : r.m < 0 ? "d" : "r";
                  const lead = r.m < 0 ? r.dem : r.gop;
                  return (
                    <div key={r.id} className="race" role="button" tabIndex={0} onClick={() => pick(r.id)} onKeyDown={(e) => { if (e.key === "Enter") pick(r.id); }}>
                      <span className="st">{r.st}</span>
                      <span className="who"><b>{r.dem}</b> vs <b>{r.gop}</b><small>{office === "senate" ? "Senate" : "Governor"}{r.open ? ", open seat" : ""}</small></span>
                      <span className={`mg ${cls}`}>{fmtM(r.m, r.ind)}<small>{lastName(lead)}</small></span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="county" ref={countyRef}>
        <div className="sec-h">
          <div>
            <div className="eye g">{county.raceId.startsWith("gov-") ? "Governor Mode" : "Senate Mode"}</div>
            <h2>Inside the simulation</h2>
            <p>Every county reconstructed by simulating voters going to the polls, 2,000 times. These are the county margins from the current build.</p>
          </div>
          <div className="statepick" role="group" aria-label="Race">
            {picks.map((p) => (
              <button key={p.raceId} className={county.raceId === p.raceId ? "on" : ""} onClick={() => pick(p.raceId)}>{p.label}</button>
            ))}
          </div>
        </div>
        <CountyPanel build={county} race={raceOf(county.raceId)} loading={loading} show={show} hide={hide} />
      </section>
      <Tip tip={tip} />
    </div>
  );
}

function UsMap({ races, office, show, hide, onPick }: { races: Record<string, MiniRace>; office: Office; show: (h: React.ReactNode, e: React.MouseEvent) => void; hide: () => void; onPick: (st: string) => void }) {
  const states = Object.entries(US_STATE_PATHS);
  return (
    <svg className="usmap" viewBox="0 0 760 440" role="img" aria-label={`${office === "senate" ? "Senate" : "Governor"} forecast map`}>
      {states.map(([st, p], i) => {
        const r = races[st];
        const rt: Rating = r ? rating(r.m, r.ind) : "none";
        return (
          <path key={st} d={p.d} fill={RATE[rt]} style={{ animationDelay: `${i * 12}ms`, cursor: r ? "pointer" : "default" }}
            onMouseMove={(e) => show(r ? (
              <>
                <b>{r.name}</b>
                <div className="row"><span style={{ color: r.ind ? "var(--ind)" : "var(--dem2)" }}>{r.dem}</span><span /></div>
                <div className="row"><span style={{ color: "var(--gop2)" }}>{r.gop}</span><span /></div>
                <div className="row" style={{ marginTop: 6 }}><span>Model</span><span>{fmtM(r.m, r.ind)}</span></div>
                {r.poll != null && <div className="row"><span>Polls</span><span>{fmtM(r.poll)}</span></div>}
                <div className="row"><span>Rating</span><span style={{ color: RATE[rt] }}>{RATING_LABEL[rt]}</span></div>
              </>
            ) : (<><b>{STATE_NAME[st] ?? st}</b><div className="row"><span>No {office} race in 2026</span></div></>), e)}
            onMouseLeave={hide}
            onClick={() => r && onPick(st)}>
            <title>{r ? `${r.name}, ${RATING_LABEL[rt]}` : STATE_NAME[st]}</title>
          </path>
        );
      })}
      {states.map(([st, p]) => {
        if (NO_LABEL.has(st)) return null;
        const r = races[st]; const rt: Rating = r ? rating(r.m, r.ind) : "none";
        return <text key={st + "t"} x={p.c[0]} y={p.c[1] + 3} style={darkLabel(rt) ? { fill: "#1a1030" } : undefined}>{st}</text>;
      })}
    </svg>
  );
}

function Seats({ office, chamber, races, notUp }: { office: Office; chamber: Chamber; races: Record<string, MiniRace>; notUp: { senD: number; senR: number; govD: number; govR: number } }) {
  const tot = chamber.seatsTotal;
  const cnt: Record<string, number> = { safeD: 0, likelyD: 0, leanD: 0, toss: 0, leanR: 0, likelyR: 0, safeR: 0, ind: 0 };
  Object.values(races).forEach((r) => { cnt[rating(r.m, r.ind)]++; });
  const nD = office === "senate" ? notUp.senD : notUp.govD, nR = office === "senate" ? notUp.senR : notUp.govR;
  const segs: [Rating, number][] = [["safeD", nD + cnt.safeD], ["likelyD", cnt.likelyD], ["leanD", cnt.leanD], ["ind", cnt.ind], ["toss", cnt.toss], ["leanR", cnt.leanR], ["likelyR", cnt.likelyR], ["safeR", cnt.safeR + nR]];
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(false); const t = setTimeout(() => setOn(true), 50); return () => clearTimeout(t); }, [office]);
  // chamber.hist is keyed by GOP seats; convert to Dem seats and fill gaps so bars sit on a true axis
  const hist = useMemo(() => {
    const m = new Map<number, number>();
    chamber.hist.forEach(([r, p]) => m.set(tot - r, (m.get(tot - r) ?? 0) + p));
    const keys = [...m.keys()].filter((k) => (m.get(k) ?? 0) >= 0.001);
    if (!keys.length) return [] as [number, number][];
    const lo = Math.min(...keys), hi = Math.max(...keys);
    const out: [number, number][] = [];
    for (let s = lo; s <= hi; s++) out.push([s, m.get(s) ?? 0]);
    return out;
  }, [chamber, tot]);
  const max = Math.max(...hist.map((x) => x[1]));
  const W = 320, H = 120, pad = 18, bw = (W - 2 * pad) / Math.max(1, hist.length), maj = Math.floor(tot / 2) + 1;
  return (
    <div className="card">
      <div className="card-h"><h3>{office === "senate" ? "Senate seats" : "Governorships"}</h3><span className="eye" style={{ marginLeft: "auto" }}>2,000 sims</span></div>
      <div className="card-b">
        <div className="seatline"><span className="d">{chamber.demSeats.toFixed(1)} D</span><span style={{ color: "var(--mute)" }}>mean seats · D control {Math.round(chamber.demControl * 100)}%</span><span className="r">{chamber.gopSeats.toFixed(1)} R</span></div>
        <div className="seatbar">{segs.map(([k, n]) => <i key={k} style={{ background: RATE[k], width: on ? `${(n / tot) * 100}%` : 0 }} title={`${RATING_LABEL[k]}: ${n}`} />)}</div>
        <svg className="hist" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 14 }} role="img" aria-label="Democratic seats across the simulations">
          <text x={pad} y={10} style={{ font: "600 9px var(--font-m)", fill: "#8e86a3", letterSpacing: ".1em" }}>DEM SEATS, SHARE OF SIMULATIONS</text>
          {hist.map(([seats, share], i) => {
            const hh = (share / max) * (H - 34);
            const col = seats >= maj ? "#3d7bff" : seats === maj - 1 && tot % 2 === 0 ? "#e7b341" : "#ff3b5c";
            return (
              <g key={seats}>
                <rect x={pad + i * bw + 1} y={H - 22 - hh} width={Math.max(1, bw - 2)} height={hh} rx={2} fill={col} opacity={0.9}><title>{`${seats} D seats: ${(share * 100).toFixed(1)}%`}</title></rect>
                {i % 3 === 0 && <text x={pad + i * bw + bw / 2} y={H - 8} textAnchor="middle" style={{ font: "500 9px var(--font-m)", fill: "#8e86a3" }}>{seats}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function CountyPanel({ build, race, loading, show, hide }: { build: CountyBuild; race?: MiniRace; loading: boolean; show: (h: React.ReactNode, e: React.MouseEvent) => void; hide: () => void }) {
  const W = 900, H = 620;
  const box = useMemo(() => pathsBox(build.paths), [build.paths]);
  const { sc, ox, oy } = fit(box, W, H);
  const counties = build.paths.filter((p) => build.rows[p.id]);
  const rt: Rating = race ? rating(race.m, race.ind) : "none";
  const lead = race ? (race.m < 0 ? race.dem : race.gop) : "";
  const top = counties.slice().sort((a, b) => (build.rows[b.id]?.[3] ?? 0) - (build.rows[a.id]?.[3] ?? 0)).slice(0, 5);
  const unit = build.st === "AK" ? "boroughs" : build.st === "LA" ? "parishes" : "counties";
  return (
    <div className="county-wrap">
      <div className="card">
        <div className="card-h">
          <h3>{race?.name ?? build.raceId}</h3>
          {race && <span className={`pill ${ratingPill(rt)}`}>{RATING_LABEL[rt]}</span>}
          <span className="eye" style={{ marginLeft: "auto" }}>{loading ? "loading" : `${counties.length} ${unit}`}</span>
        </div>
        <div className="card-b" style={{ padding: 10 }}>
          <svg key={build.raceId} className="cmap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${race?.name ?? ""} county simulation map`}>
            <g transform={`translate(${ox},${oy}) scale(${sc})`}>
              {counties.map((c, i) => {
                const row = build.rows[c.id];
                const m = row[0];
                return (
                  <path key={c.id} d={c.d} fill={marginColor(m)} style={{ strokeWidth: 1 / sc, animationDelay: `${Math.min(i, 250) * 4}ms` }}
                    onMouseMove={(e) => show(<>
                      <b>{build.names[c.id] ?? c.id}{/county|parish|borough|city/i.test(build.names[c.id] ?? "") ? "" : " County"}</b>
                      <div className="row"><span>Simulated margin</span><span style={{ color: m < 0 ? "var(--dem2)" : "var(--gop2)" }}>{fmtM(m)}</span></div>
                      <div className="row"><span>Simulated votes</span><span>{Math.round(row[3]).toLocaleString()}</span></div>
                    </>, e)}
                    onMouseLeave={hide} />
                );
              })}
            </g>
          </svg>
          <div className="legend" style={{ paddingInline: 8 }}>
            <span>D +40</span><span className="ramp" style={{ flex: 1, maxWidth: 280, margin: 0, background: RAMP_CSS }} /><span>R +40</span>
            <span style={{ marginLeft: "auto" }}>Colors scale to margin, hover for the simulated vote</span>
          </div>
        </div>
      </div>
      <div className="card">
        {race && (
          <>
            <div className="stat"><div className="k">Model margin</div><div className={`v ${race.ind ? "" : race.m < 0 ? "d" : "r"}`} style={race.ind ? { color: "var(--ind)" } : undefined}>{lastName(lead)} +{Math.abs(race.m).toFixed(1)}</div></div>
            <div className="stat"><div className="k">Simulated statewide vote</div>
              <div>{race.cands.slice(0, 3).map((c) => (
                <div className="cand" key={c.name}><i style={{ background: partyColor(c.party) }} /><span>{c.name}</span><span className="p">{c.pct.toFixed(1)}%</span></div>
              ))}</div>
            </div>
            <div className="stat"><div className="k">Public polling average</div>
              <div className="v" style={{ fontSize: 22 }}>{race.poll != null ? `${lastName(race.poll < 0 ? race.dem : race.gop)} +${Math.abs(race.poll).toFixed(1)}` : "No public polls yet"}</div>
              <div style={{ fontSize: 12, color: "var(--mute)" }}>Election Day polling average, LOWESS where a race has 8 or more polls</div>
            </div>
            <div className="stat"><div className="k">Biggest {unit}</div>
              <div style={{ display: "grid", gap: 4 }}>{top.map((c) => { const m = build.rows[c.id][0]; return (
                <div className="cand" key={c.id}><i style={{ background: marginColor(m) }} /><span>{build.names[c.id] ?? c.id}</span><span className="p" style={{ color: m < 0 ? "var(--dem2)" : "var(--gop2)" }}>{fmtM(m)}</span></div>
              ); })}</div>
            </div>
            <div className="stat"><Link className="btn white" style={{ width: "max-content" }} href={raceHref(build.raceId)}>Open the race page</Link></div>
          </>
        )}
      </div>
    </div>
  );
}
