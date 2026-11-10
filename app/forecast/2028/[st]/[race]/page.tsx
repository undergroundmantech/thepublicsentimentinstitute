import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import Link from "@/app/components/Link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import GeoMap, { type GeoTip } from "@/app/components/opp/GeoMap";
import type { CountyPath } from "@/app/components/home/countyGeo";
import { STATE_NAME, marginColor } from "@/app/lib/opp";
import Tabs28 from "../../Tabs28";
import { RACES, RACE_LABEL, fmtMg, fmtN, fmtPct, fmtShift, getHub, getState, href28, shiftFor, stateCodes, type PrimState, type Race28, type StateFile, type StateRow } from "../../lib28";
import "../../p28.css";

export const dynamicParams = false;
export function generateStaticParams() {
  return stateCodes().flatMap((s) => RACES.map((race) => ({ st: s.toLowerCase(), race })));
}
export async function generateMetadata({ params }: { params: Promise<{ st: string; race: string }> }): Promise<Metadata> {
  const { st, race } = await params;
  const S = st.toUpperCase(), name = STATE_NAME[S] ?? S, label = RACE_LABEL[race as Race28] ?? "";
  return { title: `${name} 2028 ${label} Forecast | On Point Politics`, description: `County by county 2028 ${label.toLowerCase()} forecast for ${name}: projected votes, win odds and every county.`,
    alternates: { canonical: href28(S, race as Race28) } };
}
function geoFor(st: string): CountyPath[] {
  try { return (JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "states", `${st}.json`), "utf8")) as { counties: CountyPath[] }).counties; } catch { return []; }
}
const cname = (n: string, st: string) => (/\b(county|parish|borough|city|census area|municipality|planning region)\b/i.test(n) ? n : `${n} ${st === "LA" ? "Parish" : "County"}`);

function Hist({ h, lo = -40, w = 2 }: { h: number[]; lo?: number; w?: number }) {
  const W = 560, H = 150, mx = Math.max(1, ...h), bw = W / h.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="p28-hist" role="img" aria-label="Simulated margins">
      {h.map((c, i) => { const x = lo + i * w + w / 2; return <rect key={i} x={i * bw + 1} y={H - (c / mx) * H} width={bw - 2} height={(c / mx) * H} fill={x < 0 ? "var(--dem2)" : "var(--gop2)"} opacity={0.85} />; })}
      <line x1={W / 2} x2={W / 2} y1={0} y2={H} className="mid" />
      {[-40, -20, 0, 20, 40].map((v) => <text key={v} x={((v - lo) / (h.length * w)) * W} y={H + 16} textAnchor={v === -40 ? "start" : v === 40 ? "end" : "middle"}>{v === 0 ? "Even" : `${v < 0 ? "D" : "R"} ${Math.abs(v)}`}</text>)}
    </svg>
  );
}

// presidential margins since 2000 and the 2028 forecast, R minus D, with the long run trend against the nation
function PresHistory({ ph, m, p10, p90, lr, rt, name }: { ph: Record<string, number>; m: number; p10: number; p90: number; lr: number | null | undefined; rt: number | null | undefined; name: string }) {
  const pts = Object.entries(ph).map(([y, v]) => [Number(y), v] as const).sort((a, b) => a[0] - b[0]);
  const all = [...pts.map((x) => x[1]), m, p10, p90]; const lo = Math.min(-10, ...all) - 3, hi = Math.max(10, ...all) + 3;
  const W = 960, H = 250, L = 52, R = 20, T = 14, B = 28;
  const x = (y: number) => L + ((y - 2000) / 28) * (W - L - R); const yv = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const ticks = [-40, -30, -20, -10, 0, 10, 20, 30, 40].filter((t) => t > lo && t < hi);
  const line = pts.map(([y, v]) => `${x(y)},${yv(v)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <section className="card p28-sec"><div className="card-h"><h3>{name} for president since 2000</h3><span className="eye">margin, R minus D</span></div><div className="card-b">
      <svg viewBox={`0 0 ${W} ${H}`} className="p28-curve" role="img" aria-label={`${name} presidential margin by year, 2000 to 2024, and the 2028 forecast`}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={yv(t)} y2={yv(t)} className={t === 0 ? "zero" : "grid"} /><text x={L - 6} y={yv(t) + 4} textAnchor="end">{t === 0 ? "Even" : `${t < 0 ? "D" : "R"} ${Math.abs(t)}`}</text></g>)}
        {[2000, 2004, 2008, 2012, 2016, 2020, 2024, 2028].map((y) => <text key={y} x={x(y)} y={H - 8} textAnchor="middle">{y}</text>)}
        <polyline points={line} className="hist" />
        {last ? <line x1={x(last[0])} y1={yv(last[1])} x2={x(2028)} y2={yv(m)} className="fc" /> : null}
        <line x1={x(2028)} x2={x(2028)} y1={yv(p10)} y2={yv(p90)} className="rng" />
        {pts.map(([y, v]) => <circle key={y} cx={x(y)} cy={yv(v)} r={4} className={v < 0 ? "pd" : "pr"}><title>{`${y}: ${fmtMg(v)}`}</title></circle>)}
        <circle cx={x(2028)} cy={yv(m)} r={6} className={m < 0 ? "pd" : "pr"}><title>{`2028 forecast: ${fmtMg(m)}`}</title></circle>
      </svg>
      <p className="note">Certified two party results{pts.length < 7 ? `, ${pts.map((p) => p[0]).join(", ")} on file` : ""}. The dot at 2028 is the forecast with its 80% range.{lr != null ? ` Against the nation, ${name} has moved about ${Math.abs(lr).toFixed(1)} points per election toward ${lr < 0 ? "Democrats" : "Republicans"} since ${pts[0]?.[0] ?? 2000}` : ""}{rt != null ? `${lr != null ? " and" : " Against the nation it has moved"} ${Math.abs(rt).toFixed(1)} points per election toward ${rt < 0 ? "Democrats" : "Republicans"} over the last three elections. The forecast carries a blend of both.` : lr != null ? "." : ""}</p>
    </div></section>
  );
}
const EL_SETS: [string, string[]][] = [
  ["Age", ["age 18-29", "age 30-44", "age 45-64", "age 65+"]],
  ["Race", ["White", "Black", "Hispanic", "Asian/Other"]],
  ["Education", ["white no college", "white college", "no college", "college"]],
  ["Party", ["Democrats", "Republicans", "independents"]],
  ["Vote history", ["voted in 2024", "did not vote in 2024"]],
];
const EL_LABEL: Record<string, string> = { "age 18-29": "18 to 29", "age 30-44": "30 to 44", "age 45-64": "45 to 64", "age 65+": "65 and up", "Asian/Other": "Asian and other",
  "white no college": "White, no degree", "white college": "White, degree", "no college": "No degree, all", college: "Degree, all", "voted in 2024": "Voted in 2024", "did not vote in 2024": "Did not vote in 2024" };
function Electorate({ rows, name }: { rows: [string, number, number][]; name: string }) {
  const by = Object.fromEntries(rows.map((r) => [r[0], r]));
  return (
    <section className="card p28-sec"><div className="card-h"><h3>Who votes in November</h3><span className="eye">simulated 2028 electorate, {name}</span></div><div className="card-b p28-tbl">
      <p className="note">Every county&apos;s eligible citizens in 192 voter groups by age, race, college, party and 2024 vote, from our national dataset; every voter is drawn in each simulation. Share of the electorate and the generic Democrat&apos;s two party share against Vance.</p>
      <table><thead><tr><th>Group</th><th className="n">Share of voters</th><th className="n">Democratic two party</th></tr></thead><tbody>
        {EL_SETS.map(([h, ks]) => [<tr key={h} className="grp"><td colSpan={3}>{h}</td></tr>, ...ks.filter((k) => by[k]).map((k) => (
          <tr key={k}><td>{EL_LABEL[k] ?? k}</td><td className="n">{by[k][1].toFixed(1)}%</td><td className={`n ${by[k][2] >= 50 ? "d" : "r"}`}>{by[k][2].toFixed(1)}%</td></tr>))])}
      </tbody></table>
    </div></section>
  );
}
function President({ S, sf }: { S: string; sf: StateFile }) {
  const hub = getHub(); const g = sf.general as StateRow; const name = STATE_NAME[S] ?? S;
  const m = g.m, dWin = g.pD, lead = m < 0 ? "Democrat" : "Republican";
  const paths = geoFor(S); const fills: Record<string, string> = {}, tips: Record<string, GeoTip> = {};
  for (const c of sf.counties) {
    fills[c.id] = marginColor(c.m);
    tips[c.id] = { title: cname(c.n, S), rows: [["2028 model", fmtMg(c.m), c.m < 0 ? "var(--dem2)" : "var(--gop2)"], ["80% range", `${fmtMg(c.p10)} to ${fmtMg(c.p90)}`], ["2024 actual", fmtMg(c.m24)],
      ["Democratic votes", fmtN(c.D), "var(--dem2)"], ["Republican votes", fmtN(c.R), "var(--gop2)"], ["Generations", fmtMg(c.gen, 2)], ["Migration", fmtMg(c.mig, 2)]] };
  }
  const tot = g.D + g.R + g.O; const p = sf.path;
  const dmatch = Object.keys(hub.dcand).map((d) => { const mm = m + shiftFor(hub.dcand, hub.rcand, d, "Vance", S, hub.coal); return [d, mm] as const; }).sort((a, b) => a[1] - b[1]);
  const rmatch = Object.keys(hub.rcand).map((r) => { const mm = m + shiftFor(hub.dcand, hub.rcand, "Generic Democrat", r, S, hub.coal); return [r, mm] as const; }).sort((a, b) => a[1] - b[1]);
  const sd = Math.max(2, (g.p90 - g.p10) / 2.563);
  const pd = (mm: number) => { const z = -mm / sd; const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const q = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - q : q; };
  const counties = [...sf.counties].sort((a, b) => b.D + b.R - (a.D + a.R));
  return (<>
    <header className="p28-hero">
      <p className="eye g">2028 forecast · {name} · President{g.ev ? ` · ${g.ev} electoral votes` : ""}</p>
      <h1>The <span className={m < 0 ? "d" : "r"}>{lead}</span> {Math.abs(m) < 2 ? "and the other side are in a toss up" : `is ${Math.max(dWin, 1 - dWin) > 0.9 ? "very likely" : Math.max(dWin, 1 - dWin) > 0.7 ? "likely" : "slightly favored"} to carry`} {name}.</h1>
      <p className="lede">A generic Democrat against JD Vance: {fmtMg(m)} in the average of {fmtN(hub.general.N)} county simulations, with 80% of runs between {fmtMg(g.p10)} and {fmtMg(g.p90)}. Projected votes: {fmtN(g.D)} Democratic, {fmtN(g.R)} Republican, {fmtN(g.O)} other, {fmtN(tot)} in all.</p>
      <div className="p28-kpis wide">
        <div><span className="v d">{fmtPct(dWin)}</span><span className="l">Democratic win chance</span></div>
        <div><span className={`v ${m < 0 ? "d" : "r"}`}>{fmtMg(m)}</span><span className="l">2028 margin</span></div>
        <div><span className={`v ${g.a24 != null && g.a24 < 0 ? "d" : "r"}`}>{g.a24 == null ? "n/a" : fmtMg(g.a24)}</span><span className="l">2024 actual</span></div>
        <div><span className="v">{fmtPct(g.tip)}</span><span className="l">Chance it is the tipping point</span></div>
      </div>
    </header>
    {g.ph ? <PresHistory ph={g.ph} m={m} p10={g.p10} p90={g.p90} lr={g.lr} rt={g.rt} name={name} /> : null}
    <div className="p28-two">
      <section className="card"><div className="card-h"><h3>Every county</h3><span className="eye">simulated margin</span></div><div className="card-b">
        {paths.length && sf.counties.length ? <GeoMap paths={paths.filter((x) => fills[x.id])} fills={fills} tips={tips} label={`${name} counties, 2028 forecast`} /> : <p className="note">{name} is modeled at the state level here, from its certified 2024 vote moved by the national swing.</p>}
        <div className="p28-legend"><span>D +40</span><i className="ramp" style={{ background: "linear-gradient(90deg,#10288c,#3d7bff,#d6e2ff,#ffdce4,#ff3b5c,#8c0a28)" }} /><span>R +40</span></div>
      </div></section>
      <section className="card"><div className="card-h"><h3>{fmtN(hub.general.N)} simulated elections</h3><span className="eye">margin, R minus D</span></div><div className="card-b">
        <Hist h={g.hist} />
        {p ? (<>
          <h4 className="p28-h4">From 2024 to 2028</h4>
          <table className="p28-steps"><tbody>
            <tr><td>2024 result</td><td className={p.a24 < 0 ? "d" : "r"}>{fmtMg(p.a24)}</td><td>Certified county votes.</td></tr>
            <tr><td>National environment</td><td className={p.base < 0 ? "d" : "r"}>{fmtMg(p.base)}</td><td>The party ID move by county elasticity, plus each county&apos;s and the state&apos;s recent trend, 2020 to 2024 counting most and 2016 to 2024 next.</td></tr>
            <tr><td>Deaths and aging</td><td>{fmtShift(p.deaths)}</td><td>Older cohorts leave, every cohort ages four years.</td></tr>
            <tr><td>New 18 to 21 voters</td><td>{fmtShift(p.newv)}</td><td>{p.newShare.toFixed(1)}% of the 2028 electorate here.</td></tr>
            <tr><td>Life cycle drift</td><td>{fmtShift(p.drift)}</td><td>Voters under 44 drifting a little right as they age.</td></tr>
            <tr><td>Migration</td><td>{fmtShift(p.mig)}</td><td>Movers in and out since 2020, carried to 2028.</td></tr>
            <tr className="tot"><td>2028 model</td><td className={p.final < 0 ? "d" : "r"}>{fmtMg(p.final)}</td><td>Includes Vance&apos;s own home and polling effects and the simulation&apos;s vote weighting. Votes: {fmtN(p.tot24)} in 2024, {fmtN(p.tot28)} projected.</td></tr>
          </tbody></table></>) : null}
      </div></section>
    </div>
    {sf.elect28 && sf.elect28.length ? <Electorate rows={sf.elect28} name={name} /> : null}
    {sf.cds && sf.cds.length ? (
      <section className="card p28-sec"><div className="card-h"><h3>Every congressional district</h3><span className="eye">2026 lines, generic Democrat against Vance</span></div><div className="card-b p28-tbl"><table><thead><tr><th>District</th><th className="n">2024</th><th className="n">2028</th><th className="n">80% range</th><th className="n">D win</th><th>2026 House</th></tr></thead><tbody>
        {sf.cds.map(([k, m, pD, p10, p90, m24, hp, hw]) => <tr key={k}><td>{k}</td><td className={`n ${m24 < 0 ? "d" : "r"}`}>{fmtMg(m24)}</td><td className={`n ${m < 0 ? "d" : "r"}`}>{fmtMg(m)}</td><td className="n">{fmtMg(p10)} to {fmtMg(p90)}</td><td className="n">{fmtPct(pD)}</td><td className={hp === "D" ? "d" : hp === "R" ? "r" : ""}>{hw || "no result"}</td></tr>)}
      </tbody></table><p className="note">Each district starts from its own 2024 presidential result and moves with the counties it covers.</p></div></section>
    ) : null}
    {Object.keys(sf.districts).length ? (
      <section className="card p28-sec"><div className="card-h"><h3>Congressional district electoral votes</h3><span className="eye">built from counties</span></div><div className="card-b p28-tbl"><table><thead><tr><th>District</th><th className="n">Margin</th><th className="n">D win</th><th className="n">D votes</th><th className="n">R votes</th></tr></thead><tbody>
        {Object.entries(sf.districts).map(([k, d]) => <tr key={k}><td>{k}</td><td className={`n ${d.m < 0 ? "d" : "r"}`}>{fmtMg(d.m)}</td><td className="n">{fmtPct(d.pD)}</td><td className="n">{fmtN(d.D)}</td><td className="n">{fmtN(d.R)}</td></tr>)}
      </tbody></table><p className="note">{S === "NE" ? "Nebraska 2 is Douglas County and the western part of Sarpy County. Nebraska 1 and 3 are not shown; both lean Republican." : "Maine 1 is the southern coast and Kennebec County; Maine 2 is the rest of the state."}</p></div></section>) : null}
    <div className="p28-two p28-sec">
      <section className="card"><div className="card-h"><h3>Democrats against Vance</h3><span className="eye">{name}</span></div><div className="card-b p28-tbl"><table><thead><tr><th>Democrat</th><th className="n">Margin</th><th className="n">D win</th></tr></thead><tbody>
        {dmatch.map(([d, mm]) => <tr key={d}><td>{d}{hub.dcand[d]?.[2] ? <i className="hyp">HYP</i> : null}</td><td className={`n ${mm < 0 ? "d" : "r"}`}>{fmtMg(mm)}</td><td className="n">{fmtPct(pd(mm))}</td></tr>)}
      </tbody></table></div></section>
      <section className="card"><div className="card-h"><h3>Republicans against a generic Democrat</h3><span className="eye">{name}</span></div><div className="card-b p28-tbl"><table><thead><tr><th>Republican</th><th className="n">Margin</th><th className="n">D win</th></tr></thead><tbody>
        {rmatch.map(([r, mm]) => <tr key={r}><td>{r}{hub.rcand[r]?.[2] ? <i className="hyp">HYP</i> : null}</td><td className={`n ${mm < 0 ? "d" : "r"}`}>{fmtMg(mm)}</td><td className="n">{fmtPct(pd(mm))}</td></tr>)}
      </tbody></table><p className="note">HYP marks a candidate with no head to head polling: home state and 2026 midterm effects only.</p></div></section>
    </div>
    {counties.length ? (
      <section className="card p28-sec"><div className="card-h"><h3>Projected vote in every county</h3><span className="eye">{counties.length} counties, largest first</span></div><div className="card-b p28-tbl tall"><table><thead><tr><th>County</th><th className="n">2024</th><th className="n">2028</th><th className="n">80% range</th><th className="n">D votes</th><th className="n">R votes</th><th className="n">Total</th><th className="n">Generations</th><th className="n">Migration</th></tr></thead><tbody>
        {counties.map((c) => <tr key={c.id}><td>{cname(c.n, S)}</td><td className={`n ${c.m24 < 0 ? "d" : "r"}`}>{fmtMg(c.m24)}</td><td className={`n ${c.m < 0 ? "d" : "r"}`}>{fmtMg(c.m)}</td><td className="n dim">{fmtMg(c.p10, 0)} to {fmtMg(c.p90, 0)}</td><td className="n">{fmtN(c.D)}</td><td className="n">{fmtN(c.R)}</td><td className="n">{fmtN(c.D + c.R + c.O)}</td><td className="n">{fmtMg(c.gen, 2)}</td><td className="n">{fmtMg(c.mig, 2)}</td></tr>)}
      </tbody></table></div></section>) : null}
  </>);
}

const SEGL: Record<string, string> = { prog: "Progressive", inst: "Institutional", union: "Working class and union", civil: "Civil rights coalition", leanD: "Democratic leaning independents",
  af: "America First", sub: "Suburban professional", pop: "Populist working class", lib: "Libertarian", leanR: "Republican leaning independents", mod: "Moderate independents" };

function PrimBlock({ S, sf, key28, party }: { S: string; sf: StateFile; key28: "dem" | "dem_noharris" | "gop" | "gop_novance"; party: "D" | "R" }) {
  const hub = getHub(); const f = hub.prim[key28]; const ps = sf.prim[key28] as PrimState | undefined; const name = STATE_NAME[S] ?? S;
  if (!ps) return <p className="note">No primary data for {name}.</p>;
  const names = f.names;
  const rows = names.map((n) => [n, ps.share[n], ps.win[n], ps.votes[n], ps.full[n]] as const).sort((a, b) => b[1] - a[1]);
  const [fav, second] = [...names].sort((a, b) => ps.win[b] - ps.win[a]);
  // share and votes are the typical race the favorite wins, so the table and the call always name the same leader;
  // when the top two win within ten points of each other it is a toss up
  const lead = fav, tossup = ps.win[fav] - ps.win[second] < 0.1;
  const paths = geoFor(S); const fills: Record<string, string> = {}, tips: Record<string, GeoTip> = {};
  const cv = Object.fromEntries(sf.counties.map((c) => [c.id, c]));
  for (const [id, top] of Object.entries(ps.counties)) {
    const [i1, s1] = top[0]; const n1 = names[i1]; const hex = (hub.pal[n1] ?? "#888888").replace("#", "");
    const t = Math.max(0.3, Math.min(1, (s1 - 8) / 32)); const rgb = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16)); const base = [42, 35, 51];
    fills[id] = `rgb(${rgb.map((v, k) => Math.round(base[k] + (v - base[k]) * t)).join(",")})`;
    const c = cv[id];
    tips[id] = { title: c ? cname(c.n, S) : id, rows: [...top.slice(0, 3).map(([i, s]) => [names[i], `${s.toFixed(1)}%`, hub.pal[names[i]]] as [string, string, string]),
      ["Primary votes", c ? fmtN(party === "D" ? c.dV : c.rV) : "n/a"]] };
  }
  const el = ps.electorate; const segs = Object.entries(el.seg ?? {}).filter(([k, v]) => v >= 2 && SEGL[k]).sort((a, b) => b[1] - a[1]);
  const cal = ["first, with the early states", "second, with Super Tuesday", "third, in mid March", "fourth, after mid March"][ps.window - 1];
  const leader = Object.entries(ps.counties).map(([id, top]) => { const c = cv[id]; return { id, n: c ? cname(c.n, S) : id, v: c ? (party === "D" ? c.dV : c.rV) : 0, top }; }).sort((a, b) => b.v - a.v);
  return (<>
    <div className="p28-kpis wide">
      {tossup
        ? <div><span className="v">Toss up</span><span className="l">{fav} wins {fmtPct(ps.win[fav])} of runs, {second} {fmtPct(ps.win[second])}</span></div>
        : <div><span className="v" style={{ color: hub.pal[fav] }}>{fav}</span><span className="l">Favorite, wins {fmtPct(ps.win[fav])} of runs</span></div>}
      <div><span className="v">{ps.share[lead].toFixed(1)}%</span><span className="l">{lead}&apos;s projected share</span></div>
      <div><span className="v">{fmtN(ps.total)}</span><span className="l">Projected primary votes</span></div>
      <div><span className="v">{ps.window}</span><span className="l">Calendar window: votes {cal}</span></div>
    </div>
    <div className="p28-two p28-sec">
      <section className="card"><div className="card-h"><h3>Candidates</h3><span className="eye">{fmtN(hub.sims.primary)} primary runs</span></div><div className="card-b p28-tbl"><table><thead><tr><th>Candidate</th><th className="n">Share</th><th className="n">Votes</th><th className="n">Win</th><th className="n">Full field</th></tr></thead><tbody>
        {rows.filter((r) => r[1] >= 0.3 || r[2] > 0.002).map(([n, s, w, v, ff]) => <tr key={n}><td><span className="dot" style={{ background: hub.pal[n] }} />{n}{hub.hypo.includes(n) ? <i className="hyp">HYP</i> : null}</td><td className="n">{s.toFixed(1)}%</td><td className="n">{fmtN(v)}</td><td className="n">{fmtPct(w)}</td><td className="n dim">{ff.toFixed(1)}%</td></tr>)}
      </tbody></table><p className="note">Share and votes are the typical race: the runs {fav} wins, with the most common field still on the ballot when {name} votes{ps.field ? `, ${Math.round(ps.field * 100)}% of all runs` : ""}. Win counts every run, dropouts included. Full field is the share if every candidate were still running. Undecided and minor candidates hold about {party === "D" ? 11 : 9}%.</p></div></section>
      <section className="card"><div className="card-h"><h3>County leaders</h3><span className="eye">deeper shade, bigger share</span></div><div className="card-b">
        {paths.length ? <GeoMap paths={paths.filter((x) => fills[x.id])} fills={fills} tips={tips} label={`${name} ${party === "D" ? "Democratic" : "Republican"} primary by county`} /> : <p className="note">Modeled at the state level.</p>}
        <div className="p28-legend">{[...new Set(Object.values(ps.counties).map((t) => names[t[0][0]]))].map((n) => <span key={n} className="sw"><b style={{ background: hub.pal[n] }} />{n}</span>)}</div>
      </div></section>
    </div>
    <div className="p28-two p28-sec">
      {el.black != null ? <section className="card"><div className="card-h"><h3>Who votes in this primary</h3><span className="eye">our national dataset, placed in {name}</span></div><div className="card-b">
        <div className="p28-bars">{segs.map(([k, v]) => <div className="bar" key={k}><span className="nm">{SEGL[k]}</span><span className="tr"><span className="fl" style={{ width: `${v * 2}%`, background: party === "D" ? "var(--dem2)" : "var(--gop2)" }} /></span><span className="n">{v.toFixed(0)}%</span></div>)}</div>
        <p className="note">Black {el.black}%, Hispanic {el.hisp}%, Asian and other {el.asian}%, under 30 {el.young}%, 65 and up {el.old}%, college graduates {el.college}%, women {el.female}%.</p>
      </div></section> : <section className="card"><div className="card-h"><h3>Who votes in this primary</h3><span className="eye">estimated</span></div><div className="card-b">
        <p className="note">{name} has no county rows in this model, so its primary is the average of {(ps.proxy ?? []).map((x) => STATE_NAME[x]).join(", ")}, with turnout from its own history.</p></div></section>}
      <section className="card"><div className="card-h"><h3>Turnout</h3><span className="eye">projected 2028 votes</span></div><div className="card-b">
        <p className="note">{ps.hist ? <>The last open {party === "D" ? "Democratic" : "Republican"} contest, in {ps.hist.year}, {ps.hist.votes ? <>cast {fmtN(ps.hist.votes)} votes in a {ps.hist.type === "C" ? "caucus" : "primary"}</> : "has no vote count"}. </> : null}
          2028 is modeled as a {ps.hist?.caucus ? "caucus" : "primary"}{ps.hist?.basis?.startsWith("model") ? ", and the contest type changed or the count is missing, so the participation model from our dataset sets the turnout" : ", blending that count with the participation model and growing it for 2028"}: {fmtN(ps.total)} votes.</p>
      </div></section>
    </div>
    <section className="card p28-sec"><div className="card-h"><h3>Every county</h3><span className="eye">largest first</span></div><div className="card-b p28-tbl tall"><table><thead><tr><th>County</th><th className="n">Votes</th><th>Leader</th><th className="n">Share</th><th>Second</th><th className="n">Share</th></tr></thead><tbody>
      {leader.map((c) => <tr key={c.id}><td>{c.n}</td><td className="n">{fmtN(c.v)}</td><td style={{ color: hub.pal[names[c.top[0][0]]] }}>{names[c.top[0][0]]}</td><td className="n">{c.top[0][1].toFixed(1)}%</td><td style={{ color: hub.pal[names[c.top[1]?.[0] ?? 0]] }}>{c.top[1] ? names[c.top[1][0]] : ""}</td><td className="n">{c.top[1] ? `${c.top[1][1].toFixed(1)}%` : ""}</td></tr>)}
    </tbody></table></div></section>
  </>);
}

export default async function Page({ params }: { params: Promise<{ st: string; race: string }> }) {
  const { st, race } = await params;
  const S = st.toUpperCase();
  if (!RACES.includes(race as Race28)) notFound();
  const sf = getState(S); if (!sf || !sf.general) notFound();
  const name = STATE_NAME[S] ?? S; const r = race as Race28;
  return (
    <div className="opp fc-xl fx-dark p28">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><Link href="/forecast/2028">2028</Link><span className="sep">/</span><span>{name}</span></nav>
      <ForecastNav />
      <nav className="p28-racenav" aria-label={`${name} 2028 races`}>
        {RACES.map((k) => <Link key={k} href={href28(S, k)} className={k === r ? "on" : ""} aria-current={k === r ? "page" : undefined}>{RACE_LABEL[k]}</Link>)}
      </nav>
      {r === "president" ? <President S={S} sf={sf} /> : (
        <>
          <header className="p28-hero">
            <p className="eye g">2028 forecast · {name} · {RACE_LABEL[r]}</p>
            <h1>{name} {r === "democratic-primary" ? "Democratic" : "Republican"} primary</h1>
            <p className="lede">Projected shares and votes from county primary electorates built from our national dataset, simulated on the calendar with momentum and dropouts.</p>
          </header>
          {r === "democratic-primary"
            ? <Tabs28 labels={["Harris runs", "Harris does not run"]}>{[<PrimBlock key="a" S={S} sf={sf} key28="dem" party="D" />, <PrimBlock key="b" S={S} sf={sf} key28="dem_noharris" party="D" />]}</Tabs28>
            : <Tabs28 labels={["Vance runs", "Vance does not run"]}>{[<PrimBlock key="a" S={S} sf={sf} key28="gop" party="R" />, <PrimBlock key="b" S={S} sf={sf} key28="gop_novance" party="R" />]}</Tabs28>}
        </>
      )}
      <nav className="p28-states" aria-label="Every state">
        {stateCodes().map((s) => <Link key={s} href={href28(s, r)} className={s === S ? "on" : ""}>{s}</Link>)}
      </nav>
    </div>
  );
}
