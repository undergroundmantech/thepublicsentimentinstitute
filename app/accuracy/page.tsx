import Link from "@/app/components/Link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { raceHref, STATE_NAME } from "@/app/lib/opp";
import { seo } from "@/app/lib/seo";
import AccMap, { type MapRow } from "./AccMap";
import { Calibration, ErrHist, LeanBars, SeatHist } from "./Charts";
import { RaceTable } from "./RaceTable";
import HouseExplorer from "./HouseExplorer";
import SectionNav from "@/app/components/opp/SectionNav";
import JsonLd from "@/app/components/JsonLd";
import { SITE, ORG_ID } from "@/app/lib/seo";
import { PollRanking, SeatTable } from "./Bench";
import { faqLd, getBench, getPolling, rankingLd } from "./bench";
import { asofLabel, calledSeats, seatMiss, cls, er, FROZEN_DIR, getAcc, getManifest, mg, OFFICE, pc, who, winnerName, type Blk, type Office, type Race } from "./data";
import "./acc.css";
import "./fx/fx.css";
import AccFX from "./fx/AccFX";
import BallotScrolly from "./fx/BallotScrolly";
import HTrack from "./fx/HTrack";
import { CallCards, Chapter, Dumbbells, PollRace, SeatMiss, Stats } from "./fx/Story";

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
  { id: "scorecard", label: "Scorecard" }, { id: "calibration", label: "Calibration" }, { id: "map", label: "Map" },
  { id: "senate", label: "Senate" }, { id: "governor", label: "Governors" }, { id: "house", label: "House" }, { id: "counties", label: "Counties" },
  { id: "legislatures", label: "Legislatures" }, { id: "lessons", label: "Lessons" }, { id: "method", label: "Method" },
];
const words = (t: string, from = 0) => t.split(" ").map((w, i) => <span key={i} className="w" style={{ ["--i" as string]: from + i }}>{w}{" "}</span>);
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
  const P = getPolling();
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
    <div className="opp sv acc">
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

      <AccFX />

      <header className="sv-hero" data-par>
        <div className="sv-orbs" aria-hidden="true" data-par><i /><i /><i /></div>
        <p className="eye g">The 2026 accuracy report · count as of {asofLabel(A.results_asof.federal)}</p>
        <h1>{words("The most accurate poll")} <em>{words("in America.", 4)}</em></h1>
        <p className="lede">
          Our final national poll had Democrats up {B.generic.us.margin.toFixed(1)}. The projected final is {B.generic.result.margin.toFixed(1)}.
          Scroll through how the poll and the forecast held up: every pollster, every forecaster, every race we polled, and then every race, county and legislative district against the count.
        </p>
        <div className="sv-cta">
          <Link className="btn g" href="/on-point-polling">Commission a poll</Link>
          <Link className="btn" href="/forecast/2026">The forecast as published</Link>
          <a className="btn" href="/accuracy/2026.json">Download the scores</a>
        </div>
        <div className="sv-cue" aria-hidden="true"><i />Scroll the story</div>
        <Stats items={[
          { k: "Final national poll", to: B.generic.us.margin, dec: 1, pre: "D +", cls: "d", s: `The result: D +${B.generic.result.margin.toFixed(1)}. The averages: D +${B.generic.averages.margin.toFixed(1)}.` },
          { k: "Race winners called", to: H.all.called_right, suf: ` of ${H.all.races}`, s: "Senate, House and governor, by the final forecast" },
          { k: "Chambers called", to: (["senate", "house", "governor"] as Office[]).filter((o) => C[o].right).length, suf: " of 3", cls: "ok", s: "Senate, House and the governors" },
          { k: "Our Senate polls", to: P.summary.senate.mae, dec: 1, suf: " pts", s: `Average miss across the ${P.summary.senate.n} Senate races we polled` },
        ]} />
      </header>

      <Chapter id="poll" eye="The most accurate poll" title={<>A tenth of a point.</>}
        lede={<>Six days out, every major polling average had Democrats ahead by single digits. Our final national survey of {B.generic.us.n.toLocaleString("en-US")} registered voters said thirteen.</>}>
        <BallotScrolly polls={B.national.polls.map((p) => ({ name: p.name, final: p.final, us: p.us }))} us={B.generic.us.margin} result={B.generic.result.margin} averages={B.generic.averages.margin}
          steps={[
            { k: "The averages", t: `The polling averages closed the race near D +${B.generic.averages.margin.toFixed(1)}.` },
            { k: "Our final poll", t: `On Point Polling, October 28: Democrats ${B.generic.us.d.toFixed(1)}, Republicans ${B.generic.us.r.toFixed(1)}. D +${B.generic.us.margin.toFixed(1)}.` },
            { k: "The result", t: `The projected final is D +${B.generic.result.margin.toFixed(1)}. The averages missed by ${(B.generic.result.margin - B.generic.averages.margin).toFixed(1)}. We missed by ${Math.abs(B.generic.us.margin - B.generic.result.margin).toFixed(1)}.` },
            { k: "Every final poll", t: `${B.national.polls.length} pollsters published a final national poll. Here is where every one of them landed.` },
          ]} />
      </Chapter>

      <Chapter id="rankings" eye="The rankings" title={<>Every final national poll, ranked.</>}
        lede={<>Scored on the margin and on each party&apos;s share. Shorter bars are better. On the margin alone, The Honest Poll matched D +13 exactly and we were a tenth off; on the shares, we were closest.</>}>
        <div className="ch-body"><PollRace b={B} limit={12} /></div>
        <details className="card acc-more"><summary>All {B.national.polls.length} final national polls</summary><PollRanking b={B} /></details>
        <p className="bx-src">{B.national.method} The D +{B.generic.result.margin.toFixed(1)} result is the projected final once every vote is counted; the {B.generic.result.counted_votes_m} million votes counted by {B.asof_label} show D +{B.generic.result.counted_margin.toFixed(1)}.</p>
      </Chapter>

      <Chapter id="our-polls" eye="On Point Polling, race by race" title={<>{P.summary.all.right} of {P.summary.all.n} race winners. Every miss shown.</>}
        lede={<>Our final poll in every Senate, governor and House race we polled, against the count. The open dot is the poll, the solid dot is the result. Our Senate polls missed by {P.summary.senate.mae.toFixed(1)} points on average, and {P.summary.senate.within1} of {P.summary.senate.n} landed within a point. Governors were harder: Democrats ran {Math.abs(P.summary.governor.bias).toFixed(1)} points ahead of our final governor polls, and we missed Texas and Kansas.</>}>
        <div className="ch-body"><Dumbbells rows={P.races} /></div>
        <p className="bx-src">Leaned likely voter results from each release, the last one before Election Day in each race. Texas was polled three times; the November 1 poll is scored. The Nebraska poll was sponsored by the Nebraska Democratic Party, which had no role in the questions or the method. Kansas governor and Nebraska 1 were still counting at this read.</p>
      </Chapter>

      <Chapter id="field" eye="The forecast against the field" title={<>The closest seat counts of any forecast.</>}
        lede={<>Every forecast that published final seat numbers, against calls and current leaders as of {B.asof_label}. Shorter bars are better.</>}>
        <div className="ch-body"><SeatMiss b={B} /></div>
        <details className="card acc-more"><summary>Every forecast&apos;s seat counts</summary><SeatTable b={B} /></details>
        <p className="bx-src">{B.seats.note}</p>
        <div className="ch-body">
          <div className="sm-h"><h3>The 10 Senate races that decided the majority</h3><span>{B.senate.rows.length} forecasts</span></div>
          <ol className="bxr sm" data-fx>
            {B.senate.rows.map((r, i) => (
              <li key={r.name} className={r.us ? "us" : ""} style={{ ["--i" as string]: i, ["--w" as string]: (r.right / B.senate.races.length).toFixed(3) }}>
                <span className="nm">{r.name}</span><span className="fn">#{r.rank}</span><span className="br" aria-hidden="true"><i /></span><span className="sc">{r.right} of {B.senate.races.length}</span>
              </li>
            ))}
          </ol>
          <p className="bx-src">{B.senate.note}</p>
        </div>
      </Chapter>

      <Chapter id="calls" eye="What else we got right" title={<>The calls nobody else made.</>}>
        <HTrack label="The calls nobody else made"><CallCards b={B} /></HTrack>
        <p className="bx-src">Mississippi and Kansas: the final On Point forecast against the count on {B.asof_label}, with Mississippi 97 percent counted and not yet called. Other forecasters&apos; ratings from their final pages, maps and videos, November 2 to 3. Safe calls are races the model gave a 95 percent chance or higher.</p>
      </Chapter>

      <Chapter id="chambers-story" eye="Chamber control" title={<>All three chambers, called.</>}
        lede={<>The gold line is the forecast&apos;s seat count, the winner picked in every race plus the seats not up. The white line is the count.</>}>
        <div className="ch-body" id="chambers">
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
        </div>
      </Chapter>

      <div className="audit-h" data-fx>
        <p className="eye">The full audit</p>
        <h2 className="sx-h" style={{ font: "800 clamp(28px,4vw,48px)/1.05 var(--font-d)", letterSpacing: "-.035em", margin: "10px 0 0" }}>Every race, county and district, against the count.</h2>
      </div>
      <div className="fx-body acc-body">
        <SectionNav items={NAV} />
        <div className="acc-main">
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

      <section className="acc-sec" id="method">
        <div className="sec-h"><div><p className="eye">Method</p><h2>How the grade is built</h2></div></div>
        <div className="acc-grid2">
          <div className="card card-b acc-prose">
            <p>The forecast side is the frozen copy of the November 3 forecast in <a href={`${FROZEN_DIR}/manifest.json`}>the final forecast archive</a>, the same bytes the site served on Election Day, each file hashed so anyone can check it. The results side is the count, read {asofLabel(A.results_asof.federal)} for federal and governor races and {asofLabel(A.results_asof.legislatures)} for legislatures.</p>
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
