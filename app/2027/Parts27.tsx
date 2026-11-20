// Shared pieces of the 2027 governor pages: the scoreboard, the range of outcomes and a primary field.
import Link from "@/app/components/Link";
import { RATE, rateOf } from "@/app/2028/rate28";
import { last, mg, pc, type Cand, type StateModel } from "./data27";

/** the distribution of simulated margins, 40 bins of 2 points from D +40 to R +40 */
export function Hist({ h }: { h: number[] }) {
  const mx = Math.max(...h), W = 400, H = 110, bw = W / h.length;
  return (
    <svg className="g27-hist" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="How the 20,000 simulated margins spread">
      {h.map((v, i) => { const x0 = -40 + i * 2; const y = H - 18 - (v / mx) * (H - 26); return <rect key={i} x={i * bw + 0.6} y={y} width={bw - 1.2} height={H - 18 - y} className={x0 + 1 >= 0 ? "r" : "d"} />; })}
      <line x1={W / 2} x2={W / 2} y1={2} y2={H - 18} className="mid" />
      {[-40, -20, 0, 20, 40].map((v) => <text key={v} x={((v + 40) / 80) * W} y={H - 4} textAnchor={v === -40 ? "start" : v === 40 ? "end" : "middle"}>{v === 0 ? "Even" : `${v > 0 ? "R" : "D"} +${Math.abs(v)}`}</text>)}
    </svg>
  );
}

export function Board({ S }: { S: StateModel }) {
  const top = S.pairs[0];
  const rWin = S.pR >= 0.5;
  return (
    <header className="h28-board g27-board">
      <div className="h28-board-top"><p className="h28-count"><i />{S.name} governor · {S.meta.system === "jungle" ? `open primary ${S.meta.primary}, runoff ${S.meta.runoff}` : `primary ${S.meta.primary} · general ${S.meta.general}`}</p></div>
      <div className="g27-face">
        <div className="g27-side-r">
          <span className="h28-party">Republicans</span>
          <b className="g27-n r">{pc(S.pR)}</b>
          <span className="h28-sub">win the governorship in 20,000 runs</span>
        </div>
        <div className="g27-mid">
          <h1 className="h28-h1">{S.name} <em>2027</em></h1>
          <p className="g27-inc">{S.meta.incumbent} · held by {S.meta.held === "R" ? "Republicans" : "Democrats"}</p>
          {top ? <p className="g27-top">Likeliest matchup: <b>{top.r}</b> v <b>{top.d}</b>, <span className={top.margin > 0 ? "r" : "d"}>{mg(top.margin)}</span></p> : null}
          <p className="g27-call">{rWin ? "Republicans" : "Democrats"} are favored. The model has the race at <b className={S.margin > 0 ? "r" : "d"}>{mg(S.margin)}</b>.</p>
        </div>
        <div className="g27-side-d">
          <span className="h28-party">Democrats</span>
          <b className="g27-n d">{pc(1 - S.pR)}</b>
          <span className="h28-sub">win the governorship in 20,000 runs</span>
        </div>
      </div>
    </header>
  );
}

export function Range({ S }: { S: StateModel }) {
  const span = 30, pos = (m: number) => Math.max(0, Math.min(100, ((m + span) / (2 * span)) * 100));
  return (
    <section className="s28-card g27-range" aria-labelledby={`rng-${S.code}`}>
      <h2 id={`rng-${S.code}`}>Where the margin could land</h2>
      <div className="s28-strip" aria-hidden="true">
        <span className="z" style={{ left: "50%" }} />
        <span className="band" style={{ left: `${pos(S.p10)}%`, width: `${pos(S.p90) - pos(S.p10)}%` }} />
        <span className="pt" style={{ left: `${pos(S.margin)}%`, background: S.margin > 0 ? "#d42a2a" : "#1f3fd1" }} />
      </div>
      <p className="s28-ends"><span>D +{span}</span><span>Even</span><span>R +{span}</span></p>
      <p className="s28-say">8 in 10 runs land between <b>{mg(S.p10)}</b> and <b>{mg(S.p90)}</b>. The middle run is <b>{mg(S.margin)}</b>.</p>
      <Hist h={S.hist} />
    </section>
  );
}

export function Field({ title, cands, sub, jungle }: { title: string; cands: Cand[]; sub?: string; jungle?: boolean }) {
  const mx = Math.max(...cands.map((c) => c.win), 0.01);
  return (
    <section className="s28-card g27-field">
      <h2>{title}</h2>
      {sub ? <p className="g27-mute">{sub}</p> : null}
      <ol>
        {cands.map((c) => (
          <li key={c.name} className={`p-${c.party}`}>
            <div className="g27-fh"><b>{c.name}</b>{jungle ? <span className={`g27-pty ${c.party.toLowerCase()}`}>{c.party}</span> : null}<em>{pc(c.win)}</em></div>
            <div className="g27-bar" aria-hidden="true"><i style={{ width: `${(100 * c.win) / mx}%` }} /></div>
            <p>{jungle ? `First place in ${pc(c.first ?? 0)} of runs. ` : ""}{c.pRun < 1 ? `${pc(c.pRun)} chance they run. ` : ""}{c.note}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Matchups({ S }: { S: StateModel }) {
  return (
    <section className="g27-matchups" aria-labelledby={`mu-${S.code}`}>
      <div className="g27-h"><h2 id={`mu-${S.code}`}>Every matchup</h2><span>Ordered by the chance it is the November ballot</span></div>
      <div className="g27-races">
        {S.pairs.map((p) => (
          <div key={p.id} className={`sk-race ${p.margin > 0 ? "r" : "d"}`}>
            <span className="st">{last(p.r)} v {last(p.d)}</span>
            <span className="sk-tag" style={{ color: RATE[rateOf(p.margin)].text }}>{RATE[rateOf(p.margin)].label}</span>
            <span className="m"><b>{mg(p.margin)}</b><span>{p.margin > 0 ? last(p.r) : last(p.d)} wins {pc(p.margin > 0 ? p.pR : 1 - p.pR)}</span></span>
            <span className="vs">Republican {p.r} v Democrat {p.d} · {pc(p.p)} chance of this ballot</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Others({ code }: { code: string }) {
  const all = [["KY", "kentucky", "Kentucky"], ["MS", "mississippi", "Mississippi"], ["LA", "louisiana", "Louisiana"]].filter((x) => x[0] !== code);
  return <p className="g27-others">The other 2027 races: {all.map((x, i) => <span key={x[0]}>{i ? " and " : ""}<Link href={`/2027/${x[1]}`}>{x[2]}</Link></span>)}. <Link href="/2027">All three on one page.</Link></p>;
}
