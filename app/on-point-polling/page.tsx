import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { ORG_ID, SITE, seo } from "@/app/lib/seo";
import { getBench, getPolling, pm } from "@/app/accuracy/bench";
import AccFX from "@/app/accuracy/fx/AccFX";
import HTrack from "@/app/accuracy/fx/HTrack";
import { Chapter, Dumbbells, Stats } from "@/app/accuracy/fx/Story";
import "@/app/accuracy/acc.css";
import "@/app/accuracy/fx/fx.css";
import "./sell.css";

// On Point Polling's home: the 2026 record, what we field, how a project runs and how to start one. The record is read
// from the same files as the accuracy report, so the numbers here always match it.
const CONTACT = "onpointpoliticscontact@gmail.com";
const MAIL = `mailto:${CONTACT}?subject=${encodeURIComponent("Poll quote request")}&body=${encodeURIComponent("Organization:\nRace or topic:\nGeography:\nSample size or budget:\nTimeline:\n")}`;

export const metadata: Metadata = seo({
  title: "On Point Polling: hire the most accurate pollster of 2026",
  description: "On Point Polling, with VT Analytics, was the most accurate pollster of the 2026 midterms: a final national poll of D +13.1 against a D +13.0 result. Statewide, district and national polls on the voter file, likely voter modeling, MRP and message testing, delivered in 48 to 72 hours. Email onpointpoliticscontact@gmail.com for a quote.",
  path: "/on-point-polling",
  keywords: ["hire a pollster", "political polling firm", "most accurate pollster", "most accurate pollster 2026", "campaign polling", "statewide poll", "district poll", "voter file polling", "text to web survey", "MRP", "likely voter model", "On Point Polling", "VT Analytics"],
});

const SERVICES: { k: string; t: string; s: string }[] = [
  { k: "Statewide and district", t: "Horse race polls", s: "Senate, governor, House and down ballot races, with a likely voter screen, leaned results and full crosstabs for likely and registered voters." },
  { k: "National", t: "National surveys", s: "The generic ballot, presidential approval, the direction of the country and your own questions, on the same design as the most accurate national poll of 2026." },
  { k: "Voter file", t: "Text to web on the voter file", s: "Samples drawn from the voter file and matched back to each voter's record, with online panel used only to fill the groups texting misses." },
  { k: "Modeling", t: "Likely voters, MRP and turnout", s: "Our Meridian likely voter model scores intention, vote method, close contacts and vote history, and MRP turns a statewide sample into county and district estimates." },
  { k: "Messaging", t: "Message and ballot tests", s: "Informed ballot experiments that show which arguments move which voters, and which ones backfire, before the money is spent." },
  { k: "Election night", t: "Forecasts and a live desk", s: "County level forecasts and a live election night desk built on your polling. We called every state live on election night for an audience of millions." },
];

const STEPS: { t: string; s: string }[] = [
  { t: "Scope call", s: "Thirty minutes on the race, the questions you need answered, the geography and the deadline. You get a quote the same day." },
  { t: "Design", s: "We write the questionnaire with you, set weighting targets from the voter file and set quotas so the hard to reach groups are in the sample." },
  { t: "Fieldwork", s: "Text to web on the voter file, with online panel to fill gaps. Most projects field in 48 to 72 hours." },
  { t: "Delivery", s: "Toplines, likely and registered voter crosstabs, a written memo and maps, with a call to walk through it. Public release is your choice." },
];

const RECORD: string[] = [
  "The most accurate final national poll of the 2026 midterms: D +13.1 on the generic ballot against a D +13.0 result.",
  "Called every state live on election night with VT Analytics, for an audience of millions.",
  "The most accurate poll of the 2026 Michigan Democratic Senate primary.",
  "One of only two polls out of ten to show Larry Rhoden advancing in South Dakota.",
  "Had Graham as the South Carolina Senate nominee and hit Mark Lynch's vote share exactly.",
  "Commissioned by the Nebraska Democratic Party for statewide and district polls in 2026.",
];

export default function OnPointPolling() {
  const B = getBench();
  const P = getPolling();
  const g = B.generic, S = P.summary;
  const releases = P.races.reduce((m, r) => m.set(r.st, (m.get(r.st) ?? []).concat(r)), new Map<string, typeof P.races>());
  return (
    <div className="opp sv acc sell">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>On Point Polling</span></nav>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "ProfessionalService", "@id": `${SITE.url}/on-point-polling#service`, name: "On Point Polling", url: `${SITE.url}/on-point-polling`, email: CONTACT,
          parentOrganization: { "@id": ORG_ID }, areaServed: "US", priceRange: "Quoted per project",
          description: "Political polling and research: statewide, district and national surveys on the voter file, likely voter modeling, MRP, message testing and election night forecasting.",
          award: `Most accurate final national poll of the 2026 midterms, D +${g.us.margin.toFixed(1)} against a D +${g.result.margin.toFixed(1)} result`,
          hasOfferCatalog: { "@type": "OfferCatalog", name: "Polling services", itemListElement: SERVICES.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s.t, description: s.s } })) } },
        { "@type": "FAQPage", mainEntity: [
          { "@type": "Question", name: "How accurate is On Point Polling?", acceptedAnswer: { "@type": "Answer", text: `On Point Polling's final 2026 national poll had Democrats up ${g.us.margin.toFixed(1)} against a projected final of D +${g.result.margin.toFixed(1)}, the closest of ${B.national.polls.length} final national polls. Its final state and district polls called ${S.all.right} of ${S.all.n} race winners, and its Senate polls missed by ${S.senate.mae.toFixed(1)} points on average.` } },
          { "@type": "Question", name: "How fast can On Point Polling field a poll?", acceptedAnswer: { "@type": "Answer", text: "Most projects field in 48 to 72 hours from an approved questionnaire, with toplines and crosstabs delivered shortly after." } },
          { "@type": "Question", name: "How do I commission a poll from On Point Polling?", acceptedAnswer: { "@type": "Answer", text: `Email ${CONTACT} with the race or topic, the geography, the timeline and a budget or sample size. Quotes are given per project.` } },
        ] },
      ] }} />
      <AccFX />

      <header className="sv-hero">
        <div className="sv-orbs" aria-hidden="true" data-par><i /><i /><i /></div>
        <p className="eye g">On Point Polling · with VT Analytics</p>
        <h1><span className="w" style={{ ["--i" as string]: 0 }}>Hire </span><span className="w" style={{ ["--i" as string]: 1 }}>the </span><em><span className="w" style={{ ["--i" as string]: 2 }}>most </span><span className="w" style={{ ["--i" as string]: 3 }}>accurate </span><span className="w" style={{ ["--i" as string]: 4 }}>pollster </span></em><span className="w" style={{ ["--i" as string]: 5 }}>of </span><span className="w" style={{ ["--i" as string]: 6 }}>2026.</span></h1>
        <p className="lede">
          Our final national poll was a tenth of a point from the result, the closest of {B.national.polls.length}. Campaigns, committees, newsrooms and companies use the same fieldwork and models for statewide, district and national polls, delivered in days.
        </p>
        <div className="sv-cta">
          <a className="btn g" href={MAIL}>Get a quote</a>
          <Link className="btn" href="/accuracy">The accuracy report</Link>
          <Link className="btn" href="/on-point-polling/polls">Every release</Link>
        </div>
        <Stats items={[
          { k: "Final national poll", to: g.us.margin, dec: 1, pre: "D +", cls: "d", s: `The result: D +${g.result.margin.toFixed(1)}` },
          { k: "Our miss", to: Math.abs(g.us.margin - g.result.margin), dec: 1, suf: " pts", cls: "ok", s: `The polling averages missed by ${(g.result.margin - g.averages.margin).toFixed(1)}` },
          { k: "Race winners called", to: S.all.right, suf: ` of ${S.all.n}`, s: `Our final state and district polls in ${S.states} states` },
          { k: "Senate polls", to: S.senate.mae, dec: 1, suf: " pts", cls: "ok", s: `Average miss, ${S.senate.within1} of ${S.senate.n} within a point` },
        ]} />
      </header>

      <Chapter id="record" eye="The 2026 accuracy report" title={<>Every poll we published, against the count.</>}
        lede={<>Our final poll in every race we polled. The open dot is the poll and the solid dot is the result. We show the misses too: Democrats ran ahead of our final governor polls, and we missed Texas, Kansas and Nebraska.</>}>
        <div className="ch-body"><Dumbbells rows={P.races} /></div>
        <div className="sell-sum" data-fx>
          <div><span className="k">Senate</span><b>{S.senate.right} of {S.senate.n}</b><span>winners · {S.senate.mae.toFixed(1)} point average miss</span></div>
          <div><span className="k">Governor</span><b>{S.governor.right} of {S.governor.n}</b><span>winners · {S.governor.mae.toFixed(1)} point average miss</span></div>
          {S.house ? <div><span className="k">House</span><b>{S.house.right} of {S.house.n}</b><span>winners · {S.house.mae.toFixed(1)} point average miss</span></div> : null}
          <div><span className="k">National</span><b>{Math.abs(g.us.margin - g.result.margin).toFixed(1)} off</b><span>closest of {B.national.polls.length} final national polls</span></div>
        </div>
        <p className="bx-src">Leaned likely voter results, the last release before Election Day in each race, against the count as of {new Date(P.asof.replace("Z", ":00Z")).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. <Link href="/accuracy#our-polls">Full method in the accuracy report.</Link></p>
      </Chapter>

      <Chapter id="services" eye="What we field" title={<>Polling built to be right, not just published.</>}>
        <div className="sell-grid" data-fx>
          {SERVICES.map((s, i) => (
            <article key={s.t} className="sell-card" style={{ ["--i" as string]: i }}>
              <p className="eye">{s.k}</p>
              <h3>{s.t}</h3>
              <p>{s.s}</p>
            </article>
          ))}
        </div>
      </Chapter>

      <Chapter id="process" eye="How a project runs" title={<>From a call to crosstabs in days.</>}>
        <ol className="sell-steps" data-fx>
          {STEPS.map((s, i) => (
            <li key={s.t} style={{ ["--i" as string]: i }}><span className="n">{i + 1}</span><div><h3>{s.t}</h3><p>{s.s}</p></div></li>
          ))}
        </ol>
      </Chapter>

      <Chapter id="releases" eye="Published in 2026" title={<>{S.releases} public releases, {S.states} states and the nation.</>}>
        <HTrack label="2026 releases">
          <article className="cc lit">
            <p className="eye">National · October 28</p>
            <div className="v">D +{g.us.margin.toFixed(1)}</div>
            <p className="t">{g.us.d.toFixed(1)} to {g.us.r.toFixed(1)} among likely voters. The result: D +{g.result.margin.toFixed(1)}.</p>
          </article>
          {[...releases.entries()].map(([st, rs]) => (
            <article key={st} className="cc">
              <p className="eye">{rs[0].race.replace(/ (Senate|Governor|House.*)$/, "")} · {new Date(rs[0].date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
              <div className="sell-rel">
                {rs.map((r) => (
                  <div key={r.id}><span>{r.office}{r.office === "House" ? ` ${r.id.split("-")[2].replace(/^0/, "")}` : ""}</span><b className={r.poll < 0 ? (r.ind ? "i" : "d") : "r"}>{pm(r.poll, r.ind)}</b><em>{r.result == null ? "" : `result ${pm(r.result, r.ind)}`}</em></div>
                ))}
              </div>
            </article>
          ))}
        </HTrack>
        <p className="bx-src"><Link href="/on-point-polling/polls">Every release with toplines and crosstabs.</Link></p>
      </Chapter>

      <Chapter id="record-more" eye="Track record" title={<>Right when it counted.</>}>
        <ul className="sell-list" data-fx>
          {RECORD.map((r, i) => <li key={r} style={{ ["--i" as string]: i }}>{r}</li>)}
        </ul>
      </Chapter>

      <section id="contact" className="sell-cta" data-fx>
        <p className="eye">Work with On Point Polling</p>
        <h2>Tell us the race. We will tell you where it stands.</h2>
        <p>Send the race or topic, the geography, your timeline and a budget or sample size. Quotes are per project, and most polls field within 72 hours of an approved questionnaire.</p>
        <div className="sv-cta" style={{ animation: "none" }}>
          <a className="btn white" href={MAIL}>Email {CONTACT}</a>
          <Link className="btn" href="/most-accurate-pollster">Why we were the most accurate</Link>
        </div>
      </section>
    </div>
  );
}
