"use client";

/**
 * TONIGHT'S BOARD — August 4, 2026 primary night.
 * Route: /results/tonight
 *
 * STRUCTURE AUTHORITY
 *   election_coverage_five_level_methodology_v6.html, Level 2 panel.
 *   Restyled in TPSI tokens per CO-04: "Its fonts/colors/spacing are a foreign
 *   system, restyle everything in TPSI tokens, but do NOT rearrange its layout."
 *   Layout, section order, and component anatomy are the prototype's. Only the
 *   palette, type, and copy are ours.
 *
 * LEVEL MAPPING FOR TONIGHT
 *   84778 Michigan U.S. Senate D ...... LEVEL 2, statewide forecast
 *   the other 23 ...................... LEVEL 4, results only
 *
 * Level 2, not Level 1. The TPSI model is statewide (n=254) and produces no
 * county estimates, so countyModel is false and the ballot-landscape card is
 * suppressed exactly as the Level 2 panel suppresses it. This also means the
 * race is tier 3 Forecast in the CO-04 matrix, not tier 4 Spotlight.
 *
 * COUNTY MAP + RESULTS BY COUNTY
 *   The single-race desk (race/[id]/RaceDesk.tsx) proved too unstable to ship
 *   for primary night, so the county board lives here instead. The map is
 *   MichiganCountyMap, whose SVG geometry and color ramps are ported from
 *   changeorders/TPSI_Michigan_Election_Forecast_Map.html. A forecast/results
 *   toggle drives both the map and MichiganCountyTable: FORECAST reads the
 *   static DSMeridian model (_data/miCountyForecast.ts), RESULTS reads live
 *   CivicAPI region_results, which sit at zero until Michigan reports below
 *   the statewide level. Everything for tonight lives on this one route.
 *
 * DEPENDENCIES, chosen so CO-06 cannot break this page
 *   _lib/raceState, MichiganCountyMap, MichiganCountyTable. Not ResultsDesk.tsx, not
 *   raceCapabilities.ts, not RaceDesk.tsx (the race/[id] route now redirects
 *   here — see race/[id]/page.tsx).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getRaceState,
  GATE_THRESHOLD_PCT,
  getMsLeftToClose,
  formatCountdown,
  type RaceState,
} from "../_lib/raceState";
import MichiganCountyMap from "./MichiganCountyMap";
import MichiganCountyTable, { type LiveCounty } from "./MichiganCountyTable";
import { projectCounties } from "./countyForecast";
import { TURNOUT_MODEL, STATEWIDE_FORECAST } from "../_data/miCountyForecast";
import { forecastRace, type Shares3 } from "../../lib/electoralModel";
import { evaluateCall } from "../../lib/raceCall";
import { fetchRace } from "../onpoint/electionLib.js";

const MI_ID = 84778;
const REFRESH_MS = 30_000;

/* ═════════════════════ SLATE ═════════════════════ */

interface Entry {
  id: number; state: string; title: string; sub?: string;
  close: string; final: boolean; topTwo?: boolean; measure?: boolean;
}

const STATE_NAME: Record<string, string> = {
  VA: "Virginia", MI: "Michigan", MO: "Missouri", KS: "Kansas", WA: "Washington",
};
const STATE_ORDER = ["VA", "MI", "MO", "KS", "WA"] as const;

const MI_D = "2026-08-04T20:00:00-04:00";
const MI_S = "2026-08-04T21:00:00-04:00";
const KS_S = "2026-08-04T21:00:00-04:00";
const MO_C = "2026-08-04T20:00:00-04:00";
const VA_C = "2026-08-04T19:00:00-04:00";
const WA_C = "2026-08-04T23:00:00-04:00";

/** Level 4 slate. Reported results only, no model, no projection zone. */
const LEVEL4: Entry[] = [
  { id: 84964, state: "VA", title: "U.S. House 2", sub: "Democratic primary", close: VA_C, final: false },
  { id: 84962, state: "VA", title: "U.S. House 1", sub: "Democratic primary", close: VA_C, final: false },
  { id: 84965, state: "VA", title: "U.S. House 5", sub: "Democratic primary", close: VA_C, final: false },
  { id: 84970, state: "VA", title: "U.S. Senate",  sub: "Republican primary", close: VA_C, final: false },

  { id: 84668, state: "MI", title: "Governor",      sub: "Democratic primary", close: MI_S, final: true  },
  { id: 84669, state: "MI", title: "Governor",      sub: "Republican primary", close: MI_S, final: true  },
  { id: 84771, state: "MI", title: "U.S. House 13", sub: "Democratic primary", close: MI_D, final: false },
  { id: 84776, state: "MI", title: "U.S. House 7",  sub: "Democratic primary", close: MI_D, final: false },
  { id: 84769, state: "MI", title: "U.S. House 11", sub: "Democratic primary", close: MI_D, final: false },
  { id: 84767, state: "MI", title: "U.S. House 10", sub: "Democratic primary", close: MI_D, final: false },
  { id: 84768, state: "MI", title: "U.S. House 10", sub: "Republican primary", close: MI_D, final: false },
  { id: 84777, state: "MI", title: "U.S. House 8",  sub: "Republican primary", close: MI_D, final: false },

  { id: 84574, state: "MO", title: "Amendment 4",  sub: "Initiative petition threshold", close: MO_C, final: false, measure: true },
  { id: 84648, state: "MO", title: "U.S. House 1", sub: "Democratic primary", close: MO_C, final: false },
  { id: 84656, state: "MO", title: "U.S. House 5", sub: "Republican primary", close: MO_C, final: false },
  { id: 84658, state: "MO", title: "U.S. House 6", sub: "Republican primary", close: MO_C, final: false },
  { id: 84650, state: "MO", title: "U.S. House 2", sub: "Democratic primary", close: MO_C, final: false },

  { id: 84971, state: "KS", title: "Constitutional Amendment", sub: "Supreme Court selection", close: KS_S, final: true, measure: true },
  { id: 84781, state: "KS", title: "Governor",     sub: "Republican primary", close: KS_S, final: true },
  { id: 84780, state: "KS", title: "Governor",     sub: "Democratic primary", close: KS_S, final: true },
  { id: 84840, state: "KS", title: "U.S. Senate",  sub: "Democratic primary", close: KS_S, final: true },

  { id: 84950, state: "WA", title: "U.S. House 3", sub: "Top-two primary", close: WA_C, final: false, topTwo: true },
  { id: 84951, state: "WA", title: "U.S. House 4", sub: "Top-two primary", close: WA_C, final: false, topTwo: true },
];

const ALL_IDS = new Set<number>([MI_ID, ...LEVEL4.map((e) => e.id)]);

/* ═════════════════════ MODEL ═════════════════════ */

const MODEL = {
  title: "U.S. Senate Michigan Democratic Primary",
  state: "Michigan",
  deck:
    "Abdul El-Sayed leads the TPSI model against Rep. Haley Stevens in an open " +
    "seat contest, with the Upper Peninsula vote outstanding until the final " +
    "polls close an hour after the rest of the state.",
  close: MI_S,
  raceRule: "Plurality",
  a: { name: "Abdul El-Sayed", last: "El-Sayed" },
  b: { name: "Haley Stevens",  last: "Stevens" },
  withdrawn: "McMorrow",
  n: 254, moe: "±6.9",
  field: "July 25 to 29, 2026",
  modelName: "TPSI DSMeridian 10",
  headline:
    "The model expects El-Sayed to carry Wayne and Washtenaw by enough to absorb " +
    "Stevens' advantage in her Oakland County base. The projected margin is wide, " +
    "but the sample is small, so the range around it stays broad.",
};

/* ═════════════════════ ENGINE INPUTS ═════════════════════ */

/** Substring that identifies each candidate in the CivicAPI feed. Order is
 *  fixed to the prior below — never key off vote rank, which inverts on a lead
 *  change (CO-07 addendum §3). */
const CAND_MATCH: Record<"Candidate1" | "Candidate2" | "Candidate3", string> = {
  Candidate1: "sayed",
  Candidate2: "stevens",
  Candidate3: "mcmorrow",
};

const CAND_NAMES = {
  Candidate1: "El-Sayed",
  Candidate2: "Stevens",
  Candidate3: "McMorrow",
} as const;

/** The pre-election prior. The only place the poll numbers live. */
const POLL_PRIOR: Shares3 = {
  Candidate1: STATEWIDE_FORECAST.elSayed / 100,
  Candidate2: STATEWIDE_FORECAST.stevens / 100,
  Candidate3: STATEWIDE_FORECAST.mcmorrow / 100,
};

/** Editorial projection. A desk decision, not a model output. Set to null to
 *  withdraw it. An AP call always supersedes it. */
const DESK_CALL: { key: keyof typeof CAND_NAMES; at: string } | null = {
  key: "Candidate1",
  at: "2026-08-05T03:40:00-04:00",
};

/* ═════════════════════ DATA ═════════════════════ */

const SEARCH =
  "https://civicapi.org/api/v2/race/search?startDate=2026-08-04&endDate=2026-08-04&limit=50000";

type Cand = { name?: string; party?: string; votes?: number; percent?: number; winner?: boolean };
type Race = { id: number; candidates?: Cand[]; percent_reporting?: number };

function useSlate() {
  const [races, setRaces] = useState<Record<number, Race>>({});
  const [updated, setUpdated] = useState<Date | null>(null);
  const [stale, setStale] = useState(false);
  const alive = useRef(true);

  const pull = useCallback(async () => {
    try {
      const r = await fetch(SEARCH, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (!alive.current) return;
      const next: Record<number, Race> = {};
      for (const race of j.races || []) {
        if (ALL_IDS.has(Number(race.id))) next[Number(race.id)] = race;
      }
      setRaces(next); setUpdated(new Date()); setStale(false);
    } catch {
      // A failed refresh never blanks the board. Keep the last good payload.
      if (alive.current) setStale(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    pull();
    const t = setInterval(pull, REFRESH_MS);
    return () => { alive.current = false; clearInterval(t); };
  }, [pull]);

  return { races, updated, stale, refresh: pull };
}

/** Michigan county returns from CivicAPI. Empty until the state reports below
 *  the statewide level, which it does not do before polls close. */
function useLiveCounties(raceId: number) {
  const [counties, setCounties] = useState<Record<number, never> | Record<string, LiveCounty>>({});

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    const pull = async () => {
      try {
        const detail = await fetchRace(raceId, ac.signal);
        if (!alive) return;
        const rr = detail?.region_results || {};
        const out: Record<string, LiveCounty> = {};
        for (const key of Object.keys(rr)) {
          const r = rr[key];
          const name = String(r?.name || key).replace(/\s+county$/i, "").trim().toUpperCase();
          if (!name) continue;
          let el = 0;
          let st = 0;
          for (const c of r?.candidates || []) {
            const n = String(c?.name || "").toLowerCase();
            if (n.includes("sayed")) el += Number(c.votes) || 0;
            else if (n.includes("stevens")) st += Number(c.votes) || 0;
          }
          out[name] = { elSayedVotes: el, stevensVotes: st, reporting: Number(r?.percent_reporting) || 0 };
        }
        setCounties(out);
      } catch {
        // No county feed yet. The board renders zeros, which is the truth.
      }
    };
    pull();
    const t = setInterval(pull, REFRESH_MS);
    return () => { alive = false; ac.abort(); clearInterval(t); };
  }, [raceId]);

  return counties as Record<string, LiveCounty>;
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/* ═════════════════════ HELPERS ═════════════════════ */

const sortC = (r?: Race): Cand[] =>
  [...(r?.candidates || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0));

const clampPct = (n: number) => Math.min(Math.max(n, 0), 100);

const estRep = (r?: Race) => {
  const p = Number(r?.percent_reporting);
  if (!Number.isFinite(p)) return 0;
  // CivicAPI reports 0–100, so 1 means one percent — never treat it as a fraction.
  return clampPct(p);
};

const counted = (r?: Race) => sortC(r).reduce((s, c) => s + (c.votes || 0), 0);
const isLive = (r?: Race) => counted(r) > 0;
const officialCall = (r?: Race) => sortC(r).some((c) => c.winner === true);

const share = (c: Cand, all: Cand[]) => {
  if (Number.isFinite(c.percent)) return clampPct(Number(c.percent));
  const t = all.reduce((s, x) => s + (x.votes || 0), 0);
  return t > 0 ? ((c.votes || 0) / t) * 100 : 0;
};

const int = (n?: number) => Math.round(Number(n) || 0).toLocaleString("en-US");

/** Design System §6 — >99 and <1 at the extremes. */
const pctLabel = (p: number) =>
  p >= 99.95 && p < 100 ? ">99" : p > 0 && p < 0.05 ? "<1" : p.toFixed(1);

const partyOf = (p?: string) => {
  const s = String(p || "").toLowerCase();
  if (/democr/.test(s)) return "d";
  if (/republic|gop/.test(s)) return "r";
  return "n";
};

/**
 * Color LAW: same-party primary uses the party hue for A and --c2 for B.
 * Never the opposing party's color inside a one-party race.
 */
const tone = (i: number, party?: string) => {
  if (i === 0) {
    const p = partyOf(party);
    return p === "r" ? "var(--gop)" : p === "d" ? "var(--dem)" : "var(--ink2)";
  }
  if (i === 1) return "var(--c2)";
  return "var(--ink3)";
};

const closeAt = (e: { close: string; final: boolean }) => {
  const t = new Date(e.close).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
  return `${e.final ? "Final close" : "Close"} ${t} ET`;
};

const stateOf = (r?: Race): RaceState =>
  getRaceState({
    percentReporting: isLive(r) ? estRep(r) : 0,
    hasOfficialCall: officialCall(r),
    tpsiCalled: DESK_CALL !== null && isLive(r),
  });

/** Sentence-case status, matching the prototype's race-meta block. */
const STATUS_COPY: Record<RaceState, string> = {
  SCHEDULED: "Polls open",
  LIVE_GATED: "Too early to call",
  LIVE_FORECAST: "Counting",
  PROJECTED: "TPSI projection",
  OFFICIAL: "Race called",
};

/* ═════════════════════ PAGE ═════════════════════ */

export default function TonightBoard() {
  const { races, updated, stale, refresh } = useSlate();
  const now = useNow();
  const [mapMode, setMapMode] = useState<"margin" | "turnout">("margin");
  const [countyView, setCountyView] = useState<"forecast" | "results">("forecast");
  const liveCounties = useLiveCounties(MI_ID);

  const mi = races[MI_ID];
  const cands = sortC(mi);
  const live = isLive(mi);
  const rep = estRep(mi);
  const rState = stateOf(mi);
  const gated = live && rep < GATE_THRESHOLD_PCT;
  const msLeft = getMsLeftToClose(MODEL.close, now);

  const stamp = updated
    ? updated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + " ET"
    : "—";

  const grouped = useMemo(
    () =>
      STATE_ORDER.map((st) => ({
        key: st,
        label: STATE_NAME[st],
        races: LEVEL4.filter((e) => e.state === st),
      })),
    []
  );

  const leadGap =
    live && cands.length > 1 ? (cands[0].votes || 0) - (cands[1].votes || 0) : 0;
  const leadMarginPP =
    live && cands.length > 1 ? share(cands[0], cands) - share(cands[1], cands) : 0;

  // The forecast engine runs on every refresh. With no returns in,
  // percent_reporting is 0, so it reproduces the pre-election prior exactly.
  const fc = useMemo(() => {
    const all = sortC(mi);
    const total = counted(mi);
    const votesFor = (needle: string) =>
      all
        .filter((c) => String(c.name || "").toLowerCase().includes(needle))
        .reduce((s, c) => s + (c.votes || 0), 0);

    return forecastRace({
      race_rule: "PLURALITY",
      percent_reporting: clampPct(estRep(mi)) / 100,
      reported_vote_total: total,
      expected_turnout: TURNOUT_MODEL.projected,
      reported_share: {
        Candidate1: total ? votesFor(CAND_MATCH.Candidate1) / total : 0,
        Candidate2: total ? votesFor(CAND_MATCH.Candidate2) / total : 0,
        Candidate3: total ? votesFor(CAND_MATCH.Candidate3) / total : 0,
      },
      expected_share: POLL_PRIOR,
      // Required. Without it the projection allocates every outstanding ballot
      // at the poll share forever and never learns from the count.
      poll_avg_shares: POLL_PRIOR,
    });
  }, [mi]);

  const call = useMemo(() => evaluateCall(fc, CAND_NAMES), [fc]);

  const counties = useMemo(
    () => projectCounties(liveCounties, fc.modeled_total_vote),
    [liveCounties, fc.modeled_total_vote]
  );

  const winA = fc.plurality_odds_to_win.Candidate1 * 100;
  const winB = fc.plurality_odds_to_win.Candidate2 * 100;
  const winOther = Math.max(0, 100 - winA - winB);
  const shareA = fc.modeled_share.Candidate1 * 100;
  const shareB = fc.modeled_share.Candidate2 * 100;
  const marginPP = shareA - shareB;
  const leaderLast = marginPP >= 0 ? MODEL.a.last : MODEL.b.last;
  const modeledRep = fc.modeled_percent_reporting * 100;

  // The margin is a difference of two vote totals, so its sd is sd_race·√2.
  const marginSdPP =
    fc.modeled_total_vote > 0
      ? ((fc.sd_race * Math.SQRT2) / fc.modeled_total_vote) * 100
      : 0;
  const marginLo = marginPP - 2 * marginSdPP;
  const marginHi = marginPP + 2 * marginSdPP;
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;

  const deskCalled = DESK_CALL !== null && live;
  const deskWinner = DESK_CALL ? CAND_NAMES[DESK_CALL.key] : null;
  const deskWinnerMatch = DESK_CALL ? CAND_MATCH[DESK_CALL.key] : null;

  const headline = deskCalled
    ? `TPSI projects ${deskWinner} wins the Democratic nomination. He leads by ` +
      `${int(leadGap)} votes with ${pctLabel(modeledRep)}% of the estimated vote counted, ` +
      `and the projected margin of ${signed(marginPP)} sits outside the 95% interval ` +
      `for a Stevens comeback.`
    : live
      ? call.line
      : MODEL.headline;

  // AP's call always wins the chip; ours is labelled as ours (§5.7).
  const statusCopy =
    rState === "OFFICIAL"
      ? STATUS_COPY.OFFICIAL
      : deskCalled
        ? `TPSI projection — ${deskWinner}`
        : live && call.verdict === "LEANING"
          ? "Leaning"
          : STATUS_COPY[rState];

  return (
    <div className="desk">
      <style>{CSS}</style>

      <main className="shell">

        {/* ═══ RACE HEADER ═══ */}
        <section className="race-header" id="overview" aria-labelledby="race-title">
          <div className="race-kicker">
            {live && rState !== "OFFICIAL" && <span className="live-dot" aria-hidden />}
            <span>{MODEL.state} primary · August 4</span>
            <span>•</span>
            <span>Level 2 coverage · statewide forecast</span>
          </div>

          <div className="race-heading-row">
            <div>
              <h1 id="race-title">{MODEL.title}</h1>
              <p className="race-deck">{MODEL.deck}</p>
            </div>
            <div className="race-meta" aria-label="Race update summary">
              <div className="meta-block"><span>Last updated</span><b>{stamp}</b></div>
              <div className="meta-block"><span>Reported votes</span><b>{live ? int(counted(mi)) : "0"}</b></div>
              <div className="meta-block"><span>Estimated reporting</span><b>{live ? `${pctLabel(rep)}%` : "0%"}</b></div>
              <div className="meta-block"><span>Race status</span><b>{statusCopy}</b></div>
            </div>
          </div>

          <nav className="race-tabs" aria-label="Race sections">
            <a href="#overview" aria-current="page">Overview</a>
            <a href="#forecast">Forecast</a>
            <a href="#board">All races</a>
            <a href="#method">Method</a>
          </nav>
        </section>

        <div className="dashboard-grid">

          {/* ═══ REPORTED RESULTS ═══ */}
          <article className="card span-3" aria-labelledby="results-title">
            <div className="topline-shell">
              <header className="topline-header">
                <div className="topline-title">
                  <h2 id="results-title">Reported results</h2>
                  <p>Actual reported votes. Forecast estimates appear separately.</p>
                </div>
                <div className="topline-meta">
                  <span className="topline-status">{statusCopy}</span>
                  <span className="topline-updated"><strong>Updated</strong> {stamp}</span>
                </div>
              </header>

              <div className="topline-columns" aria-hidden>
                <span>Candidate</span><span>Votes</span><span>Vote share</span>
              </div>

              {live ? (
                cands.map((c, i) => {
                  const p = share(c, cands);
                  const col = tone(i, c.party);
                  const projectedWinner =
                    !c.winner &&
                    deskCalled &&
                    !!deskWinnerMatch &&
                    String(c.name || "").toLowerCase().includes(deskWinnerMatch);
                  return (
                    <div className="topline-row" key={c.name || i}>
                      <div className="topline-row-top">
                        <div className="topline-candidate">
                          <span className="topline-dot" style={{ background: col }} />
                          <div className="topline-copy">
                            <strong>{c.name}</strong>
                            <small>
                              {c.party || "Democrat"}
                              {String(c.name || "").includes(MODEL.withdrawn) && " · Withdrawn, on ballot"}
                            </small>
                            {i === 0 && leadGap > 0 && !c.winner && !projectedWinner && (
                              <span className="topline-lead">Leads by {int(leadGap)} votes</span>
                            )}
                            {projectedWinner && (
                              <span className="topline-lead won">TPSI projected winner</span>
                            )}
                            {c.winner && <span className="topline-lead won">Race called</span>}
                          </div>
                        </div>
                        <div className="topline-votes">{int(c.votes)}</div>
                        <div className="topline-pct">{pctLabel(p)}%</div>
                      </div>
                      <div className="topline-bar">
                        <span style={{ width: `${Math.max(p, 0)}%`, background: col }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-live">
                  <p className="prose">
                    No votes reported. Michigan&rsquo;s final polls close at 9:00 PM ET,
                    in {formatCountdown(msLeft)}. Results appear here automatically.
                  </p>
                </div>
              )}

              <div className="topline-foot">
                <span>{live ? `${int(counted(mi))} votes counted` : "No votes counted"}</span>
                {live && cands.length > 1 && (
                  <span className="topline-margin">
                    <b>{signed(leadMarginPP)}</b> margin · {int(leadGap)} votes
                  </span>
                )}
                <span className="topline-reporting">
                  <b>{live ? pctLabel(rep) : "0"}%</b> est. reporting
                </span>
              </div>
            </div>
          </article>

          {/* ═══ FORECAST SNAPSHOT + PROJECTION ZONE ═══ */}
          <article className="card span-3" id="forecast" aria-labelledby="snapshot-title">
            <section className="snapshot" aria-labelledby="snapshot-title">
              <div className="snapshot-heading">
                <div>
                  <strong id="snapshot-title">Forecast snapshot</strong>
                  <small>Model metrics update as new results arrive</small>
                </div>
                <span className="race-rule-pill">{MODEL.raceRule}</span>
              </div>

              {gated ? (
                <div className="gatebox">
                  <div className="model-label">Forecast gated</div>
                  <p className="prose">
                    Held back below {GATE_THRESHOLD_PCT}% estimated reporting. Early
                    returns skew toward whichever counties report first.
                  </p>
                </div>
              ) : (
                <div className="forecast-model-layout">
                  <div className="forecast-hero">
                    <div className="model-label">Win probability</div>
                    <div className="prob-ring"
                         style={{ ["--value" as string]: winA } as React.CSSProperties}
                         role="img"
                         aria-label={`Win probability: ${MODEL.a.last} ${winA.toFixed(1)} percent, ${MODEL.b.last} ${winB.toFixed(1)} percent`}>
                      <div className="ring-center">
                        <b>{pctLabel(winA)}%</b>
                        <span>{MODEL.a.last}</span>
                      </div>
                    </div>
                  </div>

                  <div className="forecast-support">
                    <div>
                      <div className="model-label">Top outcomes</div>
                      <div className="outcome-row">
                        <i style={{ background: "var(--dem)" }} aria-hidden />
                        <span>{MODEL.a.last} wins</span><b>{pctLabel(winA)}%</b>
                      </div>
                      <div className="outcome-row">
                        <i style={{ background: "var(--c2)" }} aria-hidden />
                        <span>{MODEL.b.last} wins</span><b>{pctLabel(winB)}%</b>
                      </div>
                      {/* §5.4 — residual normalizes, never a separate comeback number */}
                      <div className="outcome-row muted">
                        <i style={{ background: "var(--ink3)" }} aria-hidden />
                        <span>Other outcomes</span><b>{winOther < 0.05 ? "<1" : pctLabel(winOther)}%</b>
                      </div>
                    </div>

                    <div className="reporting-module">
                      <div className="reporting-copy">
                        <span>Model-estimated</span><b>Percent reporting</b>
                      </div>
                      <div className="rep-ring"
                           style={{ ["--value" as string]: Math.min(modeledRep, 100) } as React.CSSProperties}
                           role="img" aria-label={`Model-estimated reporting ${pctLabel(modeledRep)} percent`}>
                        <div className="ring-center sm">
                          <b>{pctLabel(modeledRep)}%</b>
                          <span>reporting</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {!gated && (
              <section className="projection-zone" aria-label="Forecasted final result">
                <div className="projected-top">
                  <div className="projected-intro">
                    <span className="model-label">
                      {deskCalled ? "TPSI projection" : "Model projection · not actual results"}
                    </span>
                    <div className="projected-name">
                      {deskCalled ? `${deskWinner} wins` : `${leaderLast} projected ahead`}
                    </div>
                    <p className="projection-headline prose">{headline}</p>
                  </div>
                  <div className="projected-margin-wrap">
                    <span>Projected margin</span>
                    <b>{signed(marginPP)}</b>
                    <small>{leaderLast}, projected final points</small>
                  </div>
                </div>

                <div className="projection-head">
                  <div>
                    <strong>Projected final vote share</strong>
                    <small>
                      Muted bars indicate a forecast, not certified results. They use
                      the same 0 to 100% scale as the reported-results bars.
                    </small>
                  </div>
                  <span className="model-label">Forecast only</span>
                </div>

                <div className="projected-bars">
                  {[{ ...MODEL.a, share: shareA }, { ...MODEL.b, share: shareB }].map((c, i) => {
                    const col = i === 0 ? "var(--dem)" : "var(--c2)";
                    const tint = i === 0 ? "var(--dem-tint)" : "var(--c2-tint)";
                    const match = i === 0 ? CAND_MATCH.Candidate1 : CAND_MATCH.Candidate2;
                    const liveCand = cands.find((x) =>
                      String(x.name || "").toLowerCase().includes(match)
                    );
                    const actual = live && liveCand ? share(liveCand, cands) : null;
                    const delta = actual != null ? c.share - actual : null;
                    return (
                      <div className="projected-bar-row" key={c.name}>
                        <div className="projected-bar-name">
                          <i style={{ background: col }} aria-hidden />
                          <span>{c.last}</span>
                        </div>
                        {/* §5.1 — projected fill is muted and dashed, never solid */}
                        <div className="projected-bar-track">
                          <span className="projected-bar-fill"
                                style={{ width: `${c.share}%`, borderColor: col, background: tint }} />
                        </div>
                        <div className="projected-bar-value">{c.share.toFixed(1)}%</div>
                        <div className="projected-bar-delta">
                          {delta != null
                            ? `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} vs now`
                            : "projected"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="model-stats">
                  <div><span>Projected turnout</span><b>{int(fc.modeled_total_vote)}</b></div>
                  <div><span>Votes remaining</span><b>{int(fc.modeled_vote_remaining)}</b></div>
                  <div><span>SD of votes</span><b>±{int(fc.sd_race)}</b></div>
                  <div>
                    <span>Margin range (95%)</span>
                    <b>{signed(marginLo)} to {signed(marginHi)}</b>
                  </div>
                </div>

                {/* §5.6 — telemetry flag off means exactly this line */}
                <div className="no-history">No history snapshots · live data only</div>
              </section>
            )}
          </article>
        </div>

        <section className="county card" aria-label="Michigan county map and county-by-county detail">
          <div className="county-head">
            <div className="rd-view-toggles" role="group" aria-label="County view">
              <button type="button" className={countyView === "forecast" ? "on" : ""}
                      onClick={() => setCountyView("forecast")}>forecast</button>
              <button type="button" className={countyView === "results" ? "on" : ""}
                      onClick={() => setCountyView("results")}>results</button>
            </div>
            {countyView === "forecast" && (
              <div className="rd-map-toggles" role="group" aria-label="County map shading">
                <button type="button" className={mapMode === "margin" ? "on" : ""}
                        onClick={() => setMapMode("margin")}>margin</button>
                <button type="button" className={mapMode === "turnout" ? "on" : ""}
                        onClick={() => setMapMode("turnout")}>turnout</button>
              </div>
            )}
          </div>

          <div className="rd-map">
            <MichiganCountyMap view={countyView} mode={mapMode}
                               counties={counties.byName} liveCounties={liveCounties} />
          </div>

          <div className="rd-map-legend" aria-hidden>
            {countyView === "results" ? (
              <>
                <span className="rd-map-legend-sw"
                      style={{ background: "linear-gradient(90deg,rgb(74,47,134),var(--ramp-mid),rgb(11,95,84))" }} />
                <span>Stevens ← reported margin → El-Sayed</span>
              </>
            ) : mapMode === "turnout" ? (
              <>
                <span className="rd-map-legend-sw"
                      style={{ background: "linear-gradient(90deg,var(--ramp-lo),rgb(15,95,85))" }} />
                <span>lower → higher projected turnout</span>
              </>
            ) : (
              <>
                <span className="rd-map-legend-sw"
                      style={{ background: "linear-gradient(90deg,rgb(74,47,134),var(--ramp-mid),rgb(11,95,84))" }} />
                <span>Stevens ← projected margin → El-Sayed · hatched = too close to call</span>
              </>
            )}
            <span className="rd-map-hint">scroll or pinch to zoom · drag to pan</span>
          </div>

          <MichiganCountyTable view={countyView} counties={counties.list}
                               statewide={counties.statewide} liveCounties={liveCounties} />
        </section>


        {/* ═══ LEVEL 4 BOARD ═══ */}
        <section id="board" className="board">
          <div className="board-head">
            <div>
              <h2>All races tonight</h2>
              <p>Level 4 coverage. Reported results only, no TPSI model.</p>
            </div>
            <div className="board-meta">
              <span className="model-label">23 races · 5 states</span>
              {stale && <button className="utility-button" onClick={refresh}>Feed stale · retry</button>}
            </div>
          </div>

          {grouped.map((g) => (
            <div className="grp" key={g.key}>
              <div className="grp-hd">
                <h3>{g.label}</h3>
                <span className="model-label">{closeAt(g.races[0])}</span>
              </div>
              <div className="grid">
                {g.races.map((e) => <L4Card key={e.id} entry={e} race={races[e.id]} />)}
              </div>
            </div>
          ))}
        </section>

        {/* ═══ METHOD ═══ */}
        <section id="method" className="method">
          <h2>Method</h2>
          <p className="prose">
            Reported vote is solid. Projected share is muted and dashed, on the same
            0 to 100% scale. Estimated reporting is the share of expected vote, not
            precincts. Race calls come from AP through CivicAPI. TPSI projections are
            modeled estimates, labeled separately from calls, and appear only on the
            Michigan Senate primary.
          </p>
          <div className="method-foot">
            <span className="model-label">© 2026 The Public Sentiment Institute</span>
            <span className="model-label">Powered by CivicAPI</span>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ═════════════════════ LEVEL 4 CARD ═════════════════════ */

function L4Card({ entry, race }: { entry: Entry; race?: Race }) {
  const all = sortC(race);
  const show = all.slice(0, entry.topTwo ? 3 : 2);
  const live = isLive(race);
  const st = stateOf(race);

  return (
    <div className="l4">
      <div className="l4-hd">
        <span className={`l4-dot ${entry.topTwo || entry.measure ? "n" : partyOf(show[0]?.party || entry.sub)}`} />
        <div className="l4-title">
          <strong>{entry.title}</strong>
          {entry.sub && <small>{entry.sub}</small>}
        </div>
        {live && st !== "OFFICIAL" && <span className="live-dot sm" aria-hidden />}
        {st === "OFFICIAL" && <span className="l4-called">Called</span>}
      </div>

      {live ? (
        <div className="l4-body">
          {show.map((c, i) => (
            <div className="l4-row" key={c.name || i}>
              <span className="l4-nm">{c.name}</span>
              <span className="l4-pct">{pctLabel(share(c, all))}%</span>
              <div className="l4-bar">
                <span style={{ width: `${Math.max(share(c, all), 0)}%`, background: tone(i, c.party) }} />
              </div>
            </div>
          ))}
          {entry.topTwo && <span className="model-label">Top two advance</span>}
        </div>
      ) : (
        <div className="l4-empty">Awaiting returns</div>
      )}

      <div className="l4-foot">
        <span className="model-label">
          {live ? `${pctLabel(estRep(race))}% est. reporting` : closeAt(entry)}
        </span>
      </div>
    </div>
  );
}

/* ═════════════════════ STYLE ═════════════════════ */
/* Prototype layout, TPSI tokens per Design System §1. Light and dark both ride
   the site's globals.css tokens so the desk never fights the rest of the site. */

const CSS = `
/* Surface, ink, party and signal tokens are INHERITED from globals.css so the
   desk flips with the site's data-theme. Only desk-local values are declared. */
.desk{
  --dem-tint:rgba(29,95,196,.14); --c2-tint:rgba(181,51,143,.14);
  --map-stroke:rgba(10,10,10,.14); --map-stroke-hi:rgba(10,10,10,.55);
  --map-hatch:rgba(10,10,10,.22); --map-blank:var(--panel2);
  --ramp-mid:rgb(232,232,226); --ramp-lo:rgb(237,237,231);
  --tip-shadow:0 10px 30px rgba(23,23,27,.16);
  --brand-grad:linear-gradient(90deg,#d2494b 0%,#a44197 20%,#6d3ee9 51%,#3f60e8 100%);
  --mono:var(--font-numeric,'JetBrains Mono'),ui-monospace,monospace;
  --sans:var(--font-body,'Geist'),system-ui,sans-serif;
  --r-panel:14px; --r-card:10px; --r-pill:999px;
  --shadow:none;
  background:var(--canvas);color:var(--ink);min-height:100vh;font-family:var(--sans);
  -webkit-font-smoothing:antialiased;
}
html[data-theme="dark"] .desk{
  --dem-tint:rgba(59,123,222,.16); --c2-tint:rgba(199,87,168,.16);
  --map-stroke:rgba(255,255,255,.10); --map-stroke-hi:rgba(255,255,255,.55);
  --map-hatch:rgba(255,255,255,.28);
  --ramp-mid:rgb(58,58,66); --ramp-lo:rgb(30,30,36);
  --tip-shadow:0 10px 30px rgba(0,0,0,.45);
}

.desk *{margin:0;padding:0;box-sizing:border-box}
.desk a{text-decoration:none;color:inherit}

/* type: Geist for titles and prose, JetBrains Mono for labels and numerals */
.desk h1,.desk h2,.desk h3,.desk .projected-name,.desk .snapshot-heading strong{
  font-family:var(--sans);font-weight:800;letter-spacing:-.028em}
.desk .model-label,.desk .topline-status,.desk .topline-columns,.desk .race-kicker,
.desk .l4-called{font-family:var(--mono);font-weight:700;font-size:8px;
  letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.desk .topline-votes,.desk .topline-pct,.desk .projected-bar-value,.desk .ring-center b,
.desk .meta-block b,.desk .outcome-row b,.desk .l4-pct,.desk .projected-margin-wrap b,
.desk .model-stats b{font-family:var(--mono);font-variant-numeric:tabular-nums}
.desk .prose{font-family:var(--sans);line-height:1.6}

/* the desk sits under the site navbar — no second header bar of its own */
.utility-button{font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink2);border:1px solid var(--hairline2);
  border-radius:var(--r-pill);padding:5px 12px;background:var(--panel);cursor:pointer}
.utility-button:hover{color:var(--ink)}

.shell{max-width:1180px;margin:0 auto;padding:26px 22px 70px}

/* race header */
.race-header{padding-bottom:20px;border-bottom:1px solid var(--hairline)}
.race-kicker{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--live);
  animation:dpulse 1.7s infinite;flex:0 0 auto}
.live-dot.sm{width:6px;height:6px;margin-top:4px}
@keyframes dpulse{50%{opacity:.3}}
.race-heading-row{display:flex;justify-content:space-between;gap:32px;
  align-items:flex-start;margin-top:12px;flex-wrap:wrap}
.race-header h1{font-size:clamp(22px,2.6vw,32px);line-height:1.14}
.race-deck{font-size:14px;color:var(--ink2);max-width:560px;margin-top:9px;line-height:1.6}
.race-meta{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:14px 26px}
.meta-block span{display:block;font-family:var(--mono);font-size:8px;font-weight:700;
  letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.meta-block b{display:block;font-size:17px;font-weight:800;letter-spacing:-.02em;margin-top:3px}
.race-tabs{display:flex;gap:20px;margin-top:18px;flex-wrap:wrap}
.race-tabs a{font-size:12px;color:var(--ink3);padding-bottom:4px;border-bottom:2px solid transparent}
.race-tabs a[aria-current="page"]{color:var(--ink);border-bottom-color:var(--ink)}
.race-tabs a:hover{color:var(--ink2)}

/* dashboard grid */
.dashboard-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-top:20px}
.card{background:var(--panel);border:1px solid var(--hairline);border-radius:var(--r-panel);
  box-shadow:var(--shadow);overflow:hidden}
.span-3{grid-column:span 3}
@media(max-width:900px){.dashboard-grid{grid-template-columns:1fr}.span-3{grid-column:span 1}}

/* reported results */
.topline-shell{padding:16px 18px 18px}
.topline-header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;
  flex-wrap:wrap}
.topline-title h2{font-size:21px;line-height:1.12}
.topline-title p{font-size:11.5px;color:var(--ink2);margin-top:5px}
.topline-meta{text-align:right}
.topline-status{display:block}
.topline-updated{font-family:var(--mono);font-size:9px;color:var(--ink3);letter-spacing:.04em}
.topline-columns{display:grid;grid-template-columns:1fr 90px 74px;gap:10px;margin-top:16px;
  padding-bottom:7px;border-bottom:1px solid var(--hairline)}
.topline-columns span:nth-child(n+2){text-align:right}
.topline-row{padding:13px 0;border-bottom:1px solid var(--hairline)}
.topline-row:last-child{border-bottom:none}
.topline-row-top{display:grid;grid-template-columns:1fr 90px 74px;gap:10px;align-items:center}
.topline-candidate{display:flex;gap:10px;align-items:flex-start;min-width:0}
.topline-dot{width:9px;height:9px;border-radius:50%;margin-top:5px;flex:0 0 auto}
.topline-copy{min-width:0}
.topline-copy strong{display:block;font-size:15px;font-weight:700;letter-spacing:-.01em}
.topline-copy small{display:block;font-family:var(--mono);font-size:8.5px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);margin-top:2px}
.topline-lead{display:block;font-family:var(--mono);font-size:9px;color:var(--ink2);
  margin-top:4px;letter-spacing:.03em}
.topline-lead.won{color:var(--called);font-weight:700}
.topline-votes{font-size:13px;color:var(--ink2);text-align:right}
.topline-pct{font-size:22px;font-weight:800;letter-spacing:-.03em;text-align:right}
.topline-bar{height:7px;border-radius:99px;background:var(--panel3);overflow:hidden;margin-top:9px}
.topline-bar span{display:block;height:100%;border-radius:99px;
  transition:width 600ms cubic-bezier(.16,1,.3,1)}
.empty-live{padding:22px 0 6px}
.empty-live .prose{font-size:13px;color:var(--ink2);max-width:400px}
.topline-foot{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  margin-top:14px;padding-top:11px;border-top:1px solid var(--hairline);
  font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.topline-reporting b{font-size:13px;color:var(--ink);letter-spacing:-.01em;
  font-variant-numeric:tabular-nums;margin-right:5px}
.topline-margin b{font-size:13px;color:var(--ink);letter-spacing:-.01em;
  font-variant-numeric:tabular-nums;margin-right:5px}

/* forecast snapshot */
.snapshot{padding:16px 18px 18px;border-bottom:1px solid var(--hairline)}
.snapshot-heading{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.snapshot-heading strong{display:block;font-size:21px;line-height:1.12}
.snapshot-heading small{display:block;font-size:11px;color:var(--ink2);margin-top:4px}
.race-rule-pill{font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink2);border:1px solid var(--hairline2);
  border-radius:var(--r-pill);padding:4px 10px;white-space:nowrap}
.forecast-model-layout{display:grid;grid-template-columns:auto 1fr;gap:22px;margin-top:18px;
  align-items:start}
@media(max-width:560px){.forecast-model-layout{grid-template-columns:1fr}}
.forecast-hero{text-align:center}
.prob-ring,.rep-ring{--value:50;position:relative;width:126px;aspect-ratio:1;
  margin:10px auto 0;border-radius:50%;
  background:conic-gradient(from -90deg,var(--dem) calc(var(--value)*1%),var(--panel3) 0)}
.rep-ring{width:82px;
  background:conic-gradient(from -90deg,var(--live) calc(var(--value)*1%),var(--panel3) 0)}
.prob-ring::before,.rep-ring::before{content:"";position:absolute;inset:15px;border-radius:50%;
  background:var(--panel);box-shadow:inset 0 0 0 1px var(--hairline)}
.rep-ring::before{inset:11px}
.ring-center{position:absolute;inset:0;z-index:1;display:grid;place-content:center;text-align:center}
.ring-center b{display:block;font-size:29px;font-weight:800;line-height:1;letter-spacing:-.05em}
.ring-center span{display:block;font-family:var(--mono);font-size:8px;color:var(--ink3);
  margin-top:5px;letter-spacing:.08em;text-transform:uppercase}
.ring-center.sm b{font-size:17px}
.ring-center.sm span{font-size:7px}
.forecast-support{display:flex;flex-direction:column;gap:16px}
.outcome-row{display:flex;align-items:center;gap:8px;padding:6px 0;
  border-bottom:1px solid var(--hairline);font-size:12px}
.outcome-row:last-child{border-bottom:none}
.outcome-row i{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.outcome-row span{flex:1}
.outcome-row b{font-weight:800;font-size:13px}
.outcome-row.muted span,.outcome-row.muted b{color:var(--ink3)}
.reporting-module{display:flex;align-items:center;gap:14px;padding-top:13px;
  border-top:1px solid var(--hairline)}
.reporting-copy span{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.reporting-copy b{display:block;font-size:13px;font-weight:700;margin-top:3px}
.gatebox{margin-top:16px;padding:14px;border:1px dashed var(--hairline2);border-radius:var(--r-card)}
.gatebox .prose{font-size:12.5px;color:var(--ink2);margin-top:6px}

/* projection zone */
.projection-zone{padding:16px 18px 18px}
.projected-top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;
  flex-wrap:wrap}
.projected-intro{flex:1;min-width:220px}
.projected-name{font-size:21px;margin-top:5px}
.projection-headline{font-size:11.5px;color:var(--ink2);margin-top:7px;max-width:400px}
.projected-margin-wrap{text-align:right}
.projected-margin-wrap span{display:block;font-family:var(--mono);font-size:8px;
  letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.projected-margin-wrap b{display:block;font-size:28px;font-weight:800;letter-spacing:-.04em;
  margin-top:3px;color:var(--dem)}
.projected-margin-wrap small{display:block;font-size:9px;color:var(--ink3);margin-top:2px}
.projection-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;
  margin-top:18px;padding-top:14px;border-top:1px solid var(--hairline)}
.projection-head strong{display:block;font-size:14px;font-weight:800;letter-spacing:-.02em}
.projection-head small{display:block;font-size:10px;color:var(--ink3);margin-top:4px;
  line-height:1.45;max-width:400px}
.projected-bars{margin-top:14px;display:flex;flex-direction:column;gap:11px}
.projected-bar-row{display:grid;grid-template-columns:96px 1fr 52px 74px;gap:10px;align-items:center}
.projected-bar-name{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600}
.projected-bar-name i{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.projected-bar-track{height:9px;border-radius:99px;background:var(--panel3);overflow:hidden}
/* §5.1 — projected fill is muted with a dashed edge, never a solid reported bar */
.projected-bar-fill{display:block;height:100%;border-radius:99px;border:1.5px dashed}
.projected-bar-value{font-size:14px;font-weight:800;text-align:right}
.projected-bar-delta{font-family:var(--mono);font-size:8.5px;color:var(--ink3);text-align:right;
  letter-spacing:.03em}
.model-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;
  margin-top:18px;padding-top:14px;border-top:1px solid var(--hairline)}
.model-stats span{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.model-stats b{display:block;font-size:12.5px;font-weight:700;margin-top:3px}
.no-history{font-family:var(--mono);font-size:8.5px;font-style:italic;color:var(--ink3);
  margin-top:14px;padding-top:11px;border-top:1px solid var(--hairline)}

.deferred{font-size:11.5px;color:var(--ink3);margin-top:14px;line-height:1.55}

/* county map + table — choropleth geometry and color ramps ported from
   changeorders/TPSI_Michigan_Election_Forecast_Map.html, restyled against this
   page's own tokens (--panel/--hairline/--ink…). */
.county{margin-top:20px;padding:20px}
.county-head{display:flex;justify-content:space-between;align-items:center;gap:14px;
  flex-wrap:wrap;margin-bottom:14px}
.rd-view-toggles{display:flex;gap:4px;padding:3px;border-radius:999px;
  background:var(--panel2);border:1px solid var(--hairline)}
.rd-view-toggles button{padding:6px 15px;border-radius:999px;border:0;background:none;cursor:pointer;
  font-family:var(--mono);font-size:10.5px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);transition:background .15s ease,color .15s ease}
.rd-view-toggles button.on{background:var(--dem);color:#fff}
.rd-map-toggles{display:flex;gap:4px;padding:3px;border-radius:999px;
  background:var(--panel2);border:1px solid var(--hairline)}
.rd-map-toggles button{padding:5px 13px;border-radius:999px;border:0;background:none;cursor:pointer;
  font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);transition:background .15s ease,color .15s ease}
.rd-map-toggles button.on{background:var(--ink);color:var(--panel)}
.rd-map{position:relative;height:clamp(360px,50vh,540px);width:100%;border-radius:var(--r-panel);
  overflow:hidden;background:var(--panel2);border:1px solid var(--hairline)}
.rd-map-legend{display:flex;align-items:center;gap:8px;margin-top:12px;
  font-family:var(--mono);font-size:10px;letter-spacing:.04em;color:var(--ink3)}
.rd-map-legend-sw{width:46px;height:5px;border-radius:99px;flex-shrink:0}
.rd-map-hint{margin-left:auto;color:var(--ink3);white-space:nowrap}
@media(max-width:640px){.rd-map-hint{display:none}}

.rd-county{margin-top:22px}
.rd-county-h{display:block;font-family:var(--mono);font-size:11px;font-weight:700;
  letter-spacing:.18em;text-transform:uppercase;color:var(--ink3);margin-bottom:14px}
.rd-county-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
  gap:12px;margin-bottom:14px}
.rd-county-search{display:flex;align-items:center;gap:8px;padding:8px 13px;border-radius:10px;
  background:var(--panel2);border:1px solid var(--hairline);color:var(--ink3);
  flex:1 1 220px;max-width:340px}
.rd-county-search input{flex:1;min-width:0;background:none;border:0;outline:none;
  color:var(--ink);font-family:var(--sans);font-size:13px}
.rd-county-search input::placeholder{color:var(--ink3)}
.rd-county-sorts{display:flex;flex-wrap:wrap;gap:4px;padding:3px;border-radius:999px;
  background:var(--panel2);border:1px solid var(--hairline)}
.rd-county-sorts button{padding:5px 12px;border-radius:999px;border:0;background:none;cursor:pointer;
  font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink3);transition:background .15s ease,color .15s ease}
.rd-county-sorts button:hover{color:var(--ink2)}
.rd-county-sorts button.on{background:var(--ink);color:var(--panel)}
.rd-county-tablewrap{max-height:480px;overflow:auto;border:1px solid var(--hairline);
  border-radius:12px;background:var(--panel)}
.rd-county-table{width:100%;border-collapse:collapse;font-family:var(--sans);font-size:13px;
  table-layout:fixed}
.rd-county-table thead th{position:sticky;top:0;z-index:1;background:var(--panel2);
  text-align:left;padding:10px 14px;font-family:var(--mono);font-size:9.5px;font-weight:700;
  letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);
  border-bottom:1px solid var(--hairline)}
.rd-county-table th.num,.rd-county-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.rd-county-table td{padding:10px 14px;border-bottom:1px solid var(--hairline);color:var(--ink);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-county-table tbody tr:last-child td{border-bottom:0}
.rd-county-table tbody tr:hover td{background:var(--panel2)}
.rd-county-loading{text-align:center;padding:26px 14px;color:var(--ink3);font-style:italic}
/* inline-flex, not flex: a display:flex <td> stops behaving as a table cell and
   the columns collapse on top of each other. */
.rd-cand-cell{display:inline-flex;align-items:baseline;justify-content:flex-end;gap:7px;
  font-family:var(--mono)}
.rd-cand-cell b{font-weight:700}
.rd-cand-votes{color:var(--ink3);font-size:11px}
.rd-cand-tcc{display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:7px;
  background:var(--gold);vertical-align:middle}
.rd-county-table tfoot td{position:sticky;bottom:0;z-index:1;background:var(--panel2);
  padding:10px 14px;border-top:2px solid var(--hairline2);font-weight:700;color:var(--ink)}
@media(max-width:640px){
  .rd-cand-votes{display:none}
  .rd-county-table{font-size:12px}
  .rd-county-table td,.rd-county-table thead th,.rd-county-table tfoot td{padding:9px 9px}
}

/* michigan choropleth */
.mi-map-wrap{position:relative;width:100%;height:100%;overflow:hidden;
  touch-action:none;cursor:grab}
.mi-map-wrap.dragging{cursor:grabbing}
.mi-map{display:block;width:100%;height:100%}
.mi-cty{stroke:var(--map-stroke);stroke-width:.6;cursor:pointer;transition:opacity .12s ease}
.mi-cty:hover{opacity:.78;stroke:var(--map-stroke-hi);stroke-width:1.4}
.mi-cty-hatch{pointer-events:none;stroke:none}
.mi-hatch-line{stroke:var(--map-hatch)}
.mi-zoom{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:1px;
  border-radius:9px;overflow:hidden;border:1px solid var(--hairline2);background:var(--panel);
  box-shadow:0 4px 14px rgba(0,0,0,.18)}
.mi-zoom button{width:30px;height:28px;border:0;background:var(--panel);color:var(--ink2);
  cursor:pointer;font-family:var(--mono);font-size:14px;line-height:1;font-weight:700;
  display:grid;place-items:center;transition:background .12s ease,color .12s ease}
.mi-zoom button+button{border-top:1px solid var(--hairline)}
.mi-zoom button:hover:not(:disabled){background:var(--panel2);color:var(--ink)}
.mi-zoom button:disabled{opacity:.4;cursor:default}
.mi-zoom button.reset{font-size:8px;letter-spacing:.06em}
.mi-tip{position:absolute;z-index:5;pointer-events:none;min-width:200px;max-width:240px;
  padding:10px 12px;border-radius:var(--r-card);background:var(--panel);
  border:1px solid var(--hairline2);box-shadow:var(--tip-shadow);
  font-family:var(--sans);font-size:12px;color:var(--ink)}
.mi-tip strong{display:block;font-size:13px;font-weight:800;margin-bottom:6px}
.mi-tip-row{display:flex;justify-content:space-between;gap:16px;font-family:var(--mono);
  font-size:11.5px;line-height:1.7}
.mi-tip-row b{font-variant-numeric:tabular-nums}
.mi-tip-sub{margin-top:5px;font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;
  color:var(--ink3)}
.mi-tip-flag{margin-top:6px;font-family:var(--mono);font-size:8.5px;font-weight:700;
  letter-spacing:.11em;text-transform:uppercase;color:var(--gold)}

/* level 4 board */
.board{margin-top:38px}
.board-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;
  padding-bottom:12px;border-bottom:1px solid var(--hairline2);flex-wrap:wrap}
.board-head h2{font-size:21px}
.board-head p{font-size:11.5px;color:var(--ink2);margin-top:4px}
.board-meta{display:flex;align-items:center;gap:10px}
.grp{margin-top:22px}
.grp-hd{display:flex;justify-content:space-between;gap:12px;align-items:baseline;
  margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid var(--hairline)}
.grp-hd h3{font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:10px}
.l4{background:var(--panel);border:1px solid var(--hairline);border-radius:var(--r-card);
  box-shadow:var(--shadow);padding:12px 13px;display:flex;flex-direction:column;gap:10px;
  transition:border-color 140ms ease}
.l4:hover{border-color:var(--hairline2)}
.l4-hd{display:flex;gap:9px;align-items:flex-start}
.l4-dot{width:8px;height:8px;border-radius:50%;margin-top:4px;flex:0 0 auto;background:var(--ink3)}
.l4-dot.d{background:var(--dem)} .l4-dot.r{background:var(--gop)} .l4-dot.n{background:var(--c2)}
.l4-title{flex:1;min-width:0}
.l4-title strong{display:block;font-size:13px;font-weight:700;letter-spacing:-.01em}
.l4-title small{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);margin-top:2px}
.l4-called{color:var(--called)}
.l4-body{display:flex;flex-direction:column;gap:9px}
.l4-row{display:grid;grid-template-columns:1fr auto;gap:4px 8px}
.l4-nm{font-size:11.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l4-pct{font-size:12px;font-weight:800}
.l4-bar{grid-column:1/-1;height:4px;border-radius:99px;background:var(--panel3);overflow:hidden}
.l4-bar span{display:block;height:100%;border-radius:99px;
  transition:width 600ms cubic-bezier(.16,1,.3,1)}
.l4-empty{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink3);padding:8px 0}
.l4-foot{margin-top:auto;padding-top:8px;border-top:1px solid var(--hairline)}

/* method */
.method{margin-top:38px;padding-top:18px;border-top:1px solid var(--hairline)}
.method h2{font-size:16px}
.method .prose{font-size:12px;color:var(--ink2);margin-top:9px;max-width:840px}
.method .prose.small{font-size:10.5px;color:var(--ink3)}
.method-foot{display:flex;justify-content:space-between;gap:14px;margin-top:16px;flex-wrap:wrap}

@media(max-width:640px){
  .topline-columns,.topline-row-top{grid-template-columns:1fr 70px 58px}
  .topline-pct{font-size:18px}
  .projected-bar-row{grid-template-columns:74px 1fr 44px}
  .projected-bar-delta{display:none}
  .grid{grid-template-columns:1fr}
}
`;
