// On Point against every other pollster and forecaster, shared by /accuracy and /most-accurate-pollster.
import { dm, GRAPHIC_DIR, marginMiss, type Bench, type SeatVal } from "./bench";

/** The final generic ballot: our poll, the result and the averages. */
export function GenericTrio({ b }: { b: Bench }) {
  const g = b.generic;
  const off = Math.abs(g.us.margin - g.result.margin).toFixed(1);
  return (
    <div className="bx-trio">
      <div className="bx-us">
        <p className="eye">On Point Polling final national poll</p>
        <div className="bx-big d">{dm(g.us.margin)}</div>
        <p className="bx-sub">{g.us.d.toFixed(1)} D · {g.us.r.toFixed(1)} R</p>
        <span className="bx-tag">Off by {off}</span>
      </div>
      <div className="bx-dark">
        <p className="eye">The result</p>
        <div className="bx-big">D +{g.result.margin.toFixed(1)}</div>
        <p className="bx-sub">{g.result.label}</p>
      </div>
      <div className="bx-dark">
        <p className="eye">Polling averages</p>
        <div className="bx-big dim">{dm(g.averages.margin)}</div>
        <p className="bx-sub">Missed by {(g.result.margin - g.averages.margin).toFixed(1)} points</p>
      </div>
    </div>
  );
}

/** Every final national poll, scored on the margin and the party shares. */
export function PollRanking({ b, limit }: { b: Bench; limit?: number }) {
  const rows = limit ? b.national.polls.slice(0, limit) : b.national.polls;
  const top = Math.max(...b.national.polls.map((p) => p.score));
  return (
    <div className="acc-tbl"><table className="tbl bx-rank">
      <thead><tr><th className="n">Rank</th><th>Pollster</th><th className="n">Final poll</th><th className="n">Margin miss</th><th className="n">Score</th><th aria-hidden="true" className="bar-h" /></tr></thead>
      <tbody>{rows.map((p) => (
        <tr key={p.name} className={p.us ? "us" : ""}>
          <td className="n">{p.rank}</td>
          <td className="pn"><span>{p.name}</span></td>
          <td className="n">{dm(p.final)}</td>
          <td className="n">{marginMiss(p, b.generic.result.margin).toFixed(1)}</td>
          <td className="n b">{p.score.toFixed(2)}</td>
          <td className="bar" aria-hidden="true"><i style={{ width: `${(100 * p.score) / top}%` }} /></td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

const sv = (v: SeatVal, result: number) => {
  if (v == null) return <span className="dim">no number</span>;
  if (typeof v === "string") return <span className="dim">{v}</span>;
  const off = Math.abs(v - result);
  return <><b>{v}</b> <span className="dim">{off === 0 ? "exact" : `off ${off}`}</span></>;
};

/** Final Democratic seat counts from every forecast that published one, against the count. */
export function SeatTable({ b }: { b: Bench }) {
  const R = b.seats.result;
  const total = (r: Bench["seats"]["rows"][number]) =>
    typeof r.house === "number" && typeof r.senate === "number" && typeof r.gov === "number" ? Math.abs(r.house - R.house) + Math.abs(r.senate - R.senate) + Math.abs(r.gov - R.gov) : null;
  return (
    <div className="acc-tbl"><table className="tbl bx-seats">
      <thead><tr><th>Forecast</th><th className="n">House</th><th className="n">Senate</th><th className="n">Governors</th><th className="n">Total miss</th></tr></thead>
      <tbody>
        <tr className="res"><td>The result</td><td className="n">{R.house_approx ? "about " : ""}{R.house}</td><td className="n">{R.senate}</td><td className="n">{R.gov}</td><td className="n">0</td></tr>
        {b.seats.rows.map((r) => { const t = total(r); return (
          <tr key={r.name} className={r.us ? "us" : ""}>
            <td className="pn"><span>{r.name}</span></td><td className="n">{sv(r.house, R.house)}</td><td className="n">{sv(r.senate, R.senate)}</td><td className="n">{sv(r.gov, R.gov)}</td>
            <td className="n">{t == null ? <span className="dim">incomplete</span> : <b>{t} seats</b>}</td>
          </tr>); })}
      </tbody>
    </table></div>
  );
}

/** The ten Senate races that decided the majority, scored for 18 forecasts. */
export function SenateRank({ b }: { b: Bench }) {
  const n = b.senate.races.length;
  return (
    <div className="acc-tbl"><table className="tbl bx-rank">
      <thead><tr><th className="n">Rank</th><th>Forecast</th><th className="n">Right</th><th aria-hidden="true" className="bar-h" /></tr></thead>
      <tbody>{b.senate.rows.map((r) => (
        <tr key={r.name} className={r.us ? "us" : ""}><td className="n">{r.rank}</td><td className="pn"><span>{r.name}</span></td><td className="n b">{r.right} of {n}</td>
          <td className="bar" aria-hidden="true"><i style={{ width: `${(100 * r.right) / n}%` }} /></td></tr>
      ))}</tbody>
    </table></div>
  );
}

/** The calls the rest of the field did not make. */
export function Calls({ b }: { b: Bench }) {
  return (
    <div className="bx-calls">
      {b.calls.map((c, i) => (
        <div key={c.k} className={i < 2 ? "bx-call lit" : "bx-call"}>
          <p className="eye">{c.k}</p>
          <div className="v">{c.v}</div>
          <p>{c.t}</p>
        </div>
      ))}
    </div>
  );
}

/** Races with a call by the comparison date, by office. */
export function CalledStrip({ b }: { b: Bench }) {
  const c = b.called;
  const cell = (l: string, [r, o]: [number, number], note: string) => (
    <div><span className="l">{l}</span><span className="v">{r} of {o}</span><span className="s">{note}</span></div>
  );
  return (
    <div className="acc-kpis two">
      <div><span className="l">Called races</span><span className="v">{c.share.toFixed(1)}%</span><span className="s">{c.right} of {c.of} went to our favorite</span></div>
      {cell("Senate", c.senate, `Missed ${c.senate_miss}`)}
      {cell("Governor", c.governor, `Missed ${c.governor_miss}`)}
      {cell("House", c.house, `${c.house_leaders[0]} of all ${c.house_leaders[1]} counting leaders`)}
    </div>
  );
}

/** The share graphics, full size behind each thumbnail. */
export function Gallery({ b }: { b: Bench }) {
  return (
    <div className="bx-gallery">
      {b.graphics.map((g) => (
        <a key={g.f} href={`${GRAPHIC_DIR}/${g.f}.jpg`} className="bx-g">
          <img src={`${GRAPHIC_DIR}/${g.f}-sm.jpg`} alt={g.t} width={960} height={540} loading="lazy" decoding="async" />
          <span>{g.t}</span>
        </a>
      ))}
    </div>
  );
}
