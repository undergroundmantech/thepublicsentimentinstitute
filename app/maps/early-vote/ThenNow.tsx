"use client";
// Then and now: the 2026 early vote against the same day before Election Day in 2022 and 2024. Ballots in and the
// registered party split of those ballots, reported where a state published them and modeled where it did not, from
// public/earlyvote-history-model.json, built by scripts/earlyvote/build_history_model.py.
import React, { useEffect, useMemo, useState } from "react";
import type { EvConsole, EvRow } from "./consoleData";

type YrM = { n: (number | null)[]; nRep: number[]; d: (number | null)[]; r: (number | null)[]; pRep: number[] };
type HM = {
  meta: { fit: Record<"2022" | "2024", { countErrorByDay: number[]; partyErrorByDay: (number | null)[] }> };
  us2022: { daily: [number, number, number, number, number | null, number | null, number | null][]; partyStates: string[]; source: string; url: string };
  states: Record<string, Record<"2022" | "2024", YrM>>;
};
type Y = "2022" | "2024";

let hmP: Promise<HM | null> | null = null;
const getHM = () => (hmP ??= fetch("/earlyvote-history-model.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));

const commas = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : commas(n));
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const mLab = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`);
const chg = (r: number) => `${r >= 1 ? "+" : ""}${((r - 1) * 100).toFixed(0)}%`;

/** a value on a fractional day from the national daily rows, read between the two nearest */
function natAt(rows: HM["us2022"]["daily"], d: number, col: number): number | null {
  const s = [...rows].filter((x) => x[col] != null).sort((a, b) => b[0] - a[0]);
  if (!s.length || d > s[0][0]) return null;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i], b = s[i + 1];
    if (d <= a[0] && d >= b[0]) { const k = a[0] === b[0] ? 0 : (a[0] - d) / (a[0] - b[0]); return (a[col] as number) + k * ((b[col] as number) - (a[col] as number)); }
  }
  return s[s.length - 1][col] as number;
}

type Cmp = { st: string; name: string; now: number; n22: number | null; n24: number | null; m22: boolean; m24: boolean;
  pNow: { d: number; r: number; est: boolean } | null; p22: { d: number; r: number; rep: boolean } | null; p24: { d: number; r: number; rep: boolean } | null };

function partyNow(r: EvRow): Cmp["pNow"] {
  if (r.pm) return { d: r.pm.d, r: r.pm.r, est: r.pm.est > 0.5 };
  const t = r.dem + r.rep + r.ind;
  return r.partyShare > 0.5 && t ? { d: r.dem / t, r: r.rep / t, est: false } : null;
}
const margin = (p: { d: number; r: number } | null) => (p ? (p.r - p.d) * 100 : null);

function compare(r: EvRow, hm: HM, day: number): Cmp {
  const h = hm.states[r.st];
  const yr = (y: Y) => {
    const x = h?.[y]; if (!x) return { n: null, m: false, p: null };
    const n = x.n[day] ?? null, dd = x.d[day], rr = x.r[day];
    return { n, m: !x.nRep[day], p: dd != null && rr != null ? { d: dd, r: rr, rep: !!x.pRep[day] } : null };
  };
  const a = yr("2022"), b = yr("2024");
  return { st: r.st, name: r.name, now: r.total, n22: a.n, n24: b.n, m22: a.m, m24: b.m, pNow: partyNow(r), p22: a.p, p24: b.p };
}

// ── charts ────────────────────────────────────────────────────────────────────────────────────────────────────────
function Lines({ series, label, fmt, zero, height = 190, now }: {
  series: { k: string; cls: string; pts: [number, number][]; dash?: boolean; est?: boolean[] }[]; label: string; fmt: (v: number) => string; zero?: boolean; height?: number;
  now?: { d: number; v: number; cls: string; lab: string }[];
}) {
  const W = 560, H = height, P = { l: 46, r: 16, t: 12, b: 24 };
  const all = series.flatMap((s) => s.pts).concat((now ?? []).map((n) => [n.d, n.v] as [number, number]));
  if (!all.length) return null;
  const dMax = 40;
  let lo = Math.min(...all.map((p) => p[1])), hi = Math.max(...all.map((p) => p[1]));
  if (zero) { lo = Math.min(0, lo); } else { const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad; }
  hi = hi * (zero ? 1.06 : 1);
  const x = (d: number) => P.l + ((dMax - Math.min(dMax, d)) / dMax) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - ((v - lo) / (hi - lo || 1)) * (H - P.t - P.b);
  const path = (L: [number, number][]) => [...L].filter((p) => p[0] <= dMax).sort((a, b) => b[0] - a[0]).map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * (hi - lo));
  return (
    <svg className="tn-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="g" /><text x={P.l - 6} y={y(t) + 3} className="ax l">{fmt(t)}</text></g>)}
      {!zero && lo < 0 && hi > 0 ? <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} className="z" /> : null}
      {[40, 30, 21, 14, 7, 0].map((d) => <text key={d} x={x(d)} y={H - 6} className="ax">{d === 0 ? "Election Day" : `${d} days`}</text>)}
      {series.map((s) => s.pts.length > 1 ? <path key={s.k} d={path(s.pts)} className={`ln ${s.cls}${s.dash ? " dash" : ""}`} /> : null)}
      {(now ?? []).map((n, i) => <g key={n.cls + n.lab}><circle cx={x(n.d)} cy={y(n.v)} r={5.5} className={`pt ${n.cls}`} /><text x={x(n.d) > W * 0.55 ? x(n.d) - 12 : x(n.d) + 12} y={Math.max(14, y((now ?? [])[0].v) - 6 + i * 16)} textAnchor={x(n.d) > W * 0.55 ? "end" : "start"} className={`lb ${n.cls}`}>{n.lab}</text></g>)}
    </svg>
  );
}

function PartyBar({ p, tag }: { p: { d: number; r: number } | null; tag?: string }) {
  if (!p) return <div className="tn-pbar none">No party estimate</div>;
  const o = Math.max(0, 1 - p.d - p.r);
  return (
    <div className="tn-pb">
      <div className="bar"><i className="d" style={{ width: pct(p.d, 2) }} /><i className="o" style={{ width: pct(o, 2) }} /><i className="r" style={{ width: pct(p.r, 2) }} /></div>
      <div className="lbls"><span className="d">D {pct(p.d)}</span><span>{tag ?? ""}</span><span className="r">R {pct(p.r)}</span></div>
    </div>
  );
}

// ── the section ───────────────────────────────────────────────────────────────────────────────────────────────────
export default function ThenNow({ data, scope, onOpen }: { data: EvConsole; scope: string; onOpen: (st: string) => void }) {
  const [hm, setHm] = useState<HM | null>(null);
  const [sort, setSort] = useState<"most" | "ahead" | "behind" | "tod" | "tor">("most");
  const [base, setBase] = useState<Y>("2022");
  const [all, setAll] = useState(false);
  useEffect(() => { getHM().then(setHm); }, []);
  const day = Math.min(45, data.daysOut);
  const rows = useMemo(() => (hm ? data.rows.map((r) => compare(r, hm, day)) : []), [hm, data.rows, day]);
  if (!hm) return <section className="tn card"><div className="evc-load sx-skel" style={{ height: 260 }} /></section>;

  const errN = (y: Y) => hm.meta.fit[y].countErrorByDay[day] ?? 0;
  const errP = (y: Y) => hm.meta.fit[y].partyErrorByDay[day] ?? null;
  const nat = hm.us2022.daily;

  // ── one state ──
  if (scope !== "US") {
    const row = data.rows.find((r) => r.st === scope); const h = hm.states[scope];
    if (!row || !h) return null;
    const c = compare(row, hm, day);
    const curve = (y: Y) => h[y].n.map((v, i) => [i, v] as [number, number | null]).filter((p): p is [number, number] => p[1] != null);
    const mcurve = (y: Y) => h[y].d.map((v, i) => [i, v != null && h[y].r[i] != null ? ((h[y].r[i] as number) - v) * 100 : null] as [number, number | null]).filter((p): p is [number, number] => p[1] != null);
    const mNow = margin(c.pNow);
    const card = (y: Y | "2026") => {
      const n = y === "2026" ? c.now : y === "2022" ? c.n22 : c.n24, p = y === "2026" ? c.pNow : y === "2022" ? c.p22 : c.p24;
      const mod = y === "2026" ? !!c.pNow?.est : y === "2022" ? !c.p22?.rep : !c.p24?.rep;
      const nMod = y === "2022" ? c.m22 : y === "2024" ? c.m24 : false;
      return (
        <div className={`tn-yr y${y}`}>
          <div className="h"><b>{y}</b><span>{y === "2026" ? "today" : "same day"}</span></div>
          <div className="n">{n != null ? short(n) : "n/a"}{nMod && n != null ? <em className="tag m">Modeled ±{Math.round(errN(y as Y) * 100)}%</em> : null}</div>
          {y !== "2026" && n ? <div className={`v ${c.now >= n ? "up" : "dn"}`}>2026 is {chg(c.now / n)} {c.now >= n ? "ahead" : "behind"}</div> : <div className="v">{commas(c.now)} ballots</div>}
          <PartyBar p={p} tag={p ? (mod ? "modeled" : "reported") : ""} />
          <div className="m"><span>Party lead</span><b className={(margin(p) ?? 0) < 0 ? "d" : "r"}>{p ? mLab(margin(p) as number) : "n/a"}</b></div>
          {y !== "2026" && p && mNow != null ? <div className="m"><span>2026 since</span><b className={mNow - (margin(p) as number) < 0 ? "d" : "r"}>{Math.abs(mNow - (margin(p) as number)) < 0.05 ? "No change" : `${mNow - (margin(p) as number) < 0 ? "D" : "R"} +${Math.abs(mNow - (margin(p) as number)).toFixed(1)}`}</b></div> : null}
        </div>
      );
    };
    return (
      <section className="tn card" aria-labelledby="tn-h">
        <div className="card-h"><h3 id="tn-h">{row.name} then and now</h3><span className="eye" style={{ marginLeft: "auto" }}>{day} days before Election Day</span></div>
        <div className="tn-yrs">{card("2026")}{card("2022")}{card("2024")}</div>
        <div className="tn-charts">
          <figure><figcaption>Ballots cast before Election Day</figcaption>
            <Lines label={`${row.name} ballots by day in 2022, 2024 and 2026`} fmt={short} zero series={[{ k: "22", cls: "c22", pts: curve("2022") }, { k: "24", cls: "c24", pts: curve("2024") }, { k: "26", cls: "c26", pts: row.s26 }]}
              now={[{ d: day, v: c.now, cls: "c26", lab: short(c.now) }]} />
          </figure>
          <figure><figcaption>Party lead of those ballots, by registration</figcaption>
            <Lines label={`${row.name} party lead of early ballots by day`} fmt={(v) => mLab(v)} series={[{ k: "22", cls: "c22", pts: mcurve("2022") }, { k: "24", cls: "c24", pts: mcurve("2024") }]}
              now={mNow != null ? [{ d: day, v: mNow, cls: "c26", lab: mLab(mNow) }] : []} />
          </figure>
        </div>
        <div className="tn-key"><span><i className="c26" />2026</span><span><i className="c24" />2024</span><span><i className="c22" />2022</span></div>
        <p className="evc-note">{c.m22 || c.m24 || !c.p22?.rep || !c.p24?.rep ? `Where ${row.name} published no count or no party split for a past day, the line is the On Point model: ballots from the state's own mail and in person mix on the national clocks, party from its 2026 split moved by how much every state that did publish shifted between that year and now. Typical miss on this day: about ${Math.round(errN("2022") * 100)} percent on ballots${errP("2022") != null ? `, ${errP("2022")} points on the 2022 party lead` : ""}.` : `${row.name} published both its counts and its party split in these years.`}</p>
      </section>
    );
  }

  // ── nationwide ──
  const n22 = natAt(nat, day, 1), mail22 = natAt(nat, day, 2), inp22 = natAt(nat, day, 3);
  const D22 = natAt(nat, day, 4), R22 = natAt(nat, day, 5), O22 = natAt(nat, day, 6);
  const P22 = D22 != null && R22 != null && O22 != null ? { d: D22 / (D22 + R22 + O22), r: R22 / (D22 + R22 + O22) } : null;
  const P26 = data.partyTotal ? { d: data.dem / data.partyTotal, r: data.rep / data.partyTotal } : null;
  // the same states that report in 2026, each on the model where nothing was published, weighted by ballots
  const inSet = data.rows.map((r) => r.st);
  const sumY = (y: Y, d: number) => {
    let n = 0, md = 0, mr = 0, w = 0, mod = 0;
    for (const st of inSet) {
      const h = hm.states[st]; if (!h) continue;
      const v = h[y].n[d]; if (v == null) continue; n += v; if (!h[y].nRep[d]) mod += v;
      const dd = h[y].d[d], rr = h[y].r[d]; if (dd != null && rr != null) { md += dd * v; mr += rr * v; w += v; }
    }
    return { n, mod: n ? mod / n : 0, p: w ? { d: md / w, r: mr / w } : null };
  };
  const s22 = sumY("2022", day), s24 = sumY("2024", day);
  const n22s = s22.n;
  const mod26 = data.pm ? { d: data.pm.d, r: data.pm.r } : null;
  const curveY = (y: Y) => Array.from({ length: 41 }, (_, d) => [d, sumY(y, d).n] as [number, number]).filter((p) => p[1] > 0);
  const marginY = (y: Y) => Array.from({ length: 41 }, (_, d) => { const p = sumY(y, d).p; return [d, p ? (p.r - p.d) * 100 : NaN] as [number, number]; }).filter((p) => isFinite(p[1]));
  const uf = nat.map((r) => [r[0], r[1]] as [number, number]);
  const ufM = nat.filter((r) => r[4] != null).map((r) => [r[0], ((r[5]! - r[4]!) / (r[4]! + r[5]! + r[6]!)) * 100] as [number, number]);

  const sorted = [...rows].sort((a, b) => {
    const ref = (c: Cmp) => (base === "2022" ? c.n22 : c.n24), pr = (c: Cmp) => (base === "2022" ? c.p22 : c.p24);
    const ratio = (c: Cmp) => (ref(c) ? c.now / (ref(c) as number) : null);
    const sh = (c: Cmp) => { const a = margin(c.pNow), b = margin(pr(c)); return a != null && b != null ? a - b : null; };
    if (sort === "ahead") return (ratio(b) ?? -1) - (ratio(a) ?? -1);
    if (sort === "behind") return (ratio(a) ?? 99) - (ratio(b) ?? 99);
    if (sort === "tod") return (sh(a) ?? 999) - (sh(b) ?? 999);
    if (sort === "tor") return (sh(b) ?? -999) - (sh(a) ?? -999);
    return b.now - a.now;
  });
  const LIMIT = 15, shown = all ? sorted.length : Math.min(LIMIT, sorted.length);

  return (
    <section className="tn card" aria-labelledby="tn-h">
      <div className="card-h"><h3 id="tn-h">Then and now</h3><span className="eye" style={{ marginLeft: "auto" }}>2026 against the same day in 2022 and 2024 · {day} days out</span></div>
      <div className="tn-yrs">
        <div className="tn-yr y2026">
          <div className="h"><b>2026</b><span>today</span></div>
          <div className="n">{short(data.total)}</div>
          <div className="v">{short(data.mail)} by mail · {short(data.inperson)} in person</div>
          <PartyBar p={P26} tag="party states" />
          <div className="m"><span>Lead, party states</span><b className={(margin(P26) ?? 0) < 0 ? "d" : "r"}>{P26 ? mLab(margin(P26) as number) : "n/a"}</b></div>
          <div className="m"><span>Lead, every state modeled</span><b className={(margin(mod26) ?? 0) < 0 ? "d" : "r"}>{mod26 ? mLab(margin(mod26) as number) : "n/a"}</b></div>
        </div>
        <div className="tn-yr y2022">
          <div className="h"><b>2022</b><span>same day</span></div>
          <div className="n">{n22s ? short(n22s) : "n/a"}<em className="tag m">{pct(s22.mod, 0)} modeled</em></div>
          {n22s ? <div className={`v ${data.total >= n22s ? "up" : "dn"}`}>2026 is {chg(data.total / n22s)} {data.total >= n22s ? "ahead" : "behind"}</div> : null}
          {n22 != null && mail22 != null && inp22 != null ? <div className="v sm">Tallied that day: {short(n22)}, {short(mail22)} by mail and {short(inp22)} in person, in the states reporting then</div> : null}
          <PartyBar p={P22} tag={`${hm.us2022.partyStates.length} party states`} />
          <div className="m"><span>Lead, party states</span><b className={(margin(P22) ?? 0) < 0 ? "d" : "r"}>{P22 ? mLab(margin(P22) as number) : "n/a"}</b></div>
          <div className="m"><span>Lead, every state modeled</span><b className={(margin(s22.p) ?? 0) < 0 ? "d" : "r"}>{s22.p ? mLab(margin(s22.p) as number) : "n/a"}</b></div>
        </div>
        <div className="tn-yr y2024">
          <div className="h"><b>2024</b><span>same day</span></div>
          <div className="n">{s24.n ? short(s24.n) : "n/a"}<em className="tag m">{pct(s24.mod, 0)} modeled</em></div>
          {s24.n ? <div className={`v ${data.total >= s24.n ? "up" : "dn"}`}>2026 is {chg(data.total / s24.n)} {data.total >= s24.n ? "ahead" : "behind"}</div> : null}
          <div className="v sm">A presidential year, so more ballots were always coming</div>
          <PartyBar p={s24.p} tag="every state modeled" />
          <div className="m"><span>Lead, every state modeled</span><b className={(margin(s24.p) ?? 0) < 0 ? "d" : "r"}>{s24.p ? mLab(margin(s24.p) as number) : "n/a"}</b></div>
        </div>
      </div>
      <div className="tn-charts">
        <figure><figcaption>Ballots cast before Election Day, nationwide</figcaption>
          <Lines label="Ballots cast nationwide by day in 2022, 2024 and 2026" fmt={short} zero
            series={[{ k: "22", cls: "c22", pts: curveY("2022") }, { k: "uf", cls: "c22 thin", pts: uf, dash: true }, { k: "24", cls: "c24", pts: curveY("2024") }, { k: "26", cls: "c26", pts: data.s26 }]}
            now={[{ d: day, v: data.total, cls: "c26", lab: short(data.total) }]} />
        </figure>
        <figure><figcaption>Party lead of the ballots, by registration</figcaption>
          <Lines label="Party lead of early ballots by day" fmt={(v) => mLab(v)}
            series={[{ k: "uf", cls: "c22", pts: ufM }, { k: "m22", cls: "c22", pts: marginY("2022"), dash: true }, { k: "m24", cls: "c24", pts: marginY("2024"), dash: true }]}
            now={[...(P26 ? [{ d: day, v: margin(P26) as number, cls: "c26", lab: `${mLab(margin(P26) as number)} party states` }] : []), ...(mod26 ? [{ d: day, v: margin(mod26) as number, cls: "c26 alt", lab: `${mLab(margin(mod26) as number)} modeled` }] : [])]} />
        </figure>
      </div>
      <div className="tn-key"><span><i className="c26" />2026</span><span><i className="c24" />2024, the same states, modeled where unpublished</span><span><i className="c22" />2022, the same states</span><span><i className="c22 dash" />2022 as tallied that day, or every state modeled for party</span></div>

      <div className="tn-tools">
        <div className="evc-chips" role="group" aria-label="Compare with">{(["2022", "2024"] as Y[]).map((y) => <button key={y} className={base === y ? "on" : ""} onClick={() => setBase(y)}>Against {y}</button>)}</div>
        <div className="evc-chips" role="group" aria-label="Sort">
          {([["most", "Most ballots"], ["ahead", "Furthest ahead"], ["behind", "Furthest behind"], ["tod", "Moved most to D"], ["tor", "Moved most to R"]] as [typeof sort, string][]).map(([k, l]) => <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}
        </div>
      </div>
      <div className="evc-tw">
        <table>
          <thead><tr><th>State</th><th className="n">2026 ballots</th><th className="n">{base} same day</th><th className="n">Change</th><th className="n">2026 party lead</th><th className="n">{base} party lead</th><th className="n">Moved since {base}</th></tr></thead>
          <tbody>{sorted.slice(0, shown).map((c) => {
            const n = base === "2022" ? c.n22 : c.n24, mod = base === "2022" ? c.m22 : c.m24, p = base === "2022" ? c.p22 : c.p24;
            const a = margin(c.pNow), b = margin(p), sh = a != null && b != null ? a - b : null;
            return (
              <tr key={c.st} onClick={() => onOpen(c.st)}>
                <td><b>{c.name}</b></td>
                <td className="n mono">{commas(c.now)}</td>
                <td className="n mono">{n != null ? <>{commas(n)}{mod ? <small>modeled</small> : null}</> : "n/a"}</td>
                <td className={`n mono ${n ? (c.now >= n ? "up" : "dn") : ""}`}>{n ? chg(c.now / n) : "n/a"}</td>
                <td className={`n mono ${(a ?? 0) < 0 ? "d" : "r"}`}>{a != null ? <>{mLab(a)}{c.pNow?.est ? <small>modeled</small> : null}</> : "n/a"}</td>
                <td className={`n mono ${(b ?? 0) < 0 ? "d" : "r"}`}>{b != null ? <>{mLab(b)}{!p?.rep ? <small>modeled</small> : null}</> : "n/a"}</td>
                <td className={`n mono ${sh == null ? "" : sh < 0 ? "d" : "r"}`}>{sh == null ? "n/a" : Math.abs(sh) < 0.05 ? "No change" : `${sh < 0 ? "D" : "R"} +${Math.abs(sh).toFixed(1)}`}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
      {sorted.length > LIMIT ? <div className="evc-more"><button className="btn" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${sorted.length}`}</button></div> : null}
      <p className="evc-note">Past years are added up over the same {inSet.length} states that report in 2026. The 2022 tally of the day is the US Elections Project count across the states reporting to it at the time, with the party split of the {hm.us2022.partyStates.length} states that register by party. A state that published no count for a past day, or no party split, is modeled: its ballots from its own final early vote and mail and in person mix run on the national clocks and lined up with the states that did publish, and its party split from its 2026 split moved by how much the publishing states shifted between that year and today, more where the state leans further. On this day the model misses a published count by about {Math.round(errN("2022") * 100)} percent and a party lead by about {errP("2022") ?? "n/a"} points, so read modeled rows as direction more than decimals. Party is registration, not votes.</p>
    </section>
  );
}
