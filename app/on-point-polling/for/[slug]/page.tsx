import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { ORG_ID, SITE, seo } from "@/app/lib/seo";
import { AUDIENCES, audHref } from "../../home/audiences";
import { CONTACT, bySlug, quoteHref, svcHref } from "../../home/services";
import Proof from "../../home/Proof";
import "../../home/home.css";

// One page per kind of client, written for the search a buyer makes: polling for PACs, a pollster for my campaign,
// ballot measure polling. Each page carries Service, FAQ and breadcrumb structured data.
export const dynamicParams = false;
export function generateStaticParams() { return AUDIENCES.map((a) => ({ slug: a.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = AUDIENCES.find((x) => x.slug === slug);
  if (!a) return {};
  return seo({ title: `${a.title} · On Point Polling`, description: a.short, path: audHref(a), keywords: [...a.keywords, "On Point Polling", "nonpartisan pollster"] });
}

export default async function AudiencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = AUDIENCES.find((x) => x.slug === slug);
  if (!a) notFound();
  const url = `${SITE.url}${audHref(a)}`;
  const svcs = a.services.map(bySlug).filter((s) => !!s);
  const others = AUDIENCES.filter((x) => x.slug !== a.slug);
  return (
    <div className="opp oph oph-page">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span><Link href="/on-point-polling/for">Who we work with</Link><span className="sep">/</span><span>{a.name}</span></nav>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "Service", "@id": `${url}#service`, name: a.title, serviceType: "Political polling and survey research", description: a.short, url,
          provider: { "@id": `${SITE.url}/on-point-polling#service` }, areaServed: { "@type": "Country", name: "United States" },
          audience: { "@type": "BusinessAudience", audienceType: a.name },
          hasOfferCatalog: { "@type": "OfferCatalog", name: `Research for ${a.name.toLowerCase()}`, itemListElement: svcs.map((s) => ({ "@type": "Offer", url: `${SITE.url}${svcHref(s)}`, itemOffered: { "@type": "Service", name: s.name, description: s.short } })) } },
        { "@type": "FAQPage", mainEntity: a.faq.map(({ q, a: ans }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: ans } })) },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE.url }, { "@type": "ListItem", position: 2, name: "On Point Polling", item: `${SITE.url}/on-point-polling` }, { "@type": "ListItem", position: 3, name: "Who we work with", item: `${SITE.url}/on-point-polling/for` }, { "@type": "ListItem", position: 4, name: a.name, item: url }] },
        { "@type": "WebPage", "@id": url, url, name: a.title, description: a.short, isPartOf: { "@id": `${SITE.url}/#website` }, publisher: { "@id": ORG_ID } },
      ] }} />

      <header className="oph-ph">
        <p className="eye">On Point Polling · {a.name}</p>
        <h1>{a.title}</h1>
        <p className="lede">{a.intro}</p>
        <div className="oph-cta-row">
          <Link className="btn white" href={quoteHref({ for: a.slug })}>Request a proposal</Link>
          <a className="btn" href="#research">The research we run</a>
        </div>
        <p className="oph-trust">Nonpartisan · Both parties · Client work kept confidential · Fielded in 48 to 72 hours</p>
      </header>

      <Proof />

      <section className="oph-sec" id="research" aria-labelledby="dec-h">
        <div className="oph-sec-h"><p className="eye">The questions you need answered</p><h2 id="dec-h">Each decision, and the research that answers it</h2></div>
        <ul className="oph-dec">
          {a.decisions.map((d) => { const s = bySlug(d.svc)!; return (
            <li key={d.q}><Link href={svcHref(s)}><b>{d.q}</b><span>{s.name}</span><em>{s.short}</em></Link></li>
          ); })}
        </ul>
      </section>

      <section className="oph-sec" aria-labelledby="cyc-h">
        <div className="oph-sec-h"><p className="eye">Across a cycle</p><h2 id="cyc-h">How a program usually runs</h2></div>
        <ol className="oph-cycle">{a.cycle.map((c, i) => <li key={c.t}><span className="n">{String(i + 1).padStart(2, "0")}</span><h3>{c.t}</h3><p>{c.s}</p></li>)}</ol>
      </section>

      <section className="oph-sec" aria-labelledby="svc-h">
        <div className="oph-sec-h"><p className="eye">Services</p><h2 id="svc-h">Services for {a.name}</h2></div>
        <div className="oph-svc-list">
          {svcs.map((s) => (
            <Link key={s.slug} href={svcHref(s)} className="oph-svc">
              <span className="k">{s.kicker}</span>
              <h3>{s.name}</h3>
              <p>{s.short}</p>
              <dl>{s.scope.slice(0, 2).map((x) => <div key={x.k}><dt>{x.k}</dt><dd>{x.v}</dd></div>)}</dl>
              <span className="more">Scope and deliverables</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="oph-sec" aria-labelledby="note-h">
        <div className="oph-sec-h"><p className="eye">Good to know</p><h2 id="note-h">Working with us</h2></div>
        <div className="oph-notes">{a.notes.map((n) => <div key={n.t}><h3>{n.t}</h3><p>{n.s}</p></div>)}</div>
      </section>

      <section className="oph-sec" aria-labelledby="faq-h">
        <div className="oph-sec-h"><p className="eye">Questions</p><h2 id="faq-h">Before you hire a pollster</h2></div>
        <div className="oph-faq">{a.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
      </section>

      <section className="oph-cta">
        <h2>Tell us the race and the deadline.</h2>
        <p>Send the office or issue, the geography, the timeline and a budget or sample size. You will have a written proposal and quote the same day.</p>
        <div className="oph-cta-row">
          <Link className="btn white" href={quoteHref({ for: a.slug })}>Request a proposal</Link>
          <a className="btn" href={`mailto:${CONTACT}?subject=${encodeURIComponent(`Polling for ${a.name}`)}`}>Email {CONTACT}</a>
        </div>
      </section>

      <nav className="oph-also" aria-label="Who else we work with">
        <p className="eye">Also working with</p>
        <ul>{others.map((o) => <li key={o.slug}><Link href={audHref(o)}>{o.name}</Link></li>)}</ul>
      </nav>
    </div>
  );
}
