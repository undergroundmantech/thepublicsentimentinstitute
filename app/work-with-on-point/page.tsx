import type { Metadata } from "next";
import Link from "@/app/components/Link";
import HireBand from "@/app/components/HireBand";
import { CALENDLY, CONSULTING } from "@/app/lib/offers";
import { seo } from "@/app/lib/seo";
import { getAcc } from "@/app/accuracy/data";
import Intake from "./Intake";
import "@/app/components/community.css";

export const metadata: Metadata = seo({ title: "Work with On Point: polling and forecasting for campaigns", description: "Custom polls, county by county forecasts, poll readouts and strategy calls for campaigns, PACs and newsrooms, from the pollster that called 2026.", path: "/work-with-on-point" });

const STEPS = [
  ["Intake", "Tell us the race and the question. We reply within one business day."],
  ["Discovery call", "Thirty minutes, free: what you need to know, by when, and what it costs."],
  ["Proposal", "A one page scope with the price, the timeline and what you get."],
  ["Delivery", "The poll, the forecast or the memo, then a live briefing for your team."],
];

export default function Page() {
  let rec: [string, string][] = [["2026", "Midterm record"]];
  try { const H = getAcc().headline; rec = [[`${H.all.called_right} of ${H.all.races}`, "2026 races called right"], ["3 of 3", "Chambers called"]]; } catch { /* the scorecard file is optional here */ }
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span><span>Work with us</span></nav>
      <header className="ph">
        <div className="eye" style={{ color: "var(--gold)" }}>For campaigns, PACs and newsrooms</div>
        <h1>Polling and forecasting for <em>your race</em></h1>
        <p className="lede">The panel, the likely voter model and the county forecast behind the On Point record, pointed at the race you care about.</p>
      </header>
      <HireBand stats={[...rec, ["2 to 4 wks", "Custom poll turnaround"], ["24 hrs", "First reply"]].slice(0, 4) as [string, string][]} title="Start with a 60 minute strategy call" />
      <div className="cm-grid" style={{ maxWidth: 1100, margin: "0 auto" }}>
        {CONSULTING.map((c) => (
          <div key={c.name} className="cm-card"><span className="eye" style={{ color: "var(--gold)" }}>{c.note}</span><h3 style={{ fontSize: 19 }}>{c.name}</h3><p className="cm-mute" style={{ fontSize: 14 }}>{c.what}</p><b style={{ font: "800 20px var(--font-d)" }}>{c.price}</b></div>
        ))}
      </div>
      <section style={{ maxWidth: 1100, margin: "28px auto", display: "grid", gap: 12 }}>
        <h2 style={{ fontSize: 22 }}>How it works</h2>
        <ol className="cm-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>{STEPS.map(([t, s], i) => <li key={t} className="cm-card"><span className="eye">Step {i + 1}</span><h3 style={{ fontSize: 17 }}>{t}</h3><p className="cm-mute" style={{ fontSize: 14 }}>{s}</p></li>)}</ol>
      </section>
      <section style={{ maxWidth: 1100, margin: "0 auto 40px", display: "grid", gap: 12 }} id="intake">
        {CALENDLY ? <p className="hire-line">Ready now? <a href={CALENDLY} target="_blank" rel="noopener noreferrer">Book and pay for a strategy call</a>, or send the form and we&apos;ll set up a free discovery call.</p> : null}
        <Intake />
        <p className="cm-mute">Prefer email? Write to info@publicsentimentinstitute.com. See <Link href="/accuracy">the full 2026 scorecard</Link> and <Link href="/on-point-polling/methodology">how On Point Polling works</Link>.</p>
      </section>
    </div>
  );
}
