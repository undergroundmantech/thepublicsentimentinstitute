import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { seo } from "@/app/lib/seo";
import { FOUNDING, LOCALS, SOCIAL, TIERS } from "@/app/lib/offers";
import "@/app/components/community.css";

export const metadata: Metadata = seo({"title": "The Weighting Room", "description": "The members community from On Point Polling and On Point Politics: raw crosstabs, model notes, a monthly live Q and A, workshop replays and early looks at the data. $50 a month.", "path": "/on-point-polling/weighting-room"});

const PERKS = [
  ["Raw crosstabs", "The full tables behind every On Point Polling release, before they are summarized."],
  ["Model notes", "Why the forecast moved, race by race, from the people who built it."],
  ["Early looks", "Toplines and county maps ahead of public release."],
  ["Ask the desk", "A monthly live Q and A, and questions answered in the members' feed on method, weighting and the numbers."],
  ["Workshop replays", "Every polling workshop and course session, with the files, for every member."],
  ["Members' Discord", "Private channels in the On Point Discord for poll nights, election nights and the model."],
];

export default function Page() {
  return (
    <div className="opp wr">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span><span>The Weighting Room</span></nav>
      <header className="ph">
        <div className="eye" style={{ color: "var(--gold)" }}>Subscriber community</div>
        <h1>The Weighting <em>Room</em></h1>
        <p className="lede">Where On Point Polling works in the open: the raw data, the weighting decisions and the arguments about both.</p>
        <div className="pmeta"><span>From <b>On Point Polling</b></span><span>On <b>Locals</b></span><span>Membership <b>$50 a month</b></span></div>
      </header>

      <div className="layout">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <section className="card wr-hero">
            {/* the wordmark file is a one color cutout; the mask paints it gold */}
            <div className="wr-mark" role="img" aria-label="The Weighting Room" />
            <p>Every release, every weight, every argument about the likely electorate, shared with members first.</p>
            <a className="btn gold" href={LOCALS} target="_blank" rel="noopener noreferrer">Become a member</a>
          </section>
          <div className="grid2">
            {PERKS.map(([t, s]) => (
              <div key={t} className="card"><div className="card-b"><h3 style={{ fontSize: 16 }}>{t}</h3><p style={{ marginTop: 6, fontSize: 14 }}>{s}</p></div></div>
            ))}
          </div>
        </div>
        <aside className="side">
          {TIERS.map((t) => (
            <div key={t.name} className="card wr-join" style={t.best ? { borderColor: "rgba(231,179,65,.75)" } : undefined}><div className="card-b">
              <div className="eye" style={{ color: "var(--gold)" }}>Membership</div>
              <h3 style={{ fontSize: 20, margin: "8px 0 2px" }}>{t.name}</h3>
              <p style={{ margin: 0 }}><b style={{ font: "800 28px var(--font-d)" }}>{t.price}</b> <span style={{ fontSize: 13 }}>{t.per}</span></p>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13.5, display: "grid", gap: 4 }}>{t.perks.map((x) => <li key={x}>{x}</li>)}</ul>
              <a className="btn gold" href={LOCALS} target="_blank" rel="noopener noreferrer" style={{ marginTop: 14 }}>Join the Weighting Room</a>
            </div></div>
          ))}
          <div className="callout"><div className="eye" style={{ color: "var(--gold)" }}>Founding members</div>{FOUNDING.note} Only {FOUNDING.seats} founding seats.</div>
          <div className="callout"><div className="eye">Free first</div>Not ready? Join the free <a href={SOCIAL.discord} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>On Point Discord</a> or get <Link href="/alerts" style={{ textDecoration: "underline" }}>free alerts</Link> for every video and poll.</div>
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
