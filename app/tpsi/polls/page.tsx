import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "TPSI poll releases", description: "Toplines, crosstabs and methodology from polls fielded by The Public Sentiment Institute for OnPoint Politics.", alternates: { canonical: "/tpsi/polls" } };

const DASH = "/tpsi/polls/la-mayor-2026";
const RELEASES = [
  { href: `${DASH}?poll=sc`, no: "04", lab: "South Carolina", t: "South Carolina GOP primary", s: "Senate and governor primaries under the Meridian coalition model: Graham's standing and an open governor's race.", n: "369 LV", date: "June 2026", q: 13 },
  { href: `${DASH}?poll=sd`, no: "03", lab: "South Dakota", t: "South Dakota GOP primary", s: "A likely voter read on the Republican primary for governor, a three way race at the top of the ticket.", n: "400 LV", date: "May 2026", q: 4 },
  { href: `${DASH}?poll=national`, no: "02", lab: "National", t: "National benchmark", s: "The generic ballot, Trump approval, the 2028 field and the issues underneath it all.", n: "893 LV", date: "May 2026", q: 25 },
  { href: `${DASH}?poll=la`, no: "01", lab: "Los Angeles", t: "Los Angeles mayor", s: "The mayoral primary with and without leaners allocated, plus the midterm mood among likely voters.", n: "465 LV", date: "May 2026", q: 17 },
  { href: "/tpsi/polls/national-2026", no: "", lab: "National", t: "The 2026 national poll", s: "Registered and likely voters on motivation, the generic ballot, the 2028 field, Trump approval and party trust.", n: "316 RV, 249 LV", date: "2026", q: 0 },
];

// a quiet bar motif for the thumbnails, varied per card so the grid does not repeat
function Thumb({ seed }: { seed: number }) {
  const bars = Array.from({ length: 14 }, (_, i) => 18 + ((i * 37 + seed * 23) % 60));
  return (
    <svg viewBox="0 0 320 120" aria-hidden="true" preserveAspectRatio="none">
      <rect width="320" height="120" fill="#160a24" />
      {bars.map((h, i) => <rect key={i} x={14 + i * 21.5} y={108 - h} width={13} height={h} rx={2} fill="#fff" opacity={0.06 + (i % 4) * 0.035} />)}
    </svg>
  );
}

export default function Page() {
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/tpsi">TPSI</Link><span className="sep">/</span><span>Polls</span></nav>
      <header className="ph">
        <div className="eye g">Fieldwork by TPSI</div>
        <h1>Poll <em>releases</em></h1>
        <p className="lede">Surveys fielded by The Public Sentiment Institute for OnPoint Politics: dual panel samples weighted with the DSMeridian likely voter model, published with toplines and crosstabs.</p>
        <div className="pmeta"><span>Releases <b className="mono">{RELEASES.length}</b></span><span>Latest <b>June 2026</b></span></div>
      </header>
      <div className="layout">
        <div className="grid2">
          {RELEASES.map((r, i) => (
            <Link key={r.href} href={r.href} className="card story">
              <div className="thumb" style={{ aspectRatio: "16/6" }}>
                <Thumb seed={i} />
                <span className="lab">{r.no ? `No. ${r.no} · ` : ""}{r.lab}</span>
              </div>
              <div className="card-b"><h3>{r.t}</h3><p>{r.s}</p><div className="meta mono">{r.date} · {r.n}{r.q ? ` · ${r.q} questions` : ""}</div></div>
            </Link>
          ))}
        </div>
        <aside className="side">
          <div className="callout">
            <div className="eye">Methodology</div>
            How TPSI builds, weights and screens its samples, and how other pollsters are graded, is on the <Link href="/tpsi/methodology" style={{ textDecoration: "underline" }}>methodology page</Link>.
          </div>
          <div className="card"><div className="card-b">
            <div className="eye">Commission a poll</div>
            <p style={{ fontSize: 14, margin: "8px 0 12px" }}>Want a race or an issue polled? TPSI fields custom statewide, district and national surveys.</p>
            <Link className="btn" href="/tpsi/services">Partner with TPSI</Link>
          </div></div>
        </aside>
      </div>
    </div>
  );
}
