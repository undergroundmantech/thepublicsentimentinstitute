"use client";
// Live results for any November 3 race civicAPI carries that the forecast does not: university boards, treasurers,
// auditors, commissions, courts. The count, a county map shaded by the leader, and every county in a table.
import React, { useEffect, useMemo, useState } from "react";
import Link from "@/app/components/Link";
import { geoMercator, geoPath, geoArea } from "d3-geo";
import type { CDetail } from "@/app/results/2026/live";
import { STN } from "@/app/results/2026/live";

const ST_FIPS: Record<string, string> = { AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56" };
const OTHER = ["#e7b341", "#b78cff", "#2fbf9b", "#e7794a", "#7fd4ff", "#ff8fd1"];
const nf = (x: number) => x.toLocaleString("en-US");
let LL: Record<string, number[][][]> | null = null;

export default function CivicRace({ id }: { id: number }) {
  const [d, setD] = useState<CDetail | null>(null);
  const [err, setErr] = useState(false);
  const [ll, setLl] = useState(LL);
  const [hov, setHov] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    const load = () => fetch(`/api/civic/race/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => { if (!dead) { setD(j); setErr(false); } }).catch(() => { if (!dead) setErr(true); });
    load(); const t = setInterval(() => { if (!document.hidden) load(); }, 30_000);
    return () => { dead = true; clearInterval(t); };
  }, [id]);
  useEffect(() => { if (!LL) fetch("/results/2026/counties_ll.json").then((r) => r.json()).then((j) => { LL = j; setLl(j); }).catch(() => {}); }, []);
  const color = useMemo(() => {
    const m: Record<string, string> = {}; let k = 0;
    for (const c of d?.c ?? []) m[c[0]] = /^dem/i.test(c[1]) || c[1] === "D" ? "#3d7bff" : /^rep/i.test(c[1]) || c[1] === "R" ? "#ff3b5c" : OTHER[k++ % OTHER.length];
    return m;
  }, [d]);
  const st = (d?.province || "").toUpperCase(), sf = ST_FIPS[st];
  const regions = useMemo(() => Object.entries(d?.regions ?? {}).filter(([, r]) => !r.t || /county|parish|borough|census/i.test(r.t)), [d]);
  const shapes = useMemo(() => {
    if (!ll || !sf) return null;
    const feats = Object.entries(ll).filter(([f]) => f.startsWith(sf)).map(([f, rings]) => ({ type: "Feature" as const, id: f, properties: {}, geometry: { type: "MultiPolygon" as const, coordinates: rings.map((r) => [geoArea({ type: "Polygon", coordinates: [r] } as never) > 2 * Math.PI ? [...r].reverse() : r]) } }));
    if (!feats.length) return null;
    const fc = { type: "FeatureCollection" as const, features: feats };
    const proj = geoMercator().fitSize([640, 460], fc as never); const path = geoPath(proj);
    return feats.map((f) => ({ f: f.id, d: path(f as never) || "" }));
  }, [ll, sf]);
  const fillOf = (key: string) => {
    const r = d?.regions[key]; if (!r) return "rgba(var(--line-rgb),.06)";
    const t = r.c.reduce((a, c) => a + c[2], 0); if (!t) return "rgba(var(--line-rgb),.1)";
    const s = [...r.c].sort((a, b) => b[2] - a[2]); const lead = (s[0][2] - (s[1]?.[2] ?? 0)) / t;
    const a = 0.3 + Math.min(1, lead / 0.4) * 0.7; const hex = color[s[0][0]] ?? "#8e86a3";
    const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(2)})`;
  };
  if (!d) return <div className="cr-card"><p style={{ color: "var(--mute)" }}>{err ? "Live returns are not reachable right now. This page tries again every 30 seconds." : "Loading the race"}</p></div>;
  const tot = d.c.reduce((a, c) => a + c[2], 0);
  const cands = [...d.c].sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]));
  const hr = hov ? d.regions[hov] : null;
  return (
    <div className="cr">
      <header className="cr-h">
        <div className="eye">{STN[st] ?? st} · {d.type} · November 3, 2026</div>
        <h1>{d.name}</h1>
        <p>{tot > 0 ? `${d.pr.toFixed(0)}% of the expected vote reported. ` : "No votes counted yet. "}Live returns from civicAPI, refreshed every 30 seconds. This race is not part of the On Point forecast, so it shows the count only.</p>
      </header>
      <section className="cr-card">
        <ul className="cr-c">
          {cands.map((c) => (
            <li key={c[0]}>
              <span className="sw" style={{ background: color[c[0]] }} />
              <span className="nm">{c[0]} {c[4] ? <b className="win">Winner</b> : null}<small>{c[1]}</small></span>
              <span className="bar"><i style={{ width: `${tot ? (100 * c[2]) / tot : 0}%`, background: color[c[0]] }} /></span>
              <span className="pc">{tot ? ((100 * c[2]) / tot).toFixed(1) : "0.0"}%</span>
              <span className="vt">{nf(c[2])}</span>
            </li>
          ))}
        </ul>
      </section>
      {regions.length > 0 && (
        <section className="cr-grid">
          {shapes && (
            <div className="cr-card cr-map">
              <svg viewBox="0 0 640 460" role="img" aria-label={`${d.name} by county`}>
                {shapes.map((s) => <path key={s.f} d={s.d} fill={fillOf(s.f)} stroke="var(--bg)" strokeWidth={0.6} onMouseEnter={() => setHov(s.f)} onMouseLeave={() => setHov(null)} />)}
              </svg>
              <div className="cr-hov">{hr ? <><b>{hr.n}</b> · {hr.pr.toFixed(0)}% in · {[...hr.c].sort((a, b) => b[2] - a[2]).slice(0, 2).map((c) => `${c[0].split(" ").slice(-1)[0]} ${c[3].toFixed(1)}%`).join(", ")}</> : "Hover a county"}</div>
            </div>
          )}
          <div className="cr-card cr-tbl">
            <table>
              <thead><tr><th>County</th><th className="n">In</th>{cands.slice(0, 3).map((c) => <th key={c[0]} className="n">{c[0].split(" ").slice(-1)[0]}</th>)}</tr></thead>
              <tbody>
                {regions.sort((a, b) => a[1].n.localeCompare(b[1].n)).map(([k, r]) => (
                  <tr key={k} className={hov === k ? "on" : ""} onMouseEnter={() => setHov(k)} onMouseLeave={() => setHov(null)}>
                    <td>{r.n}</td><td className="n">{r.pr.toFixed(0)}%</td>
                    {cands.slice(0, 3).map((c) => { const x = r.c.find((y) => y[0] === c[0]); return <td key={c[0]} className="n">{x ? `${x[3].toFixed(1)}%` : ""}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="cr-foot"><Link href={`/results/2026/${(STN[st] ?? st).toLowerCase().replace(/[^a-z]+/g, "-")}`}>Every {STN[st] ?? st} race</Link> · <Link href="/results/monitor">Situation monitor</Link></p>
    </div>
  );
}
