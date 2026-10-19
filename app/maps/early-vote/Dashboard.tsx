"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  STATE_NAME, commas, compact, fmtMargin, bandShares, alignRace, raceHasHispanic, getDemographics, mergeDemographics,
  TOTAL_PARTS, type PartyModel, type DemographicPayload, type Capabilities, type Category, type View,
} from "./lib";
import { dShare, verdictOf, type ElectModel, type ElectCalc, type ActualUnit } from "./Electorate";

// ─────────────────────────────────────────────────────────────────────────────
// The early vote dashboard: four ballot tiles, the modeled 2026 vote of the ballots
// cast so far for a race, the final electorate shift, a forecast check, and a side
// panel of who has voted, reported where a state publishes it and modeled where it
// does not. Every number reads the same electorate calculation as the verdict below.
// ─────────────────────────────────────────────────────────────────────────────

const MONO = "var(--font-m)";
export type DashView = View | "remaining";

const lg = (p: number) => Math.log(Math.min(Math.max(p, 1e-4), 1 - 1e-4) / (1 - Math.min(Math.max(p, 1e-4), 1 - 1e-4)));
const il = (x: number) => 1 / (1 + Math.exp(-x));
const pctS = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;
const side = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m > 0 ? "Trump" : "Harris"} +${Math.abs(m).toFixed(1)}`);

/* ── forecast races ──────────────────────────────────────────────────────── */

export type FcRace = {
  id: string; office: string; st: string; dem: string; gop: string;
  votes: { dem: number; rep: number; other: number; total: number };
  cands?: { name: string; party: string; pct: number }[];
};
let _fc: Promise<FcRace[]> | null = null;
export const getForecastRaces = () =>
  (_fc ??= fetch("/forecast/model.json").then((r) => (r.ok ? r.json() : null))
    .then((m) => ((m?.races ?? []) as FcRace[]).filter((r) => r.office === "senate" || r.office === "governor"))
    .catch(() => []));

type RaceOpt = { key: string; label: string; dName: string; rName: string; dLab: string; rLab: string; d: number; r: number; o: number };

function raceOptions(scope: string, E: ElectModel | null, races: FcRace[]): RaceOpt[] {
  const out: RaceOpt[] = [];
  const place = scope === "US" ? "U.S." : STATE_NAME[scope] ?? scope;
  const mk = (key: string, label: string, dName: string, rName: string, dLab: string, rLab: string, v: { dem: number; rep: number; total: number }) => {
    const t = Math.max(1, v.total);
    out.push({ key, label, dName, rName, dLab, rLab, d: v.dem / t, r: v.rep / t, o: Math.max(0, 1 - (v.dem + v.rep) / t) });
  };
  if (scope !== "US") {
    for (const off of ["senate", "governor"]) {
      const r = races.find((x) => x.st === scope && x.office === off);
      if (!r || !r.votes?.total) continue;
      const dp = r.cands?.find((c) => c.name === r.dem)?.party ?? "D";
      mk(r.id, `${place} ${off === "senate" ? "U.S. Senate" : "Governor"}`, r.dem, r.gop, dp, "R", { dem: r.votes.dem, rep: r.votes.rep, total: r.votes.total });
    }
    const h = E?.states[scope]?.house;
    if (h) mk("house", `${place} U.S. House, statewide vote`, "Democrats", "Republicans", "D", "R", h);
  } else if (E?.nation.house) {
    mk("house", "U.S. House, national vote", "Democrats", "Republicans", "D", "R", E.nation.house);
  }
  return out;
}

/* ── shared pieces ───────────────────────────────────────────────────────── */

function Ring({ frac, tone = "var(--accent-link, #8b7bff)", size = 46 }: { frac: number; tone?: string; size?: number }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="db-ring" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} className="trk" />
      <circle cx={size / 2} cy={size / 2} r={r} className="val" stroke={tone}
        strokeDasharray={`${c * f} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle">{f >= 0.995 ? "100" : (f * 100).toFixed(f < 0.1 ? 1 : 0)}%</text>
    </svg>
  );
}

/* ── 1. ballot tiles ─────────────────────────────────────────────────────── */

export function KpiStrip({ view, setView, mail, inperson, requested, exp }: {
  view: DashView; setView: (v: DashView) => void; mail: number; inperson: number; requested: number;
  exp: { total: number; mail: number; early: number } | null;
}) {
  const cast = mail + inperson;
  const remaining = exp ? Math.max(0, exp.total - cast) : null;
  const tiles: { k: DashView; label: string; n: number | null; sub: string; frac: number; tone: string }[] = [
    { k: "total", label: "Total ballots cast", n: cast, sub: exp ? `${pctS(cast / Math.max(1, exp.total))} of the ${compact(exp.total)} votes expected` : "mail returned plus in person",
      frac: exp ? cast / Math.max(1, exp.total) : 0, tone: "#9b8cff" },
    { k: "inperson", label: "Early in person", n: inperson, sub: exp ? `${pctS(inperson / Math.max(1, exp.early))} of ${compact(exp.early)} expected` : "cast before Election Day",
      frac: exp ? inperson / Math.max(1, exp.early) : 0, tone: "#e3c35a" },
    { k: "returned", label: "Mail returns", n: mail, sub: requested > 0 ? `of ${compact(requested)} requested · ${exp ? `${pctS(mail / Math.max(1, exp.mail))} of ${compact(exp.mail)} expected` : ""}` : exp ? `${pctS(mail / Math.max(1, exp.mail))} of ${compact(exp.mail)} expected` : "mail ballots returned",
      frac: exp ? mail / Math.max(1, exp.mail) : 0, tone: "#5fd0a5" },
    { k: "remaining", label: "Remaining ballots", n: remaining, sub: exp ? "expected still to come, early and on Election Day" : "waiting on the electorate model",
      frac: exp && remaining !== null ? remaining / Math.max(1, exp.total) : 0, tone: "var(--muted2)" },
  ];
  return (
    <div className="db-kpis" role="tablist" aria-label="Ballots">
      {tiles.map((t) => (
        <button key={t.k} role="tab" aria-selected={view === t.k} className={`db-kpi${view === t.k ? " on" : ""}`} onClick={() => setView(t.k)}>
          <span className="txt">
            <b>{t.n === null ? "—" : commas(t.n)}</b>
            <em>{t.label}</em>
            <small>{t.sub}</small>
          </span>
          <Ring frac={t.frac} tone={t.tone} />
        </button>
      ))}
    </div>
  );
}

/* ── 2. modeled vote, electorate shift and forecast check ────────────────── */

export function TopCards({ scope, E, calc, races, reportedShare, cast, expTotal }: {
  scope: string; E: ElectModel | null; calc: ElectCalc; races: FcRace[];
  reportedShare: number; cast: number; expTotal: number;
}) {
  const opts = useMemo(() => raceOptions(scope, E, races), [scope, E, races]);
  const [pick, setPick] = useState<string>("");
  const race = opts.find((o) => o.key === pick) ?? opts[0];
  if (!E || !calc || !race) return <div className="db-top"><div className="db-card db-load">Loading the electorate model</div></div>;

  const x = E.meta.crossover;
  const live = !calc.none;
  // the ballots cast so far, by 2024 vote, against the forecast's whole electorate
  const early = live ? calc.actG : null;
  const shiftL = early ? lg(dShare(early, x)) - lg(dShare(calc.fcElect, x)) : 0;
  const d2 = race.d / Math.max(1e-6, race.d + race.r);
  const d2e = il(lg(d2) + shiftL);
  const keep = 1 - race.o;
  const dE = d2e * keep, rE = (1 - d2e) * keep;
  // uncertainty in share points: the crossover read plus the share of party that is estimated
  const u = Math.min(0.065, 0.022 + 0.04 * (1 - reportedShare));
  const mE = (rE - dE) * 100, mF = (race.r - race.d) * 100;
  const lo = mE - 2 * u * 100, hi = mE + 2 * u * 100;
  const pos = (m: number) => `${50 + Math.max(-100, Math.min(100, m)) / 2}%`;

  // final electorate shift: how the 2026 electorate voted in 2024, against the 2024 result
  const t24 = scope === "US" ? E.nation.trump24 : E.states[scope]?.trump24 ?? E.nation.trump24;
  const m24 = (2 * t24 - 1) * 100;
  const g = live ? calc.proj : calc.fcElect;
  const m26 = (g[0] + g[2] * (1 - x.newD) - g[1] - g[2] * x.newD) * 100;
  const boost = m26 - m24;   // negative is toward Democrats

  // forecast check: does the early vote point to an electorate to the left or right of the forecast's
  const imp = live ? calc.impliedShift : 0;
  const pace = live ? calc.A.n / Math.max(1, calc.expEarly) : 0;
  const strength = !live ? "no ballots yet" : pace < 0.15 ? "early signal" : pace < 0.4 ? "building signal" : "strong signal";
  const check = !live ? { word: "Waiting on ballots", tone: "var(--muted2)", sub: "No mail returns or in person ballots reported yet." }
    : Math.abs(imp) < 1.5 ? { word: "Forecast looks about right", tone: "var(--gold, #e3c35a)", sub: `The early vote points to an electorate within ${Math.abs(imp).toFixed(1)} points of the forecast's.` }
    : imp > 0 ? { word: "Forecast may be too Democratic", tone: "var(--gop)", sub: `The early vote points to an electorate ${imp.toFixed(1)} points more Republican than the forecast's.` }
    : { word: "Forecast may be too Republican", tone: "var(--dem)", sub: `The early vote points to an electorate ${Math.abs(imp).toFixed(1)} points more Democratic than the forecast's.` };
  const v = live ? verdictOf(calc.delta) : null;

  return (
    <div className="db-top">
      <section className="db-card db-vote" aria-label="Modeled 2026 vote">
        <div className="db-vhead">
          <select className="db-sel" value={race.key} onChange={(e) => setPick(e.target.value)} aria-label="Race">
            {opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <span className="db-pill">Modeled 2026 vote</span>
          <span className="db-sub">{live ? "of the ballots cast so far" : "forecast, before any ballots"}</span>
        </div>
        <div className="db-cands">
          <div className="db-cand d">
            <span className="nm">{race.dName} <i className="pt d">{race.dLab}</i></span>
            <span className="lab">Est. vote share</span>
            <b>{live ? <>{pctS(Math.max(0, dE - u))} – {pctS(Math.min(1, dE + u))}</> : pctS(race.d)}</b>
            <small>forecast {pctS(race.d)}</small>
          </div>
          <div className="db-cand r">
            <span className="nm"><i className="pt r">{race.rLab}</i> {race.rName}</span>
            <span className="lab">Est. vote share</span>
            <b>{live ? <>{pctS(Math.max(0, rE - u))} – {pctS(Math.min(1, rE + u))}</> : pctS(race.r)}</b>
            <small>forecast {pctS(race.r)}</small>
          </div>
        </div>
        <div className="db-mbar" aria-hidden>
          <span className="axis" />
          {[-100, -50, 0, 50, 100].map((t) => <span key={t} className={`tick${t === 0 ? " mid" : ""}`} style={{ left: pos(t) }} />)}
          {live ? <span className="band" style={{ left: pos(Math.min(lo, hi)), width: `${Math.abs(hi - lo) / 2}%` }} /> : null}
          <span className="fc" style={{ left: pos(mF) }} title="forecast" />
          <div className="lbls"><span>+100</span><span>+50</span><span>Even</span><span>+50</span><span>+100</span></div>
        </div>
        <div className="db-vfoot">
          <span className="lab">Est. votes cast <b>{pctS(cast / Math.max(1, expTotal))}</b></span>
          <span className="db-prog"><i style={{ width: pctS(Math.min(1, cast / Math.max(1, expTotal))) }} /></span>
          <span className="lab">Party reported <b>{pctS(reportedShare)}</b></span>
        </div>
        <p className="db-note">
          {live ? <>Early ballots so far {fmtMargin(mE)} for this race, the band their likely range, against the forecast&apos;s {fmtMargin(mF)} for
            the whole electorate, the solid tick. Early ballots lean Democratic in most states, so read the band against what
            these kinds of ballots usually do, in the verdict below.</> : <>The forecast for the whole electorate, {fmtMargin(mF)}.</>}
        </p>
      </section>

      <section className="db-card db-shift" aria-label="Final electorate shift">
        <span className="db-cap">Final electorate shift</span>
        <b className="big" style={{ color: boost < 0 ? "var(--dem)" : boost > 0 ? "var(--gop)" : undefined }}>
          {Math.abs(boost) < 0.05 ? "Even" : `${boost < 0 ? "D" : "R"} +${Math.abs(boost).toFixed(1)}`}
        </b>
        <span className="db-cap sm">Estimated turnout boost</span>
        <div className="db-flow">
          <div><span className="db-cap sm">2024 electorate</span><small>actual result</small><b style={{ color: m24 > 0 ? "var(--gop)" : "var(--dem)" }}>{side(m24)}</b></div>
          <span className="arr" aria-hidden />
          <div><span className="db-cap sm">2026 electorate</span><small>{live ? "modeled, with the early vote" : "forecast electorate"}</small><b style={{ color: m26 > 0 ? "var(--gop)" : "var(--dem)" }}>{side(m26)}</b></div>
        </div>
        <p className="db-note">How the projected 2026 electorate voted in 2024, returning voters as they voted and new voters at their modeled lean, against the 2024 result in {scope === "US" ? "the country" : STATE_NAME[scope] ?? scope}.</p>
      </section>

      <section className="db-card db-check" aria-label="Forecast check" style={{ borderColor: check.tone }}>
        <span className="db-cap">Forecast check · {strength}</span>
        <b className="word" style={{ color: check.tone }}>{check.word}</b>
        <p className="db-note">{check.sub}</p>
        {live ? (
          <div className="db-chk">
            <div><span>Forecast, {race.label.replace(/^U\.S\. /, "")}</span><b style={{ color: mF > 0 ? "var(--gop)" : "var(--dem)" }}>{fmtMargin(mF)}</b></div>
            <div><span>With the early vote electorate</span><b style={{ color: mF + imp > 0 ? "var(--gop)" : "var(--dem)" }}>{fmtMargin(mF + imp)}</b></div>
            {v ? <div className="v"><span>Early ballots against expected</span><b style={{ color: v.tone }}>{v.word}</b></div> : null}
          </div>
        ) : null}
        <p className="db-note">Reads the turnout mix only: whose voters are showing up, not how undecided voters break. {pctS(pace)} of the expected early vote is in.</p>
      </section>
    </div>
  );
}

/* ── 3. who has voted: reported where published, modeled where not ───────── */

const AGE_LABELS = ["18 to 29", "30 to 44", "45 to 64", "65 and older"];
const RACE_LABELS = ["White", "Black", "Hispanic", "Asian and other"];

function genderShares(values: Record<string, number>): [number, number] | null {
  let f = 0, m = 0;
  for (const [k, v] of Object.entries(values)) {
    if (/^(f|wom)/i.test(k)) f += v; else if (/^(m|men)/i.test(k)) m += v;
  }
  return f + m > 0 ? [f, m] : null;
}

type Blend = { shares: number[]; reported: number; n: number };
/** reported counts where a breakdown exists, the modeled shares for every other ballot */
function blend(rep: number[] | null, repN: number, N: number, exp: number[]): Blend {
  const k = exp.length;
  const r = rep && repN > 0 ? rep : new Array(k).fill(0);
  const rn = rep ? Math.min(repN, N) : 0;
  const out = exp.map((e, i) => (r[i] * rn + e * Math.max(0, N - rn)) / Math.max(1, N));
  const s = out.reduce((a, b) => a + b, 0) || 1;
  return { shares: out.map((x) => x / s), reported: N > 0 ? rn / N : 0, n: N };
}

function Panel({ title, rows, cov, note }: { title: string; rows: { k: string; s: number; n: number; c: string }[]; cov: number | null; note?: string }) {
  return (
    <div className="db-panel">
      <h3>{title}</h3>
      {rows.map((r) => (
        <div key={r.k} className="db-prow" title={`${commas(r.n)} ballots`}>
          <span className="k">{r.k}</span>
          <span className="db-ptrack"><i style={{ width: pctS(r.s), background: r.c }} /></span>
          <span className="p" style={{ color: r.c }}>{pctS(r.s)}</span>
          <span className="n">{compact(r.n)}</span>
        </div>
      ))}
      {cov !== null ? <div className="db-cov"><span>Reported</span><b>{pctS(cov)}</b><span>modeled</span><b>{pctS(1 - cov)}</b></div> : null}
      {note ? <p className="db-note">{note}</p> : null}
    </div>
  );
}

function LeadCard({ scope, party, snapshot }: { scope: string; party: { d: number; r: number; o: number; n: number; reported: number }; snapshot?: string }) {
  const N = Math.max(1, party.n);
  const m = ((party.r - party.d) / N) * 100;
  let day = snapshot ?? "";
  try { if (snapshot) day = new Date(`${snapshot}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); } catch { /* keep the raw date */ }
  const est = party.reported < 0.5;
  return (
    <div className="db-lead">
      <b className="day">{day || (scope === "US" ? "Nationwide" : STATE_NAME[scope] ?? scope)}</b>
      <span className="sub">{commas(party.n)} ballots cast so far</span>
      {([["Dem", party.d, "var(--lead-d)"], ["Rep", party.r, "var(--lead-r)"], ["Unaff.", party.o, "color-mix(in srgb, var(--lead-d) 35%, var(--lead-even))"]] as const).map(([k, v, c]) => (
        <div key={k} className="row"><span>{k}</span><span className="trk"><i style={{ width: pctS(v / N), background: c }} /></span><b>{pctS(v / N)}</b></div>
      ))}
      <span className="db-cap lead-cap">{scope === "US" ? "Lead among ballots cast" : "Statewide lead"}{est ? ", estimated" : ""}</span>
      <b className="big" style={{ color: m > 0 ? "var(--lead-r)" : "var(--lead-d)" }}>{fmtLead(m)}</b>
      <span className="sub">Dem {commas(party.d)} · Rep {commas(party.r)} · Unaff./other {commas(party.o)}</span>
    </div>
  );
}

export function SidePanels({ scope, view, E, calc, model, caps, units, party, snapshot }: {
  scope: string; view: DashView; E: ElectModel | null; calc: ElectCalc; model: PartyModel | null;
  caps: Capabilities | null; units: ActualUnit[];
  party: { d: number; r: number; o: number; n: number; reported: number }; snapshot?: string;
}) {
  const cats: Category[] = view === "requested" ? ["requested"] : view === "inperson" ? ["inperson"] : view === "returned" ? ["returned"] : TOTAL_PARTS;
  const [demo, setDemo] = useState<{ k: string; v: Partial<Record<"age" | "race" | "gender", DemographicPayload | null>> }>({ k: "", v: {} });
  const dk = `${scope}|${cats.join(",")}`;
  useEffect(() => {
    let live = true;
    const k = `${scope}|${cats.join(",")}`;
    for (const dim of ["age", "race", "gender"] as const) {
      const avail = cats.filter((c) => caps?.categories?.[c]?.[dim]);
      if (!avail.length) continue;
      Promise.all(avail.map((c) => getDemographics(scope, c, dim))).then((got) => {
        if (live) setDemo((x) => ({ k, v: { ...(x.k === k ? x.v : {}), [dim]: mergeDemographics(got) } }));
      });
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dk, caps]);
  const got = demo.k === dk ? demo.v : {};

  const out = useMemo(() => {
    if (!E || !model) return null;
    const N = party.n;
    // the modeled shares of these ballots: each state's On Point Polling expectation for its mail and in person voters,
    // weighted by the ballots each state has cast
    const wts: { st: string; mail: number; early: number }[] = scope === "US"
      ? units.map((u) => ({ st: u.st, mail: u.mail.n, early: u.early.n }))
      : [{ st: scope, mail: units.reduce((s, u) => s + u.mail.n, 0), early: units.reduce((s, u) => s + u.early.n, 0) }];
    const expOf = (dim: "age" | "race") => {
      const acc = [0, 0, 0, 0]; let w = 0;
      for (const x of wts) {
        const dm = model.demo[x.st];
        if (!dm) continue;
        for (const [mk, n] of [["mail", x.mail], ["early", x.early]] as const) {
          const sh = dm[mk]?.[dim]?.share; if (!sh || n <= 0) continue;
          for (let i = 0; i < 4; i++) acc[i] += sh[i] * n; w += n;
        }
      }
      return w > 0 ? acc.map((a) => a / w) : [0.25, 0.25, 0.25, 0.25];
    };
    const expWomen = () => {
      let f = 0, w = 0;
      for (const x of wts) {
        const wm = E.states[x.st]?.women ?? E.meta.womenUS ?? [0.56, 0.54, 0.5];
        f += wm[0] * x.mail + wm[1] * x.early; w += x.mail + x.early;
      }
      const s = w > 0 ? f / w : 0.55;
      return [s, 1 - s];
    };
    const ageExp = expOf("age"), raceExp = expOf("race");
    const pa = got.age ? bandShares(got.age.values, "age") : null;
    let pr = got.race ? bandShares(got.race.values, "race") : null;
    if (pr && got.race && !raceHasHispanic(got.race.values)) pr = alignRace(pr, raceExp, got.race.values);
    const pg = got.gender ? genderShares(got.gender.values) : null;
    const pgS = pg ? [pg[0] / (pg[0] + pg[1]), pg[1] / (pg[0] + pg[1])] : null;
    return {
      N,
      age: blend(pa, got.age?.total ?? 0, N, ageExp),
      race: blend(pr, got.race?.total ?? 0, N, raceExp),
      gender: blend(pgS, pg ? pg[0] + pg[1] : 0, N, expWomen()),
    };
  }, [E, model, scope, units, party.n, got]);

  if (!E || !out || party.n <= 0) {
    return <aside className="db-side"><div className="db-panel"><h3>{scope === "US" ? "Nationwide" : STATE_NAME[scope] ?? scope}</h3><p className="db-note">No ballots reported yet.</p></div></aside>;
  }
  const N = out.N;
  const g = calc && !calc.none ? calc.actG : null;
  const c4 = ["var(--ink2)", "#3fbf8f", "#d6a92e", "#8c7bff"];
  return (
    <aside className="db-side" aria-label="Who has voted">
      <div className="db-sidehead"><span className="db-cap">{scope === "US" ? "Nationwide" : "Statewide"}</span><b>{scope === "US" ? "All reporting states" : STATE_NAME[scope] ?? scope}</b></div>
      <LeadCard scope={scope} party={party} snapshot={snapshot} />
      {g ? (
        <Panel title="Modeled 2024 presidential vote" cov={null}
          rows={[{ k: "Harris", s: g[1], n: g[1] * N, c: "var(--dem)" }, { k: "Trump", s: g[0], n: g[0] * N, c: "var(--gop)" }, { k: "Other or new", s: g[2], n: g[2] * N, c: "var(--muted2)" }]}
          note="How the ballots cast so far voted in 2024, read from their party and the On Point Polling electorate model." />
      ) : null}
      <Panel title="Party" cov={party.reported}
        rows={[{ k: "Democratic", s: party.d / N, n: party.d, c: "var(--dem)" }, { k: "Republican", s: party.r / N, n: party.r, c: "var(--gop)" }, { k: "Independent or other", s: party.o / N, n: party.o, c: "var(--muted2)" }]}
        note="Party registration where the state publishes it, the On Point Polling party estimate where it reports none." />
      <Panel title="Modeled race" cov={out.race.reported}
        rows={RACE_LABELS.map((k, i) => ({ k, s: out.race.shares[i], n: out.race.shares[i] * N, c: c4[i] }))} />
      <Panel title="Modeled age" cov={out.age.reported}
        rows={AGE_LABELS.map((k, i) => ({ k, s: out.age.shares[i], n: out.age.shares[i] * N, c: c4[i] }))} />
      <Panel title="Modeled gender" cov={out.gender.reported}
        rows={[{ k: "Women", s: out.gender.shares[0], n: out.gender.shares[0] * N, c: "#c79cff" }, { k: "Men", s: out.gender.shares[1], n: out.gender.shares[1] * N, c: "#7fb2ff" }]}
        note="Ballots a state reports with these details are counted as reported. The rest take the On Point Polling likely voter model for that state's mail and in person voters, from the census and the On Point Polling national dataset." />
    </aside>
  );
}

/* ── map helpers ─────────────────────────────────────────────────────────── */

/** the visual centre of a path: the average point of its largest ring */
export function centroidOf(d: string): [number, number] | null {
  let best: number[][] = [], bestA = -1;
  for (const part of d.split(/[Zz]/)) {
    const pts = (part.match(/-?\d+\.?\d*,-?\d+\.?\d*/g) ?? []).map((p) => p.split(",").map(Number));
    if (pts.length < 3) continue;
    let a = 0;
    for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; }
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = pts; }
  }
  if (!best.length) return null;
  let cx = 0, cy = 0, A = 0;
  for (let i = 0; i < best.length; i++) {
    const [x1, y1] = best[i], [x2, y2] = best[(i + 1) % best.length];
    const f = x1 * y2 - x2 * y1; A += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  if (Math.abs(A) < 1e-9) return [best.reduce((s, p) => s + p[0], 0) / best.length, best.reduce((s, p) => s + p[1], 0) / best.length];
  return [cx / (3 * A), cy / (3 * A)];
}

/** Party lead shading, the way a county lead map reads: pale near even, deep at a 40 point lead either way,
 *  grey where a place has too few ballots to say. Margins are Republican positive. */
export function leadFill(m: number | null, n?: number): string {
  if (m === null || !isFinite(m)) return "var(--ev-nodata)";
  if (n !== undefined && n < 20) return "var(--lead-low)";
  const t = Math.min(1, Math.abs(m) / 40);
  const pct = Math.round(10 + 90 * Math.pow(t, 0.8));
  return `color-mix(in srgb, ${m > 0 ? "var(--lead-r)" : "var(--lead-d)"} ${pct}%, var(--lead-even))`;
}
export const fmtLead = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m > 0 ? "R" : "D"} +${Math.abs(m).toFixed(1)}`);

export function paceFill(p: number | null): string {
  if (p === null || !isFinite(p)) return "var(--ev-nodata)";
  const t = Math.max(0, Math.min(1, p));
  return `color-mix(in srgb, #9b8cff ${Math.round(12 + 80 * t)}%, var(--ev-mid))`;
}

export const DASH_CSS = `
:root { --lead-d: #2152d6; --lead-r: #c8352b; --lead-even: #d4d0de; --lead-low: rgba(140,134,160,.38); }
:root[data-theme="light"] { --lead-d: #1f4fd1; --lead-r: #c63a2c; --lead-even: #eceaf1; --lead-low: rgba(120,114,140,.28); }
.db-kpis { margin-top: 18px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.db-kpi { appearance: none; font: inherit; color: inherit; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--glass); transition: border-color .15s ease, background .15s ease; }
.db-kpi:hover { border-color: var(--border3, var(--border2)); }
.db-kpi.on { border-color: #9b8cff; background: var(--glass2, rgba(155,140,255,.08)); box-shadow: inset 0 0 0 1px rgba(155,140,255,.35); }
.db-kpi:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.db-kpi .txt { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.db-kpi b { font-family: var(--font-d); font-size: clamp(20px, 2.2vw, 27px); font-weight: 800; letter-spacing: -0.02em; color: var(--hi); font-variant-numeric: tabular-nums; }
.db-kpi.on b { color: var(--ind); }
.db-kpi em { font-style: normal; font-size: 12.5px; font-weight: 600; color: var(--ink); }
.db-kpi small { font-size: 11px; line-height: 1.35; color: var(--muted2); }
.db-ring { flex-shrink: 0; }
.db-ring .trk { fill: none; stroke: rgba(var(--line-rgb), 0.12); stroke-width: 4; }
.db-ring .val { fill: none; stroke-width: 4; stroke-linecap: round; }
.db-ring text { font-family: ${MONO}; font-size: 9.5px; font-weight: 700; fill: var(--ink); }

.db-top { margin-top: 14px; display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: stretch; }
.db-card { padding: 16px 18px; border-radius: 14px; border: 1px solid var(--line); background: var(--glass); display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.db-load { color: var(--muted2); font-family: ${MONO}; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
.db-vote { border-color: rgba(155,140,255,.55); }
.db-vhead { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.db-sel { appearance: auto; font: 600 12.5px var(--font-b); color: var(--ink); background: rgba(var(--line-rgb),.06); border: 1px solid var(--border2); border-radius: 8px; padding: 6px 8px; max-width: 100%; }
.db-pill { padding: 3px 10px; border-radius: 99px; background: rgba(155,140,255,.18); color: var(--ind); font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.db-sub { font-size: 12px; color: var(--muted2); }
.db-cands { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }
.db-cand { display: flex; flex-direction: column; gap: 2px; }
.db-cand.r { text-align: right; align-items: flex-end; }
.db-cand .nm { font-family: var(--font-d); font-size: 15px; font-weight: 700; color: var(--hi); }
.db-cand .lab { font-size: 11px; color: var(--muted2); }
.db-cand b { font-family: var(--font-d); font-size: clamp(20px, 2.3vw, 28px); font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.db-cand.d b { color: var(--dem); } .db-cand.r b { color: var(--gop); }
.db-cand small { font-family: ${MONO}; font-size: 10.5px; color: var(--muted2); }
.pt { font-style: normal; display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 5px; font-family: ${MONO}; font-size: 10px; font-weight: 800; color: var(--hi); vertical-align: 2px; }
.pt.d { background: var(--dem); } .pt.r { background: var(--gop); }
.db-mbar { position: relative; height: 46px; margin: 6px 4px 0; }
.db-mbar .axis { position: absolute; left: 0; right: 0; top: 14px; height: 2px; background: rgba(var(--line-rgb),.25); }
.db-mbar .tick { position: absolute; top: 8px; width: 1px; height: 14px; background: rgba(var(--line-rgb),.45); }
.db-mbar .tick.mid { width: 2px; top: 4px; height: 22px; background: var(--ink); }
.db-mbar .band { position: absolute; top: 5px; height: 20px; border-radius: 4px; background: rgba(155,140,255,.28); border: 1px solid rgba(155,140,255,.8); }
.db-mbar .fc { position: absolute; top: 2px; width: 3px; height: 26px; margin-left: -1.5px; border-radius: 2px; background: var(--hi); box-shadow: 0 0 0 1px rgba(0,0,0,.4); }
.db-mbar .lbls { position: absolute; left: 0; right: 0; top: 30px; display: flex; justify-content: space-between; font-family: ${MONO}; font-size: 9.5px; color: var(--muted2); }
.db-vfoot { display: grid; grid-template-columns: auto minmax(60px, 1fr) auto; gap: 12px; align-items: center; padding-top: 8px; border-top: 1px solid var(--border); }
.db-vfoot .lab { font-size: 11.5px; color: var(--muted2); white-space: nowrap; }
.db-vfoot .lab b { font-family: ${MONO}; color: var(--ind); }
.db-prog { display: block; height: 8px; border-radius: 99px; background: rgba(var(--line-rgb),.1); overflow: hidden; }
.db-prog i { display: block; height: 100%; border-radius: 99px; background: #9b8cff; }
.db-note { font-size: 11.5px; line-height: 1.5; color: var(--muted2); margin: 0; }
.db-cap { font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--muted2); }
.db-cap.sm { font-size: 9px; letter-spacing: .12em; }
.db-shift { align-items: center; text-align: center; }
.db-shift .big { font-family: var(--font-d); font-size: clamp(34px, 4vw, 48px); font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.db-flow { width: 100%; display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; margin-top: 6px; padding-top: 10px; border-top: 1px solid var(--border); }
.db-flow > div { display: flex; flex-direction: column; gap: 2px; }
.db-flow small { font-size: 10px; color: var(--muted2); }
.db-flow b { font-family: ${MONO}; font-size: 14px; font-weight: 800; }
.db-flow .arr { width: 12px; height: 12px; border-top: 2px solid var(--muted2); border-right: 2px solid var(--muted2); transform: rotate(45deg); }
.db-check .word { font-family: var(--font-d); font-size: clamp(18px, 2vw, 22px); font-weight: 800; letter-spacing: -0.01em; text-wrap: balance; }
.db-chk { display: grid; gap: 6px; }
.db-chk > div { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; font-size: 12px; color: var(--muted); }
.db-chk b { font-family: ${MONO}; font-size: 13px; }
.db-chk .v b { font-family: var(--font-b); font-size: 12px; text-align: right; }

.db-main { margin-top: 14px; display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 12px; align-items: start; }
.db-mapcard { position: relative; padding: 12px 14px 12px; border-radius: 14px; border: 1px solid var(--line); background: var(--glass); min-width: 0; }
.db-maptools { position: absolute; right: 14px; top: 12px; z-index: 2; display: flex; gap: 6px; }
.db-tool { appearance: none; border: 1px solid var(--border2); background: rgba(var(--line-rgb),.06); color: var(--ink); border-radius: 8px; padding: 5px 9px; cursor: pointer; font: 700 11px var(--font-b); }
.db-tool.on { border-color: var(--gold); color: var(--gold); }
.db-tabs { display: flex; justify-content: center; margin-top: 8px; }
.db-bub { fill: rgba(227,195,90,.78); stroke: rgba(80,60,0,.55); stroke-width: .8; pointer-events: none; }
.db-bub.rem { fill: rgba(200,200,215,.35); stroke: rgba(var(--line-rgb),.5); }
.db-bubkey { position: absolute; right: 16px; bottom: 54px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-family: ${MONO}; font-size: 9.5px; color: var(--muted2); pointer-events: none; }
.db-lead { padding: 14px 14px 12px; border-radius: 14px; border: 1px solid var(--line); background: var(--glass); display: flex; flex-direction: column; gap: 6px; }
.db-lead .day { font-family: var(--font-d); font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: var(--hi); }
.db-lead .sub { font-size: 11.5px; color: var(--mute); }
.db-lead .row { display: grid; grid-template-columns: 46px minmax(0,1fr) 48px; gap: 8px; align-items: center; font-size: 12px; font-weight: 600; color: var(--ink); }
.db-lead .row b { font-family: ${MONO}; font-size: 12px; text-align: right; }
.db-lead .trk { height: 12px; background: rgba(var(--line-rgb),.08); border-radius: 2px; overflow: hidden; }
.db-lead .trk i { display: block; height: 100%; }
.db-lead .lead-cap { margin-top: 6px; padding-top: 8px; border-top: 2px solid var(--gold); }
.db-lead .big { font-family: var(--font-d); font-size: 34px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
.db-clab { font-family: var(--font-b); font-size: 9px; font-weight: 700; fill: var(--hi); paint-order: stroke; stroke: var(--bg); stroke-width: 2.4px; stroke-linejoin: round; pointer-events: none; }
.db-leadleg { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 14px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line);
  font-family: ${MONO}; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: var(--mute); }
.db-leadleg .ramp { width: min(320px, 50vw); height: 10px; border-radius: 3px; border: 1px solid var(--line); }
.db-leadleg .ends { display: flex; justify-content: space-between; width: min(320px, 50vw); margin-top: 3px; font-size: 9.5px; }
.db-leadleg .sw { display: inline-block; width: 11px; height: 11px; border-radius: 2px; vertical-align: -1px; margin-right: 5px; }
.db-leadleg b { color: var(--ink); }
.db-side { display: flex; flex-direction: column; gap: 8px; max-height: 820px; overflow-y: auto; scrollbar-width: thin; }
.db-sidehead { padding: 12px 14px; border-radius: 14px; border: 1px solid var(--line); background: var(--glass); display: flex; flex-direction: column; gap: 2px; }
.db-sidehead b { font-family: var(--font-d); font-size: 16px; color: var(--hi); }
.db-panel { padding: 10px 12px; border-radius: 14px; border: 1px solid var(--line); background: var(--glass); }
.db-panel h3 { margin: 0 0 8px; font-family: var(--font-d); font-size: 13.5px; font-weight: 700; color: var(--hi); }
.db-prow { display: grid; grid-template-columns: 92px minmax(30px, 1fr) 46px 40px; gap: 8px; align-items: center; margin-bottom: 6px; }
.db-prow .k { font-size: 11.5px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-prow .p { font-family: ${MONO}; font-size: 11.5px; font-weight: 800; text-align: right; }
.db-prow .db-ptrack { height: 6px; border-radius: 99px; background: rgba(var(--line-rgb),.1); overflow: hidden; }
.db-prow .db-ptrack i { display: block; height: 100%; border-radius: 99px; }
.db-prow .n { font-family: ${MONO}; font-size: 10px; color: var(--muted2); text-align: right; }
.db-cov { display: flex; gap: 6px; align-items: baseline; padding-top: 8px; border-top: 1px solid var(--border); font-family: ${MONO}; font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted2); }
.db-cov b { color: var(--win); margin-right: 6px; }
.db-more { margin-top: 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--glass); padding: 0 16px; }
.db-more > summary { cursor: pointer; padding: 14px 0; font-family: var(--font-d); font-size: 14px; font-weight: 700; color: var(--hi); list-style: none; display: flex; justify-content: space-between; }
.db-more > summary::after { content: "+"; font-family: ${MONO}; color: var(--muted2); }
.db-more[open] > summary::after { content: "–"; }
.db-more > summary::-webkit-details-marker { display: none; }
.db-more[open] { padding-bottom: 16px; }
.db-more .el-wrap, .db-more .el-demo, .db-more .ev-est, .db-more .ev-nat, .db-more .ev-tablewrap { margin-top: 0; }
@media (max-width: 1100px) { .db-top { grid-template-columns: 1fr 1fr; } .db-vote { grid-column: 1 / -1; } }
@media (max-width: 900px) { .db-main { grid-template-columns: 1fr; } .db-kpis { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) { .db-top { grid-template-columns: 1fr; } .db-kpis { grid-template-columns: 1fr 1fr; gap: 8px; } .db-kpi { padding: 11px 12px; } .db-kpi .db-ring { display: none; }
  .db-kpi small { font-size: 10.5px; } .db-cands { grid-template-columns: 1fr 1fr; } .db-tabs .ev-seg { flex-wrap: wrap; justify-content: center; border-radius: 14px; } }
`;
