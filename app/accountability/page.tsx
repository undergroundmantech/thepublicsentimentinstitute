import type { Metadata } from "next";
import Link from "next/link";
import { dotOf, getAx, GRADES, money, PARTS, PART_LABEL, PARTY_LABEL, type Member } from "./data";
import AxTable, { Grade, type Row } from "./AxTable";
import { Chambers, MoneyMap } from "./AxViz";
import "./accountability.css";

export const metadata: Metadata = {
  title: "Accountability Index",
  description: "Every member of Congress scored for independence from special interest money: pro-Israel lobby money, PAC money, stock trading and eight left and right scorecards blended so neither party starts ahead.",
  alternates: { canonical: "https://onpointpolitics.com/accountability" },
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function Board({ title, note, list, value, tone }: { title: string; note: string; list: Member[]; value: (m: Member) => React.ReactNode; tone: string }) {
  return (
    <div className={`ax-lb t-${tone}`}>
      <div className="ax-lb-h"><h3>{title}</h3><span>{note}</span></div>
      <ol>{list.map((m, i) => (
        <li key={m.id}><Link href={`/accountability/${m.slug}`}><i className="n">{i + 1}</i><span className={`pt p-${m.party}`}>{m.party}</span><b>{m.name}</b><span className="seat">{m.seat}</span><span className="v">{value(m)}</span></Link></li>
      ))}</ol>
    </div>
  );
}

export default function AccountabilityPage() {
  const ax = getAx();
  const M = ax.members;
  const ranked = M.filter((m) => m.index != null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const rows: Row[] = M.map((m) => ({
    slug: m.slug, name: m.name, last: m.last, ch: m.ch, st: m.st, seat: m.seat, party: m.party,
    index: m.index ?? null, grade: m.grade ?? null, rank: m.rank ?? null, cov: m.coverage, parts: m.parts, imputed: m.imputed ?? [],
    lobby: m.lobby.amount ?? null, lobbyNote: m.lobby.missing ? (m.lobby.missing === "page could not be read" ? "Not read" : "Not listed") : null,
    pacShare: m.money?.pacShare ?? null, trades: m.trades.n, vol: m.trades.volume,
    cross: m.parts.cross ?? null, sL: m.side.L, sR: m.side.R,
  }));
  const states = [...new Set(M.map((m) => m.st))].sort();
  const by = (p: "D" | "R") => avg(ranked.filter((m) => m.party === p).map((m) => m.index!));
  const byCh = (c: "S" | "H") => avg(ranked.filter((m) => m.ch === c).map((m) => m.index!));
  const gc = Object.fromEntries(GRADES.map((g) => [g.g, ranked.filter((m) => m.grade === g.g).length]));
  const lobbyTop = [...M].filter((m) => m.lobby.amount).sort((a, b) => (b.lobby.amount ?? 0) - (a.lobby.amount ?? 0)).slice(0, 6);
  const tradeTop = [...M].filter((m) => m.trades.n).sort((a, b) => b.trades.n - a.trades.n).slice(0, 6);
  const others = ax.others.filter((o) => o.amount != null || o.amount_text);
  const dots = M.map(dotOf);
  const tot = Object.values(ax.weights).reduce((a, b) => a + b, 0);

  return (
    <div className="opp ax ax-x">
      <header className="ax-hero">
        <div className="ax-hero-l">
          <div className="eye gold"><i className="live" />On Point Politics · Accountability Index</div>
          <h1>Who do they <em>answer to?</em></h1>
          <p className="lede">All {ax.count} members of Congress, scored from 0 to 100 for independence from special interest money and conflicts. Higher means more independent. Four measures go in: career money from the pro-Israel lobby, the share of campaign money from PACs, stock trading, and crossing the aisle, a blend of eight interest group scorecards, four from the left and four from the right, rescaled so neither party starts ahead.</p>
          <div className="ax-weights" aria-label="What goes into the index">
            {PARTS.map((k) => <div key={k} className={`w p-${k}`} style={{ flex: ax.weights[k] }}><i /><b>{Math.round((100 * ax.weights[k]) / tot)}%</b><span>{PART_LABEL[k]}</span></div>)}
          </div>
          <nav className="ax-sub" aria-label="Accountability">
            <Link href="/accountability" aria-current="page">The index</Link>
            <a href="#chambers">The chambers</a>
            <a href="#money">The money map</a>
            <a href="#board">Every member</a>
            <a href="#beyond">Beyond Congress</a>
            <Link href="/accountability/methodology">How it works</Link>
          </nav>
        </div>
        <div className="ax-hero-r">
          <div className="ax-kpi"><span>Members scored</span><b>{ax.ranked}</b><em>of {ax.count} in office</em></div>
          <div className="ax-kpi d"><span>Democrats</span><b>{by("D").toFixed(1)}</b><em>average index</em></div>
          <div className="ax-kpi r"><span>Republicans</span><b>{by("R").toFixed(1)}</b><em>average index</em></div>
          <div className="ax-kpi"><span>Senate · House</span><b>{byCh("S").toFixed(1)}<small> · </small>{byCh("H").toFixed(1)}</b><em>chamber averages</em></div>
          <div className="ax-gradebar" aria-label="Members by grade">
            {GRADES.map((g) => <div key={g.g} className={`gb g-${g.g}`} style={{ flex: gc[g.g] || 0.001 }} title={`${g.g}: ${gc[g.g]} members, ${g.note}`}><b>{g.g}</b><span>{gc[g.g]}</span></div>)}
          </div>
        </div>
      </header>

      <section id="chambers" className="ax-panel" aria-labelledby="ax-ch-h">
        <div className="ax-sec-h"><h2 id="ax-ch-h">The chambers, seat by seat</h2><span className="eye">lowest index on the left, highest on the right</span></div>
        <Chambers dots={dots} />
      </section>

      <section className="ax-lbs" aria-label="Leaders">
        <Board tone="hi" title="Most independent" note="highest index" list={ranked.slice(0, 6)} value={(m) => <><b>{m.index!.toFixed(1)}</b><Grade g={m.grade!} /></>} />
        <Board tone="lo" title="Least independent" note="lowest index" list={ranked.slice(-6).reverse()} value={(m) => <><b>{m.index!.toFixed(1)}</b><Grade g={m.grade!} /></>} />
        <Board tone="lobby" title="Most pro-Israel lobby money" note="TrackAIPAC, career" list={lobbyTop} value={(m) => <b>{money(m.lobby.amount)}</b>} />
        <Board tone="trading" title="Most stock trades" note="Quiver, last year" list={tradeTop} value={(m) => <b>{m.trades.n.toLocaleString()}</b>} />
      </section>

      <section id="money" className="ax-panel" aria-labelledby="ax-mm-h">
        <div className="ax-sec-h"><h2 id="ax-mm-h">The money map</h2><span className="eye">lobby money across, PAC money up</span></div>
        <MoneyMap dots={dots} />
      </section>

      <div id="board"><AxTable rows={rows} states={states} /></div>

      <section id="beyond" className="ax-beyond">
        <div className="ax-sec-h"><h2>Beyond Congress</h2><span className="eye">lobby money only, for now</span></div>
        <p className="ax-note">Governors, candidates and members of the administration are not scored yet. TrackAIPAC lists pro-Israel lobby money for {others.length} of them, shown here exactly as the site gives it.</p>
        <div className="ax-tw"><table className="ax-t ax-ot">
          <thead><tr><th scope="col">Name</th><th scope="col">Office or race</th><th scope="col">Party</th><th scope="col">Lobby money</th><th scope="col">As TrackAIPAC labels it</th></tr></thead>
          <tbody>{others.map((o) => <tr key={o.name + o.office}><td className="nm"><b>{o.name}</b></td><td>{o.office}</td><td>{o.party ? PARTY_LABEL[o.party as "D" | "R" | "I"] ?? o.party : ""}</td><td className="num">{o.amount != null ? money(o.amount) : o.amount_text}</td><td className="lbl"><a href={o.url} target="_blank" rel="noopener noreferrer">{o.label}</a></td></tr>)}</tbody>
        </table></div>
      </section>

      <section className="ax-how">
        <h2>What the index measures</h2>
        <div className="ax-how-g">
          <div className="p-lobby"><h3>Pro-Israel lobby money <span>{ax.weights.lobby}%</span></h3><p>The career total TrackAIPAC reports from pro-Israel PACs, their large donors and their outside spending. Zero scores 100, and each tenfold increase costs about a quarter of the scale, reaching 0 at $10 million.</p></div>
          <div className="p-pac"><h3>PAC money share <span>{ax.weights.pac}%</span></h3><p>The share of this cycle&apos;s campaign receipts from PACs and other non-party committees, from FEC filings. No PAC money scores 100; 70 percent or more scores 0.</p></div>
          <div className="p-trading"><h3>Stock trading <span>{ax.weights.trading}%</span></h3><p>Stock trades reported in the last year and their estimated volume. No trades scores 100, and the score falls as trades and volume grow.</p></div>
          <div className="p-cross"><h3>Crossing the aisle <span>{ax.weights.cross}%</span></h3><p>Eight scorecards: {ax.cards.filter((c) => c.lean === "L").map((c) => c.name).join(", ")} on the left; {ax.cards.filter((c) => c.lean === "R").map((c) => c.name).join(", ")} on the right, every card counting the same. Each is rescaled so the average Democrat and average Republican sit at the same points, then the two sides are averaged. A typical member of either party scores about 50; earning credit from both sides scores higher.</p></div>
        </div>
        <p className="ax-foot">A measure with no data takes the median of every member, so a gap neither helps nor hurts. Votes that helped donors are not scored yet. Read the <Link href="/accountability/methodology">full method, sources and every known gap</Link>.</p>
      </section>
    </div>
  );
}
