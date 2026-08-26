"use client";

/**
 * ELECTION NIGHT BOARD — August 25, 2026 · Oklahoma, South Carolina, Georgia runoffs.
 *
 * Rendered at two routes from one component:
 *   variant="board" → /results/tonight, headline race plus the full slate
 *   variant="race"  → /results/2026-08-25/oklahoma-governor-republican-runoff,
 *                     the Governor runoff alone, for search
 *
 * STRUCTURE AUTHORITY
 *   The August 18 Florida board (results/archive/2026-08-18). Layout, section
 *   order and component anatomy are inherited unchanged.
 *
 * WHY THIS ISN'T THE FLORIDA BOARD
 *   Two candidates, not four, so the county map is a true divergent ramp rather
 *   than leader-colour-at-intensity. There is no banked-ballot feed for
 *   Oklahoma, so turnout is a prior throughout. And a second race carries a
 *   published forecast — South Carolina — with no county model behind it.
 *
 * TWO FORECASTS, TWO DIFFERENT THINGS
 *   Oklahoma has a TPSI poll (n=460, August 21–23) decomposed to 77 counties.
 *   South Carolina has no poll at all: its win probability is a desk judgement
 *   and its margin is derived from it. Both are labelled as what they are, and
 *   the South Carolina panel gets a results-only map because there is no county
 *   model to draw. Do not paper over that difference.
 *
 * WHERE THE NUMBERS COME FROM
 *   Statewide probability and the race call come from the statewide model, never
 *   from aggregating the 77 county intervals. The county layer exists to say how
 *   much vote is outstanding and where. See the header of
 *   _data/okCountyForecast.ts before changing any of it.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getRaceState,
  getMsLeftToClose,
  formatCountdown,
  type RaceState,
} from "../_lib/raceState";
import OklahomaCountyMap, { CAND_CSS } from "./OklahomaCountyMap";
import OklahomaCountyTable from "./OklahomaCountyTable";
import SouthCarolinaCountyMap, { SC_CAND_CSS, type ScLiveCounty } from "./SouthCarolinaCountyMap";
import { projectCounties, COUNTY_COMPLETE_PCT, type LiveCounty } from "./countyForecast";
import {
  CANDIDATE_ORDER,
  CANDIDATE_LAST,
  CANDIDATE_NAMES,
  CANDIDATE_MATCH,
  FORECAST_META,
  STATEWIDE_FORECAST,
  TURNOUT_MODEL,
  type CandidateKey,
} from "../_data/okCountyForecast";
import {
  SC_CANDIDATE_ORDER,
  SC_CANDIDATE_LAST,
  SC_CANDIDATE_MATCH,
  SC_FORECAST,
  SC_FORECAST_META,
  SC_TURNOUT_MODEL,
  type ScCandidateKey,
} from "../_data/scSenateForecast";
import { forecastRace, type Shares3 } from "../../lib/electoralModel";
import { evaluateCall } from "../../lib/raceCall";

const OK_GOV_R = 87529;
const SC_SEN_R = 87534;
const REFRESH_MS = 30_000;
export const RACE_SLUG = "oklahoma-governor-republican-runoff";

/* ═════════════════════ SLATE ═════════════════════ */

interface Entry {
  id: number; state: string; title: string; sub?: string;
  close: string; final: boolean;
}

const STATE_NAME: Record<string, string> = {
  OK: "Oklahoma", SC: "South Carolina", GA: "Georgia",
};
const STATE_ORDER = ["OK", "SC", "GA"] as const;

/** Oklahoma is entirely on Central time: 7:00 PM CT is 8:00 PM ET, statewide,
 *  with no split like Florida's Panhandle. South Carolina and Georgia are
 *  entirely Eastern and close at 7:00 PM ET. */
const OK_C = "2026-08-25T20:00:00-04:00";
const SC_C = "2026-08-25T19:00:00-04:00";
const GA_C = "2026-08-25T19:00:00-04:00";

/**
 * No projection may be published while an Oklahoma poll is still open. Unlike
 * Florida there is no intra-state split, so this is simply the statewide close.
 * A hard floor on top of the 3σ test and the 35% reporting floor in raceCall —
 * never lower it to chase a call. An official AP call is a report of someone
 * else's decision, not ours, and is not embargoed.
 */
const CALL_EMBARGO_MS = new Date(OK_C).getTime();

/** Reported results only, no model, no projection zone. */
const SLATE: Entry[] = [
  { id: 87530, state: "OK", title: "Insurance Commissioner", sub: "Republican runoff", close: OK_C, final: true },
  { id: 87531, state: "OK", title: "Commissioner of Labor", sub: "Republican runoff", close: OK_C, final: true },
  { id: 87532, state: "OK", title: "Supt. of Public Instruction", sub: "Republican runoff", close: OK_C, final: true },
  { id: 87533, state: "OK", title: "U.S. Senate", sub: "Democratic runoff", close: OK_C, final: true },

  { id: 87536, state: "GA", title: "U.S. House 13", sub: "Runoff", close: GA_C, final: true },
];

const ALL_IDS = new Set<number>([OK_GOV_R, SC_SEN_R, ...SLATE.map((e) => e.id)]);

/* ═════════════════════ MODEL ═════════════════════ */

const MODEL = {
  title: "Oklahoma Governor Republican Runoff",
  state: "Oklahoma",
  close: OK_C,
  raceRule: FORECAST_META.raceRule,
  deck:
    "Gentner Drummond and Mike Mazzei finish a runoff neither led outright in June. " +
    "The TPSI model separates them by less than a point and a half — inside its own " +
    "margin of error — with Drummond ahead on the strength of rural and western " +
    "Oklahoma and Mazzei holding the two metros. Whoever finishes first takes the " +
    "nomination; there is nothing after this.",
  headline:
    `The model has Drummond ahead by ${STATEWIDE_FORECAST.margin.toFixed(1)} points, ` +
    "well inside its margin of error. Oklahoma County and Tulsa County together cast " +
    "under a third of the expected vote and the model has Mazzei narrowly carrying " +
    "both, which means this is decided in the seventy-five counties outside them.",
};

/** Fixed to the model prior below — never key off vote rank, which inverts on a
 *  lead change. */
const CAND_KEYS: Record<"Candidate1" | "Candidate2", CandidateKey> = {
  Candidate1: "drummond",
  Candidate2: "mazzei",
};

const CAND_NAMES = {
  Candidate1: CANDIDATE_LAST.drummond,
  Candidate2: CANDIDATE_LAST.mazzei,
  Candidate3: "—",
} as const;

/** A runoff has two names, so the engine's third slot is held at zero. */
const POLL_PRIOR: Shares3 = {
  Candidate1: STATEWIDE_FORECAST.drummond / 100,
  Candidate2: STATEWIDE_FORECAST.mazzei / 100,
  Candidate3: 0,
};

/**
 * Editorial override. Null means the model calls the race on its own at 3σ.
 * Set this to force or withhold a projection; an AP call always supersedes it.
 */
const DESK_CALL: { key: CandidateKey; at: string } | null = null;

/* ═════════════════════ DATA ═════════════════════ */

const SEARCH =
  "https://civicapi.org/api/v2/race/search?startDate=2026-08-25&endDate=2026-08-25&limit=50000";

type Cand = { name?: string; party?: string; votes?: number; percent?: number; winner?: boolean };
type Race = { id: number; candidates?: Cand[]; percent_reporting?: number };

function useSlate(enabled: boolean) {
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
    if (!enabled) return;
    alive.current = true;
    pull();
    const t = setInterval(pull, REFRESH_MS);
    return () => { alive.current = false; clearInterval(t); };
  }, [pull, enabled]);

  return { races, updated, stale, refresh: pull };
}

/**
 * The feed's spelling of a county does not always match the Census spelling our
 * geometry and forecast are keyed on. Only one collision exists across the two
 * states on this board, but an unmatched county fails silently — it simply
 * never appears on the map or in the swing estimate — so it is worth pinning.
 */
const COUNTY_ALIASES: Record<string, string> = {
  LEFLORE: "LE FLORE",   // Oklahoma; Census spells it as two words
};

/**
 * Counties the desk still has counting. The feed and the state board agree on
 * every vote total but not on precinct counts, so the feed leaves counties open
 * that have in fact finished. Anything absent from this map is done.
 *
 * These are a floor, never a pin: where the feed reports higher it wins, so a
 * county here still closes itself out and nothing can freeze below the count.
 */
const COUNTY_STILL_COUNTING: Record<string, number> = {
  STEPHENS: 78,
  TULSA: 81,
  OKLAHOMA: 81,
  KAY: 82,
};

/**
 * County returns and the full candidate field from CivicAPI. The search endpoint
 * behind the slate truncates to the top three candidates, and electionLib's
 * fetchRace memoises a race forever, so neither is usable for a race we are
 * modelling live. This hits the detail endpoint uncached.
 *
 * @param keys   candidate keys to bucket county votes into
 * @param match  substring identifying each candidate in the feed
 */
function useRaceDetail<K extends string>(
  raceId: number,
  keys: readonly K[],
  match: Record<K, string>,
) {
  const [counties, setCounties] = useState<Record<string, { votes: Record<K, number>; total: number; reporting: number }>>({});
  const [detail, setDetail] = useState<Race | null>(null);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    const pull = async () => {
      try {
        const res = await fetch(`https://civicapi.org/api/v2/race/${raceId}`,
                                { cache: "no-store", signal: ac.signal });
        if (!res.ok) throw new Error(String(res.status));
        const payload = await res.json();
        if (!alive) return;
        setDetail(payload?.candidates?.length ? (payload as Race) : null);
        const rr = payload?.region_results || {};
        const out: Record<string, { votes: Record<K, number>; total: number; reporting: number }> = {};
        for (const regionKey of Object.keys(rr)) {
          const r = rr[regionKey];
          const raw = String(r?.name || regionKey).replace(/\s+county$/i, "").trim().toUpperCase();
          const name = COUNTY_ALIASES[raw] || raw;
          if (!name) continue;
          const votes = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
          let total = 0;
          for (const c of r?.candidates || []) {
            const n = String(c?.name || "").toLowerCase();
            const v = Number(c.votes) || 0;
            const hit = keys.find((k) => n.includes(match[k]));
            // Votes for anyone we don't recognise still count toward the total,
            // so a stray write-in cannot inflate either candidate's share.
            if (hit) votes[hit] += v;
            total += v;
          }
          out[name] = { votes, total, reporting: Number(r?.percent_reporting) || 0 };
        }
        setCounties(out);
      } catch {
        // No county feed yet. The board renders the baseline, which is the truth.
      }
    };
    pull();
    const t = setInterval(pull, REFRESH_MS);
    return () => { alive = false; ac.abort(); clearInterval(t); };
  }, [raceId, keys, match]);

  return { counties, detail };
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

/** Design System §6 — >99 and <1 at the extremes; nothing prints a flat 100. */
const pctLabel = (p: number) =>
  p >= 99.95 ? ">99" : p > 0 && p < 0.05 ? "<1" : p.toFixed(1);

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;

/** Guard against a bad precinct update implying an absurd statewide total. */
const IMPLIED_CAP = 10;

/**
 * Projects total ballots cast from the count so far.
 *
 * Completeness has to come from precincts. Feeding in a reporting figure that
 * was itself derived from the turnout prior makes the implied total equal that
 * prior by construction — counted / (counted / prior) is just prior — so the
 * projection can never move off its own assumption no matter how the night
 * goes. Precincts are the only signal that says how much of the count is done
 * without reference to how big we guessed the electorate would be.
 *
 * With no precincts in there is genuinely no information about turnout, so this
 * returns the prior. Mirrors the blend in electoralModel step 1 at blend_k = 1.
 */
function projectTurnout(countedVotes: number, precinctPct: number, prior: number) {
  const pct = clampPct(precinctPct) / 100;
  if (pct <= 0) return Math.max(prior, countedVotes);
  const implied = Math.min(countedVotes / pct, prior * IMPLIED_CAP);
  return Math.max((1 - pct) * prior + pct * implied, countedVotes);
}

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
  if (i === 2) return "var(--k3)";
  return "var(--ink3)";
};

/** Both runoff candidates are Republicans, so party colour carries no
 *  information. Colour by identity, never by vote rank — rank inverts on a
 *  lead change and would swap the colours out from under the map. */
const identityTone = <K extends string>(
  c: Cand,
  keys: readonly K[],
  match: Record<K, string>,
  css: Record<K, string>,
) => {
  const n = String(c.name || "").toLowerCase();
  const k = keys.find((key) => n.includes(match[key]));
  return k ? css[k] : "var(--k5)";
};

const closeAt = (e: { close: string; final: boolean }) => {
  const t = new Date(e.close).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
  return `${e.final ? "Final close" : "Close"} ${t} ET`;
};

/** Standard normal CDF, Abramowitz & Stegun 26.2.17. */
function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-(z * z) / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 +
            t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/** Sentence-case status, matching the prototype's race-meta block. */
const STATUS_COPY: Record<RaceState, string> = {
  SCHEDULED: "Polls open",
  LIVE_GATED: "Too early to call",
  LIVE_FORECAST: "Counting",
  PROJECTED: "TPSI projection",
  OFFICIAL: "Race called",
};

/* ═════════════════════ BOARD ═════════════════════ */

export default function OklahomaBoard({ variant = "board" }: { variant?: "board" | "race" }) {
  const full = variant === "board";
  const { races, updated, stale, refresh } = useSlate(true);
  const now = useNow();
  const [mapMode, setMapMode] = useState<"margin" | "turnout">("margin");
  // Null means follow the count. An explicit pick sticks.
  const [countyChoice, setCountyChoice] = useState<"forecast" | "results" | null>(null);

  const { counties: liveCountiesRaw, detail: govDetail } =
    useRaceDetail(OK_GOV_R, CANDIDATE_ORDER, CANDIDATE_MATCH);
  const { counties: scCounties, detail: scDetail } =
    useRaceDetail(SC_SEN_R, SC_CANDIDATE_ORDER, SC_CANDIDATE_MATCH);

  const liveCounties = useMemo(() => {
    const raw = liveCountiesRaw as Record<string, LiveCounty>;
    const out: Record<string, LiveCounty> = {};
    for (const [name, c] of Object.entries(raw)) {
      // A county with nothing in is not finished, it just has not started.
      if (c.total <= 0) {
        out[name] = c;
        continue;
      }
      const reporting = Math.max(c.reporting, COUNTY_STILL_COUNTING[name] ?? 100);
      out[name] = { ...c, reporting: reporting >= COUNTY_COMPLETE_PCT ? 100 : reporting };
    }
    return out;
  }, [liveCountiesRaw]);

  // No banked-ballot feed exists for Oklahoma the way Fresh Take covers
  // Florida, so registration and history set the opening turnout prior. The
  // count then moves it: forecastRace blends this against the total implied by
  // precincts reporting, so the projection tightens as the night goes on.
  const turnoutBasis = TURNOUT_MODEL.projected;

  // The detail payload carries the whole field; the slate entry carries the
  // registry fields the detail endpoint omits. Detail wins where they overlap.
  const gov = useMemo(() => {
    const base = races[OK_GOV_R];
    if (!govDetail) return base;
    return { ...(base ?? { id: OK_GOV_R }), ...govDetail } as Race;
  }, [races, govDetail]);
  const live = isLive(gov);

  // Before any votes land both candidates are on zero, so the feed's own order
  // is arbitrary. Rank by the model prior instead.
  const cands = useMemo(() => {
    const all = sortC(gov);
    if (live) return all;
    const rank = (c: Cand) => {
      const n = String(c.name || "").toLowerCase();
      const i = CANDIDATE_ORDER.findIndex((k) => n.includes(CANDIDATE_MATCH[k]));
      return i === -1 ? CANDIDATE_ORDER.length : i;
    };
    return [...all].sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
  }, [gov, live]);

  // Oklahoma counts its absentee and early-voting boards before precincts close
  // out, so the feed's precinct percentage understates how much of the
  // electorate is already counted. EST. REPORTING leads (raceState §2) and is
  // measured against the electorate; PRECINCTS stays visible as its own number.
  const precinctRep = estRep(gov);
  const msLeft = getMsLeftToClose(MODEL.close, now);

  const stamp = updated
    ? updated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + " ET"
    : "—";

  const grouped = useMemo(
    () =>
      STATE_ORDER.map((st) => ({
        key: st,
        label: STATE_NAME[st],
        races: SLATE.filter((e) => e.state === st),
      })).filter((g) => g.races.length > 0),
    [],
  );

  const leadGap = live && cands.length > 1 ? (cands[0].votes || 0) - (cands[1].votes || 0) : 0;
  const leadMarginPP =
    live && cands.length > 1 ? share(cands[0], cands) - share(cands[1], cands) : 0;

  // Statewide vote mechanics. With no returns in, percent_reporting is 0 and
  // this reproduces the pre-election prior exactly.
  const fc = useMemo(() => {
    const all = sortC(gov);
    const total = counted(gov);
    const votesFor = (needle: string) =>
      all
        .filter((c) => String(c.name || "").toLowerCase().includes(needle))
        .reduce((s, c) => s + (c.votes || 0), 0);

    return forecastRace({
      race_rule: "PLURALITY",
      // Precincts, not our own vote-share estimate — see projectTurnout.
      percent_reporting: clampPct(precinctRep) / 100,
      reported_vote_total: total,
      expected_turnout: turnoutBasis,
      reported_share: {
        Candidate1: total ? votesFor(CANDIDATE_MATCH.drummond) / total : 0,
        Candidate2: total ? votesFor(CANDIDATE_MATCH.mazzei) / total : 0,
        Candidate3: 0,
      },
      expected_share: POLL_PRIOR,
      // Required. Without it the projection allocates every outstanding ballot
      // at the poll share forever and never learns from the count.
      poll_avg_shares: POLL_PRIOR,
    });
  }, [gov, turnoutBasis, precinctRep]);

  // Share of the projected electorate counted, which runs ahead of precincts
  // while the early-vote boards are being reported.
  const rep = live ? clampPct(fc.modeled_percent_reporting * 100) : 0;

  const call = useMemo(() => evaluateCall(fc, CAND_NAMES), [fc]);

  const counties = useMemo(
    () => projectCounties(liveCounties, fc.modeled_total_vote),
    [liveCounties, fc.modeled_total_vote],
  );

  const countiesReporting = useMemo(
    () => Object.values(liveCounties).filter((c) => (c?.total ?? 0) > 0).length,
    [liveCounties],
  );

  // The forecast view is the one carrying information until counties land; after
  // that the actual returns lead.
  const countyView = countyChoice ?? (countiesReporting > 0 ? "results" : "forecast");

  // The projected result is the county roll-up: it carries the shrunk swing.
  const projected = counties.statewide;
  const ranked = useMemo(
    () =>
      CANDIDATE_ORDER.map((k) => ({ k, share: projected.shares[k] })).sort(
        (a, b) => b.share - a.share,
      ),
    [projected],
  );
  const leaderKey = ranked[0].k;
  const marginPP = ranked[0].share - ranked[1].share;
  const modeledRep = fc.modeled_percent_reporting * 100;

  /**
   * Margin uncertainty contracts with the pool of outstanding vote, anchored to
   * the published pre-election SD. The generic statewide engine carries an sd
   * calibrated for multi-candidate primaries; in a two-way runoff it is roughly
   * two and a half times too wide at the start, which would show a probability
   * that jumps the moment the first vote lands. Scaling the published SD by
   * √(1 − reported) is the same form the county intervals already use, so the
   * board is internally consistent and continuous from prior to final count.
   */
  const marginSdPP = Math.max(
    STATEWIDE_FORECAST.marginSd * Math.sqrt(Math.max(0, 1 - fc.modeled_percent_reporting)),
    0.1,
  );
  const marginLo = marginPP - 2 * marginSdPP;
  const marginHi = marginPP + 2 * marginSdPP;

  const winProb = useMemo(() => {
    // Before any votes land the engine has nothing to add to the published
    // simulation, so show the published simulation rather than a re-derivation.
    if (!live) {
      return {
        drummond: STATEWIDE_FORECAST.winProbability.drummond,
        mazzei: STATEWIDE_FORECAST.winProbability.mazzei,
      } as Record<CandidateKey, number>;
    }
    const pLeader = phi(marginPP / marginSdPP) * 100;
    return {
      [leaderKey]: pLeader,
      [ranked[1].k]: 100 - pLeader,
    } as Record<CandidateKey, number>;
  }, [live, marginPP, marginSdPP, leaderKey, ranked]);

  const embargoLifted = now >= CALL_EMBARGO_MS;
  // Would call on the numbers alone, but Oklahoma is still voting.
  const embargoed = live && !embargoLifted && call.verdict === "CALLABLE";

  const deskCalled = DESK_CALL !== null && live && embargoLifted;
  const modelCalled = live && embargoLifted && call.verdict === "CALLABLE";
  const projectedKey: CandidateKey | null = deskCalled
    ? DESK_CALL!.key
    : modelCalled
      ? CAND_KEYS[call.leader as keyof typeof CAND_KEYS] ?? leaderKey
      : null;

  const rState = getRaceState({
    percentReporting: live ? rep : 0,
    hasOfficialCall: officialCall(gov),
    tpsiCalled: projectedKey !== null,
  });

  const headline = projectedKey
    ? `TPSI projects ${CANDIDATE_NAMES[projectedKey]} wins the Republican nomination. ` +
      `He leads by ${int(leadGap)} votes with ${pctLabel(modeledRep)}% of the estimated ` +
      `vote counted, and the projected margin of ${signed(marginPP)} sits beyond what the ` +
      `outstanding ballots can move.`
    : embargoed
      ? `${CAND_NAMES[call.leader as keyof typeof CAND_NAMES] ?? CANDIDATE_LAST[leaderKey]} ` +
        `leads by ${int(leadGap)} votes, far enough ahead that the model would call it. ` +
        `Oklahoma polls do not close until 8:00 PM ET, in ${formatCountdown(msLeft)}, and ` +
        `TPSI publishes no projection while any Oklahoma voter is still in line.`
      : live
        ? call.line
        : MODEL.headline;

  // AP's call always wins the chip; ours is labelled as ours.
  const statusCopy =
    rState === "OFFICIAL"
      ? STATUS_COPY.OFFICIAL
      : projectedKey
        ? `TPSI projection — ${CANDIDATE_LAST[projectedKey]}`
        : embargoed
          ? "Held — polls open"
          : live && call.verdict === "LEANING"
            ? "Leaning"
            : STATUS_COPY[rState];

  /* ── South Carolina ── */

  const sc = useMemo(() => {
    const base = races[SC_SEN_R];
    if (!scDetail) return base;
    return { ...(base ?? { id: SC_SEN_R }), ...scDetail } as Race;
  }, [races, scDetail]);
  const scLive = isLive(sc);
  const scCands = useMemo(() => {
    const all = sortC(sc);
    if (scLive) return all;
    const rank = (c: Cand) => {
      const n = String(c.name || "").toLowerCase();
      const i = SC_CANDIDATE_ORDER.findIndex((k) => n.includes(SC_CANDIDATE_MATCH[k]));
      return i === -1 ? SC_CANDIDATE_ORDER.length : i;
    };
    return [...all].sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
  }, [sc, scLive]);
  const scCounted = counted(sc);
  const scPrecinct = estRep(sc);
  const scProjectedTurnout = projectTurnout(
    scCounted,
    scPrecinct,
    SC_TURNOUT_MODEL.projected,
  );
  const scRep =
    scProjectedTurnout > 0 ? clampPct((scCounted / scProjectedTurnout) * 100) : 0;
  const scMsLeft = getMsLeftToClose(SC_C, now);
  const scCountiesReporting = useMemo(
    () => Object.values(scCounties).filter((c) => c.total > 0).length,
    [scCounties],
  );

  /**
   * South Carolina has no poll and no county model, but it does have a count,
   * and a probability that ignores the count is just a number we typed. The
   * prior migrates toward the returns in proportion to how much is counted, and
   * the SD contracts by √(1 − reported) — the same form Oklahoma's margin and
   * the county intervals already use, so the two panels behave alike.
   *
   * At zero reporting this reproduces the published 57.9% exactly; at a full
   * count the prior has no weight left and the probability is the result.
   */
  const scModel = useMemo(() => {
    const all = sortC(sc);
    const total = counted(sc);
    const votesFor = (needle: string) =>
      all
        .filter((c) => String(c.name || "").toLowerCase().includes(needle))
        .reduce((s, c) => s + (c.votes || 0), 0);

    const pct = clampPct(scLive ? scRep : 0) / 100;
    const prior = { graham: SC_FORECAST.graham, norman: SC_FORECAST.norman };

    const shares = { ...prior };
    if (total > 0) {
      for (const k of SC_CANDIDATE_ORDER) {
        const obs = (votesFor(SC_CANDIDATE_MATCH[k]) / total) * 100;
        shares[k] = obs * pct + prior[k] * (1 - pct);
      }
      const sum = shares.graham + shares.norman;
      if (sum > 0) {
        for (const k of SC_CANDIDATE_ORDER) shares[k] = (shares[k] / sum) * 100;
      }
    }

    const margin = shares.graham - shares.norman;
    const sd = Math.max(SC_FORECAST.marginSd * Math.sqrt(Math.max(0, 1 - pct)), 0.1);
    const pGraham = phi(margin / sd) * 100;

    const leader: ScCandidateKey = margin >= 0 ? "graham" : "norman";
    return {
      shares,
      margin,
      sd,
      leader,
      runnerUp: (leader === "graham" ? "norman" : "graham") as ScCandidateKey,
      winProbability: { graham: pGraham, norman: 100 - pGraham },
    };
  }, [sc, scLive, scRep]);

  const scLeaderProb = scModel.winProbability[scModel.leader];

  return (
    <div className="desk">
      <style>{CSS}</style>

      <main className="shell">

        {/* ═══ RACE HEADER ═══ */}
        <section className="race-header" id="overview" aria-labelledby="race-title">
          {!full && (
            <div className="archive-banner">
              <span>August 25, 2026</span>
              <a href="/results/tonight">Full election night board →</a>
            </div>
          )}
          <div className="race-kicker">
            {live && rState !== "OFFICIAL" && <span className="live-dot" aria-hidden />}
            <span>{MODEL.state} runoff · August 25</span>
            <span>•</span>
            <span>Statewide forecast · county projection</span>
          </div>

          <div className="race-heading-row">
            <div>
              <h1 id="race-title">{MODEL.title}</h1>
              <p className="race-deck">{MODEL.deck}</p>
            </div>
            <div className="race-meta" aria-label="Race update summary">
              <div className="meta-block"><span>Last updated</span><b>{stamp}</b></div>
              <div className="meta-block"><span>Reported votes</span><b>{live ? int(counted(gov)) : "0"}</b></div>
              <div className="meta-block"><span>Estimated reporting</span><b>{live ? `${pctLabel(rep)}%` : "0%"}</b></div>
              <div className="meta-block"><span>Precincts</span><b>{live ? `${pctLabel(precinctRep)}%` : "0%"}</b></div>
              <div className="meta-block"><span>Race status</span><b>{statusCopy}</b></div>
            </div>
          </div>

          <nav className="race-tabs" aria-label="Race sections">
            <a href="#overview" aria-current="page">Overview</a>
            <a href="#forecast">Forecast</a>
            <a href="#counties">Counties</a>
            <a href="#south-carolina">South Carolina</a>
            {full && <a href="#board">All races</a>}
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

              {cands.length > 0 ? (
                <>
                  {!live && (
                    <p className="prose empty-note">
                      Oklahoma votes on Central time, so polls close statewide at 8:00 PM ET,
                      in {formatCountdown(msLeft)}. Both candidates are listed below and
                      fill in automatically as votes are counted.
                    </p>
                  )}
                  {cands.map((c, i) => {
                    const p = share(c, cands);
                    const col = identityTone(c, CANDIDATE_ORDER, CANDIDATE_MATCH, CAND_CSS);
                    const isProjected =
                      !c.winner &&
                      projectedKey !== null &&
                      String(c.name || "").toLowerCase().includes(CANDIDATE_MATCH[projectedKey]);
                    return (
                      <div className="topline-row" key={c.name || i}>
                        <div className="topline-row-top">
                          <div className="topline-candidate">
                            <span className="topline-dot" style={{ background: col }} />
                            <div className="topline-copy">
                              <strong>{c.name}</strong>
                              <small>{c.party || "Republican"}</small>
                              {i === 0 && leadGap > 0 && !c.winner && !isProjected && (
                                <span className="topline-lead">Leads by {int(leadGap)} votes</span>
                              )}
                              {isProjected && (
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
                  })}
                </>
              ) : (
                <div className="empty-live">
                  <p className="prose">
                    Waiting on the first candidate list from the feed. Oklahoma votes on
                    Central time, so the state closes at 8:00 PM ET, in{" "}
                    {formatCountdown(msLeft)}.
                  </p>
                </div>
              )}

              <div className="topline-foot">
                <span>{live ? `${int(counted(gov))} votes counted` : "No votes counted"}</span>
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

              <div className="forecast-model-layout">
                <div className="forecast-hero">
                  <div className="model-label">Win probability</div>
                  <div className="prob-ring"
                       style={{
                         ["--value" as string]: winProb[leaderKey] ?? 0,
                         ["--ring" as string]: CAND_CSS[leaderKey],
                       } as React.CSSProperties}
                       role="img"
                       aria-label={`Win probability: ${CANDIDATE_LAST[leaderKey]} ${(winProb[leaderKey] ?? 0).toFixed(1)} percent`}>
                    <div className="ring-center">
                      <b>{pctLabel(winProb[leaderKey] ?? 0)}%</b>
                      <span>{CANDIDATE_LAST[leaderKey]}</span>
                    </div>
                  </div>
                </div>

                <div className="forecast-support">
                  <div>
                    <div className="model-label">Top outcomes</div>
                    {CANDIDATE_ORDER.map((k) => (
                      <div className="outcome-row" key={k}>
                        <i style={{ background: CAND_CSS[k] }} aria-hidden />
                        <span>{CANDIDATE_LAST[k]} wins</span>
                        <b>{pctLabel(winProb[k] ?? 0)}%</b>
                      </div>
                    ))}
                    {/* A runoff has two names and no residual: the two
                        probabilities are complementary by construction. */}
                    <div className="outcome-row muted">
                      <i style={{ background: "var(--ink3)" }} aria-hidden />
                      <span>No third option</span>
                      <b>—</b>
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
            </section>

            <section className="projection-zone" aria-label="Forecasted final result">
              <div className="projected-top">
                <div className="projected-intro">
                  <span className="model-label">
                    {projectedKey ? "TPSI projection" : "Model projection · not actual results"}
                  </span>
                  <div className="projected-name">
                    {projectedKey
                      ? `${CANDIDATE_LAST[projectedKey]} wins`
                      : `${CANDIDATE_LAST[leaderKey]} projected ahead`}
                  </div>
                  <p className="projection-headline prose">{headline}</p>
                </div>
                <div className="projected-margin-wrap">
                  <span>Projected margin</span>
                  <b style={{ color: CAND_CSS[leaderKey] }}>{signed(marginPP)}</b>
                  <small>{CANDIDATE_LAST[leaderKey]} over {CANDIDATE_LAST[ranked[1].k]}</small>
                </div>
              </div>

              <div className="projection-head">
                <div>
                  <strong>Projected final vote share</strong>
                  <small>
                    Muted bars indicate a forecast, not certified results. They use
                    the same 0 to 100% scale as the reported-results bars, and are
                    the sum of all 77 county projections.
                  </small>
                </div>
                <span className="model-label">Forecast only</span>
              </div>

              <div className="projected-bars">
                {ranked.map(({ k, share: s }) => {
                  const liveCand = cands.find((x) =>
                    String(x.name || "").toLowerCase().includes(CANDIDATE_MATCH[k]),
                  );
                  const actual = live && liveCand ? share(liveCand, cands) : null;
                  const delta = actual != null ? s - actual : null;
                  return (
                    <div className="projected-bar-row" key={k}>
                      <div className="projected-bar-name">
                        <i style={{ background: CAND_CSS[k] }} aria-hidden />
                        <span>{CANDIDATE_LAST[k]}</span>
                      </div>
                      {/* Projected fill is muted and dashed, never solid */}
                      <div className="projected-bar-track">
                        <span className="projected-bar-fill"
                              style={{ width: `${s}%`, borderColor: CAND_CSS[k] }} />
                      </div>
                      <div className="projected-bar-value">{s.toFixed(1)}%</div>
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
                <div><span>Margin SD</span><b>±{marginSdPP.toFixed(1)} pts</b></div>
                <div>
                  <span>Margin range (95%)</span>
                  <b>{signed(marginLo)} to {signed(marginHi)}</b>
                </div>
              </div>

              <div className="no-history">No history snapshots · live data only</div>
            </section>
          </article>
        </div>

        {/* ═══ COUNTY BOARD ═══ */}
        <section id="counties" className="county card"
                 aria-label="Oklahoma county map and county-by-county detail">
          <div className="county-head">
            <div className="rd-view-toggles" role="group" aria-label="County view">
              <button type="button" className={countyView === "forecast" ? "on" : ""}
                      onClick={() => setCountyChoice("forecast")}>forecast</button>
              <button type="button" className={countyView === "results" ? "on" : ""}
                      onClick={() => setCountyChoice("results")}>results</button>
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
            <OklahomaCountyMap view={countyView} mode={mapMode}
                               counties={counties.byName} liveCounties={liveCounties} />
            {countyView === "results" && !live && (
              // An all-grey map is the honest rendering of zero returns, but it reads
              // as a broken map unless we say so.
              <div className="map-empty">
                <p>No county has reported yet.</p>
                <p className="map-empty-sub">
                  Counties fill in as their votes land. Until then, the forecast view is
                  the one carrying information.
                </p>
              </div>
            )}
          </div>

          <div className="rd-map-legend">
            {countyView === "forecast" && mapMode === "turnout" ? (
              <>
                <span className="rd-map-legend-sw"
                      style={{ background: "linear-gradient(90deg,var(--ramp-lo),rgb(15,95,85))" }} />
                <span>lower → higher projected turnout</span>
              </>
            ) : (
              <>
                <span className="rd-map-legend-sw"
                      style={{ background: "linear-gradient(90deg,#134453,var(--ramp-mid),#6e241d)" }} />
                {CANDIDATE_ORDER.map((k) => (
                  <span className="rd-key" key={k}>
                    <i style={{ background: CAND_CSS[k] }} aria-hidden />
                    {CANDIDATE_LAST[k]}
                  </span>
                ))}
                <span className="rd-map-legend-note">
                  depth = margin
                  {countyView === "forecast" && " · hatched = too close to call"}
                </span>
              </>
            )}
            <span className="rd-map-hint">scroll or pinch to zoom · drag to pan</span>
          </div>

          <p className="county-caveat prose">
            County projections are demographic estimates, not local polling:{" "}
            {FORECAST_META.interviewsReported} interviews across {FORECAST_META.countyCount}{" "}
            counties, a median of three per county, and{" "}
            {FORECAST_META.countiesTooCloseToCall} of {FORECAST_META.countyCount} with a 90%
            interval that crosses zero. We do not call counties. They are here to show where
            the outstanding vote sits — projected turnout is drawn from registration and
            past runoffs, and is far more reliable than any county share.
          </p>

          <OklahomaCountyTable view={countyView} counties={counties.list}
                               liveCounties={liveCounties} />
        </section>

        {/* ═══ SOUTH CAROLINA ═══ */}
        <section id="south-carolina" className="card sc-zone"
                 aria-labelledby="sc-title">
          <div className="sc-head">
            <div>
              <div className="race-kicker">
                {scLive && <span className="live-dot" aria-hidden />}
                <span>South Carolina · August 25</span>
                <span>•</span>
                <span>Statewide forecast · no county model</span>
              </div>
              <h2 id="sc-title">U.S. Senate Special Republican Runoff</h2>
              <p className="prose sc-deck">
                TPSI gives {SC_CANDIDATE_LAST[scModel.leader]} a{" "}
                {scLeaderProb.toFixed(0)}% chance of winning the nomination.{" "}
                <strong>There is no TPSI poll of this runoff.</strong> The starting
                probability was a desk judgement from the first round, the endorsements
                since, and how runoff electorates have behaved here before — not a survey.
                {scLive
                  ? " It now moves with the count, and the counted vote carries more of it as more comes in."
                  : " The margin below is derived from the probability, not measured."}
              </p>
            </div>
            <div className="sc-prob">
              <div className="model-label">Win probability</div>
              <div className="prob-ring sm"
                   style={{
                     ["--value" as string]: scLeaderProb,
                     ["--ring" as string]: SC_CAND_CSS[scModel.leader],
                   } as React.CSSProperties}
                   role="img"
                   aria-label={`Win probability: ${SC_CANDIDATE_LAST[scModel.leader]} ${scLeaderProb.toFixed(0)} percent`}>
                <div className="ring-center">
                  <b>{scLeaderProb.toFixed(0)}%</b>
                  <span>{SC_CANDIDATE_LAST[scModel.leader]}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="sc-grid">
            <div className="sc-col">
              <div className="model-label">Reported results</div>
              {scCands.length > 0 ? (
                scCands.map((c, i) => {
                  const p = share(c, scCands);
                  const col = identityTone(c, SC_CANDIDATE_ORDER, SC_CANDIDATE_MATCH, SC_CAND_CSS);
                  return (
                    <div className="topline-row" key={c.name || i}>
                      <div className="topline-row-top">
                        <div className="topline-candidate">
                          <span className="topline-dot" style={{ background: col }} />
                          <div className="topline-copy">
                            <strong>{c.name}</strong>
                            <small>{c.party || "Republican"}</small>
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
                <p className="prose sc-note">
                  Polls close at 7:00 PM ET, in {formatCountdown(scMsLeft)}. Candidates
                  appear as soon as the feed carries them.
                </p>
              )}

              <div className="model-label sc-sub">Forecast</div>
              <div className="projected-bars">
                {SC_CANDIDATE_ORDER.map((k) => {
                  const liveCand = scCands.find((x) =>
                    String(x.name || "").toLowerCase().includes(SC_CANDIDATE_MATCH[k]),
                  );
                  const actual = scLive && liveCand ? share(liveCand, scCands) : null;
                  const delta = actual != null ? scModel.shares[k] - actual : null;
                  return (
                    <div className="projected-bar-row" key={k}>
                      <div className="projected-bar-name">
                        <i style={{ background: SC_CAND_CSS[k] }} aria-hidden />
                        <span>{SC_CANDIDATE_LAST[k]}</span>
                      </div>
                      <div className="projected-bar-track">
                        <span className="projected-bar-fill"
                              style={{ width: `${scModel.shares[k]}%`, borderColor: SC_CAND_CSS[k] }} />
                      </div>
                      <div className="projected-bar-value">{scModel.shares[k].toFixed(1)}%</div>
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
                <div><span>Projected turnout</span><b>{int(scLive ? scProjectedTurnout : SC_TURNOUT_MODEL.projected)}</b></div>
                <div><span>First round</span><b>{int(SC_TURNOUT_MODEL.firstRound)}</b></div>
                <div><span>Votes counted</span><b>{scLive ? int(scCounted) : "0"}</b></div>
                <div><span>Est. reporting</span><b>{scLive ? `${pctLabel(scRep)}%` : "0%"}</b></div>
                <div>
                  <span>Projected margin</span>
                  <b style={{ color: SC_CAND_CSS[scModel.leader] }}>
                    {SC_CANDIDATE_LAST[scModel.leader]} {signed(Math.abs(scModel.margin))}
                  </b>
                </div>
                <div><span>Margin SD</span><b>±{scModel.sd.toFixed(1)}</b></div>
              </div>
            </div>

            <div className="sc-col">
              <div className="model-label">
                County results · {scCountiesReporting} of 46 reporting
              </div>
              <div className="sc-map-frame">
                <SouthCarolinaCountyMap counties={scCounties as Record<string, ScLiveCounty>} />
                {!scLive && (
                  <div className="map-empty">
                    <p>No county has reported yet.</p>
                    <p className="map-empty-sub">
                      This map shows reported votes only. There is no county forecast for
                      South Carolina, because there is no poll to build one from.
                    </p>
                  </div>
                )}
              </div>
              <div className="rd-map-legend">
                <span className="rd-map-legend-sw"
                      style={{ background: "linear-gradient(90deg,#134453,var(--ramp-mid),#6e241d)" }} />
                {SC_CANDIDATE_ORDER.map((k) => (
                  <span className="rd-key" key={k}>
                    <i style={{ background: SC_CAND_CSS[k] }} aria-hidden />
                    {SC_CANDIDATE_LAST[k]}
                  </span>
                ))}
                <span className="rd-map-legend-note">reported votes only</span>
              </div>
              <p className="prose sc-note">
                Turnout assumes {(SC_TURNOUT_MODEL.dropoffFactor * 100).toFixed(0)}% of the{" "}
                {int(SC_TURNOUT_MODEL.firstRound)} ballots cast in the first round —
                runoffs draw a fraction of the electorate that produced them. Everything
                on this panel other than the reported votes rests on that assumption and
                on the win probability. {SC_FORECAST_META.basis}
              </p>
            </div>
          </div>
        </section>

        {/* ═══ SCENARIO ENGINE ═══ */}
        <section className="engine-cta card">
          <div>
            <h2>Run it yourself</h2>
            <p className="prose">
              The scenario engine behind this county baseline is public. Set candidate
              performance by region and demographic, move turnout, and watch all 77
              counties recompute against the same model this board projects from.
            </p>
          </div>
          <a className="utility-button lg" href="/forecast">Open the forecast desk →</a>
        </section>

        {/* ═══ SLATE ═══ */}
        {full && (
          <section id="board" className="board">
            <div className="board-head">
              <div>
                <h2>All races tonight</h2>
                <p>Reported results only, no TPSI model.</p>
              </div>
              <div className="board-meta">
                <span className="model-label">{SLATE.length} races · 2 states</span>
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
                  {g.races.map((e) => <SlateCard key={e.id} entry={e} race={races[e.id]} />)}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ═══ METHOD ═══ */}
        <section id="method" className="method">
          <h2>Method</h2>
          <p className="prose">
            Reported vote is solid. Projected share is muted and dashed, on the same
            0 to 100% scale, and is the sum of all 77 county projections. Estimated
            reporting is the share of expected vote, not precincts. Race calls come from
            AP through CivicAPI; TPSI projects independently once the leader&rsquo;s margin
            clears three standard deviations of the outstanding vote and at least 35% is
            counted, and those projections are labeled as ours.
          </p>
          <p className="prose">
            The statewide probability is not built from the county intervals. County
            errors share one dominant statewide swing — if the model has Drummond wrong,
            it has him wrong in all 77 counties at once — so adding county variances
            independently would understate the real spread by roughly an order of
            magnitude. Probability comes from the statewide model, whose margin carries a
            standard deviation of {STATEWIDE_FORECAST.marginSd} points against a projected
            margin of {STATEWIDE_FORECAST.margin.toFixed(1)}. That standard deviation
            contracts with the outstanding vote as counties report. Field dates{" "}
            {FORECAST_META.fieldDates}, n={FORECAST_META.interviewsReported}, ±
            {FORECAST_META.marginOfError}.
          </p>
          <p className="prose">
            <strong>South Carolina is a different kind of number.</strong> No TPSI survey
            of that runoff exists. Its starting{" "}
            {SC_FORECAST.winProbability.graham.toFixed(0)}% figure was a desk judgement,
            and the {SC_FORECAST.margin.toFixed(1)}-point opening margin was derived from
            it by assuming a {SC_FORECAST.marginSd}-point standard deviation — wider than
            Oklahoma&rsquo;s precisely because there is no poll underneath it. As votes are
            counted that prior gives way to the returns in proportion to how much has
            reported, so the probability shown is now{" "}
            {scLive ? "mostly a reading of the count" : "still entirely the prior"}. There
            is no South Carolina county forecast, and the map on that panel paints reported
            votes only.
          </p>
          <p className="prose">
            <strong>All candidate estimates on this page are built from pre-election day
            data.</strong> The Oklahoma survey closed before polls opened and has not been
            updated since; nothing a voter did today is in the shares. Turnout is a
            registration-and-history prior of {int(TURNOUT_MODEL.projected)} ballots
            against {int(TURNOUT_MODEL.firstRound)} cast in the June first round and{" "}
            {int(TURNOUT_MODEL.registered)} registered Republicans.
          </p>
          <p className="prose">
            A turnout figure lower than a general election, or lower than the primary that
            produced this runoff, is not a forecast that fewer people will vote. It defines{" "}
            <em>which</em> electorate the shares describe: a runoff is a small,
            self-selected slice of a closed primary electorate, and every percentage here
            is a share of that slice and of nothing wider. Read these numbers as a
            description of the people who actually turned out, not as a prediction about
            the state.
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

/* ═════════════════════ SLATE CARD ═════════════════════ */

function SlateCard({ entry, race }: { entry: Entry; race?: Race }) {
  const all = sortC(race);
  const show = all.slice(0, 2);
  const live = isLive(race);
  const st = getRaceState({
    percentReporting: live ? estRep(race) : 0,
    hasOfficialCall: officialCall(race),
    tpsiCalled: false,
  });

  return (
    <div className="l4">
      <div className="l4-hd">
        <span className={`l4-dot ${partyOf(show[0]?.party || entry.sub)}`} />
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
/* Inherited from the August 18 board. Surface, ink, party and signal tokens come
   from globals.css so the desk flips with the site's data-theme; only desk-local
   values are declared here. */

const CSS = `
.desk{
  /* Candidate lane. Two names here, but the k3–k5 slots stay defined so the
     shared component CSS below doesn't reference a missing variable. */
  --k1:#B23A2E; --k2:#1E6E86; --k3:#6D4B96; --k4:#A87516; --k5:#8A929C;
  --map-stroke:rgba(10,10,10,.14); --map-stroke-hi:rgba(10,10,10,.55);
  --map-hatch:rgba(10,10,10,.22); --map-blank:#dcdcd2;
  --ramp-mid:rgb(232,232,226); --ramp-lo:rgb(237,237,231);
  --tip-shadow:0 10px 30px rgba(23,23,27,.16);
  --mono:var(--font-numeric,'JetBrains Mono'),ui-monospace,monospace;
  --sans:var(--font-body,'Geist'),system-ui,sans-serif;
  --r-panel:14px; --r-card:10px; --r-pill:999px;
  --shadow:none;
  color:var(--ink);min-height:100vh;font-family:var(--sans);
  -webkit-font-smoothing:antialiased;
}
html[data-theme="dark"] .desk{
  --k3:#8a63ef; --k4:#e8b93c;
  --map-stroke:rgba(255,255,255,.10); --map-stroke-hi:rgba(255,255,255,.55);
  --map-hatch:rgba(255,255,255,.28); --map-blank:#2e2e36;
  --ramp-mid:rgb(58,58,66); --ramp-lo:rgb(30,30,36);
  --tip-shadow:0 10px 30px rgba(0,0,0,.45);
}

.desk *{margin:0;padding:0;box-sizing:border-box}
.desk a{text-decoration:none;color:inherit}

.desk h1,.desk h2,.desk h3,.desk .projected-name,.desk .snapshot-heading strong{
  font-family:var(--sans);font-weight:800;letter-spacing:-.028em}
.desk .model-label,.desk .topline-status,.desk .topline-columns,.desk .race-kicker,
.desk .l4-called{font-family:var(--mono);font-weight:700;font-size:8px;
  letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.desk .topline-votes,.desk .topline-pct,.desk .projected-bar-value,.desk .ring-center b,
.desk .meta-block b,.desk .outcome-row b,.desk .l4-pct,.desk .projected-margin-wrap b,
.desk .model-stats b,.desk .swing-grid b{font-family:var(--mono);font-variant-numeric:tabular-nums}
.desk .prose{font-family:var(--sans);line-height:1.6}

.utility-button{font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink2);border:1px solid var(--hairline2);
  border-radius:var(--r-pill);padding:5px 12px;background:var(--panel);cursor:pointer}
.utility-button:hover{color:var(--ink)}
.utility-button.lg{padding:10px 18px;font-size:10px;white-space:nowrap}

.shell{max-width:1180px;margin:0 auto;padding:26px 22px 70px}

/* race header */
.archive-banner{display:flex;justify-content:space-between;align-items:center;gap:12px;
  flex-wrap:wrap;margin-bottom:16px;padding:9px 13px;border-radius:var(--r-card);
  background:var(--panel2);border:1px solid var(--hairline2);
  font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.archive-banner a{color:var(--ink2);border-bottom:1px solid var(--hairline2)}
.archive-banner a:hover{color:var(--ink)}
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
.empty-live .prose{font-size:13px;color:var(--ink2);max-width:420px}
.empty-note{font-size:12px;color:var(--ink2);max-width:520px;margin:14px 0 4px;
  padding-bottom:12px;border-bottom:1px solid var(--hairline)}
.topline-foot{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  margin-top:14px;padding-top:11px;border-top:1px solid var(--hairline);
  font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.topline-reporting b,.topline-margin b{font-size:13px;color:var(--ink);letter-spacing:-.01em;
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
.prob-ring,.rep-ring{--value:50;--ring:var(--k1);position:relative;width:126px;aspect-ratio:1;
  margin:10px auto 0;border-radius:50%;
  background:conic-gradient(from -90deg,var(--ring) calc(var(--value)*1%),var(--panel3) 0)}
.prob-ring.sm{width:104px}
.rep-ring{width:82px;
  background:conic-gradient(from -90deg,var(--live) calc(var(--value)*1%),var(--panel3) 0)}
.prob-ring::before,.rep-ring::before{content:"";position:absolute;inset:15px;border-radius:50%;
  background:var(--panel);box-shadow:inset 0 0 0 1px var(--hairline)}
.prob-ring.sm::before{inset:13px}
.rep-ring::before{inset:11px}
.ring-center{position:absolute;inset:0;z-index:1;display:grid;place-content:center;text-align:center}
.ring-center b{display:block;font-size:29px;font-weight:800;line-height:1;letter-spacing:-.05em}
.ring-center span{display:block;font-family:var(--mono);font-size:8px;color:var(--ink3);
  margin-top:5px;letter-spacing:.08em;text-transform:uppercase}
.prob-ring.sm .ring-center b{font-size:24px}
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
  margin-top:3px}
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
.projected-bar-fill{display:block;height:100%;border-radius:99px;border:1.5px dashed;
  background:color-mix(in srgb, currentColor 0%, transparent)}
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

/* county map + table */
.county{margin-top:20px;padding:20px}
.county-head{display:flex;justify-content:space-between;align-items:center;gap:14px;
  flex-wrap:wrap;margin-bottom:14px}
.rd-view-toggles,.rd-map-toggles{display:flex;gap:4px;padding:3px;border-radius:999px;
  background:var(--panel2);border:1px solid var(--hairline)}
.rd-view-toggles button{padding:6px 15px;border-radius:999px;border:0;background:none;cursor:pointer;
  font-family:var(--mono);font-size:10.5px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);transition:background .15s ease,color .15s ease}
.rd-view-toggles button.on{background:var(--gop);color:#fff}
.rd-map-toggles button{padding:5px 13px;border-radius:999px;border:0;background:none;cursor:pointer;
  font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);transition:background .15s ease,color .15s ease}
.rd-map-toggles button.on{background:var(--ink);color:var(--panel)}
.rd-map{position:relative;height:clamp(360px,48vh,520px);width:100%;border-radius:var(--r-panel);
  overflow:hidden;background:var(--panel2);border:1px solid var(--hairline)}
.rd-map-legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;
  font-family:var(--mono);font-size:10px;letter-spacing:.04em;color:var(--ink3)}
.map-empty{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px;
  align-items:center;justify-content:center;text-align:center;padding:0 24px;
  pointer-events:none;font-family:var(--mono);font-size:11px;letter-spacing:.05em;
  text-transform:uppercase;color:var(--ink3)}
.map-empty-sub{font-family:var(--sans);font-size:12px;letter-spacing:0;
  text-transform:none;color:var(--ink3);max-width:300px;line-height:1.5}
.rd-map-legend-sw{width:46px;height:5px;border-radius:99px;flex-shrink:0}
.rd-key{display:inline-flex;align-items:center;gap:5px}
.rd-key i{width:9px;height:9px;border-radius:2px;display:inline-block}
.rd-map-legend-note{color:var(--ink3)}
.rd-map-hint{margin-left:auto;color:var(--ink3);white-space:nowrap}
@media(max-width:640px){.rd-map-hint{display:none}}
.county-caveat{font-size:11.5px;color:var(--ink3);margin-top:14px;max-width:880px}

.mech-box{margin-top:16px;padding:14px;border:1px solid var(--hairline2);
  border-radius:var(--r-card);background:var(--panel2)}
.swing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;
  margin-top:10px}
.swing-grid span{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.swing-grid b{display:block;font-size:12.5px;font-weight:700;margin-top:3px}
.mech-box .prose{font-size:11.5px;color:var(--ink2);margin-top:12px;padding-top:10px;
  border-top:1px solid var(--hairline);max-width:820px}

.rd-county{margin-top:22px}
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
.rd-county-tablewrap{max-height:520px;overflow:auto;border:1px solid var(--hairline);
  border-radius:12px;background:var(--panel)}
.rd-county-table{width:100%;border-collapse:collapse;font-family:var(--sans);font-size:13px;
  table-layout:fixed}
.rd-county-table thead th{position:sticky;top:0;z-index:1;background:var(--panel2);
  text-align:left;padding:10px 12px;font-family:var(--mono);font-size:9.5px;font-weight:700;
  letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);
  border-bottom:1px solid var(--hairline)}
.rd-county-table th.num,.rd-county-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.rd-county-table td{padding:10px 12px;border-bottom:1px solid var(--hairline);color:var(--ink);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-county-table tbody tr:last-child td{border-bottom:0}
.rd-county-table tbody tr:hover td{background:var(--panel2)}
.rd-county-loading{text-align:center;padding:26px 14px;color:var(--ink3);font-style:italic}
.ok-region-cell{font-family:var(--mono);font-size:11px;color:var(--ink3)}
/* inline-flex, not flex: a display:flex <td> stops behaving as a table cell and
   the columns collapse on top of each other. */
.rd-cand-cell{display:inline-flex;align-items:baseline;justify-content:flex-end;gap:6px;
  font-family:var(--mono)}
.rd-cand-cell b{font-weight:700}
.rd-cand-votes{color:var(--ink3);font-size:10.5px}
.rd-cand-tcc{display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:7px;
  background:var(--gold);vertical-align:middle}
@media(max-width:900px){
  .rd-cand-votes{display:none}
  .ok-county-table{font-size:11.5px}
  .ok-county-table td,.ok-county-table thead th,.ok-county-table tfoot td{padding:9px 7px}
  .ok-region-cell{display:none}
}

/* oklahoma choropleth */
.ok-map-wrap{position:relative;width:100%;height:100%;overflow:hidden;
  padding:16px;touch-action:none;cursor:grab}
.ok-map-wrap.dragging{cursor:grabbing}
.ok-map{display:block;width:100%;height:100%}
.ok-cty{stroke:var(--map-stroke);stroke-width:.6;cursor:pointer;transition:opacity .12s ease}
.ok-cty:hover{opacity:.78;stroke:var(--map-stroke-hi);stroke-width:1.4}
.ok-cty-hatch{pointer-events:none;stroke:none}
.ok-hatch-line{stroke:var(--map-hatch)}
.ok-zoom{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:1px;
  border-radius:9px;overflow:hidden;border:1px solid var(--hairline2);background:var(--panel);
  box-shadow:0 4px 14px rgba(0,0,0,.18)}
.ok-zoom button{width:30px;height:28px;border:0;background:var(--panel);color:var(--ink2);
  cursor:pointer;font-family:var(--mono);font-size:14px;line-height:1;font-weight:700;
  display:grid;place-items:center;transition:background .12s ease,color .12s ease}
.ok-zoom button+button{border-top:1px solid var(--hairline)}
.ok-zoom button:hover:not(:disabled){background:var(--panel2);color:var(--ink)}
.ok-zoom button:disabled{opacity:.4;cursor:default}
.ok-zoom button.reset{font-size:8px;letter-spacing:.06em}
.ok-tip,.sc-tip{position:absolute;z-index:5;pointer-events:none;min-width:206px;max-width:250px;
  padding:10px 12px;border-radius:var(--r-card);background:var(--panel);
  border:1px solid var(--hairline2);box-shadow:var(--tip-shadow);
  font-family:var(--sans);font-size:12px;color:var(--ink)}
.ok-tip strong,.sc-tip strong{display:block;font-size:13px;font-weight:800;margin-bottom:6px}
.ok-tip-row,.sc-tip-row{display:flex;justify-content:space-between;gap:16px;
  font-family:var(--mono);font-size:11.5px;line-height:1.7}
.ok-tip-row b,.sc-tip-row b{font-variant-numeric:tabular-nums}
.ok-tip-sub,.sc-tip-sub{margin-top:5px;font-family:var(--mono);font-size:9.5px;
  letter-spacing:.04em;color:var(--ink3)}
.ok-tip-flag{margin-top:6px;font-family:var(--mono);font-size:8.5px;font-weight:700;
  letter-spacing:.11em;text-transform:uppercase;color:var(--gold)}

/* south carolina panel */
.sc-zone{margin-top:20px;padding:20px}
.sc-head{display:flex;justify-content:space-between;gap:26px;align-items:flex-start;
  flex-wrap:wrap;padding-bottom:16px;border-bottom:1px solid var(--hairline)}
.sc-head h2{font-size:21px;line-height:1.14;margin-top:10px}
.sc-deck{font-size:12.5px;color:var(--ink2);margin-top:9px;max-width:620px}
.sc-prob{text-align:center;flex:0 0 auto}
.sc-grid{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:18px}
@media(max-width:860px){.sc-grid{grid-template-columns:1fr}}
.sc-col{min-width:0}
.sc-sub{margin-top:18px;padding-top:14px;border-top:1px solid var(--hairline)}
.sc-note{font-size:11.5px;color:var(--ink3);margin-top:12px}
.sc-map-frame{position:relative;margin-top:10px;height:clamp(240px,32vh,340px);
  border-radius:var(--r-panel);overflow:hidden;background:var(--panel2);
  border:1px solid var(--hairline)}
.sc-map-wrap{position:relative;width:100%;height:100%;padding:12px}
.sc-map{display:block;width:100%;height:100%}
.sc-cty{stroke:var(--map-stroke);stroke-width:.6;cursor:pointer;transition:opacity .12s ease}
.sc-cty:hover{opacity:.78;stroke:var(--map-stroke-hi);stroke-width:1.4}

/* scenario engine cta */
.engine-cta{margin-top:20px;padding:20px;display:flex;justify-content:space-between;
  align-items:center;gap:24px;flex-wrap:wrap}
.engine-cta h2{font-size:16px}
.engine-cta .prose{font-size:12px;color:var(--ink2);margin-top:6px;max-width:620px}

/* slate */
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
.method-foot{display:flex;justify-content:space-between;gap:14px;margin-top:16px;flex-wrap:wrap}

@media(max-width:640px){
  .topline-columns,.topline-row-top{grid-template-columns:1fr 70px 58px}
  .topline-pct{font-size:18px}
  .projected-bar-row{grid-template-columns:74px 1fr 44px}
  .projected-bar-delta{display:none}
  .grid{grid-template-columns:1fr}
}
`;
