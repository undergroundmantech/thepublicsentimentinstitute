import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { getModel, isInd, type FRace } from "@/app/lib/forecastData";
import { RATE, RATING_LABEL, RAMP_CSS, fmtM, lastName, marginColor, partyColor, rating, ratingPill, raceHref, raceIdFromRoute, STATE_NAME } from "@/app/lib/opp";
import GeoMap, { type GeoTip } from "@/app/components/opp/GeoMap";
import type { CountyPath, CountyRow } from "@/app/components/home/countyGeo";
import { pollHref } from "@/app/polls/registry";
import { AGGREGATES } from "@/app/_polling/lib/aggregates";

export const dynamicParams = false;

export function generateStaticParams() {
  return getModel().races.map((r) => {
    const [, state, race] = raceHref(r.id).split("/").slice(1);
    return { state, race };
  });
}

function findRace(state: string, race: string): FRace | undefined {
  const id = raceIdFromRoute(state, race);
  return id ? getModel().races.find((r) => r.id === id) : undefined;
}

function officeWord(r: FRace) { return r.office === "senate" ? "Senate" : r.office === "governor" ? "governor" : `House, district ${r.district}`; }

export async function generateMetadata({ params }: { params: Promise<{ state: string; race: string }> }): Promise<Metadata> {
  const { state, race } = await params;
  const r = findRace(state, race);
  if (!r) return {};
  const title = r.office === "house" ? `${r.name} forecast` : `${r.state} ${r.office === "senate" ? "Senate" : "governor"} forecast`;
  return {
    title,
    description: `${r.dem} vs ${r.gop}: the OnPoint Politics model margin, win probability, county simulation and every poll of the race.`,
    alternates: { canonical: raceHref(r.id) },
  };
}

const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", rel), "utf8"));

export default async function Page({ params }: { params: Promise<{ state: string; race: string }> }) {
  const { state, race } = await params;
  const r = findRace(state, race);
  if (!r) notFound();
  const model = getModel();
  const ind = isInd(r);
  const m = r.stages.rate;
  const rt = rating(m, ind);
  const lead = m < 0 ? r.dem : r.gop;
  const demWin = 1 - (r.est?.prob ?? 0);
  const leadWin = m < 0 ? demWin : 1 - demWin;
  const geo = readJson(`states/${r.st}.json`) as { counties: CountyPath[]; districts: CountyPath[] };
  const updated = new Date(model.meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // the map: counties for statewide races, districts for the House
  let paths: CountyPath[] = [], fills: Record<string, string> = {}, tips: Record<string, GeoTip> = {}, hrefs: Record<string, string> | undefined, unit = "counties";
  if (r.office === "house") {
    paths = geo.districts; unit = "districts"; hrefs = {};
    for (const p of paths) {
      const d = model.races.find((x) => x.id === p.id);
      if (!d) continue;
      const dm = d.stages.rate;
      fills[p.id] = Math.abs(dm) >= 99 ? (dm < 0 ? RATE.safeD : RATE.safeR) : RATE[rating(dm)];
      tips[p.id] = { title: d.name, rows: [[d.dem, "", "var(--dem2)"], [d.gop, "", "var(--gop2)"], ["Model", Math.abs(dm) >= 99 ? "Uncontested" : fmtM(dm)]] };
      hrefs[p.id] = raceHref(d.id);
    }
  } else {
    const all = readJson("counties.json") as Record<string, Record<string, CountyRow> | Record<string, string>>;
    const rows = (all[r.id] ?? {}) as Record<string, CountyRow>;
    const names = (all._n ?? {}) as Record<string, string>;
    paths = geo.counties.filter((p) => rows[p.id]);
    unit = r.st === "AK" ? "boroughs" : r.st === "LA" ? "parishes" : "counties";
    for (const p of paths) {
      const row = rows[p.id];
      fills[p.id] = marginColor(row[0]);
      const nm = names[p.id] ?? p.id;
      tips[p.id] = { title: /county|parish|borough|city/i.test(nm) ? nm : `${nm} County`, rows: [["Simulated margin", fmtM(row[0]), row[0] < 0 ? "var(--dem2)" : "var(--gop2)"], ["Simulated votes", Math.round(row[3]).toLocaleString()]] };
    }
  }

  // simulated margin distribution
  const dist = r.est?.dist;
  const bins = dist ? dist.c.map((c, i) => ({ x: dist.lo + i * dist.w, c })) : [];
  const maxC = Math.max(1, ...bins.map((b) => b.c));

  // polls: the pinned average, then each poll in the model
  const agg = AGGREGATES.find((d) => d.stateAbbr === r.st && d.category === (r.office === "senate" ? "2026 Senate" : "2026 Governor"));
  const xt = r.office !== "house" ? ((readJson("crosstabs.json") as Record<string, [string, string, number, number, number, number][]>)[r.id] ?? []) : [];
  const cuts = [...new Set(xt.map((x) => x[0]))].filter((c) => c !== "All voters").slice(0, 4);
  const officeTitle = r.office === "house" ? r.name : `${r.state} ${r.office === "senate" ? "Senate" : "Governor"}`;
  const sideCls = ind ? "i" : m < 0 ? "d" : "r";

  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span>
        <Link href={`/forecast?office=${r.office}`}>{r.office === "senate" ? "Senate" : r.office === "governor" ? "Governor" : "House"}</Link><span className="sep">/</span><span>{STATE_NAME[r.st] ?? r.st}{r.office === "house" ? ` ${r.district}` : ""}</span>
      </nav>
      <header className="ph">
        <div className="eye g">2026 forecast</div>
        <h1>{officeTitle} <em>forecast</em></h1>
        <p className="lede">{r.dem} vs {r.gop}{r.open ? ", an open seat" : ""}. {Math.abs(m) >= 99 ? "The seat is uncontested." : `The model has ${lastName(lead)} ahead by ${Math.abs(m).toFixed(1)} points, winning ${Math.round(leadWin * 100)} percent of ${model.meta.sims.toLocaleString()} simulated elections.`}</p>
        <div className="pmeta">
          <span className={`pill ${ratingPill(rt)}`}>{RATING_LABEL[rt]}</span>
          <span>Model <b className="mono">{fmtM(m, ind)}</b></span>
          {r.pollAvg != null && <span>Polls <b className="mono">{fmtM(r.pollAvg)}</b></span>}
          <span>Updated <b>{updated}</b></span>
        </div>
      </header>

      <div className="layout">
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card">
            <div className="card-h"><h3>{r.office === "house" ? `${STATE_NAME[r.st]} districts` : "County simulation"}</h3><span className="eye" style={{ marginLeft: "auto" }}>{paths.length} {unit}</span></div>
            <div className="card-b" style={{ padding: 10 }}>
              {paths.length ? <GeoMap paths={paths} fills={fills} tips={tips} hrefs={hrefs} highlight={r.office === "house" ? r.id : undefined} label={`${officeTitle} ${unit} map`} /> : <div className="empty">No county build for this race.</div>}
              <div className="legend" style={{ paddingInline: 8 }}>
                {r.office === "house"
                  ? (["safeD", "likelyD", "leanD", "toss", "leanR", "likelyR", "safeR"] as const).map((k) => <span key={k}><i style={{ background: RATE[k] }} />{RATING_LABEL[k]}</span>)
                  : <><span>D +40</span><span className="ramp" style={{ flex: 1, maxWidth: 280, margin: 0, background: RAMP_CSS }} /><span>R +40</span><span style={{ marginLeft: "auto" }}>Hover a county for the simulated vote</span></>}
              </div>
            </div>
          </div>

          {bins.length > 0 && (
            <div className="card">
              <div className="card-h"><h3>Every simulated outcome</h3><span className="eye" style={{ marginLeft: "auto" }}>{model.meta.sims.toLocaleString()} sims</span></div>
              <div className="card-b">
                <svg className="hist" viewBox="0 0 600 150" role="img" aria-label="Distribution of the simulated margin">
                  {bins.map((b, i) => {
                    const h = (b.c / maxC) * 110, w = 560 / bins.length;
                    const mid = b.x + (dist!.w / 2);
                    return <rect key={i} x={20 + i * w} y={120 - h} width={Math.max(1, w - 1.5)} height={h} rx={1.5} fill={mid < 0 ? "#3d7bff" : "#ff3b5c"} opacity={0.9}><title>{`${fmtM(mid)}: ${b.c} simulations`}</title></rect>;
                  })}
                  {(() => { const zx = 20 + ((0 - dist!.lo) / (dist!.w * bins.length)) * 560; return zx > 20 && zx < 580 ? <line x1={zx} x2={zx} y1={4} y2={124} stroke="var(--hi)" strokeWidth={1.5} opacity={0.8} /> : null; })()}
                  <text x={20} y={142} style={{ font: "500 10px var(--font-m)", fill: "#8e86a3" }}>{fmtM(dist!.lo)}</text>
                  <text x={580} y={142} textAnchor="end" style={{ font: "500 10px var(--font-m)", fill: "#8e86a3" }}>{fmtM(dist!.lo + dist!.w * bins.length)}</text>
                </svg>
                <p style={{ fontSize: 13, marginTop: 8 }}>80 percent of simulations fall between {fmtM(r.est.p10)} and {fmtM(r.est.p90)}. Negative margins are Democratic{ind ? " or independent" : ""} wins.</p>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-h"><h3>Polls of the race</h3>{agg && <Link className="btn sm" href={pollHref(agg.id)} style={{ marginLeft: "auto" }}>Full average</Link>}</div>
            <div className="tblwrap">
              <table className="tbl">
                <thead><tr><th>Pollster</th><th>Sample</th><th style={{ textAlign: "right" }}>Age</th><th style={{ textAlign: "right" }}>Margin</th></tr></thead>
                <tbody>
                  <tr className="avg"><td>OnPoint average</td><td>{r.pollLevel === "lowess" ? "LOWESS Election Day projection" : "Weighted average"}</td><td className="n" /><td className={`n ${r.pollAvg != null ? (r.pollAvg < 0 ? "d" : "r") : ""}`}>{r.pollAvg != null ? fmtM(r.pollAvg) : "No polls"}</td></tr>
                  {(r.polls ?? []).slice(0, 25).map((p, i) => (
                    <tr key={i}><td>{p.pollster}</td><td className="mono" style={{ color: "var(--ink2)" }}>{p.n ? p.n.toLocaleString() : ""} {p.kind}</td><td className="n">{p.age}d</td><td className={`n ${p.margin < 0 ? "d" : p.margin > 0 ? "r" : ""}`}>{fmtM(p.margin)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {cuts.length > 0 && (
            <div className="card">
              <div className="card-h"><h3>Estimated vote by group</h3><span className="eye" style={{ marginLeft: "auto" }}>model crosstabs</span></div>
              <div className="tblwrap">
                <table className="tbl">
                  <thead><tr><th>Group</th><th style={{ textAlign: "right" }}>Share</th><th style={{ textAlign: "right" }}>{lastName(r.dem)}</th><th style={{ textAlign: "right" }}>{lastName(r.gop)}</th></tr></thead>
                  <tbody>
                    {cuts.flatMap((c) => xt.filter((x) => x[0] === c).map((x, i) => (
                      <tr key={c + x[1]}><td>{i === 0 && <span className="eye" style={{ display: "block", marginBottom: 2 }}>{c}</span>}{x[1]}</td><td className="n">{x[2].toFixed(0)}%</td><td className="n d">{x[3].toFixed(1)}</td><td className="n r">{x[4].toFixed(1)}</td></tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <aside className="side">
          <div className="card">
            <div className="stat"><div className="k">Model margin</div><div className={`v ${sideCls === "i" ? "" : sideCls}`} style={sideCls === "i" ? { color: "var(--ind)" } : undefined}>{Math.abs(m) >= 99 ? "Uncontested" : `${lastName(lead)} +${Math.abs(m).toFixed(1)}`}</div></div>
            <div className="stat"><div className="k">Chance of winning</div>
              <div className="cand"><i style={{ background: partyColor(r.cands[0]?.party ?? "D") }} /><span>{r.dem}</span><span className="p">{Math.round(demWin * 100)}%</span></div>
              <div className="cand"><i style={{ background: "var(--gop)" }} /><span>{r.gop}</span><span className="p">{Math.round((1 - demWin) * 100)}%</span></div>
            </div>
            {r.cands?.length > 0 && (
              <div className="stat"><div className="k">Simulated vote</div>
                {r.cands.slice(0, 4).map((c) => <div className="cand" key={c.name}><i style={{ background: partyColor(c.party) }} /><span>{c.name}</span><span className="p">{c.pct.toFixed(1)}%</span></div>)}
              </div>
            )}
            <div className="stat"><div className="k">How the model gets there</div>
              <div className="kv"><span>Partisan lean</span><span>{fmtM(r.stages.anchor)}</span></div>
              <div className="kv"><span>Fundamentals</span><span>{fmtM(r.stages.fund)}</span></div>
              <div className="kv"><span>With polls</span><span>{fmtM(r.stages.poll)}</span></div>
            </div>
          </div>
          <div className="callout">
            <div className="eye">Methodology</div>
            Every county is rebuilt by simulating voters going to the polls, 2,000 times, from TPSI survey data, past results, and the polling average. <Link href="/forecast/methodology" style={{ textDecoration: "underline" }}>How the model works</Link>.
          </div>
        </aside>
      </div>
    </div>
  );
}
