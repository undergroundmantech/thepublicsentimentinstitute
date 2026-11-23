"use client";
// Election night, read back: the final map, the swing from 2024 in every state, a table of every state, and any
// state's counties, by final margin or by how far each moved from Trump against Harris in 2024.
import React, { useEffect, useMemo, useState } from "react";
import * as E from "./engine28";
import * as CT from "./cty28";
import TileMap28, { shade } from "./TileMap28";
import { cls } from "../px/ui";
import { sfx } from "../px/sound";

type View = "map" | "swing" | "table" | "cty";
const fm = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`);
/** Fill for a swing, R minus D points: blue toward Democrats, red toward Republicans, deeper with size. */
const SD = ["#13308f", "#2a5ee8", "#6f97ff", "#b5c8ff"], SR = ["#8f1028", "#e0284b", "#ff7a93", "#ffc4cf"];
export function swingFill(x: number | null) {
  if (x == null || !isFinite(x)) return "#2f1f5a";
  const a = Math.abs(x); if (a < 0.75) return "#5a4d78";
  const k = a >= 12 ? 0 : a >= 6 ? 1 : a >= 3 ? 2 : 3; return x < 0 ? SD[k] : SR[k];
}
const shapes = new Map<string, CT.CShape>();
async function shapeOf(st: string) {
  if (shapes.has(st)) return shapes.get(st)!;
  try { const r = await fetch(`/play/cty/${st}.json`); if (!r.ok) return null; const j = (await r.json()) as CT.CShape; shapes.set(st, j); return j; } catch { return null; }
}

export default function Swing28({ d, s, res }: { d: E.Data; s: E.GenS; res: E.NightRes }) {
  const [view, setView] = useState<View>("swing");
  const sg = s.party === "R" ? 1 : -1;
  const rows = useMemo(() => res.calls.map((c) => { const x = d.states[c.i]; const m = sg * c.m; return { st: c.st, n: x.n, ev: c.ev, m, p24: x.p24, sw: x.p24 == null ? null : m - x.p24, mine: c.win }; }), [d, res, sg]);
  const byS = useMemo(() => new Map(rows.map((r) => [r.st, r])), [rows]);
  const [sort, setSort] = useState<"close" | "swing" | "ev" | "name">("close");
  const sorted = rows.slice().sort((a, b) => sort === "close" ? Math.abs(a.m) - Math.abs(b.m) : sort === "swing" ? Math.abs(b.sw ?? 0) - Math.abs(a.sw ?? 0) : sort === "ev" ? b.ev - a.ev : a.n.localeCompare(b.n));
  const nat24 = 1.5; const nsw = -res.pop * sg - nat24; // popular vote now, R minus D, against Trump +1.5 in 2024
  const ctyStates = useMemo(() => rows.filter((r) => !r.st.includes("-") && d.cty?.[r.st]).sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).map((r) => r.st), [rows, d]);
  const [cst, setCst] = useState<string>(ctyStates[0] ?? "PA");
  const [cview, setCview] = useState<"shift" | "margin">("shift");
  const [shape, setShape] = useState<CT.CShape | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  useEffect(() => { if (view !== "cty") return; let live = true; setShape(null); shapeOf(cst).then((x) => { if (live) setShape(x); }); return () => { live = false; }; }, [view, cst]);
  const cty = useMemo(() => {
    if (view !== "cty") return new Map<string, { n: string; m: number; m24: number | null; v: number }>();
    const fin = res.calls.find((c) => c.st === cst)?.m ?? 0; const rws = CT.rowsOf(d, cst); const m24 = new Map(rws.map((r) => [r[0], r[8] ?? null]));
    return new Map(CT.nightCounties(d, s, cst, fin).map((c) => [c.f, { n: c.n, m: sg * c.m, m24: (m24.get(c.f) as number | null) ?? null, v: c.v }]));
  }, [view, cst, d, s, res, sg]);
  const hc = hov ? cty.get(hov) : null;
  const vb = shape?.box ? (() => { const [x, y, w, h] = shape.box!; const p = Math.max(w, h) * 0.04; return `${x - p} ${y - p} ${w + 2 * p} ${h + 2 * p}`; })() : "0 0 975 610";
  const biggest = rows.filter((r) => r.sw != null && !r.st.includes("-")).sort((a, b) => Math.abs(b.sw!) - Math.abs(a.sw!)).slice(0, 5);
  return (
    <section className="px-step y28-swing" aria-labelledby="y28-sw-h">
      <span className="px-k" id="y28-sw-h">The results, state by state</span>
      <div className="px-chips" role="tablist" aria-label="Results view">
        {([["map", "Final map"], ["swing", "Swing from 2024"], ["table", "Every state"], ["cty", "Counties"]] as [View, string][]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => { setView(k); sfx("click"); }}>{l}</button>)}
      </div>
      {view === "map" ? <TileMap28 states={d.states.map((x) => x.st)} title="The final map" fill={(st) => shade(byS.get(st)?.m ?? null)} label={(st) => { const r = byS.get(st); return r ? fm(r.m).replace(" +", "") : ""; }} /> : null}
      {view === "swing" ? <>
        <TileMap28 states={d.states.map((x) => x.st)} title="Swing from 2024" fill={(st) => swingFill(byS.get(st)?.sw ?? null)} label={(st) => { const r = byS.get(st); return r?.sw != null ? `${r.sw < 0 ? "D" : "R"}${Math.abs(r.sw).toFixed(0)}` : ""; }} />
        <p className="px-note">Against Trump's 2024 map, the nation moved {Math.abs(nsw) < 0.05 ? "nowhere" : `${Math.abs(nsw).toFixed(1)} points toward ${nsw < 0 ? "the Democrats" : "the Republicans"}`}. Biggest moves: {biggest.map((r) => `${r.n} ${r.sw! < 0 ? "D" : "R"} +${Math.abs(r.sw!).toFixed(1)}`).join(", ")}.</p>
        <div className="y28-legend"><span><i style={{ background: SD[0] }} />12+ bluer</span><span><i style={{ background: SD[2] }} />3 to 6</span><span><i style={{ background: "#5a4d78" }} />about the same</span><span><i style={{ background: SR[2] }} />3 to 6</span><span><i style={{ background: SR[0] }} />12+ redder</span></div>
      </> : null}
      {view === "table" ? (
        <div className="y28-tblwrap">
          <div className="px-chips" aria-label="Sort">{([["close", "Closest"], ["swing", "Biggest swing"], ["ev", "Electoral votes"], ["name", "A to Z"]] as const).map(([k, l]) => <button key={k} type="button" className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}</div>
          <table className="y28-tbl"><thead><tr><th>State</th><th className="n">EV</th><th>Winner</th><th className="n">2028</th><th className="n">2024</th><th className="n">Swing</th></tr></thead>
            <tbody>{sorted.map((r) => <tr key={r.st}><td>{r.n}</td><td className="n">{r.ev}</td><td className={r.mine ? "up" : "dn"}>{r.mine ? s.me : s.op}</td><td className="n">{fm(r.m)}</td><td className="n">{r.p24 == null ? "" : fm(r.p24)}</td><td className="n" style={{ color: r.sw == null ? undefined : swingFill(r.sw) }}>{r.sw == null ? "" : `${r.sw < 0 ? "D" : "R"} +${Math.abs(r.sw).toFixed(1)}`}</td></tr>)}</tbody></table>
        </div>) : null}
      {view === "cty" ? (
        <div className="y28-swcty">
          <div className="px-row">
            <label className="px-k" htmlFor="y28-sw-st">State</label>
            <select id="y28-sw-st" value={cst} onChange={(e) => setCst(e.target.value)}>{ctyStates.map((st) => <option key={st} value={st}>{E.nameOf(d, st)} · {fm(byS.get(st)!.m)}</option>)}</select>
            <div className="px-chips">{(["shift", "margin"] as const).map((k) => <button key={k} type="button" className={cview === k ? "on" : ""} onClick={() => setCview(k)}>{k === "shift" ? "Shift from 2024" : "Final margin"}</button>)}</div>
          </div>
          {!shape ? <p className="px-note">Loading the counties…</p> : (
            <svg viewBox={vb} role="img" aria-label={`${E.nameOf(d, cst)} by county`} className="y28-swmap">
              {Object.entries(shape.p).map(([f, p]) => { const c = cty.get(f); const v = !c ? null : cview === "shift" ? (c.m24 == null ? null : c.m - c.m24) : c.m;
                return <path key={f} d={p} fill={cview === "shift" ? swingFill(v) : shade(v)} stroke="#120a1e" strokeWidth={hov === f ? 1.6 : 0.4} onMouseEnter={() => setHov(f)} onMouseLeave={() => setHov(null)} onClick={() => setHov(f)} />; })}
            </svg>)}
          <p className="px-note">{hc ? `${hc.n}: ${fm(hc.m)} in 2028${hc.m24 != null ? `, ${fm(hc.m24)} in 2024, a ${hc.m - hc.m24 < 0 ? "D" : "R"} +${Math.abs(hc.m - hc.m24).toFixed(1)} shift` : ""}, about ${Math.round(hc.v).toLocaleString()} votes.` : "Point at a county for its result and its shift from 2024."}</p>
        </div>) : null}
    </section>
  );
}
