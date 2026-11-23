// One week's "what moved": the headline numbers, the states that changed rating, the nomination odds and the reasons.
import Link from "@/app/components/Link";
import { RATES } from "@/app/2028/rate28";
import { day, mg, type WmEntry } from "./data";
import "@/app/components/community.css";

const RC: Record<string, string> = Object.fromEntries(RATES.map((r) => [r.label, r.color]));
const INK: Record<string, string> = Object.fromEntries(RATES.map((r) => [r.label, r.ink]));
const chip = (r: string) => <span className="wm-chip" style={{ background: RC[r], color: INK[r] }}>{r}</span>;
const pct = (x: number) => `${(x * 100).toFixed(x > 0.995 || x < 0.005 ? 1 : 0)}%`;

export default function Entry({ e, full = true }: { e: WmEntry; full?: boolean }) {
  return (
    <article className="wm" aria-labelledby={`wm-${e.slug}`}>
      <span className="eye g">What moved · {day(e.date)}</span>
      <h2 id={`wm-${e.slug}`} style={{ margin: 0 }}>{full ? e.title : <Link href={`/what-moved/${e.slug}`}>{e.title}</Link>}</h2>
      <p className="lede" style={{ margin: 0 }}>{e.summary}</p>
      <dl className="hire-s" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <div><dt>National vote</dt><dd>{mg(e.nat[1])}</dd><span className="cm-mute">was {mg(e.nat[0])}</span></div>
        <div><dt>{e.matchup[0]} wins</dt><dd>{pct(e.pD[1])}</dd><span className="cm-mute">was {pct(e.pD[0])}</span></div>
        <div><dt>Democratic electoral votes</dt><dd>{Math.round(e.evD[1])}</dd><span className="cm-mute">was {Math.round(e.evD[0])}</span></div>
      </dl>
      {full ? <>
        <h3>Why it moved</h3>
        <ul className="wm-why">{e.why.map((w) => <li key={w}>{w}</li>)}</ul>
        <h3>The states that moved most</h3>
        <div style={{ overflowX: "auto" }}><table className="cm-lb"><thead><tr><th>State</th><th className="n">Electoral votes</th><th className="n">Was</th><th className="n">Now</th><th>Rating</th></tr></thead>
          <tbody>{e.states.map((s) => <tr key={s.st}><td><Link href={`/2028/${s.st.slice(0, 2).toLowerCase()}`}>{s.name}</Link></td><td className="n">{s.ev}</td><td className="n">{mg(s.old)}</td><td className="n"><b>{mg(s.new)}</b></td><td>{s.rOld === s.rNew ? chip(s.rNew) : <>{chip(s.rOld)} to {chip(s.rNew)}</>}</td></tr>)}</tbody></table></div>
        <h3>The nominations</h3>
        <div className="cm-grid">{(["D", "R"] as const).map((k) => (
          <table key={k} className="cm-lb"><thead><tr><th>{k === "D" ? "Democratic" : "Republican"} nomination</th><th className="n">Was</th><th className="n">Now</th></tr></thead>
            <tbody>{e.nom[k].map((c) => <tr key={c.name}><td>{c.name}</td><td className="n">{pct(c.old)}</td><td className="n"><b>{pct(c.new)}</b></td></tr>)}</tbody></table>))}</div>
        <p className="cm-mute">Margins are for {e.matchup[0]} against {e.matchup[1]}. See <Link href="/2028">the full 2028 forecast</Link>, or <Link href="/2028/map-maker">make your own map</Link>.</p>
      </> : <Link className="btn" href={`/what-moved/${e.slug}`} style={{ justifySelf: "start" }}>Read the full week</Link>}
    </article>
  );
}
