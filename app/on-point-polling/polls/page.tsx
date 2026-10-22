import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { seo } from "@/app/lib/seo";
import PollingRoom from "../PollingRoom";
import { roomForecast } from "../roomForecast";

export const metadata: Metadata = seo({"title": "On Point Polling poll releases", "description": "Toplines, crosstabs and methodology from every On Point Polling survey for On Point Politics, including the October 2026 Michigan, Ohio, Texas and Florida Senate and governor polls, with a map of every state polled.", "path": "/on-point-polling/polls"});

const DASH = "/on-point-polling/polls/la-mayor-2026";
const RELEASES: { href: string; no: string; lab: string; t: string; s: string; n: string; date: string; q: number; img?: string }[] = [
  { href: "/on-point-polling/polls?st=KS", no: "11", lab: "Kansas", t: "Kansas Senate and governor", s: "The Senate is a toss up as Hamilton leads Marshall by 1.8, while Masterson leads Holscher by 6.5 for governor, with undecideds leaned. Laura Kelly is the most popular figure tested.", n: "479 RV", date: "October 2026", q: 0 },
  { href: "/on-point-polling/polls?st=IA", no: "10", lab: "Iowa", t: "Iowa Senate and governor", s: "Democrats lead both races: Turek leads Hinson by 4.7 and Sand leads Lahn by 4.7 with undecideds leaned, and Turek is up 35 among Iowans who have already voted.", n: "491 RV", date: "October 2026", q: 0 },
  { href: "/on-point-polling/polls?st=SC", no: "09", lab: "South Carolina", t: "South Carolina Senate and governor", s: "Andrews leads Graham Nordone by 3.5 for the Senate while Wilson leads Johnson by 8.2 for governor, with undecideds leaned.", n: "511 RV", date: "October 2026", q: 0 },
  { href: "https://onpointpolitics.substack.com/p/florida-poll-moody-leads-nixon-donalds", no: "08", lab: "Florida", t: "Florida Senate and governor", s: "Moody leads Nixon by 6.7 and Donalds leads Jolly by 3.9 with undecideds leaned, while no party voters back Nixon 56 to 32.", n: "601 RV", date: "October 2026", q: 0 },
  { href: "https://onpointpolitics.substack.com/p/michigan-poll-el-sayed-leads-rogers", no: "07", lab: "Michigan", t: "Michigan Senate and governor", s: "El-Sayed leads Rogers by 6.3 and Benson leads James by 12.0 with undecideds leaned, as Trump voters cross over at a higher rate than Harris voters.", n: "586 RV", date: "October 2026", q: 0 },
  { href: "/on-point-polling/polls/texas-2026", no: "06", lab: "Texas", t: "Texas Senate, governor and Railroad Commissioner", s: "Talarico leads Paxton by 5.8 while Abbott leads Hinojosa by 2.5, as Republicans and independents cross over against Paxton.", n: "661 RV", date: "October 2026", q: 0 },
  { href: "/on-point-polling/polls/ohio-2026", no: "05", lab: "Ohio", t: "Ohio Senate and governor", s: "Brown leads Husted by 4.3 and Acton leads Ramaswamy by 4.8, with Democrats banking a big early vote lead.", n: "635 LV", date: "October 2026", q: 0, img: "/on-point-polling/polls/ohio-2026/01_senate.jpg" },
  { href: `${DASH}?poll=sc`, no: "04", lab: "South Carolina", t: "South Carolina GOP primary", s: "Senate and governor primaries under the Meridian coalition model: Graham's standing and an open governor's race.", n: "369 LV", date: "June 2026", q: 13 },
  { href: `${DASH}?poll=sd`, no: "03", lab: "South Dakota", t: "South Dakota GOP primary", s: "A likely voter read on the Republican primary for governor, a three way race at the top of the ticket.", n: "400 LV", date: "May 2026", q: 4 },
  { href: `${DASH}?poll=national`, no: "02", lab: "National", t: "National benchmark", s: "The generic ballot, Trump approval, the 2028 field and the issues underneath it all.", n: "893 LV", date: "May 2026", q: 25 },
  { href: `${DASH}?poll=la`, no: "01", lab: "Los Angeles", t: "Los Angeles mayor", s: "The mayoral primary with and without leaners allocated, plus the midterm mood among likely voters.", n: "465 LV", date: "May 2026", q: 17 },
  { href: "/on-point-polling/polls/national-2026", no: "", lab: "National", t: "The 2026 national poll", s: "Registered and likely voters on motivation, the generic ballot, the 2028 field, Trump approval and party trust.", n: "316 RV, 249 LV", date: "2026", q: 0 },
];

// a quiet bar motif for the thumbnails, varied per card so the grid does not repeat
function Thumb({ seed }: { seed: number }) {
  const bars = Array.from({ length: 14 }, (_, i) => 18 + ((i * 37 + seed * 23) % 60));
  return (
    <svg viewBox="0 0 320 120" aria-hidden="true" preserveAspectRatio="none">
      <rect width="320" height="120" fill="#160a24" />
      {bars.map((h, i) => <rect key={i} x={14 + i * 21.5} y={108 - h} width={13} height={h} rx={2} fill="var(--hi)" opacity={0.06 + (i % 4) * 0.035} />)}
    </svg>
  );
}

export default function Page() {
  return (
    <div className="opp fx-dark">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span><span>Polls</span></nav>
      <header className="ph">
        <div className="eye g">Fieldwork by On Point Polling</div>
        <h1>Poll <em>releases</em></h1>
        <p className="lede">Surveys fielded by On Point Polling for On Point Politics: dual panel samples weighted with the DSMeridian likely voter model, published with toplines and crosstabs.</p>
        <div className="pmeta"><span>Releases <b className="mono">{RELEASES.length}</b></span><span>Latest <b>October 2026</b></span></div>
      </header>
      <PollingRoom forecast={roomForecast()} title="Every state poll, on one map" />
      <div className="layout">
        <div className="grid2">
          {RELEASES.map((r, i) => (
            <Link key={r.href} href={r.href} className="card story">
              <div className="thumb" style={{ aspectRatio: "16/6" }}>
                {r.img ? <Image src={r.img} alt="" fill sizes="(max-width: 960px) 100vw, 480px" style={{ objectFit: "cover", objectPosition: "top" }} /> : <Thumb seed={i} />}
                {r.img ? <span aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,7,17,0) 40%, rgba(10,7,17,.94) 100%)" }} /> : null}
                <span className="lab">{r.no ? `No. ${r.no} · ` : ""}{r.lab}</span>
              </div>
              <div className="card-b"><h3>{r.t}</h3><p>{r.s}</p><div className="meta mono">{r.date} · {r.n}{r.q ? ` · ${r.q} questions` : ""}</div></div>
            </Link>
          ))}
        </div>
        <aside className="side">
          <div className="callout">
            <div className="eye">Methodology</div>
            How On Point Polling builds, weights and screens its samples, and how other pollsters are graded, is on the <Link href="/on-point-polling/methodology" style={{ textDecoration: "underline" }}>methodology page</Link>.
          </div>
          <div className="card"><div className="card-b">
            <div className="eye">Commission a poll</div>
            <p style={{ fontSize: 14, margin: "8px 0 12px" }}>Want a race or an issue polled? On Point Polling fields custom statewide, district and national surveys.</p>
            <Link className="btn" href="/on-point-polling/services">Partner with On Point Polling</Link>
          </div></div>
        </aside>
      </div>
    </div>
  );
}
