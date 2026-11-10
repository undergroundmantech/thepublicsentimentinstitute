import fs from "node:fs";
import path from "node:path";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { seo, SITE, ORG_ID } from "@/app/lib/seo";
import "../analysis/analysis.css";

export const metadata = seo({
  title: "About On Point Politics",
  description: "Who publishes On Point Politics, what we cover, how our polls and forecasts are made, how we are funded, and the editorial standards and corrections policy we hold ourselves to.",
  path: "/about",
});

type Acc = { headline: { all: { races: number; called_right: number } } };
type Bench = { generic: { us: { margin: number }; result: { margin: number } }; national: { polls: unknown[] } };
const read = <T,>(p: string): T | null => { try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", p), "utf8")) as T; } catch { return null; } };

export default function Page() {
  const A = read<Acc>("accuracy/2026.json"), B = read<Bench>("accuracy/benchmarks-2026.json");
  return (
    <div className="opp an">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "AboutPage", name: "About On Point Politics", url: `${SITE.url}/about`, about: { "@id": ORG_ID }, publisher: { "@id": ORG_ID } }} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>About</span></nav>
      <article className="an-art">
        <header className="ph">
          <div className="eye g">About us</div>
          <h1>About <em>On Point Politics</em></h1>
          <p className="lede">
            On Point Politics is a nonpartisan election site built on original polling. We publish polling averages, election forecasts, live results and analysis,
            and we score every forecast we make against the final count, in public.
          </p>
        </header>
        <div className="an-prose">
          <h2>Who we are</h2>
          <p>
            On Point Politics is published by <b>On Point Polling</b>, the trade name of The Public Sentiment Institute, a survey research firm based in Miami, Florida.
            On Point Polling fields national and state polls for its own releases and for clients, and the same data, methods and people that produce those polls produce
            the forecasts and analysis on this site.
          </p>
          <p>
            We are nonpartisan. On Point Polling works with Democrats, Republicans, independents, nonprofits, newsrooms and companies, and it uses one method for every client.
            The site does not endorse candidates, does not take positions on ballot measures and does not accept payment to publish or change any poll, forecast or story.
          </p>

          <h2>What we publish</h2>
          <ul>
            <li><b>Polls.</b> On Point Polling releases with full toplines, crosstabs, sample sizes and field dates, on the <Link href="/on-point-polling/polls">poll releases</Link> page.</li>
            <li><b>Polling averages.</b> National and race by race averages of every public poll, weighted by sample size, recency, voter screen and pollster record. See <Link href="/polls">polls</Link>.</li>
            <li><b>Forecasts.</b> Probabilistic models for the Senate, House, governors, state legislatures and ballot measures, and now the <Link href="/forecast/2028">2028 presidential race</Link>, with the full method on the <Link href="/forecast/methodology">methodology page</Link>.</li>
            <li><b>Results.</b> Live results on election nights and an archive of past results, beside the forecast for each race.</li>
            <li><b>Analysis.</b> Long form pieces that explain what the numbers mean and where we were wrong, on the <Link href="/analysis">analysis desk</Link>.</li>
            <li><b>Tools.</b> Interactive tools such as the <Link href="/what-if">What If map</Link>, the <Link href="/swingometer">swingometer</Link> and <Link href="/play">Campaign 2028</Link>, a strategy game played on the forecast&apos;s own data.</li>
          </ul>

          <h2>Our record</h2>
          <p>
            {B ? <>Our final national poll of the 2026 midterms had Democrats ahead by {B.generic.us.margin.toFixed(1)} points on the generic ballot. The projected national House vote is D +{B.generic.result.margin.toFixed(1)}. </> : null}
            {A ? <>Our final forecast, frozen before polls closed on November 3, picked the winner in {A.headline.all.called_right} of {A.headline.all.races} Senate, House and governor races and the party that won the Senate, the House and the governorships. </> : null}
            Every race is scored, misses included, in the <Link href="/accuracy">2026 accuracy report</Link>, and the forecast as it stood on Election Day is preserved on the <Link href="/forecast/2026">as published</Link> page so it can be checked against what we said.
          </p>

          <h2 id="standards">Editorial standards</h2>
          <ul>
            <li><b>Original data first.</b> Our forecasts and analysis rest on our own polling and our own models. When we use another organization&apos;s poll or result we name it and link to it.</li>
            <li><b>Show the method.</b> Every forecast page explains how its number is built, and our methodology pages describe the weighting, likely voter screens and simulations in detail.</li>
            <li><b>Grade ourselves.</b> We publish our errors with the same prominence as our successes.</li>
            <li><b>No paid placement.</b> Clients can commission polls, but they cannot buy a release, a rating or a forecast change. Commissioned polls are labeled with their sponsor.</li>
            <li><b>Partisan polls are labeled.</b> Polls sponsored by campaigns or parties, and firms that mainly work for one party, are flagged and adjusted in our averages.</li>
          </ul>

          <h2 id="corrections">Corrections</h2>
          <p>
            When we get a fact wrong we fix it and say so on the page, with the date of the correction. Model changes are logged in the <Link href="/forecast/changelog">forecast changelog</Link>.
            To report an error, email <a href="mailto:onpointpoliticscontact@gmail.com">onpointpoliticscontact@gmail.com</a>.
          </p>

          <h2>How we are funded</h2>
          <p>
            On Point Politics is funded by On Point Polling&apos;s client work, by subscribers to <Link href="/on-point-polling/weighting-room">The Weighting Room</Link>, our polling community,
            and by advertising. Advertising is served by third parties such as Google and is kept separate from editorial decisions. Advertisers have no say in what we publish.
            Our <Link href="/privacy">privacy policy</Link> explains how advertising cookies work on this site and how to opt out.
          </p>

          <h2>Contact</h2>
          <p>
            For questions, corrections, press requests or to commission a poll, use the <Link href="/contact">contact page</Link> or email <a href="mailto:onpointpoliticscontact@gmail.com">onpointpoliticscontact@gmail.com</a>.
            Poll quotes are on the <Link href="/on-point-polling">On Point Polling</Link> page.
          </p>
        </div>
      </article>
    </div>
  );
}
