// Server drawn pieces of the scroll story on the accuracy, pollster and On Point Polling pages. Motion comes from
// AccFX, which marks [data-fx] blocks as they enter; every piece reads correctly with motion off.
import type { Bench, PollRow, Polling, SeatVal } from "../bench";
import { pm } from "../bench";

/** A big chapter opener. The heading tightens as it scrolls in, using the site's view timeline. */
export function Chapter({ id, eye, title, lede, children, tone }: { id: string; eye: string; title: React.ReactNode; lede?: React.ReactNode; children?: React.ReactNode; tone?: "lit" }) {
  return (
    <section id={id} className={`ch${tone ? ` ch-${tone}` : ""}`}>
      <header className="ch-h" data-fx>
        <p className="eye">{eye}</p>
        <h2 className="sx-h">{title}</h2>
        {lede ? <p className="ch-lede">{lede}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** Headline numbers that count up the first time they are seen. */
export function Stats({ items }: { items: { k: string; to: number; dec?: number; pre?: string; suf?: string; s: string; cls?: string }[] }) {
  return (
    <div className="st-row" data-fx>
      {items.map((x, i) => (
        <div key={x.k} className="st" style={{ ["--i" as string]: i }}>
          <span className="k">{x.k}</span>
          <b className={x.cls} data-count data-to={x.to} data-dec={x.dec ?? 0} data-pre={x.pre ?? ""} data-suf={x.suf ?? ""}>{x.pre ?? ""}{x.to.toFixed(x.dec ?? 0)}{x.suf ?? ""}</b>
          <span className="s">{x.s}</span>
        </div>
      ))}
    </div>
  );
}

/** Every final national poll as a bar race on the accuracy score, ours lit. Shorter is better. */
export function PollRace({ b, limit }: { b: Bench; limit?: number }) {
  const rows = limit ? b.national.polls.slice(0, limit) : b.national.polls;
  const top = Math.max(...b.national.polls.map((p) => p.score));
  return (
    <ol className="bxr" data-fx>
      {rows.map((p, i) => (
        <li key={p.name} className={p.us ? "us" : ""} style={{ ["--i" as string]: i, ["--w" as string]: (p.score / top).toFixed(3) }}>
          <span className="rk">{p.rank}</span>
          <span className="nm">{p.name}</span>
          <span className="fn">D +{Number.isInteger(p.final) ? p.final : p.final.toFixed(1)}</span>
          <span className="br" aria-hidden="true"><i /></span>
          <span className="sc">{p.score.toFixed(2)}</span>
        </li>
      ))}
    </ol>
  );
}

const num = (v: SeatVal): number | null => (typeof v === "number" ? v : null);

/** How many seats each published forecast was off, chamber by chamber, ours lit. */
export function SeatMiss({ b }: { b: Bench }) {
  const R = b.seats.result;
  const chamber = (k: "house" | "senate" | "gov", label: string, res: number) => {
    const rows = b.seats.rows.map((r) => ({ name: r.name, us: r.us, v: num(r[k]) })).filter((r) => r.v != null)
      .map((r) => ({ ...r, off: Math.abs((r.v as number) - res) })).sort((a, z) => a.off - z.off);
    const top = Math.max(1, ...rows.map((r) => r.off));
    return (
      <div className="sm-c">
        <div className="sm-h"><h3>{label}</h3><span>Result {k === "house" && R.house_approx ? "about " : ""}{res} D</span></div>
        <ol className="bxr sm" data-fx>
          {rows.map((r, i) => (
            <li key={r.name} className={r.us ? "us" : ""} style={{ ["--i" as string]: i, ["--w" as string]: Math.max(0.02, r.off / top).toFixed(3) }}>
              <span className="nm">{r.name}</span>
              <span className="fn">{r.v}</span>
              <span className="br" aria-hidden="true"><i /></span>
              <span className="sc">{r.off === 0 ? "exact" : `off ${r.off}`}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  };
  return <div className="sm-grid">{chamber("house", "House seats", R.house)}{chamber("senate", "Senate seats", R.senate)}{chamber("gov", "Governors", R.gov)}</div>;
}

/** Our final poll against the result in every race we polled: the open dot is the poll, the solid dot the count. */
export function Dumbbells({ rows }: { rows: PollRow[] }) {
  const LIM = 22;
  const pos = (m: number) => `${((Math.max(-LIM, Math.min(LIM, m)) + LIM) / (2 * LIM)) * 100}%`;
  return (
    <div className="db" data-fx>
      <div className="db-axis" aria-hidden="true"><span style={{ left: pos(-20) }}>D +20</span><span style={{ left: pos(-10) }}>D +10</span><span style={{ left: pos(0) }}>Even</span><span style={{ left: pos(10) }}>R +10</span><span style={{ left: pos(20) }}>R +20</span></div>
      {rows.map((r, i) => {
        const a = r.poll, z = r.result ?? r.poll;
        return (
          <div key={r.id} className={`db-row${r.right === false ? " miss" : ""}`} style={{ ["--i" as string]: i, ["--a" as string]: pos(a), ["--b" as string]: pos(z) }}>
            <div className="db-l"><b>{r.race}</b><span>{new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {r.n.toLocaleString("en-US")} voters{r.sponsor ? " · sponsored" : ""}</span></div>
            <div className="db-t" aria-label={`${r.race}: poll ${pm(a, r.ind)}, result ${pm(z, r.ind)}`}>
              <i className="mid" />
              <i className="ln" style={{ left: `min(${pos(a)}, ${pos(z)})`, width: `calc(max(${pos(a)}, ${pos(z)}) - min(${pos(a)}, ${pos(z)}))` }} />
              <i className={`pt ${a < 0 ? (r.ind ? "i" : "d") : "r"}`} />
              <i className={`rs ${z < 0 ? (r.ind ? "i" : "d") : "r"}`} />
            </div>
            <div className="db-r">
              <span className="k">Poll</span><b className={a < 0 ? (r.ind ? "i" : "d") : "r"}>{pm(a, r.ind)}</b>
              <span className="k">Result</span><b className={z < 0 ? (r.ind ? "i" : "d") : "r"}>{r.result == null ? "no count" : pm(z, r.ind)}</b>
              <span className={`call ${r.right ? "ok" : "no"}`}>{r.miss == null ? "" : `${Math.abs(r.miss).toFixed(1)} off`}{r.right === false ? " · missed" : ""}{r.final === false ? " · counting" : ""}</span>
            </div>
          </div>
        );
      })}
      <div className="db-key" aria-hidden="true"><span><i className="pt d" />Our final poll</span><span><i className="rs d" />The count</span></div>
    </div>
  );
}

/** The calls nobody else made, as cards for the sideways track. */
export function CallCards({ b }: { b: Bench }) {
  return (
    <>
      {b.calls.map((c, i) => (
        <article key={c.k} className={`cc${i < 2 ? " lit" : ""}`}>
          <p className="eye">{c.k}</p>
          <div className="v">{c.v}</div>
          <p className="t">{c.t}</p>
        </article>
      ))}
    </>
  );
}

/** One line summary of our own polling record, for heroes and the sales page. */
export function pollingLine(P: Polling) {
  const s = P.summary;
  return `${s.all.right} of ${s.all.n} race winners called in ${s.states} states, with a ${s.senate.mae.toFixed(1)} point average miss in Senate races`;
}
