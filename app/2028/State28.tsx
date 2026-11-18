"use client";
// A state's 2028 page, On Point's own layout: the state's shape behind its name and rating, a duel bar between the two
// nominees, the counties, a field of 100 simulated elections, the margin's range and the biggest counties. Every county
// moves with its state between matchups, the forecast's own rule, so the state's total is the sum of its counties.
import { useMemo, useState } from "react";
import Link from "@/app/components/Link";
import Toon from "@/app/majority-tracker/Toon";
import { fmtMg, fmtPct, last, marginColor, shiftColor } from "./lib";
import { CountyTip, Tip } from "./Tips28";
import { RATE, rateOf } from "./rate28";
import type { Pair } from "./data28";

type Data = { st: string; name: string; ev: number; base: number; sig: number; m24: number | null; outline: string; box: [number, number, number, number];
  counties: { f: string; n: string; d: string; w: number; o: number; m: number; m24: number | null }[]; dists: { k: string; ev: number }[] };
type PrimSt = { lead: string; color: string; share: number; win: number; top: [string, number, string][] } | null;
const fmtV = (n: number) => Math.round(n).toLocaleString("en-US");

export default function State28({ data, pairs, prim, distRes }: { data: Data; pairs: Pair[]; prim: { D: PrimSt; R: PrimSt }; distRes: Record<string, Record<string, [number, number] | null>> }) {
  const [sel, setSel] = useState(pairs[0].id);
  const [hov, setHov] = useState<{ f: string; x: number; y: number } | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const [mode, setMode] = useState<"m" | "s">("m");
  const p = pairs.find((x) => x.id === sel) ?? pairs[0];
  const sv = p.st[data.st] ?? [data.base, 0.5];
  const shift = sv[0] - data.base;
  const rt = RATE[rateOf(sv[0])];

  const res = useMemo(() => {
    let D = 0, R = 0, O = 0; const cty = new Map<string, { D: number; R: number; m: number; t: number }>();
    for (const c of data.counties) { const m = c.m + shift; const d = (c.w * (1 - m / 100)) / 2, r = c.w - d; D += d; R += r; O += c.o; cty.set(c.f, { D: d, R: r, m, t: c.w + c.o }); }
    return { D, R, O, T: D + R + O, cty };
  }, [data, shift]);
  const big = useMemo(() => [...data.counties].sort((a, b) => b.w - a.w).slice(0, 8), [data]);

  const [x, y, w, h] = data.box; const pad = Math.max(w, h) * 0.06;
  const vb = `${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const dWin = sv[0] <= 0, pW = dWin ? sv[1] : 1 - sv[1];
  const W = dWin ? last(p.d) : last(p.r), L = dWin ? last(p.r) : last(p.d);
  const lo = sv[0] - 1.2816 * data.sig, hi = sv[0] + 1.2816 * data.sig;
  const dSh = res.D / res.T, rSh = res.R / res.T;
  const nD = Math.round(sv[1] * 100);
  const hc = hov ? res.cty.get(hov.f) : null, hn = hov ? data.counties.find((c) => c.f === hov.f) : null;
  const S = 25, pos = (m: number) => Math.max(0, Math.min(100, ((m + S) / (2 * S)) * 100));

  return (
    <div className="s28">
      <header className="s28-hero">
        <svg className="s28-ghost" viewBox={vb} aria-hidden="true"><path d={data.outline} /></svg>
        <p className="s28-eye"><Link href="/2028">The 2028 forecast</Link> · {data.ev} electoral votes</p>
        <h1>{data.name}</h1>
        <div className="s28-rate"><span style={{ background: rt.color, color: rt.ink }}>{rt.label}</span><b>{fmtMg(sv[0])}</b><em>{W} carries it in {fmtPct(pW)} of simulations{data.m24 != null ? ` · ${fmtMg(data.m24)} in 2024` : ""}</em></div>
      </header>

      <div className="s28-mu" role="group" aria-label="Matchup">
        {pairs.map((q) => <button key={q.id} type="button" aria-pressed={q.id === sel} className={q.id === sel ? "on" : ""} onClick={() => setSel(q.id)}>{last(q.d)} v {last(q.r)}{q.odds != null ? <em>{fmtPct(q.odds)}</em> : null}</button>)}
      </div>

      {/* the duel: the projected vote between the two nominees */}
      <section className="s28-duel" aria-label="Projected vote">
        <div className={`s28-who d${dWin ? " won" : ""}`}>
          <Toon name={p.d} side="D" size={96} className="s28-face" uid="s" />
          <div><b>{p.d}</b><span>Democrat · {fmtV(res.D)} votes</span>{dWin ? <em>{data.ev} electoral votes</em> : null}</div>
        </div>
        <div className="s28-bar" role="img" aria-label={`${last(p.d)} ${(dSh * 100).toFixed(1)}%, ${last(p.r)} ${(rSh * 100).toFixed(1)}%`}>
          <i className="d" style={{ flexGrow: dSh }}><b>{(dSh * 100).toFixed(1)}%</b></i>
          <i className="o" style={{ flexGrow: res.O / res.T }} />
          <i className="r" style={{ flexGrow: rSh }}><b>{(rSh * 100).toFixed(1)}%</b></i>
          <span className="half" />
        </div>
        <div className={`s28-who r${!dWin ? " won" : ""}`}>
          <div><b>{p.r}</b><span>Republican · {fmtV(res.R)} votes</span>{!dWin ? <em>{data.ev} electoral votes</em> : null}</div>
          <Toon name={p.r} side="R" size={96} className="s28-face" uid="s" />
        </div>
        <p className="s28-oth">Other candidates {((res.O / res.T) * 100).toFixed(1)}% · {fmtV(res.T)} projected votes in all</p>
      </section>

      <div className="s28-grid">
        <section className="s28-map" aria-label={`${data.name} by county`} onMouseLeave={() => setHov(null)}>
          <div className="h28-modes s" role="radiogroup" aria-label="Color the counties by">
            {([["m", "Margin"], ["s", "Change from 2024"]] as ["m" | "s", string][]).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
            <span className="h28-closest">{data.counties.length} counties · hover any one for its vote</span>
          </div>
          <svg viewBox={vb} role="img" aria-label={`${data.name} 2028 forecast by county`}>
            {data.counties.map((c) => { const r = res.cty.get(c.f)!; return <path key={c.f} d={c.d} fill={mode === "s" ? (c.m24 != null ? shiftColor(r.m - c.m24, 16) : "#2a2438") : marginColor(r.m)} className={hov?.f === c.f || lit === c.f ? "hov" : lit ? "fade" : undefined} onMouseMove={(e) => setHov({ f: c.f, x: e.clientX, y: e.clientY })} />; })}
            <path d={data.outline} className="s28-ol" />
          </svg>
          <Tip at={hov && hc && hn ? { x: hov.x, y: hov.y } : null}>
            {hc && hn ? <CountyTip name={hn.n} st={data.st} D={hc.D} R={hc.R} O={hn.o} d={p.d} r={p.r} m={hc.m} m24={hn.m24} /> : null}
          </Tip>
          {mode === "m" ? <div className="s28-key"><span>{last(p.d)}</span><i /><span>{last(p.r)}</span></div> : <div className="s28-key"><span>Bluer than 2024</span><i className="sh" /><span>Redder than 2024</span></div>}
          {data.dists.length ? (
            <div className="s28-dists">
              {data.dists.map((d) => { const v = distRes[p.id]?.[d.k]; if (!v) return null; const r = RATE[rateOf(v[0])]; return <div key={d.k}><b>{d.k}</b><span style={{ background: r.color, color: r.ink }}>{r.label}</span><em>{fmtMg(v[0])} · {d.ev} vote</em></div>; })}
            </div>
          ) : null}
        </section>

        <aside className="s28-side">
          <section className="s28-card" aria-labelledby="s28-sims">
            <h2 id="s28-sims">100 simulated elections</h2>
            <div className="s28-dots" role="img" aria-label={`${last(p.d)} wins ${nD} of 100, ${last(p.r)} wins ${100 - nD}`}>
              {Array.from({ length: 100 }, (_, i) => <i key={i} className={i < nD ? "d" : "r"} />)}
            </div>
            <p className="s28-dl"><b className="d">{last(p.d)} {nD}</b><b className="r">{100 - nD} {last(p.r)}</b></p>
            <p className="s28-say">{pW >= 0.95 ? `${W} wins almost every time.` : pW >= 0.8 ? `${W} wins most of the time, but ${L} takes it in about ${Math.round((1 - pW) * 100)} of 100.` : pW >= 0.6 ? `${W} is ahead, and ${L} wins about ${Math.round((1 - pW) * 100)} of 100.` : "Close to a coin flip."}</p>
          </section>
          <section className="s28-card" aria-labelledby="s28-rng">
            <h2 id="s28-rng">Where the margin could land</h2>
            <div className="s28-strip" aria-hidden="true">
              <span className="z" style={{ left: "50%" }} />
              <span className="band" style={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%` }} />
              <span className="pt" style={{ left: `${pos(sv[0])}%`, background: rt.color }} />
              {data.m24 != null ? <span className="was" style={{ left: `${pos(data.m24)}%` }} title="2024" /> : null}
            </div>
            <p className="s28-ends"><span>D +{S}</span><span>Even</span><span>R +{S}</span></p>
            <p className="s28-say">8 in 10 simulations land between <b>{fmtMg(lo)}</b> and <b>{fmtMg(hi)}</b>.{data.m24 != null ? <> The ring marks 2024, {fmtMg(data.m24)}.</> : null}</p>
          </section>
          <section className="s28-card" aria-labelledby="s28-big">
            <h2 id="s28-big">The biggest counties</h2>
            <ul className="s28-big">
              {big.map((c) => { const r = res.cty.get(c.f)!; return <li key={c.f} onMouseEnter={() => setLit(c.f)} onMouseLeave={() => setLit(null)} className={lit === c.f ? "on" : undefined}><span className="n">{c.n}</span><span className="v">{fmtV(r.t)}</span><span className="m" style={{ background: marginColor(r.m), color: Math.abs(r.m) > 18 ? "#fff" : "#1b1328" }}>{fmtMg(r.m)}</span></li>; })}
            </ul>
          </section>
          {prim.D || prim.R ? (
            <section className="s28-card" aria-labelledby="s28-prim">
              <h2 id="s28-prim">{data.name}&apos;s primaries</h2>
              {(["D", "R"] as const).map((k) => { const s = prim[k]; return s ? (
                <div key={k} className="s28-pm">
                  <span className="h">{k === "D" ? "Democratic" : "Republican"}</span>
                  {s.top.map(([n, sh, c]) => <div key={n} className="row"><Toon name={n} side={k} size={28} uid="q" /><span className="n">{n}</span><span className="bar"><i style={{ width: `${sh * 100}%`, background: c }} /></span><b>{(sh * 100).toFixed(1)}%</b></div>)}
                </div>
              ) : null; })}
              <Link href={`/2028/primaries?st=${data.st}`} className="s28-more">Open the {data.name} primaries</Link>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
