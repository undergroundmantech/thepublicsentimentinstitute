"use client";
import { useEffect, useMemo, useState } from "react";
import { RATING_LABEL, fmtM, rating, ratingPill } from "@/app/lib/opp";
import type { SLDistrict } from "./data";

type View = "close" | "all" | "safe";
const num = (d: string) => { const m = d.match(/\d+/); return m ? Number(m[0]) : 0; };

function statusText(x: SLDistrict) {
  if (x.status === "no Democrat filed") return "No Democrat on the ballot";
  if (x.status === "no Republican filed") return "No Republican on the ballot";
  if (x.status.startsWith("uncontested")) return "Uncontested last time";
  if (x.status === "no major party candidate") return "No major party candidate";
  if (x.status === "no data") return "No recent result";
  return null;
}

export default function DistrictTable({ rows, label, selected, onSelect }: { rows: SLDistrict[]; label: string; selected?: string | null; onSelect?: (d: string) => void }) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("close");
  const [sort, setSort] = useState<"close" | "dist">("close");
  // a district picked on the map opens the full list at that row
  useEffect(() => {
    if (!selected) return;
    setView("all"); setQ("");
    const t = setTimeout(() => document.getElementById(`d-${selected}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
    return () => clearTimeout(t);
  }, [selected]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let r = rows.filter((x) => !s || x.d.toLowerCase().includes(s) || (x.winner ?? "").toLowerCase().includes(s) || (x.dem ?? "").toLowerCase().includes(s) || (x.gop ?? "").toLowerCase().includes(s));
    if (view === "close") r = r.filter((x) => x.margin != null && Math.abs(x.margin) < 12 && Math.abs(x.margin) < 99);
    if (view === "safe") r = r.filter((x) => x.margin == null || Math.abs(x.margin) >= 12);
    return [...r].sort((a, b) => sort === "dist" ? num(a.d) - num(b.d) || a.d.localeCompare(b.d) : Math.abs(a.margin ?? 999) - Math.abs(b.margin ?? 999));
  }, [rows, q, view, sort]);
  const closeN = rows.filter((x) => x.margin != null && Math.abs(x.margin) < 12).length;
  return (
    <div className="card" id="districts">
      <div className="card-h">
        <h3>Every {label} district</h3>
        <div className="seg" role="tablist" aria-label="Districts to show">
          <button className={view === "close" ? "on" : ""} onClick={() => setView("close")}>Competitive <span className="mono">{closeN}</span></button>
          <button className={view === "all" ? "on" : ""} onClick={() => setView("all")}>All <span className="mono">{rows.length}</span></button>
          <button className={view === "safe" ? "on" : ""} onClick={() => setView("safe")}>Safe</button>
        </div>
      </div>
      <div className="sl-tools">
        <input id="sl-search" type="search" placeholder="Search a district or a name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search districts" />
        <div className="seg" aria-label="Sort">
          <button className={sort === "close" ? "on" : ""} onClick={() => setSort("close")}>Closest first</button>
          <button className={sort === "dist" ? "on" : ""} onClick={() => setSort("dist")}>District order</button>
        </div>
      </div>
      <div className="tblwrap">
        <table className="tbl sl-tbl">
          <thead><tr><th>District</th><th>Last winner</th><th>2026 nominees</th><th style={{ textAlign: "right" }}>2024 lean</th><th style={{ textAlign: "right" }}>Forecast</th><th style={{ textAlign: "right" }}>Dem win</th><th style={{ textAlign: "right" }}>Projected D votes</th><th style={{ textAlign: "right" }}>Projected R votes</th><th style={{ textAlign: "right" }}>Total</th><th>Rating</th></tr></thead>
          <tbody>
            {list.map((x) => {
              const st = statusText(x);
              const m = x.margin;
              const modeled = m != null && Math.abs(m) < 99;
              const rt = modeled ? (x.indMain && m! < 0 ? "ind" : rating(m!)) : x.probD === 1 ? "safeD" : "safeR";
              const won = x.last?.won?.[0];
              return (
                <tr key={x.d} id={`d-${x.d}`} className={selected === x.d ? "sel" : undefined} onClick={onSelect ? () => onSelect(x.d) : undefined} style={onSelect ? { cursor: "pointer" } : undefined}>
                  <td className="mono">{x.d}{x.seats > 1 ? <span className="sl-mag">{x.seats} seats</span> : null}</td>
                  <td>{x.winner ? <span className={won === "D" ? "d" : won === "R" ? "r" : ""}>{x.winner}</span> : <span style={{ color: "var(--mute)" }}>Not on file</span>}{x.last?.year ? <span className="sl-yr"> {x.last.year}</span> : null}</td>
                  <td>{x.dem || x.gop || x.ind ? <>{x.indMain && x.ind ? <span style={{ color: "var(--ind)" }}>{x.ind} ({x.indParty ?? "I"})</span> : <span className="d">{x.dem ?? "No Democrat"}</span>} <span style={{ color: "var(--mute)" }}>vs</span> <span className="r">{x.gop ?? "No Republican"}</span>{!x.indMain && x.ind ? <span style={{ color: "var(--mute)", fontSize: 11.5 }}> · {x.ind} ({x.indParty ?? "I"})</span> : null}</> : <span style={{ color: "var(--mute)" }}>{st ?? "Primary results not posted"}</span>}{x.note ? <span className="sl-yr" title={x.note}> · {x.note}</span> : null}{x.polls?.length ? <span className="pill t sl-poll">{x.polls.length} {x.polls.length === 1 ? "poll" : "polls"}</span> : null}</td>
                  <td className={`n ${x.lean == null ? "" : x.lean < 0 ? "d" : "r"}`}>{x.lean == null ? "" : fmtM(x.lean)}</td>
                  <td className={`n ${modeled ? (m! < 0 ? "d" : "r") : ""}`} style={modeled && x.indMain && m! < 0 ? { color: "var(--ind)" } : undefined}>{modeled ? (x.indMain ? fmtM(m!).replace("D +", "I +") : fmtM(m!)) : st ?? ""}</td>
                  <td className="n">{x.probD == null ? "" : `${Math.round(x.probD * 100)}%${x.indMain ? " I" : ""}`}</td>
                  <td className="n d">{x.votes ? (x.indMain ? `${x.votes[2].toLocaleString("en-US")} I` : x.votes[0].toLocaleString("en-US")) : ""}</td>
                  <td className="n r">{x.votes ? x.votes[1].toLocaleString("en-US") : ""}</td>
                  <td className="n">{x.votes ? x.votes[3].toLocaleString("en-US") : ""}</td>
                  <td><span className={`pill ${ratingPill(rt)}`}>{RATING_LABEL[rt]}</span></td>
                </tr>
              );
            })}
            {!list.length ? <tr><td colSpan={10} style={{ color: "var(--mute)", padding: 24 }}>No districts match.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
