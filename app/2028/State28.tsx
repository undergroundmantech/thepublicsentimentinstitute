"use client";
// A state's 2028 page, On Point's own layout: the state's shape behind its name and rating, a duel bar between the two
// nominees, the counties, a field of 100 simulated elections, the margin's range and the biggest counties. Every county
// moves with its state between matchups, the forecast's own rule, so the state's total is the sum of its counties.
// Sketchbook look, Nov 19 2026: the state floats as a 3D paper slab in the hero, its rating stamps down on every
// matchup, the counties flip in from the left under a pencil outline that traces itself, and a hovered county pops up.
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { InkDefs, InkOutline, Lift, Slab3D, sweepDelays, useInView, usePxScale } from "@/onpoint-sketchbook/react/SketchMap";
import { WASH_CUTS, WASH_D, WASH_R, WASH_T, washColor, washInk, washStep } from "./lib";
import Link from "@/app/components/Link";
import Toon from "@/app/majority-tracker/Toon";
import { fmtMg, fmtPct, last, shiftColor, tmAdd } from "./lib";
import { CountyTip, Tip } from "./Tips28";
import { RATE, rateOf } from "./rate28";
import type { Pair, StateEvery } from "./data28";

type Data = { tm?: { dims: Record<string, number[]>; coef: Record<string, number[]> } | null; st: string; name: string; ev: number; base: number; sig: number; m24: number | null; outline: string; box: [number, number, number, number];
  counties: { f: string; n: string; d: string; w: number; o: number; m: number; m24: number | null }[]; dists: { k: string; ev: number }[] };
type PrimSt = { lead: string; color: string; share: number; win: number; top: [string, number, string][] } | null;
const fmtV = (n: number) => Math.round(n).toLocaleString("en-US");

export default function State28({ data, pairs, prim, distRes: dr0, every }: { data: Data; pairs: Pair[]; prim: { D: PrimSt; R: PrimSt }; distRes: Record<string, Record<string, [number, number] | null>>; every: StateEvery }) {
  const [sel, setSel] = useState(pairs[0].id);
  // any pairing the forecast ran opens here, not only the featured ones
  const anyPair = (id: string): Pair | null => {
    const f = pairs.find((x) => x.id === id); if (f) return f;
    const row = every.rows[id]; if (!row) return null; const [d, r] = id.split("|");
    return { id, d, r, pD: 0, evD: 0, ev10: 0, ev90: 0, nat: 0, tip: "", odds: null, evMap: 0, st: { [data.st]: row[0] ?? [data.base, 0.5] } };
  };
  const distRes = useMemo(() => {
    if (dr0[sel]) return dr0; const row = every.rows[sel]; if (!row) return dr0;
    return { ...dr0, [sel]: Object.fromEntries(data.dists.map((d, i) => [d.k, row[i + 1] ?? null])) };
  }, [dr0, sel, every, data.dists]);
  const [pd, pr] = sel.split("|");
  const pick = (d: string, r: string) => { const id = `${d}|${r}`; if (every.rows[id]) setSel(id); };
  const [hov, setHov] = useState<{ f: string; x: number; y: number } | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const [mode, setMode] = useState<"m" | "s">("m");
  const p = anyPair(sel) ?? pairs[0];
  const sv = p.st[data.st] ?? [data.base, 0.5];
  const shift = sv[0] - data.base;
  const rt = RATE[rateOf(sv[0])];

  const res = useMemo(() => {
    let D = 0, R = 0, O = 0; const cty = new Map<string, { D: number; R: number; m: number; t: number }>();
    // who shows up depends on the matchup: each county's votes move with its voter groups' turnout for these nominees,
    // and one small shift across the state keeps the state's margin, the sum of its counties, where the forecast has it
    const k = new Map<string, number>(); let a0 = 0, w0 = 0, a1 = 0, w1 = 0;
    for (const c of data.counties) { const x = data.tm ? 1 + tmAdd(data.tm, c.f, p.d, p.r, c.w + c.o) / Math.max(1, c.w + c.o) : 1; k.set(c.f, x); const m = c.m + shift; a0 += c.w * m; w0 += c.w; a1 += c.w * x * m; w1 += c.w * x; }
    const adj = w0 > 0 && w1 > 0 ? a0 / w0 - a1 / w1 : 0;
    for (const c of data.counties) { const x = k.get(c.f) ?? 1; const w = c.w * x, o = c.o * x; const m = c.m + shift + adj; const d = (w * (1 - m / 100)) / 2, r = w - d; D += d; R += r; O += o; cty.set(c.f, { D: d, R: r, m, t: w + o }); }
    return { D, R, O, T: D + R + O, cty };
  }, [data, shift, p.d, p.r]);
  const big = useMemo(() => [...data.counties].sort((a, b) => b.w - a.w).slice(0, 8), [data]);
  const mapBox = useRef<HTMLElement>(null);
  const go = useInView(mapBox);
  const cShapes = useMemo(() => data.counties.map((c) => [c.f, c.d] as [string, string]), [data]);
  const cDel = useMemo(() => sweepDelays(cShapes, 1.1), [cShapes]);

  const [x, y, w, h] = data.box; const pad = Math.max(w, h) * 0.06;
  const vb = `${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const dWin = sv[0] <= 0, pW = dWin ? sv[1] : 1 - sv[1];
  const W = dWin ? last(p.d) : last(p.r), L = dWin ? last(p.r) : last(p.d);
  const lo = sv[0] - 1.2816 * data.sig, hi = sv[0] + 1.2816 * data.sig;
  const dSh = res.D / res.T, rSh = res.R / res.T;
  const nD = Math.round(sv[1] * 100);
  const hc = hov ? res.cty.get(hov.f) : null, hn = hov ? data.counties.find((c) => c.f === hov.f) : null;
  const S = 25, pos = (m: number) => Math.max(0, Math.min(100, ((m + S) / (2 * S)) * 100));
  const ctySvg = useRef<SVGSVGElement>(null);
  const sc = usePxScale(ctySvg, vb);
  const cFill = (f: string) => { const c = data.counties.find((q) => q.f === f); const r = res.cty.get(f); if (!c || !r) return "none"; return mode === "s" ? (c.m24 != null ? shiftColor(r.m - c.m24, 16) : "#d8d3c8") : washColor(r.m); };
  // counties per step of the wash, for the legend
  const steps = useMemo(() => { const n = { d: [0, 0, 0, 0, 0], r: [0, 0, 0, 0, 0], t: 0 }; for (const c of data.counties) { const m = res.cty.get(c.f)?.m ?? 0; const k = washStep(m); if (k === 0) n.t++; else (m < 0 ? n.d : n.r)[k - 1]++; } return n; }, [data, res]);
  const upC = hov?.f ?? lit;

  return (
    <div className="s28">
      <header className="s28-hero">
        <div className="s28-hero-t">
          <p className="s28-eye"><Link href="/2028">The 2028 forecast</Link> · {data.ev} electoral votes</p>
          <h1>{data.name}</h1>
          <div className="s28-rate"><span key={p.id} className="s28-stamp" style={{ color: rt.text ?? rt.color }}>{rt.label}</span><b key={p.id + "m"} className="h28-slam">{fmtMg(sv[0])}</b><em>{W} carries it in {fmtPct(pW)} of simulations{data.m24 != null ? ` · ${fmtMg(data.m24)} in 2024` : ""}</em></div>
        </div>
        <div className="s28-slab-wrap">
          <Slab3D d={data.outline} viewBox={vb} fill={rt.color} />
        </div>
      </header>

      <div className="s28-pick" role="group" aria-label="Pick any matchup">
        <label><span>Democrat</span><select value={pd} onChange={(e) => pick(e.target.value, every.rows[`${e.target.value}|${pr}`] ? pr : (every.R.find((r) => every.rows[`${e.target.value}|${r}`]) ?? pr))}>{every.D.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label><span>Republican</span><select value={pr} onChange={(e) => pick(pd, e.target.value)}>{every.R.filter((n) => every.rows[`${pd}|${n}`]).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <span>{Object.keys(every.rows).length.toLocaleString("en-US")} matchups the forecast ran in {data.name}</span>
      </div>
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
        <section ref={mapBox} className={`s28-map ${go ? "sk-map-go" : "sk-map-wait"}`} aria-label={`${data.name} by county`} onMouseLeave={() => setHov(null)}>
          <div className="h28-modes s">
            <div className="sk-seg" role="radiogroup" aria-label="Color the counties by">
              {([["m", "Margin"], ["s", "Change from 2024"]] as ["m" | "s", string][]).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
            </div>
            <span className="h28-closest">{data.counties.length} counties · hover any one for its vote</span>
          </div>
          <div className="s28-paper">
            <svg ref={ctySvg} viewBox={vb} role="img" aria-label={`${data.name} 2028 forecast by county`} className="sk-map-extrude" data-sk-nohatch="" data-sk-noring="">
              <InkDefs id="st28" scale={sc} />
              <g className="s28-cty sk-map-flip" key={`${mode}|${sel}`}>
                {data.counties.map((c) => <path key={c.f} d={c.d} fill={cFill(c.f)} style={{ "--d": cDel[c.f] } as CSSProperties} className={hov?.f === c.f || lit === c.f ? "hov" : lit ? "fade" : undefined} onMouseMove={(e) => setHov({ f: c.f, x: e.clientX, y: e.clientY })} />)}
              </g>
              <path className="s28-tex" d={data.outline} fill="url(#st28-pen)" aria-hidden="true" />
              <InkOutline id="st28" shapes={[["ol", data.outline]]} width={3.4} scale={sc} delays={{ ol: "0.15s" }} />
              <Lift id="st28" d={upC ? data.counties.find((c) => c.f === upC)?.d ?? null : null} fill={upC ? cFill(upC) : "none"} scale={sc} />
            </svg>
          </div>
          <Tip at={hov && hc && hn ? { x: hov.x, y: hov.y } : null}>
            {hc && hn ? <CountyTip name={hn.n} st={data.st} D={hc.D} R={hc.R} O={hn.o} d={p.d} r={p.r} m={hc.m} m24={hn.m24} /> : null}
          </Tip>
          {mode === "m" ? (
            <div className="s28-wash" aria-label="County margins">
              <span className="end">{last(p.d)}</span>
              {[4, 3, 2, 1, 0].map((i) => <span key={"d" + i} className="sw" style={{ background: WASH_D[i] }} title={`${last(p.d)} by ${WASH_CUTS[i]}${i < 4 ? ` to ${WASH_CUTS[i + 1]}` : " or more"}`}><b>{steps.d[i]}</b></span>)}
              <span className="sw" style={{ background: WASH_T }} title="Within a point"><b>{steps.t}</b></span>
              {[0, 1, 2, 3, 4].map((i) => <span key={"r" + i} className="sw" style={{ background: WASH_R[i] }} title={`${last(p.r)} by ${WASH_CUTS[i]}${i < 4 ? ` to ${WASH_CUTS[i + 1]}` : " or more"}`}><b>{steps.r[i]}</b></span>)}
              <span className="end">{last(p.r)}</span>
              <em>counties in each shade, pale for close and deep for safe</em>
            </div>
          ) : <div className="s28-key"><span>Bluer than 2024</span><i className="sh" /><span>Redder than 2024</span></div>}
          {data.dists.length ? (
            <div className="s28-dists">
              {data.dists.map((d) => { const v = distRes[p.id]?.[d.k]; if (!v) return null; const r = RATE[rateOf(v[0])]; return <div key={d.k}><b>{d.k}</b><span style={{ background: r.color, color: r.ink }}>{r.label}</span><em>{fmtMg(v[0])} · {d.ev} vote</em></div>; })}
            </div>
          ) : null}
        </section>

        <aside className="s28-side">
          <section className="s28-card" aria-labelledby="s28-sims">
            <h2 id="s28-sims">100 simulated elections</h2>
            <div key={p.id} className="s28-dots" role="img" aria-label={`${last(p.d)} wins ${nD} of 100, ${last(p.r)} wins ${100 - nD}`}>
              {Array.from({ length: 100 }, (_, i) => <i key={i} className={i < nD ? "d" : "r"} style={{ "--i": i } as CSSProperties} />)}
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
              {big.map((c) => { const r = res.cty.get(c.f)!; return <li key={c.f} onMouseEnter={() => setLit(c.f)} onMouseLeave={() => setLit(null)} className={lit === c.f ? "on" : undefined}><span className="n">{c.n}</span><span className="v">{fmtV(r.t)}</span><span className="m" style={{ background: washColor(r.m), color: washInk(r.m) }}>{fmtMg(r.m)}</span></li>; })}
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
