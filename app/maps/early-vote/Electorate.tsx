"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  STATE_NAME, commas, fmtMargin, stateOfFips, bandShares, alignRace, raceHasHispanic, DIMENSIONS, getDemographics,
  type PartyModel, type DemographicPayload, type Dimension, type Capabilities, type View,
} from "./lib";

// ─────────────────────────────────────────────────────────────────────────────
// The electorate tracker. The forecast expects a 2026 electorate, and On Point Polling
// polling plus the 2024 EAVS say how that electorate splits between mail, early
// in person and Election Day ballots, county by county. This section sets the
// ballots already cast against that expectation, in three questions a reader
// actually asks:
//   1. How much of the vote is in?          (pace against the expected early vote)
//   2. Is it good or bad for a party?       (party margin against the expected early margin)
//   3. Where is the electorate heading?     (the 2026 electorate by 2024 vote, projected)
// Built by scripts/earlyvote/build_electorate_model.py into /earlyvote-electorate.json.
// ─────────────────────────────────────────────────────────────────────────────

const MONO = "var(--font-m)";

export type P3 = { d: number; r: number; o: number; n: number };
export type ActualUnit = { key: string; label: string; st: string; fips: string | null; mail: P3; early: P3; estShare: number };

type ElectStates = Record<string, {
  turnout: number; modes: Record<"mail" | "early" | "eday", number>; modeShare: Record<"mail" | "early" | "eday", number>;
  groupShare: Record<"mail" | "early" | "eday", number[]>; electorate: number[]; trump24: number; votes24: number;
  eavs2024?: number[]; eavsFilled?: boolean; regime?: string;
  tpsi2026?: number[]; target2026?: number[]; women?: number[]; margin24?: number;
  house?: { dem: number; rep: number; total: number };
}>;
export type ElectModel = {
  meta: { built: string; respondents: number; likelyVoters: number; countyCols: string[];
    crossover: { trumpToD: number; harrisToR: number; newShare: number; newD: number };
    partyToGroup: Record<"Democrat" | "Republican" | "Independent", number[]>;
    modeMethod?: { tpsiWeight: number; note: string }; womenUS?: number[] };
  nation: ElectStates[string];
  states: ElectStates;
  counties: Record<string, number[]>;
};

let _elect: Promise<ElectModel | null> | null = null;
export const getElectorate = () =>
  (_elect ??= fetch("/earlyvote-electorate.json").then((r) => (r.ok ? (r.json() as Promise<ElectModel>) : null)).catch(() => null));

// county columns: turnout, mail, early, eday, trumpMail, trumpEarly, trumpEday, harrisMail, harrisEarly, harrisEday, trump24
const C = { tv: 0, mail: 1, early: 2, eday: 3, tM: 4, tE: 5, tD: 6, hM: 7, hE: 8, hD: 9, t24: 10 };

const shift = (m: number[], o: number[]) => {
  const d0 = Math.max(m[0], 1e-3);
  const a = (Math.max(m[1], 1e-3) / d0) * Math.exp(o[0]), b = (Math.max(m[2], 1e-3) / d0) * Math.exp(o[1]); const z = 1 + a + b;
  return [1 / z, a / z, b / z];
};

/** expected party mix [D, R, I] of a county's mail (0) or early in person (1) voters, at the state's mean offset */
function useExpMix(model: PartyModel | null) {
  return useMemo(() => {
    const meanOff: Record<string, number[][]> = {};
    if (model) for (const [st, draws] of Object.entries(model.offsets)) {
      const acc = [[0, 0], [0, 0], [0, 0]];
      for (const dr of draws) for (let m = 0; m < 3; m++) { acc[m][0] += dr[m]?.[0] ?? 0; acc[m][1] += dr[m]?.[1] ?? 0; }
      meanOff[st] = acc.map((x) => [x[0] / Math.max(1, draws.length), x[1] / Math.max(1, draws.length)]);
    }
    return (f: string, mi: 0 | 1): number[] | null => {
      const m = model?.mix[f]; if (!m) return null;
      return shift(m[mi], meanOff[stateOfFips(f)]?.[mi] ?? [0, 0]);
    };
  }, [model]);
}

type Exp = { mail: number; early: number; eday: number; tv: number;
  party: number[];                 // expected [D, R, I] share of mail plus early ballots
  partyMail: number[]; partyEarly: number[];
  groups: { mail: number[]; early: number[]; eday: number[] };   // [Trump, Harris, new] share by mode
  t24: number };

const sum3 = (a: number[], b: number[], w = 1) => a.map((x, i) => x + b[i] * w);
const norm = (a: number[]) => { const s = a.reduce((x, y) => x + y, 0); return s > 0 ? a.map((x) => x / s) : a; };

/** Expected ballots, party and 2024 vote mix for a set of counties. */
function expectFor(fips: string[], E: ElectModel, expMix: (f: string, mi: 0 | 1) => number[] | null): Exp {
  let mail = 0, early = 0, eday = 0, tv = 0, t24w = 0;
  let party = [0, 0, 0], pw = 0, pm = [0, 0, 0], pmw = 0, pe = [0, 0, 0], pew = 0;
  const g = { mail: [0, 0, 0], early: [0, 0, 0], eday: [0, 0, 0] };
  for (const f of fips) {
    const c = E.counties[f]; if (!c) continue;
    mail += c[C.mail]; early += c[C.early]; eday += c[C.eday]; tv += c[C.tv]; t24w += c[C.t24] * c[C.tv];
    const mm = expMix(f, 0), me = expMix(f, 1);
    if (mm) { party = sum3(party, mm, c[C.mail]); pw += c[C.mail]; pm = sum3(pm, mm, c[C.mail]); pmw += c[C.mail]; }
    if (me) { party = sum3(party, me, c[C.early]); pw += c[C.early]; pe = sum3(pe, me, c[C.early]); pew += c[C.early]; }
    g.mail = sum3(g.mail, [c[C.tM], c[C.hM], 1 - c[C.tM] - c[C.hM]], c[C.mail]);
    g.early = sum3(g.early, [c[C.tE], c[C.hE], 1 - c[C.tE] - c[C.hE]], c[C.early]);
    g.eday = sum3(g.eday, [c[C.tD], c[C.hD], 1 - c[C.tD] - c[C.hD]], c[C.eday]);
  }
  const P = pw > 0 ? party.map((x) => x / pw) : [0, 0, 0];
  return { mail, early, eday, tv, party: P,
    partyMail: pmw > 0 ? pm.map((x) => x / pmw) : P, partyEarly: pew > 0 ? pe.map((x) => x / pew) : P,
    groups: { mail: norm(g.mail), early: norm(g.early), eday: norm(g.eday) }, t24: tv > 0 ? t24w / tv : 0 };
}

const fmtPts = (x: number) => Math.abs(x) < 0.05 ? "Even" : `${x < 0 ? "D" : "R"}+${Math.abs(x).toFixed(1)}`;
const pctS = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;

function verdictOf(delta: number) {
  // delta: actual minus expected, Republican minus Democratic margin points
  const a = Math.abs(delta);
  if (a < 1) return { side: "even" as const, word: "On track with the forecast", tone: "var(--muted2)" };
  const strength = a >= 6 ? "Much better" : a >= 3 ? "Better" : "Slightly better";
  return delta < 0
    ? { side: "D" as const, word: `${strength} than expected for Democrats`, tone: "var(--dem)" }
    : { side: "R" as const, word: `${strength} than expected for Republicans`, tone: "var(--gop)" };
}

/** two party Democratic share an electorate of [Trump, Harris, new] voters casts, at the On Point Polling crossover rates */
const dShare = (g: number[], x: ElectModel["meta"]["crossover"]) => g[0] * x.trumpToD + g[1] * (1 - x.harrisToR) + g[2] * x.newD;

/** The electorate model and its comparison with the ballots cast so far, shared by the dashboard cards and the
 *  verdict section so every number on the page comes from one calculation. */
type ExpMix = ReturnType<typeof useExpMix>;
/** The whole electorate calculation for one scope, pure, so the national view can also run it state by state. */
export function computeElectorate(E: ElectModel, expMix: ExpMix, scope: string, units: ActualUnit[]) {
  const national = scope === "US";
  const allFips = Object.keys(E.counties).filter((f) => national || stateOfFips(f) === scope);
  const scopeExp = expectFor(allFips, E, expMix);
  const fipsByState: Record<string, string[]> = {};
  for (const f of allFips) (fipsByState[stateOfFips(f)] ??= []).push(f);

  // reporting units with their own expectation
  const rows = units.map((u) => {
    const ex = u.fips ? expectFor([u.fips], E, expMix) : expectFor(fipsByState[u.st] ?? [], E, expMix);
    const a = { d: u.mail.d + u.early.d, r: u.mail.r + u.early.r, o: u.mail.o + u.early.o, n: u.mail.n + u.early.n };
    const exE = ex.mail + ex.early;
    const m = a.n > 0 ? ((a.r - a.d) / a.n) * 100 : null;
    // the unit's expected margin at the mix of mail and in person ballots it has actually cast
    const em = a.n > 0 ? (((ex.partyMail[1] - ex.partyMail[0]) * u.mail.n + (ex.partyEarly[1] - ex.partyEarly[0]) * u.early.n) / a.n) * 100
      : (ex.party[1] - ex.party[0]) * 100;
    return { u, ex, a, pace: exE > 0 ? a.n / exE : null, m, em, delta: m === null ? null : m - em };
  }).filter((r) => r.a.n > 0);

  const A = rows.reduce((s, r) => ({ d: s.d + r.a.d, r: s.r + r.a.r, o: s.o + r.a.o, n: s.n + r.a.n,
    mail: s.mail + r.u.mail.n, early: s.early + r.u.early.n }), { d: 0, r: 0, o: 0, n: 0, mail: 0, early: 0 });
  if (A.n <= 0) return { national, scopeExp, rows, A, none: true as const, expEarly: scopeExp.mail + scopeExp.early,
    fcElect: national ? E.nation.electorate : E.states[scope]?.electorate ?? [0.45, 0.48, 0.07] };
  const expEarly = scopeExp.mail + scopeExp.early;
  const actualM = ((A.r - A.d) / A.n) * 100;
  const pm = scopeExp.partyMail, pe = scopeExp.partyEarly;
  // the forecast's early electorate for the whole scope, at the mix of mail and in person ballots cast so far
  const modeParty = norm(sum3(pm.map((x) => x * A.mail), pe, A.early));
  const expM = (modeParty[1] - modeParty[0]) * 100;
  // the same places' own expected early voters, at the ballots each has cast: where and how held fixed
  let gw = [0, 0, 0], gn = 0;
  for (const r of rows) {
    const ex = r.ex; if (ex.mail + ex.early <= 0) continue;
    gw = sum3(sum3(gw, ex.partyMail, r.u.mail.n), ex.partyEarly, r.u.early.n); gn += r.u.mail.n + r.u.early.n;
  }
  const geoParty = gn > 0 ? gw.map((x) => x / gn) : modeParty;
  const geoM = (geoParty[1] - geoParty[0]) * 100;
  // Nationally, states open early voting on different dates, so which states have ballots in says more about the
  // calendar than about turnout: the national verdict holds the places fixed. Inside a state every county votes on
  // the same calendar, so a state's verdict counts where the ballots come from too.
  const baseParty = national ? geoParty : modeParty;
  const delta = actualM - (national ? geoM : expM);

  // the early electorate by 2024 vote: the model's own expected mix, moved by the gap the party data shows,
  // with party read through On Point Polling likely voters (how Democrats, Republicans and independents voted in 2024)
  const PG = E.meta.partyToGroup;
  const toG = (p: number[]) => norm(sum3(sum3(PG.Democrat.map((x) => x * p[0]), PG.Republican, p[1]), PG.Independent, p[2]));
  const gap = toG([A.d / A.n, A.r / A.n, A.o / A.n]).map((x, i) => x - toG(baseParty)[i]);
  const expG = norm(sum3(scopeExp.groups.mail.map((x) => x * A.mail), scopeExp.groups.early, A.early));
  const actG = norm(expG.map((x, i) => Math.max(0.001, x + gap[i])));
  // project the final electorate: the ballots in, the rest of the early vote and Election Day at the expected mix,
  // half of today's gap carried forward into the ballots still to come
  const KAPPA = 0.5;
  const restMail = Math.max(0, scopeExp.mail - A.mail), restEarly = Math.max(0, scopeExp.early - A.early);
  const shiftG = (g: number[]) => norm(g.map((x, i) => Math.max(0.001, x + KAPPA * gap[i])));
  const proj = norm(sum3(sum3(sum3(actG.map((x) => x * A.n), shiftG(scopeExp.groups.mail), restMail), shiftG(scopeExp.groups.early), restEarly),
    shiftG(scopeExp.groups.eday), scopeExp.eday));
  const fcElect = national ? E.nation.electorate : E.states[scope]?.electorate ?? norm(sum3(sum3(scopeExp.groups.mail.map((x) => x * scopeExp.mail), scopeExp.groups.early, scopeExp.early), scopeExp.groups.eday, scopeExp.eday));
  const dProj = dShare(proj, E.meta.crossover), dFc = dShare(fcElect, E.meta.crossover);
  const impliedShift = (dFc - dProj) * 200;  // R minus D points, positive toward Republicans

  // pace by 2024 lean: are red or blue places voting faster
  const lean = [[0, 0.35], [0.35, 0.5], [0.5, 0.65], [0.65, 1.01]].map(([lo, hi]) => {
    let a = 0, e = 0;
    for (const r of rows) { const t = r.ex.t24; if (t >= lo && t < hi) { a += r.a.n; e += r.ex.mail + r.ex.early; } }
    return { lo, hi, a, e, pace: e > 0 ? a / e : null };
  });
  return { national, scopeExp, rows, A, none: false as const, expEarly, actualM, expM, geoM, delta, actG, expG, proj, fcElect,
    impliedShift, lean, baseM: national ? geoM : expM };
}

/** One state's turnout read: the shift the early vote implies for the forecast, and how strong the signal is. */
export type StateSignal = { st: string; shift: number; delta: number; n: number; expEarly: number; pace: number; reported: number; expTotal: number };
const signalOf = (st: string, c: ReturnType<typeof computeElectorate>, estShare: number): StateSignal | null =>
  c.none ? null : { st, shift: c.impliedShift, delta: c.delta, n: c.A.n, expEarly: c.expEarly, pace: c.A.n / Math.max(1, c.expEarly),
    reported: 1 - estShare, expTotal: c.scopeExp.mail + c.scopeExp.early + c.scopeExp.eday };

export function useElectorate(scope: string, units: ActualUnit[], model: PartyModel | null) {
  const [E, setE] = useState<ElectModel | null>(null);
  useEffect(() => { getElectorate().then(setE); }, []);
  const expMix = useExpMix(model);
  const calc = useMemo(() => (!E || !model ? null : computeElectorate(E, expMix, scope, units)), [E, model, units, scope, expMix]);
  // every state's own signal: on the national view each state unit runs alone, inside a state the scope's calc is the state's
  const signals = useMemo(() => {
    const out: Record<string, StateSignal> = {};
    if (!E || !model || !calc) return out;
    if (scope === "US") {
      for (const u of units) { const sg = signalOf(u.st, computeElectorate(E, expMix, u.st, [u]), u.estShare); if (sg) out[u.st] = sg; }
    } else {
      const n = calc.A.n; const est = units.reduce((s, u) => s + u.estShare * (u.mail.n + u.early.n), 0) / Math.max(1, n);
      const sg = signalOf(scope, calc, est); if (sg) out[scope] = sg;
    }
    return out;
  }, [E, model, calc, units, scope, expMix]);
  return { E, calc, signals };
}
export type ElectCalc = ReturnType<typeof computeElectorate> | null;
export { verdictOf, dShare };

export default function Electorate({ scope, E, calc, model, snapshot, onOpen }: {
  scope: string; E: ElectModel | null; calc: ElectCalc; model: PartyModel | null; snapshot?: string; onOpen?: (key: string) => void;
}) {
  const [sort, setSort] = useState<"expected" | "pace" | "delta">("expected");
  const [showAll, setShowAll] = useState(false);

  if (!E || !model) return <section className="el-wrap"><div className="el-loading">Loading the electorate model</div></section>;
  if (!calc) return null;
  const place = calc.national ? "the country" : STATE_NAME[scope] ?? scope;

  const sorted = [...calc.rows].sort((a, b) => sort === "expected" ? (b.ex.mail + b.ex.early) - (a.ex.mail + a.ex.early)
    : sort === "pace" ? (b.pace ?? -1) - (a.pace ?? -1) : (a.delta ?? 0) - (b.delta ?? 0));
  const shown = showAll ? sorted : sorted.slice(0, 15);

  return (
    <section className="el-wrap" aria-label="Electorate tracker">
      <div className="el-head">
        <div>
          <span className="el-tag">On Point Polling electorate model</span>
          <h2 className="ev-h2">Better or worse than expected for each party?</h2>
          <p className="el-sub">
            Ballots cast so far in {place}, mail returned plus in person, against the electorate the forecast expects,
            split by how each kind of voter casts a ballot.{snapshot ? ` Feed of ${snapshot}.` : ""}
          </p>
        </div>
      </div>

      {calc.none ? (
        <p className="el-note">No mail returns or in person ballots have been reported for {place} yet. The expectation above is what the forecast and On Point Polling polling point to.</p>
      ) : (() => {
        const v = verdictOf(calc.delta);
        const geo = calc.geoM - calc.expM, within = calc.actualM - calc.geoM;
        const natl = calc.national;
        return (
          <>
            <div className="el-verdict" style={{ borderColor: v.tone }}>
              <div className="el-vmain">
                <span className="el-ml">The verdict so far</span>
                <b style={{ color: v.tone }}>{v.word}</b>
                <p>
                  The {commas(calc.A.n)} ballots cast so far run <strong>{fmtMargin(calc.actualM)}</strong> by party.
                  {natl
                    ? <> The forecast expects the early voters of these same states, at this mix of mail and in person
                        ballots, to run <strong>{fmtMargin(calc.baseM)}</strong>,</>
                    : <> The forecast expects {place}&apos;s early voters, at this mix of mail and in person ballots, to run{" "}
                        <strong>{fmtMargin(calc.baseM)}</strong>,</>}{" "}
                  so the early vote is <strong style={{ color: v.tone }}>{Math.abs(calc.delta).toFixed(1)} points
                  {calc.delta < 0 ? " more Democratic" : calc.delta > 0 ? " more Republican" : ""}</strong> than expected.
                  Mail ballots always lean Democratic and early in person ballots lean less so, so the comparison is with
                  what the forecast expects of these same kinds of ballots, not with the final result.
                  {natl ? <> States open early voting on different dates, so the national verdict holds the reporting states fixed; open a state to see where its ballots are coming from.</> : null}
                </p>
              </div>
              <div className="el-vparts">
                <div><span>{natl ? "Which states have ballots in" : "Where the ballots come from"}</span><b style={{ color: geo < 0 ? "var(--dem)" : geo > 0 ? "var(--gop)" : undefined }}>{fmtPts(geo)}</b>
                  <em>{natl ? (geo < 0 ? "the reporting states lean Democratic, a calendar effect, not counted" : "the reporting states lean Republican, a calendar effect, not counted")
                    : Math.abs(geo) < 0.5 ? "places are voting in proportion" : geo < 0 ? "Democratic places are voting faster" : "Republican places are voting faster"}</em></div>
                <div><span>Who is voting inside each place</span><b style={{ color: within < 0 ? "var(--dem)" : within > 0 ? "var(--gop)" : undefined }}>{fmtPts(within)}</b>
                  <em>{Math.abs(within) < 0.5 ? "as the model expects" : within < 0 ? "more Democrats than the model expects" : "more Republicans than the model expects"}</em></div>
                <div><span>Of the expected early vote cast</span><b>{pctS(calc.A.n / Math.max(1, calc.expEarly))}</b>
                  <em>{commas(calc.A.n)} of {commas(calc.expEarly)}</em></div>
              </div>
            </div>

            <div className="el-grid">
              <div className="el-card">
                <span className="el-ml">The electorate, by 2024 vote</span>
                <h3>Who has voted so far</h3>
                {([["Early vote so far", calc.actG], ["Expected early vote", calc.expG], ["Projected 2026 electorate", calc.proj], ["Forecast electorate", calc.fcElect]] as const).map(([k, g]) => (
                  <div key={k} className="el-grow">
                    <span className="k">{k}</span>
                    <span className="el-gbar" aria-hidden>
                      <i style={{ width: pctS(g[1]), background: "var(--dem)" }} />
                      <i style={{ width: pctS(g[2]), background: "var(--muted2)" }} />
                      <i style={{ width: pctS(g[0]), background: "var(--gop)" }} />
                    </span>
                    <span className="v"><b style={{ color: "var(--gop)" }}>{pctS(g[0])}</b> Trump · <b style={{ color: "var(--dem)" }}>{pctS(g[1])}</b> Harris · {pctS(g[2])} new</span>
                  </div>
                ))}
                <p className="el-note">
                  Voters are counted by how they voted in 2024: returning Trump voters, returning Harris voters, and new
                  voters who skipped 2024 or voted third party. Ballots with a party are read through On Point Polling likely voters:
                  {" "}{pctS(E.meta.partyToGroup.Republican[0], 0)} of Republicans and {pctS(E.meta.partyToGroup.Democrat[1], 0)} of
                  Democrats are returning voters of their own party&apos;s 2024 candidate. Trump won {pctS(calc.national ? E.nation.trump24 : E.states[scope]?.trump24 ?? 0)} of
                  the two party vote in {place} in 2024.
                </p>
                <div className="el-implied">
                  <span>If the rest of the vote comes in as expected, the turnout mix alone is worth</span>
                  <b style={{ color: calc.impliedShift < 0 ? "var(--dem)" : "var(--gop)" }}>
                    {Math.abs(calc.impliedShift) < 0.05 ? "nothing" : `${Math.abs(calc.impliedShift).toFixed(1)} points to ${calc.impliedShift < 0 ? "Democrats" : "Republicans"}`}
                  </b>
                  <span>against the forecast&apos;s electorate before its early vote correction, with half of today&apos;s gap carried into the ballots still to come. The forecast check shows how much of it each race already counts.</span>
                </div>
              </div>

              <div className="el-card">
                <span className="el-ml">Pace by 2024 vote</span>
                <h3>Are red or blue places voting faster?</h3>
                {calc.lean.map((b) => (
                  <div key={b.lo} className="el-lrow">
                    <span className="k">{b.lo === 0 ? "Trump under 35%" : b.hi > 1 ? "Trump 65% or more" : `Trump ${Math.round(b.lo * 100)} to ${Math.round(b.hi * 100)}%`}</span>
                    <span className="el-track"><i style={{ width: `${Math.min(100, (b.pace ?? 0) * 100 / Math.max(0.01, Math.max(...calc.lean.map((x) => x.pace ?? 0))))}%`,
                      background: b.lo >= 0.5 ? "var(--gop)" : "var(--dem)" }} /></span>
                    <span className="v">{b.pace === null ? "no ballots" : `${pctS(b.pace)} in`}</span>
                  </div>
                ))}
                <p className="el-note">
                  Each band holds the {calc.national ? "states" : "counties"} that gave Trump that share of the 2024 vote. The bar is how much
                  of the early vote the electorate model expects there has already been cast. A longer bar means that kind of place is
                  voting earlier than expected.
                </p>
              </div>
            </div>

            <div className="el-tablehead">
              <h3 className="ev-h2">{calc.national ? "By state" : "By county"}</h3>
              <div className="ev-seg sm" role="tablist" aria-label="Sort">
                {([["expected", "Largest"], ["pace", "Fastest"], ["delta", "Most Democratic vs expected"]] as const).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={sort === k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="ev-scroll">
              <table className="ev-table el-table">
                <thead><tr>
                  <th>{calc.national ? "State" : "County"}</th><th className="num">Cast</th><th className="num">Expected early</th>
                  <th className="num">Pace</th><th className="num">Party so far</th><th className="num">Expected</th><th className="num">Against expected</th>
                  <th className="num">Trump 2024</th>
                </tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.u.key} className={calc.national && onOpen ? "clickable" : undefined}
                        tabIndex={calc.national && onOpen ? 0 : undefined}
                        onClick={calc.national && onOpen ? () => onOpen(r.u.key) : undefined}
                        onKeyDown={calc.national && onOpen ? (e) => { if (e.key === "Enter") onOpen(r.u.key); } : undefined}>
                      <td className="name">{r.u.label}{r.u.estShare >= 0.5 ? <em className="el-est"> est.</em> : null}</td>
                      <td className="num">{commas(r.a.n)}</td>
                      <td className="num">{commas(r.ex.mail + r.ex.early)}</td>
                      <td className="num">{r.pace === null ? "—" : pctS(r.pace)}</td>
                      <td className="num" style={{ color: (r.m ?? 0) > 0 ? "var(--gop)" : "var(--dem)" }}>{r.m === null ? "—" : fmtMargin(r.m)}</td>
                      <td className="num">{fmtMargin(r.em)}</td>
                      <td className="num" style={{ color: (r.delta ?? 0) > 0 ? "var(--gop)" : "var(--dem)" }}>{r.delta === null ? "—" : fmtPts(r.delta)}</td>
                      <td className="num">{pctS(r.ex.t24, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length > 15 ? <button className="ev-link el-more" onClick={() => setShowAll((x) => !x)}>{showAll ? "Show fewer" : `Show all ${sorted.length}`}</button> : null}
          </>
        );
      })()}

      <details className="el-method">
        <summary>How the electorate is estimated</summary>
        <p>
          Every county starts from the forecast&apos;s projected 2026 vote. It is split into returning Trump voters,
          returning Harris voters and new voters so that it matches both the county&apos;s projected turnout and its projected
          margin, using how On Point Polling likely voters say they will vote: {pctS(E.meta.crossover.trumpToD)} of Trump voters
          back Democrats for Congress, {pctS(E.meta.crossover.harrisToR)} of Harris voters back Republicans, and new voters
          are {pctS(E.meta.crossover.newShare)} of the electorate and lean {pctS(E.meta.crossover.newD, 0)} Democratic.
        </p>
        <p>
          A model fitted on {commas(E.meta.respondents)} On Point Polling likely voters gives each group its chance of voting by mail,
          early in person or on Election Day, by 2024 vote, age and the state&apos;s ballot rules, at each county&apos;s
          ages from the census. The split between the three comes from the On Point Polling national dataset, what 2026 likely voters
          say they will do, pooled half and half in log odds with how each state actually voted in 2024 in the federal
          Election Administration and Voting Survey, because a national survey cannot see that Georgia and Texas vote early
          in person while New York and New Hampshire mostly do not, and voters who say Election Day often vote early. On Point Polling
          alone puts {E.nation.tpsi2026 ? pctS(E.nation.tpsi2026[2], 0) : "about two thirds"} of the vote on Election Day and 2024 put{" "}
          {E.nation.eavs2024 ? pctS(E.nation.eavs2024[2], 0) : "about 37%"} there; pooled, the country is expected to cast{" "}
          {pctS(E.nation.modeShare.mail, 0)} by mail, {pctS(E.nation.modeShare.early, 0)} early in person and{" "}
          {pctS(E.nation.modeShare.eday, 0)} on Election Day, about where the 2022 midterm landed.
          {!calc.national && E.states[scope]?.eavs2024 ? <> In {place} in 2024, {pctS(E.states[scope]!.eavs2024![0], 0)} of
            ballots came by mail, {pctS(E.states[scope]!.eavs2024![1], 0)} early in person and {pctS(E.states[scope]!.eavs2024![2], 0)} on
            Election Day{E.states[scope]?.eavsFilled ? ", partly filled from states with the same ballot rules where the survey has gaps" : ""};
            for 2026 the model expects {pctS(E.states[scope]!.modeShare.mail, 0)}, {pctS(E.states[scope]!.modeShare.early, 0)} and {pctS(E.states[scope]!.modeShare.eday, 0)}.</> : null}
        </p>
        <p>
          The party of ballots comes from the state where it reports party and from the On Point Polling party estimate where it does
          not, the same numbers as the map above. Where a state reports no party, the verdict can only move with where the
          ballots come from and with the ages and races the state reports, so read it as a turnout signal, not a party count.
        </p>
      </details>
    </section>
  );
}

/* ── who is voting early: every breakdown the state publishes ────────────── */

const DIM_ORDER: Dimension[] = ["party", "age", "race", "ethnicity", "gender"];
const AGE_BANDS = ["18 to 29", "30 to 44", "45 to 64", "65 and older"];
const RACE_BANDS = ["White", "Black", "Hispanic", "Asian and other"];

export function EarlyDemographics({ scope, cat, caps, model, catLabel }: {
  scope: string; cat: View; caps: Capabilities | null; model: PartyModel | null; catLabel: string;
}) {
  const [gotAll, setGot] = useState<{ k: string; v: Partial<Record<Dimension, DemographicPayload | null>> }>({ k: "", v: {} });
  const gk = `${scope}|${cat}`;
  const got = gotAll.k === gk ? gotAll.v : {};
  const dims = useMemo(() => {
    const m = caps?.categories?.[cat];
    return DIM_ORDER.filter((d) => (m ? m[d] : false));
  }, [caps, cat]);
  useEffect(() => {
    let live = true;
    const k = `${scope}|${cat}`;
    for (const d of dims) getDemographics(scope, cat, d).then((p) => {
      if (live) setGot((x) => ({ k, v: { ...(x.k === k ? x.v : {}), [d]: p } }));
    });
    return () => { live = false; };
  }, [scope, cat, dims]);

  const mode: "mail" | "early" = cat === "inperson" ? "early" : "mail";
  const expected = (dim: "age" | "race"): number[] | null => {
    if (!model || scope === "US") return null;
    if (cat === "total") {
      const a = model.demo[scope]?.mail?.[dim]?.share, b = model.demo[scope]?.early?.[dim]?.share;
      return a && b ? a.map((x, i) => (x + b[i]) / 2) : a ?? b ?? null;
    }
    return model.demo[scope]?.[mode]?.[dim]?.share ?? null;
  };
  const lean = (dim: "age" | "race"): number[][] | null => (model && scope !== "US" ? model.demo[scope]?.[mode]?.[dim]?.mix ?? null : null);

  if (!dims.length) {
    return (
      <section className="el-demo">
        <h2 className="ev-h2">Who is voting early</h2>
        <p className="el-note">{scope === "US" ? "The country as a whole" : STATE_NAME[scope] ?? scope} publishes no breakdown of {catLabel} by party, age, race or gender yet.</p>
      </section>
    );
  }
  return (
    <section className="el-demo" aria-label="Early vote demographics">
      <div className="el-head">
        <div>
          <span className="el-tag">From civicAPI</span>
          <h2 className="ev-h2">Who is voting early</h2>
          <p className="el-sub">Every breakdown {scope === "US" ? "the states publish, added up" : `${STATE_NAME[scope] ?? scope} publishes`} for {catLabel}.
            {scope !== "US" ? " Age and race also show the share the On Point Polling model expects among these voters and how each group leans." : ""}
            {" "}States publish these statewide only, so there is no county breakdown.</p>
        </div>
      </div>
      <div className="el-dgrid">
        {dims.map((d) => {
          const p = got[d];
          const label = DIMENSIONS.find((x) => x.key === d)?.label ?? d;
          if (!p) return <div key={d} className="el-dcard"><h3>{label}</h3><div className="el-loading sm">reading the feed</div></div>;
          const entries = Object.entries(p.values).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
          const tot = p.total || entries.reduce((s, [, v]) => s + v, 0);
          const raw = d === "age" || d === "race" ? bandShares(p.values, d) : null;
          const exp = d === "age" || d === "race" ? expected(d) : null;
          const noHisp = d === "race" && !raceHasHispanic(p.values);
          const band = raw && exp && d === "race" ? alignRace(raw, exp, p.values) : raw;
          const mix = d === "age" || d === "race" ? lean(d) : null;
          return (
            <div key={d} className="el-dcard">
              <h3>{label}</h3>
              {entries.map(([k, v]) => (
                <div key={k} className="el-drow">
                  <span className="k">{k}</span>
                  <span className="el-track"><i style={{ width: `${(v / Math.max(1, tot)) * 100}%`,
                    background: d === "party" ? (k === "Democratic" ? "var(--dem)" : k === "Republican" ? "var(--gop)" : "var(--muted2)") : "var(--ink2)" }} /></span>
                  <span className="v">{commas(v)}</span>
                  <span className="p">{pctS(v / Math.max(1, tot))}</span>
                </div>
              ))}
              {band && exp ? (
                <div className="el-dexp">
                  <span className="el-ml">Against the On Point Polling model</span>
                  {(d === "age" ? AGE_BANDS : RACE_BANDS).map((b, i) => {
                    if (noHisp && i === 2) return null;
                    const pooled = noHisp && i === 3;
                    const diff = pooled ? (band[2] + band[3] - exp[2] - exp[3]) * 100 : (band[i] - exp[i]) * 100;
                    const m = pooled && mix?.[2] && mix?.[3]
                      ? mix[2].map((x, j) => (x * exp[2] + mix[3][j] * exp[3]) / Math.max(1e-9, exp[2] + exp[3]))
                      : mix?.[i];
                    const lm = m ? (m[1] - m[0]) * 100 : null;
                    return (
                      <div key={b} className="el-xrow">
                        <span className="k">{noHisp && i === 3 ? "Hispanic, Asian and other" : b}</span>
                        <span>{pctS(noHisp && i === 3 ? band[2] + band[3] : band[i])}</span>
                        <span className="e">expected {pctS(noHisp && i === 3 ? exp[2] + exp[3] : exp[i])}</span>
                        <b style={{ color: Math.abs(diff) < 1 ? undefined : (lm !== null && ((diff > 0 && lm < 0) || (diff < 0 && lm > 0))) ? "var(--dem)" : "var(--gop)" }}>{diff > 0 ? "+" : ""}{diff.toFixed(1)}</b>
                        <span className="e">{lm === null ? "" : `leans ${fmtMargin(lm)}`}</span>
                      </div>
                    );
                  })}
                  <p className="el-note">A group voting above its expected share helps the party it leans toward. The point difference is colored by who that helps.{noHisp ? ` ${STATE_NAME[scope] ?? scope} publishes no Hispanic category, so Hispanic voters are counted with Asian and other voters.` : ""}</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const ELECTORATE_CSS = `
.el-wrap tr.clickable{cursor:pointer}.el-wrap tr.clickable:hover td{background:rgba(var(--line-rgb),.04)}.el-wrap tr.clickable:focus-visible{outline:2px solid var(--dem);outline-offset:-2px}
.el-wrap, .el-demo { margin-top: 26px; padding: 22px 24px 20px; border: 1px solid var(--line); border-radius: var(--r, 16px); background: var(--glass); }
.el-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
.el-tag { display: inline-block; margin-bottom: 8px; padding: 3px 9px; border-radius: 99px; border: 1px solid var(--border2);
  font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); }
.el-sub { margin-top: 6px; max-width: 72ch; font-size: 13.5px; line-height: 1.5; color: var(--muted); }
.el-loading { padding: 26px 0; text-align: center; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted2); }
.el-loading.sm { padding: 10px 0; text-align: left; }
.el-ml { display: block; font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted2); }
.el-modes { margin-top: 18px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.el-mode { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--line); background: rgba(var(--line-rgb),0.03); }
.el-mode b { font-family: var(--font-d); font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: var(--hi); font-variant-numeric: tabular-nums; }
.el-ms { font-size: 12px; line-height: 1.4; color: var(--muted); }
.el-track { display: block; height: 8px; border-radius: 99px; background: rgba(var(--line-rgb),0.08); overflow: hidden; }
.el-track i { display: block; height: 100%; border-radius: 99px; background: var(--ink2); }
.el-verdict { margin-top: 16px; display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 18px; padding: 18px 20px;
  border-radius: 14px; border: 1px solid; background: rgba(var(--line-rgb),0.035); }
.el-vmain b { display: block; margin-top: 6px; font-family: var(--font-d); font-size: clamp(20px, 2.4vw, 28px); font-weight: 800; letter-spacing: -0.02em; text-wrap: balance; }
.el-vmain p { margin-top: 10px; font-size: 13.5px; line-height: 1.55; color: var(--muted); max-width: 70ch; }
.el-vmain strong { color: var(--ink); font-weight: 700; }
.el-vparts { display: grid; gap: 10px; align-content: start; }
.el-vparts > div { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 10px 12px; border-radius: 10px; background: rgba(var(--line-rgb),0.04); }
.el-vparts span { font-size: 12.5px; color: var(--ink); }
.el-vparts b { font-family: ${MONO}; font-size: 15px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.el-vparts em { grid-column: 1 / -1; font-style: normal; font-size: 11.5px; color: var(--muted2); }
.el-grid { margin-top: 16px; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 14px; }
.el-card { padding: 16px 18px; border-radius: 14px; border: 1px solid var(--line); background: rgba(var(--line-rgb),0.03); }
.el-card h3, .el-dcard h3 { margin: 4px 0 12px; font-family: var(--font-d); font-size: 15px; font-weight: 700; color: var(--hi); }
.el-grow { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 4px 12px; align-items: center; margin-bottom: 10px; }
.el-grow .k { font-size: 12.5px; color: var(--ink); }
.el-grow .v { grid-column: 2; font-family: ${MONO}; font-size: 11px; color: var(--muted2); }
.el-gbar { display: flex; height: 12px; border-radius: 99px; overflow: hidden; background: rgba(var(--line-rgb),0.08); }
.el-gbar i { display: block; height: 100%; }
.el-implied { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; padding: 10px 12px; border-radius: 10px;
  background: rgba(var(--line-rgb),0.05); font-size: 12.5px; color: var(--muted); }
.el-implied b { font-family: var(--font-d); font-size: 15px; }
.el-lrow, .el-drow { display: grid; grid-template-columns: 130px minmax(0, 1fr) auto; gap: 12px; align-items: center; margin-bottom: 9px; font-size: 12.5px; }
.el-drow { grid-template-columns: minmax(90px, 1fr) minmax(0, 1.4fr) auto auto; }
.el-lrow .k, .el-drow .k { color: var(--ink); }
.el-lrow .v, .el-drow .v, .el-drow .p { font-family: ${MONO}; font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; text-align: right; }
.el-note { margin-top: 10px; font-size: 12px; line-height: 1.5; color: var(--muted2); max-width: 75ch; }
.el-tablehead { margin-top: 22px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.el-table td.name { white-space: nowrap; }
.el-est { font-style: italic; font-size: 11px; color: var(--muted2); }
.el-more { margin-top: 10px; }
.el-method { margin-top: 18px; font-size: 13px; line-height: 1.55; color: var(--muted); }
.el-method summary { cursor: pointer; font-weight: 700; color: var(--ink); }
.el-method p { margin-top: 10px; max-width: 78ch; }
.el-dgrid { margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
.el-dcard { padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: rgba(var(--line-rgb),0.03); }
.el-dexp { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); }
.el-xrow { display: grid; grid-template-columns: minmax(80px, 1fr) auto auto auto auto; gap: 10px; align-items: baseline; margin-top: 6px;
  font-family: ${MONO}; font-size: 11.5px; color: var(--ink); font-variant-numeric: tabular-nums; }
.el-xrow .k { font-family: var(--font-b); font-size: 12.5px; }
.el-xrow .e { color: var(--muted2); }
@media (max-width: 820px) {
  .el-modes, .el-verdict, .el-grid { grid-template-columns: 1fr; }
  .el-grow { grid-template-columns: 1fr; }
  .el-grow .v { grid-column: 1; }
  .el-lrow { grid-template-columns: 110px minmax(0, 1fr) auto; }
  .el-wrap, .el-demo { padding: 16px; }
}
`;
