"use client";
import { useMemo, useState } from "react";
import Link from "@/app/components/Link";
import Map28 from "../Map28";
import { STATE_NAME, FIPS_ST, RAMP, SHIFT_RAMP, fmtMg, fmtPct, marginColor, probColor, shiftColor } from "../lib";

export type SenRace = { st: string; inc: string; party: "D" | "R"; status: number; note: string; last: number | null; last_year: number; split_prev: number; split_src: string; offset: number; pres24: number };
export type SenFile = { built: string; hold: { D: number; R: number }; up: number; offset_mean: number; sd_race: number; sd_nat: number; sd_senate_nat: number;
  coef: { own_running: number; own_open: number; incumbency: number; i2016: number; i2024: number };
  backtest: Record<string, { n: number; mae: number; mae_pres: number; win: number; win_pres: number; bias: number }>; n_fit: number; races: SenRace[];
  /** each county in a state with a race: its presidential margin relative to its state, and its own split ticket on top of the state's */
  county: { k_run: number; k_open: number; c: Record<string, [number, number]> } };
/** one presidential matchup: the Democrat, the Republican, the Democrat's chance and the margin in every state, R minus D, in the order of keys */
export type SenPair = { d: string; r: string; pD: number; m: number[] };

const N = 10000;
function rng(seed: number) {
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return () => { const x = u() || 1e-12, y = u(); return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * y); };
}
const STATUS = (w: number) => (w >= 1 ? "Running" : w > 0 ? "Undecided" : "Open seat");
const short = (n: string) => (n.startsWith("Generic") ? n : n.split(" ").slice(-1)[0]);

export default function Senate28({ sen, pairs, keys, sig, ev, D, R, odds }: { sen: SenFile; pairs: SenPair[]; keys: string[]; sig: number[]; ev: number[]; D: string[]; R: string[]; odds: Record<string, number> }) {
  const best = useMemo(() => [...pairs].filter((p) => !p.d.startsWith("Generic") && !p.r.startsWith("Generic")).sort((a, b) => (odds[b.d] ?? 0) * (odds[b.r] ?? 0) - (odds[a.d] ?? 0) * (odds[a.r] ?? 0))[0] ?? pairs[0], [pairs, odds]);
  const [dn, setD] = useState(best.d);
  const [rn, setR] = useState(best.r);
  const [shift, setShift] = useState(0);
  const [split, setSplit] = useState(true);
  const [view, setView] = useState<"states" | "counties">("counties");
  const [layer, setLayer] = useState<"margin" | "win" | "split">("margin");
  const [focus, setFocus] = useState<string | null>(null);
  const pair = pairs.find((p) => p.d === dn && p.r === rn) ?? best;

  const sim = useMemo(() => {
    const z = rng(2028);
    const ix = sen.races.map((r) => keys.indexOf(r.st));
    const ne = keys.indexOf("NE");
    const ss = sig.map((s) => Math.sqrt(Math.max(s * s - sen.sd_nat * sen.sd_nat, 1)));
    const wins = new Float64Array(sen.races.length), presM = new Float64Array(sen.races.length), senM = new Float64Array(sen.races.length);
    const seats = new Map<number, number>();
    let ctrl = 0, presD = 0;
    const pres = new Float64Array(keys.length);
    for (let s = 0; s < N; s++) {
      const zn = z() * sen.sd_nat, zy = z() * sen.sd_senate_nat;
      let evD = 0;
      for (let k = 0; k < keys.length; k++) { pres[k] = pair.m[k] + shift + zn + ss[k] * z(); if (pres[k] < 0) evD += ev[k]; }
      if (ne >= 0 && pres[ne] < 0) evD += 2;
      let d = sen.hold.D;
      for (let i = 0; i < ix.length; i++) {
        const p = ix[i] >= 0 ? pres[ix[i]] : sen.races[i].pres24 + shift + zn;
        const m = p + (split ? sen.races[i].offset + zy + sen.sd_race * z() : 0);
        presM[i] += p; senM[i] += m; if (m < 0) { wins[i]++; d++; }
      }
      seats.set(d, (seats.get(d) ?? 0) + 1);
      const dPres = evD >= 270; if (dPres) presD++;
      if (d >= 51 || (d === 50 && dPres)) ctrl++;
    }
    const hist = [...seats.entries()].sort((a, b) => a[0] - b[0]);
    let c = 0; const q = (p: number) => { c = 0; for (const [k, v] of hist) { c += v; if (c >= p * N) return k; } return hist[hist.length - 1][0]; };
    const mean = hist.reduce((a, [k, v]) => a + k * v, 0) / N;
    const races = sen.races.map((r, i) => ({ ...r, pD: wins[i] / N, pres: presM[i] / N, sen: senM[i] / N })).sort((a, b) => Math.abs(a.pD - 0.5) - Math.abs(b.pD - 0.5));
    return { hist, ctrl: ctrl / N, presD: presD / N, mean, p10: q(0.1), med: q(0.5), p90: q(0.9), races };
  }, [pair, shift, split, sen, keys, sig, ev]);

  const byS = useMemo(() => new Map(sim.races.map((r) => [r.st, r])), [sim]);
  const pm = useMemo(() => Object.fromEntries(keys.map((k, i) => [k, pair.m[i] + shift])), [keys, pair, shift]);
  const cty = (f: string) => {
    const c = sen.county.c[f]; const r = byS.get(FIPS_ST[f.slice(0, 2)]); if (!c || !r) return null;
    const pres = (pm[r.st] ?? r.pres24) + c[0]; const off = split ? r.offset + c[1] : 0;
    return { pres, off, sen: pres + off, r };
  };
  const NONE = "rgba(var(--line-rgb),.07)";
  const stateFill = (st: string) => {
    const r = byS.get(st); if (!r) return NONE;
    return layer === "win" ? probColor(r.pD) : layer === "split" ? (split ? shiftColor(r.offset, 10) : NONE) : marginColor(r.sen);
  };
  const countyFill = (f: string) => {
    const c = cty(f); if (!c) return NONE;
    return layer === "win" ? probColor(c.r.pD) : layer === "split" ? (split ? shiftColor(c.off, 14) : NONE) : marginColor(c.sen);
  };
  const tipK = (pres: number, off: number, m: number) => (
    <div className="x28-tipk">
      <div><span>President</span><b className={pres < 0 ? "d" : "r"}>{fmtMg(pres)}</b></div>
      <div><span>Split ticket</span><b className={off < 0 ? "d" : "r"}>{split ? fmtMg(off) : "Off"}</b></div>
      <div><span>Senate</span><b className={m < 0 ? "d" : "r"}>{fmtMg(m)}</b></div>
    </div>
  );
  const stateTip = (st: string) => {
    const r = byS.get(st);
    if (!r) return <><div className="x28-tiph"><b>{STATE_NAME[st] ?? st}</b><span>No Senate race in 2028</span></div></>;
    return (
      <>
        <div className="x28-tiph"><b>{STATE_NAME[st]}</b><span>{r.inc}, {r.party} · {STATUS(r.status)}</span></div>
        {tipK(r.pres, split ? r.offset : 0, r.sen)}
        <div className="x28-tipk"><div><span>Democrat wins</span><b className="d">{fmtPct(r.pD)}</b></div><div><span>Republican wins</span><b className="r">{fmtPct(1 - r.pD)}</b></div>
          {r.last != null && <div><span>{r.last_year} result</span><b>{fmtMg(r.last)}</b></div>}</div>
        <div className="x28-tipf">{r.note}</div>
        {!focus && <div className="x28-tipc">Click to open its counties</div>}
      </>
    );
  };
  const countyTip = (f: string, st: string, name: string) => {
    const c = cty(f);
    if (!c) return <div className="x28-tiph"><b>{name}</b><span>{STATE_NAME[st]} · no Senate race in 2028</span></div>;
    return (
      <>
        <div className="x28-tiph"><b>{name}</b><span>{STATE_NAME[st]} Senate</span></div>
        {tipK(c.pres, c.off, c.sen)}
        <div className="x28-tipf">{["AK", "CT", "NH", "VT"].includes(st) ? "Results here come by town or statewide, so the county split ticket is the state's own." : `The county's own split from the seat's ${c.r.last_year} race, ${Math.round((c.r.status * sen.county.k_run + (1 - c.r.status) * sen.county.k_open) * 100)}% of it carried over, on top of the state's.`}</div>
      </>
    );
  };
  const legend = layer === "win" ? <><span>D certain</span><i style={{ background: RAMP }} /><span>R certain</span></>
    : layer === "split" ? <><span>Senate Democrat runs ahead</span><i style={{ background: SHIFT_RAMP }} /><span>Senate Republican runs ahead</span></>
      : <><span>D +40</span><i style={{ background: RAMP }} /><span>R +40</span><b className="sw" style={{ background: NONE }} /><span>No race</span></>;
  const maxH = Math.max(...sim.hist.map((h) => h[1]));
  const lo = sim.hist[0][0], hi = sim.hist[sim.hist.length - 1][0];
  const bt24 = sen.backtest["2024"], bt16 = sen.backtest["2016"];
  const dUp = sen.races.filter((r) => r.party === "D").length;
  return (
    <>
      <header className="sn-hero">
        <div className="sn-eye">2028 Senate forecast · Class 3 · {sen.up} seats</div>
        <h1>Who holds the <em>Senate</em> in 2029</h1>
        <p className="sn-lede">Every Senate race in 2028 is forecast on top of the presidential race in its state. Pick the matchup and the national environment, and each race moves with the top of the ticket, plus the split ticket effect: how far that seat&apos;s Senate vote has run ahead of or behind its presidential vote.</p>
      </header>

      <section className="s28-card sn-ctl" aria-labelledby="sn-c">
        <h2 id="sn-c">Presidential environment</h2>
        <div className="g28-row">
          <label className="g28-f d"><span>Democrat</span><select id="sn-d" value={dn} onChange={(e) => setD(e.target.value)}>{D.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="g28-f r"><span>Republican</span><select id="sn-r" value={rn} onChange={(e) => setR(e.target.value)}>{R.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="g28-f wide"><span>National shift on top of the forecast: {shift === 0 ? "none" : fmtMg(shift)}</span>
            <input id="sn-shift" type="range" min={-10} max={10} step={0.5} value={shift} onChange={(e) => setShift(Number(e.target.value))} aria-label="National shift, Republican minus Democrat" /></label>
          <label className="sn-tog"><input id="sn-split" type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /><span>Split ticket effect</span></label>
        </div>
        <p className="sn-note">{short(pair.d)} against {short(pair.r)}: the presidential model gives the Democrat {fmtPct(pair.pD)}; this run of {N.toLocaleString("en-US")} simulations gives {fmtPct(sim.presD)}. {split ? "" : "With the split ticket effect off, every Senate race votes exactly like the presidential race in its state."}</p>
      </section>

      <section className="sn-kpis" aria-label="Senate control">
        <div className={`sn-kpi ${sim.ctrl >= 0.5 ? "d" : "r"}`}><span>Democratic control</span><b>{fmtPct(sim.ctrl)}</b><em>51 seats, or 50 with a Democratic vice president</em></div>
        <div className="sn-kpi"><span>Democratic seats, median</span><b>{sim.med}</b><em>80% of runs between {sim.p10} and {sim.p90}</em></div>
        <div className="sn-kpi"><span>Not up in 2028</span><b><i className="d">{sen.hold.D}</i> · <i className="r">{sen.hold.R}</i></b><em>Democrats need {51 - sen.hold.D} of the {sen.up} races for 51</em></div>
        <div className="sn-kpi"><span>Seats up, by party now</span><b><i className="d">{dUp}</i> · <i className="r">{sen.up - dUp}</i></b><em>after the Ohio and Florida specials in 2026</em></div>
      </section>

      <section className="card x28-mapcard sn-map" aria-label="Senate map">
        <div className="x28-seg-row">
          <div className="x28-seg" role="group" aria-label="Map units">
            {(["states", "counties"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "states" ? "States" : "Counties"}</button>)}
          </div>
          <div className="x28-seg" role="group" aria-label="Map layer">
            {([["margin", "Senate margin"], ["win", "Win chance"], ["split", "Split ticket"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={layer === k} onClick={() => setLayer(k)}>{l}</button>)}
          </div>
        </div>
        <Map28 view={view} stateFill={stateFill} countyFill={countyFill} stateTip={stateTip} countyTip={countyTip} focus={focus} onFocus={setFocus} legend={legend}
          fkey={`${pair.d}|${pair.r}|${shift}|${split}|${layer}`} label={`The Senate under ${short(pair.d)} against ${short(pair.r)}: hover a state for its race, click to open its counties`} />
      </section>

      <section className="s28-card" aria-labelledby="sn-h">
        <h2 id="sn-h">Democratic seats in the new Senate</h2>
        <div className="sn-hist" role="img" aria-label={`Seat distribution, median ${sim.med} Democratic seats`}>
          {Array.from({ length: hi - lo + 1 }, (_, j) => lo + j).map((k) => {
            const v = sim.hist.find((h) => h[0] === k)?.[1] ?? 0;
            return <div key={k} className={`sn-bar ${k >= 51 ? "d" : k === 50 ? "t" : "r"}`} title={`${k} seats: ${(v / N * 100).toFixed(1)}%`}><i style={{ height: `${(v / maxH) * 100}%` }} /><span>{k % 2 === 0 ? k : ""}</span></div>;
          })}
        </div>
        <p className="sn-note">Blue bars are Democratic majorities, red Republican; at 50 seats the vice president breaks the tie, so control follows the White House.</p>
      </section>

      <section className="s28-card g28-tbl" aria-labelledby="sn-t">
        <h2 id="sn-t">Every race, closest first</h2>
        <div className="g28-scroll">
          <table className="sn-tbl">
            <thead><tr><th>State</th><th>Incumbent</th><th>Status</th><th className="n">President</th><th className="n">Split ticket</th><th className="n">Senate</th><th className="n">Democrat wins</th></tr></thead>
            <tbody>
              {sim.races.map((r) => (
                <tr key={r.st}>
                  <td className="who"><Link href={`/2028/${r.st.toLowerCase()}`}>{STATE_NAME[r.st]}</Link></td>
                  <td><span className={r.party === "D" ? "d" : "r"}>{r.inc}</span> <em className="sn-p">{r.party}</em></td>
                  <td title={r.note}><span className={`sn-st s${r.status >= 1 ? 1 : r.status > 0 ? 5 : 0}`}>{STATUS(r.status)}</span></td>
                  <td className="n mono">{fmtMg(r.pres)}</td>
                  <td className="n mono">{split ? <span className={r.offset < 0 ? "d" : "r"}>{fmtMg(r.offset)}</span> : "Off"}</td>
                  <td className="n mono"><span className="sn-chip" style={{ background: marginColor(r.sen), color: Math.abs(r.sen) < 14 ? "#16092a" : "#ffffff" }}>{fmtMg(r.sen)}</span></td>
                  <td className="n mono">{fmtPct(r.pD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sn-note">President is the matchup&apos;s average margin in the state across the runs. Split ticket is the Senate race&apos;s expected run ahead of the presidential vote: D +3 means the Democratic Senate candidate runs 3 points better than the Democratic nominee for president. Hover a status for the source.</p>
      </section>

      <section className="s28-card sn-method" aria-labelledby="sn-m">
        <h2 id="sn-m">How the split ticket effect is built</h2>
        <div className="sn-cols">
          <div>
            <h3>The rule</h3>
            <p>A Senate race starts at the presidential margin in its state. On top of that goes an offset fit on the {sen.n_fit} Senate races of the last two presidential years, 2016 and 2024. Each race&apos;s offset is how far its Senate vote ran from the presidential vote; the model reads that from the same seat&apos;s previous race, a midterm, set against the presidential vote of its era and net of that year&apos;s national swing.</p>
            <ul>
              <li>When the same senator runs again, {Math.round(sen.coef.own_running * 100)}% of their last split carries over.</li>
              <li>An incumbent is worth {sen.coef.incumbency.toFixed(1)} points to their party on top of that. An open seat gets neither.</li>
              <li>Across both years Democratic Senate candidates ran {Math.abs(sen.offset_mean).toFixed(1)} points ahead of their nominee for president before incumbency.</li>
              <li>A senator who has not decided, or who is weighing a presidential run, counts as half running.</li>
            </ul>
          </div>
          <div>
            <h3>The backtest</h3>
            <p>Each race below is predicted from a fit on every other race, with the real presidential result in the state.</p>
            <table className="sn-bt">
              <thead><tr><th>Year</th><th className="n">Races</th><th className="n">Average miss</th><th className="n">Same as president</th><th className="n">Winners</th></tr></thead>
              <tbody>
                {[["2024", bt24], ["2016", bt16]].map(([y, b]) => { const x = b as typeof bt24; return (
                  <tr key={y as string}><td>{y as string}</td><td className="n">{x.n}</td><td className="n">{x.mae.toFixed(1)}</td><td className="n">{x.mae_pres.toFixed(1)}</td><td className="n">{x.win} of {x.n}</td></tr>); })}
              </tbody>
            </table>
            <p>Same as president is the plain rule that a Senate race votes like the presidential race plus that year&apos;s average gap. The race level error, {sen.sd_race.toFixed(1)} points, comes from these misses; a further {sen.sd_senate_nat.toFixed(1)} point shock moves every Senate race together, on top of the presidential model&apos;s own state and national error. The 2026 Senate model missed by 4.0 on average, inside that range.</p>
          </div>
        </div>
        <p className="sn-note">Seats not up: the 33 class 1 seats from 2024, independents counted with Democrats, and the 33 class 2 seats from 2026. Candidates are not named yet, so the forecast reads the seat and the incumbent, not the challenger. Statuses as of November 24, 2026, from public reporting on each senator&apos;s plans. See the <Link href="/2028/general">general election</Link> for the presidential map.</p>
      </section>
    </>
  );
}
