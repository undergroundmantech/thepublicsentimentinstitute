"use client";
// The 2028 home, On Point's own layout: a scoreboard across the top with the two nominees and a ribbon of every
// electoral vote by rating, the map beside the path to 270 (every state lined up from the bluest to the reddest), and
// a dock of matchups along the bottom. Every state, band and ladder row has a hover card. The map reads three ways:
// the rating, the win chance, or the change from 2024.
import { useMemo, useState, type MouseEvent } from "react";
import Link from "@/app/components/Link";
import Toon from "@/app/majority-tracker/Toon";
import { X, STATE_NAME, fmtMg, fmtPct, last, probColor, shiftColor, type StatesGeo } from "./lib";
import { useJSON } from "./useX";
import { RATE, RATES, rateOf, type Rate } from "./rate28";
import { PrimTip, RateTip, StateTip, Tip, type At } from "./Tips28";
import type { Pair } from "./data28";

type Nom = Record<"D" | "R", { name: string; p: number; color: string }[]>;
type PrimSt = Record<"D" | "R", Record<string, { lead: string; color: string; share: number; win: number; top: [string, number, string][] }>>;
type Tab = "pres" | "D" | "R";
type Mode = "rate" | "prob" | "shift";
type Hover = { at: At; kind: "st"; st: string } | { at: At; kind: "band"; k: Rate } | null;
const SMALL = ["DE", "RI", "CT", "NJ", "MD", "MA", "VT", "NH", "DC", "HI"];
const slug = (st: string) => `/2028/${st.toLowerCase().split("-")[0]}`;
const nameOf = (k: string) => STATE_NAME[k] ?? (k === "NE-1" ? "Nebraska 1st District" : k === "NE-3" ? "Nebraska 3rd District" : k === "ME-2" ? "Maine 2nd District" : k);
const ink = (hex: string) => { const c = hex.replace(/^rgb\(|\)$/g, ""); const v = hex.startsWith("#") ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : c.split(",").map(Number); return v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11 > 150 ? "#1b1328" : "#fff"; };

export default function Home28({ pairs, nom, prim, ev, days, a24 }: { pairs: Pair[]; nom: Nom; prim: PrimSt; ev: Record<string, number>; days: number; a24: Record<string, number | null> }) {
  const geo = useJSON<StatesGeo>(`${X}/states.json`);
  const [sel, setSel] = useState(pairs[0].id);
  const [tab, setTab] = useState<Tab>("pres");
  const [mode, setMode] = useState<Mode>("rate");
  const [hov, setHov] = useState<Hover>(null);
  const [lit, setLit] = useState<string | null>(null);
  const p = pairs.find((x) => x.id === sel) ?? pairs[0];
  const evR = 538 - p.evMap, dLead = p.evMap >= 270;

  // every electoral unit, lined up from the bluest to the reddest, with the running Democratic total
  const ladder = useMemo(() => {
    const units = Object.entries(p.st).map(([k, v]) => ({ k, m: v[0], pD: v[1], ev: ev[k] ?? 0 })).filter((u) => u.ev > 0);
    // Nebraska's 1st and 3rd districts are not modeled apart from the state, and vote with it
    if (p.st.NE) for (const k of ["NE-1", "NE-3"]) units.push({ k, m: p.st.NE[0], pD: p.st.NE[1], ev: 1 });
    units.sort((a, b) => a.m - b.m);
    let run = 0; const rows = units.map((u) => { run += u.ev; return { ...u, run }; });
    const cross = rows.find((r) => r.run >= 270)?.k ?? null;
    const band: Record<string, { ev: number; states: [string, number, number][] }> = {};
    for (const r of rows) { const k = rateOf(r.m); (band[k] ??= { ev: 0, states: [] }).ev += r.ev; band[k].states.push([r.k, r.ev, r.m]); }
    return { rows, cross, band };
  }, [p, ev]);
  const ci = ladder.rows.findIndex((r) => r.k === ladder.cross);
  const win = ladder.rows.slice(Math.max(0, ci - 8), ci + 9);
  const above = ladder.rows.slice(0, Math.max(0, ci - 8)), below = ladder.rows.slice(ci + 9);
  const sum = (rs: typeof ladder.rows) => rs.reduce((a, r) => a + r.ev, 0);
  const flips = Object.entries(p.st).filter(([k, v]) => !k.includes("-") && a24[k] != null && Math.sign(a24[k]!) !== Math.sign(v[0])).length;
  const closest = [...ladder.rows].filter((r) => !r.k.startsWith("NE-1") && !r.k.startsWith("NE-3")).sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, 5);

  const fill = (st: string) => {
    if (tab !== "pres") { const s = prim[tab][st]; return s ? s.color : "#2a2438"; }
    const v = p.st[st]; if (!v) return "#2a2438";
    if (mode === "prob") return probColor(v[1]);
    if (mode === "shift") return a24[st] != null ? shiftColor(v[0] - a24[st]!, 16) : "#2a2438";
    return RATE[rateOf(v[0])].color;
  };
  const point = (e: MouseEvent, st: string) => setHov({ at: { x: e.clientX, y: e.clientY }, kind: "st", st });
  const stTip = (st: string) => {
    if (tab !== "pres") { const s = prim[tab][st]; return s ? <PrimTip name={nameOf(st)} party={tab} top={s.top} lead={s.lead} win={s.win} /> : null; }
    const v = p.st[st] ?? (st.startsWith("NE-") ? p.st.NE : undefined); if (!v) return null;
    return <StateTip name={nameOf(st)} ev={ev[st] ?? (st.startsWith("NE-") ? 1 : 0)} m={v[0]} pD={v[1]} d={p.d} r={p.r} m24={a24[st] ?? null} note={st === p.tip ? "The tipping point in the simulations" : st.length === 2 ? "Click for its counties" : undefined} />;
  };

  return (
    <div className="h28">
      {/* the scoreboard */}
      <header className="h28-board">
        <div className="h28-board-top">
          <p className="h28-count"><i />{days} days to Election Day · November 7, 2028</p>
          <div className="h28-race" role="tablist" aria-label="Race">
            {([["pres", "President"], ["D", "Democratic primary"], ["R", "Republican primary"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        </div>
        {tab === "pres" ? (
          <div className="h28-face-off">
            <div className={`h28-side d${dLead ? " lead" : ""}`}>
              <Toon name={p.d} side="D" size={112} className="h28-big-face" uid="b" />
              <div><span className="h28-party">Democrat</span><b className="h28-nm">{p.d}</b><span className="h28-ev"><b>{p.evMap}</b> electoral votes</span><span className="h28-sub">{fmtPct(p.pD)} to win · {Math.round(p.evD)} in the average simulation</span></div>
            </div>
            <div className="h28-mid">
              <h1 className="h28-h1">The <em>2028</em> forecast</h1>
              <div className="h28-kpis">
                <span><em>Popular vote</em><b className={p.nat < 0 ? "d" : "r"}>{fmtMg(p.nat)}</b></span>
                <span><em>Tipping point</em><b><Link href={slug(p.tip)}>{STATE_NAME[p.tip] ?? p.tip}</Link></b></span>
                <span><em>Flips from 2024</em><b>{flips} states</b></span>
              </div>
            </div>
            <div className={`h28-side r${!dLead ? " lead" : ""}`}>
              <div><span className="h28-party">Republican</span><b className="h28-nm">{p.r}</b><span className="h28-ev"><b>{evR}</b> electoral votes</span><span className="h28-sub">{fmtPct(1 - p.pD)} to win · {538 - Math.round(p.evD)} in the average simulation</span></div>
              <Toon name={p.r} side="R" size={112} className="h28-big-face" uid="b" />
            </div>
          </div>
        ) : (
          <div className="h28-face-off prim">
            <div className="h28-mid wide">
              <h1 className="h28-h1">The <em>2028</em> {tab === "D" ? "Democratic" : "Republican"} primary</h1>
              <p>Chance of the nomination, with the whole field on every state&apos;s ballot and every county forecast</p>
            </div>
            <div className="h28-leaders">
              {nom[tab].slice(0, 4).map((x, i) => (
                <div key={x.name} className={i === 0 ? "first" : undefined}>
                  <Toon name={x.name} side={tab} size={i === 0 ? 92 : 64} uid="l" />
                  <b>{x.name}</b><span style={{ color: x.color }}>{fmtPct(x.p)}</span>
                  <i className="bar"><i style={{ width: `${x.p * 100}%`, background: x.color }} /></i>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "pres" ? (
          <div className="h28-ribbon" aria-label="Electoral votes by rating">
            <div className="bar" onMouseLeave={() => setHov(null)}>
              {RATES.map((r) => { const n = ladder.band[r.k]?.ev ?? 0; return n ? <i key={r.k} style={{ flexGrow: n, background: r.color, color: r.ink }} className={hov?.kind === "band" && hov.k === r.k ? "on" : undefined} onMouseMove={(e) => setHov({ at: { x: e.clientX, y: e.clientY }, kind: "band", k: r.k })}>{n >= 20 ? n : ""}</i> : null; })}
              <em style={{ left: `${(270 / 538) * 100}%` }}><span>270</span></em>
            </div>
            <div className="keys">{RATES.map((r) => <span key={r.k}><i style={{ background: r.color }} />{r.label} <b>{ladder.band[r.k]?.ev ?? 0}</b></span>)}</div>
          </div>
        ) : null}
      </header>

      <div className="h28-body">
        {/* the map */}
        <section className="h28-map" aria-label="2028 forecast map">
          {tab === "pres" ? (
            <div className="h28-modes" role="radiogroup" aria-label="Color the map by">
              {([["rate", "Rating"], ["prob", "Win chance"], ["shift", "Change from 2024"]] as [Mode, string][]).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
              <span className="h28-closest">Closest: {closest.map((r, i) => <span key={r.k} onMouseEnter={() => setLit(r.k)} onMouseLeave={() => setLit(null)}><Link href={slug(r.k)}>{r.k} {fmtMg(r.m)}</Link>{i < closest.length - 1 ? "," : ""}</span>)}</span>
            </div>
          ) : null}
          <div className="h28-stage" onMouseLeave={() => setHov(null)}>
            {!geo ? <div className="h28-load">Loading the map</div> : (
              <svg viewBox="-20 -10 1015 630" role="img" aria-label="United States map of the 2028 forecast">
                <g className="h28-states">
                  {Object.entries(geo.states).map(([st, d]) => (
                    <a key={st} href={slug(st)} aria-label={`${STATE_NAME[st] ?? st} 2028 forecast`}>
                      <path d={d} fill={fill(st)} className={(hov?.kind === "st" && hov.st === st) || lit === st ? "hov" : lit || (hov?.kind === "band" && rateOf(p.st[st]?.[0] ?? 0) !== hov.k) ? "fade" : undefined} onMouseMove={(e) => point(e, st)} />
                    </a>
                  ))}
                </g>
                <g className="h28-labels" aria-hidden="true">
                  {Object.entries(geo.labels).map(([st, [x, y]]) => !SMALL.includes(st) ? <text key={st} x={x} y={y} fill={ink(fill(st))}>{st}</text> : null)}
                </g>
              </svg>
            )}
          </div>
          <div className="h28-under">
            {tab === "pres" ? <>
              {Object.keys(p.st).filter((k) => k.includes("-") || k === "DC").map((k) => { const v = p.st[k]; const r = RATE[rateOf(v[0])]; return <span key={k} onMouseMove={(e) => point(e, k)} onMouseLeave={() => setHov(null)}><Link href={slug(k)} className="h28-chip" style={{ background: r.color, color: r.ink }}>{k === "DC" ? "D.C." : k}</Link></span>; })}
              {mode === "rate" ? <span className="mute">Ratings by the forecast margin: Tilt under 2 points, Lean 2 to 6, Likely 6 to 12, Safe 12 and up.</span>
                : mode === "prob" ? <span className="h28-scale"><em>{last(p.d)} certain</em><i className="pr" /><em>{last(p.r)} certain</em></span>
                : <span className="h28-scale"><em>Bluer than 2024</em><i className="sh" /><em>Redder than 2024</em></span>}
            </> : nom[tab].slice(0, 6).map((x) => <span key={x.name} className="h28-pk"><i style={{ background: x.color }} />{x.name}</span>)}
          </div>
        </section>

        {/* the path to 270 */}
        <aside className="h28-ladder" aria-labelledby="h28-lad">
          {tab === "pres" ? <>
            <div className="h28-lad-h"><h2 id="h28-lad">The path to 270</h2><span>Every state from the bluest to the reddest</span></div>
            {above.length ? <div className="h28-lad-fold d">{above.length} safer {last(p.d)} states · <b>{sum(above)}</b> votes</div> : null}
            <ol onMouseLeave={() => { setHov(null); setLit(null); }}>
              {win.map((r) => {
                const rt = RATE[rateOf(r.m)], isX = r.k === ladder.cross, isTp = r.k === p.tip;
                return (
                  <li key={r.k} className={isX ? "tip" : undefined} onMouseEnter={() => setLit(r.k.split("-")[0])} onMouseMove={(e) => point(e, r.k)}>
                    <Link href={slug(r.k)}>
                      <span className="ab">{r.k}{isTp ? <i className="tp">TP</i> : null}</span>
                      <span className="mg"><i style={{ width: `${Math.min(100, (Math.abs(r.m) / 20) * 100)}%`, background: rt.color, marginLeft: r.m <= 0 ? "auto" : undefined }} /></span>
                      <span className="mv" style={{ color: rt.text ?? rt.color }}>{fmtMg(r.m)}</span>
                      <span className="ev">{r.ev}</span>
                      <span className="run">{r.run}</span>
                    </Link>
                    {isX ? <em>{last(p.d)} passes 270 here</em> : null}
                  </li>
                );
              })}
            </ol>
            {below.length ? <div className="h28-lad-fold r">{below.length} safer {last(p.r)} states · <b>{sum(below)}</b> votes</div> : null}
            <p className="h28-lad-n">The last column adds up {last(p.d)}&apos;s electoral votes from the top. TP marks the tipping point across all 20,000 simulations.</p>
          </> : <>
            <div className="h28-lad-h"><h2 id="h28-lad">Who wins each state</h2><span>The primary leader in the most states</span></div>
            <ol className="h28-prim-l">
              {Object.entries(Object.values(prim[tab]).reduce<Record<string, number>>((a, s) => { a[s.lead] = (a[s.lead] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => (
                <li key={n}><Toon name={n} side={tab} size={34} uid="w" /><b>{n}</b><span>{c} states</span></li>
              ))}
            </ol>
            <Link href="/2028/primaries" className="h28-lad-more">Every state&apos;s primary</Link>
          </>}
        </aside>
      </div>

      {/* the matchup dock */}
      <section className="h28-dock" aria-labelledby="h28-mu">
        <div className="h28-dock-h"><h2 id="h28-mu">Pick the matchup</h2><span>The likeliest pairings by both parties&apos; nomination odds</span><Link href="/2028/general">Every matchup</Link></div>
        <ul>
          {pairs.map((x) => {
            const on = x.id === sel, w = x.pD >= 0.5;
            return (
              <li key={x.id}>
                <button type="button" className={`h28-mt${on ? " on" : ""}`} aria-pressed={on} onClick={() => { setSel(x.id); setTab("pres"); }}>
                  <span className="pair"><Toon name={x.d} side="D" size={46} uid="k" /><Toon name={x.r} side="R" size={46} uid="k" /></span>
                  <span className="t"><b>{last(x.d)} <i>v</i> {last(x.r)}</b><span>{x.odds != null ? `${fmtPct(x.odds)} likely` : "Generic headline"}</span></span>
                  <span className="sc"><b className="d">{x.evMap}</b><b className="r">{538 - x.evMap}</b></span>
                  <span className="mini"><i style={{ width: `${(x.evMap / 538) * 100}%` }} /></span>
                  <span className={`w ${w ? "d" : "r"}`}>{w ? last(x.d) : last(x.r)} {fmtPct(Math.max(x.pD, 1 - x.pD))} · {fmtMg(x.nat)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <nav className="h28-go" aria-label="More of the 2028 forecast">
        <Link href={slug(p.tip)}><b>{STATE_NAME[p.tip]}</b><span>The tipping point, county by county</span></Link>
        <Link href="/2028/primaries"><b>Play the primaries</b><span>Every state, every candidate</span></Link>
        <Link href="/2028/ticket"><b>Build a ticket</b><span>Running mates and third parties</span></Link>
        <Link href="/2028-presidential-candidates" className="hot"><b>Who is running in 2028</b><span>Every name, by party</span></Link>
      </nav>

      <Tip at={hov?.at ?? null}>
        {hov?.kind === "st" ? stTip(hov.st) : hov?.kind === "band" ? (() => { const r = RATE[hov.k]; const b = ladder.band[hov.k]; return <RateTip label={r.label} color={r.color} ink={r.ink} states={b?.states ?? []} ev={b?.ev ?? 0} />; })() : null}
      </Tip>
    </div>
  );
}
