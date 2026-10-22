import type { Metadata } from "next";
import Link from "next/link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { getModel, isInd, type FRace } from "@/app/lib/forecastData";
import { RATE, RATING_LABEL, RAMP_CSS, fmtM, fmtMS, lastName, marginColor, marginColorInd, partyColor, rating, ratingPill, raceHref, raceIdFromRoute, STATE_NAME } from "@/app/lib/opp";
import GeoMap, { type GeoTip } from "@/app/components/opp/GeoMap";
import type { CountyPath, CountyRow } from "@/app/components/home/countyGeo";
import { pollHref } from "@/app/polls/registry";
import { AGGREGATES, buildAggregate } from "@/app/_polling/lib/aggregates";
import AverageStudio, { WeightBars } from "@/app/components/opp/AverageStudio";
import JsonLd from "@/app/components/JsonLd";
import { VoteSummary, CountyVotes, countyName, type CountyVote, type CandVote } from "@/app/components/opp/VoteTables";
import CountyExplorer from "@/app/components/opp/CountyExplorer";
import SectionNav from "@/app/components/opp/SectionNav";
import { STORY_CSS, ShareBars, TrendChart, ModelPath, SecTitle, phraseFor } from "@/app/components/opp/RaceStory";
import StageHero from "@/app/components/opp/StageHero";
import Ambient from "@/app/components/opp/Ambient";
import PollTrail from "@/app/components/opp/PollTrail";
import { Pointy } from "@/app/components/home/Mascot";
import { raceLd, raceMeta } from "../../seo";

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
  return r ? raceMeta(r) : {};
}

const FX_CSS = `
.opp.fx{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.opp.fx > .crumbs,.opp.fx > header{margin-bottom:0}
.fx-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:900px){.fx-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
.fx-k{padding:14px 16px;display:grid;gap:4px;align-content:start}
.fx-k span{font:700 10.5px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.fx-k b{font:800 26px/1.1 var(--font-d);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.fx-k small{font-size:12.5px;color:var(--ink2)}
.fx-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:stretch}
.fx-grid2 > .card{margin:0}
@media (max-width:960px){.fx-grid2{grid-template-columns:1fr}}
.fx-house .cmap{max-height:min(78vh,860px)}
`;

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
  let countyVotes: CountyVote[] = [];
  // the projected vote by candidate, from the race's simulated vote
  const rv = (r as unknown as { votes?: { dem: number; rep: number; other: number; total: number }; cands?: { name: string; party: string; votes: number }[] });
  const candVotes: CandVote[] = rv.cands?.length
    ? rv.cands.map((c) => ({ name: c.name, party: c.party, votes: c.votes ?? 0 }))
    : rv.votes ? [{ name: r.dem, party: "D", votes: rv.votes.dem }, { name: r.gop, party: "R", votes: rv.votes.rep }, ...(rv.votes.other > 0 ? [{ name: "Other candidates", party: "", votes: rv.votes.other }] : [])] : [];
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
    countyVotes = paths.map((p) => { const row = rows[p.id]; const nm = countyName(names[p.id] ?? p.id, r.st);
      return { id: p.id, name: nm, dem: row[1], rep: row[2], other: Math.max(0, row[3] - row[1] - row[2]), total: row[3], margin: row[0] }; });
    unit = r.st === "AK" ? "boroughs" : r.st === "LA" ? "parishes" : "counties";
    for (const p of paths) {
      const row = rows[p.id];
      fills[p.id] = ind ? marginColorInd(row[0]) : marginColor(row[0]);
      const nm = names[p.id] ?? p.id;
      tips[p.id] = { title: /county|parish|borough|city/i.test(nm) ? nm : `${nm} County`, rows: [["Simulated margin", fmtMS(row[0], ind), row[0] < 0 ? (ind ? "var(--ind)" : "var(--dem2)") : "var(--gop2)"], ["Simulated votes", Math.round(row[3]).toLocaleString()]] };
    }
  }

  // simulated margin distribution
  const dist = r.est?.dist;
  const bins = dist ? dist.c.map((c, i) => ({ x: dist.lo + i * dist.w, c })) : [];
  const maxC = Math.max(1, ...bins.map((b) => b.c));

  // polls: the pinned average, then each poll in the model
  // Texas carries more than one Senate matchup; the race page uses the best polled one
  const agg = AGGREGATES.filter((d) => d.stateAbbr === r.st && d.category === (r.office === "senate" ? "2026 Senate" : "2026 Governor")).sort((a, b) => b.polls.length - a.polls.length)[0];
  const built = agg ? buildAggregate(agg) : null;
  const xt = r.office !== "house" ? ((readJson("crosstabs.json") as Record<string, [string, string, number, number, number, number][]>)[r.id] ?? []) : [];
  const cuts = [...new Set(xt.map((x) => x[0]))].filter((c) => c !== "All voters").slice(0, 4);
  const officeTitle = r.office === "house" ? r.name : `${r.state} ${r.office === "senate" ? "Senate" : "Governor"}`;
  const sideCls = ind ? "i" : m < 0 ? "d" : "r";

  const leadColor = m < 0 ? (ind ? "#b78cff" : "#5b8fff") : "#ff4d6a";
  const otherColor = m < 0 ? "#ff4d6a" : (ind ? "#b78cff" : "#5b8fff");
  const phrase = phraseFor(leadWin);
  const raceWhere = r.office === "senate" ? `${r.state}'s Senate seat` : r.office === "governor" ? `${r.state}'s governorship` : `${r.state}'s ${r.name.replace(`${r.state} `, "")} District`;
  const half = Math.abs((r.est.p90 ?? 0) - (r.est.p10 ?? 0)) / 4;
  const shareHalf = Math.max(0.5, half);
  const shareCands = (r.cands ?? []).filter((c) => c.pct >= 3).slice(0, 3).map((c) => ({ name: c.name, party: c.party === "D" ? "Democrat" : c.party === "R" ? "Republican" : c.party, pct: c.pct,
    color: c.party === "D" ? "#5b8fff" : c.party === "R" ? "#ff4d6a" : "#b78cff", win: c.party === "R" ? 1 - demWin : c.name === r.dem ? demWin : undefined }));
  const pathSteps = [
    { label: "Partisan lean", m: r.stages.anchor, note: "the state's baseline" },
    { label: "Fundamentals", m: r.stages.fund, note: "approval, economy, candidates" },
    { label: "With polls", m: r.ev ? r.est.margin - r.ev.shift : r.stages.poll, note: r.pollAvg != null ? `average ${fmtM(r.pollAvg)}` : "no polls" },
    ...(r.ev ? [{ label: "With early vote", m: r.est.margin, note: "turnout so far" }] : []),
  ].filter((x) => Number.isFinite(x.m) && Math.abs(x.m) < 99);
  const heroCands = (r.cands ?? []).filter((c) => c.pct >= 3).slice(0, 2).map((c) => ({ name: c.name, party: c.party,
    label: c.party === "D" ? "Democrat" : c.party === "R" ? "Republican" : "Independent", pct: c.pct, votes: c.votes ?? 0,
    cls: (c.party === "D" ? "d" : c.party === "R" ? "r" : "i") as "d" | "r" | "i" }));
  const navItems = [
    { id: "map", label: r.office === "house" ? "Map" : "Counties map" }, { id: "vote", label: "Vote share" },
    ...((r.trend?.length ?? 0) >= 3 ? [{ id: "trend", label: "Trend" }] : []), { id: "polls", label: "Polling" }, { id: "path", label: "How we got here" },
    ...(cuts.length ? [{ id: "groups", label: "Groups" }] : []), ...(countyVotes.length ? [{ id: "counties", label: "Every county" }] : []),
  ];

  return (
    <div className="opp fc-xl fx fx-dark">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span>
        <Link href={`/forecast?office=${r.office}`}>{r.office === "senate" ? "Senate" : r.office === "governor" ? "Governor" : "House"}</Link><span className="sep">/</span><span>{STATE_NAME[r.st] ?? r.st}{r.office === "house" ? ` ${r.district}` : ""}</span>
      </nav>
      <ForecastNav />
      <JsonLd data={raceLd(r)} />
      <style>{STORY_CSS}</style>
      <Ambient />
      <StageHero
        eyebrow={`2026 forecast · ${officeTitle}`}
        title={Math.abs(m) >= 99
          ? <><span className="nm" style={{ color: leadColor }}>{lead}</span> is <span className="ph-w">unopposed</span> for {raceWhere}.</>
          : phrase
            ? <><span className="nm" style={{ color: leadColor }}>{lead}</span> is <span className="ph-w">{phrase}</span> to win {raceWhere}.</>
            : <><span className="nm" style={{ color: ind ? "#b78cff" : "#7fa6ff" }}>{r.dem}</span> and <span className="nm" style={{ color: "#ff8399" }}>{r.gop}</span> are in a <span className="ph-w">toss up</span> for {raceWhere}.</>}
        lede={<>{r.dem} vs {r.gop}{r.open ? ", an open seat" : ""}. {Math.abs(m) >= 99 ? "The seat is uncontested." : `The model has ${lastName(lead)} ahead by ${Math.abs(m).toFixed(1)} points, winning ${Math.round(leadWin * 100)} percent of ${model.meta.sims.toLocaleString()} simulated elections.`}</>}
        pills={<>
          <span className={`pill ${ratingPill(rt)}`}>{RATING_LABEL[rt]}</span>
          <span>Model <b className="mono">{fmtM(m, ind)}</b></span>
          {r.pollAvg != null && <span>Polls <b className="mono">{fmtMS(r.pollAvg, ind)}</b></span>}
          <span>Updated <b>{updated}</b></span>
        </>}
        cands={heroCands.map((c) => ({ name: c.name, label: c.label, pct: c.pct, votes: c.votes, color: c.cls === "d" ? "#5b8fff" : c.cls === "r" ? "#ff4d6a" : "#b78cff" }))}
        paths={paths} fills={fills} mapLabel={`${officeTitle} drawn in pixels, shaded by the forecast`}
        labels={Object.fromEntries(Object.entries(tips).map(([id, t]) => { const row = t.rows.find((x) => x[0] === "Simulated margin" || x[0] === "Model"); const v = String(row?.[1] ?? ""); return [id, { t: t.title, s: row ? `${row[0]} ${v}` : "", c: v.startsWith("R") ? "#ff8399" : ind ? "#b78cff" : "#7fa6ff" }]; }))}
        win={Math.abs(m) < 99 ? leadWin : null} focus={r.office === "house" ? r.id : undefined}
        lead={{ name: lastName(lead), color: leadColor }} other={{ name: lastName(m < 0 ? r.gop : r.dem), color: otherColor }} />

      <style>{FX_CSS}</style>
      <div className="fx-kpis">
        <div className="card fx-k"><span>Rating</span><b style={{ color: sideCls === "i" ? "var(--ind)" : sideCls === "d" ? "var(--dem2)" : "var(--gop2)" }}>{RATING_LABEL[rt]}</b><small>{Math.round(leadWin * 100)}% chance for {lastName(lead)}</small></div>
        <div className="card fx-k"><span>Model margin</span><b className="mono">{Math.abs(m) >= 99 ? "Uncontested" : fmtM(m, ind)}</b><small>{r.pollAvg != null ? `Polls ${fmtM(r.pollAvg)}` : "No polls in the race"}</small></div>
        <div className="card fx-k"><span>80 percent range</span><b className="mono">{fmtMS(r.est.p10, ind)} to {fmtMS(r.est.p90, ind)}</b><small>{model.meta.sims.toLocaleString()} simulations</small></div>
        <div className="card fx-k"><span>Projected votes</span><b className="mono">{rv.votes ? rv.votes.total.toLocaleString("en-US") : "n/a"}</b><small>{rv.votes && rv.votes.total ? `${lastName(lead)} ${(Math.max(rv.votes.dem, rv.votes.rep) / rv.votes.total * 100).toFixed(1)}%` : ""}</small></div>
      </div>


      <div className="fx-body">
        <SectionNav items={navItems} />
        <div style={{ display: "grid", gap: 56, minWidth: 0 }}>
          <section id="map" className="st-sec">
            <SecTitle title={r.office === "house" ? "The district map" : "The county map"} sub={r.office === "house" ? "Every district in the state, shaded by its rating" : "Four ways to read the state: margin, shift from 2024, vote bubbles and turnout"} />
      {r.office !== "house" && countyVotes.length > 0 ? (
        <section className="fx-sec" aria-label="County explorer">
          <CountyExplorer paths={paths} unit={unit} stateName={STATE_NAME[r.st] ?? r.state} title={`${officeTitle} by ${unit === "parishes" ? "parish" : unit === "boroughs" ? "borough" : "county"}`}
            rows={countyVotes.map((c) => ({ id: c.id, name: c.name, a: c.dem, b: c.rep, other: c.other, total: c.total }))}
            sides={[{ name: lastName(r.dem), short: lastName(r.dem), color: ind ? "#b78cff" : "#3d7bff", letter: ind ? "I" : "D" }, { name: lastName(r.gop), short: lastName(r.gop), color: "#ff3b5c", letter: "R" }]} />
        </section>
      ) : (
        <section className="fx-sec fx-house">
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
        </section>
      )}
          </section>

          <section id="vote" className="st-sec">
            <SecTitle title="Vote share" sub="Each candidate's projected share and the range of 80 percent of simulations" />
            {shareCands.length ? <ShareBars cands={shareCands} half={shareHalf} /> : null}
      <div className="fx-grid2">
          {rv.votes && rv.votes.total > 0 ? (
            <VoteSummary title={r.office === "house" ? "Projected district vote" : "Projected statewide vote"} cands={candVotes} total={rv.votes.total}
              note={rv.votes.rep === 0 || rv.votes.dem === 0 ? "Uncontested by one of the major parties." : "Each candidate's expected vote in the On Point simulation, at the forecast's projected turnout."} />
          ) : null}
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
                <p style={{ fontSize: 13, marginTop: 8 }}>80 percent of simulations fall between {fmtMS(r.est.p10, ind)} and {fmtMS(r.est.p90, ind)}. Negative margins are Democratic{ind ? " or independent" : ""} wins.</p>
              </div>
            </div>
          )}
      </div>
          </section>

          {(r.trend?.length ?? 0) >= 3 ? (
            <section id="trend" className="st-sec">
              <SecTitle title="The trend" sub="Each side's chance of winning over the forecast's recent updates" />
              <TrendChart trend={r.trend!} demName={lastName(r.dem)} gopName={lastName(r.gop)} demColor={ind ? "#b78cff" : "#3d7bff"} gopColor="#ff3b5c" />
            </section>
          ) : null}

          <section id="polls" className="st-sec">
            <SecTitle title="Polling" sub="Every poll in the average, and how the model reads it" />
            {agg && built && built.daily.length ? (
              <div className="card ptr-card">
                <div className="card-b">
                  <AverageStudio title={`The ${STATE_NAME[r.st] ?? r.st} ${r.office === "senate" ? "Senate" : "governor"} polling average`} daily={built.daily} polls={built.polls.map((q) => ({ pollster: q.pollster, t: q.t, a: q.a, b: q.b, margin: q.margin, sampleSize: q.sampleSize, sampleType: q.sampleType, grade: q.grade, share: q.share, op: q.pollster.startsWith("On Point") }))}
                    seriesA={{ label: agg.seriesA.label, color: agg.seriesA.color, party: agg.seriesA.party }} seriesB={{ label: agg.seriesB.label, color: agg.seriesB.color, party: agg.seriesB.party }} marginLabel={agg.marginLabel} unit={agg.unit} height={360} />
                </div>
                <div className="ptr-wb">
                  <div className="eye">What moves the average today</div>
                  <WeightBars polls={built.polls.map((q) => ({ pollster: q.pollster, t: q.t, a: q.a, b: q.b, margin: q.margin, sampleSize: q.sampleSize, sampleType: q.sampleType, grade: q.grade, share: q.share }))} seriesA={{ label: agg.seriesA.label, color: agg.seriesA.color }} seriesB={{ label: agg.seriesB.label, color: agg.seriesB.color }} marginLabel={agg.marginLabel} limit={6} />
                </div>
                <p className="ptr-note">This is the same On Point polling average as the <Link href={pollHref(agg.id)} style={{ textDecoration: "underline" }}>full average page</Link>. The forecast reads the polls through its own Election Day projection, shown as the On Point average in the table below, and blends it with partisan lean and fundamentals.</p>
                <Pointy className="ptr-pty" pose="point" prop="chart" size={96} look={-1} flip />
              </div>
            ) : (r.polls?.length ?? 0) > 0 ? (
              <div className="card ptr-card">
                <div className="card-h"><h3>Every poll, over time</h3><span className="eye" style={{ marginLeft: "auto" }}>{r.polls!.length} polls · dot size is sample</span></div>
                <div className="ptr-wrap">
                  <PollTrail polls={r.polls!.map((p) => ({ age: p.age, margin: p.margin, n: p.n, pollster: p.pollster, op: p.pollster.startsWith("On Point") }))} avg={r.pollAvg ?? null} asOf={model.meta.updated} ind={ind} dem={lastName(r.dem)} gop={lastName(r.gop)} />
                </div>
                <p className="ptr-note">The line is a recency smoothed trend of the polls shown; the gold marker is the On Point average the model uses.</p>
                <Pointy className="ptr-pty" pose="point" prop="none" size={96} look={1} flip />
              </div>
            ) : null}
      <div className="fx-grid2">
          <div className="card">
            <div className="card-h"><h3>Polls of the race</h3>{agg && <Link className="btn sm" href={pollHref(agg.id)} style={{ marginLeft: "auto" }}>Full average</Link>}</div>
            <div className="tblwrap">
              <table className="tbl">
                <thead><tr><th>Pollster</th><th>Sample</th><th style={{ textAlign: "right" }}>Age</th><th style={{ textAlign: "right" }}>Margin</th></tr></thead>
                <tbody>
                  <tr className="avg"><td>On Point average</td><td>{r.pollLevel === "lowess" ? "LOWESS Election Day projection" : "Weighted average"}</td><td className="n" /><td className={`n ${r.pollAvg != null ? (r.pollAvg < 0 ? "d" : "r") : ""}`}>{r.pollAvg != null ? fmtM(r.pollAvg) : "No polls"}</td></tr>
                  {(r.polls ?? []).slice(0, 25).map((p, i) => (
                    <tr key={i}><td>{p.pollster}</td><td className="mono" style={{ color: "var(--ink2)" }}>{p.n ? p.n.toLocaleString() : ""} {p.kind}</td><td className="n">{p.age}d</td><td className={`n ${p.margin < 0 ? "d" : p.margin > 0 ? "r" : ""}`}>{fmtM(p.margin)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
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
              <div className="kv"><span>With polls</span><span>{fmtM(r.ev ? r.est.margin - r.ev.shift : r.stages.poll)}</span></div>
              {r.ev ? <>
                <div className="kv"><span>Early vote turnout</span><span>{Math.abs(r.ev.shift) < 0.05 ? "No change" : `${r.ev.shift > 0 ? "R" : "D"} +${Math.abs(r.ev.shift).toFixed(1)}`}</span></div>
                <div className="kv"><span>With early vote</span><span>{fmtM(r.est.margin)}</span></div>
              </> : null}
            </div>
            {r.ev ? (
              <p className="ev-src" style={{ fontSize: 12, lineHeight: 1.45, color: "var(--mute)", margin: "-4px 0 0" }}>
                {r.ev.source === "early vote"
                  ? `Read from ${Number(r.ev.ballots ?? 0).toLocaleString("en-US")} ballots cast so far in ${r.state}, against the party mix the forecast expected of them, with similar states and primary turnout.`
                  : `${r.state} has no early vote reported yet, so its turnout correction comes from similar states that do and from its primary turnout.`}{" "}
                <Link href="/maps/early-vote" style={{ textDecoration: "underline" }}>Early vote tracker</Link>
              </p>
            ) : null}
          </div>
          </div>
      </div>
          </section>

          <section id="path" className="st-sec">
            <SecTitle title="How we got here" sub="From the state's partisan lean to the forecast, one stage at a time" />
            <ModelPath ind={ind} steps={pathSteps} />
          </section>

          <section id="groups" className="st-sec">
            {cuts.length > 0 ? <SecTitle title="Who votes for whom" sub="Estimated vote by group from the model's simulated electorate" /> : null}
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
          </section>

          {countyVotes.length > 0 ? (
            <section id="counties" className="st-sec">
              <SecTitle title="Every county" sub="The projected vote in each county, largest first" />
          {countyVotes.length > 0 && (
            <CountyVotes rows={countyVotes} demName={lastName(r.dem)} repName={lastName(r.gop)} unit={unit} demLetter={ind ? "I" : "D"} />
          )}
            </section>
          ) : null}

          <div className="callout">
            <div className="eye">Methodology</div>
            Every county is rebuilt by simulating voters going to the polls, 2,000 times, from On Point Polling survey data, past results, and the polling average. <Link href="/forecast/methodology" style={{ textDecoration: "underline" }}>How the model works</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
