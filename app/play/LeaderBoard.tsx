"use client";
// This week's Campaign 2028 boards, read live, and last week's winners.
import { useEffect, useState } from "react";
import { CATS, weekLabel, type Board, type Row } from "./board28";
import { flipLine } from "./share28";

const fmt = (k: string, r: Row) => (k === "pop" ? `+${r.pop.toFixed(1)}` : k === "cheap" ? `$${r.sp.toLocaleString()}M` : `${r.ev} EV`);
export default function LeaderBoard({ compact = false }: { compact?: boolean }) {
  const [b, setB] = useState<Board | null>(null); const [last, setLast] = useState<Board | null>(null); const [wk, setWk] = useState("");
  useEffect(() => { fetch("/api/play/board").then((r) => r.json()).then((j) => { if (j.ok) { setB(j.board); setLast(j.last); setWk(j.week); } }).catch(() => {}); }, []);
  if (!b) return <p className="lb-note">Loading this week&apos;s board…</p>;
  return (
    <div className="lb">
      <p className="lb-note">Week of {weekLabel(wk)} · {b.n.toLocaleString()} {b.n === 1 ? "win" : "wins"} entered · the board starts fresh every Monday.</p>
      <div className="lb-grid">
        {CATS.map((c) => (
          <section key={c.k} className="lb-cat" aria-labelledby={`lb-${c.k}`}>
            <h3 id={`lb-${c.k}`}>{c.title}</h3><p className="lb-note">{c.blurb}</p>
            {b.cats[c.k].length ? <ol>{b.cats[c.k].slice(0, compact ? 3 : 10).map((r, i) => (
              <li key={r.code + i}><span className="lb-n">{i + 1}</span><a href={`/play/r/${r.code}`}><b>{r.name}</b><small>{r.me} over {r.op}{r.fl?.length ? ` · ${flipLine({ ...r, v: 1, win: true, w: "" }).replace(/ as .*$/, "")}` : ""}</small></a><span className={`lb-s ${r.p === "D" ? "d" : "r"}`}>{fmt(c.k, r)}</span></li>))}</ol>
              : <p className="lb-empty">Nobody yet this week. Win a race and claim the top spot.</p>}
          </section>
        ))}
      </div>
      {last && !compact ? <p className="lb-note">Last week&apos;s champions: {CATS.map((c) => last.cats[c.k][0] ? `${c.title}, ${last.cats[c.k][0].name} with ${fmt(c.k, last.cats[c.k][0])}` : null).filter(Boolean).join(" · ") || "none"}.</p> : null}
    </div>
  );
}
