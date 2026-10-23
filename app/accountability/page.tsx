import type { Metadata } from "next";
import Link from "next/link";
import { getAx, GRADES, money, PARTY_LABEL, type Member } from "./data";
import AxTable, { Grade, type Row } from "./AxTable";
import "./accountability.css";

export const metadata: Metadata = {
  title: "Accountability Index",
  description: "Every member of Congress scored for independence from special interest money: pro-Israel lobby money, PAC money and stock trading, with the America First Foundation, LCV and Heritage Action scorecards beside it.",
  alternates: { canonical: "https://onpointpolitics.com/accountability" },
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function Board({ title, note, list, value }: { title: string; note: string; list: Member[]; value: (m: Member) => React.ReactNode }) {
  return (
    <div className="card ax-lb">
      <div className="card-h"><h3>{title}</h3><span className="eye">{note}</span></div>
      <ol>{list.map((m) => (
        <li key={m.id}><Link href={`/accountability/${m.slug}`}><span className={`pt p-${m.party}`}>{m.party}</span><b>{m.name}</b><span className="seat">{m.seat}</span><span className="v">{value(m)}</span></Link></li>
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
    index: m.index ?? null, grade: m.grade ?? null, rank: m.rank ?? null, cov: m.coverage,
    lobby: m.lobby.amount ?? null, lobbyNote: m.lobby.missing ? (m.lobby.missing === "page could not be read" ? "Not read" : "Not listed") : null,
    pacShare: m.money?.pacShare ?? null, trades: m.trades.n, vol: m.trades.volume,
    aff: m.aff?.grade ?? null, lcv: m.lcv?.score ?? null, her: m.heritage?.score ?? null,
  }));
  const states = [...new Set(M.map((m) => m.st))].sort();
  const by = (p: "D" | "R") => avg(ranked.filter((m) => m.party === p).map((m) => m.index!));
  const byCh = (c: "S" | "H") => avg(ranked.filter((m) => m.ch === c).map((m) => m.index!));
  const gc = Object.fromEntries(GRADES.map((g) => [g.g, ranked.filter((m) => m.grade === g.g).length]));
  // distribution, 5 point bins
  const bins = Array.from({ length: 20 }, (_, i) => ({ lo: i * 5, D: 0, R: 0, I: 0 }));
  for (const m of ranked) { const b = bins[Math.min(19, Math.floor(m.index! / 5))]; b[m.party]++; }
  const maxB = Math.max(...bins.map((b) => b.D + b.R + b.I));
  const lobbyTop = [...M].filter((m) => m.lobby.amount).sort((a, b) => (b.lobby.amount ?? 0) - (a.lobby.amount ?? 0)).slice(0, 6);
  const tradeTop = [...M].filter((m) => m.trades.n).sort((a, b) => b.trades.n - a.trades.n).slice(0, 6);
  const others = ax.others.filter((o) => o.amount != null || o.amount_text);

  return (
    <div className="opp ax">
      <header className="ax-head">
        <div>
          <div className="eye gold">On Point Politics · Accountability Index</div>
          <h1>Who do they <em>answer to?</em></h1>
          <p className="lede">Every one of the {ax.count} members of Congress, scored from 0 to 100 for independence from special interest money and conflicts: career money from the pro-Israel lobby, the share of campaign money that comes from PACs, and stock trading. The higher the score, the more independent. Ideological scorecards from the America First Foundation, the League of Conservation Voters and Heritage Action sit beside it so you can see where each member stands, but they never move the score.</p>
        </div>
        <nav className="ax-sub" aria-label="Accountability">
          <Link href="/accountability" aria-current="page">The index</Link>
          <a href="#board">Every member</a>
          <a href="#beyond">Beyond Congress</a>
          <Link href="/accountability/methodology">How it works</Link>
        </nav>
      </header>

      <section className="ax-glance" aria-label="At a glance">
        <div className="ax-kpis">
          <div className="card ax-kpi"><span className="eye">Members scored</span><b>{ax.ranked}</b><span>of {ax.count} in office</span></div>
          <div className="card ax-kpi"><span className="eye">Democrats, average</span><b className="d">{by("D").toFixed(1)}</b><span>{ranked.filter((m) => m.party === "D").length} members</span></div>
          <div className="card ax-kpi"><span className="eye">Republicans, average</span><b className="r">{by("R").toFixed(1)}</b><span>{ranked.filter((m) => m.party === "R").length} members</span></div>
          <div className="card ax-kpi"><span className="eye">Senate and House</span><b>{byCh("S").toFixed(1)} <small>and</small> {byCh("H").toFixed(1)}</b><span>chamber averages</span></div>
        </div>
        <div className="card ax-dist">
          <div className="card-h"><h3>How Congress scores</h3><span className="eye">members per 5 points</span></div>
          <svg viewBox="0 0 400 130" role="img" aria-label="Distribution of index scores by party">
            {bins.map((b, i) => {
              const x = 8 + i * 19.2, H = 96, t = b.D + b.R + b.I; let y = 104;
              return <g key={i}>{(["D", "I", "R"] as const).map((p) => { const h = (b[p] / maxB) * H; y -= h; return h ? <rect key={p} x={x} y={y} width={16} height={h} rx={2} className={`b-${p}`} /> : null; })}<title>{`${b.lo} to ${b.lo + 5}: ${t} members, ${b.D} D, ${b.R} R${b.I ? `, ${b.I} I` : ""}`}</title></g>;
            })}
            {[0, 25, 50, 75, 100].map((v) => <text key={v} x={8 + (v / 5) * 19.2} y={122} className="ax-tick" textAnchor={v === 100 ? "end" : v ? "middle" : "start"}>{v}</text>)}
          </svg>
          <div className="ax-gl">{GRADES.map((g) => <span key={g.g}><Grade g={g.g} /> {gc[g.g]}</span>)}</div>
        </div>
      </section>

      <section className="ax-lbs" aria-label="Leaders">
        <Board title="Most independent" note="highest index" list={ranked.slice(0, 6)} value={(m) => <><b>{m.index!.toFixed(1)}</b><Grade g={m.grade!} /></>} />
        <Board title="Least independent" note="lowest index" list={ranked.slice(-6).reverse()} value={(m) => <><b>{m.index!.toFixed(1)}</b><Grade g={m.grade!} /></>} />
        <Board title="Most pro-Israel lobby money" note="TrackAIPAC, career" list={lobbyTop} value={(m) => <b>{money(m.lobby.amount)}</b>} />
        <Board title="Most stock trades" note="Quiver, last year" list={tradeTop} value={(m) => <b>{m.trades.n.toLocaleString()}</b>} />
      </section>

      <div id="board"><AxTable rows={rows} states={states} /></div>

      <section id="beyond" className="ax-beyond">
        <div className="ax-sec-h"><h2>Beyond Congress</h2><span className="eye">lobby money only, for now</span></div>
        <p className="ax-note">Governors, candidates and members of the administration are not scored yet. TrackAIPAC lists pro-Israel lobby money for {others.length} of them, shown here exactly as the site gives it. Full scores for governors and 2028 candidates come next.</p>
        <div className="ax-tw"><table className="ax-t ax-ot">
          <thead><tr><th scope="col">Name</th><th scope="col">Office or race</th><th scope="col">Party</th><th scope="col">Lobby money</th><th scope="col">As TrackAIPAC labels it</th></tr></thead>
          <tbody>{others.map((o) => <tr key={o.name + o.office}><td className="nm"><b>{o.name}</b></td><td>{o.office}</td><td>{o.party ? PARTY_LABEL[o.party as "D" | "R" | "I"] ?? o.party : ""}</td><td className="num">{o.amount != null ? money(o.amount) : o.amount_text}</td><td className="lbl"><a href={o.url} target="_blank" rel="noopener noreferrer">{o.label}</a></td></tr>)}</tbody>
        </table></div>
      </section>

      <section className="card ax-how">
        <h2>What the index measures</h2>
        <div className="ax-how-g">
          <div><h3>Pro-Israel lobby money <span>{ax.weights.lobby}%</span></h3><p>The career total TrackAIPAC reports from pro-Israel PACs, their large donors and their outside spending for a member. Zero scores 100, and each tenfold increase costs about a quarter of the scale, reaching 0 at $10 million.</p></div>
          <div><h3>PAC money share <span>{ax.weights.pac}%</span></h3><p>The share of this cycle&apos;s campaign receipts that came from PACs and other non-party committees, from the member&apos;s FEC filings. No PAC money scores 100; 70 percent or more scores 0.</p></div>
          <div><h3>Stock trading <span>{ax.weights.trading}%</span></h3><p>The number of stock trades the member reported in the last year and their estimated dollar volume. No reported trades scores 100, and the score falls as trades and volume grow.</p></div>
          <div><h3>Votes that helped donors <span>coming</span></h3><p>Matching each vote to the industries that fund a member needs donor industry data we cannot yet read reliably. Until we can, this part is not scored and the index says so.</p></div>
        </div>
        <p className="ax-foot">The index is a measure of money and conflicts, not of ideology or of whether a member votes well. Read the <Link href="/accountability/methodology">full method, sources and every known gap</Link>. Updated {new Date(ax.updated + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}.</p>
      </section>
    </div>
  );
}

