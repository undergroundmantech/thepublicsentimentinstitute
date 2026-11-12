"use client";
// The 2028 map: every state, or every county, in the site's 975 x 610 frame. Hover any place for its card; click a state to
// zoom into its counties, and the card for that state is the sum of the county forecasts drawn under it.
import React, { memo, useMemo, useState, type ReactNode } from "react";
import FloatTip from "@/app/components/opp/FloatTip";
import { X, STATE_NAME, type CountiesGeo, type StatesGeo } from "./lib";
import { useJSON } from "./useX";

type Fill = (k: string) => string;
export interface MapProps {
  view: "states" | "counties";
  stateFill: Fill; countyFill: Fill;
  stateTip: (st: string) => ReactNode; countyTip: (fips: string, st: string, name: string) => ReactNode;
  focus: string | null; onFocus: (st: string | null) => void;
  label?: string; legend?: ReactNode; busy?: boolean; fkey: string;
}

const StatePaths = memo(function StatePaths({ geo, fill, focus, fkey }: { geo: StatesGeo; fill: Fill; focus: string | null; fkey: string }) {
  void fkey;
  return (
    <g className="x28-st">
      {Object.entries(geo.states).filter(([st]) => st !== focus).map(([st, d]) => (
        <path key={st} d={d} data-st={st} fill={fill(st)} className={focus ? "dim" : undefined} />
      ))}
    </g>
  );
});
const CountyPaths = memo(function CountyPaths({ rows, fill, fkey }: { rows: CountiesGeo["counties"]; fill: Fill; fkey: string }) {
  void fkey;
  return <g className="x28-co">{rows.map((c) => <path key={c[0]} d={c[3]} data-f={c[0]} fill={fill(c[0])} />)}</g>;
});

export default function Map28(p: MapProps) {
  const geo = useJSON<StatesGeo>(`${X}/states.json`);
  const needC = p.view === "counties" || !!p.focus;
  const cg = useJSON<CountiesGeo>(needC ? `${X}/counties.json` : null);
  const [tip, setTip] = useState<{ x: number; y: number; k: string; c?: [string, string] } | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const rows = useMemo(() => (cg ? (p.focus ? cg.counties.filter((c) => c[1] === p.focus) : cg.counties) : []), [cg, p.focus]);
  const byF = useMemo(() => new Map((cg?.counties ?? []).map((c) => [c[0], c])), [cg]);
  const vb = useMemo(() => {
    if (!geo || !p.focus || !geo.box[p.focus]) return "-62 0 1041 614";
    const [x, y, w, h] = geo.box[p.focus]; const pad = Math.max(w, h) * 0.08 + 4;
    const W = w + 2 * pad, H = h + 2 * pad, r = 975 / 610;
    const [ww, hh] = W / H > r ? [W, W / r] : [H * r, H];
    return `${x + w / 2 - ww / 2} ${y + h / 2 - hh / 2} ${ww} ${hh}`;
  }, [geo, p.focus]);
  const move = (e: React.MouseEvent) => {
    const t = e.target as SVGElement; const st = t.getAttribute("data-st"); const f = t.getAttribute("data-f");
    if (f) { const c = byF.get(f); if (c) { setTip({ x: e.clientX, y: e.clientY, k: f, c: [c[1], c[2]] }); setHov(f); return; } }
    if (st && (!p.focus || p.focus === st)) { setTip({ x: e.clientX, y: e.clientY, k: st }); setHov(st); return; }
    setTip(null); setHov(null);
  };
  const click = (e: React.MouseEvent) => {
    const t = e.target as SVGElement; const st = t.getAttribute("data-st") || (t.getAttribute("data-f") ? byF.get(t.getAttribute("data-f")!)?.[1] : null);
    if (st && st !== p.focus) { p.onFocus(st); setTip(null); }
  };
  const hovD = hov ? (hov.length === 5 ? byF.get(hov)?.[3] : geo?.states[hov]) : null;
  const showC = p.view === "counties" || !!p.focus;
  return (
    <div className="x28-map">
      <div className="x28-mapbar">
        <span className="x28-where">{p.focus ? <><button type="button" className="x28-back" onClick={() => p.onFocus(null)}>All states</button><b>{STATE_NAME[p.focus]}</b><span className="mute">· {rows.length} {p.focus === "AK" ? "boroughs and census areas" : "counties"}, each forecast and added up</span></> : <span className="mute">{p.label ?? "Hover a state for its votes, click to open its counties"}</span>}</span>
        {p.busy && <span className="x28-busy" role="status"><i />Updating every county</span>}
      </div>
      <div className="x28-stage" onMouseMove={move} onMouseLeave={() => { setTip(null); setHov(null); }} onClick={click}>
        {!geo ? <div className="x28-load">Loading the map</div> : (
          <svg viewBox={vb} className={`x28-svg${p.busy ? " busy" : ""}`} role="img" aria-label={p.focus ? `${STATE_NAME[p.focus]} by county` : "United States 2028 forecast map"}>
            {(p.view === "states" || p.focus) && <StatePaths geo={geo} fill={p.stateFill} focus={p.focus} fkey={p.fkey} />}
            {showC && cg && <CountyPaths rows={rows} fill={p.countyFill} fkey={p.fkey} />}
            {showC && <g className="x28-stline">{Object.entries(geo.states).filter(([st]) => !p.focus || st === p.focus).map(([st, d]) => <path key={st} d={d} />)}</g>}
            {p.focus && !cg && <path d={geo.states[p.focus]} fill={p.stateFill(p.focus)} />}
            {hovD && <path d={hovD} className="x28-hov" />}
          </svg>
        )}
      </div>
      {p.legend && <div className="x28-legend">{p.legend}</div>}
      {tip && (
        <FloatTip x={tip.x} y={tip.y} className="x28-tip" scope="opp x28">
          {tip.c ? p.countyTip(tip.k, tip.c[0], tip.c[1]) : p.stateTip(tip.k)}
        </FloatTip>
      )}
    </div>
  );
}
