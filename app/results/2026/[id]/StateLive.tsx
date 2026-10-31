"use client";
// The races on one state's results page, each with its forecast until votes are counted and its live returns after,
// read from civicAPI through the caching proxy every minute. The server renders the forecast rows, so the page reads
// in full to search engines and before the first live read.
import React from "react";
import Link from "@/app/components/Link";
import { useIndex, useLive } from "../useLive";
import { fmtM, sides, type XRace } from "../live";
import { percentIn } from "@/app/lib/fmtPct";

export type LiveRow = { id: string; label: string; who: string; m: number | null; ind: boolean; href: string; fhref: string; k: string };
export type LiveGroup = { k: string; label: string; rows: LiveRow[]; more?: { n: number; href: string } };

type ORace = { id: number; type: string; district: string | null; name: string; pr: number; c: [string, string, number, number, number][] };
const LEG = /^(state senate|state house|state assembly|house of delegates|state legislature)$/i;

export default function StateLive({ groups, st }: { groups: LiveGroup[]; st?: string }) {
  const ix = useIndex();
  const live = useLive(ix, ["fed", "state", "ballot"]);
  // every other civicAPI race in the state: the ones the forecast does not cover get their own results page
  const [others, setOthers] = React.useState<ORace[] | null>(null);
  React.useEffect(() => {
    if (!st) return; let dead = false;
    const load = () => fetch(`/api/civic/state?st=${st}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (!dead && j?.races) setOthers(j.races); }).catch(() => {});
    load(); const t = setInterval(() => { if (!document.hidden) load(); }, 60_000);
    return () => { dead = true; clearInterval(t); };
  }, [st]);
  const linked = React.useMemo(() => new Set(Object.values(live.byId).map((c) => c.id)), [live.byId]);
  const extra = (others ?? []).filter((o) => !linked.has(o.id) && !LEG.test(o.type) && !/^(us senate|governor|house of representatives|us house)$/i.test(o.type));
  const byId = React.useMemo(() => Object.fromEntries((ix?.races ?? []).map((r) => [r.id, r])) as Record<string, XRace>, [ix]);
  return (
    <div className="srs-groups">
      {groups.map((g) => (
        <section key={g.k} className="srs-g" aria-labelledby={`srs-${g.k}`}>
          <h2 id={`srs-${g.k}`}>{g.label} <em>{g.rows.length + (g.more?.n ?? 0)}</em></h2>
          <ul>
            {g.rows.map((x) => {
              const r = byId[x.id], c = live.byId[x.id];
              const counted = !!c && (c.pr > 0 || c.c.some((y) => y[2] > 0));
              const s = counted && r ? sides(r, c!.c) : null;
              const lm = s && s.t ? (100 * (s.b - s.a)) / s.t : null;
              const w = c?.c.find((y) => y[4]);
              const k = x.k as XRace["k"];
              return (
                <li key={x.id} className={counted ? "on" : ""}>
                  <Link href={x.href} className="nm">{x.label}</Link>
                  <span className="who">{x.who}</span>
                  {counted
                    ? <span className={`lv ${lm != null && lm < 0 ? (x.ind ? "i" : "d") : "r"}`}>{fmtM(lm, k, x.ind)}<small>{w ? `Called for ${w[0]}` : `${percentIn(c!.pr)} in`}</small></span>
                    : <span className="ex">{x.m == null ? "" : fmtM(x.m, k, x.ind)}<small>Forecast</small></span>}
                  <Link href={x.fhref} className="fc" aria-label={`${x.label} forecast`}>Forecast</Link>
                </li>
              );
            })}
          </ul>
          {g.more ? <Link className="srs-more" href={g.more.href}>{g.more.n} more on the full list</Link> : null}
        </section>
      ))}
      {extra.length > 0 && (
        <section className="srs-g" aria-labelledby="srs-more-races">
          <h2 id="srs-more-races">More races on the ballot <em>{extra.length}</em></h2>
          <ul>
            {extra.map((o) => {
              const t = o.c.reduce((a, x) => a + x[2], 0), top = [...o.c].sort((a, b) => b[2] - a[2]), w = o.c.find((x) => x[4]);
              return (
                <li key={o.id} className={t > 0 ? "on" : ""}>
                  <Link href={`/results/civic/${o.id}`} className="nm">{o.name}</Link>
                  <span className="who">{o.c.slice(0, 3).map((x) => x[0]).join(", ")}</span>
                  {t > 0 ? <span className="lv">{top[0][0].split(" ").slice(-1)[0]} {((100 * top[0][2]) / t).toFixed(1)}%<small>{w ? `Called for ${w[0]}` : `${percentIn(o.pr)} in`}</small></span>
                    : <span className="ex">{o.type}<small>Live returns</small></span>}
                  <Link href={`/results/civic/${o.id}`} className="fc" aria-label={`${o.name} results`}>Results</Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <p className="srs-live">{live.loading ? "Connecting to live returns" : live.at ? `Live returns from civicAPI, last read ${live.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} Eastern. Before the polls close every race shows the On Point forecast.` : "Before the polls close every race shows the On Point forecast."}</p>
    </div>
  );
}
