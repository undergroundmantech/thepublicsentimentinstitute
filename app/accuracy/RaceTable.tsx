// One row per race, forecast against the count. Shared by the server page and the House explorer, so it reads no files.
import Link from "@/app/components/Link";
import { raceHref, STATE_NAME } from "@/app/lib/opp";
import { cls, er, mg, pc, who } from "./fmt";
import type { Race } from "./data";

const range = (r: Race) => (r.p10 == null || r.p90 == null ? "" : `${mg(r.p10, r.ind)} to ${mg(r.p90, r.ind)}`);
const favChance = (r: Race) => (r.fav === "R" ? r.p : 1 - r.p);

export function Call({ r }: { r: Race }) {
  if (r.excl) return <span className="call x" title={r.excl}>Not scored</span>;
  return r.right ? <span className="call ok">Right</span> : <span className="call no">Missed</span>;
}

export function RaceTable({ rows, house = false }: { rows: Race[]; house?: boolean }) {
  return (
    <div className="acc-tbl"><table className="tbl">
      <thead><tr><th>{house ? "District" : "State"}</th><th>Candidates</th><th className="n">Forecast</th><th className="n">Chance</th><th className="n">80% range</th><th className="n">Result</th><th className="n">Miss</th><th className="n">Counted</th><th>Call</th></tr></thead>
      <tbody>{rows.map((r) => {
        const w = who(r);
        return (
          <tr key={r.id} className={r.right ? "" : "miss"}>
            <td><Link href={raceHref(r.id)} className="rn">{house ? `${r.st} ${r.d}` : STATE_NAME[r.st] ?? r.st}</Link></td>
            <td className="cands"><span className={r.side === "D" ? (r.ind ? "i b" : "d b") : "d"}>{w.d}</span><span className="v"> vs </span><span className={r.side === "R" ? "r b" : "r"}>{w.r}</span></td>
            <td className={`n ${cls(r.fm, r.ind)}`}>{Math.abs(r.fm) >= 99 ? "Unopposed" : mg(r.fm, r.ind)}</td>
            <td className="n">{r.fav === "R" ? "R" : r.ind ? "I" : "D"} {pc(favChance(r))}</td>
            <td className="n dim">{Math.abs(r.fm) >= 99 ? "" : range(r)}</td>
            <td className={`n ${cls(r.act, r.ind)}`}>{r.act == null || Math.abs(r.fm) >= 99 ? "" : mg(r.act, r.ind)}</td>
            <td className={`n ${r.excl ? "dim" : cls(r.err, r.ind)}`}>{r.excl || Math.abs(r.fm) >= 99 ? "" : er(r.err, r.ind)}</td>
            <td className="n dim">{r.pct}%{r.fin ? "" : " · counting"}</td>
            <td><Call r={r} /></td>
          </tr>
        );
      })}</tbody>
    </table></div>
  );
}

