import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "The Weighting Room", "description": "The subscriber community from On Point Polling and On Point Politics: raw crosstabs, model notes and early looks at the data.", "path": "/on-point-polling/weighting-room"});

const PERKS = [
  ["Raw crosstabs", "The full tables behind every On Point Polling release, before they are summarized."],
  ["Model notes", "Why the forecast moved, race by race, from the people who built it."],
  ["Early looks", "Toplines and county maps ahead of public release."],
  ["Ask the desk", "Questions answered in the community on method, weighting and the numbers."],
];

export default function Page() {
  return (
    <div className="opp wr">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span><span>The Weighting Room</span></nav>
      <header className="ph">
        <div className="eye" style={{ color: "var(--gold)" }}>Subscriber community</div>
        <h1>The Weighting <em>Room</em></h1>
        <p className="lede">Where On Point Polling works in the open: the raw data, the weighting decisions and the arguments about both.</p>
        <div className="pmeta"><span>From <b>On Point Polling</b></span><span>Status <b>Waitlist open</b></span></div>
      </header>

      <div className="layout">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <section className="card wr-hero">
            {/* the wordmark file is a one color cutout; the mask paints it gold */}
            <div className="wr-mark" role="img" aria-label="The Weighting Room" />
            <p>Every release, every weight, every argument about the likely electorate, shared with members first.</p>
          </section>
          <div className="grid2">
            {PERKS.map(([t, s]) => (
              <div key={t} className="card"><div className="card-b"><h3 style={{ fontSize: 16 }}>{t}</h3><p style={{ marginTop: 6, fontSize: 14 }}>{s}</p></div></div>
            ))}
          </div>
        </div>
        <aside className="side">
          <div className="card wr-join"><div className="card-b">
            <div className="eye" style={{ color: "var(--gold)" }}>Membership</div>
            <h3 style={{ fontSize: 20, margin: "8px 0 6px" }}>Get on the list</h3>
            <p style={{ fontSize: 14 }}>Join the waitlist and we will let you know when the doors open.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <Link className="btn gold" href="/contact">Join the waitlist</Link>
              <Link className="btn" href="/on-point-polling/polls">Public releases</Link>
            </div>
          </div></div>
          <div className="callout"><div className="eye">Method</div>How On Point Polling weights its samples is public on the <Link href="/on-point-polling/methodology" style={{ textDecoration: "underline" }}>methodology page</Link>.</div>
        </aside>
      </div>
      <style>{`
        .opp .wr-hero { padding: 28px; display: grid; gap: 14px; justify-items: start; background: radial-gradient(600px 240px at 0% 0%, rgba(231,179,65,.12), transparent 70%), var(--glass); border-color: rgba(231,179,65,.28); }
        .opp .wr-hero .wr-mark { height: 110px; aspect-ratio: 900 / 360; background: var(--gold); -webkit-mask: url(/weighting-room-gold.png) center / contain no-repeat; mask: url(/weighting-room-gold.png) center / contain no-repeat; }
        .opp .wr-hero p { font-size: 15px; max-width: 56ch; margin: 0; }
        .opp .wr-join { border-color: rgba(231,179,65,.28); }
      `}</style>
    </div>
  );
}
