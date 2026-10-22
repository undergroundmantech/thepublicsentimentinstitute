import type { Metadata } from "next";
import Link from "next/link";
import { seo } from "@/app/lib/seo";
import PollingRoom from "./PollingRoom";
import { roomForecast } from "./roomForecast";

export const metadata: Metadata = seo({"title": "On Point Polling: the polling arm behind On Point Politics", "description": "On Point Polling is the polling and research arm behind On Point Politics: statewide and national surveys, the DSMeridian likely voter model and dual panel fieldwork.", "path": "/on-point-polling"});

const PILLARS: [string, string, string][] = [
  ["Fieldwork", "Original surveys", "Statewide, district and national polls written, fielded and weighted in house, published with full toplines and crosstabs."],
  ["Model", "DSMeridian likely voter model", "Each respondent gets a likely voter score from two parts, survey engagement and validated vote history, after the sample is weighted to the registered population on the voter file."],
  ["Design", "Dual panel surveys", "Two independent online panels are fielded side by side and pooled only after their results are compared cell by cell."],
];

const LINKS = [
  { href: "/on-point-polling/polls", t: "Poll releases", s: "Toplines and crosstabs from every On Point Polling survey." },
  { href: "/on-point-polling/methodology", t: "Methodology", s: "DSMeridian weighting, the dual panel design and the gold standard pollster list." },
  { href: "/on-point-polling/services", t: "Partner with On Point Polling", s: "Commission statewide, district or national polling." },
  { href: "/on-point-polling/weighting-room", t: "The Weighting Room", s: "The subscriber community for people who like their crosstabs raw." },
  { href: "/on-point-polling/situation-room", t: "Situation room", s: "Streams and election night video from the desk." },
  { href: "/on-point-polling/sms", t: "SMS updates", s: "Text alerts for releases and results nights." },
];

export default function Page() {
  return (
    <div className="opp fx-dark">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>On Point Polling</span></nav>
      <header className="ph">
        <div className="eye g">On Point Polling</div>
        <h1>On Point <em>Polling</em></h1>
        <p className="lede">On Point Polling is the polling and research arm behind On Point Politics. It fields the surveys, runs the DSMeridian likely voter model and feeds the polling averages, the 2026 forecast and election night coverage.</p>
        <div className="pmeta">
          <span>Based in <b>Miami</b></span>
          <span>Field reports <b className="mono">12</b></span>
          <span>Latest <Link href="/on-point-polling/polls"><b>South Carolina, Oct 2026</b></Link></span>
          <span>Largest sample <b className="mono">893 LV</b></span>
        </div>
      </header>

      <PollingRoom forecast={roomForecast()} />

      <div className="layout">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="card-h"><h3>What On Point Polling does</h3><span className="eye" style={{ marginLeft: "auto" }}>Polling and research</span></div>
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
            <div className="eye">Work with On Point Polling</div>
            <h3 style={{ fontSize: 18, margin: "8px 0 6px" }}>Commission a poll</h3>
            <p style={{ fontSize: 14 }}>Campaigns, PACs and newsrooms get a topline in days, not weeks.</p>
            <Link className="btn g" href="/on-point-polling/services" style={{ marginTop: 12 }}>Partner with On Point Polling</Link>
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
