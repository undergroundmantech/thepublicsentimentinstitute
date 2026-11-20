"use client";
// One 2027 governor race by county: pick a matchup and every county repaints with that pairing's simulated margin,
// on the kit's five step ink wash, pale for close and deep for safe. 2024 is one tap away for comparison.
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { InkDefs, sweepDelays, useInView, washColor } from "@/onpoint-sketchbook/react/SketchMap";

type C = { fips: string; name: string; path: string; votes: number; m24: number | null };
type P = { id: string; r: string; d: string; p: number; pR: number; margin: number; cty: number[] };
const mg = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m > 0 ? "R" : "D"} +${Math.abs(m).toFixed(1)}`);
const pc = (p: number) => (p >= 0.995 ? ">99%" : p <= 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
const last = (n: string) => n.split(" ").slice(-1)[0];

export default function Map27({ id, counties, pairs, viewBox, unit }: { id: string; counties: C[]; pairs: P[]; viewBox: string; unit: string }) {
  const [sel, setSel] = useState<string>(pairs[0]?.id ?? "2024");
  const [hov, setHov] = useState<{ i: number; x: number; y: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const go = useInView(stage);
  const pair = pairs.find((x) => x.id === sel) ?? null;
  const val = (i: number) => (pair ? pair.cty[i] : counties[i].m24) ?? 0;
  const delays = useMemo(() => sweepDelays(counties.map((c) => [c.fips, c.path] as [string, string])), [counties]);
  const shown = pairs.slice(0, 6);
  const big = useMemo(() => counties.map((c, i) => ({ c, i })).sort((a, b) => b.c.votes - a.c.votes).slice(0, 8), [counties]);
  const h = hov ? counties[hov.i] : null;
  return (
    <div className="g27-mapwrap">
      <div className="sk-seg g27-seg" role="radiogroup" aria-label="Matchup on the map">
        {shown.map((x) => <button key={x.id} type="button" role="radio" aria-checked={sel === x.id} className={sel === x.id ? "on" : ""} onClick={() => setSel(x.id)}>{last(x.r)} v {last(x.d)}</button>)}
        <button type="button" role="radio" aria-checked={sel === "2024"} className={sel === "2024" ? "on" : ""} onClick={() => setSel("2024")}>2024 president</button>
      </div>
      <div className="g27-mapgrid">
        <div ref={stage} className={`h28-stage g27-stage ${go ? "sk-map-go" : "sk-map-wait"}`} onMouseLeave={() => setHov(null)}>
          <span className="sk-tape tl" aria-hidden="true" />
          <svg viewBox={viewBox} role="img" aria-label={`${unit} map`} className="sk-map-extrude" data-sk-nohatch="" data-sk-noring="">
            <InkDefs id={id} />
            <g className="sk-map-flip" key={sel}>
              {counties.map((c, i) => (
                <path key={c.fips} d={c.path} fill={washColor(val(i))} className={`county${hov?.i === i ? " hov" : ""}`} style={{ "--d": delays[c.fips] } as CSSProperties}
                  onMouseMove={(e) => { const r = stage.current!.getBoundingClientRect(); setHov({ i, x: e.clientX - r.left, y: e.clientY - r.top }); }} />
              ))}
            </g>
            {h ? <path d={h.path} className="g27-ring" /> : null}
          </svg>
          {h && hov ? (
            <div className="g27-tip" style={{ left: Math.min(hov.x + 14, (stage.current?.clientWidth ?? 600) - 220), top: hov.y + 14 }}>
              <b>{h.name}{/parish|county/i.test(h.name) ? "" : ` ${unit}`}</b>
              <span className={val(hov.i) > 0 ? "r" : "d"}>{mg(val(hov.i))}</span>
              <em>{pair ? `${last(pair.r)} v ${last(pair.d)}, simulated` : "2024 president"} · {h.votes.toLocaleString("en-US")} votes expected</em>
              {pair && h.m24 != null ? <em>2024 president: {mg(h.m24)}</em> : null}
            </div>
          ) : null}
        </div>
        <aside className="sk-panel g27-side">
          <header><h3>{pair ? `${pair.r} v ${pair.d}` : "2024 president"}</h3></header>
          {pair ? <>
            <div className="big"><b className={pair.margin > 0 ? "r" : "d"}>{mg(pair.margin)}</b><span>{last(pair.r)} wins {pc(pair.pR)} of the runs where this is the matchup</span></div>
            <p className="g27-mute">A {pc(pair.p)} chance this is the November matchup.</p>
          </> : <p className="g27-mute">How each {unit.toLowerCase()} voted for president in 2024, for comparison.</p>}
          <h4>The biggest {unit === "Parish" ? "parishes" : "counties"}</h4>
          <ul className="g27-big">{big.map(({ c, i }) => <li key={c.fips} onMouseEnter={() => setHov({ i, x: 20, y: 20 })} onMouseLeave={() => setHov(null)}><span>{c.name.replace(/ Parish$/, "")}</span><b className={val(i) > 0 ? "r" : "d"}>{mg(val(i))}</b></li>)}</ul>
          <div className="g27-key" aria-hidden="true"><span>D +40</span>{[-40, -20, -8, -3, 0, 3, 8, 20, 40].map((m) => <i key={m} style={{ background: washColor(m) }} />)}<span>R +40</span></div>
        </aside>
      </div>
    </div>
  );
}
