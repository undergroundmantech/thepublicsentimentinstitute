import Link from "@/app/components/Link";
import { getAcc, mg, er, cls, winnerName } from "@/app/accuracy/data";

// The result against the final forecast, at the top of every Senate, House and governor forecast page.
export default function ResultBand({ id }: { id: string }) {
  const r = getAcc().races.find((x) => x.id === id);
  if (!r || r.act == null) return null;
  const unopp = Math.abs(r.fm) >= 99;
  return (
    <aside className="opp rband" aria-label="Result">
      <span className={`dot ${r.fin ? "fin" : ""}`} aria-hidden="true" />
      <span className="k">{r.fin ? "Result" : "Count so far"}</span>
      <span className="w"><b>{winnerName(r)}</b> {r.fin ? "won" : "leads"}{unopp || r.excl ? "" : <> by <b className={cls(r.act, r.ind)}>{mg(r.act, r.ind).replace(/^[DRI] \+/, "")}</b></>}</span>
      {unopp ? null : <span className="m">Final forecast <b className={cls(r.fm, r.ind)}>{mg(r.fm, r.ind)}</b></span>}
      {unopp || r.excl ? null : <span className="m">Miss <b>{er(r.err, r.ind)}</b></span>}
      <span className="m">{r.pct}% counted</span>
      <span className={`call ${r.excl ? "x" : r.right ? "ok" : "no"}`}>{r.excl ? "Not scored" : r.right ? "Called right" : "Missed"}</span>
      <Link href="/accuracy" className="more">How the forecast did</Link>
    </aside>
  );
}
