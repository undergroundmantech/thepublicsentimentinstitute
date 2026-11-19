import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/app/components/Link";
import AdUnit from "@/app/components/AdUnit";
import { seo } from "@/app/lib/seo";
import { TILES, evLine, headline, last } from "../../share28";
import { load } from "../data";
import "../result.css";

// A shared Campaign 2028 result: the map, the score and a way in. Shared pages stay out of search; the game page is
// the one to rank.
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params; const x = load(code); if (!x) return {};
  const m = seo({ title: `${headline(x.r)} | Campaign 2028`, description: `A Campaign 2028 run on the On Point 2028 forecast: ${x.r.me} against ${x.r.op}, ${evLine(x.r)} in the Electoral College. Play the same race and try to beat it.`, path: `/play/r/${code}`, noindex: true, ownImage: true });
  return m;
}

export default async function SharedResult({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params; const x = load(code); if (!x) notFound();
  const { r, dWon } = x; const dName = r.p === "D" ? r.me : r.op, rName = r.p === "D" ? r.op : r.me;
  return (
    <div className="opp pr28">
      <section className="pr28-card">
        <p className="eye">{r.day ? "Campaign 2028 · daily challenge" : "Campaign 2028"}</p>
        <h1>{r.win ? <><em>{r.me}</em> won the White House</> : <><em>{r.op}</em> beat {r.me}</>}</h1>
        <p className="pr28-score"><b className="d">{last(dName)} {r.p === "D" ? r.ev : 538 - r.ev}</b><span>electoral votes</span><b className="r">{r.p === "R" ? r.ev : 538 - r.ev} {last(rName)}</b></p>
        <div className="pr28-map" role="img" aria-label="The final map">
          {Object.entries(TILES).map(([st, [c, rr]]) => <i key={st} className={dWon[st] ? "d" : "r"} style={{ gridColumn: c + 1, gridRow: rr + 1 }}>{st}</i>)}
        </div>
        <p className="pr28-note">Popular vote {r.pop >= 0 ? `${last(r.me)} +${r.pop.toFixed(1)}` : `${last(r.op)} +${Math.abs(r.pop).toFixed(1)}`}{r.vp ? ` · running mate ${r.vp}` : ""}. Every state, county and voter group comes from the On Point 2028 forecast.</p>
        <div className="pr28-go">
          <a className="btn g" href={`/play?c=${code}`}>Play this exact race</a>
          {r.day ? <a className="btn" href="/play?daily=1">Play today&apos;s challenge</a> : null}
          <Link className="btn" href="/play">Start your own campaign</Link>
        </div>
      </section>
      <AdUnit />
      <section className="pr28-more">
        <h2>The real 2028 race</h2>
        <p>See where the On Point forecast has it now: the <Link href="/2028">2028 electoral map</Link>, the <Link href="/2028/primaries">primaries</Link> and <Link href="/2028-presidential-candidates">who is running</Link>.</p>
      </section>
    </div>
  );
}
