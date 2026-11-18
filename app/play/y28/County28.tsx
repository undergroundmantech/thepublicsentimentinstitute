"use client";
// The county war room: one state's counties from the On Point 2028 forecast, shaded three ways (the margin as your
// campaign reads it, where the persuadable voters are, and where your work is landing), with every county's numbers on
// hover and the county ground game on the right: rallies, town halls, field offices, door knocking and local ads.
// The other campaign's stops and offices show on the map. After the election it shows how each county voted.
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as E from "./engine28";
import * as CT from "./cty28";
import { shade } from "./TileMap28";
import { DaysBar, pct } from "./ui28";
import { cls, sur } from "../px/ui";
import { sfx } from "../px/sound";

type Mode = "m" | "swing" | "work";
type Sort = "big" | "close" | "swing" | "base";
const cache = new Map<string, CT.CShape>();
async function shapeOf(st: string): Promise<CT.CShape | null> {
  const k = st.split("-")[0]; if (cache.has(k)) return cache.get(k)!;
  try { const r = await fetch(`/play/cty/${k}.json`); if (!r.ok) return null; const j = (await r.json()) as CT.CShape; cache.set(k, j); return j; } catch { return null; }
}
const fmtV = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n.toLocaleString("en-US"));
const lead = (m: number, me: string, op: string) => (Math.abs(m) < 0.05 ? "Even" : m > 0 ? `${me} +${m.toFixed(1)}` : `${op} +${Math.abs(m).toFixed(1)}`);
/** Persuadable voters, dark violet for few and bright gold for many. */
const heat = (k: number) => { const t = Math.max(0, Math.min(1, (k - 0.18) / 0.82)); const a = [44, 22, 92], b = [255, 196, 64]; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`; };
/** Your county work: green where it is landing, red where the other side's is. */
const work = (v: number) => { if (Math.abs(v) < 0.05) return "#231a3f"; const t = Math.min(1, Math.abs(v) / 4); return v > 0 ? `rgb(${Math.round(35 + 26 * t)},${Math.round(60 + 160 * t)},${Math.round(70 + 60 * t)})` : `rgb(${Math.round(60 + 190 * t)},${Math.round(40 + 30 * t)},${Math.round(60 + 20 * t)})`; };

export default function County28({ d, S, st, run, onClose, final }: { d: E.Data; S: E.GenS; st: string; run: (fn: (s: E.GenS) => E.Res) => void; onClose: () => void; final?: number }) {
  const key = st.split("-")[0];
  const [shape, setShape] = useState<CT.CShape | null>(cache.get(key) ?? null);
  const [mode, setMode] = useState<Mode>(final != null ? "m" : "swing");
  const [sort, setSort] = useState<Sort>("big");
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<{ f: string; x: number; y: number } | null>(null);
  const [amt, setAmt] = useState(500e3);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => { let live = true; shapeOf(key).then((s) => { if (live) setShape(s); }); return () => { live = false; }; }, [key]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const i = d.states.findIndex((x) => x.st === key); const XS = d.states[i];
  const ms = useMemo(() => E.readMargins(d, S), [d, S]);
  const cs = useMemo(() => (final != null ? CT.nightCounties(d, S, key, final) : CT.counties(d, S, key, ms)), [d, S, key, ms, final]);
  const byF = useMemo(() => new Map(cs.map((c) => [c.f, c])), [cs]);
  const cur = (sel && byF.get(sel)) || cs[0];
  const sgn = S.party === "R" ? 1 : -1; const me = sur(S.me), op = sur(S.op);
  const travel = CT.travelOf(S, key);
  const stateRead = final ?? ms[i];
  const fill = (f: string) => { const c = byF.get(f); if (!c) return "#1a1430"; return mode === "swing" ? heat(c.swing) : mode === "work" ? work(c.loc) : shade(sgn * c.m); };
  const list = useMemo(() => { const a = cs.slice(); if (sort === "close") a.sort((x, y) => Math.abs(x.m) - Math.abs(y.m)); else if (sort === "swing") a.sort((x, y) => y.swing * Math.sqrt(y.v) - x.swing * Math.sqrt(x.v)); else if (sort === "base") a.sort((x, y) => y.m * Math.sqrt(y.v) - x.m * Math.sqrt(x.v)); return a.slice(0, 40); }, [cs, sort]);
  const stops = (S.cw?.stops ?? []).filter((x) => x.st === key && x.w >= S.week - 1);
  const vb = shape?.box ? (() => { const [x, y, w, h] = shape.box!; const p = Math.max(w, h) * 0.05; return `${x - p} ${y - p} ${w + 2 * p} ${h + 2 * p}`; })() : "0 0 975 610";
  const px = shape?.box ? Math.max(shape.box[2], shape.box[3]) / 95 : 2; // one map pixel, for the markers
  const point = (e: React.MouseEvent, f: string) => { const r = wrap.current?.getBoundingClientRect(); if (r) setHov({ f, x: e.clientX - r.left, y: e.clientY - r.top }); };
  const h = hov ? byF.get(hov.f) : null;
  const A = (k: CT.CKind, a?: number) => { if (!cur) return; sfx("click"); run((s) => CT.act(d, s, key, cur.f, k, a)); };
  const need = (k: CT.CKind) => { const c = CT.CACT[k]; const dd = c.days ? c.days + travel : 0; const cost = k === "digital" ? amt : c.cost; return S.days < dd || S.cash < cost || (k === "office" && !!cur?.off) || (k === "canvass" && (S.vol ?? 0) < 3000); };

  return (
    <div className="px-modal y28-cty-modal" role="dialog" aria-modal="true" aria-labelledby="y28-cty-h">
      <div className="px-card wide y28-cty">
        <header className="y28-cty-top">
          <div><span className={cls("px-tag", final != null ? "real" : "")}>{final != null ? "How it voted" : "County war room"}</span><h3 id="y28-cty-h">{XS?.n ?? key} <small>{XS?.ev} electoral votes · {cs.length} counties</small></h3></div>
          <div className="kv"><span className="px-k">{final != null ? "Result" : "Your read"}</span><b className={stateRead >= 0 ? "up" : "dn"}>{lead(stateRead, me, op)}</b></div>
          {final == null ? <><div className="kv"><span className="px-k">Days left</span><DaysBar n={S.days} /></div>
            <div className="kv"><span className="px-k">Cash</span><b className="gold">{E.usd(S.cash)}</b></div>
            <div className="kv"><span className="px-k">Volunteers</span><b>{Math.round((S.vol ?? 0) / 1000)}K</b></div></> : null}
          <button type="button" className="px-btn sm" onClick={onClose}>Back to the map</button>
        </header>
        <div className="y28-cty-body">
          <div className="y28-cty-mapcol">
            <div className="px-chips y28-cty-modes" role="radiogroup" aria-label="Shade the counties by">
              {([["m", final != null ? "Result" : "Margin"], ["swing", "Persuadable voters"], ["work", "Campaign work"]] as [Mode, string][]).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
            </div>
            <div className="y28-cty-map" ref={wrap} onMouseLeave={() => setHov(null)}>
              {!shape ? <p className="px-note">Loading the counties…</p> : (
                <svg viewBox={vb} role="img" aria-label={`${XS?.n} by county`} shapeRendering="crispEdges">
                  <g className="c">{Object.entries(shape.p).map(([f, p]) => <path key={f} d={p} fill={fill(f)} className={cls(cur?.f === f && "on", hov?.f === f && "hov")} onMouseMove={(e) => point(e, f)} onClick={() => { setSel(f); sfx("click"); }} />)}</g>
                  {shape.outline ? <path d={shape.outline} className="ol" /> : null}
                  <g className="mk" pointerEvents="none">
                    {cs.filter((c) => c.off || c.opOff).map((c) => <g key={`o${c.f}`} transform={`translate(${c.x} ${c.y})`}>
                      {c.off ? <><rect x={-px * 0.2} y={-px * 3} width={px * 0.5} height={px * 3} fill="#1b1328" /><rect x={px * 0.3} y={-px * 3} width={px * 1.8} height={px * 1.2} fill="#f2c14e" /></> : null}
                      {c.opOff ? <><rect x={-px * 1.8} y={-px * 3} width={px * 0.5} height={px * 3} fill="#1b1328" /><rect x={-px * 3.3} y={-px * 3} width={px * 1.5} height={px * 1.2} fill="#ff4c62" /></> : null}
                    </g>)}
                    {stops.map((x, k) => { const c = byF.get(x.f); if (!c) return null; return x.who === "me"
                      ? <g key={`s${k}`} transform={`translate(${c.x} ${c.y})`} className="me"><rect x={-px} y={-px * 0.35} width={px * 2} height={px * 0.7} /><rect x={-px * 0.35} y={-px} width={px * 0.7} height={px * 2} /></g>
                      : <g key={`s${k}`} transform={`translate(${c.x} ${c.y}) rotate(45)`} className="op"><rect x={-px} y={-px * 0.3} width={px * 2} height={px * 0.6} /><rect x={-px * 0.3} y={-px} width={px * 0.6} height={px * 2} /></g>; })}
                  </g>
                </svg>
              )}
              {h && hov ? (
                <div className="y28-cty-tip" style={{ left: Math.min(hov.x + 14, (wrap.current?.clientWidth ?? 600) - 250), top: hov.y + 14 }} role="status">
                  <b>{h.n}</b><span className="px-k">{fmtV(h.v)} votes · {(h.sh * 100).toFixed(1)}% of the state</span>
                  <span className={h.m >= 0 ? "up" : "dn"}>{lead(h.m, me, op)}</span>
                  <span>Persuadable {pct(h.swing * 0.16 + 0.03)} of voters</span>
                  {Math.abs(h.loc) >= 0.05 ? <span className={h.loc >= 0 ? "up" : "dn"}>Campaign work {h.loc >= 0 ? "+" : ""}{h.loc.toFixed(1)} here</span> : null}
                  {h.vis || h.op || h.off || h.opOff ? <span className="px-k">{[h.vis ? `your stops ${h.vis}` : "", h.op ? `${op} stops ${h.op}` : "", h.off ? "your office" : "", h.opOff ? `${op} office` : ""].filter(Boolean).join(" · ")}</span> : null}
                </div>
              ) : null}
            </div>
            <div className="y28-cty-key">{mode === "swing" ? <><span>Few persuadable</span><i className="sw" /><span>Many</span></> : mode === "work" ? <><span>{op}&apos;s work</span><i className="wk" /><span>Yours</span></> : <><span>{S.party === "D" ? me : op}</span><i className="mg" /><span>{S.party === "D" ? op : me}</span></>}
              <em><b className="me">+</b> your stops <b className="op">×</b> {op}&apos;s stops <b className="fl">▮</b> offices</em></div>
          </div>
          <div className="y28-cty-side">
            {cur ? (
              <section className="y28-cty-card">
                <h4>{cur.n}</h4>
                <div className="y28-kvs">
                  <span><small>{final != null ? "Result" : "Your read"}</small><b className={cur.m >= 0 ? "up" : "dn"}>{lead(cur.m, me, op)}</b></span>
                  <span><small>Votes</small><b>{fmtV(cur.v)}</b></span>
                  <span><small>Share of {key}</small><b>{(cur.sh * 100).toFixed(1)}%</b></span>
                  <span><small>Persuadable</small><b>{pct(cur.swing * 0.16 + 0.03)}</b></span>
                </div>
                {final == null ? <>
                  <p className="px-note y28-small">{travel ? `You were in another part of the country this week, so a stop here costs a half day of travel on top. ` : ""}{cur.m > 14 ? "Your base: turnout work pays here, persuasion does not." : cur.m < -14 ? `${op} country: little to persuade, and door knocking would turn out their voters.` : "Close and full of people still deciding: persuasion pays here."}</p>
                  <div className="y28-acts y28-cty-acts">
                    {(["rally", "hall", "office", "canvass"] as CT.CKind[]).map((k) => { const c = CT.CACT[k]; return (
                      <button key={k} type="button" className="px-btn" disabled={need(k)} title={c.blurb} onClick={() => A(k)}>
                        <small>{c.days ? `${c.days === 2 ? "1 day" : "Half day"}${travel ? " + travel" : ""} · ` : ""}{E.usd(c.cost)}{k === "canvass" ? " · volunteers" : k === "office" ? " · pays weekly" : ""}</small>{k === "office" && cur.off ? "Office open" : c.l}
                      </button>); })}
                  </div>
                  <div className="y28-reserve"><label htmlFor="y28-camt">Local digital ads</label><select id="y28-camt" value={amt} onChange={(e) => setAmt(Number(e.target.value))}>{[250e3, 500e3, 1e6, 2e6].map((a) => <option key={a} value={a}>{E.usd(a)}, ${(a / cur.v).toFixed(2)} a voter</option>)}</select><button type="button" className="px-btn sm" disabled={need("digital")} onClick={() => A("digital", amt)}>Buy</button></div>
                </> : null}
              </section>
            ) : null}
            <div className="px-chips y28-cty-sort" role="radiogroup" aria-label="Sort the counties">{([["big", "Biggest"], ["close", "Closest"], ["swing", "Most persuadable"], ["base", "Your base"]] as [Sort, string][]).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={sort === k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}</div>
            <ul className="y28-cty-list">{list.map((c) => (
              <li key={c.f}><button type="button" className={cls(cur?.f === c.f && "on")} onClick={() => setSel(c.f)} onMouseEnter={() => setHov(null)}>
                <i style={{ background: shade(sgn * c.m) }} /><b>{c.n}</b><small>{fmtV(c.v)}{c.off ? " · office" : ""}{c.vis ? ` · ${c.vis} stop${c.vis > 1 ? "s" : ""}` : ""}</small><span className={c.m >= 0 ? "up" : "dn"}>{c.m >= 0 ? "+" : ""}{c.m.toFixed(1)}</span>
              </button></li>))}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}
