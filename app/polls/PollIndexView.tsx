"use client";
// The polling averages board: national readings up top, then every average as a tile with its margin bar and
// trend, filterable by name and sortable by how close the race is, how many polls it has, or by name.
import React, { useMemo, useState } from "react";
import Link from "@/app/components/Link";
import { Pointy } from "@/app/components/home/Mascot";
import Ambient from "@/app/components/opp/Ambient";
import "@/app/_polling/genericballot/polls2.css";

export type PTile = { id: string; label: string; href: string; value: string; cls: string; n: number; updated: string | null; spark: number[]; net: number | null; fresh: number; color: string };
export type PSection = { key: string; title: string; tiles: PTile[] };

function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * 100).toFixed(1)},${(30 - ((v - min) / span) * 26).toFixed(1)}`);
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" style={{ width: "100%", height: 32, display: "block" }} aria-hidden="true">
      <polygon points={`0,32 ${pts.join(" ")} 100,32`} fill={color} opacity=".12" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function PollIndexView({ sections, national, title, lede, crumb, total, primaries }: {
  sections: PSection[]; national: PTile[]; title: React.ReactNode; lede: string; crumb?: string; total: number; primaries?: { href: string; title: string }[];
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"close" | "polls" | "fresh" | "az">("close");
  const shown = useMemo(() => sections.map((s) => {
    const k = q.trim().toLowerCase();
    let t = s.tiles.filter((x) => !k || x.label.toLowerCase().includes(k));
    if (s.key !== "national") t = [...t].sort((a, b) => sort === "close" ? Math.abs(a.net ?? 99) - Math.abs(b.net ?? 99) : sort === "polls" ? b.n - a.n : sort === "fresh" ? b.fresh - a.fresh || (b.updated ?? "").localeCompare(a.updated ?? "") : a.label.localeCompare(b.label));
    return { ...s, tiles: t };
  }).filter((s) => s.tiles.length), [sections, q, sort]);
  const fresh = sections.reduce((a, s) => a + s.tiles.reduce((b, t) => b + t.fresh, 0), 0);
  return (
    <div className="opp pi2 fx-dark">
      <Ambient />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span>
        {crumb ? <><Link href="/polls">Polls</Link><span className="sep">/</span><span>{crumb}</span></> : <span>Polls</span>}
      </nav>
      <header className="pi2-hero">
        <Pointy className="cam-hero cam-pi pty-side l quip" pose="think" prop="magnifier" size={120} look={1} say={<>I read every new poll in every race, twice a day.</>} />
        <div>
          <div className="eye g">Polling averages · {total} tracked · {fresh} new polls this week</div>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
        </div>
        {national.length ? (
          <div className="pi2-nat">
            {national.map((t) => (
              <Link key={t.id} href={t.href} style={{ "--c": t.color } as React.CSSProperties}>
                <span>{t.label}</span><b style={{ color: t.color }}>{t.value}</b>
                <Spark data={t.spark} color={t.color} />
                <small>{t.n} polls{t.updated ? ` · through ${day(t.updated)}` : ""}</small>
              </Link>
            ))}
          </div>
        ) : null}
      </header>
      <div className="pi2-tools">
        <input id="pi2-q" type="search" placeholder="Find a race, state or candidate" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find an average" />
        {([["close", "Closest first"], ["fresh", "Newest polls"], ["polls", "Most polls"], ["az", "A to Z"]] as [typeof sort, string][]).map(([k, l]) => <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}
      </div>
      {shown.map((s) => (
        <section key={s.key} className="pi2-sec">
          <h2>{s.title} <small>{s.tiles.length} averages</small></h2>
          <div className="pi2-grid">
            {s.tiles.map((t, i) => (
              <Link key={t.id} href={t.href} className="pi2-tile" style={{ "--c": t.color, animationDelay: `${Math.min(0.6, i * 0.02)}s` } as React.CSSProperties}>
                <span className="t"><span>{t.label}</span>{t.fresh ? <em>{t.fresh} new</em> : null}</span>
                <span className="v">{t.value}</span>
                {t.net != null && s.key !== "national" ? <span className="bar"><s /><i style={t.net >= 0 ? { left: "50%", width: `${Math.min(50, Math.abs(t.net) * 2.5)}%` } : { right: "50%", width: `${Math.min(50, Math.abs(t.net) * 2.5)}%` }} /></span> : null}
                <Spark data={t.spark} color={t.color} />
                <span className="s">{t.n} polls{t.updated ? ` · through ${day(t.updated)}` : ""}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {primaries?.length && !q ? (
        <section className="pi2-sec"><h2>2026 primaries <small>{primaries.length}</small></h2>
          <div className="pi2-grid">{primaries.map((p) => <Link key={p.href} href={p.href} className="pi2-tile"><span className="t">{p.title}</span><span className="s">{p.href}</span></Link>)}</div>
        </section>
      ) : null}
    </div>
  );
}
