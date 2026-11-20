"use client";
// The county layer for the national 2028 sketch maps: every county from x/counties.json, drawn in the same 975 x 610
// projection as the states, under the state outlines. Used by the overview and the general election page.
import { memo, type MouseEvent } from "react";
import Toon from "@/app/majority-tracker/Toon";
import { fmtMg, last, type CountyGeo } from "./lib";

export type View = "st" | "co";

/** the Statewide and Counties switch beside the color modes */
export function ViewSeg({ view, set, busy }: { view: View; set: (v: View) => void; busy?: boolean }) {
  return (
    <div className="sk-seg" role="radiogroup" aria-label="Map view">
      {([["st", "Statewide"], ["co", busy && view === "co" ? "Counties, loading" : "Counties"]] as [View, string][]).map(([k, l]) => (
        <button key={k} type="button" role="radio" aria-checked={view === k} className={view === k ? "on" : ""} onClick={() => set(k)}>{l}</button>
      ))}
    </div>
  );
}

/** every county, filled by the caller; the key decides when to repaint */
export const CountyPaths28 = memo(function CountyPaths28({ rows, fill, onHover, onLeave, href, onPick }: { rows: CountyGeo[]; fill: (f: string) => string; onHover: (f: string, e: MouseEvent) => void; onLeave: () => void; href: (st: string) => string; paint: string; onPick?: (st: string) => void }) {
  return (
    <g className="h28-cty">
      {rows.map((c) => (
        <a key={c[0]} href={href(c[1])} aria-label={`${c[2]}, ${c[1]}`} onClick={onPick ? (e) => { e.preventDefault(); onPick(c[1]); } : undefined}>
          <path d={c[3]} fill={fill(c[0])} onMouseMove={(e) => onHover(c[0], e)} onMouseLeave={onLeave} />
        </a>
      ))}
    </g>
  );
}, (a, b) => a.rows === b.rows && a.paint === b.paint && !!a.onPick === !!b.onPick);

export type CtyRow = { name: string; side: "D" | "R" | "U"; v: number; c?: string };

/** a county: every candidate's votes and share, the leader's lead over the field and the change from 2024 */
export function CtyTip({ name, st, rows, other, m24, m, note = "Click for the state's counties" }: { name: string; st: string; rows: CtyRow[]; other: number; m24: number | null; m: number | null; note?: string }) {
  const tot = rows.reduce((a, r) => a + r.v, 0) + other || 1;
  const s = [...rows].sort((a, b) => b.v - a.v);
  const fm = s.length > 1 ? (100 * (s[0].v - s[1].v)) / tot : 0;
  const f = (n: number) => Math.round(n).toLocaleString("en-US");
  const col = s[0]?.c ?? (s[0]?.side === "D" ? "#1f3fd1" : "#d42a2a");
  return (
    <div className="t28-card">
      <div className="t28-h"><b>{name}</b><span>{st} · {f(tot)} votes</span></div>
      <div className="t28-rt"><span style={{ background: col, color: "#fff" }}>{last(s[0]?.name ?? "")} +{fm.toFixed(1)}</span></div>
      {s.map((x) => (
        <div key={x.name} className={`t28-row ${x.side === "D" ? "d" : x.side === "R" ? "r" : "i"}${x === s[0] ? " lead" : ""}`}>
          <Toon name={x.name} side={x.side} size={28} uid="c" />
          <span className="n">{last(x.name)}</span>
          <span className="s">{((100 * x.v) / tot).toFixed(1)}%</span>
          <span className="bar"><i style={{ width: `${(100 * x.v) / tot}%`, ...(x.c ? { background: x.c } : {}) }} /></span>
          <span className="p">{f(x.v)}</span>
        </div>
      ))}
      <div className="t28-f">{m24 != null ? `2024: ${fmtMg(m24)}${m != null ? ` · ${Math.abs(m - m24).toFixed(1)} points ${m < m24 ? "bluer" : "redder"} now` : ""}` : ""}{note ? <em>{note}</em> : null}</div>
    </div>
  );
}
