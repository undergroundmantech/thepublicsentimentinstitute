import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { SITE, seo } from "@/app/lib/seo";
import { getBench } from "@/app/accuracy/bench";
import Clip from "../../home/Clip";
import Proof from "../../home/Proof";
import { GROUPS, SERVICES, quoteHref, svcHref } from "../../home/services";
import { AUDIENCES, audHref } from "../../home/audiences";
import "../../home/home.css";

// One page per service, so each service can rank for the words buyers use: what it is, when to use it, what arrives,
// how the work is done, scope, process, questions and who buys it, with Service, FAQ and breadcrumb structured data.
export const dynamicParams = false;
export function generateStaticParams() { return SERVICES.map((s) => ({ slug: s.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = SERVICES.find((x) => x.slug === slug);
  if (!s) return {};
  return seo({ title: `${s.name} · On Point Polling`, description: `${s.short} ${s.scope.slice(0, 3).map((x) => `${x.k}: ${x.v}.`).join(" ")}`, path: svcHref(s), keywords: [...s.keywords, "On Point Polling", "nonpartisan pollster"] });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = SERVICES.find((x) => x.slug === slug);
  if (!s) notFound();
  const B = getBench(), g = B.generic;
  const rank = B.national.polls.findIndex((p) => p.us) + 1;
  const url = `${SITE.url}${svcHref(s)}`;
  const group = GROUPS.find((x) => x.id === s.group)!;
  const related = SERVICES.filter((x) => x.slug !== s.slug && x.group === s.group).concat(SERVICES.filter((x) => x.group !== s.group)).slice(0, 4);
  const buyers = AUDIENCES.filter((a) => a.services.includes(s.slug));
  const faq = [...s.faq,
    { q: `How much does ${s.name.toLowerCase()} cost?`, a: "Every project is quoted in writing on its geography, sample size, length and timeline before any work starts. Programs cost less per wave than separate studies. Send the scope and you will have a quote the same day." },
    { q: "Is our work kept confidential?", a: "Yes. Client work is never shared with another client, and nothing is published unless you choose to release it, in which case the sponsor is named." },
  ];
  return (
    <div className="opp oph oph-page">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span><Link href="/on-point-polling/services">Services</Link><span className="sep">/</span><span>{s.name}</span></nav>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "Service", "@id": `${url}#service`, name: s.name, serviceType: s.kicker, category: group.name, description: s.intro, url, areaServed: { "@type": "Country", name: "United States" },
          provider: { "@id": `${SITE.url}/on-point-polling#service` }, audience: { "@type": "BusinessAudience", audienceType: s.forWho },
          offers: { "@type": "Offer", url: `${SITE.url}${quoteHref({ service: s.slug })}`, availability: "https://schema.org/InStock", priceSpecification: { "@type": "PriceSpecification", priceCurrency: "USD", description: "Quoted per project" } },
          hasOfferCatalog: { "@type": "OfferCatalog", name: `${s.name} deliverables`, itemListElement: s.deliver.map((d) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: d } })) },
          ...(s.media ? { subjectOf: { "@type": "VideoObject", name: s.media.label, description: s.media.alt, thumbnailUrl: `${SITE.url}${s.media.poster}`, contentUrl: `${SITE.url}${s.media.src}.mp4`, uploadDate: "2026-11-12" } } : {}) },
        { "@type": "FAQPage", mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE.url }, { "@type": "ListItem", position: 2, name: "On Point Polling", item: `${SITE.url}/on-point-polling` }, { "@type": "ListItem", position: 3, name: "Services", item: `${SITE.url}/on-point-polling/services` }, { "@type": "ListItem", position: 4, name: s.name, item: url }] },
      ] }} />
      <header className="oph-ph">
        <p className="eye">{group.name} · {s.kicker}</p>
        <h1>{s.name}</h1>
        <p className="lede">{s.intro}</p>
        <div className="oph-cta-row"><Link className="btn white" href={quoteHref({ service: s.slug })}>Request a quote</Link><Link className="btn" href="/on-point-polling/services">All services</Link></div>
      </header>
      <div className="oph-detail">
        <div className="main">
          {s.media ? <Clip m={s.media} priority /> : null}
          <section><h2>When to use it</h2><ul className="oph-when">{s.when.map((w) => <li key={w}>{w}</li>)}</ul></section>
          <section><h2>What you get</h2><ul className="oph-check">{s.deliver.map((d) => <li key={d}>{d}</li>)}</ul></section>
          <section><h2>How the work is done</h2><p className="oph-prose">{s.method}</p><p className="oph-prose"><Link href="/on-point-polling/methodology">Read the full methodology</Link></p></section>
          <section><h2>How a project runs</h2><ol className="oph-steps compact">{s.how.map((h, i) => <li key={h}><span className="n">{i + 1}</span><h3>{h}</h3></li>)}</ol></section>
          <section><h2>Questions</h2><div className="oph-faq">{faq.map((f, i) => <details key={f.q} open={i < 2}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div></section>
        </div>
        <aside className="side">
          <div className="oph-box"><p className="eye">Scope</p><dl>{s.scope.map((x) => <div key={x.k}><dt>{x.k}</dt><dd>{x.v}</dd></div>)}</dl></div>
          <div className="oph-box"><p className="eye">Built for</p><p>{s.forWho}</p>{buyers.length ? <ul className="oph-rel">{buyers.map((a) => <li key={a.slug}><Link href={audHref(a)}>{a.title}</Link></li>)}</ul> : null}</div>
          <div className="oph-box"><p className="eye">Track record</p><p>Our final 2026 national poll was D +{g.us.margin.toFixed(1)} against a D +{g.result.margin.toFixed(1)} count, {rank === 1 ? "the closest" : `number ${rank}`} of {B.national.polls.length} final national polls. <Link href="/accuracy">The accuracy report</Link></p></div>
          <div className="oph-box"><p className="eye">Related services</p><ul className="oph-rel">{related.map((r) => <li key={r.slug}><Link href={svcHref(r)}>{r.name}</Link></li>)}</ul></div>
          <Link className="btn white oph-side-cta" href={quoteHref({ service: s.slug })}>Request a quote</Link>
        </aside>
      </div>
      <Proof />
    </div>
  );
}
