"use client";
// The general election, county by county: pick the nominees (or a whole ticket), the county engine runs every county and
// 4,000 simulations in the browser, and every state on the map is the sum of its counties.
import { useEffect, useMemo, useState } from "react";
import Link from "@/app/components/Link";
import Map28 from "./Map28";
import { useJSON, useTicket, type Ticket } from "./useX";
import {
  X, STATE_NAME, FIPS_ST, DEM, REP, IND, RAMP, SHIFT_RAMP, fmtN, fmtK, fmtPct, fmtSh, fmtMg, two, marginColor, probColor, shiftColor, fromDefault, rateLabel, last,
  type DefaultFile, type CountiesGeo, type StatesGeo, type Res,
} from "./lib";

export interface CandOpt { name: string; party: "D" | "R" | "I"; third: number | null; hyp: boolean }
type Layer = "margin" | "win" | "shift";
type Agg = { n: number; wD: number; wR: number; wI: number; D: number; R: number; I: number; O: number };

const isBase = (t: Ticket) => t.dp === "Generic Democrat" && t.rp === "Vance" && !t.dvp && !t.rvp && !t.tp;

export default function Matchup({ def, cands, mode }: { def: DefaultFile; cands: CandOpt[]; mode: "overview" | "general" | "ticket" }) {
  const base = useMemo(() => fromDefault(def), [def]);
  const [t, setT] = useState<Ticket>({ dp: "Generic Democrat", rp: "Vance", dvp: "", rvp: "", tp: "", tps: null });
  const { res: r0, busy } = useTicket(t, base, isBase(t));
  const res: Res = r0 ?? base;
  const [view, setView] = useState<"states" | "counties">("states");
  const [layer, setLayer] = useState<Layer>("margin");
  const [focus, setFocus] = useState<string | null>(null);
  // /2028/general?st=OH opens Ohio's counties
  useEffect(() => { const id = setTimeout(() => { try { const q = new URLSearchParams(window.location.search).get("st"); if (q && STATE_NAME[q.toUpperCase()]) setFocus(q.toUpperCase()); } catch { /* no query */ } }, 0); return () => clearTimeout(id); }, []);
  const sg = useJSON<StatesGeo>(`${X}/states.json`);
  const cg = useJSON<CountiesGeo>(layer === "shift" || view === "counties" || focus ? `${X}/counties.json` : null);
  const m24 = useMemo(() => new Map((cg?.counties ?? []).map((c) => [c[0], c[4]])), [cg]);
  const agg = useMemo(() => {
    const a: Record<string, Agg> = {};
    for (const [f, c] of Object.entries(res.cty)) {
      const st = f.slice(0, 2) === "11" ? "DC" : FIPS_ST[f.slice(0, 2)] ?? "?"; const x = a[st] || (a[st] = { n: 0, wD: 0, wR: 0, wI: 0, D: 0, R: 0, I: 0, O: 0 });
      x.n++; x.D += c[0]; x.R += c[1]; x.I += c[2]; x.O += c[3];
      if (c[2] > c[0] && c[2] > c[1]) x.wI++; else if (c[0] >= c[1]) x.wD++; else x.wR++;
    }
    return a;
  }, [res]);
  const D = res.D, R = res.R, T = res.T;
  /** a state's votes as the map adds them: the sum of its counties; districts use the model's own split */
  const sv = (st: string) => { const a = agg[st], s = res.states[st]; return a ? { D: a.D, R: a.R, I: a.I, O: a.O, m: two(a.D, a.R) } : { D: s.D, R: s.R, I: s.I, O: s.O, m: s.m }; };
  const all = res.VD + res.VR + res.VI + res.VO;
  const fkey = JSON.stringify([res.D, res.R, res.T, layer, view, res.VD]);

  const stateFill = (st: string) => {
    const s0 = res.states[st]; if (!s0) return "rgba(var(--line-rgb),.08)"; const s = { ...s0, ...sv(st) };
    if (T && s.I > s.D && s.I > s.R) return "var(--ind)";
    if (layer === "win") return probColor(s.pD);
    if (layer === "shift") { const a = sg?.a24[st]; return a == null ? "rgba(var(--line-rgb),.1)" : shiftColor(s.m - a, 12); }
    return marginColor(s.m);
  };
  const countyFill = (f: string) => {
    const c = res.cty[f]; if (!c) return "rgba(var(--line-rgb),.08)";
    if (c[2] > c[0] && c[2] > c[1]) return "var(--ind)";
    const m = two(c[0], c[1]);
    if (layer === "win") return probColor(c[4]);
    if (layer === "shift") { const a = m24.get(f); return a == null ? "rgba(var(--line-rgb),.1)" : shiftColor(m - a, 15); }
    return marginColor(m);
  };
  const rowsFor = (d: number, r: number, i: number, o: number) => {
    const tot = d + r + i + o;
    const rows: [string, string, number][] = [[D, DEM, d], [R, REP, r]];
    if (T) rows.push([T, IND, i]);
    rows.sort((a, b) => b[2] - a[2]);
    return (
      <>
        {rows.map(([n, col, v]) => (
          <div className="x28-trow" key={n}><i style={{ background: col }} /><span className="nm">{n}</span><span className="v">{fmtN(v)}</span><span className="p">{fmtSh(v / tot)}</span>
            <span className="bar"><b style={{ width: `${(100 * v) / tot}%`, background: col }} /></span></div>
        ))}
        <div className="x28-trow o"><i /><span className="nm">Other candidates</span><span className="v">{fmtN(o)}</span><span className="p">{fmtSh(o / tot)}</span></div>
      </>
    );
  };
  const stateTip = (st: string) => {
    const s0 = res.states[st]; const a = agg[st]; if (!s0) return <div className="x28-tiph"><b>{STATE_NAME[st] ?? st}</b></div>;
    const s = { ...s0, ...sv(st) }; const a24 = sg?.a24[st];
    return (
      <>
        <div className="x28-tiph"><b>{STATE_NAME[st] ?? st}</b><span>{s.ev} electoral votes</span></div>
        {rowsFor(s.D, s.R, s.I, s.O)}
        <div className="x28-tipk">
          <div><span>Margin</span><b className={s.m < 0 ? "d" : "r"}>{fmtMg(s.m)}</b></div>
          <div><span>{last(D)} wins</span><b className="d">{fmtPct(s.pD)}</b></div>
          <div><span>{last(R)} wins</span><b className="r">{fmtPct(s.pR)}</b></div>
          {a24 != null && <div><span>2024</span><b>{fmtMg(a24)}</b></div>}
        </div>
        {a && <div className="x28-tipf">Votes added up from {a.n} {st === "AK" ? "borough" : "county"} forecasts · {last(D)} carries {a.wD}, {last(R)} {a.wR}{a.wI ? `, ${T} ${a.wI}` : ""} · {fmtN(s.D + s.R + s.I + s.O)} votes · win chances from 4,000 simulations</div>}
        {!focus && <div className="x28-tipc">Click to open its counties</div>}
      </>
    );
  };
  const countyTip = (f: string, st: string, name: string) => {
    const c = res.cty[f]; if (!c) return <div className="x28-tiph"><b>{name}</b><span>{st}</span></div>;
    const m = two(c[0], c[1]); const a = m24.get(f);
    return (
      <>
        <div className="x28-tiph"><b>{name}</b><span>{STATE_NAME[st]}</span></div>
        {rowsFor(c[0], c[1], c[2], c[3])}
        <div className="x28-tipk">
          <div><span>Margin</span><b className={m < 0 ? "d" : "r"}>{fmtMg(m)}</b></div>
          <div><span>{last(D)} carries</span><b className="d">{fmtPct(c[4])}</b></div>
          {a != null && <div><span>2024</span><b>{fmtMg(a)}</b></div>}
          {a != null && <div><span>Shift</span><b className={m - a < 0 ? "d" : "r"}>{fmtMg(m - a)}</b></div>}
        </div>
        {st === "AK" && <div className="x28-tipf">Alaska is forecast statewide and spread over its boroughs by their 2024 presidential and 2026 Senate lean. Alaska reports 2024 by district, so there is no borough 2024 result to compare.</div>}
        {st === "CT" && <div className="x28-tipf">Connecticut is forecast statewide and spread over its eight counties by their 2024 lean and 2020 to 2024 swing</div>}
      </>
    );
  };

  const legend = layer === "shift"
    ? <><span>More D than 2024</span><i style={{ background: SHIFT_RAMP }} /><span>More R</span></>
    : layer === "win" ? <><span>D certain</span><i style={{ background: RAMP }} /><span>R certain</span></>
      : <><span>D +40</span><i style={{ background: RAMP }} /><span>R +40</span>{T && <><b className="sw" style={{ background: "var(--ind)" }} /><span>{T} leads</span></>}</>;

  const keys = Object.keys(res.states).filter((s) => res.states[s].ev > 0);
  const close = [...keys].sort((a, b) => Math.abs(sv(a).m) - Math.abs(sv(b).m)).slice(0, 10);
  const nat = two(res.VD, res.VR);
  const dl = cands.filter((c) => c.party === "D"), rl = cands.filter((c) => c.party === "R"), il = cands.filter((c) => c.party === "I");
  const set = (p: Partial<Ticket>) => { setT((o) => ({ ...o, ...p })); setFocus(null); };
  const grid = [...def.grid].filter((g) => g.odds != null).sort((a, b) => (b.odds ?? 0) - (a.odds ?? 0)).slice(0, 6);
  const fcty = focus && cg ? cg.counties.filter((c) => c[1] === focus && res.cty[c[0]]).map((c) => ({ f: c[0], n: c[2], c: res.cty[c[0]] })).sort((a, b) => (b.c[0] + b.c[1]) - (a.c[0] + a.c[1])) : [];

  return (
    <div className={`x28-mu x28-${mode}`}>
      {mode !== "overview" && (
        <div className="x28-board card">
          <div className="x28-odds">
            <div className="side d"><span className="eye">{D}</span><b>{fmtPct(res.pD)}</b><span className="mute">wins the presidency</span></div>
            {T && <div className="side i"><span className="eye">{T}</span><b>{fmtPct(res.pI)}</b><span className="mute">wins</span></div>}
            <div className="side r"><span className="eye">{R}</span><b>{fmtPct(res.pR)}</b><span className="mute">wins the presidency</span></div>
          </div>
          <EvBar d={res.evD} r={res.evR} i={res.evI} />
          <div className="x28-kv">
            <div><span>Popular vote</span><b className={nat < 0 ? "d" : "r"}>{fmtMg(nat)}</b><em>{fmtSh(res.VD / all)} to {fmtSh(res.VR / all)}{T ? ` to ${fmtSh(res.VI / all)}` : ""}</em></div>
            <div><span>Projected votes</span><b>{fmtK(all)}</b><em>{fmtK(res.VD)} D · {fmtK(res.VR)} R</em></div>
            <div><span>Tipping point</span><b>{res.tip ?? "None"}</b><em>{res.tip && res.states[res.tip] ? fmtMg(res.states[res.tip].m) : ""}</em></div>
            <div><span>No one reaches 270</span><b>{fmtPct(res.pNone)}</b><em>4,000 simulations</em></div>
          </div>
        </div>
      )}

      {mode !== "overview" && (
        <div className="x28-ctl card">
          <label><span>Democrat</span><select id="x28-dp" value={t.dp} onChange={(e) => set({ dp: e.target.value })}>{dl.map((c) => <option key={c.name} value={c.name}>{c.name}{c.hyp ? " · not polled" : ""}</option>)}</select></label>
          {mode === "ticket" && <label><span>Democratic running mate</span><select id="x28-dvp" value={t.dvp} onChange={(e) => set({ dvp: e.target.value })}><option value="">No running mate effect</option>{dl.filter((c) => !c.name.startsWith("Generic") && c.name !== t.dp).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>}
          <label><span>Republican</span><select id="x28-rp" value={t.rp} onChange={(e) => set({ rp: e.target.value })}>{rl.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
          {mode === "ticket" && <label><span>Republican running mate</span><select id="x28-rvp" value={t.rvp} onChange={(e) => set({ rvp: e.target.value })}><option value="">No running mate effect</option>{rl.filter((c) => !c.name.startsWith("Generic") && c.name !== t.rp).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>}
          {mode === "ticket" && <label><span>Third party</span><select id="x28-tp" value={t.tp} onChange={(e) => { const v = e.target.value; const c = cands.find((x) => `${x.party}|${x.name}` === v); set({ tp: v, tps: c?.third ?? (v ? 5 : null) }); }}>
            <option value="">No named third party</option>
            {il.map((c) => <option key={c.name} value={`I|${c.name}`}>{c.name}</option>)}
            {[...dl, ...rl].filter((c) => !c.name.startsWith("Generic")).map((c) => <option key={c.party + c.name} value={`${c.party}|${c.name}`}>{c.name} as an independent</option>)}
          </select></label>}
          {mode === "ticket" && t.tp && <label className="sm"><span>Third party share</span><input id="x28-tps" type="number" min={0} max={40} step={1} value={t.tps ?? 5} onChange={(e) => { const v = Number(e.target.value); if (isFinite(v)) set({ tps: Math.max(0, Math.min(40, v)) }); }} /></label>}
          {mode === "general" && (
            <div className="x28-chips"><span className="eye">Likeliest matchups</span>
              {grid.map((g) => <button type="button" key={g.d + g.r} aria-pressed={t.dp === g.d && t.rp === g.r} onClick={() => set({ dp: g.d, rp: g.r })}>{last(g.d)} v {last(g.r)}<em>{fmtPct(g.odds ?? 0)} likely</em></button>)}
              <button type="button" aria-pressed={isBase(t)} onClick={() => set({ dp: "Generic Democrat", rp: "Vance" })}>Generic D v Vance<em>headline</em></button>
            </div>
          )}
        </div>
      )}

      <div className="x28-mapgrid">
        <div className="card x28-mapcard">
          <div className="x28-seg-row">
            <div className="x28-seg" role="group" aria-label="Map units">
              {(["states", "counties"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "states" ? "States" : "Counties"}</button>)}
            </div>
            <div className="x28-seg" role="group" aria-label="Map layer">
              {([["margin", "Margin"], ["win", "Win chance"], ["shift", "Shift from 2024"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={layer === k} onClick={() => setLayer(k)}>{l}</button>)}
            </div>
          </div>
          <Map28 view={view} stateFill={stateFill} countyFill={countyFill} stateTip={stateTip} countyTip={countyTip} focus={focus} onFocus={setFocus} legend={legend} busy={busy} fkey={fkey}
            label={`${D} against ${R}${T ? ` and ${T}` : ""}: hover any state for its votes, added up from its counties`} />
        </div>
        <aside className="x28-rail">
          {focus && res.states[focus] ? (
            <div className="card x28-panel">
              <div className="card-h"><h3>{STATE_NAME[focus]}</h3><span className="pill">{res.states[focus].ev} EV</span></div>
              <div className="x28-big"><b className={sv(focus).m < 0 ? "d" : "r"}>{fmtMg(sv(focus).m)}</b><span>{rateLabel(sv(focus).m)} · {last(D)} {fmtPct(res.states[focus].pD)}</span></div>
              <div className="x28-sum">{rowsFor(sv(focus).D, sv(focus).R, sv(focus).I, sv(focus).O)}</div>
              <div className="x28-clist">
                <div className="h"><span>Largest {focus === "AK" ? "boroughs" : "counties"}</span><span>Votes</span><span>Margin</span></div>
                {fcty.slice(0, 12).map((x) => { const m = two(x.c[0], x.c[1]); return <div key={x.f}><span>{x.n.replace(/ (County|Parish|Borough|Census Area|City and Borough|Municipality)$/, "")}</span><span>{fmtK(x.c[0] + x.c[1] + x.c[2] + x.c[3])}</span><span className={m < 0 ? "d" : "r"}>{fmtMg(m)}</span></div>; })}
              </div>
              <p className="x28-note">The state line above is the sum of these {agg[focus]?.n ?? ""} {focus === "AK" ? "borough" : "county"} forecasts.</p>
            </div>
          ) : (
            <div className="card x28-panel">
              <div className="card-h"><h3>Closest states</h3><span className="eye">Win chance</span></div>
              <div className="x28-close">
                {close.map((s) => { const x = { ...res.states[s], ...sv(s) }; return (
                  <button type="button" key={s} onClick={() => setFocus(s.split("-")[0])}>
                    <span className="st">{STATE_NAME[s] ?? s}</span><span className={`m ${x.m < 0 ? "d" : "r"}`}>{fmtMg(x.m)}</span>
                    <span className="pb"><b style={{ width: `${x.pD * 100}%` }} /></span><span className="pp">{fmtPct(Math.max(x.pD, x.pR))}</span>
                  </button>); })}
              </div>
              {mode === "overview" && <Link className="btn g x28-cta" href="/2028/general">Pick the nominees</Link>}
            </div>
          )}
        </aside>
      </div>

      {mode !== "overview" && (
        <div className="x28-two">
          <div className="card"><div className="card-h"><h3>Electoral votes across 4,000 simulations</h3><span className="eye">{last(D)} electoral votes</span></div><Hist h={res.hist} /></div>
          <div className="card x28-tbl"><div className="card-h"><h3>Every state</h3><span className="eye">Sum of its counties</span></div>
            <div className="x28-scroll"><table>
              <thead><tr><th>State</th><th>EV</th><th>{last(D)}</th><th>{last(R)}</th>{T && <th>{last(T)}</th>}<th>Margin</th><th>{last(D)} wins</th><th>Votes</th><th>Counties</th></tr></thead>
              <tbody>{[...keys].sort((a, b) => Math.abs(sv(a).m) - Math.abs(sv(b).m)).map((s) => { const x = { ...res.states[s], ...sv(s) }; const tt = x.D + x.R + x.I + x.O; const a = agg[s]; return (
                <tr key={s} onClick={() => setFocus(s.split("-")[0])}><td>{STATE_NAME[s] ?? s}</td><td>{x.ev}</td><td>{fmtSh(x.D / tt)}</td><td>{fmtSh(x.R / tt)}</td>{T && <td>{fmtSh(x.I / tt)}</td>}
                  <td className={x.m < 0 ? "d" : "r"}>{fmtMg(x.m)}</td><td>{fmtPct(x.pD)}</td><td>{fmtN(tt)}</td><td>{a ? `${a.wD} D · ${a.wR} R` : "District"}</td></tr>); })}</tbody>
            </table></div>
          </div>
        </div>
      )}
      {mode === "ticket" && res.prim && (
        <div className="x28-prim card">
          <div className="card-h"><h3>What each nominee carries out of the primary</h3><span className="eye">Consolidation and strength</span></div>
          <div className="x28-kv">
            {(["D", "R"] as const).map((p) => { const x = res.prim?.[p]; if (!x) return null; const nm = p === "D" ? D : R; return (
              <div key={p}><span>{nm}</span><b className={p === "D" ? "d" : "r"}>{fmtSh(x.share, 0)} of primary voters</b>
                <em>{x.front === nm ? "Leads the field" : `Trails ${x.front} at ${fmtSh(x.frontShare, 0)}`} · effect on the margin {fmtMg(x.quality + x.consol, 2)}</em></div>); })}
          </div>
        </div>
      )}
    </div>
  );
}

export function EvBar({ d, r, i = 0 }: { d: number; r: number; i?: number }) {
  return (
    <div className="x28-ev">
      <div className="x28-evn"><b className="d">{Math.round(d)}</b><span>270 to win · average electoral votes</span><b className="r">{Math.round(r)}</b></div>
      <div className="x28-evbar"><i className="d" style={{ width: `${(d / 538) * 100}%` }} />{i > 0.5 && <i className="i" style={{ width: `${(i / 538) * 100}%` }} />}<i className="r" style={{ width: `${(r / 538) * 100}%` }} /><em style={{ left: "50.19%" }} /></div>
    </div>
  );
}
function Hist({ h }: { h: number[] }) {
  const mx = Math.max(...h, 0.001); const W = 560, H = 170;
  return (
    <svg viewBox={`0 0 ${W} ${H + 26}`} className="x28-hist" role="img" aria-label="Distribution of Democratic electoral votes">
      {h.map((v, k) => { const x = 10 + (k / h.length) * (W - 20), w = (W - 20) / h.length - 2, y = H - (v / mx) * (H - 10); return <rect key={k} x={x} y={y} width={w} height={H - y} rx={2} fill={k * 20 + 10 >= 270 ? "var(--dem)" : "var(--gop)"} opacity={0.85} />; })}
      <line x1={10 + (270 / 540) * (W - 20)} x2={10 + (270 / 540) * (W - 20)} y1={0} y2={H} className="mid" />
      {[0, 100, 200, 270, 300, 400, 500].map((e) => <text key={e} x={10 + (e / 540) * (W - 20)} y={H + 18} textAnchor="middle">{e}</text>)}
    </svg>
  );
}
