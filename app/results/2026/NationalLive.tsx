"use client";
// The live forecast pieces of the national dashboard, all from the shared engine state (engineClient.ts):
//   ChamberLine      under a chamber card's called seats: projected final seats and the control probability
//   HouseVotePanel   the national House popular vote: counted, projected, outstanding, range
//   NightCharts      the night so far (control, seats, popular vote), synchronized with the replay clock
// When the engine is off, the dashboard keeps its own reads and these say so instead of showing old numbers as live.
import React from "react";
import type { ChamberForecast, NationalForecast } from "@/app/lib/engine/types";
import { CHART_CSS, NationalCharts, marginText, probText } from "./EngineCharts";
import { useEngine } from "./engineClient";

const ET = "America/New_York";
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET }) + " ET";
const fmtV = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}K` : Math.round(v).toLocaleString("en-US"));
const kOf = { sen: "senate", house: "house", gov: "governors" } as const;

/** The control line for a chamber card. `fallback` is the frozen pre-election forecast, used only when the engine is off. */
export function ChamberLine({ k, fallback }: { k: "sen" | "house" | "gov"; fallback: { pD: number; dS: number } }) {
  const e = useEngine(); const n = e.view?.national;
  if (!n) return <span className="sb">Pre-election forecast <b className="d">D {Math.round(100 * fallback.pD)}%</b> · {fallback.dS.toFixed(1)} D {k === "gov" ? "governors" : "seats"} on average</span>;
  const c: ChamberForecast = n[kOf[k]]; const d = c.display;
  const what = k === "gov" ? "a majority of governorships" : "control";
  // the House card leads with the national House vote: the projected final margin, large, and the counted margin beside it
  const hv = k === "house" ? n.houseVote : null, pm = hv?.projected.marginPp;
  return (
    <span className="sb nl-line">
      {hv && pm ? (
        <span className="nl-pv" title="Votes for House candidates in all 435 districts. A model projection, not a result, and not a generic-ballot poll.">
          <b className={pm.mean <= 0 ? "d" : "r"}>{marginText(pm.mean)}</b>
          <span><em>House popular vote, projected</em><small>range {marginText(pm.mean <= 0 ? pm.i80.hi : pm.i80.lo)} to {marginText(pm.mean <= 0 ? pm.i80.lo : pm.i80.hi)} · {hv.observed.total ? <>counted so far {marginText(hv.observed.marginPp)}</> : "no votes counted yet"}</small></span>
        </span>
      ) : null}
      <span className="nl-proj">Projected <b className="d">D {Math.round(c.seats.D.mean)}</b><small> ({c.seats.D.i80.lo}–{c.seats.D.i80.hi})</small> · <b className="r">R {Math.round(c.seats.R.mean)}</b><small> ({c.seats.R.i80.lo}–{c.seats.R.i80.hi})</small>{c.seats.other.mean >= 0.5 ? <> · {Math.round(c.seats.other.mean)} other</> : null}</span>
      <span className="nl-ctl">{d.basis.startsWith("Decided") ? <b className={d.leader === "D" ? "d" : "r"}>{d.leader === "D" ? "Democrats" : "Republicans"} have won {what}</b> : <>Chance of {what}: <b className="d">D {probText(c.pD)}</b> · <b className="r">R {probText(c.pR)}</b>{c.pUnresolved >= 0.005 ? <> · unresolved {probText(c.pUnresolved)}</> : null}</>}</span>
    </span>
  );
}

/** One line for the verdict: the live control picture in words. */
export function controlSentence(n: NationalForecast | undefined, k: "sen" | "house" | "gov") {
  if (!n) return null; const c = n[kOf[k]]; const d = c.display;
  const who = d.leader === "D" ? "Democrats" : "Republicans";
  if (d.basis.startsWith("Decided")) return <> <b className={d.leader === "D" ? "d" : "r"}>{who} have won {k === "gov" ? "a majority of governorships" : "control"}</b>.</>;
  return <> The model gives <b className={d.leader === "D" ? "d" : "r"}>{who} {probText(d.leader === "D" ? c.pD : c.pR)}</b> to {k === "gov" ? "hold a majority of governorships" : "win control"}, about {Math.round(c.seats[d.leader].mean)} {k === "gov" ? "governorships" : "seats"}.</>;
}

export function HouseVotePanel() {
  const e = useEngine(); const n = e.view?.national;
  if (!n) return null;
  const h = n.houseVote, o = h.observed, p = h.projected;
  const sim = e.view?.mode === "SIMULATED";
  const pctOf = (v: number, t: number) => (t > 0 ? `${((100 * v) / t).toFixed(1)}%` : "—");
  return (
    <section className="card nl-hpv" aria-labelledby="nl-hpv-h">
      <header className="nl-hpv-head">
        <div><span className="eye">{e.mode === "REPLAY" ? (sim ? "Simulated replay · not actual results" : "Replay · as of this moment") : "Live forecast"}</span><h2 id="nl-hpv-h">National House popular vote</h2></div>
        <span className="nl-upd">Updated {clock(e.view!.t)}</span>
      </header>
      <div className="nl-hpv-grid">
        <div className="nl-col">
          <span className="nl-k">Counted so far</span>
          <div className="nl-big">{o.total ? marginText(o.marginPp) : "No votes yet"}</div>
          <dl className="nl-dl">
            <div><dt className="d">Democrats</dt><dd>{fmtV(o.D)}<small>{pctOf(o.D, o.total)}</small></dd></div>
            <div><dt className="r">Republicans</dt><dd>{fmtV(o.R)}<small>{pctOf(o.R, o.total)}</small></dd></div>
            <div><dt>Others</dt><dd>{fmtV(o.other)}<small>{pctOf(o.other, o.total)}</small></dd></div>
          </dl>
          <p className="nl-note">{o.racesWithVotes} of {o.racesIncluded} House races reporting. Two-party margin {marginText(o.twoPartyMarginPp)}.</p>
        </div>
        <div className="nl-col proj">
          <span className="nl-k">Projected final</span>
          <div className="nl-big">{marginText(p.marginPp.mean)}<small> range {marginText(p.marginPp.i80.lo)} to {marginText(p.marginPp.i80.hi)}</small></div>
          <dl className="nl-dl">
            <div><dt className="d">Democrats</dt><dd>{fmtV(p.D.mean)}<small>{p.shareD.mean.toFixed(1)}%</small></dd></div>
            <div><dt className="r">Republicans</dt><dd>{fmtV(p.R.mean)}<small>{p.shareR.mean.toFixed(1)}%</small></dd></div>
            <div><dt>Still to count</dt><dd>{fmtV(p.outstanding.mean)}<small>est. (80%: {fmtV(p.outstanding.i80.lo)}–{fmtV(p.outstanding.i80.hi)})</small></dd></div>
          </dl>
          <p className="nl-note">The projection adds each race&apos;s modeled outstanding vote to what is counted. The method of outstanding ballots (mail, early, Election Day) is not published by civicAPI, so it is treated as unknown and the range is wider for it.</p>
        </div>
        <div className="nl-col bench">
          <span className="nl-k">Before the election</span>
          <div className="nl-big muted">{marginText(h.benchmark.marginPp)}</div>
          <p className="nl-note">{h.benchmark.label}. Shown for comparison only.</p>
        </div>
      </div>
      <details className="nl-how"><summary>What is counted</summary><p>{h.inclusion}</p></details>
    </section>
  );
}

export function NightCharts() {
  const e = useEngine();
  if (!e.available || !e.view) return null;
  const now = e.mode === "REPLAY" && e.clock ? e.clock.tMs : null;
  return (
    <section className="card nl-charts" aria-labelledby="nl-ch-h">
      <style>{CHART_CSS}</style>
      <header className="nl-hpv-head"><div><span className="eye">{e.mode === "REPLAY" ? (e.view.mode === "SIMULATED" ? "Simulated replay" : "Replay") : "Live"} · the night so far</span><h2 id="nl-ch-h">How the forecast moved</h2></div><span className="nl-upd">{e.national.length} observations</span></header>
      {e.national.length ? <NationalCharts pts={e.national} now={now} mode={e.view.mode} /> : <p className="nl-note">The history fills in as the recorder stores each update. Without the recorder switched on, only the current moment is known.</p>}
    </section>
  );
}

export const NATIONAL_LIVE_CSS = `
.nl-line{display:flex;flex-direction:column;gap:2px}
.nl-line small{color:var(--mute);font-weight:500}
.nl-pv{display:flex;align-items:center;gap:10px;margin:2px 0 6px;padding:8px 10px;border-radius:10px;background:rgba(var(--line-rgb),.07);border:1px solid var(--line2)}
.nl-pv>b{font:800 26px/1 var(--font-d);letter-spacing:-.02em;white-space:nowrap}.nl-pv>b.d{color:var(--dem)}.nl-pv>b.r{color:var(--gop)}
.nl-pv>span{display:flex;flex-direction:column;gap:1px;min-width:0}.nl-pv em{font:700 10.5px var(--font-m);font-style:normal;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)}.nl-pv small{font-size:11.5px}
.nl-ctl{font-size:12px}
.nl-hpv,.nl-charts{margin-top:18px;padding:20px 22px}
.nl-hpv-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:12px}
.nl-hpv-head h2{margin:2px 0 0;font:700 22px/1.15 var(--font-d);letter-spacing:-.02em;color:var(--hi)}
.nl-upd{font:600 11px var(--font-m);color:var(--mute);letter-spacing:.04em}
.nl-hpv-grid{display:grid;grid-template-columns:1.1fr 1.3fr .8fr;gap:22px}
.nl-col{min-width:0;border-top:2px solid rgba(var(--line-rgb),.18);padding-top:10px}
.nl-col.proj{border-top-color:var(--accent,#7a5cff)}
.nl-k{font:700 10.5px var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.nl-big{font:800 34px/1.05 var(--font-d);letter-spacing:-.02em;color:var(--hi);margin:6px 0 8px;font-variant-numeric:tabular-nums}
.nl-big small{display:block;font:600 12px var(--font-b);letter-spacing:0;color:var(--mute);margin-top:4px}
.nl-big.muted{color:var(--ink2);font-size:26px}
.nl-dl{display:grid;gap:4px;margin:0}
.nl-dl>div{display:flex;justify-content:space-between;gap:8px;font-size:13px;border-bottom:1px solid rgba(var(--line-rgb),.08);padding:3px 0}
.nl-dl dt{font-weight:700;color:var(--ink2)}.nl-dl dt.d{color:var(--dem)}.nl-dl dt.r{color:var(--gop)}
.nl-dl dd{margin:0;font-weight:700;color:var(--hi);font-variant-numeric:tabular-nums;text-align:right}
.nl-dl dd small{margin-left:8px;color:var(--mute);font-weight:600}
.nl-note{font-size:12px;line-height:1.45;color:var(--mute);margin:8px 0 0}
.nl-how{margin-top:12px;font-size:12px;color:var(--mute)}.nl-how summary{cursor:pointer;font-weight:700;color:var(--ink2)}
@media (max-width:900px){.nl-hpv-grid{grid-template-columns:1fr}.nl-big{font-size:28px}}
`;
