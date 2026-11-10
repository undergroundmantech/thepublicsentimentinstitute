import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { seo, SITE, ORG_ID } from "@/app/lib/seo";
import { ARTICLES, fmtDate } from "./lib";
import "./analysis.css";

export const metadata = seo({
  title: "Analysis: elections explained with our own polls and forecasts",
  description: "Long form analysis from On Point Politics: the 2028 presidential race, who turns out, how the 2026 forecast did against the count, and how to read an election probability.",
  path: "/analysis",
});

export default function Page() {
  const [lead, ...rest] = ARTICLES;
  return (
    <div className="opp an">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "On Point Politics analysis", url: `${SITE.url}/analysis`, publisher: { "@id": ORG_ID },
        hasPart: ARTICLES.map((a) => ({ "@type": "Article", headline: a.title, url: `${SITE.url}/analysis/${a.slug}`, datePublished: a.published })) }} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>Analysis</span></nav>
      <header className="ph">
        <div className="eye g">The analysis desk</div>
        <h1>Elections, <em>explained with our own numbers</em></h1>
        <p className="lede">
          Every piece here is written by On Point Politics from data we collect or build ourselves: On Point Polling surveys, the national respondent database behind them,
          our forecast models and our scored record against the count. Charts and tables elsewhere on the site show the numbers. These pieces explain what they mean,
          where we were wrong, and what we are watching next.
        </p>
      </header>
      <Link href={`/analysis/${lead.slug}`} className="card an-lead"><span className="eye">{lead.tag} · {fmtDate(lead.published)} · {lead.read} minute read</span><b>{lead.title}</b><small>{lead.dek}</small></Link>
      <div className="an-grid">{rest.map((x) => (
        <Link key={x.slug} href={`/analysis/${x.slug}`} className="card an-card"><span className="eye">{x.tag} · {fmtDate(x.published)} · {x.read} minute read</span><b>{x.title}</b><small>{x.dek}</small></Link>
      ))}</div>
      <section className="an-art">
        <div className="an-prose">
          <h2>Where the numbers come from</h2>
          <p>
            On Point Politics is published by On Point Polling, a nonpartisan survey firm that works for clients in both parties. The forecasts on this site run on that polling,
            on the full respondent database from every national wave, on certified election results back to 2000 and on voter file benchmarks for every state. When a piece cites
            a number, the same number is on a forecast, polling or accuracy page you can check, and the underlying files are public. Our method pages explain each model:
            the <Link href="/forecast/methodology">forecast methodology</Link>, the <Link href="/on-point-polling/methodology">polling methodology</Link> and
            the <Link href="/accuracy">2026 accuracy report</Link>, which scores every race we forecast against the result.
          </p>
        </div>
      </section>
    </div>
  );
}
