"use client";
// The 2028 map: general election and both primaries, by state or by county.
// State and county paths are the site's own projected files: /forecast/geo.json and /forecast/atlas/us.json (975 x 610).
import { useEffect, useMemo, useState } from "react";
import FloatTip from "@/app/components/opp/FloatTip";
import { useRouter } from "next/navigation";
import { fmtMg, fmtN, fmtPct, leaderColor, marginColor, probColor, shiftColor, shiftFor, simulate, type Cand, type Coal, type SimState } from "./sim28";

type PF = { party: "D" | "R"; names: string[]; nomination: Record<string, number>; votes: Record<string, number>; full: Record<string, number>; dropout: Record<string, number[]>; calendar: string[][]; states: Record<string, { w: string; pw: number; sh: number; tot: number; tu?: boolean }> };
export interface AtlasProps {
  states: Record<string, SimState & { pD: number; D: number; R: number; O: number; tip: number; a24: number | null; gen: number | null; mig: number | null }>;
  dcand: Record<string, Cand>; rcand: Record<string, Cand>; coal: Coal; pal: Record<string, string>; hypo: string[];
  general: { p_D_win: number; mean_D_EV: number; p10_EV: number; p90_EV: number; nat_margin: number; votes: { D: number; R: number; total: number } };
  prim: Record<"dem" | "dem_noharris" | "gop" | "gop_novance", PF>;
}
type Mode = "gen" | "dem" | "gop";
type Layer = "m" | "p" | "s" | "g" | "mig";
const NAME: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
const FIPS_ST: Record<string, string> = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY" };

const cache = new Map<string, unknown>();
function useJson<T>(url: string | null): T | null {
  // the cache holds the data; the tick only tells React a fetch finished
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!url || cache.has(url)) return;
    let live = true;
    fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) cache.set(url, j); if (live) setTick((t) => t + 1); }).catch(() => undefined);
    return () => { live = false; };
  }, [url]);
  return url && cache.has(url) ? (cache.get(url) as T) : null;
}

export default function Atlas28(p: AtlasProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("gen");
  const [view, setView] = useState<"st" | "co">("st");
  const [layer, setLayer] = useState<Layer>("m");
  const [dC, setDC] = useState("Generic Democrat");
  const [rC, setRC] = useState("Vance");
  const [harris, setHarris] = useState(true);
  const [vance, setVance] = useState(true);
  const [tip, setTip] = useState<{ x: number; y: number; t: string; rows: [string, string, string?][] } | null>(null);
  const geo = useJson<{ states: Record<string, string> }>("/forecast/geo.json");
  const atlas = useJson<{ counties: (string | number | null)[][] }>(view === "co" ? "/forecast/atlas/us.json" : null);
  const cty = useJson<{ cols: string[]; rows: Record<string, (number | null)[]> }>(view === "co" ? "/forecast/2028/counties.json" : null);

  const dflt = dC === "Generic Democrat" && rC === "Vance";
  const shift = (st: string) => shiftFor(p.dcand, p.rcand, dC, rC, st, p.coal);
  const sim = useMemo(() => (dflt ? null : simulate(p.states, (st) => shiftFor(p.dcand, p.rcand, dC, rC, st, p.coal))), [dC, rC, dflt, p.states, p.dcand, p.rcand, p.coal]);
  const fkey = (mode === "dem" ? (harris ? "dem" : "dem_noharris") : (vance ? "gop" : "gop_novance")) as keyof AtlasProps["prim"];
  const field = mode === "gen" ? null : p.prim[fkey];
  const col = useMemo(() => Object.fromEntries((cty?.cols ?? []).map((c, i) => [c, i])), [cty]);

  const stateFill = (st: string): string => {
    const s = p.states[st]; if (!s) return "rgba(120,120,140,.15)";
    if (field) { const w = field.states[st]; return w ? leaderColor(p.pal[w.w] ?? "#888", w.sh) : "rgba(120,120,140,.15)"; }
    const m = s.m + shift(st);
    if (layer === "p") return probColor(sim ? sim.win[st] ?? s.pD : s.pD);
    if (layer === "s") return s.a24 == null ? "#333" : shiftColor(m - s.a24, 12);
    if (layer === "g") return s.gen == null ? "#333" : shiftColor(s.gen, 1);
    if (layer === "mig") return s.mig == null ? "#333" : shiftColor(s.mig, 2);
    return marginColor(m);
  };
  const countyFill = (f: string): string => {
    const r = cty?.rows[f]; if (!r) return "rgba(120,120,140,.12)";
    if (field) { const i = col[`${fkey}_l1`], s = col[`${fkey}_s1`]; const nm = field.names[r[i] as number]; return leaderColor(p.pal[nm] ?? "#888", r[s] as number); }
    const st = FIPS_ST[f.slice(0, 2)]; const m = (r[col.m] as number) + shift(st);
    if (layer === "p") return probColor(r[col.pD] as number);
    if (layer === "s") return shiftColor(m - (r[col.m24] as number), 15);
    if (layer === "g") return shiftColor(r[col.gen] as number, 1.5);
    if (layer === "mig") return shiftColor(r[col.mig] as number, 3);
    return marginColor(m);
  };
  const stateTip = (st: string, e: React.MouseEvent) => {
    const s = p.states[st]; if (!s) return;
    let rows: [string, string, string?][];
    if (field) {
      const w = field.states[st];
      rows = w ? [[w.tu ? "Slight edge, toss up" : "Favorite", w.w, p.pal[w.w]], ["Win chance", fmtPct(w.pw)], ["Projected share", `${w.sh.toFixed(1)}%`], ["Primary votes", fmtN(w.tot)]] : [["No data", ""]];
    } else {
      const m = s.m + shift(st);
      rows = [["2028 model", fmtMg(m), m < 0 ? "var(--dem2)" : "var(--gop2)"], ["Democratic win", fmtPct(sim ? sim.win[st] ?? s.pD : s.pD)],
        ["2024 actual", s.a24 == null ? "n/a" : fmtMg(s.a24)], ["Generations", s.gen == null ? "n/a" : fmtMg(s.gen, 2)], ["Migration", s.mig == null ? "n/a" : fmtMg(s.mig, 2)],
        ...(dflt ? [["Votes, D and R", `${fmtN(s.D)} · ${fmtN(s.R)}`] as [string, string]] : [])];
    }
    setTip({ x: e.clientX, y: e.clientY, t: `${NAME[st] ?? st}${s.ev ? `, ${s.ev} electoral votes` : ""}`, rows });
  };
  const countyTip = (f: string, name: string, e: React.MouseEvent) => {
    const r = cty?.rows[f]; if (!r) return;
    const st = FIPS_ST[f.slice(0, 2)];
    let rows: [string, string, string?][];
    if (field) {
      const n1 = field.names[r[col[`${fkey}_l1`]] as number], n2 = field.names[r[col[`${fkey}_l2`]] as number];
      rows = [[n1, `${(r[col[`${fkey}_s1`]] as number).toFixed(1)}%`, p.pal[n1]], [n2, `${(r[col[`${fkey}_s2`]] as number).toFixed(1)}%`, p.pal[n2]],
        ["Primary votes", fmtN((field.party === "D" ? r[col.dVotes] : r[col.rVotes]) as number)]];
    } else {
      const m = (r[col.m] as number) + shift(st);
      rows = [["2028 model", fmtMg(m), m < 0 ? "var(--dem2)" : "var(--gop2)"], ["2024 actual", fmtMg(r[col.m24] as number)],
        ["Generations", fmtMg(r[col.gen] as number, 2)], ["Migration", fmtMg(r[col.mig] as number, 2)],
        ["Votes, D and R", `${fmtN(r[col.D] as number)} · ${fmtN(r[col.R] as number)}`]];
    }
    setTip({ x: e.clientX, y: e.clientY, t: `${name}, ${st}`, rows });
  };
  const go = (st: string) => router.push(`/forecast/2028/${st.toLowerCase()}/${mode === "gen" ? "president" : mode === "dem" ? "democratic-primary" : "republican-primary"}`);

  // side panel numbers
  const g = p.general;
  const evMean = sim ? sim.mean : g.mean_D_EV, pWin = sim ? sim.pD : g.p_D_win, p10 = sim ? sim.p10 : g.p10_EV, p90 = sim ? sim.p90 : g.p90_EV;
  const natM = g.nat_margin + (dflt ? 0 : (p.dcand[dC]?.[0] ?? 0) + (p.rcand[rC]?.[0] ?? 0) - (p.rcand.Vance?.[0] ?? 0));
  const battle = Object.entries(p.states).filter(([k, s]) => s.ev && !k.includes("-")).map(([k, s]) => [k, s.m + shift(k), sim ? sim.win[k] ?? s.pD : s.pD, s] as const)
    .filter(([, m]) => Math.abs(m) < 10).sort((a, b) => Math.abs(a[1]) - Math.abs(b[1])).slice(0, 12);

  return (
    <div className="p28-atlas">
      <div className="p28-controls">
        <div className="p28-seg" role="tablist" aria-label="Race">
          {([["gen", "General election"], ["dem", "Democratic primary"], ["gop", "Republican primary"]] as [Mode, string][]).map(([k, l]) =>
            <button key={k} type="button" role="tab" aria-selected={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
        </div>
        <div className="p28-seg" aria-label="Map view">
          <button type="button" className={view === "st" ? "on" : ""} onClick={() => setView("st")}>States</button>
          <button type="button" className={view === "co" ? "on" : ""} onClick={() => setView("co")}>Counties</button>
        </div>
      </div>
      <div className="p28-controls sub">
        {mode === "gen" ? (<>
          <label>Democrat <select id="p28-d" value={dC} onChange={(e) => setDC(e.target.value)}>{Object.keys(p.dcand).map((n) => <option key={n} value={n}>{n}{p.dcand[n][2] ? " · no head to head polls" : ""}</option>)}</select></label>
          <label>Republican <select id="p28-r" value={rC} onChange={(e) => setRC(e.target.value)}>{Object.keys(p.rcand).map((n) => <option key={n} value={n}>{n}{p.rcand[n][2] ? " · no head to head polls" : ""}</option>)}</select></label>
          <div className="p28-seg sm" aria-label="Map layer">
            {([["m", "Margin"], ["p", "Win chance"], ["s", "Shift from 2024"], ["g", "Generations"], ["mig", "Migration"]] as [Layer, string][]).map(([k, l]) =>
              <button key={k} type="button" className={layer === k ? "on" : ""} onClick={() => setLayer(k)}>{l}</button>)}
          </div>
        </>) : mode === "dem" ? (
          <div className="p28-seg sm"><button type="button" className={harris ? "on" : ""} onClick={() => setHarris(true)}>Harris runs</button><button type="button" className={!harris ? "on" : ""} onClick={() => setHarris(false)}>Harris does not run</button></div>
        ) : (
          <div className="p28-seg sm"><button type="button" className={vance ? "on" : ""} onClick={() => setVance(true)}>Vance runs</button><button type="button" className={!vance ? "on" : ""} onClick={() => setVance(false)}>Vance does not run</button></div>
        )}
      </div>
      <div className="p28-grid">
        <div className="p28-mapcard card">
          <svg className="p28-map" viewBox="0 0 975 610" role="img" aria-label={mode === "gen" ? "2028 general election map" : "2028 primary map"} onMouseLeave={() => setTip(null)}>
            {view === "co" && atlas && cty ? (
              <g>{atlas.counties.map((c) => <path key={c[0] as string} d={c[4] as string} fill={countyFill(c[0] as string)} className="c"
                onMouseMove={(e) => countyTip(c[0] as string, c[2] as string, e)} onClick={() => go(c[1] as string)} />)}</g>
            ) : null}
            {geo ? (
              <g className={view === "co" ? "lines" : ""}>{Object.entries(geo.states).map(([st, d]) => <path key={st} d={d} className="s"
                fill={view === "co" ? "none" : stateFill(st)} onMouseMove={view === "st" ? (e) => stateTip(st, e) : undefined} onClick={view === "st" ? () => go(st) : undefined} />)}</g>
            ) : null}
            {view === "co" && (!atlas || !cty) ? <text x="487" y="305" textAnchor="middle" className="p28-loading">Loading 3,100 counties</text> : null}
          </svg>
          <Legend mode={mode} layer={layer} field={field} pal={p.pal} />
          {tip ? (
            <FloatTip x={tip.x} y={tip.y} className="p28-tip" scope="opp">
              <b>{tip.t}</b>
              {tip.rows.map(([k, v, c]) => <div key={k} className="row"><span>{k}</span><span style={c ? { color: c } : undefined}>{v}</span></div>)}
            </FloatTip>
          ) : null}
        </div>
        <aside className="p28-side">
          {mode === "gen" ? (<>
            <section className="card">
              <div className="card-h"><h3>{dC} against {rC}</h3><span className="eye">{dflt ? "county simulation" : "state simulation"}</span></div>
              <div className="p28-kpis">
                <div><span className="v d">{Math.round(evMean)}</span><span className="l">Average Democratic electoral votes</span></div>
                <div><span className="v">{fmtPct(pWin)}</span><span className="l">Democratic win chance</span></div>
                <div><span className="v">{Math.round(p10)} to {Math.round(p90)}</span><span className="l">80% range of Democratic electoral votes</span></div>
                <div><span className={`v ${natM < 0 ? "d" : "r"}`}>{fmtMg(natM)}</span><span className="l">National popular vote</span></div>
              </div>
              {dflt ? <p className="note">Projected votes: Democrats {fmtN(g.votes.D)}, Republicans {fmtN(g.votes.R)}, {fmtN(g.votes.total)} in all.</p>
                : <p className="note">Reruns the Electoral College in your browser from each state&apos;s simulated range, moved by both candidates&apos; effects.{sim?.tip ? ` Tipping point: ${NAME[sim.tip[0]]} at ${fmtMg(sim.tip[1])}.` : ""}</p>}
            </section>
            <section className="card">
              <div className="card-h"><h3>Battlegrounds</h3><span className="eye">2024 and 2028</span></div>
              <div className="p28-tbl"><table><thead><tr><th>State</th><th className="n">EV</th><th className="n">2024</th><th className="n">2028</th><th className="n">D win</th></tr></thead><tbody>
                {battle.map(([k, m, pd, s]) => <tr key={k} onClick={() => go(k)}><td>{NAME[k]}</td><td className="n">{s.ev}</td><td className={`n ${s.a24 != null && s.a24 < 0 ? "d" : "r"}`}>{s.a24 == null ? "n/a" : fmtMg(s.a24)}</td><td className={`n ${m < 0 ? "d" : "r"}`}>{fmtMg(m)}</td><td className="n">{fmtPct(pd)}</td></tr>)}
              </tbody></table></div>
            </section>
          </>) : field ? (<>
            <section className="card">
              <div className="card-h"><h3>Who wins the nomination</h3><span className="eye">{fmtN(4000)} primary runs</span></div>
              <Bars rows={field.names.map((n) => [n, field.nomination[n] * 100] as [string, number]).filter((x) => x[1] >= 0.5).sort((a, b) => b[1] - a[1]).slice(0, 8)} pal={p.pal} hypo={p.hypo} unit="%" />
              <p className="note">Each run votes state by state on an assumed calendar, with momentum and dropouts after each window.</p>
            </section>
            <section className="card">
              <div className="card-h"><h3>Projected primary votes</h3><span className="eye">all states</span></div>
              <Bars rows={field.names.map((n) => [n, field.votes[n] / 1e6] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 8)} pal={p.pal} hypo={p.hypo} unit="M" />
            </section>
            <section className="card">
              <div className="card-h"><h3>Early states</h3><span className="eye">window 1</span></div>
              <div className="p28-tbl"><table><thead><tr><th>State</th><th>Favorite</th><th className="n">Win</th><th className="n">Votes</th></tr></thead><tbody>
                {field.calendar[0].map((st) => { const w = field.states[st]; return w ? <tr key={st} onClick={() => go(st)}><td>{NAME[st]}</td><td style={{ color: p.pal[w.w] }}>{w.w}</td><td className="n">{fmtPct(w.pw)}</td><td className="n">{fmtN(w.tot)}</td></tr> : null; })}
              </tbody></table></div>
            </section>
          </>) : null}
        </aside>
      </div>
    </div>
  );
}

function Bars({ rows, pal, hypo, unit }: { rows: [string, number][]; pal: Record<string, string>; hypo: string[]; unit: string }) {
  const mx = Math.max(...rows.map((r) => r[1]), 1e-9);
  return (
    <div className="p28-bars">
      {rows.map(([n, v]) => (
        <div key={n} className="bar"><span className="nm">{n}{hypo.includes(n) ? <i className="hyp">HYP</i> : null}</span>
          <span className="tr"><span className="fl" style={{ width: `${(v / mx) * 100}%`, background: pal[n] ?? "#999" }} /></span>
          <span className="n">{unit === "%" ? `${v.toFixed(v < 10 ? 1 : 0)}%` : `${v.toFixed(1)}M`}</span></div>
      ))}
    </div>
  );
}

function Legend({ mode, layer, field, pal }: { mode: Mode; layer: Layer; field: PF | null; pal: Record<string, string> }) {
  if (field) {
    const lead = [...new Set(Object.values(field.states).map((s) => s.w))];
    return <div className="p28-legend">{lead.map((n) => <span key={n} className="sw"><b style={{ background: pal[n] }} />{n}</span>)}<span className="dim">Deeper shade, bigger share</span></div>;
  }
  const lab: Record<Layer, [string, string, string]> = { m: ["D +40", "R +40", "Pale is close, deep is safe"], p: ["Democrat favored", "Republican favored", "Chance to win the state or county"],
    s: ["Toward D", "Toward R", "2028 model against the 2024 result"], g: ["Toward D", "Toward R", "Deaths, aging, new 18 to 21 voters and life cycle drift"], mig: ["Toward D", "Toward R", "Movers and newly naturalized voters"] };
  const [a, b, c] = lab[layer];
  return (
    <div className="p28-legend">
      <span>{a}</span><i className="ramp" style={{ background: layer === "m" || layer === "p" ? "linear-gradient(90deg,#10288c,#3d7bff,#d6e2ff,#ffdce4,#ff3b5c,#8c0a28)" : "linear-gradient(90deg,#2454d6,#ecf0fa,#faecf0,#c81e40)" }} /><span>{b}</span>
      <span className="dim">{mode === "gen" ? c : ""}</span>
    </div>
  );
}
