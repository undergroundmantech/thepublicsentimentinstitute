import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { ORG_ID, SITE, seo } from "@/app/lib/seo";
import { Calls, Gallery, GenericTrio, PollRanking, SeatTable } from "@/app/accuracy/Bench";
import { dm, faqLd, getBench, rankingLd } from "@/app/accuracy/bench";
import { getAcc } from "@/app/accuracy/data";
import "@/app/accuracy/acc.css";

// The landing page for "most accurate pollster": the 2026 ranking of every final national poll, with the forecast's
// record beside it. The numbers come from public/accuracy/benchmarks-2026.json and public/accuracy/2026.json.
export const metadata = seo({
  title: "The most accurate pollster of 2026",
  description: "On Point Polling was the most accurate pollster of the 2026 midterms: a final national poll of D +13.1 against a D +13.0 result, first of 42 final national polls on margin and vote share. Every pollster ranked.",
  path: "/most-accurate-pollster",
  type: "article",
  published: "2026-11-06",
  modified: "2026-11-06",
  ownImage: true,
  keywords: ["most accurate pollster", "most accurate pollster 2026", "most accurate pollster in America", "most accurate poll 2026", "best pollster 2026", "pollster accuracy rankings", "2026 generic ballot polls", "On Point Polling", "VT Analytics"],
});

export default function MostAccuratePollster() {
  const B = getBench();
  const A = getAcc();
  const P = B.national.polls, us = P[0], g = B.generic;
  const allRight = (["senate", "house", "governor"] as const).every((o) => A.chambers[o].right);
  return (
    <div className="opp acc">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/accuracy">2026 accuracy</Link><span className="sep">/</span><span>Most accurate pollster</span></nav>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "Article", "@id": `${SITE.url}/most-accurate-pollster#article`, headline: "The most accurate pollster of 2026", url: `${SITE.url}/most-accurate-pollster`,
          datePublished: "2026-11-06T08:00:00-05:00", dateModified: "2026-11-06T08:00:00-05:00", image: `${SITE.url}/most-accurate-pollster/opengraph-image.jpg`,
          author: { "@id": ORG_ID }, publisher: { "@id": ORG_ID }, about: ["Opinion poll accuracy", "2026 United States elections"],
          description: `On Point Polling's final national poll had Democrats up ${g.us.margin.toFixed(1)} against a D +${g.result.margin.toFixed(1)} result, first of ${P.length} final national polls.` },
        rankingLd(B, "/most-accurate-pollster"),
        faqLd(B),
      ] }} />

      <header className="acc-hero">
        <p className="eye g">Pollster accuracy · 2026 midterms</p>
        <h1>The most accurate pollster of 2026: <em>On Point Polling</em>.</h1>
        <p className="lede">
          Our final national poll had Democrats ahead {g.us.d.toFixed(1)} to {g.us.r.toFixed(1)}, a margin of {g.us.margin.toFixed(1)}. The projected final is D +{g.result.margin.toFixed(1)}.
          Scored on both the margin and the party shares, that puts On Point Polling first of {P.length} final national polls, with a score of {us.score.toFixed(2)} against {P[1].score.toFixed(2)} for the next closest. The polling averages finished near D +{g.averages.margin.toFixed(1)}.
        </p>
        <div className="acc-cta">
          <Link className="btn g" href="/accuracy">The full accuracy report</Link>
          <Link className="btn" href="/forecast/2026">The forecast as published</Link>
          <Link className="btn" href="/on-point-polling">About On Point Polling</Link>
        </div>
      </header>

      <GenericTrio b={B} />

      <section className="acc-sec" id="ranking">
        <div className="sec-h"><div><p className="eye">Every final national poll, ranked</p><h2>{P.length} final national polls</h2>
          <p>Each pollster&apos;s last national generic ballot before Election Day. Lower scores are better.</p></div></div>
        <div className="card"><PollRanking b={B} /></div>
        <p className="bx-src">{B.national.method} On the margin alone The Honest Poll matched D +13 exactly and On Point was 0.1 off; most pollsters publish whole numbers. The D +{g.result.margin.toFixed(1)} result is the projected final once every vote is counted; the {g.result.counted_votes_m} million votes counted by {B.asof_label} show D +{g.result.counted_margin.toFixed(1)}. On Point&apos;s final poll: {g.us.n.toLocaleString("en-US")} registered voters, fielded {new Date(g.us.field + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}, {g.us.note.toLowerCase()}.</p>
      </section>

      <section className="acc-sec" id="forecast">
        <div className="sec-h"><div><p className="eye">The forecast, too</p><h2>{A.headline.all.called_right} of {A.headline.all.races} races called right{allRight ? ", and all three chambers" : ""}</h2>
          <p>The same polling fed the On Point forecast, which gave the closest final seat counts of any forecast that published them.</p></div></div>
        <div className="card"><SeatTable b={B} /></div>
        <p className="bx-src">{B.seats.note}</p>
      </section>

      <section className="acc-sec" id="calls">
        <div className="sec-h"><div><p className="eye">What else we got right</p><h2>The calls nobody else made</h2></div></div>
        <Calls b={B} />
      </section>

      <section className="acc-sec" id="faq">
        <div className="sec-h"><div><p className="eye">Questions</p><h2>Who was the most accurate pollster in 2026?</h2></div></div>
        <div className="card card-b acc-prose">
          <p>On Point Polling, the polling arm behind On Point Politics. Its final national survey had the generic ballot at {dm(g.us.margin)}, against a projected final of D +{g.result.margin.toFixed(1)}, and ranked first of {P.length} final national polls on margin and vote share.</p>
          <p>Every number on this page is checkable. The forecast that used this polling is <Link href="/forecast/2026">archived exactly as published</Link> on November 3, with a fingerprint for every file, and <Link href="/accuracy">the accuracy report</Link> scores every race against the count.</p>
        </div>
      </section>

      <section className="acc-sec" id="graphics">
        <div className="sec-h"><div><p className="eye">Share it</p><h2>The graphics</h2></div></div>
        <Gallery b={B} />
      </section>
    </div>
  );
}
