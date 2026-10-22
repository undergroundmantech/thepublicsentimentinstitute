"use client";
// The live wire: every outlet's latest headlines, grouped by story, with the share of Left, Center and Right
// outlets carrying each one. Open a story to see how each side headlined it. Every line links to the original.
import React, { useEffect, useMemo, useState } from "react";
import { CATS, LEAN_LABEL, type Cat, type Lean } from "./sources";
import { LeanBar, LeanTag, ago, outletName } from "./ui";
import type { Cluster } from "./feed";

type Wire = { at: string; items: number; stories: Cluster[]; outlets: Record<string, { ok: number; fail: number; items: number }> };
let WIRE: Promise<Wire> | null = null;
export function loadWire() { WIRE ??= fetch("/api/news").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))); return WIRE; }

export function useWire() {
  const [w, setW] = useState<Wire | null>(null); const [err, setErr] = useState(false);
  useEffect(() => { loadWire().then(setW).catch(() => setErr(true)); }, []);
  return { w, err };
}

function StoryRow({ c, now, open, onToggle }: { c: Cluster; now: number; open: boolean; onToggle: () => void }) {
  const by = (l: Lean) => c.items.filter((x) => x.lean === l);
  return (
    <article className={`nw-wire-row${open ? " open" : ""}`}>
      <button className="nw-wire-h" aria-expanded={open} onClick={onToggle}>
        <span className="t">{c.head.t}</span>
        <span className="m"><span>{c.outlets} {c.outlets === 1 ? "outlet" : "outlets"}</span><span>{ago(c.last, now)}</span>{c.blind ? <span className="blind">Blindspot for the {LEAN_LABEL[c.blind]}</span> : null}</span>
        <LeanBar n={c.n} label={false} />
      </button>
      {open ? (
        <div className="nw-wire-b">
          {(["L", "C", "R"] as Lean[]).map((l) => (
            <div key={l} className={`nw-col l-${l}`}>
              <h4><LeanTag lean={l} small /> {by(l).length ? `${by(l).length} ${by(l).length === 1 ? "outlet" : "outlets"}` : "Not covered yet"}</h4>
              <ul>{by(l).map((x) => (
                <li key={x.u}><a href={x.u} target="_blank" rel="noopener noreferrer"><b>{outletName(x.o)}</b>{x.op ? <em>Opinion</em> : null}<span>{x.t}</span></a><time>{ago(x.d, now)}</time></li>
              ))}</ul>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function LiveWire({ limit = 40, keys, title = "The live wire", compact = false }: { limit?: number; keys?: string[]; title?: string; compact?: boolean }) {
  const { w, err } = useWire();
  const [cat, setCat] = useState<Cat | "all">("all");
  const [lean, setLean] = useState<Lean | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const list = useMemo(() => {
    let s = w?.stories ?? [];
    if (keys?.length) s = s.filter((c) => { const t = c.items.map((x) => x.t.toLowerCase()).join(" "); return keys.some((k) => t.includes(k.toLowerCase())); });
    if (cat !== "all") s = s.filter((c) => c.cat === cat);
    if (lean !== "all") s = s.filter((c) => c.n[lean] > 0);
    return s;
  }, [w, keys, cat, lean]);
  const multi = list.filter((c) => c.outlets > 1);
  const shown = (keys ? list : multi).slice(0, limit);
  const blindL = (w?.stories ?? []).filter((c) => c.blind === "L").slice(0, 6), blindR = (w?.stories ?? []).filter((c) => c.blind === "R").slice(0, 6);

  return (
    <section className="nw-wire" aria-labelledby="nw-wire-h">
      <div className="nw-sec-h">
        <h2 id="nw-wire-h">{title}</h2>
        <span className="eye">{w ? `${w.items.toLocaleString()} headlines from ${Object.values(w.outlets).filter((o) => o.items > 0).length} outlets · read ${new Date(w.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET` : err ? "The live wire is not reachable right now" : "Reading every outlet's feed"}</span>
      </div>
      {!compact ? (
        <div className="nw-filters">
          <div className="nw-seg" role="group" aria-label="Section"><button aria-pressed={cat === "all"} onClick={() => setCat("all")}>All</button>{CATS.map((c) => <button key={c.k} aria-pressed={cat === c.k} onClick={() => setCat(c.k)}>{c.l}</button>)}</div>
          <div className="nw-seg" role="group" aria-label="Carried by"><button aria-pressed={lean === "all"} onClick={() => setLean("all")}>Every side</button>{(["L", "C", "R"] as Lean[]).map((l) => <button key={l} aria-pressed={lean === l} onClick={() => setLean(l)}>Carried on the {LEAN_LABEL[l]}</button>)}</div>
        </div>
      ) : null}
      {!w && !err ? <div className="nw-skel sx-skel" /> : null}
      {err ? <p className="nw-note">Headlines will appear here as soon as the feeds can be read. The written stories above are unaffected.</p> : null}
      {w && !shown.length ? <p className="nw-note">{keys ? "No new headlines on this story in the last two days." : "No stories carried by more than one outlet in this section yet."}</p> : null}
      <div className="nw-wire-list">{shown.map((c) => <StoryRow key={c.id} c={c} now={now} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} />)}</div>
      {!compact && w ? (
        <div className="nw-blind">
          <div><h3>Blindspots for the Left</h3><p>Stories carried by three or more Right outlets and no Left outlet.</p>{blindL.length ? <ul>{blindL.map((c) => <li key={c.id}><a href={c.head.u} target="_blank" rel="noopener noreferrer">{c.head.t}</a><span>{c.items.map((x) => outletName(x.o)).slice(0, 4).join(", ")}</span></li>)}</ul> : <p className="nw-note">None right now.</p>}</div>
          <div><h3>Blindspots for the Right</h3><p>Stories carried by three or more Left outlets and no Right outlet.</p>{blindR.length ? <ul>{blindR.map((c) => <li key={c.id}><a href={c.head.u} target="_blank" rel="noopener noreferrer">{c.head.t}</a><span>{c.items.map((x) => outletName(x.o)).slice(0, 4).join(", ")}</span></li>)}</ul> : <p className="nw-note">None right now.</p>}</div>
        </div>
      ) : null}
    </section>
  );
}
