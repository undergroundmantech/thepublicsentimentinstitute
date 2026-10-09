import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About TPSI",
  description: "The Public Sentiment Institute is the polling and research arm behind OnPoint Politics: fieldwork, the DSMeridian likely voter model and dual panel surveys.",
  alternates: { canonical: "/tpsi" },
};

const PILLARS: [string, string, string][] = [
  ["Fieldwork", "Original surveys", "Statewide, district and national polls written, fielded and weighted in house, published with full toplines and crosstabs."],
  ["Model", "DSMeridian likely voter model", "Each respondent gets a likely voter score from two parts, survey engagement and validated vote history, after the sample is weighted to the registered population on the voter file."],
  ["Design", "Dual panel surveys", "Two independent online panels are fielded side by side and pooled only after their results are compared cell by cell."],
];

const LINKS = [
  { href: "/tpsi/polls", t: "Poll releases", s: "Toplines and crosstabs from TPSI surveys." },
  { href: "/tpsi/methodology", t: "Methodology", s: "DSMeridian weighting, the dual panel design and the gold standard pollster list." },
  { href: "/tpsi/services", t: "Partner with TPSI", s: "Commission statewide, district or national polling." },
  { href: "/tpsi/weighting-room", t: "The Weighting Room", s: "The subscriber community for people who like their crosstabs raw." },
  { href: "/tpsi/situation-room", t: "Situation room", s: "Streams and election night video from the desk." },
  { href: "/tpsi/sms", t: "SMS updates", s: "Text alerts for releases and results nights." },
];

export default function Page() {
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>TPSI</span></nav>
      <header className="ph">
        <div className="eye g">About TPSI</div>
        <h1>The research arm behind <em>OnPoint</em></h1>
        <p className="lede">The Public Sentiment Institute is the polling and research arm behind OnPoint Politics. TPSI fields the surveys, runs the DSMeridian likely voter model and feeds the polling averages, the 2026 forecast and election night coverage.</p>
        <div className="pmeta">
          <span>Based in <b>Miami</b></span>
          <span>Field reports <b className="mono">4</b></span>
          <span>Largest sample <b className="mono">893 LV</b></span>
        </div>
      </header>

      <div className="layout">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="card-h"><h3>What TPSI does</h3><span className="eye" style={{ marginLeft: "auto" }}>Polling and research</span></div>
            <div>
              {PILLARS.map(([k, t, s]) => (
                <div key={k} className="tpsi-row">
                  <span className="eye mono">{k}</span>
                  <div><div className="tpsi-t">{t}</div><p className="tpsi-s">{s}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="tiles">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="card tile">
                <span className="t">{l.t}</span><span className="s">{l.s}</span>
              </Link>
            ))}
          </div>
        </div>
        <aside className="side">
          <div className="card">
            <div className="card-h"><h3>At a glance</h3></div>
            <div className="card-b" style={{ paddingBlock: 6 }}>
              <div className="kv"><span>Role</span><span>Pollster of record</span></div>
              <div className="kv"><span>Likely voter model</span><span>DSMeridian</span></div>
              <div className="kv"><span>Sample design</span><span>Dual panel</span></div>
              <div className="kv"><span>Releases</span><span>Topline + crosstabs</span></div>
            </div>
          </div>
          <div className="card"><div className="card-b">
            <div className="eye">Work with TPSI</div>
            <h3 style={{ fontSize: 18, margin: "8px 0 6px" }}>Commission a poll</h3>
            <p style={{ fontSize: 14 }}>Campaigns, PACs and newsrooms get a topline in days, not weeks.</p>
            <Link className="btn g" href="/tpsi/services" style={{ marginTop: 12 }}>Partner with TPSI</Link>
          </div></div>
        </aside>
      </div>
      <style>{`
        .opp .tpsi-row { display: grid; grid-template-columns: 110px 1fr; gap: 14px; padding: 16px 18px; border-top: 1px solid var(--line); }
        .opp .tpsi-row:first-child { border-top: 0; }
        .opp .tpsi-row .eye { padding-top: 3px; }
        .opp .tpsi-t { font: 700 16px var(--font-d); letter-spacing: -.01em; }
        .opp .tpsi-s { font-size: 14px; margin: 4px 0 0; }
        @media (max-width: 600px) { .opp .tpsi-row { grid-template-columns: 1fr; gap: 6px; } }
      `}</style>
    </div>
  );
}
