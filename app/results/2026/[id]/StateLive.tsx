"use client";
// The races on one state's results page, each with its forecast until votes are counted and its live returns after,
// read from civicAPI through the caching proxy every minute. The server renders the forecast rows, so the page reads
// in full to search engines and before the first live read.
import React from "react";
import Link from "next/link";
import { useIndex, useLive } from "../useLive";
import { fmtM, sides, type XRace } from "../live";

export type LiveRow = { id: string; label: string; who: string; m: number | null; ind: boolean; href: string; fhref: string; k: string };
export type LiveGroup = { k: string; label: string; rows: LiveRow[]; more?: { n: number; href: string } };

export default function StateLive({ groups }: { groups: LiveGroup[] }) {
  const ix = useIndex();
  const live = useLive(ix, ["fed", "state", "ballot"]);
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
                    ? <span className={`lv ${lm != null && lm < 0 ? (x.ind ? "i" : "d") : "r"}`}>{fmtM(lm, k, x.ind)}<small>{w ? `Called for ${w[0]}` : `${c!.pr.toFixed(0)}% in`}</small></span>
                    : <span className="ex">{x.m == null ? "" : fmtM(x.m, k, x.ind)}<small>Forecast</small></span>}
                  <Link href={x.fhref} className="fc" aria-label={`${x.label} forecast`}>Forecast</Link>
                </li>
              );
            })}
          </ul>
          {g.more ? <Link className="srs-more" href={g.more.href}>{g.more.n} more on the full list</Link> : null}
        </section>
      ))}
      <p className="srs-live">{live.loading ? "Connecting to live returns" : live.at ? `Live returns from civicAPI, last read ${live.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} Eastern. Before the polls close every race shows the On Point forecast.` : "Before the polls close every race shows the On Point forecast."}</p>
    </div>
  );
}
