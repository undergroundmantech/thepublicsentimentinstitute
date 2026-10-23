import type { Metadata } from "next";
import Link from "next/link";
import { getDesk, type Cov } from "./data";
import { CATS, OUTLETS, type Lean } from "./sources";
import { LeanBar, LeanTag, outletLean, outletName } from "./ui";
import LiveWire from "./LiveWire";
import { Blindspots, Compass, SideBySide, WireCards, WireStats, WireTicker } from "./NewsFront";
import { getAx } from "../accountability/data";
import "./news.css";

export const metadata: Metadata = {
  title: "News from every side",
  description: "Headlines from dozens of outlets rated Left, Center and Right, grouped by story, with neutral summaries written by the On Point Politics news desk.",
  alternates: { canonical: "https://onpointpolitics.com/news" },
};

const fd = (iso: string) => new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const count = (cv: Cov[]) => { const n = { L: 0, C: 0, R: 0 } as Record<Lean, number>; const seen = new Set<string>(); for (const c of cv) { const k = c.o + (c.n ?? ""); if (seen.has(k)) continue; seen.add(k); n[outletLean(c.o)]++; } return n; };
/** One straight news headline per side for the lead story, newest first, opinion pieces only when a side has nothing else. */
const heads = (cv: Cov[]) => {
  const out: Partial<Record<Lean, Cov>> = {};
  for (const l of ["L", "C", "R"] as Lean[]) { const side = cv.filter((c) => outletLean(c.o) === l).sort((a, b) => b.d.localeCompare(a.d)); out[l] = side.find((c) => !c.op) ?? side[0]; }
  return out;
};

export default function NewsPage() {
  const desk = getDesk();
  const [lead, ...rest] = desk.stories;
  const ax = getAx(); const ranked = ax.members.filter((m) => m.index != null).sort((a, b) => a.rank! - b.rank!);
  const updated = new Date(desk.updated).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return (
    <div className="opp nw nw-front">
      <header className="nw-mast">
        <div className="nw-mast-l">
          <div className="eye gold"><i className="live" />On Point Politics · News desk</div>
          <h1>The news, <em>from every side.</em></h1>
          <p className="lede">Headlines from {OUTLETS.filter((o) => o.feeds.length).length} outlets we rate Left, Center or Right, grouped by story so you can see who is covering what, how each side tells it, and what each side is leaving out.</p>
          <nav className="nw-sub" aria-label="News">
            <Link href="/news" aria-current="page">Front page</Link>
            <a href="#compass">Coverage compass</a>
            <a href="#blindspots">Blindspots</a>
            <a href="#wire">The live wire</a>
            <Link href="/accountability">Accountability Index</Link>
            <Link href="/news/sources">Outlets and ratings</Link>
          </nav>
        </div>
        <WireStats />
      </header>
      <WireTicker />

      <section className="nw-lead2" aria-labelledby="nw-lead-h">
        <Link href={`/news/story/${lead.id}`} className="nw-lead2-main">
          <span className="nw-kick"><b>Lead story</b>{CATS.find((c) => c.k === lead.cat)?.l} · {fd(lead.date)}</span>
          <h2 id="nw-lead-h">{lead.title}</h2>
          <p className="dek">{lead.dek}</p>
          <p className="sum">{lead.summary[0]}</p>
          <LeanBar n={count(lead.coverage)} />
          <span className="go">Read the neutral summary, from {new Set(lead.coverage.map((c) => c.o + (c.n ?? ""))).size} outlets</span>
        </Link>
        <div className="nw-lead2-side">
          <h3 className="nw-mini-h">How each side headlined it</h3>
          <SideBySide heads={heads(lead.coverage)} />
        </div>
      </section>

      <section className="nw-desk" aria-labelledby="nw-desk-h">
        <div className="nw-sec-h"><h2 id="nw-desk-h">More from the news desk</h2><span className="eye">neutral summaries · updated {updated} ET</span></div>
        <div className="nw-desk-g">
          {rest.map((s) => {
            const n = count(s.coverage); const t = n.L + n.C + n.R || 1;
            return (
              <Link key={s.id} href={`/news/story/${s.id}`} className="card nw-dcard">
                <div className="spec" aria-hidden="true"><i className="L" style={{ flex: n.L / t }} /><i className="C" style={{ flex: n.C / t }} /><i className="R" style={{ flex: n.R / t }} /></div>
                <span className="nw-cat">{CATS.find((c) => c.k === s.cat)?.l} · {fd(s.date)}</span>
                <h3>{s.title}</h3>
                <p>{s.dek}</p>
                <span className="nw-src">{s.coverage.slice(0, 3).map((c) => outletName(c.o, c.n)).join(", ")}{s.coverage.length > 3 ? ` and ${s.coverage.length - 3} more` : ""}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="nw-now" aria-labelledby="nw-now-h">
        <div className="nw-sec-h"><h2 id="nw-now-h">Most covered right now</h2><span className="eye">live from every outlet&apos;s feed</span></div>
        <WireCards n={9} />
      </section>

      <section id="compass" className="nw-cmp" aria-label="Coverage compass">
        <Compass />
      </section>

      <section id="blindspots" aria-labelledby="nw-bs-h">
        <div className="nw-sec-h"><h2 id="nw-bs-h">Blindspots</h2><span className="eye">what one side is covering and the other is not</span></div>
        <Blindspots />
      </section>

      <section className="nw-ax" aria-labelledby="nw-ax-h">
        <div className="nw-ax-l">
          <span className="nw-kick"><b>New</b>Accountability Index</span>
          <h2 id="nw-ax-h">Who do they answer to?</h2>
          <p>All {ax.count} members of Congress, scored from 0 to 100 for independence from special interest money: pro-Israel lobby money, PAC money and stock trading, with the America First Foundation, LCV and Heritage Action scorecards beside it.</p>
          <Link href="/accountability" className="btn g">See every member</Link>
        </div>
        <div className="nw-ax-r">
          <div><h3>Most independent</h3><ol>{ranked.slice(0, 4).map((m) => <li key={m.id}><Link href={`/accountability/${m.slug}`}><span className={`pt p-${m.party}`}>{m.party}</span>{m.name}<b>{m.index!.toFixed(1)}</b></Link></li>)}</ol></div>
          <div><h3>Least independent</h3><ol>{ranked.slice(-4).reverse().map((m) => <li key={m.id}><Link href={`/accountability/${m.slug}`}><span className={`pt p-${m.party}`}>{m.party}</span>{m.name}<b>{m.index!.toFixed(1)}</b></Link></li>)}</ol></div>
        </div>
      </section>

      <div id="wire"><LiveWire limit={60} blind={false} /></div>

      <section className="nw-how card">
        <h2>How this works</h2>
        <div className="nw-how-g">
          <div><h3>Ratings are ours</h3><p>Every outlet carries an On Point Politics rating of Left, Center or Right, judged on story selection, headline framing, sourcing and the outlet&apos;s own stated positions. Wire copy that a network republishes is credited to the wire. <Link href="/news/sources">See every rating and why</Link>.</p></div>
          <div><h3>Headlines are theirs</h3><p>The live wire shows each outlet&apos;s own headline and links to its own page. We group headlines about the same event; we do not rewrite them. Opinion pieces are marked.</p></div>
          <div><h3>Summaries are attributed</h3><p>Each summary is written from the linked reporting and names the outlet behind every fact. Claims by candidates and officials are given as claims. See something wrong? <Link href="/contact">Tell us</Link> and we will correct it with a note.</p></div>
        </div>
        <div className="nw-legend"><LeanTag lean="L" /><LeanTag lean="C" /><LeanTag lean="R" /><span>The bar under each story is the share of outlets on each side carrying it.</span></div>
      </section>
    </div>
  );
}
