"use client";
// A 2027 governor race in the same format as a 2028 state page: the state as a 3D paper slab beside its name and
// rating, the matchup chips, a duel bar between the two nominees, the counties drawn in under a pencil outline with
// the hovered county lifting off the page, 100 simulated elections, the margin's range, the biggest counties and the
// primaries. The geometry is the 2028 forecast's own; every county carries the 2027 model's margin for each matchup.
import { useMemo, useRef, useState, type CSSProperties } from "react";
import Pointy from "@/onpoint-sketchbook/react/Pointy";
import { InkDefs, InkOutline, Lift, Slab3D, WASH_CUTS, WASH_D, WASH_R, WASH_T, sweepDelays, useBoil, useInView, usePxScale, washColor, washInk, washStep } from "@/onpoint-sketchbook/react/SketchMap";
import Link from "@/app/components/Link";
import Toon from "@/app/majority-tracker/Toon";
import { fmtMg, fmtPct, last, shiftColor } from "@/app/2028/lib";
import { CountyTip, Tip } from "@/app/2028/Tips28";
import { RATE, rateOf } from "@/app/2028/rate28";

export type C27 = { f: string; n: string; d: string; votes: number; m24: number | null; m: Record<string, number> };
export type P27 = { id: string; r: string; d: string; p: number; pR: number; margin: number };
type Top = { name: string; win: number; party: "R" | "D" | "I" };
const fmtV = (n: number) => Math.round(n).toLocaleString("en-US");

export default function State27({ name, code, general, incumbent, outline, box, counties, pairs, spread, prim, unit }:
  { name: string; code: string; general: string; incumbent: string; outline: string; box: [number, number, number, number]; counties: C27[]; pairs: P27[]; spread: number; prim: { R: Top[]; D: Top[] }; unit: string }) {
  const [sel, setSel] = useState(pairs[0].id);
  const [hov, setHov] = useState<{ f: string; x: number; y: number } | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const [mode, setMode] = useState<"m" | "s">("m");
  const p = pairs.find((x) => x.id === sel) ?? pairs[0];
  const rt = RATE[rateOf(p.margin)];

  const res = useMemo(() => {
    let D = 0, R = 0; const cty = new Map<string, { D: number; R: number; m: number; t: number }>();
    for (const c of counties) { const m = c.m[p.id] ?? 0; const d = (c.votes * (1 - m / 100)) / 2, r = c.votes - d; D += d; R += r; cty.set(c.f, { D: d, R: r, m, t: c.votes }); }
    return { D, R, T: D + R, cty };
  }, [counties, p.id]);
  const big = useMemo(() => [...counties].sort((a, b) => b.votes - a.votes).slice(0, 8), [counties]);
  const mapBox = useRef<HTMLElement>(null);
  const go = useInView(mapBox); useBoil(mapBox);
  const cShapes = useMemo(() => counties.map((c) => [c.f, c.d] as [string, string]), [counties]);
  const cDel = useMemo(() => sweepDelays(cShapes, 1.1), [cShapes]);

  const [x, y, w, h] = box; const pad = Math.max(w, h) * 0.06;
  const vb = `${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const rWin = p.pR >= 0.5, pW = rWin ? p.pR : 1 - p.pR;
  const W = rWin ? last(p.r) : last(p.d), L = rWin ? last(p.d) : last(p.r);
  const lo = p.margin - spread, hi = p.margin + spread;
  const dSh = res.D / res.T, rSh = res.R / res.T;
  const nD = Math.round((1 - p.pR) * 100);
  const hc = hov ? res.cty.get(hov.f) : null, hn = hov ? counties.find((c) => c.f === hov.f) : null;
  const S = 25, pos = (m: number) => Math.max(0, Math.min(100, ((m + S) / (2 * S)) * 100));
  const ctySvg = useRef<SVGSVGElement>(null);
  const sc = usePxScale(ctySvg, vb);
  const cFill = (f: string) => { const c = counties.find((q) => q.f === f); const r = res.cty.get(f); if (!c || !r) return "none"; return mode === "s" ? (c.m24 != null ? shiftColor(r.m - c.m24, 16) : "#d8d3c8") : washColor(r.m); };
  const steps = useMemo(() => { const n = { d: [0, 0, 0, 0, 0], r: [0, 0, 0, 0, 0], t: 0 }; for (const c of counties) { const m = res.cty.get(c.f)?.m ?? 0; const k = washStep(m); if (k === 0) n.t++; else (m < 0 ? n.d : n.r)[k - 1]++; } return n; }, [counties, res]);
  const upC = hov?.f ?? lit;
  const plural = unit === "Parish" ? "parishes" : "counties";

  return (
    <div className="s28">
      <header className="s28-hero">
        <div className="s28-hero-t">
          <p className="s28-eye"><Link href="/2027">The 2027 governors</Link> · {general}</p>
          <h1>{name}</h1>
          <div className="s28-rate"><span key={p.id} className="s28-stamp" style={{ color: rt.text ?? rt.color }}>{rt.label}</span><b key={p.id + "m"} className="h28-slam">{fmtMg(p.margin)}</b><em>{W} wins in {fmtPct(pW)} of runs · {incumbent}</em></div>
        </div>
        <div className="s28-slab-wrap">
          <Slab3D d={outline} viewBox={vb} fill={rt.color} />
          <Pointy pose="point-pointer" size={128} className="s28-pointy" />
        </div>
      </header>

      <div className="s28-mu" role="group" aria-label="Matchup">
        {pairs.map((q) => <button key={q.id} type="button" aria-pressed={q.id === sel} className={q.id === sel ? "on" : ""} onClick={() => setSel(q.id)}>{last(q.d)} v {last(q.r)}<em>{fmtPct(q.p)}</em></button>)}
      </div>

      <section className="s28-duel" aria-label="Projected vote">
        <div className={`s28-who d${!rWin ? " won" : ""}`}>
          <Toon name={p.d} side="D" size={96} className="s28-face" uid="g" />
          <div><b>{p.d}</b><span>Democrat · {fmtV(res.D)} votes</span>{!rWin ? <em>Favored</em> : null}</div>
        </div>
        <div className="s28-bar" role="img" aria-label={`${last(p.d)} ${(dSh * 100).toFixed(1)}%, ${last(p.r)} ${(rSh * 100).toFixed(1)}%`}>
          <i className="d" style={{ flexGrow: dSh }}><b>{(dSh * 100).toFixed(1)}%</b></i>
          <i className="r" style={{ flexGrow: rSh }}><b>{(rSh * 100).toFixed(1)}%</b></i>
          <span className="half" />
        </div>
        <div className={`s28-who r${rWin ? " won" : ""}`}>
          <div><b>{p.r}</b><span>Republican · {fmtV(res.R)} votes</span>{rWin ? <em>Favored</em> : null}</div>
          <Toon name={p.r} side="R" size={96} className="s28-face" uid="g" />
        </div>
        <p className="s28-oth">{fmtPct(p.p)} chance this is the November matchup · {fmtV(res.T)} votes expected</p>
      </section>

      <div className="s28-grid">
        <section ref={mapBox} className={`s28-map ${go ? "sk-map-go" : "sk-map-wait"}`} aria-label={`${name} by ${unit.toLowerCase()}`} onMouseLeave={() => setHov(null)}>
          <div className="h28-modes s">
            <div className="sk-seg" role="radiogroup" aria-label={`Color the ${plural} by`}>
              {([["m", "Margin"], ["s", "Change from 2024"]] as ["m" | "s", string][]).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
            </div>
            <span className="h28-closest">{counties.length} {plural} · hover any one for its vote</span>
          </div>
          <div className="s28-paper">
            <span className="sk-tape tl" aria-hidden="true" /><span className="sk-tape br" aria-hidden="true" />
            <svg ref={ctySvg} viewBox={vb} role="img" aria-label={`${name} 2027 governor forecast by ${unit.toLowerCase()}`} className="sk-map-extrude" data-sk-nohatch="" data-sk-noring="">
              <InkDefs id={`g27${code}`} scale={sc} />
              <g className="s28-cty sk-map-flip" key={`${mode}|${sel}`}>
                {counties.map((c) => <path key={c.f} d={c.d} fill={cFill(c.f)} style={{ "--d": cDel[c.f] } as CSSProperties} className={hov?.f === c.f || lit === c.f ? "hov" : lit ? "fade" : undefined} onMouseMove={(e) => setHov({ f: c.f, x: e.clientX, y: e.clientY })} />)}
              </g>
              <path className="s28-tex" d={outline} fill={`url(#g27${code}-pen)`} aria-hidden="true" />
              <InkOutline id={`g27${code}`} shapes={[["ol", outline]]} width={3.4} scale={sc} delays={{ ol: "0.15s" }} />
              <Lift id={`g27${code}`} d={upC ? counties.find((c) => c.f === upC)?.d ?? null : null} fill={upC ? cFill(upC) : "none"} scale={sc} />
            </svg>
          </div>
          <Tip at={hov && hc && hn ? { x: hov.x, y: hov.y } : null}>
            {hc && hn ? <CountyTip name={hn.n} st={code} D={hc.D} R={hc.R} O={0} d={p.d} r={p.r} m={hc.m} m24={hn.m24} /> : null}
          </Tip>
          {mode === "m" ? (
            <div className="s28-wash" aria-label={`${unit} margins`}>
              <span className="end">{last(p.d)}</span>
              {[4, 3, 2, 1, 0].map((i) => <span key={"d" + i} className="sw" style={{ background: WASH_D[i] }} title={`${last(p.d)} by ${WASH_CUTS[i]}${i < 4 ? ` to ${WASH_CUTS[i + 1]}` : " or more"}`}><b>{steps.d[i]}</b></span>)}
              <span className="sw" style={{ background: WASH_T }} title="Within a point"><b>{steps.t}</b></span>
              {[0, 1, 2, 3, 4].map((i) => <span key={"r" + i} className="sw" style={{ background: WASH_R[i] }} title={`${last(p.r)} by ${WASH_CUTS[i]}${i < 4 ? ` to ${WASH_CUTS[i + 1]}` : " or more"}`}><b>{steps.r[i]}</b></span>)}
              <span className="end">{last(p.r)}</span>
              <em>{plural} in each shade, pale for close and deep for safe</em>
            </div>
          ) : <div className="s28-key"><span>Bluer than 2024</span><i className="sh" /><span>Redder than 2024</span></div>}
        </section>

        <aside className="s28-side">
          <section className="s28-card" aria-labelledby="g27-sims">
            <h2 id="g27-sims">100 simulated elections</h2>
            <div key={p.id} className="s28-dots" role="img" aria-label={`${last(p.d)} wins ${nD} of 100, ${last(p.r)} wins ${100 - nD}`}>
              {Array.from({ length: 100 }, (_, i) => <i key={i} className={i < nD ? "d" : "r"} style={{ "--i": i } as CSSProperties} />)}
            </div>
            <p className="s28-dl"><b className="d">{last(p.d)} {nD}</b><b className="r">{100 - nD} {last(p.r)}</b></p>
            <p className="s28-say">{pW >= 0.95 ? `${W} wins almost every time.` : pW >= 0.8 ? `${W} wins most of the time, but ${L} takes it in about ${Math.round((1 - pW) * 100)} of 100.` : pW >= 0.6 ? `${W} is ahead, and ${L} wins about ${Math.round((1 - pW) * 100)} of 100.` : "Close to a coin flip."}</p>
          </section>
          <section className="s28-card" aria-labelledby="g27-rng">
            <h2 id="g27-rng">Where the margin could land</h2>
            <div className="s28-strip" aria-hidden="true">
              <span className="z" style={{ left: "50%" }} />
              <span className="band" style={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%` }} />
              <span className="pt" style={{ left: `${pos(p.margin)}%`, background: rt.color }} />
            </div>
            <p className="s28-ends"><span>D +{S}</span><span>Even</span><span>R +{S}</span></p>
            <p className="s28-say">8 in 10 runs land between <b>{fmtMg(lo)}</b> and <b>{fmtMg(hi)}</b>.</p>
          </section>
          <section className="s28-card" aria-labelledby="g27-big">
            <h2 id="g27-big">The biggest {plural}</h2>
            <ul className="s28-big">
              {big.map((c) => { const r = res.cty.get(c.f)!; return <li key={c.f} onMouseEnter={() => setLit(c.f)} onMouseLeave={() => setLit(null)} className={lit === c.f ? "on" : undefined}><span className="n">{c.n.replace(/ Parish$/, "")}</span><span className="v">{fmtV(r.t)}</span><span className="m" style={{ background: washColor(r.m), color: washInk(r.m) }}>{fmtMg(r.m)}</span></li>; })}
            </ul>
          </section>
          <section className="s28-card" aria-labelledby="g27-prim">
            <h2 id="g27-prim">{name}&apos;s {code === "LA" ? "open primary" : "primaries"}</h2>
            {(["D", "R"] as const).map((k) => { const s = prim[k]; return s.length ? (
              <div key={k} className="s28-pm">
                <span className="h">{code === "LA" ? (k === "D" ? "Democrats" : "Republicans") : k === "D" ? "Democratic" : "Republican"}</span>
                {s.slice(0, 4).map((c) => <div key={c.name} className="row"><Toon name={c.name} side={k} size={28} uid="q" /><span className="n">{c.name}</span><span className="bar"><i style={{ width: `${c.win * 100}%`, background: k === "D" ? "#1f3fd1" : "#d42a2a" }} /></span><b>{fmtPct(c.win)}</b></div>)}
              </div>
            ) : null; })}
          </section>
        </aside>
      </div>
    </div>
  );
}
