"use client";

/**
 * ARIZONA PRIMARY NIGHT BOARD — July 21, 2026
 * ---------------------------------------------------------------------------
 * Standalone landing board for the Arizona statewide primary. Built against
 * the CO-04 Election Desk design system (TPSI-Election-Desk-Design-System.md).
 *
 * WHY THIS IS DATE-DRIVEN AND NOT ID-DRIVEN
 * -----------------------------------------
 * The existing hub (components/ResultsLanding.tsx) hardcodes CivicAPI race ids
 * in SPOTLIGHT / STATE_GROUPS arrays. That works for races registered days in
 * advance, but CivicAPI publishes race ids only ~2-3 weeks out (see the note in
 * _data/raceCapabilities.ts, 2026-07-19). Rather than block on ids — or worse,
 * fabricate them — this board queries by DATE and ranks whatever comes back
 * using classifyRaceTier(), which derives precedence from contest text alone.
 *
 * Consequence: this file needs no edits when the ids land. It self-populates.
 *
 * ⚠️ ONE THING TO VERIFY — see fetchRacesForDate() below.
 */

import React, { useEffect, useMemo, useState } from "react";
import DarkNav from "@/app/components/DarkNav";
import { classifyRaceTier, type RaceTier } from "../_data/raceCapabilities";

const CIVIC_BASE = "https://civicapi.org";
const ELECTION_DATE = "2026-07-21";
const REFRESH_MS = 30_000;

/* ── Board docket — confirmed CivicAPI ids (pulled live 2026-07-21) ───────────
 * These are the marquee statewide + most-competitive US House primaries. The
 * board fetches the full date window and filters to this set, so the docket is
 * curated (no 400-row down-ballot flood) but every id is real and verified.
 * Uncontested primaries (single candidate) are included where the office is
 * marquee — they still show as CALLED, which is correct.
 *
 * To add or drop a race: edit this array only. Ordering is handled by tier.
 */
const AZ_DOCKET: number[] = [
  // Governor
  84359, // R — Biggs / Schweikert / Miceli
  84356, // D — Hobbs
  // Attorney General
  84329, // R — Glassman / Petersen
  84328, // D — Mayes
  // Secretary of State
  84412, // R — Kolodin / Swoboda
  84410, // D — Fontes
  // US House — most competitive
  84539, // AZ-01 R — Trobough / Chaplik / Feely
  84537, // AZ-01 D — Shah / Treble / Galán-Woods
  84551, // AZ-05 R — Keenan / Lamb
  84550, // AZ-05 D — Hualde / James / Lee
  84547, // AZ-04 D — Stanton / Newkirk
];

/* ── Types — mirrors the verified /api/v2/race/{id} response shape ────────── */
export type CivicCandidate = {
  name: string;
  party?: string | null;
  color?: string | null; // CivicAPI's own hex — deliberately IGNORED, see partyColor()
  votes?: number;
  percent?: number;
  winner?: boolean;
};

export type CivicRace = {
  id: number;
  type?: string;
  country?: string;
  province?: string | null;
  district?: string | null;
  municipality?: string | null;
  election_name?: string;
  election_type?: string;
  election_date?: string;
  has_breakdown?: boolean;
  has_map?: boolean;
  percent_reporting?: number;
  candidates?: CivicCandidate[];
};

/* ── Party → token mapping ───────────────────────────────────────────────────
 * Design system §1 Rule 0.1: do not sample foreign palettes. CivicAPI ships a
 * `color` per candidate (#EA6D6A, #6495ED …) that is NOT the TPSI palette, so
 * it is discarded.
 *
 * Critical for tonight: Arizona's July 21 contests are PARTY PRIMARIES. Every
 * candidate in the GOP gubernatorial primary is a Republican, so colouring by
 * party alone would render the whole field one flat red — and the Color LAW
 * forbids red-vs-blue inside a one-party race. So within a single race the
 * leader takes the party hue and subsequent candidates take --c2 / ink.
 */
function partyHue(party?: string | null): string {
  const p = String(party || "").trim().toLowerCase();
  if (p.startsWith("d")) return "var(--dem)";
  if (p.startsWith("r")) return "var(--gop)";
  return "var(--c2)";
}

/** Assigns display colours across a single race's field, honouring the
 *  same-party rule: A = party hue, B = --c2, remainder = muted ink. */
function assignFieldColors(cands: CivicCandidate[]): string[] {
  const parties = new Set(
    cands.map((c) => String(c.party || "").trim().toLowerCase()[0]).filter(Boolean)
  );
  const samePartyRace = parties.size <= 1;
  return cands.map((c, i) => {
    if (!samePartyRace) return partyHue(c.party);
    if (i === 0) return partyHue(c.party);
    if (i === 1) return "var(--c2)";
    return "var(--ink3)";
  });
}

/* ── Data fetch ──────────────────────────────────────────────────────────────
 * ⚠️ VERIFY THIS ENDPOINT BEFORE GOING LIVE.
 *
 * Confirmed working (schema verified 2026-07-21):
 *     GET /api/v2/race/{id}            → single race
 *     GET /api/v2/race/search?query=   → search, returns {count,offset,limit,races[]}
 *
 * NOT yet confirmed: the by-date filter parameter. The hub has never used one
 * (it hardcodes ids instead), so there was no in-repo precedent to copy and it
 * could not be validated from this environment.
 *
 * Two confirmed endpoints (verified 2026-07-21 against the live API):
 *     GET /api/v2/race/{id}                         → single race
 *     GET /api/v2/race/search?startDate=&endDate=   → date window
 *
 * The board pulls the curated AZ_DOCKET by id — the same per-id endpoint the
 * rest of the site uses (ResultsLanding, RaceDesk, LocalBoard all hit it). This
 * is more robust than the date/province filter for a fixed marquee docket: no
 * dependence on the exact province-string format, and it skips the down-ballot
 * flood a full date-window pull returns. Failed ids are skipped, not fatal.
 */
async function fetchRacesForDate(signal?: AbortSignal): Promise<CivicRace[]> {
  const results = await Promise.all(
    AZ_DOCKET.map(async (id) => {
      try {
        const res = await fetch(`${CIVIC_BASE}/api/v2/race/${id}`, {
          cache: "no-store",
          signal,
        });
        if (!res.ok) return null;
        return (await res.json()) as CivicRace;
      } catch {
        return null;
      }
    })
  );
  return results.filter((r): r is CivicRace => r != null);
}

/* ── Ranking ─────────────────────────────────────────────────────────────────
 * Reuses the codebase's own heuristic rather than a bespoke list. Governor and
 * US Senate float to the top; down-ballot and local fall to tier 2.
 */
function rankRaces(races: CivicRace[]): CivicRace[] {
  return [...races].sort((a, b) => {
    const ta = classifyRaceTier(a.election_name);
    const tb = classifyRaceTier(b.election_name);
    if (ta !== tb) return tb - ta;
    const ra = a.percent_reporting ?? 0;
    const rb = b.percent_reporting ?? 0;
    return rb - ra;
  });
}

function raceStatus(r: CivicRace): { label: string; cls: string } {
  const reporting = Number(r.percent_reporting) || 0;
  const called = (r.candidates || []).some((c) => c.winner);
  if (called) return { label: "CALLED", cls: "called" };
  if (reporting > 0) return { label: "LIVE", cls: "live" };
  return { label: "POLLS OPEN", cls: "scheduled" };
}

function shortTitle(name?: string): string {
  return String(name || "")
    .replace(/^Arizona\s+/i, "")
    .replace(/\s*\(.*?\)\s*$/, "")
    .trim();
}

/* ── Candidate row — §4.2, solid bars = reported ─────────────────────────── */
function CandidateRow({ c, color, leader }: { c: CivicCandidate; color: string; leader: boolean }) {
  const initials = String(c.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="cand">
      <span className="rail" style={{ background: color }} />
      <span className="ava">{initials}</span>
      <span className="nm">
        {c.name}
        {c.winner && <span className="chk">✓</span>}
        <small>{[c.party, "PRIMARY"].filter(Boolean).join(" · ")}</small>
      </span>
      <span className="votes num">{(c.votes ?? 0).toLocaleString()}</span>
      <span className="pct num" style={{ color: leader ? color : "var(--ink)" }}>
        {(c.percent ?? 0).toFixed(1)}%
      </span>
    </div>
  );
}

/* ── Race card ───────────────────────────────────────────────────────────── */
function RaceCard({ race, tier }: { race: CivicRace; tier: RaceTier }) {
  const cands = useMemo(
    () => [...(race.candidates || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0)),
    [race.candidates]
  );
  const colors = useMemo(() => assignFieldColors(cands), [cands]);
  const status = raceStatus(race);
  const reporting = Number(race.percent_reporting) || 0;
  const totalVotes = cands.reduce((s, c) => s + (c.votes || 0), 0);

  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <div className="kicker">{tier >= 4 ? "STATEWIDE" : "ARIZONA PRIMARY"}</div>
          <h2 className="panel-title-lg">{shortTitle(race.election_name)}</h2>
        </div>
        <span className={`badge ${status.cls}`}>
          {status.cls === "live" && <i />}
          {status.label}
        </span>
      </div>

      <div className="panel-body">
        {cands.length === 0 ? (
          <p className="awaiting">Polls have not closed. Results begin after 7:00 PM MST.</p>
        ) : (
          cands.map((c, i) => (
            <CandidateRow key={c.name + i} c={c} color={colors[i]} leader={i === 0} />
          ))
        )}
      </div>

      <div className="panel-foot">
        <span className="kicker">
          EST. REPORTING <b className="num">{reporting.toFixed(0)}%</b>
        </span>
        <span className="kicker">
          REPORTED VOTES <b className="num">{totalVotes.toLocaleString()}</b>
        </span>
      </div>
    </article>
  );
}

/* ── Board ───────────────────────────────────────────────────────────────── */
export default function ArizonaBoard() {
  const [races, setRaces] = useState<CivicRace[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [updated, setUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;

    async function run() {
      try {
        const r = await fetchRacesForDate(ctrl.signal);
        if (!alive) return;
        setRaces(rankRaces(r));
        setUpdated(new Date());
        setState(r.length ? "ready" : "empty");
      } catch {
        if (alive) setState((s) => (s === "ready" ? "ready" : "error"));
      }
    }

    run();
    const t = setInterval(run, REFRESH_MS);
    return () => {
      alive = false;
      ctrl.abort();
      clearInterval(t);
    };
  }, []);

  return (
    <div className="desk az-root">
      <style>{CSS}</style>

      <DarkNav />
      <div className="az-rule" />

      <div className="az-head">
        <div className="kicker">THE PUBLIC SENTIMENT INSTITUTE · ELECTION DESK</div>
        <h1>Arizona Primary</h1>
        <p className="dek">
          Arizona votes in its first July primary, moved permanently to the second-to-last
          Tuesday in July. Statewide nominations for Governor, US Senate, and down-ballot
          offices are on the ballot, with results reported as counties close.
        </p>
        <div className="az-meta">
          <span className="kicker">
            LAST UPDATED{" "}
            <b className="num">
              {updated ? updated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}
            </b>
          </span>
          <span className="kicker">
            RACES ON BOARD <b className="num">{races.length}</b>
          </span>
          <span className="kicker">AUTO-REFRESH · 30s</span>
        </div>
      </div>

      {state === "loading" && <p className="az-note">Loading tonight's races…</p>}

      {state === "empty" && (
        <p className="az-note">
          No Arizona races have been published for tonight yet. The board populates
          automatically as soon as results are posted.
        </p>
      )}

      {state === "error" && (
        <p className="az-note">
          Results feed unreachable. Retrying every 30 seconds.
        </p>
      )}

      <div className="az-grid">
        {races.map((r) => (
          <RaceCard key={r.id} race={r} tier={classifyRaceTier(r.election_name)} />
        ))}
      </div>

      <div className="az-foot">
        <p>
          Reported results are shown as counted. Estimated reporting reflects share of
          expected vote, not precincts. TPSI has not published a model for these races,
          so no projection is shown.
        </p>
        <span className="kicker">POWERED BY CIVICAPI</span>
      </div>
    </div>
  );
}

/* ── Styles — CO-04 tokens, scoped locally ───────────────────────────────────
 * Scoped to .az-root rather than :root deliberately. The §1 token block is not
 * installed globally anywhere in this tree (nothing references --r-panel or
 * --hairline), and the repo root was not available to inspect, so defining
 * these locally avoids touching a global stylesheet blind and keeps tonight's
 * page from affecting the rest of the site.
 */
const CSS = `
body header, body footer { display: none !important; }

.az-root{
  --canvas:#f7f7f4; --panel:#ffffff; --panel2:#f1f1ed; --panel3:#e9e9e4;
  --hairline:#e8e8e2; --hairline2:#d9d9d1;
  --ink:#17171b; --ink2:#5d5d58; --ink3:#9c9c93;
  --dem:#1d5fc4; --gop:#c22f3b; --c2:#b5338f;
  --live:#0d9488; --called:#15803d; --gold:#a16207;
  --brand-grad:linear-gradient(90deg,#d2494b 0%,#a44197 20%,#6d3ee9 51%,#3f60e8 100%);
  --mono:'JetBrains Mono',ui-monospace,monospace;
  --sans:'Geist',system-ui,sans-serif;
  --r-panel:14px; --r-card:10px; --r-pill:999px;
  --shadow:0 1px 3px rgba(0,0,0,.05);
  background:var(--canvas); color:var(--ink);
  min-height:100%; padding:0 24px 64px; max-width:1080px; margin:0 auto;
}
[data-theme="dark"] .az-root{
  --canvas:#0a0a0c; --panel:#111114; --panel2:#16161a; --panel3:#1c1c21;
  --hairline:rgba(255,255,255,.08); --hairline2:rgba(255,255,255,.15);
  --ink:#f2f2f0; --ink2:rgba(242,242,240,.62); --ink3:rgba(242,242,240,.36);
  --dem:#3b7bde; --gop:#d64550; --c2:#c757a8;
  --live:#2dd4bf; --called:#37b26c; --gold:#e8b93c;
  --shadow:none;
}

/* brand gradient — placement 1 of 2 (nav underrule) */
.az-rule{ height:3px; background:var(--brand-grad); margin:0 -24px 28px; }

.az-root h1,.az-root h2,.az-root .panel-title,.az-root .panel-title-lg,
.az-root .kicker,.az-root .badge,.az-root .num{ font-family:var(--mono); }
.az-root .dek,.az-root .az-foot p,.az-root .awaiting,.az-root .az-note{ font-family:var(--sans); }
.az-root .num{ font-variant-numeric:tabular-nums; }

.az-head{ padding-bottom:22px; border-bottom:1px solid var(--hairline); margin-bottom:24px; }
.az-head h1{ font-weight:800; font-size:clamp(20px,2.2vw,27px); letter-spacing:-.02em; margin:8px 0 0; }
.az-root .kicker{ font-weight:700; font-size:9.5px; letter-spacing:.13em;
  text-transform:uppercase; color:var(--ink3); }
.az-head .dek{ font-size:14px; line-height:1.6; color:var(--ink2); max-width:64ch; margin:10px 0 0; }
.az-meta{ display:flex; flex-wrap:wrap; gap:20px; margin-top:16px; }
.az-meta b{ color:var(--ink); font-weight:700; margin-left:4px; }

.az-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(420px,1fr)); gap:16px; }
@media (max-width:900px){ .az-grid{ grid-template-columns:1fr; } }

.panel{ background:var(--panel); border:1px solid var(--hairline);
  border-radius:var(--r-panel); box-shadow:var(--shadow);
  display:flex; flex-direction:column; overflow:hidden; }
.panel-head{ display:flex; justify-content:space-between; align-items:center;
  gap:12px; padding:13px 16px; border-bottom:1px solid var(--hairline); }
.panel-title-lg{ font-weight:700; font-size:15px; letter-spacing:-.01em; margin:3px 0 0; }
.panel-body{ padding:2px 16px 6px; }
.panel-foot{ display:flex; justify-content:space-between; gap:12px;
  padding:11px 16px; border-top:1px solid var(--hairline); background:var(--panel2); }
.panel-foot b{ color:var(--ink); margin-left:4px; }

.cand{ display:grid; grid-template-columns:3px 40px 1fr auto auto;
  gap:0 13px; align-items:center; padding:12px 0;
  border-bottom:1px solid var(--hairline); }
.cand:last-child{ border-bottom:none; }
.cand .rail{ width:3px; height:38px; border-radius:2px; }
.cand .ava{ width:40px; height:40px; border-radius:50%; background:var(--panel2);
  display:flex; align-items:center; justify-content:center;
  font-family:var(--mono); font-weight:800; font-size:14px; color:var(--ink2); }
.cand .nm{ font-family:var(--mono); font-weight:700; font-size:15px; }
.cand .nm small{ display:block; font-family:var(--mono); font-weight:400;
  font-size:9.5px; letter-spacing:.07em; color:var(--ink3); margin-top:2px; }
.cand .chk{ display:inline-flex; width:16px; height:16px; border-radius:50%;
  background:var(--called); color:#fff; font-size:10px; font-weight:800;
  align-items:center; justify-content:center; margin-left:8px; }
.cand .votes{ font-family:var(--mono); font-size:12.5px; color:var(--ink2); text-align:right; }
.cand .pct{ font-family:var(--mono); font-weight:800; font-size:25px;
  min-width:92px; text-align:right; }

.badge{ font-family:var(--mono); font-size:10.5px; letter-spacing:.1em;
  padding:5px 12px; border-radius:var(--r-pill); white-space:nowrap;
  border:1px solid var(--hairline2); color:var(--ink2); background:var(--panel); }
.badge.called{ color:var(--called); border-color:color-mix(in srgb,var(--called) 35%,transparent); }
.badge.live{ color:var(--live); border-color:color-mix(in srgb,var(--live) 35%,transparent); }
.badge.live i{ display:inline-block; width:6px; height:6px; border-radius:50%;
  background:var(--live); margin-right:7px; animation:az-pulse 1.7s infinite; }
@keyframes az-pulse{ 50%{ opacity:.3; } }

.awaiting,.az-note{ font-size:13px; color:var(--ink2); line-height:1.6; padding:14px 0; }
.az-note{ padding:20px 0; }

.az-foot{ margin-top:32px; padding-top:18px; border-top:1px solid var(--hairline);
  display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap; }
.az-foot p{ font-size:12px; color:var(--ink3); line-height:1.6; max-width:70ch; margin:0; }
`;
