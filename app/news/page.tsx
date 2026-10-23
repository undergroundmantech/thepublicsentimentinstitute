import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { getDesk, type Cov } from "./data";
import { CATS, OUTLETS, type Lean } from "./sources";
import { LeanBar, LeanTag, outletLean, outletName } from "./ui";
import LiveWire from "./LiveWire";
import { Blindspots, Compass, Edition, LeadPhoto, ScrollFx, SideBySide, WireCards, WireStats, WireTicker } from "./NewsFront";
import { getAx } from "../accountability/data";
import "./news.css";
import "./paper.css";

export const metadata: Metadata = {
  title: "News from every side",
  description: "Headlines from dozens of outlets rated Left, Center and Right, grouped by story, with neutral summaries written by the On Point Politics news desk.",
  alternates: { canonical: "https://onpointpolitics.com/news" },
};

const FONT = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap";
const fd = (iso: string) => new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const count = (cv: Cov[]) => { const n = { L: 0, C: 0, R: 0 } as Record<Lean, number>; const seen = new Set<string>(); for (const c of cv) { const k = c.o + (c.n ?? ""); if (seen.has(k)) continue; seen.add(k); n[outletLean(c.o)]++; } return n; };
/** One straight news headline per side for the lead story, newest first, opinion pieces only when a side has nothing else. */
const heads = (cv: Cov[]) => {
  const out: Partial<Record<Lean, Cov>> = {};
  for (const l of ["L", "C", "R"] as Lean[]) { const side = cv.filter((c) => outletLean(c.o) === l).sort((a, b) => b.d.localeCompare(a.d)); out[l] = side.find((c) => !c.op) ?? side[0]; }
  return out;
};
type Odds = { senate: number; house: number; governor: number; daysOut: number };
function odds(): Odds | null {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/forecast/model.json"), "utf8"));
    return { senate: m.chambers.senate.demControl, house: m.chambers.house.demControl, governor: m.chambers.governor.demControl, daysOut: m.meta.daysOut };
  } catch { return null; }
}
const pc = (x: number) => `${Math.round(x * 100)}%`;

export default function NewsPage() {
  const desk = getDesk();
  const [lead, ...rest] = desk.stories;
  const ax = getAx(); const ranked = ax.members.filter((m) => m.index != null).sort((a, b) => a.rank! - b.rank!);
  const o = odds();
  const updated = new Date(desk.updated).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  const nOut = OUTLETS.filter((x) => x.feeds.length).length;
  const leadN = new Set(lead.coverage.map((c) => c.o + (c.n ?? ""))).size;
  return (
    <div className="opp nw nw-front nwp-desk">
      <ScrollFx font={FONT} />
      <article className="nwp">
        <header className="np-mast">
          <div className="np-ear l" aria-label="Forecast">
            <b>The forecast</b>
            {o ? <><span>Senate <em>D {pc(o.senate)}</em></span><span>House <em>D {pc(o.house)}</em></span><span>Governors <em>D {pc(o.governor)}</em></span></> : <span>Updated daily</span>}
            <Link href="/forecast">Full forecast</Link>
          </div>
          <div className="np-plate">
            <span className="np-kick">On Point Politics</span>
            <h1>The News <i>from</i> Every Side</h1>
          </div>
          <div className="np-ear r">
            <b>{o ? `${o.daysOut} days` : "Countdown"}</b>
            <span>to Election Day, November 3</span>
            <Link href="/results/monitor">Situation monitor</Link>
          </div>
          <div className="np-edition"><Edition /><span>Late edition</span><span>{nOut} outlets, Left, Center and Right</span><span>Desk updated {updated} ET</span></div>
        </header>
        <nav className="np-nav" aria-label="News">
          <Link href="/news" aria-current="page">Front page</Link>
          <a href="#photos">Most covered</a>
          <a href="#compass">Coverage compass</a>
          <a href="#blindspots">Blindspots</a>
          <a href="#wire">The live wire</a>
          <Link href="/accountability">Accountability Index</Link>
          <Link href="/news/sources">Outlets and ratings</Link>
        </nav>
        <WireTicker />

        <section className="np-front" aria-labelledby="np-lead-h">
          <div className="np-lead">
            <LeadPhoto keys={lead.keys} />
            <span className="np-kicker">{CATS.find((c) => c.k === lead.cat)?.l} · {fd(lead.date)}</span>
            <h2 id="np-lead-h"><Link href={`/news/story/${lead.id}`}>{lead.title}</Link></h2>
            <p className="np-dek">{lead.dek}</p>
            <div className="np-cols">
              {lead.summary.slice(0, 3).map((p, i) => <p key={i} className={i === 0 ? "drop" : undefined}>{p}</p>)}
            </div>
            <div className="np-leadfoot">
              <LeanBar n={count(lead.coverage)} />
              <Link href={`/news/story/${lead.id}`} className="np-more">Continued: the full neutral summary, from {leadN} outlets</Link>
            </div>
          </div>
          <aside className="np-side">
            <h3 className="np-label">How each side headlined it</h3>
            <SideBySide heads={heads(lead.coverage)} />
            <h3 className="np-label">By the numbers</h3>
            <WireStats />
          </aside>
        </section>

        <section className="np-desk" aria-labelledby="np-desk-h">
          <div className="np-sec"><h2 id="np-desk-h">From the news desk</h2><span>Neutral summaries, every fact attributed</span></div>
          <div className="np-desk-g">
            {rest.map((s, i) => {
              const n = count(s.coverage); const t = n.L + n.C + n.R || 1;
              return (
                <Link key={s.id} href={`/news/story/${s.id}`} className={`np-story${i === 0 ? " wide" : ""}`} data-rv>
                  <div className="spec" aria-hidden="true"><i className="L" style={{ flex: n.L / t }} /><i className="C" style={{ flex: n.C / t }} /><i className="R" style={{ flex: n.R / t }} /></div>
                  <span className="np-kicker">{CATS.find((c) => c.k === s.cat)?.l} · {fd(s.date)}</span>
                  <h3>{s.title}</h3>
                  <p>{s.dek}</p>
                  <span className="np-by">{s.coverage.slice(0, 3).map((c) => outletName(c.o, c.n)).join(", ")}{s.coverage.length > 3 ? ` and ${s.coverage.length - 3} more` : ""}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section id="photos" className="np-photos" aria-labelledby="np-photos-h">
          <div className="np-sec"><h2 id="np-photos-h">Most covered right now</h2><span>Live from every outlet&apos;s feed</span></div>
          <WireCards n={9} />
        </section>

        <section id="compass" className="np-cmp" aria-label="Coverage compass"><Compass /></section>

        <section id="blindspots" aria-labelledby="np-bs-h">
          <div className="np-sec"><h2 id="np-bs-h">Blindspots</h2><span>What one side is covering and the other is not</span></div>
          <Blindspots />
        </section>

        <section className="np-ax" aria-labelledby="np-ax-h" data-rv>
          <div className="np-ax-l">
            <span className="np-kicker">New · Accountability Index</span>
            <h2 id="np-ax-h">Who do they answer to?</h2>
            <p>All {ax.count} members of Congress, scored from 0 to 100 for independence from special interest money: pro-Israel lobby money, PAC money and stock trading, with the America First Foundation, LCV and Heritage Action scorecards beside it.</p>
            <Link href="/accountability" className="np-btn">See every member</Link>
          </div>
          <div className="np-ax-r">
            <div><h3 className="np-label">Most independent</h3><ol>{ranked.slice(0, 4).map((m) => <li key={m.id}><Link href={`/accountability/${m.slug}`}><span className={`pt p-${m.party}`}>{m.party}</span>{m.name}<b>{m.index!.toFixed(1)}</b></Link></li>)}</ol></div>
            <div><h3 className="np-label">Least independent</h3><ol>{ranked.slice(-4).reverse().map((m) => <li key={m.id}><Link href={`/accountability/${m.slug}`}><span className={`pt p-${m.party}`}>{m.party}</span>{m.name}<b>{m.index!.toFixed(1)}</b></Link></li>)}</ol></div>
          </div>
        </section>

        <div id="wire" className="np-wire"><LiveWire limit={60} blind={false} /></div>

        <section className="np-how" aria-labelledby="np-how-h">
          <h2 id="np-how-h">How this works</h2>
          <div className="np-how-g">
            <div><h3>Ratings are ours</h3><p>Every outlet carries an On Point Politics rating of Left, Center or Right, judged on story selection, headline framing, sourcing and the outlet&apos;s own stated positions. Wire copy that a network republishes is credited to the wire. <Link href="/news/sources">See every rating and why</Link>.</p></div>
            <div><h3>Headlines are theirs</h3><p>The live wire shows each outlet&apos;s own headline and links to its own page. We group headlines about the same event; we do not rewrite them. Opinion pieces are marked. Pictures are the outlets&apos; own and link back to them.</p></div>
            <div><h3>Summaries are attributed</h3><p>Each summary is written from the linked reporting and names the outlet behind every fact. Claims by candidates and officials are given as claims. See something wrong? <Link href="/contact">Tell us</Link> and we will correct it with a note.</p></div>
          </div>
          <div className="nw-legend"><LeanTag lean="L" /><LeanTag lean="C" /><LeanTag lean="R" /><span>The bar under each story is the share of outlets on each side carrying it.</span></div>
        </section>
      </article>
    </div>
  );
}
