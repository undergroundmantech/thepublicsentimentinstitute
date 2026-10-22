"use client";
// One November 3 race: the forecast's expected result, civicAPI's returns, and the estimate of the final count built
// from the two, county by county where the forecast has counties, district by district for a legislative chamber.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FloatTip from "@/app/components/opp/FloatTip";
import { marginColor } from "@/app/lib/opp";
import { STN, KIND_LABEL, civicRace, expMargin, expSides, fmtGap, fmtK, fmtM, fmtN, forecastHref, isInd, legDistricts, project, sides, type CDetail, type CRace, type XRace } from "../live";
import { useIndex, useLive, useStateFile } from "../useLive";

type Paths = { counties: { id: string; d: string }[]; districts: { id: string; d: string }[] };
type View = "forecast" | "returns" | "versus";
const SET = (r: XRace) => (r.k === "leg" ? (["leg"] as const) : r.k === "measure" ? (["ballot"] as const) : r.k === "state" || r.k === "other" ? (["state"] as const) : (["fed"] as const));
const vsColor = (d: number) => { const a = Math.min(1, Math.abs(d) / 12); return d < 0 ? `rgba(61,123,255,${0.12 + a * 0.85})` : `rgba(255,59,92,${0.12 + a * 0.85})`; };
const yesColor = (m: number) => (m < 0 ? `rgba(47,191,155,${0.2 + Math.min(1, -m / 40) * 0.75})` : `rgba(231,121,74,${0.2 + Math.min(1, m / 40) * 0.75})`);
function bbox(paths: { d: string }[]) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of paths) { const re = /(-?\d+\.?\d*)[ ,](-?\d+\.?\d*)/g; let m; while ((m = re.exec(p.d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } } return [x0, y0, x1, y1]; }

export default function RaceLive({ id }: { id: string }) {
  const ix = useIndex();
  const r = useMemo(() => ix?.races.find((x) => x.id === id) ?? null, [ix, id]);
  const sub = useMemo(() => (ix && r ? { ...ix, races: [r] } : null), [ix, r]);
  const sets = useMemo(() => (r ? [...SET(r)] : []), [r]);
  const live = useLive(sub, sets);
  const sf = useStateFile(r?.st ?? null);
  const [paths, setPaths] = useState<Paths | null>(null);
  const [det, setDet] = useState<CDetail | null>(null);
  const [view, setView] = useState<View>("forecast");
  const [tip, setTip] = useState<{ x: number; y: number; f: string } | null>(null);
  const [sort, setSort] = useState<"exp" | "name" | "in" | "gap">("exp");
  useEffect(() => { if (!r) return; fetch(`/forecast/states/${r.st}.json`).then((x) => (x.ok ? x.json() : null)).then(setPaths).catch(() => {}); }, [r]);
  const c: CRace | undefined = r ? live.byId[r.id] : undefined;
  const reporting = !!c && (c.pr > 0 || c.c.some((x) => x[2] > 0));
  useEffect(() => {
    if (!c || !reporting) return; let dead = false;
    civicRace(c.id).then((d) => { if (!dead) setDet(d); }).catch(() => {});
    return () => { dead = true; };
  }, [c, reporting, live.at]);
  useEffect(() => { if (reporting) setView("returns"); }, [reporting]);

  if (!ix) return <div className="opp rl"><div className="rl-load sx-skel" aria-busy="true" /></div>;
  if (!r) return <div className="opp rl rl-empty"><h1>Race not found</h1><p>This race is not in the November 3 index. <Link href="/results/2026">See every race</Link>.</p></div>;

  const exp = sf?.counties[r.id] ?? null;
  const ind = isInd(r);
  const P = project(exp, det?.regions ?? null, r, c?.c ?? null, r.tot);
  const es = expSides(r);
  const A = r.k === "measure" ? "Yes" : ind ? (r.c?.[0]?.[0] ?? "Independent") : (r.c?.find((x) => x[1] === "D")?.[0] ?? "Democrat");
  const B = r.k === "measure" ? "No" : (r.c?.find((x) => x[1] === "R")?.[0] ?? "Republican");
  const last = (n: string) => n.split(" ").slice(-1)[0];
  const em = expMargin(r);
  const names = sf?.names ?? {};
  const cPaths = paths?.counties ?? [];
  const vb = cPaths.length ? (() => { const b = bbox(cPaths); const pad = Math.max(b[2] - b[0], b[3] - b[1]) * 0.03; return [b[0] - pad, b[1] - pad, b[2] - b[0] + 2 * pad, b[3] - b[1] + 2 * pad]; })() : null;
  const regM = (f: string) => { const g = det?.regions[f]; if (!g) return null; const s = sides(r, g.c); return s.t ? { m: (100 * (s.b - s.a)) / s.t, t: s.t, pr: g.pr } : null; };
  const expCM = (f: string) => { const e = exp?.[f]; return e && e[3] ? (100 * (e[1] - e[0])) / e[3] : null; };
  const fillOf = (f: string) => {
    const e = expCM(f), g = regM(f);
    const sh = (m: number) => (r.k === "measure" ? yesColor(m) : marginColor(m));
    if (view === "forecast") return e == null ? "rgba(255,255,255,.05)" : sh(e);
    if (view === "returns") return g ? sh(g.m) : "rgba(255,255,255,.05)";
    return g && e != null ? vsColor(g.m - e) : "rgba(255,255,255,.05)";
  };
  const rows = exp ? Object.entries(exp).map(([f, e]) => ({ f, n: names[f] ?? f, e, em: expCM(f), g: regM(f) })) : [];
  rows.sort((a, b) => sort === "name" ? a.n.localeCompare(b.n) : sort === "in" ? (b.g?.pr ?? -1) - (a.g?.pr ?? -1) : sort === "gap" ? Math.abs((b.g && b.em != null ? b.g.m - b.em : 0)) - Math.abs((a.g && a.em != null ? a.g.m - a.em : 0)) : b.e[3] - a.e[3]);
  const legD = r.k === "leg" ? sf?.leg[r.id] ?? [] : [];
  const legLive = r.k === "leg" ? legDistricts(r, live.raw) : {};
  const seatsLive = r.k === "leg" && c ? c.c.reduce((o, x) => { const p = x[1].toLowerCase(); if (p.startsWith("dem")) o.d += x[5] ?? 0; else if (p.startsWith("rep")) o.r += x[5] ?? 0; else o.o += x[5] ?? 0; return o; }, { d: 0, r: 0, o: 0 }) : null;
  const hd = r.k === "house" ? paths?.districts ?? [] : [];
  const hvb = hd.length ? (() => { const b = bbox(hd); const pad = Math.max(b[2] - b[0], b[3] - b[1]) * 0.03; return [b[0] - pad, b[1] - pad, b[2] - b[0] + 2 * pad, b[3] - b[1] + 2 * pad]; })() : null;

  return (
    <div className="opp rl">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/results">Results</Link><span className="sep">/</span><Link href="/results/2026">November 3</Link><span className="sep">/</span><Link href={`/results/2026?st=${r.st}`}>{STN[r.st]}</Link><span className="sep">/</span><span>{r.nm.replace(STN[r.st] + " ", "")}</span></nav>
      <header className="rl-head">
        <div>
          <div className="eye">{KIND_LABEL[r.k]} · {STN[r.st]} · November 3, 2026</div>
          <h1>{r.nm}</h1>
          {r.off && r.k === "measure" ? <p className="rl-sub">{r.off}</p> : null}
          <div className="rl-links"><Link href={forecastHref(r)} className="btn">The forecast</Link><Link href="/results/monitor" className="btn">Situation monitor</Link></div>
        </div>
        <div className={`rl-status${reporting ? " live" : ""}`}>
          <span className="k">{live.loading ? "Connecting" : !c ? "No civicAPI race found" : reporting ? "Returns coming in" : "Waiting for returns"}</span>
          <b>{reporting ? `${(c!.pr || P.pctIn).toFixed(0)}% in` : r.k === "leg" ? `${r.up ?? r.seats} seats up` : fmtM(em, r.k, ind)}</b>
          <small>{reporting ? `Last read ${live.at?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET` : c ? `civicAPI race ${c.id} linked` : live.error ?? "Matched by state, office and district"}</small>
        </div>
      </header>

      {r.k === "leg" ? (
        <section className="rl-cards">
          <div className="card rl-card"><div className="eye">Forecast seats</div><div className="rl-big"><span className="d">D {r.dS?.toFixed(1)}</span><span className="r">R {r.rS?.toFixed(1)}</span></div><p>{r.maj} for a majority of {r.seats}. Democrats control in {Math.round((r.pD ?? 0) * 100)}% of simulations, Republicans in {Math.round((r.pR ?? 0) * 100)}%.</p></div>
          <div className="card rl-card"><div className="eye">Seats won, civicAPI</div><div className="rl-big"><span className="d">D {seatsLive?.d ?? 0}</span><span className="r">R {seatsLive?.r ?? 0}</span></div><p>{seatsLive && seatsLive.d + seatsLive.r + seatsLive.o ? `${seatsLive.o} other.` : "No seats decided yet."}</p></div>
        </section>
      ) : (
        <section className="rl-cards">
          <div className="card rl-card">
            <div className="eye">The forecast</div>
            {(r.c ?? []).slice(0, 4).map(([n, p, v]) => <div className="rl-cand" key={n}><span className={`dot p-${p}`} /><b>{n}</b><span>{r.tot ? `${((100 * v) / r.tot).toFixed(1)}%` : ""}</span><em>{v ? fmtN(v) : ""}</em></div>)}
            <p>{r.k === "measure" ? `${r.yes?.toFixed(1)}% Yes expected; passes in ${Math.round((r.pPass ?? 0) * 100)}% of simulations.` : r.pR != null ? `${fmtM(em, r.k, ind)} expected; ${last(A)} wins ${Math.round((1 - r.pR) * 100)}% of simulations.` : "No vote forecast for this race."}{r.tot ? ` About ${fmtK(r.tot)} votes expected.` : ""}</p>
          </div>
          <div className="card rl-card">
            <div className="eye">Reported, civicAPI</div>
            {c ? c.c.slice().sort((x, y) => y[2] - x[2]).slice(0, 5).map(([n, p, v, pc, w]) => <div className="rl-cand" key={n}><span className={`dot p-${/^yes/i.test(n) ? "Y" : /^no$/i.test(n) ? "N" : p.toLowerCase().startsWith("dem") ? "D" : p.toLowerCase().startsWith("rep") ? "R" : p.toLowerCase().startsWith("ind") ? "I" : "O"}`} /><b>{n}{w ? <i className="won">Winner</i> : null}</b><span>{pc ? `${pc.toFixed(1)}%` : ""}</span><em>{fmtN(v)}</em></div>) : <p>{live.loading ? "Connecting to civicAPI." : "civicAPI does not list this race yet."}</p>}
            <p>{reporting ? `${fmtN(P.rep.t)} votes counted, ${fmtM(P.rep.t ? (100 * (P.rep.b - P.rep.a)) / P.rep.t : null, r.k, ind)}.` : "No votes counted yet."}</p>
          </div>
          <div className="card rl-card est">
            <div className="eye gold">Estimate of the final count</div>
            <div className="rl-big"><span className={P.m < 0 ? "d" : "r"}>{fmtM(P.m, r.k, ind)}</span></div>
            <p>{reporting ? `Give or take ${P.band.toFixed(1)} points. About ${fmtK(Math.max(0, P.fin.t - P.rep.t))} votes still to count${P.swing != null && Math.abs(P.swing) >= 0.1 ? `; counted counties are running ${Math.abs(P.swing).toFixed(1)} points ${P.swing < 0 ? (r.k === "measure" ? "more Yes" : ind ? "toward the independent" : "bluer") : (r.k === "measure" ? "more No" : "redder")} than expected` : ""}.` : `Before any votes are counted, this is the forecast: ${last(A)} ${fmtK(es.a)}, ${last(B)} ${fmtK(es.b)}.`}</p>
            <small>Reported votes plus each county&apos;s outstanding vote, split like its returns so far and leaning on the forecast while little is in. Not a race call.</small>
          </div>
        </section>
      )}

      {exp && vb ? (
        <section className="card rl-map">
          <div className="card-h"><h3>County by county</h3>
            <div className="rl-seg" role="group" aria-label="Map shows">{(["forecast", "returns", "versus"] as View[]).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v === "forecast" ? "Expected" : v === "returns" ? "Returns" : "Versus expected"}</button>)}</div>
          </div>
          <svg viewBox={vb.join(" ")} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${STN[r.st]} counties`} onMouseLeave={() => setTip(null)}>
            {cPaths.map((p) => <path key={p.id} d={p.d} style={{ fill: fillOf(p.id) }} className={tip?.f === p.id ? "on" : ""} onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, f: p.id })} />)}
          </svg>
          <div className="rl-legend">{view === "versus" ? <><span>Bluer than expected</span><i className="vs" /><span>Redder</span></> : r.k === "measure" ? <><span>Yes +40</span><i className="ms" /><span>No +40</span></> : <><span>D +40</span><i className="mg" /><span>R +40</span></>}<span className="hint">{rows.length} counties · hover for detail</span></div>
          {tip ? (() => { const e = exp[tip.f]; const g = regM(tip.f); const x = expCM(tip.f); return (
            <FloatTip x={tip.x} y={tip.y} className="tip" scope="opp"><b>{names[tip.f] ?? tip.f}</b>
              <div className="row"><span>Expected</span><span>{fmtM(x, r.k, ind)}</span></div>
              <div className="row"><span>Expected votes</span><span>{e ? fmtN(e[3]) : "n/a"}</span></div>
              <div className="row"><span>{last(A)}, {last(B)}</span><span>{e ? `${fmtK(e[0])}, ${fmtK(e[1])}` : ""}</span></div>
              <div className="row"><span>Returns</span><span>{g ? `${fmtM(g.m, r.k, ind)}, ${g.pr.toFixed(0)}% in` : "none yet"}</span></div>
              {g && x != null ? <div className="row"><span>Versus expected</span><span>{fmtGap(g.m - x, r.k, ind)}</span></div> : null}
            </FloatTip>); })() : null}
        </section>
      ) : null}

      {hvb ? (
        <section className="card rl-map">
          <div className="card-h"><h3>{STN[r.st]} House districts</h3><span className="eye">This district is outlined</span></div>
          <svg viewBox={hvb.join(" ")} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${STN[r.st]} House districts`}>
            {hd.map((p) => { const x = ix.races.find((q) => q.id === p.id); const m = x ? expMargin(x) : null; return <a key={p.id} href={`/results/2026/${p.id}`}><path d={p.d} style={{ fill: m == null ? "rgba(255,255,255,.05)" : marginColor(m), opacity: p.id === r.id ? 1 : 0.55 }} className={p.id === r.id ? "sel" : ""}><title>{p.id.replace("house-", "")}: {fmtM(m)}</title></path></a>; })}
          </svg>
        </section>
      ) : null}

      {rows.length ? (
        <section className="card rl-tbl">
          <div className="card-h"><h3>Every county</h3>
            <div className="rl-seg" role="group" aria-label="Sort">{([["exp", "Most votes"], ["in", "Most in"], ["gap", "Biggest gap"], ["name", "A to Z"]] as const).map(([k, l]) => <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}</div>
          </div>
          <div className="rl-tw"><table>
            <thead><tr><th>County</th><th>Expected votes</th><th>{last(A)}</th><th>{last(B)}</th><th>Expected</th><th>Counted</th><th>In</th><th>Returns</th><th>Versus expected</th></tr></thead>
            <tbody>{rows.map((x) => (
              <tr key={x.f}><td>{x.n}</td><td>{fmtN(x.e[3])}</td><td>{fmtN(x.e[0])}</td><td>{fmtN(x.e[1])}</td>
                <td className={x.em == null ? "" : x.em < 0 ? "d" : "r"}>{fmtM(x.em, r.k, ind)}</td>
                <td>{x.g ? fmtN(x.g.t) : ""}</td><td>{x.g ? `${x.g.pr.toFixed(0)}%` : ""}</td>
                <td className={!x.g ? "" : x.g.m < 0 ? "d" : "r"}>{x.g ? fmtM(x.g.m, r.k, ind) : ""}</td>
                <td className={!x.g || x.em == null ? "" : x.g.m - x.em < 0 ? "d" : "r"}>{x.g && x.em != null ? fmtGap(x.g.m - x.em, r.k, ind) : ""}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      ) : null}

      {legD.length ? (
        <section className="card rl-tbl">
          <div className="card-h"><h3>Every district</h3><span className="eye">{legD.length} districts</span></div>
          <div className="rl-tw"><table>
            <thead><tr><th>District</th><th>Democrat</th><th>Republican</th><th>Expected votes</th><th>Expected</th><th>D chance</th><th>In</th><th>Returns</th></tr></thead>
            <tbody>{legD.map((d) => { const lc = legLive[d.d.toUpperCase()]; const s = lc ? sides({ ...r, k: "sen", c: [[d.D ?? "", "D", 0], [d.R ?? "", "R", 0]] }, lc.c) : null; const m = s && s.t ? (100 * (s.b - s.a)) / s.t : null; return (
              <tr key={d.d}><td>{d.d}</td><td>{d.D ?? (d.I ? `${d.I}, ind.` : "None")}</td><td>{d.R ?? "None"}</td><td>{d.v[3] ? fmtN(d.v[3]) : ""}</td>
                <td className={d.m == null ? "" : d.m < 0 ? "d" : "r"}>{fmtM(d.m)}</td><td>{d.pD != null ? `${Math.round(d.pD * 100)}%` : ""}</td>
                <td>{lc ? `${lc.pr.toFixed(0)}%` : ""}</td><td className={m == null ? "" : m < 0 ? "d" : "r"}>{m != null ? fmtM(m) : ""}</td></tr>); })}</tbody>
          </table></div>
        </section>
      ) : null}

      <p className="rl-src">Expected votes are the On Point Politics forecast of October 22 for every county or district. Returns come from civicAPI through a 30 second cache. The estimate of the final count adds each county&apos;s outstanding vote to what is counted; it is arithmetic, not a call, and civicAPI&apos;s winner flags are shown as civicAPI reports them.</p>
    </div>
  );
}
