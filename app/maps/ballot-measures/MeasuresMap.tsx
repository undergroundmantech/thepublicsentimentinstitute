"use client";
// Ballot measures map: every statewide question on the November 3, 2026 ballot. Pick a state on the national map or
// in the list, then a measure, and the county map shows the projected Yes share with each county's Yes and No votes.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GeoMap, { type GeoTip } from "@/app/components/opp/GeoMap";
import type { CountyPath } from "@/app/components/home/countyGeo";

export type MapMeasure = {
  id: string; st: string; label: string; title: string; href: string; yes: number; p10: number; p90: number; prob: number;
  threshold: number; votes: { yes: number; no: number; total: number } | null; category: string;
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",")})`;
export function yesFill(y: number) {
  const a = Math.min(30, Math.abs(y - 50)) / 30;
  return y >= 50 ? mix([214, 242, 234], [14, 110, 88], a) : mix([252, 226, 214], [150, 58, 20], a);
}
const YES_RAMP = "linear-gradient(90deg,#963a14 0%,#e8794a 30%,#fce2d6 49%,#d6f2ea 51%,#2fbf9b 70%,#0e6e58 100%)";
function verdict(p: number) {
  if (p >= 0.95) return "Very likely to pass"; if (p >= 0.75) return "Likely to pass"; if (p >= 0.6) return "Leans pass";
  if (p > 0.4) return "Toss up"; if (p > 0.25) return "Leans fail"; if (p > 0.05) return "Likely to fail"; return "Very likely to fail";
}
const unitOf = (st: string) => (st === "LA" ? "parishes" : st === "AK" ? "boroughs" : "counties");
const countyLabel = (nm: string, st: string) =>
  /county|parish|borough|city|census area|municipality/i.test(nm) ? nm : st === "LA" ? `${nm} Parish` : st === "AK" ? nm : `${nm} County`;

export const BMMAP_CSS = `
.bmm-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:16px;align-items:start}
@media (max-width:900px){.bmm-grid{grid-template-columns:1fr}}
.bmm-us{width:100%;height:auto;display:block}
.bmm-us path{stroke:var(--bg);stroke-width:1;cursor:pointer;transition:opacity .15s}
.bmm-us path:hover,.bmm-us path:focus-visible{opacity:.8;outline:none}
.bmm-us path.on{stroke:#fff;stroke-width:2}
.bmm-chips{display:flex;flex-wrap:wrap;gap:6px;padding:12px 14px}
.bmm-chips button{font:600 12.5px var(--font-b);color:var(--ink2);background:rgba(var(--line-rgb),.04);border:1px solid var(--line2);border-radius:999px;padding:6px 11px;cursor:pointer}
.bmm-chips button.on{color:var(--ink);border-color:var(--ink2);background:rgba(var(--line-rgb),.1)}
.bmm-chips button:focus-visible{outline:2px solid var(--hi);outline-offset:2px}
.bmm-big{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.bmm-big b{font:800 34px var(--font-d);letter-spacing:-.02em}
.bmm-yn{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.bmm-yn div{border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.bmm-yn span{display:block;font:700 10.5px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.bmm-yn b{display:block;font:800 20px var(--font-d);margin-top:4px;font-variant-numeric:tabular-nums}
.bmm-leg{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--mute);padding:4px 8px 0}
.bmm-leg i{flex:1;max-width:260px;height:8px;border-radius:4px;display:block}
.bmm-sel{width:100%;font:600 14px var(--font-b);color:var(--ink);background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:9px 10px}
`;

export default function MeasuresMap({ measures, states, frame, names }: {
  measures: MapMeasure[]; states: Record<string, string>; frame: [number, number]; names: Record<string, string>;
}) {
  const byState = useMemo(() => {
    const m: Record<string, MapMeasure[]> = {};
    for (const x of measures) (m[x.st] ??= []).push(x);
    return m;
  }, [measures]);
  const stList = useMemo(() => Object.keys(byState).sort(), [byState]);
  const first = byState.CA ? "CA" : stList[0];
  const [st, setSt] = useState(first);
  const [mid, setMid] = useState(byState[first]?.[0]?.id ?? "");
  const [geo, setGeo] = useState<Record<string, CountyPath[]>>({});
  const [cv, setCv] = useState<Record<string, Record<string, [number, number, number]>> | null>(null);

  useEffect(() => { fetch("/forecast/measures_counties.json").then((r) => r.json()).then(setCv).catch(() => setCv({})); }, []);
  useEffect(() => {
    if (!st || geo[st]) return;
    fetch(`/forecast/states/${st}.json`).then((r) => r.json()).then((g) => setGeo((o) => ({ ...o, [st]: g.counties as CountyPath[] }))).catch(() => {});
  }, [st, geo]);
  // read a ?m= or #state deep link once
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("m");
      const hit = q ? measures.find((x) => x.id === q) : null;
      if (hit) { setSt(hit.st); setMid(hit.id); }
    } catch { /* no window */ }
  }, [measures]);
  const pick = (s: string) => { setSt(s); setMid(byState[s]?.[0]?.id ?? ""); };
  const choose = (id: string) => {
    setMid(id);
    try { const u = new URL(window.location.href); u.searchParams.set("m", id); window.history.replaceState(null, "", u.toString()); } catch { /* history unavailable */ }
  };

  const m = measures.find((x) => x.id === mid) ?? byState[st]?.[0];
  const rows = (m && cv?.[m.id]) || {};
  const paths = (geo[st] ?? []).filter((p) => rows[p.id]);
  const fills: Record<string, string> = {}, tips: Record<string, GeoTip> = {};
  for (const p of paths) {
    const [y, yv, nv] = rows[p.id];
    fills[p.id] = yesFill(y);
    tips[p.id] = { title: countyLabel(names[p.id] ?? p.id, st), rows: [["Yes", `${y.toFixed(1)}%`, "#2fbf9b"], ["No", `${(100 - y).toFixed(1)}%`, "#e8794a"], ["Yes votes", fmt(yv)], ["No votes", fmt(nv)]] };
  }
  const yesCounties = paths.filter((p) => rows[p.id][0] >= 50).length;
  const top = Object.entries(rows).sort((a, b) => b[1][1] + b[1][2] - (a[1][1] + a[1][2])).slice(0, 12);

  // national map: shade each state by the share of its measures favored to pass
  const stFill = (s: string) => {
    const L = byState[s]; if (!L) return "rgba(var(--line-rgb),.06)";
    const share = L.filter((x) => x.prob > 0.5).length / L.length;
    return yesFill(50 + (share - 0.5) * 60);
  };
  const [fw, fh] = frame;

  return (
    <div className="bmm">
      <style>{BMMAP_CSS}</style>
      <div className="bmm-grid">
        <div className="card">
          <div className="card-h"><h3>Pick a state</h3><span className="eye" style={{ marginLeft: "auto" }}>{measures.length} measures in {stList.filter((s) => s !== "DC").length} states</span></div>
          <div className="card-b" style={{ padding: 10 }}>
            <svg className="bmm-us" viewBox={`0 0 ${fw} ${fh}`} role="img" aria-label="States with ballot measures on November 3, 2026, shaded by the share favored to pass">
              {Object.entries(states).map(([s, d]) => (
                <path key={s} d={d} fill={stFill(s)} className={s === st ? "on" : ""} tabIndex={byState[s] ? 0 : -1}
                  role={byState[s] ? "button" : undefined} aria-label={byState[s] ? `${s}, ${byState[s].length} measures` : undefined}
                  onClick={byState[s] ? () => pick(s) : undefined} onKeyDown={byState[s] ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(s); } } : undefined}>
                  <title>{byState[s] ? `${s}: ${byState[s].length} measures, ${byState[s].filter((x) => x.prob > 0.5).length} favored to pass` : s}</title>
                </path>
              ))}
            </svg>
            <div className="bmm-leg"><span>Most favored to fail</span><i style={{ background: YES_RAMP }} /><span>Most favored to pass</span></div>
          </div>
          <div style={{ padding: "0 14px 14px" }}>
            <label htmlFor="bmm-state" className="eye" style={{ display: "block", marginBottom: 6 }}>Or choose a state</label>
            <select id="bmm-state" className="bmm-sel" value={st} onChange={(e) => pick(e.target.value)}>
              {stList.map((s) => <option key={s} value={s}>{s} ({byState[s].length})</option>)}
            </select>
          </div>
        </div>

        {m ? (
          <div className="card">
            <div className="card-h"><h3>{m.st} {m.label}</h3><Link className="btn sm" href={m.href} style={{ marginLeft: "auto" }}>Full forecast</Link></div>
            <div className="card-b">
              <p style={{ margin: "0 0 10px", color: "var(--ink2)" }}>{m.title}</p>
              <div className="bmm-big"><b style={{ color: m.yes >= m.threshold * 100 ? "#2fbf9b" : "#e8794a" }}>{m.yes.toFixed(1)}% Yes</b><span className="eye">{verdict(m.prob)}, {Math.round(m.prob * 100)}% chance</span></div>
              <p style={{ fontSize: 13, color: "var(--mute)", margin: "6px 0 0" }}>Needs {(m.threshold * 100).toFixed(1)}% to pass. 80 percent range {m.p10.toFixed(0)} to {m.p90.toFixed(0)} percent Yes.</p>
              {m.votes ? (
                <div className="bmm-yn">
                  <div><span>Projected Yes</span><b style={{ color: "#2fbf9b" }}>{fmt(m.votes.yes)}</b></div>
                  <div><span>Projected No</span><b style={{ color: "#e8794a" }}>{fmt(m.votes.no)}</b></div>
                </div>
              ) : null}
            </div>
            <div className="bmm-chips" role="tablist" aria-label={`${st} measures`}>
              {(byState[st] ?? []).map((x) => (
                <button key={x.id} role="tab" aria-selected={x.id === m.id} className={x.id === m.id ? "on" : ""} onClick={() => choose(x.id)}>{x.label}</button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {m ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h"><h3>{m.label} by {unitOf(st).replace(/ies$/, "y").replace(/es$/, "").replace(/s$/, "")}</h3><span className="eye" style={{ marginLeft: "auto" }}>{paths.length ? `${yesCounties} of ${paths.length} ${unitOf(st)} vote Yes` : "loading"}</span></div>
          <div className="card-b" style={{ padding: 10 }}>
            {paths.length > 1 ? <GeoMap paths={paths} fills={fills} tips={tips} label={`${m.st} ${m.label} projected vote by county`} W={1000} H={620} />
              : <div className="empty" style={{ padding: 40, color: "var(--mute)" }}>{cv ? "One statewide unit for this measure." : "Loading the county map"}</div>}
            <div className="bmm-leg"><span>No +30</span><i style={{ background: YES_RAMP }} /><span>Yes +30</span><span style={{ marginLeft: "auto" }}>Hover a county for its votes</span></div>
          </div>
          {top.length > 1 ? (
            <div className="tblwrap">
              <table className="tbl">
                <thead><tr><th>Largest {unitOf(st)}</th><th style={{ textAlign: "right" }}>Yes</th><th style={{ textAlign: "right" }}>No</th><th style={{ textAlign: "right" }}>Yes share</th></tr></thead>
                <tbody>
                  {top.map(([f, v]) => (
                    <tr key={f}><td>{countyLabel(names[f] ?? f, st)}</td><td className="n">{fmt(v[1])}</td><td className="n">{fmt(v[2])}</td>
                      <td className="n" style={{ color: v[0] >= 50 ? "#2fbf9b" : "#e8794a" }}>{v[0].toFixed(1)}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p style={{ fontSize: 12.5, color: "var(--mute)", padding: "8px 14px 14px", margin: 0 }}>Every {unitOf(st).replace(/ies$/, "y").replace(/es$/, "").replace(/s$/, "")} is on the <Link href={m.href}>full {m.label} forecast</Link>.</p>
        </div>
      ) : null}
    </div>
  );
}
