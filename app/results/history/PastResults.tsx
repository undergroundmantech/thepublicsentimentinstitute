"use client";
// Past results for a state, 2018 to 2024: every general election for President, U.S. Senate and Governor, statewide
// and county by county, with the shift from any one of them to any other. On a race page the race's own 2026 count
// sits beside them, so a county can be read against how it voted before, the way the networks do on the night.
//
// The counts are in public/results/history/<ST>.json (scripts/history/build_past_results.py; source and method there).
import React, { useEffect, useMemo, useState } from "react";
import { CITATION, OFFICE_NAME, contestKey, contestLabel, counties, defaultBaseline, marginOf, marginText, marginTint, ordered, shareOf, shiftOf, shiftText, surname, turnoutChange, type Contest, type Counts, type StateHistory, type StatesHistory } from "./pastResults";

const cache = new Map<string, Promise<StateHistory | null>>();
export function loadStateHistory(st: string): Promise<StateHistory | null> {
  let p = cache.get(st);
  if (!p) { p = fetch(`/results/history/${st}.json`).then((r) => (r.ok ? (r.json() as Promise<StateHistory>) : null)).catch(() => null); cache.set(st, p); }
  return p;
}
export function useStateHistory(st: string | null | undefined): StateHistory | null {
  const [got, setGot] = useState<{ st: string; h: StateHistory | null } | null>(null);
  useEffect(() => { if (!st) return; let dead = false; void loadStateHistory(st).then((h) => { if (!dead) setGot({ st, h }); }); return () => { dead = true; }; }, [st]);
  // only the file fetched for the state now asked for
  return st && got?.st === st ? got.h : null;
}

let statesP: Promise<StatesHistory | null> | null = null;
/** Every state's statewide lines (no counties), for the national map's past-election setting. Fetched once, when first asked for. */
export function usePastStates(enabled: boolean): StatesHistory | null {
  const [got, setGot] = useState<StatesHistory | null>(null);
  useEffect(() => {
    if (!enabled) return; let dead = false;
    statesP ??= fetch("/results/history/states.json").then((r) => (r.ok ? (r.json() as Promise<StatesHistory>) : null)).catch(() => null);
    void statesP.then((h) => { if (!dead) setGot(h); });
    return () => { dead = true; };
  }, [enabled]);
  return got;
}

/** The 2026 count of one race, by county, to set beside the past: a partial count while votes are still coming in. */
export type CurrentCount = { label: string; short: string; a: [string, string]; b: [string, string]; rows: Record<string, Counts>; total: Counts | null; /** share of the expected vote counted, 0 to 100, or null */ pctIn: number | null; called: boolean };

type Col = { key: string; label: string; short: string; c: Pick<Contest, "a" | "b" | "same" | "part" | "nocty" | "y" | "o" | "sp"> | null; rows: Record<string, Counts>; tot: Counts | null; now: boolean };
const num = (v: number) => v.toLocaleString("en-US");
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);

export default function PastResults({ st, stateName, current = null, id = "past", lead }: { st: string; stateName: string; current?: CurrentCount | null; id?: string; lead?: string }) {
  const h = useStateHistory(st);
  const [nowKey, setNowKey] = useState<string | null>(null), [thenKey, setThenKey] = useState<string | null>(null);
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: "votes", dir: -1 });
  const [q, setQ] = useState(""); const [all, setAll] = useState(false);
  const cols = useMemo<Col[]>(() => {
    if (!h) return [];
    const past = ordered(h).map((c) => ({ key: contestKey(c), label: contestLabel(c), short: contestLabel(c, true), c, rows: c.c, tot: c.part ? null : c.tot, now: false }));
    return current ? [{ key: "now", label: current.label, short: current.short, c: { a: current.a, b: current.b, same: false, y: 2026, o: "S" as const, sp: false }, rows: current.rows, tot: current.total, now: true }, ...past] : past;
  }, [h, current]);
  const rows = useMemo(() => (h ? counties(h) : []), [h]);
  if (!h || !cols.length) return null;
  // what is compared: the 2026 count where there is one, else the latest election; against the one before it for the same office
  const nowCol = cols.find((c) => c.key === nowKey) ?? cols[0];
  const dflt = (() => { if (nowCol.now) { const p = cols.filter((c) => !c.now && !c.c?.same && !c.c?.part && !c.c?.nocty); return p.find((c) => c.c?.o === "P") ?? p[0] ?? null; } const b = nowCol.c ? defaultBaseline(h, nowCol.c as Contest) : null; return b ? cols.find((c) => c.key === contestKey(b)) ?? null : null; })();
  const thenCol = cols.find((c) => c.key === thenKey && c.key !== nowCol.key) ?? dflt;
  const shift = (f: string) => (thenCol ? shiftOf(nowCol.rows[f], thenCol.rows[f], nowCol.c ?? undefined, thenCol.c ?? undefined) : null);
  const ql = q.trim().toLowerCase();
  const val = (f: string, k: string): number | string | null => k === "name" ? (h.names[f] ?? f) : k === "shift" ? shift(f) : k === "votes" ? nowCol.rows[f]?.[2] ?? null : k === "turnout" ? (thenCol ? turnoutChange(nowCol.rows[f], thenCol.rows[f]) : null) : marginOf(cols.find((c) => c.key === k)?.rows[f]);
  const list = rows.filter((r) => !r.whole && (!ql || r.name.toLowerCase().includes(ql))).sort((x, y) => {
    const a = val(x.fips, sort.k), b = val(y.fips, sort.k);
    if (a == null && b == null) return x.name.localeCompare(y.name); if (a == null) return 1; if (b == null) return -1;
    return typeof a === "string" ? sort.dir * a.localeCompare(b as string) : sort.dir * ((a as number) - (b as number)) || x.name.localeCompare(y.name);
  });
  const whole = rows.filter((r) => r.whole);
  const shown = all || ql ? list : list.slice(0, 25);
  const by = (k: string, first: 1 | -1 = -1) => setSort((s) => (s.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: first }));
  const th = (k: string, label: React.ReactNode, title?: string, cls = "") => <th key={k} scope="col" className={`${cls}${sort.k === k ? " on" : ""}`} aria-sort={sort.k === k ? (sort.dir > 0 ? "ascending" : "descending") : undefined}><button type="button" onClick={() => by(k, k === "name" ? 1 : -1)} title={title}>{label}{sort.k === k ? <i aria-hidden>{sort.dir > 0 ? " ▲" : " ▼"}</i> : null}</button></th>;
  const cell = (col: Col, x: Counts | null | undefined, key: string) => {
    const m = marginOf(x);
    const tip = x && col.c ? `${col.label}: ${col.c.a ? `${surname(col.c.a[0])} ${pct(shareOf(x, 0))} (${num(x[0])})` : ""}${col.c.b ? ` · ${surname(col.c.b[0])} ${pct(shareOf(x, 1))} (${num(x[1])})` : ""} · ${num(x[2])} votes` : `${col.label}: no county figures`;
    return <td key={key} className={`m${col.key === nowCol.key ? " cmp" : ""}${thenCol && col.key === thenCol.key ? " base" : ""}`} style={{ background: marginTint(m, col.c?.same) }} title={tip}>{marginText(m, col.c ?? undefined)}</td>;
  };
  const shiftCell = (s: number | null) => <td className={`sh${s == null ? "" : s < 0 ? " d" : " r"}`}>{s == null ? "—" : <><i aria-hidden>{s < 0 ? "◀" : "▶"}</i>{shiftText(s)}</>}</td>;
  const stateShift = thenCol && nowCol.tot && thenCol.tot ? shiftOf(nowCol.tot, thenCol.tot, nowCol.c ?? undefined, thenCol.c ?? undefined) : null;
  const partial = current && nowCol.now && !current.called;
  return (
    <section className="pr" id={id} aria-labelledby={`${id}-h`}>
      <style>{CSS}</style>
      <header className="pr-h">
        <h2 id={`${id}-h`}>{stateName}: past results{current ? " and this count" : ""}</h2>
        <p>{lead ?? `How ${stateName} and each of its counties voted for President, U.S. Senate and Governor from 2018 to 2024${current ? ", beside this race's 2026 count" : ""}. Pick any two elections to see the shift between them, county by county.`}</p>
      </header>

      <div className="pr-state" role="table" aria-label={`${stateName} statewide results`}>
        <div className="pr-srow pr-shd" role="row"><span role="columnheader">Election</span><span role="columnheader">Democrat</span><span role="columnheader">Republican</span><span role="columnheader">Margin</span><span role="columnheader">Votes</span></div>
        {cols.map((c) => { const m = marginOf(c.tot); const A = c.c?.a, B = c.c?.b; return (
          <div key={c.key} className={`pr-srow${c.now ? " now" : ""}`} role="row">
            <span role="cell" className="el"><b>{c.label}</b>{c.now ? <small>{current!.called ? "On Point call made" : current!.pctIn != null ? `${current!.pctIn.toFixed(0)}% of the expected vote counted` : "count in progress"}</small> : c.c?.part ? <small>{c.c.part[0]} of {c.c.part[1]} counties in the source</small> : c.c?.nocty ? <small>statewide only: no usable county returns in the source</small> : null}</span>
            <span role="cell" className="a">{A ? <>{A[0]}{A[1] !== "D" ? <em> ({A[1] === "R" ? "R" : "I"})</em> : null}<small>{c.tot ? pct(shareOf(c.tot, 0)) : "—"}</small></> : "—"}</span>
            <span role="cell" className="b">{B ? <>{B[0]}{B[1] !== "R" ? <em> ({B[1] === "D" ? "D" : "I"})</em> : null}<small>{c.tot ? pct(shareOf(c.tot, 1)) : "—"}</small></> : "—"}</span>
            <span role="cell" className="mg"><i style={{ background: marginTint(m, c.c?.same) }}>{c.tot ? marginText(m, c.c ?? undefined) : "partial"}</i></span>
            <span role="cell" className="vt">{c.tot ? num(c.tot[2]) : "—"}</span>
          </div>); })}
      </div>

      <div className="pr-ctl">
        <label><span>Shift in</span>
          <select value={nowCol.key} onChange={(e) => setNowKey(e.target.value)} aria-label="The election to read">{cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
        <label><span>against</span>
          <select value={thenCol?.key ?? ""} onChange={(e) => setThenKey(e.target.value)} aria-label="The election to compare it with">{cols.filter((c) => c.key !== nowCol.key).map((c) => <option key={c.key} value={c.key}>{c.label}{c.c?.same ? " (one party)" : ""}</option>)}</select></label>
        {stateShift != null ? <span className={`pr-chip ${stateShift < 0 ? "d" : "r"}`}>Statewide shift: <b>{shiftText(stateShift)}</b></span> : null}
        <label className="grow"><span className="sr">Find a county</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a county" /></label>
      </div>
      {partial ? <p className="pr-warn" role="note"><b>A count in progress.</b> The 2026 column is the vote counted so far, and its shift compares a partial count with a finished one: early returns are not a sample of the county. Read it county by county as each one finishes.</p> : null}
      {nowCol.c?.same || thenCol?.c?.same ? <p className="pr-warn" role="note">One of these two contests was between two candidates of the same party, so no party shift can be read from it.</p> : null}

      <div className="pr-wrap">
        <table className="pr-t">
          <thead><tr>
            {th("name", "County", undefined, "nm")}
            {th("shift", <>Shift</>, thenCol ? `${nowCol.label} margin minus ${thenCol.label} margin. D+ is a move toward the Democrat, R+ toward the Republican.` : undefined, "sh")}
            {cols.map((c) => th(c.key, <>{c.now ? "2026" : c.c?.y}<small>{c.now ? current!.short : OFFICE_NAME[(c.c as Contest).o].replace("U.S. ", "")}{c.c?.sp ? "*" : ""}</small></>, `${c.label}: margin in each county. Sort by it.`, `m${c.key === nowCol.key ? " cmp" : ""}${thenCol && c.key === thenCol.key ? " base" : ""}`))}
            {th("votes", <>Votes<small>{nowCol.short}</small></>, `Votes cast in ${nowCol.label}`, "vt")}
            {th("turnout", <>Change<small>in votes</small></>, thenCol ? `Votes cast in ${nowCol.label} against ${thenCol.label}` : undefined, "vt")}
          </tr></thead>
          <tbody>
            <tr className="tot"><th scope="row" className="nm">Statewide</th>{shiftCell(stateShift)}{cols.map((c) => cell(c, c.tot, c.key))}<td className="vt">{nowCol.tot ? num(nowCol.tot[2]) : "—"}</td><td className="vt">{(() => { const t = thenCol ? turnoutChange(nowCol.tot, thenCol.tot) : null; return t == null ? "—" : `${t > 0 ? "+" : ""}${t.toFixed(1)}%`; })()}</td></tr>
            {shown.map((r) => { const t = thenCol ? turnoutChange(nowCol.rows[r.fips], thenCol.rows[r.fips]) : null; return (
              <tr key={r.fips}><th scope="row" className="nm">{r.name}</th>{shiftCell(shift(r.fips))}{cols.map((c) => cell(c, c.rows[r.fips], c.key))}<td className="vt">{nowCol.rows[r.fips] ? num(nowCol.rows[r.fips][2]) : "—"}</td><td className="vt">{t == null ? "—" : `${t > 0 ? "+" : ""}${t.toFixed(1)}%`}</td></tr>); })}
            {!shown.length && !whole.length ? <tr><td colSpan={cols.length + 4} className="none">No county matches that.</td></tr> : null}
            {whole.map((r) => <tr key={r.fips} className="whole"><th scope="row" className="nm">{r.name}</th><td className="sh">—</td>{cols.map((c) => cell(c, c.rows[r.fips], c.key))}<td className="vt">{nowCol.rows[r.fips] ? num(nowCol.rows[r.fips][2]) : "—"}</td><td className="vt">—</td></tr>)}
          </tbody>
        </table>
      </div>
      {!all && !ql && list.length > shown.length ? <button type="button" className="pr-more" onClick={() => setAll(true)}>Show all {list.length} counties</button> : null}
      {all && list.length > 25 ? <button type="button" className="pr-more" onClick={() => setAll(false)}>Show the 25 largest</button> : null}
      <p className="pr-src">Margins are the Republican&apos;s share minus the Democrat&apos;s, in points of all votes cast: D+ where the Democrat led, R+ where the Republican did (an independent who was one of the two leading candidates stands in that party&apos;s place and is named above). The shift is the first election&apos;s margin minus the second&apos;s. Hover a cell for the votes. Past results: {CITATION} They are sums of precinct returns and can differ slightly from the certified totals; an election the source does not cover in full is left out, marked partial or shown statewide only.{cols.some((c) => c.c?.sp) ? " * A special election." : ""} For certified results, see the state&apos;s election office.</p>
    </section>
  );
}

const CSS = `
.pr{max-width:1180px;margin:0 auto;display:grid;gap:14px;color:var(--ink2)}
.pr-h h2{margin:0 0 4px;font:800 clamp(20px,2vw,26px) var(--font-d);letter-spacing:-.02em;color:var(--hi)}
.pr-h p{margin:0;max-width:86ch;font-size:14px;line-height:1.55;color:var(--ink2)}
.pr .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.pr-state{border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:13.5px}
.pr-srow{display:grid;grid-template-columns:minmax(150px,1.1fr) minmax(0,1.5fr) minmax(0,1.5fr) 92px 110px;gap:12px;align-items:center;padding:8px 14px;border-top:1px solid rgba(var(--line-rgb),.09)}
.pr-srow:first-child{border-top:0}
.pr-shd{font:700 10px var(--font-m);letter-spacing:.1em;text-transform:uppercase;color:var(--mute);background:rgba(var(--line-rgb),.04)}
.pr-srow.now{background:color-mix(in srgb,var(--gold) 9%,transparent)}
.pr-srow b{color:var(--hi);font-weight:700}.pr-srow small{display:block;font:600 11.5px var(--font-m);color:var(--mute);font-variant-numeric:tabular-nums}
.pr-srow .el small{font-family:var(--font-b);font-weight:500}
.pr-srow .a,.pr-srow .b{min-width:0;color:var(--hi);overflow:hidden;text-overflow:ellipsis}.pr-srow em{font-style:normal;color:var(--mute)}
.pr-srow .a small{color:var(--dem)}.pr-srow .b small{color:var(--gop)}
.pr-srow .mg i{display:inline-block;font:800 12.5px var(--font-m);font-style:normal;color:var(--hi);padding:3px 9px;border-radius:999px;font-variant-numeric:tabular-nums;white-space:nowrap}
.pr-srow .vt{text-align:right;font:600 12.5px var(--font-m);font-variant-numeric:tabular-nums}
.pr-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.pr-ctl label{display:inline-flex;align-items:center;gap:7px;font:700 12px var(--font-b);color:var(--mute)}
.pr-ctl select,.pr-ctl input{font:600 13px var(--font-b);color:var(--hi);background:var(--glass2);border:1px solid var(--line2);border-radius:9px;padding:7px 9px;color-scheme:light dark;max-width:100%}
.pr-ctl .grow{margin-left:auto}.pr-ctl input{min-width:190px}
.pr-chip{font:600 12.5px var(--font-b);padding:6px 11px;border-radius:999px;border:1px solid var(--line2);white-space:nowrap}.pr-chip b{font-family:var(--font-m)}
.pr-chip.d b,.pr-t .sh.d{color:var(--dem)}.pr-chip.r b,.pr-t .sh.r{color:var(--gop)}
.pr-warn{margin:0;padding:8px 12px;border:1px solid var(--line2);border-left:4px solid var(--gold);border-radius:8px;font-size:12.5px;line-height:1.5;max-width:92ch}.pr-warn b{color:var(--hi)}
.pr-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;-webkit-overflow-scrolling:touch}
.pr-t{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
.pr-t th,.pr-t td{padding:7px 10px;border-top:1px solid rgba(var(--line-rgb),.08);white-space:nowrap}
.pr-t thead th{border-top:0;background:rgba(var(--line-rgb),.05);padding:0;vertical-align:bottom;position:sticky;top:0}
.pr-t thead button{all:unset;box-sizing:border-box;display:block;width:100%;padding:8px 10px;cursor:pointer;font:800 12.5px var(--font-m);color:var(--hi);text-align:center}
.pr-t thead button small{display:block;font:600 10px var(--font-m);letter-spacing:.04em;color:var(--mute);text-transform:uppercase}
.pr-t thead button i{font-style:normal;font-size:9px;color:var(--gold)}
.pr-t thead button:hover{background:rgba(var(--line-rgb),.08)}.pr-t thead button:focus-visible{outline:2px solid var(--focus-ring);outline-offset:-2px}
.pr-t thead th.nm button{text-align:left}.pr-t thead th.vt button{text-align:right}
.pr-t thead th.cmp button{box-shadow:inset 0 -3px 0 var(--gold)}.pr-t thead th.base button{box-shadow:inset 0 -3px 0 var(--mute)}
.pr-t th.nm{position:sticky;left:0;z-index:1;text-align:left;font-weight:700;color:var(--hi);background:rgb(var(--bg2-rgb));max-width:210px;overflow:hidden;text-overflow:ellipsis}
.pr-t thead th.nm{z-index:2}
.pr-t td.m{text-align:center;font:700 12.5px var(--font-m);color:var(--hi);min-width:64px}
.pr-t td.m.cmp{box-shadow:inset 2px 0 0 var(--gold),inset -2px 0 0 var(--gold)}.pr-t td.m.base{box-shadow:inset 2px 0 0 var(--mute),inset -2px 0 0 var(--mute)}
.pr-t td.sh{text-align:center;font:800 12.5px var(--font-m);min-width:78px}.pr-t td.sh i{font-style:normal;font-size:9px;margin-right:4px;vertical-align:1px}
.pr-t td.vt{text-align:right;font:600 12.5px var(--font-m)}
.pr-t tr.tot th,.pr-t tr.tot td{border-bottom:2px solid var(--line2);font-weight:800}.pr-t tr.tot th.nm{color:var(--gold)}
.pr-t tr.whole th.nm{font-weight:500;color:var(--mute);white-space:normal;min-width:180px}
.pr-t tbody tr:hover td:not(.m){background:rgba(var(--line-rgb),.05)}
.pr-t td.none{text-align:center;color:var(--mute);padding:18px}
.pr-more{justify-self:start;font:700 12.5px var(--font-b);color:var(--hi);background:none;border:1px solid var(--line2);border-radius:999px;padding:7px 14px;cursor:pointer}.pr-more:hover{border-color:var(--hi)}
.pr-src{margin:0;font-size:12px;line-height:1.55;color:var(--mute);max-width:110ch}
@media (max-width:760px){.pr-srow{grid-template-columns:minmax(0,1fr) 84px;gap:2px 10px}.pr-shd{display:none}.pr-srow .a,.pr-srow .b{grid-column:1;font-size:13px}.pr-srow .a small,.pr-srow .b small{display:inline;margin-left:6px}.pr-srow .mg{grid-column:2;grid-row:1}.pr-srow .vt{grid-column:2;grid-row:2}.pr-ctl .grow{margin-left:0;width:100%}.pr-ctl input{width:100%}}
`;
