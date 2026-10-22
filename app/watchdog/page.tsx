import type { Metadata } from "next";
import Link from "next/link";
import { getGraph, getMoney, getTrail, usd } from "./data";
import { Pointy } from "@/app/components/home/Mascot";
import PersonToken from "./PersonToken";
import fs from "node:fs";
import path from "node:path";
import "./desk.css";

export const metadata: Metadata = { title: { absolute: "Watchdog: follow the money and the people | On Point Politics" }, description: "Outside money in every close 2026 race, the donors and super PACs behind it, the firms they pay, where Trump, Vance, Obama and others are campaigning, and every county's data." };

const STN: Record<string, string> = { TX: "Texas", OH: "Ohio", MI: "Michigan", IA: "Iowa", ME: "Maine", NC: "North Carolina", AK: "Alaska", NH: "New Hampshire", NE: "Nebraska", GA: "Georgia", KS: "Kansas", FL: "Florida", SC: "South Carolina", MT: "Montana", MN: "Minnesota" };

export default function Page() {
  const m = getMoney(), t = getTrail(), g = getGraph();
  const dc = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "watchdog", "datacenters.json"), "utf8")) as { projects: { opposition: string; status: string }[] };
  const total = m.races.reduce((a, r) => a + (r.total ?? 0), 0);
  const donors = new Map<string, number>();
  for (const e of g.edges) if (e.k === "gave" && e.s.startsWith("d:")) donors.set(e.s, (donors.get(e.s) ?? 0) + (e.v ?? 0));
  const topDonors = [...donors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const name = (id: string) => g.nodes.find((n) => n.id === id)?.name ?? id;
  const vend = new Map<string, number>();
  for (const e of g.edges) if (e.k === "paid" && e.t.startsWith("v:")) vend.set(e.t, (vend.get(e.t) ?? 0) + (e.v ?? 0));
  const topVend = [...vend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const fights = dc.projects.filter((p) => p.opposition && p.opposition !== "none").length;
  const upcoming = t.visits.filter((v) => v.date >= "2026-10-22").slice(0, 6);
  const P = Object.fromEntries(t.people.map((p) => [p.name, p]));
  const big = m.races.flatMap((r) => r.groups.slice(0, 2).map((gr) => ({ ...gr, race: r.key }))).sort((a, b) => b.amount - a.amount).slice(0, 6);
  const maxR = m.races[0]?.total ?? 1;
  return (
    <>
      <header className="wd-hero dk-hero">
        <div>
          <div className="eye gold">Watchdog · On Point Politics</div>
          <h1>Follow the money. <em>Follow the people.</em></h1>
          <p className="lede">Who is paying for the 2026 midterms, which groups they fund, where that money lands, which firms get paid, and which national figures are crossing the country to move a race. Every tie is sourced.</p>
          <div className="dk-cta"><Link className="btn g" href="/watchdog/connections">Trace a name</Link><Link className="btn" href="/watchdog/trail">See the campaign trail</Link><Link className="btn" href="/watchdog/counties">Open the county data center</Link></div>
        </div>
        <div className="dk-badge" aria-hidden="true">
          <div className="dk-radar"><i /><i /><i /><span className="dk-sweep" /></div>
          <Pointy className="dk-pty keep" pose="point" prop="magnifier" size={190} look={-1} flip detective />
        </div>
      </header>

      <div className="wd-kpis">
        <div className="wd-kpi"><span>Outside money, closest races</span><b>{usd(total)}</b><small>Across {m.races.length} Senate and governor races</small></div>
        <div className="wd-kpi"><span>Biggest single donor</span><b>{usd(topDonors[0]?.[1])}</b><small>{name(topDonors[0]?.[0] ?? "")}, to the groups we track</small></div>
        <div className="wd-kpi"><span>Campaign stops tracked</span><b>{t.visits.length}</b><small>{t.people.filter((p) => p.visits).length} national figures since August</small></div>
        <div className="wd-kpi"><span>Data center fights</span><b>{fights}</b><small>Of {dc.projects.length} projects with organized local opposition</small></div>
      </div>

      <div className="dk-grid">
        <Link href="/watchdog/money" className="card dk-card">
          <div className="card-h"><h3>Money flow</h3><span className="eye gold" style={{ marginLeft: "auto" }}>Open</span></div>
          <div className="card-b">
            {m.races.slice(0, 7).map((r, i) => (
              <div key={r.key} className="dk-race"><span>{STN[r.st] ?? r.st}</span><span className="wd-bar"><i style={{ width: `${((r.forD ?? 0) / maxR) * 100}%`, background: "#3d7bff", animationDelay: `${i * 0.06}s` }} /><i style={{ width: `${((r.forR ?? 0) / maxR) * 100}%`, background: "#ff3b5c", animationDelay: `${i * 0.06 + 0.1}s` }} /></span><b className="mono">{usd(r.total)}</b></div>
            ))}
          </div>
        </Link>
        <Link href="/watchdog/connections" className="card dk-card dk-orbit-card">
          <div className="card-h"><h3>Connections</h3><span className="eye gold" style={{ marginLeft: "auto" }}>Open</span></div>
          <svg viewBox="0 0 400 260" className="dk-orbit" aria-hidden="true">
            <circle cx="200" cy="130" r="58" className="ring" /><circle cx="200" cy="130" r="104" className="ring b" />
            <g className="spin">{topDonors.map(([id, v], i) => { const a = (i / topDonors.length) * Math.PI * 2; const x = 200 + Math.cos(a) * 104, y = 130 + Math.sin(a) * 104 * 0.85; return <g key={id}><path d={`M${x},${y} Q200,${130 - 40} 200,130`} className="tie" /><circle cx={x} cy={y} r={5 + Math.sqrt(v / (topDonors[0][1] || 1)) * 9} className="don" /><circle r="3" className="mote"><animateMotion dur={`${2.4 + i * 0.3}s`} repeatCount="indefinite" path={`M${x},${y} Q200,${130 - 40} 200,130`} /></circle></g>; })}</g>
            <rect x="186" y="116" width="28" height="28" rx="6" className="hub" />
          </svg>
          <div className="card-b dk-names">{topDonors.slice(0, 4).map(([id, v]) => <span key={id}>{name(id)} <b className="g">{usd(v)}</b></span>)}</div>
        </Link>
        <Link href="/watchdog/trail" className="card dk-card">
          <div className="card-h"><h3>Campaign trail</h3><span className="eye gold" style={{ marginLeft: "auto" }}>Open</span></div>
          <div className="dk-trail">
            {upcoming.map((v, i) => (
              <div key={i} className="dk-stop"><PersonToken ini={P[v.who]?.ini ?? "?"} party={P[v.who]?.party ?? "O"} role={P[v.who]?.role} size={36} /><span><b>{v.who}</b><small>{new Date(v.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} · {v.city ? `${v.city}, ` : ""}{v.st}</small></span></div>
            ))}
          </div>
        </Link>
      </div>

      <div className="wd-grid2 wd-sec">
        <div className="card">
          <div className="card-h"><h3>The biggest checks in the closest races</h3><span className="eye" style={{ marginLeft: "auto" }}>General election</span></div>
          <div className="wd-list">
            {big.map((b, i) => (
              <Link key={i} href={`/watchdog/connections?name=${encodeURIComponent("g:" + b.name)}`} className="wd-row"><span><b>{b.name}</b><small>{b.kind === "oppose" ? "Against" : "For"} {b.target} · {b.race}</small></span><span className="wd-amt">{usd(b.amount)}</span></Link>
            ))}
            {m.tape.slice(0, 3).map((x, i) => (
              <div key={`t${i}`} className="wd-row"><span><b>{x.group}</b><small>{x.what} against {x.against}, via {x.vendor} · {x.date}</small></span><span className="wd-amt">{usd(x.amount)}</span></div>
            ))}
          </div>
        </div>
        <Link href="/watchdog/paid" className="card dk-card">
          <div className="card-h"><h3>Who gets paid</h3><span className="eye gold" style={{ marginLeft: "auto" }}>Open</span></div>
          <div className="wd-list">{topVend.map(([id, v]) => <div key={id} className="wd-row"><span><b>{name(id)}</b></span><span className="wd-amt">{usd(v)}</span></div>)}</div>
        </Link>
      </div>
      <p className="wd-src">Watchdog reads public reporting on FEC filings, Ledger (On Point&apos;s own FEC tracker), campaign announcements and news reports. A tie means money moved or a public act happened. It is never an accusation.</p>
    </>
  );
}
