"use client";
// Both 2028 primaries in On Point's own layout: a scoreboard of the leaders, the whole field as cards you can take out
// of the race and put back, a map that reads three ways (who leads, one candidate's strength, how sure the win is),
// the road to the nomination window by window, and every state. Every candidate is on every state's ballot at once
// with no dropouts; taking one out reruns every state and county in the browser with the same engine. Each state is
// exactly the sum of its counties, and clicking a state opens them.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Pointy from "@/onpoint-sketchbook/react/Pointy";
import { InkDefs, InkOutline, Lift, sweepDelays, useBoil, useInView } from "@/onpoint-sketchbook/react/SketchMap";
import Toon from "@/app/majority-tracker/Toon";
import { useJSON, usePrim } from "./useX";
import { X, STATE_NAME, fmtN, fmtK, fmtPct, fmtSh, last, leaderColor, type PrimFile, type PrimField, type CountiesGeo, type StatesGeo } from "./lib";
import { Tip, type At } from "./Tips28";
import type { PrimSummary } from "./PrimView";

type P = "D" | "R";
type Mode = "lead" | "cand" | "sure";
const SMALL = ["DE", "RI", "CT", "NJ", "MD", "MA", "VT", "NH", "DC", "HI"];
const WINDOWS: Record<number, [string, string]> = { 1: ["The early states", "January and February"], 2: ["Super Tuesday", "Early March"], 3: ["The March states", "Mid to late March"], 4: ["The long spring", "April to June"] };
const tt = (c: (number | [number, number])[]) => (c[0] as number) + (c.slice(1) as [number, number][]).reduce((a, x) => a + x[1], 0);
const inkOn = (rgb: string) => { const v = rgb.match(/\d+/g)?.map(Number) ?? [0, 0, 0]; return v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11 > 150 ? "#1b1328" : "#fff"; };
const heat = (s: number, hex: string) => leaderColor(hex, 0.12 + Math.min(1, s / 0.45) * 0.5);

export default function Prim28({ sum }: { sum: PrimSummary }) {
  const [party, setParty] = useState<P>("D");
  const [outs, setOuts] = useState<Record<P, string[]>>({ D: [], R: [] });
  const [mode, setMode] = useState<Mode>("lead");
  const [pick, setPick] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [hov, setHov] = useState<{ at: At; st?: string; f?: string; n?: string } | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  // /2028/primaries?st=NH&party=R opens New Hampshire's Republican counties
  useEffect(() => { const id = setTimeout(() => { try { const q = new URLSearchParams(window.location.search); const s = q.get("st"); if (q.get("party") === "R") setParty("R"); if (s && STATE_NAME[s.toUpperCase()]) setFocus(s.toUpperCase()); } catch { /* no query */ } }, 0); return () => clearTimeout(id); }, []);

  const out = outs[party];
  const Pf = useJSON<PrimFile>(`${X}/prim.json`);
  const geo = useJSON<StatesGeo>(`${X}/states.json`);
  const { field: Fx, busy } = usePrim(party, out);
  // the same paper cutout map as the 2028 home: fills flip in, the pencil outline traces itself, the hovered state lifts
  const stage = useRef<HTMLDivElement>(null);
  const go = useInView(stage); useBoil(stage);
  const shapes = useMemo(() => (geo ? Object.entries(geo.states) : []) as [string, string][], [geo]);
  const delays = useMemo(() => sweepDelays(shapes), [shapes]);
  const allD = useMemo(() => shapes.map(([, d]) => d).join(""), [shapes]);
  const cg = useJSON<CountiesGeo>(focus ? `${X}/counties.json` : null);
  const F: PrimField | null = out.length ? Fx : Pf ? Pf[party] : null;
  const S = sum[party];
  const colOf = useMemo(() => Object.fromEntries(S.names.map((n, j) => [n, S.colors[j]])), [S]);
  const col = (j: number) => (F ? colOf[F.names[j]] ?? F.colors[j] : S.colors[j]) ?? "#8f8a99";
  const nomOf = (n: string) => { if (F && out.length) { const j = F.names.indexOf(n); return j < 0 ? 0 : F.nomination[j]; } const j = S.names.indexOf(n); return j < 0 ? 0 : S.nomination[j]; };
  const order = S.names.map((n, j) => ({ n, p: nomOf(n), c: S.colors[j], on: !out.includes(n) })).sort((a, b) => Number(b.on) - Number(a.on) || b.p - a.p);
  const live = order.filter((x) => x.on);
  const pj = pick && F ? F.names.indexOf(pick) : -1;
  const natTot = F ? F.votes.reduce((a, b) => a + b, 0) + F.other : 0;

  const lead = (st: string) => { const s = F?.states[st]; if (!s) return null; let b = 0; s.votes.forEach((v, j) => { if (v > s.votes[b]) b = j; }); const o = s.votes.map((v, j) => [j, v]).sort((a, c) => c[1] - a[1]); return { j: b, sh: s.votes[b] / s.total, gap: (o[0][1] - (o[1]?.[1] ?? 0)) / s.total, win: s.win[b] }; };
  const fill = (st: string) => {
    const l = lead(st); if (!l || !F) return "#2a2438";
    if (mode === "cand" && pj >= 0) { const s = F.states[st]; return heat(s.votes[pj] / s.total, col(pj)); }
    if (mode === "sure") return leaderColor(col(l.j), 0.12 + Math.max(0, (l.win - 0.3) / 0.7) * 0.5);
    return leaderColor(col(l.j), Math.min(0.62, l.sh * 2.2));
  };
  const cfill = (f: string) => {
    const c = F?.counties[f]; if (!c || c.length < 2) return "#2a2438";
    if (mode === "cand" && pj >= 0) { const v = (c.slice(1) as [number, number][]).find((x) => x[0] === pj)?.[1] ?? 0; return heat(v / tt(c), col(pj)); }
    const [j, v] = c[1] as [number, number]; return leaderColor(col(j), Math.min(0.62, (v / tt(c)) * 2.2));
  };
  const toggle = (n: string) => setOuts((o) => { const cur = o[party]; const nx = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]; return nx.length >= S.names.length ? o : { ...o, [party]: nx }; });
  const point = (e: MouseEvent, x: { st?: string; f?: string; n?: string }) => setHov({ at: { x: e.clientX, y: e.clientY }, ...x });

  // the road: states by calendar window, then by size
  const road = useMemo(() => {
    if (!F) return [];
    const w: Record<number, string[]> = {};
    for (const [st, s] of Object.entries(F.states)) (w[s.window ?? 4] ??= []).push(st);
    return Object.keys(w).map(Number).sort((a, b) => a - b).map((k) => ({ k, sts: w[k].sort((a, b) => F.states[b].total - F.states[a].total) }));
  }, [F]);
  const tallies = useMemo(() => { const t: Record<string, number> = {}; if (F) for (const st of Object.keys(F.states)) { const l = lead(st); if (l) t[F.names[l.j]] = (t[F.names[l.j]] ?? 0) + 1; } return t; }, [F]); // eslint-disable-line react-hooks/exhaustive-deps
  const fcty = useMemo(() => (focus && cg && F ? cg.counties.filter((c) => c[1] === focus && F.counties[c[0]]) : []), [focus, cg, F]);
  const box = focus && geo?.box[focus]; const pad = box ? Math.max(box[2], box[3]) * 0.06 : 0;

  // hover cards
  const tipState = (st: string) => {
    const s = F?.states[st]; if (!s || !F) return null; const top = s.votes.map((v, j) => [j, v] as [number, number]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return (
      <div className="t28-card">
        <div className="t28-h"><b>{STATE_NAME[st]}</b><span>{WINDOWS[s.window ?? 4]?.[0]}</span></div>
        {top.map(([j, v], i) => (
          <div key={j} className={`t28-row${i === 0 ? " lead" : ""}`}>
            <Toon name={F.names[j]} side={party} size={28} uid="pt" />
            <span className="n">{F.names[j]}</span><span className="s">{fmtSh(v / s.total)}</span>
            <span className="bar"><i style={{ width: `${Math.min(100, (v / s.total) * 160)}%`, background: col(j) }} /></span>
            <span className="p">{fmtPct(s.win[j])} win</span>
          </div>
        ))}
        <div className="t28-f">{fmtN(s.total)} projected primary votes, added up from its counties<em>{focus === st ? "Hover a county" : "Click for its counties"}</em></div>
      </div>
    );
  };
  const tipCounty = (f: string, n: string) => {
    const c = F?.counties[f]; if (!c || !F) return null; const T = tt(c); const top = (c.slice(1) as [number, number][]).slice(0, 4);
    return (
      <div className="t28-card">
        <div className="t28-h"><b>{n}</b><span>{fmtN(T)} votes</span></div>
        {top.map(([j, v], i) => (
          <div key={j} className={`t28-row${i === 0 ? " lead" : ""}`}>
            <Toon name={F.names[j]} side={party} size={26} uid="pc" />
            <span className="n">{F.names[j]}</span><span className="s">{fmtSh(v / T)}</span>
            <span className="bar"><i style={{ width: `${Math.min(100, (v / T) * 160)}%`, background: col(j) }} /></span><span className="p">{fmtK(v)}</span>
          </div>
        ))}
      </div>
    );
  };
  const tipCand = (n: string) => {
    const j = F ? F.names.indexOf(n) : -1; if (!F || j < 0) return null;
    return (
      <div className="t28-card">
        <div className="t28-h"><b>{n}</b><span>{party === "D" ? "Democrat" : "Republican"}</span></div>
        <div className="t28-rt"><span style={{ background: col(j), color: inkOn(leaderColor(col(j), 1)) }}>{fmtPct(nomOf(n))} nomination</span><b>{fmtSh(F.votes[j] / natTot)} of the vote</b></div>
        <div className="t28-f">Leads in {tallies[n] ?? 0} states · {fmtK(F.votes[j])} projected votes<em>Click to take {last(n)} out of the race</em></div>
      </div>
    );
  };

  return (
    <div className="h28 p28">
      {/* the scoreboard */}
      <header className="h28-board p28-board">
        <div className="h28-board-top">
          <p className="h28-count"><i />{busy ? "Rerunning every state and county" : `${(Pf?.sims.primary ?? 4000).toLocaleString("en-US")} simulated primaries · every candidate on every ballot`}</p>
          <div className="h28-race sk-tabsline" role="tablist" aria-label="Party">
            {(["D", "R"] as P[]).map((k) => <button key={k} type="button" role="tab" aria-selected={party === k} className={party === k ? "on" : ""} onClick={() => { setParty(k); setFocus(null); setPick(null); if (mode === "cand") setMode("lead"); }}>{k === "D" ? "Democratic primary" : "Republican primary"}</button>)}
          </div>
        </div>
        <div className="h28-face-off prim">
          <div className="h28-mid wide">
            <h1 className="h28-h1">The <em>2028</em> {party === "D" ? "Democratic" : "Republican"} primary</h1>
            <p>Who wins the nomination, with the whole field on every state&apos;s ballot and every county forecast. Take anyone out and the race reruns.</p>
          </div>
          <div className="h28-leaders">
            {live.slice(0, 5).map((x, i) => (
              <div key={x.n} className={i === 0 ? "first" : undefined}>
                <Toon name={x.n} side={party} size={i === 0 ? 104 : i < 3 ? 76 : 60} uid="pl" />
                <b>{x.n}</b><span style={{ color: x.c }}>{fmtPct(x.p)}</span>
                <i className="bar"><i style={{ width: `${x.p * 100}%`, background: x.c }} /></i>
                <small>{tallies[x.n] ?? 0} states</small>
              </div>
            ))}
          </div>
        </div>
        <div className="p28-strip" aria-label="Share of the nomination">{live.filter((x) => x.p >= 0.005).map((x) => <i key={x.n} style={{ flexGrow: x.p, background: x.c }} title={`${x.n} ${fmtPct(x.p)}`}>{x.p >= 0.08 ? last(x.n) : ""}</i>)}</div>
      </header>

      {/* the field */}
      <section className="p28-field" aria-labelledby="p28-fh">
        <div className="h28-dock-h"><h2 id="p28-fh">The field</h2><span>{live.length} of {S.names.length} in · click a candidate to take them out, their voters move to the candidates most like them, county by county</span>
          {out.length ? <button type="button" className="p28-reset" onClick={() => setOuts((o) => ({ ...o, [party]: [] }))}>Put everyone back in</button> : null}</div>
        <ul>{(all ? order : order.filter((x, i) => i < 12 || !x.on)).map((x) => (
          <li key={x.n}>
            <button type="button" className={`p28-cand${x.on ? "" : " off"}${pick === x.n ? " pick" : ""}`} aria-pressed={x.on} onClick={() => toggle(x.n)} onMouseMove={(e) => x.on && point(e, { n: x.n })} onMouseLeave={() => setHov(null)} style={{ ["--cc" as string]: x.c }}>
              <Toon name={x.n} side={party} size={44} uid="pf" />
              <span className="t"><b>{x.n}</b><span>{x.on ? `${fmtPct(x.p)} nomination` : "Out of the race"}</span></span>
              <i className="sw" aria-hidden="true" />
            </button>
          </li>
        ))}</ul>
        {order.length > 12 && !all ? <button type="button" className="p28-more" onClick={() => setAll(true)}>Show all {order.length} candidates</button> : null}
      </section>

      <div className="h28-body">
        {/* the map */}
        <section className="h28-map" aria-label="Primary map">
          <div className="h28-modes">
            <div className="sk-seg" role="radiogroup" aria-label="Color the map by">
              {([["lead", "Who leads"], ["sure", "How sure"], ["cand", "One candidate"]] as [Mode, string][]).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => { setMode(k); if (k === "cand" && !pick) setPick(live[0]?.n ?? null); }}>{l}</button>)}
            </div>
            {mode === "cand" ? <select className="p28-sel" value={pick ?? ""} onChange={(e) => setPick(e.target.value)} aria-label="Candidate">{live.map((x) => <option key={x.n} value={x.n}>{x.n}</option>)}</select> : null}
            {focus ? <button type="button" className="p28-back" onClick={() => setFocus(null)}>Back to the country</button> : null}
          </div>
          <div ref={stage} className={`h28-stage ${go ? "sk-map-go" : "sk-map-wait"}${busy ? " busy" : ""}`} onMouseLeave={() => setHov(null)}>
            <span className="sk-tape tl" aria-hidden="true" /><span className="sk-tape br" aria-hidden="true" />
            {!geo || !F ? <div className="h28-load">Loading the primaries</div> : focus && box ? (
              <svg viewBox={`${box[0] - pad} ${box[1] - pad} ${box[2] + 2 * pad} ${box[3] + 2 * pad}`} role="img" aria-label={`${STATE_NAME[focus]} primary by county`} className="p28-cmap sk-map-extrude" data-sk-nohatch="" data-sk-noring="">
                <InkDefs id="p28c" />
                {fcty.length ? fcty.map((c) => <path key={c[0]} d={c[3]} fill={cfill(c[0])} className={hov?.f === c[0] ? "hov" : undefined} onMouseMove={(e) => point(e, { f: c[0], n: c[2] })} />) : <path d={geo.states[focus]} fill={fill(focus)} />}
                <path d={geo.states[focus]} className="s28-tex" fill="url(#p28c-pen)" aria-hidden="true" style={{ pointerEvents: "none" }} />
                <path d={geo.states[focus]} className="ol" />
              </svg>
            ) : (
              <svg viewBox="-20 -10 1015 630" role="img" aria-label="United States primary map" className="sk-map-extrude" data-sk-nohatch="" data-sk-noring="">
                <InkDefs id="p28" />
                <path className="h28-base" d={allD} fill="#fbfaf6" aria-hidden="true" />
                <g className="h28-states sk-map-flip" key={`${party}|${mode}|${pick}`}>
                  {shapes.map(([st, d]) => (
                    <path key={st} d={d} fill={fill(st)} className={hov?.st === st || lit === st ? "hov" : lit ? "fade" : undefined} onMouseMove={(e) => point(e, { st })} onClick={() => { setFocus(st); setHov(null); }} style={{ cursor: "pointer", "--d": delays[st] } as CSSProperties} />
                  ))}
                </g>
                <path className="h28-tex" d={allD} fill="url(#p28-pen)" aria-hidden="true" />
                <InkOutline id="p28" shapes={shapes} width={1.5} delays={delays} />
                <Lift id="p28" d={hov?.st && geo.states[hov.st] ? geo.states[hov.st] : null} fill={hov?.st ? fill(hov.st) : "none"} />
                <g className="h28-labels" aria-hidden="true">{Object.entries(geo.labels).map(([st, [x, y]]) => !SMALL.includes(st) ? <text key={st} x={x} y={y} fill="#141218" className="halo">{st}</text> : null)}</g>
              </svg>
            )}
            {focus ? null : <Pointy pose="point-pointer" size={104} className="h28-pointy" />}
          </div>
          <div className="h28-under">
            {mode === "cand" && pj >= 0 ? <span className="h28-scale"><em>Weaker</em><i style={{ background: `linear-gradient(90deg, ${heat(0, col(pj))}, ${heat(0.45, col(pj))})` }} /><em>{last(pick!)} stronger</em></span>
              : <>{live.slice(0, 7).map((x) => <span key={x.n} className="h28-pk"><i style={{ background: x.c }} />{x.n}</span>)}<span className="mute">{mode === "sure" ? "Deeper color, surer win" : "Deeper color, bigger share"}</span></>}
          </div>
        </section>

        {/* the rail */}
        <aside className="h28-ladder p28-rail" aria-labelledby="p28-rh">
          {focus && F?.states[focus] ? (() => { const s = F.states[focus]; const top = s.votes.map((v, j) => [j, v] as [number, number]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6); const big = fcty.map((c) => ({ n: c[2], f: c[0], c: F.counties[c[0]] })).sort((a, b) => tt(b.c) - tt(a.c)).slice(0, 10); return (
            <>
              <div className="h28-lad-h"><h2 id="p28-rh">{STATE_NAME[focus]}</h2><span>{WINDOWS[s.window ?? 4]?.[0]} · {fmtN(s.total)} votes · the sum of {fcty.length || "its"} counties</span></div>
              <ol className="p28-res">{top.map(([j, v]) => <li key={j}><Toon name={F.names[j]} side={party} size={34} uid="pr" /><b>{F.names[j]}</b><span className="bar"><i style={{ width: `${Math.min(100, (v / s.total) * 160)}%`, background: col(j) }} /></span><em>{fmtSh(v / s.total)}</em><small>{fmtPct(s.win[j])} to win</small></li>)}</ol>
              <h3 className="p28-sub">Biggest counties</h3>
              <ul className="p28-big">{big.map((x) => { const [j, v] = x.c[1] as [number, number]; return <li key={x.f} onMouseEnter={() => setHov(null)}><span>{x.n.replace(/ (County|Parish|Borough|Census Area|City and Borough|Municipality)$/, "")}</span><span>{fmtK(tt(x.c))}</span><b style={{ color: col(j) }}>{last(F.names[j])} {fmtSh(v / tt(x.c), 0)}</b></li>; })}</ul>
            </>
          ); })() : (
            <>
              <div className="h28-lad-h"><h2 id="p28-rh">Who wins the nomination</h2><span>Chance to win the most delegates</span></div>
              <ol className="p28-res">{live.slice(0, 10).map((x) => { const j = F ? F.names.indexOf(x.n) : -1; return (
                <li key={x.n}><Toon name={x.n} side={party} size={34} uid="pn" /><b>{x.n}</b><span className="bar"><i style={{ width: `${x.p * 100}%`, background: x.c }} /></span><em>{fmtPct(x.p)}</em><small>{F && j >= 0 ? `${fmtSh(F.votes[j] / natTot)} of the vote · ${tallies[x.n] ?? 0} states` : ""}</small></li>); })}</ol>
              {F ? <p className="h28-lad-n">{fmtN(natTot)} projected primary votes, the sum of every state and so of every county. Click any state on the map to open its counties.</p> : null}
            </>
          )}
        </aside>
      </div>

      {/* the road to the nomination */}
      {F ? (
        <section className="p28-road" aria-labelledby="p28-road-h">
          <div className="h28-dock-h"><h2 id="p28-road-h">The road to the nomination</h2><span>Every state in calendar order, colored by who leads it</span></div>
          <div className="p28-wins">{road.map((w) => (
            <div key={w.k} className="p28-win">
              <div className="h"><b>{WINDOWS[w.k]?.[0] ?? `Window ${w.k}`}</b><span>{WINDOWS[w.k]?.[1]}</span></div>
              <div className="g">{w.sts.map((st) => { const l = lead(st)!; const bg = fill(st); return (
                <button key={st} type="button" style={{ background: bg, color: inkOn(bg) }} onMouseEnter={() => setLit(st)} onMouseMove={(e) => point(e, { st })} onMouseLeave={() => { setLit(null); setHov(null); }} onClick={() => { setFocus(st); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <b>{st}</b><span>{last(F.names[l.j])} {fmtSh(l.sh, 0)}</span></button>); })}</div>
            </div>
          ))}</div>
        </section>
      ) : null}

      <Tip at={hov?.at ?? null}>{hov?.f ? tipCounty(hov.f, hov.n ?? "") : hov?.st ? tipState(hov.st) : hov?.n ? tipCand(hov.n) : null}</Tip>
    </div>
  );
}
