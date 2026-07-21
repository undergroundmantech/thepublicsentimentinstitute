"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Manrope } from "next/font/google";
import DarkNav from "@/app/components/DarkNav";
import { ThemeProvider } from "../../onpoint/lib/theme.jsx";
import { OPA_GLOBAL_CSS } from "../../onpoint/OpaResultsPage.jsx";
import RaceMapHover from "../../components/RaceMapHover";
import RaceDetail from "../../onpoint/RaceDetail.jsx";
import { raceHasMap, candColor, shade } from "../../onpoint/electionLib.js";
import { useElectionIndex } from "../../onpoint/lib/electionIndex.js";
import { useTheme } from "../../onpoint/lib/theme.jsx";
import { WinProbabilityWheel, RaceClockRing, MarginWhisker } from "./deck/Gauges";
import CountyTable from "./deck/CountyTable";
import LiveTimeline from "./deck/LiveTimeline";
import DeskSearch from "../../components/DeskSearch";
import { needleFromRace, type NeedleProjection } from "../../components/needleModel";
import { idToAbout } from "../../_data/raceRegistry";
import {
  getRaceState,
  RACE_STATE_LABEL,
  NO_HISTORY_LINE,
  getEffectivePollsCloseIso,
  getMsLeftToClose,
  formatCountdown,
} from "../../_lib/raceState";
import { getRaceCapabilities } from "../../_data/raceCapabilities";

const CIVIC_BASE = "https://civicapi.org";
const RACE_REFRESH_MS = 30_000;
import { buildVoteModeRows, voteModeWhyItMatters } from "../../_lib/voteModeModel";
import type { FlightRecorderSnapshot } from "../../_lib/flightRecorder";

// CO-04 §4c Zone 6 — reads flight-recorder history for the race only when
// caps.telemetry is true. TIMELINE_PUBLIC_FLAG (raceCapabilities.ts) keeps
// telemetry false for every race until the Nov 3 general, so this fetch is
// dormant in practice today — the hook exists so the section is fully wired
// once the flag flips, with no further RaceDesk changes needed.
function useFlightHistory(raceId: number, enabled: boolean): FlightRecorderSnapshot[] {
  const [snapshots, setSnapshots] = useState<FlightRecorderSnapshot[]>([]);
  useEffect(() => {
    if (!enabled || !raceId) return;
    let alive = true;
    fetch(`/api/flightrecorder/${raceId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (alive) setSnapshots(Array.isArray(d) ? d : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [raceId, enabled]);
  return snapshots;
}

const manrope = Manrope({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-mp", display: "swap" });

const fmtInt = (n: number) => (Number(n) || 0).toLocaleString("en-US");
const initials = (n?: string) => {
  if (!n) return "—";
  const parts = n.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "—";
};
const partyTag = (cand: any) => {
  const p = String(cand?.party || "").toLowerCase();
  if (/democr/.test(p)) return "Dem";
  if (/republic|gop/.test(p)) return "GOP";
  if (/independ/.test(p)) return "Ind";
  if (/libertarian/.test(p)) return "Lib";
  if (/green/.test(p)) return "Grn";
  if (/nonpartisan/.test(p)) return "NP";
  return String(cand?.party || "").slice(0, 3) || "—";
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// CO-04 §7 parity: V1's poll-close countdown had a timestamp bug (rendered
// implausible spans like "20635d ..." when the API's polls_close was
// missing/placeholder). Ticks its own interval so the rest of the board
// doesn't re-render every second; getMsLeftToClose() clamps anything over
// MAX_SANE_COUNTDOWN_DAYS to null instead of rendering garbage.
function PollCountdown({ closeIso }: { closeIso: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!closeIso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [closeIso]);
  const msLeft = getMsLeftToClose(closeIso, now);
  return <span className="rd-meta-val rd-countdown">{formatCountdown(msLeft)}</span>;
}


// party words stripped → the shared office key that groups "X Democratic
// Primary" with "X Republican Primary" (the NYT one-page-per-office pattern)
const PARTY_WORDS = /\b(democratic|republican|libertarian|green|nonpartisan|independent)\b/gi;
const officeKey = (contest?: string) =>
  String(contest || "").toLowerCase().replace(PARTY_WORDS, "").replace(/\s+/g, " ").trim();
const boardParty = (doc: any): string => {
  const c = String(doc?.contest || "");
  if (/democratic/i.test(c)) return "democratic primary";
  if (/republican/i.test(c)) return "republican primary";
  if (/primary/i.test(c)) return "primary";
  if (/runoff/i.test(c)) return "runoff";
  if (/special/i.test(c)) return "special election";
  return "general";
};
const boardRank = (doc: any) => (/democratic/i.test(doc?.contest || "") ? 0 : /republican/i.test(doc?.contest || "") ? 1 : 2);

const fmtProb = (p: number) => (p >= 0.995 ? ">99%" : p <= 0.005 ? "<1%" : `${Math.round(p * 100)}%`);

const RACE_RULE_CHIP: Record<string, string> = {
  PLURALITY: "plurality",
  MAJORITY: "majority",
  RANKED_CHOICE: "ranked choice",
  TOP_TWO: "top two advance",
  MAJORITY_RUNOFF: "majority runoff",
  THRESHOLD_35_CONVENTION: "35% threshold",
  THRESHOLD_35_RUNOFF: "35% threshold runoff",
};

// CO-04 §3 Zone 2 "verdict + flip-threshold sentence" — the model-read copy
// under the win-probability wheel. Kept to two short, plain-English lines.
function verdictSentence(n: NeedleProjection): string {
  if (n.pLeader >= 0.99) return `${n.leaderName} is a near-certain winner in the model.`;
  if (n.pLeader >= 0.8) return `${n.leaderName} is the strong modeled favorite.`;
  if (n.pLeader >= 0.6) return `${n.leaderName} is the modeled favorite, but it isn't locked up.`;
  return `This one is close in the model — ${n.leaderName} ${fmtProb(n.pLeader)} to ${n.runnerName} ${fmtProb(n.pRunner)}.`;
}
function flipSentence(n: NeedleProjection): string | null {
  if (n.flipThresholdPct == null) return null;
  return `${n.runnerName} would need ${n.flipThresholdPct.toFixed(0)}% of the remaining vote to catch ${n.leaderName}.`;
}

// CO-04 §3 Zone 2 runoff module — mounts per raceRule for any rule where an
// outright majority (or 35% threshold) isn't guaranteed by a plurality win.
const RUNOFF_RULE_COPY: Record<string, string> = {
  MAJORITY: "no runoff structure is published for this race; the model still tracks the majority threshold.",
  RANKED_CHOICE: "ranked-choice elimination rounds continue until one candidate clears the threshold.",
  MAJORITY_RUNOFF: "short of a majority, the top two candidates advance to a runoff.",
  THRESHOLD_35_CONVENTION: "short of 35%, the party convention decides the nominee.",
  THRESHOLD_35_RUNOFF: "short of 35%, the top two candidates meet in a runoff 8 weeks later.",
};
function RunoffModule({ needle, raceRule }: { needle: NeedleProjection; raceRule: string }) {
  return (
    <div className="rd-runoff">
      <div className="rd-runoff-h">path to {needle.winThresholdPct}%</div>
      <div className="rd-runoff-bar" aria-hidden>
        <i style={{ width: `${Math.round(needle.probSomeoneMajority * 100)}%` }} />
      </div>
      <div className="rd-runoff-stats">
        <span><b>{fmtProb(needle.probSomeoneMajority)}</b> outright win</span>
        <span><b>{fmtProb(needle.runoffNeededProb)}</b> {raceRule === "RANKED_CHOICE" ? "extra rounds" : "runoff"}</span>
      </div>
      <p className="rd-runoff-note">{RUNOFF_RULE_COPY[raceRule] ?? RUNOFF_RULE_COPY.MAJORITY}</p>
    </div>
  );
}

function Tallies({ doc }: { doc: any }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const race = doc?.race;
  const cands = useMemo(
    () => [...(race?.candidates || [])].sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0)),
    [race]
  );
  const leader = cands[0];
  const lead = (cands[0]?.percent || 0) - (cands[1]?.percent || 0);
  const winner = cands.find((c: any) => c.winner);
  const banner = winner || leader;
  const bannerCol = banner ? candColor(banner) : "#5566e6";
  const reporting = Math.max(0, Math.min(100, Number(race?.percent_reporting) || 0));
  const total = (race?.candidates || []).reduce((s: number, c: any) => s + (c.votes || 0), 0);
  const remain = reporting > 0 && reporting < 100 ? Math.round((total * (100 - reporting)) / reporting) : 0;
  return (
    <div className="rd-tallies">
      {/* the hub board's anatomy, laid open on the page — no enclosing card */}
      <div className="rd-thead" style={{ background: shade(bannerCol, lead) }}>
        <span className="rd-thead-yr">2026</span>
        <span className="rd-thead-title">{race?.election_name || doc?.contest}</span>
      </div>
      {banner ? (
        <div
          className="rd-banner"
          style={{
            background: `color-mix(in srgb, ${bannerCol} 13%, ${isLight ? "#ffffff" : "#090b12"})`,
            color: `color-mix(in srgb, ${bannerCol} 52%, ${isLight ? "#0a0b12" : "#ffffff"})`,
          }}
        >
          {winner ? `${winner.name} is projected to win.` : `${leader?.name || "—"} leads by ${lead.toFixed(1)}.`}
        </div>
      ) : null}
      {cands.map((c: any, i: number) => {
        const col = candColor(c);
        const pct = Number(c.percent) || 0;
        return (
          <div key={c.name || i} className={`rd-trow ${c.winner ? "won" : ""}`}>
            <span className="rd-trow-tick" aria-hidden style={{ background: col }} />
            <span className="rd-avatar" aria-hidden style={{ background: `color-mix(in srgb, ${col} 16%, var(--page))`, color: col }}>
              {initials(c.name)}
            </span>
            <span className="rd-trow-name">
              <b>
                {c.winner ? <span className="rd-checkbox" aria-hidden>✓</span> : null}
                {c.name}
              </b>
              <small>{partyTag(c)}</small>
            </span>
            <span className="rd-trow-votes">{fmtInt(c.votes || 0)}</span>
            <span className="rd-trow-pct" style={{ color: c.winner ? col : undefined }}>{pct.toFixed(1)}%</span>
          </div>
        );
      })}
      <div className="rd-slider" aria-hidden>
        <span className="rd-slider-track">
          <i style={{ width: `${reporting}%` }} />
          <b style={{ left: `${reporting}%` }} />
        </span>
      </div>
      <div className="rd-trow-foot">
        <span><em className="rd-api">API</em> Source: civicAPI</span>
        <span className="rd-foot-rep">
          <b>{Math.round(reporting)}% reporting</b>
          {remain > 0 ? <span>~{fmtInt(remain)} remain</span> : null}
        </span>
      </div>
    </div>
  );
}

function Board({ doc, primary, onMap }: { doc: any; primary?: boolean; onMap: (race: any) => void }) {
  const race = doc?.race;
  const hasMap = race ? raceHasMap(race) && race.has_map !== false : false;
  const about = idToAbout[doc?.id];
  const caps = getRaceCapabilities(Number(doc?.id));
  // Dustin's forecast engine (app/lib/electoralModel) drives the needle —
  // pass the race's real electoral rule so MAJORITY_RUNOFF/THRESHOLD_*
  // races actually trigger runoff math instead of silently defaulting to
  // plain PLURALITY.
  const needle = useMemo(() => (race ? needleFromRace(race, caps.raceRule) : null), [race, caps.raceRule]);
  const called = Array.isArray(race?.candidates) && race.candidates.some((c: any) => c.winner);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const reporting = Math.max(0, Math.min(100, Number(race?.percent_reporting) || 0));
  const totalVotes = Array.isArray(race?.candidates)
    ? race.candidates.reduce((s: number, c: any) => s + (Number(c.votes) || 0), 0)
    : 0;
  // CO-04 §2 state machine — TPSI hasn't shipped an independent projection
  // call yet (tpsiCalled stays false), so PROJECTED only ever comes from an
  // official CivicAPI winner flag until that model lands.
  const raceState = getRaceState({ percentReporting: reporting, hasOfficialCall: called, tpsiCalled: false });
  // CO-04 §4c Zone 6 — dormant fetch while TIMELINE_PUBLIC_FLAG is off (see
  // useFlightHistory above); becomes live once caps.telemetry flips true.
  const history = useFlightHistory(Number(doc?.id), caps.telemetry);
  // CO-04 §3 Zone 3: RESULTS / MARGIN / REMAINING map toggles. REMAINING is
  // only offered where a forecast exists (caps.forecast) — otherwise there's
  // no modeled "how much is left to shift this" read to show.
  const [mapMode, setMapMode] = useState<"results" | "margin" | "remaining">("margin");
  // CO-04 §7 parity — poll-close countdown, API value only (no race/state
  // override table maintained yet); getEffectivePollsCloseIso/getMsLeftToClose
  // clamp implausible values instead of rendering them (the V1 timestamp bug).
  const pollsCloseIso = getEffectivePollsCloseIso({ apiIso: race?.polls_close ?? null });
  return (
    <section className={`rd-board ${primary ? "primary" : ""}`}>
      <header className="rd-board-h">
        <span className="rd-board-party"><i aria-hidden />{boardParty(doc)}</span>
        <span className={`rd-board-flag ${called ? "called" : ""}`}>{called ? "✓ call made" : "● counting"}</span>
      </header>
      <div className="rd-meta">
        <div className="rd-meta-item">
          <span className="rd-meta-label">reported votes</span>
          <span className="rd-meta-val">{fmtInt(totalVotes)}</span>
        </div>
        <div className="rd-meta-item">
          <span className="rd-meta-label">est. reporting</span>
          <span className="rd-meta-val">{Math.round(reporting)}%</span>
        </div>
        <div className="rd-meta-item status">
          <span className="rd-meta-label">race status</span>
          <span className="rd-meta-status">
            <RaceClockRing size={28} fillFrac={reporting / 100} color="#2dd4bf" state={raceState} />
            {RACE_STATE_LABEL[raceState]}
          </span>
        </div>
        {pollsCloseIso ? (
          <div className="rd-meta-item">
            <span className="rd-meta-label">polls close</span>
            <PollCountdown closeIso={pollsCloseIso} />
          </div>
        ) : null}
      </div>
      <div className={`rd-board-grid ${hasMap ? "" : "nomap"}`}>
        <div className="rd-board-left">
          <Tallies doc={doc} />
          {needle ? (
            <div className="rd-needle">
              <div className="rd-needle-h">
                win probability
                <span className="rd-rule-chip">{RACE_RULE_CHIP[caps.raceRule] ?? caps.raceRule.toLowerCase()}</span>
                <span className="rd-forecast-beta">FORECAST β</span>
              </div>
              <div className="rd-wheel-row">
                <WinProbabilityWheel
                  probs={[needle.pLeader, needle.pRunner]}
                  colors={[needle.leaderColor, needle.runnerColor]}
                  trackColor="var(--rule)"
                  size={148}
                />
                <div className="rd-wheel-legend">
                  <div className="rd-wheel-leg-row">
                    <i style={{ background: needle.leaderColor }} aria-hidden />
                    <span>{needle.leaderName}</span>
                    <b style={{ color: needle.leaderColor }}>{fmtProb(needle.pLeader)}</b>
                  </div>
                  <div className="rd-wheel-leg-row">
                    <i style={{ background: needle.runnerColor }} aria-hidden />
                    <span>{needle.runnerName}</span>
                    <b>{fmtProb(needle.pRunner)}</b>
                  </div>
                </div>
              </div>
              <p className="rd-wheel-margin">
                Projected margin: {needle.marginPp >= 0 ? "+" : ""}{needle.marginPp.toFixed(1)} pts · {Math.round(needle.reporting)}% reporting
              </p>
              <p className="rd-wheel-verdict">{verdictSentence(needle)}</p>
              {flipSentence(needle) ? <p className="rd-wheel-flip">{flipSentence(needle)}</p> : null}
              <div className="rd-projshare">
                <span className="rd-projshare-h">projected final share</span>
                {[
                  { name: needle.leaderName, color: needle.leaderColor, proj: needle.leaderProjSharePct, cur: needle.leaderCurrentSharePct },
                  { name: needle.runnerName, color: needle.runnerColor, proj: needle.runnerProjSharePct, cur: needle.runnerCurrentSharePct },
                ].map((c) => {
                  const delta = c.proj - c.cur;
                  return (
                    <div key={c.name} className="rd-projshare-row">
                      <span className="rd-projshare-name">{c.name}</span>
                      <span className="rd-projshare-track" aria-hidden>
                        <i style={{ width: `${Math.max(0, Math.min(100, c.proj))}%`, background: c.color }} />
                      </span>
                      <b className="rd-projshare-val">{c.proj.toFixed(1)}%</b>
                      <span className="rd-projshare-delta">
                        {delta >= 0 ? "+" : ""}
                        {delta.toFixed(1)} vs current
                      </span>
                    </div>
                  );
                })}
              </div>
              {caps.raceRule !== "PLURALITY" && caps.raceRule !== "TOP_TWO" ? (
                <RunoffModule needle={needle} raceRule={caps.raceRule} />
              ) : null}
              <button
                type="button"
                className="rd-options-toggle"
                aria-expanded={optionsOpen}
                onClick={() => setOptionsOpen((v) => !v)}
              >
                {optionsOpen ? "hide options" : "options"}
                <span className={`rd-options-chev ${optionsOpen ? "open" : ""}`} aria-hidden>⌄</span>
              </button>
              {optionsOpen ? (
                <div className="rd-options">
                  <div className="rd-options-h">projected margin range</div>
                  <MarginWhisker meanPp={needle.marginPp} sdPp={needle.marginSdPp} leaderColor={needle.leaderColor} width={300} height={60} />
                  <p className="rd-options-note">
                    box = interquartile range · whiskers = ~95% interval · dashed line = tie
                  </p>
                  <div className="rd-stats-grid">
                    <div className="rd-stat"><span>modeled total vote</span><b>{fmtInt(needle.modeledTotalVote)}</b></div>
                    <div className="rd-stat"><span>modeled remaining</span><b>{fmtInt(needle.modeledVoteRemaining)}</b></div>
                    <div className="rd-stat"><span>margin sd</span><b>±{needle.marginSdPp.toFixed(1)} pts</b></div>
                    <div className="rd-stat"><span>mode</span><b>{needle.modeTrigger.toLowerCase()}</b></div>
                    {needle.modeTrigger !== "PLURALITY" ? (
                      <div className="rd-stat"><span>runoff needed</span><b>{fmtProb(needle.runoffNeededProb)}</b></div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <p className="rd-wheel-semantics">{caps.telemetry ? "reported figures are solid; projected figures are muted and labeled." : NO_HISTORY_LINE.toLowerCase()}</p>
            </div>
          ) : null}
        </div>
        <div className="rd-board-right">
          {hasMap ? (
            <>
              <div className="rd-map-toggles" role="group" aria-label="County map view">
                <button type="button" className={mapMode === "results" ? "on" : ""} onClick={() => setMapMode("results")}>results</button>
                <button type="button" className={mapMode === "margin" ? "on" : ""} onClick={() => setMapMode("margin")}>margin</button>
                {caps.forecast ? (
                  <button type="button" className={mapMode === "remaining" ? "on" : ""} onClick={() => setMapMode("remaining")}>remaining</button>
                ) : null}
              </div>
              <div className="rd-map">
                <RaceMapHover race={race} mode={mapMode} />
              </div>
              <div className="rd-map-legend" aria-hidden>
                {mapMode === "remaining" ? (
                  <>
                    <span className="rd-map-legend-sw" style={{ background: "linear-gradient(90deg, var(--wash), var(--gold))" }} />
                    <span>more vote outstanding →</span>
                  </>
                ) : (
                  <>
                    <span className="rd-map-legend-sw" style={{ background: "linear-gradient(90deg, var(--wash), var(--ink-dim))" }} />
                    <span>{mapMode === "margin" ? "closer → wider margin" : "county leader (flat)"}</span>
                  </>
                )}
              </div>
              <button type="button" className="rd-map-cta" onClick={() => onMap(race)}>
                open the precinct map <span aria-hidden>→</span>
              </button>
            </>
          ) : (
            <div className="rd-nomap" aria-hidden>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                <path d="M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z M9 4 V17.5 M15 6.5 V20" style={{ stroke: "var(--ink-dim)" }} strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <span>no county breakdown is published for this contest — the tallies are the full picture.</span>
            </div>
          )}
        </div>
      </div>
      {caps.forecast && needle ? <Turnout needle={needle} totalVotes={totalVotes} /> : null}
      {hasMap ? <CountyTable race={race} countyModel={caps.countyModel} needle={needle} /> : null}
      {caps.telemetry && needle && history.length > 0 ? <LiveTimeline snapshots={history} needle={needle} /> : null}
      {caps.modeData && needle ? <BallotLandscape needle={needle} /> : null}
      {about ? (
        <div className="rd-about">
          <span className="rd-about-h">about this race</span>
          <p>{about}</p>
        </div>
      ) : null}
    </section>
  );
}

/** CO-04 §4a Zone 4 — Projected Turnout & Remaining Vote (tier 3+, forecast
 *  only). Three stat blocks fed by the same AUC turnout model that drives
 *  the win-probability wheel, then per-candidate stacked tracks (solid
 *  reported + dashed est. remaining) on one shared scale. */
function Turnout({ needle, totalVotes }: { needle: NeedleProjection; totalVotes: number }) {
  const leaderReported = Math.round((needle.leaderCurrentSharePct / 100) * totalVotes);
  const runnerReported = Math.round((needle.runnerCurrentSharePct / 100) * totalVotes);
  const leaderProjected = Math.round((needle.leaderProjSharePct / 100) * needle.modeledTotalVote);
  const runnerProjected = Math.round((needle.runnerProjSharePct / 100) * needle.modeledTotalVote);
  const scaleMax = Math.max(leaderProjected, runnerProjected, 1);
  const leaderGain = Math.max(0, leaderProjected - leaderReported);
  const runnerGain = Math.max(0, runnerProjected - runnerReported);
  const projectedMarginVotes = Math.abs(leaderProjected - runnerProjected);
  const currentMarginVotes = Math.abs(leaderReported - runnerReported);
  const widening = projectedMarginVotes >= currentMarginVotes;
  const tracks = [
    { name: needle.leaderName, color: needle.leaderColor, reported: leaderReported, projected: leaderProjected },
    { name: needle.runnerName, color: needle.runnerColor, reported: runnerReported, projected: runnerProjected },
  ];
  return (
    <div className="rd-turnout">
      <span className="rd-turnout-h">projected turnout &amp; remaining vote</span>
      <div className="rd-turnout-stats">
        <div className="rd-stat"><span>votes reported</span><b>{fmtInt(totalVotes)}</b></div>
        <div className="rd-stat"><span>est. outstanding</span><b>{fmtInt(needle.modeledVoteRemaining)}</b></div>
        <div className="rd-stat"><span>projected turnout</span><b>{fmtInt(needle.modeledTotalVote)}</b></div>
      </div>
      <div className="rd-turnout-tracks">
        {tracks.map((t) => (
          <div key={t.name} className="rd-turnout-track">
            <span className="rd-turnout-track-name">{t.name}</span>
            <div className="rd-turnout-bar">
              <i style={{ width: `${(t.reported / scaleMax) * 100}%`, background: t.color }} />
              <em style={{ left: `${(t.reported / scaleMax) * 100}%`, width: `${Math.max(0, (t.projected - t.reported) / scaleMax) * 100}%`, borderColor: t.color }} />
            </div>
            <span className="rd-turnout-track-total">~{fmtInt(t.projected)} <small>PROJECTED</small></span>
          </div>
        ))}
      </div>
      <p className="rd-turnout-read">
        {needle.leaderName} is projected to receive about {fmtInt(leaderGain)} more outstanding votes
        {runnerGain > 0 ? ` (vs. ~${fmtInt(runnerGain)} for ${needle.runnerName})` : ""}, {widening ? "expanding" : "narrowing"} the lead to ~{fmtInt(projectedMarginVotes)} votes.
      </p>
    </div>
  );
}

/** CO-04 §4b Zone 7 — Remaining Ballot Landscape (modeData:true only). Vote
 *  mode splits are a MODELED PLACEHOLDER (app/results/_lib/voteModeModel.ts)
 *  — CivicAPI publishes no Early/VBM/Election Day breakdown for any race
 *  this app consumes. Ships now (owner decision 2026-07-21) so the section
 *  is exercised ahead of Nov 3; swappable for a real feed later without
 *  touching this component. */
function BallotLandscape({ needle }: { needle: NeedleProjection }) {
  const rows = useMemo(() => buildVoteModeRows(needle), [needle]);
  return (
    <div className="rd-ballot">
      <span className="rd-ballot-h">remaining ballot landscape</span>
      <p className="rd-ballot-sub">modeled split — not an official CivicAPI mode breakdown</p>
      {rows.map((r) => (
        <div key={r.mode} className="rd-ballot-row">
          <span className="rd-ballot-mode">{r.mode}</span>
          <div className="rd-ballot-meta">
            <span>~{fmtInt(r.estRemaining)} remaining</span>
            <span>{r.pctCounted}% counted</span>
          </div>
          <div className="rd-ballot-bar" aria-hidden>
            <i style={{ width: `${Math.max(0, Math.min(100, r.leaderSharePct))}%`, background: needle.leaderColor }} />
            <i
              style={{
                left: `${Math.max(0, Math.min(100, r.leaderSharePct))}%`,
                width: `${Math.max(0, Math.min(100 - r.leaderSharePct, r.runnerSharePct))}%`,
                background: needle.runnerColor,
              }}
            />
          </div>
          <div className="rd-ballot-split">
            <span style={{ color: needle.leaderColor }}>{needle.leaderName} {r.leaderSharePct.toFixed(1)}%</span>
            <span style={{ color: needle.runnerColor }}>{needle.runnerName} {r.runnerSharePct.toFixed(1)}%</span>
          </div>
        </div>
      ))}
      <p className="rd-ballot-note">{voteModeWhyItMatters(needle)}</p>
    </div>
  );
}

export default function RaceDesk() {
  if (typeof document !== "undefined") {
    // CO-04: the individual race page is light-default with full dark
    // support — unlike the results hub (ResultsDesk), which stays
    // dark-default. Only fall back to light; an explicit stored preference
    // (from the toggle, on either page) is always respected.
    try {
      let stored: string | null = null;
      try { stored = localStorage.getItem("opa-theme"); } catch {}
      document.documentElement.dataset.opaTheme = stored === "dark" ? "dark" : "light";
    } catch {}
  }
  return (
    <ThemeProvider>
      <Desk />
    </ThemeProvider>
  );
}

function Desk() {
  const params = useParams();
  const router = useRouter();
  const raceId = String((params as any)?.id ?? "");
  const { index, error } = useElectionIndex(true) as { index: any; error: boolean };
  const [mapRace, setMapRace] = useState<any>(null);

  const doc = useMemo(() => {
    if (!index || !raceId) return null;
    return index.docs.find((d: any) => String(d.id) === raceId) || null;
  }, [index, raceId]);

  // the party siblings: same state, same night, same office once party words
  // are stripped — both primaries live on this one page
  const boards = useMemo(() => {
    if (!doc) return [] as any[];
    const key = officeKey(doc.contest);
    const sibs = key
      ? (index?.docs || []).filter(
          (d: any) =>
            d.id !== doc.id &&
            String(d.province) === String(doc.province) &&
            String(d.date) === String(doc.date) &&
            officeKey(d.contest) === key
        )
      : [];
    return [doc, ...sibs].sort((a, b) => boardRank(a) - boardRank(b)).slice(0, 3);
  }, [doc, index]);

  // CO-04 §7 parity — "AUTO-REFRESH 30s indicator": the season index is a
  // static snapshot fetched once per page load, so without this the board(s)
  // on this page would never update after the initial load. Direct CivicAPI
  // passthrough, same pattern as the results hub / local board — no storage.
  const [liveRaces, setLiveRaces] = useState<Record<string, any>>({});
  const boardIds = boards.map((b: any) => b.id).join(",");
  useEffect(() => {
    if (!boardIds) return;
    let alive = true;
    async function fetchAll() {
      await Promise.all(
        boardIds.split(",").map(async (id) => {
          try {
            const res = await fetch(`${CIVIC_BASE}/api/v2/race/${id}`, { cache: "no-store" });
            if (!res.ok) return;
            const d = await res.json();
            if (alive) setLiveRaces((prev) => ({ ...prev, [id]: d }));
          } catch {}
        })
      );
    }
    fetchAll();
    const t = setInterval(fetchAll, RACE_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [boardIds]);
  const liveBoards = useMemo(
    () => boards.map((b: any) => (liveRaces[b.id] ? { ...b, race: liveRaces[b.id] } : b)),
    [boards, liveRaces]
  );

  const openMap = (race: any) => {
    try { history.pushState({}, "", `/results/race/${raceId}?map=1`); } catch {}
    setMapRace(race);
  };
  const closeMap = () => {
    try { history.replaceState({}, "", `/results/race/${raceId}`); } catch {}
    setMapRace(null);
  };

  const title = doc ? (officeKey(doc.contest) || doc.contest || "race") : "";
  const meta = doc ? [doc.stateName || doc.province, fmtDate(doc.date), doc.office].filter(Boolean).join(" · ") : "";

  return (
    <div className={`rd-page ${manrope.variable}`}>
      <style>{OPA_GLOBAL_CSS}</style>
      <style>{RD_CSS}</style>

      <div className="rd-shell">
        <DarkNav />
        <div className="rd-folio">
          <button type="button" className="rd-back" onClick={() => router.push("/results")}>← the results desk</button>
          <span>live returns · county maps · forecasts</span>
        </div>

        {!index && !error ? (
          <div className="rd-hold">
            <div className="rd-hold-bar" />
            <span>pulling the season…</span>
          </div>
        ) : error ? (
          <div className="rd-hold"><span>couldn&rsquo;t load the season — refresh to retry.</span></div>
        ) : !doc ? (
          <div className="rd-hold">
            <span>we couldn&rsquo;t find that race.</span>
            <button type="button" className="rd-map-cta" onClick={() => router.push("/results")}>back to the desk <span aria-hidden>→</span></button>
          </div>
        ) : (
          <>
            <header className="rd-head">
              <span className="rd-head-eb"><i aria-hidden />{doc.stateName || doc.province} · 2026</span>
              <h1 className="rd-title">{title}<em>.</em></h1>
              <p className="rd-meta">{meta}</p>
            </header>

            {liveBoards.map((b: any, i: number) => (
              <Board key={b.id} doc={b} primary={i === 0} onMap={openMap} />
            ))}

            <div className="rd-more">
              <span className="rd-more-h">pull another race</span>
              <DeskSearch active variant="pill" onPick={(d: any) => { if (d?.race?.id != null) router.push(`/results/race/${d.race.id}`); }} />
            </div>
          </>
        )}
      </div>

      {mapRace ? <RaceDetail race={mapRace} onClose={closeMap} /> : null}
    </div>
  );
}

const RD_CSS = `
html, body { background: var(--page) !important; }
html { height: auto !important; overflow-y: auto !important; }
body { height: auto !important; min-height: 100svh; overflow: visible !important; overflow-x: clip !important; }
body header, body footer { display: none !important; }
body main > div { max-width: none !important; padding-left: 0 !important; padding-right: 0 !important; }
body main > div > div { padding-top: 0 !important; padding-bottom: 0 !important; }

.rd-page { position: relative; width: 100vw; margin-left: calc(50% - 50vw); min-height: 100svh; background: var(--page); color: var(--ink); font-family: var(--font-mp), "Manrope", "Helvetica Neue", Arial, sans-serif; }
.rd-shell { max-width: 1180px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 44px) clamp(60px, 10vh, 110px); }
.rd-folio { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding: 14px 0; margin-top: 6px; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule-soft); font-size: 10.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-dim); }
.rd-back { background: none; border: 0; cursor: pointer; font: inherit; color: var(--ink); letter-spacing: 0.18em; transition: color .15s ease; }
.rd-back:hover { color: #2dd4bf; }

.rd-hold { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 18vh 0; color: var(--ink-mute); font-size: 14px; }
.rd-hold-bar { width: 180px; height: 2px; border-radius: 99px; overflow: hidden; background: var(--rule); position: relative; }
.rd-hold-bar::after { content: ''; position: absolute; inset: 0; width: 40%; border-radius: 99px; background: #2dd4bf; animation: rdHold 1.2s ease-in-out infinite alternate; }
@keyframes rdHold { from { transform: translateX(-30%); } to { transform: translateX(260%); } }

.rd-head { padding: clamp(36px, 7vh, 72px) 0 clamp(10px, 2vh, 22px); }
.rd-head-eb { display: inline-flex; align-items: center; gap: 9px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-mute); }
.rd-head-eb i { width: 7px; height: 7px; background: #2dd4bf; border-radius: 1.5px; }
.rd-title { font-family: var(--font-mp), "Manrope", sans-serif; font-weight: 500; text-transform: lowercase; letter-spacing: -0.04em; line-height: 0.96; font-size: clamp(38px, 6.4vw, 84px); color: var(--ink-strong); margin-top: 14px; max-width: 26ch; }
.rd-title em { font-style: normal; color: #2dd4bf; }
.rd-meta { margin-top: 14px; font-size: 14px; color: var(--ink-mute); }

.rd-board { margin-top: clamp(34px, 6vh, 56px); }
/* tallies stay a compact column; the map takes the wide side */
.rd-board-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: clamp(26px, 3.4vw, 60px); margin-top: clamp(18px, 3vh, 30px); align-items: center; }
.rd-board-grid.nomap { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); align-items: start; }

/* the results block — the hub board's exact anatomy (tinted title band,
   projected banner, checkbox rows, reporting slider) laid OPEN on the page:
   the strips carry their own shape, nothing wraps the whole block */
.rd-board-h { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 14px; }
.rd-board-party { display: inline-flex; align-items: center; gap: 9px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-mute); }
.rd-board-party i { width: 7px; height: 7px; background: #2dd4bf; border-radius: 1.5px; }
.rd-board-flag { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 12px; font-weight: 600; color: var(--ink-dim); white-space: nowrap; }
.rd-board-flag.called { color: rgba(45,212,191,0.75); }

/* Zone 1 meta stats: REPORTED VOTES / EST. REPORTING / RACE STATUS (CO-04 §2/§3) */
.rd-meta { display: flex; flex-wrap: wrap; gap: clamp(20px, 3vw, 40px); padding: 14px 0 20px; border-bottom: 1px solid var(--rule-soft); }
.rd-meta-item { display: flex; flex-direction: column; gap: 5px; }
.rd-meta-label { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-dim); }
.rd-meta-val { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 17px; font-weight: 700; color: var(--ink-strong); font-variant-numeric: tabular-nums; }
.rd-meta-item.status { margin-left: auto; }
.rd-meta-status { display: inline-flex; align-items: center; gap: 8px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-strong); }
@media (max-width: 560px) {
  .rd-meta-item.status { margin-left: 0; }
}

.rd-tallies { display: flex; flex-direction: column; }
.rd-thead { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px 15px; border-radius: 11px 11px 0 0; }
.rd-thead-yr { font-family: "Oswald", "Barlow Condensed", system-ui, sans-serif; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; color: rgba(255,255,255,0.62); }
.rd-thead-title { font-family: "Anton", "Oswald", "Barlow Condensed", system-ui, sans-serif; font-weight: 400; font-size: clamp(18px, 1.9vw, 24px); line-height: 1.06; letter-spacing: 0.015em; text-transform: uppercase; color: #ffffff; }
.rd-banner { font-family: "Oswald", "Barlow Condensed", system-ui, sans-serif; font-weight: 600; font-size: 11.5px; letter-spacing: 0.09em; text-transform: uppercase; padding: 10px 16px; }
.rd-trow { display: grid; grid-template-columns: 3px 34px minmax(0, 1fr) auto auto; align-items: center; gap: clamp(9px, 1.1vw, 15px); padding: 12px 4px; border-bottom: 1px solid var(--hair, rgba(255,255,255,0.08)); font-family: "Instrument Sans", system-ui, sans-serif; }
.rd-trow-tick { width: 3px; height: 22px; border-radius: 2px; }
.rd-avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 800; font-size: 12px; flex-shrink: 0; }
.rd-trow-name { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.rd-trow-name b { display: flex; align-items: center; gap: 7px; font-size: 15.5px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink, #f1ece1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rd-trow-name small { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-dim, rgba(241,236,225,0.38)); }
.rd-trow.won .rd-trow-name b { color: var(--ink-strong, #fff); }
.rd-checkbox { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 4px; background: var(--called, #15803d); color: #fff; font-size: 9.5px; font-weight: 700; flex-shrink: 0; }
.rd-trow-votes { font-family: "Instrument Sans", system-ui, sans-serif; font-size: 13.5px; color: var(--ink-mute, rgba(241,236,225,0.6)); font-variant-numeric: tabular-nums; }
.rd-trow-pct { font-family: "Instrument Sans", system-ui, sans-serif; font-size: 16px; font-weight: 700; color: var(--ink-strong, #fff); font-variant-numeric: tabular-nums; min-width: 56px; text-align: right; }
.rd-slider { padding: 18px 2px 0; }
.rd-slider-track { position: relative; display: block; height: 4px; border-radius: 99px; background: var(--ink-dimmer, rgba(244,244,239,0.16)); }
.rd-slider-track i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: var(--ink-strong); }
.rd-slider-track b { position: absolute; top: 50%; width: 18px; height: 18px; border-radius: 99px; background: var(--ink-strong); border: 3px solid var(--page); transform: translate(-50%, -50%); box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
.rd-trow-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; padding: 12px 2px 0; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 12.5px; color: var(--ink-dim, rgba(241,236,225,0.38)); }
.rd-api { font-style: normal; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; padding: 2px 7px; border-radius: 5px; background: color-mix(in srgb, var(--ink) 14%, transparent); color: var(--ink, #f1ece1); margin-right: 6px; }
.rd-foot-rep { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
.rd-foot-rep b { font-weight: 700; font-size: 14.5px; color: var(--ink, #f1ece1); }
.rd-foot-rep span { font-size: 11.5px; color: var(--ink-dim, rgba(241,236,225,0.38)); }

.rd-needle { margin-top: clamp(22px, 4vh, 34px); max-width: 360px; }
.rd-needle-h { display: flex; align-items: center; gap: 10px; font-family: "Oswald", "Barlow Condensed", system-ui, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-dim, rgba(241,236,225,0.38)); margin-bottom: 12px; }
.rd-rule-chip { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: none; color: var(--ink-mute); background: var(--wash); border: 1px solid var(--rule); border-radius: 999px; padding: 3px 9px; }
.rd-forecast-beta { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: none; color: var(--ink-mute); background: var(--card); border: 1px solid var(--rule-strong); border-radius: 999px; padding: 2px 6px; margin-left: auto; }
.rd-wheel-row { display: flex; align-items: center; gap: 18px; }
.rd-wheel-legend { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
.rd-wheel-leg-row { display: flex; align-items: center; gap: 8px; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 13px; color: var(--ink); }
.rd-wheel-leg-row i { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.rd-wheel-leg-row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rd-wheel-leg-row b { margin-left: auto; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; font-weight: 700; color: var(--ink); }
.rd-wheel-margin { margin-top: 14px; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 12px; color: var(--ink-dim); }
.rd-wheel-verdict { margin-top: 10px; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 14px; line-height: 1.5; color: var(--ink); }
.rd-wheel-flip { margin-top: 6px; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 12.5px; line-height: 1.5; color: var(--ink-dim); }

/* PROJECTED FINAL SHARE — muted bars on the same 0-100 scale as the reported
   tallies bars (rd-slider); dashed/desaturated per the data-semantics rule
   (CO-04 §2: model outputs render muted, never mistaken for reported data). */
.rd-projshare { margin-top: 18px; padding-top: 16px; border-top: 1px dashed var(--rule); }
.rd-projshare-h { display: block; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 10px; }
.rd-projshare-row { display: grid; grid-template-columns: minmax(0,1fr) minmax(60px,120px) 48px; align-items: center; gap: 10px; padding: 6px 0; }
.rd-projshare-name { font-family: "Instrument Sans", system-ui, sans-serif; font-size: 12.5px; color: var(--ink-mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rd-projshare-track { position: relative; height: 6px; border-radius: 99px; background: var(--rule); overflow: hidden; }
.rd-projshare-track i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; opacity: 0.55; }
.rd-projshare-val { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12.5px; font-weight: 700; color: var(--ink); text-align: right; }
.rd-projshare-delta { grid-column: 1 / -1; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; color: var(--ink-dim); text-align: right; margin-top: -2px; }
.rd-wheel-semantics { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--rule-soft); font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: 0.03em; text-transform: uppercase; color: var(--ink-dim); }

.rd-runoff { margin-top: 16px; padding: 14px 16px; border-radius: 12px; background: var(--wash); border: 1px solid var(--rule); }
.rd-runoff-h { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 8px; }
.rd-runoff-bar { position: relative; height: 6px; border-radius: 99px; background: var(--rule); overflow: hidden; }
.rd-runoff-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: #2dd4bf; }
.rd-runoff-stats { display: flex; gap: 18px; margin-top: 10px; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 12.5px; color: var(--ink-mute); }
.rd-runoff-stats b { font-family: "JetBrains Mono", ui-monospace, monospace; color: var(--ink); margin-right: 5px; }
.rd-runoff-note { margin-top: 8px; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 12px; line-height: 1.5; color: var(--ink-dim); }

.rd-options-toggle { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; padding: 0; background: none; border: 0; cursor: pointer; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-mute); transition: color .15s ease; }
.rd-options-toggle:hover { color: var(--ink); }
.rd-options-chev { display: inline-block; font-size: 13px; transition: transform .18s ease; }
.rd-options-chev.open { transform: rotate(180deg); }
.rd-options { margin-top: 12px; padding: 16px; border: 1px solid var(--rule); border-radius: 12px; background: var(--wash); }
.rd-options-h { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 8px; }
.rd-options-note { margin-top: 6px; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 10.5px; color: var(--ink-dim); }
.rd-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--rule-soft); }
.rd-stat { display: flex; flex-direction: column; gap: 2px; }
.rd-stat span { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); }
.rd-stat b { font-family: "Instrument Sans", system-ui, sans-serif; font-size: 14px; font-weight: 700; color: var(--ink); }

.rd-board-right { display: flex; flex-direction: column; align-items: center; width: 100%; }
.rd-map-toggles { display: flex; align-self: flex-start; gap: 4px; margin-bottom: 10px; padding: 3px; border-radius: 999px; background: var(--wash); border: 1px solid var(--rule); }
.rd-map-toggles button { padding: 5px 13px; border-radius: 999px; border: 0; background: none; cursor: pointer; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); transition: background .15s ease, color .15s ease; }
.rd-map-toggles button.on { background: var(--ink); color: var(--page); }
.rd-map { position: relative; height: clamp(400px, 56vh, 620px); width: 100%; }
.rd-map::before { content: ''; position: absolute; inset: -8% -4%; border-radius: 40px; background: radial-gradient(58% 58% at 50% 46%, rgba(106,108,255,0.14), transparent 72%); filter: blur(28px); pointer-events: none; }
.rd-map .opa-er-map { position: absolute; inset: 0; width: 100%; height: 100%; }
.rd-map .opa-er-mapvig { display: none; }
.rd-map-legend { display: flex; align-self: flex-start; align-items: center; gap: 8px; margin-top: 12px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: 0.04em; color: var(--ink-dim); }
.rd-map-legend-sw { width: 46px; height: 5px; border-radius: 99px; flex-shrink: 0; }
/* quiet editorial link — no pill, no mono shouting */
.rd-map-cta { position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 8px; margin-top: 18px; padding: 0 1px 3px; cursor: pointer; background: none; border: 0; border-bottom: 1px solid color-mix(in srgb, var(--ink) 22%, transparent); font-family: var(--font-mp), "Manrope", sans-serif; font-size: 14.5px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); transition: border-color .2s ease; }
.rd-map-cta:hover { border-color: #2dd4bf; }
.rd-map-cta span { color: #2dd4bf; transition: transform .2s ease; }
.rd-map-cta:hover span { transform: translateX(3px); }
.rd-nomap { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; padding: clamp(30px, 6vh, 60px) 18px; border: 1px dashed var(--rule); border-radius: 18px; color: var(--ink-dim); font-size: 12.5px; line-height: 1.6; max-width: 340px; margin: 0 auto; }

/* Zone 4 — Projected Turnout & Remaining Vote (§4a) */
.rd-turnout { margin-top: clamp(30px, 5vh, 46px); padding-top: clamp(22px, 3.5vh, 34px); border-top: 1px solid var(--rule-soft); }
.rd-turnout-h { display: block; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 16px; }
.rd-turnout-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; padding-bottom: 20px; border-bottom: 1px solid var(--rule-soft); }
.rd-turnout-tracks { display: flex; flex-direction: column; gap: 16px; margin-top: 20px; }
.rd-turnout-track { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2.4fr) auto; align-items: center; gap: 14px; }
.rd-turnout-track-name { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rd-turnout-bar { position: relative; height: 8px; border-radius: 99px; background: var(--rule); overflow: visible; }
.rd-turnout-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; }
.rd-turnout-bar em { position: absolute; top: -1px; bottom: -1px; border-radius: 99px; border: 1.5px dashed; background: none; font-style: normal; opacity: 0.55; }
.rd-turnout-track-total { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12px; color: var(--ink-mute); white-space: nowrap; }
.rd-turnout-track-total small { font-size: 9px; letter-spacing: 0.06em; color: var(--ink-dim); }
.rd-turnout-read { margin-top: 18px; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 13.5px; line-height: 1.55; color: var(--ink-mute); max-width: 62ch; }

/* Zone 5 — Results by County (§3, two-variant PROJ. MARGIN rule §0.3) */
.rd-county { margin-top: clamp(30px, 5vh, 46px); padding-top: clamp(22px, 3.5vh, 34px); border-top: 1px solid var(--rule-soft); }
.rd-county-h { display: block; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 16px; }
.rd-county-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.rd-county-search { display: flex; align-items: center; gap: 8px; padding: 8px 13px; border-radius: 10px; background: var(--wash); border: 1px solid var(--rule); color: var(--ink-dim); min-width: 200px; }
.rd-county-search input { flex: 1; min-width: 0; background: none; border: 0; outline: none; color: var(--ink); font-family: "Instrument Sans", system-ui, sans-serif; font-size: 13px; }
.rd-county-search input::placeholder { color: var(--ink-dim); }
.rd-county-sorts { display: flex; gap: 4px; padding: 3px; border-radius: 999px; background: var(--wash); border: 1px solid var(--rule); }
.rd-county-sorts button { padding: 5px 12px; border-radius: 999px; border: 0; background: none; cursor: pointer; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-dim); transition: background .15s ease, color .15s ease; }
.rd-county-sorts button.on { background: var(--ink); color: var(--page); }
.rd-county-tablewrap { max-height: 480px; overflow: auto; border: 1px solid var(--rule-soft); border-radius: 12px; }
.rd-county-table { width: 100%; border-collapse: collapse; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 13px; }
.rd-county-table thead th { position: sticky; top: 0; z-index: 1; background: var(--wash); backdrop-filter: blur(6px); text-align: left; padding: 10px 14px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); border-bottom: 1px solid var(--rule); }
.rd-county-table th.num, .rd-county-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.rd-county-table td { padding: 10px 14px; border-bottom: 1px solid var(--rule-soft); color: var(--ink); white-space: nowrap; }
.rd-county-table tbody tr:last-child td { border-bottom: 0; }
.rd-county-leader { display: inline-flex; align-items: center; gap: 8px; }
.rd-county-leader i { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.rd-county-leader b { margin-left: 4px; font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 700; }
.rd-county-proj { color: var(--ink-mute); font-style: italic; }
.rd-county-loading { text-align: center; padding: 26px 14px; color: var(--ink-dim); font-style: italic; }

.rd-timeline { margin-top: clamp(30px, 5vh, 46px); padding-top: clamp(22px, 3.5vh, 34px); border-top: 1px solid var(--rule-soft); }
.rd-timeline-h { display: block; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 16px; }
.rd-timeline-charts { display: flex; flex-direction: column; gap: 14px; }
.rd-timeline-axis { display: flex; justify-content: space-between; margin-top: 6px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; color: var(--ink-dim); }
.rd-tl-chart { border: 1px solid var(--rule-soft); border-radius: 10px; padding: 10px 12px; }
.rd-tl-chart-h { display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mp), "Manrope", sans-serif; font-size: 12px; font-weight: 600; color: var(--ink-mute); text-transform: lowercase; margin-bottom: 6px; }
.rd-tl-expand { background: none; border: 1px solid var(--rule); border-radius: 99px; padding: 2px 10px; font: inherit; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-dim); cursor: pointer; }
.rd-tl-expand:hover { color: var(--ink); border-color: var(--ink-dim); }
.rd-tl-svg { width: 100%; height: 84px; display: block; touch-action: none; }
.rd-tl-chart.expanded .rd-tl-svg { height: 180px; }
.rd-tl-tip { display: flex; gap: 14px; margin-top: 6px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; }

.rd-ballot { margin-top: clamp(30px, 5vh, 46px); padding-top: clamp(22px, 3.5vh, 34px); border-top: 1px solid var(--rule-soft); }
.rd-ballot-h { display: block; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 6px; }
.rd-ballot-sub { margin: 0 0 16px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: 0.04em; color: var(--ink-dim); }
.rd-ballot-row { display: grid; grid-template-columns: 110px minmax(0,1fr); grid-template-areas: "mode meta" "bar bar" "split split"; row-gap: 6px; align-items: center; padding: 14px 0; border-bottom: 1px dashed var(--rule); }
.rd-ballot-row:last-of-type { border-bottom: none; }
.rd-ballot-mode { grid-area: mode; font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13.5px; font-weight: 600; color: var(--ink); }
.rd-ballot-meta { grid-area: meta; display: flex; justify-content: flex-end; gap: 14px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; color: var(--ink-mute); }
.rd-ballot-bar { grid-area: bar; position: relative; height: 8px; border-radius: 99px; background: var(--rule); overflow: hidden; }
.rd-ballot-bar i { position: absolute; top: 0; bottom: 0; opacity: 0.82; }
.rd-ballot-split { grid-area: split; display: flex; justify-content: space-between; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11.5px; font-weight: 700; }
.rd-ballot-note { margin-top: 16px; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 12.5px; line-height: 1.55; color: var(--ink-dim); max-width: 68ch; }

.rd-about { margin-top: clamp(26px, 4vh, 40px); padding-top: clamp(20px, 3vh, 30px); border-top: 1px solid var(--rule-soft); }
.rd-about-h { display: block; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 10px; }
.rd-about p { font-family: "Instrument Sans", system-ui, sans-serif; font-size: 15px; line-height: 1.65; color: var(--ink-mute); max-width: 68ch; }

.rd-more { margin-top: clamp(50px, 9vh, 90px); border-top: 1px solid var(--rule); padding-top: 26px; max-width: 480px; }
.rd-more-h { display: block; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 12px; }

@media (max-width: 860px) {
  .rd-board-grid, .rd-board-grid.nomap { grid-template-columns: 1fr; }
  .rd-map { height: clamp(230px, 32vh, 300px); }
  .rd-trow-votes { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .rd-hold-bar::after { animation: none; }
}

/* the shared search (pill variant) — same dialect as the landing */
.desk-search-field { position: relative; display: flex; align-items: center; gap: 12px; padding: 0 16px; height: 60px; border-radius: 16px; background: var(--wash); border: 1px solid var(--rule); transition: border-color .18s ease, background .18s ease, box-shadow .2s ease; }
.desk-search.pill .desk-search-field { height: 48px; border-radius: 999px; }
.desk-search-field:focus-within { border-color: rgba(45,212,191,0.55); background: var(--hover); box-shadow: 0 0 0 4px rgba(45,212,191,0.08); }
.desk-search-icon { color: var(--ink-dim); flex-shrink: 0; }
.desk-search-field input { flex: 1; min-width: 0; background: none; border: 0; outline: none; color: var(--ink); font-family: var(--font-mp), "Manrope", sans-serif; font-size: 14.5px; letter-spacing: -0.01em; }
.desk-search-field input::placeholder { color: var(--ink-dim); }
.desk-search-kbd { flex-shrink: 0; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; color: var(--ink-dim); border: 1px solid var(--rule); border-radius: 6px; padding: 3px 7px; background: var(--wash); }
.desk-search-pop { position: absolute; top: calc(100% + 10px); left: 0; right: 0; z-index: 50; border-radius: 16px; border: 1px solid var(--card-bd); background: color-mix(in srgb, var(--card) 92%, transparent); -webkit-backdrop-filter: blur(24px) saturate(1.2); backdrop-filter: blur(24px) saturate(1.2); box-shadow: var(--shadow-pop); overflow: hidden; animation: deskPop .18s cubic-bezier(.2,.8,.2,1); }
@keyframes deskPop { from { opacity: 0; transform: translateY(-6px); } }
.desk-spop-h { display: flex; justify-content: space-between; gap: 12px; padding: 10px 16px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-dim); border-bottom: 1px solid var(--rule-soft); }
.desk-spop-h span:last-child { color: rgba(45,212,191,0.55); }
.desk-srow { position: relative; display: grid; grid-template-columns: 3px 42px minmax(0,1fr) auto; align-items: center; gap: 13px; width: 100%; text-align: left; border: 0; cursor: pointer; padding: 12px 16px; background: transparent; transition: background .12s ease; }
.desk-srow + .desk-srow { border-top: 1px solid var(--rule-soft); }
.desk-srow[data-active="1"] { background: rgba(45,212,191,0.045); }
.desk-srow[data-active="1"]::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: #2dd4bf; box-shadow: 0 0 12px rgba(45,212,191,0.55); }
.desk-srow-tick { width: 3px; height: 26px; border-radius: 2px; }
.desk-srow-st { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.03em; color: var(--ink); }
.desk-srow-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.desk-srow-title { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-hl { background: none; color: #2dd4bf; }
.desk-srow-meta { font-size: 10.5px; color: var(--ink-dim); text-transform: lowercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-srow-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.desk-srow-right b { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; white-space: nowrap; }
.desk-srow-right > span { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9px; color: var(--ink-dim); }
.desk-srow-await { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.08em; }
.desk-search-empty { padding: 20px 16px; color: var(--ink-mute); font-size: 13px; }
.desk-search-empty b { color: #2dd4bf; font-weight: 600; }
.desk-search-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 16px; border-top: 1px solid var(--rule); background: var(--wash); font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); }
.desk-search-keys { color: var(--ink-dim); }
`;
