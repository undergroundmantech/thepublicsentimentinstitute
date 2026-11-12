import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { PollingLockup } from "@/app/components/opp/PollingLogo";
import { ORG_ID, SITE, seo } from "@/app/lib/seo";
import { getBench, getPolling } from "@/app/accuracy/bench";
import AccFX from "@/app/accuracy/fx/AccFX";
import { Chapter, PollRace, Stats } from "@/app/accuracy/fx/Story";
import PolledMap from "./home/PolledMap";
import Needle from "./home/Needle";
import Clip from "./home/Clip";
import { GROUPS, MEDIA, PARTNERS, SERVICES, CONTACT, mailto, svcHref } from "./home/services";
import "@/app/accuracy/acc.css";
import "@/app/accuracy/fx/fx.css";
import "./home/home.css";

// On Point Polling's front door for buyers who search for a pollster: what we do, the proof, the tools, the method and
// how to start. Services come from home/services.ts and every number from the accuracy files, so the hub, the service
// pages and the accuracy report always agree.
const URL = `${SITE.url}/on-point-polling`;
const SVC_ID = `${URL}#service`;

export const metadata: Metadata = seo({
  title: "On Point Polling: nonpartisan polling firm and election analytics",
  description: "On Point Polling is a nonpartisan polling firm with the most accurate final national poll of 2026: D +13.1 against a D +13.0 result. One time polls, monthly and quarterly tracking, message testing, county by county election simulations, likely voter modeling and a weighting dashboard. Statewide, district and national polls fielded in 48 to 72 hours.",
  path: "/on-point-polling",
  ownImage: true,
  keywords: ["On Point Polling", "polling firm", "political polling firm", "nonpartisan pollster", "hire a pollster", "polling services", "campaign polling", "most accurate pollster 2026", "tracking poll", "message testing", "county level election forecast", "election simulation", "likely voter model", "MRP", "survey weighting", "voter file polling", "text to web survey", "statewide poll", "district poll", "national poll"],
});

const STAGES = [
  { t: "Build the electorate", s: "Weight to the registered population on the state voter file: age and gender always, race and education where the sample supports it, region where every mode carries geography." },
  { t: "Likely voter model", s: "An engagement score from intention, ballot method and close contacts, and a history score from validated participation, combined into one probability of voting." },
  { t: "Meridian allocation", s: "Undecided voters are leaned on how they answer the survey, never on demographics alone or on how they voted last time." },
  { t: "Turnout projection", s: "Turnout follows from the fitted likely voter curve, bounded by the voter file, past turnout in the same kind of election and ballots already cast." },
];
const RULES = ["Pre registration", "Stated preference never reassigned", "Anomalies tested before corrected", "Reference data matches the instrument", "Unadjusted estimate kept as a control", "Independence of funding disclosed", "Post election accounting published"];
const WHO = ["Campaigns and candidates", "Party committees and PACs", "Ballot measure campaigns", "Advocacy and nonprofit groups", "Newsrooms and media", "Companies and public affairs"];
const STEPS = [
  { t: "Scope call", s: "Thirty minutes on the decision, the questions and the deadline. A written quote the same day." },
  { t: "Design", s: "The questionnaire, the voter file universe, quotas and weighting targets, agreed before field." },
  { t: "Fieldwork", s: "Text to web on the voter file, with online panel to fill hard to reach groups. Usually 48 to 72 hours." },
  { t: "Delivery", s: "Leaned toplines, crosstabs, a memo and dashboard access, with a call to walk through it." },
];

export default function OnPointPolling() {
  const B = getBench();
  const P = getPolling();
  const g = B.generic, S = P.summary;
  const FAQ: { q: string; a: string }[] = [
    { q: "How accurate is On Point Polling?", a: `On Point Polling's final 2026 national poll had Democrats ahead by ${g.us.margin.toFixed(1)} points against a projected final of D +${g.result.margin.toFixed(1)}, the closest final national poll of the midterms. Its final state polls called ${S.senate.right} of ${S.senate.n} Senate winners with an average miss of ${S.senate.mae.toFixed(1)} points. Every poll is scored in the public accuracy report, misses included.` },
    { q: "What services does On Point Polling offer?", a: `${SERVICES.map((s) => s.name).join(", ")}.` },
    { q: "Is On Point Polling partisan?", a: "No. On Point Polling is nonpartisan and polls for Democrats, Republicans, independents, ballot measures, newsrooms and companies with the same method for every client. Sponsors of public releases are disclosed." },
    { q: "How fast can you field a poll?", a: "Most polls field in 48 to 72 hours from an approved questionnaire, with toplines and crosstabs delivered shortly after." },
    { q: "How much does a poll cost?", a: "Polls are quoted per project on geography, sample size, questionnaire length and cadence. Send the scope and you will have a written quote the same day." },
    { q: "Who are On Point Polling's data partners?", a: `${PARTNERS.map((p) => `${p.name}, ${p.role.toLowerCase()}`).join("; ")}.` },
    { q: "Are your dashboards public?", a: "No. The County Desk and the Weighting Dashboard are delivered privately to clients. The clips on this page use illustrative data." },
    { q: "How do I start a project?", a: `Email ${CONTACT} with the race or topic, the geography, the timeline and a budget or sample size.` },
  ];
  const vid = (m: typeof MEDIA.desk, name: string) => ({ "@type": "VideoObject", name, description: m.alt, thumbnailUrl: `${SITE.url}${m.poster}`, contentUrl: `${SITE.url}${m.src}.mp4`, uploadDate: "2026-11-12", publisher: { "@id": ORG_ID } });

  return (
    <div className="opp sv acc oph">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>On Point Polling</span></nav>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "ProfessionalService", "@id": SVC_ID, name: "On Point Polling", url: URL, email: CONTACT,
          logo: `${SITE.url}/brand/on-point-polling-color.svg`, image: `${URL}/opengraph-image.jpg`, parentOrganization: { "@id": ORG_ID },
          areaServed: { "@type": "Country", name: "United States" }, priceRange: "Quoted per project", slogan: "Nonpartisan polling, scored against the count",
          description: "Nonpartisan polling firm and election analytics: one time polls, tracking programs, message testing, county by county election simulations, likely voter modeling, MRP, voter file sampling and a weighting dashboard.",
          award: `Most accurate final national poll of the 2026 midterms, D +${g.us.margin.toFixed(1)} against a D +${g.result.margin.toFixed(1)} result`,
          knowsAbout: ["Election polling", "Survey research", "Likely voter modeling", "Survey weighting", "Election forecasting", "MRP", "Message testing"],
          hasOfferCatalog: { "@type": "OfferCatalog", name: "On Point Polling services", itemListElement: GROUPS.map((gr) => ({ "@type": "OfferCatalog", name: gr.name,
            itemListElement: SERVICES.filter((s) => s.group === gr.id).map((s) => ({ "@type": "Offer", url: `${SITE.url}${svcHref(s)}`, itemOffered: { "@type": "Service", "@id": `${SITE.url}${svcHref(s)}#service`, name: s.name, description: s.short, provider: { "@id": SVC_ID } } })) })) } },
        { "@type": "FAQPage", "@id": `${URL}#faq`, mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE.url }, { "@type": "ListItem", position: 2, name: "On Point Polling", item: URL }] },
        vid(MEDIA.desk, "On Point County Desk with the scenario assistant"), vid(MEDIA.weight, "On Point Weighting Dashboard"), vid(MEDIA.states, "On Point County Desk across states"),
      ] }} />
      <AccFX />

      <header className="oph-hero">
        <div className="oph-hero-grid">
          <div>
            <PollingLockup height={60} className="oph-lockup" />
            <p className="eye oph-kicker">Nonpartisan survey research and election analytics</p>
            <h1>Polling and election analytics for campaigns, causes and companies.</h1>
            <p className="lede">Our final national poll of 2026 landed a tenth of a point from the result. Clients hire the same voter file fieldwork, likely voter model and county simulations for statewide, district and national research, delivered in days.</p>
            <div className="oph-cta-row">
              <a className="btn white" href={mailto("Proposal request")}>Request a proposal</a>
              <a className="btn" href="#services">View services</a>
              <Link className="btn" href="/accuracy">Accuracy report</Link>
            </div>
            <p className="oph-trust">Polls for both parties · Sponsors disclosed · Every poll scored against the count</p>
          </div>
          <Needle B={B} />
        </div>
        <Stats items={[
          { k: "Final national poll", to: g.us.margin, dec: 1, pre: "D +", s: `Result D +${g.result.margin.toFixed(1)}, the closest final national poll` },
          { k: "Senate winners called", to: S.senate.right, suf: ` of ${S.senate.n}`, s: `${S.senate.mae.toFixed(1)} point average miss` },
          { k: "Race winners called", to: S.all.right, suf: ` of ${S.all.n}`, s: `Final state and district polls in ${S.states} states` },
          { k: "States polled in 2026", to: S.states, suf: " + US", s: `${S.releases} public releases, fielded in 48 to 72 hours` },
        ]} />
      </header>

      <section className="oph-partners" aria-labelledby="partners-h">
        <p className="eye" id="partners-h">Data, fieldwork and technology partners</p>
        <ul>{PARTNERS.map((p) => <li key={p.name}><b>{p.name}</b><span>{p.role}</span></li>)}</ul>
      </section>

      <Chapter id="services" eye="Services" title={<>What we do, what you get and how fast.</>}
        lede={<>Every service lists its deliverables and its scope up front. Choose one study or combine them into a program.</>}>
        <div className="oph-groups">
          {GROUPS.map((gr) => (
            <section key={gr.id} className="oph-group" aria-labelledby={`g-${gr.id}`}>
              <header><h3 id={`g-${gr.id}`}>{gr.name}</h3><p>{gr.blurb}</p></header>
              <div className="oph-svc-list">
                {SERVICES.filter((s) => s.group === gr.id).map((s) => (
                  <Link key={s.slug} href={svcHref(s)} className="oph-svc">
                    <span className="k">{s.kicker}</span>
                    <h4>{s.name}</h4>
                    <p>{s.short}</p>
                    <dl>{s.scope.slice(0, 2).map((x) => <div key={x.k}><dt>{x.k}</dt><dd>{x.v}</dd></div>)}</dl>
                    <span className="more">Scope and deliverables</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Chapter>

      <Chapter id="dashboards" eye="Client dashboards" title={<>Work inside the model, not around a PDF.</>}
        lede={<>Clients get private dashboards built on their own data. Below, each one runs on illustrative data.</>}>
        <article className="oph-show" data-fx>
          <div className="copy">
            <p className="eye">County Desk</p>
            <h3>Ask what if. The desk reruns the race.</h3>
            <p>Your poll drives a county by county model of any state, simulated 10,000 times. Type a question in plain English and the scenario assistant applies it, reruns every county and reports what changed.</p>
            <ul className="oph-prompts" aria-label="Example questions">
              <li>What if young voters turn out 20 percent less</li>
              <li>What if turnout in Philadelphia County drops 8 percent</li>
              <li>What if independents break 6 points toward Democrats</li>
              <li>Which counties decide the race</li>
            </ul>
            <Link className="btn" href="/on-point-polling/services/county-desk">About the County Desk</Link>
          </div>
          <Clip m={MEDIA.desk} priority />
        </article>
        <article className="oph-show flip" data-fx>
          <div className="copy">
            <p className="eye">Weighting Dashboard</p>
            <h3>Every weight, every assumption, on screen.</h3>
            <p>Rake to voter file targets, score likely voters with an exposed turnout anchor and lean undecideds on survey answers. Export the weights and the crosstabs when you are done.</p>
            <dl className="oph-facts"><div><dt>Stages</dt><dd>Electorate, likely voters, allocation</dd></div><div><dt>Diagnostics</dt><dd>Design effect, effective n, weight range</dd></div></dl>
            <Link className="btn" href="/on-point-polling/services/weighting-dashboard">About the Weighting Dashboard</Link>
          </div>
          <Clip m={MEDIA.weight} />
        </article>
        <article className="oph-show" data-fx>
          <div className="copy">
            <p className="eye">Any state</p>
            <h3>All 50 states, every county.</h3>
            <p>The same desk loads any state with its counties, regions and size classes, builds quotas for fieldwork and reads your voter file benchmarks from your own computer.</p>
          </div>
          <Clip m={MEDIA.states} />
        </article>
      </Chapter>

      <Chapter id="record" eye="Track record" title={<>{S.states} states and the nation, scored against the count.</>}
        lede={<>Our final poll in every race we polled in 2026. Hover or tap a state for each race, our leaned number, the result and the miss. The misses are shown too.</>}>
        <div className="ch-body"><PolledMap P={P} B={B} /></div>
        <div className="ch-body oph-race">
          <h3 className="oph-sub">Final national polls, ranked by accuracy</h3>
          <PollRace b={B} limit={10} />
          <p className="bx-src">Scored on the margin and each party&apos;s share against the projected final. <Link href="/most-accurate-pollster">The full ranking.</Link></p>
        </div>
      </Chapter>

      <Chapter id="method" eye="Methodology" title={<>A published method with rules we hold ourselves to.</>}
        lede={<>DSMeridian, version 2026.1. Every adjustment needs evidence from outside the analyst&apos;s expectations. Where there is none, the measurement stands.</>}>
        <ol className="oph-stages" data-fx>{STAGES.map((s, i) => <li key={s.t} style={{ ["--i" as string]: i }}><span className="n">Stage {i + 1}</span><h3>{s.t}</h3><p>{s.s}</p></li>)}</ol>
        <div className="oph-rules" data-fx><p className="eye">Governance rules on every release</p><ul>{RULES.map((r) => <li key={r}>{r}</li>)}</ul></div>
        <p className="bx-src"><Link href="/on-point-polling/methodology">Read the methodology.</Link></p>
      </Chapter>

      <Chapter id="process" eye="How a project runs" title={<>From a call to crosstabs in days.</>}>
        <ol className="oph-steps" data-fx>{STEPS.map((s, i) => <li key={s.t} style={{ ["--i" as string]: i }}><span className="n">{i + 1}</span><h3>{s.t}</h3><p>{s.s}</p></li>)}</ol>
        <div className="oph-who" id="who"><p className="eye">Who we work with</p><ul>{WHO.map((w) => <li key={w}>{w}</li>)}</ul></div>
      </Chapter>

      <Chapter id="faq" eye="Questions" title={<>Before you hire a pollster.</>}>
        <div className="oph-faq">{FAQ.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
      </Chapter>

      <section id="contact" className="oph-cta" data-fx>
        <PollingLockup height={48} className="oph-cta-logo" />
        <h2>Tell us the decision. We will design the research.</h2>
        <p>Send the race or topic, the geography, your timeline and a budget or sample size. You will have a written quote the same day.</p>
        <div className="oph-cta-row">
          <a className="btn white" href={mailto("Proposal request")}>Email {CONTACT}</a>
          <a className="btn" href="#services">All services</a>
          <Link className="btn" href="/on-point-polling/polls">Every 2026 release</Link>
        </div>
      </section>
    </div>
  );
}
