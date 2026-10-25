"use client";
// The national donor map: every county, three cycles, House, Senate, President and governors, by how many people give,
// how much, which party gets it, how much comes in small gifts, and how each of those moved since 2022.
import React, { useEffect, useMemo, useState } from "react";

type Cell = [number, number, number, number, number]; // donations, donations under $200, dollars, D dollars, R dollars
type GovNom = { name: string; party: string; sep30: number[]; full: number[]; home: number | null };
type GovSt = { nominees: GovNom[]; individuals_only: boolean; unmatched_share: number | null; adapter: string };
type CycInfo = { fed: string | null; gov: string[]; windows: string[]; offices: string[]; period?: string; natl: Record<string, Cell>; gov_summary: Record<string, GovSt> };
export type DMIndex = { built: string; cycles: Record<string, CycInfo>; offices: Record<string, string>; counties: Record<string, [string, string, number, number, number | null]> };
type CycFile = { cycle: number; cells: Record<string, Record<string, Cell>>; top: Record<string, Record<string, [string, string, string, number][]>>; gov: Record<string, GovSt> };
type Geo = [string, string, string][];

const CYC = ["2022", "2024", "2026"];
const BASE = "2022";
const MET: { k: string; l: string; short: string; kind: "seq" | "div" | "chg"; needs?: "usd" | "party" | "base" }[] = [
  { k: "per1k", l: "Donations per 1,000 adults", short: "per 1,000 adults", kind: "seq" },
  { k: "usd", l: "Dollars per adult", short: "dollars per adult", kind: "seq", needs: "usd" },
  { k: "dshare", l: "Democratic share of donor dollars", short: "Democratic share", kind: "div", needs: "party" },
  { k: "small", l: "Share of donations under $200", short: "under $200", kind: "seq" },
  { k: "dshift", l: "Shift in Democratic share since 2022", short: "shift since 2022", kind: "div", needs: "base" },
  { k: "growth", l: "Change in donations per adult since 2022", short: "change since 2022", kind: "chg", needs: "base" },
];
const ST_NAME: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };

const usd = (n: number) => (n < 0 ? "n/a" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const num = (n: number) => (n < 0 ? "n/a" : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : Math.round(n).toLocaleString());
const pc = (x: number | null, d = 0) => (x == null ? "n/a" : `${(x * 100).toFixed(d)}%`);
const lean = (x: number | null) => (x == null ? "n/a" : x >= 0.5 ? `D ${Math.round(x * 100)}%` : `R ${Math.round((1 - x) * 100)}%`);
const OFFN: Record<string, string> = { H: "House", S: "Senate", P: "President", "": "" };

function value(m: string, c: Cell | undefined, b: Cell | undefined, adults: number): number | null {
  if (!c) return null;
  const [n, ns, u, D, R] = c;
  const ds = (x: Cell | undefined) => (x && x[3] >= 0 && x[3] + x[4] >= 1000 ? x[3] / (x[3] + x[4]) : null);
  switch (m) {
    case "per1k": return adults > 0 ? (1000 * n) / adults : null;
    case "usd": return adults > 0 && u >= 0 ? u / adults : null;
    case "dshare": return D >= 0 && D + R >= 1000 ? D / (D + R) : null;
    case "small": return n >= 20 ? ns / n : null;
    case "dshift": { const a = ds(c), z = ds(b); return a != null && z != null ? a - z : null; }
    case "growth": return b && b[0] >= 20 && n >= 0 ? n / b[0] - 1 : null;
  }
  return null;
}

function fmt(m: string, v: number | null) {
  if (v == null) return "n/a";
  if (m === "per1k") return v.toFixed(v < 10 ? 1 : 0);
  if (m === "usd") return `$${v < 10 ? v.toFixed(2) : Math.round(v)}`;
  if (m === "dshare") return lean(v);
  if (m === "small") return pc(v);
  if (m === "dshift") return Math.abs(v) < 0.0005 ? "even" : `${v >= 0 ? "D +" : "R +"}${Math.abs(v * 100).toFixed(1)}`;
  if (m === "growth") return `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;
  return String(v);
}

function quantiles(vals: number[], k: number) {
  const s = vals.slice().sort((a, b) => a - b);
  return Array.from({ length: k - 1 }, (_, i) => s[Math.min(s.length - 1, Math.floor(((i + 1) * s.length) / k))]);
}

export default function DonorMap({ idx }: { idx: DMIndex }) {
  const avail = CYC.filter((c) => idx.cycles[c]);
  const [cy, setCy] = useState(avail[avail.length - 1] ?? "2026");
  const [off, setOff] = useState("all");
  const [met, setMet] = useState("per1k");
  const [win, setWin] = useState("sep30");
  const [st, setSt] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [files, setFiles] = useState<Record<string, CycFile>>({});
  const [err, setErr] = useState<string | null>(null);

  const info = idx.cycles[cy];
  const offices = info?.offices ?? ["all"];
  const o = offices.includes(off) ? off : offices[0];
  const w = info?.windows.includes(win) ? win : "sep30";
  const baseOk = cy !== BASE && !!idx.cycles[BASE] && (idx.cycles[BASE].offices.includes(o));
  const fedKind = info?.fed;
  const metOk = (k: string) => { const x = MET.find((q) => q.k === k)!; if (x.needs === "base") return baseOk; if (x.needs && fedKind === "oct20" && o !== "G") return false; return true; };
  const m = metOk(met) ? met : "per1k";
  const M = MET.find((q) => q.k === m)!;

  useEffect(() => { fetch("/watchdog/us_counties.json").then((r) => r.json()).then(setGeo).catch(() => setErr("The county map did not load.")); }, []);
  useEffect(() => {
    const need = [cy, ...(M.needs === "base" ? [BASE] : [])].filter((c) => idx.cycles[c] && !files[c]);
    need.forEach((c) => fetch(`/forecast/donormap/${c}.json`).then((r) => r.json()).then((d: CycFile) => setFiles((f) => ({ ...f, [c]: d }))).catch(() => setErr(`The ${c} donor file did not load.`)));
  }, [cy, M.needs, files, idx.cycles]);
  useEffect(() => {
    try { const h = new URLSearchParams(window.location.hash.slice(1)); if (h.get("c") && idx.cycles[h.get("c")!]) setCy(h.get("c")!); if (h.get("o")) setOff(h.get("o")!); if (h.get("m")) setMet(h.get("m")!); if (h.get("s")) setSt(h.get("s")); } catch { /* no hash */ }
  }, [idx.cycles]);
  useEffect(() => { try { history.replaceState(null, "", `#c=${cy}&o=${o}&m=${m}${st ? `&s=${st}` : ""}`); } catch { /* ignore */ } }, [cy, o, m, st]);

  const F = files[cy], B = files[BASE];
  const cells = useMemo(() => F?.cells[`${w}|${o}`] ?? {}, [F, w, o]);
  const bcells = useMemo(() => B?.cells[`sep30|${o}`] ?? {}, [B, o]);
  const cnt = idx.counties;

  const vals = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const f of Object.keys(cnt)) out[f] = value(m, cells[f], bcells[f], cnt[f][2]);
    return out;
  }, [cells, bcells, m, cnt]);

  const scale = useMemo(() => {
    const v = Object.values(vals).filter((x): x is number => x != null && isFinite(x));
    if (M.kind === "seq") return { q: quantiles(v, 7) };
    if (m === "dshare") return { q: [0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7] };
    if (m === "dshift") { const a = quantiles(v.map(Math.abs), 4); return { q: [-a[2], -a[1], -a[0], 0, a[0], a[1], a[2]] }; }
    const a = quantiles(v.map(Math.abs), 4); return { q: [-a[2], -a[1], -a[0], 0, a[0], a[1], a[2]] };
  }, [vals, M.kind, m]);

  const cls = (f: string) => {
    const v = vals[f];
    if (o === "G" && !(info?.gov ?? []).includes(cnt[f]?.[1] ?? "")) return "na";
    if (v == null) return cells[f] ? "lo" : "z";
    const q = scale.q;
    if (M.kind === "seq") { let i = 0; while (i < q.length && v > q[i]) i++; return `q${i}`; }
    if (M.kind === "div") { // index 0..7 over 7 cut points: 4 red bins then 4 blue bins
      let i = 0; while (i < q.length && v > q[i]) i++;
      return i < 4 ? `r${4 - i}` : `d${i - 3}`;
    }
    let i = 0; while (i < q.length && v > q[i]) i++;
    return i < 4 ? `m${4 - i}` : `p${i - 3}`;
  };

  // state boxes for zoom, from the projected paths
  const boxes = useMemo(() => {
    const b: Record<string, [number, number, number, number]> = {};
    if (!geo) return b;
    for (const [, s, d] of geo) {
      const n = d.match(/-?\d+(\.\d+)?/g); if (!n) continue;
      const x = b[s] ?? [1e9, 1e9, -1e9, -1e9];
      for (let i = 0; i + 1 < n.length; i += 2) { const px = +n[i], py = +n[i + 1]; if (px < x[0]) x[0] = px; if (py < x[1]) x[1] = py; if (px > x[2]) x[2] = px; if (py > x[3]) x[3] = py; }
      b[s] = x;
    }
    return b;
  }, [geo]);
  const vb = useMemo(() => {
    if (!st || !boxes[st]) return "0 0 960 610";
    const [x0, y0, x1, y1] = boxes[st]; const pad = Math.max(x1 - x0, y1 - y0) * 0.08;
    return `${(x0 - pad).toFixed(1)} ${(y0 - pad).toFixed(1)} ${(x1 - x0 + 2 * pad).toFixed(1)} ${(y1 - y0 + 2 * pad).toFixed(1)}`;
  }, [st, boxes]);

  // states ranked by the measure, from summed county cells
  const states = useMemo(() => {
    const agg: Record<string, { c: Cell; b: Cell; ad: number }> = {};
    for (const f of Object.keys(cnt)) {
      const s = cnt[f][1]; const a = (agg[s] ??= { c: [0, 0, 0, 0, 0], b: [0, 0, 0, 0, 0], ad: 0 });
      a.ad += cnt[f][2];
      const c = cells[f], z = bcells[f];
      if (c) a.c = a.c.map((x, i) => (x < 0 || c[i] < 0 ? -1 : x + c[i])) as Cell;
      if (z) a.b = a.b.map((x, i) => (x < 0 || z[i] < 0 ? -1 : x + z[i])) as Cell;
    }
    return Object.entries(agg).filter(([s, a]) => ST_NAME[s] && a.c[0] > 0).map(([s, a]) => ({ s, v: value(m, a.c, a.b[0] > 0 ? a.b : undefined, a.ad), c: a.c }))
      .filter((x) => x.v != null).sort((a, b) => (b.v as number) - (a.v as number));
  }, [cells, bcells, cnt, m]);

  const natl = info?.natl?.[`${w}|${o}`];
  const focus = pin ?? hov;
  const fc = focus ? cells[focus] : undefined;
  const top = focus && o !== "G" ? F?.top?.[w]?.[focus] : undefined;
  const gov = o === "G" ? (F?.gov ?? info?.gov_summary ?? {}) : {};
  const govRows = Object.entries(gov).filter(([s]) => !st || s === st).sort((a, b) => a[0].localeCompare(b[0]));
  const govBase = files[BASE]?.gov ?? idx.cycles[BASE]?.gov_summary ?? {};
  const legend = scale.q;
  const smax = states.length ? Math.max(...states.map((x) => Math.abs(x.v as number))) : 1;

  return (
    <section className="dm" aria-label="National donor map">
      <div className="dm-bar glass">
        <div className="dm-ctl" role="group" aria-label="Cycle">
          <span className="dn-k">Cycle</span>
          <div className="dm-seg">{CYC.map((c) => <button key={c} type="button" disabled={!idx.cycles[c]} className={c === cy ? "on" : ""} onClick={() => setCy(c)} title={idx.cycles[c] ? "" : "Not pulled yet"}>{c}</button>)}</div>
        </div>
        <div className="dm-ctl" role="group" aria-label="Office">
          <span className="dn-k">Office</span>
          <div className="dm-seg">{["all", "H", "S", "P", "G"].map((x) => <button key={x} type="button" disabled={!offices.includes(x)} className={x === o ? "on" : ""} onClick={() => setOff(x)}>{idx.offices[x]}</button>)}</div>
        </div>
        <div className="dm-ctl" role="group" aria-label="Measure">
          <span className="dn-k">Measure</span>
          <select id="dm-met" className="dn-in" value={m} onChange={(e) => setMet(e.target.value)}>
            {MET.map((x) => <option key={x.k} value={x.k} disabled={!metOk(x.k)}>{x.l}{metOk(x.k) ? "" : " (after the pull)"}</option>)}
          </select>
        </div>
        {info && info.windows.length > 1 ? (
          <div className="dm-ctl" role="group" aria-label="Window">
            <span className="dn-k">Window</span>
            <div className="dm-seg">{[["sep30", `Through Sep 30`], ["full", "Full cycle"]].map(([k, l]) => <button key={k} type="button" className={k === w ? "on" : ""} onClick={() => setWin(k)}>{l}</button>)}</div>
          </div>
        ) : null}
      </div>

      <div className="dm-grid">
        <div className="dm-mapc glass">
          <div className="dm-mh">
            <h2>{M.l}</h2>
            <span>{cy} {o === "all" ? (cy === "2024" ? "House, Senate and President" : "House and Senate") : idx.offices[o]}{M.needs === "base" ? ", against 2022 at the same point" : w === "sep30" ? `, Jan 1 ${+cy - 1} to Sep 30 ${cy}` : ", full cycle"}</span>
            {st ? <button type="button" className="dm-back" onClick={() => setSt(null)}>Whole country</button> : null}
          </div>
          <div className="dm-map" onMouseLeave={() => setHov(null)}>
            {geo ? (
              <svg viewBox={vb} role="img" aria-label={`Every county, colored by ${M.l.toLowerCase()}`}>
                <g className={`dm-g ${M.kind}`} onMouseOver={(e) => { const f = (e.target as SVGElement).getAttribute("data-f"); if (f) setHov(f); }} onClick={(e) => { const f = (e.target as SVGElement).getAttribute("data-f"); if (f) setPin((p) => (p === f ? null : f)); }}>
                  {geo.map(([f, s, d]) => (st && s !== st ? null : <path key={f} d={d} data-f={f} className={`${cls(f)}${f === focus ? " hv" : ""}`} />))}
                </g>
              </svg>
            ) : <div className="dm-load">{err ?? "Drawing 3,100 counties"}</div>}
            {focus && cnt[focus] ? (
              <div className="dm-tip" role="status">
                <b>{cnt[focus][0]}, {cnt[focus][1]}</b>
                <span className="v">{fmt(m, vals[focus])} <small>{M.short}</small></span>
                <dl>
                  <div><dt>Donations</dt><dd>{fc ? num(fc[0]) : "none"}</dd></div>
                  <div><dt>Dollars</dt><dd>{fc ? usd(fc[2]) : "n/a"}</dd></div>
                  <div><dt>Party split</dt><dd>{fc && fc[3] >= 0 && fc[3] + fc[4] > 0 ? lean(fc[3] / (fc[3] + fc[4])) : "n/a"}</dd></div>
                  <div><dt>Under $200</dt><dd>{fc && fc[0] ? pc(fc[1] / fc[0]) : "n/a"}</dd></div>
                  <div><dt>2024 president</dt><dd>{cnt[focus][4] != null ? (cnt[focus][4]! >= 0 ? `Trump +${cnt[focus][4]!.toFixed(0)}` : `Harris +${(-cnt[focus][4]!).toFixed(0)}`) : "n/a"}</dd></div>
                </dl>
                {top?.length ? <ol>{top.map(([n, p, of, u]) => <li key={n}><i className={p === "D" ? "d" : p === "R" ? "r" : ""} />{n}<small>{OFFN[of] ?? of}</small><b>{usd(u)}</b></li>)}</ol> : null}
                {pin ? <button type="button" className="dm-x" onClick={() => setPin(null)}>Close</button> : null}
              </div>
            ) : null}
          </div>
          <div className={`dm-leg ${M.kind}`} aria-label="Legend">
            {Array.from({ length: 8 }, (_, i) => {
              const c = M.kind === "seq" ? (i < 7 ? `q${i}` : null) : M.kind === "div" ? (i < 4 ? `r${4 - i}` : `d${i - 3}`) : (i < 4 ? `m${4 - i}` : `p${i - 3}`);
              return c ? <span key={i} className="sw"><i className={c} /><small>{i === 0 ? `under ${fmt(m, legend[0])}` : i < legend.length ? fmt(m, legend[i - 1]) : `${fmt(m, legend[legend.length - 1])} and up`}</small></span> : null;
            })}
            <span className="sw"><i className="z" /><small>no gifts or too few</small></span>
            {o === "G" ? <span className="sw"><i className="na" /><small>no state data yet</small></span> : null}
          </div>
        </div>

        <aside className="dm-side">
          <div className="glass dm-kpi">
            <span className="dn-k">{cy} {idx.offices[o]}, {w === "sep30" ? "through Sep 30" : "full cycle"}</span>
            {natl ? (
              <dl>
                <div><dt>Donations</dt><dd>{num(natl[0])}</dd></div>
                <div><dt>Dollars</dt><dd>{usd(natl[2])}</dd></div>
                <div><dt>Democratic share</dt><dd className={natl[3] < 0 ? "" : natl[3] > natl[4] ? "d" : "r"}>{natl[3] >= 0 ? pc(natl[3] / (natl[3] + natl[4] || 1)) : "n/a"}</dd></div>
                <div><dt>Under $200</dt><dd>{pc(natl[1] / (natl[0] || 1))}</dd></div>
              </dl>
            ) : <p className="dn-note">Not pulled yet.</p>}
          </div>

          <div className="glass dm-cyc">
            <span className="dn-k">Three cycles, {idx.offices[o]}, through Sep 30</span>
            <table>
              <thead><tr><th>Cycle</th><th className="n">Donations</th><th className="n">Dollars</th><th className="n">D share</th><th className="n">Under $200</th></tr></thead>
              <tbody>{CYC.map((c) => { const x = idx.cycles[c]?.natl?.[`sep30|${o}`]; return (
                <tr key={c} className={c === cy ? "on" : ""}><td>{c}</td>{x ? <><td className="n">{num(x[0])}</td><td className="n">{usd(x[2])}</td><td className="n">{x[3] >= 0 ? pc(x[3] / (x[3] + x[4] || 1)) : "n/a"}</td><td className="n">{pc(x[1] / (x[0] || 1))}</td></> : <td className="n" colSpan={4}>not pulled yet</td>}</tr>
              ); })}</tbody>
            </table>
          </div>

          <div className="glass dm-st">
            <span className="dn-k">States by {M.short}</span>
            <ol>{states.slice(0, 51).map((x) => (
              <li key={x.s}><button type="button" className={x.s === st ? "on" : ""} onClick={() => setSt(x.s === st ? null : x.s)}>
                <b>{x.s}</b><span className="bar"><i className={M.kind !== "seq" ? ((x.v as number) >= (m === "dshare" ? 0.5 : 0) ? "pos" : "neg") : ""} style={{ width: `${Math.min(100, (100 * Math.abs((x.v as number) - (m === "dshare" ? 0.5 : 0))) / (m === "dshare" ? 0.5 : smax || 1))}%` }} /></span><em>{fmt(m, x.v)}</em>
              </button></li>
            ))}</ol>
          </div>
        </aside>
      </div>

      {o === "G" ? (
        <div className="glass dm-gov">
          <div className="dn-sh"><h3>Governor nominees, {cy}{cy !== BASE ? " against 2022" : ""}</h3><span>Itemized gifts from the state filings, Jan 1 of the year before through Sep 30</span></div>
          {govRows.length ? (
            <div className="dm-govg">{govRows.map(([s, g]) => (
              <div key={s} className="dm-govc">
                <b className="nm">{ST_NAME[s] ?? s}</b>
                {g.nominees.filter((n) => n.sep30[0] > 0 || n.party !== "O").map((n) => <div key={n.name} className="row"><i className={n.party === "D" ? "d" : n.party === "R" ? "r" : ""} /><span>{n.name}</span><b>{usd(n.sep30[0])}</b><small>{num(n.sep30[1])} gifts, {pc(n.sep30[1] ? n.sep30[2] / n.sep30[1] : null)} small, {pc(n.home)} home</small></div>)}
                {govBase[s] && cy !== BASE ? <div className="was">2022: {govBase[s].nominees.filter((n) => n.party !== "O").map((n) => `${n.name} ${usd(n.sep30[0])}`).join(", ")}</div> : null}
                {!g.individuals_only ? <small className="dn-note">This state&apos;s file does not say who gave, so every itemized gift is counted.</small> : null}
              </div>
            ))}</div>
          ) : <p className="dn-note">No governor files in this cycle yet. They come from the state campaign finance offices, one state at a time.</p>}
        </div>
      ) : null}
    </section>
  );
}
