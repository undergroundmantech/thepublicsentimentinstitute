import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { SITE, seo } from "@/app/lib/seo";
import { AUDIENCES, audHref } from "../home/audiences";
import { quoteHref } from "../home/services";
import Proof from "../home/Proof";
import "../home/home.css";

export const metadata: Metadata = seo({
  title: "Who On Point Polling works with: candidates, parties, PACs and more",
  description: "On Point Polling is a nonpartisan polling firm for candidates and campaigns, party committees, PACs and super PACs, ballot measure committees, advocacy groups, newsrooms, companies and consultants. See the research each one hires us for.",
  path: "/on-point-polling/for",
  keywords: ["pollster for campaigns", "polling for PACs", "party committee polling", "ballot measure polling", "advocacy polling", "media poll", "public affairs polling", "white label polling", "nonpartisan polling firm"],
});

export default function WhoWeWorkWith() {
  const url = `${SITE.url}/on-point-polling/for`;
  return (
    <div className="opp oph oph-page">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span><span>Who we work with</span></nav>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "ItemList", "@id": `${url}#list`, name: "Who On Point Polling works with", itemListElement: AUDIENCES.map((a, i) => ({ "@type": "ListItem", position: i + 1, name: a.title, url: `${SITE.url}${audHref(a)}` })) },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE.url }, { "@type": "ListItem", position: 2, name: "On Point Polling", item: `${SITE.url}/on-point-polling` }, { "@type": "ListItem", position: 3, name: "Who we work with", item: url }] },
      ] }} />
      <header className="oph-ph">
        <p className="eye">On Point Polling · Clients</p>
        <h1>One method for every client, in both parties.</h1>
        <p className="lede">Candidates, party committees, PACs, ballot measure campaigns, advocacy groups, newsrooms, companies and other consultants all hire the same voter file fieldwork and weighting. What changes is the decision the research has to serve. Pick yours.</p>
        <div className="oph-cta-row"><Link className="btn white" href={quoteHref()}>Request a proposal</Link><Link className="btn" href="/on-point-polling/services">All services</Link></div>
      </header>
      <Proof />
      <ul className="oph-auds big">
        {AUDIENCES.map((a) => (
          <li key={a.slug}><Link href={audHref(a)}><span className="k">{a.label}</span><h2>{a.title}</h2><p>{a.short}</p><span className="more">See the research</span></Link></li>
        ))}
      </ul>
    </div>
  );
}
