import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { ORG_ID, SITE, seo } from "@/app/lib/seo";
import { PollRanking } from "@/app/accuracy/Bench";
import { dm, faqLd, getBench, getPolling, rankingLd } from "@/app/accuracy/bench";
import { getAcc } from "@/app/accuracy/data";
import AccFX from "@/app/accuracy/fx/AccFX";
import BallotScrolly from "@/app/accuracy/fx/BallotScrolly";
import HTrack from "@/app/accuracy/fx/HTrack";
import { CallCards, Chapter, Dumbbells, PollRace, Stats } from "@/app/accuracy/fx/Story";
import "@/app/accuracy/acc.css";
import "@/app/accuracy/fx/fx.css";

// The landing page for "most accurate pollster": the 2026 ranking of every final national poll against the count, and our
// own polls race by race. Numbers come from public/accuracy/benchmarks-2026.json, polling-2026.json and 2026.json.
export const metadata = seo({
  title: "The most accurate pollsters of 2026, ranked",
  description: "Every final national generic ballot poll of the 2026 midterms, ranked against the D +14.0 count. AtlasIntel was closest at 0.1 points; On Point Polling was second at 0.9 with D +13.1. Every On Point poll scored race by race.",
  path: "/most-accurate-pollster",
  type: "article",
  published: "2026-11-06",
  modified: "2026-11-19",
  ownImage: true,
  keywords: ["most accurate pollster 2026", "most accurate pollsters", "pollster accuracy rankings", "pollster ranking 2026", "2026 generic ballot polls", "On Point Polling", "VT Analytics"],
});

const words = (t: string, from = 0) => t.split(" ").map((w, i) => <span key={i} className="w" style={{ ["--i" as string]: from + i }}>{w}{" "}</span>);

export default function MostAccuratePollster() {
  const B = getBench();
  const A = getAcc();
  const P = getPolling();
  const polls = B.national.polls, g = B.generic;
  return (
    <div className="opp sv acc">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span><span>Pollster ranking</span></nav>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "Article", "@id": `${SITE.url}/most-accurate-pollster#article`, headline: "The most accurate pollsters of 2026, ranked", url: `${SITE.url}/most-accurate-pollster`,
          datePublished: "2026-11-06T08:00:00-05:00", dateModified: "2026-11-19T08:00:00-05:00", image: `${SITE.url}/most-accurate-pollster/opengraph-image.jpg`,
          author: { "@id": ORG_ID }, publisher: { "@id": ORG_ID }, about: ["Opinion poll accuracy", "2026 United States elections"],
          description: `Every final national generic ballot poll against the D +${g.result.margin.toFixed(1)} count. ${polls[0].name} was closest; On Point Polling, at ${dm(g.us.margin)}, was second of ${polls.length}.` },
        rankingLd(B, "/most-accurate-pollster"),
        faqLd(B, [{ q: "How accurate were On Point Polling's state polls in 2026?", a: `On Point Polling's final polls called ${P.summary.all.right} of ${P.summary.all.n} Senate, governor and House race winners in ${P.summary.states} states. Its Senate polls missed the final margin by ${P.summary.senate.mae.toFixed(1)} points on average, with ${P.summary.senate.within1} of ${P.summary.senate.n} within a point.` }]),
      ] }} />
      <AccFX />

      <header className="sv-hero">
        <div className="sv-orbs" aria-hidden="true" data-par><i /><i /><i /></div>
        <p className="eye g">Pollster accuracy · the 2026 midterms</p>
        <h1>{words("Every final poll, against the count.")}</h1>
        <p className="lede">
          The national House vote came in at D +{g.result.margin.toFixed(1)}. {polls[0].name} was closest at {dm(polls[0].final)}, {polls[0].score.toFixed(1)} off.
          On Point Polling&apos;s final national poll had Democrats ahead {g.us.d.toFixed(1)} to {g.us.r.toFixed(1)}, a margin of {g.us.margin.toFixed(1)}: second of {polls.length}, {Math.abs(g.us.margin - g.result.margin).toFixed(1)} off.
        </p>
        <div className="sv-cta">
          <Link className="btn g" href="/on-point-polling">Commission a poll</Link>
          <Link className="btn" href="/accuracy">The full accuracy report</Link>
        </div>
        <Stats items={[
          { k: "Our final national poll", to: g.us.margin, dec: 1, pre: "D +", cls: "d", s: `${g.us.n.toLocaleString("en-US")} registered voters, October 28` },
          { k: "The count", to: g.result.margin, dec: 1, pre: "D +", s: `About 98 percent of the expected vote, ${g.result.asof_label}` },
          { k: "Our miss", to: Math.abs(g.us.margin - g.result.margin), dec: 1, suf: " pts", cls: "ok", s: `Second of ${polls.length}. The averages missed by ${(g.result.margin - g.averages.margin).toFixed(1)}` },
          { k: "Race winners called", to: P.summary.all.right, suf: ` of ${P.summary.all.n}`, s: `By our final state and district polls in ${P.summary.states} states` },
        ]} />
      </header>

      <Chapter id="poll" eye="The final generic ballot" title={<>Where every final poll landed.</>}>
        <BallotScrolly polls={polls.map((p) => ({ name: p.name, final: p.final, us: p.us }))} us={g.us.margin} result={g.result.margin} averages={g.averages.margin}
          steps={[
            { k: "The averages", t: `The polling averages closed near D +${g.averages.margin.toFixed(1)}.` },
            { k: "Our final poll", t: `On Point Polling had Democrats up ${g.us.margin.toFixed(1)}.` },
            { k: "The result", t: `The count is D +${g.result.margin.toFixed(1)}, nine tenths of a point from our poll.` },
            { k: "Every final poll", t: `All ${polls.length} final national polls, side by side. Only ${polls[0].name} landed closer than ours.` },
          ]} />
      </Chapter>

      <Chapter id="ranking" eye="The rankings" title={<>Every final national poll, ranked.</>}
        lede={<>Ranked by each poll&apos;s distance from the count; shorter bars are better. {polls[0].name} was {polls[0].score.toFixed(1)} off, we were {Math.abs(g.us.margin - g.result.margin).toFixed(1)} off, and {polls[2].name} was {polls[2].score.toFixed(1)} off.</>}>
        <div className="ch-body"><PollRace b={B} /></div>
        <details className="card acc-more"><summary>The ranking as a table</summary><PollRanking b={B} /></details>
        <p className="bx-src">{B.national.method} The count is D +{g.result.margin.toFixed(1)}, {g.result.counted_votes_m} million votes as of {g.result.asof_label}, from the {g.result.source}.{B.national.source ? <> Ranking: <a href={B.national.source.url} target="_blank" rel="noopener noreferrer">{B.national.source.name}</a>.</> : null} On Point&apos;s final poll: {g.us.n.toLocaleString("en-US")} registered voters, fielded October 28, 2026, {g.us.note.toLowerCase()}.</p>
      </Chapter>

      <Chapter id="our-polls" eye="Our state and district polls" title={<>{P.summary.all.right} of {P.summary.all.n} race winners, misses included.</>}
        lede={<>Our final poll in each race, against the count. Senate polls missed by {P.summary.senate.mae.toFixed(1)} points on average. Governor polls missed by {P.summary.governor.mae.toFixed(1)}, with Democrats running ahead of them.</>}>
        <div className="ch-body"><Dumbbells rows={P.races} /></div>
      </Chapter>

      <Chapter id="calls" eye="The forecast built on these polls" title={<>{A.headline.all.called_right} of {A.headline.all.races} races, and the calls nobody else made.</>}>
        <HTrack label="The calls nobody else made"><CallCards b={B} /></HTrack>
      </Chapter>

      <Chapter id="faq" eye="Questions" title={<>Who was the most accurate pollster in 2026?</>}>
        <div className="ch-body card card-b acc-prose">
          <p>On the national generic ballot, {polls[0].name}: its final poll had {dm(polls[0].final)} against a count of D +{g.result.margin.toFixed(1)}, {polls[0].score.toFixed(1)} points off. On Point Polling, the polling arm behind On Point Politics, working with VT Analytics, was second of {polls.length}: its final national survey had {dm(g.us.margin)}, {Math.abs(g.us.margin - g.result.margin).toFixed(1)} points off. The polling averages missed by {(g.result.margin - g.averages.margin).toFixed(1)}.</p>
          <p>Every number here is checkable. The forecast that used this polling is <Link href="/forecast/2026">archived exactly as published</Link> on November 3, and <Link href="/accuracy">the accuracy report</Link> scores every race against the count.</p>
          <p><Link href="/on-point-polling">Commission a poll from On Point Polling.</Link></p>
        </div>
      </Chapter>
    </div>
  );
}
