"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CATEGORIES, VIEWS, TOTAL_PARTS, commas, compact, fillFor, getCapabilities, getCategory, getDemographics,
  marginOf, matchCounty, pct, STATE_NAME, stateOfFips, sumRow, toneFor, turnoutFill, volumeScale,
  getPartyModel, modeOf, simulate, fmtMargin, combineNational, returnTilt, demoAdjust, regimeOf, REGIME_WORD, stateParts,
  statePlace, stateView, type StateView, mergeEstimateMaps, mergeEstimates, mergeViews, mergeCombined, mergePayloads,
  ratingOf, RATINGS, RATING_WORD, EV_DEM, EV_REP, EV_TOSS, type Rating,
  type Capabilities, type Combined, type Estimate, type Mode, type Part, type Place, type DemoAdjust, type PartyModel, type ReturnTilt, type Category, type CategoryPayload, type DemographicPayload,
  type Geo, type RegionRow, type StateGeo, type View,
} from "./lib";
import Electorate, { EarlyDemographics, ELECTORATE_CSS, useElectorate, type ActualUnit, type P3 } from "./Electorate";
import AdjustedForecast, { ADJ_CSS } from "./Adjusted";
import PaceCompare, { PACE_CSS } from "./Pace";
import { KpiStrip, TopCards, SidePanels, DASH_CSS, centroidOf, paceFill, leadFill, getForecastRaces, type DashView, type FcRace } from "./Dashboard";

const MONO = "var(--font-m)";

/** Ordered so the party columns read the way the rest of the site does. */
function orderGroups(groups: string[]) {
  const rank = (g: string) =>
    g === "Democratic" ? 0 : g === "Republican" ? 1 :
    /No Party|Independent/.test(g) ? 2 : g === "Unspecified" ? 9 : 5;
  return [...groups].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function Bar({ row, groups, total }: { row: RegionRow; groups: string[]; total: number }) {
  if (total <= 0) return <span className="ev-bar" aria-hidden />;
  return (
    <span className="ev-bar" aria-hidden>
      {groups.map((g) => {
        const v = row[g]?.votes ?? 0;
        if (v <= 0) return null;
        return <i key={g} style={{ width: `${(v / total) * 100}%`, background: toneFor(g, row[g]?.color) }} />;
      })}
    </span>
  );
}

/**
 * The map tooltip, rendered straight into document.body.
 *
 * It used to be a position: fixed child of the page, but an ancestor in the
 * site shell creates its own containing block, so "fixed" was measured from
 * that box instead of the window and the card landed far from the cursor.
 * Portalled to body, clientX and clientY mean what they say. The card sits
 * 14px beside the cursor, centred on it vertically, flips to the left near
 * the right edge and is clamped inside the window using its measured size.
 * The page's style block is global, so the .ev-tip rules still reach it.
 */
function TipBox({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight, gap = 14, pad = 8;
    let left = x + gap;
    if (left + w > vw - pad) left = x - gap - w;
    left = Math.max(pad, Math.min(left, vw - w - pad));
    const top = Math.max(pad, Math.min(y - h / 2, vh - h - pad));
    setPos({ left, top });
  }, [x, y, children]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={ref} className="ev-tip" style={{ left: pos?.left ?? x + 14, top: pos?.top ?? y, visibility: pos ? "visible" : "hidden" }}>
      {children}
    </div>,
    document.body,
  );
}

/** A margin range read from the closer edge out: D+10.3 to D+20.5, R+3 to R+9,
 *  and D+2 to R+4 when it straddles even. Margins are Republican positive. */
function fmtRange(lo: number, hi: number, sep = " to ") {
  const [a, b] = lo < 0 && hi <= 0 ? [hi, lo] : [lo, hi];
  return `${fmtMargin(a)}${sep}${fmtMargin(b)}`;
}

/** Thin diagonal lines laid over any shape filled from the On Point Polling estimate, so a
 *  modelled county never reads as a reported one. */
function HatchDefs() {
  return (
    <defs>
      <pattern id="ev-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0.8" y1="0" x2="0.8" y2="5" className="ev-hatch-line" />
        <line x1="2" y1="0" x2="2" y2="5" className="ev-hatch-line dark" />
      </pattern>
    </defs>
  );
}

function EstBar({ e }: { e: Estimate }) {
  return (
    <span className="ev-bar est" aria-hidden>
      <i style={{ width: `${e.d * 100}%`, background: "var(--dem)" }} />
      <i style={{ width: `${e.i * 100}%`, background: "var(--muted2)" }} />
      <i style={{ width: `${e.r * 100}%`, background: "var(--gop)" }} />
    </span>
  );
}

/** Reported party where a state publishes it, the On Point Polling estimate where it does
 *  not, summed for the whole country, one card per ballot category. */
/** The electoral map's seat bar, for ballots: every reporting place rated, and
 *  the bar sized by the ballots each band holds, Safe D on the left edge to
 *  Safe R on the right. */
function RatingBoard({ places, unit }: { places: { m: number | null; n: number; est: boolean }[]; unit: string }) {
  const bands: { k: string; label: string; color: string; n: number; c: number; side: "D" | "R" | "T" }[] = [
    ...RATINGS.map((rt) => ({ k: "D" + rt, label: `${RATING_WORD[rt]} D`, color: EV_DEM[rt], n: 0, c: 0, side: "D" as const })),
    { k: "T", label: "Toss-up", color: EV_TOSS, n: 0, c: 0, side: "T" as const },
    ...[...RATINGS].reverse().map((rt) => ({ k: "R" + rt, label: `${RATING_WORD[rt]} R`, color: EV_REP[rt], n: 0, c: 0, side: "R" as const })),
  ];
  let rated = 0, estN = 0;
  for (const p of places) {
    if (p.m === null || p.n <= 0) continue;
    const r = ratingOf(p.m);
    const b = bands.find((x) => x.k === (r.side === "T" ? "T" : r.side + r.rating))!;
    b.n += p.n; b.c += 1; rated += p.n; if (p.est) estN += 1;
  }
  if (rated <= 0) return null;
  const side = (s: "D" | "R") => bands.filter((b) => b.side === s).reduce((a, b) => ({ n: a.n + b.n, c: a.c + b.c }), { n: 0, c: 0 });
  const D = side("D"), R = side("R");
  const plural = (c: number) => `${c} ${unit === "county" ? (c === 1 ? "county" : "counties") : (c === 1 ? "state" : "states")}`;
  return (
    <div className="ev-board">
      <div className="ev-board-top">
        <div className="ev-board-side">
          <b style={{ color: EV_DEM.LIKELY }}>{((D.n / rated) * 100).toFixed(1)}%</b>
          <span>of ballots in Democratic rated {unit === "county" ? "counties" : "states"} · {plural(D.c)}</span>
        </div>
        <div className="ev-board-side r">
          <b style={{ color: EV_REP.LIKELY }}>{((R.n / rated) * 100).toFixed(1)}%</b>
          <span>of ballots in Republican rated {unit === "county" ? "counties" : "states"} · {plural(R.c)}</span>
        </div>
      </div>
      <div className="ev-board-bar" role="img" aria-label="Ballots by rating">
        {bands.map((b) => b.n > 0 ? (
          <i key={b.k} style={{ width: `${(b.n / rated) * 100}%`, background: b.color }}
             title={`${b.label}: ${plural(b.c)}, ${commas(b.n)} ballots`} />
        ) : null)}
        <u aria-hidden />
      </div>
      <div className="ev-board-keys">
        {bands.filter((b) => b.c > 0).map((b) => (
          <span key={b.k}><i style={{ background: b.color }} />{b.label}<b>{b.c}</b></span>
        ))}
        {estN ? <span className="note">{estN} rated from the On Point Polling estimate</span> : null}
      </div>
    </div>
  );
}

function NationalCombined({ combined, loaded, cat, setCat, tilt }: {
  combined: Partial<Record<View, Combined | null>>; tilt: ReturnTilt | null;
  loaded: Partial<Record<View, CategoryPayload | null>>;
  cat: View; setCat: (c: View) => void;
}) {
  return (
    <section className="ev-nat" aria-label="Nationwide party breakdown">
      <div className="ev-nat-head">
        <h2 className="ev-h2">Nationwide party breakdown</h2>
        <p>
          Reported party where a state publishes it, the On Point Polling estimate where it reports ballots as
          Unspecified. Solid segments are reported, hatched segments are estimated.
        </p>
      </div>
      <div className="ev-nat-grid">
        {VIEWS.map((c) => {
          const k = combined[c.key];
          const isOn = c.key === cat;
          const waiting = !(c.key in loaded);
          return (
            <button key={c.key} className={`ev-nat-card${isOn ? " on" : ""}`} onClick={() => setCat(c.key)}
              aria-pressed={isOn}>
              <span className="lab">{c.label}<em>{c.blurb}</em></span>
              {k ? (
                <>
                  <span className="big">
                    <b style={{ color: k.margin > 0 ? "var(--gop)" : "var(--dem)" }}>{fmtMargin(k.margin)}</b>
                    <i>{commas(k.total)} ballots</i>
                  </span>
                  <span className="rng">
                    {k.estimated.votes > 0 ? <>80% range {fmtRange(k.lo, k.hi)}</> : "all reported, no estimate needed"}
                  </span>
                  <CombinedBar k={k} />
                  <span className="rows">
                    {([["Democratic", k.d, k.reported.d, "var(--dem)"], ["Independent / other", k.o, k.reported.o, "var(--muted2)"],
                       ["Republican", k.r, k.reported.r, "var(--gop)"]] as const).map(([g, v, rv, col]) => (
                      <span key={g}><i style={{ background: col }} /><b>{g}</b>
                        <span>{commas(v)}</span><u>{((v / k.total) * 100).toFixed(1)}%</u>
                        <small>{rv > 0 ? `${commas(rv)} reported` : "all estimated"}</small></span>
                    ))}
                  </span>
                  {c.key === "returned" && tilt && k.estimated.votes > 0 ? (
                    <span className="src tilt">
                      Estimated returns apply party return rates {tilt.source === "live"
                        ? `measured today in ${tilt.states.length} party states`
                        : "from the On Point Polling survey, until enough party states post returns"}
                      {tilt.calib ? `, calibrated live against ${tilt.calib.states.map((s) => STATE_NAME[s] ?? s).join(" and ")}` : ""}, so they
                      differ from the request mix.
                    </span>
                  ) : null}
                  <span className="src">
                    {commas(k.reported.votes)} reported with party in {k.reported.states} {k.reported.states === 1 ? "state" : "states"}
                    {k.estimated.votes > 0
                      ? <> · {commas(k.estimated.votes)} estimated{k.estimated.states ? ` across ${k.estimated.states} ${k.estimated.states === 1 ? "state" : "states"} with no party data` : ""}</>
                      : null}
                  </span>
                </>
              ) : (
                <span className="none">{waiting ? "reading the feed…" : "Not published by any state yet."}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CombinedBar({ k }: { k: Combined }) {
  const seg = (v: number) => `${(Math.max(0, v) / k.total) * 100}%`;
  const parts = [
    { w: k.reported.d, c: "var(--dem)", est: false }, { w: k.d - k.reported.d, c: "var(--dem)", est: true },
    { w: k.reported.o, c: "var(--muted2)", est: false }, { w: k.o - k.reported.o, c: "var(--muted2)", est: true },
    { w: k.r - k.reported.r, c: "var(--gop)", est: true }, { w: k.reported.r, c: "var(--gop)", est: false },
  ];
  return (
    <span className="ev-bar comb" aria-hidden>
      {parts.map((p, i) => p.w > 0 ? <i key={i} className={p.est ? "est" : undefined} style={{ width: seg(p.w), background: p.c }} /> : null)}
    </span>
  );
}

/** Plain words for the party return offsets behind the returned estimate. */
function ReturnNote({ tilt, reg }: { tilt: ReturnTilt; reg: boolean }) {
  const x = (b: number) => Math.exp(b).toFixed(2);
  const join = (a: string[]) => { const n = a.map((s) => STATE_NAME[s] ?? s); return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0]; };
  return (
    <>
      <p>
        Returned ballots are not a copy of requests, because parties send ballots back at different rates.
        Each requester&apos;s chance of having returned a ballot is modelled per party, with the overall level set so
        every county returns exactly the ballots it reports. The party gap is widest early in the season and fades
        as returns catch up with requests.{" "}
        {tilt.source === "live"
          ? <>Party return rates are measured today in {join(tilt.states)}, from {commas(tilt.returned)} returned
              ballots with party. The typical state has Republican requesters returning at {x(tilt.bR)} times the
              Democratic odds, but states differ a lot, so each simulation takes one measured state&apos;s gap rather
              than an average that the biggest state would dominate.</>
          : <>Too few party states have posted returns to measure this live yet, so the On Point Polling survey stands in:
              Republican mail voters complete at {x(tilt.bR)} times the Democratic odds, Independents at {x(tilt.bO)} times.</>}
        {" "}In a state that mails every voter a ballot, a county&apos;s returns are read against the share of its
        ballots that will ever come back, about the forecast&apos;s turnout, not against every ballot mailed.
        {tilt.universal
          ? <> Those states take their own return rates, measured in {join(tilt.universal.states)}, where the request
              pool is the whole voter file: Republicans returning at {x(tilt.universal.bR)} times the Democratic odds.</>
          : null}
      </p>
      {tilt.calib ? (
        <p>
          {join(tilt.calib.states)} {tilt.calib.states.length === 1 ? "publishes" : "publish"} party for returns
          but not for requests, the one direct check on an estimated return mix.{" "}
          {reg ? <>The estimate is already on a registration basis, so reported and estimated returns are compared
            directly.{" "}</> : <>Registration is not party identification, so the check compares tilts: how far the
            reported returns run from the state&apos;s registered voters, against how far the estimated returns run from
            the model&apos;s electorate.{" "}</>}
          {tilt.calib.before.map((b, i) => (
            <span key={b.st}>{i ? "; " : ""}{STATE_NAME[b.st] ?? b.st}: returns {b.actual.toFixed(1)}% Republican of the two party
              vote against {b.regShare !== null ? `${b.regShare.toFixed(1)}% of registered voters` : "no published file"}, the
              model {b.model.toFixed(1)}% against {b.lvShare !== null ? `${b.lvShare.toFixed(1)}%` : "its electorate"}</span>
          ))}. Estimated returns everywhere are shifted {tilt.calib.shift >= 0 ? "toward Republicans" : "toward Democrats"} by{" "}
          {Math.abs(tilt.calib.shift).toFixed(2)} in log odds, the part of the gap the check states share, scaled down by how
          much they disagree and by how few ballots they hold, {commas(tilt.calib.returned)}. The
          check states can disagree, which is why the shift is only their common part.
        </p>
      ) : null}
    </>
  );
}

/** Where each state's party basis comes from, in plain words. */
function RegistrationNote({ model, st }: { model: PartyModel; st: string | null }) {
  const f = model.meta.registrationFit;
  if (model.meta.basis !== "registration" || !f) {
    return <p>This is party identification, not party registration.</p>;
  }
  const src = st ? f.source[st] : null;
  const lam = st ? f.primaryWeight[st] : undefined;
  const sh = st ? f.shift[st] : undefined;
  const cty = st ? f.county?.[st] : undefined;
  const byCounty = !!cty && cty.cover >= 0.5;
  const asOf = cty?.asOf ? new Date(cty.asOf + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const dir = (x: number) => (x < 0 ? "toward Democrats" : "toward Republicans");
  const name = st ? STATE_NAME[st] ?? st : "";
  const err = f.marginError;
  return (
    <p>
      Party here is party registration, the label a state puts on its voters, and where a state registers no one by
      party, the party L2 models from primary ballots. It is not the party voters name in a survey, so every state is
      read on the same basis as the states that report party. The two differ a lot by state: old Democratic
      registrations in Kentucky, West Virginia and Louisiana, Wyoming Democrats registered Republican for the primary,
      and unaffiliated Democrats in Massachusetts and Rhode Island.{" "}
      {st && src === "feed" ? <>{name} publishes party on its own requests, so the statewide mix is set to those
            requests exactly, and each county is spread around it by {byCounty ? "its own published registration" : "the state\u2019s registration"}.</>
        : st && src === "registration" && sh !== undefined ? <>{name} registers voters by party but sends its ballots
            without it, so {byCounty ? "every county is set to its own" : "the state is set to its"} published
            registration{asOf ? <>, as of {asOf},</> : null} measured against the forecast&apos;s registered voters, and
            mail voters keep their own lean within it. That moves it {Math.abs(sh).toFixed(2)} in log odds {dir(sh)}.</>
        : st && src === "primary" && sh !== undefined ? <>{name} has no party registration, so party is
            modeled the way L2 does it: from the primary ballot a voter pulled, county by county from the 2026 primaries,
            for the {((lam ?? 0) * 100).toFixed(0)}% of voters with a primary history, and the pooled registration gap
            for the rest. Together that moves it {Math.abs(sh).toFixed(2)} in log odds {dir(sh)}.</>
        : st ? <>{name} has no party registration and too little primary history to model from, so it takes the pooled
            registration gap, {f.pooled.toFixed(2)} in log odds, measured across every state that registers by party.</>
        : <>States that report party on their ballots are set to it. States that register by party but report none on
            their ballots are set to their published registration, county by county. States without party registration
            are modeled from primary history, the way L2 assigns party.</>}
      {err ? <>{" "}Tested on the states that report party on their requests, the registration step alone lands
        {" "}{err.fromRegistration.toFixed(1)} points from the reported request margin on average, against {err.pooled.toFixed(1)} for one
        {" "}pooled gap.</> : null}
      {" "}Each simulation adds that evidence&apos;s own error as a statewide shock.
    </p>
  );
}

function EstimatePanel({ e, sub, mode, model, tilt, shade, setShade, st, adj }: {
  e: Estimate; sub: string; mode: Mode; model: PartyModel; tilt: ReturnTilt | null; st: string | null; adj: DemoAdjust;
  shade: "estimate" | "turnout"; setShade: (s: "estimate" | "turnout") => void;
}) {
  const [open, setOpen] = useState(false);
  const parts = [
    { k: "Democratic", s: e.d, c: "var(--dem)" },
    { k: "Independent", s: e.i, c: "var(--muted2)" },
    { k: "Republican", s: e.r, c: "var(--gop)" },
  ];
  return (
    <section className="ev-est" aria-label="On Point Polling party estimate">
      <div className="ev-est-head">
        <div>
          <span className="ev-est-tag">On Point Polling estimate</span>
          <h2 className="ev-h2">Simulated party of these ballots</h2>
          <p className="ev-est-sub">{sub}</p>
        </div>
        <div className="ev-seg sm" role="tablist" aria-label="Shade places with no party data by">
          <button role="tab" aria-selected={shade === "estimate"} className={shade === "estimate" ? "on" : ""}
            onClick={() => setShade("estimate")}>Estimated party</button>
          <button role="tab" aria-selected={shade === "turnout"} className={shade === "turnout" ? "on" : ""}
            onClick={() => setShade("turnout")}>Turnout</button>
        </div>
      </div>

      <div className="ev-est-body">
        <div className="ev-est-margin">
          <b style={{ color: e.margin > 0 ? "var(--gop)" : "var(--dem)" }}>{fmtMargin(e.margin)}</b>
          <span>80% of simulations fall between {fmtRange(e.lo, e.hi, " and ")}</span>
        </div>
        <div className="ev-est-split">
          <EstBar e={e} />
          <div className="ev-key">
            {parts.map((p) => (
              <span key={p.k}><i style={{ background: p.c }} />{p.k}<b>{commas(p.s * e.votes)}</b><u>{(p.s * 100).toFixed(1)}%</u></span>
            ))}
          </div>
        </div>
      </div>

      <button className="ev-link ev-est-more" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide how this is estimated" : "How this is estimated"}
      </button>
      {open ? (
        <div className="ev-est-method">
          <p>
            Each county starts from the forecast&apos;s own 2026 electorate: the 1,152 voter types the model
            simulates in every county, by age, race, college, party, vote history and Trump approval, each with its
            chance of turning out in this year&apos;s D+12 environment. A model fitted on {commas(model.meta.respondents)} On Point Polling
            likely voters then gives every type its chance of voting by mail, early in person or on Election Day, from
            its party, age, race, college, vote history and local lean, under the state&apos;s own ballot rules.
            {st ? <> In {STATE_NAME[st] ?? st}, {REGIME_WORD[regimeOf(model, st)]}.</> : null}
            {st && regimeOf(model, st) === "universal" && mode === "mail"
              ? <> So a ballot sent out is a registered voter, not a self selected mail voter, and the estimate is the
                  voter file&apos;s party mix rather than a mail skew.</>
              : <> A county&apos;s {mode === "early" ? "early in person voters" : "mail voters"} are its forecast voters
                  times their {mode === "early" ? "early" : "mail"} chance, type by type.</>}
          </p>
          <p>
            The mail skew is checked against Florida, North Carolina, Pennsylvania and New Jersey, which publish requests
            and registration by party. Their requesters lean against their own registered voters by about what the model
            predicts, a scale of {model.meta.mailSkewScale.toFixed(2)}, so the skew is kept almost as fitted.
            {adj ? <> This estimate is also reweighted to the {adj.dims.join(" and ")} of the ballots {STATE_NAME[st ?? ""] ?? "the state"} reports: {adj.note}.</> : null}
          </p>
          {mode === "returned" && tilt ? <ReturnNote tilt={tilt} reg={model.meta.basis === "registration"} /> : null}
          <p>
            The mode model is refit on {model.meta.draws} bootstrap resamples of On Point Polling likely voters, the skew scale is
            drawn from how far it moves when one check state is left out, and each state&apos;s electorate takes a party
            shock of its own. Every run is applied to today&apos;s county counts, and the range above is the middle 80% of
            those runs. It is an estimate of who is voting early, not a result.
          </p>
          <RegistrationNote model={model} st={st} />
          <div className="ev-est-check">
            <em>Check against states that do report party, mail ballots requested</em>
            <table>
              <thead><tr><th>State</th><th className="num">From registration</th><th className="num">Pooled gap</th><th className="num">Reported</th></tr></thead>
              <tbody>
                {model.meta.check.map((c) => (
                  // check margins are Democratic positive; the page prints them the way margins read
                  <tr key={c.st}>
                    <td>{STATE_NAME[c.st] ?? c.st}</td>
                    <td className="num">{c.fromRegistration !== undefined ? fmtMargin(-c.fromRegistration) : ""}</td>
                    <td className="num">{fmtMargin(-(c.heldOut ?? c.modelMargin))}</td>
                    <td className="num">{fmtMargin(-c.reportedMargin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Each row is the model run as if that state reported no party on its requests. From registration sets it
              to its published registration alone, the test for a state like Kentucky or Maryland. Pooled gap puts in
              the gap of the other states instead, the test for a state like Michigan or Georgia, where nothing can be
              checked directly.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function EarlyVoteDesk({ initialScope = "US", lede, after }: { initialScope?: string; lede?: React.ReactNode; after?: React.ReactNode }) {
  const [scope, setScope] = useState(initialScope);   // "US" or a state abbreviation
  // Keep the address bar on the page being shown, so a state view can be shared and matches its own
  // search page at /maps/early-vote/<state>.
  const firstScope = useRef(true);
  useEffect(() => {
    if (firstScope.current) { firstScope.current = false; return; }
    const slug = scope === "US" ? "" : "/" + (STATE_NAME[scope] ?? scope).toLowerCase().replace(/[^a-z]+/g, "-");
    try { window.history.replaceState(null, "", `/maps/early-vote${slug}`); } catch { /* history unavailable */ }
  }, [scope]);
  // the dashboard view: a ballot category, every ballot cast, or the ballots still to come
  const [view, setView] = useState<DashView>("total");
  const cat: View = view === "remaining" ? "total" : view;
  const setCat = (c: View) => setView(c);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [data, setData] = useState<CategoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortDesc, setSortDesc] = useState(true);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [stateGeo, setStateGeo] = useState<StateGeo | null>(null);
  const [countyNames, setCountyNames] = useState<Record<string, string> | null>(null);
  const [tip, setTip] = useState<{ key: string; x: number; y: number } | null>(null);
  const [model, setModel] = useState<PartyModel | null>(null);
  // how places with no party data are shaded: the On Point Polling estimate or raw volume
  const [shade, setShade] = useState<"estimate" | "turnout">("estimate");

  useEffect(() => { getPartyModel().then(setModel); }, []);

  // Nationwide combined breakdown: all three categories at once, plus the county
  // counts of every state that reports no party, so each is estimated the same
  // way its own state page estimates it.
  const [natl, setNatl] = useState<Partial<Record<Category, CategoryPayload | null>>>({});
  const [natlCounties, setNatlCounties] = useState<Partial<Record<Category, Record<string, CategoryPayload | null>>>>({});
  // The national payloads load once and on every view, because the returned
  // estimate needs them everywhere: party return rates are measured from the
  // states that publish party for both requests and returns.
  useEffect(() => {
    let live = true;
    for (const c of CATEGORIES.map((x) => x.key)) getCategory("US", c).then((us) => { if (live) setNatl((m) => ({ ...m, [c]: us })); });
    return () => { live = false; };
  }, []);
  // County counts, and the age and race counts, of every state that reports any
  // ballots as Unspecified, so the national map, the national cards and each state
  // page estimate a state from exactly the same inputs.
  const [natlDemo, setNatlDemo] = useState<Partial<Record<Category, Record<string, Partial<Record<"age" | "race", DemographicPayload | null>>>>>>({});
  const unspecStates = (us: CategoryPayload | null | undefined) =>
    Object.entries(us?.regions ?? {}).filter(([, row]) => (row["Unspecified"]?.votes ?? 0) > 0).map(([st]) => st);
  useEffect(() => {
    if (scope !== "US") return;
    let live = true;
    for (const c of CATEGORIES.map((x) => x.key)) {
      const us = natl[c];
      if (!us || natlCounties[c]) continue;
      const sts = unspecStates(us);
      Promise.all(sts.map((st) => getCategory(st, c).then((d) => [st, d] as const)))
        .then((got) => { if (live) setNatlCounties((m) => ({ ...m, [c]: Object.fromEntries(got) })); });
      Promise.all(sts.map(async (st) => {
        const cp = await getCapabilities(st); const m = cp?.categories?.[c];
        const out: Partial<Record<"age" | "race", DemographicPayload | null>> = {};
        for (const dd of ["age", "race"] as const) if (m?.[dd]) out[dd] = await getDemographics(st, c, dd);
        return [st, out] as const;
      })).then((got) => { if (live) setNatlDemo((m) => ({ ...m, [c]: Object.fromEntries(got) })); });
    }
    return () => { live = false; };
  }, [scope, natl, natlCounties]);
  // demographic reweighting per state and category, the same function the state page runs
  const natlAdj = useMemo(() => {
    const out: Partial<Record<Category, Record<string, DemoAdjust>>> = {};
    if (!model) return out;
    for (const c of CATEGORIES.map((x) => x.key)) {
      const per = natlDemo[c]; if (!per) continue;
      out[c] = Object.fromEntries(Object.entries(per).map(([st, p]) => [st, demoAdjust(model, st, modeOf(c), p)]));
    }
    return out;
  }, [model, natlDemo]);
  const tilt: ReturnTilt | null = useMemo(
    () => (model ? returnTilt(natl.requested, natl.returned, model) : null), [model, natl]);
  const natlAll = useMemo<Partial<Record<View, CategoryPayload | null>>>(() => (
    "returned" in natl && "inperson" in natl ? { ...natl, total: mergePayloads([natl.returned, natl.inperson]) } : natl), [natl]);
  const combined = useMemo(() => {
    const out: Partial<Record<View, Combined | null>> = {};
    if (!model) return out;
    for (const c of CATEGORIES.map((x) => x.key)) {
      const us = natl[c];
      out[c] = us ? combineNational(us, natlCounties[c] ?? {}, model, countyNames, modeOf(c),
        c === "returned" ? { us: natl.requested, counties: natlCounties.requested ?? {} } : undefined, tilt, natlAdj[c]) : null;
    }
    if ("returned" in out || "inperson" in out) out.total = mergeCombined(out.returned, out.inperson);
    return out;
  }, [model, natl, natlCounties, countyNames, tilt, natlAdj]);

  // an open state's own requests, so each county's returned ballots can be read
  // against the ballots it sent out
  const [reqState, setReqState] = useState<CategoryPayload | null>(null);
  useEffect(() => {
    setReqState(null);
    if (scope === "US") return;
    let live = true;
    getCategory(scope, "requested").then((d) => { if (live) setReqState(d); });
    return () => { live = false; };
  }, [scope]);

  // the national outline and the county name table load once
  useEffect(() => {
    fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {});
    fetch("/earlyvote-county-names.json").then((r) => r.json()).then(setCountyNames).catch(() => {});
  }, []);

  // county shapes load per state, only once a state is open
  useEffect(() => {
    if (scope === "US") { setStateGeo(null); return; }
    let live = true;
    fetch(`/forecast/states/${scope}.json`).then((r) => r.json())
      .then((g) => { if (live) setStateGeo(g); }).catch(() => { if (live) setStateGeo(null); });
    return () => { live = false; };
  }, [scope]);

  useEffect(() => { getCapabilities(scope).then(setCaps); }, [scope]);

  // a total keeps its two parts as well, so each part is estimated on its own terms
  const [parts, setParts] = useState<Partial<Record<Category, CategoryPayload | null>>>({});
  // The two parts of the total load on every view, since the ballot tiles, the modeled vote and the side panel all
  // read every ballot cast; the map and table then show the tab that is open.
  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all(TOTAL_PARTS.map((p) => getCategory(scope, p))).then(async (got) => {
      if (!live) return;
      const pp = Object.fromEntries(TOTAL_PARTS.map((p, i) => [p, got[i]])) as Partial<Record<Category, CategoryPayload | null>>;
      setParts(pp);
      if (cat === "total") { setData(mergePayloads(got)); setLoading(false); return; }
      if (cat === "returned" || cat === "inperson") { setData(pp[cat] ?? null); setLoading(false); return; }
      const d = await getCategory(scope, cat);
      if (live) { setData(d); setLoading(false); }
    });
    return () => { live = false; };
  }, [scope, cat]);

  // the breakdown cards below read every dimension themselves (EarlyDemographics)

  const groups = useMemo(
    () => orderGroups(Object.keys(data?.statewide_total ?? {})), [data]);
  const total = sumRow(data?.statewide_total);

  const rows = useMemo(() => {
    const r = Object.entries(data?.regions ?? {}).map(([name, row]) => ({ name, row, n: sumRow(row) }));
    r.sort((a, b) => (sortDesc ? b.n - a.n : a.name.localeCompare(b.name)));
    return r;
  }, [data, sortDesc]);

  // Places that report no party at all are shaded by raw ballot volume in
  // green. The scale is built only from those places, so a state that mixes
  // party counties and Unspecified counties keeps its party shading intact.
  const noPartyRows = useMemo(() => rows.filter((r) => marginOf(r.row) === null), [rows]);
  const vol = useMemo(() => volumeScale(noPartyRows.map((r) => r.n)), [noPartyRows]);
  const allNoParty = rows.length > 0 && noPartyRows.length === rows.length;
  const someNoParty = noPartyRows.length > 0;
  // feed county name -> FIPS for the open state
  const fipsOf = useMemo(() => {
    const out: Record<string, string> = {};
    if (scope === "US" || !countyNames || !data) return out;
    const local: Record<string, string> = {};
    for (const [fips, nm] of Object.entries(countyNames)) if (stateOfFips(fips) === scope) local[nm] = fips;
    for (const name of Object.keys(data.regions)) { const f = matchCounty(name, local); if (f) out[name] = f; }
    return out;
  }, [scope, countyNames, data]);

  // On Point Polling party estimate for every place that reports no party. A county is one
  // part at its own 2024 lean. A state on the national map, or a county with no
  // matching shape, is its counties weighted by adults.
  // The feed's own age and race counts for an open state, when it publishes them,
  // reweight the estimate to who is actually voting.
  const [demoAdj, setDemoAdj] = useState<Partial<Record<Category, Partial<Record<"age" | "race", DemographicPayload | null>>>>>({});
  useEffect(() => {
    setDemoAdj({});
    if (scope === "US") return;
    let live = true;
    for (const c of [...new Set<Category>([...TOTAL_PARTS, ...(cat === "total" ? [] : [cat as Category])])]) {
      const m = caps?.categories?.[c]; if (!m) continue;
      for (const dd of ["age", "race"] as const) if (m[dd]) getDemographics(scope, c, dd).then((p) => {
        if (live) setDemoAdj((x) => ({ ...x, [c]: { ...(x[c] ?? {}), [dd]: p } }));
      });
    }
    return () => { live = false; };
  }, [scope, cat, caps]);
  const adjOf = (c: Category): DemoAdjust => (model && scope !== "US" ? demoAdjust(model, scope, modeOf(c), demoAdj[c] ?? {}) : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const adj: DemoAdjust = useMemo(() => (cat === "total" ? null : adjOf(cat)), [model, scope, cat, demoAdj]);

  // On Point Polling party estimate for every place that reports no party. A county is its own
  // forecast electorate. A state on the national map, or a county with no matching
  // shape, is its counties weighted by adults.
  // One feed category's estimate on one payload: the rows it reports with no party,
  // each county at its own forecast electorate, reweighted to the ages and races
  // reported for that category.
  const estFor = (c: Category, payload: CategoryPayload | null | undefined, adjC: DemoAdjust) => {
    if (!model || !payload) return null;
    const npRows = Object.entries(payload.regions ?? {}).map(([name, row]) => ({ name, row, n: sumRow(row) }))
      .filter((r) => marginOf(r.row) === null && r.n > 0);
    if (!npRows.length) return null;
    const ret = c === "returned";
    // return rate of a place: its returned ballots over the ballots it sent out
    const reqOf = (name: string) => (scope === "US" ? sumRow(natl.requested?.regions[name]) : sumRow(reqState?.regions[name]));
    const reqU = scope === "US" ? 0 : (natl.requested?.regions[scope]?.["Unspecified"]?.votes ?? 0);
    const myU = scope === "US" ? 0 : (natl[c]?.regions[scope]?.["Unspecified"]?.votes ?? 0);
    const stateRho = ret && reqU > 0 ? myU / reqU : undefined;
    const places: Place[] = npRows.map(({ name, n }) => {
      const q = ret ? reqOf(name) : 0;
      const rho = ret ? (q > 0 ? n / q : stateRho) : undefined;
      if (scope === "US") return statePlace(name, n, natlCounties[c]?.[name], countyNames, model, modeOf(c),
        ret ? { row: natl.requested?.regions[name], counties: natlCounties.requested?.[name] } : undefined).place;
      const f = fipsOf[name];
      return { key: name, st: scope, parts: f && model.mix[f] ? [[f, 1, rho] as Part] : stateParts(model, scope, rho), votes: n };
    });
    return simulate(places, model, modeOf(c), tilt, scope === "US" ? natlAdj[c] : adjC ? { [scope]: adjC } : undefined);
  };
  // the two parts of the total, estimated on every view: the tiles, side panel and electorate read them
  const estParts = useMemo(() => {
    if (!model) return null;
    return { returned: estFor("returned", parts.returned, adjOf("returned")), inperson: estFor("inperson", parts.inperson, adjOf("inperson")) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, fipsOf, scope, parts, natl, natlCounties, natlAdj, countyNames, reqState, tilt, demoAdj]);
  const est = useMemo(() => {
    if (!model || !estParts) return null;
    if (cat === "returned" || cat === "inperson") return estParts[cat];
    if (cat !== "total") return noPartyRows.length ? estFor(cat, data, adj) : null;
    const a = estParts.returned, b = estParts.inperson;
    if (!a && !b) return null;
    return { byKey: mergeEstimateMaps(a?.byKey, b?.byKey), total: mergeEstimates(a?.total, b?.total) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, estParts, noPartyRows, scope, cat, data, adj]);

  // One rated number per state, reported party plus the estimate of its Unspecified
  // ballots. The national map, table and tooltip and the state page headline all
  // read it, built from the same feed rows, county counts and reweighting.
  const viewOf1 = (c: Category, st: string, cp: CategoryPayload | null | undefined, sAdj: DemoAdjust, reqC: CategoryPayload | null | undefined,
    own?: CategoryPayload | null): StateView | null =>
    model ? stateView(st, natl[c]?.regions[st] ?? (scope === st ? own?.statewide_total : undefined), cp, countyNames, model, modeOf(c), tilt, sAdj,
      c === "returned" ? { row: natl.requested?.regions[st], counties: reqC } : undefined) : null;
  /** a state's view in the current tab; the total adds its two parts */
  const viewOf = (st: string, cpOf: (c: Category) => CategoryPayload | null | undefined, adjFor: (c: Category) => DemoAdjust,
    reqC: CategoryPayload | null | undefined): StateView | null =>
    cat === "total"
      ? mergeViews(viewOf1("returned", st, cpOf("returned"), adjFor("returned"), reqC, parts.returned),
                   viewOf1("inperson", st, cpOf("inperson"), adjFor("inperson"), reqC, parts.inperson))
      : viewOf1(cat, st, cpOf(cat), adjFor(cat), reqC, data);
  const views = useMemo(() => {
    const out: Record<string, StateView | null> = {};
    if (!model || scope !== "US" || !data) return out;
    for (const st of Object.keys(data.regions)) out[st] = viewOf(st, (c) => natlCounties[c]?.[st], (c) => natlAdj[c]?.[st] ?? null, natlCounties.requested?.[st]);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, scope, data, natl, natlCounties, natlAdj, cat, countyNames, tilt]);
  const myView = useMemo(
    () => (scope === "US" || !data ? null : viewOf(scope, (c) => (cat === "total" ? parts[c] : data), (c) => (cat === "total" ? adjOf(c) : adj), reqState)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, scope, data, parts, natl, adj, demoAdj, reqState, cat, countyNames, tilt]);
  const showEst = shade === "estimate" && !!est?.total;

  // The electorate tracker's units: every state, or every county of the open state,
  // with its mail returns and in person ballots split by party, reported plus estimated.
  const units = useMemo<ActualUnit[]>(() => {
    if (!model) return [];
    const split = (row: Record<string, { votes: number }> | undefined) => {
      let d = 0, r = 0, o = 0, u = 0;
      for (const [g, b] of Object.entries(row ?? {})) { const v = b?.votes ?? 0; if (g === "Democratic") d += v; else if (g === "Republican") r += v; else if (g === "Unspecified") u += v; else o += v; }
      return { d, r, o, u };
    };
    const fromView = (v: StateView | null | undefined, row?: Record<string, { votes: number }>): P3 & { u: number } => {
      if (v) { const n = v.d + v.r + v.o + v.u; const left = Math.max(0, v.u - v.ed - v.er - v.ei); return { d: v.d + v.ed, r: v.r + v.er, o: v.o + v.ei + left, n, u: v.u }; }
      const x = split(row); return { d: x.d, r: x.r, o: x.o + x.u, n: x.d + x.r + x.o + x.u, u: x.u };
    };
    if (scope === "US") {
      const sts = new Set([...Object.keys(natl.returned?.regions ?? {}), ...Object.keys(natl.inperson?.regions ?? {})]);
      return [...sts].map((st) => {
        const mv = viewOf1("returned", st, natlCounties.returned?.[st], natlAdj.returned?.[st] ?? null, natlCounties.requested?.[st]);
        const ev = viewOf1("inperson", st, natlCounties.inperson?.[st], natlAdj.inperson?.[st] ?? null, null);
        const mail = fromView(mv, natl.returned?.regions[st]), early = fromView(ev, natl.inperson?.regions[st]);
        const n = mail.n + early.n;
        return { key: st, label: STATE_NAME[st] ?? st, st, fips: null, mail, early, estShare: n > 0 ? (mail.u + early.u) / n : 0 };
      });
    }
    const names = new Set([...Object.keys(parts.returned?.regions ?? {}), ...Object.keys(parts.inperson?.regions ?? {})]);
    const one = (c: Category, name: string): P3 & { u: number } => {
      const x = split(parts[c]?.regions[name]);
      const e: Estimate | undefined = c === "returned" || c === "inperson" ? estParts?.[c]?.byKey[name] : undefined;
      if (e && x.u > 0) return { d: x.d + e.d * x.u, r: x.r + e.r * x.u, o: x.o + e.i * x.u, n: x.d + x.r + x.o + x.u, u: x.u };
      return { d: x.d, r: x.r, o: x.o + x.u, n: x.d + x.r + x.o + x.u, u: x.u };
    };
    return [...names].map((name) => {
      const mail = one("returned", name), early = one("inperson", name); const n = mail.n + early.n;
      return { key: name, label: name, st: scope, fips: fipsOf[name] ?? null, mail, early, estShare: n > 0 ? (mail.u + early.u) / n : 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, scope, natl, natlCounties, natlAdj, parts, estParts, fipsOf, countyNames, tilt]);

  const { E, calc, signals } = useElectorate(scope, units, model);
  const [races, setRaces] = useState<FcRace[]>([]);
  useEffect(() => { getForecastRaces().then(setRaces); }, []);
  // ballot bubbles: on for the national map, off for a state, where the county lead map names its largest counties
  const [bubblePref, setBubblePref] = useState<{ scope: string; on: boolean } | null>(null);
  const bubbles = bubblePref && bubblePref.scope === scope ? bubblePref.on : scope === "US";
  const setBubbles = (f: (b: boolean) => boolean) => setBubblePref({ scope, on: f(bubbles) });
  const natCent = useMemo(() => (geo ? Object.fromEntries(Object.entries(geo.states).map(([k, d]) => [k, centroidOf(d)])) : {}) as Record<string, [number, number] | null>, [geo]);
  const ctyCent = useMemo(() => (stateGeo ? Object.fromEntries(stateGeo.counties.map((c) => [c.id, centroidOf(c.d)])) : {}) as Record<string, [number, number] | null>, [stateGeo]);

  const fillRow = (key: string, row: RegionRow) => {
    const m = marginFor(key, row);
    if (m !== null) return leadFill(m, sumRow(row));
    const e = est?.byKey[key];
    if (showEst && e) return leadFill(e.margin, sumRow(row));
    return vol ? turnoutFill(vol.t(sumRow(row))) : "var(--ev-nodata)";
  };
  /** the margin a place is rated on: reported party, else the On Point Polling estimate when it is shown */
  // In the total a county can report party on one part and not the other, so its
  // margin is the reported ballots plus the estimate of the rest, over all of them.
  const mixed = (key: string, row: RegionRow) => {
    const e = est?.byKey[key]; if (!e) return null;
    let d = 0, r = 0, n = 0;
    for (const [g, b] of Object.entries(row)) { const v = b?.votes ?? 0; n += v; if (g === "Democratic") d += v; else if (g === "Republican") r += v; }
    return n > 0 ? { m: ((r + e.r * e.votes - d - e.d * e.votes) / n) * 100, share: e.votes / n } : null;
  };
  const marginFor = (key: string, row: RegionRow): number | null => {
    if (scope === "US" && showEst && views[key]) return views[key]!.margin;
    if (cat === "total" && showEst) { const x = mixed(key, row); if (x) return x.m; }
    const m = marginOf(row);
    if (m !== null) return m;
    const e = est?.byKey[key];
    return showEst && e ? e.margin : null;
  };
  const hatched = (key: string, row: RegionRow) => showEst && (scope === "US"
    ? (views[key]?.estShare ?? 0) >= 0.5
    : cat === "total" ? (mixed(key, row)?.share ?? 0) >= 0.5
    : marginOf(row) === null && !!est?.byKey[key]);

  const national = scope === "US";
  const catMeta = VIEWS.find((c) => c.key === cat)!;
  const placeName = national ? "the country" : STATE_NAME[scope] ?? scope;

  // ── dashboard numbers ──
  const expScope = E ? (national ? E.nation : E.states[scope]) : null;
  const exp = expScope ? { total: expScope.turnout, mail: expScope.modes.mail, early: expScope.modes.early } : null;
  const mailN = national ? sumRow(natl.returned?.statewide_total) : sumRow(parts.returned?.statewide_total);
  const inN = national ? sumRow(natl.inperson?.statewide_total) : sumRow(parts.inperson?.statewide_total);
  const reqN = national ? sumRow(natl.requested?.statewide_total) : sumRow(natl.requested?.regions[scope]) || sumRow(reqState?.statewide_total);
  const party = useMemo(() => {
    let d = 0, r = 0, o = 0, n = 0, est = 0;
    for (const u of units) {
      d += u.mail.d + u.early.d; r += u.mail.r + u.early.r; o += u.mail.o + u.early.o;
      const nn = u.mail.n + u.early.n; n += nn; est += u.estShare * nn;
    }
    return { d, r, o, n, reported: n > 0 ? 1 - est / n : 0 };
  }, [units]);
  // what a place is expected to cast in all, for the remaining ballots view
  const expOfPlace = (key: string): number | null => {
    if (!E) return null;
    if (national) return E.states[key]?.turnout ?? null;
    const f = fipsOf[key];
    return f && E.counties[f] ? E.counties[f][0] : null;
  };
  const paceOf = (key: string, n: number) => { const e = expOfPlace(key); return e && e > 0 ? n / e : null; };
  const bubbleVal = (key: string, n: number) => (view === "remaining" ? Math.max(0, (expOfPlace(key) ?? 0) - n) : n);
  const bubbleMax = Math.max(1, ...rows.map((r) => bubbleVal(r.name, r.n)));
  const MAP_TABS: { k: DashView; label: string }[] = [
    { k: "total", label: "Total" }, { k: "inperson", label: "Early in person" }, { k: "returned", label: "Mail returns" },
    { k: "remaining", label: "Remaining ballots" }, { k: "requested", label: "Requests" },
  ];

  return (
    <div className="opp ev-page">
      <style>{CSS + ELECTORATE_CSS + DASH_CSS + ADJ_CSS + PACE_CSS}</style>

      <div className="ev-shell">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span className="sep">/</span><Link href="/maps">Maps</Link><span className="sep">/</span>
          {national ? <span>Early vote</span> : <><button className="ev-link ev-crumbstate" onClick={() => setScope("US")}>Early vote</button><span className="sep">/</span><span>{STATE_NAME[scope] ?? scope}</span></>}
        </nav>
        <header className="ph ev-ph">
          <div className="eye g">{national ? "Nationwide early vote" : "Early vote by county"}</div>
          <h1>{national ? <>2026 early vote <em>tracker</em></> : <>{STATE_NAME[scope] ?? scope} early vote <em>tracker</em></>}</h1>
          <div className="pmeta">
            <span>General election <b>November 3, 2026</b></span>
            {data?.snapshot_date ? <span>Snapshot <b>{data.snapshot_date}</b></span> : null}
            <span>Modeled by <b>On Point Polling</b> where states report no party or demographics</span>
            {!national ? <button className="ev-link" onClick={() => setScope("US")}>Back to all states</button> : <span>Click a state for its counties</span>}
          </div>
        </header>
        {lede && scope === initialScope ? lede : null}

        <PaceCompare scope={scope} ret={natl.returned} inp={natl.inperson}
          snapshot={natl.returned?.snapshot_date ?? natl.inperson?.snapshot_date ?? data?.snapshot_date}
          onOpen={(k) => { setScope(k); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

        <KpiStrip view={view} setView={setView} mail={mailN} inperson={inN} requested={reqN} exp={exp} />
        <TopCards scope={scope} E={E} calc={calc} races={races} reportedShare={party.reported} cast={mailN + inN} expTotal={exp?.total ?? 0} />

        {loading ? (
          <div className="ev-empty">Reading the early vote feed</div>
        ) : !data || !Object.keys(data.regions ?? {}).length ? (
          <div className="ev-empty">
            No {catMeta.blurb} published for {national ? "any state" : (STATE_NAME[scope] ?? scope)} yet.
            {" "}States report on their own schedule, so this fills in as they do.
          </div>
        ) : (
          <div className="db-main">
            <section className="db-mapcard ev-mapwrap">
              <div className="db-maptools">
                <button className={`db-tool${bubbles ? " on" : ""}`} onClick={() => setBubbles((b) => !b)} aria-pressed={bubbles}>Ballot bubbles</button>
                {someNoParty && view !== "remaining" ? (
                  <button className="db-tool" onClick={() => setShade(shade === "estimate" ? "turnout" : "estimate")}>{shade === "estimate" ? "Show volume" : "Show estimate"}</button>
                ) : null}
              </div>
              {national && geo ? (
                <svg viewBox={`0 0 ${geo.frame[0]} ${geo.frame[1]}`} className="ev-map" role="img"
                     aria-label="Early vote by state">
                  <HatchDefs />
                  {Object.entries(geo.states).map(([abbr, d]) => {
                    const row = data.regions[abbr];
                    return (
                      <path key={abbr} d={d}
                        className={`ev-unit${row ? " live" : ""}`}
                        style={{ fill: row ? (view === "remaining" ? paceFill(paceOf(abbr, sumRow(row))) : fillRow(abbr, row)) : "var(--ev-idle)" }}
                        onClick={row ? () => setScope(abbr) : undefined}
                        onMouseMove={row ? (e) => setTip({ key: abbr, x: e.clientX, y: e.clientY }) : undefined}
                        onMouseLeave={() => setTip(null)} />
                    );
                  })}
                  {Object.entries(geo.states).map(([abbr, d]) => {
                    const row = data.regions[abbr];
                    return row && hatched(abbr, row) && view !== "remaining"
                      ? <path key={`h-${abbr}`} d={d} className="ev-hatch" fill="url(#ev-hatch)" /> : null;
                  })}
                  {bubbles ? Object.keys(geo.states).map((abbr) => {
                    const row = data.regions[abbr]; const c = natCent[abbr];
                    if (!row || !c) return null;
                    const v = bubbleVal(abbr, sumRow(row)); if (v <= 0) return null;
                    return <circle key={`b-${abbr}`} cx={c[0]} cy={c[1]} r={Math.max(1.8, 26 * Math.sqrt(v / bubbleMax))} className={`db-bub${view === "remaining" ? " rem" : ""}`} />;
                  }) : null}
                </svg>
              ) : !national && stateGeo && countyNames ? (
                (() => {
                  // resolve each county the feed reports onto a shape
                  const byFips: Record<string, string> = {};
                  for (const [name, f] of Object.entries(fipsOf)) byFips[f] = name;
                  const matched = Object.keys(byFips).length;
                  return (
                    <>
                      <svg viewBox="0 0 900 620" className="ev-map" role="img"
                           aria-label={`Early vote by county in ${STATE_NAME[scope] ?? scope}`}>
                        <HatchDefs />
                        {stateGeo.counties.map((c) => {
                          const name = byFips[c.id];
                          const row = name ? data.regions[name] : undefined;
                          return (
                            <path key={c.id} d={c.d}
                              className={`ev-unit${row ? " live" : ""}`}
                              style={{ fill: row ? (view === "remaining" ? paceFill(paceOf(name!, sumRow(row))) : fillRow(name!, row)) : "var(--ev-idle)" }}
                              onMouseMove={row ? (e) => setTip({ key: name!, x: e.clientX, y: e.clientY }) : undefined}
                              onMouseLeave={() => setTip(null)} />
                          );
                        })}
                        {stateGeo.counties.map((c) => {
                          const name = byFips[c.id];
                          const row = name ? data.regions[name] : undefined;
                          return row && hatched(name!, row) && view !== "remaining"
                            ? <path key={`h-${c.id}`} d={c.d} className="ev-hatch" fill="url(#ev-hatch)" /> : null;
                        })}
                        {bubbles ? stateGeo.counties.map((c) => {
                          const name = byFips[c.id]; const row = name ? data.regions[name] : undefined; const ct = ctyCent[c.id];
                          if (!row || !ct) return null;
                          const v = bubbleVal(name!, sumRow(row)); if (v <= 0) return null;
                          return <circle key={`b-${c.id}`} cx={ct[0]} cy={ct[1]} r={Math.max(1.4, 22 * Math.sqrt(v / bubbleMax))} className={`db-bub${view === "remaining" ? " rem" : ""}`} />;
                        }) : null}
                        {!bubbles ? (() => {
                          // the counties casting the most ballots are named on the map
                          const top = stateGeo.counties.map((c) => ({ c, name: byFips[c.id], n: byFips[c.id] ? sumRow(data.regions[byFips[c.id]]) : 0 }))
                            .filter((x) => x.n > 0 && ctyCent[x.c.id]).sort((a, b) => b.n - a.n).slice(0, 10);
                          return top.map(({ c, name }) => {
                            const ct = ctyCent[c.id]!;
                            return <text key={`l-${c.id}`} x={ct[0]} y={ct[1]} dy="0.32em" textAnchor="middle" className="db-clab">{name.replace(/ (County|Parish|city)$/i, "")}</text>;
                          });
                        })() : null}
                      </svg>
                      {matched < Object.keys(data.regions).length ? (
                        <p className="ev-mapnote">
                          {Object.keys(data.regions).length - matched} reported{" "}
                          {Object.keys(data.regions).length - matched === 1 ? "area has" : "areas have"} no
                          matching shape and appear only in the table below.
                        </p>
                      ) : null}
                    </>
                  );
                })()
              ) : (
                <div className="ev-maploading"><span /> drawing the map…</div>
              )}
              {view === "remaining" ? (
                <div className="ev-legend"><span className="ev-cap">Share of the expected vote cast</span>
                  <div className="ev-leg-row">{[0, 0.25, 0.5, 0.75, 1].map((t) => <span key={t} className="ev-leg"><i style={{ background: paceFill(t) }} />{Math.round(t * 100)}%</span>)}</div>
                  <span className="ev-leg-note">bubbles are the ballots still expected, early and on Election Day</span></div>
              ) : !allNoParty || showEst ? (
                <div className="db-leadleg">
                  <b>R lead</b>
                  <span>
                    <span className="ramp" style={{ display: "block", background: `linear-gradient(90deg, ${leadFill(40)}, ${leadFill(20)}, ${leadFill(0.01)}, ${leadFill(-20)}, ${leadFill(-40)})` }} />
                    <span className="ends"><span>R+40</span><span>even</span><span>D+40</span></span>
                  </span>
                  <b>D lead</b>
                  <span><i className="sw" style={{ background: "var(--lead-low)" }} />under 20 ballots</span>
                  {showEst ? <span><i className="sw" style={{ background: "repeating-linear-gradient(45deg, var(--mute) 0 2px, transparent 2px 5px)" }} />On Point Polling party estimate</span> : null}
                  <span>{national ? "registered party of the ballots cast, by state" : "registered party of the ballots cast, by county"}{!national ? " · turn off bubbles to name the largest counties" : ""}</span>
                </div>
              ) : null}
              {someNoParty && vol && !showEst && view !== "remaining" ? (
                <div className="ev-scale turnout">
                  {!allNoParty ? <em className="lab">no party reported</em> : null}
                  <span>Fewer ballots</span>
                  <span className="tramp-wrap">
                    <i className="ramp tramp" />
                    <span className="ticks">
                      <b>{compact(vol.min)}</b>
                      <b>{compact(Math.sqrt(vol.min * vol.max))}</b>
                      <b>{compact(vol.max)}</b>
                    </span>
                  </span>
                  <span>More ballots</span>
                </div>
              ) : null}
              {view === "remaining" ? null : showEst ? (
                <p className="ev-mapnote">
                  {allNoParty
                    ? `${national ? "None of the reporting states attach" : `${STATE_NAME[scope] ?? scope} does not attach`} a party to these ballots. `
                    : `${noPartyRows.length} ${national ? (noPartyRows.length === 1 ? "state reports" : "states report") : (noPartyRows.length === 1 ? "county reports" : "counties report")} no party. `}
                  Hatched {national ? "states" : "counties"} are shaded by the On Point Polling party estimate, simulated from
                  the forecast&apos;s 2026 electorate and On Point Polling polling on how each kind of voter casts a ballot.
                </p>
              ) : allNoParty ? (
                <p className="ev-mapnote">
                  {national ? "None of the reporting states attach" : `${STATE_NAME[scope] ?? scope} does not attach`} a
                  party to these ballots, so {national ? "states" : "counties"} are shaded by raw ballot count
                  instead: the deeper the green, the more ballots, on a log scale.
                </p>
              ) : someNoParty ? (
                <p className="ev-mapnote">
                  {noPartyRows.length} {national
                    ? (noPartyRows.length === 1 ? "state reports" : "states report")
                    : (noPartyRows.length === 1 ? "county reports" : "counties report")} no party,
                  so {noPartyRows.length === 1 ? "it is" : "they are"} shaded green by raw ballot count on a log scale.
                </p>
              ) : null}
              <div className="db-tabs">
                <div className="ev-seg" role="tablist" aria-label="Map view">
                  {MAP_TABS.map((t) => (
                    <button key={t.k} role="tab" aria-selected={view === t.k} className={view === t.k ? "on" : ""} onClick={() => setView(t.k)}>{t.label}</button>
                  ))}
                </div>
              </div>
            </section>
            <SidePanels scope={scope} view={view} E={E} calc={calc} model={model} caps={caps} units={units} party={party} snapshot={data.snapshot_date} />
          </div>
        )}

        {data && !loading ? <AdjustedForecast scope={scope} signals={signals} calc={calc} geo={geo} stateGeo={stateGeo}
          onOpen={(k) => { setScope(k); setTimeout(() => document.getElementById("ev-adj")?.scrollIntoView({ behavior: "smooth", block: "start" }), 400); }} /> : null}

        {data && !loading ? <Electorate scope={scope} E={E} calc={calc} model={model} snapshot={data.snapshot_date} onOpen={(k) => setScope(k)} /> : null}

        <details className="db-more">
          <summary>Every breakdown {national ? "the states publish" : `${STATE_NAME[scope] ?? scope} publishes`}</summary>
          <EarlyDemographics scope={scope} cat={cat} caps={caps} model={model} catLabel={catMeta.blurb} />
        </details>
        {data && !loading && (national || (someNoParty && est?.total)) ? (
          <details className="db-more">
            <summary>The party estimate, and how it is made</summary>
            {national && model ? <NationalCombined combined={combined} loaded={natlAll} cat={cat} setCat={setCat} tilt={tilt} /> : null}
            {someNoParty && est?.total ? (
              <EstimatePanel e={est.total} sub={national
                ? `Across the ${noPartyRows.length} ${noPartyRows.length === 1 ? "state that reports" : "states that report"} every ballot as Unspecified.`
                : allNoParty ? `${STATE_NAME[scope] ?? scope} reports every ballot as Unspecified.`
                : `Across the ${noPartyRows.length} ${noPartyRows.length === 1 ? "county that reports" : "counties that report"} every ballot as Unspecified.`}
                mode={cat === "total" ? "returned" : modeOf(cat)} model={model!} tilt={tilt} shade={shade} setShade={setShade}
                st={national ? null : scope} adj={national ? null : adj} />
            ) : null}
            <RatingBoard places={rows.map(({ name, row, n }) => ({ m: marginFor(name, row), n, est: hatched(name, row) }))}
              unit={national ? "state" : "county"} />
          </details>
        ) : null}
        {data && !loading ? (
          <details className="db-more">
            <summary>The feed, {national ? "state by state" : "county by county"}, for {placeName}</summary>
            <section className="ev-tablewrap">
              <div className="ev-tablehead">
                <h2 className="ev-h2">{national ? "by state" : "by county"}</h2>
                <button className="ev-sort" onClick={() => setSortDesc((v) => !v)}>
                  {sortDesc ? "sorted by volume" : "sorted by name"}
                </button>
              </div>
              <div className="ev-scroll">
                <table className="ev-table">
                  <thead>
                    <tr>
                      <th>{national ? "State" : "County"}</th>
                      {groups.map((g) => <th key={g} className="num">{g}</th>)}
                      <th className="num">Total</th>
                      {showEst ? <>
                        <th className="num est">Est. Dem</th><th className="num est">Est. Rep</th>
                        <th className="num est">Est. Ind</th><th className="num est">Est. margin</th>
                      </> : null}
                      {!allNoParty || showEst ? <th>Rating</th> : null}
                      <th className="split">{showEst ? "Split" : allNoParty ? "Intensity" : "Split"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ name, row, n }) => (
                      <tr key={name}
                          className={national ? "clickable" : undefined}
                          tabIndex={national ? 0 : undefined}
                          onClick={national ? () => setScope(name) : undefined}
                          onKeyDown={national ? (e) => { if (e.key === "Enter") setScope(name); } : undefined}>
                        <td className="name">{national ? (STATE_NAME[name] ?? name) : name}</td>
                        {groups.map((g) => (
                          <td key={g} className="num">{row[g]?.votes ? commas(row[g].votes) : "—"}</td>
                        ))}
                        <td className="num tot">{commas(n)}</td>
                        {showEst ? (() => {
                          const e = marginOf(row) === null || cat === "total" ? est?.byKey[name] : undefined;
                          if (!e) return <><td className="num">—</td><td className="num">—</td><td className="num">—</td><td className="num">—</td></>;
                          return <>
                            <td className="num est">{commas(e.d * e.votes)}</td>
                            <td className="num est">{commas(e.r * e.votes)}</td>
                            <td className="num est">{commas(e.i * e.votes)}</td>
                            <td className="num est mg" style={{ color: e.margin > 0 ? "var(--gop)" : "var(--dem)" }}>{fmtMargin(e.margin)}</td>
                          </>;
                        })() : null}
                        {!allNoParty || showEst ? (() => {
                          const mm = marginFor(name, row);
                          if (mm === null) return <td className="rt">—</td>;
                          const r = ratingOf(mm);
                          return <td className="rt"><span className={`ev-chip${hatched(name, row) ? " est" : ""}`}>
                            <i style={{ background: r.color }} />{r.label}</span></td>;
                        })() : null}
                        <td className="split">
                          {showEst && est?.byKey[name] && marginOf(row) === null ? (
                            <EstBar e={est.byKey[name]} />
                          ) : marginOf(row) === null && vol ? (
                            <span className="ev-bar vol" aria-hidden>
                              <i style={{ width: `${Math.max(4, vol.t(n) * 100)}%`, background: turnoutFill(vol.t(n)) }} />
                            </span>
                          ) : <Bar row={row} groups={groups} total={n} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </details>
        ) : null}

        {tip && data && data.regions[tip.key] ? (() => {
          const row = data.regions[tip.key];
          const t = sumRow(row);
          const m = marginOf(row);
          const sv = national && showEst ? views[tip.key] : null;
          const label = national ? (STATE_NAME[tip.key] ?? tip.key) : tip.key;
          return (
            <TipBox x={tip.x} y={tip.y}>
              <div className="n">{label}</div>
              {(() => {
                const mm = marginFor(tip.key, row);
                if (mm === null) return <div className="s">{catMeta.blurb}</div>;
                const r = ratingOf(mm);
                return (
                  <div className="s rated">
                    <span className="pill" style={{ background: r.color, color: r.rating === "SAFE" || r.rating === "LIKELY" ? "#fff" : "#111" }}>{r.label}</span>
                    {sv && sv.u > 0 ? (sv.d + sv.r > 0 ? "reported plus On Point Polling estimate · " : "On Point Polling estimate · ") : m === null ? "On Point Polling estimate · " : ""}{catMeta.blurb}
                  </div>
                );
              })()}
              {orderGroups(Object.keys(row)).map((g) => {
                const v = row[g]?.votes ?? 0;
                if (v <= 0) return null;
                return (
                  <div key={g} className="row">
                    <i style={{ background: toneFor(g, row[g]?.color) }} />
                    <b>{g}</b><span>{commas(v)}</span><u>{pct(v, t)}</u>
                  </div>
                );
              })}
              <div className="row tot"><i /><b>total</b><span>{commas(t)}</span>
                <u>{m === null ? "—" : m > 0 ? `R+${m.toFixed(1)}` : `D+${Math.abs(m).toFixed(1)}`}</u></div>
              {sv && sv.u > 0 && sv.d + sv.r > 0 ? (
                <div className="row tot"><i /><b>with estimate</b><span>{fmtMargin(sv.margin)}</span>
                  <u>{fmtRange(sv.lo, sv.hi)}</u></div>
              ) : null}
              {m === null && showEst && est?.byKey[tip.key] ? (() => {
                const e = est.byKey[tip.key];
                return (
                  <>
                    <div className="est-h">On Point Polling estimate</div>
                    {([["Democratic", e.d, "var(--dem)"], ["Republican", e.r, "var(--gop)"], ["Independent", e.i, "var(--muted2)"]] as const).map(([g, s, c]) => (
                      <div key={g} className="row"><i style={{ background: c }} /><b>{g}</b>
                        <span>{commas(s * t)}</span><u>{(s * 100).toFixed(1)}%</u></div>
                    ))}
                    <div className="row tot"><i /><b>est. margin</b><span>{fmtMargin(e.margin)}</span>
                      <u>{fmtRange(e.lo, e.hi)}</u></div>
                  </>
                );
              })() : null}
              {m === null ? (() => {
                const share = total > 0 ? (t / total) * 100 : 0;
                const rank = noPartyRows.findIndex((r) => r.name === tip.key);
                const byVol = [...noPartyRows].sort((x, y) => y.n - x.n).findIndex((r) => r.name === tip.key) + 1;
                return (
                  <div className="row vol"><i style={{ background: vol ? turnoutFill(vol.t(t)) : "var(--ev-nodata)" }} />
                    <b>{rank >= 0 ? `rank #${byVol} of ${noPartyRows.length}` : "ballot volume"}</b>
                    <span>{share < 1 ? share.toFixed(2) : share.toFixed(1)}%</span><u>of {national ? "all" : "state"}</u></div>
                );
              })() : null}
              {national ? <div className="f">click to open counties</div> : null}
            </TipBox>
          );
        })() : null}
        <p className="ev-note">
          Early vote figures come from <a href="https://civicapi.org/early-vote/" target="_blank" rel="noreferrer">civicAPI</a>,
          which collects them from state election authorities. Each state reports on its own
          schedule and publishes different breakdowns, so a category with no rows means that
          state has not posted it, not that the number is zero. Groups labelled Unspecified are
          ballots a state reports without a party or demographic attached.
        </p>
        {after && scope === initialScope ? after : null}
      </div>
    </div>
  );
}

const CSS = `
/* Dark only, on the On Point Politics tokens: glass cards, Sora, Manrope and
   JetBrains Mono, the brand rating ramp for party margins. */
.ev-page { position: relative; color: var(--ink); }
.ev-shell { padding-bottom: 40px; }
.ev-crumbstate { color: var(--ink2); }

.ev-eyebrow { display: inline-flex; align-items: center; gap: 9px; margin-top: clamp(26px,5vh,56px);
  font-family: ${MONO}; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted2); }
.ev-eyebrow .dot { width: 7px; height: 7px; border-radius: 99px; background: var(--gop); animation: evPulse 2.4s ease-in-out infinite; }
.ev-eyebrow em { font-style: normal; color: var(--muted3); }
@keyframes evPulse { 0%,100%{opacity:1} 50%{opacity:.3} }

.ev-h1 { margin-top: 16px; font-family: var(--font-display); font-size: clamp(32px,4.6vw,56px); font-weight: 500;
  letter-spacing: -0.035em; line-height: 1.06; }
.ev-lede { margin: 0; }
.ev-link { background: none; border: 0; padding: 0; cursor: pointer; font: inherit; color: var(--accent-link); text-decoration: underline; text-underline-offset: 3px; }

.ev-controls { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
.ev-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px; background: rgba(var(--line-rgb),0.06); }
.ev-seg button { appearance: none; border: 0; background: none; cursor: pointer; padding: 7px 14px; border-radius: 999px;
  font: 700 12px var(--font-b); color: var(--mute);
  transition: color .15s ease, background .15s ease; }
.ev-seg button:hover { color: var(--ink); }
.ev-seg button.on { background: var(--hi); color: var(--bg); }
.ev-seg.sm button { padding: 5px 11px; font-size: 11.5px; }
.ev-seg button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

.ev-empty { margin-top: 18px; padding: 28px 22px; border: 1px solid var(--line); border-radius: var(--r); background: var(--glass);
  color: var(--mute); font-size: 14.5px; line-height: 1.6; }
.ev-empty .spin { display: none; }

.ev-top { margin-top: 18px; padding: 20px 22px; border: 1px solid var(--line); border-radius: var(--r); background: var(--glass); }
.ev-top-n { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 16px; }
.ev-top-n em { font-style: normal; font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted2); }
.ev-top-n b { font-family: var(--font-d); font-size: clamp(30px,4vw,44px); font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.ev-top-n span { margin-left: auto; font-family: ${MONO}; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted2); }
.ev-top-split { margin-top: 16px; }
.ev-stview { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; margin-top: 14px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--glass, rgba(var(--line-rgb),.03)); font-size: 13px; color: var(--muted); }
.ev-stview .pill { display: inline-block; padding: 3px 9px; border-radius: 99px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.ev-stview b { font-family: ${MONO}; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.ev-key { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 14px; font-size: 13px; color: var(--muted); }
.ev-key span { display: inline-flex; align-items: center; gap: 7px; }
.ev-key i { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.ev-key b { font-family: ${MONO}; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.ev-key u { text-decoration: none; font-family: ${MONO}; font-size: 11.5px; color: var(--muted2); }

.ev-page { --ev-idle: rgba(var(--line-rgb),0.07); --ev-nodata: rgba(var(--line-rgb),0.16); --ev-mid: rgba(var(--line-rgb),0.06); --ev-turnout: var(--ink2); }
.ev-mapwrap { position: relative; margin-top: 30px; }
.ev-map { display: block; width: 100%; height: auto; max-height: 66svh; margin: 0 auto; }
.ev-unit { stroke: var(--bg); stroke-width: 0.7; stroke-linejoin: round; transition: filter .12s ease; }
.ev-unit.live { cursor: pointer; }
.ev-unit.live:hover { filter: brightness(1.12) saturate(1.16); stroke: var(--ink); stroke-width: 1.4; }

/* legend: the electoral map's chips */
.ev-legend { display: flex; align-items: center; justify-content: center; gap: 10px 16px; flex-wrap: wrap; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); }
.ev-cap { font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink); }
.ev-leg-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; }
.ev-leg { display: inline-flex; align-items: center; gap: 7px; font-family: ${MONO}; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.ev-leg i { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
.ev-leg i.hatch { background: repeating-linear-gradient(45deg, var(--muted2) 0 2px, transparent 2px 5px); border: 1px solid var(--border2); }
.ev-leg-note { width: 100%; text-align: center; font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted3); }

/* rating board: the electoral map's seat bar, sized by ballots */
.ev-board { margin-bottom: 18px; }
.ev-board-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
.ev-board-side { display: flex; flex-direction: column; gap: 2px; }
.ev-board-side.r { text-align: right; align-items: flex-end; }
.ev-board-side b { font-family: ${MONO}; font-size: clamp(24px, 3vw, 34px); font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1; }
.ev-board-side span { font-size: 12px; color: var(--muted2); max-width: 46ch; }
.ev-board-bar { position: relative; display: flex; height: 22px; margin-top: 10px; border-radius: 6px; overflow: hidden; background: rgba(var(--line-rgb),0.08); }
.ev-board-bar i { display: block; height: 100%; box-shadow: inset -1px 0 0 var(--bg); }
.ev-board-bar u { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: var(--ink); opacity: 0.7; }
.ev-board-keys { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; font-family: ${MONO}; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.ev-board-keys span { display: inline-flex; align-items: center; gap: 6px; }
.ev-board-keys i { width: 10px; height: 10px; border-radius: 3px; }
.ev-board-keys b { color: var(--ink); font-weight: 700; }
.ev-board-keys .note { color: var(--muted3); }

/* rating chip in the table and pill in the tooltip */
.ev-chip { display: inline-flex; align-items: center; gap: 6px; font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.03em; color: var(--ink); white-space: nowrap; }
.ev-chip i { width: 10px; height: 10px; border-radius: 3px; }
.ev-chip.est { font-style: italic; }
table.ev-table td.rt { white-space: nowrap; }
.ev-tip .s.rated { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-top: 5px; }
.ev-tip .pill { display: inline-block; padding: 2px 7px; border-radius: 99px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; }
.ev-maploading { padding: 70px 0; text-align: center; font-family: ${MONO}; font-size: 11px;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted2); }
.ev-maploading span { display: inline-block; width: 9px; height: 9px; margin-right: 10px; border-radius: 99px; background: var(--accent-link); }
.ev-mapnote { margin-top: 8px; text-align: center; font-size: 12px; color: var(--muted2); }
.ev-scale { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 16px; margin-top: 14px;
  font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted2); }
.ev-scale .ramp { width: min(320px, 46vw); height: 10px; border-radius: 99px;
  background: linear-gradient(90deg,#1a3fb0 0%,#3d7bff 25%,#d6e2ff 48%,#ffdce4 52%,#ff3b5c 75%,#b0163a 100%); border: 1px solid var(--line2); }
.ev-scale em { font-style: normal; display: inline-flex; align-items: center; gap: 7px; }
.ev-scale .sw { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.ev-scale .sw.nodata { background: var(--ev-nodata); }
.ev-scale.turnout { margin-top: 10px; }
.ev-scale .lab { color: var(--ink); }
.ev-scale .tramp-wrap { display: inline-flex; flex-direction: column; gap: 5px; }
.ev-scale .tramp { background: linear-gradient(90deg,
  color-mix(in srgb, var(--ev-turnout) 14%, var(--ev-mid)),
  color-mix(in srgb, var(--ev-turnout) 52%, var(--ev-mid)),
  color-mix(in srgb, var(--ev-turnout) 90%, var(--ev-mid))); }
.ev-scale .ticks { display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; color: var(--muted); letter-spacing: 0.04em; }
.ev-scale .ticks b { font-weight: 700; }
.ev-tip .row.vol { margin-top: 5px; }
.ev-tip .row.vol b { color: var(--muted2); font-family: ${MONO}; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }

.ev-tip { position: fixed; z-index: 70; pointer-events: none; width: 252px; padding: 12px 14px; border-radius: 12px;
  background: rgba(var(--bg2-rgb),.96); border: 1px solid var(--line2); box-shadow: 0 12px 40px rgba(0,0,0,.5); backdrop-filter: blur(10px); }
.ev-tip .n { font-family: var(--font-d); font-size: 14px; font-weight: 700; letter-spacing: -0.01em; color: var(--hi); }
.ev-tip .s { margin-top: 2px; font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted2); }
.ev-tip .row { display: flex; align-items: center; gap: 8px; margin-top: 7px; font-size: 12.5px; }
.ev-tip .row i { width: 3px; height: 14px; flex-shrink: 0; }
.ev-tip .row b { font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
.ev-tip .row span { font-family: ${MONO}; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ink); }
.ev-tip .row u { text-decoration: none; font-family: ${MONO}; font-size: 10.5px; color: var(--muted2); min-width: 46px; text-align: right; }
.ev-tip .row.tot { margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--border); }
.ev-tip .row.tot b { color: var(--muted2); font-family: ${MONO}; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
.ev-tip .f { margin-top: 9px; font-family: ${MONO}; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted3); }

.ev-bar { display: flex; height: 9px; border-radius: 99px; overflow: hidden; background: rgba(var(--line-rgb),0.07); }
.ev-bar i { display: block; height: 100%; }

.ev-h2 { font-family: var(--font-d); font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--hi); }


.ev-tablewrap { margin-top: 38px; }
.ev-tablehead { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; }
.ev-sort { background: none; border: 1px solid var(--border2); border-radius: 999px; padding: 6px 13px; cursor: pointer;
  font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted2); }
.ev-sort:hover { color: var(--ink); border-color: var(--border3); }
.ev-scroll { margin-top: 14px; overflow-x: auto; border: 1px solid var(--line); border-radius: var(--r); background: var(--glass); }
table.ev-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
table.ev-table th { position: sticky; top: 0; z-index: 1; background: var(--bg2); text-align: left; padding: 13px 14px;
  font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--muted2); border-bottom: 1px solid var(--border2); white-space: nowrap; }
table.ev-table th.num, table.ev-table td.num { text-align: right; }
table.ev-table th.split { width: 130px; }
table.ev-table td { padding: 11px 14px; border-top: 1px solid var(--border); color: var(--muted); white-space: nowrap; }
table.ev-table td.name { color: var(--ink); font-weight: 600; }
table.ev-table td.tot { color: var(--ink); font-weight: 700; }
table.ev-table tr.clickable { cursor: pointer; }
table.ev-table tr.clickable:hover td { background: rgba(var(--line-rgb),0.04); }
table.ev-table tr.clickable:focus-visible { outline: 2px solid var(--gold); outline-offset: -2px; }
table.ev-table td.split { min-width: 120px; }

.ev-hatch { pointer-events: none; }
.ev-hatch-line { stroke: var(--hi); stroke-width: 1; stroke-opacity: 0.55; }
.ev-hatch-line.dark { stroke: #000000; stroke-opacity: 0.22; }
.ev-scale .sw.hatch { background: repeating-linear-gradient(45deg, var(--muted2) 0 2px, transparent 2px 5px); border: 1px solid var(--border2); }

.ev-est { margin-top: 18px; padding: 20px 24px 18px; border: 1px dashed var(--border3, var(--border2)); border-radius: 16px;
  background: rgba(var(--line-rgb),0.025); }
.ev-est-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px; }
.ev-est-tag { display: inline-block; margin-bottom: 8px; padding: 3px 9px; border-radius: 99px; border: 1px solid var(--border2);
  font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); }
.ev-est-sub { margin-top: 5px; font-size: 13px; color: var(--muted); }
.ev-est-body { display: grid; grid-template-columns: minmax(180px, 0.8fr) 2fr; gap: 18px 28px; align-items: center; margin-top: 16px; }
.ev-est-margin b { display: block; font-family: ${MONO}; font-size: clamp(28px,3.6vw,40px); font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.ev-est-margin span { display: block; margin-top: 4px; font-size: 12.5px; line-height: 1.45; color: var(--muted2); max-width: 30ch; }
.ev-est-more { margin-top: 14px; font-size: 13px; }
.ev-est-method { margin-top: 12px; display: grid; gap: 10px; max-width: 80ch; font-size: 13px; line-height: 1.6; color: var(--muted); }
.ev-est-check { margin-top: 6px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--glass); overflow-x: auto; }
.ev-est-check em { font-style: normal; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted2); }
.ev-est-check table { margin-top: 8px; border-collapse: collapse; font-size: 12.5px; font-variant-numeric: tabular-nums; min-width: 420px; }
.ev-est-check th { text-align: left; padding: 6px 12px 6px 0; font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted2); font-weight: 700; }
.ev-est-check td { padding: 5px 12px 5px 0; border-top: 1px solid var(--border); color: var(--ink); }
.ev-est-check .num { text-align: right; }
.ev-est-check p { margin-top: 10px; font-size: 12.5px; }
table.ev-table th.est { color: var(--ink); }
table.ev-table td.est { font-style: italic; }
table.ev-table td.mg { font-style: normal; font-family: ${MONO}; font-weight: 700; font-size: 12px; }
/* the tooltip is portalled to body, outside .ev-page, so it carries the map tokens its swatches use */
.ev-tip { width: 284px; z-index: 90; --ev-nodata: rgba(var(--line-rgb),0.16); --ev-mid: rgba(var(--line-rgb),0.06); --ev-turnout: var(--ink2); }
.ev-tip .est-h { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border2); font-family: ${MONO}; font-size: 9.5px;
  font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink); }
.ev-tip .row.tot u { min-width: 0; white-space: nowrap; }
@media (max-width: 760px) { .ev-est-body { grid-template-columns: 1fr; } }

.ev-nat { margin-top: 18px; }
.ev-nat-head p { margin-top: 6px; max-width: 78ch; font-size: 13px; line-height: 1.55; color: var(--muted); }
.ev-nat-grid { margin-top: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.ev-nat-card { appearance: none; text-align: left; font: inherit; color: inherit; cursor: pointer;
  display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border-radius: 14px;
  border: 1px solid var(--line); background: var(--glass); transition: border-color .15s ease, background .15s ease; }
.ev-nat-card:hover { border-color: var(--border3, var(--border2)); }
.ev-nat-card.on { border-color: var(--hi); background: var(--glass2); }
.ev-nat-card:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.ev-nat-card .lab { display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  font-family: ${MONO}; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); }
.ev-nat-card .lab em { font-style: normal; font-weight: 600; letter-spacing: 0.06em; text-transform: none; color: var(--muted2); font-size: 11px; }
.ev-nat-card .big { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.ev-nat-card .big b { font-family: var(--font-d); font-size: 30px; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.ev-nat-card .big i { font-style: normal; font-family: ${MONO}; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.ev-nat-card .rng { margin-top: -6px; font-size: 12px; color: var(--muted2); }
.ev-nat-card .rows { display: grid; gap: 6px; }
.ev-nat-card .rows > span { display: grid; grid-template-columns: 10px 1fr auto 46px; column-gap: 8px; align-items: center; font-size: 12.5px; }
.ev-nat-card .rows i { width: 10px; height: 10px; border-radius: 3px; }
.ev-nat-card .rows b { font-weight: 600; color: var(--muted); }
.ev-nat-card .rows span > span { font-family: ${MONO}; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ink); }
.ev-nat-card .rows u { text-decoration: none; text-align: right; font-family: ${MONO}; font-size: 11px; color: var(--muted2); }
.ev-nat-card .rows small { grid-column: 2 / -1; margin-top: -3px; font-size: 11px; color: var(--muted3); }
.ev-nat-card .src { padding-top: 8px; border-top: 1px solid var(--border); font-size: 11.5px; line-height: 1.5; color: var(--muted2); }
.ev-nat-card .src.tilt { border-top: 0; padding-top: 0; margin-top: -4px; color: var(--muted); }
.ev-nat-card .none { font-size: 13px; color: var(--muted2); }
.ev-bar.comb { height: 12px; }
.ev-bar i.est { background-image: repeating-linear-gradient(45deg, transparent 0 3px, rgba(var(--line-rgb),0.45) 3px 5px) !important; }

.ev-note { margin-top: 30px; max-width: 78ch; font-size: 12.5px; line-height: 1.65; color: var(--muted2); }
.ev-note a { color: var(--accent-link); }

@media (max-width: 760px) {
  .ev-top-n span { margin-left: 0; width: 100%; }
    }
`;
