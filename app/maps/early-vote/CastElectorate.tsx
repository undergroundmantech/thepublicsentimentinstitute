"use client";
// Who has voted so far. The forecast's own 2026 electorate, voter type by voter type, split by how each type votes
// (mail, early in person or Election Day), gives every county a modeled mix of its mail and early voters by party:
// age, race, gender, college and how many of the last four general elections they voted in. The page multiplies
// those mixes by the live ballot counts, matched to each county's reported or modeled party split, so the electorate
// of the ballots cast so far follows every new count. Where a state publishes its early voters by age, race or
// gender, that dimension is matched to the state's own count. Built by scripts/earlyvote/build_cast_electorate.py.
import React, { useEffect, useMemo, useState } from "react";
import { getCapabilities, getDemographics, bandShares, alignRace } from "./lib";
import type { EvRow } from "./consoleData";

type Rec = { t: number; n: number[]; s: number[][]; e: number[] };
type StFile = { st: string; run: string; state: Rec; counties: Record<string, Rec> };
type UsFile = { built: string; labels: Record<string, string[]>; states: Record<string, Rec> };
export type CastCounty = { id: string; name: string; total: number; mail: number; inperson: number; md: number; mr: number; mo: number };
type Dim = "hist" | "age" | "race" | "gender" | "college" | "party";
type Mix = Record<Dim, number[]>;

const DIMS: { k: Dim; label: string; note: string }[] = [
  { k: "hist", label: "Vote history", note: "How many of the last four general elections, 2018 to 2024, these voters cast a ballot in" },
  { k: "age", label: "Age", note: "Age of the voters behind the ballots cast" },
  { k: "race", label: "Race", note: "Race and ethnicity of the voters behind the ballots cast" },
  { k: "gender", label: "Gender", note: "Women and men among the ballots cast" },
  { k: "college", label: "Education", note: "College graduates and voters without a four year degree" },
  { k: "party", label: "Party", note: "Party of the voters behind the ballots cast, reported where the state publishes it and modeled where it does not" },
];
const LABELS: Record<Dim, string[]> = {
  hist: ["0 of 4", "1 of 4", "2 of 4", "3 of 4", "4 of 4"], age: ["18 to 29", "30 to 44", "45 to 64", "65 and over"],
  race: ["White", "Black", "Latino", "Asian and other"], gender: ["Women", "Men"], college: ["College graduates", "No college degree"],
  party: ["Democrats", "Republicans", "Independents"],
};
const HIST_NOTE = ["New or irregular voters", "Voted once", "Voted twice", "Voted three times", "Voted every time"];

const commas = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : commas(n));
const mixRgb = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t)))).join(",")})`;
const shareFill = (t: number, dim: Dim, g: number) => {
  if (dim === "party") return g === 0 ? mixRgb([226, 232, 255], [28, 72, 210], t) : g === 1 ? mixRgb([255, 226, 230], [196, 24, 54], t) : mixRgb([238, 228, 255], [120, 70, 210], t);
  return mixRgb([40, 30, 74], [255, 205, 110], t);
};
const diffFill = (d: number) => { const a = Math.min(1, Math.abs(d) / 10); return d >= 0 ? mixRgb([44, 36, 70], [64, 214, 186], a) : mixRgb([44, 36, 70], [255, 132, 74], a); };

// the 15 shares of a mix, in percent, as one record per dimension in fractions
function toMix(s: number[], party: number[]): Mix {
  const f = (i: number) => s[i] / 100;
  return { age: [f(0), f(1), f(2), f(3)], race: [f(4), f(5), f(6), f(7)], gender: [f(8), 1 - f(8)], college: [f(9), 1 - f(9)],
    hist: [f(10), f(11), f(12), f(13), f(14)], party };
}

/** Mail and early voters by party for a place: the model's expected counts set to the ballots actually cast by mail
 *  and in person, and to the party split where one is known, by iterative fitting. Returns the place's mix. */
function castMix(r: Rec, mail: number, inp: number, party: number[] | null): { mix: Mix; n: number } | null {
  const seed = [r.n.slice(0, 3), r.n.slice(3, 6)].map((x) => x.map((v) => Math.max(v, 1e-3)));
  const rows = [mail, inp]; const T = mail + inp; if (!(T > 0)) return null;
  const cell = seed.map((x, m) => { const s = x.reduce((a, b) => a + b, 0); return x.map((v) => (v / s) * rows[m]); });
  if (party && party.some((p) => p > 0)) {
    const ps = party.reduce((a, b) => a + b, 0); const want = party.map((p) => (p / ps) * T);
    for (let it = 0; it < 25; it++) {
      for (let j = 0; j < 3; j++) { const c = cell[0][j] + cell[1][j]; if (c > 0) { const k = want[j] / c; cell[0][j] *= k; cell[1][j] *= k; } }
      for (let m = 0; m < 2; m++) { const s = cell[m].reduce((a, b) => a + b, 0); if (s > 0) cell[m] = cell[m].map((v) => (v * rows[m]) / s); }
    }
  }
  const acc = new Array(15).fill(0); const pj = [0, 0, 0];
  for (let m = 0; m < 2; m++) for (let j = 0; j < 3; j++) { const w = cell[m][j]; pj[j] += w; const s = r.s[m * 3 + j]; for (let i = 0; i < 15; i++) acc[i] += w * s[i]; }
  return { mix: toMix(acc.map((v) => v / T), pj.map((v) => v / T)), n: T };
}
const fullMix = (r: Rec): Mix => toMix(r.e.slice(0, 15), r.e.slice(15, 18).map((v) => v / 100));
function addMix(into: Mix | null, m: Mix, w: number): Mix {
  const o = into ?? ({ hist: [0, 0, 0, 0, 0], age: [0, 0, 0, 0], race: [0, 0, 0, 0], gender: [0, 0], college: [0, 0], party: [0, 0, 0] } as Mix);
  (Object.keys(m) as Dim[]).forEach((k) => m[k].forEach((v, i) => (o[k][i] += v * w)));
  return o;
}
const scaleMix = (m: Mix, w: number): Mix => Object.fromEntries((Object.keys(m) as Dim[]).map((k) => [k, m[k].map((v) => v / w)])) as Mix;

let usP: Promise<UsFile | null> | null = null;
const getUs = () => (usP ??= fetch("/forecast/ev_cast/US.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));
const stP: Record<string, Promise<StFile | null>> = {};
const getSt = (st: string) => (stP[st] ??= fetch(`/forecast/ev_cast/${st}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));

export default function CastElectorate({ scope, name, rows, counties, cPaths, cBox, states, W, H, onOpen }: {
  scope: string; name: string; rows: EvRow[]; counties: CastCounty[] | null;
  cPaths: { id: string; d: string }[] | null; cBox: string | null; states: { st: string; d: string; cx: number; cy: number; w: number }[]; W: number; H: number;
  onOpen: (st: string) => void;
}) {
  const [us, setUs] = useState<UsFile | null>(null);
  const [sf, setSf] = useState<StFile | null>(null);
  const [dim, setDim] = useState<Dim>("hist");
  const [grpRaw, setGrp] = useState(4);
  const grp = Math.min(grpRaw, LABELS[dim].length - 1);
  const [view, setView] = useState<"share" | "diff">("share");
  const [hov, setHov] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [rep, setRep] = useState<Partial<Record<"age" | "race" | "gender", number[]>>>({});
  useEffect(() => { getUs().then(setUs); }, []);
  useEffect(() => { setSf(null); setRep({}); if (scope === "US") return; let dead = false; getSt(scope).then((f) => { if (!dead) setSf(f); }); return () => { dead = true; }; }, [scope]);
  // a state that publishes its early voters by age, race or gender: read those counts to match the model to them
  useEffect(() => {
    if (scope === "US") return; let dead = false;
    getCapabilities(scope).then(async (cap) => {
      const tot = cap?.categories?.total; if (!tot) return; const out: Partial<Record<"age" | "race" | "gender", number[]>> = {};
      for (const k of ["age", "race", "gender"] as const) {
        if (!tot[k]) continue; const p = await getDemographics(scope, "total", k); if (!p?.values) continue;
        if (k === "gender") { let f = 0, m = 0; for (const [l, v] of Object.entries(p.values)) { if (/^(f|female|women|woman)$/i.test(l.trim())) f += v; else if (/^(m|male|men|man)$/i.test(l.trim())) m += v; } if (f + m > 500) out.gender = [f / (f + m), m / (f + m)]; }
        else { const b = bandShares(p.values, k); if (b) out[k] = k === "race" && sf ? alignRace(b, toMix(sf.state.e, [0, 0, 0]).race, p.values) : b; }
      }
      if (!dead) setRep(out);
    }).catch(() => {});
    return () => { dead = true; };
  }, [scope, sf]);

  const byRow = useMemo(() => Object.fromEntries(rows.map((r) => [r.st, r])), [rows]);
  // every unit on the map: states for the nation, counties for a state, each with its cast mix and its full electorate
  const units = useMemo(() => {
    const out: Record<string, { name: string; n: number; cast: Mix; full: Mix }> = {};
    if (scope === "US") {
      if (!us) return out;
      for (const [st, r] of Object.entries(us.states)) {
        const row = byRow[st]; if (!row || !(row.total > 0)) continue;
        const party = row.pm ? [row.pm.d, row.pm.r, row.pm.o] : row.partyShare > 0.5 ? [row.dem, row.rep, row.ind] : null;
        const c = castMix(r, row.mail, row.inperson, party); if (c) out[st] = { name: row.name, n: c.n, cast: c.mix, full: fullMix(r) };
      }
    } else if (sf && counties) {
      for (const c of counties) {
        const r = sf.counties[c.id]; if (!r || !(c.total > 0)) continue;
        const party = c.md + c.mr + c.mo > 0 ? [c.md, c.mr, c.mo] : null;
        const m = castMix(r, c.mail, c.inperson, party); if (m) out[c.id] = { name: c.name, n: m.n, cast: m.mix, full: fullMix(r) };
      }
      // match the state's published age, race or gender: the same ratio on every county, then each county adds to one
      const tot = Object.values(out).reduce((a, u) => addMix(a, u.cast, u.n), null as Mix | null); const N = Object.values(out).reduce((a, u) => a + u.n, 0);
      if (tot && N > 0) for (const k of Object.keys(rep) as ("age" | "race" | "gender")[]) {
        const want = rep[k]!; const have = tot[k].map((v) => v / N); const ratio = want.map((w, i) => (have[i] > 0 ? w / have[i] : 1));
        for (const u of Object.values(out)) { const x = u.cast[k].map((v, i) => v * ratio[i]); const s = x.reduce((a, b) => a + b, 0); u.cast[k] = s > 0 ? x.map((v) => v / s) : u.cast[k]; }
      }
    }
    return out;
  }, [scope, us, sf, counties, byRow, rep]);
  const agg = useMemo(() => {
    const L = Object.entries(units); const N = L.reduce((a, [, u]) => a + u.n, 0); if (!(N > 0)) return null;
    const cast = scaleMix(L.reduce((a, [, u]) => addMix(a, u.cast, u.n), null as Mix | null)!, N);
    // the full electorate weighted by each place's expected 2026 vote, from the state files' whole electorate
    const fw = L.map(([id, u]) => (scope === "US" ? us?.states[id]?.t : sf?.counties[id]?.t) ?? u.n);
    const fwT = fw.reduce((a, b) => a + b, 0) || 1;
    const full = scaleMix(L.reduce((a, [, u], i) => addMix(a, u.full, fw[i]), null as Mix | null)!, fwT);
    return { N, cast, full };
  }, [units, scope, us]);

  const val = (id: string) => { const u = units[id]; if (!u) return null; const c = u.cast[dim][grp]; return view === "share" ? c : c - u.full[dim][grp]; };
  const vals = Object.keys(units).map(val).filter((v): v is number => v != null).sort((a, b) => a - b);
  const lo = vals.length ? vals[Math.floor(vals.length * 0.05)] : 0, hi = vals.length ? vals[Math.ceil(vals.length * 0.95) - 1] : 1;
  const fill = (id: string) => { const v = val(id); if (v == null) return null; return view === "share" ? shareFill(hi > lo ? (v - lo) / (hi - lo) : 0.5, dim, grp) : diffFill(v * 100); };
  const list = Object.entries(units).map(([id, u]) => ({ id, ...u, v: u.cast[dim][grp], d: u.cast[dim][grp] - u.full[dim][grp] })).sort((a, b) => b.v - a.v);
  const hu = hov ? units[hov] : null;
  const matched = scope !== "US" && (dim === "age" || dim === "race" || dim === "gender") && !!rep[dim];
  const noModel = scope !== "US" && us && !us.states[scope];
  const glabel = LABELS[dim][grp];
  const pctS = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
  const dS = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`;

  return (
    <section className="evx" aria-labelledby="evx-h">
      <div className="evx-head">
        <div>
          <span className="eye g">Who has voted so far · modeled by On Point Polling</span>
          <h2 id="evx-h">The electorate of the {short(agg?.N ?? 0)} ballots cast{scope === "US" ? "" : ` in ${name}`}</h2>
          <p>Every ballot cast so far, by the voters behind it: the forecast&rsquo;s own 2026 electorate, split by who votes by mail, early in person or on Election Day, set to each {scope === "US" ? "state's" : "county's"} live count and party split. Compare it with the whole electorate the forecast expects by Election Day.</p>
        </div>
        <div className="evx-view" role="group" aria-label="Map shows">
          <button aria-pressed={view === "share"} onClick={() => setView("share")}>Share of ballots</button>
          <button aria-pressed={view === "diff"} onClick={() => setView("diff")}>Against the full electorate</button>
        </div>
      </div>
      {noModel ? <p className="evx-note">{name} has no 2026 Senate or governor forecast, so the model has no voter types to read here yet.</p> : null}
      <div className="evx-dims" role="tablist" aria-label="Demographic">
        {DIMS.map((d) => <button key={d.k} role="tab" aria-selected={dim === d.k} className={dim === d.k ? "on" : ""} onClick={() => { setDim(d.k); setGrp(d.k === "hist" ? 4 : d.k === "age" ? 3 : 0); }}>{d.label}</button>)}
      </div>
      <div className="evx-grps" role="group" aria-label={`${DIMS.find((d) => d.k === dim)!.label} groups`}>
        {LABELS[dim].map((l, i) => (
          <button key={l} aria-pressed={grp === i} onClick={() => setGrp(i)} className={dim === "party" ? `p${i}` : ""}>
            <b>{l}</b><span>{agg ? pctS(agg.cast[dim][i]) : "…"}</span>{dim === "hist" ? <em>{HIST_NOTE[i]}</em> : null}
          </button>
        ))}
      </div>
      <div className="evx-body">
        <div className="evx-mapbox" onMouseLeave={() => setHov(null)}>
          {scope === "US" ? (
            <svg className="evx-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${glabel} share of ballots cast by state`}>
              {states.map((s) => { const f = fill(s.st); return <path key={s.st} d={s.d} className={f ? "on" : "off"} style={f ? { fill: f } : undefined} onMouseEnter={() => setHov(s.st)} onClick={units[s.st] ? () => onOpen(s.st) : undefined} />; })}
              {states.filter((s) => s.w > 36).map((s) => <text key={s.st} x={s.cx} y={s.cy + 4}>{s.st}</text>)}
            </svg>
          ) : cPaths && cBox ? (
            <svg className="evx-map" viewBox={cBox} role="img" aria-label={`${glabel} share of ballots cast by county in ${name}`}>
              {cPaths.map((p) => { const f = fill(p.id); return <path key={p.id} d={p.d} className={`${f ? "on" : "off"}${hov === p.id ? " hl" : ""}`} style={f ? { fill: f } : undefined} onMouseEnter={() => setHov(p.id)} />; })}
            </svg>
          ) : <div className="evx-load sx-skel" />}
          <div className="evx-leg">
            {view === "share" ? <><span>{pctS(lo, 0)}</span><i style={{ background: `linear-gradient(90deg, ${shareFill(0, dim, grp)}, ${shareFill(1, dim, grp)})` }} /><span>{pctS(hi, 0)} {glabel.toLowerCase()}</span></>
              : <><span>Fewer than expected</span><i style={{ background: `linear-gradient(90deg, ${diffFill(-10)}, ${diffFill(0)}, ${diffFill(10)})` }} /><span>More {glabel.toLowerCase()} than the full electorate</span></>}
          </div>
          {hu ? (
            <div className="evx-tip">
              <h4>{hu.name}</h4>
              <div className="r"><span>Ballots modeled</span><b>{commas(hu.n)}</b></div>
              <div className="r"><span>{glabel}, ballots cast</span><b>{pctS(hu.cast[dim][grp])}</b></div>
              <div className="r"><span>Full 2026 electorate</span><b>{pctS(hu.full[dim][grp])}</b></div>
              <div className="r"><span>Difference</span><b className={hu.cast[dim][grp] >= hu.full[dim][grp] ? "up" : "dn"}>{dS(hu.cast[dim][grp] - hu.full[dim][grp])} points</b></div>
              <div className="mini">{LABELS[dim].map((l, i) => <span key={l}><i style={{ width: `${hu.cast[dim][i] * 100}%` }} className={dim === "party" ? `p${i}` : i === grp ? "on" : ""} />{l} {pctS(hu.cast[dim][i], 0)}</span>)}</div>
            </div>
          ) : null}
        </div>
        <aside className="evx-side">
          <div className="evx-panel">
            <div className="evx-ph"><span>{DIMS.find((d) => d.k === dim)!.label}{scope === "US" ? ", every modeled state" : `, ${name}`}</span>{matched ? <em className="evx-tag">Matched to {name}&rsquo;s reported {dim}</em> : null}</div>
            {agg ? LABELS[dim].map((l, i) => (
              <button key={l} className={`evx-cmp${grp === i ? " on" : ""}`} onClick={() => setGrp(i)}>
                <span className="l">{l}</span>
                <span className="bars"><i className={`c${dim === "party" ? ` p${i}` : ""}`} style={{ width: `${agg.cast[dim][i] * 100}%` }} /><i className="f" style={{ width: `${agg.full[dim][i] * 100}%` }} /></span>
                <b>{pctS(agg.cast[dim][i])}</b><em className={agg.cast[dim][i] >= agg.full[dim][i] ? "up" : "dn"}>{dS(agg.cast[dim][i] - agg.full[dim][i])}</em>
              </button>
            )) : <p className="evx-note">Loading the model</p>}
            <div className="evx-key"><span><i className="c" />Ballots cast so far</span><span><i className="f" />Full 2026 electorate</span><span>Difference in points</span></div>
            <p className="evx-pn">{DIMS.find((d) => d.k === dim)!.note}.{dim === "hist" ? " A voter counts an election only if old enough to vote in it, so most young voters sit at 0 to 2 of 4." : ""}</p>
          </div>
          <div className="evx-panel">
            <div className="evx-ph"><span>Most {glabel.toLowerCase()}</span><span className="sub">{scope === "US" ? "States" : "Counties"}, share of ballots</span></div>
            <ol className="evx-list">
              {list.slice(0, all ? list.length : 8).map((u) => (
                <li key={u.id} onMouseEnter={() => setHov(u.id)}>
                  {scope === "US" ? <button onClick={() => onOpen(u.id)}>{u.name}</button> : <span>{u.name}</span>}
                  <small>{short(u.n)}</small><b>{pctS(u.v)}</b><em className={u.d >= 0 ? "up" : "dn"}>{dS(u.d)}</em>
                </li>
              ))}
            </ol>
            {list.length > 8 ? <button className="evx-more" onClick={() => setAll((x) => !x)}>{all ? "Show fewer" : `Show all ${list.length}`}</button> : null}
          </div>
        </aside>
      </div>
      <p className="evx-foot">How it works: every county starts from the 1,152 voter types the forecast simulates in it, by age, race, college, party, 2022 and 2024 vote history and Trump approval, each with its chance of voting. A model of On Point Polling likely voters gives each type its chance of voting by mail, early in person or on Election Day under the state&rsquo;s ballot rules, and respondents add the share of women in each type and how many of the 2018 and 2020 elections it voted in. Those mixes are set to the ballots each {scope === "US" ? "state" : "county"} has actually cast by mail and in person, and to its party split, reported or modeled. Where a state publishes early voters by age, race or gender, that dimension follows the state&rsquo;s count. These are estimates, not voter file counts.</p>
    </section>
  );
}
