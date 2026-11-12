import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { SITE, seo } from "@/app/lib/seo";
import { getBench } from "@/app/accuracy/bench";
import Clip from "../../home/Clip";
import { GROUPS, SERVICES, mailto, svcHref } from "../../home/services";
import "../../home/home.css";

// One page per service, so each service can rank for the words buyers use: what it is, what arrives, scope, process,
// questions and related services, with Service, FAQ and breadcrumb structured data.
export const dynamicParams = false;
export function generateStaticParams() { return SERVICES.map((s) => ({ slug: s.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = SERVICES.find((x) => x.slug === slug);
  if (!s) return {};
  return seo({ title: `${s.name} · On Point Polling`, description: `${s.short} ${s.scope.map((x) => `${x.k}: ${x.v}.`).join(" ")}`, path: svcHref(s), keywords: [...s.keywords, "On Point Polling"] });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = SERVICES.find((x) => x.slug === slug);
  if (!s) notFound();
  const g = getBench().generic;
  const url = `${SITE.url}${svcHref(s)}`;
  const group = GROUPS.find((x) => x.id === s.group)!;
  const related = SERVICES.filter((x) => x.slug !== s.slug && x.group === s.group).concat(SERVICES.filter((x) => x.group !== s.group)).slice(0, 3);
  return (
    <div className="opp oph oph-page">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span><Link href="/on-point-polling#services">Services</Link><span className="sep">/</span><span>{s.name}</span></nav>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "Service", "@id": `${url}#service`, name: s.name, serviceType: s.kicker, description: s.intro, url, areaServed: { "@type": "Country", name: "United States" },
          provider: { "@id": `${SITE.url}/on-point-polling#service` }, audience: { "@type": "Audience", audienceType: s.forWho },
          hasOfferCatalog: { "@type": "OfferCatalog", name: `${s.name} deliverables`, itemListElement: s.deliver.map((d) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: d } })) },
          ...(s.media ? { subjectOf: { "@type": "VideoObject", name: s.media.label, description: s.media.alt, thumbnailUrl: `${SITE.url}${s.media.poster}`, contentUrl: `${SITE.url}${s.media.src}.mp4`, uploadDate: "2026-11-12" } } : {}) },
        { "@type": "FAQPage", mainEntity: s.faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE.url }, { "@type": "ListItem", position: 2, name: "On Point Polling", item: `${SITE.url}/on-point-polling` }, { "@type": "ListItem", position: 3, name: s.name, item: url }] },
      ] }} />
      <header className="oph-ph">
        <p className="eye">{group.name} · {s.kicker}</p>
        <h1>{s.name}</h1>
        <p className="lede">{s.intro}</p>
        <div className="oph-cta-row"><a className="btn white" href={mailto(`${s.name} quote`)}>Request a quote</a><Link className="btn" href="/on-point-polling#services">All services</Link></div>
      </header>
      <div className="oph-detail">
        <div className="main">
          {s.media ? <Clip m={s.media} priority /> : null}
          <section><h2>What you get</h2><ul className="oph-check">{s.deliver.map((d) => <li key={d}>{d}</li>)}</ul></section>
          <section><h2>How it works</h2><ol className="oph-steps compact">{s.how.map((h, i) => <li key={h}><span className="n">{i + 1}</span><h3>{h}</h3></li>)}</ol></section>
          <section><h2>Questions</h2><div className="oph-faq">{s.faq.map((f) => <details key={f.q} open><summary>{f.q}</summary><p>{f.a}</p></details>)}</div></section>
        </div>
        <aside className="side">
          <div className="oph-box"><p className="eye">Scope</p><dl>{s.scope.map((x) => <div key={x.k}><dt>{x.k}</dt><dd>{x.v}</dd></div>)}</dl></div>
          <div className="oph-box"><p className="eye">Built for</p><p>{s.forWho}</p></div>
          <div className="oph-box"><p className="eye">Track record</p><p>Our final 2026 national poll was D +{g.us.margin.toFixed(1)} against a D +{g.result.margin.toFixed(1)} result, the closest final national poll of the midterms. <Link href="/accuracy">The accuracy report</Link></p></div>
          <div className="oph-box"><p className="eye">Related services</p><ul className="oph-rel">{related.map((r) => <li key={r.slug}><Link href={svcHref(r)}>{r.name}</Link></li>)}</ul></div>
        </aside>
      </div>
    </div>
  );
}
