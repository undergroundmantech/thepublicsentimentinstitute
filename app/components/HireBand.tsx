// The band that turns the scorecard into a pitch: the record, then the two ways to hire the desk behind it.
import Link from "./Link";
import { CALENDLY } from "@/app/lib/offers";
import "./community.css";

export default function HireBand({ stats, title = "Hire the pollster who called it" }: { stats: [string, string][]; title?: string }) {
  return (
    <section className="opp opx-hire" aria-labelledby="hire-h">
      <div className="hire-t">
        <span className="eye">On Point Polling for campaigns, PACs and newsrooms</span>
        <h2 id="hire-h">{title}</h2>
        <p>The same team, model and panel behind this record, on your race: a custom poll, a county by county forecast, or a strategy call to start.</p>
        <div className="hire-b">
          <Link className="btn gold" href="/work-with-on-point">See what we do</Link>
          {CALENDLY ? <a className="btn" href={CALENDLY} target="_blank" rel="noopener noreferrer">Book a strategy call</a> : <Link className="btn" href="/contact">Book a strategy call</Link>}
        </div>
      </div>
      <dl className="hire-s">{stats.map(([v, k]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </section>
  );
}
