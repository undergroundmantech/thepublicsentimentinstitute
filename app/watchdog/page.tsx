import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { getEndorsements, getGraph, getMoney, getPeople, getTrail, usd } from "./data";
import { WD_GROUPS, ToolIcon, type ToolKey } from "./tools";
import { Pointy } from "@/app/components/home/Mascot";
import PersonToken from "./PersonToken";
import fs from "node:fs";
import path from "node:path";
import "./desk.css";
import { getWarIndex } from "./war-room/data";

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
  const today = new Date().toISOString().slice(0, 10);
  const soon = t.visits.filter((v) => v.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = (soon.length ? soon : t.visits.slice(-6)).slice(0, 6);
  const P = Object.fromEntries(t.people.map((p) => [p.name, p]));
  const big = m.races.flatMap((r) => r.groups.slice(0, 2).map((gr) => ({ ...gr, race: r.key }))).sort((a, b) => b.amount - a.amount).slice(0, 6);
  const maxR = m.races[0]?.total ?? 1;
  const en = getEndorsements();
  const endorseN = en.races.reduce((a, r) => a + r.n, 0), mediaItems = en.media.reduce((a, x) => a + x.items.length, 0);
  const vendTotal = [...vend.values()].reduce((a, v) => a + v, 0);
  const topRace = m.races[0];
  const day = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const next = upcoming[0];
  const num = (n: number) => n.toLocaleString("en-US");
  // what each Start here card shows: the number that answers its question, and one sentence of what is inside
  const START: Record<ToolKey, { stat: string; unit: string; line: string } | undefined> = {
    desk: undefined,
    warroom: (() => { const w = getWarIndex(); const close = w.races.filter((r) => r.p > 0.1 && r.p < 0.9); return { stat: `${w.races.length} races`, unit: "with a health score for both campaigns and a path to victory for each side", line: `${close.length} are competitive. Brief yourself as either side's operative.` }; })(),
    money: { stat: usd(total), unit: `in outside money across ${m.races.length} Senate and governor races`, line: topRace ? `${STN[topRace.st] ?? topRace.st} draws the most, ${usd(topRace.total)}.` : "" },
    paid: { stat: `${vend.size} firms`, unit: `paid ${usd(vendTotal)} by the groups and campaigns we track`, line: topVend[0] ? `${name(topVend[0][0])} was paid the most, ${usd(topVend[0][1])}.` : "" },
    people: (() => { const pp = getPeople(); return { stat: `${num(pp.n)} files`, unit: "on every member of Congress, governor and 2026 nominee", line: `${pp.hand} researched in full, with every money tie sourced.` }; })(),
    connections: { stat: `${num(g.edges.length)} ties`, unit: `between ${num(g.nodes.length)} donors, groups, candidates, firms and public figures`, line: topDonors[0] ? `${name(topDonors[0][0])} alone gave ${usd(topDonors[0][1])}. See where it went.` : "" },
    trail: { stat: `${t.visits.length} stops`, unit: `by ${t.people.filter((p) => p.visits).length} nominees and national figures since August`, line: next ? `Next on the list: ${next.who} in ${next.city ? `${next.city}, ` : ""}${next.st} on ${day(next.date)}.` : "" },
    endorsements: { stat: num(endorseN), unit: `endorsements across ${en.races.length} Senate and governor races`, line: "Each one links to where it was reported." },
    media: { stat: `${en.media.length} voices`, unit: `and the ${mediaItems} times they put a race in front of their audience`, line: "Podcasters, hosts, streamers and political reporters." },
    counties: { stat: "3,142", unit: "counties, each with results, the forecast and local data", line: `${fights} of ${dc.projects.length} data center projects face organized local opposition.` },
  };
  return (
    <>
      <header className="wd-hero dk-hero">
        <div>
          <div className="eye gold">Watchdog · On Point Politics</div>
          <h1>Follow the money. <em>Follow the people.</em></h1>
          <p className="lede">Watchdog tracks who is paying for the 2026 midterms, where that money goes, which firms get paid and which national figures are out campaigning. Every tie is sourced. Pick a question below to start.</p>
          <div className="dk-cta"><a className="btn g" href="#start">Pick a question</a><Link className="btn" href="/watchdog/war-room">Open the War Room</Link><Link className="btn" href="/watchdog/connections">See who is tied to whom</Link></div>
        </div>
        <div className="dk-badge" aria-hidden="true">
          <div className="dk-radar"><i /><i /><i /><span className="dk-sweep" /></div>
          <Pointy className="dk-pty keep" pose="point" prop="magnifier" size={190} look={-1} flip detective />
        </div>
      </header>

      <section id="start" className="dk-start" aria-labelledby="dk-start-h">
        <div className="dk-start-h">
          <h2 id="dk-start-h">Start here. What do you want to know?</h2>
          <p>Each card answers one question. Open it to see the full picture, with a source on every line.</p>
        </div>
        <div className="dk-groups">
          {WD_GROUPS.map((gr) => (
            <div key={gr.key} className={`dk-group dk-g-${gr.key}`}>
              <div className="dk-group-l">{gr.label}</div>
              <div className="dk-qs">
                {gr.tools.map((tool, i) => { const s = START[tool.key]; return (
                  <Link key={tool.key} href={tool.href} className="card dk-q" style={{ animationDelay: `${i * 0.06}s` }}>
                    <span className="dk-q-top"><span className="dk-q-ico"><ToolIcon k={tool.key} size={20} /></span><span className="dk-q-tool">{tool.label}</span></span>
                    <h3>{tool.question}</h3>
                    {s ? <p className="dk-q-stat"><b>{s.stat}</b> {s.unit}</p> : null}
                    <p className="dk-q-line">{s?.line || tool.desc}</p>
                    <span className="dk-q-go">Open {tool.label}</span>
                  </Link>
                ); })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="dk-start-h dk-today">
        <h2>What the data shows today</h2>
        <p>A first look from three of the tools. Click any panel to open it.</p>
      </div>

      <div className="dk-grid">
        <Link href="/watchdog/money" className="card dk-card">
          <div className="card-h"><h3>Outside money by state</h3><span className="eye gold" style={{ marginLeft: "auto" }}>Money flow</span></div>
          <div className="card-b">
            {m.races.slice(0, 7).map((r, i) => (
              <div key={r.key} className="dk-race"><span>{STN[r.st] ?? r.st}</span><span className="wd-bar"><i style={{ width: `${((r.forD ?? 0) / maxR) * 100}%`, background: "#3d7bff", animationDelay: `${i * 0.06}s` }} /><i style={{ width: `${((r.forR ?? 0) / maxR) * 100}%`, background: "#ff3b5c", animationDelay: `${i * 0.06 + 0.1}s` }} /></span><b className="mono">{usd(r.total)}</b></div>
            ))}
          </div>
        </Link>
        <Link href="/watchdog/connections" className="card dk-card dk-orbit-card">
          <div className="card-h"><h3>The biggest donors</h3><span className="eye gold" style={{ marginLeft: "auto" }}>Connections</span></div>
          <svg viewBox="0 0 400 260" className="dk-orbit" aria-hidden="true">
            <circle cx="200" cy="130" r="58" className="ring" /><circle cx="200" cy="130" r="104" className="ring b" />
            <g className="spin">{topDonors.map(([id, v], i) => { const a = (i / topDonors.length) * Math.PI * 2; const x = 200 + Math.cos(a) * 104, y = 130 + Math.sin(a) * 104 * 0.85; return <g key={id}><path d={`M${x},${y} Q200,${130 - 40} 200,130`} className="tie" /><circle cx={x} cy={y} r={5 + Math.sqrt(v / (topDonors[0][1] || 1)) * 9} className="don" /><circle r="3" className="mote"><animateMotion dur={`${2.4 + i * 0.3}s`} repeatCount="indefinite" path={`M${x},${y} Q200,${130 - 40} 200,130`} /></circle></g>; })}</g>
            <rect x="186" y="116" width="28" height="28" rx="6" className="hub" />
          </svg>
          <div className="card-b dk-names">{topDonors.slice(0, 4).map(([id, v]) => <span key={id}>{name(id)} <b className="g">{usd(v)}</b></span>)}</div>
        </Link>
        <Link href="/watchdog/trail" className="card dk-card">
          <div className="card-h"><h3>Next on the campaign trail</h3><span className="eye gold" style={{ marginLeft: "auto" }}>Campaign trail</span></div>
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
          <div className="card-h"><h3>The firms paid the most</h3><span className="eye gold" style={{ marginLeft: "auto" }}>Who gets paid</span></div>
          <div className="wd-list">{topVend.map(([id, v]) => <div key={id} className="wd-row"><span><b>{name(id)}</b></span><span className="wd-amt">{usd(v)}</span></div>)}</div>
        </Link>
      </div>
      <p className="wd-src">Watchdog reads public reporting on FEC filings, Ledger (On Point&apos;s own FEC tracker), campaign announcements and news reports. A tie means money moved or a public act happened. It is never an accusation.</p>
    </>
  );
}
