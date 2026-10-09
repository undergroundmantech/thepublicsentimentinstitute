import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/app/components/opp/Logo";

export const metadata: Metadata = { title: "Partner with TPSI", description: "Commission statewide, district or national polling from The Public Sentiment Institute, the polling arm behind OnPoint Politics.", alternates: { canonical: "/tpsi/services" } };

const LINES = [
  ["Polls", "Statewide and district polls", "Horse race, favorability, issues and message testing, with full crosstabs by region, party, age, race and education."],
  ["Tracking", "National tracking", "Recurring national waves on the ballot, approval and the issues, on a schedule you set."],
  ["Modeling", "Likely voter modeling", "The DSMeridian likely voter model applied to your sample, or to a voter file universe."],
  ["Forecasts", "County level forecasts", "The county model built for your race, with 2,000 simulated elections and a turnout range."],
  ["Results", "Election night", "A results desk with county maps, expected vote and calls for your audience or your war room."],
];

const STEPS: [string, string][] = [
  ["Brief", "Tell us the race, the questions and the deadline."],
  ["Design", "We reply within one business day with a questionnaire, sample plan and quote."],
  ["Field", "Dual panel fieldwork, weighted with DSMeridian."],
  ["Deliver", "Topline, full crosstabs and a methodology statement."],
];

export default function Page() {
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/tpsi">TPSI</Link><span className="sep">/</span><span>Partner with TPSI</span></nav>
      <header className="ph">
        <div className="eye g">Commission fieldwork</div>
        <h1>Partner with <em>TPSI</em></h1>
        <p className="lede">The Public Sentiment Institute runs dual panel surveys weighted with the DSMeridian likely voter model. Campaigns, PACs and newsrooms get a topline in days, not weeks.</p>
        <div className="pmeta"><span>Reply within <b>1 business day</b></span><span>Deliverables <b>Topline, crosstabs, method</b></span></div>
      </header>
      <div className="layout">
        <div className="card">
          <div className="card-h"><h3>What we field</h3><span className="eye" style={{ marginLeft: "auto" }}>Services</span></div>
          <div>
            {LINES.map(([k, t, s]) => (
              <div key={t} className="svc-row">
                <span className="eye mono">{k}</span>
                <div><div className="svc-t">{t}</div><p className="svc-s">{s}</p></div>
              </div>
            ))}
          </div>
        </div>
        <aside className="side">
          <div className="card">
            <div className="card-h"><h3>How it works</h3></div>
            <div className="card-b" style={{ paddingBlock: 6 }}>
              {STEPS.map(([k, s], i) => (
                <div key={k} className="svc-step"><span className="mono">{String(i + 1).padStart(2, "0")}</span><div><b>{k}</b><span>{s}</span></div></div>
              ))}
            </div>
          </div>
          <div className="callout"><div className="eye">Method</div>See how samples are built and weighted on the <Link href="/tpsi/methodology" style={{ textDecoration: "underline" }}>methodology page</Link>.</div>
        </aside>
      </div>

      <section className="band" style={{ marginTop: 20 }}>
        <div>
          <div className="eye" style={{ color: "var(--gold)" }}>Start a project</div>
          <h2 style={{ marginTop: 8 }}>Tell us the race and the timeline</h2>
          <p>We reply within one business day with a design and a quote.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", position: "relative", zIndex: 1 }}>
          <Link className="btn g" href="/contact">Contact the desk</Link>
          <Link className="btn" href="/tpsi/polls">See recent polls</Link>
        </div>
        <Icon size={260} className="icon" style={{ color: "#fff" }} />
      </section>
      <style>{`
        .opp .svc-row { display: grid; grid-template-columns: 100px 1fr; gap: 14px; padding: 15px 18px; border-top: 1px solid var(--line); }
        .opp .svc-row:first-child { border-top: 0; }
        .opp .svc-row .eye { padding-top: 3px; }
        .opp .svc-t { font: 700 15px var(--font-d); letter-spacing: -.01em; }
        .opp .svc-s { font-size: 14px; margin: 4px 0 0; }
        .opp .svc-step { display: grid; grid-template-columns: 28px 1fr; gap: 10px; padding: 10px 0; border-top: 1px solid var(--line); font-size: 13px; }
        .opp .svc-step:first-child { border-top: 0; }
        .opp .svc-step .mono { color: var(--mute); font-weight: 700; font-size: 12px; padding-top: 1px; }
        .opp .svc-step b { display: block; color: var(--ink); }
        .opp .svc-step span:not(.mono) { color: var(--mute); }
        @media (max-width: 600px) { .opp .svc-row { grid-template-columns: 1fr; gap: 6px; } }
        @media (max-width: 800px) { .opp .band > div:nth-child(2) { justify-content: flex-start !important; } }
      `}</style>
    </div>
  );
}
