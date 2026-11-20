"use client";
// A state's two primaries on its own page, county by county: the Democratic and the Republican primary side by side,
// each county colored by its leader, deeper as the leader's share grows, with every county's top three on hover. The
// state totals above each map are the sum of these counties, the same numbers the primaries page shows.
import { useMemo, useState } from "react";
import Link from "@/app/components/Link";
import Toon from "@/app/majority-tracker/Toon";
import { fmtN, fmtPct, fmtSh, leaderColor } from "./lib";
import { Tip, type At } from "./Tips28";
import type { PrimState } from "./data28";

type Cty = { f: string; n: string; d: string };

export default function PrimCounties28({ st, name, counties, outline, box, prim }: { st: string; name: string; counties: Cty[]; outline: string; box: [number, number, number, number]; prim: Record<"D" | "R", PrimState | null> }) {
  const [hov, setHov] = useState<{ at: At; k: "D" | "R"; f: string } | null>(null);
  const [x, y, w, h] = box; const pad = Math.max(w, h) * 0.05;
  const vb = `${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const byF = useMemo(() => new Map(counties.map((c) => [c.f, c])), [counties]);
  const unit = st === "AK" ? "boroughs" : st === "LA" ? "parishes" : "counties";
  const panel = (k: "D" | "R") => {
    const P = prim[k]; if (!P) return null;
    const order = P.votes.map((v, j) => [j, v] as [number, number]).filter((q) => q[1] > 0).sort((a, b) => b[1] - a[1]);
    const lead = order[0]; const fill = (f: string) => { const c = P.counties[f]; return c ? leaderColor(P.colors[c.l] ?? "#8f8a99", Math.min(0.62, c.s * 2.2)) : "#e4e0d8"; };
    const won = new Map<number, number>(); for (const c of Object.values(P.counties)) won.set(c.l, (won.get(c.l) ?? 0) + 1);
    return (
      <section className="pc28-one" aria-labelledby={`pc28-${k}`}>
        <header>
          <p className="h28-party">{k === "D" ? "Democratic primary" : "Republican primary"}</p>
          <h3 id={`pc28-${k}`}><Toon name={P.names[lead[0]]} side={k} size={44} uid={`pc${k}`} /><span><b>{P.names[lead[0]]}</b> leads {name} with {fmtSh(lead[1] / P.total)}</span></h3>
          <p className="pc28-sub">{P.win[lead[0]] != null ? `Carries the state in ${fmtPct(P.win[lead[0]])} of runs · ` : ""}{fmtN(P.total)} projected votes, the sum of {Object.keys(P.counties).length} {unit}</p>
        </header>
        <div className="s28-paper pc28-paper">
          <span className="sk-tape tl" aria-hidden="true" />
          <svg viewBox={vb} role="img" aria-label={`${name} ${k === "D" ? "Democratic" : "Republican"} primary by county`} onMouseLeave={() => setHov(null)}>
            {counties.map((c) => <path key={c.f} d={c.d} fill={fill(c.f)} className={hov?.k === k && hov.f === c.f ? "hov" : undefined} onMouseMove={(e) => setHov({ at: { x: e.clientX, y: e.clientY }, k, f: c.f })} />)}
            <path d={outline} className="ol" />
          </svg>
        </div>
        <ul className="pc28-key">
          {order.slice(0, 5).map(([j, v]) => <li key={j}><i style={{ background: P.colors[j] }} /><b>{P.names[j]}</b><span>{fmtSh(v / P.total)}</span><em>{won.get(j) ?? 0} {unit}</em></li>)}
        </ul>
        <Link href={`/2028/primaries?st=${st}&party=${k}`} className="s28-more">Open the {k === "D" ? "Democratic" : "Republican"} primary, take candidates out and rerun</Link>
      </section>
    );
  };
  const tip = (() => {
    if (!hov) return null; const P = prim[hov.k]; const c = P?.counties[hov.f]; const g = byF.get(hov.f); if (!P || !g) return null;
    if (!c) return <div className="t28-card"><div className="t28-h"><b>{g.n}</b><span>{hov.k === "D" ? "Democratic" : "Republican"} primary</span></div><div className="t28-f">No projected {hov.k === "D" ? "Democratic" : "Republican"} primary votes in this {unit === "counties" ? "county" : unit.slice(0, -1)}</div></div>;
    return (
      <div className="t28-card">
        <div className="t28-h"><b>{g.n}</b><span>{hov.k === "D" ? "Democratic" : "Republican"} primary</span></div>
        {c.top.map(([j, s], i) => (
          <div key={j} className={`t28-row${i === 0 ? " lead" : ""}`} style={{ ["--cc" as string]: P.colors[j] }}>
            <Toon name={P.names[j]} side={hov.k} size={30} uid="pt" />
            <span className="n">{P.names[j]}</span>
            <span className="s">{(s * 100).toFixed(1)}%</span>
            <span className="bar"><i style={{ width: `${s * 100}%`, background: P.colors[j] }} /></span>
          </div>
        ))}
        <div className="t28-f">{fmtN(c.t)} projected primary votes</div>
      </div>
    );
  })();
  if (!prim.D && !prim.R) return null;
  return (
    <section className="pc28" aria-labelledby="pc28-h">
      <div className="h28-dock-h"><h2 id="pc28-h">{name}&apos;s primaries, county by county</h2><span>Every candidate on the ballot, every {unit === "counties" ? "county" : unit.slice(0, -1)} forecast, hover any one for its top three</span></div>
      <div className="pc28-two">{panel("D")}{panel("R")}</div>
      <Tip at={hov?.at ?? null}>{tip}</Tip>
    </section>
  );
}
