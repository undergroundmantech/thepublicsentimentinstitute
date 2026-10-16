"use client";

import React, { useEffect, useMemo, useState } from "react";
import { STATE_NAME, fmtMargin, type Geo, type StateGeo } from "./lib";
import { leadFill, centroidOf } from "./Dashboard";
import type { ElectCalc, StateSignal } from "./Electorate";

// ─────────────────────────────────────────────────────────────────────────────
// The forecast with the early vote applied. The forecast check reads how far the
// electorate the early vote points to sits from the forecast's electorate, in
// margin points. Here that number is applied to every Senate and governor race:
// the state margin moves by the state's shift, the win odds move along the
// model's own simulated distribution, and inside a state each county moves with
// the state, plus or minus how far its own early ballots run ahead of or behind
// the state's, shrunk toward the state where few ballots are in.
// Positive margins and shifts are Republican, negative Democratic.
// ─────────────────────────────────────────────────────────────────────────────

const MONO = "var(--font-m)";
const KAPPA = 0.5;      // share of today's gap carried into the ballots still to come, as in the electorate model
const SHRINK = 1500;    // ballots: a county with this many ballots in counts half its own, half the state's

type Dist = { lo: number; w: number; c: number[] };
type Race = {
  id: string; office: "senate" | "governor" | "house"; st: string; name: string; dem: string; gop: string;
  est: { margin: number; prob: number; p10: number; p90: number; dist?: Dist };
};
type Chamber = { demSeats: number; gopSeats: number; seatsTotal: number };
type ModelFile = { meta: { updated: string }; chambers: Record<string, Chamber>; races: Race[] };
type CountyFile = Record<string, Record<string, [number, number, number, number, number[]]>> & { _n?: Record<string, string> };

let _m: Promise<ModelFile | null> | null = null;
const getModel = () => (_m ??= fetch("/forecast/model.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));
let _c: Promise<CountyFile | null> | null = null;
const getCounties = () => (_c ??= fetch("/forecast/counties.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));

const pctS = (x: number, dp = 0) => `${(x * 100).toFixed(dp)}%`;
const fmtShift = (s: number) => (Math.abs(s) < 0.05 ? "No change" : `${s > 0 ? "R" : "D"} +${Math.abs(s).toFixed(1)}`);
const tone = (m: number) => (m >= 0.05 ? "var(--gop)" : m <= -0.05 ? "var(--dem)" : "var(--muted2)");
const strengthOf = (pace: number) => (pace < 0.15 ? "Early signal" : pace < 0.4 ? "Building signal" : "Strong signal");

/** Republican win probability once the race's simulated margins all move by `shift` points. */
function probR(est: Race["est"], shift: number): number {
  const d = est.dist;
  if (d && d.c?.length) {
    let tot = 0, win = 0;
    d.c.forEach((n, i) => {
      tot += n; const a = d.lo + i * d.w + shift, b = a + d.w;
      win += a >= 0 ? n : b <= 0 ? 0 : (n * b) / d.w;
    });
    if (tot > 0) return win / tot;
  }
  const sd = Math.max(1, (est.p90 - est.p10) / 2.563);
  const z = (est.margin + shift) / sd;
  return 0.5 * (1 + erf(z / Math.SQRT2));
}
function erf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
/** the model's own odds, moved by the change the shift makes along its distribution */
const adjProb = (r: Race, s: number) => Math.min(0.9995, Math.max(0.0005, r.est.prob + probR(r.est, s) - probR(r.est, 0)));

/** a shift on its own diverging ramp, deep at `dom` points, so the change map always spreads across the shades */
const niceDom = (vals: number[]) => { const m = Math.max(0, ...vals.map(Math.abs)); return m <= 4 ? 4 : m <= 8 ? 8 : m <= 12 ? 12 : m <= 16 ? 16 : Math.ceil(m / 8) * 8; };
function shiftFill(s: number | null, dom = 8): string {
  if (s === null || !isFinite(s)) return "var(--ev-idle)";
  const pct = Math.round(8 + 92 * Math.pow(Math.min(1, Math.abs(s) / dom), 0.8));
  return `color-mix(in srgb, ${s > 0 ? "var(--lead-r)" : "var(--lead-d)"} ${pct}%, var(--lead-even))`;
}

type Shade = "forecast" | "adjusted" | "change";
const SHADES: { k: Shade; label: string }[] = [{ k: "forecast", label: "Forecast" }, { k: "adjusted", label: "With early vote" }, { k: "change", label: "Change" }];

function Seg<T extends string>({ value, set, opts, label }: { value: T; set: (v: T) => void; opts: { k: T; label: string }[]; label: string }) {
  return (
    <div className="adj-seg" role="tablist" aria-label={label}>
      {opts.map((o) => (
        <button key={o.k} role="tab" aria-selected={value === o.k} className={value === o.k ? "on" : ""} onClick={() => set(o.k)}>{o.label}</button>
      ))}
    </div>
  );
}

function Legend({ shade, national, dom = 8 }: { shade: Shade; national?: boolean; dom?: number }) {
  return (
    <div className="adj-leg" aria-hidden>
      <span>{shade === "change" ? "Toward R" : "R lead"}</span>
      <i className="ramp" />
      <span>{shade === "change" ? "Toward D" : "D lead"}</span>
      <em>{shade === "change" ? `R+${dom} to D+${dom}` : "R+40 to D+40"}</em>
      <span className="idle"><i />{national ? "No race this year" : "No forecast"}</span>
    </div>
  );
}

export default function AdjustedForecast({ scope, signals, calc, geo, stateGeo, onOpen }: {
  scope: string; signals: Record<string, StateSignal>; calc: ElectCalc; geo: Geo | null; stateGeo: StateGeo | null; onOpen: (st: string) => void;
}) {
  const [model, setModel] = useState<ModelFile | null>(null);
  const [counties, setCounties] = useState<CountyFile | null>(null);
  const [office, setOffice] = useState<"senate" | "governor">("senate");
  const [shade, setShade] = useState<Shade>("adjusted");
  const national = scope === "US";
  useEffect(() => { getModel().then(setModel); }, []);
  useEffect(() => { if (!national && !counties) getCounties().then(setCounties); }, [national, counties]);

  const races = useMemo(() => (model?.races ?? []).filter((r) => r.office === "senate" || r.office === "governor"), [model]);
  const stateRaces = useMemo(() => races.filter((r) => r.st === scope), [races, scope]);
  // inside a state, open on whichever race it has
  const off = national ? office : stateRaces.some((r) => r.office === office) ? office : (stateRaces[0]?.office as "senate" | "governor") ?? office;
  const offices = national ? (["senate", "governor"] as const) : stateRaces.map((r) => r.office as "senate" | "governor");

  if (!model) return null;
  return (
    <section className="adj" id="ev-adj" aria-label="Forecast with the early vote">
      <div className="adj-head">
        <div>
          <span className="adj-eye">Forecast with the early vote</span>
          <h2>{national ? "Every race, with the turnout so far applied" : `${STATE_NAME[scope] ?? scope}, county by county, with the turnout so far`}</h2>
          <p className="db-note">
            The forecast check&apos;s too Republican or too Democratic number, applied. Each state&apos;s margin moves by the shift its early vote
            points to, and the win odds move along the model&apos;s own simulations. It reads the turnout mix only, not how undecided voters break.
          </p>
        </div>
        <div className="adj-ctl">
          {offices.length > 1 ? (
            <Seg value={off} set={setOffice} label="Office" opts={offices.map((o) => ({ k: o, label: o === "senate" ? "Senate" : "Governor" }))} />
          ) : null}
          <Seg value={shade} set={setShade} label="Map shading" opts={SHADES} />
        </div>
      </div>
      {national
        ? <National model={model} races={races.filter((r) => r.office === off)} office={off} signals={signals} geo={geo} shade={shade} onOpen={onOpen} />
        : <StateView race={stateRaces.find((r) => r.office === off) ?? null} sig={signals[scope] ?? null} calc={calc} counties={counties} stateGeo={stateGeo} shade={shade} />}
    </section>
  );
}

/* ── national: every state's race, adjusted ──────────────────────────────── */

function National({ model, races, office, signals, geo, shade, onOpen }: {
  model: ModelFile; races: Race[]; office: "senate" | "governor"; signals: Record<string, StateSignal>; geo: Geo | null; shade: Shade; onOpen: (st: string) => void;
}) {
  const [tip, setTip] = useState<{ st: string; x: number; y: number } | null>(null);
  const rows = useMemo(() => races.map((r) => {
    const sg = signals[r.st] ?? null; const s = sg?.shift ?? 0;
    const m = r.est.margin, ma = m + s, p = r.est.prob, pa = sg ? adjProb(r, s) : p;
    return { r, sg, s, m, ma, p, pa, flip: sg ? (p >= 0.5) !== (pa >= 0.5) : false };
  }).sort((a, b) => Math.abs(a.ma) - Math.abs(b.ma)), [races, signals]);
  const byState = useMemo(() => Object.fromEntries(rows.map((x) => [x.r.st, x])), [rows]);

  const ch = model.chambers[office];
  const dSeatChange = rows.reduce((t, x) => t - (x.pa - x.p), 0);
  const withSig = rows.filter((x) => x.sg);
  const flips = rows.filter((x) => x.flip);
  const lean = withSig.reduce((t, x) => t + x.s * (x.sg?.expTotal ?? 0), 0) / Math.max(1, withSig.reduce((t, x) => t + (x.sg?.expTotal ?? 0), 0));

  const dom = niceDom(withSig.map((x) => x.s));
  const fill = (st: string) => {
    const x = byState[st]; if (!x) return "var(--ev-idle)";
    if (shade === "change") return x.sg ? shiftFill(x.s, dom) : "var(--lead-even)";
    return leadFill(shade === "forecast" ? x.m : x.ma);
  };
  const t = tip ? byState[tip.st] : null;

  return (
    <>
      <div className="adj-grid">
        <div className="db-card adj-mapcard">
          {geo ? (
            <svg viewBox={`0 0 ${geo.frame[0]} ${geo.frame[1]}`} className="ev-map" role="img" aria-label="Forecast margins with the early vote, by state">
              {Object.entries(geo.states).map(([st, d]) => (
                <path key={st} d={d} className={`ev-unit${byState[st] ? " live" : ""}`} style={{ fill: fill(st) }}
                  onClick={byState[st] ? () => onOpen(st) : undefined}
                  onMouseMove={byState[st] ? (e) => setTip({ st, x: e.clientX, y: e.clientY }) : undefined}
                  onMouseLeave={() => setTip(null)} />
              ))}
            </svg>
          ) : <div className="db-load">Loading the map</div>}
          <Legend shade={shade} national dom={dom} />
        </div>

        <div className="db-card adj-sum">
          <span className="db-cap">{office === "senate" ? "Senate" : "Governors"} · expected Democratic seats</span>
          <div className="adj-two">
            <div><span className="db-cap sm">Forecast</span><b className="mono">{ch ? ch.demSeats.toFixed(1) : "n/a"}</b></div>
            <div><span className="db-cap sm">With early vote</span><b className="mono" style={{ color: tone(-dSeatChange) }}>{ch ? (ch.demSeats + dSeatChange).toFixed(1) : "n/a"}</b></div>
          </div>
          <p className="db-note">
            {Math.abs(dSeatChange) < 0.05 ? "The early vote leaves the expected seat count where the forecast has it."
              : `The early vote moves ${Math.abs(dSeatChange).toFixed(1)} expected ${Math.abs(dSeatChange) >= 0.95 && Math.abs(dSeatChange) < 1.05 ? "seat" : "seats"} toward ${dSeatChange > 0 ? "Democrats" : "Republicans"}.`}
          </p>
          <div className="adj-kv"><span>Races with ballots in</span><b className="mono">{withSig.length} of {rows.length}</b></div>
          <div className="adj-kv"><span>Average shift, by expected votes</span><b className="mono" style={{ color: tone(lean) }}>{withSig.length ? fmtShift(lean) : "n/a"}</b></div>
          <div className="adj-kv"><span>Leaders that change</span><b className="mono">{flips.length}</b></div>
          {flips.length ? (
            <div className="adj-flips">
              {flips.map((x) => (
                <button key={x.r.id} className={`adj-flip ${x.pa >= 0.5 ? "r" : "d"}`} onClick={() => onOpen(x.r.st)}>
                  {STATE_NAME[x.r.st] ?? x.r.st} <em>to {x.pa >= 0.5 ? "R" : "D"}</em>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="db-card adj-tablecard">
        <div className="adj-table" role="table" aria-label="Races with the early vote applied">
          <div className="adj-tr th" role="row">
            <span role="columnheader">Race</span><span role="columnheader" className="num">Forecast</span><span role="columnheader" className="num">Early vote shift</span>
            <span role="columnheader" className="num">Adjusted</span><span role="columnheader" className="num">R odds</span><span role="columnheader" className="num">Adjusted odds</span>
            <span role="columnheader">Signal</span>
          </div>
          {rows.map((x) => (
            <button key={x.r.id} role="row" className="adj-tr" onClick={() => onOpen(x.r.st)}>
              <span className="nm">{STATE_NAME[x.r.st] ?? x.r.st}<small>{x.r.dem} · {x.r.gop}</small></span>
              <span className="num mono" style={{ color: tone(x.m) }}>{fmtMargin(x.m)}</span>
              <span className="num mono" style={{ color: x.sg ? tone(x.s) : undefined }}>{x.sg ? fmtShift(x.s) : "No ballots"}</span>
              <span className="num mono strong" style={{ color: tone(x.ma) }}>{fmtMargin(x.ma)}{x.flip ? <i className={`adj-tag ${x.ma > 0 ? "r" : "d"}`}>flip</i> : null}</span>
              <span className="num mono">{pctS(x.p)}</span>
              <span className="num mono strong" style={{ color: x.sg ? tone(x.pa - x.p) : undefined }}>{pctS(x.pa)}</span>
              <span className="sig">{x.sg ? <>{strengthOf(x.sg.pace)}<small>{pctS(x.sg.pace)} of early vote in</small></> : <small>forecast stands</small>}</span>
            </button>
          ))}
        </div>
        <p className="db-note">Closest races first, after the adjustment. Click a race for its counties. A state with no ballots reported keeps the forecast as is.</p>
      </div>

      {t && tip ? (
        <div className="adj-tip" style={{ left: Math.min(tip.x + 16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 270), top: tip.y + 14 }}>
          <div className="n">{STATE_NAME[t.r.st] ?? t.r.st} {office === "senate" ? "Senate" : "Governor"}</div>
          <div className="s">{t.r.dem} · {t.r.gop}</div>
          <div className="row"><span>Forecast</span><b style={{ color: tone(t.m) }}>{fmtMargin(t.m)}</b></div>
          <div className="row"><span>Early vote shift</span><b style={{ color: t.sg ? tone(t.s) : undefined }}>{t.sg ? fmtShift(t.s) : "No ballots yet"}</b></div>
          <div className="row"><span>With early vote</span><b style={{ color: tone(t.ma) }}>{fmtMargin(t.ma)}</b></div>
          <div className="row"><span>R win odds</span><b>{pctS(t.p)} · {pctS(t.pa)}</b></div>
        </div>
      ) : null}
    </>
  );
}

/* ── one state: the race and every county, adjusted ──────────────────────── */

function StateView({ race, sig, calc, counties, stateGeo, shade }: {
  race: Race | null; sig: StateSignal | null; calc: ElectCalc; counties: CountyFile | null; stateGeo: StateGeo | null; shade: Shade;
}) {
  const [tip, setTip] = useState<{ f: string; x: number; y: number } | null>(null);
  const S = sig?.shift ?? 0;

  // county shifts: the state's shift, plus each county's own early ballot gap against the state's, carried into the final electorate
  const cty = useMemo(() => {
    const out: Record<string, { name: string; m: number; tv: number; s: number; ma: number; n: number }> = {};
    if (!race || !counties) return out;
    const fc = counties[race.id] ?? {}; const names = counties._n ?? {};
    const rows = calc && !calc.none ? calc.rows : [];
    const byF: Record<string, { n: number; delta: number }> = {};
    let dn = 0, dw = 0;
    for (const r of rows) if (r.u.fips && r.delta !== null) { byF[r.u.fips] = { n: r.a.n, delta: r.delta }; dn += r.a.n; dw += r.a.n * r.delta; }
    const sd = dn > 0 ? dw / dn : 0;
    // how much of the final electorate carries today's gap, and how a ballot margin gap reads as a vote margin
    const T = sig ? Math.max(1, sig.expTotal) : 1, nIn = sig?.n ?? 0;
    const f = Math.min(1, (nIn + KAPPA * Math.max(0, T - nIn)) / T);
    const delta = calc && !calc.none ? calc.delta : 0;
    const tau = Math.abs(delta) > 0.75 ? Math.min(1, Math.max(0.15, S / (delta * f))) : 0.5;
    let wsum = 0, ssum = 0;
    for (const [fips, v] of Object.entries(fc)) {
      const c = byF[fips];
      const own = c ? (c.n * c.delta + SHRINK * sd) / (c.n + SHRINK) : sd;
      const s = sig ? S + tau * f * (own - sd) : 0;
      out[fips] = { name: names[fips] ?? fips, m: v[0], tv: v[3], s, ma: 0, n: c?.n ?? 0 };
      wsum += v[3]; ssum += v[3] * s;
    }
    // keep the counties adding up to the state's shift
    const fix = sig && wsum > 0 ? S - ssum / wsum : 0;
    for (const v of Object.values(out)) { v.s += fix; v.ma = Math.max(-99, Math.min(99, v.m + v.s)); }
    return out;
  }, [race, counties, calc, sig, S]);

  if (!race) return <div className="db-card db-load">No Senate or governor race in this state this year.</div>;
  const m = race.est.margin, ma = m + S, p = race.est.prob, pa = sig ? adjProb(race, S) : p;
  const flip = sig ? (p >= 0.5) !== (pa >= 0.5) : false;
  const label = `${STATE_NAME[race.st] ?? race.st} ${race.office === "senate" ? "Senate" : "Governor"}`;

  const dom = niceDom(Object.values(cty).map((c) => c.s));
  const fill = (fips: string) => {
    const c = cty[fips]; if (!c) return "var(--ev-idle)";
    if (shade === "change") return sig ? shiftFill(c.s, dom) : "var(--lead-even)";
    return leadFill(shade === "forecast" ? c.m : c.ma);
  };
  const list = Object.entries(cty);
  const top = [...list].sort((a, b) => b[1].tv - a[1].tv).slice(0, 10).map(([f]) => f);
  const movers = [...list].filter(([, c]) => c.n > 0).sort((a, b) => Math.abs(b[1].s - S) - Math.abs(a[1].s - S)).slice(0, 6);
  const t = tip ? cty[tip.f] : null;

  return (
    <>
      <div className="adj-grid">
        <div className="db-card adj-mapcard">
          {stateGeo && counties ? (
            <svg viewBox="0 0 900 620" className="ev-map" role="img" aria-label={`${label} by county with the early vote`}>
              {stateGeo.counties.map((c) => (
                <path key={c.id} d={c.d} className={`ev-unit${cty[c.id] ? " live" : ""}`} style={{ fill: fill(c.id) }}
                  onMouseMove={cty[c.id] ? (e) => setTip({ f: c.id, x: e.clientX, y: e.clientY }) : undefined}
                  onMouseLeave={() => setTip(null)} />
              ))}
              {stateGeo.counties.filter((c) => top.includes(c.id)).map((c) => {
                const p0 = centroidOf(c.d); if (!p0) return null;
                return <text key={`l-${c.id}`} x={p0[0]} y={p0[1]} className="db-clab" textAnchor="middle" dominantBaseline="central">{cty[c.id]?.name}</text>;
              })}
            </svg>
          ) : <div className="db-load">Loading the counties</div>}
          <Legend shade={shade} dom={dom} />
        </div>

        <div className="db-card adj-sum">
          <span className="db-cap">{label}</span>
          <div className="adj-cands"><span className="d">{race.dem}</span><span className="r">{race.gop}</span></div>
          <div className="adj-two">
            <div><span className="db-cap sm">Forecast</span><b className="mono" style={{ color: tone(m) }}>{fmtMargin(m)}</b></div>
            <div><span className="db-cap sm">With early vote</span><b className="mono" style={{ color: tone(ma) }}>{fmtMargin(ma)}</b></div>
          </div>
          <div className="adj-kv"><span>Early vote shift</span><b className="mono" style={{ color: sig ? tone(S) : undefined }}>{sig ? fmtShift(S) : "No ballots yet"}</b></div>
          <div className="adj-kv"><span>Republican win odds</span><b className="mono">{pctS(p)} · <span style={{ color: sig ? tone(pa - p) : undefined }}>{pctS(pa)}</span></b></div>
          <div className="adj-kv"><span>Signal</span><b>{sig ? `${strengthOf(sig.pace)}, ${pctS(sig.pace)} of early vote in` : "Waiting on ballots"}</b></div>
          {flip ? <div className={`adj-flipnote ${pa >= 0.5 ? "r" : "d"}`}>The leader changes: {pa >= 0.5 ? race.gop : race.dem} moves ahead once the turnout so far is applied.</div> : null}
          {movers.length ? (
            <>
              <span className="db-cap" style={{ marginTop: 6 }}>Counties whose shift differs most from the state&apos;s</span>
              {movers.map(([f, c]) => (
                <div key={f} className="adj-kv sm"><span>{c.name}</span><b className="mono"><span style={{ color: tone(c.s) }}>{fmtShift(c.s)}</span> · <span style={{ color: tone(c.ma) }}>{fmtMargin(c.ma)}</span></b></div>
              ))}
            </>
          ) : null}
          <p className="db-note">Each county moves with the state, plus or minus how far its own early ballots run ahead of or behind the state&apos;s,
            shrunk toward the state where few ballots are in. The counties add back up to the state&apos;s shift.</p>
        </div>
      </div>

      {t && tip ? (
        <div className="adj-tip" style={{ left: Math.min(tip.x + 16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 270), top: tip.y + 14 }}>
          <div className="n">{t.name}</div>
          <div className="s">{label}</div>
          <div className="row"><span>Forecast</span><b style={{ color: tone(t.m) }}>{fmtMargin(t.m)}</b></div>
          <div className="row"><span>Early vote shift</span><b style={{ color: sig ? tone(t.s) : undefined }}>{sig ? fmtShift(t.s) : "No ballots yet"}</b></div>
          <div className="row"><span>With early vote</span><b style={{ color: tone(t.ma) }}>{fmtMargin(t.ma)}</b></div>
          <div className="row"><span>Early ballots in</span><b>{t.n ? t.n.toLocaleString("en-US") : "none reported"}</b></div>
        </div>
      ) : null}
    </>
  );
}

export const ADJ_CSS = `
.adj { margin-top: 22px; display: grid; gap: 14px; scroll-margin-top: 84px; }
.adj-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 14px 24px; }
.adj-head > div:first-child { max-width: 72ch; display: grid; gap: 6px; }
.adj-eye { font: 700 11px var(--font-b); letter-spacing: .16em; text-transform: uppercase; background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; justify-self: start; }
.adj-head h2 { margin: 0; font: 800 clamp(20px, 2.4vw, 26px)/1.15 var(--font-d); letter-spacing: -.03em; color: var(--hi); text-wrap: balance; }
.adj-ctl { display: flex; flex-wrap: wrap; gap: 8px; }
.adj-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; border: 1px solid var(--line2); background: var(--glass2); }
.adj-seg button { border: 0; background: transparent; color: var(--ink2); font: 700 12px var(--font-b); padding: 6px 13px; border-radius: 999px; cursor: pointer; transition: background .15s, color .15s; }
.adj-seg button:hover { color: var(--hi); }
.adj-seg button.on { background: var(--hi); color: var(--bg); }
.adj-seg button:focus-visible { outline: 2px solid var(--ind); outline-offset: 2px; }
.adj-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(260px, 1fr); gap: 14px; align-items: start; }
.adj-mapcard { gap: 10px; }
.adj-leg { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; font: 700 10px ${MONO}; letter-spacing: .1em; text-transform: uppercase; color: var(--muted2); }
.adj-leg .ramp { display: inline-block; width: 160px; height: 8px; border-radius: 999px; background: linear-gradient(90deg, var(--lead-r), var(--lead-even), var(--lead-d)); }
.adj-leg em { font-style: normal; color: var(--muted2); opacity: .8; }
.adj-leg .idle { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; }
.adj-leg .idle i { width: 10px; height: 10px; border-radius: 3px; background: var(--ev-idle); border: 1px solid var(--line2); }
.adj-sum { gap: 10px; }
.adj-two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.adj-two > div { display: grid; gap: 4px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--glass2); }
.adj-two b { font: 700 24px ${MONO}; font-variant-numeric: tabular-nums; color: var(--hi); }
.adj-kv { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 12.5px; color: var(--ink2); padding: 5px 0; border-top: 1px solid var(--line); }
.adj-kv b { font-size: 12.5px; color: var(--hi); text-align: right; font-variant-numeric: tabular-nums; }
.adj-kv.sm { font-size: 12px; padding: 3px 0; }
.adj-cands { display: flex; justify-content: space-between; gap: 10px; font: 700 13px var(--font-b); }
.adj-cands .d { color: var(--dem); } .adj-cands .r { color: var(--gop); text-align: right; }
.adj-flips { display: flex; flex-wrap: wrap; gap: 6px; }
.adj-flip { border: 1px solid var(--line2); background: var(--glass2); color: var(--hi); border-radius: 999px; padding: 5px 11px; font: 700 12px var(--font-b); cursor: pointer; transition: transform .15s, border-color .15s; }
.adj-flip em { font-style: normal; margin-left: 4px; }
.adj-flip.d em { color: var(--dem); } .adj-flip.r em { color: var(--gop); }
.adj-flip:hover { transform: translateY(-1px); border-color: var(--hi); }
.adj-flipnote { font-size: 12.5px; line-height: 1.45; padding: 9px 11px; border-radius: 10px; border: 1px solid; }
.adj-flipnote.d { color: var(--dem); border-color: color-mix(in srgb, var(--dem) 45%, transparent); background: color-mix(in srgb, var(--dem) 9%, transparent); }
.adj-flipnote.r { color: var(--gop); border-color: color-mix(in srgb, var(--gop) 45%, transparent); background: color-mix(in srgb, var(--gop) 9%, transparent); }
.adj-tablecard { padding: 10px 12px 14px; overflow-x: auto; }
.adj-table { display: grid; min-width: 760px; }
.adj-tr { display: grid; grid-template-columns: minmax(170px, 1.6fr) repeat(5, minmax(78px, .8fr)) minmax(130px, 1.1fr); gap: 10px; align-items: center;
  padding: 9px 8px; border: 0; border-top: 1px solid var(--line); background: transparent; color: var(--ink); text-align: left; font: inherit; cursor: pointer; border-radius: 8px; transition: background .15s; }
.adj-tr:hover { background: rgba(var(--line-rgb), .05); }
.adj-tr:focus-visible { outline: 2px solid var(--ind); outline-offset: -2px; }
.adj-tr.th { cursor: default; border-top: 0; font: 700 9.5px ${MONO}; letter-spacing: .16em; text-transform: uppercase; color: var(--muted2); }
.adj-tr.th:hover { background: transparent; }
.adj-tr.th .num { font-size: 9.5px; }
.adj-tr .num { text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; }
.adj-tr .strong { font-weight: 700; }
.adj-tr .nm { display: grid; gap: 2px; font: 700 13.5px var(--font-b); color: var(--hi); }
.adj-tr small { display: block; font: 500 11px var(--font-b); color: var(--muted2); letter-spacing: 0; text-transform: none; }
.adj-tr .sig { font-size: 12px; color: var(--ink2); display: grid; gap: 1px; }
.adj-tag { font-style: normal; margin-left: 6px; padding: 1px 6px; border-radius: 99px; font: 700 9px ${MONO}; letter-spacing: .1em; text-transform: uppercase; vertical-align: 1px; }
.adj-tag.d { color: var(--dem); background: color-mix(in srgb, var(--dem) 14%, transparent); }
.adj-tag.r { color: var(--gop); background: color-mix(in srgb, var(--gop) 14%, transparent); }
.adj-tip { position: fixed; z-index: 90; pointer-events: none; width: 252px; padding: 12px 14px; border-radius: 12px;
  background: rgba(var(--bg2-rgb), .96); border: 1px solid var(--line2); box-shadow: var(--shadow-md); backdrop-filter: blur(10px); }
.adj-tip .n { font: 700 14px var(--font-d); color: var(--hi); }
.adj-tip .s { margin: 2px 0 8px; font: 600 9.5px ${MONO}; letter-spacing: .12em; text-transform: uppercase; color: var(--muted2); }
.adj-tip .row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; color: var(--ink2); padding: 3px 0; }
.adj-tip .row b { color: var(--hi); font-family: ${MONO}; font-variant-numeric: tabular-nums; }
@media (max-width: 900px) { .adj-grid { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .adj-flip, .adj-tr, .adj-seg button { transition: none; } }
`;
