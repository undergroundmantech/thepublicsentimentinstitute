"use client";

/**
 * Internal Florida governor desk.
 *
 * Built around one question the public board deliberately does not ask: how is
 * Fishback doing against what we expected of him, and where does the vote he
 * still needs actually live. Everything is a comparison to the pre-election
 * baseline — no county is ever called, and nothing here is published output.
 */

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { projectCounties } from "../../results/2026-08-18/countyForecast";
import {
  CANDIDATE_ORDER,
  ALL_CANDIDATE_KEYS,
  CANDIDATE_LAST,
  STATEWIDE_FORECAST,
  TURNOUT_MODEL,
  type CandidateKey,
} from "../../results/_data/flCountyForecast";
import { CAND_CSS } from "../../results/2026-08-18/FloridaCountyMap";
import { forecastRace } from "../../lib/electoralModel";
import { FL_GOV_R, keyOf, useFreshtake, useRaceDetail } from "./usePortalLive";
import {
  TARGET,
  currentRival,
  gradeCounties,
  opportunities,
  pathToWin,
  statewideGrade,
  type CountyGrade,
} from "./expectation";
import GroundMap, { type GroundMode } from "./GroundMap";
import { PORTAL_CSS } from "./portalStyles";

const int = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-US");
const pp = (n: number, d = 1) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(d)}`;
const pct = (n: number) => `${n.toFixed(1)}%`;
const clampPct = (n: number) => Math.min(Math.max(n, 0), 100);

const TARGET_NAME = CANDIDATE_LAST[TARGET];
const TOP_N = 8;

/** The three-slot engine has nowhere to put Renner; the county roll-up does. */
const PRIOR = {
  Candidate1: STATEWIDE_FORECAST.donalds / 100,
  Candidate2: STATEWIDE_FORECAST.fishback / 100,
  Candidate3: STATEWIDE_FORECAST.collins / 100,
};

const zeroVotes = (): Record<CandidateKey, number> =>
  ({ donalds: 0, fishback: 0, collins: 0, renner: 0, other: 0 });

const turnoutMeasuredLabel = (bankedRep: number) =>
  bankedRep > 0 ? "measured electorate" : "prior electorate";

export default function PortalDashboard() {
  const { counties: liveCounties, detail, updated, stale } = useRaceDetail(FL_GOV_R);
  const banked = useFreshtake();
  const [mode, setMode] = useState<GroundMode>("opportunity");
  const [query, setQuery] = useState("");

  const hasCounties = Object.keys(liveCounties).length > 0;

  // The statewide feed leads the county feed for most of the night, so the
  // topline comes from it and the counties only supply the geography.
  const statewideVotes = useMemo(() => {
    const out = zeroVotes();
    if (detail?.candidates?.length) {
      for (const c of detail.candidates) out[keyOf(c.name)] += Number(c.votes) || 0;
      return out;
    }
    for (const lc of Object.values(liveCounties)) {
      for (const k of ALL_CANDIDATE_KEYS) out[k] += lc.votes[k] ?? 0;
    }
    return out;
  }, [detail, liveCounties]);

  const countedTotal = ALL_CANDIDATE_KEYS.reduce((s, k) => s + statewideVotes[k], 0);
  const live = countedTotal > 0;

  const bankedRep = banked?.ok ? banked.statewide?.rep ?? 0 : 0;

  // Measured ballots cast beat the registration-and-history prior: they are the
  // actual size of the electorate this race is being decided by.
  const turnoutBasis = bankedRep > 0 ? bankedRep : TURNOUT_MODEL.projected;

  // The precinct percentage runs far behind the count here — Florida posts its
  // banked mail and early ballots before precincts close out — so reporting is
  // measured against the electorate and precincts are shown separately.
  const precinctRep = clampPct(Number(detail?.percent_reporting) || 0);
  const voteRep = turnoutBasis > 0 ? clampPct((countedTotal / turnoutBasis) * 100) : 0;
  const rep = Math.max(precinctRep, voteRep);

  const fc = useMemo(
    () =>
      forecastRace({
        race_rule: "PLURALITY",
        percent_reporting: clampPct(rep) / 100,
        reported_vote_total: countedTotal,
        expected_turnout: turnoutBasis,
        reported_share: {
          Candidate1: countedTotal ? statewideVotes.donalds / countedTotal : 0,
          Candidate2: countedTotal ? statewideVotes.fishback / countedTotal : 0,
          Candidate3: countedTotal ? statewideVotes.collins / countedTotal : 0,
        },
        expected_share: PRIOR,
        poll_avg_shares: PRIOR,
      }),
    [rep, countedTotal, turnoutBasis, statewideVotes],
  );

  const projection = useMemo(
    () => projectCounties(hasCounties ? liveCounties : undefined, fc.modeled_total_vote),
    [liveCounties, hasCounties, fc.modeled_total_vote],
  );

  const rival = currentRival(statewideVotes);
  const rivalName = CANDIDATE_LAST[rival];

  const grades = useMemo(
    () => gradeCounties(projection.list, hasCounties ? liveCounties : undefined, rival),
    [projection.list, liveCounties, hasCounties, rival],
  );

  const grade = useMemo(
    () => statewideGrade(hasCounties ? liveCounties : undefined),
    [liveCounties, hasCounties],
  );

  const path = useMemo(() => pathToWin(grades, statewideVotes), [grades, statewideVotes]);

  const top = useMemo(
    () => [...grades].sort((a, b) => b.projectedTurnout - a.projectedTurnout).slice(0, TOP_N),
    [grades],
  );
  const topFips = useMemo(() => new Set(top.map((g) => g.fips)), [top]);

  const rest = useMemo(() => {
    const q = query.trim().toLowerCase();
    return grades
      .filter((g) => !topFips.has(g.fips))
      .filter((g) => (q ? g.name.toLowerCase().includes(q) : true))
      .sort((a, b) => b.projectedTurnout - a.projectedTurnout);
  }, [grades, topFips, query]);

  const chances = useMemo(() => opportunities(grades, 6), [grades]);

  const stamp = updated
    ? updated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "—";

  const projectedRanked = useMemo(
    () =>
      CANDIDATE_ORDER.map((k) => ({ k, share: projection.statewide.shares[k] })).sort(
        (a, b) => b.share - a.share,
      ),
    [projection.statewide],
  );
  const projectedMargin = projectedRanked[0].share - projectedRanked[1].share;

  // The margin is a difference of two vote totals, so its sd is sd_race·√2.
  const marginSd =
    fc.modeled_total_vote > 0
      ? ((fc.sd_race * Math.SQRT2) / fc.modeled_total_vote) * 100
      : STATEWIDE_FORECAST.marginSd;

  const gradeTone =
    grade === null ? "neutral" : grade.delta >= 1.5 ? "good" : grade.delta <= -1.5 ? "bad" : "neutral";

  async function signOut() {
    await fetch("/api/portal/login", { method: "DELETE" });
    window.location.href = "/portal/login";
  }

  return (
    <div className="pd">
      <style>{PORTAL_CSS}</style>

      <div className="pd-shell">
        <header className="pd-top">
          <div className="pd-top-left">
            <span className="pd-badge">Internal · not for publication</span>
            <h1>
              Florida Governor <em>{TARGET_NAME} desk</em>
            </h1>
            <p className="pd-deck">
              Every number here is measured against the pre-election county baseline.
              Counties are never called — the county layer exists to show where the
              outstanding vote sits.
            </p>
          </div>
          <div className="pd-top-right">
            <div className="pd-stamp">
              {live && <span className="pd-dot" aria-hidden />}
              <span>{live ? "Counting" : "No votes counted"}</span>
              <b>{stamp}</b>
              {stale && <em>feed stale</em>}
            </div>
            <div className="pd-top-links">
              <Link href="/results/archive/2026-08-18">Public board</Link>
              <button type="button" onClick={signOut}>Sign out</button>
            </div>
          </div>
        </header>

        {/* ═══ BENTO: GRADE · PATH · TOPLINE · TURNOUT ═══ */}
        <section className="pd-bento" aria-label="Headline status">

          <article className={`pd-tile pd-grade ${gradeTone}`}>
            <div className="pd-tile-head">
              <span>{TARGET_NAME} vs expectation</span>
            </div>
            {grade === null ? (
              <div className="pd-grade-empty">
                <b>—</b>
                <p>
                  No county has counted yet. The grade compares his share with the
                  baseline for the counties actually reporting, so it stays blank rather
                  than reading his statewide topline against a statewide expectation.
                </p>
              </div>
            ) : (
              <>
                <div className="pd-grade-body">
                  <span className="pd-grade-letter">{grade.letter}</span>
                  <div>
                    <strong>{grade.label}</strong>
                    <p>
                      {pp(grade.delta)} pts against baseline across{" "}
                      {grade.countiesReporting} reporting{" "}
                      {grade.countiesReporting === 1 ? "county" : "counties"}.
                    </p>
                  </div>
                </div>
                <div className="pd-grade-foot">
                  <div>
                    <span>Net votes vs expected</span>
                    <b>{pp(grade.votes, 0)}</b>
                  </div>
                  <div>
                    <span>In counted vote</span>
                    <b>{int(grade.countedVotes)}</b>
                  </div>
                </div>
              </>
            )}
          </article>

          <article className="pd-tile pd-path">
            <div className="pd-tile-head">
              <span>Path to first place</span>
            </div>
            <div className="pd-path-lead">
              {path.deficit > 0 ? (
                <>
                  <b>{int(path.deficit)}</b>
                  <small>votes behind {rivalName}</small>
                </>
              ) : live ? (
                <>
                  <b>{int(-path.deficit)}</b>
                  <small>votes ahead of {rivalName}</small>
                </>
              ) : (
                <>
                  <b>{pp(STATEWIDE_FORECAST.fishback - STATEWIDE_FORECAST.donalds)}</b>
                  <small>baseline margin vs {rivalName}</small>
                </>
              )}
            </div>
            <div className="pd-path-grid">
              <div>
                <span>Outstanding ballots</span>
                <b>{int(path.outstanding)}</b>
              </div>
              <div>
                <span>Needs to win them by</span>
                <b>{Number.isFinite(path.required) ? pp(path.required) : "—"}</b>
              </div>
              <div>
                <span>Baseline says he wins them by</span>
                <b>{pp(path.expected)}</b>
              </div>
              <div className={path.gap > 0 ? "bad" : "good"}>
                <span>Ground to make up</span>
                <b>{Number.isFinite(path.gap) ? `${pp(path.gap)} pts` : "—"}</b>
              </div>
            </div>
            <p className="pd-note">
              {!live
                ? "Nothing counted yet, so this is the baseline race: what the model expected before any returns."
                : path.gap > 0
                  ? `He is short by ${Math.abs(path.gap).toFixed(1)} points of margin across the ${int(path.outstanding)} ballots still outstanding — roughly ${int((Math.abs(path.gap) / 100) * path.outstanding)} net votes he is not currently on course to find.`
                  : "The outstanding vote is running his way by more than he needs, on baseline shares."}
            </p>
          </article>

          <article className="pd-tile pd-topline">
            <div className="pd-tile-head">
              <span>Counted</span>
              <small>{int(countedTotal)} votes</small>
            </div>
            {CANDIDATE_ORDER.map((k) => {
              const v = statewideVotes[k];
              const s = countedTotal > 0 ? (v / countedTotal) * 100 : 0;
              const expected = STATEWIDE_FORECAST[k];
              return (
                <div className={`pd-cand ${k === TARGET ? "is-target" : ""}`} key={k}>
                  <div className="pd-cand-row">
                    <i style={{ background: CAND_CSS[k] }} aria-hidden />
                    <span>{CANDIDATE_LAST[k]}</span>
                    <b>{live ? pct(s) : "—"}</b>
                    <small>{live ? int(v) : `exp ${expected.toFixed(1)}%`}</small>
                  </div>
                  <div className="pd-cand-track">
                    <span style={{ width: `${s}%`, background: CAND_CSS[k] }} />
                    <i className="pd-cand-exp" style={{ left: `${expected}%` }} aria-hidden />
                  </div>
                </div>
              );
            })}
            <p className="pd-note">Ticks mark the pre-election baseline share.</p>
          </article>

          <article className="pd-tile pd-turnout">
            <div className="pd-tile-head">
              <span>Turnout</span>
            </div>
            <div className="pd-turnout-grid">
              <div>
                <span>R ballots cast</span>
                <b>{banked?.ok ? int(bankedRep) : "—"}</b>
              </div>
              <div>
                <span>Pre-election prior</span>
                <b>{int(TURNOUT_MODEL.projected)}</b>
              </div>
              <div>
                <span>Prior error</span>
                <b>{banked?.ok ? pp(bankedRep - TURNOUT_MODEL.projected, 0) : "—"}</b>
              </div>
              <div>
                <span>Counted so far</span>
                <b>{int(countedTotal)}</b>
              </div>
            </div>
            <p className="pd-note">
              {banked === null
                ? "Loading turnout…"
                : banked.ok
                  ? "Ballots cast, from Fresh Take Florida. No candidate preference is in this number."
                  : `Turnout feed unavailable (${banked.error}). Falling back to the registration-and-history prior.`}
            </p>
          </article>

          <article className="pd-tile pd-mech">
            <div className="pd-tile-head">
              <span>Statewide vote mechanics</span>
              <small>{turnoutMeasuredLabel(bankedRep)}</small>
            </div>
            <div className="pd-mech-grid">
              <div>
                <span>Projected turnout</span>
                <b>{int(fc.modeled_total_vote)}</b>
              </div>
              <div>
                <span>Votes remaining</span>
                <b>{int(fc.modeled_vote_remaining)}</b>
              </div>
              <div>
                <span>Est. reporting</span>
                <b>{live ? pct(rep) : "0.0%"}</b>
              </div>
              <div>
                <span>Precincts</span>
                <b>{live ? pct(precinctRep) : "0.0%"}</b>
              </div>
              <div>
                <span>SD of votes</span>
                <b>±{int(fc.sd_race)}</b>
              </div>
              <div>
                <span>Projected margin</span>
                <b>{pp(projectedMargin)}</b>
              </div>
              <div>
                <span>Margin range (95%)</span>
                <b>{pp(projectedMargin - 2 * marginSd)} to {pp(projectedMargin + 2 * marginSd)}</b>
              </div>
              <div>
                <span>Leader</span>
                <b style={{ color: CAND_CSS[projectedRanked[0].k] }}>
                  {CANDIDATE_LAST[projectedRanked[0].k]}
                </b>
              </div>
            </div>
            <p className="pd-note">
              Reporting is measured against ballots cast, not precincts closed — Florida
              posts its banked mail and early vote first, so the precinct number runs
              far behind the count. The projected margin is the county roll-up, which is
              the only place Renner exists as his own quantity.
            </p>
          </article>
        </section>

        {/* ═══ MAP ═══ */}
        <section className="pd-panel" aria-label="Where the vote he needs sits">
          <div className="pd-panel-head">
            <div>
              <h2>Where he has to find it</h2>
              <p>
                {mode === "opportunity"
                  ? `Net votes ${TARGET_NAME} still stands to take out of each county's outstanding ballots, at baseline shares. Depth is votes, not share.`
                  : `How far ${TARGET_NAME} is running from his county baseline in what has already counted.`}
              </p>
            </div>
            <div className="pd-toggles" role="group" aria-label="Map view">
              <button type="button" className={mode === "opportunity" ? "on" : ""}
                      onClick={() => setMode("opportunity")}>
                opportunity
              </button>
              <button type="button" className={mode === "performance" ? "on" : ""}
                      onClick={() => setMode("performance")}
                      disabled={!hasCounties}>
                performance
              </button>
            </div>
          </div>

          <div className="pd-map-wrap">
            <GroundMap grades={grades} mode={mode} rival={rival} target={TARGET} />

            <div className="pd-chances">
              <div className="pd-chances-head">
                <strong>Biggest remaining pools</strong>
                <small>net votes available</small>
              </div>
              {chances.map((g) => (
                <div className="pd-chance" key={g.fips}>
                  <div>
                    <strong>{g.name}</strong>
                    <small>{int(g.outstanding)} outstanding</small>
                  </div>
                  <b className={g.netAvailable >= 0 ? "good" : "bad"}>
                    {pp(g.netAvailable, 0)}
                  </b>
                </div>
              ))}
              <p className="pd-note">
                Ranked by net votes, so this is a list of where the race is decided, not
                where his share is highest.
              </p>
            </div>
          </div>
        </section>

        {/* ═══ BENTO: TOP COUNTIES ═══ */}
        <section className="pd-panel" aria-label="Largest counties">
          <div className="pd-panel-head">
            <div>
              <h2>The {TOP_N} counties that decide it</h2>
              <p>
                Ranked by projected Republican primary ballots, not population. Projected
                and actual shares sit side by side; neither is a call.
              </p>
            </div>
          </div>

          <div className="pd-county-bento">
            {top.map((g) => (
              <CountyCard key={g.fips} g={g} projected={projection.byName[g.name]?.shares} />
            ))}
          </div>
        </section>

        {/* ═══ THE REST ═══ */}
        <section className="pd-panel" aria-label="All other counties">
          <div className="pd-panel-head">
            <div>
              <h2>The other {grades.length - top.length} counties</h2>
              <p>Same comparison, ranked by projected ballots.</p>
            </div>
            <input
              className="pd-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter counties"
              aria-label="Filter counties"
            />
          </div>

          <div className="pd-tablewrap">
            <table className="pd-table">
              <thead>
                <tr>
                  <th>County</th>
                  <th>Projected</th>
                  <th>Counted</th>
                  <th>Rep.</th>
                  <th>Exp. {TARGET_NAME}</th>
                  <th>Actual</th>
                  <th>vs exp.</th>
                  <th>Net available</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((g) => (
                  <tr key={g.fips}>
                    <td>
                      <strong>{g.name}</strong>
                      <small>{g.region}</small>
                    </td>
                    <td className="num">{int(g.projectedTurnout)}</td>
                    <td className="num">{g.reportedVotes > 0 ? int(g.reportedVotes) : "—"}</td>
                    <td className="num">{g.reporting > 0 ? `${g.reporting.toFixed(0)}%` : "—"}</td>
                    <td className="num">{pct(g.expected)}</td>
                    <td className="num">{g.actual === null ? "—" : pct(g.actual)}</td>
                    <td className={`num ${g.delta === null ? "" : g.delta >= 0 ? "good" : "bad"}`}>
                      {g.delta === null ? "—" : pp(g.delta)}
                    </td>
                    <td className={`num ${g.netAvailable >= 0 ? "good" : "bad"}`}>
                      {pp(g.netAvailable, 0)}
                    </td>
                  </tr>
                ))}
                {rest.length === 0 && (
                  <tr>
                    <td colSpan={8} className="pd-empty">No county matches that filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="pd-foot">
          County baselines are demographic estimates, not local polling: 476 interviews
          across 67 counties. Projected turnout is drawn from registration and past
          primaries and is far more reliable than any county share. Statewide probability
          belongs to the statewide model and is never aggregated from these counties.
        </p>
      </div>
    </div>
  );
}

function CountyCard({
  g,
  projected,
}: {
  g: CountyGrade;
  projected?: Record<CandidateKey, number>;
}) {
  const shares = projected ?? ({} as Record<CandidateKey, number>);
  const delta = g.delta;

  return (
    <article className="pd-cc">
      <div className="pd-cc-head">
        <div>
          <strong>{g.name}</strong>
          <small>{g.region}</small>
        </div>
        <span className="pd-cc-rep">
          {g.reporting > 0 ? `${g.reporting.toFixed(0)}% in` : "no returns"}
        </span>
      </div>

      <div className="pd-cc-stack" aria-hidden>
        {ALL_CANDIDATE_KEYS.map((k) => (
          <span key={k} style={{ width: `${shares[k] ?? 0}%`, background: CAND_CSS[k] }} />
        ))}
      </div>

      <div className="pd-cc-grid">
        <div>
          <span>Projected ballots</span>
          <b>{int(g.projectedTurnout)}</b>
        </div>
        <div>
          <span>Outstanding</span>
          <b>{int(g.outstanding)}</b>
        </div>
        <div>
          <span>Expected {CANDIDATE_LAST[TARGET]}</span>
          <b>{pct(g.expected)}</b>
        </div>
        <div>
          <span>Actual</span>
          <b>{g.actual === null ? "—" : pct(g.actual)}</b>
        </div>
      </div>

      <div className={`pd-cc-verdict ${delta === null ? "" : delta >= 0 ? "good" : "bad"}`}>
        {delta === null
          ? `Net ${pp(g.netAvailable, 0)} votes available here`
          : `${pp(delta)} pts vs expectation · ${pp(g.votesVsExpected ?? 0, 0)} votes`}
      </div>
    </article>
  );
}
