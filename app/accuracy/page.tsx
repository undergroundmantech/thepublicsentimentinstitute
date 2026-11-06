import Link from "@/app/components/Link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { raceHref, STATE_NAME } from "@/app/lib/opp";
import { seo } from "@/app/lib/seo";
import AccMap, { type MapRow } from "./AccMap";
import { Calibration, ErrHist, LeanBars, Ring, SeatHist } from "./Charts";
import { RaceTable } from "./RaceTable";
import HouseExplorer from "./HouseExplorer";
import SectionNav from "@/app/components/opp/SectionNav";
import { CountUp } from "@/app/components/home/motion";
import JsonLd from "@/app/components/JsonLd";
import { SITE, ORG_ID } from "@/app/lib/seo";
import { CalledStrip, Calls, Gallery, GenericTrio, PollRanking, SeatTable, SenateRank } from "./Bench";
import { faqLd, getBench, rankingLd } from "./bench";
import { asofLabel, calledSeats, seatMiss, cls, er, FROZEN_DIR, getAcc, getManifest, mg, OFFICE, pc, who, winnerName, type Blk, type Office, type Race } from "./data";
import "./acc.css";

export const metadata = seo({
  title: "The most accurate pollster of 2026: the On Point accuracy report",
  description: "On Point Polling was the most accurate pollster of the 2026 midterms: D +13.1 on the final generic ballot against a D +13.0 result, first of 42 final national polls. Every Senate, House, governor, county and state legislative forecast, scored against the count.",
  path: "/accuracy",
  type: "article",
  published: "2026-11-06",
  modified: "2026-11-06",
  ownImage: true,
  keywords: ["most accurate pollster", "most accurate pollster 2026", "most accurate poll", "most accurate election forecast", "2026 midterm polling accuracy", "pollster rankings 2026", "generic ballot accuracy", "On Point Polling", "On Point Politics", "VT Analytics"],
});

const n = (x: number) => x.toLocaleString("en-US");
const NAV = [
  { id: "pollster", label: "The poll" }, { id: "forecasters", label: "Against the field" }, { id: "calls", label: "Big calls" },
  { id: "chambers", label: "Chambers" }, { id: "scorecard", label: "Scorecard" }, { id: "calibration", label: "Calibration" }, { id: "map", label: "Map" },
  { id: "senate", label: "Senate" }, { id: "governor", label: "Governors" }, { id: "house", label: "House" }, { id: "counties", label: "Counties" },
  { id: "legislatures", label: "Legislatures" }, { id: "lessons", label: "Lessons" }, { id: "graphics", label: "Graphics" }, { id: "method", label: "Method" },
];
const Check = () => <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="ck"><circle cx="8" cy="8" r="8" /><path d="M4.6 8.3 7 10.6l4.4-4.9" /></svg>;
function ScoreRow({ label, b, h }: { label: string; b: Blk | null; h?: { races: number; called_right: number; counting: number } }) {
  if (!b) return null;
  return (
    <tr>
      <th scope="row">{label}</th>
      {h ? <td className="n">{h.called_right} of {h.races}</td> : <td className="n">{b.right} of {b.n}</td>}
      <td className="n">{b.mae.toFixed(1)}</td>
      <td className="n">{b.median_miss.toFixed(1)}</td>
      <td className={`n ${cls(b.bias)}`}>{er(b.bias)}</td>
      <td className="n">{b.in80.toFixed(0)}%</td>
      <td className="n">{b.mean_fav.toFixed(0)}%</td>
      <td className="n">{b.fav_won.toFixed(0)}%</td>
      <td className="n">{b.brier.toFixed(3)}</td>
    </tr>
  );
}

export default function AccuracyPage() {
  const A = getAcc();
  const B = getBench();
  const man = getManifest();
  const H = A.headline, C = A.chambers, LG = A.legislatures, CO = A.counties;
  const by = (o: Office) => A.races.filter((r) => r.o === o);
  const close = (rs: Race[]) => rs.slice().sort((a, b) => Math.abs(a.fm) - Math.abs(b.fm));
  const sen = close(by("senate")), gov = close(by("governor")), house = by("house");
  const allRight = (["senate", "house", "governor"] as Office[]).every((o) => C[o].right);
  const fed = H.all.scored!;
  const statewide = A.races.filter((r) => r.o !== "house" && !r.excl && r.err != null);
  const swMae = statewide.reduce((a, r) => a + Math.abs(r.err!), 0) / Math.max(1, statewide.length);
  const fedMisses = A.races.filter((r) => !r.right && r.o !== "house");
  const worstState = A.races.filter((r) => r.o !== "house" && !r.excl && r.err != null).sort((a, b) => Math.abs(b.err!) - Math.abs(a.err!)).slice(0, 5);
  const upsets5 = LG.wrong.filter((w) => w.wp <= 0.05);
  const frozenAt = new Date(man.last_written_utc).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  const lc = LG.calib, fc = A.calib;
  const midFed = fc.filter((c) => c.lo >= 60 && c.lo < 90), midLeg = lc.filter((c) => c.lo >= 70 && c.lo < 99);
  const sumN = (cs: typeof fc) => cs.reduce((a, c) => a + c.n, 0);
  const wAvg = (cs: typeof fc, k: "expected" | "won") => cs.reduce((a, c) => a + c[k] * c.n, 0) / Math.max(1, sumN(cs));
  const safeR = LG.lean.find((l) => l.lo >= 40), safeRfed = H.house.competitive;
  const sw = CO.region.find((r) => r.k === "Southwest"), sub = CO.area.find((r) => r.k === "Suburban");

  const stateRows: Record<string, MapRow> = Object.fromEntries(Object.entries(A.states).map(([st, s]) => {
    const rs = s.races.map((x) => A.races.find((r) => r.id === x.id)!).filter(Boolean);
    return [st, { id: st, label: STATE_NAME[st] ?? st, err: s.bias,
      fm: rs.map((r) => `${OFFICE[r.o]} ${mg(r.fm, r.ind)}`).join(" · "), act: rs.map((r) => `${OFFICE[r.o]} ${mg(r.act, r.ind)}`).join(" · "),
      note: rs.length > 1 ? `Average of ${rs.length} races` : undefined }];
  }));
  const houseRows: Record<string, MapRow> = Object.fromEntries(house.filter((r) => !r.excl && r.err != null && Math.abs(r.fm) < 99).map((r) => [r.id, {
    id: r.id, label: `${STATE_NAME[r.st] ?? r.st} ${r.d}`, err: r.err!, fm: mg(r.fm), act: mg(r.act), note: `${winnerName(r)} ${r.fin ? "won" : "leads"} · ${r.pct}% counted`,
  }]));

  return (
    <div className="opp acc">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><span>2026 accuracy</span></nav>
      <ForecastNav />
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "Article", "@id": `${SITE.url}/accuracy#article`, headline: "The most accurate pollster of 2026: the On Point accuracy report", url: `${SITE.url}/accuracy`,
          datePublished: "2026-11-06T08:00:00-05:00", dateModified: `${A.built.replace("Z", ":00Z")}`, image: `${SITE.url}/accuracy/opengraph-image.jpg`,
          author: { "@id": ORG_ID }, publisher: { "@id": ORG_ID }, about: ["2026 United States elections", "Opinion poll accuracy", "Election forecasting"],
          description: `On Point Polling's final national poll had Democrats up ${B.generic.us.margin.toFixed(1)} against a D +${B.generic.result.margin.toFixed(1)} result, first of ${B.national.polls.length} final national polls. The forecast called ${H.all.called_right} of ${H.all.races} Senate, House and governor races and the winner of all three chambers.` },
        rankingLd(B, "/accuracy"),
        faqLd(B, [{ q: "How accurate was the On Point 2026 forecast?", a: `The final forecast, frozen on November 3 before polls closed, called ${H.all.called_right} of ${H.all.races} Senate, House and governor races and the winner of the Senate, the House and the governors. It called ${LG.chambers.right} of ${LG.chambers.settled} settled state legislative chambers and ${LG.scored.share.toFixed(1)} percent of contested legislative districts.` }]),
        { "@type": "Dataset", name: "On Point Politics 2026 forecast accuracy scores", url: `${SITE.url}/accuracy`, distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE.url}/accuracy/2026.json` }],
          creator: { "@id": ORG_ID }, license: "https://creativecommons.org/licenses/by/4.0/", temporalCoverage: "2026-11-03",
          description: "Every Senate, House and governor race, state legislative chamber and district and statewide county in the 2026 On Point forecast, scored against the count." },
      ] }} />

      <header className="acc-hero rc">
        <div className="acc-glow" aria-hidden="true"><i /><i /><i /></div>
        <div className="rc-copy">
          <p className="eye g">2026 accuracy report · count as of {asofLabel(A.results_asof.federal)}</p>
          <h1>The most accurate poll in America.{allRight ? <> <em>All three chambers</em> called right.</> : null}</h1>
          <p className="lede">
            Our final national poll had Democrats up {B.generic.us.margin.toFixed(1)}. The projected final is {B.generic.result.margin.toFixed(1)}.
            Below, the final forecast, frozen at {frozenAt} ET on November 3 before the first polls closed, is scored against the count in every race, county and legislative district.
            {H.all.counting ? ` ${H.all.counting} races were still counting at this read and are marked.` : ""}
          </p>
          <div className="acc-cta">
            <Link className="btn g" href="/forecast/2026">See the forecast as published</Link>
            <Link className="btn" href="/results/2026">Every result</Link>
            <a className="btn" href="/accuracy/2026.json">Download the scores</a>
          </div>
        </div>
        <aside className="rc-card" aria-label="Report card">
          <div className="rc-gb">
            <div><span className="k">Our final poll</span><b className="d">D +{B.generic.us.margin.toFixed(1)}</b></div>
            <div><span className="k">The result</span><b>D +{B.generic.result.margin.toFixed(1)}</b></div>
            <div><span className="k">The averages</span><b className="dim">D +{B.generic.averages.margin.toFixed(1)}</b></div>
          </div>
          <div className="rc-ring"><Ring pct={fed.share} size={92} label={`${fed.share.toFixed(1)} percent of scored races called right`} />
            <div><b>{H.all.called_right} of {H.all.races}</b><span>Senate, House and governor races called right</span></div></div>
          <ul className="rc-ch">
            {(["senate", "house", "governor"] as Office[]).map((o) => (
              <li key={o} className={C[o].right ? "ok" : "no"}>
                {C[o].right ? <Check /> : <span className="x" aria-hidden="true" />}
                <span className="nm">{o === "governor" ? "Governors" : OFFICE[o]}</span>
                <span className="cl">Called {C[o].projD} D</span>
                <span className="ct">Count <b className={C[o].control === "D" ? "d" : "r"}>{C[o].actualD} D</b></span>
              </li>
            ))}
          </ul>
          <div className="rc-f"><span><b>{LG.chambers.right} of {LG.chambers.settled}</b> legislative chambers</span><span><b>{LG.scored.share.toFixed(1)}%</b> of contested districts</span></div>
        </aside>
      </header>

      <div className="acc-kpis">
        {(["senate", "house", "governor"] as Office[]).map((o) => {
          const c = C[o];
          return (
            <div key={o}>
              <span className="l">{o === "governor" ? "Governors" : OFFICE[o]} control</span>
              <span className={`v ${c.control === "D" ? "d" : c.control === "R" ? "r" : ""}`}>{c.actualD} D · {c.actualR} R</span>
              <span className="s">Forecast called {calledSeats(c)} · seat miss {seatMiss(c.seat_err)} · control {c.right ? "called right" : "missed"}</span>
            </div>
          );
        })}
        <div><span className="l">Races called right</span><span className="v"><CountUp value={fed.share} decimals={1} suffix="%" /></span><span className="s">{fed.right} of {fed.n} scored races, {H.all.competitive?.right} of {H.all.competitive?.n} within 10 points</span></div>
        <div><span className="l">Legislative chambers</span><span className="v">{LG.chambers.right} of {LG.chambers.settled}</span><span className="s">Settled chambers called right, average miss of {LG.chambers.seat_mae.toFixed(1)} seats against the called winners</span></div>
        <div><span className="l">Legislative districts</span><span className="v"><CountUp value={LG.scored.share} decimals={1} suffix="%" /></span><span className="s">{n(LG.scored.right)} of {n(LG.scored.n)} contested districts called right</span></div>
        <div><span className="l">Statewide margins</span><span className="v"><CountUp value={Math.round(swMae * 10) / 10} decimals={1} suffix=" pts" /></span><span className="s">Average miss across {statewide.length} Senate and governor races</span></div>
        <div><span className="l">County margins</span><span className="v"><CountUp value={CO.all.wmae} decimals={1} suffix=" pts" /></span><span className="s">Vote weighted miss in {n(CO.all.counties)} counties, {CO.all.within5.toFixed(0)}% within 5</span></div>
      </div>

      <div className="fx-body acc-body">
        <SectionNav items={NAV} />
        <div className="acc-main">
      <section className="acc-sec" id="pollster">
        <div className="sec-h"><div><p className="eye">The most accurate pollster</p><h2>D +{B.generic.us.margin.toFixed(1)} on the final generic ballot. The result: D +{B.generic.result.margin.toFixed(1)}.</h2>
          <p>On Point Polling&apos;s final national survey, fielded {new Date(B.generic.us.field + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })} among {B.generic.us.n.toLocaleString("en-US")} registered voters. The polling averages finished near D +{B.generic.averages.margin.toFixed(1)}.</p></div></div>
        <GenericTrio b={B} />
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h"><h3>Every final national poll, ranked</h3><span className="eye">{B.national.polls.length} pollsters</span></div>
          <PollRanking b={B} limit={12} />
        </div>
        <details className="card acc-more"><summary>All {B.national.polls.length} final national polls</summary><PollRanking b={B} /></details>
        <p className="bx-src">{B.national.method} The margin miss alone puts The Honest Poll first at D +13 and On Point second, 0.1 off. The D +{B.generic.result.margin.toFixed(1)} result is the projected final once every vote is counted; the {B.generic.result.counted_votes_m} million votes counted by {B.asof_label} show D +{B.generic.result.counted_margin.toFixed(1)}. <Link href="/most-accurate-pollster">The full ranking</Link> has its own page.</p>
      </section>

      <section className="acc-sec" id="forecasters">
        <div className="sec-h"><div><p className="eye">Against every other forecast</p><h2>The closest seat counts of any forecast</h2>
          <p>Every forecast that published final seat numbers, against calls and current leaders as of {B.asof_label}. That is a day later than the count in the race tables below, so a few leads differ.</p></div></div>
        <div className="card"><SeatTable b={B} /></div>
        <p className="bx-src">{B.seats.note}</p>
        <div className="acc-grid2">
          <div className="card"><div className="card-h"><h3>The 10 Senate races that decided the majority</h3><span className="eye">{B.senate.rows.length} forecasts</span></div><SenateRank b={B} />
            <p className="bx-src card-b" style={{ margin: 0 }}>{B.senate.note}</p></div>
          <div className="bx-stack">
            <CalledStrip b={B} />
            <p className="bx-src" style={{ marginTop: 0 }}>{B.called.note} Count as of {B.asof_label}.</p>
          </div>
        </div>
      </section>

      <section className="acc-sec" id="calls">
        <div className="sec-h"><div><p className="eye">What else we got right</p><h2>The calls nobody else made</h2></div></div>
        <Calls b={B} />
        <p className="bx-src">Mississippi and Kansas: the final On Point forecast against the count on {B.asof_label}, with Mississippi 97 percent counted and not yet called. Other forecasters&apos; ratings from their final pages, maps and videos, November 2 to 3. Seat counts are Democratic seats, independents who caucus with them included. Safe calls are races the model gave a 95 percent chance or higher.</p>
      </section>

      <section className="acc-sec" id="chambers">
        <div className="sec-h"><div><p className="eye">Chamber control</p><h2>Where the seats landed inside the forecast</h2>
          <p>The forecast&apos;s seat count is the called winner in every race plus the seats not up, the gold line. The white line is the count. Behind them is the seat distribution from {n(A.forecast.sims)} simulations, with its 80 percent range shaded.</p></div></div>
        <div className="acc-grid3">
          {(["senate", "house", "governor"] as Office[]).map((o) => {
            const c = C[o];
            return (
              <div key={o} className="card">
                <div className="card-h"><h3>{o === "governor" ? "Governors" : OFFICE[o]}</h3><span className={`pill ${c.right ? "ok" : "no"}`}>{c.right ? "Control called right" : "Control missed"}</span></div>
                <div className="card-b">
                  <SeatHist c={c} label={OFFICE[o]} />
                  <dl className="acc-dl">
                    <div><dt>Forecast, called winners</dt><dd>{calledSeats(c)}</dd></div>
                    <div><dt>Count</dt><dd>{c.actualD} D, {c.actualR} R{c.counting ? `, ${c.counting} still counting` : ""}</dd></div>
                    <div><dt>Seat miss</dt><dd>{seatMiss(c.seat_err)}</dd></div>
                    <div><dt>Count inside the 80% range</dt><dd>{c.inside80 ? "Yes" : "No"}, {c.p10} to {c.p90} D</dd></div>
                  </dl>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="acc-sec" id="scorecard">
        <div className="sec-h"><div><p className="eye">Scorecard</p><h2>Every office, graded the same way</h2>
          <p>Miss is how far the result landed from the forecast margin. Lean is the average of those misses, the direction the whole map moved. A Brier score of 0 is perfect and 0.25 is a coin flip.</p></div></div>
        <div className="card"><div className="acc-tbl"><table className="tbl score">
          <thead><tr><th>Races</th><th className="n">Called right</th><th className="n">Average miss</th><th className="n">Median miss</th><th className="n">Lean of the miss</th><th className="n">Inside 80% range</th><th className="n">Average favorite chance</th><th className="n">Favorites won</th><th className="n">Brier</th></tr></thead>
          <tbody>
            <ScoreRow label="Senate" b={H.senate.scored} h={H.senate} />
            <ScoreRow label="Governor" b={H.governor.scored} h={H.governor} />
            <ScoreRow label="House" b={H.house.scored} h={H.house} />
            <ScoreRow label="All federal and governor" b={H.all.scored} h={H.all} />
            <ScoreRow label="Within 10 points" b={H.all.competitive} />
            <ScoreRow label="Called races only" b={H.all.scored_final} />
          </tbody>
        </table></div>
          <p className="acc-note card-b">Called right counts every race, unopposed seats included. The other columns use the {fed.n} races with both major parties on the count; the {A.excluded.length} races listed under method are left out of them.</p>
        </div>
        <div className="acc-grid2">
          <div className="card"><div className="card-h"><h3>How far each race landed</h3><span className="eye">{fed.n} races</span></div>
            <div className="card-b"><ErrHist edges={A.err_hist.edges} counts={A.err_hist.counts} />
              <div className="acc-legend"><span><i className="sw senate" />Senate</span><span><i className="sw governor" />Governor</span><span><i className="sw house" />House</span></div></div></div>
          <div className="card"><div className="card-h"><h3>Miss by how close the forecast was</h3><span className="eye">All offices</span></div>
            <div className="acc-tbl"><table className="tbl">
              <thead><tr><th>Forecast margin</th><th className="n">Races</th><th className="n">Called right</th><th className="n">Average miss</th><th className="n">Lean</th><th className="n">Brier</th></tr></thead>
              <tbody>{A.bands.map((b) => <tr key={b.lo}><td>{b.hi >= 99 ? `${b.lo} or more` : `${b.lo} to ${b.hi}`} points</td><td className="n">{b.n}</td><td className="n">{b.share.toFixed(0)}%</td><td className="n">{b.mae.toFixed(1)}</td><td className={`n ${cls(b.bias)}`}>{er(b.bias)}</td><td className="n">{b.brier.toFixed(3)}</td></tr>)}</tbody>
            </table></div></div>
        </div>
      </section>

      <section className="acc-sec" id="calibration">
        <div className="sec-h"><div><p className="eye">Calibration</p><h2>Were the odds honest?</h2>
          <p>A forecast that gives favorites 80 percent should see them win about 80 percent of the time. Dots on the line are honest, dots above it mean the odds were too cautious, dots below mean they were too confident.</p></div></div>
        <div className="acc-grid2">
          <div className="card"><div className="card-h"><h3>Forecast chance against how often favorites won</h3></div>
            <div className="card-b"><Calibration fed={A.calib} leg={LG.calib} />
              <div className="acc-legend"><span><i className="sw fed" />Senate, House and governor</span><span><i className="sw leg" />State legislative districts</span></div></div></div>
          <div className="card"><div className="card-h"><h3>By bin</h3></div>
            <div className="acc-tbl"><table className="tbl">
              <thead><tr><th>Favorite chance</th><th className="n">Federal races</th><th className="n">Favorites won</th><th className="n">Legislative races</th><th className="n">Favorites won</th></tr></thead>
              <tbody>{fc.map((c) => { const l = lc.find((x) => x.lo === c.lo); return (
                <tr key={c.lo}><td>{c.lo} to {c.hi}%</td><td className="n">{c.n}</td><td className="n">{c.won.toFixed(0)}%</td><td className="n">{l ? n(l.n) : ""}</td><td className="n">{l ? `${l.won.toFixed(0)}%` : ""}</td></tr>); })}</tbody>
            </table></div>
            <p className="acc-note card-b">Federal favorites given 60 to 90 percent won {wAvg(midFed, "won").toFixed(0)} percent of {sumN(midFed)} races against {wAvg(midFed, "expected").toFixed(0)} percent expected, so those odds ran cautious. Legislative favorites given 70 to 99 percent won {wAvg(midLeg, "won").toFixed(0)} percent against {wAvg(midLeg, "expected").toFixed(0)} percent, so those ran a little confident.</p>
          </div>
        </div>
      </section>

      <section className="acc-sec" id="map">
        <div className="sec-h"><div><p className="eye">The map of the miss</p><h2>Where the count ran ahead of the forecast</h2>
          <p>Hover a state or district for its forecast, its result and the miss.</p></div></div>
        <AccMap states={stateRows} house={houseRows} />
      </section>

      <section className="acc-sec" id="senate">
        <div className="sec-h"><div><p className="eye">Senate</p><h2>{H.senate.called_right} of {H.senate.races} Senate races called right</h2>
          <p>Sorted from the closest forecast to the safest. Average miss {H.senate.scored?.mae.toFixed(1)} points.</p></div></div>
        <div className="card"><RaceTable rows={sen} /></div>
      </section>

      <section className="acc-sec" id="governor">
        <div className="sec-h"><div><p className="eye">Governors</p><h2>{H.governor.called_right} of {H.governor.races} governor races called right</h2>
          <p>Average miss {H.governor.scored?.mae.toFixed(1)} points.</p></div></div>
        <div className="card"><RaceTable rows={gov} /></div>
      </section>

      <section className="acc-sec" id="house">
        <div className="sec-h"><div><p className="eye">House</p><h2>{H.house.called_right} of {H.house.races} House races called right</h2>
          <p>{C.house.actualD} Democratic seats on the count against {C.house.projD} called by the forecast. Within 10 points the forecast called {H.house.competitive?.right} of {H.house.competitive?.n}, and the lean of the miss there was {er(H.house.competitive?.bias)}.</p></div></div>
        <HouseExplorer rows={house} />
      </section>

      <section className="acc-sec" id="counties">
        <div className="sec-h"><div><p className="eye">Counties</p><h2>{n(CO.all.counties)} counties in {CO.races} statewide races</h2>
          <p>Counties at 95 percent counted or more. The county miss splits in two: the statewide miss every county shares, and the shape miss left after it is taken out, which is the county model on its own.</p></div></div>
        <div className="acc-kpis four">
          <div><span className="l">Vote weighted miss</span><span className="v">{CO.all.wmae.toFixed(1)}</span><span className="s">Points, across {n(CO.all.votes)} votes</span></div>
          <div><span className="l">Shape miss</span><span className="v">{CO.all.shape_mae.toFixed(1)}</span><span className="s">Points, with each race&apos;s statewide miss removed</span></div>
          <div><span className="l">Within 5 points</span><span className="v">{CO.all.within5.toFixed(0)}%</span><span className="s">Of counties, unweighted</span></div>
          <div><span className="l">Lean of the miss</span><span className={`v ${cls(CO.all.bias)}`}>{er(CO.all.bias)}</span><span className="s">Vote weighted</span></div>
        </div>
        <div className="acc-grid2">
          <div className="card"><div className="card-h"><h3>By kind of place and region</h3></div>
            <div className="acc-tbl"><table className="tbl">
              <thead><tr><th>Counties</th><th className="n">Count</th><th className="n">Votes</th><th className="n">Miss</th><th className="n">Shape miss</th><th className="n">Lean</th></tr></thead>
              <tbody>
                {CO.area.map((r) => <tr key={r.k}><td>{r.k}</td><td className="n">{n(r.counties)}</td><td className="n">{(r.votes / 1e6).toFixed(1)}M</td><td className="n">{r.wmae.toFixed(1)}</td><td className="n">{r.shape_mae.toFixed(1)}</td><td className={`n ${cls(r.bias)}`}>{er(r.bias)}</td></tr>)}
                <tr className="sep"><td colSpan={6} /></tr>
                {CO.region.slice().sort((a, b) => a.bias - b.bias).map((r) => <tr key={r.k}><td>{r.k}</td><td className="n">{n(r.counties)}</td><td className="n">{(r.votes / 1e6).toFixed(1)}M</td><td className="n">{r.wmae.toFixed(1)}</td><td className="n">{r.shape_mae.toFixed(1)}</td><td className={`n ${cls(r.bias)}`}>{er(r.bias)}</td></tr>)}
              </tbody>
            </table></div></div>
          <div className="card"><div className="card-h"><h3>The biggest misses in large counties</h3><span className="eye">20,000 votes or more</span></div>
            <div className="acc-tbl"><table className="tbl">
              <thead><tr><th>County</th><th>Race</th><th className="n">Forecast</th><th className="n">Result</th><th className="n">Miss</th></tr></thead>
              <tbody>{CO.worst.map((w) => <tr key={w.race + w.county}><td>{w.county}, {w.st}</td><td><Link href={raceHref(w.race)}>{OFFICE[(w.race.startsWith("sen") ? "senate" : "governor") as Office]}</Link></td><td className={`n ${cls(w.fm)}`}>{mg(w.fm)}</td><td className={`n ${cls(w.act)}`}>{mg(w.act)}</td><td className={`n ${cls(w.err)}`}>{er(w.err)}</td></tr>)}</tbody>
            </table></div></div>
        </div>
        <details className="card acc-more"><summary>County accuracy in every statewide race</summary>
          <div className="acc-tbl"><table className="tbl">
            <thead><tr><th>Race</th><th className="n">Counties</th><th className="n">Miss</th><th className="n">Shape miss</th><th className="n">Lean</th><th className="n">Within 5</th></tr></thead>
            <tbody>{CO.by_race.map((r) => { const race = A.races.find((x) => x.id === r.id); return <tr key={r.id}><td><Link href={raceHref(r.id)}>{race?.name ?? r.id}</Link></td><td className="n">{r.counties}</td><td className="n">{r.wmae.toFixed(1)}</td><td className="n">{r.shape_mae.toFixed(1)}</td><td className={`n ${cls(r.bias)}`}>{er(r.bias)}</td><td className="n">{r.within5.toFixed(0)}%</td></tr>; })}</tbody>
          </table></div>
        </details>
      </section>

      <section className="acc-sec" id="legislatures">
        <div className="sec-h"><div><p className="eye">State legislatures</p><h2>{LG.chambers.right} of {LG.chambers.settled} settled chambers called right</h2>
          <p>{n(LG.called_right)} of {n(LG.called)} legislative seats with a result went to the forecast&apos;s favorite, {n(LG.uncontested)} of them uncontested. Among {n(LG.scored.n)} districts with both parties on the ballot the forecast called {LG.scored.share.toFixed(1)} percent, with an average miss of {LG.scored.mae.toFixed(1)} points.</p></div></div>
        <div className="acc-grid2">
          <div className="card"><div className="card-h"><h3>Lean of the miss by forecast lean</h3><span className="eye">Contested districts</span></div>
            <div className="card-b"><LeanBars rows={LG.lean} /></div></div>
          <div className="card"><div className="card-h"><h3>Chambers the forecast missed or could not settle</h3></div>
            <div className="acc-tbl"><table className="tbl">
              <thead><tr><th>Chamber</th><th className="n">Forecast</th><th className="n">Called seats</th><th className="n">Count</th><th>Status</th></tr></thead>
              <tbody>{LG.chamber_rows.filter((r) => !r.right).map((r) => (
                <tr key={r.id}><td><Link href={`/forecast/legislatures/${r.st.toLowerCase()}/${r.id.split("-")[2]}`}>{r.name}</Link></td><td className="n">{r.fav} {pc(r.favp)}</td><td className="n">{r.cD} D · {r.cR} R</td><td className="n">{r.aD} D · {r.aR} R{r.aO ? ` · ${r.aO} other` : ""}</td>
                  <td>{!r.settled ? <span className="call x">{r.missing ? `${r.missing} ${r.missing === 1 ? "seat" : "seats"} unread` : "No majority yet"}</span> : <span className="call no">Missed</span>}</td></tr>))}</tbody>
            </table></div></div>
        </div>
        <details className="card acc-more"><summary>All {LG.chamber_rows.length} chambers</summary>
          <div className="acc-tbl"><table className="tbl">
            <thead><tr><th>Chamber</th><th className="n">Seats up</th><th className="n">Forecast control</th><th className="n">Called seats</th><th className="n">80% range</th><th className="n">Count</th><th className="n">Seat miss</th><th className="n">Districts right</th><th>Control</th></tr></thead>
            <tbody>{LG.chamber_rows.map((r) => (
              <tr key={r.id} className={r.settled && !r.right ? "miss" : ""}><td><Link href={`/forecast/legislatures/${r.st.toLowerCase()}/${r.id.split("-")[2]}`}>{r.name}</Link></td><td className="n">{r.up} of {r.seats}</td><td className="n">{r.fav} {pc(r.favp)}</td><td className="n">{r.cD} D · {r.cR} R</td><td className="n dim">{r.p10} to {r.p90} D</td>
                <td className="n">{r.aD} D · {r.aR} R{r.aO ? ` · ${r.aO}` : ""}</td><td className="n">{seatMiss(r.seat_err)}</td>
                <td className="n">{r.districts ? `${r.districts.right} of ${r.districts.n}` : ""}</td>
                <td>{!r.settled ? <span className="call x">Not settled</span> : r.right ? <span className="call ok">Right</span> : <span className="call no">Missed</span>}</td></tr>))}</tbody>
          </table></div>
        </details>
        <details className="card acc-more"><summary>Every state, districts called right and the lean of the miss</summary>
          <div className="acc-tbl"><table className="tbl">
            <thead><tr><th>State</th><th className="n">Districts</th><th className="n">Called right</th><th className="n">Average miss</th><th className="n">Lean</th><th className="n">Brier</th></tr></thead>
            <tbody>{LG.states.map((s) => <tr key={s.st}><td>{STATE_NAME[s.st] ?? s.st}</td><td className="n">{s.n}</td><td className="n">{s.share.toFixed(0)}%</td><td className="n">{s.mae.toFixed(1)}</td><td className={`n ${cls(s.bias)}`}>{er(s.bias)}</td><td className="n">{s.brier.toFixed(3)}</td></tr>)}</tbody>
          </table></div>
        </details>
        <details className="card acc-more"><summary>The {upsets5.length} biggest legislative upsets, where the winner had 5 percent or less</summary>
          <div className="acc-tbl"><table className="tbl">
            <thead><tr><th>District</th><th className="n">Forecast</th><th className="n">Winner&apos;s chance</th><th className="n">Result</th><th className="n">Miss</th><th className="n">Counted</th></tr></thead>
            <tbody>{upsets5.map((w) => <tr key={w.ch + w.dist}><td>{STATE_NAME[w.st] ?? w.st} {w.house === "senate" ? "Senate" : "House"} {w.dist}</td><td className={`n ${cls(w.fm)}`}>{mg(w.fm)}</td><td className="n">{w.winner} {(w.wp * 100).toFixed(1)}%</td><td className={`n ${cls(w.am)}`}>{mg(w.am)}</td><td className={`n ${cls(w.err)}`}>{er(w.err)}</td><td className="n dim">{w.pct}%</td></tr>)}</tbody>
          </table></div>
        </details>
      </section>

      <section className="acc-sec" id="lessons">
        <div className="sec-h"><div><p className="eye">What we got wrong</p><h2>The misses, and what they point to for 2028</h2></div></div>
        <div className="acc-grid2 lessons">
          <div className="card card-b"><h3>The statewide races that missed</h3>
            <ul>{fedMisses.map((r) => <li key={r.id}><Link href={raceHref(r.id)}>{r.name}</Link>: forecast {mg(r.fm, r.ind)}, {r.act != null && Math.abs(r.act) < 0.05 ? `${winnerName(r)} leads by a handful of votes` : `${winnerName(r)} ${r.fin ? "won" : "leads"} by ${Math.abs(r.act ?? 0).toFixed(1)}`}{r.fin ? "" : `, ${r.pct}% counted`}.</li>)}</ul>
            <h3>The biggest statewide margin misses</h3>
            <ul>{worstState.map((r) => <li key={r.id}><Link href={raceHref(r.id)}>{r.name}</Link>: {er(r.err, r.ind)} points, forecast {mg(r.fm, r.ind)} and result {mg(r.act, r.ind)}.</li>)}</ul>
          </div>
          <div className="card card-b"><h3>Patterns in the miss</h3>
            <ul>
              <li>Democrats ran ahead of the forecast across the map: the lean of the miss was {er(fed.bias)} in all {fed.n} scored races and {er(H.all.competitive?.bias)} in the {H.all.competitive?.n} within 10 points.</li>
              {safeR ? <li>The pull was strongest where Republicans were safest. In legislative districts the forecast had at R +40 or more, Democrats ran {Math.abs(safeR.bias).toFixed(1)} points ahead on average, even as the forecast still called {safeR.right} of {safeR.n} of them.</li> : null}
              {sw ? <li>The Southwest was the hardest region for the county model: a vote weighted miss of {sw.wmae.toFixed(1)} points and a lean of {er(sw.bias)}.{sub ? ` Suburban counties leaned ${er(sub.bias)}.` : ""}</li> : null}
              <li>The federal odds were cautious in the middle and the legislative odds a little confident at the top, as the calibration chart shows. One spread for every office did not fit both.</li>
              {safeRfed ? <li>In the House races within 10 points, favorites won {safeRfed.fav_won.toFixed(0)} percent against an average forecast chance of {safeRfed.mean_fav.toFixed(0)} percent.</li> : null}
            </ul>
            <h3>What the misses point to</h3>
            <ul>
              <li>Separate spreads for federal and legislative races, each fit to this year&apos;s calibration.</li>
              <li>A regional swing term that can move the Southwest and the South on their own.</li>
              <li>A wider tail for safe seats, where the miss was largest.</li>
              <li>Independent candidates modeled on their own, not as stand in Democrats.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="acc-sec" id="graphics">
        <div className="sec-h"><div><p className="eye">Share it</p><h2>The graphics</h2><p>Open any card for the full size image.</p></div></div>
        <Gallery b={B} />
      </section>

      <section className="acc-sec" id="method">
        <div className="sec-h"><div><p className="eye">Method</p><h2>How the grade is built</h2></div></div>
        <div className="acc-grid2">
          <div className="card card-b acc-prose">
            <p>The forecast side is the frozen copy of the November 3 forecast in <a href={`${FROZEN_DIR}/manifest.json`}>the final forecast archive</a>, the same bytes the site served on Election Day, each file hashed so anyone can check it. The results side is the count from the On Point results desk, read {asofLabel(A.results_asof.federal)} for federal and governor races and {asofLabel(A.results_asof.legislatures)} for legislatures.</p>
            <p>Margins are the Republican share minus the Democratic share of all votes. The miss is the result minus the forecast. A race is called right when the forecast&apos;s favorite, the side with more than half the simulated wins, leads the count. Odds are the published odds, after the November 3 widening of the spread.</p>
            <p>Races still counting are scored on the current count and marked counting. This page is rebuilt as the count finishes, from the same frozen forecast.</p>
            <p>{A.one_party} federal races had only one major party on the count, most of them unopposed, so they count toward calls but not toward margins or odds.</p>
          </div>
          <div className="card card-b acc-prose"><h3>Left out of the margin and odds scores</h3>
            <ul>{A.excluded.map((x) => <li key={x.id}><Link href={raceHref(x.id)}>{x.name}</Link>: {x.why}.</li>)}</ul>
            <p className="dim">Scores built {asofLabel(A.built)}. <a href="/accuracy/2026.json">The full file</a> has every race, county summary, chamber and legislative upset on this page.</p>
          </div>
        </div>
      </section>
        </div>
      </div>
    </div>
  );
}
