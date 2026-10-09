"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Grow } from "./motion";

type Cand = { name?: string; party?: string; votes?: number; percent?: number; winner?: boolean };
type Race = { candidates?: Cand[]; percent_reporting?: number };

function shade(party: string | undefined, winner: boolean) {
  const d = /dem/i.test(party ?? ""), r = /rep|gop/i.test(party ?? "");
  if (d) return winner ? "#1a3fb0" : "#a6c2ff";
  if (r) return winner ? "#b0163a" : "#ffb3c0";
  return winner ? "#b78cff" : "rgba(183,140,255,.45)";
}
const fmtVotes = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

/** A finished race from the results desk, read live from the same CivicAPI race the night board used.
 *  Winner square is the deep party shade, the rest the pale tint. */
export default function ResultCard({ raceId, title, date, href, names }: { raceId: number; title: string; date: string; href: string; names: string[] }) {
  const [race, setRace] = useState<Race | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const ac = new AbortController();
    fetch(`https://civicapi.org/api/v2/race/${raceId}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: Race) => setRace(j))
      .catch(() => { if (!ac.signal.aborted) setFailed(true); });
    return () => ac.abort();
  }, [raceId]);
  const cands = (race?.candidates ?? []).filter((c) => (c.votes ?? 0) > 0).sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)).slice(0, 3);
  const total = (race?.candidates ?? []).reduce((a, c) => a + (c.votes ?? 0), 0);
  const pr = race?.percent_reporting ?? 0;
  return (
    <div className="card">
      <div className="card-h"><h3><Link href={href}>{title}</Link></h3><span className="eye" style={{ marginLeft: "auto" }}>{date}</span></div>
      <div className="card-b">
        {cands.length ? cands.map((c, i) => {
          const pct = c.percent ?? (total ? ((c.votes ?? 0) / total) * 100 : 0);
          return (
            <div className="res-row" key={c.name ?? i}>
              <i style={{ background: shade(c.party, i === 0) }} />
              <span>{c.name}{c.winner && <b className="chk" aria-label="winner">✓</b>}</span>
              <span className="pct">{pct.toFixed(1)}%</span>
              <span className="votes">{fmtVotes(c.votes ?? 0)}</span>
            </div>
          );
        }) : names.map((n) => (
          <div className="res-row" key={n}><i style={{ background: "#ffb3c0", opacity: .4 }} /><span>{n}</span><span className="pct">{failed ? "" : "…"}</span><span className="votes" /></div>
        ))}
        <div className="prog"><Grow w={cands.length ? Math.min(100, pr || 100) : 0} /></div>
        <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 6 }}>
          {cands.length ? `${Math.round(pr || 100)}% of expected vote · county map and call log on the race page` : failed ? "Results feed unavailable, open the race page" : "Loading the final count"}
        </div>
      </div>
    </div>
  );
}
