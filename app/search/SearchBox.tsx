"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type Entry = { href: string; title: string; kind: string; sub?: string; keys: string };

export default function SearchBox({ entries }: { entries: Entry[] }) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search).get("q");
    if (sp) setQ(sp);
    ref.current?.focus();
  }, []);
  const hits = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return entries.filter((e) => words.every((w) => e.keys.includes(w))).slice(0, 60);
  }, [q, entries]);
  const groups = hits.reduce<Record<string, Entry[]>>((a, e) => { (a[e.kind] ||= []).push(e); return a; }, {});
  return (
    <>
      <style>{`
        .opp .sbx input.search:focus-visible { outline: none; border-color: var(--hi); box-shadow: 0 0 0 3px rgba(var(--line-rgb),.18); }
        .opp .sbx .race { grid-template-columns: minmax(0,1fr) auto; }
        .opp .sbx .path { font: 500 11.5px var(--font-m); color: var(--mute2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40vw; }
        .opp .sbx .race:hover .path { color: var(--ink2); }
        .opp .sbx .hint { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
      `}</style>
      <div className="sbx">
        <label htmlFor="opp-search" className="eye" style={{ display: "block", marginBottom: 8 }}>Race, state or candidate</label>
        <input id="opp-search" ref={ref} className="search" type="search" value={q} placeholder="Try Ohio, Talarico or generic ballot"
          onChange={(e) => { setQ(e.target.value); const u = new URL(window.location.href); if (e.target.value) u.searchParams.set("q", e.target.value); else u.searchParams.delete("q"); window.history.replaceState(null, "", u); }} />
        {!q && (
          <div className="hint">
            {["Georgia", "Senate", "Generic ballot", "Governor", "Approval"].map((t) => (
              <button key={t} type="button" className="btn sm" onClick={() => { setQ(t); const u = new URL(window.location.href); u.searchParams.set("q", t); window.history.replaceState(null, "", u); }}>{t}</button>
            ))}
          </div>
        )}
        <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
          {q && !hits.length && <div className="card empty">Nothing matches that yet. Try a state name or a candidate&rsquo;s last name.</div>}
          {Object.entries(groups).map(([k, list]) => (
            <div className="card" key={k}>
              <div className="card-h"><h3>{k}</h3><span className="eye mono" style={{ marginLeft: "auto" }}>{list.length}</span></div>
              <div>{list.map((e) => (
                <Link key={e.href + e.title} href={e.href} className="race">
                  <span className="who"><b>{e.title}</b>{e.sub && <small>{e.sub}</small>}</span>
                  <span className="path">{e.href}</span>
                </Link>
              ))}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
