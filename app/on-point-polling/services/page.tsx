import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { SITE, seo } from "@/app/lib/seo";
import { ENGAGE, GROUPS, SERVICES, quoteHref, svcHref } from "../home/services";
import { AUDIENCES, audHref } from "../home/audiences";
import Proof from "../home/Proof";
import "../home/home.css";

// The full service catalog on one page: every service with when to use it, what arrives and its scope, then the ways
// to buy, the kinds of client and the common questions. Reads home/services.ts like the hub and the service pages.
export const metadata: Metadata = seo({
  title: "Polling services: campaign polls, message testing, tracking and voter modeling",
  description: `Every On Point Polling service in one place: ${SERVICES.slice(0, 8).map((s) => s.name.toLowerCase()).join(", ")} and more, for candidates, party committees, PACs, ballot measures, advocacy groups, media and companies. Fielded on the voter file in 48 to 72 hours.`,
  path: "/on-point-polling/services",
  keywords: ["polling services", "political polling services", "campaign polling", "hire a pollster", "poll for my campaign", "message testing", "tracking poll", "candidate viability poll", "ballot measure poll", "post election poll", "voter modeling", "white label polling", "nonpartisan pollster"],
});

const FAQ = [
  { q: "How much does a poll cost?", a: "Polls are quoted per project on geography, sample size, questionnaire length and cadence. A short district poll costs far less than a long statewide benchmark, and programs cost less per wave than separate polls. Send the scope and you will have a written quote the same day." },
  { q: "How fast can you deliver?", a: "Most polls field in 48 to 72 hours from an approved questionnaire. Message tests, viability studies and autopsies usually take about a week from the first call to the memo." },
  { q: "Do you work with both parties?", a: "Yes. On Point Polling is nonpartisan and works with Democrats, Republicans, independents and nonpartisan clients with the same method. Client work is confidential and never shared with another client." },
  { q: "What size of race can you poll?", a: "Anything from a national poll to a city council ward. Samples come from the voter file for the exact jurisdiction, so small districts can be polled when online panels cannot reach them." },
  { q: "How do you collect responses?", a: "Text to web invitations to registered voters drawn from the L2 voter file, with online panel to fill groups that are hard to reach. Every complete is matched back to its voter record." },
  { q: "What do you deliver?", a: "Leaned likely voter and registered voter toplines, full crosstabs, a written memo and the weighted data, with a walkthrough call. Modeling work adds scores, dashboards or a private County Desk." },
];

export default function Services() {
  const url = `${SITE.url}/on-point-polling/services`;
  return (
    <div className="opp oph oph-page">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span><span>Services</span></nav>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "OfferCatalog", "@id": `${url}#catalog`, name: "On Point Polling services", url, itemListElement: GROUPS.map((g) => ({ "@type": "OfferCatalog", name: g.name, description: g.blurb,
          itemListElement: SERVICES.filter((s) => s.group === g.id).map((s) => ({ "@type": "Offer", url: `${SITE.url}${svcHref(s)}`, itemOffered: { "@type": "Service", "@id": `${SITE.url}${svcHref(s)}#service`, name: s.name, description: s.short, provider: { "@id": `${SITE.url}/on-point-polling#service` } } })) })) },
        { "@type": "FAQPage", mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE.url }, { "@type": "ListItem", position: 2, name: "On Point Polling", item: `${SITE.url}/on-point-polling` }, { "@type": "ListItem", position: 3, name: "Services", item: url }] },
      ] }} />

      <header className="oph-ph">
        <p className="eye">On Point Polling · Services</p>
        <h1>Polling, research and modeling services</h1>
        <p className="lede">{SERVICES.length} services in five practice areas, each with what it answers, what you receive and how long it takes. Buy one study, run a tracking program or hand us a whole cycle.</p>
        <div className="oph-cta-row"><Link className="btn white" href={quoteHref()}>Request a proposal</Link><a className="btn" href="#engage">Ways to work with us</a></div>
        <nav className="oph-jump" aria-label="Practice areas">{GROUPS.map((g) => <a key={g.id} href={`#${g.id}`}>{g.name}</a>)}</nav>
      </header>

      <Proof />

      {GROUPS.map((g) => (
        <section key={g.id} id={g.id} className="oph-sec oph-cat" aria-labelledby={`h-${g.id}`}>
          <div className="oph-sec-h"><p className="eye">Practice area</p><h2 id={`h-${g.id}`}>{g.name}</h2><p>{g.blurb}</p></div>
          {SERVICES.filter((s) => s.group === g.id).map((s) => (
            <article key={s.slug} className="oph-item" id={s.slug}>
              <div className="t">
                <span className="k">{s.kicker}</span>
                <h3><Link href={svcHref(s)}>{s.name}</Link></h3>
                <p>{s.short}</p>
                <p className="for"><b>Built for</b> {s.forWho}</p>
                <div className="oph-cta-row sm"><Link className="btn" href={svcHref(s)}>Full scope</Link><Link className="btn ghost" href={quoteHref({ service: s.slug })}>Get a quote</Link></div>
              </div>
              <div className="c">
                <p className="eye">When to use it</p>
                <ul>{s.when.slice(0, 3).map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
              <div className="c">
                <p className="eye">What you receive</p>
                <ul>{s.deliver.slice(0, 4).map((w) => <li key={w}>{w}</li>)}</ul>
                <dl>{s.scope.slice(0, 2).map((x) => <div key={x.k}><dt>{x.k}</dt><dd>{x.v}</dd></div>)}</dl>
              </div>
            </article>
          ))}
        </section>
      ))}

      <section id="engage" className="oph-sec" aria-labelledby="eng-h">
        <div className="oph-sec-h"><p className="eye">Engagement</p><h2 id="eng-h">Ways to work with us</h2><p>Every engagement is quoted in writing before work starts. Programs cost less per wave than separate studies.</p></div>
        <div className="oph-engage">{ENGAGE.map((e) => (
          <div key={e.name}><h3>{e.name}</h3><p>{e.s}</p><ul>{e.inc.map((i) => <li key={i}>{i}</li>)}</ul><p className="fit"><b>Fits</b> {e.fit}</p></div>
        ))}</div>
      </section>

      <section className="oph-sec" aria-labelledby="aud-h">
        <div className="oph-sec-h"><p className="eye">Clients</p><h2 id="aud-h">Research by kind of client</h2></div>
        <ul className="oph-auds">{AUDIENCES.map((a) => <li key={a.slug}><Link href={audHref(a)}><span className="k">{a.label}</span><h3>{a.title}</h3><span className="more">See the research</span></Link></li>)}</ul>
      </section>

      <section className="oph-sec" aria-labelledby="faq-h">
        <div className="oph-sec-h"><p className="eye">Questions</p><h2 id="faq-h">Buying research from On Point Polling</h2></div>
        <div className="oph-faq">{FAQ.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
      </section>

      <section className="oph-cta">
        <h2>Tell us the decision. We will design the research.</h2>
        <p>Send the race or topic, the geography, your timeline and a budget or sample size. You will have a written proposal and quote the same day.</p>
        <div className="oph-cta-row"><Link className="btn white" href={quoteHref()}>Request a proposal</Link><Link className="btn" href="/on-point-polling/methodology">Read the methodology</Link></div>
      </section>
    </div>
  );
}
