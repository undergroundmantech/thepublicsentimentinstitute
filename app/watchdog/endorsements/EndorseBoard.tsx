"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Endorsements, ERace, EItem } from "../data";
import PersonToken from "../PersonToken";

const KIND_LABEL: Record<string, string> = { all: "Everyone", politician: "Politicians", union: "Unions", organization: "Groups", media: "Media and podcasters", celebrity: "Celebrities", newspaper: "Newspapers" };
const KIND_ICON: Record<string, string> = { politician: "P", union: "U", organization: "G", media: "M", celebrity: "C", newspaper: "N" };
const PCLS = (p: string | null) => (p === "D" ? "d" : p === "R" ? "r" : p === "I" ? "i" : "");
const ini = (n: string) => n.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const fm = (m?: number) => (m == null ? "" : Math.abs(m) < 0.05 ? "Even" : m < 0 ? `D+${Math.abs(m).toFixed(1)}` : `R+${m.toFixed(1)}`);

function Row({ x }: { x: EItem }) {
  return (
    <li className="en-item">
      <span className={`en-k k-${x.kind}`} title={KIND_LABEL[x.kind] ?? x.kind}>{KIND_ICON[x.kind] ?? "·"}</span>
      <span className="en-who"><b>{x.by}</b>{x.byRole ? <small>{x.byRole}</small> : null}{x.note ? <span className="en-note">{x.note}</span> : null}</span>
      <span className="en-meta">{x.date ? <span className="mono">{x.date.length === 7 ? `${x.date.slice(5)}/${x.date.slice(2, 4)}` : x.date.slice(5).replace("-", "/")}</span> : null}{x.src ? <a href={x.src} target="_blank" rel="noreferrer">source</a> : null}</span>
    </li>
  );
}

function RaceCard({ r, kind, q }: { r: ERace; kind: string; q: string }) {
  const [open, setOpen] = useState(false);
  const cands = r.cands.map((c) => ({ ...c, list: c.list.filter((x) => (kind === "all" || x.kind === kind) && (!q || x.by.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (x.byRole || "").toLowerCase().includes(q))) }));
  const tot = cands.reduce((a, c) => a + c.list.length, 0);
  if (!tot) return null;
  const lim = open ? 999 : 5;
  return (
    <article className="card en-race">
      <div className="en-rh">
        <div><span className="en-st">{r.st}</span><b>{r.state ?? r.st} {r.office === "governor" ? "governor" : "Senate"}</b></div>
        {r.href ? <Link href={r.href} className="wd-pill g">Forecast {fm(r.m)}</Link> : null}
      </div>
      <div className="en-split" aria-hidden="true">
        {cands.filter((c) => c.list.length).map((c) => <i key={c.name} className={PCLS(c.party)} style={{ flex: c.list.length }} />)}
      </div>
      <div className="en-cols" style={{ gridTemplateColumns: `repeat(${Math.min(3, cands.filter((c) => c.list.length).length || 1)}, minmax(0, 1fr))` }}>
        {cands.filter((c) => c.list.length).map((c) => (
          <div key={c.name} className="en-col">
            <div className="en-ch"><b className={PCLS(c.party)}>{c.name}</b><span className="mono">{c.list.length}</span></div>
            <ul>{c.list.slice(0, lim).map((x, i) => <Row key={i} x={x} />)}</ul>
          </div>
        ))}
      </div>
      {cands.some((c) => c.list.length > 5) ? <button type="button" className="wd-btn en-more" onClick={() => setOpen((o) => !o)}>{open ? "Show fewer" : `Show all ${tot}`}</button> : null}
    </article>
  );
}

export default function EndorseBoard({ data }: { data: Endorsements }) {
  const [office, setOffice] = useState<"all" | "senate" | "governor">("all");
  const [kind, setKind] = useState("all");
  const [qRaw, setQ] = useState("");
  const [st, setSt] = useState("");
  const q = qRaw.trim().toLowerCase();

  const all = useMemo(() => data.races.flatMap((r) => r.cands.flatMap((c) => c.list.map((x) => ({ ...x, cand: c.name, party: c.party, st: r.st, office: r.office })))), [data]);
  const big = useMemo(() => {
    const m = new Map<string, { n: number; d: number; r: number; role: string; kind: string }>();
    for (const x of all) {
      const e = m.get(x.by) ?? { n: 0, d: 0, r: 0, role: x.byRole, kind: x.kind };
      e.n++; if (x.party === "D") e.d++; if (x.party === "R") e.r++; m.set(x.by, e);
    }
    return [...m.entries()].filter(([, v]) => v.n >= 3).sort((a, b) => b[1].n - a[1].n).slice(0, 18);
  }, [all]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const x of all) c[x.kind] = (c[x.kind] ?? 0) + 1;
    return c;
  }, [all]);
  const states = useMemo(() => [...new Set(data.races.map((r) => r.st))].sort(), [data]);
  const races = data.races.filter((r) => (office === "all" || r.office === office) && (!st || r.st === st));

  return (
    <div className="en">
      <div className="wd-kpis">
        <div className="wd-kpi"><span>Endorsements</span><b>{all.length.toLocaleString()}</b><small>every one sourced</small></div>
        <div className="wd-kpi"><span>Politicians</span><b>{(counts.politician ?? 0).toLocaleString()}</b><small>presidents to state officials</small></div>
        <div className="wd-kpi"><span>Unions and groups</span><b>{((counts.union ?? 0) + (counts.organization ?? 0)).toLocaleString()}</b><small>labor, issue and business groups</small></div>
        <div className="wd-kpi"><span>Media and famous names</span><b>{((counts.media ?? 0) + (counts.celebrity ?? 0) + (counts.newspaper ?? 0)).toLocaleString()}</b><small>podcasters, celebrities, editorial boards</small></div>
      </div>

      <section className="card en-big">
        <div className="card-h"><h3>The busiest endorsers</h3><span className="eye" style={{ marginLeft: "auto" }}>Tap one to see every race they weighed in on</span></div>
        <div className="en-bigrow">
          {big.map(([name, v]) => (
            <button key={name} type="button" className={`en-bigp${qRaw === name ? " on" : ""}`} onClick={() => setQ(qRaw === name ? "" : name)}>
              <PersonToken ini={ini(name)} party={data.parties?.[name] ?? "O"} role={v.kind === "union" || v.kind === "organization" ? "group" : "surrogate"} size={40} />
              <span><b>{name}</b><small>{v.n} endorsements{v.d && v.r ? " · backs both parties" : v.d ? " · backs Democrats" : v.r ? " · backs Republicans" : ""}</small></span>
            </button>
          ))}
        </div>
      </section>

      <div className="en-bar">
        <div className="wd-chips" role="group" aria-label="Office">
          {(["all", "senate", "governor"] as const).map((o) => <button key={o} type="button" className={office === o ? "on" : ""} aria-pressed={office === o} onClick={() => setOffice(o)}>{o === "all" ? "Senate and governor" : o === "senate" ? "Senate" : "Governor"}</button>)}
        </div>
        <div className="wd-chips" role="group" aria-label="Who is endorsing">
          {["all", "politician", "union", "organization", "media", "celebrity", "newspaper"].filter((k) => k === "all" || counts[k]).map((k) => (
            <button key={k} type="button" className={kind === k ? "on" : ""} aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]} <small className="mono">{counts[k]}</small></button>
          ))}
        </div>
        <select className="wd-input en-st-sel" value={st} onChange={(e) => setSt(e.target.value)} aria-label="State"><option value="">Every state</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <input className="wd-input en-q" value={qRaw} onChange={(e) => setQ(e.target.value)} placeholder="Search an endorser or candidate" aria-label="Search endorsements" />
      </div>

      <div className="en-grid">
        {races.map((r) => <RaceCard key={r.key} r={r} kind={kind} q={q} />)}
      </div>

      {data.unconfirmed.length ? (
        <details className="card en-unc">
          <summary>{data.unconfirmed.length} claims we could not confirm, left out of the counts</summary>
          <ul>{data.unconfirmed.map((u, i) => <li key={i}><b>{u.claim}</b><span>{u.why}</span></li>)}</ul>
        </details>
      ) : null}
    </div>
  );
}
